from fastapi import APIRouter, Depends, HTTPException, Header, Request
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, List, Dict, Any
import httpx
import logging
from db.database import get_db
from core.portfolio_analyzer import analyze_portfolio

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/portfolio")
async def get_my_portfolio(
    request: Request,
    appkey: str = Header(..., description="KIS App Key"),
    appsecret: str = Header(..., description="KIS App Secret"),
    account_no: str = Header(..., description="KIS Account Number (e.g., 12345678-01)"),
    db: AsyncSession = Depends(get_db),
):
    """
    Fetch user portfolio from KIS API and calculate factor balances.
    """
    if not appkey or not appsecret or not account_no:
        raise HTTPException(status_code=400, detail="Missing KIS credentials")

    try:
        # 1. Get KIS Access Token
        kis_base = "https://openapi.koreainvestment.com:9443"
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

            # 2. Fetch Account Balance (TTTC8434R)
            # Parse and clean account_no
            account_no_clean = "".join(filter(str.isdigit, account_no))
            if len(account_no_clean) >= 10:
                cano = account_no_clean[:8]
                acnt_prdt_cd = account_no_clean[8:10]
            elif len(account_no_clean) >= 8:
                cano = account_no_clean[:8]
                acnt_prdt_cd = "01"  # Default PRDT_CD
            else:
                cano = account_no_clean.ljust(8, "0")
                acnt_prdt_cd = "01"

            balance_url = f"{kis_base}/uapi/domestic-stock/v1/trading/inquire-balance"
            headers = {
                "content-type": "application/json",
                "authorization": f"Bearer {token}",
                "appkey": appkey,
                "appsecret": appsecret,
                "tr_id": "VTTC8434R"
                if "mock" in kis_base
                else "TTTC8434R",  # Mock vs real, need to handle TR ID carefully
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

            balance_res = await client.get(balance_url, headers=headers, params=params)

            if balance_res.status_code != 200:
                logger.error(f"KIS Balance Error: {balance_res.text}")
                # Sometimes KIS requires different TR_ID for virtual accounts, try VTTC8434R
                headers["tr_id"] = "VTTC8434R"
                balance_res = await client.get(
                    balance_url, headers=headers, params=params
                )
                if balance_res.status_code != 200:
                    raise HTTPException(
                        status_code=400,
                        detail="Failed to fetch KIS balance. Check account number.",
                    )

            balance_data = balance_res.json()

            if balance_data.get("rt_cd") != "0":
                raise HTTPException(
                    status_code=400, detail=balance_data.get("msg1", "KIS Error")
                )

            # Parse KIS Output
            output1 = balance_data.get("output1", [])  # Stock list
            output2 = balance_data.get("output2", [{}])[0]  # Account summary

            # Format raw holdings
            holdings = []
            for item in output1:
                holdings.append(
                    {
                        "code": item.get("pdno"),  # Product No (Ticker)
                        "name": item.get("prdt_name"),
                        "qty": int(item.get("hldg_qty", 0)),
                        "avg_price": float(item.get("pchs_avg_pric", 0)),
                        "current_price": float(item.get("prpr", 0)),
                        "eval_amount": float(
                            item.get("evlu_amt", 0)
                        ),  # Total evaluation amount
                        "profit_loss": float(item.get("evlu_pfls_amt", 0)),
                        "return_rate": float(item.get("evlu_pfls_rt", 0)),
                    }
                )

            summary = {
                "total_eval_amount": float(output2.get("tot_evlu_amt", 0)),
                "total_profit_loss": float(output2.get("evlu_pfls_smtl_amt", 0)),
                "cash_balance": float(output2.get("dnca_tot_amt", 0)),
                "total_asset": float(output2.get("tot_asst_amt", 0)),
            }

            # Enrich data with etf_master data
            analyzed_data = await analyze_portfolio(holdings, db)

            return {
                "status": "success",
                "kis_raw": {"holdings": holdings, "summary": summary},
                "analyzed": analyzed_data,
            }

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Portfolio fetch error")
        raise HTTPException(status_code=500, detail=str(e))
