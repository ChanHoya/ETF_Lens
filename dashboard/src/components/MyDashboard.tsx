import React from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, PieChart, Pie, Cell, Tooltip as RechartsTooltip, Legend } from "recharts";

/* eslint-disable @typescript-eslint/no-explicit-any */
type MyDashboardProps = {
    data: any;
};

export default function MyDashboard({ data }: MyDashboardProps) {
    if (!data || !data.kis_raw || !data.analyzed) return null;

    const { kis_raw, analyzed } = data;
    const { summary, holdings } = kis_raw;

    // Formatting Helpers
    const formatNumber = (val: number) => new Intl.NumberFormat('ko-KR').format(Math.floor(val));
    const formatPercent = (val: number) => `${(val * 100).toFixed(2)}%`;

    // 1. Prepare Radar Chart Data
    const factorBalance = analyzed.factor_balance || {};
    const radarData = [
        { subject: '수익성', value: Math.round(factorBalance['수익성'] || 0) },
        { subject: '성장성', value: Math.round(factorBalance['성장성'] || 0) },
        { subject: '가치(저평가)', value: Math.round(factorBalance['가치(저평가)'] || 0) },
        { subject: '배당', value: Math.round(factorBalance['배당'] || 0) },
        { subject: '모멘텀', value: Math.round(factorBalance['모멘텀'] || 0) },
        { subject: '안전성', value: Math.round(factorBalance['안전성'] || 0) },
        { subject: '수수료', value: Math.round(factorBalance['수수료'] || 0) },
    ];

    // 2. Prepare X-Ray Pie Chart Data
    const trueHoldings = analyzed.true_holdings_top10 || [];
    const pieColors = ['#818cf8', '#34d399', '#fbbf24', '#f87171', '#c084fc', '#60a5fa', '#f472b6', '#a3e635', '#f97316', '#14b8a6'];

    // 3. Prepare Sub-metrics
    const metrics = analyzed.metrics || {};
    const estimatedFee = metrics.weighted_fee ? (summary.total_eval_amount * (metrics.weighted_fee / 100)) : 0;
    const estimatedDiv = metrics.weighted_dividend ? (summary.total_eval_amount * (metrics.weighted_dividend / 100)) : 0;

    return (
        <div className="w-full flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-5 duration-700">

            {/* Top Summaries */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white/[0.03] p-5 rounded-2xl border border-white/10 backdrop-blur-md">
                    <h3 className="text-gray-400 text-sm mb-1">총 자산 (예수금 포함)</h3>
                    <p className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-300">
                        {formatNumber(summary.total_asset)}원
                    </p>
                </div>
                <div className="bg-white/[0.03] p-5 rounded-2xl border border-white/10 backdrop-blur-md">
                    <h3 className="text-gray-400 text-sm mb-1">총 평가손익</h3>
                    <p className={`text-2xl font-bold ${summary.total_profit_loss > 0 ? 'text-red-400' : summary.total_profit_loss < 0 ? 'text-blue-400' : 'text-gray-300'}`}>
                        {summary.total_profit_loss > 0 ? '+' : ''}{formatNumber(summary.total_profit_loss)}원
                    </p>
                </div>
                <div className="bg-white/[0.03] p-5 rounded-2xl border border-emerald-500/20 backdrop-blur-md relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-500/10 rounded-bl-full"></div>
                    <h3 className="text-emerald-400/80 text-sm mb-1">예상 연 배당금 (추정)</h3>
                    <p className="text-2xl font-bold text-emerald-400">
                        약 {formatNumber(estimatedDiv)}원
                    </p>
                    <p className="text-xs text-emerald-500/70 mt-1">포트폴리오 배당수익률: {(metrics.weighted_dividend || 0).toFixed(2)}%</p>
                </div>
                <div className="bg-white/[0.03] p-5 rounded-2xl border border-rose-500/20 backdrop-blur-md relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-16 h-16 bg-rose-500/10 rounded-bl-full"></div>
                    <h3 className="text-rose-400/80 text-sm mb-1">연간 예상 보수 (수수료)</h3>
                    <p className="text-2xl font-bold text-rose-400">
                        약 {formatNumber(estimatedFee)}원
                    </p>
                    <p className="text-xs text-rose-500/70 mt-1">가중 평균 수수료율: {(metrics.weighted_fee || 0).toFixed(2)}%</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Radar Chart Factor Balance */}
                <div className="bg-white/[0.03] p-6 rounded-3xl border border-white/10 backdrop-blur-md flex flex-col items-center">
                    <h3 className="w-full text-lg font-bold mb-4 flex items-center gap-2">
                        <span className="w-1.5 h-6 bg-gradient-to-b from-indigo-400 to-purple-500 rounded-full"></span>
                        나의 종합 팩터 밸런스
                        <span className="text-xs font-normal text-gray-500 ml-2 border border-white/10 px-2 py-0.5 rounded-full">
                            ETF 비중: {formatPercent(metrics.etf_ratio)}
                        </span>
                    </h3>
                    {metrics.etf_ratio > 0 ? (
                        <div className="w-full max-w-sm h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                                    <PolarGrid stroke="rgba(255,255,255,0.1)" />
                                    <PolarAngleAxis dataKey="subject" tick={{ fill: '#a1a1aa', fontSize: 12, fontWeight: 600 }} />
                                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                                    <Radar name="My Portfolio" dataKey="value" stroke="#818cf8" fill="#818cf8" fillOpacity={0.4} />
                                    <RechartsTooltip contentStyle={{ backgroundColor: 'rgba(9, 9, 11, 0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} itemStyle={{ color: '#fff' }} />
                                </RadarChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div className="flex-1 flex items-center justify-center text-gray-500 h-[300px]">
                            계좌에 분석 가능한 ETF가 없습니다.
                        </div>
                    )}
                </div>

                {/* X-Ray Holdings Pie Chart */}
                <div className="bg-white/[0.03] p-6 rounded-3xl border border-white/10 backdrop-blur-md flex flex-col">
                    <h3 className="w-full text-lg font-bold mb-4 flex items-center gap-2">
                        <span className="w-1.5 h-6 bg-gradient-to-b from-pink-400 to-rose-500 rounded-full"></span>
                        실질 보유 종목 TOP 10 (X-Ray)
                    </h3>
                    <div className="flex-1 w-full h-[300px] flex items-center">
                        {trueHoldings.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={trueHoldings}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={100}
                                        paddingAngle={2}
                                        dataKey="weight"
                                    >
                                        {trueHoldings.map((entry: any, index: number) => (
                                            <Cell key={`cell-${index}`} fill={pieColors[index % pieColors.length]} />
                                        ))}
                                    </Pie>
                                    <RechartsTooltip
                                        formatter={(value: any) => formatPercent(value as number)}
                                        contentStyle={{ backgroundColor: 'rgba(9, 9, 11, 0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                                    />
                                    <Legend layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{ fontSize: '12px' }} formatter={(value, entry: any) => <span className="text-gray-300">{value} ({formatPercent(entry.payload.weight)})</span>} />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="w-full flex items-center justify-center text-gray-500 h-full">
                                보유 내역이 없거나 분석 불가 형태입니다.
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Holdings Table */}
            <div className="bg-white/[0.03] rounded-3xl border border-white/10 backdrop-blur-md overflow-hidden">
                <div className="p-6 border-b border-white/5">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                        <span className="w-1.5 h-6 bg-gradient-to-b from-blue-400 to-cyan-500 rounded-full"></span>
                        계좌 상세 잔고
                    </h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-black/20 text-xs text-gray-400 uppercase tracking-wider">
                                <th className="p-4 font-medium">종목명</th>
                                <th className="p-4 font-medium text-right">보유수량</th>
                                <th className="p-4 font-medium text-right">매입평균가</th>
                                <th className="p-4 font-medium text-right">현재가</th>
                                <th className="p-4 font-medium text-right">평가금액</th>
                                <th className="p-4 font-medium text-right">평가손익</th>
                                <th className="p-4 font-medium text-right">수익률</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {holdings.map((h: any, idx: number) => (
                                <tr key={idx} className="hover:bg-white/[0.02] transition-colors">
                                    <td className="p-4">
                                        <div className="font-bold text-sm text-gray-200">{h.name}</div>
                                        <div className="text-xs text-gray-500 font-mono">{h.code}</div>
                                    </td>
                                    <td className="p-4 text-right text-sm text-gray-300">{formatNumber(h.qty)}주</td>
                                    <td className="p-4 text-right text-sm text-gray-300">{formatNumber(h.avg_price)}원</td>
                                    <td className="p-4 text-right text-sm text-gray-300">{formatNumber(h.current_price)}원</td>
                                    <td className="p-4 text-right text-sm font-bold text-gray-200">{formatNumber(h.eval_amount)}원</td>
                                    <td className={`p-4 text-right text-sm font-bold ${h.profit_loss > 0 ? 'text-red-400' : h.profit_loss < 0 ? 'text-blue-400' : 'text-gray-400'}`}>
                                        {h.profit_loss > 0 ? '+' : ''}{formatNumber(h.profit_loss)}
                                    </td>
                                    <td className={`p-4 text-right text-sm font-bold ${h.return_rate > 0 ? 'text-red-400' : h.return_rate < 0 ? 'text-blue-400' : 'text-gray-400'}`}>
                                        {h.return_rate > 0 ? '+' : ''}{h.return_rate.toFixed(2)}%
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

        </div>
    );
}
