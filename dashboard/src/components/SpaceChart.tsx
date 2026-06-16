"use client";

import React, { useState, useEffect } from 'react';
import { Activity, ArrowUpRight, Sparkles, TrendingUp, BookOpen, PieChart, BarChart3, AlertTriangle } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend } from 'recharts';
import { API_BASE } from '../lib/apiConfig';
import ChartLoadingPlaceholder from './ChartLoadingPlaceholder';

interface SpaceChartProps {
    onOpenDetail?: (code: string) => void;
}

const constituentTickerMap: { [key: string]: string } = {
    "Rocket Lab (로켓랩)": "RKLB",
    "EchoStar (에코스타)": "SATS",
    "AST SpaceMobile (스페이스모바일)": "ASTS",
    "Intuitive Machines (인튜이티브 머신스)": "LUNR",
    "Redwire (레드와이어)": "RDW",
    "Planet Labs (플래닛랩스)": "PL",
    "L3Harris Technologies": "LHX",
    "Advanced Micro Devices": "AMD",
    "Teradyne": "TER",
    "Boeing (보잉)": "BA",
    "Globalstar (글로벌스타)": "GSAT",
    "Kratos Defense": "KTOS",
    "Deere & Company (디어앤컴퍼니)": "DE",
    "Archer Aviation": "ACHR",
    "MDA Space (MDA 스페이스)": "MDALF",
};

const getTickerFromConstituent = (name: string): string => {
    if (constituentTickerMap[name]) return constituentTickerMap[name];
    const normalized = name.trim();
    if (constituentTickerMap[normalized]) return constituentTickerMap[normalized];
    return normalized;
};

const etfNameToCodeMap: { [key: string]: string } = {
    "KODEX 미국우주항공": "488050",
    "ACE 미국우주테크액티브": "484930",
    "Tiger 미국우주테크": "488100",
    "SOL 미국우주항공TOP10": "495470",
};

const checkIsUsMarketOpenClient = (): boolean => {
    try {
        const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: 'America/New_York',
            hour12: false,
            weekday: 'short',
            hour: '2-digit',
            minute: '2-digit'
        });
        const parts = formatter.formatToParts(new Date());
        let weekday = '';
        let hour = 0;
        let minute = 0;
        for (const part of parts) {
            if (part.type === 'weekday') weekday = part.value;
            if (part.type === 'hour') hour = parseInt(part.value, 10);
            if (part.type === 'minute') minute = parseInt(part.value, 10);
        }
        
        if (weekday === 'Sat' || weekday === 'Sun') {
            return false;
        }
        
        const minutesSinceMidnight = hour * 60 + minute;
        const marketOpenMinutes = 9 * 60 + 30; // 09:30
        const marketCloseMinutes = 16 * 60;   // 16:00
        
        return minutesSinceMidnight >= marketOpenMinutes && minutesSinceMidnight <= marketCloseMinutes;
    } catch (e) {
        console.error('Failed to check US market open on client:', e);
        return false;
    }
};

const isBeforeKrMarketOpen = (): boolean => {
    try {
        const now = new Date();
        const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: 'Asia/Seoul',
            hour12: false,
            weekday: 'short',
            hour: '2-digit',
            minute: '2-digit'
        });
        const parts = formatter.formatToParts(now);
        let weekday = '';
        let hour = 0;
        let minute = 0;
        for (const part of parts) {
            if (part.type === 'weekday') weekday = part.value;
            if (part.type === 'hour') hour = parseInt(part.value, 10);
            if (part.type === 'minute') minute = parseInt(part.value, 10);
        }
        
        const isWeekend = weekday === 'Sat' || weekday === 'Sun';
        if (isWeekend) return true;
        
        const minutesSinceMidnight = hour * 60 + minute;
        // Market starts at 09:00 KST (540 minutes)
        return minutesSinceMidnight < 540;
    } catch (e) {
        console.error('Failed to check KR market status:', e);
        return false;
    }
};

