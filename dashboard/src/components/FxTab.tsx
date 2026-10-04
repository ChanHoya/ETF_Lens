'use client';
// 시장동향 > 환율 하위 탭 — 원/달러·달러지수·금리차·실질실효환율 스냅샷, 20년 추이 차트, 원/달러 국면 타임라인

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ResponsiveContainer, ComposedChart, Line, XAxis, YAxis, CartesianGrid,
    Tooltip as RechartsTooltip, Legend, ReferenceArea, ReferenceLine,
} from 'recharts';
import { DollarSign, Globe2, Landmark, RefreshCw, Scale, Shield, TrendingDown, TrendingUp, History, Info } from 'lucide-react';
import { API_BASE } from '@/lib/apiConfig';
import ChartLoadingPlaceholder from './ChartLoadingPlaceholder';

type Row = { date: string; krw: number | null; dxy: number | null; us10: number | null; kr10: number | null; spread10: number | null };
type Regime = {
    start: string; end: string; title: string; drivers: string[]; source: string | null;
    kind: 'up' | 'down' | 'range'; from: number; to: number; chg_pct: number; low: number; high: number;
};
type Snapshot = {
    krw?: { value: number; date: string; chg_1w: number | null; chg_1m: number | null; chg_1y: number | null; pct10y: number; min10y: number; max10y: number };
    dxy?: { value: number; date: string; chg_1m: number | null; chg_1y: number | null; pct10y: number };
    jpy100?: { label: string; value: number; date: string; chg_1m: number | null; chg_1y: number | null };
    cny?: { label: string; value: number; date: string; chg_1m: number | null; chg_1y: number | null };
    spread10?: { value: number; us10: number; kr10: number; kr10_date: string; year_ago: number | null };
    hedge?: { value: number; us: number; kr: number; kr_date: string };
    reer?: { value: number; date: string; avg20y: number; gap_pct: number };
    verdict: { level: 'weak_krw' | 'strong_krw' | 'neutral'; label: string };
};
type Overview = { snapshot: Snapshot; weekly: Row[]; regimes: Regime[]; updated_at: string; stale?: boolean };

