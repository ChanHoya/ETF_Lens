import React, { useState } from 'react';
import { Lock, Info, Hash } from 'lucide-react';

export default function MyAuthModal({ onSuccess, initialError }: { onSuccess: () => void, initialError: string | null }) {
    const [pin, setPin] = useState('');
    const [hasExistingPin, setHasExistingPin] = useState(!!localStorage.getItem("etf_lens_pin"));
    const [setupPin, setSetupPin] = useState('');
    const [error, setError] = useState(initialError || '');

    const handlePinLogin = (e: React.FormEvent) => {
        e.preventDefault();
        const storedPin = localStorage.getItem("etf_lens_pin");
        if (pin === storedPin || storedPin === null) {
            onSuccess();
        } else {
            setError("PIN 번호가 일치하지 않습니다.");
        }
    };

    const handleSetup = (e: React.FormEvent) => {
        e.preventDefault();
        if (setupPin.length < 4) {
            setError("PIN 번호는 4자리 이상이어야 합니다.");
            return;
        }

        localStorage.setItem("etf_lens_pin", setupPin);
        onSuccess();
    };

    const handleReset = () => {
        localStorage.removeItem("etf_lens_pin");
        setHasExistingPin(false);
        setPin('');
        setSetupPin('');
        setError('');
    };

    return (
        <div className="w-full max-w-md mx-auto bg-white/[0.03] p-6 lg:p-8 border border-white/10 rounded-3xl backdrop-blur-3xl shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
            <div className="mb-8 text-center">
                <div className="mx-auto w-16 h-16 bg-gradient-to-tr from-indigo-500/20 to-purple-500/20 rounded-2xl border border-indigo-500/30 flex items-center justify-center mb-4">
                    <Lock className="w-8 h-8 text-indigo-400" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">
                    {hasExistingPin ? '포트폴리오 잠금 해제' : 'PIN 앱 잠금 설정'}
                </h2>
                <p className="text-sm text-gray-400">
                    {hasExistingPin
                        ? '설정한 PIN 번호를 입력하여 포트폴리오를 불러오세요.'
                        : '나만의 간편 비밀번호(PIN)를 설정하여 내 자산을 안전하게 보호하세요.'}
                </p>
            </div>

            {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 mb-6 flex items-start gap-2 text-sm text-red-400">
                    <Info className="w-4 h-4 mt-0.5 shrink-0" />
                    <p>{error}</p>
                </div>
            )}

            {hasExistingPin ? (
                <form onSubmit={handlePinLogin} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">PIN 번호</label>
                        <div className="relative">
                            <input
                                type="password"
                                value={pin}
                                onChange={(e) => setPin(e.target.value)}
                                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all font-mono"
                                placeholder={"••••"}
                                required
                            />
                        </div>
                    </div>

                    <button type="submit" className="w-full mt-6 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-lg shadow-indigo-500/25">
                        잠금 해제
                    </button>

                    <p className="text-center text-xs text-gray-500 mt-4 cursor-pointer hover:text-gray-300 transition-colors" onClick={handleReset}>
                        PIN 번호 초기화
                    </p>
                </form>
            ) : (
                <form onSubmit={handleSetup} className="space-y-4">
                    <div className="pt-2">
                        <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                            <Hash className="w-4 h-4 text-indigo-400" /> 웹 간편 비밀번호 (PIN) 설정
                        </label>
                        <p className="text-xs text-gray-500 mb-3">다음 접속 시 위 비밀번호로 화면 잠금을 해제합니다.</p>
                        <input
                            type="password"
                            value={setupPin}
                            onChange={(e) => setSetupPin(e.target.value)}
                            className="w-full bg-indigo-500/5 border border-indigo-500/20 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-indigo-500/50 focus:bg-indigo-500/10 transition-colors"
                            placeholder="4자리 숫자 권장"
                            required
                        />
                    </div>

                    <button type="submit" className="w-full mt-6 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-lg shadow-indigo-500/25">
                        비밀번호 저장 및 시작
                    </button>

                    <div className="mt-4 p-4 bg-gray-500/5 rounded-xl border border-gray-500/10">
                        <p className="text-xs text-gray-400 flex items-start gap-2">
                            <Info className="w-4 h-4 shrink-0 mt-0.5" />
                            보안 안내: 설정된 비밀번호는 브라우저 내부 로컬에 단방향으로만 저장되며 서버로 전송되지 않습니다. 연동된 증권 계좌 정보는 서버 백엔드를 통해 안전하게 로드됩니다.
                        </p>
                    </div>
                </form>
            )}
        </div>
    );
}
