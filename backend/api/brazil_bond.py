# 브라질 국채 대시보드·Activation Zone 신호·AI 전략 리포트를 제공하는 API 라우터
"""
플레이북(docs/brazil-bond-playbook.md)의 규칙을 코드화한다.
- 신호 엔진: 2축 Activation Zone (5년물 국채금리 × 원/헤알 환율).
- 스코어보드: Selic·5Y·BRL/KRW·IPCA 현재값 + 신호등.
- 캐리 쿠션: 만기 환율별 원화 누적수익 곡선(시뮬레이터 기준).
- 캘린더: Copom(8/4~5)·대선(10/4)·금통위(7/16) D-day.
- AI 리포트: Gemini 로 라이브 지표 + 플레이북 그라운딩 생성, SectorInsight(sector='brazil_bond')에 캐시.
"""

import asyncio
import json
import os
import re
from datetime import datetime, date, timezone, timedelta

from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import get_db
from db.models import BrazilSeries, SectorInsight

_current_dir = os.path.dirname(os.path.abspath(__file__))
load_dotenv(dotenv_path=os.path.join(_current_dir, "..", ".env"), override=True)

router = APIRouter()
_KST = timezone(timedelta(hours=9))

# ── 플레이북 임계값 (Activation Zone) ────────────────────────────────────────
RATE_FLOOR = 14.2      # 금리 조건 하한 (14.2%↑)
RATE_TRANCHE2 = 14.7   # 적극 매수(Tranche 2) 진입 금리
RATE_RISK = 15.0       # 초과 시 리스크 재평가
FX_TARGET = 290.0      # 환율 조건 (290원↓)

# ── 하반기 매크로 캘린더 (2026, 고정 일정) ───────────────────────────────────
CATALYSTS = [
    {"date": "2026-07-16", "key": "bok", "title": "한국은행 금통위",
     "note": "인상 기대감 → 원화 강세 모멘텀 → 원/헤알 290원 하회 트리거", "impact": "fx"},
    {"date": "2026-08-05", "key": "copom_aug", "title": "브라질 Copom (8월)",
     "note": "6월 물가 서프라이즈로 금리 인하 접전. 5년물 14% 이탈 여부 결정", "impact": "rate"},
    {"date": "2026-10-04", "key": "election", "title": "브라질 대선 1차 투표",
     "note": "재정 포퓰리즘·정치 노이즈. 헤알 급락·금리 15% 터치 등 최대 변동성 (Binary Event)", "impact": "both"},
    {"date": "2026-09-16", "key": "copom_sep", "title": "브라질 Copom (9월)",
     "note": "BCB 공식 캘린더", "impact": "rate"},
    {"date": "2026-11-04", "key": "copom_nov", "title": "브라질 Copom (11월)",
     "note": "BCB 공식 캘린더", "impact": "rate"},
    {"date": "2026-12-09", "key": "copom_dec", "title": "브라질 Copom (12월)",
     "note": "BCB 공식 캘린더", "impact": "rate"},
]

# ── 8월 Copom 시나리오별 대응 (플레이북 §5) ──────────────────────────────────
AUG_SCENARIOS = [
    {"id": "A", "title": "25bp 인하 + 신중 문구", "color": "green",
     "logic": "단기물 하락, 5년물 14% 하향 이탈 초입. 캐리 축소로 290원 하회 확률↑",
     "action": "14.0~14.4% + 290원 이하 동시 충족 창 오픈 시 1·2차 트랜치 즉각 집행"},
    {"id": "B", "title": "동결 + 매파 유지", "color": "amber",
     "logic": "고캐리 유지로 헤알 강세. 5년물 14.5% 이상 견고 유지",
     "action": "환율 290원 이탈 대기. 금리 15% 재접근 시 역발상 1차 소량 진입"},
    {"id": "C", "title": "50bp 인하 (테일 리스크)", "color": "red",
     "logic": "중앙은행 신뢰 훼손. 장기금리 역설적 폭등, 헤알화 급락 가능성",
     "action": "매수 전면 보류 및 관망"},
]

