"use client";

import React, { useState, useEffect } from 'react';
import { Activity, Globe, Zap, Landmark, Shield, Rocket, FlaskConical, Cpu } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend } from 'recharts';
import { API_BASE } from '../lib/apiConfig';
import ChartLoadingPlaceholder from './ChartLoadingPlaceholder';

interface SectorComparisonChartProps {
    region: 'KR' | 'US' | 'ALL';
    selectedSector?: string | null;
}

export default function SectorComparisonChart({ region, selectedSector = null }: SectorComparisonChartProps) {
    const [period, setPeriod] = useState('1Y');
    const [chartData, setChartData] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [hoveredLine, setHoveredLine] = useState<string | null>(null);
    const [keys, setKeys] = useState<string[]>([]);
    const [originalData, setOriginalData] = useState<any[]>([]);

    const getVisibleKeys = () => {
        if (!selectedSector) return keys;
        
        const mapping: Record<string, string[]> = {
            '반도체': ['K-반도체', 'US-Semi'],
            '반도체소부장': ['K-반도체소부장', 'US-SemiParts'],
            '우주': ['K-우주', 'US-Space'],
            'AI전력': ['K-AI전력', 'US-AI전력'],
            '조선': ['K-조선', 'US-Shipbuilding'],
            '바이오': ['K-바이오', 'US-Bio'],
            '2차전지': ['K-2차전지', 'US-Battery']
        };
        
        return (mapping[selectedSector] || []).filter(k => keys.includes(k));
    };

    const visibleKeys = getVisibleKeys();

    useEffect(() => {
        const loadCache = () => {
            try {
                const cached = localStorage.getItem(`sector_data_cache_${region}`);
                if (cached) {
                    const parsed = JSON.parse(cached);
                    if (parsed && parsed.line_chart_data && parsed.line_chart_data.length > 0) {
                        setOriginalData(parsed.line_chart_data);
                        setKeys(parsed.keys);
                        setIsLoading(false);
                    }
                }
            } catch (e) {
                console.error('Failed to load cached sector comparison chart data', e);
            }
        };

        const fetchData = async () => {
            let hasCache = false;
            try {
                const cached = localStorage.getItem(`sector_data_cache_${region}`);
                if (cached) {
                    const parsed = JSON.parse(cached);
                    if (parsed && parsed.line_chart_data && parsed.line_chart_data.length > 0) {
                        hasCache = true;
                    }
                }
            } catch (e) {}

            if (!hasCache) {
                setIsLoading(true);
            }
            setError(null);
            
            try {
                const res = await fetch(`${API_BASE}/api/v1/analyze/sector-comparison?region=${region}`);
                if (!res.ok) throw new Error('API fetch error');
                const data = await res.json();
                
                if (data.line_chart_data && data.line_chart_data.length > 0) {
                    setOriginalData(data.line_chart_data);
                    setKeys(data.keys);
                    // Save to cache
                    localStorage.setItem(`sector_data_cache_${region}`, JSON.stringify(data));
                } else {
                    if (!hasCache) {
                        setError('데이터가 없습니다.');
                    }
                }
            } catch (err) {
                console.error(err);
                if (!hasCache) {
                    setError('서버에서 섹터 데이터를 불러오지 못했습니다.');
                }
            } finally {
                setIsLoading(false);
            }
        };

        loadCache();
        fetchData();
    }, [region]);

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
            default: startDate.setFullYear(now.getFullYear() - 1); break;
        }

        const filtered = originalData.filter(d => new Date(d.date) >= startDate);
        if (filtered.length === 0) {
            setChartData([]);
            return;
        }

        // Calculate common base = 100
        const commonBaseRow = filtered.find(d => keys.every(k => d[k] != null && d[k] > 0));
        if (!commonBaseRow) {
            setChartData([]);
            return;
        }

        const baseValues: any = {};
        keys.forEach(k => {
            baseValues[k] = commonBaseRow[k];
        });

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

    const periodOptions = ['1M', '3M', '6M', '1Y', '3Y'];
    
    // Curated color palette for many lines
    const colors = [
        '#8b5cf6', '#ec4899', '#3b82f6', '#10b981', '#f59e0b', 
        '#ef4444', '#06b6d4', '#84cc16', '#a855f7', '#6366f1'
    ];

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (!active || !payload || payload.length === 0) return null;
        const currentIdx = chartData.findIndex((d) => d.date === label);
        const prevRow = currentIdx > 0 ? chartData[currentIdx - 1] : null;

        return (
            <div className="bg-[#121217]/95 border border-white/10 rounded-xl p-3 shadow-2xl backdrop-blur-xl min-w-[240px]">
                <p className="text-gray-400 text-[10px] mb-2 font-mono">{label}</p>
                <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                    {payload.sort((a:any, b:any) => b.value - a.value).map((entry: any) => {
                        const val: number = entry.value;
                        if (val === undefined || val === null || isNaN(val)) return null;
                        const prevVal: number | null = prevRow?.[entry.dataKey] ?? null;
                        const dailyPct = prevVal != null && prevVal > 0
                            ? (((val - prevVal) / prevVal) * 100).toFixed(2)
                            : null;
                        const isUp = dailyPct !== null && parseFloat(dailyPct) >= 0;

                        return (
                            <div key={entry.dataKey} className="flex justify-between items-center gap-4">
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                                    <span className="text-white/80 font-bold text-xs truncate max-w-[100px]">
                                        {entry.dataKey}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 font-mono text-xs">
                                    <span className="text-white font-bold">{val.toFixed(1)}%</span>
                                    {dailyPct !== null && (
                                        <span className={isUp ? 'text-emerald-400' : 'text-rose-400'}>
                                            {isUp ? `+${dailyPct}%` : `${dailyPct}%`}
                                        </span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
                <p className="text-[9px] text-gray-500 mt-2 pt-2 border-top border-white/5">
                    기준점 100 대비 수익률
                </p>
            </div>
        );
    };

    return (
        <div className="w-full bg-[#121217]/60 border border-white/10 rounded-3xl p-4 xl:p-5 backdrop-blur-md shadow-xl flex flex-col">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20">
                        {selectedSector ? (
                            <Activity className="w-5 h-5 text-indigo-400" />
                        ) : (
                            <Globe className="w-5 h-5 text-indigo-400" />
                        )}
                    </div>
                    <div>
                        <h3 className="text-base font-bold text-white">
                            {selectedSector ? (
                                <span className="flex items-center gap-2">
                                    <span className="text-indigo-400">{selectedSector}</span>
                                    <span>섹터 집중 비교</span>
                                </span>
                            ) : (
                                region === 'KR' ? '국내 섹터 비교' : region === 'US' ? '미국 섹터 비교' : '글로벌 섹터 통합 비교'
                            )}
                        </h3>
                        <p className="text-xs text-gray-400">
                            {selectedSector ? `한-미 ${selectedSector} 테마 ETF 성과 비교` : '기준점 100 대비 누적 수익률 추이'}
                        </p>
                    </div>
                </div>
                
                <div className="flex bg-black/40 rounded-lg p-1 border border-white/5">
                    {periodOptions.map(p => (
                        <button
                            key={p}
                            onClick={() => setPeriod(p)}
                            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${period === p
                                ? 'bg-indigo-600 text-white'
                                : 'text-gray-400 hover:text-gray-200'
                            }`}
                        >
                            {p}
                        </button>
                    ))}
                </div>
            </div>

            <div className="w-full h-[450px]">
                {isLoading ? (
                    <ChartLoadingPlaceholder height={450} message="섹터 데이터 분석 중..." />
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
                                minTickGap={40}
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
                                wrapperStyle={{ paddingTop: '20px', fontSize: '11px' }}
                                iconType="circle"
                            />
                            {visibleKeys.map((k) => {
                                const originalIdx = keys.indexOf(k);
                                const color = colors[originalIdx % colors.length];
                                return (
                                    <Line
                                        key={k}
                                        type="monotone"
                                        dataKey={k}
                                        stroke={color}
                                        strokeWidth={hoveredLine === k ? 4 : hoveredLine ? 1 : 2}
                                        dot={false}
                                        activeDot={{ r: 4, strokeWidth: 0, fill: color }}
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
        </div>
    );
}
