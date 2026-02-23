import unittest
from agents.qa.qa import ETFQAAgent

class TestETFQAAgent(unittest.TestCase):
    def setUp(self):
        self.qa = ETFQAAgent()

    def test_harvester_validation(self):
        valid_data = {
            "etf_code": "000000",
            "market_data": {
                "price": 100,
                "nav": 105
            }
        }
        report = self.qa.validate_harvester_data(valid_data)
        self.assertTrue(report.is_valid)
        self.assertFalse(report.errors)

        invalid_data = {
            "market_data": {
                "price": None
            }
        }
        report = self.qa.validate_harvester_data(invalid_data)
        self.assertFalse(report.is_valid)
        self.assertIn("Missing etf_code field.", report.errors)
        self.assertIn("Missing nav in market_data.", report.errors)
        self.assertIn("Price is None. Fetching may have failed or used fallback.", report.warnings)

    def test_quant_validation(self):
        valid_metrics = {
            "total_return_pct": 10.5,
            "annualized_volatility_pct": 12.0,
            "mdd_pct": -5.0,
            "sharpe_ratio": 1.2
        }
        report = self.qa.validate_quant_metrics(valid_metrics)
        self.assertTrue(report.is_valid)

        invalid_metrics = {
             "total_return_pct": 10.5,
             # missing volatility and sharpe
             "mdd_pct": 5.0 # Positive MDD is logically invalid
        }
        report = self.qa.validate_quant_metrics(invalid_metrics)
        self.assertFalse(report.is_valid)
        self.assertTrue(any("MDD" in err for err in report.errors))
        self.assertTrue(any("annualized_volatility_pct" in err for err in report.errors))

if __name__ == '__main__':
    unittest.main()
