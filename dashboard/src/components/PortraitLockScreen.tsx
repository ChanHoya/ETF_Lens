// 모바일 세로 뷰포트 감지 시 회전 안내 및 세로 모드 요약 열람을 지원하는 오버레이 컴포넌트
'use client';

import { useEffect, useState } from 'react';
import { Smartphone, RotateCcw, ChevronRight } from 'lucide-react';

/**
 * PortraitLockScreen
 * - 모바일/태블릿(너비 < 1024px)에서 세로모드 감지 시 회전 안내 오버레이 표시
 * - 가로 모드 전환 유도와 함께 '세로 모드로 요약 화면 보기'를 제공하여 사용성 보존
 */
export default function PortraitLockScreen() {
    const [isPortraitMobile, setIsPortraitMobile] = useState(false);
    const [isDismissed, setIsDismissed] = useState(false);

    useEffect(() => {
        const check = () => {
            const isMobile = window.innerWidth < 1024 || window.innerHeight < 1024;
            const isPortrait = window.innerHeight > window.innerWidth;
            setIsPortraitMobile(isMobile && isPortrait);
        };

        check();
        window.addEventListener('resize', check);
        window.addEventListener('orientationchange', check);

        // Android Chrome: 가로 모드 잠금 시도
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const orientation: any = (screen as any).orientation || (screen as any).mozOrientation || (screen as any).msOrientation;
        if (typeof screen !== 'undefined' && orientation?.lock) {
            orientation.lock('landscape').catch(() => {
                // iOS 등 미지원 브라우저
            });
        }

        return () => {
            window.removeEventListener('resize', check);
            window.removeEventListener('orientationchange', check);
        };
    }, []);

    if (!isPortraitMobile) return null;

    // 사용자가 세로 모드로 요약 보기를 선택한 경우: 화면 하단 플로팅 권장 바 노출
    if (isDismissed) {
        return (
            <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-[9999] max-w-[92vw] px-4 py-2 bg-[#0c101d]/95 border border-indigo-500/40 rounded-full shadow-2xl flex items-center justify-between gap-3 backdrop-blur-md text-xs text-indigo-200">
                <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse shrink-0" />
                    <span className="truncate text-[11px] sm:text-xs">정밀 차트는 가로 모드를 권장합니다</span>
                </div>
                <button
                    type="button"
                    onClick={() => setIsDismissed(false)}
                    className="min-h-[32px] px-2.5 py-1 rounded-full bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 font-bold text-[11px] shrink-0 border border-indigo-500/30 active:scale-[0.97] transition-all cursor-pointer"
                >
                    안내 보기
                </button>
            </div>
        );
    }

    return (
        <div
            className="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-[#050510]/95 backdrop-blur-md"
            style={{ touchAction: 'none' }}
        >
            {/* 배경 글로우 */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-indigo-600/15 rounded-full blur-[80px]" />
            </div>

            <div className="relative flex flex-col items-center gap-5 px-6 max-w-sm text-center">
                {/* 회전 아이콘 — CSS 애니메이션 */}
                <div className="relative flex items-center justify-center">
                    <svg
                        className="w-16 h-16 text-indigo-400"
                        style={{ animation: 'rotate-hint 2s ease-in-out infinite' }}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}
                    >
                        <path strokeLinecap="round" strokeLinejoin="round"
                            d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
                    </svg>
                </div>

                <div>
                    <h2 className="text-xl font-black text-white mb-1.5">가로 모드로 회전해 주세요</h2>
                    <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                        i-Prism은 다층 비교 차트 및 시계열 데이터 가독성을 위해 가로 모드에 최적화되어 있습니다.
                    </p>
                </div>

                <div className="flex items-center gap-2 px-3.5 py-1.5 bg-white/5 border border-white/10 rounded-full">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                    <span className="text-xs text-slate-300">기기를 90° 회전하면 자동 전환됩니다</span>
                </div>

                {/* 세로 모드로 계속 보기 옵션 (최소 44px 터치 타깃) */}
                <button
                    type="button"
                    onClick={() => setIsDismissed(true)}
                    className="mt-2 min-h-[44px] min-w-[200px] px-5 py-2.5 rounded-full bg-indigo-600/30 hover:bg-indigo-600/40 border border-indigo-400/40 text-xs sm:text-sm font-bold text-white transition-all active:scale-[0.97] cursor-pointer focus-visible:ring-2 focus-visible:ring-indigo-500 shadow-lg flex items-center justify-center gap-1.5"
                >
                    <span>세로 모드로 요약 화면 보기</span>
                    <ChevronRight className="w-4 h-4 text-indigo-300" />
                </button>
            </div>

            <style>{`
                @keyframes rotate-hint {
                    0%, 100% { transform: rotate(0deg); }
                    40%       { transform: rotate(-90deg); }
                    60%       { transform: rotate(-90deg); }
                }
            `}</style>
        </div>
    );
}
