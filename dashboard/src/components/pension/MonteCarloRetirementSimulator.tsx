'use client';

import React, { useState, useMemo } from 'react';
import {
  TrendingUp, AlertTriangle, ShieldCheck, DollarSign,
  Layers, Sparkles, RefreshCw, Info, Calendar, CheckCircle2, ChevronRight
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, LineChart, Line,
  XAxis, YAxis, Tooltip, CartesianGrid, Legend, ReferenceLine
} from 'recharts';

interface MonteCarloTrajectoryPoint {
  age: number;
  year: number;
  p10: number; // 하위 10% (비관적 시나리오)
  p50: number; // 중위값 50% (중립적 시나리오)
  p90: number; // 상위 10% (낙관적 시나리오)
}

interface SimulationSummary {
  ruinProbability: number;     // 자산 고갈 확률 (%)
  medianFinalWealth: number;   // 90세 시점 중위 잔여 자산 (만원)
  ruinMedianAge: number | null;// 고갈 발생 시 평균 고갈 연령
  recommendedWithdrawalWon: number; // 권장 연간 안전 인출액
  actualAnnualWithdrawalWon: number;
  trajectory: MonteCarloTrajectoryPoint[];
}

export default function MonteCarloRetirementSimulator() {
  // ── 1. 시뮬레이터 입력 변수 ─────────────────────────────────────
  const [currentAge, setCurrentAge] = useState<number>(55);           // 현재/은퇴 연령 (55세)
  const [targetAge, setTargetAge] = useState<number>(90);             // 목표 시뮬레이션 연령 (90세)
  const [initialPortfolioWealth, setInitialPortfolioWealth] = useState<number>(80000); // 금융/연금 포트폴리오 (8억원)
  const [monthlyExpense, setMonthlyExpense] = useState<number>(300);   // 월 희망 생활비 (300만원 = 연 3,600만원)
  const [expectedReturnPct, setExpectedReturnPct] = useState<number>(6.5); // 포트폴리오 기대수익률 (연 6.5%)
  const [volatilityPct, setVolatilityPct] = useState<number>(12.0);    // 포트폴리오 연간 변동성(표준편차 12%)
  const [inflationPct, setInflationPct] = useState<number>(2.5);      // 물가상승률 (연 2.5%)
  const [nationalPensionMonthly, setNationalPensionMonthly] = useState<number>(120); // 65세 이후 국민연금 (월 120만원)
  const [pensionStartAge, setPensionStartAge] = useState<number>(65); // 국민연금 개시 연령 (65세)

  // ── 2. 의사 난수 몬테카를로 1,000회 시뮬레이션 연산 ─────────────
  // (Box-Muller 정규분포 난수 발생기)
  const simulation = useMemo<SimulationSummary>(() => {
    const years = Math.max(1, targetAge - currentAge);
    const SIM_COUNT = 1000;
    const trajectories: number[][] = Array.from({ length: SIM_COUNT }, () => [initialPortfolioWealth]);
    let ruinCount = 0;
    const ruinAges: number[] = [];

    // 고정 시드 형태의 Box-Muller 변환 난수 생성
    const gaussianRandom = (mean: number, stdDev: number) => {
      let u = 0, v = 0;
      while (u === 0) u = Math.random();
      while (v === 0) v = Math.random();
      const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
      return mean + z * stdDev;
    };

    const meanReturn = expectedReturnPct / 100;
    const stdDev = volatilityPct / 100;
    const inflation = inflationPct / 100;

    for (let sim = 0; sim < SIM_COUNT; sim++) {
      let wealth = initialPortfolioWealth;
      let ruined = false;
      let ruinAge: number | null = null;

      for (let y = 1; y <= years; y++) {
        const age = currentAge + y;

        if (wealth <= 0) {
          if (!ruined) {
            ruined = true;
            ruinAge = age;
            ruinCount++;
            ruinAges.push(age);
          }
          trajectories[sim].push(0);
          continue;
        }

        // 인플레이션이 반영된 연간 지출액
        const annualNeed = (monthlyExpense * 12) * Math.pow(1 + inflation, y - 1);
        
        // 국민연금 수령 반영 (수령 개시 연령 이후 지출 차감)
        let publicPension = 0;
        if (age >= pensionStartAge) {
          publicPension = (nationalPensionMonthly * 12) * Math.pow(1 + inflation, y - 1);
        }
        const netWithdrawal = Math.max(0, annualNeed - publicPension);

        // 연초 인출 가정
        wealth = Math.max(0, wealth - netWithdrawal);

        // 연간 확률적 투자 수익률 적용 (기하 브라운 운동 기반)
        const annualReturn = gaussianRandom(meanReturn, stdDev);
        wealth = Math.max(0, wealth * (1 + annualReturn));

        trajectories[sim].push(Math.round(wealth));
      }
    }

    // 분위수(p10, p50, p90) 집계
    const trajectoryData: MonteCarloTrajectoryPoint[] = [];
    for (let y = 0; y <= years; y++) {
      const yearWealths = trajectories.map(t => t[y]).sort((a, b) => a - b);
      const p10 = yearWealths[Math.floor(SIM_COUNT * 0.10)];
      const p50 = yearWealths[Math.floor(SIM_COUNT * 0.50)];
      const p90 = yearWealths[Math.floor(SIM_COUNT * 0.90)];

      trajectoryData.push({
        age: currentAge + y,
        year: y,
        p10,
        p50,
        p90
      });
    }

    const ruinProbability = Math.round((ruinCount / SIM_COUNT) * 1000) / 10;
    const medianFinalWealth = trajectoryData[trajectoryData.length - 1].p50;
    const ruinMedianAge = ruinAges.length > 0
      ? Math.round(ruinAges.reduce((a, b) => a + b, 0) / ruinAges.length)
      : null;

    // 안전 인출률 (한국형 3.2% 기준)
    const recommendedWithdrawalWon = Math.round(initialPortfolioWealth * 0.032);
    const actualAnnualWithdrawalWon = monthlyExpense * 12;

    return {
      ruinProbability,
      medianFinalWealth,
      ruinMedianAge,
      recommendedWithdrawalWon,
      actualAnnualWithdrawalWon,
      trajectory: trajectoryData
    };
  }, [
    currentAge,
    targetAge,
    initialPortfolioWealth,
    monthlyExpense,
    expectedReturnPct,
    volatilityPct,
    inflationPct,
    nationalPensionMonthly,
    pensionStartAge
  ]);

  return (
    <div className="w-full flex flex-col gap-5 text-gray-100">
      {/* ── 1. 상단 핵심 지표 요약 Bento ────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* 카드 1: 자산 고갈 확률 */}
        <div className={`p-4 rounded-2xl border backdrop-blur-md flex flex-col justify-between ${
          simulation.ruinProbability <= 5
            ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300'
            : simulation.ruinProbability <= 15
            ? 'bg-amber-950/30 border-amber-500/30 text-amber-300'
            : 'bg-rose-950/30 border-rose-500/30 text-rose-300'
        }`}>
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold">은퇴 자산 고갈 확률 (Ruin)</span>
            <span className="p-1 rounded-md bg-white/10">
              {simulation.ruinProbability <= 5 ? <ShieldCheck className="w-4 h-4 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 text-amber-400" />}
            </span>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black">
              {simulation.ruinProbability}%
            </div>
            <p className="text-[11px] text-gray-300/80 mt-0.5">
              {simulation.ruinProbability <= 5
                ? '🛡️ 극도로 안전한 은퇴 포트폴리오'
                : simulation.ruinProbability <= 15
                ? '⚠️ 적정 안전 구간 (물가 변동 주의)'
                : `🚨 ${simulation.ruinMedianAge ? `평균 만 ${simulation.ruinMedianAge}세` : '목표 연령 전'} 자산 고갈 위험`}
            </p>
          </div>
        </div>

        {/* 카드 2: 90세 시점 예상 잔여 순자산(중위값) */}
        <div className="p-4 rounded-2xl bg-black/40 border border-white/10 backdrop-blur-md flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>{targetAge}세 시점 예상 잔여 자산(중위값)</span>
            <span className="p-1 rounded-md bg-teal-500/10 text-teal-400"><TrendingUp className="w-4 h-4" /></span>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-teal-400">
              {simulation.medianFinalWealth.toLocaleString()} <span className="text-xs text-gray-400 font-normal">만원</span>
            </div>
            <p className="text-[11px] text-gray-400 mt-0.5">
              초기 {initialPortfolioWealth.toLocaleString()}만원 대비 {((simulation.medianFinalWealth / initialPortfolioWealth) * 100).toFixed(0)}% 보존
            </p>
          </div>
        </div>

        {/* 카드 3: 실제 연간 인출액 vs 한국형 안전 인출선 */}
        <div className="p-4 rounded-2xl bg-black/40 border border-white/10 backdrop-blur-md flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>실제 인출 vs 안전 인출선(3.2%)</span>
            <span className="p-1 rounded-md bg-indigo-500/10 text-indigo-400"><DollarSign className="w-4 h-4" /></span>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-indigo-400">
              {simulation.actualAnnualWithdrawalWon.toLocaleString()} <span className="text-xs text-gray-400 font-normal">만원/년</span>
            </div>
            <p className="text-[11px] text-gray-400 mt-0.5">
              안전 인출 권장선: 연 <strong>{simulation.recommendedWithdrawalWon.toLocaleString()}만원</strong>
            </p>
          </div>
        </div>

        {/* 카드 4: 국민연금 은퇴 방어 기여도 */}
        <div className="p-4 rounded-2xl bg-black/40 border border-white/10 backdrop-blur-md flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>국민연금 방어 기여도 ({pensionStartAge}세~)</span>
            <span className="p-1 rounded-md bg-purple-500/10 text-purple-400"><Sparkles className="w-4 h-4" /></span>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-purple-400">
              {(nationalPensionMonthly * 12).toLocaleString()} <span className="text-xs text-gray-400 font-normal">만원/년</span>
            </div>
            <p className="text-[11px] text-gray-400 mt-0.5">
              생활비의 {((nationalPensionMonthly / monthlyExpense) * 100).toFixed(0)}%를 공적연금으로 방어
            </p>
          </div>
        </div>
      </div>

      {/* ── 2. 몬테카를로 10%/50%/90% 분위수 자산 궤적 차트 ─────────── */}
      <div className="p-5 rounded-3xl bg-black/40 border border-white/10 backdrop-blur-xl flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-3">
          <div>
            <h3 className="text-sm md:text-base font-bold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-400" />
              은퇴 후 35개년 자산 보존 궤적 (1,000회 몬테카를로 시뮬레이션)
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              상위 10%(낙관) · 중위 50%(중립) · 하위 10%(비관적 시장 충격) 시나리오별 실질 자산 잔여액 추이
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
              <span className="w-3 h-0.5 bg-emerald-400" /> 상위 10% (호황)
            </span>
            <span className="flex items-center gap-1.5 text-teal-400 font-bold">
              <span className="w-3 h-1 bg-teal-400" /> 중위값 50%
            </span>
            <span className="flex items-center gap-1.5 text-rose-400 font-medium">
              <span className="w-3 h-0.5 bg-rose-400" /> 하위 10% (약세장)
            </span>
          </div>
        </div>

        <div className="w-full h-72 sm:h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={simulation.trajectory} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="mcOptimistic" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="mcPessimistic" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
              <XAxis dataKey="age" tickFormatter={(v) => `${v}세`} stroke="#6b7280" fontSize={11} />
              <YAxis
                stroke="#6b7280"
                fontSize={11}
                tickFormatter={(v) => `${(v / 10000).toFixed(0)}억`}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '12px' }}
                formatter={(val: any, name: any) => [
                  `${Number(val).toLocaleString()} 만 원 (${(Number(val) / 10000).toFixed(1)}억)`,
                  name === 'p90' ? '상위 10% (낙관)' : name === 'p50' ? '중위 50% (표준)' : '하위 10% (비관)'
                ]}
                labelFormatter={(label) => `만 ${label}세 시점`}
              />
              <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="2 2" />
              <Area type="monotone" dataKey="p90" stroke="#10b981" strokeWidth={1.5} fill="url(#mcOptimistic)" />
              <Area type="monotone" dataKey="p50" stroke="#14b8a6" strokeWidth={2.5} fill="#14b8a620" />
              <Area type="monotone" dataKey="p10" stroke="#f43f5e" strokeWidth={1.5} fill="url(#mcPessimistic)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── 3. 인터랙티브 파라미터 제어 패널 ──────────────────────────── */}
      <div className="p-5 rounded-3xl bg-black/40 border border-white/10 backdrop-blur-xl flex flex-col gap-4">
        <h3 className="text-sm font-bold text-gray-200 border-b border-white/10 pb-2 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-teal-400" />
          가계 은퇴 자산 및 시장 변동성 파라미터 조정
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          {/* 금융 순자산 */}
          <div className="p-3 rounded-2xl bg-white/5 border border-white/5 flex flex-col gap-1.5">
            <div className="flex justify-between text-gray-300">
              <span>초기 은퇴 자산</span>
              <span className="font-bold text-teal-400">{initialPortfolioWealth.toLocaleString()}만원 ({(initialPortfolioWealth / 10000).toFixed(1)}억)</span>
            </div>
            <input
              type="range"
              min="20000"
              max="300000"
              step="5000"
              value={initialPortfolioWealth}
              onChange={(e) => setInitialPortfolioWealth(Number(e.target.value))}
              className="accent-teal-500 w-full cursor-pointer h-1.5 bg-white/10 rounded-lg"
            />
          </div>

          {/* 월 희망 생활비 */}
          <div className="p-3 rounded-2xl bg-white/5 border border-white/5 flex flex-col gap-1.5">
            <div className="flex justify-between text-gray-300">
              <span>월 필요 생활비</span>
              <span className="font-bold text-indigo-400">{monthlyExpense}만원/월 (연 {monthlyExpense * 12}만)</span>
            </div>
            <input
              type="range"
              min="150"
              max="700"
              step="10"
              value={monthlyExpense}
              onChange={(e) => setMonthlyExpense(Number(e.target.value))}
              className="accent-indigo-500 w-full cursor-pointer h-1.5 bg-white/10 rounded-lg"
            />
          </div>

          {/* 포트폴리오 기대수익률 */}
          <div className="p-3 rounded-2xl bg-white/5 border border-white/5 flex flex-col gap-1.5">
            <div className="flex justify-between text-gray-300">
              <span>연간 기대수익률</span>
              <span className="font-bold text-emerald-400">{expectedReturnPct}% / 년</span>
            </div>
            <input
              type="range"
              min="3.0"
              max="12.0"
              step="0.5"
              value={expectedReturnPct}
              onChange={(e) => setExpectedReturnPct(Number(e.target.value))}
              className="accent-emerald-500 w-full cursor-pointer h-1.5 bg-white/10 rounded-lg"
            />
          </div>

          {/* 포트폴리오 변동성(표준편차) */}
          <div className="p-3 rounded-2xl bg-white/5 border border-white/5 flex flex-col gap-1.5">
            <div className="flex justify-between text-gray-300">
              <span>연간 변동성 (표준편차)</span>
              <span className="font-bold text-amber-400">{volatilityPct}%</span>
            </div>
            <input
              type="range"
              min="5.0"
              max="25.0"
              step="0.5"
              value={volatilityPct}
              onChange={(e) => setVolatilityPct(Number(e.target.value))}
              className="accent-amber-500 w-full cursor-pointer h-1.5 bg-white/10 rounded-lg"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
