import React, { useState } from 'react';
import { TffAssetReturns } from '../../../lib/tff/types';
import { Activity, Star } from 'lucide-react';
import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine, Cell } from 'recharts';

interface Props {
  data: TffAssetReturns;
  onOpenDetail?: (code: string) => void;
}

export default function AssetsView({ data, onOpenDetail }: Props) {
  const { assets, total, benchmarks } = data;
  const [sortBy, setSortBy] = useState<string>('cumulative');
  const [selectedType, setSelectedType] = useState<string>('전체');

  const FILTER_TYPES = [
      { label: '전체', value: '전체' },
      { label: '국내주식형', value: '국내주식형 (Domestic)' },
      { label: '미국주식형', value: '미국주식형 (US)' },
      { label: '국내채권형', value: '국내채권 (Domestic Bonds)' },
      { label: '미국채권형', value: '미국채권 (US Bonds)' },
      { label: '신흥국형', value: '신흥국형 (EM)' },
      { label: '대체자산형', value: '대체자산 (Alternatives)' }
  ];

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
      '국내주식형 (Domestic)': [] as typeof sortedAssets,
      '미국주식형 (US)': [] as typeof sortedAssets,
      '신흥국형 (EM)': [] as typeof sortedAssets,
      '국내채권 (Domestic Bonds)': [] as typeof sortedAssets,
      '미국채권 (US Bonds)': [] as typeof sortedAssets,
      '대체자산 (Alternatives)': [] as typeof sortedAssets,
      '현금/파킹형 (Cash)': [] as typeof sortedAssets,
  };

  sortedAssets.forEach(asset => {
      const name = asset.name;
      if (name.includes("금현물") || name.includes("은현물") || name.includes("원자재") || name.includes("골드") || name.includes("구리") || name.includes("원유")) {
          groupedAssets['대체자산 (Alternatives)'].push(asset);
      } else if (name.includes("채권") || name.includes("국고채") || name.includes("국채") || name.includes("회사채") || name.includes("종합채권")) {
          if (name.includes("미국") || name.includes("US")) {
              groupedAssets['미국채권 (US Bonds)'].push(asset);
          } else {
              groupedAssets['국내채권 (Domestic Bonds)'].push(asset);
          }
      } else if (name.includes("머니마켓") || name.includes("CD") || name.includes("KOFR") || name.includes("현금") || name.includes("단기자금") || name.includes("파킹")) {
          groupedAssets['현금/파킹형 (Cash)'].push(asset);
      } else if (name.includes("차이나") || name.includes("항셍") || name.includes("인도") || name.includes("베트남") || name.includes("EM")) {
          groupedAssets['신흥국형 (EM)'].push(asset);
      } else if (name.includes("미국") || name.includes("S&P") || name.includes("나스닥") || name.includes("다우") || name.includes("필라델피아") || name.includes("테크") || name.includes("글로벌")) {
          groupedAssets['미국주식형 (US)'].push(asset);
      } else {
          groupedAssets['국내주식형 (Domestic)'].push(asset);
      }
  });

  const categoryOrder = ['국내주식형 (Domestic)', '미국주식형 (US)', '신흥국형 (EM)', '국내채권 (Domestic Bonds)', '미국채권 (US Bonds)', '대체자산 (Alternatives)', '현금/파킹형 (Cash)'];

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

  const tableAssets = assets.filter(a => {
      const name = a.name.trim();
      return !name.startsWith("Note") && !name.includes("수익률은") && !name.startsWith("1)") && !name.startsWith("2)");
  });

  const YELLOW_HIGHLIGHTED_NAMES = [
    'KODEX 200', 
    'KODEX 반도체', 
    'PLUS 고배당주', 
    'KODEX 미국AI테크TOP10', 
    'KODEX 미국빅테크10배당포커스', 
    'ACE 미국10년국채액티브', 
    'KODEX 금융고배당TOP10'
  ];

  const isYellowHighlighted = (name: string) => {
    const cleanName = name.replace(/\s/g, '');
    return YELLOW_HIGHLIGHTED_NAMES.some(yn => yn.replace(/\s/g, '') === cleanName);
  };

  const formatTableCell = (val?: number) => {
    if (val === undefined || val === null || isNaN(val)) return '-';
    const normed = (Math.abs(val) < 2 && val !== 0) ? Math.round(val * 1000) / 10 : val;
    if (normed === 0) return '0.0%';
    return `${normed > 0 ? '+' : ''}${normed.toFixed(1)}%`;
  };

  const getTableCellStyle = (val?: number) => {
    if (val === undefined || val === null || isNaN(val) || val === 0) {
        return 'text-gray-500 text-center';
    }
    const normed = (Math.abs(val) < 2 && val !== 0) ? Math.round(val * 1000) / 10 : val;
    if (normed > 0) {
        return 'bg-emerald-950/40 text-emerald-400 font-semibold text-center border border-emerald-500/10';
    } else {
        return 'bg-rose-950/40 text-rose-400 font-semibold text-center border border-rose-500/10';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* 엑셀 종목별 수익률 테이블 */}
      <div className="bg-[#12121A]/80 border border-white/10 rounded-2xl p-4 md:p-5 backdrop-blur-md shadow-lg">
          <h4 className="text-sm font-bold text-gray-300 mb-3.5 flex items-center gap-2 border-l-2 border-emerald-500 pl-2">
              📊 종목별 수익률 요약표 (Excel 원본 기준)
          </h4>
          <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse whitespace-nowrap text-xs">
                  <thead>
                      <tr className="bg-black/40 text-gray-400 border-b border-white/10">
                          <th className="p-3 font-semibold min-w-[200px] border-r border-white/5">종목명(상품명)</th>
                          {availableMonths.map(m => (
                              <th key={m} className="p-3 font-semibold text-center w-24 border-r border-white/5">{m}</th>
                          ))}
                          <th className="p-3 font-semibold text-center w-24">누적</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-mono">
                      {/* 1. 일반 종목행들 */}
                      {tableAssets.map((asset, idx) => {
                          const isYellow = isYellowHighlighted(asset.name);
                          return (
                              <tr key={idx} className="hover:bg-white/[0.02] transition-colors">
                                  <td className={`p-3 text-xs border-r border-white/5 ${isYellow ? 'bg-yellow-500/15 text-yellow-300 font-bold border-l-4 border-yellow-500/60 pl-2' : 'text-gray-300 pl-3'}`}>
                                      {asset.name}
                                  </td>
                                  {availableMonths.map(m => (
                                      <td key={m} className={`p-3 border-r border-white/5 ${getTableCellStyle(asset.months[m])}`}>
                                          {formatTableCell(asset.months[m])}
                                      </td>
                                  ))}
                                  <td className={`p-3 font-bold ${getTableCellStyle(asset.cumulative)}`}>
                                      {formatTableCell(asset.cumulative)}
                                  </td>
                              </tr>
                          );
                      })}

                      {/* 2. 합계 행 */}
                      {total && (
                          <tr className="bg-white/[0.04] font-black border-t border-b border-white/10">
                              <td className="p-3 text-xs text-white font-black border-r border-white/5 pl-3">합계</td>
                              {availableMonths.map(m => (
                                  <td key={m} className={`p-3 border-r border-white/5 ${getTableCellStyle(total.months[m])}`}>
                                      {formatTableCell(total.months[m])}
                                  </td>
                              ))}
                              <td className={`p-3 font-black ${getTableCellStyle(total.cumulative)}`}>
                                  {formatTableCell(total.cumulative)}
                              </td>
                          </tr>
                      )}

                      {/* 3. 코스피 행 */}
                      {benchmarks?.kospi && (
                          <tr className="bg-black/20 text-gray-400 font-medium">
                              <td className="p-3 text-xs text-gray-400 border-r border-white/5 pl-3">코스피</td>
                              {availableMonths.map(m => (
                                  <td key={m} className={`p-3 border-r border-white/5 ${getTableCellStyle(benchmarks.kospi.months[m])}`}>
                                      {formatTableCell(benchmarks.kospi.months[m])}
                                  </td>
                              ))}
                              <td className={`p-3 font-bold ${getTableCellStyle(benchmarks.kospi.cumulative)}`}>
                                  {formatTableCell(benchmarks.kospi.cumulative)}
                              </td>
                          </tr>
                      )}

                      {/* 4. S&P500 행 */}
                      {benchmarks?.sp500 && (
                          <tr className="bg-black/20 text-gray-400 font-medium">
                              <td className="p-3 text-xs text-gray-400 border-r border-white/5 pl-3">S&P500</td>
                              {availableMonths.map(m => (
                                  <td key={m} className={`p-3 border-r border-white/5 ${getTableCellStyle(benchmarks.sp500.months[m])}`}>
                                      {formatTableCell(benchmarks.sp500.months[m])}
                                  </td>
                              ))}
                              <td className={`p-3 font-bold ${getTableCellStyle(benchmarks.sp500.cumulative)}`}>
                                  {formatTableCell(benchmarks.sp500.cumulative)}
                              </td>
                          </tr>
                      )}
                  </tbody>
              </table>
          </div>
      </div>

      <div className="flex flex-col gap-4 mb-2 mt-0">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
            <div>
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    <Activity className="w-5 h-5 text-sky-400" />
                    종목별 성과 추이
                </h3>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between xl:justify-end gap-3 w-full xl:w-auto">
                <div className="flex items-center flex-wrap gap-1.5">
                    {FILTER_TYPES.map(filter => (
                        <button
                            key={filter.value}
                            onClick={() => setSelectedType(filter.value)}
                            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                                selectedType === filter.value 
                                ? 'bg-sky-500/20 text-sky-400 border border-sky-500/50 shadow-sm' 
                                : 'bg-black/40 text-gray-400 hover:bg-white/10 hover:text-gray-200 border border-white/5'
                            }`}
                        >
                            {filter.label}
                        </button>
                    ))}
                </div>

                <div className="flex items-center gap-2 sm:border-l sm:border-white/10 sm:pl-3">
                    <span className="text-xs text-gray-400 whitespace-nowrap">정렬기준:</span>
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
        </div>
      </div>

      <div className="space-y-6">
        {categoryOrder.map(category => {
            if (selectedType !== '전체' && category !== selectedType) return null;

            const assetsInCategory = groupedAssets[category as keyof typeof groupedAssets];
            if (assetsInCategory.length === 0) return null;

            return (
                <div key={category} className="space-y-2">
                    <div className="flex items-center gap-3">
                        <h4 className="text-sm font-bold text-sky-300 border-l-2 border-sky-500 pl-2 ml-1">{category}</h4>
                        <button 
                            onClick={() => {
                                const groupName = "TFF" + category.split(' ')[0];
                                const items = assetsInCategory
                                    .filter(a => a.code)
                                    .map(a => ({ code: a.code, name: a.name }));
                                
                                if (items.length > 0) {
                                    window.dispatchEvent(new CustomEvent('add_tff_group_to_favorites', {
                                        detail: { groupName, items }
                                    }));
                                } else {
                                    alert('즐겨찾기에 추가할 수 있는 종목 코드가 없습니다.');
                                }
                            }}
                            className="bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20 border border-yellow-500/30 px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 transition-colors group"
                        >
                            <Star className="w-3 h-3 group-hover:fill-yellow-500" />
                            즐겨찾기 추가
                        </button>
                    </div>
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
