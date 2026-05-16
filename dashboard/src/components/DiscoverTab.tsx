"use client";

import React, { useState } from 'react';
import { Activity, X } from 'lucide-react';
import KospiExitAnalyzer from '@/components/KospiExitAnalyzer';
import MacroCompass from '@/components/MacroCompass';
import AIInsight from '@/components/AIInsight';

export default function DiscoverTab() {
    const [selectedPopup, setSelectedPopup] = useState<'inflation' | 'cpi' | null>(null);

    return (
        <div className="w-full animate-in fade-in slide-in-from-bottom-2 duration-500 bg-[#121217]/80 p-4 lg:p-6 border border-white/10 rounded-3xl backdrop-blur-3xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] mt-0">
            <div className="flex flex-col gap-3 w-full h-full">

                {/* Top: KOSPI Exit Analyzer */}
                <KospiExitAnalyzer />

                {/* Section Title: US Economic Indicators */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mt-2 mb-2 bg-black/20 p-4 rounded-xl border border-white/5 backdrop-blur-md w-full">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 shrink-0">
                            <Activity className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <div className="flex flex-wrap items-center gap-3">
                                <h2 className="text-xl font-extrabold text-white">미국 경기 지표</h2>
                            </div>
                            <p className="text-sm text-gray-400 font-medium mt-0.5">글로벌 매크로 인플레이션 및 소비자물가지수 등락</p>
                        </div>
                    </div>
                </div>

                {/* US Macroecon Indicators (Inflation & CPI) */}
                <div className="flex flex-col lg:flex-row gap-3 w-full">
                    {/* US Inflation Rate */}
                    <div className="w-full lg:w-1/2 bg-[#121217]/60 border border-white/10 rounded-3xl p-4 xl:p-5 backdrop-blur-md shadow-xl flex flex-col h-[400px]">
                        <h3 className="text-base font-bold text-white/90 mb-3 flex items-center gap-2">
                            <Activity className="w-4 h-4 text-rose-400" />
                            미국 인플레이션율 (TradingEconomics)
                        </h3>
                        <div
                            className="flex-1 w-full bg-white rounded-xl overflow-hidden relative cursor-pointer hover:ring-2 hover:ring-indigo-500 transition-all"
                            onClick={() => setSelectedPopup('inflation')}
                        >
                            <div className="absolute inset-0 z-10 bg-transparent"></div>
                            <iframe
                                src="https://ko.tradingeconomics.com/united-states/inflation-cpi"
                                className="absolute -top-[180px] -left-[10px] w-[1200px] h-[800px] scale-[0.6] origin-top-left pointer-events-none"
                                title="US Inflation"
                            />
                        </div>
                    </div>

                    {/* US CPI YoY */}
                    <div className="w-full lg:w-1/2 bg-[#121217]/60 border border-white/10 rounded-3xl p-4 xl:p-5 backdrop-blur-md shadow-xl flex flex-col h-[400px]">
                        <h3 className="text-base font-bold text-white/90 mb-3 flex items-center gap-2">
                            <Activity className="w-4 h-4 text-emerald-400" />
                            미국 소비자물가지수(CPI) 전년 대비 (Investing.com)
                        </h3>
                        <div
                            className="flex-1 w-full bg-white rounded-xl overflow-hidden relative cursor-pointer hover:ring-2 hover:ring-indigo-500 transition-all"
                            onClick={() => setSelectedPopup('cpi')}
                        >
                            <div className="absolute inset-0 z-10 bg-transparent"></div>
                            <iframe
                                src="https://kr.investing.com/economic-calendar/cpi-733"
                                className="absolute -top-[250px] -left-[10px] w-[1200px] h-[800px] scale-[0.6] origin-top-left pointer-events-none"
                                title="US CPI YoY"
                            />
                        </div>
                    </div>
                </div>

                {/* AI 매크로 로테이션 나침반 (미국/한국 분석) */}
                <MacroCompass />

                {/* AI Insight - 전문가 시장 분석 */}
                <AIInsight />

            </div>

            {/* Fullscreen Modal for Charts */}
            {selectedPopup && (
                <div
                    className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4 lg:p-10 animate-in fade-in duration-200"
                    onClick={() => setSelectedPopup(null)}
                >
                    <div
                        className="relative w-full max-w-[900px] h-[80vh] bg-white rounded-2xl overflow-hidden shadow-2xl"
                        onClick={e => e.stopPropagation()}
                    >
                        <button
                            onClick={() => setSelectedPopup(null)}
                            className="absolute top-4 right-4 z-20 p-2 bg-gray-900/50 hover:bg-rose-500 border border-white/20 transition-colors rounded-full text-white backdrop-blur-sm"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        {selectedPopup === 'inflation' ? (
                            <iframe
                                src="https://ko.tradingeconomics.com/united-states/inflation-cpi"
                                className="absolute -top-[180px] -left-[10px] w-[1200px] h-[1200px] scale-[0.8] origin-top-left"
                                title="US Inflation Expanded"
                            />
                        ) : (
                            <iframe
                                src="https://kr.investing.com/economic-calendar/cpi-733"
                                className="absolute -top-[250px] -left-[10px] w-[1200px] h-[1200px] scale-[0.8] origin-top-left"
                                title="US CPI YoY Expanded"
                            />
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
