import React, { useState } from 'react';
import { Calculator, AlertTriangle, ArrowRight, DollarSign, Percent, Info } from 'lucide-react';

export default function TaxSimulator() {
    // Inputs
    const [investmentAmount, setInvestmentAmount] = useState<number>(50000000); // 원
    const [expectedReturnRate, setExpectedReturnRate] = useState<number>(10); // %
    const [expectedDividendYield, setExpectedDividendYield] = useState<number>(2); // %
    const [otherFinancialIncome, setOtherFinancialIncome] = useState<number>(0); // 원

    // Constants
    const DOMESTIC_DIVIDEND_TAX = 0.154; // 배당소득세 15.4%
    const OVERSEAS_CAPITAL_GAINS_TAX = 0.22; // 양도소득세 22%
    const OVERSEAS_DEDUCTION = 2500000; // 양도소득 기본공제 250만원
    const FINANCIAL_INCOME_THRESHOLD = 20000000; // 금융소득종합과세 기준 2천만원

    // Calculations
    const capitalGain = investmentAmount * (expectedReturnRate / 100);
    const dividendIncome = investmentAmount * (expectedDividendYield / 100);

    // 1. 국내 상장 해외 ETF (일반 계좌)
    // 매매차익도 배당소득으로 간주 (15.4%)
    const domesticTotalIncome = capitalGain + dividendIncome;
    const isDomesticOverThreshold = (domesticTotalIncome + otherFinancialIncome) > FINANCIAL_INCOME_THRESHOLD;

    // 단순 계산 (실제 종과세율은 누진세 적용이나, 시뮬레이터에서는 경고 수준으로 표시)
    const domesticTax = domesticTotalIncome * DOMESTIC_DIVIDEND_TAX;
    const domesticNetReturn = domesticTotalIncome - domesticTax;

    // 2. 해외 직상장 ETF (일반 계좌)
    // 배당은 배당소득세 15.4%, 매매차익은 양도소득세 22% (250만원 공제)
    const isOverseasDividendOverThreshold = (dividendIncome + otherFinancialIncome) > FINANCIAL_INCOME_THRESHOLD;

    const overseasDividendTax = dividendIncome * DOMESTIC_DIVIDEND_TAX;
    const taxableCapitalGain = Math.max(0, capitalGain - OVERSEAS_DEDUCTION);
    const overseasCapitalGainsTax = taxableCapitalGain * OVERSEAS_CAPITAL_GAINS_TAX;

    const overseasTotalTax = overseasDividendTax + overseasCapitalGainsTax;
    const overseasNetReturn = (capitalGain + dividendIncome) - overseasTotalTax;

    const formatNumber = (val: number) => new Intl.NumberFormat('ko-KR').format(Math.floor(val));

    return (
        <div className="bg-[#121217]/80 border border-white/10 rounded-3xl p-6 backdrop-blur-xl shadow-2xl mt-8">
            <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                <Calculator className="w-5 h-5 text-emerald-400" />
                절세 효율 시뮬레이터 <span className="text-sm font-normal text-gray-400 ml-2">(국내 상장 vs 해외 직상장 동일 지수 ETF 비교)</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Input Panel */}
                <div className="flex flex-col gap-4 bg-black/40 p-5 rounded-2xl border border-white/5">
                    <div>
                        <label className="text-sm text-gray-400 mb-1.5 block">투자 금액 (원)</label>
                        <div className="relative">
                            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                            <input
                                type="number"
                                value={investmentAmount}
                                onChange={(e) => setInvestmentAmount(Number(e.target.value))}
                                className="w-full bg-black/40 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-white focus:outline-none focus:border-emerald-500/50"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-sm text-gray-400 mb-1.5 block">예상 매매수익률 (%)</label>
                            <div className="relative">
                                <Percent className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                <input
                                    type="number"
                                    value={expectedReturnRate}
                                    onChange={(e) => setExpectedReturnRate(Number(e.target.value))}
                                    className="w-full bg-black/40 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-white focus:outline-none focus:border-emerald-500/50"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="text-sm text-gray-400 mb-1.5 block">예상 배당수익률 (%)</label>
                            <div className="relative">
                                <Percent className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                <input
                                    type="number"
                                    value={expectedDividendYield}
                                    onChange={(e) => setExpectedDividendYield(Number(e.target.value))}
                                    className="w-full bg-black/40 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-white focus:outline-none focus:border-emerald-500/50"
                                />
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="text-sm text-gray-400 mb-1.5 flex items-center gap-1.5">
                            기타 연간 금융소득 (원)
                            <span className="relative group">
                                <Info className="w-3.5 h-3.5 text-gray-500 cursor-help" />
                                <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-48 bg-gray-900 border border-white/10 text-xs p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none flex text-center">
                                    예금 이자, 타 주식 배당금 등 종합과세 대상 소득
                                </span>
                            </span>
                        </label>
                        <div className="relative">
                            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                            <input
                                type="number"
                                value={otherFinancialIncome}
                                onChange={(e) => setOtherFinancialIncome(Number(e.target.value))}
                                className="w-full bg-black/40 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-white focus:outline-none focus:border-emerald-500/50"
                            />
                        </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-white/10 bg-emerald-500/10 rounded-xl p-4 text-sm text-emerald-200">
                        총 예상 수익 <strong>{formatNumber(capitalGain + dividendIncome)}원</strong> 에 대한 세금을 비교합니다.
                    </div>
                </div>

                {/* Result Panel */}
                <div className="flex flex-col gap-4">
                    {/* Domestic */}
                    <div className={`p-4 rounded-xl border ${domesticNetReturn >= overseasNetReturn ? 'bg-indigo-500/10 border-indigo-500/30' : 'bg-white/5 border-white/10'}`}>
                        <div className="flex justify-between items-center mb-3">
                            <h4 className="font-bold text-gray-200">국내 상장 해외 ETF</h4>
                            {domesticNetReturn >= overseasNetReturn && <span className="text-xs bg-indigo-500 text-white px-2 py-0.5 rounded-full font-bold">유리함</span>}
                        </div>
                        <div className="flex flex-col gap-2 text-sm">
                            <div className="flex justify-between text-gray-400">
                                <span>적용 세관</span>
                                <span>배당소득세(15.4%) 전액 적용</span>
                            </div>
                            <div className="flex justify-between text-gray-400">
                                <span>총 세금</span>
                                <span className="text-rose-400 font-medium">-{formatNumber(domesticTax)} 원</span>
                            </div>
                            <div className="flex justify-between font-bold pt-2 border-t border-white/5">
                                <span className="text-gray-300">세후 순수익</span>
                                <span className="text-white text-lg">{formatNumber(domesticNetReturn)} 원</span>
                            </div>
                            {isDomesticOverThreshold && (
                                <div className="mt-2 text-xs text-amber-400 flex items-start gap-1.5 bg-amber-400/10 p-2 rounded-lg">
                                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                                    <span>주의: 비과세 한도 초과로 종합과세 대상이 되어 추가 누진세율(최대 49.5%)이 부과될 수 있습니다. ISA/연금 계좌 활용을 권장합니다.</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Overseas Direct */}
                    <div className={`p-4 rounded-xl border ${overseasNetReturn > domesticNetReturn ? 'bg-fuchsia-500/10 border-fuchsia-500/30' : 'bg-white/5 border-white/10'}`}>
                        <div className="flex justify-between items-center mb-3">
                            <h4 className="font-bold text-gray-200">미국 직상장 ETF</h4>
                            {overseasNetReturn > domesticNetReturn && <span className="text-xs bg-fuchsia-500 text-white px-2 py-0.5 rounded-full font-bold">유리함</span>}
                        </div>
                        <div className="flex flex-col gap-2 text-sm">
                            <div className="flex justify-between text-gray-400">
                                <span>적용 세관</span>
                                <span>양도세(22%, 250만 공제) + 배당세</span>
                            </div>
                            <div className="flex justify-between text-gray-400">
                                <span>총 세금</span>
                                <span className="text-rose-400 font-medium">-{formatNumber(overseasTotalTax)} 원</span>
                            </div>
                            <div className="flex justify-between font-bold pt-2 border-t border-white/5">
                                <span className="text-gray-300">세후 순수익</span>
                                <span className="text-white text-lg">{formatNumber(overseasNetReturn)} 원</span>
                            </div>
                            {isOverseasDividendOverThreshold && (
                                <div className="mt-2 text-xs text-amber-400 flex items-start gap-1.5 bg-amber-400/10 p-2 rounded-lg">
                                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                                    <span>주의: 기타 배당소득으로 인해 종합과세 대상이 될 수 있습니다. (매매차익은 완전 분리과세)</span>
                                </div>
                            )}
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}
