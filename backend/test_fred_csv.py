import pandas as pd
from pykrx import stock

url = "https://fred.stlouisfed.org/graph/fredgraph.csv?id=KORLORSGPNOSTSAM"
df = pd.read_csv(url, parse_dates=['DATE'], index_col='DATE')
print("CLI Korea:", df.tail())

df_pe = stock.get_market_fundamental("20240101", "20240131", "005930")
if df_pe is not None and not df_pe.empty:
    print("pykrx works:")
    print(df_pe.tail())
