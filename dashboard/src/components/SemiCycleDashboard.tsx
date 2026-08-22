"use client";

import React, { useState, useEffect } from "react";
import {
    Activity,
    Compass,
    TrendingUp,
    TrendingDown,
    Layers,
    Cpu,
    Target,
    BarChart3,
    ArrowUpRight,
    Sparkles,
    CheckCircle2,
    AlertTriangle,
    ShieldAlert,
    RefreshCw,
    Server,
    Zap,
} from "lucide-react";
import {
    ResponsiveContainer,
    ScatterChart,
    Scatter,
    XAxis,
    YAxis,
    ZAxis,
    CartesianGrid,
    Tooltip as RechartsTooltip,
    ReferenceLine,
    ComposedChart,
    Bar,
    Line,
    Legend,
    Cell,
} from "recharts";
import { API_BASE } from "../lib/apiConfig";

interface SemiCycleDashboardProps {
    onOpenDetail?: (code: string) => void;
}

const PHASE_COLORS: { [key: number]: { bg: string; text: string; border: string; badge: string; glow: string } } = {
    1: {
        bg: "bg-rose-500/10",
        text: "text-rose-400",
        border: "border-rose-500/30",
        badge: "bg-rose-500/20 text-rose-300 border-rose-500/40",
        glow: "shadow-rose-500/20",
    },
    2: {
        bg: "bg-sky-500/10",
        text: "text-sky-400",
        border: "border-sky-500/30",
        badge: "bg-sky-500/20 text-sky-300 border-sky-500/40",
        glow: "shadow-sky-500/20",
    },
    3: {
        bg: "bg-emerald-500/10",
        text: "text-emerald-400",
        border: "border-emerald-500/30",
        badge: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
        glow: "shadow-emerald-500/20",
    },
    4: {
        bg: "bg-amber-500/10",
        text: "text-amber-400",
        border: "border-amber-500/30",
        badge: "bg-amber-500/20 text-amber-300 border-amber-500/40",
        glow: "shadow-amber-500/20",
    },
};

const CustomScatterTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    const isCurrent = d.label?.includes("현재");
    return (
        <div className="bg-[#12141c]/95 border border-white/15 rounded-xl p-3 shadow-2xl backdrop-blur-xl text-xs">
            <div className="flex items-center gap-1.5 font-bold text-white mb-1.5">
                {isCurrent && <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />}
                <span className={isCurrent ? "text-emerald-300 font-extrabold" : "text-gray-200"}>{d.date} ({d.label})</span>
            </div>
            <div className="space-y-1 text-[11px]">
                <p className="text-gray-300">
                    CSCI 종합 점수: <span className="font-mono font-bold text-indigo-300">{d.csci}</span>
                </p>
                <p className="text-gray-400">
                    재고 건전성 (X): <span className="font-mono text-gray-200">{d.x}σ</span>
                </p>
                <p className="text-gray-400">
                    수요/수출 모멘텀 (Y): <span className="font-mono text-gray-200">{d.y}σ</span>
                </p>
                <p className="text-gray-400">
                    국면: <span className="font-bold text-white">Phase {d.phase}</span>
                </p>
            </div>
        </div>
    );
};

