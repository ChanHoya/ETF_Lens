// TFF 10인 공동 펀드 실제 보유 종목 기반 배당·분배금 캘린더 및 1인당 정산 시뮬레이터
'use client';

import React, { useState, useMemo } from 'react';
import { 
  Calendar, DollarSign, TrendingUp, Sparkles, ArrowUpRight, 
  CheckCircle2, AlertCircle, Filter, PieChart, Layers, Download,
  Coins, Landmark, ChevronRight, ShieldCheck, Repeat, Info,
  Users, BarChart3, CalendarDays, Wallet, ArrowRight, Check,
  PiggyBank, Percent, Clock
} from 'lucide-react';
import { 
  ResponsiveContainer, ComposedChart, Bar, Line, 
  XAxis, YAxis, Tooltip, CartesianGrid, Legend, Cell, ReferenceLine
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
function getAssetDistributionProfile(name: string, category: string): { annualYieldPct: number; paymentMonths: number[]; expectedDate: string; isMonthly: boolean } {
  if (category === '배당형') {
    // 월배당 ETF인 경우
    if (name.includes('커버드콜') || name.includes('타겟')) {
      return { annualYieldPct: 9.5, paymentMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], expectedDate: '매월 15~18일', isMonthly: true };
    }
    return { annualYieldPct: 4.2, paymentMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], expectedDate: '매월 2~3일', isMonthly: true };
  }

  if (category === '채권/크레딧') {
    // 만기매칭형 채권 또는 분기 이자
    if (name.includes('26-12') || name.includes('25-12')) {
      return { annualYieldPct: 3.8, paymentMonths: [3, 6, 9, 12], expectedDate: '분기 말일', isMonthly: false };
    }
    return { annualYieldPct: 3.2, paymentMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], expectedDate: '월말 분배금', isMonthly: true };
  }

  if (category === '해외주식형') {
    // S&P 500, 나스닥 등 분기 분배
    return { annualYieldPct: 1.4, paymentMonths: [1, 4, 7, 10], expectedDate: '분기 익월 초', isMonthly: false };
  }

  if (category === '현금/파킹') {
    return { annualYieldPct: 3.0, paymentMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], expectedDate: '월말 이자 누적', isMonthly: true };
  }

  // 국내주식형 (KOSPI 200, 반도체 등: 4월 결산 배당 집중 + 1, 7, 10월 분기 배당)
  return { annualYieldPct: 1.8, paymentMonths: [4, 7, 10], expectedDate: '4월 말(결산), 분기 익월', isMonthly: false };
}

