'use client';
// 시장동향 서브탭 바의 "오늘의 시장" 버튼과 bulliza.com 임베드 팝업 (팝업은 body 포털로 그려 상위 blur·overflow에 갇히지 않게 함)

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Activity, ChevronRight, X } from 'lucide-react';

const TODAY_MARKET_URL = 'https://bulliza.com/'; // 2026-10 finance.richgo.ai(404)에서 이전

export default function TodayMarketButton() {
    const [open, setOpen] = useState(false);
    const [blocked, setBlocked] = useState(false);

    return (
        <>
            <button
                onClick={() => { setBlocked(false); setOpen(true); }}
                className="flex items-center gap-1.5 px-3 py-1 rounded-full text-sm md:text-[15px] font-bold whitespace-nowrap transition-all bg-gradient-to-r from-emerald-500/20 to-sky-500/20 text-emerald-200 border border-emerald-400/30 hover:from-emerald-500/30 hover:to-sky-500/30 hover:text-white"
            >
                <Activity className="w-4 h-4" />
                오늘의 시장
            </button>

            {open && createPortal(
                <div
                    className="fixed inset-0 z-[200] flex items-start justify-center bg-black/70 backdrop-blur-sm p-2 md:p-3 animate-in fade-in duration-200"
                    onClick={() => setOpen(false)}
                >
                    <div
                        className="relative w-full max-w-6xl h-[96vh] bg-[#0d0d12] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* 헤더 */}
                        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-[#121217] shrink-0">
                            <div className="flex items-center gap-2 text-white font-bold">
                                <Activity className="w-4 h-4 text-emerald-400" />
                                오늘의 시장
                                <span className="text-[11px] font-medium text-gray-500 ml-1">bulliza.com</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <a
                                    href={TODAY_MARKET_URL}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1 text-xs font-bold text-gray-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-1.5 rounded-lg transition-colors"
                                >
                                    새 창에서 열기 <ChevronRight className="w-3.5 h-3.5" />
                                </a>
                                <button
                                    onClick={() => setOpen(false)}
                                    className="p-1.5 text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
                                    aria-label="닫기"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {/* 본문 iframe */}
                        <div className="flex-1 relative bg-white">
                            <iframe
                                src={TODAY_MARKET_URL}
                                title="오늘의 시장"
                                className="absolute inset-0 w-full h-full border-0"
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