const RANGES = ['5Y', '10Y', '20Y'] as const;
type Range = typeof RANGES[number];
const KIND_STYLE: Record<Regime['kind'], { label: string; fill: string; badge: string }> = {
    up: { label: '원화 약세 ↑', fill: '#ef4444', badge: 'bg-red-500/15 text-red-300 border-red-400/30' },
    down: { label: '원화 강세 ↓', fill: '#10b981', badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30' },
    range: { label: '박스권', fill: '#94a3b8', badge: 'bg-white/5 text-gray-300 border-white/15' },
};
const TOOLTIP_STYLE = { background: '#1a1a23', border: '1px solid #ffffff20', borderRadius: 8, fontSize: 12 };

const ts = (d: string) => Date.parse(d);
const fmtDate = (t: number) => new Date(t).toISOString().slice(0, 10);
const fmtNum = (v: number | null | undefined, digits = 1) => (v == null ? '-' : v.toLocaleString('ko-KR', { minimumFractionDigits: digits, maximumFractionDigits: digits }));

// 국내 관례: 오르면 빨강, 내리면 파랑
function Chg({ v, label }: { v: number | null | undefined; label: string }) {
    if (v == null) return <span className="text-gray-500">{label} -</span>;
    const cls = v > 0 ? 'text-red-400' : v < 0 ? 'text-blue-400' : 'text-gray-400';
    return <span className={cls}>{label} {v > 0 ? '+' : ''}{v.toFixed(2)}%</span>;
}

function PctBar({ pct, left, right }: { pct: number; left: string; right: string }) {
    return (
        <div className="mt-2">
            <div className="flex justify-between text-[10px] text-gray-500 mb-0.5">
                <span>{left}</span><span className="font-bold text-gray-300">10년 중 {pct}%</span><span>{right}</span>
            </div>
            <div className="relative h-1.5 rounded-full bg-gradient-to-r from-blue-500/40 via-gray-500/30 to-red-500/50">
                <div className="absolute -top-0.5 w-2.5 h-2.5 rounded-full bg-white border-2 border-indigo-400" style={{ left: `calc(${pct}% - 5px)` }} />
            </div>
        </div>
    );
}

function Card({ icon, title, children, foot }: { icon: React.ReactNode; title: string; children: React.ReactNode; foot?: string }) {
    return (
        <div className="bg-black/20 rounded-2xl border border-white/5 p-4 flex flex-col">
            <div className="flex items-center gap-1.5 text-xs font-bold text-gray-400 mb-2">{icon}{title}</div>
            <div className="flex-1">{children}</div>
            {foot && <p className="text-[10px] text-gray-500 mt-2 leading-snug">{foot}</p>}
        </div>
    );
}

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

function SnapshotGrid({ s }: { s: Snapshot }) {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6 gap-3">
            <Card icon={<DollarSign className="w-3.5 h-3.5 text-indigo-400" />} title="원/달러" foot={s.krw ? `${s.krw.date} 기준` : undefined}>
                {s.krw ? <>
                    <div className="text-2xl font-extrabold text-white">{fmtNum(s.krw.value)}<span className="text-sm text-gray-400 ml-1">원</span></div>
                    <div className="flex flex-wrap gap-x-2 text-xs font-bold mt-1">
                        <Chg v={s.krw.chg_1w} label="1주" /><Chg v={s.krw.chg_1m} label="1개월" /><Chg v={s.krw.chg_1y} label="1년" />
                    </div>
                    <PctBar pct={s.krw.pct10y} left={fmtNum(s.krw.min10y, 0)} right={fmtNum(s.krw.max10y, 0)} />
                </> : <p className="text-sm text-gray-500">데이터 없음</p>}
            </Card>
            <Card icon={<Globe2 className="w-3.5 h-3.5 text-sky-400" />} title="달러지수 (DXY)" foot="주요 6개 통화 대비 달러 가치">
                {s.dxy ? <>
                    <div className="text-2xl font-extrabold text-white">{fmtNum(s.dxy.value, 2)}</div>
                    <div className="flex flex-wrap gap-x-2 text-xs font-bold mt-1"><Chg v={s.dxy.chg_1m} label="1개월" /><Chg v={s.dxy.chg_1y} label="1년" /></div>
                    <PctBar pct={s.dxy.pct10y} left="약달러" right="강달러" />
                </> : <p className="text-sm text-gray-500">데이터 없음</p>}
            </Card>
            <Card icon={<Scale className="w-3.5 h-3.5 text-amber-400" />} title="아시아 통화" foot={s.jpy100 ? `${s.jpy100.date} 기준 · 달러 환율로 교차 계산` : undefined}>
                {[s.jpy100, s.cny].map(c => c && (
                    <div key={c.label} className="flex items-baseline justify-between gap-2 py-1 border-b border-white/5 last:border-0">
                        <span className="text-xs text-gray-400">{c.label}</span>
                        <span className="text-lg font-extrabold text-white">{fmtNum(c.value, 2)}</span>
                        <span className="text-[11px] font-bold"><Chg v={c.chg_1y} label="1년" /></span>
                    </div>
                ))}
            </Card>
            <Card icon={<Landmark className="w-3.5 h-3.5 text-emerald-400" />} title="미-한 10년물 금리차"
                foot={s.spread10 ? `미국 ${s.spread10.us10}% − 한국 ${s.spread10.kr10}% (한국 ${s.spread10.kr10_date} 월간)` : undefined}>
                {s.spread10 ? <>
                    <div className="text-2xl font-extrabold text-white">{s.spread10.value > 0 ? '+' : ''}{s.spread10.value.toFixed(2)}<span className="text-sm text-gray-400 ml-1">%p</span></div>
                    <p className="text-xs text-gray-400 mt-1">1년 전 {s.spread10.year_ago == null ? '-' : `${s.spread10.year_ago > 0 ? '+' : ''}${s.spread10.year_ago.toFixed(2)}%p`}</p>
                    <p className="text-xs text-gray-400 mt-1">{s.spread10.value > 0 ? '미국 금리가 높아 원화에 약세 압력' : '한국 금리가 높아 원화에 강세 압력'}</p>
                </> : <p className="text-sm text-gray-500">데이터 없음</p>}
            </Card>
            <Card icon={<Shield className="w-3.5 h-3.5 text-purple-400" />} title="환헤지 비용 (근사)"
                foot={s.hedge ? `미 정책금리 ${s.hedge.us}% − 한 3개월 금리 ${s.hedge.kr}% (${s.hedge.kr_date})` : undefined}>
                {s.hedge ? <>
                    <div className="text-2xl font-extrabold text-white">연 {s.hedge.value.toFixed(2)}<span className="text-sm text-gray-400 ml-1">%p</span></div>
                    <p className="text-xs text-gray-400 mt-1">
                        {s.hedge.value > 0
                            ? '미국 자산을 환헤지(H)하면 이만큼 수익이 깎인다'
                            : '미국 자산을 환헤지(H)하면 이만큼 수익이 더해진다'}
                    </p>
                </> : <p className="text-sm text-gray-500">데이터 없음</p>}
            </Card>
            <Card icon={<TrendingDown className="w-3.5 h-3.5 text-rose-400" />} title="원화 실질실효환율"
                foot={s.reer ? `BIS · ${s.reer.date} · 물가를 반영한 원화의 실제 구매력 (높을수록 원화 강세)` : undefined}>
                {s.reer ? <>
                    <div className="text-2xl font-extrabold text-white">{fmtNum(s.reer.value)}</div>
                    <p className="text-xs text-gray-400 mt-1">20년 평균 {fmtNum(s.reer.avg20y)}</p>
                    <p className={`text-xs font-bold mt-1 ${s.reer.gap_pct < 0 ? 'text-blue-400' : 'text-red-400'}`}>
                        평균 대비 {s.reer.gap_pct > 0 ? '+' : ''}{s.reer.gap_pct.toFixed(1)}% ({s.reer.gap_pct < 0 ? '원화 저평가' : '원화 고평가'})
                    </p>
                </> : <p className="text-sm text-gray-500">데이터 없음</p>}
            </Card>
        </div>
    );
}