export default function TffDividendCalendar({ data }: Props) {
  const [selectedMonthFilter, setSelectedMonthFilter] = useState<number | 'ALL'>('ALL');
  const [reinvestMode, setReinvestMode] = useState<boolean>(true); // 복리 재투자 모드
  const [memberCount, setMemberCount] = useState<number>(10); // 기본 10인 펀드

  const currentMonthNum = new Date().getMonth() + 1; // 1 ~ 12

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
  const { dividendSchedule, monthlyEtfRatio } = useMemo(() => {
    if (realHoldings.length === 0) return { dividendSchedule: [], monthlyEtfRatio: 0 };

    const items: DividendScheduleItem[] = [];
    const totalVal = realHoldings.reduce((sum, h) => sum + (h.endValue || 0), 0) || 1;
    let monthlyDividendAssetVal = 0;

    realHoldings.forEach((h, hIdx) => {
      const holdingValueManwon = Math.round((h.endValue || 0) / 10000);
      if (holdingValueManwon <= 0) return;

      const weightPct = Number((((h.endValue || 0) / totalVal) * 100).toFixed(1));
      const category = categorizeHolding(h.name);
      const profile = getAssetDistributionProfile(h.name, category);

      if (profile.isMonthly) {
        monthlyDividendAssetVal += (h.endValue || 0);
      }

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

    const ratio = Math.round((monthlyDividendAssetVal / totalVal) * 100);

    return { dividendSchedule: items, monthlyEtfRatio: ratio };
  }, [realHoldings]);

  // 3. 월별 집계 데이터 (Recharts 차트 및 12개월 매트릭스용)
  const monthlyAggregated = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => i + 1);
    let cumulative = 0;

    return months.map(m => {
      const itemsInMonth = dividendSchedule.filter(item => item.month === m);
      const totalInMonth = itemsInMonth.reduce((acc, cur) => acc + cur.estimatedAmountManwon, 0);
      const perMemberInMonth = Math.round((totalInMonth / memberCount) * 10) / 10;
      cumulative += totalInMonth;

      // 대표 입금 종목 3개 추출
      const topItems = [...itemsInMonth]
        .sort((a, b) => b.estimatedAmountManwon - a.estimatedAmountManwon)
        .slice(0, 2);

      return {
        month: `${m}월`,
        monthNum: m,
        totalAmount: totalInMonth,
        perMemberAmount: perMemberInMonth,
        cumulativeAmount: cumulative,
        itemCount: itemsInMonth.length,
        topAssets: topItems.map(it => it.assetName),
        isCurrent: m === currentMonthNum,
      };
    });
  }, [dividendSchedule, memberCount, currentMonthNum]);

  // 연간 핵심 KPI
  const annualTotalManwon = useMemo(() => {
    return dividendSchedule.reduce((acc, cur) => acc + cur.estimatedAmountManwon, 0);
  }, [dividendSchedule]);

  const monthlyAverageManwon = useMemo(() => {
    return Math.round(annualTotalManwon / 12);
  }, [annualTotalManwon]);

  const perMemberAnnualManwon = useMemo(() => {
    return Math.round((annualTotalManwon / memberCount) * 10) / 10;
  }, [annualTotalManwon, memberCount]);

  const perMemberMonthlyAverageManwon = useMemo(() => {
    return Math.round((monthlyAverageManwon / memberCount) * 10) / 10;
  }, [monthlyAverageManwon, memberCount]);

  const portfolioYieldPct = useMemo(() => {
    if (totalPortfolioValueManwon <= 0) return 0;
    return Number(((annualTotalManwon / totalPortfolioValueManwon) * 100).toFixed(2));
  }, [annualTotalManwon, totalPortfolioValueManwon]);

  // 복리 재투자 시뮬레이션 (3년, 5년, 10년)
  const compoundBoostData = useMemo(() => {
    const r = (portfolioYieldPct || 3.5) / 100;
    const baseP = totalPortfolioValueManwon || 10000;
    
    // 단순 현금 인출(0% 재투자) 시 NAV: 기본 자산 가치 유지 가정
    // 100% 재투자(DRIP) 시 NAV: P * (1 + r)^t
    const calcYear = (years: number) => {
      const withDrip = Math.round(baseP * Math.pow(1 + r, years));
      const withoutDrip = baseP;
      const gain = withDrip - withoutDrip;
      const gainPerMember = Math.round((gain / memberCount) * 10) / 10;
      return { years, withDrip, withoutDrip, gain, gainPerMember };
    };

    return [calcYear(3), calcYear(5), calcYear(10)];
  }, [portfolioYieldPct, totalPortfolioValueManwon, memberCount]);

  // [추천 기능] 소외 종목(Underweight) 추가 매수 추천 가이드
  // 포트폴리오 내 비중이 상대적으로 낮거나 안정 배당을 강화할 후보 종목 선정
  const underweightRebalanceTips = useMemo(() => {
    if (realHoldings.length === 0) return [];
    const totalVal = realHoldings.reduce((sum, h) => sum + (h.endValue || 0), 0) || 1;

    return realHoldings
      .map(h => {
        const val = h.endValue || 0;
        const weight = Number(((val / totalVal) * 100).toFixed(1));
        const category = categorizeHolding(h.name);
        return {
          name: h.name,
          category,
          currentWeight: weight,
          valueManwon: Math.round(val / 10000),
        };
      })
      .filter(item => item.category === '배당형' || item.currentWeight < 10)
      .sort((a, b) => a.currentWeight - b.currentWeight)
      .slice(0, 3);
  }, [realHoldings]);

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
        <h3 className="text-lg font-bold text-white mb-1">TFF 보유 종목 데이터가 없습니다.</h3>
        <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
          대시보드 상단에서 TFF 펀드 현황 엑셀을 업로드하면 실제 편입된 보유 종목(ETF/주식/채권)의 실시간 배당·분배금 캘린더가 자동으로 산출됩니다. 비보유 가상 자산은 엄격히 제외됩니다.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      {/* 1. 상단 인트로 헤더 */}
      <div className="p-5 md:p-6 rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-500/20 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                <Users className="w-3 h-3" />
                TFF {memberCount}인 공동 펀드 전용
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                <CheckCircle2 className="w-3 h-3" />
                실보유 {realHoldings.length}종목 100% 매핑
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20">
                <Clock className="w-3 h-3" />
                {latestMonthLabel} 스냅샷 기준
              </span>
            </div>
            <h2 className="text-xl md:text-2xl font-black text-white tracking-tight flex items-center gap-2">
              TFF 펀드 연간 배당·분배금 캘린더 & 1인당 정산 시스템
            </h2>
            <p className="text-xs md:text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed">
              TFF 펀드에 실제 편입된 보유 자산의 12개월 현금흐름 달력 및 {memberCount}인 지분 분배 명세입니다. 배당금 재투자 시 NAV 복리 효과까지 실시간 시뮬레이션합니다.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <div className="flex items-center bg-slate-900/80 border border-slate-700/80 rounded-xl p-1 text-xs">
              <span className="px-2 text-slate-400 font-medium">참여 인원</span>
              <button
                onClick={() => setMemberCount(Math.max(1, memberCount - 1))}
                className="w-6 h-6 rounded-lg bg-slate-800 text-white flex items-center justify-center font-bold hover:bg-slate-700"
              >
                -
              </button>
              <span className="px-2.5 font-extrabold text-amber-300">{memberCount}명</span>
              <button
                onClick={() => setMemberCount(memberCount + 1)}
                className="w-6 h-6 rounded-lg bg-slate-800 text-white flex items-center justify-center font-bold hover:bg-slate-700"
              >
                +
              </button>
            </div>

            <button
              onClick={() => setReinvestMode(!reinvestMode)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 shadow-sm ${
                reinvestMode
                  ? 'bg-indigo-600 text-white border-indigo-500 shadow-indigo-600/30'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
              }`}
            >
              <Repeat className={`w-3.5 h-3.5 ${reinvestMode ? 'text-amber-300 animate-spin-slow' : ''}`} />
              <span>{reinvestMode ? '복리 재투자(DRIP) 모드' : '단순 분배 모드'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. 6대 핵심 KPI 카드 (공동 펀드 총액 + 1인당 배분 지표) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* 연간 펀드 총 배당금 */}
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-sm hover:border-indigo-500/40 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>연간 총 배당금</span>
            <Coins className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="mt-2 text-xl font-extrabold text-white tracking-tight">
            약 {annualTotalManwon.toLocaleString()}만원
          </div>
          <div className="mt-1 flex items-center text-[10px] text-indigo-300 font-medium">
            <TrendingUp className="w-3 h-3 mr-0.5" />
            수익률 연 {portfolioYieldPct}%
          </div>
        </div>

        {/* 1인당 연간 예상 분배금 */}
        <div className="p-4 rounded-2xl bg-indigo-950/30 border border-indigo-500/30 shadow-sm hover:border-indigo-500/60 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-indigo-200">
            <span>1인당 연간 배당</span>
            <Users className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-2 text-xl font-black text-amber-300 tracking-tight">
            약 {perMemberAnnualManwon.toLocaleString()}만원
          </div>
          <div className="mt-1 text-[10px] text-indigo-300/80">
            1인 1/{memberCount} 지분 기준
          </div>
        </div>

        {/* 월평균 펀드 현금흐름 */}
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-sm hover:border-blue-500/40 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>펀드 월평균 유입</span>
            <DollarSign className="w-4 h-4 text-blue-400" />
          </div>
          <div className="mt-2 text-xl font-extrabold text-blue-400 tracking-tight">
            월 {monthlyAverageManwon.toLocaleString()}만원
          </div>
          <div className="mt-1 text-[10px] text-slate-400">
            보유 {realHoldings.length}종목 정기 유입
          </div>
        </div>

        {/* 1인당 월평균 수령액 */}
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-sm hover:border-cyan-500/40 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>1인당 월평균</span>
            <Wallet className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="mt-2 text-xl font-extrabold text-cyan-300 tracking-tight">
            약 {perMemberMonthlyAverageManwon.toLocaleString()}만원
          </div>
          <div className="mt-1 text-[10px] text-cyan-400/80">
            (세후 약 {Math.round(perMemberMonthlyAverageManwon * 0.846 * 10) / 10}만원)
          </div>
        </div>

        {/* 월배당 ETF 비중 */}
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-sm hover:border-emerald-500/40 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>월배당 ETF 비중</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 text-xl font-extrabold text-emerald-400 tracking-tight">
            {monthlyEtfRatio}%
          </div>
          <div className="mt-1 text-[10px] text-emerald-300/80">
            매월 끊김 없는 안정 구조
          </div>
        </div>

        {/* 5년 복리 재투자 NAV 가속도 */}
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-sm hover:border-amber-500/40 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>5년 복리 NAV 가속</span>
            <Sparkles className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-2 text-xl font-extrabold text-amber-400 tracking-tight">
            +{compoundBoostData[1]?.gain.toLocaleString()}만원
          </div>
          <div className="mt-1 text-[10px] text-amber-300/80">
            1인당 +{compoundBoostData[1]?.gainPerMember.toLocaleString()}만원 창출
          </div>
        </div>
      </div>

      {/* 3. 2열 메인 레이아웃: 좌측 1~12월 캐시플로우 바 차트 vs 우측 12개월 연간 캘린더 매트릭스 (4x3 그리드) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* 좌측: 1~12월 월별 예상 배당금 차트 (7 cols) */}
        <div className="lg:col-span-7 p-5 md:p-6 rounded-3xl bg-slate-950 border border-slate-800/80 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-indigo-400" />
                <h3 className="text-sm md:text-base font-bold text-white">
                  1~12월 월별 예상 배당금 차트 (Monthly Cashflow)
                </h3>
              </div>
              <span className="text-xs text-slate-400">
                펀드 월평균: <span className="text-cyan-300 font-bold">{monthlyAverageManwon.toLocaleString()}만원</span> (1인당 {perMemberMonthlyAverageManwon.toLocaleString()}만원)
              </span>
            </div>

            <div className="h-64 md:h-72 w-full mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={monthlyAggregated} margin={{ top: 15, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} vertical={false} />
                  <XAxis dataKey="month" stroke="#94a3b8" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="left" stroke="#94a3b8" tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}만`} />
                  <YAxis yAxisId="right" orientation="right" stroke="#818cf8" tick={{ fontSize: 10 }} tickFormatter={(v) => `${Math.round(v)}만`} />
                  <Tooltip
                    contentStyle={STANDARD_TOOLTIP_STYLE}
                    formatter={(val: any, name: any) => {
                      if (name === '펀드 분배금(만원)') {
                        const num = Number(val);
                        const perMem = Math.round((num / memberCount) * 10) / 10;
                        return [`${num.toLocaleString()}만원 (1인당 ${perMem}만원)`, name];
                      }
                      return [`${Number(val).toLocaleString()}만원`, name];
                    }}
                  />
                  <Legend wrapperStyle={STANDARD_LEGEND_WRAPPER_STYLE} />
                  <ReferenceLine
                    yAxisId="left"
                    y={monthlyAverageManwon}
                    stroke="#06b6d4"
                    strokeDasharray="4 4"
                    label={{ value: '월평균', position: 'top', fill: '#06b6d4', fontSize: 10 }}
                  />
                  <Bar yAxisId="left" dataKey="totalAmount" name="펀드 분배금(만원)" radius={[4, 4, 0, 0]}>
                    {monthlyAggregated.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        cursor="pointer"
                        fill={
                          entry.monthNum === selectedMonthFilter
                            ? '#a855f7'
                            : entry.isCurrent
                            ? '#10b981'
                            : entry.totalAmount >= monthlyAverageManwon
                            ? '#6366f1'
                            : '#334155'
                        }
                        onClick={() => setSelectedMonthFilter(entry.monthNum)}
                      />
                    ))}
                  </Bar>
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="cumulativeAmount"
                    name="누적 분배금(만원)"
                    stroke="#ec4899"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: '#ec4899' }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-[11px] text-gray-400 mt-3 border-t border-white/5 pt-3">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" /> 이번 달 ({currentMonthNum}월)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-indigo-500 inline-block" /> 평균 이상 수령월
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-slate-700 inline-block" /> 평균 미만 수령월
            </span>
            <span className="flex items-center gap-1.5 text-purple-400">
              <span className="w-2.5 h-2.5 rounded-sm bg-purple-500 inline-block" /> 선택된 월
            </span>
          </div>
        </div>

        {/* 우측: 연간 배당 캘린더 매트릭스 (4x3 미니 그리드, 5 cols) */}
        <div className="lg:col-span-5 p-5 md:p-6 rounded-3xl bg-slate-950 border border-slate-800/80 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm md:text-base font-bold text-white">
                  연간 배당 캘린더 매트릭스
                </h3>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setSelectedMonthFilter('ALL')}
                  className={`text-[11px] px-2 py-0.5 rounded-md font-semibold transition-all ${
                    selectedMonthFilter === 'ALL'
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-400 hover:text-white bg-slate-800'
                  }`}
                >
                  전체보기
                </button>
                <span className="text-[11px] text-gray-500 font-mono">1년 로드맵</span>
              </div>
            </div>
            <p className="text-[11px] text-slate-400 mb-3">
              원하는 월을 클릭하면 하단 세부 종목별 분배 명세가 즉시 필터링됩니다.
            </p>

            {/* 4행 3열 그리드 */}
            <div className="grid grid-cols-3 gap-2">
              {monthlyAggregated.map((mItem) => {
                const isSelected = selectedMonthFilter === mItem.monthNum;
                const isCurrent = mItem.isCurrent;

                return (
                  <button
                    key={mItem.monthNum}
                    type="button"
                    onClick={() => setSelectedMonthFilter(isSelected ? 'ALL' : mItem.monthNum)}
                    className={`p-2.5 rounded-xl border text-left transition-all relative flex flex-col justify-between min-h-[76px] cursor-pointer ${
                      isSelected
                        ? 'bg-purple-950/40 border-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.3)]'
                        : isCurrent
                        ? 'bg-emerald-950/30 border-emerald-500/60 shadow-[0_0_12px_rgba(16,185,129,0.2)]'
                        : mItem.totalAmount >= monthlyAverageManwon
                        ? 'bg-slate-900/80 border-indigo-500/30 hover:border-indigo-500/60'
                        : 'bg-slate-900/40 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className={`text-xs font-black ${isCurrent ? 'text-emerald-400' : 'text-slate-200'}`}>
                        {mItem.month}
                      </span>
                      {isCurrent && (
                        <span className="text-[9px] bg-emerald-500/20 text-emerald-300 font-bold px-1.5 py-0.2 rounded-full border border-emerald-500/30">
                          이번달
                        </span>
                      )}
                    </div>

                    <div className="my-1">
                      <div className="text-sm font-black text-white leading-tight">
                        {mItem.totalAmount.toLocaleString()}만
                      </div>
                      <div className="text-[10px] text-amber-300/90 font-medium">
                        1인 {mItem.perMemberAmount}만
                      </div>
                    </div>

                    {/* 대표 종목 태그 */}
                    <div className="flex items-center gap-1 overflow-hidden text-[9px] text-slate-400 truncate">
                      {mItem.topAssets.length > 0 ? (
                        <>
                          <span className="truncate max-w-[65px] bg-white/5 px-1 py-0.5 rounded text-slate-300">
                            {mItem.topAssets[0].replace('TIGER ', '').replace('KODEX ', '').slice(0, 5)}..
                          </span>
                          {mItem.itemCount > 1 && (
                            <span className="text-[9px] text-indigo-400 shrink-0 font-bold">
                              +{mItem.itemCount - 1}
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-slate-500">-</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
            <span>연간 누적 총액</span>
            <span className="text-white font-extrabold">{annualTotalManwon.toLocaleString()}만원 (1인 {perMemberAnnualManwon.toLocaleString()}만원)</span>
          </div>
        </div>
      </div>

      {/* 4. TFF 공동 펀드 전용: 배당금 100% 재투자 시 NAV 복리 가속도 시뮬레이터 */}
      <div className="p-5 md:p-6 rounded-3xl bg-gradient-to-br from-indigo-950/40 via-slate-900 to-slate-950 border border-indigo-500/30 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <h3 className="text-base font-extrabold text-white">
                TFF {memberCount}인 펀드 배당 재투자(DRIP) 복리 가속도 시뮬레이션
              </h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              매월 유입되는 배당·분배금을 현금 인출하지 않고 펀드에 100% 자동 재투자할 경우, 복리 효과로 창출되는 미래 NAV 초과 수익입니다.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs text-indigo-300 bg-indigo-900/30 px-3 py-1.5 rounded-xl border border-indigo-500/20">
            <PiggyBank className="w-4 h-4 text-amber-300" />
            <span>적용 배당수익률 연 {portfolioYieldPct}% 복리 롤오버</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
          {compoundBoostData.map(item => (
            <div
              key={item.years}
              className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-indigo-500/50 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    {item.years}년 후 복리 결과
                  </span>
                  <span className="text-xs font-black text-emerald-400">
                    +{Math.round(((item.withDrip - item.withoutDrip) / item.withoutDrip) * 100)}% 초과 성장
                  </span>
                </div>
                <div className="space-y-1.5 my-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">단순 수취(재투자 無) NAV</span>
                    <span className="text-slate-300 font-semibold">{item.withoutDrip.toLocaleString()}만원</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-indigo-300 font-bold">100% 재투자 시 NAV</span>
                    <span className="text-white font-extrabold text-sm">{item.withDrip.toLocaleString()}만원</span>
                  </div>
                </div>
              </div>

              <div className="pt-2.5 border-t border-slate-800/80 flex items-center justify-between">
                <span className="text-[11px] text-amber-300 font-medium">1인당 추가 자산 가치</span>
                <span className="text-base font-black text-amber-400">
                  +{item.gainPerMember.toLocaleString()}만원
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 5. [추천 기능] 스마트 리밸런싱: 배당 현금 유입 시 소외 종목(Underweight) 추가 매수 추천 배분 가이드 */}
      <div className="p-5 md:p-6 rounded-3xl bg-slate-950 border border-slate-800/80 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <Landmark className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm md:text-base font-bold text-white">
                💡 TFF 운용 팁: 월별 배당 현금 재투자 추천 배분 가이드
              </h3>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              정기적으로 입금되는 배당 현금(월평균 약 {monthlyAverageManwon.toLocaleString()}만원)으로 펀드 내 비중 미달(Underweight) 종목을 분할 매수하여 포트폴리오를 견고하게 리밸런싱합니다.
            </p>
          </div>
          <span className="text-[11px] text-emerald-400 font-semibold bg-emerald-950/40 border border-emerald-500/30 px-2.5 py-1 rounded-full">
            DCA 자동 분할 매수 권장
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {underweightRebalanceTips.map((tip, idx) => (
            <div key={idx} className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800/80 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-bold text-indigo-300">
                    추천 순위 #{idx + 1}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                    현재 비중 {tip.currentWeight}%
                  </span>
                </div>
                <div className="text-sm font-bold text-white truncate mb-1">
                  {tip.name}
                </div>
                <p className="text-[11px] text-slate-400 leading-snug">
                  현재 보유 평가액 {tip.valueManwon.toLocaleString()}만원. 배당 입금액의 30~40%를 분할 재투자하여 안정적 현금흐름 강화 추천.
                </p>
              </div>

              <div className="mt-2.5 pt-2 border-t border-slate-800/60 flex items-center justify-between text-xs">
                <span className="text-slate-400">월 권장 재매수액</span>
                <span className="text-emerald-300 font-bold">
                  약 {Math.round(monthlyAverageManwon * (idx === 0 ? 0.4 : idx === 1 ? 0.35 : 0.25))}만원
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 6. 세부 분배금 종목별 명세 테이블/그리드 */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Coins className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm md:text-base font-bold text-white">
              {selectedMonthFilter === 'ALL'
                ? `전체 연간 분배금 종목별 세부 명세 (${filteredItems.length}건)`
                : `${selectedMonthFilter}월 분배금 종목별 세부 명세 (${filteredItems.length}건)`}
            </h3>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400">
              필터 합계: <span className="text-white font-black">{filteredItems.reduce((acc, cur) => acc + cur.estimatedAmountManwon, 0).toLocaleString()}만원</span>
            </span>
            <span className="text-indigo-400 font-bold">
              (1인당 {Math.round((filteredItems.reduce((acc, cur) => acc + cur.estimatedAmountManwon, 0) / memberCount) * 10) / 10}만원)
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredItems.map(item => {
            const perMem = Math.round((item.estimatedAmountManwon / memberCount) * 10) / 10;
            return (
              <div
                key={item.id}
                className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-indigo-500/40 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-200">
                      {item.month}월 입금 ({item.expectedDate})
                    </span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${item.badgeColor}`}>
                      {item.category}
                    </span>
                  </div>
                  <div className="text-sm font-bold text-white mb-1 leading-snug">
                    {item.assetName}
                  </div>
                  <div className="text-[11px] text-slate-400 mb-2">
                    보유 평가액 {item.holdingValueManwon.toLocaleString()}만원 (포트폴리오 {item.weightPct}%)
                  </div>
                </div>

                <div className="pt-2.5 border-t border-slate-800/80 flex items-baseline justify-between">
                  <div>
                    <span className="text-[11px] text-slate-400 block">펀드 유입 / 1인 배분</span>
                    <span className="text-[10px] text-slate-500">15.4% 배당소득세 과세 대상</span>
                  </div>
                  <div className="text-right">
                    <div className="text-base font-extrabold text-amber-400">
                      +{item.estimatedAmountManwon.toLocaleString()}만원
                    </div>
                    <div className="text-xs font-bold text-indigo-300">
                      1인 약 {perMem.toLocaleString()}만원
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
