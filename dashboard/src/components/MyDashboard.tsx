import React from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip as RechartsTooltip, Legend, LineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts";

/* eslint-disable @typescript-eslint/no-explicit-any */
type MyDashboardProps = {
    data: any;
};

export default function MyDashboard({ data }: MyDashboardProps) {
    if (!data || !data.kis_raw) return null;

    const { kis_raw } = data;
    const { summary, holdings } = kis_raw;

    // Formatting Helpers
    const formatNumber = (val: number) => new Intl.NumberFormat('ko-KR').format(Math.floor(val));
    const formatPercent = (val: number) => `${(val * 100).toFixed(2)}%`;

    // Derived Metrics
    const totalAsset = summary.total_asset || 0;
    const cashBalance = summary.cash_balance || 0;
    const totalProfitLoss = summary.total_profit_loss || 0;

    // Calculate total invest principal (매수금액)
    const totalPrincipal = totalAsset - totalProfitLoss - cashBalance;

    // Overall return rate (excluding cash)
    const stockEvalAmount = summary.total_eval_amount || 0;
    const stockPrincipal = stockEvalAmount - totalProfitLoss;
    const totalReturnRate = stockPrincipal > 0 ? (totalProfitLoss / stockPrincipal) * 100 : 0;

    // Section 4 Pie Data (주식 vs 예수금)
    const typeData = [
        { name: '주식', value: stockEvalAmount },
        { name: '예수금', value: cashBalance },
    ];
    const pieColors = ['#3b82f6', '#14b8a6']; // Blue for stocks, Teal for cash

    // Section 2 Dummy Chart Data (Since KIS TTTC8434R only gives current snapshot)
    const dummyChartData = [
        { name: '현재', returnRate: totalReturnRate }
    ];

    return (
        <div className="w-full flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-5 duration-700 font-sans pb-10">

            {/* Section 1: 나의 자산 (Overview) */}
            <section className="flex flex-col gap-4">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                    <span className="w-1.5 h-6 bg-indigo-500 rounded-full"></span>
                    나의 자산
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-6 flex flex-col justify-between backdrop-blur-md">
                        <span className="text-gray-400 font-medium mb-4">총액</span>
                        <div className="text-right">
                            <span className="text-4xl font-extrabold tracking-tight text-white">{formatNumber(totalAsset)}</span>
                            <span className="text-gray-400 ml-1">원</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-4">* 고객님께서 보유하신 총 자산 합계액입니다.</p>
                    </div>

                    <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-6 flex flex-col justify-between backdrop-blur-md">
                        <span className="text-gray-400 font-medium mb-4">출금 가능 금액</span>
                        <div className="flex justify-between items-end mb-2 border-b border-white/5 pb-4">
                            <span className="text-gray-400">예수금+CMA</span>
                            <div className="text-right">
                                <span className="text-2xl font-bold text-white">{formatNumber(cashBalance)}</span>
                                <span className="text-sm text-gray-400 ml-1">원</span>
                            </div>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-gray-500">출금 가능 금액</span>
                            <button className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors">가능금액 조회</button>
                        </div>
                    </div>

                    <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-6 flex flex-col justify-center gap-3 backdrop-blur-md">
                        <span className="text-gray-400 font-medium">대출</span>
                        <button className="w-full bg-white/10 hover:bg-white/15 text-white py-3 rounded-lg font-medium transition-colors border border-white/5">
                            대출약정 (신규)
                        </button>
                        <button className="w-full text-sm text-gray-400 hover:text-white transition-colors">
                            대출 알아보기
                        </button>
                    </div>
                </div>
            </section>

            {/* Section 2: 수익률 (Return Rates) */}
            <section className="flex flex-col gap-4 mt-4">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                    <span className="w-1.5 h-6 bg-rose-500 rounded-full"></span>
                    수 수익률
                </h2>
                <div className="bg-white/[0.02] border border-white/10 rounded-2xl backdrop-blur-md overflow-hidden flex flex-col">
                    {/* Header metrics */}
                    <div className="grid grid-cols-2 divide-x divide-white/10 border-b border-white/10">
                        <div className="p-6 flex flex-col items-center justify-center">
                            <span className="text-sm text-gray-400 mb-2">• 누적 총 수익</span>
                            <div className="flex items-baseline gap-2">
                                <span className={`text-3xl font-bold ${totalProfitLoss > 0 ? 'text-rose-400' : totalProfitLoss < 0 ? 'text-blue-400' : 'text-gray-200'}`}>
                                    {totalProfitLoss > 0 ? '+' : ''}{formatNumber(totalProfitLoss)}원
                                </span>
                                <span className={`font-semibold ${totalProfitLoss > 0 ? 'text-rose-400' : totalProfitLoss < 0 ? 'text-blue-400' : 'text-gray-400'}`}>
                                    {totalReturnRate.toFixed(2)}%
                                </span>
                            </div>
                        </div>
                        <div className="p-6 flex flex-col items-center justify-center">
                            <span className="text-sm text-gray-400 mb-2">• 당일 평가손익</span>
                            <div className="flex items-baseline gap-2">
                                <span className="text-3xl font-bold text-gray-200">-</span>
                                <span className="text-sm text-gray-500">(API 제공 한계)</span>
                            </div>
                        </div>
                    </div>
                    {/* Chart area */}
                    <div className="p-6 h-[250px] w-full flex flex-col">
                        <div className="w-full h-full flex items-center justify-center text-gray-500 bg-black/20 rounded-xl relative border border-white/5">
                            <span className="absolute text-sm">현재 평가 수익률 (시계열 데이터 수집 필요)</span>
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={dummyChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                    <XAxis dataKey="name" stroke="none" tick={{ fill: '#71717a' }} />
                                    <YAxis stroke="none" tick={{ fill: '#71717a' }} />
                                    <RechartsTooltip contentStyle={{ backgroundColor: 'rgba(9, 9, 11, 0.9)', borderColor: 'rgba(255,255,255,0.1)' }} />
                                    <Line type="monotone" dataKey="returnRate" stroke="#f43f5e" strokeWidth={3} dot={{ r: 6, fill: '#f43f5e', strokeWidth: 2, stroke: '#18181b' }} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            </section>

            {/* Section 3: 계좌내역 (Account Status) */}
            <section className="flex flex-col gap-4 mt-4">
                <div className="flex justify-between items-end">
                    <h2 className="text-2xl font-bold flex items-baseline gap-3">
                        <div className="flex items-center gap-2">
                            <span className="w-1.5 h-6 bg-emerald-500 rounded-full"></span>
                            계좌내역
                        </div>
                        <span className="text-sm font-normal text-gray-400">(유잔고 1개)</span>
                    </h2>
                    <div className="flex gap-2">
                        <button className="px-4 py-2 text-sm border border-white/10 rounded-md hover:bg-white/5 transition-colors text-gray-300">전체 계좌보기</button>
                    </div>
                </div>

                <div className="bg-white/[0.02] border border-white/10 rounded-2xl backdrop-blur-md overflow-x-auto">
                    <table className="w-full text-left border-collapse whitespace-nowrap">
                        <thead>
                            <tr className="bg-black/20 text-sm font-medium text-gray-400 border-b border-white/10">
                                <th className="p-4 text-center">계좌번호</th>
                                <th className="p-4 text-center">계좌유형</th>
                                <th className="p-4 text-center">계좌별명</th>
                                <th className="p-4 text-right">계좌자산</th>
                                <th className="p-4 text-center">출금가능 금액</th>
                                <th className="p-4 text-center">바로가기</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            <tr className="hover:bg-white/[0.02] transition-colors">
                                <td className="p-4 text-center font-mono text-gray-200">연동계좌</td>
                                <td className="p-4 text-center text-gray-300">위탁계좌</td>
                                <td className="p-4 text-center text-gray-300">KOREA INV.</td>
                                <td className="p-4 text-right font-bold text-gray-200">{formatNumber(totalAsset)}</td>
                                <td className="p-4 text-center text-gray-400">
                                    <button className="px-3 py-1 border border-white/10 rounded text-xs hover:bg-white/10">조회</button>
                                </td>
                                <td className="p-4 text-center">
                                    <div className="flex items-center justify-center gap-3 text-sm">
                                        <button className="text-gray-400 hover:text-white underline underline-offset-2">이체</button>
                                        <button className="text-gray-400 hover:text-white underline underline-offset-2">거래내역</button>
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </section>

            {/* Section 4: 상품 유형별 현황 (Assets by Product Type) */}
            <section className="flex flex-col gap-4 mt-4">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                    <span className="w-1.5 h-6 bg-cyan-500 rounded-full"></span>
                    상품 유형별 현황
                </h2>

                <div className="bg-white/[0.02] border border-white/10 rounded-2xl backdrop-blur-md p-6 flex flex-col lg:flex-row gap-8 items-center">

                    {/* Donut Chart */}
                    <div className="w-full lg:w-1/3 h-[250px] relative flex justify-center items-center">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={typeData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={70}
                                    outerRadius={100}
                                    paddingAngle={2}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    {typeData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={pieColors[index % pieColors.length]} />
                                    ))}
                                </Pie>
                                <RechartsTooltip
                                    formatter={(value: any) => `${formatNumber(value as number)}원`}
                                    contentStyle={{ backgroundColor: 'rgba(9, 9, 11, 0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                        {/* Center text */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            <span className="text-sm text-gray-400">총 자산</span>
                            <span className="font-bold text-lg">{formatNumber(totalAsset)}</span>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="w-full lg:w-2/3 overflow-x-auto">
                        <table className="w-full text-left border-collapse whitespace-nowrap">
                            <thead>
                                <tr className="border-b border-white/10 text-sm font-medium text-gray-400">
                                    <th className="py-3 px-4">상품유형</th>
                                    <th className="py-3 px-4 text-right">매수금액</th>
                                    <th className="py-3 px-4 text-right">평가금액</th>
                                    <th className="py-3 px-4 text-right">손익금액</th>
                                    <th className="py-3 px-4 text-right">비중</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5 text-sm">
                                <tr className="hover:bg-white/[0.02] transition-colors">
                                    <td className="py-4 px-4 flex items-center gap-2">
                                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: pieColors[1] }}></div>
                                        예수금+CMA
                                    </td>
                                    <td className="py-4 px-4 text-right">{formatNumber(cashBalance)}</td>
                                    <td className="py-4 px-4 text-right">{formatNumber(cashBalance)}</td>
                                    <td className="py-4 px-4 text-right text-gray-500">0</td>
                                    <td className="py-4 px-4 text-right font-medium">{formatPercent(totalAsset > 0 ? (cashBalance / totalAsset) : 0)}</td>
                                </tr>
                                <tr className="hover:bg-white/[0.02] transition-colors">
                                    <td className="py-4 px-4 flex items-center gap-2">
                                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: pieColors[0] }}></div>
                                        주식
                                    </td>
                                    <td className="py-4 px-4 text-right text-gray-300">{formatNumber(stockPrincipal)}</td>
                                    <td className="py-4 px-4 text-right text-gray-200">{formatNumber(stockEvalAmount)}</td>
                                    <td className={`py-4 px-4 text-right font-semibold ${totalProfitLoss > 0 ? 'text-rose-400' : totalProfitLoss < 0 ? 'text-blue-400' : 'text-gray-400'}`}>
                                        {formatNumber(totalProfitLoss)}
                                    </td>
                                    <td className="py-4 px-4 text-right font-medium">{formatPercent(totalAsset > 0 ? (stockEvalAmount / totalAsset) : 0)}</td>
                                </tr>
                                <tr className="hover:bg-white/[0.02] transition-colors">
                                    <td className="py-4 px-4 flex items-center gap-2 text-gray-500">
                                        <div className="w-2.5 h-2.5 rounded-full bg-gray-600"></div>
                                        해외주식
                                    </td>
                                    <td className="py-4 px-4 text-right text-gray-600">0</td>
                                    <td className="py-4 px-4 text-right text-gray-600">0</td>
                                    <td className="py-4 px-4 text-right text-gray-600">0</td>
                                    <td className="py-4 px-4 text-right text-gray-600">0.00%</td>
                                </tr>
                                <tr className="hover:bg-white/[0.02] transition-colors bg-white/[0.01] border-t-2 border-white/10 font-bold">
                                    <td className="py-4 px-4 text-gray-300">합계</td>
                                    <td className="py-4 px-4 text-right">{formatNumber(totalPrincipal)}</td>
                                    <td className="py-4 px-4 text-right text-gray-100">{formatNumber(totalAsset)}</td>
                                    <td className={`py-4 px-4 text-right ${totalProfitLoss > 0 ? 'text-rose-400' : totalProfitLoss < 0 ? 'text-blue-400' : 'text-gray-400'}`}>
                                        {formatNumber(totalProfitLoss)}
                                    </td>
                                    <td className="py-4 px-4 text-right">100.00%</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>

        </div>
    );
}
