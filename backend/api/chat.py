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


class ChatRequest(BaseModel):
    message: str


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

    # --- Build prompt ---
    prompt = f"""당신은 'ETF Lens' 서비스의 친절하고 전문적인 AI 어시스턴트입니다.
사용자의 질문에 답변할 때, 아래의 **실시간 시스템 데이터**를 최우선으로 참고하여 정확한 수치를 기반으로 대답하세요.
데이터에 없는 내용은 일반 금융 지식으로 보완하되, 출처(시스템 데이터 vs 외부 지식)를 명확히 밝혀주세요.
사용자가 인사하면 반갑게 맞이하고, 어떤 ETF 정보를 찾는지 물어보세요.

[실시간 시스템 데이터 - 배당/커버드콜/인컴 ETF 실시간 수익률 TOP 20 (1개월 수익률 기준 내림차순)]
{etf_context}

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
