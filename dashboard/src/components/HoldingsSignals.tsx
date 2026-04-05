"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useCallback } from "react";
import { API_BASE } from "@/lib/apiConfig";
import { RefreshCw, TrendingUp, TrendingDown, Minus, Trophy, BarChart2, Target, Layers } from "lucide-react";

interface HoldingsSignalsProps {
    isAuthorized: boolean;
    onOpenDetail?: (code: string) => void;
    onAnalyzePeers?: (items: any[]) => void;
}

// ─── Formatters ───────────────────────────────────────────────────────────────
const fmt = (v: number) => new Intl.NumberFormat("ko-KR").format(Math.floor(v));
const fmtPct = (v: number | null, digits = 2): string => {
    if (v === null || v === undefined) return "–";
    return `${v >= 0 ? "+" : ""}${v.toFixed(digits)}%`;
};
const fmtPp = (v: number | null): string => {
    if (v === null || v === undefined) return "–";
    return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%p`;
};

// ─── 수익률 색상 ──────────────────────────────────────────────────────────────
function pctColor(v: number | null): string {
    if (v === null || v === undefined) return "text-gray-500";
    if (v > 2) return "text-emerald-400";
    if (v > 0) return "text-green-400";
    if (v < -2) return "text-rose-400";
    if (v < 0) return "text-red-400";
    return "text-gray-400";
}

// ─── 순위 배지 ────────────────────────────────────────────────────────────────
function RankBadge({ rank, total }: { rank: number | null; total: number }) {
    if (rank === null || total === 0) return <span className="text-gray-600 text-xs">–</span>;
    const pct = rank / total;
    let color = "text-gray-400 border-gray-600";
    let bg = "bg-gray-500/10";
    let icon = null;
    if (pct <= 0.25) { color = "text-amber-300 border-amber-500/50"; bg = "bg-amber-500/10"; icon = "🥇"; }
    else if (pct <= 0.5) { color = "text-slate-300 border-slate-500/50"; bg = "bg-slate-500/10"; icon = "🥈"; }
    else if (pct <= 0.75) { color = "text-orange-400 border-orange-500/50"; bg = "bg-orange-500/10"; icon = "🥉"; }
    else { color = "text-gray-500 border-gray-600"; bg = "bg-gray-600/10"; }

    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-bold ${color} ${bg}`}>
            {icon && <span>{icon}</span>}
            {rank}위<span className="font-normal opacity-70">/{total}</span>
        </span>
    );
}

