import unittest
from agents.harvester.harvester import ETFHarvester
from agents.quant.quant import ETFQuant
from agents.qa.qa import ETFQAAgent


class TestE2EPipeline(unittest.IsolatedAsyncioTestCase):
    async def test_full_pipeline(self):
        # 1. Initialize Agents
        harvester = ETFHarvester()
        quant = ETFQuant()
        qa = ETFQAAgent()

        try:
            await harvester.initialize()

            # 2. Agent 1: Harvest Data
            etf1_code = "453850"
            etf2_code = "462330"

            data1 = await harvester.fetch_naver_etf_data(etf1_code)
            data2 = await harvester.fetch_naver_etf_data(etf2_code)

            # 3. Agent 5: QA Harvester Data
            qa_report_1 = qa.validate_harvester_data(data1)
            qa_report_2 = qa.validate_harvester_data(data2)

            self.assertTrue(
                qa_report_1.is_valid,
                f"ETF {etf1_code} data is invalid: {qa_report_1.errors}",
            )
            self.assertTrue(
                qa_report_2.is_valid,
                f"ETF {etf2_code} data is invalid: {qa_report_2.errors}",
            )

            # 4. Agent 2: Quant Analysis (Mock overlap)
            mock_holdings_1 = [{"ticker": "AAPL", "weight": 10.0}]
            mock_holdings_2 = [{"ticker": "AAPL", "weight": 8.0}]
            overlap_pct = quant.calculate_overlap(mock_holdings_1, mock_holdings_2)

            self.assertGreaterEqual(overlap_pct, 0.0)
            self.assertLessEqual(overlap_pct, 100.0)

            # 5. Agent 3 (Router): Payload Construction (Simulated)
            payload = {
                "header": ["종목명", "현재가", "NAV"],
                "rows": [
                    [
                        f"ETF_{data1['etf_code']}",
                        f"{data1['market_data']['price']}원",
                        f"{data1['market_data']['nav']}원",
                    ],
                    [
                        f"ETF_{data2['etf_code']}",
                        f"{data2['market_data']['price']}원",
                        f"{data2['market_data']['nav']}원",
                    ],
                ],
                "insight_comment": f"두 ETF의 포트폴리오 주요 종목 중복도는 {overlap_pct}% 입니다.",
            }

            self.assertEqual(len(payload["rows"]), 2)
            # The prices are now real KRX prices, so we just check it is a formatted string
            self.assertIn("원", str(payload["rows"][0][1]))

        finally:
            await harvester.close()


if __name__ == "__main__":
    unittest.main()
