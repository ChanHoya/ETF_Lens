'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  ShieldCheck, TrendingUp, Calculator, PiggyBank,
  AlertTriangle, Calendar, DollarSign, Layers, Sparkles,
  ArrowUpRight, ArrowRight, CheckCircle2, Info, ChevronRight,
  Flame, HeartHandshake, Zap, Scale, ShieldAlert
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, LineChart, Line,
  XAxis, YAxis, Tooltip, CartesianGrid, Legend, ReferenceLine
} from 'recharts';
import {
  calculateNpsEarlyDeferralBep,
  calculateTaxSavingsSimulation,
  calculateWithdrawalTax,
  statutoryPensionStartAge,
  formatAgeWithMonths
} from '@/lib/pensionRules';
import TaxShieldRadar from '@/components/TaxShieldRadar';

function PensionWealthHubInner() {
  const [activeSubTab, setActiveSubTab] = useState<'tax' | 'nps' | 'withdrawal' | 'shield'>('tax');

  // ── 서브탭 1 상태: 연금 3총사 절세 ─────────────────────────────────────
  const [incomeLevel, setIncomeLevel] = useState<'under55' | 'over55'>('under55');
  const [pensionSavings, setPensionSavings] = useState<number>(600); // 600만원 (연금저축 최대공제)
  const [irpAmount, setIrpAmount] = useState<number>(300);           // 300만원 (IRP 추가공제)
  const [extraAmount, setExtraAmount] = useState<number>(0);         // 비공제 추가납입
  const [isaTransfer, setIsaTransfer] = useState<number>(1000);      // ISA 3년 만기 전환 1,000만원
  const [annualReturn, setAnnualReturn] = useState<number>(7.0);     // 기대수익률 7%
  const [investYears, setInvestYears] = useState<number>(20);        // 운용기간 20년

  const taxResult = useMemo(() => {
    return calculateTaxSavingsSimulation({
      incomeLevel,
      pensionSavingsAnnual: pensionSavings,
      irpAnnual: irpAmount,
      extraContributionAnnual: extraAmount,
      isaTransferAmount: isaTransfer,
      annualReturnPct: annualReturn,
      investmentYears: investYears,
      dividendYieldPct: 3.0,
    });
  }, [incomeLevel, pensionSavings, irpAmount, extraAmount, isaTransfer, annualReturn, investYears]);

  // ── 서브탭 2 상태: 국민연금 BEP ─────────────────────────────────────────
  const [birthYear, setBirthYear] = useState<number>(1965);          // 출생연도 (1965년생 -> 64세 정상개시)
  const [npsBaseMonthly, setNpsBaseMonthly] = useState<number>(150); // 월 150만원
  const [earlyYears, setEarlyYears] = useState<number>(5);           // 5년 조기 (-30%)
  const [deferYears, setDeferYears] = useState<number>(5);           // 5년 연기 (+36%)
  const [expectedLife, setExpectedLife] = useState<number>(85);       // 기대수명 85세

  const npsResult = useMemo(() => {
    return calculateNpsEarlyDeferralBep({
      birthYear,
      baseMonthlyPension: npsBaseMonthly,
      earlyYears,
      deferYears,
      expectedLifeExpectancy: expectedLife,
      maxAge: 95,
    });
  }, [birthYear, npsBaseMonthly, earlyYears, deferYears, expectedLife]);

  // ── 서브탭 3 상태: 은퇴 인출 세금 ───────────────────────────────────────
  const [monthlyWithdrawal, setMonthlyWithdrawal] = useState<number>(120); // 월 120만원 인출

  const withdrawalResult = useMemo(() => {
    return calculateWithdrawalTax(monthlyWithdrawal);
  }, [monthlyWithdrawal]);

  // KIS 실계좌 자동 연동 시도 (sessionStorage)
  const [hasMyAssets, setHasMyAssets] = useState(false);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const cached = sessionStorage.getItem('iprism_my_portfolio_cache');
      if (cached) setHasMyAssets(true);
    }
  }, []);

  const handleLoadFromMyAssets = () => {
    try {
      const cached = sessionStorage.getItem('iprism_my_portfolio_cache');
      if (!cached) return;
      const data = JSON.parse(cached);
      // 연금저축/IRP 자산 감지 시 시뮬레이터에 프리필
      const accounts = data?.accounts || [];
      let foundPension = false;
      accounts.forEach((acc: any) => {
        const name = acc.account_name || '';
        if (name.includes('연금') || name.includes('IRP')) {
          foundPension = true;
        }
      });
      alert(foundPension 
        ? "회원님의 연금 계좌가 확인되었습니다. 최적 절세 납입 한도(연 900만원)를 자동 프리셋했습니다." 
        : "계좌 정보를 성공적으로 불러왔습니다. 기본 권장 한도(연금저축 600 + IRP 300)로 세팅했습니다.");
      setPensionSavings(600);
      setIrpAmount(300);
    } catch (e) {
      console.warn("My assets load failed", e);
    }
  };

  return (
    <div className="w-full max-w-[95vw] xl:max-w-[1400px] flex flex-col gap-5 py-2 animate-fadeIn text-gray-100">
      
      {/* ── 1. 헤더 배너 ───────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-950/40 via-indigo-950/40 to-purple-950/40 border border-white/10 p-5 md:p-6 backdrop-blur-xl shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold tracking-wide flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> All-in-One Wealth Hub
              </span>
              <span className="px-2 py-0.5 rounded-full bg-white/10 text-gray-400 text-xs">
                2026 세법 개정 반영
              </span>
            </div>
            <h1 className="text-xl md:text-2xl font-black tracking-tight text-white flex items-center gap-2">
              연금·절세 웰스 허브 <span className="text-emerald-400 text-sm md:text-base font-normal">| 연금 3총사 절세 & 국민연금 BEP 분석기</span>
            </h1>
            <p className="text-xs md:text-sm text-gray-300/80 leading-relaxed max-w-2xl">
              연금저축·IRP·ISA 세액공제와 과세이연 복리 증식, 그리고 기대수명별 국민연금 조기 vs 정상 vs 연기 수령 손익분기점(BEP)을 정확한 금융 수학으로 시뮬레이션합니다.
            </p>
          </div>

          {/* 내 계좌 불러오기 버튼 */}
          {hasMyAssets && (
            <button
              onClick={handleLoadFromMyAssets}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 hover:text-emerald-100 text-xs sm:text-sm font-bold transition-all shadow-md shrink-0 cursor-pointer active:scale-95"
            >
              <PiggyBank className="w-4 h-4 text-emerald-400" />
              <span>내 연금계좌 한도 적용</span>
            </button>
          )}
        </div>

        {/* 3대 서브탭 네비게이션 */}
        <div className="flex items-center gap-2 mt-5 border-t border-white/10 pt-4 overflow-x-auto scrollbar-hide">
          <button
            onClick={() => setActiveSubTab('tax')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all shrink-0 cursor-pointer ${
              activeSubTab === 'tax'
                ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/20'
                : 'bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>1. 연금 3총사 절세 (연금저축·IRP·ISA)</span>
          </button>

          <button
            onClick={() => setActiveSubTab('nps')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all shrink-0 cursor-pointer ${
              activeSubTab === 'nps'
                ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/20'
                : 'bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white'
            }`}
          >
            <Scale className="w-4 h-4" />
            <span>2. 국민연금 조기·연기 손익분기(BEP)</span>
          </button>

          <button
            onClick={() => setActiveSubTab('withdrawal')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all shrink-0 cursor-pointer ${
              activeSubTab === 'withdrawal'
                ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-lg shadow-amber-500/20'
                : 'bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            <span>3. 은퇴 인출 & 연금소득세 가이드</span>
          </button>

          <button
            onClick={() => setActiveSubTab('shield')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all shrink-0 cursor-pointer ${
              activeSubTab === 'shield'
                ? 'bg-gradient-to-r from-rose-500 to-indigo-600 text-white shadow-lg shadow-rose-500/20'
                : 'bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white'
            }`}
          >
            <ShieldAlert className="w-4 h-4 text-rose-300" />
            <span>4. 금융소득 2,000만 & 건보료 방어 (Shield)</span>
          </button>
        </div>
      </div>


      {/* ── [서브탭 1] 연금 3총사 절세 & 과세이연 시뮬레이터 ────────────────── */}
      {activeSubTab === 'tax' && (
        <div className="flex flex-col gap-5">
          {/* 4대 핵심 요약 Bento 카드 */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {/* 카드 1: 연간 세액공제 환급액 */}
            <div className="bg-black/40 border border-white/10 rounded-2xl p-4 backdrop-blur-md flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400 font-medium">연간 세액공제 환급액</span>
                <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400"><DollarSign className="w-4 h-4" /></span>
              </div>
              <div className="mt-2">
                <div className="text-xl md:text-2xl font-black text-emerald-400">
                  +{taxResult.annualTaxRefund.toLocaleString()} <span className="text-xs text-gray-300 font-normal">만 원/년</span>
                </div>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  납입 {taxResult.deductibleAnnual}만원 × 공제율 {taxResult.taxDeductionRate}%
                </p>
              </div>
            </div>

            {/* 카드 2: ISA 만기 전환 추가 보너스 */}
            <div className="bg-black/40 border border-white/10 rounded-2xl p-4 backdrop-blur-md flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400 font-medium">ISA 전환 추가 환급</span>
                <span className="p-1.5 rounded-lg bg-teal-500/10 text-teal-400"><Zap className="w-4 h-4" /></span>
              </div>
              <div className="mt-2">
                <div className="text-xl md:text-2xl font-black text-teal-300">
                  +{taxResult.isaTaxRefundBonus.toLocaleString()} <span className="text-xs text-gray-300 font-normal">만 원 (추가)</span>
                </div>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  전환액 10%(최대 300만) 공제 적용
                </p>
              </div>
            </div>

            {/* 카드 3: 1년차 총 세금 환급액 */}
            <div className="bg-black/40 border border-white/10 rounded-2xl p-4 backdrop-blur-md flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400 font-medium">1년차 총 환급 합계</span>
                <span className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400"><PiggyBank className="w-4 h-4" /></span>
              </div>
              <div className="mt-2">
                <div className="text-xl md:text-2xl font-black text-indigo-400">
                  +{taxResult.firstYearTotalRefund.toLocaleString()} <span className="text-xs text-gray-300 font-normal">만 원</span>
                </div>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  기본 환급 + ISA 전환 보너스 합산
                </p>
              </div>
            </div>

            {/* 카드 4: 과세이연 복리 초과수익 */}
            <div className="bg-black/40 border border-white/10 rounded-2xl p-4 backdrop-blur-md flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400 font-medium">{investYears}년 후 과세이연 초과수익</span>
                <span className="p-1.5 rounded-lg bg-purple-500/10 text-purple-400"><TrendingUp className="w-4 h-4" /></span>
              </div>
              <div className="mt-2">
                <div className="text-xl md:text-2xl font-black text-purple-400">
                  +{Math.round(taxResult.netTaxDeferredAdvantage).toLocaleString()} <span className="text-xs text-gray-300 font-normal">만 원</span>
                </div>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  배당세(15.4%) 전액 복리 재투자 효과
                </p>
              </div>
            </div>
          </div>

          {/* 슬라이더 컨트롤러 & 누적 자산 Recharts 비교 차트 */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* 좌측: 컨트롤러 패널 (5 cols) */}
            <div className="lg:col-span-5 bg-black/40 border border-white/10 rounded-3xl p-5 backdrop-blur-xl flex flex-col gap-4">
              <h2 className="text-sm font-bold text-gray-200 flex items-center gap-2 border-b border-white/10 pb-2">
                <Calculator className="w-4 h-4 text-emerald-400" /> 납입 및 운용 파라미터 설정
              </h2>

              {/* 총급여 선택기 */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-gray-400 flex items-center justify-between">
                  <span>총급여 기준 (세액공제율 결정)</span>
                  <span className="font-bold text-emerald-400">
                    {incomeLevel === 'under55' ? '16.5% 공제 (총급여 ≤ 5,500만)' : '13.2% 공제 (총급여 > 5,500만)'}
                  </span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setIncomeLevel('under55')}
                    className={`py-1.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      incomeLevel === 'under55'
                        ? 'bg-emerald-500/20 border border-emerald-500/50 text-emerald-300'
                        : 'bg-white/5 border border-white/10 text-gray-400 hover:text-white'
                    }`}
                  >
                    5,500만원 이하 (16.5%)
                  </button>
                  <button
                    onClick={() => setIncomeLevel('over55')}
                    className={`py-1.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      incomeLevel === 'over55'
                        ? 'bg-emerald-500/20 border border-emerald-500/50 text-emerald-300'
                        : 'bg-white/5 border border-white/10 text-gray-400 hover:text-white'
                    }`}
                  >
                    5,500만원 초과 (13.2%)
                  </button>
                </div>
              </div>

              {/* 연금저축 납입 슬라이더 */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-300 font-medium">연금저축 연 납입액</span>
                  <span className="font-bold text-emerald-400">{pensionSavings} 만원 <span className="text-[10px] text-gray-500">(한도 600)</span></span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="600"
                  step="50"
                  value={pensionSavings}
                  onChange={(e) => setPensionSavings(Number(e.target.value))}
                  className="accent-emerald-500 w-full cursor-pointer h-1.5 bg-white/10 rounded-lg"
                />
              </div>

              {/* IRP 납입 슬라이더 */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-300 font-medium">IRP(퇴직연금) 추가 납입액</span>
                  <span className="font-bold text-teal-400">{irpAmount} 만원 <span className="text-[10px] text-gray-500">(합산 900 한도)</span></span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="300"
                  step="50"
                  value={irpAmount}
                  onChange={(e) => setIrpAmount(Number(e.target.value))}
                  className="accent-teal-500 w-full cursor-pointer h-1.5 bg-white/10 rounded-lg"
                />
              </div>

              {/* ISA 만기 연금계좌 전환 금액 */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-300 font-medium">ISA 3년 만기 연금 전환액</span>
                  <span className="font-bold text-indigo-400">{isaTransfer} 만원</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="3000"
                  step="100"
                  value={isaTransfer}
                  onChange={(e) => setIsaTransfer(Number(e.target.value))}
                  className="accent-indigo-500 w-full cursor-pointer h-1.5 bg-white/10 rounded-lg"
                />
                <span className="text-[10px] text-gray-500">전환금의 10%(최대 300만원 한도) 추가 세액공제 혜택 부여</span>
              </div>

              {/* 연간 기대수익률 */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-300 font-medium">연간 복리 기대수익률</span>
                  <span className="font-bold text-purple-400">{annualReturn.toFixed(1)} %</span>
                </div>
                <input
                  type="range"
                  min="3.0"
                  max="12.0"
                  step="0.5"
                  value={annualReturn}
                  onChange={(e) => setAnnualReturn(Number(e.target.value))}
                  className="accent-purple-500 w-full cursor-pointer h-1.5 bg-white/10 rounded-lg"
                />
              </div>

              {/* 투자 운용 기간 */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-300 font-medium">투자 운용 기간</span>
                  <span className="font-bold text-amber-400">{investYears} 년</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="35"
                  step="1"
                  value={investYears}
                  onChange={(e) => setInvestYears(Number(e.target.value))}
                  className="accent-amber-500 w-full cursor-pointer h-1.5 bg-white/10 rounded-lg"
                />
              </div>
            </div>

            {/* 우측: 복리 자산 평가액 Recharts 비교 차트 (7 cols) */}
            <div className="lg:col-span-7 bg-black/40 border border-white/10 rounded-3xl p-5 backdrop-blur-xl flex flex-col justify-between">
              <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className="p-1 rounded-lg bg-emerald-500/20 text-emerald-400"><TrendingUp className="w-4 h-4" /></span>
                  <h3 className="text-sm font-bold text-white">일반 위탁계좌 vs 연금계좌 과세이연 자산 격차</h3>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="flex items-center gap-1 text-emerald-400 font-bold">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block" /> 연금계좌
                  </span>
                  <span className="flex items-center gap-1 text-gray-400">
                    <span className="w-2.5 h-2.5 rounded-full bg-gray-500 inline-block" /> 일반계좌 (15.4% 과세)
                  </span>
                </div>
              </div>

              <div className="w-full h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={taxResult.chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="pensionGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.0}/>
                      </linearGradient>
                      <linearGradient id="generalGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6b7280" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#6b7280" stopOpacity={0.0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                    <XAxis dataKey="year" stroke="#9ca3af" tick={{ fontSize: 11 }} unit="년" />
                    <YAxis 
                      stroke="#9ca3af" 
                      tick={{ fontSize: 11 }} 
                      tickFormatter={(val) => `${(val / 10000).toFixed(0)}억`}
                    />
                    <Tooltip
                      contentStyle={{ backgroundColor: 'rgba(10, 10, 15, 0.95)', borderColor: '#ffffff20', borderRadius: '12px' }}
                      formatter={(value: any, name: any) => [
                        `${Number(value).toLocaleString()} 만 원`,
                        name === 'pensionTaxDeferredBalance' ? '연금계좌 (과세이연)' : '일반계좌 (배당세 15.4% 매년 차감)'
                      ]}
                      labelFormatter={(label) => `${label}년 차 평가액`}
                    />
                    <Area type="monotone" dataKey="generalTaxableBalance" name="generalTaxableBalance" stroke="#9ca3af" strokeWidth={2} fillOpacity={1} fill="url(#generalGrad)" />
                    <Area type="monotone" dataKey="pensionTaxDeferredBalance" name="pensionTaxDeferredBalance" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#pensionGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* 하단 요약 문구 */}
              <div className="mt-3 p-3 rounded-2xl bg-emerald-950/30 border border-emerald-500/20 text-xs text-emerald-300/90 leading-relaxed flex items-center justify-between">
                <span>
                  💡 <strong>{investYears}년 후 세후 자산 비교</strong>: 일반계좌 {Math.round(taxResult.generalFinalBalance).toLocaleString()}만원 vs 연금계좌 <strong>{Math.round(taxResult.pensionFinalBalance).toLocaleString()}만원</strong>
                </span>
                <span className="font-extrabold text-emerald-400 shrink-0 ml-2">
                  +{Math.round(taxResult.netTaxDeferredAdvantage).toLocaleString()} 만원 초과
                </span>
              </div>
            </div>
          </div>

          {/* 3대 계좌 법정 규정 비교 카드 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-4 rounded-2xl bg-black/30 border border-white/10 flex flex-col gap-1.5">
              <span className="text-xs font-bold text-emerald-400">연금저축펀드</span>
              <p className="text-xs text-gray-300">
                연 600만원까지 세액공제(최대 99만원 환급). 중도 부분 인출 시 세액공제 받지 않은 원금은 언제든 비과세 인출 가능.
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-black/30 border border-white/10 flex flex-col gap-1.5">
              <span className="text-xs font-bold text-teal-400">IRP (개인형 퇴직연금)</span>
              <p className="text-xs text-gray-300">
                연금저축 포함 연 900만원까지 세액공제(최대 148.5만원). 안전자산 30% 의무 편입 규정 적용.
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-black/30 border border-white/10 flex flex-col gap-1.5">
              <span className="text-xs font-bold text-indigo-400">ISA (개인종합자산관리)</span>
              <p className="text-xs text-gray-300">
                연 2,000만원 납입, 3년 만기 시 500만원 비과세(초과분 9.9% 분리과세). 만기 해지금을 연금계좌로 이체 시 10%(최대 300만원) 추가 세액공제.
              </p>
            </div>
          </div>
        </div>
      )}


      {/* ── [서브탭 2] 국민연금 조기 vs 정상 vs 연기 손익분기(BEP) ───────────── */}
      {activeSubTab === 'nps' && (
        <div className="flex flex-col gap-5">
          {/* 손익분기점 크로스오버 나이 배너 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* 조기 vs 정상 분기 */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-950/40 to-black/40 border border-indigo-500/30 flex items-center justify-between">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-indigo-300 font-bold flex items-center gap-1">
                  ⚡ 조기 수령 vs 정상 수령 손익분기점
                </span>
                <span className="text-xs text-gray-400">
                  이 나이 이전 사망 시 조기가 유리, 이후 생존 시 정상수령 유리
                </span>
              </div>
              <div className="text-xl md:text-2xl font-black text-indigo-300 shrink-0">
                {npsResult.crossoverEarlyVsNormal.ageDisplay}
              </div>
            </div>

            {/* 정상 vs 연기 분기 */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-950/40 to-black/40 border border-purple-500/30 flex items-center justify-between">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-purple-300 font-bold flex items-center gap-1">
                  🏆 정상 수령 vs 연기 수령 손익분기점
                </span>
                <span className="text-xs text-gray-400">
                  이 나이 이상 장수할 경우 연기연금의 누적 수령액 역전 극대화
                </span>
              </div>
              <div className="text-xl md:text-2xl font-black text-purple-300 shrink-0">
                {npsResult.crossoverNormalVsDefer.ageDisplay}
              </div>
            </div>
          </div>

          {/* 슬라이더 컨트롤러 & 누적 수령액 곡선 Recharts LineChart */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* 좌측 컨트롤러 (4 cols) */}
            <div className="lg:col-span-4 bg-black/40 border border-white/10 rounded-3xl p-5 backdrop-blur-xl flex flex-col gap-4">
              <h2 className="text-sm font-bold text-gray-200 flex items-center gap-2 border-b border-white/10 pb-2">
                <Calendar className="w-4 h-4 text-indigo-400" /> 국민연금 수령 조건 설정
              </h2>

              {/* 출생연도 */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-300 font-medium">출생연도</span>
                  <span className="font-bold text-indigo-400">{birthYear}년생 (개시: {npsResult.normalStartAge}세)</span>
                </div>
                <input
                  type="range"
                  min="1950"
                  max="1980"
                  step="1"
                  value={birthYear}
                  onChange={(e) => setBirthYear(Number(e.target.value))}
                  className="accent-indigo-500 w-full cursor-pointer h-1.5 bg-white/10 rounded-lg"
                />
                <span className="text-[10px] text-gray-500">법정 개시나이: 1969년생 이후 65세, 1965~1968년 64세 등</span>
              </div>

              {/* 정상수령 기준 월 예상액 */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-300 font-medium">정상개시 시 월 예상액</span>
                  <span className="font-bold text-emerald-400">{npsBaseMonthly} 만원/월</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="300"
                  step="10"
                  value={npsBaseMonthly}
                  onChange={(e) => setNpsBaseMonthly(Number(e.target.value))}
                  className="accent-emerald-500 w-full cursor-pointer h-1.5 bg-white/10 rounded-lg"
                />
              </div>

              {/* 조기 연수 (1~5년) */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-300 font-medium">조기 연수 (연 6% 감액)</span>
                  <span className="font-bold text-amber-400">{earlyYears}년 앞당김 (-{earlyYears * 6}%)</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="5"
                  step="1"
                  value={earlyYears}
                  onChange={(e) => setEarlyYears(Number(e.target.value))}
                  className="accent-amber-500 w-full cursor-pointer h-1.5 bg-white/10 rounded-lg"
                />
              </div>

              {/* 연기 연수 (1~5년) */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-300 font-medium">연기 연수 (연 7.2% 가산)</span>
                  <span className="font-bold text-purple-400">{deferYears}년 연기 (+{(deferYears * 7.2).toFixed(1)}%)</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="5"
                  step="1"
                  value={deferYears}
                  onChange={(e) => setDeferYears(Number(e.target.value))}
                  className="accent-purple-500 w-full cursor-pointer h-1.5 bg-white/10 rounded-lg"
                />
              </div>

              {/* 사용자 기대 수명 */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-300 font-medium">나의 기대 수명</span>
                  <span className="font-bold text-teal-400">{expectedLife} 세</span>
                </div>
                <input
                  type="range"
                  min="70"
                  max="95"
                  step="1"
                  value={expectedLife}
                  onChange={(e) => setExpectedLife(Number(e.target.value))}
                  className="accent-teal-500 w-full cursor-pointer h-1.5 bg-white/10 rounded-lg"
                />
              </div>

              {/* 추천 전략 카드 */}
              <div className="mt-2 p-3.5 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-gray-400">기대수명 {expectedLife}세 기준 최적 전략</span>
                  <span className="px-2 py-0.5 rounded-full bg-indigo-500/30 text-indigo-300 text-xs font-black">
                    {npsResult.recommendedType === 'EARLY' ? '조기수령 추천' : npsResult.recommendedType === 'NORMAL' ? '정상수령 추천' : '연기연금 추천'}
                  </span>
                </div>
                <p className="text-xs text-gray-300 leading-snug mt-1">
                  {npsResult.recommendedReason}
                </p>
              </div>
            </div>

            {/* 우측: 나이별 누적 수령액 Recharts LineChart (8 cols) */}
            <div className="lg:col-span-8 bg-black/40 border border-white/10 rounded-3xl p-5 backdrop-blur-xl flex flex-col justify-between">
              <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className="p-1 rounded-lg bg-indigo-500/20 text-indigo-400"><Scale className="w-4 h-4" /></span>
                  <h3 className="text-sm font-bold text-white">나이별 생애 누적 수령액 교차 곡선 (손익분기점)</h3>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="flex items-center gap-1 text-amber-400 font-bold">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" /> 조기
                  </span>
                  <span className="flex items-center gap-1 text-emerald-400 font-bold">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block" /> 정상
                  </span>
                  <span className="flex items-center gap-1 text-purple-400 font-bold">
                    <span className="w-2.5 h-2.5 rounded-full bg-purple-400 inline-block" /> 연기
                  </span>
                </div>
              </div>

              <div className="w-full h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={npsResult.dataPoints} margin={{ top: 10, right: 15, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                    <XAxis dataKey="age" stroke="#9ca3af" tick={{ fontSize: 11 }} unit="세" />
                    <YAxis 
                      stroke="#9ca3af" 
                      tick={{ fontSize: 11 }} 
                      tickFormatter={(val) => `${(val / 10000).toFixed(0)}억`}
                    />
                    <Tooltip
                      contentStyle={{ backgroundColor: 'rgba(10, 10, 15, 0.95)', borderColor: '#ffffff20', borderRadius: '12px' }}
                      formatter={(val: any, name: any) => [
                        `${Number(val).toLocaleString()} 만 원`,
                        name === 'earlyCumulative' ? '조기 수령' : name === 'normalCumulative' ? '정상 수령' : '연기 수령'
                      ]}
                      labelFormatter={(label) => `만 ${label}세 시점 생애 누적 수령액`}
                    />
                    {/* 크로스오버 수직 기준선 */}
                    <ReferenceLine x={Math.round(npsResult.crossoverEarlyVsNormal.ageExact)} stroke="#6366f1" strokeDasharray="3 3" label={{ value: `조기-정상 분기 (${npsResult.crossoverEarlyVsNormal.ageDisplay})`, fill: '#a5b4fc', fontSize: 10, position: 'top' }} />
                    <ReferenceLine x={Math.round(npsResult.crossoverNormalVsDefer.ageExact)} stroke="#a855f7" strokeDasharray="3 3" label={{ value: `정상-연기 분기 (${npsResult.crossoverNormalVsDefer.ageDisplay})`, fill: '#d8b4fe', fontSize: 10, position: 'top' }} />
                    
                    <Line type="monotone" dataKey="earlyCumulative" name="earlyCumulative" stroke="#f59e0b" strokeWidth={2.5} dot={false} isAnimationActive={false} />
                    <Line type="monotone" dataKey="normalCumulative" name="normalCumulative" stroke="#10b981" strokeWidth={2.5} dot={false} isAnimationActive={false} />
                    <Line type="monotone" dataKey="deferCumulative" name="deferCumulative" stroke="#a855f7" strokeWidth={2.5} dot={false} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* 하단 범례 설명 */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-3 pt-2 border-t border-white/5 text-[11px] text-gray-400">
                <div>
                  <span className="text-amber-400 font-bold">⚡ 조기 ({npsResult.earlyStartAge}세 시작):</span> 월 {npsResult.strategies.early.monthlyPension}만원 (평생 -30% 감액)
                </div>
                <div>
                  <span className="text-emerald-400 font-bold">🎯 정상 ({npsResult.normalStartAge}세 시작):</span> 월 {npsResult.strategies.normal.monthlyPension}만원 (100% 정규)
                </div>
                <div>
                  <span className="text-purple-400 font-bold">🏆 연기 ({npsResult.deferStartAge}세 시작):</span> 월 {npsResult.strategies.defer.monthlyPension}만원 (+36% 증액)
                </div>
              </div>
            </div>
          </div>

          {/* 3대 전략 상세 스펙 카드 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 조기 카드 */}
            <div className="p-4 rounded-2xl bg-black/40 border border-white/10 flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-400">{npsResult.strategies.early.title}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300">
                  {npsResult.strategies.early.badge}
                </span>
              </div>
              <div className="text-lg font-black text-white">
                월 {npsResult.strategies.early.monthlyPension} 만원 <span className="text-xs font-normal text-gray-400">(연 {npsResult.strategies.early.annualPension}만)</span>
              </div>
              {/* 건보료 뱃지 */}
              <div className={`p-2 rounded-xl text-[11px] leading-tight flex items-start gap-1.5 ${
                npsResult.strategies.early.healthInsuranceRisk 
                  ? 'bg-rose-950/30 text-rose-300 border border-rose-500/20' 
                  : 'bg-emerald-950/30 text-emerald-300 border border-emerald-500/20'
              }`}>
                <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>{npsResult.strategies.early.healthInsuranceNote}</span>
              </div>
              <ul className="text-xs text-gray-400 space-y-1 list-disc list-inside">
                {npsResult.strategies.early.pros.map((p, idx) => (
                  <li key={idx}>{p}</li>
                ))}
              </ul>
            </div>

            {/* 정상 카드 */}
            <div className="p-4 rounded-2xl bg-black/40 border border-white/10 flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-400">{npsResult.strategies.normal.title}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300">
                  {npsResult.strategies.normal.badge}
                </span>
              </div>
              <div className="text-lg font-black text-white">
                월 {npsResult.strategies.normal.monthlyPension} 만원 <span className="text-xs font-normal text-gray-400">(연 {npsResult.strategies.normal.annualPension}만)</span>
              </div>
              <div className={`p-2 rounded-xl text-[11px] leading-tight flex items-start gap-1.5 ${
                npsResult.strategies.normal.healthInsuranceRisk 
                  ? 'bg-rose-950/30 text-rose-300 border border-rose-500/20' 
                  : 'bg-emerald-950/30 text-emerald-300 border border-emerald-500/20'
              }`}>
                <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>{npsResult.strategies.normal.healthInsuranceNote}</span>
              </div>
              <ul className="text-xs text-gray-400 space-y-1 list-disc list-inside">
                {npsResult.strategies.normal.pros.map((p, idx) => (
                  <li key={idx}>{p}</li>
                ))}
              </ul>
            </div>

            {/* 연기 카드 */}
            <div className="p-4 rounded-2xl bg-black/40 border border-white/10 flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-purple-400">{npsResult.strategies.defer.title}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300">
                  {npsResult.strategies.defer.badge}
                </span>
              </div>
              <div className="text-lg font-black text-white">
                월 {npsResult.strategies.defer.monthlyPension} 만원 <span className="text-xs font-normal text-gray-400">(연 {npsResult.strategies.defer.annualPension}만)</span>
              </div>
              <div className={`p-2 rounded-xl text-[11px] leading-tight flex items-start gap-1.5 ${
                npsResult.strategies.defer.healthInsuranceRisk 
                  ? 'bg-rose-950/30 text-rose-300 border border-rose-500/20' 
                  : 'bg-emerald-950/30 text-emerald-300 border border-emerald-500/20'
              }`}>
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>{npsResult.strategies.defer.healthInsuranceNote}</span>
              </div>
              <ul className="text-xs text-gray-400 space-y-1 list-disc list-inside">
                {npsResult.strategies.defer.pros.map((p, idx) => (
                  <li key={idx}>{p}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* CFP 전문가 처방전 */}
          <div className="p-5 rounded-3xl bg-black/40 border border-white/10 flex flex-col gap-2">
            <h4 className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-emerald-400" /> CFP 공인재무설계사 실전 전략 가이드
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-gray-400">
              {npsResult.cfpPrescription.map((presc, idx) => (
                <div key={idx} className="p-2.5 rounded-xl bg-white/5 border border-white/5 leading-relaxed">
                  {presc}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}


      {/* ── [서브탭 3] 은퇴 인출 세금 & 연 1,500만원 초과 과세 판정 ─────────── */}
      {activeSubTab === 'withdrawal' && (
        <div className="flex flex-col gap-5">
          {/* 인출액 슬라이더 & 인출세율 판정 */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-5 bg-black/40 border border-white/10 rounded-3xl p-5 backdrop-blur-xl flex flex-col gap-4">
              <h2 className="text-sm font-bold text-gray-200 flex items-center gap-2 border-b border-white/10 pb-2">
                <DollarSign className="w-4 h-4 text-amber-400" /> 사적연금 월 인출 희망액 설정
              </h2>

              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-300 font-medium">월 사적연금 인출액</span>
                  <span className="font-bold text-amber-400">{monthlyWithdrawal} 만원/월 <span className="text-xs text-gray-500">(연 {monthlyWithdrawal * 12}만)</span></span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="300"
                  step="5"
                  value={monthlyWithdrawal}
                  onChange={(e) => setMonthlyWithdrawal(Number(e.target.value))}
                  className="accent-amber-500 w-full cursor-pointer h-1.5 bg-white/10 rounded-lg"
                />
              </div>

              {/* 연 1,500만원 기준 진단 박스 */}
              <div className={`p-4 rounded-2xl border flex flex-col gap-1.5 ${
                withdrawalResult.isUnder1500Limit
                  ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-950/30 border-rose-500/30 text-rose-300'
              }`}>
                <div className="flex items-center justify-between font-bold text-xs">
                  <span>연간 {withdrawalResult.annualWithdrawal} 만 원 인출</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] bg-white/10">
                    {withdrawalResult.isUnder1500Limit ? '저율 분리과세(안전)' : '1,500만 초과 주의'}
                  </span>
                </div>
                <p className="text-xs leading-relaxed text-gray-300 mt-1">
                  {withdrawalResult.advice}
                </p>
              </div>

              {/* 최적 인출 팁 */}
              <div className="p-3 rounded-xl bg-white/5 text-[11px] text-gray-400 leading-relaxed">
                💡 <strong>세액공제 받지 않은 추가 납입 원금</strong>은 인출 순서상 1순위로 인출되며, 기간과 금액에 상관없이 <strong>100% 비과세</strong>(세금 0원)입니다. 1,500만원 한도 계산에서도 전액 제외됩니다.
              </div>
            </div>

            {/* 우측: 연령대별 연금소득세율 비교 카드 (7 cols) */}
            <div className="lg:col-span-7 bg-black/40 border border-white/10 rounded-3xl p-5 backdrop-blur-xl flex flex-col justify-between">
              <h3 className="text-sm font-bold text-white border-b border-white/10 pb-2 mb-3">
                수령 연령별 연금소득세율 & 실수령 세금 비교
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-4 rounded-2xl bg-black/40 border border-white/10 flex flex-col gap-1">
                  <span className="text-xs text-gray-400">만 55세 ~ 69세 수령</span>
                  <div className="text-xl font-black text-amber-400">5.5 %</div>
                  <span className="text-xs text-gray-300 mt-2">
                    연 세금: <strong>{withdrawalResult.taxAmount55to69}</strong> 만 원
                  </span>
                  <span className="text-[10px] text-gray-500">지방소득세 포함</span>
                </div>

                <div className="p-4 rounded-2xl bg-black/40 border border-white/10 flex flex-col gap-1">
                  <span className="text-xs text-gray-400">만 70세 ~ 79세 수령</span>
                  <div className="text-xl font-black text-teal-400">4.4 %</div>
                  <span className="text-xs text-gray-300 mt-2">
                    연 세금: <strong>{withdrawalResult.taxAmount70to79}</strong> 만 원
                  </span>
                  <span className="text-[10px] text-gray-500">지방소득세 포함</span>
                </div>

                <div className="p-4 rounded-2xl bg-black/40 border border-white/10 flex flex-col gap-1">
                  <span className="text-xs text-gray-400">만 80세 이상 수령</span>
                  <div className="text-xl font-black text-emerald-400">3.3 %</div>
                  <span className="text-xs text-gray-300 mt-2">
                    연 세금: <strong>{withdrawalResult.taxAmount80plus}</strong> 만 원
                  </span>
                  <span className="text-[10px] text-gray-500">최저 세율 적용</span>
                </div>
              </div>

              {/* 1,500만원 초과 시 세금 비교 */}
              {!withdrawalResult.isUnder1500Limit && (
                <div className="mt-4 p-3.5 rounded-2xl bg-rose-950/20 border border-rose-500/20 flex flex-col gap-1">
                  <div className="flex items-center justify-between text-xs font-bold text-rose-300">
                    <span>1,500만원 초과 시 16.5% 분리과세 선택 시</span>
                    <span>연 세금 {withdrawalResult.taxIfOverLimitSeparate} 만 원</span>
                  </div>
                  <p className="text-[11px] text-gray-400">
                    저율 분리과세(5.5% 약 {withdrawalResult.taxAmount55to69}만원) 대비 약 {(withdrawalResult.taxIfOverLimitSeparate - withdrawalResult.taxAmount55to69).toFixed(1)}만원의 세금이 추가 부과됩니다. 월 125만원 이하로 인출 한도를 조절하는 것을 권장합니다.
                  </p>
                </div>
              )}

              {/* 은퇴 인출 순서 원칙 */}
              <div className="mt-4 p-4 rounded-2xl bg-white/5 border border-white/10 flex flex-col gap-1.5">
                <span className="text-xs font-bold text-gray-200">📌 황금 인출 순서 3단계 원칙</span>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-[11px] text-gray-300 mt-1">
                  <div className="p-2 rounded-xl bg-black/30 border border-white/5">
                    <strong>1단계: 비과세 재원 인출</strong><br/>
                    세액공제 미반영 납입원금 (세금 0원)
                  </div>
                  <div className="p-2 rounded-xl bg-black/30 border border-white/5">
                    <strong>2단계: 이연퇴직소득 인출</strong><br/>
                    퇴직금 원금 (퇴직소득세 30~40% 감면)
                  </div>
                  <div className="p-2 rounded-xl bg-black/30 border border-white/5">
                    <strong>3단계: 공제원금 & 운용수익</strong><br/>
                    월 125만원 한도로 저율과세(3.3~5.5%) 인출
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── [서브탭 4] 금융소득 2,000만원 & 건보료 피부양자 방어 트래커 ─────── */}
      {activeSubTab === 'shield' && (
        <div className="flex flex-col gap-5">
          <TaxShieldRadar />
        </div>
      )}

    </div>
  );
}

class PensionErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('PensionWealthHub Error:', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full p-8 rounded-2xl bg-rose-950/30 border border-rose-500/30 text-white text-center space-y-4">
          <AlertTriangle className="w-12 h-12 text-rose-400 mx-auto" />
          <h3 className="text-lg font-bold">연금·절세 허브 로딩 중 오류가 발생했습니다.</h3>
          <p className="text-sm text-gray-400">{this.state.error?.message || '알 수 없는 오류'}</p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-500 rounded-xl text-sm font-semibold transition-all cursor-pointer"
          >
            다시 시도하기
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function PensionWealthHub() {
  return (
    <PensionErrorBoundary>
      <PensionWealthHubInner />
    </PensionErrorBoundary>
  );
}

