import FinanceDataReader as fdr
import pandas as pd

df = fdr.DataReader("069500", "2024-01-01")
print(df.columns.tolist())
df2 = fdr.StockListing("ETF/KR")
print("StockListing Columns")
print(df2.columns.tolist())
