"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Activity, Calendar, TrendingUp, TrendingDown, RefreshCw, Info, Sparkles, X, ChevronRight } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend } from 'recharts';
import KospiExitAnalyzer from '@/components/KospiExitAnalyzer';
import KrMacroIndicatorSection from '@/components/KrMacroIndicatorSection';
import MacroCompass from '@/components/MacroCompass';
import MacroRegimeQuadrant from '@/components/MacroRegimeQuadrant';
import AIInsight from '@/components/AIInsight';
import MacroConsensusSurpriseModal from '@/components/macro/MacroConsensusSurpriseModal';
import { API_BASE } from '@/lib/apiConfig';
import { useChartHighlight, STANDARD_LEGEND_WRAPPER_STYLE } from '@/lib/chartTheme';

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

const ADDITIONAL_INDICATORS_DATA = {
    cpi: {
        val: 3.9,
        prevVal: 3.4,
        change: 0.5,
        text: '▲ 0.5%p',
        isUp: true,
        date: '2026-09',
        estimate: 3.8,
        diff: 0.1,
        history: [
            { date: '25.10', val: 2.6, est: 2.6 }, { date: '25.11', val: 2.7, est: 2.7 }, { date: '25.12', val: 2.9, est: 2.9 },
            { date: '26.01', val: 3.0, est: 2.9 }, { date: '26.02', val: 3.2, est: 3.1 }, { date: '26.03', val: 3.5, est: 3.4 },
            { date: '26.04', val: 3.4, est: 3.4 }, { date: '26.05', val: 3.3, est: 3.4 }, { date: '26.06', val: 3.0, est: 3.1 },
            { date: '26.07', val: 2.9, est: 3.0 }, { date: '26.08', val: 3.4, est: 3.5 }, { date: '26.09', val: 3.9, est: 3.8 },
        ]
    },
    ppi: {
        val: 8.5,
        prevVal: 6.4,
        change: 2.1,
        text: '▲ 2.1%p',
        isUp: true,
        date: '2026-09',
        estimate: 8.4,
        diff: 0.1,
        history: [
            { date: '25.10', val: 2.4, est: 2.3 }, { date: '25.11', val: 3.0, est: 2.6 }, { date: '25.12', val: 2.2, est: 2.5 },
            { date: '26.01', val: 1.9, est: 1.6 }, { date: '26.02', val: 1.6, est: 1.1 }, { date: '26.03', val: 2.1, est: 2.2 },
            { date: '26.04', val: 2.2, est: 2.2 }, { date: '26.05', val: 2.2, est: 2.5 }, { date: '26.06', val: 2.6, est: 2.3 },
            { date: '26.07', val: 2.2, est: 2.3 }, { date: '26.08', val: 6.4, est: 6.3 }, { date: '26.09', val: 8.5, est: 8.4 },
        ]
    },
    pce: {
        val: 3.0,
        prevVal: 3.0,
        change: 0.0,
        text: '보합',
        isUp: false,
        date: '2026-08',
        estimate: 3.0,
        diff: 0.0,
        history: [
            { date: '25.10', val: 2.3, est: 2.3 }, { date: '25.11', val: 2.4, est: 2.4 }, { date: '25.12', val: 2.6, est: 2.5 },
            { date: '26.01', val: 2.5, est: 2.4 }, { date: '26.02', val: 2.5, est: 2.5 }, { date: '26.03', val: 2.7, est: 2.6 },
            { date: '26.04', val: 2.7, est: 2.7 }, { date: '26.05', val: 2.6, est: 2.6 }, { date: '26.06', val: 2.5, est: 2.5 },
            { date: '26.07', val: 2.5, est: 2.5 }, { date: '26.08', val: 3.0, est: 3.0 }, { date: '26.09', val: 3.0, est: 3.0 },
        ]
    },
    core_cpi: {
        val: 3.3,
        prevVal: 3.2,
        change: 0.1,
        text: '▲ 0.1%p',
        isUp: true,
        date: '2026-09',
        estimate: 3.2,
        diff: 0.1,
        history: [
            { date: '25.10', val: 3.3, est: 3.3 }, { date: '25.11', val: 3.3, est: 3.3 }, { date: '25.12', val: 3.3, est: 3.3 },
            { date: '26.01', val: 3.3, est: 3.2 }, { date: '26.02', val: 3.8, est: 3.7 }, { date: '26.03', val: 3.8, est: 3.7 },
            { date: '26.04', val: 3.6, est: 3.6 }, { date: '26.05', val: 3.4, est: 3.5 }, { date: '26.06', val: 3.3, est: 3.4 },
            { date: '26.07', val: 3.2, est: 3.2 }, { date: '26.08', val: 3.2, est: 3.2 }, { date: '26.09', val: 3.3, est: 3.2 },
        ]
    },
    core_ppi: {
        val: 2.8,
        prevVal: 2.4,
        change: 0.4,
        text: '▲ 0.4%p',
        isUp: true,
        date: '2026-09',
        estimate: 2.7,
        diff: 0.1,
        history: [
            { date: '25.10', val: 3.1, est: 3.0 }, { date: '25.11', val: 3.4, est: 3.3 }, { date: '25.12', val: 3.2, est: 3.3 },
            { date: '26.01', val: 2.0, est: 2.0 }, { date: '26.02', val: 2.0, est: 2.1 }, { date: '26.03', val: 2.4, est: 2.3 },
            { date: '26.04', val: 2.4, est: 2.4 }, { date: '26.05', val: 2.3, est: 2.4 }, { date: '26.06', val: 3.0, est: 2.9 },
            { date: '26.07', val: 2.4, est: 2.4 }, { date: '26.08', val: 2.4, est: 2.4 }, { date: '26.09', val: 2.8, est: 2.7 },
        ]
    },
    core_pce: {
        val: 2.7,
        prevVal: 2.7,
        change: 0.0,
        text: '보합',
        isUp: false,
        date: '2026-09',
        estimate: 2.6,
        diff: 0.1,
        history: [
            { date: '25.10', val: 2.8, est: 2.8 }, { date: '25.11', val: 2.8, est: 2.8 }, { date: '25.12', val: 2.9, est: 2.9 },
            { date: '26.01', val: 2.8, est: 2.8 }, { date: '26.02', val: 2.8, est: 2.8 }, { date: '26.03', val: 2.8, est: 2.8 },
            { date: '26.04', val: 2.8, est: 2.8 }, { date: '26.05', val: 2.6, est: 2.6 }, { date: '26.06', val: 2.6, est: 2.6 },
            { date: '26.07', val: 2.6, est: 2.6 }, { date: '26.08', val: 2.7, est: 2.6 }, { date: '26.09', val: 2.7, est: 2.6 },
        ]
    },
    unemployment: {
        val: 4.1,
        prevVal: 4.2,
        change: -0.1,
        text: '▼ 0.1%p',
        isUp: false,
        date: '2026-09',
        estimate: 4.2,
        diff: -0.1,
        history: [
            { date: '25.10', val: 4.1, est: 4.1 }, { date: '25.11', val: 4.2, est: 4.1 }, { date: '25.12', val: 4.1, est: 4.2 },
            { date: '26.01', val: 4.0, est: 4.1 }, { date: '26.02', val: 3.9, est: 4.0 }, { date: '26.03', val: 3.8, est: 3.9 },
            { date: '26.04', val: 3.9, est: 3.9 }, { date: '26.05', val: 4.0, est: 4.0 }, { date: '26.06', val: 4.1, est: 4.0 },
            { date: '26.07', val: 4.3, est: 4.1 }, { date: '26.08', val: 4.2, est: 4.2 }, { date: '26.09', val: 4.1, est: 4.2 },
        ]
    },
    nonfarm: {
        val: 254,
        prevVal: 142,
        change: 112,
        text: '▲ 112k',
        isUp: true,
        date: '2026-09',
        estimate: 140,
        diff: 114,
        history: [
            { date: '25.10', val: 12, est: 105 }, { date: '25.11', val: 227, est: 200 }, { date: '25.12', val: 256, est: 160 },
            { date: '26.01', val: 143, est: 170 }, { date: '26.02', val: 275, est: 195 }, { date: '26.03', val: 303, est: 214 },
            { date: '26.04', val: 175, est: 240 }, { date: '26.05', val: 272, est: 180 }, { date: '26.06', val: 206, est: 190 },
            { date: '26.07', val: 114, est: 175 }, { date: '26.08', val: 142, est: 160 }, { date: '26.09', val: 254, est: 140 },
        ]
    }
};

