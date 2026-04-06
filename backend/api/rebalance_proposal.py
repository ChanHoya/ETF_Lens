import os
import time
import json
import asyncio
from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from google import genai
from google.genai import types

from db.database import get_db
from core.logger import get_logger
from api.peer_analysis import _analyze_one

logger = get_logger("rebalance_proposal")

router = APIRouter()

# Schema for input payload (though we'll calculate everything server-side for security)
class RebalanceRequest(BaseModel):
    # Optional parameters could go here. e.g., risk_tolerance
    pass

# We will cache the proposal for a user session to prevent duplicate billing
_PROPOSAL_CACHE: dict[str, dict] = {}
_PROPOSAL_CACHE_TTL = 3600 * 2  # 2 hours

_GEMINI_MODELS = [
    "gemini-2.5-flash-lite",
    "gemini-2.5-flash",
    "gemini-2.0-flash-lite",
    "gemini-2.0-flash",
]

# JSON schema definition for Gemini's structured output response
rebalance_response_schema = types.Schema(
    type=types.Type.OBJECT,
    properties={
        "overall_summary": types.Schema(
            type=types.Type.STRING,
            description="Overall summary of the portfolio competitiveness and brief advice."
        ),
        "recommendations": types.Schema(
            type=types.Type.ARRAY,
            description="List of recommendations per holding.",
            items=types.Schema(
                type=types.Type.OBJECT,
                properties={
                    "code": types.Schema(type=types.Type.STRING, description="The 6-digit ETF code."),
                    "name": types.Schema(type=types.Type.STRING, description="The name of the ETF."),
                    "action": types.Schema(
                        type=types.Type.STRING,
                        description="Recommendation action: KEEP, REPLACE, or ADD.",
                        enum=["KEEP", "REPLACE", "ADD"]
                    ),
                    "reasoning": types.Schema(type=types.Type.STRING, description="Detailed reasoning for this action based on returns, MDD, and peer averages."),
                    "alternative_etf": types.Schema(type=types.Type.STRING, description="Suggested alternative ETF code and name. E.g. '396500 (TIGER 반도체TOP10)' or null if keeping.", nullable=True),
                },
                required=["code", "name", "action", "reasoning"]
            )
        )
    },
    required=["overall_summary", "recommendations"]
)


def _call_gemini_rebalance(portfolio_data_text: str) -> dict:
    """Calls Gemini API synchronously with structured payload."""
    api_key = os.environ.get("GEMINI_API_KEY", "")
    if not api_key:
        raise ValueError("GEMINI_API_KEY not configured.")

    client = genai.Client(api_key=api_key)

    system_prompt = """
당신은 최고의 ETF 포트폴리오 퀀트 및 자산 관리 AI 어시스턴트입니다.
사용자의 보유 ETF들과 동일 테마(Peer Group)의 경쟁 ETF들의 성과를 분석하여, 각 종목별로 리밸런싱 지침을 제안해야 합니다.

판단 기준:
1. 내 종목의 1개월, 3개월 수익률이 해당 테마 피어 평균(Peer Avg) 대비 심각하게 저조한 경우 교체(REPLACE)를 고려하십시오.
2. 교체를 추천한다면, 해당 테마 내에서 1/3개월 수익률이 가장 우수했던 다른 ETF를 대안(alternative_etf)으로 명시하십시오. (예: "396500 (TIGER 반도체TOP10)")
3. 성과가 평균 이상이거나 방어율이 훌륭하다면 유지(KEEP)를 제안하십시오.
4. 분석결과는 제공된 JSON 스키마 구조를 완벽하게 준수하여야 합니다.
5. 어투는 전문적이고 논리적이며 명확해야 합니다.
"""

    prompt = f"### 포트폴리오 분석 원시 데이터 ###\n{portfolio_data_text}\n\n위 데이터를 기반으로 리밸런싱을 제안해 주세요."

    last_err = None
    for model_name in _GEMINI_MODELS:
        try:
            logger.info(f"[rebalance] Attempting with model {model_name}")
            response = client.models.generate_content(
                model=model_name,
                contents=prompt,
                config=types.GenerateContentConfig(
                    system_instruction=system_prompt,
                    response_mime_type="application/json",
                    response_schema=rebalance_response_schema,
                    temperature=0.2, # Low temperature for analytical consistency
                ),
            )
            return json.loads(response.text)
        except Exception as e:
            logger.warning(f"[rebalance] Format failed with {model_name}: {e}")
            last_err = e

    raise last_err or Exception("All GenAI attempts failed.")


