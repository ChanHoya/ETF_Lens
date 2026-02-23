import urllib.request
import json
import ssl

ssl._create_default_https_context = ssl._create_unverified_context

def probe():
    url = f"https://m.stock.naver.com/api/stock/069500/basic"
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    html = urllib.request.urlopen(req).read().decode('utf-8')
    data = json.loads(html)
    for k, v in data.items():
        if isinstance(v, dict): print(f"{k}: DICT")
        elif isinstance(v, list): print(f"{k}: LIST")
        else: print(f"{k}: {v}")
probe()
