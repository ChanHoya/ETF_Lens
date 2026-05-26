"""
ETF Lens AI Chatbot endpoint.
Uses Gemini AI (google.genai SDK) with live ETF performance data
from FinanceDataReader and yfinance.
"""

import asyncio
import os
import re

from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

# Load environment variables from backend/.env
_current_dir = os.path.dirname(os.path.abspath(__file__))
_env_path = os.path.join(_current_dir, "..", ".env")
load_dotenv(dotenv_path=_env_path, override=True)

router = APIRouter()

# --- Gemini model fallback order (try each until one works) ---
_GEMINI_MODELS = [
    "gemini-2.5-flash-lite",
    "gemini-2.5-flash",
    "gemini-2.0-flash-lite",
    "gemini-2.0-flash",
]


from typing import Optional, Dict, Any

class ChatRequest(BaseModel):
    message: str
    portfolio_data: Optional[Dict[str, Any]] = None


class ChatResponse(BaseModel):
    reply: str


def _fetch_etf_context_sync() -> str:
    """
    Synchronous helper: fetches live KRX ETF list via FinanceDataReader,
    then downloads 3-month prices via yfinance to compute 1M / 3M returns.
    Called inside asyncio.to_thread() to avoid blocking the event loop.
    """
    import FinanceDataReader as fdr
    import pandas as pd
    import yfinance as yf

    # 1. Full KRX ETF list
    df_kr = fdr.StockListing("ETF/KR")
    if df_kr.empty:
        return "ETF 데이터를 가져오지 못했습니다."

    total_etf_count = len(df_kr)  # ← full KRX ETF count for general Q&A

    # 2. Filter: match CoveredCallTab's exact filter logic
    #    (same as UI: name includes '커버드콜' OR '프리미엄' OR '타겟')
    cc_keywords = "커버드콜|프리미엄|타겟"
    df_cc = df_kr[df_kr["Name"].str.contains(cc_keywords, na=False, regex=True)]
    cc_count = len(df_cc)

    # Also count other major categories for general Q&A
    cat_counts: dict[str, int] = {}
    for cat, kw in [
        ("배당", "배당"),
        ("AI/반도체", "AI|반도체"),
        ("2차전지", "2차전지"),
        ("채권", "채권"),
        ("원자재/금", "금|원자재|원유"),
    ]:
        cat_counts[cat] = int(
            df_kr["Name"].str.contains(kw, na=False, regex=True).sum()
        )

    if "MarCap" in df_cc.columns:
        df_cc = df_cc.sort_values(by="MarCap", ascending=False)

    # Full covered call list + top 30 for yfinance prices
    df_all = df_cc
    df_top = df_cc.head(30)
    rows = df_top.to_dict(orient="records")

    # 3. Build ticker list
    tickers: list[str] = []
    code_to_ticker: dict[str, str] = {}
    for r in rows:
        code = str(r["Symbol"]).zfill(6)
        ticker = f"{code}.KS"
        tickers.append(ticker)
        code_to_ticker[code] = ticker

    # 4. Download price history
    try:
        df_price = yf.download(tickers, period="3mo", progress=False, timeout=20)
        if isinstance(df_price.columns, pd.MultiIndex):
            prices = (
                df_price["Close"] if "Close" in df_price.columns.levels[0] else df_price
            )
        else:
            prices = df_price["Close"] if "Close" in df_price.columns else df_price
    except Exception as yf_err:
        print(f"[chat.py] yfinance error: {yf_err}")
        prices = pd.DataFrame()

    # 5. Compute returns
    all_cc_names = [
        f"{r['Name']} ({str(r['Symbol']).zfill(6)})"
        for r in df_all.to_dict(orient="records")
    ]
    cat_summary = " | ".join(f"{cat}: {cnt}개" for cat, cnt in cat_counts.items())
    context_lines: list[str] = [
        "[KRX 전체 ETF 현황]",
        f"- 전체 ETF 수: {total_etf_count}개",
        f"- 커버드콜/프리미엄/타겟 ETF: {cc_count}개",
        f"- 카테고리별: {cat_summary}",
        "",
        f"[커버드콜/프리미엄 전체 {cc_count}개 종목 목록]",
        ", ".join(all_cc_names),
        "",
    ]
    context_lines.append("[시가총액 상위 30개 실시간 수익률 데이터]")
    for r in rows:
        code = str(r["Symbol"]).zfill(6)
        name = r["Name"]
        marcap = r.get("MarCap", 0)
        aum_str = f"{int(marcap // 100_000_000)}억" if marcap else "N/A"

        ticker = code_to_ticker[code]
        yield_1m: float | str = "N/A"
        yield_3m: float | str = "N/A"

        if not prices.empty and ticker in prices.columns:
            series = prices[ticker].dropna()
            if len(series) > 1:
                current = series.iloc[-1]
                yield_3m = round(((current / series.iloc[0]) - 1) * 100, 2)
                idx_1m = max(0, len(series) - 21)
                yield_1m = round(((current / series.iloc[idx_1m]) - 1) * 100, 2)

        context_lines.append(
            f"[{name} ({code})] 1개월 수익률: {yield_1m}%, 3개월 수익률: {yield_3m}%, 시가총액: {aum_str}"
        )

    # 6. Sort best 1M performers first
    def _sort_key(line: str) -> float:
        m = re.search(r"1개월 수익률: ([-\d\.]+)%", line)
        return float(m.group(1)) if m else -999.0

    context_lines.sort(key=_sort_key, reverse=True)
    return "\n".join(context_lines)


