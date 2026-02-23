import FinanceDataReader as fdr
df = fdr.StockListing("ETF/KR")
print("FDR Columns:", df.columns.tolist())
if not df.empty:
    print(df.iloc[0].to_dict())
