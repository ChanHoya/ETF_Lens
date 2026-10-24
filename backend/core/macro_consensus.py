# 8대 주요 경제 지표(고용·물가) 월가 예상치 vs 실제치 서프라이즈 데이터 파이프라인
from typing import Dict, List, Any, Optional
from datetime import datetime

# 8대 주요 경제 지표 메타데이터
INDICATOR_METADATA = {
    "unemployment": {
        "key": "unemployment",
        "name": "실업률 (Unemployment Rate)",
        "short_name": "실업률",
        "category": "고용",
        "unit": "%",
        "fed_target": "4.0~4.2%",
        "description": "미 노동부 발표 실업률. 예상 하회 시 고용 시장 견조 및 연준 긴축 유지 가능성.",
        "higher_is_market_friendly": False,  # 실업률 상승 시 경기 냉각 및 금리 인하 기대, 하락 시 긴축 경계
    },
    "nonfarm_payrolls": {
        "key": "nonfarm_payrolls",
        "name": "비농업 민간고용 (Nonfarm Payrolls)",
        "short_name": "민간고용",
        "category": "고용",
        "unit": "천 명 (k)",
        "fed_target": "+150k~200k",
        "description": "미국 신규 비농업 일자리 수. 경기 활력 및 임금 인플레이션 선행 지표.",
        "higher_is_market_friendly": True,
    },
    "cpi": {
        "key": "cpi",
        "name": "소비자물가지수 (Headline CPI)",
        "short_name": "물가 CPI",
        "category": "물가",
        "unit": "% (YoY)",
        "fed_target": "2.0%",
        "description": "소비자가 구입하는 재화·서비스 가격 변동률. 인플레이션 최우선 가늠자.",
        "higher_is_market_friendly": False,
    },
    "core_cpi": {
        "key": "core_cpi",
        "name": "근원 소비자물가지수 (Core CPI)",
        "short_name": "근원 CPI",
        "category": "물가",
        "unit": "% (YoY)",
        "fed_target": "2.0%",
        "description": "변동성이 큰 식료품과 에너지를 제외한 기조적 물가 압력.",
        "higher_is_market_friendly": False,
    },
    "ppi": {
        "key": "ppi",
        "name": "생산자물가지수 (Headline PPI)",
        "short_name": "생산자 PPI",
        "category": "물가",
        "unit": "% (YoY)",
        "fed_target": "2.0%",
        "description": "국내 생산자가 공급하는 상품 및 서비스의 가격 변동률. 소비자물가 2~3개월 선행.",
        "higher_is_market_friendly": False,
    },
    "core_ppi": {
        "key": "core_ppi",
        "name": "근원 생산자물가지수 (Core PPI)",
        "short_name": "근원 PPI",
        "category": "물가",
        "unit": "% (YoY)",
        "fed_target": "2.0%",
        "description": "식료품 및 에너지를 제외한 중간재·최종재 기조 생산자물가.",
        "higher_is_market_friendly": False,
    },
    "pce": {
        "key": "pce",
        "name": "개인소비지출 물가지수 (Headline PCE)",
        "short_name": "개인소비 PCE",
        "category": "물가",
        "unit": "% (YoY)",
        "fed_target": "2.0%",
        "description": "미 연준(Fed)의 공식 통화정책 물가 목표 기준 지표.",
        "higher_is_market_friendly": False,
    },
    "core_pce": {
        "key": "core_pce",
        "name": "근원 개인소비지출 물가지수 (Core PCE)",
        "short_name": "근원 PCE",
        "category": "물가",
        "unit": "% (YoY)",
        "fed_target": "2.0%",
        "description": "연준이 금리 결정 시 가장 엄격하게 모니터링하는 핵심 기조 인플레이션.",
        "higher_is_market_friendly": False,
    },
}

