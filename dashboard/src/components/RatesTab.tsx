'use client';
// 시장동향 > 금리 하위 탭 — 한·미 기준금리 스냅샷, 기준금리 사이클, 시장금리, 장단기 금리차·역전 이력·수익률곡선, 기준금리 국면 타임라인

import React, { useMemo, useState } from 'react';
import {
    ResponsiveContainer, ComposedChart, LineChart, Line, XAxis, YAxis, CartesianGrid,
    Tooltip as RechartsTooltip, Legend, ReferenceArea, ReferenceLine,
} from 'recharts';
import { Landmark, RefreshCw, TrendingUp, Activity, History, Info, CalendarClock, Scale, Percent, Waves } from 'lucide-react';
import { API_BASE } from '@/lib/apiConfig';
import { yearTick, yearTicks } from '@/lib/chartTicks';
import ChartLoadingPlaceholder from './ChartLoadingPlaceholder';
import SpreadBasisInfo from './SpreadBasisInfo';
import RegimeMilestones, { type Milestone } from './RegimeMilestones';
import { useCachedOverview } from '@/lib/useCachedOverview';

type Change = { date: string; from: number; to: number; bp: number } | null;
type Meeting = { date: string; d_day: number } | null;
type RateCard = { value: number; date: string; chg_1w: number | null; chg_1m: number | null; chg_1y: number | null; pct10y: number | null };
type Implied = { gap: number; moves: number; label: string } | null;
type Snapshot = {
    kr_base?: { value: number; date: string; last_change: Change; next_meeting: Meeting };
    us_policy?: { upper: number; lower: number; effective: number | null; date: string; last_change: Change; next_meeting: Meeting };
    policy_gap?: number;
    kr3y?: RateCard; kr10y?: RateCard; us2y?: RateCard; us10y?: RateCard;
    implied: { kr: Implied; us: Implied };
    real: { kr?: { value: number; cpi: number; cpi_month: string }; us?: { value: number; cpi: number; cpi_month: string } };
    phase: { kr: string | null; us: string | null };
};
type Inversion = { start: string; end: string; min: number; recession: string | null; lead_months: number | null; status: 'recession' | 'no_recession' | 'watching' };
type Spread = { label: string; basis?: 'common' | 'reference'; value: number; date: string; inverted: boolean; chg_1m: number | null; pct20y: number | null; inversions: Inversion[] };
type Shape = { name: string; meaning: string; short_bp: number; long_bp: number; slope_bp: number; days: number } | null;
type CurvePt = { tenor: string; value: number | null };
type Row = {
    date: string; kr_base: number | null; us_upper: number | null; ecb: number | null; kr3y: number | null; kr10y: number | null;
    us2y: number | null; us10y: number | null; kr_10_3: number | null; us_10_3?: number | null; us_10_2: number | null; us_10_3m: number | null;
    kr1y?: number | null; us1y?: number | null; kr30y?: number | null; us30y?: number | null; kr50y?: number | null;
};
type TermRow = { key: 'short' | 'long' | 'ultra'; label: string; kr: number; us: number; gap: number; gap_1y: number | null; kr_chg_1y: number | null; us_chg_1y: number | null };
type Terms = {
    rows: TermRow[]; premium: Partial<Record<'kr' | 'us', { now: number; y1: number | null }>>; insights: string[];
    kr50y: { value: number; date: string } | null;
} | null;
type Regime = {
    start: string; end: string | null; kind: 'hike' | 'cut' | 'hold'; title: string; drivers: string[]; source: string | null;
    from: number; to: number; bp: number; changes: number; auto?: boolean;
};
type Overview = {
    snapshot: Snapshot; spreads: Record<string, Spread>; shapes: { kr: Shape; us: Shape }; terms?: Terms;
    curves: Record<'kr' | 'us', { date: string; now: CurvePt[]; m1: CurvePt[]; y1: CurvePt[] }>;
    recessions: { start: string; end: string | null }[]; weekly: Row[]; regimes: Regime[];
    data_dates: Record<string, string>; updated_at: string; stale?: boolean; ecos_key?: boolean;
};

const RANGES = ['5Y', '10Y', '20Y'] as const;
type Range = typeof RANGES[number];
const TOOLTIP_STYLE = { background: '#1a1a23', border: '1px solid #ffffff20', borderRadius: 8, fontSize: 12 };
const axisTick = { fill: '#9ca3af', fontSize: 11 };
const KIND: Record<Regime['kind'], { label: string; fill: string; badge: string }> = {
    hike: { label: '인상 ↑', fill: '#ef4444', badge: 'bg-red-500/15 text-red-300 border-red-400/30' },
    cut: { label: '인하 ↓', fill: '#3b82f6', badge: 'bg-blue-500/15 text-blue-300 border-blue-400/30' },
    hold: { label: '동결', fill: '#94a3b8', badge: 'bg-white/5 text-gray-300 border-white/15' },
};
const STATUS: Record<Inversion['status'], { label: string; cls: string }> = {
    recession: { label: '침체로 이어짐', cls: 'text-red-300' },
    no_recession: { label: '침체 없음', cls: 'text-emerald-300' },
    watching: { label: '관찰 중', cls: 'text-amber-300' },
};

