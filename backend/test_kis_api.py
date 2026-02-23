import os
import requests
import json
from dotenv import load_dotenv
load_dotenv()

app_key = os.environ.get("KIS_APP_KEY")
app_secret = os.environ.get("KIS_APP_SECRET")
base = "https://openapi.koreainvestment.com:9443"

# 1. Get Access Token
h = {"content-type": "application/json"}
body = {
    "grant_type": "client_credentials",
    "appkey": app_key,
    "appsecret": app_secret
}
res = requests.post(f"{base}/oauth2/tokenP", headers=h, json=body)
token = res.json().get("access_token")
print("Token:", token[:10] if token else "FAIL")

if token:
    # 2. Fetch ETF PDF
    url = f"{base}/uapi/domestic-stock/v1/quotations/inquire-etf-price"
    headers = {
        "content-type": "application/json",
        "authorization": f"Bearer {token}",
        "appkey": app_key,
        "appsecret": app_secret,
        "tr_id": "FHKST02300000", # Need to guess TR id or search documentation
        "custtype": "P"
    }
    # FHKST02300000 -> ETF/ETN 상품기본정보
    # ETF PDF 종목코드 
    
