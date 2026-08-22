"use client";
import React, { useState, useEffect, useCallback } from "react";
import {
    Wallet,
    TrendingUp,
    TrendingDown,
    Plus,
    RefreshCw,
    Settings2,
    Edit3,
    Trash2,
    DollarSign,
    Layers,
    PieChart,
    ExternalLink,
    ChevronDown,
    ChevronUp,
    Sparkles,
    CheckCircle2,
    HelpCircle,
    Building2,
    Loader2,
    AlertTriangle,
} from "lucide-react";
import { API_BASE } from "@/lib/apiConfig";
import ManualAssetModal from "./ManualAssetModal";
import ManualCashModal from "./ManualCashModal";
import KisAccountMappingModal from "./KisAccountMappingModal";
import AccountSummaryDashboard from "./AccountSummaryDashboard";
import HoldingsDetailDashboard from "./HoldingsDetailDashboard";
import { SECTOR_OPTIONS } from "@/lib/sectorOptions";

interface TotalAssetBoardProps {
    onOpenDetail?: (code: string) => void;
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

const CATEGORY_ICONS: Record<string, string> = {
    "ISA": "🛡️",
    "연금저축펀드": "🌱",
    "퇴직연금IRP": "🏦",
    "기타투자계좌": "💰",
    "기타저축계좌": "💰",
    "일반주식계좌": "📈",
};

const CATEGORY_COLORS: Record<string, { badge: string; border: string; bar: string }> = {
    "ISA": {
        badge: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
        border: "border-indigo-500/20",
        bar: "bg-indigo-500",
    },
    "연금저축펀드": {
        badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
        border: "border-emerald-500/20",
        bar: "bg-emerald-500",
    },
    "퇴직연금IRP": {
        badge: "bg-amber-500/10 text-amber-400 border-amber-500/20",
        border: "border-amber-500/20",
        bar: "bg-amber-500",
    },
    "기타투자계좌": {
        badge: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
        border: "border-cyan-500/20",
        bar: "bg-cyan-500",
    },
    "기타저축계좌": {
        badge: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
        border: "border-cyan-500/20",
        bar: "bg-cyan-500",
    },
    "일반주식계좌": {
        badge: "bg-purple-500/10 text-purple-400 border-purple-500/20",
        border: "border-purple-500/20",
        bar: "bg-purple-500",
    },
};

async function fetchWithWake(
    url: string,
    opts: RequestInit | undefined,
    onWaking: () => void,
    retries = 6,
): Promise<Response> {
    for (let attempt = 0; ; attempt++) {
        try {
            const res = await fetch(url, opts);
            if ((res.status === 502 || res.status === 503 || res.status === 404) && attempt < retries) {
                onWaking();
                await new Promise((r) => setTimeout(r, Math.min(3000 * (attempt + 1), 8000)));
                continue;
            }
            return res;
        } catch (e) {
            if (attempt < retries) {
                onWaking();
                await new Promise((r) => setTimeout(r, Math.min(3000 * (attempt + 1), 8000)));
                continue;
            }
            throw e;
        }
    }
}

export default function TotalAssetBoard({ onOpenDetail }: TotalAssetBoardProps) {
    const [data, setData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [wakingUp, setWakingUp] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Selected tab for holdings table
    const [activeTab, setActiveTab] = useState<string>("ALL");

    // Modals
    const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);
    const [selectedManualAsset, setSelectedManualAsset] = useState<any>(null);
    const [isCashModalOpen, setIsCashModalOpen] = useState(false);
    const [isMappingModalOpen, setIsMappingModalOpen] = useState(false);

    // Delete confirmation state
    const [assetToDelete, setAssetToDelete] = useState<{ id: number | string; name: string; category?: string } | null>(null);
    const [isDeletingAsset, setIsDeletingAsset] = useState(false);

    const [searchQuery, setSearchQuery] = useState("");

    // Dashboard modals
    const [isAccountDashboardOpen, setIsAccountDashboardOpen] = useState(false);
    const [isHoldingsDashboardOpen, setIsHoldingsDashboardOpen] = useState(false);

    // Sector editing
    const [editingSectorId, setEditingSectorId] = useState<string | null>(null);

    const handleSectorChange = async (holdingId: string, newSector: string) => {
        try {
            const res = await fetch(`${API_BASE}/api/v1/my/holdings/${holdingId}/sector`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sector: newSector }),
            });
            if (!res.ok) throw new Error("섹터 변경에 실패했습니다.");
            // Update local data optimistically
            if (data) {
                const updated = JSON.parse(JSON.stringify(data));
                const gh = updated.grouped_holdings || {};
                for (const cat of Object.keys(gh)) {
                    for (const h of gh[cat]) {
                        if (h.id === holdingId) {
                            h.sector = newSector;
                        }
                    }
                }
                setData(updated);
                sessionStorage.setItem("integrated_assets_data", JSON.stringify(updated));
            }
        } catch (e: any) {
            console.error(e);
            alert(e.message || "섹터 변경 오류");
        } finally {
            setEditingSectorId(null);
        }
    };

    const handleConfirmDelete = async () => {
        if (!assetToDelete) return;
        setIsDeletingAsset(true);
        try {
            const res = await fetch(`${API_BASE}/api/v1/my/manual-assets/${assetToDelete.id}`, {
                method: "DELETE",
            });
            if (!res.ok) throw new Error("삭제에 실패했습니다.");
            setAssetToDelete(null);
            fetchIntegratedData(false);
        } catch (e: any) {
            alert(e.message || "삭제 중 오류가 발생했습니다.");
        } finally {
            setIsDeletingAsset(false);
        }
    };

    const fetchIntegratedData = useCallback(async (refreshPrices = false) => {
        if (refreshPrices) setIsRefreshing(true);
        else setIsLoading(true);
        setError(null);
        setWakingUp(false);

        try {
            if (refreshPrices) {
                // 수동 자산 시세도 함께 갱신 요청
                try {
                    await fetch(`${API_BASE}/api/v1/my/manual-assets/refresh-prices`, {
                        method: "POST",
                    });
                } catch (e) {
                    console.warn("Manual price refresh failed:", e);
                }
            }

            const res = await fetchWithWake(
                `${API_BASE}/api/v1/my/integrated-assets`,
                undefined,
                () => setWakingUp(true)
            );
            if (!res.ok) {
                let errMsg = "종합 자산 데이터를 불러오지 못했습니다.";
                try {
                    const errJson = await res.json();
                    errMsg = Array.isArray(errJson.detail)
                        ? errJson.detail.map((e: any) => e.msg).join(", ")
                        : (errJson.detail || errMsg);
                } catch (_) {}
                throw new Error(errMsg);
            }
            const json = await res.json();
            setData(json);
            if (typeof window !== "undefined") {
                sessionStorage.setItem("integrated_assets_data", JSON.stringify(json));
            }
        } catch (err: any) {
            setError(err.message || "데이터 로딩 오류");
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
            setWakingUp(false);
        }
    }, []);

    useEffect(() => {
        if (typeof window !== "undefined") {
            const cached = sessionStorage.getItem("integrated_assets_data");
            if (cached) {
                try {
                    setData(JSON.parse(cached));
                    setIsLoading(false);
                } catch (e) {
                    console.warn("Cache parse error", e);
                }
            }
        }
        fetchIntegratedData(false);
    }, [fetchIntegratedData]);

    if (isLoading && !data) {
        return (
            <div className="w-full flex flex-col items-center justify-center p-16 bg-white/[0.02] border border-white/5 rounded-3xl backdrop-blur-xl">
                <RefreshCw className="w-10 h-10 text-indigo-500 animate-spin mb-4" />
                <h3 className="text-lg font-bold text-white mb-1">
                    {wakingUp ? "백엔드 서버 연결 중..." : "종합 자산 관리 보드 분석 중"}
                </h3>
                <p className="text-xs text-gray-400 text-center max-w-sm">
                    {wakingUp
                        ? "휴면 상태의 백엔드 서버를 깨우고 있습니다 (최대 수십 초 소요될 수 있습니다)."
                        : "한국투자증권(KIS) 연동 데이터와 타 증권사(미래에셋/삼성/저축) 수동 자산을 통합 집계하고 있습니다."}
                </p>
            </div>
        );
    }

    if (error && !data) {
        return (
            <div className="w-full p-8 text-center bg-rose-500/10 border border-rose-500/20 rounded-2xl">
                <p className="text-sm font-bold text-rose-400 mb-2">오류가 발생했습니다.</p>
                <p className="text-xs text-gray-400 mb-4">{error}</p>
                <button
                    onClick={() => fetchIntegratedData(false)}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all hover:scale-105 active:scale-95"
                >
                    다시 시도
                </button>
            </div>
        );
    }

    const summary = data?.summary || {};
    const accountBoards = data?.account_boards || [];
    const groupedHoldings = data?.grouped_holdings || {};
    const kisAccounts = data?.kis_accounts || [];

    // Collect all holdings or filter by tab
    let allHoldingsList: any[] = [];
    if (activeTab === "ALL") {
        Object.keys(groupedHoldings).forEach((cat) => {
            allHoldingsList = allHoldingsList.concat(groupedHoldings[cat] || []);
        });
    } else {
        allHoldingsList = groupedHoldings[activeTab] || [];
    }

    // Filter by search query
    if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        allHoldingsList = allHoldingsList.filter(
            (h) =>
                (h.name && h.name.toLowerCase().includes(q)) ||
                (h.ticker && h.ticker.toLowerCase().includes(q)) ||
                (h.broker && h.broker.toLowerCase().includes(q)) ||
                (h.sector && h.sector.toLowerCase().includes(q)) ||
                (h.account_name && h.account_name.toLowerCase().includes(q))
        );
    }

    const totalHoldingsCount = Object.values(groupedHoldings).reduce(
        (acc: number, list: any) => acc + (list?.length || 0),
        0
    );

    const isProfit = (summary.total_profit_loss ?? 0) >= 0;

    return (
        <div className="w-full flex flex-col gap-6 animate-in fade-in duration-300">
            {/* 1. Header & Action Buttons */}
            <div className="w-full flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 text-indigo-300">
                        <Wallet className="w-5 h-5" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-lg md:text-xl font-black tracking-tight text-white flex items-center gap-1.5">
                                Hoya 종합 자산 현황
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-semibold">
                                    3. 포트폴리오 연동
                                </span>
                            </h2>
                        </div>
                        <p className="text-[11px] text-gray-400 mt-0.5">
                            한국투자증권(KIS) API 자동 연동 + 타 증권사(미래에셋/삼성/저축) 통합 자산 보드
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    <button
                        onClick={() => {
                            setSelectedManualAsset(null);
                            setIsAssetModalOpen(true);
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-indigo-600/20 hover:scale-105 active:scale-95"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        <span>+ 타 증권사 다중 자산 추가</span>
                    </button>

                    <button
                        onClick={() => setIsCashModalOpen(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-emerald-400 rounded-xl text-xs font-medium transition-all hover:border-emerald-500/30"
                    >
                        <DollarSign className="w-3.5 h-3.5" />
                        <span>예수금 관리</span>
                    </button>

                    <button
                        onClick={() => setIsMappingModalOpen(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 rounded-xl text-xs font-medium transition-all"
                        title="KIS 연동 계좌 카테고리 매핑"
                    >
                        <Settings2 className="w-3.5 h-3.5" />
                        <span className="hidden md:inline">KIS 매핑</span>
                    </button>

                    <button
                        onClick={() => fetchIntegratedData(true)}
                        disabled={isRefreshing}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 rounded-xl text-xs font-medium text-indigo-300 transition-all disabled:opacity-50"
                        title="실시간 시세 새로고침"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
                        <span className="hidden sm:inline">{isRefreshing ? "갱신중..." : "시세 갱신"}</span>
                    </button>
                </div>
            </div>

            {/* 2. Bento Hero Grand Total Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                {/* 총 순자산 (Total Net Worth) */}
                <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-900/30 via-[#161922] to-[#12141a] border border-indigo-500/30 shadow-[0_0_20px_rgba(99,102,241,0.15)] flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                        <span className="text-[11px] font-bold text-indigo-300 uppercase tracking-wider">
                            총 순자산 (Total Net Worth)
                        </span>
                        <span className="text-lg">💎</span>
                    </div>
                    <div className="mt-2">
                        <h3 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                            {fmtKRW(summary.total_net_worth || 0)}
                            <span className="text-xs font-normal text-gray-400 ml-1">원</span>
                        </h3>
                        <p className="text-[11px] text-indigo-300/80 font-semibold mt-0.5">
                            약 {fmtShort(summary.total_net_worth || 0)}
                        </p>
                    </div>
                    <div className="mt-3 pt-2.5 border-t border-white/5 flex justify-between text-[11px] text-gray-400">
                        <span>평가금: <b className="text-white font-medium">{fmtShort(summary.total_eval_amount || 0)}</b></span>
                        <span>예수금: <b className="text-emerald-400 font-medium">{fmtShort(summary.total_cash_converted || 0)}</b></span>
                    </div>
                </div>

                {/* 총 평가손익 & 수익률 */}
                <div className="p-4 rounded-2xl bg-[#161922] border border-white/10 flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                            총 평가손익 & 수익률
                        </span>
                        {isProfit ? (
                            <div className="p-1 rounded-lg bg-rose-500/20 text-rose-400">
                                <TrendingUp className="w-4 h-4" />
                            </div>
                        ) : (
                            <div className="p-1 rounded-lg bg-blue-500/20 text-blue-400">
                                <TrendingDown className="w-4 h-4" />
                            </div>
                        )}
                    </div>
                    <div className="mt-2">
                        <div className="flex items-baseline gap-2">
                            <h3 className={`text-xl sm:text-2xl font-black tracking-tight ${isProfit ? "text-rose-400" : "text-blue-400"}`}>
                                {isProfit ? "+" : ""}{fmtKRW(summary.total_profit_loss || 0)}
                                <span className="text-xs font-normal text-gray-400 ml-1">원</span>
                            </h3>
                            <span className={`text-xs sm:text-sm font-bold px-2 py-0.5 rounded-lg ${isProfit ? "bg-rose-500/15 text-rose-400" : "bg-blue-500/15 text-blue-400"}`}>
                                {isProfit ? "+" : ""}{(summary.total_return_rate || 0).toFixed(2)}%
                            </span>
                        </div>
                        <p className="text-[11px] text-gray-400 mt-0.5">
                            총 매수원금: {fmtKRW(summary.total_purchase_amount || 0)}원
                        </p>
                    </div>
                    <div className="mt-3 pt-2.5 border-t border-white/5 text-[11px] text-gray-400 flex justify-between">
                        <span>투자 손익비:</span>
                        <span className="font-semibold text-white">
                            {summary.total_purchase_amount > 0
                                ? ((summary.total_eval_amount / summary.total_purchase_amount) * 100).toFixed(1) + "%"
                                : "100%"}
                        </span>
                    </div>
                </div>

                {/* 보유 예수금 (Cash Reserves) */}
                <div className="p-4 rounded-2xl bg-[#161922] border border-white/10 flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                            총 예수금 잔고 (Cash)
                        </span>
                        <span className="text-lg">💵</span>
                    </div>
                    <div className="mt-2">
                        <h3 className="text-xl sm:text-2xl font-black tracking-tight text-emerald-400">
                            {fmtKRW(summary.total_cash_converted || 0)}
                            <span className="text-xs font-normal text-gray-400 ml-1">원</span>
                        </h3>
                        <div className="text-[11px] text-gray-400 mt-0.5 flex gap-2">
                            <span>원화: {fmtShort(summary.total_cash_krw || 0)}</span>
                            {summary.total_cash_usd > 0 && (
                                <span className="text-sky-400">· 외화: ${summary.total_cash_usd.toLocaleString()}</span>
                            )}
                        </div>
                    </div>
                    <div className="mt-3 pt-2.5 border-t border-white/5 text-[11px] text-gray-400 flex justify-between">
                        <span>전체 자산 대비 현금 비중:</span>
                        <span className="font-bold text-emerald-400">
                            {summary.total_net_worth > 0
                                ? ((summary.total_cash_converted / summary.total_net_worth) * 100).toFixed(1) + "%"
                                : "0%"}
                        </span>
                    </div>
                </div>

                {/* 환율 및 포트폴리오 스탯 */}
                <div className="p-4 rounded-2xl bg-[#161922] border border-white/10 flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                            실시간 환율 & 포트폴리오
                        </span>
                        <span className="text-lg">🌐</span>
                    </div>
                    <div className="mt-2">
                        <div className="flex items-baseline gap-1.5">
                            <span className="text-xs text-gray-400 font-semibold">USD/KRW</span>
                            <h3 className="text-xl sm:text-2xl font-black tracking-tight text-sky-400">
                                {summary.usd_krw_rate ? fmtKRW(summary.usd_krw_rate) : "1,385"}
                                <span className="text-xs font-normal text-gray-400 ml-1">원</span>
                            </h3>
                        </div>
                        <p className="text-[11px] text-gray-400 mt-0.5">
                            하나은행/야후 실시간 고시환율 적용
                        </p>
                    </div>
                    <div className="mt-3 pt-2.5 border-t border-white/5 text-[11px] text-gray-400 flex justify-between">
                        <span>관리 자산: <b className="text-white">{totalHoldingsCount}개 종목</b></span>
                        <span>계좌군: <b className="text-white">{accountBoards.length}개 그룹</b></span>
                    </div>
                </div>
            </div>

            {/* 3. Account Board (계좌별 요약판 - 구글 시트 상단 테이블 구조) */}
            <div className="w-full rounded-2xl bg-[#161922] border border-white/10 overflow-hidden shadow-xl">
                <div className="px-5 py-4 border-b border-white/10 flex justify-between items-center bg-white/[0.02]">
                    <div className="flex items-center gap-2">
                        <span className="text-lg">📊</span>
                        <div>
                            <h3 className="text-sm md:text-base font-bold text-white">
                                Account Board (계좌별 요약판)
                            </h3>
                            <p className="text-[11px] text-gray-400">
                                시트 상단과 동일한 5대 핵심 계좌별 매수가, 현재가, 손익, 비중, 예수금 요약
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setIsAccountDashboardOpen(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 rounded-xl text-xs font-semibold transition-all hover:scale-105 active:scale-95"
                        >
                            <PieChart className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">대시보드 보기</span>
                        </button>
                        <span className="text-[11px] text-gray-400 hidden sm:inline">
                            총 {accountBoards.length}개 계좌 분류
                        </span>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                        <thead>
                            <tr className="border-b border-white/10 bg-white/[0.03] text-gray-400 font-semibold whitespace-nowrap">
                                <th className="py-3 px-4">계좌 구분</th>
                                <th className="py-3 px-2 text-center">통화</th>
                                <th className="py-3 px-2 text-center">투자국</th>
                                <th className="py-3 px-3 text-right">총 매수가</th>
                                <th className="py-3 px-3 text-right">총 현재가</th>
                                <th className="py-3 px-3 text-right">평가차익</th>
                                <th className="py-3 px-3 text-right">수익률</th>
                                <th className="py-3 px-4 text-center min-w-[120px]">전체 비중</th>
                                <th className="py-3 px-3 text-right">예수금 (KRW/USD)</th>
                                <th className="py-3 px-4 text-right">총 자산</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-gray-200">
                            {accountBoards.map((board: any) => {
                                const isCatProfit = board.profit_loss >= 0;
                                const style = CATEGORY_COLORS[board.category_name] || {
                                    badge: "bg-gray-500/10 text-gray-400 border-gray-500/20",
                                    border: "border-gray-500/20",
                                    bar: "bg-indigo-500",
                                };
                                const icon = CATEGORY_ICONS[board.category_name] || "📁";

                                return (
                                    <tr
                                        key={board.category_key}
                                        onClick={() => setActiveTab(board.category_name)}
                                        className={`hover:bg-white/[0.04] transition-colors cursor-pointer ${
                                            activeTab === board.category_name ? "bg-indigo-500/[0.07]" : ""
                                        }`}
                                    >
                                        {/* 계좌 구분 */}
                                        <td className="py-3.5 px-4">
                                            <div className="flex items-center gap-2">
                                                <span className="text-base">{icon}</span>
                                                <div>
                                                    <span className="font-bold text-white hover:text-indigo-300 transition-colors">
                                                        {board.category_name}
                                                    </span>
                                                    <span className="text-[10px] text-gray-500 ml-1.5">
                                                        ({board.holdings_count}개 종목)
                                                    </span>
                                                </div>
                                            </div>
                                        </td>

                                        {/* 통화 */}
                                        <td className="py-3.5 px-2 text-center text-[11px] text-gray-400">
                                            {board.currency}
                                        </td>

                                        {/* 투자국 */}
                                        <td className="py-3.5 px-2 text-center">
                                            <span className="px-2 py-0.5 rounded text-[10px] bg-white/5 border border-white/10 text-gray-300">
                                                {board.country}
                                            </span>
                                        </td>

                                        {/* 총 매수가 */}
                                        <td className="py-3.5 px-3 text-right font-mono text-gray-300">
                                            {fmtKRW(board.purchase_amount)}원
                                        </td>

                                        {/* 총 현재가 */}
                                        <td className="py-3.5 px-3 text-right font-mono font-semibold text-white">
                                            {fmtKRW(board.eval_amount)}원
                                        </td>

                                        {/* 평가차익 */}
                                        <td className={`py-3.5 px-3 text-right font-mono font-bold ${
                                            isCatProfit ? "text-rose-400" : "text-blue-400"
                                        }`}>
                                            {isCatProfit ? "+" : ""}{fmtKRW(board.profit_loss)}원
                                        </td>

                                        {/* 수익률 */}
                                        <td className={`py-3.5 px-3 text-right font-mono font-bold ${
                                            isCatProfit ? "text-rose-400" : "text-blue-400"
                                        }`}>
                                            {isCatProfit ? "+" : ""}{board.return_rate.toFixed(2)}%
                                        </td>

                                        {/* 전체 비중 */}
                                        <td className="py-3.5 px-4">
                                            <div className="flex items-center gap-2">
                                                <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                                                    <div
                                                        className={`h-full rounded-full ${style.bar}`}
                                                        style={{ width: `${Math.min(100, board.weight || 0)}%` }}
                                                    />
                                                </div>
                                                <span className="font-mono text-xs font-semibold text-gray-300 shrink-0 w-12 text-right">
                                                    {(board.weight || 0).toFixed(1)}%
                                                </span>
                                            </div>
                                        </td>

                                        {/* 예수금 */}
                                        <td className="py-3.5 px-3 text-right font-mono text-emerald-400 text-xs">
                                            {fmtKRW(board.total_cash_converted)}원
                                            {board.cash_usd > 0 && (
                                                <div className="text-[10px] text-sky-400">
                                                    (${board.cash_usd.toLocaleString()})
                                                </div>
                                            )}
                                        </td>

                                        {/* 총 자산 */}
                                        <td className="py-3.5 px-4 text-right font-mono font-bold text-indigo-300 text-sm">
                                            {fmtKRW(board.total_asset)}원
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>

                        {/* Total Footer Row */}
                        <tfoot>
                            <tr className="border-t-2 border-white/20 bg-indigo-500/[0.08] font-bold text-white text-xs">
                                <td className="py-3.5 px-4">
                                    <span className="flex items-center gap-1.5 text-indigo-200">
                                        ✨ 종합 합계
                                    </span>
                                </td>
                                <td className="py-3.5 px-2 text-center text-gray-400">KRW</td>
                                <td className="py-3.5 px-2 text-center text-gray-400">통합</td>
                                <td className="py-3.5 px-3 text-right font-mono text-gray-200">
                                    {fmtKRW(summary.total_purchase_amount || 0)}원
                                </td>
                                <td className="py-3.5 px-3 text-right font-mono text-white">
                                    {fmtKRW(summary.total_eval_amount || 0)}원
                                </td>
                                <td className={`py-3.5 px-3 text-right font-mono ${
                                    isProfit ? "text-rose-400" : "text-blue-400"
                                }`}>
                                    {isProfit ? "+" : ""}{fmtKRW(summary.total_profit_loss || 0)}원
                                </td>
                                <td className={`py-3.5 px-3 text-right font-mono ${
                                    isProfit ? "text-rose-400" : "text-blue-400"
                                }`}>
                                    {isProfit ? "+" : ""}{(summary.total_return_rate || 0).toFixed(2)}%
                                </td>
                                <td className="py-3.5 px-4 text-center font-mono text-indigo-300">
                                    100.0%
                                </td>
                                <td className="py-3.5 px-3 text-right font-mono text-emerald-400">
                                    {fmtKRW(summary.total_cash_converted || 0)}원
                                </td>
                                <td className="py-3.5 px-4 text-right font-mono text-sm text-indigo-200 font-black">
                                    {fmtKRW(summary.total_net_worth || 0)}원
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>

            {/* 4. Detailed Holdings per Account (계좌별 상세 보유 종목) */}
            <div className="w-full rounded-2xl bg-[#161922] border border-white/10 overflow-hidden shadow-xl">
                {/* Header & Tabs */}
                <div className="px-5 py-4 border-b border-white/10 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 bg-white/[0.02]">
                    <div>
                        <h3 className="text-sm md:text-base font-bold text-white flex items-center gap-2">
                            <span>📋</span>
                            <span>계좌별 상세 보유 종목 현황</span>
                            <span className="text-xs font-normal text-gray-400">
                                ({allHoldingsList.length}개 종목 표시)
                            </span>
                        </h3>
                        <p className="text-[11px] text-gray-400 mt-0.5">
                            🟢 KIS 실시간 연동 종목 및 📝 미래에셋/삼성/케이뱅크 수동 자산
                        </p>
                    </div>

                    <div className="flex items-center gap-2 w-full md:w-auto">
                        <button
                            onClick={() => setIsHoldingsDashboardOpen(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 text-purple-300 rounded-xl text-xs font-semibold transition-all hover:scale-105 active:scale-95"
                        >
                            <PieChart className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">대시보드 보기</span>
                        </button>

                        {/* Search */}
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="종목명, 티커, 금융사 검색..."
                            className="bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 w-full md:w-48"
                        />
                    </div>
                </div>

                {/* Filter Tabs */}
                <div className="px-5 py-2.5 border-b border-white/5 flex gap-1.5 overflow-x-auto bg-black/20">
                    <button
                        onClick={() => setActiveTab("ALL")}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                            activeTab === "ALL"
                                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30"
                                : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white"
                        }`}
                    >
                        전체 보기 ({totalHoldingsCount})
                    </button>

                    {accountBoards.map((b: any) => {
                        const count = b.holdings_count || 0;
                        const icon = CATEGORY_ICONS[b.category_name] || "📁";
                        return (
                            <button
                                key={b.category_name}
                                onClick={() => setActiveTab(b.category_name)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                                    activeTab === b.category_name
                                        ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30"
                                        : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white"
                                }`}
                            >
                                <span>{icon}</span>
                                <span>{b.category_name}</span>
                                <span className="text-[10px] opacity-70">({count})</span>
                            </button>
                        );
                    })}
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    {allHoldingsList.length === 0 ? (
                        <div className="p-12 text-center text-gray-500 text-xs">
                            해당 분류에 등록된 종목이 없습니다.
                            <div className="mt-3">
                                <button
                                    onClick={() => {
                                        setSelectedManualAsset(null);
                                        setIsAssetModalOpen(true);
                                    }}
                                    className="px-3.5 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 rounded-xl text-xs font-semibold transition-all"
                                >
                                    + 수동 자산 등록하기
                                </button>
                            </div>
                        </div>
                    ) : (
                        <table className="w-full text-left text-xs border-collapse">
                            <thead>
                                <tr className="border-b border-white/10 bg-white/[0.02] text-gray-400 font-semibold whitespace-nowrap">
                                    <th className="py-3 px-4">종목명 / 상품명</th>
                                    <th className="py-3 px-2 text-center">금융사/출처</th>
                                    <th className="py-3 px-2 text-center">섹터/분류</th>
                                    <th className="py-3 px-2 text-center">계좌</th>
                                    <th className="py-3 px-3 text-right">매수단가</th>
                                    <th className="py-3 px-3 text-right">현재가</th>
                                    <th className="py-3 px-2 text-right">수량</th>
                                    <th className="py-3 px-3 text-right">매수총액</th>
                                    <th className="py-3 px-3 text-right">평가총액</th>
                                    <th className="py-3 px-3 text-right">평가손익</th>
                                    <th className="py-3 px-3 text-right">수익률</th>
                                    <th className="py-3 px-3 text-right">비중</th>
                                    <th className="py-3 px-3 text-center">관리</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5 text-gray-200">
                                {allHoldingsList.map((h: any) => {
                                    const isHProfit = h.profit_loss >= 0;
                                    const isManual = h.source === "MANUAL";

                                    return (
                                        <tr
                                            key={h.id}
                                            className="hover:bg-white/[0.04] transition-colors"
                                        >
                                            {/* 종목명 */}
                                            <td className="py-3 px-4">
                                                <div className="flex items-center gap-2">
                                                    {isManual ? (
                                                        <span
                                                            className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/20 font-bold shrink-0"
                                                            title="수동 입력 자산"
                                                        >
                                                            📝 수동
                                                        </span>
                                                    ) : (
                                                        <span
                                                            className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/20 font-bold shrink-0"
                                                            title="한국투자 KIS API 실시간 연동"
                                                        >
                                                            🟢 KIS
                                                        </span>
                                                    )}
                                                    <div>
                                                        <div className="flex items-center gap-1.5">
                                                            <span
                                                                onClick={() =>
                                                                    h.code && onOpenDetail && onOpenDetail(h.code)
                                                                }
                                                                className={`font-bold text-white text-xs sm:text-sm ${
                                                                    h.code ? "hover:text-indigo-300 cursor-pointer" : ""
                                                                }`}
                                                            >
                                                                {h.name}
                                                            </span>
                                                            {h.code && (
                                                                <span className="font-mono text-[10px] text-gray-500">
                                                                    {h.code}
                                                                </span>
                                                            )}
                                                        </div>
                                                        {h.memo && (
                                                            <p className="text-[10px] text-gray-500 mt-0.5">
                                                                {h.memo}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>

                                            {/* 금융사 / 출처 */}
                                            <td className="py-3 px-2 text-center">
                                                <span className="px-2 py-0.5 rounded text-[10px] bg-white/5 border border-white/10 text-gray-300 font-medium">
                                                    {h.broker}
                                                </span>
                                            </td>

                                            {/* 섹터 / 분류 (드롭다운 편집) */}
                                            <td className="py-3 px-2 text-center">
                                                {editingSectorId === h.id ? (
                                                    <select
                                                        autoFocus
                                                        defaultValue={h.sector || "기타"}
                                                        onChange={(e) => handleSectorChange(h.id, e.target.value)}
                                                        onBlur={() => setEditingSectorId(null)}
                                                        className="bg-[#1e2030] border border-indigo-500/40 rounded-lg px-1.5 py-1 text-[10px] text-indigo-200 focus:outline-none focus:border-indigo-400 cursor-pointer appearance-none min-w-[90px]"
                                                    >
                                                        {SECTOR_OPTIONS.map((opt) => (
                                                            <option key={opt} value={opt}>{opt}</option>
                                                        ))}
                                                        {h.sector && !SECTOR_OPTIONS.includes(h.sector) && (
                                                            <option value={h.sector}>{h.sector}</option>
                                                        )}
                                                    </select>
                                                ) : (
                                                    <span
                                                        onClick={() => setEditingSectorId(h.id)}
                                                        className="px-2 py-0.5 rounded text-[10px] bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 cursor-pointer hover:bg-indigo-500/20 hover:border-indigo-400/40 transition-colors inline-flex items-center gap-1"
                                                        title="클릭하여 섹터 변경"
                                                    >
                                                        {h.sector || "기타"}
                                                        <ChevronDown className="w-2.5 h-2.5 opacity-50" />
                                                    </span>
                                                )}
                                            </td>

                                            {/* 계좌 구분 */}
                                            <td className="py-3 px-2 text-center text-[10px] text-gray-400">
                                                {h.account_name || h.category}
                                            </td>

                                            {/* 매수단가 */}
                                            <td className="py-3 px-3 text-right font-mono text-gray-300">
                                                {h.currency === "USD" ? `$${h.purchase_price.toFixed(2)}` : `${fmtKRW(h.purchase_price)}원`}
                                            </td>

                                            {/* 현재가 */}
                                            <td className="py-3 px-3 text-right font-mono font-semibold text-white">
                                                {h.currency === "USD" ? `$${h.current_price.toFixed(2)}` : `${fmtKRW(h.current_price)}원`}
                                            </td>

                                            {/* 수량 */}
                                            <td className="py-3 px-2 text-right font-mono text-gray-300">
                                                {h.quantity.toLocaleString()}
                                            </td>

                                            {/* 매수총액 (원화) */}
                                            <td className="py-3 px-3 text-right font-mono text-gray-400">
                                                {fmtKRW(h.purchase_amount)}원
                                            </td>

                                            {/* 평가총액 (원화) */}
                                            <td className="py-3 px-3 text-right font-mono font-bold text-white">
                                                {fmtKRW(h.eval_amount)}원
                                            </td>

                                            {/* 평가손익 */}
                                            <td className={`py-3 px-3 text-right font-mono font-bold ${
                                                isHProfit ? "text-rose-400" : "text-blue-400"
                                            }`}>
                                                {isHProfit ? "+" : ""}{fmtKRW(h.profit_loss)}원
                                            </td>

                                            {/* 수익률 */}
                                            <td className={`py-3 px-3 text-right font-mono font-bold ${
                                                isHProfit ? "text-rose-400" : "text-blue-400"
                                            }`}>
                                                {isHProfit ? "+" : ""}{h.return_rate.toFixed(2)}%
                                            </td>

                                            {/* 비중 */}
                                            <td className="py-3 px-3 text-right font-mono text-xs font-semibold text-indigo-300">
                                                {(h.weight || 0).toFixed(1)}%
                                            </td>

                                            {/* 관리 */}
                                            <td className="py-3 px-3 text-center">
                                                {isManual ? (
                                                    <div className="flex items-center justify-center gap-1">
                                                        <button
                                                            onClick={() => {
                                                                setSelectedManualAsset(h);
                                                                setIsAssetModalOpen(true);
                                                            }}
                                                            className="p-1.5 text-indigo-400 hover:text-indigo-200 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 rounded-lg transition-colors"
                                                            title="수정 및 계좌 이동"
                                                        >
                                                            <Edit3 className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                e.preventDefault();
                                                                setAssetToDelete({
                                                                    id: h.manual_id,
                                                                    name: h.name,
                                                                    category: h.category,
                                                                });
                                                            }}
                                                            className="p-1.5 text-rose-400 hover:text-rose-200 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-lg transition-colors"
                                                            title="해당 분류에서 삭제"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                ) : h.code && onOpenDetail ? (
                                                    <button
                                                        onClick={() => onOpenDetail(h.code)}
                                                        className="p-1 text-gray-400 hover:text-indigo-300 rounded hover:bg-white/5 transition-colors"
                                                        title="종목 상세 분석"
                                                    >
                                                        <ExternalLink className="w-3.5 h-3.5" />
                                                    </button>
                                                ) : (
                                                    <span className="text-gray-600">-</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Delete Confirmation Modal */}
            {assetToDelete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
                    <div className="bg-[#161922] border border-rose-500/30 rounded-2xl p-6 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-150">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                                <Trash2 className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-white">수동 자산 삭제 확인</h3>
                                <p className="text-xs text-gray-400">등록된 수동 투자 자산을 삭제합니다.</p>
                            </div>
                        </div>

                        <div className="bg-black/30 border border-white/5 rounded-xl p-3.5 mb-5 text-sm text-gray-200">
                            정말로 <span className="font-semibold text-rose-300 font-mono">[{assetToDelete.name}]</span> 자산을 삭제하시겠습니까?
                            <div className="text-xs text-gray-400 mt-1">삭제된 자산은 복구되지 않으며 종합 자산 현황에서 즉시 제외됩니다.</div>
                        </div>

                        <div className="flex items-center justify-end gap-2.5">
                            <button
                                disabled={isDeletingAsset}
                                onClick={() => setAssetToDelete(null)}
                                className="px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl text-xs font-semibold transition-colors disabled:opacity-50"
                            >
                                취소
                            </button>
                            <button
                                disabled={isDeletingAsset}
                                onClick={handleConfirmDelete}
                                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 disabled:opacity-50 shadow-lg shadow-rose-600/30"
                            >
                                {isDeletingAsset ? (
                                    <>
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        삭제 처리 중...
                                    </>
                                ) : (
                                    <>
                                        <Trash2 className="w-3.5 h-3.5" />
                                        삭제하기
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modals */}
            <ManualAssetModal
                isOpen={isAssetModalOpen}
                onClose={() => {
                    setIsAssetModalOpen(false);
                    setSelectedManualAsset(null);
                }}
                onSuccess={() => fetchIntegratedData(false)}
                initialData={selectedManualAsset}
            />

            <ManualCashModal
                isOpen={isCashModalOpen}
                onClose={() => setIsCashModalOpen(false)}
                onSuccess={() => fetchIntegratedData(false)}
            />

            <KisAccountMappingModal
                isOpen={isMappingModalOpen}
                onClose={() => setIsMappingModalOpen(false)}
                onSuccess={() => fetchIntegratedData(false)}
                kisAccounts={kisAccounts}
            />

            {/* 닫혀 있을 때는 아예 마운트하지 않는다 (불필요한 집계 연산 방지) */}
            {isAccountDashboardOpen && (
                <AccountSummaryDashboard
                    isOpen={isAccountDashboardOpen}
                    onClose={() => setIsAccountDashboardOpen(false)}
                    accountBoards={accountBoards}
                    summary={summary}
                />
            )}

            {isHoldingsDashboardOpen && (
                <HoldingsDetailDashboard
                    isOpen={isHoldingsDashboardOpen}
                    onClose={() => setIsHoldingsDashboardOpen(false)}
                    allHoldings={Object.keys(groupedHoldings).reduce(
                        (acc: any[], cat) => acc.concat(groupedHoldings[cat] || []),
                        []
                    )}
                />
            )}
        </div>
    );
}
