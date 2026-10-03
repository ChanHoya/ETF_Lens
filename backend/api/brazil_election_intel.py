"""브라질 대선 종합 인텔리전스 (Macro Timeline 대선 팝업 데이터 소스).

- GET  /election-intel            : 저장된 인텔리전스 조회(없으면 기본 시드). 하루 1회 AI 자동 갱신(수동 편집 직후 24h 보호).
- POST /election-intel/refresh    : 최신 뉴스 + 라이브 지표 기반 Gemini 갱신(1차 투표 결과·결선 판세·여론조사·이벤트 로그).
- PUT  /election-intel            : 수동 전체 저장 (X-Edit-Pin 헤더, env BRAZIL_EDIT_PIN 설정 시 필수).
- POST /election-intel/events     : 수동 이벤트 로그 1건 추가 (빠른 입력용).

저장소: SectorInsight(sector='brazil_election_intel').
"""
import asyncio
import copy
import json
import os
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import get_db
from db.models import SectorInsight

router = APIRouter()
_KST = timezone(timedelta(hours=9))
_SECTOR_KEY = "brazil_election_intel"

# ── 기본 시드 (2026-10-03 기준 조사 내용) ─────────────────────────────────────
DEFAULT_ELECTION_INTEL: dict = {
    "phase": "pre_first_round",  # pre_first_round | runoff_campaign | decided
    "as_of": "2026-10-03",
    "headline": "결선 진출 후보 확정 vs 부동층 16%의 표심 이동과 결선 투표율이 승부를 가르는 초박빙 선거전",
    "summary": "브라질 대통령선거 2차 투표(결선투표)는 2026년 10월 25일 일요일에 실시될 예정입니다. 다만 1차 투표가 10월 4일이므로, 어느 후보도 유효표 과반을 얻지 못할 경우에만 상위 2명이 결선에 진출합니다.",
    "schedule": [
        {"label": "1차 투표", "value": "2026년 10월 4일 (일)", "detail": "현지 08:00~17:00, 전자투표 기반으로 개표·당선 윤곽 신속 발표", "source": "aa.com"},
        {"label": "결선투표 (2차)", "value": "2026년 10월 25일 (일)", "detail": "1차에서 과반 미달 시 실시", "source": "aa.com · reuters"},
        {"label": "결선 조건", "value": "1차 유효표 과반(50%+1표) 득표자 부재", "detail": "", "source": "democrata"},
        {"label": "결선 진출자", "value": "1차 득표 1·2위 후보", "detail": "", "source": "democrata"},
        {"label": "승리 기준", "value": "결선 유효표 다수 득표", "detail": "백지·무효표 제외", "source": "democrata"},
        {"label": "투표 방식", "value": "전자투표 시스템 (Urna Eletrônica)", "detail": "", "source": "aa.com"},
    ],
    "candidates": [
        {"key": "lula", "name": "루이스 이나시우 룰라 다시우바", "party": "노동자당 (PT) · 현직", "color": "rose",
         "stance": "온건 좌파, 복지 확대 및 사회 재정 지출 우선",
         "economy": "포용적 성장, 빈곤층 지원(Bolsa Família), 국영 기업 역할 중시",
         "bond_impact": "재정 준칙 완화 우려로 금리 상방 압력 가능성. 단 BCB 독립성으로 시스템 리스크 방어선 존재"},
        {"key": "flavio", "name": "플라비우 보우소나루", "party": "자유당 (PL) · 상원의원", "color": "blue",
         "stance": "우파 보수 (자이르 보우소나루 전 대통령 장남·정치적 계승자)",
         "economy": "친기업·친시장, 민영화 추진, 공공 지출 축소 및 감세",
         "bond_impact": "재정 건전화 기대로 당선 시 금리 급락·헤알 강세 랠리 가능, 반면 정치적 대립 리스크"},
    ],
    "polls": [
        {"pollster": "Quaest", "date": "2026-09-28", "scope": "결선 가상대결", "margin": "±2.0%p",
         "lula": 42.0, "flavio": 42.0, "other": 16.0, "other_label": "부동층·무응답",
         "note": "두 후보 각각 42% 동률", "url": "https://valorinternational.globo.com/politics/news/2026/09/28/new-quaest-poll-shows-lula-and-flavio-tied-at-42percent-in-runoff.ghtml"},
        {"pollster": "AtlasIntel", "date": "2026-10-01", "scope": "결선 가상대결", "margin": "",
         "lula": 47.6, "flavio": 47.7, "other": 4.7, "other_label": "기타",
         "note": "0.1%p 차 사실상 동률", "url": "https://www.reuters.com/world/americas/brazil-vote-approaches-with-lula-and-bolsonaro-polling-close-race-2026-10-01/"},
    ],
    "first_round": None,   # {"status","lula_pct","flavio_pct","others_pct","turnout_pct","runoff":bool,"summary"}
    "runoff": None,        # {"status","lula_pct","flavio_pct","winner","summary"}
    "outlook": "현 시점에서는 '누가 결선에 진출하느냐'보다, 결선이 치러질 경우 부동층·군소후보 표의 이동과 투표율이 승부를 좌우하는 초접전 구도입니다.",
    "events": [
        {"date": "2026-09-28", "title": "Quaest 결선 가상대결 42% 동률", "detail": "표본오차 ±2%p 내 완전 동률"},
        {"date": "2026-10-01", "title": "AtlasIntel 47.6% vs 47.7%", "detail": "로이터: 룰라·보우소나루 초접전 속 투표 임박"},
    ],
    "bond_actions": [
        {"title": "1차 투표 직후 단기 변동성", "body": "결선 확정 시 포퓰리즘 공약 경쟁으로 10년물 금리가 일시적으로 14.5% 수준까지 스파이크할 가능성."},
        {"title": "바벨 포트폴리오 가이드", "body": "14.5% 어깨 고금리 도달 시 헤알 장기채(2033/2035) 50%로 확대해 고쿠폰 락인·자본차익 도모, 달러 장기채 20%로 환율 완충."},
        {"title": "중앙은행 독립성 방파제", "body": "2021년 법제화된 BCB 자율성(LC 179)으로 무분별한 금리 인하·시스템 붕괴(Worst)는 제도적으로 제한."},
    ],
    "sources": [
        {"label": "Reuters (2026.10.01)", "url": "https://www.reuters.com/world/americas/brazil-vote-approaches-with-lula-and-bolsonaro-polling-close-race-2026-10-01/"},
        {"label": "Anadolu Agency Explainer", "url": "https://www.aa.com.tr/en/politics/explainer-what-to-know-about-brazils-2026-presidential-election/4074737"},
        {"label": "Valor Econômico (Quaest)", "url": "https://valorinternational.globo.com/politics/news/2026/09/28/new-quaest-poll-shows-lula-and-flavio-tied-at-42percent-in-runoff.ghtml"},
        {"label": "연합뉴스 (2026.09.29)", "url": "https://www.yna.co.kr/view/AKR20260929001400087"},
        {"label": "Democrata Polls Center", "url": "https://www.democrata.es/en/center-of-surveys-and-electoral-polls/surveys-brazil-elections-lula-leads-bolsonaro-in-the-first-round-but-the-result-evens-out-in-the-second/"},
    ],
}

