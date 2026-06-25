"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Sparkles, TrendingUp, BookOpen, PieChart, RefreshCw, Loader2 } from 'lucide-react';
import { API_BASE } from '../lib/apiConfig';

// ── 동적 리포트 JSON 스키마 (백엔드 sector_insight.py 와 일치) ──────────────
export interface InsightContent {
    tab1?: { cards?: { title: string; body: string }[] };
    etfs?: {
        domestic?: { items?: { name: string; desc: string }[] };
        overseas?: { items?: { name: string; desc: string }[] };
    };
    strategy?: {
        models?: { items?: { name: string; detail: string }[] };
        guides?: { items?: { name: string; body: string }[] };
        footnote?: string;
    };
}

interface TabDef { id: string; label: string; icon: React.ComponentType<{ className?: string }>; }

interface Props {
    sector: 'space' | 'semi' | 'energy' | 'bio';
    title: string;
    tabs: TabDef[];          // 탭 바(섹터별 라벨/순서). 1번=트렌드, 'etfs', 'strategy', (그 외=children)
    activeTab: string;
    onTabChange: (id: string) => void;
    fallback: InsightContent; // 최초 생성 전 보여줄 정적 기본본
    accent?: 'cyan' | 'emerald' | 'amber' | 'purple';
    children?: React.ReactNode; // 표준 외 탭(예: Semi qcycle) 콘텐츠
}

const ACCENTS = {
    cyan: { head: 'text-cyan-400', badge: 'text-cyan-500/80 bg-cyan-500/10 border-cyan-500/20', dot: 'text-cyan-500', active: 'from-cyan-600 to-blue-600' },
    emerald: { head: 'text-emerald-400', badge: 'text-emerald-500/80 bg-emerald-500/10 border-emerald-500/20', dot: 'text-emerald-500', active: 'from-emerald-600 to-teal-600' },
    amber: { head: 'text-amber-400', badge: 'text-amber-500/80 bg-amber-500/10 border-amber-500/20', dot: 'text-amber-500', active: 'from-amber-600 to-orange-600' },
    purple: { head: 'text-purple-400', badge: 'text-purple-500/80 bg-purple-500/10 border-purple-500/20', dot: 'text-purple-500', active: 'from-purple-600 to-fuchsia-600' },
};

const CARD_COLORS = ['text-cyan-400', 'text-purple-400', 'text-blue-400'];

function formatKST(iso: string | null): string {
    if (!iso) return '';
    try {
        const d = new Date(iso);
        return d.toLocaleString('ko-KR', {
            timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', hour12: false,
        }).replace(/\. /g, '.').replace(/\.$/, '');
    } catch {
        return '';
    }
}

