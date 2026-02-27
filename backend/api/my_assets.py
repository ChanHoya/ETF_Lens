from fastapi import APIRouter, Depends, HTTPException, Header, Request
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, List, Dict, Any
import httpx
import os
import logging
from db.database import get_db
from core.portfolio_analyzer import analyze_portfolio

logger = logging.getLogger(__name__)

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
        # 2. Define a helper function to fetch a single account using a brute-force key strategy
        async def fetch_single_account(acc_str: str):
            import json

            account_no_clean = "".join(filter(str.isdigit, acc_str))
            if not account_no_clean:
                return None
            cano = account_no_clean[:8]
            acnt_prdt_cd = account_no_clean[8:] or "01"
            formatted_account = f"{cano}-{acnt_prdt_cd}"

            for keypair in global_keys:
                app_key = keypair["app_key"]
                app_secret = keypair["app_secret"]

                access_token = None
                async with httpx.AsyncClient() as client:
                    token_url = f"{kis_url_base}/oauth2/tokenP"
                    token_payload = {
                        "grant_type": "client_credentials",
                        "appkey": app_key,
                        "appsecret": app_secret,
                    }
                    try:
                        token_res = await client.post(token_url, json=token_payload)
                        if token_res.status_code == 200:
                            access_token = token_res.json().get("access_token")
                        else:
                            # Usually EGW00133 rate limit or bad key, skip to next key
                            logger.debug(
                                f"KIS Token Error for {app_key} (acc {acc_str}): {token_res.text}"
                            )
                            continue
                    except Exception as e:
                        logger.debug(
                            f"Exception fetching KIS token for {app_key} (acc {acc_str}): {e}"
                        )
                        continue

                if not access_token:
                    continue

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

                    logger.info(
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

                    return {
                        "account_no": formatted_account,
                        "account_name": "연동계좌",
                        "summary": {
                            "total_eval_amount": float(output2.get("tot_evlu_amt", 0)),
                            "total_profit_loss": float(
                                output2.get("evlu_pfls_smtl_amt", 0)
                            ),
                            "cash_balance": float(output2.get("dnca_tot_amt", 0)),
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
