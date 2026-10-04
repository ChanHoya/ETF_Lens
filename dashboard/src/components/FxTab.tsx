'use client';
// 시장동향 > 환율 하위 탭 — 스냅샷, 20년 추이 차트, 국면 타임라인, 연계성 분석, 원화 가치·아시아 통화, 환헤지 판단

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ResponsiveContainer, ComposedChart, Line, XAxis, YAxis, CartesianGrid,
    Tooltip as RechartsTooltip, Legend, ReferenceArea, ReferenceLine, Area,
} from 'recharts';
import { DollarSign, Globe2, Landmark, RefreshCw, Scale, Shield, TrendingDown, TrendingUp, History, Info, Link2, Gauge, ChevronDown } from 'lucide-react';
import { API_BASE } from '@/lib/apiConfig';
import ChartLoadingPlaceholder from './ChartLoadingPlaceholder';
import FxFinder from './FxFinder';

type Row = {
    date: string; krw: number | null; dxy: number | null; us10: number | null; kr10: number | null; spread10: number | null;
    jpy100: number | null; cny: number | null; vix: number | null;
};
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
type Analysis = {
    corr: { date: string; dxy: number | null; spread: number | null; vix: number | null }[];
    corr_now: { dxy: number | null; spread: number | null; vix: number | null };
    fair?: {
        rows: { date: string; actual: number; fitted: number; gap: number }[];
        now: { actual: number; fitted: number; gap_pct: number }; elasticity: number; r2: number; years: number;
    };
    beta?: { value: number; r2: number; weeks: number };
    decomp_1y?: { krw_chg: number; dxy_chg: number; dollar_part: number; krw_part: number };
    reer?: { rows: { date: string; reer: number }[]; avg: number; std: number };
    hedge: { pick: 'H' | 'UH' | 'MIX'; label: string; score_h: number; score_uh: number; reasons: { side: 'H' | 'UH' | 'MIX'; text: string }[] };
};
type Overview = { snapshot: Snapshot; weekly: Row[]; regimes: Regime[]; analysis?: Analysis; updated_at: string; stale?: boolean };

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
    const [all, setAll] = useState(false);
    const ordered = regimes.map((g, i) => ({ g, i })).reverse();  // 최신 국면부터
    const order = all ? ordered : ordered.slice(0, 5);
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
            {ordered.length > 5 && (
                <button type="button" onClick={() => setAll(v => !v)}
                    className="w-full flex items-center justify-center gap-1 text-xs font-bold text-gray-400 hover:text-gray-200 py-2 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/5">
                    {all ? '최근 5개만 보기' : `전체 ${ordered.length}개 구간 보기`}
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${all ? 'rotate-180' : ''}`} />
                </button>
            )}
        </div>
    );
}

// 상관계수 해석 — 주간 변화 기준
const corrLabel = (v: number | null) => v == null ? '-' : v >= 0.6 ? '강한 동조' : v >= 0.3 ? '보통 동조' : v > -0.3 ? '거의 무관' : '반대로 움직임';
const sign = (v: number, d = 1) => `${v > 0 ? '+' : ''}${v.toFixed(d)}`;
const CORR_SERIES = [
    { key: 'dxy', name: '달러지수', color: '#6366f1' },
    { key: 'spread', name: '미-한 금리차', color: '#10b981' },
    { key: 'vix', name: 'VIX(공포지수)', color: '#f43f5e' },
] as const;

function CorrChart({ rows, now }: { rows: (Analysis['corr'][number] & { t: number })[]; now: Analysis['corr_now'] }) {
    return (
        <>
            <div className="flex flex-wrap gap-2 mb-2">
                {CORR_SERIES.map(c => (
                    <span key={c.key} className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-gray-300">
                        <span style={{ color: c.color }}>●</span> {c.name} {now[c.key] == null ? '-' : sign(now[c.key] as number, 2)} · {corrLabel(now[c.key])}
                    </span>
                ))}
            </div>
            <ResponsiveContainer width="100%" height={260}>
                <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                    <XAxis dataKey="t" type="number" scale="time" domain={['dataMin', 'dataMax']} tickFormatter={yearTick} tick={axisTick} minTickGap={30} />
                    <YAxis domain={[-1, 1]} ticks={[-1, -0.5, 0, 0.5, 1]} tick={axisTick} width={36} />
                    <ReferenceLine y={0} stroke="#ffffff30" />
                    <RechartsTooltip contentStyle={TOOLTIP_STYLE} labelFormatter={(t) => fmtDate(Number(t))} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    {CORR_SERIES.map(c => (
                        <Line key={c.key} dataKey={c.key} name={`원/달러 vs ${c.name}`} stroke={c.color} dot={false} strokeWidth={1.6} connectNulls isAnimationActive={false} />
                    ))}
                </ComposedChart>
            </ResponsiveContainer>
        </>
    );
}

function FairChart({ fair }: { fair: NonNullable<Analysis['fair']> }) {
    const rows = useMemo(() => fair.rows.map(r => ({ ...r, t: ts(r.date) })), [fair]);
    return (
        <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={rows} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis dataKey="t" type="number" scale="time" domain={['dataMin', 'dataMax']} tickFormatter={yearTick} tick={axisTick} minTickGap={30} />
                <YAxis yAxisId="gap" tick={axisTick} width={44} tickFormatter={(v: number) => `${v}%`} />
                <YAxis yAxisId="krw" orientation="right" tick={axisTick} domain={['auto', 'auto']} width={48} />
                <ReferenceLine yAxisId="gap" y={0} stroke="#ffffff30" />
                <RechartsTooltip contentStyle={TOOLTIP_STYLE} labelFormatter={(t) => fmtDate(Number(t))}
                    formatter={(v, name) => [typeof v === 'number' ? v.toLocaleString('ko-KR') : v, name]} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area yAxisId="gap" dataKey="gap" name="괴리 (좌, %)" stroke="#f43f5e" fill="#f43f5e" fillOpacity={0.15} strokeWidth={1} isAnimationActive={false} />
                <Line yAxisId="krw" dataKey="actual" name="실제 원/달러 (우)" stroke="#6366f1" dot={false} strokeWidth={2} isAnimationActive={false} />
                <Line yAxisId="krw" dataKey="fitted" name="달러지수로 본 적정 (우)" stroke="#9ca3af" strokeDasharray="5 3" dot={false} strokeWidth={1.5} isAnimationActive={false} />
            </ComposedChart>
        </ResponsiveContainer>
    );
}

// 1년 변화 분해: 실제 = 달러 몫 + 원화 고유 몫
function DecompBar({ d }: { d: NonNullable<Analysis['decomp_1y']> }) {
    const parts = [
        { label: '달러 몫', v: d.dollar_part, color: 'bg-indigo-500' },
        { label: '원화 고유 몫', v: d.krw_part, color: 'bg-rose-500' },
    ];
    const max = Math.max(...parts.map(p => Math.abs(p.v)), Math.abs(d.krw_chg), 1);
    return (
        <div className="space-y-1.5">
            {[...parts, { label: '실제 변화', v: d.krw_chg, color: 'bg-gray-400' }].map(p => (
                <div key={p.label} className="flex items-center gap-2 text-xs">
                    <span className="w-20 shrink-0 text-gray-400">{p.label}</span>
                    <div className="relative flex-1 h-3">
                        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/20" />
                        <div className={`absolute top-0 bottom-0 rounded-sm ${p.color}`}
                            style={p.v >= 0 ? { left: '50%', width: `${(p.v / max) * 50}%` } : { right: '50%', width: `${(-p.v / max) * 50}%` }} />
                    </div>
                    <span className={`w-14 text-right font-bold ${p.v > 0 ? 'text-red-400' : 'text-blue-400'}`}>{sign(p.v)}%</span>
                </div>
            ))}
        </div>
    );
}

function AnalysisSection({ an, range, setRange, corrRows }: { an: Analysis; range: Range; setRange: (r: Range) => void; corrRows: (Analysis['corr'][number] & { t: number })[] }) {
    const f = an.fair;
    return (
        <section className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="bg-black/20 rounded-2xl border border-white/5 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                    <SectionTitle icon={<Link2 className="w-5 h-5 text-indigo-400" />} title="원/달러는 무엇과 같이 움직이나"
                        sub="52주 롤링 상관계수 · 주간 변화끼리 계산 · +1에 가까울수록 같은 방향" />
                    <RangeButtons range={range} setRange={setRange} />
                </div>
                <CorrChart rows={corrRows} now={an.corr_now} />
                <p className="text-[11px] text-gray-500 mt-2 leading-relaxed">
                    달러지수와의 상관이 낮아지면 원화가 글로벌 달러가 아닌 국내 요인(수급·정치·성장)으로 움직인다는 뜻입니다.
                    VIX와 양(+)의 상관은 위험회피 때 원화가 약해지는 &lsquo;위험자산 통화&rsquo; 성격을 보여 줍니다.
                </p>
            </div>
            <div className="bg-black/20 rounded-2xl border border-white/5 p-4">
                <SectionTitle icon={<Gauge className="w-5 h-5 text-rose-400" />} title="달러 몫 vs 원화 고유 몫"
                    sub={f ? `최근 ${f.years}년 달러지수로 설명되는 적정 원/달러와 실제의 괴리` : '데이터 부족'} />
                {f && <FairChart fair={f} />}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                    {f && (
                        <div className="rounded-xl bg-white/[0.03] border border-white/5 p-3">
                            <p className="text-[11px] text-gray-400 font-bold">현재 괴리</p>
                            <p className={`text-xl font-extrabold ${f.now.gap_pct > 0 ? 'text-red-400' : 'text-blue-400'}`}>{sign(f.now.gap_pct)}%</p>
                            <p className="text-[11px] text-gray-500">실제 {fmtNum(f.now.actual)} vs 적정 {fmtNum(f.now.fitted)}원</p>
                        </div>
                    )}
                    {an.decomp_1y && (
                        <div className="md:col-span-2 rounded-xl bg-white/[0.03] border border-white/5 p-3">
                            <p className="text-[11px] text-gray-400 font-bold mb-1.5">
                                최근 1년 원/달러 변화 분해 (달러지수 {sign(an.decomp_1y.dxy_chg)}% × 민감도 {an.beta?.value.toFixed(2)})
                            </p>
                            <DecompBar d={an.decomp_1y} />
                        </div>
                    )}
                </div>
                <p className="text-[11px] text-gray-500 mt-2 leading-relaxed">
                    {f && `적정선은 ln(원/달러)=a+b·ln(달러지수) 회귀(탄력성 ${f.elasticity}, 설명력 R² ${f.r2})로 그린 기술적 기준입니다. `}
                    {an.beta && `민감도: 달러지수가 1% 오르면 원/달러는 평균 ${an.beta.value.toFixed(2)}% 오릅니다(최근 3년, R² ${an.beta.r2}). `}
                    괴리가 +이면 달러로 설명되지 않는 원화 약세가 쌓여 있다는 뜻입니다.
                </p>
            </div>
        </section>
    );
}

function ValueSection({ an, rows, range, setRange }: { an: Analysis; rows: (Row & { t: number })[]; range: Range; setRange: (r: Range) => void }) {
    const reerRows = useMemo(() => (an.reer?.rows ?? []).map(r => ({ ...r, t: ts(`${r.date}-01`) })), [an.reer]);
    // 아시아 통화: 보이는 구간 첫 값을 100으로 (오를수록 원화 약세)
    const asia = useMemo(() => {
        const base = (k: 'krw' | 'jpy100' | 'cny') => rows.find(r => r[k] != null)?.[k] ?? null;
        const b = { krw: base('krw'), jpy100: base('jpy100'), cny: base('cny') };
        return rows.map(r => ({
            t: r.t,
            krw: r.krw != null && b.krw ? +(r.krw / b.krw * 100).toFixed(1) : null,
            jpy100: r.jpy100 != null && b.jpy100 ? +(r.jpy100 / b.jpy100 * 100).toFixed(1) : null,
            cny: r.cny != null && b.cny ? +(r.cny / b.cny * 100).toFixed(1) : null,
        }));
    }, [rows]);
    const rr = an.reer;
    return (
        <section className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="bg-black/20 rounded-2xl border border-white/5 p-4">
                <SectionTitle icon={<Scale className="w-5 h-5 text-sky-400" />} title="원화 실질실효환율"
                    sub={rr ? `BIS 월간 · 회색 띠 = 20년 평균 ${rr.avg} ± 1σ(${rr.std}) · 아래로 벗어날수록 원화 저평가` : '데이터 없음'} />
                {rr && (
                    <ResponsiveContainer width="100%" height={260}>
                        <ComposedChart data={reerRows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                            <ReferenceArea y1={rr.avg - rr.std} y2={rr.avg + rr.std} fill="#94a3b8" fillOpacity={0.12} />
                            <ReferenceLine y={rr.avg} stroke="#9ca3af" strokeDasharray="5 3" />
                            <XAxis dataKey="t" type="number" scale="time" domain={['dataMin', 'dataMax']} tickFormatter={yearTick} tick={axisTick} minTickGap={30} />
                            <YAxis tick={axisTick} domain={['auto', 'auto']} width={40} />
                            <RechartsTooltip contentStyle={TOOLTIP_STYLE} labelFormatter={(t) => fmtDate(Number(t)).slice(0, 7)} />
                            <Line dataKey="reer" name="실질실효환율" stroke="#38bdf8" dot={false} strokeWidth={2} isAnimationActive={false} />
                        </ComposedChart>
                    </ResponsiveContainer>
                )}
            </div>
            <div className="bg-black/20 rounded-2xl border border-white/5 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                    <SectionTitle icon={<Globe2 className="w-5 h-5 text-amber-400" />} title="원화만 약한가, 아시아 전체인가"
                        sub="원/달러·원/100엔·원/위안을 구간 시작 = 100으로 맞춤 · 위로 갈수록 원화 약세" />
                    <RangeButtons range={range} setRange={setRange} />
                </div>
                <ResponsiveContainer width="100%" height={260}>
                    <ComposedChart data={asia} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                        <ReferenceLine y={100} stroke="#ffffff30" />
                        <XAxis dataKey="t" type="number" scale="time" domain={['dataMin', 'dataMax']} tickFormatter={yearTick} tick={axisTick} minTickGap={30} />
                        <YAxis tick={axisTick} domain={['auto', 'auto']} width={40} />
                        <RechartsTooltip contentStyle={TOOLTIP_STYLE} labelFormatter={(t) => fmtDate(Number(t))} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Line dataKey="krw" name="원/달러" stroke="#6366f1" dot={false} strokeWidth={2} connectNulls isAnimationActive={false} />
                        <Line dataKey="jpy100" name="원/100엔" stroke="#f59e0b" dot={false} strokeWidth={1.5} connectNulls isAnimationActive={false} />
                        <Line dataKey="cny" name="원/위안" stroke="#f43f5e" dot={false} strokeWidth={1.5} connectNulls isAnimationActive={false} />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
        </section>
    );
}

function HedgeSection({ h, s }: { h: Analysis['hedge']; s: Snapshot }) {
    const pickCls = h.pick === 'H' ? 'bg-purple-500/15 text-purple-300 border-purple-400/30'
        : h.pick === 'UH' ? 'bg-amber-500/15 text-amber-300 border-amber-400/30' : 'bg-white/5 text-gray-200 border-white/15';
    const sideCls = { H: 'text-purple-300 border-purple-400/30', UH: 'text-amber-300 border-amber-400/30', MIX: 'text-gray-300 border-white/15' };
    return (
        <section className="space-y-4">
            <div className="bg-black/20 rounded-2xl border border-white/5 p-4">
                <SectionTitle icon={<Shield className="w-5 h-5 text-purple-400" />} title="해외 ETF 환헤지 판단"
                    sub="미국 주식·채권 ETF를 환헤지(H)로 살지 환노출(UH)로 살지 — 지금 지표로 본 참고 판단" />
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div className="rounded-xl bg-white/[0.03] border border-white/5 p-4 flex flex-col items-start gap-2">
                        <span className={`text-lg font-extrabold px-3 py-1 rounded-full border ${pickCls}`}>{h.label}</span>
                        <p className="text-xs text-gray-400">근거 점수 — 환헤지(H) {h.score_h} · 환노출(UH) {h.score_uh}</p>
                        <p className="text-[11px] text-gray-500 leading-relaxed">
                            2점 이상 차이 나면 한쪽을 권하고, 아니면 H·UH를 나눠 담아 환율 방향 판단을 피합니다.
                            {s.hedge && ` 지금 헤지 비용은 연 ${s.hedge.value.toFixed(2)}%p입니다.`}
                        </p>
                    </div>
                    <ul className="lg:col-span-2 space-y-2">
                        {h.reasons.map(r => (
                            <li key={r.text} className="flex items-start gap-2 text-sm text-gray-200">
                                <span className={`shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-full border ${sideCls[r.side]}`}>{r.side === 'MIX' ? '중립' : r.side}</span>
                                {r.text}
                            </li>
                        ))}
                        <li className="text-[11px] text-gray-500 pt-1">
                            환헤지(H): 환율 변동을 막는 대신 헤지 비용(미-한 단기금리차)을 냅니다. 환노출(UH): 원/달러가 오르면 환차익, 내리면 환차손이 납니다.
                        </li>
                    </ul>
                </div>
            </div>
            <FxFinder />
        </section>
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

    const corrRows = useMemo(() => {
        if (!data?.analysis || rows.length === 0) return [];
        const from = rows[0].t;
        return data.analysis.corr.map(r => ({ ...r, t: ts(r.date) })).filter(r => r.t >= from);
    }, [data, rows]);

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

                    {data.analysis && (
                        <>
                            <AnalysisSection an={data.analysis} range={range} setRange={setRange} corrRows={corrRows} />
                            <ValueSection an={data.analysis} rows={rows} range={range} setRange={setRange} />
                            <HedgeSection h={data.analysis.hedge} s={data.snapshot} />
                        </>
                    )}

                    <p className="flex items-start gap-1.5 text-[11px] text-gray-500 px-1">
                        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        출처: FRED(DEXKOUS·DGS10·IRLTLT01KRM156N·RBKRBIS·DFF·IR3TIB01KRM156N·DEXJPUS·DEXCHUS·VIXCLS), Yahoo Finance(DX-Y.NYB·KRW=X).
                        한국 금리·실질실효환율은 월간 지표라 최대 2개월 늦습니다. 판정 배지·환헤지 판단·적정 원/달러는 공개 지표로 만든 참고 정보이며 투자 권유가 아닙니다.
                    </p>
                </>
            )}
        </div>
    );
}
