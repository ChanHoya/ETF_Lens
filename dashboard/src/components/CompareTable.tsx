import React, { useState } from 'react';
import MarqueeText from './MarqueeText';
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

/** 순위 동그라미 뱃지: 1위=금, 2위=은, 3위=동, 그 외=기본 */
function RankBadge({ rank }: { rank: number }) {
    const medals: Record<number, { bg: string; text: string; border: string; label: string }> = {
        1: { bg: 'bg-yellow-500', text: 'text-black', border: 'border-yellow-300', label: '①' },
        2: { bg: 'bg-gray-300', text: 'text-black', border: 'border-gray-100', label: '②' },
        3: { bg: 'bg-amber-700', text: 'text-white', border: 'border-amber-500', label: '③' },
    };
    const rankSymbols = ['①','②','③','④','⑤','⑥','⑦','⑧','⑨','⑩'];
    const m = medals[rank];
    if (m) {
        return (
            <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-extrabold border ${m.bg} ${m.text} ${m.border} shadow-md leading-none select-none`}>
                {rank}
            </span>
        );
    }
    return (
        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold bg-white/10 text-gray-300 border border-white/20 leading-none select-none">
            {rankSymbols[rank - 1] || rank}
        </span>
    );
}

export default function CompareTable({
    data, radarData, additionalStatsData, hoveredEtfName, setHoveredEtfName, setSelectedDetailEtf
}: CompareTableProps) {
    const [isBasicInfoOpen, setIsBasicInfoOpen] = useState(false);

    if (!data || !data.data_payload) return null;

    const glowColorList = ["#818cf8", "#34d399", "#fbbf24", "#f87171", "#c084fc", "#60a5fa", "#f472b6", "#a3e635", "#f97316", "#14b8a6"];
    const glowBgList = ["bg-indigo-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500", "bg-purple-500", "bg-cyan-500", "bg-blue-500", "bg-pink-500", "bg-lime-500", "bg-orange-500"];
    const secBgList = ["bg-indigo-400/50", "bg-emerald-400/50", "bg-amber-400/50", "bg-rose-400/50", "bg-purple-400/50", "bg-cyan-400/50", "bg-blue-400/50", "bg-pink-400/50", "bg-lime-400/50", "bg-orange-400/50"];

    /** 특정 키의 각 ETF 값을 파싱해서 [절대값1, 절대값2] 반환 */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function parseNumericPair(etf: any, key: string): [number, number] {
        const isSplitRow = ['52주 최고/최저', '거래량/거래대금', '20일평균 거래량/대금'].includes(key);
        const v = etf.basic_info?.[key] || '';
        const raw = String(v).replace(/,/g, '');
        let n1 = 0, n2 = 0;
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
    }

    /** num1 기준으로 내림차순 순위 반환 (1위 = 가장 큰 값) */
    function getRanks(key: string): number[] {
        if (!data.raw_data) return [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const vals = data.raw_data.map((e: any) => parseNumericPair(e, key)[0]);
        // 수익률 계열은 낮은 값이 높은 순위(비용/수수료). 수익률은 높을수록 좋음.
        const isCostRow = key === '펀드보수';
        const sorted = [...vals]
            .map((v, i) => ({ v, i }))
            .sort((a, b) => isCostRow ? a.v - b.v : b.v - a.v);
        const ranks = new Array(vals.length);
        sorted.forEach((item, rank) => { ranks[item.i] = rank + 1; });
        return ranks;
    }

    /** 기본 정보 테이블 JSX (모달/인라인 공용) */
    function BasicInfoTable({ compact }: { compact?: boolean }) {
        const numericRows = ['순자산총액', '상장주식수', '52주 최고/최저', '거래량/거래대금', '20일평균 거래량/대금', '펀드보수', '최근 분배율(TTM)', '1M 수익률', '3M 수익률', '6M 수익률', '1Y 수익률'];
        const allRows = ['운용사', '최초데이터(상장추정)', '현재가 및 NAV (괴리율)', ...numericRows];

        return (
            <div className={`w-full overflow-x-auto border border-white/5 rounded-xl custom-scrollbar ${compact ? 'max-h-[82vh]' : 'max-h-[88vh]'} overflow-y-auto`}>
                <table className="text-left border-collapse table-auto" style={{ minWidth: 'max-content', width: '100%' }}>
                    <thead className="sticky top-0 z-30 backdrop-blur-xl bg-[#0B0F19]/95 shadow-md border-b border-white/10">
                        <tr>
                            {/* 항목 열 - sticky left */}
                            <th className="sticky left-0 z-40 bg-[#0B0F19]/98 py-2 px-3 text-[10px] md:text-xs font-bold text-gray-500 border-r border-white/10 whitespace-nowrap min-w-[80px] w-[80px]">항목</th>
                            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                            {data.raw_data && data.raw_data.map((etf: any, idx: number) => {
                                const isDanger = etf.etf_name.includes('인버스') || etf.etf_name.includes('레버리지') || etf.etf_name.includes('선물') || etf.etf_name.includes('블룸버그');
                                return (
                                    <th key={`${etf.etf_code}-${idx}`}
                                        className="py-2 px-2 text-[10px] xl:text-xs font-bold text-center group cursor-pointer hover:bg-white/[0.05] transition-colors leading-tight min-w-[110px] w-[110px]"
                                        onClick={() => setSelectedDetailEtf(etf)}
                                        style={{ color: glowColorList[idx % glowColorList.length] }}
                                    >
                                        <div className="flex flex-col items-center justify-end gap-1 h-full pb-1">
                                            {isDanger
                                                ? <span className="text-[8px] bg-rose-500/10 text-rose-400 px-1 py-0.5 rounded border border-rose-500/30 whitespace-nowrap">퇴직연금 불가</span>
                                                : <span className="text-[8px] bg-emerald-500/10 text-emerald-400 px-1 py-0.5 rounded border border-emerald-500/30 whitespace-nowrap">연금 가능</span>
                                            }
                                             <MarqueeText
                                               text={etf.etf_name}
                                               className="group-hover:underline underline-offset-4 text-[10px] xl:text-[11px] max-w-[100px]"
                                             />
                                            <span className="text-[9px] text-gray-500 whitespace-nowrap">{etf.etf_code}</span>
                                        </div>
                                    </th>
                                );
                            })}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.05]">
                        {allRows.map((key) => {
                            const isNumericRow = numericRows.includes(key);
                            const isSplitRow = ['52주 최고/최저', '거래량/거래대금', '20일평균 거래량/대금'].includes(key);
                            const ranks = isNumericRow ? getRanks(key) : [];

                            let maxVal1 = 1, maxVal2 = 1;
                            if (isNumericRow && data.raw_data) {
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                const parsedVals = data.raw_data.map((e: any) => parseNumericPair(e, key));
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                maxVal1 = Math.max(...parsedVals.map((p: any) => p[0])) || 1;
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                maxVal2 = Math.max(...parsedVals.map((p: any) => p[1])) || 1;
                                if (key === '52주 최고/최저') {
                                    const absMax = Math.max(maxVal1, maxVal2);
                                    maxVal1 = absMax; maxVal2 = absMax;
                                }
                            }

                            return (
                                <tr key={key} className="hover:bg-white/[0.03] transition-colors">
                                    {/* 항목 이름 - sticky left */}
                                    <td className="sticky left-0 z-10 bg-[#0B0F19]/95 py-3 px-3 text-[10px] md:text-xs font-semibold text-gray-400 border-r border-white/10 align-middle whitespace-nowrap min-w-[80px] w-[80px]">{key}</td>
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
                                            } else { val = 'N/A'; }
                                        }

                                        const isYield = key.includes('수익률');
                                        const isDisparity = key === '현재가 및 NAV (괴리율)';
                                        const isPositive = (isYield && typeof val === 'string' && val.includes('%') && !val.includes('-')) || (isDisparity && typeof val === 'string' && val.includes('+'));
                                        const isNegative = (isYield && typeof val === 'string' && val.includes('%') && val.includes('-')) || (isDisparity && typeof val === 'string' && val.includes('-') && val.includes('%'));
                                        const textColor = isPositive ? 'text-rose-400' : isNegative ? 'text-blue-400' : 'text-gray-100';

                                        let num1 = 0, num2 = 0;
                                        let val1Str = val, val2Str = "";

                                        if (isNumericRow) {
                                            const [n1, n2] = parseNumericPair(etf, key);
                                            num1 = n1; num2 = n2;
                                            if (isSplitRow && String(val).includes('/')) {
                                                const parts = String(val).split('/');
                                                val1Str = parts[0].trim();
                                                val2Str = parts[1]?.trim() || "";
                                            }
                                        }

                                        const formatVisHeight = (n: number, max: number) => {
                                            if (n === 0 || max === 0) return 0;
                                            return Math.min(100, Math.max(4, Math.pow(n / max, 0.45) * 100));
                                        };

                                        const widthH1 = isNumericRow ? formatVisHeight(num1, maxVal1) : 0;
                                        const widthH2 = isNumericRow && isSplitRow ? formatVisHeight(num2, maxVal2) : 0;
                                        const rank = isNumericRow && ranks.length > 0 ? ranks[idx] : 0;

                                        return (
                                            <td key={`${etf.etf_code}-${idx}`} className={`py-2 px-2 text-[10px] xl:text-xs font-medium ${textColor} h-full leading-tight text-center align-middle min-w-[110px] w-[110px]`}>
                                                {!isNumericRow ? (
                                                    <div className="flex items-center justify-center h-full w-full">{val}</div>
                                                ) : (
                                                    <div className="flex flex-col items-center justify-end w-full min-h-[50px] gap-1 pt-1">
                                                        {/* 순위 뱃지 */}
                                                        <RankBadge rank={rank} />
                                                        {/* 막대 그래프 */}
                                                        <div className="flex items-end justify-center w-full h-[40px] gap-2 px-1">
                                                            <div className="w-full max-w-[80px] bg-black/40 rounded-t-md border-b border-white/10 flex flex-col justify-end overflow-hidden h-full">
                                                                <div className={`w-full ${glowBgList[idx % glowBgList.length]} transition-all duration-700`} style={{ height: `${widthH1}%` }} />
                                                            </div>
                                                            {isSplitRow && val2Str && (
                                                                <div className="w-full max-w-[80px] bg-black/40 rounded-t-md border-b border-white/10 flex flex-col justify-end overflow-hidden h-full">
                                                                    <div className={`w-full ${secBgList[idx % secBgList.length]} transition-all duration-700`} style={{ height: `${widthH2}%` }} />
                                                                </div>
                                                            )}
                                                        </div>
                                                        {/* 값 텍스트 */}
                                                        <div className="flex w-full items-center justify-center gap-2 text-center text-[11px] 2xl:text-xs">
                                                            <span className="flex-1 min-w-[30px]">{val1Str}</span>
                                                            {isSplitRow && val2Str && <span className="flex-1 opacity-70 min-w-[30px]">{val2Str}</span>}
                                                        </div>
                                                    </div>
                                                )}
                                            </td>
                                        );
                                    })}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        );
    }

    return (
        <>
            {/* ===== 풀스크린 기본 정보 모달 ===== */}
            {isBasicInfoOpen && (
                <div className="fixed inset-0 z-[300] flex items-start justify-center bg-black/80 backdrop-blur-md animate-in fade-in duration-200 p-2 md:p-4 overflow-y-auto">
                    <div className="bg-[#0B0F19] border border-white/10 rounded-2xl w-full max-w-[1800px] min-h-fit overflow-hidden flex flex-col shadow-2xl shadow-indigo-500/10 my-2">
                        {/* 모달 헤더 */}
                        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 sticky top-0 z-40 bg-[#0B0F19]/95 backdrop-blur-xl">
                            <h2 className="text-lg font-bold flex items-center gap-3">
                                <span className="w-1.5 h-6 bg-gradient-to-b from-teal-400 to-emerald-500 rounded-full"></span>
                                기본 정보
                                <span className="text-xs text-gray-500 font-normal">— 종목 클릭 시 상세 조회</span>
                            </h2>
                            <button
                                onClick={() => setIsBasicInfoOpen(false)}
                                className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-xl text-sm font-medium"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                닫기
                            </button>
                        </div>
                        {/* 모달 본문 */}
                        <div className="p-4 md:p-6 overflow-y-auto">
                            <BasicInfoTable />
                        </div>
                    </div>
                </div>
            )}

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
                                    const rowColor = glowColorList[i % glowColorList.length];
                                    const isRowHovered = hoveredEtfName && (
                                        row[0].includes(hoveredEtfName) || hoveredEtfName.includes(row[0]) ||
                                        (data.raw_data && data.raw_data.find((e: any) => (e.etf_name === hoveredEtfName || e.etf_code === hoveredEtfName) && (row[0].includes(e.etf_name) || row[0].includes(e.etf_code))))
                                    );
                                    return (
                                        <tr key={i}
                                            className="transition-all duration-150 group/row cursor-default"
                                            style={isRowHovered ? {
                                                backgroundColor: `${rowColor}40`,
                                                borderLeft: `4px solid ${rowColor}`,
                                                boxShadow: `inset 0 0 30px ${rowColor}25, 0 2px 12px ${rowColor}20`,
                                                transform: 'scaleY(1.04)',
                                                zIndex: 10,
                                                position: 'relative',
                                            } : {
                                                borderLeft: '4px solid transparent',
                                                opacity: hoveredEtfName ? 0.45 : 1,
                                            }}
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
                                                                isPositive ? 'text-emerald-400' : isRowHovered ? 'text-white' : 'text-gray-200'
                                                            } ${isRowHovered && j > 0 ? 'font-semibold' : ''}`}
                                                        style={j === 0 ? { color: rowColor, ...(isRowHovered ? { textShadow: `0 0 18px ${rowColor}, 0 0 8px ${rowColor}` } : {}) } : (isRowHovered && j > 0 ? { textShadow: `0 0 8px rgba(255,255,255,0.5)` } : undefined)}
                                                        title={j === 0 ? cell : undefined}
                                                        onClick={() => {
                                                            if (matchedEtf) setSelectedDetailEtf(matchedEtf);
                                                        }}
                                                    >
                                                        {j === 0 ? (
                                                            <MarqueeText
                                                              text={cell}
                                                              className="font-bold w-full"
                                                              style={{ color: rowColor, ...(isRowHovered ? { textShadow: `0 0 18px ${rowColor}, 0 0 8px ${rowColor}` } : {}) }}
                                                            />
                                                        ) : cell}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    );
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
                                        const c = glowColorList[idx % glowColorList.length];
                                        const isHovered = hoveredEtfName && (hoveredEtfName === key || key.includes(hoveredEtfName) || hoveredEtfName.includes(key));
                                        const isOthersHovered = hoveredEtfName && !isHovered;
                                        return (
                                            <tr key={key}
                                                className="transition-all duration-200"
                                                style={isHovered ? { backgroundColor: `${c}22`, boxShadow: `inset 0 0 12px ${c}15` } : {}}
                                                onMouseEnter={() => setHoveredEtfName(key)}
                                                onMouseLeave={() => setHoveredEtfName(null)}>
                                                <td className="px-2 py-0.5 border-b border-white/5">
                                                    <div className="flex justify-center items-center w-full h-full">
                                                        <div
                                                            className={`rounded-full transition-all duration-300 ${isHovered ? 'w-3 h-3 animate-pulse' : 'w-2 h-2'}`}
                                                            style={{ backgroundColor: c, boxShadow: isHovered ? `0 0 14px 4px ${c}` : `0 0 6px ${c}` }}
                                                        />
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
                                                        <td key={row.subject} className={`px-1 py-0.5 border-b border-white/5 relative transition-all duration-200 ${isOthersHovered ? 'opacity-30' : 'opacity-100'}`}>
                                                            <div
                                                                className={`w-full h-full min-h-[22px] flex items-center justify-center rounded text-[10px] md:text-[12px] font-mono transition-all duration-200 ${textColor} ${isHovered ? 'font-extrabold' : 'font-bold'}`}
                                                                style={{
                                                                    backgroundColor: `hsl(${hue}, 85%, ${lightness}%)`,
                                                                    ...(isHovered ? {
                                                                        transform: 'scale(1.18)',
                                                                        boxShadow: `0 0 16px 4px hsl(${hue}, 85%, ${lightness}%), 0 0 6px 2px ${c}`,
                                                                        outline: `2px solid hsl(${hue}, 100%, 80%)`,
                                                                        outlineOffset: '1px',
                                                                        zIndex: 20,
                                                                        position: 'relative',
                                                                    } : {})
                                                                }}
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
                                    const c = glowColorList[idx % glowColorList.length];
                                    const isHovered = hoveredEtfName && (hoveredEtfName === etfName || etfName.includes(hoveredEtfName) || hoveredEtfName.includes(etfName));
                                    const isOthersHovered = hoveredEtfName && !isHovered;
                                    return (
                                        <Radar key={etfName} name={etfName} dataKey={etfName} stroke={c}
                                            strokeWidth={isHovered ? 4 : 2} fill={c}
                                            fillOpacity={isHovered ? 0.7 : (isOthersHovered ? 0.05 : 0.3)}
                                            className={isHovered ? 'animate-pulse' : 'transition-all duration-300'} />
                                    );
                                })}
                            </RadarChart>
                        </ResponsiveContainer>
                    </div>
                </section>

                {/* Detailed Basic Info — 인라인 미리보기 + 팝업 버튼 */}
                <section className="bg-white/[0.02] backdrop-blur-3xl rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] p-5 border border-white/5 lg:col-span-4 mt-2 overflow-x-auto min-h-[85vh]">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-base md:text-lg font-bold flex items-center gap-3">
                            <span className="w-1.5 h-6 bg-gradient-to-b from-teal-400 to-emerald-500 rounded-full"></span>
                            기본 정보
                        </h3>
                        <button
                            onClick={() => setIsBasicInfoOpen(true)}
                            className="flex items-center gap-2 text-sm font-medium text-teal-300 hover:text-white bg-teal-500/10 hover:bg-teal-500/20 border border-teal-500/30 hover:border-teal-400/60 px-3 py-1.5 rounded-xl transition-all duration-200"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
                            전체화면으로 보기
                        </button>
                    </div>
                    <BasicInfoTable compact />
                </section>

                {/* Sub-Charts Section */}
                {additionalStatsData && additionalStatsData.length > 0 && (
                    <div className="col-span-1 lg:col-span-4 grid grid-cols-1 lg:grid-cols-4 gap-2 md:gap-4 mt-2">
                        {/* Dedicated ETF Names Box */}
                        <section className="bg-white/[0.02] backdrop-blur-3xl rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] p-4 border border-white/5 flex flex-col min-h-[200px] relative overflow-hidden">
                            <h3 className="text-sm font-bold mb-4 flex items-center gap-2 relative z-10 text-gray-200">
                                <span className="w-1.5 h-4 bg-gray-400 rounded-full"></span>
                                종목명
                            </h3>
                            <div className="flex-1 w-full h-[180px] flex flex-col justify-around py-2 pb-[30px] shrink-0">
                                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                                {additionalStatsData.map((d: any, idx: number) => {
                                    const isHovered = hoveredEtfName && (hoveredEtfName === d.name || d.name.includes(hoveredEtfName) || hoveredEtfName.includes(d.name));
                                    return (
                                        <div key={idx}
                                            className={`text-right pr-2 font-bold text-[10px] md:text-[11px] lg:text-[12px] w-full cursor-pointer transition-all duration-300 ${isHovered ? 'scale-110 shadow-[0_0_10px_rgba(255,255,255,0.3)]' : 'hover:underline'}`}
                                            style={{ color: glowColorList[idx % 10] }}
                                            onMouseEnter={() => setHoveredEtfName(d.name)}
                                            onMouseLeave={() => setHoveredEtfName(null)}
                                            onClick={() => {
                                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                                const matchedEtf = data.raw_data?.find((cd: any) => cd.etf_name === d.name || cd.etf_code === d.name);
                                                if (matchedEtf) setSelectedDetailEtf(matchedEtf);
                                            }}>
                                            <MarqueeText
                                              text={d.name}
                                              className="w-full"
                                              style={{ color: glowColorList[idx % 10] }}
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                        </section>

                        {/* AUM Chart */}
                        <section className="bg-white/[0.02] backdrop-blur-3xl rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] p-4 border border-white/5 flex flex-col min-h-[200px] relative overflow-hidden group">
                            <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                            <h3 className="text-sm font-bold mb-1 flex items-center gap-2 relative z-10 text-gray-200">
                                <span className="w-1.5 h-4 bg-indigo-400 rounded-full"></span>
                                순자산총액 <span className="text-[10px] text-gray-500 font-normal">(단위: 억 원)</span>
                            </h3>
                            {/* 순위 뱃지 행 */}
                            <div className="flex items-center gap-1 mb-2 relative z-10 pl-1">
                                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                                {[...additionalStatsData].map((d: any, idx: number) => ({ v: d.aum, idx }))
                                    .sort((a, b) => b.v - a.v)
                                    .map((item, rank) => (
                                        <div key={item.idx} className="flex items-center gap-0.5">
                                            <RankBadge rank={rank + 1} />
                                            <span className="text-[9px] truncate max-w-[50px]" style={{ color: glowColorList[item.idx % 10] }}>{additionalStatsData[item.idx]?.name?.split(' ').pop()}</span>
                                        </div>
                                    ))}
                            </div>
                            <div className="flex-1 w-full h-[160px] relative z-10">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={additionalStatsData} layout="vertical" margin={{ top: 0, right: 5, left: -20, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.03)" />
                                        <XAxis type="number" tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={(val) => Math.floor(val / 10000) > 0 ? `${Math.floor(val / 10000)}조` : val} stroke="rgba(255,255,255,0.05)" axisLine={false} />
                                        <YAxis dataKey="name" type="category" hide={true} axisLine={false} />
                                        <Tooltip cursor={{ fill: 'rgba(255,255,255,0.02)' }} contentStyle={{ backgroundColor: 'rgba(9, 9, 11, 0.95)', borderColor: 'rgba(79, 70, 229, 0.2)', borderRadius: '12px', fontSize: '12px' }} itemStyle={{ color: '#818cf8', fontWeight: 'bold' }} />
                                        <Bar dataKey="aum" name="순자산(억)" radius={[0, 4, 4, 0]}>
                                            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                                            {additionalStatsData.map((d: any, idx: number) => {
                                                const isHovered = hoveredEtfName && (hoveredEtfName === d.name || d.name.includes(hoveredEtfName) || hoveredEtfName.includes(d.name));
                                                return <Cell key={`cell-${idx}`} fill={['#818cf8', '#34d399', '#fbbf24', '#f87171', '#c084fc', '#60a5fa', '#f472b6', '#a3e635', '#f97316', '#14b8a6'][idx % 10]} fillOpacity={isHovered ? 1 : 0.6} />;
                                            })}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </section>

                        {/* Dividend Chart */}
                        <section className="bg-white/[0.02] backdrop-blur-3xl rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] p-4 border border-white/5 flex flex-col min-h-[200px] relative overflow-hidden group">
                            <div className="absolute inset-0 bg-gradient-to-tr from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                            <h3 className="text-sm font-bold mb-1 flex items-center gap-2 relative z-10 text-gray-200">
                                <span className="w-1.5 h-4 bg-emerald-400 rounded-full"></span>
                                연간배당률(TTM) <span className="text-[10px] text-gray-500 font-normal">(단위: %)</span>
                            </h3>
                            {/* 순위 뱃지 행 */}
                            <div className="flex items-center gap-1 mb-2 relative z-10 pl-1">
                                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                                {[...additionalStatsData].map((d: any, idx: number) => ({ v: d.dividend, idx }))
                                    .sort((a, b) => b.v - a.v)
                                    .map((item, rank) => (
                                        <div key={item.idx} className="flex items-center gap-0.5">
                                            <RankBadge rank={rank + 1} />
                                            <span className="text-[9px] truncate max-w-[50px]" style={{ color: glowColorList[item.idx % 10] }}>{additionalStatsData[item.idx]?.name?.split(' ').pop()}</span>
                                        </div>
                                    ))}
                            </div>
                            <div className="flex-1 w-full h-[160px] relative z-10">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={additionalStatsData} layout="vertical" margin={{ top: 0, right: 5, left: -20, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.03)" />
                                        <XAxis type="number" tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={(val) => `${val}%`} stroke="rgba(255,255,255,0.05)" axisLine={false} />
                                        <YAxis dataKey="name" type="category" hide={true} axisLine={false} />
                                        <Tooltip cursor={{ fill: 'rgba(255,255,255,0.02)' }} contentStyle={{ backgroundColor: 'rgba(9, 9, 11, 0.95)', borderColor: 'rgba(52, 211, 153, 0.2)', borderRadius: '12px', fontSize: '12px' }} itemStyle={{ color: '#34d399', fontWeight: 'bold' }} />
                                        <Bar dataKey="dividend" name="배당률(%)" radius={[0, 4, 4, 0]}>
                                            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                                            {additionalStatsData.map((d: any, idx: number) => {
                                                const isHovered = hoveredEtfName && (hoveredEtfName === d.name || d.name.includes(hoveredEtfName) || hoveredEtfName.includes(d.name));
                                                return <Cell key={`cell-${idx}`} fill={['#818cf8', '#34d399', '#fbbf24', '#f87171', '#c084fc', '#60a5fa', '#f472b6', '#a3e635', '#f97316', '#14b8a6'][idx % 10]} fillOpacity={isHovered ? 1 : 0.6} />;
                                            })}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </section>

                        {/* Fee Chart */}
                        <section className="bg-white/[0.02] backdrop-blur-3xl rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] p-4 border border-white/5 flex flex-col min-h-[200px] relative overflow-hidden group">
                            <div className="absolute inset-0 bg-gradient-to-tr from-rose-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                            <h3 className="text-sm font-bold mb-1 flex items-center gap-2 relative z-10 text-gray-200">
                                <span className="w-1.5 h-4 bg-rose-400 rounded-full"></span>
                                총보수율 <span className="text-[10px] text-gray-500 font-normal">(낮을수록 좋음, %)</span>
                            </h3>
                            {/* 순위 뱃지 행 (보수율은 낮을수록 좋으므로 오름차순) */}
                            <div className="flex items-center gap-1 mb-2 relative z-10 pl-1">
                                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                                {[...additionalStatsData].map((d: any, idx: number) => ({ v: d.fee, idx }))
                                    .sort((a, b) => a.v - b.v)
                                    .map((item, rank) => (
                                        <div key={item.idx} className="flex items-center gap-0.5">
                                            <RankBadge rank={rank + 1} />
                                            <span className="text-[9px] truncate max-w-[50px]" style={{ color: glowColorList[item.idx % 10] }}>{additionalStatsData[item.idx]?.name?.split(' ').pop()}</span>
                                        </div>
                                    ))}
                            </div>
                            <div className="flex-1 w-full h-[160px] relative z-10">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={additionalStatsData} layout="vertical" margin={{ top: 0, right: 5, left: -20, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.03)" />
                                        <XAxis type="number" tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={(val) => `${val}%`} stroke="rgba(255,255,255,0.05)" axisLine={false} />
                                        <YAxis dataKey="name" type="category" hide={true} axisLine={false} />
                                        <Tooltip cursor={{ fill: 'rgba(255,255,255,0.02)' }} contentStyle={{ backgroundColor: 'rgba(9, 9, 11, 0.95)', borderColor: 'rgba(244, 63, 94, 0.2)', borderRadius: '12px', fontSize: '12px' }} itemStyle={{ color: '#f43f5e', fontWeight: 'bold' }} />
                                        <Bar dataKey="fee" name="수수료(%)" radius={[0, 4, 4, 0]}>
                                            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                                            {additionalStatsData.map((d: any, idx: number) => {
                                                const isHovered = hoveredEtfName && (hoveredEtfName === d.name || d.name.includes(hoveredEtfName) || hoveredEtfName.includes(d.name));
                                                return <Cell key={`cell-${idx}`} fill={['#818cf8', '#34d399', '#fbbf24', '#f87171', '#c084fc', '#60a5fa', '#f472b6', '#a3e635', '#f97316', '#14b8a6'][idx % 10]} fillOpacity={isHovered ? 1 : 0.6} />;
                                            })}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </section>
                    </div>
                )}
            </div>
        </>
    );
}
