from dotenv import load_dotenv
import os, asyncio, httpx, json

load_dotenv(override=True)
kis_url_base = os.environ.get("KIS_URL_BASE", "https://openapi.koreainvestment.com:9443")

async def test_acc():
    cano = "81060777"
    acnt_prdt_cd = "01"
    
    app_key = os.environ.get("KIS_APP_KEY1").strip()
    app_secret = os.environ.get("KIS_APP_SECRET1").strip()
    
    async with httpx.AsyncClient() as client:
        token_url = f"{kis_url_base}/oauth2/tokenP"
        token_payload = {
            "grant_type": "client_credentials",
            "appkey": app_key,
            "appsecret": app_secret,
        }
        res = await client.post(token_url, json=token_payload)
        access_token = res.json().get("access_token")
        
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
        data = balance_res.json()
        print("rt_cd:", data.get("rt_cd"))
        print("msg1:", data.get("msg1"))
        print("output1 size:", len(data.get("output1", [])))
        print("output2 dict:", data.get("output2", [{}])[0])

asyncio.run(test_acc())
