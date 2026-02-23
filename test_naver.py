import requests
from bs4 import BeautifulSoup
import re

url = "https://finance.naver.com/item/main.naver?code=453850"
res = requests.get(url, headers={'User-Agent':'Mozilla/5.0'})
soup = BeautifulSoup(res.text, 'html.parser')

th = soup.find('th', string=re.compile("구성종목"))
if th:
    table = th.find_parent('table')
    for tr in table.find_all('tr')[1:]: # skip header
        tds = tr.find_all('td')
        if len(tds) >= 4:
            name_a = tds[0].find('a')
            name = name_a.text.strip() if name_a else tds[0].text.strip()
            # usually weight is in the last column or second to last
            # td texts: [[TIGER 미국테크TOP10+10..], [7,830], [21], [0.27%], [0.00%]]
            # The exact column layout logic varies.
            texts = [td.text.strip() for td in tds]
            print(texts)
