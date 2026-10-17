import React, { useState, useEffect, useMemo } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend } from "recharts";
import { API_BASE } from "@/lib/apiConfig";
import { STANDARD_TOOLTIP_STYLE, STANDARD_LEGEND_WRAPPER_STYLE } from "@/lib/chartTheme";
import { Loader2, Sparkles, RefreshCw, Shield, Maximize2, Minimize2 } from "lucide-react";

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
    const [metricMode, setMetricMode] = useState<'all' | 'basic' | 'risk'>('all');
    const [isExpanded, setIsExpanded] = useState<boolean>(false);
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const [insightText, setInsightText] = useState<string | null>(null);
    const [insightLoading, setInsightLoading] = useState(false);
    const [activeHighlight, setActiveHighlight] = useState<string | null>(null);

    const categorizeItem = (name: string, code: string = "") => {
        if (!name) return 'KOSPI';
        if (code && /^[A-Za-z]+(\.[A-Za-z]+)?$/.test(code)) return 'NASDAQ';
        const n = name.toUpperCase();
        if (n.includes('금현물') || n.includes('국제금') || n.includes('은현물') || n.includes('금선물') || n.includes('GOLD')) return '현물/현금 (금, 예수금 등)';
        if (n.includes('머니마켓') || n.includes('CD금리') || n.includes('KOFR') || n.includes('단기채') || n.includes('파킹')) return '현물/현금 (금, 예수금 등)';
        if (n.includes('미국성장') || n.includes('미국우주항공') || n.includes('미국양자컴퓨팅') || n.includes('나스닥') || n.includes('NASDAQ') || n.includes('빅테크') || n.includes('QQQ') || n.includes('성장커버드콜') || n.includes('성장 커버드콜')) return 'NASDAQ';
        if (n.includes('미국배당') || n.includes('S&P500') || n.includes('S&P 500')) return 'S&P 500';
        if (n.includes('위탁') && code === "") return '현물/현금 (금, 예수금 등)';
        
        // 코스닥 식별 (바이오, 헬스케어, 2차전지 등도 코스닥으로 우선 분류)
        if (n.includes('코스닥') || n.includes('KOSDAQ') || n.includes('바이오') || n.includes('헬스케어') || n.includes('2차전지')) {
            return 'KOSDAQ';
        }
        if (n.includes('미국')) return '미국';
        return 'KOSPI';
    };

    const METRIC_COLUMNS = [
        {
            id: "all",
            upper: { key: "Portfolio", name: "내 포트폴리오 (전체)", color: "#a855f7", isMain: true },
            lower: null,
        },
        {
            id: "kospi",
            upper: { key: "Portfolio_KOSPI", name: "내 포트폴리오 (KOSPI)", color: "#3b82f6", isMain: false },
            lower: { key: "^KS11", name: "KOSPI 지수", color: "#3b82f6", isMain: false },
        },
        {
            id: "kosdaq",
            upper: { key: "Portfolio_KOSDAQ", name: "내 포트폴리오 (KOSDAQ)", color: "#eab308", isMain: false },
            lower: { key: "^KQ11", name: "KOSDAQ 지수", color: "#eab308", isMain: false },
        },
        {
            id: "sp500",
            upper: { key: "Portfolio_S&P 500", name: "내 포트폴리오 (S&P 500)", color: "#f43f5e", isMain: false },
            lower: { key: "^GSPC", name: "S&P 500 지수", color: "#f43f5e", isMain: false },
        },
        {
            id: "nasdaq",
            upper: { key: "Portfolio_NASDAQ", name: "내 포트폴리오 (NASDAQ)", color: "#10b981", isMain: false },
            lower: { key: "^IXIC", name: "NASDAQ 지수", color: "#10b981", isMain: false },
        },
    ];

    const LINE_CONFIG = [
        { key: "Portfolio", name: "내 포트폴리오 (전체)", color: "#a855f7", isBench: false, width: 3, pair: null },
        { key: "Portfolio_KOSPI", name: "내 포트폴리오 (KOSPI)", color: "#3b82f6", isBench: false, width: 2, pair: "^KS11" },
        { key: "Portfolio_KOSDAQ", name: "내 포트폴리오 (KOSDAQ)", color: "#eab308", isBench: false, width: 2, pair: "^KQ11" },
        { key: "Portfolio_S&P 500", name: "내 포트폴리오 (S&P 500)", color: "#f43f5e", isBench: false, width: 2, pair: "^GSPC" },
        { key: "Portfolio_NASDAQ", name: "내 포트폴리오 (NASDAQ)", color: "#10b981", isBench: false, width: 2, pair: "^IXIC" },
        { key: "^KS11", name: "KOSPI 지수", color: "#3b82f6", isBench: true, width: 1, pair: "Portfolio_KOSPI" },
        { key: "^KQ11", name: "KOSDAQ 지수", color: "#eab308", isBench: true, width: 1, pair: "Portfolio_KOSDAQ" },
        { key: "^GSPC", name: "S&P 500 지수", color: "#f43f5e", isBench: true, width: 1, pair: "Portfolio_S&P 500" },
        { key: "^IXIC", name: "NASDAQ 지수", color: "#10b981", isBench: true, width: 1, pair: "Portfolio_NASDAQ" },
    ];

    const getOpacity = (key: string, isBench: boolean, pair: string | null) => {
        if (!activeHighlight) return isBench ? 0.3 : 1.0;
        if (activeHighlight === key || activeHighlight === pair) return 1.0;
        return 0.1;
    };

    const getHoldingsSignature = () => {
        if (!holdings || holdings.length === 0) return "";
        const today = new Date().toISOString().slice(0, 10);
        const valid = holdings.filter(h => h.eval_amount > 0);
        const total = valid.reduce((sum, h) => sum + h.eval_amount, 0);
        if (total === 0) return "";
        // 비중 기준 0.1% 단위 정규화 + 당일 날짜 결합으로 불필요한 재연산 방지
        const normHoldings = valid
            .map(h => `${h.code}:${Math.round((h.eval_amount / total) * 1000)}`)
            .sort()
            .join("|");
        return `${normHoldings}_${today}`;
    };

    const fetchBacktest = async (force: boolean = false) => {
        const sig = getHoldingsSignature();
        const cacheKey = `iprism_backtest_${sig}`;
        const insightCacheKey = `iprism_backtest_insight_${sig}`;

        // 1. localStorage 및 sessionStorage 캐시 확인 (새로고침이 아닌 경우 0ms 즉시 표시)
        if (!force && typeof window !== "undefined" && sig) {
            try {
                const cachedStr = localStorage.getItem(cacheKey) || sessionStorage.getItem(cacheKey);
                if (cachedStr) {
                    const parsed = JSON.parse(cachedStr);
                    setData(parsed);
                    setLoading(false);
                    const cachedInsight = localStorage.getItem(insightCacheKey) || sessionStorage.getItem(insightCacheKey);
                    if (cachedInsight) {
                        setInsightText(cachedInsight);
                        setInsightLoading(false);
                    } else {
                        fetchInsight(parsed.results, parsed.weights, sig);
                    }
                    return;
                }
            } catch (_) {}
        }

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
            if (typeof window !== "undefined" && sig) {
                try {
                    localStorage.setItem(cacheKey, JSON.stringify(result));
                    sessionStorage.setItem(cacheKey, JSON.stringify(result));
                } catch (_) {}
            }

            // Fetch AI Insight asynchronously
            fetchInsight(result.results, result.weights, sig);

        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const fetchInsight = async (resultsData: any, weightsData: any, sig?: string) => {
        const insightCacheKey = sig ? `iprism_backtest_insight_${sig}` : "";
        if (insightCacheKey && typeof window !== "undefined") {
            const cachedInsight = sessionStorage.getItem(insightCacheKey);
            if (cachedInsight) {
                setInsightText(cachedInsight);
                setInsightLoading(false);
                return;
            }
        }

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
                if (insightCacheKey && typeof window !== "undefined") {
                    try {
                        sessionStorage.setItem(insightCacheKey, result.insight_md);
                    } catch (_) {}
                }
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

    const renderRiskMetric = (label: string, val: number | undefined, tooltip: string, unit: string = "") => {
        if (val === undefined || val === null) return null;
        const colorClass = val > 1.0 ? "text-emerald-400" : val > 0 ? "text-sky-300" : val < 0 ? "text-amber-400" : "text-gray-400";
        return (
            <div className="flex flex-col items-center p-2 bg-white/[0.02] rounded-xl border border-white/5 group relative cursor-help">
                <span className="text-[10px] text-gray-500 mb-0.5">{label}</span>
                <span className={`text-xs font-bold ${colorClass}`}>
                    {val.toFixed(2)}{unit}
                </span>
                <div className="absolute bottom-full mb-1.5 hidden group-hover:block z-30 w-44 p-2 bg-slate-900/95 border border-white/10 rounded-lg text-[10px] text-gray-200 text-center shadow-xl backdrop-blur-md pointer-events-none leading-relaxed">
                    {tooltip}
                </div>
            </div>
        );
    };

    const renderCard = (cfg: { key: string; name: string; isMain?: boolean }) => {
        const resData = data?.results?.[period]?.[cfg.key];
        if (!resData) return null;

        const isMain = cfg.isMain ?? (cfg.key === "Portfolio");
        const borderClass = isMain ? "border-purple-500/40 shadow-sm shadow-purple-500/10" : "border-white/10";
        const bgClass = isMain ? "bg-purple-500/10" : "bg-white/[0.02]";
        const textClass = isMain ? "text-purple-300 font-extrabold" : "text-gray-300 font-semibold";
        const hasRisk = resData.volatility !== undefined;

        return (
            <div className={`border ${borderClass} rounded-xl p-2.5 ${bgClass} transition-all hover:border-white/20 flex flex-col justify-between gap-2`}>
                <div className={`text-center py-1 text-xs sm:text-sm border-b ${isMain ? "border-purple-500/20" : "border-white/5"} ${textClass}`}>
                    {cfg.name}
                </div>

                {/* 기본 지표 (수익률 / MDD) */}
                {(metricMode === 'all' || metricMode === 'basic') && (
                    <div className="grid grid-cols-2 gap-1.5 items-center">
                        {renderMetric("수익률", resData.return)}
                        {renderMetric("MDD", resData.mdd)}
                    </div>
                )}

                {/* 4대 심층 리스크 지표 (Vol, Sharpe, Sortino, Calmar) */}
                {hasRisk && (metricMode === 'all' || metricMode === 'risk') && (
                    <div className={`grid grid-cols-2 gap-1.5 ${metricMode === 'all' ? 'pt-1.5 border-t border-white/5' : ''}`}>
                        {renderRiskMetric("연변동성", resData.volatility, "연간화 주가 표준편차 (낮을수록 변동 리스크 안정)", "%")}
                        {renderRiskMetric("Sharpe", resData.sharpe, "위험 단위당 초과수익률 (1.0 이상 우수, 0.5 미만 주의)")}
                        {renderRiskMetric("Sortino", resData.sortino, "하방 손실 위험 대비 초과수익률 (하락장 방어 지표)")}
                        {renderRiskMetric("Calmar", resData.calmar, "최대 낙폭(MDD) 대비 연수익률 (낙폭 회복 탄력성)")}
                    </div>
                )}
            </div>
        );
    };

    const sampledChartData = useMemo(() => {
        const raw = data?.chart_data?.[period];
        if (!raw || raw.length <= 150) return raw || [];
        const step = Math.ceil(raw.length / 150);
        const sampled = raw.filter((_: any, idx: number) => idx % step === 0);
        if (sampled[sampled.length - 1] !== raw[raw.length - 1]) {
            sampled.push(raw[raw.length - 1]);
        }
        return sampled;
    }, [data, period]);

    return (
        <section className="flex flex-col gap-4 mt-6">
            <div className="flex items-center justify-between flex-wrap gap-2">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                    <span className="w-1.5 h-6 bg-purple-500 rounded-full"></span>
                    포트폴리오 백테스터 & 성과 분석
                </h2>
                <button
                    onClick={() => fetchBacktest(true)}
                    disabled={loading}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border border-white/10 transition-all disabled:opacity-50"
                    title="캐시를 비우고 최신 데이터로 다시 계산"
                >
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                    <span>새로고침</span>
                </button>
            </div>
            <div className="bg-white/[0.02] border border-white/10 rounded-2xl backdrop-blur-md overflow-hidden p-6">
                
                {loading && !data ? (
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

                        {/* Controls: 리스크 뷰 모드 토글 + 기간 선택기 */}
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-2">
                            {/* 지표 보기 필터 */}
                            <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/5 text-xs">
                                <button
                                    onClick={() => setMetricMode('all')}
                                    className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                                        metricMode === 'all'
                                            ? "bg-purple-500 text-white shadow-sm"
                                            : "text-gray-400 hover:text-white"
                                    }`}
                                >
                                    종합 지표
                                </button>
                                <button
                                    onClick={() => setMetricMode('basic')}
                                    className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                                        metricMode === 'basic'
                                            ? "bg-purple-500 text-white shadow-sm"
                                            : "text-gray-400 hover:text-white"
                                    }`}
                                >
                                    수익률·MDD
                                </button>
                                <button
                                    onClick={() => setMetricMode('risk')}
                                    className={`px-3 py-1 rounded-lg font-medium transition-colors flex items-center gap-1 ${
                                        metricMode === 'risk'
                                            ? "bg-purple-500 text-white shadow-sm"
                                            : "text-gray-400 hover:text-white"
                                    }`}
                                >
                                    <Shield className="w-3 h-3 text-purple-300" />
                                    <span>4대 리스크</span>
                                </button>
                            </div>

                            {/* 기간 선택 및 차트 뷰포트 확대 버튼 */}
                            <div className="flex items-center gap-1.5 justify-center">
                                {["3M", "6M", "1Y", "3Y"].map((p) => (
                                    <button
                                        key={p}
                                        onClick={() => setPeriod(p as any)}
                                        className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                                            period === p 
                                            ? "bg-purple-500 text-white shadow-sm" 
                                            : "bg-white/5 text-gray-400 hover:bg-white/10"
                                        }`}
                                    >
                                        {p}
                                    </button>
                                ))}
                                <button
                                    onClick={() => setIsExpanded(!isExpanded)}
                                    className={`p-1.5 rounded-xl text-xs font-medium transition-colors border ${
                                        isExpanded
                                            ? "bg-purple-500/20 text-purple-300 border-purple-500/30"
                                            : "bg-white/5 text-gray-400 hover:text-white border-white/5"
                                    }`}
                                    title={isExpanded ? "기본 뷰로 축소" : "차트 높이 및 와이드 확대"}
                                >
                                    {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                                </button>
                            </div>
                        </div>

                        {/* Metrics Grid (위아래 동일군 1:1 비교 배치) */}
                        {data.results && data.results[period] && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 mb-4">
                                {METRIC_COLUMNS.map((col) => {
                                    return (
                                        <div key={col.id} className="flex flex-col gap-2.5">
                                            {/* 상단: 내 포트폴리오 */}
                                            {renderCard(col.upper)}

                                            {/* 하단: 동일군 벤치마크 지수 (전체 아래는 비움) */}
                                            {col.lower ? (
                                                renderCard(col.lower)
                                            ) : (
                                                <div 
                                                    className="hidden lg:flex flex-1 rounded-xl p-2 border border-dashed border-white/5 bg-transparent items-center justify-center text-xs text-gray-600 min-h-[96px]"
                                                    aria-hidden="true"
                                                >
                                                    <span className="text-[11px] text-gray-500/40">—</span>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* Chart */}
                        {sampledChartData && sampledChartData.length > 0 ? (
                            <div className={`w-full transition-all duration-300 ${isExpanded ? "h-[480px]" : "h-[350px]"} touch-pan-x`}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={sampledChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                        <XAxis dataKey="date" stroke="none" tick={{ fill: '#71717a', fontSize: 12 }} minTickGap={isExpanded ? 20 : 30} />
                                        <YAxis stroke="none" tick={{ fill: '#71717a', fontSize: 12 }} domain={['auto', 'auto']} tickFormatter={(val) => `${val.toFixed(0)}%`} />
                                        <RechartsTooltip 
                                            contentStyle={STANDARD_TOOLTIP_STYLE}
                                            formatter={(val: number) => [`${val.toFixed(2)}%`]}
                                            labelStyle={{ color: '#a1a1aa', marginBottom: '8px' }}
                                            cursor={{ stroke: 'rgba(168, 85, 247, 0.4)', strokeWidth: 1.5, strokeDasharray: '4 4' }}
                                        />
                                        <Legend 
                                            wrapperStyle={STANDARD_LEGEND_WRAPPER_STYLE}
                                            onClick={(e: any) => {
                                                if (!e || !e.dataKey) return;
                                                setActiveHighlight(prev => prev === e.dataKey ? null : e.dataKey);
                                            }}
                                            onMouseEnter={(e: any) => setActiveHighlight(e.dataKey)}
                                            onMouseLeave={() => setActiveHighlight(null)}
                                            formatter={(value, entry: any) => {
                                                const isDimmed = activeHighlight && activeHighlight !== entry.dataKey;
                                                const isSelected = activeHighlight === entry.dataKey;
                                                return (
                                                    <span 
                                                        className={`cursor-pointer transition-opacity text-[11px] ${isSelected ? 'font-bold underline' : ''}`}
                                                        style={{ opacity: isDimmed ? 0.35 : 1 }}
                                                    >
                                                        {value}
                                                    </span>
                                                );
                                            }}
                                        />
                                        {LINE_CONFIG.map(cfg => {
                                            if (sampledChartData.length > 0 && !(cfg.key in sampledChartData[0])) return null;
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
                                                    isAnimationActive={false}
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