// ─── 퍼센타일 바 ──────────────────────────────────────────────────────────────
function PercentileBar({ rank, total, label }: { rank: number | null; total: number; label: string }) {
    if (rank === null || total === 0) return null;
    const pct = ((total - rank) / Math.max(total - 1, 1)) * 100;
    let barColor = "bg-gray-500";
    if (pct >= 75) barColor = "bg-amber-400";
    else if (pct >= 50) barColor = "bg-emerald-500";
    else if (pct >= 25) barColor = "bg-blue-500";
    else barColor = "bg-rose-500";

    return (
        <div className="flex flex-col gap-1">
            <div className="flex justify-between text-[10px] text-gray-500">
                <span>{label}</span>
                <span className="text-gray-400 font-medium">상위 {(100 - ((rank - 1) / Math.max(total - 1, 1)) * 100).toFixed(0)}%</span>
            </div>
            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-700 ${barColor}`} style={{ width: `${pct}%` }} />
            </div>
        </div>
    );
}

// ─── 피어 미니 차트 (가로 바 차트) ───────────────────────────────────────────
function PeerBarChart({ peers, period, onOpenDetail }: { peers: any[]; period: "1m" | "3m"; onOpenDetail?: (code: string) => void }) {
    const key = period === "1m" ? "return_1m" : "return_3m";
    const valid = peers.filter(p => p[key] !== null && p[key] !== undefined);
    if (valid.length === 0) return null;

    const sorted = [...valid].sort((a, b) => b[key] - a[key]);
    const max = Math.max(...sorted.map(p => Math.abs(p[key])), 0.1);

    return (
        <div className="flex flex-col gap-1 mt-1">
            {sorted.map((p, i) => {
                const val: number = p[key];
                const barW = Math.abs(val) / max * 100;
                const isPos = val >= 0;
                return (
                    <div 
                        key={i} 
                        onClick={() => onOpenDetail && onOpenDetail(p.code)}
                        className={`flex items-center gap-2 text-[10px] rounded px-1.5 py-0.5 ${p.is_mine ? "bg-indigo-500/15 border border-indigo-500/30" : "border border-transparent"} ${onOpenDetail ? "cursor-pointer hover:bg-white/10" : ""}`}
                    >
                        <span className="w-4 text-gray-600 flex-shrink-0 font-mono">{i + 1}</span>
                        <span className={`flex-shrink-0 truncate ${p.is_mine ? "text-indigo-300 font-semibold" : "text-gray-400"}`} style={{ width: 130 }}>
                            {p.is_mine ? "★ " : ""}{p.name}
                        </span>
                        <div className="flex-1 flex items-center gap-1">
                            <div className="flex-1 bg-white/5 rounded-full h-1.5 overflow-hidden">
                                <div
                                    className={`h-full rounded-full ${isPos ? (p.is_mine ? "bg-indigo-400" : "bg-emerald-500") : (p.is_mine ? "bg-rose-400" : "bg-rose-700")}`}
                                    style={{ width: `${barW}%` }}
                                />
                            </div>
                            <span className={`font-mono font-bold w-14 text-right flex-shrink-0 ${pctColor(val)}`}>
                                {fmtPct(val)}
                            </span>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

// ─── 단일 종목 카드 ───────────────────────────────────────────────────────────
function HoldingCard({ item, totalPortfolio, onOpenDetail, onAnalyzePeers }: { item: any; totalPortfolio: number; onOpenDetail?: (code: string) => void, onAnalyzePeers?: (items: any[]) => void }) {
    const [showPeers, setShowPeers] = useState(false);
    const [peerPeriod, setPeerPeriod] = useState<"1m" | "3m">("1m");

    const hasPeer = item.peer_count > 0 && (item.return_1m !== null || item.return_3m !== null);
    const contributionAmt = (item.weight_pct / 100) * totalPortfolio;

    return (
        <div className="bg-white/[0.025] border border-white/10 rounded-2xl overflow-hidden hover:border-white/20 hover:bg-white/[0.035] transition-all duration-200 backdrop-blur-md">
            {/* 헤더 */}
            <div className="px-4 pt-4 pb-3 flex justify-between items-start gap-2">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <p 
                            className="font-bold text-white text-sm leading-tight cursor-pointer hover:underline"
                            onClick={() => onOpenDetail && onOpenDetail(item.code)}
                        >
                            {item.name}
                        </p>
                        {item.category && item.category !== "기타" && (
                            <span className="px-1.5 py-0.5 bg-indigo-500/15 border border-indigo-500/25 rounded text-[10px] text-indigo-400 font-medium flex-shrink-0">
                                {item.category}
                            </span>
                        )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 font-mono">{item.code}</p>
                </div>
                <div className="flex-shrink-0 text-right">
                    <p className="text-xs text-gray-500">평가금액</p>
                    <p className="text-sm font-semibold text-gray-200">{fmt(item.eval_amount)}원</p>
                </div>
            </div>

            {/* 포트폴리오 비중 바 */}
            <div className="px-4 pb-3">
                <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                    <span className="flex items-center gap-1"><Layers className="w-2.5 h-2.5" />포트폴리오 비중</span>
                    <span className="text-indigo-400 font-semibold">{item.weight_pct?.toFixed(1) ?? "–"}%</span>
                </div>
                <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${Math.min(item.weight_pct ?? 0, 100)}%` }} />
                </div>
            </div>

            {/* 수익률 + 순위 영역 */}
            {hasPeer ? (
                <div className="border-t border-white/5 px-4 py-3 flex flex-col gap-3">
                    {/* 1M / 3M 수익률 비교 그리드 */}
                    <div className="grid grid-cols-2 gap-2">
                        {(["1m", "3m"] as const).map(period => {
                            const ret = period === "1m" ? item.return_1m : item.return_3m;
                            const avg = period === "1m" ? item.peer_avg_1m : item.peer_avg_3m;
                            const exc = period === "1m" ? item.excess_1m : item.excess_3m;
                            const rank = period === "1m" ? item.rank_1m : item.rank_3m;
                            const total = period === "1m" ? item.total_valid_1m : item.total_valid_3m;
                            const alpha = period === "1m" ? item.alpha_1m : item.alpha_3m;
                            const bench = period === "1m" ? item.bench_return_1m : item.bench_return_3m;

                            return (
                                <div key={period} className="bg-black/20 rounded-xl p-2.5 flex flex-col gap-1.5">
                                    <div className="flex justify-between items-center">
                                        <span className="text-[10px] text-gray-500 uppercase font-mono">{period === "1m" ? "1개월" : "3개월"}</span>
                                        <RankBadge rank={rank} total={total} />
                                    </div>
                                    <div className={`text-xl font-black tabular-nums ${pctColor(ret)}`}>
                                        {fmtPct(ret)}
                                    </div>
                                    <div className="flex flex-col gap-0.5 text-[10px]">
                                        <div className="flex justify-between text-gray-500">
                                            <span>카테고리 평균</span>
                                            <span className={pctColor(avg)}>{fmtPct(avg)}</span>
                                        </div>
                                        <div className="flex justify-between text-gray-500">
                                            <span>초과수익</span>
                                            <span className={exc !== null ? (exc >= 0 ? "text-emerald-400 font-bold" : "text-rose-400 font-bold") : "text-gray-600"}>
                                                {fmtPp(exc)}
                                            </span>
                                        </div>
                                        {bench !== null && (
                                            <div className="flex justify-between text-gray-500">
                                                <span>vs 벤치마크 α</span>
                                                <span className={alpha !== null ? (alpha >= 0 ? "text-sky-400 font-semibold" : "text-orange-400 font-semibold") : "text-gray-600"}>
                                                    {fmtPp(alpha)}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                    <PercentileBar rank={rank} total={total} label="" />
                                </div>
                            );
                        })}
                    </div>

                    {/* 피어 비교 펼치기 */}
                    <button
                        onClick={() => setShowPeers(v => !v)}
                        className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
                    >
                        <BarChart2 className="w-3 h-3" />
                        {showPeers ? "동종 ETF 비교 닫기" : `동종 ETF ${item.peer_count}개 비교 보기`}
                    </button>

                    {showPeers && (
                        <div className="flex flex-col gap-2">
                            <div className="flex justify-between items-center">
                                <div className="flex gap-2">
                                    {(["1m", "3m"] as const).map(p => (
                                        <button
                                            key={p}
                                            onClick={() => setPeerPeriod(p)}
                                            className={`px-2 py-0.5 rounded text-[10px] font-mono border transition-all ${peerPeriod === p ? "bg-indigo-500/20 border-indigo-500/40 text-indigo-300" : "border-white/10 text-gray-500 hover:text-gray-300"}`}
                                        >
                                            {p === "1m" ? "1개월" : "3개월"}
                                        </button>
                                    ))}
                                </div>
                                <button 
                                    onClick={() => {
                                        if (onAnalyzePeers) {
                                            const peers = peerPeriod === "1m" ? item.peers_sorted_1m : item.peers_sorted_3m;
                                            const peerItems = peers.map((p: any) => ({code: p.code, name: p.name}));
                                            onAnalyzePeers([{code: item.code, name: item.name}, ...peerItems]);
                                        }
                                    }}
                                    className="text-[10px] px-2 flex items-center gap-1.5 py-0.5 rounded border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20 transition-colors"
                                >
                                    <Target className="w-3 h-3" />
                                    상세 비교하기
                                </button>
                            </div>
                            <PeerBarChart
                                peers={peerPeriod === "1m" ? item.peers_sorted_1m : item.peers_sorted_3m}
                                period={peerPeriod}
                                onOpenDetail={onOpenDetail}
                            />
                        </div>
                    )}
                </div>
            ) : (
                /* 카테고리 미매칭 → 기존 시그널 표시 영역 */
                <div className="border-t border-white/5 px-4 py-3">
                    <p className="text-xs text-gray-600 flex items-center gap-1.5">
                        <Minus className="w-3 h-3" />
                        {item.category === "기타" ? "동종 ETF 카테고리 미분류" : "수익률 데이터 없음"}
                    </p>
                </div>
            )}
        </div>
    );
}

