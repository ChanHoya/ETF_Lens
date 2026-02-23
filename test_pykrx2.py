from pykrx import stock
from datetime import datetime, timedelta

def get_last_biz_day():
    today = datetime.now()
    dates = stock.get_business_days_dates(today - timedelta(days=10), today)
    return dates[-1].strftime("%Y%m%d")

last_day = get_last_biz_day()
print(f"Last biz day: {last_day}")

df1 = stock.get_etf_portfolio_deposit_file(last_day, "453850") # US Tech
print("US Tech 453850")
print(df1.head())
print("len:", len(df1))

df2 = stock.get_etf_portfolio_deposit_file(last_day, "069500") # KODEX 200
print("KODEX 200 069500")
print(df2.head())
print("len:", len(df2))
