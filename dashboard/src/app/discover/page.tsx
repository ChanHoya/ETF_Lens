"use client";

import React, { useState, useEffect } from 'react';
import { Search, Info, TrendingUp, ShieldCheck, Zap, Activity, AlertCircle, Percent } from 'lucide-react';
import { ResponsiveContainer, Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Tooltip as RechartsTooltip } from 'recharts';
import TaxSimulator from '@/components/TaxSimulator';
import MacroRotation from '@/components/MacroRotation';
import FxFinder from '@/components/FxFinder';

export default function DiscoverPage() {
    const [evaluations, setEvaluations] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedEtf, setSelectedEtf] = useState<any | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortCriteria, setSortCriteria] = useState<'total' | 'liquidity' | 'cost'>('total');

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
                    setEvaluations(data);
                    if (data.length > 0) {
                        setSelectedEtf(data[0]);
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

    const formatNumber = (val: number | string) => {
        if (!val) return '0';
        if (typeof val === 'string') return val;
        return new Intl.NumberFormat('ko-KR').format(Math.floor(val));
    };

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
        <div className="min-h-screen bg-[#09090b] text-white p-4 md:p-8 font-sans selection:bg-indigo-500/30">
            {/* Header Structure identical to My App */}
            <header className="max-w-7xl mx-auto flex justify-between items-center mb-8 border-b border-white/10 pb-6 mt-4">
                <div className="flex items-end gap-3">
                    <h1 className="text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-fuchsia-400 via-indigo-400 to-cyan-400">
                        ETF Lens <span className="text-white font-medium text-2xl">Discover</span>
                    </h1>
                    <span className="text-gray-400 text-sm font-medium pb-1.5 hidden sm:inline-block">
                        AI-Driven ETF Evaluation System
                    </span>
                    <span className="text-gray-500 text-xs pb-1.5 hidden md:inline-block ml-1">
                        본 서비스는 PC에서 정상적으로 보입니다.
                    </span>
                </div>
                <div className="flex gap-4 text-sm font-medium">
                    <a href="/" className="text-gray-400 hover:text-white transition-colors">Home</a>
                    <a href="/my" className="text-gray-400 hover:text-white transition-colors">My Asset</a>
                    <span className="text-white font-bold px-3 py-1 bg-white/10 rounded-full border border-white/20 shadow-[0_0_15px_rgba(255,255,255,0.05)]">Discover</span>
                </div>
            </header>

            <main className="max-w-7xl mx-auto flex flex-col lg:flex-row gap-8">

                {/* Left Panel: Selected ETF Radar & Detailed Score */}
                <div className="w-full lg:w-1/3 flex flex-col gap-6">
                    {selectedEtf ? (
                        <div className="bg-[#121217]/80 border border-white/10 rounded-3xl p-6 backdrop-blur-xl shadow-2xl sticky top-8 animate-in fade-in slide-in-from-left-4 duration-500">
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <h2 className="text-xl font-bold text-white mb-1 leading-tight pr-4">{selectedEtf.name}</h2>
                                    <p className="text-gray-400 text-sm font-mono">{selectedEtf.code} • {selectedEtf.issuer}</p>
                                </div>
                                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-bold whitespace-nowrap shadow-lg ${getRatingColor(selectedEtf.scores.rating)}`}>
                                    {getRatingIcon(selectedEtf.scores.rating)}
                                    {selectedEtf.scores.rating} 등급
                                </div>
                            </div>

                            {/* Radar Chart Area */}
                            <div className="bg-black/40 rounded-2xl border border-white/5 p-4 mb-6 flex flex-col items-center relative overflow-hidden group">
                                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-fuchsia-500/10 opacity-50 group-hover:opacity-100 transition-opacity"></div>
                                <h3 className="text-sm font-semibold text-gray-300 w-full text-center mb-2 z-10 flex items-center justify-center gap-2">
                                    <Activity className="w-4 h-4 text-indigo-400" />
                                    다면 평가 프로파일 (X-Ray)
                                </h3>
                                <div className="w-full h-[260px] relative z-10">
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

                                <div className="w-full mt-4 flex justify-center">
                                    <div className="flex flex-col items-center">
                                        <span className="text-xs text-gray-500 mb-1">통합 평가 점수</span>
                                        <span className="text-4xl font-black bg-clip-text text-transparent bg-gradient-to-b from-white to-gray-500 drop-shadow-md">
                                            {Math.round(selectedEtf.scores.total)}
                                            <span className="text-lg text-gray-600 ml-1">/ 100</span>
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Score Breakdown Bars */}
                            <div className="space-y-4">
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

                            {/* Bento Grid: 실질 비용 명세 & 추적 안정성 지표 */}
                            <div className="mt-6 pt-6 border-t border-white/10 space-y-5">
                                {/* 실질 비용 명세 Bento Card */}
                                <div className="bg-black/35 border border-white/5 rounded-2xl p-4 relative overflow-hidden group">
                                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-cyan-500/5 opacity-50 group-hover:opacity-100 transition-opacity"></div>
                                    <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                        <Percent className="w-3.5 h-3.5" />
                                        실질 비용 명세 (총보수 + 거래비용)
                                    </h4>
                                    <div className="space-y-3 relative z-10">
                                        <div className="flex justify-between text-xs">
                                            <span className="text-gray-400">기본 운용보수</span>
                                            <span className="text-gray-200 font-mono">{(selectedEtf.base_fee || 0).toFixed(4)}%</span>
                                        </div>
                                        <div className="flex justify-between text-xs">
                                            <span className="text-gray-400">기타 비용 (TER 차액)</span>
                                            <span className="text-gray-200 font-mono">{(selectedEtf.other_fee || 0).toFixed(4)}%</span>
                                        </div>
                                        <div className="flex justify-between text-xs">
                                            <span className="text-gray-400">매매중개수수료율 (거래비용)</span>
                                            <span className="text-gray-200 font-mono">{(selectedEtf.transaction_fee || 0).toFixed(4)}%</span>
                                        </div>
                                        
                                        {/* Cumulative Visual Fee Progress Bar */}
                                        <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden flex">
                                            <div className="h-full bg-blue-500" style={{ width: `${Math.max(1, (((selectedEtf.base_fee || 0) / (selectedEtf.real_total_cost || 0.1)) * 100))}%` }}></div>
                                            <div className="h-full bg-cyan-500" style={{ width: `${Math.max(1, (((selectedEtf.other_fee || 0) / (selectedEtf.real_total_cost || 0.1)) * 100))}%` }}></div>
                                            <div className="h-full bg-emerald-500" style={{ width: `${Math.max(1, (((selectedEtf.transaction_fee || 0) / (selectedEtf.real_total_cost || 0.1)) * 100))}%` }}></div>
                                        </div>

                                        <div className="pt-2 flex justify-between items-center border-t border-white/5">
                                            <span className="text-xs font-bold text-gray-300">실질 총비용 (TER + 거래)</span>
                                            <span className="text-sm font-black text-emerald-400 font-mono">{(selectedEtf.real_total_cost || 0).toFixed(4)}%</span>
                                        </div>
                                    </div>
                                </div>

                                {/* 추적 안정성 지표 Bento Card */}
                                <div className="bg-black/35 border border-white/5 rounded-2xl p-4 relative overflow-hidden group">
                                    <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-rose-500/5 opacity-50 group-hover:opacity-100 transition-opacity"></div>
                                    <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                        <Activity className="w-3.5 h-3.5" />
                                        추적 안정성 및 괴리 진단
                                    </h4>
                                    <div className="grid grid-cols-2 gap-4 relative z-10">
                                        <div className="bg-white/[0.02] border border-white/5 rounded-xl p-2.5 flex flex-col">
                                            <span className="text-[10px] text-gray-500 uppercase font-bold">추적 오차율 (TE)</span>
                                            <span className="text-base font-black text-amber-300 font-mono mt-1">{(selectedEtf.tracking_error || 0).toFixed(3)}%</span>
                                            <span className="text-[9px] text-gray-500 mt-1">
                                                {selectedEtf.tracking_error < 0.2 ? '🟢 우수 (안정)' : selectedEtf.tracking_error < 0.6 ? '🟡 보통' : '🔴 주의 (오차큼)'}
                                            </span>
                                        </div>
                                        <div className="bg-white/[0.02] border border-white/5 rounded-xl p-2.5 flex flex-col">
                                            <span className="text-[10px] text-gray-500 uppercase font-bold">평균 괴리율</span>
                                            <span className="text-base font-black text-rose-300 font-mono mt-1">{(selectedEtf.disparity_rate || 0).toFixed(3)}%</span>
                                            <span className="text-[9px] text-gray-500 mt-1">
                                                {selectedEtf.disparity_rate < 0.1 ? '🟢 우수 (안정)' : selectedEtf.disparity_rate < 0.3 ? '🟡 보통' : '🔴 주의 (괴리큼)'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-[#121217]/50 border border-white/5 rounded-3xl p-6 h-[600px] flex items-center justify-center backdrop-blur-md">
                            <span className="text-gray-500 flex flex-col items-center gap-4">
                                {isLoading ? (
                                    <>
                                        <div className="w-8 h-8 rounded-full border-4 border-indigo-500/30 border-t-indigo-500 animate-spin"></div>
                                        평가 엔진 데이터 로딩 중...
                                    </>
                                ) : (
                                    "우측 목록에서 분석할 ETF를 선택하세요"
                                )}
                            </span>
                        </div>
                    )}
                </div>

                {/* Right Panel: ETF Leaderboard List */}
                <div className="w-full lg:w-2/3 flex flex-col gap-6">

                    {/* Macro Rotation UI Component Here */}
                    <MacroRotation />

                    {/* Filter / Search Actions */}
                    <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white/[0.02] p-2 rounded-2xl border border-white/5 backdrop-blur-sm">
                        <div className="relative w-full sm:max-w-xs">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="ETF 종목명 또는 코드 검색..."
                                className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all text-white placeholder-gray-600 block"
                            />
                        </div>
                        <div className="flex gap-2 w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0 scrollbar-hide">
                            <button
                                onClick={() => setSortCriteria('total')}
                                className={`px-4 py-2 border rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                                    sortCriteria === 'total'
                                        ? 'bg-white/10 hover:bg-white/15 border-white/10 text-white'
                                        : 'bg-black/40 hover:bg-white/5 border-white/5 text-gray-400'
                                }`}
                            >
                                종합점수 순
                            </button>
                            <button
                                onClick={() => setSortCriteria('liquidity')}
                                className={`px-4 py-2 border rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                                    sortCriteria === 'liquidity'
                                        ? 'bg-white/10 hover:bg-white/15 border-white/10 text-white'
                                        : 'bg-black/40 hover:bg-white/5 border-white/5 text-gray-400'
                                }`}
                            >
                                유동성 우수
                            </button>
                            <button
                                onClick={() => setSortCriteria('cost')}
                                className={`px-4 py-2 border rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                                    sortCriteria === 'cost'
                                        ? 'bg-white/10 hover:bg-white/15 border-white/10 text-white'
                                        : 'bg-black/40 hover:bg-white/5 border-white/5 text-gray-400'
                                }`}
                            >
                                저비용 패시브
                            </button>
                        </div>
                    </div>

                    {/* ListView */}
                    <div className="bg-[#121217]/60 border border-white/10 rounded-3xl overflow-hidden backdrop-blur-md shadow-xl flex-1 flex flex-col">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse whitespace-nowrap min-w-[800px]">
                                <thead>
                                    <tr className="bg-black/30 border-b border-white/10 text-xs font-medium text-gray-400 uppercase tracking-wider">
                                        <th className="py-4 px-6 w-12 text-center">Rank</th>
                                        <th className="py-4 px-4 w-[250px]">ETF 종목명 (코드)</th>
                                        <th className="py-4 px-4 text-center">종합 등급</th>
                                        <th className="py-4 px-4 text-center">실질 총비용 (TER+거래)</th>
                                        <th className="py-4 px-4 text-center">추적/괴리 오차</th>
                                        <th className="py-4 px-4 text-center">총점</th>
                                        <th className="py-4 px-4 text-right">순자산총액(AUM)</th>
                                        <th className="py-4 px-6 text-right">운용사</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5 text-sm">
                                    {evaluations
                                        .filter((etf) => {
                                            const q = searchTerm.toLowerCase().trim();
                                            if (!q) return true;
                                            return etf.name.toLowerCase().includes(q) || etf.code.includes(q);
                                        })
                                        .sort((a, b) => {
                                            if (sortCriteria === 'total') {
                                                return (b.scores.total || 0) - (a.scores.total || 0);
                                            } else if (sortCriteria === 'liquidity') {
                                                return (b.scores.liquidity || 0) - (a.scores.liquidity || 0);
                                            } else if (sortCriteria === 'cost') {
                                                return (a.real_total_cost || 0) - (b.real_total_cost || 0);
                                            }
                                            return 0;
                                        })
                                        .map((etf, idx) => {
                                            const isSelected = selectedEtf?.code === etf.code;
                                            return (
                                                <tr
                                                    key={etf.code}
                                                    onClick={() => setSelectedEtf(etf)}
                                                    className={`cursor-pointer transition-colors ${isSelected ? 'bg-indigo-500/10' : 'hover:bg-white/[0.03]'}`}
                                                >
                                                    <td className="py-4 px-6 text-center">
                                                        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${idx < 3 ? 'bg-amber-400/20 text-amber-400' : 'text-gray-500'}`}>
                                                            {idx + 1}
                                                        </span>
                                                    </td>
                                                    <td className="py-4 px-4">
                                                        <div className="flex flex-col">
                                                            <span className={`font-bold truncate max-w-[230px] ${isSelected ? 'text-indigo-300' : 'text-gray-200'}`}>{etf.name}</span>
                                                            <span className="text-xs text-gray-500 font-mono mt-0.5">{etf.code}</span>
                                                        </div>
                                                    </td>
                                                    <td className="py-4 px-4 text-center">
                                                        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-bold ${getRatingColor(etf.scores.rating)}`}>
                                                            {getRatingIcon(etf.scores.rating)}
                                                            {etf.scores.rating}
                                                        </div>
                                                    </td>
                                                    <td className="py-4 px-4 text-center">
                                                        <div className="flex flex-col">
                                                            <span className="font-mono font-bold text-emerald-400">{(etf.real_total_cost || 0).toFixed(3)}%</span>
                                                            <span className="text-[10px] text-gray-500 font-mono">
                                                                (TER {(etf.tot_fee || 0).toFixed(2)} + 거래 {(etf.transaction_fee || 0).toFixed(2)})
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="py-4 px-4 text-center text-gray-300 font-mono text-xs">
                                                        {(etf.tracking_error || 0).toFixed(2)}% / {(etf.disparity_rate || 0).toFixed(2)}%
                                                    </td>
                                                    <td className="py-4 px-4 text-center">
                                                        <span className="font-mono font-bold text-gray-300">{Math.round(etf.scores.total)}</span>
                                                    </td>
                                                    <td className="py-4 px-4 text-right text-gray-400">
                                                        {etf.aum || '-'}
                                                    </td>
                                                    <td className="py-4 px-6 text-right text-xs text-gray-500">
                                                        {etf.issuer || '-'}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    {evaluations.length === 0 && !isLoading && (
                                        <tr>
                                            <td colSpan={8} className="py-12 text-center text-gray-500">
                                                평가된 ETF 데이터가 없습니다. DB Sync를 확인하세요.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Add Tax Simulator Here */}
                    <TaxSimulator />

                    {/* Add FX Finder Here */}
                    <FxFinder />
                </div>
            </main>
        </div>
    );
}
