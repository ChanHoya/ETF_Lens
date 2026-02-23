import asyncio
import sys
import json
import urllib.request

req = urllib.request.Request("http://127.0.0.1:8000/api/v1/analyze/compare/holdings", 
    data=b'{"etf_codes":["069500","453850"]}', 
    headers={"Content-Type": "application/json"})
try:
    res = urllib.request.urlopen(req)
    print(res.read())
except Exception as e:
    print(e)
    print(e.read().decode())
