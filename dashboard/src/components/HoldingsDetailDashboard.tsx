"use client";
// 보유 종목을 종목/금융사/섹터 기준으로 집계해 차트와 표로 보여주는 대시보드 모달
import React, { useMemo, useState } from "react";
import { X, BarChart3, Building2, Layers, TrendingUp, TrendingDown, PieChart as PieIcon } from "lucide-react";
import {
    PieChart,
    Pie,
    Cell,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend,
} from "recharts";

interface HoldingsDetailDashboardProps {
    isOpen: boolean;
    onClose: () => void;
    allHoldings: any[];
}

const CHART_COLORS = [
    "#6366f1", "#10b981", "#f59e0b", "#06b6d4", "#a855f7",
    "#f43f5e", "#3b82f6", "#84cc16", "#ec4899", "#14b8a6",
    "#f97316", "#8b5cf6",
];

type TabKey = "stock" | "broker" | "sector";

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: "stock", label: "종목별", icon: <BarChart3 className="w-3.5 h-3.5" /> },
    { key: "broker", label: "금융사별", icon: <Building2 className="w-3.5 h-3.5" /> },
    { key: "sector", label: "섹터/분류별", icon: <Layers className="w-3.5 h-3.5" /> },
];

const fmtKRW = (n: number) => {
    if (isNaN(n) || n === null || n === undefined) return "0";
    return new Intl.NumberFormat("ko-KR").format(Math.round(n));
};

const fmtShort = (n: number) => {
    if (isNaN(n) || n === null || n === undefined) return "0";
    const abs = Math.abs(n);
    if (abs >= 1e8) return `${(n / 1e8).toFixed(2)}억`;
    if (abs >= 1e4) return `${Math.round(n / 1e4)}만`;
    return fmtKRW(n);
};

const PieTooltipContent = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
        <div className="bg-[#1e2030] border border-white/10 rounded-xl px-4 py-3 shadow-2xl text-xs">
            <p className="font-bold text-white mb-1">{d.name}</p>
            <p className="text-gray-300">
                평가금액: <span className="font-mono font-semibold text-white">{fmtKRW(d.value)}원</span>
            </p>
            <p className="text-gray-300">
                비중: <span className="font-mono font-semibold text-indigo-300">{d.pct?.toFixed(1)}%</span>
            </p>
            {d.count !== undefined && (
                <p className="text-gray-300">
                    종목 수: <span className="font-semibold text-white">{d.count}개</span>
                </p>
            )}
        </div>
    );
};

const BarTooltipContent = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
        <div className="bg-[#1e2030] border border-white/10 rounded-xl px-4 py-3 shadow-2xl text-xs">
            <p className="font-bold text-white mb-1">{d.name}</p>
            {payload.map((p: any, i: number) => (
                <p key={i} className="text-gray-300">
                    <span style={{ color: p.color }}>{p.name}:</span>{" "}
                    <span className="font-mono font-semibold">{fmtKRW(p.value)}원</span>
                </p>
            ))}
        </div>
    );
};

function aggregateBy(holdings: any[], key: string) {
    const map: Record<string, { evalAmount: number; purchaseAmount: number; profitLoss: number; count: number }> = {};
    holdings.forEach((h) => {
        const k = h[key] || "기타";
        if (!map[k]) map[k] = { evalAmount: 0, purchaseAmount: 0, profitLoss: 0, count: 0 };
        map[k].evalAmount += h.eval_amount || 0;
        map[k].purchaseAmount += h.purchase_amount || 0;
        map[k].profitLoss += h.profit_loss || 0;
        map[k].count += 1;
    });
    const totalEval = Object.values(map).reduce((s, v) => s + v.evalAmount, 0);
    return Object.entries(map)
        .map(([name, v]) => ({
            name,
            value: v.evalAmount,
            purchaseAmount: v.purchaseAmount,
            profitLoss: v.profitLoss,
            returnRate: v.purchaseAmount > 0 ? (v.profitLoss / v.purchaseAmount) * 100 : 0,
            pct: totalEval > 0 ? (v.evalAmount / totalEval) * 100 : 0,
            count: v.count,
        }))
        .sort((a, b) => b.value - a.value);
}

