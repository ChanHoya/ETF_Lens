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
RATE_FLOOR = 14.2      # 최적 진입 하한 (이 아래는 매력 저하)
RATE_TRANCHE2 = 14.7   # 최적 상한 = 천장 접근 경계 (14.7~15.0는 고캐리이나 위기선 근접→주의)
RATE_RISK = 15.0       # 초과 시 리스크 재평가(위기 신호)
RATE_CARRY_MIN = 13.0  # 이 아래는 캐리 부족(실질금리 매력 상실)→부적합
FX_TARGET = 290.0      # 환율 조건 (290원↓)

# ── 하반기 매크로 캘린더 (2026, 고정 일정) ───────────────────────────────────
CATALYSTS = [
    {"date": "2026-07-16", "key": "bok", "title": "한국은행 금통위",
     "note": "인상 기대감 → 원화 강세 모멘텀 → 원/헤알 290원 하회 트리거", "impact": "fx",
     "actual": "기준금리 0.25%p 인상 → 연 2.75% 결정. 12개월 이어진 동결을 끝낸 긴축 전환으로, 신현송 총재 주재 회의에서 금통위원 7명 전원이 참석해 결정.",
     "outlook": "한은 긴축 전환은 원화 강세 압력으로 작용해 원/헤알 290원 하회 트리거에 우호적. 현재 약 292.9원으로 진입 조건에 근접했으나, 실제 290원 하회를 확인한 뒤 1차 분할 진입을 판단하고 8/5 브라질 Copom 결과와 병행 관찰 권장."},
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
    {"id": "D", "title": "25~50bp 인상 (긴축 재개)", "color": "purple",
     "logic": "물가 불안·재정 리스크로 긴축 재개. 5년물 15.0%↑ 폭등 및 단기 변동성 극대화",
     "action": "매수 일시 보류. 금리 15.0% 초과 구간에서 진정 시 역발상 1차 소량 락인"},
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

    # 두 축 신호등(gauge) 색 조합으로 종합 판정.
    # G+G=적극, G+Y=1차, Y+Y=신중, 하나라도 R=보류(금리>15는 리스크 재평가, 그 외 red는 부적합).
    rc = _gauge("y5", y5)
    fc = _gauge("brl_krw", fx)

    if rc == "red" or fc == "red":
        if y5 > RATE_RISK:  # 금리 15% 초과 = 진짜 위험(자본손실 가능)
            return {"zone": "RISK_REASSESS", "grade": "리스크 재평가", "color": "red",
                    "rate_ok": rate_ok, "fx_ok": fx_ok,
                    "headline": f"5년물 {y5:.2f}% > 15.0% — 시장이 선거/재정 리스크를 가격에 반영 중.",
                    "action": "매수 전 펀더멘털 훼손(선거·재정) 여부 필수 확인. 신규 진입 신중."}
        # 그 외 red = 위험이 아니라 '매력 없음'(금리<13 캐리 부족 / 환율>300 고환율)
        why = []
        if y5 < RATE_CARRY_MIN:
            why.append(f"금리 {y5:.2f}% < 13% (캐리 부족)")
        if fx > 300:
            why.append(f"환율 {fx:.1f}원 > 300원 (고환율)")
        return {"zone": "WATCH", "grade": "진입 보류 (부적합)", "color": "red",
                "rate_ok": rate_ok, "fx_ok": fx_ok,
                "headline": ("진입 부적합: " + ", ".join(why) + ".") if why else "진입 조건 미충족.",
                "action": "신규 진입 보류. 조건 회복까지 관망."}

    if rc == "green" and fc == "green":
        return {"zone": "AGGRESSIVE", "grade": "적극 진입 (추가 매수)", "color": "green",
                "rate_ok": True, "fx_ok": True,
                "headline": f"금리 {y5:.2f}% (14.2~14.7% 최적) · 환율 {fx:.1f}원 (≤290원) — 두 축 모두 최적.",
                "action": "적극 분할 매수. 안전 버퍼·저환율 동시 충족 창에서 비중 확대."}

    if (rc == "green") != (fc == "green"):  # 정확히 한 축만 초록(나머지 노랑)
        return {"zone": "TRANCHE1", "grade": "1차 진입", "color": "green",
                "rate_ok": rate_ok, "fx_ok": fx_ok,
                "headline": f"금리 {y5:.2f}% · 환율 {fx:.1f}원 — 한 축 최적·한 축 주의, 부분 진입 유효.",
                "action": "1차 분할 매수. 목표 비중의 일부만, 나머지는 두 축 정렬 대기."}

    # 둘 다 노랑
    return {"zone": "CAUTION", "grade": "신중 진입", "color": "amber",
            "rate_ok": rate_ok, "fx_ok": fx_ok,
            "headline": f"금리 {y5:.2f}% · 환율 {fx:.1f}원 — 두 축 모두 주의 구간.",
            "action": "진입 규모·속도 축소. 조건 개선(초록 전환) 확인 후 확대."}


def _gauge(metric: str, v: float | None) -> str:
    """스코어보드 카드 신호등(green/amber/red/gray). 값 없으면 gray."""
    if v is None:
        return "gray"
    if metric == "y5":
        if v > RATE_RISK:
            return "red"                    # >15.0 리스크(위기 신호)
        if v >= RATE_TRANCHE2:
            return "amber"                  # 14.7~15.0 천장 접근 주의
        if v >= RATE_FLOOR:
            return "green"                  # 14.2~14.7 최적 진입
        if v >= RATE_CARRY_MIN:
            return "amber"                  # 13.0~14.2 매력 저하
        return "red"                        # <13.0 캐리 부족(부적합)
    if metric == "brl_krw":
        if v <= FX_TARGET:
            return "green"
        return "amber" if v <= 300 else "red"
    if metric == "selic":
        # 기준금리 (Selic): 14.0% 이상이면 green, 12.0%~14.0% 이면 amber, 그 이하면 red (캐리 매력)
        if v >= 14.0:
            return "green"
        return "amber" if v >= 12.0 else "red"
    if metric == "ipca_mom":
        return "green" if v < 0.35 else ("amber" if v < 0.6 else "red")
    if metric == "ipca_annual":
        # 연간 물가 상승률 (컨센서스): 4.5% 이하면 green (목표 한계선 3%±1.5%), 4.5%~6.0% 이면 amber, 6.0% 초과면 red
        if v <= 4.5:
            return "green"
        return "amber" if v <= 6.0 else "red"
    if metric == "usd_brl":
        # USD/BRL 환율: 5.0 이하면 green, 5.0~5.5 이면 amber, 5.5 초과면 red
        if v <= 5.0:
            return "green"
        return "amber" if v <= 5.5 else "red"
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

    # 원/헤알·달러/헤알은 하루 1회 배치 스냅샷이 아니라 조회 시점의 실시간 시세로 현재값을 덮어쓴다.
    # (실패 시 DB 스냅샷 유지 → graceful degradation). 직전값=마지막 DB 종가로 두어 '직전 대비' 계산.
    from core.brazil_fetcher import fetch_brl_krw_live, fetch_usd_brl_live
    _today_iso = datetime.now(_KST).strftime("%Y-%m-%d")
    live_fx = await fetch_brl_krw_live()
    if live_fx is not None:
        _, db_fx, _ = data["brl_krw"]
        data["brl_krw"] = (_today_iso, live_fx, db_fx)
    live_usdbrl = await fetch_usd_brl_live()
    if live_usdbrl is not None:
        _, db_ub, _ = data["usd_brl"]
        data["usd_brl"] = (_today_iso, live_usdbrl, db_ub)

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
    # 실질금리 확인일자 = 구성 지표(Selic·IPCA12M) 중 더 최근 날짜
    real_rate_date = max([d for d in (data["selic_target"][0], data["ipca_12m"][0]) if d], default=None)
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
    # 원/헤알 카드에 실시간 시세 반영 여부 표시
    if live_fx is not None:
        for ind in indicators:
            if ind["key"] == "brl_krw":
                ind["live"] = True

    # 달러/헤알(USD/BRL) 현재값 + 헤알 강세/약세 판정. USD/BRL 하락 = 헤알 강세.
    ub_date, ub_val, ub_prev = data["usd_brl"]
    ub_chg = round(ub_val - ub_prev, 4) if (ub_val is not None and ub_prev is not None) else None
    if ub_chg is None or abs(ub_chg) < 1e-9:
        brl_trend = "flat"
    else:
        brl_trend = "strong" if ub_chg < 0 else "weak"

    return {
        "as_of": max([d for d, _, _ in data.values() if d] or [today.isoformat()]),
        "indicators": indicators,
        "real_rate": {"label": "실질금리 (Selic−IPCA)", "unit": "%p",
                      "value": real_rate, "gauge": _gauge("real_rate", real_rate),
                      "date": real_rate_date},
        "focus": {
            "selic_eoy": cur("focus_selic_eoy"),
            "ipca_eoy": cur("focus_ipca_eoy"),
            "usdbrl_eoy": cur("focus_usdbrl_eoy"),
            "selic_eoy_gauge": _gauge("selic", cur("focus_selic_eoy")),
            "ipca_eoy_gauge": _gauge("ipca_annual", cur("focus_ipca_eoy")),
            "usdbrl_eoy_gauge": _gauge("usd_brl", cur("focus_usdbrl_eoy")),
            "selic_eoy_date": data["focus_selic_eoy"][0],
            "ipca_eoy_date": data["focus_ipca_eoy"][0],
            "usdbrl_eoy_date": data["focus_usdbrl_eoy"][0],
        },
        "usd_brl": {"value": ub_val, "prev": ub_prev, "change": ub_chg, "date": ub_date,
                    "live": live_usdbrl is not None, "brl_trend": brl_trend},
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


# 백필 백그라운드 태스크 참조 보관(GC 방지)
_backfill_tasks: set = set()


@router.post("/backfill-y5")
async def backfill_y5(days: int = 365):
    """ANBIMA로 5년물 실제 금리를 최근 days일 백필(백그라운드 실행, 즉시 응답).
    252영업일(1년) 약 2~3분 소요 → 완료는 /history 로 확인. 일일 동기화(10일)와 별개."""
    from core.brazil_fetcher import backfill_y5_anbima
    task = asyncio.create_task(backfill_y5_anbima(days))
    _backfill_tasks.add(task)
    task.add_done_callback(_backfill_tasks.discard)
    return {"status": "started", "days": days,
            "note": "백그라운드 백필 시작. 2~3분 후 history의 y5가 확장됩니다."}


# 뉴스 자동 갱신 게이트: 마지막 라이브 수집 시각(에포크초). 프론트가 refresh=false로만 호출해도
# TTL 경과 시 자동으로 새로 스크레이핑하도록 한다. (모듈 전역 — 단일 인스턴스 기준)
_last_news_sync_ts = 0.0
_NEWS_SYNC_TTL = 20 * 60  # 20분


@router.get("/news")
async def get_news(refresh: bool = False, limit: int = 12):
    """브라질 국채 관련 최신 뉴스(Google News RSS).
    refresh=True 또는 마지막 수집 후 20분 경과 시 라이브 수집 후 저장."""
    from core.brazil_news import sync_brazil_news, get_recent_news
    import time
    global _last_news_sync_ts
    now = time.time()
    if refresh or (now - _last_news_sync_ts > _NEWS_SYNC_TTL):
        try:
            await sync_brazil_news(alert_new=False)
            _last_news_sync_ts = now
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
    """Activation Zone 등급이 직전 저장분과 달라졌거나, COPOM Selic 금리가 변경되었거나, 핵심 캘린더 D-1/D-day면 알림."""
    from core.notifier import send_telegram_message
    from db.database import AsyncSessionLocal

    async with AsyncSessionLocal() as db:
        _, y5, _ = await _latest(db, "y5")
        _, fx, _ = await _latest(db, "brl_krw")
        _, selic, _ = await _latest(db, "selic_target")
        sig = compute_signal(y5, fx)

        # 직전 신호 등급
        state = (await db.execute(
            select(SectorInsight).where(SectorInsight.sector == "brazil_signal_state")
        )).scalar_one_or_none()
        prev_zone = state.content if state else None

        # 직전 Selic 금리
        selic_state = (await db.execute(
            select(SectorInsight).where(SectorInsight.sector == "brazil_selic_state")
        )).scalar_one_or_none()
        try:
            prev_selic = float(selic_state.content) if selic_state and selic_state.content else None
        except Exception:
            prev_selic = None

        today = datetime.now(_KST).date()
        imminent = [c for c in CATALYSTS if 0 <= _d_day(c["date"], today) <= 1]

        msgs = []
        # 1. COPOM 기준금리 변경 감지 핫 알림
        if selic is not None and prev_selic is not None and abs(selic - prev_selic) >= 0.01:
            diff = selic - prev_selic
            direction = "인상 📈" if diff > 0 else "인하 📉"
            msgs.append(
                f"🚨 <b>[COPOM 기준금리 결정 발표]</b>\n"
                f"브라질 기준금리(Selic): <b>{prev_selic:.2f}% ➔ {selic:.2f}%</b> ({diff:+.2f}%p {direction})\n"
                f"Activation Zone: <b>{sig['grade']}</b>\n"
                f"{sig['headline']}\n▶ {sig['action']}"
            )

        # 2. Zone 신호 전환 알림
        if sig["zone"] != prev_zone and sig["zone"] not in ("UNKNOWN",):
            msgs.append(
                f"🇧🇷 <b>브라질 국채 신호 전환</b> → <b>{sig['grade']}</b>\n"
                f"{sig['headline']}\n▶ {sig['action']}"
            )

        # 3. 캘린더 임박 알림
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

    # zone 및 selic 상태 갱신 (새 세션)
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

        if selic is not None:
            selic_st = (await db.execute(
                select(SectorInsight).where(SectorInsight.sector == "brazil_selic_state")
            )).scalar_one_or_none()
            if selic_st:
                selic_st.content = str(selic)
                selic_st.generated_at = now
            else:
                db.add(SectorInsight(sector="brazil_selic_state", content=str(selic), generated_at=now))

        await db.commit()
    print(f"[brazil_bond] signal check: zone={sig['zone']} prev_zone={prev_zone} selic={selic} prev_selic={prev_selic} alerts={len(msgs)}")


# ══════════════════════════════════════════════════════════════════════════
# 대시보드 지표 텔레그램 브리핑 (매일 아침 + 모든 지표 초록불 전환 시)
# ══════════════════════════════════════════════════════════════════════════
_GAUGE_EMOJI = {"green": "🟢", "amber": "🟡", "red": "🔴", "gray": "⚪"}
_TREND_LABEL = {"strong": "헤알 강세 📈", "weak": "헤알 약세 📉", "flat": "보합 ➖"}


def _collect_gauges(summary: dict) -> list[str]:
    """대시보드 8개 카드의 신호등 색상 목록(원/헤알·5년물·Selic·IPCA·실질금리·Focus 3종)."""
    gauges = [ind.get("gauge", "gray") for ind in summary.get("indicators", [])]
    gauges.append(summary.get("real_rate", {}).get("gauge", "gray"))
    f = summary.get("focus", {})
    gauges += [f.get("selic_eoy_gauge", "gray"), f.get("ipca_eoy_gauge", "gray"), f.get("usdbrl_eoy_gauge", "gray")]
    return gauges


def build_brazil_dashboard_message(summary: dict, header_note: str | None = None) -> str:
    """대시보드 카드와 동일한 지표 내용을 텔레그램(HTML) 메시지로 구성한다."""
    sig = summary.get("signal", {})
    as_of = summary.get("as_of", "")

    def _fmt(v, d=2):
        return "—" if v is None else f"{v:,.{d}f}"

    lines = []
    if header_note:
        lines.append(header_note)
    lines.append(f"🇧🇷 <b>브라질 국채 대시보드</b> ({as_of})")
    lines.append(f"Activation Zone: <b>{sig.get('grade','—')}</b>")
    if sig.get("headline"):
        lines.append(sig["headline"])
    lines.append("")
    lines.append("📊 <b>매크로 지표 현황</b>")
    for ind in summary.get("indicators", []):
        emoji = _GAUGE_EMOJI.get(ind.get("gauge", "gray"), "⚪")
        unit = ind.get("unit", "")
        d = 1 if unit == "원" else 2
        live = " · 실시간" if ind.get("live") else (f" ({ind['date']})" if ind.get("date") else "")
        lines.append(f"{emoji} {ind['label']}: <b>{_fmt(ind['value'], d)}{unit}</b>{live}")
    rr = summary.get("real_rate", {})
    lines.append(f"{_GAUGE_EMOJI.get(rr.get('gauge','gray'),'⚪')} {rr.get('label','실질금리')}: <b>{_fmt(rr.get('value'))}{rr.get('unit','')}</b>"
                 + (f" ({rr['date']})" if rr.get("date") else ""))
    f = summary.get("focus", {})
    lines.append(f"{_GAUGE_EMOJI.get(f.get('selic_eoy_gauge','gray'),'⚪')} Focus 연말 Selic: <b>{_fmt(f.get('selic_eoy'))}%</b>")
    lines.append(f"{_GAUGE_EMOJI.get(f.get('ipca_eoy_gauge','gray'),'⚪')} Focus 연말 IPCA: <b>{_fmt(f.get('ipca_eoy'))}%</b>")
    lines.append(f"{_GAUGE_EMOJI.get(f.get('usdbrl_eoy_gauge','gray'),'⚪')} Focus 연말 USD/BRL: <b>{_fmt(f.get('usdbrl_eoy'))}</b>")

    ub = summary.get("usd_brl", {})
    if ub.get("value") is not None:
        trend = _TREND_LABEL.get(ub.get("brl_trend", "flat"), "")
        lines.append(f"💵 달러/헤알(USD/BRL): <b>{_fmt(ub.get('value'), 4)}</b> · {trend}")

    if sig.get("action"):
        lines.append("")
        lines.append(f"▶ {sig['action']}")
    lines.append("")
    lines.append("🔗 <a href='https://etf-lens.vercel.app'>etf-lens.vercel.app</a>")
    return "\n".join(lines)


async def _build_summary_for_alert() -> dict:
    """알림용 대시보드 요약. get_summary 로직을 자체 세션으로 재사용."""
    from db.database import AsyncSessionLocal
    async with AsyncSessionLocal() as db:
        return await get_summary(db=db)


async def send_brazil_dashboard_digest() -> None:
    """매일 아침 대시보드 지표 브리핑을 텔레그램으로 발송(카테고리 brazil_bond)."""
    from core.notifier import send_telegram_message
    try:
        summary = await _build_summary_for_alert()
        msg = build_brazil_dashboard_message(summary, header_note="☀️ <b>[브라질 국채 아침 브리핑]</b>")
        ok, _ = await send_telegram_message(msg, category="brazil_bond")
        print(f"[brazil_bond] daily digest sent: {ok}")
    except Exception as e:
        print(f"[brazil_bond] daily digest failed: {e}")


def _collect_core_gauges(summary: dict) -> list[str]:
    """핵심 지표(Current Market Dashboard 메인 4종: 기준금리·5년물·원/헤알·IPCA m/m) 신호등."""
    return [ind.get("gauge", "gray") for ind in summary.get("indicators", [])]


def _all_green(gauges: list[str]) -> bool:
    return bool(gauges) and all(g == "green" for g in gauges)


async def _read_green_state(db, key: str) -> bool:
    row = (await db.execute(
        select(SectorInsight).where(SectorInsight.sector == key)
    )).scalar_one_or_none()
    return (row.content == "1") if row else False


async def _write_green_state(db, key: str, val: bool) -> None:
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    row = (await db.execute(
        select(SectorInsight).where(SectorInsight.sector == key)
    )).scalar_one_or_none()
    content = "1" if val else "0"
    if row:
        row.content = content
        row.generated_at = now
    else:
        db.add(SectorInsight(sector=key, content=content, generated_at=now))


async def check_brazil_all_green_and_alert() -> None:
    """핵심 지표(메인 4종) 또는 전체 지표(8종)가 초록불로 '전환'될 때만 알림 발송.
    반복 발송 방지를 위해 SectorInsight 에 상태('1'/'0') 저장.
    - 전체 초록 전환: '모든 지표 초록불' 메시지.
    - (전체 전환이 아닐 때) 핵심만 초록 전환: '핵심 지표 초록불' 메시지."""
    from core.notifier import send_telegram_message
    from db.database import AsyncSessionLocal
    try:
        summary = await _build_summary_for_alert()
    except Exception as e:
        print(f"[brazil_bond] green check: summary failed: {e}")
        return

    core_green = _all_green(_collect_core_gauges(summary))
    full_green = _all_green(_collect_gauges(summary))

    async with AsyncSessionLocal() as db:
        prev_core = await _read_green_state(db, "brazil_core_green_state")
        prev_full = await _read_green_state(db, "brazil_all_green_state")

        msg = None
        if full_green and not prev_full:
            msg = build_brazil_dashboard_message(
                summary, header_note="🟢 <b>[모든 지표 초록불!]</b> 진입 조건이 완전히 정렬되었습니다.")
        elif core_green and not prev_core:
            msg = build_brazil_dashboard_message(
                summary, header_note="🟢 <b>[핵심 지표 초록불]</b> 금리·환율 등 핵심 지표가 진입 우호적입니다.")
        if msg:
            ok, _ = await send_telegram_message(msg, category="brazil_bond")
            print(f"[brazil_bond] green transition alert sent: {ok}")

        await _write_green_state(db, "brazil_core_green_state", core_green)
        await _write_green_state(db, "brazil_all_green_state", full_green)
        await db.commit()
    print(f"[brazil_bond] green check: core={core_green}(prev {prev_core}) full={full_green}(prev {prev_full})")


class _TestDigestSchema(BaseModel):
    telegram_token: str
    telegram_chat_id: str


@router.post("/test-digest")
async def test_digest(data: _TestDigestSchema, db: AsyncSession = Depends(get_db)):
    """현재 대시보드 지표 값으로 구성한 브리핑을 지정된(테스트) 텔레그램으로 즉시 발송."""
    from core.notifier import send_telegram_message
    from db.models import NotificationSettings

    token = data.telegram_token
    if "******" in token:  # 마스킹된 토큰이면 DB에서 원본 조회
        res = await db.execute(
            select(NotificationSettings).where(NotificationSettings.telegram_chat_id == data.telegram_chat_id)
        )
        s = res.scalars().first()
        if s and s.telegram_token:
            token = s.telegram_token
        else:
            raise HTTPException(status_code=400, detail="저장된 토큰이 없습니다. 먼저 토큰을 입력해 주세요.")

    summary = await get_summary(db=db)
    msg = build_brazil_dashboard_message(summary, header_note="🧪 <b>[테스트] 브라질 국채 대시보드</b>")
    ok, err = await send_telegram_message(msg, force=True, test_token=token, test_chat_id=data.telegram_chat_id)
    if not ok:
        raise HTTPException(status_code=400, detail=f"전송 실패: {err}")
    return {"status": "success", "msg": "현재 지표 값으로 테스트 브리핑을 발송했습니다."}
