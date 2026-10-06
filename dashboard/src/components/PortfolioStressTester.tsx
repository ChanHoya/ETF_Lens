'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ShieldAlert, ShieldCheck, AlertTriangle, TrendingDown,
  DollarSign, Activity, Sparkles, RefreshCw, Layers, CheckCircle2,
  ArrowDownRight, ArrowUpRight, Percent, Info, HelpCircle, ChevronRight
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip,
  CartesianGrid, Cell, ReferenceLine
} from 'recharts';
import { API_BASE } from '@/lib/apiConfig';

interface HoldingItem {
  code: string;
  name: string;
  eval_amount?: number;
  weight?: number;
  account_no?: string;
  qty?: number;
}

interface PortfolioStressTesterProps {
  holdings: HoldingItem[];
}

export default function PortfolioStressTester({ holdings }: PortfolioStressTesterProps) {
  const [selectedAccount, setSelectedAccount] = useState<string>('ALL');
  const [activeScenarioKey, setActiveScenarioKey] = useState<string>('covid_2020');
  const [customTotalEval, setCustomTotalEval] = useState<number>(0);
  const [isCustomMode, setIsCustomMode] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [stressData, setStressData] = useState<any>(null);

  // 계좌 목록 추출
  const accountList = useMemo(() => {
    if (!holdings) return [];
    const accounts = Array.from(new Set(holdings.map(h => h.account_no).filter(Boolean))) as string[];
    return accounts;
  }, [holdings]);

  // 선택된 계좌의 종목 필터링
  const filteredHoldings = useMemo(() => {
    if (!holdings || holdings.length === 0) return [];
    if (selectedAccount === 'ALL') return holdings;
    return holdings.filter(h => h.account_no === selectedAccount);
  }, [holdings, selectedAccount]);

  // 실계좌 총 평가금액 계산
  const calculatedTotalEval = useMemo(() => {
    return filteredHoldings.reduce((sum, h) => sum + (h.eval_amount || 0), 0);
  }, [filteredHoldings]);

  // 실제 적용 평가금액
  const effectiveTotalEval = isCustomMode && customTotalEval > 0
    ? customTotalEval
    : (calculatedTotalEval > 0 ? calculatedTotalEval : 100_000_000);

  // 스트레스 테스트 API 호출
  const fetchStressTest = useCallback(async () => {
    if (!filteredHoldings || filteredHoldings.length === 0) return;

    setLoading(true);
    setError(null);

    try {
      const validHoldings = filteredHoldings.filter(h => (h.eval_amount || 0) > 0 || (h.weight || 0) > 0);
      const totalAmount = validHoldings.reduce((acc, h) => acc + (h.eval_amount || 0), 0);

      const portfolioPayload = validHoldings.map(h => {
        const weight = totalAmount > 0
          ? (h.eval_amount || 0) / totalAmount
          : (1 / validHoldings.length);
        return {
          code: h.code,
          weight: Math.round(weight * 1000) / 1000,
        };
      });

      const res = await fetch(`${API_BASE}/api/v1/analyze/portfolio/stress-test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          portfolio: portfolioPayload,
          total_eval_amount: effectiveTotalEval,
        }),
      });

      if (!res.ok) {
        throw new Error('스트레스 테스터 연산 요청에 실패했습니다.');
      }

      const json = await res.json();
      if (json.status === 'error') {
        throw new Error(json.message);
      }

      setStressData(json);
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : '스트레스 테스트를 실행하지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [filteredHoldings, effectiveTotalEval]);

  useEffect(() => {
    fetchStressTest();
  }, [fetchStressTest]);

  // 현재 활성 시나리오 데이터
  const activeScenario = useMemo(() => {
    if (!stressData) return null;
    return stressData[activeScenarioKey] || null;
  }, [stressData, activeScenarioKey]);

  // 7대 시나리오 비교 차트 데이터
  const comparisonChartData = useMemo(() => {
    if (!stressData) return [];
    return Object.keys(stressData).map(key => {
      const sc = stressData[key];
      return {
        key,
        name: sc.scenario_name.split(' (')[0],
        returnRate: sc.portfolio_return,
        marketMdd: sc.market_mdd,
        defenseScore: sc.defense_score,
      };
    });
  }, [stressData]);

  const formatManwon = (amount: number) => {
    const manwon = Math.round(amount / 10000);
    return new Intl.NumberFormat('ko-KR').format(manwon);
  };

  return (
    <div className="w-full bg-slate-900/60 border border-white/10 rounded-3xl p-4 md:p-6 backdrop-blur-xl shadow-2xl flex flex-col gap-6">
      {/* ── 1. 헤더 & 계좌 컨트롤러 ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-rose-500/20 text-rose-400 rounded-xl border border-rose-500/30">
              <ShieldAlert className="w-5 h-5" />
            </span>
            <h2 className="text-xl md:text-2xl font-black tracking-tight text-white flex items-center gap-2">
              포트폴리오 스트레스 테스터
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 font-semibold">
                7대 글로벌 위기 충격 진단
              </span>
            </h2>
          </div>
          <p className="text-xs md:text-sm text-gray-400 mt-1">
            역사적 금융 위기 재현 시 내 실계좌의 예상 하락률(MDD), 원화(KRW) 손실액 및 방어력을 정밀 진단합니다.
          </p>
        </div>

        {/* 계좌 선택 및 재연산 버튼 */}
        <div className="flex items-center gap-2 flex-wrap">
          {accountList.length > 0 && (
            <div className="flex bg-black/40 p-1 rounded-xl border border-white/10 text-xs">
              <button
                onClick={() => setSelectedAccount('ALL')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                  selectedAccount === 'ALL'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                전체 계좌
              </button>
              {accountList.map(acc => (
                <button
                  key={acc}
                  onClick={() => setSelectedAccount(acc)}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                    selectedAccount === acc
                      ? 'bg-indigo-600 text-white shadow'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {acc.slice(-4)} 계좌
                </button>
              ))}
            </div>
          )}

          <button
            onClick={fetchStressTest}
            disabled={loading}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-600/80 hover:bg-rose-600 text-white font-bold rounded-xl text-xs transition-colors shadow-lg shadow-rose-900/30 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>위기 충격 재계산</span>
          </button>
        </div>
      </div>

      {/* 평가금액 안내 & 임의 조정 토글 */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-black/30 p-3.5 rounded-2xl border border-white/5 text-xs text-gray-300">
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-indigo-400 shrink-0" />
          <span>
            현재 진단 적용 원금: <strong className="text-white font-bold">{formatManwon(effectiveTotalEval)}만 원</strong>
            {calculatedTotalEval > 0 && !isCustomMode && (
              <span className="text-gray-400 ml-1.5">(실계좌 평가금액 자동 적용)</span>
            )}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setIsCustomMode(!isCustomMode);
              if (!isCustomMode && customTotalEval === 0) {
                setCustomTotalEval(calculatedTotalEval > 0 ? calculatedTotalEval : 100_000_000);
              }
            }}
            className="text-[11px] text-indigo-400 hover:text-indigo-300 underline font-medium"
          >
            {isCustomMode ? '실계좌 금액으로 복원' : '원금 직접 입력 시뮬레이션'}
          </button>

          {isCustomMode && (
            <div className="flex items-center gap-1 bg-black/60 px-2 py-1 rounded-lg border border-white/10">
              <input
                type="number"
                value={customTotalEval ? customTotalEval / 10000 : ''}
                onChange={(e) => setCustomTotalEval(Number(e.target.value) * 10000)}
                placeholder="10000"
                className="w-20 bg-transparent text-white text-right font-mono focus:outline-none"
              />
              <span className="text-gray-400 text-xs">만 원</span>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ── 2. 7대 시나리오 탭 셀렉터 ── */}
      {stressData && (
        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-rose-400" />
            7대 역사적 위기 시나리오 선택
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-2">
            {Object.keys(stressData).map(key => {
              const sc = stressData[key];
              const isSelected = activeScenarioKey === key;
              const isPositive = sc.portfolio_return >= 0;

              return (
                <button
                  key={key}
                  onClick={() => setActiveScenarioKey(key)}
                  className={`flex flex-col text-left p-3 rounded-2xl border transition-all relative overflow-hidden ${
                    isSelected
                      ? 'bg-gradient-to-b from-rose-500/20 to-slate-900 border-rose-500/50 shadow-lg shadow-rose-950/40'
                      : 'bg-black/30 border-white/5 hover:border-white/20 hover:bg-black/50'
                  }`}
                >
                  <span className="text-[10px] text-gray-400 font-semibold truncate">{sc.badge}</span>
                  <span className="text-xs font-bold text-white mt-0.5 truncate">{sc.scenario_name.split(' (')[0]}</span>
                  <div className="mt-2 flex items-baseline justify-between">
                    <span className={`text-sm font-black font-mono ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {sc.portfolio_return > 0 ? `+${sc.portfolio_return}%` : `${sc.portfolio_return}%`}
                    </span>
                    <span className="text-[10px] text-gray-500 font-mono">{sc.period.split(' ')[0]}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── 3. 선택된 시나리오 세부 요약 Bento Grid ── */}
      {activeScenario && (
        <div className="flex flex-col gap-6">
          {/* 시나리오 상황 설명 배너 */}
          <div className="bg-gradient-to-r from-rose-950/30 via-slate-900 to-indigo-950/30 border border-white/10 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-bold border border-rose-500/30">
                  {activeScenario.period}
                </span>
                <h3 className="text-base font-bold text-white">{activeScenario.scenario_name}</h3>
              </div>
              <p className="text-xs text-gray-300 mt-1.5">{activeScenario.description}</p>
              <p className="text-[11px] text-gray-500 mt-0.5 italic">💡 {activeScenario.summary}</p>
            </div>
            <div className="shrink-0 text-right bg-black/40 px-3.5 py-2 rounded-xl border border-white/5">
              <span className="text-[10px] text-gray-400 block">당시 시장 최대낙폭</span>
              <span className="text-base font-black text-rose-400 font-mono">{activeScenario.market_mdd}%</span>
            </div>
          </div>

          {/* 4대 요약 Bento 카드 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. 예상 포트폴리오 낙폭 (MDD) */}
            <div className="bg-black/40 border border-white/10 rounded-2xl p-4.5 relative overflow-hidden flex flex-col justify-between">
              <div>
                <span className="text-[11px] font-bold text-gray-400 flex items-center gap-1.5">
                  <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
                  예상 포트폴리오 낙폭 (MDD)
                </span>
                <div className="mt-2 flex items-baseline gap-1.5">
                  <span className="text-3xl font-black text-rose-400 font-mono tracking-tight">
                    -{activeScenario.expected_mdd}%
                  </span>
                </div>
              </div>
              <div className="mt-3 pt-2.5 border-t border-white/5 text-[11px] text-gray-400">
                {activeScenario.market_mdd < -activeScenario.expected_mdd ? (
                  <span className="text-emerald-400 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> 시장(-{Math.abs(activeScenario.market_mdd)}%) 대비 {(Math.abs(activeScenario.market_mdd) - activeScenario.expected_mdd).toFixed(1)}%p 선방
                  </span>
                ) : (
                  <span className="text-rose-400 font-semibold flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> 시장 대비 변동성 확대 위험
                  </span>
                )}
              </div>
            </div>

            {/* 2. 예상 원화 손실액 */}
            <div className="bg-black/40 border border-white/10 rounded-2xl p-4.5 relative overflow-hidden flex flex-col justify-between">
              <div>
                <span className="text-[11px] font-bold text-gray-400 flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-rose-400" />
                  예상 원화 평가손실액 (KRW)
                </span>
                <div className="mt-2 flex items-baseline gap-1.5">
                  <span className="text-3xl font-black text-rose-400 font-mono tracking-tight">
                    {formatManwon(activeScenario.expected_loss_amount)}만 원
                  </span>
                </div>
              </div>
              <div className="mt-3 pt-2.5 border-t border-white/5 text-[11px] text-gray-400 flex justify-between">
                <span>위기 시점 잔여 자산</span>
                <strong className="text-white font-mono">{formatManwon(activeScenario.remained_asset_amount)}만 원</strong>
              </div>
            </div>

            {/* 3. 위기 방어 지수 */}
            <div className="bg-black/40 border border-white/10 rounded-2xl p-4.5 relative overflow-hidden flex flex-col justify-between">
              <div>
                <span className="text-[11px] font-bold text-gray-400 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  위기 방어 지수 (Defense Score)
                </span>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-3xl font-black text-white font-mono tracking-tight">
                    {activeScenario.defense_score}
                  </span>
                  <span className="text-xs text-gray-500 font-bold">/ 100점</span>
                </div>
              </div>
              <div className="mt-3 pt-2.5 border-t border-white/5 flex items-center justify-between">
                <span className="text-[11px] text-gray-400">판정 등급</span>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-white/10 text-white border border-white/10">
                  {activeScenario.risk_badge}
                </span>
              </div>
            </div>

            {/* 4. 95% Historical VaR */}
            <div className="bg-black/40 border border-white/10 rounded-2xl p-4.5 relative overflow-hidden flex flex-col justify-between">
              <div>
                <span className="text-[11px] font-bold text-gray-400 flex items-center gap-1.5">
                  <Percent className="w-3.5 h-3.5 text-amber-400" />
                  95% Historical VaR
                </span>
                <div className="mt-2 flex items-baseline gap-1.5">
                  <span className="text-3xl font-black text-amber-400 font-mono tracking-tight">
                    -{activeScenario.estimated_var}%
                  </span>
                </div>
              </div>
              <div className="mt-3 pt-2.5 border-t border-white/5 text-[10px] text-gray-400">
                1개월 95% 신뢰수준 최대 허용 한계 손실률
              </div>
            </div>
          </div>

          {/* ── 4. 7대 시나리오 한눈에 비교 Recharts 바 차트 ── */}
          <div className="bg-black/35 border border-white/10 rounded-2xl p-4 md:p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-indigo-400" />
                7대 위기 시나리오별 포트폴리오 예상 수익률 비교
              </h4>
              <span className="text-[11px] text-gray-500">붉은 막대: 예상 낙폭(%)</span>
            </div>

            <div className="w-full h-56 mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={comparisonChartData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                  <XAxis
                    dataKey="name"
                    stroke="#ffffff40"
                    fontSize={11}
                    tickLine={false}
                    interval={0}
                    angle={-15}
                    textAnchor="end"
                  />
                  <YAxis
                    stroke="#ffffff40"
                    fontSize={11}
                    tickLine={false}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(15, 23, 42, 0.95)',
                      borderColor: 'rgba(255,255,255,0.1)',
                      borderRadius: '0.75rem',
                      fontSize: '12px',
                    }}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    formatter={(val: any) => [`${val}%`, '예상 수익률']}
                  />
                  <ReferenceLine y={0} stroke="#ffffff40" />
                  <Bar dataKey="returnRate" radius={[4, 4, 0, 0]}>
                    {comparisonChartData.map((entry) => (
                      <Cell
                        key={entry.key}
                        fill={
                          entry.key === activeScenarioKey
                            ? '#f43f5e'
                            : entry.returnRate >= 0
                            ? '#10b981'
                            : '#64748b'
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ── 5. 최다 타격 종목 vs 방어 효자 종목 2열 카드 ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 좌측: 최다 타격 종목 TOP 3 */}
            <div className="bg-rose-950/20 border border-rose-500/20 rounded-2xl p-4 flex flex-col gap-3">
              <h4 className="text-xs font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                <TrendingDown className="w-4 h-4" />
                🩸 시나리오 내 최대 타격 종목 (Worst Impact)
              </h4>
              <div className="space-y-2 mt-1">
                {activeScenario.worst_impact_items.map((item: any, idx: number) => (
                  <div key={item.code} className="bg-black/40 p-2.5 rounded-xl border border-white/5 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 truncate max-w-[65%]">
                      <span className="w-4 h-4 rounded-full bg-rose-500/20 text-rose-300 flex items-center justify-center text-[10px] font-bold">
                        {idx + 1}
                      </span>
                      <div className="truncate">
                        <span className="text-white font-medium block truncate">{item.name}</span>
                        <span className="text-[10px] text-gray-500 font-mono">{item.code} • 비중 {item.weight}%</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-rose-400 font-bold font-mono block">
                        {item.expected_return}%
                      </span>
                      {item.item_loss_amount !== 0 && (
                        <span className="text-[10px] text-gray-400 font-mono">
                          {formatManwon(item.item_loss_amount)}만 원
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 우측: 방어 효자 종목 TOP 3 */}
            <div className="bg-emerald-950/20 border border-emerald-500/20 rounded-2xl p-4 flex flex-col gap-3">
              <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" />
                🛡️ 시나리오 내 방어·수익 효자 종목 (Best Shield)
              </h4>
              <div className="space-y-2 mt-1">
                {activeScenario.best_shield_items.map((item: any, idx: number) => (
                  <div key={item.code} className="bg-black/40 p-2.5 rounded-xl border border-white/5 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 truncate max-w-[65%]">
                      <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-300 flex items-center justify-center text-[10px] font-bold">
                        {idx + 1}
                      </span>
                      <div className="truncate">
                        <span className="text-white font-medium block truncate">{item.name}</span>
                        <span className="text-[10px] text-gray-500 font-mono">{item.code} • 비중 {item.weight}%</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className={`font-bold font-mono block ${item.expected_return >= 0 ? 'text-emerald-400' : 'text-gray-300'}`}>
                        {item.expected_return > 0 ? `+${item.expected_return}%` : `${item.expected_return}%`}
                      </span>
                      {item.item_loss_amount !== 0 && (
                        <span className="text-[10px] text-gray-400 font-mono">
                          {formatManwon(item.item_loss_amount)}만 원
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── 6. 전체 종목별 손익 기여도 분해 테이블 ── */}
          <div className="bg-black/35 border border-white/10 rounded-2xl overflow-hidden flex flex-col">
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-indigo-400" />
                포트폴리오 전체 종목별 충격 상세 분해
              </h4>
              <span className="text-[11px] text-gray-500">총 {activeScenario.details.length}개 종목</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-gray-300">
                <thead className="bg-black/40 text-[11px] uppercase text-gray-400 font-semibold border-b border-white/5">
                  <tr>
                    <th className="py-2.5 px-4">종목명 (코드)</th>
                    <th className="py-2.5 px-3 text-right">보유 비중</th>
                    <th className="py-2.5 px-3 text-right">평가금액</th>
                    <th className="py-2.5 px-3 text-right">시나리오 등락률</th>
                    <th className="py-2.5 px-4 text-right">예상 평가손익</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {activeScenario.details.map((item: any) => (
                    <tr key={item.code} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-2.5 px-4">
                        <div className="flex flex-col">
                          <span className="text-white font-medium truncate max-w-[200px] sm:max-w-xs">{item.name}</span>
                          <span className="text-[10px] text-gray-500 font-mono">{item.code}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-gray-300">
                        {item.weight}%
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-gray-300">
                        {formatManwon(item.item_eval_amount)}만 원
                      </td>
                      <td className={`py-2.5 px-3 text-right font-mono font-bold ${item.expected_return >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {item.expected_return > 0 ? `+${item.expected_return}%` : `${item.expected_return}%`}
                      </td>
                      <td className={`py-2.5 px-4 text-right font-mono font-bold ${item.item_loss_amount >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {formatManwon(item.item_loss_amount)}만 원
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── 7. 🛡️ CFP & AI 리스크 헷지 처방전 ── */}
          {activeScenario.prescription && (
            <div className="bg-gradient-to-br from-indigo-950/40 via-slate-900 to-purple-950/30 border border-indigo-500/30 rounded-2xl p-4 md:p-6 flex flex-col gap-4 shadow-xl">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  CFP 전문가 & AI 리스크 헷지 처방전
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-semibold">
                    맞춤형 방어 가이드
                  </span>
                </h4>
              </div>

              {/* 진단 & 행동 권고 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="bg-black/40 p-3.5 rounded-xl border border-white/5 flex flex-col gap-1">
                  <span className="text-gray-400 font-semibold">🩺 현재 포트폴리오 진단</span>
                  <p className="text-gray-200 mt-1 leading-relaxed">{activeScenario.prescription.diagnosis}</p>
                </div>
                <div className="bg-black/40 p-3.5 rounded-xl border border-white/5 flex flex-col gap-1">
                  <span className="text-indigo-400 font-semibold">🎯 즉각적인 방어 조치 (Action Plan)</span>
                  <p className="text-gray-200 mt-1 leading-relaxed">{activeScenario.prescription.action}</p>
                </div>
              </div>

              {/* 시뮬레이션: 15% 헷지 편입 시 효과 */}
              {activeScenario.prescription.mdd_relief_simulation && (
                <div className="bg-indigo-900/20 border border-indigo-500/30 rounded-xl p-3 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2 text-indigo-300">
                    <ShieldCheck className="w-4 h-4 text-indigo-400 shrink-0" />
                    <span>{activeScenario.prescription.mdd_relief_simulation.message}</span>
                  </div>
                  <div className="shrink-0 bg-indigo-500/20 px-2.5 py-1 rounded-lg border border-indigo-500/30 font-mono font-bold text-indigo-200 text-xs">
                    낙폭 -{activeScenario.prescription.mdd_relief_simulation.relief_points}%p 완화
                  </div>
                </div>
              )}

              {/* 추천 헷지 ETF 라인업 */}
              {activeScenario.prescription.recommendations && activeScenario.prescription.recommendations.length > 0 && (
                <div>
                  <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-2">
                    권장 헷지(하방 완충) ETF 라인업
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {activeScenario.prescription.recommendations.map((rec: any) => (
                      <div key={rec.code} className="bg-black/50 p-3 rounded-xl border border-white/10 flex flex-col justify-between text-xs">
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-white truncate">{rec.name}</span>
                            <span className="text-[10px] text-gray-500 font-mono">{rec.code}</span>
                          </div>
                          <span className="text-[11px] text-indigo-300 mt-1 block">{rec.type}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
