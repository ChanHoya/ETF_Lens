"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
    Vote,
    Calendar,
    AlertCircle,
    TrendingUp,
    TrendingDown,
    ShieldAlert,
    CheckCircle2,
    Clock,
    Scale,
    Cpu,
    DollarSign,
    Sparkles,
    Landmark,
    Building2,
    RefreshCw,
    Layers,
    Sliders,
    ArrowRight,
    PieChart as PieChartIcon,
    BarChart3,
    Activity,
    Info,
    Flame
} from "lucide-react";
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip as RechartsTooltip,
    ResponsiveContainer,
    Legend
} from "recharts";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function MidtermElectionTab() {
    const [overview, setOverview] = useState<any>(null);
    const [radar, setRadar] = useState<any>(null);
    const [scenariosData, setScenariosData] = useState<any>(null);
    const [historical, setHistorical] = useState<any>(null);
    const [portfolioGuide, setPortfolioGuide] = useState<any>(null);

    const [selectedScenarioId, setSelectedScenarioId] = useState<string>("gridlock");
    const [techWeight, setTechWeight] = useState<number>(55.0);
    const [riskProfile, setRiskProfile] = useState<"conservative" | "neutral" | "aggressive">("neutral");
    const [loading, setLoading] = useState<boolean>(true);
    const [refreshing, setRefreshing] = useState<boolean>(false);

    // Fetch all midterm election data
    const fetchAllData = async (isManual: boolean = false) => {
        try {
            if (isManual) setRefreshing(true);
            else setLoading(true);

            const [ovRes, radRes, scRes, histRes] = await Promise.all([
                fetch(`${API_BASE}/api/v1/midterm/overview`),
                fetch(`${API_BASE}/api/v1/midterm/radar`),
                fetch(`${API_BASE}/api/v1/midterm/scenarios`),
                fetch(`${API_BASE}/api/v1/midterm/historical`)
            ]);

            if (ovRes.ok) setOverview(await ovRes.json());
            if (radRes.ok) setRadar(await radRes.json());
            if (scRes.ok) setScenariosData(await scRes.json());
            if (histRes.ok) setHistorical(await histRes.json());

            // Initial portfolio guide
            await fetchPortfolioGuide(techWeight, riskProfile);
        } catch (err) {
            console.error("Failed to load midterm election data:", err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    // Calculate portfolio guide dynamically
    const fetchPortfolioGuide = async (tw: number, rp: string) => {
        try {
            const res = await fetch(`${API_BASE}/api/v1/midterm/portfolio-guide`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    tech_weight: tw,
                    risk_profile: rp,
                    interested_themes: ["big_tech", "semi_hardware", "b2b_saas", "dividend_growth"]
                })
            });
            if (res.ok) {
                setPortfolioGuide(await res.json());
            }
        } catch (err) {
            console.error("Failed to fetch portfolio guide:", err);
        }
    };

    useEffect(() => {
        fetchAllData(false);
    }, []);

    const handleWeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = parseFloat(e.target.value);
        setTechWeight(val);
        fetchPortfolioGuide(val, riskProfile);
    };

    const handleProfileChange = (p: "conservative" | "neutral" | "aggressive") => {
        setRiskProfile(p);
        fetchPortfolioGuide(techWeight, p);
    };

    // Selected scenario object
    const currentScenario = useMemo(() => {
        if (!scenariosData?.scenarios) return null;
        return scenariosData.scenarios.find((s: any) => s.id === selectedScenarioId) || scenariosData.scenarios[0];
    }, [scenariosData, selectedScenarioId]);

    return (
        <div className="w-full flex flex-col gap-6 text-gray-200 animate-in fade-in duration-300">
            {/* Header Banner */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#121422] via-[#1a1c30] to-[#121422] border border-white/10 p-6 md:p-8 shadow-2xl backdrop-blur-xl">
                <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-3">
                            <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1.5 shadow-sm">
                                <Vote className="w-3.5 h-3.5" />
                                2026 미국 중간선거 분석
                            </span>
                            <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5" />
                                {overview?.d_day !== undefined ? `D-${overview.d_day} (2026-11-03)` : "2026년 11월 3일"}
                            </span>
                        </div>
                        <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight flex items-center gap-2">
                            미국 중간선거('26.11) 영향 분석 및 자산배분 가이드
                        </h2>
                        <p className="text-xs md:text-sm text-gray-400 font-medium max-w-3xl leading-relaxed">
                            선거 제도 본질 및 의회 권력 지형 변화(Gridlock)에 따른 증시·경제 파급효과를 다각도로 분석하고,
                            AI/빅테크 집중 포트폴리오를 위한 실전 Core-Satellite 리밸런싱 전략을 제시합니다.
                        </p>
                    </div>

                    <button
                        onClick={() => fetchAllData(true)}
                        disabled={refreshing}
                        className="self-start md:self-center flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 active:scale-95 border border-white/15 text-xs font-bold text-white transition-all shadow-md disabled:opacity-50"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 text-indigo-400 ${refreshing ? "animate-spin" : ""}`} />
                        <span>{refreshing ? "판세 분석 갱신 중..." : "최신 판세 동기화"}</span>
                    </button>
                </div>
            </div>

            {/* Section 1: 1. 미국 대통령 중간선거 개요 */}
            <div className="w-full bg-[#121217]/70 border border-white/10 rounded-3xl p-5 md:p-7 backdrop-blur-md shadow-xl flex flex-col gap-6">
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-400">
                            <Landmark className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-lg md:text-xl font-bold text-white flex items-center gap-2">
                                1. 미국 대통령 중간선거 개요
                            </h3>
                            <p className="text-xs text-gray-400">
                                헌법적 선거 구조, 임기 불변의 원칙 및 3대 선출 권력 규모
                            </p>
                        </div>
                    </div>
                </div>

                {/* 3 Seats Contested Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-[#181a26]/70 border border-white/10 rounded-2xl p-5 relative overflow-hidden group hover:border-indigo-500/40 transition-all">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-semibold text-gray-400 flex items-center gap-1.5">
                                <Building2 className="w-4 h-4 text-sky-400" />
                                연방 하원의원 (House)
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-300 border border-sky-500/20">
                                임기 2년
                            </span>
                        </div>
                        <div className="flex items-baseline gap-2 mb-2">
                            <h4 className="text-3xl font-black text-white font-mono">435석</h4>
                            <span className="text-xs text-rose-400 font-bold">전원 선출</span>
                        </div>
                        <p className="text-xs text-gray-400 leading-relaxed">
                            과반 218석 필요. 세제 개편안 발의권 및 국가 예산 편성의 칼자루를 쥐는 핵심 의회 권력입니다.
                        </p>
                        <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-gray-400">
                            <span>현재: 공화 220 vs 민주 213</span>
                            <span className="text-indigo-400 font-bold">초박빙 격전</span>
                        </div>
                    </div>

                    <div className="bg-[#181a26]/70 border border-white/10 rounded-2xl p-5 relative overflow-hidden group hover:border-indigo-500/40 transition-all">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-semibold text-gray-400 flex items-center gap-1.5">
                                <Scale className="w-4 h-4 text-purple-400" />
                                연방 상원의원 (Senate)
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/20">
                                임기 6년
                            </span>
                        </div>
                        <div className="flex items-baseline gap-2 mb-2">
                            <h4 className="text-3xl font-black text-white font-mono">33석</h4>
                            <span className="text-xs text-gray-400 font-bold">/ 총 100석 (1/3 교체)</span>
                        </div>
                        <p className="text-xs text-gray-400 leading-relaxed">
                            과반 51석 필요. 고위 공직자·대법관 인준권과 조약 비준권을 독점하는 최고 상위 입법부입니다.
                        </p>
                        <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-gray-400">
                            <span>현재: 공화 53 vs 민주 47</span>
                            <span className="text-purple-400 font-bold">공화 수성 우세</span>
                        </div>
                    </div>

                    <div className="bg-[#181a26]/70 border border-white/10 rounded-2xl p-5 relative overflow-hidden group hover:border-indigo-500/40 transition-all">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-semibold text-gray-400 flex items-center gap-1.5">
                                <Landmark className="w-4 h-4 text-emerald-400" />
                                주지사 (Governors)
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/20">
                                지방 행정권
                            </span>
                        </div>
                        <div className="flex items-baseline gap-2 mb-2">
                            <h4 className="text-3xl font-black text-white font-mono">36개 주</h4>
                            <span className="text-xs text-gray-400 font-bold">/ 총 50개 주</span>
                        </div>
                        <p className="text-xs text-gray-400 leading-relaxed">
                            각 주별 보조금, 친환경 규제, 선거구 획정 권한을 가진 주 행정부 최고 수장을 선출합니다.
                        </p>
                        <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-gray-400">
                            <span>핵심 격전: 조지아, 애리조나 등</span>
                            <span className="text-emerald-400 font-bold">지방 자치 양분</span>
                        </div>
                    </div>
                </div>

                {/* Constitutional Core Fact Check Card */}
                <div className="bg-gradient-to-br from-[#1b1928] to-[#121420] border border-amber-500/30 rounded-2xl p-5 md:p-6 shadow-lg">
                    <div className="flex items-start gap-4">
                        <div className="p-2.5 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400 shrink-0 mt-0.5">
                            <ShieldAlert className="w-6 h-6" />
                        </div>
                        <div className="flex flex-col gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="text-xs font-bold text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded border border-amber-500/20">
                                    헌법적 팩트체크
                                </span>
                                <h4 className="text-base md:text-lg font-bold text-white">
                                    "트럼프 대통령이 중간선거에서 패배하면 대통령 재선거를 하는가?"
                                </h4>
                            </div>
                            <div className="text-sm font-black text-rose-300 flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                대통령 재선거는 절대 실시하지 않습니다. (4년 임기 불변)
                            </div>
                            <p className="text-xs md:text-sm text-gray-300 leading-relaxed">
                                미국 헌법 제2조에 따라 대통령의 임기는 4년(2025.01 ~ 2029.01)으로 확고히 보장됩니다.
                                중간선거에서 여당(공화당)이 패배할 경우 발생하는 변화는 '대통령 교체'가 아니라,
                                행정부와 입법부(의회)의 권력이 나뉘는 <span className="text-amber-300 font-bold underline underline-offset-2">분점정부(Divided Government / Gridlock)</span> 체제로의 전환입니다.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Section 2: 2. 사전 분위기 및 판세 트래커 */}
            <div className="w-full bg-[#121217]/70 border border-white/10 rounded-3xl p-5 md:p-7 backdrop-blur-md shadow-xl flex flex-col gap-6">
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-sky-500/20 border border-sky-500/30 text-sky-400">
                            <Activity className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-lg md:text-xl font-bold text-white flex items-center gap-2">
                                2. 사전 분위기 및 판세 트래커 (Pre-Election Radar)
                            </h3>
                            <p className="text-xs text-gray-400">
                                상·하원 다수당 장악 확률, 4대 정책 쟁점 민감도 및 격전지 현황
                            </p>
                        </div>
                    </div>
                    <div className="hidden sm:flex items-center gap-2 text-xs text-indigo-400 font-mono bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/20">
                        <span>분점정부(Gridlock) 확률: {radar?.probabilities?.divided_government_prob || 67.5}%</span>
                    </div>
                </div>

                {/* Probabilities Gauges */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-[#181a26]/70 border border-white/10 rounded-2xl p-5 flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-gray-300">하원(House) 다수당 장악 확률</span>
                            <span className="text-xs font-bold text-sky-400">
                                {radar?.probabilities?.house?.projected_majority || "민주당 탈환 유력"}
                            </span>
                        </div>
                        <div className="w-full h-3 bg-black/50 rounded-full overflow-hidden flex border border-white/5">
                            <div
                                style={{ width: `${radar?.probabilities?.house?.democrat_win_prob || 58.5}%` }}
                                className="bg-sky-500 h-full transition-all duration-500"
                            />
                            <div
                                style={{ width: `${radar?.probabilities?.house?.republican_win_prob || 41.5}%` }}
                                className="bg-rose-500 h-full transition-all duration-500"
                            />
                        </div>
                        <div className="flex justify-between items-center text-xs font-mono">
                            <span className="text-sky-400 font-bold">
                                민주당 {radar?.probabilities?.house?.democrat_win_prob || 58.5}%
                            </span>
                            <span className="text-rose-400 font-bold">
                                공화당 {radar?.probabilities?.house?.republican_win_prob || 41.5}%
                            </span>
                        </div>
                        <p className="text-[11px] text-gray-400 leading-normal mt-1">
                            {radar?.probabilities?.house?.historical_context}
                        </p>
                    </div>

                    <div className="bg-[#181a26]/70 border border-white/10 rounded-2xl p-5 flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-gray-300">상원(Senate) 다수당 장악 확률</span>
                            <span className="text-xs font-bold text-rose-400">
                                {radar?.probabilities?.senate?.projected_majority || "공화당 수성 우세"}
                            </span>
                        </div>
                        <div className="w-full h-3 bg-black/50 rounded-full overflow-hidden flex border border-white/5">
                            <div
                                style={{ width: `${radar?.probabilities?.senate?.republican_win_prob || 56.0}%` }}
                                className="bg-rose-500 h-full transition-all duration-500"
                            />
                            <div
                                style={{ width: `${radar?.probabilities?.senate?.democrat_win_prob || 44.0}%` }}
                                className="bg-sky-500 h-full transition-all duration-500"
                            />
                        </div>
                        <div className="flex justify-between items-center text-xs font-mono">
                            <span className="text-rose-400 font-bold">
                                공화당 {radar?.probabilities?.senate?.republican_win_prob || 56.0}%
                            </span>
                            <span className="text-sky-400 font-bold">
                                민주당 {radar?.probabilities?.senate?.democrat_win_prob || 44.0}%
                            </span>
                        </div>
                        <p className="text-[11px] text-gray-400 leading-normal mt-1">
                            {radar?.probabilities?.senate?.historical_context}
                        </p>
                    </div>
                </div>

                {/* 4 Core Policy Issues */}
                <div>
                    <h4 className="text-sm font-bold text-gray-300 mb-3 flex items-center gap-2">
                        <Flame className="w-4 h-4 text-amber-400" />
                        4대 정책 쟁점 및 금융시장 민감도
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                        {radar?.key_policy_issues?.map((issue: any) => (
                            <div key={issue.id} className="bg-[#151722] border border-white/5 rounded-2xl p-4 flex flex-col justify-between">
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs font-bold text-white">{issue.title}</span>
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                            issue.score > 85 ? "bg-rose-500/20 text-rose-300" :
                                            issue.score > 70 ? "bg-amber-500/20 text-amber-300" : "bg-sky-500/20 text-sky-300"
                                        }`}>
                                            {issue.intensity}
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-gray-400 leading-relaxed mb-3">
                                        {issue.description}
                                    </p>
                                </div>
                                <div className="pt-2 border-t border-white/5 text-[10px] text-indigo-300">
                                    <span className="text-gray-500">민감 자산:</span> {issue.impact_asset}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Section 3: 3. 3대 선거 시나리오별 금융시장 영향 매트릭스 */}
            <div className="w-full bg-[#121217]/70 border border-white/10 rounded-3xl p-5 md:p-7 backdrop-blur-md shadow-xl flex flex-col gap-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-purple-500/20 border border-purple-500/30 text-purple-400">
                            <Layers className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-lg md:text-xl font-bold text-white flex items-center gap-2">
                                3. 3대 선거 시나리오별 금융시장 영향 매트릭스
                            </h3>
                            <p className="text-xs text-gray-400">
                                의회 구성 시나리오에 따른 거시경제 전망 및 섹터별 수혜/부담 상세 분석
                            </p>
                        </div>
                    </div>

                    {/* Scenario Switcher Tabs */}
                    <div className="flex items-center bg-black/40 border border-white/10 rounded-xl p-1 gap-1">
                        {scenariosData?.scenarios?.map((sc: any) => (
                            <button
                                key={sc.id}
                                onClick={() => setSelectedScenarioId(sc.id)}
                                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                                    selectedScenarioId === sc.id
                                        ? "bg-indigo-600 text-white shadow-lg"
                                        : "text-gray-400 hover:text-white"
                                }`}
                            >
                                {sc.id === "gridlock" ? "분점정부 (Gridlock, 65%)" :
                                 sc.id === "red_hold" ? "공화 수성 (25%)" : "민주 압승 (10%)"}
                            </button>
                        ))}
                    </div>
                </div>

                {currentScenario && (
                    <div className="flex flex-col gap-6">
                        {/* Scenario Headline Card */}
                        <div className="bg-gradient-to-r from-[#181a2e] to-[#131522] border border-indigo-500/30 rounded-2xl p-5">
                            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                                <div className="flex items-center gap-2">
                                    <span className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                        발생 확률: {currentScenario.probability}%
                                    </span>
                                    <h4 className="text-lg font-bold text-white">{currentScenario.name}</h4>
                                </div>
                                <span className="text-xs text-gray-400 font-mono">구도: {currentScenario.composition}</span>
                            </div>
                            <p className="text-xs md:text-sm text-gray-300 leading-relaxed">
                                {currentScenario.political_dynamics}
                            </p>
                        </div>

                        {/* Macro Outlook Metrics Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                            <div className="bg-[#151722] border border-white/5 rounded-xl p-4">
                                <span className="text-[11px] text-gray-400 font-semibold block mb-1">미국 10년물 국채 금리</span>
                                <span className="text-sm font-bold text-white font-mono">{currentScenario.macro_outlook?.yield_10y}</span>
                            </div>
                            <div className="bg-[#151722] border border-white/5 rounded-xl p-4">
                                <span className="text-[11px] text-gray-400 font-semibold block mb-1">달러 인덱스 (DXY)</span>
                                <span className="text-sm font-bold text-white font-mono">{currentScenario.macro_outlook?.dollar_dxy}</span>
                            </div>
                            <div className="bg-[#151722] border border-white/5 rounded-xl p-4">
                                <span className="text-[11px] text-gray-400 font-semibold block mb-1">WTI 원유 가격</span>
                                <span className="text-sm font-bold text-white font-mono">{currentScenario.macro_outlook?.oil_wti}</span>
                            </div>
                            <div className="bg-[#151722] border border-white/5 rounded-xl p-4">
                                <span className="text-[11px] text-gray-400 font-semibold block mb-1">물가 (CPI) 추세</span>
                                <span className="text-sm font-bold text-white font-mono">{currentScenario.macro_outlook?.cpi_trend}</span>
                            </div>
                        </div>

                        {/* Sector Impacts (Overweight vs Neutral vs Underweight) */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {currentScenario.sector_impacts?.map((imp: any, idx: number) => {
                                const isOver = imp.category.includes("수혜");
                                const isUnder = imp.category.includes("부담");
                                return (
                                    <div
                                        key={idx}
                                        className={`rounded-2xl p-5 border flex flex-col justify-between ${
                                            isOver ? "bg-emerald-950/20 border-emerald-500/30" :
                                            isUnder ? "bg-rose-950/20 border-rose-500/30" : "bg-[#181a26]/70 border-white/10"
                                        }`}
                                    >
                                        <div>
                                            <div className="flex items-center justify-between mb-3">
                                                <span className={`text-xs font-bold px-2.5 py-1 rounded-md ${
                                                    isOver ? "bg-emerald-500/20 text-emerald-300" :
                                                    isUnder ? "bg-rose-500/20 text-rose-300" : "bg-white/10 text-gray-300"
                                                }`}>
                                                    {imp.category}
                                                </span>
                                            </div>
                                            <ul className="flex flex-col gap-1.5 mb-3">
                                                {imp.sectors?.map((sec: string, sIdx: number) => (
                                                    <li key={sIdx} className="text-xs font-bold text-white flex items-center gap-1.5">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-white/40" />
                                                        {sec}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                        <p className="text-[11px] text-gray-400 border-t border-white/5 pt-2.5 leading-relaxed">
                                            {imp.rationale}
                                        </p>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* Section 4: 4. 역대 중간선거 S&P 500 계절성 통계 */}
            <div className="w-full bg-[#121217]/70 border border-white/10 rounded-3xl p-5 md:p-7 backdrop-blur-md shadow-xl flex flex-col gap-6">
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400">
                            <BarChart3 className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-lg md:text-xl font-bold text-white flex items-center gap-2">
                                4. 역대 중간선거 S&P 500 계절성 통계 (1950~2022 플레이북)
                            </h3>
                            <p className="text-xs text-gray-400">
                                19회 중간선거 사이클 분석: 선거 전 8~10월 바닥 형성 후 12개월간 안도 랠리 패턴
                            </p>
                        </div>
                    </div>
                </div>

                {/* 4 Stat Metric Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-[#181a26]/70 border border-white/10 rounded-2xl p-4">
                        <span className="text-[11px] text-gray-400 font-semibold block mb-1">선거 후 12개월 상승 확률</span>
                        <div className="flex items-baseline gap-1">
                            <h4 className="text-2xl font-black text-emerald-400 font-mono">
                                {historical?.historical_stats?.post_election_12m_positive_rate || 94.7}%
                            </h4>
                            <span className="text-[10px] text-gray-400">19회 중 18회</span>
                        </div>
                    </div>
                    <div className="bg-[#181a26]/70 border border-white/10 rounded-2xl p-4">
                        <span className="text-[11px] text-gray-400 font-semibold block mb-1">선거 후 1년 평균 수익률</span>
                        <div className="flex items-baseline gap-1">
                            <h4 className="text-2xl font-black text-emerald-400 font-mono">
                                +{historical?.historical_stats?.post_election_12m_avg_return || 15.1}%
                            </h4>
                            <span className="text-[10px] text-gray-400">안도 랠리</span>
                        </div>
                    </div>
                    <div className="bg-[#181a26]/70 border border-white/10 rounded-2xl p-4">
                        <span className="text-[11px] text-gray-400 font-semibold block mb-1">분점정부(Gridlock) 연수익률</span>
                        <div className="flex items-baseline gap-1">
                            <h4 className="text-2xl font-black text-sky-400 font-mono">
                                +{historical?.historical_stats?.gridlock_annual_avg_return || 13.6}%
                            </h4>
                            <span className="text-[10px] text-gray-400">단점정부(+10.2%) 상회</span>
                        </div>
                    </div>
                    <div className="bg-[#181a26]/70 border border-white/10 rounded-2xl p-4">
                        <span className="text-[11px] text-gray-400 font-semibold block mb-1">선거 전 8~10월 평균 조정폭</span>
                        <div className="flex items-baseline gap-1">
                            <h4 className="text-2xl font-black text-rose-400 font-mono">
                                {historical?.historical_stats?.pre_election_drawdown_avg || -7.8}%
                            </h4>
                            <span className="text-[10px] text-gray-400">불확실성 피크</span>
                        </div>
                    </div>
                </div>

                {/* S&P 500 Historical Seasonality LineChart */}
                <div className="w-full bg-black/40 border border-white/5 rounded-2xl p-4 relative" style={{ height: "340px" }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={historical?.trajectory || []} margin={{ top: 15, right: 20, left: -10, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                            <XAxis dataKey="month" stroke="#71717a" tick={{ fontSize: 11 }} tickLine={false} />
                            <YAxis domain={["auto", "auto"]} stroke="#71717a" tick={{ fontSize: 11 }} tickLine={false} />
                            <RechartsTooltip
                                contentStyle={{
                                    backgroundColor: "rgba(10, 10, 15, 0.95)",
                                    border: "1px solid rgba(255, 255, 255, 0.1)",
                                    borderRadius: "12px"
                                }}
                            />
                            <Legend verticalAlign="top" height={36} iconType="circle" />
                            <Line
                                type="monotone"
                                name="중간선거 해 (1950~2022 평균)"
                                dataKey="midterm_year"
                                stroke="#f59e0b"
                                strokeWidth={3}
                                dot={{ r: 3, fill: "#f59e0b" }}
                            />
                            <Line
                                type="monotone"
                                name="일반 해 (S&P 500 전체 평균)"
                                dataKey="general_year"
                                stroke="#71717a"
                                strokeWidth={2}
                                strokeDasharray="4 4"
                                dot={false}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>

                <div className="bg-[#151722] border border-white/5 rounded-xl p-4 text-xs text-gray-300 leading-relaxed flex items-start gap-3">
                    <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <span>{historical?.key_takeaway}</span>
                </div>
            </div>

            {/* Section 5: 5. AI 맞춤형 포트폴리오 리밸런싱 컨설턴트 */}
            <div className="w-full bg-[#121217]/70 border border-white/10 rounded-3xl p-5 md:p-7 backdrop-blur-md shadow-xl flex flex-col gap-6">
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400">
                            <Sliders className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-lg md:text-xl font-bold text-white flex items-center gap-2">
                                5. AI 맞춤형 포트폴리오 리밸런싱 컨설턴트
                            </h3>
                            <p className="text-xs text-gray-400">
                                기술주 50%+ 집중 투자 진단 및 Core-Satellite(핵심-위성) 리밸런싱 시뮬레이터
                            </p>
                        </div>
                    </div>
                </div>

                {/* Consultation Controls (Slider & Buttons) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 bg-[#181a26]/70 border border-white/10 rounded-2xl p-5">
                    {/* Tech Weight Slider */}
                    <div className="flex flex-col gap-2">
                        <div className="flex justify-between items-center">
                            <label className="text-xs font-bold text-gray-300">현재 보유 기술주 비중</label>
                            <span className="text-lg font-black text-indigo-400 font-mono">{techWeight.toFixed(0)}%</span>
                        </div>
                        <input
                            type="range"
                            min="10"
                            max="90"
                            step="5"
                            value={techWeight}
                            onChange={handleWeightChange}
                            className="w-full h-2 bg-black/50 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                        />
                        <div className="flex justify-between text-[10px] text-gray-500">
                            <span>10% (보수적)</span>
                            <span>50% (집중 분기점)</span>
                            <span>90% (초집중)</span>
                        </div>
                    </div>

                    {/* Risk Profile Selector */}
                    <div className="flex flex-col gap-2">
                        <label className="text-xs font-bold text-gray-300">고객 투자 성향</label>
                        <div className="grid grid-cols-3 gap-2">
                            {(["conservative", "neutral", "aggressive"] as const).map((p) => (
                                <button
                                    key={p}
                                    onClick={() => handleProfileChange(p)}
                                    className={`py-2 text-xs font-bold rounded-xl border transition-all ${
                                        riskProfile === p
                                            ? "bg-indigo-600 text-white border-indigo-400 shadow-md"
                                            : "bg-white/5 text-gray-400 border-white/5 hover:text-white"
                                    }`}
                                >
                                    {p === "conservative" ? "안정 추구형" : p === "neutral" ? "위험 중립형" : "적극 투자형"}
                                </button>
                            ))}
                        </div>
                        <span className="text-[10px] text-gray-400">
                            * 질문 답변 기준: 위험 중립형(시장 평균 수익률 추구, 균형 배분)
                        </span>
                    </div>
                </div>

                {/* Diagnostic Result Banner */}
                {portfolioGuide?.diagnosis && (
                    <div className={`rounded-2xl p-5 border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                        portfolioGuide.diagnosis.status === "warning"
                            ? "bg-rose-950/20 border-rose-500/30"
                            : "bg-emerald-950/20 border-emerald-500/30"
                    }`}>
                        <div className="flex items-start gap-3">
                            <div className="p-2 rounded-xl bg-rose-500/20 text-rose-400 shrink-0 mt-0.5">
                                <AlertCircle className="w-5 h-5" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-xs font-bold text-rose-400 bg-rose-500/20 px-2 py-0.5 rounded">
                                        진단: {portfolioGuide.diagnosis.risk_level}
                                    </span>
                                </div>
                                <p className="text-xs md:text-sm text-gray-200">
                                    {portfolioGuide.diagnosis.message}
                                </p>
                            </div>
                        </div>
                        {portfolioGuide.current_vs_target?.trim_needed_pct > 0 && (
                            <div className="shrink-0 text-right">
                                <span className="text-[10px] text-gray-400 block">권고 차익실현(Trim) 비중</span>
                                <span className="text-xl font-black text-rose-400 font-mono">
                                    약 -{portfolioGuide.current_vs_target.trim_needed_pct}%p
                                </span>
                            </div>
                        )}
                    </div>
                )}

                {/* Current vs Target Allocation Comparison */}
                {portfolioGuide?.current_vs_target && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-[#181a26]/70 border border-white/10 rounded-2xl p-5">
                            <span className="text-xs font-bold text-gray-400 block mb-3">현재 추정 포트폴리오 비중</span>
                            <div className="flex flex-col gap-2">
                                <div className="flex justify-between text-xs">
                                    <span className="text-rose-400 font-bold">성장 기술주</span>
                                    <span className="font-mono font-bold text-white">{portfolioGuide.current_vs_target.current.tech_growth}%</span>
                                </div>
                                <div className="w-full h-2 bg-black/50 rounded-full overflow-hidden">
                                    <div style={{ width: `${portfolioGuide.current_vs_target.current.tech_growth}%` }} className="h-full bg-rose-500" />
                                </div>

                                <div className="flex justify-between text-xs mt-1">
                                    <span className="text-indigo-400 font-bold">인컴/배당 자산</span>
                                    <span className="font-mono font-bold text-white">{portfolioGuide.current_vs_target.current.other_dividend}%</span>
                                </div>
                                <div className="w-full h-2 bg-black/50 rounded-full overflow-hidden">
                                    <div style={{ width: `${portfolioGuide.current_vs_target.current.other_dividend}%` }} className="h-full bg-indigo-500" />
                                </div>

                                <div className="flex justify-between text-xs mt-1">
                                    <span className="text-emerald-400 font-bold">안전/채권 자산</span>
                                    <span className="font-mono font-bold text-white">{portfolioGuide.current_vs_target.current.safe_haven}%</span>
                                </div>
                                <div className="w-full h-2 bg-black/50 rounded-full overflow-hidden">
                                    <div style={{ width: `${portfolioGuide.current_vs_target.current.safe_haven}%` }} className="h-full bg-emerald-500" />
                                </div>
                            </div>
                        </div>

                        <div className="bg-gradient-to-br from-[#1b1e33] to-[#141624] border border-indigo-500/30 rounded-2xl p-5">
                            <span className="text-xs font-bold text-indigo-300 block mb-3">Core-Satellite 목표 리밸런싱 비중</span>
                            <div className="flex flex-col gap-2">
                                <div className="flex justify-between text-xs">
                                    <span className="text-indigo-300 font-bold">성장 자산 (빅테크/B2B AI)</span>
                                    <span className="font-mono font-bold text-white">{portfolioGuide.current_vs_target.target.tech_growth}% (목표)</span>
                                </div>
                                <div className="w-full h-2 bg-black/50 rounded-full overflow-hidden">
                                    <div style={{ width: `${portfolioGuide.current_vs_target.target.tech_growth}%` }} className="h-full bg-indigo-400" />
                                </div>

                                <div className="flex justify-between text-xs mt-1">
                                    <span className="text-indigo-300 font-bold">인컴/배당 (SCHD 등 배당성장)</span>
                                    <span className="font-mono font-bold text-white">{portfolioGuide.current_vs_target.target.dividend_income}% (목표)</span>
                                </div>
                                <div className="w-full h-2 bg-black/50 rounded-full overflow-hidden">
                                    <div style={{ width: `${portfolioGuide.current_vs_target.target.dividend_income}%` }} className="h-full bg-indigo-500" />
                                </div>

                                <div className="flex justify-between text-xs mt-1">
                                    <span className="text-emerald-400 font-bold">안전자산 (미국 중장기 국채 TLT)</span>
                                    <span className="font-mono font-bold text-white">{portfolioGuide.current_vs_target.target.safe_haven}% (목표)</span>
                                </div>
                                <div className="w-full h-2 bg-black/50 rounded-full overflow-hidden">
                                    <div style={{ width: `${portfolioGuide.current_vs_target.target.safe_haven}%` }} className="h-full bg-emerald-400" />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* 3 Step Action Plans */}
                <div>
                    <h4 className="text-sm font-bold text-gray-300 mb-3 flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-indigo-400" />
                        종목군별 세부 리밸런싱 실행 로드맵
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {portfolioGuide?.action_plans?.map((plan: any) => (
                            <div key={plan.step} className="bg-[#181a26]/70 border border-white/10 rounded-2xl p-5 flex flex-col justify-between">
                                <div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 font-mono text-xs font-bold flex items-center justify-center">
                                            {plan.step}
                                        </span>
                                        <span className="text-xs font-bold text-gray-400">{plan.category}</span>
                                    </div>
                                    <h5 className="text-sm font-bold text-white mb-3">{plan.action}</h5>

                                    <div className="flex flex-col gap-2.5">
                                        {plan.targets?.map((t: any, tIdx: number) => (
                                            <div key={tIdx} className="bg-black/30 rounded-xl p-3 border border-white/5">
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="text-xs font-bold text-white">{t.symbol}</span>
                                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white/10 text-indigo-300">
                                                        {t.action_type}
                                                    </span>
                                                </div>
                                                <p className="text-[11px] text-gray-400 leading-relaxed">
                                                    {t.advice}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
