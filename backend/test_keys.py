from dotenv import load_dotenv
import os

load_dotenv(override=True)
for k, v in os.environ.items():
    if k.startswith("KIS_ACC") or k.startswith("KIS_APP_KEY"):
        print(f"{k}: {bool(v)}")

import asyncio
import httpx

kis_url_base = os.environ.get("KIS_URL_BASE", "https://openapi.koreainvestment.com:9443")

async def test_keys():
    for acc_idx in range(1, 4):
        app_key = os.environ.get(f"KIS_APP_KEY{acc_idx}")
        app_secret = os.environ.get(f"KIS_APP_SECRET{acc_idx}")
        if not app_key:
            continue
        print(f"Testing Key {acc_idx}...")
        async with httpx.AsyncClient() as client:
            token_url = f"{kis_url_base}/oauth2/tokenP"
            token_payload = {
                "grant_type": "client_credentials",
                "appkey": app_key,
                "appsecret": app_secret,
            }
            res = await client.post(token_url, json=token_payload)
            if res.status_code == 200:
                print(f"Key {acc_idx} token: OK")
            else:
                print(f"Key {acc_idx} Error: {res.text}")

asyncio.run(test_keys())
