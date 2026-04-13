import React, { useState } from 'react';
import { TffMonthInfo } from '../../../lib/tff/types';
import { Wallet, PieChart, ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface Props {
  data: TffMonthInfo;
  title?: string;
  onOpenDetail?: (code: string) => void;
  titleRightElement?: React.ReactNode;
}

export default function PortfolioDetailView({ data, title, onOpenDetail, titleRightElement }: Props) {
  const { period, summary, holdings } = data;
  const [selectedType, setSelectedType] = useState<string>('전체');

  if (!holdings || holdings.length === 0) {
    return <div className="text-gray-400">데이터가 없습니다. ({period})</div>;
  }

  const formatMoney = (val: number) => new Intl.NumberFormat('ko-KR').format(Math.round(val));

  const FILTER_TYPES = [
      { label: '전체', value: '전체' },
      { label: '국내주식형', value: '국내주식형' },
      { label: '미국주식형', value: '미국주식형' },
      { label: '국내채권형', value: '국내채권형' },
      { label: '미국채권형', value: '미국채권형' },
      { label: '신흥국형', value: '신흥국형' },
      { label: '대체자산형', value: '대체자산형' }
  ];

  const categorizeAsset = (name: string) => {
      if (name.includes("금현물") || name.includes("은현물") || name.includes("원자재") || name.includes("골드") || name.includes("구리") || name.includes("원유")) {
          return '대체자산형';
      } else if (name.includes("채권") || name.includes("국고채") || name.includes("국채") || name.includes("회사채") || name.includes("종합채권")) {
          if (name.includes("미국") || name.includes("US")) return '미국채권형';
          return '국내채권형';
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
      return categorizeAsset(h.name) === selectedType;
  });

  const displaySummary = selectedType === '전체' ? summary : {
      totalBeginValue: filteredHoldings.reduce((sum, h) => sum + (h.beginValue || 0), 0),
      totalBuyAmount: filteredHoldings.reduce((sum, h) => sum + (h.buyAmount || 0), 0),
      totalSellAmount: filteredHoldings.reduce((sum, h) => sum + (h.sellAmount || 0), 0),
      totalEndValue: filteredHoldings.reduce((sum, h) => sum + (h.endValue || 0), 0),
      totalPnl: filteredHoldings.reduce((sum, h) => sum + (h.investmentPnl || 0), 0)
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div className="flex flex-row items-center gap-2">
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <PieChart className="w-5 h-5 text-indigo-400" />
                {title || `${period} 상세 포트폴리오 및 현금흐름`}
            </h3>
            {titleRightElement}
        </div>
        
        <div className="flex items-center flex-wrap gap-1.5 w-full xl:w-auto">
            {FILTER_TYPES.map(filter => (
                <button
                    key={filter.value}
                    onClick={() => setSelectedType(filter.value)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                        selectedType === filter.value 
                        ? 'bg-sky-500/20 text-sky-400 border border-sky-500/50 shadow-sm' 
                        : 'bg-black/40 text-gray-400 hover:bg-white/10 hover:text-gray-200 border border-white/5'
                    }`}
                >
                    {filter.label}
                </button>
            ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white/5 p-3 rounded-xl border border-white/10">
            <p className="text-[10px] text-gray-400 mb-0.5">기초 평가금액</p>
            <h4 className="text-base font-bold text-gray-200">{displaySummary.totalBeginValue ? formatMoney(displaySummary.totalBeginValue) : '-'}</h4>
        </div>
        <div className="bg-white/5 p-3 rounded-xl border border-white/10">
            <p className="text-[10px] text-gray-400 mb-0.5">기간 내 순매수</p>
            <h4 className="text-base font-bold text-sky-300">{formatMoney(displaySummary.totalBuyAmount - displaySummary.totalSellAmount)}</h4>
        </div>
        <div className="bg-white/5 p-3 rounded-xl border border-white/10 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-2 opacity-10"><Wallet className="w-8 h-8" /></div>
            <p className="text-[10px] text-gray-400 mb-0.5">기말 평가금액</p>
            <h4 className="text-base font-bold text-white">{displaySummary.totalEndValue ? formatMoney(displaySummary.totalEndValue) : '-'}</h4>
        </div>
        <div className={`p-3 rounded-xl border relative overflow-hidden ${(displaySummary.totalPnl || 0) > 0 ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
            <p className={`text-[10px] mb-0.5 ${(displaySummary.totalPnl || 0) > 0 ? 'text-emerald-200/70' : 'text-red-200/70'}`}>투자 손익</p>
            <div className="flex items-center gap-1">
                <h4 className={`text-lg font-bold tracking-tight ${(displaySummary.totalPnl || 0) > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {(displaySummary.totalPnl || 0) > 0 ? '+' : ''}{formatMoney(displaySummary.totalPnl || 0)}
                </h4>
            </div>
        </div>
      </div>

      {selectedType === '전체' && summary.carryoverBalance > 0 && (
          <div className="bg-black/30 p-4 rounded-xl border border-white/5 flex gap-8 whitespace-nowrap overflow-x-auto text-sm">
            <div>
                <span className="text-gray-500 block text-xs">이월잔고</span>
                <strong className="text-gray-300">{formatMoney(summary.carryoverBalance)}</strong>
            </div>
            <div>
                <span className="text-sky-500/70 block text-xs">입금</span>
                <strong className="text-sky-300">+{formatMoney(summary.deposit)}</strong>
            </div>
            <div>
                <span className="text-pink-500/70 block text-xs">출금</span>
                <strong className="text-pink-300">-{formatMoney(summary.withdrawal)}</strong>
            </div>
            <div className="border-l border-white/10 pl-8">
                <span className="text-indigo-300/70 block text-xs">종합잔고</span>
                <strong className="text-indigo-300 text-base">{formatMoney(summary.totalBalance)}</strong>
            </div>
          </div>
      )}

      {/* 보유 종목 상세 테이블 */}
      <div className="overflow-x-auto custom-scrollbar border border-white/10 rounded-xl bg-black/40">
        <table className="w-full text-sm text-left whitespace-nowrap">
          <thead className="text-[11px] text-gray-400 bg-white/5 uppercase">
            <tr>
              <th className="px-3 py-1.5 font-medium">종목명(상품명)</th>
              <th className="px-2 py-1.5 font-medium text-right">기초금액</th>
              <th className="px-2 py-1.5 font-medium text-right">매수금액</th>
              <th className="px-2 py-1.5 font-medium text-right">매도금액</th>
              <th className="px-2 py-1.5 font-medium text-right">기말금액</th>
              <th className="px-2 py-1.5 font-medium text-right">배당/이자</th>
              <th className="px-2 py-1.5 font-medium text-right">상태</th>
              <th className="px-2 py-1.5 font-medium text-right">투자손익</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 text-xs">
            {filteredHoldings.map((h, idx) => (
              <tr key={idx} className="hover:bg-white/5 transition-colors">
                <td className="px-3 py-1.5 font-medium">
                   {onOpenDetail && h.code ? (
                        <button onClick={() => onOpenDetail(h.code!)} className="text-gray-200 hover:text-sky-400 transition-colors cursor-pointer text-left focus:outline-none">
                            {h.name}
                        </button>
                    ) : (
                        <span className="text-gray-200">{h.name}</span>
                    )}
                </td>
                <td className="px-2 py-1.5 text-right text-gray-400">{h.beginValue ? formatMoney(h.beginValue) : '-'}</td>
                <td className="px-2 py-1.5 text-right text-sky-400/80">{h.buyAmount ? formatMoney(h.buyAmount) : '-'}</td>
                <td className="px-2 py-1.5 text-right text-pink-400/80">{h.sellAmount ? formatMoney(h.sellAmount) : '-'}</td>
                <td className="px-2 py-1.5 text-right text-gray-200">{h.endValue ? formatMoney(h.endValue) : '-'}</td>
                <td className="px-2 py-1.5 text-right text-indigo-300">{(h.dividend + h.creditInterest) ? formatMoney(h.dividend + h.creditInterest) : '-'}</td>
                <td className="px-2 py-1.5 text-right text-[10px]">
                     {(h.investmentPnl || 0) > 0 ? (
                         <span className="inline-flex items-center text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded-full"><ArrowUpRight className="w-2.5 h-2.5 mr-0.5"/>수익</span>
                     ) : (h.investmentPnl || 0) < 0 ? (
                         <span className="inline-flex items-center text-red-400 bg-red-400/10 px-1.5 py-0.5 rounded-full"><ArrowDownRight className="w-2.5 h-2.5 mr-0.5"/>손실</span>
                     ) : (
                         <span className="text-gray-500">-</span>
                     )}
                </td>
                <td className={`px-2 py-1.5 text-right font-bold ${(h.investmentPnl || 0) > 0 ? 'text-emerald-400' : (h.investmentPnl || 0) < 0 ? 'text-red-400' : 'text-gray-500'}`}>
                  {(h.investmentPnl || 0) > 0 ? '+' : ''}{h.investmentPnl ? formatMoney(h.investmentPnl) : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