# ── 3단계 분할 매수 로드맵 (플레이북 §6) ─────────────────────────────────────
TRANCHES = [
    {"id": 1, "weight": "목표 20~30%", "timing": "현재~7월 말",
     "trigger": "환율 290원 하향 돌파 시", "rationale": "금리 조건(14.2%↑) 선충족분 활용, 인하 시 자본차익 논리"},
    {"id": 2, "weight": "누적 50~60%", "timing": "8월 초 (Copom 후)",
     "trigger": "시나리오 A 창 오픈 시", "rationale": "금리·환율 동시 충족 창에서 즉각 집행"},
    {"id": 3, "weight": "잔여 40%", "timing": "10월 대선 전후",
     "trigger": "대선 변동성 투매(헤알 급락·금리 15% 접근) 시", "rationale": "공포 역이용 평단가 극강 인하, 선거 종료 후 불확실성 해소 노림"},
]

# ── 실행 전 최종 체크리스트 (플레이북 §8) ────────────────────────────────────
DUE_DILIGENCE = [
    {"title": "투자 방식 (Wrapper)", "body": "직접 매수인가? ETF/펀드 우회 시 비과세 혜택 상실 및 배당소득 과세 전환. 조세조약 혜택은 직접 매수 시 극대화."},
    {"title": "현지 금융거래세 (IOF)", "body": "증권사에 IOF 현행 부과 여부 확인. 제도 변경 잦음 — 2년 내 중도 환매 시 세금 0% 여부 구두 확인 필수."},
    {"title": "숨은 비용 (Spread & Fees)", "body": "이중 환전 스프레드(원→달러→헤알) + 선취수수료 감안한 실매수 YTM이 14.2% 타겟에 부합하는가?"},
    {"title": "유동성 (Liquidity)", "body": "단기 6~12개월 필요 자금인가? 비상장 직접 채권은 유동성 매우 제한적 → 만기 보유 혹은 최소 3년 이상 인내 필수."},
]


# ══════════════════════════════════════════════════════════════════════════
# 신호 엔진 (순수 함수 — 유닛 테스트 대상)
# ══════════════════════════════════════════════════════════════════════════
def compute_signal(y5: float | None, fx: float | None) -> dict:
    """플레이북 Activation Zone(2축) 판정.
    반환: zone / grade / color / rate_ok / fx_ok / headline / action."""
    rate_ok = y5 is not None and y5 >= RATE_FLOOR
    fx_ok = fx is not None and fx <= FX_TARGET

    if y5 is None or fx is None:
        return {"zone": "UNKNOWN", "grade": "데이터 부족", "color": "gray",
                "rate_ok": rate_ok, "fx_ok": fx_ok,
                "headline": "금리 또는 환율 데이터를 불러오지 못했습니다.",
                "action": "데이터 갱신 후 재확인"}

    if y5 > RATE_RISK:
        return {"zone": "RISK_REASSESS", "grade": "리스크 재평가", "color": "red",
                "rate_ok": rate_ok, "fx_ok": fx_ok,
                "headline": f"5년물 {y5:.2f}% > 15.0% — 시장이 선거/재정 리스크를 가격에 반영 중.",
                "action": "매수 전 펀더멘털 훼손(선거·재정) 여부 필수 확인. 신규 진입 신중."}

    if rate_ok and fx_ok:
        if y5 >= RATE_TRANCHE2:
            return {"zone": "TRANCHE2", "grade": "적극 매수 구간", "color": "green",
                    "rate_ok": True, "fx_ok": True,
                    "headline": f"금리 {y5:.2f}% (≥14.7%) · 환율 {fx:.1f}원 (≤290원) — 황금 교차 구간.",
                    "action": "2차 추가 매수 후보. 금리·환율 조건 동시 충족 창에서 트랜치 집행."}
        return {"zone": "TRANCHE1", "grade": "1차 진입 활성화", "color": "green",
                "rate_ok": True, "fx_ok": True,
                "headline": f"금리 {y5:.2f}% (≥14.2%) · 환율 {fx:.1f}원 (≤290원) — 진입 조건 충족.",
                "action": "1차 분할 매수 활성화. 일시납 금지, 목표 비중의 일부만."}

    # 조건 미충족 → 관망
    miss = []
    if not rate_ok:
        miss.append(f"금리 {y5:.2f}% < 14.2%")
    if not fx_ok:
        miss.append(f"환율 {fx:.1f}원 > 290원")
    return {"zone": "WATCH", "grade": "관망 / 차익실현", "color": "gray",
            "rate_ok": rate_ok, "fx_ok": fx_ok,
            "headline": "진입 조건 미충족: " + ", ".join(miss) + ".",
            "action": "신규 진입 보류. 두 조건 동시 충족(14.2%↑ & 290원↓)까지 대기."}


