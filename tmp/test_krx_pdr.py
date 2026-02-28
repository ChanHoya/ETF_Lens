import sys
import pandas_datareader.data as web
from datetime import datetime, timedelta
from pykrx import stock


def main():
    try:
        print("Starting pandas_datareader Test...")
        end_date = datetime.now()
        start_date = end_date - timedelta(days=400)

        cli = web.DataReader("KORLORSGPNOSTSAM", "fred", start_date, end_date)
        print(f"CLI records: {len(cli)}")
        print(cli.tail())
        print("pandas_datareader Test OK")
    except Exception as e:
        print(f"Error PDR: {e}")

    try:
        print("\nStarting pykrx get_index_fundamental KOSPI Test...")
        # Pykrx index ticker for KOSPI is "1001"
        df = stock.get_index_fundamental(
            start_date.strftime("%Y%m%d"), end_date.strftime("%Y%m%d"), "1001"
        )
        if not df.empty:
            print(f"KOSPI P/E records: {len(df)}")
            print(df.tail())
        else:
            print("Empty dataframe from pykrx")
    except Exception as e:
        print(f"Error KRX: {e}")


if __name__ == "__main__":
    main()
