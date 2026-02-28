import os
import time
import httpx
import logging
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

TOKEN_CACHE = {}

async def get_kis_access_token() -> Optional[Dict[str, str]]:
    from dotenv import load_dotenv
    env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
    load_dotenv(dotenv_path=env_path, override=True)

    kis_url_base = os.environ.get("KIS_URL_BASE", "https://openapi.koreainvestment.com:9443")

    app_key = os.environ.get("KIS_APP_KEY")
    app_secret = os.environ.get("KIS_APP_SECRET")
    
    if not app_key or not app_secret:
        # Fallback to key suffix mapping if primary not directly found
        for key, value in os.environ.items():
            if key.startswith("KIS_APP_KEY") and value:
                suffix = key.replace("KIS_APP_KEY", "")
                secret = os.environ.get(f"KIS_APP_SECRET{suffix}")
                if secret:
                    app_key = value.strip()
                    app_secret = secret.strip()
                    break
    
    if not app_key or not app_secret:
        logger.error("No KIS APP KEY / SECRET found in environment variables.")
        return None

    # Check cache
    cached = TOKEN_CACHE.get(app_key)
    if cached and cached["expires_at"] > time.time():
        return {
            "app_key": app_key,
            "app_secret": app_secret,
            "access_token": cached["access_token"],
        }

    token_url = f"{kis_url_base}/oauth2/tokenP"
    token_payload = {
        "grant_type": "client_credentials",
        "appkey": app_key,
        "appsecret": app_secret,
    }
    
    try:
        async with httpx.AsyncClient() as client:
            token_res = await client.post(token_url, json=token_payload)
            if token_res.status_code == 200:
                access_token = token_res.json().get("access_token")
                expires_in_sec = token_res.json().get("expires_in", 82800)
                if access_token:
                    TOKEN_CACHE[app_key] = {
                        "access_token": access_token,
                        "expires_at": time.time() + expires_in_sec - 3600,
                    }
                    return {
                        "app_key": app_key,
                        "app_secret": app_secret,
                        "access_token": access_token,
                    }
            else:
                logger.warning(f"Failed to fetch KIS token: {token_res.text}")
    except Exception as e:
        logger.error(f"Error fetching KIS token: {e}")
        
    return None
