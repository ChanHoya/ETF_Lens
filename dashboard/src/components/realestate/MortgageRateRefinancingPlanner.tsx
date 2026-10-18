'use client';

import React, { useState, useMemo } from 'react';
import { 
    Building, ArrowRightLeft, TrendingDown, DollarSign, Calculator, 
    CheckCircle2, AlertCircle, Sparkles, Scale, Info, ArrowUpRight
} from 'lucide-react';

interface TargetComplex {
    name: string;
    region: string;
    priceWonEok: number;
    ltvLimitPct: number;
}

const TARGET_CANDIDATES: TargetComplex[] = [
    { name: '마포래미안푸르지오 (전용 84㎡)', region: '마포구 (준상급지)', priceWonEok: 18.0, ltvLimitPct: 50 },
    { name: '잠실엘스 (전용 84㎡)', region: '송파구 (강남3구/상급지)', priceWonEok: 25.5, ltvLimitPct: 50 },
    { name: '분당 파크뷰 (전용 84㎡)', region: '성남 분당구 (1기신도시 탑)', priceWonEok: 16.5, ltvLimitPct: 70 },
    { name: '판교 봇들마을8단지 (전용 84㎡)', region: '성남 판교 (IT핵심)', priceWonEok: 21.0, ltvLimitPct: 70 },
    { name: '과천위버필드 (전용 84㎡)', region: '경기 과천 (준강남)', priceWonEok: 19.5, ltvLimitPct: 50 },
];

