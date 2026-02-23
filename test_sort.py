import FinanceDataReader as fdr
df = fdr.StockListing("ETF/KR")
print("Columns:", df.columns)
print(df.head(5))
