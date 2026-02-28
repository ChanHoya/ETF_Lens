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

        # 2. Cost Score (TER)
        ter = etf.tot_fee or etf.base_fee or 0.5
        cost_score = 50
        if ter <= 0.05:
            cost_score = 95
        elif ter <= 0.15:
            cost_score = 85
        elif ter <= 0.30:
            cost_score = 70
        elif ter <= 0.50:
            cost_score = 50
        else:
            cost_score = 30

        # 3. Tracking Score (Mocked based on basic info availability for now)
        tracking_score = 80

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
