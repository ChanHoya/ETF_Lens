import re

with open("backend/api/exit_signal.py", "r") as f:
    content = f.read()

# 1. Update fetch_oecd_cli_simple
content = content.replace(
    'async def fetch_oecd_cli_simple() -> tuple[list, float | None, int]:',
    'async def fetch_oecd_cli_simple(target_ym: str = None) -> tuple[list, float | None, int]:'
)
# url has startPeriod=2023-01
content = content.replace(
    'startPeriod=2023-01',
    'startPeriod=2013-01'  # 10 years
)
# the dataframe parsing currently uses df.tail(13). 
# If target_ym is given, we should filter up to target_ym, else keep all, then take tail(13).
content = content.replace(
    'df = df.dropna(subset=[date_col, val_col]).sort_values(date_col).tail(13)',
    'df = df.dropna(subset=[date_col, val_col]).sort_values(date_col)\n        if target_ym:\n            df = df[df[date_col].dt.strftime("%Y-%m") <= target_ym]\n        df = df.tail(13)'
)

# 2. Update fetch_fred_cli to pass target_ym down
content = content.replace(
    'return await fetch_oecd_cli_simple()',
    'return await fetch_oecd_cli_simple(target_ym)'
)

# 3. Update get_pe_detail
content = content.replace(
    'async def get_pe_detail(symbol: str = "005930"):',
    'async def get_pe_detail(symbol: str = "005930", target_ym: str = None):'
)

# inside get_pe_detail, it calls ticker.history(start_dt, end_dt). We can change start_dt.
content = content.replace(
    'start_dt = datetime.now() - timedelta(days=400)  # 1년치 + 여유',
    'start_dt = datetime.now() - timedelta(days=3700 if target_ym else 400)  # 1년치 또는 10년치'
)

# After fetching results_12m in get_pe_detail:
content = content.replace(
    'return results_12m',
    'if target_ym:\n            results_12m = [r for r in results_12m if r["month"].startswith(target_ym[-2:])] # naive match? No, wait.'
)
# Wait! "month" in results_12m is "03월" format. We can't filter by target_ym easily!
# Wait, let's see how results_12m is built. 
# It comes from `hist` dataframe in get_pe_detail.
