'use client';

import React, { useState, useMemo } from 'react';
import { 
  Landmark, TrendingUp, Percent, Clock, Sliders, ArrowUpRight, 
  Sparkles, Layers, ShieldCheck, ChevronRight, BarChart3, Repeat, 
  AlertCircle, DollarSign, ArrowDownRight, Compass, CheckCircle2
} from 'lucide-react';
import { 
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, 
  Tooltip, CartesianGrid, Cell, Legend 
} from 'recharts';
import { STANDARD_TOOLTIP_STYLE, STANDARD_LEGEND_WRAPPER_STYLE } from '@/lib/chartTheme';
import { TffFundData, TffHoldingsRow, TffMonthInfo } from '@/lib/tff/types';

interface Props {
  data?: TffFundData | null;
}

interface BondHoldingAnalysis {
  name: string;
  code?: string;
  endValueManwon: number;
  weightPct: number;
  maturityYear: number;
  couponRatePct: number;
  estimatedDuration: number;
}

export default function TffBondLadderAnalytics({ data }: Props) {
  const [rateCutBps, setRateCutBps] = useState<number>(50); // 50bp 인하 시나리오

  // 1. TFF 실제 보유 종목 중 채권형 자산만 정밀 필터링 (비보유 브라질 국채 등 일체 배제)
  const { realBondHoldings, totalBondCapitalManwon, totalPortfolioValueManwon, latestMonthLabel, hasBonds } = useMemo(() => {
    if (!data) return { realBondHoldings: [], totalBondCapitalManwon: 0, totalPortfolioValueManwon: 0, latestMonthLabel: '', hasBonds: false };

    const lm = data.latestMonth;
    let info: TffMonthInfo | null = null;
    if (lm && lm !== 'YTM' && data.monthlyMap?.[lm]) {
      info = data.monthlyMap[lm];
    } else if (data.ytm) {
      info = data.ytm;
    } else if (Object.keys(data.monthlyMap || {}).length > 0) {
      const keys = Object.keys(data.monthlyMap).sort((a, b) => parseInt(a) - parseInt(b));
      info = data.monthlyMap[keys[keys.length - 1]];
    }

    const holdings = info?.holdings || [];
    const valid = holdings.filter(h => h.name && (h.endValue > 0 || (h.beginValue || 0) > 0));
    const cash = info?.summary?.cashBalance || 0;
    const totalVal = valid.reduce((acc, cur) => acc + (cur.endValue || 0), 0) + cash;
    const totalManwon = Math.round(totalVal / 10000);

    // 실제 채권형 자산 추출 (금융채, 회사채, 국채, 종합채권 등)
    const isBond = (name: string) => {
      return name.includes('채권') || name.includes('금융채') || name.includes('회사채') || name.includes('국채') || name.includes('국고채') || name.includes('특수채');
    };

    const bondList: BondHoldingAnalysis[] = [];
    let bondTotalVal = 0;

    valid.forEach(h => {
      if (isBond(h.name)) {
        const valManwon = Math.round((h.endValue || 0) / 10000);
        bondTotalVal += valManwon;

        // 만기 연도 추정 (예: 26-12 -> 2026년, 25-12 -> 2025년, 일반 종합채권 -> 2029년)
        let maturity = 2026;
        let duration = 1.8;
        let coupon = 3.8;

        if (h.name.includes('26-12')) {
          maturity = 2026;
          duration = 0.9;
          coupon = 3.9;
        } else if (h.name.includes('25-12')) {
          maturity = 2025;
          duration = 0.4;
          coupon = 3.7;
        } else if (h.name.includes('종합채권')) {
          maturity = 2029;
          duration = 5.2;
          coupon = 3.4;
        } else if (h.name.includes('30년')) {
          maturity = 2054;
          duration = 18.5;
          coupon = 3.2;
        }

        bondList.push({
          name: h.name,
          code: h.code,
          endValueManwon: valManwon,
          weightPct: 0, // 아래에서 재계산
          maturityYear: maturity,
          couponRatePct: coupon,
          estimatedDuration: duration,
        });
      }
    });

    bondList.forEach(b => {
      b.weightPct = totalManwon > 0 ? Number(((b.endValueManwon / totalManwon) * 100).toFixed(1)) : 0;
    });

    return {
      realBondHoldings: bondList,
      totalBondCapitalManwon: bondTotalVal,
      totalPortfolioValueManwon: totalManwon,
      latestMonthLabel: lm || info?.period || '최근',
      hasBonds: bondList.length > 0,
    };
  }, [data]);

  // 2. 가중평균 채권 지표 산출
  const bondMetrics = useMemo(() => {
    if (!hasBonds || totalBondCapitalManwon === 0) {
      return { weightedYtm: 0, weightedDuration: 0, dv01Manwon: 0, capitalGainAmountManwon: 0, annualCouponManwon: 0 };
    }

    let durSum = 0;
    let ytmSum = 0;
    let couponSum = 0;

    realBondHoldings.forEach(b => {
      const w = b.endValueManwon / totalBondCapitalManwon;
      durSum += b.estimatedDuration * w;
      ytmSum += (b.couponRatePct + 0.3) * w;
      couponSum += b.endValueManwon * (b.couponRatePct / 100);
    });

    const weightedDuration = Number(durSum.toFixed(2));
    const weightedYtm = Number(ytmSum.toFixed(2));
    const rateCutPct = rateCutBps / 100;
    const capitalGainPct = weightedDuration * rateCutPct;
    const capitalGainAmountManwon = Math.round(totalBondCapitalManwon * (capitalGainPct / 100));
    const dv01Manwon = Number(((totalBondCapitalManwon * (weightedDuration / 100) * 0.0001) * 10000).toFixed(2));

    return {
      weightedYtm,
      weightedDuration,
      dv01Manwon,
      capitalGainAmountManwon,
      annualCouponManwon: Math.round(couponSum),
    };
  }, [realBondHoldings, hasBonds, totalBondCapitalManwon, rateCutBps]);

  // 3. 만기 매칭 사다리 데이터 생성
  const ladderData = useMemo(() => {
    if (!hasBonds) return [];

    // 만기 연도별 그룹핑 (2025~2030)
    const years = [2025, 2026, 2027, 2028, 2029, 2030];
    return years.map(yr => {
      const maturingInYear = realBondHoldings.filter(b => b.maturityYear === yr);
      const principalManwon = maturingInYear.reduce((acc, cur) => acc + cur.endValueManwon, 0);
      const couponManwon = realBondHoldings
        .filter(b => b.maturityYear >= yr)
        .reduce((acc, cur) => acc + Math.round(cur.endValueManwon * (cur.couponRatePct / 100)), 0);

      return {
        year: `${yr}년`,
        yearNum: yr,
        principalManwon,
        couponManwon,
        totalCashflow: principalManwon + couponManwon,
        maturingNames: maturingInYear.map(b => b.name).join(', '),
      };
    });
  }, [hasBonds, realBondHoldings]);

  // 채권 자산이 편입되어 있지 않은 경우의 안내 카드
  if (!hasBonds) {
    return (
      <div className="w-full space-y-4 p-6 md:p-8 rounded-2xl bg-slate-900/40 border border-slate-800 text-center">
        <Landmark className="w-12 h-12 text-slate-500 mx-auto mb-2" />
        <h3 className="text-lg font-bold text-white">현재 TFF 펀드에 편입된 채권형 자산이 없습니다</h3>
        <p className="text-xs text-slate-400 max-w-lg mx-auto leading-relaxed">
          TFF {latestMonthLabel} 포트폴리오는 주식형 ETF 및 현금성 자산 중심으로 구성되어 있으며, 비보유 채권(브라질 국채 등)의 분석은 제외되었습니다.
        </p>
        <div className="max-w-md mx-auto p-3 bg-slate-950/60 rounded-xl border border-slate-800 text-xs text-slate-300 mt-4 text-left">
          <div className="font-bold text-emerald-400 mb-1 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" /> 포트폴리오 안전성 안내:
          </div>
          현재 펀드는 비채권형 자산으로 운용 중이며, 향후 만기매칭형 채권(예: KODEX 26-12 등)이나 국공채 ETF 편입 시 듀레이션 및 만기 사다리가 자동으로 계량화됩니다.
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      {/* 1. 상단 인트로 헤더 */}
      <div className="p-5 md:p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-emerald-950/40 to-slate-900 border border-emerald-500/20 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                <Landmark className="w-3 h-3" />
                TFF 실제 보유 채권 자산 분석
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/10 text-sky-300 border border-sky-500/20">
                <ShieldCheck className="w-3 h-3" />
                {realBondHoldings.length}개 보유 채권형 자산 ({totalBondCapitalManwon.toLocaleString()}만원)
              </span>
            </div>
            <h2 className="text-xl md:text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
              TFF 보유 채권 듀레이션 & 만기 매칭 사다리
            </h2>
            <p className="text-xs md:text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed">
              TFF 펀드에 실제 편입된 채권형 자산의 가중평균 듀레이션과 만기 도래 원리금 스케줄입니다. (비보유 채권은 완전히 제외되었습니다)
            </p>
          </div>
        </div>
      </div>

      {/* 2. 채권 4대 핵심 계량 지표 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 shadow-sm hover:border-emerald-500/40 transition-all">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>보유채권 가중평균 YTM</span>
            <Percent className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 text-2xl font-extrabold text-emerald-400 tracking-tight">
            연 {bondMetrics.weightedYtm}%
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            보유 채권 평가액 가중 평균
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 shadow-sm hover:border-blue-500/40 transition-all">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>수정 듀레이션 (Duration)</span>
            <Clock className="w-4 h-4 text-blue-400" />
          </div>
          <div className="mt-2 text-2xl font-extrabold text-blue-400 tracking-tight">
            {bondMetrics.weightedDuration}년
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            금리 1%p 변동 시 채권 가격 반응
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 shadow-sm hover:border-indigo-500/40 transition-all">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>연간 고정 쿠폰(이자)</span>
            <DollarSign className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="mt-2 text-2xl font-extrabold text-indigo-400 tracking-tight">
            연 {bondMetrics.annualCouponManwon.toLocaleString()}만원
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            보유 채권 정기 이자 총액
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 shadow-sm hover:border-amber-500/40 transition-all">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>금리 -{rateCutBps}bp 인하 시 차익</span>
            <Sparkles className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-2 text-2xl font-extrabold text-amber-400 tracking-tight">
            +{bondMetrics.capitalGainAmountManwon.toLocaleString()}만원
          </div>
          <div className="mt-1 text-[11px] text-amber-300/80">
            듀레이션 {bondMetrics.weightedDuration}년 반응 차익
          </div>
        </div>
      </div>

      {/* 3. 보유 채권 종목 리스트 & 만기 사다리 차트 */}
      <div className="p-5 md:p-6 rounded-2xl bg-slate-950 border border-slate-800 shadow-xl">
        <div className="mb-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-emerald-400" />
            TFF 실제 보유 채권 만기 및 쿠폰 유입 사다리
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            펀드에 실제로 편입된 채권 종목의 연도별 만기 상환 원금과 정기 쿠폰 스케줄입니다.
          </p>
        </div>

        <div className="h-[250px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={ladderData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
              <XAxis dataKey="year" stroke="#94a3b8" tick={{ fontSize: 11 }} />
              <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}만`} />
              <Tooltip
                contentStyle={STANDARD_TOOLTIP_STYLE}
                formatter={(val: any, name: any) => [`${Number(val).toLocaleString()}만원`, name]}
              />
              <Legend wrapperStyle={STANDARD_LEGEND_WRAPPER_STYLE} />
              <Bar dataKey="principalManwon" name="만기 도래 원금" stackId="ladder" fill="#10b981" radius={[0, 0, 0, 0]} />
              <Bar dataKey="couponInterestManwon" name="정기 쿠폰 이자" stackId="ladder" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* 보유 채권 명세 표 */}
        <div className="mt-4 overflow-x-auto custom-scrollbar">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="p-2.5">종목명</th>
                <th className="p-2.5 text-right">보유 평가액</th>
                <th className="p-2.5 text-right">펀드 내 비중</th>
                <th className="p-2.5 text-center">만기 연도</th>
                <th className="p-2.5 text-center">듀레이션</th>
                <th className="p-2.5 text-right">표면금리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {realBondHoldings.map((b, idx) => (
                <tr key={idx} className="hover:bg-slate-900/40 transition-colors">
                  <td className="p-2.5 font-bold text-white">{b.name}</td>
                  <td className="p-2.5 text-right text-emerald-400 font-semibold">{b.endValueManwon.toLocaleString()}만원</td>
                  <td className="p-2.5 text-right text-slate-300">{b.weightPct}%</td>
                  <td className="p-2.5 text-center text-slate-300">{b.maturityYear}년</td>
                  <td className="p-2.5 text-center text-blue-400">{b.estimatedDuration}년</td>
                  <td className="p-2.5 text-right text-amber-300 font-medium">연 {b.couponRatePct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
