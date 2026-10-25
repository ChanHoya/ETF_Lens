'use client';
// 공통 매크로 지표 상세 팝업 모달 — 6M, 1Y, 5Y, 10Y 기간 스위처 및 실제 데이터 멀티 라인 추이 차트
import React, { useState, useMemo, useEffect } from 'react';
import {
    ResponsiveContainer, ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid,
    Tooltip as RechartsTooltip, Legend
} from 'recharts';
import { X, Calendar, TrendingUp, Info, Activity, ExternalLink } from 'lucide-react';
import DataSourceCaption from './common/DataSourceCaption';

export type SeriesConfig = {
    key: string;
    name: string;
    color: string;
    unit?: string;
    yAxisId?: 'left' | 'right';
    strokeWidth?: number;
    strokeDasharray?: string;
    dot?: boolean;
    rawKey?: string;
    rawUnit?: string;
    type?: 'line' | 'area';
};

export type DetailDataPoint = {
    date: string;
    [key: string]: string | number | null | undefined;
};

export interface MarketDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    badge?: string;
    category?: string;
    badgeColor?: string;
    subtitle?: string;
    description?: string;
    series: SeriesConfig[];
    data: DetailDataPoint[];
    currentStats?: { label: string; value: string | number; change?: string; subValue?: string; isPositive?: boolean; isAccent?: boolean }[];
    kpiCards?: { label: string; value: string | number; change?: string; subValue?: string; isPositive?: boolean; isAccent?: boolean }[];
    notice?: string;
    sources?: string[];
    updateFrequency?: string;
    defaultPeriod?: '6M' | '1Y' | '5Y' | '10Y';
    rebaseOnPeriod?: boolean;
    children?: React.ReactNode;
    headerActions?: React.ReactNode;
    maxWidthClassName?: string;
}

const PERIODS = ['6M', '1Y', '5Y', '10Y'] as const;
type Period = typeof PERIODS[number];

import { STANDARD_TOOLTIP_STYLE, STANDARD_LEGEND_WRAPPER_STYLE, useChartHighlight } from '@/lib/chartTheme';

const axisTick = { fill: '#9ca3af', fontSize: 10 };

