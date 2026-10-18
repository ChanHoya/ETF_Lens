'use client';

import React, { useState, useMemo } from 'react';
import { 
  Calendar, DollarSign, TrendingUp, Sparkles, ArrowUpRight, 
  CheckCircle2, AlertCircle, Filter, PieChart, Layers, Download,
  Coins, Landmark, ChevronRight, ShieldCheck, Repeat, Info
} from 'lucide-react';
import { 
  ResponsiveContainer, ComposedChart, Bar, Line, 
  XAxis, YAxis, Tooltip, CartesianGrid, Legend, Cell 
} from 'recharts';
import { STANDARD_TOOLTIP_STYLE, STANDARD_LEGEND_WRAPPER_STYLE } from '@/lib/chartTheme';
import { TffFundData, TffHoldingsRow, TffMonthInfo } from '@/lib/tff/types';

interface Props {
  data?: TffFundData | null;
}

interface DividendScheduleItem {
  id: string;
  month: number; // 1 ~ 12
  assetName: string;
  holdingValueManwon: number;
  weightPct: number;
  category: '국내주식형' | '해외주식형' | '채권/크레딧' | '배당형' | '현금/파킹';
  estimatedAmountManwon: number;
  expectedDate: string;
  taxStatus: '15.4% 배당소득세' | '비과세(비용차감)' | '분리과세 대상';
  badgeColor: string;
  reinvestNote: string;
}

// 보유 종목 분류 헬퍼
function categorizeHolding(name: string): '국내주식형' | '해외주식형' | '채권/크레딧' | '배당형' | '현금/파킹' {
  if (name.includes('배당') || name.includes('다우존스') || name.includes('커버드콜')) return '배당형';
  if (name.includes('채권') || name.includes('국고채') || name.includes('국채') || name.includes('회사채') || name.includes('금융채')) return '채권/크레딧';
  if (name.includes('머니마켓') || name.includes('CD') || name.includes('KOFR') || name.includes('현금') || name.includes('파킹')) return '현금/파킹';
  if (name.includes('미국') || name.includes('S&P') || name.includes('나스닥') || name.includes('글로벌') || name.includes('차이나') || name.includes('필라델피아')) return '해외주식형';
  return '국내주식형';
}

// 보유 종목별 연간 예상 배당률 및 분배 지급월 추정
function getAssetDistributionProfile(name: string, category: string): { annualYieldPct: number; paymentMonths: number[]; expectedDate: string } {
  if (category === '배당형') {
    // 월배당 ETF인 경우
    if (name.includes('커버드콜') || name.includes('타겟')) {
      return { annualYieldPct: 9.5, paymentMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], expectedDate: '매월 15~18일' };
    }
    return { annualYieldPct: 4.2, paymentMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], expectedDate: '매월 2~3일' };
  }

  if (category === '채권/크레딧') {
    // 만기매칭형 채권 또는 분기 이자
    if (name.includes('26-12') || name.includes('25-12')) {
      return { annualYieldPct: 3.8, paymentMonths: [3, 6, 9, 12], expectedDate: '분기 말일' };
    }
    return { annualYieldPct: 3.2, paymentMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], expectedDate: '월말 분배금' };
  }

  if (category === '해외주식형') {
    // S&P 500, 나스닥 등 분기 분배
    return { annualYieldPct: 1.4, paymentMonths: [1, 4, 7, 10], expectedDate: '분기 익월 초' };
  }

  if (category === '현금/파킹') {
    return { annualYieldPct: 3.0, paymentMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], expectedDate: '월말 이자 누적' };
  }

  // 국내주식형 (KOSPI 200, 반도체 등: 4월 결산 배당 집중 + 1, 7, 10월 분기 배당)
  return { annualYieldPct: 1.8, paymentMonths: [4, 7, 10], expectedDate: '4월 말(결산), 분기 익월' };
}

