# 한국 6대 수출 주력 산업군 기반 포트폴리오 실질 노출도 및 경기 적합도 분석 엔진
import logging
import re
from typing import Dict, List, Any, Optional

logger = logging.getLogger(__name__)

# 6대 수출 주력 산업군 메타데이터 정의
EXPORT_INDUSTRIES_META = [
    {
        "id": "semiconductor",
        "name": "반도체·IT",
        "color": "#3b82f6",
        "desc": "메모리, 시스템반도체, 컴퓨터, 디스플레이",
        "keywords": ["반도체", "하이닉스", "삼성전자", "파운드리", "소부장", "IT", "HBM", "테크", "AI반도체"]
    },
    {
        "id": "auto",
        "name": "자동차·운송",
        "color": "#6366f1",
        "desc": "완성차, 자동차 부품, 조선·선박",
        "keywords": ["자동차", "현대차", "기아", "모비스", "완성차", "조선", "중공업", "한화오션", "선박", "운송장비"]
    },
    {
        "id": "petrochem",
        "name": "석유화학·정유",
        "color": "#10b981",
        "desc": "석유제품, 석유화학, 화장품",
        "keywords": ["에너지화학", "화학", "정유", "석유", "정제", "화장품", "뷰티", "정밀화학"]
    },
    {
        "id": "machinery",
        "name": "일반기계·방산",
        "color": "#f59e0b",
        "desc": "공작기계, 전력기기, 방위산업",
        "keywords": ["기계", "방산", "K방산", "방위산업", "원자력", "전력", "변압기", "전선", "중전기"]
    },
    {
        "id": "steel",
        "name": "철강·금속",
        "color": "#ec4899",
        "desc": "열연, 냉연, 강관, 비철금속",
        "keywords": ["철강", "금속", "포스코", "POSCO", "고려아연", "건설", "비철"]
    },
    {
        "id": "bio_battery",
        "name": "바이오·배터리",
        "color": "#8b5cf6",
        "desc": "의약품, 바이오시밀러, 2차전지",
        "keywords": ["바이오", "헬스케어", "제약", "2차전지", "배터리", "양극재", "에코프로", "LG엔솔", "삼성바이오"]
    }
]


def decompose_etf_export_exposure(code: str, name: str) -> Dict[str, float]:
    """단일 ETF 종목의 6대 수출 산업군 및 내수/해외 가중치(합계 1.0)를 분해 추정합니다."""
    clean_name = name.strip()
    upper_name = clean_name.upper()

    # 1. 코스피 200 / 대표 시장지수형 ETF (국내 대형 수출주 복합 포트폴리오)
    if re.search(r'(200|KOSPI200|코스피200|KRX300|코스피 200)', clean_name):
        return {
            "semiconductor": 0.35,
            "auto": 0.12,
            "bio_battery": 0.10,
            "petrochem": 0.05,
            "machinery": 0.04,
            "steel": 0.04,
            "domestic_other": 0.30
        }

    # 2. 미국 및 해외 지수형/해외 직접투자 자산
    is_overseas = bool(re.search(r'(미국|나스닥|S&P|글로벌|차이나|인도|일본|유로|SOX|필라델피아)', clean_name)) or bool(re.match(r'^[A-Za-z]+$', code))
    if is_overseas:
        # 미국/글로벌 테크/반도체 ETF인 경우 글로벌 반도체 동조 노출 인정
        if re.search(r'(반도체|SEMICON|SOX|빅테크|테크TOP|AI)', upper_name):
            return {
                "semiconductor": 0.70,
                "auto": 0.0,
                "petrochem": 0.0,
                "machinery": 0.0,
                "steel": 0.0,
                "bio_battery": 0.0,
                "domestic_other": 0.30  # 해외 통화/글로벌 익스포저
            }
        return {
            "semiconductor": 0.0,
            "auto": 0.0,
            "petrochem": 0.0,
            "machinery": 0.0,
            "steel": 0.0,
            "bio_battery": 0.0,
            "domestic_other": 1.0
        }

    # 3. 채권, 금리, 파킹, 단기채, 머니마켓, 리츠, 배당/내수
    if re.search(r'(채권|국채|KOFR|SOFR|CD금리|머니마켓|단기채|리츠|금융|은행|통신|보험|골드|금현물)', clean_name):
        return {
            "semiconductor": 0.0,
            "auto": 0.0,
            "petrochem": 0.0,
            "machinery": 0.0,
            "steel": 0.0,
            "bio_battery": 0.0,
            "domestic_other": 1.0
        }

    # 4. 6대 주력 산업군 키워드 매칭
    matched_industry = None
    for meta in EXPORT_INDUSTRIES_META:
        pattern = "|".join(meta["keywords"])
        if re.search(pattern, clean_name, re.IGNORECASE):
            matched_industry = meta["id"]
            break

    if matched_industry:
        res = {m["id"]: 0.0 for m in EXPORT_INDUSTRIES_META}
        res["domestic_other"] = 0.05  # 소액 추적오차/현금
        res[matched_industry] = 0.95
        return res

    # 5. 미분류 종목: 내수/기타 100%
    return {
        "semiconductor": 0.0,
        "auto": 0.0,
        "petrochem": 0.0,
        "machinery": 0.0,
        "steel": 0.0,
        "bio_battery": 0.0,
        "domestic_other": 1.0
    }