@router.post("/rebalance-proposal")
async def get_rebalance_proposal(request: Request, db: AsyncSession = Depends(get_db)):
    """
    포트폴리오 분석결과(Peer 비교결과)를 내부적으로 재가공하여 LLM에 프롬프트로 전달한 후,
    결과 JSON 포맷을 반환합니다.
    """
    now_ts = time.time()
    user_id = "default_user" # Add proper session based user_id logic if desired.
    cache_key = f"rebalance_{user_id}"

    cached = _PROPOSAL_CACHE.get(cache_key)
    if cached and (now_ts - cached["ts"] < _PROPOSAL_CACHE_TTL):
        logger.info("[rebalance] Returning cached proposal.")
        return {"status": "success", "data": cached["data"], "cached": True}

    from api.my_assets import get_my_portfolio
    portfolio = await get_my_portfolio(request=request, db=db)
    all_h = portfolio.get("kis_raw", {}).get("holdings", [])
    domestic = [
        h for h in all_h
        if h.get("code", "").isdigit() and len(h.get("code", "")) == 6
    ]

    if not domestic:
        return {"status": "success", "data": None, "msg": "국내 상장 보유 종목이 없습니다."}

    total_portfolio = sum(float(h.get("eval_amount", 0)) for h in domestic)
    loop = asyncio.get_event_loop()
    
    # 1. Fetch peer evaluation for all domestic holdings concurrently
    async def process_holding(h: dict) -> dict:
        code = h.get("code", "")
        return await loop.run_in_executor(
            None,
            _analyze_one,
            code,
            h.get("name", ""),
            float(h.get("eval_amount", 0)),
            float(total_portfolio),
        )

    items_coros = [process_holding(h) for h in domestic]
    analyzed_items = await asyncio.gather(*items_coros)

    # 2. Build text payload for Gemini
    prompt_lines = ["현재 포트폴리오 분석 내역:"]
    for item in analyzed_items:
        code = item.get("code")
        name = item.get("name")
        cat = item.get("category")
        weight = item.get("weight_pct")
        
        my_1m = item.get("return_1m")
        my_3m = item.get("return_3m")
        peer_avg_1m = item.get("peer_avg_1m")
        peer_avg_3m = item.get("peer_avg_3m")
        
        peers_1m = item.get("peers_sorted_1m", [])
        top_peer_1m = f"{peers_1m[0].get('name')} ({peers_1m[0].get('return_1m')}%)" if peers_1m else "데이터부족"

        line = (
            f"종목: {name}({code}) | 비중: {weight}% | 테마: {cat}\n"
            f"  - 1M 수익률: 내 종목 {my_1m}% vs 테마평균 {peer_avg_1m}%, 1위 종목: {top_peer_1m}\n"
            f"  - 3M 수익률: 내 종목 {my_3m}% vs 테마평균 {peer_avg_3m}%\n"
        )
        prompt_lines.append(line)

    payload_text = "\n".join(prompt_lines)

    # 3. Call Gemini
    try:
        result_json = await asyncio.to_thread(_call_gemini_rebalance, payload_text)
        
        # Cache successful result
        _PROPOSAL_CACHE[cache_key] = {"data": result_json, "ts": now_ts}
        
        return {
            "status": "success",
            "data": result_json,
            "cached": False
        }
    except Exception as e:
        logger.error(f"[rebalance] API Error: {e}")
        return {"status": "error", "msg": str(e)}
