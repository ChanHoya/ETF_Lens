import React, { useMemo } from 'react';
import { X, TrendingUp, TrendingDown, DollarSign, Wallet, FileText, PieChart as PieChartIcon } from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip as RechartsTooltip } from "recharts";

/* eslint-disable @typescript-eslint/no-explicit-any */
type AccountDetailModalProps = {
    isOpen: boolean;
    onClose: () => void;
    account: any;
    accountHoldings: any[];
};

export default function AccountDetailModal({ isOpen, onClose, account, accountHoldings }: AccountDetailModalProps) {
    if (!isOpen || !account) return null;

    // Formatting Helpers
    const formatNumber = (val: number) => new Intl.NumberFormat('ko-KR').format(Math.floor(val));
    const formatPercent = (val: number) => `${val.toFixed(2)}%`;

    const cashBalance = account.cash_balance || 0;
    const totalAsset = account.total_asset || 0;

    // Derived from holdings instead of aggregate to get pure account insight
    const stockEvalAmount = useMemo(() => {
        return accountHoldings.reduce((sum, holding) => sum + (holding.eval_amount || 0), 0);
    }, [accountHoldings]);

    const totalProfitLoss = useMemo(() => {
        return accountHoldings.reduce((sum, holding) => sum + (holding.profit_loss || 0), 0);
    }, [accountHoldings]);

    // 매입금액 = 평가금액 - 평가손익
    const totalPurchaseAmount = stockEvalAmount - totalProfitLoss;
    const returnRate = totalPurchaseAmount > 0 ? (totalProfitLoss / totalPurchaseAmount) * 100 : 0;

    // Weight percentages relative to this specific account
    const cashWeight = totalAsset > 0 ? (cashBalance / totalAsset) * 100 : 0;
    const stockWeight = totalAsset > 0 ? (stockEvalAmount / totalAsset) * 100 : 0;

    // Account-level Region & Asset Category Aggregation
    const groupByCategory = (key: string) => {
        const groups: Record<string, number> = {};
        accountHoldings.forEach((h: any) => {
            const cat = h[key] || '기타';
            groups[cat] = (groups[cat] || 0) + (h.eval_amount || 0);
        });

        // Attach cash to precise categories
        if (key === 'category_asset' && cashBalance > 0) {
            groups['현금'] = (groups['현금'] || 0) + cashBalance;
        } else if (key === 'category_region' && cashBalance > 0) {
            groups['한국'] = (groups['한국'] || 0) + cashBalance;
        }

        return Object.keys(groups).map(k => ({ name: k, value: groups[k] })).sort((a, b) => b.value - a.value);
    };

    const regionData = useMemo(() => groupByCategory('category_region'), [accountHoldings, cashBalance]);
    const assetTypeData = useMemo(() => groupByCategory('category_asset'), [accountHoldings, cashBalance]);

    const regionColors = { '한국': '#3b82f6', '미국': '#f43f5e', '기타': '#8b5cf6' };
    const assetColors = { '주식': '#14b8a6', '채권': '#f59e0b', '현금': '#64748b', '금': '#eab308', '기타': '#71717a' };

    const getRegionColor = (name: string) => regionColors[name as keyof typeof regionColors] || '#71717a';
    const getAssetColor = (name: string) => assetColors[name as keyof typeof assetColors] || '#71717a';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-[#121217] border border-white/10 rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col relative">

                {/* Header */}
                <div className="sticky top-0 z-10 bg-[#121217] p-6 border-b border-white/10 flex justify-between items-center backdrop-blur-md">
                    <div>
                        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                            <span className="w-1.5 h-6 bg-blue-500 rounded-full"></span>
                            {account.account_name || '계좌'} 수익률 현황
                        </h2>
                        <p className="text-gray-400 text-sm mt-1 font-mono tracking-wider ml-4">
                            ACC: {account.account_no}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                        title="닫기"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="p-6 flex flex-col gap-6">
                    {/* Top Section: Overview Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                        {/* 자산현황 Card */}
                        <div className="bg-white/[0.02] border border-white/10 rounded-xl p-5">
                            <h3 className="text-lg font-semibold text-gray-200 mb-4 flex items-center gap-2">
                                <Wallet className="w-5 h-5 text-emerald-400" />
                                자산현황
                            </h3>
                            <div className="flex flex-col gap-3">
                                <div className="flex justify-between items-center border-b border-white/5 pb-2">
                                    <span className="text-gray-400">예수금</span>
                                    <div className="text-right">
                                        <span className="text-gray-200 font-medium">{formatNumber(cashBalance)} 원</span>
                                        <span className="ml-3 text-sm text-emerald-400">{formatPercent(cashWeight)}</span>
                                    </div>
                                </div>
                                <div className="flex justify-between items-center border-b border-white/5 pb-2">
                                    <span className="text-gray-400">주식 평가금액</span>
                                    <div className="text-right">
                                        <span className="text-gray-200 font-medium">{formatNumber(stockEvalAmount)} 원</span>
                                        <span className="ml-3 text-sm text-blue-400">{formatPercent(stockWeight)}</span>
                                    </div>
                                </div>
                                <div className="flex justify-between items-center pt-1">
                                    <span className="text-gray-300 font-bold">총 자산금액</span>
                                    <div className="text-right">
                                        <span className="text-white font-bold text-lg">{formatNumber(totalAsset)} 원</span>
                                        <span className="ml-3 text-sm text-gray-400">100.00%</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 계좌수익률 Card */}
                        <div className="bg-white/[0.02] border border-white/10 rounded-xl p-5">
                            <h3 className="text-lg font-semibold text-gray-200 mb-4 flex items-center gap-2">
                                <TrendingUp className="w-5 h-5 text-rose-400" />
                                계좌수익률
                            </h3>
                            <div className="flex flex-col gap-3">
                                <div className="flex justify-between items-center border-b border-white/5 pb-2">
                                    <span className="text-gray-400">매입금액</span>
                                    <span className="text-gray-200 font-medium">{formatNumber(totalPurchaseAmount)} 원</span>
                                </div>
                                <div className="flex justify-between items-center border-b border-white/5 pb-2">
                                    <span className="text-gray-400">평가손익금액</span>
                                    <span className={`font-semibold ${totalProfitLoss > 0 ? 'text-rose-400' : totalProfitLoss < 0 ? 'text-blue-400' : 'text-gray-200'}`}>
                                        {totalProfitLoss > 0 ? '+' : ''}{formatNumber(totalProfitLoss)} 원
                                    </span>
                                </div>
                                <div className="flex justify-between items-center pt-1">
                                    <span className="text-gray-300 font-bold">누적수익률</span>
                                    <span className={`font-bold text-lg ${returnRate > 0 ? 'text-rose-400' : returnRate < 0 ? 'text-blue-400' : 'text-gray-200'}`}>
                                        {returnRate > 0 ? '+' : ''}{formatPercent(returnRate)}
                                    </span>
                                </div>
                            </div>
                        </div>

                    </div>

                    {/* Middle Section: Categorical Allocation Charts */}
                    <div className="bg-white/[0.02] border border-white/10 rounded-xl p-5 flex flex-col pt-6">
                        <h3 className="text-lg font-semibold text-gray-200 mb-6 flex items-center gap-2">
                            <PieChartIcon className="w-5 h-5 text-fuchsia-400" />
                            계좌 포트폴리오 비중
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 divide-y md:divide-y-0 md:divide-x divide-white/10">
                            {/* Region Pie */}
                            <div className="flex flex-col items-center w-full pt-4 md:pt-0">
                                <h4 className="text-sm text-gray-400 mb-2">투자 지역별 비중</h4>
                                <div className="w-full h-[180px] relative flex justify-center items-center">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={regionData}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={45}
                                                outerRadius={70}
                                                paddingAngle={2}
                                                dataKey="value"
                                                stroke="none"
                                            >
                                                {regionData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={getRegionColor(entry.name)} />
                                                ))}
                                            </Pie>
                                            <RechartsTooltip
                                                formatter={(value: any) => `${formatNumber(value as number)}원`}
                                                contentStyle={{ backgroundColor: 'rgba(9, 9, 11, 0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '12px' }}
                                            />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                                <div className="flex flex-wrap justify-center gap-3 mt-4">
                                    {regionData.map((d) => (
                                        <div key={d.name} className="flex items-center gap-1.5 text-xs text-gray-400">
                                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: getRegionColor(d.name) }}></div>
                                            {d.name} <span className="text-gray-200 font-medium ml-0.5">{formatPercent(totalAsset > 0 ? (d.value / totalAsset) * 100 : 0)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Asset Type Pie */}
                            <div className="flex flex-col items-center w-full pt-6 md:pt-0">
                                <h4 className="text-sm text-gray-400 mb-2">투자 자산군별 비중</h4>
                                <div className="w-full h-[180px] relative flex justify-center items-center">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={assetTypeData}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={45}
                                                outerRadius={70}
                                                paddingAngle={2}
                                                dataKey="value"
                                                stroke="none"
                                            >
                                                {assetTypeData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={getAssetColor(entry.name)} />
                                                ))}
                                            </Pie>
                                            <RechartsTooltip
                                                formatter={(value: any) => `${formatNumber(value as number)}원`}
                                                contentStyle={{ backgroundColor: 'rgba(9, 9, 11, 0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '12px' }}
                                            />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                                <div className="flex flex-wrap justify-center gap-3 mt-4">
                                    {assetTypeData.map((d) => (
                                        <div key={d.name} className="flex items-center gap-1.5 text-xs text-gray-400">
                                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: getAssetColor(d.name) }}></div>
                                            {d.name} <span className="text-gray-200 font-medium ml-0.5">{formatPercent(totalAsset > 0 ? (d.value / totalAsset) * 100 : 0)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Bottom Section: Holdings Detail */}
                    <div>
                        <h3 className="text-xl font-bold text-gray-100 flex items-center gap-2 mb-4">
                            <FileText className="w-5 h-5 text-indigo-400" />
                            보유 종목 상세현황
                        </h3>
                        <div className="bg-white/[0.02] border border-white/10 rounded-xl overflow-x-auto">
                            <table className="w-full text-left border-collapse whitespace-nowrap min-w-[700px]">
                                <thead>
                                    <tr className="bg-black/30 border-b border-white/10 text-sm font-medium text-gray-400">
                                        <th className="py-4 px-6">종목 <span className="text-xs text-gray-500 font-normal ml-1">(코드/이름)</span></th>
                                        <th className="py-4 px-4 text-right">수량 <span className="text-xs text-gray-500 font-normal ml-1">(비중)</span></th>
                                        <th className="py-4 px-4 text-right">매입평균 <span className="text-xs text-gray-500 font-normal ml-1">(현재가)</span></th>
                                        <th className="py-4 px-4 text-right">매입금액 <span className="text-xs text-gray-500 font-normal ml-1">(평가금액)</span></th>
                                        <th className="py-4 px-6 text-right">평가손익 <span className="text-xs text-gray-500 font-normal ml-1">(수익률)</span></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5 text-sm">
                                    {accountHoldings.map((h: any, idx: number) => {
                                        const hPurchase = h.qty * h.avg_price;
                                        const hWeight = totalAsset > 0 ? (h.eval_amount / totalAsset) * 100 : 0;
                                        const isLoss = h.profit_loss < 0;

                                        return (
                                            <tr key={idx} className="hover:bg-white/[0.03] transition-colors">
                                                {/* Code & Name */}
                                                <td className="py-3 px-6">
                                                    <div className="flex flex-col gap-1">
                                                        <span className="text-xs text-gray-500 font-mono tracking-wider">{h.code}</span>
                                                        <span className="text-gray-200 font-medium truncate max-w-[200px]">{h.name}</span>
                                                    </div>
                                                </td>
                                                {/* Qty & Weight */}
                                                <td className="py-3 px-4 text-right">
                                                    <div className="flex flex-col gap-1">
                                                        <span className="text-gray-300 font-medium">{formatNumber(h.qty)} <span className="text-xs text-gray-500 font-normal">좌</span></span>
                                                        <span className="text-xs text-indigo-400">{formatPercent(hWeight)}</span>
                                                    </div>
                                                </td>
                                                {/* Avg Price & Current Price */}
                                                <td className="py-3 px-4 text-right">
                                                    <div className="flex flex-col gap-1">
                                                        <span className="text-gray-400">{formatNumber(h.avg_price)}</span>
                                                        <span className="text-gray-200">{formatNumber(h.current_price)}</span>
                                                    </div>
                                                </td>
                                                {/* Purchase Amount & Eval Amount */}
                                                <td className="py-3 px-4 text-right">
                                                    <div className="flex flex-col gap-1">
                                                        <span className="text-gray-400">{formatNumber(hPurchase)}</span>
                                                        <span className="text-white font-medium">{formatNumber(h.eval_amount)}</span>
                                                    </div>
                                                </td>
                                                {/* Profit Loss & Return Rate */}
                                                <td className="py-3 px-6 text-right">
                                                    <div className="flex flex-col gap-1 items-end">
                                                        <span className={`font-semibold ${isLoss ? 'text-blue-400' : h.profit_loss > 0 ? 'text-rose-400' : 'text-gray-300'}`}>
                                                            {h.profit_loss > 0 ? '+' : ''}{formatNumber(h.profit_loss)}
                                                        </span>
                                                        <div className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-sm ${isLoss ? 'bg-blue-400/10 text-blue-400' : h.return_rate > 0 ? 'bg-rose-400/10 text-rose-400' : 'text-gray-400 border border-white/10'}`}>
                                                            {isLoss ? <TrendingDown size={12} /> : (h.return_rate > 0 ? <TrendingUp size={12} /> : null)}
                                                            <span>{h.return_rate > 0 ? '+' : ''}{formatPercent(h.return_rate)}</span>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                    {accountHoldings.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="py-8 text-center text-gray-500">
                                                보유하신 주식/ETF 종목이 없습니다.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