const ts = (d: string) => Date.parse(d);
const fmtDate = (t: number) => new Date(t).toISOString().slice(0, 10);
const pct = (v: number | null | undefined, d = 2) => (v == null ? '-' : `${v.toFixed(d)}%`);
const signed = (v: number, d = 2, unit = '%p') => `${v > 0 ? '+' : ''}${v.toFixed(d)}${unit}`;
const md = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;

// 금리 변화는 bp. 국내 관례대로 오르면 빨강, 내리면 파랑
function Bp({ v, label }: { v: number | null | undefined; label: string }) {
    if (v == null) return <span className="text-gray-500">{label} -</span>;
    const cls = v > 0 ? 'text-red-400' : v < 0 ? 'text-blue-400' : 'text-gray-400';
    return <span className={cls}>{label} {v > 0 ? '+' : ''}{v.toFixed(0)}bp</span>;
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

function Toggle<T extends string>({ options, value, onChange }: { options: readonly { id: T; label: string }[]; value: T; onChange: (v: T) => void }) {
    return (
        <div className="flex gap-1.5">
            {options.map(o => (
                <button key={o.id} onClick={() => onChange(o.id)}
                    className={`text-xs font-bold px-2.5 py-1 rounded-lg border transition ${value === o.id
                        ? 'bg-indigo-500/20 border-indigo-400/50 text-indigo-300'
                        : 'bg-white/5 border-white/10 text-gray-400 hover:text-gray-200 hover:bg-white/10'}`}>
                    {o.label}
                </button>
            ))}
        </div>
    );
}
const RANGE_OPTS = RANGES.map(r => ({ id: r, label: r }));
const COUNTRY_OPTS = [{ id: 'kr', label: '한국' }, { id: 'us', label: '미국' }] as const;

function TwoRates({ a, b, la, lb }: { a?: RateCard; b?: RateCard; la: string; lb: string }) {
    return (
        <div className="space-y-1.5">
            {([[la, a], [lb, b]] as [string, RateCard | undefined][]).map(([l, card]) => (
                <div key={l}>
                    <div className="flex items-baseline justify-between">
                        <span className="text-xs text-gray-400">{l}</span>
                        <span className="text-lg font-extrabold text-white">{pct(card?.value, 2)}</span>
                    </div>
                    {card && <div className="flex flex-wrap justify-end gap-x-2 text-[11px] font-bold"><Bp v={card.chg_1m} label="1개월" /><Bp v={card.chg_1y} label="1년" /></div>}
                </div>
            ))}
        </div>
    );
}

function SnapshotGrid({ d }: { d: Overview }) {
    const s = d.snapshot;
    const sp = d.spreads;
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            <Card icon={<Landmark className="w-3.5 h-3.5 text-indigo-400" />} title="한국 기준금리"
                foot={s.kr_base?.next_meeting ? `다음 금통위 ${md(s.kr_base.next_meeting.date)} (D-${s.kr_base.next_meeting.d_day})` : '다음 회의 일정 갱신 필요'}>
                {s.kr_base ? <>
                    <div className="text-2xl font-extrabold text-white">{pct(s.kr_base.value)}</div>
                    {s.kr_base.last_change && <p className={`text-xs font-bold mt-1 ${s.kr_base.last_change.bp > 0 ? 'text-red-400' : 'text-blue-400'}`}>
                        최근 {signed(s.kr_base.last_change.bp, 0, 'bp')} ({s.kr_base.last_change.date})</p>}
                </> : <p className="text-sm text-gray-500">데이터 없음</p>}
            </Card>
            <Card icon={<Landmark className="w-3.5 h-3.5 text-rose-400" />} title="미국 정책금리"
                foot={s.us_policy?.next_meeting ? `다음 FOMC ${md(s.us_policy.next_meeting.date)} (D-${s.us_policy.next_meeting.d_day}, 미국 시간)` : '다음 회의 일정 갱신 필요'}>
                {s.us_policy ? <>
                    <div className="text-2xl font-extrabold text-white">{s.us_policy.lower.toFixed(2)}~{s.us_policy.upper.toFixed(2)}%</div>
                    <p className="text-xs text-gray-400 mt-1">실효 {pct(s.us_policy.effective)}
                        {s.us_policy.last_change && <span className={`font-bold ml-2 ${s.us_policy.last_change.bp > 0 ? 'text-red-400' : 'text-blue-400'}`}>
                            최근 {signed(s.us_policy.last_change.bp, 0, 'bp')} ({s.us_policy.last_change.date})</span>}</p>
                </> : <p className="text-sm text-gray-500">데이터 없음</p>}
            </Card>
            <Card icon={<Scale className="w-3.5 h-3.5 text-amber-400" />} title="한미 정책금리 차"
                foot="한국 기준금리 − 미국 정책금리 상단 · 마이너스면 미국이 더 높음(원화 약세 압력)">
                {s.policy_gap != null ? <div className="text-2xl font-extrabold text-white">{signed(s.policy_gap)}</div> : <p className="text-sm text-gray-500">데이터 없음</p>}
            </Card>
            <Card icon={<CalendarClock className="w-3.5 h-3.5 text-purple-400" />} title="시장이 반영한 1년 내 금리 경로"
                foot="1년물 국채 − 정책금리 · 0.25%p ≈ 1회 (기간 프리미엄이 섞인 근사치)">
                {(['kr', 'us'] as const).map(c => {
                    const im = s.implied[c];
                    return (
                        <div key={c} className="flex items-baseline justify-between gap-2 py-0.5">
                            <span className="text-xs text-gray-400">{c === 'kr' ? '한국' : '미국'}</span>
                            <span className={`text-sm font-extrabold ${im && im.gap > 0 ? 'text-red-400' : im && im.gap < 0 ? 'text-blue-400' : 'text-gray-300'}`}>
                                {im ? `${signed(im.gap)} · ${im.label.replace('1년 내 ', '')}` : '-'}
                            </span>
                        </div>
                    );
                })}
            </Card>
            <Card icon={<Percent className="w-3.5 h-3.5 text-sky-400" />} title="한국 국고채" foot={s.kr3y ? `${s.kr3y.date} 기준 · 3년물은 10년 중 ${s.kr3y.pct10y}% 위치` : undefined}>
                <TwoRates a={s.kr3y} b={s.kr10y} la="3년" lb="10년" />
            </Card>
            <Card icon={<Percent className="w-3.5 h-3.5 text-rose-400" />} title="미국 국채" foot={s.us10y ? `${s.us10y.date} 기준 · 10년물은 10년 중 ${s.us10y.pct10y}% 위치` : undefined}>
                <TwoRates a={s.us2y} b={s.us10y} la="2년" lb="10년" />
            </Card>
            <Card icon={<Waves className="w-3.5 h-3.5 text-emerald-400" />} title="장단기 금리차 (한·미 10년−3년)" foot="마이너스(역전)는 경기 둔화 신호로 읽힙니다 · 10년−3개월은 침체 예측 참고">
                {(['kr_10_3', 'us_10_3', 'us_10_3m'] as const).map(k => sp[k] && (
                    <div key={k} className={`flex items-baseline justify-between gap-2 py-0.5 ${sp[k].basis === 'reference' ? 'border-t border-white/5 mt-0.5 pt-1' : ''}`}>
                        <span className={`text-xs ${sp[k].basis === 'reference' ? 'text-gray-500' : 'text-gray-400'}`}>{sp[k].label}</span>
                        <span className={`text-sm font-extrabold ${sp[k].inverted ? 'text-red-400' : 'text-white'}`}>
                            {signed(sp[k].value)}{sp[k].inverted && ' 역전'}
                        </span>
                    </div>
                ))}
            </Card>
            <Card icon={<Activity className="w-3.5 h-3.5 text-orange-400" />} title="실질 기준금리"
                foot="정책금리 − 소비자물가 상승률 · 0 근처면 긴축 효과가 약해 추가 인상 압력">
                {(['kr', 'us'] as const).map(c => {
                    const r = s.real[c];
                    return (
                        <div key={c} className="flex items-baseline justify-between gap-2 py-0.5">
                            <span className="text-xs text-gray-400">{c === 'kr' ? '한국' : '미국'}</span>
                            <span className="text-sm font-extrabold text-white">
                                {r ? signed(r.value) : '-'}
                                {r && <span className="text-[11px] font-medium text-gray-500 ml-1.5">CPI {r.cpi}% ({r.cpi_month})</span>}
                            </span>
                        </div>
                    );
                })}
            </Card>
        </div>
    );
}

