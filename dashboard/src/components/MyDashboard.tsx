import React, { useState } from 'react';
import AccountDetailModal from './AccountDetailModal';
import HoldingsSignals from './HoldingsSignals';
import PortfolioBacktester from './PortfolioBacktester';
import AIRebalanceSimulator from './AIRebalanceSimulator';
import RiskAlertBanner from './RiskAlertBanner';
import { Sparkles, TrendingUp } from 'lucide-react';
import PortfolioTreemap from './PortfolioTreemap';
import RebalanceProposal from './RebalanceProposal';
import DbSyncControl from './DbSyncControl';
import NotificationSettings from './NotificationSettings';
import EfficientFrontierPanel from './EfficientFrontierPanel';

/* eslint-disable @typescript-eslint/no-explicit-any */
type MyDashboardProps = {
    data: any;
    tradesData?: any;    // 당일 체결내역 (optional)
    isRefreshing?: boolean;
    onOpenDetail?: (code: string) => void;
    onAnalyzePeers?: (items: any[]) => void;
};

const isOverseasEtf = (name: string): boolean => {
    const nameL = name.toLowerCase().replace(/\s+/g, '');
    const overseasKeywords = [
        "미국", "글로벌", "해외", "차이나", "일본", "나스닥", "nasdaq", "s&p", "soxx", "필라델피아", 
        "인도", "유로", "베트남", "골드", "금현물", "world", "china", "japan", "india", "euro", 
        "vietnam", "taiwan", "대만", "유럽", "남미", "아시아", "국제", "독일", "심천", "상해", "홍콩"
    ];
    return overseasKeywords.some(keyword => nameL.includes(keyword));
};

const getDisparityStatus = (name: string, rate: number): 'normal' | 'warning' | 'risk' => {
    const isOverseas = isOverseasEtf(name);
    const absRate = Math.abs(rate);
    if (isOverseas) {
        if (absRate < 2.0) return 'normal';
        if (absRate <= 6.0) return 'warning';
        return 'risk';
    } else {
        if (absRate < 1.0) return 'normal';
        if (absRate <= 3.0) return 'warning';
        return 'risk';
    }
};

interface DisparityLevelInfo {
    label: string;
    classes: string;
    borderClass: string;
    msg: string;
}

const getDisparityLevelInfo = (name: string, rate: number): DisparityLevelInfo => {
    const status = getDisparityStatus(name, rate);
    const absRate = Math.abs(rate);

    if (status === 'normal') {
        return {
            label: `안정 (Safe Zone) ${rate > 0 ? '+' : ''}${rate.toFixed(3)}%`,
            classes: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
            borderClass: 'border-white/10 hover:border-emerald-500/20',
            msg: '괴리율이 정상 범위 내에서 안정적으로 거래되고 있어 가격 신뢰도가 높습니다.'
        };
    }

    if (rate < 0) {
        if (status === 'risk') {
            return {
                label: `매수 검토 (Discount) ${rate.toFixed(3)}%`,
                classes: 'bg-cyan-500/20 text-[#22d3ee] border border-cyan-500/30',
                borderClass: 'border-cyan-500/40 shadow-cyan-950/20',
                msg: 'NAV 대비 현저히 저렴하게 구매할 수 있는 유리한 매수 진입 구간입니다 (지정가 분할 매수 적극 검토).'
            };
        } else { // warning
            return {
                label: `매수 관망 (Mild Discount) ${rate.toFixed(3)}%`,
                classes: 'bg-sky-500/10 text-sky-400 border border-sky-500/20',
                borderClass: 'border-sky-500/20 shadow-sky-950/10',
                msg: 'NAV 대비 소폭 할인 거래 중인 구간입니다 (매매 동향 관망하며 지정가 분할 매수 고려).'
            };
        }
    } else {
        if (status === 'risk') {
            return {
                label: `매도 검토 (Premium) +${rate.toFixed(3)}%`,
                classes: 'bg-rose-500/20 text-[#f43f5e] border border-rose-500/30',
                borderClass: 'border-rose-500/40 shadow-rose-950/20',
                msg: 'NAV 대비 매우 비싸게 거래되는 위험 구간이므로 신규 매수를 금지하고 보유 물량 매도를 신중히 검토하세요.'
            };
        } else { // warning
            return {
                label: `매도 관망 (Mild Premium) +${rate.toFixed(3)}%`,
                classes: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
                borderClass: 'border-amber-500/20 shadow-amber-950/10',
                msg: 'NAV 대비 소폭 할증 거래 중입니다. 매수는 일시적으로 보류하며 관망을 유지하세요.'
            };
        }
    }
};