export default function MortgageRateRefinancingPlanner() {
    // ── 1. 주담대 금리 대환(Refinancing) 상태 ────────────────────────────
    const [loanPrincipalEok, setLoanPrincipalEok] = useState<number>(3.5);     // 대출 잔액 3.5억
    const [currentRatePct, setCurrentRatePct] = useState<number>(4.6);         // 기존 금리 4.6%
    const [refinancedRatePct, setRefinancedRatePct] = useState<number>(3.3);    // BOK 인하 반영 신규 대환 금리 3.3%
    const [loanTermYears, setLoanTermYears] = useState<number>(30);            // 잔여 만기 30년
    const [prepaymentPenaltyPct, setPrepaymentPenaltyPct] = useState<number>(0.8); // 잔여 중도상환수수료 0.8%

    // ── 2. 상급지 갈아타기 수지표 상태 ─────────────────────────────────
    const [currentHomePriceEok, setCurrentHomePriceEok] = useState<number>(11.5); // 내 아파트 시세 11.5억
    const [otherLiquidAssetEok, setOtherLiquidAssetEok] = useState<number>(2.5); // 주식/예수금 등 가용 금융자산 2.5억
    const [selectedTargetIdx, setSelectedTargetIdx] = useState<number>(0);

    // ── 금융 수학 연산: 원리금균등분할 월 상환액 ─────────────────────────
    const calcMonthlyPayment = (principalWon: number, annualRatePct: number, years: number) => {
        if (annualRatePct <= 0 || years <= 0) return principalWon / (years * 12);
        const r = annualRatePct / 100 / 12;
        const n = years * 12;
        return (principalWon * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
    };

    // 대환 전후 비교
    const principalWon = loanPrincipalEok * 100000000;
    const oldMonthlyWon = useMemo(() => calcMonthlyPayment(principalWon, currentRatePct, loanTermYears), [principalWon, currentRatePct, loanTermYears]);
    const newMonthlyWon = useMemo(() => calcMonthlyPayment(principalWon, refinancedRatePct, loanTermYears), [principalWon, refinancedRatePct, loanTermYears]);
    const monthlySavedWon = Math.max(0, oldMonthlyWon - newMonthlyWon);
    const annualSavedWon = monthlySavedWon * 12;
    const penaltyFeeWon = principalWon * (prepaymentPenaltyPct / 100);
    const bepMonths = monthlySavedWon > 0 ? Math.ceil(penaltyFeeWon / monthlySavedWon) : 0;

    // 상급지 갈아타기 수지표 연산
    const target = TARGET_CANDIDATES[selectedTargetIdx];
    const targetPriceWon = target.priceWonEok * 100000000;
    
    // 매도 후 순유입금 (시세 - 기존대출 - 복비/취등록정산 약 2%)
    const sellingFeeWon = (currentHomePriceEok * 100000000) * 0.015;
    const netHomeProceedsWon = (currentHomePriceEok * 100000000) - principalWon - sellingFeeWon;
    const totalAvailableEquityWon = netHomeProceedsWon + (otherLiquidAssetEok * 100000000);
    
    // 필요 추가 대출
    const requiredNewLoanWon = Math.max(0, targetPriceWon - totalAvailableEquityWon);
    const maxLtvLoanWon = targetPriceWon * (target.ltvLimitPct / 100);
    const isLtvPossible = requiredNewLoanWon <= maxLtvLoanWon;

    // 상급지 신규 대출 월 상환액 (신규 대환금리 기준)
    const targetMonthlyLoanWon = useMemo(() => calcMonthlyPayment(requiredNewLoanWon, refinancedRatePct, 30), [requiredNewLoanWon, refinancedRatePct]);

    return (
        <section className="bg-gradient-to-br from-slate-900/90 via-sky-950/20 to-slate-900/90 border border-sky-500/30 rounded-2xl p-5 shadow-2xl relative overflow-hidden backdrop-blur-md">
            {/* 상단 헤더 */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-white/10">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-400">
                        <ArrowRightLeft className="w-5 h-5 animate-pulse" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-lg font-bold text-white flex items-center gap-1.5">
                                금리 인하 사이클 주담대 대환 계산기 & 상급지 갈아타기 수지표
                                <span className="text-[10px] bg-sky-500/20 text-sky-300 border border-sky-500/40 px-2 py-0.5 rounded-full font-semibold">
                                    Sprint 30 LIVE
                                </span>
                            </h3>
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">
                            한국은행 피벗(금리 인하) 반영 주담대 대환 이자 절감액 및 수도권 핵심지 갈아타기 자금 수지 실시간 산출
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold px-3 py-1 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/40">
                        {bepMonths <= 6 ? `손익분기점 ${bepMonths}개월 (대환 강력 추천)` : `손익분기점 ${bepMonths}개월`}
                    </span>
                </div>
            </div>

            {/* 2대 벤토 그리드 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 my-5">
                {/* 1. 주담대 금리 인하 대환(Refinancing) 시뮬레이터 */}
                <div className="bg-slate-900/70 border border-slate-700/60 rounded-xl p-4 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                                <TrendingDown className="w-4 h-4 text-sky-400" />
                                기존 주담대 vs 인하 대환 금리 비교
                            </span>
                            <span className="text-xs text-gray-400">원리금균등 · 잔여 {loanTermYears}년</span>
                        </div>

                        {/* 입력 슬라이더 */}
                        <div className="space-y-3 mb-4 bg-black/25 p-3 rounded-lg border border-white/5">
                            <div>
                                <div className="flex justify-between text-xs mb-1">
                                    <span className="text-gray-400">대출 잔액</span>
                                    <span className="font-extrabold text-white">{loanPrincipalEok}억 원</span>
                                </div>
                                <input 
                                    type="range"
                                    min="1.0"
                                    max="10.0"
                                    step="0.5"
                                    value={loanPrincipalEok}
                                    onChange={(e) => setLoanPrincipalEok(Number(e.target.value))}
                                    className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-sky-500"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <div className="flex justify-between text-xs mb-1">
                                        <span className="text-gray-400">기존 고금리</span>
                                        <span className="font-bold text-rose-400">{currentRatePct}%</span>
                                    </div>
                                    <input 
                                        type="range"
                                        min="3.5"
                                        max="6.5"
                                        step="0.1"
                                        value={currentRatePct}
                                        onChange={(e) => setCurrentRatePct(Number(e.target.value))}
                                        className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-rose-500"
                                    />
                                </div>

                                <div>
                                    <div className="flex justify-between text-xs mb-1">
                                        <span className="text-gray-400">신규 대환금리</span>
                                        <span className="font-bold text-sky-400">{refinancedRatePct}%</span>
                                    </div>
                                    <input 
                                        type="range"
                                        min="2.8"
                                        max="4.5"
                                        step="0.1"
                                        value={refinancedRatePct}
                                        onChange={(e) => setRefinancedRatePct(Number(e.target.value))}
                                        className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-sky-500"
                                    />
                                </div>
                            </div>

                            <div className="flex items-center justify-between text-[11px] text-gray-400 pt-1">
                                <span>중도상환수수료율 (잔여기간 반영):</span>
                                <span className="font-semibold text-gray-200">{prepaymentPenaltyPct}% (약 {(penaltyFeeWon / 10000).toFixed(0)}만원)</span>
                            </div>
                        </div>

                        {/* 절감 효과 요약 카드 */}
                        <div className="grid grid-cols-2 gap-2 mb-4">
                            <div className="p-2.5 rounded-lg bg-black/20 border border-white/5">
                                <span className="text-[11px] text-gray-400 block">월 상환 절감액</span>
                                <span className="text-base font-extrabold text-sky-300">
                                    -{(monthlySavedWon / 10000).toFixed(0)}만 원/월
                                </span>
                                <span className="text-[10px] text-gray-500 block">
                                    월 {(oldMonthlyWon / 10000).toFixed(0)}만 → {(newMonthlyWon / 10000).toFixed(0)}만 원
                                </span>
                            </div>

                            <div className="p-2.5 rounded-lg bg-black/20 border border-white/5">
                                <span className="text-[11px] text-gray-400 block">연간 순이자 절감</span>
                                <span className="text-base font-extrabold text-emerald-300">
                                    +{(annualSavedWon / 10000).toFixed(0)}만 원/년
                                </span>
                                <span className="text-[10px] text-gray-500 block">
                                    30년 누적 {((annualSavedWon * 30) / 100000000).toFixed(1)}억 절감
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="p-2.5 rounded-lg bg-sky-950/30 border border-sky-500/20 text-xs text-gray-300 flex items-center justify-between">
                        <span>중도상환수수료 회수 손익분기:</span>
                        <span className="font-extrabold text-sky-300">
                            대환 후 {bepMonths}개월 차부터 순이익 발생
                        </span>
                    </div>
                </div>

                {/* 2. 수도권 상급지 갈아타기 실전자금 수지표 */}
                <div className="bg-slate-900/70 border border-slate-700/60 rounded-xl p-4 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                                <Building className="w-4 h-4 text-amber-400" />
                                상급지 갈아타기 종잣돈 & 필요 대출 분석
                            </span>
                            <span className="text-xs text-gray-400">LTV 규제 자동 체크</span>
                        </div>

                        {/* 내 아파트 & 자산 입력 */}
                        <div className="grid grid-cols-2 gap-2 mb-3 bg-black/25 p-2.5 rounded-lg border border-white/5 text-xs">
                            <div>
                                <span className="text-gray-400 block text-[11px]">내 아파트 실거래가</span>
                                <span className="font-bold text-white text-sm">{currentHomePriceEok}억 원</span>
                                <span className="text-[10px] text-gray-500 block">대출 {loanPrincipalEok}억 공제</span>
                            </div>
                            <div>
                                <span className="text-gray-400 block text-[11px]">가용 금융자산 (주식/예금)</span>
                                <span className="font-bold text-emerald-300 text-sm">{otherLiquidAssetEok}억 원</span>
                                <span className="text-[10px] text-gray-500 block">합산 종잣돈 {(totalAvailableEquityWon / 100000000).toFixed(1)}억</span>
                            </div>
                        </div>

                        {/* 목표 상급지 선택 */}
                        <div className="mb-3">
                            <span className="text-[11px] text-gray-400 block mb-1">목표 상급지 단지 선택</span>
                            <div className="grid grid-cols-1 gap-1.5">
                                {TARGET_CANDIDATES.map((cand, idx) => (
                                    <button
                                        key={cand.name}
                                        onClick={() => setSelectedTargetIdx(idx)}
                                        className={`px-3 py-1.5 rounded-lg text-left text-xs flex items-center justify-between transition-all ${
                                            selectedTargetIdx === idx 
                                                ? 'bg-sky-600/30 border border-sky-400/50 text-white font-bold' 
                                                : 'bg-black/20 hover:bg-black/40 text-gray-300 border border-white/5'
                                        }`}
                                    >
                                        <div>
                                            <span>{cand.name}</span>
                                            <span className="text-[10px] text-gray-400 ml-1.5">({cand.region})</span>
                                        </div>
                                        <span className="font-extrabold text-amber-300">{cand.priceWonEok}억</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* 갈아타기 수지표 결과 요약 */}
                        <div className="p-3 rounded-lg bg-black/30 border border-white/5 text-xs space-y-1.5">
                            <div className="flex justify-between">
                                <span className="text-gray-400">목표 매수가격:</span>
                                <span className="font-bold text-white">{target.priceWonEok}억 원</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-400">내 보유 총 종잣돈:</span>
                                <span className="font-bold text-emerald-400">{(totalAvailableEquityWon / 100000000).toFixed(1)}억 원</span>
                            </div>
                            <div className="flex justify-between pt-1 border-t border-white/5">
                                <span className="text-gray-300 font-semibold">필요 추가 대출금:</span>
                                <span className="text-base font-extrabold text-amber-300">
                                    {(requiredNewLoanWon / 100000000).toFixed(1)}억 원
                                </span>
                            </div>
                            <div className="flex justify-between text-[11px]">
                                <span className="text-gray-400">LTV {target.ltvLimitPct}% 한도 (최대 {(maxLtvLoanWon / 100000000).toFixed(1)}억):</span>
                                <span className={isLtvPossible ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                                    {isLtvPossible ? '✓ LTV 한도 내 진입 가능' : '⚠ LTV 한도 초과 (추가 현금 필요)'}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-white/5 flex items-center justify-between text-xs">
                        <span className="text-gray-400">갈아타기 후 예상 월 상환액:</span>
                        <span className="font-extrabold text-sky-300">
                            월 약 {(targetMonthlyLoanWon / 10000).toFixed(0)}만 원 (금리 {refinancedRatePct}% 적용)
                        </span>
                    </div>
                </div>
            </div>
        </section>
    );
}
