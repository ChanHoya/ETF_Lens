import os
import requests
import json
from dotenv import load_dotenv

load_dotenv(dotenv_path=".env")

app_key = os.environ.get("KIS_APP_KEY")
app_secret = os.environ.get("KIS_APP_SECRET")
# The real domain is correct, the issue earlier was just invalid token message, which means body was wrong or keys are mocked
url_base = os.environ.get("KIS_URL_BASE", "https://openapi.koreainvestment.com:9443")

def test_kis():
    headers = {"content-type": "application/json"}
    body = {
        "grant_type": "client_credentials",
        "appkey": app_key,
        "appsecret": app_secret
    }
    
    token_url = f"{url_base}/oauth2/tokenP"
    res = requests.post(token_url, headers=headers, json=body)
    print("Token Auth Response:", res.status_code, res.text[:200])

if __name__ == "__main__":
    test_kis()