_LIST_KEYS = ("schedule", "candidates", "polls", "events", "bond_actions", "sources")
_TEXT_KEYS = ("phase", "as_of", "headline", "summary", "outlook")
_VALID_PHASES = {"pre_first_round", "runoff_campaign", "decided"}


class IntelResponse(BaseModel):
    content: dict
    generated_at: str | None = None
    source: str = "default"  # default | ai | manual
    updated_count: int | None = None


class IntelEvent(BaseModel):
    date: str
    title: str
    detail: str = ""


# ── 정규화 & 병합 ───────────────────────────────────────────────────────────
def normalize_intel(raw: dict | None) -> dict:
    """저장/AI/수동 입력을 안전한 스키마로 정규화 (누락 키는 기본값으로 보강)."""
    base = copy.deepcopy(DEFAULT_ELECTION_INTEL)
    if not isinstance(raw, dict):
        return base
    for k in _TEXT_KEYS:
        v = raw.get(k)
        if isinstance(v, str) and v.strip():
            base[k] = v.strip()
    if base["phase"] not in _VALID_PHASES:
        base["phase"] = "pre_first_round"
    for k in _LIST_KEYS:
        v = raw.get(k)
        if isinstance(v, list):
            base[k] = [x for x in v if isinstance(x, dict)]
    for k in ("first_round", "runoff"):
        v = raw.get(k)
        base[k] = v if isinstance(v, dict) and v else None
    # 여론조사 수치 float 보정
    for p in base["polls"]:
        for nk in ("lula", "flavio", "other"):
            try:
                p[nk] = float(p.get(nk)) if p.get(nk) is not None else None
            except (TypeError, ValueError):
                p[nk] = None
    base["events"] = sorted(base["events"], key=lambda e: str(e.get("date", "")))
    return base


