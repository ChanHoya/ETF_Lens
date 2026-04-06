import React, { useState } from 'react';
import { Loader2, Sparkles, TrendingUp, AlertTriangle, CheckCircle2, ArrowRight } from 'lucide-react';
import { API_BASE } from '@/lib/apiConfig';

type Recommendation = {
    code: string;
    name: string;
    action: "KEEP" | "REPLACE" | "ADD";
    reasoning: string;
    alternative_etf: string | null;
};

type ProposalData = {
    overall_summary: string;
    recommendations: Recommendation[];
};

export default function RebalanceProposal() {
    const [isLoading, setIsLoading] = useState(false);
    const [data, setData] = useState<ProposalData | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleAnalyze = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const res = await fetch(`${API_BASE}/api/v1/analyze/rebalance-proposal`, {
                method: "POST",
                headers: { "Content-Type": "application/json" }
            });
            const result = await res.json();
            if (!res.ok) {
                throw new Error(result.msg || result.detail || "분석 실패");
            }
            if (result.status === "error") {
                throw new Error(result.msg || "분석 오류 발생");
            }
            if (result.data) {
                setData(result.data);
            }
        } catch (e: any) {
            setError(e.message || "알 수 없는 오류가 발생했습니다.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <section className="flex flex-col gap-4 mt-4">
            <div className="flex justify-between items-end">
                <h2 className="text-2xl font-bold flex items-center gap-3">
                    <span className="w-1.5 h-6 bg-purple-500 rounded-full"></span>
                    AI 포트폴리오 리밸런싱 제안
                </h2>
            </div>
            
            {!data && !isLoading && !error && (
                <div className="bg-gradient-to-br from-indigo-500/10 to-purple-500/5 border border-indigo-500/20 rounded-2xl p-8 flex flex-col items-center justify-center text-center">
                    <div className="w-16 h-16 bg-indigo-500/20 rounded-full flex items-center justify-center mb-4">
                        <Sparkles className="w-8 h-8 text-indigo-400" />
                    </div>
                    <h3 className="text-lg font-bold text-white mb-2">Gemini Deep Think 분석</h3>
                    <p className="text-gray-400 text-sm max-w-md mb-6">
                        보유하신 ETF의 테마별 1개월, 3개월 수익률 및 하방 방어율 등을 종합 분석하여, 
                        유지해야 할 종목과 교체하면 좋을 대안 종목을 AI가 추천해 드립니다.
                    </p>
                    <button 
                        onClick={handleAnalyze}
                        className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold shadow-lg shadow-indigo-500/20 transition-all duration-300 hover:scale-105"
                    >
                        <Sparkles className="w-4 h-4" />
                        분석 시작하기
                    </button>
                    <p className="text-xs text-indigo-300/50 mt-4">* 분석에 최대 10~20초 가량 소요될 수 있습니다. 탭을 이동해도 분석은 진행됩니다.</p>
                </div>
            )}

            {isLoading && (
                <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-12 flex flex-col items-center justify-center text-center min-h-[300px]">
                    <div className="relative mb-6">
                        <div className="absolute inset-0 bg-purple-500/20 blur-xl rounded-full"></div>
                        <Loader2 className="w-12 h-12 text-purple-400 animate-spin relative" />
                    </div>
                    <h3 className="text-lg font-bold text-white mb-2 animate-pulse">포트폴리오 심층 분석 중...</h3>
                    <p className="text-gray-400 text-sm">
                        동종 그룹 ETF 간의 성과를 비교하고 최적의 교체 대안을 탐색하고 있습니다.
                    </p>
                </div>
            )}

            {error && !isLoading && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6 text-center">
                    <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-3" />
                    <p className="text-red-300 mb-4">{error}</p>
                    <button 
                        onClick={handleAnalyze}
                        className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-200 rounded-lg text-sm transition-colors"
                    >
                        다시 시도
                    </button>
                </div>
            )}

            {data && !isLoading && (
                <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {/* Overall Summary */}
                    <div className="bg-gradient-to-r from-purple-500/10 to-indigo-500/5 border border-purple-500/20 rounded-2xl p-6">
                        <div className="flex items-start gap-4">
                            <div className="p-3 bg-purple-500/20 rounded-xl shrink-0">
                                <TrendingUp className="w-6 h-6 text-purple-300" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-white mb-2">분석 총평</h3>
                                <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">
                                    {data.overall_summary}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Recommendations Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {data.recommendations.map((rec, idx) => {
                            const isReplace = rec.action === "REPLACE";
                            return (
                                <div key={idx} className="bg-white/[0.03] border border-white/10 rounded-2xl p-5 hover:bg-white/[0.05] transition-colors flex flex-col h-full">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <h4 className="font-bold text-white text-base">{rec.name}</h4>
                                            <p className="text-xs text-gray-500 font-mono">{rec.code}</p>
                                        </div>
                                        <div className={`px-3 py-1 rounded-full text-xs font-bold border ${matchesBadge(rec.action)}`}>
                                            {rec.action}
                                        </div>
                                    </div>
                                    
                                    <div className="flex-1 bg-black/20 rounded-xl p-3 mb-4 border border-white/5 relative">
                                        {/* Speech bubble pointer */}
                                        <div className="absolute -top-2 left-6 border-8 border-transparent border-b-black/20 border-t-0"></div>
                                        <p className="text-sm text-gray-300 leading-relaxed font-light">
                                            {rec.reasoning}
                                        </p>
                                    </div>

                                    {isReplace && rec.alternative_etf && (
                                        <div className="mt-auto flex items-center gap-3 bg-rose-500/10 border border-rose-500/20 rounded-xl p-3">
                                            <div className="bg-rose-500/20 p-1.5 rounded-lg shrink-0">
                                                <ArrowRight className="w-4 h-4 text-rose-400" />
                                            </div>
                                            <div>
                                                <p className="text-[10px] text-rose-400/80 font-medium mb-0.5">교체 추천 대안</p>
                                                <p className="text-sm text-rose-200 font-bold">{rec.alternative_etf}</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </section>
    );
}

function matchesBadge(action: string) {
    if (action === "KEEP") return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
    if (action === "REPLACE") return "bg-rose-500/10 text-rose-400 border-rose-500/20";
    if (action === "ADD") return "bg-blue-500/10 text-blue-400 border-blue-500/20";
    return "bg-gray-500/10 text-gray-400 border-gray-500/20";
}
