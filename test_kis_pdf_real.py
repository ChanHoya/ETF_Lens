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
    token = res.json().get("access_token")
    
    headers = {
        "content-type": "application/json; charset=utf-8",
        "authorization": f"Bearer {token}",
        "appkey": app_key,
        "appsecret": app_secret,
        "tr_id": "FHPST02400000", # ETF PDF TR Code
        "tr_cont": "",
        "custtype": "P"
    }

    params = {
        "FID_COND_MRKT_DIV_CODE": "J",
        "FID_INPUT_ISCD": "453850" # US Tech 10
    }
    
    comp_url = f"{url_base}/uapi/domestic-stock/v1/quotations/inquire-etf-composition"
    comp_res = requests.get(comp_url, headers=headers, params=params)
    print("PDF Fetch Status:", comp_res.status_code)
    try:
        data = comp_res.json()
        print("Msg:", data.get('msg1'))
        if data.get('output1'):
            print(f"Num items: {len(data.get('output1'))}")
            # Print sample formatting for a row
            row = data.get('output1')[0]
            print("Rowkeys:", list(row.keys()))
            print("Row[0]:", row.get('stck_prpr'), row.get('hts_kor_isnm'), row.get('pdf_prna'))
    except Exception as e:
        print("Error parsing json:", comp_res.text[:300])

if __name__ == "__main__":
    test_kis()
