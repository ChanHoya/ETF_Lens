import pytest
import unittest
from unittest.mock import AsyncMock, MagicMock
from sqlalchemy.ext.asyncio import AsyncSession
from core.overlap_analyzer import ETFOverlapAnalyzer
from db.models import ETFMaster, ETFHoldings


class TestETFOverlapAnalyzer(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.mock_db = AsyncMock(spec=AsyncSession)

    async def test_empty_portfolio(self):
        analyzer = ETFOverlapAnalyzer([], self.mock_db)
        result = await analyzer.analyze()
        
        self.assertEqual(result["status"], "success")
        self.assertEqual(result["summary"]["etf_total_eval"], 0.0)
        self.assertEqual(result["summary"]["diversification_score"], 100.0)
        self.assertEqual(result["overlap_matrix"], {})
        self.assertEqual(result["true_exposure"], [])

    async def test_simple_overlap_calculation(self):
        # 1. Mock KIS Holdings input
        holdings = [
            {"code": "069500", "name": "KODEX 200", "eval_amount": 6000000.0},
            {"code": "453850", "name": "TIGER 200", "eval_amount": 4000000.0},
        ]
        
        # 2. Mock ETFMaster objects for each ETF
        master1 = ETFMaster(code="069500", name="KODEX 200")
        master2 = ETFMaster(code="453850", name="TIGER 200")

        # 3. Mock database calls
        # Parallel query in analyze() fetches ETFMaster and ETFHoldings objects
        # We need mock_db.execute() to return appropriate scalars.
        mock_master_result = MagicMock()
        mock_master_result.scalars.return_value.all.return_value = [master1, master2]
        
        # For ETFHoldings, we have two queries in fetch_etf_underlying_holdings:
        # First query for '069500' holdings:
        holdings1 = [
            ETFHoldings(code="069500", ticker="삼성전자", weight=30.0),
            ETFHoldings(code="069500", ticker="SK하이닉스", weight=10.0),
        ]
        mock_holdings_res1 = MagicMock()
        mock_holdings_res1.scalars.return_value.all.return_value = holdings1

        # Second query for '453850' holdings:
        holdings2 = [
            ETFHoldings(code="453850", ticker="삼성전자", weight=25.0),
            ETFHoldings(code="453850", ticker="SK하이닉스", weight=15.0),
            ETFHoldings(code="453850", ticker="NAVER", weight=5.0),
        ]
        mock_holdings_res2 = MagicMock()
        mock_holdings_res2.scalars.return_value.all.return_value = holdings2

        self.mock_db.execute.side_effect = [
            mock_master_result,  # First query: ETFMaster selection
            mock_holdings_res1,   # Second query: ETFHoldings for 069500
            mock_holdings_res2,   # Third query: ETFHoldings for 453850
        ]

        analyzer = ETFOverlapAnalyzer(holdings, self.mock_db)
        result = await analyzer.analyze()

        self.assertEqual(result["status"], "success")
        self.assertEqual(result["summary"]["etf_total_eval"], 10000000.0)

        # Pairwise overlap:
        # 069500 holdings: 삼성전자=30/40 * 100 = 75%, SK하이닉스=10/40 * 100 = 25% (total_w = 40)
        # 453850 holdings: 삼성전자=25/45 * 100 = 55.56%, SK하이닉스=15/45 * 100 = 33.33%, NAVER=5/45 * 100 = 11.11% (total_w = 45)
        # min overlap 삼성전자: min(75.0, 55.56) = 55.56%
        # min overlap SK하이닉스: min(25.0, 33.33) = 25.0%
        # total overlap: 55.56 + 25.0 = 80.56%
        overlap_069500_453850 = result["overlap_matrix"]["069500"]["453850"]
        self.assertAlmostEqual(overlap_069500_453850, 80.56, delta=0.5)

        # True exposure:
        # 069500 weight in portfolio: 60%
        # 453850 weight in portfolio: 40%
        # True Weight 삼성전자 = 0.6 * 75.0 + 0.4 * 55.56 = 45.0 + 22.22 = 67.22%
        true_exposure_names = [item["name"] for item in result["true_exposure"]]
        self.assertIn("삼성전자", true_exposure_names)
        
        samsung_exposure = [item for item in result["true_exposure"] if item["name"] == "삼성전자"][0]
        self.assertAlmostEqual(samsung_exposure["weight_in_portfolio"], 67.22, delta=0.5)
        
        # Verify Recharts Treemap data format
        treemap_data = result["treemap_data"]
        self.assertEqual(treemap_data["name"], "Portfolio X-Ray")
        self.assertTrue(len(treemap_data["children"]) > 0)
        self.assertEqual(treemap_data["children"][0]["name"], "주식 (실질 노출)")

    async def test_portfolio_with_cash_and_stocks(self):
        # Mixed portfolio with cash, direct stocks, and ETFs
        holdings = [
            {"code": "069500", "name": "KODEX 200", "eval_amount": 5000000.0},
            {"code": "AAPL", "name": "Apple Inc.", "eval_amount": 3000000.0},
            {"code": "CASH", "name": "현금/예수금", "eval_amount": 2000000.0},
        ]

        master = ETFMaster(code="069500", name="KODEX 200")
        mock_master_result = MagicMock()
        mock_master_result.scalars.return_value.all.return_value = [master]

        # Kospi 200 proxy will be loaded automatically because mock_db returns empty for 069500 query
        mock_holdings_res = MagicMock()
        mock_holdings_res.scalars.return_value.all.return_value = []  # empty to trigger Kospi 200 fallback proxy

        self.mock_db.execute.side_effect = [
            mock_master_result,
            mock_holdings_res,
        ]

        analyzer = ETFOverlapAnalyzer(holdings, self.mock_db)
        result = await analyzer.analyze()

        self.assertEqual(result["status"], "success")
        self.assertEqual(result["summary"]["cash_balance"], 2000000.0)
        self.assertEqual(result["summary"]["etf_total_eval"], 5000000.0)

        # Treemap data should include cash
        children_names = [child["name"] for child in result["treemap_data"]["children"]]
        self.assertIn("현금/예수금", children_names)
        
        cash_child = [child for child in result["treemap_data"]["children"] if child["name"] == "현금/예수금"][0]
        self.assertEqual(cash_child["value"], 20.0)  # 2M / 10M = 20%
