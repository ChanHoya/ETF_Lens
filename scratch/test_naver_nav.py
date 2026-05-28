import urllib.request
import json
import ssl

def test_naver_api(code):
    try:
        ctx = ssl._create_unverified_context()
        url = f"https://m.stock.naver.com/api/stock/{code}/basic"
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        res = urllib.request.urlopen(req, timeout=5, context=ctx).read()
        data = json.loads(res)
        print(f"\n=== Code: {code} ===")
        # Print top keys and potential NAV-related values
        for k in ["stockName", "closePrice", "nav", "navPrice", "navChange", "navChangeRate", "disparity", "disparityRate", "marketStatus"]:
            if k in data:
                print(f"{k}: {data[k]}")
            else:
                # Search case-insensitively
                found = False
                for dk in data.keys():
                    if k.lower() in dk.lower():
                        print(f"{dk} (approx match for {k}): {data[dk]}")
                        found = True
        # Print all keys to inspect
        print("All keys:", list(data.keys())[:25])
    except Exception as e:
        print(f"Failed for {code}: {e}")

if __name__ == "__main__":
    # Test with KODEX 200 (069500) and a domestic listing of a US ETF (e.g. KODEX 미국우주항공 - 488050 or TIGER 미국S&P500 - 360750)
    test_naver_api("069500")
    test_naver_api("488050")
    test_naver_api("360750")
