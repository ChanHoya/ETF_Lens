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
    Layers
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

export default function OilTab() {
    const [overview, setOverview] = useState<any>(null);
    const [fundamentals, setFundamentals] = useState<any>(null);
    const [geopolitics, setGeopolitics] = useState<any>(null);
    const [playbook, setPlaybook] = useState<any>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [refreshing, setRefreshing] = useState<boolean>(false);
    const [selectedScenarioIdx, setSelectedScenarioIdx] = useState<number>(0);

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

    useEffect(() => {
        fetchAllOilData(false);
    }, []);

    const bm = overview?.benchmarks;
    const wti = bm?.wti || { price: 76.85, change: -0.92, change_pct: -1.18, high_52w: 93.98, low_52w: 66.8 };
    const brent = bm?.brent || { price: 80.45, change: -0.85, change_pct: -1.05, high_52w: 96.5, low_52w: 71.2 };
    const dubai = bm?.dubai || { price: 79.1, change: -0.7, change_pct: -0.88, high_52w: 94.2, low_52w: 70.1 };

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
                                서부텍사스산원유(WTI), 북해산브렌트유(Brent), 중동두바이유(Dubai) 및 주요 정제유
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20">
                            현재: {overview?.regime_status?.regime || "적정 균형 국면 ($70~$85)"}
                        </span>
                    </div>
                </div>

                {/* 3 Benchmark Cards + Spread */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* WTI */}
                    <div className="bg-[#181a26]/70 border border-white/10 rounded-2xl p-5 flex flex-col justify-between hover:border-amber-500/30 transition-all">
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-bold text-gray-400">미국 서부텍사스유 (WTI)</span>
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 font-bold">
                                    글로벌 기준유
                                </span>
                            </div>
                            <div className="flex items-baseline gap-2 mb-2">
                                <h4 className="text-3xl font-black text-white font-mono">${wti.price}</h4>
                                <span className={`text-xs font-bold flex items-center ${wti.change >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                                    {wti.change >= 0 ? "+" : ""}{wti.change} ({wti.change >= 0 ? "+" : ""}{wti.change_pct}%)
                                </span>
                            </div>
                            <div className="text-[11px] text-gray-500">배럴당 가격 ($/bbl)</div>
                        </div>
                        <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-gray-400">
                            <span>52주 밴드: ${wti.low_52w} ~ ${wti.high_52w}</span>
                            <span className="text-amber-400 font-semibold">중간 위치</span>
                        </div>
                    </div>

                    {/* Brent */}
                    <div className="bg-[#181a26]/70 border border-white/10 rounded-2xl p-5 flex flex-col justify-between hover:border-sky-500/30 transition-all">
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-bold text-gray-400">북해산 브렌트유 (Brent)</span>
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-500/15 text-sky-300 font-bold">
                                    해상 수송유
                                </span>
                            </div>
                            <div className="flex items-baseline gap-2 mb-2">
                                <h4 className="text-3xl font-black text-white font-mono">${brent.price}</h4>
                                <span className={`text-xs font-bold flex items-center ${brent.change >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                                    {brent.change >= 0 ? "+" : ""}{brent.change} ({brent.change >= 0 ? "+" : ""}{brent.change_pct}%)
                                </span>
                            </div>
                            <div className="text-[11px] text-gray-500">유럽·아프리카·중동 수출 지표</div>
                        </div>
                        <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-gray-400">
                            <span>52주 밴드: ${brent.low_52w} ~ ${brent.high_52w}</span>
                            <span className="text-sky-400 font-semibold">지정학 민감</span>
                        </div>
                    </div>

                    {/* Dubai */}
                    <div className="bg-[#181a26]/70 border border-white/10 rounded-2xl p-5 flex flex-col justify-between hover:border-purple-500/30 transition-all">
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-bold text-gray-400">중동 두바이유 (Dubai)</span>
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/15 text-purple-300 font-bold">
                                    한국 수입 70%
                                </span>
                            </div>
                            <div className="flex items-baseline gap-2 mb-2">
                                <h4 className="text-3xl font-black text-white font-mono">${dubai.price}</h4>
                                <span className={`text-xs font-bold flex items-center ${dubai.change >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                                    {dubai.change >= 0 ? "+" : ""}{dubai.change} ({dubai.change >= 0 ? "+" : ""}{dubai.change_pct}%)
                                </span>
                            </div>
                            <div className="text-[11px] text-gray-500">국내 정유사 원유 도입 단가 기준</div>
                        </div>
                        <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-gray-400">
                            <span>국내 정유 4사 도입 기준</span>
                            <span className="text-purple-400 font-semibold">아시아 프리미엄</span>
                        </div>
                    </div>

                    {/* Brent - WTI Spread */}
                    <div className="bg-gradient-to-br from-[#1b1c2b] to-[#141520] border border-indigo-500/30 rounded-2xl p-5 flex flex-col justify-between">
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-bold text-indigo-300">Brent - WTI 스프레드</span>
                                <span className="text-[10px] font-mono text-gray-400">차익거래 지표</span>
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
                        <div className="mt-4 pt-3 border-t border-white/5 text-[10px] text-indigo-300">
                            스프레드 확대 시 미국 정유사 및 해상 탱커 수혜
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

            {/* Section 2: 원유 수급 펀더멘털 & 싱가포르 복합 정제마진 (Crack Spread) */}
            <div className="w-full bg-[#121217]/70 border border-white/10 rounded-3xl p-5 md:p-7 backdrop-blur-md shadow-xl flex flex-col gap-6">
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400">
                            <Factory className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-lg md:text-xl font-bold text-white flex items-center gap-2">
                                2. 원유 수급 펀더멘털 & 정제마진 (Crack Spread)
                            </h3>
                            <p className="text-xs text-gray-400">
                                미국 EIA 주간 원유 재고, 베이커휴즈 리그 수, 싱가포르 복합 정제마진 추이
                            </p>
                        </div>
                    </div>
                </div>

                {/* 3 Metric Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* EIA Inventory */}
                    <div className="bg-[#181a26]/70 border border-white/10 rounded-2xl p-5 flex flex-col justify-between">
                        <div>
                            <span className="text-xs font-bold text-gray-400 block mb-1">
                                {fundamentals?.inventory?.title || "미국 주간 원유 재고 (EIA)"}
                            </span>
                            <div className="flex items-baseline gap-2 mb-2">
                                <h4 className="text-2xl font-black text-white font-mono">
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
                        <div className="mt-3 pt-3 border-t border-white/5 text-[10px] text-amber-300">
                            전략비축유(SPR): {fundamentals?.inventory?.strategic_petroleum_reserve_mb || 375}M 배럴 ($79 이하 재매입 중)
                        </div>
                    </div>

                    {/* US Production & Rig Count */}
                    <div className="bg-[#181a26]/70 border border-white/10 rounded-2xl p-5 flex flex-col justify-between">
                        <div>
                            <span className="text-xs font-bold text-gray-400 block mb-1">미국 셰일 생산량 & 가동 리그 수</span>
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
                        <div className="mt-3 pt-3 border-t border-white/5 text-[10px] text-gray-400">
                            OPEC+ 잉여 생산능력: 약 {fundamentals?.supply_metrics?.opec_spare_capacity_mbpd || 4.5}M bpd 완충
                        </div>
                    </div>

                    {/* Refining Margin */}
                    <div className="bg-gradient-to-br from-[#192420] to-[#121915] border border-emerald-500/30 rounded-2xl p-5 flex flex-col justify-between">
                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-bold text-emerald-300">싱가포르 복합 정제마진</span>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
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
                        <div className="mt-3 pt-3 border-t border-white/5 text-[10px] text-emerald-300 font-semibold">
                            배럴당 마진 $1 상승 시 정유사 분기 영업익 수천억 개선
                        </div>
                    </div>
                </div>

                {/* Historical Trend Chart (WTI vs Brent vs Refining Margin) */}
                <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
                            <BarChart3 className="w-3.5 h-3.5 text-emerald-400" />
                            최근 6개월 유가 및 싱가포르 복합 정제마진 복합 추이
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

            {/* Section 3: 지정학적 리스크 레이더 & 3대 해상 초크포인트 */}
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
                                호르무즈·홍해·러시아 항로의 수송 차질 및 유가 내 지정학 프리미엄 추정
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                            위험도: {geopolitics?.risk_index || 72}/100 ({geopolitics?.risk_level || "경계"})
                        </span>
                        <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            지정학 프리미엄: +${geopolitics?.estimated_risk_premium_dollar || 6.5}/배럴
                        </span>
                    </div>
                </div>

                {/* 3 Chokepoint Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {geopolitics?.chokepoints?.map((cp: any, idx: number) => (
                        <div key={idx} className="bg-[#181a26]/70 border border-white/10 rounded-2xl p-5 flex flex-col justify-between hover:border-rose-500/30 transition-all">
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
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
                            <div className="pt-2.5 border-t border-white/5 text-[10px] text-indigo-300">
                                위치: {cp.location}
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
        </div>
    );
}
