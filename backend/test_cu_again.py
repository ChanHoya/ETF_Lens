from bs4 import BeautifulSoup
import urllib.request
import ssl

ssl._create_default_https_context = ssl._create_unverified_context
url = "https://finance.naver.com/item/main.naver?code=069500"
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
html = urllib.request.urlopen(req).read().decode('euc-kr', errors='ignore')
soup = BeautifulSoup(html, 'html.parser')
for iframe in soup.find_all('iframe'):
    print(iframe.get('id'), iframe.get('src'))