def _gauge(metric: str, v: float | None) -> str:
    """스코어보드 카드 신호등(green/amber/red/gray). 값 없으면 gray."""
    if v is None:
        return "gray"
    if metric == "y5":
        if v > RATE_RISK:
            return "red"
        return "green" if v >= RATE_FLOOR else "amber"
    if metric == "brl_krw":
        if v <= FX_TARGET:
            return "green"
        return "amber" if v <= 300 else "red"
    if metric == "selic":
        return "amber"  # 인하 사이클 진행 = 중립 컨텍스트
    if metric == "ipca_mom":
        return "green" if v < 0.35 else ("amber" if v < 0.6 else "red")
    if metric == "real_rate":
        return "green" if v >= 8.0 else ("amber" if v >= 5.0 else "red")
    return "gray"


def carry_cushion_curve(entry_fx: float = 294.0, mult: float = 1.955) -> list[dict]:
    """캐리 쿠션 곡선: 만기 환율별 원화 누적수익(5년, YTM 재투자 가정).
    누적배수 = mult, 손익분기 환율 = entry_fx / mult. (플레이북 §3·§10)"""
    breakeven = entry_fx / mult
    pts = []
    for fx_end in [entry_fx, 280, 270, 250, 230, 210, 190, round(breakeven, 1)]:
        fx_chg = (fx_end / entry_fx - 1) * 100
        total = (mult * (fx_end / entry_fx) - 1) * 100  # 원화 누적수익 %
        cagr = ((1 + total / 100) ** (1 / 5) - 1) * 100
        pts.append({
            "fx_end": fx_end,
            "fx_change_pct": round(fx_chg, 1),
            "total_return_pct": round(total, 1),
            "cagr_pct": round(cagr, 1),
            "is_breakeven": abs(fx_end - breakeven) < 0.5,
        })
    return pts


def _d_day(target_iso: str, today: date) -> int:
    """target 까지 남은 일수(음수면 경과)."""
    return (date.fromisoformat(target_iso) - today).days


# ══════════════════════════════════════════════════════════════════════════
# DB 조회 헬퍼
# ══════════════════════════════════════════════════════════════════════════
async def _latest(db: AsyncSession, key: str) -> tuple[str | None, float | None, float | None]:
    """(date, value, prev_value) 최신 2점."""
    rows = (await db.execute(
        select(BrazilSeries.date, BrazilSeries.value)
        .where(BrazilSeries.series_key == key)
        .order_by(BrazilSeries.date.desc()).limit(2)
    )).all()
    if not rows:
        return None, None, None
    d, v = rows[0]
    prev = rows[1][1] if len(rows) > 1 else None
    return d, v, prev


# ══════════════════════════════════════════════════════════════════════════
# 엔드포인트
# ══════════════════════════════════════════════════════════════════════════
@router.get("/summary")
async def get_summary(db: AsyncSession = Depends(get_db)):
    """스코어보드 지표 + Activation Zone 신호 + 캘린더/시나리오/캐리쿠션 종합."""
    keys = ["selic_target", "y5", "brl_krw", "usd_brl",
            "ipca_mom", "ipca_12m", "focus_selic_eoy", "focus_ipca_eoy", "focus_usdbrl_eoy"]
    data = {k: await _latest(db, k) for k in keys}

    def cur(k):
        return data[k][1]

    def _ind(k, label, unit, metric=None):
        d, v, prev = data[k]
        chg = (round(v - prev, 4) if (v is not None and prev is not None) else None)
        return {"key": k, "label": label, "unit": unit, "date": d,
                "value": v, "prev": prev, "change": chg,
                "gauge": _gauge(metric or k, v)}

    selic = cur("selic_target")
    ipca12 = cur("ipca_12m")
    real_rate = round(selic - ipca12, 2) if (selic is not None and ipca12 is not None) else None
    y5, fx = cur("y5"), cur("brl_krw")

    signal = compute_signal(y5, fx)

    today = datetime.now(_KST).date()
    timeline = sorted(
        [{**c, "d_day": _d_day(c["date"], today)} for c in CATALYSTS],
        key=lambda x: x["date"],
    )
    upcoming = [c for c in timeline if c["d_day"] >= 0]

    indicators = [
        _ind("selic_target", "기준금리 (Selic)", "%", "selic"),
        _ind("y5", "5년물 국채금리", "%", "y5"),
        _ind("brl_krw", "원/헤알 (BRL/KRW)", "원", "brl_krw"),
        _ind("ipca_mom", "6월 물가 (IPCA m/m)", "%", "ipca_mom"),
    ]

    return {
        "as_of": max([d for d, _, _ in data.values() if d] or [today.isoformat()]),
        "indicators": indicators,
        "real_rate": {"label": "실질금리 (Selic−IPCA)", "unit": "%p",
                      "value": real_rate, "gauge": _gauge("real_rate", real_rate)},
        "focus": {
            "selic_eoy": cur("focus_selic_eoy"),
            "ipca_eoy": cur("focus_ipca_eoy"),
            "usdbrl_eoy": cur("focus_usdbrl_eoy"),
        },
        "signal": signal,
        "targets": {"rate_floor": RATE_FLOOR, "rate_tranche2": RATE_TRANCHE2,
                    "rate_risk": RATE_RISK, "fx_target": FX_TARGET},
        "carry_cushion": carry_cushion_curve(entry_fx=fx if fx else 294.0),
        "timeline": timeline,
        "next_catalyst": upcoming[0] if upcoming else None,
        "aug_scenarios": AUG_SCENARIOS,
        "tranches": TRANCHES,
        "due_diligence": DUE_DILIGENCE,
    }


