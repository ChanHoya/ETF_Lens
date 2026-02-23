import urllib.request
import ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

code = "069500"
url = f"https://finance.naver.com/item/main.naver?code={code}"
req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
html = urllib.request.urlopen(req, context=ctx).read().decode("euc-kr", errors="ignore")
for line in html.split("\n"):
    if "iframe" in line.lower() or "cu.naver" in line.lower():
        print(line.strip()[:200])
