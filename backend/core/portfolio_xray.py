# backend/core/portfolio_xray.py
"""
포트폴리오 X-Ray 엔진:
1. 보유 ETF 간 구성 종목 중복도(Stock Overlap) 및 실질 노출도(True Exposure) 진단
2. 명시적 총보수(TER) vs 숨은 실질비용(기타비용 + 매매중개수수료) 정밀 분석
"""

from typing import List, Dict, Any, Optional

# 주요 ETF별 기초자산 Top 구성 종목 및 실질 총보수 DB (금융투자협회 공시 기준)
ETF_KNOWLEDGE_BASE: Dict[str, Dict[str, Any]] = {
    "S&P500": {
        "benchmark": "S&P 500 Index",
        "stated_ter": 0.07,      # 공시 총보수 %
        "other_expenses": 0.08, # 기타비용 %
        "trading_fees": 0.05,   # 매매중개수수료율 %
        "top_holdings": [
            {"stock": "Apple (AAPL)", "weight": 7.1},
            {"stock": "Microsoft (MSFT)", "weight": 6.8},
            {"stock": "NVIDIA (NVDA)", "weight": 6.5},
            {"stock": "Amazon (AMZN)", "weight": 3.7},
            {"stock": "Alphabet (GOOGL)", "weight": 3.6},
            {"stock": "Meta (META)", "weight": 2.5},
            {"stock": "Berkshire Hathaway (BRK.B)", "weight": 1.7},
            {"stock": "Broadcom (AVGO)", "weight": 1.6},
            {"stock": "Tesla (TSLA)", "weight": 1.5},
            {"stock": "JPMorgan Chase (JPM)", "weight": 1.3}
        ]
    },
    "나스닥": {
        "benchmark": "NASDAQ 100 Index",
        "stated_ter": 0.07,
        "other_expenses": 0.10,
        "trading_fees": 0.06,
        "top_holdings": [
            {"stock": "Apple (AAPL)", "weight": 8.9},
            {"stock": "Microsoft (MSFT)", "weight": 8.2},
            {"stock": "NVIDIA (NVDA)", "weight": 7.8},
            {"stock": "Broadcom (AVGO)", "weight": 5.1},
            {"stock": "Amazon (AMZN)", "weight": 4.9},
            {"stock": "Meta (META)", "weight": 4.6},
            {"stock": "Alphabet (GOOGL)", "weight": 4.5},
            {"stock": "Tesla (TSLA)", "weight": 3.2},
            {"stock": "Costco (COST)", "weight": 2.5},
            {"stock": "Netflix (NFLX)", "weight": 2.1}
        ]
    },
    "반도체": {
        "benchmark": "Philadelphia Semiconductor / Global AI Semi",
        "stated_ter": 0.45,
        "other_expenses": 0.15,
        "trading_fees": 0.09,
        "top_holdings": [
            {"stock": "NVIDIA (NVDA)", "weight": 18.5},
            {"stock": "Broadcom (AVGO)", "weight": 12.0},
            {"stock": "TSMC (TSM)", "weight": 11.2},
            {"stock": "AMD (AMD)", "weight": 8.5},
            {"stock": "Qualcomm (QCOM)", "weight": 6.8},
            {"stock": "Applied Materials (AMAT)", "weight": 5.2},
            {"stock": "Micron (MU)", "weight": 4.8},
            {"stock": "Intel (INTC)", "weight": 4.0},
            {"stock": "ASML (ASML)", "weight": 3.8},
            {"stock": "KLA (KLAC)", "weight": 3.5}
        ]
    },
    "빅테크": {
        "benchmark": "US Big Tech TOP 7+",
        "stated_ter": 0.30,
        "other_expenses": 0.12,
        "trading_fees": 0.07,
        "top_holdings": [
            {"stock": "NVIDIA (NVDA)", "weight": 20.0},
            {"stock": "Microsoft (MSFT)", "weight": 18.0},
            {"stock": "Apple (AAPL)", "weight": 17.5},
            {"stock": "Alphabet (GOOGL)", "weight": 14.5},
            {"stock": "Amazon (AMZN)", "weight": 12.0},
            {"stock": "Meta (META)", "weight": 9.5},
            {"stock": "Tesla (TSLA)", "weight": 6.5}
        ]
    },
    "배당다우존스": {
        "benchmark": "Dow Jones US Dividend 100",
        "stated_ter": 0.15,
        "other_expenses": 0.09,
        "trading_fees": 0.05,
        "top_holdings": [
            {"stock": "Broadcom (AVGO)", "weight": 4.8},
            {"stock": "Home Depot (HD)", "weight": 4.5},
            {"stock": "Texas Instruments (TXN)", "weight": 4.3},
            {"stock": "Cisco Systems (CSCO)", "weight": 4.1},
            {"stock": "Chevron (CVX)", "weight": 4.0},
            {"stock": "Pfizer (PFE)", "weight": 3.8},
            {"stock": "Coca-Cola (KO)", "weight": 3.7},
            {"stock": "AbbVie (ABBV)", "weight": 3.6},
            {"stock": "PepsiCo (PEP)", "weight": 3.5},
            {"stock": "Lockheed Martin (LMT)", "weight": 3.4}
        ]
    },
    "국내대표": {
        "benchmark": "KOSPI 200 / 반도체",
        "stated_ter": 0.15,
        "other_expenses": 0.08,
        "trading_fees": 0.04,
        "top_holdings": [
            {"stock": "삼성전자", "weight": 22.5},
            {"stock": "SK하이닉스", "weight": 15.8},
            {"stock": "LG에너지솔루션", "weight": 5.2},
            {"stock": "현대차", "weight": 4.1},
            {"stock": "삼성바이오로직스", "weight": 3.8},
            {"stock": "기아", "weight": 2.9},
            {"stock": "셀트리온", "weight": 2.7},
            {"stock": "KB금융", "weight": 2.6},
            {"stock": "NAVER", "weight": 2.1},
            {"stock": "신한지주", "weight": 2.0}
        ]
    },
    "미국30년국채": {
        "benchmark": "US Treasury 20+ / 30Y",
        "stated_ter": 0.25,
        "other_expenses": 0.12,
        "trading_fees": 0.06,
        "top_holdings": [
            {"stock": "US Treasury 4.25% 2054", "weight": 35.0},
            {"stock": "US Treasury 4.125% 2053", "weight": 28.0},
            {"stock": "US Treasury 3.875% 2052", "weight": 22.0},
            {"stock": "Cash & Repos", "weight": 15.0}
        ]
    }
}


