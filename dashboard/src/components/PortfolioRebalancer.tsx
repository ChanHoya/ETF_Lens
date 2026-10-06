'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Cell,
  ReferenceLine
} from 'recharts';
import { API_BASE } from '@/lib/apiConfig';

export interface HoldingItem {
  code: string;
  name: string;
  current_price: number;
  current_qty: number;
  current_val: number;
}

interface RebalanceItem {
  code: string;
  name: string;
  current_price: number;
  current_qty: number;
  current_val: number;
  current_weight: number;
  target_weight: number;
  drift_pct: number;
  abs_drift: number;
  drift_status: 'ALIGNED' | 'DRIFT' | 'CRITICAL';
  action: 'BUY' | 'SELL' | 'HOLD';
  order_qty: number;
  order_val: number;
  post_qty: number;
  post_val: number;
  post_weight: number;
}

interface RebalanceResponse {
  total_current_val: number;
  cash_injection: number;
  target_total_val: number;
  post_total_val: number;
  drift_score: number;
  post_drift_score: number;
  mode: 'full' | 'cash_only';
  total_buy_val: number;
  total_sell_val: number;
  net_cash_flow: number;
  items: RebalanceItem[];
  prescription: {
    urgency: 'LOW' | 'MEDIUM' | 'HIGH';
    headline: string;
    action_guide: string;
    tax_tip: string;
  };
}

interface Props {
  initialHoldings?: HoldingItem[];
  accountNumber?: string;
  onRefreshHoldings?: () => void;
}

