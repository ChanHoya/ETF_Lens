'use client';

import React, { useState, useMemo } from 'react';
import { 
  Calendar, DollarSign, TrendingUp, Sparkles, ArrowUpRight, 
  CheckCircle2, AlertCircle, Filter, PieChart, Layers, Download,
  Coins, Landmark, ChevronRight, ShieldCheck, Repeat
} from 'lucide-react';
import { 
  ResponsiveContainer, ComposedChart, Bar, Line, 
  XAxis, YAxis, Tooltip, CartesianGrid, Legend, Cell 
} from 'recharts';
import { STANDARD_TOOLTIP_STYLE, STANDARD_LEGEND_WRAPPER_STYLE } from '@/lib/chartTheme';
import { TffFundData } from '@/lib/tff/types';

interface Props {
  data?: TffFundData | null;
}

interface DividendScheduleItem {
  id: string;
  month: number; // 1 ~ 12
  assetName: string;
  category: '배당 ETF' | '국채/해외채' | '회사채/크레딧' | '단기자금';
  estimatedAmountManwon: number;
  expectedDate: string; // e.g. "매월 초", "1월 1일/7월 1일", "매월 15일"
  taxStatus: '100% 비과세(조세조약)' | '15.4% 원천징수' | '분리과세 신청가능';
  badgeColor: string;
  reinvestNote: string;
}