function RangeButtons({ range, setRange }: { range: Range; setRange: (r: Range) => void }) {
    return (
        <div className="flex gap-1.5">
            {RANGES.map(r => (
                <button key={r} onClick={() => setRange(r)}
                    className={`text-xs font-bold px-2.5 py-1 rounded-lg border transition ${range === r
                        ? 'bg-indigo-500/20 border-indigo-400/50 text-indigo-300'
                        : 'bg-white/5 border-white/10 text-gray-400 hover:text-gray-200 hover:bg-white/10'}`}>
                    {r}
                </button>
            ))}
        </div>
    );
}

const yearTick = (t: number) => String(new Date(t).getFullYear());
const axisTick = { fill: '#9ca3af', fontSize: 11 };

function KrwDxyChart({ data, regimes, selected }: { data: (Row & { t: number })[]; regimes: Regime[]; selected: number | null }) {
    return (
        <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                {regimes.map((g, i) => (
                    <ReferenceArea key={g.start} yAxisId="krw" x1={ts(g.start)} x2={ts(g.end)} ifOverflow="hidden"
                        fill={KIND_STYLE[g.kind].fill} fillOpacity={selected === i ? 0.25 : 0.08} />
                ))}
                <XAxis dataKey="t" type="number" scale="time" domain={['dataMin', 'dataMax']} tickFormatter={yearTick} tick={axisTick} minTickGap={30} />
                <YAxis yAxisId="dxy" tick={axisTick} domain={['auto', 'auto']} width={44} />
                <YAxis yAxisId="krw" orientation="right" tick={axisTick} domain={['auto', 'auto']} width={48} />
                <RechartsTooltip contentStyle={TOOLTIP_STYLE} labelFormatter={(t) => fmtDate(Number(t))}
                    formatter={(v, name) => [typeof v === 'number' ? v.toLocaleString('ko-KR') : v, name]} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line yAxisId="dxy" dataKey="dxy" name="달러지수 DXY (좌)" stroke="#9ca3af" dot={false} strokeWidth={1.5} connectNulls isAnimationActive={false} />
                <Line yAxisId="krw" dataKey="krw" name="원/달러 (우)" stroke="#6366f1" dot={false} strokeWidth={2} connectNulls isAnimationActive={false} />
            </ComposedChart>
        </ResponsiveContainer>
    );
}

