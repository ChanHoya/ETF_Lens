'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { 
  DollarSign, TrendingUp, ShieldCheck, AlertCircle, 
  RefreshCw, Percent, ArrowRight, Sparkles, Scale, Info, Landmark,
  Loader2, CheckCircle2, Zap
} from 'lucide-react';
import { 
  ResponsiveContainer, ComposedChart, Line, Bar, 
  XAxis, YAxis, Tooltip, CartesianGrid, Legend 
} from 'recharts';
import { STANDARD_TOOLTIP_STYLE, STANDARD_LEGEND_WRAPPER_STYLE } from '@/lib/chartTheme';
import { getApiBase } from '@/lib/apiConfig';

interface BrazilMarketRates {
  liveBrlKrw: number | null;
  selicRate: number | null;
  y5Rate: number | null;
  y10RateProxy: number | null;
  signalZone: string | null;
  asOfDate: string | null;
}

export default function BrazilBondCompoundSimulator() {
  // 투자 조건 상태
  const [initialInvestmentManwon, setInitialInvestmentManwon] = useState<number>(10000); // 1억 원 (10,000만 원)
  const [couponRatePct, setCouponRatePct] = useState<number>(10.0); // 연 10.0% 표면금리
  const [reinvestYieldPct, setReinvestYieldPct] = useState<number>(13.5); // 재투자 수익률 % (실시간 10년물 수준)
  const [currentFxRate, setCurrentFxRate] = useState<number>(264.0); // 현재 원/헤알 환율 (원)
  const [targetFxRate, setTargetFxRate] = useState<number>(264.0); // 만기/예상 원/헤알 환율 (원)
  const [taxBracketPct, setTaxBracketPct] = useState<number>(15.4); // 비교군(일반채권) 적용 세율 (기본 15.4%, 종소세 시 38.5%~49.5%)

  // 실시간 파이프라인 상태
  const [marketRates, setMarketRates] = useState<BrazilMarketRates>({
    liveBrlKrw: null,
    selicRate: null,
    y5Rate: null,
    y10RateProxy: null,
    signalZone: null,
    asOfDate: null
  });
  const [isLoadingMarket, setIsLoadingMarket] = useState<boolean>(false);
  const [lastSyncedTime, setLastSyncedTime] = useState<string>('');

  // 1. 실시간 데이터 파이프라인 페치
  const fetchLiveMarketRates = async (showLoading = true) => {
    try {
      if (showLoading) setIsLoadingMarket(true);
      const apiBase = getApiBase();
      const res = await fetch(`${apiBase}/api/v1/brazil-bond/summary`);
      if (res.ok) {
        const data = await res.json();
        const indicators = data?.indicators || [];
        
        let brlKrw = 264.0;
        let selic = 13.75;
        let y5 = 13.05;

        indicators.forEach((ind: any) => {
          if (ind.key === 'brl_krw' && ind.value) brlKrw = Number(ind.value);
          if (ind.key === 'selic_target' && ind.value) selic = Number(ind.value);
          if (ind.key === 'y5' && ind.value) y5 = Number(ind.value);
        });

        // 10년물 NTN-F 프록시: 5년물 대비 약 +85bp 가산 (약 13.8~14.2%)
        const y10Proxy = Number((y5 + 0.85).toFixed(2));
        const zone = data?.signal?.zone_label || '관망/분할진입';

        setMarketRates({
          liveBrlKrw: brlKrw,
          selicRate: selic,
          y5Rate: y5,
          y10RateProxy: y10Proxy,
          signalZone: zone,
          asOfDate: new Date().toLocaleDateString('ko-KR')
        });

        // 초기 로딩 시 실시간 시세를 기본값으로 자동 바인딩
        setCurrentFxRate(brlKrw);
        setTargetFxRate(brlKrw);
        setReinvestYieldPct(y10Proxy);
        setLastSyncedTime(new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }));
      }
    } catch (err) {
      console.warn('Failed to fetch live Brazil rates', err);
    } finally {
      if (showLoading) setIsLoadingMarket(false);
    }
  };

  useEffect(() => {
    fetchLiveMarketRates();
  }, []);

  const fxChangePct = useMemo(() => {
    return ((targetFxRate - currentFxRate) / currentFxRate) * 100;
  }, [currentFxRate, targetFxRate]);

  // 10개년 복리 시뮬레이션 계산
  const simulationData = useMemo(() => {
    const data = [];
    const initialWon = initialInvestmentManwon * 10000;
    
    // 환율 보정 계수
    const fxMultiplier = currentFxRate > 0 ? targetFxRate / currentFxRate : 1.0;

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
      const simpleFinalWon = (initialWon * fxMultiplier) + (simpleTotalCash - initialWon);
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
      {/* 상단 안내 & 실시간 데이터 파이프라인 배너 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-emerald-950/40 via-sky-950/30 to-[#121422] border border-emerald-500/30 rounded-2xl p-4 sm:p-5 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0">
            <Landmark className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-black text-white">
                🇧🇷 브라질 국채(10% 쿠폰) 비과세 이자 재투자 복리 시뮬레이터
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                조세조약 100% 비과세
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-1">
                <Zap className="w-3 h-3 text-amber-400" />
                실시간 파이프라인 바인딩
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              한-브라질 조세조약 <strong>이자소득세 0% & 종합과세 제외</strong> 혜택과 실시간 원/헤알(BRL/KRW) 환율·10년물 금리를 연동한 정밀 복리 계산기입니다.
            </p>
          </div>
        </div>

        {/* 실시간 시장 지표 카드 & 새로고침 */}
        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0 flex-wrap">
          <div className="flex flex-col text-right">
            <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-mono font-bold bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/20">
              <span>BRL/KRW: {marketRates.liveBrlKrw ? `${marketRates.liveBrlKrw.toFixed(1)}원` : `${currentFxRate}원`}</span>
              <span className="text-gray-500">|</span>
              <span className="text-sky-300">10년물: {marketRates.y10RateProxy ? `${marketRates.y10RateProxy}%` : '13.9%'}</span>
            </div>
            {lastSyncedTime && (
              <span className="text-[10px] text-gray-500 mt-0.5 pr-1">동기화: {lastSyncedTime} KST</span>
            )}
          </div>

          <button
            onClick={() => fetchLiveMarketRates(true)}
            disabled={isLoadingMarket}
            title="실시간 브라질 시장 시세 갱신"
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white transition-all cursor-pointer active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isLoadingMarket ? 'animate-spin text-emerald-400' : ''}`} />
          </button>
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
              비과세 덕분에 불어난 순수 초과 수익
            </div>
          </div>
          <div className="text-[10px] text-gray-500">
            적용 비교 세율: {taxBracketPct}% (이자소득세 및 종소세 절감)
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
          <div className="flex items-center gap-1.5 self-end sm:self-auto flex-wrap">
            {marketRates.liveBrlKrw && (
              <button
                onClick={() => {
                  setCurrentFxRate(marketRates.liveBrlKrw!);
                  setTargetFxRate(marketRates.liveBrlKrw!);
                }}
                className="px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-[10px] font-bold transition flex items-center gap-1"
              >
                <Zap className="w-3 h-3 text-amber-400" />
                실시간 환율({marketRates.liveBrlKrw.toFixed(1)}원) 적용
              </button>
            )}
            {marketRates.y10RateProxy && (
              <button
                onClick={() => setReinvestYieldPct(marketRates.y10RateProxy!)}
                className="px-2.5 py-1 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/30 text-indigo-300 text-[10px] font-bold transition"
              >
                10년물 YTM({marketRates.y10RateProxy}%) 반영
              </button>
            )}
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
              <span className="text-gray-400">재투자 기대수익률 (YTM)</span>
              <span className="text-emerald-400 font-mono font-bold">{reinvestYieldPct.toFixed(1)}%</span>
            </div>
            <input
              type="range"
              min={5.0}
              max={16.0}
              step={0.5}
              value={reinvestYieldPct}
              onChange={(e) => setReinvestYieldPct(Number(e.target.value))}
              className="w-full accent-emerald-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-gray-500 font-mono mt-0.5">
              <span>5.0%</span>
              <span>16.0% (고금리)</span>
            </div>
          </div>

          <div>
            <div className="flex justify-between text-[11px] mb-1">
              <span className="text-gray-400">만기 목표 환율</span>
              <span className="text-sky-400 font-mono font-bold">{targetFxRate}원/BRL</span>
            </div>
            <input
              type="range"
              min={150}
              max={350}
              step={5}
              value={targetFxRate}
              onChange={(e) => setTargetFxRate(Number(e.target.value))}
              className="w-full accent-sky-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-gray-500 font-mono mt-0.5">
              <span>150원 (급락)</span>
              <span>350원 (초강세)</span>
            </div>
          </div>

          <div>
            <div className="flex justify-between text-[11px] mb-1">
              <span className="text-gray-400">비교군 과세율</span>
              <span className="text-indigo-400 font-mono font-bold">{taxBracketPct}%</span>
            </div>
            <select
              value={taxBracketPct}
              onChange={(e) => setTaxBracketPct(Number(e.target.value))}
              className="w-full bg-[#181a29] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
            >
              <option value={15.4}>기본 배당/이자소득세 (15.4%)</option>
              <option value={26.4}>종합과세 1구간 (26.4%)</option>
              <option value={38.5}>종합과세 2구간 (38.5%)</option>
              <option value={49.5}>최고세율 구간 (49.5%)</option>
            </select>
            <div className="text-[10px] text-gray-500 mt-1">
              금융소득 2,000만 초과 시 절세효과 급증
            </div>
          </div>
        </div>
      </div>

      {/* 10개년 복리 추이 시각화 차트 */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[#141624] border border-white/10 shadow-md">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <h4 className="text-xs sm:text-sm font-bold text-white">
              10개년 비과세 복리 재투자 vs 단리 수령 vs 일반과세 채권 누적 자산 비교
            </h4>
          </div>
          <span className="text-[11px] text-gray-400">단위: 만 원</span>
        </div>

        <div className="w-full h-72">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={simulationData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#232738" vertical={false} />
              <XAxis dataKey="year" stroke="#717a8c" fontSize={11} tickLine={false} />
              <YAxis 
                stroke="#717a8c" 
                fontSize={11} 
                tickLine={false} 
                tickFormatter={(v) => `${(v / 10000).toFixed(1)}억`}
              />
              <Tooltip 
                contentStyle={STANDARD_TOOLTIP_STYLE}
                formatter={(val: any) => [`${formatWon(Number(val))}`, '']}
              />
              <Legend wrapperStyle={STANDARD_LEGEND_WRAPPER_STYLE} />
              
              <Bar 
                dataKey="taxSavedWon" 
                name="비과세 절세 이득" 
                fill="#818cf8" 
                opacity={0.3} 
                radius={[4, 4, 0, 0]}
              />
              <Line 
                type="monotone" 
                dataKey="compoundWon" 
                name="브라질 국채 (비과세 100% 복리 재투자)" 
                stroke="#10b981" 
                strokeWidth={3}
                dot={{ r: 3, fill: '#10b981' }}
              />
              <Line 
                type="monotone" 
                dataKey="taxableWon" 
                name={`일반채권 (${taxBracketPct}% 과세 후 재투자)`} 
                stroke="#f43f5e" 
                strokeWidth={2}
                strokeDasharray="4 4"
                dot={{ r: 2 }}
              />
              <Line 
                type="monotone" 
                dataKey="simpleWon" 
                name="단리 단순 현금 수령 (미재투자)" 
                stroke="#94a3b8" 
                strokeWidth={1.5}
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 10개년 연차별 세부 수치 테이블 */}
      <div className="rounded-2xl bg-[#141624] border border-white/10 overflow-hidden shadow-md">
        <div className="px-5 py-3 border-b border-white/10 flex justify-between items-center bg-white/[0.02]">
          <span className="text-xs font-bold text-gray-300">연차별 누적 자산 및 절세 효과 상세표</span>
          <span className="text-[11px] text-gray-500">원/헤알 만기 {targetFxRate}원 기준</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.03] text-gray-400 font-semibold whitespace-nowrap">
                <th className="py-2.5 px-4">연차</th>
                <th className="py-2.5 px-4 text-right">비과세 복리 자산</th>
                <th className="py-2.5 px-4 text-right">단리 수령 자산</th>
                <th className="py-2.5 px-4 text-right">과세 채권 자산</th>
                <th className="py-2.5 px-4 text-right">비과세 초과 절세액</th>
                <th className="py-2.5 px-4 text-right">수익률 (원금 대비)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-mono text-[11px]">
              {simulationData.map((row) => (
                <tr key={row.year} className="hover:bg-white/[0.02]">
                  <td className="py-2 px-4 font-sans text-gray-300 font-semibold">{row.year}</td>
                  <td className="py-2 px-4 text-right font-bold text-emerald-400">{formatWon(row.compoundWon)}</td>
                  <td className="py-2 px-4 text-right text-gray-400">{formatWon(row.simpleWon)}</td>
                  <td className="py-2 px-4 text-right text-rose-300">{formatWon(row.taxableWon)}</td>
                  <td className="py-2 px-4 text-right font-bold text-indigo-300">+{formatWon(row.taxSavedWon)}</td>
                  <td className="py-2 px-4 text-right font-bold text-emerald-300">
                    +{((row.compoundWon - initialInvestmentManwon) / initialInvestmentManwon * 100).toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
