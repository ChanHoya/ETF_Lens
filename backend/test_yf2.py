import yfinance as yf
df1 = yf.download("005930.KS", start="2025-02-01", progress=False)
print(df1.columns)
print(df1["Close"].columns if "Close" in df1 else "No Close")
