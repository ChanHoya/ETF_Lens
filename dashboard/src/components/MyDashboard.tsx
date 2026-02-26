import React from 'react';

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
    // const formatPercent = (val: number) => `${(val * 100).toFixed(2)}%`;

    // 1. Prepare Sub-metrics
    const metrics = analyzed.metrics || {};
    const estimatedFee = metrics.weighted_fee ? (summary.total_eval_amount * (metrics.weighted_fee / 100)) : 0;
    const estimatedDiv = metrics.weighted_dividend ? (summary.total_eval_amount * (metrics.weighted_dividend / 100)) : 0;

    return (
        <div className="w-full flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-5 duration-700">

            {/* Row 1: 총자산 / 계좌별 자산총액 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white/[0.03] p-6 text-center md:text-left rounded-3xl border border-white/10 backdrop-blur-md">
                    <h3 className="text-gray-400 text-base mb-2">총 자산</h3>
                    <p className="text-4xl md:text-5xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-300">
                        {formatNumber(summary.total_asset)}원
                    </p>
                    <p className="text-sm text-gray-500 mt-2">현금(예수금) + 전체 평가금액</p>
                </div>
                <div className="bg-white/[0.03] p-6 text-center md:text-left rounded-3xl border border-white/10 backdrop-blur-md">
                    <h3 className="text-gray-400 text-base mb-2">계좌별 자산총액</h3>
                    <p className="text-3xl md:text-4xl font-bold text-gray-200">
                        {formatNumber(summary.total_asset)}원
                    </p>
                    <p className="text-sm text-indigo-400 mt-2">연동 계좌 단일 합산</p>
                </div>
            </div>

            {/* Row 2: 총 평가손익 / 누적 분배금 / 예상 연 배당금 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white/[0.03] p-5 rounded-2xl border border-white/10 backdrop-blur-md text-center">
                    <h3 className="text-gray-400 text-sm mb-2">총 평가손익</h3>
                    <p className={`text-2xl font-bold ${summary.total_profit_loss > 0 ? 'text-red-400' : summary.total_profit_loss < 0 ? 'text-blue-400' : 'text-gray-300'}`}>
                        {summary.total_profit_loss > 0 ? '+' : ''}{formatNumber(summary.total_profit_loss)}원
                    </p>
                </div>
                <div className="bg-white/[0.03] p-5 rounded-2xl border border-white/10 backdrop-blur-md text-center">
                    <h3 className="text-gray-400 text-sm mb-2">누적 분배금</h3>
                    <p className="text-2xl font-bold text-gray-300">
                        0원
                    </p>
                    <p className="text-xs text-gray-500 mt-1">(API 추가 지원 예정)</p>
                </div>
                <div className="bg-white/[0.03] p-5 rounded-2xl border border-emerald-500/20 backdrop-blur-md text-center relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-500/10 rounded-bl-full"></div>
                    <h3 className="text-emerald-400/80 text-sm mb-2">예상 연 배당금(추정)</h3>
                    <p className="text-2xl font-bold text-emerald-400">
                        약 {formatNumber(estimatedDiv)}원
                    </p>
                    <p className="text-xs text-emerald-500/70 mt-1">배당수익률(가중): {(metrics.weighted_dividend || 0).toFixed(2)}%</p>
                </div>
            </div>

            {/* Holdings Table */}
            <div className="bg-white/[0.03] rounded-3xl border border-white/10 backdrop-blur-md overflow-hidden mt-2">
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
