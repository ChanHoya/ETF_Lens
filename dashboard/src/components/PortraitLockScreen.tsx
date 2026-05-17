'use client';
import { useEffect, useState } from 'react';

/**
 * PortraitLockScreen
 * - 모바일/태블릿(너비 < 1024px)에서 세로모드 감지 시 회전 안내 오버레이 표시
 * - Android Chrome: screen.orientation.lock('landscape') API 시도
 * - iOS Safari: API 미지원 → 오버레이만 표시
 */
export default function PortraitLockScreen() {
    const [isPortraitMobile, setIsPortraitMobile] = useState(false);

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
        const orientation: any = (screen as any).orientation || (screen as any).mozOrientation || (screen as any).msOrientation;
        if (typeof screen !== 'undefined' && orientation?.lock) {
            orientation.lock('landscape').catch(() => {
                // iOS 등 미지원 브라우저 — 오버레이로 대체
            });
        }

        return () => {
            window.removeEventListener('resize', check);
            window.removeEventListener('orientationchange', check);
        };
    }, []);

    if (!isPortraitMobile) return null;

    return (
        <div
            className="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-[#050510]"
            style={{ touchAction: 'none' }}
        >
            {/* 배경 글로우 */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-indigo-600/15 rounded-full blur-[80px]" />
            </div>

            <div className="relative flex flex-col items-center gap-6 px-8 text-center">
                {/* 회전 아이콘 — CSS 애니메이션 */}
                <svg
                    className="w-16 h-16 text-indigo-400"
                    style={{ animation: 'rotate-hint 2s ease-in-out infinite' }}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}
                >
                    <path strokeLinecap="round" strokeLinejoin="round"
                        d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
                </svg>

                <div>
                    <p className="text-xl font-black text-white mb-2">가로 모드로 회전해 주세요</p>
                    <p className="text-sm text-gray-400 leading-relaxed">
                        ETF Lens는 가로 모드에서 최적화된<br />화면을 제공합니다
                    </p>
                </div>

                <div className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-full">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                    <span className="text-xs text-gray-400">기기를 90° 회전해 주세요</span>
                </div>
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
