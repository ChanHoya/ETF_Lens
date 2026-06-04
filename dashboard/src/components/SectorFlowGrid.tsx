"use client";

import React, { useState, useEffect } from 'react';
import { 
    ComposedChart, 
    Area, 
    Line,
    XAxis, 
    YAxis, 
    ReferenceLine, 
    ResponsiveContainer, 
    Tooltip 
} from 'recharts';
import { Activity, ArrowUpRight, ArrowDownRight, Globe } from 'lucide-react';
import { API_BASE } from '../lib/apiConfig';

interface SectorHistoryItem {
    date: string;
    value: number;
    pct: number;
    ma5?: number;
    ma20?: number;
    ma60?: number;
    ma5_pct?: number;
    ma20_pct?: number;
    ma60_pct?: number;
}

interface SectorFlowItem {
    name: string;
    ticker: string;
    total_return_pct: number;
    trend: 'up' | 'down';
    start_date: string;
    end_date: string;
    history: SectorHistoryItem[];
}

interface MarketData {
    [marketName: string]: SectorFlowItem[];
}

export default function SectorFlowGrid({ 
    onOpenDetail 
}: { 
    onOpenDetail?: (code: string) => void 
}) {
    const [activeMarket, setActiveMarket] = useState<'KOSPI' | 'KOSDAQ' | 'S&P 500' | 'NASDAQ'>('S&P 500');
    const [marketsData, setMarketsData] = useState<MarketData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const processData = (data: any) => {
            if (data && data.markets) {
                setMarketsData(data.markets);
                setError(null);
            } else {
                setError("API returned invalid data format");
            }
        };

        const loadCache = () => {
            try {
                const cached = localStorage.getItem('sector_flow_data_cache');
                if (cached) {
                    const parsed = JSON.parse(cached);
                    processData(parsed);
                    setIsLoading(false);
                }
            } catch (e) {
                console.error('Failed to load cached sector flow data', e);
            }
        };

        const fetchData = async () => {
            let hasCache = false;
            try {
                const cached = localStorage.getItem('sector_flow_data_cache');
                if (cached) hasCache = true;
            } catch (e) {}

            if (!hasCache) {
                setIsLoading(true);
            }

            try {
                const res = await fetch(`${API_BASE}/api/v1/analyze/sector-flow?market=ALL`);
                if (!res.ok) {
                    throw new Error(`Failed to fetch: ${res.statusText}`);
                }
                const data = await res.json();
                if (data.status === 'success') {
                    processData(data);
                    localStorage.setItem('sector_flow_data_cache', JSON.stringify(data));
                } else {
                    throw new Error(data.message || "Failed to retrieve sector flow data");
                }
            } catch (err: any) {
                console.error(err);
                if (!hasCache) {
                    setError(err.message || "데이터를 불러오는 데 실패했습니다.");
                }
            } finally {
                setIsLoading(false);
            }
        };

        loadCache();
        fetchData();
    }, []);

    // Date formatting helper: "2025-06-03" -> "6/25"
    const formatDate = (dateStr: string) => {
        if (!dateStr) return '';
        const parts = dateStr.split('-');
        if (parts.length < 2) return dateStr;
        const yearShort = parts[0].slice(2);
        const month = parseInt(parts[1], 10);
        return `${month}/${yearShort}`;
    };

    // Currency pricing formatter
    const formatPrice = (val: number, market: string) => {
        if (market === 'KOSPI' || market === 'KOSDAQ') {
            return `₩${Math.round(val).toLocaleString()}`;
        }
        return `$${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    // Filtered sector list for the active market tab
    const sectors = marketsData ? (marketsData[activeMarket] || []) : [];

    if (isLoading && !marketsData) {
        return (
            <div className="space-y-6 w-full">
                {/* Skeleton Header Tabs */}
                <div className="flex bg-[#1a1a23] p-1.5 rounded-2xl border border-white/10 self-start w-fit">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="w-24 h-9 bg-white/5 rounded-xl animate-pulse mx-1" />
                    ))}
                </div>
                
                {/* Skeleton Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[...Array(9)].map((_, i) => (
                        <div key={i} className="h-64 bg-[#1a1a23]/30 border border-white/5 rounded-2xl p-4 animate-pulse space-y-4">
                            <div className="flex justify-between items-start">
                                <div className="space-y-2">
                                    <div className="h-5 w-24 bg-white/10 rounded" />
                                    <div className="h-3 w-16 bg-white/5 rounded" />
                                </div>
                                <div className="h-6 w-16 bg-white/10 rounded-full" />
                            </div>
                            <div className="h-32 bg-white/5 rounded" />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (error && !marketsData) {
        return (
            <div className="flex flex-col items-center justify-center p-12 bg-[#1a1a23]/30 border border-white/5 rounded-2xl text-center">
                <Activity className="w-12 h-12 text-rose-500 mb-4 animate-pulse" />
                <h3 className="text-lg font-bold text-white mb-2">섹터 분석 데이터를 불러올 수 없습니다</h3>
                <p className="text-sm text-gray-400 max-w-md mb-6">{error}</p>
                <button 
                    onClick={() => window.location.reload()} 
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-600/20"
                >
                    다시 시도
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-6 w-full animate-in fade-in duration-300">
            {/* Market Tabs */}
            <div className="flex justify-between items-center bg-black/10 p-2 rounded-2xl border border-white/5 backdrop-blur-md w-full flex-wrap gap-4">
                <div className="flex bg-[#1a1a23] p-1 rounded-xl border border-white/10">
                    {(['KOSPI', 'KOSDAQ', 'S&P 500', 'NASDAQ'] as const).map((mkt) => (
                        <button
                            key={mkt}
                            onClick={() => setActiveMarket(mkt)}
                            className={`px-4 py-2 text-xs md:text-sm font-black rounded-lg transition-all ${
                                activeMarket === mkt
                                ? 'bg-gradient-to-r from-cyan-600 to-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                                : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
                            }`}
                        >
                            {mkt}
                        </button>
                    ))}
                </div>

                <div className="flex items-center gap-2 text-xs text-gray-400 font-bold px-2">
                    <Globe className="w-4 h-4 text-cyan-400" />
                    <span>최근 1개년 주가 흐름 (주간 다운샘플링 반영)</span>
                </div>
            </div>

            {/* Grid of Sector Cards */}
            {sectors.length === 0 ? (
                <div className="text-center py-12 text-gray-400 bg-[#1a1a23]/10 border border-white/5 rounded-2xl">
                    해당 마켓의 섹터 데이터를 찾을 수 없습니다.
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {sectors.map((item) => {
                        const isUp = item.total_return_pct >= 0;
                        const returnColor = isUp ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : 'text-rose-400 bg-rose-500/10 border-rose-500/20';
                        const themeColor = isUp ? '#10b981' : '#f43f5e'; // Emerald vs Rose
                        const gradientId = `grad_${item.name.replace(/\s+/g, '_')}_${item.ticker.replace(/[^a-zA-Z0-9]/g, '')}`;

                        return (
                            <div 
                                key={item.name}
                                onClick={() => {
                                    if (onOpenDetail && !item.ticker.startsWith('^')) {
                                        // Strip exchange suffixes for local database detail routing
                                        const cleanCode = item.ticker.replace('.KS', '').replace('.KQ', '');
                                        onOpenDetail(cleanCode);
                                    }
                                }}
                                className={`relative bg-[#1a1a23]/35 border border-white/5 rounded-2xl p-4 overflow-hidden group hover:border-white/15 transition-all duration-300 flex flex-col justify-between ${
                                    onOpenDetail && !item.ticker.startsWith('^') ? 'cursor-pointer hover:shadow-lg hover:shadow-black/25' : ''
                                }`}
                            >
                                {/* Card Top: Info & Return Badge */}
                                <div className="flex justify-between items-start z-10">
                                    <div>
                                        <h4 className="text-base font-extrabold text-white group-hover:text-cyan-400 transition-colors flex items-center gap-1.5">
                                            {item.name}
                                        </h4>
                                        <span className="text-xs text-gray-400 font-bold mt-0.5 block">
                                            {item.ticker}
                                        </span>
                                    </div>
                                    <div className={`px-2.5 py-1 text-xs font-black rounded-full border ${returnColor} flex items-center gap-1`}>
                                        {isUp ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                                        <span>{isUp ? '+' : ''}{item.total_return_pct.toFixed(2)}%</span>
                                    </div>
                                </div>

                                {/* Recharts Sparkline Area */}
                                <div className="h-[140px] w-full mt-4 z-10 relative">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <ComposedChart 
                                            data={item.history} 
                                            margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
                                        >
                                            <defs>
                                                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor={themeColor} stopOpacity={0.25} />
                                                    <stop offset="95%" stopColor={themeColor} stopOpacity={0.0} />
                                                </linearGradient>
                                            </defs>
                                            
                                            {/* Reference line indicating the starting price (0%) */}
                                            <ReferenceLine 
                                                y={0} 
                                                stroke="rgba(255, 255, 255, 0.15)" 
                                                strokeDasharray="3 3" 
                                            />

                                            <XAxis 
                                                dataKey="date" 
                                                tickLine={false} 
                                                axisLine={false}
                                                tickFormatter={formatDate}
                                                tick={{ fill: '#9ca3af', fontSize: 10, fontWeight: 700 }}
                                                dy={5}
                                            />
                                            
                                            <YAxis 
                                                domain={['auto', 'auto']} 
                                                tickLine={false} 
                                                axisLine={false}
                                                tick={{ fill: '#9ca3af', fontSize: 10, fontWeight: 700 }}
                                                tickFormatter={(v) => `${v > 0 ? '+' : ''}${v}%`}
                                            />

                                            <Tooltip
                                                content={({ active, payload }) => {
                                                    if (active && payload && payload.length) {
                                                        const data = payload[0].payload;
                                                        return (
                                                            <div className="bg-[#121217]/95 border border-white/10 p-2.5 rounded-lg shadow-xl text-xs space-y-1.5 font-bold animate-in fade-in duration-100">
                                                                <p className="text-gray-400">{data.date}</p>
                                                                <div className="flex justify-between gap-4">
                                                                    <span className="text-white">주가:</span>
                                                                    <span className="text-cyan-400">{formatPrice(data.value, activeMarket)}</span>
                                                                </div>
                                                                <div className="flex justify-between gap-4">
                                                                    <span className="text-white">누적 수익률:</span>
                                                                    <span className={data.pct >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                                                                        {data.pct >= 0 ? '+' : ''}{data.pct}%
                                                                    </span>
                                                                </div>
                                                                {data.ma5 !== undefined && (
                                                                    <div className="flex justify-between gap-4 border-t border-white/5 pt-1.5 mt-1 text-[10px]">
                                                                        <span className="text-[#f59e0b]">5일선:</span>
                                                                        <span className="text-gray-300">{formatPrice(data.ma5, activeMarket)} ({data.ma5_pct >= 0 ? '+' : ''}{data.ma5_pct}%)</span>
                                                                    </div>
                                                                )}
                                                                {data.ma20 !== undefined && (
                                                                    <div className="flex justify-between gap-4 text-[10px]">
                                                                        <span className="text-[#8b5cf6]">20일선:</span>
                                                                        <span className="text-gray-300">{formatPrice(data.ma20, activeMarket)} ({data.ma20_pct >= 0 ? '+' : ''}{data.ma20_pct}%)</span>
                                                                    </div>
                                                                )}
                                                                {data.ma60 !== undefined && (
                                                                    <div className="flex justify-between gap-4 text-[10px]">
                                                                        <span className="text-[#06b6d4]">60일선:</span>
                                                                        <span className="text-gray-300">{formatPrice(data.ma60, activeMarket)} ({data.ma60_pct >= 0 ? '+' : ''}{data.ma60_pct}%)</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    }
                                                    return null;
                                                }}
                                            />

                                            <Area 
                                                type="monotone" 
                                                dataKey="pct" 
                                                stroke={themeColor} 
                                                strokeWidth={2}
                                                fillOpacity={1} 
                                                fill={`url(#${gradientId})`} 
                                            />
                                            <Line 
                                                type="monotone" 
                                                dataKey="ma5_pct" 
                                                stroke="#f59e0b" 
                                                strokeWidth={1.2} 
                                                dot={false} 
                                                strokeDasharray="3 3"
                                            />
                                            <Line 
                                                type="monotone" 
                                                dataKey="ma20_pct" 
                                                stroke="#8b5cf6" 
                                                strokeWidth={1.2} 
                                                dot={false} 
                                                strokeDasharray="3 3"
                                            />
                                            <Line 
                                                type="monotone" 
                                                dataKey="ma60_pct" 
                                                stroke="#06b6d4" 
                                                strokeWidth={1.2} 
                                                dot={false} 
                                                strokeDasharray="3 3"
                                            />
                                        </ComposedChart>
                                    </ResponsiveContainer>
                                </div>

                                {/* Bottom Info Labels for Start and End dates */}
                                <div className="flex justify-between items-center text-[10px] text-gray-500 font-bold pt-2 mt-2 border-t border-white/5 z-10">
                                    <span>시작: {item.start_date}</span>
                                    <span>종료: {item.end_date}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
