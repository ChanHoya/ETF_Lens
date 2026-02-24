import requests
import re
import json

def fetch_naver_holdings_json(code):
    url = f"https://finance.naver.com/item/main.naver?code={code}"
    res = requests.get(url, headers={'User-Agent': 'Mozilla/5.0'})
    match = re.search(r"var\s+CU_data\s*=\s*(\{.*?\});", res.text, re.DOTALL)
    if match:
        data = json.loads(match.group(1))
        print("Found items:", len(data.get('list', [])))
        for item in data.get('list', [])[:5]:
            print(item)
    else:
        print("CU_data not found in HTML code")

fetch_naver_holdings_json('360750')
fetch_naver_holdings_json('069500')
