"use client";
// 브라질 국채 매크로 대시보드·Activation Zone 신호·AI 전략 리포트·캐리 쿠션 시뮬레이터 뷰

import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
    ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid,
    Tooltip as RechartsTooltip, Legend, ScatterChart, Scatter, ReferenceArea, ReferenceLine, ZAxis,
} from 'recharts';
import {
    Flag, TrendingDown, Gauge, AlertTriangle, Target, CalendarClock,
    Sparkles, RefreshCw, Layers, ShieldCheck, ArrowDownRight, Info, CheckCircle2,
    Newspaper, Bell, ExternalLink, Send, Settings, Play, RotateCcw, ZoomIn, ZoomOut,
    Vote, Landmark, Scale, DollarSign, Percent, Award, ChevronRight, Zap,
    ChevronDown, ChevronUp, X, Edit3, Plus,
} from 'lucide-react';
import BrazilTotalReturnSimulator from './BrazilTotalReturnSimulator';
import { API_BASE } from '@/lib/apiConfig';

// ── 타입 ────────────────────────────────────────────────────────────────────
interface Indicator {
    key: string; label: string; unit: string; date: string | null;
    value: number | null; prev: number | null; change: number | null; gauge: string;
    live?: boolean;
}
interface Signal {
    zone: string; grade: string; color: string;
    rate_ok: boolean; fx_ok: boolean; headline: string; action: string;
}
interface CarryPoint {
    fx_end: number; fx_change_pct: number; total_return_pct: number; cagr_pct: number; is_breakeven: boolean;
}
interface Catalyst { date: string; key: string; title: string; note: string; impact: string; d_day: number; actual?: string | null; outlook?: string | null; }

export interface ElectionScenario {
    id: string;
    title: string;
    subtitle: string;
    color: string;
    verdict: string;
    political_landscape: string;
    fiscal_policy: string;
    bcb_relationship: string;
    rate_10y: string;
    rate_change_num: number;
    brl_fx: string;
    fx_change_str: string;
    market_reaction: string;
    bond_price: string;
    fx_impact: string;
    action_guide: string;
}

export interface RecommendedBond {
    id: string;
    name: string;
    code_example: string;
    currency: string;
    maturity_years: string;
    target_horizon: string;
    coupon_rate: string;
    current_ytm: string;
    tax_benefit: string;
    risk_level: string;
    best_for: string;
    pros: string[];
    cons: string[];
    allocation_tranche3: string;
}

export interface ElectionStrategy {
    principles: { title: string; body: string; tag: string }[];
    checkpoints: { name: string; focus: string }[];
}

export interface ElectionPulse {
    headline: string;
    market_mood: string;
    convergence_scenario: {
        primary: string;
        probabilities: { A: number; B: number; C: number };
        reasoning: string;
    };
    live_analysis: string | Record<string, any>;
    tranche3_action: string | Record<string, any>;
    recommended_bond_guide: string | Record<string, any>;
    monitoring_points: (string | Record<string, any>)[];
}

interface Summary {
    as_of: string;
    indicators: Indicator[];
    real_rate: { label: string; unit: string; value: number | null; gauge: string; date?: string | null };
    focus: {
        selic_eoy: number | null; ipca_eoy: number | null; usdbrl_eoy: number | null;
        selic_eoy_date?: string | null; ipca_eoy_date?: string | null; usdbrl_eoy_date?: string | null;
    };
    usd_brl?: {
        value: number | null; prev: number | null; change: number | null;
        date: string | null; live?: boolean; brl_trend?: 'strong' | 'weak' | 'flat';
    };
    signal: Signal;
    targets: { rate_floor: number; rate_tranche2: number; rate_risk: number; fx_target: number };
    carry_cushion: CarryPoint[];
    timeline: Catalyst[];
    next_catalyst: Catalyst | null;
    aug_scenarios: { id: string; title: string; color: string; logic: string; action: string }[];
    current_tranche_id?: number;
    tranches: { id: number; weight: string; timing: string; trigger: string; rationale: string }[];
    due_diligence: { title: string; body: string }[];
    election_scenarios?: ElectionScenario[];
    recommended_bonds?: RecommendedBond[];
    election_strategy?: ElectionStrategy;
}
interface AiInsight {
    verdict?: { grade: string; summary: string };
    analysis?: { cards: { title: string; body: string }[] };
    strategy?: { entry: string; hold: string; exit: string };
    execution_checklist?: string[];
    risk_footnote?: string;
}
interface NewsItem { title: string; source: string; link: string; published: string | null; }
const NEWS_LIMIT = 30; // 리스트는 5건 높이로 보이고 나머지는 스크롤

// ── 색 유틸 ──────────────────────────────────────────────────────────────────
const GAUGE_STYLE: Record<string, { dot: string; text: string; ring: string; label: string }> = {
    green: { dot: 'bg-emerald-400', text: 'text-emerald-300', ring: 'ring-emerald-500/30', label: '양호' },
    amber: { dot: 'bg-amber-400', text: 'text-amber-300', ring: 'ring-amber-500/30', label: '주의' },
    red: { dot: 'bg-rose-500', text: 'text-rose-300', ring: 'ring-rose-500/30', label: '경고' },
    gray: { dot: 'bg-gray-500', text: 'text-gray-300', ring: 'ring-gray-500/20', label: '중립' },
};
const ZONE_STYLE: Record<string, { from: string; to: string; badge: string }> = {
    AGGRESSIVE: { from: 'from-emerald-500', to: 'to-green-600', badge: 'bg-emerald-500' },
    TRANCHE1: { from: 'from-emerald-600', to: 'to-green-700', badge: 'bg-emerald-500' },
    CAUTION: { from: 'from-amber-600', to: 'to-yellow-600', badge: 'bg-amber-500' },
    TRANCHE2: { from: 'from-amber-600', to: 'to-yellow-600', badge: 'bg-amber-500' },
    WATCH: { from: 'from-slate-600', to: 'to-gray-600', badge: 'bg-slate-500' },
    RISK_REASSESS: { from: 'from-rose-700', to: 'to-red-700', badge: 'bg-rose-600' },
    UNKNOWN: { from: 'from-gray-700', to: 'to-gray-700', badge: 'bg-gray-600' },
};

const fmt = (v: number | null | undefined, d = 2) =>
    v === null || v === undefined ? '—' : v.toLocaleString('ko-KR', { minimumFractionDigits: d, maximumFractionDigits: d });

const renderFlexibleContent = (val: any) => {
    if (!val) return null;
    if (typeof val === 'string') return val;
    if (Array.isArray(val)) {
        return (
            <ul className="space-y-1 mt-1">
                {val.map((item, i) => (
                    <li key={i} className="text-xs text-gray-300">
                        • {typeof item === 'object' ? JSON.stringify(item) : String(item)}
                    </li>
                ))}
            </ul>
        );
    }
    if (typeof val === 'object') {
        return (
            <div className="space-y-2 mt-1.5">
                {Object.entries(val).map(([k, v]) => (
                    <div key={k} className="p-2.5 rounded-xl bg-white/[0.04] border border-white/10 hover:border-cyan-500/30 transition">
                        <span className="font-bold text-cyan-300 block text-xs mb-1">[{k}]</span>
                        <span className="text-gray-300 text-xs leading-relaxed block">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</span>
                    </div>
                ))}
            </div>
        );
    }
    return String(val);
};

const isSameDate = (dateStr: string | null | undefined): boolean => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return false;
    const today = new Date();
    return d.getFullYear() === today.getFullYear() &&
           d.getMonth() === today.getMonth() &&
           d.getDate() === today.getDate();
};

