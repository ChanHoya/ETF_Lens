'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ReferenceLine
} from 'recharts';
import {
  Sparkles, TrendingUp, TrendingDown, Activity, RefreshCw,
  Sliders, ShieldCheck, Layers, Calendar, DollarSign, Percent
} from 'lucide-react';
import { API_BASE } from '@/lib/apiConfig';

export interface BacktestAssetItem {
  code: string;
  name: string;
  weight: number;
}

interface MetricData {
  total_return: number;
  bench_total_return: number;
  cagr: number;
  bench_cagr: number;
  volatility: number;
  sharpe: number;
  mdd: number;
  bench_mdd: number;
  alpha: number;
}

interface TimeSeriesPoint {
  date: string;
  portfolio_val: number;
  benchmark_val: number;
  portfolio_return: number;
  benchmark_return: number;
  drawdown: number;
}

interface BacktestResponse {
  status: string;
  initial_capital: number;
  final_capital: number;
  years: number;
  rebalance_freq: string;
  benchmark_code: string;
  assets: BacktestAssetItem[];
  metrics: MetricData;
  time_series: TimeSeriesPoint[];
}

interface Props {
  holdings?: Array<{ code: string; name: string; current_val?: number; weight?: number }>;
}

export default function MultiAssetBacktester({ holdings = [] }: Props) {
  // 대표 프리셋 목록
  const PRESET_OPTIONS = [
    {
      id: 'all_weather',
      label: '👑 올웨더 (All Weather)',
      desc: '주식30 / 장기채40 / 중기채15 / 원자재7.5 / 금7.5',
      assets: [
        { code: '379800', name: 'TIGER 미국S&P500', weight: 30 },
        { code: '453850', name: 'ACE 미국30년국채액티브(H)', weight: 40 },
        { code: '305080', name: 'TIGER 미국채10년선물', weight: 15 },
        { code: '334690', name: 'TIGER 구리실물', weight: 7.5 },
        { code: '394670', name: 'TIGER 골드선물(H)', weight: 7.5 },
      ]
    },
    {
      id: 'classic_60_40',
      label: '📈 정통 60 : 40',
      desc: 'S&P500 60% + 미국 국채 40%',
      assets: [
        { code: '379800', name: 'TIGER 미국S&P500', weight: 60 },
        { code: '305080', name: 'TIGER 미국채10년선물', weight: 40 },
      ]
    },
    {
      id: 'income_growth',
      label: '🚀 연금 바벨 (성장+인컴)',
      desc: '나스닥50 + 배당다우존스30 + CD금리20',
      assets: [
        { code: '133690', name: 'TIGER 미국나스닥100', weight: 50 },
        { code: '411060', name: 'ACE 미국배당다우존스', weight: 30 },
        { code: '449170', name: 'KODEX CD금리액티브', weight: 20 },
      ]
    }
  ];

  const [assets, setAssets] = useState<BacktestAssetItem[]>(PRESET_OPTIONS[0].assets);
  const [years, setYears] = useState<number>(3);
  const [rebalanceFreq, setRebalanceFreq] = useState<string>('quarterly');
  const [initialCapital, setInitialCapital] = useState<number>(10000000);
  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<BacktestResponse | null>(null);

  // 실보유 종목 불러오기
  const handleLoadMyAssets = () => {
    if (!holdings || holdings.length === 0) return;
    const total = holdings.reduce((sum, h) => sum + (h.current_val || 0), 0) || 1;
    const myAssets: BacktestAssetItem[] = holdings.slice(0, 5).map(h => ({
      code: h.code,
      name: h.name,
      weight: Math.round(((h.current_val || 0) / total) * 1000) / 10
    }));
    setAssets(myAssets);
  };

  // 백테스트 API 호출
  const runBacktest = async () => {
    if (assets.length === 0) return;
    setLoading(true);
    try {
      const payload = {
        assets: assets.map(a => ({ code: a.code, name: a.name, weight: a.weight })),
        initial_capital: initialCapital,
        years: years,
        rebalance_freq: rebalanceFreq,
        benchmark_code: '379800'
      };

      const res = await fetch(`${API_BASE}/api/v1/my/backtest/multi`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const json: BacktestResponse = await res.json();
        setResult(json);
      }
    } catch (err) {
      console.error('Error running multi-asset backtest:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runBacktest();
  }, [years, rebalanceFreq]);

  // 비중 변경 핸들러
  const handleWeightChange = (code: string, newWeight: number) => {
    setAssets(prev => prev.map(a => a.code === code ? { ...a, weight: Number(newWeight) } : a));
  };

  // 비중 100% 정규화
  const handleNormalizeWeights = () => {
    const total = assets.reduce((sum, a) => sum + a.weight, 0);
    if (total <= 0) return;
    setAssets(prev => prev.map(a => ({
      ...a,
      weight: Math.round((a.weight / total) * 1000) / 10
    })));
  };

  const totalWeight = useMemo(() => {
    return Math.round(assets.reduce((sum, a) => sum + a.weight, 0) * 10) / 10;
  }, [assets]);

  return (
    <div className="space-y-6">
      {/* ── 1. 상단 컨트롤 패널 & 프리셋 ────────────────────────────── */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur-sm">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-5 border-b border-slate-800/80">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">🧪</span>
              <h2 className="text-xl font-bold text-white tracking-tight">
                올웨더 & 멀티 자산배분 백테스터 2.0 (Multi-Asset Backtester)
              </h2>
              <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                S6-34 NEW
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              복수 ETF 조합의 과거 1~5년 과거 수익률, 변동성, 샤프지수, 최대낙폭(MDD) 및 리밸런싱 주기별 성과를 시뮬레이션합니다.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {holdings && holdings.length > 0 && (
              <button
                onClick={handleLoadMyAssets}
                className="px-3 py-1.5 bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/40 text-indigo-300 text-xs font-semibold rounded-lg transition"
              >
                💼 내 보유자산 불러오기
              </button>
            )}
            <button
              onClick={runBacktest}
              disabled={loading}
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg shadow-md transition flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              시뮬레이션 실행
            </button>
          </div>
        </div>

        {/* 프리셋 및 시뮬레이션 설정 컨트롤 */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 mt-5">
          {/* 프리셋 선택 (7 cols) */}
          <div className="lg:col-span-7 space-y-2">
            <span className="text-xs font-semibold text-slate-300">🎯 전략 프리셋</span>
            <div className="grid grid-cols-3 gap-2">
              {PRESET_OPTIONS.map(p => (
                <button
                  key={p.id}
                  onClick={() => {
                    setAssets(p.assets);
                  }}
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

          {/* 기간 및 리밸런싱 주기 설정 (5 cols) */}
          <div className="lg:col-span-5 grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-slate-300">📅 검증 기간</span>
              <div className="grid grid-cols-3 gap-1">
                {[1, 3, 5].map(y => (
                  <button
                    key={y}
                    onClick={() => setYears(y)}
                    className={`py-1.5 text-xs font-semibold rounded-lg border transition ${
                      years === y
                        ? 'bg-indigo-600 border-indigo-500 text-white'
                        : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {y}년
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-slate-300">🔄 리밸런싱 주기</span>
              <select
                value={rebalanceFreq}
                onChange={e => setRebalanceFreq(e.target.value)}
                className="w-full py-1.5 px-2 bg-slate-950 border border-slate-800 text-xs font-semibold text-white rounded-lg focus:outline-none"
              >
                <option value="monthly">월간 (Monthly)</option>
                <option value="quarterly">분기 (Quarterly)</option>
                <option value="annually">연간 (Annually)</option>
                <option value="none">미실시 (Buy & Hold)</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* ── 2. Bento 성과 메트릭 요약 카드 ────────────────────────────── */}
      {result && result.metrics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* 카드 1: 누적 수익률 */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
            <span className="text-xs font-semibold text-slate-400">누적 수익률 ({years}년)</span>
            <div className="mt-2">
              <div className={`text-2xl font-black ${result.metrics.total_return >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {result.metrics.total_return >= 0 ? `+${result.metrics.total_return}%` : `${result.metrics.total_return}%`}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                최종 {result.final_capital.toLocaleString()}원 (초기 {result.initial_capital.toLocaleString()}원)
              </div>
            </div>
            <div className="text-[11px] text-indigo-400 mt-2 font-medium">
              S&P500 대비 초과수익 {result.metrics.alpha >= 0 ? `+${result.metrics.alpha}%p` : `${result.metrics.alpha}%p`}
            </div>
          </div>

          {/* 카드 2: 연평균 복리 수익률 (CAGR) */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
            <span className="text-xs font-semibold text-slate-400">연평균 복리 수익률 (CAGR)</span>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-white">{result.metrics.cagr}%</span>
              <span className="text-xs text-slate-400">(BM {result.metrics.bench_cagr}%)</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-2">
              연율화 변동성: {result.metrics.volatility}%
            </div>
          </div>

          {/* 카드 3: 샤프 지수 */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
            <span className="text-xs font-semibold text-slate-400">샤프 지수 (Sharpe Ratio)</span>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-indigo-400">{result.metrics.sharpe}</span>
              <span className="text-xs font-semibold text-emerald-400">
                {result.metrics.sharpe >= 1.0 ? '🌟 우수' : result.metrics.sharpe >= 0.5 ? '👍 양호' : '⚠️ 보통'}
              </span>
            </div>
            <div className="text-[11px] text-slate-400 mt-2">
              위험 1단위당 초과보상 효율
            </div>
          </div>

          {/* 카드 4: 최대 낙폭 (MDD) */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
            <span className="text-xs font-semibold text-slate-400">최대 낙폭 (MDD)</span>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-rose-400">{result.metrics.mdd}%</span>
              <span className="text-xs text-slate-400">(BM {result.metrics.bench_mdd}%)</span>
            </div>
            <div className="text-[11px] text-emerald-400 mt-2">
              {Math.abs(result.metrics.mdd) < Math.abs(result.metrics.bench_mdd)
                ? `방어력 우수 (낙폭 ${Math.abs(result.metrics.bench_mdd - result.metrics.mdd).toFixed(1)}%p 완화)`
                : '시장 지수 수준 변동성'}
            </div>
          </div>
        </div>
      )}

      {/* ── 3. Recharts 누적 자산 추이 및 언더워터 차트 ─────────────── */}
      {result && result.time_series && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* 누적 가치 추이 차트 (7 cols) */}
          <div className="lg:col-span-7 bg-slate-900/80 border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>📈</span> 포트폴리오 가치 추이 (vs S&P500)
              </h3>
              <div className="flex items-center gap-3 text-xs text-slate-400">
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" /> 포트폴리오
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-sm bg-indigo-500 inline-block" /> S&P500
                </span>
              </div>
            </div>

            <div className="h-64 mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={result.time_series}>
                  <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" stroke="#64748b" fontSize={10} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={10} unit="원" tickFormatter={v => `${(v / 10000).toFixed(0)}만`} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const d = payload[0].payload;
                        return (
                          <div className="bg-slate-950 border border-slate-800 p-3 rounded-lg shadow-xl text-xs space-y-1">
                            <p className="font-bold text-white">{d.date}</p>
                            <p className="text-emerald-400">
                              포트폴리오: <span className="font-bold">{d.portfolio_val.toLocaleString()}원 ({d.portfolio_return}%)</span>
                            </p>
                            <p className="text-indigo-400">
                              S&P500: <span className="font-bold">{d.benchmark_val.toLocaleString()}원 ({d.benchmark_return}%)</span>
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Line type="monotone" dataKey="portfolio_val" stroke="#10b981" strokeWidth={2.5} dot={false} />
                  <Line type="monotone" dataKey="benchmark_val" stroke="#6366f1" strokeWidth={1.5} dot={false} strokeDasharray="4 4" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 언더워터 낙폭 차트 (5 cols) */}
          <div className="lg:col-span-5 bg-slate-900/80 border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>📉</span> 언더워터 낙폭 차트 (Underwater / Drawdown)
              </h3>
              <span className="text-xs text-rose-400 font-semibold">고점 대비 하락률</span>
            </div>

            <div className="h-64 mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={result.time_series}>
                  <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" stroke="#64748b" fontSize={10} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={10} unit="%" />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const d = payload[0].payload;
                        return (
                          <div className="bg-slate-950 border border-slate-800 p-2.5 rounded-lg shadow-xl text-xs">
                            <p className="text-slate-400">{d.date}</p>
                            <p className="text-rose-400 font-bold">낙폭: {d.drawdown}%</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <ReferenceLine y={0} stroke="#475569" />
                  <Area type="monotone" dataKey="drawdown" stroke="#f43f5e" fill="#881337" fillOpacity={0.4} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* ── 4. 자산 구성 및 비중 조절 테이블 ────────────────────────── */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-white">📋 자산 구성 및 비중 조절</span>
            <span className={`text-xs font-mono font-bold ${Math.abs(totalWeight - 100) < 0.1 ? 'text-emerald-400' : 'text-amber-400'}`}>
              (합계: {totalWeight}%)
            </span>
          </div>
          <button
            onClick={handleNormalizeWeights}
            className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold transition"
          >
            100% 자동 정규화
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 mt-4">
          {assets.map(a => (
            <div key={a.code} className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <div>
                  <div className="font-bold text-white truncate max-w-[150px]">{a.name}</div>
                  <div className="text-[10px] text-slate-500 font-mono">{a.code}</div>
                </div>
                <div className="flex items-center gap-1 font-mono font-bold text-emerald-400">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={a.weight}
                    onChange={e => handleWeightChange(a.code, Number(e.target.value))}
                    className="w-12 bg-slate-900 border border-slate-700 rounded px-1 text-right text-xs"
                  />
                  <span>%</span>
                </div>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="0.5"
                value={a.weight}
                onChange={e => handleWeightChange(a.code, Number(e.target.value))}
                className="w-full accent-emerald-500 h-1 bg-slate-800 rounded cursor-pointer"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
