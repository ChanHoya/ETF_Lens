"use client";

import React, { useState, useEffect } from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { PiggyBank, Sparkles, Percent, HelpCircle, ArrowRight, Calculator } from 'lucide-react';

export default function TaxOptimizer() {
    // 1. User inputs via sliders
    const [monthlyDeposit, setMonthlyDeposit] = useState<number>(50); // 만원 단위, default 50만원
    const [years, setYears] = useState<number>(10); // 투자 기간, default 10년
    const [expectedReturn, setExpectedReturn] = useState<number>(7); // 연수익률 %, default 7%
    const [dividendPortion, setDividendPortion] = useState<number>(30); // 배당/과세수익 비중 %, default 30%

    const [chartData, setChartData] = useState<any[]>([]);
    const [finalResults, setFinalResults] = useState<any>(null);

    // 2. Run simulation on slider input change
    useEffect(() => {
        const monthlyRate = expectedReturn / 100 / 12;
        const totalMonths = years * 12;
        const monthlyAmount = monthlyDeposit * 10000; // 원화 변환

        let normalBalance = 0;
        let isaBalance = 0;
        let pensionBalance = 0;

        let totalPrincipal = 0;
        const tempData = [];

        // 연도별 데이터 트래킹을 위한 캐시
        let normalYearlyTaxableGain = 0;

        for (let month = 1; month <= totalMonths; month++) {
            totalPrincipal += monthlyAmount;

            // 월초 납입 가정
            normalBalance += monthlyAmount;
            isaBalance += monthlyAmount;
            pensionBalance += monthlyAmount;

            // 월간 수익 발생
            const normalGain = normalBalance * monthlyRate;
            const isaGain = isaBalance * monthlyRate;
            const pensionGain = pensionBalance * monthlyRate;

            normalBalance += normalGain;
            isaBalance += isaGain;
            pensionBalance += pensionGain;

            // 일반 계좌의 경우, 배당/과세수익 비중만큼 매달(또는 매년 말) 15.4% 과세 원천징수 가정
            const taxableNormalGain = normalGain * (dividendPortion / 100);
            const tax = taxableNormalGain * 0.154;
            normalBalance -= tax;

            // 1년 마다 차트에 기록 또는 마지막 달 기록
            if (month % 12 === 0 || month === totalMonths) {
                const yearNum = Math.ceil(month / 12);
                
                // 임시로 해당 시점의 과세이연 최종 세금 차감 시뮬레이션
                // ISA 최종 과세: 200만원 비과세, 초과분 9.9% 분리과세
                const isaGainTotal = Math.max(0, isaBalance - totalPrincipal);
                const isaTaxableAmount = Math.max(0, isaGainTotal - 2000000);
                const isaFinalTax = isaTaxableAmount * 0.099;
                const isaAfterTax = isaBalance - isaFinalTax;

                // 연금저축 최종 과세: 수령 시 5.5% 연금소득세 가정
                const pensionGainTotal = Math.max(0, pensionBalance - totalPrincipal);
                const pensionFinalTax = (pensionGainTotal) * 0.055; // 수익에 대해 5.5%
                const pensionAfterTax = pensionBalance - pensionFinalTax;

                tempData.push({
                    year: `${yearNum}년`,
                    principal: Math.round(totalPrincipal / 10000), // 만원 단위
                    normal: Math.round(normalBalance / 10000),
                    isa: Math.round(isaAfterTax / 10000),
                    pension: Math.round(pensionAfterTax / 10000)
                });
            }
        }

        // 최종 세금 및 수령액 결과 산출
        const lastIdx = tempData.length - 1;
        if (lastIdx >= 0) {
            const finalNormal = tempData[lastIdx].normal;
            const finalIsa = tempData[lastIdx].isa;
            const finalPension = tempData[lastIdx].pension;
            const principalMan = Math.round(totalPrincipal / 10000);

            setFinalResults({
                principal: principalMan,
                normal: finalNormal,
                isa: finalIsa,
                pension: finalPension,
                isaSavings: Math.max(0, finalIsa - finalNormal),
                pensionSavings: Math.max(0, finalPension - finalNormal)
            });
        }

        setChartData(tempData);
    }, [monthlyDeposit, years, expectedReturn, dividendPortion]);

    const formatManWon = (val: number) => {
        if (val >= 10000) {
            const eok = Math.floor(val / 10000);
            const man = val % 10000;
            return man > 0 ? `${eok}억 ${man.toLocaleString()}만원` : `${eok}억원`;
        }
        return `${val.toLocaleString()}만원`;
    };

    return (
        <div className="bg-[#121217]/80 border border-white/10 rounded-3xl p-6 backdrop-blur-xl shadow-2xl mt-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6 border-b border-white/10 pb-4">
                <div className="p-2.5 bg-emerald-500/10 rounded-xl border border-emerald-500/30 text-emerald-400">
                    <PiggyBank className="w-5 h-5" />
                </div>
                <div>
                    <h3 className="text-lg font-bold text-white">절세 계좌 시뮬레이터</h3>
                    <p className="text-xs text-gray-400">일반 vs ISA vs 연금저축/IRP 최종 세후 자산 비교</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Sliders Input Panel */}
                <div className="lg:col-span-1 space-y-5 bg-black/20 p-5 rounded-2xl border border-white/5">
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <Calculator className="w-3.5 h-3.5 text-emerald-400" />
                        시뮬레이션 변수 설정
                    </h4>
                    
                    {/* Monthly Deposit Slider */}
                    <div className="space-y-2">
                        <div className="flex justify-between text-xs">
                            <span className="text-gray-400">월 적립식 투자금</span>
                            <span className="text-white font-bold">{monthlyDeposit}만원</span>
                        </div>
                        <input
                            type="range"
                            min="10"
                            max="200"
                            step="5"
                            value={monthlyDeposit}
                            onChange={(e) => setMonthlyDeposit(Number(e.target.value))}
                            className="w-full accent-emerald-500 cursor-pointer bg-white/10 h-1.5 rounded-lg appearance-none"
                        />
                    </div>

                    {/* Investment Years Slider */}
                    <div className="space-y-2">
                        <div className="flex justify-between text-xs">
                            <span className="text-gray-400">적립식 투자 기간</span>
                            <span className="text-white font-bold">{years}년</span>
                        </div>
                        <input
                            type="range"
                            min="1"
                            max="30"
                            step="1"
                            value={years}
                            onChange={(e) => setYears(Number(e.target.value))}
                            className="w-full accent-emerald-500 cursor-pointer bg-white/10 h-1.5 rounded-lg appearance-none"
                        />
                    </div>

                    {/* Expected Return Slider */}
                    <div className="space-y-2">
                        <div className="flex justify-between text-xs">
                            <span className="text-gray-400">예상 연간 복리 수익률</span>
                            <span className="text-white font-bold">{expectedReturn}%</span>
                        </div>
                        <input
                            type="range"
                            min="1"
                            max="20"
                            step="0.5"
                            value={expectedReturn}
                            onChange={(e) => setExpectedReturn(Number(e.target.value))}
                            className="w-full accent-emerald-500 cursor-pointer bg-white/10 h-1.5 rounded-lg appearance-none"
                        />
                    </div>

                    {/* Taxable Dividend Portion Slider */}
                    <div className="space-y-2">
                        <div className="flex justify-between text-xs flex-wrap gap-1">
                            <span className="text-gray-400 flex items-center gap-1">
                                배당/과세수익 비중
                                <HelpCircle className="w-3 h-3 text-gray-500" title="수익 중 연 15.4% 과세대상 배당소득이나 국내상장 해외주식형 ETF 매매차익의 비중" />
                            </span>
                            <span className="text-white font-bold">{dividendPortion}%</span>
                        </div>
                        <input
                            type="range"
                            min="10"
                            max="100"
                            step="5"
                            value={dividendPortion}
                            onChange={(e) => setDividendPortion(Number(e.target.value))}
                            className="w-full accent-emerald-500 cursor-pointer bg-white/10 h-1.5 rounded-lg appearance-none"
                        />
                    </div>
                </div>

                {/* Simulation Output Area */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Final Result Cards */}
                    {finalResults && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 flex flex-col justify-between">
                                <span className="text-[10px] text-gray-500 uppercase font-bold">일반 계좌 (15.4% 과세)</span>
                                <span className="text-lg font-black text-gray-200 font-mono mt-1">{formatManWon(finalResults.normal)}</span>
                                <span className="text-[9px] text-gray-500 mt-2">원금 대비 {((finalResults.normal / finalResults.principal) * 100).toFixed(0)}% 수준</span>
                            </div>
                            
                            <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-2xl p-4 flex flex-col justify-between relative overflow-hidden group">
                                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                <span className="text-[10px] text-indigo-400 uppercase font-bold flex items-center gap-1">
                                    ISA 계좌 (9.9% 분리)
                                    <Sparkles className="w-3 h-3" />
                                </span>
                                <span className="text-lg font-black text-indigo-300 font-mono mt-1">{formatManWon(finalResults.isa)}</span>
                                <span className="text-[10px] text-indigo-400/80 font-bold mt-2 flex items-center gap-1 font-sans">
                                    +{formatManWon(finalResults.isaSavings)} 추가 수령
                                </span>
                            </div>

                            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-4 flex flex-col justify-between relative overflow-hidden group">
                                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                <span className="text-[10px] text-emerald-400 uppercase font-bold flex items-center gap-1">
                                    연금 계좌 (5.5% 과세)
                                    <Sparkles className="w-3 h-3" />
                                </span>
                                <span className="text-lg font-black text-emerald-300 font-mono mt-1">{formatManWon(finalResults.pension)}</span>
                                <span className="text-[10px] text-emerald-400/80 font-bold mt-2 flex items-center gap-1 font-sans">
                                    +{formatManWon(finalResults.pensionSavings)} 추가 수령
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Chart Visualization */}
                    <div className="bg-black/20 rounded-2xl border border-white/5 p-4">
                        <div className="flex justify-between items-center mb-3">
                            <span className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
                                <Calculator className="w-3.5 h-3.5 text-emerald-400" />
                                연도별 세후 평가금액 추이 비교 (과세이연 효과)
                            </span>
                            <span className="text-[10px] text-gray-500 font-mono">
                                원금 합계: {finalResults ? formatManWon(finalResults.principal) : '-'}
                            </span>
                        </div>
                        <div className="w-full h-[180px] z-10">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                                    <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                                    <XAxis dataKey="year" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 9 }} axisLine={false} tickLine={false} />
                                    <YAxis tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 9 }} axisLine={false} tickLine={false} />
                                    <Tooltip
                                        formatter={(value: any) => [`${value.toLocaleString()} 만원`, '']}
                                        contentStyle={{ backgroundColor: 'rgba(9, 9, 11, 0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '11px' }}
                                        itemStyle={{ color: '#fff' }}
                                    />
                                    <Area type="monotone" dataKey="pension" name="연금저축/IRP" stroke="#10b981" fill="rgba(16,185,129,0.05)" strokeWidth={1.5} />
                                    <Area type="monotone" dataKey="isa" name="ISA 계좌" stroke="#6366f1" fill="rgba(99,102,241,0.05)" strokeWidth={1.5} />
                                    <Area type="monotone" dataKey="normal" name="일반 계좌" stroke="#9ca3af" fill="rgba(156,163,175,0.03)" strokeWidth={1.5} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
