'use client';
// 시장동향 > 주식 하위 탭 — KOSPI·S&P500·Nasdaq 20년 성과·낙폭, KOSPI 달러 환산, S&P 밸류에이션·위험 프리미엄, 강세장·약세장 이정표

import React, { useMemo, useState } from 'react';
import {
    ResponsiveContainer, ComposedChart, LineChart, Line, XAxis, YAxis, CartesianGrid,
    Tooltip as RechartsTooltip, Legend, ReferenceLine,
} from 'recharts';
import { BarChart3, RefreshCw, TrendingDown, Gauge, Link2, History, Info, Scale, DollarSign } from 'lucide-react';
import { API_BASE } from '@/lib/apiConfig';
import { useCachedOverview } from '@/lib/useCachedOverview';
import ChartLoadingPlaceholder from './ChartLoadingPlaceholder';
import RegimeMilestones, { type Milestone } from './RegimeMilestones';

type IdxKey = 'kospi' | 'spx' | 'ndx';
type Card = {
    value: number; date: string; chg_1w: number | null; chg_1m: number | null; chg_1y: number | null; ytd: number | null;
    drawdown: number; ath: number; ath_date: string; w52_low: number; w52_high: number; w52_pos: number | null;
    cagr10: number | null; cagr20: number | null;
};
type Packed = { value: number; date: string; avg20y: number; pct20y: number } | null;
type Regime = {
    start: string; end: string | null; kind: 'bull' | 'bear'; title: string; drivers: string[]; source: string | null;
    from: number; to: number; chg_pct: number; weeks: number;
};
type Row = {
    date: string; kospi?: number | null; spx?: number | null; ndx?: number | null; kospi_usd?: number | null;
    dd_kospi?: number | null; dd_spx?: number | null; dd_ndx?: number | null; corr_ks?: number | null;
};
type Overview = {
    cards: Partial<Record<IdxKey, Card>> & { kospi_usd?: { value: number; chg_1y: number | null; ytd: number | null; drawdown: number } };
    corr_ks: number | null; weekly: Row[];
    valuation: { pe: Packed; cape: Packed; ey: Packed; erp: Packed; us10: number | null; rows: { date: string; pe: number | null; cape: number | null; erp: number | null }[] } | null;
    regimes: Partial<Record<IdxKey, Regime[]>>; data_dates: Record<string, string>; updated_at: string; stale?: boolean;
};

const NAME: Record<IdxKey, string> = { kospi: 'KOSPI', spx: 'S&P500', ndx: 'Nasdaq' };
const COLOR: Record<IdxKey, string> = { kospi: '#6366f1', spx: '#f43f5e', ndx: '#10b981' };
const RANGES = ['5Y', '10Y', '20Y'] as const;
type Range = typeof RANGES[number];
const TOOLTIP_STYLE = { background: '#1a1a23', border: '1px solid #ffffff20', borderRadius: 8, fontSize: 12 };
const axisTick = { fill: '#9ca3af', fontSize: 11 };
const KIND = {
    bull: { label: '강세장 ↑', fill: '#ef4444', badge: 'bg-red-500/15 text-red-300 border-red-400/30' },
    bear: { label: '약세장 ↓', fill: '#3b82f6', badge: 'bg-blue-500/15 text-blue-300 border-blue-400/30' },
};

const ts = (d: string) => Date.parse(d);
const fmtDate = (t: number) => new Date(t).toISOString().slice(0, 10);
const yearTick = (t: number) => String(new Date(t).getUTCFullYear());
// 1월 1일 고정 눈금(자동 눈금은 같은 연도가 두 번 찍힌다). 기간이 길면 2년 간격
function yearTicks(rows: { t: number }[]): number[] {
    if (rows.length < 2) return [];
    const y0 = new Date(rows[0].t).getUTCFullYear() + 1, y1 = new Date(rows[rows.length - 1].t).getUTCFullYear();
    const step = y1 - y0 > 12 ? 2 : 1;
    const out: number[] = [];
    for (let y = y0; y <= y1; y += step) out.push(Date.UTC(y, 0, 1));
    return out;
}
const num = (v: number | null | undefined, d = 0) => (v == null ? '-' : v.toLocaleString('ko-KR', { minimumFractionDigits: d, maximumFractionDigits: d }));
const signed = (v: number, d = 1, unit = '%') => `${v > 0 ? '+' : ''}${v.toFixed(d)}${unit}`;

