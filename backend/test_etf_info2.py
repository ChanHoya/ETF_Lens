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
    
    # Extract basic info table by searching "상장일" or "펀드보수"
    target = soup.find(text=lambda x: x and '펀드보수' in x)
    if target:
        table = target.find_parent('table')
        if table:
            for tr in table.select("tr"):
                print(tr.get_text(separator=" | ", strip=True))
                
except Exception as e:
    print(f"Error: {e}")
