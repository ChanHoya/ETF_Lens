import urllib.request
from bs4 import BeautifulSoup
import ssl
ssl._create_default_https_context = ssl._create_unverified_context
url = "https://finance.naver.com/item/main.naver?code=453850"
req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
html_raw = urllib.request.urlopen(req).read()
soup = BeautifulSoup(html_raw.decode("utf-8", errors="ignore"), "html.parser")
for x in soup.find_all(string=lambda text: "베타" in text or "외국인" in text):
    print(x.parent)
