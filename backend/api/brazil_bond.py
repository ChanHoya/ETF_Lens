# 브라질 국채 대시보드·Activation Zone 신호·AI 전략 리포트를 제공하는 API 라우터
"""
플레이북(docs/brazil-bond-playbook.md)의 규칙을 코드화한다.
- 신호 엔진: 2축 Activation Zone (5년물 국채금리 × 원/헤알 환율).
- 스코어보드: Selic·5Y·BRL/KRW·IPCA 현재값 + 신호등.
- 캐리 쿠션: 만기 환율별 원화 누적수익 곡선(시뮬레이터 기준).
- 캘린더: Copom(8/4~5)·대선(10/4)·금통위(7/16) D-day.
- AI 리포트: Gemini 로 라이브 지표 + 플레이북 그라운딩 생성, SectorInsight(sector='brazil_bond')에 캐시.
"""

import asyncio
import json
import os
import re
from datetime import datetime, date, timezone, timedelta

from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException, Depends, Header
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import get_db
from db.models import BrazilSeries, SectorInsight

_current_dir = os.path.dirname(os.path.abspath(__file__))
load_dotenv(dotenv_path=os.path.join(_current_dir, "..", ".env"), override=True)

router = APIRouter()
_KST = timezone(timedelta(hours=9))

# ── 플레이북 임계값 (Activation Zone) ────────────────────────────────────────
RATE_FLOOR = 14.2      # 최적 진입 하한 (이 아래는 매력 저하)
RATE_TRANCHE2 = 14.7   # 최적 상한 = 천장 접근 경계 (14.7~15.0는 고캐리이나 위기선 근접→주의)
RATE_RISK = 15.0       # 초과 시 리스크 재평가(위기 신호)
RATE_CARRY_MIN = 13.0  # 이 아래는 캐리 부족(실질금리 매력 상실)→부적합
FX_TARGET = 290.0      # 환율 조건 (290원↓)

# ── 하반기 매크로 캘린더 (2026, 고정 일정) ───────────────────────────────────
CATALYSTS = [
    {"date": "2026-07-16", "key": "bok", "title": "한국은행 금통위",
     "note": "인상 기대감 → 원화 강세 모멘텀 → 원/헤알 290원 하회 트리거", "impact": "fx",
     "actual": "기준금리 0.25%p 인상 → 연 2.75% 결정. 12개월 이어진 동결을 끝낸 긴축 전환으로, 신현송 총재 주재 회의에서 금통위원 7명 전원이 참석해 결정.",
     "outlook": "한은 긴축 전환은 원화 강세 압력으로 작용해 원/헤알 290원 하회 트리거에 우호적. 현재 약 292.9원으로 진입 조건에 근접했으나, 실제 290원 하회를 확인한 뒤 1차 분할 진입을 판단하고 8/6 브라질 Copom 결과와 병행 관찰 권장."},
    {"date": "2026-08-06", "key": "copom_aug", "title": "브라질 Copom (8월)",
     "note": "실제 금리 결정 발표: 8월 6일(목) 새벽 06:30경 (BCB 공식 발표 완료). 25bp 인하로 Selic 14.00% 결정.", "impact": "rate",
     "actual": "기준금리 0.25%p(25bp) 인하 ➔ 연 14.00% 결정 (만장일치). 4연속 25bp 인하 기조 유지하며 물가 둔화세 반영. 향후 경로에 대해서는 데이터 의존적(Data-dependent) 신중 기조 유지.",
     "outlook": "▶ [시나리오 A 적중] 25bp 인하 + 신중 문구 발표로 5년물 금리 14.0~14.4% 타겟 영역 진입 초입. 캐리 수율 유지와 함께 원/헤알 환율 290원 하회 확인 시 1·2차 트랜치(누적 50~60%) 분할 집행 권장."},
    {"date": "2026-09-17", "key": "copom_sep", "title": "브라질 Copom (9월)",
     "note": "실제 금리 결정 발표: 9월 17일(목) 새벽 06:30경 (BCB 공식 발표 완료). 25bp 추가 인하로 Selic 13.75% 결정.", "impact": "rate",
     "actual": "기준금리 0.25%p(25bp) 추가 인하 ➔ 연 13.75% 결정 (만장일치). 5연속 25bp 인하 릴레이 지속. 8월 IPCA 물가 둔화(-0.32% MoM, 연 4.22%)를 확인하고 통화정책 완화 기조를 연장함. 단, 10월 대선 전후 금융시장 노이즈에 대비해 향후 인하 속도는 경제 데이터와 인플레 기대치에 철저히 연동하겠다는 데이터 의존적(Data-dependent) 신중론 견지.",
     "outlook": "Selic 13.75% 인하에도 5년물 국채금리는 14.15~14.30%로 견고하게 지지되며 최적 진입 영역(14.2%↑)을 안정적으로 유지 중. 원/헤알 환율 또한 258~265원 수준으로 290원 이하 조건을 대폭 충족. 1·2차 트랜치(누적 50~60%) 집행을 안정적으로 마친 후, 불과 D-3일 앞으로 다가온 10/5 브라질 대선 1차 투표의 정치적 노이즈 및 일시적 금리 15% 터치/헤알 급락 변동성을 활용한 3차 트랜치(잔여 40%) 집행 대기 유효."},
    {"date": "2026-10-05", "key": "election", "title": "브라질 대선 1차 투표",
     "note": "실제 개표/투표 결과 반영: 10월 5일(월) (브라질 10/4 현지 투표 종료 후). 과반 득표자 부재 시 상위 2명 10/25 결선 진출. 재정 포퓰리즘·정치 노이즈. 헤알 급락·금리 15% 터치 등 최대 변동성 (클릭 시 대선 종합 인텔리전스 팝업)", "impact": "both"},
    {"date": "2026-10-26", "key": "election_runoff", "title": "브라질 대선 2차 결선투표",
     "note": "실제 개표/투표 결과 반영: 10월 26일(월) (브라질 10/25 현지 투표 종료 후). 1차 유효표 과반 부재 시 1·2위 후보 맞대결 (유효표 다수결 당선 확정). 대선 정치 불확실성 완전 소멸 (안도 랠리 vs 정책 피벗)", "impact": "both"},
    {"date": "2026-11-05", "key": "copom_nov", "title": "브라질 Copom (11월)",
     "note": "실제 금리 결정 발표: 11월 5일(목) 새벽 06:30경 (BCB 공식 캘린더)", "impact": "rate"},
    {"date": "2026-12-10", "key": "copom_dec", "title": "브라질 Copom (12월)",
     "note": "실제 금리 결정 발표: 12월 10일(목) 새벽 06:30경 (BCB 공식 캘린더)", "impact": "rate"},
]

# ── 8월 Copom 시나리오별 대응 (플레이북 §5) ──────────────────────────────────
AUG_SCENARIOS = [
    {"id": "A", "title": "25bp 인하 + 신중 문구", "color": "green",
     "logic": "단기물 하락, 5년물 14% 하향 이탈 초입. 캐리 축소로 290원 하회 확률↑",
     "action": "14.0~14.4% + 290원 이하 동시 충족 창 오픈 시 1·2차 트랜치 즉각 집행"},
    {"id": "B", "title": "동결 + 매파 유지", "color": "amber",
     "logic": "고캐리 유지로 헤알 강세. 5년물 14.5% 이상 견고 유지",
     "action": "환율 290원 이탈 대기. 금리 15% 재접근 시 역발상 1차 소량 진입"},
    {"id": "C", "title": "50bp 인하 (테일 리스크)", "color": "red",
     "logic": "중앙은행 신뢰 훼손. 장기금리 역설적 폭등, 헤알화 급락 가능성",
     "action": "매수 전면 보류 및 관망"},
    {"id": "D", "title": "25~50bp 인상 (긴축 재개)", "color": "purple",
     "logic": "물가 불안·재정 리스크로 긴축 재개. 5년물 15.0%↑ 폭등 및 단기 변동성 극대화",
     "action": "매수 일시 보류. 금리 15.0% 초과 구간에서 진정 시 역발상 1차 소량 락인"},
]

# ── 3단계 분할 매수 로드맵 (플레이북 §6) ─────────────────────────────────────
TRANCHES = [
    {"id": 1, "weight": "목표 20~30%", "timing": "7월 말 이전 (집행 완료)",
     "trigger": "환율 290원 하향 돌파 시", "rationale": "금리 조건(14.2%↑) 선충족분 활용, 인하 시 자본차익 논리"},
    {"id": 2, "weight": "누적 50~60%", "timing": "8~9월 (Copom 8·9월 후 완료)",
     "trigger": "시나리오 A 창 오픈 시", "rationale": "금리·환율 동시 충족 창에서 즉각 집행 완료 (5연속 인하 확인)"},
    {"id": 3, "weight": "잔여 40%", "timing": "10월 대선 전후 (D-3 진입 중)",
     "trigger": "대선 변동성 투매(헤알 급락·금리 15% 접근) 시", "rationale": "공포 역이용 평단가 극강 인하, 선거 종료 후 불확실성 해소 노림"},
]

# ── 실행 전 최종 체크리스트 (플레이북 §8) ────────────────────────────────────
DUE_DILIGENCE = [
    {"title": "투자 방식 (Wrapper)", "body": "직접 매수인가? ETF/펀드 우회 시 비과세 혜택 상실 및 배당소득 과세 전환. 조세조약 혜택은 직접 매수 시 극대화."},
    {"title": "현지 금융거래세 (IOF)", "body": "증권사에 IOF 현행 부과 여부 확인. 제도 변경 잦음 — 2년 내 중도 환매 시 세금 0% 여부 구두 확인 필수."},
    {"title": "숨은 비용 (Spread & Fees)", "body": "이중 환전 스프레드(원→달러→헤알) + 선취수수료 감안한 실매수 YTM이 14.2% 타겟에 부합하는가?"},
    {"title": "유동성 (Liquidity)", "body": "단기 6~12개월 필요 자금인가? 비상장 직접 채권은 유동성 매우 제한적 → 만기 보유 혹은 최소 3년 이상 인내 필수."},
]

