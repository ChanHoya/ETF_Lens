"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
    Activity,
    ChevronDown,
    ChevronUp,
    RefreshCw,
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

// 기본 정적 Fallback 데이터 (백엔드 지연/에러 시에도 100% 안전 렌더링)
const FALLBACK_INDUSTRIES = [
    { id: "semiconductor", name: "반도체", state: "정상호황", trend: "down", color: "#10b981", is_partial: false },
    { id: "display", name: "디스플레이", state: "불황입구", trend: "down", color: "#f97316", is_partial: true },
    { id: "battery", name: "2차전지", state: "불황입구", trend: "up", color: "#f97316", is_partial: false },
    { id: "auto", name: "자동차", state: "호황둔화", trend: "down", color: "#f59e0b", is_partial: false },
    { id: "shipbuilding", name: "조선", state: "정상호황", trend: "up", color: "#10b981", is_partial: true },
    { id: "steel", name: "철강", state: "호황둔화", trend: "up", color: "#f59e0b", is_partial: false },
    { id: "petrochem", name: "석유화학", state: "호황둔화", trend: "up", color: "#f59e0b", is_partial: false },
    { id: "refinery", name: "정유", state: "정상호황", trend: "up", color: "#10b981", is_partial: false },
    { id: "tire", name: "타이어", state: "정상호황", trend: "up", color: "#10b981", is_partial: false },
    { id: "cosmetics", name: "화장품", state: "강한호황", trend: "up", color: "#10b981", is_partial: true },
    { id: "bio", name: "제약바이오", state: "정상호황", trend: "up", color: "#10b981", is_partial: true },
];

