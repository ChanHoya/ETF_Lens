import urllib.parse
from typing import Dict, Any, Optional
from datetime import datetime
import json
import logging
from .kis_auth import get_kis_access_token

logger = logging.getLogger(__name__)

async def fetch_kis_domestic_daily_price(symbol: str, period: str = "3y") -> Optional[Dict[str, Any]]:
    # 1. period to start/end dates
    # period could be '1mo', '3mo', '6mo', '1y', '3y', 'ytd'
    end_date = datetime.now()
    if period == "1mo":
        start_date = end_date.replace(day=1) if end_date.day == 1 else end_date.replace(month=end_date.month-1 if end_date.month > 1 else 12, year=end_date.year if end_date.month > 1 else end_date.year-1)
    elif period == "3mo":
        start_date = end_date.replace(month=end_date.month-3 if end_date.month > 3 else end_date.month+9, year=end_date.year if end_date.month > 3 else end_date.year-1)
    elif period == "6mo":
        start_date = end_date.replace(month=end_date.month-6 if end_date.month > 6 else end_date.month+6, year=end_date.year if end_date.month > 6 else end_date.year-1)
    elif period == "1y":
        start_date = end_date.replace(year=end_date.year-1)
    elif period == "3y":
        start_date = end_date.replace(year=end_date.year-3)
    elif period == "ytd":
        start_date = end_date.replace(month=1, day=1)
    else:
        start_date = end_date.replace(year=end_date.year-1)
        
    start_dt_str = start_date.strftime("%Y%m%d")
    end_dt_str = end_date.strftime("%Y%m%d")

    import os
    import httpx
    kis_url_base = os.environ.get("KIS_URL_BASE", "https://openapi.koreainvestment.com:9443")
    
    # Needs auth token
    auth_data = await get_kis_access_token()
    if not auth_data:
        logger.error("Failed to get KIS access token")
        return None
        
    access_token = auth_data["access_token"]
    app_key = auth_data["app_key"]
    app_secret = auth_data["app_secret"]
    
    # remove .KS
    clean_symbol = symbol.replace(".KS", "")

    url = f"{kis_url_base}/uapi/domestic-stock/v1/quotations/inquire-daily-itemchartprice"
    tr_id = "FHKST03010100"
    
    headers = {
        "content-type": "application/json; charset=utf-8",
        "authorization": f"Bearer {access_token}",
        "appkey": app_key,
        "appsecret": app_secret,
        "tr_id": tr_id,
        "custtype": "P",
    }
    
    params = {
        "FID_COND_MRKT_DIV_CODE": "J",
        "FID_INPUT_ISCD": clean_symbol,
        "FID_INPUT_DATE_1": start_dt_str,
        "FID_INPUT_DATE_2": end_dt_str,
        "FID_PERIOD_DIV_CODE": "D",
        "FID_ORG_ADJ_PRC": "0" # 0: 수정주가, 1: 원주가. TR은 아니지만 액면분할등 반영
    }

    try:
        async with httpx.AsyncClient() as client:
            res = await client.get(url, headers=headers, params=params)
            if res.status_code == 200:
                data = res.json()
                if data.get("rt_cd") == "0":
                    return data.get("output2", [])
                else:
                    logger.error(f"KIS API Error for {clean_symbol}: {data.get('msg1')}")
            else:
                logger.error(f"KIS API HTTP {res.status_code} Error: {res.text}")
    except Exception as e:
         logger.exception(f"Exception fetching KIS chart data for {symbol}")
         
    return None
