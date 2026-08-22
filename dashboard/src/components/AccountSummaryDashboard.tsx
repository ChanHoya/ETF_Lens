"use client";
// 계좌 분류별 자산 비중/매수-평가 비교/수익률을 차트로 보여주는 대시보드 모달
import React, { useMemo } from "react";
import { X, TrendingUp, TrendingDown, Wallet, DollarSign, PieChart as PieIcon, BarChart3 } from "lucide-react";
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

interface AccountSummaryDashboardProps {
    isOpen: boolean;
    onClose: () => void;
    accountBoards: any[];
    summary: any;
}

const CHART_COLORS = [
    "#6366f1", // indigo
    "#10b981", // emerald
    "#f59e0b", // amber
    "#06b6d4", // cyan
    "#a855f7", // purple
    "#f43f5e", // rose
    "#3b82f6", // blue
    "#84cc16", // lime
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

const CustomTooltip = ({ active, payload }: any) => {
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
            {d.return_rate !== undefined && (
                <p className={`mt-1 font-bold ${d.return_rate >= 0 ? "text-rose-400" : "text-blue-400"}`}>
                    수익률: {d.return_rate >= 0 ? "+" : ""}{d.return_rate.toFixed(2)}%
                </p>
            )}
        </div>
    );
};

const PieTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
        <div className="bg-[#1e2030] border border-white/10 rounded-xl px-4 py-3 shadow-2xl text-xs">
            <p className="font-bold text-white mb-1">{d.name}</p>
            <p className="text-gray-300">
                평가금액: <span className="font-mono font-semibold text-white">{fmtKRW(d.value)}원</span>
            </p>
            <p className="text-gray-300">
                비중: <span className="font-mono font-semibold text-indigo-300">{d.weight?.toFixed(1)}%</span>
            </p>
        </div>
    );
};

