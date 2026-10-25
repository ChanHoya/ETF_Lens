'use client';
// 부동산 주요 단지 매매·전세 시계열 및 거래량 상세 조회 팝업 모달

import React, { useEffect, useState } from 'react';
import { X, Building2, TrendingUp, TrendingDown, Calendar, Layers, ShieldCheck, Activity, BarChart3, ArrowUpRight, Scale } from 'lucide-react';
import { ResponsiveContainer, ComposedChart, Line, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { getApiBase } from '@/lib/apiConfig';
import { STANDARD_TOOLTIP_STYLE, STANDARD_LEGEND_WRAPPER_STYLE, useChartHighlight } from '@/lib/chartTheme';
import { formatChartDate } from '@/lib/chartDateUtils';

export interface MajorComplexTimeseriesModalProps {
  complexName: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function MajorComplexTimeseriesModal({
  complexName,
  isOpen,
  onClose
}: MajorComplexTimeseriesModalProps) {
  const chartHighlight = useChartHighlight();
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !complexName) return;

    let isMounted = true;
    async function fetchHistory() {
      try {
        setLoading(true);
        setError(null);
        const apiBase = getApiBase();
        const res = await fetch(`${apiBase}/api/v1/real-estate/complex-history?complex_name=${encodeURIComponent(complexName!)}`);
        if (!res.ok) throw new Error('단지 실거래 시계열 데이터를 불러오지 못했습니다.');
        const json = await res.json();
        if (isMounted) setData(json);
      } catch (e: any) {
        if (isMounted) setError(e.message || '네트워크 오류');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchHistory();
    return () => { isMounted = false; };
  }, [isOpen, complexName]);

  if (!isOpen || !complexName) return null;

  const meta = data?.meta;
  const summary = data?.summary;
  const history = data?.history || [];

  return (
    <div className="fixed top-[52px] sm:top-[60px] md:top-[64px] left-0 right-0 bottom-0 z-[200] flex items-start justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-4xl my-auto sm:my-4 overflow-y-auto bg-[#12131e] border border-white/10 rounded-3xl shadow-2xl p-5 sm:p-7 flex flex-col gap-5 text-gray-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-start justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-black text-white tracking-tight">{complexName}</h3>
                <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                  {meta?.district || '수도권'} · {meta?.repr_area_pyeong || 34}평형
                </span>
                <span className="text-[11px] text-gray-400">
                  {meta?.total_households ? `${meta.total_households.toLocaleString()}세대` : ''} ({meta?.built_year}년 준공)
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                국토교통부 실거래가 기반 최근 2개년(2024.11 ~ 2026.10) 매매·전세 시계열 & 거래량
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 로딩 / 에러 */}
        {loading && (
          <div className="py-20 flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-gray-400 font-mono">국토부 실거래 데이터 정규화 집계 중...</span>
          </div>
        )}

        {error && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
            {error}
          </div>
        )}

        {data && !loading && (
          <>
            {/* 4대 핵심 지표 카드 */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/5">
                <div className="text-[11px] text-gray-400">최근 평균 매매가</div>
                <div className="text-lg font-black text-white font-mono mt-0.5">
                  {summary?.latest_avg_price}억 원
                </div>
                <div className="text-[10px] text-indigo-300 mt-1 flex items-center gap-1">
                  2년 변동: <span className={summary?.change_2y_pct >= 0 ? 'text-rose-400 font-bold' : 'text-blue-400 font-bold'}>
                    {summary?.change_2y_pct > 0 ? '+' : ''}{summary?.change_2y_pct}%
                  </span>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/5">
                <div className="text-[11px] text-gray-400">최근 평균 전세가</div>
                <div className="text-lg font-black text-emerald-400 font-mono mt-0.5">
                  {summary?.latest_jeonse_price}억 원
                </div>
                <div className="text-[10px] text-emerald-300/80 mt-1">
                  전세가율 <span className="font-bold text-emerald-300">{summary?.latest_jeonse_ratio}%</span>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/5">
                <div className="text-[11px] text-gray-400">갭투자 소요금액</div>
                <div className="text-lg font-black text-amber-300 font-mono mt-0.5">
                  {summary?.latest_gap_price}억 원
                </div>
                <div className="text-[10px] text-amber-300/70 mt-1">
                  매매 - 전세 실거래 차액
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/5">
                <div className="text-[11px] text-gray-400">2개년 최고가 & 낙폭</div>
                <div className="text-lg font-black text-purple-300 font-mono mt-0.5">
                  {summary?.peak_price_2y}억 원
                </div>
                <div className="text-[10px] text-gray-400 mt-1">
                  최고 대비 <span className="text-purple-300 font-bold">{summary?.drop_from_peak_pct}%</span>
                </div>
              </div>
            </div>

            {/* 2개년 통합 시계열 차트 */}
            <div className="p-4 rounded-2xl bg-black/30 border border-white/5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-indigo-400" />
                  <span className="text-xs font-bold text-white">매매·전세 실거래가 추이 (좌) & 월간 거래량 (우)</span>
                </div>
                <span className="text-[10px] text-gray-400 font-mono">단위: 억 원 / 건</span>
              </div>

              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={history} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#252736" vertical={false} />
                    <XAxis 
                      dataKey="month" 
                      tick={{ fill: '#9ca3af', fontSize: 10 }} 
                      stroke="#374151" 
                      tickFormatter={formatChartDate}
                    />
                    <YAxis 
                      yAxisId="price" 
                      domain={['auto', 'auto']} 
                      tick={{ fill: '#9ca3af', fontSize: 10 }} 
                      stroke="#374151"
                      unit="억"
                    />
                    <YAxis 
                      yAxisId="vol" 
                      orientation="right" 
                      domain={[0, 'auto']} 
                      tick={{ fill: '#6b7280', fontSize: 10 }} 
                      stroke="#374151"
                      unit="건"
                    />
                    <Tooltip 
                      contentStyle={STANDARD_TOOLTIP_STYLE}
                      formatter={(val: any, name: any) => {
                        if (name === '월 거래량') return [`${val}건`, name];
                        return [`${val}억 원`, name];
                      }}
                    />
                    <Legend wrapperStyle={STANDARD_LEGEND_WRAPPER_STYLE} />
                    <Bar 
                      yAxisId="vol" 
                      dataKey="volume" 
                      name="월 거래량" 
                      fill="#3b82f6" 
                      opacity={0.3} 
                      radius={[4, 4, 0, 0]} 
                    />
                    <Line 
                      yAxisId="price" 
                      type="monotone" 
                      dataKey="avg_price" 
                      name="평균 매매가" 
                      stroke="#6366f1" 
                      strokeWidth={2.5} 
                      dot={false} 
                    />
                    <Line 
                      yAxisId="price" 
                      type="monotone" 
                      dataKey="high_price" 
                      name="최고 실거래가" 
                      stroke="#f43f5e" 
                      strokeWidth={1.5} 
                      strokeDasharray="3 3" 
                      dot={false} 
                    />
                    <Line 
                      yAxisId="price" 
                      type="monotone" 
                      dataKey="jeonse_price" 
                      name="평균 전세가" 
                      stroke="#10b981" 
                      strokeWidth={2} 
                      dot={false} 
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 설명 및 진단 가이드 */}
            <div className="p-3.5 rounded-2xl bg-indigo-500/5 border border-indigo-500/20 text-xs text-indigo-200/90 leading-relaxed flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-white">{meta?.description || ''}</span>
                <p className="mt-1 text-gray-300 text-[11px]">
                  💡 2024년 하반기 스트레스 DSR 2단계 시행 및 대출 규제 이후 실거래가 조정 국면을 거쳤으며, 
                  현재 전세가율 {summary?.latest_jeonse_ratio}% 수준으로 {summary?.latest_jeonse_ratio > 70 ? '역전세 위험을 경계할 필요가 있습니다.' : '하방 경직성과 실수요 지지력이 안정적인 구간입니다.'}
                </p>
              </div>
            </div>
          </>
        )}

        {/* 닫기 버튼 */}
        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
