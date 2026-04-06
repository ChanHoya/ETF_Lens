import pandas as pd
import json
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from db.models import ETFMaster


async def analyze_portfolio(holdings: list, db: AsyncSession):
    """
    Analyzes a portfolio of holdings, matching against etf_master to compute:
    1. Overall Portfolio Factor Balance
    2. True underlying stock exposures (X-Ray)
    3. Dividend and Fee aggregations
    """
    if not holdings:
        return {}

    # Extract symbols
    symbols = [h["code"] for h in holdings]
    total_eval = sum(h["eval_amount"] for h in holdings)

    if total_eval == 0:
        return {}

    # Add weights
    for h in holdings:
        h["weight"] = h["eval_amount"] / total_eval

    # Fetch corresponding etf_master data
    query = select(ETFMaster).where(ETFMaster.code.in_(symbols))
    result = await db.execute(query)
    etfs = result.scalars().all()
    etf_map = {e.code: e for e in etfs}

    analyzed = {
        "factor_balance": {},
        "true_holdings": {},
        "metrics": {
            "weighted_fee": 0,
            "weighted_dividend": 0,
            "etf_ratio": 0,  # % of portfolio that is matched to known ETFs
        },
        "matched_holdings": [],
    }

    matched_eval = 0
    factors = {
        "profit": 0,
        "growth": 0,
        "value": 0,
        "div": 0,
        "mom": 0,
        "vol": 0,
        "fee": 0,
    }

    for h in holdings:
        code = h["code"]
        w = h["weight"]

        if code in etf_map:
            etf = etf_map[code]
            matched_eval += h["eval_amount"]

            # Weighted metrics
            analyzed["metrics"]["weighted_fee"] += (etf.tot_fee or 0) * w

            # Extract basic_info_json
            basic_info = {}
            if etf.basic_info_json:
                try:
                    basic_info = json.loads(etf.basic_info_json)
                except:
                    pass

            analyzed["metrics"]["weighted_dividend"] += (
                basic_info.get("분배율", 0) or 0
            ) * w

            # Weighted Factor Balance
            if "factor_scores" in basic_info:
                try:
                    f_data = basic_info.get("factor_scores", {})
                    factors["profit"] += f_data.get("수익성", 0) * w
                    factors["growth"] += f_data.get("성장성", 0) * w
                    factors["value"] += f_data.get("가치(저평가)", 0) * w
                    factors["div"] += f_data.get("배당", 0) * w
                    factors["mom"] += f_data.get("모멘텀", 0) * w
                    factors["vol"] += f_data.get("변동성(안전성)", 0) * w
                    factors["fee"] += f_data.get("수수료(저렴함)", 0) * w
                except:
                    pass

            # X-Ray True Holdings
            if "holdings" in basic_info:
                try:
                    h_data = basic_info.get("holdings", [])
                    for item in h_data:
                        try:
                            # Safely handle 'weight' handling
                            item_w_str = str(item.get("weight", "0")).replace("%", "")
                            item_w = float(item_w_str) / 100.0
                            item_name = item.get("name", "Unknown")

                            # True weight in overall portfolio = portfolio_weight * etf_internal_weight
                            true_w = w * item_w

                            if item_name in analyzed["true_holdings"]:
                                analyzed["true_holdings"][item_name] += true_w
                            else:
                                analyzed["true_holdings"][item_name] = true_w
                        except:
                            pass
                except:
                    pass

            analyzed["matched_holdings"].append(
                {**h, "is_etf": True, "etf_name": etf.name}
            )
        else:
            # Individual stock or unknown ETF
            analyzed["matched_holdings"].append(
                {**h, "is_etf": False, "etf_name": h["name"]}
            )

            # Treat individual stock as 100% exposure to itself
            # This is a naive assumption for individual stocks vs ETF breakdown,
            # but serves as a good proxy for X-Ray
            analyzed["true_holdings"][h["name"]] = (
                analyzed["true_holdings"].get(h["name"], 0) + w
            )

    # --- Category Heuristics ---
    for item in analyzed["matched_holdings"]:
        name = item["name"]
        code = item["code"]

        # Region Heuristic
        if "200" in name:
            item["category_region"] = "한국"
        elif code.isalpha():
            item["category_region"] = "미국"
        elif any(kw in name.upper() for kw in ["미국", "나스닥", "NASDAQ", "S&P500", "다우존스"]):
            item["category_region"] = "미국"
        else:
            item["category_region"] = "한국"

        # Asset Type Heuristic
        # Cash: 머니마켓, KOFR, CD금리, 파킹, 단기
        # Gold: 금현물, 골드, 국제금
        # Bond: 채권, 국고채, 회사채, 만기매칭
        if any(kw in name for kw in ["머니마켓", "KOFR", "CD금리", "파킹", "단기"]):
            item["category_asset"] = "현금"
        elif any(kw in name for kw in ["금현물", "골드", "국제금"]):
            item["category_asset"] = "금"
        elif any(
            kw in name for kw in ["채권", "국고채", "회사채", "만기매칭", "크레딧"]
        ):
            item["category_asset"] = "채권"
        else:
            item["category_asset"] = "주식"

    analyzed["metrics"]["etf_ratio"] = (
        matched_eval / total_eval if total_eval > 0 else 0
    )

    # Format true holdings & sort
    true_items = [
        {"name": k, "weight": v} for k, v in analyzed["true_holdings"].items() if v > 0
    ]
    true_items.sort(key=lambda x: x["weight"], reverse=True)
    analyzed["true_holdings_top10"] = true_items[:10]

    # Normalize Factor Balance based on matched ETF ratio
    # If a portfolio is 50% ETF and 50% individual stocks, the factor balance
    # currently only represents the ETF portion. We scale it up to represent the
    # "Style" of the ETF portion
    etf_w = analyzed["metrics"]["etf_ratio"]
    if etf_w > 0:
        analyzed["factor_balance"] = {
            "수익성": min(100, (factors["profit"] / etf_w)),
            "성장성": min(100, (factors["growth"] / etf_w)),
            "가치(저평가)": min(100, (factors["value"] / etf_w)),
            "배당": min(100, (factors["div"] / etf_w)),
            "모멘텀": min(100, (factors["mom"] / etf_w)),
            "안전성": min(100, (factors["vol"] / etf_w)),
            "수수료": min(100, (factors["fee"] / etf_w)),
        }

    return analyzed
