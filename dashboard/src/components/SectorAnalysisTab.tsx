"use client";

import React, { useState } from 'react';
import { Activity, Globe, Zap, Layers } from 'lucide-react';
import SemiChart from '@/components/SemiChart';
import SpaceChart from '@/components/SpaceChart';
import SectorComparisonChart from '@/components/SectorComparisonChart';
import SectorStatusGrid from '@/components/SectorStatusGrid';
import SectorCorrelationHeatmap from '@/components/SectorCorrelationHeatmap';

interface SectorAnalysisTabProps {
    onOpenDetail?: (code: string) => void;
}

export default function SectorAnalysisTab({ onOpenDetail }: SectorAnalysisTabProps) {
    const [region, setRegion] = useState<'KR' | 'US' | 'ALL'>('ALL');
    const [selectedSector, setSelectedSector] = useState<string | null>(null);

    return (
        <div className="w-full animate-in fade-in slide-in-from-bottom-2 duration-500 bg-[#121217]/80 p-4 lg:p-6 border border-white/10 rounded-3xl backdrop-blur-3xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] mt-0">
            <div className="flex flex-col gap-6 w-full h-full">
                
                {/* Header & Region Filter */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-black/20 p-4 rounded-2xl border border-white/5 backdrop-blur-md w-full">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center shadow-lg shadow-cyan-500/20 shrink-0">
                            <Layers className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <div className="flex flex-wrap items-center gap-3">
                                <h2 className="text-xl font-extrabold text-white">섹터 분석</h2>
                            </div>
                            <p className="text-sm text-gray-400 font-medium mt-0.5">글로벌 테마별 지수 및 섹터 순환매 동향</p>
                        </div>
                    </div>

                    <div className="flex bg-[#1a1a23] p-1 rounded-xl border border-white/10 self-start md:self-center">
                        {(['ALL', 'KR', 'US'] as const).map((r) => (
                            <button
                                key={r}
                                onClick={() => {
                                    setRegion(r);
                                    setSelectedSector(null); // Reset sector selection on region change
                                }}
                                className={`px-4 py-2 text-sm font-bold rounded-lg transition-all flex items-center gap-2 ${
                                    region === r 
                                    ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-lg' 
                                    : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
                                }`}
                            >
                                {r === 'ALL' && <Globe className="w-4 h-4" />}
                                {r === 'KR' && <span className="text-[10px] bg-white/10 px-1 rounded">KR</span>}
                                {r === 'US' && <span className="text-[10px] bg-white/10 px-1 rounded">US</span>}
                                {r === 'ALL' ? '통합' : r === 'KR' ? '국내' : '미국'}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Sector Performance Overview Grid */}
                <SectorStatusGrid 
                    region={region} 
                    selectedSector={selectedSector}
                    onSelectSector={setSelectedSector}
                />

                {/* Major Sector Comparison Chart */}
                <SectorComparisonChart 
                    region={region} 
                    selectedSector={selectedSector}
                />

                {/* SemiChart: Semiconductor Indices (Detailed View) */}
                {region !== 'US' && selectedSector === '반도체' && (
                    <div className="space-y-4">
                        <div className="flex items-center gap-2.5 px-2 mt-4">
                            <Zap className="w-5 h-5 text-amber-400" />
                            <h3 className="text-xl font-extrabold text-white">반도체 특화 분석</h3>
                        </div>
                        <SemiChart />
                    </div>
                )}

                {/* SpaceChart: Space Indices (Detailed View) */}
                {region !== 'US' && selectedSector === '우주' && (
                    <div className="space-y-4">
                        <div className="flex items-center gap-2.5 px-2 mt-4">
                            <Zap className="w-5 h-5 text-cyan-400" />
                            <h3 className="text-xl font-extrabold text-white">우주 특화 분석</h3>
                        </div>
                        <SpaceChart onOpenDetail={onOpenDetail} />
                    </div>
                )}

                {/* Sector Correlation Heatmap */}
                <div className="space-y-3">
                    <SectorCorrelationHeatmap />
                </div>

            </div>
        </div>
    );
}
