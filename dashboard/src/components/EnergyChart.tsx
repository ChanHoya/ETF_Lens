"use client";

import React, { useState, useEffect } from 'react';
import { Activity, ArrowUpRight } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend } from 'recharts';
import { API_BASE } from '../lib/apiConfig';
import ChartLoadingPlaceholder from './ChartLoadingPlaceholder';

interface EnergyChartProps {
    onOpenDetail?: (code: string) => void;
}

const constituentTickerMap: { [key: string]: string } = {
    "HD현대일렉트릭": "267260",
    "LS일렉트릭": "010120",
    "효성중공업": "298040",
    "LS": "006260",
    "일진전기": "103590",
    "대한전선": "001440",
    "가온전선": "000500",
    "제룡전기": "033100",
    "한국전력": "015760",
    "한전KPS": "051600",
    "GE Vernova": "GEV",
    "Eaton Corporation": "ETN",
    "Constellation Energy": "CEG",
    "Vistra": "VST",
    "NextEra Energy": "NEE",
    "Vertiv Holdings": "VRT",
    "Quanta Services": "PWR",
    "Southern Company": "SO",
    "Powell Industries": "POWL",
    "NRG Energy": "NRG",
    "Duke Energy": "DUK",
    "Hubbell Inc": "HUBB",
    "Schneider Electric": "SBGSF",
    "ABB Ltd": "ABBNY",
    "Vulcan Materials": "VMC",
    "Caterpillar Inc": "CAT",
};

const getTickerFromConstituent = (name: string): string => {
    if (constituentTickerMap[name]) return constituentTickerMap[name];
    const normalized = name.trim();
    if (constituentTickerMap[normalized]) return constituentTickerMap[normalized];
    return normalized;
};

