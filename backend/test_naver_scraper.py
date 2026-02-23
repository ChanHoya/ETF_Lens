import urllib.request
from bs4 import BeautifulSoup
import re
import ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

url = "https://finance.naver.com/item/main.naver?code=069500"
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
html = urllib.request.urlopen(req, context=ctx).read().decode('euc-kr')
soup = BeautifulSoup(html, 'html.parser')

print("=== ETF Info ===")
info_table = soup.select_one("table.l_info")
if info_table:
    for tr in info_table.select("tr"):
        print(tr.get_text(strip=True, separator=" | "))

print("=== CU (Holdings) ===")
cu_div = soup.select("div.box_type_m iframe")
if cu_div:
    for iframe in cu_div:
        src = iframe.get('src')
        if 'cu.naver' in src:
            print(f"Holdings iframe src: {src}")
