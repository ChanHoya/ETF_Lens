import pandas as pd
from datetime import datetime, timedelta
import io
import requests

url = "https://fred.stlouisfed.org/graph/fredgraph.csv?id=T10Y2Y"
resp = requests.get(url)
df = pd.read_csv(io.StringIO(resp.text), na_values=".")
df['DATE'] = pd.to_datetime(df['DATE'])
cutoff = datetime.now() - timedelta(days=180)
recent = df[df['DATE'] >= cutoff]
print(f"Min in last 180 days: {recent['T10Y2Y'].min()}")
