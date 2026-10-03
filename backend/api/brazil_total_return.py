"""브라질 국채 토탈리턴(Total Return) 시뮬레이터 API.

NTN-F(이표채) 및 LTN(할인채)의 만기/보유기간별
- 이자수익(반기 10% 연복리 재투자)
- 금리 변동에 따른 자본차익/손실 (Dirty Price & Modified Duration)
- 원/헤알 환율 변동 및 손익분기 환율(Breakeven FX)
- 거래비용/과세 차감 후 최종 원화 수익률/CAGR
- 금리-환율 2차원 시나리오 스트레스 매트릭스를 제공합니다.
"""
from __future__ import annotations

from typing import Literal
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import get_db
from core.brazil_total_return import TRParams, simulate

router = APIRouter()


class TRSimulateRequest(BaseModel):
    invest_krw: float = Field(default=10_000_000, description="투자원금(원)")
    bond_type: Literal["ntnf", "ltn"] = Field(default="ntnf", description="채권 종류 (ntnf: 10% 이표채, ltn: 제로쿠폰 할인채)")
    maturity_years: float = Field(default=7.0, ge=0.25, le=30.0, description="매수 시점 잔존만기(년)")
    coupon_rate: float = Field(default=10.0, ge=0.0, le=20.0, description="연 쿠폰이자율(%, NTN-F 기본 10%)")
    entry_yield: float = Field(default=14.0, ge=0.5, le=35.0, description="진입/매수 금리(%)")
    exit_yield: float = Field(default=12.0, ge=0.5, le=35.0, description="종료/매도 시점 시장금리(%)")
    holding_years: float = Field(default=5.0, ge=0.25, le=30.0, description="투자기간/보유기간(년, ≤ 잔존만기)")
    entry_fx: float = Field(default=260.0, ge=50.0, le=600.0, description="진입 시 원/헤알 환율(원)")
    fx_change_pct: float = Field(default=0.0, ge=-90.0, le=200.0, description="보유 종료 시 환율 변동률(%)")
    reinvest_rate: float | None = Field(default=None, description="쿠폰 재투자 수익률(%, None이면 (진입+종료)/2)")
    buy_cost_pct: float = Field(default=1.0, ge=0.0, le=10.0, description="매수 스프레드/수수료(%)")
    sell_cost_pct: float = Field(default=0.5, ge=0.0, le=10.0, description="매도 스프레드/수수료(%) (만기상환 시 0%)")
    tax_rate_pct: float = Field(default=0.0, ge=0.0, le=50.0, description="이자소득세율(%, 한-브라질 조세조약 비과세 기본 0%)")


