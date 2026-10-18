'use client';

import React, { useEffect, useState } from 'react';
import { 
    Pill, Sparkles, TrendingUp, ShieldCheck, ArrowRight, RefreshCw, 
    AlertCircle, CheckCircle2, Zap, BarChart2, Info
} from 'lucide-react';
import { 
    ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, 
    CartesianGrid, ReferenceDot, ReferenceLine 
} from 'recharts';
import { API_BASE } from '@/lib/apiConfig';
import { STANDARD_TOOLTIP_STYLE } from '@/lib/chartTheme';

interface VitaminEtf {
    ticker: string;
    name: string;
    category: string;
    missing_nutrient: string;
    reason: string;
    recommended_weight: number;
    current_weight: number;
    expected_return: number;
    volatility: number;
    correlation_with_portfolio: number;
}

interface FrontierPoint {
    volatility: number;
    return_rate: number;
    sharpe: number;
    label: string;
}

interface VitaminData {
    status: string;
    current_metrics: {
        expected_return: number;
        volatility: number;
        sharpe_ratio: number;
        mdd_estimate: number;
    };
    optimized_metrics: {
        expected_return: number;
        volatility: number;
        sharpe_ratio: number;
        mdd_estimate: number;
    };
    vitamin_recommendations: VitaminEtf[];
    efficient_frontier_curve: FrontierPoint[];
    ai_commentary: string;
}

