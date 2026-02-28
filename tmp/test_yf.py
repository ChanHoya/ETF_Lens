import sys
import yfinance as yf
from datetime import datetime, timedelta


def main():
    try:
        print("Starting YFinance Test...")
        end_date = datetime.now()
        start_date = end_date - timedelta(days=400)

        dx = yf.download(
            "DX-Y.NYB",
            start=start_date.strftime("%Y-%m-%d"),
            end=end_date.strftime("%Y-%m-%d"),
            progress=False,
        )
        print(f"DX records: {len(dx)}")
        print(dx.tail())

        krw = yf.download(
            "KRW=X",
            start=start_date.strftime("%Y-%m-%d"),
            end=end_date.strftime("%Y-%m-%d"),
            progress=False,
        )
        print(f"KRW records: {len(krw)}")
        print(krw.tail())
        print("YFinance Test OK")
    except Exception as e:
        print(f"Error: {e}")


if __name__ == "__main__":
    main()
