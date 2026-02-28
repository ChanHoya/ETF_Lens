"use client";

import React, { useState, useEffect } from 'react';
import { Search, Filter, TrendingUp, TrendingDown, X, Info, ShieldAlert, BarChart3, Activity, Hourglass } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend } from 'recharts';

// Mock Data for Table
const mockCCData = [
    { id: 1, name: "TIGER 미국배당+7%프리미엄다우존스", ticker: "458730", price: 10540, yield: 10.2, tr1y: 12.5, diffBenchmark: -4.8, country: 'US', index: 'Dow Jones U.S. Dividend 100', theme: '고배당', issuer: '미래에셋자산운용', aum: '1조 2천억', ter: '0.39%', launchDate: '2023-06-20', distFreq: '월분배' },
    { id: 2, name: "KODEX 미국AI테크TOP10+15%프리미엄", ticker: "474500", price: 11230, yield: 14.5, tr1y: 32.4, diffBenchmark: -18.2, country: 'US', index: 'Nasdaq100', theme: '고성장', issuer: '삼성자산운용', aum: '8천억', ter: '0.45%', launchDate: '2024-01-15', distFreq: '월분배' },
    { id: 3, name: "TIGER 200커버드콜ATM", ticker: "289480", price: 8900, yield: 8.5, tr1y: 5.2, diffBenchmark: +1.2, country: 'KR', index: 'KOSPI200', theme: '옵션프리미엄', issuer: '미래에셋자산운용', aum: '3천억', ter: '0.30%', launchDate: '2018-05-10', distFreq: '월분배' },
    { id: 4, name: "ACE 미국나스닥100데일리커버드콜", ticker: "000000", price: 9800, yield: 12.1, tr1y: 25.4, diffBenchmark: -11.5, country: 'US', index: 'Nasdaq100', theme: '고성장', issuer: '한국투자신탁운용', aum: '4천억', ter: '0.40%', launchDate: '2023-11-20', distFreq: '월분배' },
    { id: 5, name: "KBSTAR 200고배당커버드콜ATM", ticker: "123456", price: 10100, yield: 9.8, tr1y: 7.5, diffBenchmark: -0.5, country: 'KR', index: 'KOSPI200', theme: '고배당', issuer: 'KB자산운용', aum: '1천5백억', ter: '0.35%', launchDate: '2019-10-15', distFreq: '월분배' },
];

// Mock Chart Data for Modal
const generateMockChartData = (period: string) => {
    const data = [];
    let ccBase = 100;
    let bmBase = 100;
    const days = period === '1M' ? 30 : period === '3M' ? 90 : period === 'YTD' ? 120 : 365;

    for (let i = days; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);

        // Random walk, BM is more volatile, CC is less volatile but drags over time (opportunity cost)
        const dayVolatility = Math.random() * 2 - 0.9;
        bmBase = bmBase * (1 + dayVolatility / 100);

        // CC captures less upside, more downside limit
        let ccVolatility = dayVolatility;
        if (dayVolatility > 0) ccVolatility = dayVolatility * 0.4; // Upside capped
        // Distribute monthly (approx every 30 days)
        if (i % 30 === 0) ccVolatility += 1.0; // Dividend reinvestment bump

        ccBase = ccBase * (1 + ccVolatility / 100);

        data.push({
            date: d.toISOString().split('T')[0].substring(5).replace('-', '/'),
            ccTotalReturn: Number((ccBase - 100).toFixed(2)),
            bmTotalReturn: Number((bmBase - 100).toFixed(2))
        });
    }
    return data;
};

