"use client";

import React, { useState, useEffect } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts';
import { DollarSign, ArrowRightLeft, TrendingUp, AlertTriangle, CheckCircle, HelpCircle } from 'lucide-react';

export default function FxFinder() {
    const [pairs, setPairs] = useState<any[]>([]);
    const [selectedPair, setSelectedPair] = useState<any>(null);
    const [analysisData, setAnalysisData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);

    // 1. Fetch currency pairs list
    useEffect(() => {
        const fetchPairs = async () => {
            try {
                const isCloud = window.location.hostname.includes('onrender.com') || window.location.hostname.includes('vercel.app');
                const url = isCloud
                    ? 'https://etf-lens.onrender.com/api/v1/analyze/etf/currency-pairs'
                    : `http://${window.location.hostname}:8000/api/v1/analyze/etf/currency-pairs`;
                const res = await fetch(url);
                const data = await res.json();
                if (Array.isArray(data) && data.length > 0) {
                    setPairs(data);
                    setSelectedPair(data[0]); // Default to first pair
                }
            } catch (err) {
                console.error("Error fetching currency pairs", err);
            }
        };
        fetchPairs();
    }, []);

    // 2. Fetch analysis and comparison data when selected pair changes
    useEffect(() => {
        if (!selectedPair) return;
        
        const fetchCompareData = async () => {
            setIsLoading(true);
            try {
                const isCloud = window.location.hostname.includes('onrender.com') || window.location.hostname.includes('vercel.app');
                const url = isCloud
                    ? `https://etf-lens.onrender.com/api/v1/analyze/etf/currency-compare?h_code=${selectedPair.hedged.code}&u_code=${selectedPair.unhedged.code}`
                    : `http://${window.location.hostname}:8000/api/v1/analyze/etf/currency-compare?h_code=${selectedPair.hedged.code}&u_code=${selectedPair.unhedged.code}`;
                const res = await fetch(url);
                const data = await res.json();
                if (data && !data.error) {
                    setAnalysisData(data);
                }
            } catch (err) {
                console.error("Error fetching comparison data", err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchCompareData();
    }, [selectedPair]);

    if (pairs.length === 0) {
        return null; // Don't render if no pairs available
    }

    return (
        <div className="bg-[#121217]/80 border border-white/10 rounded-3xl p-6 backdrop-blur-xl shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="flex justify-between items-center mb-6 border-b border-white/10 pb-4">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-indigo-500/10 rounded-xl border border-indigo-500/30 text-indigo-400">
                        <ArrowRightLeft className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-white">환율 인텔리전스</h3>
                        <p className="text-xs text-gray-400">동일 지수 추종 환헤지(H) vs 환노출 ETF 비교분석</p>
                    </div>
                </div>
                
                {/* Select dropdown */}
                <select
                    value={selectedPair ? JSON.stringify(selectedPair) : ''}
                    onChange={(e) => {
                        if (e.target.value) {
                            setSelectedPair(JSON.parse(e.target.value));
                        }
                    }}
                    className="bg-black/50 border border-white/15 rounded-xl px-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-indigo-500 transition-colors cursor-pointer font-sans"
                >
                    {pairs.map((p, idx) => (
                        <option key={idx} value={JSON.stringify(p)} className="bg-[#121217]">
                            {p.base_name}
                        </option>
                    ))}
                </select>
            </div>

            {isLoading || !analysisData ? (
                <div className="h-[320px] flex items-center justify-center text-xs text-gray-500 gap-2">
                    <div className="w-4 h-4 rounded-full border-2 border-indigo-500/30 border-t-indigo-500 animate-spin"></div>
                    환율 비교 엔진 로딩 중...
                </div>
            ) : (
                <div className="space-y-6">
                    {/* Comparison Banner */}
                    <div className="grid grid-cols-2 gap-4 bg-black/30 rounded-2xl border border-white/5 p-4 relative overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-cyan-500/5 opacity-50"></div>
                        <div className="relative z-10 flex flex-col">
                            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">환헤지 상품 (H)</span>
                            <span className="text-sm font-bold text-white truncate">{analysisData.hedged_info.name}</span>
                            <span className="text-xs text-gray-400 font-mono mt-0.5">{analysisData.hedged_info.code} • 보수 {analysisData.hedged_info.tot_fee}%</span>
                            <span className="text-lg font-mono font-black text-indigo-400 mt-2">
                                {analysisData.statistics.hedged_1y_return.toFixed(2)}%
                                <span className="text-[10px] text-gray-500 font-normal ml-1">1년 수익률</span>
                            </span>
                        </div>
                        <div className="relative z-10 flex flex-col border-l border-white/10 pl-4">
                            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">환노출 상품 (Unhedged)</span>
                            <span className="text-sm font-bold text-white truncate">{analysisData.unhedged_info.name}</span>
                            <span className="text-xs text-gray-400 font-mono mt-0.5">{analysisData.unhedged_info.code} • 보수 {analysisData.unhedged_info.tot_fee}%</span>
                            <span className="text-lg font-mono font-black text-emerald-400 mt-2">
                                {analysisData.statistics.unhedged_1y_return.toFixed(2)}%
                                <span className="text-[10px] text-gray-500 font-normal ml-1">1년 수익률</span>
                            </span>
                        </div>
                    </div>

                    {/* Chart Area */}
                    <div className="bg-black/20 rounded-2xl border border-white/5 p-4">
                        <div className="flex justify-between items-center mb-3">
                            <span className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
                                <TrendingUp className="w-3.5 h-3.5 text-indigo-400" />
                                최근 1년 성과 및 환율 오버레이 추이
                            </span>
                            <span className="text-[10px] text-gray-500 font-mono">
                                성과 격차: <span className="text-emerald-400 font-bold">+{analysisData.statistics.gap_1y}%p</span> (노출 우위)
                            </span>
                        </div>
                        <div className="w-full h-[180px] z-10">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={analysisData.chart_data} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                                    <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                                    <XAxis dataKey="date" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 9 }} axisLine={false} tickLine={false} />
                                    <YAxis tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 9 }} axisLine={false} tickLine={false} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: 'rgba(9, 9, 11, 0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '11px' }}
                                        itemStyle={{ color: '#fff' }}
                                    />
                                    <Line type="monotone" dataKey="unhedged_return" name="환노출 수익률 %" stroke="#10b981" strokeWidth={1.8} dot={false} />
                                    <Line type="monotone" dataKey="hedged_return" name="환헤지 수익률 %" stroke="#6366f1" strokeWidth={1.8} dot={false} />
                                    <Line type="monotone" dataKey="fx_return" name="원/달러 변동 %" stroke="#f59e0b" strokeWidth={1.2} strokeDasharray="3 3" dot={false} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Simulation Scenarios Grid */}
                    <div className="space-y-3">
                        <span className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
                            <DollarSign className="w-3.5 h-3.5 text-amber-400" />
                            미래 원/달러 환율 변동 시뮬레이션
                        </span>
                        
                        <div className="space-y-2">
                            {analysisData.scenarios.map((sc: any, idx: number) => {
                                const isUnhedgedBetter = sc.advantage_unhedged > 0;
                                return (
                                    <div key={idx} className="flex justify-between items-center bg-white/[0.02] border border-white/5 hover:border-white/10 rounded-xl p-3 text-xs transition-colors">
                                        <div className="flex flex-col">
                                            <span className="text-gray-300 font-semibold">{sc.label}</span>
                                            <span className="text-[10px] text-gray-500 font-mono mt-0.5">예상 환율: {sc.expected_fx}원</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="flex flex-col text-right font-mono">
                                                <span className="text-emerald-400 font-bold">{sc.unhedged_return > 0 ? '+' : ''}{sc.unhedged_return}% (노출)</span>
                                                <span className="text-indigo-400">{sc.hedged_return > 0 ? '+' : ''}{sc.hedged_return}% (헤지)</span>
                                            </div>
                                            <div className={`w-20 px-2 py-1 rounded text-[10px] font-bold text-center border ${
                                                isUnhedgedBetter 
                                                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                                                    : 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400'
                                            }`}>
                                                {isUnhedgedBetter ? '환노출 유리' : '환헤지 유리'}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Hedge Cost Indicator */}
                    <div className="bg-black/30 border border-white/5 rounded-2xl p-3.5 flex items-start gap-3">
                        <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                        <div className="text-[11px] text-gray-400 leading-relaxed">
                            <span className="text-white font-semibold">헤징 비용 진단:</span> 본 페어는 연평균 환헤지 비용이 약 <span className="text-amber-400 font-mono font-semibold">{analysisData.statistics.estimated_annual_hedge_cost}%</span>로 추정됩니다. 원화 약세(환율 상승)가 예상되거나 환율 보합세 유지 시에도 환헤지 비용 누적으로 인해 <span className="text-emerald-400 font-semibold">환노출(Unhedged) ETF</span>가 더 유리할 수 있습니다.
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
