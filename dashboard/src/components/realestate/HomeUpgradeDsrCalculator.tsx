// 부동산 상급지 갈아타기 스트레스 DSR 2단계 & 세금(취득세·양도세) 포함 정밀 자금 수지 계산기
'use client';

import React, { useState, useMemo } from 'react';
import {
    Building2, Calculator, ShieldAlert, CheckCircle2, ArrowRight,
    TrendingUp, AlertCircle, DollarSign, Percent, Scale, Home, RefreshCw, FileText
} from 'lucide-react';

interface TargetComplex {
    name: string;
    region: string;
    pyeong: string;
    priceWonEok: number;
    isRegulated: boolean; // 투기과열지구(강남3구/용산 LTV 50%) 여부
}

const CANDIDATE_COMPLEXES: TargetComplex[] = [
    { name: '마포래미안푸르지오', region: '서울 마포구', pyeong: '전용 84㎡(34평)', priceWonEok: 18.5, isRegulated: false },
    { name: '잠실엘스', region: '서울 송파구', pyeong: '전용 84㎡(34평)', priceWonEok: 27.5, isRegulated: true },
    { name: '헬리오시티', region: '서울 송파구', pyeong: '전용 84㎡(34평)', priceWonEok: 22.0, isRegulated: true },
    { name: '분당 파크뷰', region: '경기 성남 분당구', pyeong: '전용 84㎡(33평)', priceWonEok: 19.5, isRegulated: false },
    { name: '과천위버필드', region: '경기 과천시', pyeong: '전용 84㎡(34평)', priceWonEok: 20.5, isRegulated: false },
    { name: '반포 래미안원베일리', region: '서울 서초구', pyeong: '전용 84㎡(34평)', priceWonEok: 43.0, isRegulated: true },
];

