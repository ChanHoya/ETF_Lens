import pandas as pd
import numpy as np


class ETFQuant:
    def __init__(self):
        pass

    def calculate_performance_metrics(self, prices: pd.Series) -> dict:
        """
        Calculates basic performance metrics from a daily price series.
        """
        if prices.empty or len(prices) < 2:
            return {}

        # Daily Returns
        daily_returns = prices.pct_change().dropna()

        # Total Return
        total_return = (prices.iloc[-1] / prices.iloc[0] - 1) * 100

        # Annualized Volatility (assuming 252 trading days)
        volatility = daily_returns.std() * np.sqrt(252) * 100

        # Maximum Drawdown (MDD)
        cumulative_returns = (1 + daily_returns).cumprod()
        rolling_max = cumulative_returns.cummax()
        drawdown = (cumulative_returns / rolling_max) - 1
        mdd = drawdown.min() * 100

        # Sharpe Ratio (assuming risk-free rate = 0 for simplicity)
        sharpe_ratio = (
            (daily_returns.mean() / daily_returns.std()) * np.sqrt(252)
            if daily_returns.std() != 0
            else 0
        )

        return {
            "total_return_pct": round(total_return, 2),
            "annualized_volatility_pct": round(volatility, 2),
            "mdd_pct": round(mdd, 2),
            "sharpe_ratio": round(sharpe_ratio, 2),
        }

    def calculate_true_cost(
        self, base_ter: float, other_costs: float, trading_fees: float
    ) -> float:
        """
        Calculates the real Total Expense Ratio including hidden costs.
        """
        # A simple additive model for real expenses
        true_cost = base_ter + other_costs + trading_fees
        return round(true_cost, 4)

    def calculate_overlap(
        self, holdings_etf1: list[dict], holdings_etf2: list[dict]
    ) -> float:
        """
        Calculates the holding overlap ratio between two ETFs.
        Holdings should be a list of dicts: [{'ticker': 'AAPL', 'weight': 5.0}, ...]
        """
        df1 = pd.DataFrame(holdings_etf1)
        df2 = pd.DataFrame(holdings_etf2)

        if df1.empty or df2.empty:
            return 0.0

        df1 = df1.set_index("ticker")
        df2 = df2.set_index("ticker")

        # Merge on ticker
        merged = df1.join(df2, how="outer", lsuffix="_1", rsuffix="_2").fillna(0)

        # Calculate overlap as the sum of the minimum weight for each overlapping asset
        merged["min_weight"] = merged[["weight_1", "weight_2"]].min(axis=1)
        overlap_pct = merged["min_weight"].sum()

        return round(overlap_pct, 2)
