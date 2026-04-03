from fastapi import APIRouter, Depends, HTTPException, Header, Request
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, List, Dict, Any
import httpx
import os
import logging
from db.database import get_db
from core.portfolio_analyzer import analyze_portfolio

logger = logging.getLogger(__name__)

# Global in-memory cache for KIS tokens to prevent EGW00133 rate limits
# Format: { app_key: {"access_token": "...", "expires_at": timestamp} }
TOKEN_CACHE = {}

router = APIRouter()


@router.get("/portfolio")
async def get_my_portfolio(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Fetch user portfolio from KIS API and calculate factor balances.
    """
    from dotenv import load_dotenv
    import os

    env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
    load_dotenv(dotenv_path=env_path, override=True)

    kis_url_base = os.environ.get(
        "KIS_URL_BASE", "https://openapi.koreainvestment.com:9443"
    )

    # 1. Discover all account configs and global app keys from .env
    global_keys = []
    account_configs = []

    for key, value in os.environ.items():
        if key.startswith("KIS_APP_KEY") and value:
            suffix = key.replace("KIS_APP_KEY", "")
            app_secret = os.environ.get(f"KIS_APP_SECRET{suffix}")
            if app_secret:
                global_keys.append(
                    {"app_key": value.strip(), "app_secret": app_secret.strip()}
                )

    # fallback if only KIS_APP_KEY / KIS_APP_SECRET exist without suffix
    if (
        not global_keys
        and os.environ.get("KIS_APP_KEY")
        and os.environ.get("KIS_APP_SECRET")
    ):
        global_keys.append(
            {
                "app_key": os.environ.get("KIS_APP_KEY").strip(),
                "app_secret": os.environ.get("KIS_APP_SECRET").strip(),
            }
        )

    for key, value in os.environ.items():
        if key.startswith("KIS_ACC") and value:
            account_configs.append(value.strip())

    if not account_configs or not global_keys:
        raise HTTPException(
            status_code=400,
            detail="Server configuration error: No KIS accounts found in environment variables.",
        )

    try:
        # Pre-fetch and cache access tokens for all distinct keys to avoid EGW00133 rate limits
        active_keys = []
        import json
        import time

        async with httpx.AsyncClient() as client:
            token_url = f"{kis_url_base}/oauth2/tokenP"
            for keypair in global_keys:
                app_key = keypair["app_key"]
                app_secret = keypair["app_secret"]

                # Check cache first
                cached = TOKEN_CACHE.get(app_key)
                if cached and cached["expires_at"] > time.time():
                    active_keys.append(
                        {
                            "app_key": app_key,
                            "app_secret": app_secret,
                            "access_token": cached["access_token"],
                        }
                    )
                    continue

                token_payload = {
                    "grant_type": "client_credentials",
                    "appkey": app_key,
                    "appsecret": app_secret,
                }
                try:
                    token_res = await client.post(token_url, json=token_payload)
                    if token_res.status_code == 200:
                        access_token = token_res.json().get("access_token")
                        expires_in_sec = token_res.json().get("expires_in", 82800)
                        if access_token:
                            TOKEN_CACHE[app_key] = {
                                "access_token": access_token,
                                "expires_at": time.time()
                                + expires_in_sec
                                - 3600,  # 1 hr buffer
                            }
                            active_keys.append(
                                {
                                    "app_key": app_key,
                                    "app_secret": app_secret,
                                    "access_token": access_token,
                                }
                            )
                    else:
                        logger.warning(
                            f"Failed to fetch initial KIS token for {app_key}: {token_res.text}"
                        )
                except Exception as e:
                    logger.error(f"Error caching token for {app_key}: {e}")

        if not active_keys:
            raise HTTPException(
                status_code=500,
                detail="Failed to generate any valid KIS Access Tokens from the provided App Keys. Check rate limit or key validity.",
            )

        # 2. Define a helper function to fetch a single account using a brute-force key strategy
        async def fetch_single_account(acc_str: str):
            import json

            account_no_clean = "".join(filter(str.isdigit, acc_str))
            if not account_no_clean:
                return None
            cano = account_no_clean[:8]
            acnt_prdt_cd = account_no_clean[8:] or "01"
            formatted_account = f"{cano}-{acnt_prdt_cd}"

            for keypair in active_keys:
                app_key = keypair["app_key"]
                app_secret = keypair["app_secret"]
                access_token = keypair["access_token"]

                try:
                    balance_url = (
                        f"{kis_url_base}/uapi/domestic-stock/v1/trading/inquire-balance"
                    )
                    tr_id = "VTTC8434R" if "vts" in kis_url_base else "TTTC8434R"
                    headers = {
                        "content-type": "application/json; charset=utf-8",
                        "authorization": f"Bearer {access_token}",
                        "appkey": app_key,
                        "appsecret": app_secret,
                        "tr_id": tr_id,
                        "custtype": "P",
                    }
                    params = {
                        "CANO": cano,
                        "ACNT_PRDT_CD": acnt_prdt_cd,
                        "AFHR_FLPR_YN": "N",
                        "OFL_YN": "",
                        "INQR_DVSN": "02",
                        "UNPR_DVSN": "01",
                        "FUND_STTL_ICLD_YN": "N",
                        "FNCG_AMT_AUTO_RDPT_YN": "N",
                        "PRCS_DVSN": "01",
                        "CTX_AREA_FK100": "",
                        "CTX_AREA_NK100": "",
                    }

                    async with httpx.AsyncClient() as client:
                        balance_res = await client.get(
                            balance_url, headers=headers, params=params
                        )

                        if balance_res.status_code != 200:
                            headers["tr_id"] = "VTTC8434R"
                            balance_res = await client.get(
                                balance_url, headers=headers, params=params
                            )
                            if balance_res.status_code != 200:
                                logger.debug(
                                    f"KIS Balance Error for {acc_str} with {app_key}: {balance_res.text}"
                                )
                                continue  # Key failed, try next one

                        balance_data = balance_res.json()

                        if balance_data.get("rt_cd") != "0":
                            # Invalid Account for this key, keep looping
                            logger.debug(
                                f"KIS Logic Error for {acc_str} with {app_key}: {balance_data.get('msg_cd')} {balance_data.get('msg1')}"
                            )
                            continue

                    output1 = balance_data.get("output1", [])
                    output2 = balance_data.get("output2", [{}])[0]

                    tot_asst_amt_raw = float(output2.get("tot_asst_amt", 0))
                    tot_evlu_amt = float(output2.get("tot_evlu_amt", 0))
                    dnca_tot_amt = float(output2.get("dnca_tot_amt", 0))

                    # If KIS returns 0 for tot_asst_amt but we have evaluation amounts, use the computed sum
                    total_asset = max(tot_asst_amt_raw, tot_evlu_amt + dnca_tot_amt)

                    print(
                        f"[{acc_str}] SUCCESS! computed total_asset: {total_asset} with app_key: {app_key}"
                    )

                    local_holdings = []
                    for item in output1:
                        local_holdings.append(
                            {
                                "code": item.get("pdno"),
                                "name": item.get("prdt_name"),
                                "qty": int(item.get("hldg_qty", 0)),
                                "avg_price": float(item.get("pchs_avg_pric", 0)),
                                "current_price": float(item.get("prpr", 0)),
                                "eval_amount": float(item.get("evlu_amt", 0)),
                                "profit_loss": float(item.get("evlu_pfls_amt", 0)),
                                "return_rate": float(item.get("evlu_pfls_rt", 0)),
                                "account_no": formatted_account,
                            }
                        )

                    total_eval_amount = float(output2.get("tot_evlu_amt", 0))
                    total_profit_loss = float(output2.get("evlu_pfls_smtl_amt", 0))
                    cash_balance = float(output2.get("dnca_tot_amt", 0))

                    # 4. Fetch Overseas Stocks (CTRP6504R)
                    try:
                        async with httpx.AsyncClient() as ovrs_client:
                            ovrs_balance_url = f"{kis_url_base}/uapi/overseas-stock/v1/trading/inquire-present-balance"
                            ovrs_headers = headers.copy()
                            ovrs_headers["tr_id"] = (
                                "CTRP6504R"
                                if "openapi" in kis_url_base
                                else "VTRP6504R"
                            )
                            ovrs_params = {
                                "CANO": cano,
                                "ACNT_PRDT_CD": acnt_prdt_cd,
                                "WCRC_FRCR_DVSN_CD": "01",
                                "NATN_CD": "840",
                                "TR_MKET_CD": "00",
                                "INQR_DVSN_CD": "00",
                            }
                            ovrs_res = await ovrs_client.get(
                                ovrs_balance_url,
                                headers=ovrs_headers,
                                params=ovrs_params,
                            )

                            if ovrs_res.status_code == 200:
                                ovrs_data = ovrs_res.json()
                                if ovrs_data.get("rt_cd") == "0":
                                    ovrs_output1 = ovrs_data.get("output1", [])
                                    ovrs_output3 = ovrs_data.get("output3", {})

                                    ovrs_tot_asst_amt = float(
                                        ovrs_output3.get("tot_asst_amt", 0)
                                    )
                                    ovrs_tot_evlu_amt = float(
                                        ovrs_output3.get("evlu_amt_smtl_amt", 0)
                                    )
                                    ovrs_evlu_pfls_amt = float(
                                        ovrs_output3.get("tot_evlu_pfls_amt", 0)
                                    )
                                    ovrs_cash_balance = float(
                                        ovrs_output3.get("tot_frcr_cblc_smtl", 0)
                                    )

                                    total_asset += ovrs_tot_asst_amt
                                    total_eval_amount += ovrs_tot_evlu_amt
                                    total_profit_loss += ovrs_evlu_pfls_amt
                                    cash_balance += ovrs_cash_balance

                                    for item in ovrs_output1:
                                        local_holdings.append(
                                            {
                                                "code": item.get("pdno"),
                                                "name": item.get("prdt_name"),
                                                "qty": int(
                                                    float(item.get("ccld_qty_smtl1", 0))
                                                ),
                                                "avg_price": float(
                                                    item.get("avg_unpr3", 0)
                                                ),
                                                "current_price": float(
                                                    item.get("ovrs_now_pric1", 0)
                                                ),
                                                "eval_amount": float(
                                                    item.get("frcr_evlu_amt2", 0)
                                                ),
                                                "profit_loss": float(
                                                    item.get("evlu_pfls_amt2", 0)
                                                ),
                                                "return_rate": float(
                                                    item.get("evlu_pfls_rt1", 0)
                                                ),
                                                "account_no": formatted_account,
                                            }
                                        )
                    except Exception as ex:
                        logger.error(f"[{acc_str}] Overseas Test Error: {ex}")

                    return {
                        "account_no": formatted_account,
                        "account_name": "연동계좌",
                        "summary": {
                            "total_eval_amount": total_eval_amount,
                            "total_profit_loss": total_profit_loss,
                            "cash_balance": cash_balance,
                            "total_asset": total_asset,
                        },
                        "holdings": local_holdings,
                    }
                except Exception as e:
                    logger.error(f"Exception fetching {acc_str} with {app_key}: {e}")
                    continue

            # If we exhausted all global_keys and none succeeded:
            logger.warning(
                f"Failed to fetch account {acc_str} with any provided API key pair."
            )
            return None

        # 3. Fetch all accounts concurrently
        tasks = [fetch_single_account(acc) for acc in account_configs]
        import asyncio

        results = await asyncio.gather(*tasks)

        # 4. Aggregate
        valid_results = [r for r in results if r is not None]

        if not valid_results:
            raise HTTPException(
                status_code=400,
                detail="No valid connected accounts could be retrieved. Please check if your accounts are properly registered to your KIS App Key.",
            )

        aggregated_summary = {
            "total_eval_amount": sum(
                float(r["summary"]["total_eval_amount"]) for r in valid_results
            ),
            "total_profit_loss": sum(
                float(r["summary"]["total_profit_loss"]) for r in valid_results
            ),
            "cash_balance": sum(
                float(r["summary"]["cash_balance"]) for r in valid_results
            ),
            "total_asset": sum(
                float(r["summary"]["total_asset"]) for r in valid_results
            ),
        }

        all_holdings = []
        for r in valid_results:
            all_holdings.extend(r["holdings"])

        accounts_list = [
            {
                "account_no": r["account_no"],
                "account_name": r["account_name"],
                "total_asset": r["summary"]["total_asset"],
                "cash_balance": r["summary"]["cash_balance"],
            }
            for r in valid_results
        ]

        # 5. Enrich data with etf_master data
        analyzed_data = await analyze_portfolio(all_holdings, db)

        return {
            "status": "success",
            "kis_raw": {
                "summary": aggregated_summary,
                "holdings": all_holdings,
                "accounts": accounts_list,
            },
            "analyzed": analyzed_data,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Portfolio fetch error")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/trades/today")
async def get_today_trades():
    """
    KIS TTTC8001R — 당일 국내 체결 내역 조회.
    TOKEN_CACHE를 재사용하여 EGW00133 rate limit 방지.
    """
    from dotenv import load_dotenv
    import time
    from datetime import datetime, timezone, timedelta

    env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
    load_dotenv(dotenv_path=env_path, override=True)

    kis_url_base = os.environ.get("KIS_URL_BASE", "https://openapi.koreainvestment.com:9443")
    is_mock = "vts" in kis_url_base

    # ── KST 기준 오늘 날짜 ──────────────────────────────────────────────────
    KST = timezone(timedelta(hours=9))
    today_str = datetime.now(KST).strftime("%Y%m%d")

    # ── 계좌 목록 수집 ────────────────────────────────────────────────────────
    accounts_raw = [v.strip() for k, v in os.environ.items()
                    if k.startswith("KIS_ACC") and v.strip()]
    if not accounts_raw:
        raise HTTPException(status_code=400, detail="No KIS accounts configured")

    # ── 앱키 수집 ─────────────────────────────────────────────────────────────
    keypairs = []
    for k, v in os.environ.items():
        if k.startswith("KIS_APP_KEY") and v:
            suffix = k.replace("KIS_APP_KEY", "")
            secret = os.environ.get(f"KIS_APP_SECRET{suffix}", "")
            if secret:
                keypairs.append({"app_key": v.strip(), "app_secret": secret.strip()})

    if not keypairs:
        raise HTTPException(status_code=400, detail="No KIS API keys configured")

    # ── 토큰 확보 (캐시 우선, 없으면 신규 발급) ───────────────────────────────
    active_token = None
    active_key = None
    async with httpx.AsyncClient(timeout=15) as client:
        for kp in keypairs:
            app_key = kp["app_key"]
            cached = TOKEN_CACHE.get(app_key)
            if cached and cached["expires_at"] > time.time():
                active_token = cached["access_token"]
                active_key = kp
                break
            # 신규 발급
            try:
                res = await client.post(
                    f"{kis_url_base}/oauth2/tokenP",
                    json={"grant_type": "client_credentials",
                          "appkey": app_key, "appsecret": kp["app_secret"]}
                )
                token = res.json().get("access_token")
                if token:
                    TOKEN_CACHE[app_key] = {
                        "access_token": token,
                        "expires_at": time.time() + 82800 - 3600
                    }
                    active_token = token
                    active_key = kp
                    break
            except Exception as e:
                logger.warning(f"Token fetch failed for {app_key}: {e}")

    if not active_token:
        raise HTTPException(status_code=500, detail="Failed to obtain KIS access token")

    # ── 모든 계좌의 체결내역 수집 ────────────────────────────────────────────
    all_trades: list = []
    tr_id = "VTTC8001R" if is_mock else "TTTC8001R"

    async with httpx.AsyncClient(timeout=15) as client:
        for acc_raw in accounts_raw:
            digits = "".join(filter(str.isdigit, acc_raw))
            if len(digits) < 8:
                continue
            cano = digits[:8]
            acnt = digits[8:] or "01"

            headers = {
                "content-type": "application/json; charset=utf-8",
                "authorization": f"Bearer {active_token}",
                "appkey": active_key["app_key"],
                "appsecret": active_key["app_secret"],
                "tr_id": tr_id,
                "custtype": "P",
            }
            params = {
                "CANO": cano, "ACNT_PRDT_CD": acnt,
                "INQR_STRT_DT": today_str, "INQR_END_DT": today_str,
                "SLL_BUY_DVSN_CD": "00",   # 00=전체, 01=매도, 02=매수
                "INQR_DVSN": "00",
                "PDNO": "", "CCLD_DVSN": "01",
                "ORD_GNO_BRNO": "", "ODNO": "",
                "INQR_DVSN_3": "00", "INQR_DVSN_1": "",
                "CTX_AREA_FK100": "", "CTX_AREA_NK100": "",
            }
            try:
                res = await client.get(
                    f"{kis_url_base}/uapi/domestic-stock/v1/trading/inquire-daily-ccld",
                    headers=headers, params=params
                )
                data = res.json()
                if data.get("rt_cd") != "0":
                    logger.warning(f"[trades] {cano} rt={data.get('rt_cd')} {data.get('msg1','')}")
                    continue

                for item in data.get("output1", []):
                    qty = int(item.get("tot_ccld_qty", "0") or 0)
                    price = float(item.get("avg_prvs", "0") or 0)
                    amount = float(item.get("tot_ccld_amt", "0") or 0)
                    if qty == 0 and price == 0:   # 빈 행 제외
                        continue
                    tmd = item.get("ord_tmd", "")  # "HHMMSS"
                    time_display = f"{tmd[:2]}:{tmd[2:4]}:{tmd[4:]}" if len(tmd) == 6 else tmd
                    div_code = item.get("sll_buy_dvsn_cd", "")  # "01"=매도, "02"=매수
                    all_trades.append({
                        "account_no": f"{cano}-{acnt}",
                        "name": item.get("prdt_name", ""),
                        "code": item.get("pdno", ""),
                        "side": "매도" if div_code == "01" else "매수",
                        "side_code": div_code,
                        "qty": qty,
                        "price": price,
                        "amount": amount,
                        "profit_loss": float(item.get("evlu_pfls_amt", "0") or 0),
                        "time": time_display,
                        "order_no": item.get("odno", ""),
                    })
            except Exception as e:
                logger.error(f"[trades] {cano} error: {e}")

    # 시간 역순 정렬 (최신 체결이 위)
    all_trades.sort(key=lambda x: x["time"], reverse=True)

    return {
        "status": "success",
        "date": today_str,
        "count": len(all_trades),
        "trades": all_trades,
    }