function PolicyChart({ rows, regimes, selected }: { rows: (Row & { t: number })[]; regimes: Regime[]; selected: number | null }) {
    const from = rows[0]?.t ?? 0;
    const to = rows[rows.length - 1]?.t ?? 0;
    return (
        <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                {regimes.map((g, i) => g.kind !== 'hold' && (
                    <ReferenceArea key={g.start} x1={Math.max(ts(g.start), from)} x2={g.end ? ts(g.end) : to}
                        ifOverflow="hidden" fill={KIND[g.kind].fill} fillOpacity={selected === i ? 0.25 : 0.08} />
                ))}
                <XAxis dataKey="t" type="number" scale="time" domain={['dataMin', 'dataMax']} tickFormatter={yearTick} ticks={yearTicks(rows)} interval={0} tick={axisTick} />
                <YAxis tick={axisTick} width={40} tickFormatter={(v: number) => `${v}%`} />
                <RechartsTooltip contentStyle={TOOLTIP_STYLE} labelFormatter={(t) => fmtDate(Number(t))} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="stepAfter" dataKey="kr_base" name="한국 기준금리" stroke="#6366f1" dot={false} strokeWidth={2.2} connectNulls isAnimationActive={false} />
                <Line type="stepAfter" dataKey="us_upper" name="미국 정책금리(상단)" stroke="#f43f5e" dot={false} strokeWidth={1.8} connectNulls isAnimationActive={false} />
                <Line type="stepAfter" dataKey="ecb" name="ECB 예금금리" stroke="#f59e0b" dot={false} strokeWidth={1.4} connectNulls isAnimationActive={false} />
            </ComposedChart>
        </ResponsiveContainer>
    );
}

