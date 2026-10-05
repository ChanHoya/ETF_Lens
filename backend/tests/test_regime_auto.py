# 이정표 자동 생성(core/regime_auto) 테스트 — 실제 기준금리 이력 재현, 환율 지그재그, 문구 병합, AI 설명 캐시·실패 처리
import asyncio
import json
from datetime import date

import pandas as pd

from api.rates_dashboard import REGIMES as RATE_REGIMES
from core import regime_auto
from core.regime_auto import attach_text, fx_auto_segments, rate_cycles, template_text, valid_text

# ECOS 722Y001 기준금리 실제 변경 이력(2006~2026) — (변경일, 변경 후 금리)
CHANGES = [("2006-02-09", 4.0), ("2006-06-08", 4.25), ("2006-08-10", 4.5), ("2007-07-12", 4.75), ("2007-08-09", 5.0),
           ("2008-08-07", 5.25), ("2008-10-09", 5.0), ("2008-10-27", 4.25), ("2008-11-07", 4.0), ("2008-12-11", 3.0),
           ("2009-01-09", 2.5), ("2009-02-12", 2.0), ("2010-07-09", 2.25), ("2010-11-16", 2.5), ("2011-01-13", 2.75),
           ("2011-03-10", 3.0), ("2011-06-10", 3.25), ("2012-07-12", 3.0), ("2012-10-11", 2.75), ("2013-05-09", 2.5),
           ("2014-08-14", 2.25), ("2014-10-15", 2.0), ("2015-03-12", 1.75), ("2015-06-11", 1.5), ("2016-06-09", 1.25),
           ("2017-11-30", 1.5), ("2018-11-30", 1.75), ("2019-07-18", 1.5), ("2019-10-16", 1.25), ("2020-03-17", 0.75),
           ("2020-05-28", 0.5), ("2021-08-26", 0.75), ("2021-11-25", 1.0), ("2022-01-14", 1.25), ("2022-04-14", 1.5),
           ("2022-05-26", 1.75), ("2022-07-13", 2.25), ("2022-08-25", 2.5), ("2022-10-12", 3.0), ("2022-11-24", 3.25),
           ("2023-01-13", 3.5), ("2024-10-11", 3.25), ("2024-11-28", 3.0), ("2025-02-25", 2.75), ("2025-05-29", 2.5),
           ("2026-07-16", 2.75), ("2026-08-27", 3.0)]


def _base_series(end: date, extra: list[tuple[str, float]] = ()) -> pd.Series:
    steps = [("2006-01-02", 3.75), *CHANGES, *extra]
    days = pd.date_range("2006-01-02", end, freq="B")
    s = pd.Series(index=days, dtype=float)
    for d, v in steps:
        s[s.index >= d] = v
    return s


def _krw(points: list[tuple[str, float]]) -> pd.Series:
    """꺾은선 경로를 일별로 선형 보간."""
    idx = pd.to_datetime([d for d, _ in points])
    s = pd.Series([float(v) for _, v in points], index=idx)
    return s.resample("D").interpolate()


def test_rate_cycles_reproduce_curated_boundaries_from_real_history():
    segs = rate_cycles(_base_series(date(2026, 10, 2)), date(2026, 10, 5))
    assert [(s["start"], s["kind"]) for s in segs] == [(r["start"], r["kind"]) for r in RATE_REGIMES]
    assert segs[-1]["end"] is None and segs[-1]["kind"] == "hike"
    assert all(not s["auto"] for s in attach_text(segs, RATE_REGIMES))


def test_rate_cycles_detect_new_cycle_automatically():
    # 2026-11-26 인하로 방향 전환 → 인상 사이클이 닫히고 동결·인하 구간이 새로 생긴다
    s = _base_series(date(2027, 3, 2), [("2026-11-26", 2.75), ("2027-01-15", 2.5)])
    segs = attach_text(rate_cycles(s, date(2027, 3, 5)), RATE_REGIMES)
    tail = [(x["start"], x["end"], x["kind"], x["auto"]) for x in segs[-3:]]
    assert tail == [("2026-07-16", "2026-08-27", "hike", False),
                    ("2026-08-27", "2026-11-26", "hold", True),
                    ("2026-11-26", None, "cut", True)]


def test_rate_cycles_open_hold_after_six_months():
    segs = rate_cycles(_base_series(date(2027, 4, 1)), date(2027, 4, 1))
    assert segs[-1] == {"start": "2026-08-27", "end": None, "kind": "hold"}
    assert segs[-2]["kind"] == "hike" and segs[-2]["end"] == "2026-08-27"


def test_fx_rebound_then_fall_creates_up_and_open_down():
    krw = _krw([("2026-09-09", 1340), ("2026-11-20", 1460), ("2027-01-15", 1330)])
    segs = fx_auto_segments(krw, "2026-09-09", "down")
    assert [(s["start"], s["end"], s["kind"]) for s in segs] == [
        ("2026-09-09", "2026-11-20", "up"), ("2026-11-20", None, "down")]


def test_fx_small_moves_create_nothing():
    krw = _krw([("2026-09-09", 1340), ("2026-10-01", 1380), ("2026-10-20", 1335), ("2026-11-01", 1360)])
    assert fx_auto_segments(krw, "2026-09-09", "down") == []


def test_fx_trend_extension_only_when_large():
    big = _krw([("2026-09-09", 1340), ("2026-10-20", 1250), ("2026-11-10", 1300)])
    assert [(s["start"], s["end"], s["kind"]) for s in fx_auto_segments(big, "2026-09-09", "down")] == [
        ("2026-09-09", "2026-10-20", "down")]


