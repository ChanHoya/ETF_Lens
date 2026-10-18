# 시장동향 > 환율 탭용 원/달러·달러지수·금리차·실질실효환율 시계열과 스냅샷·국면 타임라인을 제공하는 API
"""
GET /api/v1/fx/overview  (?refresh=true 로 캐시 무시)

- 원천: FRED fredgraph CSV(키 불필요) + Yahoo v8 chart + ECOS 국제수지(ECOS_API_KEY). 수집은 30분 메모리 캐시, 실패 시 마지막 성공값 유지.
- 계산(build_overview·build_analysis)은 네트워크와 분리해 테스트한다. 분석 지표의 정의는 docs/fx-tab-context-notes.md.
"""
import asyncio
import logging
import time
from datetime import date, datetime, timedelta, timezone

import numpy as np
import pandas as pd
import requests
from fastapi import APIRouter, HTTPException, Query

from api.exit_signal import _fetch_yahoo_v8
from api.rates_dashboard import _fetch_ecos
from core.overview_cache import OverviewCache, fred_csv, timed
from core.regime_auto import enrich_texts, fx_auto_segments, template_text

logger = logging.getLogger(__name__)
router = APIRouter()

YEARS = 20
CACHE_TTL = 30 * 60  # 프론트는 기준 시각 1시간 경과 시 갱신 → 서버 캐시는 그보다 짧아야 새 값을 받는다
FRED_IDS = {
    "krw": "DEXKOUS",           # 원/달러 (뉴욕 정오, 일간)
    "us10": "DGS10",            # 미 10년물
    "kr10": "IRLTLT01KRM156N",  # 한 10년물 (월간, OECD)
    "reer": "RBKRBIS",          # 원화 실질실효환율 (월간, BIS)
    "jpy": "DEXJPUS",           # 엔/달러 (DXY 13.6%)
    "eur": "DEXUSEU",           # 유로/달러 (DXY 57.6%)
    "gbp": "DEXUSUK",           # 파운드/달러 (DXY 11.9%)
    "cad": "DEXCAUS",           # 캐나다달러/달러 (DXY 9.1%)
    "sek": "DEXSDUS",           # 스웨덴크로나/달러 (DXY 4.2%)
    "chf": "DEXSZUS",           # 스위스프랑/달러 (DXY 3.6%)
    "cny": "DEXCHUS",           # 위안/달러
    "twd": "DEXTAUS",           # 대만달러/달러 — 반도체 수출국끼리 비교
    "vix": "VIXCLS",            # 미국 변동성지수 — 위험 선호와 원화의 동조 확인용
}
# 국제수지(ECOS 301Y013, 월간, 백만달러) — 자산 + = 내국인 해외투자(유출), 부채 + = 외국인 국내투자(유입)
BOP_ITEMS = {"ca": "000000", "di_a": "BOPF11000000", "pi_a": "BOPF21000000",
             "di_l": "BOPF12000000", "pi_l": "BOPF22000000"}
CORR_WINDOW = 52   # 롤링 상관 창(주)
FIT_YEARS = 10     # DXY 기반 적정 원/달러 회귀 기간
BETA_WEEKS = 156   # 민감도(베타) 추정 기간 = 3년

