import urllib.request
from bs4 import BeautifulSoup
import ssl
import json

ssl._create_default_https_context = ssl._create_unverified_context


def fetch_etf_info(code):
    url = f"https://finance.naver.com/item/main.naver?code={code}"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    html = urllib.request.urlopen(req).read().decode("euc-kr", errors="ignore")
    soup = BeautifulSoup(html, "html.parser")

    data = {}

    # 1. Right side info
    for tr in soup.select("table.l_info tr, table.r_info tr"):
        ths = tr.select("th")
        tds = tr.select("td")
        if ths and tds:
            k = ths[0].text.strip()
            v = (
                tds[0]
                .text.strip()
                .replace("\n", "")
                .replace("\t", "")
                .replace("\r", "")
            )
            # Clean up unnecessary parts
            v = " ".join(v.split())
            if k == "펀드보수":
                # Remove little help icon if text matches
                v = v.replace("?", "").strip()
            if k in ["유형", "상장일", "펀드보수", "자산운용사"]:
                data[k] = v

    # 1.5 Right side return rates
    for tr in soup.select("table.l_info tr"):
        tds = tr.select("td")
        if len(tds) > 0 and "개월 수익률" in tr.text:
            # They might be on different rows
            pass

    # Look globally for 1개월 수익률, 3개월 수익률, etc
    for th in soup.select("th"):
        k = th.text.strip()
        if k in ["1개월 수익률", "3개월 수익률", "6개월 수익률", "1년 수익률", "1Y"]:
            v_td = th.find_next_sibling("td")
            if v_td:
                # clean up + and % and spaces
                v = v_td.text.strip()
                data[k] = v

    # 2. Main content '종합정보' (summary)
    summary_table = soup.select_one("table.summary_info")
    if summary_table:
        pass  # Handle if needed

    # Let's also look at "상품개요" which is below
    for th in soup.select("table th"):
        k = th.text.strip()
        if k == "최초설정일/상장일":
            dt = th.find_next_sibling("td").text.strip()
            data["상장일(Detail)"] = dt
        elif k == "총보수" and "펀드보수" not in data:
            data["펀드보수"] = th.find_next_sibling("td").text.strip()

    # Earning Rate from stock status bar
    try:
        data["1M 수익률"] = data.get("1개월 수익률", "N/A")
        data["3M 수익률"] = data.get("3개월 수익률", "N/A")
        data["6M 수익률"] = data.get("6개월 수익률", "N/A")
        data["1Y 수익률"] = data.get("1년 수익률", "N/A")
    except:
        pass

    return data


if __name__ == "__main__":
    print(json.dumps(fetch_etf_info("069500"), ensure_ascii=False, indent=2))
    print(json.dumps(fetch_etf_info("453850"), ensure_ascii=False, indent=2))
