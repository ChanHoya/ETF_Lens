import logging
import json
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from db.models import ETFMaster, ETFHoldings
from core.portfolio_analyzer import analyze_portfolio

logger = logging.getLogger(__name__)


class ETFOverlapAnalyzer:
    """
    Quantitative analysis engine to calculate portfolio-wide ETF holding overlaps,
    true underlying stock exposure, and diversification efficiency.
    """

    def __init__(self, holdings: list[dict], db: AsyncSession):
        """
        :param holdings: list of active holdings from KIS portfolio (e.g. from get_my_portfolio)
                         Expected format: [{'code': '069500', 'name': 'KODEX 200', 'eval_amount': 1000000}, ...]
        :param db: SQLAlchemy AsyncSession
        """
        self.holdings = holdings
        self.db = db
        self.total_eval = sum(h.get("eval_amount", 0) for h in holdings)
        self.cash_balance = 0.0

    async def analyze(self) -> dict:
        """
        Executes the full overlap quant engine.
        """
        if not self.holdings or self.total_eval == 0:
            return {
                "status": "success",
                "summary": {
                    "etf_total_eval": 0.0,
                    "cash_balance": 0.0,
                    "diversification_score": 100.0,
                },
                "overlap_matrix": {},
                "true_exposure": [],
                "treemap_data": {"name": "Portfolio", "children": []},
            }

        # 1. Identify cash, individual stocks, and ETFs
        etf_holdings = []
        individual_stocks = []
        
        # Calculate active weights in total portfolio
        for h in self.holdings:
            h_code = h.get("code", "")
            h_name = h.get("name", "")
            eval_amt = float(h.get("eval_amount", 0))
            
            # Simple heuristic for cash balance if passed directly in holdings
            if "CASH" in h_code.upper() or h_name in ("현금", "예수금", "Cash"):
                self.cash_balance += eval_amt
                continue

            h["weight_in_portfolio"] = eval_amt / self.total_eval if self.total_eval > 0 else 0.0

            # Heuristic to detect ETF: 6-digit numeric codes for domestic,
            # or matched against ETFMaster DB
            is_domestic_etf = h_code.isdigit() and len(h_code) == 6
            if is_domestic_etf:
                etf_holdings.append(h)
            else:
                individual_stocks.append(h)

        # 2. Fetch ETF master list to double-check matching and names
        etf_codes = [e["code"] for e in etf_holdings]
        etf_master_map = {}
        if etf_codes:
            query = select(ETFMaster).where(ETFMaster.code.in_(etf_codes))
            result = await self.db.execute(query)
            for etf_obj in result.scalars().all():
                etf_master_map[etf_obj.code] = etf_obj

        # Update display names for ETFs from master DB
        for e in etf_holdings:
            m_obj = etf_master_map.get(e["code"])
            if m_obj:
                e["display_name"] = m_obj.name
            else:
                e["display_name"] = e["name"]

        # 3. Resolve underlying stock holdings for each ETF
        etf_resolved_holdings = {}  # { etf_code: { stock_name: internal_weight_percent } }

        for e in etf_holdings:
            code = e["code"]
            e_holdings = await self._fetch_etf_underlying_holdings(code, etf_master_map.get(code))
            
            # Normalize underlying weights so they sum to 100% or close, preventing empty fallbacks
            if e_holdings:
                total_h_w = sum(item["weight"] for item in e_holdings if item["weight"] > 0)
                if total_h_w > 0:
                    etf_resolved_holdings[code] = {
                        item["ticker"]: (item["weight"] / total_h_w) * 100.0
                        for item in e_holdings if item["weight"] > 0
                    }
                else:
                    # Equal weight fallback if all weights are 0
                    count = len(e_holdings)
                    etf_resolved_holdings[code] = {
                        item["ticker"]: (100.0 / count)
                        for item in e_holdings
                    }
            else:
                # Absolute fallback: treat ETF as 100% exposure to itself as a mock stock
                etf_resolved_holdings[code] = {e["display_name"]: 100.0}

        # 4. Compute True Exposure (실질 자산 노출 비중)
        true_stock_weights = {}  # { stock_name: { "weight": total_weight_pct, "contrib": { etf_code: contrib_weight_pct } } }

        # Add contributions from ETFs
        for e in etf_holdings:
            code = e["code"]
            etf_weight = e["weight_in_portfolio"]  # ratio, e.g., 0.25
            resolved = etf_resolved_holdings.get(code, {})

            for stock_name, internal_weight in resolved.items():
                weighted_contrib = etf_weight * internal_weight  # e.g., 0.25 * 10.0 = 2.5%
                
                if stock_name not in true_stock_weights:
                    true_stock_weights[stock_name] = {
                        "name": stock_name,
                        "weight_in_portfolio": 0.0,
                        "contributing_etfs": []
                    }
                
                true_stock_weights[stock_name]["weight_in_portfolio"] += weighted_contrib
                true_stock_weights[stock_name]["contributing_etfs"].append({
                    "code": code,
                    "etf_name": e["display_name"],
                    "weighted_contribution": round(weighted_contrib, 2)
                })

        # Add contributions from individual stocks directly
        for s in individual_stocks:
            s_name = s["name"]
            s_weight_pct = s["weight_in_portfolio"] * 100.0  # convert to percent

            if s_name not in true_stock_weights:
                true_stock_weights[s_name] = {
                    "name": s_name,
                    "weight_in_portfolio": 0.0,
                    "contributing_etfs": []
                }
            true_stock_weights[s_name]["weight_in_portfolio"] += s_weight_pct
            true_stock_weights[s_name]["contributing_etfs"].append({
                "code": s.get("code", "DIRECT"),
                "etf_name": "직접 투자 (개별주식)",
                "weighted_contribution": round(s_weight_pct, 2)
            })

        # Round true weights and sort by weight descending
        true_exposure_list = []
        for s_name, data in true_stock_weights.items():
            data["weight_in_portfolio"] = round(data["weight_in_portfolio"], 2)
            if data["weight_in_portfolio"] > 0:
                data["contributing_etfs"].sort(key=lambda x: x["weighted_contribution"], reverse=True)
                true_exposure_list.append(data)
        
        true_exposure_list.sort(key=lambda x: x["weight_in_portfolio"], reverse=True)

        # 5. Compute Pairwise ETF Overlap Matrix (ETF 간 상호 중복도 행렬)
        overlap_matrix = {}
        for e1 in etf_holdings:
            code1 = e1["code"]
            overlap_matrix[code1] = {}
            for e2 in etf_holdings:
                code2 = e2["code"]
                if code1 == code2:
                    overlap_matrix[code1][code2] = 100.0
                else:
                    # Calculate holding overlap sum of minimum weights
                    h1 = etf_resolved_holdings.get(code1, {})
                    h2 = etf_resolved_holdings.get(code2, {})
                    
                    overlap_sum = 0.0
                    for stock_ticker, w1 in h1.items():
                        if stock_ticker in h2:
                            overlap_sum += min(w1, h2[stock_ticker])
                    
                    overlap_matrix[code1][code2] = round(overlap_sum, 2)

        # 6. Calculate Portfolio Diversification Efficiency Score (DES)
        # Formula: DES = 100 * (1 - sum_{i != j} (W_i * W_j * Overlap_{i, j} / 100))
        # normalized weights among ETF-only portion
        etf_total_weight = sum(e["weight_in_portfolio"] for e in etf_holdings)
        weighted_overlap_penalty = 0.0

        if len(etf_holdings) > 1 and etf_total_weight > 0:
            for e1 in etf_holdings:
                code1 = e1["code"]
                w1_norm = e1["weight_in_portfolio"] / etf_total_weight
                for e2 in etf_holdings:
                    code2 = e2["code"]
                    if code1 == code2:
                        continue
                    w2_norm = e2["weight_in_portfolio"] / etf_total_weight
                    overlap_pct = overlap_matrix[code1][code2]
                    
                    # Double sum penalty weighted by pair weights
                    weighted_overlap_penalty += (w1_norm * w2_norm * (overlap_pct / 100.0))
            
            # Since it's a double sum over i != j, penalty scales up to max 1.0.
            # We subtract it from 1.0 to get the score out of 100.
            diversification_score = round(100.0 * (1.0 - weighted_overlap_penalty), 1)
        else:
            diversification_score = 100.0

        # Cap minimum score at 0.0
        diversification_score = max(0.0, diversification_score)

        # 7. Construct Treemap Data payload for Recharts
        # Groups: 주식 (underlying holdings), 채권, 금, 현금
        stock_children = []
        bond_children = []
        gold_children = []

        # We can categorize underlying stocks using simple name heuristics
        for item in true_exposure_list:
            name = item["name"]
            weight = item["weight_in_portfolio"]
            
            # Categorize the exposure
            if any(kw in name for kw in ["채권", "국고채", "회사채", "Treasury", "Bond"]):
                bond_children.append({"name": name, "value": weight})
            elif any(kw in name for kw in ["금", "골드", "Gold"]):
                gold_children.append({"name": name, "value": weight})
            else:
                stock_children.append({"name": name, "value": weight})

        treemap_categories = []
        if stock_children:
            treemap_categories.append({"name": "주식 (실질 노출)", "children": stock_children[:25]})  # Top 25 for clean visualization
        if bond_children:
            treemap_categories.append({"name": "채권", "children": bond_children})
        if gold_children:
            treemap_categories.append({"name": "대체자산/금", "children": gold_children})
        
        # Cash Category
        cash_weight_pct = round((self.cash_balance / self.total_eval) * 100.0, 2) if self.total_eval > 0 else 0.0
        if cash_weight_pct > 0:
            treemap_categories.append({"name": "현금/예수금", "value": cash_weight_pct})

        treemap_data = {
            "name": "Portfolio X-Ray",
            "children": treemap_categories
        }

        # Calculate total ETF valuation
        etf_total_eval = sum(e.get("eval_amount", 0) for e in etf_holdings)

        return {
            "status": "success",
            "summary": {
                "etf_total_eval": etf_total_eval,
                "cash_balance": self.cash_balance,
                "diversification_score": diversification_score,
            },
            "overlap_matrix": overlap_matrix,
            "true_exposure": true_exposure_list,
            "treemap_data": treemap_data,
        }

    async def _fetch_etf_underlying_holdings(self, code: str, etf_master: ETFMaster = None) -> list[dict]:
        """
        Attempts to resolve the underlying holdings for an ETF:
        1. Query ETFHoldings table in DB.
        2. If empty, check basic_info_json in ETFMaster DB.
        3. If still empty, return empty list (caller will fall back).
        """
        # Step 1: Query database table ETFHoldings
        query = select(ETFHoldings).where(ETFHoldings.code == code)
        result = await self.db.execute(query)
        db_holdings = result.scalars().all()

        if db_holdings:
            return [{"ticker": h.ticker, "weight": h.weight} for h in db_holdings]

        # Step 2: Fallback to basic_info_json in ETFMaster
        if etf_master and etf_master.basic_info_json:
            try:
                basic_info = json.loads(etf_master.basic_info_json)
                if "holdings" in basic_info:
                    holdings_raw = basic_info["holdings"]
                    resolved = []
                    for h in holdings_raw:
                        h_name = h.get("name", h.get("ticker", "Unknown"))
                        h_w_str = str(h.get("weight", "0")).replace("%", "").strip()
                        resolved.append({
                            "ticker": h_name,
                            "weight": float(h_w_str)
                        })
                    if resolved:
                        return resolved
            except Exception as e:
                logger.error(f"Error parsing basic_info_json for ETF {code}: {e}")

        # Try Famous Index proxy holdings as extreme safety net
        # (e.g. 069500 is KODEX 200, representing Kospi 200)
        if code == "069500":  # KODEX 200 proxy
            return [
                {"ticker": "삼성전자", "weight": 30.2},
                {"ticker": "SK하이닉스", "weight": 6.8},
                {"ticker": "LG에너지솔루션", "weight": 3.4},
                {"ticker": "삼성바이오로직스", "weight": 2.9},
                {"ticker": "현대차", "weight": 2.5},
                {"ticker": "기아", "weight": 2.2},
                {"ticker": "셀트리온", "weight": 2.1},
                {"ticker": "KB금융", "weight": 1.9},
                {"ticker": "신한지주", "weight": 1.7},
                {"ticker": "POSCO홀딩스", "weight": 1.6},
            ]

        return []
