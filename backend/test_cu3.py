import urllib.request
import ssl
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE
code = "069500"
url = f"https://m.stock.naver.com/api/stock/{code}/etf/cu"
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
try:
    print(urllib.request.urlopen(req, context=ctx).read().decode('utf-8')[:500])
except Exception as e:
    print("Error:", e)
