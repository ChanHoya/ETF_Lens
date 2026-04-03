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


@router.get("/risk-summary")
async def get_risk_summary(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    현재 시장 위험도(exit_signal) + 보유 ETF 목록을 교차 분석하여
    My탭 위험도 배너용 요약 정보를 반환합니다.
    """
    import asyncio

    # ── 1. Exit Signal 위험도 + 포트폴리오 병렬 조회 ─────────────────────────
    from api.exit_signal import get_exit_signal_data
    try:
        exit_data, portfolio_data = await asyncio.gather(
            get_exit_signal_data(),
            get_my_portfolio(request=request, db=db),
            return_exceptions=True,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    # exit_signal 오류 시 기본값
    if isinstance(exit_data, Exception):
        risk_info = {"level": "unknown", "label": "조회실패", "color": "gray",
                     "score": 0, "max_score": 12, "breakdown": {}}
    else:
        risk_info = exit_data.get("risk", {
            "level": "unknown", "label": "조회실패", "color": "gray", "score": 0, "max_score": 12
        })

    # ── 2. 보유 종목 목록 추출 ──────────────────────────────────────────────
    holdings = []
    if not isinstance(portfolio_data, Exception) and isinstance(portfolio_data, dict):
        kis_raw = portfolio_data.get("kis_raw", {})
        raw_holdings = kis_raw.get("holdings", [])
        for h in raw_holdings:
            eval_amt = h.get("eval_amount", 0) or 0
            pfls_amt = h.get("profit_loss", 0) or 0
            holdings.append({
                "code": h.get("code", ""),
                "name": h.get("name", ""),
                "eval_amount": eval_amt,
                "profit_loss": pfls_amt,
                "category_asset": h.get("category_asset", "기타"),
                "category_region": h.get("category_region", "기타"),
            })

    # ── 3. 위험도별 행동 가이드라인 ─────────────────────────────────────────
    level = risk_info.get("level", "unknown")
    action_guides = {
        "safe": {
            "title": "시장 상황 양호",
            "message": "주요 지표가 안정적입니다. 현재 포트폴리오를 유지하되 정기적으로 모니터링하세요.",
            "emoji": "🟢",
            "action": "유지",
        },
        "caution": {
            "title": "주의 구간 진입",
            "message": "일부 지표에서 경고 신호가 감지되었습니다. 신규 매수는 신중히, 비중 조절을 검토하세요.",
            "emoji": "🟡",
            "action": "주의",
        },
        "warning": {
            "title": "경계 신호 감지",
            "message": "복수 지표에서 위험 신호가 나타나고 있습니다. 방어적 자산 비중 확대 및 손절선을 재점검하세요.",
            "emoji": "🟠",
            "action": "비중축소",
        },
        "danger": {
            "title": "위험 — 출구 전략 실행",
            "message": "복합 위험 지표가 최고 단계입니다. ETF 비중 축소 또는 인버스 헤지를 적극 검토하세요.",
            "emoji": "🔴",
            "action": "출구전략",
        },
    }
    guide = action_guides.get(level, {
        "title": "지표 조회 중",
        "message": "시장 위험도 데이터를 불러오는 중입니다.",
        "emoji": "⚪",
        "action": "-",
    })

    # ── 4. 보유 ETF 중 주식 비중 계산 ──────────────────────────────────────
    total_eval = sum(h["eval_amount"] for h in holdings)
    stock_holdings = [h for h in holdings if h.get("category_asset") in ("주식", "기타") and h.get("category_region") != "현금"]
    stock_eval = sum(h["eval_amount"] for h in stock_holdings)
    stock_ratio = round(stock_eval / total_eval * 100, 1) if total_eval > 0 else 0

    return {
        "risk": risk_info,
        "guide": guide,
        "holdings_summary": {
            "total_count": len(holdings),
            "total_eval": total_eval,
            "stock_eval": stock_eval,
            "stock_ratio": stock_ratio,
        },
        "top_holdings": sorted(holdings, key=lambda x: x["eval_amount"], reverse=True)[:5],
    }


# ── 전략 시그널 캐시 (2시간 유효) ──────────────────────────────────────────────
_SIGNAL_CACHE: dict = {}
_SIGNAL_CACHE_TTL = 3600 * 2


def _compute_rsi(closes: list, period: int = 14):
    """RSI 계산. closes는 과거→최신 순."""
    if len(closes) < period + 1:
        return None
    gains, losses = [], []
    for i in range(1, period + 1):
        diff = closes[-i] - closes[-(i + 1)]
        if diff > 0:
            gains.append(diff)
        else:
            losses.append(abs(diff))
    avg_gain = sum(gains) / period if gains else 0
    avg_loss = sum(losses) / period if losses else 0
    if avg_loss == 0:
        return 100.0
    return round(100 - 100 / (1 + avg_gain / avg_loss), 1)


def _compute_signal(closes: list) -> dict:
    """MA5/MA20 크로스 + RSI 복합 신호 산출."""
    if len(closes) < 21:
        return {"signal": "unknown", "label": "데이터부족", "color": "gray",
                "ma5": None, "ma20": None, "rsi": None, "detail": ""}

    ma5  = round(sum(closes[-5:]) / 5, 0)
    ma20 = round(sum(closes[-20:]) / 20, 0)
    prev_ma5  = round(sum(closes[-6:-1]) / 5, 0)
    prev_ma20 = round(sum(closes[-21:-1]) / 20, 0)
    rsi = _compute_rsi(closes)

    golden = (prev_ma5 <= prev_ma20) and (ma5 > ma20)
    dead   = (prev_ma5 >= prev_ma20) and (ma5 < ma20)
    ma_bull = ma5 > ma20

    if golden:
        signal, label, color = "golden", "골든크로스", "green"
    elif dead:
        signal, label, color = "dead", "데드크로스", "red"
    elif rsi and rsi >= 70:
        signal, label, color = "overbought", "과매수", "yellow"
    elif rsi and rsi <= 30:
        signal, label, color = "oversold", "과매도", "purple"
    elif ma_bull:
        signal, label, color = "bull", "상승추세", "blue"
    elif not ma_bull:
        signal, label, color = "bear", "하락추세", "orange"
    else:
        signal, label, color = "neutral", "중립", "gray"

    parts = [f"MA5 {int(ma5):,} / MA20 {int(ma20):,}"]
    if rsi is not None:
        parts.append(f"RSI {rsi}")
    return {"signal": signal, "label": label, "color": color,
            "ma5": int(ma5), "ma20": int(ma20), "rsi": rsi,
            "detail": "  |  ".join(parts)}


@router.get("/holdings-signals")
async def get_holdings_signals(request: Request, db: AsyncSession = Depends(get_db)):
    """
    보유 ETF/주식 전략 시그널 조회.
    yfinance를 통해 한국 ETF 일봉 100일치를 조회 (토큰 발급 불필요).
    MA5/MA20 크로스 + RSI(14) 계산. 2시간 인메모리 캐시.
    """
    import asyncio as _aio
    import time
    import yfinance as yf

    # 보유 종목 조회
    portfolio = await get_my_portfolio(request=request, db=db)
    all_h = portfolio.get("kis_raw", {}).get("holdings", [])
    domestic = [h for h in all_h
                if h.get("code", "").isdigit() and len(h.get("code", "")) == 6]

    now_ts = time.time()
    results = []

    def _fetch_yf_closes(code: str) -> list:
        """yfinance로 종가 리스트 반환 (과거→최신 순, 최대 100일)."""
        # 대부분의 KRX ETF/주식은 .KS (유가증권시장)
        for suffix in [".KS", ".KQ"]:
            try:
                ticker = yf.Ticker(f"{code}{suffix}")
                hist = ticker.history(period="6mo")   # 약 120 거래일
                if hist is not None and len(hist) >= 21:
                    return hist["Close"].dropna().tolist()
            except Exception:
                continue
        return []

    for h in domestic:
        code, name = h.get("code", ""), h.get("name", "")

        # 캐시 히트
        c = _SIGNAL_CACHE.get(code)
        if c and (now_ts - c["ts"]) < _SIGNAL_CACHE_TTL:
            results.append({
                "code": code, "name": name,
                "eval_amount": h.get("eval_amount", 0),
                **c["signal"], "cached": True})
            continue

        # yfinance 조회 (blocking → run_in_executor)
        try:
            loop = _aio.get_event_loop()
            closes = await loop.run_in_executor(None, _fetch_yf_closes, code)
            sig = _compute_signal(closes)
        except Exception as e:
            logger.error(f"[signal-yf] {code}: {e}")
            sig = {"signal": "error", "label": "조회실패", "color": "gray",
                   "ma5": None, "ma20": None, "rsi": None, "detail": ""}

        _SIGNAL_CACHE[code] = {"signal": sig, "ts": now_ts}
        results.append({
            "code": code, "name": name,
            "eval_amount": h.get("eval_amount", 0),
            **sig, "cached": False})

    results.sort(key=lambda x: x.get("eval_amount", 0), reverse=True)
    return {"status": "success", "count": len(results), "signals": results}

