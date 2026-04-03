"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useCallback } from "react";
import { API_BASE } from "@/lib/apiConfig";

type RiskBannerProps = {
    isAuthorized: boolean;
};

const LEVEL_STYLES: Record<string, { bg: string; border: string; text: string; badge: string }> = {
    safe:    { bg: "bg-emerald-500/10", border: "border-emerald-500/30", text: "text-emerald-300", badge: "bg-emerald-500/20 text-emerald-300" },
    caution: { bg: "bg-yellow-500/10",  border: "border-yellow-500/30",  text: "text-yellow-300",  badge: "bg-yellow-500/20 text-yellow-300"  },
    warning: { bg: "bg-orange-500/10",  border: "border-orange-500/30",  text: "text-orange-300",  badge: "bg-orange-500/20 text-orange-300"  },
    danger:  { bg: "bg-red-500/10",     border: "border-red-500/30",     text: "text-red-300",     badge: "bg-red-500/20 text-red-300"         },
    unknown: { bg: "bg-gray-500/10",    border: "border-gray-500/30",    text: "text-gray-400",    badge: "bg-gray-500/20 text-gray-400"       },
};

const SCORE_BAR_COLOR: Record<string, string> = {
    safe: "bg-emerald-500", caution: "bg-yellow-500", warning: "bg-orange-500", danger: "bg-red-500", unknown: "bg-gray-500",
};

export default function RiskBanner({ isAuthorized }: RiskBannerProps) {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [expanded, setExpanded] = useState(false);

    const fetchRisk = useCallback(async () => {
        if (!isAuthorized) return;
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/api/v1/my/risk-summary`);
            if (res.ok) setData(await res.json());
        } catch (e) {
            console.warn("risk-summary 조회 실패:", e);
        } finally {
            setLoading(false);
        }
    }, [isAuthorized]);

    useEffect(() => { fetchRisk(); }, [fetchRisk]);

    if (!isAuthorized) return null;
    if (loading && !data) {
        return (
            <div className="w-full rounded-2xl border border-white/10 bg-white/[0.02] p-4 animate-pulse">
                <div className="h-4 w-48 bg-white/10 rounded mb-2" />
                <div className="h-3 w-72 bg-white/5 rounded" />
            </div>
        );
    }
    if (!data) return null;

    const risk = data.risk ?? {};
    const guide = data.guide ?? {};
    const summary = data.holdings_summary ?? {};
    const breakdown = risk.breakdown ?? {};
    const level = risk.level ?? "unknown";
    const style = LEVEL_STYLES[level] ?? LEVEL_STYLES.unknown;
    const barColor = SCORE_BAR_COLOR[level] ?? "bg-gray-500";
    const scorePercent = Math.round(((risk.score ?? 0) / (risk.max_score ?? 12)) * 100);

    return (
        <div className={`w-full rounded-2xl border ${style.border} ${style.bg} backdrop-blur-md overflow-hidden transition-all duration-300`}>
            {/* ── 헤더 (항상 표시) ────────────────────────────── */}
            <button
                onClick={() => setExpanded(v => !v)}
                className="w-full p-4 flex items-center justify-between text-left"
            >
                <div className="flex items-center gap-3">
                    <span className="text-xl">{guide.emoji ?? "⚪"}</span>
                    <div>
                        <div className="flex items-center gap-2 mb-0.5">
                            <span className={`font-bold text-sm ${style.text}`}>{guide.title}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${style.badge}`}>
                                {risk.label ?? "-"} (점수 {risk.score ?? 0}/{risk.max_score ?? 12})
                            </span>
                        </div>
                        <p className="text-xs text-gray-400 line-clamp-1">{guide.message}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    {/* 주식 비중 */}
                    <span className="text-xs text-gray-500 hidden sm:block">
                        주식비중 <span className="text-gray-300 font-semibold">{summary.stock_ratio ?? 0}%</span>
                    </span>
                    <span className={`text-gray-400 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}>▼</span>
                </div>
            </button>

            {/* ── 확장 패널 ───────────────────────────────────── */}
            {expanded && (
                <div className="px-4 pb-4 flex flex-col gap-4 border-t border-white/10 pt-4">
                    {/* 점수 막대 */}
                    <div>
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                            <span>종합 위험도 점수</span>
                            <span>{risk.score} / {risk.max_score}</span>
                        </div>
                        <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all duration-700 ${barColor}`}
                                style={{ width: `${scorePercent}%` }}
                            />
                        </div>
                    </div>

                    {/* 지표 세부 */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {Object.entries(breakdown).map(([key, info]: [string, any]) => {
                            const scoreColors = ["text-emerald-400", "text-yellow-400", "text-orange-400", "text-red-400"];
                            const sc = info.score ?? 0;
                            return (
                                <div key={key} className="bg-black/20 rounded-xl p-3 flex flex-col gap-1">
                                    <span className="text-xs text-gray-500">{info.label}</span>
                                    <span className="text-lg font-bold text-white">{info.value}</span>
                                    <span className={`text-xs font-medium ${scoreColors[sc] ?? "text-gray-400"}`}>
                                        {["안전", "주의", "경계", "위험"][sc] ?? "-"}
                                    </span>
                                </div>
                            );
                        })}
                    </div>

                    {/* 상위 보유 종목 */}
                    {data.top_holdings?.length > 0 && (
                        <div>
                            <p className="text-xs text-gray-500 mb-2">보유 상위 종목 (평가금액 순)</p>
                            <div className="flex flex-wrap gap-2">
                                {data.top_holdings.map((h: any, i: number) => (
                                    <span key={i} className="px-2.5 py-1 bg-white/5 border border-white/10 rounded-lg text-xs text-gray-300">
                                        {h.name}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* 행동 권고 */}
                    <div className={`rounded-xl p-3 ${style.bg} border ${style.border}`}>
                        <p className="text-xs text-gray-400 leading-relaxed">{guide.message}</p>
                        <p className={`text-sm font-bold mt-1 ${style.text}`}>
                            권장 액션: {guide.action}
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
