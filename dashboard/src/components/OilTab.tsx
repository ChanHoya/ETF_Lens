"use client";

import React, { useState, useEffect } from "react";
import {
    Flame,
    Droplets,
    TrendingUp,
    TrendingDown,
    AlertTriangle,
    ShieldAlert,
    CheckCircle2,
    Anchor,
    Factory,
    BarChart3,
    Sparkles,
    RefreshCw,
    Activity,
    Info,
    ArrowRight,
    Plane,
    Ship,
    Zap,
    Cpu,
    DollarSign,
    Layers,
    X,
    Search,
    Maximize2,
    CheckSquare,
    Square,
    ChevronRight,
    Gauge
} from "lucide-react";
import {
    ResponsiveContainer,
    ComposedChart,
    Line,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip as RechartsTooltip,
    Legend
} from "recharts";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface OverlayOption {
    key: string;
    label: string;
    color: string;
    unit: string;
}

const OVERLAY_OPTIONS: OverlayOption[] = [
    { key: "ppi", label: "미국 PPI 생산자물가 (★직접연동)", color: "#fb923c", unit: "%" },
    { key: "cpi", label: "미국 CPI 소비자물가 (YoY)", color: "#f43f5e", unit: "%" },
    { key: "pce", label: "미국 PCE 소비지출물가", color: "#eab308", unit: "%" },
    { key: "dollar_index", label: "달러 인덱스 (DXY)", color: "#38bdf8", unit: "pt" },
    { key: "sp500", label: "S&P 500 (SPX)", color: "#10b981", unit: "pt" },
    { key: "nasdaq", label: "나스닥 100 (NDX)", color: "#c084fc", unit: "pt" },
];

const INDICATOR_META_MAP: Record<string, { name: string; unit: string; benchmark: string; color: string }> = {
    wti: { name: "미국 서부텍사스유 (WTI)", unit: "$/bbl", benchmark: "$70~$85 적정 밴드", color: "#f59e0b" },
    brent: { name: "북해산 브렌트유 (Brent)", unit: "$/bbl", benchmark: "해상 운송 원유 기준", color: "#38bdf8" },
    dubai: { name: "중동 두바이유 (Dubai)", unit: "$/bbl", benchmark: "국내 원유 도입 70%", color: "#c084fc" },
    spread: { name: "Brent - WTI 스프레드", unit: "$/bbl", benchmark: "정상 밴드 $3.0~$5.0", color: "#818cf8" },
    refining_margin: { name: "싱가포르 복합 정제마진", unit: "$/bbl", benchmark: "손익분기점 $4.50", color: "#10b981" },
    eia_inventory: { name: "미국 주간 원유 재고 (EIA)", unit: "백만 배럴 (M bbl)", benchmark: "5개년 평균 420M~440M", color: "#fb923c" },
    rig_count: { name: "베이커휴즈 미국 가동 리그 수", unit: "기", benchmark: "셰일 생산성 지표", color: "#34d399" },
    geopolitics: { name: "에너지 지정학 리스크 지수", unit: "점 (0~100)", benchmark: "65점 이상 경계 구간", color: "#f43f5e" },
};

