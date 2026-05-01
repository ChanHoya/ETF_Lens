import React, { useMemo, useState } from 'react';
import { TffFundData, TffHoldingsRow, TffMonthInfo } from '../../../lib/tff/types';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, ReferenceLine, LabelList } from 'recharts';
import { PiggyBank, TrendingUp, TrendingDown, Layers, Wallet, BarChart2 } from 'lucide-react';

interface Props {
    data: TffFundData;
}

function categorizeAsset(name: string) {
    const isEM = name.includes("차이나") || name.includes("항셍") || name.includes("인도") || name.includes("베트남") || name.includes("EM");
    const isUS = name.includes("미국") || name.includes("S&P") || name.includes("나스닥") || name.includes("다우") || name.includes("필라델피아") || name.includes("테크") || name.includes("글로벌");
    const isBond = name.includes("채권") || name.includes("국고채") || name.includes("국채") || name.includes("회사채") || name.includes("종합채권");
    const isCash = name.includes("머니마켓") || name.includes("CD") || name.includes("KOFR") || name.includes("현금") || name.includes("단기자금") || name.includes("파킹");
    const isCommodity = name.includes("금현물") || name.includes("은현물") || name.includes("원자재") || name.includes("골드") || name.includes("구리") || name.includes("원유");

    if (isCommodity) return "대체자산";
    if (isBond) {
        return (name.includes("미국") || name.includes("US")) ? "미국채권" : "국내채권";
    }
    if (isCash) return "현금/파킹형";
    // TDF나 기타 특별 자산 방어
    if (name.includes("TDF")) return "혼합형(TDF)";

    if (isEM) return "신흥국형(EM)";
    if (isUS) return "미국주식형";
    return "국내주식형";
}

const CATEGORY_COLORS: Record<string, string> = {
    "국내주식형": "#3b82f6",     // blue
    "미국주식형": "#f43f5e",     // rose
    "신흥국형(EM)": "#d946ef",   // fuchsia
    "국내채권": "#0ea5e9",       // sky
    "미국채권": "#f5700bff",       // amber
    "대체자산": "#eab308",       // yellow
    "현금/파킹형": "#10b981",    // emerald
    "혼합형(TDF)": "#8b5cf6"     // violet
};

const PRIMARY_CATEGORY_MAPPING: Record<string, string> = {
    "국내주식형": "주식형",
    "미국주식형": "주식형",
    "신흥국형(EM)": "주식형",
    "국내채권": "채권형",
    "미국채권": "채권형",
    "대체자산": "기타",
    "현금/파킹형": "기타",
    "혼합형(TDF)": "기타"
};

const PRIMARY_COLORS: Record<string, string> = {
    "주식형": "#6366f1", // indigo
    "채권형": "#0ea5e9", // sky
    "기타": "#10b981"    // emerald
};