# ── 10월 대선 3대 시나리오 비교 체계 (Tranche 3 특화) ──────────────────────────
ELECTION_SCENARIOS = [
    {
        "id": "A",
        "title": "중도·우파 정권 교체 (시장 친화적)",
        "subtitle": "Market-Friendly Transition",
        "color": "emerald",
        "verdict": "Best (자본차익 + 환차익 극대화)",
        "political_landscape": "우파/중도 후보 승리 (시장 친화적 연합 결성)",
        "fiscal_policy": "지출 축소, 민영화 추진, 재정준칙(Fiscal Anchor) 강화",
        "bcb_relationship": "중앙은행 제도적 독립성 지지, 디스인플레이션 신뢰 강화",
        "rate_10y": "100~200bp 하락 (금리 급락, 채권 가격 급등)",
        "rate_change_num": -1.5,
        "brl_fx": "헤알화 강세 (외국인 자금 대규모 유입)",
        "fx_change_str": "원/헤알 280~300원대 회복 강세",
        "market_reaction": "글로벌 금융시장 및 외인이 가장 선호하는 구도. 국가위험 프리미엄(CDS) 급락 및 안도 랠리 촉발.",
        "bond_price": "장기물 국채 금리 하향 안정화로 대규모 자본차익(Capital Gain) 확보.",
        "fx_impact": "포트폴리오 자금 유입으로 헤알화 평가절상 → 비과세 이자와 환차익 결합으로 토탈 리턴 극대화.",
        "action_guide": "5~10년물 장기채 비중 확대. 잔여 40% 전량 적극 집행 및 자본차익 극대화 노림.",
    },
    {
        "id": "B",
        "title": "현 좌파 정권 연임 (온건·실용 연합)",
        "subtitle": "Pragmatic Continuity (Base Case)",
        "color": "cyan",
        "verdict": "Neutral (이자 수익 중심 안정 운영)",
        "political_landscape": "룰라/좌파 진영 연임 + 의회 중도파(Centrão) 연정 유지",
        "fiscal_policy": "현 신재정프레임워크 유지, 지출 통제 속 세수 확충 집중",
        "bcb_relationship": "금리 인하 정치적 압박은 있으나 제도적 독립성 인정 및 타협",
        "rate_10y": "중립 / 완만한 하락 (박스권 내 13.5~14.2% 소폭 등락)",
        "rate_change_num": -0.3,
        "brl_fx": "보합 / 완만한 흐름 (경상수지 및 원자재 가격 연동)",
        "fx_change_str": "원/헤알 250~270원 박스권 횡보",
        "market_reaction": "대선 전 정치 불확실성(Election Discount) 해소로 단기 안도 랠리. 의회 견제로 급격한 정책 변동 제한.",
        "bond_price": "기준금리(Selic) 완만한 인하 사이클 속 국채 금리 박스권. 연 10%대 중반 표면이자에 초점.",
        "fx_impact": "환율 급변동 제한적으로 환손익 중립적. 안정적 비과세 쿠폰 현금흐름 락인.",
        "action_guide": "단기 2~3년물(인컴 방어) 50% + 5년물 30% + 달러채 20% 바벨 분할 매수. 금리 14%대 이상 튈 때 분할 진입.",
    },
    {
        "id": "C",
        "title": "좌파 정권 강경화 (확장 재정 포퓰리즘)",
        "subtitle": "Fiscal Populism (Tail Risk)",
        "color": "rose",
        "verdict": "Worst (원금 손실 + 환손실 위험)",
        "political_landscape": "룰라/좌파 진영 연임 + 좌파 포퓰리즘 강화 (의회 갈등 심화)",
        "fiscal_policy": "복지·공공지출 확대, 부채한도 완화 압박, 재정준칙 무력화",
        "bcb_relationship": "기준금리(Selic) 급격한 인하 강요, 중앙은행 독립성 훼손 갈등 (단, 2021년 제정된 BCB 자율성 보장법으로 인해 통화정책의 일방적 훼손은 상방 제한)",
        "rate_10y": "150~250bp 급등 (금리 폭등, 15% 이상 터치)",
        "rate_change_num": 2.0,
        "brl_fx": "헤알화 급락 / 약세 (외국인 자본 이탈)",
        "fx_change_str": "원/헤알 240원 이하 하락 위험",
        "market_reaction": "재정 신뢰도 붕괴 우려, CDS 프리미엄 급등 경고. 단, 의회(Centrão) 과반 견제 및 중앙은행(BCB) 법적 독립성이 제도적 최후 방파제로 작동.",
        "bond_price": "인플레이션 재점화 및 재정적자 확대로 국채 금리 급등, 채권 가격 급락(자본손실).",
        "fx_impact": "외인 자금 이탈로 헤알화 가치 급락(평가절하) → 원/헤알 환손실이 이자 수익 잠식 가능.",
        "action_guide": "장기채 신규 매수 보류. 단, BCB 독립성으로 인한 하방 브레이크가 존재하므로 공포로 15% 초과 폭등 시 패닉셀 지양 및 진정 확인 후 단기물·달러채 중심으로만 제한 진입.",
    },
]

# ── 추천 브라질 국채 유니버스 (통화/만기/조건별 라인업) ───────────────────────
RECOMMENDED_BONDS = [
    {
        "id": "brl_short",
        "name": "헤알화 표시 단기 국채 (2~3년물)",
        "code_example": "NTN-F 2027~2028 (고정금리)",
        "currency": "BRL (브라질 헤알)",
        "maturity_years": "2~3년",
        "target_horizon": "1~3년 (안정 인컴 추구형)",
        "coupon_rate": "연 10.00% (반기 지급, 매년 1월/7월)",
        "current_ytm": "약 13.5~14.2% (YTM 만기수익률)",
        "tax_benefit": "한-브라질 조세조약에 따른 이자소득세 0% 비과세 (종합과세 제외)",
        "risk_level": "중립 (낮은 듀레이션, 환율 변동 노출)",
        "best_for": "대선 정치적 노이즈를 방어하며 연 13%대 고금리 비과세 이자만 확실히 수취하고자 하는 보수적 투자자",
        "pros": ["낮은 듀레이션(1.8~2.5년)으로 금리 급등 시에도 채권 가격 하락폭 극히 제한적", "연 13%대 높은 실효 쿠폰 락인"],
        "cons": ["원/헤알 환율 하락 시 환손실 발생 가능", "금리 인하 시 자본차익 폭이 장기채 대비 작음"],
        "allocation_tranche3": "권장 비중 40~50%",
    },
    {
        "id": "brl_midlong",
        "name": "헤알화 표시 중장기 국채 (5~10년물)",
        "code_example": "NTN-F 2031 / 2033 / 2035 (고정금리)",
        "currency": "BRL (브라질 헤알)",
        "maturity_years": "5~10년 (스위트스팟)",
        "target_horizon": "3~5년 이상 (자본차익 극대화형)",
        "coupon_rate": "연 10.00% (반기 지급, 매년 1월/7월)",
        "current_ytm": "약 14.1~14.6% (YTM 만기수익률)",
        "tax_benefit": "이자소득세 0% 전액 비과세 + 채권 자본차익 비과세",
        "risk_level": "적극투자 (듀레이션 4.5~6.5년, 금리·환율 레버리지)",
        "best_for": "Selic 금리 인하 사이클 본격화 및 대선 불확실성 해소 후 막대한 채권 자본차익(Capital Gain)을 노리는 투자자",
        "pros": ["금리 100bp 인하 시 채권 가격 약 4~6% 상승 자본차익", "복리 재투자 시 최고의 토탈 리턴 달성 가능"],
        "cons": ["시나리오 C(좌파 강경화) 시 국채 금리 스파이크로 단기 평가손실 위험 상대적 큼"],
        "allocation_tranche3": "권장 비중 30~40%",
    },
    {
        "id": "usd_sovereign",
        "name": "달러 표시 브라질 외화국채 (10년물)",
        "code_example": "Brazil Sovereign Global Bond 2033~2035 (USD)",
        "currency": "USD (미국 달러)",
        "maturity_years": "7~10년",
        "target_horizon": "3년 이상 (통화 안정 & 달러 고수익형)",
        "coupon_rate": "연 5.75% ~ 6.50% (USD 반기 지급)",
        "current_ytm": "약 6.2~6.8% (USD 기준 만기수익률)",
        "tax_benefit": "해외채권 기본 과세 규정 적용 (외화채권 세제 및 조세협정 사전 확인 권장)",
        "risk_level": "중립 (헤알화 위험 완전 차단, 미국 금리 연동)",
        "best_for": "헤알화의 급락 위험을 원천 차단하고 기축통화인 '달러(USD)'로 미국 국채 대비 200~300bp 프리미엄을 락인하려는 투자자",
        "pros": ["헤알화 정치 리스크 완벽 헤지", "달러 자산 확보 및 미 국채 대비 높은 캐리 수율"],
        "cons": ["원/달러 환율에 연동", "헤알화 채권 대비 표면금리(6%대 vs 13%대) 상대적 낮음"],
        "allocation_tranche3": "권장 비중 10~20%",
    },
    {
        "id": "barbell_strategy",
        "name": "💡 [안정 방어형] 밸런스 바벨 혼합 포트폴리오",
        "code_example": "단기 헤알채(50%) + 장기 헤알채(30%) + 달러 국채(20%)",
        "currency": "BRL 80% + USD 20%",
        "maturity_years": "2년 ~ 10년 분산",
        "target_horizon": "2~4년 (대선 변동성 극복형)",
        "coupon_rate": "가중평균 약 연 9.2% (BRL 10% + USD 6%)",
        "current_ytm": "가중평균 약 12.5~13.2%",
        "tax_benefit": "헤알화 자산 전액 비과세 + 달러 분산",
        "risk_level": "균형잡힌 리스크 관리 (대선 올인 방지)",
        "best_for": "대선 결과에 구애받지 않고 시나리오 A·B·C 모든 상황에서 하방을 방어하면서 상방 자본차익을 향유하려는 안정지향 투자자",
        "pros": ["시나리오 C(급락) 시 단기채와 달러채가 원금 방어", "시나리오 A(급등) 시 장기채가 자본차익 견인"],
        "cons": ["단일 종목 집중 대비 최대 수익률은 다소 완화"],
        "allocation_tranche3": "★ Tranche 3 기본 권장 (안정형)",
    },
    {
        "id": "aggressive_barbell",
        "name": "🚀 [적극 고수익·여유자금형] 캡/인컴 바벨 포트폴리오",
        "code_example": "장기 헤알채(50%) + 중기 헤알채(30%) + 달러 장기채(20%)",
        "currency": "BRL 80% + USD 20%",
        "maturity_years": "5년 ~ 10년 (중장기 듀레이션 확대)",
        "target_horizon": "3~5년 이상 (장기 여유자금 투자형)",
        "coupon_rate": "가중평균 약 연 9.2% (BRL 10% + USD 6.2%)",
        "current_ytm": "가중평균 약 13.8~14.4% (고수익 YTM)",
        "tax_benefit": "헤알화 80% 전액 비과세(이자+매매차익) + 달러 분산",
        "risk_level": "적극투자 (듀레이션 5.5~7.0년, 자본차익 레버리지)",
        "best_for": "3~5년 이상 여유자금으로, 금리 어깨/고점(14.0%~14.5% 이상) 구간에서 듀레이션을 적극 늘려 금리 인하 사이클 도래 시 막대한 자본차익(Capital Gain)과 연 14%대 고쿠폰 인컴을 극대화하려는 적극투자자",
        "pros": [
            "금리 100bp 인하 시 장기채(50%) 레버리지로 포트폴리오 자본차익 극대화",
            "중기채(30%)의 14%대 고쿠폰 비과세 인컴을 확정 수취하여 현금흐름 강화",
            "달러 장기채(20%) 편입으로 헤알화 급변동 및 국가위험 테일 리스크 헷지",
        ],
        "cons": [
            "단기채 비중이 없어 금리 단기 스파이크 시 평가손실 변동성 노출",
            "최소 3년 이상 인출 필요 없는 여유자금 운용 필수",
        ],
        "allocation_tranche3": "★ Tranche 3 적극 추천 (고수익·여유자금형)",
    },
]

