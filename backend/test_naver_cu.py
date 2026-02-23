import urllib.request
import json
import ssl

ssl._create_default_https_context = ssl._create_unverified_context
try:
    url = "https://m.stock.naver.com/api/stock/069500/etf/cu"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    res = urllib.request.urlopen(req).read().decode("utf-8")
    data = json.loads(res)
    print("CU Keys:", data.keys())
    print(data.get("cuList", [])[:2])
except Exception as e:
    print(e)
