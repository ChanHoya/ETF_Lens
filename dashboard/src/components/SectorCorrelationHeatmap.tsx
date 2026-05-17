"use client";

import React, { useState, useEffect } from 'react';
import { HelpCircle, RefreshCw, BarChart2, CheckCircle2, AlertCircle } from 'lucide-react';
import { API_BASE } from '../lib/apiConfig';

interface CorrelationPoint {
    x: string;
    y: string;
    value: number;
}

interface CorrelationResponse {
    keys: string[];
    data: CorrelationPoint[];
}

export default function SectorCorrelationHeatmap() {
    const [period, setPeriod] = useState<'180d' | '360d'>('180d');
    const [filterRegion, setFilterRegion] = useState<'ALL' | 'KR' | 'US'>('ALL');
    const [corrData, setCorrData] = useState<CorrelationResponse | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [hoveredCell, setHoveredCell] = useState<{ x: string; y: string; val: number } | null>(null);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`${API_BASE}/api/v1/analyze/sector-correlation?period=${period}`);
            const data: CorrelationResponse = await res.json();
            setCorrData(data);
        } catch (err) {
            console.error('Failed to fetch correlation matrix:', err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [period]);

    if (isLoading) {
        return (
            <div className="bg-black/20 border border-white/5 rounded-2xl p-6 h-[450px] flex flex-col items-center justify-center animate-pulse">
                <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin mb-4" />
                <span className="text-sm text-gray-400 font-medium">섹터별 상관관계 분석 데이터를 계산하는 중...</span>
            </div>
        );
    }

    if (!corrData || !corrData.keys.length) {
        return (
            <div className="bg-black/20 border border-white/5 rounded-2xl p-6 h-[200px] flex items-center justify-center text-gray-400">
                상관관계 데이터를 불러오지 못했습니다.
            </div>
        );
    }

    // Filter keys depending on filterRegion
    const filteredKeys = corrData.keys.filter(k => {
        if (filterRegion === 'KR') return k.startsWith('K-');
        if (filterRegion === 'US') return k.startsWith('US-');
        return true;
    });

    // Create a 2D lookup map for speed
    const matrixMap: Record<string, Record<string, number>> = {};
    corrData.data.forEach(p => {
        if (!matrixMap[p.x]) matrixMap[p.x] = {};
        matrixMap[p.x][p.y] = p.value;
    });

    // Color scaling function based on correlation value (-1.0 to 1.0)
    const getCellColor = (val: number) => {
        if (val === 1.0) return 'bg-indigo-600/90 text-white font-bold border border-indigo-400/30';
        
        if (val > 0) {
            // Positives: Blue Scale (using tailwind opacity)
            if (val > 0.7) return 'bg-indigo-500/80 text-white font-semibold';
            if (val > 0.4) return 'bg-blue-500/60 text-blue-100';
            if (val > 0.2) return 'bg-blue-500/30 text-gray-300';
            return 'bg-blue-500/10 text-gray-400';
        } else if (val < 0) {
            // Negatives: Red/Orange Scale (excellent diversification)
            const abs = Math.abs(val);
            if (abs > 0.5) return 'bg-emerald-500/50 text-emerald-100 font-semibold border border-emerald-400/20';
            if (abs > 0.2) return 'bg-emerald-500/35 text-emerald-200';
            return 'bg-emerald-500/15 text-gray-400';
        }
        return 'bg-white/5 text-gray-500';
    };

    // Educational interpretation based on correlation value
    const getInterpretation = (val: number) => {
        if (val >= 0.8) return { label: '동일 흐름 (매우 높음)', color: 'text-red-400', desc: '두 섹터가 사실상 동조하여 움직입니다. 분산 투자 시너지가 거의 없습니다.' };
        if (val >= 0.5) return { label: '강한 양의 상관성', color: 'text-orange-400', desc: '유사한 경제 모멘텀을 공유하므로 동시 하락 리스크에 주의하세요.' };
        if (val >= 0.2) return { label: '약한 양의 상관성', color: 'text-yellow-400', desc: '어느 정도의 완충 지대가 존재하지만 약한 동조화가 나타납니다.' };
        if (val >= -0.1 && val <= 0.19) return { label: '상관없음 (중립)', color: 'text-slate-300', desc: '두 자산이 독립적으로 작용하여 우수한 분산 효과를 냅니다.' };
        return { label: '음의 상관성 (헤지 효과)', color: 'text-emerald-400', desc: '역방향으로 움직이는 성향이 있어 하락장을 방어하는 최고의 파트너입니다.' };
    };

    const cleanLabel = (lbl: string) => lbl.replace('K-', '').replace('US-', '');

    return (
        <div className="bg-black/30 border border-white/5 rounded-3xl p-6 backdrop-blur-xl space-y-6">
            
            {/* Header tab section */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/5 pb-5">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
                        <BarChart2 className="w-5 h-5 text-indigo-400" />
                    </div>
                    <div>
                        <h3 className="text-md font-bold text-white flex items-center gap-1.5">
                            섹터 간 상관관계 분석 계수 (Correlation Matrix)
                        </h3>
                        <p className="text-xs text-gray-400 mt-1">
                            과거 시계열 수익률의 피어슨 계수를 기반으로 한 분산 투자 시너지를 진단합니다.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3 self-start sm:self-center">
                    {/* Period Switch */}
                    <div className="flex bg-[#1a1a23] p-1 rounded-xl border border-white/5 text-xs font-bold">
                        <button
                            onClick={() => setPeriod('180d')}
                            className={`px-3 py-1.5 rounded-lg transition-all ${period === '180d' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}
                        >
                            6개월
                        </button>
                        <button
                            onClick={() => setPeriod('360d')}
                            className={`px-3 py-1.5 rounded-lg transition-all ${period === '360d' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}
                        >
                            1년
                        </button>
                    </div>

                    {/* Region Switch */}
                    <div className="flex bg-[#1a1a23] p-1 rounded-xl border border-white/5 text-xs font-bold">
                        {(['ALL', 'KR', 'US'] as const).map(r => (
                            <button
                                key={r}
                                onClick={() => setFilterRegion(r)}
                                className={`px-3 py-1.5 rounded-lg transition-all ${filterRegion === r ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}
                            >
                                {r === 'ALL' ? '전체' : r === 'KR' ? '국내' : '미국'}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Matrix Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                
                {/* 2D Heatmap Grid Container */}
                <div className="lg:col-span-8 overflow-x-auto custom-scrollbar pb-3">
                    <div className="min-w-[640px] flex flex-col select-none">
                        
                        {/* Column Headers */}
                        <div className="flex">
                            {/* Empty space for row labels */}
                            <div className="w-24 shrink-0" />
                            <div className="flex w-full justify-between">
                                {filteredKeys.map(k => (
                                    <div 
                                        key={k} 
                                        className={`w-full text-center text-[10px] font-black py-2 truncate transition-colors ${
                                            hoveredCell?.x === k ? 'text-indigo-400 font-black' : 'text-gray-400'
                                        }`}
                                        title={k}
                                    >
                                        <span className={`text-[8px] mr-0.5 px-0.5 rounded ${k.startsWith('K-') ? 'bg-blue-500/20 text-blue-400' : 'bg-amber-500/20 text-amber-400'}`}>
                                            {k.startsWith('K-') ? 'K' : 'U'}
                                        </span>
                                        {cleanLabel(k)}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Rows */}
                        <div className="space-y-1">
                            {filteredKeys.map(yKey => (
                                <div key={yKey} className="flex items-center">
                                    
                                    {/* Row Header Label */}
                                    <div 
                                        className={`w-24 text-right pr-3 text-[10px] font-black truncate transition-colors shrink-0 ${
                                            hoveredCell?.y === yKey ? 'text-indigo-400' : 'text-gray-400'
                                        }`}
                                    >
                                        <span className={`text-[8px] mr-1 px-0.5 rounded ${yKey.startsWith('K-') ? 'bg-blue-500/20 text-blue-400' : 'bg-amber-500/20 text-amber-400'}`}>
                                            {yKey.startsWith('K-') ? 'KR' : 'US'}
                                        </span>
                                        {cleanLabel(yKey)}
                                    </div>

                                    {/* Cell Grid */}
                                    <div className="flex w-full gap-1 justify-between">
                                        {filteredKeys.map(xKey => {
                                            const val = matrixMap[xKey]?.[yKey] ?? 0;
                                            const colorClass = getCellColor(val);
                                            const isHovered = hoveredCell?.x === xKey && hoveredCell?.y === yKey;

                                            return (
                                                <div
                                                    key={xKey}
                                                    onMouseEnter={() => setHoveredCell({ x: xKey, y: yKey, val })}
                                                    onMouseLeave={() => setHoveredCell(null)}
                                                    className={`w-full aspect-square flex items-center justify-center rounded-lg text-[11px] transition-all cursor-crosshair duration-100 ${colorClass} ${
                                                        isHovered 
                                                        ? 'ring-2 ring-white scale-110 z-10 shadow-lg shadow-indigo-500/50' 
                                                        : 'hover:scale-105'
                                                    }`}
                                                >
                                                    {val.toFixed(2)}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Focus Dashboard Detail (Side Card) */}
                <div className="lg:col-span-4 space-y-4">
                    {hoveredCell ? (
                        <div className="bg-[#1a1a23]/60 border border-indigo-500/30 p-5 rounded-2xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-150 shadow-lg shadow-indigo-500/5">
                            <span className="text-[10px] uppercase tracking-wider font-extrabold text-indigo-400">포커스 상관분석</span>
                            <h4 className="text-base font-extrabold text-white mt-1 mb-3 flex items-center flex-wrap gap-1">
                                <span className={`text-[9px] px-1 rounded ${hoveredCell.x.startsWith('K-') ? 'bg-blue-500/20 text-blue-400' : 'bg-amber-500/20 text-amber-400'}`}>
                                    {hoveredCell.x}
                                </span>
                                <span className="text-gray-500 font-normal">⇄</span>
                                <span className={`text-[9px] px-1 rounded ${hoveredCell.y.startsWith('K-') ? 'bg-blue-500/20 text-blue-400' : 'bg-amber-500/20 text-amber-400'}`}>
                                    {hoveredCell.y}
                                </span>
                            </h4>

                            <div className="bg-black/40 p-4 rounded-xl space-y-3 mb-4">
                                <div className="flex justify-between items-end border-b border-white/5 pb-2">
                                    <span className="text-xs text-gray-400 font-medium">피어슨 상관계수 (r)</span>
                                    <span className="text-2xl font-black text-white tracking-tighter">
                                        {hoveredCell.val.toFixed(4)}
                                    </span>
                                </div>
                                <div className="space-y-1">
                                    <div className="text-[11px] font-bold text-gray-500">통계적 진단</div>
                                    <div className={`text-xs font-black ${getInterpretation(hoveredCell.val).color}`}>
                                        {getInterpretation(hoveredCell.val).label}
                                    </div>
                                </div>
                            </div>

                            <p className="text-xs text-gray-300 leading-relaxed font-medium bg-indigo-500/5 p-3 rounded-lg border border-indigo-500/10">
                                {getInterpretation(hoveredCell.val).desc}
                            </p>
                        </div>
                    ) : (
                        <div className="bg-[#1a1a23]/30 border border-white/5 p-6 rounded-2xl text-center flex flex-col items-center justify-center h-[260px]">
                            <HelpCircle className="w-10 h-10 text-indigo-400/40 mb-3 animate-pulse" />
                            <h4 className="text-sm font-bold text-gray-200">셀 위에 마우스를 올려보세요</h4>
                            <p className="text-xs text-gray-400 max-w-[200px] mt-2 leading-relaxed">
                                히트맵 셀에 마우스를 올리면 각 섹터 쌍의 상세 진단 및 포트폴리오 분석 데이터를 제공합니다.
                            </p>
                        </div>
                    )}

                    {/* Educational Color Legend Card */}
                    <div className="bg-[#1a1a23]/20 border border-white/5 p-4 rounded-2xl text-xs space-y-3">
                        <div className="font-bold text-gray-300">상관계수 해석 가이드</div>
                        <div className="grid grid-cols-2 gap-2 text-[10px] font-semibold text-gray-400">
                            <div className="flex items-center gap-1.5">
                                <div className="w-3 h-3 rounded bg-indigo-500/80 shrink-0" />
                                <span>0.7 ~ 1.0 (매우 강함)</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="w-3 h-3 rounded bg-blue-500/60 shrink-0" />
                                <span>0.4 ~ 0.7 (보통 동조)</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="w-3 h-3 rounded bg-emerald-500/35 shrink-0" />
                                <span>0.0 ~ -0.5 (역방향 헤지)</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="w-3 h-3 rounded bg-white/5 shrink-0" />
                                <span>-0.1 ~ 0.2 (분산효과)</span>
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