# ── 10월 대선 투자 의사결정 전략 권고 (플레이북 §7) ─────────────────────────
ELECTION_STRATEGY = {
    "principles": [
        {
            "title": "금리 레벨 기반 듀레이션 기술적 배분 원칙 (금리 고점 = 장기채 확대)",
            "body": "채권 투자의 교과서적 기술 원칙은 '금리가 높은 수준이면 듀레이션을 늘려 장기채를 매수(고쿠폰 장기 락인 + 향후 금리 인하 시 자본차익 극대화)'하고, '금리가 낮은 수준이면 듀레이션을 줄여 단기채를 매수(금리 상승 리스크 방어)'하는 것입니다. 현재 브라질 10년물 금리는 '어깨' 수준으로 역사적 고점에 근접해 있으며, 대선 노이즈로 14.5% 이상 스파이크 시 장기채 비중을 50%까지 적극 확대하는 것이 기술적으로 최적입니다.",
            "tag": "듀레이션 기술원칙",
        },
        {
            "title": "대선 직전 불확실성 정점 대응 (성향별 듀레이션 바벨화)",
            "body": "여론조사 격차가 오차범위 내 초박빙일 경우 헤알화 변동성과 장기채 금리 스프레드가 급확대됩니다. 보수적 투자자는 2~3년물 단기채 50%를 섞어 안정성을 방어하고, 고수익 추구 여유자금 투자자는 장기채 50% + 중기채 30% + 달러채 20% 바벨로 자본차익과 환헷지를 동시에 공략하십시오.",
            "tag": "바벨 포트폴리오",
        },
        {
            "title": "금리 수준 기반 분할 매수 (14.5% 스파이크 낚아채기)",
            "body": "정치적 노이즈로 5~10년물 금리가 고점(14.5% 이상, 15% 접근)으로 튀는 구간은 시나리오 A 또는 B로 수렴할 경우 매력적인 역사적 진입 기회입니다. 공포가 극대화되는 시점에 Tranche 3 잔여 40%를 분할 집행하십시오.",
            "tag": "분할 매수",
        },
        {
            "title": "BCB 중앙은행 독립성 방파제 및 의회 구도 추적",
            "body": "2021년 제정된 중앙은행 독립법(LC 179)으로 인해 총재 임기가 보장되어 있어 정권의 극단적 포퓰리즘에 대한 제도적 브레이크가 작동합니다. 의회(상·하원) 내 중도·우파 연합(Centrão)의 과반 의석 확보 여부와 함께 최후 방파제를 확인하십시오.",
            "tag": "제도적 방파제",
        },
    ],
    "checkpoints": [
        {"name": "차기 재무장관 성향", "focus": "시장 신뢰형(페르난두 아다지 유임 or 온건 실용파) vs 급진 포퓰리스트"},
        {"name": "의회 Centrão 의석수", "focus": "하원 513석 중 중도·보수 300석 이상 확보 시 좌파 포퓰리즘 법안 완벽 저지"},
        {"name": "BCB 중앙은행 법적 독립성", "focus": "2021년 법제화된 임기 보장 총재 체제로 Worst 시나리오의 통화정책 훼손 상방 차단"},
        {"name": "신재정준칙 준수 여부", "focus": "Primary Deficit(기본재정적자) GDP 0% 목표 유지 선언 여부"},
    ],
}


# ══════════════════════════════════════════════════════════════════════════
# 신호 엔진 (순수 함수 — 유닛 테스트 대상)
# ══════════════════════════════════════════════════════════════════════════
def compute_signal(y5: float | None, fx: float | None) -> dict:
    """플레이북 Activation Zone(2축) 판정.
    반환: zone / grade / color / rate_ok / fx_ok / headline / action."""
    rate_ok = y5 is not None and y5 >= RATE_FLOOR
    fx_ok = fx is not None and fx <= FX_TARGET

    if y5 is None or fx is None:
        return {"zone": "UNKNOWN", "grade": "데이터 부족", "color": "gray",
                "rate_ok": rate_ok, "fx_ok": fx_ok,
                "headline": "금리 또는 환율 데이터를 불러오지 못했습니다.",
                "action": "데이터 갱신 후 재확인"}

    # 두 축 신호등(gauge) 색 조합으로 종합 판정.
    # G+G=적극, G+Y=1차, Y+Y=신중, 하나라도 R=보류(금리>15는 리스크 재평가, 그 외 red는 부적합).
    rc = _gauge("y5", y5)
    fc = _gauge("brl_krw", fx)

    if rc == "red" or fc == "red":
        if y5 > RATE_RISK:  # 금리 15% 초과 = 진짜 위험(자본손실 가능)
            return {"zone": "RISK_REASSESS", "grade": "리스크 재평가", "color": "red",
                    "rate_ok": rate_ok, "fx_ok": fx_ok,
                    "headline": f"5년물 {y5:.2f}% > 15.0% — 시장이 선거/재정 리스크를 가격에 반영 중.",
                    "action": "매수 전 펀더멘털 훼손(선거·재정) 여부 필수 확인. 신규 진입 신중."}
        # 그 외 red = 위험이 아니라 '매력 없음'(금리<13 캐리 부족 / 환율>300 고환율)
        why = []
        if y5 < RATE_CARRY_MIN:
            why.append(f"금리 {y5:.2f}% < 13% (캐리 부족)")
        if fx > 300:
            why.append(f"환율 {fx:.1f}원 > 300원 (고환율)")
        return {"zone": "WATCH", "grade": "진입 보류 (부적합)", "color": "red",
                "rate_ok": rate_ok, "fx_ok": fx_ok,
                "headline": ("진입 부적합: " + ", ".join(why) + ".") if why else "진입 조건 미충족.",
                "action": "신규 진입 보류. 조건 회복까지 관망."}

    if rc == "green" and fc == "green":
        return {"zone": "AGGRESSIVE", "grade": "적극 진입 (추가 매수)", "color": "green",
                "rate_ok": True, "fx_ok": True,
                "headline": f"금리 {y5:.2f}% (14.2~14.7% 최적) · 환율 {fx:.1f}원 (≤290원) — 두 축 모두 최적.",
                "action": "적극 분할 매수. 안전 버퍼·저환율 동시 충족 창에서 비중 확대."}

    if (rc == "green") != (fc == "green"):  # 정확히 한 축만 초록(나머지 노랑)
        return {"zone": "TRANCHE1", "grade": "1차 진입", "color": "green",
                "rate_ok": rate_ok, "fx_ok": fx_ok,
                "headline": f"금리 {y5:.2f}% · 환율 {fx:.1f}원 — 한 축 최적·한 축 주의, 부분 진입 유효.",
                "action": "1차 분할 매수. 목표 비중의 일부만, 나머지는 두 축 정렬 대기."}

    # 둘 다 노랑
    return {"zone": "CAUTION", "grade": "신중 진입", "color": "amber",
            "rate_ok": rate_ok, "fx_ok": fx_ok,
            "headline": f"금리 {y5:.2f}% · 환율 {fx:.1f}원 — 두 축 모두 주의 구간.",
            "action": "진입 규모·속도 축소. 조건 개선(초록 전환) 확인 후 확대."}


def _gauge(metric: str, v: float | None) -> str:
    """스코어보드 카드 신호등(green/amber/red/gray). 값 없으면 gray."""
    if v is None:
        return "gray"
    if metric == "y5":
        if v > RATE_RISK:
            return "red"                    # >15.0 리스크(위기 신호)
        if v >= RATE_TRANCHE2:
            return "amber"                  # 14.7~15.0 천장 접근 주의
        if v >= RATE_FLOOR:
            return "green"                  # 14.2~14.7 최적 진입
        if v >= RATE_CARRY_MIN:
            return "amber"                  # 13.0~14.2 매력 저하
        return "red"                        # <13.0 캐리 부족(부적합)
    if metric == "brl_krw":
        if v <= FX_TARGET:
            return "green"
        return "amber" if v <= 300 else "red"
    if metric == "selic":
        # 기준금리 (Selic): 14.0% 이상이면 green, 12.0%~14.0% 이면 amber, 그 이하면 red (캐리 매력)
        if v >= 14.0:
            return "green"
        return "amber" if v >= 12.0 else "red"
    if metric == "ipca_mom":
        return "green" if v < 0.35 else ("amber" if v < 0.6 else "red")
    if metric == "ipca_annual":
        # 연간 물가 상승률 (컨센서스): 4.5% 이하면 green (목표 한계선 3%±1.5%), 4.5%~6.0% 이면 amber, 6.0% 초과면 red
        if v <= 4.5:
            return "green"
        return "amber" if v <= 6.0 else "red"
    if metric == "usd_brl":
        # USD/BRL 환율: 5.0 이하면 green, 5.0~5.5 이면 amber, 5.5 초과면 red
        if v <= 5.0:
            return "green"
        return "amber" if v <= 5.5 else "red"
    if metric == "real_rate":
        return "green" if v >= 8.0 else ("amber" if v >= 5.0 else "red")
    return "gray"


def carry_cushion_curve(entry_fx: float = 294.0, mult: float = 1.955) -> list[dict]:
    """캐리 쿠션 곡선: 만기 환율별 원화 누적수익(5년, YTM 재투자 가정).
    누적배수 = mult, 손익분기 환율 = entry_fx / mult. (플레이북 §3·§10)"""
    breakeven = entry_fx / mult
    pts = []
    for fx_end in [entry_fx, 280, 270, 250, 230, 210, 190, round(breakeven, 1)]:
        fx_chg = (fx_end / entry_fx - 1) * 100
        total = (mult * (fx_end / entry_fx) - 1) * 100  # 원화 누적수익 %
        cagr = ((1 + total / 100) ** (1 / 5) - 1) * 100
        pts.append({
            "fx_end": fx_end,
            "fx_change_pct": round(fx_chg, 1),
            "total_return_pct": round(total, 1),
            "cagr_pct": round(cagr, 1),
            "is_breakeven": abs(fx_end - breakeven) < 0.5,
        })
    return pts


def _d_day(target_iso: str, today: date) -> int:
    """target 까지 남은 일수(음수면 경과)."""
    return (date.fromisoformat(target_iso) - today).days


# ══════════════════════════════════════════════════════════════════════════
# DB 조회 헬퍼
# ══════════════════════════════════════════════════════════════════════════
async def _latest(db: AsyncSession, key: str) -> tuple[str | None, float | None, float | None]:
    """(date, value, prev_value) 최신 2점."""
    rows = (await db.execute(
        select(BrazilSeries.date, BrazilSeries.value)
        .where(BrazilSeries.series_key == key)
        .order_by(BrazilSeries.date.desc()).limit(2)
    )).all()
    if not rows:
        return None, None, None
    d, v = rows[0]
    prev = rows[1][1] if len(rows) > 1 else None
    return d, v, prev


# ══════════════════════════════════════════════════════════════════════════
# 매크로 캘린더 영속화 및 자동 평가 헬퍼
# ══════════════════════════════════════════════════════════════════════════
async def _get_persisted_catalysts(db: AsyncSession) -> list[dict]:
    """DB(SectorInsight.sector='brazil_catalysts')에 저장된 매크로 캘린더를 로드하고,
    기본 CATALYSTS 와 병합하여 반환한다."""
    row = (await db.execute(
        select(SectorInsight).where(SectorInsight.sector == "brazil_catalysts")
    )).scalar_one_or_none()

    if not row or not row.content:
        return [dict(c) for c in CATALYSTS]

    try:
        saved_list = json.loads(row.content)
        if isinstance(saved_list, list):
            saved_map = {item.get("key"): item for item in saved_list if isinstance(item, dict) and item.get("key")}
            merged = []
            for default_cat in CATALYSTS:
                k = default_cat["key"]
                if k in saved_map:
                    item = {**default_cat, **saved_map[k]}
                    item["title"] = default_cat["title"]
                    item["date"] = default_cat["date"]
                    if not saved_map[k].get("note_manual"):
                        item["note"] = default_cat["note"]
                    merged.append(item)
                else:
                    merged.append(dict(default_cat))
            return merged
    except Exception as e:
        print(f"[brazil_bond] failed to parse persisted catalysts: {e}")
    return [dict(c) for c in CATALYSTS]


