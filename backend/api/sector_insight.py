"""
섹터별 'Gemini Expert Report' 동적 생성 엔드포인트.

각 섹터(우주/반도체/에너지/바이오) 리포트를 라이브 시세 데이터(현재가, 1·3·6·12개월
수익률, 52주 고점 대비 낙폭)로 그라운딩하여 Gemini가 '냉철한 현재 분석'으로 생성한다.
생성본은 DB(SectorInsight)에 생성 일시와 함께 저장되며, 다음 접속 시 저장본을 반환한다.

- GET  /api/v1/sector-insight/{sector}            → 저장본(content+generated_at) 반환
- POST /api/v1/sector-insight/{sector}/generate   → Gemini로 재생성 후 저장·반환
"""

import asyncio
import json
import os
import re
from datetime import datetime, timezone, timedelta

from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import get_db
from db.models import SectorInsight

_current_dir = os.path.dirname(os.path.abspath(__file__))
_env_path = os.path.join(_current_dir, "..", ".env")
load_dotenv(dotenv_path=_env_path, override=True)

router = APIRouter()

_KST = timezone(timedelta(hours=9))

_GEMINI_MODELS = [
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
]

# ── 섹터 설정: 그라운딩용 대표 티커 + 리포트 메타 ──────────────────────────────
# KR ETF는 6자리 코드 → yfinance '.KS' 접미사. US는 원티커.
_SECTORS: dict[str, dict] = {
    "space": {
        "label": "우주항공",
        "kr_etfs": {"488050": "KODEX 미국우주항공", "484930": "ACE 미국우주테크액티브",
                    "488100": "Tiger 미국우주테크", "495470": "SOL 미국우주항공TOP10"},
        "us": {"ARKX": "ARK Space ETF", "UFO": "Procure Space ETF", "RKLB": "Rocket Lab",
               "ASTS": "AST SpaceMobile", "LUNR": "Intuitive Machines", "RDW": "Redwire",
               "PL": "Planet Labs", "LHX": "L3Harris"},
    },
    "semi": {
        "label": "AI 반도체",
        "kr_etfs": {"396500": "TIGER Fn반도체TOP10", "469150": "RISE 미국AI밸류체인",
                    "471990": "KODEX 미국반도체MV", "455850": "SOL 반도체후공정"},
        "us": {"SMH": "VanEck 반도체 ETF", "SOXX": "iShares 반도체 ETF", "NVDA": "NVIDIA",
               "AMD": "AMD", "TSM": "TSMC", "ASML": "ASML", "AVGO": "Broadcom", "MU": "Micron"},
    },
    "energy": {
        "label": "에너지/전력 인프라",
        "kr_etfs": {"487240": "KODEX 미국AI전력핵심인프라", "491820": "RISE 미국원자력",
                    "487230": "ACE 미국전력산업", "486450": "TIGER 글로벌전력망"},
        "us": {"XLU": "Utilities Select", "NLR": "원자력 ETF", "GRID": "전력망 ETF",
               "VST": "Vistra", "CEG": "Constellation", "POWR": "PowerSchool", "PAVE": "인프라 ETF"},
    },
    "semiparts": {
        "label": "반도체 소부장(소재·부품·장비)",
        "kr_etfs": {"471760": "TIGER AI반도체핵심공정", "471990": "KODEX AI반도체핵심장비",
                    "455850": "SOL AI반도체소부장", "474590": "WON 반도체밸류체인액티브",
                    "464920": "PLUS 일본반도체소부장", "446770": "ACE 글로벌반도체TOP4 Plus"},
        "us": {"SOXX": "iShares 반도체 ETF", "XSD": "SPDR 반도체(동일가중) ETF",
               "ASML": "ASML", "AMAT": "Applied Materials", "LRCX": "Lam Research",
               "KLAC": "KLA", "TER": "Teradyne", "8035.T": "Tokyo Electron"},
    },
    "bio": {
        "label": "바이오/헬스케어",
        "kr_etfs": {"462900": "KoAct 바이오헬스케어액티브", "463050": "TIMEFOLIO K바이오액티브",
                    "244580": "KODEX 바이오", "143860": "TIGER 헬스케어", "364970": "TIGER 바이오TOP10"},
        "us": {"XBI": "SPDR 바이오 ETF", "IBB": "iShares 바이오 ETF", "LLY": "Eli Lilly",
               "NVO": "Novo Nordisk", "VRTX": "Vertex", "AMGN": "Amgen"},
    },
}


