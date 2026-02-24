import requests
from bs4 import BeautifulSoup
import pandas as pd

def fetch_fnguide(code):
    url = f"https://comp.fnguide.com/SVO2/ASP/SVD_Main.asp?pGB=1&gicode=A{code}&cID=&MenuYn=Y&ReportGB=&NewMenuID=Ymin&stkGb=701"
    try:
        dfs = pd.read_html(url, encoding='utf-8')
        for i, df in enumerate(dfs):
            print(f"Table {i} columns:", df.columns.tolist())
    except Exception as e:
        print(f"Error for {code}:", e)

fetch_fnguide('360750')
