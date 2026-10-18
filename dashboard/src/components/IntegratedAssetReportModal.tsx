'use client';

import React, { useRef } from 'react';
import { 
  Printer, Download, X, Building2, Wallet, Landmark, 
  ShieldCheck, AlertTriangle, Scale, Calendar, CheckCircle2,
  FileSpreadsheet, Sparkles
} from 'lucide-react';
import { NumberPopIn } from './common/NumberPopIn';

interface IntegratedReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  grandTotalNetWorth: number;
  realEstateNetWorth: number;
  realEstateGross: number;
  realEstateDebt: number;
  financialNetWorth: number;
  financialInvestAmount: number;
  financialCashAmount: number;
  tffAmount: number;
  apartmentsCount: number;
  diagnosis: {
    badge: string;
    desc: string;
    advice: string;
  };
}

export default function IntegratedAssetReportModal({
  isOpen,
  onClose,
  grandTotalNetWorth,
  realEstateNetWorth,
  realEstateGross,
  realEstateDebt,
  financialNetWorth,
  financialInvestAmount,
  financialCashAmount,
  tffAmount,
  apartmentsCount,
  diagnosis
}: IntegratedReportModalProps) {
  const printRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  const fmtKRW = (n: number) => Math.round(n).toLocaleString('ko-KR');
  const fmtEok = (won: number) => {
    const eok = won / 100_000_000;
    return `${eok.toFixed(2)}억`;
  };

  const handlePrint = () => {
    window.print();
  };

  const realEstateRatio = grandTotalNetWorth > 0 ? (realEstateNetWorth / grandTotalNetWorth) * 100 : 0;
  const equityRatio = grandTotalNetWorth > 0 ? (financialInvestAmount / grandTotalNetWorth) * 100 : 0;
  const cashRatio = grandTotalNetWorth > 0 ? (financialCashAmount / grandTotalNetWorth) * 100 : 0;
  const tffRatio = grandTotalNetWorth > 0 ? (tffAmount / grandTotalNetWorth) * 100 : 0;

  // LTV 계산 (부동산 총 가액 대비 부채 비율)
  const ltvPct = realEstateGross > 0 ? (realEstateDebt / realEstateGross) * 100 : 0;

  // 예상 연간 배당금 (금융 주식/ETF 연 3.5% 배당률 가정)
  const estimatedAnnualDividends = Math.round(financialInvestAmount * 0.035);
  const estimatedMonthlyDividends = Math.round(estimatedAnnualDividends / 12);

  const todayStr = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto print:p-0 print:bg-white print:static">
      <div className="relative w-full max-w-4xl rounded-3xl bg-[#131622] border border-white/10 shadow-2xl overflow-hidden print:border-none print:shadow-none print:w-full print:bg-white print:text-black">
        
        {/* 상단 툴바 (인쇄 시 숨김) */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/[0.02] print:hidden">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">종합 가계 자산 진단 보고서 (Net Worth Report)</h2>
              <p className="text-xs text-gray-400">A4 규격 인쇄 및 PDF 저장용 정밀 리포트</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg transition-all active:scale-95 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>A4 인쇄 / PDF 저장</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 인쇄 대상 보고서 본문 */}
        <div ref={printRef} className="p-6 sm:p-8 space-y-6 print:p-6 print:text-black">
          
          {/* 리포트 헤더 */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end pb-5 border-b border-white/10 print:border-gray-300">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-indigo-400 uppercase tracking-widest print:text-indigo-700">i-Prism Private Wealth Management</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 print:border-emerald-600 print:text-emerald-800">
                  {diagnosis.badge}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-white mt-1 print:text-black">
                가계 종합 자산 및 포트폴리오 리밸런싱 진단서
              </h1>
              <p className="text-xs text-gray-400 mt-1 print:text-gray-600">
                실물 부동산(시세·부채)과 금융투자 포트폴리오(주식/ETF/예수금) 및 대체 자산 통합 평가
              </p>
            </div>
            <div className="text-right mt-3 sm:mt-0">
              <div className="text-xs text-gray-400 print:text-gray-500">진단 기준일</div>
              <div className="text-sm font-bold text-gray-200 print:text-black">{todayStr}</div>
            </div>
          </div>

          {/* 1. Grand Net Worth 요약 카드 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-950/40 via-[#181d2a] to-[#121420] border border-indigo-500/30 print:bg-gray-50 print:border-gray-300">
              <span className="text-[11px] font-bold text-indigo-300 print:text-indigo-800">가계 총 순자산 (Net Worth)</span>
              <div className="text-2xl font-black text-white mt-1 print:text-black">
                {fmtEok(grandTotalNetWorth)}원
              </div>
              <p className="text-[11px] text-gray-400 mt-1 print:text-gray-600">
                {fmtKRW(grandTotalNetWorth)}원 (부채 차감 후)
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-[#161a26] border border-amber-500/20 print:bg-gray-50 print:border-gray-300">
              <span className="text-[11px] font-bold text-amber-300 print:text-amber-800">실물 부동산 순자산</span>
              <div className="text-2xl font-black text-amber-400 mt-1 print:text-amber-700">
                {fmtEok(realEstateNetWorth)}원
              </div>
              <p className="text-[11px] text-gray-400 mt-1 print:text-gray-600">
                총가액 {fmtEok(realEstateGross)}원 / 부채 {fmtEok(realEstateDebt)}원 (LTV {ltvPct.toFixed(1)}%)
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-[#161a26] border border-emerald-500/20 print:bg-gray-50 print:border-gray-300">
              <span className="text-[11px] font-bold text-emerald-300 print:text-emerald-800">금융 자산 (주식+예수금)</span>
              <div className="text-2xl font-black text-emerald-400 mt-1 print:text-emerald-700">
                {fmtEok(financialNetWorth)}원
              </div>
              <p className="text-[11px] text-gray-400 mt-1 print:text-gray-600">
                주식/ETF {fmtEok(financialInvestAmount)}원 / 현금 {fmtEok(financialCashAmount)}원
              </p>
            </div>
          </div>

          {/* 2. 자산 배분 비중 & 사분면 분석 */}
          <div className="p-5 rounded-2xl bg-[#161a26] border border-white/10 print:border-gray-300 print:bg-white">
            <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-1.5 print:text-black">
              <Scale className="w-4 h-4 text-indigo-400" />
              <span>3대 핵심 자산 배분 포지셔닝</span>
            </h3>

            {/* 프로그레스 바 */}
            <div className="w-full h-5 bg-gray-800 rounded-full overflow-hidden flex shadow-inner print:bg-gray-200">
              <div style={{ width: `${realEstateRatio}%` }} className="h-full bg-amber-500" title={`부동산 ${realEstateRatio.toFixed(1)}%`} />
              <div style={{ width: `${equityRatio}%` }} className="h-full bg-indigo-500" title={`주식/ETF ${equityRatio.toFixed(1)}%`} />
              <div style={{ width: `${cashRatio}%` }} className="h-full bg-emerald-500" title={`현금/예수금 ${cashRatio.toFixed(1)}%`} />
              {tffRatio > 0 && (
                <div style={{ width: `${tffRatio}%` }} className="h-full bg-purple-500" title={`TFF대체펀드 ${tffRatio.toFixed(1)}%`} />
              )}
            </div>

            {/* 비중 상세 테이블 */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 text-xs">
              <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 print:border-gray-200">
                <span className="text-gray-400 print:text-gray-600">실물 부동산</span>
                <div className="text-base font-bold text-amber-400 mt-0.5 print:text-amber-800">{realEstateRatio.toFixed(1)}%</div>
                <div className="text-[10px] text-gray-500">{fmtEok(realEstateNetWorth)}원 ({apartmentsCount}채)</div>
              </div>
              <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 print:border-gray-200">
                <span className="text-gray-400 print:text-gray-600">주식 / ETF</span>
                <div className="text-base font-bold text-indigo-400 mt-0.5 print:text-indigo-800">{equityRatio.toFixed(1)}%</div>
                <div className="text-[10px] text-gray-500">{fmtEok(financialInvestAmount)}원</div>
              </div>
              <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 print:border-gray-200">
                <span className="text-gray-400 print:text-gray-600">현금 / 예수금</span>
                <div className="text-base font-bold text-emerald-400 mt-0.5 print:text-emerald-800">{cashRatio.toFixed(1)}%</div>
                <div className="text-[10px] text-gray-500">{fmtEok(financialCashAmount)}원</div>
              </div>
              <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 print:border-gray-200">
                <span className="text-gray-400 print:text-gray-600">TFF 대체 펀드</span>
                <div className="text-base font-bold text-purple-400 mt-0.5 print:text-purple-800">{tffRatio.toFixed(1)}%</div>
                <div className="text-[10px] text-gray-500">{fmtEok(tffAmount)}원</div>
              </div>
            </div>

            {/* AI 리밸런싱 종합 처방 */}
            <div className="mt-4 p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-200 print:bg-indigo-50 print:text-indigo-900 print:border-indigo-200">
              <strong>💡 자산배분 진단 평가: </strong>
              <span>{diagnosis.desc} {diagnosis.advice}</span>
            </div>
          </div>

          {/* 3. 현금흐름 및 배당 예상 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-[#161a26] border border-white/10 print:border-gray-300 print:bg-white">
              <h4 className="text-xs font-bold text-emerald-400 mb-2 flex items-center gap-1.5 print:text-emerald-800">
                <Calendar className="w-4 h-4" />
                <span>예상 연간 배당 및 인컴 캐시플로우</span>
              </h4>
              <div className="space-y-1.5 text-xs text-gray-300 print:text-gray-800">
                <div className="flex justify-between">
                  <span className="text-gray-400 print:text-gray-600">연간 예상 배당액:</span>
                  <span className="font-bold text-white print:text-black">약 {fmtKRW(estimatedAnnualDividends)}원</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400 print:text-gray-600">월 환산 배당 현금흐름:</span>
                  <span className="font-bold text-emerald-400 print:text-emerald-800">월 약 {fmtKRW(estimatedMonthlyDividends)}원</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-white/5 print:border-gray-200 text-[11px] text-gray-500">
                  <span>추정 배당수익률:</span>
                  <span>연 3.5% (고배당/지수 ETF 혼합 기준)</span>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-[#161a26] border border-white/10 print:border-gray-300 print:bg-white">
              <h4 className="text-xs font-bold text-amber-400 mb-2 flex items-center gap-1.5 print:text-amber-800">
                <Building2 className="w-4 h-4" />
                <span>부동산 부채 건전성 진단</span>
              </h4>
              <div className="space-y-1.5 text-xs text-gray-300 print:text-gray-800">
                <div className="flex justify-between">
                  <span className="text-gray-400 print:text-gray-600">담보인정비율 (LTV):</span>
                  <span className={`font-bold ${ltvPct >= 60 ? 'text-rose-400 print:text-rose-700' : 'text-emerald-400 print:text-emerald-700'}`}>
                    {ltvPct.toFixed(1)}% ({ltvPct < 50 ? '우량 안전' : '관리 필요'})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400 print:text-gray-600">총 담보대출/보증금:</span>
                  <span className="font-bold text-white print:text-black">{fmtEok(realEstateDebt)}원</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-white/5 print:border-gray-200 text-[11px] text-gray-500">
                  <span>평가 기준:</span>
                  <span>국토부 실거래가 및 모기지 건전성 공식</span>
                </div>
              </div>
            </div>
          </div>

          {/* 푸터 */}
          <div className="pt-4 border-t border-white/5 flex justify-between items-center text-[10px] text-gray-500 print:text-gray-400">
            <span>Generated by i-Prism AI Wealth Management System</span>
            <span>본 보고서는 투자 참고용 시뮬레이션 자료입니다.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