def _fetch_market_context_sync(sector: str) -> str:
    """대표 종목의 1년 일봉을 받아 현재가/수익률/52주 고점 대비 낙폭을 표로 반환.
    국내(KR) ETF는 FinanceDataReader, 해외(US)는 yfinance를 사용한다
    (yfinance는 신규 KR ETF 코드를 인식하지 못하는 경우가 많음)."""
    import pandas as pd
    import yfinance as yf
    import FinanceDataReader as fdr

    cfg = _SECTORS[sector]
    series: dict[str, "pd.Series"] = {}  # 표시명 -> Close 시계열

    # 1) 국내 ETF: FinanceDataReader
    start = (datetime.now(_KST) - timedelta(days=400)).strftime("%Y-%m-%d")
    for code, name in cfg["kr_etfs"].items():
        try:
            df = fdr.DataReader(code, start)
            s = df["Close"].dropna() if "Close" in df.columns else pd.Series(dtype=float)
            if len(s) >= 5:
                series[f"{name} ({code})"] = s
        except Exception:
            pass

    # 2) 해외: yfinance 일괄 다운로드
    us_tickers = list(cfg["us"].keys())
    try:
        raw = yf.download(us_tickers, period="1y", progress=False, timeout=30)
        prices = raw["Close"] if isinstance(raw.columns, pd.MultiIndex) and "Close" in raw.columns.levels[0] else raw
        for tk, name in cfg["us"].items():
            try:
                s = prices[tk].dropna() if tk in prices.columns else pd.Series(dtype=float)
            except Exception:
                s = pd.Series(dtype=float)
            if len(s) >= 5:
                series[f"{name} ({tk})"] = s
    except Exception as e:
        print(f"[sector_insight] yfinance error: {e}")

    if not series:
        return "라이브 시세 데이터를 가져오지 못했습니다. 일반 지식 기반으로 작성하세요."

    lines = ["[대표 종목 라이브 시세 — 모멘텀/낙폭]"]
    for disp, s in series.items():
        cur = s.iloc[-1]

        def _ret(days: int):
            i = max(0, len(s) - days)
            base = s.iloc[i]
            return round((cur / base - 1) * 100, 1) if base else None

        hi = s.max()
        dd_from_high = round((cur / hi - 1) * 100, 1) if hi else None  # 52주 고점 대비 (음수=낙폭)
        lines.append(
            f"- {disp}: 1M {_ret(21)}% / 3M {_ret(63)}% / 6M {_ret(126)}% / 1Y {_ret(252)}% "
            f"| 52주고점대비 {dd_from_high}%"
        )
    return "\n".join(lines)


_SCHEMA_HINT = """반드시 아래 JSON 스키마만 출력하라(코드펜스/설명 금지):
{
  "tab1": {"cards": [{"title": "소제목(15자 내외)", "body": "2~3문장 분석"}]},   // 3개
  "etfs": {
    "domestic": {"items": [{"name": "ETF명 (코드): ", "desc": "1~2문장"}]},        // 2~3개
    "overseas": {"items": [{"name": "ETF명 (티커 | AUM): ", "desc": "1~2문장"}]}     // 2~3개
  },
  "strategy": {
    "models": {"items": [{"name": "공격성장형 등 (비중): ", "detail": "구체 배분"}]},   // 3개
    "guides": {"items": [{"name": "진입기준 제목: ", "body": "1~2문장"}]},             // 2개
    "footnote": "섹터 리스크 한 줄 요약"
  }
}"""


