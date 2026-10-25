// 포트폴리오(My 계좌 및 TFF 공동펀드)의 6대 수출 주력 산업군 실질 노출도 및 경기 적합도를 시각화하는 공용 벤토 위젯
"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
    Ship,
    TrendingUp,
    ShieldCheck,
    AlertTriangle,
    RefreshCw,
    Sparkles,
    CheckCircle2,
    BarChart3,
    Compass,
    Layers,
    Info,
    ExternalLink
} from "lucide-react";

interface IndustryExposureItem {
    id: string;
    name: string;
    color: string;
    desc: string;
    weight: number;
    eval_amt: number;
    is_top_industry: boolean;
}

interface ExportExposureData {
    total_eval_amt: number;
    industry_exposures: IndustryExposureItem[];
    top_industry_id: string;
    top_industry_name: string;
    top_industry_share: number;
    top_industry_exposure: number;
    total_export_exposure: number;
    domestic_other_exposure: number;
    fit_score: number;
    status_level: "HIGH" | "BALANCED" | "UNDERWEIGHT" | "NEUTRAL";
    status_title: string;
    cycle_phase: string;
    comment: string;
    source: string;
    is_demo_fallback?: boolean;
}

interface ExportExposureWidgetProps {
    source?: "my" | "tff" | "custom";
    holdings?: any[];
    title?: string;
    subtitle?: string;
    className?: string;
}

