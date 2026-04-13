import requests

req = {
    "holdings": [
        {"code": "005930", "amount": 1000000, "name": "삼성전자", "category": "한국"},
        {"code": "379800", "amount": 500000, "name": "KODEX 미국S&P500", "category": "S&P 500"}
    ]
}

res = requests.post("http://localhost:8000/api/v1/my/backtest/run", json=req)
print(res.status_code)
try:
    data = res.json()
    print("Keys in results['1Y']:")
    print(list(data['results']['1Y'].keys()))
    print("Keys in chart_data['1Y'][0]:")
    print(list(data['chart_data']['1Y'][0].keys()))
except Exception as e:
    print(res.text[:500])
