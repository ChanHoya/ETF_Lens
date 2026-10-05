# 금리·환율 국면(이정표) 자동 생성 — 기준금리 사이클 구간화, 환율 지그재그 전환점 탐지, 큐레이션 문구 병합, AI 설명(DB 캐시)
"""
규칙은 docs/auto-milestones-context-notes.md.
- 순수 계산(rate_cycles·zigzag·fx_auto_segments·attach_text·template_text)은 동기 함수로 두고 테스트한다.
- enrich_texts는 자동 국면의 제목·배경을 DB 캐시 → Gemini → 기본 문구 순으로 채운다(비동기, 실패해도 기본 문구 유지).
"""
import json
import logging
import os
import time
from datetime import date, datetime, timezone
from urllib.parse import quote
from xml.etree import ElementTree

import pandas as pd
import requests

logger = logging.getLogger(__name__)

RATE_FROM = "2008-10-01"   # 금리 국면 표시 시작(차트 20년 창·큐레이션 범위)
HOLD_GAP_DAYS = 60         # 방향이 바뀌는 사이클 사이가 이보다 길면 동결 구간
OPEN_HOLD_DAYS = 180       # 마지막 변경 후 이보다 지나면 "동결(진행 중)"
FX_THRESHOLD = 0.08        # 고점·저점 대비 8% 반전이면 전환점 확정
FX_OPEN_MIN = 0.05         # 마지막 전환점 이후 5% 이상 움직였을 때만 진행 중 국면 표시
AI_RETRY_SEC = 6 * 3600
AI_MAX_PER_BUILD = 2
NEWS_RECENT_DAYS = 120
_ai_attempt: dict[str, float] = {}


def _d(ts: pd.Timestamp) -> str:
    return ts.strftime("%Y-%m-%d")


# ── 금리: 기준금리 변경 이력 → 인상·인하 사이클과 동결 구간 ─────────────────
def rate_cycles(kb: pd.Series, today: date) -> list[dict]:
    """같은 방향 변경이 이어지는 동안은 한 사이클(간격이 길어도), 방향이 바뀌는 사이클 사이는 동결 구간."""
    diff = kb.diff()
    ch = diff[diff.abs() > 1e-9]
    if ch.empty:
        return []
    runs: list[list] = []  # [kind, 첫 변경일, 마지막 변경일]
    for d, v in ch.items():
        kind = "hike" if v > 0 else "cut"
        if runs and runs[-1][0] == kind:
            runs[-1][2] = d
        else:
            runs.append([kind, d, d])
    segs = []
    for i, (kind, s, e) in enumerate(runs):
        if i > 0 and (s - runs[i - 1][2]).days >= HOLD_GAP_DAYS:
            segs.append({"start": runs[i - 1][2], "end": s, "kind": "hold"})
        segs.append({"start": s, "end": e, "kind": kind})
    last = runs[-1][2]
    if (pd.Timestamp(today) - last).days >= OPEN_HOLD_DAYS:
        segs.append({"start": last, "end": None, "kind": "hold"})
    else:
        segs[-1]["end"] = None  # 사이클 진행 중
    return [{"start": _d(x["start"]), "end": _d(x["end"]) if x["end"] is not None else None, "kind": x["kind"]}
            for x in segs if x["start"] >= pd.Timestamp(RATE_FROM)]


# ── 환율: 지그재그 전환점 → 큐레이션 이후 자동 국면 ─────────────────────────
def zigzag(s: pd.Series, start_type: str, threshold: float = FX_THRESHOLD):
    """s 첫 값을 start_type('low'|'high') 전환점으로 두고, 반대 방향 전환점이 확정되기 전에는
    같은 종류의 더 극단적인 값이 나오면 마지막 전환점을 그쪽으로 옮긴다(추세 연장).
    반대 방향으로 threshold 이상 되돌리면 그 극값을 전환점으로 확정한다.
    반환: (전환점 [(날짜, 값, 종류)], 진행 중 극값 (날짜, 값))."""
    pivots = [(s.index[0], float(s.iloc[0]), start_type)]
    looking = "high" if start_type == "low" else "low"
    ext_d, ext_v = s.index[0], float(s.iloc[0])
    for d, v in s.iloc[1:].items():
        v = float(v)
        if looking == "high":
            if v < pivots[-1][1]:                      # 저점 갱신 → 저점을 뒤로
                pivots[-1] = (d, v, "low")
                ext_d, ext_v = d, v
            elif v > ext_v:
                ext_d, ext_v = d, v
            elif v <= ext_v * (1 - threshold) and ext_v >= pivots[-1][1] * (1 + threshold):
                pivots.append((ext_d, ext_v, "high"))
                looking, ext_d, ext_v = "low", d, v
        else:
            if v > pivots[-1][1]:                      # 고점 갱신 → 고점을 뒤로
                pivots[-1] = (d, v, "high")
                ext_d, ext_v = d, v
            elif v < ext_v:
                ext_d, ext_v = d, v
            elif v >= ext_v * (1 + threshold) and ext_v <= pivots[-1][1] * (1 - threshold):
                pivots.append((ext_d, ext_v, "low"))
                looking, ext_d, ext_v = "high", d, v
    return pivots, (ext_d, ext_v)


