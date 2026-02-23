import requests

url = "https://openapi.koreainvestment.com:9443/uapi/domestic-stock/v1/quotations/inquire-price"
# test fetching domestic stock simply from KRX directly or finance datareader.
# Actually, FinanceDataReader can give us the name of the stock directly.
import FinanceDataReader as fdr
import pandas as pd

# Let's get the master list to fetch names
df = fdr.StockListing('KRX')
print(df[df['Code'] == '453850']['Name'].values[0] if not df[df['Code'] == '453850'].empty else 'Not Found')
