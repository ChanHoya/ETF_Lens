import os
import requests
import json
from dotenv import load_dotenv

load_dotenv(dotenv_path=".env")

app_key = os.environ.get("KIS_APP_KEY")
app_secret = os.environ.get("KIS_APP_SECRET")
# Often API URL for retail uses general domain
# Production: https://openapi.koreainvestment.com:9443
# Let's hit the general open path. Note that some keys require the explicit 'approval_key' endpoint for websockets but HTTP uses oauth2.
url = "https://openapi.koreainvestment.com:9443"

def test_kis():
    headers = {"content-type": "application/json"}
    body = {
        "grant_type": "client_credentials",
        "appkey": app_key,
        "appsecret": app_secret
    }
    
    token_url = f"{url}/oauth2/tokenP"
    res = requests.post(token_url, headers=headers, json=body)
    print("Token Auth Response:", res.status_code)

    if res.status_code != 200:
        print("Failure to auth:", res.text)
        # Note: If rate limited, we can't test it now. We would just rely on our implementation in harvester.
        return

    # test connection with basic stock price TR
    token = res.json().get("access_token")
    
    headers = {
        "content-type": "application/json; charset=utf-8",
        "authorization": f"Bearer {token}",
        "appkey": app_key,
        "appsecret": app_secret,
        "tr_id": "FHKST01010100", # stock price
        "tr_cont": "",
        "custtype": "P"
    }

    params = {
        "FID_COND_MRKT_DIV_CODE": "J",
        "FID_INPUT_ISCD": "069500" # KODEX 200
    }
    
    comp_url = f"{url}/uapi/domestic-stock/v1/quotations/inquire-price"
    comp_res = requests.get(comp_url, headers=headers, params=params)
    print("Stock Price Status:", comp_res.status_code)
    try:
        data = comp_res.json()
        print("Stock Msg:", data.get('msg1'))
    except Exception as e:
        print("Error parsing json:", comp_res.text[:300])

if __name__ == "__main__":
    test_kis()
