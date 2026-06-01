"use client";
import React, { useState, useEffect } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Line, ComposedChart } from "recharts";
import { API_BASE } from "@/lib/apiConfig";
import { Loader2, TrendingUp, HelpCircle } from "lucide-react";

interface HistoryItem {
    date: string;
    total_asset: number;
    eval_amount: number;
    cash_balance: number;
    accumulated_profit: number;
    accumulated_return: number;
}

interface Props {
    accounts: Array<{ account_no: string; account_name: string }>;
}

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

export default function AssetHistoryChart({ accounts }: Props) {
    const [selectedAccount, setSelectedAccount] = useState<string>("ALL");
    const [useReconstruction, setUseReconstruction] = useState<boolean>(true);
    const [period, setPeriod] = useState<string>("3M"); // 1W, 1M, 3M, ALL
    const [historyData, setHistoryData] = useState<HistoryItem[]>([]);
    const [filteredData, setFilteredData] = useState<HistoryItem[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    const fetchHistory = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const res = await fetch(
                `${API_BASE}/api/v1/my/asset-history?account_no=${encodeURIComponent(
                    selectedAccount
                )}&use_reconstruction=${useReconstruction}`
            );
            if (!res.ok) throw new Error("자산 추이 데이터를 불러오지 못했습니다.");
            const data = await res.json();
            if (data.status === "success" && data.history) {
                setHistoryData(data.history);
            } else {
                throw new Error("올바르지 않은 데이터 형식입니다.");
            }
        } catch (err: any) {
            setError(err.message || "오류가 발생했습니다.");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchHistory();
    }, [selectedAccount, useReconstruction]);

    useEffect(() => {
        if (!historyData.length) return;

        // 필터링 처리
        const now = new Date();
        let limitDate = new Date();

        if (period === "1W") limitDate.setDate(now.getDate() - 7);
        else if (period === "1M") limitDate.setMonth(now.getMonth() - 1);
        else if (period === "3M") limitDate.setMonth(now.getMonth() - 3);
        else limitDate = new Date("1970-01-01"); // ALL

        const filtered = historyData.filter((item) => {
            const itemDate = new Date(item.date);
            return itemDate >= limitDate;
        });

        setFilteredData(filtered);
    }, [historyData, period]);

    const CustomTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload as HistoryItem;
            const isPos = data.accumulated_return >= 0;
            return (
                <div className="bg-[#0f111a]/95 border border-white/10 p-4 rounded-2xl shadow-2xl backdrop-blur-xl text-xs space-y-2">
                    <p className="text-gray-400 font-bold border-b border-white/5 pb-1">{data.date}</p>
                    <div className="flex justify-between gap-6">
                        <span className="text-gray-400">총 자산액:</span>
                        <span className="text-white font-extrabold">{fmtKRW(data.total_asset)}원</span>
                    </div>
                    <div className="flex justify-between gap-6">
                        <span className="text-gray-400">주식 평가금:</span>
                        <span className="text-indigo-200 font-bold">{fmtKRW(data.eval_amount)}원</span>
                    </div>
                    <div className="flex justify-between gap-6">
                        <span className="text-gray-400">현금 잔고:</span>
                        <span className="text-emerald-300 font-bold">{fmtKRW(data.cash_balance)}원</span>
                    </div>
                    <div className="flex justify-between gap-6 border-t border-white/5 pt-1.5">
                        <span className="text-gray-400">누적 수익:</span>
                        <span className={`font-black ${isPos ? "text-rose-400" : "text-blue-400"}`}>
                            {isPos ? "+" : ""}{fmtShort(data.accumulated_profit)}원 ({isPos ? "+" : ""}{data.accumulated_return.toFixed(2)}%)
                        </span>
                    </div>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="w-full bg-white/[0.02] border border-white/5 backdrop-blur-xl rounded-[32px] p-6 shadow-xl relative overflow-hidden">
            {/* 배경 블러 그라데이션 데코레이션 */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl -z-10 pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/5 rounded-full blur-3xl -z-10 pointer-events-none" />

            {/* 헤더 컨트롤 영역 */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 border-b border-white/5 pb-4">
                <div className="flex items-center gap-3">
                    <TrendingUp className="w-5 h-5 text-indigo-400" />
                    <div>
                        <h3 className="text-base sm:text-lg font-extrabold text-white tracking-tight">자산 성장 추이</h3>
                        <p className="text-[10px] sm:text-xs text-gray-500">시간 경과 및 매매 흐름에 따른 자산 변동 그래프</p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    {/* 계좌 필터 */}
                    <select
                        value={selectedAccount}
                        onChange={(e) => setSelectedAccount(e.target.value)}
                        className="bg-[#0f111a]/60 border border-white/10 hover:border-white/20 rounded-xl px-3 py-1.5 text-xs text-gray-300 focus:outline-none transition-colors"
                    >
                        <option value="ALL">전체 계좌 통합</option>
                        {accounts.map((acc) => (
                            <option key={acc.account_no} value={acc.account_no}>
                                {acc.account_name} ({acc.account_no})
                            </option>
                        ))}
                    </select>

                    {/* 기간 필터 */}
                    <div className="flex bg-white/5 rounded-xl p-0.5 border border-white/5">
                        {["1W", "1M", "3M", "ALL"].map((p) => (
                            <button
                                key={p}
                                onClick={() => setPeriod(p)}
                                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                                    period === p
                                        ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                                        : "text-gray-500 hover:text-gray-300"
                                }`}
                            >
                                {p}
                            </button>
                        ))}
                    </div>

                    {/* 복원 토글 */}
                    <label className="flex items-center gap-1.5 cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={useReconstruction}
                            onChange={(e) => setUseReconstruction(e.target.checked)}
                            className="sr-only peer"
                        />
                        <div className="relative w-8 h-4.5 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-gray-300 after:border-gray-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-indigo-500/50" />
                        <span className="text-[10px] sm:text-xs font-semibold text-gray-400 flex items-center gap-0.5">
                            과거 복원 뷰
                            <div className="group relative">
                                <HelpCircle className="w-3 h-3 text-gray-500 hover:text-gray-400" />
                                <span className="absolute bottom-full right-0 mb-1 hidden group-hover:block w-48 p-2 bg-[#0f111a] border border-white/10 text-[9px] text-gray-400 rounded-lg shadow-xl z-50">
                                    DB 데이터 적재가 부족할 때, 최근 90일 입출금 정보와 KOSPI 지수 등락을 조합해 과거 자산 흐름을 시뮬레이션 복원합니다.
                                </span>
                            </div>
                        </span>
                    </label>
                </div>
            </div>

            {/* 차트 렌더링 영역 */}
            {isLoading ? (
                <div className="w-full h-[280px] flex flex-col items-center justify-center">
                    <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mb-2" />
                    <p className="text-xs text-gray-500">자산 이력을 수집하여 그래프를 그리는 중입니다...</p>
                </div>
            ) : error ? (
                <div className="w-full h-[280px] flex items-center justify-center text-xs text-red-400/90 text-center">
                    {error}
                </div>
            ) : filteredData.length === 0 ? (
                <div className="w-full h-[280px] flex items-center justify-center text-xs text-gray-500 text-center">
                    선택한 기간 동안의 자산 데이터가 없습니다.
                </div>
            ) : (
                <div className="w-full h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={filteredData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorTotalAsset" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                            <XAxis
                                dataKey="date"
                                stroke="rgba(255,255,255,0.2)"
                                fontSize={10}
                                tickLine={false}
                                tickFormatter={(val) => val.substring(5)}
                            />
                            <YAxis
                                yAxisId="left"
                                stroke="rgba(255,255,255,0.2)"
                                fontSize={10}
                                tickLine={false}
                                tickFormatter={(val) => fmtShort(val)}
                            />
                            <YAxis
                                yAxisId="right"
                                orientation="right"
                                stroke="rgba(255,255,255,0.2)"
                                fontSize={10}
                                tickLine={false}
                                tickFormatter={(val) => `${val >= 0 ? "+" : ""}${val.toFixed(0)}%`}
                            />
                            <Tooltip content={<CustomTooltip />} />
                            <Area
                                yAxisId="left"
                                type="monotone"
                                dataKey="total_asset"
                                stroke="#6366f1"
                                strokeWidth={2}
                                fillOpacity={1}
                                fill="url(#colorTotalAsset)"
                            />
                            <Line
                                yAxisId="right"
                                type="monotone"
                                dataKey="accumulated_return"
                                stroke="#f43f5e"
                                strokeWidth={2.5}
                                dot={false}
                            />
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
            )}
        </div>
    );
}
