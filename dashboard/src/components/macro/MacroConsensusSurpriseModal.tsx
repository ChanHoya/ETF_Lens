// 8대 주요 경제 지표(고용·물가) 월가 예상치 vs 실제치 서프라이즈 분석 모달 컴포넌트
'use client';

import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, 
  X, Calendar, BarChart3, HelpCircle, Layers, Sparkles, RefreshCw
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

interface IndicatorMeta {
  key: string;
  name: string;
  short_name: string;
  category: string;
  unit: string;
  fed_target: string;
  description: string;
}

interface SeriesItem {
  date: string;
  period: string;
  actual: number;
  estimate: number;
  previous: number;
  unit: string;
  diff: number;
  pct_diff: number;
  status: string;
  status_label: string;
  badge_color: string;
  sentiment: string;
}

interface ScoreboardItem {
  key: string;
  name: string;
  short_name: string;
  category: string;
  unit: string;
  fed_target: string;
  latest_period: string;
  release_date: string;
  actual: number;
  estimate: number;
  previous: number;
  diff: number;
  pct_diff: number;
  status: string;
  status_label: string;
  badge_color: string;
  sentiment: string;
  description: string;
}

interface MacroConsensusSurpriseModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialIndicator?: string;
}

export default function MacroConsensusSurpriseModal({
  isOpen,
  onClose,
  initialIndicator = 'cpi'
}: MacroConsensusSurpriseModalProps) {
  const [selectedKey, setSelectedKey] = useState<string>(initialIndicator);
  const [period, setPeriod] = useState<'6M' | '1Y'>('1Y');
  const [data, setData] = useState<{
    scoreboard: ScoreboardItem[];
    series: Record<string, SeriesItem[]>;
    indicators_meta: Record<string, IndicatorMeta>;
    analysis: any;
  } | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!isOpen) return;
    fetchData();
  }, [isOpen, period]);

  useEffect(() => {
    if (initialIndicator) {
      setSelectedKey(initialIndicator);
    }
  }, [initialIndicator]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/v1/macro/economic-indicators/consensus?period=${period}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (e) {
      console.error('Failed to fetch consensus indicators:', e);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const currentScore = data?.scoreboard.find(s => s.key === selectedKey);
  const currentSeries = data?.series[selectedKey] || [];
  const currentMeta = data?.indicators_meta[selectedKey];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="bg-[#12141f] border border-white/10 rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* 헤더 */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-black/30">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">
                  미국 8대 주요 경제 지표 월가 예상치(Consensus) vs 실제치 서프라이즈 분석
                </h2>
                <span className="text-[10px] font-semibold text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-full">
                  전문가 인텔리전스
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                월별 추세 및 발표일자별 월가 컨센서스 대비 실제 증감 현황과 시장 충격도를 정밀 추적합니다.
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

        {/* 8대 지표 선택 탭 바 */}
        <div className="px-4 sm:px-6 py-2 border-b border-white/5 bg-black/20 flex items-center justify-between gap-1.5 overflow-x-auto scrollbar-none">
          <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto py-0.5 scrollbar-none shrink-0 min-w-0">
            {data?.scoreboard.map((item) => {
              const isSelected = item.key === selectedKey;
              const isInflation = item.category === '물가';
              return (
                <button
                  key={item.key}
                  onClick={() => setSelectedKey(item.key)}
                  className={`px-2 sm:px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1 ${
                    isSelected 
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 font-semibold' 
                      : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-gray-200'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isInflation ? 'bg-rose-400' : 'bg-sky-400'}`} />
                  <span>{item.short_name}</span>
                  <span className={`text-[9px] font-mono px-1 py-0 rounded ${
                    item.diff > 0 
                      ? (isInflation ? 'text-rose-300 bg-rose-500/20' : 'text-emerald-300 bg-emerald-500/20')
                      : item.diff < 0
                      ? (isInflation ? 'text-sky-300 bg-sky-500/20' : 'text-amber-300 bg-amber-500/20')
                      : 'text-gray-400 bg-white/5'
                  }`}>
                    {item.diff > 0 ? `+${item.diff}` : item.diff}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-1 shrink-0 ml-1">
            {(['6M', '1Y'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-2 py-0.5 text-[10px] font-semibold rounded-md transition ${
                  period === p ? 'bg-white/15 text-white' : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* 바디 컨텐츠 */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {isLoading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3">
              <RefreshCw className="w-6 h-6 text-indigo-400 animate-spin" />
              <span className="text-xs text-gray-400">월가 컨센서스 시계열 데이터를 불러오는 중입니다...</span>
            </div>
          ) : (
            <>
              {/* 상단 KPI 서프라이즈 배너 카드 */}
              {currentScore && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-white/[0.02] border border-white/5 rounded-xl p-4">
                  <div className="space-y-1">
                    <span className="text-[11px] text-gray-400 flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-indigo-400" />
                      최신 발표일 ({currentScore.latest_period}월분)
                    </span>
                    <div className="text-sm font-bold text-white font-mono">{currentScore.release_date}</div>
                    <div className="text-[10px] text-gray-500">연준 목표: {currentScore.fed_target}</div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[11px] text-gray-400">실제 발표치 (Actual)</span>
                    <div className="text-xl font-black text-white font-mono flex items-baseline gap-1">
                      <span>{currentScore.actual}</span>
                      <span className="text-xs font-normal text-gray-400">{currentScore.unit}</span>
                    </div>
                    <div className="text-[10px] text-gray-400">이전치: {currentScore.previous}{currentScore.unit}</div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[11px] text-gray-400">월가 예상치 (Consensus)</span>
                    <div className="text-xl font-black text-amber-400 font-mono flex items-baseline gap-1">
                      <span>{currentScore.estimate}</span>
                      <span className="text-xs font-normal text-gray-400">{currentScore.unit}</span>
                    </div>
                    <div className="text-[10px] text-gray-500">블룸버그/다우존스 집계 기준</div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[11px] text-gray-400">서프라이즈 편차 (Spread)</span>
                    <div className={`text-xl font-black font-mono flex items-center gap-1 ${
                      currentScore.diff > 0 
                        ? (currentScore.category === '물가' ? 'text-rose-400' : 'text-emerald-400')
                        : currentScore.diff < 0 
                        ? (currentScore.category === '물가' ? 'text-sky-400' : 'text-amber-400')
                        : 'text-gray-300'
                    }`}>
                      {currentScore.diff > 0 ? `+${currentScore.diff}` : currentScore.diff}
                      <span className="text-xs font-normal text-gray-400">{currentScore.unit}</span>
                    </div>
                    <div>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        currentScore.status === 'SURPRISE_UP' 
                          ? (currentScore.category === '물가' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30')
                          : currentScore.status === 'SURPRISE_DOWN'
                          ? (currentScore.category === '물가' ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30')
                          : 'bg-white/10 text-gray-300'
                      }`}>
                        {currentScore.status_label}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* 시계열 Recharts 차트 */}
              <div className="p-4 rounded-xl bg-black/40 border border-white/5 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold text-gray-200">
                      {currentMeta?.name} 월별 추이 및 월가 컨센서스 대조
                    </h3>
                    <p className="text-[11px] text-gray-500 mt-0.5">{currentMeta?.description}</p>
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <span className="flex items-center gap-1.5 text-indigo-400">
                      <span className="w-3 h-3 rounded-sm bg-indigo-500 inline-block" />
                      실제 발표치 (Actual)
                    </span>
                    <span className="flex items-center gap-1.5 text-amber-400">
                      <span className="w-3 h-0.5 bg-amber-400 inline-block border-t border-dashed" />
                      월가 예상치 (Consensus)
                    </span>
                  </div>
                </div>

                <div className="h-[260px] w-full pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={currentSeries} margin={{ top: 10, right: 15, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                      <XAxis 
                        dataKey="period" 
                        stroke="#6b7280" 
                        fontSize={11} 
                        tickLine={false} 
                      />
                      <YAxis 
                        stroke="#6b7280" 
                        fontSize={11} 
                        tickLine={false}
                        domain={['auto', 'auto']}
                        tickFormatter={(v) => `${v}${currentMeta?.unit.includes('%') ? '%' : ''}`}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#161a25', 
                          borderColor: '#ffffff20',
                          borderRadius: '8px',
                          fontSize: '11px',
                          color: '#fff'
                        }}
                        formatter={(val: any, name: any) => {
                          if (name === 'actual') return [`${val} ${currentMeta?.unit}`, '실제 발표치'];
                          if (name === 'estimate') return [`${val} ${currentMeta?.unit}`, '월가 예상치'];
                          if (name === 'diff') return [`${val > 0 ? '+' : ''}${val} ${currentMeta?.unit}`, '편차'];
                          return [val, name];
                        }}
                      />
                      <Bar 
                        dataKey="actual" 
                        fill="#6366f1" 
                        radius={[4, 4, 0, 0]} 
                        barSize={20}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="estimate" 
                        stroke="#f59e0b" 
                        strokeWidth={2} 
                        strokeDasharray="4 4"
                        dot={{ r: 3, fill: '#f59e0b', strokeWidth: 1 }}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* 월별 서프라이즈 명세 테이블 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-300">월별 발표 명세 및 서프라이즈 이력</span>
                  <span className="text-[10px] text-gray-500">최근 {period === '1Y' ? '12개월' : '6개월'} 누적 내역</span>
                </div>
                <div className="overflow-x-auto rounded-xl border border-white/5 bg-black/20">
                  <table className="w-full text-left text-xs text-gray-300">
                    <thead className="bg-white/5 text-gray-400 text-[11px] border-b border-white/5">
                      <tr>
                        <th className="px-3 py-2 font-medium">대상 월</th>
                        <th className="px-3 py-2 font-medium">발표일자</th>
                        <th className="px-3 py-2 font-medium text-right">실제치 (Actual)</th>
                        <th className="px-3 py-2 font-medium text-right">예상치 (Est)</th>
                        <th className="px-3 py-2 font-medium text-right">이전치 (Prev)</th>
                        <th className="px-3 py-2 font-medium text-right">편차 (Diff)</th>
                        <th className="px-3 py-2 font-medium text-center">판정</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {currentSeries.slice().reverse().map((row, idx) => (
                        <tr key={idx} className="hover:bg-white/[0.02] transition">
                          <td className="px-3 py-2 font-mono font-medium">{row.period}</td>
                          <td className="px-3 py-2 text-gray-400 font-mono text-[11px]">{row.date}</td>
                          <td className="px-3 py-2 text-right font-mono font-bold text-white">
                            {row.actual} {row.unit}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-amber-400">
                            {row.estimate} {row.unit}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-gray-500">
                            {row.previous} {row.unit}
                          </td>
                          <td className={`px-3 py-2 text-right font-mono font-bold ${
                            row.diff > 0 
                              ? (currentMeta?.category === '물가' ? 'text-rose-400' : 'text-emerald-400')
                              : row.diff < 0
                              ? (currentMeta?.category === '물가' ? 'text-sky-400' : 'text-amber-400')
                              : 'text-gray-400'
                          }`}>
                            {row.diff > 0 ? `+${row.diff}` : row.diff} {row.unit}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                              row.status === 'SURPRISE_UP'
                                ? (currentMeta?.category === '물가' ? 'bg-rose-500/15 text-rose-300' : 'bg-emerald-500/15 text-emerald-300')
                                : row.status === 'SURPRISE_DOWN'
                                ? (currentMeta?.category === '물가' ? 'bg-sky-500/15 text-sky-300' : 'bg-amber-500/15 text-amber-300')
                                : 'bg-white/5 text-gray-400'
                            }`}>
                              {row.status_label}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>

        {/* 푸터 */}
        <div className="px-6 py-3 border-t border-white/10 bg-black/40 flex items-center justify-between text-[11px] text-gray-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>{data?.analysis?.market_summary}</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-white/10 hover:bg-white/15 text-white rounded-lg font-medium transition text-xs"
          >
            닫기
          </button>
        </div>

      </div>
    </div>
  );
}