def analyze_portfolio_export_exposure(
    holdings: List[Dict[str, Any]],
    top_industry_id: str = "semiconductor",
    top_industry_share: float = 33.5,
    cycle_phase: str = "둔화 국면(Slowdown)"
) -> Dict[str, Any]:
    """포트폴리오의 6대 수출 주력 산업군 실질 노출도, 1위 수출 주력군 편입 비중, 경기 국면 적합도 점수를 산출합니다."""
    if not holdings:
        return {
            "total_eval_amt": 0,
            "industry_exposures": [],
            "top_industry_id": top_industry_id,
            "top_industry_share": top_industry_share,
            "top_industry_exposure": 0.0,
            "total_export_exposure": 0.0,
            "domestic_other_exposure": 100.0,
            "fit_score": 50,
            "status_level": "NEUTRAL",
            "status_title": "분석 대상 자산 없음",
            "comment": "포트폴리오에 등록된 보유 종목이 없습니다."
        }

    # 1. 포트폴리오 가중치 정규화
    total_eval = 0.0
    normalized_holdings = []

    for h in holdings:
        # 평가액 우선, 없으면 비중(weight) 또는 수량*현재가 활용
        eval_amt = float(h.get("eval_amt") or h.get("eval_amount") or h.get("endValue") or h.get("evaluation") or 0.0)
        if eval_amt <= 0:
            shares = float(h.get("shares") or h.get("qty") or 0.0)
            price = float(h.get("current_price") or h.get("price") or 0.0)
            eval_amt = shares * price if shares > 0 and price > 0 else float(h.get("weight") or 0.0)
        
        if eval_amt <= 0:
            eval_amt = 1.0  # 기본 최소 가중치 방어

        code = str(h.get("code") or h.get("ticker") or "")
        name = str(h.get("name") or "")
        total_eval += eval_amt
        normalized_holdings.append({
            "code": code,
            "name": name,
            "eval_amt": eval_amt
        })

    if total_eval <= 0:
        total_eval = 1.0

    # 2. 업종별 익스포저 집계
    industry_amounts = {meta["id"]: 0.0 for meta in EXPORT_INDUSTRIES_META}
    industry_amounts["domestic_other"] = 0.0

    for item in normalized_holdings:
        decomp = decompose_etf_export_exposure(item["code"], item["name"])
        for ind_id, ratio in decomp.items():
            industry_amounts[ind_id] = industry_amounts.get(ind_id, 0.0) + (item["eval_amt"] * ratio)

    # 3. 비중(%) 산출
    industry_weights = {}
    for ind_id, amt in industry_amounts.items():
        industry_weights[ind_id] = round((amt / total_eval) * 100.0, 1)

    # 6대 주력군 총 수출 노출도 (내수/기타 제외)
    total_export_exposure = round(sum(industry_weights[m["id"]] for m in EXPORT_INDUSTRIES_META), 1)
    domestic_other_exposure = round(industry_weights.get("domestic_other", 0.0), 1)

    # 4. 메타데이터와 결합된 리스트 생성
    industry_exposures = []
    for meta in EXPORT_INDUSTRIES_META:
        ind_id = meta["id"]
        w = industry_weights.get(ind_id, 0.0)
        amt = industry_amounts.get(ind_id, 0.0)
        industry_exposures.append({
            "id": ind_id,
            "name": meta["name"],
            "color": meta["color"],
            "desc": meta["desc"],
            "weight": w,
            "eval_amt": int(round(amt)),
            "is_top_industry": (ind_id == top_industry_id)
        })

    # 비중 기준 내림차순 정렬
    industry_exposures.sort(key=lambda x: x["weight"], reverse=True)

    # 5. 수출 1위 주력군 편입 상태 및 적합도 점수(Fit Score) 산출
    top_ind_exposure = industry_weights.get(top_industry_id, 0.0)

    # 기본 적합도 계산: 1위 주력군 비중과 총 수출 노출도를 고려
    # 이상적 1위 주력군 편입 비중: 15% ~ 35%
    fit_score = 70
    if 15.0 <= top_ind_exposure <= 40.0:
        fit_score += 15
    elif top_ind_exposure > 40.0:
        fit_score += 5  # 편중 위험으로 가산폭 제한
    elif top_ind_exposure < 8.0:
        fit_score -= 20  # 주력군 소외

    # 경기 국면 가중치 반영
    if "확장" in cycle_phase or "Expansion" in cycle_phase:
        if total_export_exposure >= 40.0:
            fit_score += 10
    elif "둔화" in cycle_phase or "Slowdown" in cycle_phase:
        # 둔화기에는 과도한 경기민감 수출주(>60%)보다 20~40%선이 안정적
        if total_export_exposure > 65.0:
            fit_score -= 10
        elif 25.0 <= total_export_exposure <= 50.0:
            fit_score += 10
    elif "회복" in cycle_phase or "Recovery" in cycle_phase:
        if total_export_exposure >= 30.0:
            fit_score += 10

    fit_score = max(10, min(98, fit_score))

    # 상태 등급 판정
    if top_ind_exposure >= 25.0:
        status_level = "HIGH"
        status_title = "수출 1위 주력군 강력 수혜"
        comment = (
            f"현재 국가 수출 점유율 1위인 {top_industry_id} 섹터에 포트폴리오의 {top_ind_exposure:.1f}%가 "
            f"효과적으로 편입되어 강력한 실적 모멘텀을 향유하고 있습니다."
        )
    elif top_ind_exposure >= 10.0:
        status_level = "BALANCED"
        status_title = "수출 주력군 균형 배분"
        comment = (
            f"수출 1위 주력군에 {top_ind_exposure:.1f}%가 적정 배분되어 있으며, "
            f"전체 수출 산업군 노출도({total_export_exposure:.1f}%)와의 밸런스가 안정적입니다."
        )
    else:
        status_level = "UNDERWEIGHT"
        status_title = "수출 모멘텀 소외/언더웨이트"
        comment = (
            f"국가 1위 수출 주력군 편입 비중이 {top_ind_exposure:.1f}%로 낮아 "
            f"주요 대형주 수출 반등기 실적 수혜에서 다소 소외될 수 있습니다."
        )

    matched_top_meta = next((m for m in EXPORT_INDUSTRIES_META if m["id"] == top_industry_id), EXPORT_INDUSTRIES_META[0])

    return {
        "total_eval_amt": int(round(total_eval)),
        "industry_exposures": industry_exposures,
        "top_industry_id": top_industry_id,
        "top_industry_name": matched_top_meta["name"],
        "top_industry_share": top_industry_share,
        "top_industry_exposure": top_ind_exposure,
        "total_export_exposure": total_export_exposure,
        "domestic_other_exposure": domestic_other_exposure,
        "fit_score": fit_score,
        "status_level": status_level,
        "status_title": status_title,
        "cycle_phase": cycle_phase,
        "comment": comment
    }