export default function OverviewView({ data }: Props) {
    const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);

    // 1. Data Selection
    const totalData = data.cumulative?.totalData;
    let latestInfo: TffMonthInfo | null = data.ytm;
    if (!latestInfo && Object.keys(data.monthlyMap).length > 0) {
        const months = Object.keys(data.monthlyMap).sort((a, b) => parseInt(a) - parseInt(b));
        latestInfo = data.monthlyMap[months[months.length - 1]];
    }

    if (!totalData || !latestInfo) {
        return <div className="text-gray-400 p-8 text-center animate-pulse">데이터를 구성하는 중입니다...</div>;
    }

    // 2. Summary Formatting
    const formatMoney = (val: number) => new Intl.NumberFormat('ko-KR').format(Math.round(val));
    const formatPct = (val?: number) => {
        if (!val) return '0.0%';
        return (val > 0 ? '+' : '') + val.toFixed(1) + '%';
    };

    const isProfit = totalData.profitAmount >= 0;

    // 3. Asset Allocation (2-Tier Pie Chart)
    const allocationData = useMemo(() => {
        const primaryMap: Record<string, number> = {};
        const secondaryMap: Record<string, number> = {};

        latestInfo!.holdings.forEach(h => {
            const cat = categorizeAsset(h.name);
            const pCat = PRIMARY_CATEGORY_MAPPING[cat] || "기타";

            if (!secondaryMap[cat]) secondaryMap[cat] = 0;
            secondaryMap[cat] += h.endValue;

            if (!primaryMap[pCat]) primaryMap[pCat] = 0;
            primaryMap[pCat] += h.endValue;
        });

        // 계좌 잔고(예수금) 더하기
        const cashBalance = latestInfo!.summary.cashBalance || 0;
        if (cashBalance > 0) {
            if (!secondaryMap["현금/파킹형"]) secondaryMap["현금/파킹형"] = 0;
            secondaryMap["현금/파킹형"] += cashBalance;

            const pCat = PRIMARY_CATEGORY_MAPPING["현금/파킹형"];
            if (!primaryMap[pCat]) primaryMap[pCat] = 0;
            primaryMap[pCat] += cashBalance;
        }

        const primaryData = Object.keys(primaryMap).map(k => ({
            name: k,
            value: primaryMap[k],
            color: PRIMARY_COLORS[k] || "#64748b"
        })).sort((a, b) => b.value - a.value);

        const secondaryData = Object.keys(secondaryMap).map(k => ({
            name: k,
            value: secondaryMap[k],
            color: CATEGORY_COLORS[k] || "#64748b",
            primaryCat: PRIMARY_CATEGORY_MAPPING[k] || "기타"
        })).sort((a, b) => {
            const pA = a.primaryCat;
            const pB = b.primaryCat;
            if (pA !== pB) {
                const order = ["주식형", "채권형", "기타"];
                return order.indexOf(pA) - order.indexOf(pB);
            }
            return b.value - a.value;
        });

        return { primaryData, secondaryData };
    }, [latestInfo]);

    // 4. Top Contributors / Detractors
    const performanceData = useMemo(() => {
        // 투자수익금(investmentPnl) 기준으로 정렬
        const sorted = [...latestInfo!.holdings].sort((a, b) => b.investmentPnl - a.investmentPnl);

        let top3 = sorted.slice(0, 3).filter(a => a.investmentPnl > 0);
        let bottom3 = sorted.filter(a => a.investmentPnl < 0).slice(-3).reverse(); // 가장 손실 큰 3개 (sorted는 내림차순이므로 뒤에서부터)

        const allPerformers = [...top3, ...bottom3].map(d => ({
            name: d.name,
            pnl: d.investmentPnl,
            fill: d.investmentPnl > 0 ? '#ef4444' : '#3b82f6'
        }));

        let maxVal = 0;
        let minVal = 0;
        allPerformers.forEach(d => {
            if (d.pnl > maxVal) maxVal = d.pnl;
            if (d.pnl < minVal) minVal = d.pnl;
        });

        // 실제 발생한 손실/수익의 최대/최소 범위에 10% 여백을 붙여 공간을 꽉 채우도록 도메인 설정
        const domain = [minVal * 1.1, maxVal * 1.1];

        return {
            data: allPerformers,
            domain
        };
    }, [latestInfo]);

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">

            <div className="flex items-center gap-2 mb-4">
                <BarChart2 className="w-5 h-5 text-sky-400" />
                <h3 className="text-lg md:text-xl font-bold text-white tracking-tight">전체 자산 및 운용 현황</h3>
            </div>

            {/* 1. Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                <div className="bg-gradient-to-br from-indigo-900/40 to-slate-900/60 border border-indigo-500/20 rounded-2xl p-4 flex flex-col justify-between relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Wallet className="w-16 h-16 text-indigo-400" />
                    </div>
                    <div className="flex items-center gap-2 mb-2 text-indigo-300 relative z-10">
                        <div className="w-2 h-2 rounded-full bg-indigo-400"></div>
                        <span className="text-xs md:text-sm font-bold opacity-80">총 자산 (기말평가액)</span>
                    </div>
                    <div className="relative z-10">
                        <span className="text-2xl md:text-3xl font-black text-white tracking-tight">{formatMoney(totalData.endValue)}<span className="text-base font-medium text-gray-400 ml-1">원</span></span>
                    </div>
                </div>

                <div className={`bg-gradient-to-br ${isProfit ? 'from-rose-900/30 to-slate-900/60 border-rose-500/20' : 'from-blue-900/30 to-slate-900/60 border-blue-500/20'} border rounded-2xl p-4 flex flex-col justify-between relative overflow-hidden group`}>
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        {isProfit ? <TrendingUp className="w-16 h-16 text-rose-400" /> : <TrendingDown className="w-16 h-16 text-blue-400" />}
                    </div>
                    <div className={`flex items-center gap-2 mb-2 ${isProfit ? 'text-rose-300' : 'text-blue-300'} relative z-10`}>
                        <div className={`w-2 h-2 rounded-full ${isProfit ? 'bg-rose-400' : 'bg-blue-400'}`}></div>
                        <span className="text-xs md:text-sm font-bold opacity-80">누적 수익금</span>
                    </div>
                    <div className="relative z-10">
                        <span className={`text-2xl md:text-3xl font-black tracking-tight ${isProfit ? 'text-rose-400' : 'text-blue-400'}`}>
                            {isProfit ? '+' : ''}{formatMoney(totalData.profitAmount)}<span className="text-base font-medium opacity-70 ml-1">원</span>
                        </span>
                    </div>
                </div>

                <div className={`bg-gradient-to-br ${isProfit ? 'from-rose-900/20 to-slate-900/60 border-rose-500/10' : 'from-blue-900/20 to-slate-900/60 border-blue-500/10'} border rounded-2xl p-4 flex flex-col justify-between relative overflow-hidden`}>
                    <div className={`flex items-center gap-2 mb-2 ${isProfit ? 'text-rose-300' : 'text-blue-300'} relative z-10`}>
                        <div className={`w-2 h-2 rounded-full ${isProfit ? 'bg-rose-400' : 'bg-blue-400'}`}></div>
                        <span className="text-xs md:text-xs font-bold opacity-80">시간평잔수익률 / 이익률</span>
                    </div>
                    <div className="relative z-10">
                        <span className={`text-xl md:text-2xl font-black tracking-tight ${isProfit ? 'text-rose-400' : 'text-blue-400'}`}>
                            {formatPct(totalData.timeWeightedReturn || totalData.returnRate)}
                            <span className="text-gray-500 font-medium mx-1.5 opacity-60">/</span>
                            <span className="text-lg md:text-xl opacity-90">
                                {formatPct(totalData.beginValue + (totalData.netInOut > 0 ? totalData.netInOut : 0) > 0
                                    ? (totalData.profitAmount / (totalData.beginValue + (totalData.netInOut > 0 ? totalData.netInOut : 0))) * 100
                                    : 0)}
                            </span>
                        </span>
                        <div className="text-[10px] text-gray-500 mt-1 uppercase font-mono tracking-wider">
                            vs S&P500 {formatPct(totalData.sp500Rate)} / KOSPI {formatPct(totalData.kospiRate)}
                        </div>
                    </div>
                </div>

                <div className="bg-black/30 border border-white/5 rounded-2xl p-4 flex flex-col justify-between relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-5">
                        <PiggyBank className="w-16 h-16 text-white" />
                    </div>
                    <div className="flex items-center gap-2 mb-2 text-gray-400 relative z-10">
                        <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                        <span className="text-xs md:text-sm font-bold">예수금 (가용 현금)</span>
                    </div>
                    <div className="relative z-10">
                        <span className="text-xl md:text-2xl font-bold text-gray-200 tracking-tight">
                            {formatMoney(latestInfo!.summary.cashBalance)}<span className="text-sm font-medium text-gray-500 ml-1">원</span>
                        </span>
                        <div className="text-[10px] text-emerald-400/70 mt-1 font-bold">
                            전체 자산의 {((latestInfo!.summary.cashBalance / totalData.endValue) * 100).toFixed(1)}% 편입
                        </div>
                    </div>
                </div>
            </div>

            {/* 2. 시각화 패널 (도넛 차트 & 기여도) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

                {/* 분류별 비중 도넛 */}
                <div className="bg-black/20 border border-white/5 rounded-2xl p-4 md:p-6 flex flex-col">
                    <h4 className="text-sm font-bold text-gray-300 mb-6 flex items-center gap-2 border-l-2 border-sky-500 pl-2">
                        <Layers className="w-4 h-4 text-sky-400" /> 자산군별 배분 비중
                    </h4>
                    <div className="flex flex-col md:flex-row items-center justify-center flex-1 gap-6 md:gap-10">
                        <div className="w-[240px] h-[240px] shrink-0 relative">
                            {/* Inner Circle Label */}
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10">
                                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">Total Assets</span>
                                <span className="text-xl font-black text-gray-200">100%</span>
                            </div>
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={allocationData.primaryData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={50}
                                        outerRadius={65}
                                        dataKey="value"
                                        stroke="none"
                                        paddingAngle={2}
                                    >
                                        {allocationData.primaryData.map((entry, index) => (
                                            <Cell key={`primary-${index}`} fill={entry.color} opacity={0.65} />
                                        ))}
                                    </Pie>
                                    <Pie
                                        data={allocationData.secondaryData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={75}
                                        outerRadius={105}
                                        paddingAngle={3}
                                        dataKey="value"
                                        stroke="none"
                                        cornerRadius={3}
                                    >
                                        {allocationData.secondaryData.map((entry, index) => (
                                            <Cell
                                                key={`secondary-${index}`}
                                                fill={entry.color}
                                                style={{
                                                    transition: 'all 0.3s ease',
                                                    opacity: hoveredCategory ? (hoveredCategory === entry.name ? 1 : 0.2) : 1,
                                                    filter: hoveredCategory === entry.name ? 'brightness(1.2)' : 'none'
                                                }}
                                            />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        formatter={(val: number, name: string) => [`${formatMoney(val)} 원`, name]}
                                        contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#e2e8f0', fontSize: '12px' }}
                                        itemStyle={{ color: '#f8fafc', fontWeight: 'bold' }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="flex flex-col flex-1 w-full gap-4 justify-start pl-2 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                            {allocationData.primaryData.map((p, pIdx) => {
                                const pPct = (p.value / totalData.endValue) * 100;
                                const children = allocationData.secondaryData.filter(s => s.primaryCat === p.name);
                                if (children.length === 0) return null;

                                return (
                                    <div key={`p-${pIdx}`} className="w-full">
                                        <div className="flex justify-between items-center text-sm font-black w-full text-white mb-2 pb-1 border-b border-white/5">
                                            <div className="flex items-center gap-2">
                                                <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: p.color }}></div>
                                                <span>{p.name} <span className="text-[10px] text-gray-500 font-normal ml-1">({children.length})</span></span>
                                            </div>
                                            <span className="text-gray-300 font-bold">{pPct.toFixed(1)}%</span>
                                        </div>
                                        <div className="flex flex-col gap-2.5 pl-3">
                                            {children.map((d, i) => {
                                                const pct = (d.value / totalData.endValue) * 100;
                                                const isHovered = hoveredCategory === d.name;
                                                return (
                                                    <div
                                                        key={i}
                                                        className={`flex flex-col gap-1 w-full cursor-default transition-all duration-300 ${hoveredCategory && !isHovered ? 'opacity-40' : 'opacity-100'}`}
                                                        onMouseEnter={() => setHoveredCategory(d.name)}
                                                        onMouseLeave={() => setHoveredCategory(null)}
                                                    >
                                                        <div className="flex justify-between items-end text-xs font-bold w-full pr-1">
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }}></div>
                                                                <span className="text-gray-400">{d.name}</span>
                                                            </div>
                                                            <span className="text-gray-500 font-medium">{pct.toFixed(1)}%</span>
                                                        </div>
                                                        <div className="w-full bg-white/5 h-1 rounded-full overflow-hidden">
                                                            <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: d.color }}></div>
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
                </div>

                {/* 성과 기여도 */}
                <div className="bg-black/20 border border-white/5 rounded-2xl p-4 md:p-6 flex flex-col">
                    <h4 className="text-sm font-bold text-gray-300 mb-2 flex items-center gap-2 border-l-2 border-rose-500 pl-2">
                        <TrendingUp className="w-4 h-4 text-rose-400" /> 올해 수익 기여 종목 (Top 3 & Bottom 3)
                    </h4>
                    <p className="text-[10px] text-gray-500 mb-6 font-medium pl-2">* 실제 평가수익금(절대금액) 기준으로 포트폴리오에 가장 영향력이 컸던 종목입니다.</p>

                    <div className="flex-1 w-full relative min-h-[250px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={performanceData.data} layout="vertical" margin={{ top: 0, right: 10, left: 30, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={true} stroke="rgba(255,255,255,0.05)" />
                                <XAxis
                                    type="number"
                                    domain={performanceData.domain}
                                    tickFormatter={(val) => {
                                        if (val === 0) return '0';
                                        return `${val > 0 ? '+' : ''}${formatMoney(val / 10000)}만`;
                                    }}
                                    tick={{ fill: '#6b7280', fontSize: 10 }}
                                    axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                                    tickLine={false}
                                />
                                <YAxis
                                    type="category"
                                    dataKey="name"
                                    width={160}
                                    tick={{ fill: '#cbd5e1', fontSize: 11, fontWeight: 'bold' }}
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <Tooltip
                                    formatter={(val: number) => {
                                        const text = `${val > 0 ? '+' : ''}${formatMoney(val)} 원`;
                                        return [text, val > 0 ? '수익금' : '손실금'];
                                    }}
                                    contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#e2e8f0', fontSize: '12px' }}
                                    itemStyle={{ color: '#f8fafc', fontWeight: 'bold' }}
                                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                />
                                <ReferenceLine x={0} stroke="rgba(255,255,255,0.3)" strokeWidth={2} />
                                <Bar dataKey="pnl" maxBarSize={20}>
                                    {performanceData.data.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.fill} fillOpacity={0.85} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

            </div>
        </div>
    );
}
