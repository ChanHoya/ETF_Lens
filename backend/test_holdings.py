import urllib.request
from bs4 import BeautifulSoup
import ssl
import sys

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

code = "453850"
url = f"https://finance.naver.com/item/fund_cu.naver?code={code}"
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
try:
    html = urllib.request.urlopen(req, context=ctx).read().decode('euc-kr', errors='ignore')
    soup = BeautifulSoup(html, 'html.parser')
    
    # Extract holdings table
    table = soup.select_one("table.type5")
    if table:
        for tr in table.select("tr"):
            cols = [td.text.strip() for td in tr.select("td")]
            if len(cols) >= 3:
                name = cols[0]
                weight = cols[2]
                print(f"{name} -> {weight}")
                
except Exception as e:
    print(f"Error: {e}")
