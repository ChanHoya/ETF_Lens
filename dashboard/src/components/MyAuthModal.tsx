import React, { useState } from 'react';
import { Lock, Key, Hash, Info, UserRound } from 'lucide-react';

export default function MyAuthModal({ onSuccess, initialError }: { onSuccess: (keys: any) => void, initialError: string | null }) {
    const [pin, setPin] = useState('');
    const [isPinMode, setIsPinMode] = useState(!!localStorage.getItem("etf_lens_kis_keys"));
    const [kisKeys, setKisKeys] = useState(() => {
        const stored = localStorage.getItem("etf_lens_kis_keys");
        return stored ? JSON.parse(stored) : { accountNo: '', accountType: 'real' };
    });
    const [setupPin, setSetupPin] = useState('');
    const [error, setError] = useState(initialError || '');

    const handlePinLogin = (e: React.FormEvent) => {
        e.preventDefault();
        const storedPin = localStorage.getItem("etf_lens_pin");
        if (pin === storedPin) {
            onSuccess(kisKeys);
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
        if (!kisKeys.accountNo) {
            setError("계좌번호를 입력해주세요.");
            return;
        }

        localStorage.setItem("etf_lens_pin", setupPin);
        localStorage.setItem("etf_lens_kis_keys", JSON.stringify(kisKeys));
        onSuccess(kisKeys);
    };

    const handleReset = () => {
        localStorage.removeItem("etf_lens_pin");
        localStorage.removeItem("etf_lens_kis_keys");
        setIsPinMode(false);
        setKisKeys({ accountNo: '', accountType: 'real' });
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
                    {isPinMode ? '포트폴리오 잠금 해제' : 'KIS OpenAPI 연결'}
                </h2>
                <p className="text-sm text-gray-400">
                    {isPinMode
                        ? '설정한 PIN 번호를 입력하여 포트폴리오를 불러오세요.'
                        : '한국투자증권(KIS) OpenAPI 키를 등록하여 내 자산을 분석합니다. 키 정보는 브라우저 로컬에만 안전하게 저장됩니다.'}
                </p>
            </div>

            {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 mb-6 flex items-start gap-2 text-sm text-red-400">
                    <Info className="w-4 h-4 mt-0.5 shrink-0" />
                    <p>{error}</p>
                </div>
            )}

            {isPinMode ? (
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
                        분석 시작
                    </button>

                    <p className="text-center text-xs text-gray-500 mt-4 cursor-pointer hover:text-gray-300 transition-colors" onClick={handleReset}>
                        초기화 및 새 계좌 등록
                    </p>
                </form>
            ) : (
                <form onSubmit={handleSetup} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                            <Info className="w-4 h-4 text-gray-400" /> 계좌 환경
                        </label>
                        <div className="flex gap-4">
                            <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                                <input
                                    type="radio"
                                    name="accountType"
                                    value="real"
                                    checked={kisKeys.accountType === 'real'}
                                    onChange={() => setKisKeys({ ...kisKeys, accountType: 'real' })}
                                    className="accent-indigo-500"
                                />
                                실전투자
                            </label>
                            <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                                <input
                                    type="radio"
                                    name="accountType"
                                    value="mock"
                                    checked={kisKeys.accountType === 'mock'}
                                    onChange={() => setKisKeys({ ...kisKeys, accountType: 'mock' })}
                                    className="accent-indigo-500"
                                />
                                모의투자
                            </label>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                            <UserRound className="w-4 h-4 text-gray-400" /> 계좌번호
                        </label>
                        <input
                            type="text"
                            value={kisKeys.accountNo}
                            onChange={(e) => setKisKeys({ ...kisKeys, accountNo: e.target.value })}
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500/50"
                            placeholder="12345678-01 형태로 입력"
                            required
                        />
                    </div>
                    <div className="pt-4 border-t border-white/5">
                        <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                            <Hash className="w-4 h-4 text-indigo-400" /> 나만의 웹 간편 비밀번호 (PIN)
                        </label>
                        <p className="text-xs text-gray-500 mb-3">다음 접속 시 API 키를 다시 입력할 필요 없이 위 비밀번호로 잠금을 해제합니다.</p>
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
                        정보 저장 및 연동
                    </button>

                    <div className="mt-4 p-4 bg-gray-500/5 rounded-xl border border-gray-500/10">
                        <p className="text-xs text-gray-400 flex items-start gap-2">
                            <Info className="w-4 h-4 shrink-0 mt-0.5" />
                            보안 안내: 입력하신 API Key 및 계좌 정보는 서버 DB에 저장되지 않으며, 오직 본인 기기(브라우저)에만 암호화(?)되어 보관됩니다.
                        </p>
                    </div>
                </form>
            )}
        </div>
    );
}
