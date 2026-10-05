"use client";

import React, { useState, useEffect } from 'react';
import { ResponsiveContainer, LineChart, ComposedChart, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid, ReferenceArea, ReferenceLine, LabelList } from 'recharts';
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

                    {/* Simulation Scenarios — 환율 변화(가로) 하나의 축에서 환노출·환헤지 수익률 비교 */}
                    <ScenarioChart data={analysisData} />

                    {/* Hedge Cost Indicator */}
                    <div className="bg-black/30 border border-white/5 rounded-2xl p-3.5 flex items-start gap-3">
                        <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                        <div className="text-[11px] text-gray-400 leading-relaxed">
                            <span className="text-white font-semibold">헤징 비용 진단:</span> 시뮬레이션은 연평균 환헤지 비용을 약 <span className="text-amber-400 font-mono font-semibold">{analysisData.statistics.estimated_annual_hedge_cost}%</span>로 가정했습니다(실제 비용은 한·미 단기금리 차이에 따라 달라짐). 원화 약세(환율 상승)가 예상되거나 환율 보합세 유지 시에도 환헤지 비용 누적으로 인해 <span className="text-emerald-400 font-semibold">환노출(Unhedged) ETF</span>가 더 유리할 수 있습니다.
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

const SIGN = (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(2)}%`;
const X_MIN = -17, X_MAX = 17;

// 원/달러 변화율(가로) 한 축 위에 환노출(기울어진 선)과 환헤지(수평선)를 겹쳐, 어느 지점부터 유리·불리가 바뀌는지 보여 준다
function ScenarioChart({ data }: { data: any }) {
    const st = data.statistics || {};
    const rows = (data.scenarios || []).map((sc: any) => ({
        x: sc.fx_change_pct, u: sc.unhedged_return, h: sc.hedged_return, fx: sc.expected_fx, label: sc.label, adv: sc.advantage_unhedged,
    }));
    if (!rows.length) return null;
    const be = typeof st.breakeven_fx_change === 'number' ? st.breakeven_fx_change : null;
    const fxNow = st.fx_now ?? rows.find((r: any) => r.x === 0)?.fx;
    const beFx = be != null && fxNow ? Math.round(fxNow * (1 + be / 100)) : null;
    const staleDays = st.end_date ? Math.floor((Date.now() - Date.parse(st.end_date)) / 86400000) : 0;
    return (
        <div className="bg-black/20 rounded-2xl border border-white/5 p-4 space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
                    <DollarSign className="w-3.5 h-3.5 text-amber-400" />
                    미래 원/달러 환율 변동 시뮬레이션
                </span>
                <span className="text-[10px] text-gray-500">
                    기준 환율 {fxNow ? Math.round(fxNow).toLocaleString('ko-KR') : '-'}원{st.fx_now_date ? ` (${st.fx_now_date})` : ''} · 지수 수익률은 최근 1년 환헤지 수익률 {SIGN(rows[0].h)}로 가정
                </span>
            </div>
            {staleDays > 30 && (
                <p className="text-[11px] text-amber-300/90">ETF 가격 기준일이 {st.end_date}({staleDays}일 전)라 1년 수익률이 최신이 아닙니다.</p>
            )}
            <div className="w-full h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={rows} margin={{ top: 22, right: 16, left: -10, bottom: 4 }}>
                        <CartesianGrid stroke="rgba(255,255,255,0.05)" />
                        {be != null && <ReferenceArea x1={X_MIN} x2={be} fill="#6366f1" fillOpacity={0.08} ifOverflow="hidden"
                            label={{ value: '환헤지 유리', position: 'insideTopLeft', fill: '#a5b4fc', fontSize: 10 }} />}
                        {be != null && <ReferenceArea x1={be} x2={X_MAX} fill="#10b981" fillOpacity={0.07} ifOverflow="hidden"
                            label={{ value: '환노출 유리', position: 'insideTopRight', fill: '#6ee7b7', fontSize: 10 }} />}
                        <XAxis dataKey="x" type="number" domain={[X_MIN, X_MAX]} ticks={rows.map((r: any) => r.x)} interval={0}
                            tickFormatter={(v: number) => `${v > 0 ? '+' : ''}${v}%`} tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }}
                            label={{ value: '원/달러 변화 (← 원화 강세 · 원화 약세 →)', position: 'insideBottom', offset: -2, fill: 'rgba(255,255,255,0.35)', fontSize: 9 }} height={34} />
                        <YAxis tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }} tickFormatter={(v: number) => `${v}%`} domain={['auto', 'auto']} />
                        {be != null && <ReferenceLine x={be} stroke="#f59e0b" strokeDasharray="4 3"
                            label={{ value: `손익분기 ${be > 0 ? '+' : ''}${be}%${beFx ? ` (≈${beFx.toLocaleString('ko-KR')}원)` : ''}`, position: 'top', fill: '#fbbf24', fontSize: 10 }} />}
                        <Tooltip
                            contentStyle={{ backgroundColor: 'rgba(9, 9, 11, 0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '11px' }}
                            labelFormatter={(x: any) => { const r = rows.find((q: any) => q.x === x); return r ? `${r.label} · 예상 환율 ${Math.round(r.fx).toLocaleString('ko-KR')}원` : `${x}%`; }}
                            formatter={(v: any, name: any) => [typeof v === 'number' ? SIGN(v) : v, name]} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Line dataKey="u" name="환노출 수익률" stroke="#10b981" strokeWidth={2.2} dot={{ r: 4 }} isAnimationActive={false}>
                            <LabelList dataKey="u" position="top" formatter={(v: any) => SIGN(Number(v))} style={{ fill: '#6ee7b7', fontSize: 10 }} />
                        </Line>
                        <Line dataKey="h" name="환헤지 수익률" stroke="#818cf8" strokeWidth={2} strokeDasharray="6 3" dot={{ r: 3 }} isAnimationActive={false} />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-[11px] font-mono">
                    <thead><tr className="text-gray-500 border-b border-white/10">
                        <th className="text-left py-1 font-sans font-bold">원/달러</th>
                        {rows.map((r: any) => <th key={r.x} className="text-right font-bold">{r.x > 0 ? '+' : ''}{r.x}%<span className="block text-[10px] text-gray-500 font-normal">{Math.round(r.fx).toLocaleString('ko-KR')}원</span></th>)}
                    </tr></thead>
                    <tbody>
                        <tr className="border-b border-white/5"><td className="py-1 font-sans text-emerald-400">환노출</td>{rows.map((r: any) => <td key={r.x} className="text-right text-emerald-300">{SIGN(r.u)}</td>)}</tr>
                        <tr className="border-b border-white/5"><td className="py-1 font-sans text-indigo-400">환헤지</td>{rows.map((r: any) => <td key={r.x} className="text-right text-indigo-300">{SIGN(r.h)}</td>)}</tr>
                        <tr><td className="py-1 font-sans text-gray-400">유리</td>{rows.map((r: any) => <td key={r.x} className={`text-right font-sans font-bold ${r.adv > 0 ? 'text-emerald-400' : 'text-indigo-400'}`}>{r.adv > 0 ? '환노출' : '환헤지'}</td>)}</tr>
                    </tbody>
                </table>
            </div>
            <p className="text-[10px] text-gray-500 leading-relaxed">
                환헤지는 환율과 무관하게 같은 수익률(수평 점선)이고, 환노출은 원/달러가 오를수록 수익률이 함께 오릅니다(초록 선).
                두 선이 만나는 손익분기보다 원화가 더 강해지면(왼쪽) 환헤지, 그 밖에서는 환노출이 유리합니다. 단순 가정에 따른 참고 계산입니다.
            </p>
        </div>
    );
}