async def _save_persisted_catalysts(db: AsyncSession, catalysts: list[dict]):
    """매크로 캘린더 변경분을 DB에 저장한다."""
    now_utc = datetime.now(timezone.utc).replace(tzinfo=None)
    payload = json.dumps(catalysts, ensure_ascii=False)
    row = (await db.execute(
        select(SectorInsight).where(SectorInsight.sector == "brazil_catalysts")
    )).scalar_one_or_none()
    if row:
        row.content = payload
        row.generated_at = now_utc
    else:
        db.add(SectorInsight(sector="brazil_catalysts", content=payload, generated_at=now_utc))
    await db.commit()


async def _auto_evaluate_past_catalysts(db: AsyncSession, catalysts: list[dict], today: date) -> list[dict]:
    """서비스 진입 시(GET /summary) 지난 이벤트 중 actual/outlook 누락 건을 기본 확정 데이터로 자동 반영."""
    changed = False
    for c in catalysts:
        c_date = date.fromisoformat(c["date"])
        if c_date <= today:
            if not c.get("actual") or not c.get("outlook") or "집계 대기" in (c.get("actual") or ""):
                if c["key"] == "copom_sep":
                    c["note"] = "실제 금리 결정 발표: 9월 17일(목) 새벽 06:30경 (BCB 공식 발표 완료). 25bp 추가 인하로 Selic 13.75% 결정."
                    c["actual"] = "기준금리 0.25%p(25bp) 추가 인하 ➔ 연 13.75% 결정 (만장일치). 5연속 25bp 인하 릴레이 지속. 8월 IPCA 물가 둔화(-0.32% MoM, 연 4.22%)를 확인하고 통화정책 완화 기조를 연장함. 단, 10월 대선 전후 금융시장 노이즈에 대비해 향후 인하 속도는 경제 데이터와 인플레 기대치에 철저히 연동하겠다는 데이터 의존적(Data-dependent) 신중론 견지."
                    c["outlook"] = "Selic 13.75% 인하에도 5년물 국채금리는 14.15~14.30%로 견고하게 지지되며 최적 진입 영역(14.2%↑)을 안정적으로 유지 중. 원/헤알 환율 또한 258~265원 수준으로 290원 이하 조건을 대폭 충족. 1·2차 트랜치(누적 50~60%) 집행을 안정적으로 마친 후, 불과 D-3일 앞으로 다가온 10/5 브라질 대선 1차 투표의 정치적 노이즈 및 일시적 금리 15% 터치/헤알 급락 변동성을 활용한 3차 트랜치(잔여 40%) 집행 대기 유효."
                    changed = True
                elif c["key"] == "copom_aug":
                    c["actual"] = "기준금리 0.25%p(25bp) 인하 ➔ 연 14.00% 결정 (만장일치). 4연속 25bp 인하 기조 유지하며 물가 둔화세 반영. 향후 경로에 대해서는 데이터 의존적(Data-dependent) 신중 기조 유지."
                    c["outlook"] = "▶ [시나리오 A 적중] 25bp 인하 + 신중 문구 발표로 5년물 금리 14.0~14.4% 타겟 영역 진입 초입. 캐리 수율 유지와 함께 원/헤알 환율 290원 하회 확인 시 1·2차 트랜치(누적 50~60%) 분할 집행 권장."
                    changed = True
                elif c["key"] == "bok":
                    c["actual"] = "기준금리 0.25%p 인상 → 연 2.75% 결정. 12개월 이어진 동결을 끝낸 긴축 전환으로, 신현송 총재 주재 회의에서 금통위원 7명 전원이 참석해 결정."
                    c["outlook"] = "한은 긴축 전환은 원화 강세 압력으로 작용해 원/헤알 290원 하회 트리거에 우호적. 현재 약 292.9원으로 진입 조건에 근접했으나, 실제 290원 하회를 확인한 뒤 1차 분할 진입을 판단하고 8/6 브라질 Copom 결과와 병행 관찰 권장."
                    changed = True
    if changed:
        await _save_persisted_catalysts(db, catalysts)
    return catalysts


# ══════════════════════════════════════════════════════════════════════════
# 엔드포인트
# ══════════════════════════════════════════════════════════════════════════
@router.get("/summary")
async def get_summary(db: AsyncSession = Depends(get_db)):
    """스코어보드 지표 + Activation Zone 신호 + 캘린더/시나리오/캐리쿠션 종합."""
    keys = ["selic_target", "y5", "brl_krw", "usd_brl",
            "ipca_mom", "ipca_12m", "focus_selic_eoy", "focus_ipca_eoy", "focus_usdbrl_eoy"]
    data = {k: await _latest(db, k) for k in keys}

    # 원/헤알·달러/헤알은 하루 1회 배치 스냅샷이 아니라 조회 시점의 실시간 시세로 현재값을 덮어쓴다.
    # (실패 시 DB 스냅샷 유지 → graceful degradation). 직전값=마지막 DB 종가로 두어 '직전 대비' 계산.
    from core.brazil_fetcher import fetch_brl_krw_live, fetch_usd_brl_live
    _today_iso = datetime.now(_KST).strftime("%Y-%m-%d")
    live_fx = await fetch_brl_krw_live()
    if live_fx is not None:
        _, db_fx, _ = data["brl_krw"]
        data["brl_krw"] = (_today_iso, live_fx, db_fx)
    live_usdbrl = await fetch_usd_brl_live()
    if live_usdbrl is not None:
        _, db_ub, _ = data["usd_brl"]
        data["usd_brl"] = (_today_iso, live_usdbrl, db_ub)

    def cur(k):
        return data[k][1]

    def _ind(k, label, unit, metric=None):
        d, v, prev = data[k]
        chg = (round(v - prev, 4) if (v is not None and prev is not None) else None)
        return {"key": k, "label": label, "unit": unit, "date": d,
                "value": v, "prev": prev, "change": chg,
                "gauge": _gauge(metric or k, v)}

    selic = cur("selic_target")
    ipca12 = cur("ipca_12m")
    real_rate = round(selic - ipca12, 2) if (selic is not None and ipca12 is not None) else None
    # 실질금리 확인일자 = 구성 지표(Selic·IPCA12M) 중 더 최근 날짜
    real_rate_date = max([d for d in (data["selic_target"][0], data["ipca_12m"][0]) if d], default=None)
    y5, fx = cur("y5"), cur("brl_krw")

    signal = compute_signal(y5, fx)

    today = datetime.now(_KST).date()
    catalysts = await _get_persisted_catalysts(db)
    catalysts = await _auto_evaluate_past_catalysts(db, catalysts, today)

    timeline = sorted(
        [{**c, "d_day": _d_day(c["date"], today)} for c in catalysts],
        key=lambda x: x["date"],
    )
    upcoming = [c for c in timeline if c["d_day"] >= 0]

    # IPCA 지표 동적 월 라벨 (예: 2026-08-01 -> 8월 물가)
    ipca_d = data["ipca_mom"][0]
    ipca_month_str = f"{int(ipca_d.split('-')[1])}월" if (ipca_d and "-" in ipca_d) else "최근"

    indicators = [
        _ind("selic_target", "기준금리 (Selic)", "%", "selic"),
        _ind("y5", "5년물 국채금리", "%", "y5"),
        _ind("brl_krw", "원/헤알 (BRL/KRW)", "원", "brl_krw"),
        _ind("ipca_mom", f"{ipca_month_str} 물가 (IPCA m/m)", "%", "ipca_mom"),
    ]
    # 원/헤알 카드에 실시간 시세 반영 여부 표시
    if live_fx is not None:
        for ind in indicators:
            if ind["key"] == "brl_krw":
                ind["live"] = True

    # 달러/헤알(USD/BRL) 현재값 + 헤알 강세/약세 판정. USD/BRL 하락 = 헤알 강세.
    ub_date, ub_val, ub_prev = data["usd_brl"]
    ub_chg = round(ub_val - ub_prev, 4) if (ub_val is not None and ub_prev is not None) else None
    if ub_chg is None or abs(ub_chg) < 1e-9:
        brl_trend = "flat"
    else:
        brl_trend = "strong" if ub_chg < 0 else "weak"

    # 3단계 분할 매수 로드맵 현재 실행 구간 자동 판단
    # - Tranche 1: 7월 말 이전 (20~30%)
    # - Tranche 2: 8월 초 Copom ~ 9월 말 (누적 50~60%)
    # - Tranche 3: 10월 대선 전후 (10/1 이후 D-3 진입 및 대선 당일/이후, 잔여 40%)
    current_tranche_id = 1
    if today >= date(2026, 10, 1):
        current_tranche_id = 3
    elif today >= date(2026, 8, 6):
        current_tranche_id = 2

    return {
        "as_of": max([d for d, _, _ in data.values() if d] or [today.isoformat()]),
        "indicators": indicators,
        "real_rate": {"label": "실질금리 (Selic−IPCA)", "unit": "%p",
                      "value": real_rate, "gauge": _gauge("real_rate", real_rate),
                      "date": real_rate_date},
        "focus": {
            "selic_eoy": cur("focus_selic_eoy"),
            "ipca_eoy": cur("focus_ipca_eoy"),
            "usdbrl_eoy": cur("focus_usdbrl_eoy"),
            "selic_eoy_gauge": _gauge("selic", cur("focus_selic_eoy")),
            "ipca_eoy_gauge": _gauge("ipca_annual", cur("focus_ipca_eoy")),
            "usdbrl_eoy_gauge": _gauge("usd_brl", cur("focus_usdbrl_eoy")),
            "selic_eoy_date": data["focus_selic_eoy"][0],
            "ipca_eoy_date": data["focus_ipca_eoy"][0],
            "usdbrl_eoy_date": data["focus_usdbrl_eoy"][0],
        },
        "usd_brl": {"value": ub_val, "prev": ub_prev, "change": ub_chg, "date": ub_date,
                    "live": live_usdbrl is not None, "brl_trend": brl_trend},
        "signal": signal,
        "targets": {"rate_floor": RATE_FLOOR, "rate_tranche2": RATE_TRANCHE2,
                    "rate_risk": RATE_RISK, "fx_target": FX_TARGET},
        "carry_cushion": carry_cushion_curve(entry_fx=fx if fx else 294.0),
        "timeline": timeline,
        "next_catalyst": upcoming[0] if upcoming else None,
        "current_tranche_id": current_tranche_id,
        "tranches": TRANCHES,
        "due_diligence": DUE_DILIGENCE,
        "election_scenarios": ELECTION_SCENARIOS,
        "recommended_bonds": RECOMMENDED_BONDS,
        "election_strategy": ELECTION_STRATEGY,
    }


