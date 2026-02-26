"use client";
import React, { useState, useEffect } from "react";
import NavigationTabs from "@/components/NavigationTabs";
import MyAuthModal from "@/components/MyAuthModal";
import MyDashboard from "@/components/MyDashboard";
import { Loader2 } from "lucide-react";

export default function MyPage() {
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [kisData, setKisData] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    // Initial load - check for auth
    useEffect(() => {
        const checkAuth = () => {
            const storedPin = localStorage.getItem("etf_lens_pin");
            const storedKeys = localStorage.getItem("etf_lens_kis_keys");

            if (storedPin && storedKeys) {
                // If keys exist but we haven't unlocked yet, we show modal. 
                // Wait, if PIN exists, we need them to enter it.
                // We'll manage this state in the MyAuthModal.
                setIsAuthorized(false);
            } else {
                setIsAuthorized(false);
            }
            setIsLoading(false);
        };
        checkAuth();
    }, []);

    const fetchPortfolioData = async (keys: any) => {
        setIsLoading(true);
        setError(null);
        try {
            // Determine API URL based on environment
            const isLocal = window.location.hostname === 'localhost';
            const apiUrl = isLocal
                ? 'http://localhost:8000/api/v1/my/portfolio'
                : 'https://etf-lens.onrender.com/api/v1/my/portfolio';

            const response = await fetch(apiUrl, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'account-no': keys.accountNo,
                    'account-type': keys.accountType || 'real'
                }
            });

            const data = await response.json();

            if (!response.ok) {
                if (Array.isArray(data.detail)) {
                    // FastAPI validation error array
                    throw new Error(data.detail.map((err: any) => err.msg).join(", "));
                }
                throw new Error(data.detail || "Failed to fetch portfolio data");
            }

            setKisData(data);
            setIsAuthorized(true);
        } catch (err: any) {
            console.error(err);
            const errMsg = typeof err.message === 'object' ? JSON.stringify(err.message) : (err.message || "Failed to load data");
            setError(errMsg);
            setIsAuthorized(false); // Make them re-enter or check keys
            // If the error is an auth error, we might want to clear keys, but let's let the user do that
        } finally {
            setIsLoading(false);
        }
    };

    const handleAuthSuccess = (keys: any) => {
        fetchPortfolioData(keys);
    };

    const handleLogout = () => {
        localStorage.removeItem("etf_lens_pin");
        localStorage.removeItem("etf_lens_kis_keys");
        setIsAuthorized(false);
        setKisData(null);
    };

    return (
        <main className="min-h-screen bg-slate-950 text-slate-50 relative overflow-x-hidden selection:bg-indigo-500/30 font-sans pb-20 lg:pb-0">
            {/* Background effects */}
            <div className="fixed inset-0 z-0">
                <div className="absolute top-0 -left-10 w-96 h-96 bg-purple-600/20 rounded-full mix-blend-screen filter blur-[100px] opacity-50 animate-blob"></div>
                <div className="absolute top-0 -right-10 w-96 h-96 bg-indigo-600/20 rounded-full mix-blend-screen filter blur-[100px] opacity-50 animate-blob animation-delay-2000"></div>
                <div className="absolute -bottom-20 left-1/2 -translate-x-1/2 w-96 h-96 bg-blue-600/20 rounded-full mix-blend-screen filter blur-[100px] opacity-50 animate-blob animation-delay-4000"></div>
                <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))] opacity-[0.05]"></div>
            </div>

            <div className="relative z-10 w-full xl:max-w-[1400px] mx-auto px-4 lg:px-6 flex flex-col items-center pt-8 pb-32">
                {/* Header Section */}
                <div className="w-full flex justify-between items-center mb-6 max-w-[95vw] xl:max-w-[1400px]">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-2xl border border-indigo-500/30 backdrop-blur-xl shadow-[0_0_15px_rgba(99,102,241,0.2)]">
                            <span className="text-xl md:text-2xl">💰</span>
                        </div>
                        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-indigo-200 to-purple-300 drop-shadow-sm">
                            My Assets
                        </h1>
                    </div>
                    {isAuthorized && (
                        <button
                            onClick={handleLogout}
                            className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-medium transition-colors"
                        >
                            로그아웃
                        </button>
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
                        <p className="text-gray-400 text-center max-w-md">한국투자증권(KIS) API에서 데이터를 불러와 ETF Lens의 데이터와 교차 분석을 진행하고 있습니다. 최대수 십초가 소요될 수 있습니다.</p>
                    </div>
                ) : (
                    <MyDashboard data={kisData} />
                )}
            </div>
        </main>
    );
}
