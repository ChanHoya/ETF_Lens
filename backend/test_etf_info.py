import urllib.request
from bs4 import BeautifulSoup
import ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

url = "https://finance.naver.com/item/main.naver?code=453850"
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
try:
    html = urllib.request.urlopen(req, context=ctx).read().decode('euc-kr', errors='ignore')
    soup = BeautifulSoup(html, 'html.parser')
    
    # Extract basic info table
    info_table = soup.select_one("table.l_info")
    if info_table:
        print("Basic Info:")
        for tr in info_table.select("tr"):
            th = tr.select_one("th")
            td = tr.select_one("td")
            if th and td:
                print(f"{th.text.strip():<15}: {td.text.strip()}")
                
except Exception as e:
    print(f"Error: {e}")
