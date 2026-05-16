"use client";

import React from 'react';
import { Activity } from 'lucide-react';
import SemiChart from '@/components/SemiChart';

export default function SectorAnalysisTab() {
    return (
        <div className="w-full animate-in fade-in slide-in-from-bottom-2 duration-500 bg-[#121217]/80 p-4 lg:p-6 border border-white/10 rounded-3xl backdrop-blur-3xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] mt-0">
            <div className="flex flex-col gap-3 w-full h-full">
                
                {/* SemiChart: Semiconductor Indices — "도메인별 지표" 섹션 타이틀 */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mt-2 mb-0 bg-black/20 p-4 rounded-xl border border-white/5 backdrop-blur-md w-full">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center shadow-lg shadow-cyan-500/20 shrink-0">
                            <Activity className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <div className="flex flex-wrap items-center gap-3">
                                <h2 className="text-xl font-extrabold text-white">도메인별 지표</h2>
                            </div>
                            <p className="text-sm text-gray-400 font-medium mt-0.5">반도체 지수 및 글로벌 섹터 동향</p>
                        </div>
                    </div>
                </div>
                <SemiChart />

            </div>
        </div>
    );
}
