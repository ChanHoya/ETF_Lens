'use client';

import { useState, useEffect, useRef } from 'react';

const CORRECT_PASSWORD = '00700';
const SESSION_KEY = 'etf_lens_auth';

export default function PasswordGate({ children }: { children: React.ReactNode }) {
    const [authenticated, setAuthenticated] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [input, setInput] = useState('');
    const [error, setError] = useState(false);
    const [shaking, setShaking] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setMounted(true);
        if (sessionStorage.getItem(SESSION_KEY) === 'true') {
            setAuthenticated(true);
        } else {
            // 자동 포커스
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, []);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (input === CORRECT_PASSWORD) {
            sessionStorage.setItem(SESSION_KEY, 'true');
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
    };

    // SSR 중에는 아무것도 렌더링 안 함 (hydration 불일치 방지)
    if (!mounted) return null;

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
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-[0_0_40px_rgba(99,102,241,0.4)]">
                        <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                    </div>
                    <div className="text-center">
                        <h1 className="text-2xl font-black text-white tracking-tight">ETF Lens</h1>
                        <p className="text-sm text-gray-500 mt-1">데이터 기반 ETF 분석 서비스</p>
                    </div>
                </div>

                {/* 비밀번호 입력 폼 */}
                <form
                    onSubmit={handleSubmit}
                    className={`w-full flex flex-col gap-4 ${shaking ? 'animate-[shake_0.5s_ease-in-out]' : ''}`}
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
                        <p className="text-red-400 text-sm text-center animate-in fade-in duration-200">
                            비밀번호가 올바르지 않습니다
                        </p>
                    )}

                    <button
                        type="submit"
                        className="w-full py-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold text-base hover:from-indigo-500 hover:to-purple-500 active:scale-[0.98] transition-all shadow-[0_4px_20px_rgba(99,102,241,0.35)]"
                    >
                        입장
                    </button>
                </form>

                <p className="text-xs text-gray-600">© Hoya 2026 · Private Access Only</p>
            </div>

            <style jsx global>{`
                @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    15%       { transform: translateX(-8px); }
                    30%       { transform: translateX(8px); }
                    45%       { transform: translateX(-6px); }
                    60%       { transform: translateX(6px); }
                    75%       { transform: translateX(-3px); }
                    90%       { transform: translateX(3px); }
                }
            `}</style>
        </div>
    );
}
