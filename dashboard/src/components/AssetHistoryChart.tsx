"use client";
import React, { useState, useEffect } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Line, ComposedChart, ReferenceLine } from "recharts";
import { API_BASE } from "@/lib/apiConfig";
import { Loader2, TrendingUp, HelpCircle } from "lucide-react";

interface HistoryItem {
    date: string;
    total_asset: number;
    eval_amount: number;
    cash_balance: number;
    accumulated_profit: number;
    accumulated_return: number;
    period_return?: number; // 기간 시작점 대비 수익률 (프론트 계산)
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

const getAccountDisplayName = (acc: { account_no: string; account_name: string }, idx: number) => {
    const rawName = (acc.account_name || "").trim();
    // 이름에 이미 숫자가 포함되어 있는지 검사 (예: "연동계좌 1" 등)
    const hasNumber = /\d+/.test(rawName);
    const baseName = hasNumber ? rawName : `${rawName || "연동계좌"} ${idx + 1}`;
    return `${baseName} (${acc.account_no})`;
};

export default function AssetHistoryChart({ accounts }: Props) {
    const [selectedAccount, setSelectedAccount] = useState<string>("ALL");
    const [compareMetric, setCompareMetric] = useState<"asset" | "return">("asset");
    const [useReconstruction, setUseReconstruction] = useState<boolean>(true);
    const [period, setPeriod] = useState<string>("3M"); // 1W, 1M, 3M, 1Y, ALL
    const [historyData, setHistoryData] = useState<HistoryItem[]>([]);
    const [compareData, setCompareData] = useState<Array<{ account_no: string; name: string; history: HistoryItem[] }>>([]);
    const [filteredData, setFilteredData] = useState<HistoryItem[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    const ACCOUNT_COLORS = [
        { stroke: "#818cf8", fill: "#818cf8", bg: "bg-[#818cf8]" }, // 계좌 1: Indigo
        { stroke: "#34d399", fill: "#34d399", bg: "bg-[#34d399]" }, // 계좌 2: Emerald
        { stroke: "#fbbf24", fill: "#fbbf24", bg: "bg-[#fbbf24]" }, // 계좌 3: Amber
        { stroke: "#f43f5e", fill: "#f43f5e", bg: "bg-[#f43f5e]" }, // 계좌 4: Rose
        { stroke: "#38bdf8", fill: "#38bdf8", bg: "bg-[#38bdf8]" }, // 계좌 5: Sky
        { stroke: "#c084fc", fill: "#c084fc", bg: "bg-[#c084fc]" }, // 계좌 6: Purple
    ];

    const fetchHistory = async () => {
        setIsLoading(true);
        setError(null);
        try {
            if (selectedAccount === "COMPARE_ALL") {
                if (!accounts.length) {
                    setCompareData([]);
                    setIsLoading(false);
                    return;
                }
                const promises = accounts.map(async (acc, idx) => {
                    const displayName = getAccountDisplayName(acc, idx);
                    try {
                        const res = await fetch(
                            `${API_BASE}/api/v1/my/asset-history?account_no=${encodeURIComponent(
                                acc.account_no
                            )}&use_reconstruction=${useReconstruction}&days=1825`
                        );
                        if (!res.ok) return { account_no: acc.account_no, name: displayName, history: [] };
                        const data = await res.json();
                        return {
                            account_no: acc.account_no,
                            name: displayName,
                            history: data.status === "success" && data.history ? (data.history as HistoryItem[]) : []
                        };
                    } catch {
                        return { account_no: acc.account_no, name: displayName, history: [] };
                    }
                });
                const results = await Promise.all(promises);
                setCompareData(results);
            } else {
                const res = await fetch(
                    `${API_BASE}/api/v1/my/asset-history?account_no=${encodeURIComponent(
                        selectedAccount
                    )}&use_reconstruction=${useReconstruction}&days=1825`
                );
                if (!res.ok) throw new Error("자산 추이 데이터를 불러오지 못했습니다.");
                const data = await res.json();
                if (data.status === "success" && data.history) {
                    setHistoryData(data.history);
                } else {
                    throw new Error("올바르지 않은 데이터 형식입니다.");
                }
            }
        } catch (err: any) {
            setError(err.message || "오류가 발생했습니다.");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchHistory();
    }, [selectedAccount, useReconstruction, accounts]);

    useEffect(() => {
        if (selectedAccount === "COMPARE_ALL") return;
        if (!historyData.length) return;

        // 단일/통합계좌 필터링 처리
        const now = new Date();
        let limitDate = new Date();

        if (period === "1W") limitDate.setDate(now.getDate() - 7);
        else if (period === "1M") limitDate.setMonth(now.getMonth() - 1);
        else if (period === "3M") limitDate.setMonth(now.getMonth() - 3);
        else if (period === "1Y") limitDate.setFullYear(now.getFullYear() - 1);
        else limitDate = new Date("1970-01-01"); // ALL

        const filtered = historyData.filter((item) => {
            const itemDate = new Date(item.date);
            return itemDate >= limitDate;
        });

        setFilteredData(filtered);
    }, [historyData, period, selectedAccount]);

    const CustomTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload as HistoryItem;
            const pr = data.period_return ?? 0;
            const ar = data.accumulated_return;
            const isPrPos = pr >= 0;
            const isArPos = ar >= 0;
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
                        <span className="text-gray-400">기간 수익률:</span>
                        <span className={`font-black ${isPrPos ? "text-rose-400" : "text-blue-400"}`}>
                            {isPrPos ? "+" : ""}{pr.toFixed(2)}%
                        </span>
                    </div>
                    <div className="flex justify-between gap-6">
                        <span className="text-gray-500 text-[10px]">누적 수익률 (참고):</span>
                        <span className={`text-[10px] font-bold ${isArPos ? "text-rose-300/70" : "text-blue-300/70"}`}>
                            {isArPos ? "+" : ""}{ar.toFixed(2)}% ({isArPos ? "+" : ""}{fmtShort(data.accumulated_profit)}원)
                        </span>
                    </div>
                </div>
            );
        }
        return null;
    };

    const CompareCustomTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            const date = payload[0].payload.date;
            return (
                <div className="bg-[#0f111a]/95 border border-white/10 p-3.5 rounded-2xl shadow-2xl backdrop-blur-xl text-xs space-y-2 min-w-[260px]">
                    <p className="text-gray-400 font-bold border-b border-white/5 pb-1">{date}</p>
                    {compareData.map((acc, idx) => {
                        const color = ACCOUNT_COLORS[idx % ACCOUNT_COLORS.length].stroke;
                        const val = payload[0].payload[compareMetric === "asset" ? `asset_${acc.account_no}` : `return_${acc.account_no}`];
                        if (val === undefined || val === null) return null;
                        return (
                            <div key={acc.account_no} className="flex justify-between items-center gap-4">
                                <div className="flex items-center gap-1.5">
                                    <span className="w-2.5 h-2.5 rounded-full inline-block shrink-0" style={{ backgroundColor: color }} />
                                    <span className="text-gray-300 font-semibold">{acc.name}</span>
                                </div>
                                <span className="font-extrabold whitespace-nowrap" style={{ color }}>
                                    {compareMetric === "asset" ? `${fmtKRW(val)}원` : `${val >= 0 ? "+" : ""}${val.toFixed(2)}%`}
                                </span>
                            </div>
                        );
                    })}
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
                        className="bg-[#0f111a]/80 border border-indigo-500/30 hover:border-indigo-400/50 rounded-xl px-3 py-1.5 text-xs text-indigo-200 font-bold focus:outline-none transition-colors shadow-inner"
                    >
                        <option value="ALL">전체 계좌 통합</option>
                        <option value="COMPARE_ALL">📊 개별 계좌 전체 비교 (모두 보기)</option>
                        {accounts.map((acc, idx) => (
                            <option key={acc.account_no} value={acc.account_no}>
                                {getAccountDisplayName(acc, idx)}
                            </option>
                        ))}
                    </select>

                    {/* 기간 필터 */}
                    <div className="flex bg-white/5 rounded-xl p-0.5 border border-white/5">
                        {["1W", "1M", "3M", "1Y", "ALL"].map((p) => (
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
            ) : selectedAccount === "COMPARE_ALL" ? (() => {
                // ── 개별 계좌 전체 비교 렌더링 ──
                const now = new Date();
                let limitDate = new Date();
                if (period === "1W") limitDate.setDate(now.getDate() - 7);
                else if (period === "1M") limitDate.setMonth(now.getMonth() - 1);
                else if (period === "3M") limitDate.setMonth(now.getMonth() - 3);
                else if (period === "1Y") limitDate.setFullYear(now.getFullYear() - 1);
                else limitDate = new Date("1970-01-01");

                const dateMap: { [date: string]: any } = {};

                compareData.forEach((accData) => {
                    const filteredHistory = accData.history.filter((item) => new Date(item.date) >= limitDate);
                    const firstItem = filteredHistory[0];
                    const baseReturn = firstItem && typeof firstItem.accumulated_return === 'number'
                        ? firstItem.accumulated_return
                        : null;
                    const baseAsset = firstItem?.total_asset ?? 0;

                    filteredHistory.forEach((item) => {
                        if (!dateMap[item.date]) {
                            dateMap[item.date] = { date: item.date };
                        }
                        const pr = (baseReturn !== null && typeof item.accumulated_return === 'number')
                            ? item.accumulated_return - baseReturn
                            : (baseAsset > 0 ? (item.total_asset / baseAsset - 1) * 100 : 0);
                        dateMap[item.date][`asset_${accData.account_no}`] = item.total_asset;
                        dateMap[item.date][`return_${accData.account_no}`] = pr;
                        dateMap[item.date][`info_${accData.account_no}`] = item;
                    });
                });

                const compareChartData = Object.values(dateMap).sort((a, b) => a.date.localeCompare(b.date));

                if (compareChartData.length === 0) {
                    return (
                        <div className="w-full h-[280px] flex items-center justify-center text-xs text-gray-500 text-center">
                            선택한 기간 동안의 계좌 비교 데이터가 없습니다.
                        </div>
                    );
                }

                // Y축 도메인 계산
                let yMin = 0;
                let yMax = 100;
                if (compareMetric === "asset") {
                    const allAssets: number[] = [];
                    compareChartData.forEach((d) => {
                        compareData.forEach((acc) => {
                            const v = d[`asset_${acc.account_no}`];
                            if (typeof v === "number" && !isNaN(v)) allAssets.push(v);
                        });
                    });
                    if (allAssets.length) {
                        const minV = Math.min(...allAssets);
                        const maxV = Math.max(...allAssets);
                        const pad = Math.max((maxV - minV) * 0.1, maxV * 0.03);
                        yMin = Math.max(0, minV - pad);
                        yMax = maxV + pad;
                    }
                } else {
                    const allReturns: number[] = [];
                    compareChartData.forEach((d) => {
                        compareData.forEach((acc) => {
                            const v = d[`return_${acc.account_no}`];
                            if (typeof v === "number" && !isNaN(v)) allReturns.push(v);
                        });
                    });
                    if (allReturns.length) {
                        const minV = Math.min(...allReturns);
                        const maxV = Math.max(...allReturns);
                        yMin = Math.min(minV - 3, -1);
                        yMax = maxV + 3;
                    }
                }

                return (
                    <div className="w-full h-[300px] relative">
                        {/* 비교 범례 및 측정 지표 토글 */}
                        <div className="absolute top-0 left-0 right-0 z-10 flex flex-wrap items-center justify-between gap-2 bg-black/40 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-white/5 text-[10px]">
                            <div className="flex flex-wrap items-center gap-3">
                                {compareData.map((acc, idx) => {
                                    const color = ACCOUNT_COLORS[idx % ACCOUNT_COLORS.length].stroke;
                                    const latestItem = compareChartData[compareChartData.length - 1];
                                    const latestAsset = latestItem ? latestItem[`asset_${acc.account_no}`] : undefined;
                                    const latestReturn = latestItem ? latestItem[`return_${acc.account_no}`] : undefined;

                                    return (
                                        <div key={acc.account_no} className="flex items-center gap-1.5">
                                            <span className="w-2.5 h-2.5 rounded-full inline-block shrink-0" style={{ backgroundColor: color }} />
                                            <span className="text-gray-300 font-bold">{acc.name}</span>
                                            {latestAsset !== undefined && (
                                                <span className="text-gray-400 font-semibold">
                                                    ({compareMetric === "asset" ? fmtShort(latestAsset) : `${latestReturn >= 0 ? "+" : ""}${latestReturn.toFixed(1)}%`})
                                                </span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* 지표 서브 토글 */}
                            <div className="flex items-center gap-1 bg-white/5 p-0.5 rounded-lg border border-white/10">
                                <button
                                    onClick={() => setCompareMetric("asset")}
                                    className={`px-2 py-0.5 rounded-md font-bold transition-all text-[10px] ${
                                        compareMetric === "asset"
                                            ? "bg-indigo-500/30 text-indigo-200 border border-indigo-500/40"
                                            : "text-gray-400 hover:text-gray-200"
                                    }`}
                                >
                                    총 자산액 (원)
                                </button>
                                <button
                                    onClick={() => setCompareMetric("return")}
                                    className={`px-2 py-0.5 rounded-md font-bold transition-all text-[10px] ${
                                        compareMetric === "return"
                                            ? "bg-rose-500/30 text-rose-200 border border-rose-500/40"
                                            : "text-gray-400 hover:text-gray-200"
                                    }`}
                                >
                                    기간 수익률 (%)
                                </button>
                            </div>
                        </div>

                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={compareChartData} margin={{ top: 35, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                                {compareMetric === "return" && (
                                    <ReferenceLine y={0} stroke="rgba(244,63,94,0.35)" strokeWidth={1} strokeDasharray="4 3" />
                                )}
                                <XAxis
                                    dataKey="date"
                                    stroke="rgba(255,255,255,0.2)"
                                    fontSize={10}
                                    tickLine={false}
                                    interval="preserveStartEnd"
                                    minTickGap={45}
                                    tickFormatter={(val) => {
                                        if (!val || val.length < 10) return val;
                                        if (period === "ALL" || period === "1Y") {
                                            return val.substring(2, 7);
                                        }
                                        return val.substring(5);
                                    }}
                                />
                                <YAxis
                                    stroke="rgba(255,255,255,0.2)"
                                    fontSize={10}
                                    tickLine={false}
                                    tickFormatter={(val) => compareMetric === "asset" ? fmtShort(val) : `${val >= 0 ? "+" : ""}${val.toFixed(0)}%`}
                                    domain={[yMin, yMax]}
                                />
                                <Tooltip content={<CompareCustomTooltip />} />
                                {compareData.map((acc, idx) => {
                                    const color = ACCOUNT_COLORS[idx % ACCOUNT_COLORS.length].stroke;
                                    const dataKey = compareMetric === "asset" ? `asset_${acc.account_no}` : `return_${acc.account_no}`;
                                    return (
                                        <Line
                                            key={acc.account_no}
                                            type="monotone"
                                            dataKey={dataKey}
                                            name={acc.name}
                                            stroke={color}
                                            strokeWidth={2.5}
                                            dot={false}
                                            connectNulls={true}
                                        />
                                    );
                                })}
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                );
            })() : filteredData.length === 0 ? (
                <div className="w-full h-[280px] flex items-center justify-center text-xs text-gray-500 text-center">
                    선택한 기간 동안의 자산 데이터가 없습니다.
                </div>
            ) : (() => {
                // ── 단일/통합 계좌 렌더링 ──
                const firstItem = filteredData[0];
                const baseReturn = firstItem && typeof firstItem.accumulated_return === 'number'
                    ? firstItem.accumulated_return
                    : null;
                const baseAsset = firstItem?.total_asset ?? 0;

                const displayData = filteredData.map(d => {
                    const pr = (baseReturn !== null && typeof d.accumulated_return === 'number')
                        ? d.accumulated_return - baseReturn
                        : (baseAsset > 0 ? (d.total_asset / baseAsset - 1) * 100 : 0);
                    return {
                        ...d,
                        period_return: pr
                    };
                });

                const periodReturns = displayData.map(d => d.period_return);
                const minRet = Math.min(...periodReturns);
                const maxRet = Math.max(...periodReturns);

                const adjustedMinRet = Math.min(minRet - 3, -1);
                const adjustedMaxRet = maxRet + 3;

                const assets = filteredData.map(d => d.total_asset);
                const minAsset = Math.min(...assets);
                const maxAsset = Math.max(...assets);
                const assetPad = Math.max((maxAsset - minAsset) * 0.1, maxAsset * 0.02);
                const leftDomain: [number, number] = [
                    Math.max(0, minAsset - assetPad),
                    maxAsset + assetPad
                ];

                const rightDomain: [number, number] = [adjustedMinRet, adjustedMaxRet];

                return (
                    <div className="w-full h-[300px] relative">
                        {/* 커스텀 차트 범례 */}
                        <div className="absolute top-0 left-10 z-10 flex items-center gap-3.5 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/5 text-[10px] font-bold">
                            <div className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-[#818cf8] inline-block" />
                                <span className="text-gray-400">총 자산액</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-[#f43f5e] inline-block" />
                                <span className="text-gray-400">기간 수익률</span>
                            </div>
                        </div>

                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={displayData} margin={{ top: 25, right: 10, left: -20, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorTotalAsset" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%"  stopColor="#818cf8" stopOpacity={0.75} />
                                        <stop offset="95%" stopColor="#818cf8" stopOpacity={0.08} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                                <ReferenceLine
                                    yAxisId="right"
                                    y={0}
                                    stroke="rgba(244,63,94,0.35)"
                                    strokeWidth={1}
                                    strokeDasharray="4 3"
                                />
                                <ReferenceLine
                                    yAxisId="left"
                                    y={baseAsset}
                                    stroke="rgba(129,140,248,0.35)"
                                    strokeWidth={1}
                                    strokeDasharray="4 3"
                                />
                                <XAxis
                                    dataKey="date"
                                    stroke="rgba(255,255,255,0.2)"
                                    fontSize={10}
                                    tickLine={false}
                                    interval="preserveStartEnd"
                                    minTickGap={45}
                                    tickFormatter={(val) => {
                                        if (!val || val.length < 10) return val;
                                        if (period === "ALL" || period === "1Y") {
                                            return val.substring(2, 7);
                                        }
                                        return val.substring(5);
                                    }}
                                />
                                <YAxis
                                    yAxisId="left"
                                    stroke="rgba(255,255,255,0.2)"
                                    fontSize={10}
                                    tickLine={false}
                                    tickFormatter={(val) => fmtShort(val)}
                                    domain={leftDomain}
                                />
                                <YAxis
                                    yAxisId="right"
                                    orientation="right"
                                    stroke="rgba(255,255,255,0.2)"
                                    fontSize={10}
                                    tickLine={false}
                                    tickFormatter={(val) => `${val >= 0 ? "+" : ""}${val.toFixed(0)}%`}
                                    domain={rightDomain}
                                />
                                <Tooltip content={<CustomTooltip />} />
                                <Area
                                    yAxisId="left"
                                    type="monotone"
                                    dataKey="total_asset"
                                    stroke="#818cf8"
                                    strokeWidth={2.5}
                                    fillOpacity={1}
                                    fill="url(#colorTotalAsset)"
                                />
                                <Line
                                    yAxisId="right"
                                    type="monotone"
                                    dataKey="period_return"
                                    stroke="#f43f5e"
                                    strokeWidth={2.5}
                                    dot={false}
                                />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                );
            })()}
        </div>
    );
}
