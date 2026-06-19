"use client";

import React, { useState, useEffect } from 'react';
import { Activity, ArrowUpRight, Sparkles, TrendingUp, BookOpen, PieChart, Info, ShieldAlert } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend } from 'recharts';
import { API_BASE } from '../lib/apiConfig';
import ChartLoadingPlaceholder from './ChartLoadingPlaceholder';

interface BioChartProps {
    onOpenDetail?: (code: string) => void;
}

const constituentTickerMap: { [key: string]: string } = {
    "삼성바이오로직스": "207940",
    "셀트리온": "068270",
    "알테오젠": "196170",
    "리가켐바이오": "141080",
    "유한양행": "000100",
    "한미약품": "128940",
    "SK바이오팜": "326030",
    "HLB": "028300",
    "삼천당제약": "000250",
    "셀트리온제약": "068760",
    "바이오니아": "064550",
    "에스티팜": "237690",
    "지아이이노베이션": "358570",
    "펩트론": "086520",
    "에이비엘바이오": "298380",
};

const getTickerFromConstituent = (name: string): string => {
    if (constituentTickerMap[name]) return constituentTickerMap[name];
    const normalized = name.trim();
    if (constituentTickerMap[normalized]) return constituentTickerMap[normalized];
    return normalized;
};

const etfNameToCodeMap: { [key: string]: string } = {
    "KoAct 바이오헬스케어액티브": "462900",
    "TIME K바이오액티브": "463050",
    "KODEX 바이오": "244580",
    "TIGER 헬스케어": "143860",
    "TIGER 바이오TOP10": "364970",
};

