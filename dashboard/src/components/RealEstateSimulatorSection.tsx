'use client';

import React, { useState, useMemo } from 'react';
import {
  Scale,
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  ShieldCheck,
  Percent,
  Coins,
  Sparkles,
  PieChart,
  Layers,
  ArrowRight,
  Info,
  Calendar,
  Building,
  CreditCard
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend
} from 'recharts';
import { STANDARD_LEGEND_WRAPPER_STYLE, useChartHighlight } from '@/lib/chartTheme';
import {
  RepaymentMethod,
  SimulatorParams,
  calculateLoanRepayment,
  calculateAcquisitionCosts,
  calculateAnnualHoldingCosts,
  simulate10YearTrajectory,
  diagnoseHousePoorRisk
} from '@/lib/realEstateSimulator';

export default function RealEstateSimulatorSection() {
  const chartHighlight = useChartHighlight();
  // 기본 시뮬레이션 파라미터 상태
  const [propertyPrice, setPropertyPrice] = useState<number>(12); // 억원
  const [loanRatio, setLoanRatio] = useState<number>(40); // LTV %
  const [mortgageRate, setMortgageRate] = useState<number>(4.1); // %
  const [loanTenureYears, setLoanTenureYears] = useState<number>(30); // 30년
  const [repaymentMethod, setRepaymentMethod] = useState<RepaymentMethod>('amortization');
  const [homeCount, setHomeCount] = useState<1 | 2>(1);
  const [householdIncome, setHouseholdIncome] = useState<number>(8500); // 8,500만원
  const [rePriceGrowthRate, setRePriceGrowthRate] = useState<number>(1.5); // 연 1.5% 완만 상승
  const [etfDividendYield, setEtfDividendYield] = useState<number>(4.5); // 연 4.5% 배당
  const [etfCapitalGrowth, setEtfCapitalGrowth] = useState<number>(3.5); // 연 3.5% 주가성장

  // 상세 설정 토글
  const [showAdvancedSettings, setShowAdvancedSettings] = useState<boolean>(false);

  // 시뮬레이션 파라미터 객체
  const params: SimulatorParams = useMemo(() => ({
    propertyPrice,
    loanRatio,
    mortgageRate,
    loanTenureYears,
    repaymentMethod,
    homeCount,
    householdIncome,
    rePriceGrowthRate,
    etfDividendYield,
    etfCapitalGrowth,
  }), [
    propertyPrice,
    loanRatio,
    mortgageRate,
    loanTenureYears,
    repaymentMethod,
    homeCount,
    householdIncome,
    rePriceGrowthRate,
    etfDividendYield,
    etfCapitalGrowth
  ]);

  const propertyWon = propertyPrice * 100000000;
  const loanWon = propertyWon * (loanRatio / 100);
  const equityWon = propertyWon - loanWon;

  // 1. 대출 상환 계산
  const loanResult = useMemo(() => {
    return calculateLoanRepayment(loanWon, mortgageRate, loanTenureYears, repaymentMethod);
  }, [loanWon, mortgageRate, loanTenureYears, repaymentMethod]);

  // 2. 취득세 및 부대비용
  const acqCosts = useMemo(() => {
    return calculateAcquisitionCosts(propertyWon, homeCount);
  }, [propertyWon, homeCount]);

  // 3. 연간 보유세 및 관리비
  const holdingCosts = useMemo(() => {
    return calculateAnnualHoldingCosts(propertyWon, homeCount);
  }, [propertyWon, homeCount]);

  // 4. 10개년 궤적 시뮬레이션
  const trajectoryData = useMemo(() => {
    return simulate10YearTrajectory(params);
  }, [params]);

  // 5. DSR 하우스푸어 위험도 진단
  const housePoorDiagnosis = useMemo(() => {
    return diagnoseHousePoorRisk(loanResult.annualTotalPayment, householdIncome * 10000);
  }, [loanResult.annualTotalPayment, householdIncome]);

  // 월간 실질 현금흐름 대조
  const monthlyPropertyOutflow = useMemo(() => {
    // 월 원리금 + 월할 보유세 + 월할 관리비
    const monthlyHolding = holdingCosts.totalAnnualCost / 12;
    return Math.round(loanResult.monthlyPayment + monthlyHolding);
  }, [loanResult.monthlyPayment, holdingCosts.totalAnnualCost]);

  const etfInitialCapitalWon = equityWon + acqCosts.totalInitialCost;
  const monthlyEtfDividendInflow = useMemo(() => {
    // 세후 월 배당금 (배당소득세 15.4% 감안)
    const annualGross = etfInitialCapitalWon * (etfDividendYield / 100);
    const annualNet = annualGross * (1 - 0.154);
    return Math.round(annualNet / 12);
  }, [etfInitialCapitalWon, etfDividendYield]);

  // 월간 가처분 유동성 갭 (월 배당 유입 + 아파트 지출 절감액)
  const monthlyCashFlowGap = monthlyPropertyOutflow + monthlyEtfDividendInflow;

  // 10년차 최종 결과 포인트
  const final10Y = trajectoryData[trajectoryData.length - 1];
  const isEtfWinner = final10Y ? final10Y.etfNetWorth >= final10Y.reNetWorth : false;
  const finalNetWorthDiff = final10Y ? Math.abs(final10Y.etfNetWorth - final10Y.reNetWorth) : 0;

  return (
    <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-6">
      {/* 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Scale className="w-5 h-5 text-indigo-500" />
            <h3 className="font-bold text-slate-900 dark:text-slate-100 text-lg">
              실물 아파트 vs 배당 ETF 기회비용 & 10개년 복리 시뮬레이터 (S21)
            </h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            원리금균등 대출 상환·취득세·보유세 누적 유출비용 vs 동일 자본 배당 ETF 복리 재투자 시 10년 후 순자산과 월 현금흐름을 객관적으로 대조합니다.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
            className="text-[11px] font-semibold px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
          >
            {showAdvancedSettings ? "기본 설정 접기" : "⚙️ 세금·소득 정밀 설정"}
          </button>
          <span className="text-[11px] font-semibold px-2.5 py-1 rounded-md bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
            정밀 금융공학 모델
          </span>
        </div>
      </div>

      {/* 1. 기본 슬라이더 컨트롤 패널 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60">
        {/* 매매가 */}
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="font-semibold text-slate-700 dark:text-slate-300">부동산 매매가</span>
            <span className="font-bold text-indigo-600 dark:text-indigo-400">{propertyPrice} 억원</span>
          </div>
          <input
            type="range"
            min={5}
            max={30}
            step={1}
            value={propertyPrice}
            onChange={(e) => setPropertyPrice(Number(e.target.value))}
            className="w-full accent-indigo-600 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-400">
            <span>5억</span>
            <span>15억</span>
            <span>30억</span>
          </div>
        </div>

        {/* LTV */}
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="font-semibold text-slate-700 dark:text-slate-300">대출 비율 (LTV)</span>
            <span className="font-bold text-indigo-600 dark:text-indigo-400">{loanRatio}% ({(propertyPrice * (loanRatio / 100)).toFixed(1)}억)</span>
          </div>
          <input
            type="range"
            min={0}
            max={70}
            step={5}
            value={loanRatio}
            onChange={(e) => setLoanRatio(Number(e.target.value))}
            className="w-full accent-indigo-600 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-400">
            <span>0% (전액현금)</span>
            <span>40%</span>
            <span>70%</span>
          </div>
        </div>

        {/* 주담대 금리 */}
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="font-semibold text-slate-700 dark:text-slate-300">주담대 금리</span>
            <span className="font-bold text-indigo-600 dark:text-indigo-400">{mortgageRate}%</span>
          </div>
          <input
            type="range"
            min={3.0}
            max={6.5}
            step={0.1}
            value={mortgageRate}
            onChange={(e) => setMortgageRate(Number(e.target.value))}
            className="w-full accent-indigo-600 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-400">
            <span>3.0%</span>
            <span>4.1% (현재치)</span>
            <span>6.5%</span>
          </div>
        </div>

        {/* ETF 배당률 */}
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="font-semibold text-slate-700 dark:text-slate-300">ETF 연간 배당률</span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400">{etfDividendYield}%</span>
          </div>
          <input
            type="range"
            min={2.0}
            max={10.0}
            step={0.5}
            value={etfDividendYield}
            onChange={(e) => setEtfDividendYield(Number(e.target.value))}
            className="w-full accent-emerald-600 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-400">
            <span>2.5% (S&P500)</span>
            <span>4.5% (SCHD)</span>
            <span>10% (커버드콜)</span>
          </div>
        </div>
      </div>

      {/* 2. 대출 상환 방식 및 정밀 설정 패널 */}
      <div className="p-4 rounded-xl bg-slate-50/70 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-800 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-slate-500" />
            <span className="font-bold text-slate-700 dark:text-slate-200">대출 상환 방식:</span>
            <div className="inline-flex rounded-lg border border-slate-300 dark:border-slate-700 p-0.5 bg-white dark:bg-slate-900">
              <button
                type="button"
                onClick={() => setRepaymentMethod('amortization')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                  repaymentMethod === 'amortization'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                원리금균등 (일반)
              </button>
              <button
                type="button"
                onClick={() => setRepaymentMethod('equal_principal')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                  repaymentMethod === 'equal_principal'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                원금균등
              </button>
              <button
                type="button"
                onClick={() => setRepaymentMethod('bullet')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                  repaymentMethod === 'bullet'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                만기일시 (거치식)
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-500" />
            <span className="font-bold text-slate-700 dark:text-slate-200">대출 만기:</span>
            <div className="inline-flex rounded-lg border border-slate-300 dark:border-slate-700 p-0.5 bg-white dark:bg-slate-900">
              {[20, 30, 40].map((yr) => (
                <button
                  key={yr}
                  type="button"
                  onClick={() => setLoanTenureYears(yr)}
                  className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-all ${
                    loanTenureYears === yr
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  {yr}년
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Building className="w-4 h-4 text-slate-500" />
            <span className="font-bold text-slate-700 dark:text-slate-200">주택 수:</span>
            <div className="inline-flex rounded-lg border border-slate-300 dark:border-slate-700 p-0.5 bg-white dark:bg-slate-900">
              <button
                type="button"
                onClick={() => setHomeCount(1)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                  homeCount === 1
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                1주택 (기본세율)
              </button>
              <button
                type="button"
                onClick={() => setHomeCount(2)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                  homeCount === 2
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                2주택 (취득세 8.4% 중과)
              </button>
            </div>
          </div>
        </div>

        {/* 상세 접이식 설정 */}
        {showAdvancedSettings && (
          <div className="pt-3 border-t border-slate-200 dark:border-slate-700 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <span className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                가구 연소득 (DSR 산출용): {(householdIncome / 1000).toFixed(1)}천만 원
              </span>
              <input
                type="range"
                min={4000}
                max={20000}
                step={500}
                value={householdIncome}
                onChange={(e) => setHouseholdIncome(Number(e.target.value))}
                className="w-full accent-indigo-600 cursor-pointer"
              />
            </div>

            <div>
              <span className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                아파트 연간 시세 변동률 가정: {rePriceGrowthRate > 0 ? `+${rePriceGrowthRate}` : rePriceGrowthRate}%
              </span>
              <input
                type="range"
                min={-3.0}
                max={6.0}
                step={0.5}
                value={rePriceGrowthRate}
                onChange={(e) => setRePriceGrowthRate(Number(e.target.value))}
                className="w-full accent-indigo-600 cursor-pointer"
              />
            </div>

            <div>
              <span className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                ETF 연간 주가 자본차익 성장률: +{etfCapitalGrowth}%
              </span>
              <input
                type="range"
                min={0.0}
                max={8.0}
                step={0.5}
                value={etfCapitalGrowth}
                onChange={(e) => setEtfCapitalGrowth(Number(e.target.value))}
                className="w-full accent-emerald-600 cursor-pointer"
              />
            </div>
          </div>
        )}
      </div>

      {/* 3. [S21-3] 월간 실질 현금흐름(Cash Flow) 대조 & DSR 위험도 위젯 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 아파트 월 현금 유출 */}
        <div className="p-4 rounded-xl bg-red-50/60 dark:bg-red-950/20 border border-red-200/80 dark:border-red-900/40">
          <div className="flex items-center justify-between text-xs text-red-600 dark:text-red-400 font-semibold mb-1">
            <span>🏢 실물 아파트 보유자</span>
            <span>월간 순유출 (마이너스)</span>
          </div>
          <div className="text-2xl font-black text-red-600 dark:text-red-400 flex items-baseline gap-1">
            <span>-{(monthlyPropertyOutflow / 10000).toFixed(0)}</span>
            <span className="text-sm font-semibold">만 원 / 월</span>
          </div>
          <div className="mt-2 space-y-1 text-[11px] text-slate-600 dark:text-slate-300">
            <div className="flex justify-between">
              <span>• 월 대출 원리금 상환액:</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {(loanResult.monthlyPayment / 10000).toFixed(0)}만 원
              </span>
            </div>
            <div className="flex justify-between">
              <span>• 월할 보유세(재산세+종부세):</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {Math.round(holdingCosts.totalHoldingTax / 12 / 10000)}만 원
              </span>
            </div>
            <div className="flex justify-between">
              <span>• 월 관리비·충당금 추정:</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {Math.round(holdingCosts.maintenanceFee / 12 / 10000)}만 원
              </span>
            </div>
          </div>
        </div>

        {/* 배당 ETF 월 현금 유입 */}
        <div className="p-4 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-900/40">
          <div className="flex items-center justify-between text-xs text-emerald-600 dark:text-emerald-400 font-semibold mb-1">
            <span>📈 배당 ETF 투자자</span>
            <span>월간 순유입 (플러스)</span>
          </div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 flex items-baseline gap-1">
            <span>+{(monthlyEtfDividendInflow / 10000).toFixed(0)}</span>
            <span className="text-sm font-semibold">만 원 / 월</span>
          </div>
          <div className="mt-2 space-y-1 text-[11px] text-slate-600 dark:text-slate-300">
            <div className="flex justify-between">
              <span>• 투자 자기자본 (초기비용 포함):</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {(etfInitialCapitalWon / 100000000).toFixed(2)}억 원
              </span>
            </div>
            <div className="flex justify-between">
              <span>• 연간 세전 배당금 ({etfDividendYield}%):</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {Math.round(etfInitialCapitalWon * (etfDividendYield / 100) / 10000)}만 원
              </span>
            </div>
            <div className="flex justify-between">
              <span>• 세후 월간 실지급액 (15.4% 원천징수):</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                {(monthlyEtfDividendInflow / 10000).toFixed(0)}만 원
              </span>
            </div>
          </div>
        </div>

        {/* 월간 가처분 유동성 격차 & DSR 위험 진단 */}
        <div className="p-4 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-200/80 dark:border-indigo-900/40 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-indigo-600 dark:text-indigo-400 font-semibold mb-1">
              <span>⚡ 월 가처분 현금 격차</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${housePoorDiagnosis.riskColor}`}>
                {housePoorDiagnosis.riskLabel}
              </span>
            </div>
            <div className="text-2xl font-black text-indigo-700 dark:text-indigo-300 flex items-baseline gap-1">
              <span>{(monthlyCashFlowGap / 10000).toFixed(0)}</span>
              <span className="text-sm font-semibold">만 원 / 월 갭</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              배당 소득 수령액과 대출·보유세 미지출로 인한 월간 실질 가처분 소득의 격차입니다.
            </p>
          </div>

          <div className="mt-3 pt-2 border-t border-indigo-100 dark:border-indigo-900/40 text-[11px]">
            <div className="flex justify-between text-slate-600 dark:text-slate-300 mb-0.5">
              <span>대출 원리금 상환 DSR:</span>
              <span className="font-bold text-slate-900 dark:text-slate-100">{housePoorDiagnosis.dsrRatio}%</span>
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
              {housePoorDiagnosis.description}
            </p>
          </div>
        </div>
      </div>

      {/* 4. [S21-2] 10개년 누적 순자산(Net Worth) 성장 시계열 Recharts 차트 */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-indigo-500" />
              10개년 누적 순자산(Net Worth) 성장 궤적 비교
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              아파트 순자산 (주택가치 - 잔여대출) vs 배당 ETF 복리 순자산 (배당 재투자 + 자본차익)
            </p>
          </div>

          {/* 승자 뱃지 */}
          <div className={`px-3 py-1 rounded-full text-xs font-bold border ${
            isEtfWinner
              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-500/30'
              : 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-500/30'
          }`}>
            {isEtfWinner ? '🏆 10년 후 배당 ETF 복리 승리' : '🏆 10년 후 부동산 순자산 승리'}
            <span className="ml-1 text-[11px] font-normal opacity-90">
              (+{finalNetWorthDiff.toFixed(1)}억 원 우세)
            </span>
          </div>
        </div>

        {/* 차트 캔버스 */}
        <div className="h-72 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={trajectoryData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="etfGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="reGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.5} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis
                unit="억"
                tick={{ fontSize: 11 }}
                domain={['auto', 'auto']}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="rounded-xl bg-slate-900/95 border border-slate-700 p-3 shadow-xl text-white text-[11px] space-y-1.5 min-w-[210px]">
                        <p className="font-bold border-b border-slate-700 pb-1 text-slate-300">{label}</p>
                        <div className="flex justify-between items-center text-emerald-400 font-semibold">
                          <span>배당 ETF 순자산:</span>
                          <span>{data.etfNetWorth} 억 원</span>
                        </div>
                        <div className="flex justify-between items-center text-indigo-400 font-semibold">
                          <span>아파트 순자산:</span>
                          <span>{data.reNetWorth} 억 원</span>
                        </div>
                        <div className="text-[10px] text-slate-400 border-t border-slate-800 pt-1 space-y-0.5">
                          <div className="flex justify-between">
                            <span>• 주택 평가가액:</span>
                            <span>{data.rePropertyValue}억</span>
                          </div>
                          <div className="flex justify-between">
                            <span>• 잔여 대출금:</span>
                            <span>{data.reRemainingLoan}억</span>
                          </div>
                          <div className="flex justify-between">
                            <span>• 아파트 누적비용(이자/세금):</span>
                            <span className="text-red-400">{data.reCumulativeCosts}억</span>
                          </div>
                          <div className="flex justify-between text-emerald-300">
                            <span>• ETF 누적 수령 배당금:</span>
                            <span>+{data.etfCumulativeDividends}억</span>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Legend
                verticalAlign="top"
                align="right"
                wrapperStyle={STANDARD_LEGEND_WRAPPER_STYLE}
                onClick={chartHighlight.handleLegendClick}
                formatter={chartHighlight.renderLegendText}
              />
              <Area
                type="monotone"
                dataKey="etfNetWorth"
                name="배당 ETF 복리 순자산"
                stroke="#10b981"
                strokeWidth={chartHighlight.getStrokeWidth('etfNetWorth', 2.5)}
                strokeOpacity={chartHighlight.getOpacity('etfNetWorth')}
                fill="url(#etfGradient)"
                fillOpacity={chartHighlight.highlightedKey === 'etfNetWorth' ? 0.9 : chartHighlight.highlightedKey ? 0.2 : 0.6}
              />
              <Area
                type="monotone"
                dataKey="reNetWorth"
                name="아파트 순자산 (가액-대출)"
                stroke="#6366f1"
                strokeWidth={chartHighlight.getStrokeWidth('reNetWorth', 2)}
                strokeOpacity={chartHighlight.getOpacity('reNetWorth')}
                fill="url(#reGradient)"
                fillOpacity={chartHighlight.highlightedKey === 'reNetWorth' ? 0.9 : chartHighlight.highlightedKey ? 0.2 : 0.6}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 5. 초기 취득 비용 및 10년 누적 유출 비용 종합 대조표 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
        {/* 초기 부대비용 상세 */}
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-xs space-y-2">
          <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
            <Coins className="w-4 h-4 text-amber-500" />
            초기 매입 시 소멸되는 부대비용 합계: {(acqCosts.totalInitialCost / 10000).toFixed(0)}만 원
          </span>
          <div className="space-y-1 text-slate-600 dark:text-slate-300 text-[11px]">
            <div className="flex justify-between">
              <span>• 취득세 (지방교육세/농특세 포함):</span>
              <span className="font-semibold">{(acqCosts.acquisitionTax / 10000).toFixed(0)}만 원</span>
            </div>
            <div className="flex justify-between">
              <span>• 부동산 법정 중개보수:</span>
              <span className="font-semibold">{(acqCosts.brokerFee / 10000).toFixed(0)}만 원</span>
            </div>
            <div className="flex justify-between">
              <span>• 국민주택채권할인 / 등기·법무비용:</span>
              <span className="font-semibold">{(acqCosts.stampAndBond / 10000).toFixed(0)}만 원</span>
            </div>
          </div>
          <p className="text-[10px] text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 p-1.5 rounded">
            💡 ETF 투자는 위 초기비용(약 {(acqCosts.totalInitialCost / 10000).toFixed(0)}만 원)이 발생하지 않아 원금 100%가 첫날부터 복리 수익을 창출합니다.
          </p>
        </div>

        {/* 10년간 총 금융 유출비용 대조 */}
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-xs space-y-2">
          <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            10년간 아파트 보유에 소진되는 비용: 약 {(final10Y ? final10Y.reCumulativeCosts : 0).toFixed(1)}억 원
          </span>
          <div className="space-y-1 text-slate-600 dark:text-slate-300 text-[11px]">
            <div className="flex justify-between">
              <span>• 10년간 누적 대출 이자:</span>
              <span className="font-semibold text-red-500">{(loanResult.totalInterest10Y / 100000000).toFixed(2)}억 원</span>
            </div>
            <div className="flex justify-between">
              <span>• 10년간 누적 보유세 및 관리비:</span>
              <span className="font-semibold text-red-500">
                {((holdingCosts.totalAnnualCost * 10) / 100000000).toFixed(2)}억 원
              </span>
            </div>
            <div className="flex justify-between">
              <span>• 10년 후 잔여 대출 원금:</span>
              <span className="font-semibold">{(loanResult.remainingLoanYear10 / 100000000).toFixed(2)}억 원</span>
            </div>
          </div>
          <p className="text-[10px] text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 p-1.5 rounded">
            💡 반면 배당 ETF에 투자한 자본은 10년간 약 <strong>{(final10Y ? final10Y.etfCumulativeDividends : 0).toFixed(1)}억 원</strong>의 누적 배당금을 가계에 지급했습니다.
          </p>
        </div>
      </div>
    </div>
  );
}