export default function MarketDetailModal({
    isOpen,
    onClose,
    title,
    badge,
    category,
    badgeColor = 'bg-indigo-500/15 text-indigo-300 border-indigo-400/30',
    subtitle,
    description,
    series,
    data,
    currentStats,
    kpiCards,
    notice,
    sources,
    updateFrequency = '실시간 시세 및 공식 공표치 반영',
    defaultPeriod = '1Y',
    rebaseOnPeriod = false,
    children,
    headerActions,
    maxWidthClassName = 'max-w-4xl',
}: MarketDetailModalProps) {
    const [period, setPeriod] = useState<Period>(defaultPeriod);
    const displayBadge = badge || category;
    const statsList = currentStats || kpiCards;
    const displaySub = subtitle || description;

    // ESC 키로 닫기
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        if (isOpen) {
            window.addEventListener('keydown', handleKeyDown);
            document.body.style.overflow = 'hidden';
        }
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = 'unset';
        };
    }, [isOpen, onClose]);

    // 기간별 데이터 필터링 (필요 시 선택 기간 시작점 기준 100 정규화)
    const filteredData = useMemo(() => {
        if (!data || data.length === 0) return [];
        const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date));
        const lastDateStr = sorted[sorted.length - 1].date;
        const lastDate = new Date(lastDateStr);

        let cutoffDate = new Date(lastDate);
        if (period === '6M') {
            cutoffDate.setMonth(cutoffDate.getMonth() - 6);
        } else if (period === '1Y') {
            cutoffDate.setFullYear(cutoffDate.getFullYear() - 1);
        } else if (period === '5Y') {
            cutoffDate.setFullYear(cutoffDate.getFullYear() - 5);
        } else if (period === '10Y') {
            cutoffDate.setFullYear(cutoffDate.getFullYear() - 10);
        }

        const cutoffStr = cutoffDate.toISOString().slice(0, 10);
        const filtered = sorted.filter(d => d.date >= cutoffStr);
        const result = filtered.length > 0 ? filtered : sorted;

        if (!rebaseOnPeriod || result.length === 0) return result;

        // 선택한 기간의 첫 유효 관측치를 Base=100으로 정규화
        const baseValues: Record<string, number> = {};
        series.forEach(s => {
            const field = s.rawKey || s.key;
            const firstValid = result.find(r => r[field] != null && typeof r[field] === 'number' && (r[field] as number) > 0);
            if (firstValid) {
                baseValues[s.key] = firstValid[field] as number;
            }
        });

        return result.map(row => {
            const newRow = { ...row };
            series.forEach(s => {
                const base = baseValues[s.key];
                const field = s.rawKey || s.key;
                const cur = row[field];
                if (base && cur != null && typeof cur === 'number') {
                    newRow[s.key] = +((cur / base) * 100).toFixed(2);
                }
            });
            return newRow;
        });
    }, [data, period, rebaseOnPeriod, series]);

    const [hiddenSeries, setHiddenSeries] = useState<Record<string, boolean>>({});
    const { highlightedKey, handleLegendClick, getOpacity, getStrokeWidth, renderLegendText } = useChartHighlight();

    // 모달이 열릴 때나 타이틀이 바뀔 때 초기화
    useEffect(() => {
        setHiddenSeries({});
    }, [isOpen, title]);

    const toggleSeries = (key: string) => {
        setHiddenSeries(prev => ({
            ...prev,
            [key]: !prev[key]
        }));
    };

    // 활성화된 시리즈 목록
    const activeSeries = useMemo(() => {
        return series.filter(s => !hiddenSeries[s.key]);
    }, [series, hiddenSeries]);

    // 듀얼 Y축 사용 여부 판단
    const hasRightAxis = useMemo(() => {
        return activeSeries.some(s => s.yAxisId === 'right');
    }, [activeSeries]);

    // 우측 축 지표들의 주 단위 판별
    const rightAxisUnit = useMemo(() => {
        const rightList = activeSeries.filter(s => s.yAxisId === 'right');
        if (rightList.length === 0) return '';
        const allPercent = rightList.every(s => s.unit?.includes('%'));
        if (allPercent) return '%';
        const allPt = rightList.every(s => s.unit?.includes('pt'));
        if (allPt) return 'pt';
        return '';
    }, [activeSeries]);

    // X축 눈금 레이블 포맷터
    const formatXAxis = (dateStr: string) => {
        if (!dateStr) return '';
        if (period === '6M' || period === '1Y') {
            return dateStr.slice(5); // MM-DD
        }
        return dateStr.slice(0, 7); // YYYY-MM
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
            <div
                className={`relative w-full ${maxWidthClassName} bg-[#13151f] border border-white/10 rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden`}
                onClick={e => e.stopPropagation()}
            >
                {/* 1. Header (컴팩트 디자인) */}
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10 bg-[#161926]/90">
                    <div className="flex items-center gap-2.5">
                        <span className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                            <Activity className="w-4 h-4" />
                        </span>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-base font-extrabold text-white leading-tight">{title}</h3>
                                {displayBadge && (
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badgeColor}`}>
                                        {displayBadge}
                                    </span>
                                )}
                            </div>
                            {displaySub && (
                                <p className="text-[11px] text-gray-400 mt-0.5">{displaySub}</p>
                            )}
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                        title="닫기 (ESC)"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* 2. Control Toolbar (기간 선택 및 실시간 요약 칩) */}
                <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-2.5 bg-[#181a28]/60 border-b border-white/5">
                    {/* 기간 선택 버튼 (컴팩트: text-xs, px-2 py-0.5) */}
                    <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-medium text-gray-400 mr-1 flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-gray-500" />
                            기간:
                        </span>
                        {PERIODS.map(p => (
                            <button
                                key={p}
                                onClick={() => setPeriod(p)}
                                className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border transition-all ${
                                    period === p
                                        ? 'bg-amber-500 text-black border-amber-400 font-bold shadow-sm shadow-amber-500/20'
                                        : 'bg-white/5 text-gray-400 border-white/10 hover:text-white hover:bg-white/10'
                                }`}
                            >
                                {p}
                            </button>
                        ))}
                    </div>

                    {/* 실시간 주요 수치 칩 */}
                    {statsList && statsList.length > 0 && (
                        <div className="flex items-center gap-2.5 overflow-x-auto scrollbar-none py-0.5">
                            {statsList.map((st, idx) => (
                                <div key={idx} className={`flex items-baseline gap-1.5 px-2 py-0.5 rounded-md border text-[11px] ${st.isAccent ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300' : 'bg-white/[0.04] border-white/5'}`}>
                                    <span className="text-gray-400">{st.label}:</span>
                                    <span className="font-extrabold text-white font-mono">{st.value}</span>
                                    {(st.change || st.subValue) && (
                                        <span className={`text-[10px] font-bold ${st.isPositive ? 'text-red-400' : st.isPositive === false ? 'text-blue-400' : 'text-gray-400'}`}>
                                            {st.change || st.subValue}
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* 추가 헤더 액션 (예: 지수화 토글 등) */}
                    {headerActions && (
                        <div className="flex items-center gap-2">
                            {headerActions}
                        </div>
                    )}
                </div>

                {/* 2-1. Indicator Filter Chips (사용자가 원하는 라인만 켜고 끌 수 있는 인터랙티브 필터) */}
                {series && series.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 px-5 py-2 bg-[#151827] border-b border-white/5">
                        <span className="text-[10px] font-bold text-gray-400 mr-1">지표 선택:</span>
                        {series.map(s => {
                            const isHidden = !!hiddenSeries[s.key];
                            return (
                                <button
                                    key={s.key}
                                    type="button"
                                    onClick={() => toggleSeries(s.key)}
                                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium border transition-all ${
                                        isHidden
                                            ? 'bg-white/[0.02] border-white/5 text-gray-500 opacity-50 line-through'
                                            : 'bg-white/[0.06] border-white/15 text-gray-200 hover:bg-white/10 shadow-sm'
                                    }`}
                                    title={`${s.name} ${isHidden ? '차트에 표시하기' : '차트에서 숨기기'}`}
                                >
                                    <span
                                        className="w-2 h-2 rounded-full inline-block shrink-0"
                                        style={{ backgroundColor: isHidden ? '#6b7280' : s.color }}
                                    />
                                    <span>{s.name}</span>
                                    {s.yAxisId === 'right' && (
                                        <span className="text-[9px] px-1 py-0.2 bg-white/10 text-amber-300/80 rounded font-mono">우측축</span>
                                    )}
                                </button>
                            );
                        })}
                        {series.length >= 4 && (
                            <button
                                type="button"
                                onClick={() => {
                                    const anyHidden = series.some(s => hiddenSeries[s.key]);
                                    if (anyHidden) {
                                        setHiddenSeries({});
                                    } else {
                                        const newHidden: Record<string, boolean> = {};
                                        // 우측축 지표들을 숨겨 메인 지표만 남김
                                        series.forEach(s => {
                                            if (s.yAxisId === 'right') newHidden[s.key] = true;
                                        });
                                        setHiddenSeries(newHidden);
                                    }
                                }}
                                className="text-[10px] font-semibold text-indigo-400 hover:text-indigo-300 underline ml-2 cursor-pointer"
                            >
                                {series.some(s => hiddenSeries[s.key]) ? '전체 보기' : '메인 지표만'}
                            </button>
                        )}
                    </div>
                )}

                {/* 3. Main Chart Area */}
                <div className="p-5 flex-1 flex flex-col min-h-[340px] overflow-y-auto">
                    {description && (
                        <p className="text-xs text-gray-400 mb-3 bg-white/[0.02] border border-white/5 rounded-xl p-2.5 leading-relaxed">
                            {description}
                        </p>
                    )}

                    <div className="w-full h-[320px] sm:h-[360px] min-h-[320px] sm:min-h-[360px] shrink-0 relative">
                        {filteredData.length === 0 ? (
                            <div className="w-full h-full flex items-center justify-center text-xs text-gray-500">
                                시계열 데이터를 불러오는 중이거나 데이터가 없습니다.
                            </div>
                        ) : activeSeries.length === 0 ? (
                            <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">
                                상단 지표 필터에서 최소 하나의 지표를 선택해주세요.
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart
                                    key={`modal-chart-${period}-${activeSeries.map(s => s.key).join('-')}`}
                                    data={filteredData}
                                    margin={{ top: 10, right: hasRightAxis ? 20 : 5, left: -10, bottom: 0 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff0a" vertical={false} />
                                    <XAxis
                                        dataKey="date"
                                        tick={axisTick}
                                        tickFormatter={formatXAxis}
                                        minTickGap={24}
                                        stroke="#ffffff15"
                                    />
                                    <YAxis
                                        yAxisId="left"
                                        tick={axisTick}
                                        domain={['auto', 'auto']}
                                        stroke="#ffffff15"
                                        tickFormatter={(v: number) => (Math.abs(v) >= 1000 ? v.toLocaleString() : (v % 1 !== 0 ? v.toFixed(1) : v.toString()))}
                                    />
                                    {hasRightAxis && (
                                        <YAxis
                                            yAxisId="right"
                                            orientation="right"
                                            tick={axisTick}
                                            domain={['auto', 'auto']}
                                            stroke="#ffffff15"
                                            tickFormatter={(v: number) => {
                                                if (rightAxisUnit === '%') return `${v}%`;
                                                if (Math.abs(v) >= 1000) return v.toLocaleString();
                                                return v % 1 !== 0 ? v.toFixed(1) : v.toString();
                                            }}
                                        />
                                    )}
                                    <RechartsTooltip
                                        contentStyle={STANDARD_TOOLTIP_STYLE}
                                        labelFormatter={(label) => `일자: ${label}`}
                                        formatter={(val: any, name: any, item: any) => {
                                            const cfg = series.find(s => s.name === name || s.key === name);
                                            const unit = cfg?.unit || '';
                                            const formattedVal = typeof val === 'number'
                                                ? (Math.abs(val) < 10 && val % 1 !== 0 ? val.toFixed(2) : val.toLocaleString())
                                                : val;
                                            
                                            // 원본 환율 수치가 제공된 경우 함께 병기
                                            let rawNote = '';
                                            if (cfg?.rawKey && item?.payload) {
                                                const rawVal = item.payload[cfg.rawKey];
                                                if (rawVal != null) {
                                                    const rawFormatted = typeof rawVal === 'number'
                                                        ? (rawVal > 10 ? rawVal.toFixed(2) : rawVal.toFixed(4))
                                                        : rawVal;
                                                    rawNote = ` (실제 환율: ${rawFormatted}${cfg.rawUnit ? ` ${cfg.rawUnit}` : ''})`;
                                                }
                                            }

                                            return [`${formattedVal} ${unit}${rawNote}`, name];
                                        }}
                                    />
                                    <Legend
                                        wrapperStyle={STANDARD_LEGEND_WRAPPER_STYLE}
                                        iconType="plainline"
                                        onClick={handleLegendClick}
                                        formatter={renderLegendText}
                                    />
                                    {activeSeries.map(s => {
                                        const opacity = getOpacity(s.key, 1, 0.2);
                                        const width = getStrokeWidth(s.key, s.strokeWidth || 2, (s.strokeWidth || 2) + 1.5);
                                        if (s.type === 'area') {
                                            return (
                                                <Area
                                                    key={s.key}
                                                    type="monotone"
                                                    dataKey={s.key}
                                                    name={s.name}
                                                    stroke={s.color}
                                                    fill={s.color}
                                                    fillOpacity={0.15}
                                                    yAxisId={s.yAxisId || 'left'}
                                                    strokeWidth={width}
                                                    strokeOpacity={opacity}
                                                    connectNulls
                                                    isAnimationActive={false}
                                                />
                                            );
                                        }
                                        return (
                                            <Line
                                                key={s.key}
                                                type="monotone"
                                                dataKey={s.key}
                                                name={s.name}
                                                stroke={s.color}
                                                yAxisId={s.yAxisId || 'left'}
                                                strokeWidth={width}
                                                strokeOpacity={opacity}
                                                strokeDasharray={s.strokeDasharray}
                                                dot={s.dot ? { r: 2.5, fill: s.color, opacity } : false}
                                                connectNulls
                                                isAnimationActive={false}
                                            />
                                        );
                                    })}
                                </ComposedChart>
                            </ResponsiveContainer>
                        )}
                    </div>

                    {/* 4. Notice / Footnote */}
                    {notice && (
                        <div className="mt-3.5 flex items-start gap-2 text-[11px] text-gray-400 bg-indigo-500/[0.06] border border-indigo-400/15 rounded-xl p-2.5">
                            <Info className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
                            <div className="leading-snug">{notice}</div>
                        </div>
                    )}

                    {/* 4-1. Custom Children Slot (공식 안내, 상세 표 등) */}
                    {children}
                </div>

                {/* 5. Footer */}
                <div className="px-5 py-2.5 border-t border-white/10 bg-[#161926]/90 flex flex-col sm:flex-row items-center justify-between gap-2">
                    <DataSourceCaption
                        sources={sources || ['미국 세인트루이스 연준(FRED)', '한국은행 ECOS', 'Yahoo Finance', 'S&P Global']}
                        updateFrequency={updateFrequency}
                        className="w-full sm:w-auto mt-0"
                    />
                    <button
                        onClick={onClose}
                        className="px-4 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-xs font-bold text-gray-200 transition-colors ml-auto"
                    >
                        닫기
                    </button>
                </div>
            </div>
        </div>
    );
}
