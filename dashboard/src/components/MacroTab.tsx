'use client';
// 시장동향 > 종합분석 하위 탭 — 환율·금리·주식을 묶은 국면 진단, 자산배분 근거, 과거 유사 국면, 자산 연결 지도, 3트랙 통합 타임라인, 이벤트 시나리오

import React, { useMemo, useState } from 'react';
import { ResponsiveContainer, ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend } from 'recharts';
import { Compass, RefreshCw, Sparkles, PieChart, History, Network, CalendarClock, Info, Plus, Minus, Circle } from 'lucide-react';
import { API_BASE } from '@/lib/apiConfig';
import { useCachedOverview } from '@/lib/useCachedOverview';
import ChartLoadingPlaceholder from './ChartLoadingPlaceholder';

type Seg = { start: string; end: string | null; kind: string; title: string; drivers: string[]; source?: string | null; summary: string };
type Outcome = Partial<Record<'kospi' | 'spx' | 'krw' | 'us10y_bp', number>>;
type Overview = {
    diagnosis: { headline: string; rows: { axis: string; status: string; tone: number }[] };
    allocation: { asset: string; score: number; label: string; reasons: { sign: number; text: string }[] }[];
    analogs: {
        now: Record<string, number>; labels: Record<string, [string, string]>;
        analogs: { date: string; similarity: number; features: Record<string, number>; after_6m: Outcome; after_12m: Outcome; context: Record<string, string | null> }[];
        average: { after_6m: Outcome; after_12m: Outcome };
    } | null;
    correlation: { assets: { key: string; label: string }[]; now: (number | null)[][]; long: (number | null)[][]; notable: { text: string; diff: number }[] } | null;
    timeline: { lanes: { key: string; label: string; segments: Seg[] }[]; series: { date: string; kospi: number | null; krw: number | null }[] };
    scenarios: Record<'bok' | 'fomc', { meeting: { date: string; d_day: number } | null; rate: number | null; implied: { label: string } | null;
        cases: { case: string; krw: string; kr_bond: string; kospi: string }[] }> & {
        note: string; events?: { date: string; d_day: number; name: string; note: string }[];
    };
    comment: { text: string | null; at: string | null };
    updated_at: string;
};

const TOOLTIP_STYLE = { background: '#1a1a23', border: '1px solid #ffffff20', borderRadius: 8, fontSize: 12 };
const axisTick = { fill: '#9ca3af', fontSize: 11 };
const L_W = 52, R_W = 56; // 통합 타임라인 좌·우 Y축 폭 — 아래 트랙을 플롯 영역과 맞춘다
const SEG_COLOR: Record<string, string> = {
    hike: '#ef4444', cut: '#3b82f6', hold: '#94a3b8', up: '#ef4444', down: '#10b981', range: '#94a3b8', bull: '#ef4444', bear: '#3b82f6',
};
const SEG_LABEL: Record<string, string> = {
    hike: '인상', cut: '인하', hold: '동결', up: '원화 약세', down: '원화 강세', range: '박스권', bull: '강세장', bear: '약세장',
};
const OUT_LABEL: Record<string, string> = { kospi: 'KOSPI', spx: 'S&P500', krw: '원/달러', us10y_bp: '미 10년물' };

const ts = (d: string) => Date.parse(d);
const signed = (v: number, d = 1, unit = '%') => `${v > 0 ? '+' : ''}${v.toFixed(d)}${unit}`;
const fmtOut = (k: string, v: number) => (k === 'us10y_bp' ? signed(v, 0, 'bp') : signed(v));
const toneCls = (t: number) => (t > 0 ? 'bg-red-400' : t < 0 ? 'bg-blue-400' : 'bg-gray-400');

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

