'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { API_BASE } from '../lib/apiConfig';
import { ShieldAlert, DollarSign, TrendingUp, TrendingDown, Percent, Info, Sliders, RefreshCw, Zap } from 'lucide-react';

interface ScenarioResult {
    scenario_name: string;
    fx_rate: number;
    delta_rate_bp: number;
    fx_impact_amount: number;
    rate_impact_amount: number;
    expected_pnl_amount: number;
    expected_pnl_rate: number;
}

interface Beneficiary {
    code: string;
    name: string;
    eval_amount: number;
    weight: number;
    impact_per_50krw: number;
}

interface Vulnerability {
    code: string;
    name: string;
    eval_amount: number;
    duration: number;
    weight: number;
    loss_per_50bp: number;
}

interface SensitivityData {
    total_eval: number;
    current_fx: number;
    usd_exposure_ratio: number;
    hedged_ratio: number;
    krw_exposure_ratio: number;
    bond_ratio: number;
    average_duration: number;
    shield_stance: string;
    shield_comment: string;
    scenario_results: ScenarioResult[];
    top_fx_beneficiaries: Beneficiary[];
    top_rate_vulnerabilities: Vulnerability[];
    is_demo_fallback?: boolean;
}

export default function MacroPortfolioSensitivityWidget() {
    const [data, setData] = useState<SensitivityData | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [customFx, setCustomFx] = useState<number>(1360);
    const [customBp, setCustomBp] = useState<number>(0);
    const [selectedPreset, setSelectedPreset] = useState<string>('current');

    const fetchData = async () => {
        try {
            setLoading(true);
            const res = await fetch(`${API_BASE}/api/v1/macro/portfolio-sensitivity`);
            if (res.ok) {
                const json: SensitivityData = await res.json();
                setData(json);
                setCustomFx(json.current_fx || 1360);
            }
        } catch (err) {
            console.error('Failed to load sensitivity data', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // 인터랙티브 슬라이더에 따른 실시간 즉시 계산
    const liveImpact = useMemo(() => {
        if (!data || data.total_eval <= 0) return { pnl: 0, pct: 0, fxPnl: 0, ratePnl: 0 };
        const baseFx = data.current_fx || 1360;
        const fxDiffPct = (customFx - baseFx) / baseFx;
        const usdEval = data.total_eval * (data.usd_exposure_ratio / 100);
        const fxPnl = usdEval * fxDiffPct;

        const rateDiffPct = -(data.average_duration * (customBp / 10000));
        const ratePnl = data.total_eval * rateDiffPct;

        const totalPnl = fxPnl + ratePnl;
        const totalPct = (totalPnl / data.total_eval) * 100;

        return {
            pnl: Math.round(totalPnl),
            pct: Number(totalPct.toFixed(2)),
            fxPnl: Math.round(fxPnl),
            ratePnl: Math.round(ratePnl)
        };
    }, [data, customFx, customBp]);

    const formatWon = (val: number) => {
        const sign = val > 0 ? '+' : '';
        const absVal = Math.abs(val);
        if (absVal >= 100000000) {
            return `${sign}${(val / 100000000).toFixed(2)}억 원`;
        }
        if (absVal >= 10000) {
            return `${sign}${(val / 10000).toLocaleString('ko-KR', { maximumFractionDigits: 0 })}만 원`;
        }
        return `${sign}${val.toLocaleString('ko-KR')}원`;
    };

    if (loading && !data) {
        return (
            <div className="bg-black/25 rounded-2xl border border-white/5 p-5 animate-pulse flex items-center justify-center min-h-[160px] text-xs text-gray-400">
                매크로 포트폴리오 민감도 분석 연산 중...
            </div>
        );
    }

    if (!data) return null;

    return (
        <section className="bg-gradient-to-br from-[#121422] to-[#0c0d15] rounded-2xl border border-indigo-500/20 shadow-xl overflow-hidden p-4 sm:p-5 mb-4">
            {/* 1. Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3.5 border-b border-white/10">
                <div className="flex items-center gap-2.5">
                    <span className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
                        <Zap className="w-4 h-4" />
                    </span>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-base font-extrabold text-white">매크로 ↔ 내 포트폴리오 실시간 스트레스 진단</h3>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                                {data.shield_stance}
                            </span>
                            {data.is_demo_fallback && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-400/30">
                                    대표 자산 포트폴리오 기준
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">
                            원/달러 환율과 국채금리가 급변할 때 내 자산의 예상 손익 및 방어력을 실시간 시뮬레이션합니다.
                        </p>
                    </div>
                </div>

                <button
                    onClick={fetchData}
                    className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 transition-colors"
                >
                    <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                    새로고침
                </button>
            </div>

            {/* 2. Portfolio Exposure Overview Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 my-3.5">
                <div className="bg-white/[0.03] border border-white/5 rounded-xl p-3">
                    <span className="text-[11px] text-gray-400 flex items-center gap-1">
                        <DollarSign className="w-3 h-3 text-emerald-400" /> 달러 환노출(USD)
                    </span>
                    <div className="text-xl font-extrabold text-emerald-400 mt-1 font-mono">
                        {data.usd_exposure_ratio}%
                    </div>
                    <div className="text-[10px] text-gray-500 mt-0.5">
                        원화 {data.krw_exposure_ratio}% · 환헤지 {data.hedged_ratio}%
                    </div>
                </div>

                <div className="bg-white/[0.03] border border-white/5 rounded-xl p-3">
                    <span className="text-[11px] text-gray-400 flex items-center gap-1">
                        <Percent className="w-3 h-3 text-sky-400" /> 채권 듀레이션
                    </span>
                    <div className="text-xl font-extrabold text-sky-400 mt-1 font-mono">
                        {data.average_duration}년
                    </div>
                    <div className="text-[10px] text-gray-500 mt-0.5">
                        채권 비중 {data.bond_ratio}%
                    </div>
                </div>

                <div className="bg-white/[0.03] border border-white/5 rounded-xl p-3">
                    <span className="text-[11px] text-gray-400">현재 적용 기준 환율</span>
                    <div className="text-xl font-extrabold text-white mt-1 font-mono">
                        {data.current_fx.toLocaleString('ko-KR')}원
                    </div>
                    <div className="text-[10px] text-gray-500 mt-0.5">
                        실시간 환율 탭 연동
                    </div>
                </div>

                <div className="bg-indigo-500/[0.08] border border-indigo-500/20 rounded-xl p-3">
                    <span className="text-[11px] text-indigo-300 font-semibold">시뮬레이션 예상 손익</span>
                    <div className={`text-xl font-extrabold mt-1 font-mono ${liveImpact.pnl >= 0 ? 'text-red-400' : 'text-blue-400'}`}>
                        {formatWon(liveImpact.pnl)}
                    </div>
                    <div className={`text-[10px] font-bold mt-0.5 ${liveImpact.pct >= 0 ? 'text-red-400' : 'text-blue-400'}`}>
                        {liveImpact.pct >= 0 ? `+${liveImpact.pct}%` : `${liveImpact.pct}%`} (환 {formatWon(liveImpact.fxPnl)} · 금리 {formatWon(liveImpact.ratePnl)})
                    </div>
                </div>
            </div>

            {/* 3. Interactive Stress Sliders */}
            <div className="bg-black/30 rounded-xl border border-white/5 p-3.5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
                        <Sliders className="w-3.5 h-3.5 text-indigo-400" />
                        인터랙티브 거시 충격 조절기
                    </span>
                    <div className="flex items-center gap-1.5">
                        <button
                            onClick={() => {
                                setCustomFx(1300);
                                setCustomBp(0);
                                setSelectedPreset('strong_krw');
                            }}
                            className={`text-[10px] font-bold px-2 py-0.5 rounded border transition-colors ${selectedPreset === 'strong_krw' ? 'bg-amber-500 text-black border-amber-400' : 'bg-white/5 text-gray-400 border-white/10 hover:text-white'}`}
                        >
                            원화 강세 (1,300원)
                        </button>
                        <button
                            onClick={() => {
                                setCustomFx(data.current_fx || 1360);
                                setCustomBp(0);
                                setSelectedPreset('current');
                            }}
                            className={`text-[10px] font-bold px-2 py-0.5 rounded border transition-colors ${selectedPreset === 'current' ? 'bg-amber-500 text-black border-amber-400' : 'bg-white/5 text-gray-400 border-white/10 hover:text-white'}`}
                        >
                            현재 수준 리셋
                        </button>
                        <button
                            onClick={() => {
                                setCustomFx(1450);
                                setCustomBp(50);
                                setSelectedPreset('crisis');
                            }}
                            className={`text-[10px] font-bold px-2 py-0.5 rounded border transition-colors ${selectedPreset === 'crisis' ? 'bg-amber-500 text-black border-amber-400' : 'bg-white/5 text-gray-400 border-white/10 hover:text-white'}`}
                        >
                            고환율·고금리 충격 (1,450원+50bp)
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                    {/* 환율 슬라이더 */}
                    <div className="space-y-1.5">
                        <div className="flex justify-between text-xs">
                            <span className="text-gray-400">목표 원/달러 환율</span>
                            <span className="font-extrabold text-amber-400 font-mono text-sm">{customFx.toLocaleString('ko-KR')}원 ({customFx > data.current_fx ? `+${(customFx - data.current_fx).toFixed(0)}원 약세` : `${(customFx - data.current_fx).toFixed(0)}원 강세`})</span>
                        </div>
                        <input
                            type="range"
                            min="1250"
                            max="1500"
                            step="5"
                            value={customFx}
                            onChange={(e) => {
                                setCustomFx(Number(e.target.value));
                                setSelectedPreset('custom');
                            }}
                            className="w-full accent-amber-500 cursor-pointer h-1.5 bg-gray-700 rounded-lg"
                        />
                        <div className="flex justify-between text-[10px] text-gray-500">
                            <span>1,250원 (초강세)</span>
                            <span>1,360원 (평균)</span>
                            <span>1,500원 (위기)</span>
                        </div>
                    </div>

                    {/* 금리 변동 슬라이더 */}
                    <div className="space-y-1.5">
                        <div className="flex justify-between text-xs">
                            <span className="text-gray-400">국채금리 변동폭</span>
                            <span className="font-extrabold text-sky-400 font-mono text-sm">{customBp >= 0 ? `+${customBp} bp 인상` : `${customBp} bp 인하`}</span>
                        </div>
                        <input
                            type="range"
                            min="-100"
                            max="100"
                            step="10"
                            value={customBp}
                            onChange={(e) => {
                                setCustomBp(Number(e.target.value));
                                setSelectedPreset('custom');
                            }}
                            className="w-full accent-sky-500 cursor-pointer h-1.5 bg-gray-700 rounded-lg"
                        />
                        <div className="flex justify-between text-[10px] text-gray-500">
                            <span>-100bp (급격 인하)</span>
                            <span>0bp (동결)</span>
                            <span>+100bp (긴축 쇼크)</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* 4. Top Beneficiaries vs Vulnerabilities */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3.5">
                {/* 환율 상승 수혜 종목 */}
                <div className="bg-emerald-500/[0.04] border border-emerald-500/15 rounded-xl p-3">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 mb-2">
                        <TrendingUp className="w-3.5 h-3.5" />
                        환율 상승(원화 약세) 최대 수혜 종목 TOP 3
                    </div>
                    <div className="space-y-1.5">
                        {data.top_fx_beneficiaries.map((b, idx) => (
                            <div key={idx} className="flex items-center justify-between text-xs bg-black/20 p-2 rounded-lg border border-white/5">
                                <div>
                                    <span className="font-bold text-white mr-1.5">{b.name}</span>
                                    <span className="text-[10px] text-gray-400">비중 {b.weight}%</span>
                                </div>
                                <div className="text-right">
                                    <span className="font-mono font-bold text-emerald-400">+{formatWon(b.impact_per_50krw)}</span>
                                    <span className="text-[9px] text-gray-500 block">환율 50원 상승 시</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 금리 상승 취약 종목 */}
                <div className="bg-rose-500/[0.04] border border-rose-500/15 rounded-xl p-3">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-rose-400 mb-2">
                        <TrendingDown className="w-3.5 h-3.5" />
                        금리 상승 충격 취약 종목 (채권 듀레이션)
                    </div>
                    <div className="space-y-1.5">
                        {data.top_rate_vulnerabilities.length > 0 ? (
                            data.top_rate_vulnerabilities.map((v, idx) => (
                                <div key={idx} className="flex items-center justify-between text-xs bg-black/20 p-2 rounded-lg border border-white/5">
                                    <div>
                                        <span className="font-bold text-white mr-1.5">{v.name}</span>
                                        <span className="text-[10px] text-gray-400">듀레이션 {v.duration}년 · 비중 {v.weight}%</span>
                                    </div>
                                    <div className="text-right">
                                        <span className="font-mono font-bold text-rose-400">-{formatWon(v.loss_per_50bp)}</span>
                                        <span className="text-[9px] text-gray-500 block">금리 50bp 인상 시</span>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="text-xs text-gray-500 py-2">보유 종목 중 듀레이션 리스크가 큰 채권 자산이 없습니다.</p>
                        )}
                    </div>
                </div>
            </div>

            {/* 5. Insight Banner */}
            <div className="mt-3 flex items-start gap-2 text-[11px] text-gray-400 bg-white/[0.02] border border-white/5 rounded-xl p-2.5">
                <Info className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                    💡 <strong>포트폴리오 총평:</strong> {data.shield_comment} (달러 환노출 자산은 원화 가치 하락에 따른 구매력 저하를 방어하는 대표적인 인플레이션 헤지 수단입니다.)
                </p>
            </div>
        </section>
    );
}