export default function TffDividendCalendar({ data }: Props) {
  const [selectedMonthFilter, setSelectedMonthFilter] = useState<number | 'ALL'>('ALL');
  const [reinvestMode, setReinvestMode] = useState<boolean>(true); // 복리 재투자 모드

  // 1. TFF 실제 보유 종목(Holdings) 추출 (비보유 가상 자산 일체 배제)
  const { realHoldings, latestMonthLabel, totalPortfolioValueManwon } = useMemo(() => {
    if (!data) return { realHoldings: [], latestMonthLabel: '', totalPortfolioValueManwon: 0 };

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
    // 유효 보유 종목만 필터링 (평가액 0원 초과)
    const valid = holdings.filter(h => h.name && (h.endValue > 0 || (h.beginValue || 0) > 0));

    const totalVal = valid.reduce((acc, cur) => acc + (cur.endValue || 0), 0) + (info?.summary?.cashBalance || 0);
    const totalManwon = Math.round(totalVal / 10000);

    return {
      realHoldings: valid,
      latestMonthLabel: lm || info?.period || '최근',
      totalPortfolioValueManwon: totalManwon > 0 ? totalManwon : Math.round(totalVal),
    };
  }, [data]);

  // 2. 실제 보유 종목 기반 연간 배당·분배금 일정 생성
  const dividendSchedule: DividendScheduleItem[] = useMemo(() => {
    if (realHoldings.length === 0) return [];

    const items: DividendScheduleItem[] = [];
    const totalVal = realHoldings.reduce((sum, h) => sum + (h.endValue || 0), 0) || 1;

    realHoldings.forEach((h, hIdx) => {
      const holdingValueManwon = Math.round((h.endValue || 0) / 10000);
      if (holdingValueManwon <= 0) return;

      const weightPct = Number((((h.endValue || 0) / totalVal) * 100).toFixed(1));
      const category = categorizeHolding(h.name);
      const profile = getAssetDistributionProfile(h.name, category);

      // 연간 총 예상 배당금 (만원)
      const annualDividendManwon = Math.round(holdingValueManwon * (profile.annualYieldPct / 100));
      const perMonthAmount = Math.max(1, Math.round(annualDividendManwon / profile.paymentMonths.length));

      // 각 지급월별 아이템 생성
      profile.paymentMonths.forEach(m => {
        let badgeColor = 'bg-blue-500/20 text-blue-300 border-blue-500/30';
        if (category === '배당형') badgeColor = 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30';
        if (category === '채권/크레딧') badgeColor = 'bg-amber-500/20 text-amber-300 border-amber-500/30';
        if (category === '현금/파킹') badgeColor = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';

        items.push({
          id: `div-${hIdx}-${m}`,
          month: m,
          assetName: h.name,
          holdingValueManwon,
          weightPct,
          category,
          estimatedAmountManwon: perMonthAmount,
          expectedDate: profile.expectedDate,
          taxStatus: '15.4% 배당소득세',
          badgeColor,
          reinvestNote: `${h.name} 분배금 수취 후 펀드 포트폴리오 재투자`,
        });
      });
    });

    return items;
  }, [realHoldings]);

  // 3. 월별 집계 데이터 (Recharts 차트용)
  const monthlyAggregated = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => i + 1);
    let cumulative = 0;

    return months.map(m => {
      const itemsInMonth = dividendSchedule.filter(item => item.month === m);
      const totalInMonth = itemsInMonth.reduce((acc, cur) => acc + cur.estimatedAmountManwon, 0);
      cumulative += totalInMonth;

      return {
        month: `${m}월`,
        monthNum: m,
        totalAmount: totalInMonth,
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

  const portfolioYieldPct = useMemo(() => {
    if (totalPortfolioValueManwon <= 0) return 0;
    return Number(((annualTotalManwon / totalPortfolioValueManwon) * 100).toFixed(2));
  }, [annualTotalManwon, totalPortfolioValueManwon]);

  // 필터링된 세부 내역 목록
  const filteredItems = useMemo(() => {
    if (selectedMonthFilter === 'ALL') return dividendSchedule;
    return dividendSchedule.filter(item => item.month === selectedMonthFilter);
  }, [dividendSchedule, selectedMonthFilter]);

  // 보유 종목이 없는 경우 빈 상태 안내
  if (realHoldings.length === 0) {
    return (
      <div className="w-full p-8 rounded-2xl bg-slate-900/40 border border-slate-800 text-center">
        <AlertCircle className="w-12 h-12 text-slate-500 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-white mb-1">TFF 보유 종목 데이터가 없습니다</h3>
        <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
          대시보드 상단에서 TFF 펀드 현황 엑셀을 업로드하면 실제 편입된 보유 종목(ETF/주식/채권)의 실시간 배당·분배금 캘린더가 자동으로 산출됩니다. (비보유 가상 자산은 엄격히 제외됩니다)
        </p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      {/* 1. 상단 인트로 헤더 */}
      <div className="p-5 md:p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-500/20 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                <Calendar className="w-3 h-3" />
                TFF 실제 보유 포트폴리오 연동
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                <CheckCircle2 className="w-3 h-3" />
                {latestMonthLabel} 기준 {realHoldings.length}개 보유 종목
              </span>
            </div>
            <h2 className="text-xl md:text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
              TFF 보유 종목 배당·분배금 캐시플로우 타임라인
            </h2>
            <p className="text-xs md:text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed">
              TFF 펀드에 실제 편입된 {realHoldings.length}개 종목의 연간 배당 및 분배금 유입 스케줄입니다. (비보유 자산은 엄격히 제외되어 있습니다)
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
            <span>연간 총 예상 배당·분배금</span>
            <Coins className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="mt-2 text-2xl font-extrabold text-white tracking-tight">
            약 {annualTotalManwon.toLocaleString()}만원
          </div>
          <div className="mt-1 flex items-center text-[11px] text-indigo-300 font-medium">
            <TrendingUp className="w-3 h-3 mr-1" />
            포트폴리오 배당수익률 연 {portfolioYieldPct}%
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
            보유 {realHoldings.length}종목 정기 유입분
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 shadow-sm hover:border-emerald-500/40 transition-all">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>실제 편입 자산 총액</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 text-2xl font-extrabold text-emerald-400 tracking-tight">
            {totalPortfolioValueManwon.toLocaleString()}만원
          </div>
          <div className="mt-1 text-[11px] text-emerald-300/80">
            {latestMonthLabel} 스냅샷 평가액 기준
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 shadow-sm hover:border-amber-500/40 transition-all">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>5년 복리 재투자 추가 창출</span>
            <Sparkles className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-2 text-2xl font-extrabold text-amber-400 tracking-tight">
            +{Math.round(annualTotalManwon * 0.35).toLocaleString()}만원
          </div>
          <div className="mt-1 text-[11px] text-amber-300/80">
            분배금 펀드 자동 롤오버 시
          </div>
        </div>
      </div>

      {/* 3. 월별 캐시플로우 타임라인 차트 */}
      <div className="p-5 md:p-6 rounded-2xl bg-slate-950 border border-slate-800/80 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Calendar className="w-4 h-4 text-indigo-400" />
              월별 예상 분배금 수령액 (1~12월)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              TFF 실제 보유 종목의 배당 지급 주기를 기반으로 집계된 월별 예상 분배금입니다.
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
              <YAxis yAxisId="right" orientation="right" stroke="#818cf8" tick={{ fontSize: 11 }} tickFormatter={(v) => `${Math.round(v)}만`} />
              <Tooltip
                contentStyle={STANDARD_TOOLTIP_STYLE}
                formatter={(val: any, name: any) => [`${Number(val).toLocaleString()}만원`, name]}
              />
              <Legend wrapperStyle={STANDARD_LEGEND_WRAPPER_STYLE} />
              <Bar yAxisId="left" dataKey="totalAmount" name="월간 분배금(만원)" fill="#6366f1" radius={[4, 4, 0, 0]}>
                {monthlyAggregated.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    cursor="pointer"
                    fill={selectedMonthFilter === entry.monthNum ? '#a855f7' : '#6366f1'}
                    onClick={() => setSelectedMonthFilter(entry.monthNum)}
                  />
                ))}
              </Bar>
              <Line yAxisId="right" type="monotone" dataKey="cumulativeAmount" name="누적 분배금(만원)" stroke="#ec4899" strokeWidth={2.5} dot={{ r: 3, fill: '#ec4899' }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 4. 세부 분배금 항목 카드 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Coins className="w-4 h-4 text-amber-400" />
            {selectedMonthFilter === 'ALL' ? `전체 보유 종목 분배금 명세 (${filteredItems.length}건)` : `${selectedMonthFilter}월 분배금 명세 (${filteredItems.length}건)`}
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
                    {item.category}
                  </span>
                </div>
                <div className="text-sm font-bold text-white mb-0.5">
                  {item.assetName}
                </div>
                <div className="text-[11px] text-slate-400 mb-2">
                  보유 평가액: {item.holdingValueManwon.toLocaleString()}만원 ({item.weightPct}%)
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800/60 flex items-baseline justify-between">
                <span className="text-xs text-slate-400">예상 입금액</span>
                <span className="text-base font-extrabold text-amber-400">
                  +{item.estimatedAmountManwon.toLocaleString()}만원
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
