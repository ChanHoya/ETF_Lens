from pykrx import stock
from datetime import datetime

# Get today's or previous business day's portfolio
today = datetime.now().strftime("%Y%m%d")
# Try getting portfolio for TIGER 미국테크TOP10+10%프리미엄 (453850)
try:
    df = stock.get_etf_portfolio_deposit_file(today, "453850")
    print("Today's ETF PDF:")
    print(df.head())
except Exception as e:
    print(e)