export default function SemiCycleDashboard({ onOpenDetail }: SemiCycleDashboardProps) {
    const [clockData, setClockData] = useState<any>(null);
    const [trackerData, setTrackerData] = useState<any>(null);
    const [subsectorData, setSubsectorData] = useState<any>(null);
    const [strategyData, setStrategyData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [activeSubTab, setActiveSubTab] = useState<"overview" | "clock" | "capex" | "subsector" | "etf">("overview");

    const fetchAllData = async () => {
        setIsLoading(true);
        try {
            const [clockRes, trackerRes, subsectorRes, strategyRes] = await Promise.all([
                fetch(`${API_BASE}/api/v1/analyze/semi-cycle/clock`, { cache: "no-store" }),
                fetch(`${API_BASE}/api/v1/analyze/semi-cycle/tracker`, { cache: "no-store" }),
                fetch(`${API_BASE}/api/v1/analyze/semi-cycle/subsectors`, { cache: "no-store" }),
                fetch(`${API_BASE}/api/v1/analyze/semi-cycle/strategy`, { cache: "no-store" }),
            ]);

            if (clockRes.ok) setClockData(await clockRes.json());
            if (trackerRes.ok) setTrackerData(await trackerRes.json());
            if (subsectorRes.ok) setSubsectorData(await subsectorRes.json());
            if (strategyRes.ok) setStrategyData(await strategyRes.json());
        } catch (err) {
            console.error("Failed to fetch semi cycle data:", err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchAllData();
    }, []);

    if (isLoading) {
        return (
            <div className="w-full flex flex-col items-center justify-center p-16 bg-white/[0.02] border border-white/5 rounded-3xl backdrop-blur-xl">
                <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin mb-3" />
                <p className="text-sm font-bold text-white">반도체 매크로 사이클 퀀트 엔진 연산 중...</p>
                <p className="text-xs text-gray-400 mt-1">빅테크 CapEx, 관세청 반도체 수출 통계, 글로벌 DOI 롤링 Z-Score 정규화 중</p>
            </div>
        );
    }

    const currentPhase = clockData?.current_phase || 3;
    const phaseInfo = clockData?.phase_info || {};
    const phaseStyle = PHASE_COLORS[currentPhase] || PHASE_COLORS[3];
    const trajectory = clockData?.trajectory || [];

    return (
        <div className="w-full flex flex-col gap-6 animate-in fade-in duration-300">
            {/* 1. Top Executive Banner (현재 사이클 진단 요약) */}
            <div className={`p-5 rounded-2xl ${phaseStyle.bg} border ${phaseStyle.border} flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden shadow-xl`}>
                <div className="flex items-start gap-3.5 z-10">
                    <div className={`p-3 rounded-xl bg-black/40 border ${phaseStyle.border} ${phaseStyle.text}`}>
                        <Compass className="w-6 h-6 animate-pulse" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2.5 flex-wrap">
                            <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-black/40 text-gray-300 border border-white/10 tracking-wider">
                                CSCI 퀀트 프레임워크
                            </span>
                            <span className={`text-xs font-black px-2.5 py-0.5 rounded-full border ${phaseStyle.badge}`}>
                                Phase {currentPhase} : {phaseInfo.name} ({phaseInfo.stage_kr})
                            </span>
                            <span className="text-[11px] font-mono text-gray-400">
                                CSCI 지수: <b className="text-white font-bold">{clockData?.current_csci}σ</b>
                            </span>
                        </div>
                        <h3 className="text-base md:text-lg font-black text-white mt-1.5">
                            {phaseInfo.description}
                        </h3>
                        <p className="text-xs text-gray-300 mt-1 flex items-center gap-1.5">
                            <span className="font-bold text-indigo-300">💡 핵심 자산배분 권고:</span> {phaseInfo.strategy}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 self-end md:self-center shrink-0 z-10">
                    <button
                        onClick={fetchAllData}
                        className="px-3 py-1.5 rounded-xl bg-black/30 hover:bg-black/50 border border-white/10 text-gray-300 hover:text-white text-xs font-semibold transition-all flex items-center gap-1.5"
                    >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>데이터 갱신</span>
                    </button>
                </div>
            </div>

            {/* 2. Sub-Navigation Tabs */}
            <div className="flex gap-2 border-b border-white/10 pb-3 overflow-x-auto">
                {[
                    { id: "overview", label: "종합 대시보드", icon: <Layers className="w-3.5 h-3.5" /> },
                    { id: "clock", label: "사이클 시계 (2D Quadrant)", icon: <Compass className="w-3.5 h-3.5" /> },
                    { id: "capex", label: "빅테크 CapEx 트래커", icon: <Server className="w-3.5 h-3.5" /> },
                    { id: "subsector", label: "서브섹터 밸류에이션 맵", icon: <Cpu className="w-3.5 h-3.5" /> },
                    { id: "etf", label: "국면별 최적 ETF 매트릭스", icon: <Target className="w-3.5 h-3.5" /> },
                ].map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveSubTab(tab.id as any)}
                        className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                            activeSubTab === tab.id
                                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30"
                                : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white"
                        }`}
                    >
                        {tab.icon}
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* 3. Tab Contents */}

            {/* TAB: OVERVIEW & CLOCK */}
            {(activeSubTab === "overview" || activeSubTab === "clock") && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                    {/* 2D Cycle Clock Visualizer (7 Cols) */}
                    <div className="lg:col-span-7 p-5 rounded-2xl bg-[#161922] border border-white/10 shadow-xl flex flex-col justify-between">
                        <div className="flex justify-between items-start mb-2">
                            <div>
                                <h4 className="text-sm md:text-base font-bold text-white flex items-center gap-2">
                                    <Compass className="w-4 h-4 text-indigo-400" />
                                    Semiconductor Cycle Clock (반도체 4국면 사이클 시계)
                                </h4>
                                <p className="text-[11px] text-gray-400 mt-0.5">
                                    X축: 재고 건전성 (DOI 역수) · Y축: 출하/수출 모멘텀 · 점: 최근 12개월 이동 궤적
                                </p>
                            </div>
                            <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">
                                시계방향 회전
                            </span>
                        </div>

                        {/* 4 Quadrants Diagram via ScatterChart */}
                        <div className="relative w-full h-[360px] my-2 bg-black/40 rounded-xl border border-white/5 overflow-hidden">
                            {/* 사분면 배경 레이블 */}
                            <div className="absolute top-3 right-4 text-right pointer-events-none z-0">
                                <span className="text-xs font-bold text-emerald-400/80">Phase 3: 적극적 재고 축적</span>
                                <p className="text-[9px] text-gray-500">호황기 · 출하↑ 가격↑ 실적폭발</p>
                            </div>
                            <div className="absolute top-3 left-4 text-left pointer-events-none z-0">
                                <span className="text-xs font-bold text-sky-400/80">Phase 2: 소극적 재고 소진</span>
                                <p className="text-[9px] text-gray-500">회복기 · 단가반등 재고감소 매수최적</p>
                            </div>
                            <div className="absolute bottom-3 left-4 text-left pointer-events-none z-0">
                                <span className="text-xs font-bold text-rose-400/80">Phase 1: 적극적 재고 소진</span>
                                <p className="text-[9px] text-gray-500">불황기 · 출하↓ 가격↓ 바닥권</p>
                            </div>
                            <div className="absolute bottom-3 right-4 text-right pointer-events-none z-0">
                                <span className="text-xs font-bold text-amber-400/80">Phase 4: 소극적 재고 축적</span>
                                <p className="text-[9px] text-gray-500">고점경보 · 마진피크 분할차익실현</p>
                            </div>

                            <ResponsiveContainer width="100%" height="100%">
                                <ScatterChart margin={{ top: 30, right: 30, bottom: 30, left: 30 }}>
                                    <CartesianGrid stroke="rgba(255,255,255,0.05)" />
                                    <XAxis
                                        type="number"
                                        dataKey="x"
                                        name="재고 건전성 (Z-Score)"
                                        domain={[-2.0, 2.0]}
                                        tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 9 }}
                                        tickFormatter={(v) => `${v}σ`}
                                        label={{ value: "재고 건전성 (DOI 감소 → 우측)", position: "insideBottom", offset: -15, fill: "rgba(255,255,255,0.3)", fontSize: 10 }}
                                    />
                                    <YAxis
                                        type="number"
                                        dataKey="y"
                                        name="수출/출하 모멘텀 (Z-Score)"
                                        domain={[-2.0, 2.0]}
                                        tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 9 }}
                                        tickFormatter={(v) => `${v}σ`}
                                        label={{ value: "수출/출하 모멘텀 (↑)", angle: -90, position: "insideLeft", offset: 15, fill: "rgba(255,255,255,0.3)", fontSize: 10 }}
                                    />
                                    <ZAxis range={[50, 180]} />
                                    <RechartsTooltip content={<CustomScatterTooltip />} />
                                    {/* 0축 기준선 */}
                                    <ReferenceLine x={0} stroke="rgba(255,255,255,0.2)" strokeDasharray="3 3" />
                                    <ReferenceLine y={0} stroke="rgba(255,255,255,0.2)" strokeDasharray="3 3" />
                                    {/* 이동 궤적 Scatter */}
                                    <Scatter
                                        name="12M Trajectory"
                                        data={trajectory}
                                        fill="#6366f1"
                                        line={{ stroke: "#6366f1", strokeWidth: 1.5, strokeDasharray: "2 2" }}
                                        shape={(props: any) => {
                                            const { cx, cy, payload } = props;
                                            const isLast = payload.label?.includes("현재");
                                            return (
                                                <g>
                                                    {isLast ? (
                                                        <>
                                                            <circle cx={cx} cy={cy} r={9} fill="#10b981" opacity={0.3} className="animate-ping" />
                                                            <circle cx={cx} cy={cy} r={6} fill="#10b981" stroke="#ffffff" strokeWidth={2} />
                                                        </>
                                                    ) : (
                                                        <circle cx={cx} cy={cy} r={3.5} fill="#6366f1" opacity={0.7} />
                                                    )}
                                                </g>
                                            );
                                        }}
                                    />
                                </ScatterChart>
                            </ResponsiveContainer>
                        </div>

                        {/* 4국면 설명 요약 가이드 */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] mt-2 pt-3 border-t border-white/5">
                            <div className="p-2 rounded-lg bg-rose-500/5 border border-rose-500/10">
                                <span className="font-bold text-rose-400">Phase 1: 불황기</span>
                                <p className="text-gray-400 mt-0.5">DOI 피크 · 언더웨이트</p>
                            </div>
                            <div className="p-2 rounded-lg bg-sky-500/5 border border-sky-500/10">
                                <span className="font-bold text-sky-400">Phase 2: 회복기</span>
                                <p className="text-gray-400 mt-0.5">스팟가 반등 · 적극매수</p>
                            </div>
                            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                                <span className="font-bold text-emerald-300">Phase 3: 호황기 (현재)</span>
                                <p className="text-gray-400 mt-0.5">증설/소부장 발주 · 홀딩</p>
                            </div>
                            <div className="p-2 rounded-lg bg-amber-500/5 border border-amber-500/10">
                                <span className="font-bold text-amber-400">Phase 4: 고점기</span>
                                <p className="text-gray-400 mt-0.5">CapEx 둔화 · 차익실현</p>
                            </div>
                        </div>
                    </div>

                    {/* CSCI Factor Weights & Diagnostic Card (5 Cols) */}
                    <div className="lg:col-span-5 flex flex-col gap-4">
                        {/* CSCI 지수 구성 및 가중치 카드 */}
                        <div className="p-5 rounded-2xl bg-[#161922] border border-white/10 shadow-xl">
                            <h4 className="text-sm font-bold text-white flex items-center gap-2 mb-3">
                                <Activity className="w-4 h-4 text-emerald-400" />
                                CSCI 복합 사이클 지수 분해
                            </h4>
                            <div className="space-y-3">
                                <div>
                                    <div className="flex justify-between text-xs mb-1">
                                        <span className="text-gray-300 font-semibold">1. 선행 지표 (Leading Factor)</span>
                                        <span className="font-mono text-indigo-300 font-bold">40%</span>
                                    </div>
                                    <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
                                        <div className="bg-indigo-500 h-full rounded-full" style={{ width: "40%" }} />
                                    </div>
                                    <p className="text-[10px] text-gray-500 mt-0.5">빅테크 4사 CapEx 증가율, 선단 팹 WFE 장비 수주</p>
                                </div>

                                <div>
                                    <div className="flex justify-between text-xs mb-1">
                                        <span className="text-gray-300 font-semibold">2. 동행 지표 (Coincident Factor)</span>
                                        <span className="font-mono text-emerald-300 font-bold">40%</span>
                                    </div>
                                    <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
                                        <div className="bg-emerald-500 h-full rounded-full" style={{ width: "40%" }} />
                                    </div>
                                    <p className="text-[10px] text-gray-500 mt-0.5">관세청 반도체 수출 통계, D램 고정가/스팟가 스프레드</p>
                                </div>

                                <div>
                                    <div className="flex justify-between text-xs mb-1">
                                        <span className="text-gray-300 font-semibold">3. 후행 지표 (Lagging Factor)</span>
                                        <span className="font-mono text-amber-300 font-bold">20%</span>
                                    </div>
                                    <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
                                        <div className="bg-amber-500 h-full rounded-full" style={{ width: "20%" }} />
                                    </div>
                                    <p className="text-[10px] text-gray-500 mt-0.5">메모리 제조사 재고일수(DOI), 12M Fwd P/E 백분위</p>
                                </div>
                            </div>
                        </div>

                        {/* Top Sub-Sectors in Phase 3 */}
                        <div className="p-5 rounded-2xl bg-[#161922] border border-white/10 shadow-xl flex-1 flex flex-col justify-between">
                            <div>
                                <h4 className="text-sm font-bold text-white flex items-center gap-2 mb-2">
                                    <Zap className="w-4 h-4 text-amber-400" />
                                    현재 국면(Phase 3) 집중 수혜 서브섹터
                                </h4>
                                <div className="space-y-2 mt-3">
                                    {phaseInfo.top_subsectors?.map((sub: string, i: number) => (
                                        <div key={i} className="flex items-center gap-2.5 p-2 rounded-xl bg-white/[0.03] border border-white/5 text-xs text-gray-200">
                                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                            <span>{sub}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="mt-4 pt-3 border-t border-white/5 text-[11px] text-gray-400">
                                💡 장비/소부장 발주가 정점에 달하며 이익이 폭발하는 구간으로, 레버리지 유지 및 이익 극대화 전략이 유효합니다.
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB: CAPEX TRACKER */}
            {(activeSubTab === "overview" || activeSubTab === "capex") && trackerData && (
                <div className="p-5 rounded-2xl bg-[#161922] border border-white/10 shadow-xl flex flex-col gap-4">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                        <div>
                            <h4 className="text-sm md:text-base font-bold text-white flex items-center gap-2">
                                <Server className="w-4 h-4 text-purple-400" />
                                Hyperscaler CapEx vs Memory Momentum Tracker
                            </h4>
                            <p className="text-[11px] text-gray-400 mt-0.5">
                                빅테크 4사 자본지출(CapEx) 성장률과 한국 반도체 수출/주가 모멘텀 시차(Lag) 분석
                            </p>
                        </div>
                        <div className="text-right">
                            <span className="text-xs text-gray-400 font-semibold">최근 분기 빅테크 합산 CapEx: </span>
                            <span className="text-sm font-black font-mono text-purple-300">
                                ${trackerData.total_quarterly_capex_billion}B
                            </span>
                        </div>
                    </div>

                    {/* CapEx Time Series Dual Chart */}
                    <div className="w-full h-[280px] bg-black/30 rounded-xl p-2 border border-white/5">
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={trackerData.time_series} margin={{ top: 15, right: 20, bottom: 10, left: 10 }}>
                                <CartesianGrid stroke="rgba(255,255,255,0.05)" />
                                <XAxis dataKey="quarter" tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 10 }} />
                                <YAxis yAxisId="left" tick={{ fill: "#a855f7", fontSize: 10 }} tickFormatter={(v) => `${v}%`} />
                                <YAxis yAxisId="right" orientation="right" tick={{ fill: "#10b981", fontSize: 10 }} tickFormatter={(v) => `${v}%`} />
                                <RechartsTooltip
                                    contentStyle={{ backgroundColor: "#12141c", borderColor: "rgba(255,255,255,0.15)", borderRadius: 12, fontSize: 11 }}
                                    formatter={(value: any, name: any) => [`${value}%`, name]}
                                />
                                <Legend
                                    verticalAlign="top"
                                    align="right"
                                    iconType="circle"
                                    iconSize={8}
                                    formatter={(val) => <span className="text-[11px] text-gray-300">{val}</span>}
                                />
                                <Bar yAxisId="left" dataKey="bigtech_capex_yoy" name="빅테크 CapEx YoY (%)" fill="#8b5cf6" radius={[4, 4, 0, 0]} opacity={0.8} />
                                <Line yAxisId="right" type="monotone" dataKey="kr_export_yoy" name="한국 반도체 수출 YoY (%)" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3 }} />
                                <Line yAxisId="right" type="monotone" dataKey="sox_return_yoy" name="SOX 지수 수익률 YoY (%)" stroke="#38bdf8" strokeWidth={1.5} strokeDasharray="3 3" dot={false} />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>

                    {/* BigTech 4 Companies Breakdown Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-1">
                        {trackerData.bigtech_companies?.map((comp: any) => (
                            <div key={comp.ticker} className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 flex flex-col justify-between">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <span className="font-bold text-white text-xs">{comp.name}</span>
                                        <span className="text-[10px] font-mono text-gray-500 ml-1.5">{comp.ticker}</span>
                                    </div>
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 font-mono">
                                        +{comp.capex_yoy}% YoY
                                    </span>
                                </div>
                                <div className="mt-2.5">
                                    <div className="text-lg font-black font-mono text-gray-100">
                                        ${comp.latest_quarter_capex}B
                                        <span className="text-[10px] text-gray-500 font-normal ml-1">/ 분기 지출</span>
                                    </div>
                                    <p className="text-[10px] text-gray-400 mt-1 line-clamp-2">{comp.ai_focus}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* TAB: SUB-SECTOR DECOUPLING MATRIX */}
            {(activeSubTab === "overview" || activeSubTab === "subsector") && subsectorData && (
                <div className="p-5 rounded-2xl bg-[#161922] border border-white/10 shadow-xl flex flex-col gap-4">
                    <div>
                        <h4 className="text-sm md:text-base font-bold text-white flex items-center gap-2">
                            <Cpu className="w-4 h-4 text-emerald-400" />
                            Sub-Sector Decoupling Matrix (서브섹터별 밸류에이션 & 이익 수정)
                        </h4>
                        <p className="text-[11px] text-gray-400 mt-0.5">
                            서브섹터별 12M Fwd P/E 백분위, 3개월 EPS 수정 비율, 사이클 베타 및 포지셔닝 진단
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                        {subsectorData.subsectors?.map((sub: any) => (
                            <div key={sub.id} className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 flex flex-col justify-between hover:border-white/20 transition-all">
                                <div>
                                    <div className="flex justify-between items-start mb-2">
                                        <h5 className="text-xs font-bold text-white">{sub.name}</h5>
                                        <span className="text-[9px] px-1.5 py-0.5 rounded font-bold" style={{ color: sub.status_color, backgroundColor: `${sub.status_color}20` }}>
                                            {sub.recommendation}
                                        </span>
                                    </div>
                                    <span className="text-[10px] text-gray-500">{sub.lead_lag}</span>

                                    {/* 12M Fwd P/E & Percentile Bar */}
                                    <div className="mt-3.5 space-y-1.5">
                                        <div className="flex justify-between text-xs">
                                            <span className="text-gray-400">12M Fwd P/E</span>
                                            <span className="font-mono font-bold text-white">{sub.current_fwd_pe}x</span>
                                        </div>
                                        <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                                            <div className="h-full rounded-full bg-indigo-500" style={{ width: `${sub.pe_percentile}%` }} />
                                        </div>
                                        <div className="flex justify-between text-[9px] text-gray-500">
                                            <span>5년 저점 {sub.historical_pe_min}x</span>
                                            <span className="text-indigo-300 font-semibold">{sub.pe_percentile}% 백분위</span>
                                            <span>고점 {sub.historical_pe_max}x</span>
                                        </div>
                                    </div>

                                    {/* EPS Revision & Beta */}
                                    <div className="grid grid-cols-2 gap-2 mt-3 pt-2.5 border-t border-white/5 text-xs">
                                        <div>
                                            <span className="text-[10px] text-gray-500">3M EPS 수정</span>
                                            <p className={`font-mono font-bold ${sub.eps_revision_3m >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                                                {sub.eps_revision_3m >= 0 ? "+" : ""}{sub.eps_revision_3m}%
                                            </p>
                                        </div>
                                        <div>
                                            <span className="text-[10px] text-gray-500">사이클 Beta</span>
                                            <p className="font-mono font-bold text-sky-400">{sub.cycle_beta}</p>
                                        </div>
                                    </div>

                                    <div className="mt-3 text-[10px] text-gray-400">
                                        <span className="text-gray-500 font-semibold">대표 종목: </span>
                                        {sub.top_stocks.join(", ")}
                                    </div>
                                </div>

                                <div className="mt-3 pt-2 text-[10px] text-gray-400 border-t border-white/5 line-clamp-2">
                                    {sub.key_drivers}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* TAB: ETF REBALANCING MATRIX */}
            {(activeSubTab === "overview" || activeSubTab === "etf") && strategyData && (
                <div className="p-5 rounded-2xl bg-[#161922] border border-white/10 shadow-xl flex flex-col gap-4">
                    <div>
                        <h4 className="text-sm md:text-base font-bold text-white flex items-center gap-2">
                            <Target className="w-4 h-4 text-indigo-400" />
                            Dynamic Semiconductor ETF Rebalancing Matrix
                        </h4>
                        <p className="text-[11px] text-gray-400 mt-0.5">
                            현재 사이클 국면(Phase 3) 기준 12종 반도체 ETF 퀀트 Fit Score 및 성향별 배분 모델
                        </p>
                    </div>

                    {/* ETF Table with Fit Scores */}
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left border-collapse">
                            <thead>
                                <tr className="border-b border-white/10 bg-white/[0.02] text-gray-400 font-semibold whitespace-nowrap">
                                    <th className="py-2.5 px-3">ETF 종목명</th>
                                    <th className="py-2.5 px-2 text-center">시장</th>
                                    <th className="py-2.5 px-2 text-center">분류</th>
                                    <th className="py-2.5 px-3">핵심 구성종목</th>
                                    <th className="py-2.5 px-3 text-center min-w-[120px]">퀀트 Fit Score</th>
                                    <th className="py-2.5 px-2 text-center">투자 의견</th>
                                    <th className="py-2.5 px-2 text-right">권장 비중</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {strategyData.etfs?.map((etf: any) => {
                                    const isTopFit = etf.fit_score >= 90;
                                    return (
                                        <tr key={etf.code} className="hover:bg-white/[0.03] transition-colors">
                                            <td className="py-3 px-3">
                                                <div className="flex items-center gap-1.5">
                                                    <span
                                                        onClick={() => onOpenDetail && onOpenDetail(etf.code)}
                                                        className="font-bold text-white hover:text-indigo-300 cursor-pointer"
                                                    >
                                                        {etf.name}
                                                    </span>
                                                    <span className="font-mono text-[10px] text-gray-500">({etf.code})</span>
                                                </div>
                                            </td>
                                            <td className="py-3 px-2 text-center">
                                                <span className="px-2 py-0.5 rounded text-[10px] bg-white/5 border border-white/10 text-gray-300">
                                                    {etf.market}
                                                </span>
                                            </td>
                                            <td className="py-3 px-2 text-center text-gray-400 text-[11px]">{etf.category}</td>
                                            <td className="py-3 px-3 text-gray-300 text-[11px]">{etf.top_holdings}</td>
                                            <td className="py-3 px-3 text-center">
                                                <div className="flex items-center gap-2">
                                                    <div className="flex-1 bg-white/5 rounded-full h-1.5 overflow-hidden">
                                                        <div
                                                            className={`h-full rounded-full ${isTopFit ? "bg-emerald-400" : "bg-indigo-400"}`}
                                                            style={{ width: `${etf.fit_score}%` }}
                                                        />
                                                    </div>
                                                    <span className="font-mono text-xs font-bold text-white w-8 text-right">
                                                        {etf.fit_score}점
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="py-3 px-2 text-center">
                                                <span
                                                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                                        etf.rating === "STRONG_BUY"
                                                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                                            : etf.rating === "BUY"
                                                            ? "bg-sky-500/20 text-sky-300 border border-sky-500/30"
                                                            : "bg-gray-500/20 text-gray-300 border border-gray-500/30"
                                                    }`}
                                                >
                                                    {etf.rating}
                                                </span>
                                            </td>
                                            <td className="py-3 px-2 text-right font-mono font-bold text-indigo-300">{etf.target_weight}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* 성향별 자산배분 모델 Bento */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-2">
                        <div className="p-4 rounded-xl bg-gradient-to-br from-indigo-500/10 to-transparent border border-indigo-500/20">
                            <span className="text-[11px] font-bold text-indigo-300 uppercase">공격성장형 모델 (Active Growth)</span>
                            <p className="text-xs text-white font-semibold mt-1">{strategyData.asset_allocation_model?.growth_aggressive}</p>
                        </div>
                        <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-500/10 to-transparent border border-emerald-500/20">
                            <span className="text-[11px] font-bold text-emerald-300 uppercase">균형포커스형 모델 (Balanced)</span>
                            <p className="text-xs text-white font-semibold mt-1">{strategyData.asset_allocation_model?.balanced}</p>
                        </div>
                        <div className="p-4 rounded-xl bg-gradient-to-br from-amber-500/10 to-transparent border border-amber-500/20">
                            <span className="text-[11px] font-bold text-amber-300 uppercase">인컴방어형 모델 (Defensive)</span>
                            <p className="text-xs text-white font-semibold mt-1">{strategyData.asset_allocation_model?.defensive}</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
