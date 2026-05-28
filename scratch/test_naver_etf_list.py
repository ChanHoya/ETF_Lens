import urllib.request
import json
import ssl

def test_etf_list():
    try:
        ctx = ssl._create_unverified_context()
        url = "https://finance.naver.com/api/sise/etfItemList.nhn"
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        res = urllib.request.urlopen(req, timeout=5, context=ctx).read()
        
        # Naver API returns content in EUC-KR or UTF-8. Let's decode
        data = json.loads(res.decode('utf-8', errors='ignore'))
        result = data.get("result", {})
        etf_list = result.get("etfItemList", [])
        
        print(f"Total ETFs found: {len(etf_list)}")
        if etf_list:
            print("\nSample ETF item keys:", list(etf_list[0].keys()))
            print("\nFirst 3 items:")
            for item in etf_list[:5]:
                print(f"Name: {item.get('itemname')}, Code: {item.get('itemcode')}, Price: {item.get('nowVal')}, NAV: {item.get('nav')}, Disparity: {item.get('disparity')}")
    except Exception as e:
        print(f"Failed to fetch ETF list: {e}")

if __name__ == "__main__":
    test_etf_list()
