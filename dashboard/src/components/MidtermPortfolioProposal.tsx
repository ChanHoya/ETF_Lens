"use client";
// 미국 2026 중간선거 시나리오별 포트폴리오 맞춤 리밸런싱 제안 위젯

import React, { useState, useEffect } from "react";
import {
    Vote,
    Scale,
    TrendingUp,
    ShieldAlert,
    CheckCircle2,
    ArrowRight,
    Sparkles,
    AlertCircle,
    RefreshCw,
    PieChart,
    ExternalLink
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface MidtermProposalProps {
    onNavigateMidterm?: () => void;
}

export default function MidtermPortfolioProposal({ onNavigateMidterm }: MidtermProposalProps) {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [refreshing, setRefreshing] = useState<boolean>(false);

    const fetchProposal = async (isManual: boolean = false) => {
        try {
            if (isManual) setRefreshing(true);
            else setLoading(true);

            const res = await fetch(`${API_BASE}/api/v1/midterm/my-rebalance-proposal`);
            if (res.ok) {
                const json = await res.json();
                setData(json);
            }
        } catch (err) {
            console.error("Failed to load midterm portfolio proposal:", err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchProposal(false);
    }, []);

    const cur = data?.current_weights || { tech_weight: 58.4, dividend_weight: 26.6, safe_weight: 15.0 };
    const tgt = data?.target_weights || { tech_weight: 38.0, dividend_weight: 42.0, safe_weight: 20.0 };
    const trimPct = data?.trim_recommended_pct || Math.max(0, cur.tech_weight - tgt.tech_weight);
    const isWarning = data?.midterm_diagnosis?.status === "warning" || cur.tech_weight > 50;

    const handleGoToMidtermTab = () => {
        if (onNavigateMidterm) {
            onNavigateMidterm();
        } else {
            // URL 파라미터나 hash 변경 또는 이벤트 디스패치
            const event = new CustomEvent("switch-dashboard-tab", { detail: { tab: "us_midterm" } });
            window.dispatchEvent(event);
        }
    };

    return (
        <div className="w-full bg-[#121217]/70 border border-white/10 rounded-3xl p-5 md:p-7 backdrop-blur-md shadow-xl flex flex-col gap-6 mt-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-2xl bg-rose-500/20 border border-rose-500/30 text-rose-400">
                        <Vote className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-lg md:text-xl font-bold text-white flex items-center gap-2">
                                나의 포트폴리오 중간선거 대응 리밸런싱 제안
                            </h3>
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                2026.11 D-Day 연동
                            </span>
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">
                            보유 계좌의 기술주 쏠림도를 진단하고, 분점정부(Gridlock) 시나리오에 맞춘 안전 헤지 및 배당 이전 전략을 제안합니다.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => fetchProposal(true)}
                        disabled={refreshing}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 active:scale-95 border border-white/10 text-xs font-semibold text-gray-300 transition-all"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 text-indigo-400 ${refreshing ? "animate-spin" : ""}`} />
                        <span>{refreshing ? "진단 중..." : "Update"}</span>
                    </button>
                    <button
                        onClick={handleGoToMidtermTab}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-xs font-bold text-white transition-all shadow-md"
                    >
                        <span>중간선거 분석실</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>

            {/* Diagnostic Banner */}
            <div
                className={`rounded-2xl p-5 border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                    isWarning
                        ? "bg-gradient-to-r from-rose-950/30 to-amber-950/20 border-rose-500/30"
                        : "bg-emerald-950/20 border-emerald-500/30"
                }`}
            >
                <div className="flex items-start gap-3">
                    <div
                        className={`p-2 rounded-xl shrink-0 mt-0.5 ${
                            isWarning ? "bg-rose-500/20 text-rose-400" : "bg-emerald-500/20 text-emerald-400"
                        }`}
                    >
                        {isWarning ? <ShieldAlert className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
                    </div>
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span
                                className={`text-xs font-bold px-2 py-0.5 rounded ${
                                    isWarning ? "bg-rose-500/20 text-rose-400" : "bg-emerald-500/20 text-emerald-400"
                                }`}
                            >
                                {isWarning ? "진단: 기술주 집중 위험 노출" : "진단: 양호한 배분 상태"}
                            </span>
                            <span className="text-xs text-gray-400 font-mono">
                                (현재 기술주 비중: {cur.tech_weight.toFixed(1)}%)
                            </span>
                        </div>
                        <p className="text-xs md:text-sm text-gray-200 leading-relaxed">
                            {data?.midterm_diagnosis?.summary ||
                                "11월 중간선거 전후 대외 관세·통상 제재로 인한 기술주 하방 변동성에 대비하여 고평가 하드웨어 차익실현 및 배당성장/국채 자산 배분을 권고합니다."}
                        </p>
                    </div>
                </div>

                {trimPct > 0 && (
                    <div className="shrink-0 text-right bg-black/40 px-4 py-2.5 rounded-xl border border-rose-500/20">
                        <span className="text-[10px] text-gray-400 block font-semibold">권고 차익실현(Trim) 비중</span>
                        <span className="text-xl font-black text-rose-400 font-mono">
                            약 -{trimPct.toFixed(1)}%p
                        </span>
                    </div>
                )}
            </div>

            {/* Current vs Target Comparison Bars */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Current */}
                <div className="bg-[#181a26]/70 border border-white/10 rounded-2xl p-5 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-bold text-gray-400">내 보유 포트폴리오 현재 비중</span>
                            <span className="text-[10px] font-mono text-gray-500">실시간 KIS 계좌 연동</span>
                        </div>
                        <div className="flex flex-col gap-2.5">
                            <div>
                                <div className="flex justify-between text-xs mb-1">
                                    <span className="text-rose-400 font-bold">성장 기술주 (AI/빅테크/반도체)</span>
                                    <span className="font-mono font-bold text-white">{cur.tech_weight.toFixed(1)}%</span>
                                </div>
                                <div className="w-full h-2.5 bg-black/50 rounded-full overflow-hidden">
                                    <div
                                        style={{ width: `${Math.min(100, cur.tech_weight)}%` }}
                                        className="h-full bg-rose-500 transition-all duration-500"
                                    />
                                </div>
                            </div>

                            <div>
                                <div className="flex justify-between text-xs mb-1">
                                    <span className="text-indigo-400 font-bold">인컴/배당 자산 (SCHD, 커버드콜)</span>
                                    <span className="font-mono font-bold text-white">{cur.dividend_weight.toFixed(1)}%</span>
                                </div>
                                <div className="w-full h-2.5 bg-black/50 rounded-full overflow-hidden">
                                    <div
                                        style={{ width: `${Math.min(100, cur.dividend_weight)}%` }}
                                        className="h-full bg-indigo-500 transition-all duration-500"
                                    />
                                </div>
                            </div>

                            <div>
                                <div className="flex justify-between text-xs mb-1">
                                    <span className="text-emerald-400 font-bold">안전/채권 자산 (미국채, 현금)</span>
                                    <span className="font-mono font-bold text-white">{cur.safe_weight.toFixed(1)}%</span>
                                </div>
                                <div className="w-full h-2.5 bg-black/50 rounded-full overflow-hidden">
                                    <div
                                        style={{ width: `${Math.min(100, cur.safe_weight)}%` }}
                                        className="h-full bg-emerald-500 transition-all duration-500"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="mt-4 pt-3 border-t border-white/5 text-[11px] text-gray-400">
                        기술주 비중이 50%를 초과할 경우 선거 전 8~10월의 계절적 조정 국면(-7.8%)에 취약합니다.
                    </div>
                </div>

                {/* Target */}
                <div className="bg-gradient-to-br from-[#1b1e33] to-[#141624] border border-indigo-500/30 rounded-2xl p-5 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-bold text-indigo-300">선거 대응 Core-Satellite 목표 비중</span>
                            <span className="text-[10px] font-mono text-indigo-400 font-bold">Gridlock 최적 배분</span>
                        </div>
                        <div className="flex flex-col gap-2.5">
                            <div>
                                <div className="flex justify-between text-xs mb-1">
                                    <span className="text-indigo-300 font-bold">핵심 성장 자산 (빅테크 플랫폼 위주)</span>
                                    <span className="font-mono font-bold text-white">{tgt.tech_weight.toFixed(1)}% (목표)</span>
                                </div>
                                <div className="w-full h-2.5 bg-black/50 rounded-full overflow-hidden">
                                    <div
                                        style={{ width: `${tgt.tech_weight}%` }}
                                        className="h-full bg-indigo-500 transition-all duration-500"
                                    />
                                </div>
                            </div>

                            <div>
                                <div className="flex justify-between text-xs mb-1">
                                    <span className="text-purple-300 font-bold">인컴/배당 자산 (SCHD, 배당성장)</span>
                                    <span className="font-mono font-bold text-white">{tgt.dividend_weight.toFixed(1)}% (목표)</span>
                                </div>
                                <div className="w-full h-2.5 bg-black/50 rounded-full overflow-hidden">
                                    <div
                                        style={{ width: `${tgt.dividend_weight}%` }}
                                        className="h-full bg-purple-500 transition-all duration-500"
                                    />
                                </div>
                            </div>

                            <div>
                                <div className="flex justify-between text-xs mb-1">
                                    <span className="text-emerald-300 font-bold">안전자산 (미국 중장기 국채 TLT)</span>
                                    <span className="font-mono font-bold text-white">{tgt.safe_weight.toFixed(1)}% (목표)</span>
                                </div>
                                <div className="w-full h-2.5 bg-black/50 rounded-full overflow-hidden">
                                    <div
                                        style={{ width: `${tgt.safe_weight}%` }}
                                        className="h-full bg-emerald-500 transition-all duration-500"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="mt-4 pt-3 border-t border-white/5 text-[11px] text-indigo-300/80">
                        선거 후 12개월 안도 랠리(+15.1%) 상승 탄력은 플랫폼 테크로 유지하면서 하방을 배당·채권으로 단단히 방어합니다.
                    </div>
                </div>
            </div>

            {/* 3 Step Rebalancing Action Grid */}
            <div>
                <h4 className="text-sm font-bold text-gray-300 mb-3 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-indigo-400" />
                    중간선거 승률 94.7% 플레이북 맞춤 3대 액션 플랜
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="bg-[#151722] border border-white/5 rounded-2xl p-4 flex flex-col justify-between">
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                                    1. Trim (차익실현)
                                </span>
                                <span className="text-[10px] text-gray-500">선거 전 8~10월</span>
                            </div>
                            <h5 className="text-xs font-bold text-white mb-1.5">
                                AI 하드웨어 비중 약 {trimPct.toFixed(1)}%p 분할 익절
                            </h5>
                            <p className="text-[11px] text-gray-400 leading-relaxed">
                                관세 분쟁과 단기 밸류에이션 부담이 큰 고변동성 반도체/하드웨어 종목을 5~10% 단위로 분할 매도하여 현금 및 인컴 자금 확보.
                            </p>
                        </div>
                    </div>

                    <div className="bg-[#151722] border border-white/5 rounded-2xl p-4 flex flex-col justify-between">
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                                    2. Rotate (자산 이동)
                                </span>
                                <span className="text-[10px] text-gray-500">포트폴리오 교체</span>
                            </div>
                            <h5 className="text-xs font-bold text-white mb-1.5">
                                플랫폼 빅테크(MSFT) & 배당성장(SCHD) 매수
                            </h5>
                            <p className="text-[11px] text-gray-400 leading-relaxed">
                                신규 빅테크 규제 법안 통과가 제동 걸리는 분점정부 수혜 플랫폼과 연 3.5%+ 복리 배당 자산으로 이전해 하방 경직성 확보.
                            </p>
                        </div>
                    </div>

                    <div className="bg-[#151722] border border-white/5 rounded-2xl p-4 flex flex-col justify-between">
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                                    3. Shield (국채 방어)
                                </span>
                                <span className="text-[10px] text-gray-500">안전자산 편입</span>
                            </div>
                            <h5 className="text-xs font-bold text-white mb-1.5">
                                미국 중장기 국채(TLT/IEF) 비중 20% 채우기
                            </h5>
                            <p className="text-[11px] text-gray-400 leading-relaxed">
                                입법 교착으로 재정적자 폭증이 억제될 때 국채 금리 하향 안정에 따른 채권 가격 상승 및 위기 시 달러 안전자산 차익 추구.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
