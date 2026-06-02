"use client";

import React, { useState, useEffect } from 'react';
import { 
    Activity, Cpu, Layers, Zap, AlertTriangle, 
    ArrowUpRight, BarChart2, TrendingUp, TrendingDown, HelpCircle 
} from 'lucide-react';
import { 
    ResponsiveContainer, ComposedChart, Area, Line, Bar, BarChart,
    XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend 
} from 'recharts';
import { API_BASE } from '@/lib/apiConfig';
import ChartLoadingPlaceholder from './ChartLoadingPlaceholder';

interface NextLeaderScreenerProps {
    onOpenDetail?: (code: string) => void;
}

export default function NextLeaderScreener({ onOpenDetail }: NextLeaderScreenerProps) {
    // State variables
    const [polarizationData, setPolarizationData] = useState<any>(null);
    const [m7CapexData, setM7CapexData] = useState<any>(null);
    const [screenerData, setScreenerData] = useState<any>(null);
    
    const [loadingPolarization, setLoadingPolarization] = useState(true);
    const [loadingCapex, setLoadingCapex] = useState(true);
    const [loadingScreener, setLoadingScreener] = useState(true);
    
    const [selectedSector, setSelectedSector] = useState<string>("조선");
    const [hoveredRow, setHoveredRow] = useState<string | null>(null);

    // Fetch Polarization data
    useEffect(() => {
        const fetchPolarization = async () => {
            try {
                const res = await fetch(`${API_BASE}/api/v1/analyze/polarization`);
                if (res.ok) {
                    const data = await res.json();
                    setPolarizationData(data);
                }
            } catch (err) {
                console.error("Error fetching polarization ratio:", err);
            } finally {
                setLoadingPolarization(false);
            }
        };
        fetchPolarization();
    }, []);

    // Fetch M7 Capex & Semi Temperature data
    useEffect(() => {
        const fetchCapex = async () => {
            try {
                const res = await fetch(`${API_BASE}/api/v1/analyze/m7-capex`);
                if (res.ok) {
                    const data = await res.json();
                    setM7CapexData(data);
                }
            } catch (err) {
                console.error("Error fetching M7 capex data:", err);
            } finally {
                setLoadingCapex(false);
            }
        };
        fetchCapex();
    }, []);

    // Fetch Screener data
    useEffect(() => {
        const fetchScreener = async () => {
            try {
                const res = await fetch(`${API_BASE}/api/v1/analyze/screener`);
                if (res.ok) {
                    const data = await res.json();
                    setScreenerData(data);
                }
            } catch (err) {
                console.error("Error fetching screener data:", err);
            } finally {
                setLoadingScreener(false);
            }
        };
        fetchScreener();
    }, []);

    // 10 Sectors ordered
    const sectorsList = [
        "조선", "방산", "원자력", "AI전력", "2차전지", 
        "바이오", "반도체소부장", "엔터테인먼트", "화장품", "게임"
    ];

    // Polarization Custom Tooltip
    const PolarizationTooltip = ({ active, payload, label }: any) => {
        if (!active || !payload || payload.length === 0) return null;
        return (
            <div className="bg-[#121217]/95 border border-white/10 rounded-2xl p-4 shadow-2xl text-xs min-w-[220px] backdrop-blur-md">
                <p className="text-gray-400 font-bold mb-2">{label}</p>
                {payload.map((entry: any) => {
                    const val = entry.value;
                    const color = entry.color;
                    return (
                        <div key={entry.name} className="flex justify-between items-center mb-1 gap-4">
                            <span style={{ color }} className="font-semibold">{entry.name}</span>
                            <span className="text-white font-bold">{val.toFixed(2)}%</span>
                        </div>
                    );
                })}
                <p className="text-[10px] text-gray-500 border-t border-white/5 pt-2 mt-2">
                    대형주 - 중소형주 누적 수익률 스프레드
                </p>
            </div>
        );
    };

    // M7 Capex Custom Tooltip
    const CapexTooltip = ({ active, payload, label }: any) => {
        if (!active || !payload || payload.length === 0) return null;
        const totalVal = payload.reduce((sum: number, entry: any) => sum + (entry.name !== "Total" ? entry.value : 0), 0);
        return (
            <div className="bg-[#121217]/95 border border-white/10 rounded-2xl p-4 shadow-2xl text-xs min-w-[200px] backdrop-blur-md">
                <p className="text-gray-400 font-bold mb-2">{label} 분기별 투자액</p>
                {payload.map((entry: any) => {
                    if (entry.name === "Total") return null;
                    return (
                        <div key={entry.name} className="flex justify-between items-center mb-1 gap-4">
                            <div className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                                <span className="text-gray-300 font-medium uppercase">{entry.name}</span>
                            </div>
                            <span className="text-white font-bold">${entry.value.toFixed(1)}B</span>
                        </div>
                    );
                })}
                <div className="border-t border-white/10 pt-2 mt-2 flex justify-between items-center font-bold text-indigo-400">
                    <span>합계 (Total)</span>
                    <span>${totalVal.toFixed(1)}B</span>
                </div>
            </div>
        );
    };

    // Semiconductor temperature helper classes
    const getSignalColor = (level: string) => {
        switch (level) {
            case 'danger': return 'from-red-500 to-rose-600 shadow-red-500/20';
            case 'success': return 'from-emerald-500 to-green-600 shadow-emerald-500/20';
            default: return 'from-amber-500 to-yellow-600 shadow-amber-500/20';
        }
    };
    
    const getSignalTextColor = (level: string) => {
        switch (level) {
            case 'danger': return 'text-red-400';
            case 'success': return 'text-emerald-400';
            default: return 'text-amber-400';
        }
    };

    return (
        <div className="w-full flex flex-col gap-6">
            
            {/* Top Analysis Board */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* 1. Polarization Spread Card */}
                <div className="lg:col-span-7 bg-[#121217]/60 border border-white/10 rounded-3xl p-5 backdrop-blur-md shadow-xl flex flex-col">
                    <div className="flex justify-between items-center mb-4">
                        <div>
                            <h3 className="text-base font-bold text-white flex items-center gap-2">
                                <TrendingUp className="w-5 h-5 text-indigo-400" />
                                K-증시 극단적 양극화 스프레드
                            </h3>
                            <p className="text-xs text-gray-400 mt-1">
                                KODEX 대형주 vs KODEX 200중소형 상대 누적수익률 격차
                            </p>
                        </div>
                        {polarizationData && (
                            <div className="text-right">
                                <span className="text-[10px] font-bold text-gray-500 block uppercase">Spread Now</span>
                                <span className={`text-lg font-extrabold font-mono ${polarizationData.spread_now >= 0 ? 'text-indigo-400' : 'text-rose-400'}`}>
                                    {polarizationData.spread_now >= 0 ? '+' : ''}{polarizationData.spread_now?.toFixed(2)}%p
                                </span>
                            </div>
                        )}
                    </div>
                    
                    <div className="w-full h-[280px]">
                        {loadingPolarization ? (
                            <ChartLoadingPlaceholder height={280} message="양극화 스프레드 계산 중" />
                        ) : polarizationData?.chart ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={polarizationData.chart} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorSpread" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/>
                                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                    <XAxis 
                                        dataKey="date" 
                                        stroke="rgba(255,255,255,0.2)"
                                        tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }}
                                        tickMargin={8}
                                        minTickGap={40}
                                    />
                                    <YAxis 
                                        orientation="right"
                                        stroke="rgba(255,255,255,0.2)"
                                        tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }}
                                        tickFormatter={(val) => `${val}%`}
                                    />
                                    <RechartsTooltip content={<PolarizationTooltip />} />
                                    <Legend 
                                        verticalAlign="top" 
                                        height={36} 
                                        iconType="circle"
                                        iconSize={8}
                                        wrapperStyle={{ fontSize: '11px', fontWeight: 'semibold', paddingBottom: '10px' }}
                                    />
                                    <Area 
                                        type="monotone" 
                                        dataKey="spread" 
                                        name="수익률 스프레드 (대형주-중소형주)" 
                                        stroke="#6366f1" 
                                        strokeWidth={1.5}
                                        fillOpacity={1} 
                                        fill="url(#colorSpread)" 
                                    />
                                    <Line 
                                        type="monotone" 
                                        dataKey="large_cap_return" 
                                        name="KODEX 대형주" 
                                        stroke="#10b981" 
                                        strokeWidth={2} 
                                        dot={false}
                                    />
                                    <Line 
                                        type="monotone" 
                                        dataKey="small_cap_return" 
                                        name="KODEX 200중소형" 
                                        stroke="#f59e0b" 
                                        strokeWidth={2} 
                                        dot={false}
                                    />
                                </ComposedChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-xs text-rose-400">
                                데이터를 불러오지 못했습니다.
                            </div>
                        )}
                    </div>
                </div>

                {/* 2. M7 CAPEX & Semi Temp Dashboard */}
                <div className="lg:col-span-5 flex flex-col gap-6">
                    
                    {/* Semi Temperature Signal Widget */}
                    <div className="bg-[#121217]/60 border border-white/10 rounded-3xl p-5 backdrop-blur-md shadow-xl flex flex-col justify-between h-[155px]">
                        <div className="flex justify-between items-start">
                            <div>
                                <h3 className="text-base font-bold text-white flex items-center gap-2">
                                    <Cpu className="w-5 h-5 text-amber-400" />
                                    반도체 온도 & 비중 조절 신호
                                </h3>
                                <p className="text-xs text-gray-400 mt-1">
                                    삼성전자/SK하이닉스 200일 이동평균선 격차
                                </p>
                            </div>
                            
                            {m7CapexData?.semiconductor_temp && (
                                <div className="flex items-center gap-2 bg-black/30 px-3 py-1.5 rounded-xl border border-white/5">
                                    <span className={`w-3.5 h-3.5 rounded-full bg-gradient-to-r ${getSignalColor(m7CapexData.semiconductor_temp.signal_level)} shadow-[0_0_12px_rgba(255,255,255,0.15)] animate-pulse shrink-0`} />
                                    <span className={`text-xs font-bold ${getSignalTextColor(m7CapexData.semiconductor_temp.signal_level)}`}>
                                        {m7CapexData.semiconductor_temp.signal}
                                    </span>
                                </div>
                            )}
                        </div>

                        {loadingCapex ? (
                            <div className="h-10 flex items-center justify-center text-xs text-gray-400">
                                계산 중...
                            </div>
                        ) : m7CapexData?.semiconductor_temp ? (
                            <div className="grid grid-cols-2 gap-4 mt-2">
                                <div className="bg-black/30 p-2.5 rounded-xl border border-white/5 flex flex-col">
                                    <span className="text-[10px] text-gray-400 font-semibold">삼성전자 현재가 (200일선 이격)</span>
                                    <span className="text-sm font-extrabold text-white mt-1">
                                        {new Intl.NumberFormat('ko-KR').format(m7CapexData.semiconductor_temp.samsung.close)}원{' '}
                                        <span className={`text-[11px] font-mono font-bold ${m7CapexData.semiconductor_temp.samsung.distance_200d_pct >= 0 ? 'text-indigo-400' : 'text-rose-400'}`}>
                                            ({m7CapexData.semiconductor_temp.samsung.distance_200d_pct >= 0 ? '+' : ''}{m7CapexData.semiconductor_temp.samsung.distance_200d_pct}%)
                                        </span>
                                    </span>
                                </div>
                                <div className="bg-black/30 p-2.5 rounded-xl border border-white/5 flex flex-col">
                                    <span className="text-[10px] text-gray-400 font-semibold">SK하이닉스 현재가 (200일선 이격)</span>
                                    <span className="text-sm font-extrabold text-white mt-1">
                                        {new Intl.NumberFormat('ko-KR').format(m7CapexData.semiconductor_temp.hynix.close)}원{' '}
                                        <span className={`text-[11px] font-mono font-bold ${m7CapexData.semiconductor_temp.hynix.distance_200d_pct >= 0 ? 'text-indigo-400' : 'text-rose-400'}`}>
                                            ({m7CapexData.semiconductor_temp.hynix.distance_200d_pct >= 0 ? '+' : ''}{m7CapexData.semiconductor_temp.hynix.distance_200d_pct}%)
                                        </span>
                                    </span>
                                </div>
                            </div>
                        ) : (
                            <div className="text-xs text-rose-400 text-center py-2">
                                신호 데이터를 불러오지 못했습니다.
                            </div>
                        )}
                    </div>

                    {/* M7 Capex Trend Card */}
                    <div className="bg-[#121217]/60 border border-white/10 rounded-3xl p-5 backdrop-blur-md shadow-xl flex flex-col h-[280px]">
                        <div className="flex justify-between items-start mb-3">
                            <div>
                                <h3 className="text-base font-bold text-white flex items-center gap-2">
                                    <BarChart2 className="w-5 h-5 text-indigo-400" />
                                    M7 AI 인프라 투자(CAPEX) 추이
                                </h3>
                                <p className="text-xs text-gray-400 mt-1">
                                    빅테크 5개사 분기별 CAPEX 합산 (Billion USD)
                                </p>
                            </div>
                        </div>

                        <div className="w-full h-[180px]">
                            {loadingCapex ? (
                                <ChartLoadingPlaceholder height={180} message="M7 투자 지표 로드 중" />
                            ) : m7CapexData?.capex_chart ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={m7CapexData.capex_chart} margin={{ top: 10, right: 0, left: -25, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                        <XAxis 
                                            dataKey="quarter" 
                                            stroke="rgba(255,255,255,0.2)"
                                            tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }}
                                        />
                                        <YAxis 
                                            stroke="rgba(255,255,255,0.2)"
                                            tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }}
                                            tickFormatter={(val) => `$${val}B`}
                                        />
                                        <RechartsTooltip content={<CapexTooltip />} />
                                        <Bar dataKey="msft" name="MSFT" stackId="a" fill="#10b981" />
                                        <Bar dataKey="goog" name="GOOGL" stackId="a" fill="#3b82f6" />
                                        <Bar dataKey="meta" name="META" stackId="a" fill="#ec4899" />
                                        <Bar dataKey="amzn" name="AMZN" stackId="a" fill="#f59e0b" />
                                        <Bar dataKey="nvda" name="NVDA" stackId="a" fill="#8b5cf6" />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-xs text-rose-400">
                                    데이터를 불러오지 못했습니다.
                                </div>
                            )}
                        </div>
                        <p className="text-[10px] text-gray-500 text-right mt-1.5 font-semibold">
                            * 26.Q1 이후 분기는 기업 가이드라인 기반 예상치
                        </p>
                    </div>
                </div>
            </div>

            {/* Bottom 10-Sector Screener Card */}
            <div className="bg-[#121217]/60 border border-white/10 rounded-3xl p-5 backdrop-blur-md shadow-xl flex flex-col mt-0">
                
                {/* Section Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-5 pb-4 border-b border-white/10">
                    <div>
                        <h3 className="text-lg font-extrabold text-white flex items-center gap-2">
                            <Zap className="w-5 h-5 text-indigo-400 animate-pulse" />
                            차기 10대 주도주 스크리너 (퀀트 랭킹)
                        </h3>
                        <p className="text-xs text-gray-400 mt-1">
                            소외도 (35%) + 펀더멘털 (40%) + 기술적 반전 (25%) 종합 가중 점수 기반 각 섹터별 상위 종목 발굴
                        </p>
                    </div>
                    {screenerData && (
                        <div className="flex items-center gap-2.5 bg-indigo-600/10 px-3.5 py-2 rounded-xl border border-indigo-500/20">
                            <span className="text-xs font-bold text-indigo-400">
                                KOSPI 최근 6개월 수익률:
                            </span>
                            <span className={`text-xs font-extrabold font-mono ${screenerData.kospi_6m_return >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {screenerData.kospi_6m_return >= 0 ? '+' : ''}{screenerData.kospi_6m_return}%
                            </span>
                        </div>
                    )}
                </div>

                {/* Sector Navigation Tab Grid */}
                <div className="grid grid-cols-5 md:grid-cols-10 gap-2 mb-6">
                    {sectorsList.map((sector) => {
                        const isActive = selectedSector === sector;
                        return (
                            <button
                                key={sector}
                                onClick={() => setSelectedSector(sector)}
                                className={`px-2 py-3 text-xs font-bold rounded-xl transition-all border text-center ${
                                    isActive
                                        ? 'bg-gradient-to-br from-indigo-600 to-indigo-700 text-white border-indigo-500 shadow-lg shadow-indigo-600/20'
                                        : 'bg-black/30 border-white/5 text-gray-400 hover:text-gray-200 hover:bg-white/5'
                                }`}
                            >
                                {sector}
                            </button>
                        );
                    })}
                </div>

                {/* Candidates Table */}
                <div className="w-full">
                    {loadingScreener ? (
                        <div className="py-20 flex flex-col justify-center items-center gap-3 text-xs text-gray-400 font-semibold">
                            <Activity className="w-6 h-6 text-indigo-400 animate-spin" />
                            10대 주도주 구성종목 및 퀀트 지표 분석 중...
                        </div>
                    ) : screenerData?.sectors?.[selectedSector] ? (
                        <div className="overflow-x-auto w-full rounded-2xl border border-white/10 bg-black/40 shadow-inner">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-white/5 border-b border-white/10">
                                        <th className="px-4 py-3.5 text-xs font-bold text-gray-300">종목명</th>
                                        <th className="px-4 py-3.5 text-center text-xs font-bold text-gray-300">현재가</th>
                                        <th className="px-4 py-3.5 text-center text-xs font-bold text-gray-300">퀀트 종합점수</th>
                                        <th className="px-4 py-3.5 text-center text-xs font-bold text-gray-300">소외도 점수 (35%)</th>
                                        <th className="px-4 py-3.5 text-center text-xs font-bold text-gray-300">펀더멘털 점수 (40%)</th>
                                        <th className="px-4 py-3.5 text-center text-xs font-bold text-gray-300">기술반전 점수 (25%)</th>
                                        <th className="px-4 py-3.5 text-center text-xs font-bold text-gray-300">핵심 밸류에이션</th>
                                        <th className="px-4 py-3.5 text-center text-xs font-bold text-gray-300">6M 수익률</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {screenerData.sectors[selectedSector].map((stock: any, index: number) => (
                                        <tr 
                                            key={stock.code}
                                            onMouseEnter={() => setHoveredRow(stock.code)}
                                            onMouseLeave={() => setHoveredRow(null)}
                                            onClick={() => onOpenDetail?.(stock.code)}
                                            className="hover:bg-white/5 border-b border-white/5 transition-colors cursor-pointer"
                                        >
                                            {/* Stock Name */}
                                            <td className="px-4 py-3.5 text-xs font-bold">
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="text-gray-200 group-hover:text-indigo-400 flex items-center gap-1">
                                                        <span className="text-[10px] font-bold text-indigo-400 w-4 inline-block font-mono">#{index+1}</span>
                                                        {stock.name}
                                                        <ArrowUpRight className={`w-3.5 h-3.5 text-gray-500 transition-opacity duration-200 ${hoveredRow === stock.code ? 'opacity-100' : 'opacity-0'}`} />
                                                    </span>
                                                    <span className="text-[10px] text-gray-500 font-mono pl-5">{stock.code} (비중 {stock.weight?.toFixed(1)}%)</span>
                                                </div>
                                            </td>

                                            {/* Price */}
                                            <td className="px-4 py-3.5 text-center text-xs font-bold font-mono text-gray-300">
                                                {new Intl.NumberFormat('ko-KR').format(stock.close)}원
                                            </td>

                                            {/* Quant Score */}
                                            <td className="px-4 py-3.5 text-center text-xs">
                                                <div className="flex flex-col items-center justify-center gap-1.5">
                                                    <span className="text-indigo-400 font-extrabold font-mono text-sm">{stock.quant_score}점</span>
                                                    <div className="w-16 h-1 bg-white/5 rounded-full overflow-hidden">
                                                        <div className="h-full bg-gradient-to-r from-indigo-500 to-blue-500" style={{ width: `${stock.quant_score}%` }}></div>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Out of Favor Score */}
                                            <td className="px-4 py-3.5 text-center text-xs font-semibold font-mono text-gray-400">
                                                {stock.out_of_favor_score}점
                                            </td>

                                            {/* Fundamental Score */}
                                            <td className="px-4 py-3.5 text-center text-xs font-semibold font-mono text-gray-400">
                                                {stock.fundamental_score}점
                                            </td>

                                            {/* Technical Score */}
                                            <td className="px-4 py-3.5 text-center text-xs font-semibold font-mono text-gray-400">
                                                {stock.technical_score}점
                                            </td>

                                            {/* Valuations (PER, PBR, ROE) */}
                                            <td className="px-4 py-3.5 text-center text-xs font-medium text-gray-300">
                                                <div className="flex items-center justify-center gap-2.5 font-mono text-[11px]">
                                                    <span title="PER">P/E: <strong className="text-gray-100">{stock.per !== null ? `${stock.per}x` : '적자'}</strong></span>
                                                    <span className="text-white/10">|</span>
                                                    <span title="PBR">P/B: <strong className="text-gray-100">{stock.pbr !== null ? `${stock.pbr}x` : '-'}</strong></span>
                                                    <span className="text-white/10">|</span>
                                                    <span title="ROE">ROE: <strong className="text-indigo-400">{stock.roe !== null ? `${stock.roe}%` : '-'}</strong></span>
                                                </div>
                                            </td>

                                            {/* 6M Return */}
                                            <td className="px-4 py-3.5 text-center text-xs font-bold font-mono align-middle">
                                                <span className={`inline-flex items-center gap-0.5 px-2 py-1 rounded-lg ${stock.return_6m >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                                                    {stock.return_6m >= 0 ? '+' : ''}{stock.return_6m}%
                                                    {stock.return_6m >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="py-20 text-center text-xs text-rose-400">
                            섹터 구성 종목 데이터를 불러올 수 없습니다.
                        </div>
                    )}
                </div>
            </div>
            
        </div>
    );
}
