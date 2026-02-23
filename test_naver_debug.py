import requests
from bs4 import BeautifulSoup

url = "https://finance.naver.com/item/main.naver?code=453850"
res = requests.get(url, headers={"User-Agent": "Mozilla/5.0"})
soup = BeautifulSoup(res.text, "html.parser")

holdings = []
ths = soup.find_all("th", scope="col", class_="ctg")
for th in ths:
    print("Found TH:", th.text.strip())
    if "구성종목" in th.text.strip():
        print("MATCHED")
        table = th.find_parent("table")
        if table:
            for tr in table.find_all("tr"):
                tds = tr.find_all("td")
                if len(tds) >= 4:
                    print("TDs text:", [td.text.strip() for td in tds])
                    name_elem = tds[0].find("a")
                    name = name_elem.text.strip() if name_elem else tds[0].text.strip()
                    try:
                        weight_text = tds[-1].text.strip().replace("%", "")
                        weight = float(weight_text)
                        if name:
                            holdings.append({"ticker": name, "weight": weight})
                    except Exception as e:
                        pass
        break

print("Holdings:", holdings)
