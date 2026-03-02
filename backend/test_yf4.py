import yfinance as yf
ticker = yf.Ticker("^KS11")
info = ticker.info
print("trailingPE:", info.get("trailingPE"), "forwardPE:", info.get("forwardPE"))
