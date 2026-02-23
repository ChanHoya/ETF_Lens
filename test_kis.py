import os
import requests
import json
from dotenv import load_dotenv

load_dotenv(dotenv_path=".env") # Explicit path for backend/.env context if running from outside or just make sure cwd is right

app_key = os.environ.get("KIS_APP_KEY")
app_secret = os.environ.get("KIS_APP_SECRET")
url_base = os.environ.get("KIS_URL_BASE", "https://openapi.koreainvestment.com:9443")

def test_kis():
    print("Testing KIS Authentication...")
    headers = {"content-type": "application/json"}
    body = {
        "grant_type": "client_credentials",
        "appkey": app_key,
        "appsecret": app_secret
    }
    
    token_url = f"{url_base}/oauth2/tokenP"
    res = requests.post(token_url, headers=headers, json=body)
    
    if res.status_code == 200:
        print("Success! Access token generated.")
        token = res.json().get("access_token")
        
        print("Testing ETF PDF Endpoint [FHPST02400000] for KODEX 200 (069500)...")
        headers = {
            "content-type": "application/json; charset=utf-8",
            "authorization": f"Bearer {token}",
            "appkey": app_key,
            "appsecret": app_secret,
            "tr_id": "FHPST02400000",
            "tr_cont": "",
        }
        params = {
            "FID_COND_MRKT_DIV_CODE": "J",
            "FID_INPUT_ISCD": "069500"
        }
        
        pdf_url = f"{url_base}/uapi/domestic-stock/v1/quotations/inquire-etf-composition"
        pdf_res = requests.get(pdf_url, headers=headers, params=params)
        print(f"PDF Response Code: {pdf_res.status_code}")
        print(f"PDF Response Data: {pdf_res.text[:200]}...")

    else:
        print(f"Failed. Error: {res.text}")

if __name__ == "__main__":
    if app_key and len(app_key) > 20: 
        test_kis()
    else:
        print("Invalid APP KEY format detected.")