export default function HoldingsSignals({ isAuthorized, onOpenDetail, onAnalyzePeers }: HoldingsSignalsProps) {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [sortBy, setSortBy] = useState<"eval" | "rank1m" | "rank3m" | "alpha1m">("eval");

    const fetchData = useCallback(async () => {
        if (!isAuthorized) return;
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`${API_BASE}/api/v1/my/peer-analysis`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            setData(await res.json());
        } catch (e: any) {
            setError(e.message || "조회 실패");
        } finally {
            setLoading(false);
        }
    }, [isAuthorized]);

    useEffect(() => { fetchData(); }, [fetchData]);

    if (!isAuthorized) return null;

    // 정렬
    const sortedItems = data?.items ? [...data.items].sort((a: any, b: any) => {
        if (sortBy === "eval") return (b.eval_amount ?? 0) - (a.eval_amount ?? 0);
        if (sortBy === "rank1m") {
            // 순위 낮을수록(1위) 좋음, null은 뒤로
            const ar = a.rank_1m ?? 9999, br = b.rank_1m ?? 9999;
            return ar - br;
        }
        if (sortBy === "rank3m") {
            const ar = a.rank_3m ?? 9999, br = b.rank_3m ?? 9999;
            return ar - br;
        }
        if (sortBy === "alpha1m") return (b.alpha_1m ?? -99) - (a.alpha_1m ?? -99);
        return 0;
    }) : [];

    // 요약 통계
    const analysedItems = sortedItems.filter((it: any) => it.return_1m !== null);
    const topPerformers = analysedItems.filter((it: any) => it.rank_1m === 1).length;
    const avgExcess1m = analysedItems.length > 0
        ? analysedItems.reduce((s: number, it: any) => s + (it.excess_1m ?? 0), 0) / analysedItems.length
        : null;

    return (
        <section className="flex flex-col gap-4 mt-4">
            {/* 헤더 */}
            <div className="flex justify-between items-center flex-wrap gap-3">
                <div>
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                        <span className="w-1.5 h-6 bg-violet-500 rounded-full" />
                        보유 ETF 경쟁력 분석
                        {data?.count > 0 && (
                            <span className="text-sm font-normal text-violet-400 ml-1">({data.count}개 종목)</span>
                        )}
                    </h2>
                    <p className="text-xs text-gray-600 mt-1">동종 ETF 대비 1M/3M 수익률 순위 · 벤치마크 알파 · 포트폴리오 비중</p>
                </div>
                <button
                    onClick={fetchData}
                    disabled={loading}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/30 text-violet-300 rounded-lg transition-all disabled:opacity-50"
                >
                    <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
                    {loading ? "분석중..." : "재분석"}
                </button>
            </div>

            {/* 요약 배너 */}
            {data && analysedItems.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                        {
                            icon: <Trophy className="w-4 h-4 text-amber-400" />,
                            label: "카테고리 1위 종목",
                            value: `${topPerformers}개`,
                            sub: "1M 기준",
                        },
                        {
                            icon: <Target className="w-4 h-4 text-sky-400" />,
                            label: "평균 초과수익(1M)",
                            value: avgExcess1m !== null ? fmtPp(avgExcess1m) : "–",
                            sub: "카테고리 평균 대비",
                            valueColor: avgExcess1m !== null ? (avgExcess1m >= 0 ? "text-emerald-400" : "text-rose-400") : "",
                        },
                        {
                            icon: <TrendingUp className="w-4 h-4 text-emerald-400" />,
                            label: "분석된 종목 수",
                            value: `${analysedItems.length} / ${data.count}`,
                            sub: "카테고리 매칭됨",
                        },
                        {
                            icon: <BarChart2 className="w-4 h-4 text-indigo-400" />,
                            label: "총 포트폴리오",
                            value: `${fmt(data.total_portfolio ?? 0)}원`,
                            sub: "연동 계좌 합계",
                        },
                    ].map((card, i) => (
                        <div key={i} className="bg-white/[0.02] border border-white/10 rounded-xl p-3 flex flex-col gap-1.5">
                            <div className="flex items-center gap-1.5 text-gray-500">
                                {card.icon}
                                <span className="text-[11px]">{card.label}</span>
                            </div>
                            <p className={`text-lg font-bold ${card.valueColor ?? "text-gray-100"}`}>{card.value}</p>
                            <p className="text-[10px] text-gray-600">{card.sub}</p>
                        </div>
                    ))}
                </div>
            )}

            {/* 정렬 탭 */}
            {data?.count > 0 && (
                <div className="flex gap-2 flex-wrap">
                    {[
                        { key: "eval",   label: "평가금액순" },
                        { key: "rank1m", label: "1M 순위순" },
                        { key: "rank3m", label: "3M 순위순" },
                        { key: "alpha1m",label: "1M 알파순" },
                    ].map(opt => (
                        <button
                            key={opt.key}
                            onClick={() => setSortBy(opt.key as any)}
                            className={`px-3 py-1 rounded-lg text-xs border transition-all ${
                                sortBy === opt.key
                                    ? "bg-violet-500/20 border-violet-500/40 text-violet-300"
                                    : "border-white/10 text-gray-500 hover:text-gray-300 hover:border-white/20"
                            }`}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            )}

            {/* 로딩 스켈레톤 */}
            {loading && !data && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {[1, 2, 3, 4, 5, 6].map(i => (
                        <div key={i} className="h-52 bg-white/[0.02] border border-white/10 rounded-2xl animate-pulse" />
                    ))}
                </div>
            )}

            {/* 오류 */}
            {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-400 text-sm">
                    조회 실패: {error}
                </div>
            )}

            {/* 카드 그리드 — 계좌별 그룹 */}
            {!loading && sortedItems.length > 0 && (() => {
                // 계좌별 그루핑
                const byAccount: Record<string, any[]> = {};
                sortedItems.forEach((it: any) => {
                    const acc = it.account_no || "기타";
                    if (!byAccount[acc]) byAccount[acc] = [];
                    byAccount[acc].push(it);
                });

                return (
                    <div className="flex flex-col gap-6">
                        {Object.entries(byAccount).map(([accountNo, items]) => (
                            <div key={accountNo} className="flex flex-col gap-3">
                                <h3 className="text-sm font-semibold text-gray-400 pl-2 border-l-2 border-violet-500/50">
                                    계좌: <span className="text-gray-300 font-mono tracking-wider">{accountNo}</span>
                                    <span className="ml-2 text-gray-600 font-normal">({items.length}종목)</span>
                                </h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                                    {items.map((item: any, idx: number) => (
                                        <HoldingCard
                                            key={`${accountNo}-${item.code}-${idx}`}
                                            item={item}
                                            totalPortfolio={data.total_portfolio ?? 0}
                                            onOpenDetail={onOpenDetail}
                                            onAnalyzePeers={onAnalyzePeers}
                                        />
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                );
            })()}

            {/* 결과 없음 */}
            {!loading && data?.count === 0 && (
                <div className="p-10 flex flex-col items-center gap-2 text-gray-500 bg-white/[0.02] border border-white/10 rounded-2xl">
                    <span className="text-2xl">📊</span>
                    <p className="text-sm">분석 가능한 국내 ETF 종목이 없습니다.</p>
                </div>
            )}

            {/* 안내 */}
            <p className="text-[10px] text-gray-700 text-right">
                * yfinance 가격 기준 · 거래일 21일=1M, 63일=3M · 4시간 캐시
            </p>
        </section>
    );
}