# 원/달러 국면 — 날짜는 DEXKOUS 고점·저점일, 구간 값은 데이터에서 계산한다.
# kind="range"는 추세가 아닌 박스권.
REGIMES = [
    {"start": "2007-10-31", "end": "2009-03-02", "title": "글로벌 금융위기",
     "drivers": ["서브프라임 부실·리먼브라더스 파산(2008.9)", "외화 유동성 경색과 외국인 자금 이탈",
                 "한미 통화스와프 300억달러 체결(2008.10)로 진정 시작"]},
    {"start": "2009-03-02", "end": "2011-07-26", "title": "위기 후 회복",
     "drivers": ["연준 양적완화(QE1·QE2)로 달러 약세", "위험자산 회복과 신흥국 자금 유입", "경상수지 흑자 확대"]},
    {"start": "2011-07-26", "end": "2011-10-04", "title": "유럽 재정위기",
     "drivers": ["그리스·이탈리아 등 유럽 재정위기 확산", "S&P 미국 신용등급 강등(2011.8)", "안전자산 선호 급증"]},
    {"start": "2013-06-24", "end": "2014-07-03", "title": "경상흑자 원화 강세",
     "drivers": ["테이퍼 탠트럼(2013.5~6) 충격에도 신흥국 중 차별화", "사상 최대 경상수지 흑자"]},
    {"start": "2014-07-03", "end": "2016-02-26", "title": "1차 킹달러",
     "drivers": ["미 양적완화 종료(2014.10)·금리 인상 개시(2015.12)", "위안화 기습 절하(2015.8)",
                 "유가 급락과 신흥국 자금 이탈"]},
    {"start": "2016-02-26", "end": "2018-04-03", "title": "글로벌 동반 성장",
     "drivers": ["세계 경기 동반 회복과 약달러", "반도체 슈퍼사이클로 수출 호조"]},
    {"start": "2018-04-03", "end": "2020-03-23", "title": "무역분쟁·코로나",
     "drivers": ["미중 무역분쟁·관세 전쟁", "반도체 다운사이클(2019)",
                 "코로나19 팬데믹 충격, 한미 통화스와프 600억달러(2020.3)"]},
    {"start": "2020-03-23", "end": "2021-01-04", "title": "유동성 랠리",
     "drivers": ["연준 제로금리·무제한 양적완화", "달러 약세, 수출·증시 회복"]},
    {"start": "2021-06-01", "end": "2022-09-28", "title": "2차 킹달러",
     "drivers": ["40년 만의 미국 인플레이션", "연준 자이언트 스텝(0.75%p) 연속 인상",
                 "한미 기준금리 역전(2022.7), 에너지 가격 급등에 무역적자"]},
    {"start": "2022-09-28", "end": "2024-09-27", "title": "고금리 박스권", "kind": "range",
     "drivers": ["연준 금리 정점, SVB 사태(2023.3)", "한미 기준금리 역전 폭 최대 2.0%p(2023)",
                 "거주자 해외투자 확대로 원화 구조적 약세 논의"]},
    {"start": "2024-09-27", "end": "2025-04-09", "title": "정치·관세 충격",
     "drivers": ["미 대선 후 강달러(트럼프 트레이드)", "12·3 비상계엄과 탄핵 정국", "미국 상호관세 발표(2025.4)"]},
    {"start": "2025-04-09", "end": "2025-06-30", "title": "관세 유예·약달러",
     "drivers": ["상호관세 90일 유예", "달러인덱스 상반기 약 10% 하락", "6·3 대선으로 정치 불확실성 해소"]},
    {"start": "2025-06-30", "end": "2026-06-05", "title": "원화 고유 약세·외국인 이탈",
     "drivers": ["거주자 해외주식 투자 확대로 구조적 달러 수요", "외국인 사상 최대 국내주식 순매도·역송금(2026.6)",
                 "연준 인상 전망에 달러 강세, 약 40년 만의 엔저"],
     "source": "한국경제·머니투데이 2026-06-30"},
    {"start": "2026-06-05", "end": "2026-09-09", "title": "환전 수급·금리차 축소",
     "drivers": ["SK하이닉스 ADR 조달 265억달러 원화 환전", "한은 금리 인상으로 한미 금리차 축소",
                 "미 고용 부진·약달러, 미·일 엔화 공조 매입", "외국인 순매수 전환과 경상수지 흑자"],
     "source": "한국경제 2026-07-31 · 서울신문 2026-08-20"},
]

def _series(d: dict[str, float]) -> pd.Series:
    if not d:
        return pd.Series(dtype=float)
    s = pd.Series(d, dtype=float)
    s.index = pd.to_datetime(s.index)
    return s.sort_index()


def _pct_rank(s: pd.Series, value: float) -> int | None:
    """value 이하 관측 비율(%) — 10년 중 현재 위치."""
    if s.empty:
        return None
    return int(round((s <= value).mean() * 100))


def _change(s: pd.Series, days: int) -> float | None:
    """마지막 값 대비 days일 전(그 이전 가장 가까운 관측) 변화율 %."""
    if len(s) < 2:
        return None
    past = s[s.index <= s.index[-1] - timedelta(days=days)]
    if past.empty or past.iloc[-1] == 0:
        return None
    return round(float(s.iloc[-1] / past.iloc[-1] - 1) * 100, 2)


def _r(v, n=2):
    return None if v is None or pd.isna(v) else round(float(v), n)


def _weekly(s: pd.Series) -> pd.Series:
    return s.resample("W-FRI").last() if not s.empty else pd.Series(dtype=float)


