"use client";

import React, { useState, useEffect } from 'react';
import { Activity, ArrowUpRight, Sparkles, TrendingUp, BookOpen, PieChart, BarChart3, AlertTriangle, Cpu, GitBranch, ArrowRight, Target } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ScatterChart, Scatter, ReferenceLine, ZAxis } from 'recharts';
import { API_BASE } from '../lib/apiConfig';
import ChartLoadingPlaceholder from './ChartLoadingPlaceholder';

interface SemiChartProps {
    onOpenDetail?: (code: string) => void;
}

const constituentTickerMap: { [key: string]: string } = {
    "삼성전자": "005930",
    "SK하이닉스": "000660",
    "한미반도체": "042700",
    "리노공업": "058470",
    "HPSP": "403870",
    "이오테크닉스": "039030",
    "하나마이크론": "067310",
    "동진쎄미켐": "005290",
    "솔브레인": "357780",
    "원익IPS": "240810",
    "주성엔지니어링": "036930",
    "DB하이텍": "000990",
    "ISC": "095340",
    "피에스케이홀딩스": "002920",
    "테스": "095610",
    "에스티아이": "039440",
    "SNS텍": "101490",
    "ASML": "ASML",
    "TSMC": "TSM",
    "NVIDIA": "NVDA",
    "Broadcom": "AVGO",
    "AMD": "AMD",
    "Intel": "INTC",
    "Qualcomm": "QCOM",
    "Micron": "MU",
    "Applied Materials": "AMAT",
    "Lam Research": "LRCX",
    "KLA Corp": "KLAC",
    "Arm Holdings": "ARM",
    "Texas Instruments": "TXN",
    "Analog Devices": "ADI",
    "Microchip": "MCHP",
    "NXP Semiconductors": "NXPI",
};

const getTickerFromConstituent = (name: string): string => {
    if (constituentTickerMap[name]) return constituentTickerMap[name];
    const normalized = name.trim();
    if (constituentTickerMap[normalized]) return constituentTickerMap[normalized];
    return normalized;
};

const etfNameToCodeMap: { [key: string]: string } = {
    "TIGER 반도체TOP10": "396500",
    "ACE AI반도체TOP3+": "469150",
    "KODEX AI반도체핵심장비": "471990",
    "SOL AI반도체소부장": "455850",
    "TIGER 삼성전자레버리지": "0195R0",
    "TIGER 하이닉스레버리지": "0195S0",
    "KODEX 삼성전자레버리지": "0193W0",
    "KODEX 하이닉스레버리지": "0193T0",
    "TIGER 미국필라델피아반도체나스닥": "381180",
    "TIGER 미국필라델피아AI반도체나스닥": "497570",
    "SMH": "SMH",
    "SOXQ": "SOXQ",
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
        return minutesSinceMidnight < 540; // Before 09:00 KST
    } catch (e) {
        console.error('Failed to check KR market status:', e);
        return false;
    }
};