def fx_auto_segments(krw: pd.Series, after: str, after_kind: str) -> list[dict]:
    """마지막 큐레이션 국면 끝(after) 이후 자동 국면. after_kind는 그 국면 종류(down이면 끝이 저점)."""
    seg = krw[krw.index >= after]
    if len(seg) < 2:
        return []
    pivots, _ = zigzag(seg, "low" if after_kind == "down" else "high")
    out = []
    # 큐레이션 끝 이후 같은 방향으로 5% 이상 더 간 경우만 추세 연장 구간으로(작은 흔들림은 잡음)
    if pivots[0][0] > seg.index[0] and abs(pivots[0][1] / float(seg.iloc[0]) - 1) >= FX_OPEN_MIN:
        out.append({"start": after, "end": _d(pivots[0][0]),
                    "kind": "down" if pivots[0][2] == "low" else "up"})
    for (d0, v0, _), (d1, v1, _) in zip(pivots, pivots[1:]):
        out.append({"start": _d(d0), "end": _d(d1), "kind": "up" if v1 > v0 else "down"})
    d_last, v_last, _ = pivots[-1]
    now = float(seg.iloc[-1])
    if seg.index[-1] > d_last and abs(now / v_last - 1) >= FX_OPEN_MIN:
        out.append({"start": _d(d_last), "end": None, "kind": "up" if now > v_last else "down"})
    return out


# ── 문구 ────────────────────────────────────────────────────────────────────
def attach_text(segs: list[dict], curated: list[dict]) -> list[dict]:
    """시작일·종류가 같은 큐레이션이 있으면 그 제목·배경, 없으면 auto 표시."""
    by = {(c["start"], c["kind"]): c for c in curated}
    for s in segs:
        c = by.get((s["start"], s["kind"]))
        if c:
            s.update(title=c["title"], drivers=list(c["drivers"]), source=c.get("source"), auto=False)
        else:
            s["auto"] = True
    return segs


RATE_TITLE = {"hike": "인상 사이클", "cut": "인하 사이클", "hold": "동결 국면"}
FX_TITLE = {"up": "원화 약세 국면", "down": "원화 강세 국면", "range": "박스권"}


def template_text(asset: str, seg: dict) -> dict:
    """AI가 없을 때 쓰는 데이터 기반 기본 문구(seg에는 from/to 등 계산값이 들어 있어야 한다)."""
    if asset == "rates":
        line = (f"기준금리 {seg['from']:.2f}% 유지" if seg["kind"] == "hold"
                else f"기준금리 {seg['from']:.2f} → {seg['to']:.2f}% ({seg['bp']:+.0f}bp, {seg['changes']}회)")
        return {"title": RATE_TITLE[seg["kind"]], "drivers": [line, "한국은행 기준금리 변경 이력으로 자동 감지"],
                "source": "데이터 기반 자동 감지"}
    return {"title": FX_TITLE[seg["kind"]],
            "drivers": [f"원/달러 {seg['from']:,.0f} → {seg['to']:,.0f}원 ({seg['chg_pct']:+.1f}%)",
                        f"고점·저점 대비 {int(FX_THRESHOLD * 100)}% 반전 기준으로 자동 감지"],
            "source": "데이터 기반 자동 감지"}


# ── AI 설명(DB 캐시) ─────────────────────────────────────────────────────────
def news_headlines(query: str, limit: int = 8) -> list[str]:
    try:
        url = f"https://news.google.com/rss/search?q={quote(query)}&hl=ko&gl=KR&ceid=KR:ko"
        r = requests.get(url, timeout=15, headers={"User-Agent": "Mozilla/5.0"})
        root = ElementTree.fromstring(r.content)
        return [t for t in (i.findtext("title") for i in root.iter("item")) if t][:limit]
    except Exception as e:
        logger.warning(f"news headlines failed: {type(e).__name__}")
        return []


# 국면 방향 설명과, 그 방향과 반대되는 말(AI가 헤드라인에 끌려 방향을 거꾸로 쓰는 것을 걸러낸다)
DIRECTION = {
    ("rates", "hike"): ("인상 국면(기준금리가 올라감)", ("인하", "완화", "피벗")),
    ("rates", "cut"): ("인하 국면(기준금리가 내려감)", ("인상", "긴축", "매파")),
    ("rates", "hold"): ("동결 국면(기준금리 유지)", ()),
    ("fx", "up"): ("원/달러 상승 = 원화 약세 국면", ("원화 강세", "환율 하락", "환율 급락")),
    ("fx", "down"): ("원/달러 하락 = 원화 강세 국면", ("원화 약세", "환율 상승", "환율 급등")),
    ("fx", "range"): ("박스권", ()),
}


