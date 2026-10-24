// 한국 경기선행지수(순환변동치 및 OECD CLI)와 한국 수출(년/월/일별) 추이를 시각화하는 지표 컴포넌트
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    ResponsiveContainer,
    ComposedChart,
    LineChart,
    Line,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    CartesianGrid,
    ReferenceLine
} from 'recharts';
import {
    Activity,
    TrendingUp,
    TrendingDown,
    RefreshCw,
    Sparkles,
    Calendar,
    BarChart3,
    ArrowUpRight,
    ArrowDownRight,
    HelpCircle,
    Check
} from 'lucide-react';
import { API_BASE } from '@/lib/apiConfig';

interface KRMacroItem {
    date: string;              // YYYY-MM
    leading_cycle: number | null; // 통계청 선행지수 순환변동치 (100 기준)
    oecd_cli: number | null;      // OECD 한국 CLI (100 기준)
    export_amt: number | null;    // 월간 수출액 (억 달러)
    export_yoy: number | null;    // 수출 YoY (%)
    daily_avg_export: number | null; // 일평균 수출액 (억 달러/일)
}

interface ExportItem {
    date: string;
    export_amt?: number;
    export_yoy?: number | null;
    export_daily_avg?: number;
    is_projected?: boolean;
    label?: string;
}

type ExportPeriod = 'yearly' | 'monthly' | 'daily';
type Timeframe = '1Y' | '3Y' | '5Y' | '10Y';

