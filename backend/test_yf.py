import yfinance as yf
df1 = yf.download("005380.KS", start="2025-02-01", progress=False)
print(df1['Close'].iloc[:, 0].tail(2))