export default function PortfolioVitaminOptimizer() {
    const [data, setData] = useState<VitaminData | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [applied, setApplied] = useState<boolean>(false);

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`${API_BASE}/api/v1/rebalance/portfolio-vitamin`);
            if (!res.ok) throw new Error('비타민 추천 데이터를 불러오지 못했습니다.');
            const json = await res.json();
            setData(json);
        } catch (err: any) {
            setError(err.message || '네트워크 오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    if (loading && !data) {
        return (
            <div className="bg-slate-900/60 border border-slate-700/60 rounded-2xl p-6 text-center animate-pulse">
                <Pill className="w-8 h-8 text-amber-400 mx-auto mb-2 animate-bounce" />
                <p className="text-sm text-gray-400">포트폴리오 결핍 영양소 및 효율적 투자선(Efficient Frontier) 분석 중...</p>
            </div>
        );
    }

    if (error && !data) {
        return (
            <div className="bg-slate-900/60 border border-red-500/30 rounded-2xl p-6 text-center">
                <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
                <p className="text-sm text-red-400">{error}</p>
                <button 
                    onClick={fetchData}
                    className="mt-3 px-3 py-1.5 bg-slate-800 text-xs text-gray-200 rounded-lg hover:bg-slate-700 inline-flex items-center gap-1.5"
                >
                    <RefreshCw className="w-3.5 h-3.5" /> 다시 시도
                </button>
            </div>
        );
    }

    if (!data) return null;

    const curr = data.current_metrics;
    const opt = data.optimized_metrics;

    return (
        <section className="bg-gradient-to-br from-slate-900/90 via-amber-950/20 to-slate-900/90 border border-amber-500/30 rounded-2xl p-5 shadow-2xl relative overflow-hidden backdrop-blur-md">
            {/* 상단 타이틀 */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-white/10">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
                        <Pill className="w-5 h-5 animate-pulse" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-lg font-bold text-white flex items-center gap-1.5">
                                '포트폴리오 비타민' AI 종목 추천 & 효율적 투자선 최적화
                                <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-full font-semibold">
                                    Sprint 30 LIVE
                                </span>
                            </h3>
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">
                            현재 자산군 간 상관관계 분석을 통해 분산 효과를 극대화하는 3대 결핍 영양소 보충 솔루션
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={fetchData}
                        disabled={loading}
                        className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 disabled:opacity-50 transition-colors"
                        title="새로고침"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* AI 진단 배너 */}
            <div className="my-4 p-3.5 rounded-xl bg-amber-950/40 border border-amber-500/30 flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                    <div className="font-bold text-amber-200">
                        포트폴리오 영양 상태 진단: 주식 편중 및 인플레 헤지 영양소 결핍
                    </div>
                    <div className="text-gray-300 leading-relaxed">
                        {data.ai_commentary}
                    </div>
                </div>
            </div>

            {/* 핵심 메트릭 비교 카드 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                <div className="p-3 rounded-xl bg-black/25 border border-white/5">
                    <span className="text-[11px] text-gray-400 block">기대수익률 (연)</span>
                    <div className="flex items-baseline gap-1 mt-1">
                        <span className="text-gray-400 text-sm line-through">{curr.expected_return}%</span>
                        <ArrowRight className="w-3 h-3 text-amber-400" />
                        <span className="text-lg font-extrabold text-amber-300">+{opt.expected_return}%</span>
                    </div>
                    <span className="text-[10px] text-emerald-400">+{Math.round((opt.expected_return - curr.expected_return) * 10) / 10}%p 향상</span>
                </div>

                <div className="p-3 rounded-xl bg-black/25 border border-white/5">
                    <span className="text-[11px] text-gray-400 block">포트폴리오 변동성 (σ)</span>
                    <div className="flex items-baseline gap-1 mt-1">
                        <span className="text-gray-400 text-sm line-through">{curr.volatility}%</span>
                        <ArrowRight className="w-3 h-3 text-emerald-400" />
                        <span className="text-lg font-extrabold text-emerald-300">{opt.volatility}%</span>
                    </div>
                    <span className="text-[10px] text-emerald-400">-{Math.round((curr.volatility - opt.volatility) * 10) / 10}%p 위험 축소</span>
                </div>

                <div className="p-3 rounded-xl bg-black/25 border border-white/5">
                    <span className="text-[11px] text-gray-400 block">샤프 지수 (Sharpe Ratio)</span>
                    <div className="flex items-baseline gap-1 mt-1">
                        <span className="text-gray-400 text-sm line-through">{curr.sharpe_ratio}</span>
                        <ArrowRight className="w-3 h-3 text-indigo-400" />
                        <span className="text-lg font-extrabold text-indigo-300">{opt.sharpe_ratio}</span>
                    </div>
                    <span className="text-[10px] text-indigo-300 font-semibold">위험대비 성과 대폭 개선</span>
                </div>

                <div className="p-3 rounded-xl bg-black/25 border border-white/5">
                    <span className="text-[11px] text-gray-400 block">추정 최대낙폭 (MDD)</span>
                    <div className="flex items-baseline gap-1 mt-1">
                        <span className="text-gray-400 text-sm line-through">{curr.mdd_estimate}%</span>
                        <ArrowRight className="w-3 h-3 text-teal-400" />
                        <span className="text-lg font-extrabold text-teal-300">{opt.mdd_estimate}%</span>
                    </div>
                    <span className="text-[10px] text-teal-400">하방 안전마진 확보</span>
                </div>
            </div>

            {/* 3대 비타민 추천 종목 리스트 */}
            <div className="space-y-3 mb-5">
                <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5 text-amber-400" />
                        처방된 3대 결핍 비타민 ETF
                    </h4>
                    <span className="text-[11px] text-gray-400">총 25.0% 편입 권장</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {data.vitamin_recommendations.map((etf) => (
                        <div 
                            key={etf.ticker}
                            className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-700/60 hover:border-amber-500/40 transition-all flex flex-col justify-between"
                        >
                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                        {etf.category}
                                    </span>
                                    <span className="text-xs font-extrabold text-white">
                                        권장 {etf.recommended_weight}%
                                    </span>
                                </div>
                                <div className="font-bold text-sm text-gray-100">{etf.name}</div>
                                <div className="text-[11px] text-gray-500 mb-2">{etf.ticker}</div>

                                <div className="p-2 rounded-lg bg-black/30 border border-white/5 text-[11px] space-y-1 mb-2">
                                    <div className="text-amber-300 font-semibold flex items-center gap-1">
                                        <Pill className="w-3 h-3" /> {etf.missing_nutrient}
                                    </div>
                                    <p className="text-gray-400 text-[10px] leading-tight">
                                        {etf.reason}
                                    </p>
                                </div>
                            </div>

                            <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px] text-gray-400">
                                <span>상관계수: <b className={etf.correlation_with_portfolio < 0 ? 'text-emerald-400' : 'text-gray-200'}>{etf.correlation_with_portfolio > 0 ? `+${etf.correlation_with_portfolio}` : etf.correlation_with_portfolio}</b></span>
                                <span>기대수익: <b className="text-white">{etf.expected_return}%</b></span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* 효율적 투자선 미니 시뮬레이션 차트 */}
            <div className="p-4 rounded-xl bg-black/30 border border-white/5">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
                        <BarChart2 className="w-3.5 h-3.5 text-indigo-400" />
                        효율적 투자선 (Efficient Frontier) 궤적
                    </span>
                    <span className="text-[10px] text-gray-400">X축: 변동성(위험) · Y축: 기대수익률(성과)</span>
                </div>

                <div className="h-44 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={data.efficient_frontier_curve} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                            <XAxis 
                                dataKey="volatility" 
                                tick={{ fill: '#94a3b8', fontSize: 10 }}
                                unit="%"
                                domain={['dataMin - 1', 'dataMax + 1']}
                            />
                            <YAxis 
                                dataKey="return_rate" 
                                tick={{ fill: '#94a3b8', fontSize: 10 }}
                                unit="%"
                                domain={[4, 14]}
                            />
                            <Tooltip contentStyle={STANDARD_TOOLTIP_STYLE} />
                            <Line 
                                type="monotone" 
                                dataKey="return_rate" 
                                stroke="#f59e0b" 
                                strokeWidth={2.5} 
                                dot={{ fill: '#f59e0b', r: 4 }}
                                name="효율적 투자선" 
                            />
                            {/* 최적 비타민 지점 강조 */}
                            <ReferenceDot x={opt.volatility} y={opt.expected_return} r={6} fill="#10b981" stroke="#ffffff" strokeWidth={2} />
                            {/* 현재 포트폴리오 지점 강조 */}
                            <ReferenceDot x={curr.volatility} y={curr.expected_return} r={6} fill="#ef4444" stroke="#ffffff" strokeWidth={2} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>

                <div className="flex items-center justify-center gap-6 mt-2 text-[11px]">
                    <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                        <span className="text-gray-300">현재 포트폴리오 (비효율적)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                        <span className="text-gray-300">비타민 편입 최적 포트폴리오 (추천)</span>
                    </div>
                </div>
            </div>

            {/* 하단 실행 액션 버튼 */}
            <div className="mt-4 pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs text-gray-400 flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-gray-500" />
                    리밸런싱 모의 주문 시 비타민 ETF가 목표 비중(25%)으로 자동 편입됩니다.
                </span>

                <button
                    onClick={() => setApplied(!applied)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                        applied 
                            ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30' 
                            : 'bg-gradient-to-r from-amber-600 to-indigo-600 hover:from-amber-500 hover:to-indigo-500 text-white shadow-lg shadow-amber-600/20 active:scale-95'
                    }`}
                >
                    {applied ? (
                        <>
                            <CheckCircle2 className="w-4 h-4" /> 비타민 편입 목표 설정 완료
                        </>
                    ) : (
                        <>
                            <Zap className="w-4 h-4" /> 비타민 3종 목표 비중 자동 적용
                        </>
                    )}
                </button>
            </div>
        </section>
    );
}