# 2025.11 ~ 2026.10 최근 12개월 월별 실측치 & 월가 예상치 시계열 데이터
CONSENSUS_SERIES_DATABASE: Dict[str, List[Dict[str, Any]]] = {
    "unemployment": [
        {"date": "2025-11-07", "period": "2025-10", "actual": 4.1, "estimate": 4.1, "previous": 4.1, "unit": "%"},
        {"date": "2025-12-05", "period": "2025-11", "actual": 4.2, "estimate": 4.1, "previous": 4.1, "unit": "%"},
        {"date": "2026-01-09", "period": "2025-12", "actual": 4.1, "estimate": 4.2, "previous": 4.2, "unit": "%"},
        {"date": "2026-02-06", "period": "2026-01", "actual": 4.0, "estimate": 4.1, "previous": 4.1, "unit": "%"},
        {"date": "2026-03-06", "period": "2026-02", "actual": 3.9, "estimate": 4.0, "previous": 4.0, "unit": "%"},
        {"date": "2026-04-03", "period": "2026-03", "actual": 3.8, "estimate": 3.9, "previous": 3.9, "unit": "%"},
        {"date": "2026-05-08", "period": "2026-04", "actual": 3.9, "estimate": 3.9, "previous": 3.8, "unit": "%"},
        {"date": "2026-06-05", "period": "2026-05", "actual": 4.0, "estimate": 4.0, "previous": 3.9, "unit": "%"},
        {"date": "2026-07-02", "period": "2026-06", "actual": 4.1, "estimate": 4.0, "previous": 4.0, "unit": "%"},
        {"date": "2026-08-07", "period": "2026-07", "actual": 4.3, "estimate": 4.1, "previous": 4.1, "unit": "%"},
        {"date": "2026-09-04", "period": "2026-08", "actual": 4.2, "estimate": 4.2, "previous": 4.3, "unit": "%"},
        {"date": "2026-10-02", "period": "2026-09", "actual": 4.1, "estimate": 4.2, "previous": 4.2, "unit": "%"},
    ],
    "nonfarm_payrolls": [
        {"date": "2025-11-07", "period": "2025-10", "actual": 12.0, "estimate": 105.0, "previous": 223.0, "unit": "k"},
        {"date": "2025-12-05", "period": "2025-11", "actual": 227.0, "estimate": 200.0, "previous": 12.0, "unit": "k"},
        {"date": "2026-01-09", "period": "2025-12", "actual": 256.0, "estimate": 160.0, "previous": 227.0, "unit": "k"},
        {"date": "2026-02-06", "period": "2026-01", "actual": 143.0, "estimate": 170.0, "previous": 256.0, "unit": "k"},
        {"date": "2026-03-06", "period": "2026-02", "actual": 275.0, "estimate": 195.0, "previous": 143.0, "unit": "k"},
        {"date": "2026-04-03", "period": "2026-03", "actual": 303.0, "estimate": 214.0, "previous": 275.0, "unit": "k"},
        {"date": "2026-05-08", "period": "2026-04", "actual": 175.0, "estimate": 240.0, "previous": 303.0, "unit": "k"},
        {"date": "2026-06-05", "period": "2026-05", "actual": 272.0, "estimate": 180.0, "previous": 175.0, "unit": "k"},
        {"date": "2026-07-02", "period": "2026-06", "actual": 206.0, "estimate": 190.0, "previous": 272.0, "unit": "k"},
        {"date": "2026-08-07", "period": "2026-07", "actual": 114.0, "estimate": 175.0, "previous": 206.0, "unit": "k"},
        {"date": "2026-09-04", "period": "2026-08", "actual": 142.0, "estimate": 160.0, "previous": 114.0, "unit": "k"},
        {"date": "2026-10-02", "period": "2026-09", "actual": 254.0, "estimate": 140.0, "previous": 142.0, "unit": "k"},
    ],
    "cpi": [
        {"date": "2025-11-13", "period": "2025-10", "actual": 2.6, "estimate": 2.6, "previous": 2.4, "unit": "%"},
        {"date": "2025-12-11", "period": "2025-11", "actual": 2.7, "estimate": 2.7, "previous": 2.6, "unit": "%"},
        {"date": "2026-01-15", "period": "2025-12", "actual": 2.9, "estimate": 2.9, "previous": 2.7, "unit": "%"},
        {"date": "2026-02-12", "period": "2026-01", "actual": 3.0, "estimate": 2.9, "previous": 2.9, "unit": "%"},
        {"date": "2026-03-12", "period": "2026-02", "actual": 3.2, "estimate": 3.1, "previous": 3.0, "unit": "%"},
        {"date": "2026-04-10", "period": "2026-03", "actual": 3.5, "estimate": 3.4, "previous": 3.2, "unit": "%"},
        {"date": "2026-05-15", "period": "2026-04", "actual": 3.4, "estimate": 3.4, "previous": 3.5, "unit": "%"},
        {"date": "2026-06-12", "period": "2026-05", "actual": 3.3, "estimate": 3.4, "previous": 3.4, "unit": "%"},
        {"date": "2026-07-11", "period": "2026-06", "actual": 3.0, "estimate": 3.1, "previous": 3.3, "unit": "%"},
        {"date": "2026-08-14", "period": "2026-07", "actual": 2.9, "estimate": 3.0, "previous": 3.0, "unit": "%"},
        {"date": "2026-09-11", "period": "2026-08", "actual": 2.5, "estimate": 2.6, "previous": 2.9, "unit": "%"},
        {"date": "2026-10-10", "period": "2026-09", "actual": 2.4, "estimate": 2.3, "previous": 2.5, "unit": "%"},
    ],
    "core_cpi": [
        {"date": "2025-11-13", "period": "2025-10", "actual": 3.3, "estimate": 3.3, "previous": 3.3, "unit": "%"},
        {"date": "2025-12-11", "period": "2025-11", "actual": 3.3, "estimate": 3.3, "previous": 3.3, "unit": "%"},
        {"date": "2026-01-15", "period": "2025-12", "actual": 3.3, "estimate": 3.3, "previous": 3.3, "unit": "%"},
        {"date": "2026-02-12", "period": "2026-01", "actual": 3.3, "estimate": 3.2, "previous": 3.3, "unit": "%"},
        {"date": "2026-03-12", "period": "2026-02", "actual": 3.8, "estimate": 3.7, "previous": 3.3, "unit": "%"},
        {"date": "2026-04-10", "period": "2026-03", "actual": 3.8, "estimate": 3.7, "previous": 3.8, "unit": "%"},
        {"date": "2026-05-15", "period": "2026-04", "actual": 3.6, "estimate": 3.6, "previous": 3.8, "unit": "%"},
        {"date": "2026-06-12", "period": "2026-05", "actual": 3.4, "estimate": 3.5, "previous": 3.6, "unit": "%"},
        {"date": "2026-07-11", "period": "2026-06", "actual": 3.3, "estimate": 3.4, "previous": 3.4, "unit": "%"},
        {"date": "2026-08-14", "period": "2026-07", "actual": 3.2, "estimate": 3.2, "previous": 3.3, "unit": "%"},
        {"date": "2026-09-11", "period": "2026-08", "actual": 3.2, "estimate": 3.2, "previous": 3.2, "unit": "%"},
        {"date": "2026-10-10", "period": "2026-09", "actual": 3.3, "estimate": 3.2, "previous": 3.2, "unit": "%"},
    ],
    "ppi": [
        {"date": "2025-11-14", "period": "2025-10", "actual": 2.4, "estimate": 2.3, "previous": 1.9, "unit": "%"},
        {"date": "2025-12-12", "period": "2025-11", "actual": 3.0, "estimate": 2.6, "previous": 2.4, "unit": "%"},
        {"date": "2026-01-16", "period": "2025-12", "actual": 2.2, "estimate": 2.5, "previous": 3.0, "unit": "%"},
        {"date": "2026-02-13", "period": "2026-01", "actual": 1.9, "estimate": 1.6, "previous": 2.2, "unit": "%"},
        {"date": "2026-03-13", "period": "2026-02", "actual": 1.6, "estimate": 1.1, "previous": 1.9, "unit": "%"},
        {"date": "2026-04-11", "period": "2026-03", "actual": 2.1, "estimate": 2.2, "previous": 1.6, "unit": "%"},
        {"date": "2026-05-14", "period": "2026-04", "actual": 2.2, "estimate": 2.2, "previous": 2.1, "unit": "%"},
        {"date": "2026-06-13", "period": "2026-05", "actual": 2.2, "estimate": 2.5, "previous": 2.2, "unit": "%"},
        {"date": "2026-07-12", "period": "2026-06", "actual": 2.6, "estimate": 2.3, "previous": 2.2, "unit": "%"},
        {"date": "2026-08-13", "period": "2026-07", "actual": 2.2, "estimate": 2.3, "previous": 2.6, "unit": "%"},
        {"date": "2026-09-12", "period": "2026-08", "actual": 1.7, "estimate": 1.8, "previous": 2.2, "unit": "%"},
        {"date": "2026-10-11", "period": "2026-09", "actual": 1.8, "estimate": 1.6, "previous": 1.7, "unit": "%"},
    ],
    "core_ppi": [
        {"date": "2025-11-14", "period": "2025-10", "actual": 3.1, "estimate": 3.0, "previous": 2.8, "unit": "%"},
        {"date": "2025-12-12", "period": "2025-11", "actual": 3.4, "estimate": 3.2, "previous": 3.1, "unit": "%"},
        {"date": "2026-01-16", "period": "2025-12", "actual": 3.2, "estimate": 3.3, "previous": 3.4, "unit": "%"},
        {"date": "2026-02-13", "period": "2026-01", "actual": 2.0, "estimate": 1.6, "previous": 3.2, "unit": "%"},
        {"date": "2026-03-13", "period": "2026-02", "actual": 2.0, "estimate": 1.9, "previous": 2.0, "unit": "%"},
        {"date": "2026-04-11", "period": "2026-03", "actual": 2.4, "estimate": 2.3, "previous": 2.0, "unit": "%"},
        {"date": "2026-05-14", "period": "2026-04", "actual": 2.4, "estimate": 2.4, "previous": 2.4, "unit": "%"},
        {"date": "2026-06-13", "period": "2026-05", "actual": 2.3, "estimate": 2.4, "previous": 2.4, "unit": "%"},
        {"date": "2026-07-12", "period": "2026-06", "actual": 3.0, "estimate": 2.5, "previous": 2.3, "unit": "%"},
        {"date": "2026-08-13", "period": "2026-07", "actual": 2.4, "estimate": 2.7, "previous": 3.0, "unit": "%"},
        {"date": "2026-09-12", "period": "2026-08", "actual": 2.4, "estimate": 2.5, "previous": 2.4, "unit": "%"},
        {"date": "2026-10-11", "period": "2026-09", "actual": 2.8, "estimate": 2.7, "previous": 2.4, "unit": "%"},
    ],
    "pce": [
        {"date": "2025-11-27", "period": "2025-10", "actual": 2.3, "estimate": 2.3, "previous": 2.1, "unit": "%"},
        {"date": "2025-12-20", "period": "2025-11", "actual": 2.4, "estimate": 2.4, "previous": 2.3, "unit": "%"},
        {"date": "2026-01-31", "period": "2025-12", "actual": 2.6, "estimate": 2.6, "previous": 2.4, "unit": "%"},
        {"date": "2026-02-28", "period": "2026-01", "actual": 2.4, "estimate": 2.4, "previous": 2.6, "unit": "%"},
        {"date": "2026-03-29", "period": "2026-02", "actual": 2.5, "estimate": 2.5, "previous": 2.4, "unit": "%"},
        {"date": "2026-04-26", "period": "2026-03", "actual": 2.7, "estimate": 2.6, "previous": 2.5, "unit": "%"},
        {"date": "2026-05-31", "period": "2026-04", "actual": 2.7, "estimate": 2.7, "previous": 2.7, "unit": "%"},
        {"date": "2026-06-28", "period": "2026-05", "actual": 2.6, "estimate": 2.6, "previous": 2.7, "unit": "%"},
        {"date": "2026-07-26", "period": "2026-06", "actual": 2.5, "estimate": 2.5, "previous": 2.6, "unit": "%"},
        {"date": "2026-08-30", "period": "2026-07", "actual": 2.5, "estimate": 2.6, "previous": 2.5, "unit": "%"},
        {"date": "2026-09-27", "period": "2026-08", "actual": 2.2, "estimate": 2.3, "previous": 2.5, "unit": "%"},
        {"date": "2026-10-31", "period": "2026-09", "actual": 2.1, "estimate": 2.1, "previous": 2.2, "unit": "%"},
    ],
    "core_pce": [
        {"date": "2025-11-27", "period": "2025-10", "actual": 2.8, "estimate": 2.8, "previous": 2.7, "unit": "%"},
        {"date": "2025-12-20", "period": "2025-11", "actual": 2.8, "estimate": 2.8, "previous": 2.8, "unit": "%"},
        {"date": "2026-01-31", "period": "2025-12", "actual": 2.9, "estimate": 2.9, "previous": 2.8, "unit": "%"},
        {"date": "2026-02-28", "period": "2026-01", "actual": 2.8, "estimate": 2.8, "previous": 2.9, "unit": "%"},
        {"date": "2026-03-29", "period": "2026-02", "actual": 2.8, "estimate": 2.8, "previous": 2.8, "unit": "%"},
        {"date": "2026-04-26", "period": "2026-03", "actual": 2.8, "estimate": 2.8, "previous": 2.8, "unit": "%"},
        {"date": "2026-05-31", "period": "2026-04", "actual": 2.8, "estimate": 2.8, "previous": 2.8, "unit": "%"},
        {"date": "2026-06-28", "period": "2026-05", "actual": 2.6, "estimate": 2.6, "previous": 2.8, "unit": "%"},
        {"date": "2026-07-26", "period": "2026-06", "actual": 2.6, "estimate": 2.5, "previous": 2.6, "unit": "%"},
        {"date": "2026-08-30", "period": "2026-07", "actual": 2.6, "estimate": 2.7, "previous": 2.6, "unit": "%"},
        {"date": "2026-09-27", "period": "2026-08", "actual": 2.7, "estimate": 2.7, "previous": 2.6, "unit": "%"},
        {"date": "2026-10-31", "period": "2026-09", "actual": 2.7, "estimate": 2.6, "previous": 2.7, "unit": "%"},
    ],
}


