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

    const stockEvalAmount = useMemo(() => {
        return accountHoldings.reduce((sum, holding) => sum + (holding.eval_amount || 0), 0);
    }, [accountHoldings]);

    // 사용자의 피드백을 반영하여 총자산금액을 KIS 응답(안 보일 수 있는 자산 포함)이 아닌,
    // [보유 주식/ETF 평가금액 + 예수금]으로 명확히 합산합니다.
    const totalAsset = stockEvalAmount + cashBalance;

    const totalProfitLoss = useMemo(() => {
        return accountHoldings.reduce((sum, holding) => sum + (holding.profit_loss || 0), 0);
    }, [accountHoldings]);

    const totalPurchaseAmount = stockEvalAmount - totalProfitLoss;
    const returnRate = totalPurchaseAmount > 0 ? (totalProfitLoss / totalPurchaseAmount) * 100 : 0;

    const cashWeight = totalAsset > 0 ? (cashBalance / totalAsset) * 100 : 0;
    const stockWeight = totalAsset > 0 ? (stockEvalAmount / totalAsset) * 100 : 0;

    // 사용자 맞춤 카테고리 로직 (한국, S&P500, Nasdaq, 현물, 기타)
    const categorizeItem = (name: string, code: string = "", isCash: boolean = false) => {
        if (isCash) return '현물/현금 (금, 예수금 등)';
        if (!name) return '한국';
        
        // 종목명/코드에 영문약자 형태의 미국 증시코드인 경우 (숫자 미포함)
        if (code && /^[A-Za-z]+(\.[A-Za-z]+)?$/.test(code)) {
            // 별도 조건 없으면 나스닥 혹은 S&P500 등 지수 (기본값 나스닥)
            return 'NASDAQ';
        }

        const n = name.toUpperCase();
        if (n.includes('금현물') || n.includes('국제금') || n.includes('은현물') || n.includes('금선물') || n.includes('GOLD')) return '현물/현금 (금, 예수금 등)';
        
        // 특정 키워드에 따른 나스닥/S&P 매핑
        if (n.includes('미국성장') || n.includes('미국우주항공') || n.includes('미국양자컴퓨팅') || n.includes('나스닥') || n.includes('NASDAQ')) {
            return 'NASDAQ';
        }
        if (n.includes('미국배당') || n.includes('S&P500') || n.includes('S&P 500')) {
            return 'S&P 500';
        }
        // 나머지 미국으로 시작/포함되는 것은 S&P500
        if (n.includes('미국')) {
            return 'S&P 500';
        }

        // 미국, S&P500, Nasdaq 이 없는 경우에는 모두 한국으로 매핑
        return '한국';
    };

    const aggregatedData = useMemo(() => {
        const groups: Record<string, number> = {};
        
        // 예수금 추가
        if (cashBalance > 0) {
            const cat = categorizeItem('예수금', "", true);
            groups[cat] = cashBalance;
        }

        // 주식/ETF 추가
        accountHoldings.forEach((h: any) => {
            const cat = categorizeItem(h.name, h.code);
            groups[cat] = (groups[cat] || 0) + (h.eval_amount || 0);
        });

        return Object.keys(groups).map(k => ({ name: k, value: groups[k] })).sort((a, b) => b.value - a.value);
    }, [accountHoldings, cashBalance]);

    const customColors: Record<string, string> = {
        '한국': '#3b82f6',
        'S&P 500': '#f43f5e',
        'NASDAQ': '#8b5cf6',
        '현물/현금 (금, 예수금 등)': '#eab308',
        '기타 (해외자산 등)': '#71717a'
    };

    const getCustomColor = (name: string) => customColors[name] || '#71717a';

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

                    {/* Middle Section: Categorical Allocation Chart */}
                    <div className="bg-white/[0.02] border border-white/10 rounded-xl p-5 flex flex-col pt-6">
                        <h3 className="text-lg font-semibold text-gray-200 mb-6 flex items-center gap-2">
                            <PieChartIcon className="w-5 h-5 text-fuchsia-400" />
                            계좌 포트폴리오 비중
                        </h3>

                        <div className="flex flex-col items-center w-full">
                            <div className="w-full h-[250px] relative flex justify-center items-center">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={aggregatedData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={100}
                                            paddingAngle={2}
                                            dataKey="value"
                                            stroke="none"
                                        >
                                            {aggregatedData.map((entry: any, index: number) => (
                                                <Cell key={`cell-${index}`} fill={getCustomColor(entry.name)} />
                                            ))}
                                        </Pie>
                                        <RechartsTooltip
                                            formatter={(value: any) => `${formatNumber(value as number)}원`}
                                            contentStyle={{ backgroundColor: 'rgba(9, 9, 11, 0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '12px' }}
                                            itemStyle={{ color: '#e4e4e7' }}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="flex flex-wrap justify-center gap-4 mt-6">
                                {aggregatedData.map((d: any) => (
                                    <div key={d.name} className="flex items-center gap-1.5 text-sm text-gray-400">
                                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: getCustomColor(d.name) }}></div>
                                        {d.name} <span className="text-gray-200 font-medium ml-1">{formatPercent(totalAsset > 0 ? (d.value / totalAsset) * 100 : 0)}</span>
                                    </div>
                                ))}
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
                                        <th className="py-4 px-6">코드 <span className="text-gray-500 mx-1">/</span> 종목명</th>
                                        <th className="py-4 px-4 text-center">구분</th>
                                        <th className="py-4 px-4 text-right">수량</th>
                                        <th className="py-4 px-4 text-right">매입단가 <span className="text-gray-500 mx-1">/</span> 현재가</th>
                                        <th className="py-4 px-4 text-right">매입금액 <span className="text-gray-500 mx-1">/</span> 평가금액</th>
                                        <th className="py-4 px-4 text-right text-indigo-300">비중</th>
                                        <th className="py-4 px-6 text-right">평가손익 <span className="text-gray-500 mx-1">/</span> 수익률</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5 text-sm">
                                    {/* 보유종목을 카테고리별 정렬 후 렌더링 */}
                                    {[...accountHoldings].sort((a: any, b: any) => categorizeItem(a.name, a.code).localeCompare(categorizeItem(b.name, b.code)) || b.eval_amount - a.eval_amount).map((h: any, idx: number) => {
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
                                                {/* Category */}
                                                <td className="py-3 px-4 text-center">
                                                    <span className="px-2 py-1 text-[10px] rounded-full" style={{ backgroundColor: `${getCustomColor(categorizeItem(h.name, h.code))}20`, color: getCustomColor(categorizeItem(h.name, h.code)) }}>
                                                        {categorizeItem(h.name, h.code)}
                                                    </span>
                                                </td>
                                                {/* Qty */}
                                                <td className="py-3 px-4 text-right">
                                                    <span className="text-gray-300 font-medium">{formatNumber(h.qty)} <span className="text-xs text-gray-500 font-normal">좌</span></span>
                                                </td>
                                                {/* Avg Price & Current Price */}
                                                <td className="py-3 px-4 text-right">
                                                    <div className="flex flex-col gap-1 items-end">
                                                        <span className="text-gray-400">{formatNumber(h.avg_price)}</span>
                                                        <span className="text-gray-200">{formatNumber(h.current_price)}</span>
                                                    </div>
                                                </td>
                                                {/* Purchase Amount & Eval Amount */}
                                                <td className="py-3 px-4 text-right">
                                                    <div className="flex flex-col gap-1 items-end">
                                                        <span className="text-gray-400">{formatNumber(hPurchase)}</span>
                                                        <span className="text-white font-medium">{formatNumber(h.eval_amount)}</span>
                                                    </div>
                                                </td>
                                                {/* Weight (비중) */}
                                                <td className="py-3 px-4 text-right">
                                                    <span className="text-xs px-2 py-1 rounded-md bg-indigo-500/10 text-indigo-300 font-medium border border-indigo-500/20">{formatPercent(hWeight)}</span>
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
