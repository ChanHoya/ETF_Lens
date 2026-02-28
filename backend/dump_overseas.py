import os, asyncio, httpx, json
from dotenv import load_dotenv

load_dotenv(override=True)
global_keys = []
for key, value in os.environ.items():
    if key.startswith("KIS_APP_KEY") and value:
        suffix = key.replace("KIS_APP_KEY", "")
        global_keys.append({"app_key": value.strip(), "app_secret": os.environ.get(f"KIS_APP_SECRET{suffix}").strip()})

async def dump():
    kis_url_base = os.environ.get("KIS_URL_BASE")
    for keypair in global_keys:
        token_payload = {"grant_type": "client_credentials", "appkey": keypair["app_key"], "appsecret": keypair["app_secret"]}
        async with httpx.AsyncClient() as client:
            res = await client.post(f"{kis_url_base}/oauth2/tokenP", json=token_payload)
            if res.status_code == 200:
                access_token = res.json().get("access_token")
                print("Got token for key")
                ovrs_balance_url = f"{kis_url_base}/uapi/overseas-stock/v1/trading/inquire-present-balance"
                headers = {"content-type": "application/json; charset=utf-8", "authorization": f"Bearer {access_token}", "appkey": keypair["app_key"], "appsecret": keypair["app_secret"], "tr_id": "CTRP6504R", "custtype": "P"}
                params = {"CANO": "64896732", "ACNT_PRDT_CD": "01", "WCRC_FRCR_DVSN_CD": "01", "NATN_CD": "840", "TR_MKET_CD": "00", "INQR_DVSN_CD": "00"}
                res2 = await client.get(ovrs_balance_url, headers=headers, params=params)
                if res2.json().get("rt_cd") == "0":
                    with open("dump_64896732.json", "w") as f:
                        json.dump(res2.json(), f, indent=2)
                    print("Dumped to dump_64896732.json")
                    break

asyncio.run(dump())
