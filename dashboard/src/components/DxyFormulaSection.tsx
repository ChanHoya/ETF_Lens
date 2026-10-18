'use client';

import React from 'react';
import { Calculator, Scale, ArrowDownRight, ArrowUpRight, HelpCircle, Layers, Info } from 'lucide-react';

interface CurrencyItem {
    key: string;
    currency: string;
    symbol: string;
    weight: number;
    power: number;
    value?: number | null;
    chg_1y?: number | null;
    color: string;
}

const BASKET_DETAILS: CurrencyItem[] = [
    { key: 'eurusd', currency: '유로', symbol: 'EUR/USD', weight: 57.6, power: -0.576, color: '#3b82f6' },
    { key: 'usdjpy', currency: '일본 엔', symbol: 'USD/JPY', weight: 13.6, power: 0.136, color: '#f59e0b' },
    { key: 'gbpusd', currency: '영국 파운드', symbol: 'GBP/USD', weight: 11.9, power: -0.119, color: '#8b5cf6' },
    { key: 'usdcad', currency: '캐나다 달러', symbol: 'USD/CAD', weight: 9.1, power: 0.091, color: '#10b981' },
    { key: 'usdsek', currency: '스웨덴 크로나', symbol: 'USD/SEK', weight: 4.2, power: 0.042, color: '#ec4899' },
    { key: 'usdchf', currency: '스위스 프랑', symbol: 'USD/CHF', weight: 3.6, power: 0.036, color: '#14b8a6' },
];