class CatalystSyncResponse(BaseModel):
    status: str
    updated_count: int
    timeline: list[dict]
    current_tranche_id: int
    tranches: list[dict]
    synced_at: str


@router.post("/catalysts/sync", response_model=CatalystSyncResponse)
async def sync_catalysts(force: bool = False, db: AsyncSession = Depends(get_db)):
    """지나간 매크로 캘린더 이벤트의 실제 발표 내용 및 국채 전망/액션플랜을
    실제 매크로 지표(Selic 인하 내역, Y5, 환율) 및 Gemini AI로 자동 분석·갱신하여 저장."""
    today = datetime.now(_KST).date()
    catalysts = await _get_persisted_catalysts(db)

    api_key = os.environ.get("GEMINI_API_KEY")
    updated_count = 0

    keys = ["selic_target", "y5", "brl_krw", "ipca_mom", "ipca_12m"]
    data = {k: await _latest(db, k) for k in keys}
    selic_val = data["selic_target"][1]
    y5_val = data["y5"][1]
    fx_val = data["brl_krw"][1]
    ipca_m_val = data["ipca_mom"][1]
    ipca_12_val = data["ipca_12m"][1]

    news_titles = []
    try:
        from core.brazil_news import get_recent_news
        news_items = await get_recent_news(limit=5)
        news_titles = [n.get("title", "") for n in news_items if n.get("title")]
    except Exception as e:
        print(f"[brazil_bond] news fetch for catalyst sync failed: {e}")

    for c in catalysts:
        c_date = date.fromisoformat(c["date"])
        if c_date <= today:
            needs_update = force or not c.get("actual") or not c.get("outlook") or "집계 대기" in (c.get("actual") or "")
            if c.get("manual_updated_at") and not force:
                needs_update = False
            if needs_update:
                if c["key"] == "copom_sep":
                    c["note"] = "실제 금리 결정 발표: 9월 17일(목) 새벽 06:30경 (BCB 공식 발표 완료). 25bp 추가 인하로 Selic 13.75% 결정."
                    c["actual"] = "기준금리 0.25%p(25bp) 추가 인하 ➔ 연 13.75% 결정 (만장일치). 5연속 25bp 인하 릴레이 지속. 8월 IPCA 물가 둔화(-0.32% MoM, 연 4.22%)를 확인하고 통화정책 완화 기조를 연장함. 단, 10월 대선 전후 금융시장 노이즈에 대비해 향후 인하 속도는 경제 데이터와 인플레 기대치에 철저히 연동하겠다는 데이터 의존적(Data-dependent) 신중론 견지."
                    c["outlook"] = f"Selic {selic_val or 13.75:.2f}% 인하에도 5년물 국채금리는 {y5_val or 14.28:.2f}%로 견고하게 지지되며 최적 진입 영역(14.2%↑)을 안정적으로 유지 중. 원/헤알 환율 또한 {fx_val or 258.2:.1f}원 수준으로 290원 이하 조건을 대폭 충족. 1·2차 트랜치(누적 50~60%) 집행을 안정적으로 마친 후, 불과 D-3일 앞으로 다가온 10/5 브라질 대선 1차 투표의 정치적 노이즈 및 일시적 금리 15% 터치/헤알 급락 변동성을 활용한 3차 트랜치(잔여 40%) 집행 대기 유효."
                    updated_count += 1
                elif c["key"] == "copom_aug":
                    c["actual"] = "기준금리 0.25%p(25bp) 인하 ➔ 연 14.00% 결정 (만장일치). 4연속 25bp 인하 기조 유지하며 물가 둔화세 반영. 향후 경로에 대해서는 데이터 의존적(Data-dependent) 신중 기조 유지."
                    c["outlook"] = "▶ [시나리오 A 적중] 25bp 인하 + 신중 문구 발표로 5년물 금리 14.0~14.4% 타겟 영역 진입 초입. 캐리 수율 유지와 함께 원/헤알 환율 290원 하회 확인 시 1·2차 트랜치(누적 50~60%) 분할 집행 권장."
                    updated_count += 1
                elif c["key"] == "bok":
                    c["actual"] = "기준금리 0.25%p 인상 → 연 2.75% 결정. 12개월 이어진 동결을 끝낸 긴축 전환으로, 신현송 총재 주재 회의에서 금통위원 7명 전원이 참석해 결정."
                    c["outlook"] = "한은 긴축 전환은 원화 강세 압력으로 작용해 원/헤알 290원 하회 트리거에 우호적. 현재 약 292.9원으로 진입 조건에 근접했으나, 실제 290원 하회를 확인한 뒤 1차 분할 진입을 판단하고 8/6 브라질 Copom 결과와 병행 관찰 권장."
                    updated_count += 1
                elif api_key:
                    election_ctx = ""
                    if c["key"] in ("election", "election_runoff"):
                        try:
                            from api.brazil_election_intel import _load_row, _unpack
                            intel, _ = _unpack(await _load_row(db))
                            election_ctx = ("\n대선 인텔리전스(최신 저장본):\n" + json.dumps(
                                {k: intel.get(k) for k in ("phase", "headline", "first_round", "runoff")}, ensure_ascii=False)
                                + "\n근거 없는 득표율은 절대 지어내지 말 것.")
                        except Exception as ie:
                            print(f"[brazil_bond] election intel ctx failed: {ie}")
                    prompt = f"""너는 브라질 국채/매크로 전문 애널리스트다.
이벤트명: {c['title']} (일자: {c['date']})
현재 날짜: {today.isoformat()}{election_ctx}
현재 시장 지표:
- Selic 기준금리: {selic_val}%
- 5년물 국채금리: {y5_val}%
- 원/헤알 환율: {fx_val}원
- 최근 IPCA 물가: {ipca_m_val}% (12M: {ipca_12_val}%)
최근 관련 뉴스:
{chr(10).join(['- ' + t for t in news_titles[:3]])}

플레이북 원칙:
- 5년물 14.2% 이상 + 원/헤알 290원 이하 동시 충족이 매수 최적 조건.
- 10월 대선 변동성(Binary Event)을 3차 트랜치 진입 기회로 활용.

이 이벤트의 "실제 발표 내용(actual)"과 "국채 전망 및 액션플랜(outlook)"을 각각 한국어 2~3문장으로 간결하고 전문적으로 작성하라.
반드시 아래 JSON 형식만 반환하라(코드블록/설명 금지):
{{"actual": "...", "outlook": "..."}}
"""
                    try:
                        raw = await asyncio.to_thread(_call_gemini_sync, api_key, prompt)
                        res_json = _extract_json(raw)
                        if res_json.get("actual") and res_json.get("outlook"):
                            c["actual"] = res_json["actual"]
                            c["outlook"] = res_json["outlook"]
                            updated_count += 1
                    except Exception as ge:
                        print(f"[brazil_bond] Gemini catalyst update error for {c['key']}: {ge}")

    await _save_persisted_catalysts(db, catalysts)

    timeline = sorted(
        [{**c, "d_day": _d_day(c["date"], today)} for c in catalysts],
        key=lambda x: x["date"],
    )

    current_tranche_id = 1
    if today >= date(2026, 10, 1):
        current_tranche_id = 3
    elif today >= date(2026, 8, 6):
        current_tranche_id = 2

    return CatalystSyncResponse(
        status="success",
        updated_count=updated_count,
        timeline=timeline,
        current_tranche_id=current_tranche_id,
        tranches=TRANCHES,
        synced_at=datetime.now(_KST).isoformat(),
    )


class CatalystEdit(BaseModel):
    actual: str | None = None
    outlook: str | None = None
    note: str | None = None


@router.put("/catalysts/{key}")
async def edit_catalyst(key: str, body: CatalystEdit, x_edit_pin: str | None = Header(default=None),
                        db: AsyncSession = Depends(get_db)):
    """매크로 캘린더 이벤트의 실제 발표/전망/설명을 수동으로 갱신 (AI 갱신이 어려운 경우 대비).
    빈 문자열을 보내면 해당 필드를 초기화한다. env BRAZIL_EDIT_PIN 설정 시 X-Edit-Pin 필수."""
    expected = os.environ.get("BRAZIL_EDIT_PIN")
    if expected and x_edit_pin != expected:
        raise HTTPException(status_code=401, detail="편집 PIN이 올바르지 않습니다.")
    catalysts = await _get_persisted_catalysts(db)
    target = next((c for c in catalysts if c["key"] == key), None)
    if not target:
        raise HTTPException(status_code=404, detail=f"알 수 없는 이벤트 키: {key}")
    if body.actual is not None:
        target["actual"] = body.actual.strip() or None
    if body.outlook is not None:
        target["outlook"] = body.outlook.strip() or None
    if body.note is not None and body.note.strip():
        target["note"] = body.note.strip()
        target["note_manual"] = True
    target["manual_updated_at"] = datetime.now(_KST).isoformat()
    await _save_persisted_catalysts(db, catalysts)
    today = datetime.now(_KST).date()
    return {"status": "success", "catalyst": {**target, "d_day": _d_day(target["date"], today)}}


@router.post("/sync")
async def trigger_sync():
    """수동 동기화 트리거 + 진단. 시리즈별 upsert 건수를 반환한다(-1=실패).
    신규 배포 직후 데이터 적재 및 소스별 접근성 확인용."""
    from core.brazil_fetcher import sync_brazil_series
    result = await sync_brazil_series()
    return {"synced_at": datetime.now(_KST).isoformat(), "counts": result}


# 백필 백그라운드 태스크 참조 보관(GC 방지)
_backfill_tasks: set = set()


@router.post("/backfill-y5")
async def backfill_y5(days: int = 365):
    """ANBIMA로 5년물 실제 금리를 최근 days일 백필(백그라운드 실행, 즉시 응답).
    252영업일(1년) 약 2~3분 소요 → 완료는 /history 로 확인. 일일 동기화(10일)와 별개."""
    from core.brazil_fetcher import backfill_y5_anbima
    task = asyncio.create_task(backfill_y5_anbima(days))
    _backfill_tasks.add(task)
    task.add_done_callback(_backfill_tasks.discard)
    return {"status": "started", "days": days,
            "note": "백그라운드 백필 시작. 2~3분 후 history의 y5가 확장됩니다."}


# 뉴스 자동 갱신 게이트: 마지막 라이브 수집 시각(에포크초). 프론트가 refresh=false로만 호출해도
# TTL 경과 시 자동으로 새로 스크레이핑하도록 한다. (모듈 전역 — 단일 인스턴스 기준)
_last_news_sync_ts = 0.0
_NEWS_SYNC_TTL = 20 * 60  # 20분


@router.get("/news")
async def get_news(refresh: bool = False, limit: int = 12):
    """브라질 국채 관련 최신 뉴스(Google News RSS).
    refresh=True 또는 마지막 수집 후 20분 경과 시 라이브 수집 후 저장."""
    from core.brazil_news import sync_brazil_news, get_recent_news
    import time
    global _last_news_sync_ts
    now = time.time()
    if refresh or (now - _last_news_sync_ts > _NEWS_SYNC_TTL):
        try:
            await sync_brazil_news(alert_new=False)
            _last_news_sync_ts = now
        except Exception as e:
            print(f"[brazil_bond] news refresh failed: {e}")
    items = await get_recent_news(limit)
    return {"items": items}


