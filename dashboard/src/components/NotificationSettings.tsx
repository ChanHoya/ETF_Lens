import React, { useState, useEffect } from 'react';
import { Send, Save, Bell, CheckCircle2, AlertTriangle, Loader2, Sliders, MessageSquare, Globe, Briefcase } from 'lucide-react';
import { API_BASE } from '@/lib/apiConfig';

type ChannelType = 'telegram' | 'discord' | 'slack';

export default function NotificationSettings() {
    // 텔레그램 상태
    const [telegramToken, setTelegramToken] = useState('');
    const [telegramChatId, setTelegramChatId] = useState('');
    const [channelTelegram, setChannelTelegram] = useState(true);

    // 디스코드 상태
    const [discordWebhookUrl, setDiscordWebhookUrl] = useState('');
    const [channelDiscord, setChannelDiscord] = useState(false);

    // 슬랙 상태
    const [slackWebhookUrl, setSlackWebhookUrl] = useState('');
    const [channelSlack, setChannelSlack] = useState(false);

    // 활성 채널 탭
    const [activeChannelTab, setActiveChannelTab] = useState<ChannelType>('telegram');

    // 알림 카테고리
    const [alertExitSignal, setAlertExitSignal] = useState(true);
    const [alertRebalance, setAlertRebalance] = useState(true);
    const [alertDailySummary, setAlertDailySummary] = useState(false);
    const [alertBrazil, setAlertBrazil] = useState(true);

    // 괴리율 개인화 알림 설정 (S6-6)
    const [alertDisparity, setAlertDisparity] = useState(true);
    const [disparityThreshold, setDisparityThreshold] = useState(2.0);
    const [disparityTargetScope, setDisparityTargetScope] = useState<'PORTFOLIO' | 'ALL'>('PORTFOLIO');

    // UI 상태
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [testingChannel, setTestingChannel] = useState<ChannelType | null>(null);
    const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

    useEffect(() => {
        const fetchSettings = async () => {
            setIsLoading(true);
            try {
                const localChatId = localStorage.getItem('telegram_chat_id') || '';
                const url = localChatId
                    ? `${API_BASE}/api/v1/notification/settings?chat_id=${encodeURIComponent(localChatId)}`
                    : `${API_BASE}/api/v1/notification/settings`;
                const res = await fetch(url);
                if (res.ok) {
                    const data = await res.json();
                    setTelegramToken(data.telegram_token || '');
                    setTelegramChatId(data.telegram_chat_id || '');
                    setDiscordWebhookUrl(data.discord_webhook_url || '');
                    setSlackWebhookUrl(data.slack_webhook_url || '');
                    
                    setChannelTelegram(data.channel_telegram !== 0);
                    setChannelDiscord(data.channel_discord === 1);
                    setChannelSlack(data.channel_slack === 1);

                    setAlertExitSignal(data.alert_exit_signal !== 0);
                    setAlertRebalance(data.alert_rebalance !== 0);
                    setAlertDailySummary(data.alert_daily_summary === 1);
                    setAlertBrazil(data.alert_brazil !== 0);

                    setAlertDisparity(data.alert_disparity !== 0);
                    const parsedThreshold = data.disparity_threshold ? parseFloat(data.disparity_threshold) : 2.0;
                    setDisparityThreshold(!isNaN(parsedThreshold) && parsedThreshold > 0 ? parsedThreshold : 2.0);
                    setDisparityTargetScope(data.disparity_target_scope === 'ALL' ? 'ALL' : 'PORTFOLIO');
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
                    discord_webhook_url: discordWebhookUrl,
                    slack_webhook_url: slackWebhookUrl,
                    channel_telegram: channelTelegram ? 1 : 0,
                    channel_discord: channelDiscord ? 1 : 0,
                    channel_slack: channelSlack ? 1 : 0,
                    alert_exit_signal: alertExitSignal ? 1 : 0,
                    alert_rebalance: alertRebalance ? 1 : 0,
                    alert_daily_summary: alertDailySummary ? 1 : 0,
                    alert_brazil: alertBrazil ? 1 : 0,
                    alert_disparity: alertDisparity ? 1 : 0,
                    disparity_threshold: disparityThreshold,
                    disparity_target_scope: disparityTargetScope
                })
            });
            const data = await res.json();
            if (res.ok && data.status === 'success') {
                if (telegramChatId) {
                    localStorage.setItem('telegram_chat_id', telegramChatId);
                }
                showToast('success', data.msg || '알림 설정이 성공적으로 저장되었습니다.');
            } else {
                showToast('error', data.detail || '설정 저장에 실패했습니다.');
            }
        } catch (err: any) {
            showToast('error', err.message || '네트워크 오류가 발생했습니다.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleTestChannel = async (channel: ChannelType) => {
        if (channel === 'telegram' && (!telegramToken || !telegramChatId)) {
            showToast('error', '텔레그램 봇 토큰과 Chat ID를 모두 입력해 주세요.');
            return;
        }
        if (channel === 'discord' && !discordWebhookUrl) {
            showToast('error', '디스코드 Webhook URL을 입력해 주세요.');
            return;
        }
        if (channel === 'slack' && !slackWebhookUrl) {
            showToast('error', '슬랙 Incoming Webhook URL을 입력해 주세요.');
            return;
        }

        setTestingChannel(channel);
        try {
            const payload: any = { channel };
            if (channel === 'telegram') {
                payload.telegram_token = telegramToken;
                payload.telegram_chat_id = telegramChatId;
            } else if (channel === 'discord') {
                payload.discord_webhook_url = discordWebhookUrl;
            } else if (channel === 'slack') {
                payload.slack_webhook_url = slackWebhookUrl;
            }

            const res = await fetch(`${API_BASE}/api/v1/notification/test`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (res.ok && data.status === 'success') {
                showToast('success', data.msg || `${channel.toUpperCase()} 테스트 알림 발송 성공!`);
            } else {
                showToast('error', data.detail || `${channel.toUpperCase()} 테스트 발송 실패`);
            }
        } catch (err: any) {
            showToast('error', err.message || '테스트 발송 중 네트워크 오류가 발생했습니다.');
        } finally {
            setTestingChannel(null);
        }
    };

    return (
        <section className="flex flex-col gap-5 mt-6 text-left">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <span className="w-2 h-7 bg-gradient-to-b from-indigo-500 to-purple-500 rounded-full"></span>
                    <div>
                        <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                            실시간 AI 전략 & 괴리율 알림 센터
                            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                S6-6 Multi-Channel
                            </span>
                        </h2>
                        <p className="text-xs text-gray-400 mt-0.5">
                            Telegram, Discord, Slack 멀티채널 연동 및 개인화된 ETF 괴리율 임계치 경보를 설정합니다.
                        </p>
                    </div>
                </div>

                {/* 활성 채널 상태 요약 배지 */}
                <div className="flex items-center gap-2">
                    <div className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 border transition-all ${
                        channelTelegram && telegramChatId 
                            ? 'bg-blue-500/15 border-blue-500/30 text-blue-400' 
                            : 'bg-white/[0.02] border-white/10 text-gray-500'
                    }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${channelTelegram && telegramChatId ? 'bg-blue-400 animate-pulse' : 'bg-gray-600'}`}></span>
                        Telegram
                    </div>
                    <div className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 border transition-all ${
                        channelDiscord && discordWebhookUrl 
                            ? 'bg-indigo-500/15 border-indigo-500/30 text-indigo-400' 
                            : 'bg-white/[0.02] border-white/10 text-gray-500'
                    }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${channelDiscord && discordWebhookUrl ? 'bg-indigo-400 animate-pulse' : 'bg-gray-600'}`}></span>
                        Discord
                    </div>
                    <div className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 border transition-all ${
                        channelSlack && slackWebhookUrl 
                            ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400' 
                            : 'bg-white/[0.02] border-white/10 text-gray-500'
                    }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${channelSlack && slackWebhookUrl ? 'bg-emerald-400 animate-pulse' : 'bg-gray-600'}`}></span>
                        Slack
                    </div>
                </div>
            </div>

            <div className="bg-white/[0.02] border border-white/10 rounded-3xl p-6 lg:p-7 backdrop-blur-xl relative overflow-hidden shadow-2xl">
                {/* 배경 블러 효과 */}
                <div className="absolute -top-24 -right-24 w-80 h-80 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none"></div>
                <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-purple-600/10 rounded-full blur-3xl pointer-events-none"></div>

                {isLoading ? (
                    <div className="flex flex-col items-center justify-center p-16 gap-3">
                        <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
                        <span className="text-xs text-gray-400">알림 설정 불러오는 중...</span>
                    </div>
                ) : (
                    <form onSubmit={handleSave} className="flex flex-col gap-8 relative z-10">
                        {/* 2-Column Layout */}
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                            {/* 왼쪽: 알림 카테고리 & 괴리율 개인화 임계치 설정 (7 cols) */}
                            <div className="lg:col-span-7 flex flex-col gap-5">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-bold text-gray-200 flex items-center gap-2">
                                        <Bell className="w-4 h-4 text-indigo-400" />
                                        알림 발생 조건 및 개인화 설정
                                    </h3>
                                    <span className="text-[11px] text-gray-500">실시간 필터링 적용</span>
                                </div>

                                {/* [신규] ETF 괴리율 실시간 경보 카드 (Bento 강조) */}
                                <div className={`p-4 sm:p-5 rounded-2xl border transition-all ${
                                    alertDisparity 
                                        ? 'bg-gradient-to-br from-amber-500/10 via-purple-500/5 to-transparent border-amber-500/30 shadow-lg shadow-amber-500/5' 
                                        : 'bg-white/[0.02] border-white/5 opacity-70'
                                }`}>
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
                                                <Sliders className="w-3.5 h-3.5" />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h4 className="text-sm font-bold text-white">ETF 실시간 괴리율(NAV 차이) 경보</h4>
                                                    <span className="text-[10px] px-2 py-0.5 rounded-md font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                                        ±{(typeof disparityThreshold === 'number' && !isNaN(disparityThreshold) ? disparityThreshold : 2.0).toFixed(1)}% 기준
                                                    </span>
                                                </div>
                                                <p className="text-[11px] text-gray-400 mt-0.5">
                                                    시장가격과 순자산가치(NAV) 괴리율이 임계치를 벗어나면 즉시 경보를 발송합니다.
                                                </p>
                                            </div>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-3">
                                            <input
                                                type="checkbox"
                                                checked={alertDisparity}
                                                onChange={(e) => setAlertDisparity(e.target.checked)}
                                                className="sr-only peer"
                                            />
                                            <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gray-300 after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                                        </label>
                                    </div>

                                    {/* 슬라이더 및 범위 설정 (알림 켜졌을 때만 활성화) */}
                                    {alertDisparity && (
                                        <div className="mt-4 pt-4 border-t border-white/10 flex flex-col gap-4">
                                            {/* 임계치 슬라이더 */}
                                            <div className="flex flex-col gap-2">
                                                <div className="flex items-center justify-between text-xs">
                                                    <span className="text-gray-300 font-medium">괴리율 절대값 임계치 (Threshold)</span>
                                                    <span className="font-mono font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                                                        ±{(typeof disparityThreshold === 'number' && !isNaN(disparityThreshold) ? disparityThreshold : 2.0).toFixed(1)}% 이상
                                                    </span>
                                                </div>
                                                <input
                                                    type="range"
                                                    min="0.5"
                                                    max="5.0"
                                                    step="0.1"
                                                    value={typeof disparityThreshold === 'number' && !isNaN(disparityThreshold) ? disparityThreshold : 2.0}
                                                    onChange={(e) => {
                                                        const val = parseFloat(e.target.value);
                                                        setDisparityThreshold(!isNaN(val) ? val : 2.0);
                                                    }}
                                                    className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-amber-500 focus:outline-none"
                                                />
                                                {/* 슬라이더 프리셋 칩 */}
                                                <div className="flex items-center justify-between gap-1.5 mt-1">
                                                    {[
                                                        { val: 1.0, label: '±1.0% (민감)' },
                                                        { val: 1.5, label: '±1.5%' },
                                                        { val: 2.0, label: '±2.0% (표준)' },
                                                        { val: 3.0, label: '±3.0% (급등락)' },
                                                    ].map((preset) => (
                                                        <button
                                                            key={preset.val}
                                                            type="button"
                                                            onClick={() => setDisparityThreshold(preset.val)}
                                                            className={`flex-1 py-1 text-[10px] font-medium rounded-lg border transition-all ${
                                                                (typeof disparityThreshold === 'number' && !isNaN(disparityThreshold) ? disparityThreshold : 2.0) === preset.val
                                                                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold'
                                                                    : 'bg-white/[0.02] text-gray-400 border-white/5 hover:border-white/20'
                                                            }`}
                                                        >
                                                            {preset.label}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* 감시 대상 범위 (Target Scope) */}
                                            <div className="flex flex-col gap-2 pt-2">
                                                <span className="text-xs text-gray-300 font-medium">경보 대상 ETF 범위</span>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => setDisparityTargetScope('PORTFOLIO')}
                                                        className={`p-2.5 rounded-xl border text-left flex items-start gap-2 transition-all ${
                                                            disparityTargetScope === 'PORTFOLIO'
                                                                ? 'bg-indigo-600/20 border-indigo-500/50 text-white'
                                                                : 'bg-white/[0.02] border-white/5 text-gray-400 hover:border-white/15'
                                                        }`}
                                                    >
                                                        <Briefcase className={`w-4 h-4 mt-0.5 shrink-0 ${disparityTargetScope === 'PORTFOLIO' ? 'text-indigo-400' : 'text-gray-500'}`} />
                                                        <div>
                                                            <div className="text-xs font-bold text-gray-200">내 보유 / 관심 종목</div>
                                                            <div className="text-[10px] text-gray-400">포트폴리오 종목 한정 (노이즈 방지)</div>
                                                        </div>
                                                    </button>

                                                    <button
                                                        type="button"
                                                        onClick={() => setDisparityTargetScope('ALL')}
                                                        className={`p-2.5 rounded-xl border text-left flex items-start gap-2 transition-all ${
                                                            disparityTargetScope === 'ALL'
                                                                ? 'bg-purple-600/20 border-purple-500/50 text-white'
                                                                : 'bg-white/[0.02] border-white/5 text-gray-400 hover:border-white/15'
                                                        }`}
                                                    >
                                                        <Globe className={`w-4 h-4 mt-0.5 shrink-0 ${disparityTargetScope === 'ALL' ? 'text-purple-400' : 'text-gray-500'}`} />
                                                        <div>
                                                            <div className="text-xs font-bold text-gray-200">전체 시장 ETF</div>
                                                            <div className="text-[10px] text-gray-400">국내 상장 ETF 전수 감시</div>
                                                        </div>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* 기존 알림 토글 리스트 */}
                                <div className="flex flex-col gap-2.5">
                                    <div className="flex items-center justify-between p-3.5 bg-white/[0.02] border border-white/5 rounded-2xl hover:border-white/10 transition-colors">
                                        <div>
                                            <h4 className="text-xs sm:text-sm font-bold text-gray-200">손절 및 이탈 (Exit) 시그널</h4>
                                            <p className="text-[11px] text-gray-400 mt-0.5">보유 ETF 20일선 붕괴 등 손절 기준 도달 시 즉각 발송</p>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer ml-3">
                                            <input
                                                type="checkbox"
                                                checked={alertExitSignal}
                                                onChange={(e) => setAlertExitSignal(e.target.checked)}
                                                className="sr-only peer"
                                            />
                                            <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gray-300 after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                                        </label>
                                    </div>

                                    <div className="flex items-center justify-between p-3.5 bg-white/[0.02] border border-white/5 rounded-2xl hover:border-white/10 transition-colors">
                                        <div>
                                            <h4 className="text-xs sm:text-sm font-bold text-gray-200">AI 포트폴리오 리밸런싱 추천</h4>
                                            <p className="text-[11px] text-gray-400 mt-0.5">자산 비중 재조정 제안 및 교체 추천 종목 도출 시 전송</p>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer ml-3">
                                            <input
                                                type="checkbox"
                                                checked={alertRebalance}
                                                onChange={(e) => setAlertRebalance(e.target.checked)}
                                                className="sr-only peer"
                                            />
                                            <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gray-300 after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                                        </label>
                                    </div>

                                    <div className="flex items-center justify-between p-3.5 bg-white/[0.02] border border-white/5 rounded-2xl hover:border-white/10 transition-colors">
                                        <div>
                                            <h4 className="text-xs sm:text-sm font-bold text-gray-200">일일 모닝 포트폴리오 브리핑</h4>
                                            <p className="text-[11px] text-gray-400 mt-0.5">개장 전 보유 자산 현황 및 글로벌 마켓 핵심 요약 수신</p>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer ml-3">
                                            <input
                                                type="checkbox"
                                                checked={alertDailySummary}
                                                onChange={(e) => setAlertDailySummary(e.target.checked)}
                                                className="sr-only peer"
                                            />
                                            <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gray-300 after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                                        </label>
                                    </div>

                                    <div className="flex items-center justify-between p-3.5 bg-white/[0.02] border border-emerald-500/15 rounded-2xl hover:border-emerald-500/30 transition-colors">
                                        <div>
                                            <h4 className="text-xs sm:text-sm font-bold text-gray-200">🇧🇷 브라질 국채 이벤트·신호·뉴스</h4>
                                            <p className="text-[11px] text-gray-400 mt-0.5">Activation Zone 전환, Copom 및 대선 D-day 주요 정세 알림</p>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer ml-3">
                                            <input
                                                type="checkbox"
                                                checked={alertBrazil}
                                                onChange={(e) => setAlertBrazil(e.target.checked)}
                                                className="sr-only peer"
                                            />
                                            <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gray-300 after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            {/* 오른쪽: 멀티 채널 연동 탭 & 웹훅 설정 (5 cols) */}
                            <div className="lg:col-span-5 flex flex-col justify-between gap-5 bg-black/20 p-5 rounded-2xl border border-white/5">
                                <div className="flex flex-col gap-4">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-sm font-bold text-gray-200 flex items-center gap-2">
                                            <MessageSquare className="w-4 h-4 text-indigo-400" />
                                            수신 채널 연동
                                        </h3>
                                        <span className="text-[10px] text-gray-500">동시 발송 가능</span>
                                    </div>

                                    {/* 3대 채널 선택 탭 */}
                                    <div className="flex items-center p-1 bg-white/[0.03] border border-white/10 rounded-xl gap-1">
                                        <button
                                            type="button"
                                            onClick={() => setActiveChannelTab('telegram')}
                                            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                                                activeChannelTab === 'telegram'
                                                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                                                    : 'text-gray-400 hover:text-gray-200'
                                            }`}
                                        >
                                            <span>Telegram</span>
                                            {channelTelegram && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>}
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => setActiveChannelTab('discord')}
                                            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                                                activeChannelTab === 'discord'
                                                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                                                    : 'text-gray-400 hover:text-gray-200'
                                            }`}
                                        >
                                            <span>Discord</span>
                                            {channelDiscord && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>}
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => setActiveChannelTab('slack')}
                                            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                                                activeChannelTab === 'slack'
                                                    ? 'bg-emerald-700 text-white shadow-md shadow-emerald-700/30'
                                                    : 'text-gray-400 hover:text-gray-200'
                                            }`}
                                        >
                                            <span>Slack</span>
                                            {channelSlack && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>}
                                        </button>
                                    </div>

                                    {/* 1. 텔레그램 탭 뷰 */}
                                    {activeChannelTab === 'telegram' && (
                                        <div className="flex flex-col gap-3.5 animate-in fade-in duration-200">
                                            <div className="flex items-center justify-between p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                                                <div>
                                                    <span className="text-xs font-bold text-blue-300">Telegram 알림 발송</span>
                                                    <p className="text-[10px] text-gray-400 mt-0.5">이 채널로의 메시지 수신을 활성화합니다.</p>
                                                </div>
                                                <label className="relative inline-flex items-center cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={channelTelegram}
                                                        onChange={(e) => setChannelTelegram(e.target.checked)}
                                                        className="sr-only peer"
                                                    />
                                                    <div className="w-9 h-5 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gray-300 after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                                                </label>
                                            </div>

                                            <div className="flex flex-col gap-1">
                                                <label className="text-[11px] font-bold text-gray-400">Telegram Bot Token</label>
                                                <input
                                                    type="text"
                                                    value={telegramToken}
                                                    onChange={(e) => setTelegramToken(e.target.value)}
                                                    placeholder="예: 123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
                                                    className="bg-black/50 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 font-mono transition-colors"
                                                />
                                            </div>

                                            <div className="flex flex-col gap-1">
                                                <label className="text-[11px] font-bold text-gray-400">수신자 Chat ID</label>
                                                <input
                                                    type="text"
                                                    value={telegramChatId}
                                                    onChange={(e) => setTelegramChatId(e.target.value)}
                                                    placeholder="예: 987654321 (@userinfobot 확인)"
                                                    className="bg-black/50 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 font-mono transition-colors"
                                                />
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() => handleTestChannel('telegram')}
                                                disabled={testingChannel !== null || isLoading}
                                                className="w-full mt-1 flex items-center justify-center gap-1.5 py-2.5 px-3 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-xs font-semibold text-blue-300 rounded-xl transition-all disabled:opacity-50"
                                            >
                                                {testingChannel === 'telegram' ? (
                                                    <>
                                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                        텔레그램 발송 중...
                                                    </>
                                                ) : (
                                                    <>
                                                        <Send className="w-3.5 h-3.5" />
                                                        Telegram 즉시 테스트 발송
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    )}

                                    {/* 2. 디스코드 탭 뷰 */}
                                    {activeChannelTab === 'discord' && (
                                        <div className="flex flex-col gap-3.5 animate-in fade-in duration-200">
                                            <div className="flex items-center justify-between p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl">
                                                <div>
                                                    <span className="text-xs font-bold text-indigo-300">Discord 알림 발송</span>
                                                    <p className="text-[10px] text-gray-400 mt-0.5">디스코드 웹훅 채널로 실시간 알림을 수신합니다.</p>
                                                </div>
                                                <label className="relative inline-flex items-center cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={channelDiscord}
                                                        onChange={(e) => setChannelDiscord(e.target.checked)}
                                                        className="sr-only peer"
                                                    />
                                                    <div className="w-9 h-5 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gray-300 after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                                                </label>
                                            </div>

                                            <div className="flex flex-col gap-1">
                                                <label className="text-[11px] font-bold text-gray-400">Discord Webhook URL</label>
                                                <input
                                                    type="text"
                                                    value={discordWebhookUrl}
                                                    onChange={(e) => setDiscordWebhookUrl(e.target.value)}
                                                    placeholder="https://discord.com/api/webhooks/..."
                                                    className="bg-black/50 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 font-mono transition-colors"
                                                />
                                                <span className="text-[10px] text-gray-500 mt-0.5">
                                                    디스코드 채널 설정 &gt; 연동 &gt; 웹후크 만들기에서 생성한 URL
                                                </span>
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() => handleTestChannel('discord')}
                                                disabled={testingChannel !== null || isLoading}
                                                className="w-full mt-1 flex items-center justify-center gap-1.5 py-2.5 px-3 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-xs font-semibold text-indigo-300 rounded-xl transition-all disabled:opacity-50"
                                            >
                                                {testingChannel === 'discord' ? (
                                                    <>
                                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                        디스코드 발송 중...
                                                    </>
                                                ) : (
                                                    <>
                                                        <Send className="w-3.5 h-3.5" />
                                                        Discord 즉시 테스트 발송
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    )}

                                    {/* 3. 슬랙 탭 뷰 */}
                                    {activeChannelTab === 'slack' && (
                                        <div className="flex flex-col gap-3.5 animate-in fade-in duration-200">
                                            <div className="flex items-center justify-between p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                                                <div>
                                                    <span className="text-xs font-bold text-emerald-300">Slack 알림 발송</span>
                                                    <p className="text-[10px] text-gray-400 mt-0.5">슬랙 Incoming Webhook 채널로 알림을 수신합니다.</p>
                                                </div>
                                                <label className="relative inline-flex items-center cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={channelSlack}
                                                        onChange={(e) => setChannelSlack(e.target.checked)}
                                                        className="sr-only peer"
                                                    />
                                                    <div className="w-9 h-5 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gray-300 after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                                                </label>
                                            </div>

                                            <div className="flex flex-col gap-1">
                                                <label className="text-[11px] font-bold text-gray-400">Slack Incoming Webhook URL</label>
                                                <input
                                                    type="text"
                                                    value={slackWebhookUrl}
                                                    onChange={(e) => setSlackWebhookUrl(e.target.value)}
                                                    placeholder="https://hooks.slack.com/services/..."
                                                    className="bg-black/50 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500 font-mono transition-colors"
                                                />
                                                <span className="text-[10px] text-gray-500 mt-0.5">
                                                    Slack App &gt; Incoming Webhooks 활성화 후 발급된 Webhook URL
                                                </span>
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() => handleTestChannel('slack')}
                                                disabled={testingChannel !== null || isLoading}
                                                className="w-full mt-1 flex items-center justify-center gap-1.5 py-2.5 px-3 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-xs font-semibold text-emerald-300 rounded-xl transition-all disabled:opacity-50"
                                            >
                                                {testingChannel === 'slack' ? (
                                                    <>
                                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                        슬랙 발송 중...
                                                    </>
                                                ) : (
                                                    <>
                                                        <Send className="w-3.5 h-3.5" />
                                                        Slack 즉시 테스트 발송
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* 토스트 알림 메시지 */}
                                {toast && (
                                    <div className={`p-3.5 rounded-xl text-xs font-medium flex items-center gap-2 border animate-in fade-in duration-300 ${
                                        toast.type === 'success' 
                                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                                            : 'bg-red-500/10 text-red-400 border-red-500/20'
                                    }`}>
                                        {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
                                        <span className="break-all">{toast.msg}</span>
                                    </div>
                                )}

                                {/* 전체 설정 저장 버튼 */}
                                <button
                                    type="submit"
                                    disabled={isSaving || isLoading}
                                    className="w-full flex items-center justify-center gap-2 px-5 py-3.5 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs sm:text-sm font-bold rounded-xl shadow-lg shadow-indigo-600/30 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
                                >
                                    {isSaving ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            설정 저장 중...
                                        </>
                                    ) : (
                                        <>
                                            <Save className="w-4 h-4" />
                                            모든 알림 및 웹훅 설정 저장
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </form>
                )}
            </div>
        </section>
    );
}
