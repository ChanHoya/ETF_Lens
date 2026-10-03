'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
    Calculator, ShieldCheck, TrendingUp, DollarSign,
    Percent, RefreshCw, Sparkles, Layers,
    CheckCircle2, ArrowRight
} from 'lucide-react';
import {
    ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip
} from 'recharts';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const FACE = 1000.0;

// ── 핵심 금융 수학 유틸 ──────────────────────────────────────────
function couponPerPeriod(bondType: string, couponRate: number) {
    if (bondType !== 'ntnf') return 0.0;
    return FACE * (Math.pow(1 + couponRate / 100, 0.5) - 1);
}

function couponTimes(maturity: number): number[] {
    const times: number[] = [];
    let t = maturity;
    while (t > 1e-9) {
        times.push(Math.round(t * 1e6) / 1e6);
        t -= 0.5;
    }
    return times.sort((a, b) => a - b);
}

function bondPrice(yPct: number, remaining: number, bondType: string, couponRate: number): number {
    if (remaining <= 1e-9) return FACE;
    const y = yPct / 100;
    const c = couponPerPeriod(bondType, couponRate);
    let pv = FACE / Math.pow(1 + y, remaining);
    if (c > 0) {
        const times = couponTimes(remaining);
        for (const t of times) {
            pv += c / Math.pow(1 + y, t);
        }
    }
    return pv;
}

function modifiedDuration(yPct: number, remaining: number, bondType: string, couponRate: number): number {
    const y = yPct / 100;
    const c = couponPerPeriod(bondType, couponRate);
    const p = bondPrice(yPct, remaining, bondType, couponRate);
    const flows: [number, number][] = c > 0 ? couponTimes(remaining).map(t => [t, c]) : [];
    flows.push([remaining, FACE]);
    const mac = flows.reduce((sum, [t, cf]) => sum + (t * cf) / Math.pow(1 + y, t), 0) / p;
    return mac / (1 + y);
}

interface SimulatorProps {
    initialFx?: number;
    initialYield?: number;
}

