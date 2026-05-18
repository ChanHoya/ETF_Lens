import logging
from typing import List
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException
import yfinance as yf
import pandas as pd
from datetime import datetime, timedelta, timezone

logger = logging.getLogger(__name__)

router = APIRouter(tags=["backtest"])

class HoldingItem(BaseModel):
    code: str
    amount: float
    name: str
    category: str = "기타"

class BacktestRequest(BaseModel):
    holdings: List[HoldingItem]

class BacktestResultData(BaseModel):
    results: dict  # Contains 3M, 6M, 1Y, 3Y, 10Y MDD and Return metrics
    weights: dict

def format_ticker(code: str) -> str:
    # 6자리 숫자는 한국 주식/ETF로 간주
    if len(code) == 6 and code.isdigit():
        return f"{code}.KS"
    return code

def calculate_mdd(cum_returns: pd.Series) -> float:
    roll_max = cum_returns.cummax()
    drawdown = cum_returns / roll_max - 1.0
    return drawdown.min() * 100  # percentage

@router.post("/run")
async def run_backtest(req: BacktestRequest):
    if not req.holdings:
        raise HTTPException(status_code=400, detail="포트폴리오가 비어있습니다.")
    
    total_amount = sum(h.amount for h in req.holdings if h.amount > 0)
    if total_amount == 0:
         return {"status": "error", "message": "투자 금액이 없습니다."}

    weights = {}
    cat_weights = {} # category -> { ticker: amount }
    overall_tickers = set()

    for h in req.holdings:
        if h.amount > 0:
            ticker = format_ticker(h.code)
            weights[ticker] = weights.get(ticker, 0) + (h.amount / total_amount)
            overall_tickers.add(ticker)
            
            # exclude cash/spot from specific sub-portfolios, but keep in overall
            if "현금" not in h.category and "현물" not in h.category:
                if h.category not in cat_weights:
                    cat_weights[h.category] = {}
                cat_weights[h.category][ticker] = cat_weights[h.category].get(ticker, 0) + h.amount
    
    tickers = list(overall_tickers)
    benchmarks = ["^KS11", "^KQ11", "^GSPC", "^IXIC"]  # 코스피, 코스닥, S&P500, 나스닥
    
    all_tickers = tickers + benchmarks
    
    try:
        # 최근 10년 데이터 가져오기
        logger.info(f"Downloading backtest data for: {all_tickers}")
        df = yf.download(all_tickers, period="10y", interval="1d", group_by="ticker", auto_adjust=True)
        
        # DataFrame 평탄화 (단일 종목일 경우 구조가 다를 수 있음 처리)
        if len(all_tickers) == 1:
            close_prices = pd.DataFrame({all_tickers[0]: df['Close']})
        else:
            close_prices = pd.DataFrame()
            for t in all_tickers:
                if t in df and 'Close' in df[t]:
                    close_prices[t] = df[t]['Close']

        # 결측치 처리 (전일가로 채움)
        close_prices = close_prices.ffill().dropna(how='all')
        
        # 일간 수익률 계산
        daily_returns = close_prices.pct_change().fillna(0)
        
        # 포트폴리오 일간 수익률 (단순 가중 평균)
        pf_returns = pd.Series(0.0, index=daily_returns.index)
        for t, w in weights.items():
            if t in daily_returns:
                pf_returns += daily_returns[t] * w

        daily_returns['Portfolio'] = pf_returns
        
        # 분야별 포트폴리오 수익률 계산
        for cat, cw in cat_weights.items():
            cat_total = sum(cw.values())
            if cat_total == 0: continue
            
            sub_pf = pd.Series(0.0, index=daily_returns.index)
            for t, amt in cw.items():
                if t in daily_returns:
                    sub_pf += daily_returns[t] * (amt / cat_total)
            daily_returns[f'Portfolio_{cat}'] = sub_pf
        # 기준일 설정
        KST = timezone(timedelta(hours=9))
        end_date = datetime.now(KST).replace(tzinfo=None)
        
        periods = {
            "3M": 90,
            "6M": 180,
            "1Y": 365,
            "3Y": 365 * 3,
            "10Y": 365 * 10
        }
        
        results = {}
        chart_data = {}
        
        for p_name, p_days in periods.items():
            start_date = end_date - timedelta(days=p_days)
            # 해당 날짜 이후 데이터 필터링
            mask = daily_returns.index >= pd.Timestamp(start_date)
            period_returns = daily_returns.loc[mask]
            
            if period_returns.empty:
                continue
                
            # 누적 수익률 계산
            cum_returns = (1 + period_returns).cumprod()
            
            period_summary = {}
            # Portfolio, Sub-portfolios & Benchmarks
            targets = ["Portfolio"] + [f"Portfolio_{cat}" for cat in cat_weights.keys()] + benchmarks
            for t in targets:
                if t in cum_returns.columns:
                    final_ret = (cum_returns[t].iloc[-1] - 1) * 100 if not cum_returns[t].empty else 0
                    mdd = calculate_mdd(cum_returns[t]) if not cum_returns[t].empty else 0
                    period_summary[t] = {
                        "return": final_ret,
                        "mdd": mdd
                    }
                    
            results[p_name] = period_summary
            
            # 차트 데이터 준비
            if p_name in ["3M", "6M", "1Y", "3Y"]:
                # 샘플링해서 100개 포인트 정도로 줄이기
                step = max(1, len(cum_returns) // 100)
                sampled = cum_returns.iloc[::step]
                # 마지막 날짜 포함
                if sampled.index[-1] != cum_returns.index[-1]:
                    sampled = pd.concat([sampled, cum_returns.iloc[-1:]])
                
                chart_points = []
                for idx, row in sampled.iterrows():
                    point = {"date": idx.strftime("%Y-%m-%d")}
                    for t in targets:
                        if t in row and not pd.isna(row[t]):
                            point[t] = (row[t] - 1) * 100
                    chart_points.append(point)
                chart_data[p_name] = chart_points
                
        # 인사이트 뼈대 생성
        pf_1y = results.get("1Y", {}).get("Portfolio", {})
        spx_1y = results.get("1Y", {}).get("^GSPC", {})
        
        insights = []
        if pf_1y and spx_1y:
            if pf_1y["mdd"] > spx_1y["mdd"]:
                insights.append("지난 1년간 S&P500 대비 하락 방어력이 우수했습니다.")
            else:
                insights.append("지난 1년간 S&P500 대비 최대 낙폭(MDD)이 컸습니다. 포트폴리오의 변동성 관리가 필요할 수 있습니다.")
                
            if pf_1y["return"] > spx_1y["return"]:
                insights.append("수익률 측면에서 시장 (S&P500) 수익률을 상회했습니다!")
            else:
                insights.append("시장(S&P500) 대비 상승폭이 다소 밑돌았습니다.")
        
        return {
            "status": "success",
            "weights": weights,
            "results": results,
            "chart_data": chart_data,
            # AI Insight는 성능 분리를 위해 더 이상 여기서 반환하지 않고
            # 빈 배열만 반환하여 하위호환 유지
            "insights": [] 
        }

    except Exception as e:
        logger.error(f"Backtest failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/insight")
async def generate_backtest_insight(req: BacktestResultData):
    """
    백테스트 결과(수익률, MDD 등)를 전달받아 Gemini를 통해
    방어력 및 상관관계 인사이트를 생성해 반환합니다.
    """
    import os
    import asyncio
    
    api_key = os.environ.get("GEMINI_API_KEY", "")
    if not api_key:
        return {"status": "error", "insight_md": "Gemini API 키가 설정되지 않았습니다."}
        
    results = req.results
    weights = req.weights
    
    if not results or "1Y" not in results:
        return {"status": "error", "insight_md": "데이터가 부족하여 AI 분석을 수행할 수 없습니다."}
        
    try:
        from google import genai
        client = genai.Client(api_key=api_key)
        
        # Build prompt using existing results
        prompt = f"""당신은 최고 수준의 퀀트 투자 전문가이자 자산배분 매니저입니다.
다음은 사용자의 포트폴리오와 벤치마크 지수들의 과거 수익률 및 최대 낙폭(MDD, 숫자가 낮을수록 하락폭이 큼) 데이터입니다.

포트폴리오 비중: {weights}

[1년 (1Y) 성과]
- 내 포트폴리오: 수익률 {results.get('1Y', {}).get('Portfolio', {}).get('return', 0):.2f}%, MDD {results.get('1Y', {}).get('Portfolio', {}).get('mdd', 0):.2f}%
- KOSPI: 수익률 {results.get('1Y', {}).get('^KS11', {}).get('return', 0):.2f}%, MDD {results.get('1Y', {}).get('^KS11', {}).get('mdd', 0):.2f}%
- S&P 500: 수익률 {results.get('1Y', {}).get('^GSPC', {}).get('return', 0):.2f}%, MDD {results.get('1Y', {}).get('^GSPC', {}).get('mdd', 0):.2f}%
- NASDAQ: 수익률 {results.get('1Y', {}).get('^IXIC', {}).get('return', 0):.2f}%, MDD {results.get('1Y', {}).get('^IXIC', {}).get('mdd', 0):.2f}%

[3년 (3Y) 성과 (가능할 경우)]
- 내 포트폴리오: 수익률 {results.get('3Y', {}).get('Portfolio', {}).get('return', 0):.2f}%, MDD {results.get('3Y', {}).get('Portfolio', {}).get('mdd', 0):.2f}%
- S&P 500: 수익률 {results.get('3Y', {}).get('^GSPC', {}).get('return', 0):.2f}%, MDD {results.get('3Y', {}).get('^GSPC', {}).get('mdd', 0):.2f}%

이 데이터를 객관적으로 분석하여 개인 투자자에게 도움이 될 보고서를 작성하세요. 다음 사항을 반드시 포함하세요:
1. 방어력 평가 (하방 경직성): KOSPI 및 S&P500 대비 하락(MDD)을 얼마나 잘 방어했는가?
2. 성장성 평가: 시장 대비 초과 수익을 달성했는가? 변동성 대비 수익을 잘 뽑아냈는가?
3. 위험 요소 및 보유 비중에 대한 짧은 조언.

마크다운 형식(Bold, Bullet point 적용)으로 3~4문단 이내로 아주 전문적이고 간결하게 작성하세요. 인사말이나 꼬릿말은 생략하세요.
"""
        response = await asyncio.to_thread(
            client.models.generate_content,
            model="gemini-2.5-flash",
            contents=prompt,
        )
        
        return {
            "status": "success",
            "insight_md": response.text.strip()
        }
    except Exception as e:
        logger.error(f"Insight generation failed: {e}")
        return {"status": "error", "insight_md": "AI 분석 중 오류가 발생했습니다."}


# ── S4-2: AI 기반 리밸런싱 주문 시나리오 백테스트 시뮬레이터 ────────────────

class RebalanceBacktestRequest(BaseModel):
    holdings: List[HoldingItem]
    period: str = "1Y"
    defense_factor: float = 0.5
    safe_asset_code: str = "272580"  # KODEX 단기채권PLUS 기본값


@router.post("/rebalance")
async def run_rebalance_backtest(req: RebalanceBacktestRequest):
    if not req.holdings:
        raise HTTPException(status_code=400, detail="포트폴리오가 비어있습니다.")

    total_amount = sum(h.amount for h in req.holdings if h.amount > 0)
    if total_amount == 0:
        return {"status": "error", "message": "투자 금액이 없습니다."}

    # 1. 포트폴리오 노멀 자산 비중 계산
    normal_weights = {}
    tickers = set()
    for h in req.holdings:
        if h.amount > 0:
            ticker = format_ticker(h.code)
            normal_weights[ticker] = normal_weights.get(ticker, 0) + (h.amount / total_amount)
            tickers.add(ticker)

    # 안전자산 지정
    safe_ticker = format_ticker(req.safe_asset_code)
    tickers.add(safe_ticker)

    # 벤치마크 지정 (KOSPI 200, S&P 500)
    benchmarks = ["^KS11", "^GSPC"]
    all_tickers = list(tickers) + benchmarks

    # 2. 날짜 범위 지정
    KST = timezone(timedelta(hours=9))
    end_date = datetime.now(KST).replace(tzinfo=None)
    
    period_days = {
        "3M": 90,
        "6M": 180,
        "1Y": 365,
        "3Y": 365 * 3
    }
    days = period_days.get(req.period.upper(), 365)
    # yfinance 패딩 날짜 추가하여 ffill 및 초기 날짜 맞춤 보장
    start_date = end_date - timedelta(days=days + 60)

    try:
        logger.info(f"[S4-2 Backtest] Fetching prices for {all_tickers} from {start_date.strftime('%Y-%m-%d')}")
        df = yf.download(all_tickers, start=start_date.strftime("%Y-%m-%d"), end=(end_date + timedelta(days=2)).strftime("%Y-%m-%d"), interval="1d", group_by="ticker", auto_adjust=True)
        
        # 데이터프레임 평탄화 및 클로즈 가격 추출
        close_prices = pd.DataFrame()
        for t in all_tickers:
            if t in df and 'Close' in df[t]:
                close_prices[t] = df[t]['Close']

        close_prices = close_prices.ffill().dropna(how='all')
        
        # 유효 범위 필터링
        analysis_start = end_date - timedelta(days=days)
        close_prices = close_prices[close_prices.index >= pd.Timestamp(analysis_start)]
        
        if len(close_prices) < 2:
            return {"status": "error", "message": "해당 기간에 사용 가능한 충분한 가격 데이터가 없습니다."}

        # 3. DB에서 리스크 센티먼트 히스토리(Exit-Signals) 조회
        from db.database import AsyncSessionLocal
        from db.models import MarketSentimentLog
        from sqlalchemy import select

        async with AsyncSessionLocal() as db:
            stmt = select(MarketSentimentLog).order_by(MarketSentimentLog.date.asc())
            res = await db.execute(stmt)
            sentiment_records = res.scalars().all()

        # 일별 리스크 스코어 맵 생성
        risk_score_map = {}
        for r in sentiment_records:
            v = r.vix or 15.0
            vk = r.vkospi_proxy or 15.0
            f = r.fgi or 50.0

            # VIX 점수
            vs = 0 if v < 20 else (1 if v < 25 else (2 if v < 30 else 3))
            # VKOSPI 점수
            vks = 0 if vk < 15 else (1 if vk < 20 else (2 if vk < 25 else 3))
            # FGI 점수
            fs = 0 if f >= 50 else (1 if f >= 30 else (2 if f >= 25 else 3))

            risk_score_map[r.date] = {
                "score": vs + vks + fs,
                "vix": v,
                "vkospi": vk,
                "fgi": f
            }

        # 4. 방어 자산 비중 포트폴리오 정의
        # 주식 및 성장형 비중의 일부를 안전 자산으로 이전
        defensive_weights = {}
        equity_weight_sum = 0.0
        
        for t, w in normal_weights.items():
            # 안전자산 카테고리 외는 defense_factor 만큼 차감
            if t == safe_ticker:
                continue
            reduced_w = w * (1.0 - req.defense_factor)
            defensive_weights[t] = reduced_w
            equity_weight_sum += (w - reduced_w)

        # 차감한 모든 비중을 안전자산(safe_ticker)으로 합산 배치
        defensive_weights[safe_ticker] = normal_weights.get(safe_ticker, 0.0) + equity_weight_sum

        # 5. 시간순 시뮬레이션 루프
        dates = sorted(close_prices.index)
        
        # 초기 설정 (10,000 기준)
        nav_bh = 10000.0
        nav_ai = 10000.0
        nav_bm = 10000.0

        timeline = []
        event_logs = []
        
        # 최초 가중치 설정
        w_bh = normal_weights.copy()
        w_ai = normal_weights.copy()
        
        current_state = "Normal"  # Normal | Defensive
        last_score = 0
        consecutive_safe_days = 0

        # 초기 자산 가격 매핑
        p_prev = close_prices.loc[dates[0]]

        # 첫 번째 날짜 기록
        timeline.append({
            "date": dates[0].strftime("%Y-%m-%d"),
            "buy_and_hold": round(nav_bh),
            "ai_rebalance": round(nav_ai),
            "benchmark": round(nav_bm),
            "risk_score": 0
        })

        for t_idx in range(1, len(dates)):
            curr_date = dates[t_idx]
            curr_date_str = curr_date.strftime("%Y-%m-%d")
            p_curr = close_prices.loc[curr_date]

            # 자산 일간 수익률 계산
            bh_return = 0.0
            ai_return = 0.0

            for asset, w in w_bh.items():
                if asset in p_curr and asset in p_prev and p_prev[asset] > 0:
                    ret = (p_curr[asset] - p_prev[asset]) / p_prev[asset]
                    bh_return += w * ret

            for asset, w in w_ai.items():
                if asset in p_curr and asset in p_prev and p_prev[asset] > 0:
                    ret = (p_curr[asset] - p_prev[asset]) / p_prev[asset]
                    ai_return += w * ret

            # 벤치마크 수익률 계산 (기본 코스피200 대조, 없을 시 S&P500)
            bm_ticker = "^KS11" if "^KS11" in p_curr else "^GSPC"
            bm_return = 0.0
            if bm_ticker in p_curr and bm_ticker in p_prev and p_prev[bm_ticker] > 0:
                bm_return = (p_curr[bm_ticker] - p_prev[bm_ticker]) / p_prev[bm_ticker]

            # NAV 업데이트
            nav_bh *= (1.0 + bh_return)
            nav_ai *= (1.0 + ai_return)
            nav_bm *= (1.0 + bm_return)

            # 리스크 지수 조회 (결측 시 ffill)
            risk_info = risk_score_map.get(curr_date_str)
            if not risk_info:
                # 이전 날짜 역산 ffill
                prev_date_str = dates[t_idx-1].strftime("%Y-%m-%d")
                risk_info = risk_score_map.get(prev_date_str, {"score": last_score, "vix": 15, "vkospi": 15, "fgi": 50})
            
            score = risk_info["score"]
            last_score = score

            # AI 상태 전이 알고리즘
            if current_state == "Normal" and score >= 4:
                # 위기 감지 → 방어 포트폴리오로 전환
                current_state = "Defensive"
                w_ai = defensive_weights.copy()
                # 0.05% 슬리피지/세금 차감
                nav_ai *= 0.9995
                event_logs.append({
                    "date": curr_date_str,
                    "event": "DEFENSIVE_SHIFT",
                    "description": f"⚠️ Exit-Signal 경계 감지 (위험지수: {score}점). 포트폴리오의 {int(req.defense_factor * 100)}% 비중을 안전 자산({req.safe_asset_code})으로 대피 리밸런싱 실행."
                })
                consecutive_safe_days = 0
            
            elif current_state == "Defensive":
                if score <= 2:
                    consecutive_safe_days += 1
                else:
                    consecutive_safe_days = 0
                
                # 3일 동안 연속 안전 신호가 유지될 때 복구
                if consecutive_safe_days >= 3:
                    current_state = "Normal"
                    w_ai = normal_weights.copy()
                    nav_ai *= 0.9995
                    event_logs.append({
                        "date": curr_date_str,
                        "event": "REVERT_TO_NORMAL",
                        "description": f"✨ Exit-Signal 위험 해제 및 안정화 확인. 안전 자산을 원래 주식/성장형 목표 비중으로 복구 완료."
                    })
                    consecutive_safe_days = 0

            timeline.append({
                "date": curr_date_str,
                "buy_and_hold": round(nav_bh),
                "ai_rebalance": round(nav_ai),
                "benchmark": round(nav_bm),
                "risk_score": score
            })

            p_prev = p_curr

        # 6. 리스크 및 수익률 성과 지표 산출
        bh_series = pd.Series([t["buy_and_hold"] for t in timeline])
        ai_series = pd.Series([t["ai_rebalance"] for t in timeline])
        bm_series = pd.Series([t["benchmark"] for t in timeline])

        bh_ret = (bh_series.iloc[-1] / bh_series.iloc[0] - 1) * 100
        ai_ret = (ai_series.iloc[-1] / ai_series.iloc[0] - 1) * 100
        bm_ret = (bm_series.iloc[-1] / bm_series.iloc[0] - 1) * 100

        bh_mdd = calculate_mdd(bh_series)
        ai_mdd = calculate_mdd(ai_series)
        bm_mdd = calculate_mdd(bm_series)

        # 변동성 및 샤프 지수 계산
        bh_pct = bh_series.pct_change().dropna()
        ai_pct = ai_series.pct_change().dropna()
        bm_pct = bm_series.pct_change().dropna()

        bh_vol = bh_pct.std() * (252 ** 0.5) * 100
        ai_vol = ai_pct.std() * (252 ** 0.5) * 100
        bm_vol = bm_pct.std() * (252 ** 0.5) * 100

        # 무위험 수익률 3% 가정
        rf = 3.0
        bh_sharpe = (bh_ret - rf) / bh_vol if bh_vol > 0 else 0
        ai_sharpe = (ai_ret - rf) / ai_vol if ai_vol > 0 else 0
        bm_sharpe = (bm_ret - rf) / bm_vol if bm_vol > 0 else 0

        # 7. 차트 다이어그램 다운샘플링 (100개 포인트)
        step = max(1, len(timeline) // 100)
        sampled_timeline = timeline[::step]
        if sampled_timeline[-1]["date"] != timeline[-1]["date"]:
            sampled_timeline.append(timeline[-1])

        return {
            "status": "success",
            "metrics": {
                "buy_and_hold": {
                    "total_return": round(bh_ret, 2),
                    "mdd": round(bh_mdd, 2),
                    "sharpe": round(bh_sharpe, 2),
                    "volatility": round(bh_vol, 2)
                },
                "ai_rebalance": {
                    "total_return": round(ai_ret, 2),
                    "mdd": round(ai_mdd, 2),
                    "sharpe": round(ai_sharpe, 2),
                    "volatility": round(ai_vol, 2)
                },
                "benchmark": {
                    "total_return": round(bm_ret, 2),
                    "mdd": round(bm_mdd, 2),
                    "sharpe": round(bm_sharpe, 2),
                    "volatility": round(bm_vol, 2)
                }
            },
            "timeline": sampled_timeline,
            "event_logs": event_logs
        }

    except Exception as e:
        logger.error(f"[S4-2 Backtest] Simulation failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"시뮬레이터 에러: {str(e)}")