const getDynamicDDay = (targetDateStr: string): number => {
    if (!targetDateStr) return 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(targetDateStr);
    target.setHours(0, 0, 0, 0);
    const diffTime = target.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

// 대선 일정(한국시간 결과 반영일) 기준 현재 국면 D-day 라벨
const ELECTION_FIRST_DATE = "2026-10-05";
const ELECTION_RUNOFF_DATE = "2026-10-26";
const getElectionDDayLabel = (): string => {
    const dFirst = getDynamicDDay(ELECTION_FIRST_DATE);
    if (dFirst > 0) return `1차 투표 D-${dFirst}`;
    if (dFirst === 0) return "1차 투표 D-DAY";
    const dRunoff = getDynamicDDay(ELECTION_RUNOFF_DATE);
    if (dRunoff > 0) return `결선 D-${dRunoff}`;
    if (dRunoff === 0) return "결선 D-DAY";
    return "대선 종료";
};

export default function BrazilBondTab() {
    const [summary, setSummary] = useState<Summary | null>(null);
    const [history, setHistory] = useState<Record<string, { date: string; value: number }[]>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [insight, setInsight] = useState<AiInsight | null>(null);
    const [insightAt, setInsightAt] = useState<string | null>(null);
    const [genLoading, setGenLoading] = useState(false);
    const autoGenAttemptedRef = useRef(false);

    const [catalystSyncing, setCatalystSyncing] = useState(false);
    const [catalystToast, setCatalystToast] = useState<{ ok: boolean; msg: string } | null>(null);
    const autoSyncCatalystAttemptedRef = useRef(false);

    const [news, setNews] = useState<NewsItem[]>([]);
    const [newsLoading, setNewsLoading] = useState(true);
    const [newsRefreshing, setNewsRefreshing] = useState(false);
    const [newsUpdatedAt, setNewsUpdatedAt] = useState<Date | null>(null);

    // [뉴스 업데이트] 버튼: 서버에 라이브 재수집(refresh=true)을 요청해 현재까지의 기사로 리스트를 다시 채운다.
    const refreshNews = async () => {
        setNewsRefreshing(true);
        try {
            const r = await fetch(`${API_BASE}/api/v1/brazil-bond/news?limit=${NEWS_LIMIT}&refresh=true`, { cache: 'no-store' });
            if (r.ok) {
                const nData = (await r.json()).items || [];
                setNews(nData);
                setNewsUpdatedAt(new Date());
                localStorage.setItem('brazil_bond_news', JSON.stringify(nData));
            }
        } catch (e) {
            console.error("News refresh failed:", e);
        } finally {
            setNewsRefreshing(false);
        }
    };

    const [electionPulse, setElectionPulse] = useState<ElectionPulse | null>(null);
    const [electionPulseAt, setElectionPulseAt] = useState<string | null>(null);
    const [electionPulseGenLoading, setElectionPulseGenLoading] = useState(false);
    const autoGenPulseAttemptedRef = useRef(false);

    useEffect(() => {
        // 1. Try to load cached data from localStorage for instant 0ms load
        try {
            const cachedSummary = localStorage.getItem('brazil_bond_summary');
            const cachedHistory = localStorage.getItem('brazil_bond_history');
            const cachedInsight = localStorage.getItem('brazil_bond_insight');
            const cachedNews = localStorage.getItem('brazil_bond_news');
            const cachedPulse = localStorage.getItem('brazil_bond_election_pulse');

            if (cachedSummary && cachedSummary.includes('election_runoff')) {
                setSummary(JSON.parse(cachedSummary));
            }
            if (cachedHistory) setHistory(JSON.parse(cachedHistory));
            if (cachedInsight) {
                const j = JSON.parse(cachedInsight);
                setInsight(j.content || null);
                setInsightAt(j.generated_at || null);
                if (!isSameDate(j.generated_at)) {
                    setGenLoading(true);
                }
            }
            if (cachedNews) setNews(JSON.parse(cachedNews));
            if (cachedPulse) {
                const pj = JSON.parse(cachedPulse);
                setElectionPulse(pj.content || null);
                setElectionPulseAt(pj.generated_at || null);
            }

            if (cachedSummary && cachedHistory) {
                setLoading(false); // disable loading spinner immediately!
            }
            if (cachedNews) {
                setNewsLoading(false);
            }
        } catch (cacheErr) {
            console.warn("Failed to load brazil-bond cache:", cacheErr);
        }

        // 2. Fetch fresh data from API in background to update the cache
        const loadFresh = async () => {
            try {
                // If there's no cache, show spinner
                if (!localStorage.getItem('brazil_bond_summary') || !localStorage.getItem('brazil_bond_history')) {
                    setLoading(true);
                }
                const [sRes, hRes, iRes, pRes] = await Promise.all([
                    fetch(`${API_BASE}/api/v1/brazil-bond/summary`, { cache: 'no-store' }),
                    fetch(`${API_BASE}/api/v1/brazil-bond/history?series=selic_target,y5,y5_fred,ipca_12m,brl_krw,usd_brl,focus_selic_eoy&years=10`, { cache: 'no-store' }),
                    fetch(`${API_BASE}/api/v1/brazil-bond/insight`, { cache: 'no-store' }),
                    fetch(`${API_BASE}/api/v1/brazil-bond/election-pulse`, { cache: 'no-store' }),
                ]);
                if (!sRes.ok) throw new Error(`summary ${sRes.status}`);

                const sData = await sRes.json();
                setSummary(sData);
                localStorage.setItem('brazil_bond_summary', JSON.stringify(sData));

                if (hRes.ok) {
                    const hData = await hRes.json();
                    const series = hData.series || {};
                    setHistory(series);
                    localStorage.setItem('brazil_bond_history', JSON.stringify(series));
                }

                if (iRes.ok) {
                    const j = await iRes.json();
                    setInsight(j.content || null);
                    setInsightAt(j.generated_at || null);
                    localStorage.setItem('brazil_bond_insight', JSON.stringify(j));

                    // 기 생성된 리포트가 이전 날짜이거나 없으면 자동 재생성 (동일 날짜면 skip)
                    if (!autoGenAttemptedRef.current && (!j.generated_at || !isSameDate(j.generated_at))) {
                        autoGenAttemptedRef.current = true;
                        generateReport(true);
                    }
                }

                if (pRes && pRes.ok) {
                    const pj = await pRes.json();
                    setElectionPulse(pj.content || null);
                    setElectionPulseAt(pj.generated_at || null);
                    localStorage.setItem('brazil_bond_election_pulse', JSON.stringify(pj));
                }

                // 2.1 지나간 이벤트 중 실제 발표 내용이 누락되었거나 '집계 대기'인 경우 자동 백그라운드 갱신
                if (sData) {
                    const hasMissingActual = (sData.timeline || []).some(
                        (c: Catalyst) => c.d_day < 0 && (!c.actual || c.actual.includes('집계 대기'))
                    );
                    if (hasMissingActual && !autoSyncCatalystAttemptedRef.current) {
                        autoSyncCatalystAttemptedRef.current = true;
                        syncCatalysts(true);
                    }
                }
            } catch (e: any) {
                if (!localStorage.getItem('brazil_bond_summary')) {
                    setError(String(e?.message || e));
                } else {
                    console.error("Background refresh failed (server waking up?):", e);
                    // 백그라운드 갱신 실패(서버 깨어나는 중 등) 시 5초 후 재시도
                    setTimeout(loadFresh, 5000);
                }
            } finally {
                setLoading(false);
            }
        };

        // 3. Fetch news in the background (using refresh=false to avoid live scraping)
        const loadNews = async () => {
            try {
                if (!localStorage.getItem('brazil_bond_news')) {
                    setNewsLoading(true);
                }
                const r = await fetch(`${API_BASE}/api/v1/brazil-bond/news?limit=${NEWS_LIMIT}&refresh=false`, { cache: 'no-store' });
                if (r.ok) {
                    const nData = (await r.json()).items || [];
                    setNews(nData);
                    setNewsUpdatedAt(new Date());
                    localStorage.setItem('brazil_bond_news', JSON.stringify(nData));
                }
            } catch (e) {
                console.error("Background news refresh failed:", e);
            } finally {
                setNewsLoading(false);
            }
        };

        // 4. D-day/지표/뉴스는 서버에서 요청 시점 기준으로 실시간 계산되므로,
        // 탭을 리로드하지 않아도 반영되도록 주기적 폴링 + 탭 복귀 시 재조회를 건다.
        let lastRefreshAt = Date.now();
        const refreshAll = () => {
            lastRefreshAt = Date.now();
            loadFresh();
            loadNews();
        };

        refreshAll();
        const REFRESH_MS = 5 * 60 * 1000; // 5분마다 자동 갱신
        const intervalId = setInterval(refreshAll, REFRESH_MS);
        const onVisibilityChange = () => {
            if (document.visibilityState === 'visible' && Date.now() - lastRefreshAt > 60 * 1000) {
                refreshAll();
            }
        };
        document.addEventListener('visibilitychange', onVisibilityChange);

        return () => {
            clearInterval(intervalId);
            document.removeEventListener('visibilitychange', onVisibilityChange);
        };
    }, []);

    const generateReport = async (silent = false) => {
        try {
            setGenLoading(true);
            const res = await fetch(`${API_BASE}/api/v1/brazil-bond/insight/generate`, { method: 'POST' });
            if (!res.ok) {
                const t = await res.json().catch(() => ({}));
                throw new Error(t.detail || `생성 실패 (${res.status})`);
            }
            const j = await res.json();
            setInsight(j.content || null);
            setInsightAt(j.generated_at || null);
            localStorage.setItem('brazil_bond_insight', JSON.stringify(j));
        } catch (e: any) {
            console.error("AI 리포트 생성 오류:", e);
            if (!silent) {
                alert(`AI 리포트 생성 오류: ${e?.message || e}`);
            }
        } finally {
            setGenLoading(false);
        }
    };

    const generateElectionPulse = async (silent = false) => {
        try {
            if (!silent) setElectionPulseGenLoading(true);
            const res = await fetch(`${API_BASE}/api/v1/brazil-bond/election-pulse/generate`, { method: 'POST' });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.detail || `대선 정세 분석 생성 실패 (${res.status})`);
            }
            const j = await res.json();
            setElectionPulse(j.content || null);
            setElectionPulseAt(j.generated_at || null);
            localStorage.setItem('brazil_bond_election_pulse', JSON.stringify(j));
            if (!silent) {
                setCatalystToast({
                    ok: true,
                    msg: "실시간 대선 정세 및 시장 향배(Live Pulse) 분석이 갱신되었습니다.",
                });
                setTimeout(() => setCatalystToast(null), 4000);
            }
        } catch (e: any) {
            console.error("대선 정세 생성 오류:", e);
            if (!silent) {
                setCatalystToast({ ok: false, msg: String(e?.message || e) });
                setTimeout(() => setCatalystToast(null), 5000);
            }
        } finally {
            if (!silent) setElectionPulseGenLoading(false);
        }
    };

    const syncCatalysts = useCallback(async (silent = false) => {
        try {
            if (!silent) setCatalystSyncing(true);
            const res = await fetch(`${API_BASE}/api/v1/brazil-bond/catalysts/sync?force=true`, {
                method: 'POST',
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.detail || `이벤트 갱신 실패 (${res.status})`);
            }
            const data = await res.json();

            // 캘린더 타임라인뿐 아니라 트랜치 및 전체 요약 데이터를 함께 갱신
            try {
                const sRes = await fetch(`${API_BASE}/api/v1/brazil-bond/summary`, { cache: 'no-store' });
                if (sRes.ok) {
                    const freshSummary = await sRes.json();
                    setSummary(freshSummary);
                    localStorage.setItem('brazil_bond_summary', JSON.stringify(freshSummary));
                } else {
                    setSummary((prev) => {
                        if (!prev) return prev;
                        const updated = {
                            ...prev,
                            timeline: data.timeline,
                            current_tranche_id: data.current_tranche_id ?? 3,
                            tranches: data.tranches?.length ? data.tranches : prev.tranches,
                        };
                        localStorage.setItem('brazil_bond_summary', JSON.stringify(updated));
                        return updated;
                    });
                }
            } catch {
                setSummary((prev) => {
                    if (!prev) return prev;
                    const updated = {
                        ...prev,
                        timeline: data.timeline,
                        current_tranche_id: data.current_tranche_id ?? 3,
                        tranches: data.tranches?.length ? data.tranches : prev.tranches,
                    };
                    localStorage.setItem('brazil_bond_summary', JSON.stringify(updated));
                    return updated;
                });
            }

            if (!silent) {
                setCatalystToast({
                    ok: true,
                    msg: `매크로 캘린더 및 분할 매수 로드맵(Tranche 3)이 최신 지표로 갱신되었습니다. (${data.updated_count}건 반영)`,
                });
                setTimeout(() => setCatalystToast(null), 4000);
            }
        } catch (e: any) {
            console.error("이벤트 동기화 오류:", e);
            if (!silent) {
                setCatalystToast({ ok: false, msg: String(e?.message || e) });
                setTimeout(() => setCatalystToast(null), 5000);
            }
        } finally {
            if (!silent) setCatalystSyncing(false);
        }
    }, []);

    if (loading) {
        return (
            <div className="w-full bg-[#121217]/80 p-10 border border-white/10 rounded-3xl backdrop-blur-3xl text-center">
                <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin mx-auto mb-3" />
                <p className="text-gray-400">브라질 매크로 데이터를 불러오는 중…</p>
            </div>
        );
    }
    if (error || !summary) {
        return (
            <div className="w-full bg-[#121217]/80 p-10 border border-rose-500/20 rounded-3xl backdrop-blur-3xl text-center">
                <AlertTriangle className="w-8 h-8 text-rose-400 mx-auto mb-3" />
                <p className="text-gray-300">데이터를 불러오지 못했습니다.</p>
                <p className="text-xs text-gray-500 mt-1">{error}</p>
            </div>
        );
    }

    const s = summary;
    const zoneStyle = ZONE_STYLE[s.signal.zone] || ZONE_STYLE.UNKNOWN;

    return (
        <div className="w-full animate-in fade-in slide-in-from-bottom-2 duration-500 bg-[#121217]/80 p-4 lg:p-6 border border-white/10 rounded-3xl backdrop-blur-3xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] space-y-6">

            {/* ── 헤더 ─────────────────────────────────────────────── */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-black/20 p-4 rounded-2xl border border-white/5">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 shrink-0">
                        <Flag className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h2 className="text-xl font-extrabold text-white">브라질 국채 (헤알화)</h2>
                        <p className="text-sm text-gray-400 font-medium mt-0.5">AI 매크로 분석 기반 조건부 분할 진입 & 실행 플레이북</p>
                    </div>
                </div>
                <div className="text-right">
                    <p className="text-xs text-gray-500 uppercase tracking-wide">기준일</p>
                    <p className="text-sm font-bold text-gray-300">{s.as_of}</p>
                </div>
            </div>

            {/* ── AI Verdict + 다음 이벤트 D-day ───────────────────── */}
            <div className={`rounded-2xl p-5 bg-gradient-to-br ${zoneStyle.from} ${zoneStyle.to} shadow-lg`}>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                            <span className={`text-xs font-black px-2 py-0.5 rounded-full ${zoneStyle.badge} text-white uppercase tracking-wide`}>
                                Activation Zone
                            </span>
                            <span className="text-2xl font-black text-white">{s.signal.grade}</span>
                        </div>
                        <p className="text-white/95 font-semibold text-[15px] leading-relaxed">{s.signal.headline}</p>
                        <p className="text-white/80 text-sm mt-1.5">▶ {s.signal.action}</p>
                        <div className="flex gap-2 mt-3">
                            <ConditionPill ok={s.signal.rate_ok} label={`금리 14.2%↑`} />
                            <ConditionPill ok={s.signal.fx_ok} label={`환율 290원↓`} />
                        </div>
                    </div>
                    {s.next_catalyst && (
                        <div className="bg-black/25 rounded-xl px-5 py-3 text-center shrink-0 border border-white/10">
                            <div className="flex items-center gap-1.5 justify-center text-white/70 text-xs font-bold uppercase mb-1">
                                <CalendarClock className="w-3.5 h-3.5" /> 다음 관전 이벤트
                            </div>
                            <div className="text-3xl font-black text-white leading-none">D-{getDynamicDDay(s.next_catalyst.date)}</div>
                            <div className="text-xs text-white/80 mt-1 font-semibold">{s.next_catalyst.title}</div>
                            <div className="text-xs text-white/60 mt-1">{s.next_catalyst.date}</div>
                        </div>
                    )}
                </div>
            </div>

            {/* ── 지표 스코어보드 ──────────────────────────────────── */}
            <section className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <SectionTitle icon={<Gauge className="w-5 h-5 text-emerald-400" />} title="Current Market Dashboard" sub="매크로 지표 현황" />
                    <IndicatorGuide />
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {s.indicators.map((ind) => <GaugeCard key={ind.key} ind={ind} />)}
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <GaugeCard ind={{
                        key: 'real_rate',
                        label: s.real_rate.label,
                        unit: s.real_rate.unit,
                        date: s.real_rate.date ?? null,
                        value: s.real_rate.value,
                        prev: null,
                        change: null,
                        gauge: s.real_rate.gauge
                    }} />
                    <GaugeCard ind={{
                        key: 'focus_selic_eoy',
                        label: 'Focus 연말 Selic 컨센서스',
                        unit: '%',
                        date: s.focus.selic_eoy_date ?? null,
                        value: s.focus.selic_eoy,
                        prev: null,
                        change: null,
                        gauge: (s.focus as any).selic_eoy_gauge || 'gray'
                    }} />
                    <GaugeCard ind={{
                        key: 'focus_ipca_eoy',
                        label: 'Focus 연말 IPCA 컨센서스',
                        unit: '%',
                        date: s.focus.ipca_eoy_date ?? null,
                        value: s.focus.ipca_eoy,
                        prev: null,
                        change: null,
                        gauge: (s.focus as any).ipca_eoy_gauge || 'gray'
                    }} />
                    <GaugeCard ind={{
                        key: 'focus_usdbrl_eoy',
                        label: 'Focus 연말 USD/BRL',
                        unit: '',
                        date: s.focus.usdbrl_eoy_date ?? null,
                        value: s.focus.usdbrl_eoy,
                        prev: null,
                        change: null,
                        gauge: (s.focus as any).usdbrl_eoy_gauge || 'gray'
                    }} />
                </div>
            </section>

            {/* ── Activation Zone 맵 + 차트 ────────────────────────── */}
            <section className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <div className="bg-black/20 rounded-2xl border border-white/5 p-4">
                    <SectionTitle icon={<Target className="w-5 h-5 text-emerald-400" />} title="The Activation Zone" sub="2축 목표 진입 구간 맵 (금리 × 환율) · 최근 1주일 궤적 연동" />
                    <ActivationZoneChart summary={s} history={history} />
                </div>
                <div className="bg-black/20 rounded-2xl border border-white/5 p-4">
                    <SectionTitle icon={<TrendingDown className="w-5 h-5 text-cyan-400" />} title="금리 사이클" sub="Selic vs 5년물 국채금리 vs IPCA (10년)" />
                    <RateCycleChart history={history} summary={s} />
                </div>
            </section>

            <section className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <div className="bg-black/20 rounded-2xl border border-white/5 p-4">
                    <div className="flex items-start justify-between gap-2">
                        <SectionTitle icon={<ArrowDownRight className="w-5 h-5 text-amber-400" />} title="원/헤알 & 달러/헤알 환율" sub="BRL/KRW · USD/BRL 추이 (기간 선택)" />
                        <BrlTrendBadge usdbrl={s.usd_brl} />
                    </div>
                    <FxChart history={history} target={s.targets.fx_target} />
                </div>
                <div className="bg-black/20 rounded-2xl border border-white/5 p-4">
                    <SectionTitle icon={<ShieldCheck className="w-5 h-5 text-emerald-400" />} title="The Carry Cushion" sub="만기 환율별 원화 누적수익 (5년 보유)" />
                    <CarryCushionChart points={s.carry_cushion} />
                </div>
            </section>

            {/* ── AI 전략 리포트 ───────────────────────────────────── */}
            <AiReportSection insight={insight} insightAt={insightAt} genLoading={genLoading} onGenerate={generateReport} />

            {/* ── 브라질 국채 토탈리턴(Total Return) 정밀 시뮬레이터 ───────── */}
            <BrazilTotalReturnSimulator
                initialFx={s.indicators.find(i => i.key === 'brl_krw')?.value ?? 260.0}
                initialYield={s.indicators.find(i => i.key === 'y5')?.value ?? 14.0}
            />

            {/* ── 3단계 분할 매수 로드맵 ───────────────────────────── */}
            <section>
                <SectionTitle icon={<Target className="w-5 h-5 text-emerald-400" />} title="3-Tranche Execution Strategy" sub="3단계 분할 매수 로드맵" />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {s.tranches.map((t) => (
                        <TrancheCard key={t.id} t={t} currentTrancheId={s.current_tranche_id} />
                    ))}
                </div>
                <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                    <Info className="w-3 h-3" /> 비중은 유동 금융자산의 최대 5~10% 이내(위성 포지션), 만기 3~5년 스위트스팟 권장.
                </p>
            </section>

            {/* ── 10월 대선 3대 시나리오 & Tranche 3 실시간 투자 가이드 ─────── */}
            <ElectionPlaybookSection
                scenarios={s.election_scenarios}
                recommendedBonds={s.recommended_bonds}
                strategy={s.election_strategy}
                pulse={electionPulse}
                pulseAt={electionPulseAt}
                pulseGenLoading={electionPulseGenLoading}
                onGeneratePulse={() => generateElectionPulse(false)}
            />

            {/* ── 매크로 캘린더 (시계열 타임라인) ──────────────────── */}
            <section>
                <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                    <SectionTitle icon={<CalendarClock className="w-5 h-5 text-cyan-400" />} title="Macro Catalyst Timeline" sub="Q3-Q4 핵심 관전 캘린더 · 이벤트 시점의 지표 발표 일정" />
                    <button
                        onClick={() => syncCatalysts(false)}
                        disabled={catalystSyncing}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 transition shadow-sm disabled:opacity-50 cursor-pointer"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${catalystSyncing ? 'animate-spin' : ''}`} />
                        {catalystSyncing ? '이벤트 결과 갱신 중…' : '이벤트 결과 AI 자동 갱신'}
                    </button>
                </div>
                {catalystToast && (
                    <div className={`mb-3 p-3 rounded-xl text-xs font-semibold border flex items-center justify-between transition-all ${
                        catalystToast.ok ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-200' : 'bg-rose-950/60 border-rose-500/40 text-rose-200'
                    }`}>
                        <span>{catalystToast.msg}</span>
                        <button onClick={() => setCatalystToast(null)} className="text-gray-400 hover:text-white ml-2">✕</button>
                    </div>
                )}
                <MacroTimeline timeline={s.timeline} augScenarios={s.aug_scenarios} />
            </section>

            {/* ── 관련 뉴스 피드 ───────────────────────────────────── */}
            <section>
                <div className="flex flex-wrap items-start justify-between gap-2">
                    <SectionTitle icon={<Newspaper className="w-5 h-5 text-amber-400" />} title="관련 뉴스 & 정보" sub="브라질 국채·헤알·금리 관련 최신 뉴스 (자동 수집)" />
                    <div className="flex items-center gap-2.5">
                        <span className="text-[11px] text-gray-500">
                            {news.length ? `최신순 ${news.length}건` : '뉴스 없음'}
                            {newsUpdatedAt ? ` · ${newsUpdatedAt.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} 갱신` : ''}
                        </span>
                        <button
                            onClick={refreshNews}
                            disabled={newsRefreshing}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500/10 border border-amber-500/30 text-amber-300 hover:bg-amber-500/20 transition disabled:opacity-50 cursor-pointer"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${newsRefreshing ? 'animate-spin' : ''}`} />
                            {newsRefreshing ? '수집 중…' : '뉴스 업데이트'}
                        </button>
                    </div>
                </div>
                <NewsFeed news={news} loading={newsLoading} />
            </section>

            {/* ── 실행 전 최종 체크리스트 ──────────────────────────── */}
            <section>
                <SectionTitle icon={<CheckCircle2 className="w-5 h-5 text-emerald-400" />} title="Final Due Diligence Checklist" sub="매수 버튼 클릭 전 필수 확인 사항" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {s.due_diligence.map((d, i) => (
                        <div key={i} className="flex gap-3 bg-black/20 rounded-xl border border-white/5 p-4">
                            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                            <div>
                                <p className="font-bold text-white text-sm">{d.title}</p>
                                <p className="text-xs text-gray-400 mt-1 leading-relaxed">{d.body}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── 텔레그램 알림 구독 ───────────────────────────────── */}
            <BrazilAlertConfig />

            <p className="text-xs text-gray-600 leading-relaxed border-t border-white/5 pt-3">
                ※ 본 화면은 투자 권유가 아닌 판단 보조용 정보입니다. 모든 수치는 기준일 스냅샷이며 이후 변동됩니다.
                세금(IOF 포함)·환전 비용은 증권사·세무 전문가 확인이 필요합니다.
            </p>
        </div>
    );
}

// ══════════════════════════════════════════════════════════════════════════
// 하위 컴포넌트
// ══════════════════════════════════════════════════════════════════════════
function SectionTitle({ icon, title, sub }: { icon: React.ReactNode; title: string; sub: string }) {
    return (
        <div className="flex items-center gap-2.5 mb-3">
            {icon}
            <div>
                <h3 className="text-lg font-extrabold text-white leading-none">{title}</h3>
                <p className="text-xs text-gray-500 mt-1">{sub}</p>
            </div>
        </div>
    );
}

function ConditionPill({ ok, label }: { ok: boolean; label: string }) {
    return (
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${ok ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-100' : 'bg-black/25 border-white/15 text-white/60'}`}>
            {ok ? '✓' : '○'} {label}
        </span>
    );
}

// 게이지 색 hex (Activation Zone 점·범례 공용)
const GAUGE_HEX: Record<string, string> = { green: '#34d399', amber: '#f59e0b', red: '#ef4444', gray: '#9ca3af' };

// 범례용 조합 동그라미: 채움색(금리)+테두리색(환율)을 실제 차트 점과 동일하게 표현
function ComboDot({ fill, stroke }: { fill: string; stroke: string }) {
    return (
        <span className="inline-block w-3.5 h-3.5 rounded-full align-middle shrink-0"
            style={{ background: fill, border: `2px solid ${stroke}` }} />
    );
}

function getThresholdText(key: string): string {
    switch (key) {
        case 'selic': return '🟢 ≥14.0% | 🔴 <12.0%';
        case 'y5': return '🟢 14.2~14.7% | 🟡 14.7~15·13~14.2 | 🔴 >15·<13';
        case 'brl_krw': return '🟢 ≤290원 | 🔴 >300원';
        case 'ipca_mom': return '🟢 ≤0.35% | 🔴 ≥0.60%';
        case 'real_rate': return '🟢 ≥8.0%p | 🔴 <5.0%p';
        case 'focus_selic': return '🟢 ≥14.0% | 🔴 <12.0%';
        case 'focus_ipca': return '🟢 ≤4.5% | 🔴 >6.0%';
        case 'focus_usdbrl': return '🟢 ≤5.0 | 🔴 >5.5';
        default: return '';
    }
}

function GaugeCard({ ind }: { ind: Indicator }) {
    const g = GAUGE_STYLE[ind.gauge] || GAUGE_STYLE.gray;
    const chg = ind.change;
    const ruleText = getThresholdText(ind.key);
    return (
        <div className={`bg-black/20 rounded-2xl border border-white/5 p-4 ring-1 ${g.ring} flex flex-col justify-between min-h-[145px]`}>
            <div>
                <div className="flex items-center justify-between">
                    <span className="text-[12px] lg:text-[13px] text-gray-400 font-semibold">
                        {ind.label}
                        {ind.live && (
                            <span className="ml-1.5 inline-flex items-center gap-1 text-[9px] font-bold text-emerald-400 align-middle">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />실시간
                            </span>
                        )}
                    </span>
                    <span className={`w-2.5 h-2.5 rounded-full ${g.dot} shrink-0`} />
                </div>
                <div className={`text-2xl font-black mt-2 ${g.text}`}>
                    {fmt(ind.value, ind.unit === '원' ? 1 : 2)}<span className="text-sm ml-0.5 text-gray-500">{ind.unit}</span>
                </div>
                {chg !== null && chg !== undefined && Math.abs(chg) > 0.0001 ? (
                    <div className={`text-xs mt-1 font-semibold ${chg > 0 ? 'text-rose-300' : 'text-emerald-300'}`}>
                        {chg > 0 ? '▲' : '▼'} {fmt(Math.abs(chg), 2)} (직전 대비)
                    </div>
                ) : (
                    <div className="h-4 mt-1" />
                )}
            </div>
            {(ruleText || ind.date) && (
                <div className="mt-2.5 pt-2 border-t border-white/5 space-y-1">
                    {ruleText && (
                        <div className="text-[10px] lg:text-[11px] text-gray-500">
                            <span>판정 기준</span>
                            <div className="font-semibold text-gray-400 mt-0.5 leading-snug">{ruleText}</div>
                        </div>
                    )}
                    {ind.date && (
                        <div className="text-[10px] lg:text-[11px] text-gray-500 flex items-center justify-between gap-2">
                            <span className="shrink-0">확인일자</span>
                            <span className="font-semibold text-gray-400">{ind.date}</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function IndicatorGuide() {
    const [open, setOpen] = useState(false);
    return (
        <div className="relative">
            <button
                onClick={() => setOpen(!open)}
                className="text-xs font-bold px-3 py-1.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-gray-300 transition flex items-center gap-1.5"
            >
                <Info className="w-3.5 h-3.5" /> 지표 상태 판정 기준 안내
            </button>
            {open && (
                <div className="absolute right-0 mt-2 p-4 bg-[#1a1a23] border border-white/15 rounded-xl shadow-2xl text-[12px] text-gray-300 w-80 space-y-2.5 z-20 animate-in fade-in duration-200">
                    <h4 className="font-extrabold text-white text-sm border-b border-white/10 pb-1">🚦 지표별 신호등 상태 기준</h4>
                    <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                        <div>
                            <p className="font-bold text-emerald-300">기준금리 (Selic)</p>
                            <p className="text-gray-400">🟢 14.0% 이상 (고금리 매력 구간)</p>
                            <p className="text-gray-400">🟡 12.0% ~ 14.0% (점진적 인하 사이클)</p>
                            <p className="text-gray-400">🔴 12.0% 미만 (캐리 매력 저하)</p>
                        </div>
                        <div>
                            <p className="font-bold text-emerald-300">5년물 국채금리</p>
                            <p className="text-gray-400">🟢 14.2% ~ 14.7% (최적 진입 — 위기선 아래 안전 버퍼)</p>
                            <p className="text-gray-400">🟡 14.7% ~ 15.0% (천장 접근 — 고캐리이나 신중)</p>
                            <p className="text-gray-400">🟡 13.0% ~ 14.2% (매력 저하 — 캐리 축소)</p>
                            <p className="text-gray-400">🔴 15.0% 초과 (재정/대선 리스크 반영)</p>
                            <p className="text-gray-400">🔴 13.0% 미만 (캐리 부족 — 실질금리 매력 상실)</p>
                        </div>
                        <div>
                            <p className="font-bold text-emerald-300">원/헤알 환율 (BRL/KRW)</p>
                            <p className="text-gray-400">🟢 290원 이하 (환율 안전 마진 확보)</p>
                            <p className="text-gray-400">🟡 290원 ~ 300원 (주의 관망)</p>
                            <p className="text-gray-400">🔴 300원 초과 (고환율 진입 비권장)</p>
                        </div>
                        <div>
                            <p className="font-bold text-emerald-300">연말 IPCA 물가 전망</p>
                            <p className="text-gray-400">🟢 4.5% 이하 (중앙은행 관리 목표치 내)</p>
                            <p className="text-gray-400">🟡 4.5% ~ 6.0% (물가 불안정 경계)</p>
                            <p className="text-gray-400">🔴 6.0% 초과 (초인플레이션 위험)</p>
                        </div>
                        <div>
                            <p className="font-bold text-emerald-300">실질금리 (Selic - IPCA)</p>
                            <p className="text-gray-400">🟢 8.0%p 이상 (실질 고금리 매력)</p>
                            <p className="text-gray-400">🟡 5.0%p ~ 8.0%p (보통)</p>
                            <p className="text-gray-400">🔴 5.0%p 미만 (매력 저하)</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// Activation Zone: 2축 산점도 (환율 X, 금리 Y). 현재 위치 표시 & 1주간로그 클릭 시 줌인 시뮬레이션.
function ActivationZoneChart({ summary, history }: { summary: Summary; history?: Record<string, { date: string; value: number }[]> }) {
    const t = summary.targets;
    const y5 = summary.indicators.find(i => i.key === 'y5')?.value ?? null;
    const fx = summary.indicators.find(i => i.key === 'brl_krw')?.value ?? null;
    const point = (y5 !== null && fx !== null) ? [{ x: fx, y: y5 }] : [];

    // ── 1주간 로그 모드 (확대 줌인 시뮬레이션) 토글 ─────────────────────────────
    const [isLogMode, setIsLogMode] = useState<boolean>(false);

    // 1주일 이동 궤적 전체 포인트 생성 (최근 7일치 환율x금리 위치)
    const fullTrajectoryPoints = useMemo(() => {
        if (!history) return [];
        const fxList = history['brl_krw'] || [];
        const y5List = (history['y5'] && history['y5'].length > 0) ? history['y5'] : (history['y5_fred'] || []);

        if (fxList.length === 0) return [];

        const y5Map = new Map<string, number>();
        y5List.forEach(item => y5Map.set(item.date, item.value));

        let lastY5 = y5List.length > 0 ? y5List[y5List.length - 1].value : null;
        const recentFx = fxList.slice(-12);
        const list: { date: string; x: number; y: number; label: string; isToday: boolean; opacity: number }[] = [];

        recentFx.forEach((item) => {
            const date = item.date;
            const fxVal = item.value;
            const y5Val = y5Map.get(date) ?? lastY5;
            if (y5Val !== null && y5Val !== undefined) lastY5 = y5Val;

            if (fxVal !== null && y5Val !== null && y5Val !== undefined) {
                const parts = date.split('-');
                const monthDay = parts.length >= 3 ? `${parseInt(parts[1], 10)}/${parseInt(parts[2], 10)}` : date;
                list.push({ date, x: fxVal, y: y5Val, label: monthDay, isToday: false, opacity: 0.4 });
            }
        });

        const res = list.slice(-7);
        if (res.length > 0) {
            res.forEach((pt, i) => { pt.opacity = 0.35 + (i / (res.length - 1 || 1)) * 0.55; });
            const last = res[res.length - 1];
            last.isToday = true;
            if (fx !== null && y5 !== null) { last.x = fx; last.y = y5; }
        }
        return res;
    }, [history, fx, y5]);

    // ── 60fps 부드러운 유동적 점선 궤적 애니메이션 제어 (requestAnimationFrame) ─────
    const [animProgress, setAnimProgress] = useState<number>(0);
    const [isAnimating, setIsAnimating] = useState<boolean>(false);
    const animFrameRef = useRef<number | null>(null);

    const triggerAnimation = useCallback(() => {
        if (fullTrajectoryPoints.length <= 1) return;
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);

        setAnimProgress(0);
        setIsAnimating(true);

        const startTime = performance.now();
        const duration = 1800; // 1.8초간 부드럽게 흐르는 선 연결
        const maxProgress = fullTrajectoryPoints.length - 1;

        const animate = (now: number) => {
            const elapsed = now - startTime;
            const rawRatio = Math.min(elapsed / duration, 1.0);
            
            // Ease-in-out cubic 완급 조절 (부드러운 가속 및 감속)
            const easedRatio = rawRatio < 0.5
                ? 4 * rawRatio * rawRatio * rawRatio
                : 1 - Math.pow(-2 * rawRatio + 2, 3) / 2;

            const currentProgress = easedRatio * maxProgress;
            setAnimProgress(currentProgress);

            if (rawRatio < 1.0) {
                animFrameRef.current = requestAnimationFrame(animate);
            } else {
                setIsAnimating(false);
            }
        };

        animFrameRef.current = requestAnimationFrame(animate);
    }, [fullTrajectoryPoints.length]);

    useEffect(() => {
        return () => {
            if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        };
    }, []);

    // 1주간로그 버튼 클릭 시 모드 전환 및 애니메이션 발동
    const toggleLogMode = () => {
        if (!isLogMode) {
            setIsLogMode(true);
            triggerAnimation();
        } else {
            setIsLogMode(false);
            if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        }
    };

    // 실시간 연속 보간(Interpolation) 궤적 데이터
    const visibleTrajectoryPoints = useMemo(() => {
        if (!isLogMode || fullTrajectoryPoints.length === 0) return [];
        if (animProgress <= 0) return [fullTrajectoryPoints[0]];

        const currentIndex = Math.floor(animProgress);
        const fraction = animProgress - currentIndex;

        const basePoints = fullTrajectoryPoints.slice(0, currentIndex + 1);

        if (currentIndex < fullTrajectoryPoints.length - 1 && fraction > 0) {
            const p1 = fullTrajectoryPoints[currentIndex];
            const p2 = fullTrajectoryPoints[currentIndex + 1];
            const interpX = p1.x + (p2.x - p1.x) * fraction;
            const interpY = p1.y + (p2.y - p1.y) * fraction;

            return [
                ...basePoints,
                {
                    date: 'moving-tip',
                    x: interpX,
                    y: interpY,
                    label: '',
                    isToday: false,
                    opacity: 0.9,
                    isTip: true,
                }
            ];
        }

        return basePoints;
    }, [isLogMode, fullTrajectoryPoints, animProgress]);

    // 일자별 완료된 이전 점들 (라인 팁이 도달한 점만 순차 등장)
    const passedHistoricalPoints = useMemo(() => {
        if (!isLogMode || fullTrajectoryPoints.length === 0) return [];
        return fullTrajectoryPoints.filter((p, index) => !p.isToday && index <= Math.floor(animProgress));
    }, [isLogMode, fullTrajectoryPoints, animProgress]);

    const isTodayReached = !isLogMode || !isAnimating || animProgress >= fullTrajectoryPoints.length - 1;

    // 현재 위치 점·가이드선 색: 두 축 독립 판정. 가로선(금리)=금리 게이지색, 세로선(환율)=환율 게이지색.
    const rateColor = GAUGE_HEX[summary.indicators.find(i => i.key === 'y5')?.gauge || 'gray'];
    const fxColor = GAUGE_HEX[summary.indicators.find(i => i.key === 'brl_krw')?.gauge || 'gray'];

    // ── X/Y축 레인지 설정: 일반 모드는 고정 레인지, 1주간 로그 모드는 궤적 분포에 맞춰 줌인 ──
    const standardXDomain = useMemo(() => [240, 320], []);
    const standardYDomain = useMemo(() => [13.0, 15.5], []);

    const zoomedDomains = useMemo(() => {
        if (fullTrajectoryPoints.length === 0) {
            return { xDomain: [240, 320], yDomain: [13.0, 15.5] };
        }
        const xs = fullTrajectoryPoints.map(p => p.x);
        const ys = fullTrajectoryPoints.map(p => p.y);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);

        // 점선 및 일자 라벨(8/5, 8/6...)이 겹치지 않게 여유 패딩 적용
        const rangeX = maxX - minX;
        const rangeY = maxY - minY;
        const padX = Math.max(rangeX * 0.45, 3.0);
        const padY = Math.max(rangeY * 0.45, 0.20);

        const xMin = Math.floor((minX - padX) * 10) / 10;
        const xMax = Math.ceil((maxX + padX) * 10) / 10;
        const yMin = parseFloat((minY - padY).toFixed(2));
        const yMax = parseFloat((maxY + padY).toFixed(2));

        return {
            xDomain: [xMin, xMax],
            yDomain: [yMin, yMax],
        };
    }, [fullTrajectoryPoints]);

    const activeXDomain = isLogMode ? zoomedDomains.xDomain : standardXDomain;
    const activeYDomain = isLogMode ? zoomedDomains.yDomain : standardYDomain;

    const fxGap = (fx !== null && t.fx_target !== undefined) ? t.fx_target - fx : null;

    return (
        <div className="space-y-4">
            {/* 1주간로그 줌인 모드 헤더 배너 (로그 모드일 때만 표시) */}
            {isLogMode && (
                <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-sky-500/15 border border-sky-500/30 text-sky-300 text-xs font-semibold animate-in fade-in slide-in-from-top-1 duration-200">
                    <div className="flex items-center gap-2">
                        <ZoomIn className="w-4 h-4 text-sky-400 animate-pulse" />
                        <span>🔍 1주간 로그 줌인 시뮬레이션 (축 범위 정밀 확대 모드)</span>
                    </div>
                    <span className="text-[11px] text-sky-400/80">점선 궤적 & 일자별 변동 분포 상세</span>
                </div>
            )}

            <ResponsiveContainer width="100%" height={280}>
                <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                    {/* 🟢 최적 구간 (초록색 음영) */}
                    <ReferenceArea x1={240} x2={t.fx_target} y1={t.rate_floor} y2={t.rate_tranche2} fill="#10b981" fillOpacity={0.28} />

                    {/* 🟡 주의 구간 */}
                    <ReferenceArea x1={240} x2={t.fx_target} y1={t.rate_tranche2} y2={t.rate_risk} fill="#f59e0b" fillOpacity={0.25} />
                    <ReferenceArea x1={240} x2={t.fx_target} y1={13.0} y2={t.rate_floor} fill="#f59e0b" fillOpacity={0.25} />
                    <ReferenceArea x1={t.fx_target} x2={300} y1={13.0} y2={t.rate_risk} fill="#f59e0b" fillOpacity={0.25} />

                    {/* 🔴 경고 구간 */}
                    <ReferenceArea x1={240} x2={300} y1={t.rate_risk} y2={15.5} fill="#ef4444" fillOpacity={0.30} />
                    <ReferenceArea x1={300} x2={320} y1={13.0} y2={15.5} fill="#ef4444" fillOpacity={0.30} />
                    
                    {/* 목표 조건 기준선 */}
                    <ReferenceLine x={t.fx_target} stroke="#ffffff" strokeOpacity={0.8} strokeDasharray="4 4" label={{ value: '목표 290원', fill: '#ffffff', fontSize: 10, position: 'insideTopRight' }} />
                    <ReferenceLine x={300} stroke="#ef4444" strokeOpacity={0.7} strokeDasharray="3 3" label={{ value: '경고 300원', fill: '#ef4444', fontSize: 10, position: 'insideTopLeft' }} />
                    <ReferenceLine y={t.rate_floor} stroke="#ffffff" strokeOpacity={0.8} strokeDasharray="4 4" label={{ value: '목표 하한 14.2%', fill: '#ffffff', fontSize: 10, position: 'insideBottomRight' }} />
                    <ReferenceLine y={t.rate_tranche2} stroke="#ffffff" strokeOpacity={0.8} strokeDasharray="4 4" label={{ value: '목표 상한 14.7%', fill: '#ffffff', fontSize: 10, position: 'insideTopRight' }} />
                    <ReferenceLine y={t.rate_risk} stroke="#ef4444" strokeOpacity={0.7} strokeDasharray="3 3" label={{ value: '경고 15.0%', fill: '#ef4444', fontSize: 10, position: 'insideTopRight' }} />
                    
                    {/* 현재 수치 위치 가이드선 */}
                    {fx !== null && <ReferenceLine x={fx} stroke={fxColor} strokeOpacity={0.9} strokeDasharray="3 3" label={{ value: `현재 ${fx.toFixed(1)}원`, fill: fxColor, fontSize: 10, position: 'insideBottomLeft' }} />}
                    {y5 !== null && <ReferenceLine y={y5} stroke={rateColor} strokeOpacity={0.9} strokeDasharray="3 3" label={{ value: `현재 ${y5.toFixed(2)}%`, fill: rateColor, fontSize: 10, position: 'insideBottomLeft' }} />}

                    <XAxis type="number" dataKey="x" domain={activeXDomain} ticks={isLogMode ? undefined : [240, 260, 280, 290, 300, 320]} tick={{ fill: '#9ca3af', fontSize: 12 }}
                        label={{ value: '원/헤알 환율 (원)', position: 'insideBottom', offset: -10, fill: '#6b7280', fontSize: 12 }} />
                    <YAxis type="number" dataKey="y" domain={activeYDomain} tick={{ fill: '#9ca3af', fontSize: 12 }}
                        label={{ value: '5년물 금리(%)', angle: -90, position: 'insideLeft', fill: '#6b7280', fontSize: 12 }} />
                    <ZAxis range={[400, 400]} />
                    <RechartsTooltip
                        cursor={{ strokeDasharray: '3 3' }}
                        contentStyle={{ background: '#1a1a23', border: '1px solid #ffffff20', borderRadius: 8, fontSize: 12, color: '#fff' }}
                        itemStyle={{ color: '#fff' }}
                        labelStyle={{ color: '#9ca3af' }}
                        formatter={(v: any, n: any) => [fmt(v, 2), n === 'x' ? '환율' : '금리']} />

                    {/* 1주간 로그 모드일 때만 실시간 보간 점선 연결 */}
                    {isLogMode && visibleTrajectoryPoints.length > 1 && (
                        <Scatter
                            name="1주일 궤적선"
                            data={visibleTrajectoryPoints}
                            line={{ stroke: '#38bdf8', strokeWidth: 2.5, strokeDasharray: '4 4' }}
                            lineType="joint"
                            shape={() => null}
                            legendType="none"
                        />
                    )}

                    {/* 1주간 로그 모드일 때만 궤적 점들과 일자 라벨 표시 */}
                    {isLogMode && passedHistoricalPoints.length > 0 && (
                        <Scatter
                            name="1주일 궤적점"
                            data={passedHistoricalPoints}
                            shape={(props: any) => {
                                const { cx, cy, payload } = props;
                                if (cx === undefined || cy === undefined || isNaN(cx) || isNaN(cy)) return null;
                                return (
                                    <g key={`traj-dot-${payload.date}`} className="animate-in fade-in zoom-in-50 duration-300">
                                        <circle
                                            cx={cx}
                                            cy={cy}
                                            r={5}
                                            fill="#38bdf8"
                                            stroke="#0f172a"
                                            strokeWidth={1.5}
                                            opacity={payload?.opacity ?? 0.7}
                                        />
                                        <text
                                            x={cx}
                                            y={cy - 8}
                                            textAnchor="middle"
                                            fill="#38bdf8"
                                            fontSize={10}
                                            fontWeight={700}
                                            opacity={0.95}
                                        >
                                            {payload?.label}
                                        </text>
                                    </g>
                                );
                            }}
                        />
                    )}

                    {/* 이동 애니메이션 중 실시간 진행 선도 팁 헤드 */}
                    {isLogMode && isAnimating && visibleTrajectoryPoints.length > 0 && (
                        <Scatter
                            name="선도 팁"
                            data={[visibleTrajectoryPoints[visibleTrajectoryPoints.length - 1]]}
                            shape={(props: any) => {
                                const { cx, cy } = props;
                                if (cx === undefined || cy === undefined || isNaN(cx) || isNaN(cy)) return null;
                                return (
                                    <g key={`moving-tip-${cx}-${cy}`}>
                                        <circle cx={cx} cy={cy} r={8} fill="#38bdf8" opacity={0.6} className="animate-ping" style={{ transformOrigin: `${cx}px ${cy}px` }} />
                                        <circle cx={cx} cy={cy} r={5} fill="#0ea5e9" stroke="#ffffff" strokeWidth={2} />
                                    </g>
                                );
                            }}
                        />
                    )}

                    {/* 현재 위치 점: 일반 모드이거나 애니메이션 도착 시 하이라이트 발동 */}
                    {isTodayReached && (
                        <Scatter
                            name="현재 위치"
                            data={point}
                            shape={(props: any) => {
                                const { cx, cy } = props;
                                if (cx === undefined || cy === undefined || isNaN(cx) || isNaN(cy)) return null;
                                return (
                                    <g key={`pulsing-dot-${cx}-${cy}`}>
                                        {/* 핑 애니메이션 바깥 파동링 */}
                                        <circle
                                            cx={cx}
                                            cy={cy}
                                            r={14}
                                            fill={rateColor}
                                            opacity={0.6}
                                            className="animate-ping"
                                            style={{ transformOrigin: `${cx}px ${cy}px` }}
                                        />
                                        {/* 은은한 아우라 링 */}
                                        <circle
                                            cx={cx}
                                            cy={cy}
                                            r={11}
                                            fill={fxColor}
                                            opacity={0.35}
                                        />
                                        {/* 메인 하이라이트 코어 점 (펄스 애니메이션) */}
                                        <circle
                                            cx={cx}
                                            cy={cy}
                                            r={8}
                                            fill={rateColor}
                                            stroke={fxColor}
                                            strokeWidth={3}
                                            className="animate-pulse"
                                        />
                                    </g>
                                );
                            }}
                        />
                    )}
                </ScatterChart>
            </ResponsiveContainer>
            
            {/* 범례, 환율 갭 및 1주간로그 / 돌아가기 버튼 (우측 아래 위치) */}
            <div className="border-t border-white/5 pt-2.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-gray-400">
                <div className="flex items-center gap-3 flex-wrap">
                    <span className="font-semibold text-gray-300">범례 기준:</span>
                    <span className="text-emerald-300 font-medium">🟢 최적 (금리 14.2~14.7% / 환율 ≤290원)</span>
                    <span className="text-amber-300 font-medium">🟡 주의 (금리 14.7~15.0%·13~14.2% / 환율 290~300원)</span>
                    <span className="text-rose-300 font-medium">🔴 경고 (금리 &gt;15%·&lt;13% / 환율 &gt;300원)</span>
                    {isLogMode && (
                        <span className="text-sky-300 font-medium flex items-center gap-1 animate-in fade-in duration-200">
                            <span className="inline-block w-2.5 h-0.5 bg-sky-400 rounded-full"></span> 🔵 1주일 궤적 (줌인 확대)
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-2 ml-auto">
                    {fxGap !== null && fx !== null && !isLogMode && (
                        <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 font-medium">
                            <span>환율 갭:</span>
                            <span className="font-bold">{fxGap > 0 ? `+${fxGap.toFixed(1)}원 (우호)` : `${fxGap.toFixed(1)}원 (초과)`}</span>
                        </div>
                    )}

                    {/* 1주간로그 / 돌아가기 버튼 (그래프 우측 아래 위치) */}
                    <button
                        onClick={toggleLogMode}
                        className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all shadow-sm active:scale-95 ${
                            isLogMode
                                ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 ring-1 ring-amber-500/30'
                                : 'bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/40 hover:border-sky-400'
                        }`}
                        title={isLogMode ? "원래 전체 X/Y축 범위로 돌아가기" : "최근 1주일간 변동 범위로 X/Y축을 좁혀서 궤적 시뮬레이션 보기"}
                    >
                        {isLogMode ? (
                            <>
                                <ZoomOut className="w-3.5 h-3.5 text-amber-400" />
                                <span>돌아가기</span>
                            </>
                        ) : (
                            <>
                                <ZoomIn className="w-3.5 h-3.5 text-sky-400" />
                                <span>1주간로그</span>
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* 현재 그래프 수치에 따른 실시간 분석 및 종합 판정 벤토 카드 */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">현재 수치 분석 & 종합 판정</span>
                    <span className={`text-xs font-black px-2.5 py-1 rounded-full text-white ${ZONE_STYLE[summary.signal.zone]?.badge || 'bg-emerald-500'}`}>
                        {summary.signal.grade}
                    </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-black/30 rounded-xl p-2.5 border border-white/5">
                        <span className="text-gray-400 text-[11px]">현재 5년물 금리</span>
                        <div className="text-sm font-bold text-white mt-0.5">
                            {y5 !== null ? `${y5.toFixed(2)}%` : '—'}
                            <span className={`ml-1.5 text-[11px] font-medium ${rateColor === '#34d399' ? 'text-emerald-300' : rateColor === '#f59e0b' ? 'text-amber-300' : 'text-rose-300'}`}>
                                ({y5 !== null && y5 >= 14.2 && y5 <= 14.7 ? '최적 안전버퍼' : y5 !== null && y5 > 14.7 && y5 <= 15.0 ? '천장접근 경계' : '주의 구간'})
                            </span>
                        </div>
                    </div>
                    <div className="bg-black/30 rounded-xl p-2.5 border border-white/5">
                        <span className="text-gray-400 text-[11px]">현재 원/헤알 환율</span>
                        <div className="text-sm font-bold text-white mt-0.5">
                            {fx !== null ? `${fx.toFixed(1)}원` : '—'}
                            <span className={`ml-1.5 text-[11px] font-medium ${fxColor === '#34d399' ? 'text-emerald-300' : fxColor === '#f59e0b' ? 'text-amber-300' : 'text-rose-300'}`}>
                                ({fx !== null && fx <= 290 ? '저환율 우호' : '고환율 주의'})
                            </span>
                        </div>
                    </div>
                </div>
                <div className="text-xs text-gray-300 bg-black/20 rounded-xl p-2.5 border border-white/5 leading-relaxed">
                    <p className="font-semibold text-emerald-300 mb-0.5">💡 현재 진단 & 대응 지침</p>
                    <p>{summary.signal.headline}</p>
                    <p className="text-gray-400 mt-1">▶ {summary.signal.action}</p>
                </div>
            </div>
        </div>
    );
}

// 금리 사이클 커스텀 툴팁: 월간 시리즈(FRED·IPCA)도 앞채움 값(_tt_*)으로 항상 표시.
function RateCycleTooltip({ active, payload, label }: any) {
    if (!active || !payload || !payload.length) return null;
    const row = payload[0]?.payload || {};
    const items = [
        { k: '_tt_selic', name: '기준금리(Selic)', color: '#818cf8' },
        { k: '_tt_fred', name: '5년물 국채금리 (역사적/FRED)', color: '#f97316' },
        { k: '_tt_y5', name: '5년물 국채금리 (실제/최근)', color: '#34d399' },
        { k: '_tt_ipca', name: 'IPCA(12M)', color: '#fbbf24' },
    ].filter(it => row[it.k] !== undefined && row[it.k] !== null);
    return (
        <div style={{ background: '#1a1a23', border: '1px solid #ffffff20', borderRadius: 8, fontSize: 12, padding: '8px 10px' }}>
            <div style={{ color: '#9ca3af', marginBottom: 4 }}>{label}</div>
            {items.map(it => (
                <div key={it.k} style={{ color: it.color }}>{it.name} : <b>{Number(row[it.k]).toFixed(2)}</b></div>
            ))}
        </div>
    );
}

function RateCycleChart({ history, summary }: { history: Record<string, { date: string; value: number }[]>; summary?: Summary }) {
    const [range, setRange] = useState<'10Y' | '1Y' | '6M' | '3M'>('1Y');

    const selic = summary?.indicators.find(i => i.key === 'selic_target')?.value ?? null;
    const y5 = summary?.indicators.find(i => i.key === 'y5')?.value ?? null;
    const ipca12 = summary?.indicators.find(i => i.key === 'ipca_12m')?.value ?? null;
    const realRate = summary?.real_rate?.value ?? (selic !== null && ipca12 !== null ? Number((selic - ipca12).toFixed(2)) : null);

    const data = useMemo(() => {
        const merged = mergeSeries(history, ['selic_target', 'y5', 'y5_fred', 'ipca_12m']);
        if (merged.length === 0) return [];

        // Find the first index where actual y5 data starts (Option A)
        let firstActualIdx = -1;
        let firstActualDate = '';
        let firstActualVal = 0;

        for (let i = 0; i < merged.length; i++) {
            const val = merged[i].y5;
            if (val !== undefined && val !== null) {
                firstActualIdx = i;
                firstActualDate = merged[i].date;
                firstActualVal = val;
                break;
            }
        }

        // If we have actual data, adjust the y5_fred line to bridge seamlessly
        if (firstActualIdx !== -1) {
            for (let i = 0; i < merged.length; i++) {
                const pt = merged[i];
                if (i < firstActualIdx) {
                    pt.y5_fred_adjusted = pt.y5_fred;
                } else if (i === firstActualIdx) {
                    // Smooth touch point (Linear bridge)
                    pt.y5_fred_adjusted = firstActualVal;
                } else {
                    // Do not render historical line after actual starts
                    pt.y5_fred_adjusted = undefined;
                }
            }
        } else {
            // Fallback
            for (const pt of merged) {
                pt.y5_fred_adjusted = pt.y5_fred;
            }
        }

        // IPCA(12M·월간)를 마지막 발표값으로 차트 우측 끝까지 연장.
        // 12M 누적 물가는 다음 달 발표 전까지 '현재값'으로 유효한 step 지표라 중간에 선이 끊기지 않게 한다.
        let lastIpca: number | undefined;
        for (const pt of merged) {
            if (pt.ipca_12m !== undefined && pt.ipca_12m !== null) lastIpca = pt.ipca_12m;
        }
        if (lastIpca !== undefined) {
            const lastPt = merged[merged.length - 1];
            if (lastPt.ipca_12m === undefined || lastPt.ipca_12m === null) lastPt.ipca_12m = lastIpca;
        }

        // 툴팁 전용 값(_tt_*): 월간 시리즈(FRED·IPCA)를 마지막 값으로 앞채움(carry-forward)하여
        // 월중 날짜를 호버해도 모든 시리즈가 툴팁에 표시되게 한다. (선 모양은 원본 dataKey 그대로 유지)
        let ffSelic: number | undefined, ffFred: number | undefined, ffY5: number | undefined, ffIpca: number | undefined;
        for (let i = 0; i < merged.length; i++) {
            const pt = merged[i];
            if (pt.selic_target != null) ffSelic = pt.selic_target;
            if (pt.y5_fred_adjusted != null) ffFred = pt.y5_fred_adjusted;
            if (pt.y5 != null) ffY5 = pt.y5;
            if (pt.ipca_12m != null) ffIpca = pt.ipca_12m;
            pt._tt_selic = ffSelic;
            pt._tt_ipca = ffIpca;
            // FRED(역사적)는 실제 데이터 시작점까지만, 실제(y5)는 그 지점부터만 툴팁에 노출
            pt._tt_fred = (firstActualIdx === -1 || i <= firstActualIdx) ? ffFred : undefined;
            pt._tt_y5 = (firstActualIdx !== -1 && i >= firstActualIdx) ? ffY5 : undefined;
        }

        // Filter by selected date range
        const lastDateStr = merged[merged.length - 1]?.date || new Date().toISOString().split('T')[0];
        let cutoffDate = '';
        if (range !== '10Y') {
            const d = new Date(lastDateStr);
            if (range === '1Y') d.setFullYear(d.getFullYear() - 1);
            else if (range === '6M') d.setMonth(d.getMonth() - 6);
            else if (range === '3M') d.setMonth(d.getMonth() - 3);
            cutoffDate = d.toISOString().split('T')[0];
        }

        if (cutoffDate) {
            return merged.filter(pt => pt.date >= cutoffDate);
        }
        return merged;
    }, [history, range]);

    return (
        <div className="space-y-4">
            {/* Range Toggle Buttons */}
            <div className="flex justify-end items-center gap-1.5">
                {(['10Y', '1Y', '6M', '3M'] as const).map(r => (
                    <button
                        key={r}
                        onClick={() => setRange(r)}
                        className={`text-xs font-bold px-2.5 py-1 rounded-lg border transition ${
                            range === r
                                ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-300'
                                : 'bg-white/5 border-white/10 text-gray-400 hover:text-gray-200 hover:bg-white/10'
                        }`}
                    >
                        {r}
                    </button>
                ))}
            </div>

            <ResponsiveContainer width="100%" height={260}>
                <LineChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                    <XAxis dataKey="date" tick={{ fill: '#9ca3af', fontSize: 12 }} minTickGap={40} />
                    <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} domain={['auto', 'auto']} />
                    <RechartsTooltip content={<RateCycleTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line type="monotone" dataKey="selic_target" name="기준금리(Selic)" stroke="#818cf8" dot={false} strokeWidth={2} connectNulls={true} />
                    <Line type="monotone" dataKey="y5_fred_adjusted" name="5년물 국채금리 (역사적/FRED)" stroke="#f97316" dot={false} strokeWidth={2} connectNulls={true} />
                    <Line type="monotone" dataKey="y5" name="5년물 국채금리 (실제/최근)" stroke="#34d399" dot={false} strokeWidth={2} connectNulls={true} />
                    <Line type="monotone" dataKey="ipca_12m" name="IPCA(12M)" stroke="#fbbf24" dot={false} strokeWidth={1.5} connectNulls={true} />
                </LineChart>
            </ResponsiveContainer>

            {/* 슬림화된 산정기준 안내 바 */}
            <div className="border-t border-white/5 pt-2.5 text-[11px] text-gray-400">
                <span className="text-gray-400">
                    <strong className="text-gray-300">산정 기준:</strong> FRED 월간 역사적 데이터(Series: INTGSTBRM193N) × Investing.com 최근 22일 실시간 일별 시세를 선형 보간으로 매끄럽게 연동.
                </span>
            </div>

            {/* 현재 그래프 수치에 따른 실시간 금리 사이클 국면 분석 & 종합 판정 벤토 카드 */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">현재 금리 사이클 국면 분석 & 판정</span>
                    <span className="text-xs font-black px-2.5 py-1 rounded-full bg-cyan-500/20 border border-cyan-400/40 text-cyan-200">
                        {realRate !== null && realRate >= 8.0 ? '실질 고금리 피크 (캐리 최적기)' : '금리 인하 전환 관망'}
                    </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-black/30 rounded-xl p-2.5 border border-white/5">
                        <span className="text-gray-400 text-[11px]">기준금리(Selic) vs 물가(IPCA)</span>
                        <div className="text-sm font-bold text-white mt-0.5">
                            {selic !== null ? `${selic.toFixed(2)}%` : '—'} / {ipca12 !== null ? `${ipca12.toFixed(2)}%` : '—'}
                            <span className="ml-1 text-[11px] text-emerald-300 font-medium">(실질 {realRate !== null ? `${realRate.toFixed(2)}%p` : '—'})</span>
                        </div>
                    </div>
                    <div className="bg-black/30 rounded-xl p-2.5 border border-white/5">
                        <span className="text-gray-400 text-[11px]">5년물 시장금리 vs Selic</span>
                        <div className="text-sm font-bold text-white mt-0.5">
                            {y5 !== null ? `${y5.toFixed(2)}%` : '—'}
                            {y5 !== null && selic !== null && (
                                <span className={`ml-1 text-[11px] font-medium ${y5 >= selic ? 'text-amber-300' : 'text-emerald-300'}`}>
                                    ({y5 >= selic ? `+${(y5 - selic).toFixed(2)}%p 프리미엄` : `${(y5 - selic).toFixed(2)}%p 선제하락`})
                                </span>
                            )}
                        </div>
                    </div>
                </div>
                <div className="text-xs text-gray-300 bg-black/20 rounded-xl p-2.5 border border-white/5 leading-relaxed space-y-1">
                    <p className="font-semibold text-cyan-300">💡 현재 국면 사이클 분석</p>
                    <p>
                        • <strong className="text-gray-200">실질 고금리 수혜:</strong> 물가(IPCA {ipca12 ?? '—'}%)가 둔화된 반면 Selic({selic ?? '—'}%) 고금리가 유지되어 <strong>실질금리 {realRate ?? '—'}%p</strong>의 강력한 이자 쿠션(Carry)이 형성된 구간입니다.
                    </p>
                    <p>
                        • <strong className="text-gray-200">채권 자본차익 기회:</strong> 역사적으로 물가가 꺾이고 Copom의 Selic 인하 사이클이 시작되기 직전 5년물 국채금리가 피크(고점)를 찍으므로, 현 구간은 높은 이자수익과 향후 금리 하락 시 채권 매매 차익을 함께 노릴 수 있는 최적기입니다.
                    </p>
                </div>
            </div>
        </div>
    );
}

// 헤알 강세/약세 뱃지: USD/BRL 하락 = 헤알 강세. 현재 USD/BRL + 직전 대비 표시.
function BrlTrendBadge({ usdbrl }: { usdbrl?: Summary['usd_brl'] }) {
    if (!usdbrl || usdbrl.value === null || usdbrl.value === undefined) return null;
    const trend = usdbrl.brl_trend || 'flat';
    const style = trend === 'strong'
        ? { cls: 'bg-emerald-500/15 border-emerald-400/40 text-emerald-200', label: '헤알 강세', arrow: '▲' }
        : trend === 'weak'
            ? { cls: 'bg-rose-500/15 border-rose-400/40 text-rose-200', label: '헤알 약세', arrow: '▼' }
            : { cls: 'bg-white/5 border-white/15 text-gray-300', label: '보합', arrow: '─' };
    const chg = usdbrl.change;
    return (
        <div className={`shrink-0 rounded-xl border px-3 py-1.5 text-right ${style.cls}`}>
            <div className="text-[10px] font-bold uppercase tracking-wide opacity-80 flex items-center gap-1 justify-end">
                USD/BRL {usdbrl.live && <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />}
            </div>
            <div className="text-sm font-black leading-tight">{fmt(usdbrl.value, 4)}</div>
            <div className="text-[11px] font-bold">{style.arrow} {style.label}
                {chg !== null && chg !== undefined && Math.abs(chg) > 0.0001 && (
                    <span className="opacity-70"> ({chg > 0 ? '+' : ''}{fmt(chg, 4)})</span>
                )}
            </div>
        </div>
    );
}

function FxChart({ history, target }: { history: Record<string, { date: string; value: number }[]>; target: number }) {
    const [range, setRange] = useState<'1M' | '3M' | '6M' | '1Y' | '3Y' | '10Y'>('1Y');

    const data = useMemo(() => {
        const merged = mergeSeries(history, ['brl_krw', 'usd_brl']);
        if (merged.length === 0 || range === '10Y') return merged;
        const lastDateStr = merged[merged.length - 1]?.date || new Date().toISOString().split('T')[0];
        const d = new Date(lastDateStr);
        if (range === '1M') d.setMonth(d.getMonth() - 1);
        else if (range === '3M') d.setMonth(d.getMonth() - 3);
        else if (range === '6M') d.setMonth(d.getMonth() - 6);
        else if (range === '1Y') d.setFullYear(d.getFullYear() - 1);
        else if (range === '3Y') d.setFullYear(d.getFullYear() - 3);
        const cutoff = d.toISOString().split('T')[0];
        return merged.filter(pt => pt.date >= cutoff);
    }, [history, range]);

    return (
        <div className="space-y-3">
            <div className="flex justify-end items-center gap-1.5">
                {(['1M', '3M', '6M', '1Y', '3Y', '10Y'] as const).map(r => (
                    <button
                        key={r}
                        onClick={() => setRange(r)}
                        className={`text-xs font-bold px-2.5 py-1 rounded-lg border transition ${
                            range === r
                                ? 'bg-amber-500/20 border-amber-400/50 text-amber-300'
                                : 'bg-white/5 border-white/10 text-gray-400 hover:text-gray-200 hover:bg-white/10'
                        }`}
                    >
                        {r}
                    </button>
                ))}
            </div>
            <ResponsiveContainer width="100%" height={260}>
                <LineChart data={data} margin={{ top: 5, right: 6, bottom: 5, left: -10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                    <XAxis dataKey="date" tick={{ fill: '#9ca3af', fontSize: 12 }} minTickGap={40} />
                    <YAxis yAxisId="krw" tick={{ fill: '#fbbf24', fontSize: 11 }} domain={['auto', 'auto']} width={44} />
                    <YAxis yAxisId="brl" orientation="right" tick={{ fill: '#60a5fa', fontSize: 11 }} domain={['auto', 'auto']} width={40} />
                    <RechartsTooltip contentStyle={{ background: '#1a1a23', border: '1px solid #ffffff20', borderRadius: 8, fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <ReferenceLine yAxisId="krw" y={target} stroke="#34d399" strokeDasharray="5 5" label={{ value: `타겟 ${target}원`, fill: '#34d399', fontSize: 11, position: 'insideTopRight' }} />
                    <Line yAxisId="krw" type="monotone" dataKey="brl_krw" name="원/헤알(좌)" stroke="#fbbf24" dot={false} strokeWidth={2} connectNulls={true} />
                    <Line yAxisId="brl" type="monotone" dataKey="usd_brl" name="달러/헤알(우)" stroke="#60a5fa" dot={false} strokeWidth={2} connectNulls={true} />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}

function CarryCushionChart({ points }: { points: CarryPoint[] }) {
    const data = points.map(p => ({ label: `${p.fx_end}원`, ret: p.total_return_pct, be: p.is_breakeven }));
    return (
        <ResponsiveContainer width="100%" height={260}>
            <LineChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis dataKey="label" tick={{ fill: '#9ca3af', fontSize: 12 }} />
                <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} unit="%" />
                <RechartsTooltip contentStyle={{ background: '#1a1a23', border: '1px solid #ffffff20', borderRadius: 8, fontSize: 12 }}
                    formatter={(v: any) => [`${fmt(v, 1)}%`, '원화 누적수익']} />
                <ReferenceLine y={0} stroke="#f59e0b" strokeDasharray="5 5" label={{ value: '손익분기', fill: '#f59e0b', fontSize: 12, position: 'insideBottomRight' }} />
                <Line type="monotone" dataKey="ret" name="원화 누적수익" stroke="#34d399" strokeWidth={2.5}
                    dot={{ r: 3, fill: '#34d399' }} />
            </LineChart>
        </ResponsiveContainer>
    );
}

function ScenarioCard({ sc }: { sc: { id: string; title: string; color: string; logic: string; action: string } }) {
    const border = sc.color === 'green' ? 'border-emerald-500/40'
                 : sc.color === 'red' ? 'border-rose-500/40'
                 : sc.color === 'purple' || sc.color === 'indigo' ? 'border-purple-500/50'
                 : 'border-amber-500/40';
    const badge = sc.color === 'green' ? 'bg-emerald-500'
                : sc.color === 'red' ? 'bg-rose-600'
                : sc.color === 'purple' || sc.color === 'indigo' ? 'bg-purple-600'
                : 'bg-amber-500';
    const actionBg = sc.color === 'green' ? 'bg-emerald-500/15 text-emerald-200'
                   : sc.color === 'red' ? 'bg-rose-500/15 text-rose-200'
                   : sc.color === 'purple' || sc.color === 'indigo' ? 'bg-purple-500/15 text-purple-200'
                   : 'bg-amber-500/15 text-amber-200';
    return (
        <div className={`bg-black/30 rounded-2xl border ${border} p-3.5 flex flex-col gap-2`}>
            <div className="flex items-center gap-2">
                <span className={`w-6 h-6 rounded-full ${badge} text-white text-xs font-black flex items-center justify-center shrink-0`}>{sc.id}</span>
                <span className="font-bold text-white text-xs leading-snug">{sc.title}</span>
            </div>
            <p className="text-xs text-gray-400 leading-relaxed"><span className="text-gray-500">시장 논리 · </span>{sc.logic}</p>
            <div className={`text-xs font-semibold rounded-lg px-2.5 py-1.5 mt-auto ${actionBg}`}>▶ {sc.action}</div>
        </div>
    );
}

function TrancheCard({ t, currentTrancheId }: {
    t: { id: number; weight: string; timing: string; trigger: string; rationale: string };
    currentTrancheId?: number;
}) {
    // 10월 대선 전후(10/1~) 시점이면 과거 캐시(2)를 넘어서 최소 3단계로 강제 상향 보정
    const dateBasedId = new Date() >= new Date("2026-10-01") ? 3 : (new Date() >= new Date("2026-08-06") ? 2 : 1);
    const activeId = Math.max(currentTrancheId ?? 1, dateBasedId);
    const isCurrent = t.id === activeId;
    const isCompleted = t.id < activeId;

    // 과거 캐시로 인해 타이밍 텍스트가 과거 시점으로 남아있는 경우 실시간 최신 텍스트로 보정
    let displayTiming = t.timing;
    if (t.id === 2 && displayTiming.includes("8월 초")) {
        displayTiming = "8~9월 (Copom 8·9월 후 완료)";
    } else if (t.id === 3 && displayTiming === "10월 대선 전후") {
        displayTiming = `10월 대선 전후 (${getElectionDDayLabel()})`;
    }

    return (
        <div className={`rounded-2xl p-4 transition-all duration-300 relative ${
            isCurrent
                ? 'bg-gradient-to-br from-emerald-900/40 via-emerald-950/30 to-black/40 border-2 border-emerald-400 shadow-[0_0_25px_rgba(16,185,129,0.25)] ring-1 ring-emerald-400/50 animate-pulse'
                : isCompleted
                    ? 'bg-gradient-to-br from-emerald-950/10 to-black/20 border border-emerald-500/30 opacity-90'
                    : 'bg-gradient-to-br from-emerald-950/10 to-black/20 border border-white/5 opacity-60'
        }`}>
            {isCurrent && (
                <span className="absolute -top-2.5 right-4 bg-emerald-400 text-black text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-md">
                    🎯 CURRENT STAGE (현재 실행 구간)
                </span>
            )}
            {isCompleted && (
                <span className="absolute -top-2.5 right-4 bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                    ✓ 실행 완료
                </span>
            )}
            <div className="flex items-center justify-between mb-2">
                <span className={`font-black ${isCurrent ? 'text-emerald-300 text-base' : 'text-white'}`}>Tranche {t.id}</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isCurrent ? 'bg-emerald-400 text-black font-black' : isCompleted ? 'text-emerald-300 bg-emerald-500/20' : 'text-emerald-300 bg-emerald-500/15'}`}>{t.weight}</span>
            </div>
            <p className="text-xs text-gray-400 mb-1">{displayTiming}</p>
            <p className="text-xs text-gray-200"><span className="text-emerald-400 font-bold">Trigger · </span>{t.trigger}</p>
            <p className="text-xs text-gray-400 mt-1"><span className="text-gray-500">Rationale · </span>{t.rationale}</p>
        </div>
    );
}

// ── 🇧🇷 2026 브라질 대선 종합 인텔리전스 팝업 모달 ──────────────────────────────
function BrazilElectionDetailModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
    const [intel, setIntel] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [aiRefreshing, setAiRefreshing] = useState(false);
    const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
    const [showManualEditor, setShowManualEditor] = useState(false);
    const [editMode, setEditMode] = useState<'first_round' | 'event'>('first_round');

    // 1차 투표 결과 폼
    const [frStatus, setFrStatus] = useState('개표 완료');
    const [frLula, setFrLula] = useState<number>(48.2);
    const [frFlavio, setFrFlavio] = useState<number>(43.5);
    const [frOthers, setFrOthers] = useState<number>(8.3);
    const [frTurnout, setFrTurnout] = useState<number>(81.2);
    const [frRunoff, setFrRunoff] = useState<boolean>(true);
    const [frSummary, setFrSummary] = useState('과반 득표자 부재로 룰라와 플라비우 보우소나루 2인의 10월 25일 결선 대결 확정');

    // 신규 이벤트 폼
    const [evDate, setEvDate] = useState('2026-10-05');
    const [evTitle, setEvTitle] = useState('');
    const [evDetail, setEvDetail] = useState('');
    const [savingManual, setSavingManual] = useState(false);

    const fetchIntel = useCallback(async () => {
        try {
            setLoading(true);
            const res = await fetch(`${API_BASE}/api/v1/brazil-bond/election-intel?auto_refresh=false`, { cache: 'no-store' });
            if (res.ok) {
                const data = await res.json();
                if (data?.content) {
                    setIntel(data.content);
                }
            }
        } catch (e) {
            console.error('Failed to load election intel:', e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.body.style.overflow = 'hidden';
        window.addEventListener('keydown', handleKeyDown);
        fetchIntel();
        return () => {
            document.body.style.overflow = 'unset';
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, onClose, fetchIntel]);

    const handleAiRefresh = async () => {
        try {
            setAiRefreshing(true);
            const res = await fetch(`${API_BASE}/api/v1/brazil-bond/election-intel/refresh`, { method: 'POST' });
            if (res.ok) {
                const data = await res.json();
                if (data?.content) {
                    setIntel(data.content);
                }
                setToast({ msg: '최신 뉴스와 시장 지표를 기반으로 대선 인텔리전스가 AI 자동 갱신되었습니다!', ok: true });
            } else {
                const err = await res.json().catch(() => ({}));
                setToast({ msg: `AI 갱신 실패: ${err.detail || '오류 발생'}`, ok: false });
            }
        } catch (e: any) {
            setToast({ msg: `네트워크 오류: ${e.message}`, ok: false });
        } finally {
            setAiRefreshing(false);
            setTimeout(() => setToast(null), 5000);
        }
    };

    const handleSaveFirstRound = async () => {
        try {
            setSavingManual(true);
            const payload = {
                ...(intel || {}),
                phase: frRunoff ? 'runoff_campaign' : 'decided',
                first_round: {
                    status: frStatus,
                    lula_pct: Number(frLula),
                    flavio_pct: Number(frFlavio),
                    others_pct: Number(frOthers),
                    turnout_pct: Number(frTurnout),
                    runoff: frRunoff,
                    summary: frSummary,
                },
            };
            const res = await fetch(`${API_BASE}/api/v1/brazil-bond/election-intel`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (res.ok) {
                const data = await res.json();
                if (data?.content) {
                    setIntel(data.content);
                }
                setShowManualEditor(false);
                setToast({ msg: '1차 투표 공식 결과가 수동 반영되었습니다!', ok: true });
            } else {
                const err = await res.json().catch(() => ({}));
                setToast({ msg: `저장 실패: ${err.detail || '오류'}`, ok: false });
            }
        } catch (e: any) {
            setToast({ msg: `오류: ${e.message}`, ok: false });
        } finally {
            setSavingManual(false);
            setTimeout(() => setToast(null), 5000);
        }
    };

    const handleAddEvent = async () => {
        if (!evTitle.trim()) return;
        try {
            setSavingManual(true);
            const res = await fetch(`${API_BASE}/api/v1/brazil-bond/election-intel/events`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ date: evDate, title: evTitle.trim(), detail: evDetail.trim() }),
            });
            if (res.ok) {
                const data = await res.json();
                if (data?.content) {
                    setIntel(data.content);
                }
                setEvTitle('');
                setEvDetail('');
                setShowManualEditor(false);
                setToast({ msg: '신규 이벤트가 타임라인에 등록되었습니다!', ok: true });
            } else {
                const err = await res.json().catch(() => ({}));
                setToast({ msg: `저장 실패: ${err.detail || '오류'}`, ok: false });
            }
        } catch (e: any) {
            setToast({ msg: `오류: ${e.message}`, ok: false });
        } finally {
            setSavingManual(false);
            setTimeout(() => setToast(null), 5000);
        }
    };

    if (!isOpen) return null;
    if (typeof document === 'undefined') return null;

    const polls = intel?.polls || [
        { pollster: 'Quaest', date: '2026-09-28', lula: 42.0, flavio: 42.0, other: 16.0, margin: '±2.0%p', note: '결선 가상대결 42% 완전 동률', url: 'https://valorinternational.globo.com/politics/news/2026/09/28/new-quaest-poll-shows-lula-and-flavio-tied-at-42percent-in-runoff.ghtml' },
        { pollster: 'AtlasIntel', date: '2026-10-01', lula: 47.6, flavio: 47.7, other: 4.7, margin: '±1.5%p', note: '0.1%p 차 사실상 동률', url: 'https://www.reuters.com/world/americas/brazil-vote-approaches-with-lula-and-bolsonaro-polling-close-race-2026-10-01/' },
    ];

    const events = intel?.events || [
        { date: '2026-09-28', title: 'Quaest 결선 가상대결 42% 동률', detail: '표본오차 ±2%p 내 완전 동률' },
        { date: '2026-10-01', title: 'AtlasIntel 47.6% vs 47.7%', detail: '로이터: 룰라·보우소나루 초접전 속 투표 임박' },
    ];

    return createPortal(
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
            onClick={onClose}
        >
            <div
                className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-gradient-to-b from-[#0e1726] via-[#090e17] to-[#04070d] border border-amber-500/40 rounded-3xl shadow-[0_0_50px_rgba(245,158,11,0.25)] overflow-hidden text-white my-auto"
                onClick={(e) => e.stopPropagation()}
            >
                {/* 1) 헤더 */}
                <div className="flex items-center justify-between px-6 py-5 border-b border-white/10 bg-white/[0.02]">
                    <div className="flex items-center gap-3">
                        <span className="p-2.5 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                            <Vote className="w-6 h-6" />
                        </span>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="text-[11px] font-black px-2.5 py-0.5 rounded-md bg-amber-400 text-black uppercase tracking-wider">
                                    Special Intelligence
                                </span>
                                <span className="text-xs text-amber-400 font-mono">1차: 2026.10.04 · 2차 결선: 2026.10.25</span>
                            </div>
                            <h2 className="text-lg sm:text-xl font-black text-white mt-1">
                                🇧🇷 2026 브라질 대통령 선거 종합 브리핑 & 채권 시장 영향
                            </h2>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-xl bg-white/5 hover:bg-white/15 text-gray-400 hover:text-white border border-white/10 transition-all cursor-pointer"
                        title="닫기 (ESC)"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* 1-1) 실시간 액션 바 (AI 자동 갱신 + 수동 결과 입력) */}
                <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3 bg-white/[0.03] border-b border-white/10">
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span>기준일: <strong className="text-gray-200">{intel?.as_of || '2026-10-03'}</strong></span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-white/10 text-amber-300">
                            {intel?.phase === 'runoff_campaign' ? '2차 결선 선거전' : intel?.phase === 'decided' ? '당선 확정' : '1차 투표 진행/집계'}
                        </span>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleAiRefresh}
                            disabled={aiRefreshing}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 transition disabled:opacity-50 cursor-pointer shadow-sm"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${aiRefreshing ? 'animate-spin' : ''}`} />
                            {aiRefreshing ? '뉴스·결과 분석 중…' : '최신 뉴스·결과 AI 갱신'}
                        </button>
                        <button
                            onClick={() => setShowManualEditor(!showManualEditor)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 transition cursor-pointer shadow-sm"
                        >
                            <Edit3 className="w-3.5 h-3.5" />
                            {showManualEditor ? '입력창 닫기' : '수동 결과·이벤트 입력'}
                        </button>
                    </div>
                </div>

                {/* 알림 토스트 */}
                {toast && (
                    <div className={`mx-6 mt-4 p-3 rounded-xl text-xs font-semibold flex items-center justify-between border ${
                        toast.ok ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-200' : 'bg-rose-950/60 border-rose-500/40 text-rose-200'
                    }`}>
                        <span>{toast.msg}</span>
                        <button onClick={() => setToast(null)} className="text-gray-400 hover:text-white">✕</button>
                    </div>
                )}

                {/* 1-2) 수동 입력 패널 (Drawer) */}
                {showManualEditor && (
                    <div className="mx-6 mt-4 p-5 rounded-2xl bg-[#0b121e] border border-amber-500/40 space-y-4 animate-in slide-in-from-top duration-200">
                        <div className="flex items-center justify-between border-b border-white/10 pb-3">
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setEditMode('first_round')}
                                    className={`px-3 py-1 rounded-lg text-xs font-bold border transition ${
                                        editMode === 'first_round'
                                            ? 'bg-amber-500 text-black border-amber-400'
                                            : 'bg-white/5 text-gray-400 border-white/10 hover:text-white'
                                    }`}
                                >
                                    🗳️ 1차 투표 공식 집계 결과 입력
                                </button>
                                <button
                                    onClick={() => setEditMode('event')}
                                    className={`px-3 py-1 rounded-lg text-xs font-bold border transition ${
                                        editMode === 'event'
                                            ? 'bg-cyan-500 text-black border-cyan-400'
                                            : 'bg-white/5 text-gray-400 border-white/10 hover:text-white'
                                    }`}
                                >
                                    📰 신규 이벤트·뉴스 1건 추가
                                </button>
                            </div>
                            <span className="text-[11px] text-gray-400">수동 입력 시 24시간 동안 AI 자동 덮어쓰기 방지</span>
                        </div>

                        {editMode === 'first_round' ? (
                            <div className="space-y-3 text-xs">
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    <div>
                                        <label className="text-gray-400 block mb-1">개표 상태</label>
                                        <input
                                            type="text"
                                            value={frStatus}
                                            onChange={e => setFrStatus(e.target.value)}
                                            className="w-full px-2.5 py-1.5 rounded-lg bg-black/50 border border-white/10 text-white font-semibold"
                                            placeholder="예: 개표 완료 (99.8%)"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-rose-400 block mb-1">룰라 득표율 (%)</label>
                                        <input
                                            type="number"
                                            step="0.1"
                                            value={frLula}
                                            onChange={e => setFrLula(Number(e.target.value))}
                                            className="w-full px-2.5 py-1.5 rounded-lg bg-black/50 border border-white/10 text-rose-300 font-mono font-bold"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-blue-400 block mb-1">플라비우 득표율 (%)</label>
                                        <input
                                            type="number"
                                            step="0.1"
                                            value={frFlavio}
                                            onChange={e => setFrFlavio(Number(e.target.value))}
                                            className="w-full px-2.5 py-1.5 rounded-lg bg-black/50 border border-white/10 text-blue-300 font-mono font-bold"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-gray-400 block mb-1">기타 후보군 (%)</label>
                                        <input
                                            type="number"
                                            step="0.1"
                                            value={frOthers}
                                            onChange={e => setFrOthers(Number(e.target.value))}
                                            className="w-full px-2.5 py-1.5 rounded-lg bg-black/50 border border-white/10 text-gray-300 font-mono"
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-gray-400 block mb-1">전국 투표율 (%)</label>
                                        <input
                                            type="number"
                                            step="0.1"
                                            value={frTurnout}
                                            onChange={e => setFrTurnout(Number(e.target.value))}
                                            className="w-full px-2.5 py-1.5 rounded-lg bg-black/50 border border-white/10 text-white font-mono"
                                        />
                                    </div>
                                    <div className="flex items-center gap-2 pt-5">
                                        <input
                                            type="checkbox"
                                            id="runoffCheck"
                                            checked={frRunoff}
                                            onChange={e => setFrRunoff(e.target.checked)}
                                            className="accent-amber-400 w-4 h-4 cursor-pointer"
                                        />
                                        <label htmlFor="runoffCheck" className="text-amber-300 font-bold cursor-pointer">
                                            과반 득표자 부재로 10월 25일 2차 결선투표 확정
                                        </label>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-gray-400 block mb-1">결과 총평 요약</label>
                                    <input
                                        type="text"
                                        value={frSummary}
                                        onChange={e => setFrSummary(e.target.value)}
                                        className="w-full px-2.5 py-1.5 rounded-lg bg-black/50 border border-white/10 text-white"
                                        placeholder="1차 개표 결과 및 시장 영향 한 줄 요약"
                                    />
                                </div>
                                <div className="flex justify-end pt-2">
                                    <button
                                        onClick={handleSaveFirstRound}
                                        disabled={savingManual}
                                        className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold disabled:opacity-50 cursor-pointer shadow-md"
                                    >
                                        {savingManual ? '반영 중...' : '1차 투표 결과 저장 및 적용'}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-3 text-xs">
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div>
                                        <label className="text-gray-400 block mb-1">일자 (YYYY-MM-DD)</label>
                                        <input
                                            type="text"
                                            value={evDate}
                                            onChange={e => setEvDate(e.target.value)}
                                            className="w-full px-2.5 py-1.5 rounded-lg bg-black/50 border border-white/10 text-white font-mono"
                                        />
                                    </div>
                                    <div className="sm:col-span-2">
                                        <label className="text-gray-400 block mb-1">이벤트 제목 / 속보</label>
                                        <input
                                            type="text"
                                            value={evTitle}
                                            onChange={e => setEvTitle(e.target.value)}
                                            className="w-full px-2.5 py-1.5 rounded-lg bg-black/50 border border-white/10 text-white font-semibold"
                                            placeholder="예: 1차 투표 공식 결과 발표: 룰라 48.2% vs 플라비우 43.5%"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-gray-400 block mb-1">상세 내용 / 시장 영향</label>
                                    <textarea
                                        rows={2}
                                        value={evDetail}
                                        onChange={e => setEvDetail(e.target.value)}
                                        className="w-full px-2.5 py-1.5 rounded-lg bg-black/50 border border-white/10 text-white"
                                        placeholder="상세 판세, 지지 선언, 국채 금리 반응 등"
                                    />
                                </div>
                                <div className="flex justify-end pt-2">
                                    <button
                                        onClick={handleAddEvent}
                                        disabled={savingManual || !evTitle.trim()}
                                        className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-bold disabled:opacity-50 cursor-pointer shadow-md"
                                    >
                                        {savingManual ? '추가 중...' : '신규 이벤트 타임라인에 추가'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* 2) 모달 본문 (스크롤) */}
                <div className="flex-1 overflow-y-auto p-5 sm:p-7 space-y-6 text-sm">
                    {/* 상단 브리핑 요약 배너 */}
                    <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-amber-500/15 via-yellow-500/10 to-amber-500/15 border border-amber-400/30">
                        <div className="flex items-start gap-3">
                            <Info className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                            <div className="space-y-1 text-xs sm:text-sm text-gray-200 leading-relaxed">
                                <p className="font-bold text-amber-300">
                                    "{intel?.headline || '결선 진출 후보 확정 vs 부동층 16%의 표심 이동과 결선 투표율이 승부를 가르는 초박빙 선거전'}"
                                </p>
                                <p className="text-gray-300 text-xs">
                                    {intel?.summary || '브라질 대통령선거 2차 투표(결선투표)는 2026년 10월 25일 일요일에 실시될 예정입니다. 다만 1차 투표가 10월 4일이므로, 어느 후보도 유효표 과반을 얻지 못할 경우에만 상위 2명이 결선에 진출합니다.'}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* 🗳️ 1차 투표 공식 결과 배너 (저장된 경우 표시) */}
                    {intel?.first_round && (
                        <div className="p-5 rounded-2xl bg-gradient-to-r from-cyan-950/50 via-[#0e1b2e] to-purple-950/50 border-2 border-cyan-400 shadow-[0_0_30px_rgba(6,182,212,0.3)] space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="flex items-center gap-2 text-sm font-black text-cyan-300">
                                    <Vote className="w-5 h-5 text-cyan-400 animate-pulse" />
                                    🗳️ 1차 투표 공식 집계 결과 (2026.10.04)
                                </span>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold">
                                        {intel.first_round.status || '개표 완료'}
                                    </span>
                                    {intel.first_round.turnout_pct && (
                                        <span className="text-xs text-gray-400 font-mono">
                                            투표율: {intel.first_round.turnout_pct}%
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="space-y-2">
                                <div className="flex justify-between text-xs font-bold">
                                    <span className="text-rose-400">룰라 {intel.first_round.lula_pct}%</span>
                                    <span className="text-gray-400">기타 후보군 {intel.first_round.others_pct}%</span>
                                    <span className="text-blue-400">플라비우 {intel.first_round.flavio_pct}%</span>
                                </div>
                                <div className="h-4 w-full bg-gray-800 rounded-full overflow-hidden flex shadow-inner">
                                    <div className="bg-rose-500 h-full transition-all" style={{ width: `${intel.first_round.lula_pct}%` }} title={`룰라 ${intel.first_round.lula_pct}%`} />
                                    <div className="bg-gray-600 h-full transition-all" style={{ width: `${intel.first_round.others_pct}%` }} title={`기타 ${intel.first_round.others_pct}%`} />
                                    <div className="bg-blue-500 h-full transition-all" style={{ width: `${intel.first_round.flavio_pct}%` }} title={`플라비우 ${intel.first_round.flavio_pct}%`} />
                                </div>
                            </div>
                            <div className="p-3 rounded-xl bg-black/40 border border-white/10 text-xs text-gray-200 flex flex-wrap items-center justify-between gap-2">
                                <span>{intel.first_round.summary}</span>
                                {intel.first_round.runoff && (
                                    <span className="px-2.5 py-1 rounded bg-amber-400 text-black font-black text-xs shadow-md">
                                        2차 결선 진출 확정 (10월 25일)
                                    </span>
                                )}
                            </div>
                        </div>
                    )}

                    {/* 섹션 1: 제도와 공식 일정 */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <CalendarClock className="w-4 h-4 text-cyan-400" />
                            <h3 className="font-bold text-white text-base">선거 제도 및 주요 일정</h3>
                        </div>
                        <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/30">
                            <table className="w-full text-left text-xs sm:text-sm">
                                <thead>
                                    <tr className="border-b border-white/10 bg-white/5 text-gray-400">
                                        <th className="py-2.5 px-4 font-bold w-1/3">항목</th>
                                        <th className="py-2.5 px-4 font-bold">내용 및 규정</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5 text-gray-200">
                                    <tr>
                                        <td className="py-3 px-4 font-semibold text-cyan-300">1차 투표</td>
                                        <td className="py-3 px-4">
                                            <span className="font-bold text-white">2026년 10월 4일 (일)</span>
                                            <span className="text-xs text-gray-400 ml-2">
                                                (현지 기준 08:00 ~ 17:00 진행, 전자투표 기반으로 개표 및 당선 윤곽 신속 발표)
                                            </span>
                                            <a href="https://www.aa.com.tr/en/politics/explainer-what-to-know-about-brazils-2026-presidential-election/4074737" target="_blank" rel="noopener noreferrer" className="ml-1 text-[11px] text-cyan-400 underline hover:text-cyan-300">[aa.com]</a>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td className="py-3 px-4 font-semibold text-amber-300">결선투표 (2차 투표)</td>
                                        <td className="py-3 px-4">
                                            <span className="font-bold text-white">2026년 10월 25일 (일)</span>
                                            <span className="text-xs text-gray-400 ml-2">(1차에서 과반 미달 시 필요에 따라 실시)</span>
                                            <a href="https://www.aa.com.tr/en/politics/explainer-what-to-know-about-brazils-2026-presidential-election/4074737" target="_blank" rel="noopener noreferrer" className="ml-1 text-[11px] text-cyan-400 underline hover:text-cyan-300">[aa.com]</a>
                                            <a href="https://www.reuters.com/world/americas/brazil-vote-approaches-with-lula-and-bolsonaro-polling-close-race-2026-10-01/" target="_blank" rel="noopener noreferrer" className="ml-1 text-[11px] text-cyan-400 underline hover:text-cyan-300">[reuters]</a>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td className="py-3 px-4 font-semibold text-gray-300">결선 조건</td>
                                        <td className="py-3 px-4 text-xs sm:text-sm">
                                            1차 투표에서 유효표의 과반(50% + 1표)을 얻은 후보가 없을 때 결선투표 진행
                                            <a href="https://www.democrata.es/en/center-of-surveys-and-electoral-polls/surveys-brazil-elections-lula-leads-bolsonaro-in-the-first-round-but-the-result-evens-out-in-the-second/" target="_blank" rel="noopener noreferrer" className="ml-1 text-[11px] text-cyan-400 underline hover:text-cyan-300">[democrata]</a>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td className="py-3 px-4 font-semibold text-gray-300">결선 진출자</td>
                                        <td className="py-3 px-4 text-xs sm:text-sm">
                                            1차 득표 상위 1위 및 2위 후보 맞대결 (군소후보 탈락)
                                            <a href="https://www.democrata.es/en/center-of-surveys-and-electoral-polls/surveys-brazil-elections-lula-leads-bolsonaro-in-the-first-round-but-the-result-evens-out-in-the-second/" target="_blank" rel="noopener noreferrer" className="ml-1 text-[11px] text-cyan-400 underline hover:text-cyan-300">[democrata]</a>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td className="py-3 px-4 font-semibold text-gray-300">승리 기준</td>
                                        <td className="py-3 px-4 text-xs sm:text-sm">
                                            결선의 유효표 최다 득표자 당선 (백지표 및 무효표는 모수에서 완전 제외)
                                            <a href="https://www.democrata.es/en/center-of-surveys-and-electoral-polls/surveys-brazil-elections-lula-leads-bolsonaro-in-the-first-round-but-the-result-evens-out-in-the-second/" target="_blank" rel="noopener noreferrer" className="ml-1 text-[11px] text-cyan-400 underline hover:text-cyan-300">[democrata]</a>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td className="py-3 px-4 font-semibold text-gray-300">투표 방식</td>
                                        <td className="py-3 px-4 text-xs sm:text-sm">
                                            전면 <span className="font-bold text-emerald-400">전자투표 시스템(Urna Eletrônica)</span> 기반 전국 집계
                                            <a href="https://www.aa.com.tr/en/politics/explainer-what-to-know-about-brazils-2026-presidential-election/4074737" target="_blank" rel="noopener noreferrer" className="ml-1 text-[11px] text-cyan-400 underline hover:text-cyan-300">[aa.com]</a>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* 섹션 2: 현재 판세 및 양강 후보 비교 */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <Scale className="w-4 h-4 text-amber-400" />
                            <h3 className="font-bold text-white text-base">현재 대선 판세 & 후보 대결 구도</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* 룰라 카드 */}
                            <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-b from-rose-950/40 via-black/40 to-black/60 border border-rose-500/30 space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2.5">
                                        <span className="w-3 h-3 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]" />
                                        <span className="font-black text-white text-base">루이스 이나시우 룰라 다시우바</span>
                                    </div>
                                    <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                                        노동자당 (PT) · 현직
                                    </span>
                                </div>
                                <div className="space-y-2 text-xs text-gray-300">
                                    <p><strong className="text-gray-200">정치 성향:</strong> 온건 좌파, 복지 확대 및 사회 재정 지출 우선</p>
                                    <p><strong className="text-gray-200">경제 기조:</strong> 포용적 성장, 빈곤층 지원(Bolsa Família), 국영 기업 역할 중시</p>
                                    <p><strong className="text-gray-200">채권 시장 영향:</strong> 재정 준칙 완화 우려로 금리 상방 압력 가능성 있으나, 중앙은행(BCB) 독립성 견지로 시스템 리스크는 방어선 형성</p>
                                </div>
                            </div>

                            {/* 플라비우 보우소나루 카드 */}
                            <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-b from-blue-950/40 via-black/40 to-black/60 border border-blue-500/30 space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2.5">
                                        <span className="w-3 h-3 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
                                        <span className="font-black text-white text-base">플라비우 보우소나루</span>
                                    </div>
                                    <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                                        자유당 (PL) · 상원의원
                                    </span>
                                </div>
                                <div className="space-y-2 text-xs text-gray-300">
                                    <p><strong className="text-gray-200">정치 성향:</strong> 우파 보수 (자이르 보우소나루 전 대통령 장남 및 정치적 계승자)</p>
                                    <p><strong className="text-gray-200">경제 기조:</strong> 친기업·친시장, 민영화 추진, 공공 지출 축소 및 감세</p>
                                    <p><strong className="text-gray-200">채권 시장 영향:</strong> 재정 건전화 기대로 당선 시 단기 금리 급락(13.2% 이하) 및 헤알화 강세 랠리 가능성, 반면 정치적 대립 리스크</p>
                                </div>
                            </div>
                        </div>
                        <div className="p-3.5 rounded-xl bg-black/40 border border-white/5 text-xs text-gray-300 leading-relaxed">
                            💡 <span className="font-bold text-amber-300">판세 분석 결론:</span> {intel?.outlook || '현 시점에서는 "누가 결선에 진출하느냐"보다도, 결선이 치러질 경우 부동층·군소후보 표의 이동과 투표율이 승부를 좌우하는 초접전 구도입니다.'}
                        </div>
                    </div>

                    {/* 섹션 3: 최신 여론조사 (Polls) 결과 대조 */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <Gauge className="w-4 h-4 text-emerald-400" />
                            <h3 className="font-bold text-white text-base">최신 주요 여론조사 결과 대조</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {polls.map((p: any, idx: number) => (
                                <div key={idx} className="p-4 rounded-2xl bg-black/30 border border-white/10 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="font-bold text-amber-300 text-sm">{p.pollster} {p.scope || '결선 가상대결'}</span>
                                        <span className="text-[11px] text-gray-400">{p.date} {p.margin ? `· ${p.margin}` : ''}</span>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-xs font-semibold">
                                            <span className="text-rose-400">룰라 {p.lula}%</span>
                                            <span className="text-gray-400">{p.other_label || '기타/부동'} {p.other}%</span>
                                            <span className="text-blue-400">플라비우 {p.flavio}%</span>
                                        </div>
                                        <div className="h-3 w-full bg-gray-800 rounded-full overflow-hidden flex">
                                            <div className="bg-rose-500 h-full transition-all" style={{ width: `${p.lula}%` }} />
                                            <div className="bg-gray-600 h-full transition-all" style={{ width: `${p.other}%` }} />
                                            <div className="bg-blue-500 h-full transition-all" style={{ width: `${p.flavio}%` }} />
                                        </div>
                                    </div>
                                    <p className="text-xs text-gray-300 leading-relaxed">
                                        {p.note}
                                        {p.url && (
                                            <a href={p.url} target="_blank" rel="noopener noreferrer" className="ml-1 text-[11px] text-cyan-400 underline hover:text-cyan-300">
                                                [출처]
                                            </a>
                                        )}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* 섹션 4: 실시간 선거·시장 사건 타임라인 로그 */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Sparkles className="w-4 h-4 text-cyan-400" />
                                <h3 className="font-bold text-white text-base">실시간 선거·시장 타임라인 로그 ({events.length}건)</h3>
                            </div>
                        </div>
                        <div className="space-y-2">
                            {events.map((ev: any, idx: number) => (
                                <div key={idx} className="p-3 rounded-xl bg-black/30 border border-white/5 flex items-start gap-3">
                                    <span className="px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 font-mono text-[11px] font-bold shrink-0 mt-0.5">
                                        {ev.date}
                                    </span>
                                    <div>
                                        <p className="font-bold text-white text-xs">{ev.title}</p>
                                        {ev.detail && <p className="text-gray-400 text-xs mt-0.5">{ev.detail}</p>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* 섹션 5: 브라질 국채 투자 전략적 시사점 & 액션 플랜 */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <Target className="w-4 h-4 text-cyan-400" />
                            <h3 className="font-bold text-white text-base">브라질 국채 투자자를 위한 시장 파급효과 & 액션 가이드</h3>
                        </div>
                        <div className="p-4 sm:p-5 rounded-2xl bg-cyan-950/20 border border-cyan-500/30 space-y-3 text-xs sm:text-sm text-gray-300 leading-relaxed">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                                <div className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-1">
                                    <span className="font-bold text-amber-300 flex items-center gap-1">
                                        <Zap className="w-3.5 h-3.5" /> 10월 5일 단기 변동성
                                    </span>
                                    <p className="text-gray-300">
                                        1차 투표 결과 결선 대결 확정 시 양 후보 간 포퓰리즘 공약 경쟁으로 10년 국채 금리가 일시적으로 <strong className="text-amber-400">14.5% 수준까지 스파이크</strong>할 가능성 상존.
                                    </p>
                                </div>
                                <div className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-1">
                                    <span className="font-bold text-emerald-300 flex items-center gap-1">
                                        <Award className="w-3.5 h-3.5" /> 바벨 포트폴리오 가이드
                                    </span>
                                    <p className="text-gray-300">
                                        14.5% 어깨 고금리 도달 시 <strong className="text-emerald-400">헤알화 장기채(2033/2035) 50%</strong> 비중으로 확대하여 고쿠폰(10%+) 락인 및 자본차익 도모. 달러 장기채 20%로 환율 변동성 완충.
                                    </p>
                                </div>
                                <div className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-1">
                                    <span className="font-bold text-cyan-300 flex items-center gap-1">
                                        <ShieldCheck className="w-3.5 h-3.5" /> 중앙은행 중립성 방파제
                                    </span>
                                    <p className="text-gray-300">
                                        가브리엘 갈리폴로 차기 총재 체제에서도 법제화된 중앙은행 독립성으로 인해 무분별한 금리 인하나 시스템 붕괴(Worst 시나리오)는 제도적으로 차단됨.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 섹션 6: 보도 출처 및 레퍼런스 */}
                    <div className="pt-2 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-400">
                        <span className="font-bold text-gray-500 uppercase tracking-wider text-[10px]">
                            Reference Citations:
                        </span>
                        <div className="flex flex-wrap items-center gap-3">
                            <a href="https://www.reuters.com/world/americas/brazil-vote-approaches-with-lula-and-bolsonaro-polling-close-race-2026-10-01/" target="_blank" rel="noopener noreferrer" className="hover:text-amber-300 underline flex items-center gap-1">
                                <span>Reuters (2026.10.01)</span>
                                <ExternalLink className="w-3 h-3" />
                            </a>
                            <a href="https://www.aa.com.tr/en/politics/explainer-what-to-know-about-brazils-2026-presidential-election/4074737" target="_blank" rel="noopener noreferrer" className="hover:text-amber-300 underline flex items-center gap-1">
                                <span>Anadolu Agency Explainer</span>
                                <ExternalLink className="w-3 h-3" />
                            </a>
                            <a href="https://valorinternational.globo.com/politics/news/2026/09/28/new-quaest-poll-shows-lula-and-flavio-tied-at-42percent-in-runoff.ghtml" target="_blank" rel="noopener noreferrer" className="hover:text-amber-300 underline flex items-center gap-1">
                                <span>Valor Econômico (Quaest)</span>
                                <ExternalLink className="w-3 h-3" />
                            </a>
                            <a href="https://www.yna.co.kr/view/AKR20260929001400087" target="_blank" rel="noopener noreferrer" className="hover:text-amber-300 underline flex items-center gap-1">
                                <span>연합뉴스 (2026.09.29)</span>
                                <ExternalLink className="w-3 h-3" />
                            </a>
                            <a href="https://www.democrata.es/en/center-of-surveys-and-electoral-polls/surveys-brazil-elections-lula-leads-bolsonaro-in-the-first-round-but-the-result-evens-out-in-the-second/" target="_blank" rel="noopener noreferrer" className="hover:text-amber-300 underline flex items-center gap-1">
                                <span>Democrata Polls Center</span>
                                <ExternalLink className="w-3 h-3" />
                            </a>
                        </div>
                    </div>
                </div>

                {/* 3) 푸터 버튼 */}
                <div className="px-6 py-4 border-t border-white/10 bg-white/[0.02] flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-5 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-black shadow-md hover:shadow-amber-500/30 transition-all cursor-pointer"
                    >
                        확인 완료 및 창 닫기
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}

// 시계열 세로 타임라인: 좌측 레일 + 마커. 완료된 과거 이벤트는 1줄 최소화(접기/펼치기), 다가오는 이벤트 상시 노출 및 대선 상세 팝업 연동.
function MacroTimeline({ timeline, augScenarios }: {
    timeline: Catalyst[];
    augScenarios?: { id: string; title: string; color: string; logic: string; action: string }[];
}) {
    const impactColor = (impact: string) => impact === 'fx' ? 'amber' : impact === 'rate' ? 'cyan' : 'rose';
    
    // election_runoff 결선투표가 누락된 경우 자동 보강 및 날짜순 정렬
    const activeTimeline = useMemo(() => {
        if (!timeline) return [];
        const hasRunoff = timeline.some(c => c.key === 'election_runoff');
        if (!hasRunoff) {
            const runoff: Catalyst = {
                date: "2026-10-26",
                key: "election_runoff",
                title: "브라질 대선 2차 결선투표",
                impact: "both",
                d_day: getDynamicDDay("2026-10-26"),
                note: "1차 투표 과반 득표자 부재 시 상위 2명 결선 진출. 룰라(PT) vs 플라비우 보우소나루(PL) 결선 초접전 구도. 부동층/군소후보 표심 이동 및 투표율이 승부 좌우.",
                actual: null,
                outlook: "결선 판세에 따른 금리 스파이크 시(14.5% 어깨 고금리) 장기채(2033/2035) 50% 분할 매수 기회 활용. 중앙은행 독립성 견지로 극단적 완화는 차단.",
            };
            const updated = [...timeline, runoff];
            updated.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            return updated;
        }
        return timeline;
    }, [timeline]);

    // 가장 가까운 다음 미완료 이벤트의 key 찾기
    const nextEventKey = activeTimeline.find(c => c.d_day >= 0)?.key;

    // 과거 이벤트와 다가오는 이벤트 분리
    const pastEvents = activeTimeline.filter(c => c.d_day < 0);
    const upcomingEvents = activeTimeline.filter(c => c.d_day >= 0);

    const [isPastExpanded, setIsPastExpanded] = useState(false);
    const [isElectionModalOpen, setIsElectionModalOpen] = useState(false);

    const renderCard = (c: Catalyst, isPastCard: boolean) => {
        const isNext = c.key === nextEventKey;
        const col = impactColor(c.impact);
        const dot = isPastCard
            ? 'bg-gray-600'
            : isNext
                ? 'bg-amber-400 ring-4 ring-amber-400/40 animate-pulse'
                : col === 'amber' ? 'bg-amber-400' : col === 'cyan' ? 'bg-cyan-400' : 'bg-rose-400';

        const isCopomAug = c.key === 'copom_aug';
        const isElection = c.key === 'election' || c.key === 'election_runoff';

        return (
            <div key={c.key} className="relative">
                <span className={`absolute -left-[18px] top-4 w-3 h-3 rounded-full ${dot}`} />
                <div className={`rounded-2xl border transition-all duration-300 ${
                    isPastCard
                        ? 'border-white/5 bg-black/10 opacity-70 hover:opacity-100 p-4'
                        : isNext
                            ? 'border-amber-400/80 bg-gradient-to-r from-amber-500/20 via-yellow-500/10 to-amber-500/20 shadow-[0_0_25px_rgba(245,158,11,0.25)] animate-pulse p-4 ring-1 ring-amber-400/50'
                            : 'border-white/10 bg-black/20 p-4'
                }`}>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* 1) 왼쪽: Timeline 상의 이벤트 명 및 세부정보 */}
                        <div className="space-y-1.5 pr-2 md:border-r md:border-white/10 flex flex-col justify-between">
                            <div>
                                <div className="flex flex-wrap items-center gap-2">
                                    {isNext && (
                                        <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-amber-400 text-black uppercase tracking-wider animate-bounce">
                                            NEXT EVENT
                                        </span>
                                    )}
                                    <span className={`text-base font-black ${isPastCard ? 'text-gray-500' : isNext ? 'text-amber-300 text-lg' : 'text-gray-200'}`}>
                                        {isPastCard ? '완료' : `D-${c.d_day}`}
                                    </span>
                                    <span className={`text-sm font-bold ${isPastCard ? 'text-gray-400' : isNext ? 'text-white text-base' : 'text-white'}`}>{c.title}</span>
                                    <span className="text-xs text-gray-400 font-mono">{c.date}</span>
                                </div>
                                <div className="mt-1.5 flex items-center gap-2">
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                                        col === 'amber' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                        : col === 'cyan' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                                        : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                    }`}>
                                        {c.impact === 'fx' ? '환율 변수' : c.impact === 'rate' ? '금리 변수' : '금리·환율 이중 변수'}
                                    </span>
                                </div>
                            </div>
                            <p className="text-xs text-gray-300 mt-1 leading-relaxed">{c.note}</p>
                        </div>
                        
                        {/* 2) 중간: 실제 해당 시점에서의 발표 내용 */}
                        <div className="space-y-1 md:border-r md:border-white/10 md:px-2 flex flex-col justify-start">
                            <span className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">실제 발표 내용</span>
                            {c.actual
                                ? <p className="text-xs text-gray-200 mt-1 leading-relaxed font-medium">{c.actual}</p>
                                : <p className="text-xs text-gray-500 italic mt-1">{isPastCard ? '발표 내용 집계 대기' : '— (이벤트 대기 중)'}</p>}
                        </div>

                        {/* 3) 오른쪽: 국채 전망 및 액션플랜 */}
                        <div className="space-y-1 md:pl-2 flex flex-col justify-start">
                            <span className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">국채 전망 및 액션플랜</span>
                            {c.outlook
                                ? <p className="text-xs text-gray-200 mt-1 leading-relaxed font-medium">{c.outlook}</p>
                                : <p className="text-xs text-gray-500 italic mt-1">— (이벤트 대기 중)</p>}
                        </div>
                    </div>

                    {/* 대선 이벤트(1차 및 2차) 카드인 경우 상세 인텔리전스 팝업 버튼 노출 */}
                    {isElection && (
                        <div className="mt-3.5 pt-3 border-t border-amber-500/30 flex flex-wrap items-center justify-between gap-2 bg-amber-500/5 -mx-4 -mb-4 p-3 rounded-b-2xl">
                            <div className="flex items-center gap-2 text-xs text-amber-200">
                                <Vote className="w-4 h-4 text-amber-400 shrink-0" />
                                <span className="font-semibold">
                                    {c.key === 'election' ? '1차 투표(10/4) 결과에 따른 결선(10/25) 진출 및 여론조사 판세 분석' : '2차 결선투표(10/25) 룰라 vs 플라비우 초접전 및 국채 영향'}
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsElectionModalOpen(true)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-black shadow-md hover:shadow-amber-500/40 transition-all cursor-pointer shrink-0"
                            >
                                <span>🇧🇷 대선 종합 인텔리전스 팝업 보기</span>
                                <ExternalLink className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    )}

                    {/* 8월 Copom 이벤트 카드인 경우 A, B, C 시나리오를 카드 하단에 들여쓰기로 렌더링 */}
                    {isCopomAug && augScenarios && augScenarios.length > 0 && (
                        <div className="mt-4 pt-3.5 border-t border-amber-500/30">
                            <p className="text-xs font-bold text-amber-300 mb-2 flex items-center gap-1.5">
                                <Layers className="w-3.5 h-3.5" /> 8월 Copom 금리 결정 시나리오별 대응 플레이북
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                                {augScenarios.map((sc) => (
                                    <ScenarioCard key={sc.id} sc={sc} />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <>
            {/* 팝업 모달 */}
            <BrazilElectionDetailModal
                isOpen={isElectionModalOpen}
                onClose={() => setIsElectionModalOpen(false)}
            />

            {/* 1. 지나간 (완료) Timeline 1줄 최소화 (접기/펼치기 아코디언) */}
            {pastEvents.length > 0 && (
                <div className="mb-4">
                    <button
                        type="button"
                        onClick={() => setIsPastExpanded(!isPastExpanded)}
                        className="w-full flex items-center justify-between px-4 py-2.5 rounded-2xl bg-black/30 hover:bg-black/50 border border-white/10 hover:border-white/20 transition-all text-xs group cursor-pointer"
                    >
                        <div className="flex items-center gap-2.5 overflow-hidden">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shrink-0" />
                            <span className="font-bold text-gray-300 group-hover:text-white shrink-0">
                                ✅ 완료된 매크로 이벤트 ({pastEvents.length}건)
                            </span>
                            <span className="text-[11px] text-gray-400 truncate hidden sm:inline">
                                · {pastEvents.map(e => `${e.title.replace('브라질 ', '')} (${e.date})`).join('  |  ')}
                            </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 group-hover:text-cyan-300 shrink-0 ml-2">
                            <span>{isPastExpanded ? '지난 이벤트 접기' : '지난 이벤트 상세 보기'}</span>
                            {isPastExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </div>
                    </button>

                    {/* 펼쳐졌을 때만 과거 이벤트 리스트 렌더링 */}
                    {isPastExpanded && (
                        <div className="mt-3 relative pl-6">
                            <div className="absolute left-2 top-1 bottom-1 w-px bg-white/10" />
                            <div className="flex flex-col gap-3">
                                {pastEvents.map(c => renderCard(c, true))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* 2. 다가오는(미완료) Timeline: 상시 노출 세로 레일 */}
            <div className="relative pl-6">
                <div className="absolute left-2 top-1 bottom-1 w-px bg-gradient-to-b from-amber-400/40 via-cyan-400/20 to-transparent" />
                <div className="flex flex-col gap-3">
                    {upcomingEvents.map(c => renderCard(c, false))}
                </div>
            </div>
        </>
    );
}

// 기사 원문을 별도 팝업 창으로 연다. 언론사·Google News는 iframe 삽입을 막아 모달 안에 띄울 수 없다.
const openNewsPopup = (link: string) => {
    const w = Math.min(1100, window.screen.availWidth - 80);
    const h = Math.min(900, window.screen.availHeight - 80);
    const left = Math.round((window.screen.availWidth - w) / 2);
    const top = Math.round((window.screen.availHeight - h) / 2);
    const win = window.open(link, 'brazil_news_article', `popup=yes,width=${w},height=${h},left=${left},top=${top}`);
    if (!win) window.open(link, '_blank', 'noopener'); // 팝업 차단 시 새 탭으로
};

function NewsFeed({ news, loading }: { news: NewsItem[]; loading: boolean }) {
    if (loading) {
        return (
            <div className="bg-black/20 rounded-2xl border border-white/5 p-6 text-center">
                <RefreshCw className="w-5 h-5 text-amber-400 animate-spin mx-auto" />
                <p className="text-xs text-gray-500 mt-2">최신 뉴스를 수집하는 중…</p>
            </div>
        );
    }
    if (!news.length) {
        return <p className="text-xs text-gray-500 bg-black/20 rounded-2xl border border-white/5 p-4">표시할 뉴스가 없습니다.</p>;
    }
    return (
        // 5건 높이(줄 = 13px 글자 leading-tight 16.25px + py-1.5 + 구분선 1px)만 보이고 나머지는 스크롤
        <ul className="bg-black/20 rounded-2xl border border-white/5 max-h-[calc(5*(16.25px_+_0.75rem_+_1px)_+_2px)] overflow-y-auto divide-y divide-white/5 [scrollbar-width:thin] [scrollbar-color:rgba(245,158,11,0.35)_transparent]">
            {news.map((n, i) => (
                <li key={n.link || i}>
                    <button
                        onClick={() => openNewsPopup(n.link)}
                        title={n.title}
                        className="group w-full flex items-center gap-3 px-4 py-1.5 text-left leading-tight hover:bg-white/[0.04] transition cursor-pointer"
                    >
                        <span className="text-[11px] font-mono text-gray-500 w-[88px] shrink-0">
                            {n.published ? n.published.slice(5) : '-'}
                        </span>
                        <span className="flex-1 min-w-0 text-[13px] font-semibold text-gray-200 group-hover:text-amber-300 truncate">
                            {n.title}
                        </span>
                        <span className="text-[11px] text-gray-500 shrink-0 hidden sm:inline">{n.source}</span>
                    </button>
                </li>
            ))}
        </ul>
    );
}

// 하단 텔레그램 알림 구독 — 브라질 알림 토글 + 연결 상태 + 테스트 발송
function BrazilAlertConfig() {
    const [alertBrazil, setAlertBrazil] = useState(true);
    const [chatId, setChatId] = useState('');
    const [hasToken, setHasToken] = useState(false);
    const [loaded, setLoaded] = useState(false);
    const [busy, setBusy] = useState(false);
    const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null);

    const [showRegister, setShowRegister] = useState(false);
    const [inputToken, setInputToken] = useState('');
    const [inputChatId, setInputChatId] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        (async () => {
            try {
                const localChatId = localStorage.getItem('telegram_chat_id') || '';
                const url = localChatId
                    ? `${API_BASE}/api/v1/notification/settings?chat_id=${encodeURIComponent(localChatId)}`
                    : `${API_BASE}/api/v1/notification/settings`;
                const r = await fetch(url);
                if (r.ok) {
                    const d = await r.json();
                    setAlertBrazil(d.alert_brazil === 1);
                    setChatId(d.telegram_chat_id || '');
                    setHasToken(!!(d.telegram_token && d.telegram_token.length));
                    setInputToken(d.telegram_token || '');
                    setInputChatId(d.telegram_chat_id || '');
                }
            } catch { /* 무시 */ } finally { setLoaded(true); }
        })();
    }, []);

    const flash = (ok: boolean, msg: string) => { setToast({ ok, msg }); setTimeout(() => setToast(null), 4000); };

    const saveToggle = async (next: boolean) => {
        setAlertBrazil(next);
        try {
            const localChatId = localStorage.getItem('telegram_chat_id') || '';
            const url = localChatId
                ? `${API_BASE}/api/v1/notification/settings?chat_id=${encodeURIComponent(localChatId)}`
                : `${API_BASE}/api/v1/notification/settings`;
            
            // 브라질 알림 토글만 부분 갱신 — 다른 카테고리(exit/rebalance/daily)는 건드리지 않는다.
            const cur = await (await fetch(url)).json();
            const r = await fetch(`${API_BASE}/api/v1/notification/settings`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    telegram_token: cur.telegram_token || '', telegram_chat_id: cur.telegram_chat_id || '',
                    alert_brazil: next ? 1 : 0,
                }),
            });
            if (!r.ok) throw new Error();
            flash(true, next ? '브라질 알림을 켰습니다.' : '브라질 알림을 껐습니다.');
        } catch {
            setAlertBrazil(!next);
            flash(false, '설정 저장에 실패했습니다.');
        }
    };

    const handleRegisterSave = async () => {
        if (!inputChatId.trim()) {
            flash(false, 'Chat ID를 입력해 주세요.');
            return;
        }
        setIsSaving(true);
        try {
            // 브라질탭 등록 = 브라질 전용 채널. 다른 카테고리(손절/리밸런싱/데일리)는 명시적으로 꺼서
            // 이 화면에서 등록한 ID에는 브라질 알림만 발송되도록 한다(개인 포트폴리오 알림 혼입 방지).
            const r = await fetch(`${API_BASE}/api/v1/notification/settings`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    telegram_token: inputToken,
                    telegram_chat_id: inputChatId.trim(),
                    alert_brazil: alertBrazil ? 1 : 0,
                    alert_exit_signal: 0,
                    alert_rebalance: 0,
                    alert_daily_summary: 0,
                }),
            });
            const d = await r.json();
            if (r.ok && d.status === 'success') {
                localStorage.setItem('telegram_chat_id', inputChatId.trim());
                setChatId(inputChatId.trim());
                setHasToken(!!(inputToken && inputToken.length));
                flash(true, '텔레그램 봇 및 Chat ID 설정이 완료되었습니다.');
                setShowRegister(false);
            } else {
                flash(false, d.detail || '저장에 실패했습니다.');
            }
        } catch {
            flash(false, '저장 중 오류가 발생했습니다.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <section className="bg-gradient-to-br from-emerald-950/30 to-black/20 rounded-2xl border border-emerald-500/20 p-5">
            <SectionTitle icon={<Bell className="w-5 h-5 text-emerald-400" />} title="텔레그램 실시간 알림" sub="매일 아침 대시보드 브리핑 · 핵심/전체 지표 초록불 · 신호 전환 · D-day · 신규 뉴스 자동 발송" />
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" checked={alertBrazil} disabled={!loaded}
                            onChange={(e) => saveToggle(e.target.checked)} className="sr-only peer" />
                        <div className="w-11 h-6 bg-white/10 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gray-300 after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600" />
                    </label>
                    <div>
                        <p className="text-sm font-bold text-white">브라질 국채 알림 {alertBrazil ? '켜짐' : '꺼짐'}</p>
                        <p className="text-xs text-gray-400">
                            {hasToken && chatId
                                ? <>연결됨 · Chat ID <span className="font-mono">{chatId}</span></>
                                : <>텔레그램 봇 미연결 — <span className="text-emerald-300 cursor-pointer hover:underline" onClick={() => setShowRegister(true)}>여기</span>를 눌러 토큰과 Chat ID를 등록하세요.</>}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => setShowRegister(!showRegister)}
                        className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl border border-white/10 hover:border-white/20 text-gray-300 hover:text-white transition">
                        <Settings className="w-3.5 h-3.5" /> 설정 관리
                    </button>
                    <button onClick={async () => {
                        setBusy(true);
                        try {
                            const localChatId = localStorage.getItem('telegram_chat_id') || '';
                            const url = localChatId
                                ? `${API_BASE}/api/v1/notification/settings?chat_id=${encodeURIComponent(localChatId)}`
                                : `${API_BASE}/api/v1/notification/settings`;
                            const cur = await (await fetch(url)).json();
                            // 현재 대시보드 지표 값으로 구성한 브리핑을 등록된 텔레그램으로 테스트 발송
                            const r = await fetch(`${API_BASE}/api/v1/brazil-bond/test-digest`, {
                                method: 'POST', headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ telegram_token: cur.telegram_token || '', telegram_chat_id: cur.telegram_chat_id || '' }),
                            });
                            const d = await r.json();
                            flash(r.ok, r.ok ? '현재 지표 값으로 테스트 브리핑을 발송했습니다.' : (d.detail || '발송 실패'));
                        } catch { flash(false, '발송 중 오류'); } finally { setBusy(false); }
                    }} disabled={busy || !hasToken}
                        className="flex items-center gap-2 text-sm font-bold px-4 py-2 rounded-xl bg-emerald-600/80 text-white disabled:opacity-40 hover:bg-emerald-600 transition shrink-0">
                        {busy ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} 테스트 발송
                    </button>
                </div>
            </div>

            {showRegister && (
                <div className="mt-4 p-4 border border-emerald-500/20 bg-black/40 rounded-xl flex flex-col gap-3">
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-gray-300">텔레그램 봇 토큰 (Telegram Bot Token)</label>
                        <input
                            type="text"
                            value={inputToken}
                            onChange={(e) => setInputToken(e.target.value)}
                            placeholder="마스킹된 토큰 또는 새 토큰 입력"
                            className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
                        />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-gray-300">텔레그램 수신자 Chat ID (Chat ID)</label>
                        <input
                            type="text"
                            value={inputChatId}
                            onChange={(e) => setInputChatId(e.target.value)}
                            placeholder="숫자로 된 Chat ID 입력 (예: 12345678)"
                            className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
                        />
                    </div>
                    <div className="flex justify-end gap-2 mt-1">
                        <button
                            onClick={() => setShowRegister(false)}
                            className="px-3 py-1 text-xs text-gray-400 hover:text-white transition"
                        >
                            취소
                        </button>
                        <button
                            onClick={handleRegisterSave}
                            disabled={isSaving}
                            className="px-3 py-1 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition disabled:opacity-50"
                        >
                            {isSaving ? '저장 중...' : '설정 저장'}
                        </button>
                    </div>
                </div>
            )}

            {toast && (
                <div className={`mt-3 text-xs font-semibold px-3 py-2 rounded-lg border ${toast.ok ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' : 'bg-rose-500/10 text-rose-300 border-rose-500/20'}`}>
                    {toast.msg}
                </div>
            )}
        </section>
    );
}

function AiReportSection({ insight, insightAt, genLoading, onGenerate }: {
    insight: AiInsight | null; insightAt: string | null; genLoading: boolean; onGenerate: () => void;
}) {
    return (
        <section className="bg-gradient-to-br from-indigo-950/40 to-black/20 rounded-2xl border border-indigo-500/20 p-5">
            <div className="flex items-center justify-between mb-3">
                <SectionTitle icon={<Sparkles className="w-5 h-5 text-indigo-400" />} title="AI 전략 리포트" sub={insightAt ? `생성: ${new Date(insightAt).toLocaleString('ko-KR')}` : '라이브 지표 + 플레이북 기반'} />
                <button onClick={onGenerate} disabled={genLoading}
                    className="flex items-center gap-2 text-sm font-bold px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg disabled:opacity-50 hover:brightness-110 transition">
                    {genLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    {genLoading ? '분석 중…' : (insight ? '재생성' : 'AI 분석 생성')}
                </button>
            </div>
            {!insight ? (
                <p className="text-sm text-gray-400 text-center py-6">
                    아직 생성된 리포트가 없습니다. <span className="text-indigo-300 font-semibold">AI 분석 생성</span>을 눌러 현재 매크로 국면을 진단하세요.
                </p>
            ) : (
                <div className="space-y-4">
                    {insight.verdict && (
                        <div className="bg-black/25 rounded-xl p-4 border border-white/5">
                            <p className="text-lg font-black text-white">{insight.verdict.grade}</p>
                            <p className="text-sm text-gray-300 mt-1 leading-relaxed">{insight.verdict.summary}</p>
                        </div>
                    )}
                    {insight.analysis?.cards && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            {insight.analysis.cards.map((c, i) => (
                                <div key={i} className="bg-black/20 rounded-xl p-3 border border-white/5">
                                    <p className="font-bold text-indigo-300 text-sm">{c.title}</p>
                                    <p className="text-xs text-gray-400 mt-1 leading-relaxed">{c.body}</p>
                                </div>
                            ))}
                        </div>
                    )}
                    {insight.strategy && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <StrategyBox label="진입 (Entry)" body={insight.strategy.entry} tone="emerald" />
                            <StrategyBox label="보유 (Hold)" body={insight.strategy.hold} tone="cyan" />
                            <StrategyBox label="청산 (Exit)" body={insight.strategy.exit} tone="amber" />
                        </div>
                    )}
                    {insight.execution_checklist && insight.execution_checklist.length > 0 && (
                        <div className="bg-black/20 rounded-xl p-4 border border-white/5">
                            <p className="text-sm font-bold text-white mb-2">실행 체크리스트</p>
                            <ul className="space-y-1.5">
                                {insight.execution_checklist.map((it, i) => (
                                    <li key={i} className="flex gap-2 text-xs text-gray-300">
                                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" /> {it}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                    {insight.risk_footnote && (
                        <p className="text-xs text-rose-300 flex items-center gap-1.5 bg-rose-500/10 rounded-lg px-3 py-2 border border-rose-500/20">
                            <AlertTriangle className="w-4 h-4 shrink-0" /> {insight.risk_footnote}
                        </p>
                    )}
                </div>
            )}
        </section>
    );
}

function StrategyBox({ label, body, tone }: { label: string; body: string; tone: string }) {
    const c = tone === 'emerald' ? 'text-emerald-300' : tone === 'cyan' ? 'text-cyan-300' : 'text-amber-300';
    return (
        <div className="bg-black/20 rounded-xl p-3 border border-white/5">
            <p className={`text-xs font-black ${c} uppercase tracking-wide`}>{label}</p>
            <p className="text-xs text-gray-300 mt-1.5 leading-relaxed">{body}</p>
        </div>
    );
}

// ── 캐리 쿠션 수익 시뮬레이터 (클라이언트 계산) ──────────────────────────────
function CarrySimulator({ summary }: { summary: Summary }) {
    const curFx = summary.indicators.find(i => i.key === 'brl_krw')?.value ?? 294;
    const curY5 = summary.indicators.find(i => i.key === 'y5')?.value ?? 14.3;

    const [amount, setAmount] = useState(10_000_000);   // 투자금(원)
    const [ytm, setYtm] = useState(Number(curY5.toFixed(2)));  // 매수 YTM(%)
    const [years, setYears] = useState(5);
    const [entryFx, setEntryFx] = useState(Number(curFx.toFixed(1)));
    const [exitFx, setExitFx] = useState(Number(curFx.toFixed(1)));
    const [spread, setSpread] = useState(1.0);          // 왕복 환전 스프레드+비용(%)

    const calc = (fxEnd: number) => {
        const growth = Math.pow(1 + ytm / 100, years);      // 헤알 기준 원리금 성장
        const fxFactor = fxEnd / entryFx;                    // 환손익 배수
        const gross = growth * fxFactor;
        const net = gross * (1 - spread / 100);              // 왕복 비용 차감(근사)
        return {
            totalPct: (net - 1) * 100,
            fxPct: (fxFactor - 1) * 100,
            carryPct: (growth - 1) * 100,
            payout: amount * net,
        };
    };
    const res = calc(exitFx);
    const breakeven = entryFx / (Math.pow(1 + ytm / 100, years) * (1 - spread / 100));

    const scenarios = [entryFx, entryFx * 0.95, entryFx * 0.9, entryFx * 0.8, Math.round(breakeven * 10) / 10];

    return (
        <section className="bg-black/20 rounded-2xl border border-white/5 p-5">
            <SectionTitle icon={<ShieldCheck className="w-5 h-5 text-emerald-400" />} title="캐리 쿠션 수익 시뮬레이터" sub="원화 환산 수익 = 이자(캐리) × 환손익 − 비용 (비과세 가정)" />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* 입력 */}
                <div className="space-y-3">
                    <SliderRow label="투자금" value={`${(amount / 10000).toLocaleString('ko-KR')}만원`}>
                        <input type="range" min={1_000_000} max={100_000_000} step={1_000_000} value={amount}
                            onChange={e => setAmount(Number(e.target.value))} className="w-full accent-emerald-500" />
                    </SliderRow>
                    <SliderRow label="매수 YTM (만기수익률)" value={`${ytm.toFixed(2)}%`}>
                        <input type="range" min={10} max={16} step={0.05} value={ytm}
                            onChange={e => setYtm(Number(e.target.value))} className="w-full accent-emerald-500" />
                    </SliderRow>
                    <SliderRow label="보유 기간" value={`${years}년`}>
                        <input type="range" min={1} max={10} step={1} value={years}
                            onChange={e => setYears(Number(e.target.value))} className="w-full accent-emerald-500" />
                    </SliderRow>
                    <SliderRow label="진입 환율 (원/헤알)" value={`${entryFx.toFixed(1)}원`}>
                        <input type="range" min={200} max={320} step={0.5} value={entryFx}
                            onChange={e => setEntryFx(Number(e.target.value))} className="w-full accent-amber-500" />
                    </SliderRow>
                    <SliderRow label="만기 환율 (원/헤알)" value={`${exitFx.toFixed(1)}원`}>
                        <input type="range" min={120} max={340} step={0.5} value={exitFx}
                            onChange={e => setExitFx(Number(e.target.value))} className="w-full accent-amber-500" />
                    </SliderRow>
                    <SliderRow label="왕복 환전 스프레드+비용" value={`${spread.toFixed(1)}%`}>
                        <input type="range" min={0} max={4} step={0.1} value={spread}
                            onChange={e => setSpread(Number(e.target.value))} className="w-full accent-rose-500" />
                    </SliderRow>
                </div>
                {/* 결과 */}
                <div className="space-y-3">
                    <div className={`rounded-2xl p-5 border ${res.totalPct >= 0 ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-rose-500/10 border-rose-500/30'}`}>
                        <p className="text-xs text-gray-400">만기 원화 실현금액 ({years}년 후, 세전·비과세)</p>
                        <p className={`text-3xl font-black mt-1 ${res.totalPct >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                            {Math.round(res.payout).toLocaleString('ko-KR')}원
                        </p>
                        <p className={`text-sm font-bold mt-1 ${res.totalPct >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                            총수익률 {res.totalPct >= 0 ? '+' : ''}{fmt(res.totalPct, 1)}% · CAGR {fmt((Math.pow(res.payout / amount, 1 / years) - 1) * 100, 1)}%
                        </p>
                        <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
                            <div className="bg-black/25 rounded-lg p-2">
                                <span className="text-gray-500">이자(캐리) 성장</span>
                                <p className="text-emerald-300 font-bold">+{fmt(res.carryPct, 1)}%</p>
                            </div>
                            <div className="bg-black/25 rounded-lg p-2">
                                <span className="text-gray-500">환손익</span>
                                <p className={`font-bold ${res.fxPct >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{res.fxPct >= 0 ? '+' : ''}{fmt(res.fxPct, 1)}%</p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-black/20 rounded-xl border border-white/5 p-3">
                        <p className="text-xs text-gray-400 mb-2">손익분기 만기환율: <span className="text-amber-300 font-bold">{fmt(breakeven, 1)}원</span> (이 아래로 떨어지면 원금 손실)</p>
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="text-gray-500 text-left">
                                    <th className="font-medium pb-1">만기환율</th><th className="font-medium pb-1">환율변동</th><th className="font-medium pb-1 text-right">총수익률</th>
                                </tr>
                            </thead>
                            <tbody>
                                {scenarios.map((fxEnd, i) => {
                                    const r = calc(fxEnd);
                                    return (
                                        <tr key={i} className="border-t border-white/5">
                                            <td className="py-1 text-gray-300">{fmt(fxEnd, 1)}원</td>
                                            <td className={`py-1 ${r.fxPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{r.fxPct >= 0 ? '+' : ''}{fmt(r.fxPct, 1)}%</td>
                                            <td className={`py-1 text-right font-bold ${r.totalPct >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{r.totalPct >= 0 ? '+' : ''}{fmt(r.totalPct, 1)}%</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </section>
    );
}

function SliderRow({ label, value, children }: { label: string; value: string; children: React.ReactNode }) {
    return (
        <div>
            <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-400">{label}</span>
                <span className="text-sm font-bold text-white">{value}</span>
            </div>
            {children}
        </div>
    );
}

// ── 10월 대선 3대 시나리오 & Tranche 3 실시간 투자 가이드 ────────────────────────────
const DEFAULT_SCENARIOS: ElectionScenario[] = [
    {
        id: "A",
        title: "중도·우파 정권 교체 (시장 친화적)",
        subtitle: "Market-Friendly Transition",
        color: "emerald",
        verdict: "Best (자본차익 + 환차익 극대화)",
        political_landscape: "우파/중도 후보 승리 (시장 친화적 연합 결성)",
        fiscal_policy: "지출 축소, 민영화 추진, 재정준칙(Fiscal Anchor) 강화",
        bcb_relationship: "중앙은행 제도적 독립성 지지, 디스인플레이션 신뢰 강화",
        rate_10y: "100~200bp 하락 (금리 급락, 채권 가격 급등)",
        rate_change_num: -1.5,
        brl_fx: "헤알화 강세 (외국인 자금 대규모 유입)",
        fx_change_str: "원/헤알 280~300원대 회복 강세",
        market_reaction: "글로벌 금융시장 및 외인이 가장 선호하는 구도. 국가위험 프리미엄(CDS) 급락 및 안도 랠리 촉발.",
        bond_price: "장기물 국채 금리 하향 안정화로 대규모 자본차익(Capital Gain) 확보.",
        fx_impact: "포트폴리오 자금 유입으로 헤알화 평가절상 → 비과세 이자와 환차익 결합으로 토탈 리턴 극대화.",
        action_guide: "5~10년물 장기채 비중 확대. 잔여 40% 전량 적극 집행 및 자본차익 극대화 노림.",
    },
    {
        id: "B",
        title: "현 좌파 정권 연임 (온건·실용 연합)",
        subtitle: "Pragmatic Continuity (Base Case)",
        color: "cyan",
        verdict: "Neutral (이자 수익 중심 안정 운영)",
        political_landscape: "룰라/좌파 진영 연임 + 의회 중도파(Centrão) 연정 유지",
        fiscal_policy: "현 신재정프레임워크 유지, 지출 통제 속 세수 확충 집중",
        bcb_relationship: "금리 인하 정치적 압박은 있으나 제도적 독립성 인정 및 타협",
        rate_10y: "중립 / 완만한 하락 (박스권 내 13.5~14.2% 소폭 등락)",
        rate_change_num: -0.3,
        brl_fx: "보합 / 완만한 흐름 (경상수지 및 원자재 가격 연동)",
        fx_change_str: "원/헤알 250~270원 박스권 횡보",
        market_reaction: "대선 전 정치 불확실성(Election Discount) 해소로 단기 안도 랠리. 의회 견제로 급격한 정책 변동 제한.",
        bond_price: "기준금리(Selic) 완만한 인하 사이클 속 국채 금리 박스권. 연 10%대 중반 표면이자에 초점.",
        fx_impact: "환율 급변동 제한적으로 환손익 중립적. 안정적 비과세 쿠폰 현금흐름 락인.",
        action_guide: "단기 2~3년물(인컴 방어) 50% + 5년물 30% + 달러채 20% 바벨 분할 매수. 금리 14%대 이상 튈 때 분할 진입.",
    },
    {
        id: "C",
        title: "좌파 정권 강경화 (확장 재정 포퓰리즘)",
        subtitle: "Fiscal Populism (Tail Risk)",
        color: "rose",
        verdict: "Worst (원금 손실 + 환손실 위험)",
        political_landscape: "룰라/좌파 진영 연임 + 좌파 포퓰리즘 강화 (의회 갈등 심화)",
        fiscal_policy: "복지·공공지출 확대, 부채한도 완화 압박, 재정준칙 무력화",
        bcb_relationship: "기준금리(Selic) 급격한 인하 강요, 중앙은행 독립성 훼손 갈등 (단, 2021년 제정된 BCB 자율성 보장법으로 인해 통화정책의 일방적 훼손은 상방 제한)",
        rate_10y: "150~250bp 급등 (금리 폭등, 15% 이상 터치)",
        rate_change_num: 2.0,
        brl_fx: "헤알화 급락 / 약세 (외국인 자본 이탈)",
        fx_change_str: "원/헤알 240원 이하 하락 위험",
        market_reaction: "재정 신뢰도 붕괴 우려, CDS 프리미엄 급등 경고. 단, 의회(Centrão) 과반 견제 및 중앙은행(BCB) 법적 독립성이 제도적 최후 방파제로 작동.",
        bond_price: "인플레이션 재점화 및 재정적자 확대로 국채 금리 급등, 채권 가격 급락(자본손실).",
        fx_impact: "외인 자금 이탈로 헤알화 가치 급락(평가절하) → 원/헤알 환손실이 이자 수익 잠식 가능.",
        action_guide: "장기채 신규 매수 보류. 단, BCB 독립성으로 인한 하방 브레이크가 존재하므로 공포로 15% 초과 폭등 시 패닉셀 지양 및 진정 확인 후 단기물·달러채 중심으로만 제한 진입.",
    },
];

const DEFAULT_RECOMMENDED_BONDS: RecommendedBond[] = [
    {
        id: "brl_short",
        name: "헤알화 표시 단기 국채 (2~3년물)",
        code_example: "NTN-F 2027~2028 (고정금리)",
        currency: "BRL (브라질 헤알)",
        maturity_years: "2~3년",
        target_horizon: "1~3년 (안정 인컴 추구형)",
        coupon_rate: "연 10.00% (반기 지급, 매년 1월/7월)",
        current_ytm: "약 13.5~14.2% (YTM 만기수익률)",
        tax_benefit: "한-브라질 조세조약에 따른 이자소득세 0% 비과세 (종합과세 제외)",
        risk_level: "중립 (낮은 듀레이션, 환율 변동 노출)",
        best_for: "대선 정치적 노이즈를 방어하며 연 13%대 고금리 비과세 이자만 확실히 수취하고자 하는 보수적 투자자",
        pros: ["낮은 듀레이션(1.8~2.5년)으로 금리 급등 시에도 채권 가격 하락폭 극히 제한적", "연 13%대 높은 실효 쿠폰 락인"],
        cons: ["원/헤알 환율 하락 시 환손실 발생 가능", "금리 인하 시 자본차익 폭이 장기채 대비 작음"],
        allocation_tranche3: "권장 비중 40~50%",
    },
    {
        id: "brl_midlong",
        name: "헤알화 표시 중장기 국채 (5~10년물)",
        code_example: "NTN-F 2031 / 2033 / 2035 (고정금리)",
        currency: "BRL (브라질 헤알)",
        maturity_years: "5~10년 (스위트스팟)",
        target_horizon: "3~5년 이상 (자본차익 극대화형)",
        coupon_rate: "연 10.00% (반기 지급, 매년 1월/7월)",
        current_ytm: "약 14.1~14.6% (YTM 만기수익률)",
        tax_benefit: "이자소득세 0% 전액 비과세 + 채권 자본차익 비과세",
        risk_level: "적극투자 (듀레이션 4.5~6.5년, 금리·환율 레버리지)",
        best_for: "Selic 금리 인하 사이클 본격화 및 대선 불확실성 해소 후 막대한 채권 자본차익(Capital Gain)을 노리는 투자자",
        pros: ["금리 100bp 인하 시 채권 가격 약 4~6% 상승 자본차익", "복리 재투자 시 최고의 토탈 리턴 달성 가능"],
        cons: ["시나리오 C(좌파 강경화) 시 국채 금리 스파이크로 단기 평가손실 위험 상대적 큼"],
        allocation_tranche3: "권장 비중 30~40%",
    },
    {
        id: "usd_sovereign",
        name: "달러 표시 브라질 외화국채 (10년물)",
        code_example: "Brazil Sovereign Global Bond 2033~2035 (USD)",
        currency: "USD (미국 달러)",
        maturity_years: "7~10년",
        target_horizon: "3년 이상 (통화 안정 & 달러 고수익형)",
        coupon_rate: "연 5.75% ~ 6.50% (USD 반기 지급)",
        current_ytm: "약 6.2~6.8% (USD 기준 만기수익률)",
        tax_benefit: "해외채권 기본 과세 규정 적용 (외화채권 세제 및 조세협정 사전 확인 권장)",
        risk_level: "중립 (헤알화 위험 완전 차단, 미국 금리 연동)",
        best_for: "헤알화의 급락 위험을 원천 차단하고 기축통화인 '달러(USD)'로 미국 국채 대비 200~300bp 프리미엄을 락인하려는 투자자",
        pros: ["헤알화 정치 리스크 완벽 헤지", "달러 자산 확보 및 미 국채 대비 높은 캐리 수율"],
        cons: ["원/달러 환율에 연동", "헤알화 채권 대비 표면금리(6%대 vs 13%대) 상대적 낮음"],
        allocation_tranche3: "권장 비중 10~20%",
    },
    {
        id: "barbell_strategy",
        name: "💡 [안정 방어형] 밸런스 바벨 혼합 포트폴리오",
        code_example: "단기 헤알채(50%) + 장기 헤알채(30%) + 달러 국채(20%)",
        currency: "BRL 80% + USD 20%",
        maturity_years: "2년 ~ 10년 분산",
        target_horizon: "2~4년 (대선 변동성 극복형)",
        coupon_rate: "가중평균 약 연 9.2% (BRL 10% + USD 6%)",
        current_ytm: "가중평균 약 12.5~13.2%",
        tax_benefit: "헤알화 자산 전액 비과세 + 달러 분산",
        risk_level: "균형잡힌 리스크 관리 (대선 올인 방지)",
        best_for: "대선 결과에 구애받지 않고 시나리오 A·B·C 모든 상황에서 하방을 방어하면서 상방 자본차익을 향유하려는 안정지향 투자자",
        pros: ["시나리오 C(급락) 시 단기채와 달러채가 원금 방어", "시나리오 A(급등) 시 장기채가 자본차익 견인"],
        cons: ["단일 종목 집중 대비 최대 수익률은 다소 완화"],
        allocation_tranche3: "★ Tranche 3 기본 권장 (안정형)",
    },
    {
        id: "aggressive_barbell",
        name: "🚀 [적극 고수익·여유자금형] 캡/인컴 바벨 포트폴리오",
        code_example: "장기 헤알채(50%) + 중기 헤알채(30%) + 달러 장기채(20%)",
        currency: "BRL 80% + USD 20%",
        maturity_years: "5년 ~ 10년 (중장기 듀레이션 확대)",
        target_horizon: "3~5년 이상 (장기 여유자금 투자형)",
        coupon_rate: "가중평균 약 연 9.2% (BRL 10% + USD 6.2%)",
        current_ytm: "가중평균 약 13.8~14.4% (고수익 YTM)",
        tax_benefit: "헤알화 80% 전액 비과세(이자+매매차익) + 달러 분산",
        risk_level: "적극투자 (듀레이션 5.5~7.0년, 자본차익 레버리지)",
        best_for: "3~5년 이상 여유자금으로, 금리 어깨/고점(14.0%~14.5% 이상) 구간에서 듀레이션을 적극 늘려 금리 인하 사이클 도래 시 막대한 자본차익(Capital Gain)과 연 14%대 고쿠폰 인컴을 극대화하려는 적극투자자",
        pros: [
            "금리 100bp 인하 시 장기채(50%) 레버리지로 포트폴리오 자본차익 극대화",
            "중기채(30%)의 14%대 고쿠폰 비과세 인컴을 확정 수취하여 현금흐름 강화",
            "달러 장기채(20%) 편입으로 헤알화 급변동 및 국가위험 테일 리스크 헷지",
        ],
        cons: [
            "단기채 비중이 없어 금리 단기 스파이크 시 평가손실 변동성 노출",
            "최소 3년 이상 인출 필요 없는 여유자금 운용 필수",
        ],
        allocation_tranche3: "★ Tranche 3 적극 추천 (고수익·여유자금형)",
    },
];

const DEFAULT_STRATEGY: ElectionStrategy = {
    principles: [
        {
            title: "금리 레벨 기반 듀레이션 기술적 배분 원칙 (금리 고점 = 장기채 확대)",
            body: "채권 투자의 교과서적 기술 원칙은 '금리가 높은 수준이면 듀레이션을 늘려 장기채를 매수(고쿠폰 장기 락인 + 향후 금리 인하 시 자본차익 극대화)'하고, '금리가 낮은 수준이면 듀레이션을 줄여 단기채를 매수(금리 상승 리스크 방어)'하는 것입니다. 현재 브라질 10년물 금리는 '어깨' 수준으로 역사적 고점에 근접해 있으며, 대선 노이즈로 14.5% 이상 스파이크 시 장기채 비중을 50%까지 적극 확대하는 것이 기술적으로 최적입니다.",
            tag: "듀레이션 기술원칙",
        },
        {
            title: "대선 직전 불확실성 정점 대응 (성향별 듀레이션 바벨화)",
            body: "여론조사 격차가 오차범위 내 초박빙일 경우 헤알화 변동성과 장기채 금리 스프레드가 급확대됩니다. 보수적 투자자는 2~3년물 단기채 50%를 섞어 안정성을 방어하고, 고수익 추구 여유자금 투자자는 장기채 50% + 중기채 30% + 달러채 20% 바벨로 자본차익과 환헷지를 동시에 공략하십시오.",
            tag: "바벨 포트폴리오",
        },
        {
            title: "금리 수준 기반 분할 매수 (14.5% 스파이크 낚아채기)",
            body: "정치적 노이즈로 5~10년물 금리가 고점(14.5% 이상, 15% 접근)으로 튀는 구간은 시나리오 A 또는 B로 수렴할 경우 매력적인 역사적 진입 기회입니다. 공포가 극대화되는 시점에 Tranche 3 잔여 40%를 분할 집행하십시오.",
            tag: "분할 매수",
        },
        {
            title: "BCB 중앙은행 독립성 방파제 및 의회 구도 추적",
            body: "2021년 제정된 중앙은행 독립법(LC 179)으로 인해 총재 임기가 보장되어 있어 정권의 극단적 포퓰리즘에 대한 제도적 브레이크가 작동합니다. 의회(상·하원) 내 중도·우파 연합(Centrão)의 과반 의석 확보 여부와 함께 최후 방파제를 확인하십시오.",
            tag: "제도적 방파제",
        },
    ],
    checkpoints: [
        { name: "차기 재무장관 성향", focus: "시장 신뢰형(페르난두 아다지 유임 or 온건 실용파) vs 급진 포퓰리스트" },
        { name: "의회 Centrão 의석수", focus: "하원 513석 중 중도·보수 300석 이상 확보 시 좌파 포퓰리즘 법안 완벽 저지" },
        { name: "BCB 중앙은행 법적 독립성", focus: "2021년 법제화된 임기 보장 총재 체제로 Worst 시나리오의 통화정책 훼손 상방 차단" },
        { name: "신재정준칙 준수 여부", focus: "Primary Deficit(기본재정적자) GDP 0% 목표 유지 선언 여부" },
    ],
};

function ElectionPlaybookSection({
    scenarios,
    recommendedBonds,
    strategy,
    pulse,
    pulseAt,
    pulseGenLoading,
    onGeneratePulse,
}: {
    scenarios?: ElectionScenario[];
    recommendedBonds?: RecommendedBond[];
    strategy?: ElectionStrategy;
    pulse: ElectionPulse | null;
    pulseAt: string | null;
    pulseGenLoading: boolean;
    onGeneratePulse: () => void;
}) {
    const scenarioList = scenarios?.length ? scenarios : DEFAULT_SCENARIOS;
    const bondList = recommendedBonds?.length ? recommendedBonds : DEFAULT_RECOMMENDED_BONDS;
    const strat = strategy?.principles?.length ? strategy : DEFAULT_STRATEGY;

    const [activeTab, setActiveTab] = useState<'scenarios' | 'bonds' | 'strategy'>('scenarios');
    const [selectedScenarioId, setSelectedScenarioId] = useState<'A' | 'B' | 'C'>('B');
    const [selectedBondId, setSelectedBondId] = useState<string>('barbell_strategy');
    const tabNavRef = useRef<HTMLDivElement>(null);

    const handleTabClick = (tab: 'scenarios' | 'bonds' | 'strategy') => {
        setActiveTab(tab);
        const alignTabToTop = () => {
            if (tabNavRef.current) {
                const rect = tabNavRef.current.getBoundingClientRect();
                const targetY = window.scrollY + rect.top;
                window.scrollTo({
                    top: Math.max(0, targetY),
                    behavior: 'smooth'
                });
            }
        };
        requestAnimationFrame(() => {
            alignTabToTop();
            setTimeout(alignTabToTop, 50);
        });
    };

    const curScenario = scenarioList.find(s => s.id === selectedScenarioId) || scenarioList[1];
    const probs = pulse?.convergence_scenario?.probabilities || { A: 25, B: 60, C: 15 };

    return (
        <section className="bg-gradient-to-br from-amber-950/20 via-black/40 to-emerald-950/20 rounded-3xl border border-amber-500/20 p-5 md:p-6 backdrop-blur-xl shadow-2xl relative">
            {/* Ambient background glow (overflow-hidden isolated so sticky works) */}
            <div className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none">
                <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl" />
                <div className="absolute bottom-0 left-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl" />
            </div>

            {/* 1. Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-5 relative z-10">
                <div className="flex items-center gap-2.5">
                    <div className="p-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 shadow-inner">
                        <Vote className="w-5 h-5" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-base md:text-lg font-black text-white tracking-tight">10월 대선 3대 시나리오 & Tranche 3 실시간 투자 가이드</h3>
                            <span className="bg-amber-400 text-black text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider shadow">
                                {getElectionDDayLabel()} SPECIAL
                            </span>
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">
                            대선 결과별 금리·환율 영향도 · 조건별 추천 국채 라인업(헤알/달러) · 실시간 현지 정세(AI Live Pulse)
                        </p>
                    </div>
                </div>

                <button
                    onClick={onGeneratePulse}
                    disabled={pulseGenLoading}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-amber-500 to-emerald-500 text-black hover:brightness-110 transition shadow-lg shadow-amber-500/20 disabled:opacity-50 cursor-pointer font-black"
                >
                    <RefreshCw className={`w-3.5 h-3.5 ${pulseGenLoading ? 'animate-spin' : ''}`} />
                    {pulseGenLoading ? '정세 분석 생성 중…' : '대선 정세 AI 실시간 분석'}
                </button>
            </div>

            {/* 2. AI Live Pulse 실시간 현지 브리핑 카드 */}
            {pulse && (
                <div className="bg-black/30 rounded-2xl border border-amber-500/30 p-4 md:p-5 mb-5 relative z-10 shadow-lg">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                            <span className="flex h-2 w-2 relative">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                            </span>
                            <span className="text-[11px] font-black tracking-wider uppercase text-amber-300 flex items-center gap-1">
                                <Sparkles className="w-3.5 h-3.5 text-amber-400" /> 실시간 현지 브리핑 & 시장 향배 분석 (AI Live Pulse)
                            </span>
                        </div>
                        {pulseAt && (
                            <span className="text-[10px] text-gray-500 font-mono">
                                최근 분석: {new Date(pulseAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} 기준
                            </span>
                        )}
                    </div>

                    <h4 className="text-sm md:text-base font-black text-amber-100 leading-snug mb-1.5">
                        {renderFlexibleContent(pulse.headline)}
                    </h4>
                    <div className="text-xs text-gray-300 leading-relaxed mb-4">
                        {renderFlexibleContent(pulse.market_mood)}
                    </div>

                    {/* 시나리오 수렴도 프로그레스 바 */}
                    <div className="bg-black/40 rounded-xl p-3 border border-white/5 mb-4">
                        <div className="flex items-center justify-between text-[11px] font-bold mb-2">
                            <span className="text-gray-400 flex items-center gap-1.5">
                                <Scale className="w-3.5 h-3.5 text-cyan-400" /> 시나리오별 시장 반영 확률 (Convergence Probability)
                            </span>
                            <div className="flex items-center gap-3">
                                <span className="text-emerald-400">A (우파교체): {probs.A}%</span>
                                <span className="text-cyan-400 font-black">B (온건연임): {probs.B}% ★기본선</span>
                                <span className="text-rose-400">C (강경화): {probs.C}%</span>
                            </div>
                        </div>
                        <div className="w-full h-3 bg-gray-800 rounded-full overflow-hidden flex shadow-inner">
                            <div style={{ width: `${probs.A}%` }} className="bg-emerald-500 transition-all duration-500" title={`시나리오 A: ${probs.A}%`} />
                            <div style={{ width: `${probs.B}%` }} className="bg-cyan-500 transition-all duration-500" title={`시나리오 B: ${probs.B}%`} />
                            <div style={{ width: `${probs.C}%` }} className="bg-rose-500 transition-all duration-500" title={`시나리오 C: ${probs.C}%`} />
                        </div>
                        {pulse.convergence_scenario?.reasoning && (
                            <div className="text-[11px] text-gray-400 mt-2 leading-relaxed">
                                <span className="text-cyan-300 font-semibold">시장 판단 요약: </span>
                                {renderFlexibleContent(pulse.convergence_scenario.reasoning)}
                            </div>
                        )}
                    </div>

                    {/* 2단 실시간 분석 그리드 */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                        <div className="bg-black/25 rounded-xl p-3.5 border border-white/5">
                            <p className="text-xs font-bold text-amber-300 mb-1 flex items-center gap-1.5">
                                <Landmark className="w-3.5 h-3.5" /> 현지 정치 & 의회(Centrão) 구도 실시간 분석
                            </p>
                            <div className="text-xs text-gray-300 leading-relaxed font-normal">
                                {renderFlexibleContent(pulse.live_analysis)}
                            </div>
                        </div>
                        <div className="bg-black/25 rounded-xl p-3.5 border border-white/5 space-y-2">
                            <div>
                                <p className="text-xs font-bold text-emerald-300 mb-1 flex items-center gap-1.5">
                                    <Target className="w-3.5 h-3.5" /> Tranche 3 (잔여 40%) 분할 매수 실행 권고
                                </p>
                                <div className="text-xs text-gray-300 leading-relaxed font-normal">
                                    {renderFlexibleContent(pulse.tranche3_action)}
                                </div>
                            </div>
                            <div className="pt-2 border-t border-white/5">
                                <p className="text-xs font-bold text-cyan-300 mb-1 flex items-center gap-1.5">
                                    <Award className="w-3.5 h-3.5" /> 최우선 추천 포트폴리오 픽
                                </p>
                                <div className="text-xs text-gray-300 leading-relaxed font-normal">
                                    {renderFlexibleContent(pulse.recommended_bond_guide)}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* 3. 탭 내비게이션 (화면 최상단 sticky 고정 & 일관된 배치) */}
            <div
                ref={tabNavRef}
                className="sticky top-0 z-30 flex flex-wrap items-center gap-2 mb-4 border-b border-white/10 pb-3 pt-3 bg-[#0a0f1d]/90 backdrop-blur-xl -mx-3 px-3 md:-mx-4 md:px-4 rounded-xl shadow-lg transition-all"
            >
                <button
                    onClick={() => handleTabClick('scenarios')}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                        activeTab === 'scenarios'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                            : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                >
                    <Layers className="w-3.5 h-3.5" /> 📊 3대 대선 시나리오 비교 매트릭스
                </button>
                <button
                    onClick={() => handleTabClick('bonds')}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                        activeTab === 'bonds'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                            : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                >
                    <DollarSign className="w-3.5 h-3.5" /> 🎯 추천 브라질 국채 라인업 (헤알/달러)
                </button>
                <button
                    onClick={() => handleTabClick('strategy')}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                        activeTab === 'strategy'
                            ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                            : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                >
                    <ShieldCheck className="w-3.5 h-3.5" /> 🧭 Tranche 3 실행 전략 & 체크리스트
                </button>
            </div>

            {/* 4. 탭 1: 대선 3대 시나리오 비교 */}
            {activeTab === 'scenarios' && (
                <div className="space-y-4 relative z-10">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {scenarioList.map((sc) => {
                            const isSelected = sc.id === selectedScenarioId;
                            const isBest = sc.id === 'A';
                            const isNeutral = sc.id === 'B';
                            return (
                                <div
                                    key={sc.id}
                                    onClick={() => setSelectedScenarioId(sc.id as any)}
                                    className={`rounded-2xl p-4 transition-all duration-300 cursor-pointer relative border ${
                                        isSelected
                                            ? isBest
                                                ? 'bg-gradient-to-br from-emerald-950/40 to-black/30 border-emerald-400 ring-2 ring-emerald-400/50 shadow-[0_0_20px_rgba(16,185,129,0.2)]'
                                                : isNeutral
                                                    ? 'bg-gradient-to-br from-cyan-950/40 to-black/30 border-cyan-400 ring-2 ring-cyan-400/50 shadow-[0_0_20px_rgba(6,182,212,0.2)]'
                                                    : 'bg-gradient-to-br from-rose-950/40 to-black/30 border-rose-400 ring-2 ring-rose-400/50 shadow-[0_0_20px_rgba(244,63,94,0.2)]'
                                            : 'bg-black/20 hover:bg-black/30 border-white/5 hover:border-white/10 opacity-80'
                                    }`}
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                                            isBest
                                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                                                : isNeutral
                                                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/30'
                                                    : 'bg-rose-500/20 text-rose-300 border border-rose-400/30'
                                        }`}>
                                            {sc.verdict}
                                        </span>
                                        {isNeutral && (
                                            <span className="text-[10px] font-bold text-amber-300 bg-amber-500/10 px-1.5 py-0.5 rounded">
                                                ★ 기본선
                                            </span>
                                        )}
                                    </div>
                                    <h4 className="text-sm font-black text-white mb-0.5">{sc.title}</h4>
                                    <p className="text-[11px] text-gray-400 mb-3">{sc.subtitle}</p>

                                    <div className="space-y-1.5 text-xs">
                                        <div className="flex items-center justify-between bg-black/30 px-2.5 py-1.5 rounded-lg border border-white/5">
                                            <span className="text-gray-400">10년물 국채금리</span>
                                            <span className={`font-bold ${isBest ? 'text-emerald-300' : isNeutral ? 'text-cyan-300' : 'text-rose-300'}`}>
                                                {sc.rate_10y}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between bg-black/30 px-2.5 py-1.5 rounded-lg border border-white/5">
                                            <span className="text-gray-400">헤알화 (BRL)</span>
                                            <span className={`font-bold ${isBest ? 'text-emerald-300' : isNeutral ? 'text-cyan-300' : 'text-rose-300'}`}>
                                                {sc.brl_fx}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="mt-3 pt-2.5 border-t border-white/5 flex items-center justify-between text-[11px]">
                                        <span className="text-gray-400">{isSelected ? '▼ 상세 분석 선택됨' : '클릭하여 세부 영향도 확인'}</span>
                                        <ChevronRight className={`w-3.5 h-3.5 text-gray-400 transition-transform ${isSelected ? 'rotate-90' : ''}`} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* 선택된 시나리오 상세 영향도 패널 */}
                    {curScenario && (
                        <div className="bg-black/30 rounded-2xl border border-white/10 p-5 space-y-4">
                            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
                                <div>
                                    <span className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">선택된 시나리오 심층 영향도 분석</span>
                                    <h4 className="text-base font-black text-white flex items-center gap-2 mt-0.5">
                                        {curScenario.title}
                                        <span className="text-xs font-normal text-gray-400">({curScenario.subtitle})</span>
                                    </h4>
                                </div>
                                <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                                    curScenario.id === 'A'
                                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
                                        : curScenario.id === 'B'
                                            ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/40'
                                            : 'bg-rose-500/20 text-rose-300 border border-rose-400/40'
                                }`}>
                                    종합 판정: {curScenario.verdict}
                                </span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                                <div className="bg-black/25 rounded-xl p-3.5 border border-white/5 space-y-1">
                                    <span className="text-[10px] text-gray-400 font-bold uppercase">정치 구도 & 재정 정책 기조</span>
                                    <p className="text-xs text-gray-200 font-medium">정치: {curScenario.political_landscape}</p>
                                    <p className="text-xs text-gray-400 mt-1 leading-relaxed">재정: {curScenario.fiscal_policy}</p>
                                </div>
                                <div className="bg-black/25 rounded-xl p-3.5 border border-white/5 space-y-1">
                                    <span className="text-[10px] text-gray-400 font-bold uppercase">중앙은행(BCB) 관계 & 독립성</span>
                                    <p className="text-xs text-gray-200 font-medium">{curScenario.bcb_relationship}</p>
                                    <p className="text-xs text-gray-400 mt-1 leading-relaxed">기준금리 및 디스인플레이션 정책의 자율성 보장 여부</p>
                                </div>
                                <div className="bg-black/25 rounded-xl p-3.5 border border-white/5 space-y-1">
                                    <span className="text-[10px] text-gray-400 font-bold uppercase">시장 반응 & 채권 가격 (자본손익)</span>
                                    <p className="text-xs text-gray-200 font-medium">{curScenario.market_reaction}</p>
                                    <p className="text-xs text-gray-400 mt-1 leading-relaxed">{curScenario.bond_price}</p>
                                </div>
                                <div className="bg-black/25 rounded-xl p-3.5 border border-white/5 space-y-1">
                                    <span className="text-[10px] text-gray-400 font-bold uppercase">환율(헤알화/원화) 및 토탈 리턴</span>
                                    <p className="text-xs text-gray-200 font-medium">{curScenario.fx_change_str}</p>
                                    <p className="text-xs text-gray-400 mt-1 leading-relaxed">{curScenario.fx_impact}</p>
                                </div>
                            </div>

                            <div className="bg-gradient-to-r from-emerald-950/30 to-black/30 rounded-xl p-4 border border-emerald-500/30">
                                <p className="text-xs font-bold text-emerald-300 mb-1 flex items-center gap-1.5">
                                    <Award className="w-3.5 h-3.5" /> 실전 채권 투자 액션 가이드
                                </p>
                                <p className="text-xs text-gray-200 leading-relaxed font-medium">
                                    {curScenario.action_guide}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* 3대 시나리오 한눈에 비교 종합 테이블 */}
                    <div className="bg-black/20 rounded-2xl border border-white/5 p-4 overflow-x-auto">
                        <p className="text-xs font-bold text-white mb-2.5 flex items-center gap-1.5">
                            <Layers className="w-3.5 h-3.5 text-amber-400" /> 3대 시나리오 핵심 비교 종합표
                        </p>
                        <table className="w-full text-xs text-left">
                            <thead>
                                <tr className="border-b border-white/10 text-gray-400">
                                    <th className="py-2 px-3 font-semibold">구분</th>
                                    <th className="py-2 px-3 font-semibold text-emerald-300">시나리오 A: 중도·우파 정권 교체</th>
                                    <th className="py-2 px-3 font-semibold text-cyan-300">시나리오 B: 현 좌파 연임 (온건·실용)</th>
                                    <th className="py-2 px-3 font-semibold text-rose-300">시나리오 C: 좌파 강경화 (확장 재정)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                <tr>
                                    <td className="py-2 px-3 text-gray-400 font-medium">정치 구도</td>
                                    <td className="py-2 px-3 text-gray-200">우파/중도 후보 승리 (시장 친화적 연합)</td>
                                    <td className="py-2 px-3 text-gray-200 font-semibold text-cyan-200">룰라 연임 + 의회 중도파(Centrão) 연정</td>
                                    <td className="py-2 px-3 text-gray-300">룰라 연임 + 좌파 포퓰리즘 강화</td>
                                </tr>
                                <tr>
                                    <td className="py-2 px-3 text-gray-400 font-medium">재정 정책</td>
                                    <td className="py-2 px-3 text-gray-200">지출 축소, 민영화, 재정준칙 강화</td>
                                    <td className="py-2 px-3 text-gray-200">현 신재정프레임워크 유지, 세수 확충</td>
                                    <td className="py-2 px-3 text-gray-300">복지·공공지출 확대, 부채한도 완화</td>
                                </tr>
                                <tr>
                                    <td className="py-2 px-3 text-gray-400 font-medium">중앙은행 관계</td>
                                    <td className="py-2 px-3 text-gray-200">중앙은행 독립성 적극 지지</td>
                                    <td className="py-2 px-3 text-gray-200">금리 인하 압박 있으나 독립성 인정</td>
                                    <td className="py-2 px-3 text-gray-300">Selic 인하 압박 (단, 2021년 BCB 독립법으로 통화정책 훼손 상방 차단)</td>
                                </tr>
                                <tr>
                                    <td className="py-2 px-3 text-gray-400 font-medium">10년물 국채금리</td>
                                    <td className="py-2 px-3 text-emerald-400 font-bold">100~200bp 하락 (자본차익 극대화)</td>
                                    <td className="py-2 px-3 text-cyan-400 font-bold">중립 / 완만한 하락 (소폭 등락)</td>
                                    <td className="py-2 px-3 text-rose-400 font-bold">150~250bp 급등 (15% 이상 폭등)</td>
                                </tr>
                                <tr>
                                    <td className="py-2 px-3 text-gray-400 font-medium">헤알화 (BRL)</td>
                                    <td className="py-2 px-3 text-emerald-400 font-bold">강세 (외인 자금 대규모 유입)</td>
                                    <td className="py-2 px-3 text-cyan-400 font-bold">보합 / 완만한 흐름</td>
                                    <td className="py-2 px-3 text-rose-400 font-bold">약세 / 급락 (외인 자본 유출)</td>
                                </tr>
                                <tr>
                                    <td className="py-2 px-3 text-gray-400 font-medium">채권 종합 판정</td>
                                    <td className="py-2 px-3 text-emerald-300 font-black">★ Best (자본차익 + 환차익)</td>
                                    <td className="py-2 px-3 text-cyan-300 font-black">● Neutral (이자 수익 중심)</td>
                                    <td className="py-2 px-3 text-rose-300 font-black">▲ Worst (원금 + 환손실 위험, 단 BCB 독립성으로 하방 제한)</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* 5. 탭 2: 추천 브라질 국채 라인업 (헤알/달러) */}
            {activeTab === 'bonds' && (
                <div className="space-y-4 relative z-10">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {bondList.map((bond) => {
                            const isSelected = bond.id === selectedBondId;
                            const isBarbell = bond.id === 'barbell_strategy';
                            const isAggressiveBarbell = bond.id === 'aggressive_barbell';
                            const isUsd = bond.id === 'usd_sovereign';
                            return (
                                <div
                                    key={bond.id}
                                    onClick={() => setSelectedBondId(bond.id)}
                                    className={`rounded-2xl p-4 md:p-5 transition-all duration-300 border cursor-pointer relative ${
                                        isSelected
                                            ? isAggressiveBarbell
                                                ? 'bg-gradient-to-br from-rose-950/40 via-amber-950/30 to-black/40 border-rose-400 ring-2 ring-rose-400/50 shadow-[0_0_25px_rgba(244,63,94,0.25)]'
                                                : isBarbell
                                                    ? 'bg-gradient-to-br from-amber-950/40 via-emerald-950/30 to-black/40 border-amber-400 ring-2 ring-amber-400/50 shadow-[0_0_25px_rgba(245,158,11,0.25)]'
                                                    : isUsd
                                                        ? 'bg-gradient-to-br from-indigo-950/40 to-black/30 border-indigo-400 ring-2 ring-indigo-400/50 shadow-[0_0_20px_rgba(99,102,241,0.2)]'
                                                        : 'bg-gradient-to-br from-emerald-950/40 to-black/30 border-emerald-400 ring-2 ring-emerald-400/50 shadow-[0_0_20px_rgba(16,185,129,0.2)]'
                                            : 'bg-black/25 hover:bg-black/35 border-white/5 hover:border-white/10 opacity-85'
                                    }`}
                                >
                                    <div className="flex flex-wrap items-center justify-between gap-1.5 mb-2.5">
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/10 text-gray-300 font-mono">
                                                {bond.currency}
                                            </span>
                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/10 text-gray-300">
                                                {bond.maturity_years}
                                            </span>
                                        </div>
                                        <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                                            isAggressiveBarbell
                                                ? 'bg-gradient-to-r from-rose-500 to-amber-500 text-white shadow-md'
                                                : isBarbell
                                                    ? 'bg-amber-400 text-black shadow-md'
                                                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                                        }`}>
                                            {bond.allocation_tranche3}
                                        </span>
                                    </div>

                                    <h4 className="text-sm md:text-base font-black text-white mb-0.5">{bond.name}</h4>
                                    <p className="text-xs text-gray-400 font-mono mb-3">{bond.code_example}</p>

                                    {/* 주요 스펙 박스 */}
                                    <div className="grid grid-cols-2 gap-2 bg-black/40 rounded-xl p-3 border border-white/5 mb-3 text-xs">
                                        <div>
                                            <span className="text-gray-500 block text-[10px]">만기수익률 (YTM)</span>
                                            <span className="font-bold text-emerald-300">{bond.current_ytm}</span>
                                        </div>
                                        <div>
                                            <span className="text-gray-500 block text-[10px]">표면이율 (쿠폰)</span>
                                            <span className="font-bold text-white">{bond.coupon_rate}</span>
                                        </div>
                                        <div>
                                            <span className="text-gray-500 block text-[10px]">권장 투자기간</span>
                                            <span className="font-medium text-gray-200">{bond.target_horizon}</span>
                                        </div>
                                        <div>
                                            <span className="text-gray-500 block text-[10px]">세제 혜택</span>
                                            <span className="font-bold text-cyan-300">{bond.tax_benefit.includes('비과세') ? '0% 전액 비과세' : '해외과세 적용'}</span>
                                        </div>
                                    </div>

                                    <p className="text-xs text-gray-300 leading-relaxed mb-3">
                                        <span className="text-amber-300 font-semibold">추천 대상: </span>
                                        {bond.best_for}
                                    </p>

                                    {/* 장점 & 주의점 */}
                                    <div className="space-y-1 pt-2 border-t border-white/5 text-[11px]">
                                        <div className="text-emerald-400 flex items-start gap-1">
                                            <span>✓</span>
                                            <span>{bond.pros.join(' · ')}</span>
                                        </div>
                                        <div className="text-gray-400 flex items-start gap-1">
                                            <span>△</span>
                                            <span>{bond.cons.join(' · ')}</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* 6. 탭 3: Tranche 3 실행 전략 & 체크리스트 */}
            {activeTab === 'strategy' && (
                <div className="space-y-4 relative z-10">
                    {/* 3대 핵심 투자 원칙 */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {strat.principles.map((pr, i) => (
                            <div key={i} className="bg-black/25 rounded-2xl p-4 border border-white/5">
                                <span className="text-[10px] font-bold text-cyan-300 bg-cyan-500/10 px-2 py-0.5 rounded-full uppercase tracking-wider">
                                    원칙 {i + 1} · {pr.tag}
                                </span>
                                <h4 className="text-sm font-bold text-white mt-2 mb-1.5">{pr.title}</h4>
                                <p className="text-xs text-gray-300 leading-relaxed font-normal">{pr.body}</p>
                            </div>
                        ))}
                    </div>

                    {/* 핵심 모니터링 체크포인트 테이블 */}
                    <div className="bg-black/30 rounded-2xl border border-white/10 p-5">
                        <p className="text-xs font-bold text-amber-300 mb-3 flex items-center gap-1.5">
                            <ShieldCheck className="w-4 h-4 text-amber-400" /> 실시간 핵심 모니터링 체크포인트 (대선 전후 확인 필수)
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                            {strat.checkpoints.map((cp, i) => (
                                <div key={i} className="bg-black/30 p-3 rounded-xl border border-white/5 flex items-start gap-2.5">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                                    <div>
                                        <span className="font-bold text-white block">{cp.name}</span>
                                        <span className="text-gray-400 mt-0.5 block leading-relaxed">{cp.focus}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* 관전 포인트 */}
                    {pulse?.monitoring_points && pulse.monitoring_points.length > 0 && (
                        <div className="bg-gradient-to-r from-amber-950/20 to-black/20 rounded-2xl p-4 border border-amber-500/20">
                            <p className="text-xs font-bold text-amber-300 mb-2 flex items-center gap-1.5">
                                <CalendarClock className="w-3.5 h-3.5" /> 이번 주말 / 대선 당일 집중 관전 포인트 3선
                            </p>
                            <ul className="space-y-1.5">
                                {pulse.monitoring_points.map((mp, i) => (
                                    <li key={i} className="text-xs text-gray-200 flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                                        <span>{renderFlexibleContent(mp)}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            )}
        </section>
    );
}

// ── 유틸: 여러 시계열을 date 기준 병합 ───────────────────────────────────────
function mergeSeries(history: Record<string, { date: string; value: number }[]>, keys: string[]) {
    const map = new Map<string, any>();
    for (const k of keys) {
        for (const pt of (history[k] || [])) {
            if (!map.has(pt.date)) map.set(pt.date, { date: pt.date });
            map.get(pt.date)[k] = pt.value;
        }
    }
    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
}
