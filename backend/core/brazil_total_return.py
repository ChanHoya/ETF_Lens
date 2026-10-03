"""브라질 국채(NTN-F / LTN) 원화 기준 토탈리턴 계산 엔진.

수익 = 쿠폰 + 쿠폰 재투자 + 자본차익(금리 변동·풀투파) + 환율 효과 − 비용/세금.
- 액면 1,000 BRL, NTN-F 연 10% 쿠폰(반기 지급), LTN 제로쿠폰.
- 가격은 연복리 할인 근사: P = Σ c/(1+y)^t + 1000/(1+y)^T
"""
from __future__ import annotations

from dataclasses import dataclass, asdict

FACE = 1000.0


@dataclass
class TRParams:
    invest_krw: float = 10_000_000
    bond_type: str = "ntnf"           # ntnf | ltn
    maturity_years: float = 7.0       # 매수 시점 잔존만기(년)
    coupon_rate: float = 10.0         # NTN-F 연 쿠폰(%)
    entry_yield: float = 14.0         # 매수 금리(%)
    exit_yield: float = 12.0          # 매도 시점 금리(%)
    holding_years: float = 5.0        # 보유기간(년, ≤ 만기)
    entry_fx: float = 260.0           # 원/헤알
    fx_change_pct: float = 0.0        # 보유 종료 시 환율 변동(%)
    reinvest_rate: float | None = None  # 쿠폰 재투자율(%) None → (진입+종료)/2
    buy_cost_pct: float = 1.0         # 매수 스프레드/수수료(%)
    sell_cost_pct: float = 0.5        # 매도 스프레드/수수료(%)
    tax_rate_pct: float = 0.0         # 이자 과세율(%)


def coupon_per_period(bond_type: str, coupon_rate: float) -> float:
    if bond_type != "ntnf":
        return 0.0
    return FACE * ((1 + coupon_rate / 100) ** 0.5 - 1)


def coupon_times(maturity: float) -> list[float]:
    """현재 기준 쿠폰 지급 시점(년). 만기에서 0.5년씩 역산해 0 초과분만."""
    times, t = [], maturity
    while t > 1e-9:
        times.append(round(t, 10))
        t -= 0.5
    return sorted(times)


def bond_price(y_pct: float, remaining: float, bond_type: str, coupon_rate: float) -> float:
    """잔존 remaining 년, 금리 y% 의 1,000 BRL 액면 가격(경과이자 포함 dirty 근사)."""
    if remaining <= 1e-9:
        return FACE
    y = y_pct / 100
    c = coupon_per_period(bond_type, coupon_rate)
    pv = FACE / (1 + y) ** remaining
    if c:
        pv += sum(c / (1 + y) ** t for t in coupon_times(remaining))
    return pv


def modified_duration(y_pct: float, remaining: float, bond_type: str, coupon_rate: float) -> float:
    y = y_pct / 100
    c = coupon_per_period(bond_type, coupon_rate)
    p = bond_price(y_pct, remaining, bond_type, coupon_rate)
    flows = [(t, c) for t in coupon_times(remaining)] if c else []
    flows.append((remaining, FACE))
    mac = sum(t * cf / (1 + y) ** t for t, cf in flows) / p
    return mac / (1 + y)


def _core(p: TRParams, exit_yield: float, exit_fx: float) -> dict:
    T = max(p.maturity_years, 0.25)
    H = min(max(p.holding_years, 0.25), T)
    held_to_maturity = H >= T - 1e-9
    r = (p.reinvest_rate if p.reinvest_rate is not None else (p.entry_yield + exit_yield) / 2) / 100

    b0 = p.invest_krw / p.entry_fx                       # 비용 전 BRL
    buy_cost = b0 * p.buy_cost_pct / 100
    p0 = bond_price(p.entry_yield, T, p.bond_type, p.coupon_rate)
    units = (b0 - buy_cost) / p0

    c = coupon_per_period(p.bond_type, p.coupon_rate) * units
    tax_keep = 1 - p.tax_rate_pct / 100
    received = [t for t in coupon_times(T) if t <= H + 1e-9] if c > 0 else []
    coupon_gross = c * len(received)
    coupon_net = coupon_gross * tax_keep
    coupon_fv = sum(c * tax_keep * (1 + r) ** (H - t) for t in received)
    tax = coupon_gross - coupon_net

    if held_to_maturity:
        exit_gross, sell_cost = FACE * units, 0.0
    else:
        exit_gross = bond_price(exit_yield, T - H, p.bond_type, p.coupon_rate) * units
        sell_cost = exit_gross * p.sell_cost_pct / 100
    exit_net = exit_gross - sell_cost

    brl_final = coupon_fv + exit_net
    krw_final = brl_final * exit_fx
    return {
        "T": T, "H": H, "held_to_maturity": held_to_maturity, "reinvest_rate": r * 100,
        "b0": b0, "p0": p0, "units": units, "buy_cost": buy_cost, "sell_cost": sell_cost, "tax": tax,
        "coupon_net": coupon_net, "reinvest_gain": coupon_fv - coupon_net, "coupon_count": len(received),
        "capital_gain": exit_gross - units * p0, "exit_gross": exit_gross,
        "brl_final": brl_final, "krw_final": krw_final,
    }


