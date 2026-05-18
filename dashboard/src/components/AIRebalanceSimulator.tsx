import React, { useState, useEffect } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend } from "recharts";
import { API_BASE } from "@/lib/apiConfig";
import { Loader2, ShieldAlert, Sparkles, TrendingUp, AlertTriangle, ArrowRight, RefreshCw, Layers } from "lucide-react";

type HoldingProps = {
    code: string;
    name: string;
    eval_amount: number;
};

type AIRebalanceSimulatorProps = {
    holdings: HoldingProps[];
};

export default function AIRebalanceSimulator({ holdings }: AIRebalanceSimulatorProps) {
    const [period, setPeriod] = useState<"3M" | "6M" | "1Y" | "3Y">("1Y");
    const [defenseFactor, setDefenseFactor] = useState<number>(0.5); // 50% 기본 대피
    const [safeAsset, setSafeAsset] = useState<string>("272580"); // KODEX 단기채권PLUS
    
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const [activeHighlight, setActiveHighlight] = useState<string | null>(null);

    const safeAssetOptions = [
        { code: "272580", name: "KODEX 단기채권PLUS (안정성 극대화)" },
        { code: "136340", name: "KODEX 국고채3년 (채권 듀레이션 노출)" },
        { code: "273130", name: "KODEX 종합채권(AA-이상)액티브" }
    ];

    const fetchBacktest = async () => {
        if (!holdings || holdings.length === 0) return;
        setLoading(true);
        setError(null);
        try {
            const reqHoldings = holdings
                .filter(h => h.eval_amount > 0)
                .map(h => ({
                    code: h.code,
                    name: h.name,
                    amount: h.eval_amount,
                }));

            const res = await fetch(`${API_BASE}/api/v1/my/backtest/rebalance`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    holdings: reqHoldings,
                    period,
                    defense_factor: defenseFactor,
                    safe_asset_code: safeAsset
                })
            });

            const result = await res.json();
            if (!res.ok) throw new Error(result.detail || "AI 리밸런싱 백테스트 실패");
            if (result.status === "error") throw new Error(result.message);

            setData(result);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBacktest();
    }, [holdings, period, defenseFactor, safeAsset]);

    if (!holdings || holdings.length === 0) return null;

    const renderMetricBox = (title: string, metrics: any, highlight: boolean = false) => {
        if (!metrics) return null;
        const retVal = metrics.total_return;
        const mddVal = metrics.mdd;
        const sharpeVal = metrics.sharpe;

        const retColor = retVal > 0 ? "text-emerald-400" : retVal < 0 ? "text-rose-400" : "text-gray-400";
        const mddColor = mddVal < -15 ? "text-rose-400" : mddVal < -8 ? "text-amber-400" : "text-emerald-400";
        const sharpeColor = sharpeVal > 1.2 ? "text-emerald-400" : sharpeVal > 0.6 ? "text-amber-400" : "text-gray-400";

        return (
            <div className={`flex flex-col gap-3 p-4 rounded-2xl border transition-all duration-300 ${
                highlight 
                ? "bg-emerald-950/20 border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.05)]" 
                : "bg-white/[0.01] border-white/5 hover:border-white/10"
            }`}>
                <div className="flex justify-between items-center">
                    <span className={`text-xs font-bold ${highlight ? "text-emerald-400" : "text-gray-400"}`}>
                        {title}
                    </span>
                    {highlight && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/20 text-emerald-400 font-extrabold flex items-center gap-1 animate-pulse">
                            <Sparkles className="w-3 h-3" /> BEST
                        </span>
                    )}
                </div>
                
                <div className="grid grid-cols-3 gap-2 mt-1">
                    <div className="flex flex-col">
                        <span className="text-[10px] text-gray-500">누적 수익률</span>
                        <span className={`text-base sm:text-lg font-bold ${retColor}`}>
                            {retVal > 0 ? "+" : ""}{retVal.toFixed(2)}%
                        </span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[10px] text-gray-500">최대 낙폭 (MDD)</span>
                        <span className={`text-base sm:text-lg font-bold ${mddColor}`}>
                            {mddVal.toFixed(2)}%
                        </span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[10px] text-gray-500">샤프 지수</span>
                        <span className={`text-base sm:text-lg font-bold ${sharpeColor}`}>
                            {sharpeVal.toFixed(2)}
                        </span>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <section className="flex flex-col gap-4 mt-6">
            <div className="flex justify-between items-center flex-wrap gap-2">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                    <span className="w-1.5 h-6 bg-emerald-500 rounded-full"></span>
                    AI 리밸런싱 백테스트 시뮬레이터 (S4-2)
                </h2>
                <div className="flex items-center gap-1.5 bg-emerald-950/20 border border-emerald-500/20 px-3 py-1 rounded-full text-xs text-emerald-400 font-medium">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Exit-Signal 기반 동적 자산배분</span>
                </div>
            </div>

            <div className="bg-gradient-to-b from-white/[0.03] to-white/[0.01] border border-white/10 rounded-3xl backdrop-blur-md overflow-hidden p-6 flex flex-col gap-6">
                
                {/* 1. Quant Parameters Customizer Section */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-5 bg-white/[0.02] border border-white/5 rounded-2xl">
                    
                    {/* Period Selector */}
                    <div className="flex flex-col gap-2">
                        <label className="text-xs font-bold text-gray-400 flex items-center gap-1.5">
                            <Layers className="w-3.5 h-3.5 text-purple-400" /> 시뮬레이션 기간
                        </label>
                        <div className="flex gap-1.5 mt-1 bg-black/30 p-1 rounded-xl">
                            {(["3M", "6M", "1Y", "3Y"] as const).map((p) => (
                                <button
                                    key={p}
                                    onClick={() => setPeriod(p)}
                                    className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all duration-300 ${
                                        period === p 
                                        ? "bg-emerald-500 text-black shadow-[0_0_10px_rgba(16,185,129,0.3)]" 
                                        : "text-gray-400 hover:text-white"
                                    }`}
                                >
                                    {p}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Defense Factor Slider */}
                    <div className="flex flex-col gap-2">
                        <div className="flex justify-between items-center">
                            <label className="text-xs font-bold text-gray-400 flex items-center gap-1.5">
                                <ShieldAlert className="w-3.5 h-3.5 text-amber-400" /> 대비 계수 (Defense Factor)
                            </label>
                            <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                                {Math.round(defenseFactor * 100)}% 대피
                            </span>
                        </div>
                        <div className="flex items-center gap-3 mt-3">
                            <span className="text-[10px] text-gray-500">공격</span>
                            <input
                                type="range"
                                min="0.1"
                                max="1.0"
                                step="0.1"
                                value={defenseFactor}
                                onChange={(e) => setDefenseFactor(parseFloat(e.target.value))}
                                className="flex-1 h-1.5 bg-black/40 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                            />
                            <span className="text-[10px] text-gray-500">방어</span>
                        </div>
                    </div>

                    {/* Safe Asset Dropdown */}
                    <div className="flex flex-col gap-2">
                        <label className="text-xs font-bold text-gray-400 flex items-center gap-1.5">
                            <TrendingUp className="w-3.5 h-3.5 text-indigo-400" /> 위기 시 대피할 안전 자산
                        </label>
                        <select
                            value={safeAsset}
                            onChange={(e) => setSafeAsset(e.target.value)}
                            className="mt-1 w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-gray-200 outline-none focus:border-emerald-500/50"
                        >
                            {safeAssetOptions.map(opt => (
                                <option key={opt.code} value={opt.code}>
                                    [{opt.code}] {opt.name}
                                </option>
                            ))}
                        </select>
                    </div>

                </div>

                {/* 2. Simulation Body */}
                {loading ? (
                    <div className="flex flex-col items-center justify-center p-10 h-[350px]">
                        <Loader2 className="w-10 h-10 text-emerald-500 animate-spin mb-4" />
                        <p className="text-gray-400 text-sm">과거 Exit-Signal 시그널과 포트폴리오 일별 종가를 정합 연산하는 중...</p>
                    </div>
                ) : error ? (
                    <div className="p-8 text-center text-rose-400 h-[350px] flex flex-col items-center justify-center gap-2 border border-rose-500/20 bg-rose-500/5 rounded-2xl">
                        <AlertTriangle className="w-8 h-8 text-rose-500" />
                        <span className="font-semibold">{error}</span>
                        <button onClick={fetchBacktest} className="mt-2 text-xs flex items-center gap-1 bg-white/5 px-3 py-1.5 rounded hover:bg-white/10 text-white transition-colors">
                            <RefreshCw className="w-3 h-3" /> 다시 시도
                        </button>
                    </div>
                ) : data ? (
                    <div className="flex flex-col gap-6">
                        
                        {/* Results Bento Box */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            {renderMetricBox("🍀 AI 동적 리밸런싱", data.metrics.ai_rebalance, true)}
                            {renderMetricBox("⚖️ 매수 후 보유 (Buy & Hold)", data.metrics.buy_and_hold, false)}
                            {renderMetricBox("📊 시장 벤치마크 (KOSPI 200)", data.metrics.benchmark, false)}
                        </div>

                        {/* Interactive Insights Banner */}
                        {data.metrics.ai_rebalance.total_return > data.metrics.buy_and_hold.total_return && (
                            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center gap-3">
                                <span className="text-xl">🏆</span>
                                <div className="text-xs sm:text-sm text-emerald-300/90 leading-relaxed font-semibold">
                                    AI 리밸런싱 전략이 매수 후 보유(Buy & Hold) 대비{" "}
                                    <strong className="text-white text-base">
                                        {(data.metrics.ai_rebalance.total_return - data.metrics.buy_and_hold.total_return).toFixed(2)}%
                                    </strong>
                                    의 초과 수익률을 달성했으며, 최대 낙폭(MDD)을{" "}
                                    <strong className="text-white text-base">
                                        {(data.metrics.buy_and_hold.mdd - data.metrics.ai_rebalance.mdd).toFixed(2)}%p
                                    </strong>{" "}
                                    더 안전하게 방어했습니다.
                                </div>
                            </div>
                        )}

                        {/* 3. Recharts Line Chart */}
                        <div className="w-full h-[360px] bg-black/20 rounded-2xl p-4 border border-white/5 relative">
                            <div className="absolute top-4 left-4 z-10 flex gap-4 text-[10px] text-gray-500">
                                <div className="flex items-center gap-1.5">
                                    <span className="w-2.5 h-0.5 bg-emerald-500 block"></span> AI 동적 리밸런싱 (실선)
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className="w-2.5 h-0.5 border-t border-dashed border-purple-400 block"></span> 매수 후 보유 (점선)
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className="w-2.5 h-0.5 border-t border-dotted border-gray-600 block"></span> 벤치마크 (도트)
                                </div>
                            </div>
                            
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={data.timeline} margin={{ top: 25, right: 10, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                                    <XAxis dataKey="date" stroke="none" tick={{ fill: '#71717a', fontSize: 11 }} minTickGap={40} />
                                    <YAxis stroke="none" tick={{ fill: '#71717a', fontSize: 11 }} domain={['auto', 'auto']} tickFormatter={(val) => `${(val/100 - 100).toFixed(0)}%`} />
                                    <RechartsTooltip 
                                        contentStyle={{ backgroundColor: 'rgba(9, 9, 11, 0.95)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px', backdropFilter: 'blur(8px)' }}
                                        formatter={(val: number) => [`${(val/100 - 100).toFixed(2)}%`]}
                                        labelStyle={{ color: '#a1a1aa', fontSize: '12px', marginBottom: '6px' }}
                                    />
                                    <Line 
                                        type="monotone" 
                                        name="AI 동적 리밸런싱"
                                        dataKey="ai_rebalance" 
                                        stroke="#10b981" 
                                        strokeWidth={3}
                                        dot={false}
                                        activeDot={{ r: 4, stroke: "#10b981", strokeWidth: 2 }}
                                    />
                                    <Line 
                                        type="monotone" 
                                        name="매수 후 보유 (Buy & Hold)" 
                                        dataKey="buy_and_hold" 
                                        stroke="#a855f7" 
                                        strokeWidth={2}
                                        strokeDasharray="5 5"
                                        dot={false}
                                        activeDot={{ r: 3 }}
                                    />
                                    <Line 
                                        type="monotone" 
                                        name="벤치마크 (KOSPI)" 
                                        dataKey="benchmark" 
                                        stroke="rgba(156, 163, 175, 0.4)" 
                                        strokeWidth={1}
                                        strokeDasharray="3 3"
                                        dot={false}
                                        activeDot={false}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>

                        {/* 4. Transaction Terminal Logs */}
                        <div className="flex flex-col gap-2">
                            <label className="text-xs font-bold text-gray-400 flex items-center gap-1.5">
                                💻 AI 리밸런싱 체결 시뮬레이션 로그 (Terminal)
                            </label>
                            
                            <div className="w-full max-h-[180px] overflow-y-auto bg-black/40 border border-white/5 rounded-2xl p-4 font-mono text-[11px] leading-relaxed text-gray-300 flex flex-col gap-2 divide-y divide-white/5">
                                {data.event_logs && data.event_logs.length > 0 ? (
                                    data.event_logs.map((log: any, idx: number) => (
                                        <div key={idx} className="pt-2 first:pt-0 flex items-start gap-2">
                                            <span className="text-emerald-500 shrink-0">[{log.date}]</span>
                                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold shrink-0 ${
                                                log.event === "DEFENSIVE_SHIFT" 
                                                ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" 
                                                : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                            }`}>
                                                {log.event}
                                            </span>
                                            <span className="text-gray-300">{log.description}</span>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center py-6 text-gray-500">
                                        [LOGS EMPTY] 해당 백테스트 시뮬레이션 기간 동안 위험 임계치를 초과하는 리밸런싱 전이 사건이 발생하지 않았습니다. (안정 시장 유지)
                                    </div>
                                )}
                            </div>
                        </div>

                    </div>
                ) : null}

            </div>
        </section>
    );
}
