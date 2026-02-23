import urllib.request
from bs4 import BeautifulSoup
import ssl
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

code = "069500"
url = f"https://finance.naver.com/item/main.naver?code={code}"
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
html = urllib.request.urlopen(req, context=ctx).read().decode('euc-kr', errors='ignore')
soup = BeautifulSoup(html, 'html.parser')

print("=== Tables containing '구성종목' ===")
for table in soup.find_all('table'):
    if '구성종목' in table.text or '비중' in table.text:
        print("Found Table!")
        for tr in table.select("tr")[:10]:
            print(tr.get_text(separator=" | ", strip=True))
        print("-" * 50)
