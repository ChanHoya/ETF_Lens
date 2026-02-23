import requests
from bs4 import BeautifulSoup
import re

def get_holdings(code):
    url = f"https://finance.naver.com/item/main.naver?code={code}"
    res = requests.get(url, headers={'User-Agent':'Mozilla/5.0'})
    soup = BeautifulSoup(res.text, 'html.parser')
    
    # Extract holdings table
    # It usually has a summary table or 'CU'
    holdings = []
    
    # In Naver Finance ETF page, the holdings are often loaded via iframe or present in a table with class 'type_5'
    table = soup.select('table.type_5 tr')
    for tr in table:
        tds = tr.find_all('td')
        if len(tds) >= 3:
            name = tds[0].text.strip()
            # find weight might be in a td, naver table format: 
            # 1. name, 2. current price, 3. change, 4. percent change, 5. weighting
            if len(tds) >= 5:
                weight_str = tds[4].text.replace('%', '').strip()
                try:
                    weight = float(weight_str)
                    if name:
                        holdings.append({'ticker': name, 'weight': weight})
                except ValueError:
                    continue
    return holdings

print(get_holdings('453850'))
print(get_holdings('069500'))
