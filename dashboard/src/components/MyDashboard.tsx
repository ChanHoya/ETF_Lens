import React, { useState, useMemo } from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip as RechartsTooltip, Legend, LineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts";
import AccountDetailModal from './AccountDetailModal';
import HoldingsSignals from './HoldingsSignals';
import RecentTrades from './RecentTrades';
import PortfolioBacktester from './PortfolioBacktester';
import RiskAlertBanner from './RiskAlertBanner';

/* eslint-disable @typescript-eslint/no-explicit-any */
type MyDashboardProps = {
    data: any;
    tradesData?: any;    // 당일 체결내역 (optional)
    isRefreshing?: boolean;
};

export default function MyDashboard({ data, tradesData, isRefreshing = false }: MyDashboardProps) {
    const [selectedAccount, setSelectedAccount] = useState<any>(null);
    if (!data || !data.kis_raw) return null;

    const { kis_raw } = data;
    const { summary, holdings, accounts = [] } = kis_raw;

    // Formatting Helpers
    const formatNumber = (val: number) => new Intl.NumberFormat('ko-KR').format(Math.floor(val));
    const formatPercent = (val: number) => `${(val * 100).toFixed(2)}%`;

    // Derived Metrics
    const cashBalance = summary.cash_balance || 0;
    
    // 사용자의 피드백을 반영하여 총자산금액을 KIS 응답(안 보일 수 있는 자산 포함)이 아닌,
    // [보유 주식/ETF 평가금액 + 예수금]으로 명확히 합산합니다.
    const stockEvalAmount = summary.total_eval_amount || 0;
    const totalAsset = stockEvalAmount + cashBalance;
    const totalProfitLoss = summary.total_profit_loss || 0;

    // Calculate total invest principal (매수금액)
    const stockPrincipal = stockEvalAmount - totalProfitLoss;
    const totalReturnRate = stockPrincipal > 0 ? (totalProfitLoss / stockPrincipal) * 100 : 0;

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
        
        if (cashBalance > 0) {
            const cat = categorizeItem('예수금', "", true);
            groups[cat] = cashBalance;
        }

        holdings.forEach((h: any) => {
            const cat = categorizeItem(h.name, h.code);
            groups[cat] = (groups[cat] || 0) + (h.eval_amount || 0);
        });

        return Object.keys(groups).map(k => ({ name: k, value: groups[k] })).sort((a, b) => b.value - a.value);
    }, [holdings, cashBalance]);

    const customColors: Record<string, string> = {
        '한국': '#3b82f6',
        'S&P 500': '#f43f5e',
        'NASDAQ': '#8b5cf6',
        '현물/현금 (금, 예수금 등)': '#eab308',
        '기타 (해외자산 등)': '#71717a'
    };

    const getCustomColor = (name: string) => customColors[name] || '#71717a';

    // Section 2 Dummy Chart Data (Since KIS TTTC8434R only gives current snapshot)
    const dummyChartData = [
        { name: '현재', returnRate: totalReturnRate }
    ];

    return (
        <div className="w-full flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-5 duration-700 font-sans pb-10">

            <RiskAlertBanner />

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
                    포트폴리오 수익률 및 비중
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
                                {totalProfitLoss !== 0 ? (
                                    <>
                                        <span className={`text-3xl font-bold ${
                                            totalProfitLoss > 0 ? 'text-rose-400' : 'text-blue-400'
                                        }`}>
                                            {totalProfitLoss > 0 ? '+' : ''}{formatNumber(totalProfitLoss)}원
                                        </span>
                                        <span className={`font-semibold text-sm ${
                                            totalProfitLoss > 0 ? 'text-rose-400' : 'text-blue-400'
                                        }`}>
                                            {totalReturnRate > 0 ? '+' : ''}{totalReturnRate.toFixed(2)}%
                                        </span>
                                    </>
                                ) : (
                                    <span className="text-3xl font-bold text-gray-600">-</span>
                                )}
                            </div>
                        </div>
                    </div>
                    {/* Chart area */}
                    <div className="p-6 h-[250px] w-full flex flex-col items-center justify-center">
                        <div className="w-full max-w-2xl h-full flex items-center justify-center text-gray-500 bg-transparent rounded-xl relative">
                            {(() => {
                                const items = holdings
                                    .filter((h: any) => (h.eval_amount || 0) > 0)
                                    .map((h: any) => ({ name: h.name, value: h.eval_amount }));
                                if (cashBalance > 0) {
                                    items.push({ name: '예수금(현금)', value: cashBalance });
                                }
                                items.sort((a: any, b: any) => b.value - a.value);
                                
                                let finalPieData = items;
                                if (items.length > 16) {
                                    const top = items.slice(0, 15);
                                    const others = items.slice(15).reduce((acc: number, curr: any) => acc + curr.value, 0);
                                    finalPieData = [...top, { name: '기타 종목 합계', value: others }];
                                }

                                const PIE_COLORS = ['#F43F5E', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#14B8A6', '#64748B', '#a1a1aa'];

                                return (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={finalPieData}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={60}
                                                outerRadius={100}
                                                paddingAngle={2}
                                                dataKey="value"
                                                stroke="none"
                                            >
                                                {finalPieData.map((entry: any, index: number) => (
                                                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <RechartsTooltip 
                                                formatter={(val: number) => `${formatNumber(val)}원`}
                                                contentStyle={{ backgroundColor: 'rgba(9, 9, 11, 0.9)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '8px' }}
                                                itemStyle={{ color: '#e4e4e7' }}
                                            />
                                            <Legend verticalAlign="middle" align="right" layout="vertical" wrapperStyle={{ fontSize: '12px' }} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                );
                            })()}
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
                        <span className="text-sm font-normal text-gray-400">(유잔고 {accounts.length}개)</span>
                    </h2>
                </div>

                <div className="bg-white/[0.02] border border-white/10 rounded-2xl backdrop-blur-md overflow-x-auto">
                    <table className="w-full text-left border-collapse whitespace-nowrap">
                        <thead>
                            <tr className="bg-black/20 text-sm font-medium text-gray-400 border-b border-white/10">
                                <th className="p-4 text-center">계좌번호</th>
                                <th className="p-4 text-center">계좌유형</th>
                                <th className="p-4 text-center">계좌별명</th>
                                <th className="p-4 text-right">계좌자산</th>
                                <th className="p-4 text-right pr-6 min-w-[200px]">출금가능 금액</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {accounts.map((acc: any, idx: number) => (
                                <tr key={idx} className="hover:bg-white/[0.02] transition-colors">
                                    <td className="p-4 text-center font-mono text-gray-200">{acc.account_no}</td>
                                    <td className="p-4 text-center text-gray-300">위탁계좌</td>
                                    <td className="p-4 text-center text-gray-300">{acc.account_name}</td>
                                    <td className="p-4 text-right font-bold text-gray-200">{formatNumber(acc.total_asset)}</td>
                                    <td className="p-4 text-right pr-6 text-gray-400">
                                        <div className="flex justify-end items-center gap-6 w-full">
                                            <span>{formatNumber(acc.cash_balance)}</span>
                                            <button
                                                onClick={() => setSelectedAccount(acc)}
                                                className="px-3 py-1.5 border border-white/10 rounded text-xs hover:bg-white/10 transition-colors text-indigo-300 border-indigo-500/30 hover:bg-indigo-500/10">
                                                상세보기
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            {/* 당일 체결 내역 */}
            <RecentTrades tradesData={tradesData} />

            {/* Section 4: 상품 유형별 현황 (Assets by Product Type) */}
            <section className="flex flex-col gap-4 mt-4">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                    <span className="w-1.5 h-6 bg-cyan-500 rounded-full"></span>
                    상품 유형별 현황
                </h2>

                <div className="bg-white/[0.02] border border-white/10 rounded-2xl backdrop-blur-md p-6 flex flex-col items-center">

                    {/* Unified Custom Pie Chart */}
                    <div className="w-full max-w-2xl h-[300px] relative flex justify-center items-center">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={aggregatedData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={70}
                                    outerRadius={110}
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
                                    contentStyle={{ backgroundColor: 'rgba(9, 9, 11, 0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                                    itemStyle={{ color: '#e4e4e7' }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            <span className="text-sm text-gray-400">총 자산</span>
                            <span className="font-bold text-lg">{formatNumber(totalAsset)}</span>
                        </div>
                    </div>
                    <div className="flex flex-wrap justify-center gap-6 mt-4">
                        {aggregatedData.map((d: any) => (
                            <div key={d.name} className="flex items-center gap-2 text-sm text-gray-400">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: getCustomColor(d.name) }}></div>
                                {d.name} <span className="text-gray-200 font-medium ml-1">{formatPercent(totalAsset > 0 ? d.value / totalAsset : 0)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* 포트폴리오 백테스터 */}
            <PortfolioBacktester holdings={holdings} />

            {/* Section 5: 당일 체결내역 */}
            <section className="flex flex-col gap-4 mt-4">
                <div className="flex justify-between items-center">
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                        <span className="w-1.5 h-6 bg-amber-500 rounded-full"></span>
                        당일 체결내역
                        {tradesData?.count > 0 && (
                            <span className="text-sm font-normal text-amber-400 ml-1">({tradesData.count}건)</span>
                        )}
                    </h2>
                    {isRefreshing && (
                        <span className="text-xs text-indigo-400 animate-pulse">조회중...</span>
                    )}
                </div>

                <div className="bg-white/[0.02] border border-white/10 rounded-2xl backdrop-blur-md overflow-hidden">
                    {!tradesData || tradesData.count === 0 ? (
                        <div className="p-10 flex flex-col items-center justify-center gap-2 text-gray-500">
                            <span className="text-2xl">📋</span>
                            <p className="text-sm">오늘 체결된 주문이 없습니다.</p>
                            <p className="text-xs text-gray-600">장 중에 주문이 체결되면 여기에 표시됩니다.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse whitespace-nowrap text-sm">
                                <thead>
                                    <tr className="bg-black/20 text-xs font-medium text-gray-400 border-b border-white/10">
                                        <th className="p-3 text-center">시각</th>
                                        <th className="p-3 text-center">구분</th>
                                        <th className="p-3 text-left">종목</th>
                                        <th className="p-3 text-right">수량</th>
                                        <th className="p-3 text-right">체결단가</th>
                                        <th className="p-3 text-right">체결금액</th>
                                        <th className="p-3 text-center">계좌</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {tradesData.trades.map((t: any, i: number) => {
                                        const isBuy = t.side_code === "02";
                                        return (
                                            <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                                                <td className="p-3 text-center text-gray-400 font-mono text-xs">{t.time}</td>
                                                <td className="p-3 text-center">
                                                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                                                        isBuy
                                                            ? "bg-rose-500/20 text-rose-400"
                                                            : "bg-blue-500/20 text-blue-400"
                                                    }`}>
                                                        {t.side}
                                                    </span>
                                                </td>
                                                <td className="p-3 text-white font-medium">
                                                    {t.name}
                                                    <span className="text-gray-500 text-xs ml-1.5">{t.code}</span>
                                                </td>
                                                <td className="p-3 text-right text-gray-200">{formatNumber(t.qty)}주</td>
                                                <td className="p-3 text-right text-gray-200">{formatNumber(t.price)}원</td>
                                                <td className="p-3 text-right font-bold text-gray-100">
                                                    {formatNumber(t.amount)}원
                                                </td>
                                                <td className="p-3 text-center text-gray-500 font-mono text-xs">{t.account_no}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </section>

            {/* Section 6: 보유 ETF 전략 시그널 */}
            <HoldingsSignals isAuthorized={true} />

            {/* Modals */}
            <AccountDetailModal
                isOpen={!!selectedAccount}
                onClose={() => setSelectedAccount(null)}
                account={selectedAccount}
                accountHoldings={holdings.filter((h: any) => h.account_no === selectedAccount?.account_no)}
            />

        </div>
    );
}
