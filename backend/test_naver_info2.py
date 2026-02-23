import urllib.request
from bs4 import BeautifulSoup
import ssl

ssl._create_default_https_context = ssl._create_unverified_context
def probe():
    url = f"https://finance.naver.com/item/main.naver?code=069500"
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    html = urllib.request.urlopen(req).read().decode('euc-kr', errors='ignore')
    soup = BeautifulSoup(html, 'html.parser')
    
    # ETM info panel table
    for table in soup.find_all('table'):
        text = table.text
        if '개월 수익률' in text or '펀드보수' in text or '분배금기준일' in text:
            print("--- Found Table ---")
            for tr in table.select("tr")[:15]:
                ths = [th.text.strip().replace('\n','') for th in tr.select("th")]
                tds = [td.text.strip().replace('\n', '') for td in tr.select("td")]
                print(f"TH: {ths} | TD: {tds}")
probe()