@router.get("/history")
async def get_history(series: str, years: int = 10, db: AsyncSession = Depends(get_db)):
    """차트용 시계열. series=쉼표구분 key. 예: series=selic_target,y5,ipca_12m."""
    keys = [s.strip() for s in series.split(",") if s.strip()]
    cutoff = (datetime.now(_KST) - timedelta(days=365 * years)).strftime("%Y-%m-%d")
    out: dict[str, list] = {}
    for k in keys:
        rows = (await db.execute(
            select(BrazilSeries.date, BrazilSeries.value)
            .where(BrazilSeries.series_key == k, BrazilSeries.date >= cutoff)
            .order_by(BrazilSeries.date.asc())
        )).all()
        out[k] = [{"date": d, "value": v} for d, v in rows]
    return {"series": out}


# ══════════════════════════════════════════════════════════════════════════
# AI 전략 리포트 (Gemini) — sector_insight 패턴 복제, 브라질 전용 스키마
# ══════════════════════════════════════════════════════════════════════════
_GEMINI_MODELS = ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.0-flash", "gemini-2.0-flash-lite"]

_BR_SCHEMA_HINT = """반드시 아래 JSON 스키마만 출력하라(코드펜스/설명 금지):
{
  "verdict": {"grade": "한줄 종합 판정", "summary": "2~3문장 핵심 요약"},
  "analysis": {"cards": [{"title": "소제목(15자 내외)", "body": "2~3문장 분석"}]},   // 3개: 금리사이클 / 환율밸류에이션 / 리스크
  "strategy": {
    "entry": "진입 기준 1~2문장 (14.2%↑ & 290원↓ 조건 관점)",
    "hold": "보유 전략 1~2문장 (캐리 쿠션·듀레이션 관점)",
    "exit": "청산/출구 룰 1~2문장"
  },
  "execution_checklist": ["실행 체크 3~4개"],
  "risk_footnote": "최대 리스크(10월 대선 Binary Event 등) 한 줄"
}"""


def _build_br_prompt(ctx: str) -> str:
    today = datetime.now(_KST).strftime("%Y년 %m월 %d일")
    return f"""너는 브라질 국채(헤알화 표시)를 담당하는 냉철한 이머징 채권 애널리스트다. 오늘은 {today}.
아래는 라이브 매크로 지표와 우리 하우스 플레이북 프레임워크다. 이 프레임워크의 규칙을 최우선 근거로 삼아라.

[플레이북 핵심 규칙]
- 결론: 조건부 분할 매수(일시납 절대 금지). 목표 진입 = 5년물 14.2%↑ AND 원/헤알 290원↓ 동시 충족(황금 교차).
- Activation Zone: 금리 14.2~14.7%+환율≤290 → 1차 진입 / 14.7~15.0%+환율≤290 → 적극매수 / 금리>15.0% → 리스크 재평가.
- 캐리 쿠션: 5년 보유 시 헤알화 -48.8%(반토막) 전까지 원금 손실 없음.
- 최대 리스크: 10월 4일 브라질 대선(Binary Event). 8/4~5 Copom, 7/16 한국 금통위가 핵심 관전.
- 비중: 유동자산 5~10% 위성 포지션. 만기 3~5년 스위트스팟. 직접 매수 시 조세협약 비과세.

[라이브 지표]
{ctx}

지금 지표가 Activation Zone 어디에 있는지 판정하고, 진입/보유/청산 전략과 실행 체크리스트를 제시하라.
막연한 낙관 금지. 수치를 인용해 근거를 대라. 한국어, 투자 권유가 아닌 분석/교육 톤, 간결하게.

{_BR_SCHEMA_HINT}"""


def _call_gemini_sync(api_key: str, prompt: str) -> str:
    from google import genai
    client = genai.Client(api_key=api_key)
    last_err = None
    for model_name in _GEMINI_MODELS:
        try:
            return client.models.generate_content(model=model_name, contents=prompt).text
        except Exception as e:
            if "429" in str(e) or "quota" in str(e).lower():
                last_err = e
                continue
            raise e
    raise last_err or RuntimeError("Gemini 호출에 실패했습니다.")


def _extract_json(text: str) -> dict:
    t = re.sub(r"^```(?:json)?\s*|\s*```$", "", text.strip()).strip()
    try:
        return json.loads(t)
    except Exception:
        m = re.search(r"\{.*\}", t, re.DOTALL)
        if not m:
            raise ValueError("Gemini 응답에서 JSON을 찾지 못했습니다.")
        return json.loads(m.group(0))


async def _build_live_ctx(db: AsyncSession) -> str:
    ipca_row_d, _, _ = await _latest(db, "ipca_mom")
    ipca_m_str = f"{int(ipca_row_d.split('-')[1])}월" if (ipca_row_d and "-" in ipca_row_d) else "최근"
    keys = {"selic_target": "기준금리 Selic(%)", "y5": "5년물 국채금리(%)",
            "brl_krw": "원/헤알 환율(원)", "usd_brl": "USD/BRL",
            "ipca_mom": f"{ipca_m_str} IPCA 월간(%)", "ipca_12m": "IPCA 12개월 누적(%)",
            "focus_selic_eoy": "Focus 연말 Selic 컨센서스(%)",
            "focus_ipca_eoy": "Focus 연말 IPCA 컨센서스(%)"}
    lines = ["[대표 지표 라이브]"]
    vals = {}
    for k, lab in keys.items():
        _, v, _ = await _latest(db, k)
        vals[k] = v
        lines.append(f"- {lab}: {v}")
    if vals.get("selic_target") and vals.get("ipca_12m"):
        lines.append(f"- 실질금리(Selic−IPCA12M): {round(vals['selic_target']-vals['ipca_12m'],2)}%p")
    sig = compute_signal(vals.get("y5"), vals.get("brl_krw"))
    lines.append(f"- 현재 Activation Zone 판정: {sig['grade']} — {sig['headline']}")
    return "\n".join(lines)


class InsightResponse(BaseModel):
    content: dict | None = None
    generated_at: str | None = None


def _is_same_date_kst(dt: datetime | None) -> bool:
    if not dt:
        return False
    now_kst = datetime.now(_KST).date()
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    dt_kst = dt.astimezone(_KST).date()
    return dt_kst == now_kst


@router.get("/insight", response_model=InsightResponse)
async def get_insight(auto_generate: bool = True, db: AsyncSession = Depends(get_db)):
    row = (await db.execute(
        select(SectorInsight).where(SectorInsight.sector == "brazil_bond")
    )).scalar_one_or_none()

    # 기 생성된 리포트가 없거나 이전 날짜인 경우 자동 재생성 (동일 날짜인 경우 skip)
    if auto_generate and (not row or not row.content or not _is_same_date_kst(row.generated_at)):
        api_key = os.environ.get("GEMINI_API_KEY")
        if api_key:
            try:
                print("[brazil_bond] AI strategy report missing or from previous date -> auto-generating...")
                return await generate_insight(db)
            except Exception as e:
                print(f"[brazil_bond] auto-generate insight on GET failed: {e}")

    if not row or not row.content:
        return InsightResponse(content=None, generated_at=None)
    try:
        content = json.loads(row.content)
    except Exception:
        content = None

    gen_at = row.generated_at.isoformat() if row.generated_at else None
    if gen_at and not gen_at.endswith("Z") and "+" not in gen_at and "-" not in gen_at[10:]:
        gen_at += "Z"

    return InsightResponse(content=content, generated_at=gen_at)


@router.post("/insight/generate", response_model=InsightResponse)
async def generate_insight(db: AsyncSession = Depends(get_db)):
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY가 설정되지 않았습니다.")

    ctx = await _build_live_ctx(db)
    prompt = _build_br_prompt(ctx)
    try:
        raw = await asyncio.to_thread(_call_gemini_sync, api_key, prompt)
        content = _extract_json(raw)
    except Exception as e:
        print(f"[brazil_bond] generate error: {e}")
        raise HTTPException(status_code=500, detail=f"리포트 생성 중 오류: {str(e)[:200]}")

    now = datetime.now(timezone.utc)
    row = (await db.execute(
        select(SectorInsight).where(SectorInsight.sector == "brazil_bond")
    )).scalar_one_or_none()
    payload = json.dumps(content, ensure_ascii=False)
    naive_now = now.replace(tzinfo=None)
    if row:
        row.content = payload
        row.generated_at = naive_now
    else:
        db.add(SectorInsight(sector="brazil_bond", content=payload, generated_at=naive_now))
    await db.commit()

    gen_at = now.isoformat()
    if not gen_at.endswith("Z") and "+" not in gen_at:
        gen_at += "Z"
    return InsightResponse(content=content, generated_at=gen_at)


# ── 10월 대선 실시간 정세 & Tranche 3 AI Live Pulse ────────────────────────────
_DEFAULT_ELECTION_PULSE = {
    "headline": "대선 D-3 불확실성 정점… 의회 Centrão 견제 속 시나리오 B(온건 연임) 베이스라인 우세",
    "market_mood": "여론조사 초박빙 접전으로 장기물 금리(5년물 14.28%)가 높은 레벨을 유지하고 있으나, 의회 보수·중도파의 재정 독주 견제 능력에 신뢰를 두며 차분한 관망세를 유지하고 있습니다.",
    "convergence_scenario": {
        "primary": "B",
        "probabilities": {"A": 25, "B": 60, "C": 15},
        "reasoning": "현 금융시장은 룰라 연임 시에도 의회의 Centrão(중도·우파 연합)가 과반 의석으로 급격한 재정 팽창을 저지할 것으로 보아 시나리오 B를 기본 가격에 반영하고 있습니다."
    },
    "live_analysis": "대선 1차 투표(10/5)를 앞두고 정치 테마 노이즈가 고조되고 있습니다. 시장의 최대 관심사는 페르난두 아다지 재무장관의 유임 여부와 신재정프레임워크(Fiscal Anchor)의 준수 의지입니다. 상·하원 선거에서 중도·보수 연합의 과반 유지가 확실시됨에 따라 극단적 좌파 포퓰리즘(시나리오 C)으로 직행할 확률은 15% 수준으로 제한적입니다.",
    "tranche3_action": "잔여 40% 중 20%는 대선 직전 5년물 14.2% 이상 + 환율 260원대 구간에서 1차 선진입하고, 나머지 20%는 1차 투표 결과 확인 후 단기 금리 스파이크(14.5%↑) 또는 불확실성 해소 랠리 확인 시 2차 집행 권장.",
    "recommended_bond_guide": "대선 전후 변동성 방어 및 금리 고점 대응을 위해 투자 성향별 2대 바벨 포트폴리오를 추천합니다: ① 보수·안정형은 '단기 50% + 장기 30% + 달러 20%'로 안정적 인컴을 수취하고, ② 고수익 추구 여유자금형은 '헤알 장기 50% + 헤알 중기 30% + 달러 장기 20%'로 금리 어깨/고점(14.5%↑) 구간에서 듀레이션을 적극 확보하여 대선 후 금리 인하 사이클 도래 시 자본차익(Capital Gain)을 극대화하십시오. (Worst 시나리오가 오더라도 2021년 법제화된 BCB 중앙은행 독립성으로 인해 하방 위험은 제한적입니다)",
    "monitoring_points": [
        "10/5 1차 투표 득표율 격차 및 10/26 결선투표(Runoff) 진출 여부",
        "의회(상·하원) 내 중도·우파 연합(Centrão) 과반 의석(하원 300석↑) 확보율",
        "BCB 중앙은행 독립성 견고성 및 차기 경제팀(재무장관) 인선 신뢰도"
    ]
}