// 국내 관례: 오르면 빨강, 내리면 파랑
function Chg({ v, label }: { v: number | null | undefined; label: string }) {
    if (v == null) return <span className="text-gray-500">{label} -</span>;
    return <span className={v > 0 ? 'text-red-400' : v < 0 ? 'text-blue-400' : 'text-gray-400'}>{label} {signed(v)}</span>;
}

function Box({ icon, title, children, foot }: { icon: React.ReactNode; title: string; children: React.ReactNode; foot?: string }) {
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
const IDX_OPTS = (['kospi', 'spx', 'ndx'] as IdxKey[]).map(k => ({ id: k, label: NAME[k] }));

function IndexCard({ k, c }: { k: IdxKey; c?: Card }) {
    return (
        <Box icon={<span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLOR[k] }} />} title={NAME[k]}
            foot={c ? `${c.date} 기준 · 연평균 10년 ${c.cagr10 != null ? signed(c.cagr10) : '-'} / 20년 ${c.cagr20 != null ? signed(c.cagr20) : '-'}` : undefined}>
            {c ? <>
                <div className="text-2xl font-extrabold text-white">{num(c.value, 2)}</div>
                <div className="flex flex-wrap gap-x-2 text-xs font-bold mt-1">
                    <Chg v={c.chg_1w} label="1주" /><Chg v={c.chg_1m} label="1개월" /><Chg v={c.ytd} label="연초 이후" /><Chg v={c.chg_1y} label="1년" />
                </div>
                <p className={`text-xs font-bold mt-1.5 ${c.drawdown <= -20 ? 'text-blue-400' : c.drawdown <= -10 ? 'text-amber-400' : 'text-gray-300'}`}>
                    고점 대비 {c.drawdown.toFixed(1)}% <span className="font-medium text-gray-500">(고점 {num(c.ath, 0)} · {c.ath_date})</span>
                </p>
                {c.w52_pos != null && (
                    <div className="mt-2">
                        <div className="flex justify-between text-[10px] text-gray-500 mb-0.5"><span>{num(c.w52_low, 0)}</span><span className="font-bold text-gray-300">52주 범위 {c.w52_pos}%</span><span>{num(c.w52_high, 0)}</span></div>
                        <div className="relative h-1.5 rounded-full bg-gradient-to-r from-blue-500/40 via-gray-500/30 to-red-500/50">
                            <div className="absolute -top-0.5 w-2.5 h-2.5 rounded-full bg-white border-2 border-indigo-400" style={{ left: `calc(${c.w52_pos}% - 5px)` }} />
                        </div>
                    </div>
                )}
            </> : <p className="text-sm text-gray-500">데이터 없음</p>}
        </Box>
    );
}

