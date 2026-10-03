"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip as RechartsTooltip, ReferenceLine, Cell
} from 'recharts';
import {
    Coins, Calendar, TrendingUp, Sparkles, Plus, Trash2, RefreshCw,
    Wallet, ShieldCheck, ArrowUpRight, DollarSign, Award, CheckCircle2,
    CalendarDays, BarChart3, AlertCircle, Info, ChevronRight, Zap
} from 'lucide-react';
import { API_BASE } from '@/lib/apiConfig';

// ── 타입 정의 ────────────────────────────────────────────────────────────────
export interface PortfolioItem {
    code: string;
    shares: number;
    name?: string;
}

export interface HoldingDetail {
    code: string;
    name: string;
    shares: number;
    currency: string;
    frequency: string;
    per_payout_amount: number;
    active_months: number[];
    annual_expected_total: number;
    yield_ttm: number;
}

export interface CashflowResult {
    monthly_cashflow_krw: number[];
    monthly_cashflow_usd: number[];
    total_annual_krw: number;
    total_annual_usd: number;
    holdings: HoldingDetail[];
}

export interface DividendRankingItem {
    code: string;
    name: string;
    frequency: string;
    yield_ttm: number;
    last_amount: number;
    annual_amount: number;
    last_ex_date: string | null;
    months: number[];
    currency: string;
}

// 기본 추천 프리셋 (안정형 고배당 바벨)
const DEFAULT_PRESET: PortfolioItem[] = [
    { code: "453850", shares: 1000, name: "ACE 미국30년국채액티브(H)" }, // 월배당
    { code: "458730", shares: 500, name: "TIGER 미국배당다우존스" },      // 월배당
    { code: "069500", shares: 100, name: "KODEX 200" },               // 분기배당
    { code: "SCHD", shares: 50, name: "Schwab US Dividend Equity ETF" },// 분기배당 (USD)
];

const MONTH_NAMES = [
    "1월", "2월", "3월", "4월", "5월", "6월",
    "7월", "8월", "9월", "10월", "11월", "12월"
];

