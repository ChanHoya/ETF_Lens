'use client';

import React, { useState, useCallback } from 'react';
import { API_BASE } from '@/lib/apiConfig';
import {
    ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, ReferenceLine, Line, ComposedChart,
    BarChart, Bar, Legend, Cell
} from 'recharts';
import { Loader2, TrendingUp, AlertTriangle, Play, RefreshCw, Star, Shield, Target } from 'lucide-react';

/* ─── Types ─── */
/* eslint-disable @typescript-eslint/no-explicit-any */
type HoldingItem = {
    code: string;
    amount: number;
    name: string;
    category?: string;
};

type ScatterPoint = {
    return: number;
    volatility: number;
    sharpe: number;
};

type FrontierPoint = ScatterPoint & {
    weights: Record<string, number>;
};

type PortfolioStats = {
    return: number;
    volatility: number;
    sharpe: number;
    weights: Record<string, number>;
};

type TickerInfo = {
    name: string;
    symbol: string;
    annualised_return: number;
    volatility: number;
};

type EFResult = {
    status: string;
    tickers: Record<string, TickerInfo>;
    max_sharpe: PortfolioStats;
    min_var: PortfolioStats;
    current: PortfolioStats;
    frontier: FrontierPoint[];
    scatter: ScatterPoint[];
};

type Props = {
    holdings: any[];
};

/* ─── Sharpe 색상 그라데이션: 낮음(slate) → 중간(sky) → 높음(amber) ─── */
function sharpeColor(sharpe: number, minS: number, maxS: number): string {
    if (maxS === minS) return '#94a3b8';
    const ratio = Math.max(0, Math.min(1, (sharpe - minS) / (maxS - minS)));
    // 0 → #475569 (slate), 0.5 → #0ea5e9 (sky), 1 → #f59e0b (amber)
    if (ratio < 0.5) {
        const t = ratio * 2;
        const r = Math.round(0x47 + t * (0x0e - 0x47));
        const g = Math.round(0x55 + t * (0xa5 - 0x55));
        const b = Math.round(0x69 + t * (0xe9 - 0x69));
        return `rgb(${r},${g},${b})`;
    } else {
        const t = (ratio - 0.5) * 2;
        const r = Math.round(0x0e + t * (0xf5 - 0x0e));
        const g = Math.round(0xa5 + t * (0x9e - 0xa5));
        const b = Math.round(0xe9 + t * (0x0b - 0xe9));
        return `rgb(${r},${g},${b})`;
    }
}

/* ─── Custom Dot Renderer (Scatter shape) ─── */
const CustomScatterDot = (props: any) => {
    const { cx, cy, payload, minSharpe, maxSharpe } = props;
    const color = sharpeColor(payload.sharpe, minSharpe, maxSharpe);
    return <circle cx={cx} cy={cy} r={2.5} fill={color} fillOpacity={0.65} stroke="none" />;
};

/* ─── Custom Tooltip ─── */
const ScatterTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload as ScatterPoint;
    return (
        <div className="bg-[#0f0f1a]/95 border border-white/10 rounded-xl px-3 py-2 text-xs shadow-xl backdrop-blur-md">
            <p className="text-gray-400 mb-1">포트폴리오</p>
            <p className="text-white">수익률: <span className="text-emerald-400 font-bold">{d?.return?.toFixed(2)}%</span></p>
            <p className="text-white">변동성: <span className="text-sky-400 font-bold">{d?.volatility?.toFixed(2)}%</span></p>
            <p className="text-white">샤프: <span className="text-amber-400 font-bold">{d?.sharpe?.toFixed(3)}</span></p>
        </div>
    );
};