function Diagnosis({ d }: { d: Overview }) {
    return (
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
            <div className="xl:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {d.diagnosis.rows.map(r => (
                    <div key={r.axis} className="flex items-start gap-2 rounded-xl bg-white/[0.03] border border-white/5 p-3">
                        <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${toneCls(r.tone)}`} />
                        <div>
                            <p className="text-[11px] font-bold text-gray-400">{r.axis}</p>
                            <p className="text-sm text-gray-100 leading-snug">{r.status}</p>
                        </div>
                    </div>
                ))}
            </div>
            <div className="xl:col-span-2 rounded-xl bg-indigo-500/10 border border-indigo-400/20 p-4">
                <p className="flex items-center gap-1.5 text-xs font-bold text-indigo-300 mb-2"><Sparkles className="w-3.5 h-3.5" />AI 종합 코멘트</p>
                <p className="text-sm text-gray-100 leading-relaxed">{d.comment.text ?? 'AI 코멘트를 준비하고 있습니다. 잠시 후 다시 열면 표시됩니다.'}</p>
                {d.comment.at && <p className="text-[10px] text-gray-500 mt-2">{new Date(d.comment.at).toLocaleString('ko-KR')} 작성 · 6시간마다 갱신 · 위 수치만 근거로 작성, 투자 권유 아님</p>}
            </div>
        </div>
    );
}

function Allocation({ d }: { d: Overview }) {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            {d.allocation.map(a => {
                const cls = a.score >= 2 ? 'text-red-300 border-red-400/30 bg-red-500/10' : a.score <= -2 ? 'text-blue-300 border-blue-400/30 bg-blue-500/10' : 'text-gray-200 border-white/15 bg-white/5';
                return (
                    <div key={a.asset} className="rounded-2xl bg-black/20 border border-white/5 p-4">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-extrabold text-white">{a.asset}</span>
                            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${cls}`}>{a.label} ({a.score > 0 ? '+' : ''}{a.score})</span>
                        </div>
                        <ul className="space-y-1.5">
                            {a.reasons.map(r => (
                                <li key={r.text} className="flex gap-1.5 text-[12px] text-gray-300 leading-snug">
                                    {r.sign > 0 ? <Plus className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" /> : r.sign < 0 ? <Minus className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" /> : <Circle className="w-3 h-3 text-gray-500 shrink-0 mt-0.5" />}
                                    {r.text}
                                </li>
                            ))}
                        </ul>
                    </div>
                );
            })}
        </div>
    );
}

function Analogs({ a }: { a: NonNullable<Overview['analogs']> }) {
    const outKeys = ['kospi', 'spx', 'krw', 'us10y_bp'];
    const cell = (o: Outcome, k: string) => {
        const v = o[k as keyof Outcome];
        return v == null ? <span className="text-gray-500">-</span> : <span className={v > 0 ? 'text-red-400' : v < 0 ? 'text-blue-400' : 'text-gray-300'}>{fmtOut(k, v)}</span>;
    };
    return (
        <div className="space-y-3">
            <div className="overflow-x-auto">
                <table className="w-full text-xs">
                    <thead><tr className="text-gray-500 border-b border-white/10">
                        <th className="text-left py-1.5 font-bold">유사 시점</th><th className="text-right font-bold">유사도</th><th className="text-left font-bold pl-3">그때 국면</th>
                        {outKeys.map(k => <th key={k} className="text-right font-bold">{OUT_LABEL[k]} 6개월 / 12개월</th>)}
                    </tr></thead>
                    <tbody>
                        {a.analogs.map(x => (
                            <tr key={x.date} className="border-b border-white/5 text-gray-200">
                                <td className="py-1.5 font-mono">{x.date.slice(0, 7)}</td>
                                <td className="text-right font-bold">{x.similarity}%</td>
                                <td className="pl-3 text-gray-400">{[x.context.rates, x.context.fx, x.context.kospi && `KOSPI ${x.context.kospi}`].filter(Boolean).join(' · ') || '-'}</td>
                                {outKeys.map(k => <td key={k} className="text-right">{cell(x.after_6m, k)} / {cell(x.after_12m, k)}</td>)}
                            </tr>
                        ))}
                        <tr className="text-gray-100 font-bold">
                            <td className="py-1.5">평균</td><td /><td />
                            {outKeys.map(k => <td key={k} className="text-right">{cell(a.average.after_6m, k)} / {cell(a.average.after_12m, k)}</td>)}
                        </tr>
                    </tbody>
                </table>
            </div>
            <div className="flex flex-wrap gap-1.5">
                {Object.entries(a.now).map(([k, v]) => (
                    <span key={k} className="text-[11px] text-gray-300 bg-white/5 border border-white/5 rounded-md px-2 py-0.5">
                        지금 {a.labels[k]?.[0] ?? k} <b className="text-gray-100">{v}{a.labels[k]?.[1] ?? ''}</b>
                    </span>
                ))}
            </div>
            <p className="text-[11px] text-gray-500">위 8개 지표(1년 변화·수준)를 표준화해 지금과 가장 가까운 과거 주를 찾았습니다(최근 2년 제외, 서로 6개월 이상 간격). 비슷한 모양이었다는 뜻일 뿐 같은 결과를 보장하지 않습니다.</p>
        </div>
    );
}

