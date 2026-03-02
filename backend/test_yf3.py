import yfinance as yf
ticker = yf.Ticker("005930.KS")
hist = ticker.history(period="1y")
print(hist['Close'].tail(2))
info = ticker.info
print("trailingPE:", info.get("trailingPE"), "forwardPE:", info.get("forwardPE"))