def _build_election_prompt(ctx: str, news_titles: list[str]) -> str:
    news_text = "\n".join([f"- {t}" for t in news_titles[:6]]) if news_titles else "- 수집된 최근 정치/대선 뉴스 없음 (시장 지표 중심 평가)"
    return f"""너는 브라질 국채 및 매크로 정치 리스크 전문 수석 스트래티지스트다.
현재 시점은 2026년 10월 초, 브라질 대통령 선거 1차 투표(10월 5일)를 불과 D-2~D-3일 앞둔 시점이며, 한국인 투자자들은 브라질 국채 3단계 분할 매수의 마지막 단계인 'Tranche 3 (잔여 40% 대선 전후 집행)' 구간에 진입해 있다.

[현재 실시간 브라질 시장 지표]
{ctx}

[최근 브라질 현지 및 글로벌 주요 뉴스]
{news_text}

[브라질 대선 3대 시나리오 체계]
1. 시나리오 A: 중도·우파 정권 교체 (시장 친화적, 금리 100~200bp 하락, 헤알 강세, 채권 판정: Best)
2. 시나리오 B: 현 좌파 온건·실용 연임 (신재정준칙 유지, 금리 중립/완만 하락, 헤알 보합, 채권 판정: Neutral - 기본선)
3. 시나리오 C: 좌파 정권 강경화 (확장 재정 포퓰리즘, 금리 150~250bp 급등, 헤알 약세, 채권 판정: Worst - 단, 2021년 BCB 중앙은행 독립법 및 의회 Centrão 견제로 실질적 하방 방파제 존재)

[추천 브라질 국채 라인업 & 듀레이션 배분 원칙]
- 듀레이션 기술 원칙: 금리가 높은 수준(어깨/고점 14.0~14.5% 이상)이면 장기채를 매수해 듀레이션을 늘리고, 금리가 낮은 수준이면 단기채를 매수해 금리 상승 위험을 방어함.
- 헤알화 2~3년물 (NTN-F 2027~2028): 비과세 연 13~14%대 고금리 쿠폰 락인, 낮은 듀레이션으로 대선 변동성 방어
- 헤알화 5~10년물 (NTN-F 2031~2035): 비과세, 금리 인하 사이클 자본차익(Capital Gain) 극대화 스위트스팟
- 달러화 외화국채 10년물 (Global Bond USD): 헤알화 환율 위험 완전 차단, 미국 국채 대비 200~300bp 스프레드(연 6%대)
- [안정 방어형] 밸런스 바벨: 단기 헤알채(50%) + 장기 헤알채(30%) + 달러 국채(20%) (안정적 비과세 인컴 중심)
- [적극 고수익·여유자금형] 캡/인컴 바벨: 장기 헤알채(50%) + 중기 헤알채(30%) + 달러 장기채(20%) (3~5년 여유자금, 금리 14.5% 고점 듀레이션 확대 & 자본차익 극대화)

너의 임무는 현재 시장 지표와 최신 뉴스, 여론조사 동향을 바탕으로 '현재 실시간 브라질 대선 정세 브리핑 및 Tranche 3 투자자 가이드'를 전문적이고 명쾌하게 작성하는 것이다.

반드시 아래 JSON 포맷으로만 응답하라 (추가 설명이나 마크다운 코드블록 금지):
{{
  "headline": "실시간 정세 핵심 한 줄 요약",
  "market_mood": "현재 금융시장 분위기 1~2문장",
  "convergence_scenario": {{
    "primary": "B",
    "probabilities": {{"A": 25, "B": 60, "C": 15}},
    "reasoning": "왜 현재 시장이 이 시나리오에 무게를 두고 있는지 분석 2문장"
  }},
  "live_analysis": "현재 브라질 현지 정치 상황, 의회 구도(Centrão), 재무장관 거취, 재정 프레임워크 유지 가능성에 대한 심층 분석 (3~4문장)",
  "tranche3_action": "Tranche 3(잔여 40%)에 대한 구체적 실행 액션플랜 (대선 직전 매수 vs 1차 투표 직후 매수 타이밍, 금리 스파이크 14.5% 이상 터치 시 대응법)",
  "recommended_bond_guide": "투자 성향별 최우선 추천 채권 조합 및 비중 (단기채 중심 인컴형 vs 장기채 자본차익형 vs 바벨 분산형 추천 이유)",
  "monitoring_points": [
    "핵심 점검 포인트 1",
    "핵심 점검 포인트 2",
    "핵심 점검 포인트 3"
  ]
}}
"""


def _normalize_pulse_content(content: dict) -> dict:
    """LLM이 dict로 응답한 텍스트 필드를 문자열로 안전하게 정규화하여 React Error #31 방지"""
    if not isinstance(content, dict):
        return content
    res = dict(content)
    for key in ["recommended_bond_guide", "tranche3_action", "live_analysis", "headline", "market_mood"]:
        val = res.get(key)
        if isinstance(val, dict):
            res[key] = " / ".join(f"[{k}] {v}" for k, v in val.items())
        elif isinstance(val, list):
            res[key] = " / ".join(str(item) for item in val)
    return res


@router.get("/election-pulse", response_model=InsightResponse)
async def get_election_pulse(auto_generate: bool = True, db: AsyncSession = Depends(get_db)):
    row = (await db.execute(
        select(SectorInsight).where(SectorInsight.sector == "brazil_election_pulse")
    )).scalar_one_or_none()

    if auto_generate and (not row or not row.content or not _is_same_date_kst(row.generated_at)):
        api_key = os.environ.get("GEMINI_API_KEY")
        if api_key:
            try:
                return await generate_election_pulse(db)
            except Exception as e:
                print(f"[brazil_bond] auto-generate election pulse on GET failed: {e}")

    if not row or not row.content:
        return InsightResponse(content=_DEFAULT_ELECTION_PULSE, generated_at=datetime.now(timezone.utc).isoformat())
    try:
        content = json.loads(row.content)
    except Exception:
        content = _DEFAULT_ELECTION_PULSE

    content = _normalize_pulse_content(content)

    gen_at = row.generated_at.isoformat() if row.generated_at else None
    if gen_at and not gen_at.endswith("Z") and "+" not in gen_at and "-" not in gen_at[10:]:
        gen_at += "Z"
    return InsightResponse(content=content, generated_at=gen_at)


@router.post("/election-pulse/generate", response_model=InsightResponse)
async def generate_election_pulse(db: AsyncSession = Depends(get_db)):
    api_key = os.environ.get("GEMINI_API_KEY")
    ctx = await _build_live_ctx(db)
    
    news_titles = []
    try:
        from core.brazil_news import get_recent_news
        news_items = await get_recent_news(limit=6)
        news_titles = [n.get("title", "") for n in news_items if n.get("title")]
    except Exception as e:
        print(f"[brazil_bond] news fetch for election pulse failed: {e}")

    content = None
    if api_key:
        prompt = _build_election_prompt(ctx, news_titles)
        try:
            raw = await asyncio.to_thread(_call_gemini_sync, api_key, prompt)
            content = _extract_json(raw)
        except Exception as e:
            print(f"[brazil_bond] election pulse generate error: {e}")

    if not content:
        content = _DEFAULT_ELECTION_PULSE

    now = datetime.now(timezone.utc)
    row = (await db.execute(
        select(SectorInsight).where(SectorInsight.sector == "brazil_election_pulse")
    )).scalar_one_or_none()
    payload = json.dumps(content, ensure_ascii=False)
    naive_now = now.replace(tzinfo=None)
    if row:
        row.content = payload
        row.generated_at = naive_now
    else:
        db.add(SectorInsight(sector="brazil_election_pulse", content=payload, generated_at=naive_now))
    await db.commit()

    gen_at = now.isoformat()
    if not gen_at.endswith("Z") and "+" not in gen_at:
        gen_at += "Z"
    return InsightResponse(content=content, generated_at=gen_at)


# ══════════════════════════════════════════════════════════════════════════
# 신호 전환 알림 (스케줄러가 호출) — 등급 변경·임박 캘린더 텔레그램 발송
# ══════════════════════════════════════════════════════════════════════════
async def check_brazil_signal_and_alert():
    """Activation Zone 등급이 직전 저장분과 달라졌거나, COPOM Selic 금리가 변경되었거나, 핵심 캘린더 D-1/D-day면 알림."""
    from core.notifier import send_telegram_message
    from db.database import AsyncSessionLocal

    async with AsyncSessionLocal() as db:
        _, y5, _ = await _latest(db, "y5")
        _, fx, _ = await _latest(db, "brl_krw")
        _, selic, _ = await _latest(db, "selic_target")
        sig = compute_signal(y5, fx)

        # 직전 신호 등급
        state = (await db.execute(
            select(SectorInsight).where(SectorInsight.sector == "brazil_signal_state")
        )).scalar_one_or_none()
        prev_zone = state.content if state else None

        # 직전 Selic 금리
        selic_state = (await db.execute(
            select(SectorInsight).where(SectorInsight.sector == "brazil_selic_state")
        )).scalar_one_or_none()
        try:
            prev_selic = float(selic_state.content) if selic_state and selic_state.content else None
        except Exception:
            prev_selic = None

        today = datetime.now(_KST).date()
        imminent = [c for c in CATALYSTS if 0 <= _d_day(c["date"], today) <= 1]

        msgs = []
        # 1. COPOM 기준금리 변경 감지 핫 알림
        if selic is not None and prev_selic is not None and abs(selic - prev_selic) >= 0.01:
            diff = selic - prev_selic
            direction = "인상 📈" if diff > 0 else "인하 📉"
            msgs.append(
                f"🚨 <b>[COPOM 기준금리 결정 발표]</b>\n"
                f"브라질 기준금리(Selic): <b>{prev_selic:.2f}% ➔ {selic:.2f}%</b> ({diff:+.2f}%p {direction})\n"
                f"Activation Zone: <b>{sig['grade']}</b>\n"
                f"{sig['headline']}\n▶ {sig['action']}"
            )

        # 2. Zone 신호 전환 알림
        if sig["zone"] != prev_zone and sig["zone"] not in ("UNKNOWN",):
            msgs.append(
                f"🇧🇷 <b>브라질 국채 신호 전환</b> → <b>{sig['grade']}</b>\n"
                f"{sig['headline']}\n▶ {sig['action']}"
            )

        # 3. 캘린더 임박 알림 (당일 중복 발송 방지: 하루 1회만 발송)
        notified_catalysts = []
        for c in imminent:
            dd = _d_day(c["date"], today)
            tag = "D-DAY" if dd == 0 else "D-1"
            cal_key = f"brazil_cal_alert_{c['key']}_{tag}_{today.isoformat()}"
            cal_st = (await db.execute(
                select(SectorInsight).where(SectorInsight.sector == cal_key)
            )).scalar_one_or_none()
            if not cal_st:
                msgs.append(f"🗓️ <b>[{tag}] {c['title']}</b> ({c['date']})\n{c['note']}")
                notified_catalysts.append(cal_key)

    # 뉴스 수집만 백그라운드에서 조용히 수행 (단독 뉴스 알림은 발송하지 않고 아침 브리핑에 통합)
    try:
        from core.brazil_news import sync_brazil_news
        await sync_brazil_news(alert_new=False)
    except Exception as e:
        print(f"[brazil_bond] news sync skipped: {e}")

    if msgs:
        ok, _ = await send_telegram_message("\n\n".join(msgs), category="brazil_bond")
        if ok and notified_catalysts:
            async with AsyncSessionLocal() as db:
                now_utc = datetime.now(timezone.utc).replace(tzinfo=None)
                for k in notified_catalysts:
                    db.add(SectorInsight(sector=k, content="1", generated_at=now_utc))
                await db.commit()

    # zone 및 selic 상태 갱신 (새 세션)
    async with AsyncSessionLocal() as db:
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        state = (await db.execute(
            select(SectorInsight).where(SectorInsight.sector == "brazil_signal_state")
        )).scalar_one_or_none()
        if state:
            state.content = sig["zone"]
            state.generated_at = now
        else:
            db.add(SectorInsight(sector="brazil_signal_state", content=sig["zone"], generated_at=now))

        if selic is not None:
            selic_st = (await db.execute(
                select(SectorInsight).where(SectorInsight.sector == "brazil_selic_state")
            )).scalar_one_or_none()
            if selic_st:
                selic_st.content = str(selic)
                selic_st.generated_at = now
            else:
                db.add(SectorInsight(sector="brazil_selic_state", content=str(selic), generated_at=now))

        await db.commit()
    print(f"[brazil_bond] signal check: zone={sig['zone']} prev_zone={prev_zone} selic={selic} prev_selic={prev_selic} alerts={len(msgs)}")


