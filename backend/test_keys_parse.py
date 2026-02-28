import os
from dotenv import load_dotenv

load_dotenv(override=True)
global_keys = []
for key, value in os.environ.items():
    if key.startswith("KIS_APP_KEY") and value:
        suffix = key.replace("KIS_APP_KEY", "")
        app_secret = os.environ.get(f"KIS_APP_SECRET{suffix}")
        if app_secret:
            global_keys.append({
                "app_key_suffix": suffix,
                "app_key": value.strip(),
                "app_secret": app_secret.strip()[:10] + "..."
            })
print(global_keys)
