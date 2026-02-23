import urllib.request
import json
import ssl

ssl._create_default_https_context = ssl._create_unverified_context

url = "https://m.stock.naver.com/api/stock/069500/integration"
req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
res = urllib.request.urlopen(req).read().decode("utf-8")
data = json.loads(res)

print("\n--- totalInfos ---")
for t in data.get("totalInfos", []):
    print(t)

url2 = "https://m.stock.naver.com/api/stock/069500/basic"
req2 = urllib.request.Request(url2, headers={"User-Agent": "Mozilla/5.0"})
res2 = json.loads(urllib.request.urlopen(req2).read().decode("utf-8"))
print("\n--- Basic keys ---")
for k, v in res2.items():
    if not isinstance(v, (dict, list)):
        print(k, v)
