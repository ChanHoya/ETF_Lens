"use client";

import React, { useState } from 'react';
import { TffMonthInfo } from '../../../lib/tff/types';
import { Wallet, PieChart, ArrowUpRight, ArrowDownRight, TrendingUp, TrendingDown, DollarSign, Calendar, Compass, Layers, Percent } from 'lucide-react';

interface Props {
  data: TffMonthInfo;
  onOpenDetail?: (code: string) => void;
  titleRightElement?: React.ReactNode;
}

export default function MonthlyView({ data, onOpenDetail, titleRightElement }: Props) {
  const { period, summary, holdings } = data;
  const [selectedType, setSelectedType] = useState<string>('전체');

  if (!holdings || holdings.length === 0) {
    return <div className="text-gray-400 py-12 text-center">데이터가 없습니다. ({period})</div>;
  }

  const formatMoney = (val: number) => new Intl.NumberFormat('ko-KR').format(Math.round(val));

  const FILTER_TYPES = [
    { label: '전체 자산', value: '전체' },
    { label: '국내 주식', value: '국내주식형' },
    { label: '미국 주식', value: '미국주식형' },
    { label: '채권형', value: '채권형' },
    { label: '대체자산', value: '대체자산형' },
    { label: '신흥국형', value: '신흥국형' }
  ];

  const categorizeAsset = (name: string) => {
    if (name.includes("금현물") || name.includes("은현물") || name.includes("원자재") || name.includes("골드") || name.includes("구리") || name.includes("원유")) {
      return '대체자산형';
    } else if (name.includes("채권") || name.includes("국고채") || name.includes("국채") || name.includes("회사채") || name.includes("종합채권")) {
      return '채권형';
    } else if (name.includes("머니마켓") || name.includes("CD") || name.includes("KOFR") || name.includes("현금") || name.includes("단기자금") || name.includes("파킹")) {
      return '현금/파킹형';
    } else if (name.includes("차이나") || name.includes("항셍") || name.includes("인도") || name.includes("베트남") || name.includes("EM")) {
      return '신흥국형';
    } else if (name.includes("미국") || name.includes("S&P") || name.includes("나스닥") || name.includes("다우") || name.includes("필라델피아") || name.includes("테크") || name.includes("글로벌")) {
      return '미국주식형';
    } else {
      return '국내주식형';
    }
  };

  const filteredHoldings = holdings.filter(h => {
    if (selectedType === '전체') return true;
    if (selectedType === '채권형') return categorizeAsset(h.name) === '채권형';
    return categorizeAsset(h.name) === selectedType;
  });

  // Calculate filtered stats
  const totalPnl = filteredHoldings.reduce((sum, h) => sum + (h.investmentPnl || 0), 0);
  const totalEnd = filteredHoldings.reduce((sum, h) => sum + (h.endValue || 0), 0);
  const totalBegin = filteredHoldings.reduce((sum, h) => sum + (h.beginValue || 0), 0);
  const totalBuy = filteredHoldings.reduce((sum, h) => sum + (h.buyAmount || 0), 0);
  const totalSell = filteredHoldings.reduce((sum, h) => sum + (h.sellAmount || 0), 0);

  const returnPct = totalBegin + totalBuy > 0 
    ? (totalPnl / (totalBegin + totalBuy - totalSell)) * 100 
    : 0;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* View Header with Selector */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-black/20 p-4 rounded-2xl border border-white/5 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-sky-500/20 shrink-0">
            <Calendar className="w-5 h-5 text-white" />
          </div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-extrabold text-white">
              {period} 월별 운용 현황
            </h3>
            {titleRightElement}
          </div>
        </div>
        
        {/* Class Filters */}
        <div className="flex items-center flex-wrap gap-1.5">
          {FILTER_TYPES.map(filter => (
            <button
              key={filter.value}
              onClick={() => setSelectedType(filter.value)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                selectedType === filter.value 
                  ? 'bg-gradient-to-r from-sky-500 to-indigo-600 text-white shadow-md' 
                  : 'bg-[#1a1a23]/60 text-gray-400 hover:bg-white/5 hover:text-gray-200 border border-white/5'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {/* Cashflow & Carryover Banner (Only for Total view) */}
      {selectedType === '전체' && summary.carryoverBalance > 0 && (
        <div className="bg-gradient-to-r from-[#1e1b4b]/30 to-[#311042]/20 p-4 rounded-2xl border border-white/5 flex flex-wrap gap-6 xl:gap-8 justify-between items-center text-sm backdrop-blur-sm relative overflow-hidden">
          <div className="absolute right-0 top-0 opacity-[0.03] scale-150"><Compass className="w-24 h-24" /></div>
          
          <div className="flex flex-wrap gap-6 md:gap-8">
            <div>
              <span className="text-gray-500 block text-[10px] font-bold uppercase mb-0.5">이월 잔고</span>
              <strong className="text-gray-300 font-bold text-sm">{formatMoney(summary.carryoverBalance)} 원</strong>
            </div>
            <div className="border-l border-white/5 pl-6">
              <span className="text-sky-400/80 block text-[10px] font-bold uppercase mb-0.5">당월 입금액</span>
              <strong className="text-sky-400 font-bold text-sm">+{formatMoney(summary.deposit)} 원</strong>
            </div>
            <div className="border-l border-white/5 pl-6">
              <span className="text-pink-400/80 block text-[10px] font-bold uppercase mb-0.5">당월 출금액</span>
              <strong className="text-pink-400 font-bold text-sm">-{formatMoney(summary.withdrawal)} 원</strong>
            </div>
          </div>
          
          <div className="border-t md:border-t-0 md:border-l border-white/5 pt-3 md:pt-0 md:pl-8 flex flex-col items-start md:items-end">
            <span className="text-indigo-400 block text-[10px] font-black uppercase mb-0.5">종합 예수금 잔고</span>
            <strong className="text-indigo-300 text-lg font-black tracking-tight">{formatMoney(summary.totalBalance)} 원</strong>
          </div>
        </div>
      )}

      {/* Bento Summary Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="bg-[#1a1a23]/40 p-4 rounded-2xl border border-white/5 relative overflow-hidden backdrop-blur-sm">
          <div className="absolute top-3 right-3 text-gray-600 opacity-20"><Layers className="w-8 h-8" /></div>
          <p className="text-xs text-gray-400 mb-1 font-bold">기초 평가금액</p>
          <h4 className="text-xl font-black text-white">{formatMoney(totalBegin)} 원</h4>
          <p className="text-[10px] text-gray-500 mt-1">월초 자산 총량</p>
        </div>

        <div className="bg-[#1a1a23]/40 p-4 rounded-2xl border border-white/5 relative overflow-hidden backdrop-blur-sm">
          <div className="absolute top-3 right-3 text-sky-500 opacity-10"><DollarSign className="w-8 h-8" /></div>
          <p className="text-xs text-gray-400 mb-1 font-bold">당월 순매수 규모</p>
          <h4 className="text-xl font-black text-sky-400">
            {totalBuy - totalSell >= 0 ? '+' : ''}{formatMoney(totalBuy - totalSell)} 원
          </h4>
          <p className="text-[10px] text-gray-500 mt-1">매수 {formatMoney(totalBuy)} | 매도 {formatMoney(totalSell)}</p>
        </div>

        <div className="bg-[#1a1a23]/40 p-4 rounded-2xl border border-white/5 relative overflow-hidden backdrop-blur-sm">
          <div className="absolute top-3 right-3 text-indigo-500 opacity-10"><Wallet className="w-8 h-8" /></div>
          <p className="text-xs text-gray-400 mb-1 font-bold">기말 평가금액</p>
          <h4 className="text-xl font-black text-indigo-300">{formatMoney(totalEnd)} 원</h4>
          <p className="text-[10px] text-gray-500 mt-1">월말 자산 총량</p>
        </div>

        <div className={`p-4 rounded-2xl border relative overflow-hidden backdrop-blur-sm ${
          totalPnl >= 0 
            ? 'bg-emerald-500/5 border-emerald-500/20' 
            : 'bg-rose-500/5 border-rose-500/20'
        }`}>
          <div className="absolute top-3 right-3 text-emerald-500 opacity-10"><Percent className="w-8 h-8" /></div>
          <p className="text-xs text-gray-400 mb-1 font-bold">당월 투자 성과</p>
          <div className="flex items-baseline gap-2">
            <h4 className={`text-2xl font-black ${totalPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {totalPnl >= 0 ? '+' : ''}{formatMoney(totalPnl)} 원
            </h4>
            <span className={`text-xs font-black px-1.5 py-0.5 rounded ${
              totalPnl >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
            }`}>
              {totalPnl >= 0 ? '+' : ''}{returnPct.toFixed(2)}%
            </span>
          </div>
          <p className="text-[10px] text-gray-500 mt-1">당월 자산 투입 대비 손익</p>
        </div>
      </div>

      {/* holdings card list */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredHoldings.map((h, idx) => {
          const isProfit = (h.investmentPnl || 0) >= 0;
          const assetClass = categorizeAsset(h.name);
          
          let badgeColor = 'bg-blue-500/10 text-blue-400 border-blue-500/20';
          if (assetClass === '미국주식형') badgeColor = 'bg-purple-500/10 text-purple-400 border-purple-500/20';
          else if (assetClass === '채권형') badgeColor = 'bg-amber-500/10 text-amber-400 border-amber-500/20';
          else if (assetClass === '대체자산형') badgeColor = 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
          else if (assetClass === '신흥국형') badgeColor = 'bg-pink-500/10 text-pink-400 border-pink-500/20';

          return (
            <div 
              key={idx}
              className="bg-[#1a1a23]/30 border border-white/5 hover:border-white/15 hover:bg-white/[0.03] rounded-2xl p-4 transition-all duration-300 shadow-lg flex flex-col justify-between group relative overflow-hidden"
            >
              {/* Card Background Glow */}
              <div className="absolute -inset-px bg-gradient-to-br from-white/0 via-white/0 to-white/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

              <div>
                {/* Header: Class Badge & Code */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-black border ${badgeColor}`}>
                    {assetClass}
                  </span>
                  {h.code && (
                    <span className="text-[10px] text-gray-500 font-mono font-bold tracking-wider">{h.code}</span>
                  )}
                </div>

                {/* Asset Name */}
                <div className="mb-4">
                  {onOpenDetail && h.code ? (
                    <button 
                      onClick={() => onOpenDetail(h.code!)}
                      className="text-sm font-bold text-white hover:text-sky-400 transition-colors text-left focus:outline-none"
                    >
                      {h.name}
                    </button>
                  ) : (
                    <h5 className="text-sm font-bold text-white leading-snug">{h.name}</h5>
                  )}
                </div>

                {/* Values Comparison */}
                <div className="grid grid-cols-2 gap-3 bg-black/20 p-2.5 rounded-xl border border-white/5 text-[11px] mb-4">
                  <div>
                    <span className="text-gray-500 block">기초 (월초)</span>
                    <strong className="text-gray-300 font-bold">{formatMoney(h.beginValue)} 원</strong>
                  </div>
                  <div>
                    <span className="text-gray-500 block">기말 (월말)</span>
                    <strong className="text-white font-black">{formatMoney(h.endValue)} 원</strong>
                  </div>
                </div>

                {/* Flow indicators */}
                <div className="flex items-center justify-between text-[11px] text-gray-400 border-b border-white/5 pb-3 mb-3">
                  <div className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                    <span>순매수: <strong>{formatMoney(h.buyAmount - h.sellAmount)} 원</strong></span>
                  </div>
                  {(h.dividend > 0) && (
                    <div className="flex items-center gap-1 text-indigo-300">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                      <span>분배금: <strong>{formatMoney(h.dividend)} 원</strong></span>
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom: Profit and Loss indicator */}
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-1">
                  {isProfit ? (
                    <span className="inline-flex items-center text-[10px] font-black text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/10">
                      <ArrowUpRight className="w-3 h-3 mr-0.5" />수익
                    </span>
                  ) : (
                    <span className="inline-flex items-center text-[10px] font-black text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-lg border border-rose-500/10">
                      <ArrowDownRight className="w-3 h-3 mr-0.5" />손실
                    </span>
                  )}
                </div>

                <div className="text-right">
                  <span className="text-[10px] text-gray-500 block">당월 성과</span>
                  <span className={`text-sm font-black font-mono ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {isProfit ? '+' : ''}{formatMoney(h.investmentPnl)} 원
                  </span>
                </div>
              </div>

            </div>
          );
        })}
      </div>

    </div>
  );
}