function MarketChart({ rows, country }: { rows: (Row & { t: number })[]; country: 'kr' | 'us' }) {
    const lines = country === 'kr'
        ? [{ k: 'kr_base', n: '기준금리', c: '#6366f1', step: true }, { k: 'kr3y', n: '국고채 3년', c: '#38bdf8', step: false }, { k: 'kr10y', n: '국고채 10년', c: '#10b981', step: false }]
        : [{ k: 'us_upper', n: '정책금리(상단)', c: '#f43f5e', step: true }, { k: 'us2y', n: '미국채 2년', c: '#f59e0b', step: false }, { k: 'us10y', n: '미국채 10년', c: '#a78bfa', step: false }];
    return (
        <ResponsiveContainer width="100%" height={300}>
            <LineChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis dataKey="t" type="number" scale="time" domain={['dataMin', 'dataMax']} tickFormatter={yearTick} ticks={yearTicks(rows)} interval={0} tick={axisTick} />
                <YAxis tick={axisTick} width={40} tickFormatter={(v: number) => `${v}%`} />
                <RechartsTooltip contentStyle={TOOLTIP_STYLE} labelFormatter={(t) => fmtDate(Number(t))} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {lines.map(l => (
                    <Line key={l.k} type={l.step ? 'stepAfter' : 'monotone'} dataKey={l.k} name={l.n} stroke={l.c}
                        dot={false} strokeWidth={l.step ? 2.2 : 1.6} connectNulls isAnimationActive={false} />
                ))}
            </LineChart>
        </ResponsiveContainer>
    );
}

function SpreadChart({ rows, recessions }: { rows: (Row & { t: number })[]; recessions: Overview['recessions'] }) {
    const from = rows[0]?.t ?? 0;
    const to = rows[rows.length - 1]?.t ?? 0;
    return (
        <ResponsiveContainer width="100%" height={300}>
            <LineChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                {recessions.map(r => (
                    <ReferenceArea key={r.start} x1={Math.max(ts(r.start), from)} x2={r.end ? ts(r.end) : to} ifOverflow="hidden" fill="#94a3b8" fillOpacity={0.2} />
                ))}
                <ReferenceLine y={0} stroke="#f59e0b" strokeDasharray="4 4" />
                <XAxis dataKey="t" type="number" scale="time" domain={['dataMin', 'dataMax']} tickFormatter={yearTick} ticks={yearTicks(rows)} interval={0} tick={axisTick} />
                <YAxis tick={axisTick} width={44} tickFormatter={(v: number) => `${v}%p`} />
                <RechartsTooltip contentStyle={TOOLTIP_STYLE} labelFormatter={(t) => fmtDate(Number(t))} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line dataKey="kr_10_3" name="한국 10년−3년" stroke="#6366f1" dot={false} strokeWidth={2} connectNulls isAnimationActive={false} />
                <Line dataKey="us_10_3" name="미국 10년−3년" stroke="#f43f5e" dot={false} strokeWidth={2} connectNulls isAnimationActive={false} />
                <Line dataKey="us_10_3m" name="미국 10년−3개월 (참고)" stroke="#9ca3af" strokeDasharray="4 3" dot={false} strokeWidth={1.2} connectNulls isAnimationActive={false} />
            </LineChart>
        </ResponsiveContainer>
    );
}