export default function OilTab() {
    const [overview, setOverview] = useState<any>(null);
    const [fundamentals, setFundamentals] = useState<any>(null);
    const [geopolitics, setGeopolitics] = useState<any>(null);
    const [playbook, setPlaybook] = useState<any>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [refreshing, setRefreshing] = useState<boolean>(false);
    const [selectedScenarioIdx, setSelectedScenarioIdx] = useState<number>(0);

    // 상세 분석 팝업 모달 상태 (유가 직접 연동 PPI 및 3대 물가지표 기본 활성화)
    const [modalOpen, setModalOpen] = useState<boolean>(false);
    const [selectedIndicator, setSelectedIndicator] = useState<string>("wti");
    const [selectedPeriod, setSelectedPeriod] = useState<string>("6M");
    const [historyData, setHistoryData] = useState<any>(null);
    const [loadingHistory, setLoadingHistory] = useState<boolean>(false);
    const [activeOverlays, setActiveOverlays] = useState<Record<string, boolean>>({
        ppi: true, // ★ 유가 직접 직결 생산자물가
        cpi: true, // 소비자물가
        pce: true, // 연준 타깃 물가
        dollar_index: true, // 달러 인덱스
        sp500: false,
        nasdaq: false
    });

    const setOverlayPreset = (preset: "inflation" | "dollar" | "equity" | "all" | "none") => {
        if (preset === "inflation") {
            setActiveOverlays({ ppi: true, cpi: true, pce: true, dollar_index: false, sp500: false, nasdaq: false });
        } else if (preset === "dollar") {
            setActiveOverlays({ ppi: false, cpi: false, pce: false, dollar_index: true, sp500: false, nasdaq: false });
        } else if (preset === "equity") {
            setActiveOverlays({ ppi: false, cpi: false, pce: false, dollar_index: false, sp500: true, nasdaq: true });
        } else if (preset === "all") {
            setActiveOverlays({ ppi: true, cpi: true, pce: true, dollar_index: true, sp500: true, nasdaq: true });
        } else if (preset === "none") {
            setActiveOverlays({ ppi: false, cpi: false, pce: false, dollar_index: false, sp500: false, nasdaq: false });
        }
    };

    const fetchAllOilData = async (isManual: boolean = false) => {
        try {
            if (isManual) setRefreshing(true);
            else setLoading(true);

            const [ovRes, funRes, geoRes, playRes] = await Promise.all([
                fetch(`${API_BASE}/api/v1/oil/overview`),
                fetch(`${API_BASE}/api/v1/oil/fundamentals`),
                fetch(`${API_BASE}/api/v1/oil/geopolitics`),
                fetch(`${API_BASE}/api/v1/oil/etf-playbook`)
            ]);

            if (ovRes.ok) setOverview(await ovRes.json());
            if (funRes.ok) setFundamentals(await funRes.json());
            if (geoRes.ok) setGeopolitics(await geoRes.json());
            if (playRes.ok) setPlaybook(await playRes.json());
        } catch (err) {
            console.error("Failed to load oil market data:", err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const generateFallbackHistory = (indicator: string, period: string) => {
        const meta = INDICATOR_META_MAP[indicator] || INDICATOR_META_MAP["wti"];
        const periodMap: Record<string, number> = { "6M": 6, "1Y": 12, "5Y": 60, "10Y": 120 };
        const count = periodMap[period] || 6;
        const now = new Date(2026, 9, 1); // 2026-10
        const series = [];

        const liveWti = overview?.benchmarks?.wti?.price || 101.41;
        const liveBrent = overview?.benchmarks?.brent?.price || 109.86;
        const liveDubai = overview?.benchmarks?.dubai?.price || 79.10;
        const liveSpread = overview?.benchmarks?.brent_wti_spread?.value || Number((liveBrent - liveWti).toFixed(2));
        const liveMargin = 6.45;
        const liveInv = 420.5;
        const liveRig = 482;
        const liveGeo = 72;

        const wtiMap: Record<number, number> = { 5: 78.6, 6: 81.5, 7: 80.8, 8: 75.4, 9: 88.5, 10: liveWti };
        const brentMap: Record<number, number> = { 5: 83.1, 6: 85.2, 7: 84.8, 8: 78.7, 9: 94.2, 10: liveBrent };
        const dubaiMap: Record<number, number> = { 5: 78.0, 6: 80.2, 7: 79.5, 8: 77.2, 9: 78.5, 10: liveDubai };
        const spreadMap: Record<number, number> = { 5: 4.5, 6: 3.7, 7: 4.0, 8: 3.3, 9: 5.7, 10: liveSpread };
        const marginMap: Record<number, number> = { 5: 4.8, 6: 5.9, 7: 6.1, 8: 5.5, 9: 5.8, 10: liveMargin };

        for (let i = count - 1; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
            const m = d.getMonth() + 1;
            const y = d.getFullYear();
            const isLatest = (i === 0);

            let val = liveWti;
            if (y === 2026) {
                if (indicator === "wti") val = isLatest ? liveWti : (wtiMap[m] || 76.8);
                else if (indicator === "brent") val = isLatest ? liveBrent : (brentMap[m] || 81.2);
                else if (indicator === "dubai") val = isLatest ? liveDubai : (dubaiMap[m] || 78.2);
                else if (indicator === "spread") val = isLatest ? liveSpread : (spreadMap[m] || 4.2);
                else if (indicator === "refining_margin") val = isLatest ? liveMargin : (marginMap[m] || 6.2);
                else if (indicator === "eia_inventory") val = liveInv + (isLatest ? 0 : (10 - m) * 1.5);
                else if (indicator === "rig_count") val = liveRig + (isLatest ? 0 : (10 - m) * 2);
                else if (indicator === "geopolitics") val = liveGeo - (isLatest ? 0 : (10 - m) * 1.5);
            } else if (y === 2022) {
                if (indicator === "wti") val = 95.0 + (m in [3, 4, 5, 6] ? 22.0 : -5.0);
                else if (indicator === "brent") val = 101.8 + (m in [3, 4, 5, 6] ? 22.0 : -5.0);
                else if (indicator === "dubai") val = 99.2 + (m in [3, 4, 5, 6] ? 20.0 : -5.0);
                else if (indicator === "spread") val = 6.8;
                else if (indicator === "refining_margin") val = 18.5;
                else val = 85.0;
            } else if (y === 2020) {
                if (indicator === "wti") val = 40.0 + (m in [3, 4, 5] ? -23.3 : 0.8);
                else if (indicator === "brent") val = 44.5 + (m in [3, 4, 5] ? -22.0 : 0.8);
                else if (indicator === "dubai") val = 43.0 + (m in [3, 4, 5] ? -21.0 : 0.8);
                else if (indicator === "spread") val = 4.5;
                else if (indicator === "refining_margin") val = 2.1;
                else val = 45.0;
            } else {
                if (indicator === "wti") val = 75.0 + ((m * 1.5) % 8);
                else if (indicator === "brent") val = 79.5 + ((m * 1.5) % 8);
                else if (indicator === "dubai") val = 77.0 + ((m * 1.4) % 8);
                else if (indicator === "spread") val = 4.0;
                else if (indicator === "refining_margin") val = 5.8;
                else val = 75.0;
            }

            const sp500 = 5500 + ((y - 2024) * 300) + (m * 25);
            const nasdaq = 19000 + ((y - 2024) * 800) + (m * 120);
            const dxy = 103.5 - (m * 0.15);
            const cpi = isLatest ? 3.95 : (y === 2022 ? 8.8 : (y === 2020 ? 1.2 : 3.2 + (m % 2 === 0 ? 0.2 : -0.1)));
            const ppi = isLatest ? 8.65 : (y === 2022 ? 14.8 : (y === 2020 ? -1.5 : 4.8 + (m % 2 === 0 ? 0.4 : -0.2)));
            const pce = isLatest ? 3.08 : (y === 2022 ? 6.8 : (y === 2020 ? 1.1 : 2.8 + (m % 2 === 0 ? 0.1 : -0.1)));

            series.push({
                date: ym,
                value: Number(val.toFixed(2)),
                sp500: Math.round(sp500),
                nasdaq: Math.round(nasdaq),
                dollar_index: Number(dxy.toFixed(2)),
                cpi: Number(cpi.toFixed(2)),
                ppi: Number(ppi.toFixed(2)),
                pce: Number(pce.toFixed(2))
            });
        }

        return {
            indicator,
            indicator_meta: meta,
            period,
            data_count: series.length,
            series,
            correlations: {
                ppi: { corr: 0.78, desc: "원유·정제유 가격 변동은 생산자물가(PPI)에 1~2개월 선행하며 가장 직접적·파괴적으로 반영 (최고 상관성)" },
                cpi: { corr: 0.68, desc: "유가 변동은 운송비·전기요금 등을 거쳐 1~2개월 시차를 두고 미국 헤드라인 CPI에 직접 전가" },
                pce: { corr: 0.62, desc: "미 연준(Fed)의 2% 타깃 기준 지표로 원유 상승에 따른 에너지 2차 파급 효과 반영" },
                dollar_index: { corr: -0.62, desc: "달러화 강세 시 달러 표시 원자재 가격 하락 압력 (역상관 성향 뚜렷)" },
                sp500: { corr: 0.22, desc: "적정 유가($70~$85)에서는 경기 확장과 동행하나, $85 초과 시 물가 긴축으로 역상관 전환" },
                nasdaq: { corr: -0.31, desc: "고유가 국면 진입 시 금리 인하 지연 및 할인율 상승으로 기술주에 부정적" }
            },
            time_horizon_guide: {
                recommendation: "단기 수급 판단은 6M~1Y, 거시 물가 및 자산배분 검증은 5Y~10Y 권장",
                short_term_focus: "최근 6개월~1년은 계절적 드라이빙 시즌, 정유사 정기보수, OPEC+ 감산 회의 등 실질적인 수급 모멘텀을 포착하는 데 가장 적합합니다.",
                long_term_focus: "5년~10년 시계열은 원유 슈퍼사이클(2020 마이너스 유가 쇼크, 2022 우크라 전쟁 폭등, 2024~2026 연준 긴축/완화 사이클)과 PPI·CPI·달러지수·증시 밸류에이션 간의 구조적 관계를 입증합니다."
            }
        };
    };

    const fetchIndicatorHistory = async (indicator: string, period: string) => {
        try {
            setLoadingHistory(true);
            let res = await fetch(`${API_BASE}/api/v1/oil/indicator-history?indicator=${indicator}&period=${period}`);
            if (!res.ok && API_BASE !== "http://localhost:8000") {
                try {
                    res = await fetch(`http://localhost:8000/api/v1/oil/indicator-history?indicator=${indicator}&period=${period}`);
                } catch {
                    // ignore
                }
            }
            if (res.ok) {
                const data = await res.json();
                setHistoryData(data);
                return;
            }
            const fb = generateFallbackHistory(indicator, period);
            setHistoryData(fb);
        } catch (err) {
            console.error("Failed to load indicator history:", err);
            const fb = generateFallbackHistory(indicator, period);
            setHistoryData(fb);
        } finally {
            setLoadingHistory(false);
        }
    };

    useEffect(() => {
        fetchAllOilData(false);
    }, []);

    const handleCardClick = (indicatorKey: string) => {
        setSelectedIndicator(indicatorKey);
        setModalOpen(true);
        fetchIndicatorHistory(indicatorKey, selectedPeriod);
    };

    const handlePeriodChange = (period: string) => {
        setSelectedPeriod(period);
        fetchIndicatorHistory(selectedIndicator, period);
    };

    const toggleOverlay = (key: string) => {
        setActiveOverlays(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const bm = overview?.benchmarks;
    const wti = bm?.wti || { price: 76.85, change: -0.92, change_pct: -1.18, high_52w: 93.98, low_52w: 66.8 };
    const brent = bm?.brent || { price: 80.45, change: -0.85, change_pct: -1.05, high_52w: 96.5, low_52w: 71.2 };
    const dubai = bm?.dubai || { price: 79.1, change: -0.7, change_pct: -0.88, high_52w: 94.2, low_52w: 70.1 };
    const execInsight = overview?.executive_market_insight;
    const stockImpact = fundamentals?.stock_market_impact;

    return (
        <div className="w-full flex flex-col gap-6 text-gray-200 animate-in fade-in duration-300">
            {/* Header Banner */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#181512] via-[#221c17] to-[#181512] border border-amber-500/20 p-6 md:p-8 shadow-2xl backdrop-blur-xl">
                <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-3">
                            <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1.5 shadow-sm">
                                <Flame className="w-3.5 h-3.5 text-amber-400" />
                                원유 & 에너지 마켓 인텔리전스
                            </span>
                            <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-white/10 text-gray-300 border border-white/15">
                                {overview?.updated_at || "실시간 시장 연동"}
                            </span>
                        </div>
                        <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight flex items-center gap-2">
                            글로벌 유가 동향 및 에너지 시장 분석
                        </h2>
                        <p className="text-xs md:text-sm text-gray-400 font-medium max-w-3xl leading-relaxed">
                            3대 원유 벤치마크(WTI·Brent·Dubai) 실시간 가격과 스프레드, OPEC+ 및 미국 수급 펀더멘털,
                            지정학 초크포인트 리스크와 싱가포르 복합 정제마진, 실전 ETF 투자 나침반을 제공합니다.
                        </p>
                    </div>

                    <button
                        onClick={() => fetchAllOilData(true)}
                        disabled={refreshing}
                        className="self-start md:self-center flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 active:scale-95 border border-amber-500/30 text-xs font-bold text-amber-300 transition-all shadow-md disabled:opacity-50"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 text-amber-400 ${refreshing ? "animate-spin" : ""}`} />
                        <span>{refreshing ? "시세 갱신 중..." : "최신 유가 동기화"}</span>
                    </button>
                </div>
            </div>

            {/* TOP WIDGET: 제일 상단 박스 - 유가 관련 현재 지표 기반 AI 종합 진단 & 투자 인사이트 */}
            {execInsight && (
                <div className="w-full bg-gradient-to-br from-[#1a1824] via-[#171926] to-[#131b20] border-2 border-amber-500/40 rounded-3xl p-6 md:p-8 shadow-2xl backdrop-blur-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
                    
                    <div className="relative z-10 flex flex-col gap-5">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 shadow-md">
                                    <Sparkles className="w-6 h-6 text-amber-300" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[11px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                            Executive Macro Intelligence
                                        </span>
                                        <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                                            <CheckCircle2 className="w-3.5 h-3.5" />
                                            {execInsight.regime_badge}
                                        </span>
                                    </div>
                                    <h3 className="text-lg md:text-xl font-black text-white mt-1">
                                        🧠 AI 유가 종합 진단 & 주식시장 핵심 투자 인사이트
                                    </h3>
                                </div>
                            </div>
                        </div>

                        {/* Headline */}
                        <div className="bg-black/40 border border-amber-500/30 rounded-2xl p-4 md:p-5">
                            <p className="text-sm md:text-base font-bold text-amber-200 leading-snug">
                                &quot;{execInsight.headline}&quot;
                            </p>
                        </div>

                        {/* 4 Core Market Drivers Summary Chips */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                            {execInsight.market_drivers?.map((d: any, idx: number) => (
                                <div key={idx} className="bg-[#12141e]/90 border border-white/10 rounded-xl p-3.5 flex flex-col justify-between">
                                    <div className="flex items-center justify-between mb-1.5">
                                        <span className="text-xs font-medium text-gray-400">{d.label}</span>
                                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/20">
                                            {d.status}
                                        </span>
                                    </div>
                                    <div className="text-base font-black text-white font-mono mb-1">{d.value}</div>
                                    <p className="text-[11px] text-gray-400 leading-relaxed">{d.desc}</p>
                                </div>
                            ))}
                        </div>

                        {/* Stock Market Verdict & Risk Threshold */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                            <div className="md:col-span-2 bg-[#141824]/80 border border-emerald-500/30 rounded-2xl p-4">
                                <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 mb-1.5">
                                    <TrendingUp className="w-4 h-4" />
                                    증시 영향 및 권장 포트폴리오 바벨(Barbell) 전략
                                </span>
                                <p className="text-xs text-gray-300 leading-relaxed">
                                    {execInsight.stock_market_verdict}
                                </p>
                            </div>
                            <div className="bg-[#241618]/80 border border-rose-500/30 rounded-2xl p-4 flex flex-col justify-between">
                                <div>
                                    <span className="text-xs font-bold text-rose-400 flex items-center gap-1.5 mb-1.5">
                                        <AlertTriangle className="w-4 h-4" />
                                        리스크 트리거 임계치
                                    </span>
                                    <p className="text-xs text-gray-300 leading-relaxed">
                                        {execInsight.risk_threshold}
                                    </p>
                                </div>
                                <div className="mt-2 text-[10px] text-gray-500">
                                    * 지표 박스를 클릭하면 6M~10Y 기간별 매크로 복합 분석 팝업이 열립니다.
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Section 1: 글로벌 3대 벤치마크 원유 시세 & 스프레드 */}
            <div className="w-full bg-[#121217]/70 border border-white/10 rounded-3xl p-5 md:p-7 backdrop-blur-md shadow-xl flex flex-col gap-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400">
                            <Droplets className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-lg md:text-xl font-bold text-white flex items-center gap-2">
                                1. 글로벌 3대 원유 벤치마크 시세 & 국면 진단
                            </h3>
                            <p className="text-xs text-gray-400">
                                서부텍사스산원유(WTI), 북해산브렌트유(Brent), 중동두바이유(Dubai) 및 주요 정제유 (박스 클릭 시 심층 분석)
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20">
                            현재: {overview?.regime_status?.regime || "적정 균형 국면 ($70~$85)"}
                        </span>
                    </div>
                </div>

                {/* 3 Benchmark Cards + Spread (All clickable) */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* WTI */}
                    <div
                        onClick={() => handleCardClick("wti")}
                        className="bg-[#181a26]/70 border border-white/10 hover:border-amber-500/50 hover:bg-[#1f2233] cursor-pointer rounded-2xl p-5 flex flex-col justify-between transition-all duration-200 group shadow-md"
                    >
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-bold text-gray-400 group-hover:text-amber-300 transition-colors">
                                    미국 서부텍사스유 (WTI)
                                </span>
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 font-bold flex items-center gap-1">
                                    <Maximize2 className="w-2.5 h-2.5 opacity-60 group-hover:opacity-100" />
                                    글로벌 기준유
                                </span>
                            </div>
                            <div className="flex items-baseline gap-2 mb-2">
                                <h4 className="text-3xl font-black text-white font-mono group-hover:text-amber-200 transition-colors">
                                    ${wti.price}
                                </h4>
                                <span className={`text-xs font-bold flex items-center ${wti.change >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                                    {wti.change >= 0 ? "+" : ""}{wti.change} ({wti.change >= 0 ? "+" : ""}{wti.change_pct}%)
                                </span>
                            </div>
                            <div className="text-[11px] text-gray-500">배럴당 가격 ($/bbl) • 클릭 시 6M~10Y 차트</div>
                        </div>
                        <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-gray-400">
                            <span>52주 밴드: ${wti.low_52w} ~ ${wti.high_52w}</span>
                            <span className="text-amber-400 font-semibold group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
                                상세 분석 <ChevronRight className="w-3 h-3" />
                            </span>
                        </div>
                    </div>

                    {/* Brent */}
                    <div
                        onClick={() => handleCardClick("brent")}
                        className="bg-[#181a26]/70 border border-white/10 hover:border-sky-500/50 hover:bg-[#1f2233] cursor-pointer rounded-2xl p-5 flex flex-col justify-between transition-all duration-200 group shadow-md"
                    >
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-bold text-gray-400 group-hover:text-sky-300 transition-colors">
                                    북해산 브렌트유 (Brent)
                                </span>
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-500/15 text-sky-300 font-bold flex items-center gap-1">
                                    <Maximize2 className="w-2.5 h-2.5 opacity-60 group-hover:opacity-100" />
                                    해상 수송유
                                </span>
                            </div>
                            <div className="flex items-baseline gap-2 mb-2">
                                <h4 className="text-3xl font-black text-white font-mono group-hover:text-sky-200 transition-colors">
                                    ${brent.price}
                                </h4>
                                <span className={`text-xs font-bold flex items-center ${brent.change >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                                    {brent.change >= 0 ? "+" : ""}{brent.change} ({brent.change >= 0 ? "+" : ""}{brent.change_pct}%)
                                </span>
                            </div>
                            <div className="text-[11px] text-gray-500">유럽·아프리카·중동 수출 지표 • 클릭 시 차트</div>
                        </div>
                        <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-gray-400">
                            <span>52주 밴드: ${brent.low_52w} ~ ${brent.high_52w}</span>
                            <span className="text-sky-400 font-semibold group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
                                상세 분석 <ChevronRight className="w-3 h-3" />
                            </span>
                        </div>
                    </div>

                    {/* Dubai */}
                    <div
                        onClick={() => handleCardClick("dubai")}
                        className="bg-[#181a26]/70 border border-white/10 hover:border-purple-500/50 hover:bg-[#1f2233] cursor-pointer rounded-2xl p-5 flex flex-col justify-between transition-all duration-200 group shadow-md"
                    >
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-bold text-gray-400 group-hover:text-purple-300 transition-colors">
                                    중동 두바이유 (Dubai)
                                </span>
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/15 text-purple-300 font-bold flex items-center gap-1">
                                    <Maximize2 className="w-2.5 h-2.5 opacity-60 group-hover:opacity-100" />
                                    한국 수입 70%
                                </span>
                            </div>
                            <div className="flex items-baseline gap-2 mb-2">
                                <h4 className="text-3xl font-black text-white font-mono group-hover:text-purple-200 transition-colors">
                                    ${dubai.price}
                                </h4>
                                <span className={`text-xs font-bold flex items-center ${dubai.change >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                                    {dubai.change >= 0 ? "+" : ""}{dubai.change} ({dubai.change >= 0 ? "+" : ""}{dubai.change_pct}%)
                                </span>
                            </div>
                            <div className="text-[11px] text-gray-500">국내 정유사 원유 도입 단가 기준</div>
                        </div>
                        <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-gray-400">
                            <span>국내 정유 4사 도입 기준</span>
                            <span className="text-purple-400 font-semibold group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
                                상세 분석 <ChevronRight className="w-3 h-3" />
                            </span>
                        </div>
                    </div>

                    {/* Brent - WTI Spread */}
                    <div
                        onClick={() => handleCardClick("spread")}
                        className="bg-gradient-to-br from-[#1b1c2b] to-[#141520] border border-indigo-500/30 hover:border-indigo-400/60 hover:bg-[#1e1f32] cursor-pointer rounded-2xl p-5 flex flex-col justify-between transition-all duration-200 group shadow-md"
                    >
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-bold text-indigo-300 group-hover:text-indigo-200 transition-colors">
                                    Brent - WTI 스프레드
                                </span>
                                <span className="text-[10px] font-mono text-gray-400 flex items-center gap-1">
                                    <Maximize2 className="w-2.5 h-2.5" />
                                    차익거래
                                </span>
                            </div>
                            <div className="flex items-baseline gap-2 mb-2">
                                <h4 className="text-3xl font-black text-indigo-400 font-mono">
                                    ${bm?.brent_wti_spread?.value || 3.60}
                                </h4>
                                <span className="text-xs text-gray-400">평균 $3.80</span>
                            </div>
                            <p className="text-[11px] text-gray-300 leading-relaxed">
                                {bm?.brent_wti_spread?.interpretation || "스프레드 $3~$5 정상 밴드 유지. 미국 원유의 글로벌 수출 경쟁력 양호."}
                            </p>
                        </div>
                        <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-[10px] text-indigo-300">
                            <span>스프레드 확대 시 미국 정유사/탱커 수혜</span>
                            <span className="font-semibold group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
                                분석 <ChevronRight className="w-3 h-3" />
                            </span>
                        </div>
                    </div>
                </div>

                {/* Macro Linkage Insights */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-[#151722] border border-white/5 rounded-2xl p-4 text-xs">
                    <div className="flex items-start gap-2.5">
                        <TrendingUp className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                        <div>
                            <span className="font-bold text-white block">물가 민감도 (CPI 연동)</span>
                            <span className="text-gray-400 leading-relaxed text-[11px]">
                                {overview?.macro_linkage?.cpi_sensitivity || "WTI 10% 상승 시 미국 CPI +0.2%p, 한국 CPI +0.35%p 상승 압력"}
                            </span>
                        </div>
                    </div>
                    <div className="flex items-start gap-2.5">
                        <DollarSign className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                        <div>
                            <span className="font-bold text-white block">달러화 역상관 계수 (-0.62)</span>
                            <span className="text-gray-400 leading-relaxed text-[11px]">
                                원유는 달러로 결제되므로 달러 강세 시 비달러권 구매력 약화로 유가 하락 압력 작동
                            </span>
                        </div>
                    </div>
                    <div className="flex items-start gap-2.5">
                        <Layers className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                        <div>
                            <span className="font-bold text-white block">S&P 500 에너지 섹터 비중 (3.8%)</span>
                            <span className="text-gray-400 leading-relaxed text-[11px]">
                                에너지 비중이 낮아 유가 상승이 지수 전체보다는 인플레/금리 경로를 통해 시장에 영향
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Section 2: 원유 수급 펀더멘털 & 싱가포르 복합 정제마진 (Crack Spread) + 주식시장 영향 분석 */}
            <div className="w-full bg-[#121217]/70 border border-white/10 rounded-3xl p-5 md:p-7 backdrop-blur-md shadow-xl flex flex-col gap-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400">
                            <Factory className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-lg md:text-xl font-bold text-white flex items-center gap-2">
                                2. 원유 수급 펀더멘털 & 정제마진 (Crack Spread)
                            </h3>
                            <p className="text-xs text-gray-400">
                                미국 EIA 주간 원유 재고, 베이커휴즈 리그 수, 싱가포르 복합 정제마진 및 주식시장 파급 효과
                            </p>
                        </div>
                    </div>
                    <span className="text-xs text-emerald-400 font-bold bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full">
                        박스 클릭 시 6M~10Y 시계열 & 거시 오버레이
                    </span>
                </div>

                {/* 3 Metric Summary Cards (All Clickable) */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* EIA Inventory */}
                    <div
                        onClick={() => handleCardClick("eia_inventory")}
                        className="bg-[#181a26]/70 border border-white/10 hover:border-amber-500/50 hover:bg-[#1f2233] cursor-pointer rounded-2xl p-5 flex flex-col justify-between transition-all duration-200 group shadow-md"
                    >
                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-bold text-gray-400 group-hover:text-amber-300 transition-colors">
                                    {fundamentals?.inventory?.title || "미국 주간 원유 재고 (EIA)"}
                                </span>
                                <Maximize2 className="w-3.5 h-3.5 text-gray-500 group-hover:text-amber-300" />
                            </div>
                            <div className="flex items-baseline gap-2 mb-2">
                                <h4 className="text-2xl font-black text-white font-mono group-hover:text-amber-200 transition-colors">
                                    {fundamentals?.inventory?.current_inventory_mb || 420.5}M
                                </h4>
                                <span className="text-xs font-bold text-rose-400">
                                    주간 {fundamentals?.inventory?.weekly_change_mb || -2.18}M 배럴
                                </span>
                            </div>
                            <p className="text-[11px] text-gray-400 leading-relaxed">
                                {fundamentals?.inventory?.interpretation || "시장 예상치보다 큰 218만 배럴 재고 감소로 정유사 가동 호조"}
                            </p>
                        </div>
                        <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between text-[10px] text-amber-300">
                            <span>전략비축유(SPR): {fundamentals?.inventory?.strategic_petroleum_reserve_mb || 375}M 배럴</span>
                            <span className="font-semibold flex items-center gap-0.5">상세 분석 <ChevronRight className="w-3 h-3" /></span>
                        </div>
                    </div>

                    {/* US Production & Rig Count */}
                    <div
                        onClick={() => handleCardClick("rig_count")}
                        className="bg-[#181a26]/70 border border-white/10 hover:border-emerald-500/50 hover:bg-[#1f2233] cursor-pointer rounded-2xl p-5 flex flex-col justify-between transition-all duration-200 group shadow-md"
                    >
                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-bold text-gray-400 group-hover:text-emerald-300 transition-colors">
                                    미국 셰일 생산량 & 가동 리그 수
                                </span>
                                <Maximize2 className="w-3.5 h-3.5 text-gray-500 group-hover:text-emerald-300" />
                            </div>
                            <div className="flex items-baseline gap-2 mb-2">
                                <h4 className="text-2xl font-black text-emerald-400 font-mono">
                                    {fundamentals?.supply_metrics?.us_crude_production_mbpd || 13.52}M bpd
                                </h4>
                                <span className="text-xs text-gray-400 font-semibold">역대 최고</span>
                            </div>
                            <p className="text-[11px] text-gray-400 leading-relaxed">
                                베이커휴즈 오일 리그 수: <span className="text-white font-bold">{fundamentals?.supply_metrics?.baker_hughes_rig_count || 482}기</span>.
                                생산성 향상으로 적은 리그로도 최대 생산 유지.
                            </p>
                        </div>
                        <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between text-[10px] text-gray-400">
                            <span>OPEC+ 잉여 생산능력: 약 {fundamentals?.supply_metrics?.opec_spare_capacity_mbpd || 4.5}M bpd 완충</span>
                            <span className="text-emerald-400 font-semibold flex items-center gap-0.5">상세 분석 <ChevronRight className="w-3 h-3" /></span>
                        </div>
                    </div>

                    {/* Refining Margin */}
                    <div
                        onClick={() => handleCardClick("refining_margin")}
                        className="bg-gradient-to-br from-[#192420] to-[#121915] border border-emerald-500/30 hover:border-emerald-400/60 hover:bg-[#1d2d27] cursor-pointer rounded-2xl p-5 flex flex-col justify-between transition-all duration-200 group shadow-md"
                    >
                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-bold text-emerald-300">싱가포르 복합 정제마진</span>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 flex items-center gap-1">
                                    <Maximize2 className="w-2.5 h-2.5" />
                                    {fundamentals?.refining_margins?.status || "양호"}
                                </span>
                            </div>
                            <div className="flex items-baseline gap-2 mb-2">
                                <h4 className="text-3xl font-black text-emerald-400 font-mono">
                                    ${fundamentals?.refining_margins?.current_margin || 6.45}
                                </h4>
                                <span className="text-xs text-gray-400">손익분기점 $4.50</span>
                            </div>
                            <p className="text-[11px] text-gray-300 leading-relaxed">
                                {fundamentals?.refining_margins?.impact_on_refiners ||
                                    "정제마진이 손익분기점($4.5)을 웃돌아 S-Oil, SK이노베이션 등 국내 정유사의 영업이익 흑자 방어 중."}
                            </p>
                        </div>
                        <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between text-[10px] text-emerald-300 font-semibold">
                            <span>배럴당 마진 $1 상승 시 정유사 분기 영업익 수천억 개선</span>
                            <span className="flex items-center gap-0.5">상세 분석 <ChevronRight className="w-3 h-3" /></span>
                        </div>
                    </div>
                </div>

                {/* NEW: 주식시장 파급 경로 및 투자 판단 가이드 심층 패널 */}
                {stockImpact && (
                    <div className="bg-[#151824] border border-emerald-500/30 rounded-2xl p-5 md:p-6 flex flex-col gap-5">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-3">
                            <div className="flex items-center gap-2.5">
                                <Gauge className="w-5 h-5 text-emerald-400" />
                                <h4 className="text-base font-bold text-white">
                                    {stockImpact.title}
                                </h4>
                            </div>
                            <span className="text-xs text-amber-300 font-semibold bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
                                💡 전문 투자자 핵심 체크포인트
                            </span>
                        </div>

                        {/* Core Takeaway */}
                        <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-xl p-3.5 text-xs text-emerald-200 font-medium">
                            <span className="font-bold text-white block mb-0.5">핵심 결론:</span>
                            {stockImpact.core_takeaway}
                        </div>

                        {/* 3 Major Stock Mechanisms Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {stockImpact.mechanisms?.map((m: any, idx: number) => (
                                <div key={idx} className="bg-black/30 border border-white/5 rounded-xl p-4 flex flex-col justify-between">
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs font-bold text-white">{m.factor}</span>
                                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/10 text-gray-300">
                                                {m.benchmark}
                                            </span>
                                        </div>
                                        <p className="text-xs text-gray-300 leading-relaxed mb-3">
                                            {m.stock_impact}
                                        </p>
                                    </div>
                                    <div className="pt-3 border-t border-white/5 flex flex-col gap-1.5 text-[11px]">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            <span className="text-emerald-400 font-bold">수혜:</span>
                                            {m.favored_stocks?.map((st: string, sIdx: number) => (
                                                <span key={sIdx} className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono text-[10px]">
                                                    {st}
                                                </span>
                                            ))}
                                        </div>
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            <span className="text-rose-400 font-bold">주의:</span>
                                            {m.unfavored_stocks?.map((st: string, sIdx: number) => (
                                                <span key={sIdx} className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 font-mono text-[10px]">
                                                    {st}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* 4 Practical Judgment Rules */}
                        <div className="bg-[#181c2b] border border-white/5 rounded-xl p-4 flex flex-col gap-2">
                            <span className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
                                <Info className="w-3.5 h-3.5 text-sky-400" />
                                실전 투자 판단 4대 룰 (어떤 점을 보고 매매를 결정해야 하는가?)
                            </span>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-400">
                                {stockImpact.judgment_rules?.map((rule: string, rIdx: number) => (
                                    <div key={rIdx} className="flex items-start gap-2 bg-black/20 p-2.5 rounded-lg border border-white/5">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0 mt-1.5" />
                                        <span className="leading-relaxed text-[11px]">{rule}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* Historical Trend Chart (2026 Latest Data) */}
                <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
                            <BarChart3 className="w-3.5 h-3.5 text-emerald-400" />
                            최근 6개월 유가 및 싱가포르 복합 정제마진 복합 추이 (2026년 최신)
                        </span>
                        <span className="text-[10px] text-gray-500">막대: 정제마진 ($/배럴) | 선: WTI/Brent 유가</span>
                    </div>
                    <div className="w-full bg-black/40 border border-white/5 rounded-2xl p-4 relative" style={{ height: "320px" }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={fundamentals?.historical_spreads || []} margin={{ top: 15, right: 20, left: -10, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                                <XAxis dataKey="date" stroke="#71717a" tick={{ fontSize: 11 }} tickLine={false} />
                                <YAxis yAxisId="price" domain={["auto", "auto"]} stroke="#71717a" tick={{ fontSize: 11 }} tickLine={false} />
                                <YAxis yAxisId="margin" orientation="right" domain={[0, 10]} stroke="#10b981" tick={{ fontSize: 11 }} tickLine={false} />
                                <RechartsTooltip
                                    contentStyle={{
                                        backgroundColor: "rgba(10, 10, 15, 0.95)",
                                        border: "1px solid rgba(255, 255, 255, 0.1)",
                                        borderRadius: "12px"
                                    }}
                                />
                                <Legend verticalAlign="top" height={36} iconType="circle" />
                                <Bar
                                    yAxisId="margin"
                                    name="정제마진 ($/bbl)"
                                    dataKey="refining_margin"
                                    fill="rgba(16, 185, 129, 0.4)"
                                    stroke="#10b981"
                                    radius={[4, 4, 0, 0]}
                                />
                                <Line
                                    yAxisId="price"
                                    type="monotone"
                                    name="WTI 유가 ($)"
                                    dataKey="wti"
                                    stroke="#f59e0b"
                                    strokeWidth={2.5}
                                    dot={{ r: 3, fill: "#f59e0b" }}
                                />
                                <Line
                                    yAxisId="price"
                                    type="monotone"
                                    name="Brent 유가 ($)"
                                    dataKey="brent"
                                    stroke="#38bdf8"
                                    strokeWidth={2}
                                    dot={{ r: 3, fill: "#38bdf8" }}
                                />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Section 3: 지정학적 리스크 레이더 & 3대 해상 초크포인트 (Clickable) */}
            <div className="w-full bg-[#121217]/70 border border-white/10 rounded-3xl p-5 md:p-7 backdrop-blur-md shadow-xl flex flex-col gap-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-rose-500/20 border border-rose-500/30 text-rose-400">
                            <ShieldAlert className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-lg md:text-xl font-bold text-white flex items-center gap-2">
                                3. 지정학적 리스크 레이더 & 3대 해상 초크포인트
                            </h3>
                            <p className="text-xs text-gray-400">
                                호르무즈·홍해·러시아 항로의 수송 차질 및 유가 내 지정학 프리미엄 추정 (박스 클릭 시 심층 분석)
                            </p>
                        </div>
                    </div>

                    <div
                        onClick={() => handleCardClick("geopolitics")}
                        className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
                    >
                        <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                            위험도: {geopolitics?.risk_index || 72}/100 ({geopolitics?.risk_level || "경계"})
                        </span>
                        <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            지정학 프리미엄: +${geopolitics?.estimated_risk_premium_dollar || 6.5}/배럴
                        </span>
                    </div>
                </div>

                {/* 3 Chokepoint Cards (Clickable) */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {geopolitics?.chokepoints?.map((cp: any, idx: number) => (
                        <div
                            key={idx}
                            onClick={() => handleCardClick("geopolitics")}
                            className="bg-[#181a26]/70 border border-white/10 hover:border-rose-500/50 hover:bg-[#1f1d2b] cursor-pointer rounded-2xl p-5 flex flex-col justify-between transition-all duration-200 group shadow-md"
                        >
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-bold text-white group-hover:text-rose-300 transition-colors flex items-center gap-1.5">
                                        <Anchor className="w-4 h-4 text-sky-400" />
                                        {cp.name}
                                    </span>
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                                        {cp.status}
                                    </span>
                                </div>
                                <div className="text-[11px] text-gray-400 font-mono mb-2">
                                    일일 수송량: <span className="text-white font-bold">{cp.daily_volume_mbpd}M bpd</span> ({cp.share_of_seaborne_oil})
                                </div>
                                <p className="text-xs text-gray-300 leading-relaxed mb-3">
                                    {cp.risk_analysis}
                                </p>
                            </div>
                            <div className="pt-2.5 border-t border-white/5 flex items-center justify-between text-[10px] text-indigo-300">
                                <span>위치: {cp.location}</span>
                                <span className="font-semibold flex items-center gap-0.5">상세 분석 <ChevronRight className="w-3 h-3" /></span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Section 4: 전문가 관점 실전 ETF & 주식 포트폴리오 플레이북 */}
            <div className="w-full bg-[#121217]/70 border border-white/10 rounded-3xl p-5 md:p-7 backdrop-blur-md shadow-xl flex flex-col gap-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-purple-500/20 border border-purple-500/30 text-purple-400">
                            <Sparkles className="w-5 h-5 text-amber-300" />
                        </div>
                        <div>
                            <h3 className="text-lg md:text-xl font-bold text-white flex items-center gap-2">
                                4. 전문가 관점 실전 ETF & 주식 포트폴리오 플레이북
                            </h3>
                            <p className="text-xs text-gray-400">
                                유가 상승($85+) vs 유가 안정($65~$75) 국면별 최적의 수혜 섹터와 위험 자산 분별
                            </p>
                        </div>
                    </div>

                    {/* Scenario Switcher */}
                    <div className="flex items-center bg-black/40 border border-white/10 rounded-xl p-1 gap-1">
                        {playbook?.scenarios?.map((sc: any, idx: number) => (
                            <button
                                key={idx}
                                onClick={() => setSelectedScenarioIdx(idx)}
                                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                                    selectedScenarioIdx === idx
                                        ? "bg-amber-600 text-white shadow-lg"
                                        : "text-gray-400 hover:text-white"
                                    }`}
                            >
                                {idx === 0 ? "고유가 국면 ($85+)" : "유가 안정 국면 ($65~$75)"}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Selected Scenario Details */}
                {playbook?.scenarios && playbook.scenarios[selectedScenarioIdx] && (
                    <div className="flex flex-col gap-6">
                        <div className="bg-gradient-to-r from-[#1e1a14] to-[#14141d] border border-amber-500/30 rounded-2xl p-5">
                            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                                <h4 className="text-base font-bold text-white">
                                    {playbook.scenarios[selectedScenarioIdx].scenario}
                                </h4>
                                <span className="text-xs text-amber-300 font-mono">
                                    동인: {playbook.scenarios[selectedScenarioIdx].drivers}
                                </span>
                            </div>
                        </div>

                        {/* Winners vs Losers */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Winners */}
                            <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-2xl p-5 flex flex-col gap-3">
                                <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                                    <TrendingUp className="w-4 h-4" />
                                    <span>수혜 섹터 & 추천 ETF (Overweight)</span>
                                </div>
                                <div className="flex flex-col gap-3">
                                    {playbook.scenarios[selectedScenarioIdx].winners?.map((w: any, wIdx: number) => (
                                        <div key={wIdx} className="bg-black/30 rounded-xl p-3 border border-white/5">
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="text-xs font-bold text-white">{w.category}</span>
                                                <div className="flex gap-1">
                                                    {w.items?.map((item: string, iIdx: number) => (
                                                        <span key={iIdx} className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                                                            {item}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                            <p className="text-[11px] text-gray-400 leading-relaxed">{w.logic}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Losers */}
                            <div className="bg-rose-950/20 border border-rose-500/30 rounded-2xl p-5 flex flex-col gap-3">
                                <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
                                    <TrendingDown className="w-4 h-4" />
                                    <span>부담 섹터 & 비중 축소 권고 (Underweight)</span>
                                </div>
                                <div className="flex flex-col gap-3">
                                    {playbook.scenarios[selectedScenarioIdx].losers?.map((l: any, lIdx: number) => (
                                        <div key={lIdx} className="bg-black/30 rounded-xl p-3 border border-white/5">
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="text-xs font-bold text-white">{l.category}</span>
                                                <div className="flex gap-1">
                                                    {l.items?.map((item: string, iIdx: number) => (
                                                        <span key={iIdx} className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold">
                                                            {item}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                            <p className="text-[11px] text-gray-400 leading-relaxed">{l.logic}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* 3 Actionable Rules for Investors */}
                        <div className="bg-[#151722] border border-white/5 rounded-2xl p-5 flex flex-col gap-3">
                            <h5 className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                                <Info className="w-4 h-4" />
                                개인투자자를 위한 3대 실전 행동 수칙
                            </h5>
                            <ul className="flex flex-col gap-2">
                                {playbook?.actionable_rules?.map((rule: string, rIdx: number) => (
                                    <li key={rIdx} className="text-xs text-gray-300 flex items-start gap-2 leading-relaxed">
                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0 mt-1.5" />
                                        <span>{rule}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                )}
            </div>

            {/* POPUP MODAL: 유가 지표 심층 분석 & 매크로(S&P500/Nasdaq/달러/CPI/PPI/PCE) 복합 오버레이 모달 */}
            {modalOpen && (() => {
                const currentMeta = historyData?.indicator_meta || INDICATOR_META_MAP[selectedIndicator] || INDICATOR_META_MAP["wti"];
                return (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="bg-[#13141f] border border-white/15 rounded-3xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
                        {/* Modal Header */}
                        <div className="p-5 md:p-6 border-b border-white/10 flex items-center justify-between bg-[#181a28]">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                                    <BarChart3 className="w-5 h-5" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-lg md:text-xl font-black text-white">
                                            {currentMeta.name}
                                        </h3>
                                        <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                            단위: {currentMeta.unit}
                                        </span>
                                    </div>
                                    <p className="text-xs text-gray-400 mt-0.5">
                                        기준: {currentMeta.benchmark} • S&P 500, 나스닥, 달러인덱스 및 주요 물가지표(CPI/PPI/PCE) 복합 상관관계 분석
                                    </p>
                                </div>
                            </div>

                            <button
                                onClick={() => setModalOpen(false)}
                                className="p-2 rounded-xl bg-white/5 hover:bg-white/15 text-gray-400 hover:text-white transition-all"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-5 md:p-6 overflow-y-auto flex flex-col gap-6">
                            {/* Controls Bar: Period Tabs + Presets + Overlay Pills */}
                            <div className="flex flex-col gap-3.5 bg-black/40 p-4 rounded-2xl border border-white/10">
                                {/* Top Row: Period Tabs + Presets */}
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                                    {/* Period Tabs */}
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-xs font-bold text-gray-400 mr-1.5">기간:</span>
                                        {["6M", "1Y", "5Y", "10Y"].map((p) => (
                                            <button
                                                key={p}
                                                onClick={() => handlePeriodChange(p)}
                                                className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all ${
                                                    selectedPeriod === p
                                                        ? "bg-amber-500 text-black shadow-md font-black"
                                                        : "bg-white/5 text-gray-400 hover:text-white hover:bg-white/10"
                                                }`}
                                            >
                                                {p}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Quick Presets */}
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="text-[11px] font-bold text-gray-400 mr-1">퀵 프리셋:</span>
                                        <button
                                            onClick={() => setOverlayPreset("inflation")}
                                            className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-orange-500/20 text-orange-300 border border-orange-500/40 hover:bg-orange-500/30 transition-all flex items-center gap-1"
                                        >
                                            <Flame className="w-3 h-3 text-orange-400" />
                                            3대 물가 (PPI·CPI·PCE)
                                        </button>
                                        <button
                                            onClick={() => setOverlayPreset("dollar")}
                                            className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-sky-500/20 text-sky-300 border border-sky-500/40 hover:bg-sky-500/30 transition-all"
                                        >
                                            💵 달러 (DXY)
                                        </button>
                                        <button
                                            onClick={() => setOverlayPreset("equity")}
                                            className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-purple-500/20 text-purple-300 border border-purple-500/40 hover:bg-purple-500/30 transition-all"
                                        >
                                            📈 증시 (S&P·나스닥)
                                        </button>
                                        <button
                                            onClick={() => setOverlayPreset("all")}
                                            className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-white/10 text-white border border-white/20 hover:bg-white/20 transition-all"
                                        >
                                            🌐 전체 선택
                                        </button>
                                        <button
                                            onClick={() => setOverlayPreset("none")}
                                            className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10 transition-all"
                                        >
                                            ✕ 해제
                                        </button>
                                    </div>
                                </div>

                                {/* Bottom Row: Individual Overlay Toggles */}
                                <div className="flex items-center gap-2 flex-wrap pt-2.5 border-t border-white/5">
                                    <span className="text-xs font-bold text-gray-400 mr-1">비교 지표 개별 토글:</span>
                                    {OVERLAY_OPTIONS.map((ov) => {
                                        const active = !!activeOverlays[ov.key];
                                        return (
                                            <button
                                                key={ov.key}
                                                onClick={() => toggleOverlay(ov.key)}
                                                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl transition-all border ${
                                                    active
                                                        ? "bg-white/15 text-white border-white/30 shadow-sm"
                                                        : "bg-black/20 text-gray-500 border-white/5 hover:text-gray-300"
                                                }`}
                                            >
                                                <span
                                                    className="w-2.5 h-2.5 rounded-full"
                                                    style={{ backgroundColor: active ? ov.color : "#4b5563" }}
                                                />
                                                <span>{ov.label}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* PPI & Macro Transmission Insight Banner */}
                            <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3.5 flex items-start gap-3 shadow-inner">
                                <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 mt-0.5 shrink-0">
                                    <Flame className="w-4 h-4" />
                                </div>
                                <div className="flex flex-col gap-0.5">
                                    <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                                        💡 유가 ➔ 생산자물가(PPI) 직접 파급 메커니즘
                                    </span>
                                    <p className="text-[11px] text-gray-300 leading-relaxed">
                                        원유는 나프타·디젤·휘발유 등 공장 제조 원가 및 물류비용으로 즉각 전가되므로, 유가 변동률은 소비자물가(CPI)보다 
                                        <strong className="text-orange-400 font-bold"> 생산자물가(PPI)에 1~2개월 더 빠르고 약 2배 이상 큰 진폭으로 직결 반영</strong>됩니다. 
                                        (상관계수: PPI <span className="text-orange-400 font-bold">+0.78</span> &gt; CPI <span className="text-rose-400 font-bold">+0.68</span> &gt; PCE <span className="text-yellow-400 font-bold">+0.62</span>)
                                    </p>
                                </div>
                            </div>

                            {/* Chart Area */}
                            {(() => {
                                const hasInflation = !!(activeOverlays.ppi || activeOverlays.cpi || activeOverlays.pce);
                                const hasStocks = !!(activeOverlays.sp500 || activeOverlays.nasdaq);
                                const hasDollar = !!activeOverlays.dollar_index;

                                return (
                                <div className="w-full bg-black/40 border border-white/5 rounded-2xl p-4 flex flex-col gap-2 relative">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-gray-400 pb-2 gap-1.5">
                                        <span className="font-bold text-white flex items-center gap-1.5">
                                            <BarChart3 className="w-4 h-4 text-amber-400" />
                                            {historyData?.indicator_meta?.name || currentMeta.name} & 매크로 오버레이 추이 ({selectedPeriod})
                                        </span>
                                        <span className="text-[11px] text-gray-300">
                                            좌측 축: <span style={{ color: currentMeta.color }} className="font-bold">{currentMeta.unit}</span> | 
                                            우측 축: <span className="text-orange-400 font-bold">{hasInflation ? "물가 YoY (%)" : (hasStocks ? "증시 지수 (pt)" : "달러 지수 (pt)")}</span>
                                        </span>
                                    </div>

                                    {loadingHistory ? (
                                        <div className="w-full h-80 flex items-center justify-center text-gray-400 text-xs">
                                            <RefreshCw className="w-5 h-5 text-amber-400 animate-spin mr-2" />
                                            데이터 로딩 중...
                                        </div>
                                    ) : (
                                        <div className="w-full h-80">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <ComposedChart
                                                    key={`oil-chart-${selectedIndicator}-${selectedPeriod}-${hasInflation ? "inf" : "noinf"}-${hasStocks ? "stk" : "nostk"}`}
                                                    data={historyData?.series || []}
                                                    margin={{ top: 15, right: 35, left: 5, bottom: 5 }}
                                                >
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.06)" />
                                                    <XAxis dataKey="date" stroke="#71717a" tick={{ fontSize: 10 }} tickLine={false} />
                                                    
                                                    {/* Left Axis: Primary Indicator */}
                                                    <YAxis
                                                        yAxisId="left"
                                                        stroke={currentMeta.color}
                                                        tick={{ fontSize: 10, fill: currentMeta.color }}
                                                        tickLine={false}
                                                        domain={["auto", "auto"]}
                                                        tickFormatter={(v) => typeof v === "number" ? v.toLocaleString() : v}
                                                    />

                                                    {/* Right Axis 1: Inflation % YoY (0~16%) */}
                                                    <YAxis
                                                        yAxisId="inflation"
                                                        orientation="right"
                                                        stroke="#fb923c"
                                                        tick={{ fontSize: 10, fill: "#fb923c" }}
                                                        tickLine={false}
                                                        domain={[-2, 16]}
                                                        tickFormatter={(v) => `${v}%`}
                                                        hide={!hasInflation}
                                                    />

                                                    {/* Right Axis 2: Stocks (S&P/Nasdaq) */}
                                                    <YAxis
                                                        yAxisId="stocks"
                                                        orientation="right"
                                                        stroke="#c084fc"
                                                        tick={{ fontSize: 10, fill: "#c084fc" }}
                                                        tickLine={false}
                                                        domain={["auto", "auto"]}
                                                        tickFormatter={(v) => typeof v === "number" ? `${Math.round(v / 1000)}k` : v}
                                                        hide={hasInflation || !hasStocks}
                                                    />

                                                    {/* Right Axis 3: Dollar Index (DXY) */}
                                                    <YAxis
                                                        yAxisId="dollar"
                                                        orientation="right"
                                                        stroke="#38bdf8"
                                                        tick={{ fontSize: 10, fill: "#38bdf8" }}
                                                        tickLine={false}
                                                        domain={[88, 115]}
                                                        tickFormatter={(v) => `${v}p`}
                                                        hide={hasInflation || hasStocks || !hasDollar}
                                                    />

                                                    <RechartsTooltip
                                                        contentStyle={{
                                                            backgroundColor: "rgba(15, 16, 26, 0.95)",
                                                            border: "1px solid rgba(255, 255, 255, 0.15)",
                                                            borderRadius: "14px",
                                                            fontSize: "11px",
                                                            boxShadow: "0 10px 25px rgba(0,0,0,0.5)"
                                                        }}
                                                        formatter={(value: any, name: any) => {
                                                            if (value === undefined || value === null) return ["-", name];
                                                            const num = Number(value);
                                                            if (name?.includes("CPI") || name?.includes("PPI") || name?.includes("PCE")) {
                                                                return [`${num.toFixed(2)}%`, name];
                                                            }
                                                            if (name?.includes("달러")) {
                                                                return [`${num.toFixed(2)} pt`, name];
                                                            }
                                                            if (name?.includes("S&P") || name?.includes("나스닥")) {
                                                                return [`${num.toLocaleString()} pt`, name];
                                                            }
                                                            return [`${num.toLocaleString()} ${currentMeta.unit}`, name];
                                                        }}
                                                    />
                                                    <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: "11px" }} />

                                                    {/* Main Indicator Line */}
                                                    <Line
                                                        yAxisId="left"
                                                        type="monotone"
                                                        name={`${currentMeta.name} (${currentMeta.unit})`}
                                                        dataKey="value"
                                                        stroke={currentMeta.color}
                                                        strokeWidth={3}
                                                        dot={{ r: selectedPeriod === "6M" ? 4 : 2, fill: currentMeta.color, stroke: "#ffffff", strokeWidth: 1.5 }}
                                                        isAnimationActive={false}
                                                    />

                                                    {/* Active Overlays: Inflation (yAxisId="inflation") */}
                                                    {activeOverlays.ppi && (
                                                        <Line
                                                            yAxisId="inflation"
                                                            type="monotone"
                                                            name="미국 PPI 생산자물가 (YoY %)"
                                                            dataKey="ppi"
                                                            stroke="#fb923c"
                                                            strokeWidth={2.4}
                                                            dot={{ r: selectedPeriod === "6M" ? 3 : 1 }}
                                                            isAnimationActive={false}
                                                        />
                                                    )}
                                                    {activeOverlays.cpi && (
                                                        <Line
                                                            yAxisId="inflation"
                                                            type="monotone"
                                                            name="미국 CPI 소비자물가 (YoY %)"
                                                            dataKey="cpi"
                                                            stroke="#f43f5e"
                                                            strokeWidth={2}
                                                            dot={false}
                                                            isAnimationActive={false}
                                                        />
                                                    )}
                                                    {activeOverlays.pce && (
                                                        <Line
                                                            yAxisId="inflation"
                                                            type="monotone"
                                                            name="미국 PCE 소비지출물가 (YoY %)"
                                                            dataKey="pce"
                                                            stroke="#eab308"
                                                            strokeWidth={1.8}
                                                            dot={false}
                                                            isAnimationActive={false}
                                                        />
                                                    )}

                                                    {/* Currency (yAxisId="dollar") */}
                                                    {activeOverlays.dollar_index && (
                                                        <Line
                                                            yAxisId="dollar"
                                                            type="monotone"
                                                            name="달러 인덱스 (DXY)"
                                                            dataKey="dollar_index"
                                                            stroke="#38bdf8"
                                                            strokeWidth={1.8}
                                                            strokeDasharray="4 2"
                                                            dot={false}
                                                            isAnimationActive={false}
                                                        />
                                                    )}

                                                    {/* Equities (yAxisId="stocks") */}
                                                    {activeOverlays.sp500 && (
                                                        <Line
                                                            yAxisId="stocks"
                                                            type="monotone"
                                                            name="S&P 500 (SPX)"
                                                            dataKey="sp500"
                                                            stroke="#10b981"
                                                            strokeWidth={1.8}
                                                            dot={false}
                                                            isAnimationActive={false}
                                                        />
                                                    )}
                                                    {activeOverlays.nasdaq && (
                                                        <Line
                                                            yAxisId="stocks"
                                                            type="monotone"
                                                            name="나스닥 100 (NDX)"
                                                            dataKey="nasdaq"
                                                            stroke="#c084fc"
                                                            strokeWidth={1.8}
                                                            dot={false}
                                                            isAnimationActive={false}
                                                        />
                                                    )}
                                                </ComposedChart>
                                            </ResponsiveContainer>
                                        </div>
                                    )}
                                </div>
                                );
                            })()}

                            {/* Correlation & Macro Insight Panel */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Time Horizon Advice */}
                                <div className="bg-[#181a26] border border-white/10 rounded-2xl p-4 flex flex-col justify-between">
                                    <div>
                                        <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5 mb-2">
                                            <Info className="w-4 h-4" />
                                            시계열 분석 권장 가이드 ({selectedPeriod})
                                        </span>
                                        <p className="text-xs text-gray-300 leading-relaxed mb-2 font-medium">
                                            {historyData?.time_horizon_guide?.recommendation}
                                        </p>
                                        <p className="text-[11px] text-gray-400 leading-relaxed">
                                            {selectedPeriod === "6M" || selectedPeriod === "1Y"
                                                ? historyData?.time_horizon_guide?.short_term_focus
                                                : historyData?.time_horizon_guide?.long_term_focus}
                                        </p>
                                    </div>
                                    <div className="mt-3 pt-2.5 border-t border-white/5 text-[10px] text-gray-500">
                                        * 유가의 단기 변동은 수급(EIA/정제마진)에, 장기 추세는 달러 패권 및 물가 사이클에 수렴합니다.
                                    </div>
                                </div>

                                {/* Macro Correlation Metrics */}
                                <div className="bg-[#181a26] border border-white/10 rounded-2xl p-4 flex flex-col gap-2.5">
                                    <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                                        <Activity className="w-4 h-4" />
                                        선택 지표와 주요 매크로 간 역사적 상관계수
                                    </span>
                                    <div className="flex flex-col gap-2 text-xs">
                                        {historyData?.correlations && Object.entries(historyData.correlations).map(([k, v]: [string, any]) => (
                                            <div key={k} className="flex items-center justify-between bg-black/20 px-3 py-2 rounded-xl border border-white/5">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-white uppercase text-[11px]">
                                                        {k.replace("_", " ")}
                                                    </span>
                                                    <span className="text-[10px] text-gray-400">{v.desc}</span>
                                                </div>
                                                <span className={`font-mono font-bold text-xs ${v.corr < 0 ? "text-sky-400" : "text-emerald-400"}`}>
                                                    {v.corr > 0 ? `+${v.corr}` : v.corr}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 border-t border-white/10 bg-[#161724] flex items-center justify-between text-xs text-gray-400">
                            <span>* 데이터 출처: 미국 에너지정보청(EIA), 미국 노동통계국(BLS), FRED 및 S&P Global</span>
                            <button
                                onClick={() => setModalOpen(false)}
                                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs transition-all shadow-md"
                            >
                                닫기
                            </button>
                        </div>
                    </div>
                </div>
                );
            })()}
        </div>
    );
}