const etfNameToCodeMap: { [key: string]: string } = {
    "KODEX AI전력핵심설비": "487240",
    "HANARO 전력설비투자": "491820",
    "RISE AI전력인프라": "0101N0",
    "TIGER 코리아AI전력기기TOP3플러스": "0117V0",
    "KODEX 미국AI전력핵심인프라": "487230",
    "RISE 미국AI전력인프라액티브": "0176E0",
    "SOL 미국AI전력인프라": "486450",
    "TIGER 글로벌AI전력인프라액티브": "491010",
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

export default function EnergyChart({ onOpenDetail }: EnergyChartProps) {
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

    useEffect(() => {
        const fetchDisparity = async () => {
            try {
                const res = await fetch(`${API_BASE}/api/v1/analyze/etf/disparity?codes=487240,491820,0101N0,0117V0,487230,0176E0,486450,491010`);
                if (res.ok) {
                    const data = await res.json();
                    setDisparityData(data);
                }
            } catch (err) {
                console.error('Error fetching Energy ETF disparity:', err);
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
                const res = await fetch(`${API_BASE}/api/v1/analyze/energy-holdings`);
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
                console.error('Error fetching energy holdings:', err);
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
                    ? `${API_BASE}/api/v1/analyze/energy-chart?etf=${encodeURIComponent(selectedEtf)}`
                    : `${API_BASE}/api/v1/analyze/energy-chart`;
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
                setError('서버에서 전력 지수 데이터를 불러오지 못했습니다.');
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [selectedEtf]);

    useEffect(() => {
        if (!originalData || originalData.length === 0) return;

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

    const krEtfs = ["KODEX AI전력핵심설비", "HANARO 전력설비투자", "RISE AI전력인프라", "TIGER 코리아AI전력기기TOP3플러스"];
    const usEtfs = [
        "KODEX 미국AI전력핵심인프라",
        "RISE 미국AI전력인프라액티브",
        "SOL 미국AI전력인프라",
        "TIGER 글로벌AI전력인프라액티브"
    ];

    const etfsToSelect = [...krEtfs, ...usEtfs];
    const baseEtfKeys = [
        ...krEtfs,
        ...usEtfs,
        "US-Power (GRID)",
        "US-Power (PAVE)",
        "US-Power (XLU)"
    ];

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

    const activeTabEtfs = marketTab === 'KR' ? krEtfs : usEtfs;
    const displayHoldingsKeys = selectedEtf
        ? [selectedEtf]
        : holdingsKeys.filter((k) => activeTabEtfs.includes(k));

    const displayHoldingsData = selectedEtf
        ? holdingsData
              .filter((row) => row[selectedEtf] !== undefined && row[selectedEtf] > 0)
              .sort((a, b) => (b[selectedEtf] || 0) - (a[selectedEtf] || 0))
              .slice(0, 10)
        : holdingsData
              .filter((row) => displayHoldingsKeys.some((k) => row[k] !== undefined && row[k] > 0))
              .sort((a, b) => {
                  const sumA = displayHoldingsKeys.reduce((sum, k) => sum + (a[k] || 0), 0);
                  const sumB = displayHoldingsKeys.reduce((sum, k) => sum + (b[k] || 0), 0);
                  return sumB - sumA;
              })
              .slice(0, 15);

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
                        <span className="text-[10px] font-bold text-gray-500 mr-1 uppercase tracking-wider">KR Power:</span>
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
                        <span className="text-[10px] font-bold text-gray-500 mr-1 uppercase tracking-wider">US Power:</span>
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
                                transition-colors="true"
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
                    <Activity className="w-5 h-5 text-amber-400" />
                    전력/에너지 주요 종목 현황
                </h3>
                <div className="flex items-center gap-2.5">
                    {/* Market Toggle Button */}
                    <div className="flex bg-black/40 rounded-lg p-1 border border-white/5 shadow-inner">
                        <button
                            onClick={() => {
                                setMarketTab('KR');
                                setSelectedEtf(null);
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
                                setSelectedEtf(null);
                            }}
                            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${marketTab === 'US'
                                ? 'bg-indigo-600 text-white shadow-md'
                                : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
                            }`}
                        >
                            해외상장 ETF
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

            {/* ETF Selector Chips */}
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
                    <ChartLoadingPlaceholder height={400} message="전력 ETF 데이터 로딩중" />
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
                        전력섹터 주요 ETF 구성종목 및 비중 비교 (%)
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
                                        
                                        let weightSum = 0;
                                        let weightedChangeSum = 0;
                                        holdingsData.forEach(row => {
                                            const weight = row[k];
                                            const change = row.change_pct;
                                            if (weight !== undefined && weight !== null && weight > 0 && change !== undefined && change !== null) {
                                                weightSum += weight;
                                                weightedChangeSum += (change * weight);
                                            }
                                        });
                                        const estChangePct = weightSum > 0 ? (weightedChangeSum / weightSum) : null;
                                        const isKrEtf = krEtfs.includes(k);
                                        const isBeforeOpen = isBeforeKrMarketOpen();
                                        const actualPrice = dispInfo ? dispInfo.price : null;
                                        const actualChangeRate = dispInfo ? dispInfo.change_rate : null;

                                        const estPrice = isKrEtf
                                            ? (isBeforeOpen ? null : actualPrice)
                                            : ((dispInfo && dispInfo.prev_close && estChangePct !== null)
                                                ? dispInfo.prev_close * (1 + estChangePct / 100)
                                                : null);
                                                
                                        const displayEstChangePct = isKrEtf
                                            ? (isBeforeOpen ? null : actualChangeRate)
                                            : estChangePct;
                                            
                                        const diffRate = isKrEtf
                                            ? (isBeforeOpen ? null : 0)
                                            : ((actualPrice !== null && estPrice !== null && estPrice > 0)
                                                ? ((actualPrice - estPrice) / estPrice) * 100
                                                : null);

                                        const showInfo = isKrEtf 
                                            ? (isBeforeOpen ? true : (actualPrice !== null)) 
                                            : (estChangePct !== null);

                                        return (
                                            <th key={k} className="px-3 py-3 text-center text-xs font-bold text-gray-300 border-b border-white/10">
                                                <div className="flex flex-col items-center justify-center gap-1.5 whitespace-nowrap">
                                                    <div className="flex items-center justify-center gap-1.5">
                                                        <span style={{ color: dotColor }}>●</span>
                                                        {k}
                                                    </div>
                                                    {showInfo && (
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
                                                                {displayEstChangePct !== null && (
                                                                    <span 
                                                                        style={{
                                                                            color: displayEstChangePct > 0 
                                                                                ? '#60a5fa' 
                                                                                : displayEstChangePct < 0 
                                                                                    ? '#f87171' 
                                                                                    : '#94a3b8'
                                                                        }}
                                                                    >
                                                                        ({displayEstChangePct > 0 ? '+' : ''}{displayEstChangePct.toFixed(2)}%)
                                                                    </span>
                                                                )}
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
                                                        {row.constituent in constituentTickerMap && constituentTickerMap[row.constituent].length > 4
                                                            ? `${new Intl.NumberFormat('ko-KR').format(Math.floor(row.price))}원`
                                                            : `$${row.price.toFixed(2)}`
                                                        }
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
                                            const isZero = !val || val === 0;
                                            if (isZero) {
                                                return (
                                                    <td key={k} className="px-3 py-2.5 text-center text-xs font-semibold text-gray-600 border-b border-white/5 font-mono">
                                                        -
                                                    </td>
                                                );
                                            }
                                            
                                            let cellColor = '#ffffff';
                                            if (val >= 20) {
                                                cellColor = '#10b981';
                                            } else if (val >= 10) {
                                                cellColor = '#84cc16';
                                            } else if (val >= 5) {
                                                cellColor = '#fbbf24';
                                            }

                                            return (
                                                <td key={k} className="px-3 py-2 border-b border-white/5 align-middle min-w-[125px]">
                                                    <div className="flex flex-col gap-1 w-full">
                                                        <div className="flex justify-end w-full">
                                                            <span 
                                                                className="text-[10.5px] font-bold font-mono"
                                                                style={{ color: cellColor }}
                                                            >
                                                                {val.toFixed(1)}%
                                                            </span>
                                                        </div>
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
        </div>
    );
}