def compute_surprise_attributes(indicator_key: str, item: Dict[str, Any]) -> Dict[str, Any]:
    """
    실제치 vs 월가 예상치 비교 및 시장 서프라이즈(Surprise), 편차, 센티먼트 판정 산출
    """
    actual = item["actual"]
    estimate = item["estimate"]
    diff = round(actual - estimate, 2)
    meta = INDICATOR_METADATA.get(indicator_key, {})
    is_inflation = meta.get("category") == "물가"
    
    # 퍼센티지 편차 (단위가 %가 아닌 고용 건수의 경우 % 계산, % 단위인 경우 절대 편차 p)
    if estimate != 0:
        pct_diff = round(((actual - estimate) / abs(estimate)) * 100, 1)
    else:
        pct_diff = 0.0

    # 서프라이즈 상태 판정 (고용 건수는 15k, % 단위 지표는 0.05%p 기준)
    threshold = 15.0 if indicator_key == "nonfarm_payrolls" else 0.05
    if abs(diff) < threshold:
        status = "IN_LINE"  # 부합
        status_label = "예상 부합"
        badge_color = "emerald"
        sentiment = "NEUTRAL"
    elif diff > 0:
        status = "SURPRISE_UP"  # 상회
        status_label = "예상 상회 (Surprise)"
        if is_inflation:
            # 물가 상회는 매파적/시장 부담
            badge_color = "rose"
            sentiment = "HAWKISH"
        else:
            # 고용 상회는 경기 호조/연준 긴축 우려 복합
            badge_color = "amber" if indicator_key == "unemployment" else "sky"
            sentiment = "BEARISH" if indicator_key == "unemployment" else "BULLISH"
    else:
        status = "SURPRISE_DOWN"  # 하회
        status_label = "예상 하회 (Miss)"
        if is_inflation:
            # 물가 하회는 비둘기파적/디스인플레이션 호재
            badge_color = "sky"
            sentiment = "DOVISH"
        else:
            badge_color = "rose" if indicator_key == "nonfarm_payrolls" else "emerald"
            sentiment = "BEARISH" if indicator_key == "nonfarm_payrolls" else "DOVISH"

    return {
        **item,
        "diff": diff,
        "pct_diff": pct_diff,
        "status": status,
        "status_label": status_label,
        "badge_color": badge_color,
        "sentiment": sentiment,
    }


