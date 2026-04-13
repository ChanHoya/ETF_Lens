import React, { useState } from 'react';
import { TffAssetReturns } from '../../../lib/tff/types';
import { Activity } from 'lucide-react';
import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine, Cell } from 'recharts';

interface Props {
  data: TffAssetReturns;
  onOpenDetail?: (code: string) => void;
}

export default function AssetsView({ data, onOpenDetail }: Props) {
  const { assets, total, benchmarks } = data;
  const [sortBy, setSortBy] = useState<string>('cumulative');

  // Get available months dynamically
  const availableMonths = [
      ...new Set([
          ...Object.keys(total?.months || {}),
          ...assets.flatMap(a => Object.keys(a.months || {}))
      ])
  ].sort((a,b) => parseInt(a, 10) - parseInt(b, 10));

  // 캐시된 이전 데이터에서 남아있을 수 있는 쓰레기값 방어 필터링
  const filteredAssets = assets.filter(a => {
      const name = a.name.trim();
      return name !== "현금" && !name.startsWith("Note") && !name.includes("수익률은") && !name.startsWith("1)") && !name.startsWith("2)");
  });

  const sortedAssets = [...filteredAssets].sort((a, b) => {
      let valA = sortBy === 'cumulative' ? (a.cumulative || 0) : (a.months[sortBy] || 0);
      let valB = sortBy === 'cumulative' ? (b.cumulative || 0) : (b.months[sortBy] || 0);
      return valB - valA;
  });

  const groupedAssets = {
      '국내형 (Domestic)': [] as typeof sortedAssets,
      '미국형 (US)': [] as typeof sortedAssets,
      '채권형 (Bonds)': [] as typeof sortedAssets,
      '원자재형 (Commodities)': [] as typeof sortedAssets,
      '현금/파킹형 (Cash)': [] as typeof sortedAssets,
  };

  sortedAssets.forEach(asset => {
      const name = asset.name;
      if (name.includes("금현물") || name.includes("은현물") || name.includes("원자재") || name.includes("골드") || name.includes("구리") || name.includes("원유")) {
          groupedAssets['원자재형 (Commodities)'].push(asset);
      } else if (name.includes("채권") || name.includes("국고채") || name.includes("회사채") || name.includes("종합채권")) {
          groupedAssets['채권형 (Bonds)'].push(asset);
      } else if (name.includes("머니마켓") || name.includes("CD") || name.includes("KOFR") || name.includes("현금") || name.includes("단기자금") || name.includes("파킹")) {
          groupedAssets['현금/파킹형 (Cash)'].push(asset);
      } else if (name.includes("미국") || name.includes("S&P") || name.includes("나스닥") || name.includes("다우") || name.includes("필라델피아") || name.includes("테크") || name.includes("글로벌")) {
          groupedAssets['미국형 (US)'].push(asset);
      } else {
          groupedAssets['국내형 (Domestic)'].push(asset);
      }
  });

  const categoryOrder = ['국내형 (Domestic)', '미국형 (US)', '채권형 (Bonds)', '원자재형 (Commodities)', '현금/파킹형 (Cash)'];

  const normalizePct = (val?: number) => {
    if (val === undefined || val === null || isNaN(val)) return 0;
    return (Math.abs(val) < 2 && val !== 0) ? Math.round(val * 1000) / 10 : val;
  };

  const formatPct = (val?: number) => {
    const normed = normalizePct(val);
    if (normed === undefined || normed === 0) return '-';
    return normed > 0 ? `+${normed.toFixed(1)}%` : `${normed.toFixed(1)}%`;
  };

  const getPctColor = (val: number) => {
    const normed = normalizePct(val);
    if (normed === undefined || normed === 0) return 'text-gray-500';
    return normed > 0 ? 'text-red-400 font-bold' : 'text-blue-400 font-bold';
  };

  return (
    <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2 mt-0">
        <div>
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Activity className="w-5 h-5 text-sky-400" />
                종목별 성과 동향 (Monthly Trends)
            </h3>
            <p className="text-xs text-gray-400 mt-1">* 막대는 종목 월별 수익률, 꺾은선은 비교 벤치마크(KOSPI/S&P500) 월별 수익률입니다.</p>
        </div>

        <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">정렬기준:</span>
            <select 
                value={sortBy} 
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-black/50 border border-white/10 rounded-lg text-sm text-gray-200 px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-sky-500"
            >
                <option value="cumulative">누적 수익률순</option>
                {availableMonths.map(m => (
                    <option key={m} value={m}>{m} 수익률순</option>
                ))}
            </select>
        </div>
      </div>

      <div className="space-y-6">
        {categoryOrder.map(category => {
            const assetsInCategory = groupedAssets[category as keyof typeof groupedAssets];
            if (assetsInCategory.length === 0) return null;

            return (
                <div key={category} className="space-y-2">
                    <h4 className="text-sm font-bold text-sky-300 border-l-2 border-sky-500 pl-2 ml-1">{category}</h4>
                    <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-2">
                        {assetsInCategory.map((asset, idx) => {
                            const isUS = asset.name.includes("미국") || asset.name.includes("S&P") || asset.name.includes("나스닥") || asset.name.includes("다우");
                            const activeBenchmark = isUS ? benchmarks.sp500 : benchmarks.kospi;
                            const benchName = isUS ? 'S&P500' : 'KOSPI';

                            const maxBench = Math.max(benchmarks.kospi.cumulative, benchmarks.sp500.cumulative);
                            const minBench = Math.min(benchmarks.kospi.cumulative, benchmarks.sp500.cumulative);
                            let badgeComponent = null;
                            if (asset.cumulative >= maxBench) {
                                badgeComponent = <span className="inline-block text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded font-bold border border-emerald-500/30">시장 주도</span>;
                            } else if (asset.cumulative >= minBench) {
                                badgeComponent = <span className="inline-block text-[10px] bg-sky-500/20 text-sky-400 px-2 py-0.5 rounded font-bold border border-sky-500/30">시장 수익</span>;
                            }

                            // 개별 차트용 데이터
                            const assetChartData = availableMonths.map(m => {
                                const assetVal = normalizePct(asset.months[m]);
                                const benchVal = normalizePct(activeBenchmark.months[m]);
                                return {
                                    month: m,
                                    assetReturns: assetVal,
                                    benchReturns: benchVal
                                };
                            });

                            return (
                                <div key={idx} className="flex flex-col bg-black/40 border border-white/10 rounded-xl p-2 md:p-3 hover:bg-white/5 transition-colors">
                                    {/* 상단: 타이틀 및 누적 수익률 */}
                                    <div className="flex flex-row justify-between items-start gap-2 mb-1 pb-1 border-b border-white/5">
                                        <div className="flex flex-col gap-1.5 max-w-[65%]">
                                            <div className="flex flex-row items-center gap-1.5 flex-wrap">
                                                {asset.code && <span className="bg-white/10 text-gray-400 px-1.5 py-0.5 rounded text-[10px] font-mono">{asset.code}</span>}
                                                {badgeComponent}
                                            </div>
                                            <h4 
                                              className={`text-sm md:text-base text-gray-200 font-bold leading-tight break-keep ${onOpenDetail && asset.code ? 'cursor-pointer hover:text-sky-400 hover:underline transition-colors' : ''}`}
                                              onClick={() => {
                                                if (onOpenDetail && asset.code) {
                                                  onOpenDetail(asset.code);
                                                }
                                              }}
                                            >
                                              {asset.name}
                                            </h4>
                                        </div>
                                        
                                        <div className="flex flex-col text-right">
                                            <span className="text-gray-500 text-[10px] md:text-xs mb-0.5">누적 수익률</span>
                                            <span className={`text-lg md:text-xl font-bold tracking-tight ${getPctColor(asset.cumulative)}`}>
                                                {formatPct(asset.cumulative)}
                                            </span>
                                        </div>
                                    </div>

                                    {/* 하단: 미니 차트 */}
                                    <div className="w-full h-[100px]">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <ComposedChart data={assetChartData} margin={{ top: 5, right: 0, left: -25, bottom: 0 }}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                                <XAxis 
                                                    dataKey="month" 
                                                    tick={{ fill: '#9ca3af', fontSize: 10 }} 
                                                    axisLine={false}
                                                    tickLine={false}
                                                />
                                                <YAxis 
                                                    tick={{ fill: '#9ca3af', fontSize: 10 }}
                                                    tickFormatter={(val) => `${val}%`}
                                                    axisLine={false}
                                                    tickLine={false}
                                                    width={55}
                                                />
                                                <Tooltip
                                                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                                    content={({ active, payload, label }) => {
                                                        if (active && payload && payload.length) {
                                                            const pAsset = payload.find(p => p.dataKey === 'assetReturns')?.value as number;
                                                            const pBench = payload.find(p => p.dataKey === 'benchReturns')?.value as number;
                                                            return (
                                                                <div className="bg-slate-900/95 border border-slate-700 p-2.5 rounded-lg shadow-xl backdrop-blur-md">
                                                                    <p className="text-gray-400 text-[10px] mb-1.5 font-bold uppercase">{label}</p>
                                                                    <p className={`font-bold text-xs mb-1 ${pAsset > 0 ? 'text-red-400' : 'text-blue-400'}`}>
                                                                        월별 등락: {pAsset > 0 ? '+' : ''}{pAsset?.toFixed(1)}%
                                                                    </p>
                                                                    <p className="text-amber-500 font-medium text-[11px]">
                                                                        {benchName} 등락: {pBench > 0 ? '+' : ''}{pBench?.toFixed(1)}%
                                                                    </p>
                                                                </div>
                                                            );
                                                        }
                                                        return null;
                                                    }}
                                                />
                                                <ReferenceLine y={0} stroke="rgba(255,255,255,0.2)" strokeWidth={1} />
                                                <Bar dataKey="assetReturns" radius={[2, 2, 0, 0]} maxBarSize={20} name="월별 수익률">
                                                    {assetChartData.map((entry, i) => (
                                                        <Cell key={`cell-${i}`} fill={entry.assetReturns > 0 ? '#f43f5e' : '#3b82f6'} fillOpacity={0.8} />
                                                    ))}
                                                </Bar>
                                                <Line 
                                                    type="monotone" 
                                                    dataKey="benchReturns" 
                                                    stroke="#f59e0b" 
                                                    strokeWidth={2} 
                                                    dot={{ fill: '#f59e0b', r: 3, strokeWidth: 0 }} 
                                                    activeDot={{ r: 5 }} 
                                                    name={benchName}
                                                />
                                            </ComposedChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            );
        })}
      </div>
    </div>
  );
}