export default function SectorInsightReport({
    sector, title, tabs, activeTab, onTabChange, fallback, accent = 'cyan', children,
}: Props) {
    const [data, setData] = useState<InsightContent | null>(null);
    const [generatedAt, setGeneratedAt] = useState<string | null>(null);
    const [generating, setGenerating] = useState(false);
    const [error, setError] = useState<string>('');
    const a = ACCENTS[accent];

    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                const res = await fetch(`${API_BASE}/api/v1/sector-insight/${sector}`);
                if (!res.ok) return;
                const json = await res.json();
                if (alive && json.content) {
                    setData(json.content);
                    setGeneratedAt(json.generated_at);
                }
            } catch { /* 저장본 없음 → fallback 사용 */ }
        })();
        return () => { alive = false; };
    }, [sector]);

    const handleUpdate = useCallback(async () => {
        setGenerating(true);
        setError('');
        try {
            const res = await fetch(`${API_BASE}/api/v1/sector-insight/${sector}/generate`, { method: 'POST' });
            if (!res.ok) {
                const j = await res.json().catch(() => ({}));
                throw new Error(j.detail || `생성 실패 (${res.status})`);
            }
            const json = await res.json();
            setData(json.content);
            setGeneratedAt(json.generated_at);
        } catch (e: any) {
            setError(e?.message || '리포트 생성 중 오류가 발생했습니다.');
        } finally {
            setGenerating(false);
        }
    }, [sector]);

    const content = data ?? fallback;
    const tab1Id = tabs[0]?.id;

    return (
        <div className="flex flex-col gap-4">
            {/* Header */}
            <div className="flex items-start justify-between gap-3 flex-wrap">
                <h4 className="text-base font-extrabold text-white flex items-center gap-2">
                    <Sparkles className={`w-4 h-4 ${a.dot} animate-pulse`} />
                    {title}
                </h4>
                <div className="flex items-center gap-2">
                    {generatedAt && (
                        <span className="text-[10px] text-gray-500 font-semibold whitespace-nowrap">
                            생성: {formatKST(generatedAt)}
                        </span>
                    )}
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${a.badge}`}>
                        Gemini Expert Report
                    </span>
                    <button
                        onClick={handleUpdate}
                        disabled={generating}
                        className={`flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-lg border transition-all ${a.badge} hover:brightness-125 disabled:opacity-60`}
                        title="Gemini로 현재 시세 기반 리포트를 새로 생성합니다"
                    >
                        {generating
                            ? <><Loader2 className="w-3 h-3 animate-spin" /> 분석 중…</>
                            : <><RefreshCw className="w-3 h-3" /> Update</>}
                    </button>
                </div>
            </div>

            {error && <p className="text-[11px] text-red-400 font-semibold -mt-2">{error}</p>}
            {!generatedAt && !generating && (
                <p className="text-[10px] text-gray-500 -mt-2">
                    * 아직 생성 이력이 없습니다. <span className="text-gray-400 font-semibold">Update</span> 버튼을 누르면 현재 시세를 반영한 분석으로 갱신됩니다.
                </p>
            )}

            {/* Tab Menu */}
            <div className="flex flex-wrap bg-[#1a1a23]/60 p-1 rounded-xl border border-white/5 gap-1 self-start">
                {tabs.map((tab) => {
                    const Icon = tab.icon;
                    const sel = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => onTabChange(tab.id)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                                sel ? `bg-gradient-to-r ${a.active} text-white shadow-md`
                                    : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
                            }`}
                        >
                            <Icon className="w-3.5 h-3.5" />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* Tab Contents */}
            {activeTab === tab1Id && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-1">
                    {(content.tab1?.cards ?? []).slice(0, 3).map((c, i) => (
                        <div key={i} className="bg-white/[0.02] hover:bg-white/[0.04] transition-all p-4 border border-white/5 rounded-2xl flex flex-col gap-2">
                            <div className={`flex items-center gap-2 font-bold text-sm ${CARD_COLORS[i % 3]}`}>
                                <TrendingUp className="w-4 h-4" />
                                <span>{c.title}</span>
                            </div>
                            <p className="text-xs text-gray-300 leading-relaxed">{c.body}</p>
                        </div>
                    ))}
                </div>
            )}

            {activeTab === 'etfs' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-1">
                    <div className="bg-white/[0.02] p-4 border border-white/5 rounded-2xl flex flex-col gap-3">
                        <h5 className={`text-sm font-bold ${a.head} border-b border-white/5 pb-2`}>국내 상장 핵심 ETF</h5>
                        <div className="flex flex-col gap-2.5 text-xs text-gray-300">
                            {(content.etfs?.domestic?.items ?? []).map((it, i) => (
                                <div key={i}>
                                    <span className="font-bold text-white">{it.name}</span>
                                    <p className="mt-0.5 text-gray-400">{it.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="bg-white/[0.02] p-4 border border-white/5 rounded-2xl flex flex-col gap-3">
                        <h5 className="text-sm font-bold text-blue-400 border-b border-white/5 pb-2">해외 상장 핵심 ETF</h5>
                        <div className="flex flex-col gap-2.5 text-xs text-gray-300">
                            {(content.etfs?.overseas?.items ?? []).map((it, i) => (
                                <div key={i}>
                                    <span className="font-bold text-white">{it.name}</span>
                                    <p className="mt-0.5 text-gray-400">{it.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'strategy' && (
                <div className="bg-white/[0.02] p-4 border border-white/5 rounded-2xl flex flex-col gap-4 mt-1">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <h5 className={`text-xs font-bold ${a.head} mb-2 flex items-center gap-1`}>
                                <PieChart className="w-3.5 h-3.5" />
                                포트폴리오 자산배분 모델 제안
                            </h5>
                            <div className="text-xs text-gray-300 space-y-2 leading-relaxed font-sans">
                                {(content.strategy?.models?.items ?? []).map((m, i) => (
                                    <div key={i}>
                                        <span className="font-bold text-white">{m.name}</span>
                                        <span className="text-gray-400"> {m.detail}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div>
                            <h5 className={`text-xs font-bold ${a.head} mb-2 flex items-center gap-1`}>
                                <TrendingUp className="w-3.5 h-3.5" />
                                이벤트/기술적 진입 가이드
                            </h5>
                            <div className="text-xs text-gray-300 space-y-2 leading-relaxed">
                                {(content.strategy?.guides?.items ?? []).map((g, i) => (
                                    <div key={i}>
                                        <span className="font-bold text-white">{g.name}</span>
                                        <p className="mt-0.5 text-gray-400">{g.body}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                    {content.strategy?.footnote && (
                        <div className="border-t border-white/5 pt-3">
                            <p className="text-[10px] text-gray-500 leading-relaxed font-semibold">
                                * {content.strategy.footnote}
                            </p>
                        </div>
                    )}
                </div>
            )}

            {/* 표준 외 탭(Semi Q-Cycle 등) */}
            {children}
        </div>
    );
}
