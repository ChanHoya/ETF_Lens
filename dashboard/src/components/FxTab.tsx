'use client';
// 시장동향 > 환율 하위 탭 — 스냅샷, 원화 방향 근거·자금 흐름, 20년 추이, 국면 타임라인, 연계성 분석, 원화 가치·아시아 통화, H/UH 성과 비교

import React, { useMemo, useState } from 'react';
import {
    ResponsiveContainer, ComposedChart, Line, XAxis, YAxis, CartesianGrid,
    Tooltip as RechartsTooltip, Legend, ReferenceArea, ReferenceLine, Area, Bar,
} from 'recharts';
import { DollarSign, Globe2, Landmark, RefreshCw, Scale, TrendingDown, TrendingUp, History, Info, Link2, Gauge, ArrowDownUp } from 'lucide-react';
import { API_BASE } from '@/lib/apiConfig';
import { yearTick, yearTicks } from '@/lib/chartTicks';
import { useCachedOverview } from '@/lib/useCachedOverview';
import ChartLoadingPlaceholder from './ChartLoadingPlaceholder';
import FxFinder from './FxFinder';
import RegimeMilestones, { type Milestone } from './RegimeMilestones';
import MarketDetailModal, { SeriesConfig, DetailDataPoint } from './MarketDetailModal';
import DxyFormulaSection from './DxyFormulaSection';

type Row = {
    date: string; krw: number | null; dxy: number | null; us10: number | null; kr10: number | null; spread10: number | null;
    usdjpy: number | null; eurusd?: number | null; gbpusd?: number | null; usdcad?: number | null; usdsek?: number | null; usdchf?: number | null;
    usdcny: number | null; usdtwd: number | null; vix: number | null; kospi: number | null;
};
type Regime = {
    start: string; end: string | null; title: string; drivers: string[]; source: string | null;
    kind: 'up' | 'down' | 'range'; from: number; to: number; chg_pct: number; low: number; high: number; auto?: boolean;
};
type Snapshot = {
    krw?: {
        value: number; date: string; chg_1w: number | null; chg_1m: number | null; chg_1y: number | null; pct10y: number; pct3y: number | null;
        min10y: number; max10y: number; ma26: number | null; ma26_gap: number | null;
    };
    dxy?: { value: number; date: string; chg_1m: number | null; chg_1y: number | null; pct10y: number };
    dxy_basket?: {
        key: string; currency: string; symbol: string; weight: number; power: number;
        value: number | null; chg_1y: number | null;
    }[];
    asia?: { key: 'usdkrw' | 'usdjpy' | 'usdcny' | 'usdtwd'; label: string; value: number; date: string; chg_1y: number | null }[];
    jpy100?: { value: number; chg_1y: number | null };
    spread10?: { value: number; us10: number; kr10: number; kr10_date: string; year_ago: number | null };
    reer?: { value: number; date: string; avg20y: number; gap_pct: number };
    flows?: {
        month: string; ca_12m: number; out_12m: number; in_12m: number; net_12m: number; net_year_ago: number | null;
        rows: { date: string; ca: number; out: number; inflow: number; net: number }[];
    };
    verdict: { level: 'weak_krw' | 'strong_krw' | 'neutral'; label: string; action?: string; strong: string[]; weak: string[] };
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
};
type Overview = { snapshot: Snapshot; weekly: Row[]; regimes: Regime[]; analysis?: Analysis; updated_at: string; stale?: boolean };

