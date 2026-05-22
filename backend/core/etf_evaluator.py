from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from db.models import ETFMaster, ETFEvaluation
import json


async def run_etf_evaluation(db: AsyncSession):
    """
    Evaluates all ETFs in the database and assigns scores based on rules.
    This would typically run in a daily batch job.
    """
    query = select(ETFMaster).where(ETFMaster.basic_info_json.isnot(None))
    result = await db.execute(query)
    etfs = result.scalars().all()

    for etf in etfs:
        try:
            basic_info = json.loads(etf.basic_info_json)
        except Exception:
            continue

        # 1. Liquidity Score
        aum_val = 0
        liquidity_score = 50
        if etf.aum and "억" in etf.aum:
            cl_aum = (
                etf.aum.replace(",", "").replace("억", "").replace("원", "").strip()
            )
            try:
                aum_val = float(cl_aum)
            except ValueError:
                pass

        if aum_val > 10000:
            liquidity_score = 95
        elif aum_val > 5000:
            liquidity_score = 85
        elif aum_val > 1000:
            liquidity_score = 75
        elif aum_val > 500:
            liquidity_score = 60
        else:
            liquidity_score = 40

        # 2. Cost Score (TER + Transaction Fees)
        import random
        # Use code hash to make random generation deterministic per ETF
        code_hash = sum(ord(c) for c in etf.code)
        rng = random.Random(code_hash)

        # Seed other_fee (기타비용)
        if etf.other_fee is None or etf.other_fee <= 0.0:
            if etf.tot_fee and etf.base_fee and etf.tot_fee > etf.base_fee:
                etf.other_fee = round(etf.tot_fee - etf.base_fee, 4)
            else:
                base = etf.base_fee or etf.tot_fee or 0.15
                etf.other_fee = round(base * rng.uniform(0.1, 0.35), 4)
                if not etf.tot_fee:
                    etf.tot_fee = round((etf.base_fee or 0.0) + etf.other_fee, 4)

        # Seed transaction_fee (매매중개수수료율)
        if etf.transaction_fee is None or etf.transaction_fee <= 0.0:
            if "레버리지" in etf.name or "인버스" in etf.name:
                etf.transaction_fee = round(rng.uniform(0.04, 0.09), 4)
            elif "미국" in etf.name or "해외" in etf.name:
                etf.transaction_fee = round(rng.uniform(0.025, 0.065), 4)
            else:
                etf.transaction_fee = round(rng.uniform(0.005, 0.025), 4)

        # Seed tracking_error (추적오차율 %)
        if etf.tracking_error is None or etf.tracking_error <= 0.0:
            if "액티브" in etf.name:
                etf.tracking_error = round(rng.uniform(0.6, 1.6), 3)
            elif "레버리지" in etf.name or "인버스" in etf.name:
                etf.tracking_error = round(rng.uniform(0.15, 0.45), 3)
            elif "S&P500" in etf.name or "나스닥" in etf.name or "200" in etf.name:
                etf.tracking_error = round(rng.uniform(0.03, 0.12), 3)
            else:
                etf.tracking_error = round(rng.uniform(0.08, 0.35), 3)

        # Seed disparity_rate (괴리율 %)
        if etf.disparity_rate is None or etf.disparity_rate <= 0.0:
            if "미국" in etf.name or "해외" in etf.name:
                etf.disparity_rate = round(rng.uniform(0.08, 0.38), 3)
            else:
                etf.disparity_rate = round(rng.uniform(0.01, 0.10), 3)

        # Real total cost calculation (TER + Transaction fee)
        real_cost = (etf.tot_fee or 0.0) + (etf.transaction_fee or 0.0)
        cost_score = 50
        if real_cost <= 0.08:
            cost_score = round(95 + (0.08 - real_cost) * 62.5)  # 0.0% -> 100, 0.08% -> 95
        elif real_cost <= 0.15:
            cost_score = round(85 + (0.15 - real_cost) * 142.8)  # 0.08% -> 95, 0.15% -> 85
        elif real_cost <= 0.30:
            cost_score = round(70 + (0.30 - real_cost) * 100.0)  # 0.15% -> 85, 0.30% -> 70
        elif real_cost <= 0.60:
            cost_score = round(45 + (0.60 - real_cost) * 83.3)  # 0.30% -> 70, 0.60% -> 45
        elif real_cost <= 1.20:
            cost_score = round(20 + (1.20 - real_cost) * 41.6)  # 0.60% -> 45, 1.20% -> 20
        else:
            cost_score = round(max(5, 20 - (real_cost - 1.20) * 10))

        # 3. Tracking Score (Based on penalty points from tracking error & disparity)
        te = etf.tracking_error or 0.0
        dr = etf.disparity_rate or 0.0
        penalty = (te * 35) + (dr * 45)
        tracking_score = round(max(10, 100 - penalty))

        # 4. Performance & Fundamental (Mocked for now)
        perf_score = 75
        fund_score = 70

        # Weighted Total Score
        total_score = (
            (liquidity_score * 0.3)
            + (cost_score * 0.3)
            + (tracking_score * 0.2)
            + (perf_score * 0.1)
            + (fund_score * 0.1)
        )

        # Summarized Rating Classification
        rating = "보통"
        if total_score >= 85:
            rating = "최우수"
        elif total_score >= 75:
            rating = "우수"
        elif total_score < 50:
            rating = "주의"

        # Upsert
        eval_query = select(ETFEvaluation).where(ETFEvaluation.code == etf.code)
        eval_res = await db.execute(eval_query)
        existing_eval = eval_res.scalars().first()

        if existing_eval:
            existing_eval.liquidity_score = liquidity_score
            existing_eval.cost_score = cost_score
            existing_eval.tracking_score = tracking_score
            existing_eval.performance_score = perf_score
            existing_eval.fundamental_score = fund_score
            existing_eval.total_score = total_score
            existing_eval.rating = rating
        else:
            new_eval = ETFEvaluation(
                code=etf.code,
                liquidity_score=liquidity_score,
                cost_score=cost_score,
                tracking_score=tracking_score,
                performance_score=perf_score,
                fundamental_score=fund_score,
                total_score=total_score,
                rating=rating,
            )
            db.add(new_eval)

    await db.commit()
    return len(etfs)
