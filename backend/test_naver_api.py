import urllib.request
import json
import ssl

ssl._create_default_https_context = ssl._create_unverified_context
url = "https://m.stock.naver.com/api/stock/069500/integration"
req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
try:
    res = urllib.request.urlopen(req).read().decode("utf-8")
    data = json.loads(res)
    print("etfKeyIndicator:")
    print(json.dumps(data.get("etfKeyIndicator", {}), ensure_ascii=False, indent=2))
except Exception as e:
    print(e)
