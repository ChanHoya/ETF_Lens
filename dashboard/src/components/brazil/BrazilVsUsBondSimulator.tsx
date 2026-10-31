// 브라질 국채 vs 미국 30년 국채 10개년 실질 토탈리턴(Total Return) 및 절세 비교 시뮬레이터
'use client';

import React, { useState, useMemo } from 'react';
import {
    Scale, TrendingUp, ShieldCheck, DollarSign, Percent,
    Award, Sparkles, Sliders, CheckCircle2, AlertTriangle, ArrowRight
} from 'lucide-react';
import {
    ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, Legend
} from 'recharts';
import { STANDARD_TOOLTIP_STYLE, STANDARD_LEGEND_WRAPPER_STYLE } from '@/lib/chartTheme';

export default function BrazilVsUsBondSimulator() {
    // ── 시뮬레이터 입력 변수 ─────────────────────────────────────
    const [investKrwEok, setInvestKrwEok] = useState<number>(0.5); // 기본 5,000만 원 (0.5억)
    const [holdingYears, setHoldingYears] = useState<number>(7);   // 기본 7년 (1~10년)
    
    // 브라질 국채 파라미터
    const [brazilYield, setBrazilYield] = useState<number>(14.0); // YTM 14.0%
    const [brlFxAnnualChange, setBrlFxAnnualChange] = useState<number>(-2.0); // 연간 헤알화 환율 변동 (-2.0%)
    
    // 미국 30년 국채 파라미터
    const [usYield, setUsYield] = useState<number>(4.45);          // YTM 4.45%
    const [usDuration, setUsDuration] = useState<number>(18.5);    // 듀레이션 18.5년
    const [fedRateCutBp, setFedRateCutBp] = useState<number>(50);  // 금리 인하 기대 (50bp)
    const [usdFxAnnualChange, setUsdFxAnnualChange] = useState<number>(0.0); // 연간 달러 환율 변동 (0%)
    const [applyTaxShield, setApplyTaxShield] = useState<boolean>(true);     // 브라질 비과세 vs 미국 15.4% 과세

    const investPrincipalWon = investKrwEok * 100_000_000;

    // ── 10개년 복리 궤적 연산 ────────────────────────────────────
    const simulationData = useMemo(() => {
        const rows = [];
        let brazilBalance = investPrincipalWon;
        let usBalance = investPrincipalWon;

        // 미국채 연간 자본차익 (인하 시 1회성 또는 초기 몇 년간 반영, 여기서는 보유 기간 초기 선반영 모델링)
        const usCapitalGainPct = (usDuration * (fedRateCutBp / 100)) / 100;
        const usAnnualTaxRate = applyTaxShield ? 0.154 : 0.0; // 배당소득세 15.4%

        rows.push({
            year: '투자 시작',
            yearNum: 0,
            brazil: Math.round(investPrincipalWon / 10000),
            us: Math.round(investPrincipalWon / 10000),
            brazilCumulativeReturn: 0,
            usCumulativeReturn: 0,
        });

        for (let y = 1; y <= 10; y++) {
            // 브라질: YTM 기준 비과세 복리 재투자 + 헤알화 환율 변동 반영
            // 연 복리 실효 수익률 = (1 + brazilYield/100) * (1 + brlFxAnnualChange/100) - 1
            const brlAnnualFactor = (1 + brazilYield / 100) * (1 + brlFxAnnualChange / 100);
            brazilBalance *= brlAnnualFactor;

            // 미국 30년 국채: 세후 분배금 재투자 + 달러 환율 변동 + (1년차에 금리 인하 자본차익 반영)
            const usAfterTaxYield = (usYield / 100) * (1 - usAnnualTaxRate);
            const usdAnnualFactor = (1 + usAfterTaxYield) * (1 + usdFxAnnualChange / 100);
            
            if (y === 1) {
                // 1년차에 금리 인하 사이클 자본차익 반영
                usBalance = usBalance * (1 + usCapitalGainPct) * usdAnnualFactor;
            } else {
                usBalance = usBalance * usdAnnualFactor;
            }

            rows.push({
                year: `${y}년차`,
                yearNum: y,
                brazil: Math.round(brazilBalance / 10000),
                us: Math.round(usBalance / 10000),
                brazilCumulativeReturn: Number((((brazilBalance - investPrincipalWon) / investPrincipalWon) * 100).toFixed(1)),
                usCumulativeReturn: Number((((usBalance - investPrincipalWon) / investPrincipalWon) * 100).toFixed(1)),
            });
        }
        return rows;
    }, [investPrincipalWon, brazilYield, brlFxAnnualChange, usYield, usDuration, fedRateCutBp, usdFxAnnualChange, applyTaxShield]);

    // 선택 보유 연수 기준 최종 결과
    const selectedResult = simulationData[holdingYears] || simulationData[simulationData.length - 1];
    const brazilFinalWon = selectedResult.brazil * 10000;
    const usFinalWon = selectedResult.us * 10000;
    const diffWon = brazilFinalWon - usFinalWon;
    const isBrazilWinner = diffWon >= 0;

    // 브라질 국채 비과세로 아낀 누적 세액 추정 (만약 15.4% 과세되었다면 차감되었을 세금)
    const brazilProfitWon = Math.max(0, brazilFinalWon - investPrincipalWon);
    const taxSavedWon = Math.round(brazilProfitWon * 0.154);

    // 손익분기 헤알화 하락폭 (BEP: 미국채 수익률과 같아지기 위한 연간 헤알화 하락률 한계치)
    // usAnnualRate ~= usAfterTaxYield + (usCapitalGainPct / holdingYears)
    const usEffectiveAnnual = Math.pow(usFinalWon / investPrincipalWon, 1 / holdingYears) - 1;
    const bepBrlDeclinePct = Number((((1 + usEffectiveAnnual) / (1 + brazilYield / 100) - 1) * 100).toFixed(1));

    return (
        <section className="bg-gradient-to-br from-slate-900/90 via-slate-900/60 to-emerald-950/30 rounded-2xl border border-emerald-500/25 p-4 md:p-6 shadow-xl backdrop-blur-md space-y-6">
            {/* 상단 헤더 & 핵심 가이드 */}
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pb-4 border-b border-white/10">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                        <Scale className="w-6 h-6 animate-pulse" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-xl font-extrabold text-white tracking-tight">
                                브라질 국채 vs 미국 30년 국채 실질 토탈리턴 비교
                            </h2>
                            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-400/30 text-emerald-300">
                                비과세 복리 vs 자본차익
                            </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                            한-브라질 비과세 연 10% 쿠폰 복리 재투자 vs 연준 금리 인하에 따른 미국 30년 국채 자본차익을 10개년 실질 자산 궤적으로 시뮬레이션합니다.
                        </p>
                    </div>
                </div>

                {/* 승자 판정 뱃지 */}
                <div className={`px-4 py-2 rounded-xl border flex items-center gap-2.5 ${
                    isBrazilWinner 
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200' 
                        : 'bg-rose-500/15 border-rose-500/40 text-rose-200'
                }`}>
                    <Award className="w-5 h-5 shrink-0" />
                    <div>
                        <span className="text-[10px] font-bold block opacity-80">{holdingYears}년 보유 기준 우위 자산</span>
                        <span className="text-sm font-black">
                            {isBrazilWinner ? '🇧🇷 브라질 국채 우세' : '🇺🇸 미국 30년 국채 우세'}
                            <span className="text-xs font-semibold ml-1.5 opacity-90">
                                ({Math.abs(Math.round(diffWon / 10000)).toLocaleString()}만 원 {isBrazilWinner ? '초과' : '역전'})
                            </span>
                        </span>
                    </div>
                </div>
            </div>

            {/* 컨트롤러 그리드: 투자원금 & 양대 채권 시나리오 슬라이더 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 rounded-xl bg-black/30 border border-white/5 text-xs">
                {/* 1. 투자 원금 & 보유 기간 */}
                <div className="space-y-3">
                    <div>
                        <div className="flex justify-between font-semibold text-gray-300 mb-1">
                            <span>투자 원금</span>
                            <span className="text-emerald-300 font-bold">{(investPrincipalWon / 100000000).toFixed(1)}억 원</span>
                        </div>
                        <input
                            type="range"
                            min={0.1}
                            max={3.0}
                            step={0.1}
                            value={investKrwEok}
                            onChange={(e) => setInvestKrwEok(parseFloat(e.target.value))}
                            className="w-full accent-emerald-500 cursor-pointer"
                        />
                    </div>
                    <div>
                        <div className="flex justify-between font-semibold text-gray-300 mb-1">
                            <span>보유 기간</span>
                            <span className="text-white font-bold">{holdingYears}년 만기</span>
                        </div>
                        <div className="flex gap-1.5">
                            {[3, 5, 7, 10].map(yr => (
                                <button
                                    key={yr}
                                    onClick={() => setHoldingYears(yr)}
                                    className={`flex-1 py-1 rounded text-[11px] font-bold transition-all ${
                                        holdingYears === yr 
                                            ? 'bg-emerald-600 text-white shadow' 
                                            : 'bg-white/5 text-gray-400 hover:text-white'
                                    }`}
                                >
                                    {yr}년
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* 2. 브라질 국채 변수 (YTM & 헤알화) */}
                <div className="space-y-3 border-t md:border-t-0 md:border-l border-white/5 md:pl-4">
                    <div>
                        <div className="flex justify-between font-semibold text-emerald-300 mb-1">
                            <span>🇧🇷 브라질 10년물 YTM</span>
                            <span className="font-bold">{brazilYield.toFixed(1)}%</span>
                        </div>
                        <input
                            type="range"
                            min={11.0}
                            max={16.0}
                            step={0.5}
                            value={brazilYield}
                            onChange={(e) => setBrazilYield(parseFloat(e.target.value))}
                            className="w-full accent-emerald-500 cursor-pointer"
                        />
                    </div>
                    <div>
                        <div className="flex justify-between font-semibold text-gray-300 mb-1">
                            <span>연간 헤알화(BRL) 변동</span>
                            <span className={`font-bold ${brlFxAnnualChange >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {brlFxAnnualChange >= 0 ? `+${brlFxAnnualChange}%` : `${brlFxAnnualChange}%`}
                            </span>
                        </div>
                        <input
                            type="range"
                            min={-8.0}
                            max={4.0}
                            step={0.5}
                            value={brlFxAnnualChange}
                            onChange={(e) => setBrlFxAnnualChange(parseFloat(e.target.value))}
                            className="w-full accent-emerald-500 cursor-pointer"
                        />
                        <span className="text-[10px] text-gray-500 block">원/헤알 하락 시 환손실 반영</span>
                    </div>
                </div>

                {/* 3. 미국 30년 국채 변수 (YTM & 금리 인하폭) */}
                <div className="space-y-3 border-t lg:border-t-0 lg:border-l border-white/5 lg:pl-4">
                    <div>
                        <div className="flex justify-between font-semibold text-rose-300 mb-1">
                            <span>🇺🇸 미국 30년물 YTM</span>
                            <span className="font-bold">{usYield.toFixed(2)}%</span>
                        </div>
                        <input
                            type="range"
                            min={3.5}
                            max={5.5}
                            step={0.05}
                            value={usYield}
                            onChange={(e) => setUsYield(parseFloat(e.target.value))}
                            className="w-full accent-rose-500 cursor-pointer"
                        />
                    </div>
                    <div>
                        <div className="flex justify-between font-semibold text-gray-300 mb-1">
                            <span>연준 금리 인하 기대폭</span>
                            <span className="text-amber-300 font-bold">-{fedRateCutBp}bp 인하</span>
                        </div>
                        <input
                            type="range"
                            min={0}
                            max={150}
                            step={25}
                            value={fedRateCutBp}
                            onChange={(e) => setFedRateCutBp(parseInt(e.target.value))}
                            className="w-full accent-amber-500 cursor-pointer"
                        />
                        <span className="text-[10px] text-gray-500 block">
                            듀레이션 {usDuration}년 자본차익 +{(usDuration * (fedRateCutBp / 100)).toFixed(2)}%
                        </span>
                    </div>
                </div>

                {/* 4. 세금 및 프리셋 */}
                <div className="space-y-3 border-t md:border-t-0 md:border-l border-white/5 md:pl-4 flex flex-col justify-between">
                    <div>
                        <span className="text-gray-300 font-semibold block mb-2">세제 혜택 조건</span>
                        <label className="flex items-center gap-2 cursor-pointer bg-white/5 p-2 rounded-lg border border-white/10 hover:bg-white/10 transition">
                            <input
                                type="checkbox"
                                checked={applyTaxShield}
                                onChange={(e) => setApplyTaxShield(e.target.checked)}
                                className="accent-emerald-500 w-4 h-4 rounded"
                            />
                            <span className="text-[11px] text-gray-200">
                                브라질 국채 100% 비과세 & 미국채 15.4% 과세 차감
                            </span>
                        </label>
                    </div>

                    <div className="space-y-1">
                        <span className="text-[10px] text-gray-400 block font-semibold">대표 프리셋</span>
                        <div className="grid grid-cols-2 gap-1.5">
                            <button
                                onClick={() => {
                                    setBrlFxAnnualChange(-3.0);
                                    setFedRateCutBp(50);
                                }}
                                className="px-2 py-1 rounded bg-black/40 hover:bg-black/60 border border-white/5 text-[10px] text-gray-300 text-center"
                            >
                                📉 헤알 -3% & 미 인하 50bp
                            </button>
                            <button
                                onClick={() => {
                                    setBrlFxAnnualChange(0.0);
                                    setFedRateCutBp(25);
                                }}
                                className="px-2 py-1 rounded bg-black/40 hover:bg-black/60 border border-white/5 text-[10px] text-emerald-300 text-center"
                            >
                                🛡️ 헤알 보합 & 고쿠폰 완승
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* 메인 비주얼: 10개년 누적 자산 성장 궤적 Area 차트 */}
            <div className="bg-black/25 rounded-xl border border-white/5 p-4 md:p-5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-emerald-400" />
                        <h3 className="text-sm font-bold text-white">
                            10개년 누적 평가자산 시계열 성장 곡선 (단위: 만 원)
                        </h3>
                    </div>
                    <div className="flex items-center gap-4 text-xs font-semibold">
                        <span className="flex items-center gap-1.5 text-emerald-400">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                            브라질 국채 (비과세 복리 재투자)
                        </span>
                        <span className="flex items-center gap-1.5 text-rose-400">
                            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
                            미국 30년 국채 (세후 배당 + 자본차익)
                        </span>
                    </div>
                </div>

                <div className="h-64 sm:h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={simulationData} margin={{ top: 10, right: 10, bottom: 0, left: 10 }}>
                            <defs>
                                <linearGradient id="colorBrazil" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                                </linearGradient>
                                <linearGradient id="colorUs" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.4} />
                                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                            <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                            <YAxis
                                tick={{ fill: '#9ca3af', fontSize: 11 }}
                                tickFormatter={(v: number) => `${v.toLocaleString()}만`}
                                domain={['dataMin', 'auto']}
                            />
                            <Tooltip
                                contentStyle={STANDARD_TOOLTIP_STYLE}
                                formatter={(val: any, name: any) => [
                                    `${Number(val).toLocaleString()}만 원`,
                                    name === 'brazil' ? '브라질 국채 (비과세)' : '미국 30년 국채'
                                ]}
                            />
                            <Area
                                type="monotone"
                                dataKey="brazil"
                                name="brazil"
                                stroke="#10b981"
                                strokeWidth={2.5}
                                fillOpacity={1}
                                fill="url(#colorBrazil)"
                            />
                            <Area
                                type="monotone"
                                dataKey="us"
                                name="us"
                                stroke="#f43f5e"
                                strokeWidth={2.2}
                                strokeDasharray="4 2"
                                fillOpacity={1}
                                fill="url(#colorUs)"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* 하단 4대 정밀 분석 카드 그리드 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. 브라질 국채 최종 성과 */}
                <div className="bg-black/30 rounded-xl border border-emerald-500/20 p-4 space-y-2">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-emerald-400">🇧🇷 브라질 국채 ({holdingYears}년차)</span>
                        <span className="text-[10px] text-gray-400">비과세 복리</span>
                    </div>
                    <div className="text-xl font-black text-white">
                        {Math.round(brazilFinalWon / 10000).toLocaleString()}만 원
                    </div>
                    <div className="flex justify-between text-xs pt-1 border-t border-white/5">
                        <span className="text-gray-400">누적 수익률:</span>
                        <span className="font-extrabold text-emerald-400">
                            +{selectedResult.brazilCumulativeReturn}%
                        </span>
                    </div>
                    <p className="text-[10px] text-gray-500">
                        헤알화 연 {brlFxAnnualChange}% 변동 감안 후 세후 원리금 총액입니다.
                    </p>
                </div>

                {/* 2. 미국 30년 국채 최종 성과 */}
                <div className="bg-black/30 rounded-xl border border-rose-500/20 p-4 space-y-2">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-rose-400">🇺🇸 미국 30년 국채 ({holdingYears}년차)</span>
                        <span className="text-[10px] text-gray-400">15.4% 과세 차감</span>
                    </div>
                    <div className="text-xl font-black text-white">
                        {Math.round(usFinalWon / 10000).toLocaleString()}만 원
                    </div>
                    <div className="flex justify-between text-xs pt-1 border-t border-white/5">
                        <span className="text-gray-400">누적 수익률:</span>
                        <span className="font-extrabold text-rose-400">
                            +{selectedResult.usCumulativeReturn}%
                        </span>
                    </div>
                    <p className="text-[10px] text-gray-500">
                        금리 -{fedRateCutBp}bp 인하에 따른 듀레이션 차익(+{(usDuration * (fedRateCutBp / 100)).toFixed(1)}%) 반영치입니다.
                    </p>
                </div>

                {/* 3. 비과세 절감 세액 */}
                <div className="bg-black/30 rounded-xl border border-white/5 p-4 space-y-2">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-amber-300 flex items-center gap-1">
                            <ShieldCheck className="w-3.5 h-3.5" /> 비과세 세이브 효과
                        </span>
                        <span className="text-[10px] text-gray-400">금소세 완전 제외</span>
                    </div>
                    <div className="text-xl font-black text-amber-300">
                        +{Math.round(taxSavedWon / 10000).toLocaleString()}만 원
                    </div>
                    <div className="flex justify-between text-xs pt-1 border-t border-white/5">
                        <span className="text-gray-400">금융소득종합과세:</span>
                        <span className="font-bold text-emerald-400">0원 (합산 비대상)</span>
                    </div>
                    <p className="text-[10px] text-gray-500">
                        한-브 조세조약에 따라 15.4% 이자소득세 및 건보료 피부양자 박탈을 원천 차단합니다.
                    </p>
                </div>

                {/* 4. 손익분기 헤알화 하락폭 (BEP) */}
                <div className="bg-black/30 rounded-xl border border-white/5 p-4 space-y-2">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-sky-300 flex items-center gap-1">
                            <Sparkles className="w-3.5 h-3.5" /> 손익분기 헤알화 하락 한계
                        </span>
                        <span className="text-[10px] text-gray-400">BEP 마진</span>
                    </div>
                    <div className="text-xl font-black text-sky-300">
                        연 {bepBrlDeclinePct}%
                    </div>
                    <div className="flex justify-between text-xs pt-1 border-t border-white/5">
                        <span className="text-gray-400">현재 가정 하락폭:</span>
                        <span className="font-bold text-white">연 {brlFxAnnualChange}%</span>
                    </div>
                    <p className="text-[10px] text-gray-500">
                        헤알화가 연 {bepBrlDeclinePct}%보다 덜 떨어지면 무조건 브라질 국채가 승리합니다.
                    </p>
                </div>
            </div>

            {/* 하단 전문가 투자 전략 가이드 */}
            <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 flex items-start gap-3 text-xs text-gray-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                    <strong className="text-white block mb-0.5">포트폴리오 자산배분 황금 공식 가이드</strong>
                    <span>
                        브라질 국채는 <strong>연 10%의 압도적 비과세 쿠폰</strong>으로 매년 강력한 현금흐름 완충재 역할을 하며, 헤알화가 연 -4% 이상 급락하지 않는 한 대부분의 기간에서 미국 국채의 성과를 능가합니다. 반면 미국 30년 국채는 <strong>연준의 긴급 금리 인하(빅컷) 및 글로벌 경기 침체 시 안전자산 랠리</strong>로 강력한 자본차익 헤지를 제공하므로, 두 채권을 <strong>6:4 또는 5:5 비율로 분산 편입</strong>하는 것이 가장 이상적입니다.
                    </span>
                </div>
            </div>
        </section>
    );
}
