from pykrx import stock
df = stock.get_etf_portfolio_deposit_file('453850')
print(df["비중"].max())