export default function ExportExposureWidget({
    source = "my",
    holdings,
    title,
    subtitle,
    className = ""
}: ExportExposureWidgetProps) {
    const [data, setData] = useState<ExportExposureData | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [refreshing, setRefreshing] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const isCloud = typeof window !== "undefined" && (window.location.hostname.includes("onrender.com") || window.location.hostname.includes("vercel.app"));
    const API_BASE = isCloud ? "https://etf-lens.onrender.com" : "http://localhost:8000";

    const fetchExposureData = useCallback(async (isRefresh: boolean = false) => {
        try {
            if (isRefresh) setRefreshing(true);
            else setLoading(true);
            setError(null);

            let res: Response;
            if (holdings && Array.isArray(holdings) && holdings.length > 0) {
                // 커스텀 holdings 주입 시 POST 호출
                res = await fetch(`${API_BASE}/api/v1/macro/portfolio-export-exposure`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        holdings: holdings.map(h => ({
                            code: h.code || h.ticker || "",
                            name: h.name || "",
                            eval_amt: h.eval_amt || h.eval_amount || h.endValue || h.evaluation || 0
                        })),
                        source
                    })
                });
            } else {
                // 기본 소스 기반 GET 호출
                res = await fetch(`${API_BASE}/api/v1/macro/portfolio-export-exposure?source=${source}`, {
                    cache: "no-store",
                    headers: { "Cache-Control": "no-cache" }
                });
            }

            if (res.ok) {
                const json = await res.json();
                setData(json);
            } else {
                setError("수출 노출도 데이터를 불러오지 못했습니다.");
            }
        } catch (err) {
            setError("네트워크 연결 상태를 확인해주세요.");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [API_BASE, holdings, source]);

    useEffect(() => {
        fetchExposureData(false);
    }, [fetchExposureData]);

    const defaultTitle = source === "tff"
        ? "TFF 펀드 실질 수출 수혜 노출도 & 경기 적합도"
        : "내 포트폴리오 실질 수출 수혜 노출도 & 경기 적합도";

    const defaultSubtitle = source === "tff"
        ? "TFF 공동 펀드 자산의 6대 수출 주력 산업군 실질 투시 비중 및 통계청 경기 국면 연동 진단"
        : "실보유 KIS 포트폴리오의 국가 수출 1위 주력군 수혜 흡수율 및 매크로 사이클 적합도 분석";

    const displayTitle = title || defaultTitle;
    const displaySubtitle = subtitle || defaultSubtitle;

    if (loading) {
        return (
            <div className={`w-full bg-[#121217]/80 border border-white/10 rounded-2xl p-5 backdrop-blur-md shadow-xl flex items-center justify-center min-h-[200px] ${className}`}>
                <div className="flex flex-col items-center gap-2.5 text-xs text-gray-400">
                    <RefreshCw className="w-5 h-5 text-indigo-400 animate-spin" />
                    <span>실질 수출 수혜 노출도 분석 중...</span>
                </div>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className={`w-full bg-[#121217]/80 border border-white/10 rounded-2xl p-5 backdrop-blur-md shadow-xl ${className}`}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-rose-400 text-xs">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        <span>{error || "데이터가 없습니다."}</span>
                    </div>
                    <button
                        onClick={() => fetchExposureData(true)}
                        className="px-2.5 py-1 text-xs rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300"
                    >
                        다시 시도
                    </button>
                </div>
            </div>
        );
    }

    const {
        total_eval_amt,
        industry_exposures,
        top_industry_name,
        top_industry_share,
        top_industry_exposure,
        total_export_exposure,
        domestic_other_exposure,
        fit_score,
        status_level,
        status_title,
        cycle_phase,
        comment,
        is_demo_fallback
    } = data;

    // 배지 컬러 매핑
    const statusBg = status_level === "HIGH"
        ? "bg-blue-500/15 border-blue-400/30 text-blue-300"
        : status_level === "BALANCED"
        ? "bg-emerald-500/15 border-emerald-400/30 text-emerald-300"
        : "bg-amber-500/15 border-amber-400/30 text-amber-300";

    const scoreColor = fit_score >= 80 ? "text-emerald-400" : fit_score >= 65 ? "text-indigo-400" : "text-amber-400";
    const scoreBg = fit_score >= 80 ? "bg-emerald-500/10 border-emerald-500/20" : fit_score >= 65 ? "bg-indigo-500/10 border-indigo-500/20" : "bg-amber-500/10 border-amber-500/20";

    return (
        <div className={`w-full bg-[#121217]/80 border border-white/10 rounded-2xl p-4 lg:p-5 backdrop-blur-md shadow-xl flex flex-col gap-4 ${className}`}>
            {/* 상단 헤더 행 */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/5">
                <div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <div className="p-1.5 rounded-lg bg-gradient-to-br from-blue-500/20 to-indigo-500/20 border border-blue-400/20 text-blue-400">
                            <Ship className="w-4 h-4" />
                        </div>
                        <h3 className="text-base font-bold text-white flex items-center gap-2">
                            <span>{displayTitle}</span>
                        </h3>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap flex items-center gap-1 ${statusBg}`}>
                            <CheckCircle2 className="w-3 h-3 shrink-0" />
                            {status_title}
                        </span>
                        {is_demo_fallback && (
                            <span className="text-[10px] text-gray-400 font-mono bg-white/5 px-1.5 py-0.5 rounded border border-white/10">
                                포트폴리오 연동 모드
                            </span>
                        )}
                    </div>
                    <p className="text-[11px] text-gray-400 mt-1">
                        {displaySubtitle}
                    </p>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                    <span className="text-[10px] font-medium text-gray-400 bg-white/5 px-2 py-1 rounded-lg border border-white/5 whitespace-nowrap">
                        현재 경기 {cycle_phase.split(" ")[0]}
                    </span>
                    <button
                        onClick={() => fetchExposureData(true)}
                        disabled={refreshing}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 active:scale-95 border border-white/10 text-xs text-gray-300 transition-all disabled:opacity-50"
                        title="수출 노출도 새로고침"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-indigo-400" : ""}`} />
                        <span className="text-[11px]">{refreshing ? "계산 중..." : "새로고침"}</span>
                    </button>
                </div>
            </div>

            {/* 3 Bento 핵심 KPI 카드 */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* 1. 1위 주력군 노출도 */}
                <div className="p-3.5 rounded-xl border border-white/10 bg-white/[0.02] flex flex-col justify-between">
                    <div className="flex items-center justify-between text-xs text-gray-400">
                        <span>수출 1위 주력군 ({top_industry_name})</span>
                        <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                    </div>
                    <div className="mt-2 flex items-baseline gap-2">
                        <span className="text-2xl font-extrabold text-blue-400 font-mono">
                            {top_industry_exposure.toFixed(1)}%
                        </span>
                        <span className="text-[10px] text-gray-400">
                            (국가 점유율 {top_industry_share.toFixed(1)}%)
                        </span>
                    </div>
                    <div className="mt-2 w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(100, top_industry_exposure * 2)}%` }}
                        />
                    </div>
                </div>

                {/* 2. 6대 주력군 총 수출 노출도 */}
                <div className="p-3.5 rounded-xl border border-white/10 bg-white/[0.02] flex flex-col justify-between">
                    <div className="flex items-center justify-between text-xs text-gray-400">
                        <span>6대 주력군 총 수출 비중</span>
                        <TrendingUp className="w-3.5 h-3.5 text-indigo-400" />
                    </div>
                    <div className="mt-2 flex items-baseline gap-2">
                        <span className="text-2xl font-extrabold text-indigo-300 font-mono">
                            {total_export_exposure.toFixed(1)}%
                        </span>
                        <span className="text-[10px] text-gray-400">
                            (내수·기타 {domestic_other_exposure.toFixed(1)}%)
                        </span>
                    </div>
                    <div className="mt-2 w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(100, total_export_exposure)}%` }}
                        />
                    </div>
                </div>

                {/* 3. 경기 국면 적합도 점수 */}
                <div className="p-3.5 rounded-xl border border-white/10 bg-white/[0.02] flex flex-col justify-between">
                    <div className="flex items-center justify-between text-xs text-gray-400">
                        <span>경기 국면 적합도 (Fit Score)</span>
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    </div>
                    <div className="mt-2 flex items-baseline gap-2">
                        <span className={`text-2xl font-extrabold font-mono ${scoreColor}`}>
                            {fit_score}
                        </span>
                        <span className="text-xs text-gray-400 font-medium">/ 100점</span>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ml-auto ${scoreBg} ${scoreColor}`}>
                            {fit_score >= 80 ? "최적 배분" : fit_score >= 65 ? "양호" : "주의"}
                        </span>
                    </div>
                    <div className="mt-2 w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all duration-500 ${
                                fit_score >= 80 ? "bg-emerald-400" : fit_score >= 65 ? "bg-indigo-400" : "bg-amber-400"
                            }`}
                            style={{ width: `${fit_score}%` }}
                        />
                    </div>
                </div>
            </div>

            {/* 6대 업종별 실질 비중 멀티 프로그레스 바 & 세부 리스트 */}
            <div className="p-3.5 rounded-xl border border-white/5 bg-white/[0.015] flex flex-col gap-3">
                <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-300 font-semibold flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-gray-400" />
                        6대 수출 산업군 실질 분해 비중
                    </span>
                    <span className="text-gray-500 font-mono text-[11px]">
                        기준 자산: 약 {(total_eval_amt / 100000000).toFixed(2)}억 원
                    </span>
                </div>

                {/* 멀티 프로그레스 스택 바 */}
                <div className="w-full h-3 rounded-full bg-white/5 flex overflow-hidden border border-white/5 p-0.5 gap-0.5">
                    {industry_exposures.map(ind => (
                        ind.weight > 0 ? (
                            <div
                                key={ind.id}
                                className="h-full rounded-sm transition-all duration-500 first:rounded-l-full last:rounded-r-full"
                                style={{
                                    width: `${ind.weight}%`,
                                    backgroundColor: ind.color
                                }}
                                title={`${ind.name}: ${ind.weight.toFixed(1)}%`}
                            />
                        ) : null
                    ))}
                    {domestic_other_exposure > 0 && (
                        <div
                            className="h-full rounded-sm bg-gray-600/40 rounded-r-full transition-all duration-500"
                            style={{ width: `${domestic_other_exposure}%` }}
                            title={`내수·채권·기타: ${domestic_other_exposure.toFixed(1)}%`}
                        />
                    )}
                </div>

                {/* 6대 업종별 칩 그리드 */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 pt-1">
                    {industry_exposures.map(ind => (
                        <div
                            key={ind.id}
                            className="p-2 rounded-lg border border-white/5 bg-white/[0.01] flex flex-col justify-between"
                        >
                            <div className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: ind.color }} />
                                <span className="text-[11px] text-gray-300 font-medium truncate">{ind.name}</span>
                            </div>
                            <div className="mt-1 flex items-baseline justify-between">
                                <span className="text-xs font-bold text-white font-mono">
                                    {ind.weight.toFixed(1)}%
                                </span>
                                {ind.is_top_industry && (
                                    <span className="text-[9px] font-bold text-blue-400 bg-blue-500/10 px-1 py-0.2 rounded">
                                        1위
                                    </span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* 하단 전문가 진단 및 처방 코멘트 */}
            <div className="p-3 rounded-xl border border-indigo-500/20 bg-indigo-500/[0.04] flex items-start gap-2.5 text-xs leading-relaxed text-indigo-200/90">
                <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                    <span className="font-bold text-white mr-1.5">💡 거시 수출 연동 자산배분 진단</span>
                    <span>{comment}</span>
                </div>
            </div>

            {/* 데이터 소스 명기 */}
            <div className="mt-1 flex items-center justify-between text-[9px] text-gray-500 font-mono px-1">
                <span>* ETF 구성종목(PDF) 가중치 분해 기반 추정치</span>
                <span>출처: 관세청 품목별 수출입통계 · 통계청 경기선행지수 · FnGuide PDF</span>
            </div>
        </div>
    );
}