export default function KrMacroIndicatorSection() {
    const [krData, setKrData] = useState<KRMacroItem[]>([]);
    const [exportPeriod, setExportPeriod] = useState<ExportPeriod>('monthly');
    const [exportData, setExportData] = useState<ExportItem[]>([]);
    const [timeframe, setTimeframe] = useState<Timeframe>('5Y');
    const [loading, setLoading] = useState<boolean>(true);
    const [refreshing, setRefreshing] = useState<boolean>(false);
    const [exportLoading, setExportLoading] = useState<boolean>(false);

    // 지표 표시 토글 (한국 선행지수, OECD CLI)
    const [visibleSeries, setVisibleSeries] = useState<{ cycle: boolean; oecd: boolean }>({
        cycle: true,
        oecd: true,
    });

    // 1. 한국 경기선행지수 데이터 로드
    const fetchKrMacroData = useCallback(async (force: boolean = false) => {
        try {
            if (force) setRefreshing(true);
            const url = `${API_BASE}/api/v1/exit-signal/macro/kr${force ? '?force=true' : ''}`;
            const res = await fetch(url, {
                cache: 'no-store',
                headers: { 'Cache-Control': 'no-cache' }
            });
            if (res.ok) {
                const json = await res.json();
                if (Array.isArray(json) && json.length > 0) {
                    setKrData(json);
                    localStorage.setItem('kr_macro_cache_v1', JSON.stringify(json));
                }
            }
        } catch (err) {
            console.error('Failed to fetch KR macro data:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    // 2. 한국 수출 데이터 로드 (period: yearly, monthly, daily)
    const fetchExportData = useCallback(async (period: ExportPeriod) => {
        try {
            setExportLoading(true);
            const url = `${API_BASE}/api/v1/exit-signal/macro/kr/export?period=${period}`;
            const res = await fetch(url, {
                cache: 'no-store',
                headers: { 'Cache-Control': 'no-cache' }
            });
            if (res.ok) {
                const json = await res.json();
                if (json && Array.isArray(json.data)) {
                    setExportData(json.data);
                }
            }
        } catch (err) {
            console.error(`Failed to fetch KR export (${period}):`, err);
        } finally {
            setExportLoading(false);
        }
    }, []);

    // 초기 마운트 시 로컬스토리지 복원 및 API 호출
    useEffect(() => {
        try {
            const cached = localStorage.getItem('kr_macro_cache_v1');
            if (cached) {
                const parsed = JSON.parse(cached);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    setKrData(parsed);
                    setLoading(false);
                }
            }
        } catch {
            // ignore
        }
        fetchKrMacroData(false);
        fetchExportData('monthly');
    }, [fetchKrMacroData, fetchExportData]);

    // 수출 주기 탭 변경 시 호출
    const handlePeriodChange = (p: ExportPeriod) => {
        setExportPeriod(p);
        fetchExportData(p);
    };

    // 최신값 및 상태 계산
    const latestCycle = useMemo(() => {
        const withCycle = krData.filter(d => d.leading_cycle !== null);
        if (withCycle.length === 0) return null;
        const cur = withCycle[withCycle.length - 1];
        const prev = withCycle.length > 1 ? withCycle[withCycle.length - 2] : null;
        const diff = prev && cur.leading_cycle && prev.leading_cycle ? cur.leading_cycle - prev.leading_cycle : 0;
        return {
            date: cur.date,
            val: cur.leading_cycle,
            diff,
            isAbove100: (cur.leading_cycle ?? 100) >= 100,
        };
    }, [krData]);

    const latestOECD = useMemo(() => {
        const withOECD = krData.filter(d => d.oecd_cli !== null);
        if (withOECD.length === 0) return null;
        const cur = withOECD[withOECD.length - 1];
        const prev = withOECD.length > 1 ? withOECD[withOECD.length - 2] : null;
        const diff = prev && cur.oecd_cli && prev.oecd_cli ? cur.oecd_cli - prev.oecd_cli : 0;
        return {
            date: cur.date,
            val: cur.oecd_cli,
            diff,
            isAbove100: (cur.oecd_cli ?? 100) >= 100,
        };
    }, [krData]);

    // 경기 국면 진단 판정 (선행지수 순환변동치 100 기준 및 방향성)
    const cyclePhase = useMemo(() => {
        if (!latestCycle || latestCycle.val === null) return null;
        const val = latestCycle.val;
        const diff = latestCycle.diff;
        if (val >= 100 && diff >= 0) {
            return { name: '경기 확장 (Expansion)', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', desc: '기준선 100 상회 및 전월비 상승세 지속으로 국내 경기 활황 국면입니다.' };
        }
        if (val >= 100 && diff < 0) {
            return { name: '경기 둔화 (Slowdown)', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20', desc: '기준선 100 상회 중이나 상승 탄력 둔화로 정점 통과 후 조정을 시사합니다.' };
        }
        if (val < 100 && diff <= 0) {
            return { name: '경기 수축 (Contraction)', color: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/20', desc: '기준선 100 하회 및 하락세로 실물 경기 위축 및 재고 조정 국면입니다.' };
        }
        return { name: '경기 회복 (Recovery)', color: 'text-sky-400', bg: 'bg-sky-500/10 border-sky-500/20', desc: '기준선 100 하회권이나 저점을 통과하여 반등을 시작하는 국면입니다.' };
    }, [latestCycle]);

    // 기간 필터링된 선행지표 차트 데이터
    const filteredCycleData = useMemo(() => {
        if (krData.length === 0) return [];
        const monthsCount = timeframe === '1Y' ? 12 : timeframe === '3Y' ? 36 : timeframe === '5Y' ? 60 : 120;
        return krData.slice(-monthsCount);
    }, [krData, timeframe]);

    // 수출 최신 요약
    const latestExportSummary = useMemo(() => {
        const monthlyRecords = krData.filter(d => d.export_amt !== null);
        if (monthlyRecords.length === 0) return null;
        const cur = monthlyRecords[monthlyRecords.length - 1];
        const prev = monthlyRecords.length > 1 ? monthlyRecords[monthlyRecords.length - 2] : null;
        return {
            date: cur.date,
            amt: cur.export_amt,
            yoy: cur.export_yoy,
            dailyAvg: cur.daily_avg_export,
            prevAmt: prev ? prev.export_amt : null,
        };
    }, [krData]);

    return (
        <div className="w-full flex flex-col gap-4 mt-2 mb-4">
            {/* 1. 상단 섹션 헤더 (한국 경기 지표) */}
            <div
                id="kr-economy-title"
                className="scroll-mt-28 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-blue-950/40 via-indigo-950/30 to-black/30 p-4 lg:p-5 rounded-2xl border border-blue-500/20 backdrop-blur-md w-full shadow-lg"
            >
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 via-indigo-500 to-sky-400 flex items-center justify-center shadow-lg shadow-blue-500/25 shrink-0">
                        <Activity className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <div className="flex flex-wrap items-center gap-2.5">
                            <h2 className="text-xl font-extrabold text-white tracking-tight">한국 경기 지표</h2>
                            <span className="text-[10px] font-bold text-sky-400 bg-sky-500/10 border border-sky-400/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                                <Sparkles className="w-3 h-3" />
                                경기 순환 & 수출입
                            </span>
                        </div>
                        <p className="text-xs text-slate-300 font-medium mt-0.5">
                            통계청 경기선행종합지수 순환변동치 · OECD 한국 CLI 및 대한민국 수출입 사이클 추이
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 self-end md:self-center">
                    <button
                        onClick={() => {
                            fetchKrMacroData(true);
                            fetchExportData(exportPeriod);
                        }}
                        disabled={refreshing}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 active:scale-95 border border-blue-400/30 text-xs font-semibold text-blue-200 hover:text-white transition-all disabled:opacity-50"
                        title="한국은행 ECOS, 통계청, OECD 최신 데이터 강제 동기화"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 text-sky-400 ${refreshing ? 'animate-spin' : ''}`} />
                        <span>{refreshing ? '최신화 중...' : '최신 동기화'}</span>
                    </button>
                </div>
            </div>

            {/* 2. 핵심 컨텐츠 그리드 (선행지표 비교 + 수출 추이 2단 배치) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

                {/* 컨텐츠 1: 한국 선행지수 순환변동치 vs OECD 한국 선행지수 */}
                <div className="bg-[#121217]/70 border border-white/10 rounded-2xl p-4 lg:p-5 backdrop-blur-md shadow-xl flex flex-col justify-between">
                    <div>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                            <div>
                                <h3 className="text-base font-bold text-white flex items-center gap-2">
                                    <TrendingUp className="w-4 h-4 text-sky-400" />
                                    선행지수 순환변동치 & OECD CLI
                                </h3>
                                <p className="text-[11px] text-gray-400 mt-0.5">
                                    100p 기준선 상회 시 확장, 하회 시 수축 국면을 나타냅니다.
                                </p>
                            </div>

                            {/* 기간 선택 버튼 (1Y, 3Y, 5Y, 10Y) */}
                            <div className="flex bg-black/40 rounded-lg p-0.5 border border-white/10 shrink-0 self-start sm:self-auto">
                                {(['1Y', '3Y', '5Y', '10Y'] as Timeframe[]).map(tf => (
                                    <button
                                        key={tf}
                                        onClick={() => setTimeframe(tf)}
                                        className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all ${
                                            timeframe === tf
                                                ? 'bg-blue-600 text-white shadow-sm'
                                                : 'text-gray-400 hover:text-white'
                                        }`}
                                    >
                                        {tf}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* 요약 스탯 카드 2종 (통계청 vs OECD) */}
                        <div className="grid grid-cols-2 gap-2.5 mb-3">
                            {/* 통계청 선행지수 순환변동치 */}
                            <div className="bg-blue-950/20 border border-blue-500/20 rounded-xl p-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-[11px] font-semibold text-sky-300">통계청 선행 순환변동치</span>
                                    {latestCycle && (
                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                            latestCycle.diff >= 0 ? 'bg-sky-500/20 text-sky-300' : 'bg-rose-500/20 text-rose-300'
                                        }`}>
                                            {latestCycle.diff >= 0 ? `+${latestCycle.diff.toFixed(1)}p` : `${latestCycle.diff.toFixed(1)}p`}
                                        </span>
                                    )}
                                </div>
                                <div className="text-xl font-black text-white font-mono mt-1">
                                    {latestCycle?.val !== null && latestCycle?.val !== undefined ? `${latestCycle.val.toFixed(1)}p` : 'N/A'}
                                </div>
                                <div className="text-[10px] text-gray-400 mt-1 flex items-center justify-between">
                                    <span>기준 100 {latestCycle?.isAbove100 ? '상회 (확장)' : '하회 (수축)'}</span>
                                    <span className="font-mono text-gray-500">{latestCycle?.date}</span>
                                </div>
                            </div>

                            {/* OECD 한국 선행지수 */}
                            <div className="bg-indigo-950/20 border border-indigo-500/20 rounded-xl p-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-[11px] font-semibold text-indigo-300">OECD 한국 CLI</span>
                                    {latestOECD && (
                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                            latestOECD.diff >= 0 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                                        }`}>
                                            {latestOECD.diff >= 0 ? `+${latestOECD.diff.toFixed(2)}p` : `${latestOECD.diff.toFixed(2)}p`}
                                        </span>
                                    )}
                                </div>
                                <div className="text-xl font-black text-white font-mono mt-1">
                                    {latestOECD?.val !== null && latestOECD?.val !== undefined ? `${latestOECD.val.toFixed(2)}p` : 'N/A'}
                                </div>
                                <div className="text-[10px] text-gray-400 mt-1 flex items-center justify-between">
                                    <span>장기 추세 {latestOECD?.isAbove100 ? '상회' : '하회'}</span>
                                    <span className="font-mono text-gray-500">{latestOECD?.date}</span>
                                </div>
                            </div>
                        </div>

                        {/* 범례 토글 버튼 */}
                        <div className="flex items-center gap-3 mb-2 text-xs">
                            <button
                                onClick={() => setVisibleSeries(prev => ({ ...prev, cycle: !prev.cycle }))}
                                className={`flex items-center gap-1.5 px-2 py-0.5 rounded transition ${
                                    visibleSeries.cycle ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30' : 'text-gray-500 opacity-60'
                                }`}
                            >
                                <span className="w-2.5 h-0.5 bg-sky-400 rounded-full" />
                                <span className="font-medium text-[11px]">선행지수 순환변동치(통계청)</span>
                            </button>
                            <button
                                onClick={() => setVisibleSeries(prev => ({ ...prev, oecd: !prev.oecd }))}
                                className={`flex items-center gap-1.5 px-2 py-0.5 rounded transition ${
                                    visibleSeries.oecd ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'text-gray-500 opacity-60'
                                }`}
                            >
                                <span className="w-2.5 h-0.5 bg-indigo-400 rounded-full border-t border-dashed" />
                                <span className="font-medium text-[11px]">OECD 한국 CLI</span>
                            </button>
                        </div>

                        {/* 시계열 차트 (선행지표 비교) */}
                        <div className="w-full h-[230px] bg-black/20 rounded-xl border border-white/5 p-2 relative">
                            {loading ? (
                                <div className="absolute inset-0 flex items-center justify-center text-xs text-gray-400">
                                    <RefreshCw className="w-4 h-4 animate-spin text-sky-400 mr-2" />
                                    지표 로드 중...
                                </div>
                            ) : (
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={filteredCycleData} margin={{ top: 10, right: 12, left: -22, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                                        <XAxis
                                            dataKey="date"
                                            stroke="#64748b"
                                            tick={{ fontSize: 10, fill: '#94a3b8' }}
                                            tickFormatter={(v: string) => v.slice(2)}
                                        />
                                        <YAxis
                                            stroke="#64748b"
                                            domain={['auto', 'auto']}
                                            tick={{ fontSize: 10, fill: '#94a3b8' }}
                                            tickFormatter={(v: number) => v.toFixed(0)}
                                        />
                                        <Tooltip
                                            contentStyle={{
                                                backgroundColor: 'rgba(15, 23, 42, 0.95)',
                                                border: '1px solid rgba(255,255,255,0.15)',
                                                borderRadius: '8px',
                                                fontSize: '11px',
                                                color: '#f8fafc',
                                            }}
                                            formatter={(value: any, name: string) => {
                                                const v = Number(value);
                                                const diff100 = (v - 100).toFixed(2);
                                                const sign = Number(diff100) > 0 ? `(+${diff100}p)` : `(${diff100}p)`;
                                                return [`${v.toFixed(2)}p ${sign}`, name];
                                            }}
                                        />
                                        {/* 기준선 100 */}
                                        <ReferenceLine
                                            y={100}
                                            stroke="#94a3b8"
                                            strokeDasharray="4 4"
                                            strokeWidth={1.5}
                                            label={{ value: '기준 100', position: 'insideTopRight', fill: '#94a3b8', fontSize: 10 }}
                                        />
                                        {visibleSeries.cycle && (
                                            <Line
                                                type="monotone"
                                                name="선행지수 순환변동치"
                                                dataKey="leading_cycle"
                                                stroke="#38bdf8"
                                                strokeWidth={2.2}
                                                dot={false}
                                                activeDot={{ r: 4, fill: '#38bdf8' }}
                                            />
                                        )}
                                        {visibleSeries.oecd && (
                                            <Line
                                                type="monotone"
                                                name="OECD CLI Korea"
                                                dataKey="oecd_cli"
                                                stroke="#818cf8"
                                                strokeWidth={1.8}
                                                strokeDasharray="4 3"
                                                dot={false}
                                                activeDot={{ r: 4, fill: '#818cf8' }}
                                            />
                                        )}
                                    </LineChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                    </div>

                    {/* 하단 국면 해설 배너 */}
                    {cyclePhase && (
                        <div className={`mt-3 p-2.5 rounded-xl border ${cyclePhase.bg} text-xs flex items-center justify-between gap-2`}>
                            <div className="flex items-center gap-2">
                                <span className={`font-bold ${cyclePhase.color} shrink-0`}>
                                    ● {cyclePhase.name}
                                </span>
                                <span className="text-[11px] text-gray-300 line-clamp-1">{cyclePhase.desc}</span>
                            </div>
                            <span className="text-[10px] text-gray-400 shrink-0 font-mono">출처: KOSIS · FRED</span>
                        </div>
                    )}
                </div>

                {/* 컨텐츠 2: 한국 수출 그래프 추이 (년 / 월간 / 일별 탭) */}
                <div className="bg-[#121217]/70 border border-white/10 rounded-2xl p-4 lg:p-5 backdrop-blur-md shadow-xl flex flex-col justify-between">
                    <div>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                            <div>
                                <h3 className="text-base font-bold text-white flex items-center gap-2">
                                    <BarChart3 className="w-4 h-4 text-indigo-400" />
                                    대한민국 수출 실적 추이
                                </h3>
                                <p className="text-[11px] text-gray-400 mt-0.5">
                                    관세청 및 한국은행 공표 통관 기준 수출 실적 및 YoY 증감률
                                </p>
                            </div>

                            {/* 년 / 월간 / 일별 탭 버튼 */}
                            <div className="flex bg-black/40 rounded-lg p-0.5 border border-white/10 shrink-0 self-start sm:self-auto">
                                <button
                                    onClick={() => handlePeriodChange('yearly')}
                                    className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                                        exportPeriod === 'yearly'
                                            ? 'bg-indigo-600 text-white shadow-sm'
                                            : 'text-gray-400 hover:text-white'
                                    }`}
                                >
                                    년(연간)
                                </button>
                                <button
                                    onClick={() => handlePeriodChange('monthly')}
                                    className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                                        exportPeriod === 'monthly'
                                            ? 'bg-indigo-600 text-white shadow-sm'
                                            : 'text-gray-400 hover:text-white'
                                    }`}
                                >
                                    월간
                                </button>
                                <button
                                    onClick={() => handlePeriodChange('daily')}
                                    className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                                        exportPeriod === 'daily'
                                            ? 'bg-indigo-600 text-white shadow-sm'
                                            : 'text-gray-400 hover:text-white'
                                    }`}
                                >
                                    일별(일평균)
                                </button>
                            </div>
                        </div>

                        {/* 요약 스탯 카드 (최신 수출액, YoY 증감률, 일평균) */}
                        <div className="grid grid-cols-3 gap-2 mb-3">
                            <div className="bg-white/5 border border-white/5 rounded-xl p-2.5">
                                <span className="text-[10px] text-gray-400">최근 월간 수출액</span>
                                <div className="text-lg font-black text-white font-mono mt-0.5">
                                    {latestExportSummary?.amt !== null ? `${latestExportSummary?.amt}억$` : 'N/A'}
                                </div>
                                <span className="text-[10px] text-gray-500 font-mono">{latestExportSummary?.date} 기준</span>
                            </div>

                            <div className="bg-white/5 border border-white/5 rounded-xl p-2.5">
                                <span className="text-[10px] text-gray-400">수출 증감률 (YoY)</span>
                                <div className={`text-lg font-black font-mono mt-0.5 flex items-center gap-0.5 ${
                                    (latestExportSummary?.yoy ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                                }`}>
                                    {(latestExportSummary?.yoy ?? 0) >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                                    {latestExportSummary?.yoy !== null ? `${latestExportSummary?.yoy}%` : 'N/A'}
                                </div>
                                <span className="text-[10px] text-gray-500">전년동월대비</span>
                            </div>

                            <div className="bg-white/5 border border-white/5 rounded-xl p-2.5">
                                <span className="text-[10px] text-gray-400">조업일수 감안 일평균</span>
                                <div className="text-lg font-black text-sky-400 font-mono mt-0.5">
                                    {latestExportSummary?.dailyAvg !== null ? `${latestExportSummary?.dailyAvg}억$` : 'N/A'}
                                </div>
                                <span className="text-[10px] text-gray-500">일당 평균 실적</span>
                            </div>
                        </div>

                        {/* 수출 차트 (년 / 월간 / 일별 전환 지원) */}
                        <div className="w-full h-[230px] bg-black/20 rounded-xl border border-white/5 p-2 relative">
                            {exportLoading ? (
                                <div className="absolute inset-0 flex items-center justify-center text-xs text-gray-400">
                                    <RefreshCw className="w-4 h-4 animate-spin text-indigo-400 mr-2" />
                                    수출 데이터 로드 중...
                                </div>
                            ) : (
                                <ResponsiveContainer width="100%" height="100%">
                                    {exportPeriod === 'daily' ? (
                                        <LineChart data={exportData} margin={{ top: 10, right: 12, left: -22, bottom: 5 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                                            <XAxis
                                                dataKey="date"
                                                stroke="#64748b"
                                                tick={{ fontSize: 9, fill: '#94a3b8' }}
                                                tickFormatter={(v: string) => v.slice(2)}
                                            />
                                            <YAxis
                                                stroke="#64748b"
                                                domain={['auto', 'auto']}
                                                tick={{ fontSize: 10, fill: '#94a3b8' }}
                                                unit="억$"
                                            />
                                            <Tooltip
                                                contentStyle={{
                                                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                                                    border: '1px solid rgba(255,255,255,0.15)',
                                                    borderRadius: '8px',
                                                    fontSize: '11px',
                                                    color: '#f8fafc',
                                                }}
                                                formatter={(val: any) => [`${val}억 달러/일`, '일평균 수출액']}
                                            />
                                            <Line
                                                type="monotone"
                                                name="일평균 수출액"
                                                dataKey="export_daily_avg"
                                                stroke="#38bdf8"
                                                strokeWidth={2}
                                                dot={{ r: 2, fill: '#38bdf8' }}
                                                activeDot={{ r: 4 }}
                                            />
                                        </LineChart>
                                    ) : (
                                        <ComposedChart data={exportData} margin={{ top: 10, right: 12, left: -20, bottom: 5 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                                            <XAxis
                                                dataKey="date"
                                                stroke="#64748b"
                                                tick={{ fontSize: 10, fill: '#94a3b8' }}
                                                tickFormatter={(v: string) => (exportPeriod === 'yearly' ? v : v.slice(2))}
                                            />
                                            <YAxis
                                                yAxisId="left"
                                                stroke="#64748b"
                                                domain={['auto', 'auto']}
                                                tick={{ fontSize: 10, fill: '#94a3b8' }}
                                                unit="억$"
                                            />
                                            <YAxis
                                                yAxisId="right"
                                                orientation="right"
                                                stroke="#64748b"
                                                domain={['auto', 'auto']}
                                                tick={{ fontSize: 10, fill: '#94a3b8' }}
                                                unit="%"
                                            />
                                            <Tooltip
                                                contentStyle={{
                                                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                                                    border: '1px solid rgba(255,255,255,0.15)',
                                                    borderRadius: '8px',
                                                    fontSize: '11px',
                                                    color: '#f8fafc',
                                                }}
                                                formatter={(val: any, name: string) => {
                                                    if (name.includes('증감률') || name.includes('YoY')) return [`${val}%`, name];
                                                    return [`${Number(val).toLocaleString()}억 달러`, name];
                                                }}
                                            />
                                            <Bar
                                                yAxisId="left"
                                                name={exportPeriod === 'yearly' ? '연간 수출 총액' : '월간 수출액'}
                                                dataKey="export_amt"
                                                fill="#6366f1"
                                                radius={[4, 4, 0, 0]}
                                                opacity={0.85}
                                            />
                                            <Line
                                                yAxisId="right"
                                                type="monotone"
                                                name="수출 증감률 (YoY)"
                                                dataKey="export_yoy"
                                                stroke="#34d399"
                                                strokeWidth={2}
                                                dot={{ r: 2.5, fill: '#34d399' }}
                                                activeDot={{ r: 4.5 }}
                                            />
                                        </ComposedChart>
                                    )}
                                </ResponsiveContainer>
                            )}
                        </div>
                    </div>

                    {/* 하단 설명 배너 */}
                    <div className="mt-3 p-2.5 rounded-xl border border-white/5 bg-black/20 text-xs flex items-center justify-between text-gray-400">
                        <div className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
                            <span className="text-[11px] text-gray-300">
                                {exportPeriod === 'yearly'
                                    ? '연간 통계 (현재 연도는 연환산 추정치 포함)'
                                    : exportPeriod === 'daily'
                                    ? '관세청 조업일수 감안 일평균 수출 모멘텀'
                                    : '월간 통관 실적 및 전년 동월 대비 성장률 추세'}
                            </span>
                        </div>
                        <span className="text-[10px] text-gray-500 font-mono">출처: 관세청 · 한국은행</span>
                    </div>
                </div>

            </div>
        </div>
    );
}
