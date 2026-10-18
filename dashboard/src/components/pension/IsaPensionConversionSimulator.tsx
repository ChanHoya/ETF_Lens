'use client';

import React, { useState, useMemo } from 'react';
import { 
  Sparkles, PiggyBank, ShieldCheck, AlertTriangle, 
  ArrowRight, CheckCircle2, TrendingUp, Calendar, 
  Calculator, DollarSign, Info, ShieldAlert, Award
} from 'lucide-react';
import { 
  ResponsiveContainer, AreaChart, Area, 
  XAxis, YAxis, Tooltip, CartesianGrid, Legend 
} from 'recharts';
import { calculate20YearWithdrawalPlan } from '@/lib/pensionRules';

export default function IsaPensionConversionSimulator() {
  // ── 1. ISA 전환 세액공제 상태 ──
  const [isaTransferAmount, setIsaTransferAmount] = useState<number>(3000); // 3,000만원 (10% = 300만원 한도 풀)
  const [incomeType, setIncomeType] = useState<'under55' | 'over55'>('under55'); // 5,500만 이하(16.5%) vs 초과(13.2%)
  const [existingPensionContribution, setExistingPensionContribution] = useState<number>(900); // 연금저축+IRP 900만원

  // ── 2. 55세 이후 20개년 인출 시뮬레이터 상태 ──
  const [initialAsset, setInitialAsset] = useState<number>(20000); // 2억원 (20,000만원)
  const [startAge, setStartAge] = useState<number>(55);           // 55세 개시
  const [monthlyWithdrawal, setMonthlyWithdrawal] = useState<number>(125); // 월 125만원 (연 1,500만원 사적연금 기준선)
  const [growthRate, setGrowthRate] = useState<number>(4.5);      // 연 4.5% 운용

  // 1. ISA 전환 세액공제 계산
  const isaDeductionRate = incomeType === 'under55' ? 0.165 : 0.132;
  const isaBonusDeductible = Math.min(300, Math.round(isaTransferAmount * 0.1));
  const baseDeductible = Math.min(900, existingPensionContribution);
  const totalDeductibleThisYear = baseDeductible + isaBonusDeductible; // 최대 1,200만원
  const totalTaxRefundThisYear = Math.round(totalDeductibleThisYear * isaDeductionRate * 10) / 10;
  const isaOnlyTaxRefund = Math.round(isaBonusDeductible * isaDeductionRate * 10) / 10;

  // 2. 20개년 인출 시뮬레이션 결과 계산
  const planResult = useMemo(() => {
    return calculate20YearWithdrawalPlan({
      initialPensionAssetManwon: initialAsset,
      startAge,
      monthlyWithdrawalManwon: monthlyWithdrawal,
      annualGrowthRatePct: growthRate,
    });
  }, [initialAsset, startAge, monthlyWithdrawal, growthRate]);

  // 차트 데이터 가공
  const chartData = useMemo(() => {
    return planResult.schedules.map(s => ({
      name: `${s.age}세(${s.year}년차)`,
      기말잔여평가액: s.endingAsset,
      연간실수령액: s.netIncome,
      납부세금: s.taxAmount,
      법정한도: s.isUnlimited ? null : s.legalLimit,
    }));
  }, [planResult]);

  return (
    <div className="w-full space-y-6">
      {/* ── PART 1: ISA 만기 자금 연금계좌 전환 세액공제 부스터 ── */}
      <div className="rounded-2xl bg-gradient-to-br from-[#161a26] via-[#1a1f30] to-[#12141c] border border-indigo-500/30 p-5 shadow-2xl relative overflow-hidden">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              <Sparkles className="w-5 h-5 text-amber-400 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white tracking-tight">
                  ISA 만기 자금 연금 전환 세액공제 부스터 (최대 300만원 추가공제)
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  합산 최대 1,200만원 한도
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                ISA 3년 만기 후 60일 이내에 연금저축/IRP로 이전 시, 전환액의 10%(최대 300만원)를 추가 세액공제합니다.
              </p>
            </div>
          </div>

          {/* 소득 구간 토글 */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-black/40 border border-white/10 text-xs">
            <button
              onClick={() => setIncomeType('under55')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                incomeType === 'under55'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              총급여 5,500만 이하 (16.5%)
            </button>
            <button
              onClick={() => setIncomeType('over55')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                incomeType === 'over55'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              5,500만 초과 (13.2%)
            </button>
          </div>
        </div>

        {/* 컨트롤 슬라이더 & 환급 카드 그리드 */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 mt-4">
          <div className="lg:col-span-7 space-y-4">
            <div>
              <div className="flex justify-between text-xs font-semibold text-gray-300 mb-1.5">
                <span>ISA 만기 후 연금계좌 이전 금액</span>
                <span className="text-indigo-400 font-bold">{isaTransferAmount.toLocaleString()}만원</span>
              </div>
              <input
                type="range"
                min={0}
                max={6000}
                step={500}
                value={isaTransferAmount}
                onChange={(e) => setIsaTransferAmount(Number(e.target.value))}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
              <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                <span>0원</span>
                <span>3,000만원 (한도 풀)</span>
                <span>6,000만원</span>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold text-gray-300 mb-1.5">
                <span>당해 연도 연금저축 + IRP 기본 납입액</span>
                <span className="text-emerald-400 font-bold">{existingPensionContribution.toLocaleString()}만원</span>
              </div>
              <input
                type="range"
                min={0}
                max={900}
                step={100}
                value={existingPensionContribution}
                onChange={(e) => setExistingPensionContribution(Number(e.target.value))}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
              <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                <span>0원</span>
                <span>연금저축(600만)</span>
                <span>합산 풀(900만원)</span>
              </div>
            </div>

            {/* 절세 핵심 꿀팁 */}
            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 space-y-1 text-xs text-gray-300">
              <div className="flex items-center gap-1.5 text-amber-300 font-semibold">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>ISA 3년 만기 풍차돌리기 최적 공식</span>
              </div>
              <p className="text-[11px] text-gray-400 leading-relaxed">
                ISA는 3년마다 해지 후 연금계좌로 전환하는 것이 가장 유리합니다. 전환된 금액은 연금계좌 한도(1,800만원)와 별도로 입금되며, 3,000만원 전환 시 10%인 300만원 전액을 당해 연도 세액공제 한도에 보너스로 얹을 수 있습니다.
              </p>
            </div>
          </div>

          {/* 우측: 연말정산 환급액 대형 전광판 */}
          <div className="lg:col-span-5 p-4 rounded-xl bg-[#131620] border border-indigo-500/30 flex flex-col justify-between">
            <div>
              <span className="text-xs font-bold text-indigo-300">당해 연도 연말정산 예상 총 환급액</span>
              <div className="flex items-baseline gap-1 mt-1">
                <h2 className="text-3xl font-black text-white tracking-tight">
                  +{totalTaxRefundThisYear.toLocaleString()}
                </h2>
                <span className="text-sm font-semibold text-gray-400">만원</span>
              </div>
              <p className="text-[11px] text-emerald-400 font-medium mt-0.5">
                적용 공제율: {(isaDeductionRate * 100).toFixed(1)}% (총 공제액: {totalDeductibleThisYear.toLocaleString()}만원)
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-white/10 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-400">연금 기본 환급액:</span>
                <span className="font-semibold text-gray-200">
                  +{Math.round(baseDeductible * isaDeductionRate * 10) / 10}만원
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-amber-300 font-semibold flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  ISA 전환 보너스 환급:
                </span>
                <span className="font-bold text-amber-300">
                  +{isaOnlyTaxRefund}만원
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── PART 2: 55세 이후 연금수령 한도(소득세법 제40조의2) & 20개년 인출 시뮬레이터 ── */}
      <div className="rounded-2xl bg-[#161a26] border border-white/10 p-5 shadow-xl">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white tracking-tight">
                  55세 이후 연금수령 한도 & 20개년 인출 시뮬레이터
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  소득세법 시행령 제40조의2
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                수령 1~10년차는 【(계좌평가액 ÷ (11 - 수령연차)) × 120%】 한도 내 인출 시에만 3.3~5.5% 저율과세가 보장됩니다.
              </p>
            </div>
          </div>

          <div className="text-xs text-right">
            <span className="text-gray-400">20년 누적 실효세율: </span>
            <span className="font-bold text-emerald-400 text-sm">{planResult.effectiveTaxRate20Y}%</span>
          </div>
        </div>

        {/* 인풋 컨트롤 4개 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 my-4">
          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
            <label className="text-[11px] font-semibold text-gray-400">수령 개시 시점 연금 평가액</label>
            <div className="flex items-center gap-1.5 mt-1.5">
              <input
                type="number"
                step={1000}
                value={initialAsset}
                onChange={(e) => setInitialAsset(Math.max(0, Number(e.target.value)))}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-2.5 py-1.5 text-sm font-bold text-white focus:outline-none focus:border-indigo-500"
              />
              <span className="text-xs text-gray-400 shrink-0">만원</span>
            </div>
            <div className="text-[10px] text-gray-500 mt-1">약 {(initialAsset / 10000).toFixed(1)}억원</div>
          </div>

          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
            <label className="text-[11px] font-semibold text-gray-400">수령 개시 나이 (만 세)</label>
            <div className="flex items-center gap-1.5 mt-1.5">
              <input
                type="number"
                min={55}
                max={75}
                value={startAge}
                onChange={(e) => setStartAge(Math.max(55, Number(e.target.value)))}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-2.5 py-1.5 text-sm font-bold text-white focus:outline-none focus:border-indigo-500"
              />
              <span className="text-xs text-gray-400 shrink-0">세</span>
            </div>
            <div className="text-[10px] text-gray-500 mt-1">법정 최소 개시나이: 만 55세</div>
          </div>

          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
            <label className="text-[11px] font-semibold text-gray-400">월 희망 인출액</label>
            <div className="flex items-center gap-1.5 mt-1.5">
              <input
                type="number"
                step={5}
                value={monthlyWithdrawal}
                onChange={(e) => setMonthlyWithdrawal(Math.max(10, Number(e.target.value)))}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-2.5 py-1.5 text-sm font-bold text-white focus:outline-none focus:border-indigo-500"
              />
              <span className="text-xs text-gray-400 shrink-0">만원</span>
            </div>
            <div className="text-[10px] text-emerald-400 mt-1">
              연 {(monthlyWithdrawal * 12).toLocaleString()}만원 {monthlyWithdrawal <= 125 ? '(1,500만 이하 안전)' : '(초과 분리과세 검토)'}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
            <label className="text-[11px] font-semibold text-gray-400">은퇴 후 잔여 자산 연수익률</label>
            <div className="flex items-center gap-1.5 mt-1.5">
              <input
                type="number"
                step={0.5}
                value={growthRate}
                onChange={(e) => setGrowthRate(Number(e.target.value))}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-2.5 py-1.5 text-sm font-bold text-white focus:outline-none focus:border-indigo-500"
              />
              <span className="text-xs text-gray-400 shrink-0">%</span>
            </div>
            <div className="text-[10px] text-gray-500 mt-1">배당/채권 중심 인플레이션 방어</div>
          </div>
        </div>

        {/* 20개년 잔여 평가액 차트 */}
        <div className="h-64 w-full mt-4 bg-black/20 rounded-xl p-3 border border-white/5">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
              <defs>
                <linearGradient id="colorAsset" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#818cf8" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="#818cf8" stopOpacity={0.0}/>
                </linearGradient>
                <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#34d399" stopOpacity={0.5}/>
                  <stop offset="95%" stopColor="#34d399" stopOpacity={0.0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
              <XAxis dataKey="name" stroke="#9ca3af" fontSize={10} />
              <YAxis stroke="#9ca3af" fontSize={10} tickFormatter={(v) => `${(v/10000).toFixed(1)}억`} />
              <Tooltip
                contentStyle={{ backgroundColor: '#181b24', borderColor: '#ffffff20', borderRadius: '8px', fontSize: '11px' }}
                formatter={(val: any) => [`${Number(val).toLocaleString()}만원`, '']}
              />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              <Area type="monotone" dataKey="기말잔여평가액" stroke="#818cf8" fillOpacity={1} fill="url(#colorAsset)" name="기말 잔여 자산" />
              <Area type="monotone" dataKey="연간실수령액" stroke="#34d399" fillOpacity={1} fill="url(#colorIncome)" name="연간 세후 실수령액" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* 20개년 인출 스케줄 테이블 */}
        <div className="mt-5 overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-white/[0.04] text-gray-400 font-semibold border-b border-white/10 whitespace-nowrap">
                <th className="py-2.5 px-3">연차 / 나이</th>
                <th className="py-2.5 px-3 text-right">기초 자산</th>
                <th className="py-2.5 px-3 text-right">법정 수령한도</th>
                <th className="py-2.5 px-3 text-right">연간 인출액</th>
                <th className="py-2.5 px-2 text-center">적용 세율</th>
                <th className="py-2.5 px-3 text-right">납부 세금</th>
                <th className="py-2.5 px-3 text-right">세후 실수령액</th>
                <th className="py-2.5 px-3 text-right">기말 잔여 자산</th>
                <th className="py-2.5 px-2 text-center">상태</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-mono text-[11px]">
              {planResult.schedules.map((row) => (
                <tr key={row.year} className={`hover:bg-white/[0.02] ${row.isOverLimit ? 'bg-rose-500/5' : ''}`}>
                  <td className="py-2 px-3 text-gray-300 font-sans">
                    {row.year}년차 <span className="text-gray-500 font-normal">({row.age}세)</span>
                  </td>
                  <td className="py-2 px-3 text-right text-gray-300">
                    {row.beginningAsset.toLocaleString()}만
                  </td>
                  <td className="py-2 px-3 text-right text-purple-300">
                    {row.isUnlimited ? <span className="text-emerald-400">무제한 (자유)</span> : `${row.legalLimit.toLocaleString()}만`}
                  </td>
                  <td className="py-2 px-3 text-right font-bold text-white">
                    {row.actualWithdrawal.toLocaleString()}만
                  </td>
                  <td className="py-2 px-2 text-center">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      row.isOverLimit ? 'bg-rose-500/20 text-rose-300' : 'bg-emerald-500/15 text-emerald-300'
                    }`}>
                      {row.appliedTaxRatePct}%
                    </span>
                  </td>
                  <td className="py-2 px-3 text-right text-rose-400">
                    -{row.taxAmount.toLocaleString()}만
                  </td>
                  <td className="py-2 px-3 text-right text-emerald-300 font-bold">
                    {row.netIncome.toLocaleString()}만
                  </td>
                  <td className="py-2 px-3 text-right font-bold text-indigo-300">
                    {row.endingAsset.toLocaleString()}만
                  </td>
                  <td className="py-2 px-2 text-center">
                    {row.isOverLimit ? (
                      <span className="text-rose-400 font-bold text-[10px]" title="한도 초과 16.5% 과세 페널티">한도초과</span>
                    ) : (
                      <span className="text-emerald-400 font-bold text-[10px]">정상</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 하단 요약 및 세법 조언 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4 pt-4 border-t border-white/5">
          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1.5">
            <h4 className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
              <Award className="w-4 h-4 text-amber-400" />
              <span>20개년 인출 종합 통계</span>
            </h4>
            <div className="grid grid-cols-2 gap-2 text-xs text-gray-300 pt-1">
              <div>총 인출액: <b className="text-white">{planResult.totalWithdrawal20Y.toLocaleString()}만원</b></div>
              <div>총 납부세금: <b className="text-rose-400">{planResult.totalTaxPaid20Y.toLocaleString()}만원</b></div>
              <div>총 실수령액: <b className="text-emerald-400">{planResult.totalNetIncome20Y.toLocaleString()}만원</b></div>
              <div>20년후 잔여자산: <b className="text-indigo-300">{planResult.finalAssetAt20Y.toLocaleString()}만원</b></div>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1 text-xs text-gray-400">
            <h4 className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
              <Info className="w-4 h-4" />
              <span>소득세법 핵심 체크포인트</span>
            </h4>
            <ul className="list-disc list-inside space-y-0.5 text-[11px] leading-relaxed">
              <li>11년차부터는 수령한도 공식이 폐지되어 전액 3.3~4.4%로 자유 인출 가능합니다.</li>
              <li>사적연금 연 1,500만원(월 125만원) 이하는 종합과세 없이 저율 분리과세로 종결됩니다.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
