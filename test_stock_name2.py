import FinanceDataReader as fdr
df = fdr.StockListing('ETF/KR')
print(df[df['Symbol'] == '453850'][['Symbol', 'Name']])
