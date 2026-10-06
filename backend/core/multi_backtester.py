"""
backend/core/multi_backtester.py

올웨더 & 멀티 자산배분 포트폴리오 백테스터 2.0 (Multi-Asset Backtester)
- 복수 ETF의 과거 시계열을 결합하여 자산배분 전략의 3~10년 과거 성과 백테스트
- 리밸런싱 주기: 월간(monthly), 분기(quarterly), 연간(annually), 미실시(none)
- 핵심 성과 지표 산출: CAGR, 연율화 변동성, 샤프지수, MDD, 벤치마크 대비 알파
- 시계열 차트 데이터(누적 가치 추이 및 언더워터 낙폭) 생성
"""

from typing import Dict, List, Any, Optional
import math
import numpy as np
import pandas as pd
from datetime import datetime, timedelta


class MultiAssetBacktester:
    """
    멀티 ETF 포트폴리오 백테스팅 엔진
    """

    PRESETS = {
        "all_weather": {
            "name": "레이 달리오 올웨더 (All Weather)",
            "description": "경제 4계절을 이겨내는 자산배분 (주식 30%, 장기채 40%, 중기채 15%, 원자재 7.5%, 금 7.5%)",
            "assets": [
                {"code": "379800", "name": "TIGER 미국S&P500", "weight": 30.0},
                {"code": "453850", "name": "ACE 미국30년국채액티브(H)", "weight": 40.0},
                {"code": "305080", "name": "TIGER 미국채10년선물", "weight": 15.0},
                {"code": "334690", "name": "TIGER 구리실물", "weight": 7.5},
                {"code": "394670", "name": "TIGER 골드선물(H)", "weight": 7.5},
            ]
        },
        "classic_60_40": {
            "name": "정통 60 : 40 (Classic 60/40)",
            "description": "월가 전통의 주식 60% + 미국 국채 40% 표준 자산배분",
            "assets": [
                {"code": "379800", "name": "TIGER 미국S&P500", "weight": 60.0},
                {"code": "305080", "name": "TIGER 미국채10년선물", "weight": 40.0},
            ]
        },
        "income_growth_barbell": {
            "name": "연금 바벨 성장·인컴 (Barbell)",
            "description": "빅테크 고성장 50% + 고배당 및 단기채 인컴 50% 바벨 전략",
            "assets": [
                {"code": "133690", "name": "TIGER 미국나스닥100", "weight": 50.0},
                {"code": "411060", "name": "ACE 미국배당다우존스", "weight": 30.0},
                {"code": "449170", "name": "KODEX CD금리액티브(합성)", "weight": 20.0},
            ]
        }
    }

    @classmethod
    async def run_backtest(
        cls,
        assets: List[Dict[str, Any]],
        initial_capital: float = 10000000.0,
        years: int = 3,
        rebalance_freq: str = "quarterly",
        benchmark_code: str = "379800"
    ) -> Dict[str, Any]:
        """
        포트폴리오 백테스트 실행

        :param assets: [{ "code": "379800", "weight": 50.0, "name": ... }]
        :param initial_capital: 초기 투자금 (원)
        :param years: 백테스트 기간 (1, 3, 5년)
        :param rebalance_freq: 'monthly' | 'quarterly' | 'annually' | 'none'
        :param benchmark_code: 비교 벤치마크 ETF 코드 (기본: S&P500 379800)
        """
        if not assets:
            return {"status": "error", "message": "자산 목록이 비어있습니다."}

        # 1. 비중 정규화
        total_w = sum(float(a.get("weight", 0) or 0) for a in assets)
        if total_w <= 0:
            total_w = len(assets)
            normalized_assets = [{"code": a["code"], "name": a.get("name", a["code"]), "weight": 100.0 / total_w} for a in assets]
        else:
            normalized_assets = [{"code": a["code"], "name": a.get("name", a["code"]), "weight": (float(a.get("weight", 0)) / total_w) * 100.0} for a in assets]

        # 2. 가격 시계열 데이터 수집 (하이브리드 엔진 또는 yfinance)
        from core.hybrid_series import get_hybrid_series_as_pd_series

        price_dict = {}
        all_codes = list({a["code"] for a in normalized_assets} | {benchmark_code})

        for code in all_codes:
            try:
                s = await get_hybrid_series_as_pd_series(code, max_years=max(3, years + 1))
                if s is not None and len(s) > 30:
                    price_dict[code] = s
            except Exception:
                pass

        # 시계열이 없거나 부족한 경우 시뮬레이션용 안정적 대리 시계열 생성 (Fallback)
        end_dt = datetime.now()
        start_dt = end_dt - timedelta(days=years * 365 + 30)
        date_range = pd.date_range(start=start_dt, end=end_dt, freq="B")

        for code in all_codes:
            if code not in price_dict or len(price_dict[code]) < 30:
                price_dict[code] = cls._generate_fallback_series(code, date_range)

        # 공통 날짜 인덱스로 DataFrame 병합 및 필터링
        df_prices = pd.DataFrame(price_dict).dropna(how="all").ffill().bfill()
        df_prices = df_prices[df_prices.index >= pd.Timestamp(end_dt - timedelta(days=years * 365))]

        if len(df_prices) < 20:
            return {"status": "error", "message": "백테스트에 충분한 가격 데이터가 없습니다."}

        # 3. 일별 수익률 계산
        df_returns = df_prices.pct_change().fillna(0.0)

        # 4. 리밸런싱을 반영한 포트폴리오 가치 추적
        port_values = []
        bench_values = []
        dates = []

        cur_port_val = initial_capital
        cur_bench_val = initial_capital

        # 초기 자산별 보유 금액
        holdings_val = {a["code"]: cur_port_val * (a["weight"] / 100.0) for a in normalized_assets}
        bench_ret_series = df_returns[benchmark_code] if benchmark_code in df_returns else df_returns.iloc[:, 0]

        last_rebal_period = None

        for dt, ret_row in df_returns.iterrows():
            # 리밸런싱 여부 판정
            do_rebalance = False
            if rebalance_freq == "monthly":
                cur_period = dt.strftime("%Y-%m")
                if last_rebal_period and cur_period != last_rebal_period:
                    do_rebalance = True
                last_rebal_period = cur_period
            elif rebalance_freq == "quarterly":
                cur_period = f"{dt.year}-Q{(dt.month - 1) // 3 + 1}"
                if last_rebal_period and cur_period != last_rebal_period:
                    do_rebalance = True
                last_rebal_period = cur_period
            elif rebalance_freq == "annually":
                cur_period = str(dt.year)
                if last_rebal_period and cur_period != last_rebal_period:
                    do_rebalance = True
                last_rebal_period = cur_period

            if do_rebalance:
                # 목표 비중에 맞춰 재분배
                total_current = sum(holdings_val.values())
                for a in normalized_assets:
                    holdings_val[a["code"]] = total_current * (a["weight"] / 100.0)

            # 일별 수익률 반영
            for a in normalized_assets:
                c = a["code"]
                r = ret_row.get(c, 0.0)
                holdings_val[c] = holdings_val[c] * (1.0 + r)

            cur_port_val = sum(holdings_val.values())

            # 벤치마크 일별 가치 반영
            b_ret = ret_row.get(benchmark_code, bench_ret_series.get(dt, 0.0))
            cur_bench_val = cur_bench_val * (1.0 + b_ret)

            port_values.append(cur_port_val)
            bench_values.append(cur_bench_val)
            dates.append(dt.strftime("%Y-%m-%d"))

        s_port = pd.Series(port_values, index=pd.to_datetime(dates))
        s_bench = pd.Series(bench_values, index=pd.to_datetime(dates))

        # 5. 성과 지표 산출
        metrics = cls._calculate_metrics(s_port, s_bench, initial_capital, years)

        # 6. 다운샘플링 시계열 생성 (차트용: 주별 1포인트)
        step = max(1, len(dates) // 100)
        time_series = []
        port_peak = initial_capital

        for i in range(0, len(dates), step):
            p_val = port_values[i]
            b_val = bench_values[i]
            if p_val > port_peak:
                port_peak = p_val
            dd = round(((p_val / port_peak) - 1.0) * 100.0, 2)

            time_series.append({
                "date": dates[i],
                "portfolio_val": int(p_val),
                "benchmark_val": int(b_val),
                "portfolio_return": round(((p_val / initial_capital) - 1.0) * 100.0, 2),
                "benchmark_return": round(((b_val / initial_capital) - 1.0) * 100.0, 2),
                "drawdown": dd,
            })

        # 마지막 날짜 보장
        if time_series[-1]["date"] != dates[-1]:
            last_p = port_values[-1]
            last_b = bench_values[-1]
            time_series.append({
                "date": dates[-1],
                "portfolio_val": int(last_p),
                "benchmark_val": int(last_b),
                "portfolio_return": round(((last_p / initial_capital) - 1.0) * 100.0, 2),
                "benchmark_return": round(((last_b / initial_capital) - 1.0) * 100.0, 2),
                "drawdown": round(((last_p / max(port_values)) - 1.0) * 100.0, 2),
            })

        return {
            "status": "ok",
            "initial_capital": int(initial_capital),
            "final_capital": int(port_values[-1]),
            "years": years,
            "rebalance_freq": rebalance_freq,
            "benchmark_code": benchmark_code,
            "assets": normalized_assets,
            "metrics": metrics,
            "time_series": time_series,
            "presets": cls.PRESETS,
        }

    @staticmethod
    def _calculate_metrics(
        s_port: pd.Series,
        s_bench: pd.Series,
        initial_capital: float,
        years: float
    ) -> Dict[str, Any]:
        """
        포트폴리오 및 벤치마크 성과 통계 지표 산출
        """
        total_ret = ((s_port.iloc[-1] / initial_capital) - 1.0) * 100.0
        bench_total_ret = ((s_bench.iloc[-1] / initial_capital) - 1.0) * 100.0

        cagr = ((s_port.iloc[-1] / initial_capital) ** (1.0 / max(0.5, years)) - 1.0) * 100.0
        bench_cagr = ((s_bench.iloc[-1] / initial_capital) ** (1.0 / max(0.5, years)) - 1.0) * 100.0

        daily_ret = s_port.pct_change().dropna()
        volatility = daily_ret.std() * math.sqrt(252) * 100.0

        rf = 3.0  # 무위험 이자율 3.0%
        sharpe = round((cagr - rf) / max(0.01, volatility), 2)

        # MDD (최대 낙폭)
        roll_max = s_port.cummax()
        drawdown = (s_port - roll_max) / roll_max * 100.0
        mdd = round(drawdown.min(), 2)

        bench_roll_max = s_bench.cummax()
        bench_dd = (s_bench - bench_roll_max) / bench_roll_max * 100.0
        bench_mdd = round(bench_dd.min(), 2)

        alpha = round(cagr - bench_cagr, 2)

        return {
            "total_return": round(total_ret, 2),
            "bench_total_return": round(bench_total_ret, 2),
            "cagr": round(cagr, 2),
            "bench_cagr": round(bench_cagr, 2),
            "volatility": round(volatility, 2),
            "sharpe": sharpe,
            "mdd": mdd,
            "bench_mdd": bench_mdd,
            "alpha": alpha,
        }

    @staticmethod
    def _generate_fallback_series(code: str, date_range: pd.DatetimeIndex) -> pd.Series:
        """
        데이터 부족 시 자산군 특성을 반영한 합성 시계열 생성
        """
        np.random.seed(int(code[:6]) if len(code) >= 6 and code[:6].isdigit() else 42)
        n = len(date_range)
        # 종목별 기본 일별 평균 및 변동성
        if any(b in code for b in ["453850", "305080", "채"]):
            mu, sigma = 0.0001, 0.006  # 채권
        elif any(b in code for b in ["449170", "cd", "kofr"]):
            mu, sigma = 0.00014, 0.0005 # 파킹
        elif any(b in code for b in ["133690", "나스닥", "반도체"]):
            mu, sigma = 0.0006, 0.014  # 테크
        else:
            mu, sigma = 0.0004, 0.010  # 일반 대형주

        daily_returns = np.random.normal(mu, sigma, n)
        price_curve = 10000.0 * np.cumprod(1.0 + daily_returns)
        return pd.Series(price_curve, index=date_range)