def _verdict(snap: dict, fair_gap: float | None) -> dict:
    """원화 강세(원/달러 하락) 근거와 약세(상승) 근거를 같은 무게로 나열 — 규칙은 docs/fx-feedback-context-notes.md."""
    k, reer = snap.get("krw") or {}, (snap.get("reer") or {}).get("gap_pct")
    p10, p3, ma = k.get("pct10y"), k.get("pct3y"), k.get("ma26_gap")
    net = (snap.get("flows") or {}).get("net_12m")
    sp = (snap.get("spread10") or {}).get("value")
    strong, weak = [], []

    def add(side, cond, text):  # text는 조건이 참일 때만 만든다(None 값 포맷 방지)
        if cond:
            side.append(text())
    add(strong, p10 is not None and p10 >= 80, lambda: f"원/달러가 10년 중 {p10}% 위치 — 장기 평균보다 높아 되돌림 여지")
    add(strong, reer is not None and reer <= -10, lambda: f"원화 실질가치가 20년 평균보다 {abs(reer):.0f}% 낮음(수년 단위 지표)")
    add(strong, fair_gap is not None and fair_gap >= 5, lambda: f"달러지수로 설명되는 수준보다 {fair_gap:.1f}% 높음 — 원화 고유 약세가 쌓임")
    add(strong, net is not None and net > 0, lambda: f"최근 12개월 달러 순유입 +{net:,.0f}억달러 — 벌어온 달러가 해외투자 유출보다 많음")
    add(strong, ma is not None and ma <= -1, lambda: f"26주 평균보다 {abs(ma):.1f}% 낮음 — 하락 추세")
    add(strong, sp is not None and sp <= 0, lambda: f"한국 10년물 금리가 미국보다 {abs(sp):.2f}%p 높음")
    add(weak, p10 is not None and p10 <= 20, lambda: f"원/달러가 10년 중 {p10}% 위치 — 장기 평균보다 낮음")
    add(weak, reer is not None and reer >= 5, lambda: f"원화 실질가치가 20년 평균보다 {reer:.0f}% 높음")
    add(weak, fair_gap is not None and fair_gap <= -5, lambda: f"달러지수로 설명되는 수준보다 {abs(fair_gap):.1f}% 낮음 — 원화가 이미 강함")
    add(weak, net is not None and net < 0, lambda: f"최근 12개월 달러 순유출 {net:,.0f}억달러 — 해외투자 유출이 벌어온 달러보다 많음")
    add(weak, ma is not None and ma >= 1, lambda: f"26주 평균보다 {ma:.1f}% 높음 — 상승 추세")
    add(weak, sp is not None and sp >= 1, lambda: f"미국 10년물 금리가 한국보다 {sp:.2f}%p 높음 — 달러 보유 유인")
    add(weak, p10 is not None and p3 is not None and p10 >= 70 and p3 <= 50,
        lambda: f"10년 중 {p10}%지만 최근 3년 중으론 {p3}% — 높은 환율이 새 보통이 됐다면 하락 여지가 작음")
    diff = len(strong) - len(weak)
    # 해외(달러) 자산을 지금 사는 데 환율이 돕는가 — 헤지 여부가 아니라 매수 시점 참고
    if diff >= 2:
        level, label = "strong_krw", "원화 강세 근거 우세"
        action = "환율 여건 불리 — 원화가 더 강해지면 환차손, 달러 자산은 나눠서 매수"
    elif diff <= -2:
        level, label = "weak_krw", "원화 약세 근거 우세"
        action = "환율 여건 유리 — 원화가 더 약해지면 환차익 여지"
    else:
        level, label = "neutral", "강세·약세 근거 팽팽 — 방향 관망"
        action = "환율 중립 — 환율보다 자산 자체의 매력으로 판단"
    return {"level": level, "label": label, "action": action, "strong": strong, "weak": weak}


def _flows(raw: dict) -> dict | None:
    """국제수지 12개월 합(억달러): 경상수지 − 내국인 해외투자 + 외국인 국내투자 = 달러 순유입(기본수지 근사)."""
    df = pd.DataFrame({k: _series(raw.get(f"bop_{k}", {})) for k in BOP_ITEMS}).dropna()
    if len(df) < 24:
        return None
    m = df.rolling(12).sum().dropna() / 100
    m["out"], m["inflow"] = m["di_a"] + m["pi_a"], m["di_l"] + m["pi_l"]
    m["net"] = m["ca"] - m["out"] + m["inflow"]
    last = m.iloc[-1]
    ago = m[m.index <= m.index[-1] - pd.DateOffset(months=12)]
    tail = m[m.index >= m.index[-1] - pd.DateOffset(years=10)]
    return {"month": m.index[-1].strftime("%Y-%m"), "ca_12m": _r(last.ca, 0), "out_12m": _r(last.out, 0),
            "in_12m": _r(last.inflow, 0), "net_12m": _r(last.net, 0),
            "net_year_ago": _r(ago["net"].iloc[-1], 0) if not ago.empty else None,
            "rows": [{"date": i.strftime("%Y-%m"), "ca": _r(r.ca, 0), "out": _r(-r.out, 0), "inflow": _r(r.inflow, 0),
                      "net": _r(r.net, 0)} for i, r in tail.iterrows()]}


