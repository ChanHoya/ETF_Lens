import React, { useState, useEffect } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend } from "recharts";
import { API_BASE } from "@/lib/apiConfig";
import { Loader2 } from "lucide-react";

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

    const fetchBacktest = async () => {
        setLoading(true);
        setError(null);
        try {
            const reqHoldings = holdings
                .filter(h => h.eval_amount > 0)
                .map(h => ({
                    code: h.code,
                    name: h.name,
                    amount: h.eval_amount
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
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
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
                        {data.insights && data.insights.length > 0 && (
                            <div className="p-4 bg-indigo-500/10 border border-indigo-500/30 rounded-xl">
                                <h3 className="font-bold text-indigo-300 mb-2 flex items-center gap-2">
                                    💡 AI 분석 인사이트
                                </h3>
                                <ul className="list-disc list-inside text-sm text-indigo-100 space-y-1">
                                    {data.insights.map((msg: string, i: number) => (
                                        <li key={i}>{msg}</li>
                                    ))}
                                </ul>
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
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                                {data.results[period]["Portfolio"] && (
                                    <div className="col-span-2 md:col-span-1 border border-purple-500/30 rounded-xl p-1 bg-purple-500/5">
                                        <div className="text-center font-bold text-purple-300 py-1 text-sm border-b border-purple-500/20 mb-2">내 포트폴리오</div>
                                        <div className="grid grid-cols-2 gap-2">
                                            {renderMetric("수익률", data.results[period]["Portfolio"].return)}
                                            {renderMetric("MDD (최대낙폭)", data.results[period]["Portfolio"].mdd)}
                                        </div>
                                    </div>
                                )}
                                {data.results[period]["^KS11"] && (
                                    <div className="col-span-2 md:col-span-1 border border-white/5 rounded-xl p-1">
                                        <div className="text-center font-bold text-gray-400 py-1 text-sm border-b border-white/5 mb-2">KOSPI</div>
                                        <div className="grid grid-cols-2 gap-2">
                                            {renderMetric("수익률", data.results[period]["^KS11"].return)}
                                            {renderMetric("MDD", data.results[period]["^KS11"].mdd)}
                                        </div>
                                    </div>
                                )}
                                {data.results[period]["^GSPC"] && (
                                    <div className="col-span-2 md:col-span-1 border border-white/5 rounded-xl p-1">
                                        <div className="text-center font-bold text-gray-400 py-1 text-sm border-b border-white/5 mb-2">S&P 500</div>
                                        <div className="grid grid-cols-2 gap-2">
                                            {renderMetric("수익률", data.results[period]["^GSPC"].return)}
                                            {renderMetric("MDD", data.results[period]["^GSPC"].mdd)}
                                        </div>
                                    </div>
                                )}
                                {data.results[period]["^IXIC"] && (
                                    <div className="col-span-2 md:col-span-1 border border-white/5 rounded-xl p-1">
                                        <div className="text-center font-bold text-gray-400 py-1 text-sm border-b border-white/5 mb-2">NASDAQ</div>
                                        <div className="grid grid-cols-2 gap-2">
                                            {renderMetric("수익률", data.results[period]["^IXIC"].return)}
                                            {renderMetric("MDD", data.results[period]["^IXIC"].mdd)}
                                        </div>
                                    </div>
                                )}
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
                                        <Legend />
                                        <Line type="monotone" name="내 포트폴리오" dataKey="Portfolio" stroke="#a855f7" strokeWidth={3} dot={false} />
                                        <Line type="monotone" name="KOSPI" dataKey="^KS11" stroke="#3b82f6" strokeWidth={1} strokeDasharray="5 5" dot={false} />
                                        <Line type="monotone" name="S&P 500" dataKey="^GSPC" stroke="#f43f5e" strokeWidth={1} strokeDasharray="5 5" dot={false} />
                                        <Line type="monotone" name="NASDAQ" dataKey="^IXIC" stroke="#10b981" strokeWidth={1} strokeDasharray="5 5" dot={false} />
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