export default function CoveredCallTab() {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCountry, setSelectedCountry] = useState('All');
    const [selectedDetail, setSelectedDetail] = useState<any>(null);
    const [chartPeriod, setChartPeriod] = useState('1Y');
    const [realChartData, setRealChartData] = useState<any[]>([]);
    const [isLoadingData, setIsLoadingData] = useState(false);
    const [apiError, setApiError] = useState<string | null>(null);

    // For storing real stats mapped by ticker
    const [realStats, setRealStats] = useState<any>({});

    useEffect(() => {
        const fetchRealStats = async () => {
            try {
                // Here we fetch the list. To avoid too many calls, only doing it once.
                // S&P500TR and Nasdaq are common.
                // We'll map S&P500/Dow to SP500TR, Nasdaq to NDX or QQQ proxy.
                const response = await fetch('http://localhost:8000/api/v1/covered-calls/analyze', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        fund_symbols: ['JEPI', 'JEPQ', 'DIVO', 'SPYI', 'QYLD'],
                        benchmark_symbol: '^SP500TR',
                        period: '1y'
                    })
                });
                if (response.ok) {
                    const data = await response.json();
                    const statsMap: any = {};
                    if (data.results) {
                        data.results.forEach((r: any) => {
                            statsMap[r.ticker] = r;
                        });
                    }
                    setRealStats(statsMap);
                }
            } catch (e) {
                console.error(e);
            }
        };
        // We comment this out for now until mapping is complete
        // fetchRealStats();
    }, []);

    useEffect(() => {
        if (!selectedDetail) return;

        setRealChartData([]); // clear old data before fetching new ones
        setApiError(null);

        const fetchChart = async () => {
            setIsLoadingData(true);
            try {
                let tickerQuery = selectedDetail.ticker;
                let bmQuery = selectedDetail.index;

                // Map UI period to yfinance period
                let yfPeriod = '1y';
                if (chartPeriod === '1M') yfPeriod = '1mo';
                else if (chartPeriod === '3M') yfPeriod = '3mo';
                else if (chartPeriod === 'YTD') yfPeriod = 'ytd';
                else if (chartPeriod === '1Y') yfPeriod = '1y';

                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 15000); // increased to 15s timeout

                try {
                    const payload = {
                        fund_symbols: [tickerQuery],
                        benchmark_symbol: bmQuery,
                        period: yfPeriod
                    };

                    const [chartRes, analyzeRes] = await Promise.all([
                        fetch('http://localhost:8000/api/v1/covered-calls/chart', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(payload),
                            signal: controller.signal
                        }),
                        fetch('http://localhost:8000/api/v1/covered-calls/analyze', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(payload),
                            signal: controller.signal
                        })
                    ]);

                    clearTimeout(timeoutId);

                    let success = false;
                    if (chartRes.ok) {
                        const data = await chartRes.json();
                        if (data.chart_data && data.chart_data.length > 0) {
                            const formatted = data.chart_data.map((d: any) => ({
                                date: d.date,
                                bmTotalReturn: d.Benchmark,
                                ccTotalReturn: d[tickerQuery]
                            }));
                            setRealChartData(formatted);
                            success = true;
                        }
                    }

                    if (analyzeRes.ok) {
                        const analyzeData = await analyzeRes.json();
                        if (analyzeData.results && analyzeData.results.length > 0) {
                            setRealStats(analyzeData.results[0]);
                        }
                    }

                    if (success) {
                        setIsLoadingData(false);
                        return;
                    } else {
                        setApiError("해당 종목 또는 벤치마크 지수의 데이터를 서버에서 불러오지 못했습니다. (상장폐지 또는 데이터 부족)");
                    }
                } catch (fetchError: any) {
                    console.error("Fetch API timeout or network error:", fetchError);
                    if (fetchError.name === 'AbortError') {
                        setApiError("서버 응답이 15초를 초과하여 데이터를 불러오지 못했습니다.");
                    } else {
                        setApiError("서버 연결에 실패했습니다.");
                    }
                }

                setRealStats(null); // Clear real stats so UI uses defaults
            } catch (e) {
                console.error("API error", e);
                setApiError("알 수 없는 오류가 발생했습니다.");
            } finally {
                setIsLoadingData(false);
            }
        };
        fetchChart();
    }, [selectedDetail, chartPeriod]);

    const filteredData = mockCCData.filter(item => {
        const matchSearch = item.name.includes(searchTerm) || item.ticker.includes(searchTerm) || item.issuer.includes(searchTerm);
        const matchCountry = selectedCountry === 'All' || item.country === selectedCountry;
        return matchSearch && matchCountry;
    });

    const formatRate = (rate: number) => {
        const sign = rate > 0 ? '+' : '';
        const color = rate > 0 ? 'text-rose-400' : rate < 0 ? 'text-blue-400' : 'text-gray-400';
        return <span className={`font-bold ${color}`}>{sign}{rate.toFixed(2)}%</span>;
    };

    return (
        <div className="w-full flex justify-center animate-in fade-in slide-in-from-bottom-2 duration-500 mt-2">
            <div className="relative w-full bg-[#121217]/80 p-5 lg:p-8 border border-white/10 rounded-3xl backdrop-blur-3xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] min-h-[700px]">

                {/* Header & Description */}
                <div className="mb-6 border-b border-white/10 pb-6">
                    <h2 className="text-2xl font-extrabold text-white mb-2 flex items-center gap-3">
                        <Activity className="w-6 h-6 text-indigo-400" />
                        커버드콜 (Covered Call) 상품 비교 분석
                    </h2>
                    <p className="text-sm text-gray-400">
                        기초 지수와의 수익률 차이(괴리)와 TR(분배금 재투자) 기준 실질 성과를 비교하여 최적의 인컴형 ETF를 발굴하세요.
                    </p>
                </div>

                {/* Search & Filters */}
                <div className="flex flex-col md:flex-row gap-4 mb-6">
                    <div className="relative flex-1">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="종목명, 티커, 운용사 검색..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-11 pr-4 py-3 bg-black/40 border border-white/10 rounded-xl focus:ring-1 focus:ring-indigo-500/50 outline-none text-sm text-white transition-all shadow-inner"
                        />
                    </div>
                    <div className="flex gap-2">
                        {['All', 'US', 'KR'].map(c => (
                            <button
                                key={c}
                                onClick={() => setSelectedCountry(c)}
                                className={`px-4 py-2 rounded-xl text-sm font-bold border transition-colors ${selectedCountry === c
                                    ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/50'
                                    : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10'
                                    }`}
                            >
                                {c === 'All' ? '전체 국가' : c === 'US' ? '미국 지수' : '한국 지수'}
                            </button>
                        ))}
                        <button className="px-4 py-2 bg-white/5 text-gray-400 border border-white/10 rounded-xl text-sm font-medium hover:bg-white/10 flex items-center gap-2">
                            <Filter className="w-4 h-4" /> 상세 필터
                        </button>
                    </div>
                </div>

                {/* Data Table */}
                <div className="bg-black/20 border border-white/5 rounded-2xl overflow-hidden shadow-xl">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse whitespace-nowrap min-w-[900px]">
                            <thead className="bg-[#09090b] border-b border-white/10">
                                <tr className="text-xs font-semibold text-gray-400 text-center tracking-wider">
                                    <th className="py-4 px-4 text-left">종목명 / 티커</th>
                                    <th className="py-4 px-3">분류/테마</th>
                                    <th className="py-4 px-3 text-right">현재가</th>
                                    <th className="py-4 px-3 bg-emerald-500/10 text-emerald-400/80">분배율(%)</th>
                                    <th className="py-4 px-3 bg-indigo-500/10 text-indigo-400/80">1년 수익률(TR)</th>
                                    <th className="py-4 px-4 bg-rose-500/10 text-rose-400/80 rounded-tr-2xl">벤치마크 대비 차이(1Y)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5 text-sm">
                                {filteredData.map(item => (
                                    <tr
                                        key={item.id}
                                        onClick={() => setSelectedDetail(item)}
                                        className="hover:bg-white/[0.04] transition-colors cursor-pointer group"
                                    >
                                        <td className="py-4 px-4">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-gray-100 group-hover:text-indigo-300 transition-colors">{item.name}</span>
                                                <span className="text-xs text-gray-500 font-mono mt-0.5">{item.ticker} | {item.issuer}</span>
                                            </div>
                                        </td>
                                        <td className="py-4 px-3 text-center">
                                            <div className="flex flex-col gap-1 items-center justify-center">
                                                <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded text-gray-300">{item.country === 'US' ? '🇺🇸 미국' : '🇰🇷 한국'}</span>
                                                <span className="text-[10px] text-gray-400">{item.theme}</span>
                                            </div>
                                        </td>
                                        <td className="py-4 px-3 text-right font-mono font-medium text-gray-300">
                                            {item.price.toLocaleString()}원
                                        </td>
                                        <td className="py-4 px-3 text-center font-bold text-emerald-400 bg-emerald-500/[0.02]">
                                            {item.yield.toFixed(1)}%
                                        </td>
                                        <td className="py-4 px-3 text-center bg-indigo-500/[0.02]">
                                            {formatRate(item.tr1y)}
                                        </td>
                                        <td className="py-4 px-4 text-center bg-rose-500/[0.02]">
                                            <div className="flex items-center justify-center gap-1.5">
                                                {formatRate(item.diffBenchmark)}
                                                <span className="relative group/tooltip flex items-center justify-center">
                                                    <Info className="w-3.5 h-3.5 text-gray-500 cursor-help" />
                                                    <span className="absolute bottom-full mb-2 -left-10 w-48 bg-gray-900 border border-white/10 text-[10px] p-2 rounded-lg opacity-0 group-hover/tooltip:opacity-100 transition-opacity pointer-events-none z-10 font-normal text-left shadow-xl break-words whitespace-normal text-gray-300 leading-tight">
                                                        기초 지수(TR) 대비 커버드콜 상품의 1년 성과 차이입니다. 지수 상승분 포기로 인해 주로 음수(-)를 기록합니다.
                                                    </span>
                                                </span>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {filteredData.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="py-12 text-center text-gray-500">검색 결과가 없습니다.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Overlay Modal */}
                {selectedDetail && (
                    <div className="absolute top-0 inset-x-0 bottom-0 z-[300] flex animate-in fade-in duration-200 bg-black/40 backdrop-blur-md rounded-3xl p-2 md:p-6">
                        <div className="bg-[#0B0F19] border border-white/10 w-full h-full rounded-2xl shadow-2xl shadow-indigo-500/10 flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">

                            {/* Modal Header */}
                            <div className="px-5 py-3 border-b border-white/5 flex gap-4 justify-between items-center bg-gradient-to-r from-indigo-500/10 to-transparent shrink-0">
                                <div className="flex flex-wrap items-center gap-2 md:gap-3 w-full">
                                    <span className="px-2 py-0.5 text-[10px] font-bold bg-white/10 text-white rounded-md">{selectedDetail.issuer}</span>
                                    <span className="px-2 py-0.5 text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-md">기초지수: {selectedDetail.index}</span>
                                    <span className="font-mono flex items-center bg-[#1e1e23] border border-white/10 rounded overflow-hidden">
                                        <span className="px-2 py-0.5 text-[10px] bg-indigo-600/30 text-indigo-300 font-bold">TICKER</span>
                                        <span className="px-2 py-0.5 text-[11px] text-gray-300 font-bold">{selectedDetail.ticker}</span>
                                    </span>
                                    <h3 className="text-xl md:text-2xl font-extrabold text-white truncate max-w-[200px] sm:max-w-2xl">{selectedDetail.name}</h3>
                                </div>
                                <button onClick={() => setSelectedDetail(null)} className="p-1.5 bg-white/5 hover:bg-rose-500/20 hover:text-rose-400 rounded-full text-gray-400 transition-colors shrink-0">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="overflow-y-auto px-5 py-4 flex-1 custom-scrollbar">
                                {/* Summary Cards */}
                                <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-3">
                                    <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-2.5 flex flex-col justify-center items-center text-center">
                                        <span className="text-[10px] text-gray-500 mb-0.5">총보수 / AUM</span>
                                        <span className="font-bold text-gray-200 text-sm">{selectedDetail.ter} / {selectedDetail.aum.replace('억', '')}억</span>
                                    </div>
                                    <div className="bg-indigo-500/[0.05] border border-indigo-500/20 rounded-2xl p-2.5 flex flex-col justify-center items-center text-center">
                                        <span className="text-[10px] text-indigo-400 mb-0.5">ETF 수익률 ({chartPeriod})</span>
                                        <span className="font-extrabold text-indigo-300 text-base">
                                            {realStats?.tr_period !== undefined ? (realStats.tr_period > 0 ? '+' : '') + realStats.tr_period.toFixed(2) : (selectedDetail.tr1y > 0 ? '+' : '') + selectedDetail.tr1y.toFixed(2)}%
                                        </span>
                                    </div>
                                    <div className="bg-rose-500/[0.05] border border-rose-500/20 rounded-2xl p-2.5 flex flex-col justify-center items-center text-center">
                                        <span className="text-[10px] text-rose-400 mb-0.5">벤치마크 지수 ({chartPeriod} TR)</span>
                                        <span className="font-extrabold text-rose-300 text-base">
                                            {realStats?.benchmark_tr_period !== undefined ? realStats.benchmark_tr_period.toFixed(2) : ((selectedDetail.tr1y) - (selectedDetail.diffBenchmark)).toFixed(2)}%
                                        </span>
                                    </div>
                                    <div className="bg-slate-500/[0.05] border border-slate-500/20 rounded-2xl p-2.5 flex flex-col justify-center items-center text-center">
                                        <span className="text-[10px] text-slate-400 mb-0.5">초과 수익 (괴리)</span>
                                        <span className="font-extrabold text-white text-base">
                                            {realStats?.diff_benchmark_period !== undefined ? (realStats.diff_benchmark_period > 0 ? '+' : '') + realStats.diff_benchmark_period.toFixed(2) : (selectedDetail.diffBenchmark > 0 ? '+' : '') + selectedDetail.diffBenchmark.toFixed(2)}%
                                        </span>
                                    </div>
                                    <div className="bg-emerald-500/[0.05] border border-emerald-500/20 rounded-2xl p-2.5 flex flex-col justify-center items-center text-center">
                                        <span className="text-[10px] text-emerald-500/70 mb-0.5 flex items-center gap-1 justify-center"><BarChart3 className="w-3 h-3" /> 연환산 분배율</span>
                                        <span className="font-extrabold text-emerald-400 text-base">{selectedDetail.yield.toFixed(1)}%</span>
                                    </div>
                                </div>

                                {/* Chart Area */}
                                <div className="bg-black/30 border border-white/5 rounded-2xl p-3 mb-3 shrink-0">
                                    <div className="flex justify-between items-center mb-2">
                                        <h4 className="font-bold text-gray-200 flex items-center gap-2">
                                            누적 수익률 (TR) 비교 차트
                                            <span className="relative group/info cursor-help">
                                                <Info className="w-4 h-4 text-indigo-400" />
                                                <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 bg-gray-900 border border-indigo-500/30 text-xs p-3 rounded-lg opacity-0 group-hover/info:opacity-100 transition-opacity pointer-events-none z-50 text-gray-300 shadow-xl leading-relaxed">
                                                    <strong className="text-white block mb-1">공정한 수익률 비교 (TR)</strong>
                                                    커버드콜과 기초 자산의 정확한 비교를 위해, 벤치마크 지수 역시 배당금이 재투자된 총수익률(Total Return) 기준으로 산출 및 표기됩니다.
                                                </span>
                                            </span>
                                        </h4>
                                        <div className="flex bg-white/5 p-1 rounded-lg">
                                            {['1M', '3M', 'YTD', '1Y'].map(pd => (
                                                <button
                                                    key={pd}
                                                    onClick={() => setChartPeriod(pd)}
                                                    className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${chartPeriod === pd ? 'bg-indigo-500 text-white shadow-md' : 'text-gray-400 hover:text-white'}`}
                                                >
                                                    {pd}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="h-[220px] sm:h-[260px] w-full relative">
                                        {isLoadingData && (
                                            <div className="absolute inset-0 bg-[#0B0F19]/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center rounded-xl border border-white/5">
                                                <Hourglass className="w-8 h-8 text-indigo-400 animate-pulse mb-3" />
                                                <span className="text-sm font-bold text-indigo-400 animate-pulse">데이터를 분석 중입니다...</span>
                                            </div>
                                        )}
                                        {apiError && !isLoadingData && (
                                            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-xl p-4 text-center">
                                                <ShieldAlert className="w-10 h-10 text-rose-500/80 mb-3" />
                                                <span className="text-sm font-bold text-rose-400 mb-1">데이터 오류</span>
                                                <span className="text-xs text-rose-400/70">{apiError}</span>
                                            </div>
                                        )}
                                        <ResponsiveContainer width="100%" height="100%" className={apiError ? "opacity-20" : ""}>
                                            <LineChart data={realChartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                                <XAxis dataKey="date" stroke="rgba(255,255,255,0.3)" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }} tickMargin={10} minTickGap={30} />
                                                <YAxis stroke="rgba(255,255,255,0.3)" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }} tickFormatter={(val) => `${val}%`} />
                                                <RechartsTooltip
                                                    contentStyle={{ backgroundColor: 'rgba(12,10,24,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '12px' }}
                                                    itemStyle={{ fontWeight: 600 }}
                                                    labelStyle={{ color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}
                                                    formatter={(val: number) => [`${val}%`, '']}
                                                />
                                                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} iconType="circle" />
                                                <Line type="monotone" name={`${selectedDetail.name} (TR)`} dataKey="ccTotalReturn" stroke="#818cf8" strokeWidth={3} dot={false} activeDot={{ r: 4 }} connectNulls={false} />
                                                <Line type="monotone" name={`${selectedDetail.index} 지수 (TR)`} dataKey="bmTotalReturn" stroke="#f43f5e" strokeWidth={2} strokeDasharray="5 5" dot={false} connectNulls={false} />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>

                                {/* Capture Ratios */}
                                <div>
                                    <h4 className="font-bold text-gray-200 mb-3 flex items-center gap-2">
                                        <ShieldAlert className="w-5 h-5 text-amber-500" />
                                        민감도 지표 (Capture Ratios)
                                    </h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div className="bg-gradient-to-br from-indigo-500/10 to-transparent border border-indigo-500/20 rounded-2xl p-3">
                                            <div className="flex justify-between items-end mb-2">
                                                <span className="text-sm font-medium text-indigo-300 flex items-center gap-1">상승장 참여율 (Upside) {realStats?.upside_capture !== undefined ? <span className="bg-indigo-500/30 text-indigo-200 text-[9px] px-1.5 py-0.5 rounded ml-1">REAL DATA</span> : null}</span>
                                                <span className="text-2xl font-black text-white">{realStats?.upside_capture !== undefined ? realStats.upside_capture.toFixed(1) : '45.0'}%</span>
                                            </div>
                                            <p className="text-[11px] text-gray-400">지수가 상승할 때, 콜옵션 매도로 인해 상승분의 {realStats?.upside_capture !== undefined ? realStats.upside_capture.toFixed(1) : '45.0'}% 수준만 추종하는 경향이 있습니다.</p>
                                        </div>
                                        <div className="bg-gradient-to-br from-blue-500/10 to-transparent border border-blue-500/20 rounded-2xl p-3">
                                            <div className="flex justify-between items-end mb-1">
                                                <span className="text-sm font-medium text-blue-300 flex items-center gap-1">하락장 방어율 (Downside) {realStats?.downside_capture !== undefined ? <span className="bg-blue-500/30 text-blue-200 text-[9px] px-1.5 py-0.5 rounded ml-1">REAL DATA</span> : null}</span>
                                                <span className="text-2xl font-black text-white">{realStats?.downside_capture !== undefined ? realStats.downside_capture.toFixed(1) : '82.0'}%</span>
                                            </div>
                                            <p className="text-[11px] text-gray-400">지수가 하락할 때, 프리미엄 수익으로 인해 {realStats?.downside_capture !== undefined ? realStats.downside_capture.toFixed(1) : '82.0'}% 변동성으로 상대적 방어력을 보입니다.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
