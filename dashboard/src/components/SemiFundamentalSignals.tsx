"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
    Activity,
    TrendingUp,
    TrendingDown,
    ChevronDown,
    ChevronUp,
    CheckCircle2,
    AlertCircle,
    Info,
    RefreshCw,
    Layers,
    Cpu,
    ArrowUpRight,
    ArrowDownRight,
    Sparkles,
} from "lucide-react";
import {
    ResponsiveContainer,
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip as RechartsTooltip,
} from "recharts";
import { API_BASE } from "../lib/apiConfig";

export default function SemiFundamentalSignals() {
    const [signalsData, setSignalsData] = useState<any>(null);
    const [industriesData, setIndustriesData] = useState<any>(null);
    const [selectedIndustry, setSelectedIndustry] = useState<string>("semiconductor");
    const [expandedSignalId, setExpandedSignalId] = useState<string | null>("lead_stock_drawdown");
    const [periodFilter, setPeriodFilter] = useState<{ [key: string]: "1Y" | "3Y" | "5Y" | "10Y" }>({
        lead_stock_drawdown: "5Y",
        sector_index: "5Y",
        kr_export_amount: "5Y",
        export_unit_price: "5Y",
        real_export_volume: "5Y",
        capacity_utilization: "5Y",
        inventory_index: "5Y",
    });
    const [isLoading, setIsLoading] = useState<boolean>(true);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [sigRes, indRes] = await Promise.all([
                fetch(`${API_BASE}/api/v1/analyze/semi-cycle/macro-signals?industry=${selectedIndustry}`, { cache: "no-store" }),
                fetch(`${API_BASE}/api/v1/analyze/semi-cycle/industries-summary`, { cache: "no-store" }),
            ]);
            if (sigRes.ok) setSignalsData(await sigRes.json());
            if (indRes.ok) setIndustriesData(await indRes.json());
        } catch (err) {
            console.error("Failed to fetch macro signals:", err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [selectedIndustry]);

    const toggleAccordion = (id: string) => {
        setExpandedSignalId(expandedSignalId === id ? null : id);
    };

    const handlePeriodChange = (signalId: string, p: "1Y" | "3Y" | "5Y" | "10Y", e: React.MouseEvent) => {
        e.stopPropagation();
        setPeriodFilter((prev) => ({ ...prev, [signalId]: p }));
    };

    if (isLoading && !signalsData) {
        return (
            <div className="w-full flex flex-col items-center justify-center p-12 bg-white/[0.02] border border-white/5 rounded-3xl backdrop-blur-xl">
                <RefreshCw className="w-7 h-7 text-emerald-400 animate-spin mb-3" />
                <p className="text-sm font-bold text-white">7대 실데이터 신호등 펀더멘털 엔진 연산 중...</p>
                <p className="text-xs text-gray-400 mt-1">대장주 시세, 관세청 수출액, 한은 단가/물량, 통계청 가동률/재고 집계 중</p>
            </div>
        );
    }

    const industries = industriesData?.industries || [];
    const signals = signalsData?.signals || [];
    const stages = signalsData?.stages || [];
    const timeline = signalsData?.timeline || [];

    return (
        <div className="w-full flex flex-col gap-5 animate-in fade-in duration-300">
            {/* 1. Top Industry Selector Bar (10대 업종) */}
            <div className="flex flex-col gap-2">
                <span className="text-[11px] font-bold text-gray-400">업종 선택 — 현재 {signalsData?.industry_kr || "반도체"}</span>
                <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
                    {industries.map((ind: any) => {
                        const isSelected = selectedIndustry === ind.id;
                        return (
                            <button
                                key={ind.id}
                                onClick={() => setSelectedIndustry(ind.id)}
                                className={`flex items-center gap-1.5 px-3 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all border ${
                                    isSelected
                                        ? "bg-indigo-600/20 text-indigo-300 border-indigo-500 shadow-md shadow-indigo-500/20"
                                        : "bg-[#161922] text-gray-300 border-white/10 hover:border-white/25 hover:text-white"
                                }`}
                            >
                                <span className="font-extrabold">{ind.name}</span>
                                {ind.is_partial && (
                                    <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                        일부
                                    </span>
                                )}
                                <span
                                    className="text-[10px] flex items-center gap-0.5 px-1.5 py-0.5 rounded-full font-semibold"
                                    style={{ color: ind.color, backgroundColor: `${ind.color}15` }}
                                >
                                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: ind.color }} />
                                    {ind.state}
                                    {ind.trend === "up" ? " ↗" : " ↘"}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* 2. Main 2-Split Grid View */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                {/* LEFT: 5단계 국면 진단 & 실데이터 종합 스코어카드 (5 Cols) */}
                <div className="lg:col-span-5 flex flex-col gap-4">
                    {/* 5국면 비교 바 */}
                    <div className="p-4 rounded-2xl bg-[#161922] border border-white/10 shadow-xl">
                        <span className="text-[11px] font-bold text-gray-400 block mb-2.5">
                            | {signalsData?.industry_kr} 사이클 5국면 — 눌러서 각 국면 비교
                        </span>
                        <div className="grid grid-cols-5 gap-1.5">
                            {stages.map((st: any) => {
                                const isCurrent = st.is_current;
                                return (
                                    <div
                                        key={st.id}
                                        className={`flex flex-col items-center justify-center p-2 rounded-xl text-center border transition-all ${
                                            isCurrent
                                                ? "bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-md shadow-emerald-500/20 ring-1 ring-emerald-400/50"
                                                : "bg-white/[0.02] border-white/5 text-gray-400 hover:text-gray-200"
                                        }`}
                                    >
                                        <span className="text-[10px] font-bold">{st.name}</span>
                                        <span className="text-[9px] text-gray-400">{st.action}</span>
                                        {isCurrent && (
                                            <span className="mt-1 px-1.5 py-0.2 rounded-full bg-emerald-500 text-black text-[8px] font-black">
                                                ● 현재
                                            </span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                        <div className="flex justify-end mt-2 text-[10px] text-gray-400 font-semibold">
                            정상 호황: <span className="text-emerald-400 font-bold ml-1">호황 {signalsData?.signals_count?.bullish}개</span>
                            <span className="text-gray-400 ml-1.5">· 중립 {signalsData?.signals_count?.neutral}개</span>
                            <span className="text-rose-400 ml-1.5">· 둔화 {signalsData?.signals_count?.bearish}개</span>
                        </div>
                    </div>

                    {/* 실시간 실데이터 자동 판정 카드 */}
                    <div className="p-5 rounded-2xl bg-gradient-to-b from-emerald-950/20 to-[#161922] border border-emerald-500/30 shadow-xl flex flex-col gap-3">
                        <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-bold">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                            <span>실시간 실데이터 자동 판정 · {signalsData?.signals_count?.bullish}/{signalsData?.signals_count?.total} 호황 신호</span>
                        </div>

                        <div>
                            <span className="text-[10px] text-gray-400">현재 {signalsData?.industry_kr} 사이클 국면 (실데이터 자동 판정)</span>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="w-3.5 h-3.5 rounded-full bg-emerald-400" />
                                <h3 className="text-2xl font-black text-white">{signalsData?.current_state}</h3>
                            </div>
                            <p className="text-[11px] text-gray-400 mt-0.5">대장주·수출·단가·가동률·재고 실데이터 종합</p>
                        </div>

                        {/* 국면 전환 추세 */}
                        <div className="text-xs text-gray-300 font-semibold pt-2 border-t border-white/5">
                            {signalsData?.state_transition}
                        </div>

                        {/* 12개월 소급 판정 타임라인 바 */}
                        <div className="flex flex-col gap-1">
                            <div className="flex gap-1 h-3 rounded-md overflow-hidden bg-black/40 p-0.5 border border-white/10">
                                {timeline.map((t: any, i: number) => (
                                    <div
                                        key={i}
                                        className="flex-1 rounded-sm transition-all hover:opacity-80"
                                        style={{ backgroundColor: t.color }}
                                        title={`${t.month}: ${t.state}`}
                                    />
                                ))}
                            </div>
                            <div className="flex justify-between text-[9px] text-gray-500 font-mono">
                                <span>{timeline[0]?.month}</span>
                                <span>월별 국면 (소급 판정)</span>
                                <span>현재</span>
                            </div>
                        </div>

                        {/* 코멘트 가이드 */}
                        <div className="p-3 rounded-xl bg-black/40 border border-white/10 text-xs font-bold text-gray-200 mt-1">
                            {signalsData?.summary_comment}
                        </div>

                        {/* 가중치 종합 점수 바 */}
                        <div className="pt-2">
                            <div className="flex justify-between text-xs font-semibold mb-1">
                                <span className="text-gray-300">지표 결과 · 가중 종합 <b className="text-emerald-300 font-mono">{signalsData?.weighted_score}</b></span>
                                <span className="text-[10px] text-gray-400">
                                    호황 <b className="text-emerald-400">{signalsData?.signals_count?.bullish}</b> · 중립 {signalsData?.signals_count?.neutral} · 둔화 {signalsData?.signals_count?.bearish}
                                </span>
                            </div>
                            <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden flex">
                                <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${signalsData?.score_gauge_pct}%` }} />
                                <div className="bg-amber-500 h-full rounded-full" style={{ width: `${100 - signalsData?.score_gauge_pct}%` }} />
                            </div>
                            <p className="text-[10px] text-gray-500 mt-1">
                                실데이터 7개 신호를 중요도로 가중 합산 — 카운트는 참고용이며 통계적 확률이 아닙니다
                            </p>
                        </div>
                    </div>
                </div>

                {/* RIGHT: 7대 실데이터 신호 아코디언 및 인터랙티브 차트 (7 Cols) */}
                <div className="lg:col-span-7 p-5 rounded-2xl bg-[#161922] border border-white/10 shadow-xl flex flex-col gap-3">
                    {/* Header */}
                    <div className="flex justify-between items-center pb-2 border-b border-white/10">
                        <h4 className="text-sm md:text-base font-bold text-white flex items-center gap-2">
                            <span className="w-1.5 h-4 bg-emerald-400 rounded-full" />
                            실데이터 신호 (실시간)
                        </h4>
                        <span className="px-2 py-0.5 rounded bg-emerald-500 text-black text-[10px] font-black uppercase tracking-wider">
                            LIVE
                        </span>
                    </div>

                    {/* Signals Accordion List */}
                    <div className="divide-y divide-white/5">
                        {signals.map((sig: any) => {
                            const isExpanded = expandedSignalId === sig.id;
                            const curPeriod = periodFilter[sig.id] || "5Y";
                            const rawSeries = sig.series_5y || [];

                            // 기간 필터링
                            const filteredSeries = curPeriod === "1Y" ? rawSeries.slice(-12) : curPeriod === "3Y" ? rawSeries.slice(-36) : rawSeries;

                            return (
                                <div key={sig.id} className="py-2.5 transition-colors">
                                    {/* Accordion Header Row */}
                                    <div
                                        onClick={() => toggleAccordion(sig.id)}
                                        className="flex justify-between items-center cursor-pointer p-2 rounded-xl hover:bg-white/[0.03] transition-all"
                                    >
                                        <div className="flex flex-col">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs md:text-sm font-bold text-white">{sig.name}</span>
                                                <span className="text-[11px] text-gray-400 font-normal">{sig.sub_name}</span>
                                            </div>
                                            <span className="text-[10px] text-gray-500 mt-0.5 flex items-center gap-1">
                                                {isExpanded ? <ChevronUp className="w-3 h-3 text-indigo-400" /> : <ChevronDown className="w-3 h-3 text-gray-500" />}
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-2 shrink-0">
                                            <span className="text-sm md:text-base font-mono font-black text-white">
                                                {sig.current_value_formatted}
                                            </span>
                                            {sig.sub_badge && (
                                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-bold">
                                                    {sig.sub_badge}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Accordion Expanded Content */}
                                    {isExpanded && (
                                        <div className="mt-3 p-4 rounded-2xl bg-black/40 border border-white/10 animate-in slide-in-from-top-2 fade-in duration-200">
                                            {/* Top Sub Header & Period Filter */}
                                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-3">
                                                <span className="text-[11px] text-gray-400 font-mono">
                                                    {sig.sub_name} ({sig.source})
                                                </span>
                                                <div className="flex items-center gap-2">
                                                    {/* Period Selector Toggle */}
                                                    <div className="flex items-center bg-black/60 border border-white/10 rounded-lg p-0.5 gap-1">
                                                        {(["1Y", "3Y", "5Y", "10Y"] as const).map((p) => (
                                                            <button
                                                                key={p}
                                                                onClick={(e) => handlePeriodChange(sig.id, p, e)}
                                                                className={`px-2 py-0.5 text-[10px] font-bold rounded transition-all ${
                                                                    curPeriod === p
                                                                        ? "bg-indigo-600 text-white shadow"
                                                                        : "text-gray-400 hover:text-white"
                                                                }`}
                                                            >
                                                                {p === "1Y" ? "1년" : p === "3Y" ? "3년" : p === "5Y" ? "5년" : "10년"}
                                                            </button>
                                                        ))}
                                                    </div>
                                                    <span className="text-[10px] text-gray-500 font-mono">{sig.data_points_count}</span>
                                                </div>
                                            </div>

                                            {/* High / Low Title */}
                                            <div className="text-base font-black text-gray-200 mb-2">
                                                최고 {sig.high_low?.high} · 최저 {sig.high_low?.low}
                                            </div>

                                            {/* Area Chart */}
                                            <div className="w-full h-[180px] bg-black/30 rounded-xl p-2 border border-white/5 relative">
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <AreaChart data={filteredSeries} margin={{ top: 10, right: 15, bottom: 5, left: 0 }}>
                                                        <defs>
                                                            <linearGradient id={`grad_${sig.id}`} x1="0" y1="0" x2="0" y2="1">
                                                                <stop offset="5%" stopColor={sig.chart_color} stopOpacity={0.4} />
                                                                <stop offset="95%" stopColor={sig.chart_color} stopOpacity={0.0} />
                                                            </linearGradient>
                                                        </defs>
                                                        <CartesianGrid stroke="rgba(255,255,255,0.03)" />
                                                        <XAxis
                                                            dataKey="date"
                                                            tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 9 }}
                                                            interval={Math.floor(filteredSeries.length / 5)}
                                                        />
                                                        <YAxis
                                                            domain={["auto", "auto"]}
                                                            tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 9 }}
                                                            orientation="right"
                                                        />
                                                        <RechartsTooltip
                                                            contentStyle={{
                                                                backgroundColor: "#12141c",
                                                                borderColor: "rgba(255,255,255,0.15)",
                                                                borderRadius: 10,
                                                                fontSize: 11,
                                                            }}
                                                            formatter={(val: any) => [val, sig.name]}
                                                        />
                                                        <Area
                                                            type="monotone"
                                                            dataKey="value"
                                                            stroke={sig.chart_color}
                                                            strokeWidth={2.2}
                                                            fill={`url(#grad_${sig.id})`}
                                                            dot={false}
                                                        />
                                                    </AreaChart>
                                                </ResponsiveContainer>
                                            </div>

                                            {/* Start - End Dates Label */}
                                            <div className="flex justify-between text-lg font-black text-gray-500 font-mono mt-2">
                                                <span>{filteredSeries[0]?.date}</span>
                                                <span className="text-gray-200">{filteredSeries[filteredSeries.length - 1]?.date}</span>
                                            </div>

                                            {/* Description Footer */}
                                            <p className="text-xs text-gray-300 mt-3 pt-2.5 border-t border-white/5 leading-relaxed">
                                                {sig.description}
                                            </p>

                                            {/* Fold Button */}
                                            <button
                                                onClick={() => setExpandedSignalId(null)}
                                                className="w-full mt-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-gray-300 hover:text-white transition-all text-center"
                                            >
                                                접기
                                            </button>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* Summary Footer */}
                    <div className="mt-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs font-bold text-emerald-300">
                        실데이터 종합: 호황 신호 ( 호황 {signalsData?.signals_count?.bullish} · 중립 {signalsData?.signals_count?.neutral} · 둔화 {signalsData?.signals_count?.bearish} )
                    </div>
                    <p className="text-[10px] text-gray-500 leading-relaxed">
                        {signalsData?.footnote}
                    </p>
                </div>
            </div>
        </div>
    );
}
