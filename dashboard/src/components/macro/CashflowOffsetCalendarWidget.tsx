// 가계 고정지출·대출 원리금과 월별 ETF 배당금 자동 상계 순 캐시플로우 타임라인 위젯
'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { 
  DollarSign, TrendingUp, TrendingDown, Calendar, ShieldCheck, 
  AlertCircle, Sparkles, Building2, CreditCard, ChevronRight,
  PiggyBank, ArrowRight, RefreshCw, CheckCircle2
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  ReferenceLine
} from 'recharts';

interface CashflowOffsetCalendarWidgetProps {
  monthlyDividendWon?: number[]; // 1월~12월 월별 배당금 (원)
}

export default function CashflowOffsetCalendarWidget({
  monthlyDividendWon
}: CashflowOffsetCalendarWidgetProps) {
  // 기본 월 고정지출 항목 (단위: 만 원)
  const [mortgagePayment, setMortgagePayment] = useState<number>(145); // 주담대 원리금 (145만)
  const [creditLoanInterest, setCreditLoanInterest] = useState<number>(25); // 신용대출 이자 (25만)
  const [maintenanceFee, setMaintenanceFee] = useState<number>(30); // 아파트 관리비 (30만)
  const [insuranceCost, setInsuranceCost] = useState<number>(20); // 필수 보장성 보험료 (20만)

  // 기본 배당금 (전달되지 않았을 경우 KIS 기본값: 연 2,400만 원, 월평균 약 200만 원)
  const defaultMonthlyDividends = [
    1800000, 2400000, 1950000, 3100000, 1750000, 2200000,
    1850000, 2600000, 1900000, 2800000, 1700000, 3200000
  ];

  const actualDividends = monthlyDividendWon && monthlyDividendWon.length === 12
    ? monthlyDividendWon
    : defaultMonthlyDividends;

  // 총 월 고정지출 (원)
  const totalMonthlyExpenseWon = (mortgagePayment + creditLoanInterest + maintenanceFee + insuranceCost) * 10_000;

  // 12개월 월별 상계 데이터 생성
  const cashflowData = useMemo(() => {
    const months = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
    let runningNetWon = 0;

    return months.map((m, idx) => {
      const divWon = actualDividends[idx];
      const netWon = divWon - totalMonthlyExpenseWon;
      runningNetWon += netWon;
      const coverageRatio = totalMonthlyExpenseWon > 0 ? (divWon / totalMonthlyExpenseWon) * 100 : 100;

      return {
        month: m,
        dividend: Math.round(divWon / 10_000), // 만 원 단위
        expense: Math.round(totalMonthlyExpenseWon / 10_000),
        net: Math.round(netWon / 10_000),
        netWon,
        cumulativeNet: Math.round(runningNetWon / 10_000),
        coverageRatio: Math.round(coverageRatio)
      };
    });
  }, [actualDividends, totalMonthlyExpenseWon]);

  // 연간 누계 통계
  const annualStats = useMemo(() => {
    const totalDiv = actualDividends.reduce((a, b) => a + b, 0);
    const totalExp = totalMonthlyExpenseWon * 12;
    const netSurplus = totalDiv - totalExp;
    const avgCoverage = totalExp > 0 ? (totalDiv / totalExp) * 100 : 100;
    const surplusMonths = cashflowData.filter(d => d.net >= 0).length;

    return {
      totalDiv,
      totalExp,
      netSurplus,
      avgCoverage,
      surplusMonths
    };
  }, [actualDividends, totalMonthlyExpenseWon, cashflowData]);

  const fmtWon = (v: number) => (Math.round(v / 10_000)).toLocaleString() + '만 원';

  return (
    <div className="w-full bg-[#151726]/90 border border-white/10 rounded-2xl p-5 shadow-xl space-y-5">
      
      {/* 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <PiggyBank className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white tracking-tight">
                가계 고정지출 vs 월 배당금 자동 상계 순 캐시플로우 타임라인
              </h3>
              <span className="text-[10px] font-bold text-emerald-300 bg-emerald-500/20 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                자본소득 상계율 {annualStats.avgCoverage.toFixed(0)}%
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              주담대 원리금과 필수 고정지출을 KIS 배당금으로 100% 자동 방어하고 남는 순 잉여금을 시뮬레이션합니다.
            </p>
          </div>
        </div>

        {/* 연간 순 잉여금 칩 */}
        <div className="flex items-center gap-3 bg-black/40 border border-white/5 px-3 py-1.5 rounded-xl shrink-0">
          <div>
            <span className="text-[10px] text-gray-500 block">연간 배당 후 순 잉여금</span>
            <span className={`text-sm font-black font-mono ${annualStats.netSurplus >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {annualStats.netSurplus >= 0 ? '+' : ''}{fmtWon(annualStats.netSurplus)}
            </span>
          </div>
          <span className={`text-xs px-2 py-0.5 rounded font-bold ${
            annualStats.netSurplus >= 0 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
          }`}>
            {annualStats.surplusMonths}/12개월 흑자
          </span>
        </div>
      </div>

      {/* 고정지출 입력 슬라이더 컨트롤러 (4종) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white/[0.02] border border-white/5 rounded-xl p-3.5">
        <div className="space-y-1">
          <div className="flex justify-between items-center text-xs">
            <span className="text-gray-400 flex items-center gap-1 text-[11px]">
              <Building2 className="w-3 h-3 text-amber-400" />
              주담대 원리금
            </span>
            <span className="font-bold text-amber-300 font-mono text-[11px]">{mortgagePayment}만</span>
          </div>
          <input 
            type="range" min={0} max={300} step={5}
            value={mortgagePayment} onChange={(e) => setMortgagePayment(Number(e.target.value))}
            className="w-full accent-amber-500 h-1 bg-white/10 rounded cursor-pointer"
          />
        </div>

        <div className="space-y-1">
          <div className="flex justify-between items-center text-xs">
            <span className="text-gray-400 flex items-center gap-1 text-[11px]">
              <CreditCard className="w-3 h-3 text-purple-400" />
              신용대출 이자
            </span>
            <span className="font-bold text-purple-300 font-mono text-[11px]">{creditLoanInterest}만</span>
          </div>
          <input 
            type="range" min={0} max={100} step={5}
            value={creditLoanInterest} onChange={(e) => setCreditLoanInterest(Number(e.target.value))}
            className="w-full accent-purple-500 h-1 bg-white/10 rounded cursor-pointer"
          />
        </div>

        <div className="space-y-1">
          <div className="flex justify-between items-center text-xs">
            <span className="text-gray-400 text-[11px]">아파트 관리비</span>
            <span className="font-bold text-sky-300 font-mono text-[11px]">{maintenanceFee}만</span>
          </div>
          <input 
            type="range" min={10} max={80} step={5}
            value={maintenanceFee} onChange={(e) => setMaintenanceFee(Number(e.target.value))}
            className="w-full accent-sky-500 h-1 bg-white/10 rounded cursor-pointer"
          />
        </div>

        <div className="space-y-1">
          <div className="flex justify-between items-center text-xs">
            <span className="text-gray-400 text-[11px]">필수 보험료</span>
            <span className="font-bold text-indigo-300 font-mono text-[11px]">{insuranceCost}만</span>
          </div>
          <input 
            type="range" min={0} max={60} step={5}
            value={insuranceCost} onChange={(e) => setInsuranceCost(Number(e.target.value))}
            className="w-full accent-indigo-500 h-1 bg-white/10 rounded cursor-pointer"
          />
        </div>
      </div>

      {/* Recharts 상계 타임라인 차트 */}
      <div className="p-4 rounded-xl bg-black/40 border border-white/5 space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-gray-300">
            월별 배당금 유입(초록 막대) vs 고정지출 유출(회색 점선) 및 순 잉여금(자주색 꺾은선)
          </span>
          <div className="flex items-center gap-4 text-[11px]">
            <span className="flex items-center gap-1 text-emerald-400">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" />
              배당금 유입
            </span>
            <span className="flex items-center gap-1 text-rose-400">
              <span className="w-2.5 h-0.5 bg-rose-400 inline-block border-t border-dashed" />
              고정지출 유출
            </span>
            <span className="flex items-center gap-1 text-indigo-400">
              <span className="w-2.5 h-1 rounded bg-indigo-400 inline-block" />
              월 순 잉여금
            </span>
          </div>
        </div>

        <div className="h-[220px] w-full pt-1">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={cashflowData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
              <XAxis dataKey="month" stroke="#6b7280" fontSize={11} tickLine={false} />
              <YAxis stroke="#6b7280" fontSize={11} tickLine={false} tickFormatter={(v) => `${v}만`} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#161a25', 
                  borderColor: '#ffffff20',
                  borderRadius: '8px',
                  fontSize: '11px',
                  color: '#fff'
                }}
                formatter={(val: any, name: any) => {
                  if (name === 'dividend') return [`${val}만 원`, '배당금 유입'];
                  if (name === 'expense') return [`${val}만 원`, '고정지출'];
                  if (name === 'net') return [`${val > 0 ? '+' : ''}${val}만 원`, '순 잉여금'];
                  return [val, name];
                }}
              />
              <ReferenceLine y={0} stroke="#ffffff30" />
              <Bar dataKey="dividend" fill="#10b981" radius={[4, 4, 0, 0]} barSize={16} />
              <Line 
                type="monotone" 
                dataKey="expense" 
                stroke="#f43f5e" 
                strokeWidth={2} 
                strokeDasharray="4 4" 
                dot={false}
              />
              <Line 
                type="monotone" 
                dataKey="net" 
                stroke="#818cf8" 
                strokeWidth={2.5} 
                dot={{ r: 3, fill: '#818cf8', strokeWidth: 1 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 진단 가이드 한 줄 */}
      <div className="flex items-center justify-between text-xs text-gray-400 pt-1">
        <div className="flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>
            {annualStats.avgCoverage >= 100
              ? '완전 자립: 연간 배당금이 모든 가계 대출이자 및 관리비를 100% 초과 상계하고 있습니다.'
              : `부분 방어: 현재 배당금으로 고정지출의 ${annualStats.avgCoverage.toFixed(0)}%를 방어 중이며, 배당 성장 ETF 추가 편입이 권장됩니다.`}
          </span>
        </div>
        <span className="font-mono text-[11px] text-indigo-300">
          월평균 고정지출 {fmtWon(totalMonthlyExpenseWon)}
        </span>
      </div>

    </div>
  );
}
