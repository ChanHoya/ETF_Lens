'use client';

import React, { useState, useMemo } from 'react';
import { 
  DollarSign, TrendingUp, ShieldCheck, AlertCircle, 
  RefreshCw, Percent, ArrowRight, Sparkles, Scale, Info, Landmark
} from 'lucide-react';
import { 
  ResponsiveContainer, ComposedChart, Line, Bar, 
  XAxis, YAxis, Tooltip, CartesianGrid, Legend 
} from 'recharts';
import { STANDARD_TOOLTIP_STYLE, STANDARD_LEGEND_WRAPPER_STYLE } from '@/lib/chartTheme';

export default function BrazilBondCompoundSimulator() {
  // 투자 조건 상태
  const [initialInvestmentManwon, setInitialInvestmentManwon] = useState<number>(10000); // 1억 원 (10,000만 원)
  const [couponRatePct, setCouponRatePct] = useState<number>(10.0); // 연 10.0% 표면금리
  const [reinvestYieldPct, setReinvestYieldPct] = useState<number>(10.0); // 재투자 수익률 %
  const [currentFxRate, setCurrentFxRate] = useState<number>(245.0); // 현재 원/헤알 환율 (245원)
  const [targetFxRate, setTargetFxRate] = useState<number>(245.0); // 만기/예상 원/헤알 환율 (원)
  const [taxBracketPct, setTaxBracketPct] = useState<number>(15.4); // 비교군(일반채권) 적용 세율 (기본 15.4%, 종소세 시 38.5%~49.5%)

  const fxChangePct = useMemo(() => {
    return ((targetFxRate - currentFxRate) / currentFxRate) * 100;
  }, [currentFxRate, targetFxRate]);

  // 10개년 복리 시뮬레이션 계산
  const simulationData = useMemo(() => {
    const data = [];
    const initialWon = initialInvestmentManwon * 10000;
    
    // 환율 보정 계수
    const fxMultiplier = targetFxRate / currentFxRate;

    let compoundBalance = initialWon;
    let simpleTotalCash = initialWon;
    let taxableCompoundBalance = initialWon;

    // 반기별 복리 연산 (1년 2회 지급: 1월/7월)
    const annualCouponRate = couponRatePct / 100.0;
    const semiAnnualCouponRate = annualCouponRate / 2.0;

    const annualReinvestRate = reinvestYieldPct / 100.0;
    const semiAnnualReinvestRate = annualReinvestRate / 2.0;

    const taxRate = taxBracketPct / 100.0;

    for (let year = 1; year <= 10; year++) {
      // 1년치 반기 2회 복리 진행
      for (let s = 0; s < 2; s++) {
        // 1. 브라질 국채 (비과세 재투자)
        const semiInterest = compoundBalance * semiAnnualCouponRate;
        compoundBalance += semiInterest * (1 + semiAnnualReinvestRate * 0.5);

        // 2. 브라질 국채 (단리 단순 현금 수령)
        const simpleInterest = initialWon * semiAnnualCouponRate;
        simpleTotalCash += simpleInterest;

        // 3. 일반 과세 채권 (이자소득세 원천징수 후 재투자)
        const taxableInterest = taxableCompoundBalance * semiAnnualCouponRate * (1 - taxRate);
        taxableCompoundBalance += taxableInterest * (1 + semiAnnualReinvestRate * (1 - taxRate) * 0.5);
      }

      // 만기 환율 변동을 원금 및 재투자 자산에 반영 (헤알화 노출 자산)
      const compoundFinalWon = compoundBalance * fxMultiplier;
      const simpleFinalWon = (initialWon * fxMultiplier) + (simpleTotalCash - initialWon); // 이자는 수령 시점 환전 가정
      const taxableFinalWon = taxableCompoundBalance * fxMultiplier;

      const taxSavedWon = (compoundBalance - taxableCompoundBalance) * fxMultiplier;

      data.push({
        year: `${year}년차`,
        yearNum: year,
        compoundWon: Math.round(compoundFinalWon / 10000), // 만원 단위
        simpleWon: Math.round(simpleFinalWon / 10000),
        taxableWon: Math.round(taxableFinalWon / 10000),
        taxSavedWon: Math.round(taxSavedWon / 10000),
        rawCompoundWon: compoundFinalWon
      });
    }

    return data;
  }, [initialInvestmentManwon, couponRatePct, reinvestYieldPct, currentFxRate, targetFxRate, taxBracketPct]);

  const last10Y = simulationData[simulationData.length - 1];
  const last5Y = simulationData[4];

  const formatWon = (n: number) => {
    if (n >= 10000) {
      const eok = Math.floor(n / 10000);
      const man = Math.round(n % 10000);
      return man > 0 ? `${eok}억 ${man.toLocaleString()}만 원` : `${eok}억 원`;
    }
    return `${Math.round(n).toLocaleString()}만 원`;
  };

  // 프리셋 시나리오 핸들러
  const applyPreset = (preset: 'drop20' | 'neutral' | 'rally15') => {
    if (preset === 'drop20') {
      setTargetFxRate(Math.round(currentFxRate * 0.8));
    } else if (preset === 'neutral') {
      setTargetFxRate(currentFxRate);
    } else if (preset === 'rally15') {
      setTargetFxRate(Math.round(currentFxRate * 1.15));
    }
  };

  return (
    <div className="w-full flex flex-col gap-5 text-gray-200 animate-in fade-in duration-300">
      {/* 상단 안내 배너 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-emerald-950/40 via-sky-950/30 to-[#121422] border border-emerald-500/30 rounded-2xl p-4 sm:p-5 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            <Landmark className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-black text-white">
                🇧🇷 브라질 국채(10% 쿠폰) 2026 하반기 헤알화 & 비과세 이자 재투자 복리 시뮬레이터
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                조세조약 100% 비과세
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              한-브라질 조세조약에 따른 <strong>이자소득세 0% & 금융소득종합과세 완전 제외</strong> 혜택과 반기 10% 이자 재투자 복리 효과를 정밀 시뮬레이션합니다.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="text-xs text-emerald-400 font-mono font-bold bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/20">
            실시간 헤알 환율: {currentFxRate}원/BRL
          </span>
        </div>
      </div>

      {/* 3대 핵심 시뮬레이션 결과 요약 카드 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="p-4 rounded-2xl bg-[#161826] border border-emerald-500/30 flex flex-col justify-between shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">10년 후 비과세 복리 누적 자산</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
              100% 재투자 시
            </span>
          </div>
          <div className="my-2">
            <div className="text-2xl font-black text-emerald-400 font-mono">
              {formatWon(last10Y?.compoundWon || 0)}
            </div>
            <div className="text-[11px] text-gray-300 mt-0.5">
              원금({formatWon(initialInvestmentManwon)}) 대비 <span className="font-bold text-emerald-300">+{((last10Y?.compoundWon - initialInvestmentManwon) / initialInvestmentManwon * 100).toFixed(1)}%</span>
            </div>
          </div>
          <div className="text-[10px] text-gray-500">
            5년차 예상 자산: {formatWon(last5Y?.compoundWon || 0)}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#161826] border border-indigo-500/30 flex flex-col justify-between shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">10년 누적 비과세 절세 혜택</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
              일반 채권 대비
            </span>
          </div>
          <div className="my-2">
            <div className="text-2xl font-black text-indigo-300 font-mono">
              +{formatWon(last10Y?.taxSavedWon || 0)}
            </div>
            <div className="text-[11px] text-gray-300 mt-0.5">
              과세율 {taxBracketPct}% 기준 세금 아낀 금액
            </div>
          </div>
          <div className="text-[10px] text-gray-500">
            금융소득종합과세(최대 49.5%) 누진세율 배제 효과
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#161826] border border-amber-500/30 flex flex-col justify-between shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">헤알화 환율 변동 영향</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20">
              환리스크 진단
            </span>
          </div>
          <div className="my-2">
            <div className={`text-2xl font-black font-mono ${fxChangePct >= 0 ? 'text-rose-400' : 'text-blue-400'}`}>
              {fxChangePct > 0 ? '+' : ''}{fxChangePct.toFixed(1)}%
            </div>
            <div className="text-[11px] text-gray-300 mt-0.5">
              목표 환율: {targetFxRate}원/BRL (기준 {currentFxRate}원)
            </div>
          </div>
          <div className="text-[10px] text-gray-500">
            {fxChangePct < -15 ? '환율 급락 시에도 10% 비과세 이자가 원금 낙폭을 상쇄합니다.' : '안정적 환율 유지 시 고쿠폰 복리 효과 극대화'}
          </div>
        </div>
      </div>

      {/* 투자 조건 컨트롤 바 */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[#141624] border border-white/10 flex flex-col gap-4 shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-white/5">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-bold text-white">시뮬레이션 조건 및 환율 시나리오 설정</span>
          </div>
          {/* 환율 퀵 프리셋 버튼 */}
          <div className="flex items-center gap-1.5 self-end sm:self-auto">
            <span className="text-[10px] text-gray-400 mr-1">환율 시나리오:</span>
            <button
              onClick={() => applyPreset('drop20')}
              className="px-2.5 py-1 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-300 text-[10px] font-bold transition"
            >
              헤알화 급락 (-20%)
            </button>
            <button
              onClick={() => applyPreset('neutral')}
              className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 text-[10px] font-bold transition"
            >
              현상 유지 (0%)
            </button>
            <button
              onClick={() => applyPreset('rally15')}
              className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 text-[10px] font-bold transition"
            >
              헤알화 강세 (+15%)
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div>
            <div className="flex justify-between text-[11px] mb-1">
              <span className="text-gray-400">투자 원금</span>
              <span className="text-white font-mono font-bold">{formatWon(initialInvestmentManwon)}</span>
            </div>
            <input
              type="range"
              min={1000}
              max={50000}
              step={1000}
              value={initialInvestmentManwon}
              onChange={(e) => setInitialInvestmentManwon(Number(e.target.value))}
              className="w-full accent-emerald-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-gray-500 font-mono mt-0.5">
              <span>1천만</span>
              <span>5억</span>
            </div>
          </div>

          <div>
            <div className="flex justify-between text-[11px] mb-1">
              <span className="text-gray-400">국채 표면금리(쿠폰)</span>
              <span className="text-emerald-400 font-mono font-bold">연 {couponRatePct.toFixed(1)}%</span>
            </div>
            <input
              type="range"
              min={8.0}
              max={13.0}
              step={0.5}
              value={couponRatePct}
              onChange={(e) => setCouponRatePct(Number(e.target.value))}
              className="w-full accent-emerald-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-gray-500 font-mono mt-0.5">
              <span>8.0%</span>
              <span>13.0%</span>
            </div>
          </div>

          <div>
            <div className="flex justify-between text-[11px] mb-1">
              <span className="text-gray-400">예상 헤알화 환율</span>
              <span className="text-amber-300 font-mono font-bold">{targetFxRate}원/BRL</span>
            </div>
            <input
              type="range"
              min={170}
              max={320}
              step={5}
              value={targetFxRate}
              onChange={(e) => setTargetFxRate(Number(e.target.value))}
              className="w-full accent-amber-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-gray-500 font-mono mt-0.5">
              <span>170원</span>
              <span>320원</span>
            </div>
          </div>

          <div>
            <div className="flex justify-between text-[11px] mb-1">
              <span className="text-gray-400">비교군 과세율</span>
              <span className="text-indigo-300 font-mono font-bold">{taxBracketPct}%</span>
            </div>
            <select
              value={taxBracketPct}
              onChange={(e) => setTaxBracketPct(Number(e.target.value))}
              className="w-full px-2.5 py-1.5 rounded-lg bg-[#1a1d2e] border border-white/10 text-xs text-white focus:outline-none focus:border-indigo-500"
            >
              <option value={15.4}>일반 배당/이자소득세 (15.4%)</option>
              <option value={26.4}>금융소득종합과세 1구간 (26.4%)</option>
              <option value={38.5}>금융소득종합과세 2구간 (38.5%)</option>
              <option value={49.5}>금융소득종합과세 최고구간 (49.5%)</option>
            </select>
            <div className="text-[10px] text-gray-500 mt-1">
              브라질 국채는 위 세율 전액 면제 (0%)
            </div>
          </div>
        </div>
      </div>

      {/* 10개년 복리 자산 증식 차트 (Recharts) */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[#121422] border border-white/10 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              10개년 비과세 복리 재투자 vs 단리 수령 vs 일반과세 채권 누적 자산 곡선
            </h4>
            <p className="text-[11px] text-gray-400 mt-0.5">
              반기별 비과세 쿠폰 이자를 100% 재투자했을 때 시간의 복리 승수 효과를 확인하세요. (단위: 만 원)
            </p>
          </div>
        </div>

        <div className="h-[320px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={simulationData} margin={{ top: 10, right: 15, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#252736" vertical={false} />
              <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 11 }} stroke="#374151" />
              <YAxis 
                tick={{ fill: '#9ca3af', fontSize: 11 }} 
                stroke="#374151"
                tickFormatter={(v) => `${Math.round(v / 10000)}억`}
              />
              <Tooltip 
                contentStyle={STANDARD_TOOLTIP_STYLE}
                formatter={(val: any, name: any) => [`${formatWon(val)}`, name]}
              />
              <Legend wrapperStyle={STANDARD_LEGEND_WRAPPER_STYLE} />
              <Line 
                type="monotone" 
                dataKey="compoundWon" 
                name="🇧🇷 브라질 국채 (비과세 100% 복리 재투자)" 
                stroke="#10b981" 
                strokeWidth={3} 
                dot={{ r: 4 }} 
              />
              <Line 
                type="monotone" 
                dataKey="taxableWon" 
                name={`일반 과세 채권 (세율 ${taxBracketPct}% 차감 후 재투자)`} 
                stroke="#6366f1" 
                strokeWidth={2} 
                strokeDasharray="4 4" 
                dot={false} 
              />
              <Line 
                type="monotone" 
                dataKey="simpleWon" 
                name="브라질 국채 (단리 단순 현금 수령)" 
                stroke="#94a3b8" 
                strokeWidth={1.5} 
                dot={false} 
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* 10개년 수치 요약 표 */}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-white/10 text-gray-400 font-semibold bg-black/20">
                <th className="py-2.5 px-3 text-left">투자 기간</th>
                <th className="py-2.5 px-3 text-right text-emerald-300 font-bold">비과세 복리 자산</th>
                <th className="py-2.5 px-3 text-right text-indigo-300">일반과세 복리 자산</th>
                <th className="py-2.5 px-3 text-right text-gray-400">단리 현금수령 자산</th>
                <th className="py-2.5 px-3 text-right text-amber-300 font-bold">비과세 세금 절감액</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-mono">
              {simulationData.filter((_, idx) => [0, 2, 4, 6, 9].includes(idx)).map((row) => (
                <tr key={row.year} className="hover:bg-white/[0.03]">
                  <td className="py-2.5 px-3 text-white font-sans font-bold">{row.year}</td>
                  <td className="py-2.5 px-3 text-right font-black text-emerald-400">{formatWon(row.compoundWon)}</td>
                  <td className="py-2.5 px-3 text-right text-gray-300">{formatWon(row.taxableWon)}</td>
                  <td className="py-2.5 px-3 text-right text-gray-400">{formatWon(row.simpleWon)}</td>
                  <td className="py-2.5 px-3 text-right font-bold text-amber-300">+{formatWon(row.taxSavedWon)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 투자 유의사항 및 리스크 가이드 */}
      <div className="p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/20 text-xs text-indigo-200/90 leading-relaxed flex items-start gap-3">
        <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold text-white">브라질 국채 2026 하반기 투자 전략 가이드:</span>
          <p className="mt-1 text-gray-300 text-[11px]">
            브라질 국채는 금융소득종합과세(2,000만원 이상 시 누진세율 적용) 대상에서 제외되는 가장 강력한 비과세 고쿠폰(10%) 자산입니다. 
            다만 원화/헤알화 환율 변동성이 존재하므로, 환율이 230~250원대 안정 구간일 때 반기 이자를 꾸준히 분할 재투자하여 평균 단가를 낮추는 복리 적립 전략이 가장 안전합니다.
          </p>
        </div>
      </div>
    </div>
  );
}
