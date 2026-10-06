'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
    ShieldAlert, 
    ShieldCheck, 
    AlertTriangle, 
    Info, 
    ArrowRight, 
    TrendingUp, 
    PiggyBank, 
    RefreshCw, 
    CheckCircle2, 
    ChevronRight,
    HelpCircle,
    UserCheck,
    UserX,
    Lock
} from 'lucide-react';
import {
    ComposedChart,
    Bar,
    Line,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    ReferenceLine,
    Cell
} from 'recharts';
import { API_BASE } from '@/lib/apiConfig';

interface TaxShieldRadarProps {
    initialTaxableDiv?: number;
    initialShieldedDiv?: number;
    initialInterest?: number;
}

const PRESETS = [
    {
        name: '🌱 안전 분산형 (60%)',
        taxable: 11_000_000,
        shielded: 8_000_000,
        interest: 1_000_000,
        dependent: true,
        desc: '일반과세 금융소득 1,200만원으로 2,000만원 상한선 대비 60% 안전 유지'
    },
    {
        name: '⚠️ 한도 임박형 (92.5%)',
        taxable: 17_500_000,
        shielded: 5_000_000,
        interest: 1_000_000,
        dependent: true,
        desc: '금융소득 1,850만원으로 잔여 한도 150만원에 불과하여 연말 배당락 전 관리 필수'
    },
    {
        name: '🚨 피부양자 탈락 위기형 (120%)',
        taxable: 22_500_000,
        shielded: 4_000_000,
        interest: 1_500_000,
        dependent: true,
        desc: '연 2,400만원으로 2,000만원 초과! 즉시 건보료 피부양자 박탈 및 종합과세 진입'
    }
];

