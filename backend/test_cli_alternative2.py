import pandas as pd
import urllib.request
import ssl
import io
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

def fetch_data(url):
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, context=ctx) as response:
            csv_data = response.read().decode('utf-8')
        df = pd.read_csv(io.StringIO(csv_data))
        print(f"URL: {url} -> success, tail:")
        print(df.tail(2))
    except Exception as e:
        pass

for t in ["G20", "G7", "EA19", "OECD_Total", "OECDMA", "OECDE"]:
    fetch_data(f"https://fred.stlouisfed.org/graph/fredgraph.csv?id={t}LOLITOAASTSAM")