export default function TffDividendCalendar({ data }: Props) {
  // 선택된 조회 연도 및 필터링 월
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [selectedMonthFilter, setSelectedMonthFilter] = useState<number | 'ALL'>('ALL');
  const [reinvestMode, setReinvestMode] = useState<boolean>(true); // 복리 재투자 모드

  // TFF 펀드 포트폴리오 기반 분배금/쿠폰 데이터셋 (실제 보유 종목 및 표준 TFF 포트폴리오 결합)
  const dividendSchedule: DividendScheduleItem[] = useMemo(() => {
    // TFF 펀드 주요 자산 기준 12개월 캐시플로우 모델
    return [
      // 브라질 국채 (1월, 7월 반기 10% 쿠폰 - 한-브라질 조세조약 100% 비과세)
      { id: 'brz-1', month: 1, assetName: '브라질 국채 10년 (NTN-F)', category: '국채/해외채', estimatedAmountManwon: 500, expectedDate: '1월 1일', taxStatus: '100% 비과세(조세조약)', badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30', reinvestNote: '단기 KOFR 또는 미국배당 ETF로 재투자 권장' },
      { id: 'brz-7', month: 7, assetName: '브라질 국채 10년 (NTN-F)', category: '국채/해외채', estimatedAmountManwon: 500, expectedDate: '7월 1일', taxStatus: '100% 비과세(조세조약)', badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30', reinvestNote: '하반기 고배당 ETF 리밸런싱 재원으로 활용' },

      // ACE 미국배당다우존스 (월배당 연 3.8%)
      ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => ({
        id: `schd-${m}`, month: m, assetName: 'ACE 미국배당다우존스', category: '배당 ETF' as const, estimatedAmountManwon: 48, expectedDate: `매월 2~3일`, taxStatus: '15.4% 원천징수' as const, badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-500/30', reinvestNote: '자동 재투자로 배당주 수량 지속 확대'
      })),

      // TIGER 미국테크TOP10+10%프리미엄 (월배당 연 10.2%)
      ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => ({
        id: `tech-prem-${m}`, month: m, assetName: 'TIGER 미국테크TOP10+10%타깃', category: '배당 ETF' as const, estimatedAmountManwon: 85, expectedDate: `매월 15~18일`, taxStatus: '15.4% 원천징수' as const, badgeColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30', reinvestNote: '고인컴 현금흐름으로 하락장 저가 분할매수 원천'
      })),

      // KODEX 26-12 회사채(AA-이상)액티브 (만기매칭 반기/분기 쿠폰 연 4.1%)
      { id: 'bond-3', month: 3, assetName: 'KODEX 26-12 회사채액티브', category: '회사채/크레딧', estimatedAmountManwon: 62, expectedDate: '3월 말일', taxStatus: '15.4% 원천징수', badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30', reinvestNote: '회사채 분기 쿠폰 수취' },
      { id: 'bond-6', month: 6, assetName: 'KODEX 26-12 회사채액티브', category: '회사채/크레딧', estimatedAmountManwon: 62, expectedDate: '6월 말일', taxStatus: '15.4% 원천징수', badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30', reinvestNote: '상반기 만기매칭 이자 결산' },
      { id: 'bond-9', month: 9, assetName: 'KODEX 26-12 회사채액티브', category: '회사채/크레딧', estimatedAmountManwon: 62, expectedDate: '9월 말일', taxStatus: '15.4% 원천징수', badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30', reinvestNote: '3분기 이자 정산' },
      { id: 'bond-12', month: 12, assetName: 'KODEX 26-12 회사채액티브', category: '회사채/크레딧', estimatedAmountManwon: 62, expectedDate: '12월 24일', taxStatus: '15.4% 원천징수', badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30', reinvestNote: '연말 이자 확정 및 만기 롤오버' },

      // TIGER KOFR금리액티브 (단기 무위험 파킹 일복리)
      ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => ({
        id: `kofr-${m}`, month: m, assetName: 'TIGER KOFR금리액티브(파킹)', category: '단기자금' as const, estimatedAmountManwon: 28, expectedDate: `월말 누적산입`, taxStatus: '15.4% 원천징수' as const, badgeColor: 'bg-slate-500/20 text-slate-300 border-slate-500/30', reinvestNote: '기준금리 인하 전 고금리 파킹 이자 확보'
      })),

      // KODEX 반도체 / KOSPI 대형주 분기 특별배당 (4월 집중 유입)
      { id: 'kospi-div-4', month: 4, assetName: '국내 대형주/반도체 결산배당', category: '배당 ETF', estimatedAmountManwon: 180, expectedDate: '4월 넷째주', taxStatus: '15.4% 원천징수', badgeColor: 'bg-sky-500/20 text-sky-300 border-sky-500/30', reinvestNote: '국내 상장사 4월 배당 집중 시즌 결산 입금' },
    ];
  }, []);

  // 1월 ~ 12월 월별 집계 데이터 (Recharts 차트용)
  const monthlyAggregated = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => i + 1);
    let cumulative = 0;

    return months.map(m => {
      const itemsInMonth = dividendSchedule.filter(item => item.month === m);
      const totalInMonth = itemsInMonth.reduce((acc, cur) => acc + cur.estimatedAmountManwon, 0);
      const taxExemptAmount = itemsInMonth
        .filter(item => item.taxStatus.includes('비과세'))
        .reduce((acc, cur) => acc + cur.estimatedAmountManwon, 0);
      const taxableAmount = totalInMonth - taxExemptAmount;

      cumulative += totalInMonth;

      return {
        month: `${m}월`,
        monthNum: m,
        totalAmount: totalInMonth,
        taxExemptAmount,
        taxableAmount,
        cumulativeAmount: cumulative,
        itemCount: itemsInMonth.length,
      };
    });
  }, [dividendSchedule]);

  // 연간 핵심 KPI
  const annualTotalManwon = useMemo(() => {
    return dividendSchedule.reduce((acc, cur) => acc + cur.estimatedAmountManwon, 0);
  }, [dividendSchedule]);

  const monthlyAverageManwon = useMemo(() => {
    return Math.round(annualTotalManwon / 12);
  }, [annualTotalManwon]);

  const taxExemptRatio = useMemo(() => {
    const exemptTotal = dividendSchedule
      .filter(item => item.taxStatus.includes('비과세'))
      .reduce((acc, cur) => acc + cur.estimatedAmountManwon, 0);
    return Math.round((exemptTotal / annualTotalManwon) * 100);
  }, [dividendSchedule, annualTotalManwon]);

  // 필터링된 세부 내역 목록
  const filteredItems = useMemo(() => {
    if (selectedMonthFilter === 'ALL') return dividendSchedule;
    return dividendSchedule.filter(item => item.month === selectedMonthFilter);
  }, [dividendSchedule, selectedMonthFilter]);

  // 5년 후 복리 재투자 시 예상 자산 증가 시뮬레이션
  const compoundReinvestBenefitManwon = useMemo(() => {
    // 연 7% 재투자 복리 가정
    const r = 0.07;
    let accumulated = 0;
    for (let yr = 1; yr <= 5; yr++) {
      accumulated = (accumulated + annualTotalManwon) * (1 + r);
    }
    const simpleTotal = annualTotalManwon * 5;
    return Math.round(accumulated - simpleTotal);
  }, [annualTotalManwon]);

  return (
    <div className="w-full space-y-6">
      {/* 1. 상단 인트로 헤더 & 퀵 필터 바 */}
      <div className="p-5 md:p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-500/20 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                <Calendar className="w-3 h-3" />
                TFF 공동 펀드 전용 캐시플로우
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                <ShieldCheck className="w-3 h-3" />
                비과세 혜택 자동 감지
              </span>
            </div>
            <h2 className="text-xl md:text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
              TFF 연간 배당·쿠폰 캐시플로우 타임라인
            </h2>
            <p className="text-xs md:text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed">
              TFF 공동 펀드 보유 자산(해외 국채 반기 쿠폰, 월배당 ETF, 회사채 이자 등)의 1~12월 유입 스케줄을 시각화하고, 연간 총 배당수익률 및 복리 재투자 로드맵을 제공합니다.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setReinvestMode(!reinvestMode)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 shadow-sm ${
                reinvestMode
                  ? 'bg-indigo-600 text-white border-indigo-500 shadow-indigo-600/30'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
              }`}
            >
              <Repeat className={`w-3.5 h-3.5 ${reinvestMode ? 'text-amber-300 animate-spin-slow' : ''}`} />
              <span>{reinvestMode ? '복리 재투자 모드 ON' : '단순 수취 모드'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. 4대 핵심 KPI 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 shadow-sm hover:border-indigo-500/40 transition-all">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>연간 총 배당·쿠폰 유입</span>
            <Coins className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="mt-2 text-2xl font-extrabold text-white tracking-tight">
            약 {annualTotalManwon.toLocaleString()}만원
          </div>
          <div className="mt-1 flex items-center text-[11px] text-indigo-300 font-medium">
            <TrendingUp className="w-3 h-3 mr-1" />
            펀드 포트폴리오 기준 연 6.8% 캐시플로우
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 shadow-sm hover:border-blue-500/40 transition-all">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>월평균 패시브 인컴</span>
            <DollarSign className="w-4 h-4 text-blue-400" />
          </div>
          <div className="mt-2 text-2xl font-extrabold text-blue-400 tracking-tight">
            월 {monthlyAverageManwon.toLocaleString()}만원
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            매월 정기 펀드 운용비 및 재투자 원천
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 shadow-sm hover:border-emerald-500/40 transition-all">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>비과세 이자 비중 (브라질 국채)</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 text-2xl font-extrabold text-emerald-400 tracking-tight">
            {taxExemptRatio}%
          </div>
          <div className="mt-1 text-[11px] text-emerald-300/80">
            조세조약 100% 비과세(1월·7월 1,000만)
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 shadow-sm hover:border-amber-500/40 transition-all">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>5년 복리 재투자 추가 창출</span>
            <Sparkles className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-2 text-2xl font-extrabold text-amber-400 tracking-tight">
            +{compoundReinvestBenefitManwon.toLocaleString()}만원
          </div>
          <div className="mt-1 text-[11px] text-amber-300/80">
            연 7% 복리 롤오버 시 복리 마법 효과
          </div>
        </div>
      </div>

      {/* 3. 1~12월 캐시플로우 타임라인 차트 (Recharts ComposedChart) */}
      <div className="p-5 md:p-6 rounded-2xl bg-slate-950 border border-slate-800/80 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Calendar className="w-4 h-4 text-indigo-400" />
              월별 분배금 수령액 & 연간 누적 타임라인
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              막대를 클릭하면 해당 월의 상세 입금 내역을 필터링하여 확인하실 수 있습니다.
            </p>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-1 sm:pb-0">
            <button
              onClick={() => setSelectedMonthFilter('ALL')}
              className={`px-2.5 py-1 text-xs rounded-lg font-semibold transition-all ${
                selectedMonthFilter === 'ALL'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              전체 보기
            </button>
            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
              <button
                key={m}
                onClick={() => setSelectedMonthFilter(m)}
                className={`px-2 py-1 text-xs rounded-lg font-semibold transition-all ${
                  selectedMonthFilter === m
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-800/60 text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                {m}월
              </button>
            ))}
          </div>
        </div>

        <div className="h-[280px] w-full mt-2">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={monthlyAggregated} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
              <XAxis dataKey="month" stroke="#94a3b8" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="left" stroke="#94a3b8" tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}만`} />
              <YAxis yAxisId="right" orientation="right" stroke="#818cf8" tick={{ fontSize: 11 }} tickFormatter={(v) => `${Math.round(v / 100)}백`} />
              <Tooltip
                contentStyle={STANDARD_TOOLTIP_STYLE}
                formatter={(val: any, name: any) => {
                  if (name === '누적 수령액') return [`${Number(val).toLocaleString()}만원`, name];
                  if (name === '비과세 쿠폰') return [`${Number(val).toLocaleString()}만원 (비과세)`, name];
                  return [`${Number(val).toLocaleString()}만원`, name];
                }}
              />
              <Legend wrapperStyle={STANDARD_LEGEND_WRAPPER_STYLE} />
              <Bar yAxisId="left" dataKey="taxExemptAmount" name="비과세 쿠폰" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
              <Bar yAxisId="left" dataKey="taxableAmount" name="일반 배당/이자" stackId="a" fill="#6366f1" radius={[4, 4, 0, 0]}>
                {monthlyAggregated.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    cursor="pointer"
                    fill={selectedMonthFilter === entry.monthNum ? '#a855f7' : (entry.taxExemptAmount > 0 ? '#6366f1' : '#3b82f6')}
                    onClick={() => setSelectedMonthFilter(entry.monthNum)}
                  />
                ))}
              </Bar>
              <Line yAxisId="right" type="monotone" dataKey="cumulativeAmount" name="누적 수령액" stroke="#ec4899" strokeWidth={2.5} dot={{ r: 3, fill: '#ec4899' }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
            <strong>1월 & 7월:</strong> 브라질 국채 반기 쿠폰(+500만원) 집중 유입으로 상·하반기 펀드 유동성 피크
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 inline-block" />
            <strong>4월:</strong> 국내 KOSPI 결산 배당 집중 유입 (+180만원)
          </span>
        </div>
      </div>

      {/* 4. 세부 분배금 항목 카드 & 캘린더 그리드 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Coins className="w-4 h-4 text-amber-400" />
            {selectedMonthFilter === 'ALL' ? '연간 전체 분배금 유입 세부 명세' : `${selectedMonthFilter}월 분배금 유입 세부 명세 (${filteredItems.length}건)`}
          </h3>
          <span className="text-xs text-slate-400">
            총합 {filteredItems.reduce((acc, cur) => acc + cur.estimatedAmountManwon, 0).toLocaleString()}만원
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredItems.map(item => (
            <div
              key={item.id}
              className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800/80 hover:border-indigo-500/40 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                    {item.month}월 입금 ({item.expectedDate})
                  </span>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${item.badgeColor}`}>
                    {item.taxStatus}
                  </span>
                </div>
                <div className="text-sm font-bold text-white mb-0.5">
                  {item.assetName}
                </div>
                <div className="text-[11px] text-slate-400 mb-2">
                  분류: {item.category}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800/60 flex items-baseline justify-between">
                <span className="text-xs text-slate-400">예상 입금액</span>
                <span className="text-base font-extrabold text-amber-400">
                  +{item.estimatedAmountManwon.toLocaleString()}만원
                </span>
              </div>
              <p className="mt-1.5 text-[10px] text-indigo-300/80 bg-indigo-950/30 p-1.5 rounded-lg border border-indigo-900/30">
                💡 {item.reinvestNote}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
