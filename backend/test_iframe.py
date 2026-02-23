import urllib.request
from bs4 import BeautifulSoup
import ssl
import sys

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

code = "453850"
url = f"https://finance.naver.com/item/main.naver?code={code}"
req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
try:
    html = (
        urllib.request.urlopen(req, context=ctx)
        .read()
        .decode("euc-kr", errors="ignore")
    )
    soup = BeautifulSoup(html, "html.parser")

    # Extract iframe src
    cu_div = soup.select("div.box_type_m iframe")
    if cu_div:
        for iframe in cu_div:
            src = iframe.get("src")
            if "cu.naver" in src:
                print(f"Holdings iframe src: {src}")

                # Fetch inner iframe
                iframe_url = f"https://finance.naver.com{src}"
                iframe_req = urllib.request.Request(
                    iframe_url, headers={"User-Agent": "Mozilla/5.0"}
                )
                iframe_html = (
                    urllib.request.urlopen(iframe_req, context=ctx)
                    .read()
                    .decode("euc-kr", errors="ignore")
                )
                iframe_soup = BeautifulSoup(iframe_html, "html.parser")
                table = iframe_soup.select_one("table.type5")
                if table:
                    for tr in table.select("tr"):
                        cols = [td.text.strip() for td in tr.select("td")]
                        if len(cols) >= 3:
                            print(f"{cols[0]} -> {cols[2]}")

except Exception as e:
    print(f"Error: {e}")
