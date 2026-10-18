'use client';

import React, { useState, useMemo } from 'react';
import {
  ShieldCheck, ShieldAlert, AlertTriangle, ArrowDown, CheckCircle2,
  HelpCircle, DollarSign, Layers, Sparkles, TrendingUp, Info, ChevronRight
} from 'lucide-react';

interface WaterfallResult {
  step1TaxFree: number;       // 1단계: 비과세 원금 인출액
  step2Retirement: number;     // 2단계: 이연퇴직금 인출액
  step3PrivatePension: number; // 3단계: 사적연금(연 1500만 한도 내) 인출액
  step4PublicPension: number;  // 4단계: 국민연금 수령액
  step5OtherWithdrawal: number;// 5단계: 초과 사적연금/일반과세 인출액
  totalAnnualWithdrawn: number;
  totalTax: number;
  effectiveTaxRate: number;
  // 건보료 피부양자 판정
  healthInsuranceIncome: number; // 건보료 산정 합산소득 (공적연금 100% + 금융소득 2000만 초과분 + 기타)
  isHealthInsuranceSafe: boolean;
  healthInsuranceHeadroom: number;
}

export default function PensionWaterfallShieldPlanner() {
  // ── 1. 은퇴 자산 및 소득 파라미터 ──────────────────────────────
  const [targetMonthlyNeed, setTargetMonthlyNeed] = useState<number>(300); // 월 필요 생활비 300만원 (연 3,600만원)
  const [taxFreeBalance, setTaxFreeBalance] = useState<number>(4000);      // 비과세 미공제 원금 (4,000만원)
  const [severanceBalance, setSeveranceBalance] = useState<number>(12000); // 이연퇴직금 IRP 잔액 (1.2억원)
  const [pensionDeductedBalance, setPensionDeductedBalance] = useState<number>(15000); // 공제원금+수익 (1.5억원)
  const [annualNationalPension, setAnnualNationalPension] = useState<number>(1440);   // 국민연금 연 수령액 (월 120만원 -> 연 1,440만원)
  const [otherFinancialIncome, setOtherFinancialIncome] = useState<number>(300);     // 이자/배당 금융소득 (연 300만원)
  const [retirementTaxRatePct, setRetirementTaxRatePct] = useState<number>(7.0);     // 기본 퇴직소득세율 7% (10년이내 70% 납부 = 4.9%)
  const [isAfter10Years, setIsAfter10Years] = useState<boolean>(false);               // 11년차 이상 (60% 납부)

  // ── 2. 워터폴(Waterfall) 순서별 인출 및 건보료 계산 ────────────────
  const calculation = useMemo<WaterfallResult>(() => {
    const annualNeed = targetMonthlyNeed * 12;
    let remainingNeed = annualNeed;

    // 국민연금은 의무/고정 수령 소득으로 우선 반영 (생활비 충당)
    const step4Public = Math.min(remainingNeed, annualNationalPension);
    remainingNeed = Math.max(0, remainingNeed - step4Public);

    // 1단계: 비과세 원금 인출 (세금 0%, 건보료 합산 0원)
    const step1 = Math.min(remainingNeed, taxFreeBalance);
    remainingNeed = Math.max(0, remainingNeed - step1);

    // 2단계: 이연퇴직소득 인출 (퇴직소득세 감면 분리과세, 건보료 합산 완전 제외!)
    // 퇴직금은 연금으로 수령 시 10년 이하 30% 감면(70% 납부), 11년차 이상 40% 감면(60% 납부)
    const step2 = Math.min(remainingNeed, severanceBalance);
    remainingNeed = Math.max(0, remainingNeed - step2);

    // 3단계: 사적연금(연금저축/IRP 운용수익·공제원금) 저율 분리과세 한도 (연 1,500만원 한도 내)
    // 5.5% 저율과세, 건보료 합산 제외 (사적연금은 현재 건보료 부과 대상 아님)
    const maxSafePrivatePension = 1500;
    const step3 = Math.min(remainingNeed, pensionDeductedBalance, maxSafePrivatePension);
    remainingNeed = Math.max(0, remainingNeed - step3);

    // 5단계: 부족분 추가 인출 (사적연금 1,500만원 초과분 -> 16.5% 분리과세 또는 종합과세)
    const remainingPrivateBalance = Math.max(0, pensionDeductedBalance - step3);
    const step5 = Math.min(remainingNeed, remainingPrivateBalance);
    remainingNeed = Math.max(0, remainingNeed - step5);

    // 세금 계산
    // 1단계 세금: 0원
    const tax1 = 0;
    // 2단계 세금: 퇴직소득세율 * (10년차이하 0.70 / 11년차이상 0.60)
    const severanceDiscount = isAfter10Years ? 0.60 : 0.70;
    const effectiveSeveranceTaxRate = (retirementTaxRatePct / 100) * severanceDiscount;
    const tax2 = step2 * effectiveSeveranceTaxRate;
    // 3단계 세금: 5.5% (만 55~69세 기준)
    const tax3 = step3 * 0.055;
    // 4단계 세금: 국민연금은 연금소득공제 후 기본세율(약 3~5% 내외 실효세율)
    const tax4 = step4Public > 700 ? (step4Public - 700) * 0.06 : 0;
    // 5단계 세금: 16.5% 분리과세 적용
    const tax5 = step5 * 0.165;

    const totalAnnualWithdrawn = step1 + step2 + step3 + step4Public + step5;
    const totalTax = tax1 + tax2 + tax3 + tax4 + tax5;
    const effectiveTaxRate = totalAnnualWithdrawn > 0 ? (totalTax / totalAnnualWithdrawn) * 100 : 0;

    // 건보료 피부양자 합산소득 판정 (연 2,000만원 기준)
    // 1) 공적연금(국민연금 등) 소득: 100% 반영
    // 2) 금융소득(이자/배당): 연 2,000만원 초과 시 '전액' 합산 (2,000만원 이하면 0원 합산)
    // 3) 사적연금/퇴직연금: 현재 법상 건보료 부과대상 제외!
    const countedFinancialIncome = otherFinancialIncome > 2000 ? otherFinancialIncome : 0;
    const healthInsuranceIncome = annualNationalPension + countedFinancialIncome;
    const isHealthInsuranceSafe = healthInsuranceIncome <= 2000;
    const healthInsuranceHeadroom = Math.max(0, 2000 - healthInsuranceIncome);

    return {
      step1TaxFree: step1,
      step2Retirement: step2,
      step3PrivatePension: step3,
      step4PublicPension: step4Public,
      step5OtherWithdrawal: step5,
      totalAnnualWithdrawn,
      totalTax,
      effectiveTaxRate,
      healthInsuranceIncome,
      isHealthInsuranceSafe,
      healthInsuranceHeadroom,
    };
  }, [
    targetMonthlyNeed,
    taxFreeBalance,
    severanceBalance,
    pensionDeductedBalance,
    annualNationalPension,
    otherFinancialIncome,
    retirementTaxRatePct,
    isAfter10Years
  ]);

  return (
    <div className="w-full flex flex-col gap-5 text-gray-100">
      {/* ── 1. 상단 인트로 & 피부양자 방어 요약 ───────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* 좌측: 건보료 피부양자 방어 게이지 카드 (5 cols) */}
        <div className={`lg:col-span-5 rounded-3xl p-5 border backdrop-blur-xl flex flex-col justify-between ${
          calculation.isHealthInsuranceSafe
            ? 'bg-gradient-to-br from-emerald-950/40 via-teal-950/30 to-black/50 border-emerald-500/30 shadow-lg shadow-emerald-950/30'
            : 'bg-gradient-to-br from-rose-950/40 via-red-950/30 to-black/50 border-rose-500/30 shadow-lg shadow-rose-950/30'
        }`}>
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                건보료 피부양자 자격 방어선
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-black ${
                calculation.isHealthInsuranceSafe
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse'
              }`}>
                {calculation.isHealthInsuranceSafe ? '🛡️ 피부양자 유지 안전' : '⚠️ 박탈 위험 경보'}
              </span>
            </div>

            <div className="mt-4">
              <div className="text-xs text-gray-400">건보료 산정 연간 합산소득</div>
              <div className="flex items-baseline gap-2 mt-1">
                <span className={`text-3xl font-black ${
                  calculation.isHealthInsuranceSafe ? 'text-emerald-400' : 'text-rose-400'
                }`}>
                  {calculation.healthInsuranceIncome.toLocaleString()}
                </span>
                <span className="text-sm text-gray-400">/ 2,000 만원 (한도)</span>
              </div>
            </div>

            {/* 프로그레스 바 */}
            <div className="mt-3">
              <div className="w-full bg-black/50 rounded-full h-3 border border-white/10 overflow-hidden relative">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    calculation.isHealthInsuranceSafe
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                      : 'bg-gradient-to-r from-amber-500 to-rose-500'
                  }`}
                  style={{ width: `${Math.min(100, (calculation.healthInsuranceIncome / 2000) * 100)}%` }}
                />
              </div>
              <div className="flex justify-between items-center text-[11px] text-gray-400 mt-1.5">
                <span>0원</span>
                <span>안전 여유분: <strong>{calculation.healthInsuranceHeadroom.toLocaleString()}만원</strong></span>
                <span className="text-rose-400">2,000만원 초과 시 전액 지역가입자 전환</span>
              </div>
            </div>
          </div>

          <div className="mt-4 p-3 rounded-2xl bg-black/40 border border-white/10 text-xs text-gray-300 leading-relaxed">
            💡 <strong>황금 절세 포인트</strong>: 사적연금(연금저축/IRP)과 이연퇴직금 인출액은 현행 건강보험법상 <strong>건보료 산정 합산소득에서 100% 제외</strong>됩니다! 국민연금(공적연금 100% 반영) 수령액이 연 2,000만원을 넘지 않도록 연기/분할을 조율하면 피부양자 자격을 영구 보존할 수 있습니다.
          </div>
        </div>

        {/* 우측: 인출 워터폴 실효세율 요약 (7 cols) */}
        <div className="lg:col-span-7 bg-black/40 border border-white/10 rounded-3xl p-5 backdrop-blur-xl flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div>
              <h2 className="text-sm md:text-base font-bold text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-teal-400" />
                황금 인출 순서(Waterfall) 세금 진단표
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                월 {targetMonthlyNeed}만원 (연 {targetMonthlyNeed * 12}만원) 생활비 인출 시 단계별 최적 세제 혜택
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs text-gray-400">연간 총 세금 / 실효세율</span>
              <div className="text-lg md:text-xl font-black text-amber-400">
                {calculation.totalTax.toFixed(1)} <span className="text-xs text-gray-300 font-normal">만원</span>
                <span className="text-xs ml-1.5 px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-bold">
                  {calculation.effectiveTaxRate.toFixed(1)}%
                </span>
              </div>
            </div>
          </div>

          {/* 4단계 워터폴 시각화 카드 그리드 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 my-3">
            <div className="p-3 rounded-2xl bg-white/5 border border-white/5 flex flex-col justify-between">
              <div>
                <span className="text-[10px] text-teal-300 font-bold flex items-center gap-1">
                  1순위 · 비과세원금
                </span>
                <div className="text-base font-black text-white mt-1">
                  {calculation.step1TaxFree.toLocaleString()} <span className="text-[10px] text-gray-400 font-normal">만원</span>
                </div>
              </div>
              <span className="text-[10px] text-emerald-400 mt-2 font-medium">세율 0% (완전 비과세)</span>
            </div>

            <div className="p-3 rounded-2xl bg-white/5 border border-white/5 flex flex-col justify-between">
              <div>
                <span className="text-[10px] text-indigo-300 font-bold flex items-center gap-1">
                  2순위 · 이연퇴직금
                </span>
                <div className="text-base font-black text-white mt-1">
                  {calculation.step2Retirement.toLocaleString()} <span className="text-[10px] text-gray-400 font-normal">만원</span>
                </div>
              </div>
              <span className="text-[10px] text-indigo-400 mt-2 font-medium">
                퇴직세 30~40% 감면
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-white/5 border border-white/5 flex flex-col justify-between">
              <div>
                <span className="text-[10px] text-amber-300 font-bold flex items-center gap-1">
                  3순위 · 사적연금
                </span>
                <div className="text-base font-black text-white mt-1">
                  {calculation.step3PrivatePension.toLocaleString()} <span className="text-[10px] text-gray-400 font-normal">만원</span>
                </div>
              </div>
              <span className="text-[10px] text-amber-400 mt-2 font-medium">
                연 1,500만 한도 5.5%
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-white/5 border border-white/5 flex flex-col justify-between">
              <div>
                <span className="text-[10px] text-purple-300 font-bold flex items-center gap-1">
                  기본 · 국민연금
                </span>
                <div className="text-base font-black text-white mt-1">
                  {calculation.step4PublicPension.toLocaleString()} <span className="text-[10px] text-gray-400 font-normal">만원</span>
                </div>
              </div>
              <span className="text-[10px] text-purple-400 mt-2 font-medium">
                기본 공적연금 공제
              </span>
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-teal-950/20 border border-teal-500/20 text-[11px] text-teal-300/90 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
            <span>
              <strong>최적화 결과</strong>: 일반 종합과세(최대 49.5%) 대비 워터폴 인출을 통해 약 <strong>{(calculation.totalAnnualWithdrawn * 0.15 - calculation.totalTax).toFixed(0)}만원</strong> 이상의 세금을 즉시 방어했습니다.
            </span>
          </div>
        </div>
      </div>

      {/* ── 2. 인터랙티브 인출 파라미터 튜닝 슬라이더 ─────────────────── */}
      <div className="bg-black/40 border border-white/10 rounded-3xl p-5 backdrop-blur-xl">
        <h3 className="text-sm font-bold text-gray-200 border-b border-white/10 pb-2 mb-4 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-emerald-400" />
          보유 자산 및 월 인출 설계 슬라이더
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* 1. 월 희망 생활비 */}
          <div className="flex flex-col gap-1.5 p-3 rounded-2xl bg-white/5 border border-white/5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-300 font-medium">월 필요 생활비</span>
              <span className="font-bold text-emerald-400">{targetMonthlyNeed} 만원/월 <span className="text-gray-500 font-normal">(연 {targetMonthlyNeed * 12}만)</span></span>
            </div>
            <input
              type="range"
              min="150"
              max="700"
              step="10"
              value={targetMonthlyNeed}
              onChange={(e) => setTargetMonthlyNeed(Number(e.target.value))}
              className="accent-emerald-500 w-full cursor-pointer h-1.5 bg-white/10 rounded-lg"
            />
          </div>

          {/* 2. 비과세 납입원금 잔액 */}
          <div className="flex flex-col gap-1.5 p-3 rounded-2xl bg-white/5 border border-white/5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-300 font-medium">1순위 비과세 미공제 원금</span>
              <span className="font-bold text-teal-400">{taxFreeBalance.toLocaleString()} 만원</span>
            </div>
            <input
              type="range"
              min="0"
              max="15000"
              step="500"
              value={taxFreeBalance}
              onChange={(e) => setTaxFreeBalance(Number(e.target.value))}
              className="accent-teal-500 w-full cursor-pointer h-1.5 bg-white/10 rounded-lg"
            />
          </div>

          {/* 3. 이연퇴직금 IRP 잔액 */}
          <div className="flex flex-col gap-1.5 p-3 rounded-2xl bg-white/5 border border-white/5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-300 font-medium">2순위 이연퇴직금 잔액</span>
              <span className="font-bold text-indigo-400">{severanceBalance.toLocaleString()} 만원</span>
            </div>
            <input
              type="range"
              min="0"
              max="40000"
              step="1000"
              value={severanceBalance}
              onChange={(e) => setSeveranceBalance(Number(e.target.value))}
              className="accent-indigo-500 w-full cursor-pointer h-1.5 bg-white/10 rounded-lg"
            />
          </div>

          {/* 4. 사적연금 공제원금 & 수익 */}
          <div className="flex flex-col gap-1.5 p-3 rounded-2xl bg-white/5 border border-white/5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-300 font-medium">3순위 연금저축/IRP 적립금</span>
              <span className="font-bold text-amber-400">{pensionDeductedBalance.toLocaleString()} 만원</span>
            </div>
            <input
              type="range"
              min="0"
              max="50000"
              step="1000"
              value={pensionDeductedBalance}
              onChange={(e) => setPensionDeductedBalance(Number(e.target.value))}
              className="accent-amber-500 w-full cursor-pointer h-1.5 bg-white/10 rounded-lg"
            />
          </div>

          {/* 5. 국민연금 연간 수령액 */}
          <div className="flex flex-col gap-1.5 p-3 rounded-2xl bg-white/5 border border-white/5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-300 font-medium">국민연금 연간 예상액</span>
              <span className="font-bold text-purple-400">
                {annualNationalPension.toLocaleString()} 만원/년 <span className="text-gray-500 font-normal">(월 {(annualNationalPension / 12).toFixed(0)}만)</span>
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="3000"
              step="50"
              value={annualNationalPension}
              onChange={(e) => setAnnualNationalPension(Number(e.target.value))}
              className="accent-purple-500 w-full cursor-pointer h-1.5 bg-white/10 rounded-lg"
            />
          </div>

          {/* 6. 금융소득 (이자/배당) */}
          <div className="flex flex-col gap-1.5 p-3 rounded-2xl bg-white/5 border border-white/5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-300 font-medium">일반계좌 이자·배당 소득</span>
              <span className="font-bold text-rose-400">{otherFinancialIncome.toLocaleString()} 만원/년</span>
            </div>
            <input
              type="range"
              min="0"
              max="3000"
              step="50"
              value={otherFinancialIncome}
              onChange={(e) => setOtherFinancialIncome(Number(e.target.value))}
              className="accent-rose-500 w-full cursor-pointer h-1.5 bg-white/10 rounded-lg"
            />
          </div>
        </div>

        {/* 하단 체크박스 옵션 */}
        <div className="mt-4 flex flex-wrap items-center gap-4 pt-3 border-t border-white/10 text-xs">
          <label className="flex items-center gap-2 cursor-pointer text-gray-300 hover:text-white">
            <input
              type="checkbox"
              checked={isAfter10Years}
              onChange={(e) => setIsAfter10Years(e.target.checked)}
              className="rounded accent-emerald-500"
            />
            <span>연금 수령 11년차 이상 (퇴직소득세 감면율 30% → 40% 확대 적용)</span>
          </label>
        </div>
      </div>
    </div>
  );
}
