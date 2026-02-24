import os
import requests
from dotenv import load_dotenv

load_dotenv()
app_key = os.environ.get("KIS_APP_KEY")
app_secret = os.environ.get("KIS_APP_SECRET")
base = "https://openapi.koreainvestment.com:9443"

# 1. Token
res = requests.post(
    f"{base}/oauth2/tokenP",
    headers={"content-type": "application/json"},
    json={
        "grant_type": "client_credentials",
        "appkey": app_key,
        "appsecret": app_secret,
    },
)
token = res.json().get("access_token")
print("Auth Response:", res.json())

# 2. Quote
if token:
    headers = {
        "content-type": "application/json",
        "authorization": f"Bearer {token}",
        "appkey": app_key,
        "appsecret": app_secret,
        "tr_id": "FHKST01010100",
    }
    params = {"FID_COND_MRKT_DIV_CODE": "J", "FID_INPUT_ISCD": "069500"}
    res = requests.get(
        f"{base}/uapi/domestic-stock/v1/quotations/inquire-price",
        headers=headers,
        params=params,
    )
    print("Quote Response:", res.json())
