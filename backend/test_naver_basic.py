import urllib.request
import json
import ssl

ssl._create_default_https_context = ssl._create_unverified_context
def check(code):
    url = f"https://m.stock.naver.com/api/stock/{code}/basic"
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    res = urllib.request.urlopen(req).read().decode('utf-8')
    data = json.loads(res)
    print("establishmentDate" in data, data.get('establishmentDate'))
check("069500")
