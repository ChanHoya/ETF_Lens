import requests
from bs4 import BeautifulSoup

url = "https://finance.naver.com/item/main.naver?code=453850"
res = requests.get(url, headers={'User-Agent':'Mozilla/5.0'})
soup = BeautifulSoup(res.text, 'html.parser')

holdings = []
# On naver finance, the holdings are often listed in a table with summary info
for th in soup.find_all('th', scope='col', class_='ctg'):
    if '구성종목' in th.text:
        table = th.find_parent('table')
        for tr in table.find_all('tr')[1:]:
            tds = tr.find_all('td')
            if len(tds) >= 4:
                name_elem = tds[0].find('a')
                name = name_elem.text.strip() if name_elem else tds[0].text.strip()
                # Finding the weight...
                # td texts: [name, price, change, percent_change, weight]
                try:
                    weight_text = tds[-1].text.strip().replace('%', '')
                    weight = float(weight_text)
                    if name:
                        holdings.append({'ticker': name, 'weight': weight})
                except Exception as e:
                    continue
        break
print(holdings)
