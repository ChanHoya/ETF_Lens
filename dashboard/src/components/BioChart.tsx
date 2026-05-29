"use client";

import React, { useState, useEffect } from 'react';
import { Activity, ArrowUpRight } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend } from 'recharts';
import { API_BASE } from '../lib/apiConfig';
import ChartLoadingPlaceholder from './ChartLoadingPlaceholder';

interface BioChartProps {
    onOpenDetail?: (code: string) => void;
}

const constituentTickerMap: { [key: string]: string } = {
    "삼성바이오로직스": "207940",
    "셀트리온": "068270",
    "알테오젠": "196170",
    "리가켐바이오": "141080",
    "유한양행": "000100",
    "한미약품": "128940",
    "SK바이오팜": "326030",
    "HLB": "028300",
    "삼천당제약": "000250",
    "셀트리온제약": "068760",
    "바이오니아": "064550",
    "에스티팜": "237690",
    "지아이이노베이션": "358570",
    "펩트론": "086520",
    "에이비엘바이오": "298380",
};

const getTickerFromConstituent = (name: string): string => {
    if (constituentTickerMap[name]) return constituentTickerMap[name];
    const normalized = name.trim();
    if (constituentTickerMap[normalized]) return constituentTickerMap[normalized];
    return normalized;
};

const etfNameToCodeMap: { [key: string]: string } = {
    "KoAct 바이오헬스케어액티브": "462900",
    "TIME K바이오액티브": "463050",
    "KODEX 바이오": "244580",
    "TIGER 헬스케어": "143860",
    "TIGER 바이오TOP10": "364970",
};

export default function BioChart({ onOpenDetail }: BioChartProps) {
    const [period, setPeriod] = useState('1Y');
    const [chartData, setChartData] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [hoveredLine, setHoveredLine] = useState<string | null>(null);
    const [keys, setKeys] = useState<string[]>([]);
    const [originalData, setOriginalData] = useState<any[]>([]);
    const [selectedEtf, setSelectedEtf] = useState<string | null>(null);
    
    // Holdings comparison state
    const [holdingsData, setHoldingsData] = useState<any[]>([]);
    const [holdingsKeys, setHoldingsKeys] = useState<string[]>([]);
    const [isHoldingsLoading, setIsHoldingsLoading] = useState(true);
    const [disparityData, setDisparityData] = useState<{ [key: string]: any }>({});

    useEffect(() => {
        const fetchDisparity = async () => {
            try {
                const res = await fetch(`${API_BASE}/api/v1/analyze/etf/disparity?codes=462900,463050,244580,143860,364970`);
                if (res.ok) {
                    const data = await res.json();
                    setDisparityData(data);
                }
            } catch (err) {
                console.error('Error fetching Bio ETF disparity:', err);
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
                const res = await fetch(`${API_BASE}/api/v1/analyze/bio-holdings`);
                if (!res.ok) throw new Error('API fetch error');
                const data = await res.json();
                if (data.table_data) {
                    setHoldingsData(data.table_data);
                    if (data.keys) {
                        setHoldingsKeys(data.keys);
                    }
                }
            } catch (err) {
                console.error('Error fetching bio holdings:', err);
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
                    ? `${API_BASE}/api/v1/analyze/bio-chart?etf=${encodeURIComponent(selectedEtf)}`
                    : `${API_BASE}/api/v1/analyze/bio-chart`;
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
                setError('서버에서 바이오 지수 데이터를 불러오지 못했습니다.');
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

        // 개별 자산 기준일 가격(Base Value) 계산
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
    const colors = ['#f59e0b', '#ec4899', '#3b82f6', '#10b981', '#8b5cf6', '#06b6d4', '#14b8a6', '#f43f5e', '#a855f7', '#6366f1'];

    const etfsToSelect = [
        "KoAct 바이오헬스케어액티브",
        "TIME K바이오액티브",
        "KODEX 바이오",
        "TIGER 헬스케어",
        "TIGER 바이오TOP10"
    ];

    const baseEtfKeys = [
        "KoAct 바이오헬스케어액티브",
        "TIME K바이오액티브",
        "KODEX 바이오",
        "TIGER 헬스케어",
        "TIGER 바이오TOP10"
    ];

    // 커스텀 툴팁: 전일 대비 증감율 표시
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

    // Filter and sort holdings table data if an ETF is selected
    const displayHoldingsKeys = selectedEtf ? [selectedEtf] : holdingsKeys;
    const displayHoldingsData = selectedEtf
        ? holdingsData
              .filter((row) => row[selectedEtf] !== undefined && row[selectedEtf] > 0)
              .sort((a, b) => (b[selectedEtf] || 0) - (a[selectedEtf] || 0))
              .slice(0, 10)
        : holdingsData;

    return (
        <div className="w-full bg-[#121217]/60 border border-white/10 rounded-3xl p-4 xl:p-5 backdrop-blur-md shadow-xl flex flex-col mt-0">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-3">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Activity className="w-5 h-5 text-indigo-400" />
                    바이오섹터 주요 종목 현황
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

            {/* ETF Selector Chips for Constituent Overlay */}
            <div className="flex flex-wrap gap-2 items-center mb-4 bg-black/30 p-2.5 rounded-2xl border border-white/5">
                <span className="text-[11px] font-bold text-gray-400 mr-1 flex items-center">
                    🔍 구성종목 주가 비교:
                </span>
                {etfsToSelect.map((etfName, idx) => {
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
                    <ChartLoadingPlaceholder height={400} message="바이오 ETF 데이터 로딩중" />
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
                                onClick={(o) => {
                                    const clickedKey = o.dataKey as string;
                                    if (etfsToSelect.includes(clickedKey)) {
                                        setSelectedEtf(prev => prev === clickedKey ? null : clickedKey);
                                    }
                                }}
                                onMouseEnter={handleLegendMouseEnter}
                                onMouseLeave={handleLegendMouseLeave}
                                wrapperStyle={{ paddingTop: '10px', fontSize: '12px', cursor: 'pointer' }}
                                iconType="circle"
                            />
                            {keys.map((k, idx) => {
                                const isConstituent = !baseEtfKeys.includes(k);
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
            <div className="flex flex-col gap-3">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center w-full gap-1">
                    <h4 className="text-base font-bold text-white flex items-center gap-2">
                        <Activity className="w-4 h-4 text-emerald-400" />
                        바이오섹터 주요 ETF 구성종목 및 비중 비교 (%)
                    </h4>
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
                                    {displayHoldingsKeys.map((k, idx) => {
                                        const originalIdx = holdingsKeys.indexOf(k);
                                        const dotColor = colors[originalIdx >= 0 ? originalIdx : idx % colors.length];
                                        return (
                                            <th key={k} className="px-3 py-3 text-center text-xs font-bold text-gray-300 border-b border-white/10">
                                                <div className="flex items-center justify-center gap-1.5 whitespace-nowrap">
                                                    <span style={{ color: dotColor }}>●</span>
                                                    {k}
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