export default function HomeUpgradeDsrCalculator() {
    // ── 1. 기존 주택 매도 파라미터 ────────────────────────────────
    const [currentPriceEok, setCurrentPriceEok] = useState<number>(11.5); // 매도가 11.5억
    const [existingLoanEok, setExistingLoanEok] = useState<number>(3.5);   // 기존 주담대 잔액 3.5억
    const [liquidAssetsEok, setLiquidAssetsEok] = useState<number>(1.2);   // 보유 가용 금융자산 1.2억
    const [isSingleHomeowner, setIsSingleHomeowner] = useState<boolean>(true); // 1세대 1주택 비과세 여부

    // ── 2. 목표 상급지 선택 ──────────────────────────────────────
    const [selectedIdx, setSelectedIdx] = useState<number>(0);
    const [customPriceEok, setCustomPriceEok] = useState<number>(18.5);
    const [isCustom, setIsCustom] = useState<boolean>(false);

    // ── 3. 소득 및 대출(스트레스 DSR 2단계) 파라미터 ──────────────
    const [annualIncomeMan, setAnnualIncomeMan] = useState<number>(8500); // 연소득 8,500만 원
    const [mortgageRatePct, setMortgageRatePct] = useState<number>(3.75); // 실제 주담대 적용금리 3.75%
    const [stressRatePct, setStressRatePct] = useState<number>(1.20);     // 2026 스트레스 DSR 2단계 가산금리 (+1.20%p)
    const [loanMaturityYears, setLoanMaturityYears] = useState<number>(30); // 30년 / 40년

    const targetComplex = CANDIDATE_COMPLEXES[selectedIdx];
    const targetPriceEok = isCustom ? customPriceEok : targetComplex.priceWonEok;
    const targetPriceWon = targetPriceEok * 100_000_000;

    // ── 금융 및 세무 수학 정밀 계산 ───────────────────────────────
    const calculation = useMemo(() => {
        // [A] 기존 주택 매도 순 정산금
        const currentPriceWon = currentPriceEok * 100_000_000;
        const existingLoanWon = existingLoanEok * 100_000_000;
        const liquidAssetsWon = liquidAssetsEok * 100_000_000;

        // 양도소득세: 1세대 1주택 12억 이하는 비과세. 12억 초과 시 초과 비율만큼 과세
        let capitalGainsTaxWon = 0;
        if (!isSingleHomeowner) {
            // 다주택자 일반 과세 (가정 양도차익의 약 25%)
            capitalGainsTaxWon = currentPriceWon * 0.08;
        } else if (currentPriceEok > 12.0) {
            // 12억 초과 고가주택 비과세 배제분 (간이 공제율 적용)
            const taxableRatio = (currentPriceEok - 12.0) / currentPriceEok;
            capitalGainsTaxWon = currentPriceWon * taxableRatio * 0.15; // 장특공제 감안 간이 유효세율
        }

        // 매도 중개보수: 9억 이상 0.5% + 부가세 10% = 0.55%
        const sellBrokerageFeeWon = currentPriceWon * 0.0055;

        // 최종 손에 쥐는 매도 순 정산금 (Net Equity)
        const netHomeEquityWon = Math.max(0, currentPriceWon - existingLoanWon - capitalGainsTaxWon - sellBrokerageFeeWon);
        // 갈아타기 투입 총 종잣돈 = 매도 순 정산금 + 보유 금융자산
        const totalSeedMoneyWon = netHomeEquityWon + liquidAssetsWon;

        // [B] 목표 상급지 매수 부대비용
        // 취득세: 9억 초과 주택 3.0% + 지방교육세 0.3% + 농특세 0.2% = 3.5%
        const acquisitionTaxWon = targetPriceWon * 0.035;
        // 매수 중개수수료 (0.55%) + 법무비/채권할인 등 (0.25%) = 0.8%
        const buyIncidentalFeeWon = targetPriceWon * 0.008;
        const totalBuyIncidentalWon = acquisitionTaxWon + buyIncidentalFeeWon; // 약 4.3%

        // 목표 주택 매수 총 필요 자금
        const totalRequiredCostWon = targetPriceWon + totalBuyIncidentalWon;
        // 추가로 대출로 조달해야 하는 자금 갭 (Gap)
        const requiredLoanWon = Math.max(0, totalRequiredCostWon - totalSeedMoneyWon);

        // [C] 스트레스 DSR 2단계 & LTV 대출 가능 한도 판정
        // 1. LTV 한도 판정
        const ltvLimitPct = (isCustom ? false : targetComplex.isRegulated) ? 50 : 70;
        const maxLtvLoanWon = targetPriceWon * (ltvLimitPct / 100);

        // 2. 스트레스 DSR 2단계 한도 판정 (은행권 DSR 40%)
        const annualIncomeWon = annualIncomeMan * 10000;
        const maxAnnualDebtServiceWon = annualIncomeWon * 0.40; // 연간 최대 원리금 상환 가능액

        // 스트레스 평가 금리 = 실제 금리 + 스트레스 가산금리
        const stressRate = (mortgageRatePct + stressRatePct) / 100;
        const monthlyStressRate = stressRate / 12;
        const numMonths = loanMaturityYears * 12;

        // 원리금균등상환 대출 가능액 역산: PV = PMT * [1 - (1+r)^-n] / r
        const monthlyPmtLimit = maxAnnualDebtServiceWon / 12;
        const maxDsrLoanWon = monthlyPmtLimit * (1 - Math.pow(1 + monthlyStressRate, -numMonths)) / monthlyStressRate;

        // 3. 최종 승인 가능 대출액 = Min(LTV 한도, DSR 한도)
        const finalMaxLoanWon = Math.min(maxLtvLoanWon, maxDsrLoanWon);
        const bindingConstraint = maxDsrLoanWon < maxLtvLoanWon ? 'DSR 규제' : 'LTV 규제';

        // 4. 실행 가능 여부 판정
        const isUpgradePossible = finalMaxLoanWon >= requiredLoanWon;
        const fundDeficitWon = Math.max(0, requiredLoanWon - finalMaxLoanWon);

        // [D] 갈아타기 후 실제 월 원리금 상환액 (실제 주담대 금리 기준)
        const actualLoanAmountWon = Math.min(requiredLoanWon, finalMaxLoanWon);
        const actualMonthlyRate = (mortgageRatePct / 100) / 12;
        const actualMonthlyPmtWon = actualLoanAmountWon > 0
            ? actualLoanAmountWon * (actualMonthlyRate * Math.pow(1 + actualMonthlyRate, numMonths)) / (Math.pow(1 + actualMonthlyRate, numMonths) - 1)
            : 0;

        return {
            netHomeEquityWon,
            capitalGainsTaxWon,
            sellBrokerageFeeWon,
            totalSeedMoneyWon,
            acquisitionTaxWon,
            totalBuyIncidentalWon,
            totalRequiredCostWon,
            requiredLoanWon,
            ltvLimitPct,
            maxLtvLoanWon,
            maxDsrLoanWon,
            finalMaxLoanWon,
            bindingConstraint,
            isUpgradePossible,
            fundDeficitWon,
            actualMonthlyPmtWon,
            actualLoanAmountWon,
        };
    }, [
        currentPriceEok, existingLoanEok, liquidAssetsEok, isSingleHomeowner,
        targetPriceWon, isCustom, targetComplex, annualIncomeMan,
        mortgageRatePct, stressRatePct, loanMaturityYears
    ]);

    return (
        <section className="bg-gradient-to-br from-slate-900/90 via-slate-900/60 to-sky-950/30 rounded-2xl border border-sky-500/25 p-4 md:p-6 shadow-xl backdrop-blur-md space-y-6">
            {/* 상단 헤더 & 규제 뱃지 */}
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pb-4 border-b border-white/10">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-400">
                        <Building2 className="w-6 h-6 animate-pulse" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-xl md:text-2xl font-black text-white tracking-tight">
                                부동산 갈아타기 스트레스 DSR 2단계 & 세금 수지 계산기
                            </h2>
                            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-sky-500/15 border border-sky-400/30 text-sky-300">
                                DSR 40% 한도 판정
                            </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                            기존 주택 매도 순 정산금(양도세/복비 공제)과 스트레스 DSR 2단계 대출 한도를 연동하여 상급지 갈아타기 실행 가능 여부를 판정합니다.
                        </p>
                    </div>
                </div>

                {/* 갈아타기 성패 판정 뱃지 */}
                <div className={`px-4 py-2 rounded-xl border flex items-center gap-2.5 ${
                    calculation.isUpgradePossible 
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200' 
                        : 'bg-rose-500/15 border-rose-500/40 text-rose-200'
                }`}>
                    {calculation.isUpgradePossible ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                    ) : (
                        <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
                    )}
                    <div>
                        <span className="text-[10px] font-bold block opacity-80">갈아타기 승인 판정</span>
                        <span className="text-sm font-black">
                            {calculation.isUpgradePossible ? '✓ 상급지 갈아타기 진입 가능' : '⚠ 자금 부족 (추가 종잣돈 필요)'}
                            {!calculation.isUpgradePossible && (
                                <span className="text-xs font-semibold ml-1.5 opacity-90">
                                    (-{(calculation.fundDeficitWon / 100000000).toFixed(1)}억 원 부족)
                                </span>
                            )}
                        </span>
                    </div>
                </div>
            </div>

            {/* 3단 그리드: 기존 주택 매도 | 목표 상급지 선택 | 차주 소득 및 DSR 대출 한도 */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* 1. 내 기존 주택 매도 순 정산금 */}
                <div className="bg-black/25 rounded-xl border border-white/5 p-4 space-y-3.5 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between pb-2 border-b border-white/5">
                            <span className="text-xs font-bold text-gray-200 flex items-center gap-1.5">
                                <Home className="w-4 h-4 text-sky-400" /> 1. 내 기존 주택 매도 정산
                            </span>
                            <span className="text-[10px] text-gray-400">부채 및 세금 공제</span>
                        </div>

                        <div className="space-y-3 mt-3 text-xs">
                            <div>
                                <div className="flex justify-between text-gray-300 font-semibold mb-1">
                                    <span>내 아파트 매도 호가</span>
                                    <span className="text-white font-bold">{currentPriceEok.toFixed(1)}억 원</span>
                                </div>
                                <input
                                    type="range"
                                    min={5.0}
                                    max={30.0}
                                    step={0.5}
                                    value={currentPriceEok}
                                    onChange={(e) => setCurrentPriceEok(parseFloat(e.target.value))}
                                    className="w-full accent-sky-500 cursor-pointer"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <span className="text-gray-400 block text-[11px] mb-1">기존 주담대 잔액</span>
                                    <div className="flex items-center gap-1 bg-black/40 p-1.5 rounded-lg border border-white/10">
                                        <input
                                            type="number"
                                            step={0.1}
                                            value={existingLoanEok}
                                            onChange={(e) => setExistingLoanEok(parseFloat(e.target.value) || 0)}
                                            className="w-full bg-transparent text-white font-bold text-xs focus:outline-none"
                                        />
                                        <span className="text-gray-400 text-[10px]">억</span>
                                    </div>
                                </div>

                                <div>
                                    <span className="text-gray-400 block text-[11px] mb-1">가용 금융자산</span>
                                    <div className="flex items-center gap-1 bg-black/40 p-1.5 rounded-lg border border-white/10">
                                        <input
                                            type="number"
                                            step={0.1}
                                            value={liquidAssetsEok}
                                            onChange={(e) => setLiquidAssetsEok(parseFloat(e.target.value) || 0)}
                                            className="w-full bg-transparent text-emerald-300 font-bold text-xs focus:outline-none"
                                        />
                                        <span className="text-gray-400 text-[10px]">억</span>
                                    </div>
                                </div>
                            </div>

                            <label className="flex items-center gap-2 cursor-pointer bg-white/5 p-2 rounded-lg border border-white/10 text-[11px]">
                                <input
                                    type="checkbox"
                                    checked={isSingleHomeowner}
                                    onChange={(e) => setIsSingleHomeowner(e.target.checked)}
                                    className="accent-sky-500 w-3.5 h-3.5 rounded"
                                />
                                <span className="text-gray-200">1세대 1주택 비과세 (12억 이하 0원)</span>
                            </label>
                        </div>
                    </div>

                    {/* 매도 정산 결과 박스 */}
                    <div className="p-3 rounded-lg bg-sky-500/10 border border-sky-500/20 text-xs space-y-1">
                        <div className="flex justify-between text-gray-300 text-[11px]">
                            <span>양도세 및 복비 공제:</span>
                            <span className="text-rose-300">
                                -{Math.round((calculation.capitalGainsTaxWon + calculation.sellBrokerageFeeWon) / 10000).toLocaleString()}만 원
                            </span>
                        </div>
                        <div className="flex justify-between font-bold text-white pt-1 border-t border-sky-500/20">
                            <span>갈아타기 총 가용 종잣돈:</span>
                            <span className="text-sm text-emerald-400 font-black">
                                {(calculation.totalSeedMoneyWon / 100000000).toFixed(1)}억 원
                            </span>
                        </div>
                    </div>
                </div>

                {/* 2. 목표 상급지 선택 및 취득세 등 부대비용 */}
                <div className="bg-black/25 rounded-xl border border-white/5 p-4 space-y-3.5 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between pb-2 border-b border-white/5">
                            <span className="text-xs font-bold text-gray-200 flex items-center gap-1.5">
                                <Building2 className="w-4 h-4 text-amber-400" /> 2. 목표 상급지 단지 선택
                            </span>
                            <span className="text-[10px] text-gray-400">취득세 3.5% 반영</span>
                        </div>

                        <div className="space-y-1.5 mt-3 max-h-48 overflow-y-auto pr-1">
                            {CANDIDATE_COMPLEXES.map((cand, idx) => (
                                <button
                                    key={cand.name}
                                    onClick={() => {
                                        setSelectedIdx(idx);
                                        setIsCustom(false);
                                    }}
                                    className={`w-full px-3 py-2 rounded-lg text-left text-xs flex items-center justify-between transition-all ${
                                        !isCustom && selectedIdx === idx
                                            ? 'bg-amber-500/20 border border-amber-400/50 text-white font-bold'
                                            : 'bg-black/30 hover:bg-black/50 text-gray-300 border border-white/5'
                                    }`}
                                >
                                    <div>
                                        <span>{cand.name}</span>
                                        <span className="text-[10px] text-gray-400 ml-1.5 block sm:inline">
                                            {cand.region} · {cand.pyeong}
                                        </span>
                                    </div>
                                    <div className="text-right">
                                        <span className="font-extrabold text-amber-300">{cand.priceWonEok}억</span>
                                        {cand.isRegulated && (
                                            <span className="text-[9px] text-rose-400 block font-semibold">LTV 50%</span>
                                        )}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 매수 필요 자금 요약 */}
                    <div className="p-3 rounded-lg bg-black/40 border border-white/5 text-xs space-y-1">
                        <div className="flex justify-between text-gray-400 text-[11px]">
                            <span>취득세 & 매수부대비용 (약 4.3%):</span>
                            <span className="text-amber-300 font-semibold">
                                +{Math.round(calculation.totalBuyIncidentalWon / 10000).toLocaleString()}만 원
                            </span>
                        </div>
                        <div className="flex justify-between text-gray-400 text-[11px]">
                            <span>목표 주택 총 소요 자금:</span>
                            <span className="text-white font-bold">{(calculation.totalRequiredCostWon / 100000000).toFixed(1)}억 원</span>
                        </div>
                        <div className="flex justify-between pt-1 border-t border-white/5 font-bold">
                            <span className="text-sky-300">필요 대출 조달액 (Gap):</span>
                            <span className="text-sm font-black text-amber-300">
                                {(calculation.requiredLoanWon / 100000000).toFixed(1)}억 원
                            </span>
                        </div>
                    </div>
                </div>

                {/* 3. 차주 소득 및 스트레스 DSR 2단계 대출 한도 판정 */}
                <div className="bg-black/25 rounded-xl border border-white/5 p-4 space-y-3.5 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between pb-2 border-b border-white/5">
                            <span className="text-xs font-bold text-gray-200 flex items-center gap-1.5">
                                <Scale className="w-4 h-4 text-emerald-400" /> 3. 스트레스 DSR 2단계 판정
                            </span>
                            <span className="text-[10px] text-emerald-400 font-semibold">한도 40%</span>
                        </div>

                        <div className="space-y-3 mt-3 text-xs">
                            <div>
                                <div className="flex justify-between text-gray-300 font-semibold mb-1">
                                    <span>부부합산 연소득</span>
                                    <span className="text-emerald-300 font-bold">{annualIncomeMan.toLocaleString()}만 원</span>
                                </div>
                                <input
                                    type="range"
                                    min={4000}
                                    max={25000}
                                    step={500}
                                    value={annualIncomeMan}
                                    onChange={(e) => setAnnualIncomeMan(parseInt(e.target.value))}
                                    className="w-full accent-emerald-500 cursor-pointer"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <span className="text-gray-400 block text-[11px] mb-1">적용 금리</span>
                                    <div className="flex items-center gap-1 bg-black/40 p-1.5 rounded-lg border border-white/10">
                                        <input
                                            type="number"
                                            step={0.05}
                                            value={mortgageRatePct}
                                            onChange={(e) => setMortgageRatePct(parseFloat(e.target.value) || 0)}
                                            className="w-full bg-transparent text-white font-bold text-xs focus:outline-none"
                                        />
                                        <span className="text-gray-400 text-[10px]">%</span>
                                    </div>
                                </div>

                                <div>
                                    <span className="text-gray-400 block text-[11px] mb-1">스트레스 가산</span>
                                    <div className="flex items-center gap-1 bg-black/40 p-1.5 rounded-lg border border-white/10">
                                        <input
                                            type="number"
                                            step={0.05}
                                            value={stressRatePct}
                                            onChange={(e) => setStressRatePct(parseFloat(e.target.value) || 0)}
                                            className="w-full bg-transparent text-amber-300 font-bold text-xs focus:outline-none"
                                        />
                                        <span className="text-gray-400 text-[10px]">%p</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-2">
                                <span className="text-gray-400 text-[11px] self-center">상환 만기:</span>
                                {[30, 40].map(m => (
                                    <button
                                        key={m}
                                        onClick={() => setLoanMaturityYears(m)}
                                        className={`flex-1 py-1 rounded text-xs font-bold transition ${
                                            loanMaturityYears === m 
                                                ? 'bg-sky-600 text-white' 
                                                : 'bg-white/5 text-gray-400 hover:text-white'
                                        }`}
                                    >
                                        {m}년 분할상환
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* 대출 한도 비교 박스 */}
                    <div className="p-3 rounded-lg bg-black/40 border border-white/5 text-xs space-y-1">
                        <div className="flex justify-between text-[11px] text-gray-400">
                            <span>LTV {calculation.ltvLimitPct}% 한도:</span>
                            <span className="font-bold text-gray-200">
                                최대 {(calculation.maxLtvLoanWon / 100000000).toFixed(1)}억 원
                            </span>
                        </div>
                        <div className="flex justify-between text-[11px] text-gray-400">
                            <span>스트레스 DSR 40% 한도:</span>
                            <span className="font-bold text-emerald-300">
                                최대 {(calculation.maxDsrLoanWon / 100000000).toFixed(1)}억 원
                            </span>
                        </div>
                        <div className="flex justify-between pt-1 border-t border-white/5 font-bold">
                            <span className="text-emerald-400">최종 대출 가능액:</span>
                            <span className="text-sm font-black text-emerald-300">
                                {(calculation.finalMaxLoanWon / 100000000).toFixed(1)}억 원
                                <span className="text-[10px] font-normal text-gray-400 ml-1">({calculation.bindingConstraint} 적용)</span>
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* 하단 최종 종합 자금 수지 및 월 상환액 명세 바 */}
            <div className="p-4 rounded-xl bg-slate-900/80 border border-white/10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="space-y-1">
                    <span className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
                        <DollarSign className="w-4 h-4 text-emerald-400" />
                        갈아타기 완료 후 실제 월 주담대 원리금 상환 부담
                    </span>
                    <p className="text-[11px] text-gray-400">
                        {loanMaturityYears}년 원리금균등분할상환 (실제 금리 {mortgageRatePct}% 기준 · 스트레스 가산금리는 한도 심사에만 적용됩니다)
                    </p>
                </div>

                <div className="flex items-baseline gap-4 w-full md:w-auto justify-between md:justify-end">
                    <div className="text-right">
                        <span className="text-[10px] text-gray-400 block">실행 필요 대출금</span>
                        <span className="text-sm font-bold text-white">
                            {(calculation.actualLoanAmountWon / 100000000).toFixed(1)}억 원
                        </span>
                    </div>

                    <div className="text-right">
                        <span className="text-[10px] text-gray-400 block">예상 월 원리금</span>
                        <span className="text-xl md:text-2xl font-black text-sky-300">
                            월 {Math.round(calculation.actualMonthlyPmtWon / 10000).toLocaleString()}만 원
                        </span>
                    </div>
                </div>
            </div>
        </section>
    );
}
