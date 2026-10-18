'use client';

import React, { useEffect, useState } from 'react';
import { 
    Radar, ShieldAlert, ArrowRightLeft, TrendingUp, TrendingDown, 
    Percent, HelpCircle, CheckCircle2, ChevronRight, Sparkles, RefreshCw, AlertCircle
} from 'lucide-react';
import { API_BASE } from '@/lib/apiConfig';

interface TimingData {
    status: string;
    timestamp: string;
    usd_krw: {
        rate: number;
        overheat_score: number;
        level: string;
        signal: string;
        recommendation: string;
        action_plan: string;
        reer_percentile: number;
        fair_gap_pct: number;
        target_hedge_ratio: number;
    };
    brl_krw: {
        rate: number;
        usd_brl: number;
        undervalued_score: number;
        level: string;
        signal: string;
        recommendation: string;
        action_plan: string;
        historical_percentile: number;
        carry_margin_bp: number;
        split_tranche_guide: string[];
    };
    macro_summary: {
        title: string;
        verdict: string;
        key_takeaway: string;
    };
}

export default function FxTimingRadarWidget() {
    const [data, setData] = useState<TimingData | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`${API_BASE}/api/v1/fx/timing-index`);
            if (!res.ok) throw new Error('환율 타이밍 지수를 불러오는데 실패했습니다.');
            const json = await res.json();
            setData(json);
        } catch (err: any) {
            setError(err.message || '네트워크 오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    if (loading && !data) {
        return (
            <div className="bg-slate-900/60 border border-slate-700/60 rounded-2xl p-6 text-center animate-pulse">
                <Radar className="w-8 h-8 text-indigo-400 mx-auto mb-2 animate-spin" />
                <p className="text-sm text-gray-400">실시간 환전 타이밍 및 환헤지(H) 스위칭 레이더 분석 중...</p>
            </div>
        );
    }

    if (error && !data) {
        return (
            <div className="bg-slate-900/60 border border-red-500/30 rounded-2xl p-6 text-center">
                <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
                <p className="text-sm text-red-400">{error}</p>
                <button 
                    onClick={fetchData}
                    className="mt-3 px-3 py-1.5 bg-slate-800 text-xs text-gray-200 rounded-lg hover:bg-slate-700 inline-flex items-center gap-1.5"
                >
                    <RefreshCw className="w-3.5 h-3.5" /> 다시 시도
                </button>
            </div>
        );
    }

    if (!data) return null;

    const usd = data.usd_krw;
    const brl = data.brl_krw;

    return (
        <section className="bg-gradient-to-br from-slate-900/90 via-indigo-950/20 to-slate-900/90 border border-indigo-500/20 rounded-2xl p-5 shadow-2xl relative overflow-hidden backdrop-blur-md">
            {/* 상단 헤더 */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-white/10">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
                        <Radar className="w-5 h-5 animate-pulse" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-lg font-bold text-white flex items-center gap-1.5">
                                실시간 환전 타이밍 & 환헤지(H) 스위칭 레이더
                                <span className="text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 px-2 py-0.5 rounded-full font-semibold">
                                    Sprint 29 LIVE
                                </span>
                            </h3>
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">
                            원/달러 과열도 기반 환헤지 전환 비율 제안 & 원/헤알 캐리마진 기반 분할 환전 진입 지수
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <span className="text-[11px] text-gray-400">
                        기준: {new Date(data.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <button
                        onClick={fetchData}
                        disabled={loading}
                        className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 disabled:opacity-50 transition-colors"
                        title="새로고침"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* 매크로 전략 요약 배너 */}
            <div className="my-4 p-3.5 rounded-xl bg-indigo-950/40 border border-indigo-500/30 flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                    <div className="font-bold text-indigo-200">
                        {data.macro_summary.verdict}
                    </div>
                    <div className="text-gray-300 leading-relaxed">
                        {data.macro_summary.key_takeaway}
                    </div>
                </div>
            </div>

            {/* 2대 핵심 레이더 그리드 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* 1. 원/달러 (USD/KRW) 환헤지 스위칭 레이더 */}
                <div className="bg-slate-900/70 border border-slate-700/60 rounded-xl p-4 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-semibold text-gray-400 flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-rose-400 animate-ping" />
                                원/달러 (USD/KRW) 과열도 분석
                            </span>
                            <span className="text-xs font-extrabold px-2.5 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40">
                                {usd.signal}
                            </span>
                        </div>

                        <div className="flex items-baseline gap-2 mb-3">
                            <span className="text-3xl font-extrabold text-white">
                                {usd.rate.toLocaleString('ko-KR')}
                            </span>
                            <span className="text-sm font-semibold text-gray-400">원</span>
                            <span className="text-xs font-bold text-rose-400 ml-auto">
                                과열도 {usd.overheat_score}점 ({usd.level})
                            </span>
                        </div>

                        {/* 과열도 프로그레스 게이지 */}
                        <div className="space-y-1 mb-4">
                            <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
                                <div 
                                    className="bg-gradient-to-r from-emerald-500 via-amber-500 to-rose-500 h-2.5 rounded-full transition-all duration-500"
                                    style={{ width: `${usd.overheat_score}%` }}
                                />
                            </div>
                            <div className="flex justify-between text-[10px] text-gray-500">
                                <span>저평가 (환노출)</span>
                                <span>적정 (1,300원)</span>
                                <span className="text-rose-400 font-bold">고평가 ({usd.rate}원)</span>
                            </div>
                        </div>

                        {/* 통계 메트릭 */}
                        <div className="grid grid-cols-2 gap-2 text-xs mb-3 bg-black/20 p-2.5 rounded-lg border border-white/5">
                            <div>
                                <span className="text-gray-400 block text-[11px]">5년 REER 백분위</span>
                                <span className="font-bold text-gray-200">{usd.reer_percentile}% (상단 과열)</span>
                            </div>
                            <div>
                                <span className="text-gray-400 block text-[11px]">권장 환헤지(H) 비중</span>
                                <span className="font-extrabold text-indigo-300">{usd.target_hedge_ratio}% 헤지 권고</span>
                            </div>
                        </div>

                        {/* 권고사항 */}
                        <div className="text-xs text-gray-300 bg-rose-950/20 border border-rose-500/20 p-2.5 rounded-lg space-y-1">
                            <div className="font-bold text-rose-300 flex items-center gap-1">
                                <ShieldAlert className="w-3.5 h-3.5" /> 스위칭 실행 가이드
                            </div>
                            <p className="leading-relaxed text-[11px] text-gray-300">
                                {usd.recommendation}
                            </p>
                        </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs">
                        <span className="text-gray-400">행동 지침:</span>
                        <span className="font-bold text-rose-400">{usd.action_plan}</span>
                    </div>
                </div>

                {/* 2. 원/헤알 (BRL/KRW) 분할 환전 진입 레이더 */}
                <div className="bg-slate-900/70 border border-slate-700/60 rounded-xl p-4 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-semibold text-gray-400 flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                                원/헤알 (BRL/KRW) 저평가·캐리 분석
                            </span>
                            <span className="text-xs font-extrabold px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                                {brl.signal}
                            </span>
                        </div>

                        <div className="flex items-baseline gap-2 mb-3">
                            <span className="text-3xl font-extrabold text-white">
                                {brl.rate.toLocaleString('ko-KR')}
                            </span>
                            <span className="text-sm font-semibold text-gray-400">원</span>
                            <span className="text-xs font-bold text-emerald-400 ml-auto">
                                저평가 매력도 {brl.undervalued_score}점 ({brl.level})
                            </span>
                        </div>

                        {/* 저평가 매력도 게이지 */}
                        <div className="space-y-1 mb-4">
                            <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
                                <div 
                                    className="bg-gradient-to-r from-slate-600 via-teal-500 to-emerald-400 h-2.5 rounded-full transition-all duration-500"
                                    style={{ width: `${brl.undervalued_score}%` }}
                                />
                            </div>
                            <div className="flex justify-between text-[10px] text-gray-500">
                                <span>고평가 부담</span>
                                <span>중립 (270원)</span>
                                <span className="text-emerald-400 font-bold">바닥권 매수 적기 ({brl.rate}원)</span>
                            </div>
                        </div>

                        {/* 통계 메트릭 */}
                        <div className="grid grid-cols-2 gap-2 text-xs mb-3 bg-black/20 p-2.5 rounded-lg border border-white/5">
                            <div>
                                <span className="text-gray-400 block text-[11px]">10년 역사적 백분위</span>
                                <span className="font-bold text-emerald-300">{brl.historical_percentile}% (바닥권 진입)</span>
                            </div>
                            <div>
                                <span className="text-gray-400 block text-[11px]">한-브라질 캐리마진</span>
                                <span className="font-extrabold text-emerald-300">+{brl.carry_margin_bp}bp (11.0%p)</span>
                            </div>
                        </div>

                        {/* 분할 환전 트랜치 가이드 */}
                        <div className="text-xs text-gray-300 bg-emerald-950/20 border border-emerald-500/20 p-2.5 rounded-lg space-y-1">
                            <div className="font-bold text-emerald-300 flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" /> 3단계 분할 환전 플랜
                            </div>
                            <div className="flex flex-wrap gap-2 pt-0.5">
                                {brl.split_tranche_guide.map((tranche, idx) => (
                                    <span 
                                        key={idx}
                                        className="text-[10px] bg-emerald-900/40 text-emerald-200 border border-emerald-500/30 px-2 py-0.5 rounded-md"
                                    >
                                        {tranche}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs">
                        <span className="text-gray-400">행동 지침:</span>
                        <span className="font-bold text-emerald-400">{brl.action_plan}</span>
                    </div>
                </div>
            </div>

            {/* 하단 빠른 실천 가이드 */}
            <div className="mt-4 p-3 rounded-xl bg-white/[0.02] border border-white/5 flex flex-wrap items-center justify-between gap-3 text-xs text-gray-400">
                <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 text-[10px] font-bold">
                        포트폴리오 스위칭 TIP
                    </span>
                    <span>
                        현재 원/달러 1,380원 상회 시에는 신규 미국 ETF 편입 시 <b>(H) 환헤지</b> 종목을, 헤알화는 <b>250원 이하 분할 매수</b>가 리스크 대비 최적입니다.
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-indigo-400 font-medium">연계 탭: 브라질 국채 탭 · 연금 탭 바로가기</span>
                    <ChevronRight className="w-3.5 h-3.5 text-indigo-400" />
                </div>
            </div>
        </section>
    );
}
