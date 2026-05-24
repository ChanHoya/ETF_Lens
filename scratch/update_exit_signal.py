import re
import os

with open("backend/api/exit_signal.py", "r") as f:
    content = f.read()

# 1. Add target_ym to get_exit_signal_data
content = content.replace(
    'async def get_exit_signal_data():',
    'async def get_exit_signal_data(target_ym: str = None):'
)

# 2. Update cache logic to bypass if target_ym is provided
content = content.replace(
    '''    if (
        _cache["data"]
        and _cache["timestamp"]
        and (now - _cache["timestamp"] < _get_cache_ttl())
    ):
        return _cache["data"]''',
    '''    if (
        not target_ym
        and _cache["data"]
        and _cache["timestamp"]
        and (now - _cache["timestamp"] < _get_cache_ttl())
    ):
        return _cache["data"]'''
)

# 3. Add helper function filter_by_target_ym
filter_helper = '''
def _filter_by_target_ym(d: dict[str, float], target_ym: str = None) -> dict[str, float]:
    if not target_ym:
        return d
    return {k: v for k, v in d.items() if k[:7] <= target_ym}

'''
content = content.replace('def get_mock_data():', filter_helper + 'def get_mock_data():')

# 4. Modify fetch_yf_data
content = content.replace(
    'async def fetch_yf_data():',
    'async def fetch_yf_data(target_ym: str = None):'
)
content = content.replace(
    '_fetch_fred_series("DTWEXBGS", days=400),',
    '_fetch_fred_series("DTWEXBGS", days=3700 if target_ym else 400),'
)
content = content.replace(
    '_fetch_yahoo_v8("KRW=X", days=400),',
    '_fetch_yahoo_v8("KRW=X", days=3700 if target_ym else 400),'
)
content = content.replace(
    'dx_mo  = _monthly_last(dx_dict)',
    'dx_mo  = _monthly_last(_filter_by_target_ym(dx_dict, target_ym))'
)
content = content.replace(
    'krw_mo = _monthly_last(krw_dict)',
    'krw_mo = _monthly_last(_filter_by_target_ym(krw_dict, target_ym))'
)

# 5. Modify fetch_fred_cli
content = content.replace(
    'async def fetch_fred_cli():',
    'async def fetch_fred_cli(target_ym: str = None):'
)
content = content.replace(
    'cli_dict = await _fetch_fred_series("USALOLITONOSTSAM", days=400)',
    'cli_dict = await _fetch_fred_series("USALOLITONOSTSAM", days=3700 if target_ym else 400)\n        cli_dict = _filter_by_target_ym(cli_dict, target_ym)'
)

# 6. Modify get_pe_detail (Wait, get_pe_detail doesn't use days=400, it uses a DB query or something. Let's see what it does. Actually it uses get_pe_history which uses DB)
# For get_pe_detail, we can just pass target_ym and filter the resulting list of dicts.
content = content.replace(
    'async def get_pe_detail(index_name: str = "KOSPI") -> list:',
    'async def get_pe_detail(index_name: str = "KOSPI", target_ym: str = None) -> list:'
)
content = content.replace(
    'return results_12m',
    'if target_ym:\n            results_12m = [r for r in results_12m if r["month"] <= target_ym]\n        return results_12m'
)
# Wait, month in pe_data might be "03월"? We should look at get_pe_detail. 
# We'll do this safely via another python script if needed. For now, let's just do target_ym for macro and sentiment.

# 7. Modify fetch_market_sentiment
content = content.replace(
    'async def fetch_market_sentiment():',
    'async def fetch_market_sentiment(target_ym: str = None):'
)
# fetch_market_sentiment uses _fetch_yahoo_v8("^VIX", days=400) and _yv8 (which uses range=3y)
content = content.replace(
    '_fetch_yahoo_v8("^VIX", days=400)',
    '_fetch_yahoo_v8("^VIX", days=3700 if target_ym else 400)'
)
content = content.replace(
    'vix_dict = await _fetch_yahoo_v8("^VIX", days=400)',
    'vix_dict = await _fetch_yahoo_v8("^VIX", days=3700 if target_ym else 400)\n        vix_dict = _filter_by_target_ym(vix_dict, target_ym)'
)
content = content.replace(
    'range=3y',
    'range=10y'
)
# Inside fetch_market_sentiment, kospi and sp500 are pd.Series. We can filter them.
content = content.replace(
    'kospi = _yv8("^KS11")',
    'kospi = _yv8("^KS11")\n        if target_ym: kospi = kospi[kospi.index <= target_ym + "-31"]'
)
content = content.replace(
    'sp500 = _yv8("^GSPC")',
    'sp500 = _yv8("^GSPC")\n        if target_ym: sp500 = sp500[sp500.index <= target_ym + "-31"]'
)

# 8. Call with target_ym in get_exit_signal_data
content = content.replace(
    'dollar_data, current_dollar, current_krw = await fetch_yf_data()',
    'dollar_data, current_dollar, current_krw = await fetch_yf_data(target_ym)'
)
content = content.replace(
    'cli_data, current_cli, cli_down_months = await fetch_fred_cli()',
    'cli_data, current_cli, cli_down_months = await fetch_fred_cli(target_ym)'
)
content = content.replace(
    'pe_data = await get_pe_detail("KOSPI")',
    'pe_data = await get_pe_detail("KOSPI")\n        # Wait, get_pe_detail might need specific filtering for target_ym since month is "03월"'
)
# For pe_data, let's just do:
# pe_data = await get_pe_detail("KOSPI") # This fetches recent 12 months. If target_ym is 5 years ago, pe_data will just be recent. 
# We'll fix get_pe_detail in a second step.

content = content.replace(
    'sentiment_data, current_vix, current_vkospi, current_fgi = await fetch_market_sentiment()',
    'sentiment_data, current_vix, current_vkospi, current_fgi = await fetch_market_sentiment(target_ym)'
)

content = content.replace(
    't10y2y_dict = await _fetch_fred_series("T10Y2Y", days=400)',
    't10y2y_dict = await _fetch_fred_series("T10Y2Y", days=3700 if target_ym else 400)\n        t10y2y_dict = _filter_by_target_ym(t10y2y_dict, target_ym)'
)
content = content.replace(
    'hy_dict = await _fetch_fred_series("BAMLH0A0HYM2", days=400)',
    'hy_dict = await _fetch_fred_series("BAMLH0A0HYM2", days=3700 if target_ym else 400)\n        hy_dict = _filter_by_target_ym(hy_dict, target_ym)'
)


with open("backend/api/exit_signal.py", "w") as f:
    f.write(content)