function SpreadChart({ data }: { data: (Row & { t: number })[] }) {
    return (
        <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis dataKey="t" type="number" scale="time" domain={['dataMin', 'dataMax']} tickFormatter={yearTick} tick={axisTick} minTickGap={30} />
                <YAxis yAxisId="sp" tick={axisTick} domain={['auto', 'auto']} width={48} tickFormatter={(v: number) => `${v}%p`} />
                <YAxis yAxisId="krw" orientation="right" tick={axisTick} domain={['auto', 'auto']} width={48} />
                <ReferenceLine yAxisId="sp" y={0} stroke="#f59e0b" strokeDasharray="4 4" />
                <RechartsTooltip contentStyle={TOOLTIP_STYLE} labelFormatter={(t) => fmtDate(Number(t))}
                    formatter={(v, name) => [typeof v === 'number' ? v.toLocaleString('ko-KR') : v, name]} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line yAxisId="sp" dataKey="spread10" name="미-한 10년물 금리차 (좌, %p)" stroke="#10b981" dot={false} strokeWidth={2} connectNulls isAnimationActive={false} />
                <Line yAxisId="krw" dataKey="krw" name="원/달러 (우)" stroke="#9ca3af" dot={false} strokeWidth={1.5} connectNulls isAnimationActive={false} />
            </ComposedChart>
        </ResponsiveContainer>
    );
}

