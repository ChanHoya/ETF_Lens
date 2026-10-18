'use client';

import React, { useState, useMemo } from 'react';
import { 
    Coins, ShieldAlert, ArrowRight, CheckCircle2, AlertTriangle, 
    Sparkles, Percent, HelpCircle, Layers, RefreshCw, HeartPulse
} from 'lucide-react';

export default function DividendTaxShieldPlanner() {
    // 1. 일반 위탁계좌 연간 배당/이자 소득 입력 (만원 단위)
    const [annualDividendManwon, setAnnualDividendManwon] = useState<number>(1450);
    // 2. 다른 이자/배당 소득 (예금/채권 등, 만원 단위)
    const [otherInterestManwon, setOtherInterestManwon] = useState<number>(180);
    // 3. 피부양자 등록 여부
    const [isDependent, setIsDependent] = useState<boolean>(true);
    // 4. 절세계좌(ISA / 연금)로 이전할 배당 소득액 (만원 단위)
    const [relocateManwon, setRelocateManwon] = useState<number>(450);

    // 총 금융소득 (일반계좌 기준)
    const totalFinancialIncome = annualDividendManwon + otherInterestManwon;
    const limitManwon = 2000;
    const remainingToLimit = limitManwon - totalFinancialIncome;
    const usagePct = Math.min(100, Math.round((totalFinancialIncome / limitManwon) * 100));

    // 위험 등급 판정
    const riskLevel = useMemo(() => {
        if (totalFinancialIncome > limitManwon) {
            return { grade: 'DANGER', label: '종합과세 & 피부양자 탈락 위험', color: 'text-rose-400', bg: 'bg-rose-500/20 border-rose-500/40' };
        } else if (totalFinancialIncome >= 1700) {
            return { grade: 'WARNING', label: '경고 (한도 임박)', color: 'text-amber-400', bg: 'bg-amber-500/20 border-amber-500/40' };
        } else if (totalFinancialIncome >= 1200) {
            return { grade: 'MODERATE', label: '주의 (모니터링 필요)', color: 'text-yellow-400', bg: 'bg-yellow-500/20 border-yellow-500/40' };
        } else {
            return { grade: 'SAFE', label: '안전 (원천징수 15.4% 종결)', color: 'text-emerald-400', bg: 'bg-emerald-500/20 border-emerald-500/40' };
        }
    }, [totalFinancialIncome]);

    // 재배치 후 금융소득
    const afterRelocationIncome = Math.max(0, totalFinancialIncome - relocateManwon);
    const afterUsagePct = Math.min(100, Math.round((afterRelocationIncome / limitManwon) * 100));

    // 절세 및 건보료 방어 효과 계산
    const savings = useMemo(() => {
        let taxSavedWon = 0;
        let insuranceSavedWon = 0;

        // 2,000만원 초과 상태에서 이전으로 2,000만원 이하로 진입했을 때
        const isTriggeredDrop = totalFinancialIncome > limitManwon && afterRelocationIncome <= limitManwon;

        if (isTriggeredDrop && isDependent) {
            // 건보료 피부양자 박탈 방어: 지역가입자 전환 시 월 평균 28만원, 연 336만원 건보료 방어!
            insuranceSavedWon = 3360000;
        }

        // 세금 절감 (일반 배당소득세 15.4% vs ISA 비과세 0% / 연금 5.5%)
        // 이전 금액(relocateManwon)에 대해 약 10%p 실효세율 절감 효과
        taxSavedWon = Math.round(relocateManwon * 10000 * 0.099);

        return {
            taxSavedWon,
            insuranceSavedWon,
            totalBenefitWon: taxSavedWon + insuranceSavedWon
        };
    }, [totalFinancialIncome, afterRelocationIncome, isDependent, relocateManwon]);

    return (
        <section className="bg-gradient-to-br from-slate-900/90 via-emerald-950/20 to-slate-900/90 border border-emerald-500/30 rounded-2xl p-5 shadow-2xl relative overflow-hidden backdrop-blur-md">
            {/* 상단 헤더 */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-white/10">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                        <Coins className="w-5 h-5 animate-pulse" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-lg font-bold text-white flex items-center gap-1.5">
                                금융소득종합과세(2천만) 누적 예측 & 배당 절세 재배치 플래너
                                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full font-semibold">
                                    Sprint 30 LIVE
                                </span>
                            </h3>
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">
                            일반계좌 배당·이자 2,000만원 한도 실시간 추적 및 건보료 피부양자 자격 박탈 방어 솔루션
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold px-3 py-1 rounded-full border ${riskLevel.bg} ${riskLevel.color}`}>
                        {riskLevel.label}
                    </span>
                </div>
            </div>

            {/* 메인 2열 그리드 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 my-5">
                {/* 좌측: 현재 일반계좌 배당/이자 소득 입력 및 2,000만원 게이지 */}
                <div className="bg-slate-900/70 border border-slate-700/60 rounded-xl p-4 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                                일반 위탁계좌 연간 금융소득 현황
                            </span>
                            <span className="text-xs text-gray-400">연간 한도: 2,000만 원</span>
                        </div>

                        {/* 슬라이더 컨트롤 */}
                        <div className="space-y-3 mb-4 bg-black/25 p-3 rounded-lg border border-white/5">
                            <div>
                                <div className="flex justify-between text-xs mb-1">
                                    <span className="text-gray-400">국내·해외주식 연간 배당금</span>
                                    <span className="font-extrabold text-white">{annualDividendManwon.toLocaleString()}만 원</span>
                                </div>
                                <input 
                                    type="range"
                                    min="0"
                                    max="3000"
                                    step="50"
                                    value={annualDividendManwon}
                                    onChange={(e) => setAnnualDividendManwon(Number(e.target.value))}
                                    className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                                />
                            </div>

                            <div>
                                <div className="flex justify-between text-xs mb-1">
                                    <span className="text-gray-400">채권 이자 및 예금 이자 등</span>
                                    <span className="font-extrabold text-white">{otherInterestManwon.toLocaleString()}만 원</span>
                                </div>
                                <input 
                                    type="range"
                                    min="0"
                                    max="1000"
                                    step="20"
                                    value={otherInterestManwon}
                                    onChange={(e) => setOtherInterestManwon(Number(e.target.value))}
                                    className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                                />
                            </div>

                            <div className="pt-2 border-t border-white/5 flex items-center justify-between text-xs">
                                <span className="text-gray-300 font-medium">합산 총 금융소득:</span>
                                <span className="text-base font-extrabold text-emerald-400">
                                    {totalFinancialIncome.toLocaleString()}만 원 ({usagePct}%)
                                </span>
                            </div>
                        </div>

                        {/* 한도 게이지 바 */}
                        <div className="space-y-1.5 mb-4">
                            <div className="flex justify-between text-xs">
                                <span className="text-gray-400">2,000만원 한도 소진율</span>
                                <span className="font-bold text-gray-200">
                                    {remainingToLimit >= 0 ? `잔여 여유한도 ${remainingToLimit.toLocaleString()}만원` : `한도 초과 +${Math.abs(remainingToLimit).toLocaleString()}만원`}
                                </span>
                            </div>
                            <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden p-0.5">
                                <div 
                                    className={`h-2 rounded-full transition-all duration-500 ${
                                        totalFinancialIncome > 2000 
                                            ? 'bg-rose-500' 
                                            : totalFinancialIncome >= 1600 
                                                ? 'bg-gradient-to-r from-emerald-500 via-amber-500 to-rose-500' 
                                                : 'bg-emerald-500'
                                    }`}
                                    style={{ width: `${Math.min(100, (totalFinancialIncome / 2000) * 100)}%` }}
                                />
                            </div>
                            <div className="flex justify-between text-[10px] text-gray-500">
                                <span>0원</span>
                                <span>안전 (1,200만)</span>
                                <span>주의 (1,600만)</span>
                                <span className="text-rose-400 font-bold">2,000만원 한도선</span>
                            </div>
                        </div>
                    </div>

                    {/* 피부양자 경보 */}
                    <div className="p-3 rounded-lg bg-black/30 border border-white/5 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                            <HeartPulse className="w-4 h-4 text-rose-400 shrink-0" />
                            <span className="text-gray-300">현재 건강보험 피부양자 자격 유지 중</span>
                        </div>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                            <input 
                                type="checkbox" 
                                checked={isDependent} 
                                onChange={(e) => setIsDependent(e.target.checked)}
                                className="rounded bg-slate-800 border-slate-700 text-emerald-500 focus:ring-0"
                            />
                            <span className="text-gray-400 text-[11px]">피부양자 여부</span>
                        </label>
                    </div>
                </div>

                {/* 우측: 절세계좌(ISA, 연금저축, IRP) 배당 재배치 시뮬레이터 */}
                <div className="bg-slate-900/70 border border-slate-700/60 rounded-xl p-4 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-semibold text-indigo-300 flex items-center gap-1.5">
                                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                                절세계좌(ISA / 연금) 배당 재배치 시뮬레이션
                            </span>
                            <span className="text-xs text-emerald-400 font-bold">
                                {totalFinancialIncome > 2000 ? '재배치 긴급 권고' : '사전 절세 최적화'}
                            </span>
                        </div>

                        {/* 이전 금액 설정 */}
                        <div className="space-y-3 mb-4 bg-black/25 p-3 rounded-lg border border-white/5">
                            <div>
                                <div className="flex justify-between text-xs mb-1">
                                    <span className="text-gray-400">절세계좌로 이전할 고배당 ETF 배당금</span>
                                    <span className="font-extrabold text-indigo-300">{relocateManwon.toLocaleString()}만 원</span>
                                </div>
                                <input 
                                    type="range"
                                    min="0"
                                    max="1500"
                                    step="50"
                                    value={relocateManwon}
                                    onChange={(e) => setRelocateManwon(Number(e.target.value))}
                                    className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                                />
                            </div>

                            <div className="pt-2 border-t border-white/5 flex items-center justify-between text-xs">
                                <span className="text-gray-300">재배치 후 일반계좌 금융소득:</span>
                                <div className="text-right">
                                    <span className={`text-base font-extrabold ${afterRelocationIncome <= 2000 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                        {afterRelocationIncome.toLocaleString()}만 원
                                    </span>
                                    <span className="text-[10px] text-gray-400 ml-1">({afterUsagePct}%)</span>
                                </div>
                            </div>
                        </div>

                        {/* 절세 및 건보료 방어 성과 카드 */}
                        <div className="grid grid-cols-2 gap-2 mb-4">
                            <div className="p-2.5 rounded-lg bg-black/20 border border-white/5">
                                <span className="text-[11px] text-gray-400 block">배당소득세 절감액</span>
                                <span className="text-base font-extrabold text-emerald-300">
                                    +{(savings.taxSavedWon / 10000).toFixed(0)}만 원/년
                                </span>
                                <span className="text-[10px] text-gray-500 block">ISA 비과세+분리과세</span>
                            </div>

                            <div className="p-2.5 rounded-lg bg-black/20 border border-white/5">
                                <span className="text-[11px] text-gray-400 block">건보료 방어 효과</span>
                                <span className={`text-base font-extrabold ${savings.insuranceSavedWon > 0 ? 'text-rose-300 animate-pulse' : 'text-gray-400'}`}>
                                    {savings.insuranceSavedWon > 0 ? `+${(savings.insuranceSavedWon / 10000).toFixed(0)}만 원/년` : '피부양자 유지 중'}
                                </span>
                                <span className="text-[10px] text-gray-500 block">
                                    {savings.insuranceSavedWon > 0 ? '지역가입자 폭탄 방어' : '한도 내 유지'}
                                </span>
                            </div>
                        </div>

                        {/* 추천 실행 플랜 */}
                        <div className="p-3 rounded-lg bg-indigo-950/30 border border-indigo-500/20 text-xs text-gray-300 space-y-1">
                            <div className="font-bold text-indigo-200 flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" /> 맞춤형 이전 포트폴리오 가이드
                            </div>
                            <p className="text-[11px] text-gray-300 leading-relaxed">
                                {afterRelocationIncome <= 2000 
                                    ? `일반계좌의 고배당주(커버드콜/리츠 등) 중 연 ${relocateManwon}만원분을 ISA 및 연금저축으로 옮기면 금융소득종합과세 한도(2,000만)를 완벽히 방어하며, 연간 총 ${((savings.totalBenefitWon) / 10000).toFixed(0)}만원의 실질 현금을 지킬 수 있습니다.`
                                    : `추가로 ${(afterRelocationIncome - 2000).toLocaleString()}만원 이상의 배당 소득을 절세계좌로 더 이전해야 금융소득종합과세 및 피부양자 박탈을 피할 수 있습니다.`}
                            </p>
                        </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs">
                        <span className="text-gray-400">총 연간 실질 방어액:</span>
                        <span className="text-base font-extrabold text-amber-300">
                            +{(savings.totalBenefitWon / 10000).toLocaleString()}만 원 / 년
                        </span>
                    </div>
                </div>
            </div>
        </section>
    );
}