/* ─── Stat Card ─── */
function StatCard({
    icon, label, data, colorScheme, tickers
}: {
    icon: React.ReactNode;
    label: string;
    data: PortfolioStats;
    colorScheme: { border: string; bg: string; badge: string; text: string };
    tickers: Record<string, TickerInfo>;
}) {
    const topWeights = Object.entries(data.weights)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3);

    return (
        <div className={`flex flex-col gap-3 p-5 rounded-2xl border backdrop-blur-md ${colorScheme.bg} ${colorScheme.border} flex-1 min-w-[200px]`}>
            <div className="flex items-center gap-2">
                {icon}
                <span className={`text-xs font-bold ${colorScheme.text}`}>{label}</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-black/20 rounded-xl p-2">
                    <p className="text-[9px] text-gray-500 mb-0.5">기대수익률</p>
                    <p className={`text-sm font-bold ${data.return >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {data.return >= 0 ? '+' : ''}{data.return.toFixed(1)}%
                    </p>
                </div>
                <div className="bg-black/20 rounded-xl p-2">
                    <p className="text-[9px] text-gray-500 mb-0.5">연간변동성</p>
                    <p className="text-sm font-bold text-sky-400">{data.volatility.toFixed(1)}%</p>
                </div>
                <div className="bg-black/20 rounded-xl p-2">
                    <p className="text-[9px] text-gray-500 mb-0.5">샤프지수</p>
                    <p className={`text-sm font-bold ${colorScheme.text}`}>{data.sharpe.toFixed(2)}</p>
                </div>
            </div>
            <div className="flex flex-col gap-1">
                <p className="text-[9px] text-gray-500 font-medium">비중 TOP-3</p>
                {topWeights.map(([code, weight]) => (
                    <div key={code} className="flex items-center justify-between gap-2">
                        <span className="text-[10px] text-gray-300 truncate max-w-[120px]">
                            {tickers[code]?.name || code}
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0">
                            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden w-16">
                                <div
                                    className={`h-full rounded-full ${colorScheme.badge}`}
                                    style={{ width: `${Math.min(100, weight * 100)}%` }}
                                />
                            </div>
                            <span className="text-[10px] text-gray-300 font-mono w-9 text-right">
                                {(weight * 100).toFixed(1)}%
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

/* ─── Main Component ─── */
export default function EfficientFrontierPanel({ holdings }: Props) {
    const [lookbackYears, setLookbackYears] = useState<number>(1);
    const [riskFreeRate, setRiskFreeRate] = useState<number>(3.0);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<EFResult | null>(null);

    const handleRun = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            // KIS holdings → EF 요청 포맷 변환 (현금 제외는 백엔드에서 처리)
            const efHoldings: HoldingItem[] = (holdings || [])
                .filter((h: any) => h.eval_amount > 0)
                .map((h: any) => ({
                    code: h.code,
                    amount: Number(h.eval_amount),
                    name: h.name || h.code,
                    category: h.category || '기타'
                }));

            const res = await fetch(`${API_BASE}/api/v1/analyze/efficient-frontier`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    holdings: efHoldings,
                    lookback_years: lookbackYears,
                    risk_free_rate: riskFreeRate,
                    simulations: 5000
                })
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.detail || '분석 중 오류가 발생했습니다.');
            }
            setResult(data as EFResult);
        } catch (e: any) {
            setError(e.message || '알 수 없는 오류가 발생했습니다.');
        } finally {
            setIsLoading(false);
        }
    }, [holdings, lookbackYears, riskFreeRate]);

    /* ─── Derived chart data ─── */
    const scatterData = result?.scatter ?? [];
    const frontierData = result?.frontier ?? [];
    const minSharpe = scatterData.length > 0 ? Math.min(...scatterData.map(p => p.sharpe)) : 0;
    const maxSharpe = scatterData.length > 0 ? Math.max(...scatterData.map(p => p.sharpe)) : 1;

    // 비중 비교 바 차트 데이터
    const weightBarData = result
        ? Object.keys(result.tickers).map(code => ({
            name: result.tickers[code]?.name?.length > 10
                ? result.tickers[code].name.slice(0, 9) + '…'
                : result.tickers[code].name,
            current: parseFloat(((result.current.weights[code] ?? 0) * 100).toFixed(1)),
            maxSharpe: parseFloat(((result.max_sharpe.weights[code] ?? 0) * 100).toFixed(1)),
            minVar: parseFloat(((result.min_var.weights[code] ?? 0) * 100).toFixed(1)),
        }))
        : [];

    /* ─── Empty state ─── */
    if (!holdings || holdings.length === 0) {
        return (
            <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-10 text-center text-gray-400 text-sm">
                포트폴리오 데이터가 없습니다. KIS 계좌를 먼저 연동해 주세요.
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* ─── 파라미터 컨트롤 바 ─── */}
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between bg-[#12121A]/70 border border-white/10 rounded-2xl px-5 py-4 backdrop-blur-md">
                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center flex-wrap">
                    {/* 조회 기간 */}
                    <div className="flex flex-col gap-1">
                        <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">조회 기간</span>
                        <div className="flex gap-1 bg-black/30 rounded-xl p-1 border border-white/5">
                            {([1, 2, 3] as const).map(y => (
                                <button
                                    key={y}
                                    onClick={() => setLookbackYears(y)}
                                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                                        lookbackYears === y
                                            ? 'bg-sky-600 text-white shadow-[0_0_8px_rgba(14,165,233,0.4)]'
                                            : 'text-gray-400 hover:text-white hover:bg-white/5'
                                    }`}
                                >
                                    {y}Y
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 무위험 이자율 */}
                    <div className="flex flex-col gap-1">
                        <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">무위험 이자율</span>
                        <div className="flex items-center gap-2 bg-black/30 rounded-xl px-3 py-1.5 border border-white/5">
                            <input
                                type="number"
                                min={0}
                                max={10}
                                step={0.1}
                                value={riskFreeRate}
                                onChange={e => setRiskFreeRate(parseFloat(e.target.value) || 0)}
                                className="w-14 bg-transparent text-white text-xs font-bold text-center outline-none"
                            />
                            <span className="text-gray-400 text-xs">%</span>
                        </div>
                    </div>
                </div>

                {/* 실행 버튼 */}
                <button
                    onClick={handleRun}
                    disabled={isLoading}
                    className="flex items-center gap-2 px-5 py-2.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white rounded-xl text-sm font-bold shadow-lg shadow-sky-500/20 transition-all duration-300 hover:scale-105 disabled:hover:scale-100 shrink-0"
                >
                    {isLoading ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> 분석 중...</>
                    ) : result ? (
                        <><RefreshCw className="w-4 h-4" /> 재분석</>
                    ) : (
                        <><Play className="w-4 h-4 fill-current" /> 분석 실행</>
                    )}
                </button>
            </div>

            {/* ─── 로딩 상태 ─── */}
            {isLoading && (
                <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-16 flex flex-col items-center justify-center gap-5 min-h-[300px]">
                    <div className="relative">
                        <div className="absolute inset-0 bg-sky-500/20 blur-2xl rounded-full" />
                        <Loader2 className="w-12 h-12 text-sky-400 animate-spin relative" />
                    </div>
                    <div className="text-center">
                        <p className="text-white font-bold animate-pulse">효율적 전선 분석 중...</p>
                        <p className="text-gray-400 text-xs mt-1">
                            과거 가격 데이터 수집 → 몬테카를로 시뮬레이션 ({lookbackYears}Y · 5,000회)
                        </p>
                    </div>
                </div>
            )}

            {/* ─── 에러 ─── */}
            {error && !isLoading && (
                <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-6 text-center flex flex-col items-center gap-3">
                    <AlertTriangle className="w-8 h-8 text-rose-400" />
                    <p className="text-rose-300 text-sm">{error}</p>
                    <button
                        onClick={handleRun}
                        className="px-4 py-2 bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 rounded-lg text-xs font-bold transition-colors"
                    >
                        다시 시도
                    </button>
                </div>
            )}

            {/* ─── 초기 안내 ─── */}
            {!result && !isLoading && !error && (
                <div className="bg-gradient-to-br from-sky-500/10 to-indigo-500/5 border border-sky-500/20 rounded-2xl p-10 flex flex-col items-center text-center gap-4">
                    <div className="w-16 h-16 bg-sky-500/20 rounded-full flex items-center justify-center">
                        <TrendingUp className="w-8 h-8 text-sky-400" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-white mb-2">포트폴리오 Efficient Frontier 분석</h3>
                        <p className="text-gray-400 text-sm max-w-md leading-relaxed">
                            현재 보유 종목({holdings.filter((h: any) => h.eval_amount > 0).length}개)을 기반으로
                            몬테카를로 시뮬레이션을 통해 <span className="text-sky-300 font-semibold">최대 샤프지수</span> 및
                            <span className="text-indigo-300 font-semibold"> 최소 변동성</span> 최적 포트폴리오를 계산합니다.
                        </p>
                    </div>
                    <button
                        onClick={handleRun}
                        className="flex items-center gap-2 px-6 py-3 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-bold shadow-lg shadow-sky-500/20 transition-all duration-300 hover:scale-105"
                    >
                        <Play className="w-4 h-4 fill-current" /> 분석 시작하기
                    </button>
                    <p className="text-[11px] text-sky-300/50">* 분석에 10~30초 소요될 수 있습니다. (외부 시세 데이터 수집 포함)</p>
                </div>
            )}

            {/* ─── 결과 ─── */}
            {result && !isLoading && (
                <div className="flex flex-col gap-6 animate-in fade-in duration-500">

                    {/* 1. 효율적 전선 산점도 */}
                    <div className="bg-[#12121A]/70 border border-white/10 rounded-2xl p-5 backdrop-blur-md">
                        <div className="flex items-center gap-2 mb-4">
                            <span className="w-1 h-5 bg-sky-500 rounded-full" />
                            <h3 className="text-base font-bold text-white">효율적 전선 (Efficient Frontier)</h3>
                            <span className="text-[10px] text-gray-500 ml-1">· {lookbackYears}Y 과거 데이터 · 샤프기준 색상</span>
                        </div>
                        <ResponsiveContainer width="100%" height={360}>
                            <ComposedChart margin={{ top: 10, right: 30, bottom: 20, left: 10 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
                                <XAxis
                                    type="number"
                                    dataKey="volatility"
                                    name="변동성"
                                    domain={['auto', 'auto']}
                                    tickFormatter={v => `${v.toFixed(0)}%`}
                                    label={{ value: '연간 변동성 (%)', position: 'insideBottom', offset: -10, fill: '#6b7280', fontSize: 11 }}
                                    stroke="#374151"
                                    tick={{ fill: '#9ca3af', fontSize: 10 }}
                                />
                                <YAxis
                                    type="number"
                                    dataKey="return"
                                    name="수익률"
                                    domain={['auto', 'auto']}
                                    tickFormatter={v => `${v.toFixed(0)}%`}
                                    label={{ value: '연간 기대수익률 (%)', angle: -90, position: 'insideLeft', offset: 10, fill: '#6b7280', fontSize: 11 }}
                                    stroke="#374151"
                                    tick={{ fill: '#9ca3af', fontSize: 10 }}
                                />
                                <Tooltip content={<ScatterTooltip />} />

                                {/* MC 시뮬레이션 산점도 */}
                                <Scatter
                                    name="시뮬레이션 포트폴리오"
                                    data={scatterData}
                                    shape={(props: any) => (
                                        <CustomScatterDot {...props} minSharpe={minSharpe} maxSharpe={maxSharpe} />
                                    )}
                                />

                                {/* 효율적 전선 커브 */}
                                <Line
                                    data={frontierData}
                                    type="monotone"
                                    dataKey="return"
                                    stroke="#0ea5e9"
                                    strokeWidth={2.5}
                                    dot={false}
                                    name="효율적 전선"
                                    strokeDasharray="0"
                                />

                                {/* 현재 포트폴리오 마커 */}
                                <ReferenceLine
                                    x={result.current.volatility}
                                    stroke="#f43f5e"
                                    strokeDasharray="4 3"
                                    strokeWidth={1}
                                />
                                <ReferenceLine
                                    y={result.current.return}
                                    stroke="#f43f5e"
                                    strokeDasharray="4 3"
                                    strokeWidth={1}
                                />
                            </ComposedChart>
                        </ResponsiveContainer>

                        {/* 범례 */}
                        <div className="flex flex-wrap gap-4 justify-center mt-2 text-[11px] text-gray-400">
                            <span className="flex items-center gap-1.5">
                                <span className="inline-block w-8 h-0.5 bg-sky-500 rounded" />
                                효율적 전선
                            </span>
                            <span className="flex items-center gap-1.5">
                                <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(245,158,11,0.6)]" />
                                ⭐ Max Sharpe ({result.max_sharpe.volatility.toFixed(1)}%, {result.max_sharpe.return.toFixed(1)}%)
                            </span>
                            <span className="flex items-center gap-1.5">
                                <span className="inline-block w-2.5 h-2.5 rounded-full bg-sky-400 shadow-[0_0_6px_rgba(14,165,233,0.6)]" />
                                🔵 Min Var ({result.min_var.volatility.toFixed(1)}%, {result.min_var.return.toFixed(1)}%)
                            </span>
                            <span className="flex items-center gap-1.5">
                                <span className="inline-block w-8 border-t-2 border-dashed border-rose-500" />
                                🔴 현재 ({result.current.volatility.toFixed(1)}%, {result.current.return.toFixed(1)}%)
                            </span>
                        </div>
                    </div>

                    {/* 2. 3개 Bento 지표 카드 */}
                    <div className="flex flex-col md:flex-row gap-4">
                        <StatCard
                            icon={<Star className="w-4 h-4 text-amber-400" />}
                            label="최대 샤프 (Max Sharpe)"
                            data={result.max_sharpe}
                            colorScheme={{
                                border: 'border-amber-500/20',
                                bg: 'bg-amber-500/5',
                                badge: 'bg-amber-400',
                                text: 'text-amber-400'
                            }}
                            tickers={result.tickers}
                        />
                        <StatCard
                            icon={<Shield className="w-4 h-4 text-sky-400" />}
                            label="최소 변동성 (Min Variance)"
                            data={result.min_var}
                            colorScheme={{
                                border: 'border-sky-500/20',
                                bg: 'bg-sky-500/5',
                                badge: 'bg-sky-400',
                                text: 'text-sky-400'
                            }}
                            tickers={result.tickers}
                        />
                        <StatCard
                            icon={<Target className="w-4 h-4 text-rose-400" />}
                            label="현재 포트폴리오"
                            data={result.current}
                            colorScheme={{
                                border: 'border-rose-500/20',
                                bg: 'bg-rose-500/5',
                                badge: 'bg-rose-400',
                                text: 'text-rose-400'
                            }}
                            tickers={result.tickers}
                        />
                    </div>

                    {/* 3. 비중 비교 BarChart */}
                    {weightBarData.length > 0 && (
                        <div className="bg-[#12121A]/70 border border-white/10 rounded-2xl p-5 backdrop-blur-md">
                            <div className="flex items-center gap-2 mb-4">
                                <span className="w-1 h-5 bg-emerald-500 rounded-full" />
                                <h3 className="text-base font-bold text-white">최적 비중 비교</h3>
                                <span className="text-[10px] text-gray-500 ml-1">· 현재 vs Max Sharpe vs Min Var</span>
                            </div>
                            <ResponsiveContainer width="100%" height={Math.max(280, weightBarData.length * 45)}>
                                <BarChart
                                    data={weightBarData}
                                    layout="vertical"
                                    margin={{ top: 5, right: 40, left: 10, bottom: 5 }}
                                    barCategoryGap="25%"
                                    barGap={3}
                                >
                                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" horizontal={false} />
                                    <XAxis
                                        type="number"
                                        tickFormatter={v => `${v}%`}
                                        stroke="#374151"
                                        tick={{ fill: '#9ca3af', fontSize: 10 }}
                                        domain={[0, 100]}
                                    />
                                    <YAxis
                                        type="category"
                                        dataKey="name"
                                        width={90}
                                        stroke="#374151"
                                        tick={{ fill: '#d1d5db', fontSize: 10 }}
                                    />
                                    <Tooltip
                                        formatter={(value: number, name: string) => [`${value.toFixed(1)}%`, name]}
                                        contentStyle={{
                                            background: '#0f0f1a',
                                            border: '1px solid rgba(255,255,255,0.1)',
                                            borderRadius: '12px',
                                            fontSize: '11px'
                                        }}
                                    />
                                    <Legend
                                        wrapperStyle={{ fontSize: '11px', paddingTop: '12px' }}
                                        formatter={(value) => {
                                            if (value === 'current') return '🔴 현재';
                                            if (value === 'maxSharpe') return '⭐ Max Sharpe';
                                            if (value === 'minVar') return '🔵 Min Var';
                                            return value;
                                        }}
                                    />
                                    <Bar dataKey="current" name="current" fill="#f43f5e" fillOpacity={0.7} radius={[0, 4, 4, 0]}>
                                        {weightBarData.map((entry, index) => (
                                            <Cell key={`cur-${index}`} fill="#f43f5e" fillOpacity={0.65} />
                                        ))}
                                    </Bar>
                                    <Bar dataKey="maxSharpe" name="maxSharpe" fill="#f59e0b" fillOpacity={0.7} radius={[0, 4, 4, 0]}>
                                        {weightBarData.map((entry, index) => (
                                            <Cell key={`ms-${index}`} fill="#f59e0b" fillOpacity={0.65} />
                                        ))}
                                    </Bar>
                                    <Bar dataKey="minVar" name="minVar" fill="#0ea5e9" fillOpacity={0.7} radius={[0, 4, 4, 0]}>
                                        {weightBarData.map((entry, index) => (
                                            <Cell key={`mv-${index}`} fill="#0ea5e9" fillOpacity={0.55} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}

                    {/* 4. 분석 인사이트 요약 */}
                    <div className="bg-gradient-to-br from-indigo-500/10 to-sky-500/5 border border-indigo-500/20 rounded-2xl p-5">
                        <div className="flex items-center gap-2 mb-3">
                            <TrendingUp className="w-4 h-4 text-indigo-400" />
                            <h3 className="text-sm font-bold text-white">최적화 인사이트</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-gray-300 leading-relaxed">
                            <div className="bg-black/20 rounded-xl p-3">
                                <p className="text-amber-400 font-bold mb-1">⭐ Max Sharpe 전략</p>
                                <p>
                                    Max Sharpe 비중으로 재조정하면 동일 위험 대비 예상 수익률이
                                    <span className="text-emerald-400 font-bold mx-1">
                                        {(result.max_sharpe.return - result.current.return).toFixed(1)}%p
                                    </span>
                                    개선될 수 있습니다. (샤프지수: {result.current.sharpe.toFixed(2)} → {result.max_sharpe.sharpe.toFixed(2)})
                                </p>
                            </div>
                            <div className="bg-black/20 rounded-xl p-3">
                                <p className="text-sky-400 font-bold mb-1">🔵 Min Variance 전략</p>
                                <p>
                                    최소 변동성 비중으로 재조정하면 포트폴리오 변동성이
                                    <span className="text-sky-400 font-bold mx-1">
                                        {(result.current.volatility - result.min_var.volatility).toFixed(1)}%p
                                    </span>
                                    감소합니다. 방어적 운용에 적합합니다.
                                </p>
                            </div>
                        </div>
                        <p className="text-[10px] text-gray-600 mt-3">
                            * 과거 {lookbackYears}년 데이터 기반 추정치이며, 미래 수익률을 보장하지 않습니다. 몬테카를로 5,000회 시뮬레이션 결과입니다.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