PRESETS = [
    {
        "id": "income_hold",
        "title": "만기보유 고쿠폰 인컴형",
        "badge": "안정/인컴",
        "desc": "NTN-F 7년 만기를 끝까지 보유하며 매 반기 연 10% 쿠폰을 수령·재투자. 환율 변동 0% 가정 시 고금리 복리 효과를 극대화합니다.",
        "params": {
            "bond_type": "ntnf",
            "maturity_years": 7.0,
            "coupon_rate": 10.0,
            "entry_yield": 14.0,
            "exit_yield": 14.0,
            "holding_years": 7.0,
            "fx_change_pct": 0.0,
            "buy_cost_pct": 1.0,
            "sell_cost_pct": 0.0,
            "tax_rate_pct": 0.0,
        },
    },
    {
        "id": "capital_gain_peakout",
        "title": "금리 피크아웃 자본차익형",
        "badge": "자본차익",
        "desc": "10년 장기채를 14.0% 고금리에 진입 후 3년 내 금리가 11.0%(-300bp)로 피크아웃 하락할 때 조기 매도하여 높은 자본차익을 실현합니다.",
        "params": {
            "bond_type": "ntnf",
            "maturity_years": 10.0,
            "coupon_rate": 10.0,
            "entry_yield": 14.0,
            "exit_yield": 11.0,
            "holding_years": 3.0,
            "fx_change_pct": 0.0,
            "buy_cost_pct": 1.0,
            "sell_cost_pct": 0.5,
            "tax_rate_pct": 0.0,
        },
    },
    {
        "id": "fx_stress_test",
        "title": "헤알화 약세 스트레스 방어형",
        "badge": "리스크 점검",
        "desc": "헤알화 환율이 -20% 급락하는 악조건 속에서도 5년간 누적되는 10% 쿠폰 수익이 환차손을 얼마나 상쇄하고 원금을 방어하는지 점검합니다.",
        "params": {
            "bond_type": "ntnf",
            "maturity_years": 7.0,
            "coupon_rate": 10.0,
            "entry_yield": 14.0,
            "exit_yield": 14.0,
            "holding_years": 5.0,
            "fx_change_pct": -20.0,
            "buy_cost_pct": 1.0,
            "sell_cost_pct": 0.5,
            "tax_rate_pct": 0.0,
        },
    },
    {
        "id": "aggressive_barbell",
        "title": "14.5% 어깨 적극 바벨형",
        "badge": "고수익 추구",
        "desc": "대선 전후 10년 국채가 14.5% 어깨 고금리에 도달할 때 듀레이션을 확대 진입. 4년 후 12.0% 정상화 및 환율 +5% 반등 시 고수익을 겨냥합니다.",
        "params": {
            "bond_type": "ntnf",
            "maturity_years": 10.0,
            "coupon_rate": 10.0,
            "entry_yield": 14.5,
            "exit_yield": 12.0,
            "holding_years": 4.0,
            "fx_change_pct": 5.0,
            "buy_cost_pct": 1.0,
            "sell_cost_pct": 0.5,
            "tax_rate_pct": 0.0,
        },
    },
    {
        "id": "ltn_discount",
        "title": "LTN 할인채 단기 트레이딩형",
        "badge": "단기/무이표",
        "desc": "쿠폰 지급 없는 제로쿠폰 LTN(2년)을 할인 가격으로 매입하여 만기까지 단기 확정 수익을 획득합니다.",
        "params": {
            "bond_type": "ltn",
            "maturity_years": 2.0,
            "coupon_rate": 0.0,
            "entry_yield": 13.5,
            "exit_yield": 13.5,
            "holding_years": 2.0,
            "fx_change_pct": 0.0,
            "buy_cost_pct": 0.8,
            "sell_cost_pct": 0.0,
            "tax_rate_pct": 0.0,
        },
    },
]


@router.post("/total-return/simulate")
async def run_simulation(req: TRSimulateRequest):
    """지정된 파라미터로 브라질 국채 토탈리턴(총수익, CAGR, 현금흐름, 시나리오 매트릭스)을 시뮬레이션합니다."""
    params = TRParams(
        invest_krw=req.invest_krw,
        bond_type=req.bond_type,
        maturity_years=req.maturity_years,
        coupon_rate=req.coupon_rate,
        entry_yield=req.entry_yield,
        exit_yield=req.exit_yield,
        holding_years=min(req.holding_years, req.maturity_years),
        entry_fx=req.entry_fx,
        fx_change_pct=req.fx_change_pct,
        reinvest_rate=req.reinvest_rate,
        buy_cost_pct=req.buy_cost_pct,
        sell_cost_pct=req.sell_cost_pct,
        tax_rate_pct=req.tax_rate_pct,
    )
    result = simulate(params)
    return {"status": "success", "data": result}


@router.get("/total-return/presets")
async def get_presets():
    """시뮬레이터 프리셋 목록 반환."""
    return {"status": "success", "presets": PRESETS}


@router.get("/total-return/defaults")
async def get_defaults(db: AsyncSession = Depends(get_db)):
    """현재 시장 라이브 지표를 반영한 기본 시뮬레이션 파라미터를 반환합니다."""
    live_y5 = 14.0
    live_fx = 260.0
    try:
        from api.brazil_bond import _latest
        _, y5_val, _ = await _latest(db, "y5")
        if y5_val:
            live_y5 = round(float(y5_val), 2)
        _, fx_val, _ = await _latest(db, "brl_krw")
        if fx_val:
            live_fx = round(float(fx_val), 1)
    except Exception as e:
        print(f"[total-return] load defaults failed: {e}")

    default_req = TRSimulateRequest(
        entry_yield=live_y5,
        exit_yield=max(live_y5 - 2.0, 10.0),
        entry_fx=live_fx,
    )
    return {
        "status": "success",
        "defaults": default_req.model_dump(),
        "live_indicators": {
            "y5_yield": live_y5,
            "brl_krw": live_fx,
        },
        "presets": PRESETS,
    }