function CardsGrid({ d }: { d: Overview }) {
    const v = d.valuation;
    const ku = d.cards.kospi_usd;
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            {(['kospi', 'spx', 'ndx'] as IdxKey[]).map(k => <IndexCard key={k} k={k} c={d.cards[k]} />)}
            <Box icon={<DollarSign className="w-3.5 h-3.5 text-indigo-400" />} title="KOSPI 달러 환산" foot="KOSPI ÷ 원/달러 × 1000 · 외국인 투자자가 체감하는 성과">
                {ku ? <>
                    <div className="text-2xl font-extrabold text-white">{num(ku.value, 0)}</div>
                    <div className="flex flex-wrap gap-x-2 text-xs font-bold mt-1"><Chg v={ku.ytd} label="연초 이후" /><Chg v={ku.chg_1y} label="1년" /></div>
                    <p className="text-xs text-gray-400 mt-1.5">고점 대비 {ku.drawdown.toFixed(1)}%
                        {d.cards.kospi && <span className="text-gray-500"> (원화 기준 {d.cards.kospi.drawdown.toFixed(1)}%)</span>}</p>
                </> : <p className="text-sm text-gray-500">데이터 없음</p>}
            </Box>
            <Box icon={<Scale className="w-3.5 h-3.5 text-amber-400" />} title="S&P500 밸류에이션" foot="multpl.com 월간 · 백분위는 최근 20년 중 위치(높을수록 비쌈)">
                {v?.pe ? (['pe', 'cape'] as const).map(k => v[k] && (
                    <div key={k} className="flex items-baseline justify-between gap-2 py-0.5">
                        <span className="text-xs text-gray-400">{k === 'pe' ? 'PER' : 'Shiller CAPE'}</span>
                        <span className="text-lg font-extrabold text-white">{v[k]!.value.toFixed(1)}</span>
                        <span className={`text-[11px] font-bold ${v[k]!.pct20y >= 80 ? 'text-red-400' : v[k]!.pct20y <= 20 ? 'text-blue-400' : 'text-gray-300'}`}>20년 중 {v[k]!.pct20y}%</span>
                    </div>
                )) : <p className="text-sm text-gray-500">데이터 없음</p>}
            </Box>
            <Box icon={<Gauge className="w-3.5 h-3.5 text-rose-400" />} title="주식 위험 프리미엄 (S&P500)"
                foot={v?.erp ? `이익수익률 ${v.ey?.value}% − 미 10년물 ${v.us10}% · 20년 평균 ${signed(v.erp.avg20y, 2, '%p')}` : undefined}>
                {v?.erp ? <>
                    <div className={`text-2xl font-extrabold ${v.erp.value < 0 ? 'text-blue-400' : 'text-white'}`}>{signed(v.erp.value, 2, '%p')}</div>
                    <p className="text-xs text-gray-400 mt-1">20년 중 하위 {v.erp.pct20y}%</p>
                    <p className="text-xs text-gray-300 mt-1">{v.erp.value < 0 ? '국채 금리가 주식 이익수익률보다 높습니다 — 채권 대비 주식의 매력이 낮은 구간' : '주식 이익수익률이 국채 금리보다 높습니다'}</p>
                </> : <p className="text-sm text-gray-500">데이터 없음</p>}
            </Box>
            <Box icon={<Link2 className="w-3.5 h-3.5 text-sky-400" />} title="KOSPI–S&P500 동조성" foot="52주 롤링 상관 · 주간 수익률 기준">
                {d.corr_ks != null ? <>
                    <div className="text-2xl font-extrabold text-white">{signed(d.corr_ks, 2, '')}</div>
                    <p className="text-xs text-gray-400 mt-1">{d.corr_ks >= 0.6 ? '강한 동조 — 미국 증시 영향이 큼' : d.corr_ks >= 0.3 ? '보통 동조' : '약한 동조 — 국내 요인이 더 크게 작용'}</p>
                </> : <p className="text-sm text-gray-500">데이터 없음</p>}
            </Box>
        </div>
    );
}