def merge_ai_patch(current: dict, patch: dict) -> dict:
    """AI 응답은 '변경분'만 반영. 여론조사/이벤트/출처는 기존 목록에 신규 항목만 추가(중복 제거)."""
    merged = copy.deepcopy(current)
    if not isinstance(patch, dict):
        return merged
    for k in ("phase", "headline", "summary", "outlook"):
        v = patch.get(k)
        if isinstance(v, str) and v.strip():
            merged[k] = v.strip()
    for k in ("first_round", "runoff"):
        v = patch.get(k)
        if isinstance(v, dict) and v:
            merged[k] = {**(merged.get(k) or {}), **v}
    if isinstance(patch.get("bond_actions"), list) and patch["bond_actions"]:
        merged["bond_actions"] = [x for x in patch["bond_actions"] if isinstance(x, dict)][:5]

    def _append_unique(key: str, ident):
        existing = merged.get(key) or []
        seen = {ident(x) for x in existing}
        for item in patch.get(key) or []:
            if isinstance(item, dict) and ident(item) not in seen:
                existing.append(item)
                seen.add(ident(item))
        merged[key] = existing

    _append_unique("polls", lambda p: (str(p.get("pollster", "")).lower(), str(p.get("date", ""))))
    _append_unique("events", lambda e: (str(e.get("date", "")), str(e.get("title", ""))[:20]))
    _append_unique("sources", lambda s: str(s.get("url", "")))
    merged["as_of"] = datetime.now(_KST).date().isoformat()
    return normalize_intel(merged)


# ── 영속화 ──────────────────────────────────────────────────────────────────
async def _load_row(db: AsyncSession):
    return (await db.execute(select(SectorInsight).where(SectorInsight.sector == _SECTOR_KEY))).scalar_one_or_none()


def _unpack(row) -> tuple[dict, str]:
    """row.content = {"source": ..., "intel": {...}}"""
    if not row or not row.content:
        return normalize_intel(None), "default"
    try:
        obj = json.loads(row.content)
        if isinstance(obj, dict) and "intel" in obj:
            return normalize_intel(obj["intel"]), obj.get("source", "ai")
        return normalize_intel(obj), "ai"
    except Exception:
        return normalize_intel(None), "default"


async def _save(db: AsyncSession, intel: dict, source: str) -> datetime:
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    payload = json.dumps({"source": source, "intel": intel}, ensure_ascii=False)
    row = await _load_row(db)
    if row:
        row.content = payload
        row.generated_at = now
    else:
        db.add(SectorInsight(sector=_SECTOR_KEY, content=payload, generated_at=now))
    await db.commit()
    return now


def _iso(dt: datetime | None) -> str | None:
    if not dt:
        return None
    return dt.replace(tzinfo=timezone.utc).isoformat()


