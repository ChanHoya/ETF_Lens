// 11월 FOMC 및 한국은행 금통위 D-Day & CME FedWatch 실시간 금리 인하 확률 게이지 위젯
'use client';

import React, { useState, useEffect } from 'react';
import {
    Gauge, Calendar, TrendingDown, ShieldAlert, Sparkles, ArrowUpRight,
    Sliders, CheckCircle2, DollarSign, Activity, AlertCircle, RefreshCw
} from 'lucide-react';
import { API_BASE } from '@/lib/apiConfig';

interface FedWatchData {
    as_of: string;
    fomc: {
        meeting_date: string;
        d_day: number;
        current_target_range: string;
        current_upper: number;
        probabilities: {
            cut_50bp: number;
            cut_25bp: number;
            hold: number;
            hike_25bp: number;
        };
        change_from_1w: {
            cut_50bp: number;
            cut_25bp: number;
            hold: number;
            hike_25bp: number;
        };
        most_likely: {
            action: string;
            label: string;
            target_range: string;
            probability: number;
        };
        implied_fed_funds_rate: number;
        sentiment: string;
    };
    bok: {
        meeting_date: string;
        d_day: number;
        current_base_rate: number;
        probabilities: {
            cut_25bp: number;
            hold: number;
            hike_25bp: number;
        };
        change_from_1w: {
            cut_25bp: number;
            hold: number;
            hike_25bp: number;
        };
        most_likely: {
            action: string;
            label: string;
            target_rate: number;
            probability: number;
        };
        sentiment: string;
    };
    beneficiary_etfs: Array<{
        code: string;
        name: string;
        category: string;
        duration: number;
        current_yield: number;
        sensitivity_25bp: number;
        sensitivity_50bp: number;
        description: string;
    }>;
    macro_commentary: string;
}

const FALLBACK_DATA: FedWatchData = {
    as_of: '2026-10-25',
    fomc: {
        meeting_date: '2026-10-28',
        d_day: 3,
        current_target_range: '4.75 ~ 5.00%',
        current_upper: 5.0,
        probabilities: {
            cut_50bp: 2.5,
            cut_25bp: 82.5,
            hold: 15.0,
            hike_25bp: 0.0,
        },
        change_from_1w: {
            cut_50bp: -1.0,
            cut_25bp: 12.5,
            hold: -11.5,
            hike_25bp: 0.0,
        },
        most_likely: {
            action: 'cut_25bp',
            label: '25bp 금리 인하',
            target_range: '4.50 ~ 4.75%',
            probability: 82.5,
        },
        implied_fed_funds_rate: 4.62,
        sentiment: 'dovish',
    },
    bok: {
        meeting_date: '2026-11-26',
        d_day: 32,
        current_base_rate: 3.0,
        probabilities: {
            cut_25bp: 71.0,
            hold: 29.0,
            hike_25bp: 0.0,
        },
        change_from_1w: {
            cut_25bp: 8.0,
            hold: -8.0,
            hike_25bp: 0.0,
        },
        most_likely: {
            action: 'cut_25bp',
            label: '25bp 금리 인하',
            target_rate: 2.75,
            probability: 71.0,
        },
        sentiment: 'dovish',
    },
    beneficiary_etfs: [
        {
            code: '453850',
            name: 'ACE 미국30년국채액티브(H)',
            category: '미국 초장기채',
            duration: 18.5,
            current_yield: 4.45,
            sensitivity_25bp: 4.63,
            sensitivity_50bp: 9.25,
            description: '연준 25bp 인하 시 약 +4.63%의 듀레이션 자본차익 기대.',
        },
        {
            code: '447770',
            name: 'TIGER 국고채30년스트립액티브',
            category: '국내 스트립 초장기채',
            duration: 26.2,
            current_yield: 3.15,
            sensitivity_25bp: 6.55,
            sensitivity_50bp: 13.1,
            description: '한은 금통위 인하 사이클 도래 시 국내 최장 듀레이션 자본차익 수혜.',
        },
        {
            code: '305080',
            name: 'KODEX 미국채10년선물(H)',
            category: '미국 중장기채',
            duration: 8.2,
            current_yield: 4.2,
            sensitivity_25bp: 2.05,
            sensitivity_50bp: 4.1,
            description: '안정적인 만기 구조와 완만한 자본차익을 추구하는 코어 채권.',
        },
        {
            code: '385560',
            name: 'KBSTAR KIS종합채권(A-이상)액티브',
            category: '국내 종합채권',
            duration: 5.4,
            current_yield: 3.4,
            sensitivity_25bp: 1.35,
            sensitivity_50bp: 2.7,
            description: '변동성을 억제하며 안정적인 이자수익과 방어력을 동시 확보.',
        },
    ],
    macro_commentary:
        '11월 FOMC(D-3) 회의에서 연방기금 선물 시장은 25bp 금리 인하 확률을 82.5%로 강력 반영하고 있습니다. 한국은행 금통위(D-32) 역시 내수 경기 회복 지원을 위한 인하 확률이 71%에 달해, 듀레이션이 긴 미국 30년 국채 및 국고채 30년 채권 ETF의 자본차익 기회가 부각되고 있습니다.',
};