def _call_gemini_sync(api_key: str, prompt: str) -> str:
    """
    Synchronous Gemini call with model fallback.
    Called inside asyncio.to_thread() to avoid blocking the event loop.
    """
    from google import genai

    client = genai.Client(api_key=api_key)
    last_err: Exception | None = None
    for model_name in _GEMINI_MODELS:
        try:
            response = client.models.generate_content(model=model_name, contents=prompt)
            return response.text
        except Exception as e:
            err_str = str(e)
            # If quota exhausted, try next model; otherwise raise immediately
            if "429" in err_str or "quota" in err_str.lower():
                print(f"[chat.py] {model_name} quota exceeded, trying next...")
                last_err = e
                continue
            raise e
    raise last_err  # type: ignore[misc]


@router.post("", response_model=ChatResponse)
async def chat_with_etf_assistant(request: ChatRequest):
    """
    Accepts a user message, fetches live ETF data for context (non-blocking),
    and uses Gemini AI to generate a response.
    """
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=500, detail="GEMINI_API_KEY is not configured on the server."
        )

    user_message = request.message

    # --- Fetch ETF context in a thread (yfinance is synchronous) ---
    try:
        etf_context = await asyncio.to_thread(_fetch_etf_context_sync)
    except Exception as ctx_err:
        print(f"[chat.py] ETF context error: {ctx_err}")
        etf_context = "실시간 ETF 데이터를 가져오는 데 실패했습니다."

    # --- Parse user portfolio data ---
    portfolio_context = ""
    if request.portfolio_data:
        try:
            kis_raw = request.portfolio_data.get("kis_raw", {})
            summary = kis_raw.get("summary", {})
            holdings = kis_raw.get("holdings", [])
            
            summary_lines = [
                "[사용자 포트폴리오 요약]",
                f"- 총 자산: {int(summary.get('total_asset', 0)):,}원",
                f"- 총 평가금액: {int(summary.get('total_eval_amount', 0)):,}원",
                f"- 총 손익: {int(summary.get('total_profit_loss', 0)):,}원",
                f"- 예수금(현금): {int(summary.get('cash_balance', 0)):,}원",
            ]
            
            holdings_lines = ["[사용자 보유 종목 목록]"]
            for idx, h in enumerate(holdings, 1):
                h_name = h.get("name", "Unknown")
                h_code = h.get("code", "")
                h_qty = h.get("qty", 0)
                h_eval = int(h.get("eval_amount", 0))
                h_pl = int(h.get("profit_loss", 0))
                h_rt = h.get("return_rate", 0)
                h_asset = h.get("category_asset", "기타")
                h_region = h.get("category_region", "기타")
                holdings_lines.append(
                    f"{idx}. {h_name} ({h_code}) | 보유수량: {h_qty}주 | 평가금액: {h_eval:,}원 | 손익: {h_pl:,}원 ({h_rt}%) | 자산구분: {h_asset} | 지역: {h_region}"
                )
            
            portfolio_context = "\n".join(summary_lines) + "\n\n" + "\n".join(holdings_lines)
        except Exception as p_err:
            print(f"[chat.py] Portfolio parsing error: {p_err}")
            portfolio_context = "사용자의 포트폴리오 데이터를 파싱하는 데 실패했습니다."

    # --- Build prompt ---
    prompt = f"""당신은 'ETF Lens' 서비스의 친절하고 전문적인 AI 어시스턴트입니다.
사용자의 질문에 답변할 때, 아래의 **실시간 시스템 데이터** 및 **사용자 포트폴리오 데이터**를 최우선으로 참고하여 정확한 수치를 기반으로 대답하세요.
데이터에 없는 내용은 일반 금융 지식으로 보완하되, 출처(시스템 데이터 vs 외부 지식)를 명확히 밝혀주세요.
질문이 사용자의 보유 자산이나 포트폴리오에 관한 것이라면, 제공된 사용자 포트폴리오 데이터를 가공하여 분석 및 답변을 제공해 주세요.

[실시간 시스템 데이터 - 배당/커버드콜/인컴 ETF 실시간 수익률 TOP 20 (1개월 수익률 기준 내림차순)]
{etf_context}

{f"[사용자 포트폴리오 데이터]\n{portfolio_context}" if portfolio_context else "[사용자 포트폴리오 데이터]\n- 현재 연동된 포트폴리오 데이터가 없거나 인증되지 않았습니다."}

[참고 정보 - 섹터별 주요 종목 목록]
- 우주항공 섹터 종목: KODEX 미국우주항공, ACE 미국우주테크액티브, Tiger 미국우주테크, SOL 미국우주항공TOP10, US-Space (ARKX), Rocket Lab (로켓랩, RKLB), EchoStar (에코스타, SATS), AST SpaceMobile (스페이스모바일, ASTS), Intuitive Machines (인튜이티브 머신스, LUNR), Redwire (레드와이어, RDW), Planet Labs (플래닛랩스, PL), L3Harris Technologies (LHX), Advanced Micro Devices (AMD), Teradyne (TER), Boeing (보잉, BA), Globalstar (글로벌스타, GSAT), Kratos Defense (KTOS), Deere & Company (디어앤컴퍼니, DE), Archer Aviation (ACHR), MDA Space (MDA 스페이스, MDALF)
- 바이오헬스케어 섹터 종목: KoAct 바이오헬스케어액티브, TIME K바이오액티브, KODEX 바이오, TIGER 헬스케어, TIGER 바이오TOP10, 삼성바이오로직스, 셀트리온, 알테오젠, 리가켐바이오, 유한양행, 한미약품, SK바이오팜, HLB, 삼천당제약, 셀트리온제약, 바이오니아, 에스티팜, 지아이이노베이션, 펩트론, 에이비엘바이오

[사용자 질문]
{user_message}
"""

    # --- Call Gemini in a thread ---
    try:
        reply_text = await asyncio.to_thread(_call_gemini_sync, api_key, prompt)
    except Exception as ai_err:
        print(f"[chat.py] Gemini error: {ai_err}")
        raise HTTPException(
            status_code=500,
            detail=f"AI 모델 호출 중 오류가 발생했습니다: {str(ai_err)[:200]}",
        )

    return ChatResponse(reply=reply_text)
