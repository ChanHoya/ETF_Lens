from dotenv import load_dotenv
import os, asyncio, httpx

load_dotenv(override=True)
kis_url_base = os.environ.get("KIS_URL_BASE", "https://openapi.koreainvestment.com:9443")

async def fetch_test():
    app_key = os.environ.get("KIS_APP_KEY1")
    app_secret = os.environ.get("KIS_APP_SECRET1")
    acc_str = os.environ.get("KIS_ACC1")
    
    async with httpx.AsyncClient() as client:
        token_url = f"{kis_url_base}/oauth2/tokenP"
        token_payload = {
            "grant_type": "client_credentials",
            "appkey": app_key,
            "appsecret": app_secret,
        }
        res = await client.post(token_url, json=token_payload)
        access_token = res.json().get("access_token")
        print(f"Token: {bool(access_token)}")
        
        cano = acc_str[:8]
        acnt_prdt_cd = acc_str[8:].replace("-", "") or "01"
        balance_url = f"{kis_url_base}/uapi/domestic-stock/v1/trading/inquire-balance"
        headers = {
            "content-type": "application/json; charset=utf-8",
            "authorization": f"Bearer {access_token}",
            "appkey": app_key,
            "appsecret": app_secret,
            "tr_id": "TTTC8434R",
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
        
        balance_res = await client.get(balance_url, headers=headers, params=params)
        print(balance_res.status_code, balance_res.text[:100])

asyncio.run(fetch_test())
