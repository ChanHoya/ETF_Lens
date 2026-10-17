'use client';
// 공통 매크로 지표 상세 팝업 모달 — 6M, 1Y, 5Y, 10Y 기간 스위처 및 실제 데이터 멀티 라인 추이 차트
import React, { useState, useMemo, useEffect } from 'react';
import {
    ResponsiveContainer, ComposedChart, Line, XAxis, YAxis, CartesianGrid,
    Tooltip as RechartsTooltip, Legend
} from 'recharts';
import { X, Calendar, TrendingUp, Info, Activity, ExternalLink } from 'lucide-react';

export type SeriesConfig = {
    key: string;
    name: string;
    color: string;
    unit?: string;
    yAxisId?: 'left' | 'right';
    strokeWidth?: number;
    strokeDasharray?: string;
    dot?: boolean;
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
    defaultPeriod?: '6M' | '1Y' | '5Y' | '10Y';
}

const PERIODS = ['6M', '1Y', '5Y', '10Y'] as const;
type Period = typeof PERIODS[number];

const TOOLTIP_STYLE = {
    background: '#151722f0',
    backdropFilter: 'blur(8px)',
    border: '1px solid #ffffff20',
    borderRadius: 10,
    fontSize: 11,
    boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
    padding: '8px 12px'
};

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
    defaultPeriod = '1Y',
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

    // 기간별 데이터 필터링
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
        return filtered.length > 0 ? filtered : sorted;
    }, [data, period]);

    // 듀얼 Y축 사용 여부 판단
    const hasRightAxis = useMemo(() => {
        return series.some(s => s.yAxisId === 'right');
    }, [series]);

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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
            <div
                className="relative w-full max-w-4xl bg-[#13151f] border border-white/10 rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden"
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

                {/* 2. Control Toolbar (첨부 5 피드백 반영: 컴팩트한 선택형 버튼) */}
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
                </div>

                {/* 3. Main Chart Area */}
                <div className="p-5 flex-1 flex flex-col min-h-[340px] overflow-y-auto">
                    {description && (
                        <p className="text-xs text-gray-400 mb-3 bg-white/[0.02] border border-white/5 rounded-xl p-2.5 leading-relaxed">
                            {description}
                        </p>
                    )}

                    <div className="w-full h-[320px] sm:h-[360px] relative">
                        {filteredData.length === 0 ? (
                            <div className="w-full h-full flex items-center justify-center text-xs text-gray-500">
                                시계열 데이터를 불러오는 중이거나 데이터가 없습니다.
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart
                                    key={`modal-chart-${period}`}
                                    data={filteredData}
                                    margin={{ top: 10, right: hasRightAxis ? 15 : 5, left: -10, bottom: 0 }}
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
                                        tickFormatter={(v: number) => (Math.abs(v) >= 1000 ? v.toLocaleString() : v.toString())}
                                    />
                                    {hasRightAxis && (
                                        <YAxis
                                            yAxisId="right"
                                            orientation="right"
                                            tick={axisTick}
                                            domain={['auto', 'auto']}
                                            stroke="#ffffff15"
                                            tickFormatter={(v: number) => `${v}%`}
                                        />
                                    )}
                                    <RechartsTooltip
                                        contentStyle={TOOLTIP_STYLE}
                                        labelFormatter={(label) => `일자: ${label}`}
                                        formatter={(val: any, name: any) => {
                                            const cfg = series.find(s => s.name === name || s.key === name);
                                            const unit = cfg?.unit || '';
                                            const formattedVal = typeof val === 'number'
                                                ? (Math.abs(val) < 10 && val % 1 !== 0 ? val.toFixed(2) : val.toLocaleString())
                                                : val;
                                            return [`${formattedVal} ${unit}`, name];
                                        }}
                                    />
                                    <Legend
                                        wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                                        iconType="plainline"
                                    />
                                    {series.map(s => (
                                        <Line
                                            key={s.key}
                                            type="monotone"
                                            dataKey={s.key}
                                            name={s.name}
                                            stroke={s.color}
                                            yAxisId={s.yAxisId || 'left'}
                                            strokeWidth={s.strokeWidth || 2}
                                            strokeDasharray={s.strokeDasharray}
                                            dot={s.dot ? { r: 2.5, fill: s.color } : false}
                                            connectNulls
                                            isAnimationActive={false}
                                        />
                                    ))}
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
                </div>

                {/* 5. Footer */}
                <div className="px-5 py-3 border-t border-white/10 bg-[#161926]/90 flex items-center justify-between">
                    <span className="text-[10px] text-gray-500">
                        * 원천: FRED, 야후 파이낸스, 한국은행 ECOS 및 S&P Global 공식 공시
                    </span>
                    <button
                        onClick={onClose}
                        className="px-4 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-xs font-bold text-gray-200 transition-colors"
                    >
                        닫기
                    </button>
                </div>
            </div>
        </div>
    );
}
