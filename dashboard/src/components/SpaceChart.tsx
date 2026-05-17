"use client";

import React, { useState, useEffect } from 'react';
import { Activity } from 'lucide-react';
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

export default function SpaceChart({ onOpenDetail }: SpaceChartProps) {
    const [period, setPeriod] = useState('1Y');
    const [chartData, setChartData] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [hoveredLine, setHoveredLine] = useState<string | null>(null);
    const [keys, setKeys] = useState<string[]>([]);
    const [originalData, setOriginalData] = useState<any[]>([]);
    
    // Holdings comparison state
    const [holdingsData, setHoldingsData] = useState<any[]>([]);
    const [holdingsKeys, setHoldingsKeys] = useState<string[]>([]);
    const [isHoldingsLoading, setIsHoldingsLoading] = useState(true);

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
                const res = await fetch(`${API_BASE}/api/v1/analyze/space-chart`);
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
    }, []);

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

        // ─── 공통 기준일 계산 ───────────────────────────────────────────
        // 모든 티커에 유효한 데이터가 있는 첫 번째 날짜를 공통 base=100 기준일로 사용.
        const commonBaseRow = filtered.find(d => keys.every(k => d[k] != null && d[k] > 0));
        if (!commonBaseRow) {
            setChartData([]);
            return;
        }

        const baseValues: any = {};
        keys.forEach(k => {
            baseValues[k] = commonBaseRow[k];
        });

        // 공통 기준일 이후 데이터만 사용
        const alignedData = filtered.filter(d => d.date >= commonBaseRow.date);

        const normalizedData = alignedData.map(d => {
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
    const colors = ['#f59e0b', '#ec4899', '#3b82f6', '#10b981', '#8b5cf6', '#06b6d4'];

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

    return (
        <div className="w-full bg-[#121217]/60 border border-white/10 rounded-3xl p-4 xl:p-5 backdrop-blur-md shadow-xl flex flex-col mt-0">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Activity className="w-5 h-5 text-indigo-400" />
                    우주섹터 주요 종목 현황
                </h3>
                <div className="flex bg-black/40 rounded-lg p-1 border border-white/5 shadow-inner">
                    {periodOptions.map(p => (
                        <button
                            key={p}
                            onClick={() => setPeriod(p)}
                            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${period === p
                                ? 'bg-indigo-600 text-white shadow-md'
                                : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
                            }`}
                        >
                            {p}
                        </button>
                    ))}
                </div>
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
                                onMouseEnter={handleLegendMouseEnter}
                                onMouseLeave={handleLegendMouseLeave}
                                wrapperStyle={{ paddingTop: '10px', fontSize: '12px' }}
                                iconType="circle"
                            />
                            {keys.map((k, idx) => (
                                <Line
                                    key={k}
                                    type="monotone"
                                    dataKey={k}
                                    stroke={colors[idx % colors.length]}
                                    strokeWidth={hoveredLine === k ? 4 : hoveredLine ? 1 : 2}
                                    dot={false}
                                    activeDot={{ r: 4, strokeWidth: 0, fill: colors[idx % colors.length] }}
                                    name={k}
                                    connectNulls={true}
                                    style={{
                                        opacity: hoveredLine === k ? 1 : hoveredLine ? 0.3 : 0.8,
                                        transition: 'all 0.3s ease'
                                    }}
                                />
                            ))}
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
            <div className="flex flex-col gap-3">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center w-full gap-1">
                    <h4 className="text-base font-bold text-white flex items-center gap-2">
                        <Activity className="w-4 h-4 text-emerald-400" />
                        우주섹터 주요 ETF 구성종목 및 비중 비교 (%)
                    </h4>
                    <span className="text-[10px] sm:text-xs text-gray-400 font-bold font-mono bg-white/5 px-2 py-0.5 rounded border border-white/5">
                        NASDAQ 26.5.15 기준
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
                                    {holdingsKeys.map((k, idx) => (
                                        <th key={k} className="px-3 py-3 text-center text-xs font-bold text-gray-300 border-b border-white/10">
                                            <div className="flex items-center justify-center gap-1.5 whitespace-nowrap">
                                                <span style={{ color: colors[idx % colors.length] }}>●</span>
                                                {k}
                                            </div>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {holdingsData.map((row) => (
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
                                                    className="text-gray-200 hover:text-indigo-400 hover:underline transition-all duration-200 text-left font-bold"
                                                >
                                                    {row.constituent}
                                                </button>
                                            ) : (
                                                <span className="text-gray-200">{row.constituent}</span>
                                            )}
                                        </td>
                                        {holdingsKeys.map((k) => {
                                            const val = row[k];
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
        </div>
    );
}
