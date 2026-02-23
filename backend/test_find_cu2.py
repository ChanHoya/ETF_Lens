import urllib.request
code = "069500"
url = f"https://finance.naver.com/item/main.naver?code={code}"
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
html = urllib.request.urlopen(req).read().decode('euc-kr', errors='ignore')
with open('main_naver.html', 'w') as f:
    f.write(html)
