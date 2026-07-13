"use client";
// 브라질 국채 매크로 대시보드·Activation Zone 신호·AI 전략 리포트·캐리 쿠션 시뮬레이터 뷰

import React, { useEffect, useMemo, useState } from 'react';
import {
    ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid,
    Tooltip as RechartsTooltip, Legend, ScatterChart, Scatter, ReferenceArea, ReferenceLine, ZAxis,
} from 'recharts';
import {
    Flag, TrendingDown, Gauge, AlertTriangle, Target, CalendarClock,
    Sparkles, RefreshCw, Layers, ShieldCheck, ArrowDownRight, Info, CheckCircle2,
    Newspaper, Bell, ExternalLink, Send, Settings,
} from 'lucide-react';
import { API_BASE } from '@/lib/apiConfig';

// ── 타입 ────────────────────────────────────────────────────────────────────
interface Indicator {
    key: string; label: string; unit: string; date: string | null;
    value: number | null; prev: number | null; change: number | null; gauge: string;
}
interface Signal {
    zone: string; grade: string; color: string;
    rate_ok: boolean; fx_ok: boolean; headline: string; action: string;
}
interface CarryPoint {
    fx_end: number; fx_change_pct: number; total_return_pct: number; cagr_pct: number; is_breakeven: boolean;
}
interface Catalyst { date: string; key: string; title: string; note: string; impact: string; d_day: number; }
interface Summary {
    as_of: string;
    indicators: Indicator[];
    real_rate: { label: string; unit: string; value: number | null; gauge: string };
    focus: { selic_eoy: number | null; ipca_eoy: number | null; usdbrl_eoy: number | null };
    signal: Signal;
    targets: { rate_floor: number; rate_tranche2: number; rate_risk: number; fx_target: number };
    carry_cushion: CarryPoint[];
    timeline: Catalyst[];
    next_catalyst: Catalyst | null;
    aug_scenarios: { id: string; title: string; color: string; logic: string; action: string }[];
    tranches: { id: number; weight: string; timing: string; trigger: string; rationale: string }[];
    due_diligence: { title: string; body: string }[];
}
interface AiInsight {
    verdict?: { grade: string; summary: string };
    analysis?: { cards: { title: string; body: string }[] };
    strategy?: { entry: string; hold: string; exit: string };
    execution_checklist?: string[];
    risk_footnote?: string;
}
interface NewsItem { title: string; source: string; link: string; published: string | null; }

// ── 색 유틸 ──────────────────────────────────────────────────────────────────
const GAUGE_STYLE: Record<string, { dot: string; text: string; ring: string; label: string }> = {
    green: { dot: 'bg-emerald-400', text: 'text-emerald-300', ring: 'ring-emerald-500/30', label: '양호' },
    amber: { dot: 'bg-amber-400', text: 'text-amber-300', ring: 'ring-amber-500/30', label: '주의' },
    red: { dot: 'bg-rose-500', text: 'text-rose-300', ring: 'ring-rose-500/30', label: '경고' },
    gray: { dot: 'bg-gray-500', text: 'text-gray-300', ring: 'ring-gray-500/20', label: '중립' },
};
const ZONE_STYLE: Record<string, { from: string; to: string; badge: string }> = {
    TRANCHE1: { from: 'from-emerald-600', to: 'to-green-600', badge: 'bg-emerald-500' },
    TRANCHE2: { from: 'from-emerald-600', to: 'to-teal-600', badge: 'bg-emerald-500' },
    WATCH: { from: 'from-slate-600', to: 'to-gray-600', badge: 'bg-slate-500' },
    RISK_REASSESS: { from: 'from-rose-700', to: 'to-red-700', badge: 'bg-rose-600' },
    UNKNOWN: { from: 'from-gray-700', to: 'to-gray-700', badge: 'bg-gray-600' },
};