function RelativeChart({ rows, usd }: { rows: (Row & { t: number })[]; usd: boolean }) {
    // 보이는 구간 첫 값을 100으로
    const data = useMemo(() => {
        const keys = ['kospi', 'spx', 'ndx', 'kospi_usd'] as const;
        const base: Record<string, number | null> = {};
        keys.forEach(k => { base[k] = rows.find(r => r[k] != null)?.[k] ?? null; });
        return rows.map(r => {
            const o: Record<string, number | null> = { t: r.t };
            keys.forEach(k => { const v = r[k]; o[k] = v != null && base[k] ? +(v / (base[k] as number) * 100).toFixed(1) : null; });
            return o;
        });
    }, [rows]);
    return (
        <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <ReferenceLine y={100} stroke="#ffffff30" />
                <XAxis dataKey="t" type="number" scale="time" domain={['dataMin', 'dataMax']} ticks={yearTicks(rows)} tickFormatter={yearTick} tick={axisTick} />
                <YAxis tick={axisTick} width={44} domain={['auto', 'auto']} />
                <RechartsTooltip contentStyle={TOOLTIP_STYLE} labelFormatter={(t) => fmtDate(Number(t))} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line dataKey={usd ? 'kospi_usd' : 'kospi'} name={usd ? 'KOSPI (달러 환산)' : 'KOSPI'} stroke={COLOR.kospi} dot={false} strokeWidth={2} connectNulls isAnimationActive={false} />
                <Line dataKey="spx" name="S&P500" stroke={COLOR.spx} dot={false} strokeWidth={1.6} connectNulls isAnimationActive={false} />
                <Line dataKey="ndx" name="Nasdaq" stroke={COLOR.ndx} dot={false} strokeWidth={1.6} connectNulls isAnimationActive={false} />
            </LineChart>
        </ResponsiveContainer>
    );
}

function DrawdownChart({ rows }: { rows: (Row & { t: number })[] }) {
    return (
        <ResponsiveContainer width="100%" height={300}>
            <LineChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <ReferenceLine y={-20} stroke="#f59e0b" strokeDasharray="4 4" />
                <XAxis dataKey="t" type="number" scale="time" domain={['dataMin', 'dataMax']} ticks={yearTicks(rows)} tickFormatter={yearTick} tick={axisTick} />
                <YAxis tick={axisTick} width={44} tickFormatter={(v: number) => `${v}%`} />
                <RechartsTooltip contentStyle={TOOLTIP_STYLE} labelFormatter={(t) => fmtDate(Number(t))} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {(['kospi', 'spx', 'ndx'] as IdxKey[]).map(k => (
                    <Line key={k} dataKey={`dd_${k}`} name={NAME[k]} stroke={COLOR[k]} dot={false} strokeWidth={k === 'kospi' ? 2 : 1.5} connectNulls isAnimationActive={false} />
                ))}
            </LineChart>
        </ResponsiveContainer>
    );
}

function ValuationChart({ v }: { v: NonNullable<Overview['valuation']> }) {
    const data = useMemo(() => v.rows.map(r => ({ ...r, t: ts(`${r.date}-01`) })), [v]);
    return (
        <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis dataKey="t" type="number" scale="time" domain={['dataMin', 'dataMax']} ticks={yearTicks(data)} tickFormatter={yearTick} tick={axisTick} />
                {/* 2009년 PER은 이익 급감으로 120 넘게 치솟아 축을 망가뜨리므로 60에서 자른다(툴팁에는 실제 값) */}
                <YAxis yAxisId="x" tick={axisTick} width={40} domain={[0, 60]} allowDataOverflow />
                <YAxis yAxisId="erp" orientation="right" tick={axisTick} width={44} tickFormatter={(x: number) => `${x}%p`} />
                <ReferenceLine yAxisId="erp" y={0} stroke="#f59e0b" strokeDasharray="4 4" />
                <RechartsTooltip contentStyle={TOOLTIP_STYLE} labelFormatter={(t) => fmtDate(Number(t)).slice(0, 7)} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line yAxisId="x" dataKey="pe" name="PER (좌)" stroke="#f59e0b" dot={false} strokeWidth={1.5} connectNulls isAnimationActive={false} />
                <Line yAxisId="x" dataKey="cape" name="Shiller CAPE (좌)" stroke="#f43f5e" dot={false} strokeWidth={1.8} connectNulls isAnimationActive={false} />
                <Line yAxisId="erp" dataKey="erp" name="위험 프리미엄 (우, %p)" stroke="#38bdf8" dot={false} strokeWidth={1.8} connectNulls isAnimationActive={false} />
            </ComposedChart>
        </ResponsiveContainer>
    );
}