export default function HoldingsDetailDashboard({
    isOpen,
    onClose,
    allHoldings,
}: HoldingsDetailDashboardProps) {
    const [activeTab, setActiveTab] = useState<TabKey>("stock");

    const stockData = useMemo(() => aggregateBy(allHoldings, "name"), [allHoldings]);
    const brokerData = useMemo(() => aggregateBy(allHoldings, "broker"), [allHoldings]);
    const sectorData = useMemo(() => aggregateBy(allHoldings, "sector"), [allHoldings]);

    const currentData = activeTab === "stock" ? stockData : activeTab === "broker" ? brokerData : sectorData;

    const returnRankData = useMemo(() => {
        return [...currentData].sort((a, b) => b.returnRate - a.returnRate).slice(0, 12);
    }, [currentData]);

    const maxReturnAbs = useMemo(
        () => Math.max(...returnRankData.map((d) => Math.abs(d.returnRate)), 1),
        [returnRankData]
    );

    // 훅은 모두 호출한 뒤에 닫힘 처리한다.
    // (조기 return 을 훅 위에 두면 isOpen 이 바뀔 때 훅 개수가 달라져 React 가 예외를 던진다)
    if (!isOpen) return null;

    const pieData = currentData.slice(0, 10);
    const labelMap = { stock: "종목", broker: "금융사", sector: "섹터" };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div className="relative w-full max-w-6xl max-h-[92vh] overflow-y-auto mx-4 rounded-3xl bg-gradient-to-br from-[#0f1117] to-[#161922] border border-white/10 shadow-2xl animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="sticky top-0 z-10 bg-[#0f1117]/95 backdrop-blur-xl px-6 py-4 border-b border-white/10 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30">
                            <BarChart3 className="w-5 h-5 text-purple-300" />
                        </div>
                        <div>
                            <h2 className="text-lg font-black text-white">보유 종목 상세 대시보드</h2>
                            <p className="text-[11px] text-gray-400">
                                Holdings Analysis — 종목/금융사/섹터별 자산 분석 및 수익률 비교
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/10 rounded-xl transition-colors text-gray-400 hover:text-white"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Tab Bar */}
                <div className="px-6 py-3 border-b border-white/5 flex gap-2 bg-black/20">
                    {TABS.map((tab) => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                                activeTab === tab.key
                                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30"
                                    : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white"
                            }`}
                        >
                            {tab.icon}
                            {tab.label}
                        </button>
                    ))}
                    <div className="ml-auto flex items-center text-[11px] text-gray-500">
                        총 {allHoldings.length}개 종목 분석 중
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 flex flex-col gap-5">
                    {/* Charts Row */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {/* Pie Chart */}
                        <div className="p-5 rounded-2xl bg-[#161922] border border-white/10">
                            <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-4">
                                <PieIcon className="w-4 h-4 text-indigo-400" />
                                {labelMap[activeTab]}별 자산 비중 {pieData.length < currentData.length && `(Top ${pieData.length})`}
                            </h3>
                            <ResponsiveContainer width="100%" height={280}>
                                <PieChart>
                                    <Pie
                                        data={pieData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={55}
                                        outerRadius={95}
                                        paddingAngle={2}
                                        dataKey="value"
                                        stroke="none"
                                    >
                                        {pieData.map((_: any, i: number) => (
                                            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip content={<PieTooltipContent />} />
                                    <Legend
                                        verticalAlign="bottom"
                                        iconType="circle"
                                        iconSize={7}
                                        formatter={(value: string) => (
                                            <span className="text-[10px] text-gray-300">{value}</span>
                                        )}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Bar Chart — 매수 vs 평가 */}
                        <div className="p-5 rounded-2xl bg-[#161922] border border-white/10">
                            <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-4">
                                <BarChart3 className="w-4 h-4 text-purple-400" />
                                {labelMap[activeTab]}별 매수 vs 평가
                            </h3>
                            <ResponsiveContainer width="100%" height={280}>
                                <BarChart data={currentData.slice(0, 8)} barCategoryGap="20%">
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                    <XAxis
                                        dataKey="name"
                                        tick={{ fill: "#9ca3af", fontSize: 9 }}
                                        axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                                        tickLine={false}
                                        interval={0}
                                        angle={-20}
                                        textAnchor="end"
                                        height={50}
                                    />
                                    <YAxis
                                        tick={{ fill: "#9ca3af", fontSize: 10 }}
                                        axisLine={false}
                                        tickLine={false}
                                        tickFormatter={(v: number) => fmtShort(v)}
                                    />
                                    <Tooltip content={<BarTooltipContent />} />
                                    <Legend
                                        iconType="circle"
                                        iconSize={8}
                                        formatter={(value: string) => (
                                            <span className="text-[11px] text-gray-300">{value}</span>
                                        )}
                                    />
                                    <Bar dataKey="purchaseAmount" name="매수총액" fill="#64748b" radius={[3, 3, 0, 0]} />
                                    <Bar dataKey="value" name="평가총액" fill="#a855f7" radius={[3, 3, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Return Rate Rankings */}
                    <div className="p-5 rounded-2xl bg-[#161922] border border-white/10">
                        <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-4">
                            <TrendingUp className="w-4 h-4 text-rose-400" />
                            {labelMap[activeTab]}별 수익률 랭킹
                        </h3>
                        <div className="flex flex-col gap-2.5">
                            {returnRankData.map((item, idx) => {
                                const isPositive = item.returnRate >= 0;
                                const barWidth = Math.min(100, (Math.abs(item.returnRate) / maxReturnAbs) * 100);

                                return (
                                    <div key={idx} className="flex items-center gap-2">
                                        <span className="text-[10px] text-gray-500 font-mono w-5 shrink-0 text-right">
                                            {idx + 1}
                                        </span>
                                        <span className="text-xs text-gray-300 font-semibold w-32 shrink-0 truncate text-right" title={item.name}>
                                            {item.name}
                                        </span>
                                        <div className="flex-1 flex items-center gap-2">
                                            <div className="flex-1 h-5 bg-white/5 rounded-lg overflow-hidden relative">
                                                <div
                                                    className={`h-full rounded-lg transition-all duration-500 ${
                                                        isPositive
                                                            ? "bg-gradient-to-r from-rose-500/30 to-rose-500"
                                                            : "bg-gradient-to-r from-blue-500/30 to-blue-500"
                                                    }`}
                                                    style={{ width: `${barWidth}%` }}
                                                />
                                                <span className={`absolute inset-y-0 right-2 flex items-center text-[10px] font-mono font-bold ${
                                                    isPositive ? "text-rose-300" : "text-blue-300"
                                                }`}>
                                                    {isPositive ? "+" : ""}{item.returnRate.toFixed(2)}%
                                                </span>
                                            </div>
                                            <span className={`text-[10px] font-mono w-16 text-right shrink-0 ${
                                                isPositive ? "text-rose-400/80" : "text-blue-400/80"
                                            }`}>
                                                {isPositive ? "+" : ""}{fmtShort(item.profitLoss)}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Full Detail Table */}
                    <div className="p-5 rounded-2xl bg-[#161922] border border-white/10">
                        <h3 className="text-sm font-bold text-white mb-3">📋 {labelMap[activeTab]}별 상세 수치</h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs border-collapse">
                                <thead>
                                    <tr className="border-b border-white/10 text-gray-400 font-semibold">
                                        <th className="py-2.5 px-3 text-left">{labelMap[activeTab]}</th>
                                        <th className="py-2.5 px-3 text-right">종목 수</th>
                                        <th className="py-2.5 px-3 text-right">매수총액</th>
                                        <th className="py-2.5 px-3 text-right">평가총액</th>
                                        <th className="py-2.5 px-3 text-right">평가손익</th>
                                        <th className="py-2.5 px-3 text-right">수익률</th>
                                        <th className="py-2.5 px-3 text-right">비중</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {currentData.map((item, i) => {
                                        const isItemProfit = item.profitLoss >= 0;
                                        return (
                                            <tr key={i} className="hover:bg-white/[0.03]">
                                                <td className="py-2.5 px-3 font-bold text-white">{item.name}</td>
                                                <td className="py-2.5 px-3 text-right font-mono text-gray-400">{item.count}</td>
                                                <td className="py-2.5 px-3 text-right font-mono text-gray-300">{fmtKRW(item.purchaseAmount)}원</td>
                                                <td className="py-2.5 px-3 text-right font-mono text-white font-semibold">{fmtKRW(item.value)}원</td>
                                                <td className={`py-2.5 px-3 text-right font-mono font-bold ${isItemProfit ? "text-rose-400" : "text-blue-400"}`}>
                                                    {isItemProfit ? "+" : ""}{fmtKRW(item.profitLoss)}원
                                                </td>
                                                <td className={`py-2.5 px-3 text-right font-mono font-bold ${isItemProfit ? "text-rose-400" : "text-blue-400"}`}>
                                                    {isItemProfit ? "+" : ""}{item.returnRate.toFixed(2)}%
                                                </td>
                                                <td className="py-2.5 px-3 text-right font-mono text-indigo-300">{item.pct.toFixed(1)}%</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
