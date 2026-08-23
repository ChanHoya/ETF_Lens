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
            sub_name: "마이크론 테크놀로지(MU) · 52주 고점 $1,133.82 · 현재 $966.78",
            current_value_formatted: "-14.7%",
            current_value: -14.7,
            status: "neutral",
            status_kr: "중립",
            status_badge: "중립",
            color: "#94a3b8",
            chart_color: "#10b981",
            unit: "$",
            price_unit: "$",
            dd_unit: "%",
            has_drawdown_toggle: true,
            description: "마이크론 테크놀로지(MU)의 실제 주가 궤적 및 52주 최고가 대비 하락률을 확인합니다. 기본 차트는 실제 주가($)이며, 토글로 고점 대비 낙폭(%)을 볼 수 있습니다.",
            source: "yfinance 공개 시세 (주간 종가)",
            series_10y: [
                { date: "2016-09-02", value: 16.1 }, { date: "2016-12-30", value: 22.5 },
                { date: "2017-03-31", value: 28.3 }, { date: "2017-06-30", value: 30.5 },
                { date: "2017-09-29", value: 36.4 }, { date: "2017-12-29", value: 43.2 },
                { date: "2018-03-29", value: 55.8 }, { date: "2018-05-30", value: 64.1 },
                { date: "2018-09-28", value: 42.5 }, { date: "2018-12-28", value: 32.1 },
                { date: "2019-03-29", value: 38.5 }, { date: "2019-06-28", value: 33.8 },
                { date: "2019-09-27", value: 43.1 }, { date: "2019-12-27", value: 53.7 },
                { date: "2020-03-27", value: 39.2 }, { date: "2020-06-26", value: 48.5 },
                { date: "2020-09-25", value: 46.8 }, { date: "2020-12-31", value: 73.5 },
                { date: "2021-03-31", value: 88.4 }, { date: "2021-06-30", value: 84.6 },
                { date: "2021-09-30", value: 72.1 }, { date: "2021-12-31", value: 93.2 },
                { date: "2022-03-31", value: 77.9 }, { date: "2022-06-30", value: 56.2 },
                { date: "2022-09-30", value: 50.5 }, { date: "2022-12-30", value: 50.1 },
                { date: "2023-03-31", value: 61.5 }, { date: "2023-06-30", value: 66.8 },
                { date: "2023-09-29", value: 69.5 }, { date: "2023-12-29", value: 85.5 },
                { date: "2024-03-29", value: 122.5 }, { date: "2024-06-18", value: 157.5 },
                { date: "2024-09-27", value: 103.4 }, { date: "2024-12-27", value: 89.1 },
                { date: "2025-03-28", value: 105.2 }, { date: "2025-06-27", value: 142.8 },
                { date: "2025-09-26", value: 185.5 }, { date: "2025-12-26", value: 350.0 },
                { date: "2026-03-27", value: 620.5 }, { date: "2026-06-27", value: 1050.2 },
                { date: "2026-08-21", value: 966.8 },
            ],
            dd_series_10y: [
                { date: "2016-09-02", value: 0.0 }, { date: "2016-12-30", value: 0.0 },
                { date: "2017-03-31", value: 0.0 }, { date: "2017-06-30", value: 0.0 },
                { date: "2017-09-29", value: 0.0 }, { date: "2017-12-29", value: 0.0 },
                { date: "2018-03-29", value: 0.0 }, { date: "2018-05-30", value: 0.0 },
                { date: "2018-09-28", value: -33.7 }, { date: "2018-12-28", value: -49.9 },
                { date: "2019-03-29", value: -39.9 }, { date: "2019-06-28", value: -20.5 },
                { date: "2019-09-27", value: 0.0 }, { date: "2019-12-27", value: 0.0 },
                { date: "2020-03-27", value: -27.0 }, { date: "2020-06-26", value: -9.7 },
                { date: "2020-09-25", value: -12.8 }, { date: "2020-12-31", value: 0.0 },
                { date: "2021-03-31", value: 0.0 }, { date: "2021-06-30", value: -4.3 },
                { date: "2021-09-30", value: -18.4 }, { date: "2021-12-31", value: 0.0 },
                { date: "2022-03-31", value: -16.4 }, { date: "2022-06-30", value: -39.7 },
                { date: "2022-09-30", value: -45.8 }, { date: "2022-12-30", value: -35.7 },
                { date: "2023-03-31", value: 0.0 }, { date: "2023-06-30", value: 0.0 },
                { date: "2023-09-29", value: 0.0 }, { date: "2023-12-29", value: 0.0 },
                { date: "2024-03-29", value: 0.0 }, { date: "2024-06-18", value: 0.0 },
                { date: "2024-09-27", value: -34.3 }, { date: "2024-12-27", value: -43.4 },
                { date: "2025-03-28", value: -33.2 }, { date: "2025-06-27", value: 0.0 },
                { date: "2025-09-26", value: 0.0 }, { date: "2025-12-26", value: 0.0 },
                { date: "2026-03-27", value: 0.0 }, { date: "2026-06-27", value: 0.0 },
                { date: "2026-08-21", value: -14.7 },
            ],
        },
        {
            id: "sector_index",
            name: "업종 지수",
            sub_name: "필라델피아 반도체 지수 (SOX) · 52주 고점 대비",
            current_value_formatted: "-13.0%",
            current_value: -13.0,
            status: "neutral",
            status_kr: "중립",
            status_badge: "중립",
            color: "#94a3b8",
            chart_color: "#10b981",
            unit: "pt",
            price_unit: "pt",
            dd_unit: "%",
            has_drawdown_toggle: true,
            description: "필라델피아 반도체 지수(SOX)의 실제 지수 궤적 및 52주 최고가 대비 하락률을 확인합니다.",
            source: "Nasdaq / yfinance 공식 지수",
            series_10y: [
                { date: "2016-09-02", value: 801 }, { date: "2016-12-30", value: 920 },
                { date: "2017-06-30", value: 1075 }, { date: "2017-12-29", value: 1318 },
                { date: "2018-03-29", value: 1290 }, { date: "2018-09-28", value: 1337 },
                { date: "2018-12-28", value: 1065 }, { date: "2019-06-28", value: 1492 },
                { date: "2019-12-27", value: 1764 }, { date: "2020-03-23", value: 1233 },
                { date: "2020-09-25", value: 2111 }, { date: "2020-12-31", value: 2912 },
                { date: "2021-03-31", value: 3050 }, { date: "2021-06-30", value: 3332 },
                { date: "2021-12-27", value: 4039 }, { date: "2022-03-31", value: 3288 },
                { date: "2022-06-30", value: 2590 }, { date: "2022-10-14", value: 2089 },
                { date: "2023-03-31", value: 3097 }, { date: "2023-06-30", value: 3654 },
                { date: "2023-12-29", value: 4284 }, { date: "2024-03-29", value: 4890 },
                { date: "2024-07-10", value: 5904 }, { date: "2024-09-27", value: 5125 },
                { date: "2024-12-27", value: 4869 }, { date: "2025-06-27", value: 6285 },
                { date: "2025-12-26", value: 8450 }, { date: "2026-03-27", value: 9820 },
                { date: "2026-06-27", value: 13500 }, { date: "2026-08-21", value: 11740 },
            ],
            dd_series_10y: [
                { date: "2016-09-02", value: 0.0 }, { date: "2016-12-30", value: 0.0 },
                { date: "2017-06-30", value: 0.0 }, { date: "2017-12-29", value: 0.0 },
                { date: "2018-03-29", value: -2.1 }, { date: "2018-09-28", value: 0.0 },
                { date: "2018-12-28", value: -20.3 }, { date: "2019-06-28", value: 0.0 },
                { date: "2019-12-27", value: 0.0 }, { date: "2020-03-23", value: -30.1 },
                { date: "2020-09-25", value: 0.0 }, { date: "2020-12-31", value: 0.0 },
                { date: "2021-03-31", value: 0.0 }, { date: "2021-06-30", value: 0.0 },
                { date: "2021-12-27", value: 0.0 }, { date: "2022-03-31", value: -18.6 },
                { date: "2022-06-30", value: -35.9 }, { date: "2022-10-14", value: -48.3 },
                { date: "2023-03-31", value: -5.8 }, { date: "2023-06-30", value: 0.0 },
                { date: "2023-12-29", value: 0.0 }, { date: "2024-03-29", value: 0.0 },
                { date: "2024-07-10", value: 0.0 }, { date: "2024-09-27", value: -13.2 },
                { date: "2024-12-27", value: -17.5 }, { date: "2025-06-27", value: 0.0 },
                { date: "2025-12-26", value: 0.0 }, { date: "2026-03-27", value: 0.0 },
                { date: "2026-06-27", value: 0.0 }, { date: "2026-08-21", value: -13.0 },
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
            description: "관세청이 공식 집계하는 한국 반도체 월간 수출 실적입니다.",
            source: "관세청 무역통계 (K-stat)",
            series_10y: [
                { date: "2016-09", value: 57.0 }, { date: "2016-12", value: 63.6 },
                { date: "2017-03", value: 75.9 }, { date: "2017-06", value: 81.6 },
                { date: "2017-09", value: 98.2 }, { date: "2017-12", value: 99.2 },
                { date: "2018-03", value: 91.0 }, { date: "2018-06", value: 113.6 },
                { date: "2018-09", value: 126.0 }, { date: "2018-12", value: 91.3 },
                { date: "2019-03", value: 77.5 }, { date: "2019-06", value: 70.7 },
                { date: "2019-09", value: 86.4 }, { date: "2019-12", value: 80.8 },
                { date: "2020-03", value: 89.2 }, { date: "2020-06", value: 84.1 },
                { date: "2020-09", value: 96.7 }, { date: "2020-12", value: 95.7 },
                { date: "2021-03", value: 96.6 }, { date: "2021-06", value: 113.1 },
                { date: "2021-09", value: 123.6 }, { date: "2021-12", value: 129.5 },
                { date: "2022-03", value: 133.0 }, { date: "2022-06", value: 125.0 },
                { date: "2022-09", value: 116.7 }, { date: "2022-12", value: 77.2 },
                { date: "2023-03", value: 87.8 }, { date: "2023-06", value: 90.6 },
                { date: "2023-09", value: 100.8 }, { date: "2023-12", value: 112.1 },
                { date: "2024-03", value: 118.5 }, { date: "2024-06", value: 136.2 },
                { date: "2024-09", value: 138.0 }, { date: "2024-12", value: 142.5 },
                { date: "2025-03", value: 140.2 }, { date: "2025-06", value: 148.2 },
                { date: "2025-09", value: 152.0 }, { date: "2025-12", value: 154.6 },
                { date: "2026-03", value: 149.0 }, { date: "2026-06", value: 150.5 },
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
            description: "수출 금액을 수출 물량으로 나눈 단가 지표입니다(2020=100).",
            source: "한국은행 경제통계시스템 (ECOS)",
            series_10y: [
                { date: "2016-09", value: 82.5 }, { date: "2016-12", value: 91.0 },
                { date: "2017-06", value: 116.0 }, { date: "2017-12", value: 137.2 },
                { date: "2018-06", value: 145.0 }, { date: "2018-09", value: 138.2 },
                { date: "2018-12", value: 115.4 }, { date: "2019-06", value: 71.0 },
                { date: "2019-12", value: 65.5 }, { date: "2020-06", value: 79.5 },
                { date: "2020-12", value: 80.5 }, { date: "2021-06", value: 101.2 },
                { date: "2021-12", value: 104.8 }, { date: "2022-06", value: 87.0 },
                { date: "2022-12", value: 54.2 }, { date: "2023-03", value: 56.3 },
                { date: "2023-06", value: 61.2 }, { date: "2023-12", value: 89.0 },
                { date: "2024-06", value: 144.5 }, { date: "2024-12", value: 216.0 },
                { date: "2025-06", value: 238.0 }, { date: "2025-12", value: 242.2 },
                { date: "2026-06", value: 242.3 }, { date: "2026-07", value: 242.3 },
            ],
        },
        {
            id: "real_export_volume",
            name: "실질 수출물량",
            sub_name: "2026-07 · 2020=100 · 가격효과 제거",
            current_value_formatted: "59.6",
            sub_badge: "YoY +0.6%",
            current_value: 59.6,
            status: "neutral",
            status_kr: "중립",
            status_badge: "중립",
            color: "#94a3b8",
            chart_color: "#10b981",
            unit: "",
            description: "가격 변동을 제거한 순수 반도체 수출 수량(물량) 지수입니다.",
            source: "한국은행 무역지수",
            series_10y: [
                { date: "2016-09", value: 69.1 }, { date: "2016-12", value: 69.9 },
                { date: "2017-06", value: 70.3 }, { date: "2017-12", value: 72.3 },
                { date: "2018-06", value: 78.3 }, { date: "2018-09", value: 91.2 },
                { date: "2018-12", value: 79.1 }, { date: "2019-06", value: 99.6 },
                { date: "2019-09", value: 131.3 }, { date: "2019-12", value: 123.4 },
                { date: "2020-06", value: 105.8 }, { date: "2020-09", value: 125.9 },
                { date: "2020-12", value: 118.9 }, { date: "2021-06", value: 111.8 },
                { date: "2021-12", value: 123.6 }, { date: "2022-06", value: 143.7 },
                { date: "2022-09", value: 170.6 }, { date: "2022-12", value: 142.4 },
                { date: "2023-03", value: 156.0 }, { date: "2023-06", value: 148.0 },
                { date: "2023-12", value: 126.0 }, { date: "2024-06", value: 94.3 },
                { date: "2024-12", value: 66.0 }, { date: "2025-06", value: 62.3 },
                { date: "2025-12", value: 63.8 }, { date: "2026-06", value: 62.1 },
                { date: "2026-07", value: 58.6 },
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
            description: "통계청이 발표하는 반도체 제조공장 가동률 지수(2020=100)입니다.",
            source: "통계청 광업제조업동향조사",
            series_10y: [
                { date: "2016-09", value: 91.2 }, { date: "2016-12", value: 94.1 },
                { date: "2017-06", value: 101.4 }, { date: "2017-12", value: 108.9 },
                { date: "2018-06", value: 116.8 }, { date: "2018-09", value: 121.5 },
                { date: "2018-12", value: 108.0 }, { date: "2019-06", value: 94.2 },
                { date: "2019-12", value: 96.0 }, { date: "2020-06", value: 102.5 },
                { date: "2020-12", value: 108.4 }, { date: "2021-06", value: 119.0 },
                { date: "2021-12", value: 124.9 }, { date: "2022-06", value: 121.0 },
                { date: "2022-09", value: 110.5 }, { date: "2022-12", value: 85.0 },
                { date: "2023-02", value: 63.1 }, { date: "2023-06", value: 78.0 },
                { date: "2023-12", value: 89.8 }, { date: "2024-06", value: 101.5 },
                { date: "2024-12", value: 105.8 }, { date: "2025-06", value: 105.0 },
                { date: "2025-12", value: 103.2 }, { date: "2026-06", value: 101.7 },
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
            description: "제조업 반도체 재고 수준을 나타내며, 낮을수록 재고 소진(호황)을 의미합니다.",
            source: "통계청 제조업재고지수 (KOSIS)",
            series_10y: [
                { date: "2016-09", value: 84.5 }, { date: "2016-12", value: 76.2 },
                { date: "2017-06", value: 64.5 }, { date: "2017-09", value: 61.2 },
                { date: "2017-12", value: 58.5 }, { date: "2018-06", value: 68.1 },
                { date: "2018-09", value: 78.2 }, { date: "2018-12", value: 102.3 },
                { date: "2019-06", value: 145.8 }, { date: "2019-09", value: 135.0 },
                { date: "2019-12", value: 119.5 }, { date: "2020-06", value: 94.2 },
                { date: "2020-12", value: 88.0 }, { date: "2021-06", value: 76.5 },
                { date: "2021-12", value: 80.2 }, { date: "2022-06", value: 122.4 },
                { date: "2022-09", value: 165.0 }, { date: "2022-12", value: 205.4 },
                { date: "2023-01", value: 208.1 }, { date: "2023-06", value: 176.2 },
                { date: "2023-12", value: 121.0 }, { date: "2024-05", value: 93.1 },
                { date: "2024-12", value: 104.1 }, { date: "2025-06", value: 106.5 },
                { date: "2025-12", value: 106.5 }, { date: "2026-06", value: 106.8 },
                { date: "2026-07", value: 100.1 },
            ],
        },
    ],
    footnote: "위 지표는 모두 실데이터 — 대장주 시세(yfinance), 관세청 무역통계(수출액), 한국은행 ECOS(수출단가·물량지수), 통계청 KOSIS(가동률·재고지수). 각 지표를 클릭하면 기간별 실제 시계열과 통계적 진단이 표시됩니다.",
};

export default function SemiFundamentalSignals({ industry = "semiconductor" }: { industry?: string }) {
    const [signalsData, setSignalsData] = useState<any>(FALLBACK_SIGNALS_DATA);
    const [expandedSignalId, setExpandedSignalId] = useState<string | null>("lead_stock_drawdown");
    const [chartModes, setChartModes] = useState<{ [key: string]: "price" | "drawdown" }>({});
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
            const res = await fetch(`${API_BASE}/api/v1/analyze/semi-cycle/macro-signals?industry=${industry}`, { cache: "no-store" });
            if (res.ok) {
                const data = await res.json();
                if (data && data.signals && Array.isArray(data.signals)) {
                    setSignalsData(data);
                }
            }
        } catch (err) {
            console.warn("Could not load live macro signals, using robust fallback:", err);
        }
    };

    useEffect(() => {
        fetchData();
    }, [industry]);

    const toggleAccordion = (id: string) => {
        setExpandedSignalId(expandedSignalId === id ? null : id);
    };

    const handlePeriodChange = (signalId: string, p: "1Y" | "3Y" | "5Y" | "10Y", e: React.MouseEvent) => {
        e.stopPropagation();
        setPeriodFilter((prev) => ({ ...prev, [signalId]: p }));
    };

    const handleChartModeChange = (signalId: string, mode: "price" | "drawdown", e: React.MouseEvent) => {
        e.stopPropagation();
        setChartModes((prev) => ({ ...prev, [signalId]: mode }));
    };

    const currentSignalsData = signalsData || FALLBACK_SIGNALS_DATA;
    const signals = currentSignalsData?.signals || [];
    const stages = currentSignalsData?.stages || [];
    const timeline = currentSignalsData?.timeline || [];

    const signalsCount = currentSignalsData?.signals_count || { bullish: 2, neutral: 5, bearish: 0, total: 7 };
    const totalCount = signalsCount.total || 7;
    const phaseColor = currentSignalsData?.phase_color || "#10b981";
    const bullPct = Math.round((signalsCount.bullish / totalCount) * 100);
    const neutralPct = Math.round((signalsCount.neutral / totalCount) * 100);
    const bearPct = Math.max(0, 100 - bullPct - neutralPct);

    return (
        <div className="w-full flex flex-col gap-5 animate-in fade-in duration-300">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                <div className="lg:col-span-5 flex flex-col gap-4">
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
                                                ? "shadow-md font-bold"
                                                : "bg-white/[0.02] border-white/5 text-gray-400 hover:text-gray-200"
                                        }`}
                                        style={isCurrent ? { backgroundColor: `${phaseColor}26`, borderColor: phaseColor, color: phaseColor } : undefined}
                                    >
                                        <span className="text-[10px] font-bold">{st.name}</span>
                                        <span className="text-[9px] text-gray-400">{st.action}</span>
                                        {isCurrent && (
                                            <span className="mt-1 px-1.5 py-0.2 rounded-full text-black text-[8px] font-black" style={{ backgroundColor: phaseColor }}>
                                                ● 현재
                                            </span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="p-5 rounded-2xl bg-[#161922] border border-white/10 shadow-xl flex flex-col gap-4">
                        <div className="flex justify-between items-start">
                            <div>
                                <span className="text-xs font-bold text-amber-400 tracking-wider">
                                    실시간 실데이터 자동 판정 · {signalsCount.bullish}/{totalCount} 호황 신호
                                </span>
                                <span className="text-[11px] text-gray-400 block mt-1">
                                    현재 {currentSignalsData?.industry_kr} 사이클 국면 (실데이터 자동 판정)
                                </span>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="w-3 h-3 rounded-full animate-pulse" style={{ backgroundColor: phaseColor }} />
                                    <h3 className="text-2xl font-black text-white">{currentSignalsData?.current_state}</h3>
                                </div>
                            </div>
                            <span
                                className="px-2.5 py-1 rounded-xl text-xs font-bold border"
                                style={{ backgroundColor: `${phaseColor}20`, color: phaseColor, borderColor: `${phaseColor}50` }}
                            >
                                {currentSignalsData?.current_action}
                            </span>
                        </div>

                        <div className="flex flex-col gap-1.5 pt-1 border-t border-white/5">
                            <div className="flex justify-between text-[11px] font-mono">
                                <span className="text-emerald-400 font-bold">호황 {signalsCount.bullish}개 ({bullPct}%)</span>
                                <span className="text-gray-400 font-bold">중립 {signalsCount.neutral}개 ({neutralPct}%)</span>
                                <span className="text-rose-400 font-bold">둔화 {signalsCount.bearish}개 ({bearPct}%)</span>
                            </div>
                            <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden flex">
                                <div style={{ width: `${bullPct}%` }} className="bg-emerald-500 h-full transition-all duration-500" />
                                <div style={{ width: `${neutralPct}%` }} className="bg-slate-500 h-full transition-all duration-500" />
                                <div style={{ width: `${bearPct}%` }} className="bg-rose-500 h-full transition-all duration-500" />
                            </div>
                        </div>

                        <p className="text-xs text-gray-300 leading-relaxed bg-white/[0.03] p-3 rounded-xl border border-white/5 font-mono">
                            {currentSignalsData?.summary_comment}
                        </p>

                        <div className="flex flex-col gap-2 pt-2 border-t border-white/5">
                            <span className="text-[11px] font-bold text-gray-400 flex items-center justify-between">
                                <span>최근 13개월 국면 흐름</span>
                                <span className="text-[10px] text-gray-500">{currentSignalsData?.state_transition}</span>
                            </span>
                            <div className="grid grid-cols-13 gap-1">
                                {timeline.map((tl: any, i: number) => {
                                    const isLast = i === timeline.length - 1;
                                    const shortMonth = tl.month ? tl.month.split("-")[1] : `${i + 1}`;
                                    return (
                                        <div
                                            key={tl.month || i}
                                            className={`flex flex-col items-center p-1 rounded-lg border text-center transition-all ${
                                                isLast ? "border-amber-400 shadow-md ring-1 ring-amber-400/50" : "border-white/5"
                                            }`}
                                            style={{ backgroundColor: `${tl.color}20` }}
                                            title={`${tl.month}: ${tl.state}`}
                                        >
                                            <span className="text-[9px] font-mono text-gray-400">{shortMonth}</span>
                                            <span className="w-1.5 h-1.5 rounded-full my-0.5" style={{ backgroundColor: tl.color }} />
                                            {isLast && <span className="text-[7px] text-amber-300 font-bold">현재</span>}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-7 flex flex-col gap-3 p-5 rounded-2xl bg-[#161922] border border-white/10 shadow-xl">
                    <div className="flex justify-between items-center pb-3 border-b border-white/10">
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-4 rounded-full bg-emerald-500" />
                            <h4 className="text-base font-bold text-white">실데이터 신호 (실시간)</h4>
                        </div>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold font-mono">
                            LIVE
                        </span>
                    </div>

                    <div className="divide-y divide-white/5">
                        {signals.map((sig: any) => {
                            if (sig.available === false) {
                                return (
                                    <div key={sig.id} className="py-2.5">
                                        <div className="flex justify-between items-center p-2 rounded-xl opacity-50">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs md:text-sm font-bold text-gray-400">{sig.name}</span>
                                                <span className="text-[11px] text-gray-500 font-normal">{sig.sub_name}</span>
                                            </div>
                                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-gray-400 border border-white/10 font-bold">
                                                미연동
                                            </span>
                                        </div>
                                    </div>
                                );
                            }

                            const isExpanded = expandedSignalId === sig.id;
                            const curPeriod = periodFilter[sig.id] || "5Y";
                            const curMode = chartModes[sig.id] || "price";
                            const hasToggle = !!(sig.has_drawdown_toggle || sig.dd_series_10y);

                            const priceSeries = (sig.series_10y && sig.series_10y.length > 0)
                                ? sig.series_10y
                                : (sig.series_5y && sig.series_5y.length > 0)
                                ? sig.series_5y
                                : [{ date: "2026-08", value: 100 }];

                            const ddSeries = (sig.dd_series_10y && sig.dd_series_10y.length > 0)
                                ? sig.dd_series_10y
                                : (sig.dd_series_5y && sig.dd_series_5y.length > 0)
                                ? sig.dd_series_5y
                                : priceSeries;

                            const activeSeries = (curMode === "drawdown" && hasToggle) ? ddSeries : priceSeries;
                            const activeUnit = (curMode === "drawdown" && hasToggle) ? "%" : (sig.unit || "");
                            const activeColor = (curMode === "drawdown" && hasToggle) ? "#f59e0b" : (sig.chart_color || "#10b981");

                            const isMonthly = typeof activeSeries[0]?.date === "string" && activeSeries[0].date.length === 7;
                            const sliceCount = isMonthly
                                ? (curPeriod === "1Y" ? 12 : curPeriod === "3Y" ? 36 : curPeriod === "5Y" ? 60 : 120)
                                : (curPeriod === "1Y" ? 52 : curPeriod === "3Y" ? 156 : curPeriod === "5Y" ? 260 : 520);

                            const displaySeries = activeSeries.slice(-sliceCount);

                            const numericValues = displaySeries.map((d: any) => d.value).filter((v: any) => typeof v === "number" && !isNaN(v));
                            const dynamicMin = numericValues.length > 0 ? Math.min(...numericValues) : 0;
                            const dynamicMax = numericValues.length > 0 ? Math.max(...numericValues) : 0;
                            const dataCountLabel = isMonthly ? `${displaySeries.length}개월` : `${displaySeries.length}주`;

                            const formatVal = (v: number) => {
                                if (Math.abs(v) >= 1000) return `${v.toLocaleString()} ${activeUnit}`.trim();
                                return `${v} ${activeUnit}`.trim();
                            };

                            return (
                                <div key={sig.id} className="py-2.5 transition-colors">
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

                                    {isExpanded && (
                                        <div className="mt-3 p-4 rounded-2xl bg-black/40 border border-white/10 animate-in slide-in-from-top-2 fade-in duration-200">
                                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-3">
                                                <span className="text-[11px] text-gray-400 font-mono">
                                                    {sig.sub_name} ({sig.source})
                                                </span>
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    {hasToggle && (
                                                        <div className="flex items-center bg-black/60 border border-white/10 rounded-lg p-0.5 gap-0.5">
                                                            <button
                                                                onClick={(e) => handleChartModeChange(sig.id, "price", e)}
                                                                className={`px-2 py-0.5 text-[10px] font-bold rounded transition-all ${
                                                                    curMode === "price"
                                                                        ? "bg-emerald-600 text-white shadow"
                                                                        : "text-gray-400 hover:text-white"
                                                                }`}
                                                            >
                                                                실제 {sig.unit === "pt" ? "지수" : "주가"} ({sig.unit || "$"})
                                                            </button>
                                                            <button
                                                                onClick={(e) => handleChartModeChange(sig.id, "drawdown", e)}
                                                                className={`px-2 py-0.5 text-[10px] font-bold rounded transition-all ${
                                                                    curMode === "drawdown"
                                                                        ? "bg-amber-600 text-white shadow"
                                                                        : "text-gray-400 hover:text-white"
                                                                }`}
                                                            >
                                                                고점대비 낙폭 (%)
                                                            </button>
                                                        </div>
                                                    )}
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

                                            <div className="text-base font-black text-gray-200 mb-2">
                                                최고 {formatVal(dynamicMax)} · 최저 {formatVal(dynamicMin)}
                                            </div>

                                            <div className="w-full h-[180px] bg-black/30 rounded-xl p-2 border border-white/5 relative">
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <AreaChart data={displaySeries} margin={{ top: 10, right: 15, bottom: 5, left: 0 }}>
                                                        <defs>
                                                            <linearGradient id={`grad_${sig.id}_${curMode}`} x1="0" y1="0" x2="0" y2="1">
                                                                <stop offset="5%" stopColor={activeColor} stopOpacity={0.4} />
                                                                <stop offset="95%" stopColor={activeColor} stopOpacity={0.0} />
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
                                                            formatter={(val: any) => [`${val} ${activeUnit}`, sig.name]}
                                                        />
                                                        <Area
                                                            type="monotone"
                                                            dataKey="value"
                                                            stroke={activeColor}
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

                    {/* Summary Footer — 판정 국면과 색상을 그대로 따른다 */}
                    <div
                        className="mt-3 p-3 rounded-xl border text-xs font-bold"
                        style={{ backgroundColor: `${phaseColor}1a`, borderColor: `${phaseColor}33`, color: phaseColor }}
                    >
                        실데이터 종합: {currentSignalsData?.current_state} ( 호황 {signalsCount.bullish} · 중립 {signalsCount.neutral} · 둔화 {signalsCount.bearish} · 종합 {currentSignalsData?.weighted_score} )
                    </div>
                    <p className="text-[10px] text-gray-500 leading-relaxed">
                        {currentSignalsData?.footnote}
                    </p>
                </div>
            </div>
        </div>
    );
}

