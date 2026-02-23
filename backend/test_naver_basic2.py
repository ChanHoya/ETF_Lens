import urllib.request
import json
import ssl

ssl._create_default_https_context = ssl._create_unverified_context
url = "https://m.stock.naver.com/api/stock/069500/integration"
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
res = urllib.request.urlopen(req).read().decode('utf-8')
data = json.loads(res)
import re
print([k for k in str(data).split() if 'date' in k.lower() or '상장' in k or 'est' in k.lower()])
