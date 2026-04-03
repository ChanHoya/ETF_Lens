"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useCallback } from "react";
import { API_BASE } from "@/lib/apiConfig";
import { RefreshCw } from "lucide-react";

type HoldingsSignalsProps = { isAuthorized: boolean };

const SIGNAL_STYLE: Record<string, { badge: string; dot: string }> = {
    golden:    { badge: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40", dot: "bg-emerald-400" },
    dead:      { badge: "bg-red-500/20 text-red-300 border-red-500/40",             dot: "bg-red-400" },
    bull:      { badge: "bg-blue-500/20 text-blue-300 border-blue-500/40",           dot: "bg-blue-400" },
    bear:      { badge: "bg-orange-500/20 text-orange-300 border-orange-500/40",     dot: "bg-orange-400" },
    overbought:{ badge: "bg-yellow-500/20 text-yellow-300 border-yellow-500/40",     dot: "bg-yellow-400" },
    oversold:  { badge: "bg-purple-500/20 text-purple-300 border-purple-500/40",     dot: "bg-purple-400" },
    neutral:   { badge: "bg-gray-500/20 text-gray-400 border-gray-500/30",           dot: "bg-gray-500" },
    unknown:   { badge: "bg-gray-500/10 text-gray-600 border-gray-700",              dot: "bg-gray-700" },
    error:     { badge: "bg-gray-500/10 text-gray-600 border-gray-700",              dot: "bg-gray-700" },
};

const SIGNAL_EMOJI: Record<string, string> = {
    golden: "⭐", dead: "💀", bull: "📈", bear: "📉",
    overbought: "🔥", oversold: "🧊", neutral: "➖", unknown: "❓", error: "⚠️",
};

function formatNumber(v: number) {
    return new Intl.NumberFormat("ko-KR").format(Math.floor(v));
}

export default function HoldingsSignals({ isAuthorized }: HoldingsSignalsProps) {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchSignals = useCallback(async () => {
        if (!isAuthorized) return;
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`${API_BASE}/api/v1/my/holdings-signals`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            setData(await res.json());
        } catch (e: any) {
            setError(e.message || "조회 실패");
        } finally {
            setLoading(false);
        }
    }, [isAuthorized]);

    useEffect(() => { fetchSignals(); }, [fetchSignals]);

    if (!isAuthorized) return null;

    return (
        <section className="flex flex-col gap-4 mt-4">
            {/* 헤더 */}
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                    <span className="w-1.5 h-6 bg-violet-500 rounded-full" />
                    보유 ETF 전략 시그널
                    {data?.count > 0 && (
                        <span className="text-sm font-normal text-violet-400 ml-1">({data.count}개 종목)</span>
                    )}
                </h2>
                <button
                    onClick={fetchSignals}
                    disabled={loading}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/30 text-violet-300 rounded-lg transition-all disabled:opacity-50"
                >
                    <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
                    {loading ? "분석중..." : "재분석"}
                </button>
            </div>

            {/* 안내 문구 */}
            <p className="text-xs text-gray-600 -mt-2">
                MA5/MA20 이동평균 크로스 + RSI(14) 기반 신호 • 2시간 캐시
            </p>

            {/* 로딩 스켈레톤 */}
            {loading && !data && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {[1,2,3].map(i => (
                        <div key={i} className="h-24 bg-white/[0.02] border border-white/10 rounded-2xl animate-pulse" />
                    ))}
                </div>
            )}

            {/* 오류 */}
            {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-400 text-sm">
                    조회 실패: {error}
                </div>
            )}

            {/* 결과 카드 그리드 */}
            {!loading && data?.signals?.length > 0 && (
                <div className="flex flex-col gap-6">
                    {Object.entries(
                        data.signals.reduce((acc: any, s: any) => {
                            const account = s.account_no || '미분류 계좌';
                            if (!acc[account]) acc[account] = [];
                            acc[account].push(s);
                            return acc;
                        }, {})
                    ).map(([accountNo, accountSignals]: [string, any]) => (
                        <div key={accountNo} className="flex flex-col gap-3">
                            <h3 className="text-sm font-semibold text-gray-400 pl-2 border-l-2 border-violet-500/50">
                                계좌: <span className="text-gray-300 font-mono tracking-wider">{accountNo}</span>
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                {accountSignals.map((s: any, idx: number) => {
                                    const style = SIGNAL_STYLE[s.signal] ?? SIGNAL_STYLE.unknown;
                                    const emoji = SIGNAL_EMOJI[s.signal] ?? "❓";
                                    return (
                                        <div
                                            key={`${accountNo}-${s.code}-${idx}`}
                                            className="bg-white/[0.02] border border-white/10 rounded-2xl p-4 flex flex-col gap-2 hover:bg-white/[0.04] transition-all backdrop-blur-md"
                                        >
                                            {/* 종목명 + 시그널 배지 */}
                                            <div className="flex justify-between items-start gap-2">
                                                <div>
                                                    <p className="font-semibold text-white text-sm leading-tight">{s.name}</p>
                                                    <p className="text-xs text-gray-500 mt-0.5">{s.code}</p>
                                                </div>
                                                <span className={`flex-shrink-0 flex items-center gap-1 px-2 py-0.5 border rounded-full text-xs font-bold ${style.badge}`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                                                    {emoji} {s.label}
                                                </span>
                                            </div>

                                            {/* 지표 수치 */}
                                            {s.detail && (
                                                <p className="text-xs text-gray-500 font-mono">{s.detail}</p>
                                            )}

                                            {/* 평가금액 */}
                                            <div className="flex justify-between items-center pt-1 border-t border-white/5">
                                                <span className="text-xs text-gray-600">평가금액</span>
                                                <span className="text-xs font-semibold text-gray-300">
                                                    {formatNumber(s.eval_amount)}원
                                                </span>
                                            </div>

                                            {/* 캐시 표시 */}
                                            {s.cached && (
                                                <p className="text-[10px] text-gray-700 text-right -mt-1">캐시됨</p>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* 결과 없음 */}
            {!loading && data?.count === 0 && (
                <div className="p-10 flex flex-col items-center gap-2 text-gray-500 bg-white/[0.02] border border-white/10 rounded-2xl">
                    <span className="text-2xl">📊</span>
                    <p className="text-sm">분석 가능한 국내 ETF/주식 종목이 없습니다.</p>
                </div>
            )}
        </section>
    );
}