export default function SemiChart({ onOpenDetail }: SemiChartProps) {
    const [period, setPeriod] = useState('1Y');
    const [chartData, setChartData] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [hoveredLine, setHoveredLine] = useState<string | null>(null);
    const [keys, setKeys] = useState<string[]>([]);
    const [originalData, setOriginalData] = useState<any[]>([]);
    const [selectedEtf, setSelectedEtf] = useState<string | null>(null);
    const [marketTab, setMarketTab] = useState<'KR' | 'KR_US' | 'US'>('KR');
    
    // Holdings comparison state
    const [holdingsData, setHoldingsData] = useState<any[]>([]);
    const [holdingsKeys, setHoldingsKeys] = useState<string[]>([]);
    const [isHoldingsLoading, setIsHoldingsLoading] = useState(true);
    const [holdingsUpdatedAt, setHoldingsUpdatedAt] = useState<string>('');
    const [isMarketOpen, setIsMarketOpen] = useState<boolean>(() => checkIsUsMarketOpenClient());
    const [disparityData, setDisparityData] = useState<{ [key: string]: any }>({});
    const [activeInsightTab, setActiveInsightTab] = useState<'macro' | 'etfs' | 'strategy' | 'qcycle'>('macro');

    // Q-Cycle Screener
    const [screenerData, setScreenerData] = useState<any[]>([]);
    const [screenerLoading, setScreenerLoading] = useState(false);
    const [screenerUpdatedAt, setScreenerUpdatedAt] = useState<string>('');

    useEffect(() => {
        const fetchDisparity = async () => {
            try {
                const res = await fetch(`${API_BASE}/api/v1/analyze/etf/disparity?codes=396500,469150,471990,455850,0195R0,0195S0,0193W0,0193T0,381180,497570,SMH,SOXQ`, { cache: 'no-store' });
                if (res.ok) {
                    const data = await res.json();
                    setDisparityData(data);
                }
            } catch (err) {
                console.error('Error fetching Semiconductor ETF disparity:', err);
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
                const res = await fetch(`${API_BASE}/api/v1/analyze/semi-holdings`, { cache: 'no-store' });
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
                console.error('Error fetching semiconductor holdings:', err);
            } finally {
                setIsHoldingsLoading(false);
            }
        };
        fetchHoldings();
    }, []);

    useEffect(() => {
        if (activeInsightTab !== 'qcycle' || screenerData.length > 0) return;
        const fetchScreener = async () => {
            setScreenerLoading(true);
            try {
                const res = await fetch(`${API_BASE}/api/v1/analyze/semi-screener`, { cache: 'no-store' });
                if (res.ok) {
                    const json = await res.json();
                    setScreenerData(json.data || []);
                    setScreenerUpdatedAt(json.updated_at || '');
                }
            } catch (e) {
                console.error('screener fetch error', e);
            } finally {
                setScreenerLoading(false);
            }
        };
        fetchScreener();
    }, [activeInsightTab]);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const url = selectedEtf
                    ? `${API_BASE}/api/v1/analyze/semi-chart?etf=${encodeURIComponent(selectedEtf)}`
                    : `${API_BASE}/api/v1/analyze/semi-chart`;
                const res = await fetch(url, { cache: 'no-store' });
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
                setError('서버에서 반도체 지수 데이터를 불러오지 못했습니다.');
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
        '#8b5cf6', '#ec4899', '#3b82f6', '#10b981', '#f59e0b', 
        '#06b6d4', '#a855f7', '#6366f1', '#14b8a6', '#f43f5e', 
        '#e11d48', '#0ea5e9'
    ];

    const krEtfs = [
        "TIGER 반도체TOP10", 
        "ACE AI반도체TOP3+", 
        "KODEX AI반도체핵심장비", 
        "SOL AI반도체소부장",
        "TIGER 삼성전자레버리지", 
        "TIGER 하이닉스레버리지", 
        "KODEX 삼성전자레버리지", 
        "KODEX 하이닉스레버리지"
    ];
    const krUsEtfs = [
        "TIGER 미국필라델피아반도체나스닥",
        "TIGER 미국필라델피아AI반도체나스닥"
    ];
    const usEtfs = ["SMH", "SOXQ"];

    const etfsToSelect = [...krEtfs, ...krUsEtfs, ...usEtfs];
    const baseEtfKeys = [
        ...krEtfs,
        ...krUsEtfs,
        ...usEtfs
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

    const activeTabEtfs = 
        marketTab === 'KR' 
            ? krEtfs 
            : marketTab === 'KR_US' 
                ? krUsEtfs 
                : usEtfs;
    const displayHoldingsKeys = selectedEtf
        ? [selectedEtf]
        : holdingsKeys.filter((k) => activeTabEtfs.includes(k));

    const displayHoldingsData = selectedEtf
        ? holdingsData
              .filter((row) => row[selectedEtf] !== undefined && row[selectedEtf] > 0)
              .sort((a, b) => (b[selectedEtf] || 0) - (a[selectedEtf] || 0))
        : holdingsData
              .filter((row) => displayHoldingsKeys.some((k) => row[k] !== undefined && row[k] > 0))
              .sort((a, b) => {
                  const sumA = displayHoldingsKeys.reduce((sum, k) => sum + (a[k] || 0), 0);
                  const sumB = displayHoldingsKeys.reduce((sum, k) => sum + (b[k] || 0), 0);
                  return sumB - sumA;
              });

    const renderCustomLegend = (props: any) => {
        const { payload } = props;
        if (!payload) return null;

        const koreanItems = payload.filter((entry: any) => krEtfs.includes(entry.value));
        const krUsItems = payload.filter((entry: any) => krUsEtfs.includes(entry.value));
        const usItems = payload.filter((entry: any) => usEtfs.includes(entry.value));
        const constituentItems = payload.filter((entry: any) => 
            !krEtfs.includes(entry.value) && 
            !krUsEtfs.includes(entry.value) && 
            !usEtfs.includes(entry.value)
        );

        return (
            <div className="flex flex-col gap-2 mt-4 text-xs font-semibold select-none">
                {koreanItems.length > 0 && (
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 justify-center">
                        <span className="text-[10px] font-bold text-gray-500 mr-1 uppercase tracking-wider">국내상장(국내주식):</span>
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
                {krUsItems.length > 0 && (
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 justify-center mt-0.5">
                        <span className="text-[10px] font-bold text-gray-500 mr-1 uppercase tracking-wider">국내상장(미국주식):</span>
                        {krUsItems.map((entry: any, index: number) => {
                            const isSelected = selectedEtf === entry.value;
                            return (
                                <button
                                    key={`krus-${index}`}
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
                        <span className="text-[10px] font-bold text-gray-500 mr-1 uppercase tracking-wider">해외상장 ETF:</span>
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
                        <span className="text-[9px] font-bold text-gray-500 mr-1 uppercase tracking-wider">편입종목:</span>
                        {constituentItems.map((entry: any, index: number) => (
                            <div
                                key={`holding-${index}`}
                                onMouseEnter={() => setHoveredLine(entry.value)}
                                onMouseLeave={() => setHoveredLine(null)}
                                className="flex items-center gap-1 text-[10px] text-gray-400 font-mono transition-colors"
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

    const GROUP_CONFIG: Record<string, { color: string }> = {
        '글로벌 WFE':       { color: '#8b5cf6' },
        '독점 해자':         { color: '#f59e0b' },
        '안전마진':          { color: '#10b981' },
        '사이클 턴어라운드': { color: '#3b82f6' },
        '기타':             { color: '#6b7280' },
    };

    const ScatterDot = (props: any) => {
        const { cx, cy, fill, payload } = props;
        if (cx == null || cy == null) return null;
        return (
            <g>
                <circle cx={cx} cy={cy} r={5} fill={fill} stroke="rgba(255,255,255,0.25)" strokeWidth={1} />
                <text x={cx + 7} y={cy + 4} fontSize={9} fill="rgba(220,225,240,0.9)" fontWeight="600">
                    {payload.name}
                </text>
            </g>
        );
    };

    const ScatterTooltip = ({ active, payload }: any) => {
        if (!active || !payload?.length) return null;
        const d = payload[0]?.payload;
        return (
            <div style={{ backgroundColor: 'rgba(18,18,35,0.97)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '10px 14px', fontSize: '12px' }}>
                <div style={{ fontWeight: 'bold', color: '#fff', marginBottom: '6px' }}>{d?.name} <span style={{ color: 'rgba(255,255,255,0.4)', fontWeight: 'normal' }}>({d?.ticker})</span></div>
                <div style={{ color: '#94a3b8' }}>OPM (TTM): <span style={{ color: '#34d399', fontWeight: 'bold' }}>{d?.opm != null ? `${d.opm}%` : 'N/A'}</span></div>
                <div style={{ color: '#94a3b8' }}>Trailing PER: <span style={{ color: '#fbbf24', fontWeight: 'bold' }}>{d?.per != null ? `${d.per}x` : 'N/A'}</span></div>
                <div style={{ color: '#6b7280', marginTop: '4px', fontSize: '10px' }}>{d?.group}</div>
            </div>
        );
    };

    return (
        <div className="w-full bg-[#121217]/60 border border-white/10 rounded-3xl p-4 xl:p-5 backdrop-blur-md shadow-xl flex flex-col mt-0">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-3">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Activity className="w-5 h-5 text-indigo-400" />
                    반도체 주요 종목 현황
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
                            국내상장 ETF(국내주식)
                        </button>
                        <button
                            onClick={() => {
                                setMarketTab('KR_US');
                                setSelectedEtf(null);
                            }}
                            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${marketTab === 'KR_US'
                                ? 'bg-indigo-600 text-white shadow-md'
                                : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
                            }`}
                        >
                            국내상장 ETF(미국주식)
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
                    <ChartLoadingPlaceholder height={400} message="반도체 ETF 데이터 로딩중" />
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
                        반도체 섹터 주요 ETF 구성종목 및 비중 비교 (%)
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
                    <div className="overflow-x-auto overflow-y-auto max-h-[600px] w-full rounded-2xl border border-white/10 bg-black/30 shadow-inner">
                        <table className="w-full text-left border-collapse">
                            <thead className="sticky top-0 z-10">
                                <tr className="bg-[#141420]">
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
                                        
                                        const isKrListed = krEtfs.includes(k) || krUsEtfs.includes(k);
                                        const isUsListed = usEtfs.includes(k);
                                        const isBeforeOpen = isBeforeKrMarketOpen();
                                        const actualPrice = dispInfo ? dispInfo.price : null;
                                        const actualChangeRate = dispInfo ? dispInfo.change_rate : null;

                                        const estPrice = isKrListed
                                            ? (isBeforeOpen ? null : actualPrice)
                                            : ((dispInfo && dispInfo.prev_close && estChangePct !== null)
                                                ? dispInfo.prev_close * (1 + estChangePct / 100)
                                                : null);
                                                
                                        const displayEstChangePct = isKrListed
                                            ? (isBeforeOpen ? null : actualChangeRate)
                                            : estChangePct;
                                            
                                        const diffRate = isKrListed
                                            ? (isBeforeOpen ? null : 0)
                                            : ((actualPrice !== null && estPrice !== null && estPrice > 0)
                                                ? ((actualPrice - estPrice) / estPrice) * 100
                                                : null);

                                        const showInfo = isKrListed 
                                            ? (isBeforeOpen ? true : (actualPrice !== null)) 
                                            : (estChangePct !== null);

                                        const shouldShowActualPrice = isKrListed 
                                            ? (!isBeforeOpen && actualPrice !== null) 
                                            : (actualPrice !== null);

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
                                                                        {isUsListed
                                                                            ? `$${estPrice.toFixed(2)}`
                                                                            : `${new Intl.NumberFormat('ko-KR').format(Math.floor(estPrice))}원`
                                                                        }
                                                                    </span>
                                                                ) : (
                                                                    <span>{isUsListed ? '-$' : '-원'}</span>
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
                                                                {shouldShowActualPrice ? (
                                                                    <>
                                                                        <span>
                                                                            {isUsListed
                                                                                ? `$${actualPrice!.toFixed(2)}`
                                                                                : `${new Intl.NumberFormat('ko-KR').format(Math.floor(actualPrice!))}원`
                                                                            }
                                                                        </span>
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
                                                                 {(isKrListed ? !isBeforeOpen : true) && diffRate !== null ? (
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
                                                        {(() => {
                                                            const ticker = constituentTickerMap[row.constituent];
                                                            const isKrStock = ticker && /^\d+$/.test(ticker);
                                                            return isKrStock
                                                                ? `${new Intl.NumberFormat('ko-KR').format(Math.floor(row.price))}원`
                                                                : `$${row.price.toFixed(2)}`;
                                                        })()}
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

            {/* Divider */}
            <div className="w-full border-t border-white/10 my-6"></div>

            {/* Expert Insight Section */}
            <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                    <h4 className="text-base font-extrabold text-white flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-amber-500 animate-pulse" />
                        AI 패러다임 쉬프트와 글로벌 반도체 공급망 전략
                    </h4>
                    <span className="text-[10px] text-amber-500/80 font-bold px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
                        Gemini Expert Report
                    </span>
                </div>

                {/* Tab Menu */}
                <div className="flex flex-wrap bg-[#1a1a23]/60 p-1 rounded-xl border border-white/5 gap-1 self-start">
                    {[
                        { id: 'macro', label: '1. 매크로 & AI 반도체 트렌드', icon: TrendingUp },
                        { id: 'etfs', label: '2. 국내외 핵심 ETF 분석', icon: BookOpen },
                        { id: 'strategy', label: '3. 자산배분 모델 & 가이드', icon: PieChart },
                        { id: 'qcycle', label: '4. Q-Cycle 퀀트 스크리너', icon: Cpu }
                    ].map((tab) => {
                        const Icon = tab.icon;
                        const isSelected = activeInsightTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveInsightTab(tab.id as any)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                                    isSelected
                                        ? tab.id === 'qcycle'
                                            ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md'
                                            : 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-md'
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
                        {/* Card 1: AI Blackwell Demand */}
                        <div className="bg-white/[0.02] hover:bg-white/[0.04] transition-all p-4 border border-white/5 rounded-2xl flex flex-col gap-2">
                            <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                                <TrendingUp className="w-4 h-4" />
                                <span>AI Blackwell & HBM3e/HBM4 수요 폭발</span>
                            </div>
                            <p className="text-xs text-gray-300 leading-relaxed">
                                NVIDIA의 차세대 블랙웰(Blackwell) 칩셋 양산 가속화와 함께 HBM3e 및 HBM4 수요가 연간 80% 이상 폭증하고 있습니다. TSMC의 어드밴스드 패키징(CoWoS) 캐파 병목과 고대역폭 메모리의 공급 정합성이 섹터 성장의 최대 핵심 동인입니다.
                            </p>
                        </div>
                        {/* Card 2: Capex */}
                        <div className="bg-white/[0.02] hover:bg-white/[0.04] transition-all p-4 border border-white/5 rounded-2xl flex flex-col gap-2">
                            <div className="flex items-center gap-2 text-red-400 font-bold text-sm">
                                <AlertTriangle className="w-4 h-4" />
                                <span>빅테크 파운드리 CAPEX 투자 사이클</span>
                            </div>
                            <p className="text-xs text-gray-300 leading-relaxed">
                                MS, 구글, 메타 등 하이퍼스케일러의 AI 인프라 자본지출(CAPEX)이 사상 최대치를 지속 갱신 중입니다. 이는 TSMC의 미국/유럽 선단 팹 증설 및 ASML의 하이 NA EUV 노광장비 도입 촉진으로 소부장 장비사들의 전례없는 장기 수주 사이클을 제공합니다.
                            </p>
                        </div>
                        {/* Card 3: Memory Cycle */}
                        <div className="bg-white/[0.02] hover:bg-white/[0.04] transition-all p-4 border border-white/5 rounded-2xl flex flex-col gap-2">
                            <div className="flex items-center gap-2 text-blue-400 font-bold text-sm">
                                <BarChart3 className="w-4 h-4" />
                                <span>메모리 사이클의 질적 변화 (Customization)</span>
                            </div>
                            <p className="text-xs text-gray-300 leading-relaxed">
                                범용 D램의 가격 변동 주기에 종속되던 과거와 달리, HBM, CXL 등 인공지능 친화형 맞춤형(Custom) 메모리 솔루션 비중이 급증하고 있습니다. 이는 메모리 공급사들의 판가 결정력을 크게 상향시켜 수익 다변화와 이익 안정성을 견인합니다.
                            </p>
                        </div>
                    </div>
                )}

                {activeInsightTab === 'etfs' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-1">
                        {/* KR ETFs */}
                        <div className="bg-white/[0.02] p-4 border border-white/5 rounded-2xl flex flex-col gap-3">
                            <h5 className="text-sm font-bold text-amber-400 border-b border-white/5 pb-2">국내 상장 핵심 ETF</h5>
                            <div className="flex flex-col gap-2.5 text-xs text-gray-300">
                                <div>
                                    <span className="font-bold text-white">TIGER 반도체TOP10 (396500) & ACE AI반도체TOP3+ (469150):</span>
                                    <p className="mt-0.5 text-gray-400">삼성전자와 SK하이닉스 투톱 비중이 매우 높으며, 한미반도체를 포함한 K-HBM 선도 밸류체인에 집중 배분합니다. 대형주 모멘텀 유입 시 가장 민감한 수익 탄력성을 자랑합니다.</p>
                                </div>
                                <div>
                                    <span className="font-bold text-white">KODEX AI반도체핵심장비 (471990) & SOL AI반도체소부장 (455850):</span>
                                    <p className="mt-0.5 text-gray-400">후공정 가공 및 HBM 핵심 기술을 쥔 한미반도체, 검사 소켓 대장주 리노공업, 전공정 원자재 부품사들을 고루 편입해 대형주 리스크를 분산하고 공정 국산화 수혜를 골고루 취합합니다.</p>
                                </div>
                                <div>
                                    <span className="font-bold text-white">TIGER 미국필라델피아반도체나스닥 (381180) & TIGER 미국필라델피아AI반도체나스닥 (497570):</span>
                                    <p className="mt-0.5 text-gray-400">전통적인 필라델피아 지수를 온전히 추종하여 안정적인 수익을 거두는 381180과 엔비디아, TSMC, 브로드컴 등 AI 반도체 최전선 핵심 10종에 초집중하여 주가 상승력을 극대화한 497570이 글로벌 투자에 적합합니다.</p>
                                </div>
                                <div>
                                    <span className="font-bold text-white">단일종목 2X 레버리지 Active ETF 계열:</span>
                                    <p className="mt-0.5 text-gray-400">삼성전자 또는 SK하이닉스의 일일 변동성 2배를 실시간 추종하여 강력한 단기 모멘텀 거래 기회를 제공합니다. 변동성 잠식 비용이 발생할 수 있어 장기 보유보다 전략적 분할 진입이 필요합니다.</p>
                                </div>
                            </div>
                        </div>
                        {/* US ETFs */}
                        <div className="bg-white/[0.02] p-4 border border-white/5 rounded-2xl flex flex-col gap-3">
                            <h5 className="text-sm font-bold text-orange-400 border-b border-white/5 pb-2">해외 상장 핵심 ETF</h5>
                            <div className="flex flex-col gap-2.5 text-xs text-gray-300">
                                <div>
                                    <span className="font-bold text-white">SMH (VanEck Semiconductor ETF | AUM $24.8B):</span>
                                    <p className="mt-0.5 text-gray-400">글로벌 팹리스 최강자 NVIDIA와 글로벌 파운드리 1위 TSMC, 통신 네트워크 칩 선두 Broadcom의 상위 3사 비중을 약 42% 이상 압축 배분하여 최강의 성장성을 증명하는 글로벌 대장주 ETF입니다.</p>
                                </div>
                                <div>
                                    <span className="font-bold text-white">SOXQ (Invesco PHLX Semiconductor ETF | AUM $3.2B):</span>
                                    <p className="mt-0.5 text-gray-400">필라델피아 반도체 지수를 저렴한 보수(연 0.19%)로 온전히 누릴 수 있어 장기 연금 적립식 투자의 기초 자산으로 적합하며, 인텔 및 아날로그 디바이스 등 다양한 밸류 라인업을 고르게 보완합니다.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeInsightTab === 'strategy' && (
                    <div className="bg-white/[0.02] p-4 border border-white/5 rounded-2xl flex flex-col gap-4 mt-1">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <h5 className="text-xs font-bold text-amber-400 mb-2 flex items-center gap-1">
                                    <PieChart className="w-3.5 h-3.5" />
                                    포트폴리오 자산배분 모델 제안
                                </h5>
                                <div className="text-xs text-gray-300 space-y-2 leading-relaxed font-sans">
                                    <div>
                                        <span className="font-bold text-white">공격성장형 (반도체 60% : 기타 40%):</span>
                                        <span className="text-gray-400"> SMH 25% + ACE AI반도체 20% + SOL 소부장 15% | S&P 500 20% + 미국 채권 20%</span>
                                    </div>
                                    <div>
                                        <span className="font-bold text-white">균형포커스형 (반도체 40% : 기타 60%):</span>
                                        <span className="text-gray-400"> TIGER 미필반나 20% + TIGER 반도체TOP10 15% + SOXQ 5% | 배당성장 30% + 국채 30%</span>
                                    </div>
                                    <div>
                                        <span className="font-bold text-white">인컴방어형 (반도체 20% : 기타 80%):</span>
                                        <span className="text-gray-400"> SOXQ 10% + SOL 소부장 10% | 커버드콜 배당 40% + 중단기 우량 회사채 40%</span>
                                    </div>
                                </div>
                            </div>
                            <div>
                                <h5 className="text-xs font-bold text-amber-400 mb-2 flex items-center gap-1">
                                    <TrendingUp className="w-3.5 h-3.5" />
                                    반도체 이격 신호등 및 기술적 매매 진입 가이드
                                </h5>
                                <div className="text-xs text-gray-300 space-y-2 leading-relaxed">
                                    <div>
                                        <span className="font-bold text-white">이격 신호등 기반 진입 기준:</span>
                                        <p className="mt-0.5 text-gray-400">핵심 반도체 ETF의 200일 SMA 대비 이격도가 90% 이하로 수축되고, 지수 12개월 Forward P/E가 22배 이하(SOX 기준)로 떨어지며 RSI가 35 수준으로 냉각될 때 적극적인 분할 진입 시점으로 간주합니다.</p>
                                    </div>
                                    <div>
                                        <span className="font-bold text-white">추세 이격 과열 및 분할 매도 기준:</span>
                                        <p className="mt-0.5 text-gray-400">200일 SMA 대비 이격도가 +25% 이상 급속 벌어지며, 단기 RSI가 75를 초과하는 오버슈팅 국면 도래 시 포지션의 30% 수준을 부분 실현하여 이익을 확정 짓는 것을 권장합니다.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="border-t border-white/5 pt-3">
                            <p className="text-[10px] text-gray-500 leading-relaxed">
                                * 반도체 섹터는 전력 에너지나 바이오 대비 높은 주가 변동성(Beta)과 주기성을 가집니다. AI의 장기 성장 잠재력은 강력하나 단기 매크로 경기 위축 시 변동성이 큰 만큼 레버리지 상품은 단기 트레이딩 위주로 접근하고, 장기 포지션은 보수가 저렴한 필라델피아 지수 추종 상품으로 적립하는 투 트랙 운용을 권장합니다.
                            </p>
                        </div>
                    </div>
                )}

                {activeInsightTab === 'qcycle' && (
                    <div className="flex flex-col gap-6 mt-1">

                        {/* 현재 국면 표시 */}
                        <div className="flex flex-col sm:flex-row gap-3">
                            <div className="flex-1 flex items-center gap-3 bg-indigo-500/10 border border-indigo-500/30 rounded-xl p-3">
                                <div className="w-2.5 h-2.5 rounded-full bg-indigo-400 animate-pulse shrink-0" />
                                <div>
                                    <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">현재 Q-Cycle 국면</div>
                                    <div className="text-sm font-bold text-white">Phase 1 · 전공정(Front-end) 중심</div>
                                    <div className="text-[11px] text-indigo-300 mt-0.5">삼성 P4 조기 집행 + TSMC CAPEX +62% → 전공정 ETF 비중 구조적 확대 구간</div>
                                </div>
                            </div>
                            <div className="flex-1 flex items-center gap-3 bg-white/[0.02] border border-white/10 rounded-xl p-3 opacity-60">
                                <div className="w-2.5 h-2.5 rounded-full bg-gray-500 shrink-0" />
                                <div>
                                    <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">다음 국면 (예정)</div>
                                    <div className="text-sm font-bold text-gray-400">Phase 2 · 후공정(Back-end) 리밸런싱</div>
                                    <div className="text-[11px] text-gray-500 mt-0.5">OSAT 증설 발표 본격화 시점에 후공정 ETF로 비중 이동</div>
                                </div>
                            </div>
                        </div>

                        {/* WFE 투자 thesis 카드 3개 */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 flex flex-col gap-2">
                                <div className="flex items-center gap-2 text-violet-400 font-bold text-sm">
                                    <Target className="w-4 h-4" />
                                    <span>WFE 병목: AI 자본의 최종 목적지</span>
                                </div>
                                <p className="text-xs text-gray-300 leading-relaxed">
                                    AI 메가 펀딩 → 데이터센터 증설 → 파운드리/메모리 신규 팹 → <span className="text-violet-300 font-bold">전공정 반도체 장비(WFE) 수요 폭발</span>. 자본의 병목 현상이 발생하는 좁은 출구(WFE)에 투자해야 가장 높은 레버리지 효과를 얻을 수 있습니다.
                                </p>
                            </div>
                            <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 flex flex-col gap-2">
                                <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                                    <GitBranch className="w-4 h-4" />
                                    <span>Q사이클: 물량 확대 국면 진입</span>
                                </div>
                                <p className="text-xs text-gray-300 leading-relaxed">
                                    P사이클(감산·ASP 회복)을 넘어 <span className="text-amber-300 font-bold">Q사이클(신규 팹 증설·CAPEX 확대)</span>로 전환. 수혜 섹터도 메모리 IDM 본사 → 증착·식각·세정·검사 장비 및 소재/부품으로 이동합니다.
                                </p>
                            </div>
                            <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 flex flex-col gap-2">
                                <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                                    <ArrowRight className="w-4 h-4" />
                                    <span>승자 독식 리스크 제거 전략</span>
                                </div>
                                <p className="text-xs text-gray-300 leading-relaxed">
                                    TSMC가 이기든, 인텔이 이기든, 삼성이 이기든 — 결국 첨단 팹에는 <span className="text-emerald-300 font-bold">동일한 WFE 장비</span>가 들어갑니다. 개별 칩 메이커의 수율·수주 경쟁 리스크를 피하고 확정된 팹 증설에만 배팅하는 구조적 전략입니다.
                                </p>
                            </div>
                        </div>

                        {/* 공정별 6개월 시차 로테이션 타임라인 */}
                        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4">
                            <h5 className="text-xs font-bold text-gray-300 mb-4 flex items-center gap-2">
                                <Activity className="w-3.5 h-3.5 text-indigo-400" />
                                공정별 6개월 시차 로테이션 타임라인
                            </h5>
                            <div className="flex items-center gap-0 w-full overflow-x-auto">
                                {/* Step 1: Cleanroom */}
                                <div className="flex flex-col items-center gap-2 min-w-[110px]">
                                    <div className="w-10 h-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-xs font-bold text-gray-400">S1</div>
                                    <div className="text-center">
                                        <div className="text-[10px] font-bold text-gray-400">클린룸 구축</div>
                                        <div className="text-[9px] text-gray-600 mt-0.5">기초 인프라</div>
                                        <div className="text-[9px] text-gray-600">T+0</div>
                                    </div>
                                </div>
                                <div className="flex-1 flex flex-col items-center gap-1 min-w-[80px]">
                                    <div className="w-full h-px bg-white/20 relative">
                                        <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-white/30" />
                                    </div>
                                    <div className="text-[9px] text-gray-500">+6개월</div>
                                </div>
                                {/* Step 2: Front-end (CURRENT) */}
                                <div className="flex flex-col items-center gap-2 min-w-[130px]">
                                    <div className="relative">
                                        <div className="w-10 h-10 rounded-full bg-indigo-500/30 border-2 border-indigo-400 flex items-center justify-center text-xs font-bold text-indigo-300">S2</div>
                                        <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-indigo-400 animate-ping" />
                                        <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-indigo-400" />
                                    </div>
                                    <div className="text-center">
                                        <div className="text-[10px] font-bold text-indigo-300">전공정 장비 발주</div>
                                        <div className="text-[9px] text-indigo-400/70 mt-0.5">ASML/AMAT/LRCX</div>
                                        <div className="text-[9px] text-indigo-400/70">유진테크/원익IPS</div>
                                        <div className="text-[9px] font-bold text-indigo-300 mt-1 px-2 py-0.5 rounded-full border border-indigo-400/50 bg-indigo-400/10">← 현재 국면</div>
                                    </div>
                                </div>
                                <div className="flex-1 flex flex-col items-center gap-1 min-w-[80px]">
                                    <div className="w-full h-px bg-white/10" />
                                    <div className="text-[9px] text-gray-600">+6개월</div>
                                </div>
                                {/* Step 3: Back-end */}
                                <div className="flex flex-col items-center gap-2 min-w-[110px] opacity-50">
                                    <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-xs font-bold text-gray-600">S3</div>
                                    <div className="text-center">
                                        <div className="text-[10px] font-bold text-gray-500">후공정 장비 발주</div>
                                        <div className="text-[9px] text-gray-600 mt-0.5">OSAT 증설 시점</div>
                                        <div className="text-[9px] text-gray-600">리밸런싱 타점</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 퀀트 스크리너: OPM vs PER 스캐터 차트 */}
                        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4">
                            <div className="flex items-center justify-between mb-1">
                                <h5 className="text-xs font-bold text-gray-300 flex items-center gap-2">
                                    <Target className="w-3.5 h-3.5 text-violet-400" />
                                    퀀트 스크리너: TTM OPM × Trailing PER 포지셔닝
                                </h5>
                                <div className="flex items-center gap-3">
                                    {screenerUpdatedAt && (
                                        <span className="text-[9px] text-gray-600">기준: {screenerUpdatedAt} TTM 실제</span>
                                    )}
                                    <span className="text-[9px] text-amber-600/80 font-bold px-2 py-0.5 rounded bg-amber-600/10 border border-amber-600/20">컨센서스 미사용</span>
                                </div>
                            </div>

                            {/* 그룹 범례 */}
                            <div className="flex flex-wrap gap-3 mb-4 mt-2">
                                {Object.entries(GROUP_CONFIG).map(([g, cfg]) => (
                                    <div key={g} className="flex items-center gap-1.5 text-[10px] text-gray-400">
                                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cfg.color }} />
                                        {g}
                                    </div>
                                ))}
                            </div>

                            {screenerLoading ? (
                                <div className="h-[340px] flex items-center justify-center text-gray-500 text-sm">
                                    <div className="flex flex-col items-center gap-3">
                                        <div className="w-6 h-6 border-2 border-violet-500/50 border-t-violet-400 rounded-full animate-spin" />
                                        Yahoo Finance에서 TTM 재무 데이터 조회 중...
                                    </div>
                                </div>
                            ) : screenerData.length === 0 ? (
                                <div className="h-[340px] flex items-center justify-center text-gray-500 text-sm">데이터 없음</div>
                            ) : (
                                <>
                                    <div className="relative">
                                        {/* 사분면 레이블 */}
                                        <div className="absolute top-2 left-[20%] text-[10px] text-emerald-400/60 font-bold pointer-events-none z-10">안전마진 영역</div>
                                        <div className="absolute top-2 right-4 text-[10px] text-amber-400/60 font-bold pointer-events-none z-10">독점 해자 영역</div>
                                        <div className="absolute bottom-10 right-4 text-[10px] text-blue-400/40 font-bold pointer-events-none z-10">사이클 턴어라운드</div>
                                        <ResponsiveContainer width="100%" height={340}>
                                            <ScatterChart margin={{ top: 20, right: 40, bottom: 20, left: 20 }}>
                                                <CartesianGrid stroke="rgba(255,255,255,0.05)" />
                                                <XAxis
                                                    dataKey="per"
                                                    type="number"
                                                    name="Trailing PER"
                                                    domain={[0, 'auto']}
                                                    tickFormatter={(v) => `${v}x`}
                                                    tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }}
                                                    label={{ value: 'Trailing PER (배수)', position: 'insideBottom', offset: -10, fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
                                                />
                                                <YAxis
                                                    dataKey="opm"
                                                    type="number"
                                                    name="TTM OPM"
                                                    tickFormatter={(v) => `${v}%`}
                                                    tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }}
                                                    label={{ value: 'TTM OPM (%)', angle: -90, position: 'insideLeft', offset: 10, fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
                                                />
                                                <ZAxis range={[60, 60]} />
                                                <RechartsTooltip content={<ScatterTooltip />} />
                                                {/* 사분면 구분선 */}
                                                <ReferenceLine y={30} stroke="rgba(255,255,255,0.1)" strokeDasharray="4 4" />
                                                <ReferenceLine x={25} stroke="rgba(255,255,255,0.1)" strokeDasharray="4 4" />
                                                {Object.keys(GROUP_CONFIG).map((group) => {
                                                    const groupData = screenerData
                                                        .filter((d) => d.group === group && d.opm != null && d.per != null)
                                                        .map((d) => ({ ...d, x: d.per, y: d.opm }));
                                                    if (groupData.length === 0) return null;
                                                    return (
                                                        <Scatter
                                                            key={group}
                                                            name={group}
                                                            data={groupData}
                                                            fill={GROUP_CONFIG[group].color}
                                                            shape={(props: any) => <ScatterDot {...props} fill={GROUP_CONFIG[group].color} />}
                                                        />
                                                    );
                                                })}
                                            </ScatterChart>
                                        </ResponsiveContainer>
                                    </div>

                                    {/* 데이터 테이블 */}
                                    <div className="mt-4 overflow-x-auto">
                                        <table className="w-full text-xs">
                                            <thead>
                                                <tr className="border-b border-white/10">
                                                    <th className="px-3 py-2 text-left text-gray-400 font-bold">종목</th>
                                                    <th className="px-3 py-2 text-center text-gray-400 font-bold">그룹</th>
                                                    <th className="px-3 py-2 text-right text-gray-400 font-bold">TTM OPM</th>
                                                    <th className="px-3 py-2 text-right text-gray-400 font-bold">Trailing PER</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {[...screenerData]
                                                    .sort((a, b) => (b.opm ?? -999) - (a.opm ?? -999))
                                                    .map((item) => {
                                                        const cfg = GROUP_CONFIG[item.group] || { color: '#6b7280' };
                                                        return (
                                                            <tr key={item.ticker} className="border-b border-white/5 hover:bg-white/[0.02]">
                                                                <td className="px-3 py-2 font-bold text-gray-200">
                                                                    {item.name}
                                                                    <span className="text-gray-600 font-normal ml-1.5 text-[10px]">{item.ticker}</span>
                                                                </td>
                                                                <td className="px-3 py-2 text-center">
                                                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold" style={{ color: cfg.color, backgroundColor: cfg.color + '20' }}>
                                                                        {item.group}
                                                                    </span>
                                                                </td>
                                                                <td className="px-3 py-2 text-right font-mono font-bold" style={{ color: item.opm != null ? (item.opm >= 30 ? '#34d399' : item.opm >= 20 ? '#fbbf24' : '#94a3b8') : '#4b5563' }}>
                                                                    {item.opm != null ? `${item.opm}%` : '–'}
                                                                </td>
                                                                <td className="px-3 py-2 text-right font-mono font-bold text-amber-400">
                                                                    {item.per != null ? `${item.per}x` : '–'}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                            </tbody>
                                        </table>
                                    </div>
                                </>
                            )}
                        </div>

                        <p className="text-[10px] text-gray-600 leading-relaxed">
                            * TTM(최근 4분기 합산) 실제 기준 · 컨센서스/FnGuide 미사용 · 출처: Yahoo Finance · 투자 권유 아님. 음수 PER은 표시 제외.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