export default function MyDashboard({ data, tradesData, isRefreshing = false, onOpenDetail, onAnalyzePeers }: MyDashboardProps) {
    const [selectedAccount, setSelectedAccount] = useState<any>(null);
    const [backtestTab, setBacktestTab] = useState<'static' | 'dynamic' | 'efficient'>('dynamic');
    const [showAllDisparity, setShowAllDisparity] = useState(false);
    const [disparityTab, setDisparityTab] = useState<'warn_risk' | 'risk' | 'warning' | 'normal' | 'all'>('warn_risk');

    const askAi = (question: string) => {
        if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent('open-ai-chat', { detail: { message: question } }));
        }
    };

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

            {/* 실시간 괴리율 경보 Bento Card */}
            {(() => {
                const allDisparityHoldings = holdings.filter((h: any) => h.disparity_rate !== undefined && h.disparity_rate !== null);
                if (allDisparityHoldings.length === 0) return null;
                
                // Group and deduplicate holdings for disparity calculation/display
                const mergedHoldingsMap: { [code: string]: any } = {};
                allDisparityHoldings.forEach((h: any) => {
                    const code = h.code;
                    if (!mergedHoldingsMap[code]) {
                        mergedHoldingsMap[code] = {
                            ...h,
                            qty: Number(h.qty),
                            eval_amount: Number(h.eval_amount),
                            accounts: [h.account_no]
                        };
                    } else {
                        mergedHoldingsMap[code].qty += Number(h.qty);
                        mergedHoldingsMap[code].eval_amount += Number(h.eval_amount);
                        if (!mergedHoldingsMap[code].accounts.includes(h.account_no)) {
                            mergedHoldingsMap[code].accounts.push(h.account_no);
                        }
                    }
                });

                const mergedDisparityList = Object.values(mergedHoldingsMap).map((item: any) => {
                    const status = getDisparityStatus(item.name, item.disparity_rate);
                    return {
                        ...item,
                        status
                    };
                });

                const countWarnRisk = mergedDisparityList.filter(h => h.status === 'warning' || h.status === 'risk').length;
                const countRisk = mergedDisparityList.filter(h => h.status === 'risk').length;
                const countWarning = mergedDisparityList.filter(h => h.status === 'warning').length;
                const countNormal = mergedDisparityList.filter(h => h.status === 'normal').length;
                const countAll = mergedDisparityList.length;

                const displayDisparityHoldings = mergedDisparityList.filter((h) => {
                    if (disparityTab === 'warn_risk') return h.status === 'warning' || h.status === 'risk';
                    if (disparityTab === 'risk') return h.status === 'risk';
                    if (disparityTab === 'warning') return h.status === 'warning';
                    if (disparityTab === 'normal') return h.status === 'normal';
                    return true; // 'all'
                });

                const cardBorderClass = (name: string, rate: number) => {
                    return getDisparityLevelInfo(name, rate).borderClass;
                };

                const badgeStyle = (name: string, rate: number) => {
                    const info = getDisparityLevelInfo(name, rate);
                    return {
                        classes: info.classes,
                        label: info.label
                    };
                };

                const warningMsg = (name: string, rate: number) => {
                    return getDisparityLevelInfo(name, rate).msg;
                };

                return (
                    <section className="flex flex-col gap-4">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 flex-wrap">
                            <h2 className="text-xl font-bold flex items-center gap-2 text-rose-400">
                                <span className={`w-1.5 h-6 bg-rose-500 rounded-full ${countWarnRisk > 0 ? 'animate-pulse' : ''}`}></span>
                                실시간 괴리율 경보 (Disparity Alert)
                            </h2>
                            <div className="flex bg-black/40 rounded-xl p-1 border border-white/5 shadow-inner self-start gap-1 flex-wrap">
                                <button
                                    onClick={() => setDisparityTab('warn_risk')}
                                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                                        disparityTab === 'warn_risk'
                                            ? 'bg-rose-600 text-white shadow-md'
                                            : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
                                    }`}
                                >
                                    주의/위험 ({countWarnRisk})
                                </button>
                                <button
                                    onClick={() => setDisparityTab('risk')}
                                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                                        disparityTab === 'risk'
                                            ? 'bg-red-600/30 border border-red-500/30 text-red-400 font-semibold'
                                            : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
                                    }`}
                                >
                                    위험 ({countRisk})
                                </button>
                                <button
                                    onClick={() => setDisparityTab('warning')}
                                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                                        disparityTab === 'warning'
                                            ? 'bg-amber-600/30 border border-amber-500/30 text-amber-300 font-semibold'
                                            : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
                                    }`}
                                >
                                    주의 ({countWarning})
                                </button>
                                <button
                                    onClick={() => setDisparityTab('normal')}
                                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                                        disparityTab === 'normal'
                                            ? 'bg-emerald-600/20 border border-emerald-500/20 text-emerald-400'
                                            : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
                                    }`}
                                >
                                    정상 ({countNormal})
                                </button>
                                <button
                                    onClick={() => setDisparityTab('all')}
                                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                                        disparityTab === 'all'
                                            ? 'bg-white/10 text-white shadow-sm'
                                            : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
                                    }`}
                                >
                                    전체 ({countAll})
                                </button>
                            </div>
                        </div>
                        
                        {displayDisparityHoldings.length === 0 ? (
                            <div className="bg-[#12121A]/60 border border-white/10 rounded-2xl p-6 text-center text-xs text-gray-400">
                                🔒 선택하신 필터 영역({disparityTab === 'warn_risk' ? '주의/위험' : disparityTab === 'risk' ? '위험' : disparityTab === 'warning' ? '주의' : disparityTab === 'normal' ? '정상' : '전체'})에 해당하는 종목이 없습니다.
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {displayDisparityHoldings.map((h: any, idx: number) => {
                                    const badge = badgeStyle(h.name, h.disparity_rate);
                                    const isOverseas = isOverseasEtf(h.name);
                                    
                                    return (
                                        <div 
                                            key={idx} 
                                            className={`bg-[#12121A]/80 border rounded-2xl p-5 backdrop-blur-md flex flex-col gap-3 shadow-lg transition-all duration-300 ${cardBorderClass(h.name, h.disparity_rate)}`}
                                        >
                                            <div className="flex justify-between items-start flex-wrap gap-2">
                                                <div>
                                                    <h3 className="font-extrabold text-white text-lg flex items-center gap-2">
                                                        {h.name}
                                                        <span className="text-sm text-gray-400 font-mono">{h.code}</span>
                                                    </h3>
                                                    <div className="flex gap-2 items-center mt-1.5">
                                                        <span className="text-[13px] text-gray-300 bg-white/5 px-2 py-0.5 rounded border border-white/5 font-semibold">
                                                            {isOverseas ? '해외 자산' : '국내 자산'}
                                                        </span>
                                                        <span className="text-[13px] text-gray-300 font-medium">
                                                            계좌: {h.accounts.join(' / ')}
                                                        </span>
                                                    </div>
                                                </div>
                                                <span className={`px-3 py-1 rounded-full text-xs font-black ${badge.classes}`}>
                                                    {badge.label}
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-4 gap-1 bg-black/30 rounded-xl p-3 text-center text-sm">
                                                <div>
                                                    <p className="text-gray-400 text-[11px] mb-0.5">현재가</p>
                                                    <p className="font-bold text-gray-100">{formatNumber(h.current_price)}원</p>
                                                </div>
                                                <div>
                                                    <p className="text-gray-400 text-[11px] mb-0.5">NAV</p>
                                                    <p className="font-bold text-gray-100">{h.nav ? `${formatNumber(h.nav)}원` : '-'}</p>
                                                </div>
                                                <div>
                                                    <p className="text-gray-400 text-[11px] mb-0.5">총 보유수량</p>
                                                    <p className="font-bold text-gray-100">{h.qty}주</p>
                                                </div>
                                                <div>
                                                    <p className="text-gray-400 text-[11px] mb-0.5">평가금액</p>
                                                    <p className="font-bold text-gray-100">{formatNumber(h.eval_amount)}원</p>
                                                </div>
                                            </div>
                                            <p className="text-[14px] text-gray-300 leading-relaxed">
                                                {warningMsg(h.name, h.disparity_rate)}
                                            </p>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </section>
                );
            })()}

            {/* Section 2: 포트폴리오 현황 트리맵 */}
            <section className="flex flex-col gap-4">
                <div className="flex items-baseline gap-4 justify-between flex-wrap">
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                        <span className="w-1.5 h-6 bg-rose-500 rounded-full"></span>
                        포트폴리오 현황
                    </h2>
                    <div className="flex items-baseline gap-6 flex-wrap md:flex-nowrap">
                        <div className="flex items-baseline gap-2">
                            <span className="text-sm text-gray-400">최종 매매기준 수익</span>
                            <span className={`text-2xl font-bold ${totalProfitLoss > 0 ? 'text-rose-400' : totalProfitLoss < 0 ? 'text-blue-400' : 'text-gray-200'}`}>
                                {totalProfitLoss > 0 ? '+' : ''}{formatNumber(totalProfitLoss)}원
                            </span>
                            <span className={`text-sm font-semibold ${totalProfitLoss > 0 ? 'text-rose-400' : totalProfitLoss < 0 ? 'text-blue-400' : 'text-gray-400'}`}>
                                ({totalReturnRate.toFixed(2)}%)
                            </span>
                        </div>
                        <div className="text-sm text-gray-500 flex items-center gap-3.5 flex-wrap">
                            <span>
                                매수금액 <span className="text-gray-300 font-semibold">{formatNumber(totalAsset - totalProfitLoss)}원</span>
                            </span>
                            <span className="text-white/20">|</span>
                            <span>
                                평가금액(전체자산) <span className="text-gray-200 font-bold">{formatNumber(totalAsset)}원</span>
                            </span>
                        </div>
                    </div>
                </div>

                <PortfolioTreemap
                    holdings={holdings}
                    cashBalance={cashBalance}
                    totalAsset={totalAsset}
                />
            </section>

            {/* AI Portfolio Assistant Section */}
            <section className="flex flex-col gap-4">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                    <span className="w-1.5 h-6 bg-indigo-500 rounded-full"></span>
                    AI Portfolio Assistant
                </h2>
                <div className="w-full bg-[#12121A]/60 border border-white/10 rounded-3xl p-5 backdrop-blur-md shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-5">
                    <div className="flex flex-col gap-1.5 text-left max-w-xl">
                        <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">Gemini AI</span>
                            <h3 className="text-base font-bold text-white">내 포트폴리오 맞춤형 AI 비서</h3>
                        </div>
                        <p className="text-xs text-gray-400 leading-relaxed">
                            연동된 KIS 계좌 자산 및 실시간 보유 종목 정보를 바탕으로 질문에 정확하게 답변해 드립니다. 아래의 퀵 질문을 클릭하거나 우측 상단 AI Assistant 버튼을 눌러 자유롭게 대화해 보세요.
                        </p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto flex-wrap">
                        <button
                            onClick={() => askAi("내 포트폴리오 중에서 우주섹터 관련 종목 전체 현재 평가금액 알려줘")}
                            className="px-3.5 py-2.5 bg-white/[0.03] hover:bg-indigo-500/10 border border-white/10 hover:border-indigo-500/30 rounded-xl text-xs font-semibold text-gray-300 hover:text-indigo-300 transition-all text-left flex items-center gap-1.5 shadow-inner"
                        >
                            🚀 우주섹터 평가금액은?
                        </button>
                        <button
                            onClick={() => askAi("내 포트폴리오 중에서 바이오섹터 관련 종목의 평가금액과 총 비중은 어떻게 돼?")}
                            className="px-3.5 py-2.5 bg-white/[0.03] hover:bg-emerald-500/10 border border-white/10 hover:border-emerald-500/30 rounded-xl text-xs font-semibold text-gray-300 hover:text-emerald-300 transition-all text-left flex items-center gap-1.5 shadow-inner"
                        >
                            🧬 바이오섹터 평가금액/비중은?
                        </button>
                        <button
                            onClick={() => askAi("내 KIS 포트폴리오 자산 배분을 분석하고 리밸런싱 개선 방향을 조언해줘")}
                            className="px-3.5 py-2.5 bg-white/[0.03] hover:bg-purple-500/10 border border-white/10 hover:border-purple-500/30 rounded-xl text-xs font-semibold text-gray-300 hover:text-purple-300 transition-all text-left flex items-center gap-1.5 shadow-inner"
                        >
                            📊 리밸런싱 조언 필요해
                        </button>
                    </div>
                </div>
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

            {/* 포트폴리오 백테스터 & AI 리밸런싱 시뮬레이터 통합 탭 */}
            <div className="flex flex-col gap-4 mt-2">
                <div className="flex items-center justify-between border-b border-white/10 pb-2 flex-wrap gap-3">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <span className="w-1.5 h-6 bg-indigo-500 rounded-full"></span>
                        포트폴리오 시뮬레이션
                    </h2>
                    <div className="flex gap-1 bg-black/40 p-1 rounded-xl border border-white/5 flex-wrap">
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
                        <button
                            onClick={() => setBacktestTab('efficient')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-300 flex items-center gap-1 ${
                                backtestTab === 'efficient'
                                ? 'bg-sky-600 text-white shadow-[0_0_10px_rgba(14,165,233,0.35)]'
                                : 'text-gray-400 hover:text-white'
                            }`}
                        >
                            <TrendingUp className="w-3.5 h-3.5" /> 포트폴리오 최적화
                        </button>
                    </div>
                </div>

                {backtestTab === 'dynamic' && (
                    <AIRebalanceSimulator holdings={holdings} />
                )}
                {backtestTab === 'static' && (
                    <PortfolioBacktester holdings={holdings} />
                )}
                {backtestTab === 'efficient' && (
                    <EfficientFrontierPanel holdings={holdings} />
                )}
            </div>

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
