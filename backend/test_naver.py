import urllib.request
import json
url = "https://m.stock.naver.com/api/stock/069500/integration"
req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
res_str = urllib.request.urlopen(req).read().decode("utf-8")
data = json.loads(res_str)
print(json.dumps(data.get("etfKeyIndicator", {}), indent=2, ensure_ascii=False))
