'use client';

import React, { useState, useMemo } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  TrendingDown,
  DollarSign,
  PieChart,
  Percent,
  Sliders,
  Sparkles,
  Zap,
  Home,
  CreditCard,
  Layers,
  ArrowRight,
  Info,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

export default function RealEstateMortgageShieldWidget() {
  // 사용자 부동산 자산 및 대출 프로필 (기본값 설정 및 즉시 인터랙티브 조정 가능)
  const [propertyTitle, setPropertyTitle] = useState<string>('마포 래미안푸르지오 84㎡ (자가)');
  const [propertyValueWon, setPropertyValueWon] = useState<number>(120000); // 12억 원 (만원 단위)
  const [mortgageBalanceWon, setMortgageBalanceWon] = useState<number>(45000); // 4.5억 원 (만원 단위)
  const [mortgageRate, setMortgageRate] = useState<number>(4.2); // 연 4.2%
  const [repaymentType, setRepaymentType] = useState<'bullet' | 'amortizing'>('bullet'); // bullet(만기일시), amortizing(원리금균등)
  const [loanYears, setLoanYears] = useState<number>(30); // 30년

  // ETF 월간 배당금 수령액 (기본값: 월 272만 원)
  const [monthlyDividendWon, setMonthlyDividendWon] = useState<number>(272); // 272만 원

  // 금리 스트레스 테스트 시나리오 (+1.0%p, 0%p, -0.5%p)
  const [rateShift, setRateShift] = useState<number>(0);

  // 계산
  const effectiveRate = Math.max(1.0, mortgageRate + rateShift);
  const loanPrincipalWon = mortgageBalanceWon * 10000; // 원 단위

  // 순자산
  const netEquityWon = (propertyValueWon - mortgageBalanceWon) * 10000;
  const ltvRatio = propertyValueWon > 0 ? (mortgageBalanceWon / propertyValueWon) * 100 : 0;

  // 월 대출 이자 (순수 이자)
  const monthlyInterestWon = Math.round((loanPrincipalWon * (effectiveRate / 100)) / 12);

  // 월 원리금 균등 상환액
  const monthlyAmortizingWon = useMemo(() => {
    const r = effectiveRate / 100 / 12;
    const n = loanYears * 12;
    if (r === 0) return Math.round(loanPrincipalWon / n);
    return Math.round((loanPrincipalWon * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1));
  }, [loanPrincipalWon, effectiveRate, loanYears]);

  const targetMonthlyPaymentWon =
    repaymentType === 'bullet' ? monthlyInterestWon : monthlyAmortizingWon;

  const currentDividendWon = monthlyDividendWon * 10000; // 원 단위

  // 이자 보상 배율 (ICR)
  const icrRatio = monthlyInterestWon > 0 ? (currentDividendWon / monthlyInterestWon) * 100 : 999;

  // 원리금 커버리지 배율 (DSCR)
  const dscrRatio = targetMonthlyPaymentWon > 0 ? (currentDividendWon / targetMonthlyPaymentWon) * 100 : 999;

  // 월간 흑자/적자 잉여 현금흐름 (Surplus Cashflow)
  const monthlySurplusWon = currentDividendWon - targetMonthlyPaymentWon;

  // 안전 진단 상태
  const isSafe = dscrRatio >= 100;
  const isPartialSafe = dscrRatio >= 70 && dscrRatio < 100;

  return (
    <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white shadow-xl border border-indigo-500/20 mt-8 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* 헤더 */}
      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-3 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-md text-[10.5px] font-bold tracking-wider uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
              Personal Wealth Shield
            </span>
            <span className="text-xs text-indigo-300 font-medium flex items-center gap-1">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              배당 현금흐름 부채 방어 엔진 (ICR / DSCR)
            </span>
          </div>
          <h3 className="text-lg sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <Home className="w-6 h-6 text-indigo-400" />
            내 부동산 자산 & 배당금 대출이자 방어율 (ICR) 위젯
          </h3>
          <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed">
            월급을 쪼개 대출 이자를 갚는 하우스푸어 위험에서 벗어나, 
            <strong> 주식/ETF 배당금으로 주담대 원리금을 몇 %나 자체 방어(Cashflow Shield)</strong>하고 있는지 실시간 진단합니다.
          </p>
        </div>

        {/* 뱃지 */}
        <div className="shrink-0 p-3 rounded-xl bg-slate-800/90 border border-slate-700/80 text-center">
          <div className="text-[11px] text-slate-400 font-medium">배당 대출이자 보상배율(ICR)</div>
          <div
            className={`text-xl sm:text-2xl font-black mt-0.5 ${
              icrRatio >= 100 ? 'text-emerald-400' : icrRatio >= 70 ? 'text-amber-400' : 'text-rose-400'
            }`}
          >
            {icrRatio.toFixed(0)}%
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            {icrRatio >= 100 ? '🟢 이자 100% 완전 방어' : '🟡 부분 방어 (추가 배당 필요)'}
          </div>
        </div>
      </div>

      {/* 2열 레이아웃: 좌측 인풋 패널 vs 우측 방어율 진단 보드 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 relative z-10">
        {/* 좌측 5열: 내 부동산 및 대출 조건 입력 */}
        <div className="lg:col-span-5 p-4 rounded-xl bg-slate-800/70 border border-slate-700/80 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-700/60">
            <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
              <CreditCard className="w-4 h-4 text-indigo-400" />
              내 부동산 및 대출 조건 설정
            </span>
            <span className="text-[11px] text-indigo-300 font-medium">실시간 반영</span>
          </div>

          <div>
            <label className="text-[11px] text-slate-400 block mb-1">보유 부동산 명칭 / 구분</label>
            <input
              type="text"
              value={propertyTitle}
              onChange={e => setPropertyTitle(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">부동산 추정 시세</label>
              <div className="relative">
                <input
                  type="number"
                  step="1000"
                  value={propertyValueWon}
                  onChange={e => setPropertyValueWon(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs font-bold text-white pr-10 focus:outline-none focus:border-indigo-500"
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-slate-400">
                  만원 ({(propertyValueWon / 10000).toFixed(1)}억)
                </span>
              </div>
            </div>

            <div>
              <label className="text-[11px] text-slate-400 block mb-1">주담대 대출 잔액</label>
              <div className="relative">
                <input
                  type="number"
                  step="1000"
                  value={mortgageBalanceWon}
                  onChange={e => setMortgageBalanceWon(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs font-bold text-white pr-10 focus:outline-none focus:border-indigo-500"
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-slate-400">
                  만원 ({(mortgageBalanceWon / 10000).toFixed(1)}억)
                </span>
              </div>
            </div>
          </div>

          {/* 대출 금리 및 상환 방식 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] text-slate-400">대출 금리</label>
                <span className="text-xs font-bold text-amber-400">{effectiveRate.toFixed(1)}%</span>
              </div>
              <input
                type="range"
                min="2.0"
                max="8.0"
                step="0.1"
                value={mortgageRate}
                onChange={e => setMortgageRate(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
            </div>

            <div>
              <label className="text-[11px] text-slate-400 block mb-1">상환 방식</label>
              <div className="grid grid-cols-2 gap-1 bg-slate-900 p-1 rounded-lg border border-slate-700">
                <button
                  type="button"
                  onClick={() => setRepaymentType('bullet')}
                  className={`py-1 text-[11px] font-bold rounded ${
                    repaymentType === 'bullet' ? 'bg-indigo-600 text-white' : 'text-slate-400'
                  }`}
                >
                  만기일시(이자만)
                </button>
                <button
                  type="button"
                  onClick={() => setRepaymentType('amortizing')}
                  className={`py-1 text-[11px] font-bold rounded ${
                    repaymentType === 'amortizing' ? 'bg-indigo-600 text-white' : 'text-slate-400'
                  }`}
                >
                  원리금균등
                </button>
              </div>
            </div>
          </div>

          {/* 배당금 슬라이더 */}
          <div className="pt-2 border-t border-slate-700/60">
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] text-emerald-400 font-bold flex items-center gap-1">
                <DollarSign className="w-3.5 h-3.5" />
                내 월간 ETF 배당금 수령액
              </label>
              <span className="text-xs font-extrabold text-emerald-400">
                월 {monthlyDividendWon.toLocaleString()}만 원
              </span>
            </div>
            <input
              type="range"
              min="50"
              max="800"
              step="10"
              value={monthlyDividendWon}
              onChange={e => setMonthlyDividendWon(Number(e.target.value))}
              className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />
            <div className="flex justify-between text-[9px] text-slate-400 mt-1">
              <span>월 50만</span>
              <span>월 272만 (기본 5억 포트)</span>
              <span>월 800만</span>
            </div>
          </div>

          {/* 금리 시나리오 칩 */}
          <div className="flex items-center gap-1.5 pt-1 text-[10.5px]">
            <span className="text-slate-400">금리 시나리오:</span>
            {[
              { shift: 0, label: '현재 기준' },
              { shift: 1.0, label: '+1.0%p 인상 스트레스' },
              { shift: -0.5, label: '-0.5%p 인하 수혜' }
            ].map(sc => (
              <button
                key={sc.shift}
                type="button"
                onClick={() => setRateShift(sc.shift)}
                className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                  rateShift === sc.shift
                    ? 'bg-amber-500/30 text-amber-300 border border-amber-400/40'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                }`}
              >
                {sc.label}
              </button>
            ))}
          </div>
        </div>

        {/* 우측 7열: 배당금 vs 대출 원리금 방어 진단 대시보드 */}
        <div className="lg:col-span-7 flex flex-col justify-between p-4 rounded-xl bg-slate-800/70 border border-slate-700/80">
          <div>
            {/* 상단 3분할 KPI 카드 */}
            <div className="grid grid-cols-3 gap-2.5 mb-4 text-center">
              <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-700">
                <span className="text-[10px] text-slate-400 block font-medium">월 주담대 부담액</span>
                <span className="text-sm sm:text-base font-extrabold text-rose-400 mt-1 block">
                  {(targetMonthlyPaymentWon / 10000).toFixed(1)}만 원
                </span>
                <span className="text-[9.5px] text-slate-500">
                  {repaymentType === 'bullet' ? '순수 이자만' : '원금+이자 합산'}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-900/90 border border-emerald-900/50">
                <span className="text-[10px] text-emerald-300 block font-medium">월 ETF 배당금 유입</span>
                <span className="text-sm sm:text-base font-extrabold text-emerald-400 mt-1 block">
                  +{(currentDividendWon / 10000).toFixed(1)}만 원
                </span>
                <span className="text-[9.5px] text-emerald-500/80">확정적 월 현금흐름</span>
              </div>

              <div
                className={`p-3 rounded-xl border ${
                  monthlySurplusWon >= 0
                    ? 'bg-emerald-950/40 border-emerald-500/40'
                    : 'bg-rose-950/40 border-rose-500/40'
                }`}
              >
                <span className="text-[10px] text-slate-300 block font-medium">월 실질 잉여/부족액</span>
                <span
                  className={`text-sm sm:text-base font-black mt-1 block ${
                    monthlySurplusWon >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {monthlySurplusWon >= 0 ? '+' : ''}
                  {(monthlySurplusWon / 10000).toFixed(1)}만 원
                </span>
                <span className="text-[9.5px] text-slate-400">
                  {monthlySurplusWon >= 0 ? '완전 흑자 잉여' : '월급에서 추가 유출'}
                </span>
              </div>
            </div>

            {/* 비주얼 게이지 바 */}
            <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-700/80 mb-4">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-bold text-slate-300 flex items-center gap-1.5">
                  <PieChart className="w-4 h-4 text-indigo-400" />
                  배당금 부채 상환 방어 게이지 (DSCR)
                </span>
                <span
                  className={`font-black text-sm ${
                    dscrRatio >= 100 ? 'text-emerald-400' : dscrRatio >= 70 ? 'text-amber-400' : 'text-rose-400'
                  }`}
                >
                  {dscrRatio.toFixed(0)}% 방어
                </span>
              </div>
              <div className="w-full h-3 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    dscrRatio >= 100 ? 'bg-emerald-500' : dscrRatio >= 70 ? 'bg-amber-500' : 'bg-rose-500'
                  }`}
                  style={{ width: `${Math.min(dscrRatio, 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                <span>0% (위험)</span>
                <span>50% (주의)</span>
                <span>100% (완전 자립 마지노선)</span>
                <span>150%+ (초과 잉여)</span>
              </div>
            </div>

            {/* 순자산 요약 정보 */}
            <div className="grid grid-cols-2 gap-2 text-xs p-2.5 rounded-lg bg-slate-900/50 border border-slate-700/50 text-slate-300">
              <div>
                <span className="text-slate-400 block text-[10.5px]">부동산 순자산(Equity)</span>
                <span className="font-bold text-white text-sm">
                  {(netEquityWon / 100000000).toFixed(1)}억 원
                </span>
                <span className="text-[10px] text-slate-400"> (시세 대비 {(100 - ltvRatio).toFixed(1)}% 순자산)</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10.5px]">대출 LTV 비율</span>
                <span className={`font-bold text-sm ${ltvRatio > 50 ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {ltvRatio.toFixed(1)}%
                </span>
                <span className="text-[10px] text-slate-400">
                  {ltvRatio <= 40 ? ' (건전 담보비율)' : ' (대출 관리 필요)'}
                </span>
              </div>
            </div>
          </div>

          {/* 전문가 조언 코멘트 */}
          <div className="mt-4 p-3 rounded-xl bg-indigo-950/40 border border-indigo-500/30 text-xs text-indigo-200 leading-relaxed flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              {dscrRatio >= 100 ? (
                <span>
                  <strong>🎉 완벽한 자급자족 방어:</strong> 현재 ETF 월 배당금(+{(currentDividendWon / 10000).toFixed(1)}만 원)이 주담대 월 납입액({(targetMonthlyPaymentWon / 10000).toFixed(1)}만 원)을 
                  <strong> {dscrRatio.toFixed(0)}% 초과 방어</strong>하고 있습니다. 근로소득(월급)을 전혀 건드리지 않고도 대출을 감당할 수 있어 하우스푸어 위험이 완전히 차단되었습니다.
                </span>
              ) : (
                <span>
                  <strong>⚠️ 유동성 방어 보강 권고:</strong> 현재 배당금으로 대출금의 <strong>{dscrRatio.toFixed(0)}%</strong>만 충당되고 있어, 매달 약 <strong>{Math.abs(monthlySurplusWon / 10000).toFixed(1)}만 원</strong>의 월급 유출이 발생합니다. 
                  고배당 ETF(SCHD, JEPQ 등) 비중을 점진 확대하여 방어율 100%를 달성하면 심리적·재무적 안정성이 획기적으로 향상됩니다.
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