export default function BrazilTotalReturnSimulator({ initialFx = 260.0, initialYield = 14.0 }: SimulatorProps) {
    // ── 상태 ──────────────────────────────────────────────────────────
    const [investKrw, setInvestKrw] = useState<number>(10_000_000);
    const [bondType, setBondType] = useState<'ntnf' | 'ltn'>('ntnf');
    const [maturityYears, setMaturityYears] = useState<number>(7.0);
    const [couponRate, setCouponRate] = useState<number>(10.0);
    const [entryYield, setEntryYield] = useState<number>(initialYield);
    const [exitYield, setExitYield] = useState<number>(Math.max(initialYield - 2.0, 10.0));
    const [holdingYears, setHoldingYears] = useState<number>(5.0);
    const [entryFx, setEntryFx] = useState<number>(initialFx);
    const [fxChangePct, setFxChangePct] = useState<number>(0.0);
    const [customReinvestRate, setCustomReinvestRate] = useState<number | null>(null);
    const [buyCostPct, setBuyCostPct] = useState<number>(1.0);
    const [sellCostPct, setSellCostPct] = useState<number>(0.5);
    const [taxRatePct, setTaxRatePct] = useState<number>(0.0);
    const [activePreset, setActivePreset] = useState<string>('income_hold');

    // 만기 연동 보정
    useEffect(() => {
        if (holdingYears > maturityYears) {
            setHoldingYears(maturityYears);
        }
    }, [maturityYears, holdingYears]);

    // 프리셋 데이터
    const presets = [
        {
            id: 'income_hold',
            label: '만기보유 인컴형',
            badge: '안정·고쿠폰',
            color: 'border-emerald-500/40 text-emerald-300 bg-emerald-500/10',
            desc: 'NTN-F 7년 만기까지 보유하며 연 10% 쿠폰 재투자. 환율 0% 유지 시 복리 극대화.',
            apply: () => {
                setBondType('ntnf');
                setMaturityYears(7.0);
                setCouponRate(10.0);
                setEntryYield(14.0);
                setExitYield(14.0);
                setHoldingYears(7.0);
                setFxChangePct(0.0);
                setSellCostPct(0.0);
                setActivePreset('income_hold');
            }
        },
        {
            id: 'capital_gain',
            label: '금리 피크아웃 자본차익형',
            badge: '자본차익',
            color: 'border-cyan-500/40 text-cyan-300 bg-cyan-500/10',
            desc: '10년 장기채 14% 매수 후 3년 내 11%(-300bp)로 금리 급락 시 조기 매도 자본차익.',
            apply: () => {
                setBondType('ntnf');
                setMaturityYears(10.0);
                setCouponRate(10.0);
                setEntryYield(14.0);
                setExitYield(11.0);
                setHoldingYears(3.0);
                setFxChangePct(0.0);
                setSellCostPct(0.5);
                setActivePreset('capital_gain');
            }
        },
        {
            id: 'fx_stress',
            label: '헤알화 약세 스트레스 방어',
            badge: '리스크 점검',
            color: 'border-rose-500/40 text-rose-300 bg-rose-500/10',
            desc: '원/헤알 환율이 -20% 급락해도 5년간 10% 쿠폰이 손실을 방어하는지 시뮬레이션.',
            apply: () => {
                setBondType('ntnf');
                setMaturityYears(7.0);
                setCouponRate(10.0);
                setEntryYield(14.0);
                setExitYield(14.0);
                setHoldingYears(5.0);
                setFxChangePct(-20.0);
                setSellCostPct(0.5);
                setActivePreset('fx_stress');
            }
        },
        {
            id: 'barbell_145',
            label: '14.5% 어깨 적극 바벨형',
            badge: '고수익 추구',
            color: 'border-amber-500/40 text-amber-300 bg-amber-500/10',
            desc: '14.5% 어깨 금리 진입 후 4년 뒤 12.0% 정상화 및 헤알화 +5% 반등 시 고수익.',
            apply: () => {
                setBondType('ntnf');
                setMaturityYears(10.0);
                setCouponRate(10.0);
                setEntryYield(14.5);
                setExitYield(12.0);
                setHoldingYears(4.0);
                setFxChangePct(5.0);
                setSellCostPct(0.5);
                setActivePreset('barbell_145');
            }
        },
        {
            id: 'ltn_discount',
            label: 'LTN 할인채 단기 트레이딩',
            badge: '단기·무이표',
            color: 'border-purple-500/40 text-purple-300 bg-purple-500/10',
            desc: '2년 만기 할인채(LTN)를 할인된 가격에 매입하여 만기까지 확정 수익 실현.',
            apply: () => {
                setBondType('ltn');
                setMaturityYears(2.0);
                setCouponRate(0.0);
                setEntryYield(13.5);
                setExitYield(13.5);
                setHoldingYears(2.0);
                setFxChangePct(0.0);
                setSellCostPct(0.0);
                setActivePreset('ltn_discount');
            }
        },
    ];

    // ── 연산 로직 (클라이언트 고속 반응) ─────────────────────────────
    const sim = useMemo(() => {
        const T = Math.max(maturityYears, 0.25);
        const H = Math.min(Math.max(holdingYears, 0.25), T);
        const heldToMaturity = H >= T - 1e-9;
        const reinvestRate = (customReinvestRate !== null ? customReinvestRate : (entryYield + exitYield) / 2) / 100;
        const exitFx = entryFx * (1 + fxChangePct / 100);

        const b0 = investKrw / entryFx;
        const buyCost = b0 * (buyCostPct / 100);
        const p0 = bondPrice(entryYield, T, bondType, couponRate);
        const units = (b0 - buyCost) / p0;

        const c = couponPerPeriod(bondType, couponRate) * units;
        const taxKeep = 1 - taxRatePct / 100;
        const allTimes = couponTimes(T);
        const received = allTimes.filter(t => t <= H + 1e-9);

        const couponGross = c * received.length;
        const couponNet = couponGross * taxKeep;
        const couponFv = received.reduce((acc, t) => acc + (c * taxKeep) * Math.pow(1 + reinvestRate, H - t), 0);
        const tax = couponGross - couponNet;

        let exitGross = 0;
        let sellCost = 0;
        if (heldToMaturity) {
            exitGross = FACE * units;
            sellCost = 0;
        } else {
            exitGross = bondPrice(exitYield, T - H, bondType, couponRate) * units;
            sellCost = exitGross * (sellCostPct / 100);
        }
        const exitNet = exitGross - sellCost;

        const brlFinal = couponFv + exitNet;
        const krwFinal = brlFinal * exitFx;
        const krwProfit = krwFinal - investKrw;

        const brlRet = brlFinal / b0 - 1;
        const krwRet = krwFinal / investKrw - 1;

        const cagr = (x: number) => (x > -1 ? (Math.pow(1 + x, 1 / H) - 1) * 100 : -100.0);
        const brlCagr = cagr(brlRet);
        const krwCagr = cagr(krwRet);

        const breakevenFx = brlFinal > 0 ? investKrw / brlFinal : 0;
        const breakevenChangePct = (breakevenFx / entryFx - 1) * 100;

        const modDur = modifiedDuration(entryYield, T, bondType, couponRate);

        // 수익 분해 (원화 환산)
        const reinvestGain = couponFv - couponNet;
        const capitalGain = exitGross - units * p0;
        const breakdown = {
            couponNet: couponNet * entryFx,
            reinvestGain: reinvestGain * entryFx,
            capitalGain: capitalGain * entryFx,
            costs: -(buyCost + sellCost) * entryFx,
            tax: -tax * entryFx,
            fx: brlFinal * (exitFx - entryFx),
        };

        // 반기 경로
        const steps = Math.max(1, Math.round(H / 0.5));
        const path = [];
        const cUnit = couponPerPeriod(bondType, couponRate) * taxKeep;
        for (let i = 0; i <= steps; i++) {
            const t = (H * i) / steps;
            const frac = H > 0 ? t / H : 0;
            const y_t = entryYield + (exitYield - entryYield) * frac;
            const fx_t = entryFx * Math.pow(exitFx / entryFx, frac);
            const cash = allTimes.filter(ct => ct <= t + 1e-9).reduce((acc, ct) => acc + (cUnit * units) * Math.pow(1 + reinvestRate, t - ct), 0);
            const bVal = (t >= T - 1e-9 ? FACE : bondPrice(y_t, T - t, bondType, couponRate)) * units;
            const brlV = cash + bVal;
            path.push({
                tStr: `${t.toFixed(1)}년`,
                t,
                krwValue: Math.round(brlV * fx_t),
                brlValue: Math.round(brlV),
                principal: investKrw,
            });
        }

        // 7x6 시나리오 매트릭스
        const yieldOffsets = [-300, -200, -100, 0, 100, 200, 300];
        const fxChanges = [-30, -20, -10, 0, 10, 20];
        const matrix = yieldOffsets.map(off => {
            const y1 = Math.max(entryYield + off / 100, 0.5);
            const returns = fxChanges.map(fc => {
                const eEnd = entryFx * (1 + fc / 100);
                const rCalc = (customReinvestRate !== null ? customReinvestRate : (entryYield + y1) / 2) / 100;
                const cFv = received.reduce((acc, t) => acc + (c * taxKeep) * Math.pow(1 + rCalc, H - t), 0);
                let eG = 0;
                let sC = 0;
                if (heldToMaturity) {
                    eG = FACE * units;
                } else {
                    eG = bondPrice(y1, T - H, bondType, couponRate) * units;
                    sC = eG * (sellCostPct / 100);
                }
                const bEnd = cFv + (eG - sC);
                const kEnd = bEnd * eEnd;
                return Math.round(((kEnd / investKrw - 1) * 100) * 10) / 10;
            });
            return {
                exitYield: Math.round(y1 * 100) / 100,
                offsetBp: off,
                returns,
            };
        });

        return {
            T, H, heldToMaturity, units, p0, b0,
            exitFx, brlFinal, krwFinal, krwProfit,
            brlRet: brlRet * 100, krwRet: krwRet * 100,
            brlCagr, krwCagr, breakevenFx, breakevenChangePct,
            modDur, breakdown, path, matrix,
            reinvestRatePct: reinvestRate * 100,
            yieldOffsets, fxChanges,
        };
    }, [
        investKrw, bondType, maturityYears, couponRate, entryYield, exitYield,
        holdingYears, entryFx, fxChangePct, customReinvestRate, buyCostPct,
        sellCostPct, taxRatePct
    ]);

    return (
        <section className="bg-gradient-to-br from-[#0c1322] via-[#080d16] to-[#04070c] rounded-3xl border border-cyan-500/30 p-5 md:p-7 shadow-[0_0_50px_rgba(6,182,212,0.15)] text-white space-y-7">
            {/* 1) 헤더 & 프리셋 버튼 */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-white/10 pb-5">
                <div className="flex items-center gap-3">
                    <span className="p-3 rounded-2xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 shadow-inner">
                        <Calculator className="w-6 h-6" />
                    </span>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black px-2 py-0.5 rounded bg-cyan-400 text-black uppercase tracking-wider">
                                Institutional Engine
                            </span>
                            <span className="text-xs text-gray-400 font-mono">BRL/KRW Total Return & Breakeven Model</span>
                        </div>
                        <h2 className="text-xl sm:text-2xl font-black text-white mt-1 flex items-center gap-2">
                            🇧🇷 브라질 국채 토탈리턴(Total Return) 정밀 시뮬레이터
                        </h2>
                    </div>
                </div>

                {/* 우측 보조 태그 */}
                <div className="flex items-center gap-2 text-xs text-gray-400">
                    <span className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10">
                        수정 듀레이션: <strong className="text-cyan-400">{sim.modDur.toFixed(2)}년</strong>
                    </span>
                    <span className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10">
                        매수단가: <strong className="text-amber-400">{sim.p0.toFixed(2)} BRL</strong>
                    </span>
                </div>
            </div>

            {/* 프리셋 선택기 */}
            <div className="space-y-2">
                <div className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" /> 전략 프리셋 선택:
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
                    {presets.map(p => (
                        <button
                            key={p.id}
                            onClick={p.apply}
                            className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                                activePreset === p.id
                                    ? `${p.color} ring-2 ring-cyan-400/50 shadow-lg`
                                    : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.06] text-gray-300'
                            }`}
                        >
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white/10">
                                    {p.badge}
                                </span>
                                {activePreset === p.id && <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />}
                            </div>
                            <span className="text-xs font-bold leading-tight line-clamp-1">{p.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* 2) 대시보드 4대 핵심 결과 Bento 카드 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 카드 1: 최종 원화 평가금액 & 누적 수익률 */}
                <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-950/40 via-black/40 to-black/60 border border-emerald-500/40 relative overflow-hidden group">
                    <div className="flex items-center justify-between text-xs text-emerald-400 mb-2 font-bold">
                        <span>최종 원화 수령액</span>
                        <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/30">
                            {sim.krwRet >= 0 ? `+${sim.krwRet.toFixed(1)}%` : `${sim.krwRet.toFixed(1)}%`}
                        </span>
                    </div>
                    <div className="text-2xl sm:text-3xl font-black text-white">
                        {sim.krwFinal.toLocaleString('ko-KR')} <span className="text-sm font-normal text-gray-400">원</span>
                    </div>
                    <div className="mt-2 text-xs flex items-center justify-between text-gray-300">
                        <span>순손익:</span>
                        <span className={`font-bold ${sim.krwProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {sim.krwProfit >= 0 ? `+${sim.krwProfit.toLocaleString('ko-KR')}` : sim.krwProfit.toLocaleString('ko-KR')} 원
                        </span>
                    </div>
                    <div className="text-[11px] text-gray-400 flex items-center justify-between mt-1">
                        <span>헤알(BRL) 기준:</span>
                        <span className="text-gray-300 font-mono">+{sim.brlRet.toFixed(1)}% ({Math.round(sim.brlFinal).toLocaleString()} BRL)</span>
                    </div>
                </div>

                {/* 카드 2: 연환산 수익률 (CAGR) */}
                <div className="p-5 rounded-2xl bg-gradient-to-br from-cyan-950/40 via-black/40 to-black/60 border border-cyan-500/40 relative overflow-hidden">
                    <div className="flex items-center justify-between text-xs text-cyan-400 mb-2 font-bold">
                        <span>연평균 복리 수익률 (CAGR)</span>
                        <TrendingUp className="w-4 h-4 text-cyan-400" />
                    </div>
                    <div className="text-2xl sm:text-3xl font-black text-cyan-300">
                        {sim.krwCagr >= 0 ? `+${sim.krwCagr.toFixed(2)}%` : `${sim.krwCagr.toFixed(2)}%`}
                        <span className="text-xs font-normal text-gray-400 ml-1">/년</span>
                    </div>
                    <div className="mt-2 text-xs text-gray-300 flex items-center justify-between">
                        <span>헤알화(BRL) CAGR:</span>
                        <span className="text-cyan-400 font-mono">+{sim.brlCagr.toFixed(2)}%/년</span>
                    </div>
                    <div className="text-[11px] text-gray-400 flex items-center justify-between mt-1">
                        <span>보유 기간:</span>
                        <span className="text-gray-200">{sim.H}년 ({sim.heldToMaturity ? '만기 보유' : '중도 매도'})</span>
                    </div>
                </div>

                {/* 카드 3: 환율 손익분기점 (Breakeven FX) */}
                <div className="p-5 rounded-2xl bg-gradient-to-br from-amber-950/40 via-black/40 to-black/60 border border-amber-500/40 relative overflow-hidden">
                    <div className="flex items-center justify-between text-xs text-amber-400 mb-2 font-bold">
                        <span>환율 손익분기점 (Breakeven)</span>
                        <ShieldCheck className="w-4 h-4 text-amber-400" />
                    </div>
                    <div className="text-2xl sm:text-3xl font-black text-amber-300">
                        {sim.breakevenFx.toFixed(1)} <span className="text-sm font-normal text-gray-400">원</span>
                    </div>
                    <div className="mt-2 text-xs text-gray-300 flex items-center justify-between">
                        <span>원금 방어 쿠션:</span>
                        <span className="text-amber-400 font-bold">
                            {sim.breakevenChangePct.toFixed(1)}% 하락 방어
                        </span>
                    </div>
                    <div className="text-[11px] text-gray-400 mt-1">
                        ※ 진입환율({entryFx}원)에서 {sim.breakevenFx.toFixed(1)}원까지 하락해도 원금 100% 보존
                    </div>
                </div>

                {/* 카드 4: 수익 분해 요약 */}
                <div className="p-5 rounded-2xl bg-gradient-to-br from-purple-950/40 via-black/40 to-black/60 border border-purple-500/40 relative overflow-hidden">
                    <div className="flex items-center justify-between text-xs text-purple-400 mb-2 font-bold">
                        <span>수익 분해 요약 (원화 환산)</span>
                        <Layers className="w-4 h-4 text-purple-400" />
                    </div>
                    <div className="space-y-1 text-xs">
                        <div className="flex justify-between text-gray-300">
                            <span>순이자 쿠폰:</span>
                            <span className="font-semibold text-emerald-400">+{Math.round(sim.breakdown.couponNet).toLocaleString()}원</span>
                        </div>
                        <div className="flex justify-between text-gray-300">
                            <span>재투자 복리:</span>
                            <span className="font-semibold text-cyan-400">+{Math.round(sim.breakdown.reinvestGain).toLocaleString()}원</span>
                        </div>
                        <div className="flex justify-between text-gray-300">
                            <span>금리 자본차익:</span>
                            <span className={`font-semibold ${sim.breakdown.capitalGain >= 0 ? 'text-cyan-400' : 'text-rose-400'}`}>
                                {sim.breakdown.capitalGain >= 0 ? `+${Math.round(sim.breakdown.capitalGain).toLocaleString()}` : Math.round(sim.breakdown.capitalGain).toLocaleString()}원
                            </span>
                        </div>
                        <div className="flex justify-between text-gray-300">
                            <span>환차손익:</span>
                            <span className={`font-semibold ${sim.breakdown.fx >= 0 ? 'text-amber-300' : 'text-rose-400'}`}>
                                {sim.breakdown.fx >= 0 ? `+${Math.round(sim.breakdown.fx).toLocaleString()}` : Math.round(sim.breakdown.fx).toLocaleString()}원
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* 3) 파라미터 조절 슬라이더 (2열 Bento 패널) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 bg-black/30 p-5 rounded-2xl border border-white/10">
                {/* 좌측 컬럼: 채권 및 금리 조건 */}
                <div className="space-y-4">
                    <div className="text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5 border-b border-white/5 pb-2">
                        <DollarSign className="w-4 h-4" /> 1. 채권 및 투자금 조건
                    </div>

                    {/* 투자금 */}
                    <div>
                        <div className="flex justify-between text-xs mb-1.5">
                            <span className="text-gray-300 font-semibold">투자 원금 (KRW)</span>
                            <span className="text-cyan-400 font-bold font-mono">{(investKrw / 10000).toLocaleString()}만원</span>
                        </div>
                        <input
                            type="range"
                            min={1_000_000}
                            max={100_000_000}
                            step={1_000_000}
                            value={investKrw}
                            onChange={e => setInvestKrw(Number(e.target.value))}
                            className="w-full accent-cyan-400 cursor-pointer"
                        />
                        <div className="flex gap-1.5 mt-1.5">
                            {[500, 1000, 3000, 5000, 10000].map(amt => (
                                <button
                                    key={amt}
                                    onClick={() => setInvestKrw(amt * 10000)}
                                    className={`px-2 py-0.5 rounded text-[11px] font-semibold border transition ${
                                        investKrw === amt * 10000
                                            ? 'bg-cyan-500 text-black border-cyan-400'
                                            : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10'
                                    }`}
                                >
                                    {amt >= 10000 ? `${amt / 10000}억` : `${amt}만`}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 채권 종류 토글 */}
                    <div>
                        <span className="text-gray-300 text-xs font-semibold block mb-1.5">채권 유형</span>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                onClick={() => { setBondType('ntnf'); setCouponRate(10.0); }}
                                className={`p-2.5 rounded-xl border text-xs font-bold text-center transition cursor-pointer ${
                                    bondType === 'ntnf'
                                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                                        : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                                }`}
                            >
                                NTN-F (연 10% 반기이표)
                            </button>
                            <button
                                onClick={() => { setBondType('ltn'); setCouponRate(0.0); }}
                                className={`p-2.5 rounded-xl border text-xs font-bold text-center transition cursor-pointer ${
                                    bondType === 'ltn'
                                        ? 'bg-purple-500/20 border-purple-500 text-purple-300'
                                        : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                                }`}
                            >
                                LTN (제로쿠폰 할인채)
                            </button>
                        </div>
                    </div>

                    {/* 잔존 만기 & 보유기간 */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <div className="flex justify-between text-xs mb-1">
                                <span className="text-gray-300">잔존 만기</span>
                                <span className="text-white font-mono font-bold">{maturityYears}년</span>
                            </div>
                            <input
                                type="range"
                                min={1}
                                max={10}
                                step={0.5}
                                value={maturityYears}
                                onChange={e => setMaturityYears(Number(e.target.value))}
                                className="w-full accent-cyan-400 cursor-pointer"
                            />
                        </div>
                        <div>
                            <div className="flex justify-between text-xs mb-1">
                                <span className="text-gray-300">보유 기간</span>
                                <span className="text-cyan-400 font-mono font-bold">{holdingYears}년</span>
                            </div>
                            <input
                                type="range"
                                min={0.5}
                                max={maturityYears}
                                step={0.5}
                                value={holdingYears}
                                onChange={e => setHoldingYears(Number(e.target.value))}
                                className="w-full accent-cyan-400 cursor-pointer"
                            />
                        </div>
                    </div>

                    {/* 진입 금리 vs 종료 금리 */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <div className="flex justify-between text-xs mb-1">
                                <span className="text-gray-300">매수 금리 (YTM)</span>
                                <span className="text-amber-400 font-mono font-bold">{entryYield.toFixed(2)}%</span>
                            </div>
                            <input
                                type="range"
                                min={8.0}
                                max={20.0}
                                step={0.05}
                                value={entryYield}
                                onChange={e => setEntryYield(Number(e.target.value))}
                                className="w-full accent-amber-400 cursor-pointer"
                            />
                        </div>
                        <div>
                            <div className="flex justify-between text-xs mb-1">
                                <span className="text-gray-300">매도/종료 금리</span>
                                <span className="text-cyan-400 font-mono font-bold">{exitYield.toFixed(2)}%</span>
                            </div>
                            <input
                                type="range"
                                min={8.0}
                                max={20.0}
                                step={0.05}
                                value={exitYield}
                                onChange={e => setExitYield(Number(e.target.value))}
                                className="w-full accent-cyan-400 cursor-pointer"
                            />
                        </div>
                    </div>
                </div>

                {/* 우측 컬럼: 환율 및 비용/세금 */}
                <div className="space-y-4">
                    <div className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5 border-b border-white/5 pb-2">
                        <Percent className="w-4 h-4" /> 2. 환율 시나리오 및 비용/과세
                    </div>

                    {/* 진입 환율 & 만기 환율 변동 */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <div className="flex justify-between text-xs mb-1">
                                <span className="text-gray-300">진입 환율 (원/헤알)</span>
                                <span className="text-amber-400 font-mono font-bold">{entryFx.toFixed(1)}원</span>
                            </div>
                            <input
                                type="range"
                                min={150}
                                max={350}
                                step={0.5}
                                value={entryFx}
                                onChange={e => setEntryFx(Number(e.target.value))}
                                className="w-full accent-amber-400 cursor-pointer"
                            />
                        </div>
                        <div>
                            <div className="flex justify-between text-xs mb-1">
                                <span className="text-gray-300">환율 변동률</span>
                                <span className={`font-mono font-bold ${fxChangePct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    {fxChangePct >= 0 ? `+${fxChangePct.toFixed(1)}%` : `${fxChangePct.toFixed(1)}%`} ({sim.exitFx.toFixed(1)}원)
                                </span>
                            </div>
                            <input
                                type="range"
                                min={-40}
                                max={40}
                                step={1}
                                value={fxChangePct}
                                onChange={e => setFxChangePct(Number(e.target.value))}
                                className="w-full accent-amber-400 cursor-pointer"
                            />
                        </div>
                    </div>

                    {/* 쿠폰 재투자 이율 */}
                    <div>
                        <div className="flex justify-between text-xs mb-1">
                            <span className="text-gray-300">쿠폰 재투자 수익률 (%)</span>
                            <span className="text-cyan-400 font-mono font-bold">
                                {customReinvestRate !== null ? `${customReinvestRate.toFixed(1)}%` : `자동 (${sim.reinvestRatePct.toFixed(1)}%)`}
                            </span>
                        </div>
                        <div className="flex items-center gap-3">
                            <input
                                type="range"
                                min={0}
                                max={20}
                                step={0.5}
                                value={customReinvestRate !== null ? customReinvestRate : sim.reinvestRatePct}
                                onChange={e => setCustomReinvestRate(Number(e.target.value))}
                                className="w-full accent-cyan-400 cursor-pointer"
                            />
                            {customReinvestRate !== null && (
                                <button
                                    onClick={() => setCustomReinvestRate(null)}
                                    className="text-[11px] text-gray-400 hover:text-white underline shrink-0 cursor-pointer"
                                >
                                    자동
                                </button>
                            )}
                        </div>
                    </div>

                    {/* 거래비용 및 과세 */}
                    <div className="grid grid-cols-3 gap-2">
                        <div>
                            <span className="text-[11px] text-gray-400 block mb-1">매수 비용</span>
                            <input
                                type="number"
                                min={0}
                                max={5}
                                step={0.1}
                                value={buyCostPct}
                                onChange={e => setBuyCostPct(Number(e.target.value))}
                                className="w-full px-2.5 py-1.5 rounded-lg bg-black/40 border border-white/10 text-xs font-mono text-white text-right"
                            />
                        </div>
                        <div>
                            <span className="text-[11px] text-gray-400 block mb-1">매도 비용</span>
                            <input
                                type="number"
                                min={0}
                                max={5}
                                step={0.1}
                                value={sellCostPct}
                                onChange={e => setSellCostPct(Number(e.target.value))}
                                className="w-full px-2.5 py-1.5 rounded-lg bg-black/40 border border-white/10 text-xs font-mono text-white text-right"
                            />
                        </div>
                        <div>
                            <span className="text-[11px] text-gray-400 block mb-1">이자 소득세</span>
                            <button
                                onClick={() => setTaxRatePct(taxRatePct === 0 ? 15.4 : 0)}
                                className={`w-full py-1.5 rounded-lg border text-xs font-bold transition cursor-pointer ${
                                    taxRatePct === 0
                                        ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                                        : 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                                }`}
                            >
                                {taxRatePct === 0 ? '비과세 (0%)' : '과세 (15.4%)'}
                            </button>
                        </div>
                    </div>

                    <p className="text-[11px] text-gray-400 leading-relaxed bg-black/20 p-2.5 rounded-xl border border-white/5">
                        💡 한-브라질 조세조약에 따라 브라질 국채 이자 및 자본차익은 원칙적으로 <strong>비과세</strong> 혜택을 받습니다. (증권사 수수료 및 헤알화 환전 스프레드는 반영됨)
                    </p>
                </div>
            </div>

            {/* 4) 반기별 가치 축적 경로 차트 (Recharts AreaChart) */}
            <div className="bg-black/30 p-5 rounded-2xl border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                    <div className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-emerald-400" /> 반기별 원화 평가금액 누적 경로
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                        <span className="flex items-center gap-1.5 text-gray-400">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" /> 원화 평가액
                        </span>
                        <span className="flex items-center gap-1.5 text-gray-400">
                            <span className="w-2.5 h-0.5 bg-gray-500 border-b border-dashed" /> 원금 기준선
                        </span>
                    </div>
                </div>

                <div className="h-56 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={sim.path} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                            <defs>
                                <linearGradient id="valGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                                </linearGradient>
                            </defs>
                            <XAxis dataKey="tStr" stroke="#6b7280" fontSize={11} tickLine={false} />
                            <YAxis
                                stroke="#6b7280"
                                fontSize={11}
                                tickLine={false}
                                tickFormatter={v => `${(v / 10000).toLocaleString()}만`}
                                domain={['auto', 'auto']}
                            />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '12px' }}
                                formatter={(value: any, name: any) => [
                                    `${Number(value).toLocaleString()}원`,
                                    name === 'krwValue' ? '평가액' : '원금'
                                ]}
                                labelFormatter={l => `${l} 경과`}
                            />
                            <Area
                                type="monotone"
                                dataKey="krwValue"
                                stroke="#10b981"
                                strokeWidth={2.5}
                                fillOpacity={1}
                                fill="url(#valGrad)"
                                name="krwValue"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* 5) 금리 변동 × 환율 변동 7×6 시나리오 히트맵 매트릭스 */}
            <div className="bg-black/30 p-5 rounded-2xl border border-white/10 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/5 pb-3">
                    <div>
                        <h4 className="text-sm font-bold text-white flex items-center gap-2">
                            <Layers className="w-4 h-4 text-cyan-400" /> 금리 변동 × 환율 변동 2차원 스트레스 매트릭스
                        </h4>
                        <p className="text-xs text-gray-400 mt-0.5">
                            종료 시점의 시장금리 및 원/헤알 환율 변화에 따른 최종 원화 수익률(%) 시뮬레이션
                        </p>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-gray-400">
                        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-emerald-500/80" /> +50% 이상</span>
                        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-cyan-500/60" /> 0% ~ +50%</span>
                        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-rose-500/60" /> 손실 (음수)</span>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-center text-xs">
                        <thead>
                            <tr className="border-b border-white/10 text-gray-400">
                                <th className="py-2.5 px-3 font-semibold text-left">종료 금리</th>
                                {sim.fxChanges.map(fc => (
                                    <th key={fc} className="py-2.5 px-2 font-semibold">
                                        환율 {fc >= 0 ? `+${fc}%` : `${fc}%`}
                                        <div className="text-[10px] text-gray-500 font-normal">
                                            {Math.round(entryFx * (1 + fc / 100))}원
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {sim.matrix.map(row => {
                                const isCurrentYieldRow = Math.abs(row.exitYield - exitYield) < 0.25;
                                return (
                                    <tr key={row.exitYield} className={isCurrentYieldRow ? 'bg-cyan-500/10' : ''}>
                                        <td className="py-2.5 px-3 text-left font-mono font-bold text-gray-200">
                                            {row.exitYield.toFixed(2)}%
                                            <span className="text-[10px] text-gray-400 ml-1">
                                                ({row.offsetBp >= 0 ? `+${row.offsetBp}bp` : `${row.offsetBp}bp`})
                                            </span>
                                        </td>
                                        {row.returns.map((ret, idx) => {
                                            const fc = sim.fxChanges[idx];
                                            const isSelectedCell = isCurrentYieldRow && Math.abs(fc - fxChangePct) <= 5;
                                            let cellBg = 'bg-white/[0.02] text-gray-300';
                                            if (ret >= 50) cellBg = 'bg-emerald-500/25 text-emerald-300 font-bold';
                                            else if (ret > 0) cellBg = 'bg-cyan-500/20 text-cyan-300';
                                            else if (ret === 0) cellBg = 'bg-gray-700/30 text-gray-300';
                                            else cellBg = 'bg-rose-500/25 text-rose-300 font-semibold';

                                            return (
                                                <td
                                                    key={idx}
                                                    className={`py-2 px-2 font-mono transition-all ${cellBg} ${
                                                        isSelectedCell ? 'ring-2 ring-amber-400 rounded-lg shadow-[0_0_12px_rgba(245,158,11,0.5)] z-10' : ''
                                                    }`}
                                                >
                                                    {ret >= 0 ? `+${ret.toFixed(1)}%` : `${ret.toFixed(1)}%`}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </section>
    );
}