export default function TaxShieldRadar({
    initialTaxableDiv = 12_000_000,
    initialShieldedDiv = 6_000_000,
    initialInterest = 1_000_000
}: TaxShieldRadarProps) {
    const [taxableDiv, setTaxableDiv] = useState(initialTaxableDiv);
    const [shieldedDiv, setShieldedDiv] = useState(initialShieldedDiv);
    const [interestIncome, setInterestIncome] = useState(initialInterest);
    const [otherIncome, setOtherIncome] = useState(50_000_000);
    const [isDependent, setIsDependent] = useState(true);

    const [loading, setLoading] = useState(false);
    const [analysisData, setAnalysisData] = useState<any>(null);

    const calculateClientFallback = () => {
        const totalFin = taxableDiv + interestIncome;
        const limit = 20_000_000;
        const remaining = Math.max(0, limit - totalFin);
        const excess = Math.max(0, totalFin - limit);
        const utilRate = Math.min(200, Math.round((totalFin / limit) * 1000) / 10);
        const riskLevel = excess > 0 ? 'CRITICAL' : utilRate >= 90 ? 'WARNING' : utilRate >= 75 ? 'CAUTION' : 'SAFE';
        const riskBadge = excess > 0 ? '🚨 초과 (위험)' : utilRate >= 90 ? '⚠️ 경고 (90%+)' : utilRate >= 75 ? '⚡ 주의 (75%+)' : '✅ 안전 (정상)';
        
        // 월별 추이 fallback
        const monthly = Array.from({ length: 12 }, (_, i) => {
            const m = i + 1;
            const mTaxable = Math.round(taxableDiv / 12 * (m === 4 || m === 12 ? 2.5 : 0.8));
            const mShielded = Math.round(shieldedDiv / 12 * (m === 4 || m === 12 ? 2.2 : 0.85));
            return {
                month: `${m}월`,
                taxable_dividends: mTaxable,
                shielded_dividends: mShielded,
                cumulative_taxable: 0,
                monthly_total: mTaxable + mShielded
            };
        });
        let cum = 0;
        monthly.forEach(item => {
            cum += item.taxable_dividends;
            item.cumulative_taxable = cum;
        });

        const estHealthFee = excess > 0 && isDependent ? Math.round(totalFin * 0.0709 / 12) : 0;
        const estAnnualTax = excess > 0 ? Math.round(excess * 0.154) : 0;

        return {
            summary: {
                total_financial_income_krw: totalFin,
                taxable_dividends_krw: taxableDiv,
                interest_income_krw: interestIncome,
                shielded_dividends_krw: shieldedDiv,
                comprehensive_threshold_krw: limit,
                remaining_limit_krw: remaining,
                excess_income_krw: excess,
                utilization_rate: utilRate,
                risk_level: riskLevel,
                risk_badge: riskBadge,
                status_msg: excess > 0 ? '종합과세 기준 2,000만원 초과! 절세 계좌 활용 필수' : '2,000만원 한도 내에서 안전하게 운용 중'
            },
            tax_impact: {
                is_comprehensive_taxation: excess > 0,
                taxable_base_krw: excess,
                estimated_comprehensive_tax_krw: estAnnualTax,
                withholding_tax_krw: Math.round(totalFin * 0.154),
                marginal_tax_rate_pct: excess > 0 ? 26.4 : 15.4
            },
            health_insurance_impact: {
                is_dependent_lost: excess > 0 && isDependent,
                estimated_monthly_health_fee_krw: estHealthFee,
                estimated_annual_health_fee_krw: estHealthFee * 12,
                status_description: excess > 0 && isDependent ? '피부양자 자격 박탈 예상! 지역가입자 전환' : '피부양자 자격 안전 유지'
            },
            monthly_trend: monthly,
            recommendations: [
                {
                    priority: 'HIGH',
                    action_title: 'ISA 계좌 비과세·분리과세 적극 활용',
                    description: '연 2,000만원 납입 한도로 일반 배당을 ISA로 이전하여 금융소득종합과세 대상에서 원천 제외하세요.',
                    expected_savings_krw: Math.round(taxableDiv * 0.099)
                },
                {
                    priority: 'MEDIUM',
                    action_title: '연금저축/IRP 과세이연 배당 ETF 편입',
                    description: '고배당 ETF를 연금계좌로 이전 시 배당소득세(15.4%)가 즉시 과세되지 않고 55세 이후 저율 연금소득세(3.3~5.5%)가 적용됩니다.',
                    expected_savings_krw: Math.round(shieldedDiv * 0.1)
                }
            ]
        };
    };

    const fetchAnalysis = async () => {
        setLoading(true);
        try {
            const endpoint = `${API_BASE}/api/v1/dividends/tax-shield`;
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    taxable_dividends_krw: taxableDiv,
                    tax_shielded_dividends_krw: shieldedDiv,
                    interest_income_krw: interestIncome,
                    other_annual_income_krw: otherIncome,
                    is_health_insurance_dependent: isDependent
                })
            });
            if (res.ok) {
                const data = await res.json();
                setAnalysisData(data);
            } else {
                setAnalysisData(calculateClientFallback());
            }
        } catch (e) {
            console.warn('Backend unavailable, using client fallback calculation:', e);
            setAnalysisData(calculateClientFallback());
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAnalysis();
    }, [taxableDiv, shieldedDiv, interestIncome, otherIncome, isDependent]);

    const formatWon = (val: number) => {
        return new Intl.NumberFormat('ko-KR').format(Math.round(val)) + '원';
    };

    const formatManWon = (val: number) => {
        const man = Math.round(val / 10000);
        return new Intl.NumberFormat('ko-KR').format(man) + '만';
    };

    const summary = analysisData?.summary;
    const taxImpact = analysisData?.tax_impact;
    const healthImpact = analysisData?.health_insurance_impact;
    const monthlyTrend = analysisData?.monthly_trend || [];
    const recommendations = analysisData?.recommendations || [];

    const getRiskBadgeStyles = (level: string) => {
        switch (level) {
            case 'SAFE':
                return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
            case 'CAUTION':
                return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
            case 'WARNING':
                return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
            case 'CRITICAL':
            default:
                return 'bg-rose-500/20 text-rose-400 border-rose-500/30';
        }
    };

    return (
        <div className="w-full bg-slate-900/90 border border-slate-800 rounded-2xl p-5 md:p-6 text-white space-y-6 shadow-2xl backdrop-blur-md">
            {/* 1. Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                <div>
                    <div className="flex items-center gap-2.5">
                        <span className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                            <ShieldCheck className="w-5 h-5" />
                        </span>
                        <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                            금융소득 종합과세 & 건보료 피부양자 실시간 방어 트래커
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                2,000만원 Shield Radar
                            </span>
                        </h2>
                    </div>
                    <p className="text-xs text-slate-400 mt-1 pl-10">
                        연 2,000만원 초과 시 종합소득세 합산 누진과세 및 <span className="text-rose-400 font-semibold">건강보험 피부양자 자격 박탈(지역건보료 폭탄)</span> 절벽을 실시간으로 감지하고 ISA/연금계좌로 방어합니다.
                    </p>
                </div>

                {/* Preset Buttons */}
                <div className="flex flex-wrap items-center gap-1.5 self-start md:self-auto">
                    {PRESETS.map((p, idx) => (
                        <button
                            key={idx}
                            onClick={() => {
                                setTaxableDiv(p.taxable);
                                setShieldedDiv(p.shielded);
                                setInterestIncome(p.interest);
                                setIsDependent(p.dependent);
                            }}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/60 transition-all hover:scale-[1.02] active:scale-[0.98]"
                        >
                            {p.name}
                        </button>
                    ))}
                </div>
            </div>

            {/* 2. Top Bento 4 Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Metric 1: 소진율 & 게이지 */}
                <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-4 flex flex-col justify-between relative overflow-hidden">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-400">금융소득 한도 소진율</span>
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${getRiskBadgeStyles(summary?.risk_level || 'SAFE')}`}>
                            {summary?.risk_badge || '계산중'}
                        </span>
                    </div>
                    <div className="my-2">
                        <div className="text-2xl font-black tracking-tight text-white flex items-baseline gap-1.5">
                            {summary?.utilization_rate || 0}%
                            <span className="text-xs font-normal text-slate-400">
                                ({formatManWon(summary?.total_financial_income_krw || 0)}원 / 2,000만)
                            </span>
                        </div>
                        {/* Progress Bar */}
                        <div className="w-full bg-slate-700/60 rounded-full h-2 mt-2 overflow-hidden">
                            <div 
                                className={`h-full rounded-full transition-all duration-500 ${
                                    (summary?.utilization_rate || 0) > 100 ? 'bg-rose-500' :
                                    (summary?.utilization_rate || 0) > 90 ? 'bg-orange-500' :
                                    (summary?.utilization_rate || 0) > 75 ? 'bg-amber-500' : 'bg-emerald-500'
                                }`}
                                style={{ width: `${Math.min(100, summary?.utilization_rate || 0)}%` }}
                            />
                        </div>
                    </div>
                    <div className="text-[11px] text-slate-400 truncate">
                        {summary?.status_msg}
                    </div>
                </div>

                {/* Metric 2: 잔여 방어 한도 */}
                <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-400">잔여 방어 한도 (2천만 기준)</span>
                        <PiggyBank className="w-4 h-4 text-indigo-400" />
                    </div>
                    <div className="my-2">
                        {summary?.excess_income_krw > 0 ? (
                            <div>
                                <div className="text-2xl font-black text-rose-400">
                                    +{formatWon(summary.excess_income_krw)}
                                </div>
                                <span className="text-[11px] text-rose-300 font-semibold">
                                    초과 발생 (종합과세 합산 대상)
                                </span>
                            </div>
                        ) : (
                            <div>
                                <div className="text-2xl font-black text-emerald-400">
                                    {formatWon(summary?.remaining_shield_krw || 0)}
                                </div>
                                <span className="text-[11px] text-emerald-300 font-medium">
                                    안전 한도 보유 중
                                </span>
                            </div>
                        )}
                    </div>
                    <div className="text-[11px] text-slate-400">
                        절세계좌 배당: <span className="text-indigo-300 font-semibold">{formatWon(summary?.tax_shielded_dividends_krw || 0)}</span> (합산 제외)
                    </div>
                </div>

                {/* Metric 3: 세금 영향 (종합과세) */}
                <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-400">예상 추가 세부담 (종합과세)</span>
                        <TrendingUp className="w-4 h-4 text-amber-400" />
                    </div>
                    <div className="my-2">
                        <div className="text-2xl font-black text-white">
                            {formatWon(taxImpact?.additional_income_tax_krw || 0)}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                            적용 한계세율: <span className="text-amber-400 font-bold">{taxImpact?.marginal_rate_percent || 0}%</span> (지방세 포함)
                        </div>
                    </div>
                    <div className="text-[11px] text-slate-400">
                        총 예상 세액: <span className="text-slate-200">{formatWon(taxImpact?.total_estimated_tax_krw || 0)}</span>
                    </div>
                </div>

                {/* Metric 4: 건보료 피부양자 상태 */}
                <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-400">건보료 피부양자 자격 판정</span>
                        {healthImpact?.is_dependent_disqualified ? (
                            <UserX className="w-4 h-4 text-rose-400" />
                        ) : (
                            <UserCheck className="w-4 h-4 text-emerald-400" />
                        )}
                    </div>
                    <div className="my-2">
                        {healthImpact?.is_dependent_disqualified ? (
                            <div>
                                <div className="text-xl font-black text-rose-400 flex items-center gap-1">
                                    <AlertTriangle className="w-5 h-5 shrink-0" /> 피부양자 탈락 위험!
                                </div>
                                <div className="text-xs text-rose-300 mt-1 font-semibold">
                                    월 약 {formatWon(healthImpact.estimated_monthly_fee_krw)} 부과
                                </div>
                            </div>
                        ) : (
                            <div>
                                <div className="text-xl font-black text-emerald-400 flex items-center gap-1">
                                    <ShieldCheck className="w-5 h-5 shrink-0" /> 피부양자 안전 유지
                                </div>
                                <div className="text-xs text-slate-400 mt-1">
                                    지역건보료 추가 부과 없음 (0원)
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="text-[11px] text-slate-400">
                        연간 환산: <span className="text-white font-medium">{formatWon(healthImpact?.estimated_annual_fee_krw || 0)}</span>
                    </div>
                </div>
            </div>

            {/* 3. Interactive Simulator & Controls */}
            <div className="bg-slate-800/20 border border-slate-800 rounded-xl p-4 space-y-4">
                <div className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <RefreshCw className="w-3.5 h-3.5 text-indigo-400" /> 소득 조건 시뮬레이션
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    {/* 일반 과세 계좌 배당소득 */}
                    <div className="space-y-1.5">
                        <div className="flex justify-between text-xs">
                            <span className="text-slate-300 font-medium">일반과세 배당소득</span>
                            <span className="font-bold text-indigo-400">{formatWon(taxableDiv)}</span>
                        </div>
                        <input
                            type="range"
                            min="0"
                            max="30000000"
                            step="500000"
                            value={taxableDiv}
                            onChange={(e) => setTaxableDiv(Number(e.target.value))}
                            className="w-full accent-indigo-500 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
                        />
                        <div className="flex justify-between text-[10px] text-slate-500">
                            <span>0원</span>
                            <span>1,500만</span>
                            <span>3,000만원</span>
                        </div>
                    </div>

                    {/* 이자소득 */}
                    <div className="space-y-1.5">
                        <div className="flex justify-between text-xs">
                            <span className="text-slate-300 font-medium">예적금/채권 이자소득</span>
                            <span className="font-bold text-amber-400">{formatWon(interestIncome)}</span>
                        </div>
                        <input
                            type="range"
                            min="0"
                            max="10000000"
                            step="200000"
                            value={interestIncome}
                            onChange={(e) => setInterestIncome(Number(e.target.value))}
                            className="w-full accent-amber-500 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
                        />
                        <div className="flex justify-between text-[10px] text-slate-500">
                            <span>0원</span>
                            <span>500만</span>
                            <span>1,000만원</span>
                        </div>
                    </div>

                    {/* 절세계좌(ISA/연금) 배당소득 */}
                    <div className="space-y-1.5">
                        <div className="flex justify-between text-xs">
                            <span className="text-slate-300 font-medium flex items-center gap-1">
                                <Lock className="w-3 h-3 text-emerald-400" /> 절세계좌(ISA/연금) 배당
                            </span>
                            <span className="font-bold text-emerald-400">{formatWon(shieldedDiv)}</span>
                        </div>
                        <input
                            type="range"
                            min="0"
                            max="30000000"
                            step="500000"
                            value={shieldedDiv}
                            onChange={(e) => setShieldedDiv(Number(e.target.value))}
                            className="w-full accent-emerald-500 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
                        />
                        <div className="flex justify-between text-[10px] text-slate-500">
                            <span>0원</span>
                            <span>1,500만</span>
                            <span>3,000만원</span>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-slate-800/80">
                    <div className="flex items-center gap-3">
                        <label className="text-xs text-slate-300 font-medium">건보료 피부양자 대상자:</label>
                        <button
                            onClick={() => setIsDependent(!isDependent)}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all border ${
                                isDependent 
                                    ? 'bg-indigo-600/30 text-indigo-300 border-indigo-500/40 shadow-sm' 
                                    : 'bg-slate-800 text-slate-400 border-slate-700'
                            }`}
                        >
                            {isDependent ? '✅ 피부양자 등록 상태' : '❌ 직장/지역 가입자 (단독)'}
                        </button>
                    </div>

                    <div className="flex items-center gap-2">
                        <label className="text-xs text-slate-300 font-medium">타 종합소득(근로/사업):</label>
                        <select
                            value={otherIncome}
                            onChange={(e) => setOtherIncome(Number(e.target.value))}
                            className="bg-slate-800 text-xs text-slate-200 border border-slate-700 rounded-lg px-2.5 py-1 focus:outline-none focus:border-indigo-500"
                        >
                            <option value={30_000_000}>3,000만원 (과표 15%)</option>
                            <option value={50_000_000}>5,000만원 (과표 24%)</option>
                            <option value={88_000_000}>8,800만원 (과표 35%)</option>
                            <option value={120_000_000}>1억 2,000만원 (과표 38%)</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* 4. Monthly Trend Chart (ComposedChart with 20M ReferenceLine) */}
            <div className="bg-slate-800/30 border border-slate-800 rounded-xl p-4 md:p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                    <div>
                        <h3 className="text-sm font-bold text-white flex items-center gap-2">
                            월별 금융소득 추이 및 2,000만원 방어선(Shield Line)
                        </h3>
                        <p className="text-xs text-slate-400">
                            월별 수령액과 연간 누적액의 2,000만원 돌파 시점을 점검합니다.
                        </p>
                    </div>
                    {summary?.limit_breach_month && (
                        <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/30 self-start sm:self-auto">
                            ⚠️ {summary.limit_breach_month}에 2,000만원 한도 돌파!
                        </span>
                    )}
                </div>

                <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={monthlyTrend} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                            <XAxis dataKey="month" stroke="#64748b" fontSize={11} tickLine={false} />
                            <YAxis 
                                stroke="#64748b" 
                                fontSize={11} 
                                tickLine={false} 
                                tickFormatter={(val) => `${Math.round(val / 10000)}만`} 
                            />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: '#0f172a',
                                    borderColor: '#334155',
                                    borderRadius: '0.75rem',
                                    fontSize: '12px'
                                }}
                                formatter={(val: any, name: string) => {
                                    if (name === '월별 금융소득') return [formatWon(Number(val)), name];
                                    if (name === '연간 누적액') return [formatWon(Number(val)), name];
                                    return [val, name];
                                }}
                            />
                            <ReferenceLine 
                                y={20_000_000} 
                                stroke="#f43f5e" 
                                strokeDasharray="4 4" 
                                label={{ value: '2,000만원 한도선', fill: '#f43f5e', fontSize: 11, position: 'top' }} 
                            />
                            <Bar dataKey="monthly_income" name="월별 금융소득" fill="#6366f1" radius={[4, 4, 0, 0]} />
                            <Line 
                                type="monotone" 
                                dataKey="accumulated_income" 
                                name="연간 누적액" 
                                stroke="#10b981" 
                                strokeWidth={2.5} 
                                dot={{ r: 3, fill: '#10b981' }} 
                            />
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* 5. CFP & 세무 최적화 처방전 */}
            <div className="bg-indigo-950/20 border border-indigo-500/20 rounded-xl p-4 md:p-5 space-y-3">
                <div className="flex items-center gap-2 text-indigo-300 font-bold text-sm">
                    <Info className="w-4 h-4 text-indigo-400" />
                    CFP & 세무 전문가의 방어 전략 권고안 (Action Plan)
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                    {recommendations.map((rec: any, idx: number) => (
                        <div 
                            key={idx} 
                            className={`p-3.5 rounded-xl border flex flex-col justify-between ${
                                rec.priority === 'URGENT' 
                                    ? 'bg-rose-500/10 border-rose-500/30' 
                                    : rec.priority === 'HIGH'
                                    ? 'bg-amber-500/10 border-amber-500/30'
                                    : 'bg-slate-800/40 border-slate-700/60'
                            }`}
                        >
                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                                        <ChevronRight className="w-3.5 h-3.5 text-indigo-400" />
                                        {rec.title}
                                    </span>
                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                        rec.priority === 'URGENT' ? 'bg-rose-500/30 text-rose-300' :
                                        rec.priority === 'HIGH' ? 'bg-amber-500/30 text-amber-300' :
                                        'bg-slate-700 text-slate-300'
                                    }`}>
                                        {rec.priority}
                                    </span>
                                </div>
                                <p className="text-xs text-slate-300 leading-relaxed">
                                    {rec.desc}
                                </p>
                            </div>
                            {rec.expected_saving_krw > 0 && (
                                <div className="mt-3 pt-2 border-t border-white/5 flex items-center justify-between text-xs">
                                    <span className="text-slate-400">예상 비용 절감액:</span>
                                    <span className="text-emerald-400 font-bold">
                                        연 {formatWon(rec.expected_saving_krw)} 절감
                                    </span>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