function CurveChart({ curve }: { curve: Overview['curves']['kr'] }) {
    const data = curve.now.map((p, i) => ({ tenor: p.tenor, now: p.value, m1: curve.m1[i]?.value ?? null, y1: curve.y1[i]?.value ?? null }));
    return (
        <ResponsiveContainer width="100%" height={220}>
            <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis dataKey="tenor" tick={axisTick} />
                <YAxis tick={axisTick} width={40} domain={['auto', 'auto']} tickFormatter={(v: number) => `${v}%`} />
                <RechartsTooltip contentStyle={TOOLTIP_STYLE} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line dataKey="y1" name="1년 전" stroke="#9ca3af" strokeDasharray="4 3" dot={{ r: 2 }} isAnimationActive={false} />
                <Line dataKey="m1" name="1개월 전" stroke="#38bdf8" dot={{ r: 2 }} isAnimationActive={false} />
                <Line dataKey="now" name={`현재 (${curve.date})`} stroke="#6366f1" strokeWidth={2.4} dot={{ r: 3 }} isAnimationActive={false} />
            </LineChart>
        </ResponsiveContainer>
    );
}

type SpreadKey = 'kr_10_3' | 'us_10_3' | 'us_10_3m';
function InversionTable({ spreads }: { spreads: Overview['spreads'] }) {
    const keys = (['kr_10_3', 'us_10_3', 'us_10_3m'] as SpreadKey[]).filter(k => spreads[k]);
    const [key, setKey] = useState<SpreadKey>(keys.includes('us_10_3') ? 'us_10_3' : keys[0] ?? 'kr_10_3');
    const sp = spreads[key];
    if (!sp) return null;
    const hits = sp.inversions.filter(e => e.status === 'recession');
    const done = sp.inversions.filter(e => e.status !== 'watching');
    const avg = hits.length ? Math.round(hits.reduce((a, e) => a + (e.lead_months ?? 0), 0) / hits.length) : null;
    return (
        <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <p className="text-xs text-gray-400">
                    역전 {done.length}번 중 <strong className="text-red-300">{hits.length}번</strong> 침체로 이어짐
                    {avg != null && <> · 평균 <strong className="text-gray-200">{avg}개월</strong> 뒤</>}
                </p>
                <Toggle options={keys.map(k => ({ id: k, label: spreads[k].label }))} value={key} onChange={setKey} />
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-xs">
                    <thead><tr className="text-gray-500 border-b border-white/10">
                        <th className="text-left py-1.5 font-bold">역전 구간</th><th className="text-right font-bold">최저</th>
                        <th className="text-right font-bold">이후 미국 침체</th><th className="text-right font-bold">시차</th><th className="text-right font-bold">결과</th>
                    </tr></thead>
                    <tbody>
                        {[...sp.inversions].reverse().map(e => (
                            <tr key={e.start} className="border-b border-white/5 text-gray-300">
                                <td className="py-1.5 font-mono">{e.start.slice(0, 7)} ~ {e.end.slice(0, 7)}</td>
                                <td className="text-right font-bold text-red-300">{e.min.toFixed(2)}%p</td>
                                <td className="text-right">{e.recession ? e.recession.slice(0, 7) : '-'}</td>
                                <td className="text-right">{e.lead_months != null ? `${e.lead_months}개월` : '-'}</td>
                                <td className={`text-right font-bold ${STATUS[e.status].cls}`}>{STATUS[e.status].label}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <p className="text-[10px] text-gray-500 mt-1.5">침체 = 미국 NBER 경기침체(FRED USREC). 역전 시작 후 36개월 안에 시작된 침체를 직전 역전에만 연결합니다. 한국 금리차도 미국 침체 기준으로 표시합니다.</p>
        </div>
    );
}

function ShapeCard({ title, shape }: { title: string; shape: Shape }) {
    if (!shape) return null;
    const cls = shape.name.startsWith('베어') ? 'text-red-300 border-red-400/30 bg-red-500/10'
        : shape.name.startsWith('불') ? 'text-blue-300 border-blue-400/30 bg-blue-500/10' : 'text-gray-300 border-white/15 bg-white/5';
    return (
        <div className="rounded-xl bg-white/[0.03] border border-white/5 p-3">
            <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold text-gray-400">{title}</span>
                <span className={`text-xs font-extrabold px-2 py-0.5 rounded-full border ${cls}`}>{shape.name}</span>
            </div>
            <p className="text-[11px] text-gray-300 leading-snug">{shape.meaning}</p>
            <p className="text-[11px] text-gray-500 mt-1">최근 {shape.days}일 단기 {signed(shape.short_bp, 0, 'bp')} · 장기 {signed(shape.long_bp, 0, 'bp')} · 기울기 {signed(shape.slope_bp, 0, 'bp')}</p>
        </div>
    );
}

const TERM_LINES: Record<TermRow['key'], { kr: keyof Row; us: keyof Row; title: string }> = {
    short: { kr: 'kr1y', us: 'us1y', title: '단기 · 1년물' },
    long: { kr: 'kr10y', us: 'us10y', title: '장기 · 10년물' },
    ultra: { kr: 'kr30y', us: 'us30y', title: '초장기 · 30년물' },
};

// 단기·장기·초장기 한·미 비교 — 큰 흐름을 3분할 차트, 비교표, 자동 해석으로 보여준다
function TermSection({ terms, rows, range, setRange }: { terms: NonNullable<Terms>; rows: (Row & { t: number })[]; range: Range; setRange: (r: Range) => void }) {
    return (
        <section className="bg-black/20 rounded-2xl border border-white/5 p-4 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
                <SectionTitle icon={<Activity className="w-5 h-5 text-sky-400" />} title="단기·장기·초장기 금리 — 한·미 비교"
                    sub="국채 1년·10년·30년물 · 단기는 정책금리 기대, 장기는 성장·물가, 초장기는 재정·기간 프리미엄을 반영" />
                <Toggle options={RANGE_OPTS} value={range} onChange={setRange} />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                {terms.rows.map(r => {
                    const L = TERM_LINES[r.key];
                    return (
                        <div key={r.key} className="rounded-xl bg-white/[0.03] border border-white/5 p-3">
                            <div className="flex items-baseline justify-between mb-1">
                                <p className="text-sm font-bold text-gray-200">{L.title}</p>
                                <p className="text-xs text-gray-400">한 {r.kr.toFixed(2)}% · 미 {r.us.toFixed(2)}%
                                    <span className={`font-bold ml-1.5 ${r.gap < 0 ? 'text-blue-400' : 'text-red-400'}`}>{signed(r.gap)}</span></p>
                            </div>
                            <ResponsiveContainer width="100%" height={170}>
                                <LineChart data={rows} margin={{ top: 6, right: 6, bottom: 0, left: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                                    <XAxis dataKey="t" type="number" scale="time" domain={['dataMin', 'dataMax']} tickFormatter={yearTick} ticks={yearTicks(rows)} interval={0} tick={axisTick} />
                                    <YAxis tick={axisTick} width={36} domain={['auto', 'auto']} tickFormatter={(v: number) => `${v}%`} />
                                    <RechartsTooltip contentStyle={TOOLTIP_STYLE} labelFormatter={(t) => fmtDate(Number(t))} />
                                    <Line dataKey={L.kr as string} name="한국" stroke="#6366f1" dot={false} strokeWidth={1.8} connectNulls isAnimationActive={false} />
                                    <Line dataKey={L.us as string} name="미국" stroke="#f43f5e" dot={false} strokeWidth={1.6} connectNulls isAnimationActive={false} />
                                    {r.key === 'ultra' && <Line dataKey="kr50y" name="한국 50년" stroke="#f59e0b" strokeDasharray="4 3" dot={false} strokeWidth={1.4} connectNulls isAnimationActive={false} />}
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    );
                })}
            </div>
            <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
                <div className="xl:col-span-3 overflow-x-auto">
                    <table className="w-full text-xs">
                        <thead><tr className="text-gray-500 border-b border-white/10">
                            <th className="text-left py-1.5 font-bold">구간</th><th className="text-right font-bold">한국</th><th className="text-right font-bold">미국</th>
                            <th className="text-right font-bold">한−미</th><th className="text-right font-bold">1년 전 한−미</th><th className="text-right font-bold">1년 변화 (한 / 미)</th>
                        </tr></thead>
                        <tbody>
                            {terms.rows.map(r => (
                                <tr key={r.key} className="border-b border-white/5 text-gray-300">
                                    <td className="py-1.5 font-bold text-gray-200">{r.label}</td>
                                    <td className="text-right">{r.kr.toFixed(2)}%</td><td className="text-right">{r.us.toFixed(2)}%</td>
                                    <td className={`text-right font-bold ${r.gap < 0 ? 'text-blue-400' : 'text-red-400'}`}>{signed(r.gap)}</td>
                                    <td className="text-right">{r.gap_1y != null ? signed(r.gap_1y) : '-'}</td>
                                    <td className="text-right"><Bp v={r.kr_chg_1y} label="" /> / <Bp v={r.us_chg_1y} label="" /></td>
                                </tr>
                            ))}
                            {terms.kr50y && (
                                <tr className="text-gray-400"><td className="py-1.5">한국 50년물</td><td className="text-right">{terms.kr50y.value.toFixed(2)}%</td>
                                    <td colSpan={4} className="text-right text-[11px]">{terms.kr50y.date} 기준</td></tr>
                            )}
                        </tbody>
                    </table>
                    <div className="grid grid-cols-2 gap-2 mt-3">
                        {(['kr', 'us'] as const).map(c => terms.premium[c] && (
                            <div key={c} className="rounded-lg bg-white/[0.03] border border-white/5 p-2.5">
                                <p className="text-[11px] text-gray-400 font-bold">{c === 'kr' ? '한국' : '미국'} 초장기 프리미엄 (30년−10년)</p>
                                <p className="text-lg font-extrabold text-white">{signed(terms.premium[c]!.now)}</p>
                                {terms.premium[c]!.y1 != null && <p className="text-[11px] text-gray-500">1년 전 {signed(terms.premium[c]!.y1!)}</p>}
                            </div>
                        ))}
                    </div>
                </div>
                <ul className="xl:col-span-2 space-y-2">
                    {terms.insights.map(t => (
                        <li key={t} className="flex gap-2 text-[13px] text-gray-200 leading-snug">
                            <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-sky-400 shrink-0" />{t}
                        </li>
                    ))}
                </ul>
            </div>
        </section>
    );
}

export default function RatesTab() {
    // 재진입 시 캐시를 즉시 그리고, 서버 기준 시각이 1시간 넘었을 때만 백그라운드 갱신
    const { data, refreshing, error, refresh } = useCachedOverview<Overview>('iprism-rates-v3', `${API_BASE}/api/v1/rates/overview`);
    const [range, setRange] = useState<Range>('20Y');
    const [marketCountry, setMarketCountry] = useState<'kr' | 'us'>('kr');
    const [curveCountry, setCurveCountry] = useState<'kr' | 'us'>('kr');
    const [selected, setSelected] = useState<number | null>(null);
    const rows = useMemo(() => {
        if (!data) return [];
        const all = data.weekly.map(r => ({ ...r, t: ts(r.date) }));
        if (range === '20Y' || all.length === 0) return all;
        const cut = new Date(all[all.length - 1].t);
        cut.setFullYear(cut.getFullYear() - (range === '10Y' ? 10 : 5));
        return all.filter(r => r.t >= cut.getTime());
    }, [data, range]);

    // 국면 타임라인: 기간 버튼과 무관하게 전체 기간
    const baseRows = useMemo(() => (data?.weekly ?? []).map(r => ({ t: ts(r.date), v: r.kr_base })), [data]);
    const milestones = useMemo<Milestone[]>(() => (data?.regimes ?? []).map(g => ({
        start: g.start, end: g.end, title: g.title, drivers: g.drivers, source: g.source,
        color: KIND[g.kind].fill, badge: { label: KIND[g.kind].label, cls: KIND[g.kind].badge }, auto: g.auto,
        summary: g.kind === 'hold' ? <>{g.from.toFixed(2)}% 유지</> : <>{g.from.toFixed(2)} → {g.to.toFixed(2)}%{' '}
            <span className={g.bp > 0 ? 'text-red-400' : 'text-blue-400'}>({signed(g.bp, 0, 'bp')} · {g.changes}회)</span></>,
    })), [data]);

    const s = data?.snapshot;
    const dd = data?.data_dates ?? {};
    return (
        <div className="w-full max-w-[95vw] xl:max-w-[1400px] mx-auto space-y-4 pb-10">
            <section className="bg-black/20 rounded-2xl border border-white/5 p-4 md:p-5">
                <div className="flex flex-wrap items-center gap-3 mb-4">
                    <TrendingUp className="w-6 h-6 text-indigo-400" />
                    <div>
                        <h2 className="text-xl font-extrabold text-white leading-none">금리 대시보드</h2>
                        <p className="text-xs text-gray-500 mt-1">한·미 기준금리 · 국채금리 · 장단기·초장기 금리 — 기준 시각이 1시간 지나면 자동 갱신</p>
                    </div>
                    {s && (['kr', 'us'] as const).map(c => s.phase[c] && (
                        <span key={c} className="text-xs font-bold px-3 py-1 rounded-full border bg-white/5 text-gray-200 border-white/15">{s.phase[c]}</span>
                    ))}
                    <div className="ml-auto flex items-center gap-2 text-[11px] text-gray-500">
                        {data && <span>{data.stale ? '⚠ 최신 수집 실패 · 이전 값 · ' : ''}{new Date(data.updated_at).toLocaleString('ko-KR')} 기준{refreshing ? ' · 최신 데이터 확인 중…' : ''}</span>}
                        <button onClick={refresh} disabled={refreshing}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 disabled:opacity-50">
                            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />업데이트
                        </button>
                    </div>
                </div>
                {data && data.ecos_key === false && (
                    <p className="text-xs text-amber-300 mb-3">한국은행 ECOS 인증키(ECOS_API_KEY)가 서버에 없어 한국 지표를 표시하지 못했습니다.</p>
                )}
                {error && !data && <p className="text-sm text-red-400">금리 데이터를 불러오지 못했습니다 ({error}). 서버가 깨어나는 중이면 잠시 후 업데이트를 눌러 주세요.</p>}
                {!data && !error && <ChartLoadingPlaceholder height={140} message="금리 데이터 수집 중" subMessage="한국은행 ECOS·FRED 20년 시계열 — 첫 로드는 수십 초 걸릴 수 있습니다" />}
                {data && <SnapshotGrid d={data} />}
            </section>

            {data && (
                <>
                    <section className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                        <div className="bg-black/20 rounded-2xl border border-white/5 p-4">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                                <SectionTitle icon={<Landmark className="w-5 h-5 text-indigo-400" />} title="기준금리 사이클"
                                    sub="한은·연준·ECB · 음영 = 한국 인상(빨강)·인하(파랑) · 타임라인을 누르면 강조" />
                                <Toggle options={RANGE_OPTS} value={range} onChange={setRange} />
                            </div>
                            <PolicyChart rows={rows} regimes={data.regimes} selected={selected} />
                        </div>
                        <div className="bg-black/20 rounded-2xl border border-white/5 p-4">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                                <SectionTitle icon={<Percent className="w-5 h-5 text-sky-400" />} title="시장금리 vs 기준금리"
                                    sub="국채금리가 기준금리보다 높으면 시장이 인상을 예상" />
                                <div className="flex gap-2">
                                    <Toggle options={COUNTRY_OPTS} value={marketCountry} onChange={setMarketCountry} />
                                    <Toggle options={RANGE_OPTS} value={range} onChange={setRange} />
                                </div>
                            </div>
                            <MarketChart rows={rows} country={marketCountry} />
                        </div>
                    </section>

                    <section className="bg-black/20 rounded-2xl border border-white/5 p-4 space-y-4">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                            <SectionTitle icon={<Waves className="w-5 h-5 text-emerald-400" />} title="장단기 금리차"
                                sub="한·미 같은 기준 10년−3년 국채금리 · 0 아래(역전)는 경기 둔화 신호 · 점선 = 미국 10년−3개월(참고) · 회색 = 미국 경기침체" />
                            <div className="flex items-center gap-2">
                                <SpreadBasisInfo />
                                <Toggle options={RANGE_OPTS} value={range} onChange={setRange} />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                            <div>
                                <SpreadChart rows={rows} recessions={data.recessions} />
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                                    <ShapeCard title="한국 곡선 (3년·10년)" shape={data.shapes.kr} />
                                    <ShapeCard title="미국 곡선 (3년·10년)" shape={data.shapes.us} />
                                </div>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <div className="flex items-center justify-between mb-1">
                                        <p className="text-sm font-bold text-gray-200">수익률곡선 — 지금 vs 1개월 전 vs 1년 전</p>
                                        <Toggle options={COUNTRY_OPTS} value={curveCountry} onChange={setCurveCountry} />
                                    </div>
                                    {data.curves[curveCountry] ? <CurveChart curve={data.curves[curveCountry]} /> : <p className="text-sm text-gray-500">데이터 없음</p>}
                                </div>
                                <InversionTable spreads={data.spreads} />
                            </div>
                        </div>
                    </section>

                    {data.terms && <TermSection terms={data.terms} rows={rows} range={range} setRange={setRange} />}

                    <section className="bg-black/20 rounded-2xl border border-white/5 p-4">
                        <SectionTitle icon={<History className="w-5 h-5 text-amber-400" />} title="한국 기준금리 국면 타임라인"
                            sub="2008년 이후 인상·인하·동결 이정표 — 번호를 누르면 배경이 아래에 나옵니다 · 값은 한국은행 ECOS 실제 변경 이력" />
                        <RegimeMilestones rows={baseRows} milestones={milestones} selected={selected} onSelect={setSelected}
                            seriesName="한국 기준금리" seriesColor="#6366f1" step yFormat={(v) => `${v.toFixed(2)}%`} />
                    </section>

                    <p className="flex items-start gap-1.5 text-[11px] text-gray-500 px-1">
                        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        출처: 한국은행 ECOS(기준금리·국고채·소비자물가), FRED(연준 정책금리·미국채·장단기 금리차·USREC·ECB·CPI).
                        최신 공표일 — 한국 기준금리·국고채 {dd.kr_base ?? '-'}, 미국채 {dd.us10y ?? '-'}, 한국 CPI {dd.kr_cpi?.slice(0, 7) ?? '-'}, 미국 CPI {dd.us_cpi?.slice(0, 7) ?? '-'}.
                        회의 일정은 한은·연준 공표 일정 기준이며, 시장 내재 기대는 국채 1년물로 계산한 근사치입니다. 투자 권유가 아닙니다.
                    </p>
                </>
            )}
        </div>
    );
}