@router.post("/sync")
async def trigger_sync():
    """수동 동기화 트리거 + 진단. 시리즈별 upsert 건수를 반환한다(-1=실패).
    신규 배포 직후 데이터 적재 및 소스별 접근성 확인용."""
    from core.brazil_fetcher import sync_brazil_series
    result = await sync_brazil_series()
    return {"synced_at": datetime.now(_KST).isoformat(), "counts": result}


@router.get("/news")
async def get_news(refresh: bool = True, limit: int = 12):
    """브라질 국채 관련 최신 뉴스(Google News RSS). refresh=True면 라이브 수집 후 저장."""
    from core.brazil_news import sync_brazil_news, get_recent_news
    if refresh:
        try:
            await sync_brazil_news(alert_new=False)
        except Exception as e:
            print(f"[brazil_bond] news refresh failed: {e}")
    items = await get_recent_news(limit)
    return {"items": items}


@router.get("/history")
async def get_history(series: str, years: int = 10, db: AsyncSession = Depends(get_db)):
    """차트용 시계열. series=쉼표구분 key. 예: series=selic_target,y5,ipca_12m."""
    keys = [s.strip() for s in series.split(",") if s.strip()]
    cutoff = (datetime.now(_KST) - timedelta(days=365 * years)).strftime("%Y-%m-%d")
    out: dict[str, list] = {}
    for k in keys:
        rows = (await db.execute(
            select(BrazilSeries.date, BrazilSeries.value)
            .where(BrazilSeries.series_key == k, BrazilSeries.date >= cutoff)
            .order_by(BrazilSeries.date.asc())
        )).all()
        out[k] = [{"date": d, "value": v} for d, v in rows]
    return {"series": out}


# ══════════════════════════════════════════════════════════════════════════
# AI 전략 리포트 (Gemini) — sector_insight 패턴 복제, 브라질 전용 스키마
# ══════════════════════════════════════════════════════════════════════════
_GEMINI_MODELS = ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.0-flash", "gemini-2.0-flash-lite"]

_BR_SCHEMA_HINT = """반드시 아래 JSON 스키마만 출력하라(코드펜스/설명 금지):
{
  "verdict": {"grade": "한줄 종합 판정", "summary": "2~3문장 핵심 요약"},
  "analysis": {"cards": [{"title": "소제목(15자 내외)", "body": "2~3문장 분석"}]},   // 3개: 금리사이클 / 환율밸류에이션 / 리스크
  "strategy": {
    "entry": "진입 기준 1~2문장 (14.2%↑ & 290원↓ 조건 관점)",
    "hold": "보유 전략 1~2문장 (캐리 쿠션·듀레이션 관점)",
    "exit": "청산/출구 룰 1~2문장"
  },
  "execution_checklist": ["실행 체크 3~4개"],
  "risk_footnote": "최대 리스크(10월 대선 Binary Event 등) 한 줄"
}"""


