import React, { useState } from 'react';
import AccountDetailModal from './AccountDetailModal';
import HoldingsSignals from './HoldingsSignals';
import RecentTrades from './RecentTrades';
import PortfolioBacktester from './PortfolioBacktester';
import AIRebalanceSimulator from './AIRebalanceSimulator';
import RiskAlertBanner from './RiskAlertBanner';
import { Sparkles } from 'lucide-react';
import PortfolioTreemap from './PortfolioTreemap';
import RebalanceProposal from './RebalanceProposal';
import DbSyncControl from './DbSyncControl';
import NotificationSettings from './NotificationSettings';

/* eslint-disable @typescript-eslint/no-explicit-any */
type MyDashboardProps = {
    data: any;
    tradesData?: any;    // 당일 체결내역 (optional)
    isRefreshing?: boolean;
    onOpenDetail?: (code: string) => void;
    onAnalyzePeers?: (items: any[]) => void;
};

export default function MyDashboard({ data, tradesData, isRefreshing = false, onOpenDetail, onAnalyzePeers }: MyDashboardProps) {
    const [selectedAccount, setSelectedAccount] = useState<any>(null);
    const [backtestTab, setBacktestTab] = useState<'static' | 'dynamic'>('dynamic');

    if (!data || !data.kis_raw) return null;

    const { kis_raw } = data;
    const { summary, holdings, accounts = [] } = kis_raw;

    // Formatting Helpers
    const formatNumber = (val: number) => new Intl.NumberFormat('ko-KR').format(Math.floor(val));

    // Derived Metrics
    const cashBalance = summary.cash_balance || 0;
    const stockEvalAmount = summary.total_eval_amount || 0;
    const totalAsset = stockEvalAmount + cashBalance;
    const totalProfitLoss = summary.total_profit_loss || 0;

    // Calculate total invest principal (매수금액)
    const stockPrincipal = stockEvalAmount - totalProfitLoss;
    const totalReturnRate = stockPrincipal > 0 ? (totalProfitLoss / stockPrincipal) * 100 : 0;

    return (
        <div className="w-full flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-5 duration-700 font-sans pb-10">

            <RiskAlertBanner />

            {/* Section 2: 포트폴리오 현황 트리맵 */}
            <section className="flex flex-col gap-4">
                <div className="flex items-baseline gap-4 justify-between flex-wrap">
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                        <span className="w-1.5 h-6 bg-rose-500 rounded-full"></span>
                        포트폴리오 현황
                    </h2>
                    <div className="flex items-baseline gap-6">
                        <div className="flex items-baseline gap-2">
                            <span className="text-sm text-gray-400">최종 매매기준 수익</span>
                            <span className={`text-2xl font-bold ${totalProfitLoss > 0 ? 'text-rose-400' : totalProfitLoss < 0 ? 'text-blue-400' : 'text-gray-200'}`}>
                                {totalProfitLoss > 0 ? '+' : ''}{formatNumber(totalProfitLoss)}원
                            </span>
                            <span className={`text-sm font-semibold ${totalProfitLoss > 0 ? 'text-rose-400' : totalProfitLoss < 0 ? 'text-blue-400' : 'text-gray-400'}`}>
                                ({totalReturnRate.toFixed(2)}%)
                            </span>
                        </div>
                        <div className="text-sm text-gray-500">
                            전체 자산 <span className="text-gray-200 font-bold">{formatNumber(totalAsset)}원</span>
                        </div>
                    </div>
                </div>

                <PortfolioTreemap
                    holdings={holdings}
                    cashBalance={cashBalance}
                    totalAsset={totalAsset}
                />
            </section>

            {/* Section 3: 계좌내역 (Account Status) */}
            <section className="flex flex-col gap-4">
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

            {/* 포트폴리오 백테스터 & AI 리밸런싱 시뮬레이터 통합 탭 */}
            <div className="flex flex-col gap-4 mt-2">
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <span className="w-1.5 h-6 bg-indigo-500 rounded-full"></span>
                        포트폴리오 시뮬레이션
                    </h2>
                    <div className="flex gap-1 bg-black/40 p-1 rounded-xl border border-white/5">
                        <button
                            onClick={() => setBacktestTab('dynamic')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-300 flex items-center gap-1 ${
                                backtestTab === 'dynamic'
                                ? 'bg-emerald-500 text-black shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                                : 'text-gray-400 hover:text-white'
                            }`}
                        >
                            <Sparkles className="w-3.5 h-3.5" /> AI 동적 리밸런싱
                        </button>
                        <button
                            onClick={() => setBacktestTab('static')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-300 ${
                                backtestTab === 'static'
                                ? 'bg-purple-500 text-white shadow-[0_0_10px_rgba(168,85,247,0.3)]'
                                : 'text-gray-400 hover:text-white'
                            }`}
                        >
                            일반 백테스터
                        </button>
                    </div>
                </div>

                {backtestTab === 'dynamic' ? (
                    <AIRebalanceSimulator holdings={holdings} />
                ) : (
                    <PortfolioBacktester holdings={holdings} />
                )}
            </div>

            {/* Section 5: 당일 체결내역 */}
            <section className="flex flex-col gap-4">
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
            <HoldingsSignals isAuthorized={true} onOpenDetail={onOpenDetail} onAnalyzePeers={onAnalyzePeers} />

            {/* AI 리밸런싱 제안 */}
            <RebalanceProposal />

            {/* 무중단 DB 동기화 및 백업 제어 */}
            <DbSyncControl />

            {/* 실시간 AI 전략 알림 설정 */}
            <NotificationSettings />

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
