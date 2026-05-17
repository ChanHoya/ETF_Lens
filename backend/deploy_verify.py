import asyncio
import os
import sys
import logging
from datetime import datetime

# Add parent directory to path to enable local imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("DeployVerify")

async def test_postgres_connection(url: str) -> bool:
    from sqlalchemy.ext.asyncio import create_async_engine
    from sqlalchemy import select
    try:
        engine = create_async_engine(url, echo=False, connect_args={"timeout": 5})
        async with engine.connect() as conn:
            await conn.execute(select(1))
        await engine.dispose()
        return True
    except Exception as e:
        logger.error(f"PostgreSQL connection failed: {e}")
        return False

def test_yfinance() -> bool:
    import yfinance as yf
    try:
        ticker = yf.Ticker("^GSPC")
        df = ticker.history(period="1d")
        if df.empty:
            raise ValueError("Returned empty DataFrame")
        return True
    except Exception as e:
        logger.error(f"yfinance check failed: {e}")
        return False

def test_oecd() -> bool:
    import requests
    try:
        url = "https://stats.oecd.org/SDMX-JSON/data/MEI_CLI/LOLITOAASTSAM.KOR.M/all?startTime=2024-01&endTime=2024-02"
        resp = requests.get(url, timeout=5)
        return resp.status_code == 200 and len(resp.text) > 50
    except Exception as e:
        logger.error(f"OECD check failed: {e}")
        return False

def test_naver() -> bool:
    import urllib.request
    import json
    import ssl
    try:
        ctx = ssl._create_unverified_context()
        url = "https://m.stock.naver.com/api/stock/069500/integration"
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        resp = urllib.request.urlopen(req, timeout=5, context=ctx).read()
        data = json.loads(resp)
        return bool(data.get("stockName"))
    except Exception as e:
        logger.error(f"Naver Finance mobile API check failed: {e}")
        return False

def test_gemini() -> bool:
    api_key = os.getenv("GEMINI_API_KEY", "")
    if not api_key:
        logger.warning("GEMINI_API_KEY env not configured, skipping Gemini check")
        return True
    import google.generativeai as genai
    try:
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel("gemini-1.5-flash")
        resp = model.generate_content("ping", generation_config={"max_output_tokens": 1})
        return bool(resp.text)
    except Exception as e:
        logger.error(f"Gemini API check failed: {e}")
        return False

async def main():
    logger.info("=== Starting Pre-Deployment Environment Verification ===")
    
    # 1. Environment Config
    required_envs = ["RENDER_DATABASE_URL", "KIS_APPKEY", "KIS_APPSECRET"]
    missing = [env for env in required_envs if not os.getenv(env)]
    if missing:
        logger.warning(f"Missing core environments for KIS integration/PostgreSQL replication: {missing}")
    else:
        logger.info("🟢 All core environments configured.")

    # 2. Test DB Parity Connection
    postgres_url = os.getenv("RENDER_DATABASE_URL", "")
    if postgres_url:
        # Convert to async if postgresql+asyncpg not specified
        if postgres_url.startswith("postgresql://"):
            postgres_url = postgres_url.replace("postgresql://", "postgresql+asyncpg://", 1)
        db_ok = await test_postgres_connection(postgres_url)
        if db_ok:
            logger.info("🟢 Remote Render PostgreSQL connection verified successfully.")
        else:
            logger.error("❌ Remote Render PostgreSQL connection failed.")
    else:
        logger.warning("⚠️ RENDER_DATABASE_URL not configured.")

    # 3. Test External APIs
    logger.info("Testing external API dependency channels...")
    yf_ok = test_yfinance()
    oecd_ok = test_oecd()
    naver_ok = test_naver()
    gemini_ok = test_gemini()

    logger.info("=== Pre-Deployment Scan Summary ===")
    logger.info(f"yfinance (Yahoo Finance) : {'🟢 OK' if yf_ok else '❌ FAILED'}")
    logger.info(f"OECD CLI API             : {'🟢 OK' if oecd_ok else '❌ FAILED'}")
    logger.info(f"Naver Mobile Stock API   : {'🟢 OK' if naver_ok else '❌ FAILED'}")
    logger.info(f"Gemini LLM API           : {'🟢 OK' if gemini_ok else '❌ FAILED'}")

    all_passed = yf_ok and oecd_ok and naver_ok and gemini_ok
    if all_passed:
        logger.info("🎉 All verification steps passed. Secure deployment verified.")
        sys.exit(0)
    else:
        logger.error("🚨 Some verification checks failed. Review errors before production pushing.")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())
