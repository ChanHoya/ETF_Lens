import re

with open("backend/api/exit_signal.py", "r") as f:
    content = f.read()

# Insert the session definition
session_code = """
# Setup a custom session for yfinance to bypass cloud bot-blocking
_yf_session = requests.Session()
_yf_session.headers.update({
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
})
"""
content = re.sub(r'logger = logging\.getLogger\(__name__\)', 'logger = logging.getLogger(__name__)\n' + session_code, content)

# Add session=_yf_session to yf.download
content = re.sub(r'progress=False,', 'progress=False,\n            session=_yf_session,', content)

with open("backend/api/exit_signal.py", "w") as f:
    f.write(content)