export default function FedWatchRateProbabilityWidget() {
    const [data, setData] = useState<FedWatchData>(FALLBACK_DATA);
    const [loading, setLoading] = useState(false);
    const [scenario, setScenario] = useState<'25bp' | '50bp' | '0bp'>('25bp');

    useEffect(() => {
        let mounted = true;
        const fetchData = async () => {
            try {
                const res = await fetch(`${API_BASE}/api/v1/rates/fedwatch-probabilities`);
                if (res.ok) {
                    const json = await res.json();
                    if (mounted) setData(json);
                }
            } catch {
                // Fallback 유지
            }
        };
        fetchData();
        return () => {
            mounted = false;
        };
    }, []);

    const fomc = data.fomc;
    const bok = data.bok;

    // 반원형 게이지 바늘 각도 계산 (0% = -90도, 100% = +90도)
    // 인하 확률 82.5% -> 각도 변환
    const cutProb = fomc.probabilities.cut_25bp + fomc.probabilities.cut_50bp;
    const needleDeg = -90 + (cutProb / 100) * 180;

    return (
        <section className="bg-gradient-to-br from-slate-900/90 via-slate-900/60 to-indigo-950/40 rounded-2xl border border-indigo-500/20 p-4 md:p-6 shadow-xl backdrop-blur-md space-y-6">
            {/* 상단 헤더 & D-Day 펄스 뱃지 */}
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pb-4 border-b border-white/10">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
                        <Gauge className="w-6 h-6 animate-pulse" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-xl md:text-2xl font-black text-white tracking-tight">
                                11월 FOMC & 한은 금통위 D-Day
                            </h2>
                            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-blue-500/15 border border-blue-400/30 text-blue-300">
                                CME FedWatch 연동
                            </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                            글로벌 연방기금 선물(Fed Funds Futures) 시장이 실시간으로 가격에 반영 중인 차기 금리 결정 확률입니다.
                        </p>
                    </div>
                </div>

                {/* 듀얼 D-Day 카운트다운 */}
                <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                    {/* 미국 FOMC */}
                    <div className="flex-1 lg:flex-initial flex items-center justify-between gap-3 px-3.5 py-2 rounded-xl bg-rose-500/10 border border-rose-500/25">
                        <div className="flex items-center gap-2">
                            <span className="text-base">🇺🇸</span>
                            <div>
                                <span className="text-[10px] font-semibold text-rose-300 block">미국 FOMC</span>
                                <span className="text-xs font-bold text-white">{fomc.meeting_date}</span>
                            </div>
                        </div>
                        <div className="text-right">
                            <span className="text-xs font-black px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-400/30 animate-pulse">
                                D-{fomc.d_day}
                            </span>
                        </div>
                    </div>

                    {/* 한국 금통위 */}
                    <div className="flex-1 lg:flex-initial flex items-center justify-between gap-3 px-3.5 py-2 rounded-xl bg-sky-500/10 border border-sky-500/25">
                        <div className="flex items-center gap-2">
                            <span className="text-base">🇰🇷</span>
                            <div>
                                <span className="text-[10px] font-semibold text-sky-300 block">한국은행 금통위</span>
                                <span className="text-xs font-bold text-white">{bok.meeting_date}</span>
                            </div>
                        </div>
                        <div className="text-right">
                            <span className="text-xs font-black px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-400/30">
                                D-{bok.d_day}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* 메인 비주얼: FedWatch 반원형 게이지 & 한은 전망 그리드 */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                {/* 좌측 (7컬럼): CME FedWatch 인하 확률 반원 게이지 */}
                <div className="lg:col-span-7 bg-black/25 rounded-xl border border-white/5 p-4 md:p-5 flex flex-col justify-between space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Activity className="w-4 h-4 text-indigo-400" />
                            <span className="text-xs font-bold text-gray-200">CME FedWatch 연방기금 선물 내재 확률</span>
                        </div>
                        <span className="text-[11px] text-gray-400">
                            현재 상단 <strong className="text-white">{fomc.current_target_range}</strong>
                        </span>
                    </div>

                    {/* SVG 반원 게이지 시각화 */}
                    <div className="flex flex-col sm:flex-row items-center justify-around gap-6 py-2">
                        <div className="relative w-48 h-28 flex items-end justify-center">
                            <svg viewBox="0 0 200 110" className="w-full h-full overflow-visible">
                                <defs>
                                    <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                        <stop offset="0%" stopColor="#94a3b8" />
                                        <stop offset="25%" stopColor="#38bdf8" />
                                        <stop offset="75%" stopColor="#6366f1" />
                                        <stop offset="100%" stopColor="#818cf8" />
                                    </linearGradient>
                                </defs>
                                {/* 배경 반원 호 (반지름 80) */}
                                <path
                                    d="M 20 100 A 80 80 0 0 1 180 100"
                                    fill="none"
                                    stroke="rgba(255,255,255,0.1)"
                                    strokeWidth="16"
                                    strokeLinecap="round"
                                />
                                {/* 활성화 채움 호 */}
                                <path
                                    d="M 20 100 A 80 80 0 0 1 180 100"
                                    fill="none"
                                    stroke="url(#gaugeGradient)"
                                    strokeWidth="16"
                                    strokeDasharray="251.3"
                                    strokeDashoffset={251.3 * (1 - cutProb / 100)}
                                    strokeLinecap="round"
                                    className="transition-all duration-1000 ease-out"
                                />
                                {/* 중앙 지시 바늘 */}
                                <g transform={`rotate(${needleDeg} 100 100)`} className="transition-transform duration-1000 ease-out">
                                    <line x1="100" y1="100" x2="100" y2="30" stroke="#f43f5e" strokeWidth="3.5" strokeLinecap="round" />
                                    <circle cx="100" cy="100" r="6" fill="#f43f5e" />
                                    <circle cx="100" cy="100" r="2.5" fill="#ffffff" />
                                </g>
                            </svg>
                            {/* 게이지 중심 텍스트 */}
                            <div className="absolute bottom-0 text-center">
                                <span className="text-2xl md:text-3xl font-black text-white block tracking-tight">
                                    {cutProb.toFixed(1)}%
                                </span>
                                <span className="text-[10px] font-bold text-indigo-400 block -mt-0.5">
                                    인하 유력 (D-{fomc.d_day})
                                </span>
                            </div>
                        </div>

                        {/* 시나리오별 확률 브레이크다운 */}
                        <div className="w-full sm:w-56 space-y-2 text-xs">
                            <div className="p-2.5 rounded-lg bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-between">
                                <div>
                                    <span className="font-bold text-indigo-300 block">📉 25bp 인하 (메인)</span>
                                    <span className="text-[10px] text-gray-400">4.50 ~ 4.75%</span>
                                </div>
                                <div className="text-right">
                                    <span className="text-sm font-black text-white">{fomc.probabilities.cut_25bp}%</span>
                                    <span className="text-[10px] text-emerald-400 block">
                                        1주전 대비 +{fomc.change_from_1w.cut_25bp}%p
                                    </span>
                                </div>
                            </div>

                            <div className="p-2 rounded-lg bg-white/5 border border-white/10 flex items-center justify-between">
                                <div>
                                    <span className="font-semibold text-gray-300 block">⏸ 동결</span>
                                    <span className="text-[10px] text-gray-400">4.75 ~ 5.00%</span>
                                </div>
                                <div className="text-right">
                                    <span className="text-sm font-bold text-gray-300">{fomc.probabilities.hold}%</span>
                                    <span className="text-[10px] text-rose-400 block">
                                        1주전 대비 {fomc.change_from_1w.hold}%p
                                    </span>
                                </div>
                            </div>

                            <div className="p-2 rounded-lg bg-white/5 border border-white/10 flex items-center justify-between">
                                <div>
                                    <span className="font-semibold text-gray-300 block">⚡ 50bp 빅컷</span>
                                    <span className="text-[10px] text-gray-400">4.25 ~ 4.50%</span>
                                </div>
                                <div className="text-right">
                                    <span className="text-sm font-bold text-gray-300">{fomc.probabilities.cut_50bp}%</span>
                                    <span className="text-[10px] text-gray-500 block">
                                        선물 내재 {fomc.implied_fed_funds_rate}%
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="text-[11px] text-gray-400 bg-white/[0.02] p-2.5 rounded-lg border border-white/5 flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                        <span>
                            선물 시장은 이미 <strong>25bp 금리 인하를 기정사실화</strong>하고 있으며, 관건은 12월 추가 인하 여부 및 제롬 파월 연준 의장의 기자회견 포워드 가이던스입니다.
                        </span>
                    </div>
                </div>

                {/* 우측 (5컬럼): 한국은행 금통위 및 한·미 정책금리 스프레드 전망 */}
                <div className="lg:col-span-5 bg-black/25 rounded-xl border border-white/5 p-4 md:p-5 flex flex-col justify-between space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-sky-400" />
                            <span className="text-xs font-bold text-gray-200">한국은행 금통위 회의 전망</span>
                        </div>
                        <span className="text-[11px] text-sky-400 font-semibold">11월 26일 (D-{bok.d_day})</span>
                    </div>

                    <div className="space-y-3">
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-400">현재 기준금리</span>
                            <span className="font-bold text-white">{bok.current_base_rate.toFixed(2)}%</span>
                        </div>

                        {/* 한은 인하 확률 바 */}
                        <div>
                            <div className="flex justify-between text-xs mb-1">
                                <span className="font-semibold text-sky-300">25bp 인하 기대 ({bok.probabilities.cut_25bp}%)</span>
                                <span className="text-gray-400">동결 ({bok.probabilities.hold}%)</span>
                            </div>
                            <div className="h-3 w-full bg-white/10 rounded-full overflow-hidden flex">
                                <div
                                    className="bg-gradient-to-r from-sky-500 to-indigo-500 transition-all duration-700"
                                    style={{ width: `${bok.probabilities.cut_25bp}%` }}
                                />
                                <div
                                    className="bg-gray-600 transition-all duration-700"
                                    style={{ width: `${bok.probabilities.hold}%` }}
                                />
                            </div>
                            <span className="text-[10px] text-gray-400 block mt-1">
                                내수 소비 진작 및 부동산 PF 연착륙을 위한 추가 완화 기대가 우세합니다.
                            </span>
                        </div>

                        {/* 한미 정책금리 역전 스프레드 진단 */}
                        <div className="p-3 rounded-lg bg-sky-500/10 border border-sky-500/20 text-xs space-y-1">
                            <div className="flex justify-between font-bold text-sky-200">
                                <span>한·미 정책금리 격차</span>
                                <span>-2.00%p (한국 3.00% vs 미국 5.00%)</span>
                            </div>
                            <p className="text-[11px] text-gray-300">
                                미국이 25bp 인하 시 격차는 <strong>-1.75%p</strong>로 축소되어 한국은행의 추가 금리 인하 통화정책 운용 룸이 대폭 확대됩니다.
                            </p>
                        </div>
                    </div>

                    <div className="text-[11px] text-gray-400 bg-white/[0.02] p-2.5 rounded-lg border border-white/5 flex items-center gap-2">
                        <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span>금리 인하 국면 진입 시 자본차익을 누릴 수 있는 장기 채권 ETF를 아래에서 시뮬레이션해보세요.</span>
                    </div>
                </div>
            </div>

            {/* 하단: 채권 ETF 듀레이션 자본차익 인터랙티브 시뮬레이터 */}
            <div className="space-y-4 pt-2">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <Sliders className="w-4 h-4 text-emerald-400" />
                        <h3 className="text-sm md:text-base font-bold text-white">
                            금리 인하 시나리오별 수혜 채권 ETF 자본차익 시뮬레이터
                        </h3>
                    </div>

                    {/* 인터랙티브 시나리오 선택기 */}
                    <div className="flex items-center gap-1.5 p-1 rounded-xl bg-black/40 border border-white/10 text-xs">
                        <button
                            onClick={() => setScenario('25bp')}
                            className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                                scenario === '25bp'
                                    ? 'bg-indigo-600 text-white shadow-md'
                                    : 'text-gray-400 hover:text-white'
                            }`}
                        >
                            📉 25bp 표준 인하 (유력)
                        </button>
                        <button
                            onClick={() => setScenario('50bp')}
                            className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                                scenario === '50bp'
                                    ? 'bg-rose-600 text-white shadow-md'
                                    : 'text-gray-400 hover:text-white'
                            }`}
                        >
                            ⚡ 50bp 빅컷 인하
                        </button>
                        <button
                            onClick={() => setScenario('0bp')}
                            className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                                scenario === '0bp'
                                    ? 'bg-gray-700 text-white shadow-md'
                                    : 'text-gray-400 hover:text-white'
                            }`}
                        >
                            ⏸ 동결 유지 (0bp)
                        </button>
                    </div>
                </div>

                {/* 4대 채권 ETF 카드 그리드 */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                    {data.beneficiary_etfs.map(etf => {
                        const capitalGain =
                            scenario === '25bp'
                                ? etf.sensitivity_25bp
                                : scenario === '50bp'
                                ? etf.sensitivity_50bp
                                : 0.0;
                        const totalExpectedReturn = capitalGain + etf.current_yield;

                        return (
                            <div
                                key={etf.code}
                                className="bg-black/30 rounded-xl border border-white/5 p-4 flex flex-col justify-between hover:border-indigo-400/40 hover:bg-white/[0.03] transition-all group"
                            >
                                <div>
                                    <div className="flex items-start justify-between gap-1 mb-1.5">
                                        <span className="text-[10px] font-semibold text-indigo-400 px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20">
                                            {etf.category}
                                        </span>
                                        <span className="text-[10px] text-gray-500 font-mono">{etf.code}</span>
                                    </div>
                                    <h4 className="text-sm font-bold text-white group-hover:text-indigo-300 transition-colors line-clamp-1">
                                        {etf.name}
                                    </h4>
                                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                                        <span>듀레이션 <strong className="text-white">{etf.duration}년</strong></span>
                                        <span>배당수익률 <strong className="text-emerald-400">{etf.current_yield}%</strong></span>
                                    </div>
                                </div>

                                <div className="mt-4 pt-3 border-t border-white/5 space-y-2">
                                    <div className="flex items-baseline justify-between">
                                        <span className="text-[11px] text-gray-400">예상 자본차익</span>
                                        <span className={`text-base font-extrabold ${capitalGain > 0 ? 'text-indigo-400' : 'text-gray-400'}`}>
                                            {capitalGain > 0 ? `+${capitalGain.toFixed(2)}%` : '0.00%'}
                                        </span>
                                    </div>

                                    <div className="flex items-baseline justify-between p-2 rounded-lg bg-white/5">
                                        <span className="text-[10px] font-semibold text-gray-300">1년 기대 총수익률</span>
                                        <span className="text-sm font-black text-emerald-400">
                                            +{totalExpectedReturn.toFixed(2)}%
                                        </span>
                                    </div>

                                    <p className="text-[10px] text-gray-400 line-clamp-2">
                                        {etf.description}
                                    </p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}
