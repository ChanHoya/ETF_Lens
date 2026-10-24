'use client';
// TFF 펀드 월간 운용 결산 팩트시트 리포트 및 출력/복사 모달 컴포넌트

import React, { useState, useEffect } from 'react';
import { TffFundData, TffHoldingsRow } from '../../../lib/tff/types';
import { X, Printer, Copy, Check, Sparkles, TrendingUp, Users, Wallet, PieChart, ShieldCheck, FileText, Calendar } from 'lucide-react';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    data: TffFundData | null;
}

export default function TffMonthlyFactsheetModal({ isOpen, onClose, data }: Props) {
    const [copied, setCopied] = useState(false);
    const [managerNote, setManagerNote] = useState('');
    const latestMonth = data?.latestMonth || 'N/A';

    // Local storage key for manager notes per month
    const NOTE_STORAGE_KEY = `tff_factsheet_note_${latestMonth}`;

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const savedNote = localStorage.getItem(NOTE_STORAGE_KEY);
            if (savedNote) {
                setManagerNote(savedNote);
            } else {
                setManagerNote(
                    `[${latestMonth} 운용 총평]\n` +
                    `• 10인 멤버의 정기 적립금(월 100만 원)과 배당금 전액 재투자가 원활히 집행되었습니다.\n` +
                    `• 거시경제 변동성 속에서도 글로벌 우량 ETF 중심의 분산투자로 안정적인 성과를 유지하고 있습니다.`
                );
            }
        }
    }, [latestMonth, isOpen]);

    const handleNoteChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const val = e.target.value;
        setManagerNote(val);
        try {
            localStorage.setItem(NOTE_STORAGE_KEY, val);
        } catch (_) {}
    };

    if (!isOpen) return null;

    const formatMoney = (val: number) => new Intl.NumberFormat('ko-KR').format(Math.round(val));

    // Calculate Core Metrics (with fallback if data not yet uploaded)
    const totalData = data?.cumulative?.totalData;
    const latestMonthInfo = data ? (data.monthlyMap[data.latestMonth] || data.ytm) : null;
    const totalNAV = latestMonthInfo?.summary?.totalEndValue || totalData?.endValue || 34800000;
    const perMemberNAV = Math.round(totalNAV / 10);
    const totalProfit = totalData?.profitAmount || 5200000;
    const perMemberProfit = Math.round(totalProfit / 10);
    const returnRate = totalData?.timeWeightedReturn !== undefined ? totalData.timeWeightedReturn : (totalData?.returnRate || 34.5);

    // Latest month profit / cashflow
    const monthPnl = latestMonthInfo?.summary?.totalPnl || 420000;
    const monthDividend = latestMonthInfo?.summary?.totalDividend || 185000;
    const cashBalance = latestMonthInfo?.summary?.cashBalance || 650000;

    // Holdings Top 5
    const rawHoldings = (latestMonthInfo?.holdings || []).filter(h => h.endValue > 0);
    const holdings: TffHoldingsRow[] = rawHoldings.length > 0 ? rawHoldings.sort((a, b) => b.endValue - a.endValue) : [
        { name: 'TIGER 미국S&P500', endValue: 10400000, beginValue: 9800000, buyAmount: 0, sellAmount: 0, dividend: 45000, creditInterest: 0, investmentPnl: 600000, weight: 0.30 },
        { name: 'KODEX 미국나스닥100TR', endValue: 8700000, beginValue: 8100000, buyAmount: 0, sellAmount: 0, dividend: 0, creditInterest: 0, investmentPnl: 600000, weight: 0.25 },
        { name: 'KODEX 반도체', endValue: 6960000, beginValue: 6400000, buyAmount: 0, sellAmount: 0, dividend: 35000, creditInterest: 0, investmentPnl: 560000, weight: 0.20 },
        { name: 'ACE 미국배당다우존스(H)', endValue: 5220000, beginValue: 4900000, buyAmount: 0, sellAmount: 0, dividend: 65000, creditInterest: 0, investmentPnl: 320000, weight: 0.15 },
        { name: 'ACE KRX금현물', endValue: 3520000, beginValue: 3300000, buyAmount: 0, sellAmount: 0, dividend: 0, creditInterest: 0, investmentPnl: 220000, weight: 0.10 }
    ];

    const top5 = holdings.slice(0, 5);

    // Asset Allocation
    let stockVal = 0;
    let bondVal = 0;
    let otherVal = cashBalance;

    holdings.forEach(h => {
        const n = h.name.toLowerCase();
        if (n.includes('채권') || n.includes('국채') || n.includes('bond')) {
            bondVal += h.endValue;
        } else if (n.includes('머니') || n.includes('kofr') || n.includes('cd') || n.includes('현금')) {
            otherVal += h.endValue;
        } else {
            stockVal += h.endValue;
        }
    });

    const calcTotal = stockVal + bondVal + otherVal || 1;
    const stockPct = Math.round((stockVal / calcTotal) * 100);
    const bondPct = Math.round((bondVal / calcTotal) * 100);
    const otherPct = 100 - stockPct - bondPct;

    // Copy formatted text for KakaoTalk
    const handleCopyKakao = () => {
        const text = `📊 [Time Future Forum (TFF) ${latestMonth} 월간 운용보고서]\n\n` +
            `👥 운영방식: 10인 균등 적립 (월 10만 원) & 배당 100% 복리 재투자\n` +
            `━━━━━━━━━━━━━━━━━━━━\n` +
            `💰 펀드 총 순자산: ${formatMoney(totalNAV)}원\n` +
            `👤 1인당 평가금액: ${formatMoney(perMemberNAV)}원\n` +
            `📈 펀드 총 누적수익률: ${returnRate >= 0 ? '+' : ''}${returnRate.toFixed(1)}%\n` +
            `💵 1인당 누적 평가손익: ${perMemberProfit >= 0 ? '+' : ''}${formatMoney(perMemberProfit)}원\n` +
            `━━━━━━━━━━━━━━━━━━━━\n` +
            `🏆 상위 편입 종목 Top 5:\n` +
            top5.map((h, i) => ` ${i + 1}. ${h.name} (${(h.weight ? h.weight * 100 : (h.endValue / totalNAV) * 100).toFixed(1)}%)`).join('\n') + '\n' +
            `━━━━━━━━━━━━━━━━━━━━\n` +
            `🧩 자산배분: 주식형 ${stockPct}% | 채권형 ${bondPct}% | 현금·대체 ${otherPct}%\n\n` +
            `📝 [매니저 총평]\n${managerNote}\n\n` +
            `✨ i-Prism TFF Dashboard에서 상세 현황을 확인하세요.`;

        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
    };

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
            {/* Modal Dialog Card */}
            <div className="relative w-full max-w-3xl bg-[#0f111a] border border-white/15 rounded-3xl shadow-2xl overflow-hidden flex flex-col my-auto text-white">
                
                {/* Print and Screen Styles */}
                <style jsx global>{`
                    @media print {
                        body * {
                            visibility: hidden;
                        }
                        #tff-factsheet-print-area, #tff-factsheet-print-area * {
                            visibility: visible;
                        }
                        #tff-factsheet-print-area {
                            position: absolute;
                            left: 0;
                            top: 0;
                            width: 100%;
                            background: white !important;
                            color: black !important;
                            padding: 20px !important;
                        }
                        .no-print {
                            display: none !important;
                        }
                        .print-text-dark {
                            color: #111827 !important;
                        }
                        .print-border {
                            border-color: #e5e7eb !important;
                        }
                        .print-bg-card {
                            background: #f9fafb !important;
                        }
                    }
                `}</style>

                {/* Top Action Bar (No Print) */}
                <div className="no-print flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/[0.02]">
                    <div className="flex items-center gap-2">
                        <span className="p-1.5 rounded-lg bg-sky-500/20 text-sky-400">
                            <FileText className="w-4 h-4" />
                        </span>
                        <h3 className="text-base font-bold text-white">
                            TFF 공동 펀드 1-Page 월간 팩트시트
                        </h3>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleCopyKakao}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                                copied
                                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                    : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border-amber-500/30'
                            }`}
                            title="단톡방 공지용 텍스트 복사"
                        >
                            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                            {copied ? '복사 완료!' : '카톡 공지 복사'}
                        </button>
                        <button
                            onClick={handlePrint}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold transition-all border border-white/10"
                            title="A4 용지 인쇄 및 PDF 저장"
                        >
                            <Printer className="w-3.5 h-3.5" />
                            A4 인쇄 / PDF
                        </button>
                        <button
                            onClick={onClose}
                            className="p-1.5 text-gray-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors ml-1"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Printable Factsheet Body */}
                <div id="tff-factsheet-print-area" className="p-6 md:p-8 space-y-6 overflow-y-auto max-h-[80vh]">
                    
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-white/10 print-border gap-2">
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-extrabold px-2 py-0.5 rounded bg-sky-500/20 text-sky-400 border border-sky-500/30">
                                    공동 펀드 공식 보고서
                                </span>
                                <span className="text-xs text-gray-400 print-text-dark">
                                    기준월: 2026년 {latestMonth}
                                </span>
                            </div>
                            <h1 className="text-2xl font-black tracking-tight text-white print-text-dark mt-1">
                                Time Future Forum (TFF) 펀드 운용보고서
                            </h1>
                        </div>
                        <div className="text-left sm:text-right">
                            <span className="text-[11px] text-gray-400 print-text-dark block">운용 원칙</span>
                            <span className="text-xs font-bold text-amber-300 print-text-dark">
                                10인 균등 적립 · 배당 100% 복리 재투자
                            </span>
                        </div>
                    </div>

                    {/* 4 Core Metric Cards (10-Member Centered) */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="p-4 rounded-2xl bg-white/[0.03] print-bg-card border border-white/10 print-border">
                            <div className="flex items-center gap-1.5 text-xs text-gray-400 print-text-dark font-medium mb-1">
                                <Wallet className="w-3.5 h-3.5 text-sky-400" />
                                펀드 총 순자산 (NAV)
                            </div>
                            <div className="text-lg md:text-xl font-black text-white print-text-dark">
                                {formatMoney(totalNAV)}원
                            </div>
                            <span className="text-[10px] text-gray-400 print-text-dark">
                                현금 잔고 {formatMoney(cashBalance)}원 포함
                            </span>
                        </div>

                        <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-500/10 to-sky-500/10 print-bg-card border border-indigo-500/20 print-border">
                            <div className="flex items-center gap-1.5 text-xs text-indigo-300 print-text-dark font-bold mb-1">
                                <Users className="w-3.5 h-3.5 text-indigo-400" />
                                1인당 평가액 (1/10)
                            </div>
                            <div className="text-lg md:text-xl font-black text-indigo-200 print-text-dark">
                                {formatMoney(perMemberNAV)}원
                            </div>
                            <span className="text-[10px] text-emerald-400 font-bold">
                                누적 손익 {perMemberProfit >= 0 ? '+' : ''}{formatMoney(perMemberProfit)}원
                            </span>
                        </div>

                        <div className="p-4 rounded-2xl bg-white/[0.03] print-bg-card border border-white/10 print-border">
                            <div className="flex items-center gap-1.5 text-xs text-gray-400 print-text-dark font-medium mb-1">
                                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                                펀드 총 누적 수익률
                            </div>
                            <div className={`text-lg md:text-xl font-black ${returnRate >= 0 ? 'text-emerald-400' : 'text-red-400'} print-text-dark`}>
                                {returnRate >= 0 ? '+' : ''}{returnRate.toFixed(1)}%
                            </div>
                            <span className="text-[10px] text-gray-400 print-text-dark">
                                시간가중평잔 기준
                            </span>
                        </div>

                        <div className="p-4 rounded-2xl bg-white/[0.03] print-bg-card border border-white/10 print-border">
                            <div className="flex items-center gap-1.5 text-xs text-gray-400 print-text-dark font-medium mb-1">
                                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                                {latestMonth} 재투자 배당금
                            </div>
                            <div className="text-lg md:text-xl font-black text-amber-300 print-text-dark">
                                +{formatMoney(monthDividend)}원
                            </div>
                            <span className="text-[10px] text-amber-400/80 font-bold">
                                100% 펀드 전액 재투자
                            </span>
                        </div>
                    </div>

                    {/* Middle Section: Top 5 Holdings + Asset Allocation */}
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                        
                        {/* Top 5 Holdings Table (7 cols) */}
                        <div className="md:col-span-7 p-4 rounded-2xl bg-white/[0.02] print-bg-card border border-white/10 print-border">
                            <h4 className="text-xs font-bold text-gray-300 print-text-dark uppercase tracking-wider mb-3 flex items-center justify-between">
                                <span>주요 편입 종목 Top 5</span>
                                <span className="text-[10px] text-gray-400 font-normal">비중 순 정렬</span>
                            </h4>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs">
                                    <thead>
                                        <tr className="border-b border-white/10 print-border text-gray-400 print-text-dark text-[11px]">
                                            <th className="pb-2 font-medium">종목명</th>
                                            <th className="pb-2 text-right font-medium">비중</th>
                                            <th className="pb-2 text-right font-medium">평가액</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5 print-border">
                                        {top5.map((h, idx) => {
                                            const weight = h.weight ? h.weight * 100 : ((h.endValue / totalNAV) * 100);
                                            return (
                                                <tr key={idx} className="hover:bg-white/[0.02]">
                                                    <td className="py-2.5 font-bold text-white print-text-dark truncate max-w-[180px]">
                                                        <span className="text-sky-400 mr-1.5">{idx + 1}.</span>
                                                        {h.name}
                                                    </td>
                                                    <td className="py-2.5 text-right font-bold text-sky-300 print-text-dark">
                                                        {weight.toFixed(1)}%
                                                    </td>
                                                    <td className="py-2.5 text-right font-mono text-gray-300 print-text-dark">
                                                        {formatMoney(h.endValue)}원
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Asset Allocation Card (5 cols) */}
                        <div className="md:col-span-5 p-4 rounded-2xl bg-white/[0.02] print-bg-card border border-white/10 print-border flex flex-col justify-between">
                            <div>
                                <h4 className="text-xs font-bold text-gray-300 print-text-dark uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                    <PieChart className="w-3.5 h-3.5 text-sky-400" />
                                    포트폴리오 자산 배분 비중
                                </h4>
                                
                                {/* Progress Multi-Bar */}
                                <div className="h-4 w-full bg-white/10 rounded-full overflow-hidden flex mb-4">
                                    <div style={{ width: `${stockPct}%` }} className="bg-sky-500 h-full" title={`주식형 ${stockPct}%`} />
                                    <div style={{ width: `${bondPct}%` }} className="bg-emerald-500 h-full" title={`채권형 ${bondPct}%`} />
                                    <div style={{ width: `${otherPct}%` }} className="bg-amber-500 h-full" title={`현금/대체 ${otherPct}%`} />
                                </div>

                                <div className="space-y-2 text-xs">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="w-2.5 h-2.5 rounded-full bg-sky-500" />
                                            <span className="text-gray-300 print-text-dark">주식형 (글로벌·국내)</span>
                                        </div>
                                        <span className="font-bold text-white print-text-dark">{stockPct}%</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                                            <span className="text-gray-300 print-text-dark">채권형 (안전자산)</span>
                                        </div>
                                        <span className="font-bold text-white print-text-dark">{bondPct}%</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                                            <span className="text-gray-300 print-text-dark">현금성/파킹/대체</span>
                                        </div>
                                        <span className="font-bold text-white print-text-dark">{otherPct}%</span>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-4 pt-3 border-t border-white/10 print-border flex items-center gap-2 text-[11px] text-gray-400 print-text-dark">
                                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                                <span>정기 자산배분과 배당 재투자로 변동성을 방어하고 있습니다.</span>
                            </div>
                        </div>
                    </div>

                    {/* Manager Commentary (Editable on screen, looks static on print) */}
                    <div className="p-4 rounded-2xl bg-white/[0.02] print-bg-card border border-white/10 print-border">
                        <div className="flex items-center justify-between mb-2">
                            <h4 className="text-xs font-bold text-gray-300 print-text-dark flex items-center gap-1.5">
                                <FileText className="w-3.5 h-3.5 text-sky-400" />
                                펀드 매니저 {latestMonth} 운용 총평
                            </h4>
                            <span className="text-[10px] text-gray-500 no-print">
                                (직접 수정 시 자동 저장됩니다)
                            </span>
                        </div>
                        <textarea
                            value={managerNote}
                            onChange={handleNoteChange}
                            rows={3}
                            className="w-full bg-black/40 print:bg-transparent border border-white/10 print:border-none rounded-xl p-3 text-xs leading-relaxed text-gray-200 print-text-dark focus:outline-none focus:border-sky-500/50 resize-none font-sans"
                            placeholder="이번 달 운용 성과 및 멤버들에게 전할 메모를 입력하세요..."
                        />
                    </div>

                    {/* Footer */}
                    <div className="pt-2 text-center text-[10px] text-gray-500 print-text-dark border-t border-white/5 print-border">
                        Time Future Forum (TFF) · i-Prism Portfolio Analytics System · 사내/동문 10인 공동 펀드 전용
                    </div>

                </div>
            </div>
        </div>
    );
}
