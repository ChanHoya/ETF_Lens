import React, { useState, useRef } from 'react';
import { TffCumulativeSummary } from '../../../lib/tff/types';
import { TrendingUp, TrendingDown, DollarSign, Activity, CalendarDays } from 'lucide-react';
import {
  ResponsiveContainer, ComposedChart, Area, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell, ReferenceLine
} from 'recharts';

interface Props {
  data: TffCumulativeSummary;
  estimatePeriod?: string; // 현 시점 추정 포인트의 period (예: "2026-06")
}

export default function CumulativeView({ data, estimatePeriod }: Props) {
  const { totalData, yearlyData, monthlyData } = data;
  const [hoveredDataKey, setHoveredDataKey] = useState<string | null>(null);
  const chartWrapRef = useRef<HTMLDivElement>(null);

  // 막대/포인트 가운데에 표시되는 흰색 세로선 커서
  const VLineCursor = (props: any) => {
    const { points, top, height } = props;
    if (!points || points.length === 0) return null;
    const x = points[0].x;
    const y1 = points[0].y ?? top ?? 0;
    const y2 = points[1]?.y ?? ((top ?? 0) + (height ?? 0));
    return <line x1={x} y1={y1} x2={x} y2={y2} stroke="rgba(255,255,255,0.65)" strokeWidth={1.5} />;
  };

  // 팝업 박스를 막대 왼쪽에 배치하는 커스텀 툴팁 (오른쪽 절반 구간에서 왼쪽으로)
  const SeriesTooltip = ({ active, payload, label, coordinate, valueFormatter }: any) => {
    if (!active || !payload || payload.length === 0) return null;
    const width = chartWrapRef.current?.clientWidth ?? 0;
    const placeLeft = coordinate && width > 0 ? coordinate.x > width * 0.4 : true;
    return (
      <div style={{
        transform: placeLeft ? 'translateX(calc(-100% - 20px))' : 'translateX(20px)',
        backgroundColor: 'rgba(30,30,45,0.97)',
        border: '1px solid #ffffff20',
        borderRadius: '12px',
        padding: '10px 13px',
        boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
        pointerEvents: 'none',
        minWidth: '180px',
      }}>
        <p style={{ color: '#9ca3af', marginBottom: '8px', fontSize: '12px' }}>{label}</p>
        {payload.map((entry: any, i: number) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: '14px', fontSize: '13px', marginBottom: '3px' }}>
            <span style={{ color: entry.color || entry.stroke || '#cbd5e1', fontWeight: 600 }}>{entry.name}</span>
            <span style={{ color: '#f8fafc', fontWeight: 700 }}>{valueFormatter(entry.value)}</span>
          </div>
        ))}
      </div>
    );
  };

  // 누적 투자수익금 계산
  let curAccProfit = 0;
  // 빈 데이터 미래 달 자르기 (기말평가액 <= 0 이고 순입출금=0 인 월)
  const processedMonthlyData = monthlyData.filter(m => !(m.endValue <= 0 && m.netInOut === 0)).map(m => {
    curAccProfit += m.profitAmount;
    return {
      ...m,
      accProfitAmount: curAccProfit,
      // % 지표들 (만약 엑셀 파서에서 0.05 로 들어왔다면 100을 곱함)
      // 파서의 parseNumber는 % 기호 제거시 자동으로 float을 반환하지만
      // 소수로 되어있는 경우 툴팁/차트 표시를 위해 스케일 조정 (예: 0.05 -> 5.0)
      returnRateDisp: (Math.abs(m.returnRate || 0) < 2 && m.returnRate !== 0) ? (m.returnRate || 0) * 100 : m.returnRate,
      kospiRateDisp: (Math.abs(m.kospiRate || 0) < 2 && m.kospiRate !== 0) ? (m.kospiRate || 0) * 100 : (m.kospiRate || 0),
      sp500RateDisp: (Math.abs(m.sp500Rate || 0) < 2 && m.sp500Rate !== 0) ? (m.sp500Rate || 0) * 100 : (m.sp500Rate || 0),
    };
  });

  if (!totalData) {
    return <div className="text-gray-400">데이터가 없습니다.</div>;
  }

  const formatMoney = (val: number) => new Intl.NumberFormat('ko-KR').format(Math.round(val));
  const formatShortMoney = (val: number) => {
      if (Math.abs(val) >= 100000000) return (val / 100000000).toFixed(1) + '억';
      if (Math.abs(val) >= 10000) return (val / 10000).toFixed(0) + '만';
      return new Intl.NumberFormat('ko-KR').format(Math.round(val));
  };
  const formatPct = (val: number) => (val * 100).toFixed(1) + '%';
  const formatRawPct = (val: number) => val.toFixed(1) + '%'; // 이미 파서에서 84.5 처리했다면

  const isPositive = totalData.timeWeightedReturn > 0;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* 1. Main KPI Cards */}
      <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
        <Activity className="w-5 h-5 text-sky-400" />
        포트폴리오 총 누적 성과 (현재 기준)
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: 시간평잔수익률 */}
        <div className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 p-6 rounded-2xl border border-indigo-500/20 relative overflow-hidden group hover:border-indigo-500/40 transition-colors">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-indigo-500/20 rounded-full blur-2xl group-hover:bg-indigo-500/30 transition-all"></div>
          <p className="text-sm text-indigo-200 mb-1">시간평잔 수익률</p>
          <div className="flex items-end gap-2">
            <h4 className={`text-4xl font-extrabold tracking-tighter ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
              {formatRawPct(totalData.timeWeightedReturn)}
            </h4>
            {isPositive ? <TrendingUp className="w-6 h-6 text-emerald-400 mb-1" /> : <TrendingDown className="w-6 h-6 text-red-400 mb-1" />}
          </div>
        </div>

        {/* KPI 2: 총 수익금액 */}
        <div className="bg-black/20 p-6 rounded-2xl border border-white/5 relative overflow-hidden group hover:border-white/10 transition-colors">
          <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-all"></div>
          <p className="text-sm text-gray-400 mb-1">총 누적 수익금</p>
          <div className="flex items-end gap-2">
            <h4 className={`text-3xl font-bold tracking-tighter ${totalData.profitAmount > 0 ? 'text-emerald-300' : 'text-red-300'}`}>
              {formatMoney(totalData.profitAmount)}<span className="text-lg font-normal text-gray-500 ml-1">원</span>
            </h4>
          </div>
        </div>

        {/* KPI 3: 현재 종합 평가액 */}
        <div className="bg-black/20 p-6 rounded-2xl border border-white/5 relative overflow-hidden group hover:border-white/10 transition-colors">
          <p className="text-sm text-gray-400 mb-1">현재 총 자산군 평가액</p>
          <div className="flex items-end gap-2">
            <h4 className="text-2xl font-bold tracking-tighter text-white">
              {formatMoney(totalData.endValue)}<span className="text-base font-normal text-gray-500 ml-1">원</span>
            </h4>
          </div>
          <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
             <DollarSign className="w-3 h-3" /> 순입출금: {formatMoney(totalData.netInOut)}원
          </p>
        </div>

        {/* KPI 4: 벤치마크 대비 */}
        <div className="bg-black/20 p-6 rounded-2xl border border-white/5 relative flex flex-col justify-center gap-3">
           <div className="flex justify-between items-center bg-white/5 p-2 rounded-lg">
              <span className="text-xs text-gray-400">코스피 누적</span>
              <span className={`text-sm font-bold ${totalData.kospiRate > 0 ? 'text-red-400' : 'text-blue-400'}`}>
                 {formatRawPct(totalData.kospiRate)}
              </span>
           </div>
           <div className="flex justify-between items-center bg-white/5 p-2 rounded-lg">
              <span className="text-xs text-gray-400">S&P500 누적</span>
              <span className={`text-sm font-bold ${totalData.sp500Rate > 0 ? 'text-red-400' : 'text-blue-400'}`}>
                 {formatRawPct(totalData.sp500Rate)}
              </span>
           </div>
        </div>
      </div>

      {/* 2. 시계열 자산 흐름 차트 (월별) */}
      <div className="mt-8 bg-black/40 border border-white/5 rounded-2xl p-6">
        <h4 className="text-lg font-semibold text-gray-200 mb-2 flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-indigo-400" />
            자산 및 수익 시계열 추이
        </h4>
        {estimatePeriod && (
            <p className="text-[11px] text-amber-400/90 mb-5 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                마지막 <strong className="font-bold">{estimatePeriod}</strong> 포인트는 현재가 기준 추정치입니다.
            </p>
        )}
        
        {processedMonthlyData && processedMonthlyData.length > 0 ? (
          <div className="flex flex-col gap-6 w-full" ref={chartWrapRef}>
            {/* 1. 금액 차트 (기말평가액, 수익금) */}
            <div className="w-full h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={processedMonthlyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }} syncId="tff-charts">
                  <defs>
                    <linearGradient id="colorAsset" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#818cf8" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#818cf8" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                  <XAxis 
                    dataKey="period" 
                    stroke="#ffffff50" 
                    fontSize={12} 
                    tickMargin={10} 
                    axisLine={false}
                    tickLine={false}
                    interval={0}
                    scale="point"
                    padding={{ left: 30, right: 30 }}
                    tickFormatter={(tickItem, index) => {
                      if (!tickItem) return '';
                      const [year, month] = tickItem.split('-');
                      const m = parseInt(month, 10).toString();
                      if (index === 0 || month === '01') return `'${year.slice(2)}.${m}`;
                      return m;
                    }}
                  />
                  <YAxis 
                    stroke="#818cf8" 
                    fontSize={12} 
                    tickFormatter={formatShortMoney}
                    axisLine={false}
                    tickLine={false}
                    domain={['auto', 'auto']}
                    width={60}
                  />
                  <Tooltip
                    cursor={<VLineCursor />}
                    offset={0}
                    allowEscapeViewBox={{ x: true, y: false }}
                    content={<SeriesTooltip valueFormatter={(v: number) => formatMoney(v) + '원'} />}
                  />
                  <Legend 
                    wrapperStyle={{ paddingTop: '10px' }} 
                    onMouseEnter={(e: any) => setHoveredDataKey(e.dataKey)}
                    onMouseLeave={() => setHoveredDataKey(null)}
                  />
                  <ReferenceLine y={0} stroke="#ffffff30" strokeWidth={1} />
                  {estimatePeriod && (
                    <ReferenceLine x={estimatePeriod} stroke="#f59e0b" strokeDasharray="4 3" strokeOpacity={0.6}
                      label={{ value: '추정', position: 'top', fill: '#f59e0b', fontSize: 10, fontWeight: 'bold' }} />
                  )}

                  {/* 배경으로 깔리는 영역형 차트 (기말평가액) */}
                  <Area 
                    type="monotone" 
                    dataKey="endValue" 
                    name="기말평가액" 
                    stroke="#818cf8" 
                    strokeWidth={3}
                    strokeOpacity={hoveredDataKey && hoveredDataKey !== 'endValue' ? 0.3 : 1}
                    fillOpacity={hoveredDataKey && hoveredDataKey !== 'endValue' ? 0.3 : 1} 
                    fill="url(#colorAsset)" 
                  />
                  {/* 수익금액 바 차트 */}
                  <Bar
                    dataKey="profitAmount"
                    name="월별 투자수익금"
                    fill="#f43f5e"
                    fillOpacity={hoveredDataKey && hoveredDataKey !== 'profitAmount' ? 0.2 : 1}
                    radius={[4, 4, 0, 0]}
                    barSize={16}
                    maxBarSize={40}
                    activeBar={{ stroke: '#ffffff', strokeWidth: 2 }}
                  >
                    {processedMonthlyData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.profitAmount >= 0 ? '#f43f5e' : '#3b82f6'} />
                    ))}
                  </Bar>

                  {/* 누적 투자수익금 라인/영역 차트 */}
                  <Area 
                    type="monotone" 
                    dataKey="accProfitAmount" 
                    name="누적 투자수익금" 
                    stroke="#10b981" 
                    strokeWidth={2} 
                    strokeOpacity={hoveredDataKey && hoveredDataKey !== 'accProfitAmount' ? 0.2 : 1}
                    fillOpacity={hoveredDataKey && hoveredDataKey !== 'accProfitAmount' ? 0.2 : 1} 
                    fill="url(#colorProfit)"
                    dot={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* 2. 수익률 차트 (TFF, KOSPI, S&P500) */}
            <div className="w-full h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={processedMonthlyData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }} syncId="tff-charts">
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                  <XAxis 
                    dataKey="period" 
                    stroke="#ffffff50" 
                    fontSize={12} 
                    tickMargin={10} 
                    axisLine={false}
                    tickLine={false}
                    interval={0}
                    scale="point"
                    padding={{ left: 30, right: 30 }}
                    tickFormatter={(tickItem, index) => {
                      if (!tickItem) return '';
                      const [year, month] = tickItem.split('-');
                      const m = parseInt(month, 10).toString();
                      if (index === 0 || month === '01') return `'${year.slice(2)}.${m}`;
                      return m;
                    }}
                  />
                  <YAxis 
                    stroke="#f43f5e" 
                    fontSize={12} 
                    tickFormatter={(v) => v.toFixed(1) + '%'}
                    axisLine={false}
                    tickLine={false}
                    domain={['auto', 'auto']}
                    width={60}
                  />
                  <Tooltip
                    cursor={<VLineCursor />}
                    offset={0}
                    allowEscapeViewBox={{ x: true, y: false }}
                    content={<SeriesTooltip valueFormatter={(v: number) => v.toFixed(1) + '%'} />}
                  />
                  <Legend 
                    wrapperStyle={{ paddingTop: '10px' }} 
                    onMouseEnter={(e: any) => setHoveredDataKey(e.dataKey)}
                    onMouseLeave={() => setHoveredDataKey(null)}
                  />
                  <ReferenceLine y={0} stroke="#ffffff30" strokeWidth={1} />
                  {estimatePeriod && (
                    <ReferenceLine x={estimatePeriod} stroke="#f59e0b" strokeDasharray="4 3" strokeOpacity={0.6} />
                  )}

                  {/* 수익률 라인 차트 */}
                  <Line 
                    type="monotone" 
                    dataKey="returnRateDisp" 
                    name="TFF 수익률" 
                    stroke="#f43f5e" 
                    strokeWidth={2} 
                    strokeOpacity={
                      !hoveredDataKey || hoveredDataKey === 'returnRateDisp' ? 1 :
                      (hoveredDataKey === 'kospiRateDisp' || hoveredDataKey === 'sp500RateDisp') ? 0.4 : 0.15
                    }
                    dot={(!hoveredDataKey || hoveredDataKey === 'returnRateDisp') ? { r: 3, fill: '#f43f5e', stroke: '#1e1e2d', strokeWidth: 1 } : false} 
                    activeDot={{ r: 5 }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="kospiRateDisp" 
                    name="KOSPI 수익률" 
                    stroke="#eab308" 
                    strokeWidth={1.5} 
                    strokeOpacity={
                      !hoveredDataKey || hoveredDataKey === 'kospiRateDisp' ? 1 :
                      (hoveredDataKey === 'returnRateDisp' || hoveredDataKey === 'sp500RateDisp') ? 0.4 : 0.15
                    }
                    strokeDasharray="3 3" 
                    connectNulls={true}
                    dot={(!hoveredDataKey || hoveredDataKey === 'kospiRateDisp') ? { r: 2, fill: '#eab308' } : false}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="sp500RateDisp" 
                    name="S&P500 수익률" 
                    stroke="#60a5fa" 
                    strokeWidth={1.5} 
                    strokeOpacity={
                      !hoveredDataKey || hoveredDataKey === 'sp500RateDisp' ? 1 :
                      (hoveredDataKey === 'returnRateDisp' || hoveredDataKey === 'kospiRateDisp') ? 0.4 : 0.15
                    }
                    strokeDasharray="3 3" 
                    connectNulls={true}
                    dot={(!hoveredDataKey || hoveredDataKey === 'sp500RateDisp') ? { r: 2, fill: '#60a5fa' } : false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : (
            <div className="h-[200px] flex items-center justify-center text-gray-500 border border-dashed border-white/10 rounded-xl">
                월별 시계열 데이터가 존재하지 않습니다.
            </div>
        )}
      </div>

      {/* 3. 연도별 히스토리 그리드 */}
      <h4 className="text-lg font-semibold text-gray-200 mt-10 mb-4 px-1">연도별 성과 통계 요약</h4>
      <div className="overflow-x-auto custom-scrollbar border border-white/10 rounded-xl bg-black/40">
        <table className="w-full text-sm text-left whitespace-nowrap">
          <thead className="text-xs text-gray-400 bg-white/5 uppercase">
            <tr>
              <th className="px-4 py-3 font-medium">연도구분</th>
              <th className="px-4 py-3 font-medium text-right">기초평가액</th>
              <th className="px-4 py-3 font-medium text-right">순입출금</th>
              <th className="px-4 py-3 font-medium text-right">기말평가액</th>
              <th className="px-4 py-3 font-medium text-right">투자수익금</th>
              <th className="px-4 py-3 font-medium text-right">수익률(%)</th>
              <th className="px-4 py-3 font-medium text-right">시간평잔(%)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {yearlyData.map((row, idx) => (
              <tr key={idx} className="hover:bg-white/5 transition-colors">
                <td className="px-4 py-3 font-medium text-sky-200">{row.year}</td>
                <td className="px-4 py-3 text-right text-gray-300">{formatMoney(row.beginValue)}</td>
                <td className="px-4 py-3 text-right text-gray-300">{formatMoney(row.netInOut)}</td>
                <td className="px-4 py-3 text-right text-white font-medium">{formatMoney(row.endValue)}</td>
                <td className={`px-4 py-3 text-right font-bold ${row.profitAmount > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {row.profitAmount > 0 ? '+' : ''}{formatMoney(row.profitAmount)}
                </td>
                <td className={`px-4 py-3 text-right ${row.returnRate > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {formatRawPct(row.returnRate)}
                </td>
                <td className={`px-4 py-3 text-right font-bold ${row.timeWeightedReturn > 0 ? 'text-indigo-400' : 'text-pink-400'}`}>
                  {formatRawPct(row.timeWeightedReturn)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
