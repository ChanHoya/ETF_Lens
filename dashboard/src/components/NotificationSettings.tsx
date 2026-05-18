import React, { useState, useEffect } from 'react';
import { Send, Save, Bell, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { API_BASE } from '@/lib/apiConfig';

export default function NotificationSettings() {
    const [telegramToken, setTelegramToken] = useState('');
    const [telegramChatId, setTelegramChatId] = useState('');
    const [alertExitSignal, setAlertExitSignal] = useState(true);
    const [alertRebalance, setAlertRebalance] = useState(true);
    const [alertDailySummary, setAlertDailySummary] = useState(false);

    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isTesting, setIsTesting] = useState(false);
    const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

    useEffect(() => {
        const fetchSettings = async () => {
            setIsLoading(true);
            try {
                const res = await fetch(`${API_BASE}/api/v1/notification/settings`);
                if (res.ok) {
                    const data = await res.json();
                    setTelegramToken(data.telegram_token || '');
                    setTelegramChatId(data.telegram_chat_id || '');
                    setAlertExitSignal(data.alert_exit_signal === 1);
                    setAlertRebalance(data.alert_rebalance === 1);
                    setAlertDailySummary(data.alert_daily_summary === 1);
                }
            } catch (err) {
                console.error("Failed to fetch notification settings:", err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchSettings();
    }, []);

    const showToast = (type: 'success' | 'error', msg: string) => {
        setToast({ type, msg });
        setTimeout(() => setToast(null), 5000);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            const res = await fetch(`${API_BASE}/api/v1/notification/settings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    telegram_token: telegramToken,
                    telegram_chat_id: telegramChatId,
                    alert_exit_signal: alertExitSignal ? 1 : 0,
                    alert_rebalance: alertRebalance ? 1 : 0,
                    alert_daily_summary: alertDailySummary ? 1 : 0
                })
            });
            const data = await res.json();
            if (res.ok && data.status === 'success') {
                showToast('success', data.msg || '설정이 저장되었습니다.');
            } else {
                showToast('error', data.detail || '설정 저장에 실패했습니다.');
            }
        } catch (err: any) {
            showToast('error', err.message || '네트워크 오류가 발생했습니다.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleTest = async () => {
        if (!telegramToken || !telegramChatId) {
            showToast('error', '봇 토큰과 Chat ID를 모두 입력해 주세요.');
            return;
        }
        setIsTesting(true);
        try {
            const res = await fetch(`${API_BASE}/api/v1/notification/test`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    telegram_token: telegramToken,
                    telegram_chat_id: telegramChatId
                })
            });
            const data = await res.json();
            if (res.ok && data.status === 'success') {
                showToast('success', data.msg);
            } else {
                showToast('error', data.detail || '테스트 메시지 발송 실패');
            }
        } catch (err: any) {
            showToast('error', err.message || '네트워크 오류가 발생했습니다.');
        } finally {
            setIsTesting(false);
        }
    };

    return (
        <section className="flex flex-col gap-4 mt-4 text-left">
            <h2 className="text-2xl font-bold flex items-center gap-3">
                <span className="w-1.5 h-6 bg-indigo-500 rounded-full"></span>
                실시간 AI 전략 알림 설정
            </h2>

            <div className="bg-white/[0.02] border border-white/10 rounded-3xl p-6 backdrop-blur-md relative overflow-hidden">
                {/* Background subtle glowing effect */}
                <div className="absolute -top-20 -right-20 w-60 h-60 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>

                <div className="flex flex-col lg:flex-row gap-8 relative z-10">
                    {/* Left: Info & Toggles */}
                    <div className="flex-1 flex flex-col gap-6">
                        <div>
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                <Bell className="w-5 h-5 text-indigo-400" />
                                텔레그램 실시간 인텔리전스 채널 연동
                            </h3>
                            <p className="text-xs text-gray-400 mt-1">
                                포트폴리오에 급격한 마켓 변화가 감지되거나 AI 자산 조정 의견이 생성될 때 
                                사용자의 텔레그램 메신저로 실시간 세부 브리핑 알림을 송신합니다.
                            </p>
                        </div>

                        {isLoading ? (
                            <div className="flex items-center justify-center p-12">
                                <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
                            </div>
                        ) : (
                            <div className="flex flex-col gap-4">
                                <div className="flex items-center justify-between p-4 bg-white/[0.02] border border-white/5 rounded-2xl">
                                    <div>
                                        <h4 className="text-sm font-bold text-gray-200">손절 및 이탈 (Exit) 시그널 발생 시 알림</h4>
                                        <p className="text-[11px] text-gray-400 mt-0.5">보유 ETF의 20일선 붕괴 등 손절 기준 충족 시 즉각 알림을 발송합니다.</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={alertExitSignal}
                                            onChange={(e) => setAlertExitSignal(e.target.checked)}
                                            className="sr-only peer"
                                        />
                                        <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gray-300 after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                                    </label>
                                </div>

                                <div className="flex items-center justify-between p-4 bg-white/[0.02] border border-white/5 rounded-2xl">
                                    <div>
                                        <h4 className="text-sm font-bold text-gray-200">AI 포트폴리오 리밸런싱 추천 알림</h4>
                                        <p className="text-[11px] text-gray-400 mt-0.5">자산 리밸런싱 제안 및 교체 추천 종목 도출 완료 시 전송합니다.</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={alertRebalance}
                                            onChange={(e) => setAlertRebalance(e.target.checked)}
                                            className="sr-only peer"
                                        />
                                        <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gray-300 after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                                    </label>
                                </div>

                                <div className="flex items-center justify-between p-4 bg-white/[0.02] border border-white/5 rounded-2xl">
                                    <div>
                                        <h4 className="text-sm font-bold text-gray-200">일일 모닝 포트폴리오 요약 브리핑</h4>
                                        <p className="text-[11px] text-gray-400 mt-0.5">매일 아침 개장 전 보유 자산 현황 및 마켓 핵심 브리핑 요약을 수신합니다.</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={alertDailySummary}
                                            onChange={(e) => setAlertDailySummary(e.target.checked)}
                                            className="sr-only peer"
                                        />
                                        <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gray-300 after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                                    </label>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right: Input Form */}
                    <form onSubmit={handleSave} className="flex-1 flex flex-col gap-5 justify-between">
                        <div className="flex flex-col gap-4">
                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-bold text-gray-400">텔레그램 봇 토큰 (Telegram Bot Token)</label>
                                <input
                                    type="text"
                                    value={telegramToken}
                                    onChange={(e) => setTelegramToken(e.target.value)}
                                    placeholder="e.g. 123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
                                    className="bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 font-mono transition-colors"
                                />
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-bold text-gray-400">텔레그램 수신자 Chat ID (Chat ID)</label>
                                <input
                                    type="text"
                                    value={telegramChatId}
                                    onChange={(e) => setTelegramChatId(e.target.value)}
                                    placeholder="e.g. 987654321"
                                    className="bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 font-mono transition-colors"
                                />
                            </div>
                        </div>

                        {toast && (
                            <div className={`p-4 rounded-xl text-xs font-semibold flex items-center gap-2 border animate-in fade-in duration-300 ${
                                toast.type === 'success' 
                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                                    : 'bg-red-500/10 text-red-400 border-red-500/20'
                            }`}>
                                {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                                <span>{toast.msg}</span>
                            </div>
                        )}

                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={handleTest}
                                disabled={isTesting || isLoading}
                                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-3 bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-xs font-bold text-gray-300 rounded-xl transition-all disabled:opacity-50"
                            >
                                {isTesting ? (
                                    <>
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        테스트 전송 중...
                                    </>
                                ) : (
                                    <>
                                        <Send className="w-3.5 h-3.5" />
                                        테스트 알림 전송
                                    </>
                                )}
                            </button>

                            <button
                                type="submit"
                                disabled={isSaving || isLoading}
                                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-500/20 transition-all hover:scale-102 disabled:opacity-50"
                            >
                                {isSaving ? (
                                    <>
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        저장 중...
                                    </>
                                ) : (
                                    <>
                                        <Save className="w-3.5 h-3.5" />
                                        알림 설정 저장
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </section>
    );
}
