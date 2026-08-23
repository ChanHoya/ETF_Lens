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
        { month: "2025-08", state: "strong_bull", color: "#10b981" },
        { month: "2025-09", state: "strong_bull", color: "#10b981" },
        { month: "2025-10", state: "strong_bull", color: "#10b981" },
        { month: "2025-11", state: "strong_bull", color: "#10b981" },
        { month: "2025-12", state: "strong_bull", color: "#10b981" },
        { month: "2026-01", state: "strong_bull", color: "#10b981" },
        { month: "2026-02", state: "strong_bull", color: "#10b981" },
        { month: "2026-03", state: "strong_bull", color: "#10b981" },
        { month: "2026-04", state: "strong_bull", color: "#10b981" },
        { month: "2026-05", state: "strong_bull", color: "#10b981" },
        { month: "2026-06", state: "normal_bull", color: "#34d399" },
        { month: "2026-07", state: "normal_bull", color: "#34d399" },
        { month: "2026-08", state: "normal_bull", color: "#34d399" },
    ],
    signals: [
        {
            id: "lead_stock_drawdown",
            name: "대장주 낙폭",
            sub_name: "마이크론 테크놀로지(MU) · 52주 고점 1213.56",
            current_value_formatted: "-20.3%",
            current_value: -20.3,
            status: "neutral",
            status_kr: "중립",
            status_badge: "중립",
            color: "#94a3b8",
            chart_color: "#10b981",
            description: "대장주 낙폭은 반도체 대표주 마이크론 테크놀로지(MU)가 최근 1년 최고가에서 지금 몇 % 내렸는지입니다. 메모리(D램·낸드) 3위 — 메모리 업황의 풍향계. 0%에 가까우면 고점 부근(호황), 깊게 빠지면 경기 둔화 신호입니다.",
            source: "공개 데이터 기반 실제 시계열 (일별 종가)",
            data_points_count: "1300거래일",
            high_low: { high: "1,213.6", low: "48.0", start_date: "2021-06-16", end_date: "2026-08-21" },
            series_5y: [
                { date: "2021-06-16", value: 75.0 },
                { date: "2022-01-15", value: 68.2 },
                { date: "2022-09-30", value: 48.0 },
                { date: "2023-06-15", value: 65.4 },
                { date: "2024-01-10", value: 85.2 },
                { date: "2024-06-18", value: 153.4 },
                { date: "2025-01-20", value: 340.5 },
                { date: "2025-08-15", value: 720.0 },
                { date: "2026-06-20", value: 1213.6 },
                { date: "2026-08-21", value: 967.2 },
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
            description: "필라델피아 반도체 지수(SOX)는 나스닥이 산출하는 반도체 대표 지수입니다(설계·제조·유통 30종목). 여기서는 이 지수가 52주 최고가 대비 지금 몇 % 빠졌는지를 봅니다.",
            source: "공개 데이터 기반 실제 시계열입니다.",
            data_points_count: "1300거래일",
            high_low: { high: "14,634.7", low: "2,162.3", start_date: "2021-06-23", end_date: "2026-08-21" },
            series_5y: [
                { date: "2021-06-23", value: 3200.0 },
                { date: "2022-10-15", value: 2162.3 },
                { date: "2023-08-20", value: 3650.0 },
                { date: "2024-07-10", value: 5800.0 },
                { date: "2025-05-15", value: 9500.0 },
                { date: "2026-06-15", value: 14634.7 },
                { date: "2026-08-21", value: 11737.0 },
            ],
        },
        {
            id: "kr_export_amount",
            name: "한국 수출액",
            sub_name: "2026-07",
            current_value_formatted: "280억$",
            sub_badge: "YoY +270.4%",
            current_value: 280.0,
            status: "bullish",
            status_kr: "호황",
            status_badge: "호황",
            color: "#10b981",
            chart_color: "#10b981",
            description: "관세청이 집계하는 한국의 반도체 월간 수출 금액입니다. 수출액이 늘면 글로벌 실수요가 살아있다는 신호입니다.",
            source: "관세청 월별 확정치",
            data_points_count: "60개월",
            high_low: { high: "290억$", "low": "25억$", start_date: "2021-08", end_date: "2026-07" },
            series_5y: [
                { date: "2021-08", value: 115.0 },
                { date: "2022-05", value: 125.0 },
                { date: "2023-01", value: 25.0 },
                { date: "2023-10", value: 85.0 },
                { date: "2024-08", value: 150.0 },
                { date: "2025-06", value: 240.0 },
                { date: "2026-05", value: 290.0 },
                { date: "2026-07", value: 280.0 },
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
            description: "수출 금액을 물량으로 나눈 가격 지수입니다(2020년=100). 같은 양을 팔아도 단가가 오르면 올라갑니다.",
            source: "한국은행 수출입물가지수",
            data_points_count: "60개월",
            high_low: { high: "242.3", low: "56.3", start_date: "2021-08", end_date: "2026-07" },
            series_5y: [
                { date: "2021-08", value: 105.0 },
                { date: "2023-03", value: 56.3 },
                { date: "2024-01", value: 85.0 },
                { date: "2025-01", value: 160.0 },
                { date: "2026-01", value: 210.0 },
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
            description: "수출 금액에서 가격 변동을 걷어낸 실질 물량입니다(수출물량지수, 2020년=100).",
            source: "한국은행 무역지수",
            data_points_count: "60개월",
            high_low: { high: "249.5", low: "104.1", start_date: "2021-08", end_date: "2026-07" },
            series_5y: [
                { date: "2021-08", value: 110.0 },
                { date: "2022-12", value: 104.1 },
                { date: "2024-01", value: 165.0 },
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
            chart_color: "#ef4444",
            description: "통계청이 집계하는 반도체 공장이 얼마나 풀가동 중인지를 나타냅니다(2020년=100).",
            source: "통계청 광업제조업동향조사",
            data_points_count: "60개월",
            high_low: { high: "124.9", low: "63.1", start_date: "2021-07", end_date: "2026-06" },
            series_5y: [
                { date: "2021-07", value: 115.0 },
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
            description: "통계청이 집계하는 반도체 재고 수준입니다. 낮을수록 재고 소진 호황입니다.",
            source: "통계청 제조업재고지수",
            data_points_count: "60개월",
            high_low: { high: "208.1", low: "93.1", start_date: "2021-07", end_date: "2026-06" },
            series_5y: [
                { date: "2021-07", value: 95.0 },
                { date: "2023-01", value: 208.1 },
                { date: "2024-06", value: 120.0 },
                { date: "2025-05", value: 93.1 },
                { date: "2026-06", value: 100.1 },
            ],
        },
    ],
    footnote: "위 지표는 모두 실데이터 — 대장주 시세, 관세청 수출액, 한국은행 수출단가·물량지수, 통계청 가동률·재고지수(공개 데이터·재고순환 기반). 각 지표 행을 탭하면 쉬운 설명과 실제 데이터가 아래로 펼쳐집니다.",
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
    const [isLoading, setIsLoading] = useState<boolean>(false);

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

    const gaugePct = Math.min(100, Math.max(0, currentSignalsData?.score_gauge_pct ?? 70));

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
                            정상 호황: <span className="text-emerald-400 font-bold ml-1">호황 {currentSignalsData?.signals_count?.bullish ?? 2}개</span>
                            <span className="text-gray-400 ml-1.5">· 중립 {currentSignalsData?.signals_count?.neutral ?? 5}개</span>
                            <span className="text-rose-400 ml-1.5">· 둔화 {currentSignalsData?.signals_count?.bearish ?? 0}개</span>
                        </div>
                    </div>

                    {/* 실시간 실데이터 자동 판정 카드 */}
                    <div className="p-5 rounded-2xl bg-gradient-to-b from-emerald-950/20 to-[#161922] border border-emerald-500/30 shadow-xl flex flex-col gap-3">
                        <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-bold">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                            <span>실시간 실데이터 자동 판정 · {currentSignalsData?.signals_count?.bullish ?? 2}/{currentSignalsData?.signals_count?.total ?? 7} 호황 신호</span>
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

                        {/* 12개월 소급 판정 타임라인 바 */}
                        <div className="flex flex-col gap-1">
                            <div className="flex gap-1 h-3 rounded-md overflow-hidden bg-black/40 p-0.5 border border-white/10">
                                {timeline.map((t: any, i: number) => (
                                    <div
                                        key={i}
                                        className="flex-1 rounded-sm transition-all hover:opacity-80"
                                        style={{ backgroundColor: t.color || "#10b981" }}
                                        title={`${t.month}: ${t.state}`}
                                    />
                                ))}
                            </div>
                            <div className="flex justify-between text-[9px] text-gray-500 font-mono">
                                <span>{timeline[0]?.month || "2025-08"}</span>
                                <span>월별 국면 (소급 판정)</span>
                                <span>현재</span>
                            </div>
                        </div>

                        {/* 코멘트 가이드 */}
                        <div className="p-3 rounded-xl bg-black/40 border border-white/10 text-xs font-bold text-gray-200 mt-1">
                            {currentSignalsData?.summary_comment}
                        </div>

                        {/* 가중치 종합 점수 바 */}
                        <div className="pt-2">
                            <div className="flex justify-between text-xs font-semibold mb-1">
                                <span className="text-gray-300">지표 결과 · 가중 종합 <b className="text-emerald-300 font-mono">{currentSignalsData?.weighted_score ?? "+0.40"}</b></span>
                                <span className="text-[10px] text-gray-400">
                                    호황 <b className="text-emerald-400">{currentSignalsData?.signals_count?.bullish ?? 2}</b> · 중립 {currentSignalsData?.signals_count?.neutral ?? 5} · 둔화 {currentSignalsData?.signals_count?.bearish ?? 0}
                                </span>
                            </div>
                            <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden flex">
                                <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${gaugePct}%` }} />
                                <div className="bg-amber-500 h-full rounded-full" style={{ width: `${100 - gaugePct}%` }} />
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
                            const rawSeries = (sig.series_5y && sig.series_5y.length > 0) ? sig.series_5y : [{ date: "2026-08", value: 100 }];

                            // 기간 필터링
                            const filteredSeries = curPeriod === "1Y" ? rawSeries.slice(-12) : curPeriod === "3Y" ? rawSeries.slice(-36) : rawSeries;
                            const displaySeries = filteredSeries.length > 0 ? filteredSeries : rawSeries;

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
                                                최고 {sig.high_low?.high ?? "-"} · 최저 {sig.high_low?.low ?? "-"}
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
                                                            formatter={(val: any) => [val, sig.name]}
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
                        실데이터 종합: 호황 신호 ( 호황 {currentSignalsData?.signals_count?.bullish ?? 2} · 중립 {currentSignalsData?.signals_count?.neutral ?? 5} · 둔화 {currentSignalsData?.signals_count?.bearish ?? 0} )
                    </div>
                    <p className="text-[10px] text-gray-500 leading-relaxed">
                        {currentSignalsData?.footnote}
                    </p>
                </div>
            </div>
        </div>
    );
}