function RegimeTimeline({ regimes, selected, onSelect }: { regimes: Regime[]; selected: number | null; onSelect: (i: number | null) => void }) {
    const order = regimes.map((g, i) => ({ g, i })).reverse();  // 최신 국면부터
    return (
        <div className="space-y-2">
            {order.map(({ g, i }) => {
                const k = KIND_STYLE[g.kind];
                const active = selected === i;
                return (
                    <button key={g.start} type="button" onClick={() => onSelect(active ? null : i)}
                        className={`w-full text-left rounded-xl border p-3 transition ${active ? 'border-indigo-400/60 bg-indigo-500/10' : 'border-white/5 bg-white/[0.02] hover:bg-white/5'}`}>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            <span className="text-xs font-mono text-gray-400 w-[150px] shrink-0">{g.start.slice(0, 7).replace('-', '.')} → {g.end.slice(0, 7).replace('-', '.')}</span>
                            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${k.badge}`}>{k.label}</span>
                            <span className="text-sm font-extrabold text-white">{g.title}</span>
                            <span className="text-xs font-bold text-gray-300 ml-auto">
                                {fmtNum(g.from, 0)} → {fmtNum(g.to, 0)}원
                                <span className={g.chg_pct > 0 ? 'text-red-400' : 'text-blue-400'}> ({g.chg_pct > 0 ? '+' : ''}{g.chg_pct}%)</span>
                            </span>
                        </div>
                        <ul className="mt-1.5 flex flex-wrap gap-1.5">
                            {g.drivers.map(d => <li key={d} className="text-[11px] text-gray-300 bg-white/5 border border-white/5 rounded-md px-2 py-0.5">{d}</li>)}
                        </ul>
                        {g.source && <p className="text-[10px] text-gray-500 mt-1">출처: {g.source}</p>}
                    </button>
                );
            })}
        </div>
    );
}

export default function FxTab() {
    const [data, setData] = useState<Overview | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [range, setRange] = useState<Range>('20Y');
    const [selected, setSelected] = useState<number | null>(null);

    const load = useCallback(async (refresh = false) => {
        setLoading(true);
        setError(null);
        try {
            const r = await fetch(`${API_BASE}/api/v1/fx/overview${refresh ? '?refresh=true' : ''}`, { cache: 'no-store' });
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            setData(await r.json());
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const rows = useMemo(() => {
        if (!data) return [];
        const all = data.weekly.map(r => ({ ...r, t: ts(r.date) }));
        if (range === '20Y' || all.length === 0) return all;
        const cut = new Date(all[all.length - 1].t);
        cut.setFullYear(cut.getFullYear() - (range === '10Y' ? 10 : 5));
        return all.filter(r => r.t >= cut.getTime());
    }, [data, range]);

    const s = data?.snapshot;
    const verdictCls = s?.verdict.level === 'weak_krw' ? 'bg-red-500/15 text-red-300 border-red-400/30'
        : s?.verdict.level === 'strong_krw' ? 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30'
            : 'bg-white/5 text-gray-300 border-white/15';

    return (
        <div className="w-full max-w-[95vw] xl:max-w-[1400px] mx-auto space-y-4 pb-10">
            <section className="bg-black/20 rounded-2xl border border-white/5 p-4 md:p-5">
                <div className="flex flex-wrap items-center gap-3 mb-4">
                    <DollarSign className="w-6 h-6 text-indigo-400" />
                    <div>
                        <h2 className="text-xl font-extrabold text-white leading-none">환율 대시보드</h2>
                        <p className="text-xs text-gray-500 mt-1">원/달러 · 달러지수 · 금리차 · 실질실효환율 — 주식·채권 투자의 환율 판단 참고</p>
                    </div>
                    {s && <span className={`text-xs font-bold px-3 py-1 rounded-full border ${verdictCls}`}>{s.verdict.label}</span>}
                    <div className="ml-auto flex items-center gap-2 text-[11px] text-gray-500">
                        {data && <span>{data.stale ? '⚠ 최신 수집 실패 · 이전 값 · ' : ''}{new Date(data.updated_at).toLocaleString('ko-KR')} 갱신</span>}
                        <button onClick={() => load(true)} disabled={loading}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 disabled:opacity-50">
                            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />업데이트
                        </button>
                    </div>
                </div>
                {error && !data && (
                    <p className="text-sm text-red-400">환율 데이터를 불러오지 못했습니다 ({error}). 서버가 깨어나는 중이면 잠시 후 업데이트를 눌러 주세요.</p>
                )}
                {!data && !error && <ChartLoadingPlaceholder height={140} message="환율 데이터 수집 중" subMessage="FRED·Yahoo 20년 시계열 — 첫 로드는 수십 초 걸릴 수 있습니다" />}
                {s && <SnapshotGrid s={s} />}
            </section>

            {data && (
                <>
                    <section className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                        <div className="bg-black/20 rounded-2xl border border-white/5 p-4">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                                <SectionTitle icon={<TrendingUp className="w-5 h-5 text-indigo-400" />} title="원/달러 & 달러지수"
                                    sub="음영 = 원/달러 국면 (빨강 원화 약세 · 초록 원화 강세) · 아래 타임라인을 누르면 강조" />
                                <RangeButtons range={range} setRange={setRange} />
                            </div>
                            <KrwDxyChart data={rows} regimes={data.regimes} selected={selected} />
                        </div>
                        <div className="bg-black/20 rounded-2xl border border-white/5 p-4">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                                <SectionTitle icon={<Landmark className="w-5 h-5 text-emerald-400" />} title="미-한 금리차 & 원/달러"
                                    sub="미국 10년물 − 한국 10년물 · 점선 0 아래 = 한국 금리가 더 높음" />
                                <RangeButtons range={range} setRange={setRange} />
                            </div>
                            <SpreadChart data={rows} />
                        </div>
                    </section>

                    <section className="bg-black/20 rounded-2xl border border-white/5 p-4">
                        <SectionTitle icon={<History className="w-5 h-5 text-amber-400" />} title="원/달러 국면 타임라인"
                            sub="2007년 이후 주요 상승·하락 구간과 그 시기의 글로벌 경제·사회 동향 · 구간 값은 FRED 원/달러(뉴욕 정오) 기준" />
                        <RegimeTimeline regimes={data.regimes} selected={selected} onSelect={setSelected} />
                    </section>

                    <p className="flex items-start gap-1.5 text-[11px] text-gray-500 px-1">
                        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        출처: FRED(DEXKOUS·DGS10·IRLTLT01KRM156N·RBKRBIS·DFF·IR3TIB01KRM156N·DEXJPUS·DEXCHUS), Yahoo Finance(DX-Y.NYB·KRW=X).
                        한국 금리·실질실효환율은 월간 지표라 최대 2개월 늦습니다. 판정 배지는 10년 백분위와 실질실효환율 괴리로 만든 참고 지표이며 투자 권유가 아닙니다.
                    </p>
                </>
            )}
        </div>
    );
}
