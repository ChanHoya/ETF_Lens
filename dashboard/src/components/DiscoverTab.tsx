"use client";

import React, { useState, useEffect } from 'react';
import { Activity, Calendar, TrendingUp, TrendingDown, RefreshCw, Info, Sparkles, X, ChevronRight } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend } from 'recharts';
import KospiExitAnalyzer from '@/components/KospiExitAnalyzer';
import MacroCompass from '@/components/MacroCompass';
import AIInsight from '@/components/AIInsight';
import { API_BASE } from '@/lib/apiConfig';

const FALLBACK_MACRO_DATA = [
    { "date": "2024-03", "cpi_yoy": 3.5, "ppi_yoy": 2.1, "pce_yoy": 2.8 },
    { "date": "2024-04", "cpi_yoy": 3.4, "ppi_yoy": 2.2, "pce_yoy": 2.7 },
    { "date": "2024-05", "cpi_yoy": 3.3, "ppi_yoy": 2.2, "pce_yoy": 2.6 },
    { "date": "2024-06", "cpi_yoy": 3.0, "ppi_yoy": 1.8, "pce_yoy": 2.5 },
    { "date": "2024-07", "cpi_yoy": 2.9, "ppi_yoy": 2.1, "pce_yoy": 2.5 },
    { "date": "2024-08", "cpi_yoy": 2.5, "ppi_yoy": 1.9, "pce_yoy": 2.2 },
    { "date": "2024-09", "cpi_yoy": 2.4, "ppi_yoy": 1.8, "pce_yoy": 2.1 },
    { "date": "2024-10", "cpi_yoy": 2.6, "ppi_yoy": 1.9, "pce_yoy": 2.3 },
    { "date": "2024-11", "cpi_yoy": 2.7, "ppi_yoy": 2.0, "pce_yoy": 2.3 },
    { "date": "2024-12", "cpi_yoy": 2.5, "ppi_yoy": 1.8, "pce_yoy": 2.2 },
    { "date": "2025-01", "cpi_yoy": 2.4, "ppi_yoy": 1.7, "pce_yoy": 2.1 },
    { "date": "2025-02", "cpi_yoy": 2.3, "ppi_yoy": 1.5, "pce_yoy": 2.0 }
];

