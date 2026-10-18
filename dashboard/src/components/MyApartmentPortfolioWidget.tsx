'use client';

import React, { useState, useEffect } from 'react';
import { 
  Building2, Plus, Trash2, TrendingUp, TrendingDown, 
  ShieldCheck, AlertTriangle, Activity, Search, RefreshCw, 
  ChevronRight, Sparkles, Scale, DollarSign
} from 'lucide-react';
import { getApiBase } from '@/lib/apiConfig';

export interface MyApartmentItem {
  id: string;
  complex_name: string;
  area_sqm: number;
  area_pyeong: number;
  purchase_price_won: number; // 억 원
  loan_balance_won: number;   // 억 원
  jeonse_deposit_won: number; // 억 원
  annual_income_won: number;  // 억 원
  mortgage_rate_pct: number;  // %
  registered_at: string;
  evaluation?: any;
}

const STORAGE_KEY = 'etf_one_my_apartments';

// 기본 초기 샘플 (사용자 이해를 돕기 위한 1건 기본값)
const DEFAULT_SAVED: MyApartmentItem[] = [
  {
    id: 'apt-default-1',
    complex_name: '잠실엘스',
    area_sqm: 84.8,
    area_pyeong: 34,
    purchase_price_won: 23.5,
    loan_balance_won: 6.5,
    jeonse_deposit_won: 0.0,
    annual_income_won: 1.2,
    mortgage_rate_pct: 4.1,
    registered_at: '2026-10-18'
  }
];

interface MyApartmentPortfolioWidgetProps {
  onOpenComplexModal: (complexName: string) => void;
}

