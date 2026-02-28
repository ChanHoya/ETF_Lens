"use client";

import React, { useState, useEffect } from 'react';
import { Search, TrendingUp, ShieldCheck, Zap, Activity, AlertCircle } from 'lucide-react';
import { ResponsiveContainer, Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Tooltip as RechartsTooltip } from 'recharts';
import TaxSimulator from '@/components/TaxSimulator';
import MacroRotation from '@/components/MacroRotation';

export default function DiscoverTab() {
    const [evaluations, setEvaluations] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedEtf, setSelectedEtf] = useState<any | null>(null);

    useEffect(() => {
        const fetchEvaluations = async () => {
            try {
                const isCloudDeployment = window.location.hostname.includes('onrender.com') || window.location.hostname.includes('vercel.app');
                const apiUrl = isCloudDeployment
                    ? 'https://etf-lens.onrender.com/api/v1/analyze/evaluate'
                    : `http://${window.location.hostname}:8000/api/v1/analyze/evaluate`;
                const res = await fetch(apiUrl);
                const data = await res.json();
                if (Array.isArray(data)) {
                    let paddedData = [...data];
                    // Fill up to 10 items for UI demonstration purposes if DB has fewer
                    if (paddedData.length > 0 && paddedData.length < 10) {
                        const templates = [...paddedData];
                        let tIdx = 0;
                        while (paddedData.length < 10) {
                            const template = templates[tIdx % templates.length];
                            paddedData.push({
                                ...template,
                                code: template.code + '-' + paddedData.length,
                                name: template.name + ' (시뮬레이션)',
                            });
                            tIdx++;
                        }
                    }
                    setEvaluations(paddedData);
                    if (paddedData.length > 0) {
                        setSelectedEtf(paddedData[0]);
                    }
                }
            } catch (error) {
                console.error("Error fetching evaluations", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchEvaluations();
    }, []);

    const getRadarData = (scores: any) => {
        if (!scores) return [];
        return [
            { subject: '수익성(Perf)', A: scores.performance || 0, fullMark: 100 },
            { subject: '성장/가치(Fund)', A: scores.fundamental || 0, fullMark: 100 },
            { subject: '유동성(Liq)', A: scores.liquidity || 0, fullMark: 100 },
            { subject: '비용(Cost)', A: scores.cost || 0, fullMark: 100 },
            { subject: '안정성(Track)', A: scores.tracking || 0, fullMark: 100 },
        ];
    };

    const getRatingColor = (rating: string) => {
        if (rating === '최우수') return 'text-amber-400 bg-amber-400/10 border-amber-400/30';
        if (rating === '우수') return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30';
        if (rating === '보통') return 'text-blue-400 bg-blue-400/10 border-blue-400/30';
        return 'text-rose-400 bg-rose-400/10 border-rose-400/30';
    };

    const getRatingIcon = (rating: string) => {
        if (rating === '최우수') return <Zap className="w-4 h-4" />;
        if (rating === '우수') return <TrendingUp className="w-4 h-4" />;
        if (rating === '보통') return <ShieldCheck className="w-4 h-4" />;
        return <AlertCircle className="w-4 h-4" />;
    };

    return (
        <div className="w-full animate-in fade-in slide-in-from-bottom-2 duration-500 bg-white/[0.03] p-3 lg:p-4 border border-white/10 rounded-3xl backdrop-blur-3xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] mt-0">
            <div className="flex flex-col gap-3 w-full h-full">

                {/* Top: Macro Rotation */}
                <MacroRotation />

                {/* Middle: Selection List (Left) and Radar Details (Right) */}
                <div className="flex flex-col lg:flex-row gap-3 w-full">

                    {/* Left Panel: ETF Leaderboard List (formerly Right Panel) */}
                    <div className="w-full lg:w-2/3 flex flex-col gap-3">
                        {/* Filter / Search Actions */}
                        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white/[0.02] p-2 rounded-2xl border border-white/5 backdrop-blur-sm">
                            <div className="relative w-full sm:max-w-xs">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                <input
                                    type="text"
                                    placeholder="ETF 종목명 또는 코드 검색..."
                                    className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all text-white placeholder-gray-600 block"
                                />
                            </div>
                            <div className="flex gap-2 w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0 scrollbar-hide">
                                <button className="px-4 py-2 bg-white/10 hover:bg-white/15 border border-white/10 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors text-white">종합점수 순</button>
                                <button className="px-4 py-2 bg-black/40 hover:bg-white/5 border border-white/5 rounded-xl text-xs font-medium whitespace-nowrap transition-colors text-gray-400">유동성 우수</button>
                                <button className="px-4 py-2 bg-black/40 hover:bg-white/5 border border-white/5 rounded-xl text-xs font-medium whitespace-nowrap transition-colors text-gray-400">저비용 패시브</button>
                            </div>
                        </div>

                        {/* ListView */}
                        <div className="bg-[#121217]/60 border border-white/10 rounded-3xl overflow-hidden backdrop-blur-md shadow-xl flex-1 flex flex-col h-full">
                            <div className="overflow-x-auto h-full">
                                <table className="w-full text-left border-collapse whitespace-nowrap min-w-[750px]">
                                    <thead className="sticky top-0 bg-[#09090b]/90 backdrop-blur-md z-10 border-b border-white/10">
                                        <tr className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">
                                            <th className="py-3 px-4 text-center w-12">순위</th>
                                            <th className="py-3 px-3 text-center w-24">종목코드</th>
                                            <th className="py-3 px-3 w-[260px]">종목명</th>
                                            <th className="py-3 px-2 text-center">종합 등급</th>
                                            <th className="py-3 px-2 text-center">총점</th>
                                            <th className="py-3 px-3 text-right">순자산총액</th>
                                            <th className="py-3 px-4 text-right">운용사</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5 text-sm">
                                        {evaluations.slice(0, 10).map((etf, idx) => {
                                            const isSelected = selectedEtf?.code === etf.code;
                                            return (
                                                <tr
                                                    key={etf.code}
                                                    onClick={() => setSelectedEtf(etf)}
                                                    className={`cursor-pointer transition-colors ${isSelected ? 'bg-indigo-500/10' : 'hover:bg-white/[0.03]'}`}
                                                >
                                                    <td className="py-3 px-4 text-center">
                                                        <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[11px] font-bold ${idx < 3 ? 'bg-amber-400/20 text-amber-400' : 'text-gray-500'}`}>
                                                            {idx + 1}
                                                        </span>
                                                    </td>
                                                    <td className="py-3 px-3 text-center">
                                                        <span className="text-xs text-gray-400 font-mono">{etf.code}</span>
                                                    </td>
                                                    <td className="py-3 px-3">
                                                        <span className={`font-bold block text-[13px] truncate max-w-[260px] ${isSelected ? 'text-indigo-300' : 'text-gray-200'}`}>{etf.name}</span>
                                                    </td>
                                                    <td className="py-3 px-2 text-center">
                                                        <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold ${getRatingColor(etf.scores.rating)}`}>
                                                            {getRatingIcon(etf.scores.rating)}
                                                            {etf.scores.rating}
                                                        </div>
                                                    </td>
                                                    <td className="py-3 px-2 text-center">
                                                        <span className="font-mono text-[13px] font-bold text-gray-300">{Math.round(etf.scores.total)}</span>
                                                    </td>
                                                    <td className="py-3 px-3 text-right text-[12px] text-gray-400">
                                                        {etf.aum || '-'}
                                                    </td>
                                                    <td className="py-3 px-4 text-right text-[11px] text-gray-500">
                                                        {etf.issuer || '-'}
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                        {evaluations.length === 0 && !isLoading && (
                                            <tr>
                                                <td colSpan={7} className="py-12 text-center text-gray-500">
                                                    평가된 ETF 데이터가 없습니다. DB Sync를 확인하세요.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    {/* Right Panel: Selected ETF Radar & Detailed Score */}
                    <div className="w-full lg:w-1/3 flex flex-col h-full">
                        {selectedEtf ? (
                            <div className="bg-[#121217]/80 border border-white/10 rounded-3xl p-5 backdrop-blur-xl shadow-2xl h-full flex flex-col justify-between animate-in fade-in slide-in-from-right-4 duration-500">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h2 className="text-xl font-bold text-white mb-1 leading-tight pr-4">{selectedEtf.name}</h2>
                                        <p className="text-gray-400 text-sm font-mono">{selectedEtf.code} • {selectedEtf.issuer}</p>
                                    </div>
                                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-bold whitespace-nowrap flex-shrink-0 shadow-lg ${getRatingColor(selectedEtf.scores.rating)}`}>
                                        {getRatingIcon(selectedEtf.scores.rating)}
                                        {selectedEtf.scores.rating} 등급
                                    </div>
                                </div>

                                {/* Radar Chart Area */}
                                <div className="bg-black/40 rounded-2xl border border-white/5 p-3 mb-4 flex flex-col items-center relative overflow-hidden group">
                                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-fuchsia-500/10 opacity-50 group-hover:opacity-100 transition-opacity"></div>
                                    <h3 className="text-sm font-semibold text-gray-300 w-full text-center mb-1 z-10 flex items-center justify-center gap-2">
                                        <Activity className="w-4 h-4 text-indigo-400" />
                                        다면 평가 프로파일 (X-Ray)
                                    </h3>
                                    <div className="w-full h-[180px] relative z-10">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <RadarChart cx="50%" cy="50%" outerRadius="70%" data={getRadarData(selectedEtf.scores)}>
                                                <PolarGrid stroke="rgba(255,255,255,0.1)" strokeWidth={1} />
                                                <PolarAngleAxis dataKey="subject" tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: 500 }} />
                                                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                                                <Radar
                                                    name="Score"
                                                    dataKey="A"
                                                    stroke="#8b5cf6"
                                                    strokeWidth={2}
                                                    fill="#8b5cf6"
                                                    fillOpacity={0.4}
                                                />
                                                <RechartsTooltip
                                                    contentStyle={{ backgroundColor: 'rgba(9, 9, 11, 0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '13px' }}
                                                    itemStyle={{ color: '#fff' }}
                                                />
                                            </RadarChart>
                                        </ResponsiveContainer>
                                    </div>

                                    <div className="w-full mt-2 flex justify-center">
                                        <div className="flex flex-col items-center">
                                            <span className="text-xs text-gray-500 mb-0.5">통합 평가 점수</span>
                                            <span className="text-3xl font-black bg-clip-text text-transparent bg-gradient-to-b from-white to-gray-500 drop-shadow-md">
                                                {Math.round(selectedEtf.scores.total)}
                                                <span className="text-base text-gray-600 ml-1">/ 100</span>
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Score Breakdown Bars */}
                                <div className="space-y-3">
                                    <h3 className="text-sm font-semibold text-gray-300 border-b border-white/10 pb-2">세부 항목 점수</h3>
                                    {[
                                        { label: '유동성 (순자산/거래량)', value: selectedEtf.scores.liquidity, color: 'bg-blue-500' },
                                        { label: '비용 효율성 (보수/괴리율)', value: selectedEtf.scores.cost, color: 'bg-emerald-500' },
                                        { label: '추적오차 안정성', value: selectedEtf.scores.tracking, color: 'bg-amber-500' },
                                        { label: '수익/펀더멘탈성', value: ((selectedEtf.scores.performance || 0) + (selectedEtf.scores.fundamental || 0)) / 2, color: 'bg-rose-500' },
                                    ].map((item, idx) => (
                                        <div key={idx} className="flex flex-col gap-1.5">
                                            <div className="flex justify-between text-xs">
                                                <span className="text-gray-400">{item.label}</span>
                                                <span className="text-gray-200 font-bold">{Math.round(item.value)}</span>
                                            </div>
                                            <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                                                <div className={`h-full ${item.color} rounded-full transition-all duration-1000 ease-out`} style={{ width: `${item.value}%` }}></div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="bg-[#121217]/50 border border-white/5 rounded-3xl p-6 h-[600px] flex items-center justify-center backdrop-blur-md">
                                <div className="text-gray-500 flex flex-col items-center gap-4">
                                    {isLoading ? (
                                        <>
                                            <div className="w-8 h-8 rounded-full border-4 border-indigo-500/30 border-t-indigo-500 animate-spin"></div>
                                            평가 엔진 데이터 로딩 중...
                                        </>
                                    ) : (
                                        "분석할 ETF를 선택하세요"
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Bottom: Tax Simulator */}
                <TaxSimulator />

            </div>
        </div>
    );
}