export default function DiscoverTab() {
    const [macroData, setMacroData] = useState<any[]>(FALLBACK_MACRO_DATA);
    const [loading, setLoading] = useState<boolean>(true);
    const [timeframe, setTimeframe] = useState<'1Y' | '3Y' | '5Y' | 'ALL'>('3Y');
    const [refreshing, setRefreshing] = useState<boolean>(false);
    const [activeModal, setActiveModal] = useState<'inflation' | null>(null);
    const [showTodayMarket, setShowTodayMarket] = useState<boolean>(false);
    const [todayMarketBlocked, setTodayMarketBlocked] = useState<boolean>(false);
    const TODAY_MARKET_URL = 'https://finance.richgo.ai/';

    useEffect(() => {
        // 1. Load from cache
        try {
            const cached = localStorage.getItem('cpi_ppi_pce_cache');
            if (cached) {
                const parsed = JSON.parse(cached);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    setMacroData(parsed);
                    setLoading(false);
                }
            }
        } catch (e) {
            console.warn("Failed to load cpi_ppi_pce_cache:", e);
        }

        // 2. Fetch fresh data
        const fetchFreshData = async () => {
            try {
                setRefreshing(true);
                const res = await fetch(`${API_BASE}/api/v1/exit-signal/macro/us`);
                if (res.ok) {
                    const data = await res.json();
                    if (Array.isArray(data) && data.length > 0) {
                        setMacroData(data);
                        localStorage.setItem('cpi_ppi_pce_cache', JSON.stringify(data));
                    }
                }
            } catch (err) {
                console.error("Failed to fetch fresh macro data:", err);
            } finally {
                setLoading(false);
                setRefreshing(false);
            }
        };

        fetchFreshData();
    }, []);

    const hasData = macroData && macroData.length > 0;
    const latestItem = hasData ? macroData[macroData.length - 1] : null;
    const prevItem = hasData && macroData.length > 1 ? macroData[macroData.length - 2] : null;

    const getChangeInfo = (key: 'cpi_yoy' | 'ppi_yoy' | 'pce_yoy') => {
        if (!macroData || macroData.length === 0) {
            return { val: null, change: 0, text: '-', isUp: false, date: '', prevVal: null };
        }
        
        // Find latest non-null value
        let latestIdx = -1;
        for (let i = macroData.length - 1; i >= 0; i--) {
            if (macroData[i][key] !== null && macroData[i][key] !== undefined) {
                latestIdx = i;
                break;
            }
        }
        if (latestIdx === -1) {
            return { val: null, change: 0, text: '-', isUp: false, date: '', prevVal: null };
        }

        const val = macroData[latestIdx][key];
        const date = macroData[latestIdx].date;

        // Find previous non-null value
        let prevIdx = -1;
        for (let i = latestIdx - 1; i >= 0; i--) {
            if (macroData[i][key] !== null && macroData[i][key] !== undefined) {
                prevIdx = i;
                break;
            }
        }

        if (prevIdx === -1) {
            return { val, change: 0, text: '-', isUp: false, date, prevVal: null };
        }

        const prevVal = macroData[prevIdx][key];
        const change = val - prevVal;
        const isUp = change > 0;
        const text = change === 0 ? "보합" : `${isUp ? '▲' : '▼'} ${Math.abs(change).toFixed(1)}%p`;
        return { val, change, text, isUp, date, prevVal };
    };

    const cpiInfo = getChangeInfo('cpi_yoy');
    const ppiInfo = getChangeInfo('ppi_yoy');
    const pceInfo = getChangeInfo('pce_yoy');

    const getFilteredData = () => {
        if (!hasData) return [];
        let filtered = [...macroData];
        if (timeframe === '1Y') {
            filtered = filtered.slice(-12);
        } else if (timeframe === '3Y') {
            filtered = filtered.slice(-36);
        } else if (timeframe === '5Y') {
            filtered = filtered.slice(-60);
        }

        return filtered.map(item => {
            let formattedDate = item.date;
            if (item.date && item.date.length >= 7) {
                const parts = item.date.split('-');
                if (parts.length >= 2) {
                    formattedDate = `${parts[0].substring(2)}.${parts[1]}`;
                }
            }
            return {
                ...item,
                displayDate: formattedDate
            };
        });
    };

    const displayChartData = getFilteredData();
    const timeframes: ('1Y' | '3Y' | '5Y' | 'ALL')[] = ['1Y', '3Y', '5Y', 'ALL'];
    const timeframeLabels = {
        '1Y': '1년',
        '3Y': '3년',
        '5Y': '5년',
        'ALL': '전체'
    };

    return (
        <div className="w-full animate-in fade-in slide-in-from-bottom-2 duration-500 bg-[#121217]/80 p-4 lg:p-6 border border-white/10 rounded-3xl backdrop-blur-3xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] mt-0">
            <div className="flex flex-col gap-3 w-full h-full">

                {/* Top bar: 오늘의 시장 버튼 (우측 상단) */}
                <div className="flex items-center justify-end w-full">
                    <button
                        onClick={() => { setTodayMarketBlocked(false); setShowTodayMarket(true); }}
                        className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-all bg-gradient-to-r from-emerald-500/20 to-sky-500/20 text-emerald-200 border border-emerald-400/30 hover:from-emerald-500/30 hover:to-sky-500/30 hover:text-white shadow-[0_0_14px_rgba(16,185,129,0.18)]"
                    >
                        <Activity className="w-4 h-4" />
                        오늘의 시장
                    </button>
                </div>

                {/* Top: KOSPI Exit Analyzer */}
                <KospiExitAnalyzer />

                {/* Section Title: US Economic Indicators */}
                <div className="relative z-50">
                    <div 
                        id="us-economy-title"
                        className={`scroll-mt-28 flex flex-col md:flex-row md:items-center justify-between gap-4 mt-2 mb-2 bg-black/20 p-4 rounded-xl border border-white/5 backdrop-blur-md w-full transition-all duration-300 ${activeModal === 'inflation' ? 'relative z-[110] shadow-2xl' : ''}`}
                    >
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 shrink-0">
                                <Activity className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <div className="flex flex-wrap items-center gap-3">
                                    <h2 className="text-xl font-extrabold text-white">미국 경기 지표</h2>
                                </div>
                                <p className="text-sm text-gray-400 font-medium mt-0.5">글로벌 매크로 인플레이션 및 소비자물가지수 등락</p>
                            </div>
                        </div>
                    </div>
                {activeModal === 'inflation' && (
                    <div className="absolute left-0 right-0 top-full mt-2 z-[110] flex items-start justify-center bg-black/80 backdrop-blur-sm p-4 rounded-3xl shadow-2xl animate-in fade-in duration-300" onClick={() => setActiveModal(null)}>
                        <div 
                            className="bg-[#0d0d12] border border-white/10 rounded-3xl w-full max-w-4xl p-6 relative overflow-y-auto shadow-[0_10px_50px_rgba(0,0,0,0.8)]"
                            style={{ maxHeight: 'calc(100vh - 160px)' }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <button 
                                onClick={() => setActiveModal(null)} 
                                className="absolute top-4 right-4 p-2 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors z-10"
                            >
                                <X className="w-5 h-5" />
                            </button>
                            
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pr-10">
                                <div className="flex flex-col gap-1">
                                    <h3 className="text-lg font-bold text-white/90 flex items-center gap-2">
                                        <Sparkles className="w-5 h-5 text-indigo-400 animate-pulse" />
                                        미국 3대 인플레이션 지표 상세 추이
                                    </h3>
                                    <p className="text-xs text-gray-400 font-medium">
                                        미국 연방준비제도(Fed) 통화정책 결정을 좌우하는 핵심 물가상승률(YoY) 전체 추세
                                    </p>
                                </div>
                                
                                <div className="flex items-center gap-3 shrink-0">
                                    <div className="flex bg-black/40 rounded-lg p-0.5 border border-white/5 shadow-inner">
                                        {timeframes.map((tf) => (
                                            <button
                                                key={tf}
                                                onClick={() => setTimeframe(tf)}
                                                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all duration-300 ${
                                                    timeframe === tf
                                                        ? 'bg-white/10 text-white shadow-md'
                                                        : 'text-gray-400 hover:text-white'
                                                }`}
                                            >
                                                {timeframeLabels[tf]}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
    
                            <div className="w-full bg-black/30 rounded-2xl border border-white/5 p-4 relative" style={{ height: '380px' }}>
                                {!hasData ? (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 gap-2">
                                        <Info className="w-8 h-8 text-yellow-400" />
                                        <span className="text-sm font-semibold">저장된 데이터가 없습니다.</span>
                                    </div>
                                ) : (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={displayChartData} margin={{ top: 15, right: 15, left: -20, bottom: 5 }}>
                                            <defs>
                                                <filter id="glow-cpi-modal" x="-10%" y="-10%" width="120%" height="120%">
                                                    <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                                                    <feMerge>
                                                        <feMergeNode in="coloredBlur"/>
                                                        <feMergeNode in="SourceGraphic"/>
                                                    </feMerge>
                                                </filter>
                                                <filter id="glow-ppi-modal" x="-10%" y="-10%" width="120%" height="120%">
                                                    <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                                                    <feMerge>
                                                        <feMergeNode in="coloredBlur"/>
                                                        <feMergeNode in="SourceGraphic"/>
                                                    </feMerge>
                                                </filter>
                                                <filter id="glow-pce-modal" x="-10%" y="-10%" width="120%" height="120%">
                                                    <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                                                    <feMerge>
                                                        <feMergeNode in="coloredBlur"/>
                                                        <feMergeNode in="SourceGraphic"/>
                                                    </feMerge>
                                                </filter>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                                            <XAxis 
                                                dataKey="displayDate" 
                                                stroke="#71717a" 
                                                fontSize={10} 
                                                tickMargin={8} 
                                                axisLine={false}
                                                tickLine={false}
                                            />
                                            <YAxis 
                                                domain={['auto', 'auto']} 
                                                width={40} 
                                                tick={{ fontSize: 10, fill: '#71717a' }} 
                                                axisLine={false} 
                                                tickLine={false} 
                                            />
                                            <RechartsTooltip
                                                contentStyle={{
                                                    backgroundColor: 'rgba(10, 10, 15, 0.95)',
                                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                                    borderRadius: '16px',
                                                    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                                                    backdropFilter: 'blur(10px)'
                                                }}
                                                content={({ active, payload, label }) => {
                                                    if (active && payload && payload.length) {
                                                        return (
                                                            <div className="bg-[#0e0e12]/95 border border-white/10 p-3 rounded-2xl shadow-xl backdrop-blur-md text-[12px] flex flex-col gap-1.5 min-w-[155px]">
                                                                <p className="text-gray-400 font-semibold mb-1 flex items-center gap-1.5">
                                                                    <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                                                                    {label}
                                                                </p>
                                                                <div className="h-px bg-white/10 my-1" />
                                                                {payload.map((entry: any, idx: number) => (
                                                                    <div key={idx} className="flex justify-between items-center gap-4">
                                                                        <div className="flex items-center gap-1.5">
                                                                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.stroke }} />
                                                                            <span className="text-gray-300 font-medium">{entry.name}</span>
                                                                        </div>
                                                                        <span className="font-mono font-bold text-white text-right">
                                                                            {Number(entry.value).toFixed(1)}%
                                                                        </span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        );
                                                    }
                                                    return null;
                                                }}
                                            />
                                            <Legend 
                                                verticalAlign="top" 
                                                height={36} 
                                                iconType="circle"
                                                iconSize={8}
                                                content={({ payload }) => (
                                                    <div className="flex justify-center gap-6 text-[11px] font-semibold text-gray-400 mb-2">
                                                        {payload?.map((entry: any, index: number) => (
                                                            <div key={index} className="flex items-center gap-1.5 cursor-pointer hover:text-white transition-colors">
                                                                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                                                                <span>{entry.value}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            />
                                            <Line 
                                                type="monotone" 
                                                name="CPI (소비자물가)" 
                                                dataKey="cpi_yoy" 
                                                stroke="#3b82f6" 
                                                strokeWidth={3} 
                                                dot={{ r: 2, fill: '#3b82f6', strokeWidth: 0 }} 
                                                activeDot={{ r: 5, strokeWidth: 0 }}
                                                filter="url(#glow-cpi-modal)"
                                            />
                                            <Line 
                                                type="monotone" 
                                                name="PPI (생산자물가)" 
                                                dataKey="ppi_yoy" 
                                                stroke="#10b981" 
                                                strokeWidth={3} 
                                                dot={{ r: 2, fill: '#10b981', strokeWidth: 0 }} 
                                                activeDot={{ r: 5, strokeWidth: 0 }}
                                                filter="url(#glow-ppi-modal)"
                                            />
                                            <Line 
                                                type="monotone" 
                                                name="PCE (개인소비지출)" 
                                                dataKey="pce_yoy" 
                                                stroke="#ec4899" 
                                                strokeWidth={3} 
                                                dot={{ r: 2, fill: '#ec4899', strokeWidth: 0 }} 
                                                activeDot={{ r: 5, strokeWidth: 0 }}
                                                filter="url(#glow-pce-modal)"
                                            />
                                        </LineChart>
                                    </ResponsiveContainer>
                                )}
                            </div>
                        </div>
                    </div>
                )}
                </div>

                {/* US Macroecon Indicators (Premium Wide Recharts Card) */}
                <div className="w-full bg-[#121217]/60 border border-white/10 rounded-3xl p-4 lg:p-6 backdrop-blur-md shadow-xl flex flex-col">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                        <div className="flex flex-col gap-1">
                            <h3 className="text-lg font-bold text-white/90 flex items-center gap-2">
                                <Sparkles className="w-5 h-5 text-indigo-400 animate-pulse" />
                                미국 3대 인플레이션 지표 추이 (CPI · PPI · PCE)
                            </h3>
                            <p className="text-xs text-gray-400 font-medium">
                                미국 연방준비제도(Fed) 통화정책 결정을 좌우하는 핵심 물가상승률(YoY) 추세선
                            </p>
                        </div>
                        
                        <div className="flex items-center gap-3 shrink-0 self-end md:self-center">
                            {refreshing && (
                                <span className="flex items-center gap-1.5 text-[10px] text-indigo-400 font-bold bg-indigo-500/10 px-2 py-1 rounded-md border border-indigo-500/20 animate-pulse">
                                    <RefreshCw className="w-3 h-3 animate-spin" />
                                    갱신 중
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Stats Dashboard Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-2">
                        {/* CPI Card */}
                        <div 
                            onClick={() => {
                                setActiveModal('inflation');
                                setTimeout(() => {
                                    document.getElementById('us-economy-title')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                }, 10);
                            }} 
                            className="cursor-pointer relative overflow-hidden bg-gradient-to-br from-[#1d2030]/40 to-[#121217]/60 border border-white/10 rounded-2xl p-4 shadow-lg backdrop-blur-sm group hover:border-[#3b82f6]/40 transition-all duration-300"
                        >
                            <div className="absolute top-0 left-0 w-1 h-full bg-[#3b82f6]" />
                            <div className="flex justify-between items-start">
                                <div>
                                    <span className="text-xs font-semibold text-gray-400">소비자물가지수 (CPI YoY)</span>
                                    <h4 className="text-2xl font-black text-white mt-1 font-mono tracking-tight group-hover:text-[#3b82f6] transition-colors duration-300">
                                        {cpiInfo.val !== null ? `${cpiInfo.val.toFixed(1)}%` : 'N/A'}
                                    </h4>
                                </div>
                                <div className={`flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    cpiInfo.change > 0 ? 'bg-rose-500/15 text-rose-400 border border-rose-500/20' : 
                                    cpiInfo.change < 0 ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' : 
                                    'bg-white/5 text-gray-400 border border-white/5'
                                }`}>
                                    {cpiInfo.change > 0 ? <TrendingUp className="w-3 h-3" /> : cpiInfo.change < 0 ? <TrendingDown className="w-3 h-3" /> : null}
                                    <span>{cpiInfo.text}</span>
                                </div>
                            </div>
                            <div className="flex-1 w-full h-[60px] -ml-2 -mb-2 mt-2">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={macroData.slice(-12)}>
                                        <Line type="monotone" dataKey="cpi_yoy" stroke="#3b82f6" strokeWidth={2} dot={false} />
                                        <YAxis domain={['auto', 'auto']} hide={true} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="mt-2.5 flex items-center justify-between border-t border-white/5 pt-2">
                                <span className="text-[10px] text-gray-500">이전 달: {cpiInfo.prevVal !== null ? `${cpiInfo.prevVal.toFixed(1)}%` : 'N/A'}</span>
                                <span className="text-[10px] text-gray-500 font-mono">{cpiInfo.date || ''} 기준</span>
                            </div>
                        </div>

                        {/* PPI Card */}
                        <div 
                            onClick={() => {
                                setActiveModal('inflation');
                                setTimeout(() => {
                                    document.getElementById('us-economy-title')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                }, 10);
                            }} 
                            className="cursor-pointer relative overflow-hidden bg-gradient-to-br from-[#1d2030]/40 to-[#121217]/60 border border-white/10 rounded-2xl p-4 shadow-lg backdrop-blur-sm group hover:border-[#10b981]/40 transition-all duration-300"
                        >
                            <div className="absolute top-0 left-0 w-1 h-full bg-[#10b981]" />
                            <div className="flex justify-between items-start">
                                <div>
                                    <span className="text-xs font-semibold text-gray-400">생산자물가지수 (PPI YoY)</span>
                                    <h4 className="text-2xl font-black text-white mt-1 font-mono tracking-tight group-hover:text-[#10b981] transition-colors duration-300">
                                        {ppiInfo.val !== null ? `${ppiInfo.val.toFixed(1)}%` : 'N/A'}
                                    </h4>
                                </div>
                                <div className={`flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    ppiInfo.change > 0 ? 'bg-rose-500/15 text-rose-400 border border-rose-500/20' : 
                                    ppiInfo.change < 0 ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' : 
                                    'bg-white/5 text-gray-400 border border-white/5'
                                }`}>
                                    {ppiInfo.change > 0 ? <TrendingUp className="w-3 h-3" /> : ppiInfo.change < 0 ? <TrendingDown className="w-3 h-3" /> : null}
                                    <span>{ppiInfo.text}</span>
                                </div>
                            </div>
                            <div className="flex-1 w-full h-[60px] -ml-2 -mb-2 mt-2">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={macroData.slice(-12)}>
                                        <Line type="monotone" dataKey="ppi_yoy" stroke="#10b981" strokeWidth={2} dot={false} />
                                        <YAxis domain={['auto', 'auto']} hide={true} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="mt-2.5 flex items-center justify-between border-t border-white/5 pt-2">
                                <span className="text-[10px] text-gray-500">이전 달: {ppiInfo.prevVal !== null ? `${ppiInfo.prevVal.toFixed(1)}%` : 'N/A'}</span>
                                <span className="text-[10px] text-gray-500 font-mono">{ppiInfo.date || ''} 기준</span>
                            </div>
                        </div>

                        {/* PCE Card */}
                        <div 
                            onClick={() => {
                                setActiveModal('inflation');
                                setTimeout(() => {
                                    document.getElementById('us-economy-title')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                }, 10);
                            }} 
                            className="cursor-pointer relative overflow-hidden bg-gradient-to-br from-[#1d2030]/40 to-[#121217]/60 border border-white/10 rounded-2xl p-4 shadow-lg backdrop-blur-sm group hover:border-[#ec4899]/40 transition-all duration-300"
                        >
                            <div className="absolute top-0 left-0 w-1 h-full bg-[#ec4899]" />
                            <div className="flex justify-between items-start">
                                <div>
                                    <span className="text-xs font-semibold text-gray-400">개인소비지출 (PCE YoY)</span>
                                    <h4 className="text-2xl font-black text-white mt-1 font-mono tracking-tight group-hover:text-[#ec4899] transition-colors duration-300">
                                        {pceInfo.val !== null ? `${pceInfo.val.toFixed(1)}%` : 'N/A'}
                                    </h4>
                                </div>
                                <div className={`flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    pceInfo.change > 0 ? 'bg-rose-500/15 text-rose-400 border border-rose-500/20' : 
                                    pceInfo.change < 0 ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' : 
                                    'bg-white/5 text-gray-400 border border-white/5'
                                }`}>
                                    {pceInfo.change > 0 ? <TrendingUp className="w-3 h-3" /> : pceInfo.change < 0 ? <TrendingDown className="w-3 h-3" /> : null}
                                    <span>{pceInfo.text}</span>
                                </div>
                            </div>
                            <div className="flex-1 w-full h-[60px] -ml-2 -mb-2 mt-2">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={macroData.slice(-12)}>
                                        <Line type="monotone" dataKey="pce_yoy" stroke="#ec4899" strokeWidth={2} dot={false} />
                                        <YAxis domain={['auto', 'auto']} hide={true} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="mt-2.5 flex items-center justify-between border-t border-white/5 pt-2">
                                <span className="text-[10px] text-gray-500">이전 달: {pceInfo.prevVal !== null ? `${pceInfo.prevVal.toFixed(1)}%` : 'N/A'}</span>
                                <span className="text-[10px] text-gray-500 font-mono">{pceInfo.date || ''} 기준</span>
                            </div>
                        </div>
                    </div>

                    <div className="text-xs text-center text-gray-500 mt-2 flex items-center justify-center gap-1.5">
                        <ChevronRight className="w-4 h-4" />
                        상세한 추세선을 보시려면 카드를 클릭하세요.
                    </div>


                    {/* Chart Container removed. Moved to modal. */}
                </div>

                {/* AI 매크로 로테이션 나침반 (미국/한국 분석) */}
                <MacroCompass />

                {/* AI Insight - 전문가 시장 분석 */}
                <AIInsight />

            </div>

            {/* 오늘의 시장 모달 (finance.richgo.ai 임베드) */}
            {showTodayMarket && (
                <div
                    className="fixed inset-0 z-[200] flex items-start justify-center bg-black/70 backdrop-blur-sm p-2 md:p-3 animate-in fade-in duration-200"
                    onClick={() => setShowTodayMarket(false)}
                >
                    <div
                        className="relative w-full max-w-6xl h-[96vh] bg-[#0d0d12] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* 헤더 */}
                        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-[#121217] shrink-0">
                            <div className="flex items-center gap-2 text-white font-bold">
                                <Activity className="w-4 h-4 text-emerald-400" />
                                오늘의 시장
                                <span className="text-[11px] font-medium text-gray-500 ml-1">finance.richgo.ai</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <a
                                    href={TODAY_MARKET_URL}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1 text-xs font-bold text-gray-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-1.5 rounded-lg transition-colors"
                                >
                                    새 창에서 열기 <ChevronRight className="w-3.5 h-3.5" />
                                </a>
                                <button
                                    onClick={() => setShowTodayMarket(false)}
                                    className="p-1.5 text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
                                    aria-label="닫기"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {/* 본문 iframe */}
                        <div className="flex-1 relative bg-white">
                            <iframe
                                src={TODAY_MARKET_URL}
                                title="오늘의 시장"
                                className="absolute inset-0 w-full h-full border-0"
                                allowFullScreen
                                onError={() => setTodayMarketBlocked(true)}
                            />
                            {todayMarketBlocked && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#0d0d12] text-center p-6">
                                    <p className="text-gray-300 text-sm">이 사이트는 임베드(iframe)를 허용하지 않습니다.</p>
                                    <a
                                        href={TODAY_MARKET_URL}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-1 text-sm font-bold text-emerald-300 hover:text-white bg-emerald-500/20 border border-emerald-400/30 px-4 py-2 rounded-lg transition-colors"
                                    >
                                        새 창에서 열기 <ChevronRight className="w-4 h-4" />
                                    </a>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
