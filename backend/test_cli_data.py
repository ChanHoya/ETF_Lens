import pandas as pd
import urllib.request
import ssl
import io
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

def fetch_data(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, context=ctx) as response:
        csv_data = response.read().decode('utf-8')
    df = pd.read_csv(io.StringIO(csv_data))
    date_col = 'observation_date' if 'observation_date' in df.columns else 'DATE'
    df[date_col] = pd.to_datetime(df[date_col])
    df["YM"] = df[date_col].dt.strftime("%Y-%m")
    df.set_index("YM", inplace=True)
    val_col = df.columns[1] if df.columns[1] != 'YM' else df.columns[0]
    df[val_col] = pd.to_numeric(df[val_col], errors="coerce")
    print(f"URL: {url}")
    print(df.tail())

fetch_data("https://fred.stlouisfed.org/graph/fredgraph.csv?id=KORLORSGPNOSTSAM")
fetch_data("https://fred.stlouisfed.org/graph/fredgraph.csv?id=USALORSGPNOSTSAM")
fetch_data("https://fred.stlouisfed.org/graph/fredgraph.csv?id=OECDLORSGPNOSTSAM")
