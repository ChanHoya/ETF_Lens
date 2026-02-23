import logging
from pydantic import BaseModel, ValidationError
from typing import Dict, Any, List, Optional


class QAReport(BaseModel):
    is_valid: bool
    errors: List[str]
    warnings: List[str]


class ETFQAAgent:
    """
    Agent 5: Testing and Quality Assurance
    Responsible for validating data structures, logic correctness, and system health.
    """

    def __init__(self):
        self.logger = logging.getLogger("ETF_QA_Agent")
        self.logger.setLevel(logging.INFO)
        if not self.logger.handlers:
            ch = logging.StreamHandler()
            formatter = logging.Formatter(
                "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
            )
            ch.setFormatter(formatter)
            self.logger.addHandler(ch)

    def validate_harvester_data(self, data: Dict[str, Any]) -> QAReport:
        """
        Validates the output of Agent 1 (Harvester) to ensure all required fields are present
        and data types are correct.
        """
        errors = []
        warnings = []
        is_valid = True

        if not data.get("etf_code"):
            errors.append("Missing etf_code field.")
            is_valid = False

        market_data = data.get("market_data", {})
        if "price" not in market_data:
            errors.append("Missing price in market_data.")
            is_valid = False
        elif market_data["price"] is None:
            warnings.append("Price is None. Fetching may have failed or used fallback.")

        if "nav" not in market_data:
            errors.append("Missing nav in market_data.")
            is_valid = False
        elif market_data["nav"] is None:
            warnings.append("NAV is None. Fetching may have failed or used fallback.")

        if errors:
            self.logger.error(f"Harvester Validation Failed: {errors}")
        if warnings:
            self.logger.warning(f"Harvester Validation Warnings: {warnings}")

        return QAReport(is_valid=is_valid, errors=errors, warnings=warnings)

    def validate_quant_metrics(self, metrics: Dict[str, Any]) -> QAReport:
        """
        Validates the output of Agent 2 (Quant) to ensure calculations make logical sense.
        For example, a total return shouldn't typically be > 1,000,000%.
        """
        errors = []
        warnings = []
        is_valid = True

        # Expected keys from ETFQuant
        expected_keys = [
            "total_return_pct",
            "annualized_volatility_pct",
            "mdd_pct",
            "sharpe_ratio",
        ]

        for key in expected_keys:
            if key not in metrics:
                errors.append(f"Missing expected Quant metric: {key}")
                is_valid = False

        # Logical checks
        if "mdd_pct" in metrics and metrics["mdd_pct"] > 0:
            errors.append(
                "MDD (Maximum Drawdown) should be a negative percentage or 0."
            )
            is_valid = False

        if errors:
            self.logger.error(f"Quant Validation Failed: {errors}")

        return QAReport(is_valid=is_valid, errors=errors, warnings=warnings)
