import urllib.request
import json
import ssl
import time
import logging

logger = logging.getLogger(__name__)

# 5-minute memory cache
_etf_disparity_cache = {}
CACHE_TTL = 300  # 5 minutes

async def fetch_etf_disparity_list() -> dict:
    """
    Fetches the real-time ETF list from Naver Finance containing prices and NAVs,
    calculates the disparity rate, and returns a mapped dictionary by ETF code.
    """
    global _etf_disparity_cache
    now = time.time()
    
    if "data" in _etf_disparity_cache:
        cached_data, cached_time = _etf_disparity_cache["data"]
        if now - cached_time < CACHE_TTL:
            return cached_data

    # Perform raw fetching
    def _sync_fetch():
        try:
            ctx = ssl._create_unverified_context()
            url = "https://finance.naver.com/api/sise/etfItemList.nhn"
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            res = urllib.request.urlopen(req, timeout=8, context=ctx).read()
            
            data = json.loads(res.decode('cp949', errors='ignore'))
            etf_list = data.get("result", {}).get("etfItemList", [])
            
            mapped_disparity = {}
            for item in etf_list:
                code = item.get("itemcode")
                name = item.get("itemname")
                price = item.get("nowVal")
                nav = item.get("nav")
                
                if not code or price is None or nav is None:
                    continue
                
                try:
                    price = float(price)
                    nav = float(nav)
                    # Compute disparity rate: ((Price - NAV) / NAV) * 100
                    if nav > 0:
                        disparity_rate = ((price - nav) / nav) * 100
                    else:
                        disparity_rate = 0.0
                        
                    mapped_disparity[code] = {
                        "code": code,
                        "name": name,
                        "price": price,
                        "nav": nav,
                        "disparity_rate": round(disparity_rate, 3)
                    }
                except Exception as ex:
                    logger.warning(f"Error parsing ETF disparity values for {code}: {ex}")
                    continue
            
            logger.info(f"Successfully loaded and parsed {len(mapped_disparity)} ETFs from Naver Finance")
            return mapped_disparity
        except Exception as e:
            logger.error(f"Failed to fetch ETF disparity data from Naver: {e}")
            return {}

    # Import asyncio inside if needed, or rely on runtime loop
    import asyncio
    mapped_data = await asyncio.to_thread(_sync_fetch)
    
    if mapped_data:
        _etf_disparity_cache["data"] = (mapped_data, now)
        
    return mapped_data

async def get_etf_disparity(code: str) -> dict | None:
    """
    Returns the disparity details for a specific ETF code.
    Clean up trailing suffix if KSE/KOSDAQ code is passed in (.KS or .KQ).
    """
    code = code.strip()
    if code.endswith(".KS") or code.endswith(".KQ"):
        code = code[:-3]
        
    # Map space-specific codes in DB if any
    space_map = {
        "488050": "0167Z0",
        "484930": "0180V0",
        "488100": "0183J0",
        "495470": "0181L0",
    }
    if code in space_map:
        code = space_map[code]
        
    data_map = await fetch_etf_disparity_list()
    return data_map.get(code)
