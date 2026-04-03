"use client";
import React, { useState, useEffect, useCallback } from "react";
import NavigationTabs from "@/components/NavigationTabs";
import MyAuthModal from "@/components/MyAuthModal";
import MyDashboard from "@/components/MyDashboard";
import { Loader2, RefreshCw } from "lucide-react";
import { API_BASE } from "@/lib/apiConfig";

export default function MyPage() {
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [kisData, setKisData] = useState<any>(null);
    const [tradesData, setTradesData] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const [lastFetchedAt, setLastFetchedAt] = useState<Date | null>(null);

    useEffect(() => { setIsLoading(false); }, []);

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

    const handleAuthSuccess = () => fetchPortfolioData(false);
    const handleLogout = () => {
        localStorage.removeItem("etf_lens_pin");
        setIsAuthorized(false);
        setKisData(null);
        setTradesData(null);
        setLastFetchedAt(null);
    };

    const lastFetchLabel = lastFetchedAt
        ? `${String(lastFetchedAt.getHours()).padStart(2,"0")}:${String(lastFetchedAt.getMinutes()).padStart(2,"0")}:${String(lastFetchedAt.getSeconds()).padStart(2,"0")} 기준`
        : null;

    return (
        <main className="min-h-screen bg-slate-950 text-slate-50 relative overflow-x-hidden selection:bg-indigo-500/30 font-sans pb-20 lg:pb-0">
            <div className="fixed inset-0 z-0">
                <div className="absolute top-0 -left-10 w-96 h-96 bg-purple-600/20 rounded-full mix-blend-screen filter blur-[100px] opacity-50 animate-blob"></div>
                <div className="absolute top-0 -right-10 w-96 h-96 bg-indigo-600/20 rounded-full mix-blend-screen filter blur-[100px] opacity-50 animate-blob animation-delay-2000"></div>
                <div className="absolute -bottom-20 left-1/2 -translate-x-1/2 w-96 h-96 bg-blue-600/20 rounded-full mix-blend-screen filter blur-[100px] opacity-50 animate-blob animation-delay-4000"></div>
                <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))] opacity-[0.05]"></div>
            </div>

            <div className="relative z-10 w-full xl:max-w-[1400px] mx-auto px-4 lg:px-6 flex flex-col items-center pt-8 pb-32">
                <div className="w-full flex justify-between items-center mb-6 max-w-[95vw] xl:max-w-[1400px]">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-2xl border border-indigo-500/30 backdrop-blur-xl shadow-[0_0_15px_rgba(99,102,241,0.2)]">
                            <span className="text-xl md:text-2xl">💰</span>
                        </div>
                        <div>
                            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-indigo-200 to-purple-300 drop-shadow-sm">
                                My Assets
                            </h1>
                            {lastFetchLabel && (
                                <p className="text-xs text-gray-500 mt-0.5">{lastFetchLabel}</p>
                            )}
                        </div>
                    </div>
                    {isAuthorized && (
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => fetchPortfolioData(true)}
                                disabled={isRefreshing}
                                className="flex items-center gap-1.5 px-3 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 rounded-xl text-sm font-medium text-indigo-300 transition-all disabled:opacity-50"
                            >
                                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
                                {isRefreshing ? "조회중..." : "새로고침"}
                            </button>
                            <button
                                onClick={handleLogout}
                                className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-medium transition-colors"
                            >
                                로그아웃
                            </button>
                        </div>
                    )}
                </div>

                <div className="w-full max-w-[95vw] xl:max-w-[1400px] mb-8">
                    <NavigationTabs />
                </div>

                {isLoading && !isAuthorized ? (
                    <div className="flex flex-col items-center justify-center p-20">
                        <Loader2 className="w-12 h-12 text-indigo-500 animate-spin mb-4" />
                        <p className="text-gray-400">인증 정보를 확인 중입니다...</p>
                    </div>
                ) : !isAuthorized ? (
                    <MyAuthModal onSuccess={handleAuthSuccess} initialError={error} />
                ) : isLoading ? (
                    <div className="flex flex-col items-center justify-center p-20 w-full max-w-4xl bg-white/[0.02] border border-white/5 rounded-3xl backdrop-blur-xl">
                        <Loader2 className="w-12 h-12 text-indigo-500 animate-spin mb-4" />
                        <h2 className="text-xl font-bold mb-2">My 포트폴리오 분석 중</h2>
                        <p className="text-gray-400 text-center max-w-md">한국투자증권(KIS) API에서 데이터를 불러오고 있습니다. 최대 수십 초가 소요될 수 있습니다.</p>
                    </div>
                ) : error ? (
                    <div className="flex flex-col items-center justify-center p-20 w-full max-w-4xl bg-white/[0.02] border border-white/5 rounded-3xl backdrop-blur-xl">
                        <div className="text-red-400 mb-4 text-center">
                            <p className="font-bold text-lg mb-2">오류가 발생했습니다.</p>
                            <p className="text-sm">{error}</p>
                        </div>
                        <button onClick={() => fetchPortfolioData(false)} className="px-6 py-2 bg-indigo-500 hover:bg-indigo-600 rounded-xl transition-colors">다시 시도</button>
                    </div>
                ) : (
                    <MyDashboard data={kisData} tradesData={tradesData} isRefreshing={isRefreshing} />
                )}
            </div>
        </main>
    );
}
