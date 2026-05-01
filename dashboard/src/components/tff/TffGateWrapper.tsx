'use client';

import { useState, useEffect, useRef } from 'react';
import TffDashboard from './TffDashboard';

const CORRECT_PASSWORD = '86878889';
const SESSION_KEY = 'tff_fund_auth';

interface Props {
    onOpenDetail?: (code: string) => void;
}

export default function TffGateWrapper({ onOpenDetail }: Props) {
    const [authenticated, setAuthenticated] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [input, setInput] = useState('');
    const [error, setError] = useState(false);
    const [shaking, setShaking] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setMounted(true);
        try {
            if (sessionStorage.getItem(SESSION_KEY) === 'true') {
                setAuthenticated(true);
            } else {
                setTimeout(() => inputRef.current?.focus(), 100);
            }
        } catch {
            // iOS 시크릿 모드 등 sessionStorage 불가 시 미인증 유지
            setAuthenticated(false);
        }
    }, []);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (input === CORRECT_PASSWORD) {
            try { sessionStorage.setItem(SESSION_KEY, 'true'); } catch { /* 시크릿 모드 무시 */ }
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

    if (!mounted) return null;

    // 인증 통과 시 TFF 대시보드 표시
    if (authenticated) return <TffDashboard onOpenDetail={onOpenDetail} />;

    // 암호 입력 화면
    return (
        <div className="flex-1 flex flex-col items-center justify-center w-full min-h-[60vh] relative z-10">
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[400px] h-[400px] bg-sky-600/10 rounded-full blur-[100px]" />
            </div>

            <div className="relative z-10 flex flex-col items-center gap-6 px-6 w-full max-w-sm">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center shadow-[0_0_30px_rgba(14,165,233,0.3)]">
                        <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                    </div>
                    <div className="text-center">
                        <h1 className="text-xl font-black text-white tracking-tight">TFF Fund Dashboard</h1>
                        <p className="text-xs text-gray-500 mt-1">펀드 멤버 전용 보안 영역</p>
                    </div>
                </div>

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
                            placeholder="PIN 번호 입력"
                            maxLength={8}
                            className={`w-full bg-white/[0.06] border ${error ? 'border-red-500/70' : 'border-white/10'} rounded-xl px-5 py-3 text-white text-center text-xl tracking-[0.5em] placeholder:text-gray-600 placeholder:text-sm placeholder:tracking-normal outline-none focus:border-sky-500/60 focus:bg-white/[0.08] transition-all`}
                        />
                    </div>

                    {error && (
                        <p className="text-red-400 text-xs text-center transition-opacity duration-200">
                            PIN 번호가 올바르지 않습니다
                        </p>
                    )}

                    <button
                        type="submit"
                        className="w-full py-3 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 text-white font-bold text-sm hover:from-sky-500 hover:to-indigo-500 active:scale-[0.98] transition-all shadow-[0_4px_20px_rgba(14,165,233,0.3)]"
                    >
                        잠금 해제
                    </button>
                </form>
            </div>


        </div>
    );
}