def simulate(p: TRParams) -> dict:
    exit_fx = p.entry_fx * (1 + p.fx_change_pct / 100)
    core = _core(p, p.exit_yield, exit_fx)
    H, T = core["H"], core["T"]
    e0 = p.entry_fx

    brl_ret = core["brl_final"] / core["b0"] - 1
    krw_ret = core["krw_final"] / p.invest_krw - 1
    cagr = lambda x: ((1 + x) ** (1 / H) - 1) * 100 if 1 + x > 0 else -100.0

    breakdown = {  # 원화 기준 손익 기여
        "coupon": core["coupon_net"] * e0,
        "reinvest": core["reinvest_gain"] * e0,
        "capital": core["capital_gain"] * e0,
        "costs": -(core["buy_cost"] + core["sell_cost"]) * e0,
        "tax": -core["tax"] * e0,
        "fx": core["brl_final"] * (exit_fx - e0),
    }
    breakeven_fx = p.invest_krw / core["brl_final"] if core["brl_final"] > 0 else None

    # 반기 가치 경로 (금리 선형, 환율 기하 보간)
    path, steps = [], max(1, int(round(H / 0.5)))
    c_unit = coupon_per_period(p.bond_type, p.coupon_rate) * (1 - p.tax_rate_pct / 100)
    r = core["reinvest_rate"] / 100
    for i in range(steps + 1):
        t = H * i / steps
        frac = t / H
        y_t = p.entry_yield + (p.exit_yield - p.entry_yield) * frac
        fx_t = e0 * (exit_fx / e0) ** frac
        cash = sum(c_unit * core["units"] * (1 + r) ** (t - ct) for ct in coupon_times(T) if ct <= t + 1e-9)
        bond_val = (FACE if t >= T - 1e-9 else bond_price(y_t, T - t, p.bond_type, p.coupon_rate)) * core["units"]
        brl_v = cash + bond_val
        path.append({"t": round(t, 2), "yield": round(y_t, 3), "fx": round(fx_t, 2),
                     "brl_value": round(brl_v, 2), "krw_value": round(brl_v * fx_t),
                     "krw_principal": round(p.invest_krw)})

    # 시나리오 매트릭스 (종료금리 × 환율변동)
    yield_offsets = [-300, -200, -100, 0, 100, 200, 300]
    fx_changes = [-30, -20, -10, 0, 10, 20]
    matrix = []
    for off in yield_offsets:
        y1 = max(p.entry_yield + off / 100, 0.5)
        row = []
        for fc in fx_changes:
            k = _core(p, y1, e0 * (1 + fc / 100))
            row.append(round((k["krw_final"] / p.invest_krw - 1) * 100, 1))
        matrix.append({"exit_yield": round(y1, 2), "returns": row})

    return {
        "params": asdict(p),
        "summary": {
            "entry_price": round(core["p0"], 2),
            "units": round(core["units"], 4),
            "brl_invested": round(core["b0"] - core["buy_cost"], 2),
            "coupon_count": core["coupon_count"],
            "held_to_maturity": core["held_to_maturity"],
            "holding_years": round(H, 2),
            "exit_fx": round(exit_fx, 2),
            "reinvest_rate": round(core["reinvest_rate"], 2),
            "brl_final": round(core["brl_final"], 2),
            "krw_final": round(core["krw_final"]),
            "krw_profit": round(core["krw_final"] - p.invest_krw),
            "brl_return_pct": round(brl_ret * 100, 2),
            "krw_return_pct": round(krw_ret * 100, 2),
            "brl_cagr_pct": round(cagr(brl_ret), 2),
            "krw_cagr_pct": round(cagr(krw_ret), 2),
            "breakeven_fx": round(breakeven_fx, 2) if breakeven_fx else None,
            "breakeven_fx_change_pct": round((breakeven_fx / e0 - 1) * 100, 1) if breakeven_fx else None,
            "modified_duration": round(modified_duration(p.entry_yield, T, p.bond_type, p.coupon_rate), 2),
        },
        "breakdown": {k: round(v) for k, v in breakdown.items()},
        "path": path,
        "matrix": {"yield_offsets_bp": yield_offsets, "fx_changes_pct": fx_changes, "rows": matrix},
    }