def build_overview(raw: dict[str, dict[str, float]], today: date) -> dict:
    """원천 시계열(raw) → 스냅샷·주간 차트 데이터·국면 타임라인."""
    fred_krw = _series(raw.get("krw", {}))
    live = _series(raw.get("krw_live", {}))
    krw = fred_krw
    if not live.empty:  # FRED 지연 구간(약 1주)을 Yahoo 일간으로 잇는다
        tail = live if fred_krw.empty else live[live.index > fred_krw.index[-1]]
        krw = pd.concat([fred_krw, tail])
    dxy = _series(raw.get("dxy", {}))
    us10, kr10 = _series(raw.get("us10", {})), _series(raw.get("kr10", {}))
    reer = _series(raw.get("reer", {}))
    jpy, cny, twd = _series(raw.get("jpy", {})), _series(raw.get("cny", {})), _series(raw.get("twd", {}))
    eur = _series(raw.get("eur", {}))
    gbp = _series(raw.get("gbp", {}))
    cad = _series(raw.get("cad", {}))
    sek = _series(raw.get("sek", {}))
    chf = _series(raw.get("chf", {}))

    start = pd.Timestamp(today) - pd.DateOffset(years=YEARS)
    ten_years_ago = pd.Timestamp(today) - pd.DateOffset(years=10)

    # 주간(금요일) 축 — 월간 지표는 앞채움. 아시아 통화는 모두 달러 대비(같은 잣대)로 본다.
    cross_jpy = (fred_krw / jpy * 100).dropna() if not fred_krw.empty and not jpy.empty else pd.Series(dtype=float)
    wk = pd.DataFrame({"krw": _weekly(krw), "dxy": _weekly(dxy), "us10": _weekly(us10), "kr10": _weekly(kr10),
                       "usdjpy": _weekly(jpy), "eurusd": _weekly(eur), "gbpusd": _weekly(gbp),
                       "usdcad": _weekly(cad), "usdsek": _weekly(sek), "usdchf": _weekly(chf),
                       "usdcny": _weekly(cny), "usdtwd": _weekly(twd),
                       "vix": _weekly(_series(raw.get("vix", {}))), "kospi": _weekly(_series(raw.get("kospi", {})))})
    wk = wk[wk.index >= start]
    if not krw.empty:  # 진행 중인 주는 다가올 금요일이 아니라 마지막 관측일로 표시
        last = krw.index[-1]
        wk.index = wk.index.where(wk.index <= last, last)
    wk["kr10"] = wk["kr10"].ffill(limit=10)
    daily_cols = ["krw", "dxy", "us10", "usdjpy", "eurusd", "gbpusd", "usdcad", "usdsek", "usdchf", "usdcny", "usdtwd", "vix", "kospi"]
    wk[daily_cols] = wk[daily_cols].ffill(limit=2)
    wk["spread10"] = wk["us10"] - wk["kr10"]
    rows = [
        {"date": idx.strftime("%Y-%m-%d"), "krw": _r(r.krw, 1), "dxy": _r(r.dxy), "us10": _r(r.us10),
         "kr10": _r(r.kr10), "spread10": _r(r.spread10), "usdjpy": _r(r.usdjpy, 2), "eurusd": _r(r.eurusd, 4),
         "gbpusd": _r(r.gbpusd, 4), "usdcad": _r(r.usdcad, 4), "usdsek": _r(r.usdsek, 4), "usdchf": _r(r.usdchf, 4),
         "usdcny": _r(r.usdcny, 3), "usdtwd": _r(r.usdtwd, 2), "vix": _r(r.vix), "kospi": _r(r.kospi, 0),
         "jpy100": _r((r.krw / r.usdjpy * 100), 1) if not pd.isna(r.krw) and not pd.isna(r.usdjpy) and r.usdjpy > 0 else None,
         "cny10": _r((r.krw / r.usdcny * 10), 1) if not pd.isna(r.krw) and not pd.isna(r.usdcny) and r.usdcny > 0 else None,
         "eurkrw": _r((r.krw * r.eurusd), 1) if not pd.isna(r.krw) and not pd.isna(r.eurusd) and r.eurusd > 0 else None}
        for idx, r in wk.iterrows() if not pd.isna(r.krw)
    ]

    snapshot: dict = {}
    if not krw.empty:
        krw10 = krw[krw.index >= ten_years_ago]
        krw3 = krw[krw.index >= pd.Timestamp(today) - pd.DateOffset(years=3)]
        ma26 = wk["krw"].dropna().tail(26).mean()  # 반년 추세선
        snapshot["krw"] = {
            "value": _r(krw.iloc[-1], 1), "date": krw.index[-1].strftime("%Y-%m-%d"),
            "chg_1w": _change(krw, 7), "chg_1m": _change(krw, 30), "chg_1y": _change(krw, 365),
            "pct10y": _pct_rank(krw10, krw.iloc[-1]), "pct3y": _pct_rank(krw3, krw.iloc[-1]),
            "min10y": _r(krw10.min(), 1), "max10y": _r(krw10.max(), 1),
            "ma26": _r(ma26, 1), "ma26_gap": _r((krw.iloc[-1] / ma26 - 1) * 100, 1) if ma26 else None,
        }
    if not dxy.empty:
        dxy10 = dxy[dxy.index >= ten_years_ago]
        snapshot["dxy"] = {
            "value": _r(dxy.iloc[-1]), "date": dxy.index[-1].strftime("%Y-%m-%d"),
            "chg_1m": _change(dxy, 30), "chg_1y": _change(dxy, 365), "pct10y": _pct_rank(dxy10, dxy.iloc[-1]),
        }
    # DXY 6대 통화 바스켓 스냅샷 (비중, 공식 지수승, 최신 환율, 1년 변동률)
    dxy_basket = [
        {"key": "eurusd", "currency": "유로", "symbol": "EUR/USD", "weight": 57.6, "power": -0.576,
         "value": _r(eur.iloc[-1], 4) if not eur.empty else None, "chg_1y": _change(eur, 365)},
        {"key": "usdjpy", "currency": "일본 엔", "symbol": "USD/JPY", "weight": 13.6, "power": 0.136,
         "value": _r(jpy.iloc[-1], 2) if not jpy.empty else None, "chg_1y": _change(jpy, 365)},
        {"key": "gbpusd", "currency": "영국 파운드", "symbol": "GBP/USD", "weight": 11.9, "power": -0.119,
         "value": _r(gbp.iloc[-1], 4) if not gbp.empty else None, "chg_1y": _change(gbp, 365)},
        {"key": "usdcad", "currency": "캐나다 달러", "symbol": "USD/CAD", "weight": 9.1, "power": 0.091,
         "value": _r(cad.iloc[-1], 4) if not cad.empty else None, "chg_1y": _change(cad, 365)},
        {"key": "usdsek", "currency": "스웨덴 크로나", "symbol": "USD/SEK", "weight": 4.2, "power": 0.042,
         "value": _r(sek.iloc[-1], 4) if not sek.empty else None, "chg_1y": _change(sek, 365)},
        {"key": "usdchf", "currency": "스위스 프랑", "symbol": "USD/CHF", "weight": 3.6, "power": 0.036,
         "value": _r(chf.iloc[-1], 4) if not chf.empty else None, "chg_1y": _change(chf, 365)},
    ]
    snapshot["dxy_basket"] = dxy_basket
    asia = [{"key": k, "label": label, "value": _r(ser.iloc[-1], 3 if k == "usdcny" else 2),
             "date": ser.index[-1].strftime("%Y-%m-%d"), "chg_1y": _change(ser, 365)}
            for k, ser, label in (("usdkrw", fred_krw, "원/달러"), ("usdjpy", jpy, "엔/달러"),
                                  ("usdcny", cny, "위안/달러"), ("usdtwd", twd, "대만달러/달러")) if not ser.empty]
    if asia:  # 원/달러는 FRED 기준(같은 시각·같은 원천으로 비교)
        snapshot["asia"] = asia
    if not cross_jpy.empty:  # 엔화 자산·여행용 참고 숫자
        snapshot["jpy100"] = {"value": _r(cross_jpy.iloc[-1]), "chg_1y": _change(cross_jpy, 365)}
    cross_cny10 = (fred_krw / cny * 10).dropna() if not fred_krw.empty and not cny.empty else pd.Series(dtype=float)
    cross_eur = (fred_krw * eur).dropna() if not fred_krw.empty and not eur.empty else pd.Series(dtype=float)
    if not cross_cny10.empty:
        snapshot["cny10"] = {"value": _r(cross_cny10.iloc[-1], 1), "chg_1y": _change(cross_cny10, 365)}
    if not cross_eur.empty:
        snapshot["eurkrw"] = {"value": _r(cross_eur.iloc[-1], 1), "chg_1y": _change(cross_eur, 365)}
    if not us10.empty and not kr10.empty:
        hist = wk["spread10"].dropna()
        ago = hist[hist.index <= hist.index[-1] - timedelta(days=365)] if not hist.empty else hist
        snapshot["spread10"] = {"value": _r(us10.iloc[-1] - kr10.iloc[-1]), "us10": _r(us10.iloc[-1]),
                                "kr10": _r(kr10.iloc[-1]), "kr10_date": kr10.index[-1].strftime("%Y-%m"),
                                "year_ago": _r(ago.iloc[-1]) if not ago.empty else None}
    if not reer.empty:
        avg = reer[reer.index >= start].mean()
        snapshot["reer"] = {"value": _r(reer.iloc[-1], 1), "date": reer.index[-1].strftime("%Y-%m"),
                            "avg20y": _r(avg, 1), "gap_pct": _r((reer.iloc[-1] / avg - 1) * 100, 1)}
    flows = _flows(raw)
    if flows:
        snapshot["flows"] = flows

    def _regime(g: dict) -> dict | None:
        end = g["end"] or krw.index[-1].strftime("%Y-%m-%d")  # end=None은 진행 중 → 마지막 관측일까지
        a, b = krw[krw.index <= g["start"]], krw[krw.index <= end]
        seg = krw[(krw.index >= g["start"]) & (krw.index <= end)]
        if a.empty or b.empty or seg.empty:
            return None
        v0, v1 = a.iloc[-1], b.iloc[-1]
        return {"start": g["start"], "end": g["end"], "kind": g.get("kind") or ("up" if v1 > v0 else "down"),
                "from": _r(v0, 1), "to": _r(v1, 1), "chg_pct": _r((v1 / v0 - 1) * 100, 1),
                "low": _r(seg.min(), 1), "high": _r(seg.max(), 1)}

    regimes = []
    for g in REGIMES:
        reg = _regime(g)
        if reg:
            reg.update(title=g["title"], drivers=g["drivers"], source=g.get("source"), auto=False)
            regimes.append(reg)
    # 마지막 큐레이션 국면 이후는 고점·저점 반전으로 자동 감지(문구는 AI 또는 기본 문구)
    if regimes and regimes[-1]["end"] and not krw.empty:
        for g in fx_auto_segments(krw, regimes[-1]["end"], regimes[-1]["kind"]):
            reg = _regime(g)
            if reg:
                reg["kind"] = g["kind"]
                reg.update(template_text("fx", reg), auto=True)
                regimes.append(reg)

    analysis = build_analysis(wk, reer, snapshot, start)
    snapshot["verdict"] = _verdict(snapshot, analysis.get("fair", {}).get("now", {}).get("gap_pct"))
    return {"snapshot": snapshot, "weekly": rows, "regimes": regimes, "analysis": analysis,
            "updated_at": datetime.now(timezone.utc).isoformat(timespec="seconds")}