export default function StocksTab() {
    // 재진입 시 캐시를 즉시 그리고, 서버 기준 시각이 1시간 넘었을 때만 백그라운드 갱신
    const { data, refreshing, error, refresh } = useCachedOverview<Overview>('iprism-stocks-v1', `${API_BASE}/api/v1/stocks/overview`);
    const [range, setRange] = useState<Range>('20Y');
    const [usd, setUsd] = useState<'krw' | 'usd'>('krw');
    const [idx, setIdx] = useState<IdxKey>('kospi');
    const [selected, setSelected] = useState<number | null>(null);

    const all = useMemo(() => (data?.weekly ?? []).map(r => ({ ...r, t: ts(r.date) })), [data]);
    const rows = useMemo(() => {
        if (range === '20Y' || all.length === 0) return all;
        const cut = new Date(all[all.length - 1].t);
        cut.setFullYear(cut.getFullYear() - (range === '10Y' ? 10 : 5));
        return all.filter(r => r.t >= cut.getTime());
    }, [all, range]);

    const idxRows = useMemo(() => all.map(r => ({ t: r.t, v: r[idx] ?? null })), [all, idx]);
    const milestones = useMemo<Milestone[]>(() => (data?.regimes[idx] ?? []).map(g => ({
        start: g.start, end: g.end, title: g.title, drivers: g.drivers, source: g.source,
        color: KIND[g.kind].fill, badge: { label: KIND[g.kind].label, cls: KIND[g.kind].badge },
        summary: <>{num(g.from, 0)} → {num(g.to, 0)} <span className={g.chg_pct > 0 ? 'text-red-400' : 'text-blue-400'}>({signed(g.chg_pct)} · {g.weeks}주)</span></>,
    })), [data, idx]);

    const phase = (['kospi', 'spx', 'ndx'] as IdxKey[]).map(k => {
        const last = data?.regimes[k]?.slice(-1)[0];
        const c = data?.cards[k];
        return last && c ? { k, text: `${NAME[k]} ${last.kind === 'bull' ? '강세장' : '약세장'}${c.drawdown < -1 ? ` · 고점 ${c.drawdown.toFixed(1)}%` : ' · 사상 최고 부근'}`, kind: last.kind } : null;
    }).filter(Boolean) as { k: IdxKey; text: string; kind: 'bull' | 'bear' }[];
    const dd = data?.data_dates ?? {};

    return (
        <div className="w-full max-w-[95vw] xl:max-w-[1400px] mx-auto space-y-4 pb-10">
            <section className="bg-black/20 rounded-2xl border border-white/5 p-4 md:p-5">
                <div className="flex flex-wrap items-center gap-3 mb-4">
                    <BarChart3 className="w-6 h-6 text-indigo-400" />
                    <div>
                        <h2 className="text-xl font-extrabold text-white leading-none">주식 대시보드</h2>
                        <p className="text-xs text-gray-500 mt-1">KOSPI · S&P500 · Nasdaq 20년 흐름 — 기준 시각이 1시간 지나면 자동 갱신</p>
                    </div>
                    {phase.map(p => (
                        <span key={p.k} className={`text-xs font-bold px-3 py-1 rounded-full border ${KIND[p.kind].badge}`}>{p.text}</span>
                    ))}
                    <div className="ml-auto flex items-center gap-2 text-[11px] text-gray-500">
                        {data && <span>{data.stale ? '⚠ 최신 수집 실패 · 이전 값 · ' : ''}{new Date(data.updated_at).toLocaleString('ko-KR')} 기준{refreshing ? ' · 최신 데이터 확인 중…' : ''}</span>}
                        <button onClick={refresh} disabled={refreshing}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 disabled:opacity-50">
                            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />업데이트
                        </button>
                    </div>
                </div>
                {error && !data && <p className="text-sm text-red-400">주식 데이터를 불러오지 못했습니다 ({error}). 서버가 깨어나는 중이면 잠시 후 업데이트를 눌러 주세요.</p>}
                {!data && !error && <ChartLoadingPlaceholder height={140} message="주식 데이터 수집 중" subMessage="Yahoo·FRED·multpl 20년 시계열 — 첫 로드는 수십 초 걸릴 수 있습니다" />}
                {data && <CardsGrid d={data} />}
            </section>

            {data && (
                <>
                    <section className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                        <div className="bg-black/20 rounded-2xl border border-white/5 p-4">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                                <SectionTitle icon={<BarChart3 className="w-5 h-5 text-indigo-400" />} title="상대 성과" sub="구간 시작 = 100 · KOSPI는 원화/달러 기준 전환" />
                                <div className="flex gap-2">
                                    <Toggle options={[{ id: 'krw', label: '원화' }, { id: 'usd', label: '달러' }] as const} value={usd} onChange={setUsd} />
                                    <Toggle options={RANGE_OPTS} value={range} onChange={setRange} />
                                </div>
                            </div>
                            <RelativeChart rows={rows} usd={usd === 'usd'} />
                        </div>
                        <div className="bg-black/20 rounded-2xl border border-white/5 p-4">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                                <SectionTitle icon={<TrendingDown className="w-5 h-5 text-blue-400" />} title="고점 대비 낙폭" sub="각 지수의 직전 최고치 대비 하락률 · 점선 −20% = 약세장 기준" />
                                <Toggle options={RANGE_OPTS} value={range} onChange={setRange} />
                            </div>
                            <DrawdownChart rows={rows} />
                        </div>
                    </section>

                    {data.valuation && (
                        <section className="bg-black/20 rounded-2xl border border-white/5 p-4">
                            <SectionTitle icon={<Scale className="w-5 h-5 text-amber-400" />} title="S&P500 밸류에이션과 위험 프리미엄"
                                sub="PER·Shiller CAPE(좌, 60에서 자름 — 2009년 PER은 이익 급감으로 120대)와 위험 프리미엄 = 이익수익률 − 미 10년물(우) · 0 아래면 국채가 주식보다 많이 준다" />
                            <ValuationChart v={data.valuation} />
                        </section>
                    )}

                    <section className="bg-black/20 rounded-2xl border border-white/5 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                            <SectionTitle icon={<History className="w-5 h-5 text-amber-400" />} title="강세장·약세장 타임라인"
                                sub="고점에서 20% 하락 = 약세장, 저점에서 20% 상승 = 강세장(주간 종가) · 번호를 누르면 배경이 아래에 나옵니다" />
                            <Toggle options={IDX_OPTS} value={idx} onChange={(k) => { setIdx(k); setSelected(null); }} />
                        </div>
                        <RegimeMilestones rows={idxRows} milestones={milestones} selected={selected} onSelect={setSelected}
                            seriesName={NAME[idx]} seriesColor={COLOR[idx]} yFormat={(v) => v.toLocaleString('ko-KR', { maximumFractionDigits: 0 })} />
                    </section>

                    <p className="flex items-start gap-1.5 text-[11px] text-gray-500 px-1">
                        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        출처: Yahoo Finance(^KS11·^GSPC·^IXIC 주간), FRED(원/달러 DEXKOUS·미 10년 DGS10), multpl.com(S&P500 PER·CAPE·이익수익률).
                        최신 — KOSPI {dd.kospi ?? '-'}, S&P500 {dd.spx ?? '-'}, 밸류에이션 {dd.pe?.slice(0, 7) ?? '-'}.
                        KOSPI PER은 무료 이력 데이터가 없어 제외했습니다. 단기 과열·출구 신호는 시장 개요의 &lsquo;코스피 출구 전략 모니터링&rsquo;을 참고하세요. 투자 권유가 아닙니다.
                    </p>
                </>
            )}
        </div>
    );
}
