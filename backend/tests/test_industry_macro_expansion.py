# 2차전지 및 자동차 등 다중 업종 펀더멘털 DB 시계열 확장 및 조회 기능을 검증하는 테스트
import pytest
from core.macro_historical_data import get_combined_macro_series, append_macro_point


def test_semiconductor_macro_series_db_load():
    """반도체 10개년 시계열이 DB에서 정상 로드되는지 확인."""
    series = get_combined_macro_series("semiconductor")
    assert len(series) >= 120
    latest = series[-1]
    assert latest["date"] == "2026-10"
    assert latest["export_amt"] == 310.0


def test_battery_macro_series_db_load():
    """2차전지 10개년 시계열이 DB에서 정상 로드되는지 확인."""
    series = get_combined_macro_series("battery")
    assert len(series) >= 120
    latest = series[-1]
    assert latest["date"] == "2026-10"
    assert latest["export_amt"] == 86.5
    assert latest["unit_price"] == 104.2


def test_automobile_macro_series_db_load():
    """자동차 10개년 시계열이 DB에서 정상 로드되는지 확인."""
    series = get_combined_macro_series("automobile")
    assert len(series) >= 120
    latest = series[-1]
    assert latest["date"] == "2026-10"
    assert latest["export_amt"] == 71.8
    assert latest["cap_util"] == 102.4


def test_append_and_query_macro_point_multi_industry():
    """신규 산업 포인트 추가 및 즉시 갱신 확인."""
    test_point = {
        "date": "2026-11",
        "export_amt": 89.0,
        "unit_price": 106.5,
        "volume": 115.0,
        "cap_util": 100.5,
        "inventory": 97.0,
    }
    append_macro_point(test_point, industry="battery")
    series = get_combined_macro_series("battery")
    latest = series[-1]
    assert latest["date"] == "2026-11"
    assert latest["export_amt"] == 89.0

    # 테스트 후 원복 (2026-11 데이터 정리)
    import sqlite3
    from core.macro_historical_data import _get_sqlite_db_path, _CACHED_DB_SERIES, _LAST_DB_FETCH_TIME
    db_path = _get_sqlite_db_path()
    if db_path:
        conn = sqlite3.connect(db_path)
        cur = conn.cursor()
        cur.execute("DELETE FROM industry_macro_series WHERE industry = 'battery' AND date = '2026-11'")
        conn.commit()
        conn.close()
    _CACHED_DB_SERIES.pop("battery", None)
    _LAST_DB_FETCH_TIME.pop("battery", None)
