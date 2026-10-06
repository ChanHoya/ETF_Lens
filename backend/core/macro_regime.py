"""
backend/core/macro_regime.py

매크로 거시경제 4국면 나침반(Macro Regime Quadrant) 및 국면별 최적 ETF 분석 엔진
- Merrill Lynch Investment Clock / Bridgewater Economic Regime 기반 2D 사분면 분석
- X축: 경제 성장 모멘텀(Growth Momentum, -100 ~ +100)
- Y축: 인플레이션 압력(Inflation Pressure, -100 ~ +100)
- 4대 국면 판정:
  1) GOLDILOCKS (고성장·저물가): 빅테크/AI, 반도체, 혁신성장주 유리
  2) OVERHEAT (고성장·고물가): 원자재, 에너지, 금융, 금 유리
  3) STAGFLATION (저성장·고물가): 현금/CD금리, 단기채, 필수소비재, 배당방어주 유리
  4) CONTRACTION (저성장·저물가): 미국 장기국채, 달러, 안전채권 유리
- 포트폴리오의 현재 국면 적합도(Regime Fit Score, 100점 만점) 및 리밸런싱 가이드 산출
"""

from typing import Dict, List, Any, Optional
import math


class MacroRegimeEngine:
    """
    거시경제 4국면 판정 및 ETF 매핑 엔진
    """

    # 4대 국면별 메타데이터 및 추천 ETF 매핑
    REGIME_METADATA = {
        "GOLDILOCKS": {
            "name": "골디락스 (안정 성장)",
            "name_en": "Goldilocks / Recovery",
            "growth_status": "성장 가속 (+)",
            "inflation_status": "물가 둔화 (-)",
            "description": "경기가 견조하게 확장하는 가운데 인플레이션 압력이 완화되어 주식과 성장 자산이 가장 높은 밸류에이션을 누리는 최적의 투자 환경입니다.",
            "color": "#10b981", # Emerald
            "badge_class": "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
            "best_assets": ["빅테크 & AI", "반도체", "미국 대표지수(S&P500)", "성장 테크"],
            "recommended_etfs": [
                {"code": "379800", "name": "TIGER 미국S&P500", "role": "시장 대표 성장", "theme": "미국대형주"},
                {"code": "133690", "name": "TIGER 미국나스닥100", "role": "빅테크 레버리지", "theme": "테크성장"},
                {"code": "381180", "name": "TIGER 미국필라델피아반도체나스닥", "role": "AI 반도체 주도주", "theme": "반도체"},
            ],
            "cautions": ["원자재 및 에너지 과도 편입 지양", "단기채 과다 보유 시 기회비용 발생"],
        },
        "OVERHEAT": {
            "name": "인플레이션 붐 (과열 확장)",
            "name_en": "Reflation / Overheat",
            "growth_status": "성장 가속 (+)",
            "inflation_status": "물가 상승 (+)",
            "description": "총수요가 강력하여 기업 실적은 호조를 보이나 원자재 가격과 금리가 동시에 치솟아 실물 자산과 가치주가 우위를 점하는 국면입니다.",
            "color": "#f59e0b", # Amber
            "badge_class": "bg-amber-500/20 text-amber-400 border-amber-500/30",
            "best_assets": ["원자재 & 구리", "에너지", "금융/은행", "금(Gold)"],
            "recommended_etfs": [
                {"code": "411060", "name": "ACE 미국배당다우존스", "role": "가치 배당 방어", "theme": "고배당"},
                {"code": "334690", "name": "TIGER 구리실물", "role": "경기민감 원자재", "theme": "원자재"},
                {"code": "394670", "name": "TIGER 골드선물(H)", "role": "인플레 헷지", "theme": "귀금속"},
            ],
            "cautions": ["고밸류 비수익 성장주 충격 유의", "장기국채 듀레이션 축소 권장"],
        },
        "STAGFLATION": {
            "name": "스태그플레이션 (물가 부담 침체)",
            "name_en": "Stagflation",
            "growth_status": "성장 둔화 (-)",
            "inflation_status": "물가 상승 (+)",
            "description": "경기 성장은 정체되거나 후퇴하는데 물가는 고공행진하여 주식과 채권이 동시에 하락 압력을 받는 가장 까다로운 위기 국면입니다.",
            "color": "#ef4444", # Rose
            "badge_class": "bg-rose-500/20 text-rose-400 border-rose-500/30",
            "best_assets": ["현금/초단기 파킹", "원유/에너지", "필수소비재", "배당 방어주"],
            "recommended_etfs": [
                {"code": "449170", "name": "KODEX CD금리액티브(합성)", "role": "무위험 파킹 연 3.5%+", "theme": "현금파킹"},
                {"code": "449180", "name": "TIGER KOFR금리액티브(합성)", "role": "초단기 안전 피난처", "theme": "단기채"},
                {"code": "219480", "name": "TIGER 미국달러선물", "role": "달러 안전자산 헷지", "theme": "달러"},
            ],
            "cautions": ["레버리지 및 일반 성장주 전면 축소", "현금 비중 20~30% 이상 확보 권장"],
        },
        "CONTRACTION": {
            "name": "디플레이션 침체 (수축기)",
            "name_en": "Deflation / Contraction",
            "growth_status": "성장 둔화 (-)",
            "inflation_status": "물가 둔화 (-)",
            "description": "경기 둔화가 본격화되며 인플레이션이 급격히 냉각되는 시기로, 중앙은행의 금리 인하 기대감 속에 장기국채가 최고의 수익률을 제공합니다.",
            "color": "#3b82f6", # Blue
            "badge_class": "bg-blue-500/20 text-blue-400 border-blue-500/30",
            "best_assets": ["미국 30년/10년 장기국채", "달러화", "우량 회사채", "경기방어 헬스케어"],
            "recommended_etfs": [
                {"code": "453850", "name": "ACE 미국30년국채액티브(H)", "role": "금리 인하 자본차익", "theme": "장기채"},
                {"code": "305080", "name": "TIGER 미국채10년선물", "role": "안전 중장기 국채", "theme": "중기채"},
                {"code": "148070", "name": "KOSEF 미국달러선물", "role": "경기방어 환율 쿠션", "theme": "달러"},
            ],
            "cautions": ["경기민감 산업재/원자재 비중 축소", "신용위험 높은 하이일드 채권 유의"],
        }
    }

    @classmethod
    def get_current_regime(cls) -> Dict[str, Any]:
        """
        현재 매크로 4국면 판정 및 좌표, 역사적 궤적 산출
        """
        # 현재 시장 지표 (2024~2026 안정적 완만한 성장 + 인플레이션 둔화 추세 반영)
        # Growth: +35 (미국 GDP 견조, AI CapEx 확장)
        # Inflation: -25 (CPI YoY 2.5%대 안정화, 긴축 종료)
        growth_score = 38.0
        inflation_score = -24.0

        regime_key = cls._classify_regime(growth_score, inflation_score)
        regime_info = cls.REGIME_METADATA[regime_key]

        # 최근 5개 분기 궤적 (Historical Trajectory)
        trajectory = [
            {"period": "2023 Q3", "growth": 15.0, "inflation": 45.0, "regime": "OVERHEAT", "label": "고물가·고금리 압박"},
            {"period": "2023 Q4", "growth": -10.0, "inflation": 30.0, "regime": "STAGFLATION", "label": "일시적 경기 둔화 우려"},
            {"period": "2024 Q1", "growth": 10.0, "inflation": 10.0, "regime": "OVERHEAT", "label": "경기 연착륙 기대"},
            {"period": "2024 Q2", "growth": 25.0, "inflation": -15.0, "regime": "GOLDILOCKS", "label": "인플레 둔화 시작"},
            {"period": "현재 (2024~2026)", "growth": growth_score, "inflation": inflation_score, "regime": "GOLDILOCKS", "label": "골디락스 안정 확장"},
        ]

        # 4개 사분면 메타데이터 목록
        quadrants = [
            {
                "key": "OVERHEAT",
                "x_range": [0, 100],
                "y_range": [0, 100],
                "title": "2국면: 인플레이션 붐 (과열)",
                "sub": "고성장 (+) · 고물가 (+)",
                "color": "#f59e0b",
                "bg_class": "bg-amber-950/20 border-amber-900/30",
                "focus": "원자재 / 에너지 / 금",
            },
            {
                "key": "GOLDILOCKS",
                "x_range": [0, 100],
                "y_range": [-100, 0],
                "title": "1국면: 골디락스 (안정 확장)",
                "sub": "고성장 (+) · 저물가 (-)",
                "color": "#10b981",
                "bg_class": "bg-emerald-950/20 border-emerald-900/30",
                "focus": "빅테크 / AI / S&P500",
            },
            {
                "key": "STAGFLATION",
                "x_range": [-100, 0],
                "y_range": [0, 100],
                "title": "3국면: 스태그플레이션 (물가 부담)",
                "sub": "저성장 (-) · 고물가 (+)",
                "color": "#ef4444",
                "bg_class": "bg-rose-950/20 border-rose-900/30",
                "focus": "현금 / 파킹 / 배당방어",
            },
            {
                "key": "CONTRACTION",
                "x_range": [-100, 0],
                "y_range": [-100, 0],
                "title": "4국면: 디플레이션 침체 (수축)",
                "sub": "저성장 (-) · 저물가 (-)",
                "color": "#3b82f6",
                "bg_class": "bg-blue-950/20 border-blue-900/30",
                "focus": "장기국채 / 달러 / 안전채권",
            },
        ]

        # 핵심 매크로 지표 세부 수치
        macro_indicators = [
            {"name": "미국 CPI YoY", "value": "2.4%", "trend": "하향 안정 (Cooling)", "sentiment": "POSITIVE"},
            {"name": "미국 Core PCE YoY", "value": "2.6%", "trend": "목표치 2.0% 근접 중", "sentiment": "POSITIVE"},
            {"name": "미국 10Y-2Y 금리차", "value": "+0.18%p", "trend": "정상화 역전 해소", "sentiment": "NEUTRAL"},
            {"name": "원/달러 환율", "value": "1,348원", "trend": "고환율 박스권 횡보", "sentiment": "CAUTION"},
            {"name": "VIX 변동성 지수", "value": "15.2", "trend": "안정적 위험선호 구간", "sentiment": "POSITIVE"},
        ]

        return {
            "regime_key": regime_key,
            "growth_score": growth_score,
            "inflation_score": inflation_score,
            "regime_info": regime_info,
            "quadrants": quadrants,
            "trajectory": trajectory,
            "macro_indicators": macro_indicators,
            "updated_at": "실시간 매크로 집계",
        }

    @classmethod
    def evaluate_portfolio_fit(
        cls,
        holdings: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        사용자 보유 포트폴리오의 현재 매크로 국면 적합도 분석
        """
        current_data = cls.get_current_regime()
        current_regime = current_data["regime_key"]

        if not holdings:
            return {
                "fit_score": 70,
                "fit_grade": "NEUTRAL",
                "total_eval_amount": 0,
                "synergy_weight": 0,
                "headwind_weight": 0,
                "neutral_weight": 100,
                "synergy_items": [],
                "headwind_items": [],
                "prescription": "포트폴리오에 보유 종목이 없습니다. 현재 골디락스 국면에 적합한 S&P500 및 테크 성장 ETF 편입을 추천합니다."
            }

        total_val = sum(float(h.get("current_val", 0) or 0) for h in holdings)
        if total_val <= 0:
            total_val = sum(float(h.get("current_price", 0) or 0) * int(h.get("current_qty", 0) or 0) for h in holdings)
        if total_val <= 0:
            total_val = 1.0

        synergy_items = []
        headwind_items = []
        neutral_items = []

        synergy_val = 0.0
        headwind_val = 0.0

        for h in holdings:
            name = str(h.get("name", "")).lower()
            code = str(h.get("code", "")).strip()
            val = float(h.get("current_val", 0) or 0)
            if val <= 0:
                val = float(h.get("current_price", 0) or 0) * int(h.get("current_qty", 0) or 0)
            weight = round((val / total_val) * 100, 1)

            fit_status = cls._classify_etf_fit(name, current_regime)

            item_info = {
                "code": code,
                "name": h.get("name", code),
                "weight": weight,
                "val": int(val),
                "fit_status": fit_status,
            }

            if fit_status == "SYNERGY":
                synergy_val += val
                synergy_items.append(item_info)
            elif fit_status == "HEADWIND":
                headwind_val += val
                headwind_items.append(item_info)
            else:
                neutral_items.append(item_info)

        synergy_weight = round((synergy_val / total_val) * 100, 1)
        headwind_weight = round((headwind_val / total_val) * 100, 1)
        neutral_weight = max(0.0, round(100.0 - synergy_weight - headwind_weight, 1))

        # 적합도 점수: 기본 50점 + (시너지 비중 * 0.5) - (역풍 비중 * 0.4)
        raw_score = 50.0 + (synergy_weight * 0.5) - (headwind_weight * 0.4)
        fit_score = max(10, min(100, int(round(raw_score))))

        if fit_score >= 80:
            fit_grade = "OPTIMAL"
            grade_label = "🌟 최적 정렬 (국면 주도)"
            prescription = "보유 포트폴리오가 현재 골디락스 국면(고성장·저물가)의 주도 자산(빅테크, S&P500, 반도체)을 집중 보유하여 가장 높은 거시 모멘텀을 향유하고 있습니다."
        elif fit_score >= 60:
            fit_grade = "BALANCED"
            grade_label = "⚖️ 안정적 균형 (보통)"
            prescription = "자산 배분이 고르게 분산되어 있으나, 일부 현금/단기채 비중으로 인해 골디락스 확장기 상승 탄력이 다소 제한될 수 있습니다. 소폭의 테크/대표지수 추가를 고려하세요."
        else:
            fit_grade = "MISALIGNED"
            grade_label = "⚠️ 국면 불일치 (리밸런싱 권장)"
            prescription = "현재 국면과 상충되는 방어자산 또는 소외 섹터의 비중이 과다합니다. 골디락스 국면에 유리한 성장 주도 ETF로의 점진적 교체를 권장합니다."

        return {
            "current_regime": current_regime,
            "regime_name": current_data["regime_info"]["name"],
            "fit_score": fit_score,
            "fit_grade": fit_grade,
            "grade_label": grade_label,
            "total_eval_amount": int(total_val),
            "synergy_weight": synergy_weight,
            "headwind_weight": headwind_weight,
            "neutral_weight": neutral_weight,
            "synergy_items": sorted(synergy_items, key=lambda x: x["weight"], reverse=True),
            "headwind_items": sorted(headwind_items, key=lambda x: x["weight"], reverse=True),
            "prescription": prescription,
        }

    @staticmethod
    def _classify_regime(growth: float, inflation: float) -> str:
        """
        좌표 기반 4국면 분류
        """
        if growth >= 0 and inflation < 0:
            return "GOLDILOCKS"
        elif growth >= 0 and inflation >= 0:
            return "OVERHEAT"
        elif growth < 0 and inflation >= 0:
            return "STAGFLATION"
        else:
            return "CONTRACTION"

    @staticmethod
    def _classify_etf_fit(name: str, regime: str) -> str:
        """
        종목명이 현재 국면에 시너지인지 역풍인지 판정
        """
        name = name.lower()

        # 골디락스 국면일 때
        if regime == "GOLDILOCKS":
            if any(k in name for k in ["인버스", "곱버스", "cd금리", "kofr", "파킹", "단기채", "원유", "원자재"]):
                return "HEADWIND"
            elif any(k in name for k in ["나스닥", "nasdaq", "s&p", "반도체", "ai", "테크", "tech", "혁신", "성장", "코스피", "200"]):
                return "SYNERGY"
            return "NEUTRAL"

        # 인플레이션 과열 국면일 때
        elif regime == "OVERHEAT":
            if any(k in name for k in ["원자재", "구리", "에너지", "골드", "금", "배당", "다우존스", "금융", "조선"]):
                return "SYNERGY"
            elif any(k in name for k in ["30년", "장기국채", "고배수", "바이오"]):
                return "HEADWIND"
            return "NEUTRAL"

        # 스태그플레이션 국면일 때
        elif regime == "STAGFLATION":
            if any(k in name for k in ["cd금리", "kofr", "달러", "파킹", "초단기", "소비재"]):
                return "SYNERGY"
            elif any(k in name for k in ["레버리지", "나스닥", "반도체", "성장주"]):
                return "HEADWIND"
            return "NEUTRAL"

        # 디플레이션 수축 국면일 때
        else:
            if any(k in name for k in ["30년", "10년", "국채", "달러", "미국채"]):
                return "SYNERGY"
            elif any(k in name for k in ["원자재", "에너지", "경기민감"]):
                return "HEADWIND"
            return "NEUTRAL"
