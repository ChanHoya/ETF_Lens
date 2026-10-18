'use client';

import React, { useState, useMemo } from 'react';
import { 
  Landmark, TrendingUp, Percent, Clock, Sliders, ArrowUpRight, 
  Sparkles, Layers, ShieldCheck, ChevronRight, BarChart3, Repeat, 
  AlertCircle, DollarSign, ArrowDownRight, Compass
} from 'lucide-react';
import { 
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, 
  Tooltip, CartesianGrid, Cell, Legend 
} from 'recharts';
import { STANDARD_TOOLTIP_STYLE, STANDARD_LEGEND_WRAPPER_STYLE } from '@/lib/chartTheme';
import { TffFundData } from '@/lib/tff/types';

interface Props {
  data?: TffFundData | null;
}

// 10개년 채권 사다리(Bond Ladder) 데이터 구조
interface LadderYearItem {
  year: number; // 2026 ~ 2035
  principalRedemptionManwon: number; // 만기 도래 원금 회수액
  couponInterestManwon: number;      // 정기 표면 이자/쿠폰 수령액
  totalCashflowManwon: number;
  maturingAssets: string[];
  reinvestStrategy: string;
}

export default function TffBondLadderAnalytics({ data }: Props) {
  // 기준금리 인하폭 슬라이더 (-25bp ~ -150bp)
  const [rateCutBps, setRateCutBps] = useState<number>(75); // 기본 75bp (0.75%p) 인하

  // TFF 펀드 고정 채권 풀 파라미터 (원금 6,000만원 채권 자산 기준)
  const bondMetrics = useMemo(() => {
    const totalBondCapitalManwon = 6000; // 채권 배분 원금 6,000만원
    const weightedYtm = 9.85;            // 가중평균 만기수익률 (브라질 고금리 13% + 국내 크레딧 4.2% 가중)
    const modifiedDuration = 4.25;       // 가중평균 수정 듀레이션 4.25년
    const dv01Manwon = Math.round((totalBondCapitalManwon * (modifiedDuration / 100)) / 100 * 10000) / 10000; // 1bp 변동 시 손익(원)

    // 금리 인하에 따른 예상 자본차익 (%) = 듀레이션 × 인하폭(%)
    const rateCutPct = rateCutBps / 100;
    const capitalGainPct = Number((modifiedDuration * rateCutPct).toFixed(2));
    const capitalGainAmountManwon = Math.round(totalBondCapitalManwon * (capitalGainPct / 100));

    // 연간 기본 표면 쿠폰 수취액 (가중평균 표면금리 약 8.2%)
    const annualCouponManwon = Math.round(totalBondCapitalManwon * 0.082);

    // 총 기대 수익 (쿠폰 + 자본차익)
    const totalExpectedReturnManwon = annualCouponManwon + capitalGainAmountManwon;
    const totalReturnRatePct = Number(((totalExpectedReturnManwon / totalBondCapitalManwon) * 100).toFixed(1));

    return {
      totalBondCapitalManwon,
      weightedYtm,
      modifiedDuration,
      dv01Manwon,
      rateCutPct,
      capitalGainPct,
      capitalGainAmountManwon,
      annualCouponManwon,
      totalExpectedReturnManwon,
      totalReturnRatePct,
    };
  }, [rateCutBps]);

  // 2026 ~ 2035년 10개년 만기 회수 사다리 데이터
  const bondLadderData: LadderYearItem[] = useMemo(() => {
    return [
      {
        year: 2026,
        principalRedemptionManwon: 1500, // KODEX 26-12 회사채 만기 도래 원금 회수
        couponInterestManwon: 540,
        totalCashflowManwon: 2040,
        maturingAssets: ['KODEX 26-12 회사채액티브'],
        reinvestStrategy: '상환 원금 1,500만 원은 금리 인하 후기 고배당 ETF 또는 장기채로 롤오버 권장',
      },
      {
        year: 2027,
        principalRedemptionManwon: 0,
        couponInterestManwon: 480,
        totalCashflowManwon: 480,
        maturingAssets: [],
        reinvestStrategy: '순수 반기 쿠폰 유입기, 정기 인컴 재투자',
      },
      {
        year: 2028,
        principalRedemptionManwon: 1000,
        couponInterestManwon: 460,
        totalCashflowManwon: 1460,
        maturingAssets: ['국내 특수채 28-09'],
        reinvestStrategy: '국내 단기 크레딧 상환금 회수 및 리밸런싱',
      },
      {
        year: 2029,
        principalRedemptionManwon: 0,
        couponInterestManwon: 420,
        totalCashflowManwon: 420,
        maturingAssets: [],
        reinvestStrategy: '안정적 비과세 쿠폰 캐시플로우 집중 수취',
      },
      {
        year: 2030,
        principalRedemptionManwon: 0,
        couponInterestManwon: 420,
        totalCashflowManwon: 420,
        maturingAssets: [],
        reinvestStrategy: '장기채 듀레이션 효과 극대화 구간',
      },
      {
        year: 2031,
        principalRedemptionManwon: 1500,
        couponInterestManwon: 380,
        totalCashflowManwon: 1880,
        maturingAssets: ['브라질 국채 1차 트렌치 만기'],
        reinvestStrategy: '브라질 국채 원금 1차 비과세 전액 회수 시점 (환전 타이밍 결정)',
      },
      {
        year: 2032,
        principalRedemptionManwon: 0,
        couponInterestManwon: 250,
        totalCashflowManwon: 250,
        maturingAssets: [],
        reinvestStrategy: '잔여 채권 포트폴리오 쿠폰 유입',
      },
      {
        year: 2033,
        principalRedemptionManwon: 2000,
        couponInterestManwon: 200,
        totalCashflowManwon: 2200,
        maturingAssets: ['브라질 국채 10년 NTN-F 메인 만기'],
        reinvestStrategy: '브라질 국채 최종 원금 비과세 상환 (총 누적 비과세 복리 마침표)',
      },
      {
        year: 2034,
        principalRedemptionManwon: 0,
        couponInterestManwon: 50,
        totalCashflowManwon: 50,
        maturingAssets: [],
        reinvestStrategy: '신규 10년 사다리 리뉴얼 단계',
      },
      {
        year: 2035,
        principalRedemptionManwon: 0,
        couponInterestManwon: 50,
        totalCashflowManwon: 50,
        maturingAssets: [],
        reinvestStrategy: '차세대 대체 펀드 파이프라인 연계',
      },
    ];
  }, []);

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
                TFF 채권·인컴 정밀 분석
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/10 text-sky-300 border border-sky-500/20">
                <ShieldCheck className="w-3 h-3" />
                만기 매칭 사다리(Bond Ladder)
              </span>
            </div>
            <h2 className="text-xl md:text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
              TFF 채권 듀레이션 & 10개년 만기 매칭 현금흐름 사다리
            </h2>
            <p className="text-xs md:text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed">
              TFF 공동 펀드 보유 채권(브라질 국채, 미국 장기채, 만기매칭 회사채)의 듀레이션 및 금리 인하 사이클 자본차익을 계량화하고, 2026~2035년 원리금 회수 로드맵을 시각화합니다.
            </p>
          </div>
        </div>
      </div>

      {/* 2. 채권 4대 핵심 계량 지표 (YTM, 듀레이션, DV01, 쿠폰) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 shadow-sm hover:border-emerald-500/40 transition-all">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>가중평균 만기수익률 (YTM)</span>
            <Percent className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 text-2xl font-extrabold text-emerald-400 tracking-tight">
            연 {bondMetrics.weightedYtm}%
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            브라질 13% + 국내 크레딧 4.2% 가중
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 shadow-sm hover:border-blue-500/40 transition-all">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>수정 듀레이션 (Duration)</span>
            <Clock className="w-4 h-4 text-blue-400" />
          </div>
          <div className="mt-2 text-2xl font-extrabold text-blue-400 tracking-tight">
            {bondMetrics.modifiedDuration}년
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            금리 1%p 변동 시 자본가격 4.25% 반응
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 shadow-sm hover:border-indigo-500/40 transition-all">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>금리 1bp 민감도 (DV01)</span>
            <Sliders className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="mt-2 text-2xl font-extrabold text-indigo-400 tracking-tight">
            2.55만원 / bp
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            기준금리 25bp 인하 시 +63.7만원 차익
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 shadow-sm hover:border-amber-500/40 transition-all">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>연간 고정 쿠폰(이자)</span>
            <DollarSign className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-2 text-2xl font-extrabold text-amber-400 tracking-tight">
            연 {bondMetrics.annualCouponManwon.toLocaleString()}만원
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            만기 보유 시 무위험 연 {Math.round(bondMetrics.annualCouponManwon / 12)}만원 확보
          </div>
        </div>
      </div>

      {/* 3. 기준금리 인하 사이클 자본차익 인터랙티브 시뮬레이터 */}
      <div className="p-5 md:p-6 rounded-2xl bg-slate-950 border border-slate-800 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              BOK / Fed 기준금리 인하 사이클 자본차익(Capital Gain) 시뮬레이터
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              슬라이더를 조절하여 향후 기준금리 인하 폭에 따른 채권 자본차익과 연간 총 수익률을 확인하세요.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {[25, 50, 75, 100, 150].map(bps => (
              <button
                key={bps}
                onClick={() => setRateCutBps(bps)}
                className={`px-2.5 py-1 text-xs rounded-lg font-bold transition-all ${
                  rateCutBps === bps
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                -{bps}bp
              </button>
            ))}
          </div>
        </div>

        {/* 슬라이더 컨트롤러 */}
        <div className="py-4 space-y-2">
          <div className="flex justify-between text-xs font-semibold">
            <span className="text-slate-300">인하 시나리오: -{rateCutBps}bp ({bondMetrics.rateCutPct}%p 인하)</span>
            <span className="text-emerald-400 font-bold">예상 자본차익: +{bondMetrics.capitalGainPct}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={200}
            step={25}
            value={rateCutBps}
            onChange={(e) => setRateCutBps(Number(e.target.value))}
            className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
          />
        </div>

        {/* 시뮬레이션 결과 3대 카드 */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
            <span className="text-xs text-slate-400">금리 인하 시 평가차익</span>
            <div className="text-xl font-extrabold text-emerald-400 mt-1">
              +{bondMetrics.capitalGainAmountManwon.toLocaleString()}만원
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              듀레이션 {bondMetrics.modifiedDuration}년 × -{rateCutBps}bp
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
            <span className="text-xs text-slate-400">1년 고정 쿠폰 이자</span>
            <div className="text-xl font-extrabold text-amber-400 mt-1">
              +{bondMetrics.annualCouponManwon.toLocaleString()}만원
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              연 8.2% 표면금리 수취
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900/80 border border-emerald-500/30">
            <span className="text-xs text-emerald-300 font-bold">1년 총 합산 기대 수익</span>
            <div className="text-xl font-extrabold text-white mt-1">
              +{bondMetrics.totalExpectedReturnManwon.toLocaleString()}만원 ({bondMetrics.totalReturnRatePct}%)
            </div>
            <p className="text-[11px] text-emerald-400/80 mt-0.5">
              쿠폰 수익 + 자본차익 동시 달성
            </p>
          </div>
        </div>
      </div>

      {/* 4. 10개년 만기 회수 사다리(Bond Ladder) Recharts 차트 및 수지표 */}
      <div className="p-5 md:p-6 rounded-2xl bg-slate-950 border border-slate-800 shadow-xl">
        <div className="mb-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-emerald-400" />
            2026 ~ 2035년 10개년 채권 만기 상환 & 쿠폰 유입 사다리
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            연도별 만기 도래 원금(초록색)과 정기 쿠폰(파란색)의 유입 스케줄로 안정적인 재투자 자금 계획을 수립할 수 있습니다.
          </p>
        </div>

        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={bondLadderData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
              <XAxis dataKey="year" stroke="#94a3b8" tick={{ fontSize: 11 }} />
              <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}만`} />
              <Tooltip
                contentStyle={STANDARD_TOOLTIP_STYLE}
                formatter={(val: any, name: any) => [`${Number(val).toLocaleString()}만원`, name]}
              />
              <Legend wrapperStyle={STANDARD_LEGEND_WRAPPER_STYLE} />
              <Bar dataKey="principalRedemptionManwon" name="만기 도래 원금" stackId="ladder" fill="#10b981" radius={[0, 0, 0, 0]} />
              <Bar dataKey="couponInterestManwon" name="정기 쿠폰 이자" stackId="ladder" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* 연도별 세부 재투자 로드맵 */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {bondLadderData.filter(d => d.principalRedemptionManwon > 0).map(item => (
            <div key={item.year} className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-emerald-400">{item.year}년 만기 트렌치</span>
                <span className="text-xs font-extrabold text-white">
                  원금 {item.principalRedemptionManwon.toLocaleString()}만원 회수
                </span>
              </div>
              <div className="text-[11px] text-slate-300 font-medium mb-1">
                해당 종목: {item.maturingAssets.join(', ')}
              </div>
              <p className="text-[10px] text-slate-400 bg-slate-950 p-1.5 rounded-lg border border-slate-800/80">
                🧭 {item.reinvestStrategy}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