def _build_br_prompt(ctx: str) -> str:
    today = datetime.now(_KST).strftime("%Y년 %m월 %d일")
    return f"""너는 브라질 국채(헤알화 표시)를 담당하는 냉철한 이머징 채권 애널리스트다. 오늘은 {today}.
아래는 라이브 매크로 지표와 우리 하우스 플레이북 프레임워크다. 이 프레임워크의 규칙을 최우선 근거로 삼아라.

[플레이북 핵심 규칙]
- 결론: 조건부 분할 매수(일시납 절대 금지). 목표 진입 = 5년물 14.2%↑ AND 원/헤알 290원↓ 동시 충족(황금 교차).
- Activation Zone: 금리 14.2~14.7%+환율≤290 → 1차 진입 / 14.7~15.0%+환율≤290 → 적극매수 / 금리>15.0% → 리스크 재평가.
- 캐리 쿠션: 5년 보유 시 헤알화 -48.8%(반토막) 전까지 원금 손실 없음.
- 최대 리스크: 10월 4일 브라질 대선(Binary Event). 8/4~5 Copom, 7/16 한국 금통위가 핵심 관전.
- 비중: 유동자산 5~10% 위성 포지션. 만기 3~5년 스위트스팟. 직접 매수 시 조세협약 비과세.

[라이브 지표]
{ctx}

지금 지표가 Activation Zone 어디에 있는지 판정하고, 진입/보유/청산 전략과 실행 체크리스트를 제시하라.
막연한 낙관 금지. 수치를 인용해 근거를 대라. 한국어, 투자 권유가 아닌 분석/교육 톤, 간결하게.

{_BR_SCHEMA_HINT}"""


def _call_gemini_sync(api_key: str, prompt: str) -> str:
    from google import genai
    client = genai.Client(api_key=api_key)
    last_err = None
    for model_name in _GEMINI_MODELS:
        try:
            return client.models.generate_content(model=model_name, contents=prompt).text
        except Exception as e:
            if "429" in str(e) or "quota" in str(e).lower():
                last_err = e
                continue
            raise e
    raise last_err or RuntimeError("Gemini 호출에 실패했습니다.")


def _extract_json(text: str) -> dict:
    t = re.sub(r"^```(?:json)?\s*|\s*```$", "", text.strip()).strip()
    try:
        return json.loads(t)
    except Exception:
        m = re.search(r"\{.*\}", t, re.DOTALL)
        if not m:
            raise ValueError("Gemini 응답에서 JSON을 찾지 못했습니다.")
        return json.loads(m.group(0))


async def _build_live_ctx(db: AsyncSession) -> str:
    keys = {"selic_target": "기준금리 Selic(%)", "y5": "5년물 국채금리(%)",
            "brl_krw": "원/헤알 환율(원)", "usd_brl": "USD/BRL",
            "ipca_mom": "6월 IPCA 월간(%)", "ipca_12m": "IPCA 12개월 누적(%)",
            "focus_selic_eoy": "Focus 연말 Selic 컨센서스(%)",
            "focus_ipca_eoy": "Focus 연말 IPCA 컨센서스(%)"}
    lines = ["[대표 지표 라이브]"]
    vals = {}
    for k, lab in keys.items():
        _, v, _ = await _latest(db, k)
        vals[k] = v
        lines.append(f"- {lab}: {v}")
    if vals.get("selic_target") and vals.get("ipca_12m"):
        lines.append(f"- 실질금리(Selic−IPCA12M): {round(vals['selic_target']-vals['ipca_12m'],2)}%p")
    sig = compute_signal(vals.get("y5"), vals.get("brl_krw"))
    lines.append(f"- 현재 Activation Zone 판정: {sig['grade']} — {sig['headline']}")
    return "\n".join(lines)


class InsightResponse(BaseModel):
    content: dict | None = None
    generated_at: str | None = None


@router.get("/insight", response_model=InsightResponse)
async def get_insight(db: AsyncSession = Depends(get_db)):
    row = (await db.execute(
        select(SectorInsight).where(SectorInsight.sector == "brazil_bond")
    )).scalar_one_or_none()
    if not row or not row.content:
        return InsightResponse(content=None, generated_at=None)
    try:
        content = json.loads(row.content)
    except Exception:
        content = None
    return InsightResponse(content=content,
                           generated_at=row.generated_at.isoformat() if row.generated_at else None)