def test_template_and_validation():
    t = template_text("rates", {"kind": "cut", "from": 3.0, "to": 2.5, "bp": -50, "changes": 2})
    assert t["title"] == "인하 사이클" and "3.00 → 2.50% (-50bp, 2회)" in t["drivers"][0]
    f = template_text("fx", {"kind": "up", "from": 1340.0, "to": 1460.0, "chg_pct": 9.0})
    assert f["title"] == "원화 약세 국면" and "+9.0%" in f["drivers"][0]
    assert valid_text({"title": "환전 수급", "drivers": ["a", "b"]}) == {"title": "환전 수급", "drivers": ["a", "b"]}
    assert valid_text({"title": "", "drivers": ["a"]}) is None
    assert valid_text({"title": "x" * 30, "drivers": ["a"]}) is None
    assert valid_text({"title": "ok", "drivers": []}) is None


# ── AI 설명: DB 캐시·실패 처리 (DB·Gemini는 가짜로 대체) ─────────────────────
class _Row:
    def __init__(self, sector, content):
        self.sector, self.content = sector, content


class _FakeSession:
    store: dict = {}

    async def __aenter__(self):
        return self

    async def __aexit__(self, *a):
        return False

    async def execute(self, stmt):
        row = self.store.get(stmt.whereclause.right.value)
        return type("R", (), {"scalar_one_or_none": lambda _s: row})()

    def add(self, row):
        self.store[row.sector] = _Row(row.sector, row.content)

    async def commit(self):
        pass


def _patch(monkeypatch, gemini):
    import api.brazil_bond as bb
    import db.database as dbm
    _FakeSession.store = {}
    calls = []

    def fake_gemini(key, prompt):
        calls.append(prompt)
        return gemini(prompt)
    monkeypatch.setattr(dbm, "AsyncSessionLocal", _FakeSession)
    monkeypatch.setattr(bb, "_call_gemini_sync", fake_gemini)
    monkeypatch.setattr(regime_auto, "news_headlines", lambda q, limit=8: ["한은, 기준금리 인하 단행"])
    monkeypatch.setattr(regime_auto, "_ai_attempt", {})
    monkeypatch.setenv("GEMINI_API_KEY", "test")
    return calls


def _auto_seg():
    seg = {"start": "2026-11-26", "end": None, "kind": "cut", "auto": True, "from": 3.0, "to": 2.5, "bp": -50, "changes": 2}
    seg.update(template_text("rates", seg))
    return seg


def test_enrich_uses_ai_once_then_db_cache(monkeypatch):
    calls = _patch(monkeypatch, lambda p: json.dumps({"title": "경기 둔화 인하", "drivers": ["수출 둔화", "물가 안정"]}))
    seg = _auto_seg()
    asyncio.run(regime_auto.enrich_texts("rates", [seg], lambda s: "ctx", "한국은행 기준금리", date(2027, 1, 20)))
    assert seg["title"] == "경기 둔화 인하" and seg["source"] == "AI 작성 · 뉴스 1건" and len(calls) == 1
    again = _auto_seg()
    asyncio.run(regime_auto.enrich_texts("rates", [again], lambda s: "ctx", "한국은행 기준금리", date(2027, 1, 20)))
    assert again["title"] == "경기 둔화 인하" and len(calls) == 1  # DB 캐시 재사용, Gemini 재호출 없음


def test_enrich_failure_keeps_template(monkeypatch):
    def boom(p):
        raise RuntimeError("quota")
    _patch(monkeypatch, boom)
    seg = _auto_seg()
    asyncio.run(regime_auto.enrich_texts("rates", [seg], lambda s: "ctx", "q", date(2027, 1, 20)))
    assert seg["title"] == "인하 사이클" and seg["source"] == "데이터 기반 자동 감지"
    assert _FakeSession.store == {}


def test_valid_text_rejects_direction_contradiction():
    assert valid_text({"title": "고금리 지속, 추가 긴축 예고", "drivers": ["물가 압력"]}, "rates", "cut") is None
    assert valid_text({"title": "경기 둔화 인하", "drivers": ["수출 둔화"]}, "rates", "cut")["title"] == "경기 둔화 인하"
    assert valid_text({"title": "원화 강세 전환", "drivers": ["수출 호조"]}, "fx", "up") is None
    assert valid_text({"title": "달러 강세", "drivers": ["외국인 매도"]}, "fx", "up")["title"] == "달러 강세"


def test_enrich_rejects_contradicting_ai_text(monkeypatch):
    _patch(monkeypatch, lambda p: json.dumps({"title": "고금리 지속, 추가 긴축 예고", "drivers": ["물가 압력"]}))
    seg = _auto_seg()  # 인하 국면
    asyncio.run(regime_auto.enrich_texts("rates", [seg], lambda s: "ctx", "q", date(2027, 1, 20)))
    assert seg["title"] == "인하 사이클" and _FakeSession.store == {}


def test_zigzag_keeps_qualified_high_when_low_is_broken_before_confirmation():
    # 나스닥 2006~2009 모양: 저점 2300 → 고점 2810(+22%) → 2290(직전 저점 살짝 이탈, 고점 대비 −18.5%) → 1270
    from core.regime_auto import zigzag_auto
    s = _krw([("2006-10-06", 2300), ("2007-11-02", 2810), ("2008-01-18", 2290), ("2009-03-06", 1270), ("2010-01-01", 2300)])
    pivots, _ = zigzag_auto(s, 0.20)
    kinds = [(d.strftime("%Y-%m"), k) for d, _, k in pivots]
    assert kinds[:3] == [("2006-10", "low"), ("2007-11", "high"), ("2009-03", "low")]
