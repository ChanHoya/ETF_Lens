import os, asyncio, httpx, time
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

async def test_overseas():
    kis_url_base = os.environ.get("KIS_URL_BASE")
    cano = "64896732"
    acnt_prdt_cd = "01"
    
    # We know key 2 or 3 works for this account, let's just use key 3 since we checked earlier it might work, or get fresh tokens
    active_keys = []
    async with httpx.AsyncClient() as client:
        token_url = f"{kis_url_base}/oauth2/tokenP"
        for keypair in global_keys:
            token_payload = {
                "grant_type": "client_credentials",
                "appkey": keypair["app_key"],
                "appsecret": keypair["app_secret"],
            }
            res = await client.post(token_url, json=token_payload)
            if res.status_code == 200:
                active_keys.append({
                    "app_key": keypair["app_key"],
                    "app_secret": keypair["app_secret"],
                    "access_token": res.json().get("access_token")
                })
    
    for keypair in active_keys:
        app_key = keypair["app_key"]
        app_secret = keypair["app_secret"]
        access_token = keypair["access_token"]
        
        balance_url = f"{kis_url_base}/uapi/overseas-stock/v1/trading/inquire-present-balance"
        headers = {
            "content-type": "application/json; charset=utf-8",
            "authorization": f"Bearer {access_token}",
            "appkey": app_key,
            "appsecret": app_secret,
            "tr_id": "VTTQ8271R" if "vts" in kis_url_base else "CTEQ8271R",
            "custtype": "P",
        }
        params = {
            "CANO": cano,
            "ACNT_PRDT_CD": acnt_prdt_cd,
            "WCRC_FRCR_DVSN_CD": "01", # 01: 원화, 02: 외화
            "NATN_CD": "840", # 840: 미국
            "TR_MKET_CD": "00", # 00: 전체
            "INQR_DVSN_CD": "00", # 00: 전체
        }
        
        async with httpx.AsyncClient() as client:
            res = await client.get(balance_url, headers=headers, params=params)
            data = res.json()
            print(f"Key {app_key[:10]} -> rt_cd: {data.get('rt_cd')}, msg: {data.get('msg1')}")
            if data.get("rt_cd") == "0":
                print("SUCCESS!")
                print("output1 size:", len(data.get("output1", [])))
                print("output2 dict:", data.get("output2", {}))
                break

asyncio.run(test_overseas())
