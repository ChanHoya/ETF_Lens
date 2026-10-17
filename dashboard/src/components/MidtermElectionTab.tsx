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
    Flame,
    X,
    FileText,
    HelpCircle
} from "lucide-react";
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip as RechartsTooltip,
    ResponsiveContainer,
    Legend,
    ReferenceArea
} from "recharts";
import { STANDARD_TOOLTIP_STYLE, STANDARD_LEGEND_WRAPPER_STYLE, useChartHighlight } from "@/lib/chartTheme";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function MidtermElectionTab() {
    const [overview, setOverview] = useState<any>(null);
    const [radar, setRadar] = useState<any>(null);
    const [scenariosData, setScenariosData] = useState<any>(null);
    const [historical, setHistorical] = useState<any>(null);
    const [portfolioGuide, setPortfolioGuide] = useState<any>(null);

    const [selectedScenarioId, setSelectedScenarioId] = useState<string>("gridlock");
    const [simSenate, setSimSenate] = useState<"republican" | "democrat">("republican");
    const [simHouse, setSimHouse] = useState<"republican" | "democrat">("democrat");

    const handleChamberChange = (sen: "republican" | "democrat", h: "republican" | "democrat") => {
        setSimSenate(sen);
        setSimHouse(h);
        if (sen === "republican" && h === "democrat") setSelectedScenarioId("gridlock");
        else if (sen === "republican" && h === "republican") setSelectedScenarioId("red_hold");
        else if (sen === "democrat" && h === "democrat") setSelectedScenarioId("blue_wave");
        else setSelectedScenarioId("reverse_gridlock");
    };

    const handleScenarioSelect = (id: string) => {
        setSelectedScenarioId(id);
        if (id === "gridlock") { setSimSenate("republican"); setSimHouse("democrat"); }
        else if (id === "red_hold") { setSimSenate("republican"); setSimHouse("republican"); }
        else if (id === "blue_wave") { setSimSenate("democrat"); setSimHouse("democrat"); }
        else if (id === "reverse_gridlock") { setSimSenate("democrat"); setSimHouse("republican"); }
    };

    const countdown = useMemo(() => {
        const target = new Date("2026-11-03T00:00:00").getTime();
        const now = new Date().getTime();
        const diff = Math.max(0, target - now);
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        return { days, hours, minutes };
    }, []);

    const [techWeight, setTechWeight] = useState<number>(55.0);
    const [dividendWeight, setDividendWeight] = useState<number>(27.0);
    const [safeWeight, setSafeWeight] = useState<number>(18.0);
    const [riskProfile, setRiskProfile] = useState<"conservative" | "neutral" | "aggressive">("neutral");
    const [loading, setLoading] = useState<boolean>(true);
    const [refreshing, setRefreshing] = useState<boolean>(false);

    // 1950~2026 역사적 사이클 차트 필터 및 오버레이 상태
    const [cyclePeriod, setCyclePeriod] = useState<"5Y" | "10Y" | "30Y" | "ALL">("ALL");
    const [showFedRate, setShowFedRate] = useState<boolean>(true); // 미국 기준금리(Fed Rate) 오버레이
    const [showEvents, setShowEvents] = useState<boolean>(true); // 주요 역사적 이벤트 마커

    const trajectoryHighlight = useChartHighlight();
    const macroHistHighlight = useChartHighlight();

    // 선택 기간별 필터링 데이터
    const filteredCycles = useMemo(() => {
        const list = historical?.historical_cycles || [];
        if (!list.length) return [];
        if (cyclePeriod === "5Y") return list.filter((d: any) => d.year >= 2021);
        if (cyclePeriod === "10Y") return list.filter((d: any) => d.year >= 2016);
        if (cyclePeriod === "30Y") return list.filter((d: any) => d.year >= 1996);
        return list;
    }, [historical, cyclePeriod]);

    // 선택 기간 내 선거 주기별 성과 통계
    const cycleStats = useMemo(() => {
        if (!filteredCycles.length) return null;
        const presYears = filteredCycles.filter((d: any) => d.election_type === "presidential" && d.sp500_return !== null);
        const midYears = filteredCycles.filter((d: any) => d.election_type === "midterm" && d.sp500_return !== null);
        const offYears = filteredCycles.filter((d: any) => d.election_type === "none" && d.sp500_return !== null);

        const calcAvg = (arr: any[]) => {
            if (!arr.length) return 0;
            const sum = arr.reduce((acc, cur) => acc + (cur.sp500_return || 0), 0);
            return +(sum / arr.length).toFixed(1);
        };

        const calcWinRate = (arr: any[]) => {
            if (!arr.length) return 0;
            const wins = arr.filter((d) => (d.sp500_return || 0) > 0).length;
            return Math.round((wins / arr.length) * 100);
        };

        const sortedByReturn = [...filteredCycles]
            .filter((d: any) => d.sp500_return !== null)
            .sort((a: any, b: any) => (b.sp500_return || 0) - (a.sp500_return || 0));

        const bestYear = sortedByReturn[0] || null;
        const worstYear = sortedByReturn[sortedByReturn.length - 1] || null;

        return {
            presAvg: calcAvg(presYears),
            presWinRate: calcWinRate(presYears),
            presCount: presYears.length,
            midAvg: calcAvg(midYears),
            midWinRate: calcWinRate(midYears),
            midCount: midYears.length,
            offAvg: calcAvg(offYears),
            offWinRate: calcWinRate(offYears),
            offCount: offYears.length,
            bestYear,
            worstYear,
        };
    }, [filteredCycles]);

    // Interview Modal State
    const [isInterviewModalOpen, setIsInterviewModalOpen] = useState<boolean>(false);
    const [interviewAnswers, setInterviewAnswers] = useState({
        techWeight: 55,
        dividendWeight: 27,
        safeWeight: 18,
        riskProfile: "neutral" as "conservative" | "neutral" | "aggressive",
        focusTheme: "ai_infra"
    });

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
            await fetchPortfolioGuide(techWeight, riskProfile, dividendWeight, safeWeight);
        } catch (err) {
            console.error("Failed to load midterm election data:", err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    // Calculate portfolio guide dynamically
    const fetchPortfolioGuide = async (tw: number, rp: string, dw?: number, sw?: number) => {
        try {
            const curDw = dw !== undefined ? dw : dividendWeight;
            const curSw = sw !== undefined ? sw : safeWeight;
            const res = await fetch(`${API_BASE}/api/v1/midterm/portfolio-guide`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    tech_weight: tw,
                    dividend_weight: curDw,
                    safe_weight: curSw,
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

    // Slider adjustment updates tech, dividend, safe synchronously
    const handleWeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = parseFloat(e.target.value);
        setTechWeight(val);
        const remaining = Math.max(0, 100 - val);
        const newDiv = Math.round(remaining * 0.6);
        const newSafe = Math.round(remaining - newDiv);
        setDividendWeight(newDiv);
        setSafeWeight(newSafe);
        fetchPortfolioGuide(val, riskProfile, newDiv, newSafe);
    };

    const handleProfileChange = (p: "conservative" | "neutral" | "aggressive") => {
        setRiskProfile(p);
        fetchPortfolioGuide(techWeight, p, dividendWeight, safeWeight);
    };

    // Apply interview results to dashboard
    const handleApplyInterview = () => {
        const tw = interviewAnswers.techWeight;
        const dw = interviewAnswers.dividendWeight;
        const sw = interviewAnswers.safeWeight;
        const rp = interviewAnswers.riskProfile;

        setTechWeight(tw);
        setDividendWeight(dw);
        setSafeWeight(sw);
        setRiskProfile(rp);
        fetchPortfolioGuide(tw, rp, dw, sw);
        setIsInterviewModalOpen(false);
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
                            <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-1.5 shadow-sm">
                                <Clock className="w-3.5 h-3.5 text-amber-400" />
                                D-{countdown.days}일 {countdown.hours}시간 {countdown.minutes}분 (2026.11.03)
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

            {/* Section 1: 1. 미국 대통령 중간선거 개요 & 3대 핵심 법칙 (첨부1 대체 완료) */}
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

                {/* 첨부1 대체: 미국 중간선거와 의회 권력 지형의 3대 핵심 법칙 */}
                <div className="bg-gradient-to-br from-[#181a2e] via-[#151726] to-[#121420] border border-indigo-500/30 rounded-2xl p-5 md:p-6 shadow-xl flex flex-col gap-4">
                    <div className="flex items-center justify-between border-b border-white/5 pb-3">
                        <div className="flex items-center gap-2.5">
                            <span className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                                <FileText className="w-5 h-5" />
                            </span>
                            <div>
                                <h4 className="text-base md:text-lg font-bold text-white flex items-center gap-2">
                                    {overview?.midterm_deep_dive?.title || "미국 중간선거와 의회 권력 지형의 3대 핵심 법칙"}
                                </h4>
                                <p className="text-xs text-gray-400">
                                    {overview?.midterm_deep_dive?.subtitle || "워싱턴 정가의 입법 교착(Gridlock)과 금융시장 반응 메커니즘"}
                                </p>
                            </div>
                        </div>
                        <span className="hidden sm:inline-flex text-[11px] font-bold text-indigo-300 bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/20">
                            역대 통계 기반 팩트 분석
                        </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {(overview?.midterm_deep_dive?.rules || [
                            {
                                rule_name: "중간선거의 저주 (Midterm Curse)",
                                badge: "역사적 정규 패턴",
                                color: "rose",
                                desc: "1934년 이후 22차례 중간선거 중 집권 여당이 하원에서 의석을 잃은 경우가 19차례(86.4%, 평균 -26석 상실)에 달합니다. 유권자들의 견제 심리로 인해 여당 패배 및 분점정부(Gridlock) 형성이 정형화된 패턴입니다."
                            },
                            {
                                rule_name: "상·하원의 비대칭 교체 주기와 완충 효과",
                                badge: "헌법적 제동 장치",
                                color: "purple",
                                desc: "하원은 2년마다 435석 전원이 여론에 직접 노출되어 급변하는 반면, 상원은 6년 임기로 1/3씩 교체되어 정권 초기의 급진적 법안이나 세제 개편을 완충하는 헌법적 제동 장치 역할을 수행합니다."
                            },
                            {
                                rule_name: "입법 교착(Gridlock)과 행정명령 정치",
                                badge: "통상·외교 독자 권한",
                                color: "indigo",
                                desc: "의회가 분할되면 재정 확장이나 세제 감세 법안 제정은 동결되지만, 대통령은 무역확장법 232조 및 통상법 301조 등 행정명령(Executive Order)을 통해 대외 관세·안보 통제 드라이브를 집중 행사합니다."
                            }
                        ]).map((rule: any, rIdx: number) => {
                            const badgeColor =
                                rule.color === "rose" ? "bg-rose-500/15 text-rose-300 border-rose-500/30" :
                                rule.color === "purple" ? "bg-purple-500/15 text-purple-300 border-purple-500/30" :
                                "bg-indigo-500/15 text-indigo-300 border-indigo-500/30";

                            return (
                                <div key={rIdx} className="bg-[#12131c]/80 border border-white/5 rounded-xl p-4 flex flex-col justify-between hover:border-white/20 transition-all">
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badgeColor}`}>
                                                {rule.badge}
                                            </span>
                                            <span className="text-[11px] font-mono text-gray-500">Law 0{rIdx + 1}</span>
                                        </div>
                                        <h5 className="text-sm font-bold text-white mb-2">{rule.rule_name}</h5>
                                        <p className="text-xs text-gray-300 leading-relaxed">
                                            {rule.desc}
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
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

            {/* Section 3: 3. 4대 선거 시나리오 인터랙티브 판세 시뮬레이터 & 금융시장 영향 매트릭스 */}
            <div className="w-full bg-[#121217]/70 border border-white/10 rounded-3xl p-5 md:p-7 backdrop-blur-md shadow-xl flex flex-col gap-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-purple-500/20 border border-purple-500/30 text-purple-400">
                            <Layers className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-lg md:text-xl font-bold text-white flex items-center gap-2">
                                3. 4대 선거 시나리오 인터랙티브 판세 시뮬레이터
                                <span className="text-xs px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-semibold border border-purple-500/30">
                                    상·하원 조합 실시간 연동
                                </span>
                            </h3>
                            <p className="text-xs text-gray-400">
                                상원(34석) 및 하원(435석) 장악 정당 조합을 직접 클릭하여 의회 권력 지형별 수혜/부담 섹터를 시뮬레이션합니다.
                            </p>
                        </div>
                    </div>

                    {/* Scenario Switcher Tabs */}
                    <div className="flex flex-wrap items-center bg-black/40 border border-white/10 rounded-xl p-1 gap-1">
                        {scenariosData?.scenarios?.map((sc: any) => (
                            <button
                                key={sc.id}
                                onClick={() => handleScenarioSelect(sc.id)}
                                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                                    selectedScenarioId === sc.id
                                        ? "bg-indigo-600 text-white shadow-lg shadow-indigo-900/40"
                                        : "text-gray-400 hover:text-white"
                                }`}
                            >
                                {sc.id === "gridlock" ? "분점정부 (60%)" :
                                 sc.id === "red_hold" ? "여당 수성 (25%)" :
                                 sc.id === "blue_wave" ? "야당 압승 (10%)" : "역분점정부 (5%)"}
                            </button>
                        ))}
                    </div>
                </div>

                {/* 인터랙티브 상원 & 하원 장악 시뮬레이터 컨트롤러 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-black/30 p-4 rounded-2xl border border-white/5">
                    {/* 상원 컨트롤러 */}
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-gray-300 flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-indigo-400"></span>
                                상원 (Senate, 34석 선출)
                            </span>
                            <span className="text-[11px] text-gray-500 font-mono">인사·조약 인준권 보유</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                type="button"
                                onClick={() => handleChamberChange("republican", simHouse)}
                                className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                                    simSenate === "republican"
                                        ? "bg-rose-500/20 border-rose-500/60 text-rose-200 shadow-md shadow-rose-950/40"
                                        : "bg-black/40 border-white/5 text-gray-400 hover:text-gray-200"
                                }`}
                            >
                                <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                                🔴 공화당 수성 (우세)
                            </button>
                            <button
                                type="button"
                                onClick={() => handleChamberChange("democrat", simHouse)}
                                className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                                    simSenate === "democrat"
                                        ? "bg-blue-500/20 border-blue-500/60 text-blue-200 shadow-md shadow-blue-950/40"
                                        : "bg-black/40 border-white/5 text-gray-400 hover:text-gray-200"
                                }`}
                            >
                                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                🔵 민주당 역전
                            </button>
                        </div>
                    </div>

                    {/* 하원 컨트롤러 */}
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-gray-300 flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-purple-400"></span>
                                하원 (House, 435석 전원 선출)
                            </span>
                            <span className="text-[11px] text-gray-500 font-mono">예산안 발의권 보유</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                type="button"
                                onClick={() => handleChamberChange(simSenate, "democrat")}
                                className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                                    simHouse === "democrat"
                                        ? "bg-blue-500/20 border-blue-500/60 text-blue-200 shadow-md shadow-blue-950/40"
                                        : "bg-black/40 border-white/5 text-gray-400 hover:text-gray-200"
                                }`}
                            >
                                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                🔵 민주당 탈환 (우세)
                            </button>
                            <button
                                type="button"
                                onClick={() => handleChamberChange(simSenate, "republican")}
                                className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                                    simHouse === "republican"
                                        ? "bg-rose-500/20 border-rose-500/60 text-rose-200 shadow-md shadow-rose-950/40"
                                        : "bg-black/40 border-white/5 text-gray-400 hover:text-gray-200"
                                }`}
                            >
                                <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                                🔴 공화당 수성
                            </button>
                        </div>
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

                        {/* Sector Impacts */}
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

            {/* Section 4: 4. 역대 중간선거 S&P 500 / 나스닥 계절성 및 1950~2026 실제 사이클 그래프 (첨부2 고도화) */}
            <div className="w-full bg-[#121217]/70 border border-white/10 rounded-3xl p-5 md:p-7 backdrop-blur-md shadow-xl flex flex-col gap-6">
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400">
                            <BarChart3 className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-lg md:text-xl font-bold text-white flex items-center gap-2">
                                4. 역대 중간선거 S&P 500 & 나스닥 계절성 통계 (1950~2022 플레이북)
                            </h3>
                            <p className="text-xs text-gray-400">
                                19회 중간선거 사이클 분석: 선거 전 8~10월 바닥 형성 후 12개월간 안도 랠리 패턴 (나스닥 추가 및 77개년 실전 사이클)
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

                {/* S&P 500 & 나스닥 월별 평균 추이 그래프 (첨부2 상단) */}
                <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
                            <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
                            월별 평균 지수 추이 (1월=100 기준 S&P 500 및 나스닥 비교)
                        </h4>
                        <span className="text-[10px] text-gray-500">선거 해 8~10월 바닥 형성 후 11월 급반등 궤적</span>
                    </div>
                    <div className="w-full bg-black/40 border border-white/5 rounded-2xl p-4 relative" style={{ height: "340px" }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={historical?.trajectory || []} margin={{ top: 15, right: 20, left: -10, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                                <XAxis dataKey="month" stroke="#71717a" tick={{ fontSize: 11 }} tickLine={false} />
                                <YAxis domain={["auto", "auto"]} stroke="#71717a" tick={{ fontSize: 11 }} tickLine={false} />
                                <RechartsTooltip contentStyle={STANDARD_TOOLTIP_STYLE} />
                                <Legend
                                    verticalAlign="top"
                                    height={36}
                                    iconType="circle"
                                    wrapperStyle={STANDARD_LEGEND_WRAPPER_STYLE}
                                    onClick={trajectoryHighlight.handleLegendClick}
                                    formatter={trajectoryHighlight.renderLegendText}
                                />
                                <Line
                                    type="monotone"
                                    name="S&P 500 중간선거 해"
                                    dataKey="midterm_year"
                                    stroke="#f59e0b"
                                    strokeWidth={trajectoryHighlight.getStrokeWidth("midterm_year", 3)}
                                    strokeOpacity={trajectoryHighlight.getOpacity("midterm_year")}
                                    dot={{ r: 3, fill: "#f59e0b" }}
                                />
                                <Line
                                    type="monotone"
                                    name="나스닥 중간선거 해"
                                    dataKey="nasdaq_midterm"
                                    stroke="#a855f7"
                                    strokeWidth={trajectoryHighlight.getStrokeWidth("nasdaq_midterm", 2.5)}
                                    strokeOpacity={trajectoryHighlight.getOpacity("nasdaq_midterm")}
                                    dot={{ r: 3, fill: "#a855f7" }}
                                />
                                <Line
                                    type="monotone"
                                    name="S&P 500 일반 해"
                                    dataKey="general_year"
                                    stroke="#71717a"
                                    strokeWidth={trajectoryHighlight.getStrokeWidth("general_year", 1.5)}
                                    strokeOpacity={trajectoryHighlight.getOpacity("general_year")}
                                    strokeDasharray="4 4"
                                    dot={false}
                                />
                                <Line
                                    type="monotone"
                                    name="나스닥 일반 해"
                                    dataKey="nasdaq_general"
                                    stroke="#38bdf8"
                                    strokeWidth={trajectoryHighlight.getStrokeWidth("nasdaq_general", 1.5)}
                                    strokeOpacity={trajectoryHighlight.getOpacity("nasdaq_general")}
                                    strokeDasharray="2 2"
                                    dot={false}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 실제 1950~현재까지의 S&P 500 / 나스닥 사이클 그래프 (첨부2 신규 하단 그래프) */}
                <div className="flex flex-col gap-4 pt-4 border-t border-white/5">
                    {/* Header & Controls */}
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                        <div>
                            <div className="flex items-center gap-2">
                                <h4 className="text-sm md:text-base font-bold text-white flex items-center gap-2">
                                    <Activity className="w-4 h-4 text-indigo-400" />
                                    1950~현재(2026) 실제 S&P 500 / 나스닥 사이클 및 선거 주기
                                </h4>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                    도트 상시표시 & 멀티 지표
                                </span>
                            </div>
                            <p className="text-[11px] text-gray-400 mt-0.5">
                                대통령선거 해(파란색 도트), 중간선거 해(빨간색 도트), 미 연준 기준금리(주황색) 및 주요 역사적 사건 복합 오버레이
                            </p>
                        </div>

                        {/* Filter & Toggle Controls */}
                        <div className="flex flex-wrap items-center gap-2">
                            {/* Period Filter (5Y, 10Y, 30Y, ALL) */}
                            <div className="flex items-center bg-black/50 border border-white/10 rounded-xl p-1 gap-1">
                                {(["5Y", "10Y", "30Y", "ALL"] as const).map((period) => (
                                    <button
                                        key={period}
                                        onClick={() => setCyclePeriod(period)}
                                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                                            cyclePeriod === period
                                                ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-500/20 scale-[1.02]"
                                                : "text-gray-400 hover:text-white hover:bg-white/5"
                                        }`}
                                    >
                                        {period === "ALL" ? "전체 (1950~)" : period}
                                    </button>
                                ))}
                            </div>

                            {/* Additional Indicator Toggles */}
                            <div className="flex items-center gap-1.5 bg-black/50 border border-white/10 rounded-xl p-1">
                                <button
                                    onClick={() => setShowFedRate(!showFedRate)}
                                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition-all ${
                                        showFedRate
                                            ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                                            : "text-gray-500 hover:text-gray-300 border border-transparent"
                                    }`}
                                    title="미국 연방기금 기준금리(Fed Funds Rate) 오버레이 토글"
                                >
                                    <DollarSign className="w-3 h-3" />
                                    <span>기준금리(Fed)</span>
                                </button>
                                <button
                                    onClick={() => setShowEvents(!showEvents)}
                                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition-all ${
                                        showEvents
                                            ? "bg-purple-500/20 text-purple-300 border border-purple-500/40"
                                            : "text-gray-500 hover:text-gray-300 border border-transparent"
                                    }`}
                                    title="역사적 주요 정치/경제 이벤트 마커 토글"
                                >
                                    <Landmark className="w-3 h-3" />
                                    <span>주요 이벤트</span>
                                </button>
                            </div>

                            {/* Dot Legends */}
                            <div className="hidden sm:flex items-center gap-2 text-[10px] font-bold ml-1">
                                <span className="px-2 py-1 rounded-md bg-blue-500/20 text-blue-300 border border-blue-500/30 flex items-center gap-1.5">
                                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500 border border-white" />
                                    대선 해 (도트)
                                </span>
                                <span className="px-2 py-1 rounded-md bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1.5">
                                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 border border-white" />
                                    중간선거 해 (도트)
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Dynamic KPI Stats Bar based on Selected Period */}
                    {cycleStats && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                            <div className="bg-[#141622] border border-blue-500/30 rounded-xl p-3 flex flex-col gap-1">
                                <div className="flex items-center justify-between text-blue-400 text-[11px] font-bold">
                                    <span className="flex items-center gap-1.5">
                                        <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                                        대통령선거 해 평균
                                    </span>
                                    <span className="text-[10px] text-gray-400 font-normal">총 {cycleStats.presCount}회</span>
                                </div>
                                <div className="flex items-baseline justify-between mt-1">
                                    <span className={`text-base font-black font-mono ${cycleStats.presAvg >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                                        {cycleStats.presAvg >= 0 ? "+" : ""}{cycleStats.presAvg}%
                                    </span>
                                    <span className="text-[10px] text-gray-400">
                                        상승확률 <span className="text-white font-bold">{cycleStats.presWinRate}%</span>
                                    </span>
                                </div>
                            </div>

                            <div className="bg-[#141622] border border-rose-500/30 rounded-xl p-3 flex flex-col gap-1">
                                <div className="flex items-center justify-between text-rose-400 text-[11px] font-bold">
                                    <span className="flex items-center gap-1.5">
                                        <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />
                                        중간선거 해 평균
                                    </span>
                                    <span className="text-[10px] text-gray-400 font-normal">총 {cycleStats.midCount}회</span>
                                </div>
                                <div className="flex items-baseline justify-between mt-1">
                                    <span className={`text-base font-black font-mono ${cycleStats.midAvg >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                                        {cycleStats.midAvg >= 0 ? "+" : ""}{cycleStats.midAvg}%
                                    </span>
                                    <span className="text-[10px] text-gray-400">
                                        상승확률 <span className="text-white font-bold">{cycleStats.midWinRate}%</span>
                                    </span>
                                </div>
                            </div>

                            <div className="bg-[#141622] border border-white/10 rounded-xl p-3 flex flex-col gap-1">
                                <div className="flex items-center justify-between text-gray-300 text-[11px] font-bold">
                                    <span className="flex items-center gap-1.5">
                                        <span className="w-2 h-2 rounded-full bg-gray-400" />
                                        일반 해 평균
                                    </span>
                                    <span className="text-[10px] text-gray-400 font-normal">총 {cycleStats.offCount}회</span>
                                </div>
                                <div className="flex items-baseline justify-between mt-1">
                                    <span className={`text-base font-black font-mono ${cycleStats.offAvg >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                                        {cycleStats.offAvg >= 0 ? "+" : ""}{cycleStats.offAvg}%
                                    </span>
                                    <span className="text-[10px] text-gray-400">
                                        상승확률 <span className="text-white font-bold">{cycleStats.offWinRate}%</span>
                                    </span>
                                </div>
                            </div>

                            <div className="bg-[#141622] border border-amber-500/20 rounded-xl p-3 flex flex-col gap-1">
                                <div className="flex items-center justify-between text-amber-400 text-[11px] font-bold">
                                    <span className="flex items-center gap-1.5">
                                        <Sparkles className="w-3 h-3 text-amber-300" />
                                        기간 내 최고/최저 해
                                    </span>
                                    <span className="text-[10px] text-gray-400">S&P 500</span>
                                </div>
                                <div className="flex items-center justify-between text-[11px] font-mono mt-1">
                                    <span className="text-emerald-400">
                                        최고: {cycleStats.bestYear ? `${cycleStats.bestYear.year}년(+${cycleStats.bestYear.sp500_return}%)` : "-"}
                                    </span>
                                    <span className="text-rose-400">
                                        최저: {cycleStats.worstYear ? `${cycleStats.worstYear.year}년(${cycleStats.worstYear.sp500_return}%)` : "-"}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Chart Container */}
                    <div className="w-full bg-black/40 border border-white/5 rounded-2xl p-4 relative" style={{ height: "440px" }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart
                                key={`historical-cycle-chart-${cyclePeriod}`}
                                data={filteredCycles}
                                margin={{ top: 25, right: showFedRate ? 45 : 30, left: 10, bottom: 20 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                                <XAxis
                                    dataKey="year"
                                    stroke="#71717a"
                                    tick={{ fontSize: 10, fill: "#9ca3af" }}
                                    tickLine={false}
                                    interval={cyclePeriod === "5Y" ? 0 : cyclePeriod === "10Y" ? 0 : cyclePeriod === "30Y" ? 2 : 4}
                                />
                                <YAxis
                                    yAxisId="sp"
                                    stroke="#10b981"
                                    tick={{ fontSize: 10, fill: "#10b981" }}
                                    tickLine={false}
                                    domain={["auto", "auto"]}
                                    tickFormatter={(v) => `${v.toLocaleString()}`}
                                />
                                <YAxis
                                    yAxisId="nq"
                                    orientation="right"
                                    stroke="#a855f7"
                                    tick={{ fontSize: 10, fill: "#a855f7" }}
                                    tickLine={false}
                                    domain={["auto", "auto"]}
                                    tickFormatter={(v) => `${v.toLocaleString()}`}
                                />
                                {showFedRate && (
                                    <YAxis
                                        yAxisId="fed"
                                        orientation="right"
                                        stroke="#f59e0b"
                                        tick={{ fontSize: 9, fill: "#f59e0b" }}
                                        tickLine={false}
                                        domain={[0, cyclePeriod === "5Y" || cyclePeriod === "10Y" ? 8 : 20]}
                                        unit="%"
                                        tickFormatter={(v) => `${v}%`}
                                    />
                                )}

                                <RechartsTooltip
                                    content={({ active, payload, label }) => {
                                        if (active && payload && payload.length) {
                                            const d = payload[0].payload;
                                            const isPres = d.election_type === "presidential";
                                            const isMid = d.election_type === "midterm";
                                            return (
                                                <div className="bg-[#0e101a] border border-white/20 rounded-xl p-3 shadow-2xl text-[11px] flex flex-col gap-1.5 min-w-[220px] backdrop-blur-md">
                                                    <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-bold text-white font-mono text-xs">{label}년</span>
                                                            <span
                                                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                                                    isPres
                                                                        ? "bg-blue-500/25 text-blue-300 border border-blue-500/40"
                                                                        : isMid
                                                                        ? "bg-rose-500/25 text-rose-300 border border-rose-500/40"
                                                                        : "bg-white/10 text-gray-300"
                                                                }`}
                                                            >
                                                                {d.election_label || (isPres ? "대통령선거" : isMid ? "중간선거" : "일반 해")}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    {/* Major Historical Event Badge */}
                                                    {d.major_event && (
                                                        <div className="bg-purple-950/40 border border-purple-500/30 rounded-lg px-2.5 py-1 text-[11px] text-purple-200 flex items-center gap-1.5 font-medium">
                                                            <Landmark className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                                                            <span>{d.major_event}</span>
                                                        </div>
                                                    )}

                                                    <div className="flex flex-col gap-1.5 pt-0.5">
                                                        <div className="flex justify-between items-center text-emerald-400">
                                                            <span className="flex items-center gap-1.5">
                                                                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                                                                S&P 500:
                                                            </span>
                                                            <span className="font-mono font-bold">
                                                                {d.sp500?.toLocaleString()} pt
                                                                {d.sp500_return !== null && ` (${d.sp500_return > 0 ? "+" : ""}${d.sp500_return}%)`}
                                                            </span>
                                                        </div>

                                                        {d.nasdaq !== null && (
                                                            <div className="flex justify-between items-center text-purple-400">
                                                                <span className="flex items-center gap-1.5">
                                                                    <span className="w-2 h-2 rounded-full bg-purple-400" />
                                                                    나스닥(NASDAQ):
                                                                </span>
                                                                <span className="font-mono font-bold">
                                                                    {d.nasdaq?.toLocaleString()} pt
                                                                    {d.nasdaq_return !== null && ` (${d.nasdaq_return > 0 ? "+" : ""}${d.nasdaq_return}%)`}
                                                                </span>
                                                            </div>
                                                        )}

                                                        {d.fed_rate !== undefined && d.fed_rate !== null && (
                                                            <div className="flex justify-between items-center text-amber-400 border-t border-white/5 pt-1 mt-0.5">
                                                                <span className="flex items-center gap-1.5">
                                                                    <DollarSign className="w-3 h-3 text-amber-400" />
                                                                    미 기준금리(Fed Rate):
                                                                </span>
                                                                <span className="font-mono font-bold text-amber-300">
                                                                    {d.fed_rate}%
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        }
                                        return null;
                                    }}
                                />
                                <Legend
                                    verticalAlign="top"
                                    height={36}
                                    iconType="circle"
                                    wrapperStyle={STANDARD_LEGEND_WRAPPER_STYLE}
                                    onClick={macroHistHighlight.handleLegendClick}
                                    formatter={macroHistHighlight.renderLegendText}
                                />

                                {/* S&P 500 Line with Always-Visible Election Dots */}
                                <Line
                                    yAxisId="sp"
                                    type="monotone"
                                    name="S&P 500 지수 (좌측축)"
                                    dataKey="sp500"
                                    stroke="#10b981"
                                    strokeWidth={macroHistHighlight.getStrokeWidth("sp500", 2.2)}
                                    strokeOpacity={macroHistHighlight.getOpacity("sp500")}
                                    isAnimationActive={false}
                                    dot={(props: any) => {
                                        const { cx, cy, payload } = props;
                                        if (cx == null || cy == null || !payload) return null;
                                        const isPres = payload.election_type === "presidential";
                                        const isMid = payload.election_type === "midterm";

                                        if (isPres) {
                                            return (
                                                <g key={`sp-pres-dot-${payload.year}`}>
                                                    <circle cx={cx} cy={cy} r={7} fill="#3b82f6" fillOpacity={0.35} />
                                                    <circle cx={cx} cy={cy} r={4.5} fill="#3b82f6" stroke="#ffffff" strokeWidth={1.5} />
                                                </g>
                                            );
                                        }
                                        if (isMid) {
                                            return (
                                                <g key={`sp-mid-dot-${payload.year}`}>
                                                    <circle cx={cx} cy={cy} r={7} fill="#f43f5e" fillOpacity={0.35} />
                                                    <circle cx={cx} cy={cy} r={4.5} fill="#f43f5e" stroke="#ffffff" strokeWidth={1.5} />
                                                </g>
                                            );
                                        }
                                        // 일반 해: 5Y나 10Y일 때는 살짝 보이고 전체일 때는 1.5px로 은은하게
                                        return (
                                            <circle
                                                key={`sp-off-dot-${payload.year}`}
                                                cx={cx}
                                                cy={cy}
                                                r={cyclePeriod === "5Y" || cyclePeriod === "10Y" ? 2.5 : 1.5}
                                                fill="#ffffff"
                                                fillOpacity={0.4}
                                            />
                                        );
                                    }}
                                    activeDot={{ r: 6, fill: "#10b981", stroke: "#ffffff", strokeWidth: 2 }}
                                />

                                {/* NASDAQ Line */}
                                <Line
                                    yAxisId="nq"
                                    type="monotone"
                                    name="나스닥 지수 (우측축)"
                                    dataKey="nasdaq"
                                    stroke="#a855f7"
                                    strokeWidth={macroHistHighlight.getStrokeWidth("nasdaq", 2)}
                                    strokeOpacity={macroHistHighlight.getOpacity("nasdaq")}
                                    isAnimationActive={false}
                                    dot={(props: any) => {
                                        const { cx, cy, payload } = props;
                                        if (cx == null || cy == null || !payload) return null;
                                        // 나스닥 라인에서는 간결한 원형 도트 적용
                                        const isPres = payload.election_type === "presidential";
                                        const isMid = payload.election_type === "midterm";
                                        if (isPres) {
                                            return <circle key={`nq-pres-${payload.year}`} cx={cx} cy={cy} r={3.5} fill="#60a5fa" stroke="#1e1b4b" strokeWidth={1} />;
                                        }
                                        if (isMid) {
                                            return <circle key={`nq-mid-${payload.year}`} cx={cx} cy={cy} r={3.5} fill="#fb7185" stroke="#1e1b4b" strokeWidth={1} />;
                                        }
                                        return null;
                                    }}
                                    activeDot={{ r: 5, fill: "#a855f7", stroke: "#ffffff", strokeWidth: 2 }}
                                />

                                {/* Fed Rate Overlay Line */}
                                {showFedRate && (
                                    <Line
                                        yAxisId="fed"
                                        type="monotone"
                                        name="미 연준 기준금리 (Fed Rate %)"
                                        dataKey="fed_rate"
                                        stroke="#f59e0b"
                                        strokeWidth={2.2}
                                        strokeDasharray="5 3"
                                        isAnimationActive={false}
                                        dot={(props: any) => {
                                            const { cx, cy, payload } = props;
                                            if (cx == null || cy == null || !payload) return null;
                                            return (
                                                <circle
                                                    key={`fed-dot-${payload.year}`}
                                                    cx={cx}
                                                    cy={cy}
                                                    r={cyclePeriod === "5Y" || cyclePeriod === "10Y" ? 3.5 : 2}
                                                    fill="#f59e0b"
                                                    stroke="#ffffff"
                                                    strokeWidth={1}
                                                />
                                            );
                                        }}
                                        activeDot={{ r: 5, fill: "#f59e0b", stroke: "#ffffff", strokeWidth: 2 }}
                                    />
                                )}
                            </LineChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Historical Macro Events Quick Bar (선택 기간 내 주요 사건 표시) */}
                    {showEvents && (
                        <div className="bg-[#12131c] border border-white/5 rounded-xl p-3.5 flex flex-col gap-2">
                            <div className="flex items-center justify-between text-xs font-bold text-gray-300">
                                <span className="flex items-center gap-1.5 text-purple-300">
                                    <Landmark className="w-3.5 h-3.5" />
                                    선택 기간({cyclePeriod === "ALL" ? "1950~2026 전체" : cyclePeriod}) 내 주요 정치·경제 매크로 이벤트 타임라인
                                </span>
                                <span className="text-[10px] text-gray-500 font-normal">
                                    연준 금리 피벗 & 선거 연계 분석
                                </span>
                            </div>
                            <div className="flex flex-wrap gap-2 pt-1">
                                {filteredCycles
                                    .filter((d: any) => d.major_event)
                                    .slice(-8)
                                    .map((d: any) => (
                                        <div
                                            key={`event-chip-${d.year}`}
                                            className="px-2.5 py-1 rounded-lg bg-black/40 border border-white/10 text-[11px] flex items-center gap-1.5 hover:border-purple-500/40 transition-colors"
                                        >
                                            <span className="font-mono font-bold text-purple-400">{d.year}년</span>
                                            <span
                                                className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                                                    d.election_type === "presidential"
                                                        ? "bg-blue-500/20 text-blue-300"
                                                        : d.election_type === "midterm"
                                                        ? "bg-rose-500/20 text-rose-300"
                                                        : "bg-white/5 text-gray-400"
                                                }`}
                                            >
                                                {d.election_type === "presidential" ? "대선" : d.election_type === "midterm" ? "중간선거" : "일반"}
                                            </span>
                                            <span className="text-gray-200">{d.major_event}</span>
                                            {d.fed_rate !== undefined && (
                                                <span className="text-amber-400/80 font-mono text-[10px]">
                                                    ({d.fed_rate}%)
                                                </span>
                                            )}
                                        </div>
                                    ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="bg-[#151722] border border-white/5 rounded-xl p-4 text-xs text-gray-300 leading-relaxed flex items-start gap-3">
                    <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <span>{historical?.key_takeaway}</span>
                </div>
            </div>

            {/* Section 5: 5. AI 맞춤형 포트폴리오 리밸런싱 컨설턴트 (첨부3 실시간 동기화 & 인터뷰 팝업 완료) */}
            <div className="w-full bg-[#121217]/70 border border-white/10 rounded-3xl p-5 md:p-7 backdrop-blur-md shadow-xl flex flex-col gap-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
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

                    {/* Interview Trigger Button */}
                    <button
                        onClick={() => setIsInterviewModalOpen(true)}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 active:scale-95 text-xs font-bold text-white shadow-lg transition-all"
                    >
                        <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
                        <span>AI 투자성향 & 자산배분 진단 인터뷰</span>
                    </button>
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
                        <label className="text-xs font-bold text-gray-300">고객 투자 성향 (자유 변경 가능)</label>
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
                            * 현재 설정: {riskProfile === "conservative" ? "안정 추구형 (방어 자산 극대화)" : riskProfile === "neutral" ? "위험 중립형 (시장 균형 배분)" : "적극 투자형 (빅테크 성장 유지)"}
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

                {/* Current vs Target Allocation Comparison (실시간 동적 바 반영 버그 수정) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* 왼쪽: 현재 보유 포트폴리오 비중 (슬라이더 및 인터뷰 값과 100% 실시간 연동) */}
                    <div className="bg-[#181a26]/70 border border-white/10 rounded-2xl p-5">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-bold text-gray-400">현재 추정 포트폴리오 비중</span>
                            <span className="text-[10px] text-indigo-400 font-mono font-bold">실시간 동기화</span>
                        </div>
                        <div className="flex flex-col gap-3">
                            <div>
                                <div className="flex justify-between text-xs mb-1">
                                    <span className="text-rose-400 font-bold">성장 기술주</span>
                                    <span className="font-mono font-bold text-white">{techWeight.toFixed(0)}%</span>
                                </div>
                                <div className="w-full h-2.5 bg-black/50 rounded-full overflow-hidden">
                                    <div
                                        style={{ width: `${Math.min(100, Math.max(0, techWeight))}%` }}
                                        className="h-full bg-rose-500 transition-all duration-300"
                                    />
                                </div>
                            </div>

                            <div>
                                <div className="flex justify-between text-xs mb-1">
                                    <span className="text-indigo-400 font-bold">인컴/배당 자산</span>
                                    <span className="font-mono font-bold text-white">{dividendWeight.toFixed(0)}%</span>
                                </div>
                                <div className="w-full h-2.5 bg-black/50 rounded-full overflow-hidden">
                                    <div
                                        style={{ width: `${Math.min(100, Math.max(0, dividendWeight))}%` }}
                                        className="h-full bg-indigo-500 transition-all duration-300"
                                    />
                                </div>
                            </div>

                            <div>
                                <div className="flex justify-between text-xs mb-1">
                                    <span className="text-emerald-400 font-bold">안전/채권 자산</span>
                                    <span className="font-mono font-bold text-white">{safeWeight.toFixed(0)}%</span>
                                </div>
                                <div className="w-full h-2.5 bg-black/50 rounded-full overflow-hidden">
                                    <div
                                        style={{ width: `${Math.min(100, Math.max(0, safeWeight))}%` }}
                                        className="h-full bg-emerald-500 transition-all duration-300"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 오른쪽: 목표 리밸런싱 비중 */}
                    <div className="bg-gradient-to-br from-[#1b1e33] to-[#141624] border border-indigo-500/30 rounded-2xl p-5">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-bold text-indigo-300">Core-Satellite 목표 리밸런싱 비중</span>
                            <span className="text-[10px] text-indigo-400 font-bold">Gridlock 최적 모델</span>
                        </div>
                        <div className="flex flex-col gap-3">
                            <div>
                                <div className="flex justify-between text-xs mb-1">
                                    <span className="text-indigo-300 font-bold">성장 자산 (빅테크/B2B AI)</span>
                                    <span className="font-mono font-bold text-white">
                                        {portfolioGuide?.current_vs_target?.target?.tech_growth || 38}% (목표)
                                    </span>
                                </div>
                                <div className="w-full h-2.5 bg-black/50 rounded-full overflow-hidden">
                                    <div
                                        style={{ width: `${portfolioGuide?.current_vs_target?.target?.tech_growth || 38}%` }}
                                        className="h-full bg-indigo-500 transition-all duration-500"
                                    />
                                </div>
                            </div>

                            <div>
                                <div className="flex justify-between text-xs mb-1">
                                    <span className="text-purple-300 font-bold">인컴/배당 (SCHD 등 배당성장)</span>
                                    <span className="font-mono font-bold text-white">
                                        {portfolioGuide?.current_vs_target?.target?.dividend_income || 42}% (목표)
                                    </span>
                                </div>
                                <div className="w-full h-2.5 bg-black/50 rounded-full overflow-hidden">
                                    <div
                                        style={{ width: `${portfolioGuide?.current_vs_target?.target?.dividend_income || 42}%` }}
                                        className="h-full bg-purple-500 transition-all duration-500"
                                    />
                                </div>
                            </div>

                            <div>
                                <div className="flex justify-between text-xs mb-1">
                                    <span className="text-emerald-300 font-bold">안전자산 (미국 중장기 국채 TLT)</span>
                                    <span className="font-mono font-bold text-white">
                                        {portfolioGuide?.current_vs_target?.target?.safe_haven || 20}% (목표)
                                    </span>
                                </div>
                                <div className="w-full h-2.5 bg-black/50 rounded-full overflow-hidden">
                                    <div
                                        style={{ width: `${portfolioGuide?.current_vs_target?.target?.safe_haven || 20}%` }}
                                        className="h-full bg-emerald-500 transition-all duration-500"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Action Plans 3 Steps */}
                {portfolioGuide?.action_plans && (
                    <div className="flex flex-col gap-3">
                        <h4 className="text-sm font-bold text-gray-300 flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-indigo-400" />
                            주요그룹별 세부 리밸런싱 실행 로드맵
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {portfolioGuide.action_plans.map((ap: any) => (
                                <div key={ap.step} className="bg-[#181a26]/70 border border-white/10 rounded-2xl p-5 flex flex-col justify-between">
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-[10px] font-bold px-2.5 py-1 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                                STEP 0{ap.step}
                                            </span>
                                            <span className="text-xs text-gray-400 font-semibold">{ap.category}</span>
                                        </div>
                                        <h5 className="text-sm font-bold text-white mb-2">{ap.action}</h5>
                                        <div className="flex flex-col gap-2 mt-3">
                                            {ap.targets?.map((t: any, tIdx: number) => (
                                                <div key={tIdx} className="bg-black/40 rounded-xl p-3 border border-white/5">
                                                    <div className="flex justify-between items-center mb-1">
                                                        <span className="text-xs font-bold text-white">{t.symbol}</span>
                                                        <span className="text-[10px] font-bold text-indigo-300">{t.action_type}</span>
                                                    </div>
                                                    <p className="text-[11px] text-gray-400 leading-relaxed">{t.advice}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* AI 투자성향 & 자산배분 진단 인터뷰 팝업 모달 */}
            {isInterviewModalOpen && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="relative w-full max-w-xl bg-[#151726] border border-indigo-500/40 rounded-3xl p-6 md:p-8 shadow-2xl flex flex-col gap-5 text-gray-200">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between border-b border-white/10 pb-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg">
                                    <Sparkles className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-black text-white">
                                        고객 투자성향 & 자산배분 AI 인터뷰
                                    </h3>
                                    <p className="text-xs text-gray-400">
                                        현재 보유 비중과 투자 성향을 진단하여 최적의 중간선거 리밸런싱 모델을 설계합니다.
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsInterviewModalOpen(false)}
                                className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-all"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Question 1: Tech Weight */}
                        <div className="flex flex-col gap-2">
                            <label className="text-xs font-bold text-white flex items-center justify-between">
                                <span>Q1. 현재 포트폴리오에서 빅테크 및 성장 기술주 비중은 어느 정도인가요?</span>
                                <span className="text-indigo-400 font-mono text-sm">{interviewAnswers.techWeight}%</span>
                            </label>
                            <input
                                type="range"
                                min="10"
                                max="90"
                                step="5"
                                value={interviewAnswers.techWeight}
                                onChange={(e) => {
                                    const tw = parseInt(e.target.value);
                                    const remaining = Math.max(0, 100 - tw);
                                    const dw = Math.round(remaining * 0.6);
                                    const sw = Math.round(remaining - dw);
                                    setInterviewAnswers({
                                        ...interviewAnswers,
                                        techWeight: tw,
                                        dividendWeight: dw,
                                        safeWeight: sw
                                    });
                                }}
                                className="w-full h-2 bg-black/50 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                            />
                            <div className="flex justify-between text-[10px] text-gray-500">
                                <span>10% (보수적)</span>
                                <span>50% (집중 기준)</span>
                                <span>90% (초집중)</span>
                            </div>
                        </div>

                        {/* Question 2 & 3: Dividend & Safe Weights */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="flex flex-col gap-1.5 bg-black/30 p-3.5 rounded-xl border border-white/5">
                                <label className="text-[11px] font-bold text-gray-300">Q2. 인컴/배당 자산 비중</label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        min="0"
                                        max="90"
                                        value={interviewAnswers.dividendWeight}
                                        onChange={(e) => {
                                            const dw = Math.max(0, parseInt(e.target.value) || 0);
                                            const sw = Math.max(0, 100 - interviewAnswers.techWeight - dw);
                                            setInterviewAnswers({ ...interviewAnswers, dividendWeight: dw, safeWeight: sw });
                                        }}
                                        className="w-full bg-[#181a26] border border-white/15 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
                                    />
                                    <span className="text-xs text-gray-400">%</span>
                                </div>
                                <span className="text-[10px] text-gray-500">SCHD, 커버드콜, 리츠 등</span>
                            </div>

                            <div className="flex flex-col gap-1.5 bg-black/30 p-3.5 rounded-xl border border-white/5">
                                <label className="text-[11px] font-bold text-gray-300">Q3. 안전/국채 자산 비중</label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        min="0"
                                        max="90"
                                        value={interviewAnswers.safeWeight}
                                        onChange={(e) => {
                                            const sw = Math.max(0, parseInt(e.target.value) || 0);
                                            setInterviewAnswers({ ...interviewAnswers, safeWeight: sw });
                                        }}
                                        className="w-full bg-[#181a26] border border-white/15 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
                                    />
                                    <span className="text-xs text-gray-400">%</span>
                                </div>
                                <span className="text-[10px] text-gray-500">TLT, 미국채, 단기자금</span>
                            </div>
                        </div>

                        {/* Question 4: Risk Profile */}
                        <div className="flex flex-col gap-2">
                            <label className="text-xs font-bold text-white">
                                Q4. 시장 변동성 및 하방 리스크에 대한 본인의 투자 성향은?
                            </label>
                            <div className="grid grid-cols-3 gap-2">
                                {[
                                    { id: "conservative", title: "안정 추구형", sub: "원금 보존 및 고배당 우선" },
                                    { id: "neutral", title: "위험 중립형", sub: "시장 수익률 및 균형 배분" },
                                    { id: "aggressive", title: "적극 투자형", sub: "빅테크 알파 및 고성장 추구" }
                                ].map((item) => (
                                    <button
                                        key={item.id}
                                        onClick={() => setInterviewAnswers({ ...interviewAnswers, riskProfile: item.id as any })}
                                        className={`p-3 rounded-2xl border text-left transition-all flex flex-col gap-1 ${
                                            interviewAnswers.riskProfile === item.id
                                                ? "bg-indigo-600/30 border-indigo-400 text-white shadow-lg"
                                                : "bg-white/5 border-white/5 text-gray-400 hover:text-white"
                                        }`}
                                    >
                                        <span className="text-xs font-bold text-white">{item.title}</span>
                                        <span className="text-[10px] text-gray-400 leading-tight">{item.sub}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Modal Action Buttons */}
                        <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10 mt-2">
                            <button
                                onClick={() => setIsInterviewModalOpen(false)}
                                className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-gray-300 transition-all"
                            >
                                취소
                            </button>
                            <button
                                onClick={handleApplyInterview}
                                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 active:scale-95 text-xs font-bold text-white shadow-lg transition-all flex items-center gap-1.5"
                            >
                                <CheckCircle2 className="w-4 h-4" />
                                <span>진단 결과 내 포트폴리오에 적용하기</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