export default function AccountSummaryDashboard({
    isOpen,
    onClose,
    accountBoards,
    summary,
}: AccountSummaryDashboardProps) {
    const pieData = useMemo(
        () =>
            accountBoards
                .filter((b: any) => b.total_asset > 0)
                .map((b: any) => ({
                    name: b.category_name,
                    value: b.total_asset,
                    weight: b.weight || 0,
                })),
        [accountBoards]
    );

    const barData = useMemo(
        () =>
            accountBoards.map((b: any) => ({
                name: b.category_name,
                매수총액: b.purchase_amount,
                평가총액: b.eval_amount,
                return_rate: b.return_rate,
            })),
        [accountBoards]
    );

    const returnData = useMemo(
        () =>
            accountBoards
                .map((b: any) => ({
                    name: b.category_name,
                    수익률: b.return_rate,
                    평가손익: b.profit_loss,
                }))
                .sort((a: any, b: any) => b.수익률 - a.수익률),
        [accountBoards]
    );

    const maxReturnAbs = useMemo(
        () => Math.max(...returnData.map((d: any) => Math.abs(d.수익률)), 1),
        [returnData]
    );

    // 훅은 모두 호출한 뒤에 닫힘 처리한다.
    // (조기 return 을 훅 위에 두면 isOpen 이 바뀔 때 훅 개수가 달라져 React 가 예외를 던진다)
    if (!isOpen) return null;

    const isProfit = (summary.total_profit_loss ?? 0) >= 0;

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
                        <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30">
                            <PieIcon className="w-5 h-5 text-indigo-300" />
                        </div>
                        <div>
                            <h2 className="text-lg font-black text-white">계좌별 종합 대시보드</h2>
                            <p className="text-[11px] text-gray-400">Account Board Overview — 계좌 분류별 자산 비중, 매수/평가 비교, 수익률 분석</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/10 rounded-xl transition-colors text-gray-400 hover:text-white"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 flex flex-col gap-6">
                    {/* KPI Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10">
                            <div className="flex justify-between items-start">
                                <span className="text-[10px] font-bold text-gray-500 uppercase">순자산 총액</span>
                                <Wallet className="w-4 h-4 text-indigo-400" />
                            </div>
                            <p className="text-xl font-black text-white mt-2 font-mono">{fmtShort(summary.total_net_worth || 0)}</p>
                            <p className="text-[10px] text-gray-500 mt-0.5">{fmtKRW(summary.total_net_worth || 0)}원</p>
                        </div>
                        <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10">
                            <div className="flex justify-between items-start">
                                <span className="text-[10px] font-bold text-gray-500 uppercase">투자 원금</span>
                                <DollarSign className="w-4 h-4 text-gray-400" />
                            </div>
                            <p className="text-xl font-black text-gray-200 mt-2 font-mono">{fmtShort(summary.total_purchase_amount || 0)}</p>
                            <p className="text-[10px] text-gray-500 mt-0.5">{fmtKRW(summary.total_purchase_amount || 0)}원</p>
                        </div>
                        <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10">
                            <div className="flex justify-between items-start">
                                <span className="text-[10px] font-bold text-gray-500 uppercase">평가 손익</span>
                                {isProfit ? <TrendingUp className="w-4 h-4 text-rose-400" /> : <TrendingDown className="w-4 h-4 text-blue-400" />}
                            </div>
                            <p className={`text-xl font-black mt-2 font-mono ${isProfit ? "text-rose-400" : "text-blue-400"}`}>
                                {isProfit ? "+" : ""}{fmtShort(summary.total_profit_loss || 0)}
                            </p>
                            <p className={`text-[10px] mt-0.5 font-semibold ${isProfit ? "text-rose-400/70" : "text-blue-400/70"}`}>
                                {isProfit ? "+" : ""}{(summary.total_return_rate || 0).toFixed(2)}%
                            </p>
                        </div>
                        <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10">
                            <div className="flex justify-between items-start">
                                <span className="text-[10px] font-bold text-gray-500 uppercase">총 예수금</span>
                                <DollarSign className="w-4 h-4 text-emerald-400" />
                            </div>
                            <p className="text-xl font-black text-emerald-400 mt-2 font-mono">{fmtShort(summary.total_cash_converted || 0)}</p>
                            <p className="text-[10px] text-gray-500 mt-0.5">현금비중 {summary.total_net_worth > 0 ? ((summary.total_cash_converted / summary.total_net_worth) * 100).toFixed(1) : "0"}%</p>
                        </div>
                    </div>

                    {/* Charts Row */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {/* Pie Chart — 계좌별 자산 비중 */}
                        <div className="p-5 rounded-2xl bg-[#161922] border border-white/10">
                            <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-4">
                                <PieIcon className="w-4 h-4 text-indigo-400" />
                                계좌별 자산 비중
                            </h3>
                            <ResponsiveContainer width="100%" height={280}>
                                <PieChart>
                                    <Pie
                                        data={pieData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={100}
                                        paddingAngle={3}
                                        dataKey="value"
                                        stroke="none"
                                    >
                                        {pieData.map((_: any, i: number) => (
                                            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip content={<PieTooltip />} />
                                    <Legend
                                        verticalAlign="bottom"
                                        iconType="circle"
                                        iconSize={8}
                                        formatter={(value: string) => (
                                            <span className="text-[11px] text-gray-300">{value}</span>
                                        )}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Bar Chart — 매수총액 vs 평가총액 */}
                        <div className="p-5 rounded-2xl bg-[#161922] border border-white/10">
                            <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-4">
                                <BarChart3 className="w-4 h-4 text-purple-400" />
                                계좌별 매수 vs 평가
                            </h3>
                            <ResponsiveContainer width="100%" height={280}>
                                <BarChart data={barData} barCategoryGap="25%">
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                    <XAxis
                                        dataKey="name"
                                        tick={{ fill: "#9ca3af", fontSize: 10 }}
                                        axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                                        tickLine={false}
                                    />
                                    <YAxis
                                        tick={{ fill: "#9ca3af", fontSize: 10 }}
                                        axisLine={false}
                                        tickLine={false}
                                        tickFormatter={(v: number) => fmtShort(v)}
                                    />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Legend
                                        iconType="circle"
                                        iconSize={8}
                                        formatter={(value: string) => (
                                            <span className="text-[11px] text-gray-300">{value}</span>
                                        )}
                                    />
                                    <Bar dataKey="매수총액" fill="#64748b" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="평가총액" fill="#6366f1" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Return Rate Horizontal Bars */}
                    <div className="p-5 rounded-2xl bg-[#161922] border border-white/10">
                        <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-4">
                            <TrendingUp className="w-4 h-4 text-rose-400" />
                            계좌별 수익률 비교
                        </h3>
                        <div className="flex flex-col gap-3">
                            {returnData.map((item: any, idx: number) => {
                                const isPositive = item.수익률 >= 0;
                                const barWidth = Math.min(100, (Math.abs(item.수익률) / maxReturnAbs) * 100);

                                return (
                                    <div key={idx} className="flex items-center gap-3">
                                        <span className="text-xs text-gray-300 font-semibold w-28 shrink-0 text-right">
                                            {item.name}
                                        </span>
                                        <div className="flex-1 flex items-center gap-2">
                                            <div className="flex-1 h-6 bg-white/5 rounded-lg overflow-hidden relative">
                                                <div
                                                    className={`h-full rounded-lg transition-all duration-500 ${
                                                        isPositive
                                                            ? "bg-gradient-to-r from-rose-500/40 to-rose-500"
                                                            : "bg-gradient-to-r from-blue-500/40 to-blue-500"
                                                    }`}
                                                    style={{ width: `${barWidth}%` }}
                                                />
                                                <span className={`absolute inset-y-0 right-2 flex items-center text-[11px] font-mono font-bold ${
                                                    isPositive ? "text-rose-300" : "text-blue-300"
                                                }`}>
                                                    {isPositive ? "+" : ""}{item.수익률.toFixed(2)}%
                                                </span>
                                            </div>
                                            <span className={`text-[10px] font-mono w-20 text-right shrink-0 ${
                                                isPositive ? "text-rose-400" : "text-blue-400"
                                            }`}>
                                                {isPositive ? "+" : ""}{fmtShort(item.평가손익)}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Account Detail Table */}
                    <div className="p-5 rounded-2xl bg-[#161922] border border-white/10">
                        <h3 className="text-sm font-bold text-white mb-3">📋 계좌별 상세 수치</h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs border-collapse">
                                <thead>
                                    <tr className="border-b border-white/10 text-gray-400 font-semibold">
                                        <th className="py-2.5 px-3 text-left">계좌</th>
                                        <th className="py-2.5 px-3 text-right">매수총액</th>
                                        <th className="py-2.5 px-3 text-right">평가총액</th>
                                        <th className="py-2.5 px-3 text-right">손익</th>
                                        <th className="py-2.5 px-3 text-right">수익률</th>
                                        <th className="py-2.5 px-3 text-right">예수금</th>
                                        <th className="py-2.5 px-3 text-right">총 자산</th>
                                        <th className="py-2.5 px-3 text-right">비중</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {accountBoards.map((b: any, i: number) => {
                                        const isBoardProfit = b.profit_loss >= 0;
                                        return (
                                            <tr key={i} className="hover:bg-white/[0.03]">
                                                <td className="py-2.5 px-3 font-bold text-white">{b.category_name}</td>
                                                <td className="py-2.5 px-3 text-right font-mono text-gray-300">{fmtKRW(b.purchase_amount)}원</td>
                                                <td className="py-2.5 px-3 text-right font-mono text-white font-semibold">{fmtKRW(b.eval_amount)}원</td>
                                                <td className={`py-2.5 px-3 text-right font-mono font-bold ${isBoardProfit ? "text-rose-400" : "text-blue-400"}`}>
                                                    {isBoardProfit ? "+" : ""}{fmtKRW(b.profit_loss)}원
                                                </td>
                                                <td className={`py-2.5 px-3 text-right font-mono font-bold ${isBoardProfit ? "text-rose-400" : "text-blue-400"}`}>
                                                    {isBoardProfit ? "+" : ""}{b.return_rate.toFixed(2)}%
                                                </td>
                                                <td className="py-2.5 px-3 text-right font-mono text-emerald-400">{fmtKRW(b.total_cash_converted)}원</td>
                                                <td className="py-2.5 px-3 text-right font-mono font-bold text-indigo-300">{fmtKRW(b.total_asset)}원</td>
                                                <td className="py-2.5 px-3 text-right font-mono text-gray-300">{(b.weight || 0).toFixed(1)}%</td>
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