export default function SpaceChart({ onOpenDetail }: SpaceChartProps) {
    const [period, setPeriod] = useState('1Y');
    const [chartData, setChartData] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [hoveredLine, setHoveredLine] = useState<string | null>(null);
    const [keys, setKeys] = useState<string[]>([]);
    const [originalData, setOriginalData] = useState<any[]>([]);
    const [selectedEtf, setSelectedEtf] = useState<string | null>(null);
    const [marketTab, setMarketTab] = useState<'KR' | 'US'>('KR');
    
    // Holdings comparison state
    const [holdingsData, setHoldingsData] = useState<any[]>([]);
    const [holdingsKeys, setHoldingsKeys] = useState<string[]>([]);
    const [isHoldingsLoading, setIsHoldingsLoading] = useState(true);
    const [holdingsUpdatedAt, setHoldingsUpdatedAt] = useState<string>('');
    const [isMarketOpen, setIsMarketOpen] = useState<boolean>(() => checkIsUsMarketOpenClient());
    const [disparityData, setDisparityData] = useState<{ [key: string]: any }>({});
    const [activeInsightTab, setActiveInsightTab] = useState<'macro' | 'etfs' | 'strategy'>('macro');

    useEffect(() => {
        const fetchDisparity = async () => {
            try {
                const res = await fetch(`${API_BASE}/api/v1/analyze/etf/disparity?codes=488050,484930,488100,495470`);
                if (res.ok) {
                    const data = await res.json();
                    setDisparityData(data);
                }
            } catch (err) {
                console.error('Error fetching Space ETF disparity:', err);
            }
        };
        fetchDisparity();
        const interval = setInterval(fetchDisparity, 60000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const fetchHoldings = async () => {
            setIsHoldingsLoading(true);
            try {
                const res = await fetch(`${API_BASE}/api/v1/analyze/space-holdings`);
                if (!res.ok) throw new Error('API fetch error');
                const data = await res.json();
                if (data.table_data) {
                    setHoldingsData(data.table_data);
                    if (data.keys) {
                        setHoldingsKeys(data.keys);
                    }
                    if (data.updated_at) {
                        setHoldingsUpdatedAt(data.updated_at);
                    }
                    if (data.is_market_open !== undefined) {
                        setIsMarketOpen(data.is_market_open);
                    }
                }
            } catch (err) {
                console.error('Error fetching space holdings:', err);
            } finally {
                setIsHoldingsLoading(false);
            }
        };
        fetchHoldings();
    }, []);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const url = selectedEtf
                    ? `${API_BASE}/api/v1/analyze/space-chart?etf=${encodeURIComponent(selectedEtf)}`
                    : `${API_BASE}/api/v1/analyze/space-chart`;
                const res = await fetch(url);
                if (!res.ok) throw new Error('API fetch error');
                const data = await res.json();
                
                if (data.line_chart_data && data.line_chart_data.length > 0) {
                    setOriginalData(data.line_chart_data);
                    setKeys(data.keys);
                } else {
                    setError('데이터가 없습니다.');
                }
            } catch (err) {
                console.error(err);
                setError('서버에서 우주 지수 데이터를 불러오지 못했습니다.');
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [selectedEtf]);

    useEffect(() => {
        if (!originalData || originalData.length === 0) return;

        // Filter data based on period
        const now = new Date();
        let startDate = new Date();
        switch (period) {
            case '1M': startDate.setMonth(now.getMonth() - 1); break;
            case '3M': startDate.setMonth(now.getMonth() - 3); break;
            case '6M': startDate.setMonth(now.getMonth() - 6); break;
            case '1Y': startDate.setFullYear(now.getFullYear() - 1); break;
            case '3Y': startDate.setFullYear(now.getFullYear() - 3); break;
            case '10Y': startDate.setFullYear(now.getFullYear() - 10); break;
            default: startDate.setFullYear(now.getFullYear() - 1); break;
        }

        const filtered = originalData.filter(d => new Date(d.date) >= startDate);
        if (filtered.length === 0) {
            setChartData([]);
            return;
        }

        // ─── 개별 자산 기준일 가격(Base Value) 계산 ────────────────────────
        // 각 종목별로 유효한 가격 데이터가 처음으로 나타나는 시점을 기준(100)으로 삼습니다.
        // 이는 한국/미국 시장의 공휴일/휴장일 불일치 및 상장일 격차 문제를 완벽히 방어합니다.
        const baseValues: any = {};
        keys.forEach(k => {
            const firstValid = filtered.find(d => d[k] != null && d[k] > 0);
            if (firstValid) {
                baseValues[k] = firstValid[k];
            }
        });

        const normalizedData = filtered.map(d => {
            const row: any = { date: d.date.replace(/-/g, '/').substring(2) };
            keys.forEach(k => {
                if (d[k] != null && baseValues[k]) {
                    row[k] = Number(((d[k] / baseValues[k]) * 100).toFixed(2));
                }
            });
            return row;
        });

        setChartData(normalizedData);
    }, [period, originalData, keys]);

    const handleLegendMouseEnter = (o: any) => {
        setHoveredLine(o.dataKey);
    };

    const handleLegendMouseLeave = () => {
        setHoveredLine(null);
    };

    const periodOptions = ['1M', '3M', '6M', '1Y', '3Y', '10Y'];
    const colors = [
        '#f59e0b', '#ec4899', '#3b82f6', '#10b981', '#8b5cf6', 
        '#06b6d4', '#a855f7', '#6366f1', '#14b8a6', '#f43f5e', 
        '#e11d48', '#0ea5e9'
    ];

    // ── 커스텀 툴팁: 전일 대비 증감율 표시 ──────────────────────────────
    const CustomTooltip = ({ active, payload, label }: any) => {
        if (!active || !payload || payload.length === 0) return null;

        const currentIdx = chartData.findIndex((d) => d.date === label);
        const prevRow = currentIdx > 0 ? chartData[currentIdx - 1] : null;

        return (
            <div style={{
                backgroundColor: 'rgba(18, 18, 23, 0.97)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '12px',
                boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                padding: '10px 14px',
                fontSize: '12px',
                minWidth: '210px',
            }}>
                <p style={{ color: 'rgba(255,255,255,0.45)', marginBottom: '8px', fontSize: '11px' }}>
                    {label}
                </p>
                {payload.map((entry: any) => {
                    const val: number = entry.value;
                    if (val === undefined || val === null || isNaN(val)) return null;
                    const prevVal: number | null = prevRow?.[entry.dataKey] ?? null;
                    const dailyPct = prevVal != null && prevVal > 0
                        ? (((val - prevVal) / prevVal) * 100).toFixed(2)
                        : null;
                    const isUp = dailyPct !== null && parseFloat(dailyPct) >= 0;
                    const dailyColor = dailyPct === null ? 'rgba(255,255,255,0.3)'
                        : isUp ? '#34d399' : '#f87171';
                    const dailyText = dailyPct === null ? ''
                        : isUp ? `(+${dailyPct}%)` : `(${dailyPct}%)`;

                    return (
                        <div key={entry.dataKey} style={{
                            display: 'flex', justifyContent: 'space-between',
                            alignItems: 'center', gap: '12px', marginBottom: '4px',
                        }}>
                            <span style={{ color: entry.color, fontWeight: 'bold' }}>
                                {entry.dataKey}
                            </span>
                            <span style={{ color: 'rgba(255,255,255,0.85)', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                                {val.toFixed(1)}%
                                {dailyPct !== null && (
                                    <span style={{ color: dailyColor, marginLeft: '6px', fontSize: '11px' }}>
                                        {dailyText}
                                    </span>
                                )}
                            </span>
                        </div>
                    );
                })}
                <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '9px', marginTop: '6px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '5px' }}>
                    기준점 100 대비 &nbsp;·&nbsp; 괄호 = 전일대비 증감율
                </p>
            </div>
        );
    };

    const etfsToSelect = [
        "KODEX 미국우주항공",
        "ACE 미국우주테크액티브",
        "Tiger 미국우주테크",
        "SOL 미국우주항공TOP10",
        "US-Space (ARKX)",
        "US-Space (UFO)",
        "US-Space (XOVR)",
        "US-Space (NASA)",
        "US-Space (ORBX)",
        "US-Space (WARP)"
    ];

    const baseEtfKeys = [
        "KODEX 미국우주항공",
        "ACE 미국우주테크액티브",
        "Tiger 미국우주테크",
        "SOL 미국우주항공TOP10",
        "US-Space (ARKX)",
        "US-Space(ARKX)",
        "US-Space",
        "US-Space (UFO)",
        "US-Space (XOVR)",
        "US-Space (NASA)",
        "US-Space (ORBX)",
        "US-Space (WARP)"
    ];

    const krEtfs = ["KODEX 미국우주항공", "ACE 미국우주테크액티브", "Tiger 미국우주테크", "SOL 미국우주항공TOP10"];
    const usEtfs = [
        "US-Space (ARKX)",
        "US-Space (UFO)",
        "US-Space (XOVR)",
        "US-Space (NASA)",
        "US-Space (ORBX)",
        "US-Space (WARP)"
    ];

    // Filter and sort holdings table data if an ETF is selected
    const activeTabEtfs = marketTab === 'KR' ? krEtfs : usEtfs;
    const displayHoldingsKeys = selectedEtf
        ? [selectedEtf]
        : holdingsKeys.filter((k) => activeTabEtfs.includes(k));

    const displayHoldingsData = selectedEtf
        ? holdingsData
              .filter((row) => row[selectedEtf] !== undefined && (row[selectedEtf] > 0 || row[selectedEtf] === null))
              .sort((a, b) => (b[selectedEtf] || 0) - (a[selectedEtf] || 0))
              .slice(0, 10)
        : holdingsData
              .filter((row) => displayHoldingsKeys.some((k) => row[k] !== undefined && (row[k] > 0 || row[k] === null)))
              .sort((a, b) => {
                  const sumA = displayHoldingsKeys.reduce((sum, k) => sum + (a[k] || 0), 0);
                  const sumB = displayHoldingsKeys.reduce((sum, k) => sum + (b[k] || 0), 0);
                  return sumB - sumA;
              })
              .slice(0, 15);

    // Custom Legend Renderer: Korean ETFs on top row, US ETFs on bottom row
    const renderCustomLegend = (props: any) => {
        const { payload } = props;
        if (!payload) return null;

        const koreanItems = payload.filter((entry: any) => krEtfs.includes(entry.value));
        const usItems = payload.filter((entry: any) => usEtfs.includes(entry.value));
        const constituentItems = payload.filter((entry: any) => !krEtfs.includes(entry.value) && !usEtfs.includes(entry.value));

        return (
            <div className="flex flex-col gap-2 mt-4 text-xs font-semibold select-none">
                {koreanItems.length > 0 && (
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 justify-center">
                        <span className="text-[10px] font-bold text-gray-500 mr-1 uppercase tracking-wider">KR ETFs:</span>
                        {koreanItems.map((entry: any, index: number) => {
                            const isSelected = selectedEtf === entry.value;
                            return (
                                <button
                                    key={`kr-${index}`}
                                    onMouseEnter={() => setHoveredLine(entry.value)}
                                    onMouseLeave={() => setHoveredLine(null)}
                                    onClick={() => setSelectedEtf(prev => prev === entry.value ? null : entry.value)}
                                    className={`flex items-center gap-1.5 transition-all hover:text-white ${
                                        isSelected ? 'text-white font-bold scale-105' : 'text-gray-400'
                                    }`}
                                >
                                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                                    <span>{entry.value}</span>
                                </button>
                            );
                        })}
                    </div>
                )}
                {usItems.length > 0 && (
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 justify-center mt-0.5">
                        <span className="text-[10px] font-bold text-gray-500 mr-1 uppercase tracking-wider">US ETFs:</span>
                        {usItems.map((entry: any, index: number) => {
                            const isSelected = selectedEtf === entry.value;
                            return (
                                <button
                                    key={`us-${index}`}
                                    onMouseEnter={() => setHoveredLine(entry.value)}
                                    onMouseLeave={() => setHoveredLine(null)}
                                    onClick={() => setSelectedEtf(prev => prev === entry.value ? null : entry.value)}
                                    className={`flex items-center gap-1.5 transition-all hover:text-white ${
                                        isSelected ? 'text-white font-bold scale-105' : 'text-gray-400'
                                    }`}
                                >
                                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                                    <span>{entry.value}</span>
                                </button>
                            );
                        })}
                    </div>
                )}
                {constituentItems.length > 0 && (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 justify-center mt-2 border-t border-white/5 pt-2">
                        <span className="text-[9px] font-bold text-gray-500 mr-1 uppercase tracking-wider">Holdings:</span>
                        {constituentItems.map((entry: any, index: number) => (
                            <div
                                key={`holding-${index}`}
                                onMouseEnter={() => setHoveredLine(entry.value)}
                                onMouseLeave={() => setHoveredLine(null)}
                                className="flex items-center gap-1 text-[10px] text-gray-400 font-mono"
                            >
                                <span className="w-2 h-0.5" style={{ backgroundColor: entry.color }} />
                                <span>{entry.value}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="w-full bg-[#121217]/60 border border-white/10 rounded-3xl p-4 xl:p-5 backdrop-blur-md shadow-xl flex flex-col mt-0">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-3">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Activity className="w-5 h-5 text-indigo-400" />
                    우주섹터 주요 종목 현황
                </h3>
                <div className="flex items-center gap-2.5">
                    {/* Market Toggle Button */}
                    <div className="flex bg-black/40 rounded-lg p-1 border border-white/5 shadow-inner animate-fade-in">
                        <button
                            onClick={() => {
                                setMarketTab('KR');
                                setSelectedEtf(null); // 탭 전환 시 개별선택 초기화
                            }}
                            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${marketTab === 'KR'
                                ? 'bg-indigo-600 text-white shadow-md'
                                : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
                            }`}
                        >
                            국내상장 ETF
                        </button>
                        <button
                            onClick={() => {
                                setMarketTab('US');
                                setSelectedEtf(null); // 탭 전환 시 개별선택 초기화
                            }}
                            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${marketTab === 'US'
                                ? 'bg-indigo-600 text-white shadow-md'
                                : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
                            }`}
                        >
                            미국상장 ETF
                        </button>
                    </div>

                    {/* Period Selector */}
                    <div className="flex bg-black/40 rounded-lg p-1 border border-white/5 shadow-inner">
                        {periodOptions.map(p => (
                            <button
                                key={p}
                                onClick={() => setPeriod(p)}
                                className={`px-2.5 py-1.5 text-xs font-bold rounded-md transition-all ${period === p
                                    ? 'bg-indigo-600 text-white shadow-md'
                                    : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
                                }`}
                            >
                                {p}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* ETF Selector Chips for Constituent Overlay */}
            <div className="flex flex-wrap gap-2 items-center mb-4 bg-black/30 p-2.5 rounded-2xl border border-white/5">
                <span className="text-[11px] font-bold text-gray-400 mr-1 flex items-center">
                    🔍 구성종목 주가 비교:
                </span>
                {etfsToSelect.filter(e => activeTabEtfs.includes(e) || selectedEtf === e).map((etfName, idx) => {
                    const isSelected = selectedEtf === etfName;
                    const themeColor = colors[idx % colors.length];
                    return (
                        <button
                            key={etfName}
                            onClick={() => setSelectedEtf(isSelected ? null : etfName)}
                            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all border ${
                                isSelected
                                    ? `bg-indigo-600/20 text-white shadow-[0_0_12px_rgba(99,102,241,0.25)]`
                                    : 'bg-white/5 border-white/10 text-gray-400 hover:text-gray-200 hover:bg-white/10'
                            }`}
                            style={{
                                borderColor: isSelected ? themeColor : 'rgba(255,255,255,0.06)'
                            }}
                        >
                            {etfName} {isSelected && '✓'}
                        </button>
                    );
                })}
                {selectedEtf && (
                    <button
                        onClick={() => setSelectedEtf(null)}
                        className="text-[10px] text-rose-400 hover:text-rose-300 font-bold ml-auto hover:underline transition-all"
                    >
                        비교 초기화 (X)
                    </button>
                )}
            </div>
 
            <div className="w-full h-[400px]">
                {isLoading ? (
                    <ChartLoadingPlaceholder height={400} message="우주 ETF 데이터 로딩중" />
                ) : error ? (
                    <div className="w-full h-full flex items-center justify-center text-rose-400 text-sm">
                        {error}
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData} margin={{ top: 10, right: 15, left: 15, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                            <XAxis
                                dataKey="date"
                                stroke="rgba(255,255,255,0.2)"
                                tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }}
                                tickMargin={10}
                                minTickGap={30}
                            />
                            <YAxis
                                orientation="right"
                                width={55}
                                domain={['auto', 'auto']}
                                stroke="rgba(255,255,255,0.2)"
                                tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }}
                                tickFormatter={(val) => `${val.toFixed(0)}%`}
                            />
                            <RechartsTooltip content={<CustomTooltip />} />
                            <Legend
                                content={renderCustomLegend}
                            />
                            {keys.map((k, idx) => {
                                const isConstituent = !baseEtfKeys.includes(k);

                                // If in general comparison mode (no selectedEtf), filter out base ETFs that don't belong to the active tab
                                if (!selectedEtf && !isConstituent && !activeTabEtfs.includes(k)) {
                                    return null;
                                }

                                return (
                                    <Line
                                        key={k}
                                        type="monotone"
                                        dataKey={k}
                                        stroke={colors[idx % colors.length]}
                                        strokeWidth={hoveredLine === k ? (isConstituent ? 3 : 4) : hoveredLine ? 1 : (isConstituent ? 1.5 : 2)}
                                        strokeDasharray={isConstituent ? "4 4" : undefined}
                                        dot={false}
                                        activeDot={{ r: 4, strokeWidth: 0, fill: colors[idx % colors.length] }}
                                        name={k}
                                        connectNulls={true}
                                        style={{
                                            opacity: hoveredLine === k ? 1 : hoveredLine ? 0.3 : 0.8,
                                            transition: 'all 0.3s ease'
                                        }}
                                    />
                                );
                            })}
                        </LineChart>
                    </ResponsiveContainer>
                )}
            </div>
            <p className="text-[10px] text-gray-500 text-right mt-2 font-mono">
                * 기준점 100으로 환산된 지수/주가 추이 (배당/분배금 제외)
            </p>

            {/* Divider */}
            <div className="w-full border-t border-white/10 my-5"></div>

            {/* Holdings Table Section */}
            <div className="flex flex-col gap-4">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center w-full gap-3">
                    <h4 className="text-base font-bold text-white flex items-center gap-2">
                        <Activity className="w-4 h-4 text-emerald-400" />
                        우주섹터 주요 ETF 구성종목 및 비중 비교 (%)
                    </h4>
                    
                    <span className="text-[10px] sm:text-xs text-gray-400 font-bold font-mono bg-white/5 px-2 py-1.5 rounded border border-white/5">
                        {isMarketOpen 
                            ? (holdingsUpdatedAt ? `${holdingsUpdatedAt} KST 기준` : 'KST 기준') 
                            : 'NASDAQ 종가기준'}
                    </span>
                </div>
                
                {isHoldingsLoading ? (
                    <div className="py-8 flex justify-center items-center text-xs text-gray-400 font-medium">
                        구성종목 데이터를 로드하는 중...
                    </div>
                ) : holdingsData.length === 0 ? (
                    <div className="py-8 text-center text-xs text-rose-400">
                        구성종목 데이터를 불러오지 못했습니다.
                    </div>
                ) : (
                    <div className="overflow-x-auto w-full rounded-2xl border border-white/10 bg-black/30 shadow-inner">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-white/5">
                                    <th className="px-4 py-3 text-xs font-bold text-gray-300 border-b border-white/10">
                                        구성종목명
                                    </th>
                                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-300 border-b border-white/10 whitespace-nowrap">
                                        현재가 / 전일대비
                                    </th>
                                    {displayHoldingsKeys.map((k, idx) => {
                                        const originalIdx = holdingsKeys.indexOf(k);
                                        const dotColor = colors[originalIdx >= 0 ? originalIdx : idx % colors.length];
                                        const etfCode = etfNameToCodeMap[k];
                                        const dispInfo = etfCode ? disparityData[etfCode] : null;
                                        
                                        // Calculate weight-averaged change percentage
                                        let weightSum = 0;
                                        let weightedChangeSum = 0;
                                        holdingsData.forEach(row => {
                                            const weight = row[k];
                                            const change = row.change_pct; // Constituent daily change %
                                            if (weight !== undefined && weight !== null && weight > 0 && change !== undefined && change !== null) {
                                                weightSum += weight;
                                                weightedChangeSum += (change * weight);
                                            }
                                        });
                                        const estChangePct = weightSum > 0 ? (weightedChangeSum / weightSum) : null;
                                        
                                        // Calculate estimated Korean ETF price: prev_close (yesterday close KST) * (1 + estChangePct/100)
                                        const estPrice = (dispInfo && dispInfo.prev_close && estChangePct !== null)
                                            ? dispInfo.prev_close * (1 + estChangePct / 100)
                                            : null;

                                        const isBeforeOpen = isBeforeKrMarketOpen();
                                        const actualPrice = dispInfo ? dispInfo.price : null;
                                        const actualChangeRate = dispInfo ? dispInfo.change_rate : null;
                                        const diffRate = (actualPrice !== null && estPrice !== null && estPrice > 0)
                                            ? ((actualPrice - estPrice) / estPrice) * 100
                                            : null;

                                        return (
                                            <th key={k} className="px-3 py-3 text-center text-xs font-bold text-gray-300 border-b border-white/10">
                                                <div className="flex flex-col items-center justify-center gap-1.5 whitespace-nowrap">
                                                    <div className="flex items-center justify-center gap-1.5">
                                                        <span style={{ color: dotColor }}>●</span>
                                                        {k}
                                                    </div>
                                                    {estChangePct !== null && (
                                                        <div className="flex flex-col items-center mt-1 text-[11px] font-sans space-y-0.5 leading-normal">
                                                            {/* 예상가격 */}
                                                            <div className="flex items-center gap-1 font-bold text-gray-200">
                                                                <span className="text-gray-400">예상가격:</span>
                                                                {estPrice !== null ? (
                                                                    <span>
                                                                        {new Intl.NumberFormat('ko-KR').format(Math.floor(estPrice))}원
                                                                    </span>
                                                                ) : (
                                                                    <span>-원</span>
                                                                )}
                                                                <span 
                                                                    style={{
                                                                        color: estChangePct > 0 
                                                                            ? '#60a5fa' 
                                                                            : estChangePct < 0 
                                                                                ? '#f87171' 
                                                                                : '#94a3b8'
                                                                    }}
                                                                >
                                                                    ({estChangePct > 0 ? '+' : ''}{estChangePct.toFixed(2)}%)
                                                                </span>
                                                            </div>

                                                            {/* 실제가격 */}
                                                            <div className="flex items-center gap-1 font-bold text-gray-200">
                                                                <span className="text-gray-400">실제가격:</span>
                                                                {!isBeforeOpen && actualPrice !== null ? (
                                                                    <>
                                                                        <span>{new Intl.NumberFormat('ko-KR').format(Math.floor(actualPrice))}원</span>
                                                                        {actualChangeRate !== null && (
                                                                            <span 
                                                                                style={{
                                                                                    color: actualChangeRate > 0 
                                                                                        ? '#60a5fa' 
                                                                                        : actualChangeRate < 0 
                                                                                            ? '#f87171' 
                                                                                            : '#94a3b8'
                                                                                }}
                                                                            >
                                                                                ({actualChangeRate > 0 ? '+' : ''}{actualChangeRate.toFixed(2)}%)
                                                                            </span>
                                                                        )}
                                                                    </>
                                                                ) : (
                                                                    <span className="text-gray-500 font-medium">-</span>
                                                                )}
                                                            </div>

                                                            {/* 괴리율 */}
                                                            <div className="text-[10px] text-gray-400 font-medium">
                                                                괴리율:{' '}
                                                                {!isBeforeOpen && diffRate !== null ? (
                                                                    <span 
                                                                        style={{
                                                                            color: diffRate > 0 
                                                                                ? '#60a5fa' 
                                                                                : diffRate < 0 
                                                                                    ? '#f87171' 
                                                                                    : '#94a3b8'
                                                                        }}
                                                                        className="font-semibold"
                                                                    >
                                                                        {diffRate > 0 ? '+' : ''}{diffRate.toFixed(3)}%
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-gray-500 font-semibold">-</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </th>
                                        );
                                    })}
                                </tr>
                            </thead>
                            <tbody>
                                {displayHoldingsData.map((row) => (
                                    <tr 
                                        key={row.constituent} 
                                        className="hover:bg-white/5 transition-colors"
                                    >
                                        <td className="px-4 py-2.5 text-xs font-bold border-b border-white/5 max-w-[200px] truncate">
                                            {onOpenDetail ? (
                                                <button
                                                    onClick={() => {
                                                        const ticker = getTickerFromConstituent(row.constituent);
                                                        onOpenDetail(ticker);
                                                    }}
                                                    className="text-gray-200 hover:text-indigo-400 transition-all duration-200 text-left font-bold inline-flex items-center gap-1 group/btn"
                                                    title={`${row.constituent} 상세 주식 정보 조회`}
                                                >
                                                    <span className="group-hover/btn:underline">{row.constituent}</span>
                                                    <ArrowUpRight className="w-3.5 h-3.5 text-gray-400 group-hover/btn:text-indigo-400 transition-colors" />
                                                </button>
                                            ) : (
                                                <span className="text-gray-200">{row.constituent}</span>
                                            )}
                                        </td>
                                        {/* 현재가 / 전일대비 가격 열 */}
                                        <td className="px-4 py-2.5 text-center text-xs border-b border-white/5 whitespace-nowrap font-mono align-middle">
                                            {row.price !== undefined && row.price !== null ? (
                                                <div className="flex flex-col gap-0.5 justify-center items-center">
                                                    <span className="text-gray-200 font-bold">
                                                        ${row.price.toFixed(2)}
                                                    </span>
                                                    {row.change_pct !== undefined && row.change_pct !== null ? (
                                                        <span 
                                                            className="text-[10px] font-bold"
                                                            style={{ 
                                                                color: row.change_pct > 0 
                                                                    ? '#60a5fa' 
                                                                    : row.change_pct < 0 
                                                                        ? '#f87171' 
                                                                        : '#94a3b8' 
                                                                }}
                                                        >
                                                            {row.change_pct > 0 ? '+' : ''}{row.change_pct.toFixed(2)}%
                                                        </span>
                                                    ) : (
                                                        <span className="text-[10px] text-gray-500">-</span>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-gray-500 font-bold">-</span>
                                            )}
                                        </td>
                                        {displayHoldingsKeys.map((k) => {
                                            const val = row[k];
                                            if (val === null) {
                                                return (
                                                    <td key={k} className="px-3 py-2.5 text-center text-xs font-semibold border-b border-white/5 font-mono">
                                                        <span className="text-gray-500 text-[10px] border border-gray-600 rounded px-1 py-0.5">비상장</span>
                                                    </td>
                                                );
                                            }
                                            const isZero = !val || val === 0;
                                            if (isZero) {
                                                return (
                                                    <td key={k} className="px-3 py-2.5 text-center text-xs font-semibold text-gray-600 border-b border-white/5 font-mono">
                                                        -
                                                    </td>
                                                );
                                            }
                                            
                                            // Dynamic coloring based on weight value
                                            let cellColor = '#ffffff'; // < 5%: 흰색 (white)
                                            if (val >= 20) {
                                                cellColor = '#10b981'; // >= 20%: 짙은초록 (emerald-500)
                                            } else if (val >= 10) {
                                                cellColor = '#84cc16'; // >= 10%: 연두색 (lime-500)
                                            } else if (val >= 5) {
                                                cellColor = '#fbbf24'; // >= 5%: 노란색 (amber-400)
                                            }

                                            return (
                                                <td key={k} className="px-3 py-2 border-b border-white/5 align-middle min-w-[125px]">
                                                    <div className="flex flex-col gap-1 w-full">
                                                        {/* Value text on top aligned to the right */}
                                                        <div className="flex justify-end w-full">
                                                            <span 
                                                                className="text-[10.5px] font-bold font-mono"
                                                                style={{ color: cellColor }}
                                                            >
                                                                {val.toFixed(1)}%
                                                            </span>
                                                        </div>
                                                        {/* Progress bar track & solid vibrant color fill */}
                                                        <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                                                            <div 
                                                                className="h-full rounded-full transition-all duration-300"
                                                                style={{ 
                                                                    width: `${Math.min(val, 100)}%`,
                                                                    backgroundColor: cellColor
                                                                }}
                                                            />
                                                        </div>
                                                    </div>
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Divider */}
            <div className="w-full border-t border-white/10 my-6"></div>

            {/* Expert Insight Section */}
            <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                    <h4 className="text-base font-extrabold text-white flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-cyan-500 animate-pulse" />
                        AI 패러다임 쉬프트와 글로벌 우주항공 공급망 전략
                    </h4>
                    <span className="text-[10px] text-cyan-500/80 font-bold px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20">
                        Gemini Expert Report
                    </span>
                </div>

                {/* Tab Menu */}
                <div className="flex flex-wrap bg-[#1a1a23]/60 p-1 rounded-xl border border-white/5 gap-1 self-start">
                    {[
                        { id: 'macro', label: '1. 매크로 & 우주항공 트렌드', icon: TrendingUp },
                        { id: 'etfs', label: '2. 국내외 핵심 ETF 분석', icon: BookOpen },
                        { id: 'strategy', label: '3. 자산배분 모델 & 가이드', icon: PieChart }
                    ].map((tab) => {
                        const Icon = tab.icon;
                        const isSelected = activeInsightTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveInsightTab(tab.id as any)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                                    isSelected
                                        ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md'
                                        : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
                                }`}
                            >
                                <Icon className="w-3.5 h-3.5" />
                                {tab.label}
                            </button>
                        );
                    })}
                </div>

                {/* Tab Contents */}
                {activeInsightTab === 'macro' && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-1">
                        {/* Card 1: Starlink & LEO */}
                        <div className="bg-white/[0.02] hover:bg-white/[0.04] transition-all p-4 border border-white/5 rounded-2xl flex flex-col gap-2">
                            <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm">
                                <TrendingUp className="w-4 h-4" />
                                <span>저궤도 위성 통신망(LEO)과 D2C 혁신</span>
                            </div>
                            <p className="text-xs text-gray-300 leading-relaxed">
                                스타링크의 지배적 확장 속에서 스마트폰-위성 직접 연결(D2C) 시장이 개화하고 있습니다. AST SpaceMobile(ASTS) 등 혁신 기업들이 글로벌 통신사와의 파트너십을 바탕으로 지상 기지국 없는 완전한 글로벌 연결성을 구축하여 통신 패러다임을 바꿉니다.
                            </p>
                        </div>
                        {/* Card 2: Rocket Launch */}
                        <div className="bg-white/[0.02] hover:bg-white/[0.04] transition-all p-4 border border-white/5 rounded-2xl flex flex-col gap-2">
                            <div className="flex items-center gap-2 text-purple-400 font-bold text-sm">
                                <AlertTriangle className="w-4 h-4" />
                                <span>민간 로켓 발사 대중화 & RKLB 모멘텀</span>
                            </div>
                            <p className="text-xs text-gray-300 leading-relaxed">
                                위성 발사 수요는 폭증하나 발사체 캐파는 만성 쇼티지 상태입니다. 독점적 위치의 SpaceX 스타쉽에 대응하여 Rocket Lab(RKLB)의 소형 발사체 일렉트론(Electron) 및 중형 재사용 로켓 뉴트론(Neutron) 개발이 가속화되며 발사 대중화 수혜를 흡수하고 있습니다.
                            </p>
                        </div>
                        {/* Card 3: Gov Budget */}
                        <div className="bg-white/[0.02] hover:bg-white/[0.04] transition-all p-4 border border-white/5 rounded-2xl flex flex-col gap-2">
                            <div className="flex items-center gap-2 text-blue-400 font-bold text-sm">
                                <BarChart3 className="w-4 h-4" />
                                <span>우주 방산 및 정부 탐사(Artemis) 예산 수혜</span>
                            </div>
                            <p className="text-xs text-gray-300 leading-relaxed">
                                강대국 간의 우주 헤게모니 경쟁 심화로 국가 안보 위성 프로젝트 및 우주군 예산이 지속 증액되고 있습니다. 아울러 NASA 주도의 유인 달 탐사 아르테미스(Artemis) 계획 본격화로 민간 우주 하드웨어 및 서비스 조달 수혜가 본격화됩니다.
                            </p>
                        </div>
                    </div>
                )}

                {activeInsightTab === 'etfs' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-1">
                        {/* KR ETFs */}
                        <div className="bg-white/[0.02] p-4 border border-white/5 rounded-2xl flex flex-col gap-3">
                            <h5 className="text-sm font-bold text-cyan-400 border-b border-white/5 pb-2">국내 상장 핵심 ETF</h5>
                            <div className="flex flex-col gap-2.5 text-xs text-gray-300">
                                <div>
                                    <span className="font-bold text-white">KODEX 미국우주항공 (488050) & SOL 미국우주항공TOP10 (495470):</span>
                                    <p className="mt-0.5 text-gray-400">록히드마틴, 노스롭그루먼, 하리스 등 강력한 미국의 전통 우주항공/방위산업 대형 계약 기업들에 집중 투자합니다. 정부 조달 계약 기반의 견실한 이익 구조와 안정성을 지향합니다.</p>
                                </div>
                                <div>
                                    <span className="font-bold text-white">ACE 미국우주테크액티브 (484930) & Tiger 미국우주테크 (488100):</span>
                                    <p className="mt-0.5 text-gray-400">RKLB, ASTS, LUNR 등 뉴스 및 기술 이벤트 모멘텀이 강한 민간 우주테크 혁신 기업들의 비중이 상대적으로 높습니다. 우주 패러다임 변화에 따라 장기적인 고수익 성장을 기대하는 액티브/패시브 포트폴리오입니다.</p>
                                </div>
                            </div>
                        </div>
                        {/* US ETFs */}
                        <div className="bg-white/[0.02] p-4 border border-white/5 rounded-2xl flex flex-col gap-3">
                            <h5 className="text-sm font-bold text-blue-400 border-b border-white/5 pb-2">해외 상장 핵심 ETF</h5>
                            <div className="flex flex-col gap-2.5 text-xs text-gray-300">
                                <div>
                                    <span className="font-bold text-white">ARKX (ARK Space Exploration & Innovation ETF | AUM $200M+):</span>
                                    <p className="mt-0.5 text-gray-400">액티브 혁신 투자의 선두인 ARK가 우주 탐사와 혁신 기술 전반에 배분합니다. 농업 기술(DE), 3D 프린팅 등 간접적인 수혜 산업까지 포괄적인 포트폴리오를 구성해 다각화된 투자를 제공합니다.</p>
                                </div>
                                <div>
                                    <span className="font-bold text-white">UFO (Procure Space ETF | AUM $35M+):</span>
                                    <p className="mt-0.5 text-gray-400">순수 우주 산업 및 인프라 지수를 추종하는 대표적인 패시브 상품입니다. 위성 통신 서비스 및 수송, 하드웨어 장비 비중이 매우 높아 글로벌 순수 우주 섹터 전체 성장률을 추종하는 정석적인 기초 자산입니다.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeInsightTab === 'strategy' && (
                    <div className="bg-white/[0.02] p-4 border border-white/5 rounded-2xl flex flex-col gap-4 mt-1">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <h5 className="text-xs font-bold text-cyan-400 mb-2 flex items-center gap-1">
                                    <PieChart className="w-3.5 h-3.5" />
                                    포트폴리오 자산배분 모델 제안
                                </h5>
                                <div className="text-xs text-gray-300 space-y-2 leading-relaxed font-sans">
                                    <div>
                                        <span className="font-bold text-white">공격성장형 (우주 60% : 기타 40%):</span>
                                        <span className="text-gray-400"> ACE 미국우주테크 25% + UFO 20% + RKLB/ASTS 개별주 15% | S&P 500 20% + 미국 채권 20%</span>
                                    </div>
                                    <div>
                                        <span className="font-bold text-white">균형포커스형 (우주 40% : 기타 60%):</span>
                                        <span className="text-gray-400"> KODEX 미국우주항공 20% + ARKX 15% + Tiger 우주테크 5% | 배당성장 30% + 국채 30%</span>
                                    </div>
                                    <div>
                                        <span className="font-bold text-white">인컴방어형 (우주 20% : 기타 80%):</span>
                                        <span className="text-gray-400"> KODEX 미국우주항공 15% + SOL 우주항공 5% | 리츠/커버드콜 배당 40% + 중단기 채권 40%</span>
                                    </div>
                                </div>
                            </div>
                            <div>
                                <h5 className="text-xs font-bold text-cyan-400 mb-2 flex items-center gap-1">
                                    <TrendingUp className="w-3.5 h-3.5" />
                                    우주테크 이벤트/기술적 진입 가이드
                                </h5>
                                <div className="text-xs text-gray-300 space-y-2 leading-relaxed">
                                    <div>
                                        <span className="font-bold text-white">뉴스 변동성 및 냉각 진입 기준:</span>
                                        <p className="mt-0.5 text-gray-400">민간 발사 성공 여부나 스케줄 지연 등으로 단기 주가 출렁임이 심하게 일어납니다. 핵심 ETF들의 가격이 120일 또는 200일 SMA선 부근까지 기술적 조정을 겪거나 RSI가 40 이하로 충분히 냉각됐을 때 긴 호흡으로 1차 진입합니다.</p>
                                    </div>
                                    <div>
                                        <span className="font-bold text-white">과열 과다이격 분할 비중 조절:</span>
                                        <p className="mt-0.5 text-gray-400">대형 발사 성공이나 수주 뉴스 폭발로 이격도가 200일선 대비 +30% 이상 벌어지고, 단기 RSI가 75를 초과하는 등 투기적 매수세 유입 시에는 장기 적립 포지션 중 20%를 부분 실현해 리스크를 통제하는 것을 지향합니다.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="border-t border-white/5 pt-3">
                            <p className="text-[10px] text-gray-500 leading-relaxed font-semibold">
                                * 우주 섹터는 전통 방산주와 뉴스에 극도로 민감한 초기 성장 벤처 기술주가 섞여 있어 타 분야 대비 고유 변동성(Beta)이 매우 큽니다. 정부 계약 기반의 방산 기업(대형주)과 미래 혁신 위성 통신/운송 기업(중소형주)을 적절히 배분하여 극단적인 변동성을 흡수하며 장기적인 적립식 전략으로 가야 성공적입니다.
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