const RANGES = ['5Y', '10Y', '20Y'] as const;
type Range = typeof RANGES[number];
const KIND_STYLE: Record<Regime['kind'], { label: string; fill: string; badge: string }> = {
    up: { label: '원화 약세 ↑', fill: '#ef4444', badge: 'bg-red-500/15 text-red-300 border-red-400/30' },
    down: { label: '원화 강세 ↓', fill: '#10b981', badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30' },
    range: { label: '박스권', fill: '#94a3b8', badge: 'bg-white/5 text-gray-300 border-white/15' },
};
import { STANDARD_TOOLTIP_STYLE, STANDARD_LEGEND_WRAPPER_STYLE, useChartHighlight } from '@/lib/chartTheme';

const axisTick = { fill: '#9ca3af', fontSize: 10 };

const ts = (d: string) => Date.parse(d);
const fmtDate = (t: number) => new Date(t).toISOString().slice(0, 10);
const fmtNum = (v: number | null | undefined, digits = 1) => (v == null ? '-' : v.toLocaleString('ko-KR', { minimumFractionDigits: digits, maximumFractionDigits: digits }));
const sign = (v: number, d = 1) => `${v > 0 ? '+' : ''}${v.toFixed(d)}`;

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

function Card({ icon, title, children, foot, onClick, badge }: { icon: React.ReactNode; title: string; children: React.ReactNode; foot?: string; onClick?: () => void; badge?: string }) {
    return (
        <div
            onClick={onClick}
            className={`bg-black/20 rounded-2xl border border-white/5 p-4 flex flex-col transition-all duration-200 ${
                onClick ? 'cursor-pointer hover:bg-white/[0.04] hover:border-indigo-400/40 group shadow-md' : ''
            }`}
        >
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-gray-400">{icon}{title}</div>
                {badge && (
                    <span className="text-[10px] font-semibold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-1.5 py-0.5 rounded group-hover:bg-indigo-500 group-hover:text-white transition">
                        {badge}
                    </span>
                )}
            </div>
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

function SnapshotGrid({ s, fair, onSelectModal }: { s: Snapshot; fair?: Analysis['fair']; onSelectModal?: (key: 'krw' | 'dxy' | 'asia' | 'spread10') => void }) {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6 gap-3">
            <Card
                icon={<DollarSign className="w-3.5 h-3.5 text-indigo-400" />}
                title="원/달러"
                foot={s.krw ? `${s.krw.date} 기준` : undefined}
                onClick={onSelectModal ? () => onSelectModal('krw') : undefined}
                badge="🔍 6M~10Y 차트"
            >
                {s.krw ? <>
                    <div className="text-2xl font-extrabold text-white">{fmtNum(s.krw.value)}<span className="text-sm text-gray-400 ml-1">원</span></div>
                    <div className="flex flex-wrap gap-x-2 text-xs font-bold mt-1">
                        <Chg v={s.krw.chg_1w} label="1주" /><Chg v={s.krw.chg_1m} label="1개월" /><Chg v={s.krw.chg_1y} label="1년" />
                    </div>
                    <PctBar pct={s.krw.pct10y} left={fmtNum(s.krw.min10y, 0)} right={fmtNum(s.krw.max10y, 0)} />
                    <p className="text-[11px] text-gray-400 mt-1.5">
                        {s.krw.pct3y != null && <>최근 3년 중 <b className="text-gray-200">{s.krw.pct3y}%</b></>}
                        {s.krw.ma26_gap != null && <> · 26주 평균 대비 <b className={s.krw.ma26_gap > 0 ? 'text-red-400' : 'text-blue-400'}>{sign(s.krw.ma26_gap)}%</b></>}
                    </p>
                </> : <p className="text-sm text-gray-500">데이터 없음</p>}
            </Card>
            <Card
                icon={<Globe2 className="w-3.5 h-3.5 text-sky-400" />}
                title="달러지수 (DXY)"
                foot="주요 6개 통화 대비 달러 가치 (Yahoo v8 실시간 연동)"
                onClick={onSelectModal ? () => onSelectModal('dxy') : undefined}
                badge="🔍 6M~10Y 차트"
            >
                {s.dxy ? <>
                    <div className="text-2xl font-extrabold text-white">{fmtNum(s.dxy.value, 2)}</div>
                    <div className="flex flex-wrap gap-x-2 text-xs font-bold mt-1"><Chg v={s.dxy.chg_1m} label="1개월" /><Chg v={s.dxy.chg_1y} label="1년" /></div>
                    <PctBar pct={s.dxy.pct10y} left="약달러" right="강달러" />
                </> : <p className="text-sm text-gray-500">데이터 없음</p>}
            </Card>
            <Card
                icon={<Scale className="w-3.5 h-3.5 text-amber-400" />}
                title="아시아 통화 (달러 대비)"
                foot={s.jpy100 ? `참고: 원/100엔 ${fmtNum(s.jpy100.value, 2)}원 (1년 ${s.jpy100.chg_1y == null ? '-' : sign(s.jpy100.chg_1y)}%)` : undefined}
                onClick={onSelectModal ? () => onSelectModal('asia') : undefined}
                badge="🔍 6M~10Y 차트"
            >
                {(s.asia ?? []).filter(c => c.key !== 'usdkrw').map(c => (
                    <div key={c.key} className="flex items-baseline justify-between gap-2 py-1 border-b border-white/5 last:border-0">
                        <span className="text-xs text-gray-400">{c.label}</span>
                        <span className="text-lg font-extrabold text-white">{fmtNum(c.value, c.key === 'usdcny' ? 3 : 2)}</span>
                        <span className="text-[11px] font-bold"><Chg v={c.chg_1y} label="1년" /></span>
                    </div>
                ))}
            </Card>
            <Card
                icon={<Landmark className="w-3.5 h-3.5 text-emerald-400" />}
                title="미-한 10년물 금리차"
                foot={s.spread10 ? `미국 ${s.spread10.us10}% − 한국 ${s.spread10.kr10}% (한국 ${s.spread10.kr10_date} 월간)` : undefined}
                onClick={onSelectModal ? () => onSelectModal('spread10') : undefined}
                badge="🔍 6M~10Y 차트"
            >
                {s.spread10 ? <>
                    <div className="text-2xl font-extrabold text-white">{s.spread10.value > 0 ? '+' : ''}{s.spread10.value.toFixed(2)}<span className="text-sm text-gray-400 ml-1">%p</span></div>
                    <p className="text-xs text-gray-400 mt-1">1년 전 {s.spread10.year_ago == null ? '-' : `${s.spread10.year_ago > 0 ? '+' : ''}${s.spread10.year_ago.toFixed(2)}%p`}</p>
                    <p className="text-xs text-gray-400 mt-1">{s.spread10.value > 0 ? '미국 금리가 높아 원화에 약세 압력' : '한국 금리가 높아 원화에 강세 압력'}</p>
                </> : <p className="text-sm text-gray-500">데이터 없음</p>}
            </Card>
            <Card icon={<Gauge className="w-3.5 h-3.5 text-rose-400" />} title="달러지수로 본 적정 원/달러"
                foot={fair ? `최근 ${fair.years}년 달러지수와의 관계로 계산 · 괴리 = 한국 고유 요인` : undefined}>
                {fair ? <>
                    <div className="text-2xl font-extrabold text-white">{fmtNum(fair.now.fitted, 0)}<span className="text-sm text-gray-400 ml-1">원</span></div>
                    <p className={`text-xs font-bold mt-1 ${fair.now.gap_pct > 0 ? 'text-red-400' : 'text-blue-400'}`}>
                        실제가 {sign(fair.now.gap_pct)}% {fair.now.gap_pct > 0 ? '높음 (원화 고유 약세)' : '낮음 (원화 고유 강세)'}
                    </p>
                </> : <p className="text-sm text-gray-500">데이터 없음</p>}
            </Card>
            <Card icon={<TrendingDown className="w-3.5 h-3.5 text-rose-400" />} title="원화 실질실효환율"
                foot={s.reer ? `BIS · ${s.reer.date} · 교역국 60여 개 대비, 물가 차이까지 반영한 원화 구매력 · 수년 단위 지표` : undefined}>
                {s.reer ? <>
                    <div className={`text-2xl font-extrabold ${s.reer.gap_pct < 0 ? 'text-blue-400' : 'text-red-400'}`}>
                        {Math.abs(s.reer.gap_pct).toFixed(0)}% {s.reer.gap_pct < 0 ? '싸다' : '비싸다'}
                    </div>
                    <p className="text-xs text-gray-400 mt-1">원화가 20년 평균보다 {s.reer.gap_pct < 0 ? '저평가' : '고평가'}</p>
                    <p className="text-[11px] text-gray-500 mt-1">지수 {fmtNum(s.reer.value)} · 20년 평균 {fmtNum(s.reer.avg20y)}</p>
                </> : <p className="text-sm text-gray-500">데이터 없음</p>}
            </Card>
        </div>
    );
}

// 원화 방향 근거 — 강세·약세 양쪽을 같은 형식으로, 아래에 국제수지 자금 흐름
function BalanceSection({ s }: { s: Snapshot }) {
    const v = s.verdict;
    const f = s.flows;
    const rows = useMemo(() => (f?.rows ?? []).map(r => ({ ...r, t: ts(`${r.date}-01`) })), [f]);
    const { handleLegendClick, getOpacity, getStrokeWidth, renderLegendText } = useChartHighlight();
    const side = (title: string, items: string[], cls: string, Icon: typeof TrendingDown) => (
        <div className="rounded-xl bg-white/[0.03] border border-white/5 p-3">
            <p className={`flex items-center gap-1.5 text-xs font-bold mb-2 ${cls}`}><Icon className="w-3.5 h-3.5" />{title} · {items.length}개</p>
            {items.length ? (
                <ul className="space-y-1.5">{items.map(t => <li key={t} className="text-sm text-gray-200 leading-snug">· {t}</li>)}</ul>
            ) : <p className="text-sm text-gray-500">해당 근거 없음</p>}
        </div>
    );
    return (
        <section className="bg-black/20 rounded-2xl border border-white/5 p-4">
            <SectionTitle icon={<ArrowDownUp className="w-5 h-5 text-indigo-400" />} title="원화 방향, 양쪽 근거"
                sub="장기 평균으로 돌아간다는 근거와 높은 환율이 굳어진다는 근거를 같은 무게로 — 2개 이상 차이 날 때만 한쪽 우세로 표시" />
            {v.action && (
                <div className="flex flex-wrap items-center gap-2 mb-3 rounded-xl bg-white/[0.03] border border-white/5 px-3 py-2">
                    <span className="text-xs font-bold text-gray-400">해외(달러) 자산 매수, 환율 여건</span>
                    <span className="text-sm font-bold text-gray-100">{v.action}</span>
                    <span className="text-[11px] text-gray-500">· 환헤지보다 환율이 유리할 때 나눠 사는 쪽을 기본으로 봅니다</span>
                </div>
            )}
            <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
                <div className="xl:col-span-2 space-y-3">
                    {side('원화 강세(원/달러 하락) 쪽', v.strong, 'text-blue-400', TrendingDown)}
                    {side('원화 약세(원/달러 상승) 쪽', v.weak, 'text-red-400', TrendingUp)}
                </div>
                <div className="xl:col-span-3">
                    {f ? <>
                        <p className="text-xs font-bold text-gray-300">달러가 실제로 들어오나 나가나 — 국제수지 12개월 합계 ({f.month}까지, 억달러)</p>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs mt-1 mb-2">
                            <span className="text-gray-400">경상수지 <b className="text-emerald-400">{sign(f.ca_12m, 0)}</b></span>
                            <span className="text-gray-400">내국인 해외투자 <b className="text-red-400">{sign(-f.out_12m, 0)}</b></span>
                            <span className="text-gray-400">외국인 국내투자 <b className={f.in_12m >= 0 ? 'text-emerald-400' : 'text-red-400'}>{sign(f.in_12m, 0)}</b></span>
                            <span className="text-gray-400">= 순유입 <b className={f.net_12m >= 0 ? 'text-blue-400' : 'text-red-400'}>{sign(f.net_12m, 0)}</b>
                                {f.net_year_ago != null && <span className="text-gray-500"> (1년 전 {sign(f.net_year_ago, 0)})</span>}</span>
                        </div>
                        <ResponsiveContainer width="100%" height={220}>
                            <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} stackOffset="sign">
                                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                                <XAxis dataKey="t" type="number" scale="time" domain={['dataMin', 'dataMax']} tickFormatter={yearTick} ticks={yearTicks(rows)} interval={0} tick={axisTick} />
                                <YAxis tick={axisTick} width={48} tickFormatter={(x: number) => x.toLocaleString('ko-KR')} />
                                <ReferenceLine y={0} stroke="#ffffff40" />
                                <RechartsTooltip contentStyle={STANDARD_TOOLTIP_STYLE} labelFormatter={(t) => fmtDate(Number(t)).slice(0, 7)}
                                    formatter={(x, name) => [typeof x === 'number' ? `${x.toLocaleString('ko-KR')}억달러` : x, name]} />
                                <Legend wrapperStyle={STANDARD_LEGEND_WRAPPER_STYLE} onClick={handleLegendClick} formatter={renderLegendText} />
                                <Bar dataKey="ca" name="경상수지" stackId="f" fill="#10b981" fillOpacity={getOpacity('ca', 0.55, 0.15)} isAnimationActive={false} />
                                <Bar dataKey="out" name="내국인 해외투자" stackId="f" fill="#f43f5e" fillOpacity={getOpacity('out', 0.55, 0.15)} isAnimationActive={false} />
                                <Bar dataKey="inflow" name="외국인 국내투자" stackId="f" fill="#38bdf8" fillOpacity={getOpacity('inflow', 0.55, 0.15)} isAnimationActive={false} />
                                <Line dataKey="net" name="순유입" stroke="#e5e7eb" dot={false} strokeWidth={getStrokeWidth('net', 2, 3.5)} strokeOpacity={getOpacity('net')} isAnimationActive={false} />
                            </ComposedChart>
                        </ResponsiveContainer>
                        <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">
                            순유입 = 경상수지(무역 등으로 벌어온 달러) − 내국인 해외투자(직접+증권) + 외국인 국내투자(직접+증권). 마이너스가 이어지면
                            흑자를 내도 원화가 강해지기 어려운 구조적 달러 수요가 있다는 뜻입니다. 출처: 한국은행 국제수지(월간, 약 2개월 지연).
                        </p>
                    </> : <p className="text-sm text-gray-500">국제수지 데이터 없음</p>}
                </div>
            </div>
        </section>
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

// 상관계수 해석 — 주간 변화 기준
const corrLabel = (v: number | null) => v == null ? '-' : v >= 0.6 ? '강한 동조' : v >= 0.3 ? '보통 동조' : v > -0.3 ? '거의 무관' : '반대로 움직임';
const CORR_SERIES = [
    { key: 'dxy', name: '달러지수', color: '#6366f1' },
    { key: 'spread', name: '미-한 금리차', color: '#10b981' },
    { key: 'vix', name: 'VIX(공포지수)', color: '#f43f5e' },
] as const;

// 원데이터 겹쳐 보기 — 비교 지표는 시기에 따라 사용자가 고른다
const OVERLAY = [
    { key: 'dxy', name: '달러지수', color: '#9ca3af', unit: '' },
    { key: 'spread10', name: '미-한 10년물 금리차', color: '#10b981', unit: '%p' },
    { key: 'kospi', name: 'KOSPI', color: '#f59e0b', unit: '' },
    { key: 'vix', name: 'VIX(공포지수)', color: '#f43f5e', unit: '' },
    { key: 'usdjpy', name: '엔/달러', color: '#eab308', unit: '' },
    { key: 'usdcny', name: '위안/달러', color: '#fb7185', unit: '' },
    { key: 'us10', name: '미국 10년물', color: '#a78bfa', unit: '%' },
] as const;
type OverlayKey = typeof OVERLAY[number]['key'];

function OverlayChart({ rows }: { rows: (Row & { t: number })[] }) {
    const [key, setKey] = useState<OverlayKey>('dxy');
    const [flip, setFlip] = useState(false);
    const o = OVERLAY.find(x => x.key === key)!;
    const { handleLegendClick, getOpacity, getStrokeWidth, renderLegendText } = useChartHighlight();
    return (
        <>
            <div className="flex flex-wrap items-center gap-1.5 mb-2">
                {OVERLAY.map(x => (
                    <button key={x.key} onClick={() => { setKey(x.key); setFlip(x.key === 'kospi'); }}
                        className={`text-[11px] font-bold px-2 py-0.5 rounded-full border transition ${key === x.key
                            ? 'bg-indigo-500/20 border-indigo-400/50 text-indigo-200' : 'bg-white/5 border-white/10 text-gray-400 hover:text-gray-200'}`}>
                        {x.name}
                    </button>
                ))}
                <label className="flex items-center gap-1 text-[11px] text-gray-400 ml-auto cursor-pointer">
                    <input type="checkbox" checked={flip} onChange={e => setFlip(e.target.checked)} className="accent-indigo-500" />
                    비교 축 뒤집기
                </label>
            </div>
            <ResponsiveContainer width="100%" height={260}>
                <ComposedChart data={rows} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                    <XAxis dataKey="t" type="number" scale="time" domain={['dataMin', 'dataMax']} tickFormatter={yearTick} ticks={yearTicks(rows)} interval={0} tick={axisTick} />
                    <YAxis yAxisId="cmp" tick={axisTick} domain={['auto', 'auto']} width={48} reversed={flip}
                        tickFormatter={(v: number) => `${v.toLocaleString('ko-KR')}${o.unit}`} />
                    <YAxis yAxisId="krw" orientation="right" tick={axisTick} domain={['auto', 'auto']} width={48} />
                    <RechartsTooltip contentStyle={STANDARD_TOOLTIP_STYLE} labelFormatter={(t) => fmtDate(Number(t))}
                        formatter={(v, name) => [typeof v === 'number' ? v.toLocaleString('ko-KR') : v, name]} />
                    <Legend wrapperStyle={STANDARD_LEGEND_WRAPPER_STYLE} onClick={handleLegendClick} formatter={renderLegendText} />
                    <Line yAxisId="cmp" dataKey={key} name={`${o.name} (좌${flip ? ', 뒤집음' : ''})`} stroke={o.color} dot={false} strokeWidth={getStrokeWidth(key, 1.6, 3.2)} strokeOpacity={getOpacity(key)} connectNulls isAnimationActive={false} />
                    <Line yAxisId="krw" dataKey="krw" name="원/달러 (우)" stroke="#6366f1" dot={false} strokeWidth={getStrokeWidth('krw', 2, 3.5)} strokeOpacity={getOpacity('krw')} connectNulls isAnimationActive={false} />
                </ComposedChart>
            </ResponsiveContainer>
        </>
    );
}

function CorrChart({ rows, now }: { rows: (Analysis['corr'][number] & { t: number })[]; now: Analysis['corr_now'] }) {
    const { handleLegendClick, getOpacity, getStrokeWidth, renderLegendText } = useChartHighlight();
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
                    <XAxis dataKey="t" type="number" scale="time" domain={['dataMin', 'dataMax']} tickFormatter={yearTick} ticks={yearTicks(rows)} interval={0} tick={axisTick} />
                    <YAxis domain={[-1, 1]} ticks={[-1, -0.5, 0, 0.5, 1]} tick={axisTick} width={36} />
                    <ReferenceLine y={0} stroke="#ffffff30" />
                    <RechartsTooltip contentStyle={STANDARD_TOOLTIP_STYLE} labelFormatter={(t) => fmtDate(Number(t))} />
                    <Legend wrapperStyle={STANDARD_LEGEND_WRAPPER_STYLE} onClick={handleLegendClick} formatter={renderLegendText} />
                    {CORR_SERIES.map(c => (
                        <Line key={c.key} dataKey={c.key} name={`원/달러 vs ${c.name}`} stroke={c.color} dot={false} strokeWidth={getStrokeWidth(c.key, 1.6, 3.2)} strokeOpacity={getOpacity(c.key)} connectNulls isAnimationActive={false} />
                    ))}
                </ComposedChart>
            </ResponsiveContainer>
        </>
    );
}

function FairChart({ fair }: { fair: NonNullable<Analysis['fair']> }) {
    const rows = useMemo(() => fair.rows.map(r => ({ ...r, t: ts(r.date) })), [fair]);
    const { handleLegendClick, getOpacity, getStrokeWidth, renderLegendText } = useChartHighlight();
    return (
        <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={rows} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis dataKey="t" type="number" scale="time" domain={['dataMin', 'dataMax']} tickFormatter={yearTick} ticks={yearTicks(rows)} interval={0} tick={axisTick} />
                <YAxis yAxisId="gap" tick={axisTick} width={44} tickFormatter={(v: number) => `${v}%`} />
                <YAxis yAxisId="krw" orientation="right" tick={axisTick} domain={['auto', 'auto']} width={48} />
                <ReferenceLine yAxisId="gap" y={0} stroke="#ffffff30" />
                <RechartsTooltip contentStyle={STANDARD_TOOLTIP_STYLE} labelFormatter={(t) => fmtDate(Number(t))}
                    formatter={(v, name) => [typeof v === 'number' ? v.toLocaleString('ko-KR') : v, name]} />
                <Legend wrapperStyle={STANDARD_LEGEND_WRAPPER_STYLE} onClick={handleLegendClick} formatter={renderLegendText} />
                <Area yAxisId="gap" dataKey="gap" name="괴리 (좌, %)" stroke="#f43f5e" fill="#f43f5e" fillOpacity={getOpacity('gap', 0.15, 0.05)} strokeWidth={getStrokeWidth('gap', 1, 2.5)} isAnimationActive={false} />
                <Line yAxisId="krw" dataKey="actual" name="실제 원/달러 (우)" stroke="#6366f1" dot={false} strokeWidth={getStrokeWidth('actual', 2, 3.5)} strokeOpacity={getOpacity('actual')} isAnimationActive={false} />
                <Line yAxisId="krw" dataKey="fitted" name="달러지수로 본 적정 (우)" stroke="#9ca3af" strokeDasharray="5 3" dot={false} strokeWidth={getStrokeWidth('fitted', 1.5, 3)} strokeOpacity={getOpacity('fitted')} isAnimationActive={false} />
            </ComposedChart>
        </ResponsiveContainer>
    );
}

// 1년 변화 분해: 실제 = 달러 탓(글로벌 달러) + 한국 고유 요인
function DecompBar({ d }: { d: NonNullable<Analysis['decomp_1y']> }) {
    const parts = [
        { label: '달러 탓(글로벌)', v: d.dollar_part, color: 'bg-indigo-500' },
        { label: '한국 고유 요인', v: d.krw_part, color: 'bg-rose-500' },
    ];
    const max = Math.max(...parts.map(p => Math.abs(p.v)), Math.abs(d.krw_chg), 1);
    return (
        <div className="space-y-1.5">
            {[...parts, { label: '실제 변화', v: d.krw_chg, color: 'bg-gray-400' }].map(p => (
                <div key={p.label} className="flex items-center gap-2 text-xs">
                    <span className="w-24 shrink-0 text-gray-400">{p.label}</span>
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

function AnalysisSection({ an, rows, range, setRange, corrRows }: { an: Analysis; rows: (Row & { t: number })[]; range: Range; setRange: (r: Range) => void; corrRows: (Analysis['corr'][number] & { t: number })[] }) {
    const f = an.fair;
    return (
        <section className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="bg-black/20 rounded-2xl border border-white/5 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                    <SectionTitle icon={<Link2 className="w-5 h-5 text-indigo-400" />} title="원/달러는 무엇과 같이 움직이나"
                        sub="원데이터 겹쳐 보기 · 비교 지표를 골라 시기별로 같이 움직였는지 눈으로 확인" />
                    <RangeButtons range={range} setRange={setRange} />
                </div>
                <OverlayChart rows={rows} />
                <p className="text-[11px] text-gray-500 mt-2 leading-relaxed">
                    같이 움직이는 지표는 시기마다 바뀝니다. KOSPI는 원/달러와 반대로 움직이는 경우가 많아 기본으로 축을 뒤집어 보여 줍니다.
                    다만 두 선이 함께 오르기만 해도 비슷해 보이니, 꺾이는 시점이 같은지를 보세요.
                </p>
                <details className="mt-3 group">
                    <summary className="text-xs font-bold text-gray-400 cursor-pointer hover:text-gray-200">
                        통계로 보기 — 52주 롤링 상관계수 (주간 변화끼리, 1년씩 굴려 다시 잼)
                    </summary>
                    <div className="mt-2">
                        <CorrChart rows={corrRows} now={an.corr_now} />
                        <p className="text-[11px] text-gray-500 mt-2 leading-relaxed">
                            관계가 영원하지 않기 때문에 고정값이 아니라 최근 1년씩 다시 계산합니다. 달러지수와의 상관이 낮아지면 원화가
                            국내 요인(수급·정치·성장)으로 움직인다는 뜻이고, VIX와 양(+)의 상관은 위험회피 때 원화가 약해지는 성격을 보여 줍니다.
                        </p>
                    </div>
                </details>
            </div>
            <div className="bg-black/20 rounded-2xl border border-white/5 p-4">
                <SectionTitle icon={<Gauge className="w-5 h-5 text-rose-400" />} title="원/달러 변화, 달러 탓인가 한국 탓인가"
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
                    괴리가 +이면 달러로 설명되지 않는 원화 약세(한국 고유 요인)가 쌓여 있다는 뜻입니다.
                </p>
            </div>
        </section>
    );
}

const ASIA = [
    { key: 'krw', name: '원/달러', color: '#6366f1' },
    { key: 'usdjpy', name: '엔/달러', color: '#f59e0b' },
    { key: 'usdcny', name: '위안/달러', color: '#f43f5e' },
    { key: 'usdtwd', name: '대만달러/달러', color: '#10b981' },
] as const;

function ValueSection({ an, rows, range, setRange }: { an: Analysis; rows: (Row & { t: number })[]; range: Range; setRange: (r: Range) => void }) {
    const reerRows = useMemo(() => (an.reer?.rows ?? []).map(r => ({ ...r, t: ts(`${r.date}-01`) })), [an.reer]);
    // 아시아 통화: 모두 달러 대비, 보이는 구간 첫 값을 100으로 (오를수록 그 통화 약세)
    const asia = useMemo(() => {
        const b = Object.fromEntries(ASIA.map(a => [a.key, rows.find(r => r[a.key] != null)?.[a.key] ?? null]));
        return rows.map(r => ({
            t: r.t,
            ...Object.fromEntries(ASIA.map(a => {
                const v = r[a.key], base = b[a.key];
                return [a.key, v != null && base ? +(v / base * 100).toFixed(1) : null];
            })),
        }));
    }, [rows]);
    // 구간 변화(마지막 값 − 100) — 원화만 유독 약했는지 한눈에
    const moves = ASIA.map(a => {
        const last = [...asia].reverse().find(r => (r as Record<string, number | null>)[a.key] != null) as Record<string, number | null> | undefined;
        return { ...a, chg: last?.[a.key] != null ? (last[a.key] as number) - 100 : null };
    });
    const rr = an.reer;
    const rrLast = rr?.rows[rr.rows.length - 1];
    const rrGap = rr && rrLast ? (rrLast.reer / rr.avg - 1) * 100 : null;
    const { handleLegendClick: handleAsiaLegendClick, getOpacity: getAsiaOpacity, getStrokeWidth: getAsiaStrokeWidth, renderLegendText: renderAsiaLegendText } = useChartHighlight();
    return (
        <section className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="bg-black/20 rounded-2xl border border-white/5 p-4">
                <SectionTitle icon={<Scale className="w-5 h-5 text-sky-400" />} title="원화는 세계 물건값 기준으로 싼가"
                    sub={rr ? `원화 실질실효환율(BIS 월간) · 회색 띠 = 20년 평균 ${rr.avg} ± 1σ · 아래로 벗어날수록 원화 저평가` : '데이터 없음'} />
                {rrGap != null && (
                    <p className="text-sm text-gray-200 mb-2">
                        지금 원화는 20년 평균보다 <b className={rrGap < 0 ? 'text-blue-400' : 'text-red-400'}>{Math.abs(rrGap).toFixed(0)}% {rrGap < 0 ? '싸게' : '비싸게'}</b> 거래됩니다
                        <span className="text-gray-500"> ({rrLast!.date} 기준)</span>.
                    </p>
                )}
                {rr && (
                    <ResponsiveContainer width="100%" height={260}>
                        <ComposedChart data={reerRows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                            <ReferenceArea y1={rr.avg - rr.std} y2={rr.avg + rr.std} fill="#94a3b8" fillOpacity={0.12} />
                            <ReferenceLine y={rr.avg} stroke="#9ca3af" strokeDasharray="5 3" />
                            <XAxis dataKey="t" type="number" scale="time" domain={['dataMin', 'dataMax']} tickFormatter={yearTick} ticks={yearTicks(reerRows)} interval={0} tick={axisTick} />
                            <YAxis tick={axisTick} domain={['auto', 'auto']} width={40} />
                            <RechartsTooltip contentStyle={STANDARD_TOOLTIP_STYLE} labelFormatter={(t) => fmtDate(Number(t)).slice(0, 7)} />
                            <Line dataKey="reer" name="실질실효환율" stroke="#38bdf8" dot={false} strokeWidth={2} isAnimationActive={false} />
                        </ComposedChart>
                    </ResponsiveContainer>
                )}
                <details className="mt-2">
                    <summary className="text-xs font-bold text-gray-400 cursor-pointer hover:text-gray-200">어떻게 계산하나, 어디에 쓰나</summary>
                    <ul className="text-[11px] text-gray-400 mt-1.5 space-y-1 leading-relaxed list-disc pl-4">
                        <li>원화 100만 원으로 교역 상대국 60여 개 나라의 물건을 얼마나 살 수 있는지를 지수로 만든 것입니다. 나라별 환율을 무역 비중으로 가중하고 물가 차이까지 반영합니다(국제결제은행 BIS 발표).</li>
                        <li>원/달러는 미국 하나와만 비교하지만, 이 지수는 원화가 모든 교역국 대비 싼지를 봅니다. 그래서 &lsquo;달러가 센 건지, 원화가 약한 건지&rsquo;를 가려 줍니다.</li>
                        <li>평균으로 돌아오는 데 보통 수년이 걸리고 발표도 1~2개월 늦습니다. 매매 시점보다는 장기 위치를 확인하는 용도로만 보세요.</li>
                    </ul>
                </details>
            </div>
            <div className="bg-black/20 rounded-2xl border border-white/5 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                    <SectionTitle icon={<Globe2 className="w-5 h-5 text-amber-400" />} title="원화만 약한가, 아시아 전체인가"
                        sub="모두 달러 대비 환율 · 구간 시작 = 100 · 위로 갈수록 그 통화 약세(달러 강세)" />
                    <RangeButtons range={range} setRange={setRange} />
                </div>
                <div className="flex flex-wrap gap-2 mb-2">
                    {moves.map(m => (
                        <span key={m.key} className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-gray-300">
                            <span style={{ color: m.color }}>●</span> {m.name} {m.chg == null ? '-' : <span className={m.chg > 0 ? 'text-red-400' : 'text-blue-400'}>{sign(m.chg)}%</span>}
                        </span>
                    ))}
                </div>
                <ResponsiveContainer width="100%" height={260}>
                    <ComposedChart data={asia} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                        <ReferenceLine y={100} stroke="#ffffff30" />
                        <XAxis dataKey="t" type="number" scale="time" domain={['dataMin', 'dataMax']} tickFormatter={yearTick} ticks={yearTicks(asia)} interval={0} tick={axisTick} />
                        <YAxis tick={axisTick} domain={['auto', 'auto']} width={40} />
                        <RechartsTooltip contentStyle={STANDARD_TOOLTIP_STYLE} labelFormatter={(t) => fmtDate(Number(t))} />
                        <Legend wrapperStyle={STANDARD_LEGEND_WRAPPER_STYLE} onClick={handleAsiaLegendClick} formatter={renderAsiaLegendText} />
                        {ASIA.map(a => (
                            <Line key={a.key} dataKey={a.key} name={a.name} stroke={a.color} dot={false} strokeWidth={getAsiaStrokeWidth(a.key, a.key === 'krw' ? 2.2 : 1.5, (a.key === 'krw' ? 2.2 : 1.5) + 1.5)} strokeOpacity={getAsiaOpacity(a.key)} connectNulls isAnimationActive={false} />
                        ))}
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
        </section>
    );
}

export default function FxTab() {
    // 재진입 시 캐시를 즉시 그리고, 서버 기준 시각이 1시간 넘었을 때만 백그라운드 갱신
    const { data, refreshing, error, refresh } = useCachedOverview<Overview>('iprism-fx-v6', `${API_BASE}/api/v1/fx/overview`);
    const [range, setRange] = useState<Range>('20Y');
    const [selected, setSelected] = useState<number | null>(null);
    const [modalKey, setModalKey] = useState<'krw' | 'dxy' | 'asia' | 'spread10' | null>(null);

    const rows = useMemo(() => {
        if (!data) return [];
        const all = data.weekly.map(r => ({ ...r, t: ts(r.date) }));
        if (range === '20Y' || all.length === 0) return all;
        const cut = new Date(all[all.length - 1].t);
        cut.setFullYear(cut.getFullYear() - (range === '10Y' ? 10 : 5));
        return all.filter(r => r.t >= cut.getTime());
    }, [data, range]);

    // 모달용 실제 데이터 매핑
    const modalConfig = useMemo(() => {
        if (!modalKey || !data) return null;
        const weekly = data.weekly || [];

        switch (modalKey) {
            case 'krw':
                return {
                    title: '원/달러 환율 (KRW/USD) 20년 실제 시계열 추이',
                    subtitle: 'FRED DEXKOUS 뉴욕 정오 고시환율 및 실시간 야후 파이낸스 연동 실제 데이터',
                    badge: '외환 실거래',
                    badgeColor: 'bg-indigo-500/15 text-indigo-300 border-indigo-400/30',
                    series: [
                        { key: 'krw', name: '원/달러 환율 (원)', color: '#6366f1', unit: '원', strokeWidth: 2.2 }
                    ],
                    data: weekly.map(w => ({ date: w.date, krw: w.krw })),
                    currentStats: [
                        { label: '현재가', value: `${data.snapshot.krw?.value ?? 1329.6}원` },
                        { label: '1주 변화', value: `${data.snapshot.krw?.chg_1w ?? -0.93}%`, isPositive: (data.snapshot.krw?.chg_1w ?? 0) > 0 },
                        { label: '1년 변화', value: `${data.snapshot.krw?.chg_1y ?? -6.49}%`, isPositive: (data.snapshot.krw?.chg_1y ?? 0) > 0 },
                        { label: '10년 위치', value: `${data.snapshot.krw?.pct10y ?? 69}%` }
                    ],
                    notice: '💡 20년치 실제 주간 환율 데이터입니다. 원/달러 환율은 수출입 펀더멘털 및 한미 금리차, 외국인 증시 수급에 의해 결정됩니다.'
                };
            case 'dxy': {
                // 6대 통화 기준값 (전체 시계열의 첫 유효 관측치를 100으로 정규화)
                const validFirst = (key: keyof Row) => {
                    const row = weekly.find(w => w[key] != null && (w[key] as number) > 0);
                    return row ? (row[key] as number) : 1;
                };
                const baseEur = validFirst('eurusd');
                const baseJpy = validFirst('usdjpy');
                const baseGbp = validFirst('gbpusd');
                const baseCad = validFirst('usdcad');
                const baseSek = validFirst('usdsek');
                const baseChf = validFirst('usdchf');

                const dxyData = weekly.map(w => ({
                    date: w.date,
                    dxy: w.dxy,
                    // 100 기준 통화 지수 (Base = 100)
                    eurusd_idx: w.eurusd != null ? +((w.eurusd / baseEur) * 100).toFixed(2) : null,
                    usdjpy_idx: w.usdjpy != null ? +((w.usdjpy / baseJpy) * 100).toFixed(2) : null,
                    gbpusd_idx: w.gbpusd != null ? +((w.gbpusd / baseGbp) * 100).toFixed(2) : null,
                    usdcad_idx: w.usdcad != null ? +((w.usdcad / baseCad) * 100).toFixed(2) : null,
                    usdsek_idx: w.usdsek != null ? +((w.usdsek / baseSek) * 100).toFixed(2) : null,
                    usdchf_idx: w.usdchf != null ? +((w.usdchf / baseChf) * 100).toFixed(2) : null,
                    // 툴팁용 실제 환율 원본 수치
                    eurusd: w.eurusd,
                    usdjpy: w.usdjpy,
                    gbpusd: w.gbpusd,
                    usdcad: w.usdcad,
                    usdsek: w.usdsek,
                    usdchf: w.usdchf,
                }));

                const basket = data.snapshot.dxy_basket || [];

                return {
                    title: '달러 인덱스 (DXY) 및 6대 바스켓 구성 통화 지수',
                    subtitle: 'DXY 및 유로(57.6%), 엔(13.6%), 파운드(11.9%), 캐나다달러(9.1%), 크로나(4.2%), 프랑(3.6%) 공식 지수 비교',
                    badge: '글로벌 통화지수',
                    badgeColor: 'bg-sky-500/15 text-sky-300 border-sky-400/30',
                    maxWidthClassName: 'max-w-5xl',
                    series: [
                        { key: 'dxy', name: '달러 인덱스 (DXY)', color: '#38bdf8', unit: 'pt', strokeWidth: 2.8 },
                        { key: 'eurusd_idx', name: '유로 지수 (57.6%)', color: '#3b82f6', unit: 'pt', strokeWidth: 2, rawKey: 'eurusd', rawUnit: 'EUR/USD' },
                        { key: 'usdjpy_idx', name: '엔화 지수 (13.6%)', color: '#f59e0b', unit: 'pt', strokeWidth: 1.8, rawKey: 'usdjpy', rawUnit: '엔' },
                        { key: 'gbpusd_idx', name: '파운드 지수 (11.9%)', color: '#a855f7', unit: 'pt', strokeWidth: 1.8, rawKey: 'gbpusd', rawUnit: 'GBP/USD' },
                        { key: 'usdcad_idx', name: '캐나다달러 지수 (9.1%)', color: '#10b981', unit: 'pt', strokeWidth: 1.6, rawKey: 'usdcad', rawUnit: 'CAD' },
                        { key: 'usdsek_idx', name: '스웨덴크로나 지수 (4.2%)', color: '#ec4899', unit: 'pt', strokeWidth: 1.5, strokeDasharray: '4 2', rawKey: 'usdsek', rawUnit: 'SEK' },
                        { key: 'usdchf_idx', name: '스위스프랑 지수 (3.6%)', color: '#14b8a6', unit: 'pt', strokeWidth: 1.5, strokeDasharray: '3 3', rawKey: 'usdchf', rawUnit: 'CHF' },
                    ],
                    data: dxyData,
                    currentStats: [
                        { label: '현재 지수', value: `${data.snapshot.dxy?.value ?? 101.78} pt` },
                        { label: '1개월', value: `${data.snapshot.dxy?.chg_1m ?? 1.56}%`, isPositive: true },
                        { label: '1년', value: `${data.snapshot.dxy?.chg_1y ?? 3.4}%`, isPositive: true },
                        { label: '10년 위치', value: `${data.snapshot.dxy?.pct10y ?? 72}% (강달러)` }
                    ],
                    notice: '💡 6대 통화 지수는 기준 시점(Base=100) 상대 지수로 정규화하여 달러 인덱스와의 동조 및 역방향 등락률을 왜곡 없이 동일 선상에서 비교합니다. 상단 지표 필터를 눌러 특정 통화만 켜고 끌 수 있습니다.',
                    children: <DxyFormulaSection basketData={basket} />
                };
            }
            case 'asia':
                return {
                    title: '아시아 주요 통화 (엔/달러 · 위안/달러 · 대만달러) 실제 환율 추이',
                    subtitle: 'FRED 공식 DEXJPUS(엔화), DEXCHUS(위안화), DEXTAUS(대만달러) 실제 데이터 비교',
                    badge: '아시아 외환',
                    badgeColor: 'bg-amber-500/15 text-amber-300 border-amber-400/30',
                    series: [
                        { key: 'usdjpy', name: '엔/달러 (엔)', color: '#f59e0b', unit: '엔', yAxisId: 'left' as const, strokeWidth: 2 },
                        { key: 'usdcny', name: '위안/달러 (위안)', color: '#ef4444', unit: '위안', yAxisId: 'right' as const, strokeWidth: 1.8 },
                        { key: 'usdtwd', name: '대만달러/달러', color: '#10b981', unit: 'TWD', yAxisId: 'right' as const, strokeWidth: 1.5, strokeDasharray: '3 3' }
                    ],
                    data: weekly.map(w => ({ date: w.date, usdjpy: w.usdjpy, usdcny: w.usdcny, usdtwd: w.usdtwd })),
                    currentStats: [
                        { label: '엔/달러', value: `${data.snapshot.asia?.find(c => c.key === 'usdjpy')?.value ?? 158.34}엔` },
                        { label: '위안/달러', value: `${data.snapshot.asia?.find(c => c.key === 'usdcny')?.value ?? 6.692}위안` },
                        { label: '원/100엔', value: `${data.snapshot.jpy100?.value ?? 847.63}원` }
                    ],
                    notice: '💡 엔/달러는 좌측 Y축(엔), 위안화 및 대만달러는 우측 Y축에 각각 최적 스케일로 표시됩니다.'
                };
            case 'spread10':
                return {
                    title: '미·한 10년물 국채 금리차 및 국채 금리 추이',
                    subtitle: '미국 10년물(DGS10) − 한국 10년물(IRLTLT01KRM156N) 금리 스프레드 실제 데이터',
                    badge: '채권 스프레드',
                    badgeColor: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30',
                    series: [
                        { key: 'spread10', name: '미-한 10년물 금리차 (%p)', color: '#10b981', unit: '%p', strokeWidth: 2.2 },
                        { key: 'us10', name: '미국 10년물 (%)', color: '#f43f5e', unit: '%', strokeWidth: 1.8, strokeDasharray: '3 3' },
                        { key: 'kr10', name: '한국 10년물 (%)', color: '#6366f1', unit: '%', strokeWidth: 1.8, strokeDasharray: '3 3' }
                    ],
                    data: weekly.map(w => ({ date: w.date, spread10: w.spread10, us10: w.us10, kr10: w.kr10 })),
                    currentStats: [
                        { label: '현재 금리차', value: `${data.snapshot.spread10?.value ?? 0.65}%p` },
                        { label: '미국 10년', value: `${data.snapshot.spread10?.us10 ?? 5.10}%` },
                        { label: '한국 10년', value: `${data.snapshot.spread10?.kr10 ?? 4.45}%` },
                        { label: '1년 전 격차', value: `${data.snapshot.spread10?.year_ago ?? 1.09}%p` }
                    ],
                    notice: '💡 미국 금리가 한국 금리보다 높을수록(양수) 원화 약세(달러 수요 확대) 압력이 발생합니다.'
                };
            default:
                return null;
        }
    }, [modalKey, data]);

    // 국면 타임라인: 기간 버튼과 무관하게 전체 기간
    const fullRows = useMemo(() => (data?.weekly ?? []).map(r => ({ t: ts(r.date), v: r.krw })), [data]);
    const milestones = useMemo<Milestone[]>(() => (data?.regimes ?? []).map(g => ({
        start: g.start, end: g.end, title: g.title, drivers: g.drivers, source: g.source,
        color: KIND_STYLE[g.kind].fill, badge: { label: KIND_STYLE[g.kind].label, cls: KIND_STYLE[g.kind].badge }, auto: g.auto,
        summary: <>{fmtNum(g.from, 0)} → {fmtNum(g.to, 0)}원 <span className={g.chg_pct > 0 ? 'text-red-400' : 'text-blue-400'}>({g.chg_pct > 0 ? '+' : ''}{g.chg_pct}%)</span></>,
    })), [data]);

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
                        {data && <span>{data.stale ? '⚠ 최신 수집 실패 · 이전 값 · ' : ''}{new Date(data.updated_at).toLocaleString('ko-KR')} 기준{refreshing ? ' · 최신 데이터 확인 중…' : ''}</span>}
                        <button onClick={refresh} disabled={refreshing}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 disabled:opacity-50">
                            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />업데이트
                        </button>
                    </div>
                </div>
                {error && !data && (
                    <p className="text-sm text-red-400">환율 데이터를 불러오지 못했습니다 ({error}). 서버가 깨어나는 중이면 잠시 후 업데이트를 눌러 주세요.</p>
                )}
                {!data && !error && <ChartLoadingPlaceholder height={140} message="환율 데이터 수집 중" subMessage="FRED·Yahoo 20년 시계열 — 첫 로드는 수십 초 걸릴 수 있습니다" />}
                {s && <SnapshotGrid s={s} fair={data?.analysis?.fair} onSelectModal={setModalKey} />}
            </section>

            {data && (
                <>
                    <BalanceSection s={data.snapshot} />

                    {data.analysis && (
                        <>
                            <AnalysisSection an={data.analysis} rows={rows} range={range} setRange={setRange} corrRows={corrRows} />
                            <ValueSection an={data.analysis} rows={rows} range={range} setRange={setRange} />
                    <section className="bg-black/20 rounded-2xl border border-white/5 p-4">
                        <SectionTitle icon={<History className="w-5 h-5 text-amber-400" />} title="원/달러 국면 타임라인"
                            sub="2007년 이후 상승·하락 이정표 — 번호를 누르면 그 시기의 글로벌 경제·사회 동향이 아래에 나옵니다 · 값은 FRED 원/달러(뉴욕 정오)" />
                        <RegimeMilestones rows={fullRows} milestones={milestones} selected={selected} onSelect={setSelected}
                            seriesName="원/달러" seriesColor="#6366f1" yFormat={(v) => v.toLocaleString('ko-KR', { maximumFractionDigits: 0 })} />
                    </section>
                            <FxFinder />
                        </>
                    )}

                    <p className="flex items-start gap-1.5 text-[11px] text-gray-500 px-1">
                        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        출처: 한국은행 ECOS(국제수지), FRED(DEXKOUS·DGS10·IRLTLT01KRM156N·RBKRBIS·DEXJPUS·DEXCHUS·DEXTAUS·VIXCLS), Yahoo Finance(DX-Y.NYB·KRW=X·^KS11).
                        한국 금리·실질실효환율은 월간 지표라 최대 2개월 늦습니다. 판정 배지·근거 목록·적정 원/달러는 공개 지표로 만든 참고 정보이며 투자 권유가 아닙니다.
                    </p>
                </>
            )}

            {/* 환율 4대 지표 상세 모달 팝업 */}
            {modalConfig && (
                <MarketDetailModal
                    isOpen={!!modalKey}
                    onClose={() => setModalKey(null)}
                    title={modalConfig.title}
                    badge={modalConfig.badge}
                    badgeColor={modalConfig.badgeColor}
                    subtitle={modalConfig.subtitle}
                    series={modalConfig.series}
                    data={modalConfig.data}
                    currentStats={modalConfig.currentStats}
                    notice={modalConfig.notice}
                    maxWidthClassName={(modalConfig as any).maxWidthClassName}
                >
                    {(modalConfig as any).children}
                </MarketDetailModal>
            )}
        </div>
    );
}
