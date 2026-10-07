'use client';

import { useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { IPrismLogo } from './brand/IPrismLogo';

// 비밀번호 인증이 필요한 보안 서비스 경로 (/my, /tff 및 하위 경로)
const PROTECTED_PREFIXES = ['/my', '/tff'];

export default function PasswordGate({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const [authenticated, setAuthenticated] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [loading, setLoading] = useState(false);
    const [input, setInput] = useState('');
    const [error, setError] = useState(false);
    const [shaking, setShaking] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    // 현재 경로가 /my 또는 /tff로 시작하는 보안 서비스인지 판별
    const targetService = pathname?.startsWith('/tff') ? 'tff' : (pathname?.startsWith('/my') ? 'my' : null);
    const isProtected = targetService !== null;
    const sessionKey = targetService ? `${targetService}_auth_verified` : 'public_auth';

    useEffect(() => {
        setMounted(true);
        if (!isProtected) return;

        try {
            if (sessionStorage.getItem(sessionKey) === 'true') {
                setAuthenticated(true);
            } else {
                setAuthenticated(false);
                setTimeout(() => inputRef.current?.focus(), 100);
            }
        } catch {
            setAuthenticated(false);
        }
    }, [pathname, isProtected, sessionKey]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!targetService || loading) return;

        setLoading(true);
        setError(false);

        try {
            // Next.js 서버 API Route로 안전하게 검증 (비밀번호는 Vercel 환경변수에서 관리)
            const res = await fetch('/api/auth/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    service: targetService,
                    password: input
                })
            });

            const data = await res.json();

            if (res.ok && data.success) {
                try {
                    sessionStorage.setItem(sessionKey, 'true');
                    // TFF인 경우 TFF 대시보드 내부 세션 키도 함께 동기화
                    if (targetService === 'tff') {
                        sessionStorage.setItem('tff_fund_auth', 'true');
                    }
                } catch { /* 시크릿 모드 무시 */ }
                setAuthenticated(true);
            } else {
                setError(true);
                setShaking(true);
                setInput('');
                setTimeout(() => {
                    setShaking(false);
                    setError(false);
                    inputRef.current?.focus();
                }, 600);
            }
        } catch (err) {
            setError(true);
        } finally {
            setLoading(false);
        }
    };

    // 1. 보호 대상이 아닌 공개 서비스('/', '/discover', '/pension' 등)는 비밀번호 없이 즉시 렌더링
    if (!isProtected) {
        return <>{children}</>;
    }

    // 2. 보호 서비스(/my, /tff): SSR 중에는 아무것도 렌더링 안 함 (hydration 불일치 방지)
    if (!mounted) return null;

    // 3. 이미 인증된 경우 자식 컴포넌트 렌더링
    if (authenticated) return <>{children}</>;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#0d0d14]">
            {/* 배경 글로우 */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-[120px]" />
                <div className="absolute bottom-1/4 left-1/3 w-[400px] h-[400px] bg-purple-600/8 rounded-full blur-[100px]" />
            </div>

            <div className="relative z-10 flex flex-col items-center gap-8 px-6 w-full max-w-sm">
                {/* 로고 */}
                <div className="flex flex-col items-center gap-3">
                    <div className="text-center flex flex-col items-center">
                        <h1 className="text-white">
                            <span className="sr-only">i-Prism</span>
                            <IPrismLogo className="h-12 w-auto" />
                        </h1>
                        <p className="text-sm text-gray-400 mt-1 font-medium">
                            {targetService === 'tff' ? 'TFF 펀드 대시보드 접근 인증' : 'MY 종합자산 포트폴리오 접근 인증'}
                        </p>
                    </div>
                </div>

                {/* 비밀번호 입력 폼 */}
                <form
                    onSubmit={handleSubmit}
                    className={`w-full flex flex-col gap-4 ${shaking ? 'animate-shake' : ''}`}
                >
                    <div className="relative">
                        <input
                            ref={inputRef}
                            type="password"
                            value={input}
                            onChange={(e) => { setInput(e.target.value); setError(false); }}
                            placeholder="비밀번호 입력"
                            maxLength={10}
                            autoComplete="current-password"
                            className={`w-full bg-white/[0.06] border ${error ? 'border-red-500/70' : 'border-white/10'} rounded-2xl px-5 py-4 text-white text-center text-2xl tracking-[0.5em] placeholder:text-gray-600 placeholder:text-base placeholder:tracking-normal outline-none focus:border-indigo-500/60 focus:bg-white/[0.08] transition-all`}
                        />
                    </div>

                    {error && (
                        <p className="text-red-400 text-sm text-center transition-opacity duration-200">
                            비밀번호가 올바르지 않습니다
                        </p>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold text-base hover:from-indigo-500 hover:to-purple-500 active:scale-[0.98] transition-all shadow-[0_4px_20px_rgba(99,102,241,0.35)] disabled:opacity-50"
                    >
                        {loading ? '인증 확인 중...' : '입장'}
                    </button>
                </form>

                <p className="text-xs text-gray-600">© Hoya 2026 · Private Access Only</p>
            </div>
        </div>
    );
}