export default function DxyFormulaSection({ basketData }: { basketData?: any[] }) {
    return (
        <div className="mt-4 space-y-3.5 animate-in fade-in duration-300">
            {/* 1. 산출 공식 및 핵심 개요 */}
            <div className="bg-[#15192c] border border-indigo-500/25 rounded-2xl p-4 shadow-lg">
                <div className="flex items-center gap-2 mb-2">
                    <span className="p-1 rounded-md bg-indigo-500/20 text-indigo-400">
                        <Calculator className="w-4 h-4" />
                    </span>
                    <h4 className="text-sm font-extrabold text-white">달러 인덱스 (DXY) 산출 공식 및 가중치</h4>
                    <span className="text-[10px] text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20 ml-auto">
                        1973년 3월 = 100 기준
                    </span>
                </div>

                <p className="text-xs text-gray-300 leading-relaxed mb-3">
                    달러 인덱스(DXY)는 미국 달러를 <b>6개 주요 통화</b>와 비교해, 각 통화 비중을 반영한 <b>가중기하평균(Geometric Weighted Average)</b>으로 산출한 지표입니다. 1973년 3월 브레튼우즈 체제 붕괴 직후를 기준값 <b>100</b>으로 두며, 수치가 높을수록 주요 통화 대비 미 달러가 강세임을 의미합니다.
                </p>

                {/* 수식 박스 */}
                <div className="bg-black/40 border border-white/10 rounded-xl p-3 font-mono text-center overflow-x-auto shadow-inner">
                    <div className="text-[11px] sm:text-xs text-amber-300 font-bold tracking-wide whitespace-nowrap">
                        DXY = 50.14348112 × (EURUSD)<sup>-0.576</sup> × (USDJPY)<sup>0.136</sup> × (GBPUSD)<sup>-0.119</sup> × (USDCAD)<sup>0.091</sup> × (USDSEK)<sup>0.042</sup> × (USDCHF)<sup>0.036</sup>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1 font-sans">
                        * 각 지수(승수)는 해당 통화의 비중 가중치이며, 비중의 절대치 합은 <b>100.0%</b>입니다.
                    </p>
                </div>
            </div>

            {/* 2. 구성 통화와 비중 표 */}
            <div className="bg-black/20 border border-white/10 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-2.5">
                    <div className="flex items-center gap-2">
                        <Scale className="w-4 h-4 text-emerald-400" />
                        <h5 className="text-xs font-bold text-gray-200">DXY 6대 바스켓 구성 통화 및 비중</h5>
                    </div>
                    <span className="text-[10px] text-gray-400">
                        유로 57.6% (최대 영향력)
                    </span>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-[11px] text-left">
                        <thead>
                            <tr className="border-b border-white/10 text-gray-400 font-medium">
                                <th className="py-1.5 px-2">통화명</th>
                                <th className="py-1.5 px-2">환율 표기</th>
                                <th className="py-1.5 px-2 text-right">가중치 (%)</th>
                                <th className="py-1.5 px-2 text-center">공식 승수</th>
                                <th className="py-1.5 px-2 text-right">최신 시세</th>
                                <th className="py-1.5 px-2 text-right">1년 변화</th>
                                <th className="py-1.5 px-2 text-center">달러 강세 시 방향</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {BASKET_DETAILS.map((b) => {
                                const live = basketData?.find((item: any) => item.key === b.key || item.symbol === b.symbol);
                                const val = live?.value;
                                const chg = live?.chg_1y;
                                const isDirect = b.power < 0; // EUR, GBP: 달러가 분모 (외화당 달러)

                                return (
                                    <tr key={b.key} className="hover:bg-white/[0.02] transition">
                                        <td className="py-2 px-2 font-semibold text-gray-200 flex items-center gap-1.5">
                                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: b.color }} />
                                            {b.currency}
                                        </td>
                                        <td className="py-2 px-2 font-mono text-gray-300 font-bold">{b.symbol}</td>
                                        <td className="py-2 px-2 text-right font-mono font-extrabold text-amber-300">
                                            {b.weight}%
                                        </td>
                                        <td className="py-2 px-2 text-center font-mono text-gray-400">
                                            {b.power > 0 ? `+${b.power}` : b.power}
                                        </td>
                                        <td className="py-2 px-2 text-right font-mono text-gray-100">
                                            {val != null ? (typeof val === 'number' && val > 10 ? val.toFixed(2) : val.toFixed(4)) : '-'}
                                        </td>
                                        <td className="py-2 px-2 text-right font-mono font-bold">
                                            {chg != null ? (
                                                <span className={chg > 0 ? 'text-red-400' : 'text-blue-400'}>
                                                    {chg > 0 ? '+' : ''}{chg.toFixed(2)}%
                                                </span>
                                            ) : '-'}
                                        </td>
                                        <td className="py-2 px-2 text-center">
                                            {isDirect ? (
                                                <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20">
                                                    <ArrowDownRight className="w-3 h-3" /> 하락 (역방향)
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20">
                                                    <ArrowUpRight className="w-3 h-3" /> 상승 (정방향)
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                <div className="mt-2.5 p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-[11px] text-indigo-300 flex items-start gap-1.5">
                    <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span><b>유로(EUR)가 57.6%</b>로 절반 이상을 차지하므로, DXY는 사실상 유로 대비 달러 가치에 가장 절대적인 영향을 받습니다.</span>
                </div>
            </div>

            {/* 3. 환율 방향이 다른 이유 & DXY 해석 가이드 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* 3-1. 환율 방향이 다른 이유 */}
                <div className="bg-black/20 border border-white/10 rounded-2xl p-3.5 space-y-1.5">
                    <h6 className="text-xs font-bold text-gray-200 flex items-center gap-1.5">
                        <ArrowDownRight className="w-3.5 h-3.5 text-amber-400" />
                        환율 표기 방향(지수 부호)이 다른 이유
                    </h6>
                    <ul className="text-[11px] text-gray-400 space-y-1 leading-relaxed">
                        <li>
                            • <b className="text-gray-200">EUR/USD, GBP/USD</b>: &lsquo;외화 1단위당 달러 수&rsquo;를 뜻하므로, <b>달러 강세 시 환율 수치가 하락</b>합니다. 따라서 지수 산출 공식에서 <b>음수(-) 승수</b>를 사용합니다.
                        </li>
                        <li>
                            • <b className="text-gray-200">USD/JPY, USD/CAD, USD/SEK, USD/CHF</b>: &lsquo;달러 1달러당 외화 수&rsquo;를 뜻하므로, <b>달러 강세 시 환율 수치가 상승</b>합니다. 따라서 공식에서 <b>양수(+) 승수</b>를 사용합니다.
                        </li>
                    </ul>
                </div>

                {/* 3-2. DXY 수치 해석 및 원/달러 관계 */}
                <div className="bg-black/20 border border-white/10 rounded-2xl p-3.5 space-y-1.5">
                    <h6 className="text-xs font-bold text-gray-200 flex items-center gap-1.5">
                        <HelpCircle className="w-3.5 h-3.5 text-sky-400" />
                        수치 해석 및 원/달러(KRW)와의 관계
                    </h6>
                    <ul className="text-[11px] text-gray-400 space-y-1 leading-relaxed">
                        <li>
                            • <b>100 기준</b>: DXY가 100이면 1973년 3월 기준과 동일한 상대 가치이며, <b>110이면 약 10% 강세, 90이면 약 10% 약세</b>로 해석합니다.
                        </li>
                        <li>
                            • <b className="text-amber-300">원/달러 환율은 DXY 바스켓에 미포함</b>: 한국 원화는 6대 통화에 속하지 않으므로, 국내 수출입 수급이나 지정학적 요인, 대미 금리차 등에 의해 DXY와 방향이 다르게 움직일 수 있습니다.
                        </li>
                    </ul>
                </div>
            </div>
        </div>
    );
}
