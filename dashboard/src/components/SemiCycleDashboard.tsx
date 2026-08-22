"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
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
    Calendar,
    Play,
    Pause,
    RotateCcw,
    Repeat,
    X,
    Info,
    ChevronRight,
    ChevronLeft,
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

const PHASE_COLORS: { [key: number]: { bg: string; text: string; border: string; badge: string; glow: string; dot: string } } = {
    1: {
        bg: "bg-rose-500/10",
        text: "text-rose-400",
        border: "border-rose-500/30",
        badge: "bg-rose-500/20 text-rose-300 border-rose-500/40",
        glow: "shadow-rose-500/20",
        dot: "#ef4444",
    },
    2: {
        bg: "bg-sky-500/10",
        text: "text-sky-400",
        border: "border-sky-500/30",
        badge: "bg-sky-500/20 text-sky-300 border-sky-500/40",
        glow: "shadow-sky-500/20",
        dot: "#38bdf8",
    },
    3: {
        bg: "bg-emerald-500/10",
        text: "text-emerald-400",
        border: "border-emerald-500/30",
        badge: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
        glow: "shadow-emerald-500/20",
        dot: "#10b981",
    },
    4: {
        bg: "bg-amber-500/10",
        text: "text-amber-400",
        border: "border-amber-500/30",
        badge: "bg-amber-500/20 text-amber-300 border-amber-500/40",
        glow: "shadow-amber-500/20",
        dot: "#f59e0b",
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
                <span className={isCurrent ? "text-emerald-300 font-extrabold" : "text-gray-200"}>
                    {d.date} ({d.label})
                </span>
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
    const [clockPeriod, setClockPeriod] = useState<"5Y" | "3Y" | "1Y">("5Y");

    // 시뮬레이션 애니메이션 상태
    const [isPlaying, setIsPlaying] = useState<boolean>(false);
    const [playIndex, setPlayIndex] = useState<number | null>(null);
    const [selectedPoint, setSelectedPoint] = useState<any | null>(null);
    const [isPopupOpen, setIsPopupOpen] = useState<boolean>(false);
    const [isLooping, setIsLooping] = useState<boolean>(true);

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

    // 궤적 필터링
    const trajectory = useMemo(() => {
        const raw = clockData?.trajectory || [];
        if (clockPeriod === "1Y") {
            return raw.slice(-12);
        } else if (clockPeriod === "3Y") {
            return raw.slice(-20);
        }
        return raw; // 5Y Full Cycle
    }, [clockData, clockPeriod]);

    // 기간 변경 시 시뮬레이션 인덱스 초기화
    useEffect(() => {
        if (isPlaying) {
            setPlayIndex(0);
        }
    }, [clockPeriod]);

    // 시뮬레이션 타이머 인터벌 로직
    useEffect(() => {
        let timer: any = null;
        if (isPlaying && trajectory.length > 0) {
            timer = setInterval(() => {
                setPlayIndex((prev) => {
                    const current = prev === null ? -1 : prev;
                    const next = current + 1;
                    if (next >= trajectory.length) {
                        if (isLooping) {
                            return 0;
                        } else {
                            setIsPlaying(false);
                            return current;
                        }
                    }
                    return next;
                });
            }, 1200); // 1.2초마다 다음 지점으로 전진
        }
        return () => {
            if (timer) clearInterval(timer);
        };
    }, [isPlaying, trajectory.length, isLooping]);

    // playIndex 변화 시 선택 점 및 팝업 상태 갱신
    useEffect(() => {
        if (playIndex !== null && trajectory[playIndex]) {
            setSelectedPoint(trajectory[playIndex]);
            setIsPopupOpen(true);
        }
    }, [playIndex, trajectory]);

    // 재생 토글
    const handleTogglePlay = () => {
        if (!isPlaying) {
            if (playIndex === null || playIndex >= trajectory.length - 1) {
                setPlayIndex(0);
            }
            setIsPlaying(true);
        } else {
            setIsPlaying(false);
        }
    };

    // 리셋
    const handleResetPlay = () => {
        setIsPlaying(false);
        setPlayIndex(null);
        setSelectedPoint(null);
        setIsPopupOpen(false);
    };

    // 점 클릭 수동 인스펙트
    const handlePointClick = (pt: any, idx?: number) => {
        setSelectedPoint(pt);
        setIsPopupOpen(true);
        if (typeof idx === "number") {
            setPlayIndex(idx);
        }
    };

    // 시뮬레이션 중 현재까지의 가시 궤적
    const animatedTrajectory = useMemo(() => {
        if (playIndex === null) return trajectory;
        return trajectory.slice(0, playIndex + 1);
    }, [trajectory, playIndex]);

    if (isLoading) {
        return (
            <div className="w-full flex flex-col items-center justify-center p-16 bg-white/[0.02] border border-white/5 rounded-3xl backdrop-blur-xl">
                <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin mb-3" />
                <p className="text-sm font-bold text-white">반도체 매크로 사이클 퀀트 엔진 연산 중...</p>
                <p className="text-xs text-gray-400 mt-1">
                    빅테크 6개년 CapEx, 관세청 반도체 수출 통계, 글로벌 DOI 롤링 Z-Score 정규화 중
                </p>
            </div>
        );
    }

    const currentPhase = clockData?.current_phase || 3;
    const phaseInfo = clockData?.phase_info || {};
    const phaseStyle = PHASE_COLORS[currentPhase] || PHASE_COLORS[3];

    // 선택된 점의 국면 정보
    const activePointPhase = selectedPoint?.phase || currentPhase;
    const activePointPhaseInfo = clockData?.quadrants
        ? Object.values(clockData.quadrants).find((q: any) => q.phase === activePointPhase)
        : null;
    const activePointStyle = PHASE_COLORS[activePointPhase] || PHASE_COLORS[3];

    return (
        <div className="w-full flex flex-col gap-6 animate-in fade-in duration-300">
            {/* 1. Top Executive Banner (현재 사이클 진단 요약) */}
            <div
                className={`p-5 rounded-2xl ${phaseStyle.bg} border ${phaseStyle.border} flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden shadow-xl`}
            >
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
                        <h3 className="text-base md:text-lg font-black text-white mt-1.5">{phaseInfo.description}</h3>
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
                    { id: "capex", label: "빅테크 CapEx 트래커 (6개년)", icon: <Server className="w-3.5 h-3.5" /> },
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
                    <div className="lg:col-span-7 p-5 rounded-2xl bg-[#161922] border border-white/10 shadow-xl flex flex-col justify-between relative">
                        {/* Header & Controls */}
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-2">
                            <div>
                                <h4 className="text-sm md:text-base font-bold text-white flex items-center gap-2">
                                    <Compass className="w-4 h-4 text-indigo-400" />
                                    Semiconductor Cycle Clock (반도체 4국면 사이클 시계)
                                </h4>
                                <p className="text-[11px] text-gray-400 mt-0.5">
                                    X축: 재고 건전성 (DOI 역수) · Y축: 출하/수출 모멘텀 · 4사분면 시계방향 회전 궤적
                                </p>
                            </div>

                            {/* Simulation Player & Period Controls */}
                            <div className="flex items-center gap-2 flex-wrap self-end sm:self-auto">
                                {/* 재생 컨트롤 바 */}
                                <div className="flex items-center bg-black/50 border border-white/15 rounded-xl p-1 gap-1 shadow-lg backdrop-blur-md">
                                    <button
                                        onClick={handleTogglePlay}
                                        className={`flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                                            isPlaying
                                                ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                                                : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30"
                                        }`}
                                        title={isPlaying ? "일시정지" : "사이클 이동 궤적 재생 시뮬레이션"}
                                    >
                                        {isPlaying ? (
                                            <>
                                                <Pause className="w-3.5 h-3.5 fill-current" />
                                                <span>정지</span>
                                            </>
                                        ) : (
                                            <>
                                                <Play className="w-3.5 h-3.5 fill-current" />
                                                <span>재생</span>
                                            </>
                                        )}
                                    </button>

                                    <button
                                        onClick={handleResetPlay}
                                        className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-all"
                                        title="처음부터 리셋"
                                    >
                                        <RotateCcw className="w-3.5 h-3.5" />
                                    </button>

                                    <button
                                        onClick={() => setIsLooping(!isLooping)}
                                        className={`p-1 rounded-lg transition-all ${
                                            isLooping ? "text-indigo-400 bg-indigo-500/20" : "text-gray-500 hover:text-gray-300"
                                        }`}
                                        title={isLooping ? "반복 재생 켜짐" : "반복 재생 꺼짐"}
                                    >
                                        <Repeat className="w-3.5 h-3.5" />
                                    </button>
                                </div>

                                {/* 기간 선택 토글 */}
                                <div className="flex items-center bg-black/40 border border-white/10 rounded-lg p-0.5 gap-1">
                                    {(["5Y", "3Y", "1Y"] as const).map((p) => (
                                        <button
                                            key={p}
                                            onClick={() => setClockPeriod(p)}
                                            className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all ${
                                                clockPeriod === p
                                                    ? "bg-indigo-600 text-white shadow"
                                                    : "text-gray-400 hover:text-white"
                                            }`}
                                        >
                                            {p === "5Y" ? "5Y (전체)" : p}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* 4 Quadrants Diagram via ScatterChart */}
                        <div className="relative w-full h-[380px] my-2 bg-black/40 rounded-xl border border-white/5 overflow-hidden">
                            {/* 사분면 배경 레이블 */}
                            <div className="absolute top-3 right-4 text-right pointer-events-none z-0">
                                <span className="text-xs font-bold text-emerald-400/80">Phase 3: 적극적 재고 축적</span>
                                <p className="text-[9px] text-gray-500">호황기 · 출하↑ 가격↑ 실적폭발 (현재)</p>
                            </div>
                            <div className="absolute top-3 left-4 text-left pointer-events-none z-0">
                                <span className="text-xs font-bold text-sky-400/80">Phase 2: 소극적 재고 소진</span>
                                <p className="text-[9px] text-gray-500">회복기 · 단가반등 재고감소 매수최적 (2023H2~24H1)</p>
                            </div>
                            <div className="absolute bottom-3 left-4 text-left pointer-events-none z-0">
                                <span className="text-xs font-bold text-rose-400/80">Phase 1: 적극적 재고 소진</span>
                                <p className="text-[9px] text-gray-500">불황기 · 출하↓ 가격↓ 최악의 바닥 (2022~23H1)</p>
                            </div>
                            <div className="absolute bottom-3 right-4 text-right pointer-events-none z-0">
                                <span className="text-xs font-bold text-amber-400/80">Phase 4: 소극적 재고 축적</span>
                                <p className="text-[9px] text-gray-500">고점경보 · 마진피크 분할차익실현 (2021H2)</p>
                            </div>

                            {/* 활성 지점 플로팅 팝업 정보창 (2021.01~2023.08: 좌측 상단 분면 / 2023.10~현재: 우측 하단 분면) */}
                            {isPopupOpen && selectedPoint && (
                                <div
                                    className={`absolute z-20 transition-all duration-700 ease-in-out pointer-events-auto ${
                                        // 2021년 1월 ~ 2023년 8월: 좌측 상단 분면 (우측 아래 궤적을 피하면서 더 오른쪽으로 이동)
                                        // 2023년 10월 ~ 현재: 우측 하단 분면 (좌측 위 궤적을 피하면서 더 위로 끌어올림)
                                        (selectedPoint.date <= "2023-08")
                                            ? "top-12 left-[20%] sm:left-[25%] md:left-[28%] animate-in slide-in-from-top-3 fade-in"
                                            : "bottom-[20%] sm:bottom-[24%] md:bottom-[26%] right-[16%] sm:right-[20%] md:right-[24%] animate-in slide-in-from-bottom-3 fade-in"
                                    }`}
                                >
                                    <div className="bg-[#12141c]/95 border border-white/20 rounded-2xl p-3.5 shadow-2xl backdrop-blur-2xl text-xs w-[240px] sm:w-[260px]">
                                        <div className="flex justify-between items-center pb-1.5 border-b border-white/10">
                                            <div className="flex items-center gap-1.5 font-black text-white">
                                                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                                                <span className="text-xs text-indigo-300 font-extrabold font-mono">
                                                    {selectedPoint.date}
                                                </span>
                                                <span className="text-[10px] text-gray-400 font-normal">({selectedPoint.label})</span>
                                            </div>
                                            <button
                                                onClick={() => setIsPopupOpen(false)}
                                                className="p-1 rounded-md text-gray-400 hover:text-white hover:bg-white/10"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        </div>

                                        <div className="mt-2 space-y-1 text-[11px]">
                                            <div className="flex justify-between items-center">
                                                <span className="text-gray-400 text-[10px]">사이클 국면</span>
                                                <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${activePointStyle.badge}`}>
                                                    Phase {selectedPoint.phase} : {activePointPhaseInfo ? (activePointPhaseInfo as any).name : `Phase ${selectedPoint.phase}`}
                                                </span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-gray-400 text-[10px]">CSCI 종합 지수</span>
                                                <span className="font-mono font-black text-white">{selectedPoint.csci}σ</span>
                                            </div>
                                            <div className="flex justify-between items-center text-[10px]">
                                                <span className="text-gray-400">재고 건전성 (DOI 역수)</span>
                                                <span className="font-mono text-gray-200">{selectedPoint.x}σ</span>
                                            </div>
                                            <div className="flex justify-between items-center text-[10px]">
                                                <span className="text-gray-400">수요 / 수출 모멘텀</span>
                                                <span className="font-mono text-gray-200">{selectedPoint.y}σ</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <ResponsiveContainer width="100%" height="100%">
                                <ScatterChart margin={{ top: 30, right: 30, bottom: 30, left: 30 }}>
                                    <CartesianGrid stroke="rgba(255,255,255,0.05)" />
                                    <XAxis
                                        type="number"
                                        dataKey="x"
                                        name="재고 건전성 (Z-Score)"
                                        domain={[-2.2, 2.2]}
                                        tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 9 }}
                                        tickFormatter={(v) => `${v}σ`}
                                        label={{
                                            value: "재고 건전성 (DOI 감소 / 공급타이트 → 우측)",
                                            position: "insideBottom",
                                            offset: -15,
                                            fill: "rgba(255,255,255,0.3)",
                                            fontSize: 10,
                                        }}
                                    />
                                    <YAxis
                                        type="number"
                                        dataKey="y"
                                        name="수출/출하 모멘텀 (Z-Score)"
                                        domain={[-2.2, 2.2]}
                                        tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 9 }}
                                        tickFormatter={(v) => `${v}σ`}
                                        label={{
                                            value: "수출 / CapEx 모멘텀 (↑)",
                                            angle: -90,
                                            position: "insideLeft",
                                            offset: 15,
                                            fill: "rgba(255,255,255,0.3)",
                                            fontSize: 10,
                                        }}
                                    />
                                    <ZAxis range={[50, 180]} />
                                    {!isPlaying && <RechartsTooltip content={<CustomScatterTooltip />} />}
                                    {/* 0축 기준선 */}
                                    <ReferenceLine x={0} stroke="rgba(255,255,255,0.2)" strokeDasharray="3 3" />
                                    <ReferenceLine y={0} stroke="rgba(255,255,255,0.2)" strokeDasharray="3 3" />

                                    {/* 배경 가이드라인 (전체 궤적 점선) */}
                                    <Scatter
                                        name="Full Cycle Track"
                                        data={trajectory}
                                        fill="#4f46e5"
                                        line={{ stroke: "rgba(99, 102, 241, 0.25)", strokeWidth: 1.5, strokeDasharray: "2 2" }}
                                        shape={() => null} // 점은 숨기고 가이드 선만 표시
                                    />

                                    {/* 이동 궤적 애니메이션 Scatter */}
                                    <Scatter
                                        name="Cycle Trajectory"
                                        data={animatedTrajectory}
                                        fill="#6366f1"
                                        line={{ stroke: "#6366f1", strokeWidth: 2.2, strokeDasharray: "3 3" }}
                                        onClick={(pt: any) => handlePointClick(pt.payload)}
                                        className="cursor-pointer"
                                        shape={(props: any) => {
                                            const { cx, cy, payload, index } = props;
                                            const isSelected = selectedPoint && selectedPoint.date === payload.date;
                                            const isLastInAnim = index === animatedTrajectory.length - 1;
                                            const isCurrentFact = payload.label?.includes("현재");
                                            const isBottom = payload.label?.includes("바닥");

                                            return (
                                                <g
                                                    onClick={() => handlePointClick(payload, index)}
                                                    className="cursor-pointer transition-transform hover:scale-125"
                                                >
                                                    {/* 깜빡깜빡 펄스 링 (선택되었거나 시뮬레이션 현재 지점) */}
                                                    {(isSelected || (isPlaying && isLastInAnim)) && (
                                                        <>
                                                            <circle
                                                                cx={cx}
                                                                cy={cy}
                                                                r={14}
                                                                fill="#818cf8"
                                                                opacity={0.35}
                                                                className="animate-ping"
                                                            />
                                                            <circle
                                                                cx={cx}
                                                                cy={cy}
                                                                r={9}
                                                                fill="#6366f1"
                                                                opacity={0.5}
                                                                className="animate-pulse"
                                                            />
                                                        </>
                                                    )}

                                                    {isCurrentFact ? (
                                                        <>
                                                            <circle cx={cx} cy={cy} r={9} fill="#10b981" opacity={0.3} className="animate-ping" />
                                                            <circle cx={cx} cy={cy} r={6.5} fill="#10b981" stroke="#ffffff" strokeWidth={2} />
                                                        </>
                                                    ) : isBottom ? (
                                                        <circle cx={cx} cy={cy} r={5.5} fill="#ef4444" stroke="#ffffff" strokeWidth={1.5} />
                                                    ) : (
                                                        <circle
                                                            cx={cx}
                                                            cy={cy}
                                                            r={isSelected ? 6 : 4}
                                                            fill={isSelected ? "#38bdf8" : "#818cf8"}
                                                            stroke="#ffffff"
                                                            strokeWidth={isSelected ? 2 : 0.8}
                                                        />
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
                                <p className="text-gray-400 mt-0.5">DOI 피크 · 2022~23 바닥</p>
                            </div>
                            <div className="p-2 rounded-lg bg-sky-500/5 border border-sky-500/10">
                                <span className="font-bold text-sky-400">Phase 2: 회복기</span>
                                <p className="text-gray-400 mt-0.5">스팟가 반등 · 2023H2~24H1</p>
                            </div>
                            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                                <span className="font-bold text-emerald-300">Phase 3: 호황기 (현재)</span>
                                <p className="text-gray-400 mt-0.5">증설/소부장 발주 · 2024H2~26</p>
                            </div>
                            <div className="p-2 rounded-lg bg-amber-500/5 border border-amber-500/10">
                                <span className="font-bold text-amber-400">Phase 4: 고점기</span>
                                <p className="text-gray-400 mt-0.5">CapEx 둔화 · 2021H2 고점</p>
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
                                        <div
                                            key={i}
                                            className="flex items-center gap-2.5 p-2 rounded-xl bg-white/[0.03] border border-white/5 text-xs text-gray-200"
                                        >
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
                                Hyperscaler CapEx vs Memory Momentum Tracker (2020~2026 장기 시계열)
                            </h4>
                            <p className="text-[11px] text-gray-400 mt-0.5">
                                빅테크 4사 자본지출(CapEx) 성장률과 한국 반도체 수출/주가 모멘텀의 6.5개년 거시 시차(Lag) 분석
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
                    <div className="w-full h-[320px] bg-black/30 rounded-xl p-2 border border-white/5">
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={trackerData.time_series} margin={{ top: 15, right: 20, bottom: 25, left: 10 }}>
                                <CartesianGrid stroke="rgba(255,255,255,0.05)" />
                                <XAxis
                                    dataKey="quarter"
                                    tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 9 }}
                                    angle={-30}
                                    textAnchor="end"
                                    interval={1}
                                    height={40}
                                />
                                <YAxis yAxisId="left" tick={{ fill: "#a855f7", fontSize: 10 }} tickFormatter={(v) => `${v}%`} />
                                <YAxis yAxisId="right" orientation="right" tick={{ fill: "#10b981", fontSize: 10 }} tickFormatter={(v) => `${v}%`} />
                                <RechartsTooltip
                                    contentStyle={{
                                        backgroundColor: "#12141c",
                                        borderColor: "rgba(255,255,255,0.15)",
                                        borderRadius: 12,
                                        fontSize: 11,
                                    }}
                                    formatter={(value: any, name: any) => [`${value}%`, name]}
                                />
                                <Legend
                                    verticalAlign="top"
                                    align="right"
                                    iconType="circle"
                                    iconSize={8}
                                    formatter={(val) => <span className="text-[11px] text-gray-300">{val}</span>}
                                />
                                <Bar
                                    yAxisId="left"
                                    dataKey="bigtech_capex_yoy"
                                    name="빅테크 CapEx YoY (%)"
                                    fill="#8b5cf6"
                                    radius={[3, 3, 0, 0]}
                                    opacity={0.8}
                                />
                                <Line
                                    yAxisId="right"
                                    type="monotone"
                                    dataKey="kr_export_yoy"
                                    name="한국 반도체 수출 YoY (%)"
                                    stroke="#10b981"
                                    strokeWidth={2.2}
                                    dot={{ r: 2 }}
                                />
                                <Line
                                    yAxisId="right"
                                    type="monotone"
                                    dataKey="sox_return_yoy"
                                    name="SOX 지수 수익률 YoY (%)"
                                    stroke="#38bdf8"
                                    strokeWidth={1.5}
                                    strokeDasharray="3 3"
                                    dot={false}
                                />
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
                            <div
                                key={sub.id}
                                className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 flex flex-col justify-between hover:border-white/20 transition-all"
                            >
                                <div>
                                    <div className="flex justify-between items-start mb-2">
                                        <h5 className="text-xs font-bold text-white">{sub.name}</h5>
                                        <span
                                            className="text-[9px] px-1.5 py-0.5 rounded font-bold"
                                            style={{ color: sub.status_color, backgroundColor: `${sub.status_color}20` }}
                                        >
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
