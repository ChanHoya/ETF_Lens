import sys
from pykrx import stock
from datetime import datetime, timedelta


def main():
    try:
        print("Starting PyKrx Test...")
        end_date = datetime.now()
        start_date = end_date - timedelta(days=400)

        # Test 1 year of index fundamentals for KOSPI "1001" (Wait, is KOSPI "1001" or "1028" etc? Let's try "1001")
        df = stock.get_index_fundamental(
            start_date.strftime("%Y%m%d"), end_date.strftime("%Y%m%d"), "1001"
        )
        print("get_index_fundamental records:")
        if not df.empty:
            print(df.tail())
        else:
            print("Empty dataframe from get_index_fundamental")
        print("PyKrx Test OK")
    except Exception as e:
        print(f"Error: {e}")


if __name__ == "__main__":
    main()