def _check_pin(pin: str | None):
    expected = os.environ.get("BRAZIL_EDIT_PIN")
    if expected and pin != expected:
        raise HTTPException(status_code=401, detail="편집 PIN이 올바르지 않습니다.")


def should_auto_refresh(generated_at: datetime | None, source: str, now: datetime | None = None) -> bool:
    """하루 1회 자동 갱신. 수동 편집본은 24시간 동안 AI가 덮어쓰지 않음."""
    if not generated_at:
        return True
    now = now or datetime.now(timezone.utc).replace(tzinfo=None)
    age = now - generated_at
    if source == "manual":
        return age > timedelta(hours=24)
    gen_kst = generated_at.replace(tzinfo=timezone.utc).astimezone(_KST).date()
    return gen_kst != now.replace(tzinfo=timezone.utc).astimezone(_KST).date()


# ── AI 갱신 ─────────────────────────────────────────────────────────────────
def _build_refresh_prompt(current: dict, news: list[dict], ctx: str) -> str:
    today = datetime.now(_KST).strftime("%Y-%m-%d")
    news_text = "\n".join(
        f"- [{n.get('published', '')}] {n.get('title', '')} ({n.get('source', '')}) {n.get('link', '')}" for n in news
    ) or "- (수집된 뉴스 없음)"
    slim = {k: current.get(k) for k in ("phase", "headline", "first_round", "runoff", "outlook")}
    slim["latest_polls"] = current.get("polls", [])[-3:]
    slim["latest_events"] = current.get("events", [])[-5:]
    return f"""너는 브라질 정치·국채 전문 스트래티지스트다. 오늘은 {today} (KST).
브라질 대선 일정: 1차 투표 2026-10-04(일, 현지), 결선 2026-10-25(일, 현지). 후보 키: lula(룰라, PT), flavio(플라비우 보우소나루, PL).

[현재 저장된 대선 인텔리전스 요약]
{json.dumps(slim, ensure_ascii=False)}

[라이브 시장 지표]
{ctx}

[최신 뉴스 헤드라인]
{news_text}

임무: 위 뉴스에 근거해 대선 인텔리전스를 '변경분'만 갱신하라.
규칙(엄수):
1. 뉴스에 명시되지 않은 득표율·여론조사 수치는 절대 지어내지 마라. 근거가 없으면 해당 키를 생략하라.
2. 1차 투표 개표 결과가 뉴스에 있으면 first_round 를 채우고, 결선 확정 시 phase="runoff_campaign". 당선 확정 시 runoff 와 phase="decided".
3. 신규 여론조사는 polls 에, 의미 있는 신규 사건(개표, 지지 선언, 토론, 시장 급변 등)은 events 에 추가. 이미 저장된 항목은 반복하지 마라.
4. bond_actions 는 현 국면에 맞춘 브라질 국채 투자자 액션 3개(제목+1~2문장). 금리 14.5% 어깨·바벨(장기50/중기30/달러20)·BCB 독립성 원칙 유지.
5. 한국어, 간결·분석 톤. 투자 권유 아님.

아래 JSON만 출력(코드펜스/설명 금지, 불필요한 키 생략 가능):
{{
  "phase": "pre_first_round|runoff_campaign|decided",
  "headline": "핵심 한 줄",
  "summary": "현 국면 요약 2~3문장",
  "outlook": "판세 전망 1~2문장",
  "first_round": {{"status": "개표 완료|개표 중", "lula_pct": 0.0, "flavio_pct": 0.0, "others_pct": 0.0, "turnout_pct": 0.0, "runoff": true, "summary": "1~2문장"}},
  "runoff": {{"status": "...", "lula_pct": 0.0, "flavio_pct": 0.0, "winner": "lula|flavio", "summary": "..."}},
  "polls": [{{"pollster": "", "date": "YYYY-MM-DD", "scope": "결선 가상대결", "margin": "", "lula": 0.0, "flavio": 0.0, "other": 0.0, "other_label": "기타", "note": "", "url": ""}}],
  "events": [{{"date": "YYYY-MM-DD", "title": "", "detail": ""}}],
  "bond_actions": [{{"title": "", "body": ""}}],
  "sources": [{{"label": "", "url": ""}}]
}}"""