def _build_prompt(sector: str, market_ctx: str) -> str:
    cfg = _SECTORS[sector]
    today = datetime.now(_KST).strftime("%Y년 %m월 %d일")
    return f"""너는 {cfg['label']} 섹터를 담당하는 냉철한 애널리스트다. 오늘은 {today}.
아래 라이브 시세는 실제 현재 데이터다. 특히 '52주고점대비' 낙폭을 핵심 신호로 삼아라.
- 초기 과열 후 고점 대비 크게 하락(예: -40% 이상)했다면, 과열 해소·밸류에이션 리셋·바닥 탐색
  관점으로 냉정하게 서술하라. 막연한 장밋빛 전망 금지.
- 반대로 고점 부근이면 과열/되돌림 리스크를 경고하라.
- 수치를 인용해 근거를 제시하되, 오래된 뉴스 나열이 아니라 '지금' 무엇이 바뀌었는지 인사이트를 줘라.
- 한국어로, 투자 권유가 아닌 분석/교육 톤. 각 문장은 간결하게.

{market_ctx}

tab1은 현재 국면의 핵심 매크로/사이클 포인트 3가지, etfs는 국내·해외 대표 ETF 분석,
strategy는 현 국면에 맞춘 자산배분 모델 3종과 진입 가이드 2종.

{_SCHEMA_HINT}"""


def _call_gemini_sync(api_key: str, prompt: str) -> str:
    from google import genai

    client = genai.Client(api_key=api_key)
    last_err: Exception | None = None
    for model_name in _GEMINI_MODELS:
        try:
            resp = client.models.generate_content(model=model_name, contents=prompt)
            return resp.text
        except Exception as e:
            es = str(e)
            if "429" in es or "quota" in es.lower():
                print(f"[sector_insight] {model_name} quota, trying next...")
                last_err = e
                continue
            raise e
    raise last_err  # type: ignore[misc]


def _extract_json(text: str) -> dict:
    """코드펜스/잡설을 제거하고 첫 번째 JSON 오브젝트를 파싱."""
    t = text.strip()
    t = re.sub(r"^```(?:json)?\s*|\s*```$", "", t).strip()
    try:
        return json.loads(t)
    except Exception:
        m = re.search(r"\{.*\}", t, re.DOTALL)
        if not m:
            raise ValueError("Gemini 응답에서 JSON을 찾지 못했습니다.")
        return json.loads(m.group(0))


class InsightResponse(BaseModel):
    sector: str
    content: dict | None = None
    generated_at: str | None = None


@router.get("/{sector}", response_model=InsightResponse)
async def get_sector_insight(sector: str, db: AsyncSession = Depends(get_db)):
    if sector not in _SECTORS:
        raise HTTPException(status_code=404, detail="알 수 없는 섹터입니다.")
    row = (await db.execute(select(SectorInsight).where(SectorInsight.sector == sector))).scalar_one_or_none()
    if not row or not row.content:
        return InsightResponse(sector=sector, content=None, generated_at=None)
    try:
        content = json.loads(row.content)
    except Exception:
        content = None
    return InsightResponse(
        sector=sector,
        content=content,
        generated_at=row.generated_at.isoformat() if row.generated_at else None,
    )


@router.post("/{sector}/generate", response_model=InsightResponse)
async def generate_sector_insight(sector: str, db: AsyncSession = Depends(get_db)):
    if sector not in _SECTORS:
        raise HTTPException(status_code=404, detail="알 수 없는 섹터입니다.")
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY가 설정되지 않았습니다.")

    market_ctx = await asyncio.to_thread(_fetch_market_context_sync, sector)
    prompt = _build_prompt(sector, market_ctx)

    try:
        raw = await asyncio.to_thread(_call_gemini_sync, api_key, prompt)
        content = _extract_json(raw)
    except Exception as e:
        print(f"[sector_insight] generate error: {e}")
        raise HTTPException(status_code=500, detail=f"리포트 생성 중 오류: {str(e)[:200]}")

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    row = (await db.execute(select(SectorInsight).where(SectorInsight.sector == sector))).scalar_one_or_none()
    payload = json.dumps(content, ensure_ascii=False)
    if row:
        row.content = payload
        row.generated_at = now
    else:
        db.add(SectorInsight(sector=sector, content=payload, generated_at=now))
    await db.commit()

    return InsightResponse(sector=sector, content=content, generated_at=now.isoformat())