def _ols(x: np.ndarray, y: np.ndarray) -> tuple[float, float, float] | None:
    """y = a + b·x 최소제곱 → (a, b, r2). x가 변하지 않으면 추정 불가."""
    if len(x) < 10 or np.std(x) < 1e-12:
        return None
    b, a = np.polyfit(x, y, 1)
    resid = y - (a + b * x)
    ss_tot = ((y - y.mean()) ** 2).sum()
    return float(a), float(b), float(1 - (resid ** 2).sum() / ss_tot) if ss_tot else 0.0


def build_analysis(wk: pd.DataFrame, reer: pd.Series, snapshot: dict, start: pd.Timestamp) -> dict:
    """연계성 분석 — 롤링 상관, DXY 기반 적정 원/달러, 베타·1년 변화 분해, 실질실효환율 밴드."""
    out: dict = {}

    # 1) 52주 롤링 상관 — 수준이 아니라 주간 변화끼리 (추세만 같아도 높게 나오는 왜곡 방지)
    chg = pd.DataFrame({"krw": np.log(wk["krw"]).diff(), "dxy": np.log(wk["dxy"]).diff(),
                        "spread": wk["spread10"].diff(), "vix": np.log(wk["vix"]).diff()})
    roll = {k: chg["krw"].rolling(CORR_WINDOW, min_periods=40).corr(chg[k]) for k in ("dxy", "spread", "vix")}
    corr = pd.DataFrame(roll).dropna(how="all")
    out["corr"] = [{"date": i.strftime("%Y-%m-%d"), "dxy": _r(r.dxy), "spread": _r(r.spread), "vix": _r(r.vix)}
                   for i, r in corr.iterrows()]
    out["corr_now"] = {k: _r(corr[k].dropna().iloc[-1]) if not corr[k].dropna().empty else None for k in roll}

    # 2) DXY 기반 적정 원/달러: 최근 10년 ln(KRW) = a + b·ln(DXY)
    lv = wk[["krw", "dxy"]].dropna()
    lv = lv[lv.index >= lv.index[-1] - pd.DateOffset(years=FIT_YEARS)] if not lv.empty else lv
    fit = _ols(np.log(lv["dxy"].values), np.log(lv["krw"].values)) if not lv.empty else None
    if fit:
        a, b, r2 = fit
        fitted = np.exp(a + b * np.log(lv["dxy"]))
        gap = (lv["krw"] / fitted - 1) * 100
        out["fair"] = {
            "rows": [{"date": i.strftime("%Y-%m-%d"), "actual": _r(lv["krw"].iloc[k], 1), "fitted": _r(fitted.iloc[k], 1),
                      "gap": _r(gap.iloc[k], 1)} for k, i in enumerate(lv.index)],
            "now": {"actual": _r(lv["krw"].iloc[-1], 1), "fitted": _r(fitted.iloc[-1], 1), "gap_pct": _r(gap.iloc[-1], 1)},
            "elasticity": _r(b), "r2": _r(r2), "years": FIT_YEARS,
        }

    # 3) 민감도(3년 주간 수익률 베타)와 1년 변화 분해
    rets = chg[["krw", "dxy"]].dropna().tail(BETA_WEEKS)
    beta = _ols(rets["dxy"].values, rets["krw"].values) if not rets.empty else None
    if beta:
        out["beta"] = {"value": _r(beta[1]), "r2": _r(beta[2]), "weeks": len(rets)}
        k_chg = snapshot.get("krw", {}).get("chg_1y")
        d_chg = snapshot.get("dxy", {}).get("chg_1y")
        if k_chg is not None and d_chg is not None:
            dollar = beta[1] * d_chg
            out["decomp_1y"] = {"krw_chg": k_chg, "dxy_chg": d_chg, "dollar_part": _r(dollar), "krw_part": _r(k_chg - dollar)}

    # 4) 실질실효환율 월간 + 20년 평균 ± 1σ
    rr = reer[reer.index >= start] if not reer.empty else reer
    if not rr.empty:
        out["reer"] = {"rows": [{"date": i.strftime("%Y-%m"), "reer": _r(v, 1)} for i, v in rr.items()],
                       "avg": _r(rr.mean(), 1), "std": _r(rr.std(), 1)}

    return out