async def _ai_refresh(db: AsyncSession, current: dict) -> tuple[dict, int]:
    from api.brazil_bond import _call_gemini_sync, _extract_json, _build_live_ctx

    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY가 설정되지 않았습니다. 수동 편집을 이용해 주세요.")

    news: list[dict] = []
    try:
        from core.brazil_news import sync_brazil_news, get_recent_news
        try:
            await sync_brazil_news(alert_new=False)
        except Exception as e:
            print(f"[election_intel] news sync failed: {e}")
        news = await get_recent_news(15)
    except Exception as e:
        print(f"[election_intel] news load failed: {e}")

    ctx = await _build_live_ctx(db)
    prompt = _build_refresh_prompt(current, news, ctx)
    raw = await asyncio.to_thread(_call_gemini_sync, api_key, prompt)
    patch = _extract_json(raw)
    merged = merge_ai_patch(current, patch)
    changed = sum(1 for k in ("phase", "headline", "first_round", "runoff") if merged.get(k) != current.get(k))
    changed += len(merged["polls"]) - len(current["polls"]) + len(merged["events"]) - len(current["events"])
    return merged, max(changed, 0)


# ── 엔드포인트 ──────────────────────────────────────────────────────────────
@router.get("/election-intel", response_model=IntelResponse)
async def get_election_intel(auto_refresh: bool = True, db: AsyncSession = Depends(get_db)):
    row = await _load_row(db)
    intel, source = _unpack(row)
    gen_at = row.generated_at if row else None
    if auto_refresh and os.environ.get("GEMINI_API_KEY") and should_auto_refresh(gen_at, source):
        try:
            merged, n = await _ai_refresh(db, intel)
            saved = await _save(db, merged, "ai")
            return IntelResponse(content=merged, generated_at=_iso(saved), source="ai", updated_count=n)
        except Exception as e:
            print(f"[election_intel] auto refresh failed: {e}")
    return IntelResponse(content=intel, generated_at=_iso(gen_at), source=source)


@router.post("/election-intel/refresh", response_model=IntelResponse)
async def refresh_election_intel(db: AsyncSession = Depends(get_db)):
    intel, _ = _unpack(await _load_row(db))
    try:
        merged, n = await _ai_refresh(db, intel)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI 갱신 실패: {str(e)[:200]}")
    saved = await _save(db, merged, "ai")
    return IntelResponse(content=merged, generated_at=_iso(saved), source="ai", updated_count=n)


@router.put("/election-intel", response_model=IntelResponse)
async def save_election_intel(body: dict, x_edit_pin: str | None = Header(default=None), db: AsyncSession = Depends(get_db)):
    _check_pin(x_edit_pin)
    intel = normalize_intel(body.get("content", body))
    intel["as_of"] = datetime.now(_KST).date().isoformat()
    saved = await _save(db, intel, "manual")
    return IntelResponse(content=intel, generated_at=_iso(saved), source="manual")


@router.post("/election-intel/events", response_model=IntelResponse)
async def add_election_event(ev: IntelEvent, x_edit_pin: str | None = Header(default=None), db: AsyncSession = Depends(get_db)):
    _check_pin(x_edit_pin)
    intel, _ = _unpack(await _load_row(db))
    intel["events"].append(ev.model_dump())
    intel = normalize_intel(intel)
    saved = await _save(db, intel, "manual")
    return IntelResponse(content=intel, generated_at=_iso(saved), source="manual")


@router.post("/election-intel/reset", response_model=IntelResponse)
async def reset_election_intel(x_edit_pin: str | None = Header(default=None), db: AsyncSession = Depends(get_db)):
    _check_pin(x_edit_pin)
    intel = normalize_intel(None)
    saved = await _save(db, intel, "manual")
    return IntelResponse(content=intel, generated_at=_iso(saved), source="manual")
