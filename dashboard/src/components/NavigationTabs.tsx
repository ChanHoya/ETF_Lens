import React from 'react';
import { Aperture, Star } from "lucide-react";

import { useRouter, usePathname } from 'next/navigation';

type NavigationTabsProps = {
    activeTab?: 'select' | 'info' | 'holdings' | 'chart';
    setActiveTab?: (tab: 'select' | 'info' | 'holdings' | 'chart') => void;
    isEtfCheckModalOpen?: boolean;
    setIsEtfCheckModalOpen?: (val: boolean) => void;
    isFavModalOpen?: boolean;
    setIsFavModalOpen?: (val: boolean) => void;
    hasOpenedEtfCheck?: boolean;
    setHasOpenedEtfCheck?: (val: boolean) => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data?: any;
};

export default function NavigationTabs({
    activeTab, setActiveTab,
    isEtfCheckModalOpen, setIsEtfCheckModalOpen,
    isFavModalOpen, setIsFavModalOpen,
    hasOpenedEtfCheck, setHasOpenedEtfCheck,
    data
}: NavigationTabsProps) {
    const router = useRouter();
    const pathname = usePathname();
    const isMyPage = pathname === '/my';

    const navItems: { id: 'select' | 'info' | 'holdings' | 'chart', label: string, icon?: string }[] = [
        { id: 'select', label: '종목선택' },
        { id: 'info', label: '기본정보' },
        { id: 'holdings', label: '구성종목' },
        { id: 'chart', label: '수익률차트' }
    ];

    return (
        <nav className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3 w-full sm:w-auto mt-4 sm:mt-0">
            {navItems.map(tab => (
                <button
                    key={tab.id}
                    onClick={() => {
                        if (isMyPage) {
                            router.push('/');
                        } else if (setActiveTab) {
                            setActiveTab(tab.id);
                            if (setIsEtfCheckModalOpen && isEtfCheckModalOpen) setIsEtfCheckModalOpen(false);
                        }
                    }}
                    className={`px-6 py-3 rounded-full text-sm font-bold transition-all duration-300 w-full sm:w-auto relative overflow-hidden group border ${(!isMyPage && activeTab === tab.id)
                        ? 'bg-gradient-to-r from-indigo-500/30 to-purple-500/30 text-white shadow-[0_0_20px_rgba(99,102,241,0.3)] border-indigo-400/50 scale-105'
                        : 'bg-gray-800/80 text-gray-400 hover:bg-gray-700 hover:text-white border-gray-700/50'
                        }`}
                >
                    {(!isMyPage && activeTab === tab.id) && (
                        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-500 opacity-20 blur-xl group-hover:opacity-30 transition-opacity"></div>
                    )}
                    <span className="relative z-10 flex items-center justify-center gap-2">
                        {tab.label}
                    </span>
                </button>
            ))}

            {/* Naver Finance / ETF Check Tools */}
            {data && (
                <button
                    onClick={() => {
                        if (setIsEtfCheckModalOpen) setIsEtfCheckModalOpen(!isEtfCheckModalOpen);
                        if (setHasOpenedEtfCheck) setHasOpenedEtfCheck(true);
                    }}
                    className={`px-4 flex items-center justify-center gap-2 py-3 rounded-full text-sm font-bold transition-all duration-300 w-full sm:w-auto border ${isEtfCheckModalOpen
                        ? 'bg-rose-500/20 text-rose-400 border-rose-500/50 shadow-[0_0_20px_rgba(244,63,94,0.3)]'
                        : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700 hover:text-rose-300 border-gray-700/50'
                        }`}
                    title="ETF Check 심층 분석"
                >
                    <Aperture size={16} className={isEtfCheckModalOpen ? 'animate-spin-slow' : ''} />
                    {!hasOpenedEtfCheck && (
                        <span className="absolute -top-1 -right-1 flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
                        </span>
                    )}
                </button>
            )}

            {/* Favorites Modal Button */}
            {setIsFavModalOpen && (
                <button
                    onClick={() => {
                        setIsFavModalOpen(true);
                        if (setIsEtfCheckModalOpen && isEtfCheckModalOpen) setIsEtfCheckModalOpen(false);
                    }}
                    className="px-4 py-3 bg-gray-800/80 text-gray-400 hover:bg-yellow-500/20 hover:text-yellow-400 rounded-full text-sm font-bold border border-gray-700/50 shadow-md transition-all duration-300 flex items-center justify-center gap-2"
                    title="관심종목 관리"
                >
                    <Star size={16} />
                </button>
            )}

            {/* My Assets Tab */}
            <button
                onClick={() => {
                    if (!isMyPage) {
                        router.push('/my');
                    }
                }}
                className={`px-6 flex items-center justify-center gap-2 py-3 rounded-full text-sm font-bold transition-all duration-300 w-full sm:w-auto border ${isMyPage
                    ? 'bg-gradient-to-r from-emerald-500/30 to-teal-500/30 text-white shadow-[0_0_20px_rgba(16,185,129,0.3)] border-emerald-400/50 scale-105'
                    : 'bg-gray-800/80 text-gray-400 hover:bg-emerald-500/20 hover:text-emerald-300 border-gray-700/50'
                    }`}
                title="내 자산 평단가 분석 (KIS 연동)"
            >
                {isMyPage && (
                    <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-teal-500 opacity-20 blur-xl group-hover:opacity-30 transition-opacity"></div>
                )}
                <span className="relative z-10 flex items-center justify-center gap-2">
                    <span role="img" aria-label="money">💰</span> My
                </span>
            </button>
        </nav>
    );
}