export default function PortfolioRebalancer({
  initialHoldings = [],
  accountNumber,
  onRefreshHoldings
}: Props) {
  // 1. 기본 보유 종목 fallback (전달받은 종목이 없을 때 대표 포트폴리오 제공)
  const defaultSampleHoldings: HoldingItem[] = [
    { code: '069500', name: 'KODEX 200', current_price: 34500, current_qty: 120, current_val: 4140000 },
    { code: '379800', name: 'TIGER 미국S&P500', current_price: 18200, current_qty: 450, current_val: 8190000 },
    { code: '133690', name: 'TIGER 미국나스닥100', current_price: 36500, current_qty: 180, current_val: 6570000 },
    { code: '305080', name: 'TIGER 미국채10년선물', current_price: 11400, current_qty: 150, current_val: 1710000 },
    { code: '453850', name: 'ACE 미국30년국채액티브(H)', current_price: 8900, current_qty: 100, current_val: 890000 },
  ];

  const holdings = useMemo(() => {
    if (initialHoldings && initialHoldings.length > 0) {
      return initialHoldings.filter(h => h.current_val > 0 || (h.current_price > 0 && h.current_qty > 0));
    }
    return defaultSampleHoldings;
  }, [initialHoldings]);

  // 2. 목표 비중 상태
  const [targetWeights, setTargetWeights] = useState<Record<string, number>>({});
  const [cashInjection, setCashInjection] = useState<number>(1000000); // 기본 100만 원
  const [mode, setMode] = useState<'cash_only' | 'full'>('cash_only');
  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<RebalanceResponse | null>(null);

  // 3. 프리셋 정의
  const PRESETS = [
    {
      id: 'equal',
      label: '⚖️ 균등 분배 (1/N)',
      desc: '모든 종목을 동일한 비중으로 균등 할당',
      apply: (hList: HoldingItem[]) => {
        const count = hList.length || 1;
        const equalVal = Math.round((100 / count) * 10) / 10;
        const res: Record<string, number> = {};
        hList.forEach((h, idx) => {
          res[h.code] = idx === count - 1 ? Math.round((100 - equalVal * (count - 1)) * 10) / 10 : equalVal;
        });
        return res;
      }
    },
    {
      id: 'balanced',
      label: '📈 주식 60 : 채권 40',
      desc: '지수/주식형 60%, 채권/안전자산 40% 표준 자산배분',
      apply: (hList: HoldingItem[]) => {
        const res: Record<string, number> = {};
        const bondCodes = ['305080', '453850', '329750', '444610', '148070'];
        const stockItems = hList.filter(h => !bondCodes.some(b => h.code.includes(b) || h.name.includes('채') || h.name.includes('국채')));
        const bondItems = hList.filter(h => !stockItems.includes(h));

        const stockWeight = stockItems.length > 0 ? 60 / stockItems.length : 0;
        const bondWeight = bondItems.length > 0 ? 40 / bondItems.length : 0;

        stockItems.forEach(h => res[h.code] = Math.round(stockWeight * 10) / 10);
        bondItems.forEach(h => res[h.code] = Math.round(bondWeight * 10) / 10);

        // 만약 채권이 하나도 없으면 균등 분배
        if (bondItems.length === 0) return PRESETS[0].apply(hList);
        return res;
      }
    },
    {
      id: 'growth',
      label: '🚀 글로벌 테크 성장 (80:20)',
      desc: '해외 테크 및 S&P500 80%, 기타 안전자산 20%',
      apply: (hList: HoldingItem[]) => {
        const res: Record<string, number> = {};
        const usTech = hList.filter(h => h.name.includes('미국') || h.name.includes('나스닥') || h.name.includes('S&P') || h.name.includes('반도체'));
        const others = hList.filter(h => !usTech.includes(h));

        const techW = usTech.length > 0 ? 80 / usTech.length : 0;
        const otherW = others.length > 0 ? 20 / others.length : 0;

        usTech.forEach(h => res[h.code] = Math.round(techW * 10) / 10);
        others.forEach(h => res[h.code] = Math.round(otherW * 10) / 10);

        if (usTech.length === 0) return PRESETS[0].apply(hList);
        return res;
      }
    }
  ];

  // 초기 마운트 시 균등 분배로 세팅
  useEffect(() => {
    if (holdings.length > 0) {
      const initial = PRESETS[0].apply(holdings);
      setTargetWeights(initial);
    }
  }, [holdings]);

  // 목표 비중 100% 자동 맞춤 정규화
  const handleNormalizeWeights = () => {
    const total = Object.values(targetWeights).reduce((a, b) => a + b, 0);
    if (total <= 0) return;
    const next: Record<string, number> = {};
    Object.entries(targetWeights).forEach(([code, val]) => {
      next[code] = Math.round((val / total) * 1000) / 10;
    });
    setTargetWeights(next);
  };

  // 비중 수정 핸들러
  const handleWeightChange = (code: string, val: number) => {
    setTargetWeights(prev => ({
      ...prev,
      [code]: Math.max(0, Math.min(100, Math.round(val * 10) / 10))
    }));
  };

  // 백엔드 리밸런싱 API 호출
  const runRebalanceCalculation = async () => {
    if (holdings.length === 0) return;
    setLoading(true);
    try {
      const payload = {
        holdings: holdings.map(h => ({
          code: h.code,
          name: h.name,
          current_price: h.current_price,
          current_qty: h.current_qty,
          current_val: h.current_val,
        })),
        target_weights: targetWeights,
        cash_injection: cashInjection,
        mode: mode
      };

      const res = await fetch(`${API_BASE}/api/v1/analyze/portfolio/rebalance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data: RebalanceResponse = await res.json();
      setResult(data);
    } catch (err) {
      console.error('리밸런싱 연산 오류:', err);
    } finally {
      setLoading(false);
    }
  };

  // targetWeights, cashInjection, mode 변경 시 자동 재계산
  useEffect(() => {
    const timer = setTimeout(() => {
      runRebalanceCalculation();
    }, 250);
    return () => clearTimeout(timer);
  }, [targetWeights, cashInjection, mode, holdings]);

  // 목표 비중 총합
  const totalTargetWeight = useMemo(() => {
    return Math.round(Object.values(targetWeights).reduce((a, b) => a + b, 0) * 10) / 10;
  }, [targetWeights]);

  // 차트 데이터 구성
  const chartData = useMemo(() => {
    if (!result || !result.items) return [];
    return result.items.map(item => ({
      name: item.name.length > 10 ? item.name.slice(0, 10) + '..' : item.name,
      fullName: item.name,
      code: item.code,
      '현재 비중': item.current_weight,
      '목표 비중': item.target_weight,
      '예상 비중': item.post_weight,
      drift_pct: item.drift_pct
    }));
  }, [result]);

  return (
    <div className="space-y-6">
      {/* ── 1. 상단 컨트롤 패널 & 프리셋 ────────────────────────────── */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur-sm">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-5 border-b border-slate-800/80">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">⚖️</span>
              <h2 className="text-xl font-bold text-white tracking-tight">
                스마트 리밸런싱 주문기 (Smart Rebalancer)
              </h2>
              <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                S6-32 NEW
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              목표 자산배분 비중 대비 현재 보유 상태의 괴리(Drift)를 진단하고, 매도 없는 캐시 인젝션 또는 완전 매매 플랜을 자동 계산합니다.
            </p>
          </div>

          {/* 리밸런싱 실행 모드 토글 */}
          <div className="flex items-center bg-slate-950/80 p-1 rounded-xl border border-slate-800 self-stretch md:self-auto">
            <button
              onClick={() => setMode('cash_only')}
              className={`flex-1 md:flex-initial px-4 py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                mode === 'cash_only'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>💡</span>
              <span>캐시 인젝션 (매도 0주)</span>
            </button>
            <button
              onClick={() => setMode('full')}
              className={`flex-1 md:flex-initial px-4 py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                mode === 'full'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>🔄</span>
              <span>전체 리밸런싱 (매도+매수)</span>
            </button>
          </div>
        </div>

        {/* 프리셋 버튼 및 추가 투입 현금 설정 */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 mt-5">
          {/* 프리셋 선택 */}
          <div className="lg:col-span-7 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300">🎯 목표 비중 프리셋 선택</span>
              <button
                onClick={handleNormalizeWeights}
                className="text-[11px] text-indigo-400 hover:text-indigo-300 font-medium transition"
              >
                비중 합계 100% 자동 맞춤
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {PRESETS.map(p => (
                <button
                  key={p.id}
                  onClick={() => setTargetWeights(p.apply(holdings))}
                  className="p-2.5 rounded-xl border border-slate-800 bg-slate-950/50 hover:bg-slate-800/60 hover:border-slate-700 transition text-left group"
                >
                  <div className="text-xs font-semibold text-slate-200 group-hover:text-white truncate">
                    {p.label}
                  </div>
                  <div className="text-[10px] text-slate-400 truncate mt-0.5">{p.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* 추가 투입 현금 (캐시 인젝션) */}
          <div className="lg:col-span-5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300">
                💰 추가 투입 현금 (신규 적립금)
              </span>
              <span className="text-xs font-mono font-bold text-emerald-400">
                {cashInjection.toLocaleString()} 원
              </span>
            </div>
            <div className="space-y-2">
              <input
                type="range"
                min={0}
                max={20000000}
                step={100000}
                value={cashInjection}
                onChange={e => setCashInjection(Number(e.target.value))}
                className="w-full accent-emerald-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
              />
              <div className="flex gap-1.5">
                {[0, 500000, 1000000, 3000000, 5000000].map(amt => (
                  <button
                    key={amt}
                    onClick={() => setCashInjection(amt)}
                    className={`flex-1 py-1 text-[11px] font-medium rounded-md border transition ${
                      cashInjection === amt
                        ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                        : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {amt === 0 ? '0원' : `${amt / 10000}만`}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── 2. Bento 요약 지표 카드 4종 ────────────────────────────── */}
      {result && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* 카드 1: 정렬 점수 */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
            <span className="text-xs font-semibold text-slate-400">포트폴리오 정렬 점수</span>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-2xl font-black text-white">{result.drift_score}점</span>
              <span className="text-xs font-semibold text-emerald-400">
                → {result.post_drift_score}점 (+{(result.post_drift_score - result.drift_score).toFixed(1)})
              </span>
            </div>
            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mt-3">
              <div
                className={`h-full transition-all duration-500 ${
                  result.drift_score >= 85
                    ? 'bg-emerald-500'
                    : result.drift_score >= 70
                    ? 'bg-amber-500'
                    : 'bg-rose-500'
                }`}
                style={{ width: `${result.drift_score}%` }}
              />
            </div>
          </div>

          {/* 카드 2: 총 자산 규모 */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
            <span className="text-xs font-semibold text-slate-400">총 자산 (투자 후)</span>
            <div className="mt-2">
              <div className="text-xl font-black text-white">
                {result.post_total_val.toLocaleString()} 원
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                기존 {result.total_current_val.toLocaleString()}원 + 투입 {result.cash_injection.toLocaleString()}원
              </div>
            </div>
            <div className="text-[11px] text-emerald-400 font-medium mt-2">
              순 현금흐름 {result.net_cash_flow.toLocaleString()}원
            </div>
          </div>

          {/* 카드 3: 매수 주문 총액 */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
            <span className="text-xs font-semibold text-slate-400">총 매수 주문액</span>
            <div className="text-xl font-black text-emerald-400 mt-2">
              +{result.total_buy_val.toLocaleString()} 원
            </div>
            <div className="text-[11px] text-slate-400 mt-2">
              {result.items.filter(i => i.action === 'BUY').length}개 종목 신규 매수
            </div>
          </div>

          {/* 카드 4: 매도 주문 총액 */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
            <span className="text-xs font-semibold text-slate-400">총 매도 주문액</span>
            <div className={`text-xl font-black mt-2 ${result.total_sell_val > 0 ? 'text-rose-400' : 'text-slate-400'}`}>
              -{result.total_sell_val.toLocaleString()} 원
            </div>
            <div className="text-[11px] text-slate-400 mt-2">
              {mode === 'cash_only' ? '💡 캐시인젝션: 매도 없음' : `${result.items.filter(i => i.action === 'SELL').length}개 종목 차익 실현`}
            </div>
          </div>
        </div>
      )}

      {/* ── 3. 비중 비교 차트 & 목표 비중 슬라이더 ────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* 비중 비교 막대 그래프 (7 cols) */}
        <div className="lg:col-span-7 bg-slate-900/80 border border-slate-800 rounded-2xl p-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <span>📊</span> 종목별 비중 괴리(Drift) 비교
            </h3>
            <div className="flex items-center gap-3 text-xs text-slate-400">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-slate-500 inline-block" /> 현재
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-indigo-500 inline-block" /> 목표
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" /> 조정 후
              </span>
            </div>
          </div>

          <div className="h-72 mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 25 }}>
                <XAxis
                  dataKey="name"
                  stroke="#64748b"
                  fontSize={11}
                  angle={-15}
                  textAnchor="end"
                  interval={0}
                />
                <YAxis stroke="#64748b" fontSize={11} unit="%" />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-slate-950 border border-slate-800 p-3 rounded-lg shadow-xl text-xs space-y-1">
                          <p className="font-bold text-white">{data.fullName}</p>
                          <p className="text-slate-400">현재 비중: <span className="text-slate-200 font-bold">{data['현재 비중']}%</span></p>
                          <p className="text-indigo-400">목표 비중: <span className="font-bold">{data['목표 비중']}%</span></p>
                          <p className="text-emerald-400">조정 후 비중: <span className="font-bold">{data['예상 비중']}%</span></p>
                          <p className={`font-semibold ${data.drift_pct > 0 ? 'text-rose-400' : 'text-sky-400'}`}>
                            비중 괴리: {data.drift_pct > 0 ? `+${data.drift_pct}` : data.drift_pct}%p
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="현재 비중" fill="#64748b" radius={[4, 4, 0, 0]} />
                <Bar dataKey="목표 비중" fill="#6366f1" radius={[4, 4, 0, 0]} />
                <Bar dataKey="예상 비중" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 목표 비중 커스텀 컨트롤러 (5 cols) */}
        <div className="lg:col-span-5 bg-slate-900/80 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>🎯</span> 종목별 목표 비중 커스텀
              </h3>
              <span className={`text-xs font-mono font-bold ${
                Math.abs(totalTargetWeight - 100) < 0.1 ? 'text-emerald-400' : 'text-amber-400'
              }`}>
                합계: {totalTargetWeight}%
              </span>
            </div>

            <div className="space-y-3.5 mt-4 max-h-64 overflow-y-auto pr-1">
              {holdings.map(h => {
                const currentWeight = targetWeights[h.code] || 0;
                return (
                  <div key={h.code} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-300 font-medium truncate max-w-[170px]" title={h.name}>
                        {h.name}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          step="1"
                          min="0"
                          max="100"
                          value={currentWeight}
                          onChange={e => handleWeightChange(h.code, Number(e.target.value))}
                          className="w-14 px-1.5 py-0.5 bg-slate-950 border border-slate-800 rounded text-right text-xs font-mono font-bold text-indigo-400 focus:outline-none focus:border-indigo-500"
                        />
                        <span className="text-slate-400 text-xs">%</span>
                      </div>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="0.5"
                      value={currentWeight}
                      onChange={e => handleWeightChange(h.code, Number(e.target.value))}
                      className="w-full accent-indigo-500 h-1 bg-slate-800 rounded cursor-pointer"
                    />
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span>슬라이더로 직접 조절하거나 100% 자동 맞춤을 누르세요.</span>
            <button
              onClick={handleNormalizeWeights}
              className="px-2.5 py-1 bg-indigo-500/20 text-indigo-400 border border-indigo-500/40 rounded-md font-semibold hover:bg-indigo-500/30 transition"
            >
              100% 정규화
            </button>
          </div>
        </div>
      </div>

      {/* ── 4. 스마트 리밸런싱 실행 계획표 (Execution Order Table) ─── */}
      {result && result.items && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="p-4 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <span>📋</span> 리밸런싱 실행 주문표 (Execution Orders)
            </h3>
            <span className="text-xs text-slate-400">
              {mode === 'cash_only' ? '💡 저비중 종목만 우선 매수' : '🔄 전 종목 목표 비중 완전 일치'}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-950/40 text-slate-400 border-b border-slate-800/80">
                <tr>
                  <th className="py-2.5 px-4 font-semibold">종목명 / 코드</th>
                  <th className="py-2.5 px-3 font-semibold text-right">현재가</th>
                  <th className="py-2.5 px-3 font-semibold text-right">현재 비중</th>
                  <th className="py-2.5 px-3 font-semibold text-right">목표 비중</th>
                  <th className="py-2.5 px-3 font-semibold text-right">비중 괴리</th>
                  <th className="py-2.5 px-3 font-semibold text-center">주문 액션</th>
                  <th className="py-2.5 px-3 font-semibold text-right">주문 수량</th>
                  <th className="py-2.5 px-3 font-semibold text-right">주문 금액</th>
                  <th className="py-2.5 px-4 font-semibold text-right">조정 후 예상 비중</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {result.items.map(item => (
                  <tr key={item.code} className="hover:bg-slate-800/30 transition">
                    <td className="py-3 px-4">
                      <div className="font-bold text-white">{item.name}</div>
                      <div className="text-[11px] text-slate-400 font-mono">{item.code}</div>
                    </td>
                    <td className="py-3 px-3 text-right font-mono">
                      {item.current_price.toLocaleString()}원
                    </td>
                    <td className="py-3 px-3 text-right font-mono">
                      {item.current_weight}%
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-semibold text-indigo-400">
                      {item.target_weight}%
                    </td>
                    <td className="py-3 px-3 text-right font-mono">
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[11px] font-bold ${
                        item.drift_status === 'CRITICAL'
                          ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          : item.drift_status === 'DRIFT'
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      }`}>
                        {item.drift_pct > 0 ? `+${item.drift_pct}` : item.drift_pct}%p
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-bold ${
                        item.action === 'BUY'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                          : item.action === 'SELL'
                          ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                          : 'bg-slate-800 text-slate-400'
                      }`}>
                        {item.action === 'BUY' ? '매수' : item.action === 'SELL' ? '매도' : '유지'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold">
                      {item.order_qty > 0 ? (
                        <span className={item.action === 'BUY' ? 'text-emerald-400' : 'text-rose-400'}>
                          {item.order_qty.toLocaleString()} 주
                        </span>
                      ) : (
                        <span className="text-slate-500">-</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold">
                      {item.order_val > 0 ? (
                        <span className={item.action === 'BUY' ? 'text-emerald-400' : 'text-rose-400'}>
                          {item.action === 'BUY' ? '+' : '-'}{item.order_val.toLocaleString()} 원
                        </span>
                      ) : (
                        <span className="text-slate-500">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-semibold text-emerald-400">
                      {item.post_weight}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── 5. CFP & AI 리밸런싱 처방 가이드 ──────────────────────────── */}
      {result && result.prescription && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">🩺</span>
            <h4 className="text-sm font-bold text-white">CFP & AI 리스크 리밸런싱 처방전</h4>
            <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
              result.prescription.urgency === 'HIGH'
                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                : result.prescription.urgency === 'MEDIUM'
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
            }`}>
              시급도: {result.prescription.urgency}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="bg-slate-950/50 p-3.5 rounded-xl border border-slate-800/80 space-y-1.5">
              <div className="font-bold text-slate-200">{result.prescription.headline}</div>
              <p className="text-slate-400 leading-relaxed">{result.prescription.action_guide}</p>
            </div>
            <div className="bg-slate-950/50 p-3.5 rounded-xl border border-slate-800/80 space-y-1.5">
              <div className="font-bold text-indigo-300">💡 절세 및 수수료 절감 가이드</div>
              <p className="text-slate-400 leading-relaxed">{result.prescription.tax_tip}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