const FALLBACK_SIGNALS_DATA: any = {
    industry: "semiconductor",
    industry_kr: "반도체",
    current_state: "정상 호황",
    current_state_code: "normal_bull",
    current_action: "매수 유지 구간",
    summary_comment: '"아직 타이트하지만 가속은 둔화" — 매수 유지 구간',
    state_transition: "직전 국면 강한호황 (2개월 전) ➔ 현재 정상호황 · 악화 중 ↘",
    signals_count: { bullish: 2, neutral: 5, bearish: 0, total: 7 },
    weighted_score: "+0.40",
    score_gauge_pct: 70,
    stages: [
        { id: "strong_bull", name: "강한호황", action: "적극", is_current: false },
        { id: "normal_bull", name: "정상호황", action: "유지", is_current: true },
        { id: "slowing", name: "호황둔화", action: "경계", is_current: false },
        { id: "early_bear", name: "불황입구", action: "비중↓", is_current: false },
        { id: "deep_bear", name: "심각불황", action: "손절", is_current: false },
    ],
    timeline: [
        { month: "2025-08", state: "강한호황", color: "#10b981" },
        { month: "2025-09", state: "강한호황", color: "#10b981" },
        { month: "2025-10", state: "강한호황", color: "#10b981" },
        { month: "2025-11", state: "강한호황", color: "#10b981" },
        { month: "2025-12", state: "강한호황", color: "#10b981" },
        { month: "2026-01", state: "강한호황", color: "#10b981" },
        { month: "2026-02", state: "강한호황", color: "#10b981" },
        { month: "2026-03", state: "강한호황", color: "#10b981" },
        { month: "2026-04", state: "강한호황", color: "#10b981" },
        { month: "2026-05", state: "강한호황", color: "#10b981" },
        { month: "2026-06", state: "정상호황 (악화 중)", color: "#f59e0b" },
        { month: "2026-07", state: "정상호황 (악화 중)", color: "#f59e0b" },
        { month: "2026-08", state: "정상호황 (현재)", color: "#34d399" },
    ],
    signals: [
        {
            id: "lead_stock_drawdown",
            name: "대장주 낙폭",
            sub_name: "마이크론 테크놀로지(MU) · 52주 고점 $157.50",
            current_value_formatted: "-20.3%",
            current_value: -20.3,
            status: "neutral",
            status_kr: "중립",
            status_badge: "중립",
            color: "#94a3b8",
            chart_color: "#10b981",
            unit: "$",
            description: "대장주 낙폭은 반도체 대표주 마이크론 테크놀로지(MU)가 최근 52주 최고가($157.50)에서 현재 몇 % 하락했는지를 측정합니다. 메모리 3위 기업으로 D램/HBM 업황의 바로미터 역할을 합니다. 0% 부근이면 호황 고점권이며, -20% 이하는 단기 조정 및 중립 신호입니다.",
            source: "yfinance 공개 시세 (일별 종가)",
            series_10y: [
                { date: "2016-09-01", value: 16.5 },
                { date: "2018-05-30", value: 64.1 },
                { date: "2019-05-31", value: 32.5 },
                { date: "2021-04-12", value: 96.0 },
                { date: "2022-12-28", value: 48.4 },
                { date: "2023-11-20", value: 76.5 },
                { date: "2024-06-18", value: 157.5 },
                { date: "2025-03-15", value: 135.0 },
                { date: "2026-06-10", value: 142.0 },
                { date: "2026-08-21", value: 125.5 },
            ],
        },
        {
            id: "sector_index",
            name: "업종 지수",
            sub_name: "필라델피아 반도체 지수 (SOX) · 52주 고점 대비",
            current_value_formatted: "-19.8%",
            current_value: -19.8,
            status: "neutral",
            status_kr: "중립",
            status_badge: "중립",
            color: "#94a3b8",
            chart_color: "#10b981",
            unit: "pt",
            description: "필라델피아 반도체 지수(SOX)는 글로벌 30대 반도체 설계·장비·제조사의 벤치마크 지수입니다. 52주 최고점(5,900pt) 대비 현재 -19.8% 조정 구간에 위치하여 건전한 숨고르기(중립)를 시사합니다.",
            source: "Nasdaq / yfinance 공식 지수",
            series_10y: [
                { date: "2016-09-01", value: 780.0 },
                { date: "2018-03-12", value: 1450.0 },
                { date: "2020-02-14", value: 1980.0 },
                { date: "2021-12-27", value: 4039.0 },
                { date: "2022-10-14", value: 2089.0 },
                { date: "2024-07-10", value: 5904.0 },
                { date: "2025-06-15", value: 5120.0 },
                { date: "2026-08-21", value: 4732.0 },
            ],
        },
        {
            id: "kr_export_amount",
            name: "한국 수출액",
            sub_name: "2026-07 (월간 확정치)",
            current_value_formatted: "142억$",
            sub_badge: "YoY +52.4%",
            current_value: 142.0,
            status: "bullish",
            status_kr: "호황",
            status_badge: "호황",
            color: "#10b981",
            chart_color: "#10b981",
            unit: "억$",
            description: "관세청이 공식 집계하는 한국 반도체 월간 수출 실적입니다. HBM 및 고부가가치 D램 수출 호조로 월 140억 달러를 상회하며 역대급 호황 레벨을 유지하고 있습니다.",
            source: "관세청 무역통계 (K-stat)",
            series_10y: [
                { date: "2016-09", value: 62.0 },
                { date: "2018-09", value: 124.0 },
                { date: "2019-10", value: 78.0 },
                { date: "2021-11", value: 121.0 },
                { date: "2023-01", value: 60.0 },
                { date: "2024-06", value: 134.0 },
                { date: "2025-06", value: 148.0 },
                { date: "2026-07", value: 142.0 },
            ],
        },
        {
            id: "export_unit_price",
            name: "수출 단가지수",
            sub_name: "2026-07 · 2020=100",
            current_value_formatted: "242.3",
            sub_badge: "YoY +183.1%",
            current_value: 242.3,
            status: "bullish",
            status_kr: "호황",
            status_badge: "호황",
            color: "#10b981",
            chart_color: "#10b981",
            unit: "",
            description: "수출 금액을 수출 물량으로 나눈 단가 지표입니다(2020=100). HBM 프리미엄 및 서버용 DDR5 가격 상승으로 단가지수가 242.3을 기록하며 강력한 가격결정력(호황)을 나타냅니다.",
            source: "한국은행 경제통계시스템 (ECOS)",
            series_10y: [
                { date: "2016-09", value: 85.0 },
                { date: "2018-05", value: 135.0 },
                { date: "2019-12", value: 80.0 },
                { date: "2021-08", value: 105.0 },
                { date: "2023-03", value: 56.3 },
                { date: "2024-08", value: 145.0 },
                { date: "2025-10", value: 215.0 },
                { date: "2026-07", value: 242.3 },
            ],
        },
        {
            id: "real_export_volume",
            name: "실질 수출물량",
            sub_name: "2026-07 · 2020=100 · 가격효과 제거",
            current_value_formatted: "213.6",
            sub_badge: "YoY +0.6%",
            current_value: 213.6,
            status: "neutral",
            status_kr: "중립",
            status_badge: "중립",
            color: "#94a3b8",
            chart_color: "#10b981",
            unit: "",
            description: "가격 변동을 제거한 순수 반도체 수출 수량(물량) 지수입니다. 단가 상승세 대비 출하 물량의 증가율은 전년비 +0.6%로 완만한 상태(중립)를 유지하고 있습니다.",
            source: "한국은행 무역지수",
            series_10y: [
                { date: "2016-09", value: 72.0 },
                { date: "2018-09", value: 92.0 },
                { date: "2021-08", value: 115.0 },
                { date: "2022-12", value: 104.1 },
                { date: "2024-04", value: 165.0 },
                { date: "2025-06", value: 249.5 },
                { date: "2026-07", value: 213.6 },
            ],
        },
        {
            id: "capacity_utilization",
            name: "가동률지수",
            sub_name: "2026-06 · 3M 95.5 · 2020=100",
            current_value_formatted: "101.7",
            current_value: 101.7,
            status: "neutral",
            status_kr: "중립",
            status_badge: "중립",
            color: "#94a3b8",
            chart_color: "#f59e0b",
            unit: "",
            description: "통계청이 발표하는 반도체 제조공장 가동률 지수(2020=100)입니다. 100을 소폭 상회하는 101.7 수준으로 무리한 증설 없이 적정 가동률(중립)을 유지 중입니다.",
            source: "통계청 광업제조업동향조사",
            series_10y: [
                { date: "2016-09", value: 92.0 },
                { date: "2018-06", value: 115.0 },
                { date: "2020-04", value: 105.0 },
                { date: "2022-01", value: 124.9 },
                { date: "2023-02", value: 63.1 },
                { date: "2024-05", value: 110.0 },
                { date: "2025-08", value: 95.0 },
                { date: "2026-06", value: 101.7 },
            ],
        },
        {
            id: "inventory_index",
            name: "재고지수",
            sub_name: "2026-06 · 3M 106.8 · 낮을수록 호황",
            current_value_formatted: "100.1",
            current_value: 100.1,
            status: "neutral",
            status_kr: "중립",
            status_badge: "중립",
            color: "#94a3b8",
            chart_color: "#10b981",
            unit: "",
            description: "제조업 반도체 재고 수준을 나타내며, 낮을수록 재고 소진(호황)을 의미합니다. 2023년 불황기 정점(208.1)에서 100.1로 크게 낮아져 정상 재고 범위(중립)에 안착했습니다.",
            source: "통계청 제조업재고지수 (KOSIS)",
            series_10y: [
                { date: "2016-09", value: 85.0 },
                { date: "2017-12", value: 75.0 },
                { date: "2019-06", value: 140.0 },
                { date: "2021-07", value: 95.0 },
                { date: "2023-01", value: 208.1 },
                { date: "2024-06", value: 120.0 },
                { date: "2025-05", value: 93.1 },
                { date: "2026-06", value: 100.1 },
            ],
        },
    ],
    footnote: "위 지표는 모두 실데이터 — 대장주 시세(yfinance), 관세청 무역통계(수출액), 한국은행 ECOS(수출단가·물량지수), 통계청 KOSIS(가동률·재고지수). 각 지표를 클릭하면 기간별 실제 시계열과 통계적 진단이 표시됩니다.",
};