const fmt = (v: number | null | undefined, d = 2) =>
    v === null || v === undefined ? '—' : v.toLocaleString('ko-KR', { minimumFractionDigits: d, maximumFractionDigits: d });

export default function BrazilBondTab() {
    const [summary, setSummary] = useState<Summary | null>(null);
    const [history, setHistory] = useState<Record<string, { date: string; value: number }[]>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [insight, setInsight] = useState<AiInsight | null>(null);
    const [insightAt, setInsightAt] = useState<string | null>(null);
    const [genLoading, setGenLoading] = useState(false);

    const [news, setNews] = useState<NewsItem[]>([]);
    const [newsLoading, setNewsLoading] = useState(true);

    useEffect(() => {
        // 1. Try to load cached data from localStorage for instant 0ms load
        try {
            const cachedSummary = localStorage.getItem('brazil_bond_summary');
            const cachedHistory = localStorage.getItem('brazil_bond_history');
            const cachedInsight = localStorage.getItem('brazil_bond_insight');
            const cachedNews = localStorage.getItem('brazil_bond_news');

            if (cachedSummary) setSummary(JSON.parse(cachedSummary));
            if (cachedHistory) setHistory(JSON.parse(cachedHistory));
            if (cachedInsight) {
                const j = JSON.parse(cachedInsight);
                setInsight(j.content || null);
                setInsightAt(j.generated_at || null);
            }
            if (cachedNews) setNews(JSON.parse(cachedNews));

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
        (async () => {
            try {
                // If there's no cache, show spinner
                if (!localStorage.getItem('brazil_bond_summary') || !localStorage.getItem('brazil_bond_history')) {
                    setLoading(true);
                }
                const [sRes, hRes, iRes] = await Promise.all([
                    fetch(`${API_BASE}/api/v1/brazil-bond/summary`, { cache: 'no-store' }),
                    fetch(`${API_BASE}/api/v1/brazil-bond/history?series=selic_target,y5,y5_fred,ipca_12m,brl_krw,usd_brl,focus_selic_eoy&years=10`, { cache: 'no-store' }),
                    fetch(`${API_BASE}/api/v1/brazil-bond/insight`, { cache: 'no-store' }),
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
                }
            } catch (e: any) {
                if (!localStorage.getItem('brazil_bond_summary')) {
                    setError(String(e?.message || e));
                } else {
                    console.error("Background refresh failed:", e);
                }
            } finally {
                setLoading(false);
            }
        })();

        // 3. Fetch news in the background (using refresh=false to avoid live scraping)
        (async () => {
            try {
                if (!localStorage.getItem('brazil_bond_news')) {
                    setNewsLoading(true);
                }
                const r = await fetch(`${API_BASE}/api/v1/brazil-bond/news?limit=12&refresh=false`, { cache: 'no-store' });
                if (r.ok) {
                    const nData = (await r.json()).items || [];
                    setNews(nData);
                    localStorage.setItem('brazil_bond_news', JSON.stringify(nData));
                }
            } catch (e) {
                console.error("Background news refresh failed:", e);
            } finally {
                setNewsLoading(false);
            }
        })();
    }, []);

    const generateReport = async () => {
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
        } catch (e: any) {
            alert(`AI 리포트 생성 오류: ${e?.message || e}`);
        } finally {
            setGenLoading(false);
        }
    };

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
                            <div className="text-3xl font-black text-white leading-none">D-{s.next_catalyst.d_day}</div>
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
                        date: null,
                        value: s.real_rate.value,
                        prev: null,
                        change: null,
                        gauge: s.real_rate.gauge
                    }} />
                    <GaugeCard ind={{
                        key: 'focus_selic_eoy',
                        label: 'Focus 연말 Selic 컨센서스',
                        unit: '%',
                        date: null,
                        value: s.focus.selic_eoy,
                        prev: null,
                        change: null,
                        gauge: (s.focus as any).selic_eoy_gauge || 'gray'
                    }} />
                    <GaugeCard ind={{
                        key: 'focus_ipca_eoy',
                        label: 'Focus 연말 IPCA 컨센서스',
                        unit: '%',
                        date: null,
                        value: s.focus.ipca_eoy,
                        prev: null,
                        change: null,
                        gauge: (s.focus as any).ipca_eoy_gauge || 'gray'
                    }} />
                    <GaugeCard ind={{
                        key: 'focus_usdbrl_eoy',
                        label: 'Focus 연말 USD/BRL',
                        unit: '',
                        date: null,
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
                    <SectionTitle icon={<Target className="w-5 h-5 text-emerald-400" />} title="The Activation Zone" sub="2축 목표 진입 구간 맵 (금리 × 환율)" />
                    <ActivationZoneChart summary={s} />
                </div>
                <div className="bg-black/20 rounded-2xl border border-white/5 p-4">
                    <SectionTitle icon={<TrendingDown className="w-5 h-5 text-cyan-400" />} title="금리 사이클" sub="Selic vs 5년물 국채금리 vs IPCA (10년)" />
                    <RateCycleChart history={history} />
                    <div className="mt-4 p-3 bg-white/5 border border-white/5 rounded-xl text-xs text-gray-400 space-y-1.5">
                        <div className="font-bold text-gray-300 flex items-center gap-1">
                            💡 금리 사이클 해석 가이드
                        </div>
                        <ul className="list-disc list-inside space-y-1 text-[11px] leading-relaxed">
                            <li><strong className="text-gray-300">기준금리(Selic) & 물가(IPCA) 관계:</strong> 인플레이션(IPCA) 상승에 대응하여 중앙은행은 Selic 금리를 인상하고, 물가가 안정되면 Selic 금리를 인하하는 전형적인 지연 후행 사이클을 보입니다.</li>
                            <li><strong className="text-gray-300">5년물 국채금리 선행성:</strong> 시장 금리인 5년물 국채금리는 통화정책 회의(Copom) 결정보다 수개월 앞서 시장의 재정 리스크, 기대 인플레이션, 대선 변동성을 반영하며 고점을 찍고 내려오는 선행 경향이 있습니다.</li>
                            <li><strong className="text-gray-300">투자 시점 포착:</strong> 역사적으로 물가(IPCA)가 꺾이고 Selic 인하 사이클이 시작되기 직전, 5년물 국채금리가 피크(고점)를 형성하는 구간이 채권 매매 차익(자본이득)을 최대화할 수 있는 진입 최적기입니다.</li>
                        </ul>
                    </div>
                </div>
            </section>

            <section className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <div className="bg-black/20 rounded-2xl border border-white/5 p-4">
                    <SectionTitle icon={<ArrowDownRight className="w-5 h-5 text-amber-400" />} title="원/헤알 환율" sub="BRL/KRW 추이 + 290원 타겟 (10년)" />
                    <FxChart history={history} target={s.targets.fx_target} />
                </div>
                <div className="bg-black/20 rounded-2xl border border-white/5 p-4">
                    <SectionTitle icon={<ShieldCheck className="w-5 h-5 text-emerald-400" />} title="The Carry Cushion" sub="만기 환율별 원화 누적수익 (5년 보유)" />
                    <CarryCushionChart points={s.carry_cushion} />
                </div>
            </section>

            {/* ── AI 전략 리포트 ───────────────────────────────────── */}
            <AiReportSection insight={insight} insightAt={insightAt} genLoading={genLoading} onGenerate={generateReport} />

            {/* ── 수익 시뮬레이터 ──────────────────────────────────── */}
            <CarrySimulator summary={s} />

            {/* ── 8월 Copom 시나리오 ───────────────────────────────── */}
            <section>
                <SectionTitle icon={<Layers className="w-5 h-5 text-indigo-400" />} title="August Copom Playbook" sub="8월 금리 결정 시나리오별 대응" />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {s.aug_scenarios.map((sc) => <ScenarioCard key={sc.id} sc={sc} />)}
                </div>
            </section>

            {/* ── 3단계 분할 매수 로드맵 ───────────────────────────── */}
            <section>
                <SectionTitle icon={<Target className="w-5 h-5 text-emerald-400" />} title="3-Tranche Execution Strategy" sub="3단계 분할 매수 로드맵" />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {s.tranches.map((t) => <TrancheCard key={t.id} t={t} />)}
                </div>
                <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                    <Info className="w-3 h-3" /> 비중은 유동 금융자산의 최대 5~10% 이내(위성 포지션), 만기 3~5년 스위트스팟 권장.
                </p>
            </section>

            {/* ── 매크로 캘린더 (시계열 타임라인) ──────────────────── */}
            <section>
                <SectionTitle icon={<CalendarClock className="w-5 h-5 text-cyan-400" />} title="Macro Catalyst Timeline" sub="Q3-Q4 핵심 관전 캘린더 · 이벤트 시점의 지표 발표 일정" />
                <MacroTimeline timeline={s.timeline} />
            </section>

            {/* ── 관련 뉴스 피드 ───────────────────────────────────── */}
            <section>
                <SectionTitle icon={<Newspaper className="w-5 h-5 text-amber-400" />} title="관련 뉴스 & 정보" sub="브라질 국채·헤알·금리 관련 최신 뉴스 (자동 수집)" />
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

function getThresholdText(key: string): string {
    switch (key) {
        case 'selic': return '🟢 ≥14.0% | 🔴 <12.0%';
        case 'y5': return '🟢 14.2%~15.0% | 🔴 >15.0%';
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
                    <span className="text-[12px] lg:text-[13px] text-gray-400 font-semibold">{ind.label}</span>
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
            {ruleText && (
                <div className="text-[10px] lg:text-[11px] text-gray-500 mt-2.5 pt-2 border-t border-white/5 flex items-center justify-between">
                    <span>판정 기준</span>
                    <span className="font-semibold text-gray-400">{ruleText}</span>
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
                            <p className="text-gray-400">🟢 14.2% ~ 15.0% (진입 최적 구간)</p>
                            <p className="text-gray-400">🟡 14.2% 미만 (금리 매력 부족)</p>
                            <p className="text-gray-400">🔴 15.0% 초과 (재정/대선 리스크 반영)</p>
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

// Activation Zone: 2축 산점도 (환율 X 역방향, 금리 Y). 현재 위치 점 표시.
function ActivationZoneChart({ summary }: { summary: Summary }) {
    const t = summary.targets;
    const y5 = summary.indicators.find(i => i.key === 'y5')?.value ?? null;
    const fx = summary.indicators.find(i => i.key === 'brl_krw')?.value ?? null;
    const point = (y5 !== null && fx !== null) ? [{ x: fx, y: y5 }] : [];

    // Dynamic zoomed domains centered around the midpoint between current and target
    const xDomain = useMemo(() => {
        if (fx === null) return [302, 272];
        const target = t.fx_target; // 290
        const mid = (fx + target) / 2;
        return [Math.ceil(mid + 7), Math.floor(mid - 7)];
    }, [fx, t.fx_target]);

    const yDomain = useMemo(() => {
        if (y5 === null) return [13.5, 15.6];
        const target = t.rate_floor; // 14.2
        const mid = (y5 + target) / 2;
        return [parseFloat((mid - 0.4).toFixed(2)), parseFloat((mid + 0.4).toFixed(2))];
    }, [y5, t.rate_floor]);

    return (
        <div className="space-y-4">
            <ResponsiveContainer width="100%" height={280}>
                <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                    {/* 존 배경: 환율 X축은 reversed(300→270) */}
                    <ReferenceArea x1={t.fx_target} x2={272} y1={t.rate_floor} y2={t.rate_tranche2} fill="#10b981" fillOpacity={0.15} />
                    <ReferenceArea x1={t.fx_target} x2={272} y1={t.rate_tranche2} y2={t.rate_risk} fill="#10b981" fillOpacity={0.28} />
                    <ReferenceArea x1={302} x2={t.fx_target} y1={13.5} y2={t.rate_floor} fill="#64748b" fillOpacity={0.15} />
                    <ReferenceArea x1={302} x2={272} y1={t.rate_risk} y2={15.6} fill="#f59e0b" fillOpacity={0.15} />
                    
                    {/* 목표 조건 기준선 (초록색 점선) */}
                    <ReferenceLine x={t.fx_target} stroke="#10b981" strokeDasharray="4 4" label={{ value: '목표 290원', fill: '#10b981', fontSize: 10, position: 'insideTopLeft' }} />
                    <ReferenceLine y={t.rate_floor} stroke="#10b981" strokeDasharray="4 4" label={{ value: '목표 14.2%', fill: '#10b981', fontSize: 10, position: 'insideBottomRight' }} />
                    
                    {/* 현재 좌표 가이드선 (흰색 실선/점선) */}
                    {fx !== null && <ReferenceLine x={fx} stroke="#ffffff40" strokeDasharray="3 3" label={{ value: `현재 ${fx.toFixed(1)}원`, fill: '#ffffff80', fontSize: 10, position: 'insideBottomLeft' }} />}
                    {y5 !== null && <ReferenceLine y={y5} stroke="#ffffff40" strokeDasharray="3 3" label={{ value: `현재 ${y5.toFixed(2)}%`, fill: '#ffffff80', fontSize: 10, position: 'insideTopRight' }} />}

                    <XAxis type="number" dataKey="x" domain={xDomain} reversed={false} tick={{ fill: '#9ca3af', fontSize: 12 }}
                        label={{ value: '원/헤알 환율 (원)', position: 'insideBottom', offset: -10, fill: '#6b7280', fontSize: 12 }} />
                    <YAxis type="number" dataKey="y" domain={yDomain} tick={{ fill: '#9ca3af', fontSize: 12 }}
                        label={{ value: '5년물 금리(%)', angle: -90, position: 'insideLeft', fill: '#6b7280', fontSize: 12 }} />
                    <ZAxis range={[400, 400]} />
                    <RechartsTooltip
                        cursor={{ strokeDasharray: '3 3' }}
                        contentStyle={{ background: '#1a1a23', border: '1px solid #ffffff20', borderRadius: 8, fontSize: 12, color: '#fff' }}
                        itemStyle={{ color: '#fff' }}
                        labelStyle={{ color: '#9ca3af' }}
                        formatter={(v: any, n: any) => [fmt(v, 2), n === 'x' ? '환율' : '금리']} />
                    <Scatter data={point} fill="#fff" shape="circle" />
                </ScatterChart>
            </ResponsiveContainer>
            
            {/* 존 범례 설명 */}
            <div className="grid grid-cols-2 gap-2 text-xs border-t border-white/5 pt-3">
                <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-emerald-500/15 border border-emerald-500/40 shrink-0" />
                    <span className="text-gray-400">🟢 1차 진입 (14.2%~14.7% 금리 & 290원 이하 환율)</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-emerald-600/40 border border-emerald-500/60 shrink-0" />
                    <span className="text-gray-400">🟢 적극 매수 (14.7%~15.0% 금리 & 290원 이하 환율)</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-rose-500/20 border border-rose-500/40 shrink-0" />
                    <span className="text-gray-400">🔴 리스크 재평가 (15.0% 초과 금리 - 진입 보류)</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-slate-500/20 border border-slate-500/40 shrink-0" />
                    <span className="text-gray-400">⚪ 관망/대기 (290원 초과 환율 또는 14.2% 미만 금리)</span>
                </div>
            </div>
        </div>
    );
}

function RateCycleChart({ history }: { history: Record<string, { date: string; value: number }[]> }) {
    const [range, setRange] = useState<'10Y' | '1Y' | '6M' | '3M'>('10Y');

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
                    <RechartsTooltip contentStyle={{ background: '#1a1a23', border: '1px solid #ffffff20', borderRadius: 8, fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line type="monotone" dataKey="selic_target" name="기준금리(Selic)" stroke="#818cf8" dot={false} strokeWidth={2} connectNulls={true} />
                    <Line type="monotone" dataKey="y5_fred_adjusted" name="5년물 국채금리 (역사적/FRED)" stroke="#f97316" dot={false} strokeWidth={2} connectNulls={true} />
                    <Line type="monotone" dataKey="y5" name="5년물 국채금리 (실제/최근)" stroke="#34d399" dot={false} strokeWidth={2} connectNulls={true} />
                    <Line type="monotone" dataKey="ipca_12m" name="IPCA(12M)" stroke="#fbbf24" dot={false} strokeWidth={1.5} connectNulls={true} />
                </LineChart>
            </ResponsiveContainer>

            {/* 산정 기준 가이드 설명 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3.5 bg-white/5 border border-white/5 rounded-2xl text-[11px] text-gray-400 leading-relaxed">
                <div>
                    <strong className="text-gray-300">① 역사적 국채금리 (FRED 기준)</strong>
                    <p className="mt-0.5">FRED의 브라질 정부 증권 금리(Series ID: <span className="text-orange-400 font-semibold">INTGSTBRM193N</span>) 월간 데이터를 연동하여, 과거 10년간의 장기 금리 사이클 추이를 오차 없이 정밀하게 추적합니다.</p>
                </div>
                <div>
                    <strong className="text-emerald-300">② 실제 국채금리 (Investing.com 실시간)</strong>
                    <p className="mt-0.5">Investing.com의 일별 시장 가격을 스크레이핑하여 최근 22일간의 실제 시장 금리 변동을 반영합니다. 두 지표의 경계점은 선형 보간으로 매끄럽게 연결하여 금리가 튀는 왜곡을 방지했습니다.</p>
                </div>
            </div>
        </div>
    );
}

function FxChart({ history, target }: { history: Record<string, { date: string; value: number }[]>; target: number }) {
    const data = useMemo(() => mergeSeries(history, ['brl_krw']), [history]);
    return (
        <ResponsiveContainer width="100%" height={260}>
            <LineChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis dataKey="date" tick={{ fill: '#9ca3af', fontSize: 12 }} minTickGap={40} />
                <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} domain={['auto', 'auto']} />
                <RechartsTooltip contentStyle={{ background: '#1a1a23', border: '1px solid #ffffff20', borderRadius: 8, fontSize: 12 }} />
                <ReferenceLine y={target} stroke="#34d399" strokeDasharray="5 5" label={{ value: `타겟 ${target}원`, fill: '#34d399', fontSize: 12, position: 'insideTopRight' }} />
                <Line type="monotone" dataKey="brl_krw" name="원/헤알" stroke="#fbbf24" dot={false} strokeWidth={2} />
            </LineChart>
        </ResponsiveContainer>
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
    const border = sc.color === 'green' ? 'border-emerald-500/40' : sc.color === 'red' ? 'border-rose-500/40' : 'border-amber-500/40';
    const badge = sc.color === 'green' ? 'bg-emerald-500' : sc.color === 'red' ? 'bg-rose-600' : 'bg-amber-500';
    const actionBg = sc.color === 'green' ? 'bg-emerald-500/15 text-emerald-200' : sc.color === 'red' ? 'bg-rose-500/15 text-rose-200' : 'bg-amber-500/15 text-amber-200';
    return (
        <div className={`bg-black/20 rounded-2xl border ${border} p-4 flex flex-col gap-2`}>
            <div className="flex items-center gap-2">
                <span className={`w-6 h-6 rounded-full ${badge} text-white text-xs font-black flex items-center justify-center`}>{sc.id}</span>
                <span className="font-bold text-white text-sm">{sc.title}</span>
            </div>
            <p className="text-xs text-gray-400 leading-relaxed"><span className="text-gray-500">시장 논리 · </span>{sc.logic}</p>
            <div className={`text-xs font-semibold rounded-lg px-3 py-2 mt-auto ${actionBg}`}>▶ {sc.action}</div>
        </div>
    );
}

function TrancheCard({ t }: { t: { id: number; weight: string; timing: string; trigger: string; rationale: string } }) {
    return (
        <div className="bg-gradient-to-br from-emerald-900/20 to-black/20 rounded-2xl border border-emerald-500/20 p-4">
            <div className="flex items-center justify-between mb-2">
                <span className="font-black text-white">Tranche {t.id}</span>
                <span className="text-xs font-bold text-emerald-300 bg-emerald-500/15 px-2 py-0.5 rounded-full">{t.weight}</span>
            </div>
            <p className="text-xs text-gray-500 mb-1">{t.timing}</p>
            <p className="text-xs text-gray-300"><span className="text-emerald-400 font-bold">Trigger · </span>{t.trigger}</p>
            <p className="text-xs text-gray-400 mt-1"><span className="text-gray-500">Rationale · </span>{t.rationale}</p>
        </div>
    );
}

// 시계열 세로 타임라인: 좌측 레일 + 마커. 과거는 흐리게, 임박(D≤7)은 강조.
function MacroTimeline({ timeline }: { timeline: Catalyst[] }) {
    const impactColor = (impact: string) => impact === 'fx' ? 'amber' : impact === 'rate' ? 'cyan' : 'rose';
    return (
        <div className="relative pl-6">
            <div className="absolute left-2 top-1 bottom-1 w-px bg-gradient-to-b from-white/20 via-white/10 to-transparent" />
            <div className="flex flex-col gap-3">
                {timeline.map((c) => {
                    const past = c.d_day < 0;
                    const urgent = c.d_day >= 0 && c.d_day <= 7;
                    const col = impactColor(c.impact);
                    const dot = past ? 'bg-gray-600' : urgent ? 'bg-amber-400 ring-4 ring-amber-400/20 animate-pulse'
                        : col === 'amber' ? 'bg-amber-400' : col === 'cyan' ? 'bg-cyan-400' : 'bg-rose-400';
                    return (
                        <div key={c.key} className="relative">
                            <span className={`absolute -left-[18px] top-1.5 w-3 h-3 rounded-full ${dot}`} />
                            <div className={`rounded-xl border px-4 py-3.5 ${past ? 'border-white/5 bg-black/10 opacity-60'
                                : urgent ? 'border-amber-500/40 bg-amber-500/10' : 'border-white/10 bg-black/20'}`}>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {/* 1) 왼쪽: Timeline 상의 이벤트 명 및 세부정보 */}
                                    <div className="space-y-1.5 pr-2 md:border-r md:border-white/5 flex flex-col justify-between">
                                        <div>
                                            <div className="flex flex-wrap items-center gap-1.5">
                                                <span className={`text-base font-black ${past ? 'text-gray-500' : urgent ? 'text-amber-300' : 'text-gray-200'}`}>
                                                    {past ? '완료' : `D-${c.d_day}`}
                                                </span>
                                                <span className={`text-sm font-bold ${past ? 'text-gray-400' : 'text-white'}`}>{c.title}</span>
                                                <span className="text-xs text-gray-500">{c.date}</span>
                                            </div>
                                            <div className="mt-1 flex items-center gap-2">
                                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${col === 'amber' ? 'bg-amber-500/15 text-amber-300'
                                                    : col === 'cyan' ? 'bg-cyan-500/15 text-cyan-300' : 'bg-rose-500/15 text-rose-300'}`}>
                                                    {c.impact === 'fx' ? '환율' : c.impact === 'rate' ? '금리' : '금리·환율'}
                                                </span>
                                            </div>
                                        </div>
                                        <p className="text-xs text-gray-400 mt-1">{c.note}</p>
                                    </div>
                                    
                                    {/* 2) 중간: 실제 해당 시점에서의 발표 내용 (현재는 빈칸 처리) */}
                                    <div className="space-y-1 md:border-r md:border-white/5 md:px-2 flex flex-col justify-start">
                                        <span className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">실제 발표 내용</span>
                                        <p className="text-xs text-gray-600 italic mt-1">—</p>
                                    </div>

                                    {/* 3) 오른쪽: 발표 내용 기반의 브라질 국채 전망 및 액션플랜 (현재는 빈칸 처리) */}
                                    <div className="space-y-1 md:pl-2 flex flex-col justify-start">
                                        <span className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">국채 전망 및 액션플랜</span>
                                        <p className="text-xs text-gray-600 italic mt-1">—</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {news.map((n, i) => (
                <a key={i} href={n.link} target="_blank" rel="noopener noreferrer"
                    className="group flex items-start gap-3 bg-black/20 hover:bg-black/40 rounded-xl border border-white/5 hover:border-amber-500/30 p-3 transition">
                    <Newspaper className="w-4 h-4 text-amber-400/70 shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                        <p className="text-sm text-gray-200 group-hover:text-white leading-snug line-clamp-2">{n.title}</p>
                        <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                            <span>{n.source}</span>
                            {n.published && <><span>·</span><span>{n.published}</span></>}
                        </div>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-gray-600 group-hover:text-amber-400 shrink-0 mt-0.5" />
                </a>
            ))}
        </div>
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
            
            // 기존 설정을 보존하며 alert_brazil만 갱신 (토큰은 마스킹된 채로 전송해도 백엔드가 원본 유지)
            const cur = await (await fetch(url)).json();
            const r = await fetch(`${API_BASE}/api/v1/notification/settings`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    telegram_token: cur.telegram_token || '', telegram_chat_id: cur.telegram_chat_id || '',
                    alert_exit_signal: cur.alert_exit_signal ?? 1, alert_rebalance: cur.alert_rebalance ?? 1,
                    alert_daily_summary: cur.alert_daily_summary ?? 0, alert_brazil: next ? 1 : 0,
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
            let cur = { alert_exit_signal: 1, alert_rebalance: 1, alert_daily_summary: 0 };
            try {
                const localChatId = localStorage.getItem('telegram_chat_id') || '';
                const url = localChatId
                    ? `${API_BASE}/api/v1/notification/settings?chat_id=${encodeURIComponent(localChatId)}`
                    : `${API_BASE}/api/v1/notification/settings`;
                cur = await (await fetch(url)).json();
            } catch { /* 무시 */ }

            const r = await fetch(`${API_BASE}/api/v1/notification/settings`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    telegram_token: inputToken,
                    telegram_chat_id: inputChatId.trim(),
                    alert_exit_signal: cur.alert_exit_signal ?? 1,
                    alert_rebalance: cur.alert_rebalance ?? 1,
                    alert_daily_summary: cur.alert_daily_summary ?? 0,
                    alert_brazil: alertBrazil ? 1 : 0
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
            <SectionTitle icon={<Bell className="w-5 h-5 text-emerald-400" />} title="텔레그램 실시간 알림" sub="주요 이벤트 D-day · 신호 전환 · 관련 신규 뉴스 발생 시 자동 발송" />
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
                            const r = await fetch(`${API_BASE}/api/v1/notification/test`, {
                                method: 'POST', headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ telegram_token: cur.telegram_token || '', telegram_chat_id: cur.telegram_chat_id || '' }),
                            });
                            const d = await r.json();
                            flash(r.ok, r.ok ? '테스트 알림을 발송했습니다.' : (d.detail || '발송 실패'));
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