export default function DiscoverTab() {
    const [macroData, setMacroData] = useState<any[]>(FALLBACK_MACRO_DATA);
    const [loading, setLoading] = useState<boolean>(true);
    const [timeframe, setTimeframe] = useState<'1Y' | '3Y' | '5Y' | 'ALL'>('3Y');
    const [refreshing, setRefreshing] = useState<boolean>(false);
    const [activeModal, setActiveModal] = useState<'inflation' | null>(null);
    const [isConsensusModalOpen, setIsConsensusModalOpen] = useState<boolean>(false);
    const [selectedConsensusIndicator, setSelectedConsensusIndicator] = useState<string>('cpi');

    const inflationHighlight = useChartHighlight();

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
    }, []);

    // 2. Fetch fresh data (supports force refresh)
    const fetchFreshData = useCallback(async (force: boolean = false) => {
        try {
            setRefreshing(true);
            const url = `${API_BASE}/api/v1/exit-signal/macro/us${force ? '?force=true' : ''}`;
            const res = await fetch(url, {
                cache: 'no-store',
                headers: {
                    'Pragma': 'no-cache',
                    'Cache-Control': 'no-cache'
                }
            });
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
    }, []);

    useEffect(() => {
        fetchFreshData(false);
    }, [fetchFreshData]);

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

                {/* Top: KOSPI Exit Analyzer */}
                <KospiExitAnalyzer />

                {/* Section: Korea Economic Indicators (선행지수 순환변동치, OECD CLI, 수출 추이) */}
                <KrMacroIndicatorSection />

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

                        <div className="flex items-center gap-2 self-end md:self-center">
                            <button
                                onClick={() => fetchFreshData(true)}
                                disabled={refreshing}
                                className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/5 hover:bg-white/10 active:scale-95 border border-white/10 text-[11px] font-medium text-gray-300 hover:text-white transition-all disabled:opacity-50 shadow-sm"
                                title="Update"
                            >
                                <RefreshCw className={`w-2.5 h-2.5 text-indigo-400 ${refreshing ? 'animate-spin' : ''}`} />
                                <span>Update</span>
                            </button>
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
                                                className={`px-2 py-0.5 text-[11px] font-semibold rounded-md transition-all duration-300 ${
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
                                                            <div className="bg-[#0e0e12]/95 border border-white/10 p-3 rounded-2xl shadow-xl backdrop-blur-md text-[11px] flex flex-col gap-1.5 min-w-[155px]">
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
                                                wrapperStyle={STANDARD_LEGEND_WRAPPER_STYLE}
                                                onClick={inflationHighlight.handleLegendClick}
                                            />
                                            <Line 
                                                type="monotone" 
                                                name="CPI (소비자물가)" 
                                                dataKey="cpi_yoy" 
                                                stroke="#3b82f6" 
                                                strokeWidth={inflationHighlight.getSeriesStrokeWidth("CPI (소비자물가)", 3)} 
                                                strokeOpacity={inflationHighlight.getSeriesOpacity("CPI (소비자물가)")}
                                                dot={{ r: 2, fill: '#3b82f6', strokeWidth: 0 }} 
                                                activeDot={{ r: 5, strokeWidth: 0 }}
                                                filter="url(#glow-cpi-modal)"
                                            />
                                            <Line 
                                                type="monotone" 
                                                name="PPI (생산자물가)" 
                                                dataKey="ppi_yoy" 
                                                stroke="#10b981" 
                                                strokeWidth={inflationHighlight.getSeriesStrokeWidth("PPI (생산자물가)", 3)} 
                                                strokeOpacity={inflationHighlight.getSeriesOpacity("PPI (생산자물가)")}
                                                dot={{ r: 2, fill: '#10b981', strokeWidth: 0 }} 
                                                activeDot={{ r: 5, strokeWidth: 0 }}
                                                filter="url(#glow-ppi-modal)"
                                            />
                                            <Line 
                                                type="monotone" 
                                                name="PCE (개인소비지출)" 
                                                dataKey="pce_yoy" 
                                                stroke="#ec4899" 
                                                strokeWidth={inflationHighlight.getSeriesStrokeWidth("PCE (개인소비지출)", 3)} 
                                                strokeOpacity={inflationHighlight.getSeriesOpacity("PCE (개인소비지출)")}
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
                            <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="text-lg font-bold text-white/90 flex items-center gap-2">
                                    <Sparkles className="w-5 h-5 text-indigo-400 animate-pulse" />
                                    미국 3대 인플레이션 지표 추이 (CPI · PPI · PCE)
                                </h3>
                            </div>
                            <p className="text-xs text-gray-400 font-medium">
                                미국 연방준비제도(Fed) 통화정책 결정을 좌우하는 핵심 물가상승률(YoY) 추세선 및 월가 컨센서스 서프라이즈 분석
                            </p>
                        </div>
                        
                        <div className="flex items-center gap-2 shrink-0 self-start md:self-center">
                            <button
                                onClick={() => {
                                    setSelectedConsensusIndicator('cpi');
                                    setIsConsensusModalOpen(true);
                                }}
                                className="px-2 py-0.5 rounded-md bg-gradient-to-r from-amber-500/15 via-orange-500/15 to-rose-500/15 hover:from-amber-500/25 hover:to-rose-500/25 border border-amber-500/30 hover:border-amber-400 text-amber-300 hover:text-white text-[11px] font-medium flex items-center gap-1 transition-all shadow-sm active:scale-95 group"
                                title="8대 주요 경제 지표 월가 예상치 vs 실제치 서프라이즈 분석 모달 열기"
                            >
                                <Sparkles className="w-2.5 h-2.5 text-amber-400 group-hover:rotate-12 transition-transform" />
                                <span>월가 예상치 대조 (8대 지표)</span>
                            </button>
                            {refreshing && (
                                <span className="flex items-center gap-1.5 text-[10px] text-indigo-400 font-bold bg-indigo-500/10 px-2 py-1 rounded-md border border-indigo-500/20 animate-pulse">
                                    <RefreshCw className="w-3 h-3 animate-spin" />
                                    갱신 중
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Stats Dashboard Grid: 물가 & 생산자 & 개인소비 (상단 헤드라인 vs 하단 근원 Core 상하 배치) */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        {/* 1열 상단: CPI Card */}
                        <div 
                            onClick={() => {
                                setSelectedConsensusIndicator('cpi');
                                setIsConsensusModalOpen(true);
                            }} 
                            className="cursor-pointer relative overflow-hidden bg-gradient-to-br from-[#1d2030]/40 to-[#121217]/60 border border-white/10 rounded-2xl p-4 shadow-lg backdrop-blur-sm group hover:border-[#3b82f6]/50 hover:shadow-[#3b82f6]/10 transition-all duration-300"
                        >
                            <div className="absolute top-0 left-0 w-1 h-full bg-[#3b82f6]" />
                            <div className="flex justify-between items-start">
                                <div>
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-xs font-semibold text-gray-400">소비자물가지수 (CPI YoY)</span>
                                        <span className="text-[9px] font-semibold text-blue-400 bg-blue-500/10 px-1.5 py-0.2 rounded border border-blue-500/20">헤드라인</span>
                                    </div>
                                    <h4 className="text-2xl font-black text-white mt-1 font-mono tracking-tight group-hover:text-[#3b82f6] transition-colors duration-300">
                                        {cpiInfo.val !== null ? `${cpiInfo.val.toFixed(1)}%` : 'N/A'}
                                    </h4>
                                </div>
                                <div className="flex flex-col items-end gap-1.5">
                                    <div className={`flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                        cpiInfo.change > 0 ? 'bg-rose-500/15 text-rose-400 border border-rose-500/20' : 
                                        cpiInfo.change < 0 ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' : 
                                        'bg-white/5 text-gray-400 border border-white/5'
                                    }`}>
                                        {cpiInfo.change > 0 ? <TrendingUp className="w-3 h-3" /> : cpiInfo.change < 0 ? <TrendingDown className="w-3 h-3" /> : null}
                                        <span>{cpiInfo.text}</span>
                                    </div>
                                    <div 
                                        className="text-[10px] font-semibold text-amber-300 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 px-2 py-0.5 rounded-full flex items-center gap-1 transition"
                                        title="월가 예상치 3.8% 대비 +0.1%p 상회"
                                    >
                                        <span>예상 3.8%</span>
                                        <span className="text-rose-400 font-bold">(+0.1%p)</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex-1 w-full h-[58px] -ml-2 -mb-2 mt-2">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={ADDITIONAL_INDICATORS_DATA.cpi.history}>
                                        <Line type="monotone" dataKey="val" stroke="#3b82f6" strokeWidth={2} dot={false} />
                                        <Line type="monotone" dataKey="est" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="3 3" dot={false} />
                                        <YAxis domain={['auto', 'auto']} hide={true} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="mt-2.5 flex items-center justify-between border-t border-white/5 pt-2">
                                <span className="text-[10px] text-gray-500">이전 달: {cpiInfo.prevVal !== null ? `${cpiInfo.prevVal.toFixed(1)}%` : 'N/A'}</span>
                                <span className="text-[10px] text-gray-500 font-mono">{cpiInfo.date || ''} 기준</span>
                            </div>
                        </div>

                        {/* 2열 상단: PPI Card */}
                        <div 
                            onClick={() => {
                                setSelectedConsensusIndicator('ppi');
                                setIsConsensusModalOpen(true);
                            }} 
                            className="cursor-pointer relative overflow-hidden bg-gradient-to-br from-[#1d2030]/40 to-[#121217]/60 border border-white/10 rounded-2xl p-4 shadow-lg backdrop-blur-sm group hover:border-[#10b981]/50 hover:shadow-[#10b981]/10 transition-all duration-300"
                        >
                            <div className="absolute top-0 left-0 w-1 h-full bg-[#10b981]" />
                            <div className="flex justify-between items-start">
                                <div>
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-xs font-semibold text-gray-400">생산자물가지수 (PPI YoY)</span>
                                        <span className="text-[9px] font-semibold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20">헤드라인</span>
                                    </div>
                                    <h4 className="text-2xl font-black text-white mt-1 font-mono tracking-tight group-hover:text-[#10b981] transition-colors duration-300">
                                        {ppiInfo.val !== null ? `${ppiInfo.val.toFixed(1)}%` : 'N/A'}
                                    </h4>
                                </div>
                                <div className="flex flex-col items-end gap-1.5">
                                    <div className={`flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                        ppiInfo.change > 0 ? 'bg-rose-500/15 text-rose-400 border border-rose-500/20' : 
                                        ppiInfo.change < 0 ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' : 
                                        'bg-white/5 text-gray-400 border border-white/5'
                                    }`}>
                                        {ppiInfo.change > 0 ? <TrendingUp className="w-3 h-3" /> : ppiInfo.change < 0 ? <TrendingDown className="w-3 h-3" /> : null}
                                        <span>{ppiInfo.text}</span>
                                    </div>
                                    <div 
                                        className="text-[10px] font-semibold text-amber-300 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 px-2 py-0.5 rounded-full flex items-center gap-1 transition"
                                        title="월가 예상치 8.4% 대비 +0.1%p 상회"
                                    >
                                        <span>예상 8.4%</span>
                                        <span className="text-rose-400 font-bold">(+0.1%p)</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex-1 w-full h-[58px] -ml-2 -mb-2 mt-2">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={ADDITIONAL_INDICATORS_DATA.ppi.history}>
                                        <Line type="monotone" dataKey="val" stroke="#10b981" strokeWidth={2} dot={false} />
                                        <Line type="monotone" dataKey="est" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="3 3" dot={false} />
                                        <YAxis domain={['auto', 'auto']} hide={true} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="mt-2.5 flex items-center justify-between border-t border-white/5 pt-2">
                                <span className="text-[10px] text-gray-500">이전 달: {ppiInfo.prevVal !== null ? `${ppiInfo.prevVal.toFixed(1)}%` : 'N/A'}</span>
                                <span className="text-[10px] text-gray-500 font-mono">{ppiInfo.date || ''} 기준</span>
                            </div>
                        </div>

                        {/* 3열 상단: PCE Card */}
                        <div 
                            onClick={() => {
                                setSelectedConsensusIndicator('pce');
                                setIsConsensusModalOpen(true);
                            }} 
                            className="cursor-pointer relative overflow-hidden bg-gradient-to-br from-[#1d2030]/40 to-[#121217]/60 border border-white/10 rounded-2xl p-4 shadow-lg backdrop-blur-sm group hover:border-[#ec4899]/50 hover:shadow-[#ec4899]/10 transition-all duration-300"
                        >
                            <div className="absolute top-0 left-0 w-1 h-full bg-[#ec4899]" />
                            <div className="flex justify-between items-start">
                                <div>
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-xs font-semibold text-gray-400">개인소비지출 (PCE YoY)</span>
                                        <span className="text-[9px] font-semibold text-pink-400 bg-pink-500/10 px-1.5 py-0.2 rounded border border-pink-500/20">연준기준</span>
                                    </div>
                                    <h4 className="text-2xl font-black text-white mt-1 font-mono tracking-tight group-hover:text-[#ec4899] transition-colors duration-300">
                                        {pceInfo.val !== null ? `${pceInfo.val.toFixed(1)}%` : 'N/A'}
                                    </h4>
                                </div>
                                <div className="flex flex-col items-end gap-1.5">
                                    <div className={`flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                        pceInfo.change > 0 ? 'bg-rose-500/15 text-rose-400 border border-rose-500/20' : 
                                        pceInfo.change < 0 ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' : 
                                        'bg-white/5 text-gray-400 border border-white/5'
                                    }`}>
                                        {pceInfo.change > 0 ? <TrendingUp className="w-3 h-3" /> : pceInfo.change < 0 ? <TrendingDown className="w-3 h-3" /> : null}
                                        <span>{pceInfo.text}</span>
                                    </div>
                                    <div 
                                        className="text-[10px] font-semibold text-emerald-300 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 px-2 py-0.5 rounded-full flex items-center gap-1 transition"
                                        title="월가 예상치 3.0% 부합"
                                    >
                                        <span>예상 3.0%</span>
                                        <span className="text-emerald-400 font-bold">(부합)</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex-1 w-full h-[58px] -ml-2 -mb-2 mt-2">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={ADDITIONAL_INDICATORS_DATA.pce.history}>
                                        <Line type="monotone" dataKey="val" stroke="#ec4899" strokeWidth={2} dot={false} />
                                        <Line type="monotone" dataKey="est" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="3 3" dot={false} />
                                        <YAxis domain={['auto', 'auto']} hide={true} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="mt-2.5 flex items-center justify-between border-t border-white/5 pt-2">
                                <span className="text-[10px] text-gray-500">이전 달: {pceInfo.prevVal !== null ? `${pceInfo.prevVal.toFixed(1)}%` : 'N/A'}</span>
                                <span className="text-[10px] text-gray-500 font-mono">{pceInfo.date || ''} 기준</span>
                            </div>
                        </div>

                        {/* 1열 하단: Core CPI Card (CPI 바로 아래에 배치) */}
                        <div 
                            onClick={() => {
                                setSelectedConsensusIndicator('core_cpi');
                                setIsConsensusModalOpen(true);
                            }} 
                            className="cursor-pointer relative overflow-hidden bg-gradient-to-br from-[#1d2030]/50 to-[#121217]/70 border border-indigo-500/20 hover:border-indigo-500/50 rounded-2xl p-4 shadow-lg backdrop-blur-sm group hover:shadow-indigo-500/10 transition-all duration-300"
                        >
                            <div className="absolute top-0 left-0 w-1 h-full bg-[#818cf8]" />
                            <div className="flex justify-between items-start">
                                <div>
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-xs font-semibold text-gray-300">근원 소비자물가지수 (Core CPI)</span>
                                        <span className="text-[9px] font-semibold text-indigo-300 bg-indigo-500/20 px-1.5 py-0.2 rounded border border-indigo-500/30">식품·에너지 제외</span>
                                    </div>
                                    <h4 className="text-2xl font-black text-white mt-1 font-mono tracking-tight group-hover:text-[#818cf8] transition-colors duration-300">
                                        {ADDITIONAL_INDICATORS_DATA.core_cpi.val.toFixed(1)}%
                                    </h4>
                                </div>
                                <div className="flex flex-col items-end gap-1.5">
                                    <div className="flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/20">
                                        <TrendingUp className="w-3 h-3" />
                                        <span>{ADDITIONAL_INDICATORS_DATA.core_cpi.text}</span>
                                    </div>
                                    <div 
                                        className="text-[10px] font-semibold text-amber-300 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 px-2 py-0.5 rounded-full flex items-center gap-1 transition"
                                        title="월가 예상치 3.2% 대비 +0.1%p 상회"
                                    >
                                        <span>예상 {ADDITIONAL_INDICATORS_DATA.core_cpi.estimate}%</span>
                                        <span className="text-rose-400 font-bold">(+{ADDITIONAL_INDICATORS_DATA.core_cpi.diff}%p)</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex-1 w-full h-[58px] -ml-2 -mb-2 mt-2">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={ADDITIONAL_INDICATORS_DATA.core_cpi.history}>
                                        <Line type="monotone" dataKey="val" stroke="#818cf8" strokeWidth={2} dot={false} />
                                        <Line type="monotone" dataKey="est" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="3 3" dot={false} />
                                        <YAxis domain={['auto', 'auto']} hide={true} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="mt-2.5 flex items-center justify-between border-t border-white/5 pt-2">
                                <span className="text-[10px] text-gray-500">이전 달: {ADDITIONAL_INDICATORS_DATA.core_cpi.prevVal.toFixed(1)}%</span>
                                <span className="text-[10px] text-gray-500 font-mono">{ADDITIONAL_INDICATORS_DATA.core_cpi.date} 기준</span>
                            </div>
                        </div>

                        {/* 2열 하단: Core PPI Card (PPI 바로 아래에 배치) */}
                        <div 
                            onClick={() => {
                                setSelectedConsensusIndicator('core_ppi');
                                setIsConsensusModalOpen(true);
                            }} 
                            className="cursor-pointer relative overflow-hidden bg-gradient-to-br from-[#1d2030]/50 to-[#121217]/70 border border-teal-500/20 hover:border-teal-500/50 rounded-2xl p-4 shadow-lg backdrop-blur-sm group hover:shadow-teal-500/10 transition-all duration-300"
                        >
                            <div className="absolute top-0 left-0 w-1 h-full bg-[#14b8a6]" />
                            <div className="flex justify-between items-start">
                                <div>
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-xs font-semibold text-gray-300">근원 생산자물가지수 (Core PPI)</span>
                                        <span className="text-[9px] font-semibold text-teal-300 bg-teal-500/20 px-1.5 py-0.2 rounded border border-teal-500/30">식품·에너지 제외</span>
                                    </div>
                                    <h4 className="text-2xl font-black text-white mt-1 font-mono tracking-tight group-hover:text-[#14b8a6] transition-colors duration-300">
                                        {ADDITIONAL_INDICATORS_DATA.core_ppi.val.toFixed(1)}%
                                    </h4>
                                </div>
                                <div className="flex flex-col items-end gap-1.5">
                                    <div className="flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/20">
                                        <TrendingUp className="w-3 h-3" />
                                        <span>{ADDITIONAL_INDICATORS_DATA.core_ppi.text}</span>
                                    </div>
                                    <div 
                                        className="text-[10px] font-semibold text-amber-300 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 px-2 py-0.5 rounded-full flex items-center gap-1 transition"
                                        title="월가 예상치 2.7% 대비 +0.1%p 상회"
                                    >
                                        <span>예상 {ADDITIONAL_INDICATORS_DATA.core_ppi.estimate}%</span>
                                        <span className="text-rose-400 font-bold">(+{ADDITIONAL_INDICATORS_DATA.core_ppi.diff}%p)</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex-1 w-full h-[58px] -ml-2 -mb-2 mt-2">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={ADDITIONAL_INDICATORS_DATA.core_ppi.history}>
                                        <Line type="monotone" dataKey="val" stroke="#14b8a6" strokeWidth={2} dot={false} />
                                        <Line type="monotone" dataKey="est" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="3 3" dot={false} />
                                        <YAxis domain={['auto', 'auto']} hide={true} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="mt-2.5 flex items-center justify-between border-t border-white/5 pt-2">
                                <span className="text-[10px] text-gray-500">이전 달: {ADDITIONAL_INDICATORS_DATA.core_ppi.prevVal.toFixed(1)}%</span>
                                <span className="text-[10px] text-gray-500 font-mono">{ADDITIONAL_INDICATORS_DATA.core_ppi.date} 기준</span>
                            </div>
                        </div>

                        {/* 3열 하단: Core PCE Card (PCE 바로 아래에 배치) */}
                        <div 
                            onClick={() => {
                                setSelectedConsensusIndicator('core_pce');
                                setIsConsensusModalOpen(true);
                            }} 
                            className="cursor-pointer relative overflow-hidden bg-gradient-to-br from-[#1d2030]/50 to-[#121217]/70 border border-rose-500/20 hover:border-rose-500/50 rounded-2xl p-4 shadow-lg backdrop-blur-sm group hover:shadow-rose-500/10 transition-all duration-300"
                        >
                            <div className="absolute top-0 left-0 w-1 h-full bg-[#f43f5e]" />
                            <div className="flex justify-between items-start">
                                <div>
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-xs font-semibold text-gray-300">근원 개인소비지출 (Core PCE)</span>
                                        <span className="text-[9px] font-semibold text-rose-300 bg-rose-500/20 px-1.5 py-0.2 rounded border border-rose-500/30">연준 최우선</span>
                                    </div>
                                    <h4 className="text-2xl font-black text-white mt-1 font-mono tracking-tight group-hover:text-[#f43f5e] transition-colors duration-300">
                                        {ADDITIONAL_INDICATORS_DATA.core_pce.val.toFixed(1)}%
                                    </h4>
                                </div>
                                <div className="flex flex-col items-end gap-1.5">
                                    <div className="flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/5 text-gray-400 border border-white/5">
                                        <span>{ADDITIONAL_INDICATORS_DATA.core_pce.text}</span>
                                    </div>
                                    <div 
                                        className="text-[10px] font-semibold text-amber-300 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 px-2 py-0.5 rounded-full flex items-center gap-1 transition"
                                        title="월가 예상치 2.6% 대비 +0.1%p 상회"
                                    >
                                        <span>예상 {ADDITIONAL_INDICATORS_DATA.core_pce.estimate}%</span>
                                        <span className="text-rose-400 font-bold">(+{ADDITIONAL_INDICATORS_DATA.core_pce.diff}%p)</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex-1 w-full h-[58px] -ml-2 -mb-2 mt-2">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={ADDITIONAL_INDICATORS_DATA.core_pce.history}>
                                        <Line type="monotone" dataKey="val" stroke="#f43f5e" strokeWidth={2} dot={false} />
                                        <Line type="monotone" dataKey="est" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="3 3" dot={false} />
                                        <YAxis domain={['auto', 'auto']} hide={true} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="mt-2.5 flex items-center justify-between border-t border-white/5 pt-2">
                                <span className="text-[10px] text-gray-500">이전 달: {ADDITIONAL_INDICATORS_DATA.core_pce.prevVal.toFixed(1)}%</span>
                                <span className="text-[10px] text-gray-500 font-mono">{ADDITIONAL_INDICATORS_DATA.core_pce.date} 기준</span>
                            </div>
                        </div>
                    </div>

                    {/* 추가 지표: 미국 핵심 고용 지표 (실업률 & 민간고용) 및 Fed 정책 영향 종합 */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-2 pt-3 border-t border-white/10">
                        {/* 1열: 실업률 (Unemployment Rate) */}
                        <div 
                            onClick={() => {
                                setSelectedConsensusIndicator('unemployment');
                                setIsConsensusModalOpen(true);
                            }} 
                            className="cursor-pointer relative overflow-hidden bg-gradient-to-br from-[#1d2030]/40 to-[#121217]/60 border border-sky-500/20 hover:border-sky-500/50 rounded-2xl p-4 shadow-lg backdrop-blur-sm group hover:shadow-sky-500/10 transition-all duration-300"
                        >
                            <div className="absolute top-0 left-0 w-1 h-full bg-[#0284c7]" />
                            <div className="flex justify-between items-start">
                                <div>
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-xs font-semibold text-gray-400">실업률 (Unemployment)</span>
                                        <span className="text-[9px] font-semibold text-sky-400 bg-sky-500/10 px-1.5 py-0.2 rounded border border-sky-500/20">노동부</span>
                                    </div>
                                    <h4 className="text-2xl font-black text-white mt-1 font-mono tracking-tight group-hover:text-[#0284c7] transition-colors duration-300">
                                        {ADDITIONAL_INDICATORS_DATA.unemployment.val.toFixed(1)}%
                                    </h4>
                                </div>
                                <div className="flex flex-col items-end gap-1.5">
                                    <div className="flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                                        <TrendingDown className="w-3 h-3" />
                                        <span>{ADDITIONAL_INDICATORS_DATA.unemployment.text}</span>
                                    </div>
                                    <div 
                                        className="text-[10px] font-semibold text-emerald-300 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 px-2 py-0.5 rounded-full flex items-center gap-1 transition"
                                        title="월가 예상치 4.2% 대비 -0.1%p 하회 (고용 호조)"
                                    >
                                        <span>예상 {ADDITIONAL_INDICATORS_DATA.unemployment.estimate}%</span>
                                        <span className="text-emerald-400 font-bold">({ADDITIONAL_INDICATORS_DATA.unemployment.diff}%p)</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex-1 w-full h-[58px] -ml-2 -mb-2 mt-2">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={ADDITIONAL_INDICATORS_DATA.unemployment.history}>
                                        <Line type="monotone" dataKey="val" stroke="#0284c7" strokeWidth={2} dot={false} />
                                        <Line type="monotone" dataKey="est" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="3 3" dot={false} />
                                        <YAxis domain={['auto', 'auto']} hide={true} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="mt-2.5 flex items-center justify-between border-t border-white/5 pt-2">
                                <span className="text-[10px] text-gray-500">이전 달: {ADDITIONAL_INDICATORS_DATA.unemployment.prevVal.toFixed(1)}%</span>
                                <span className="text-[10px] text-gray-500 font-mono">{ADDITIONAL_INDICATORS_DATA.unemployment.date} 기준</span>
                            </div>
                        </div>

                        {/* 2열: 비농업 민간고용 (Nonfarm Payrolls) */}
                        <div 
                            onClick={() => {
                                setSelectedConsensusIndicator('nonfarm_payrolls');
                                setIsConsensusModalOpen(true);
                            }} 
                            className="cursor-pointer relative overflow-hidden bg-gradient-to-br from-[#1d2030]/40 to-[#121217]/60 border border-purple-500/20 hover:border-purple-500/50 rounded-2xl p-4 shadow-lg backdrop-blur-sm group hover:shadow-purple-500/10 transition-all duration-300"
                        >
                            <div className="absolute top-0 left-0 w-1 h-full bg-[#a855f7]" />
                            <div className="flex justify-between items-start">
                                <div>
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-xs font-semibold text-gray-400">비농업 신규고용 (Nonfarm)</span>
                                        <span className="text-[9px] font-semibold text-purple-400 bg-purple-500/10 px-1.5 py-0.2 rounded border border-purple-500/20">신규일자리</span>
                                    </div>
                                    <h4 className="text-2xl font-black text-white mt-1 font-mono tracking-tight group-hover:text-[#a855f7] transition-colors duration-300">
                                        +{ADDITIONAL_INDICATORS_DATA.nonfarm.val}k
                                    </h4>
                                </div>
                                <div className="flex flex-col items-end gap-1.5">
                                    <div className="flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                                        <TrendingUp className="w-3 h-3" />
                                        <span>{ADDITIONAL_INDICATORS_DATA.nonfarm.text}</span>
                                    </div>
                                    <div 
                                        className="text-[10px] font-semibold text-emerald-300 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 px-2 py-0.5 rounded-full flex items-center gap-1 transition"
                                        title="월가 예상치 140k 대비 +114k 대폭 상회"
                                    >
                                        <span>예상 {ADDITIONAL_INDICATORS_DATA.nonfarm.estimate}k</span>
                                        <span className="text-emerald-400 font-bold">(+{ADDITIONAL_INDICATORS_DATA.nonfarm.diff}k)</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex-1 w-full h-[58px] -ml-2 -mb-2 mt-2">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={ADDITIONAL_INDICATORS_DATA.nonfarm.history}>
                                        <Line type="monotone" dataKey="val" stroke="#a855f7" strokeWidth={2} dot={false} />
                                        <Line type="monotone" dataKey="est" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="3 3" dot={false} />
                                        <YAxis domain={['auto', 'auto']} hide={true} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="mt-2.5 flex items-center justify-between border-t border-white/5 pt-2">
                                <span className="text-[10px] text-gray-500">이전 달: +{ADDITIONAL_INDICATORS_DATA.nonfarm.prevVal}k</span>
                                <span className="text-[10px] text-gray-500 font-mono">{ADDITIONAL_INDICATORS_DATA.nonfarm.date} 기준</span>
                            </div>
                        </div>

                        {/* 3열: 8대 지표 서프라이즈 종합 분석 요약 배너 */}
                        <div 
                            onClick={() => {
                                setSelectedConsensusIndicator('cpi');
                                setIsConsensusModalOpen(true);
                            }}
                            className="cursor-pointer relative overflow-hidden bg-gradient-to-br from-amber-500/10 via-indigo-500/10 to-purple-500/10 border border-amber-500/30 hover:border-amber-400/60 rounded-2xl p-4 shadow-lg backdrop-blur-sm group transition-all duration-300 flex flex-col justify-between"
                        >
                            <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-amber-400 to-indigo-500" />
                            <div>
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                                        <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-spin" style={{ animationDuration: '6s' }} />
                                        8대 경제지표 서프라이즈 종합
                                    </span>
                                    <span className="text-[10px] font-bold text-amber-400 bg-amber-500/20 px-2 py-0.5 rounded-full border border-amber-500/30">
                                        매파적(Hawkish)
                                    </span>
                                </div>
                                <h4 className="text-sm font-bold text-white mt-2 group-hover:text-amber-300 transition-colors">
                                    물가 지표 상방 압력 vs 견조한 고용 서프라이즈
                                </h4>
                                <p className="text-[11px] text-gray-400 mt-1 line-clamp-2 leading-relaxed">
                                    근원 CPI(3.3%) 및 고용(+254k)이 예상치를 상회하여 연준의 조기 빅컷(50bp) 가능성을 제약 중입니다.
                                </p>
                            </div>

                            <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between text-xs font-semibold text-amber-300 group-hover:text-amber-200">
                                <span>8대 지표 월가 대조 분석표 열기</span>
                                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                            </div>
                        </div>
                    </div>

                    <div className="text-xs text-center text-gray-400 mt-2 flex flex-wrap items-center justify-center gap-3">
                        <button 
                            onClick={() => {
                                setActiveModal('inflation');
                                setTimeout(() => {
                                    document.getElementById('us-economy-title')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                }, 10);
                            }}
                            className="text-gray-400 hover:text-white flex items-center gap-1 transition cursor-pointer"
                        >
                            <ChevronRight className="w-4 h-4 text-indigo-400" />
                            상세 10년 추세선 보기
                        </button>
                    </div>


                    {/* Chart Container removed. Moved to modal. */}
                </div>

                {/* AI 매크로 로테이션 나침반 (미국/한국 분석) */}
                <MacroCompass />

                {/* 2D 거시경제 4국면 나침반 & 국면별 최적 ETF 레이더 (S6-33) */}
                <MacroRegimeQuadrant />

                {/* AI Insight - 전문가 시장 분석 */}
                <AIInsight />

            </div>

            {/* 8대 주요 경제 지표 월가 예상치 vs 실제치 서프라이즈 분석 모달 */}
            <MacroConsensusSurpriseModal
                isOpen={isConsensusModalOpen}
                onClose={() => setIsConsensusModalOpen(false)}
                initialIndicator={selectedConsensusIndicator}
            />

        </div>
    );
}
