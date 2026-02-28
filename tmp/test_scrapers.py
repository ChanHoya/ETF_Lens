import sys
import re
import json
import requests
from datetime import datetime
from pykrx import stock


def get_fred_cli():
    print("Fetching FRED CLI...")
    url = "https://fred.stlouisfed.org/series/KORLORSGPNOSTSAM"
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120.0.0.0 Safari/537.36"
    }
    res = requests.get(url, headers=headers)
    if res.status_code == 200:
        # Search for the embedded JSON data
        match = re.search(
            r'data:\s*(\{.*?"observations"\s*:.*?\})\s*,', res.text, re.DOTALL
        )
        if match:
            try:
                data = json.loads(match.group(1))
                obs = data.get("observations", [])
                print(f"Got {len(obs)} observations.")
                if obs:
                    print(obs[-5:])
            except Exception as e:
                print(f"Error parsing JSON: {e}")
        else:
            print("Could not find data in FRED HTML")
    else:
        print(f"Failed to fetch FRED page: {res.status_code}")


def get_kospi_pe():
    print("\nFetching KOSPI P/E...")
    try:
        # Ticker 1001 is KOSPI, let's check current date
        # get_index_fundamental(date) returns fundamental for all indices on that date
        today = datetime.now().strftime("%Y%m%d")
        # Try finding the recent valid market date if today is weekend
        for i in range(5):
            date_str = (datetime.now() - datetime.timedelta(days=i)).strftime("%Y%m%d")
            try:
                df = stock.get_index_fundamental(date_str)
                if not df.empty and "1001" in df.index:
                    print(f"Data for {date_str}:")
                    print(df.loc["1001"])
                    break
            except Exception:
                pass
    except Exception as e:
        print(f"Error KRX: {e}")


if __name__ == "__main__":
    import datetime as dt_module

    datetime.timedelta = dt_module.timedelta
    get_fred_cli()
    get_kospi_pe()
