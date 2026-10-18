'use client';

import React, { useState, useMemo } from 'react';
import { TffFundData, TffHoldingsRow } from '../../../lib/tff/types';
import { Calculator, Wallet, CheckSquare, Square, Copy, Check, ArrowRight, Sparkles, RefreshCw, Layers } from 'lucide-react';

interface Props {
    data: TffFundData | null;
}

export default function TffDcaReinvestmentPlanner({ data }: Props) {
    const formatMoney = (val: number) => new Intl.NumberFormat('ko-KR').format(Math.round(val));

    // Base settings: 10 members x 100,000 KRW
    const [monthlyDca, setMonthlyDca] = useState(1000000); // 100만원
    const [includeCashBalance, setIncludeCashBalance] = useState(false);
    const [copied, setCopied] = useState(false);
    const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});

    const latestMonthInfo = data?.monthlyMap[data?.latestMonth || ''] || data?.ytm;
    const realHoldings: TffHoldingsRow[] = useMemo(() => {
        const list = (latestMonthInfo?.holdings || []).filter(h => h.endValue > 0);
        if (list.length > 0) return list;
        return [
            { name: 'TIGER 미국S&P500', endValue: 4850000, beginValue: 4500000, buyAmount: 0, sellAmount: 0, dividend: 35000, creditInterest: 0, investmentPnl: 350000 },
            { name: 'KODEX 미국나스닥100TR', endValue: 3950000, beginValue: 3700000, buyAmount: 0, sellAmount: 0, dividend: 0, creditInterest: 0, investmentPnl: 250000 },
            { name: 'KODEX 반도체', endValue: 3200000, beginValue: 2900000, buyAmount: 0, sellAmount: 0, dividend: 22000, creditInterest: 0, investmentPnl: 300000 },
            { name: 'ACE 미국배당다우존스(H)', endValue: 2800000, beginValue: 2650000, buyAmount: 0, sellAmount: 0, dividend: 48000, creditInterest: 0, investmentPnl: 150000 },
            { name: 'ACE KRX금현물', endValue: 1950000, beginValue: 1800000, buyAmount: 0, sellAmount: 0, dividend: 0, creditInterest: 0, investmentPnl: 150000 }
        ];
    }, [latestMonthInfo]);

    // Available Dividend Pool from real holdings
    const autoDividendPool = useMemo(() => {
        return realHoldings.reduce((sum, h) => sum + (h.dividend || 0), 0) || (latestMonthInfo?.summary?.totalDividend || 150000);
    }, [realHoldings, latestMonthInfo]);

    const [dividendPool, setDividendPool] = useState<number>(autoDividendPool);

    // Sync default if autoDividendPool changes
    React.useEffect(() => {
        if (autoDividendPool > 0) setDividendPool(autoDividendPool);
    }, [autoDividendPool]);

    const cashBalance = latestMonthInfo?.summary?.cashBalance || 0;

    // Total Budget to deploy this month
    const totalBudget = monthlyDca + dividendPool + (includeCashBalance ? cashBalance : 0);
    const totalCurrentVal = realHoldings.reduce((sum, h) => sum + h.endValue, 0) || 1;

    // Target weights and allocation calculation
    // Ideal target: equally distributed among top core ETFs or proportional to currently largest
    const allocationResults = useMemo(() => {
        if (realHoldings.length === 0) return [];

        // Equal target or normalized weight target
        const count = realHoldings.length;
        const targetWeightPct = 100 / count; // 균등 분산 기준

        // Estimate share price (proxy)
        return realHoldings.map(h => {
            const currentWeightPct = (h.endValue / totalCurrentVal) * 100;
            // Gap: if current weight < target, prioritize
            const deficitPct = Math.max(0, targetWeightPct - currentWeightPct);

            // Unit price estimation proxy: default ~20,000 KRW if unknown
            const estimatedPrice = h.endValue > 1000000 ? Math.round(h.endValue / 100) : 25000;

            return {
                name: h.name,
                endValue: h.endValue,
                currentWeightPct,
                targetWeightPct,
                deficitPct,
                estimatedPrice
            };
        });
    }, [realHoldings, totalCurrentVal]);

    // Distribute totalBudget proportionally to deficit (or equally among top underweighted)
    const orderProposals = useMemo(() => {
        const totalDeficit = allocationResults.reduce((s, r) => s + r.deficitPct, 0);

        return allocationResults.map(r => {
            let allocatedMoney = 0;
            if (totalDeficit > 0) {
                allocatedMoney = Math.round((r.deficitPct / totalDeficit) * totalBudget);
            } else {
                allocatedMoney = Math.round(totalBudget / allocationResults.length);
            }

            const buyShares = Math.floor(allocatedMoney / (r.estimatedPrice || 25000));
            const actualCost = buyShares * (r.estimatedPrice || 25000);
            const expectedEndValue = r.endValue + actualCost;
            const newTotal = totalCurrentVal + totalBudget;
            const expectedWeightPct = (expectedEndValue / newTotal) * 100;

            return {
                ...r,
                allocatedMoney,
                buyShares: Math.max(1, buyShares),
                actualCost,
                expectedWeightPct
            };
        }).sort((a, b) => b.allocatedMoney - a.allocatedMoney);
    }, [allocationResults, totalBudget, totalCurrentVal]);

    const totalDeployCost = orderProposals.reduce((sum, p) => sum + p.actualCost, 0);
    const leftoverCash = Math.max(0, totalBudget - totalDeployCost);

    const toggleCheck = (name: string) => {
        setCheckedItems(prev => ({ ...prev, [name]: !prev[name] }));
    };

    const handleCopyGuide = () => {
        const text = `📋 [TFF 펀드 이번 달 적립 & 배당 재투자 매수 집행 가이드]\n\n` +
            `💰 이번 달 가용 자금: 총 ${formatMoney(totalBudget)}원\n` +
            ` (10인 적립금: ${formatMoney(monthlyDca)}원 + 재투자 배당금: ${formatMoney(dividendPool)}원)\n` +
            `━━━━━━━━━━━━━━━━━━━━\n` +
            `🎯 권장 매수 주문 목록:\n` +
            orderProposals.slice(0, 6).map((p, i) => 
                ` ${i + 1}. ${p.name} : 약 ${p.buyShares}주 매수 (약 ${formatMoney(p.actualCost)}원)`
            ).join('\n') + '\n' +
            `━━━━━━━━━━━━━━━━━━━━\n` +
            `💵 예상 잔여 예수금: 약 ${formatMoney(leftoverCash)}원 (다음 달로 이월)`;

        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
    };


    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            
            {/* Top Concept Banner */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-amber-950/40 via-sky-950/30 to-indigo-950/40 border border-amber-500/20">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <span className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400">
                            <Calculator className="w-4 h-4" />
                        </span>
                        <h3 className="text-base font-bold text-white">
                            월간 적립식(DCA) 100만 원 + 배당금 100% 재투자 매수 플래너
                        </h3>
                    </div>
                    <p className="text-xs text-gray-300 leading-relaxed max-w-2xl">
                        10명의 멤버가 매월 입금한 100만 원과 펀드에서 발생한 배당금을 합산하여, 현재 비중이 덜 찬 종목을 자동으로 계산해 실전 매수 수량을 도출합니다.
                    </p>
                </div>

                <button
                    onClick={handleCopyGuide}
                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all border shrink-0 ${
                        copied
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border-amber-500/30'
                    }`}
                >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copied ? '복사 완료!' : '매수 주문 가이드 복사'}
                </button>
            </div>

            {/* Inputs & Total Budget Pool Card */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                
                {/* 1. Monthly DCA Input */}
                <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10">
                    <span className="text-xs text-gray-400 block mb-1 font-medium">
                        10인 멤버 정기 적립금 (월 10만 원 × 10인)
                    </span>
                    <div className="flex items-center gap-2">
                        <input
                            type="number"
                            value={monthlyDca}
                            onChange={(e) => setMonthlyDca(Number(e.target.value))}
                            className="w-full bg-black/50 border border-white/20 rounded-xl px-3 py-2 text-white font-bold text-lg focus:outline-none focus:border-amber-400"
                        />
                        <span className="text-xs text-gray-400 shrink-0">원</span>
                    </div>
                    <span className="text-[10px] text-gray-500 mt-1 block">
                        매월 고정 납입 풀
                    </span>
                </div>

                {/* 2. Reinvestment Dividend Pool */}
                <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10">
                    <span className="text-xs text-gray-400 block mb-1 font-medium">
                        이번 달 유입 배당금 풀 (100% 재투자)
                    </span>
                    <div className="flex items-center gap-2">
                        <input
                            type="number"
                            value={dividendPool}
                            onChange={(e) => setDividendPool(Number(e.target.value))}
                            className="w-full bg-black/50 border border-white/20 rounded-xl px-3 py-2 text-amber-300 font-bold text-lg focus:outline-none focus:border-amber-400"
                        />
                        <span className="text-xs text-gray-400 shrink-0">원</span>
                    </div>
                    <span className="text-[10px] text-amber-400/80 mt-1 block">
                        보유 ETF 실제 배당금 자동 계산치
                    </span>
                </div>

                {/* 3. Total Deploy Budget Summary */}
                <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-500/10 via-orange-500/10 to-amber-600/10 border border-amber-500/30 flex flex-col justify-between">
                    <div>
                        <span className="text-xs text-amber-300 font-bold uppercase tracking-wider block mb-1">
                            이번 달 총 가용 매수 예산
                        </span>
                        <div className="text-2xl font-black text-amber-200">
                            {formatMoney(totalBudget)}원
                        </div>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-gray-400 pt-2 border-t border-amber-500/20">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={includeCashBalance}
                                onChange={(e) => setIncludeCashBalance(e.target.checked)}
                                className="rounded bg-black/40 border-white/20 text-amber-500 focus:ring-0"
                            />
                            <span>기존 잔여 예수금({formatMoney(cashBalance)}원) 합산</span>
                        </label>
                    </div>
                </div>

            </div>

            {/* Practical Order Allocation Table */}
            <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/10">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                    <div>
                        <h4 className="text-sm font-bold text-white flex items-center gap-2">
                            <Layers className="w-4 h-4 text-amber-400" />
                            목표 비중 역산 기반 이번 달 권장 매수 포트폴리오
                        </h4>
                        <p className="text-[11px] text-gray-400">
                            현재 비중이 목표치보다 부족한(Underweight) 종목에 가용 예산을 우선 배분했습니다.
                        </p>
                    </div>
                    <div className="text-right text-xs">
                        <span className="text-gray-400">예상 매수 집행액: </span>
                        <span className="font-bold text-white">{formatMoney(totalDeployCost)}원</span>
                        <span className="text-[10px] text-gray-500 block">잔여 예수금 {formatMoney(leftoverCash)}원</span>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                        <thead>
                            <tr className="border-b border-white/10 text-gray-400 text-[11px]">
                                <th className="pb-2.5 pl-2 font-medium w-8">체크</th>
                                <th className="pb-2.5 font-medium">종목명</th>
                                <th className="pb-2.5 text-right font-medium">현재 비중</th>
                                <th className="pb-2.5 text-right font-medium text-amber-400">권장 매수 수량</th>
                                <th className="pb-2.5 text-right font-medium text-amber-300">소요 예상액</th>
                                <th className="pb-2.5 text-right font-medium text-emerald-400">매수 후 비중</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {orderProposals.map((row, idx) => {
                                const isChecked = !!checkedItems[row.name];
                                return (
                                    <tr
                                        key={idx}
                                        onClick={() => toggleCheck(row.name)}
                                        className={`cursor-pointer transition-colors ${isChecked ? 'bg-emerald-500/5' : 'hover:bg-white/[0.02]'}`}
                                    >
                                        <td className="py-3 pl-2">
                                            {isChecked ? (
                                                <CheckSquare className="w-4 h-4 text-emerald-400" />
                                            ) : (
                                                <Square className="w-4 h-4 text-gray-500" />
                                            )}
                                        </td>
                                        <td className="py-3 font-bold text-white">
                                            <span className={`${isChecked ? 'line-through text-gray-400' : ''}`}>
                                                {row.name}
                                            </span>
                                        </td>
                                        <td className="py-3 text-right font-mono text-gray-300">
                                            {row.currentWeightPct.toFixed(1)}%
                                        </td>
                                        <td className="py-3 text-right font-bold text-amber-300 font-mono">
                                            약 {row.buyShares}주
                                        </td>
                                        <td className="py-3 text-right font-mono text-white">
                                            {formatMoney(row.actualCost)}원
                                        </td>
                                        <td className="py-3 text-right font-bold font-mono text-emerald-400">
                                            {row.expectedWeightPct.toFixed(1)}%
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                <div className="mt-4 p-3 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between text-[11px] text-gray-400">
                    <span>💡 매니저가 HTS/MTS에서 매수 주문 완료 후 각 항목을 클릭하여 체크리스트로 활용하세요.</span>
                    <span className="font-bold text-amber-400">
                        완료: {Object.values(checkedItems).filter(Boolean).length} / {orderProposals.length}
                    </span>
                </div>
            </div>

        </div>
    );
}
