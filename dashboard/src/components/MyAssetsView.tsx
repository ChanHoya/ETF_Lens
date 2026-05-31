"use client";
import React, { useState, useEffect, useCallback } from "react";
import MyAuthModal from "@/components/MyAuthModal";
import MyDashboard from "@/components/MyDashboard";
import InvestmentReturnCard from "@/components/InvestmentReturnCard";
import { Loader2, RefreshCw } from "lucide-react";
import { API_BASE } from "@/lib/apiConfig";
import RiskBanner from "@/components/RiskBanner";

export default function MyAssetsView({ onOpenDetail, onAnalyzePeers }: { onOpenDetail?: (code: string) => void, onAnalyzePeers?: (items: any[]) => void }) {
    const [isAuthorized, setIsAuthorized] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [kisData, setKisData] = useState<any>(null);
    const [tradesData, setTradesData] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const [lastFetchedAt, setLastFetchedAt] = useState<Date | null>(null);

    const [isSimulatedMode, setIsSimulatedMode] = useState<boolean>(false);
    const [hasSimulated, setHasSimulated] = useState<boolean>(false);
    const [simulatedData, setSimulatedData] = useState<any>(null);

    const fetchTrades = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE}/api/v1/my/trades/today`);
            if (res.ok) setTradesData(await res.json());
        } catch (e) { console.warn("체결내역 조회 실패:", e); }
    }, []);

    const fetchPortfolioData = useCallback(async (isManualRefresh = false) => {
        if (isManualRefresh) setIsRefreshing(true);
        else setIsLoading(true);
        setError(null);
        try {
            // 1. Fetch simulated state first
            try {
                const simRes = await fetch(`${API_BASE}/api/v1/order/simulated-portfolio`);
                if (simRes.ok) {
                    const simJson = await simRes.json();
                    if (simJson.has_simulated && simJson.data) {
                        setHasSimulated(true);
                        setSimulatedData(simJson.data);
                    } else {
                        setHasSimulated(false);
                        setSimulatedData(null);
                    }
                }
            } catch (simErr) {
                console.warn("Simulated portfolio fetch failed:", simErr);
            }

            const [portfolioRes] = await Promise.all([
                fetch(`${API_BASE}/api/v1/my/portfolio`),
                fetchTrades(),
            ]);
            const data = await portfolioRes.json();
            if (!portfolioRes.ok) {
                throw new Error(
                    Array.isArray(data.detail)
                        ? data.detail.map((e: any) => e.msg).join(", ")
                        : data.detail || "Failed to fetch portfolio data"
                );
            }
            setKisData(data);
            setIsAuthorized(true);
            setLastFetchedAt(new Date());
        } catch (err: any) {
            const msg = typeof err.message === "object"
                ? JSON.stringify(err.message)
                : (err.message || "데이터 로드 실패");
            setError(msg);
            if (!isManualRefresh) setIsAuthorized(false);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [fetchTrades]);

    useEffect(() => {
        // 초기 마운트 시 세션스토리지 확인
        if (typeof window !== "undefined") {
            try {
                const savedSelected = sessionStorage.getItem("kis_authorized");
                if (savedSelected === "true") {
                    setIsAuthorized(true);
                } else {
                    setIsLoading(false); // 미인증 시 로딩 애니메이션 종료하고 패스워드 모달 전시
                }
            } catch (e) {
                console.warn("sessionStorage 접근 실패:", e);
                setIsLoading(false); // 접근 불가 시에도 로딩은 멈추고 모달을 보여줌
            }
        }
    }, []);

    useEffect(() => {
        if (isAuthorized && typeof window !== "undefined") {
            try {
                sessionStorage.setItem("kis_authorized", "true");
            } catch (e) {
                console.warn("sessionStorage 저장 실패:", e);
            }
        }
    }, [isAuthorized]);

    // 초기 마운트 시 인증되어 있으면 데이터 불러오기
    useEffect(() => {
        if (isAuthorized && !kisData) {
            fetchPortfolioData();
        }
    }, [isAuthorized, kisData, fetchPortfolioData]);

    useEffect(() => {
        const handleRefresh = (e: any) => {
            fetchPortfolioData(true);
            if (e.detail && e.detail.enableSimulation) {
                setIsSimulatedMode(true);
            }
        };
        window.addEventListener('refresh-portfolio', handleRefresh);
        return () => window.removeEventListener('refresh-portfolio', handleRefresh);
    }, [fetchPortfolioData]);

    useEffect(() => {
        if (typeof window !== "undefined") {
            const activeData = isSimulatedMode ? simulatedData : kisData;
            if (activeData) {
                try {
                    sessionStorage.setItem("kis_portfolio_data", JSON.stringify(activeData));
                } catch (e) {
                    console.warn("sessionStorage 저장 실패:", e);
                }
            } else {
                sessionStorage.removeItem("kis_portfolio_data");
            }
        }
    }, [isSimulatedMode, kisData, simulatedData]);

    const handleAuthSuccess = () => fetchPortfolioData(false);
    const handleLogout = () => {
        localStorage.removeItem("etf_lens_pin");
        setIsAuthorized(false);
        setKisData(null);
        setTradesData(null);
        setLastFetchedAt(null);
        if (typeof window !== "undefined") {
            sessionStorage.removeItem("kis_portfolio_data");
        }
    };

    const lastFetchLabel = lastFetchedAt
        ? `${String(lastFetchedAt.getHours()).padStart(2,"0")}:${String(lastFetchedAt.getMinutes()).padStart(2,"0")}:${String(lastFetchedAt.getSeconds()).padStart(2,"0")} 기준`
        : null;

    return (
        <div className="w-full xl:max-w-[1400px] mx-auto px-4 lg:px-6 flex flex-col items-center pt-1 pb-32 animate-in fade-in zoom-in-95 duration-500">
            {isAuthorized && (
                <div className="w-full flex justify-between items-center mb-3 max-w-[95vw] xl:max-w-[1400px]">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-xl border border-indigo-500/30 shadow-[0_0_15px_rgba(99,102,241,0.2)]">
                            <span className="text-xl">💰</span>
                        </div>
                        <div>
                            <h2 className="text-xl md:text-2xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-indigo-200 to-purple-300 drop-shadow-sm">
                                My Assets
                            </h2>
                            {lastFetchLabel && (
                                <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5">{lastFetchLabel}</p>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {hasSimulated && (
                            <button
                                onClick={() => setIsSimulatedMode(!isSimulatedMode)}
                                className={`px-3 py-1.5 border rounded-xl text-[10px] sm:text-xs font-semibold transition-all ${
                                    isSimulatedMode 
                                        ? "bg-purple-500/25 text-purple-300 border-purple-500/40 shadow-[0_0_12px_rgba(168,85,247,0.35)]" 
                                        : "bg-white/5 text-gray-400 border-white/10 hover:bg-white/10"
                                }`}
                            >
                                ✨ {isSimulatedMode ? "실제 자산 보기" : "시뮬레이션 자산 보기"}
                            </button>
                        )}
                        <button
                            onClick={() => fetchPortfolioData(true)}
                            disabled={isRefreshing}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 rounded-xl text-xs sm:text-sm font-medium text-indigo-300 transition-all disabled:opacity-50"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
                            <span className="hidden sm:inline">{isRefreshing ? "조회중..." : "새로고침"}</span>
                        </button>
                        <button
                            onClick={handleLogout}
                            className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs sm:text-sm font-medium transition-colors"
                        >
                            로그아웃
                        </button>
                    </div>
                </div>
            )}

            {isLoading && !isAuthorized ? (
                <div className="flex flex-col items-center justify-center p-20">
                    <Loader2 className="w-12 h-12 text-indigo-500 animate-spin mb-4" />
                    <p className="text-gray-400">인증 정보를 확인 중입니다...</p>
                </div>
            ) : !isAuthorized ? (
                <MyAuthModal onSuccess={handleAuthSuccess} initialError={error} />
            ) : isLoading ? (
                <div className="flex flex-col items-center justify-center p-20 w-full max-w-4xl bg-white/[0.02] border border-white/5 rounded-3xl backdrop-blur-xl mt-8">
                    <Loader2 className="w-12 h-12 text-indigo-500 animate-spin mb-4" />
                    <h2 className="text-xl font-bold mb-2">My 포트폴리오 분석 중</h2>
                    <p className="text-gray-400 text-center max-w-md">한국투자증권(KIS) API에서 데이터를 불러오고 있습니다. 최대 수십 초가 소요될 수 있습니다.</p>
                </div>
            ) : error ? (
                <div className="flex flex-col items-center justify-center p-20 w-full max-w-4xl bg-white/[0.02] border border-white/5 rounded-3xl backdrop-blur-xl mt-8">
                    <div className="text-red-400 mb-4 text-center">
                        <p className="font-bold text-lg mb-2">오류가 발생했습니다.</p>
                        <p className="text-sm">{error}</p>
                    </div>
                    <button onClick={() => fetchPortfolioData(false)} className="px-6 py-2 bg-indigo-500 hover:bg-indigo-600 rounded-xl transition-colors">다시 시도</button>
                </div>
            ) : (
                <div className="w-full max-w-[95vw] xl:max-w-[1400px] flex flex-col gap-6">
                    {isSimulatedMode && (
                        <div className="w-full bg-gradient-to-r from-purple-500/20 via-indigo-500/20 to-blue-500/20 border border-purple-500/30 rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-center gap-3 shadow-[0_0_15px_rgba(168,85,247,0.2)]">
                            <div className="flex items-center gap-3">
                                <span className="text-2xl animate-pulse">✨</span>
                                <div className="text-left">
                                    <p className="text-sm font-bold text-white">AI 리밸런싱 가상 포트폴리오 적용 중</p>
                                    <p className="text-xs text-purple-200">현재 보시는 자산 현황과 보유 종목 비중은 AI 제안 주문에 맞춰 가상으로 실시간 매칭된 시뮬레이션 데이터입니다.</p>
                                </div>
                            </div>
                            <button 
                                onClick={async () => {
                                    await fetch(`${API_BASE}/api/v1/order/simulated-portfolio`, { method: "DELETE" });
                                    setIsSimulatedMode(false);
                                    fetchPortfolioData(true);
                                }}
                                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition-all shrink-0 hover:scale-105"
                            >
                                시뮬레이션 초기화
                            </button>
                        </div>
                    )}
                    <RiskBanner isAuthorized={isAuthorized} />
                    <div className="w-full">
                        <InvestmentReturnCard
                            totalEvalAmount={(isSimulatedMode ? simulatedData : kisData)?.kis_raw?.summary?.total_eval_amount ?? 0}
                            cashBalance={(isSimulatedMode ? simulatedData : kisData)?.kis_raw?.summary?.cash_balance ?? 0}
                        />
                    </div>
                    <MyDashboard data={isSimulatedMode ? simulatedData : kisData} tradesData={tradesData} isRefreshing={isRefreshing} onOpenDetail={onOpenDetail} onAnalyzePeers={onAnalyzePeers} />
                </div>
            )}
        </div>
    );
}
