import React, { useState, useEffect } from 'react';
import { Loader2, Sparkles, TrendingUp, AlertTriangle, CheckCircle2, ArrowRight, Play, Check, RotateCcw, Activity } from 'lucide-react';
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

type VirtualOrder = {
    account_no: string;
    side: "BUY" | "SELL";
    code: string;
    name: string;
    qty: number;
    price: number;
    amount: number;
    reason?: string;
};

export default function RebalanceProposal() {
    const [isLoading, setIsLoading] = useState(false);
    const [data, setData] = useState<ProposalData | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Simulator State
    const [orders, setOrders] = useState<VirtualOrder[] | null>(null);
    const [isGeneratingOrders, setIsGeneratingOrders] = useState(false);
    const [isExecutingSimulation, setIsExecutingSimulation] = useState(false);
    const [simSuccess, setSimSuccess] = useState(false);
    const [routingError, setRoutingError] = useState<string | null>(null);
    const [hasSimulatedActive, setHasSimulatedActive] = useState(false);

    // Formatting helper
    const formatNumber = (val: number) => new Intl.NumberFormat('ko-KR').format(Math.floor(val));

    // Check if simulation is already active on load
    useEffect(() => {
        const checkSimStatus = async () => {
            try {
                const res = await fetch(`${API_BASE}/api/v1/order/simulated-portfolio`);
                if (res.ok) {
                    const json = await res.json();
                    setHasSimulatedActive(json.has_simulated);
                }
            } catch (err) {
                console.warn("Failed to check simulation status:", err);
            }
        };
        checkSimStatus();
    }, []);

    const handleAnalyze = async () => {
        setIsLoading(true);
        setError(null);
        setOrders(null);
        setRoutingError(null);
        setSimSuccess(false);
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

    const handleGenerateSimulationOrders = async () => {
        if (!data) return;
        setIsGeneratingOrders(true);
        setRoutingError(null);
        try {
            const res = await fetch(`${API_BASE}/api/v1/order/route`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ recommendations: data.recommendations })
            });
            const result = await res.json();
            if (!res.ok) {
                throw new Error(result.detail || "주문 설계 실패");
            }
            setOrders(result.orders || []);
        } catch (e: any) {
            setRoutingError(e.message || "가상 주문 설계 도중 오류가 발생했습니다.");
        } finally {
            setIsGeneratingOrders(false);
        }
    };

    const handleExecuteSimulation = async () => {
        if (!orders || orders.length === 0) return;
        setIsExecutingSimulation(true);
        setRoutingError(null);
        try {
            const res = await fetch(`${API_BASE}/api/v1/order/execute-virtual`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ orders })
            });
            if (!res.ok) {
                const errJson = await res.json();
                throw new Error(errJson.detail || "가상 주문 체결 실패");
            }
            
            setSimSuccess(true);
            setHasSimulatedActive(true);

            // Dispatch global custom event to automatically refresh & enable simulation mode on the parent view
            const event = new CustomEvent('refresh-portfolio', { detail: { enableSimulation: true } });
            window.dispatchEvent(event);

        } catch (e: any) {
            setRoutingError(e.message || "가상 주문 체결 도중 오류가 발생했습니다.");
        } finally {
            setIsExecutingSimulation(false);
        }
    };

    const handleResetSimulation = async () => {
        try {
            await fetch(`${API_BASE}/api/v1/order/simulated-portfolio`, { method: "DELETE" });
            setSimSuccess(false);
            setOrders(null);
            setHasSimulatedActive(false);

            // Refresh parent view
            const event = new CustomEvent('refresh-portfolio', { detail: { enableSimulation: false } });
            window.dispatchEvent(event);
        } catch (e) {
            console.error("Failed to reset simulation:", e);
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
                            <div className="text-left">
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
                                <div key={idx} className="bg-white/[0.03] border border-white/10 rounded-2xl p-5 hover:bg-white/[0.05] transition-colors flex flex-col h-full text-left">
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

                    {/* Interactive Order Routing Simulator Bento Card */}
                    <div className="bg-white/[0.02] border border-white/10 rounded-3xl p-6 backdrop-blur-md relative overflow-hidden text-left">
                        {/* Background subtle glowing effect */}
                        <div className="absolute -top-20 -right-20 w-60 h-60 bg-purple-500/10 rounded-full blur-3xl pointer-events-none"></div>
                        <div className="absolute -bottom-20 -left-20 w-60 h-60 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>

                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 relative z-10">
                            <div>
                                <h3 className="text-xl font-bold flex items-center gap-2">
                                    <Activity className="w-5 h-5 text-purple-400" />
                                    다계좌 리밸런싱 오더 라우팅 시뮬레이터
                                </h3>
                                <p className="text-xs text-gray-400 mt-1">AI의 제안에 맞추어 여러 보유 계좌별 매도/매수 모의 주문을 최적으로 자동 설계하고 가상 체결을 돌려볼 수 있습니다.</p>
                            </div>
                            
                            <div className="flex gap-2">
                                {hasSimulatedActive && (
                                    <button
                                        onClick={handleResetSimulation}
                                        className="flex items-center gap-1.5 px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-xl text-xs font-bold text-red-300 transition-all"
                                    >
                                        <RotateCcw className="w-3.5 h-3.5" />
                                        시뮬레이션 초기화
                                    </button>
                                )}
                                {!orders && (
                                    <button
                                        onClick={handleGenerateSimulationOrders}
                                        disabled={isGeneratingOrders}
                                        className="flex items-center gap-1.5 px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50 hover:scale-102"
                                    >
                                        {isGeneratingOrders ? (
                                            <>
                                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                모의 거래 설계 중...
                                            </>
                                        ) : (
                                            <>
                                                <Play className="w-3.5 h-3.5 fill-current" />
                                                모의 거래 주문 설계 생성
                                            </>
                                        )}
                                    </button>
                                )}
                            </div>
                        </div>

                        {routingError && (
                            <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 text-sm text-red-300 mb-6 flex items-start gap-2">
                                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                                <span>{routingError}</span>
                            </div>
                        )}

                        {orders && (
                            <div className="flex flex-col gap-6 relative z-10 animate-in fade-in duration-300">
                                <div className="border border-white/10 rounded-2xl overflow-hidden bg-black/20">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse whitespace-nowrap">
                                            <thead>
                                                <tr className="bg-white/[0.03] text-xs font-semibold text-gray-400 border-b border-white/10">
                                                    <th className="p-3">계좌번호</th>
                                                    <th className="p-3 text-center">구분</th>
                                                    <th className="p-3">종목코드 / ETF명</th>
                                                    <th className="p-3 text-right">수량</th>
                                                    <th className="p-3 text-right">주당 단가</th>
                                                    <th className="p-3 text-right">총 주문금액</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-white/5 text-sm">
                                                {orders.map((ord, idx) => (
                                                    <tr key={idx} className="hover:bg-white/[0.01] transition-colors">
                                                        <td className="p-3 font-mono text-xs text-gray-300">{ord.account_no}</td>
                                                        <td className="p-3 text-center">
                                                            <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                                                                ord.side === "BUY" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                                                            }`}>
                                                                {ord.side === "BUY" ? "매수" : "매도"}
                                                            </span>
                                                        </td>
                                                        <td className="p-3">
                                                            <div className="font-bold text-white text-xs">{ord.name}</div>
                                                            <div className="text-[10px] text-gray-500 font-mono">{ord.code}</div>
                                                        </td>
                                                        <td className="p-3 text-right font-semibold text-xs">{ord.qty}주</td>
                                                        <td className="p-3 text-right text-xs text-gray-300">{formatNumber(ord.price)}원</td>
                                                        <td className="p-3 text-right font-bold text-xs text-white">{formatNumber(ord.amount)}원</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-purple-500/5 border border-purple-500/20 rounded-2xl p-4">
                                    <div className="text-xs text-gray-400">
                                        💡 <span className="font-bold text-purple-200">일괄 체결 시뮬레이션:</span> 매도 주문 체결로 예수금이 우선 확보된 후, 지정된 대체 ETF 매매 자금으로 실시간 투입됩니다.
                                    </div>

                                    {!simSuccess ? (
                                        <button
                                            onClick={handleExecuteSimulation}
                                            disabled={isExecutingSimulation}
                                            className="flex items-center gap-1.5 px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition-all hover:scale-105 shrink-0 shadow-lg shadow-purple-500/20"
                                        >
                                            {isExecutingSimulation ? (
                                                <>
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                    가상 주문 일괄 체결 중...
                                                </>
                                            ) : (
                                                <>
                                                    <Check className="w-4 h-4" />
                                                    가상 주문 일괄 체결 실행하기
                                                </>
                                            )}
                                        </button>
                                    ) : (
                                        <div className="flex items-center gap-2 text-emerald-400 text-sm font-bold bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-2 animate-bounce">
                                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                            체결 시뮬레이션 성공! (실시간 반영됨)
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
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