class PortfolioXRayAnalyzer:
    """포트폴리오 X-Ray 분석 엔진"""

    def match_etf_profile(self, name: str) -> Dict[str, Any]:
        """ETF 상품명으로 벤치마크 및 구성 종목 프로필 매칭"""
        name_clean = name.upper().replace(" ", "")
        if "S&P" in name_clean or "SP500" in name_clean:
            return ETF_KNOWLEDGE_BASE["S&P500"]
        elif "나스닥" in name_clean or "NASDAQ" in name_clean:
            return ETF_KNOWLEDGE_BASE["나스닥"]
        elif "반도체" in name_clean or "SEMICON" in name_clean:
            return ETF_KNOWLEDGE_BASE["반도체"]
        elif "빅테크" in name_clean or "BIGTECH" in name_clean or "테크TOP" in name_clean:
            return ETF_KNOWLEDGE_BASE["빅테크"]
        elif "배당" in name_clean or "다우존스" in name_clean or "SCHD" in name_clean:
            return ETF_KNOWLEDGE_BASE["배당다우존스"]
        elif "국채" in name_clean or "채권" in name_clean or "TREASURY" in name_clean or "TFF" in name_clean:
            return ETF_KNOWLEDGE_BASE["미국30년국채"]
        elif "200" in name_clean or "KOSPI" in name_clean or "코스피" in name_clean or "삼성" in name_clean:
            return ETF_KNOWLEDGE_BASE["국내대표"]
        else:
            # 기본 글로벌 분산형
            return ETF_KNOWLEDGE_BASE["S&P500"]

    def analyze_portfolio(self, holdings: List[Dict[str, Any]]) -> Dict[str, Any]:
        """포트폴리오 내 ETF 중복도 및 숨은 실질비용 종합 진단"""
        total_eval = sum(h.get("eval_amount", 0) for h in holdings)
        if total_eval <= 0:
            return {
                "total_eval_amount": 0,
                "overlap_analysis": {"top_underlying_stocks": [], "overlap_warning_count": 0},
                "cost_analysis": {"weighted_stated_ter": 0, "weighted_real_ter": 0, "annual_hidden_cost_won": 0}
            }

        # 1. 종목 중복도(Underlying Stock Overlap) 집계
        stock_exposure_map: Dict[str, Dict[str, Any]] = {}
        etf_cost_items: List[Dict[str, Any]] = []

        total_stated_cost_won = 0.0
        total_real_cost_won = 0.0

        for h in holdings:
            name = h.get("name", "")
            eval_won = h.get("eval_amount", 0)
            if eval_won <= 0:
                continue

            weight_in_portfolio = (eval_won / total_eval) * 100.0 # %
            profile = self.match_etf_profile(name)

            stated_ter = profile["stated_ter"]
            other_exp = profile["other_expenses"]
            trading_fee = profile["trading_fees"]
            real_ter = round(stated_ter + other_exp + trading_fee, 2)
            hidden_fee_diff = round(real_ter - stated_ter, 2)

            stated_won = eval_won * (stated_ter / 100.0)
            real_won = eval_won * (real_ter / 100.0)

            total_stated_cost_won += stated_won
            total_real_cost_won += real_won

            etf_cost_items.append({
                "name": name,
                "eval_amount": eval_won,
                "weight_pct": round(weight_in_portfolio, 1),
                "stated_ter": stated_ter,
                "real_ter": real_ter,
                "hidden_fee_diff": hidden_fee_diff,
                "annual_real_cost_won": round(real_won),
                "annual_hidden_cost_won": round(real_won - stated_won)
            })

            # 기초 종목 가중 분해
            for holding_item in profile.get("top_holdings", []):
                stock_name = holding_item["stock"]
                stock_weight_in_etf = holding_item["weight"] # % in ETF

                # 포트폴리오 전체 관점에서 해당 종목이 차지하는 실질 비중
                effective_weight = (weight_in_portfolio * (stock_weight_in_etf / 100.0))
                effective_amount = eval_won * (stock_weight_in_etf / 100.0)

                if stock_name not in stock_exposure_map:
                    stock_exposure_map[stock_name] = {
                        "stock_name": stock_name,
                        "effective_weight_pct": 0.0,
                        "effective_amount_won": 0.0,
                        "contributing_etfs": []
                    }

                stock_exposure_map[stock_name]["effective_weight_pct"] += effective_weight
                stock_exposure_map[stock_name]["effective_amount_won"] += effective_amount
                stock_exposure_map[stock_name]["contributing_etfs"].append({
                    "etf_name": name,
                    "etf_weight": round(stock_weight_in_etf, 1)
                })

        # 상위 실질 노출 종목 정렬
        sorted_stocks = sorted(
            stock_exposure_map.values(),
            key=lambda x: x["effective_weight_pct"],
            reverse=True
        )

        for s in sorted_stocks:
            s["effective_weight_pct"] = round(s["effective_weight_pct"], 2)
            s["effective_amount_won"] = round(s["effective_amount_won"])
            s["is_overlapped"] = len(s["contributing_etfs"]) >= 2
            s["overlap_count"] = len(s["contributing_etfs"])

        # 중복 보유 종목 수
        overlap_warning_stocks = [s for s in sorted_stocks if s["is_overlapped"] and s["effective_weight_pct"] >= 3.0]

        # 비용 통계
        weighted_stated_ter = round((total_stated_cost_won / total_eval) * 100.0, 3)
        weighted_real_ter = round((total_real_cost_won / total_eval) * 100.0, 3)
        annual_hidden_cost_won = round(total_real_cost_won - total_stated_cost_won)

        # 비용 등급 판정
        if weighted_real_ter >= 0.40:
            cost_grade = "HIGH"
            cost_label = "비용 절감 필요"
            cost_color = "rose"
            cost_diagnosis = "포트폴리오의 실질 총비용(Real TER)이 연 0.4% 이상입니다. 동일 지수를 추종하는 저비용 ETF(수수료 0.1% 미만)로 리밸런싱을 권장합니다."
        elif weighted_real_ter >= 0.20:
            cost_grade = "MODERATE"
            cost_label = "적정 수준"
            cost_color = "amber"
            cost_diagnosis = "글로벌 평균 수준의 합리적 보수입니다. 숨은 기타비용 및 매매회전율을 주기적으로 모니터링하세요."
        else:
            cost_grade = "OPTIMAL"
            cost_label = "초저비용 최적화"
            cost_color = "emerald"
            cost_diagnosis = "포트폴리오 전반이 초저비용 패시브 ETF로 매우 효율적으로 구성되어 장기 복리 효과가 극대화됩니다."

        return {
            "total_eval_amount": total_eval,
            "overlap_analysis": {
                "top_underlying_stocks": sorted_stocks[:10],
                "overlap_warning_count": len(overlap_warning_stocks),
                "overlap_warning_stocks": overlap_warning_stocks,
                "diagnosis": (
                    f"보유 ETF 간 {len(overlap_warning_stocks)}개 주요 종목이 복수 ETF에 중복 편입되어 있습니다. "
                    f"특히 '{sorted_stocks[0]['stock_name'] if sorted_stocks else '상위종목'}'의 경우 여러 ETF에 걸쳐 포트폴리오의 "
                    f"{sorted_stocks[0]['effective_weight_pct'] if sorted_stocks else 0}%를 실질 차지하고 있습니다."
                ) if overlap_warning_stocks else "보유 ETF 간 종목 분산이 양호하며 특정 개별 종목의 과다 중복이 없습니다."
            },
            "cost_analysis": {
                "weighted_stated_ter": weighted_stated_ter,
                "weighted_real_ter": weighted_real_ter,
                "hidden_ter_spread": round(weighted_real_ter - weighted_stated_ter, 3),
                "total_annual_stated_cost_won": round(total_stated_cost_won),
                "total_annual_real_cost_won": round(total_real_cost_won),
                "annual_hidden_cost_won": annual_hidden_cost_won,
                "cost_grade": cost_grade,
                "cost_label": cost_label,
                "cost_color": cost_color,
                "cost_diagnosis": cost_diagnosis,
                "etf_cost_items": sorted(etf_cost_items, key=lambda x: x["real_ter"], reverse=True)
            }
        }


# 싱글톤 인스턴스
portfolio_xray_analyzer = PortfolioXRayAnalyzer()
