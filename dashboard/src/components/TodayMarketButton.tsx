'use client';
// 시장동향 서브탭 바의 "오늘의 시장" 버튼과 bulliza.com 임베드 팝업 (팝업은 body 포털로 그려 상위 blur·overflow에 갇히지 않게 함)

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Activity, ChevronRight, X } from 'lucide-react';

const TODAY_MARKET_URL = 'https://bulliza.com/'; // 2026-10 finance.richgo.ai(404)에서 이전

interface TodayMarketButtonProps {
    defaultOpen?: boolean;
    isOpen?: boolean;
    onOpenChange?: (open: boolean) => void;
}

export default function TodayMarketButton({
    defaultOpen = false,
    isOpen: controlledOpen,
    onOpenChange,
}: TodayMarketButtonProps = {}) {
    const [internalOpen, setInternalOpen] = useState(defaultOpen);
    const [blocked, setBlocked] = useState(false);
    const [mounted, setMounted] = useState(false);

    const [topOffset, setTopOffset] = useState(115);

    useEffect(() => {
        setMounted(true);
    }, []);

    const isControlled = controlledOpen !== undefined;
    const open = isControlled ? controlledOpen : internalOpen;

    useEffect(() => {
        if (!open) return;
        const updateOffset = () => {
            const headlineEl = document.getElementById('iprism-headline');
            if (headlineEl) {
                const rect = headlineEl.getBoundingClientRect();
                setTopOffset(Math.max(Math.round(rect.bottom) + 6, 90));
            } else {
                setTopOffset(typeof window !== 'undefined' && window.innerWidth < 768 ? 155 : 115);
            }
        };

        updateOffset();
        window.addEventListener('resize', updateOffset);
        window.addEventListener('scroll', updateOffset, { passive: true });
        const timer1 = setTimeout(updateOffset, 60);
        const timer2 = setTimeout(updateOffset, 250);

        return () => {
            window.removeEventListener('resize', updateOffset);
            window.removeEventListener('scroll', updateOffset);
            clearTimeout(timer1);
            clearTimeout(timer2);
        };
    }, [open, mounted]);

    const handleSetOpen = (nextOpen: boolean) => {
        if (!isControlled) {
            setInternalOpen(nextOpen);
        }
        onOpenChange?.(nextOpen);
    };

    return (
        <>
            <button
                onClick={() => { setBlocked(false); handleSetOpen(true); }}
                className="relative flex items-center gap-1.5 px-3 py-1 rounded-full text-sm md:text-[15px] font-bold whitespace-nowrap transition-all text-emerald-200 border animate-market-highlight hover:text-white"
            >
                <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
                </span>
                <Activity className="w-4 h-4 text-emerald-300" />
                오늘의 시장
            </button>

            {open && mounted && typeof document !== 'undefined' && createPortal(
                <div
                    style={{ top: `${topOffset}px` }}
                    className="fixed left-0 right-0 bottom-0 z-[150] flex flex-col items-center bg-black/50 backdrop-blur-[2px] px-2 md:px-6 pb-2 md:pb-3 animate-in fade-in duration-200"
                    onClick={() => handleSetOpen(false)}
                >
                    <div
                        className="relative w-full max-w-[95vw] xl:max-w-[1400px] h-full bg-white dark:bg-[#0d0d12] border border-white/10 dark:border-white/15 rounded-2xl md:rounded-3xl shadow-2xl overflow-hidden flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* 창 우측 상단 플로팅 닫기 & 새창 버튼 (헤더 바 제거로 세로 공간 100% 극대화) */}
                        <div className="absolute top-2.5 right-2.5 md:top-3 md:right-3.5 z-30 flex items-center gap-1.5 bg-black/65 hover:bg-black/85 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/20 shadow-lg transition-all group">
                            <a
                                href={TODAY_MARKET_URL}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-[11px] font-bold text-gray-200 hover:text-white transition-colors"
                                title="새 창에서 열기"
                            >
                                새 창 <ChevronRight className="w-3 h-3 text-gray-400 group-hover:text-white" />
                            </a>
                            <div className="h-3 w-[1px] bg-white/20" />
                            <button
                                onClick={() => handleSetOpen(false)}
                                className="p-0.5 text-gray-300 hover:text-white rounded-full transition-colors cursor-pointer"
                                aria-label="닫기"
                                title="닫기"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* 본문 iframe: 왼쪽 메뉴바(w-[220px])를 오프셋 클리핑하여 오른쪽 시장동향 본문(첨부3)만 꽉 차게 노출 */}
                        <div className="flex-1 relative w-full h-full overflow-hidden bg-white">
                            <iframe
                                src={TODAY_MARKET_URL}
                                title="오늘의 시장"
                                className="absolute inset-0 h-full border-0 w-full md:w-[calc(100%+220px)] md:-ml-[220px]"
                                allowFullScreen
                                onError={() => setBlocked(true)}
                            />
                            {blocked && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#0d0d12] text-center p-6">
                                    <p className="text-gray-300 text-sm">이 사이트는 임베드(iframe)를 허용하지 않습니다.</p>
                                    <a
                                        href={TODAY_MARKET_URL}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-1 text-sm font-bold text-emerald-300 hover:text-white bg-emerald-500/20 border border-emerald-400/30 px-4 py-2 rounded-lg transition-colors"
                                    >
                                        새 창에서 열기 <ChevronRight className="w-4 h-4" />
                                    </a>
                                </div>
                            )}
                        </div>
                    </div>
                </div>,
                document.body,
            )}
        </>
    );
}
