"use client";

import React, { useState, useEffect } from 'react';
import { Search, Filter, TrendingUp, TrendingDown, X, Info, ShieldAlert, BarChart3, Activity, Hourglass, Check, Plus, Star, Bookmark, Save, Download, Trash2 } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ScatterChart, Scatter, ZAxis, ReferenceLine } from 'recharts';

// Benchmark Options for Users to Select
export const BENCHMARK_OPTIONS = [
    { label: 'S&P 500 (TR)', symbol: '^SP500TR' },
    { label: '나스닥 100 (NDX)', symbol: '^NDX' },
    { label: '다우존스 미국 배당 100', symbol: 'SCHD' },
    { label: '코스피 200 (TR)', symbol: '^KS200' },
    { label: '골드 (GLD)', symbol: 'GLD' },
    { label: '은 (SLV)', symbol: 'SLV' },
    { label: '미국채 20년+ (TLT)', symbol: 'TLT' }
];

// Mock Data template for dynamically added ETFs
const createETFEntry = (etf: any, id: number) => {
    let indexName = '코스피 200 (TR)';
    let indexTicker = '^KS200';
    let country = 'KR';
    const n = etf.name.toLowerCase();

    // Specific match Priority
    if (n.includes('국채') || n.includes('장기채') || n.includes('tlt') || n.includes('만기')) { indexName = '미국채 20년+ (TLT)'; indexTicker = 'TLT'; country = 'US'; }
    else if (n.includes('200')) { indexName = '코스피 200 (TR)'; indexTicker = '^KS200'; country = 'KR'; }
    else if (n.includes('s&p') || n.includes('sp500')) { indexName = 'S&P 500 (TR)'; indexTicker = '^SP500TR'; country = 'US'; }
    else if (n.includes('나스닥') || n.includes('테크') || n.includes('빅테크') || n.includes('qyld') || n.includes('ndx')) { indexName = '나스닥 100 (NDX)'; indexTicker = '^NDX'; country = 'US'; }
    else if (n.includes('다우존스') || n.includes('배당') || n.includes('schd')) { indexName = '다우존스 미국 배당 100'; indexTicker = 'SCHD'; country = 'US'; }
    else if (n.includes('미국')) { indexName = 'S&P 500 (TR)'; indexTicker = '^SP500TR'; country = 'US'; }
    else if (n.includes('금') || n.includes('골드') || n.includes('gold')) { indexName = '골드 (GLD)'; indexTicker = 'GLD'; country = 'US'; }
    else if (n.includes('은') || n.includes('실버') || n.includes('silver')) { indexName = '은 (SLV)'; indexTicker = 'SLV'; country = 'US'; }

    return {
        id,
        name: etf.name,
        ticker: etf.code,
        price: 0,
        yield: 0,
        tr1y: 0,
        diffBenchmark: 0,
        country,
        index: indexName,
        indexTicker,
        theme: etf.name.includes('배당') ? '고배당' : '옵션프리미엄',
        issuer: etf.name.split(' ')[0],
        aum: '-',
        ter: '-',
        launchDate: '-',
        distFreq: '월분배',
        isLoadingMetrics: true
    };
};
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
    const [isSearchFocused, setIsSearchFocused] = useState(false);
    const [etfDictionary, setEtfDictionary] = useState<any[]>([]);
    const [ccDataList, setCcDataList] = useState<any[]>([]);

    const [selectedCountry, setSelectedCountry] = useState('All');
    const [selectedForCompare, setSelectedForCompare] = useState<any[]>([]);
    const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);
    const [chartPeriod, setChartPeriod] = useState('1Y');
    const [hoveredLine, setHoveredLine] = useState<string | null>(null);
    const [hoveredScatterItem, setHoveredScatterItem] = useState<string | null>(null);
    const [realChartData, setRealChartData] = useState<any[]>([]);
    const [isPrMap, setIsPrMap] = useState<any>({});
    const [isLoadingData, setIsLoadingData] = useState(false);
    const [apiError, setApiError] = useState<string | null>(null);

    const CustomScatterTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            return (
                <div className="bg-[#0c0a18]/95 border border-white/10 p-4 rounded-xl shadow-2xl z-50">
                    <p className="font-bold text-gray-200 mb-2">{data.name}</p>
                    <div className="flex flex-col gap-1.5">
                        <p className="text-emerald-400 text-[13px] flex justify-between gap-6"><span>상승 참여율:</span> <span className="font-mono font-bold">{data.upside}%</span></p>
                        <p className="text-blue-400 text-[13px] flex justify-between gap-6"><span>하락 참여율:</span> <span className="font-mono font-bold">{data.downside}%</span></p>
                    </div>
                </div>
            );
        }
        return null;
    };

    // Favorites States
    const [savedFavorites, setSavedFavorites] = useState<{ name: string, list: any[] }[]>([]);
    const [isFavoritesMenuOpen, setIsFavoritesMenuOpen] = useState(false);
    const [showSaveInput, setShowSaveInput] = useState(false);
    const [newGroupName, setNewGroupName] = useState('');
    const [deletingGroupIdx, setDeletingGroupIdx] = useState<number | null>(null);

    // For storing real stats mapped by ticker
    const [realStats, setRealStats] = useState<any>({});

    useEffect(() => {
        const stored = localStorage.getItem('ccFavorites');
        if (stored) {
            try {
                setSavedFavorites(JSON.parse(stored));
            } catch (e) { }
        }

        const fetchEtfs = async () => {
            const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
            try {
                const res = await fetch(`${API_BASE}/api/v1/analyze/etfs`);
                if (res.ok) {
                    const data = await res.json();
                    setEtfDictionary(data);
                }
            } catch (err) {
                console.error("ETF load error", err);
            }
        };
        fetchEtfs();
    }, []);

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

    // Metric Fetching via Real API for Table Rows
    useEffect(() => {
        const itemsToFetch = ccDataList.filter(item => item.isLoadingMetrics && !item.isFetching);
        if (itemsToFetch.length === 0) return;

        // Mark as fetching immediately to prevent duplicate calls
        setCcDataList(prev => prev.map(item => itemsToFetch.some(f => f.ticker === item.ticker) ? { ...item, isFetching: true } : item));

        const fetchMetrics = async () => {
            try {
                const promises = itemsToFetch.map(async (item) => {
                    const payload = {
                        fund_symbols: [item.ticker],
                        benchmark_symbol: item.indexTicker || '^KS200',
                        period: '1y'
                    };
                    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/v1/covered-calls/analyze`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                    const data = res.ok ? await res.json() : null;
                    return { ticker: item.ticker, result: data?.results?.[0] };
                });

                const results = await Promise.all(promises);

                setCcDataList(prev => prev.map(item => {
                    const match = results.find(r => r.ticker === item.ticker);
                    if (match && match.result && !match.result.error) {
                        return {
                            ...item,
                            isLoadingMetrics: false,
                            isFetching: false,
                            price: Math.floor(Math.random() * 5000) + 8000, // Still mock price for now until real-time proxy
                            yield: (Math.random() * 5) + 5, // Still mock yield
                            tr1y: match.result.tr_period,
                            diffBenchmark: match.result.diff_benchmark_period,
                            benchTr: match.result.benchmark_tr_period,
                            benchPr: match.result.benchmark_pr_period,
                            isPr: match.result.is_pr
                        };
                    } else if (match) {
                        return {
                            ...item,
                            isLoadingMetrics: false,
                            isFetching: false,
                            price: 0,
                            yield: 0,
                            tr1y: 0,
                            diffBenchmark: 0,
                            benchTr: 0,
                            benchPr: 0,
                            isPr: false
                        };
                    }
                    return item;
                }));
            } catch (e) {
                console.error("Failed to fetch table metrics:", e);
                setCcDataList(prev => prev.map(item => itemsToFetch.some(f => f.ticker === item.ticker) ? { ...item, isLoadingMetrics: false, isFetching: false } : item));
            }
        };

        fetchMetrics();
    }, [ccDataList]);

    useEffect(() => {
        if (!isCompareModalOpen || selectedForCompare.length === 0) return;

        setRealChartData([]); // clear old data before fetching new ones
        setApiError(null);

        const fetchChart = async () => {
            setIsLoadingData(true);
            try {
                // Map UI period to yfinance period
                let yfPeriod = '1y';
                if (chartPeriod === '1M') yfPeriod = '1mo';
                else if (chartPeriod === '3M') yfPeriod = '3mo';
                else if (chartPeriod === '6M') yfPeriod = '6mo';
                else if (chartPeriod === 'YTD') yfPeriod = 'ytd';
                else if (chartPeriod === '1Y') yfPeriod = '1y';

                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 15000); // increased to 15s timeout

                try {
                    const promises = selectedForCompare.map(async (item) => {
                        const payload = {
                            fund_symbols: [item.ticker],
                            benchmark_symbol: item.indexTicker || '^SP500TR',
                            period: yfPeriod
                        };

                        const [chartRes, analyzeRes] = await Promise.all([
                            fetch('http://localhost:8000/api/v1/covered-calls/chart', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(payload),
                                signal: controller.signal
                            }).then(r => r.ok ? r.json() : null).catch(() => null),
                            fetch('http://localhost:8000/api/v1/covered-calls/analyze', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(payload),
                                signal: controller.signal
                            }).then(r => r.ok ? r.json() : null).catch(() => null)
                        ]);

                        return { ticker: item.ticker, chartData: chartRes?.chart_data, analyzeData: analyzeRes?.results?.[0], isPrMapPart: chartRes?.is_pr_map };
                    });

                    const results = await Promise.all(promises);
                    clearTimeout(timeoutId);

                    let combinedChartMap: any = {};
                    let statsMap: any = {};
                    let success = false;
                    let newIsPrMap: any = {};

                    results.forEach((res) => {
                        if (res.analyzeData) {
                            statsMap[res.ticker] = res.analyzeData;
                        }
                        if (res.isPrMapPart) {
                            Object.assign(newIsPrMap, res.isPrMapPart);
                        }
                        if (res.chartData) {
                            success = true;
                            res.chartData.forEach((d: any) => {
                                if (!combinedChartMap[d.date]) combinedChartMap[d.date] = { date: d.date, originalIndex: Object.keys(combinedChartMap).length };
                                combinedChartMap[d.date][res.ticker] = d[res.ticker];
                                if (res.ticker === selectedForCompare[0].ticker) {
                                    combinedChartMap[d.date]['Benchmark'] = d.Benchmark;
                                }
                            });
                        }
                    });

                    const finalChartData = Object.values(combinedChartMap).sort((a: any, b: any) => a.originalIndex - b.originalIndex);

                    if (success) {
                        setRealChartData(finalChartData);
                        setRealStats(statsMap);
                        setIsPrMap(newIsPrMap); // Store the is_pr map
                        setIsLoadingData(false);
                        return;
                    } else {
                        setApiError("해당 종목 데이터를 서버에서 불러오지 못했습니다. (상장폐지 또는 데이터 부족)");
                    }
                } catch (fetchError: any) {
                    console.error("Fetch API timeout or network error:", fetchError);
                    if (fetchError.name === 'AbortError') {
                        setApiError("서버 응답이 15초를 초과하여 데이터를 불러오지 못했습니다.");
                    } else {
                        setApiError("서버 연결에 실패했습니다.");
                    }
                }

                setRealStats({}); // Clear real stats so UI uses defaults
            } catch (e) {
                console.error("API error", e);
                setApiError("알 수 없는 오류가 발생했습니다.");
            } finally {
                setIsLoadingData(false);
            }
        };
        fetchChart();
    }, [isCompareModalOpen, chartPeriod]);

    const [selectedDropdownItems, setSelectedDropdownItems] = useState<any[]>([]);
    const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
    const BRAND_KEYWORDS = ['KODEX', 'TIGER', 'KBSTAR', 'ACE', 'SOL', 'HANARO', 'ARIRANG', 'KOSEF'];

    const filteredDropdown = etfDictionary.filter(etf => {
        if (!etf.name.includes('커버드콜') && !etf.name.includes('프리미엄') && !etf.name.includes('타겟')) return false;
        if (ccDataList.some((item: any) => item.ticker === etf.code)) return false;

        const matchSearch = etf.name.toLowerCase().includes(searchTerm.toLowerCase()) || etf.code.toLowerCase().includes(searchTerm.toLowerCase());
        const matchBrand = selectedBrands.length === 0 || selectedBrands.some(brand => etf.name.includes(brand));
        return matchSearch && matchBrand;
    });

    const filteredData = ccDataList.filter((item: any) => {
        const matchSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) || item.ticker.includes(searchTerm);
        const matchCountry = selectedCountry === 'All' ? true : item.country === selectedCountry;
        return matchSearch && matchCountry;
    });

    const handleToggleDropdownItem = (etf: any) => {
        setSelectedDropdownItems(prev => {
            if (prev.some(item => item.code === etf.code)) {
                return prev.filter(item => item.code !== etf.code);
            } else {
                if (prev.length >= 10) return prev; // Limit to 10
                return [...prev, etf];
            }
        });
    };

    const handleConfirmAdd = () => {
        if (selectedDropdownItems.length === 0) return;
        const newEntries = selectedDropdownItems.map((etf, idx) => createETFEntry(etf, ccDataList.length + idx + 1));
        setCcDataList(prev => [...prev, ...newEntries]);
        setSelectedDropdownItems([]);
        setSearchTerm('');
        setIsSearchFocused(false);
    };

    const handleRemoveEtf = (idToRemove: number) => {
        setCcDataList(prev => prev.filter(item => item.id !== idToRemove));
        setSelectedForCompare(prev => prev.filter(item => item.id !== idToRemove));
    };

    const handleToggleCompareToggle = (item: any) => {
        setSelectedForCompare(prev => {
            if (prev.find(x => x.id === item.id)) return prev.filter(x => x.id !== item.id);
            return [...prev, item];
        });
    };

    const handleUpdateBenchmark = (id: number, newTicker: string) => {
        const option = BENCHMARK_OPTIONS.find(o => o.symbol === newTicker);
        if (option) {
            // Determine country based on selected benchmark for accurate flag display
            const isKorea = newTicker === '^KS200';
            setCcDataList(prev => prev.map(item => item.id === id ? { ...item, indexTicker: option.symbol, index: option.label, country: isKorea ? 'KR' : 'US' } : item));
        }
    };

    const formatRate = (rate: number) => {
        const sign = rate > 0 ? '+' : '';
        const color = rate > 0 ? 'text-rose-400' : rate < 0 ? 'text-blue-400' : 'text-gray-400';
        return <span className={`font-bold ${color}`}>{sign}{rate.toFixed(2)}%</span>;
    };

    const handleSaveFavoriteGroup = () => {
        if (ccDataList.length === 0) return alert('저장할 종목이 목록에 없습니다. 종목을 추가한 후 시도하세요.');
        if (!newGroupName.trim()) return alert('그룹 이름을 입력하세요.');

        const newGroups = [...savedFavorites, { name: newGroupName.trim(), list: ccDataList.map(item => ({ ...item, isLoadingMetrics: true })) }];
        setSavedFavorites(newGroups);
        localStorage.setItem('ccFavorites', JSON.stringify(newGroups));
        setNewGroupName('');
        setShowSaveInput(false);
        setIsFavoritesMenuOpen(false);
    };

    const handleLoadFavoriteGroup = (group: { name: string, list: any[] }) => {
        setCcDataList(group.list);
        setIsFavoritesMenuOpen(false);
    };

    const handleDeleteFavoriteGroup = (idx: number) => {
        const newGroups = savedFavorites.filter((_, i) => i !== idx);
        setSavedFavorites(newGroups);
        localStorage.setItem('ccFavorites', JSON.stringify(newGroups));
        setDeletingGroupIdx(null);
    };

    return (
        <div className="w-full animate-in fade-in slide-in-from-bottom-2 duration-500 bg-white/[0.03] p-3 lg:p-4 border border-white/10 rounded-3xl backdrop-blur-3xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] mt-0 min-h-[700px]">

            {/* Header & Description */}
            <div className="mb-4 border-b border-white/10 pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-extrabold text-white mb-2 flex items-center gap-3">
                        <Activity className="w-6 h-6 text-indigo-400" />
                        커버드콜 (Covered Call) 상품 비교 분석
                    </h2>
                    <p className="text-sm text-gray-400">
                        기초 지수와의 수익률 차이(괴리)와 TR(분배금 재투자) 기준 실질 성과를 비교하여 최적의 인컴형 ETF를 발굴하세요.
                    </p>
                </div>

                {/* Favorites Menu Button */}
                <div className="relative">
                    <button
                        onClick={() => setIsFavoritesMenuOpen(!isFavoritesMenuOpen)}
                        className="bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-4 py-2 rounded-xl flex items-center gap-2 font-bold text-sm transition-colors"
                    >
                        <Bookmark size={16} className={savedFavorites.length > 0 ? 'fill-indigo-400 text-indigo-400' : ''} />
                        나의 비교 그룹 즐겨찾기
                    </button>

                    {isFavoritesMenuOpen && (
                        <div className="absolute right-0 top-full mt-2 w-72 bg-[#121217] border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden">
                            <div className="p-3 border-b border-white/5 bg-white/[0.02]">
                                {showSaveInput ? (
                                    <div className="flex flex-col gap-2">
                                        <input
                                            type="text"
                                            placeholder="그룹 이름 입력"
                                            value={newGroupName}
                                            onChange={e => setNewGroupName(e.target.value)}
                                            className="w-full bg-black/50 border border-white/10 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                        />
                                        <div className="flex gap-2">
                                            <button onClick={handleSaveFavoriteGroup} className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white py-1.5 rounded text-xs font-bold transition-colors">저장</button>
                                            <button onClick={() => setShowSaveInput(false)} className="flex-1 bg-white/10 hover:bg-white/20 text-white py-1.5 rounded text-xs font-bold transition-colors">취소</button>
                                        </div>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => setShowSaveInput(true)}
                                        className="w-full bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-bold transition-colors"
                                    >
                                        <Save size={16} /> 현재 목록을 즐겨찾기로 저장
                                    </button>
                                )}
                            </div>
                            <div className="max-h-64 overflow-y-auto">
                                {savedFavorites.length === 0 ? (
                                    <div className="p-6 text-center text-sm text-gray-500">
                                        저장된 모델 포트폴리오(비교 그룹)가 없습니다.
                                    </div>
                                ) : (
                                    <ul className="divide-y divide-white/5">
                                        {savedFavorites.map((group, idx) => (
                                            <li key={idx} className="flex justify-between items-center px-4 py-3 hover:bg-white/5 cursor-pointer group" onClick={() => handleLoadFavoriteGroup(group)}>
                                                <div>
                                                    <div className="text-gray-200 font-bold text-sm mb-0.5 group-hover:text-indigo-300 flex items-center gap-1.5">
                                                        <Star size={12} className="text-yellow-500 fill-yellow-500/30" />
                                                        {group.name}
                                                    </div>
                                                    <div className="text-xs text-gray-500">포함 종목: {group.list.length}개</div>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    {deletingGroupIdx === idx ? (
                                                        <div className="flex items-center gap-1.5 mr-2">
                                                            <span className="text-[10px] text-rose-400 font-bold">삭제할까요?</span>
                                                            <button onClick={(e) => { e.stopPropagation(); handleDeleteFavoriteGroup(idx); }} className="px-2 py-1 bg-rose-500 hover:bg-rose-400 text-white text-[10px] font-bold rounded">예</button>
                                                            <button onClick={(e) => { e.stopPropagation(); setDeletingGroupIdx(null); }} className="px-2 py-1 bg-white/10 hover:bg-white/20 text-gray-300 text-[10px] font-bold rounded">아니오</button>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleLoadFavoriteGroup(group); }}
                                                                className="p-1.5 text-indigo-400 hover:bg-indigo-500/20 rounded-md"
                                                                title="이 그룹 불러오기"
                                                            >
                                                                <Download size={14} />
                                                            </button>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); setDeletingGroupIdx(idx); }}
                                                                className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-md"
                                                                title="삭제"
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </div>
                    )}
                    {isFavoritesMenuOpen && (
                        <div className="fixed inset-0 z-40" onClick={() => setIsFavoritesMenuOpen(false)} />
                    )}
                </div>
            </div>

            {/* Search & Filters */}
            <div className="flex flex-col md:flex-row gap-4 mb-4">
                <div className="relative flex-1 group">

                    {/* Quick Filters for Brands */}
                    <div className="flex flex-wrap gap-x-2 gap-y-2 mb-3 items-center">
                        <span className="text-xs text-gray-400 font-semibold mr-1">운용사 복수선택</span>
                        {BRAND_KEYWORDS.map(brand => (
                            <button
                                key={brand}
                                onClick={() => setSelectedBrands(prev => prev.includes(brand) ? prev.filter(b => b !== brand) : [...prev, brand])}
                                className={`text-xs px-2.5 py-1 rounded-full border transition-all ${selectedBrands.includes(brand) ? 'bg-sky-500/20 border-sky-400/50 text-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.2)]' : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-gray-300'}`}
                            >
                                {brand}
                            </button>
                        ))}
                    </div>

                    <div className="relative z-50">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="커버드콜 종목 검색 및 추가 (이름 또는 코드)"
                            value={searchTerm}
                            onFocus={() => setIsSearchFocused(true)}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-11 pr-4 py-3 bg-black/40 border border-white/10 rounded-xl focus:ring-1 focus:ring-indigo-500/50 outline-none text-sm text-white transition-all shadow-inner"
                        />
                        {isSearchFocused && (
                            <div className="absolute top-full left-0 right-0 mt-2 bg-[#121217] border border-white/10 rounded-xl shadow-2xl overflow-y-auto max-h-[400px]">
                                <div className="sticky top-0 bg-[#121217]/95 backdrop-blur-md p-2 border-b border-white/10 flex justify-between items-center z-10">
                                    <span className="text-xs text-gray-400 font-medium px-2">
                                        검색 결과 ({filteredDropdown.length}건)
                                        {selectedDropdownItems.length > 0 && <span className="ml-2 text-indigo-400">({selectedDropdownItems.length}/10 선택됨)</span>}
                                    </span>
                                    {selectedDropdownItems.length > 0 && (
                                        <button
                                            onClick={handleConfirmAdd}
                                            className="text-xs bg-indigo-500 text-white hover:bg-indigo-400 font-bold px-3 py-1.5 rounded-md transition-colors flex items-center gap-1 shadow-lg shadow-indigo-500/20"
                                        >
                                            <Plus size={12} /> 추가 완료
                                        </button>
                                    )}
                                </div>
                                {filteredDropdown.length > 0 ? (
                                    <ul>
                                        {filteredDropdown.map(etf => {
                                            const isSelected = selectedDropdownItems.some(item => item.code === etf.code);
                                            return (
                                                <li
                                                    key={etf.code}
                                                    onClick={() => handleToggleDropdownItem(etf)}
                                                    className={`px-4 py-3 cursor-pointer border-b border-white/5 last:border-0 flex justify-between items-center group transition-colors ${isSelected ? 'bg-indigo-500/10' : 'hover:bg-white/5'}`}
                                                >
                                                    <span className={`text-sm ${isSelected ? 'text-indigo-300 font-bold' : 'text-gray-200 group-hover:text-white'}`}>{etf.name}</span>
                                                    <div className="flex items-center gap-3">
                                                        <span className={`text-xs font-mono transition-colors ${isSelected ? 'text-indigo-400' : 'text-gray-500'}`}>{etf.code}</span>
                                                        {isSelected && <Check size={16} className="text-indigo-400" />}
                                                    </div>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                ) : (
                                    <div className="px-4 py-8 text-sm text-gray-500 text-center">검색 결과가 없습니다.</div>
                                )}
                            </div>
                        )}
                    </div>
                    {isSearchFocused && (
                        <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setIsSearchFocused(false)} />
                    )}
                </div>
                {/* Keep z-index higher relative to dropdowns */}
                <div className="flex gap-2 relative z-10">
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
                    <button onClick={() => { setCcDataList([]); setSelectedForCompare([]); }} className="px-4 py-2 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-xl text-sm font-medium hover:bg-rose-500/20 flex items-center gap-2">
                        <Trash2 className="w-4 h-4" /> 전체 삭제
                    </button>
                    <button className="px-4 py-2 bg-white/5 text-gray-400 border border-white/10 rounded-xl text-sm font-medium hover:bg-white/10 flex items-center gap-2">
                        <Filter className="w-4 h-4" /> 상세 필터
                    </button>
                </div>
            </div>

            {/* Data Table */}
            <div className="bg-black/20 border border-white/5 rounded-2xl overflow-hidden shadow-xl mb-4">
                <div className="overflow-x-auto pb-4">
                    <table className="w-full text-left border-collapse whitespace-nowrap min-w-[900px]">
                        <thead className="bg-[#09090b] border-b border-white/10">
                            <tr className="text-xs font-semibold text-gray-400 text-center tracking-wider hover:bg-white/[0.02]">
                                <th className="py-2 px-4 w-12 text-center relative">
                                    <div className="w-5 h-5 mx-auto rounded border flex items-center justify-center transition-colors cursor-pointer border-gray-500 hover:border-indigo-400" onClick={() => {
                                        if (selectedForCompare.length === filteredData.length && filteredData.length > 0) setSelectedForCompare([]);
                                        else setSelectedForCompare([...filteredData]);
                                    }}>
                                        {selectedForCompare.length > 0 && selectedForCompare.length === filteredData.length && <Check size={14} className="text-indigo-400" strokeWidth={3} />}
                                        {selectedForCompare.length > 0 && selectedForCompare.length !== filteredData.length && <div className="w-2.5 h-0.5 bg-indigo-400 rounded-full" />}
                                    </div>
                                </th>
                                <th className="py-2 px-4 text-left">종목명 / 티커</th>
                                <th className="py-2 px-3 w-40">분류 / 기초지수</th>
                                <th className="py-2 px-3 text-right">현재가</th>
                                <th className="py-2 px-3 bg-emerald-500/10 text-emerald-400/80">분배율(%)</th>
                                <th className="py-2 px-3 bg-indigo-500/10 text-indigo-400/80">종목 수익률(1Y)</th>
                                <th className="py-2 px-3 bg-fuchsia-500/10 text-fuchsia-400/80">벤치마크(1Y)</th>
                                <th className="py-2 px-4 bg-rose-500/10 text-rose-400/80">초과 수익(괴리)</th>
                                <th className="py-2 px-2 w-10 text-center rounded-tr-2xl"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-sm">
                            {filteredData.map(item => {
                                const isSelected = selectedForCompare.some(x => x.id === item.id);
                                return (
                                    <tr
                                        key={item.id}
                                        onClick={() => handleToggleCompareToggle(item)}
                                        className={`transition-colors cursor-pointer group ${isSelected ? 'bg-indigo-500/10' : 'hover:bg-white/[0.04]'}`}
                                    >
                                        <td className="py-2 px-4 text-center">
                                            <div className={`w-5 h-5 mx-auto rounded border flex items-center justify-center transition-colors ${isSelected ? 'bg-indigo-500 border-indigo-500 text-white' : 'border-gray-500'} `}>
                                                {isSelected && <Check size={14} strokeWidth={3} />}
                                            </div>
                                        </td>
                                        <td className="py-2 px-4">
                                            <div className="flex flex-col">
                                                <span className={`font-bold transition-colors ${isSelected ? 'text-indigo-300' : 'text-gray-100 group-hover:text-indigo-300'}`}>{item.name}</span>
                                                <span className="text-xs text-gray-500 font-mono mt-0.5">{item.ticker} | {item.issuer}</span>
                                            </div>
                                        </td>
                                        <td className="py-2 px-3 text-center w-40">
                                            <div className="flex flex-col gap-1 items-center justify-center relative z-10">
                                                <div className="flex gap-1 justify-center">
                                                    <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded text-gray-300 whitespace-nowrap">{item.country === 'US' ? '🇺🇸 미국' : '🇰🇷 한국'}</span>
                                                    <span className="text-[10px] text-gray-400 bg-black/40 px-2 py-0.5 rounded whitespace-nowrap">{item.theme}</span>
                                                </div>
                                                <select
                                                    value={item.indexTicker || '^SP500TR'}
                                                    onChange={(e) => handleUpdateBenchmark(item.id, e.target.value)}
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="bg-black/40 border border-white/20 rounded px-1.5 py-1 text-[10px] text-gray-300 w-full max-w-[140px] appearance-none focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer text-center"
                                                >
                                                    {BENCHMARK_OPTIONS.map(opt => (
                                                        <option key={opt.symbol} value={opt.symbol}>{opt.label}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </td>
                                        <td className="py-2 px-3 text-right font-mono font-medium text-gray-300">
                                            {item.isLoadingMetrics ? <span className="animate-pulse text-gray-600">로딩중...</span> : `${item.price.toLocaleString()}원`}
                                        </td>
                                        <td className="py-2 px-3 text-center font-bold text-emerald-400 bg-emerald-500/[0.02]">
                                            {item.isLoadingMetrics ? <span className="animate-pulse text-gray-600">...</span> : `${item.yield.toFixed(1)}%`}
                                        </td>
                                        <td className="py-2 px-3 text-center bg-indigo-500/[0.02]">
                                            {item.isLoadingMetrics ? <span className="animate-pulse text-gray-600">...</span> : (
                                                <div className="flex flex-col items-center">
                                                    <span>{formatRate(item.tr1y)}</span>
                                                    <span className="text-[10px] text-gray-500 font-normal">{item.isPr ? '(PR)' : '(TR)'}</span>
                                                </div>
                                            )}
                                        </td>
                                        <td className="py-2 px-3 text-center bg-fuchsia-500/[0.02]">
                                            {item.isLoadingMetrics ? <span className="animate-pulse text-gray-600">...</span> : (
                                                <div className="flex flex-col items-center">
                                                    <span>{formatRate(item.isPr ? item.benchPr : item.benchTr)}</span>
                                                    <span className="text-[10px] text-gray-500 font-normal">{item.isPr ? '벤치마크(PR)' : '벤치마크(TR)'}</span>
                                                </div>
                                            )}
                                        </td>
                                        <td className="py-2 px-4 text-center bg-rose-500/[0.02]">
                                            <div className="flex items-center justify-center gap-1.5">
                                                {item.isLoadingMetrics ? <span className="animate-pulse text-gray-600">...</span> : formatRate(item.diffBenchmark)}
                                                <span className="relative group/tooltip flex items-center justify-center">
                                                    <Info className="w-3.5 h-3.5 text-gray-500 cursor-help" />
                                                    <span className="absolute bottom-full mb-2 -left-10 w-48 bg-gray-900 border border-white/10 text-[10px] p-2 rounded-lg opacity-0 group-hover/tooltip:opacity-100 transition-opacity pointer-events-none z-10 font-normal text-left shadow-xl break-words whitespace-normal text-gray-300 leading-tight">
                                                        기초 지수(TR) 대비 커버드콜 상품의 1년 성과 차이입니다. 지수 상승분 포기로 인해 주로 음수(-)를 기록합니다.
                                                    </span>
                                                </span>
                                            </div>
                                        </td>
                                        <td className="py-2 px-2 text-center" onClick={(e) => { e.stopPropagation(); handleRemoveEtf(item.id); }}>
                                            <button className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
                                                <X size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                            {filteredData.length === 0 && (
                                <tr>
                                    <td colSpan={8} className="py-16 text-center text-gray-500">
                                        <div className="flex flex-col items-center justify-center gap-3">
                                            <Search className="w-8 h-8 text-gray-700 mb-2" />
                                            <span className="text-sm">검색창에서 커버드콜 종목을 검색하여 추가해주세요.</span>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Floating Compare Button */}
            {selectedForCompare.length > 0 && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-5">
                    <button
                        onClick={() => setIsCompareModalOpen(true)}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-3.5 rounded-full font-bold shadow-[0_10px_40px_rgba(99,102,241,0.5)] flex items-center gap-3 transition-all transform hover:scale-105"
                    >
                        <BarChart3 size={20} />
                        선택 종목 상세 비교 ({selectedForCompare.length}개)
                    </button>
                </div>
            )}

            {/* Multi-Compare Overlay Modal */}
            {isCompareModalOpen && selectedForCompare.length > 0 && (
                <div className="absolute inset-0 z-[300] flex animate-in fade-in duration-200 bg-[#0c0a18]/95 backdrop-blur-3xl p-0 m-0 rounded-3xl border border-white/10 shadow-2xl overflow-hidden">
                    <div className="w-full h-full flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">

                        {/* Modal Header */}
                        <div className="px-6 py-4 border-b border-white/5 flex justify-between items-center bg-gradient-to-r from-indigo-500/10 to-transparent shrink-0">
                            <h3 className="text-2xl font-extrabold text-white flex items-center gap-3">
                                <BarChart3 className="w-6 h-6 text-indigo-400" />
                                선택 종목 정밀 비교 분석 ({selectedForCompare.length}건)
                            </h3>
                            <button onClick={() => setIsCompareModalOpen(false)} className="p-2 bg-white/5 hover:bg-rose-500/20 hover:text-rose-400 rounded-full text-gray-400 transition-colors shrink-0">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="overflow-y-auto px-6 py-6 flex-1 custom-scrollbar flex flex-col gap-6">

                            {/* Chart Area */}
                            <div className="bg-black/30 border border-white/5 rounded-2xl p-4 shrink-0 flex flex-col">
                                <div className="flex justify-between items-center mb-4">
                                    <h4 className="font-bold text-gray-200 flex items-center gap-2">
                                        누적 수익률 (TR) 멀티 비교 차트
                                    </h4>
                                    <div className="flex bg-white/5 p-1 rounded-lg">
                                        {['1M', '3M', '6M', 'YTD', '1Y'].map(pd => (
                                            <button
                                                key={pd}
                                                onClick={() => setChartPeriod(pd)}
                                                className={`px-4 py-1.5 text-xs font-bold rounded-md transition-colors ${chartPeriod === pd ? 'bg-indigo-500 text-white shadow-md' : 'text-gray-400 hover:text-white'}`}
                                            >
                                                {pd}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="h-[300px] sm:h-[400px] w-full relative">
                                    {isLoadingData && (
                                        <div className="absolute inset-0 bg-[#0B0F19]/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center rounded-xl border border-white/5">
                                            <Hourglass className="w-8 h-8 text-indigo-400 animate-pulse mb-3" />
                                            <span className="text-sm font-bold text-indigo-400 animate-pulse">상세 데이터를 분석 중입니다...</span>
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
                                            <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} iconType="circle" onMouseEnter={(e: any) => setHoveredLine(e?.dataKey || null)} onMouseLeave={() => setHoveredLine(null)} />
                                            {/* Render main benchmark from the first item */}
                                            <Line type="monotone" name={`${selectedForCompare[0].index} (TR 기준)`} dataKey="Benchmark" stroke="#f43f5e" strokeWidth={hoveredLine === 'Benchmark' || hoveredLine !== null ? 4 : 3} strokeDasharray="5 5" dot={false} connectNulls={true} opacity={hoveredLine === 'Benchmark' ? 1.0 : (hoveredLine ? 0.8 : 1.0)} onMouseEnter={() => setHoveredLine('Benchmark')} onMouseLeave={() => setHoveredLine(null)} />

                                            {/* Render lines for each selected ETF */}
                                            {selectedForCompare.map((item, idx) => {
                                                const colors = ['#818cf8', '#34d399', '#fbbf24', '#a78bfa', '#60a5fa', '#f87171', '#34d399'];
                                                const isHovered = hoveredLine === item.ticker;
                                                const isPr = isPrMap[item.ticker] === true;
                                                return (
                                                    <Line key={item.ticker} type="monotone" name={`${item.name}${isPr ? ' (PR)' : ''}`} dataKey={item.ticker} stroke={colors[idx % colors.length]} strokeWidth={isHovered ? 5 : 2.5} opacity={hoveredLine && !isHovered ? 0.2 : 1} dot={false} activeDot={{ r: isHovered ? 6 : 4 }} connectNulls={true} onMouseEnter={() => setHoveredLine(item.ticker)} onMouseLeave={() => setHoveredLine(null)} />
                                                )
                                            })}
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* Comparison Table containing Returns and Capture Ratios */}
                            <div>
                                <h4 className="font-bold text-gray-200 mb-3 flex items-center gap-2">
                                    <ShieldAlert className="w-5 h-5 text-amber-500" />
                                    선택 종목 데이터 상세 비교
                                    {Object.keys(realStats).length > 0 && <span className="bg-indigo-500/30 text-indigo-200 text-[10px] px-2 py-0.5 rounded ml-1 font-bold">REAL DATA</span>}
                                </h4>
                                <div className="bg-white/[0.02] border border-white/5 rounded-2xl overflow-x-auto shadow-inner">
                                    <table className="w-full text-left border-collapse whitespace-nowrap min-w-[1000px]">
                                        <thead className="bg-[#09090b] border-b border-white/10">
                                            <tr className="text-[11px] font-semibold text-gray-400 text-center tracking-wider">
                                                <th className="py-3 px-4 text-left">종목명 (운용사)</th>
                                                <th className="py-3 px-3">비교 벤치마크</th>
                                                <th className="py-3 px-3 bg-indigo-500/10 text-indigo-400/80">종목 {chartPeriod} 수익률</th>
                                                <th className="py-3 px-3 bg-rose-500/10 text-rose-400/80">벤치마크 수익률(TR/PR)</th>
                                                <th className="py-3 px-3 bg-slate-500/10 text-slate-300/80">초과 수익 (괴리)</th>
                                                <th className="py-3 px-3 text-emerald-400/80">상승 참여율(Upside)</th>
                                                <th className="py-3 px-3 text-blue-400/80">하락 참여율(Downside)</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5 text-sm">
                                            {selectedForCompare.map(item => {
                                                const stats = realStats[item.ticker] || {};
                                                const trPeriod = stats.tr_period !== undefined ? stats.tr_period : item.tr1y;
                                                const bmTrPeriod = stats.benchmark_tr_period !== undefined ? stats.benchmark_tr_period : (item.tr1y - item.diffBenchmark);
                                                const diffPeriod = stats.diff_benchmark_period !== undefined ? stats.diff_benchmark_period : item.diffBenchmark;
                                                const upCap = stats.upside_capture !== undefined ? stats.upside_capture : 45.0;
                                                const downCap = stats.downside_capture !== undefined ? stats.downside_capture : 82.0;

                                                return (
                                                    <tr
                                                        key={item.ticker}
                                                        className={`transition-colors cursor-pointer ${hoveredScatterItem === item.ticker ? 'bg-white/10' : 'hover:bg-white/[0.04]'}`}
                                                        onMouseEnter={() => setHoveredScatterItem(item.ticker)}
                                                        onMouseLeave={() => setHoveredScatterItem(null)}
                                                    >
                                                        <td className="py-3 px-4 text-left">
                                                            <div className="font-bold text-gray-200 text-[13px] flex items-center gap-1.5">
                                                                {item.name}
                                                                {stats.data_insufficient && (
                                                                    <span className="relative group/warning flex items-center justify-center">
                                                                        <ShieldAlert className="w-3 h-3 text-amber-500 cursor-help" />
                                                                        <span className="absolute bottom-full mb-1 left-0 w-max max-w-xs bg-gray-900 border border-amber-500/30 text-[10px] p-2 rounded-lg opacity-0 group-hover/warning:opacity-100 transition-opacity pointer-events-none z-10 font-normal text-left shadow-xl whitespace-normal break-words text-amber-200 leading-tight">
                                                                            상장일이 최근이라 선택한 기간({chartPeriod})보다 데이터가 짧습니다. 표시된 수익률은 실제 존재하는 기간 동안만의 수익률입니다.
                                                                        </span>
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="text-[11px] text-gray-500 font-mono mt-0.5">{item.ticker} | {item.issuer}</div>
                                                        </td>
                                                        <td className="py-3 px-3 text-center">
                                                            <span className="text-[11px] font-medium bg-white/10 px-2 py-1 rounded text-gray-400">{item.index}</span>
                                                        </td>
                                                        <td className="py-3 px-3 text-center bg-indigo-500/[0.02] font-mono text-[13px] text-indigo-300 font-bold">
                                                            {(trPeriod > 0 ? '+' : '') + trPeriod.toFixed(2)}% <span className="text-[10px] text-gray-500 font-normal">{stats.is_pr ? '(PR)' : '(TR)'}</span>
                                                        </td>
                                                        <td className="py-2 px-3 text-center bg-rose-500/[0.02] font-mono text-[13px] text-rose-300">
                                                            <div className="flex flex-col items-center gap-0.5">
                                                                <span className="font-bold">{(bmTrPeriod > 0 ? '+' : '') + bmTrPeriod.toFixed(2)}% <span className="text-[10px] text-rose-500/60 font-normal">(TR)</span></span>
                                                                {stats.benchmark_pr_period !== undefined && (
                                                                    <span className="text-[11px] text-rose-300/60 font-medium">={(stats.benchmark_pr_period > 0 ? '+' : '') + stats.benchmark_pr_period.toFixed(2)}% <span className="text-[9px] text-rose-500/50 font-normal">(PR)</span></span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="py-3 px-3 text-center bg-slate-500/[0.02] font-mono text-[13px] text-gray-300 font-bold">
                                                            <div className="flex items-center gap-1.5 justify-center">
                                                                {(diffPeriod > 0 ? '+' : '') + diffPeriod.toFixed(2)}%
                                                                {stats.is_pr ? (
                                                                    <span className="text-[9px] text-amber-500/70 border border-amber-500/30 px-1 rounded">PR비교</span>
                                                                ) : (
                                                                    <span className="text-[9px] text-indigo-400/70 border border-indigo-400/30 px-1 rounded">TR비교</span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="py-3 px-3 text-center font-mono text-[13px] text-emerald-400 font-bold">
                                                            {upCap.toFixed(1)}%
                                                        </td>
                                                        <td className="py-3 px-3 text-center font-mono text-[13px] text-blue-400 font-bold">
                                                            {downCap.toFixed(1)}%
                                                        </td>
                                                    </tr>
                                                )
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                                <p className="text-[11px] text-gray-500 mt-2 text-right">
                                    * 상승/하락 참여율은 지수 움직임 대비 커버드콜 상품의 민감도(Capture Ratio)를 백분율 산출한 값입니다.
                                </p>
                                <p className="text-[11px] text-gray-400 mt-1 text-right">
                                    ※ 본 메뉴의 모든 수익률 데이터(벤치마크 지수 및 개별 종목)는 실제 분배금 지급 내역을 가격에 재투자한 가상의 누적 <b>총수익률(Total Return, TR)</b>을 기준으로 합니다.
                                </p>
                            </div>

                            {/* Scatter Chart Area for Capture Ratios */}
                            <div className="bg-black/30 border border-white/5 rounded-2xl p-4 shrink-0 flex flex-col">
                                <h4 className="font-bold text-gray-200 flex items-center gap-2 mb-4">
                                    업 & 다운 캡처 (Capture Ratio) 분포도
                                </h4>
                                <div className="h-[300px] w-full relative">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <ScatterChart margin={{ top: 20, right: 30, bottom: 20, left: 10 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                            <XAxis
                                                type="number"
                                                dataKey="downside"
                                                name="하락 참여율"
                                                unit="%"
                                                domain={[120, 0]}
                                                reversed={true}
                                                stroke="rgba(255,255,255,0.3)"
                                                tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }}
                                                label={{ value: "하락 참여율 (낮을수록 우측 이동/좋음 ➡️)", position: "bottom", style: { fill: 'rgba(255,255,255,0.5)', fontSize: 11 }, offset: 0 }}
                                            />
                                            <YAxis
                                                type="number"
                                                dataKey="upside"
                                                name="상승 참여율"
                                                unit="%"
                                                domain={[0, 120]}
                                                stroke="rgba(255,255,255,0.3)"
                                                tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }}
                                                label={{ value: "상승 참여율 (높을수록 좋음 ⬆️)", angle: -90, position: "left", style: { fill: 'rgba(255,255,255,0.5)', fontSize: 11 } }}
                                            />
                                            <ZAxis type="category" dataKey="ticker" name="종목" />
                                            <RechartsTooltip content={<CustomScatterTooltip />} cursor={{ strokeDasharray: '3 3' }} />
                                            <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} iconType="circle" />

                                            <ReferenceLine x={100} stroke="#f43f5e" strokeDasharray="3 3" label={{ position: 'top', value: '지수 하락(100%)', fill: '#f43f5e', fontSize: 10 }} />
                                            <ReferenceLine y={100} stroke="#f43f5e" strokeDasharray="3 3" label={{ position: 'right', value: '지수 상승(100%)', fill: '#f43f5e', fontSize: 10 }} />

                                            {selectedForCompare.map((item, idx) => {
                                                const colors = ['#818cf8', '#34d399', '#fbbf24', '#a78bfa', '#60a5fa', '#f87171', '#34d399'];
                                                const stats = realStats[item.ticker] || {};
                                                const upCap = stats.upside_capture !== undefined ? stats.upside_capture : 45.0;
                                                const downCap = stats.downside_capture !== undefined ? stats.downside_capture : 82.0;
                                                const scatterData = [{
                                                    ticker: item.ticker,
                                                    name: item.name,
                                                    upside: Number(upCap.toFixed(1)),
                                                    downside: Number(downCap.toFixed(1))
                                                }];

                                                // Custom dot rendering for animated highlight
                                                const CustomDot = (props: any) => {
                                                    const { cx, cy, fill } = props;
                                                    const isHovered = hoveredScatterItem === item.ticker;
                                                    return (
                                                        <circle
                                                            cx={cx}
                                                            cy={cy}
                                                            r={isHovered ? 12 : 7}
                                                            fill={fill}
                                                            className={isHovered ? "animate-pulse shadow-lg" : "transition-all duration-300"}
                                                            opacity={hoveredScatterItem && !isHovered ? 0.3 : 1}
                                                        />
                                                    );
                                                };

                                                return (
                                                    <Scatter
                                                        key={item.ticker}
                                                        name={item.name}
                                                        data={scatterData}
                                                        fill={colors[idx % colors.length]}
                                                        shape={<CustomDot />}
                                                        onMouseEnter={() => setHoveredScatterItem(item.ticker)}
                                                        onMouseLeave={() => setHoveredScatterItem(null)}
                                                    />
                                                );
                                            })}
                                        </ScatterChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
