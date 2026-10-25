// 가계 자산배분 사분면 기반 목표 밸런스 역산 및 원클릭 리밸런싱 시뮬레이터 모달
'use client';

import React, { useState, useMemo } from 'react';
import { 
  Scale, Compass, Target, Sparkles, ArrowRight, CheckCircle2, 
  X, AlertCircle, TrendingUp, DollarSign, ShieldCheck, RefreshCw 
} from 'lucide-react';

interface QuadrantRebalancingModalProps {
  isOpen: boolean;
  onClose: () => void;
  grandTotalNetWorth: number;
  financialNetWorth: number;
  realEstateNetWorth: number;
  financialRatio: number;
  realEstateRatio: number;
  includeRealEstate: boolean;
}

export default function QuadrantRebalancingModal({
  isOpen,
  onClose,
  grandTotalNetWorth,
  financialNetWorth,
  realEstateNetWorth,
  financialRatio,
  realEstateRatio,
  includeRealEstate,
}: QuadrantRebalancingModalProps) {
  // 목표 금융 비중 설정 슬라이더 (권장 40~50%, 기본 45%)
  const [targetFinancialRatio, setTargetFinancialRatio] = useState<number>(45);
  const [isSimulatedApplied, setIsSimulatedApplied] = useState<boolean>(false);

  // 1억 단위 및 원 단위 포맷터
  const fmtWon = (v: number) => Math.round(v).toLocaleString() + '원';
  const fmtEok = (v: number) => (v / 100_000_000).toFixed(2) + '억';

  // 목표 밸런스 도달을 위한 필요 금융 자산 계산
  // targetFinancialRatio% 가 되기 위한 필요 금융자산 규모:
  // 금융 / (금융 + 부동산) = targetRatio/100
  // 금융 * (1 - targetRatio/100) = 부동산 * targetRatio/100
  // 금융 = 부동산 * (targetRatio / (100 - targetRatio))
  const simulation = useMemo(() => {
    const targetRatio = targetFinancialRatio;
    const targetRealEstateRatio = 100 - targetRatio;

    let requiredFinancialTotal = financialNetWorth;
    let gapFinancialWon = 0;

    if (includeRealEstate && realEstateNetWorth > 0) {
      requiredFinancialTotal = realEstateNetWorth * (targetRatio / targetRealEstateRatio);
      gapFinancialWon = Math.max(0, requiredFinancialTotal - financialNetWorth);
    } else {
      // 부동산 미포함 시 현 금융자산 내에서의 포트폴리오 비타민 배분
      gapFinancialWon = financialNetWorth * 0.25; // 25% 리밸런싱 권장
    }

    // 3대 비타민 ETF 권장 배분 (배당 40%, 금 30%, 단기금리 30%)
    const vitaminPlan = [
      {
        ticker: "453850",
        name: "ACE 미국배당다우존스(H)",
        category: "배당 성장 & 환헤지",
        targetShare: 40,
        amountWon: Math.round(gapFinancialWon * 0.4),
        price: 11600,
        shares: Math.floor((gapFinancialWon * 0.4) / 11600),
        reason: "월배당 현금흐름 창출 및 환율 급변 방어"
      },
      {
        ticker: "411060",
        name: "ACE KRX금현물",
        category: "인플레이션 헤지 & 안전자산",
        targetShare: 30,
        amountWon: Math.round(gapFinancialWon * 0.3),
        price: 23800,
        shares: Math.floor((gapFinancialWon * 0.3) / 23800),
        reason: "주식 시장 하락 시 포트폴리오 MDD 완충"
      },
      {
        ticker: "449170",
        name: "TIGER KOFR금리액티브(합성)",
        category: "초단기 파킹 & 무위험 복리",
        targetShare: 30,
        amountWon: Math.round(gapFinancialWon * 0.3),
        price: 104500,
        shares: Math.floor((gapFinancialWon * 0.3) / 104500),
        reason: "대기 자금 일복리 이자 수익 및 유동성 확보"
      }
    ];

    // 시뮬레이션 후 예상 사분면 위치
    const postTotal = grandTotalNetWorth + (includeRealEstate ? gapFinancialWon : 0);
    const postFinancial = financialNetWorth + (includeRealEstate ? gapFinancialWon : 0);
    const postFinRatio = postTotal > 0 ? (postFinancial / postTotal) * 100 : 100;
    const postReRatio = postTotal > 0 ? (realEstateNetWorth / postTotal) * 100 : 0;

    return {
      gapFinancialWon,
      requiredFinancialTotal,
      vitaminPlan,
      postFinRatio,
      postReRatio,
    };
  }, [targetFinancialRatio, financialNetWorth, realEstateNetWorth, grandTotalNetWorth, includeRealEstate]);

  if (!isOpen) return null;

  return (
    <div className="fixed top-[52px] sm:top-[60px] md:top-[64px] left-0 right-0 bottom-0 z-[200] flex items-start justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-[#12141f] border border-white/10 rounded-3xl w-full max-w-3xl my-auto sm:my-4 flex flex-col shadow-2xl overflow-hidden">
        
        {/* 헤더 */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-black/30">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">
                  가계 자산배분 사분면 목표 도달 리밸런싱 시뮬레이터
                </h2>
                <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                  황금 밸런스 5:5 최적화
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                부동산 편중도를 완화하고 모범 밸런스 존(황금 밸런스형)으로 이동하기 위한 자금 확충 플랜을 역산합니다.
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 바디 컨텐츠 */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* 1. 현재 상태 vs 목표 상태 대조 카드 */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white/[0.02] border border-white/5 rounded-xl p-4">
            <div className="space-y-1">
              <span className="text-[11px] text-gray-400">현재 포트폴리오 비중</span>
              <div className="text-lg font-black text-white font-mono">
                {financialRatio.toFixed(1)}% : {realEstateRatio.toFixed(1)}%
              </div>
              <span className="text-[10px] text-amber-300 font-medium">
                {realEstateRatio > 70 ? '부동산 고편중 국면' : '밸런스 근접'}
              </span>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <span className="text-[11px] text-gray-400">목표 금융자산 비중</span>
                <span className="text-xs font-bold text-emerald-400 font-mono">{targetFinancialRatio}%</span>
              </div>
              <input 
                type="range" 
                min={30} 
                max={60} 
                step={5}
                value={targetFinancialRatio} 
                onChange={(e) => setTargetFinancialRatio(Number(e.target.value))}
                className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-white/10 rounded-lg"
              />
              <div className="flex justify-between text-[9px] text-gray-500 font-mono">
                <span>30% (보수)</span>
                <span className="text-emerald-400 font-bold">45% (권장 모범)</span>
                <span>60% (공격)</span>
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-[11px] text-gray-400">목표 달성 필요 금융자금</span>
              <div className="text-lg font-black text-emerald-400 font-mono">
                +{fmtEok(simulation.gapFinancialWon)}원
              </div>
              <span className="text-[10px] text-gray-400">
                약 {fmtWon(simulation.gapFinancialWon)}
              </span>
            </div>
          </div>

          {/* 2. 사분면 위치 이동 시각화 (Pre vs Post) */}
          <div className="p-4 rounded-xl bg-black/40 border border-white/5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-200 flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-indigo-400" />
                리밸런싱 전후 사분면 위치 궤적 (Pre vs Post)
              </span>
              <span className="text-[10px] text-gray-400">
                목표 도달 시: Q1 황금 밸런스형 진입
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5 flex items-center justify-between">
                <div>
                  <span className="text-gray-400 text-[10px] block">현재 (Pre)</span>
                  <span className="font-bold text-gray-200">
                    금융 {financialRatio.toFixed(0)}% : 부동산 {realEstateRatio.toFixed(0)}%
                  </span>
                </div>
                <span className="text-xs px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-semibold">
                  부동산 집중
                </span>
              </div>

              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between">
                <div>
                  <span className="text-emerald-300 text-[10px] block font-semibold">리밸런싱 후 (Post)</span>
                  <span className="font-bold text-white">
                    금융 {simulation.postFinRatio.toFixed(0)}% : 부동산 {simulation.postReRatio.toFixed(0)}%
                  </span>
                </div>
                <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-semibold flex items-center gap-1">
                  <span>🎯</span>
                  <span>황금 밸런스</span>
                </span>
              </div>
            </div>
          </div>

          {/* 3. 3대 결핍 비타민 ETF 최적 매수 플랜 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-200 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                필요 금융자금 최적 분산 매수 플랜 (비타민 3종)
              </span>
              <span className="text-[10px] text-gray-400">
                배당 40% · 금 30% · 초단기금리 30%
              </span>
            </div>

            <div className="space-y-2">
              {simulation.vitaminPlan.map((plan) => (
                <div key={plan.ticker} className="p-3.5 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white">{plan.name}</span>
                      <span className="text-[10px] font-mono text-gray-400">{plan.ticker}</span>
                      <span className="text-[10px] font-semibold text-indigo-300 bg-indigo-500/20 px-1.5 py-0.2 rounded">
                        {plan.category}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-400">{plan.reason}</p>
                  </div>

                  <div className="flex items-center gap-4 text-right shrink-0">
                    <div>
                      <div className="text-xs font-bold text-emerald-400 font-mono">
                        {fmtWon(plan.amountWon)}
                      </div>
                      <div className="text-[10px] text-gray-500 font-mono">
                        약 {plan.shares.toLocaleString()}주 (단가 {plan.price.toLocaleString()}원)
                      </div>
                    </div>
                    <span className="text-xs font-bold text-gray-300 bg-white/5 px-2 py-1 rounded border border-white/10 font-mono">
                      {plan.targetShare}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* 푸터 */}
        <div className="px-6 py-3 border-t border-white/10 bg-black/40 flex items-center justify-between text-xs">
          <span className="text-[11px] text-gray-400">
            * 본 시뮬레이션은 모의 계산이며 실제 체결은 증권사 HTS/MTS에서 진행됩니다.
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg font-medium transition"
            >
              닫기
            </button>
            <button
              onClick={() => {
                setIsSimulatedApplied(true);
                setTimeout(() => {
                  setIsSimulatedApplied(false);
                  onClose();
                }, 1000);
              }}
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold shadow-md shadow-emerald-600/30 transition flex items-center gap-1.5"
            >
              {isSimulatedApplied ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-white" />
                  <span>적용 완료!</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>비타민 3종 목표 비중 적용</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