export default function BioChart({ onOpenDetail }: BioChartProps) {
    const [period, setPeriod] = useState('1Y');
    const [chartData, setChartData] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [hoveredLine, setHoveredLine] = useState<string | null>(null);
    const [keys, setKeys] = useState<string[]>([]);
    const [originalData, setOriginalData] = useState<any[]>([]);
    const [selectedEtf, setSelectedEtf] = useState<string | null>(null);
    
    // Holdings comparison state
    const [holdingsData, setHoldingsData] = useState<any[]>([]);
    const [holdingsKeys, setHoldingsKeys] = useState<string[]>([]);
    const [isHoldingsLoading, setIsHoldingsLoading] = useState(true);
    const [disparityData, setDisparityData] = useState<{ [key: string]: any }>({});
    const [activeInsightTab, setActiveInsightTab] = useState<'cycle' | 'etfs' | 'strategy'>('cycle');

    useEffect(() => {
        const fetchDisparity = async () => {
            try {
                const res = await fetch(`${API_BASE}/api/v1/analyze/etf/disparity?codes=462900,463050,244580,143860,364970`);
                if (res.ok) {
                    const data = await res.json();
                    setDisparityData(data);
                }
            } catch (err) {
                console.error('Error fetching Bio ETF disparity:', err);
            }
        };
        fetchDisparity();
        const interval = setInterval(fetchDisparity, 60000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const fetchHoldings = async () => {
            setIsHoldingsLoading(true);
            try {
                const res = await fetch(`${API_BASE}/api/v1/analyze/bio-holdings`);
                if (!res.ok) throw new Error('API fetch error');
                const data = await res.json();
                if (data.table_data) {
                    setHoldingsData(data.table_data);
                    if (data.keys) {
                        setHoldingsKeys(data.keys);
                    }
                }
            } catch (err) {
                console.error('Error fetching bio holdings:', err);
            } finally {
                setIsHoldingsLoading(false);
            }
        };
        fetchHoldings();
    }, []);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const url = selectedEtf
                    ? `${API_BASE}/api/v1/analyze/bio-chart?etf=${encodeURIComponent(selectedEtf)}`
                    : `${API_BASE}/api/v1/analyze/bio-chart`;
                const res = await fetch(url);
                if (!res.ok) throw new Error('API fetch error');
                const data = await res.json();
                
                if (data.line_chart_data && data.line_chart_data.length > 0) {
                    setOriginalData(data.line_chart_data);
                    setKeys(data.keys);
                } else {
                    setError('데이터가 없습니다.');
                }
            } catch (err) {
                console.error(err);
                setError('서버에서 바이오 지수 데이터를 불러오지 못했습니다.');
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [selectedEtf]);

    useEffect(() => {
        if (!originalData || originalData.length === 0) return;

        // Filter data based on period
        const now = new Date();
        let startDate = new Date();
        switch (period) {
            case '1M': startDate.setMonth(now.getMonth() - 1); break;
            case '3M': startDate.setMonth(now.getMonth() - 3); break;
            case '6M': startDate.setMonth(now.getMonth() - 6); break;
            case '1Y': startDate.setFullYear(now.getFullYear() - 1); break;
            case '3Y': startDate.setFullYear(now.getFullYear() - 3); break;
            case '10Y': startDate.setFullYear(now.getFullYear() - 10); break;
            default: startDate.setFullYear(now.getFullYear() - 1); break;
        }

        const filtered = originalData.filter(d => new Date(d.date) >= startDate);
        if (filtered.length === 0) {
            setChartData([]);
            return;
        }

        // 개별 자산 기준일 가격(Base Value) 계산
        const baseValues: any = {};
        keys.forEach(k => {
            const firstValid = filtered.find(d => d[k] != null && d[k] > 0);
            if (firstValid) {
                baseValues[k] = firstValid[k];
            }
        });

        const normalizedData = filtered.map(d => {
            const row: any = { date: d.date.replace(/-/g, '/').substring(2) };
            keys.forEach(k => {
                if (d[k] != null && baseValues[k]) {
                    row[k] = Number(((d[k] / baseValues[k]) * 100).toFixed(2));
                }
            });
            return row;
        });

        setChartData(normalizedData);
    }, [period, originalData, keys]);

    const handleLegendMouseEnter = (o: any) => {
        setHoveredLine(o.dataKey);
    };

    const handleLegendMouseLeave = () => {
        setHoveredLine(null);
    };

    const periodOptions = ['1M', '3M', '6M', '1Y', '3Y', '10Y'];
    const colors = ['#f59e0b', '#ec4899', '#3b82f6', '#10b981', '#8b5cf6', '#06b6d4', '#14b8a6', '#f43f5e', '#a855f7', '#6366f1'];

    const etfsToSelect = [
        "KoAct 바이오헬스케어액티브",
        "TIME K바이오액티브",
        "KODEX 바이오",
        "TIGER 헬스케어",
        "TIGER 바이오TOP10"
    ];

    const baseEtfKeys = [
        "KoAct 바이오헬스케어액티브",
        "TIME K바이오액티브",
        "KODEX 바이오",
        "TIGER 헬스케어",
        "TIGER 바이오TOP10"
    ];

    // 커스텀 툴팁: 전일 대비 증감율 표시
    const CustomTooltip = ({ active, payload, label }: any) => {
        if (!active || !payload || payload.length === 0) return null;

        const currentIdx = chartData.findIndex((d) => d.date === label);
        const prevRow = currentIdx > 0 ? chartData[currentIdx - 1] : null;

        return (
            <div style={{
                backgroundColor: 'rgba(18, 18, 23, 0.97)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '12px',
                boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                padding: '10px 14px',
                fontSize: '12px',
                minWidth: '210px',
            }}>
                <p style={{ color: 'rgba(255,255,255,0.45)', marginBottom: '8px', fontSize: '11px' }}>
                    {label}
                </p>
                {payload.map((entry: any) => {
                    const val: number = entry.value;
                    if (val === undefined || val === null || isNaN(val)) return null;
                    const prevVal: number | null = prevRow?.[entry.dataKey] ?? null;
                    const dailyPct = prevVal != null && prevVal > 0
                        ? (((val - prevVal) / prevVal) * 100).toFixed(2)
                        : null;
                    const isUp = dailyPct !== null && parseFloat(dailyPct) >= 0;
                    const dailyColor = dailyPct === null ? 'rgba(255,255,255,0.3)'
                        : isUp ? '#34d399' : '#f87171';
                    const dailyText = dailyPct === null ? ''
                        : isUp ? `(+${dailyPct}%)` : `(${dailyPct}%)`;

                    return (
                        <div key={entry.dataKey} style={{
                            display: 'flex', justifyContent: 'space-between',
                            alignItems: 'center', gap: '12px', marginBottom: '4px',
                        }}>
                            <span style={{ color: entry.color, fontWeight: 'bold' }}>
                                {entry.dataKey}
                            </span>
                            <span style={{ color: 'rgba(255,255,255,0.85)', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                                {val.toFixed(1)}%
                                {dailyPct !== null && (
                                    <span style={{ color: dailyColor, marginLeft: '6px', fontSize: '11px' }}>
                                        {dailyText}
                                    </span>
                                )}
                            </span>
                        </div>
                    );
                })}
                <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '9px', marginTop: '6px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '5px' }}>
                    기준점 100 대비 &nbsp;·&nbsp; 괄호 = 전일대비 증감율
                </p>
            </div>
        );
    };

    // Filter and sort holdings table data if an ETF is selected
    const displayHoldingsKeys = selectedEtf ? [selectedEtf] : holdingsKeys;
    const displayHoldingsData = selectedEtf
        ? holdingsData
              .filter((row) => row[selectedEtf] !== undefined && row[selectedEtf] > 0)
              .sort((a, b) => (b[selectedEtf] || 0) - (a[selectedEtf] || 0))
        : holdingsData;

    return (
        <div className="w-full bg-[#121217]/60 border border-white/10 rounded-3xl p-4 xl:p-5 backdrop-blur-md shadow-xl flex flex-col mt-0">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-3">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Activity className="w-5 h-5 text-indigo-400" />
                    바이오섹터 주요 종목 현황
                </h3>
                <div className="flex bg-black/40 rounded-lg p-1 border border-white/5 shadow-inner">
                    {periodOptions.map(p => (
                        <button
                            key={p}
                            onClick={() => setPeriod(p)}
                            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${period === p
                                ? 'bg-indigo-600 text-white shadow-md'
                                : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
                            }`}
                        >
                            {p}
                        </button>
                    ))}
                </div>
            </div>

            {/* ETF Selector Chips for Constituent Overlay */}
            <div className="flex flex-wrap gap-2 items-center mb-4 bg-black/30 p-2.5 rounded-2xl border border-white/5">
                <span className="text-[11px] font-bold text-gray-400 mr-1 flex items-center">
                    🔍 구성종목 주가 비교:
                </span>
                {etfsToSelect.map((etfName, idx) => {
                    const isSelected = selectedEtf === etfName;
                    const themeColor = colors[idx % colors.length];
                    return (
                        <button
                            key={etfName}
                            onClick={() => setSelectedEtf(isSelected ? null : etfName)}
                            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all border ${
                                isSelected
                                    ? `bg-indigo-600/20 text-white shadow-[0_0_12px_rgba(99,102,241,0.25)]`
                                    : 'bg-white/5 border-white/10 text-gray-400 hover:text-gray-200 hover:bg-white/10'
                            }`}
                            style={{
                                borderColor: isSelected ? themeColor : 'rgba(255,255,255,0.06)'
                            }}
                        >
                            {etfName} {isSelected && '✓'}
                        </button>
                    );
                })}
                {selectedEtf && (
                    <button
                        onClick={() => setSelectedEtf(null)}
                        className="text-[10px] text-rose-400 hover:text-rose-300 font-bold ml-auto hover:underline transition-all"
                    >
                        비교 초기화 (X)
                    </button>
                )}
            </div>
 
            <div className="w-full h-[400px]">
                {isLoading ? (
                    <ChartLoadingPlaceholder height={400} message="바이오 ETF 데이터 로딩중" />
                ) : error ? (
                    <div className="w-full h-full flex items-center justify-center text-rose-400 text-sm">
                        {error}
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData} margin={{ top: 10, right: 15, left: 15, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                            <XAxis
                                dataKey="date"
                                stroke="rgba(255,255,255,0.2)"
                                tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }}
                                tickMargin={10}
                                minTickGap={30}
                            />
                            <YAxis
                                orientation="right"
                                width={55}
                                domain={['auto', 'auto']}
                                stroke="rgba(255,255,255,0.2)"
                                tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }}
                                tickFormatter={(val) => `${val.toFixed(0)}%`}
                            />
                            <RechartsTooltip content={<CustomTooltip />} />
                            <Legend
                                onClick={(o) => {
                                    const clickedKey = o.dataKey as string;
                                    if (etfsToSelect.includes(clickedKey)) {
                                        setSelectedEtf(prev => prev === clickedKey ? null : clickedKey);
                                    }
                                }}
                                onMouseEnter={handleLegendMouseEnter}
                                onMouseLeave={handleLegendMouseLeave}
                                wrapperStyle={{ paddingTop: '10px', fontSize: '12px', cursor: 'pointer' }}
                                iconType="circle"
                            />
                            {keys.map((k, idx) => {
                                const isConstituent = !baseEtfKeys.includes(k);
                                return (
                                    <Line
                                        key={k}
                                        type="monotone"
                                        dataKey={k}
                                        stroke={colors[idx % colors.length]}
                                        strokeWidth={hoveredLine === k ? (isConstituent ? 3 : 4) : hoveredLine ? 1 : (isConstituent ? 1.5 : 2)}
                                        strokeDasharray={isConstituent ? "4 4" : undefined}
                                        dot={false}
                                        activeDot={{ r: 4, strokeWidth: 0, fill: colors[idx % colors.length] }}
                                        name={k}
                                        connectNulls={true}
                                        style={{
                                            opacity: hoveredLine === k ? 1 : hoveredLine ? 0.3 : 0.8,
                                            transition: 'all 0.3s ease'
                                        }}
                                    />
                                );
                            })}
                        </LineChart>
                    </ResponsiveContainer>
                )}
            </div>
            <p className="text-[10px] text-gray-500 text-right mt-2 font-mono">
                * 기준점 100으로 환산된 지수/주가 추이 (배당/분배금 제외)
            </p>

            {/* Divider */}
            <div className="w-full border-t border-white/10 my-5"></div>

            {/* Holdings Table Section */}
            <div className="flex flex-col gap-3">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center w-full gap-1">
                    <h4 className="text-base font-bold text-white flex items-center gap-2">
                        <Activity className="w-4 h-4 text-emerald-400" />
                        바이오섹터 주요 ETF 구성종목 및 비중 비교 (%)
                    </h4>
                </div>
                
                {isHoldingsLoading ? (
                    <div className="py-8 flex justify-center items-center text-xs text-gray-400 font-medium">
                        구성종목 데이터를 로드하는 중...
                    </div>
                ) : holdingsData.length === 0 ? (
                    <div className="py-8 text-center text-xs text-rose-400">
                        구성종목 데이터를 불러오지 못했습니다.
                    </div>
                ) : (
                    <div className="overflow-x-auto overflow-y-auto max-h-[600px] w-full rounded-2xl border border-white/10 bg-black/30 shadow-inner">
                        <table className="w-full text-left border-collapse">
                            <thead className="sticky top-0 z-10">
                                <tr className="bg-white/5">
                                    <th className="px-4 py-3 text-xs font-bold text-gray-300 border-b border-white/10">
                                        구성종목명
                                    </th>
                                    {displayHoldingsKeys.map((k, idx) => {
                                        const originalIdx = holdingsKeys.indexOf(k);
                                        const dotColor = colors[originalIdx >= 0 ? originalIdx : idx % colors.length];
                                        return (
                                            <th key={k} className="px-3 py-3 text-center text-xs font-bold text-gray-300 border-b border-white/10">
                                                <div className="flex items-center justify-center gap-1.5 whitespace-nowrap">
                                                    <span style={{ color: dotColor }}>●</span>
                                                    {k}
                                                </div>
                                            </th>
                                        );
                                    })}
                                </tr>
                            </thead>
                            <tbody>
                                {displayHoldingsData.map((row) => (
                                    <tr 
                                        key={row.constituent} 
                                        className="hover:bg-white/5 transition-colors"
                                    >
                                        <td className="px-4 py-2.5 text-xs font-bold border-b border-white/5 max-w-[200px] truncate">
                                            {onOpenDetail ? (
                                                <button
                                                    onClick={() => {
                                                        const ticker = getTickerFromConstituent(row.constituent);
                                                        onOpenDetail(ticker);
                                                    }}
                                                    className="text-gray-200 hover:text-indigo-400 transition-all duration-200 text-left font-bold inline-flex items-center gap-1 group/btn"
                                                    title={`${row.constituent} 상세 주식 정보 조회`}
                                                >
                                                    <span className="group-hover/btn:underline">{row.constituent}</span>
                                                    <ArrowUpRight className="w-3.5 h-3.5 text-gray-400 group-hover/btn:text-indigo-400 transition-colors" />
                                                </button>
                                            ) : (
                                                <span className="text-gray-200">{row.constituent}</span>
                                            )}
                                        </td>
                                        {displayHoldingsKeys.map((k) => {
                                            const val = row[k];
                                            const isZero = !val || val === 0;
                                            if (isZero) {
                                                return (
                                                    <td key={k} className="px-3 py-2.5 text-center text-xs font-semibold text-gray-600 border-b border-white/5 font-mono">
                                                        -
                                                    </td>
                                                );
                                            }
                                            
                                            // Dynamic coloring based on weight value
                                            let cellColor = '#ffffff'; // < 5%: 흰색 (white)
                                            if (val >= 20) {
                                                cellColor = '#10b981'; // >= 20%: 짙은초록 (emerald-500)
                                            } else if (val >= 10) {
                                                cellColor = '#84cc16'; // >= 10%: 연두색 (lime-500)
                                            } else if (val >= 5) {
                                                cellColor = '#fbbf24'; // >= 5%: 노란색 (amber-400)
                                            }

                                            return (
                                                <td key={k} className="px-3 py-2 border-b border-white/5 align-middle min-w-[125px]">
                                                    <div className="flex flex-col gap-1 w-full">
                                                        {/* Value text on top aligned to the right */}
                                                        <div className="flex justify-end w-full">
                                                            <span 
                                                                className="text-[10.5px] font-bold font-mono"
                                                                style={{ color: cellColor }}
                                                            >
                                                                {val.toFixed(1)}%
                                                            </span>
                                                        </div>
                                                        {/* Progress bar track & solid vibrant color fill */}
                                                        <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                                                            <div 
                                                                className="h-full rounded-full transition-all duration-300"
                                                                style={{ 
                                                                    width: `${Math.min(val, 100)}%`,
                                                                    backgroundColor: cellColor
                                                                }}
                                                            />
                                                        </div>
                                                    </div>
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Divider */}
            <div className="w-full border-t border-white/10 my-6"></div>

            {/* Expert Insight Section */}
            <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                    <h4 className="text-base font-extrabold text-white flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-emerald-400 animate-pulse" />
                        글로벌 제약·바이오 메가 트렌드 & 포트폴리오 전략
                    </h4>
                    <span className="text-[10px] text-emerald-400/80 font-bold px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                        Gemini Expert Report
                    </span>
                </div>

                {/* Tab Menu */}
                <div className="flex flex-wrap bg-[#1a1a23]/60 p-1 rounded-xl border border-white/5 gap-1 self-start">
                    {[
                        { id: 'cycle', label: '1. 혁신 사이클 & M&A', icon: TrendingUp },
                        { id: 'etfs', label: '2. 국내외 핵심 ETF 분석', icon: BookOpen },
                        { id: 'strategy', label: '3. 연금 자산배분 솔루션', icon: PieChart }
                    ].map((tab) => {
                        const Icon = tab.icon;
                        const isSelected = activeInsightTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveInsightTab(tab.id as any)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                                    isSelected
                                        ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md'
                                        : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
                                }`}
                            >
                                <Icon className="w-3.5 h-3.5" />
                                {tab.label}
                            </button>
                        );
                    })}
                </div>

                {/* Tab Contents */}
                {activeInsightTab === 'cycle' && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-1">
                        {/* Card 1: Macro Pivot */}
                        <div className="bg-white/[0.02] hover:bg-white/[0.04] transition-all p-4 border border-white/5 rounded-2xl flex flex-col gap-2">
                            <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                                <TrendingUp className="w-4 h-4" />
                                <span>거시경제적 피벗 (Macro Pivot)</span>
                            </div>
                            <p className="text-xs text-gray-300 leading-relaxed">
                                2025년 하반기부터 본격화된 금리 인하 기조에 따라 바이오텍의 자본 조달 비용이 낮아지며 뚜렷한 회복세를 보이고 있습니다. 자본 집약적인 바이오 산업 특성상 유동성 공급은 투자 매력도를 높이는 기폭제 역할을 합니다.
                            </p>
                        </div>
                        {/* Card 2: Patent Cliff */}
                        <div className="bg-white/[0.02] hover:bg-white/[0.04] transition-all p-4 border border-white/5 rounded-2xl flex flex-col gap-2">
                            <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                                <ShieldAlert className="w-4 h-4" />
                                <span>특허 절벽 & M&A 활성화</span>
                            </div>
                            <p className="text-xs text-gray-300 leading-relaxed">
                                2026~2030년대 초반 블록버스터 의약품 특허가 대거 만료(엘리퀴스 &apos;26, 키트루다 &apos;28)됩니다. 매출 공백을 메우기 위해 글로벌 빅파마들은 임상 3상/상업화 단계 후기 자산(M&A 중 비중 24년 27% &rarr; 25년 46% 급증) 인수에 총력을 기울이고 있습니다. (예: J&J의 인트라-셀룰라 145억 달러 인수)
                            </p>
                        </div>
                        {/* Card 3: FDA Approval */}
                        <div className="bg-white/[0.02] hover:bg-white/[0.04] transition-all p-4 border border-white/5 rounded-2xl flex flex-col gap-2">
                            <div className="flex items-center gap-2 text-blue-400 font-bold text-sm">
                                <Info className="w-4 h-4" />
                                <span>FDA 신약 승인 랠리</span>
                            </div>
                            <p className="text-xs text-gray-300 leading-relaxed">
                                2025년 46개 혁신 신약이 승인(소분자 67%)된 데 이어, 비마약성 통증제 수제트리진(&apos;25.01), 구토 치료제 트라디피탄트(&apos;25.12), 주 1회 인슐린 아이코덱(&apos;26.03), 경구용 비만 치료제 오포글리프론(&apos;26.04) 등 획기적인 승인이 잇따르고 있습니다.
                            </p>
                        </div>
                    </div>
                )}

                {activeInsightTab === 'etfs' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-1">
                        {/* US ETFs */}
                        <div className="bg-white/[0.02] p-4 border border-white/5 rounded-2xl flex flex-col gap-3">
                            <h5 className="text-sm font-bold text-emerald-400 border-b border-white/5 pb-2">미국 시장 핵심 ETF</h5>
                            <div className="flex flex-col gap-2.5 text-xs text-gray-300">
                                <div>
                                    <span className="font-bold text-white">IBB (AUM $8.5B | 보수 0.44%):</span>
                                    <p className="mt-0.5 text-gray-400">대형 제약사/메가캡 바이오(버텍스, 길리어드, 암젠 등) 비중이 높아 하방 경직성이 우수하고 장기적인 안정성을 지닌 포트폴리오의 초석입니다.</p>
                                </div>
                                <div>
                                    <span className="font-bold text-white">XBI (AUM $8.4B | 보수 0.35%):</span>
                                    <p className="mt-0.5 text-gray-400">동일 가중 방식을 적용하여 중소형/마이크로캡 비중이 높습니다. 금리 인하 및 M&A 붐의 최대 수혜주로 2025년 35.84% 수익률로 뛰어난 탄력성을 증명했습니다.</p>
                                </div>
                                <div>
                                    <span className="font-bold text-white">특화 테마형 (CANC / ARKG / BBH):</span>
                                    <p className="mt-0.5 text-gray-400">항암 액티브 CANC(1년 +56.76%), 유전자 혁신 ARKG, 대형주 초집중 BBH 및 헬스케어 전체 지수를 추종하여 변동성을 억제하는 XLV($38.4B), VHT($19.2B) 등이 좋은 대안입니다.</p>
                                </div>
                            </div>
                        </div>
                        {/* KR ETFs */}
                        <div className="bg-white/[0.02] p-4 border border-white/5 rounded-2xl flex flex-col gap-3">
                            <h5 className="text-sm font-bold text-teal-400 border-b border-white/5 pb-2">국내 시장 핵심 ETF</h5>
                            <div className="flex flex-col gap-2.5 text-xs text-gray-300">
                                <div>
                                    <span className="font-bold text-white">KoAct 바이오헬스케어액티브 (462900 | AUM 6,000억대):</span>
                                    <p className="mt-0.5 text-gray-400">플랫폼 기술수출 및 ADC/이중항체 중심 기업(올릭스 9.9%, 알테오젠 8.9%, 셀트리온 7.7%, 에이비엘 7.7%, 리가켐 7.7%)을 동적으로 편입하며 1년 27.64%의 초과수익을 거두었습니다.</p>
                                </div>
                                <div>
                                    <span className="font-bold text-white">TIMEFOLIO K바이오액티브 (463050 | AUM 3,300억대):</span>
                                    <p className="mt-0.5 text-gray-400">모멘텀 트레이딩 및 비중 조절이 매우 신속한 하이퍼 액티브 펀드입니다. 알테오젠 10%, 셀트리온 9.5% 등 주도주에 과감하게 집중합니다. (연 보수 0.80%)</p>
                                </div>
                                <div>
                                    <span className="font-bold text-white">TIGER 바이오TOP10 (364970 | AUM 2,900억대):</span>
                                    <p className="mt-0.5 text-gray-400">국내 3대 대장주(셀트리온 26.2%, 알테오젠 21.5%, 삼성바이오로직스 15.9%) 비중이 63% 이상을 차지하도록 설계되어 대형주 위주의 안정적인 연금 장기투자에 유리합니다.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeInsightTab === 'strategy' && (
                    <div className="bg-white/[0.02] p-4 border border-white/5 rounded-2xl flex flex-col gap-4 mt-1">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <h5 className="text-xs font-bold text-emerald-400 mb-1">글로벌 대장주 중심 코어-새틀라이트</h5>
                                <p className="text-xs text-gray-300 leading-relaxed">
                                    포트폴리오의 60~70%는 매출 기반이 단단한 미국 대형 바이오텍(IBB) 및 헬스케어 지수(XLV, VHT)로 안전판을 구축하고, 30~40%는 금리 인하/M&A 국면의 업사이드를 노리는 XBI, CANC, 국내 플랫폼 액티브(KoAct, TIMEFOLIO)에 배분하여 성과를 다변화합니다.
                                </p>
                            </div>
                            <div>
                                <h5 className="text-xs font-bold text-emerald-400 mb-1">글로벌 신약 랠리와 국내 플랫폼의 인과성</h5>
                                <p className="text-xs text-gray-300 leading-relaxed">
                                    미국 시장의 중소형 신약 허가 랠리와 M&A는 글로벌 빅파마의 자금력을 강화시키고, 이는 다시 우수한 원천 플랫폼 기술을 가진 한국 바이오텍(ADC, 이중항체 등)으로의 글로벌 기술이전 활성화로 이어지는 긴밀한 연결고리를 형성합니다.
                                </p>
                            </div>
                        </div>
                        <div className="border-t border-white/5 pt-3">
                            <p className="text-[10px] text-gray-500 leading-relaxed">
                                * 개인연금 및 퇴직연금 계좌(IRP) 내에서는 국내 상장 바이오 액티브 ETF를 최대 70~100%까지 편입 가능하므로 과세이연 및 절세 혜택 극대화를 적극 권장합니다.
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