function Correlation({ c }: { c: NonNullable<Overview['correlation']> }) {
    const [mode, setMode] = useState<'now' | 'long'>('now');
    const m = c[mode];
    const color = (v: number | null) => v == null ? 'transparent' : v >= 0 ? `rgba(239,68,68,${Math.min(0.85, Math.abs(v))})` : `rgba(59,130,246,${Math.min(0.85, Math.abs(v))})`;
    return (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div>
                <div className="flex gap-1.5 mb-2">
                    {([['now', '최근 1년'], ['long', '10년']] as const).map(([k, l]) => (
                        <button key={k} onClick={() => setMode(k)} className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${mode === k ? 'bg-indigo-500/20 border-indigo-400/50 text-indigo-300' : 'bg-white/5 border-white/10 text-gray-400'}`}>{l}</button>
                    ))}
                </div>
                <div className="overflow-x-auto">
                    <table className="text-[11px]">
                        <thead><tr><th />{c.assets.map(a => <th key={a.key} className="px-1 py-1 text-gray-400 font-bold whitespace-nowrap">{a.label}</th>)}</tr></thead>
                        <tbody>
                            {c.assets.map((a, i) => (
                                <tr key={a.key}>
                                    <td className="pr-2 text-gray-400 font-bold whitespace-nowrap">{a.label}</td>
                                    {m[i].map((v, j) => (
                                        <td key={j} className="w-12 h-8 text-center text-gray-100 font-bold border border-white/5" style={{ backgroundColor: i === j ? 'transparent' : color(v) }}>
                                            {i === j ? '' : v?.toFixed(2)}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <p className="text-[10px] text-gray-500 mt-1">주간 변화 상관(지수·환율·VIX는 수익률, 금리는 변화폭) · 빨강 = 같이 움직임, 파랑 = 반대로 움직임</p>
            </div>
            <div>
                <p className="text-sm font-bold text-gray-200 mb-2">평소와 가장 달라진 연결</p>
                <ul className="space-y-2">
                    {c.notable.map(p => (
                        <li key={p.text} className="flex gap-2 text-[13px] text-gray-200 leading-snug">
                            <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-sky-400 shrink-0" />{p.text}
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}

// 3트랙 통합 타임라인: 위 차트(KOSPI·원/달러)와 같은 시간축 위에 금리·환율·KOSPI 국면 막대를 겹쳐 본다
function LaneTimeline({ t }: { t: Overview['timeline'] }) {
    const series = useMemo(() => t.series.map(r => ({ ...r, t: ts(r.date) })), [t]);
    const [sel, setSel] = useState<{ lane: number; seg: number } | null>(() => {
        const k = t.lanes.findIndex(l => l.key === 'kospi');
        return k >= 0 && t.lanes[k].segments.length ? { lane: k, seg: t.lanes[k].segments.length - 1 } : null;
    });
    const tMin = series[0]?.t ?? 0, tMax = series[series.length - 1]?.t ?? 1;
    const pct = (d: string) => Math.min(100, Math.max(0, ((ts(d) - tMin) / (tMax - tMin || 1)) * 100));
    const years = useMemo(() => {
        const out: number[] = [];
        const y0 = new Date(tMin).getUTCFullYear() + 1, y1 = new Date(tMax).getUTCFullYear();
        for (let y = y0; y <= y1; y += 2) out.push(Date.UTC(y, 0, 1));
        return out;
    }, [tMin, tMax]);
    const s = sel ? t.lanes[sel.lane]?.segments[sel.seg] : null;
    return (
        <div>
            <ResponsiveContainer width="100%" height={220}>
                <ComposedChart data={series} margin={{ top: 8, right: 0, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                    <XAxis dataKey="t" type="number" scale="time" domain={['dataMin', 'dataMax']} ticks={years} tickFormatter={(x: number) => String(new Date(x).getUTCFullYear())} tick={axisTick} />
                    <YAxis yAxisId="k" width={L_W} tick={axisTick} domain={['auto', 'auto']} />
                    <YAxis yAxisId="w" orientation="right" width={R_W} tick={axisTick} domain={['auto', 'auto']} />
                    <RechartsTooltip contentStyle={TOOLTIP_STYLE} labelFormatter={(x) => new Date(Number(x)).toISOString().slice(0, 10)} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line yAxisId="k" dataKey="kospi" name="KOSPI (좌)" stroke="#6366f1" dot={false} strokeWidth={1.8} connectNulls isAnimationActive={false} />
                    <Line yAxisId="w" dataKey="krw" name="원/달러 (우)" stroke="#f59e0b" dot={false} strokeWidth={1.4} connectNulls isAnimationActive={false} />
                </ComposedChart>
            </ResponsiveContainer>
            <div className="mt-2 space-y-1.5">
                {t.lanes.map((lane, li) => (
                    <div key={lane.key} className="flex items-center">
                        <span className="text-[10px] font-bold text-gray-400 shrink-0 text-right pr-1.5" style={{ width: L_W }}>{lane.label}</span>
                        <div className="relative h-5 flex-1 rounded bg-white/[0.03]" style={{ marginRight: R_W }}>
                            {lane.segments.map((g, si) => {
                                const left = pct(g.start), right = g.end ? pct(g.end) : 100;
                                const active = sel?.lane === li && sel.seg === si;
                                return (
                                    <button key={g.start + si} type="button" title={`${g.title} · ${g.summary}`} onClick={() => setSel({ lane: li, seg: si })}
                                        className={`absolute top-0 h-5 rounded-sm transition ${active ? 'ring-2 ring-white/80 z-10' : 'opacity-70 hover:opacity-100'}`}
                                        style={{ left: `${left}%`, width: `${Math.max(0.6, right - left)}%`, backgroundColor: SEG_COLOR[g.kind] ?? '#94a3b8' }} />
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
            {s && sel && (
                <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="text-[11px] font-bold text-gray-400">{t.lanes[sel.lane].label}</span>
                        <span className="text-xs font-mono text-gray-400">{s.start.slice(0, 7).replace('-', '.')} → {s.end ? s.end.slice(0, 7).replace('-', '.') : '현재'}</span>
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full border border-white/15" style={{ color: SEG_COLOR[s.kind] }}>{SEG_LABEL[s.kind] ?? s.kind}</span>
                        <span className="text-sm font-extrabold text-white">{s.title}</span>
                        <span className="text-xs font-bold text-gray-300 ml-auto">{s.summary}</span>
                    </div>
                    <ul className="mt-2 flex flex-wrap gap-1.5">
                        {s.drivers.map(x => <li key={x} className="text-[11px] text-gray-300 bg-white/5 border border-white/5 rounded-md px-2 py-0.5">{x}</li>)}
                    </ul>
                    {s.source && <p className="text-[10px] text-gray-500 mt-1.5">출처: {s.source}</p>}
                </div>
            )}
        </div>
    );
}

function Scenarios({ sc }: { sc: Overview['scenarios'] }) {
    return (
        <div>
            {sc.events?.map(e => (
                <div key={e.date} className="flex flex-wrap items-baseline gap-2 mb-3 rounded-xl bg-amber-500/10 border border-amber-400/25 px-3 py-2">
                    <span className="text-sm font-extrabold text-amber-200">{e.name}</span>
                    <span className="text-xs font-bold text-gray-300">{e.date} (D-{e.d_day})</span>
                    <span className="text-xs text-gray-400">{e.note} · 이후 국면 변화를 이 화면에서 점검</span>
                </div>
            ))}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                {(['bok', 'fomc'] as const).map(k => {
                    const x = sc[k];
                    return (
                        <div key={k} className="rounded-xl bg-white/[0.03] border border-white/5 p-3">
                            <p className="text-sm font-extrabold text-white">{k === 'bok' ? '한국은행 금통위' : '미국 FOMC'}
                                <span className="text-xs font-bold text-gray-400 ml-2">{x.meeting ? `${x.meeting.date} (D-${x.meeting.d_day})` : '일정 갱신 필요'} · 현재 {x.rate?.toFixed(2)}%</span></p>
                            <p className="text-xs text-gray-400 mt-1">시장 반영: {x.implied?.label ?? '-'}</p>
                            <table className="w-full text-xs mt-2">
                                <thead><tr className="text-gray-500 border-b border-white/10"><th className="text-left py-1 font-bold">결과</th><th className="text-left font-bold">원/달러</th><th className="text-left font-bold">국내 채권금리</th><th className="text-left font-bold">KOSPI</th></tr></thead>
                                <tbody>
                                    {x.cases.map(c => (
                                        <tr key={c.case} className="border-b border-white/5 text-gray-300"><td className="py-1 font-bold text-gray-100">{c.case}</td><td>{c.krw}</td><td>{c.kr_bond}</td><td>{c.kospi}</td></tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    );
                })}
            </div>
            <p className="text-[11px] text-gray-500 mt-2">{sc.note}</p>
        </div>
    );
}

export default function MacroTab() {
    const { data, refreshing, error, refresh } = useCachedOverview<Overview>('iprism-macro-v2', `${API_BASE}/api/v1/macro/overview`);
    return (
        <div className="w-full max-w-[95vw] xl:max-w-[1400px] mx-auto space-y-4 pb-10">
            <section className="bg-black/20 rounded-2xl border border-white/5 p-4 md:p-5">
                <div className="flex flex-wrap items-center gap-3 mb-4">
                    <Compass className="w-6 h-6 text-indigo-400" />
                    <div>
                        <h2 className="text-xl font-extrabold text-white leading-none">환율·금리·주식 종합분석</h2>
                        <p className="text-xs text-gray-500 mt-1">세 탭의 최신 데이터를 묶어 지금 국면과 자산별 근거를 한눈에 — 기준 시각이 1시간 지나면 자동 갱신</p>
                    </div>
                    {data && <span className="text-sm font-extrabold px-3 py-1 rounded-full border border-indigo-400/40 bg-indigo-500/15 text-indigo-200">{data.diagnosis.headline}</span>}
                    <div className="ml-auto flex items-center gap-2 text-[11px] text-gray-500">
                        {data && <span>{new Date(data.updated_at).toLocaleString('ko-KR')} 기준{refreshing ? ' · 최신 데이터 확인 중…' : ''}</span>}
                        <button onClick={refresh} disabled={refreshing}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 disabled:opacity-50">
                            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />업데이트
                        </button>
                    </div>
                </div>
                {error && !data && <p className="text-sm text-red-400">종합분석 데이터를 불러오지 못했습니다 ({error}). 서버가 깨어나는 중이면 잠시 후 업데이트를 눌러 주세요.</p>}
                {!data && !error && <ChartLoadingPlaceholder height={140} message="종합분석 준비 중" subMessage="환율·금리·주식 데이터를 모아 계산합니다" />}
                {data && <Diagnosis d={data} />}
            </section>

            {data && (
                <>
                    <section className="bg-black/20 rounded-2xl border border-white/5 p-4">
                        <SectionTitle icon={<PieChart className="w-5 h-5 text-amber-400" />} title="자산별 근거" sub="데이터 규칙으로 모은 비중 확대(+)·축소(−) 근거 — 점수는 근거 개수의 합이며 투자 권유가 아닙니다" />
                        <Allocation d={data} />
                    </section>

                    <section className="bg-black/20 rounded-2xl border border-white/5 p-4">
                        <SectionTitle icon={<History className="w-5 h-5 text-indigo-400" />} title="통합 타임라인" sub="한국 기준금리·원/달러·KOSPI 국면을 같은 시간축에 — 막대를 누르면 그 국면의 배경이 아래에 나옵니다" />
                        <LaneTimeline t={data.timeline} />
                    </section>

                    {data.analogs && (
                        <section className="bg-black/20 rounded-2xl border border-white/5 p-4">
                            <SectionTitle icon={<Compass className="w-5 h-5 text-emerald-400" />} title="과거 유사 국면" sub="지금과 지표 조합이 가장 비슷했던 과거 시점과 그 뒤 6·12개월 동안의 움직임" />
                            <Analogs a={data.analogs} />
                        </section>
                    )}

                    {data.correlation && (
                        <section className="bg-black/20 rounded-2xl border border-white/5 p-4">
                            <SectionTitle icon={<Network className="w-5 h-5 text-sky-400" />} title="자산 연결 지도" sub="최근 1년과 10년의 상관을 비교해 평소와 달라진 연결을 찾습니다" />
                            <Correlation c={data.correlation} />
                        </section>
                    )}

                    <section className="bg-black/20 rounded-2xl border border-white/5 p-4">
                        <SectionTitle icon={<CalendarClock className="w-5 h-5 text-purple-400" />} title="다가오는 이벤트 시나리오" sub="다음 금통위·FOMC·주요 이벤트와 결과별로 흔히 나타나는 시장 반응" />
                        <Scenarios sc={data.scenarios} />
                    </section>

                    <p className="flex items-start gap-1.5 text-[11px] text-gray-500 px-1">
                        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        환율·금리·주식 탭과 같은 데이터(FRED·한국은행 ECOS·Yahoo·multpl)를 결합한 참고 분석입니다. 유사 국면은 패턴 비교일 뿐 예측이 아니며, 자산별 근거와 AI 코멘트는 투자 권유가 아닙니다.
                    </p>
                </>
            )}
        </div>
    );
}
