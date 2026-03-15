import React from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from "recharts";

type CompareTableProps = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    radarData: any[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    additionalStatsData: any[];
    hoveredEtfName: string | null;
    setHoveredEtfName: (name: string | null) => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setSelectedDetailEtf: (etf: any) => void;
};

export default function CompareTable({
    data, radarData, additionalStatsData, hoveredEtfName, setHoveredEtfName, setSelectedDetailEtf
}: CompareTableProps) {
    if (!data || !data.data_payload) return null;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 animate-in fade-in slide-in-from-bottom-2 duration-500 bg-white/[0.03] p-4 lg:p-5 border border-white/10 rounded-3xl backdrop-blur-3xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] mt-0">
            {/* Table Details */}
            <section className="col-span-1 lg:col-span-3 overflow-hidden flex flex-col relative group">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <h3 className="text-base md:text-lg font-bold mb-3 flex items-center gap-2 relative z-10">
                    <span className="w-1.5 h-6 bg-gradient-to-b from-indigo-400 to-purple-500 rounded-full"></span>
                    종합 매트릭스
                </h3>

                <div className="overflow-x-auto pb-6 relative z-10">
                    <table className="w-full text-left border-collapse whitespace-nowrap">
                        <thead>
                            <tr className="border-b border-white/10">
                                {data.data_payload.header.map((h: string, i: number) => (
                                    <th key={i} className="py-2 px-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.05]">
                            {data.data_payload.rows.map((row: string[], i: number) => {
                                const glowColors = ["#818cf8", "#34d399", "#fbbf24", "#f87171", "#c084fc", "#60a5fa", "#f472b6", "#a3e635", "#f97316", "#14b8a6"];
                                return (
                                    <tr key={i} className="hover:bg-white/[0.03] transition-colors group/row"
                                        onMouseEnter={() => {
                                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                            const matchedEtf = data.raw_data ? data.raw_data.find((e: any) => row[0].includes(e.etf_name) || row[0].includes(e.etf_code)) : null;
                                            if (matchedEtf) setHoveredEtfName(matchedEtf.etf_name);
                                            else setHoveredEtfName(row[0]);
                                        }}
                                        onMouseLeave={() => setHoveredEtfName(null)}
                                    >
                                        {row.map((cell: string, j: number) => {
                                            const isNegative = cell.includes('-') && cell.includes('%');
                                            const isPositive = cell.includes('%') && !isNegative && parseFloat(cell) > 0;
                                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                            const matchedEtf = j === 0 && data.raw_data ? data.raw_data.find((e: any) => cell.includes(e.etf_name) || cell.includes(e.etf_code)) : null;
                                            return (
                                                <td key={j}
                                                    className={`py-3 px-3 text-xs xl:text-sm font-medium transition-colors ${j === 0 ? `font-bold max-w-[200px] truncate ${matchedEtf ? 'cursor-pointer hover:underline underline-offset-4' : ''}` :
                                                        isNegative ? 'text-rose-400' :
                                                            isPositive ? 'text-emerald-400' : 'text-gray-200'
                                                        }`}
                                                    style={j === 0 ? { color: glowColors[i % glowColors.length] } : undefined}
                                                    title={j === 0 ? cell : undefined}
                                                    onClick={() => {
                                                        if (matchedEtf) setSelectedDetailEtf(matchedEtf);
                                                    }}
                                                >
                                                    {cell}
                                                </td>
                                            )
                                        })}
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>

                <div className="mt-auto pt-4 border-t border-white/10 relative z-10">
                    <div className="p-4 bg-gradient-to-r from-indigo-900/40 via-purple-900/20 to-transparent rounded-xl border border-indigo-500/20 shadow-[inset_0_0_20px_rgba(79,70,229,0.05)] backdrop-blur-sm">
                        <h4 className="font-bold text-indigo-300 text-xs mb-2 flex items-center gap-2 uppercase tracking-wider">✨ Quant Insight</h4>
                        <p className="text-indigo-50 text-sm leading-relaxed font-light block">{data.data_payload.insight_comment}</p>
                    </div>
                </div>
            </section>

            {/* Radar Chart */}
            <section className="bg-white/[0.02] backdrop-blur-3xl rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] p-5 border border-white/5 flex flex-col justify-between min-h-[300px] relative group lg:col-span-1">
                <div className="absolute inset-0 bg-gradient-to-bl from-purple-500/5 to-pink-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <h3 className="text-base md:text-lg font-bold mb-2 flex items-center gap-3 relative z-10">
                    <span className="w-1.5 h-6 bg-gradient-to-b from-purple-400 to-pink-500 rounded-full"></span>
                    팩터 밸런스
                </h3>

                {/* Factor Score Heatmap Table */}
                {data.visual_data && data.visual_data.etf_keys && data.visual_data.etf_keys.length > 0 && radarData.length > 0 && (
                    <div className="w-full mb-4 overflow-x-auto relative z-10 scrollbar-hide">
                        <table className="w-full table-fixed text-center border-collapse min-w-[max-content]">
                            <thead>
                                <tr>
                                    <th className="px-2 py-0.5 text-[10px] md:text-[11px] text-gray-400 font-medium border-b border-white/10 whitespace-nowrap bg-black/20 w-12">종목</th>
                                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                                    {radarData.map((row: any) => (
                                        <th key={row.subject} className="px-2 py-0.5 text-[10px] md:text-[11px] text-gray-400 font-medium border-b border-white/10 whitespace-nowrap bg-black/20 w-auto">
                                            {row.subject === "수수료(저렴함)" ? "수수료" : row.subject}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {data.visual_data.etf_keys.map((key: string, idx: number) => {
                                    const glowColors = ["#818cf8", "#34d399", "#fbbf24", "#f87171", "#c084fc", "#60a5fa", "#f472b6", "#a3e635", "#f97316", "#14b8a6"];
                                    const c = glowColors[idx % glowColors.length];
                                    const isHovered = hoveredEtfName && (hoveredEtfName === key || key.includes(hoveredEtfName) || hoveredEtfName.includes(key));

                                    return (
                                        <tr
                                            key={key}
                                            className="hover:bg-white/5 transition-colors"
                                            onMouseEnter={() => setHoveredEtfName(key)}
                                            onMouseLeave={() => setHoveredEtfName(null)}
                                        >
                                            <td className="px-2 py-0.5 border-b border-white/5">
                                                <div className="flex justify-center items-center w-full h-full">
                                                    <div className={`w-2 h-2 rounded-full ${isHovered ? 'animate-pulse scale-125' : ''}`} style={{ backgroundColor: c, boxShadow: `0 0 8px ${c}` }}></div>
                                                </div>
                                            </td>
                                            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                                            {radarData.map((row: any) => {
                                                const val = Math.max(0, Number(row[key]) || 0);
                                                const allVals = data.visual_data.etf_keys.map((k: string) => Math.max(0, Number(row[k]) || 0));
                                                const maxV = Math.max(...allVals);
                                                const minV = Math.min(...allVals);
                                                const norm = maxV === minV ? 0.5 : (val - minV) / (maxV - minV);

                                                const hue = 60 + (norm * 80);
                                                const lightness = 90 - (norm * 50);
                                                const textColor = norm > 0.6 ? 'text-white' : 'text-gray-900';

                                                return (
                                                    <td key={row.subject} className="px-1 py-0.5 border-b border-white/5 relative">
                                                        <div
                                                            className={`w-full h-full min-h-[20px] flex items-center justify-center rounded text-[10px] md:text-[11px] font-mono transition-all duration-300 ${isHovered ? 'scale-110 shadow-[0_0_10px_rgba(255,255,255,0.3)] z-10 font-extrabold ring-1 ring-white/50' : 'font-bold'} ${textColor}`}
                                                            style={{ backgroundColor: `hsl(${hue}, 85%, ${lightness}%)` }}
                                                        >
                                                            {val}
                                                        </div>
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                <div className="flex-1 w-full min-h-[220px] relative z-10">
                    <ResponsiveContainer width="100%" height="100%">
                        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData.map(d => ({ ...d, subject: d.subject === "수수료(저렴함)" ? "수수료" : d.subject }))}>
                            <PolarGrid stroke="rgba(255,255,255,0.05)" />
                            <PolarAngleAxis dataKey="subject" tick={{ fill: '#a5b4fc', fontSize: 13, fontWeight: 500 }} />
                            <PolarRadiusAxis angle={30} domain={[0, 10]} tick={false} axisLine={false} />
                            {data.visual_data && data.visual_data.etf_keys && data.visual_data.etf_keys.map((etfName: string, idx: number) => {
                                const glowColors = ["#818cf8", "#34d399", "#fbbf24", "#f87171", "#c084fc", "#60a5fa", "#f472b6", "#a3e635", "#f97316", "#14b8a6"];
                                const c = glowColors[idx % glowColors.length];
                                const isHovered = hoveredEtfName && (hoveredEtfName === etfName || etfName.includes(hoveredEtfName) || hoveredEtfName.includes(etfName));
                                const isOthersHovered = hoveredEtfName && !isHovered;
                                return (
                                    <Radar
                                        key={etfName}
                                        name={etfName}
                                        dataKey={etfName}
                                        stroke={c}
                                        strokeWidth={isHovered ? 4 : 2}
                                        fill={c}
                                        fillOpacity={isHovered ? 0.7 : (isOthersHovered ? 0.05 : 0.3)}
                                        className={isHovered ? 'animate-pulse' : 'transition-all duration-300'}
                                    />
                                );
                            })}
                        </RadarChart>
                    </ResponsiveContainer>
                </div>
            </section>

            {/* Detailed Basic Info Inverted Table */}
            <section className="bg-white/[0.02] backdrop-blur-3xl rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] p-5 border border-white/5 lg:col-span-4 mt-2 overflow-x-auto">
                <h3 className="text-base md:text-lg font-bold mb-4 flex items-center gap-3">
                    <span className="w-1.5 h-6 bg-gradient-to-b from-teal-400 to-emerald-500 rounded-full"></span>
                    기본 정보
                </h3>
                <div className="w-full overflow-x-hidden overflow-y-auto max-h-[65vh] border border-white/5 rounded-xl relative custom-scrollbar">
                    <table className="w-full text-left border-collapse min-w-full table-fixed">
                        <thead className="sticky top-0 z-30 backdrop-blur-xl bg-[#0B0F19]/95 shadow-md border-b border-white/10">
                            <tr>
                                <th className="py-2 px-1 lg:px-2 text-[10px] md:text-sm font-bold text-gray-500 bg-white/5 w-16 md:w-24 break-keep">항목</th>
                                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                                {data.raw_data && data.raw_data.map((etf: any, idx: number) => {
                                    const glowColors = ["#818cf8", "#34d399", "#fbbf24", "#f87171", "#c084fc", "#60a5fa", "#f472b6", "#a3e635", "#f97316", "#14b8a6"];
                                    const isDanger = etf.etf_name.includes('인버스') || etf.etf_name.includes('레버리지') || etf.etf_name.includes('선물') || etf.etf_name.includes('블룸버그');
                                    return (
                                        <th key={`${etf.etf_code}-${idx}`} className="py-2 px-1 xl:px-2 text-[10px] xl:text-xs font-bold text-center group cursor-pointer hover:bg-white/[0.05] transition-colors leading-tight whitespace-normal break-keep" onClick={() => setSelectedDetailEtf(etf)} style={{ color: glowColors[idx % glowColors.length] }}>
                                            <div className="flex flex-col items-center justify-end gap-1.5 h-full">
                                                {isDanger ? <span className="text-[8px] md:text-[9px] bg-rose-500/10 text-rose-400 px-1 py-0.5 rounded border border-rose-500/30 whitespace-nowrap">퇴직연금 불가</span> : <span className="text-[8px] md:text-[9px] bg-emerald-500/10 text-emerald-400 px-1 py-0.5 rounded border border-emerald-500/30 whitespace-nowrap">연금 가능</span>}
                                                <span className="group-hover:underline underline-offset-4">{etf.etf_name}</span>
                                            </div>
                                        </th>
                                    );
                                })}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.05]">
                            {['운용사', '최초데이터(상장추정)', '현재가 및 NAV (괴리율)', '순자산총액', '상장주식수', '52주 최고/최저', '거래량/거래대금', '20일평균 거래량/대금', '펀드보수', '최근 분배율(TTM)', '1M 수익률', '3M 수익률', '6M 수익률', '1Y 수익률'].map((key) => {
                                const isNumericRow = !['운용사', '최초데이터(상장추정)', '현재가 및 NAV (괴리율)'].includes(key);
                                const isSplitRow = ['52주 최고/최저', '거래량/거래대금', '20일평균 거래량/대금'].includes(key);
                                let maxVal1 = 1;
                                let maxVal2 = 1;

                                if (isNumericRow && data.raw_data) {
                                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                    const parsedVals = data.raw_data.map((e: any) => {
                                        const v = e.basic_info?.[key] || '';
                                        let raw = String(v).replace(/,/g, '');
                                        let n1 = 0;
                                        let n2 = 0;

                                        if (key === '순자산총액') {
                                            if (raw.includes("조") && raw.includes("억")) {
                                                const parts = raw.split("조");
                                                n1 = (parseFloat(parts[0]) || 0) * 10000 + (parseFloat(parts[1].replace("억", "")) || 0);
                                            } else if (raw.includes("조")) {
                                                n1 = (parseFloat(raw.replace("조", "")) || 0) * 10000;
                                            } else {
                                                n1 = parseFloat(raw.replace("억", "")) || 0;
                                            }
                                        } else if (isSplitRow && raw.includes('/')) {
                                            const parts = raw.split('/');
                                            n1 = parseFloat(parts[0].replace(/[^0-9.]/g, '')) || 0;
                                            n2 = parseFloat(parts[1].replace(/[^0-9.]/g, '')) || 0;
                                        } else {
                                            n1 = parseFloat(raw.replace(/[^0-9.-]/g, '')) || 0;
                                        }
                                        return [Math.abs(n1), Math.abs(n2)];
                                    });

                                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                    maxVal1 = Math.max(...parsedVals.map((p: any) => p[0])) || 1;
                                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                    maxVal2 = Math.max(...parsedVals.map((p: any) => p[1])) || 1;

                                    if (key === '52주 최고/최저') {
                                        const absoluteMax = Math.max(maxVal1, maxVal2);
                                        maxVal1 = absoluteMax;
                                        maxVal2 = absoluteMax;
                                    }
                                }

                                return (
                                    <tr key={key} className="hover:bg-white/[0.03] transition-colors">
                                        <td className="py-3 px-4 text-xs font-semibold text-gray-400 bg-white/5 align-middle">{key}</td>
                                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                                        {data.raw_data && data.raw_data.map((etf: any, idx: number) => {
                                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                            let val: any = etf.basic_info?.[key] || '-';
                                            if (key === '현재가 및 NAV (괴리율)') {
                                                const p = etf.market_data?.price || 0;
                                                const n = etf.market_data?.nav || 0;
                                                if (p > 0 && n > 0) {
                                                    const d = ((p - n) / n) * 100;
                                                    val = `${p.toLocaleString()}원 / ${n.toLocaleString()}원 (${d > 0 ? '+' : ''}${d.toFixed(2)}%)`;
                                                } else {
                                                    val = 'N/A';
                                                }
                                            }

                                            const isYield = key.includes('수익률');
                                            const isDisparity = key === '현재가 및 NAV (괴리율)';

                                            const isPositive = (isYield && typeof val === 'string' && val.includes('%') && !val.includes('-')) || (isDisparity && typeof val === 'string' && val.includes('+'));
                                            const isNegative = (isYield && typeof val === 'string' && val.includes('%') && val.includes('-')) || (isDisparity && typeof val === 'string' && val.includes('-') && val.includes('%'));
                                            const textColor = isPositive ? 'text-rose-400' : isNegative ? 'text-blue-400' : 'text-gray-100';

                                            let num1 = 0;
                                            let num2 = 0;
                                            let val1Str = val;
                                            let val2Str = "";

                                            if (isNumericRow) {
                                                let raw = String(val).replace(/,/g, '');
                                                if (key === '순자산총액') {
                                                    if (raw.includes("조") && raw.includes("억")) {
                                                        const parts = raw.split("조");
                                                        num1 = (parseFloat(parts[0]) || 0) * 10000 + (parseFloat(parts[1].replace("억", "")) || 0);
                                                    } else if (raw.includes("조")) {
                                                        num1 = (parseFloat(raw.replace("조", "")) || 0) * 10000;
                                                    } else {
                                                        num1 = parseFloat(raw.replace("억", "")) || 0;
                                                    }
                                                } else if (isSplitRow && raw.includes('/')) {
                                                    const parts = String(val).split('/');
                                                    val1Str = parts[0].trim();
                                                    val2Str = parts[1].trim();
                                                    num1 = parseFloat(raw.split('/')[0].replace(/[^0-9.]/g, '')) || 0;
                                                    num2 = parseFloat(raw.split('/')[1].replace(/[^0-9.]/g, '')) || 0;
                                                } else {
                                                    num1 = parseFloat(raw.replace(/[^0-9.-]/g, '')) || 0;
                                                }
                                                num1 = Math.abs(num1);
                                                num2 = Math.abs(num2);
                                            }


                                            const formatVisHeight = (n: number, max: number) => {
                                                if (n === 0 || max === 0) return 0;
                                                const ratio = n / max;
                                                return Math.min(100, Math.max(4, Math.pow(ratio, 0.45) * 100));
                                            };

                                            const widthH1 = isNumericRow ? formatVisHeight(num1, maxVal1) : 0;
                                            const widthH2 = isNumericRow && isSplitRow ? formatVisHeight(num2, maxVal2) : 0;
                                            const glowColors = ["bg-indigo-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500", "bg-purple-500", "bg-cyan-500", "bg-blue-500", "bg-pink-500", "bg-lime-500", "bg-orange-500"];
                                            const secColors = ["bg-indigo-400/50", "bg-emerald-400/50", "bg-amber-400/50", "bg-rose-400/50", "bg-purple-400/50", "bg-cyan-400/50", "bg-blue-400/50", "bg-pink-400/50", "bg-lime-400/50", "bg-orange-400/50"];

                                            return (
                                                <td key={`${etf.etf_code}-${idx}`} className={`py-2 px-1 lg:px-2 text-[10px] xl:text-xs font-medium ${textColor} h-full leading-tight break-keep text-center align-middle`}>
                                                    {!isNumericRow ? (
                                                        <div className="flex items-center justify-center h-full w-full">{val}</div>
                                                    ) : (
                                                        <div className="flex flex-col items-center justify-end w-full min-h-[50px] gap-2 pt-2">
                                                            <div className="flex items-end justify-center w-full h-[46px] gap-2 px-1">
                                                                <div className="w-full max-w-[80px] bg-black/40 rounded-t-md border-b border-white/10 flex flex-col justify-end overflow-hidden h-full">
                                                                    <div className={`w-full ${glowColors[idx % glowColors.length]} transition-all duration-700`} style={{ height: `${widthH1}%` }} />
                                                                </div>
                                                                {isSplitRow && val2Str && (
                                                                    <div className="w-full max-w-[80px] bg-black/40 rounded-t-md border-b border-white/10 flex flex-col justify-end overflow-hidden h-full">
                                                                        <div className={`w-full ${secColors[idx % secColors.length]} transition-all duration-700`} style={{ height: `${widthH2}%` }} />
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div className="flex w-full items-center justify-center gap-2 text-center text-[11px] 2xl:text-xs">
                                                                <span className="flex-1 min-w-[30px]">{val1Str}</span>
                                                                {isSplitRow && val2Str && <span className="flex-1 opacity-70 min-w-[30px]">{val2Str}</span>}
                                                            </div>
                                                        </div>
                                                    )}
                                                </td>
                                            )
                                        })}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </section>

            {/* Sub-Charts Section Moved to Info Tab per Request */}
            {additionalStatsData && additionalStatsData.length > 0 && (
                <div className="col-span-1 lg:col-span-4 grid grid-cols-1 lg:grid-cols-4 gap-2 md:gap-4 mt-2">
                    {/* Dedicated ETF Names Box */}
                    <section className="bg-white/[0.02] backdrop-blur-3xl rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] p-4 border border-white/5 flex flex-col min-h-[200px] relative overflow-hidden">
                        <h3 className="text-sm font-bold mb-4 flex items-center gap-2 relative z-10 text-gray-200">
                            <span className="w-1.5 h-4 bg-gray-400 rounded-full"></span>
                            종목명
                        </h3>
                        <div className="flex-1 w-full h-[180px] flex flex-col justify-around py-2 pb-[30px] shrink-0">
                            {additionalStatsData.map((d: any, idx: number) => {
                                const glowColors = ["#818cf8", "#34d399", "#fbbf24", "#f87171", "#c084fc", "#60a5fa", "#f472b6", "#a3e635", "#f97316", "#14b8a6"];
                                const isHovered = hoveredEtfName && (hoveredEtfName === d.name || d.name.includes(hoveredEtfName) || hoveredEtfName.includes(d.name));
                                return (
                                    <div key={idx}
                                        className={`text-right pr-2 font-bold text-[10px] md:text-[11px] lg:text-[12px] truncate w-full cursor-pointer transition-all duration-300 ${isHovered ? 'scale-110 shadow-[0_0_10px_rgba(255,255,255,0.3)]' : 'hover:underline'}`}
                                        style={{ color: glowColors[idx % 10] }}
                                        onMouseEnter={() => setHoveredEtfName(d.name)}
                                        onMouseLeave={() => setHoveredEtfName(null)}
                                        onClick={() => {
                                            const matchedEtf = data.raw_data?.find((cd: any) => cd.etf_name === d.name || cd.etf_code === d.name);
                                            if (matchedEtf) setSelectedDetailEtf(matchedEtf);
                                        }}>
                                        {d.name.replace(/ /g, '\u00A0')}
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                    {/* AUM Chart */}
                    <section className="bg-white/[0.02] backdrop-blur-3xl rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] p-4 border border-white/5 flex flex-col min-h-[200px] relative overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                        <h3 className="text-sm font-bold mb-4 flex items-center gap-2 relative z-10 text-gray-200">
                            <span className="w-1.5 h-4 bg-indigo-400 rounded-full"></span>
                            순자산총액 <span className="text-[10px] text-gray-500 font-normal">(단위: 억 원)</span>
                        </h3>
                        <div className="flex-1 w-full h-[180px] relative z-10">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={additionalStatsData} layout="vertical" margin={{ top: 0, right: 5, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.03)" />
                                    <XAxis type="number" tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={(val) => Math.floor(val / 10000) > 0 ? `${Math.floor(val / 10000)}조` : val} stroke="rgba(255,255,255,0.05)" axisLine={false} />
                                    <YAxis dataKey="name" type="category" hide={true} axisLine={false} />
                                    <Tooltip cursor={{ fill: 'rgba(255,255,255,0.02)' }} contentStyle={{ backgroundColor: 'rgba(9, 9, 11, 0.95)', borderColor: 'rgba(79, 70, 229, 0.2)', borderRadius: '12px', fontSize: '12px' }} itemStyle={{ color: '#818cf8', fontWeight: 'bold' }} />
                                    <Bar dataKey="aum" name="순자산(억)" radius={[0, 4, 4, 0]}>
                                        {additionalStatsData.map((d: any, idx: number) => {
                                            const isHovered = hoveredEtfName && (hoveredEtfName === d.name || d.name.includes(hoveredEtfName) || hoveredEtfName.includes(d.name));
                                            return <Cell key={`cell-${idx}`} fill={['#818cf8', '#34d399', '#fbbf24', '#f87171', '#c084fc', '#60a5fa', '#f472b6', '#a3e635', '#f97316', '#14b8a6'][idx % 10]} fillOpacity={isHovered ? 1 : 0.6} />
                                        })}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </section>

                    {/* Dividend Chart */}
                    <section className="bg-white/[0.02] backdrop-blur-3xl rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] p-4 border border-white/5 flex flex-col min-h-[200px] relative overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-tr from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                        <h3 className="text-sm font-bold mb-4 flex items-center gap-2 relative z-10 text-gray-200">
                            <span className="w-1.5 h-4 bg-emerald-400 rounded-full"></span>
                            연간배당률(TTM) <span className="text-[10px] text-gray-500 font-normal">(단위: %)</span>
                        </h3>
                        <div className="flex-1 w-full h-[180px] relative z-10">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={additionalStatsData} layout="vertical" margin={{ top: 0, right: 5, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.03)" />
                                    <XAxis type="number" tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={(val) => `${val}%`} stroke="rgba(255,255,255,0.05)" axisLine={false} />
                                    <YAxis dataKey="name" type="category" hide={true} axisLine={false} />
                                    <Tooltip cursor={{ fill: 'rgba(255,255,255,0.02)' }} contentStyle={{ backgroundColor: 'rgba(9, 9, 11, 0.95)', borderColor: 'rgba(52, 211, 153, 0.2)', borderRadius: '12px', fontSize: '12px' }} itemStyle={{ color: '#34d399', fontWeight: 'bold' }} />
                                    <Bar dataKey="dividend" name="배당률(%)" radius={[0, 4, 4, 0]}>
                                        {additionalStatsData.map((d: any, idx: number) => {
                                            const isHovered = hoveredEtfName && (hoveredEtfName === d.name || d.name.includes(hoveredEtfName) || hoveredEtfName.includes(d.name));
                                            return <Cell key={`cell-${idx}`} fill={['#818cf8', '#34d399', '#fbbf24', '#f87171', '#c084fc', '#60a5fa', '#f472b6', '#a3e635', '#f97316', '#14b8a6'][idx % 10]} fillOpacity={isHovered ? 1 : 0.6} />
                                        })}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </section>

                    {/* Fee Chart */}
                    <section className="bg-white/[0.02] backdrop-blur-3xl rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] p-4 border border-white/5 flex flex-col min-h-[200px] relative overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-tr from-rose-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                        <h3 className="text-sm font-bold mb-4 flex items-center gap-2 relative z-10 text-gray-200">
                            <span className="w-1.5 h-4 bg-rose-400 rounded-full"></span>
                            총보수율 <span className="text-[10px] text-gray-500 font-normal">(낮을수록 좋음, %)</span>
                        </h3>
                        <div className="flex-1 w-full h-[180px] relative z-10">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={additionalStatsData} layout="vertical" margin={{ top: 0, right: 5, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.03)" />
                                    <XAxis type="number" tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={(val) => `${val}%`} stroke="rgba(255,255,255,0.05)" axisLine={false} />
                                    <YAxis dataKey="name" type="category" hide={true} axisLine={false} />
                                    <Tooltip cursor={{ fill: 'rgba(255,255,255,0.02)' }} contentStyle={{ backgroundColor: 'rgba(9, 9, 11, 0.95)', borderColor: 'rgba(244, 63, 94, 0.2)', borderRadius: '12px', fontSize: '12px' }} itemStyle={{ color: '#f43f5e', fontWeight: 'bold' }} />
                                    <Bar dataKey="fee" name="수수료(%)" radius={[0, 4, 4, 0]}>
                                        {additionalStatsData.map((d: any, idx: number) => {
                                            const isHovered = hoveredEtfName && (hoveredEtfName === d.name || d.name.includes(hoveredEtfName) || hoveredEtfName.includes(d.name));
                                            return <Cell key={`cell-${idx}`} fill={['#818cf8', '#34d399', '#fbbf24', '#f87171', '#c084fc', '#60a5fa', '#f472b6', '#a3e635', '#f97316', '#14b8a6'][idx % 10]} fillOpacity={isHovered ? 1 : 0.6} />
                                        })}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </section>
                </div>
            )}

        </div>
    );
}
