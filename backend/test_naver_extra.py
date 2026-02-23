import urllib.request
from bs4 import BeautifulSoup
import ssl

ssl._create_default_https_context = ssl._create_unverified_context
url = "https://finance.naver.com/item/main.naver?code=069500"
req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
html = urllib.request.urlopen(req).read().decode("euc-kr", errors="ignore")
soup = BeautifulSoup(html, "html.parser")

# In naver finance ETF, there is a summary table on the left
for tr in soup.find_all("tr"):
    text = tr.get_text(strip=True)
    if (
        "상장주식수" in text
        or "20일평균" in text
        or "시가총액" in text
        or "거래량/거래대금" in text
    ):
        ths = [t.text.strip() for t in tr.find_all("th")]
        tds = [t.text.strip() for t in tr.find_all("td")]
        print(ths, tds)

    if "52주 최고" in text:
        ths = [t.text.strip() for t in tr.find_all("th")]
        tds = [t.text.strip() for t in tr.find_all("td")]
        print(ths, tds)
