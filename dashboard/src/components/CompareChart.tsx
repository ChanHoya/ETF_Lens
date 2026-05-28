import React, { useState } from 'react';
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell } from "recharts";
import { Loader2 } from "lucide-react";

// 제 돌 1법: 데이터 배열에서 activeLabel로 적절한 index 입수
const findIdx = (chartData: any[], label: string) =>
    chartData.findIndex((d: any) => d.date === label);

// 가격입력 커스텀 툴팅
const PriceTooltip = ({ active, payload, label, chartData, etfColors }: any) => {
    if (!active || !payload || payload.length === 0) return null;
    const idx = findIdx(chartData, label);
    return (
        <div style={{ backgroundColor: 'rgba(3,7,18,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, boxShadow: '0 20px 40px -10px rgba(0,0,0,0.7)', padding: '12px 14px', minWidth: 200 }}>
            <p style={{ color: '#94a3b8', fontWeight: 'bold', fontSize: 13, marginBottom: 8 }}>{label}</p>
            {payload.map((item: any) => {
                const price = item.value;
                let chg: number | null = null;
                if (idx > 0) {
                    // 바로 직전 데이터가 null이면 최대 5개 이전까지 탐색
                    let prevPrice: number | null = null;
                    for (let pi = idx - 1; pi >= Math.max(0, idx - 5); pi--) {
                        const pp = Number(chartData[pi]?.[item.dataKey]);
                        if (pp && !isNaN(pp) && pp > 0) { prevPrice = pp; break; }
                    }
                    if (prevPrice && prevPrice !== 0) chg = ((price - prevPrice) / prevPrice) * 100;
                }
                const color = item.color || etfColors?.[item.dataKey];
                const isUp = chg !== null && chg >= 0;
                return (
                    <div key={item.dataKey} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 0', fontSize: 12 }}>
                        <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', backgroundColor: color, flexShrink: 0 }} />
                        <span style={{ color: '#e2e8f0' }}>{item.name}&thinsp;:&thinsp;<b>{Number(price).toLocaleString()}</b></span>
                        {chg !== null && (
                            <span style={{ color: isUp ? '#34d399' : '#f87171', fontWeight: 'bold', marginLeft: 2 }}>
                                ({isUp ? '+' : ''}{chg.toFixed(2)}%)
                            </span>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

// 수익률 커스텀 툴팀
const ReturnTooltip = ({ active, payload, label, chartData }: any) => {
    if (!active || !payload || payload.length === 0) return null;
    const idx = findIdx(chartData, label);
    return (
        <div style={{ backgroundColor: 'rgba(3,7,18,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, boxShadow: '0 20px 40px -10px rgba(0,0,0,0.7)', padding: '12px 14px', minWidth: 210 }}>
            <p style={{ color: '#94a3b8', fontWeight: 'bold', fontSize: 13, marginBottom: 8 }}>{label}</p>
            {payload.map((item: any) => {
                const val = Number(item.value);
                let chg: number | null = null;
                if (idx > 0) {
                    let prevVal: number | null = null;
                    for (let pi = idx - 1; pi >= Math.max(0, idx - 5); pi--) {
                        const pv = Number(chartData[pi]?.[item.dataKey]);
                        if (!isNaN(pv) && pv !== undefined && pv !== null) { prevVal = pv; break; }
                    }
                    if (prevVal !== null) chg = val - prevVal;
                }
                const color = item.color;
                const isUp = val >= 0;
                const isChgUp = chg !== null && chg >= 0;
                return (
                    <div key={item.dataKey} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 0', fontSize: 12 }}>
                        <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', backgroundColor: color, flexShrink: 0 }} />
                        <span style={{ color: '#e2e8f0' }}>{item.name}&thinsp;:&thinsp;<b style={{ color: isUp ? '#34d399' : '#f87171' }}>{val >= 0 ? '+' : ''}{val.toFixed(2)}%</b></span>
                        {chg !== null && (
                            <span style={{ color: isChgUp ? '#34d399' : '#f87171', fontWeight: 'bold', marginLeft: 2 }}>
                                ({isChgUp ? '+' : ''}{chg.toFixed(2)}%p)
                            </span>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

type CompareChartProps = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    simulatedChartData: any[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    additionalStatsData: any[];
    period: string;
    setPeriod: (p: string) => void;
    isLoadingChart: boolean;
    hoveredEtfName: string | null;
    setHoveredEtfName: (name: string | null) => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setSelectedDetailEtf: (etf: any) => void;
};

export default function CompareChart({
    data, simulatedChartData, additionalStatsData, period, setPeriod,
    isLoadingChart, hoveredEtfName, setHoveredEtfName, setSelectedDetailEtf
}: CompareChartProps) {

    const checkIsMarketClosed = () => {
        const now = new Date();
        const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
        const kst = new Date(utc + (3600000 * 9));
        
        const day = kst.getDay();
        if (day === 0 || day === 6) return true;
        
        const hours = kst.getHours();
        const minutes = kst.getMinutes();
        const timeInMinutes = hours * 60 + minutes;
        
        if (timeInMinutes < 540 || timeInMinutes > 930) return true;
        return false;
    };

    const isMarketClosed = checkIsMarketClosed();

    const glowColors = ["#818cf8", "#34d399", "#fbbf24", "#f87171", "#c084fc", "#60a5fa", "#f472b6", "#a3e635", "#f97316", "#14b8a6"];
    const [hoveredBench, setHoveredBench] = useState<string | null>(null);

    // 참조선 정의: dataKey, 표시 이름, 색상, Y축
    // KOSPI/SP500: 우측축 (max 10000), NASDAQ: 좌측축 (ETF와 유사한 스케일)
    const benchLines = [
        { dataKey: 'KOSPI_raw',   label: 'KOSPI',   color: '#94a3b8', yAxisId: 'right' },
        { dataKey: 'KOSDAQ_raw',  label: 'KOSDAQ',  color: '#22d3ee', yAxisId: 'right' },
        { dataKey: 'SP500_raw',   label: 'S&P500',  color: '#f59e0b', yAxisId: 'right' },
        { dataKey: 'NASDAQ_raw',  label: 'Nasdaq',  color: '#f472b6', yAxisId: 'left'  },
    ];
    const benchReturnKeys = [
        { dataKey: 'KOSPI_raw',  returnKey: 'KOSPI_return',   label: 'KOSPI',   color: '#94a3b8' },
        { dataKey: 'KOSDAQ_raw', returnKey: 'KOSDAQ_return',  label: 'KOSDAQ',  color: '#22d3ee' },
        { dataKey: 'SP500_raw',  returnKey: 'SP500_return',   label: 'S&P500',  color: '#f59e0b' },
        { dataKey: 'NASDAQ_raw', returnKey: 'NASDAQ_return',  label: 'Nasdaq',  color: '#f472b6' },
    ];

    // ETF 이름 → 자동 벤치마크 매핑
    const etfToBench = (name: string): string | null => {
        const n = name.toUpperCase();
        
        // 코스닥 식별 (최우선)
        if (n.includes('코스닥') || n.includes('KOSDAQ') || n.includes('코스닥150') || n.includes('바이오') || n.includes('헬스케어') || n.includes('2차전지')) {
            return 'KOSDAQ';
        }

        // 한국형 특수: 다우존스 추종이지만 한국 배당
        if (n.includes('코리아배당') || n.includes('KOREA배당')) return 'KOSPI';
        
        // 나스닥/성장형 (빅테크 포함)
        if (n.includes('나스닥') || n.includes('NASDAQ') || n.includes('QQQ') ||
            n.includes('빅테크') || n.includes('성장커버드콜') || n.includes('성장 커버드콜')) return 'Nasdaq';
        // 미국 지수 (S&P500 계열): "S&P", "SP500", "500" 포함
        if (n.includes('S&P') || n.includes('SP500') || n.includes('500') || n.includes('다우존스') || n.includes('DOWJONES')) return 'S&P500';
        if (n.includes('미국') || n.includes('US ') || n.includes('TIGER 미') || n.includes('ACE 미') || n.includes('KODEX 미')) return 'S&P500';
        // 한국 지수 (기본): "200" 포함 → KOSPI 200 계열
        if (n.includes('코스피') || n.includes('KOSPI') || n.includes('코리아') || n.includes('밸류업') || n.includes('200')) return 'KOSPI';
        return 'KOSPI';
    };

    // 실제 하이라이트 대상
    const effectiveHoveredBench = hoveredBench || (hoveredEtfName ? etfToBench(hoveredEtfName) : null);

    // KOSDAQ ETF 포함 여부 → KOSDAQ 지수 표시 결정
    const hasKosdaqEtf = (data?.visual_data?.etf_keys ?? []).some((key: string) => etfToBench(key) === 'KOSDAQ');
    const activeBenchLines    = benchLines.filter(({ label }) => label !== 'KOSDAQ' || hasKosdaqEtf);
    const activeBenchReturnKeys = benchReturnKeys.filter(({ label }) => label !== 'KOSDAQ' || hasKosdaqEtf);

    const returnChartData = simulatedChartData.map((d: any) => {
        const newD = { ...d };
        benchReturnKeys.forEach(({ dataKey, returnKey }) => {
            const firstPoint = simulatedChartData.find((p: any) => p[dataKey] && p[dataKey] > 0);
            if (firstPoint && d[dataKey] && firstPoint[dataKey]) {
                newD[returnKey] = ((d[dataKey] - firstPoint[dataKey]) / firstPoint[dataKey]) * 100;
            }
        });
        return newD;
    });

    // 공용 커스텀 범례 렌더러 (ETF 종목 + 지수 분리)
    const ChartLegend = ({ etfKeys, showDataKey = (k: string) => k }: { etfKeys: string[], showDataKey?: (k: string) => string }) => (
        <div className="flex flex-col gap-2 mt-4 pt-2 pb-2 border-t border-white/5">
            {/* ETF 종목 행 */}
            <div className="flex flex-wrap justify-center gap-x-5 gap-y-1">
                {etfKeys.map((key: string) => {
                    const idx = data.visual_data.etf_keys.indexOf(key);
                    const color = glowColors[idx % glowColors.length];
                    const isH = hoveredEtfName === key;
                    const faded = (hoveredEtfName || hoveredBench) && !isH;
                    return (
                        <button key={key}
                            onMouseEnter={() => setHoveredEtfName(key)}
                            onMouseLeave={() => setHoveredEtfName(null)}
                            onClick={() => { const m = data.raw_data?.find((d: any) => d.etf_name === key); if (m) setSelectedDetailEtf(m); }}
                            style={{ opacity: faded ? 0.3 : 1 }}
                            className="flex items-center gap-1.5 text-[11px] text-gray-400 hover:text-white transition-colors cursor-pointer"
                        >
                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                            <span style={{ color: isH ? color : undefined, fontWeight: isH ? 'bold' : 'normal' }}>{showDataKey(key)}</span>
                        </button>
                    );
                })}
            </div>
            {/* 지수 행 */}
            <div className="flex flex-wrap justify-center gap-x-4 gap-y-1">
                <span className="text-[10px] text-gray-600 self-center font-semibold mr-1">📊 지수</span>
                {activeBenchLines.map(({ dataKey, label, color }) => {
                    const hasD = simulatedChartData.some((d: any) => d[dataKey]);
                    if (!hasD) return null;
                    const isA = effectiveHoveredBench === label;
                    return (
                        <button key={label}
                            onMouseEnter={() => setHoveredBench(label)}
                            onMouseLeave={() => setHoveredBench(null)}
                            style={{ opacity: effectiveHoveredBench && !isA ? 0.35 : 1 }}
                            className="flex items-center gap-1.5 text-[11px] text-gray-400 hover:text-white transition-colors cursor-pointer"
                        >
                            <svg width="20" height="6"><line x1="0" y1="3" x2="20" y2="3" stroke={color} strokeWidth={isA ? 3 : 1.5} strokeDasharray="5 3" /></svg>
                            <span style={{ color: isA ? color : undefined, fontWeight: isA ? 'bold' : 'normal' }}>{label}</span>
                        </button>
                    );
                })}
            </div>
        </div>
    );

    return (
        <div className="flex flex-col gap-2 animate-in fade-in slide-in-from-bottom-2 duration-500 bg-white/[0.03] p-4 lg:p-5 border border-white/10 rounded-3xl backdrop-blur-3xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] mt-0">
            <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
                <div className="flex items-center gap-1.5 bg-black/40 p-1.5 rounded-xl border border-white/10 shadow-inner">
                    {['1D', '1W', '1M', '3M', '6M', '1Y', '3Y', '10Y'].map(p => (
                        <button
                            key={p}
                            onClick={() => setPeriod(p)}
                            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all whitespace-nowrap ${period === p
                                ? 'bg-indigo-500/80 text-white shadow-md shadow-indigo-500/20'
                                : 'text-gray-400 hover:text-white hover:bg-white/10'
                                }`}
                        >
                            {p}
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:gap-6">
                {isLoadingChart ? (
                    <div className="flex flex-col items-center justify-center p-12 text-center col-span-full w-full min-h-[400px] bg-white/[0.02] border border-white/5 rounded-2xl">
                        <Loader2 className="w-10 h-10 text-indigo-400 animate-spin mb-4" />
                        <h3 className="text-lg font-bold text-gray-200 mb-2">10년치 시계열 데이터를 분석하고 있습니다</h3>
                        <p className="text-sm text-gray-500 max-w-sm mx-auto">
                            과거 수익률 패턴과 변동성을 계산 중입니다. 잠시만 기다려주세요.
                        </p>
                    </div>
                ) : (
                    <>
                        {/* 1. Raw Price Chart (가격 추이) */}
                        {data.visual_data.line_chart && data.visual_data.etf_keys && data.visual_data.line_chart.length > 0 && (() => {
                            const PRICE_THRESHOLD = 50000;
                            // 각 ETF의 최고 raw 가격을 계산해 5만원 초과 종목 분류
                            const excludedKeys: string[] = [];
                            const includedKeys: string[] = [];
                            data.visual_data.etf_keys.forEach((key: string) => {
                                const maxPrice = Math.max(...simulatedChartData.map((d: any) => Number(d[`${key}_raw`]) || 0));
                                if (maxPrice > PRICE_THRESHOLD) excludedKeys.push(key);
                                else includedKeys.push(key);
                            });
                            return (
                            <section className="bg-white/[0.02] backdrop-blur-3xl rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] p-4 border border-white/5 relative group w-full">
                                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                                <div className="flex justify-between items-center mb-4 relative z-10">
                                    <h3 className="text-base md:text-lg font-bold flex items-center gap-3">
                                        <span className="w-1.5 h-6 bg-gradient-to-b from-blue-400 to-indigo-500 rounded-full"></span>
                                        가격 추이
                                        <span className="text-xs font-normal text-gray-500 ml-1 hidden sm:inline">(원, 5만원 이하 종목)</span>
                                    </h3>
                                </div>

                                {includedKeys.length > 0 ? (
                                    <>
                                        <div className="h-[400px] w-full relative z-10">
                                            {period === '1D' && isMarketClosed && (
                                                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/75 backdrop-blur-md rounded-2xl z-20 border border-white/10 shadow-[inner_0_4px_24px_rgba(0,0,0,0.8)]">
                                                    <svg className="w-12 h-12 text-indigo-400 mb-3 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
                                                    </svg>
                                                    <p className="text-base font-bold text-gray-200">현재 국내 주식 시장이 마감되었습니다</p>
                                                    <p className="text-xs text-gray-500 mt-1">장중 1D 실시간 차트는 영업일 09:00 ~ 15:30에 제공됩니다.</p>
                                                </div>
                                            )}
                                            <ResponsiveContainer width="100%" height="100%">
                                            <LineChart data={simulatedChartData} margin={{ top: 5, right: 5, left: 10, bottom: 5 }}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.03)" />
                                                <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 13 }} tickMargin={15} minTickGap={50} stroke="rgba(255,255,255,0.05)" axisLine={{ stroke: 'rgba(255,255,255,0.05)' }} />
                                                <YAxis yAxisId="left" domain={['auto', 'auto']} tick={{ fill: '#64748b', fontSize: 13 }} tickFormatter={(val) => `${val.toLocaleString()}`} stroke="rgba(255,255,255,0.05)" tickMargin={15} axisLine={false} />
                                                <YAxis yAxisId="right" orientation="right" domain={['auto', 'auto']} tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={(val) => val >= 1000 ? `${(val / 1000).toFixed(1)}k` : `${val}`} stroke="rgba(255,255,255,0.05)" tickMargin={8} axisLine={false} width={52} />
                                                <Tooltip
                                                    cursor={{ stroke: 'rgba(255,255,255,0.2)', strokeWidth: 1, strokeDasharray: '4 4' }}
                                                    content={(props: any) => <PriceTooltip {...props} chartData={simulatedChartData} />}
                                                />
                                                {/* ETF 가격 라인들 */}
                                                {includedKeys.map((key: string) => {
                                                    const idx = data.visual_data.etf_keys.indexOf(key);
                                                    const isHovered = hoveredEtfName === key;
                                                    const isOthersHovered = (hoveredEtfName || hoveredBench) && !isHovered;
                                                    return <Line key={`${key}_raw`} yAxisId="left" type="monotone" dataKey={`${key}_raw`} name={key} stroke={glowColors[idx % glowColors.length]} strokeWidth={isHovered ? 5 : 2} strokeOpacity={isOthersHovered ? 0.2 : 1} dot={false} connectNulls={true} activeDot={{ r: 5, strokeWidth: 0, fill: glowColors[idx % glowColors.length], stroke: 'white' }} className={isHovered ? 'animate-pulse' : 'transition-all duration-300'} onMouseEnter={() => setHoveredEtfName(key)} onMouseLeave={() => setHoveredEtfName(null)} legendType="none" />;
                                                })}
                                                {/* 지수 참조선 (점선) */}
                                                {activeBenchLines.map(({ dataKey, label, color, yAxisId }) => {
                                                    const hasData = simulatedChartData.some((d: any) => d[dataKey]);
                                                    if (!hasData) return null;
                                                    const isBenchHovered = effectiveHoveredBench === label;
                                                    const isBenchOtherHovered = effectiveHoveredBench && !isBenchHovered;
                                                    return (
                                                        <Line
                                                            key={`${dataKey}_${isBenchHovered}`}
                                                            yAxisId={yAxisId}
                                                            type="monotone"
                                                            dataKey={dataKey}
                                                            name={label}
                                                            stroke={color}
                                                            strokeWidth={isBenchHovered ? 3.5 : 1.5}
                                                            strokeDasharray="5 3"
                                                            dot={false}
                                                            connectNulls={true}
                                                            activeDot={{ r: 4, fill: color, strokeWidth: 0 }}
                                                            strokeOpacity={isBenchOtherHovered ? 0.15 : (isBenchHovered ? 1.0 : 0.7)}
                                                            legendType="none"
                                                        />
                                                    );
                                                })}
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </div>
                                    {/* 커스텀 분리 범례: ETF 종목 | 지수 (고정높이 div 외부) */}
                                    <ChartLegend etfKeys={includedKeys} />
                                    </>
                                ) : (
                                    <div className="h-24 flex items-center justify-center text-sm text-gray-500">
                                        표시 가능한 종목이 없습니다 (모든 종목이 5만원 초과).
                                    </div>
                                )}

                                {/* 제외 종목 표시 */}
                                {excludedKeys.length > 0 && (
                                    <div className="mt-3 pt-3 border-t border-white/5 flex flex-wrap items-center gap-2">
                                        <span className="text-[11px] text-gray-500 font-semibold shrink-0">⚠ 가격추이 제외 (5만원 초과):</span>
                                        {excludedKeys.map((key: string) => {
                                            const idx = data.visual_data.etf_keys.indexOf(key);
                                            const maxPrice = Math.max(...simulatedChartData.map((d: any) => Number(d[`${key}_raw`]) || 0));
                                            return (
                                                <span key={key} className="inline-flex items-center gap-1.5 text-[11px] text-gray-400 bg-white/5 border border-white/10 px-2 py-0.5 rounded-full">
                                                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: glowColors[idx % glowColors.length] }} />
                                                    {key}
                                                    <span className="text-gray-600">({maxPrice.toLocaleString()}원)</span>
                                                </span>
                                            );
                                        })}
                                        <span className="text-[11px] text-gray-600 ml-1">→ 하단 수익률 차트 참조</span>
                                    </div>
                                )}
                            </section>
                            );
                        })()}

                        {/* 2. Historical Performance Line Chart (수익률) */}
                        {data.visual_data.line_chart && data.visual_data.etf_keys && (
                            <section className="bg-white/[0.02] backdrop-blur-3xl rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] p-4 border border-white/5 relative group w-full">
                                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-transparent to-pink-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                                <div className="flex justify-between items-center mb-4 relative z-10">
                                    <h3 className="text-base md:text-lg font-bold flex items-center gap-3">
                                        <span className="w-1.5 h-6 bg-gradient-to-b from-indigo-400 to-pink-500 rounded-full"></span>
                                        {period === '1W' ? '수익률 일간 변동' : '다중 ETF 수익률 매치업'}
                                        <span className="text-xs font-normal text-gray-500 ml-1 hidden sm:inline">
                                            {period === '1W' ? '(전일 대비 %)' : '(누적 수익률 %)'}
                                        </span>
                                    </h3>
                                </div>

                                <div className="h-[400px] w-full relative z-10">
                                    {period === '1D' && isMarketClosed && (
                                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/75 backdrop-blur-md rounded-2xl z-20 border border-white/10 shadow-[inner_0_4px_24px_rgba(0,0,0,0.8)]">
                                            <svg className="w-12 h-12 text-indigo-400 mb-3 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
                                            </svg>
                                            <p className="text-base font-bold text-gray-200">현재 국내 주식 시장이 마감되었습니다</p>
                                            <p className="text-xs text-gray-500 mt-1">장중 1D 실시간 차트는 영업일 09:00 ~ 15:30에 제공됩니다.</p>
                                        </div>
                                    )}
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={returnChartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.03)" />
                                            <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 13 }} tickMargin={15} minTickGap={50} stroke="rgba(255,255,255,0.05)" axisLine={{ stroke: 'rgba(255,255,255,0.05)' }} />
                                            <YAxis domain={['auto', 'auto']} tick={{ fill: '#64748b', fontSize: 13 }} tickFormatter={(val) => `${val}%`} stroke="rgba(255,255,255,0.05)" tickMargin={15} axisLine={false} />
                                            <Tooltip
                                                cursor={{ stroke: 'rgba(255,255,255,0.2)', strokeWidth: 1, strokeDasharray: '4 4' }}
                                                content={(props: any) => <ReturnTooltip {...props} chartData={returnChartData} />}
                                            />
                                            {/* ETF 수익률 라인들 */}
                                            {data.visual_data.etf_keys.map((key: string, idx: number) => {
                                                const isHovered = hoveredEtfName === key;
                                                const isOthersHovered = (hoveredEtfName || hoveredBench) && !isHovered;
                                                return <Line key={`${key}_${isHovered}`} type="monotone" dataKey={key} name={key} stroke={glowColors[idx % glowColors.length]} strokeWidth={isHovered ? 5 : 2} strokeOpacity={isOthersHovered ? 0.2 : 1} dot={false} connectNulls={true} activeDot={{ r: 5, strokeWidth: 0, fill: glowColors[idx % glowColors.length], stroke: 'white' }} className={isHovered ? 'animate-pulse' : 'transition-all duration-300'} onMouseEnter={() => setHoveredEtfName(key)} onMouseLeave={() => setHoveredEtfName(null)} legendType="none" />;
                                            })}
                                            {/* 수익률 벤치마크 점선 */}
                                            {activeBenchReturnKeys.map(({ returnKey, label, color }) => {
                                                const hasData = returnChartData.some((d: any) => d[returnKey] != null);
                                                if (!hasData) return null;
                                                const isBenchHovered = effectiveHoveredBench === label;
                                                const isBenchOtherHovered = effectiveHoveredBench && !isBenchHovered;
                                                return (
                                                    <Line
                                                        key={`${returnKey}_${isBenchHovered}`}
                                                        type="monotone"
                                                        dataKey={returnKey}
                                                        name={label}
                                                        stroke={color}
                                                        strokeWidth={isBenchHovered ? 3.5 : 1.5}
                                                        strokeDasharray="5 3"
                                                        dot={false}
                                                        connectNulls={true}
                                                        activeDot={{ r: 4, fill: color, strokeWidth: 0 }}
                                                        strokeOpacity={isBenchOtherHovered ? 0.15 : (isBenchHovered ? 1.0 : 0.7)}
                                                        legendType="none"
                                                    />
                                                );
                                            })}
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                                {/* 커스텀 분리 범례: ETF 종목 | 지수 (고정높이 div 외부) */}
                                <ChartLegend etfKeys={data.visual_data.etf_keys} />
                            </section>
                        )}

                        {/* 3. Dividend Yield Trend (연간배당률) */}
                        {data.visual_data.line_chart && data.visual_data.etf_keys && (
                            <section className="bg-white/[0.02] backdrop-blur-3xl rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] p-4 border border-white/5 relative group w-full">
                                <div className="absolute inset-0 bg-gradient-to-bl from-rose-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                                <div className="flex justify-between items-center mb-4 relative z-10">
                                    <h3 className="text-base md:text-lg font-bold flex items-center gap-3">
                                        <span className="w-1.5 h-6 bg-rose-400 rounded-full"></span>
                                        연간배당률 트렌드 <span className="text-xs font-normal text-gray-500 ml-1 hidden sm:inline">(TTM 기준 추정, %)</span>
                                    </h3>
                                    <span className="text-[10px] text-rose-400/70 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-full">
                                        TTM 배당률 기반 시뮬레이션
                                    </span>
                                </div>

                                <div className="h-[400px] w-full relative z-10">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={simulatedChartData} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.03)" />
                                            <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 13 }} tickMargin={10} minTickGap={50} stroke="rgba(255,255,255,0.05)" axisLine={{ stroke: 'rgba(255,255,255,0.05)' }} />
                                            <YAxis domain={['auto', 'auto']} tick={{ fill: '#64748b', fontSize: 13 }} tickFormatter={(val) => `${val}%`} stroke="rgba(255,255,255,0.05)" tickMargin={15} axisLine={false} />
                                            <Tooltip
                                                cursor={{ stroke: 'rgba(255,255,255,0.2)', strokeWidth: 1, strokeDasharray: '4 4' }}
                                                contentStyle={{ backgroundColor: 'rgba(3, 7, 18, 0.95)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px', padding: '12px' }}
                                                labelStyle={{ color: '#94a3b8', marginBottom: '8px', fontSize: '13px' }}
                                                formatter={(value: any, name: string) => [`${Number(value).toFixed(2)}%`, name]}
                                            />
                                            {data.visual_data.etf_keys.map((key: string, idx: number) => {
                                                const isHovered = hoveredEtfName && (hoveredEtfName === key || key.includes(hoveredEtfName) || hoveredEtfName.includes(key));
                                                const isOthersHovered = hoveredEtfName && !isHovered;
                                                return <Line key={`${key}_dividend`} type="monotone" dataKey={`${key}_dividend`} name={key} stroke={glowColors[idx % glowColors.length]} strokeWidth={isHovered ? 5 : 2} strokeOpacity={isOthersHovered ? 0.2 : 1} dot={false} connectNulls={true} activeDot={{ r: 4, strokeWidth: 0 }} className={isHovered ? 'animate-pulse' : 'transition-all duration-300'} onMouseEnter={() => setHoveredEtfName(key)} onMouseLeave={() => setHoveredEtfName(null)} legendType="none" />;
                                            })}
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                                <ChartLegend etfKeys={data.visual_data.etf_keys} />
                            </section>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