@router.post("/insight/generate", response_model=InsightResponse)
async def generate_insight(db: AsyncSession = Depends(get_db)):
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY가 설정되지 않았습니다.")

    ctx = await _build_live_ctx(db)
    prompt = _build_br_prompt(ctx)
    try:
        raw = await asyncio.to_thread(_call_gemini_sync, api_key, prompt)
        content = _extract_json(raw)
    except Exception as e:
        print(f"[brazil_bond] generate error: {e}")
        raise HTTPException(status_code=500, detail=f"리포트 생성 중 오류: {str(e)[:200]}")

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    row = (await db.execute(
        select(SectorInsight).where(SectorInsight.sector == "brazil_bond")
    )).scalar_one_or_none()
    payload = json.dumps(content, ensure_ascii=False)
    if row:
        row.content = payload
        row.generated_at = now
    else:
        db.add(SectorInsight(sector="brazil_bond", content=payload, generated_at=now))
    await db.commit()
    return InsightResponse(content=content, generated_at=now.isoformat())


# ══════════════════════════════════════════════════════════════════════════
# 신호 전환 알림 (스케줄러가 호출) — 등급 변경·임박 캘린더 텔레그램 발송
# ══════════════════════════════════════════════════════════════════════════
async def check_brazil_signal_and_alert():
    """Activation Zone 등급이 직전 저장분과 달라졌거나 핵심 캘린더 D-1/D-day면 알림."""
    from core.notifier import send_telegram_message
    from db.database import AsyncSessionLocal

    async with AsyncSessionLocal() as db:
        _, y5, _ = await _latest(db, "y5")
        _, fx, _ = await _latest(db, "brl_krw")
        sig = compute_signal(y5, fx)

        # 직전 신호 등급을 BrazilSeries 에 문자열 대신 별도 저장하기보다,
        # SectorInsight(sector='brazil_signal_state') 재사용해 마지막 zone 기록.
        state = (await db.execute(
            select(SectorInsight).where(SectorInsight.sector == "brazil_signal_state")
        )).scalar_one_or_none()
        prev_zone = state.content if state else None

        today = datetime.now(_KST).date()
        imminent = [c for c in CATALYSTS if 0 <= _d_day(c["date"], today) <= 1]

        msgs = []
        if sig["zone"] != prev_zone and sig["zone"] not in ("UNKNOWN",):
            msgs.append(
                f"🇧🇷 <b>브라질 국채 신호 전환</b> → <b>{sig['grade']}</b>\n"
                f"{sig['headline']}\n▶ {sig['action']}"
            )
        for c in imminent:
            dd = _d_day(c["date"], today)
            tag = "D-DAY" if dd == 0 else "D-1"
            msgs.append(f"🗓️ <b>[{tag}] {c['title']}</b> ({c['date']})\n{c['note']}")

    # 신규 뉴스 감지 → 알림에 포함 (세션 밖에서 실행: 자체 세션 사용)
    notified_links = []
    try:
        from core.brazil_news import sync_brazil_news, mark_notified
        nres = await sync_brazil_news(alert_new=True)
        fresh = nres.get("new_items", [])[:4]
        if fresh:
            lines = ["📰 <b>브라질 국채 관련 새 뉴스</b>"]
            for it in fresh:
                lines.append(f"• <a href=\"{it['link']}\">{it['title']}</a> ({it['source']})")
            msgs.append("\n".join(lines))
            notified_links = [it["link"] for it in fresh]
    except Exception as e:
        print(f"[brazil_bond] news alert skipped: {e}")

    if msgs:
        ok, _ = await send_telegram_message("\n\n".join(msgs), category="brazil_bond")
        if ok and notified_links:
            await mark_notified(notified_links)

    # zone 상태 갱신 (새 세션)
    async with AsyncSessionLocal() as db:
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        state = (await db.execute(
            select(SectorInsight).where(SectorInsight.sector == "brazil_signal_state")
        )).scalar_one_or_none()
        if state:
            state.content = sig["zone"]
            state.generated_at = now
        else:
            db.add(SectorInsight(sector="brazil_signal_state", content=sig["zone"], generated_at=now))
        await db.commit()
    print(f"[brazil_bond] signal check: zone={sig['zone']} prev={prev_zone} alerts={len(msgs)}")