def _prompt(asset: str, seg: dict, context: str, headlines: list[str]) -> str:
    name = "한국 기준금리" if asset == "rates" else "원/달러 환율"
    period = f"{seg['start']} ~ {seg['end'] or '현재(진행 중)'}"
    direction = DIRECTION[(asset, seg["kind"])][0]
    news = "\n".join(f"- {h}" for h in headlines) or "- (헤드라인 없음)"
    return f"""너는 한국 금융시장 애널리스트다. 아래 {name} 국면의 이름과 배경을 한국어로 쓴다.
기간: {period}
방향: {direction}
데이터: {context}
최근 뉴스 헤드라인:
{news}

규칙:
- 위 데이터와 헤드라인에 근거한 내용만 쓴다. 근거 없는 수치·사건·인물은 쓰지 않는다.
- 제목과 요인은 반드시 위 '방향'과 일치해야 한다. 이 방향과 무관하거나 반대인 헤드라인은 무시한다.
- title: 12자 안팎의 짧은 국면 이름(예: "환전 수급·금리차 축소").
- drivers: 이 국면을 만든 요인 2~3개, 각 30자 이내.
반드시 JSON만 반환: {{"title": "...", "drivers": ["...", "..."]}}"""


def valid_text(t: dict, asset: str | None = None, kind: str | None = None) -> dict | None:
    """형식 검사 + (asset·kind를 주면) 국면 방향과 반대되는 말이 제목·요인에 있으면 버린다."""
    title, drivers = t.get("title"), t.get("drivers")
    if not isinstance(title, str) or not title.strip() or len(title) > 24:
        return None
    if not isinstance(drivers, list) or not 1 <= len(drivers) <= 4 or not all(isinstance(x, str) and x.strip() for x in drivers):
        return None
    if asset and kind:
        text = " ".join([title, *drivers])
        if any(w in text for w in DIRECTION.get((asset, kind), ("", ()))[1]):
            return None
    return {"title": title.strip(), "drivers": [x.strip()[:60] for x in drivers]}


async def enrich_texts(asset: str, segs: list[dict], context_of, news_query: str, today: date) -> None:
    """auto 국면의 제목·배경을 채운다: DB 캐시 → Gemini(빌드당 최대 2건) → 기본 문구(이미 들어 있음).
    context_of(seg) -> str: 그 구간의 데이터 요약."""
    pending = [s for s in segs if s.get("auto")]
    if not pending:
        return
    try:
        from sqlalchemy import select

        from core.overview_cache import run_io
        from db.database import AsyncSessionLocal
        from db.models import SectorInsight
    except Exception as e:
        logger.warning(f"enrich_texts import failed: {e}")
        return
    api_key = os.environ.get("GEMINI_API_KEY")
    ai_budget = AI_MAX_PER_BUILD
    try:
        async with AsyncSessionLocal() as db:
            for s in pending:
                # 진행 중 국면은 끝나면 키가 바뀌어 전체 기간 기준으로 한 번 더 쓴다
                key = f"regime_ai:{asset}:{s['start']}:{s['kind']}:{s['end'] or 'open'}"
                row = (await db.execute(select(SectorInsight).where(SectorInsight.sector == key))).scalar_one_or_none()
                if row and row.content:
                    s.update(json.loads(row.content))
                    continue
                if not api_key or ai_budget <= 0 or time.time() - _ai_attempt.get(key, 0) < AI_RETRY_SEC:
                    continue
                ai_budget -= 1
                _ai_attempt[key] = time.time()
                end = date.fromisoformat(s["end"]) if s["end"] else today
                headlines = await run_io(news_headlines, news_query) if (today - end).days <= NEWS_RECENT_DAYS else []
                try:
                    from api.brazil_bond import _call_gemini_sync, _extract_json
                    raw = await run_io(_call_gemini_sync, api_key, _prompt(asset, s, context_of(s), headlines))
                    text = valid_text(_extract_json(raw), asset, s["kind"])
                except Exception as e:
                    logger.warning(f"regime AI text failed {key}: {type(e).__name__}")
                    text = None
                if not text:
                    continue
                text["source"] = f"AI 작성 · 뉴스 {len(headlines)}건" if headlines else "AI 작성 · 데이터 기반"
                db.add(SectorInsight(sector=key, content=json.dumps(text, ensure_ascii=False),
                                     generated_at=datetime.now(timezone.utc).replace(tzinfo=None)))
                await db.commit()
                s.update(text)
    except Exception as e:  # DB 미준비 등 — 기본 문구로 둔다
        logger.warning(f"enrich_texts failed: {type(e).__name__}: {e}")