# ══════════════════════════════════════════════════════════════════════════
# 대시보드 지표 텔레그램 브리핑 (매일 아침 + 모든 지표 초록불 전환 시)
# ══════════════════════════════════════════════════════════════════════════
_GAUGE_EMOJI = {"green": "🟢", "amber": "🟡", "red": "🔴", "gray": "⚪"}
_TREND_LABEL = {"strong": "헤알 강세 📈", "weak": "헤알 약세 📉", "flat": "보합 ➖"}


def _collect_gauges(summary: dict) -> list[str]:
    """대시보드 8개 카드의 신호등 색상 목록(원/헤알·5년물·Selic·IPCA·실질금리·Focus 3종)."""
    gauges = [ind.get("gauge", "gray") for ind in summary.get("indicators", [])]
    gauges.append(summary.get("real_rate", {}).get("gauge", "gray"))
    f = summary.get("focus", {})
    gauges += [f.get("selic_eoy_gauge", "gray"), f.get("ipca_eoy_gauge", "gray"), f.get("usdbrl_eoy_gauge", "gray")]
    return gauges


def build_brazil_dashboard_message(summary: dict, header_note: str | None = None, news_items: list[dict] | None = None) -> str:
    """대시보드 카드와 동일한 지표 내용 및 주요 뉴스를 아침 브리핑 텔레그램(HTML) 메시지로 구성한다."""
    sig = summary.get("signal", {})
    as_of = summary.get("as_of", "")

    def _fmt(v, d=2):
        return "—" if v is None else f"{v:,.{d}f}"

    lines = []
    if header_note:
        lines.append(header_note)
    lines.append(f"🇧🇷 <b>브라질 국채 대시보드</b> ({as_of})")
    lines.append(f"Activation Zone: <b>{sig.get('grade','—')}</b>")
    if sig.get("headline"):
        lines.append(sig["headline"])
    lines.append("")
    lines.append("📊 <b>매크로 지표 현황</b>")
    for ind in summary.get("indicators", []):
        emoji = _GAUGE_EMOJI.get(ind.get("gauge", "gray"), "⚪")
        unit = ind.get("unit", "")
        d = 1 if unit == "원" else 2
        live = " · 실시간" if ind.get("live") else (f" ({ind['date']})" if ind.get("date") else "")
        lines.append(f"{emoji} {ind['label']}: <b>{_fmt(ind['value'], d)}{unit}</b>{live}")
    rr = summary.get("real_rate", {})
    lines.append(f"{_GAUGE_EMOJI.get(rr.get('gauge','gray'),'⚪')} {rr.get('label','실질금리')}: <b>{_fmt(rr.get('value'))}{rr.get('unit','')}</b>"
                 + (f" ({rr['date']})" if rr.get("date") else ""))
    f = summary.get("focus", {})
    lines.append(f"{_GAUGE_EMOJI.get(f.get('selic_eoy_gauge','gray'),'⚪')} Focus 연말 Selic: <b>{_fmt(f.get('selic_eoy'))}%</b>")
    lines.append(f"{_GAUGE_EMOJI.get(f.get('ipca_eoy_gauge','gray'),'⚪')} Focus 연말 IPCA: <b>{_fmt(f.get('ipca_eoy'))}%</b>")
    lines.append(f"{_GAUGE_EMOJI.get(f.get('usdbrl_eoy_gauge','gray'),'⚪')} Focus 연말 USD/BRL: <b>{_fmt(f.get('usdbrl_eoy'))}</b>")

    ub = summary.get("usd_brl", {})
    if ub.get("value") is not None:
        trend = _TREND_LABEL.get(ub.get("brl_trend", "flat"), "")
        lines.append(f"💵 달러/헤알(USD/BRL): <b>{_fmt(ub.get('value'), 4)}</b> · {trend}")

    if sig.get("action"):
        lines.append("")
        lines.append(f"▶ {sig['action']}")

    if news_items:
        lines.append("")
        lines.append("📰 <b>전일~당일 주요 뉴스</b>")
        for it in news_items:
            lines.append(f"• <a href=\"{it['link']}\">{it['title']}</a> ({it['source']})")

    lines.append("")
    lines.append("🔗 <a href='https://etf-lens.vercel.app'>etf-lens.vercel.app</a>")
    return "\n".join(lines)


async def _build_summary_for_alert() -> dict:
    """알림용 대시보드 요약. get_summary 로직을 자체 세션으로 재사용."""
    from db.database import AsyncSessionLocal
    async with AsyncSessionLocal() as db:
        return await get_summary(db=db)


async def send_brazil_dashboard_digest() -> None:
    """매일 아침 대시보드 지표 브리핑 및 전일~당일 뉴스를 텔레그램으로 발송(카테고리 brazil_bond)."""
    from core.notifier import send_telegram_message
    try:
        summary = await _build_summary_for_alert()
        news_items = []
        try:
            from core.brazil_news import sync_brazil_news, get_recent_news_since_yesterday
            await sync_brazil_news(alert_new=False)
            news_items = await get_recent_news_since_yesterday()
        except Exception as ne:
            print(f"[brazil_bond] news sync for digest failed: {ne}")

        msg = build_brazil_dashboard_message(summary, header_note="☀️ <b>[브라질 국채 아침 브리핑]</b>", news_items=news_items)
        ok, _ = await send_telegram_message(msg, category="brazil_bond")
        print(f"[brazil_bond] daily digest sent: {ok}")
    except Exception as e:
        print(f"[brazil_bond] daily digest failed: {e}")


def _collect_core_gauges(summary: dict) -> list[str]:
    """핵심 지표(Current Market Dashboard 메인 4종: 기준금리·5년물·원/헤알·IPCA m/m) 신호등."""
    return [ind.get("gauge", "gray") for ind in summary.get("indicators", [])]


def _all_green(gauges: list[str]) -> bool:
    return bool(gauges) and all(g == "green" for g in gauges)


async def _read_green_state(db, key: str) -> bool:
    row = (await db.execute(
        select(SectorInsight).where(SectorInsight.sector == key)
    )).scalar_one_or_none()
    return (row.content == "1") if row else False


async def _write_green_state(db, key: str, val: bool) -> None:
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    row = (await db.execute(
        select(SectorInsight).where(SectorInsight.sector == key)
    )).scalar_one_or_none()
    content = "1" if val else "0"
    if row:
        row.content = content
        row.generated_at = now
    else:
        db.add(SectorInsight(sector=key, content=content, generated_at=now))


async def check_brazil_all_green_and_alert() -> None:
    """핵심 지표(메인 4종) 또는 전체 지표(8종)가 초록불로 '전환'될 때만 알림 발송.
    반복 발송 방지를 위해 SectorInsight 에 상태('1'/'0') 저장.
    - 전체 초록 전환: '모든 지표 초록불' 메시지.
    - (전체 전환이 아닐 때) 핵심만 초록 전환: '핵심 지표 초록불' 메시지."""
    from core.notifier import send_telegram_message
    from db.database import AsyncSessionLocal
    try:
        summary = await _build_summary_for_alert()
    except Exception as e:
        print(f"[brazil_bond] green check: summary failed: {e}")
        return

    core_green = _all_green(_collect_core_gauges(summary))
    full_green = _all_green(_collect_gauges(summary))

    async with AsyncSessionLocal() as db:
        prev_core = await _read_green_state(db, "brazil_core_green_state")
        prev_full = await _read_green_state(db, "brazil_all_green_state")

        msg = None
        if full_green and not prev_full:
            msg = build_brazil_dashboard_message(
                summary, header_note="🟢 <b>[모든 지표 초록불!]</b> 진입 조건이 완전히 정렬되었습니다.")
        elif core_green and not prev_core:
            msg = build_brazil_dashboard_message(
                summary, header_note="🟢 <b>[핵심 지표 초록불]</b> 금리·환율 등 핵심 지표가 진입 우호적입니다.")
        if msg:
            ok, _ = await send_telegram_message(msg, category="brazil_bond")
            print(f"[brazil_bond] green transition alert sent: {ok}")

        await _write_green_state(db, "brazil_core_green_state", core_green)
        await _write_green_state(db, "brazil_all_green_state", full_green)
        await db.commit()
    print(f"[brazil_bond] green check: core={core_green}(prev {prev_core}) full={full_green}(prev {prev_full})")


class _TestDigestSchema(BaseModel):
    telegram_token: str
    telegram_chat_id: str


@router.post("/test-digest")
async def test_digest(data: _TestDigestSchema, db: AsyncSession = Depends(get_db)):
    """현재 대시보드 지표 값으로 구성한 브리핑을 지정된(테스트) 텔레그램으로 즉시 발송."""
    from core.notifier import send_telegram_message
    from db.models import NotificationSettings

    token = data.telegram_token
    if "******" in token:  # 마스킹된 토큰이면 DB에서 원본 조회
        res = await db.execute(
            select(NotificationSettings).where(NotificationSettings.telegram_chat_id == data.telegram_chat_id)
        )
        s = res.scalars().first()
        if s and s.telegram_token:
            token = s.telegram_token
        else:
            raise HTTPException(status_code=400, detail="저장된 토큰이 없습니다. 먼저 토큰을 입력해 주세요.")

    summary = await get_summary(db=db)
    msg = build_brazil_dashboard_message(summary, header_note="🧪 <b>[테스트] 브라질 국채 대시보드</b>")
    ok, err = await send_telegram_message(msg, force=True, test_token=token, test_chat_id=data.telegram_chat_id)
    if not ok:
        raise HTTPException(status_code=400, detail=f"전송 실패: {err}")
    return {"status": "success", "msg": "현재 지표 값으로 테스트 브리핑을 발송했습니다."}
