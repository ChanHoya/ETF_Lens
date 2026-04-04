import React, { useState, useEffect } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend } from "recharts";
import { API_BASE } from "@/lib/apiConfig";
import { Loader2, Sparkles } from "lucide-react";

type HoldingProps = {
    code: string;
    name: string;
    eval_amount: number;
};

type BacktesterProps = {
    holdings: HoldingProps[];
};

export default function PortfolioBacktester({ holdings }: BacktesterProps) {
    const [period, setPeriod] = useState<"3M" | "6M" | "1Y" | "3Y" | "10Y">("1Y");
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const [insightText, setInsightText] = useState<string | null>(null);
    const [insightLoading, setInsightLoading] = useState(false);
    const [activeHighlight, setActiveHighlight] = useState<string | null>(null);

    const categorizeItem = (name: string, code: string = "") => {
        if (!name) return '한국';
        if (code && /^[A-Za-z]+(\.[A-Za-z]+)?$/.test(code)) return 'NASDAQ';
        const n = name.toUpperCase();
        if (n.includes('금현물') || n.includes('국제금') || n.includes('은현물') || n.includes('금선물') || n.includes('GOLD')) return '현물/현금 (금, 예수금 등)';
        if (n.includes('미국성장') || n.includes('미국우주항공') || n.includes('미국양자컴퓨팅') || n.includes('나스닥') || n.includes('NASDAQ')) return 'NASDAQ';
        if (n.includes('미국배당') || n.includes('S&P500') || n.includes('S&P 500')) return 'S&P 500';
        if (n.includes('미국')) return '미국';
        return '한국';
    };

    const LINE_CONFIG = [
        { key: "Portfolio", name: "내 포트폴리오 (전체)", color: "#a855f7", isBench: false, width: 3, pair: null },
        { key: "Portfolio_한국", name: "내 포트폴리오 (KOSPI)", color: "#3b82f6", isBench: false, width: 2, pair: "^KS11" },
        { key: "Portfolio_S&P 500", name: "내 포트폴리오 (S&P 500)", color: "#f43f5e", isBench: false, width: 2, pair: "^GSPC" },
        { key: "Portfolio_NASDAQ", name: "내 포트폴리오 (NASDAQ)", color: "#10b981", isBench: false, width: 2, pair: "^IXIC" },
        { key: "^KS11", name: "KOSPI 지수", color: "#3b82f6", isBench: true, width: 1, pair: "Portfolio_한국" },
        { key: "^GSPC", name: "S&P 500 지수", color: "#f43f5e", isBench: true, width: 1, pair: "Portfolio_S&P 500" },
        { key: "^IXIC", name: "NASDAQ 지수", color: "#10b981", isBench: true, width: 1, pair: "Portfolio_NASDAQ" },
    ];

    const getOpacity = (key: string, isBench: boolean, pair: string | null) => {
        if (!activeHighlight) return isBench ? 0.3 : 1.0;
        if (activeHighlight === key || activeHighlight === pair) return 1.0;
        return 0.1;
    };

    const fetchBacktest = async () => {
        setLoading(true);
        setError(null);
        try {
            const reqHoldings = holdings
                .filter(h => h.eval_amount > 0)
                .map(h => ({
                    code: h.code,
                    name: h.name,
                    amount: h.eval_amount,
                    category: categorizeItem(h.name, h.code)
                }));

            const res = await fetch(`${API_BASE}/api/v1/my/backtest/run`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ holdings: reqHoldings })
            });

            const result = await res.json();
            if (!res.ok) throw new Error(result.detail || "백테스트 실패");
            if (result.status === "error") throw new Error(result.message);
            
            setData(result);

            // Fetch AI Insight asynchronously
            fetchInsight(result.results, result.weights);

        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const fetchInsight = async (resultsData: any, weightsData: any) => {
        setInsightLoading(true);
        setInsightText(null);
        try {
            const res = await fetch(`${API_BASE}/api/v1/my/backtest/insight`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ results: resultsData, weights: weightsData })
            });
            const result = await res.json();
            if (result.status === "success") {
                setInsightText(result.insight_md);
            } else {
                setInsightText(result.insight_md || "단기 데이터 부족 혹은 분석 장애가 발생했습니다.");
            }
        } catch (err: any) {
            setInsightText("AI 분석 중 통신 오류가 발생했습니다.");
        } finally {
            setInsightLoading(false);
        }
    };

    useEffect(() => {
        if (holdings && holdings.length > 0) {
            fetchBacktest();
        }
    }, [holdings]);

    if (!holdings || holdings.length === 0) return null;

    const renderMetric = (label: string, val: number, isPct: boolean = true) => {
        const colorClass = val > 0 ? "text-rose-400" : val < 0 ? "text-blue-400" : "text-gray-400";
        const sign = val > 0 ? "+" : "";
        return (
            <div className="flex flex-col items-center p-3 bg-white/[0.02] rounded-xl border border-white/5">
                <span className="text-xs text-gray-500 mb-1">{label}</span>
                <span className={`font-bold ${colorClass}`}>
                    {sign}{val.toFixed(2)}{isPct ? "%" : ""}
                </span>
            </div>
        );
    };

    return (
        <section className="flex flex-col gap-4 mt-6">
            <h2 className="text-2xl font-bold flex items-center gap-2">
                <span className="w-1.5 h-6 bg-purple-500 rounded-full"></span>
                포트폴리오 백테스터 & 성과 분석
            </h2>
            <div className="bg-white/[0.02] border border-white/10 rounded-2xl backdrop-blur-md overflow-hidden p-6">
                
                {loading ? (
                    <div className="flex flex-col items-center justify-center p-10 h-[300px]">
                        <Loader2 className="w-10 h-10 text-purple-500 animate-spin mb-4" />
                        <p className="text-gray-400">최대 10년 치 주가 데이터를 수집 및 연산 중입니다...</p>
                    </div>
                ) : error ? (
                    <div className="p-8 text-center text-red-400 h-[300px] flex items-center justify-center">
                        {error}
                    </div>
                ) : data ? (
                    <div className="flex flex-col gap-6">
                        {/* Summary & Insights */}
                        {(insightLoading || insightText) && (
                            <div className="p-4 bg-indigo-500/10 border border-indigo-500/30 rounded-xl">
                                <h3 className="font-bold text-indigo-300 mb-2 flex items-center gap-2">
                                    <Sparkles className="w-4 h-4 text-indigo-400" />
                                    AI 하방 경직성 및 방어력 분석
                                </h3>
                                {insightLoading ? (
                                    <div className="flex items-center gap-3 text-indigo-200/70 text-sm py-2">
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        <span>Gemini가 금융 데이터를 기반으로 심층 분석 중입니다...</span>
                                    </div>
                                ) : (
                                    <div className="text-sm text-indigo-100/90 whitespace-pre-wrap leading-relaxed mt-2 p-1 font-medium">
                                        {insightText?.split('\n').map((line, idx) => {
                                            if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
                                                return <div key={idx} className="ml-4 mb-1 tracking-tight flex"><span className="mr-2 text-indigo-400">•</span><span dangerouslySetInnerHTML={{ __html: line.substring(2).replace(/\*\*(.*?)\*\*/g, '<strong class="text-white text-base">$1</strong>') }} /></div>;
                                            }
                                            if (/^\d+\./.test(line.trim())) {
                                                return <div key={idx} className="mb-2 tracking-tight mt-3 text-indigo-200 font-bold" dangerouslySetInnerHTML={{ __html: line.replace(/\*\*(.*?)\*\*/g, '<strong class="text-white text-base">$1</strong>') }} />;
                                            }
                                            return <div key={idx} className="mb-2" dangerouslySetInnerHTML={{ __html: line.replace(/\*\*(.*?)\*\*/g, '<strong class="text-white text-base">$1</strong>') }} />;
                                        })}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Controls */}
                        <div className="flex gap-2 mb-2 justify-center lg:justify-end">
                            {["3M", "6M", "1Y", "3Y"].map((p) => (
                                <button
                                    key={p}
                                    onClick={() => setPeriod(p as any)}
                                    className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${
                                        period === p 
                                        ? "bg-purple-500 text-white" 
                                        : "bg-white/5 text-gray-400 hover:bg-white/10"
                                    }`}
                                >
                                    {p}
                                </button>
                            ))}
                        </div>

                        {/* Metrics Grid */}
                        {data.results && data.results[period] && (
                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2 mb-4">
                                {LINE_CONFIG.map(cfg => {
                                    const resData = data.results[period][cfg.key];
                                    if (!resData) return null;
                                    
                                    const isMain = cfg.key === "Portfolio";
                                    const borderClass = isMain ? "border-purple-500/30" : "border-white/5";
                                    const bgClass = isMain ? "bg-purple-500/5" : "bg-white/[0.02]";
                                    const textClass = isMain ? "text-purple-300" : "text-gray-300";

                                    return (
                                        <div key={cfg.key} className={`col-span-2 md:col-span-1 border ${borderClass} rounded-xl p-1.5 ${bgClass}`}>
                                            <div className={`text-center font-bold py-1 text-xs sm:text-sm border-b ${isMain ? "border-purple-500/20" : "border-white/5"} mb-2 ${textClass}`}>
                                                {cfg.name}
                                            </div>
                                            <div className="grid grid-cols-2 gap-1 items-center">
                                                {renderMetric("수익률", resData.return)}
                                                {renderMetric("MDD", resData.mdd)}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* Chart */}
                        {data.chart_data && data.chart_data[period] && data.chart_data[period].length > 0 ? (
                            <div className="w-full h-[350px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={data.chart_data[period]} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                        <XAxis dataKey="date" stroke="none" tick={{ fill: '#71717a', fontSize: 12 }} minTickGap={30} />
                                        <YAxis stroke="none" tick={{ fill: '#71717a', fontSize: 12 }} domain={['auto', 'auto']} tickFormatter={(val) => `${val.toFixed(0)}%`} />
                                        <RechartsTooltip 
                                            contentStyle={{ backgroundColor: 'rgba(9, 9, 11, 0.9)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '8px' }}
                                            formatter={(val: number) => [`${val.toFixed(2)}%`]}
                                            labelStyle={{ color: '#a1a1aa', marginBottom: '8px' }}
                                        />
                                        <Legend 
                                            onMouseEnter={(e: any) => setActiveHighlight(e.dataKey)}
                                            onMouseLeave={() => setActiveHighlight(null)}
                                        />
                                        {LINE_CONFIG.map(cfg => {
                                            if (data.chart_data[period].length > 0 && !(cfg.key in data.chart_data[period][0])) return null;
                                            return (
                                                <Line 
                                                    key={cfg.key}
                                                    type="monotone" 
                                                    name={cfg.name} 
                                                    dataKey={cfg.key} 
                                                    stroke={cfg.color} 
                                                    strokeWidth={activeHighlight === cfg.key || activeHighlight === cfg.pair ? Math.max(3, cfg.width) : cfg.width}
                                                    strokeDasharray={cfg.isBench ? "5 5" : undefined}
                                                    strokeOpacity={getOpacity(cfg.key, cfg.isBench, cfg.pair)}
                                                    dot={false}
                                                    activeDot={{ r: 4, strokeOpacity: getOpacity(cfg.key, cfg.isBench, cfg.pair) }}
                                                />
                                            );
                                        })}
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        ) : (
                            <div className="w-full h-[350px] flex items-center justify-center text-gray-500 bg-white/[0.02] rounded-xl">
                                차트 데이터를 불러올 수 없습니다. 기간을 변경해보세요.
                            </div>
                        )}
                        
                    </div>
                ) : null}
            </div>
        </section>
    );
}