export default function MyApartmentPortfolioWidget({ onOpenComplexModal }: MyApartmentPortfolioWidgetProps) {
  const [apartments, setApartments] = useState<MyApartmentItem[]>([]);
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [evaluating, setEvaluating] = useState<boolean>(false);

  // 폼 입력 상태
  const [complexName, setComplexName] = useState<string>('잠실엘스');
  const [areaSqm, setAreaSqm] = useState<number>(84.8);
  const [purchasePrice, setPurchasePrice] = useState<number>(23.5);
  const [loanBalance, setLoanBalance] = useState<number>(6.5);
  const [jeonseDeposit, setJeonseDeposit] = useState<number>(0.0);
  const [annualIncome, setAnnualIncome] = useState<number>(1.2);
  const [mortgageRate, setMortgageRate] = useState<number>(4.1);

  // 프리셋 단지 목록
  const PRESET_COMPLEXES = [
    '잠실엘스', '마포래미안푸르지오', '헬리오시티', '아크로리버파크', 
    '고덕그라시움', '올림픽파크포레온', '분당파크뷰', '과천위버필드', 
    '송도더샵퍼스트파크', '상계주공11단지', '은마아파트'
  ];

  // 로드 & 백엔드 평가
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      const initial = saved ? JSON.parse(saved) : DEFAULT_SAVED;
      setApartments(initial);
      evaluateAllApartments(initial);
    } catch (e) {
      console.warn('Failed to load apartments from localStorage', e);
      setApartments(DEFAULT_SAVED);
      evaluateAllApartments(DEFAULT_SAVED);
    }
  }, []);

  const saveToStorage = (items: MyApartmentItem[]) => {
    setApartments(items);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (e) {
      console.warn('Failed to save to localStorage', e);
    }
  };

  const evaluateAllApartments = async (items: MyApartmentItem[]) => {
    if (!items || items.length === 0) return;
    try {
      setEvaluating(true);
      const apiBase = getApiBase();
      const updated = await Promise.all(
        items.map(async (apt) => {
          try {
            const res = await fetch(`${apiBase}/api/v1/real-estate/evaluate-apartment`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                complex_name: apt.complex_name,
                area_sqm: apt.area_sqm,
                purchase_price_won: apt.purchase_price_won,
                loan_balance_won: apt.loan_balance_won,
                jeonse_deposit_won: apt.jeonse_deposit_won,
                annual_income_won: apt.annual_income_won,
                mortgage_rate_pct: apt.mortgage_rate_pct
              })
            });
            if (res.ok) {
              const evalData = await res.json();
              return { ...apt, evaluation: evalData };
            }
          } catch (err) {
            console.warn(`Evaluation failed for ${apt.complex_name}:`, err);
          }
          return apt;
        })
      );
      setApartments(updated);
    } finally {
      setEvaluating(false);
    }
  };

  const handleAddApartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!complexName) return;

    const newItem: MyApartmentItem = {
      id: `apt-${Date.now()}`,
      complex_name: complexName.trim(),
      area_sqm: areaSqm,
      area_pyeong: Math.round(areaSqm / 3.3058),
      purchase_price_won: purchasePrice,
      loan_balance_won: loanBalance,
      jeonse_deposit_won: jeonseDeposit,
      annual_income_won: annualIncome,
      mortgage_rate_pct: mortgageRate,
      registered_at: new Date().toISOString().split('T')[0]
    };

    const nextList = [newItem, ...apartments];
    saveToStorage(nextList);
    setIsFormOpen(false);
    await evaluateAllApartments(nextList);
  };

  const handleDeleteApartment = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const nextList = apartments.filter(a => a.id !== id);
    saveToStorage(nextList);
  };

  return (
    <div className="w-full bg-[#121422] border border-white/10 rounded-2xl p-4 sm:p-5 shadow-lg flex flex-col gap-4">
      {/* 상단 타이틀 & 등록 버튼 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-white/5">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
            <Building2 className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-black text-white">내 아파트 등록 & LTV·스트레스 DSR 자산 건전성 진단</h4>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                국토부 실거래가 실시간 연동
              </span>
            </div>
            <p className="text-[11px] text-gray-400">
              보유 아파트의 실시간 평가액, 수익률, 부채 비율 및 2개년 실거래 시계열을 즉시 확인합니다.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            onClick={() => evaluateAllApartments(apartments)}
            disabled={evaluating}
            className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition text-xs"
            title="시세 재평가"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${evaluating ? 'animate-spin text-indigo-400' : ''}`} />
          </button>
          <button
            onClick={() => setIsFormOpen(!isFormOpen)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition shadow-md shadow-indigo-500/20"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{isFormOpen ? '등록 닫기' : '새 아파트 등록'}</span>
          </button>
        </div>
      </div>

      {/* 등록 폼 드롭다운 */}
      {isFormOpen && (
        <form onSubmit={handleAddApartment} className="p-4 rounded-xl bg-black/40 border border-indigo-500/30 grid grid-cols-1 sm:grid-cols-3 gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <div>
            <label className="text-[11px] text-gray-300 font-semibold block mb-1">단지명</label>
            <input
              type="text"
              list="preset-complexes"
              value={complexName}
              onChange={(e) => setComplexName(e.target.value)}
              placeholder="예: 잠실엘스, 마포래미안푸르지오"
              required
              className="w-full px-3 py-1.5 rounded-lg bg-[#181a29] border border-white/10 text-xs text-white focus:outline-none focus:border-indigo-500 font-medium"
            />
            <datalist id="preset-complexes">
              {PRESET_COMPLEXES.map(c => <option key={c} value={c} />)}
            </datalist>
          </div>

          <div>
            <label className="text-[11px] text-gray-300 font-semibold block mb-1">전용면적 (㎡)</label>
            <input
              type="number"
              step="0.1"
              value={areaSqm}
              onChange={(e) => setAreaSqm(parseFloat(e.target.value) || 84.8)}
              className="w-full px-3 py-1.5 rounded-lg bg-[#181a29] border border-white/10 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
            />
          </div>

          <div>
            <label className="text-[11px] text-gray-300 font-semibold block mb-1">매수가격 (억 원)</label>
            <input
              type="number"
              step="0.1"
              value={purchasePrice}
              onChange={(e) => setPurchasePrice(parseFloat(e.target.value) || 0)}
              required
              className="w-full px-3 py-1.5 rounded-lg bg-[#181a29] border border-white/10 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
            />
          </div>

          <div>
            <label className="text-[11px] text-gray-300 font-semibold block mb-1">주담대 대출 잔액 (억 원)</label>
            <input
              type="number"
              step="0.1"
              value={loanBalance}
              onChange={(e) => setLoanBalance(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-1.5 rounded-lg bg-[#181a29] border border-white/10 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
            />
          </div>

          <div>
            <label className="text-[11px] text-gray-300 font-semibold block mb-1">전세보증금 (갭투자 시, 억 원)</label>
            <input
              type="number"
              step="0.1"
              value={jeonseDeposit}
              onChange={(e) => setJeonseDeposit(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-1.5 rounded-lg bg-[#181a29] border border-white/10 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
            />
          </div>

          <div>
            <label className="text-[11px] text-gray-300 font-semibold block mb-1">연간 소득 & 대출금리</label>
            <div className="flex gap-2">
              <input
                type="number"
                step="0.1"
                placeholder="연소득(억)"
                value={annualIncome}
                onChange={(e) => setAnnualIncome(parseFloat(e.target.value) || 1.0)}
                className="w-1/2 px-2.5 py-1.5 rounded-lg bg-[#181a29] border border-white/10 text-xs text-white focus:outline-none font-mono"
              />
              <input
                type="number"
                step="0.1"
                placeholder="금리(%)"
                value={mortgageRate}
                onChange={(e) => setMortgageRate(parseFloat(e.target.value) || 4.0)}
                className="w-1/2 px-2.5 py-1.5 rounded-lg bg-[#181a29] border border-white/10 text-xs text-white focus:outline-none font-mono"
              />
            </div>
          </div>

          <div className="sm:col-span-3 flex justify-end gap-2 pt-2 border-t border-white/5">
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-gray-400"
            >
              취소
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs text-white font-bold"
            >
              포트폴리오에 저장
            </button>
          </div>
        </form>
      )}

      {/* 등록된 아파트 카드 목록 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {apartments.length === 0 ? (
          <div className="col-span-2 py-8 text-center text-xs text-gray-500 border border-dashed border-white/10 rounded-xl">
            등록된 아파트가 없습니다. 상단의 '새 아파트 등록' 버튼을 눌러 추가하세요.
          </div>
        ) : (
          apartments.map((apt) => {
            const ev = apt.evaluation;
            const isProfit = ev ? ev.unrealized_gain_won >= 0 : true;
            const healthBadge = ev ? {
              SAFE: { bg: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30', label: '자산 안전' },
              MODERATE: { bg: 'bg-amber-500/10 text-amber-300 border-amber-500/30', label: '적정 레버리지' },
              RISK: { bg: 'bg-rose-500/10 text-rose-300 border-rose-500/30', label: '부채 관리 주의' }
            }[ev.health_grade as 'SAFE' | 'MODERATE' | 'RISK'] : null;

            return (
              <div
                key={apt.id}
                onClick={() => onOpenComplexModal(apt.complex_name)}
                className="group relative bg-[#181a2a] hover:bg-[#1f2235] border border-white/10 hover:border-indigo-500/40 rounded-2xl p-4 transition-all duration-200 cursor-pointer shadow-md flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-extrabold text-white group-hover:text-indigo-300 transition-colors">
                        {apt.complex_name}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-white/5 text-gray-300 font-mono">
                        {apt.area_pyeong}평 ({apt.area_sqm}㎡)
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {healthBadge && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${healthBadge.bg}`}>
                          {healthBadge.label}
                        </span>
                      )}
                      <button
                        onClick={(e) => handleDeleteApartment(apt.id, e)}
                        className="p-1 rounded text-gray-500 hover:text-rose-400 hover:bg-white/5 transition"
                        title="삭제"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* 시세 및 손익 */}
                  <div className="grid grid-cols-3 gap-2 my-2 py-2 border-y border-white/5 bg-black/20 rounded-xl px-2.5">
                    <div>
                      <div className="text-[10px] text-gray-400">매수가</div>
                      <div className="text-xs font-black text-gray-300 font-mono">{apt.purchase_price_won}억</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-gray-400">추정 시세</div>
                      <div className="text-xs font-black text-white font-mono">
                        {ev ? `${ev.estimated_market_price_won}억` : '집계 중...'}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-gray-400">평가손익</div>
                      <div className={`text-xs font-black font-mono flex items-center gap-0.5 ${isProfit ? 'text-rose-400' : 'text-blue-400'}`}>
                        {ev ? `${isProfit ? '+' : ''}${ev.unrealized_gain_won}억 (${ev.return_pct}%)` : '-'}
                      </div>
                    </div>
                  </div>

                  {/* LTV & DSR & 2개년 시계열 안내 */}
                  <div className="flex items-center justify-between text-[11px] pt-1">
                    <span className="text-gray-400">
                      LTV <span className="font-bold text-gray-200 font-mono">{ev ? `${ev.ltv_pct}%` : '-'}</span> · 
                      DSR <span className="font-bold text-gray-200 font-mono">{ev ? `${ev.dsr_pct}%` : '-'}</span>
                    </span>
                    <span className="text-indigo-400 group-hover:text-indigo-300 font-semibold text-[10px] flex items-center gap-0.5">
                      2개년 실거래 시계열 차트 <ChevronRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