export default function DividendDashboard({ autoLoadMyAssets = false }: { autoLoadMyAssets?: boolean }) {
    const [holdings, setHoldings] = useState<PortfolioItem[]>(DEFAULT_PRESET);
    const [cashflow, setCashflow] = useState<CashflowResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [rankings, setRankings] = useState<DividendRankingItem[]>([]);
    const [rankingFilter, setRankingFilter] = useState<'ALL' | 'MONTHLY'>('MONTHLY');
    const [rankingLoading, setRankingLoading] = useState(false);

    // 신규 종목 추가 모달 / 입력 상태
    const [inputCode, setInputCode] = useState('');
    const [inputShares, setInputShares] = useState<number>(100);
    const [inputName, setInputName] = useState('');
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [importingAssets, setImportingAssets] = useState(false);
    const [statusMsg, setStatusMsg] = useState<string | null>(null);

    const curMonth = new Date().getMonth() + 1; // 1 ~ 12

    // ── 1. 캐시플로우 계산 호출 ──────────────────────────────────────────────
    const calculateCashflow = useCallback(async (currentHoldings: PortfolioItem[]) => {
        if (!currentHoldings.length) {
            setCashflow(null);
            return;
        }
        setLoading(true);
        try {
            const resp = await fetch(`${API_BASE}/api/v1/dividends/portfolio-cashflow`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    holdings: currentHoldings.map(h => ({
                        code: h.code.trim().toUpperCase(),
                        shares: Number(h.shares),
                        name: h.name || h.code,
                    }))
                }),
            });
            if (resp.ok) {
                const data = await resp.json();
                setCashflow(data);
            }
        } catch (err) {
            console.error("Cashflow calculation failed", err);
        } finally {
            setLoading(false);
        }
    }, []);

    // ── 2. 배당 랭킹 조회 ────────────────────────────────────────────────────
    const fetchRankings = useCallback(async (filter: 'ALL' | 'MONTHLY') => {
        setRankingLoading(true);
        try {
            const url = filter === 'MONTHLY'
                ? `${API_BASE}/api/v1/dividends/rankings?frequency=MONTHLY&limit=15`
                : `${API_BASE}/api/v1/dividends/rankings?limit=15`;
            const resp = await fetch(url);
            if (resp.ok) {
                const data = await resp.json();
                setRankings(data.rankings || []);
            }
        } catch (err) {
            console.error("Failed to fetch dividend rankings", err);
        } finally {
            setRankingLoading(false);
        }
    }, []);

    // ── 3. 내 실제 보유 계좌 불러오기 ────────────────────────────────────────
    const handleImportUserAssets = useCallback(async () => {
        setImportingAssets(true);
        setStatusMsg("내 계좌 자산 조회 중…");
        try {
            // integrated-assets API 호출
            const resp = await fetch(`${API_BASE}/api/v1/my/integrated-assets`);
            if (resp.ok) {
                const data = await resp.json();
                const fetchedHoldings: PortfolioItem[] = [];

                // 1) KIS 연동 계좌 종목
                if (data.kis_accounts) {
                    for (const acc of Object.values(data.kis_accounts) as any[]) {
                        for (const h of acc.holdings || []) {
                            if (h.pdno && h.hldg_qty > 0) {
                                fetchedHoldings.push({
                                    code: h.pdno,
                                    shares: Number(h.hldg_qty),
                                    name: h.prdt_name || h.pdno,
                                });
                            }
                        }
                    }
                }

                // 2) 수동 입력 종목
                if (data.manual_assets && Array.isArray(data.manual_assets)) {
                    for (const m of data.manual_assets) {
                        if (m.code && m.quantity > 0) {
                            fetchedHoldings.push({
                                code: m.code,
                                shares: Number(m.quantity),
                                name: m.name || m.code,
                            });
                        }
                    }
                }

                if (fetchedHoldings.length > 0) {
                    // 동일 코드 병합
                    const mergedMap = new Map<string, PortfolioItem>();
                    for (const item of fetchedHoldings) {
                        const existing = mergedMap.get(item.code);
                        if (existing) {
                            existing.shares += item.shares;
                        } else {
                            mergedMap.set(item.code, { ...item });
                        }
                    }
                    const finalItems = Array.from(mergedMap.values());
                    setHoldings(finalItems);
                    calculateCashflow(finalItems);
                    setStatusMsg(`총 ${finalItems.length}개 보유 종목을 불러왔습니다!`);
                } else {
                    setStatusMsg("연동된 보유 주식/ETF 자산이 없습니다. 기본 프리셋을 유지합니다.");
                    calculateCashflow(DEFAULT_PRESET);
                }
            } else {
                setStatusMsg("자산 정보를 불러오지 못했습니다. 기본 프리셋을 유지합니다.");
                calculateCashflow(DEFAULT_PRESET);
            }
        } catch (e) {
            console.error("Import error", e);
            setStatusMsg("계좌 연동 통신 오류가 발생했습니다.");
            calculateCashflow(DEFAULT_PRESET);
        } finally {
            setImportingAssets(false);
            setTimeout(() => setStatusMsg(null), 4000);
        }
    }, [calculateCashflow]);

    // 초기 마운트 시 실행
    useEffect(() => {
        if (autoLoadMyAssets) {
            handleImportUserAssets();
        } else {
            calculateCashflow(holdings);
        }
        fetchRankings(rankingFilter);
    }, [autoLoadMyAssets, handleImportUserAssets, calculateCashflow, fetchRankings]);

    // 랭킹 필터 변경 시
    useEffect(() => {
        fetchRankings(rankingFilter);
    }, [rankingFilter, fetchRankings]);

    // ── 4. 종목 수량 변경 핸들러 ─────────────────────────────────────────────
    const handleUpdateShares = (code: string, newShares: number) => {
        const updated = holdings.map(h => h.code === code ? { ...h, shares: Math.max(0, newShares) } : h);
        setHoldings(updated);
        calculateCashflow(updated);
    };

    // ── 5. 종목 삭제 핸들러 ──────────────────────────────────────────────────
    const handleRemoveItem = (code: string) => {
        const updated = holdings.filter(h => h.code !== code);
        setHoldings(updated);
        calculateCashflow(updated);
    };

    // ── 6. 신규 종목 추가 핸들러 ─────────────────────────────────────────────
    const handleAddItem = (codeToAdd?: string, nameToAdd?: string) => {
        const targetCode = (codeToAdd || inputCode).trim().toUpperCase();
        if (!targetCode) return;

        const existing = holdings.find(h => h.code === targetCode);
        let updated: PortfolioItem[];
        if (existing) {
            updated = holdings.map(h => h.code === targetCode ? { ...h, shares: h.shares + (codeToAdd ? 100 : inputShares) } : h);
        } else {
            updated = [...holdings, {
                code: targetCode,
                shares: codeToAdd ? 100 : inputShares,
                name: nameToAdd || inputName || targetCode,
            }];
        }
        setHoldings(updated);
        calculateCashflow(updated);
        setInputCode('');
        setInputName('');
        setInputShares(100);
        setIsAddOpen(false);
    };

    // ── 7. 차트 데이터 가공 ──────────────────────────────────────────────────
    const chartData = useMemo(() => {
        if (!cashflow) return [];
        return MONTH_NAMES.map((name, idx) => {
            const krw = cashflow.monthly_cashflow_krw[idx] || 0;
            const usd = cashflow.monthly_cashflow_usd[idx] || 0;
            // USD 환산 가중 (환율 약 1,350원 기준 시각화)
            const approxKrwTotal = Math.round(krw + (usd * 1350));
            return {
                month: name,
                monthNum: idx + 1,
                krw: Math.round(krw),
                usd: usd,
                totalKrw: approxKrwTotal,
                isCurrent: idx + 1 === curMonth,
            };
        });
    }, [cashflow, curMonth]);

    // 월평균 예상 배당금 (원화 환산)
    const avgMonthlyKrw = useMemo(() => {
        if (!chartData.length) return 0;
        const sum = chartData.reduce((acc, cur) => acc + cur.totalKrw, 0);
        return Math.round(sum / 12);
    }, [chartData]);

    // 가중 평균 배당수익률
    const weightedYield = useMemo(() => {
        if (!cashflow?.holdings?.length) return 0;
        const validHoldings = cashflow.holdings.filter(h => h.yield_ttm > 0);
        if (!validHoldings.length) return 0;
        const totalPayout = validHoldings.reduce((acc, h) => acc + h.annual_expected_total, 0);
        if (totalPayout <= 0) return 0;
        const weighted = validHoldings.reduce((acc, h) => acc + (h.yield_ttm * (h.annual_expected_total / totalPayout)), 0);
        return Math.round(weighted * 100) / 100;
    }, [cashflow]);

    // 월배당 비중
    const monthlyFrequencyRatio = useMemo(() => {
        if (!cashflow?.holdings?.length) return 0;
        const monthlyCount = cashflow.holdings.filter(h => h.frequency === 'MONTHLY').length;
        return Math.round((monthlyCount / cashflow.holdings.length) * 100);
    }, [cashflow]);

    return (
        <div className="w-full flex flex-col gap-6 text-gray-100">
            {/* ── 1. 상단 타이틀 & 퀵 액션 바 ─────────────────────────────── */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-br from-emerald-950/20 via-black/40 to-cyan-950/20 rounded-3xl border border-emerald-500/20 p-5 md:p-6 backdrop-blur-xl shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
                <div className="flex items-center gap-3 relative z-10">
                    <div className="p-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 shadow-inner">
                        <Coins className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-lg md:text-xl font-black text-white tracking-tight">
                                ETF 배당 캘린더 & Cashflow 시뮬레이터
                            </h2>
                            <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                                S6-5 LIVE
                            </span>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">
                            보유 종목의 과거 분배금 시계열 기반 12개월 현금흐름 달력 및 수량 변경 실시간 예측
                        </p>
                    </div>
                </div>

                {/* 컨트롤 버튼 그룹 */}
                <div className="flex flex-wrap items-center gap-2 relative z-10">
                    <button
                        onClick={handleImportUserAssets}
                        disabled={importingAssets}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/15 text-white border border-white/15 transition shadow cursor-pointer active:scale-95 disabled:opacity-50"
                        title="내 KIS 및 수동 입력 보유 주식/ETF를 그대로 불러옵니다"
                    >
                        <Wallet className={`w-3.5 h-3.5 text-cyan-400 ${importingAssets ? 'animate-spin' : ''}`} />
                        {importingAssets ? '자산 불러오는 중…' : '내 보유 계좌 불러오기'}
                    </button>
                    <button
                        onClick={() => {
                            setHoldings(DEFAULT_PRESET);
                            calculateCashflow(DEFAULT_PRESET);
                        }}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 transition shadow cursor-pointer active:scale-95"
                    >
                        <Sparkles className="w-3.5 h-3.5" />
                        추천 배당 프리셋
                    </button>
                    <button
                        onClick={() => setIsAddOpen(true)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-500 to-cyan-500 text-black hover:brightness-110 transition shadow shadow-emerald-500/20 cursor-pointer active:scale-95 font-black"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        종목 추가
                    </button>
                </div>
            </div>

            {/* 토스트 메시지 */}
            {statusMsg && (
                <div className="bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 text-xs px-4 py-2.5 rounded-2xl flex items-center gap-2 animate-in fade-in duration-300">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{statusMsg}</span>
                </div>
            )}

            {/* ── 2. 핵심 요약 Bento 4개 카드 ──────────────────────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. 연간 총 예상 배당금 */}
                <div className="bg-black/30 rounded-2xl border border-white/10 p-5 backdrop-blur-xl relative overflow-hidden group hover:border-emerald-500/30 transition">
                    <div className="flex items-center justify-between text-gray-400 text-xs font-medium mb-2">
                        <span>연간 총 예상 배당금</span>
                        <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
                            <Coins className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="text-xl md:text-2xl font-black text-white">
                        {cashflow ? `${cashflow.total_annual_krw.toLocaleString()}원` : '—'}
                    </div>
                    {cashflow && cashflow.total_annual_usd > 0 && (
                        <div className="text-xs text-cyan-300 font-mono mt-1">
                            + ${cashflow.total_annual_usd.toLocaleString()} USD
                        </div>
                    )}
                    <span className="text-[11px] text-gray-500 mt-2 block">
                        현재 설정된 {holdings.length}개 종목 기준
                    </span>
                </div>

                {/* 2. 월평균 환산 배당금 */}
                <div className="bg-black/30 rounded-2xl border border-white/10 p-5 backdrop-blur-xl relative overflow-hidden group hover:border-cyan-500/30 transition">
                    <div className="flex items-center justify-between text-gray-400 text-xs font-medium mb-2">
                        <span>월평균 예상 현금흐름</span>
                        <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400">
                            <Calendar className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="text-xl md:text-2xl font-black text-cyan-200">
                        {avgMonthlyKrw > 0 ? `약 ${avgMonthlyKrw.toLocaleString()}원` : '—'}
                    </div>
                    <span className="text-[11px] text-gray-400 mt-2 block">
                        은퇴 및 재투자 가용 월평균 캐시
                    </span>
                </div>

                {/* 3. 가중 평균 배당수익률 */}
                <div className="bg-black/30 rounded-2xl border border-white/10 p-5 backdrop-blur-xl relative overflow-hidden group hover:border-amber-500/30 transition">
                    <div className="flex items-center justify-between text-gray-400 text-xs font-medium mb-2">
                        <span>가중 평균 배당수익률 (TTM)</span>
                        <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400">
                            <TrendingUp className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="text-xl md:text-2xl font-black text-amber-300">
                        {weightedYield > 0 ? `${weightedYield.toFixed(2)}%` : '—'}
                    </div>
                    <span className="text-[11px] text-gray-400 mt-2 block">
                        종목별 배당 기여액 가중치 적용
                    </span>
                </div>

                {/* 4. 월배당 구성 비중 */}
                <div className="bg-black/30 rounded-2xl border border-white/10 p-5 backdrop-blur-xl relative overflow-hidden group hover:border-purple-500/30 transition">
                    <div className="flex items-center justify-between text-gray-400 text-xs font-medium mb-2">
                        <span>월배당 ETF 비중</span>
                        <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-400">
                            <ShieldCheck className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="text-xl md:text-2xl font-black text-purple-300">
                        {monthlyFrequencyRatio}%
                    </div>
                    <span className="text-[11px] text-gray-400 mt-2 block">
                        매월 끊김 없는 안정적 배당 구조
                    </span>
                </div>
            </div>

            {/* ── 3. 월별 Cashflow 바 차트 & 12개월 캘린더 매트릭스 ───────── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* 좌측: Recharts 1~12월 배당금 바 차트 (2칸 차지) */}
                <div className="lg:col-span-2 bg-black/30 rounded-3xl border border-white/10 p-5 md:p-6 backdrop-blur-xl flex flex-col justify-between">
                    <div>
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                            <div className="flex items-center gap-2">
                                <BarChart3 className="w-4 h-4 text-emerald-400" />
                                <h3 className="text-sm md:text-base font-bold text-white">
                                    1~12월 월별 예상 배당금 차트 (Monthly Cashflow)
                                </h3>
                            </div>
                            <span className="text-xs text-gray-400">
                                월평균: <span className="text-cyan-300 font-bold">{avgMonthlyKrw.toLocaleString()}원</span> 기준
                            </span>
                        </div>

                        {/* 바 차트 본체 */}
                        <div className="w-full h-64 md:h-72">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData} margin={{ top: 15, right: 10, left: 10, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                                    <XAxis
                                        dataKey="month"
                                        stroke="#888"
                                        fontSize={11}
                                        tickLine={false}
                                    />
                                    <YAxis
                                        stroke="#888"
                                        fontSize={10}
                                        tickLine={false}
                                        tickFormatter={(v) => `${Math.round(v / 10000)}만`}
                                    />
                                    <RechartsTooltip
                                        content={({ active, payload }) => {
                                            if (active && payload && payload.length) {
                                                const data = payload[0].payload;
                                                return (
                                                    <div className="bg-[#12121a] border border-white/15 p-3 rounded-xl shadow-xl text-xs space-y-1">
                                                        <div className="font-bold text-white flex items-center justify-between gap-4">
                                                            <span>{data.month} 배당금</span>
                                                            {data.isCurrent && (
                                                                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded">이번 달</span>
                                                            )}
                                                        </div>
                                                        <div className="text-emerald-300 font-black text-sm">
                                                            약 {data.totalKrw.toLocaleString()}원
                                                        </div>
                                                        {data.usd > 0 && (
                                                            <div className="text-cyan-300 text-[11px]">
                                                                (원화 {data.krw.toLocaleString()}원 + ${data.usd} USD)
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            }
                                            return null;
                                        }}
                                    />
                                    <ReferenceLine
                                        y={avgMonthlyKrw}
                                        stroke="#06b6d4"
                                        strokeDasharray="4 4"
                                        label={{ value: '월평균', position: 'top', fill: '#06b6d4', fontSize: 10 }}
                                    />
                                    <Bar dataKey="totalKrw" radius={[6, 6, 0, 0]}>
                                        {chartData.map((entry, index) => (
                                            <Cell
                                                key={`cell-${index}`}
                                                fill={entry.isCurrent ? '#10b981' : entry.totalKrw > avgMonthlyKrw ? '#059669' : '#334155'}
                                            />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="flex items-center gap-4 text-[11px] text-gray-400 mt-2 border-t border-white/5 pt-3">
                        <span className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" /> 이번 달 ({curMonth}월)
                        </span>
                        <span className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-sm bg-emerald-600 inline-block" /> 평균 이상 수령월
                        </span>
                        <span className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-sm bg-slate-700 inline-block" /> 평균 미만 수령월
                        </span>
                    </div>
                </div>

                {/* 우측: 12개월 캘린더 매트릭스 (4x3) */}
                <div className="bg-black/30 rounded-3xl border border-white/10 p-5 md:p-6 backdrop-blur-xl flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <CalendarDays className="w-4 h-4 text-cyan-400" />
                                <h3 className="text-sm md:text-base font-bold text-white">
                                    연간 배당 캘린더 매트릭스
                                </h3>
                            </div>
                            <span className="text-[11px] text-gray-500 font-mono">1년 로드맵</span>
                        </div>

                        <div className="grid grid-cols-3 gap-2.5">
                            {chartData.map((cd) => {
                                const isCurrent = cd.monthNum === curMonth;
                                const isZero = cd.totalKrw === 0;

                                // 해당 월에 배당을 지급하는 종목 목록 추출
                                const payingHoldings = cashflow?.holdings?.filter(h =>
                                    h.active_months.includes(cd.monthNum)
                                ) || [];

                                return (
                                    <div
                                        key={cd.monthNum}
                                        className={`rounded-2xl p-2.5 transition flex flex-col justify-between border ${
                                            isCurrent
                                                ? 'bg-emerald-950/40 border-emerald-400 ring-2 ring-emerald-400/40 shadow-lg'
                                                : isZero
                                                    ? 'bg-black/20 border-white/5 opacity-60'
                                                    : 'bg-black/30 border-white/10 hover:border-white/20'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between text-[11px] mb-1">
                                            <span className={`font-black ${isCurrent ? 'text-emerald-300' : 'text-gray-300'}`}>
                                                {cd.month}
                                            </span>
                                            {isCurrent && (
                                                <span className="text-[9px] bg-emerald-400 text-black font-black px-1 rounded">
                                                    NOW
                                                </span>
                                            )}
                                        </div>

                                        <div className="my-1">
                                            {isZero ? (
                                                <span className="text-[10px] text-gray-500 italic block">배당 없음</span>
                                            ) : (
                                                <span className="text-xs font-black text-white block">
                                                    {cd.totalKrw >= 10000
                                                        ? `${(cd.totalKrw / 10000).toFixed(1)}만원`
                                                        : `${cd.totalKrw.toLocaleString()}원`}
                                                </span>
                                            )}
                                        </div>

                                        <div className="flex flex-wrap gap-1 mt-1">
                                            {payingHoldings.slice(0, 2).map((h, i) => (
                                                <span
                                                    key={i}
                                                    title={`${h.name}: ${h.currency === 'USD' ? '$' + h.per_payout_amount * h.shares : (h.per_payout_amount * h.shares).toLocaleString() + '원'}`}
                                                    className="text-[9px] px-1 py-0.2 rounded bg-white/5 text-gray-400 truncate max-w-[65px]"
                                                >
                                                    {h.name.replace(/ACE|TIGER|KODEX|SOL/g, '').trim()}
                                                </span>
                                            ))}
                                            {payingHoldings.length > 2 && (
                                                <span className="text-[9px] text-cyan-400 font-bold">
                                                    +{payingHoldings.length - 2}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <p className="text-[11px] text-gray-500 mt-4 leading-relaxed">
                        💡 특정 월에 '배당 없음'이 발생하면 분기배당/월배당 종목을 포트폴리오에 추가하여 현금흐름 공백을 채울 수 있습니다.
                    </p>
                </div>
            </div>

            {/* ── 4. 시뮬레이션 포트폴리오 종목 관리 & 수량 변경 테이블 ──────── */}
            <div className="bg-black/30 rounded-3xl border border-white/10 p-5 md:p-6 backdrop-blur-xl">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4 border-b border-white/10 pb-3">
                    <div className="flex items-center gap-2">
                        <Coins className="w-4 h-4 text-emerald-400" />
                        <h3 className="text-base font-bold text-white">
                            시뮬레이션 포트폴리오 종목 및 보유수량 조절
                        </h3>
                    </div>
                    <span className="text-xs text-gray-400">
                        수량을 실시간으로 변경하면 상단 캘린더와 월별 배당금이 즉시 재계산됩니다.
                    </span>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                        <thead>
                            <tr className="border-b border-white/10 text-gray-400">
                                <th className="py-2.5 px-3 font-semibold">종목명 / 티커</th>
                                <th className="py-2.5 px-3 font-semibold text-center">배당주기</th>
                                <th className="py-2.5 px-3 font-semibold text-center">최근 배당수익률</th>
                                <th className="py-2.5 px-3 font-semibold text-center">직전 분배금</th>
                                <th className="py-2.5 px-3 font-semibold text-center">배당 발생월</th>
                                <th className="py-2.5 px-3 font-semibold text-center w-36">보유 수량 (주)</th>
                                <th className="py-2.5 px-3 font-semibold text-right">연간 예상 배당액</th>
                                <th className="py-2.5 px-3 font-semibold text-center">삭제</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {cashflow?.holdings && cashflow.holdings.length > 0 ? (
                                cashflow.holdings.map((item) => {
                                    const isMonthly = item.frequency === 'MONTHLY';
                                    const isUsd = item.currency === 'USD';

                                    return (
                                        <tr key={item.code} className="hover:bg-white/[0.02] transition">
                                            <td className="py-3 px-3">
                                                <div className="font-bold text-white">{item.name}</div>
                                                <div className="text-[11px] text-gray-500 font-mono">{item.code}</div>
                                            </td>
                                            <td className="py-3 px-3 text-center">
                                                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                                                    isMonthly
                                                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                                                        : item.frequency === 'QUARTERLY'
                                                            ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/30'
                                                            : 'bg-purple-500/20 text-purple-300 border border-purple-400/30'
                                                }`}>
                                                    {item.frequency === 'MONTHLY' ? '월배당' : item.frequency === 'QUARTERLY' ? '분기배당' : item.frequency}
                                                </span>
                                            </td>
                                            <td className="py-3 px-3 text-center font-bold text-amber-300">
                                                {item.yield_ttm > 0 ? `${item.yield_ttm.toFixed(2)}%` : '—'}
                                            </td>
                                            <td className="py-3 px-3 text-center text-gray-300 font-mono">
                                                {isUsd ? `$${item.per_payout_amount}` : `${item.per_payout_amount.toLocaleString()}원`}
                                            </td>
                                            <td className="py-3 px-3 text-center text-gray-400 text-[11px]">
                                                {item.active_months.join(', ')}월
                                            </td>
                                            <td className="py-3 px-3 text-center">
                                                <div className="inline-flex items-center border border-white/15 rounded-xl overflow-hidden bg-black/40">
                                                    <button
                                                        onClick={() => handleUpdateShares(item.code, Math.max(0, item.shares - 50))}
                                                        className="px-2 py-1 text-gray-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
                                                    >
                                                        -
                                                    </button>
                                                    <input
                                                        type="number"
                                                        value={item.shares}
                                                        onChange={(e) => handleUpdateShares(item.code, Number(e.target.value))}
                                                        className="w-16 bg-transparent text-center text-xs font-bold text-white focus:outline-none"
                                                    />
                                                    <button
                                                        onClick={() => handleUpdateShares(item.code, item.shares + 50)}
                                                        className="px-2 py-1 text-gray-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
                                                    >
                                                        +
                                                    </button>
                                                </div>
                                            </td>
                                            <td className="py-3 px-3 text-right font-black text-emerald-400 text-sm">
                                                {isUsd
                                                    ? `$${item.annual_expected_total.toLocaleString()}`
                                                    : `${Math.round(item.annual_expected_total).toLocaleString()}원`}
                                            </td>
                                            <td className="py-3 px-3 text-center">
                                                <button
                                                    onClick={() => handleRemoveItem(item.code)}
                                                    className="p-1 text-gray-500 hover:text-rose-400 transition cursor-pointer"
                                                    title="포트폴리오에서 삭제"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan={8} className="py-6 text-center text-gray-500 italic">
                                        설정된 포트폴리오 종목이 없습니다. 우측 상단의 종목 추가 또는 프리셋을 이용해주세요.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ── 5. 시장 고배당 & 월배당 ETF 랭킹 보드 ──────────────────────── */}
            <div className="bg-black/30 rounded-3xl border border-white/10 p-5 md:p-6 backdrop-blur-xl">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <div className="flex items-center gap-2">
                        <Award className="w-5 h-5 text-amber-400" />
                        <div>
                            <h3 className="text-base font-bold text-white">
                                시장 고배당 & 월배당 ETF 랭킹 (Dividend Yield Top)
                            </h3>
                            <p className="text-xs text-gray-400 mt-0.5">
                                최근 1년 실적 배당수익률 기준 상위 ETF 목록 · 원클릭으로 내 시뮬레이터에 즉시 추가
                            </p>
                        </div>
                    </div>

                    {/* 랭킹 필터 버튼 */}
                    <div className="flex items-center gap-1.5 bg-black/40 p-1 rounded-xl border border-white/10">
                        <button
                            onClick={() => setRankingFilter('MONTHLY')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                                rankingFilter === 'MONTHLY'
                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow'
                                    : 'text-gray-400 hover:text-white'
                            }`}
                        >
                            📅 월배당 (Monthly)
                        </button>
                        <button
                            onClick={() => setRankingFilter('ALL')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                                rankingFilter === 'ALL'
                                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow'
                                    : 'text-gray-400 hover:text-white'
                            }`}
                        >
                            전체 고배당
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {rankings.map((r, i) => (
                        <div
                            key={r.code}
                            className="bg-black/25 rounded-2xl p-4 border border-white/5 hover:border-emerald-500/30 transition flex flex-col justify-between"
                        >
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-[10px] font-bold text-gray-500">#{i + 1}</span>
                                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                                        r.frequency === 'MONTHLY'
                                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                                            : 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/30'
                                    }`}>
                                        {r.frequency === 'MONTHLY' ? '월배당' : '분기배당'}
                                    </span>
                                </div>
                                <h4 className="text-sm font-bold text-white mb-0.5 truncate" title={r.name}>
                                    {r.name || r.code}
                                </h4>
                                <span className="text-[11px] text-gray-500 font-mono">{r.code}</span>

                                <div className="grid grid-cols-2 gap-2 mt-3 pt-2.5 border-t border-white/5 text-xs">
                                    <div>
                                        <span className="text-gray-400 block text-[10px]">배당수익률</span>
                                        <span className="text-amber-300 font-black text-sm">{r.yield_ttm.toFixed(2)}%</span>
                                    </div>
                                    <div>
                                        <span className="text-gray-400 block text-[10px]">직전 분배금</span>
                                        <span className="text-gray-200 font-mono font-bold">
                                            {r.currency === 'USD' ? `$${r.last_amount}` : `${r.last_amount.toLocaleString()}원`}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={() => handleAddItem(r.code, r.name)}
                                className="mt-3 w-full py-1.5 rounded-xl text-xs font-bold bg-white/5 hover:bg-emerald-500/20 text-gray-300 hover:text-emerald-300 border border-white/10 hover:border-emerald-500/30 transition cursor-pointer flex items-center justify-center gap-1 active:scale-95"
                            >
                                <Plus className="w-3.5 h-3.5" />
                                시뮬레이터에 담기 (100주)
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── 6. 커스텀 종목 추가 모달 ─────────────────────────────────── */}
            {isAddOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
                    <div className="bg-[#12121a] border border-white/20 rounded-3xl p-6 w-full max-w-md shadow-2xl relative">
                        <h3 className="text-base font-black text-white mb-1 flex items-center gap-2">
                            <Plus className="w-4 h-4 text-emerald-400" />
                            배당 ETF 종목 추가
                        </h3>
                        <p className="text-xs text-gray-400 mb-4">
                            국내 6자리 종목코드(예: 453850) 또는 미국 티커(예: SCHD)를 입력하세요.
                        </p>

                        <div className="space-y-3">
                            <div>
                                <label className="text-[11px] font-bold text-gray-400 block mb-1">종목코드 / 티커 *</label>
                                <input
                                    type="text"
                                    placeholder="예: 453850 or SCHD"
                                    value={inputCode}
                                    onChange={(e) => setInputCode(e.target.value)}
                                    className="w-full bg-black/40 border border-white/15 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
                                />
                            </div>

                            <div>
                                <label className="text-[11px] font-bold text-gray-400 block mb-1">종목명 (선택)</label>
                                <input
                                    type="text"
                                    placeholder="미입력 시 자동 조회"
                                    value={inputName}
                                    onChange={(e) => setInputName(e.target.value)}
                                    className="w-full bg-black/40 border border-white/15 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                                />
                            </div>

                            <div>
                                <label className="text-[11px] font-bold text-gray-400 block mb-1">보유 수량 (주)</label>
                                <input
                                    type="number"
                                    value={inputShares}
                                    onChange={(e) => setInputShares(Number(e.target.value))}
                                    className="w-full bg-black/40 border border-white/15 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 mt-6">
                            <button
                                onClick={() => setIsAddOpen(false)}
                                className="px-4 py-2 rounded-xl text-xs font-bold text-gray-400 hover:text-white transition cursor-pointer"
                            >
                                취소
                            </button>
                            <button
                                onClick={() => handleAddItem()}
                                disabled={!inputCode.trim()}
                                className="px-5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-500 to-cyan-500 text-black hover:brightness-110 transition shadow shadow-emerald-500/20 disabled:opacity-50 cursor-pointer font-black"
                            >
                                추가하기
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