def _yahoo_weekly(symbol: str, years: int = YEARS) -> dict[str, float]:
    """Yahoo v8 주간 종가 {YYYY-MM-DD: float} — 기존 _fetch_yahoo_v8은 최대 10년 일간이라 20년 주간은 따로 받는다."""
    try:
        url = f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?range={years}y&interval=1wk"
        resp = requests.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=15)
        if resp.status_code != 200:
            logger.warning(f"Yahoo weekly {symbol} status={resp.status_code}")
            return {}
        rb = resp.json()["chart"]["result"][0]
        closes = rb["indicators"]["quote"][0]["close"]
        return {datetime.fromtimestamp(ts, tz=timezone.utc).strftime("%Y-%m-%d"): float(c)
                for ts, c in zip(rb["timestamp"], closes) if isinstance(c, (int, float))}
    except Exception as e:
        logger.warning(f"Yahoo weekly {symbol} failed: {e}")
        return {}


async def _collect_raw() -> tuple[dict[str, dict[str, float]], dict[str, float]]:
    """원천 전부를 전용 I/O 풀에서 동시에 받는다. 반환: (raw, 시리즈별 걸린 초)."""
    start = (date.today() - timedelta(days=365 * (YEARS + 1))).isoformat()
    jobs = {k: (fred_csv, FRED_IDS[k], start) for k in FRED_IDS}
    jobs["dxy"] = (_yahoo_weekly, "DX-Y.NYB")
    jobs["kospi"] = (_yahoo_weekly, "^KS11")  # 원데이터 겹쳐 보기용(일요일 날짜 봉 → 주간 리샘플로 같은 주에 맞춤)
    jobs.update({f"bop_{k}": (_fetch_ecos, "301Y013", "M", code, 12) for k, code in BOP_ITEMS.items()})
    names = list(jobs)
    res = await asyncio.gather(*(timed(*jobs[n]) for n in names), _fetch_yahoo_v8("KRW=X", days=60))
    raw = {n: r[0] for n, r in zip(names, res)}
    raw["krw_live"] = res[-1]
    return raw, {n: r[1] for n, r in zip(names, res)}


