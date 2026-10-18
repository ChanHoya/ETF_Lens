'use client';

import React, { useState, useMemo } from 'react';
import {
  Calendar, DollarSign, Sparkles, CheckCircle2,
  AlertCircle, ShieldCheck, Printer, ArrowRight, Info, HelpCircle
} from 'lucide-react';

interface SettlementCalculation {
  currentTotalContributed: number;  // 현재까지 납입 누적액 (만원)
  remainingDeductiblePension: number;// 연금저축 잔여 한도 (최대 600만)
  remainingDeductibleIrp: number;    // IRP 잔여 한도 (최대 300만)
  totalRemainingToMax: number;       // 최대 세액공제까지 남은 추가 납입 필요액
  currentRefundWon: number;          // 현재 기준 예상 환급액
  potentialMaxRefundWon: number;     // 한도 완납 시 총 환급액
  extraRefundByYearEnd: number;      // 12월 말까지 추가 납입 시 더 돌려받는 환급 보너스
}

export default function YearEndTaxSettlementPlanner() {
  const [incomeType, setIncomeType] = useState<'under55' | 'over55'>('under55'); // 총급여 5,500만 이하(16.5%) vs 초과(13.2%)
  const [currentPensionContributed, setCurrentPensionContributed] = useState<number>(350); // 현재 연금저축 납입액 (350만원)
  const [currentIrpContributed, setCurrentIrpContributed] = useState<number>(100);         // 현재 IRP 납입액 (100만원)
  const [isaTransferPlanned, setIsaTransferPlanned] = useState<number>(0);                 // ISA 만기전환 계획액 (0~3,000만원)

  const taxRate = incomeType === 'under55' ? 0.165 : 0.132;
  const taxRatePct = incomeType === 'under55' ? 16.5 : 13.2;

  const result = useMemo<SettlementCalculation>(() => {
    // 1. 연금저축 (최대 600만원)
    const effectivePension = Math.min(600, currentPensionContributed);
    const remainingPension = Math.max(0, 600 - currentPensionContributed);

    // 2. IRP (연금저축 포함 합산 900만원, 즉 IRP 단독 추가 300만원 + 연금저축 미달분)
    const currentTotalDeductible = Math.min(900, effectivePension + currentIrpContributed);
    const remainingTo900 = Math.max(0, 900 - currentTotalDeductible);
    const remainingIrp = Math.max(0, 300 - currentIrpContributed);

    // 3. ISA 전환 보너스 (전환액의 10%, 최대 300만원 한도 추가 공제)
    const isaBonusDeduction = Math.min(300, Math.floor(isaTransferPlanned * 0.10));

    const totalMaxDeduction = 900 + isaBonusDeduction;
    const currentTotalContributed = currentPensionContributed + currentIrpContributed;
    const currentDeducted = Math.min(totalMaxDeduction, currentTotalDeductible + isaBonusDeduction);

    const currentRefundWon = Math.round(currentDeducted * taxRate * 10000);
    const potentialMaxRefundWon = Math.round(totalMaxDeduction * taxRate * 10000);
    const extraRefundByYearEnd = Math.max(0, potentialMaxRefundWon - currentRefundWon);
    const totalRemainingToMax = Math.max(0, totalMaxDeduction - currentDeducted);

    return {
      currentTotalContributed,
      remainingDeductiblePension: remainingPension,
      remainingDeductibleIrp: remainingTo900,
      totalRemainingToMax,
      currentRefundWon,
      potentialMaxRefundWon,
      extraRefundByYearEnd,
    };
  }, [incomeType, currentPensionContributed, currentIrpContributed, isaTransferPlanned, taxRate]);

  return (
    <div className="w-full flex flex-col gap-5 text-gray-100">
      {/* ── 1. 상단 인트로 & 골든타임 환급금 하이라이트 배너 ─────────── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-amber-950/40 via-orange-950/30 to-black/50 border border-amber-500/30 p-5 md:p-6 backdrop-blur-xl shadow-xl">
        <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-bold flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" /> 11~12월 연말정산 골든타임
              </span>
              <span className="text-xs text-gray-400">마감: 12월 31일 영업일</span>
            </div>
            <h2 className="text-xl md:text-2xl font-black text-white">
              연말정산 13월의 월급 세액공제 역산 플래너
            </h2>
            <p className="text-xs md:text-sm text-gray-300/80 mt-1">
              올해가 가기 전 얼마를 더 납입하면 내년 2월 연말정산에서 얼마의 현금을 즉시 돌려받는지 정확히 역산합니다.
            </p>
          </div>

          {/* 소득 구간 토글 칩 */}
          <div className="flex bg-black/40 p-1 rounded-2xl border border-white/10 shrink-0">
            <button
              onClick={() => setIncomeType('under55')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                incomeType === 'under55'
                  ? 'bg-amber-500 text-black shadow-md'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              총급여 5,500만 이하 (16.5%)
            </button>
            <button
              onClick={() => setIncomeType('over55')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                incomeType === 'over55'
                  ? 'bg-amber-500 text-black shadow-md'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              5,500만 초과 (13.2%)
            </button>
          </div>
        </div>

        {/* 12월 추가 환급 보너스 콜아웃 카드 */}
        <div className="mt-5 p-4 rounded-2xl bg-black/50 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="text-xs text-gray-400 font-medium">12월 31일까지 {result.totalRemainingToMax.toLocaleString()}만원 추가 납입 시</span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-2xl md:text-3xl font-black text-amber-400">
                +{(result.extraRefundByYearEnd).toLocaleString()}원
              </span>
              <span className="text-xs text-gray-300">내년 2월 추가 환급</span>
            </div>
          </div>
          <div className="text-right sm:border-l sm:border-white/10 sm:pl-4">
            <span className="text-xs text-gray-400">현재 확정 환급금 / 최대 가능액</span>
            <div className="text-base md:text-lg font-bold text-emerald-400 mt-0.5">
              {result.currentRefundWon.toLocaleString()}원 <span className="text-xs text-gray-500 font-normal">/ {result.potentialMaxRefundWon.toLocaleString()}원</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── 2. 현재 납입 현황 및 잔여 한도 슬라이더 ──────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 카드 1: 연금저축 (최대 600만원) */}
        <div className="p-5 rounded-3xl bg-black/40 border border-white/10 backdrop-blur-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-white flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                1. 연금저축펀드 납입액 (한도 600만)
              </span>
              <span className="text-xs font-bold text-emerald-400">
                {currentPensionContributed} / 600 만원
              </span>
            </div>

            <div className="mt-3">
              <input
                type="range"
                min="0"
                max="600"
                step="10"
                value={currentPensionContributed}
                onChange={(e) => setCurrentPensionContributed(Number(e.target.value))}
                className="accent-emerald-500 w-full cursor-pointer h-1.5 bg-white/10 rounded-lg"
              />
            </div>

            <div className="flex justify-between items-center text-xs text-gray-400 mt-2">
              <span>현재 환급 기여: <strong>{Math.round(Math.min(600, currentPensionContributed) * taxRate * 10000).toLocaleString()}원</strong></span>
              <span>남은 한도: <strong className="text-amber-400">{result.remainingDeductiblePension}만원</strong></span>
            </div>
          </div>

          <p className="text-[11px] text-gray-400 mt-3 bg-white/5 p-2 rounded-xl">
            💡 주식형 ETF 100% 투자가 가능하여 장기 복리 성장성이 가장 뛰어난 최우선 납입 계좌입니다.
          </p>
        </div>

        {/* 카드 2: IRP 개인형 퇴직연금 (합산 900만원) */}
        <div className="p-5 rounded-3xl bg-black/40 border border-white/10 backdrop-blur-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-white flex items-center gap-1.5">
                <DollarSign className="w-4 h-4 text-teal-400" />
                2. IRP 추가 납입액 (추가 300만)
              </span>
              <span className="text-xs font-bold text-teal-400">
                {currentIrpContributed} / 300 만원
              </span>
            </div>

            <div className="mt-3">
              <input
                type="range"
                min="0"
                max="300"
                step="10"
                value={currentIrpContributed}
                onChange={(e) => setCurrentIrpContributed(Number(e.target.value))}
                className="accent-teal-500 w-full cursor-pointer h-1.5 bg-white/10 rounded-lg"
              />
            </div>

            <div className="flex justify-between items-center text-xs text-gray-400 mt-2">
              <span>현재 환급 기여: <strong>{Math.round(Math.min(300, currentIrpContributed) * taxRate * 10000).toLocaleString()}원</strong></span>
              <span>남은 한도: <strong className="text-amber-400">{Math.max(0, 300 - currentIrpContributed)}만원</strong></span>
            </div>
          </div>

          <p className="text-[11px] text-gray-400 mt-3 bg-white/5 p-2 rounded-xl">
            💡 안전자산 30% 룰(채권/TDF 등)이 적용되므로 미국 30년 국채액티브나 고쿠폰 채권형 ETF 배치를 추천합니다.
          </p>
        </div>
      </div>

      {/* ── 3. 국세청 연말정산 세액공제 확인서 뷰 (영수증 스타일) ─────── */}
      <div className="p-5 rounded-3xl bg-black/40 border border-white/10 backdrop-blur-xl flex flex-col gap-3">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm md:text-base font-bold text-white">
              2026 귀속 연말정산 연금 세액공제 시뮬레이션 명세표
            </h3>
          </div>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold text-gray-300 hover:text-white border border-white/10 transition cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>명세서 인쇄/PDF</span>
          </button>
        </div>

        <div className="overflow-x-auto text-xs">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10 text-gray-400 bg-white/5">
                <th className="py-2.5 px-3 font-semibold">공제 항목</th>
                <th className="py-2.5 px-3 font-semibold">법정 한도</th>
                <th className="py-2.5 px-3 font-semibold">현재 납입액</th>
                <th className="py-2.5 px-3 font-semibold">세액공제 대상 인정액</th>
                <th className="py-2.5 px-3 font-semibold">공제율</th>
                <th className="py-2.5 px-3 font-semibold text-right">예상 환급 세액</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-gray-200">
              <tr>
                <td className="py-2.5 px-3 font-medium text-white">연금저축계좌</td>
                <td className="py-2.5 px-3">600 만원</td>
                <td className="py-2.5 px-3 font-bold text-emerald-400">{currentPensionContributed} 만원</td>
                <td className="py-2.5 px-3 font-bold">{Math.min(600, currentPensionContributed)} 만원</td>
                <td className="py-2.5 px-3">{taxRatePct}%</td>
                <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-400">
                  +{Math.round(Math.min(600, currentPensionContributed) * taxRate * 10000).toLocaleString()}원
                </td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-medium text-white">개인형 퇴직연금(IRP)</td>
                <td className="py-2.5 px-3">합산 900 만원</td>
                <td className="py-2.5 px-3 font-bold text-teal-400">{currentIrpContributed} 만원</td>
                <td className="py-2.5 px-3 font-bold">{Math.min(300, currentIrpContributed)} 만원</td>
                <td className="py-2.5 px-3">{taxRatePct}%</td>
                <td className="py-2.5 px-3 text-right font-mono font-bold text-teal-400">
                  +{Math.round(Math.min(300, currentIrpContributed) * taxRate * 10000).toLocaleString()}원
                </td>
              </tr>
              <tr className="bg-amber-500/5 font-bold text-amber-300">
                <td className="py-3 px-3">합계 (기본 한도)</td>
                <td className="py-3 px-3">900 만원</td>
                <td className="py-3 px-3">{(currentPensionContributed + currentIrpContributed)} 만원</td>
                <td className="py-3 px-3">{Math.min(900, currentPensionContributed + currentIrpContributed)} 만원</td>
                <td className="py-3 px-3">{taxRatePct}%</td>
                <td className="py-3 px-3 text-right font-mono text-sm">
                  +{result.currentRefundWon.toLocaleString()}원
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
