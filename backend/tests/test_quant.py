import unittest
import pandas as pd
from agents.quant.quant import ETFQuant


class TestETFQuant(unittest.TestCase):
    def setUp(self):
        self.quant = ETFQuant()

    def test_calculate_performance_metrics(self):
        # Dummy price data: 100, 105, 102, 108, 110 over 5 days
        prices = pd.Series([100.0, 105.0, 102.0, 108.0, 110.0])
        metrics = self.quant.calculate_performance_metrics(prices)

        self.assertIn("total_return_pct", metrics)
        self.assertEqual(metrics["total_return_pct"], 10.0)  # (110/100 - 1) * 100
        self.assertIn("annualized_volatility_pct", metrics)
        self.assertIn("mdd_pct", metrics)
        self.assertIn("sharpe_ratio", metrics)

    def test_calculate_true_cost(self):
        base_ter = 0.15
        other_costs = 0.05
        trading_fees = 0.02

        true_cost = self.quant.calculate_true_cost(base_ter, other_costs, trading_fees)
        self.assertAlmostEqual(true_cost, 0.22, places=4)

    def test_calculate_overlap(self):
        etf1_holdings = [
            {"ticker": "AAPL", "weight": 10.0},
            {"ticker": "MSFT", "weight": 5.0},
            {"ticker": "GOOGL", "weight": 2.0},
        ]

        etf2_holdings = [
            {"ticker": "AAPL", "weight": 8.0},
            {"ticker": "MSFT", "weight": 7.0},
            {"ticker": "AMZN", "weight": 3.0},
        ]

        # Max overlap AAPL: min(10, 8) = 8
        # Max overlap MSFT: min(5, 7) = 5
        # Max overlap GOOGL: min(2, 0) = 0
        # Max overlap AMZN: min(0, 3) = 0
        # Total overlap = 8 + 5 = 13.0

        overlap_pct = self.quant.calculate_overlap(etf1_holdings, etf2_holdings)
        self.assertEqual(overlap_pct, 13.0)


if __name__ == "__main__":
    unittest.main()