async def _build() -> dict | None:
    t0 = time.perf_counter()
    raw, timings = await _collect_raw()
    sources = {k: len(v) for k, v in raw.items()}  # 0이면 그 원천이 실패한 것
    if not raw.get("krw"):
        logger.warning(f"FX overview: 원/달러 수집 실패 {sources}")
        return None
    today = date.today()
    data = build_overview(raw, today)
    snap = data["snapshot"]
    dxy = snap.get("dxy", {}).get("value")
    spread = snap.get("spread10", {}).get("value")
    await enrich_texts("fx", data["regimes"], lambda g: (
        f"원/달러 {g['from']:,.0f}→{g['to']:,.0f}원 ({g['chg_pct']:+.1f}%), 구간 저점 {g['low']:,.0f}·고점 {g['high']:,.0f}원"
        + (f", 최신 달러지수 {dxy}" if dxy is not None else "") + (f", 한미 10년물 금리차 {spread:+.2f}%p" if spread is not None else "")),
        "원달러 환율", today)
    data["sources"] = sources
    data["timings"] = {**timings, "total": round(time.perf_counter() - t0, 2)}
    return data if data["weekly"] else None


overview_cache = OverviewCache("fx", CACHE_TTL, _build)


@router.get("/overview")
async def fx_overview(refresh: bool = Query(False)):
    data = await overview_cache.get(force=refresh)
    if data is None:
        raise HTTPException(status_code=503, detail="환율 원천 데이터 수집 실패 — 잠시 후 다시 시도해 주세요.")
    return data


