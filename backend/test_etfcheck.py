import requests

def fetch_etfcheck(code):
    url = f"https://api.etfcheck.co.kr/kr/v1/etfs/{code}/portfolio"
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://www.etfcheck.co.kr/',
        'Origin': 'https://www.etfcheck.co.kr',
        'Accept': 'application/json, text/plain, */*'
    }
    res = requests.get(url, headers=headers)
    print(res.status_code)
    if res.status_code == 200:
        print(res.json())

fetch_etfcheck('360750')