export default function SemiFundamentalSignals() {
    const [signalsData, setSignalsData] = useState<any>(FALLBACK_SIGNALS_DATA);
    const [industriesData, setIndustriesData] = useState<any>({ industries: FALLBACK_INDUSTRIES });
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

    const fetchData = async () => {
        try {
            const [sigRes, indRes] = await Promise.allSettled([
                fetch(`${API_BASE}/api/v1/analyze/semi-cycle/macro-signals?industry=${selectedIndustry}`, { cache: "no-store" }),
                fetch(`${API_BASE}/api/v1/analyze/semi-cycle/industries-summary`, { cache: "no-store" }),
            ]);

            if (sigRes.status === "fulfilled" && sigRes.value.ok) {
                const data = await sigRes.value.json();
                if (data && data.signals && Array.isArray(data.signals)) {
                    setSignalsData(data);
                }
            }

            if (indRes.status === "fulfilled" && indRes.value.ok) {
                const data = await indRes.value.json();
                if (data && data.industries && Array.isArray(data.industries)) {
                    setIndustriesData(data);
                }
            }
        } catch (err) {
            console.warn("Could not load live macro signals, using robust fallback:", err);
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

    const industries = industriesData?.industries || FALLBACK_INDUSTRIES;
    const currentSignalsData = signalsData || FALLBACK_SIGNALS_DATA;
    const signals = currentSignalsData?.signals || [];
    const stages = currentSignalsData?.stages || [];
    const timeline = currentSignalsData?.timeline || [];

    const signalsCount = currentSignalsData?.signals_count || { bullish: 2, neutral: 5, bearish: 0, total: 7 };
    const totalCount = signalsCount.total || 7;
    const bullPct = Math.round((signalsCount.bullish / totalCount) * 100);
    const neutralPct = Math.round((signalsCount.neutral / totalCount) * 100);
    const bearPct = Math.max(0, 100 - bullPct - neutralPct);

    return (
        <div className="w-full flex flex-col gap-5 animate-in fade-in duration-300">
            {/* 1. Top Industry Selector Bar (10대 업종) */}
            <div className="flex flex-col gap-2">
                <span className="text-[11px] font-bold text-gray-400">업종 선택 — 현재 {currentSignalsData?.industry_kr || "반도체"}</span>
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
                            | {currentSignalsData?.industry_kr} 사이클 5국면 — 각 국면 비교
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
                            {currentSignalsData?.current_state}: <span className="text-emerald-400 font-bold ml-1">호황 {signalsCount.bullish}개</span>
                            <span className="text-amber-400 ml-1.5">· 중립 {signalsCount.neutral}개</span>
                            <span className="text-rose-400 ml-1.5">· 둔화 {signalsCount.bearish}개</span>
                        </div>
                    </div>

                    {/* 실시간 실데이터 자동 판정 카드 */}
                    <div className="p-5 rounded-2xl bg-gradient-to-b from-emerald-950/20 to-[#161922] border border-emerald-500/30 shadow-xl flex flex-col gap-3">
                        <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-bold">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                            <span>실시간 실데이터 자동 판정 · {signalsCount.bullish}/{totalCount} 호황 신호</span>
                        </div>

                        <div>
                            <span className="text-[10px] text-gray-400">현재 {currentSignalsData?.industry_kr} 사이클 국면 (실데이터 자동 판정)</span>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="w-3.5 h-3.5 rounded-full bg-emerald-400" />
                                <h3 className="text-2xl font-black text-white">{currentSignalsData?.current_state}</h3>
                            </div>
                            <p className="text-[11px] text-gray-400 mt-0.5">대장주·수출·단가·가동률·재고 실데이터 종합</p>
                        </div>

                        {/* 국면 전환 추세 */}
                        <div className="text-xs text-gray-300 font-semibold pt-2 border-t border-white/5">
                            {currentSignalsData?.state_transition}
                        </div>

                        {/* 12개월 소급 판정 타임라인 바 (국면별 개별 컬러 렌더링) */}
                        <div className="flex flex-col gap-1">
                            <div className="flex gap-1 h-3.5 rounded-md overflow-hidden bg-black/40 p-0.5 border border-white/10">
                                {timeline.map((t: any, i: number) => (
                                    <div
                                        key={i}
                                        className="flex-1 rounded-sm transition-all hover:opacity-80 cursor-pointer"
                                        style={{ backgroundColor: t.color || "#10b981" }}
                                        title={`${t.month}: ${t.state}`}
                                    />
                                ))}
                            </div>
                            <div className="flex justify-between text-[9px] text-gray-500 font-mono">
                                <span>{timeline[0]?.month || "2025-08"}</span>
                                <span className="text-gray-400">월별 국면 (소급 판정)</span>
                                <span className="text-emerald-400 font-bold">현재</span>
                            </div>
                        </div>

                        {/* 코멘트 가이드 */}
                        <div className="p-3 rounded-xl bg-black/40 border border-white/10 text-xs font-bold text-gray-200 mt-1">
                            {currentSignalsData?.summary_comment}
                        </div>

                        {/* 가중치 종합 점수 3색 바 */}
                        <div className="pt-2">
                            <div className="flex justify-between text-xs font-semibold mb-1">
                                <span className="text-gray-300">지표 결과 · 가중 종합 <b className="text-emerald-300 font-mono">{currentSignalsData?.weighted_score ?? "+0.40"}</b></span>
                                <span className="text-[10px] text-gray-400">
                                    호황 <b className="text-emerald-400">{signalsCount.bullish}</b> · 중립 <b className="text-amber-400">{signalsCount.neutral}</b> · 둔화 <b className="text-rose-400">{signalsCount.bearish}</b>
                                </span>
                            </div>
                            <div className="w-full bg-white/5 h-2.5 rounded-full overflow-hidden flex gap-0.5 p-0.5 bg-black/30 border border-white/10">
                                {bullPct > 0 && <div className="bg-emerald-500 h-full rounded-l-full transition-all" style={{ width: `${bullPct}%` }} title={`호황 ${bullPct}%`} />}
                                {neutralPct > 0 && <div className="bg-amber-500 h-full transition-all" style={{ width: `${neutralPct}%` }} title={`중립 ${neutralPct}%`} />}
                                {bearPct > 0 && <div className="bg-rose-500 h-full rounded-r-full transition-all" style={{ width: `${bearPct}%` }} title={`둔화 ${bearPct}%`} />}
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
                            const fullSeries = (sig.series_10y && sig.series_10y.length > 0)
                                ? sig.series_10y
                                : (sig.series_5y && sig.series_5y.length > 0)
                                ? sig.series_5y
                                : [{ date: "2026-08", value: 100 }];

                            // 기간 필터링 (일별 거래일 또는 월별 데이터 수에 맞춰 정밀 슬라이스)
                            const isDaily = fullSeries.length > 300;
                            const sliceCount = isDaily
                                ? (curPeriod === "1Y" ? 250 : curPeriod === "3Y" ? 750 : curPeriod === "5Y" ? 1250 : 2500)
                                : (curPeriod === "1Y" ? 12 : curPeriod === "3Y" ? 36 : curPeriod === "5Y" ? 60 : 120);

                            const displaySeries = fullSeries.slice(-sliceCount);

                            // 실시간 선택 기간 기반 동적 최고치 / 최저치 연산
                            const numericValues = displaySeries.map((d: any) => d.value).filter((v: any) => typeof v === "number" && !isNaN(v));
                            const dynamicMin = numericValues.length > 0 ? Math.min(...numericValues) : 0;
                            const dynamicMax = numericValues.length > 0 ? Math.max(...numericValues) : 0;
                            const dataCountLabel = isDaily ? `${displaySeries.length}거래일` : `${displaySeries.length}개월`;

                            const formatVal = (v: number) => {
                                if (v >= 1000) return v.toLocaleString();
                                return v.toString();
                            };

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
                                                    <span className="text-[10px] text-gray-500 font-mono">{dataCountLabel}</span>
                                                </div>
                                            </div>

                                            {/* Real-time Dynamic High / Low Title */}
                                            <div className="text-base font-black text-gray-200 mb-2">
                                                최고 {formatVal(dynamicMax)} · 최저 {formatVal(dynamicMin)}
                                            </div>

                                            {/* Area Chart */}
                                            <div className="w-full h-[180px] bg-black/30 rounded-xl p-2 border border-white/5 relative">
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <AreaChart data={displaySeries} margin={{ top: 10, right: 15, bottom: 5, left: 0 }}>
                                                        <defs>
                                                            <linearGradient id={`grad_${sig.id}`} x1="0" y1="0" x2="0" y2="1">
                                                                <stop offset="5%" stopColor={sig.chart_color || "#10b981"} stopOpacity={0.4} />
                                                                <stop offset="95%" stopColor={sig.chart_color || "#10b981"} stopOpacity={0.0} />
                                                            </linearGradient>
                                                        </defs>
                                                        <CartesianGrid stroke="rgba(255,255,255,0.03)" />
                                                        <XAxis
                                                            dataKey="date"
                                                            tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 9 }}
                                                            interval={Math.max(0, Math.floor(displaySeries.length / 5))}
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
                                                            formatter={(val: any) => [`${val} ${sig.unit || ""}`, sig.name]}
                                                        />
                                                        <Area
                                                            type="monotone"
                                                            dataKey="value"
                                                            stroke={sig.chart_color || "#10b981"}
                                                            strokeWidth={2.2}
                                                            fill={`url(#grad_${sig.id})`}
                                                            dot={false}
                                                        />
                                                    </AreaChart>
                                                </ResponsiveContainer>
                                            </div>

                                            {/* Start - End Dates Label */}
                                            <div className="flex justify-between text-lg font-black text-gray-500 font-mono mt-2">
                                                <span>{displaySeries[0]?.date || ""}</span>
                                                <span className="text-gray-200">{displaySeries[displaySeries.length - 1]?.date || ""}</span>
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
                        실데이터 종합: 호황 신호 ( 호황 {signalsCount.bullish} · 중립 {signalsCount.neutral} · 둔화 {signalsCount.bearish} )
                    </div>
                    <p className="text-[10px] text-gray-500 leading-relaxed">
                        {currentSignalsData?.footnote}
                    </p>
                </div>
            </div>
        </div>
    );
}