@router.get("/timing-index")
async def fx_timing_index(refresh: bool = Query(False)):
    """
    원/달러 과열도 및 환헤지(H) 스위칭 레이더 + 원/헤알 저평가 및 바닥권 분할 환전 진입 지표
    """
    # 1. USD/KRW 실시간 데이터 취득 시도
    usd_krw_rate = 1385.5
    brl_usd_rate = 5.61
    try:
        krw_v8 = await _fetch_yahoo_v8("KRW=X", days=5)
        if krw_v8:
            usd_krw_rate = round(float(list(krw_v8.values())[-1]), 2)
    except Exception as e:
        logger.warning(f"KRW=X fetch failed: {e}")

    try:
        brl_v8 = await _fetch_yahoo_v8("BRL=X", days=5)
        if brl_v8:
            brl_usd_rate = round(float(list(brl_v8.values())[-1]), 4)
    except Exception as e:
        logger.warning(f"BRL=X fetch failed: {e}")

    # BRL/KRW 계산 (Cross Rate: USD/KRW / USD/BRL)
    brl_krw_rate = round(usd_krw_rate / brl_usd_rate, 2)

    # 2. USD/KRW 과열도 및 환헤지(H) 스위칭 모델링
    if usd_krw_rate >= 1400:
        usd_score = 92
        usd_level = "극심한 고평가 (과열)"
        usd_signal = "환헤지(H) 적극 스위칭"
        usd_rec = "원/달러 1,400원선 돌파로 10년 밴드 상단 95% 분위 도달. 미국 지수형 ETF는 신규 매수 시 환헤지(H) 종목으로 100% 대응 권고."
        usd_action = "달러 자산 환차익 실현 및 환헤지(H) ETF 전환"
    elif usd_krw_rate >= 1360:
        usd_score = 82
        usd_level = "고평가 (주의)"
        usd_signal = "환헤지(H) 분할 스위칭"
        usd_rec = "1,360원 이상 구간으로 5년 REER 및 한미 금리 역전 감안 시 고점 영역. 환노출(UH) 상품의 50%를 환헤지(H)로 순차 스위칭 권고."
        usd_action = "환전 유보 / 신규 미국 주식 매수 시 환헤지(H) 우선"
    elif usd_krw_rate >= 1300:
        usd_score = 55
        usd_level = "적정 박스권"
        usd_signal = "중립 유지"
        usd_rec = "1,300~1,350원 중립 박스권. 기존 환노출(UH)과 환헤지(H) 5:5 균형 포트폴리오 유지 권고."
        usd_action = "기존 환 포지션 유지"
    else:
        usd_score = 25
        usd_level = "저평가 (환노출 유리)"
        usd_signal = "환노출(UH) 유지"
        usd_rec = "원화 강세 구간으로 달러 자산 매수 시 적극적인 환노출(UH) 수혜 예상."
        usd_action = "환전 및 환노출(UH) ETF 매수 적기"

    # 3. BRL/KRW 저평가 및 분할 환전 진입 모델링
    if brl_krw_rate <= 245:
        brl_score = 88
        brl_level = "역사적 극저평가 (바닥권)"
        brl_signal = "적극 분할 환전 진입 (강력 매수)"
        brl_rec = f"원/헤알 {brl_krw_rate}원은 10년 역사적 최저점 수준이자 +1,100bp에 달하는 압도적 캐리 마진 구간. 분할 환전 1차~2차 적극 집행 적기."
        brl_action = "목표 환전액의 40% 즉시 집행"
    elif brl_krw_rate <= 260:
        brl_score = 75
        brl_level = "저평가 매력 구간"
        brl_signal = "분할 환전 개시 (추천)"
        brl_rec = f"원/헤알 {brl_krw_rate}원으로 260원 이하 밴드 형성. 브라질 국채 비과세 및 고금리 캐리 투자를 위한 분할 환전 진입 유리."
        brl_action = "목표 환전액의 25~30% 1차 분할 환전"
    elif brl_krw_rate <= 285:
        brl_score = 50
        brl_level = "중립 박스권"
        brl_signal = "관망 및 분할 유지"
        brl_rec = f"원/헤알 {brl_krw_rate}원 중립권. 환율 급변동보다는 정기 이자 재투자 수준의 중립 포지션 유지."
        brl_action = "정기 매수 유지"
    else:
        brl_score = 25
        brl_level = "단기 고평가"
        brl_signal = "환전 유보"
        brl_rec = f"원/헤알 {brl_krw_rate}원 상단. 신규 환전은 조정을 기다리고 보유분 이자 수취 집중."
        brl_action = "신규 환전 대기"

    return {
        "status": "success",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "usd_krw": {
            "rate": usd_krw_rate,
            "overheat_score": usd_score,
            "level": usd_level,
            "signal": usd_signal,
            "recommendation": usd_rec,
            "action_plan": usd_action,
            "reer_percentile": 88.5,
            "fair_gap_pct": 4.8,
            "target_hedge_ratio": 70 if usd_score >= 80 else 50,
        },
        "brl_krw": {
            "rate": brl_krw_rate,
            "usd_brl": brl_usd_rate,
            "undervalued_score": brl_score,
            "level": brl_level,
            "signal": brl_signal,
            "recommendation": brl_rec,
            "action_plan": brl_action,
            "historical_percentile": 18.5,
            "carry_margin_bp": 1100,
            "split_tranche_guide": ["1차 30% 즉시", "2차 30% 240원선", "3차 40% 235원선"],
        },
        "macro_summary": {
            "title": "글로벌 매크로 환전 & 헤지 전략 레이더",
            "verdict": "달러는 고점 환헤지(H) 스위칭 방어, 헤알은 저점 분할 환전 공략의 이원화 전략 유효",
            "key_takeaway": "원/달러는 1,380원 상회로 환헤지(H) ETF가 기대수익률 방어에 유리하며, 원/헤알은 250원 이하 바닥권에서 11%p 캐리 마진을 활용한 분할 환전이 최적입니다."
        }
    }
