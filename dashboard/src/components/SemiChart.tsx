"use client";

import React, { useState, useEffect } from 'react';
import { Activity } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend } from 'recharts';
import ChartLoadingPlaceholder from './ChartLoadingPlaceholder';

export default function SemiChart() {
    const [period, setPeriod] = useState('1Y');
    const [chartData, setChartData] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [hoveredLine, setHoveredLine] = useState<string | null>(null);
    const [keys, setKeys] = useState<string[]>([]);
    const [originalData, setOriginalData] = useState<any[]>([]);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const isCloudDeployment = window.location.hostname.includes('onrender.com') || window.location.hostname.includes('vercel.app');
                const apiUrl = isCloudDeployment
                    ? 'https://etf-lens.onrender.com/api/v1/analyze/semi-chart'
                    : `http://${window.location.hostname}:8000/api/v1/analyze/semi-chart`;
                
                const res = await fetch(apiUrl);
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
        // (티커별로 다른 날을 기준으로 삼으면 미국/한국 시장 개장일 차이로 그래프가 어긋남)
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
    const colors = ['#8b5cf6', '#ec4899', '#3b82f6', '#10b981', '#f59e0b'];

    return (
        <div className="w-full bg-[#121217]/60 border border-white/10 rounded-3xl p-4 xl:p-5 backdrop-blur-md shadow-xl flex flex-col mt-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Activity className="w-5 h-5 text-indigo-400" />
                    반도체 지수 현황
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
                    <ChartLoadingPlaceholder height={400} message="섹터 ETF 데이터 로딩중" />
                ) : error ? (
                    <div className="w-full h-full flex items-center justify-center text-rose-400 text-sm">
                        {error}
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                            <XAxis
                                dataKey="date"
                                stroke="rgba(255,255,255,0.2)"
                                tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }}
                                tickMargin={10}
                                minTickGap={30}
                            />
                            <YAxis
                                domain={['auto', 'auto']}
                                stroke="rgba(255,255,255,0.2)"
                                tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }}
                                tickFormatter={(val) => `${val}`}
                            />
                            <RechartsTooltip
                                contentStyle={{ backgroundColor: 'rgba(18, 18, 23, 0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.5)', fontSize: '12px' }}
                                itemStyle={{ fontWeight: 'bold' }}
                                formatter={(value: number, name: string) => [`${value.toFixed(2)}`, name]}
                                labelStyle={{ color: 'rgba(255,255,255,0.5)', marginBottom: '8px', fontSize: '11px' }}
                            />
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
        </div>
    );
}