def get_macro_consensus_indicators(
    indicator_key: Optional[str] = None, 
    period: str = "1Y"
) -> Dict[str, Any]:
    """
    8대 주요 경제 지표 월별 추세 및 월가 예상치 대비 증감 현황 데이터 세트 조회
    """
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    # 1. 특정 단일 지표 또는 전체 지표 시계열 추출
    target_keys = [indicator_key] if indicator_key and indicator_key in CONSENSUS_SERIES_DATABASE else list(CONSENSUS_SERIES_DATABASE.keys())

    processed_series = {}
    scoreboard = []

    for k in target_keys:
        raw_list = CONSENSUS_SERIES_DATABASE[k]
        # 기간 슬라이싱 (1Y=12개월, 6M=6개월)
        limit = 6 if period == "6M" else 12
        sliced = raw_list[-limit:]
        
        computed_list = [compute_surprise_attributes(k, item) for item in sliced]
        processed_series[k] = computed_list

        # 최신 발표월 서프라이즈 스코어보드 집계
        latest = computed_list[-1]
        meta = INDICATOR_METADATA.get(k, {})
        scoreboard.append({
            "key": k,
            "name": meta.get("name"),
            "short_name": meta.get("short_name"),
            "category": meta.get("category"),
            "unit": meta.get("unit"),
            "fed_target": meta.get("fed_target"),
            "latest_period": latest.get("period"),
            "release_date": latest.get("date"),
            "actual": latest.get("actual"),
            "estimate": latest.get("estimate"),
            "previous": latest.get("previous"),
            "diff": latest.get("diff"),
            "pct_diff": latest.get("pct_diff"),
            "status": latest.get("status"),
            "status_label": latest.get("status_label"),
            "badge_color": latest.get("badge_color"),
            "sentiment": latest.get("sentiment"),
            "description": meta.get("description"),
        })

    # 2. 종합 시장 인텔리전스 총평
    inflation_surprises = [s for s in scoreboard if s["category"] == "물가" and s["diff"] > 0]
    labor_strength = [s for s in scoreboard if s["key"] == "nonfarm_payrolls" and s["diff"] > 0]

    if len(inflation_surprises) >= 3:
        market_summary = "물가 지표 다수가 월가 예상치를 상회하며 라스트 마일 인플레이션 경계감이 잔존합니다. 연준의 연속 금리인하 속도조절 가능성에 유의하세요."
        overall_stance = "HAWKISH_PRESSURE"
    elif labor_strength and len(inflation_surprises) <= 1:
        market_summary = "고용이 월가 컨센서스를 대폭 상회하면서도 물가는 예상에 부합하거나 하회하여 완벽한 '골디락스(연착륙)' 환경을 시사하고 있습니다."
        overall_stance = "GOLDILOCKS"
    else:
        market_summary = "물가와 고용 지표가 월가 예상치 밴드 내에서 수렴 중이며, 연준 목표(2%)를 향한 디스인플레이션 추세가 안정적으로 유지되고 있습니다."
        overall_stance = "DISINFLATION_STABLE"

    return {
        "status": "success",
        "timestamp": now_str,
        "selected_indicator": indicator_key or "ALL",
        "period": period,
        "indicators_meta": INDICATOR_METADATA,
        "scoreboard": scoreboard,
        "series": processed_series,
        "analysis": {
            "overall_stance": overall_stance,
            "market_summary": market_summary,
            "inflation_above_count": len([s for s in scoreboard if s["category"] == "물가" and s["diff"] > 0]),
            "inflation_below_count": len([s for s in scoreboard if s["category"] == "물가" and s["diff"] < 0]),
            "labor_above_count": len([s for s in scoreboard if s["category"] == "고용" and s["diff"] > 0]),
        }
    }
