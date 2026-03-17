import React from 'react';
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell } from "recharts";
import { Loader2 } from "lucide-react";

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

    const glowColors = ["#818cf8", "#34d399", "#fbbf24", "#f87171", "#c084fc", "#60a5fa", "#f472b6", "#a3e635", "#f97316", "#14b8a6"];

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
                        {data.visual_data.line_chart && data.visual_data.etf_keys && data.visual_data.line_chart.length > 0 && (
                            <section className="bg-white/[0.02] backdrop-blur-3xl rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] p-4 border border-white/5 relative group w-full">
                                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                                <div className="flex justify-between items-center mb-4 relative z-10">
                                    <h3 className="text-base md:text-lg font-bold flex items-center gap-3">
                                        <span className="w-1.5 h-6 bg-gradient-to-b from-blue-400 to-indigo-500 rounded-full"></span>
                                        가격 추이
                                        <span className="text-xs font-normal text-gray-500 ml-1 hidden sm:inline">(원)</span>
                                    </h3>
                                </div>

                                <div className="h-[400px] w-full relative z-10">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={simulatedChartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.03)" />
                                            <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 13 }} tickMargin={15} minTickGap={50} stroke="rgba(255,255,255,0.05)" axisLine={{ stroke: 'rgba(255,255,255,0.05)' }} />
                                            <YAxis domain={['auto', 'auto']} tick={{ fill: '#64748b', fontSize: 13 }} tickFormatter={(val) => `${val.toLocaleString()}`} stroke="rgba(255,255,255,0.05)" tickMargin={15} axisLine={false} />
                                            <Tooltip cursor={{ stroke: 'rgba(255,255,255,0.2)', strokeWidth: 1, strokeDasharray: '4 4' }} contentStyle={{ backgroundColor: 'rgba(3, 7, 18, 0.95)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px', boxShadow: '0 20px 40px -10px rgba(0,0,0,0.7)', padding: '12px' }} labelStyle={{ color: '#94a3b8', marginBottom: '8px', fontWeight: 'bold', fontSize: '13px' }} itemStyle={{ padding: '2px 0', fontSize: '12px' }} />
                                            <Legend iconType="circle" wrapperStyle={{ paddingTop: '15px', display: 'flex', justifyContent: 'center', gap: '20px', fontSize: '12px' }} onClick={(e: any) => {
                                                if (e && e.value) {
                                                    const matchedEtf = data.raw_data?.find((d: any) => d.etf_name === e.value || d.etf_code === e.value);
                                                    if (matchedEtf) setSelectedDetailEtf(matchedEtf);
                                                }
                                            }} onMouseEnter={(e: any) => { if (e && e.value) setHoveredEtfName(e.value); }}
                                                onMouseLeave={() => setHoveredEtfName(null)}
                                                formatter={(value) => <span className="cursor-pointer hover:text-white hover:underline transition-colors">{value}</span>} />
                                            {data.visual_data.etf_keys.map((key: string, idx: number) => {
                                                const isHovered = hoveredEtfName && (hoveredEtfName === key || key.includes(hoveredEtfName) || hoveredEtfName.includes(key));
                                                const isOthersHovered = hoveredEtfName && !isHovered;
                                                return <Line key={`${key}_raw`} type="monotone" dataKey={`${key}_raw`} name={key} stroke={glowColors[idx % glowColors.length]} strokeWidth={isHovered ? 5 : 2} strokeOpacity={isOthersHovered ? 0.2 : 1} dot={false} connectNulls={true} activeDot={{ r: 5, strokeWidth: 0, fill: glowColors[idx % glowColors.length], stroke: 'white' }} className={isHovered ? 'animate-pulse' : 'transition-all duration-300'} onMouseEnter={() => setHoveredEtfName(key)} onMouseLeave={() => setHoveredEtfName(null)} />;
                                            })}
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            </section>
                        )}

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
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={simulatedChartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.03)" />
                                            <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 13 }} tickMargin={15} minTickGap={50} stroke="rgba(255,255,255,0.05)" axisLine={{ stroke: 'rgba(255,255,255,0.05)' }} />
                                            <YAxis domain={['auto', 'auto']} tick={{ fill: '#64748b', fontSize: 13 }} tickFormatter={(val) => `${val}%`} stroke="rgba(255,255,255,0.05)" tickMargin={15} axisLine={false} />
                                            <Tooltip cursor={{ stroke: 'rgba(255,255,255,0.2)', strokeWidth: 1, strokeDasharray: '4 4' }} contentStyle={{ backgroundColor: 'rgba(3, 7, 18, 0.95)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px', boxShadow: '0 20px 40px -10px rgba(0,0,0,0.7)', padding: '12px' }} labelStyle={{ color: '#94a3b8', marginBottom: '8px', fontWeight: 'bold', fontSize: '13px' }} itemStyle={{ padding: '2px 0', fontSize: '12px' }} />
                                            <Legend iconType="circle" wrapperStyle={{ paddingTop: '15px', display: 'flex', justifyContent: 'center', gap: '20px', fontSize: '12px' }} onClick={(e: any) => {
                                                if (e && e.value) {
                                                    const matchedEtf = data.raw_data?.find((d: any) => d.etf_name === e.value || d.etf_code === e.value);
                                                    if (matchedEtf) setSelectedDetailEtf(matchedEtf);
                                                }
                                            }} onMouseEnter={(e: any) => { if (e && e.value) setHoveredEtfName(e.value); }}
                                                onMouseLeave={() => setHoveredEtfName(null)}
                                                formatter={(value) => <span className="cursor-pointer hover:text-white hover:underline transition-colors">{value}</span>} />
                                            {data.visual_data.etf_keys.map((key: string, idx: number) => {
                                                const isHovered = hoveredEtfName && (hoveredEtfName === key || key.includes(hoveredEtfName) || hoveredEtfName.includes(key));
                                                const isOthersHovered = hoveredEtfName && !isHovered;
                                                return <Line key={key} type="monotone" dataKey={key} name={key} stroke={glowColors[idx % glowColors.length]} strokeWidth={isHovered ? 5 : 2} strokeOpacity={isOthersHovered ? 0.2 : 1} dot={false} connectNulls={true} activeDot={{ r: 5, strokeWidth: 0, fill: glowColors[idx % glowColors.length], stroke: 'white' }} className={isHovered ? 'animate-pulse' : 'transition-all duration-300'} onMouseEnter={() => setHoveredEtfName(key)} onMouseLeave={() => setHoveredEtfName(null)} />;
                                            })}
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            </section>
                        )}

                        {/* 3. Cumulative Fund Inflow Trend (순자금유입) */}
                        {data.visual_data.line_chart && data.visual_data.etf_keys && (
                            <section className="bg-white/[0.02] backdrop-blur-3xl rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] p-4 border border-white/5 relative group w-full">
                                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                                <div className="flex justify-between items-center mb-4 relative z-10">
                                    <h3 className="text-base md:text-lg font-bold flex items-center gap-3">
                                        <span className="w-1.5 h-6 bg-emerald-400 rounded-full"></span>
                                        순자금유입 추이 <span className="text-xs font-normal text-gray-500 ml-1 hidden sm:inline">(누적, 억 원)</span>
                                    </h3>
                                </div>

                                <div className="h-[400px] w-full relative z-10">
                                    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm rounded-lg overflow-hidden border border-white/5">
                                        <div className="px-6 py-3 bg-indigo-600/90 text-white text-sm font-bold rounded-xl shadow-[0_0_30px_rgba(79,70,229,0.5)] border border-indigo-400/30">
                                            🚧 추후 개발 예정 (To Be Developed)
                                        </div>
                                    </div>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={simulatedChartData} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.03)" />
                                            <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 13 }} tickMargin={10} minTickGap={50} stroke="rgba(255,255,255,0.05)" axisLine={{ stroke: 'rgba(255,255,255,0.05)' }} />
                                            <YAxis domain={['auto', 'auto']} tick={{ fill: '#64748b', fontSize: 13 }} tickFormatter={(val) => `${val}`} stroke="rgba(255,255,255,0.05)" tickMargin={15} axisLine={false} />
                                            <Tooltip cursor={{ stroke: 'rgba(255,255,255,0.1)' }} contentStyle={{ backgroundColor: 'rgba(3, 7, 18, 0.95)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px', padding: '12px' }} labelStyle={{ color: '#94a3b8', marginBottom: '8px', fontSize: '13px' }} itemStyle={{ padding: '2px 0', fontSize: '12px' }} />
                                            <Legend iconType="circle" wrapperStyle={{ paddingTop: '15px', display: 'flex', justifyContent: 'center', gap: '20px', fontSize: '12px' }} onClick={(e: any) => {
                                                if (e && e.value) {
                                                    const matchedEtf = data.raw_data?.find((d: any) => d.etf_name === e.value || d.etf_code === e.value);
                                                    if (matchedEtf) setSelectedDetailEtf(matchedEtf);
                                                }
                                            }} onMouseEnter={(e: any) => { if (e && e.value) setHoveredEtfName(e.value); }}
                                                onMouseLeave={() => setHoveredEtfName(null)}
                                                formatter={(value) => <span className="cursor-pointer hover:text-white hover:underline transition-colors">{value}</span>} />
                                            {data.visual_data.etf_keys.map((key: string, idx: number) => {
                                                const isHovered = hoveredEtfName && (hoveredEtfName === key || key.includes(hoveredEtfName) || hoveredEtfName.includes(key));
                                                const isOthersHovered = hoveredEtfName && !isHovered;
                                                return <Line key={`${key}_inflow`} type="monotone" dataKey={`${key}_inflow`} name={key} stroke={glowColors[idx % glowColors.length]} strokeWidth={isHovered ? 5 : 2} strokeOpacity={isOthersHovered ? 0.2 : 1} dot={false} connectNulls={true} activeDot={{ r: 4 }} className={isHovered ? 'animate-pulse' : 'transition-all duration-300'} onMouseEnter={() => setHoveredEtfName(key)} onMouseLeave={() => setHoveredEtfName(null)} />;
                                            })}
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            </section>
                        )}

                        {/* 4. Dividend Yield Trend (연간배당률) */}
                        {data.visual_data.line_chart && data.visual_data.etf_keys && (
                            <section className="bg-white/[0.02] backdrop-blur-3xl rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] p-4 border border-white/5 relative group w-full">
                                <div className="absolute inset-0 bg-gradient-to-bl from-rose-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                                <div className="flex justify-between items-center mb-4 relative z-10">
                                    <h3 className="text-base md:text-lg font-bold flex items-center gap-3">
                                        <span className="w-1.5 h-6 bg-rose-400 rounded-full"></span>
                                        연간배당률 트렌드 <span className="text-xs font-normal text-gray-500 ml-1 hidden sm:inline">(TTM, %)</span>
                                    </h3>
                                </div>

                                <div className="h-[400px] w-full relative z-10">
                                    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm rounded-lg overflow-hidden border border-white/5">
                                        <div className="px-6 py-3 bg-rose-600/90 text-white text-sm font-bold rounded-xl shadow-[0_0_30px_rgba(225,29,72,0.5)] border border-rose-400/30">
                                            🚧 추후 개발 예정 (To Be Developed)
                                        </div>
                                    </div>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={simulatedChartData} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.03)" />
                                            <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 13 }} tickMargin={10} minTickGap={50} stroke="rgba(255,255,255,0.05)" axisLine={{ stroke: 'rgba(255,255,255,0.05)' }} />
                                            <YAxis domain={['auto', 'auto']} tick={{ fill: '#64748b', fontSize: 13 }} tickFormatter={(val) => `${val}%`} stroke="rgba(255,255,255,0.05)" tickMargin={15} axisLine={false} />
                                            <Tooltip cursor={{ stroke: 'rgba(255,255,255,0.1)' }} contentStyle={{ backgroundColor: 'rgba(3, 7, 18, 0.95)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px', padding: '12px' }} labelStyle={{ color: '#94a3b8', marginBottom: '8px', fontSize: '13px' }} itemStyle={{ padding: '2px 0', fontSize: '12px' }} />
                                            <Legend iconType="circle" wrapperStyle={{ paddingTop: '15px', display: 'flex', justifyContent: 'center', gap: '20px', fontSize: '12px' }} onClick={(e: any) => {
                                                if (e && e.value) {
                                                    const matchedEtf = data.raw_data?.find((d: any) => d.etf_name === e.value || d.etf_code === e.value);
                                                    if (matchedEtf) setSelectedDetailEtf(matchedEtf);
                                                }
                                            }} onMouseEnter={(e: any) => { if (e && e.value) setHoveredEtfName(e.value); }}
                                                onMouseLeave={() => setHoveredEtfName(null)}
                                                formatter={(value) => <span className="cursor-pointer hover:text-white hover:underline transition-colors">{value}</span>} />
                                            {data.visual_data.etf_keys.map((key: string, idx: number) => {
                                                const isHovered = hoveredEtfName && (hoveredEtfName === key || key.includes(hoveredEtfName) || hoveredEtfName.includes(key));
                                                const isOthersHovered = hoveredEtfName && !isHovered;
                                                return <Line key={`${key}_dividend`} type="monotone" dataKey={`${key}_dividend`} name={key} stroke={glowColors[idx % glowColors.length]} strokeWidth={isHovered ? 5 : 2} strokeOpacity={isOthersHovered ? 0.2 : 1} dot={false} connectNulls={true} activeDot={{ r: 4 }} className={isHovered ? 'animate-pulse' : 'transition-all duration-300'} onMouseEnter={() => setHoveredEtfName(key)} onMouseLeave={() => setHoveredEtfName(null)} />;
                                            })}
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            </section>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
