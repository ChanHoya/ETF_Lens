import yfinance as yf
from pykrx import stock
from pykrx import bond
from datetime import datetime, timedelta
import pandas as pd
import requests


def test():
    # 1. Dollar Index & KRW
    print("Testing yfinance...")
    end_date = datetime.now()
    start_date = end_date - timedelta(days=400)

    dx = yf.download(
        "DX-Y.NYB",
        start=start_date.strftime("%Y-%m-%d"),
        end=end_date.strftime("%Y-%m-%d"),
        progress=False,
    )
    krw = yf.download(
        "KRW=X",
        start=start_date.strftime("%Y-%m-%d"),
        end=end_date.strftime("%Y-%m-%d"),
        progress=False,
    )

    print(f"Dollar Index records: {len(dx)}")
    print(f"KRW records: {len(krw)}")

    # 2. Forward P/E (Let's use trailing P/E from pykrx for KOSPI 0001, actually pykrx has `stock.get_index_fundamental`)
    print("\nTesting pykrx for KOSPI P/E...")
    try:
        # get_index_fundamental allows getting PER/PBR etc for an index
        # Let's get the KOSPI (1001) fundamental for the last 1 year, maybe monthly
        # Since getting daily for 1 year might be slow, let's just test one day
        today = datetime.now().strftime("%Y%m%d")
        fund = stock.get_index_fundamental(today, today, "1001")
        print("KOSPI Fundamental:")
        print(fund)
    except Exception as e:
        print(f"Error pykrx index fundamental: {e}")

    print("\nTesting pykrx for KOSPI P/E by date...")
    try:
        df = stock.get_index_fundamental(
            start_date.strftime("%Y%m%d"), end_date.strftime("%Y%m%d"), "1001"
        )
        print(df.head())
        print(df.tail())
    except Exception as e:
        print(f"Error pykrx historical fundamental: {e}")

    # 3. FRED for CLI
    print("\nTesting FRED for CLI...")
    try:
        import pandas_datareader.data as web

        # Let's see if we can use pandas_datareader to fetch FRED without API key
        cli = web.DataReader("KORLORSGPNOSTSAM", "fred", start_date, end_date)
        print("CLI from pdr:")
        print(cli.tail())
    except Exception as e:
        print(f"Error pandas_datareader FRED: {e}")
        print("Trying simple scrape...")
        url = "https://fred.stlouisfed.org/graph/api/series/?obs=true&sid=KORLORSGPNOSTSAM"
        res = requests.get(url, headers={"User-Agent": "Mozilla/5.0"})
        if res.status_code == 200:
            print(res.json().get("seriess", [{}])[0].get("obs", [])[-5:])
        else:
            print("Failed to scrape", res.status_code)


if __name__ == "__main__":
    test()
