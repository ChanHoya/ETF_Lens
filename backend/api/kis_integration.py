import os
import httpx
import logging
from datetime import datetime
from dotenv import load_dotenv
from sqlalchemy.orm import Session
from db.models import StockEPSHistory
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

logger = logging.getLogger(__name__)

load_dotenv(override=True)

KIS_URL_BASE = os.environ.get(
    "KIS_URL_BASE", "https://openapi.koreainvestment.com:9443"
)
APP_KEY = os.environ.get("KIS_APP_KEY1", "").strip()
APP_SECRET = os.environ.get("KIS_APP_SECRET1", "").strip()

# In-memory token cache to avoid requesting a new token for every call
_token_cache = {"token": None, "expires_at": None}


async def get_kis_token() -> str:
    """Retrieve or generate KIS API access token."""
    now = datetime.now().timestamp()
    if (
        _token_cache["token"]
        and _token_cache["expires_at"]
        and now < _token_cache["expires_at"]
    ):
        return _token_cache["token"]

    if not APP_KEY or not APP_SECRET:
        logger.warning("KIS API keys are missing.")
        return ""

    async with httpx.AsyncClient() as client:
        token_url = f"{KIS_URL_BASE}/oauth2/tokenP"
        token_payload = {
            "grant_type": "client_credentials",
            "appkey": APP_KEY,
            "appsecret": APP_SECRET,
        }
        res = await client.post(token_url, json=token_payload)
        data = res.json()
        token = data.get("access_token")
        if token:
            _token_cache["token"] = token
            # KIS tokens typically expire in 24 hours. Cache for 23 hours.
            _token_cache["expires_at"] = now + (23 * 3600)
            return token
        else:
            logger.error(f"Failed to get KIS token: {data}")
            return ""


async def get_stock_basic_info(symbol: str) -> dict:
    """Fetch basic stock info like EPS, PER, and Price from KIS."""
    token = await get_kis_token()
    if not token:
        return {}

    async with httpx.AsyncClient() as client:
        url = f"{KIS_URL_BASE}/uapi/domestic-stock/v1/quotations/inquire-price"
        headers = {
            "content-type": "application/json; charset=utf-8",
            "authorization": f"Bearer {token}",
            "appkey": APP_KEY,
            "appsecret": APP_SECRET,
            "tr_id": "FHKST01010100",  # Current price TR ID
        }
        params = {"fid_cond_mrkt_div_code": "J", "fid_input_iscd": symbol}
        res = await client.get(url, headers=headers, params=params)
        data = res.json()
        if data.get("rt_cd") == "0":
            output = data.get("output", {})
            return {
                "price": float(output.get("stck_prpr", 0)),
                "eps": float(output.get("eps", 0)),
                "per": float(output.get("per", 0)),
            }
        else:
            logger.error(f"Failed to fetch KIS data for {symbol}: {data.get('msg1')}")
            return {}


async def fetch_and_store_eps_data(db: AsyncSession, symbols: list):
    """Fetch EPS/Price data for symbols and store it into the SQLite database."""
    today_str = datetime.now().strftime("%Y-%m-%d")

    for symbol in symbols:
        info = await get_stock_basic_info(symbol)
        if info:
            price = info.get("price", 0)
            eps = info.get("eps", 0)
            # In absence of a true forward EPS endpoint from KIS free API,
            # we use the recent trailing EPS as our basis (or an estimated forward EPS if accessible)

            # Check if record already exists for today
            stmt = select(StockEPSHistory).where(
                StockEPSHistory.symbol == symbol, StockEPSHistory.date == today_str
            )
            result = await db.execute(stmt)
            existing = result.scalars().first()

            if not existing:
                new_record = StockEPSHistory(
                    symbol=symbol, date=today_str, forward_eps=eps, price=price
                )
                db.add(new_record)
            else:
                existing.forward_eps = eps
                existing.price = price

    await db.commit()
    logger.info(f"Successfully saved EPS data for {len(symbols)} symbols to DB.")
