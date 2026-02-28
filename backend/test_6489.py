import json, asyncio, httpx, os
from dotenv import load_dotenv

load_dotenv(override=True)
global_keys = []
for key, value in os.environ.items():
    if key.startswith("KIS_APP_KEY") and value:
        suffix = key.replace("KIS_APP_KEY", "")
        app_secret = os.environ.get(f"KIS_APP_SECRET{suffix}")
        if app_secret:
            global_keys.append({
                "app_key": value.strip(),
                "app_secret": app_secret.strip()
            })

async def test():
    active_keys = []
    kis_url_base = os.environ.get("KIS_URL_BASE")
    async with httpx.AsyncClient() as client:
        token_url = f"{kis_url_base}/oauth2/tokenP"
        for keypair in global_keys:
            app_key = keypair["app_key"]
            app_secret = keypair["app_secret"]
            token_payload = {
                "grant_type": "client_credentials",
                "appkey": app_key,
                "appsecret": app_secret,
            }
            res = await client.post(token_url, json=token_payload)
            if res.status_code == 200:
                print(f"Key {app_key[:10]} token success")
                active_keys.append({
                    "app_key": app_key,
                    "app_secret": app_secret,
                    "access_token": res.json().get("access_token")
                })
            else:
                print(f"Key {app_key[:10]} token fail: {res.text}")

    acc_str = "64896732-01"
    cano = "64896732"
    acnt_prdt_cd = "01"
    for keypair in active_keys:
        app_key = keypair["app_key"]
        app_secret = keypair["app_secret"]
        access_token = keypair["access_token"]
        print(f"\n--- Testing 64896732-01 with Key {app_key[:10]} ---")
        
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
        async with httpx.AsyncClient() as client:
            res = await client.get(balance_url, headers=headers, params=params)
            print("TTTC8434R:", res.status_code, res.text[:100])
            if res.status_code != 200:
                headers["tr_id"] = "VTTC8434R"
                res2 = await client.get(balance_url, headers=headers, params=params)
                print("VTTC8434R:", res2.status_code, res2.text[:100])

asyncio.run(test())
