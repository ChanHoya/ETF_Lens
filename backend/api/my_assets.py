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

    appkey = os.environ.get("KIS_APP_KEY")
    appsecret = os.environ.get("KIS_APP_SECRET")
    kis_base = os.environ.get(
        "KIS_URL_BASE", "https://openapi.koreainvestment.com:9443"
    )

    if appkey:
        appkey = appkey.strip('"').strip("'")
    if appsecret:
        appsecret = appsecret.strip('"').strip("'")

    raw_accounts = []
    for key, value in os.environ.items():
        if key.startswith("KIS_ACC") and value.strip():
            raw_accounts.append(value.strip())

    if not appkey or not appsecret or not raw_accounts:
        raise HTTPException(
            status_code=400,
            detail=f"Missing variables. key:{bool(appkey)} sec:{bool(appsecret)} acc_count:{len(raw_accounts)}",
        )

    try:
        # 1. Get KIS Access Token
        token_url = f"{kis_base}/oauth2/tokenP"
        token_body = {
            "grant_type": "client_credentials",
            "appkey": appkey,
            "appsecret": appsecret,
        }

        async with httpx.AsyncClient() as client:
            token_res = await client.post(token_url, json=token_body)
            if token_res.status_code != 200:
                logger.error(f"KIS Token Error: {token_res.text}")
                raise HTTPException(status_code=401, detail="Invalid KIS credentials")

            token = token_res.json().get("access_token")

            # 2. Iterate dynamically over raw_accounts (already collected)

            async def fetch_single_account(acc_str):
                account_no_clean = "".join(filter(str.isdigit, acc_str))
                if not account_no_clean:
                    return None

                if len(account_no_clean) >= 10:
                    cano = account_no_clean[:8]
                    acnt_prdt_cd = account_no_clean[8:10]
                elif len(account_no_clean) >= 8:
                    cano = account_no_clean[:8]
                    acnt_prdt_cd = "01"  # Default PRDT_CD
                else:
                    cano = account_no_clean.ljust(8, "0")
                    acnt_prdt_cd = "01"

                formatted_account = f"{cano}-{acnt_prdt_cd}"

                balance_url = (
                    f"{kis_base}/uapi/domestic-stock/v1/trading/inquire-balance"
                )
                headers = {
                    "content-type": "application/json",
                    "authorization": f"Bearer {token}",
                    "appkey": appkey,
                    "appsecret": appsecret,
                    "tr_id": "VTTC8434R" if "vts" in kis_base else "TTTC8434R",
                    "custtype": "P",
                }
                params = {
                    "CANO": cano,
                    "ACNT_PRDT_CD": acnt_prdt_cd,
                    "AFHR_FLPR_YN": "N",
                    "OFL_YN": "",
                    "INQR_DVSN": "02",  # 01: Loan, 02: All
                    "UNPR_DVSN": "01",  # 01: Average price
                    "FUND_STTL_ICLD_YN": "N",
                    "FNCG_AMT_AUTO_RDPT_YN": "N",
                    "PRCS_DVSN": "00",  # 00: Previous day, 01: Current day
                    "CTX_AREA_FK100": "",
                    "CTX_AREA_NK100": "",
                }

                try:
                    balance_res = await client.get(
                        balance_url, headers=headers, params=params
                    )
                    if balance_res.status_code != 200:
                        print(f"[{acc_str}] KIS TR Retry after TR_ID VTTC8434R...")
                        headers["tr_id"] = "VTTC8434R"
                        balance_res = await client.get(
                            balance_url, headers=headers, params=params
                        )
                        if balance_res.status_code != 200:
                            logger.error(
                                f"KIS Balance Error for {acc_str}: {balance_res.text}"
                            )
                            print(
                                f"[{acc_str}] FINAL KIS HTTP ERROR: {balance_res.status_code} {balance_res.text}"
                            )
                            return None

                    balance_data = balance_res.json()

                    if balance_data.get("rt_cd") != "0":
                        logger.error(
                            f"KIS Error for {acc_str}: {balance_data.get('msg1')}"
                        )
                        print(
                            f"[{acc_str}] KIS LOGIC ERROR [rt_cd!=0]: {balance_data.get('msg_cd')} {balance_data.get('msg1')}"
                        )
                        return None

                    output1 = balance_data.get("output1", [])
                    output2 = balance_data.get("output2", [{}])[0]

                    total_asset = float(output2.get("tot_asst_amt", 0))

                    print(f"[{acc_str}] SUCCESS! tot_asst_amt: {total_asset}")
                    if total_asset < 10000:
                        print(f"[{acc_str}] SKIPPED: total_asset is under 10000")
                        return None  # Filter out accounts with less than 10k KRW

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
                        "account_name": "연동계좌",  # Placeholder as KIS api TTTC8434R doesn't give account names
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
                    logger.error(f"Exception fetching {acc_str}: {e}")
                    return None

            # 3. Fetch all accounts concurrently
            tasks = [fetch_single_account(acc) for acc in raw_accounts]
            import asyncio

            results = await asyncio.gather(*tasks)

            # 4. Aggregate
            valid_results = [r for r in results if r is not None]

            if not valid_results:
                raise HTTPException(
                    status_code=400,
                    detail="No active accounts found with balance >= 10,000 KRW.",
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
