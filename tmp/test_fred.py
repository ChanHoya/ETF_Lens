import pandas as pd
import datetime


def main():
    try:
        print("Starting FRED Test via requests...")
        import requests

        headers = {"User-Agent": "Mozilla/5.0"}
        # Fetching chart data directly from FRED website for CLI (KORLORSGPNOSTSAM)
        url = "https://fred.stlouisfed.org/graph/api/series/?obs=true&sid=KORLORSGPNOSTSAM"
        res = requests.get(url, headers=headers)
        if res.status_code == 200:
            data = res.json()
            series = data.get("seriess", [{}])[0]
            obs = series.get("obs", [])
            print(f"FRED records: {len(obs)}")
            if obs:
                print(obs[-5:])
        else:
            print(f"Failed to fetch FRED: {res.status_code}")
    except Exception as e:
        print(f"Error: {e}")


if __name__ == "__main__":
    main()
