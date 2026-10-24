// 한국 경기선행지수(순환변동치 및 OECD CLI)와 한국 수출(년/월/일별) 추이를 시각화하는 지표 컴포넌트
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    ResponsiveContainer,
    ComposedChart,
    LineChart,
    Line,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    CartesianGrid,
    ReferenceLine
} from 'recharts';
import {
    Activity,
    TrendingUp,
    TrendingDown,
    RefreshCw,
    Sparkles,
    Calendar,
    BarChart3,
    ArrowUpRight,
    ArrowDownRight,
    HelpCircle,
    Check,
    Layers,
    Cpu,
    Car,
    Flame,
    Cog,
    Layers3,
    Zap,
    Send,
    Bell,
    ExternalLink,
    ShieldCheck
} from 'lucide-react';
import { API_BASE } from '@/lib/apiConfig';

export interface PlaybookETF {
    ticker: string;
    name: string;
    category: string;
    sub_theme: string;
    points: string;
    driver: string;
    weight?: number;
}

interface KRMacroItem {
    date: string;              // YYYY-MM
    leading_cycle: number | null; // 통계청 선행지수 순환변동치 (100 기준)
    oecd_cli: number | null;      // OECD 한국 CLI (100 기준)
    export_amt: number | null;    // 월간 수출액 (억 달러)
    export_yoy: number | null;    // 수출 YoY (%)
    daily_avg_export: number | null; // 일평균 수출액 (억 달러/일)
}

export interface IndustryDetail {
    amt: number;
    share: number;
    yoy?: number | null;
    daily_avg?: number;
}

export interface IndustryMeta {
    id: string;
    name: string;
    short_name: string;
    color: string;
    desc: string;
    ksic: string;
    base_share: number;
}

export const DEFAULT_INDUSTRIES_META: IndustryMeta[] = [
    { id: 'semiconductor', name: '반도체·IT', short_name: '반도체', color: '#38bdf8', desc: '메모리, 시스템반도체, 컴퓨터, 디스플레이', ksic: '전자부품·컴퓨터 및 통신', base_share: 28.0 },
    { id: 'auto', name: '자동차·운송', short_name: '자동차', color: '#6366f1', desc: '완성차, 자동차 부품, 조선·선박', ksic: '자동차 및 운송장비', base_share: 20.0 },
    { id: 'petrochem', name: '석유화학·정유', short_name: '석유화학', color: '#f59e0b', desc: '석유제품, 화학기초유분, 합성수지', ksic: '석유제품 및 화학물질', base_share: 14.0 },
    { id: 'machinery', name: '일반기계', short_name: '기계', color: '#10b981', desc: '공작기계, 건설기계, 정밀설비', ksic: '기계 및 장비', base_share: 10.0 },
    { id: 'steel', name: '철강·금속', short_name: '철강', color: '#94a3b8', desc: '열연·냉연강판, 강관, 비철금속', ksic: '제1차 금속', base_share: 8.0 },
    { id: 'bio_battery', name: '바이오·배터리', short_name: '바이오', color: '#ec4899', desc: '바이오의약품, 이차전지(배터리), 신산업', ksic: '의약품 및 전기장비', base_share: 20.0 },
];

interface ExportItem {
    date: string;
    export_amt?: number;
    export_yoy?: number | null;
    export_daily_avg?: number;
    is_projected?: boolean;
    label?: string;
    industries?: Record<string, IndustryDetail>;
    selected_industry?: string;
    selected_industry_amt?: number;
    selected_industry_yoy?: number | null;
    selected_industry_share?: number;
    selected_industry_daily_avg?: number;
    ind_semiconductor?: number;
    ind_auto?: number;
    ind_petrochem?: number;
    ind_machinery?: number;
    ind_steel?: number;
    ind_bio_battery?: number;
}

type ExportPeriod = 'yearly' | 'monthly' | 'daily';
type Timeframe = '1Y' | '3Y' | '5Y' | '10Y';
type ExportViewMode = 'total' | 'industry';

export default function KrMacroIndicatorSection() {
    const [krData, setKrData] = useState<KRMacroItem[]>([]);
    const [exportPeriod, setExportPeriod] = useState<ExportPeriod>('monthly');
    const [exportData, setExportData] = useState<ExportItem[]>([]);
    const [exportViewMode, setExportViewMode] = useState<ExportViewMode>('total');
    const [selectedIndustry, setSelectedIndustry] = useState<string>('stacked');
    const [industriesMeta, setIndustriesMeta] = useState<IndustryMeta[]>(DEFAULT_INDUSTRIES_META);
    const [timeframe, setTimeframe] = useState<Timeframe>('5Y');
    const [loading, setLoading] = useState<boolean>(true);
    const [refreshing, setRefreshing] = useState<boolean>(false);
    const [exportLoading, setExportLoading] = useState<boolean>(false);
    const [playbookEtfs, setPlaybookEtfs] = useState<PlaybookETF[]>([]);
    const [playbookLoading, setPlaybookLoading] = useState<boolean>(false);
    const [flashAlertLoading, setFlashAlertLoading] = useState<boolean>(false);
    const [flashAlertFeedback, setFlashAlertFeedback] = useState<string | null>(null);

    // 지표 표시 토글 (한국 선행지수, OECD CLI)
    const [visibleSeries, setVisibleSeries] = useState<{ cycle: boolean; oecd: boolean }>({
        cycle: true,
        oecd: true,
    });



    // 1. 한국 경기선행지수 데이터 로드
    const fetchKrMacroData = useCallback(async (force: boolean = false) => {
        try {
            if (force) setRefreshing(true);
            const url = `${API_BASE}/api/v1/exit-signal/macro/kr${force ? '?force=true' : ''}`;
            const res = await fetch(url, {
                cache: 'no-store',
                headers: { 'Cache-Control': 'no-cache' }
            });
            if (res.ok) {
                const json = await res.json();
                if (Array.isArray(json) && json.length > 0) {
                    setKrData(json);
                    localStorage.setItem('kr_macro_cache_v1', JSON.stringify(json));
                }
            }
        } catch (err) {
            console.error('Failed to fetch KR macro data:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    // 2. 한국 수출 데이터 로드 (period: yearly, monthly, daily / industry: all, semiconductor 등)
    const fetchExportData = useCallback(async (period: ExportPeriod, ind: string = 'all') => {
        try {
            setExportLoading(true);
            const queryInd = ind === 'stacked' ? 'all' : ind;
            const url = `${API_BASE}/api/v1/exit-signal/macro/kr/export?period=${period}&industry=${queryInd}`;
            const res = await fetch(url, {
                cache: 'no-store',
                headers: { 'Cache-Control': 'no-cache' }
            });
            if (res.ok) {
                const json = await res.json();
                if (json && Array.isArray(json.data)) {
                    // Recharts의 Stacked Bar를 위해 각 업종 수치를 플랫 키로 매핑
                    const flattened: ExportItem[] = json.data.map((item: any) => {
                        const row: ExportItem = { ...item };
                        if (item.industries) {
                            Object.entries(item.industries).forEach(([k, v]: [string, any]) => {
                                (row as any)[`ind_${k}`] = v.amt ?? (v.daily_avg ?? 0);
                            });
                        }
                        return row;
                    });
                    setExportData(flattened);
                }
                if (json && Array.isArray(json.industries_meta) && json.industries_meta.length > 0) {
                    setIndustriesMeta(json.industries_meta);
                }
            }
        } catch (err) {
            console.error(`Failed to fetch KR export (${period}, ${ind}):`, err);
        } finally {
            setExportLoading(false);
        }
    }, []);

    // 초기 마운트 시 로컬스토리지 복원 및 API 호출
    useEffect(() => {
        try {
            const cached = localStorage.getItem('kr_macro_cache_v1');
            if (cached) {
                const parsed = JSON.parse(cached);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    setKrData(parsed);
                    setLoading(false);
                }
            }
        } catch {
            // ignore
        }
        fetchKrMacroData(false);
        fetchExportData('monthly', selectedIndustry);
    }, [fetchKrMacroData, fetchExportData, selectedIndustry]);

    // 수출 주기 탭 변경 시 호출
    const handlePeriodChange = (p: ExportPeriod) => {
        setExportPeriod(p);
        fetchExportData(p, exportViewMode === 'industry' ? selectedIndustry : 'all');
    };

    // 보기 모드 변경 (전체 수출 ↔ 6대 업종별)
    const handleViewModeChange = (mode: ExportViewMode) => {
        setExportViewMode(mode);
        if (mode === 'total') {
            fetchExportData(exportPeriod, 'all');
        } else {
            fetchExportData(exportPeriod, selectedIndustry);
        }
    };

    // 업종 선택 칩 클릭
    const handleIndustrySelect = (indId: string) => {
        setSelectedIndustry(indId);
        fetchExportData(exportPeriod, indId);
    };


    // 최신값 및 상태 계산
    const latestCycle = useMemo(() => {
        const withCycle = krData.filter(d => d.leading_cycle !== null);
        if (withCycle.length === 0) return null;
        const cur = withCycle[withCycle.length - 1];
        const prev = withCycle.length > 1 ? withCycle[withCycle.length - 2] : null;
        const diff = prev && cur.leading_cycle && prev.leading_cycle ? cur.leading_cycle - prev.leading_cycle : 0;
        return {
            date: cur.date,
            val: cur.leading_cycle,
            diff,
            isAbove100: (cur.leading_cycle ?? 100) >= 100,
        };
    }, [krData]);

    const latestOECD = useMemo(() => {
        const withOECD = krData.filter(d => d.oecd_cli !== null);
        if (withOECD.length === 0) return null;
        const cur = withOECD[withOECD.length - 1];
        const prev = withOECD.length > 1 ? withOECD[withOECD.length - 2] : null;
        const diff = prev && cur.oecd_cli && prev.oecd_cli ? cur.oecd_cli - prev.oecd_cli : 0;
        return {
            date: cur.date,
            val: cur.oecd_cli,
            diff,
            isAbove100: (cur.oecd_cli ?? 100) >= 100,
        };
    }, [krData]);

    // 경기 국면 진단 판정 (선행지수 순환변동치 100 기준 및 방향성)
    const cyclePhase = useMemo(() => {
        if (!latestCycle || latestCycle.val === null) return null;
        const val = latestCycle.val;
        const diff = latestCycle.diff;
        if (val >= 100 && diff >= 0) {
            return { name: '경기 확장 (Expansion)', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', desc: '기준선 100 상회 및 전월비 상승세 지속으로 국내 경기 활황 국면입니다.' };
        }
        if (val >= 100 && diff < 0) {
            return { name: '경기 둔화 (Slowdown)', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20', desc: '기준선 100 상회 중이나 상승 탄력 둔화로 정점 통과 후 조정을 시사합니다.' };
        }
        if (val < 100 && diff <= 0) {
            return { name: '경기 수축 (Contraction)', color: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/20', desc: '기준선 100 하회 및 하락세로 실물 경기 위축 및 재고 조정 국면입니다.' };
        }
        return { name: '경기 회복 (Recovery)', color: 'text-sky-400', bg: 'bg-sky-500/10 border-sky-500/20', desc: '기준선 100 하회권이나 저점을 통과하여 반등을 시작하는 국면입니다.' };
    }, [latestCycle]);

    // 기간 필터링된 선행지표 차트 데이터
    const filteredCycleData = useMemo(() => {
        if (krData.length === 0) return [];
        const monthsCount = timeframe === '1Y' ? 12 : timeframe === '3Y' ? 36 : timeframe === '5Y' ? 60 : 120;
        return krData.slice(-monthsCount);
    }, [krData, timeframe]);

    // 수출 최신 요약 (전체 및 6대 업종별 동적 집계)
    const latestExportSummary = useMemo(() => {
        if (exportData.length === 0) return null;
        const cur = exportData[exportData.length - 1];

        // 특정 단일 업종 선택 시 해당 업종 통계
        const activeMeta = industriesMeta.find(m => m.id === selectedIndustry);
        let selectedIndStat = null;
        if (activeMeta && cur.industries && cur.industries[activeMeta.id]) {
            const indCur = cur.industries[activeMeta.id];
            selectedIndStat = {
                id: activeMeta.id,
                name: activeMeta.name,
                shortName: activeMeta.short_name,
                color: activeMeta.color,
                desc: activeMeta.desc,
                amt: indCur.amt ?? indCur.daily_avg ?? 0,
                share: indCur.share,
                yoy: indCur.yoy ?? null,
            };
        }

        // 스택 모드 시 1위 업종 계산
        let topIndustry = null;
        if (cur.industries) {
            const sorted = Object.entries(cur.industries).sort((a, b) => (b[1].share ?? 0) - (a[1].share ?? 0));
            if (sorted.length > 0) {
                const [topId, topData] = sorted[0];
                const meta = industriesMeta.find(m => m.id === topId);
                topIndustry = {
                    id: topId,
                    name: meta?.name ?? topId,
                    shortName: meta?.short_name ?? topId,
                    color: meta?.color ?? '#38bdf8',
                    amt: topData.amt ?? topData.daily_avg ?? 0,
                    share: topData.share,
                    yoy: topData.yoy ?? null,
                };
            }
        }

        return {
            date: cur.date,
            amt: cur.export_amt ?? null,
            yoy: cur.export_yoy ?? null,
            dailyAvg: cur.export_daily_avg ?? null,
            isProjected: cur.is_projected,
            selectedIndStat,
            topIndustry,
        };
    }, [exportData, selectedIndustry, industriesMeta]);

    // 3. 현재 타겟 업종 (스택 모드 시 최신 1위 주력군, 개별 업종 선택 시 해당 업종)
    const activePlaybookIndustry = useMemo(() => {
        if (selectedIndustry !== 'stacked') return selectedIndustry;
        return latestExportSummary?.topIndustry?.id || 'semiconductor';
    }, [selectedIndustry, latestExportSummary]);

    const activePlaybookMeta = useMemo(() => {
        return industriesMeta.find(m => m.id === activePlaybookIndustry) || industriesMeta[0];
    }, [industriesMeta, activePlaybookIndustry]);

    // 4. 수혜 ETF 플레이북 데이터 로드
    const fetchPlaybook = useCallback(async (ind: string) => {
        try {
            setPlaybookLoading(true);
            const res = await fetch(`${API_BASE}/api/v1/exit-signal/macro/kr/sector-playbook?industry=${ind}`, {
                cache: 'no-store',
                headers: { 'Cache-Control': 'no-cache' }
            });
            if (res.ok) {
                const json = await res.json();
                if (Array.isArray(json.etfs)) {
                    setPlaybookEtfs(json.etfs);
                }
            }
        } catch (err) {
            console.error('Failed to fetch sector playbook:', err);
        } finally {
            setPlaybookLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchPlaybook(activePlaybookIndustry);
    }, [activePlaybookIndustry, fetchPlaybook]);

    // ETF 상세 모달 열기 커스텀 이벤트
    const handleOpenEtfDetail = (code: string) => {
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('open_etf_detail', { detail: { code } }));
        }
    };

    // 텔레그램 속보 발송 및 실제 서비스 데이터 실시간 갱신
    const triggerFlashAlert = async () => {
        try {
            setFlashAlertLoading(true);
            setFlashAlertFeedback(null);
            const res = await fetch(`${API_BASE}/api/v1/exit-signal/macro/kr/trigger-flash-alert?force=true`, {
                method: 'POST',
            });
            if (res.ok) {
                const data = await res.json();
                if (data.status === 'success') {
                    setFlashAlertFeedback('✅ 텔레그램 속보 발송 및 서비스 DB 실시간 갱신 완료!');
                } else if (data.status === 'partial') {
                    setFlashAlertFeedback('✅ 서비스 DB 최신 데이터 동기화 완료! (텔레그램 설정 필요)');
                } else {
                    setFlashAlertFeedback(data.message ? `ℹ️ ${data.message}` : '✅ 데이터 갱신 완료!');
                }
                fetchKrMacroData(true);
                fetchExportData(exportPeriod, selectedIndustry);
                fetchPlaybook(activePlaybookIndustry);
            } else {
                setFlashAlertFeedback('⚠️ 알림 발송 중 오류가 발생했습니다.');
            }
        } catch (err) {
            setFlashAlertFeedback('⚠️ 네트워크 오류가 발생했습니다.');
        } finally {
            setFlashAlertLoading(false);
            setTimeout(() => setFlashAlertFeedback(null), 5000);
        }
    };



    return (
        <div className="w-full flex flex-col gap-4 mt-2 mb-4">
            {/* 1. 상단 섹션 헤더 (한국 경기 지표) */}
            <div
                id="kr-economy-title"
                className="scroll-mt-28 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-blue-950/40 via-indigo-950/30 to-black/30 p-4 lg:p-5 rounded-2xl border border-blue-500/20 backdrop-blur-md w-full shadow-lg"
            >
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 via-indigo-500 to-sky-400 flex items-center justify-center shadow-lg shadow-blue-500/25 shrink-0">
                        <Activity className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <div className="flex flex-wrap items-center gap-2.5">
                            <h2 className="text-xl font-extrabold text-white tracking-tight">한국 경기 지표</h2>
                            <span className="text-[10px] font-bold text-sky-400 bg-sky-500/10 border border-sky-400/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                                <Sparkles className="w-3 h-3" />
                                경기 순환 & 수출입
                            </span>
                        </div>
                        <p className="text-xs text-slate-300 font-medium mt-0.5">
                            통계청 경기선행종합지수 순환변동치 · OECD 한국 CLI 및 대한민국 수출입 사이클 추이
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 self-end md:self-center">
                    <button
                        onClick={() => {
                            fetchKrMacroData(true);
                            fetchExportData(exportPeriod);
                        }}
                        disabled={refreshing}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 active:scale-95 border border-blue-400/30 text-xs font-semibold text-blue-200 hover:text-white transition-all disabled:opacity-50"
                        title="한국은행 ECOS, 통계청, OECD 최신 데이터 강제 동기화"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 text-sky-400 ${refreshing ? 'animate-spin' : ''}`} />
                        <span>{refreshing ? '최신화 중...' : '최신 동기화'}</span>
                    </button>
                </div>
            </div>

            {/* 2. 핵심 컨텐츠 그리드 (선행지표 비교 + 수출 추이 2단 배치) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

                {/* 컨텐츠 1: 한국 선행지수 순환변동치 vs OECD 한국 선행지수 */}
                <div className="bg-[#121217]/70 border border-white/10 rounded-2xl p-4 lg:p-5 backdrop-blur-md shadow-xl flex flex-col justify-between">
                    <div>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                            <div>
                                <h3 className="text-base font-bold text-white flex items-center gap-2">
                                    <TrendingUp className="w-4 h-4 text-sky-400" />
                                    선행지수 순환변동치 & OECD CLI
                                </h3>
                                <p className="text-[11px] text-gray-400 mt-0.5">
                                    100p 기준선 상회 시 확장, 하회 시 수축 국면을 나타냅니다.
                                </p>
                            </div>

                            {/* 기간 선택 버튼 (1Y, 3Y, 5Y, 10Y) */}
                            <div className="flex bg-black/40 rounded-lg p-0.5 border border-white/10 shrink-0 self-start sm:self-auto">
                                {(['1Y', '3Y', '5Y', '10Y'] as Timeframe[]).map(tf => (
                                    <button
                                        key={tf}
                                        onClick={() => setTimeframe(tf)}
                                        className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all ${
                                            timeframe === tf
                                                ? 'bg-blue-600 text-white shadow-sm'
                                                : 'text-gray-400 hover:text-white'
                                        }`}
                                    >
                                        {tf}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* 요약 스탯 카드 2종 (통계청 vs OECD) */}
                        <div className="grid grid-cols-2 gap-2.5 mb-3">
                            {/* 통계청 선행지수 순환변동치 */}
                            <div className="bg-blue-950/20 border border-blue-500/20 rounded-xl p-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-[11px] font-semibold text-sky-300">통계청 선행 순환변동치</span>
                                    {latestCycle && (
                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                            latestCycle.diff >= 0 ? 'bg-sky-500/20 text-sky-300' : 'bg-rose-500/20 text-rose-300'
                                        }`}>
                                            {latestCycle.diff >= 0 ? `+${latestCycle.diff.toFixed(1)}p` : `${latestCycle.diff.toFixed(1)}p`}
                                        </span>
                                    )}
                                </div>
                                <div className="text-xl font-black text-white font-mono mt-1">
                                    {latestCycle?.val !== null && latestCycle?.val !== undefined ? `${latestCycle.val.toFixed(1)}p` : 'N/A'}
                                </div>
                                <div className="text-[10px] text-gray-400 mt-1 flex items-center justify-between">
                                    <span>기준 100 {latestCycle?.isAbove100 ? '상회 (확장)' : '하회 (수축)'}</span>
                                    <span className="font-mono text-gray-500">{latestCycle?.date}</span>
                                </div>
                            </div>

                            {/* OECD 한국 선행지수 */}
                            <div className="bg-indigo-950/20 border border-indigo-500/20 rounded-xl p-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-[11px] font-semibold text-indigo-300">OECD 한국 CLI</span>
                                    {latestOECD && (
                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                            latestOECD.diff >= 0 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                                        }`}>
                                            {latestOECD.diff >= 0 ? `+${latestOECD.diff.toFixed(2)}p` : `${latestOECD.diff.toFixed(2)}p`}
                                        </span>
                                    )}
                                </div>
                                <div className="text-xl font-black text-white font-mono mt-1">
                                    {latestOECD?.val !== null && latestOECD?.val !== undefined ? `${latestOECD.val.toFixed(2)}p` : 'N/A'}
                                </div>
                                <div className="text-[10px] text-gray-400 mt-1 flex items-center justify-between">
                                    <span>장기 추세 {latestOECD?.isAbove100 ? '상회' : '하회'}</span>
                                    <span className="font-mono text-gray-500">{latestOECD?.date}</span>
                                </div>
                            </div>
                        </div>

                        {/* 범례 토글 버튼 */}
                        <div className="flex items-center gap-3 mb-2 text-xs">
                            <button
                                onClick={() => setVisibleSeries(prev => ({ ...prev, cycle: !prev.cycle }))}
                                className={`flex items-center gap-1.5 px-2 py-0.5 rounded transition ${
                                    visibleSeries.cycle ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30' : 'text-gray-500 opacity-60'
                                }`}
                            >
                                <span className="w-2.5 h-0.5 bg-sky-400 rounded-full" />
                                <span className="font-medium text-[11px]">선행지수 순환변동치(통계청)</span>
                            </button>
                            <button
                                onClick={() => setVisibleSeries(prev => ({ ...prev, oecd: !prev.oecd }))}
                                className={`flex items-center gap-1.5 px-2 py-0.5 rounded transition ${
                                    visibleSeries.oecd ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'text-gray-500 opacity-60'
                                }`}
                            >
                                <span className="w-2.5 h-0.5 bg-indigo-400 rounded-full border-t border-dashed" />
                                <span className="font-medium text-[11px]">OECD 한국 CLI</span>
                            </button>
                        </div>

                        {/* 시계열 차트 (선행지표 비교) */}
                        <div className="w-full h-[230px] bg-black/20 rounded-xl border border-white/5 p-2 relative">
                            {loading ? (
                                <div className="absolute inset-0 flex items-center justify-center text-xs text-gray-400">
                                    <RefreshCw className="w-4 h-4 animate-spin text-sky-400 mr-2" />
                                    지표 로드 중...
                                </div>
                            ) : (
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={filteredCycleData} margin={{ top: 10, right: 12, left: -22, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                                        <XAxis
                                            dataKey="date"
                                            stroke="#64748b"
                                            tick={{ fontSize: 10, fill: '#94a3b8' }}
                                            tickFormatter={(v: string) => v.slice(2)}
                                        />
                                        <YAxis
                                            stroke="#64748b"
                                            domain={['auto', 'auto']}
                                            tick={{ fontSize: 10, fill: '#94a3b8' }}
                                            tickFormatter={(v: number) => v.toFixed(0)}
                                        />
                                        <Tooltip
                                            contentStyle={{
                                                backgroundColor: 'rgba(15, 23, 42, 0.95)',
                                                border: '1px solid rgba(255,255,255,0.15)',
                                                borderRadius: '8px',
                                                fontSize: '11px',
                                                color: '#f8fafc',
                                            }}
                                            formatter={(value: any, name: string) => {
                                                const v = Number(value);
                                                const diff100 = (v - 100).toFixed(2);
                                                const sign = Number(diff100) > 0 ? `(+${diff100}p)` : `(${diff100}p)`;
                                                return [`${v.toFixed(2)}p ${sign}`, name];
                                            }}
                                        />
                                        {/* 기준선 100 */}
                                        <ReferenceLine
                                            y={100}
                                            stroke="#94a3b8"
                                            strokeDasharray="4 4"
                                            strokeWidth={1.5}
                                            label={{ value: '기준 100', position: 'insideTopRight', fill: '#94a3b8', fontSize: 10 }}
                                        />
                                        {visibleSeries.cycle && (
                                            <Line
                                                type="monotone"
                                                name="선행지수 순환변동치"
                                                dataKey="leading_cycle"
                                                stroke="#38bdf8"
                                                strokeWidth={2.2}
                                                dot={false}
                                                activeDot={{ r: 4, fill: '#38bdf8' }}
                                            />
                                        )}
                                        {visibleSeries.oecd && (
                                            <Line
                                                type="monotone"
                                                name="OECD CLI Korea"
                                                dataKey="oecd_cli"
                                                stroke="#818cf8"
                                                strokeWidth={1.8}
                                                strokeDasharray="4 3"
                                                dot={false}
                                                activeDot={{ r: 4, fill: '#818cf8' }}
                                            />
                                        )}
                                    </LineChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                    </div>

                    {/* 하단 국면 해설 배너 */}
                    {cyclePhase && (
                        <div className={`mt-3 p-2.5 rounded-xl border ${cyclePhase.bg} text-xs flex items-center justify-between gap-2`}>
                            <div className="flex items-center gap-2">
                                <span className={`font-bold ${cyclePhase.color} shrink-0`}>
                                    ● {cyclePhase.name}
                                </span>
                                <span className="text-[11px] text-gray-300 line-clamp-1">{cyclePhase.desc}</span>
                            </div>
                            <span className="text-[10px] text-gray-400 shrink-0 font-mono">출처: KOSIS · FRED</span>
                        </div>
                    )}
                </div>

                {/* 컨텐츠 2: 한국 수출 그래프 추이 (전체 / 6대 업종별 & 년 / 월간 / 일별 탭) */}
                <div className="bg-[#121217]/70 border border-white/10 rounded-2xl p-4 lg:p-5 backdrop-blur-md shadow-xl flex flex-col justify-between">
                    <div>
                        {/* 상단 제목 및 컨트롤 바 */}
                        <div className="flex flex-col gap-2 mb-3">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        <h3 className="text-base font-bold text-white flex items-center gap-1.5 whitespace-nowrap shrink-0">
                                            <BarChart3 className="w-4 h-4 text-indigo-400 shrink-0" />
                                            <span>대한민국 수출 실적 추이</span>
                                        </h3>
                                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-indigo-500/15 border border-indigo-400/30 text-indigo-300 whitespace-nowrap shrink-0">
                                            {exportViewMode === 'total' ? '총수출' : '6대 업종'}
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-gray-400 mt-0.5 truncate">
                                        {exportViewMode === 'total'
                                            ? '관세청 및 한국은행 공표 통관 기준 수출 실적 및 YoY 증감률'
                                            : '한국은행 KSIC 및 관세청 MTI 기준 핵심 주력 산업별 실적 분해'}
                                    </p>
                                </div>

                                {/* 우측: [전체 / 6대 업종] 보기 모드 스위처 & [년 / 월간 / 일별] 주기 탭 */}
                                <div className="flex items-center gap-1 shrink-0 self-start sm:self-auto">
                                    {/* 1. 보기 모드 (전체 ↔ 6대 업종) */}
                                    <div className="flex bg-black/50 rounded-lg p-0.5 border border-white/10">
                                        <button
                                            onClick={() => handleViewModeChange('total')}
                                            className={`px-2 py-0.5 text-[11px] font-medium rounded-md transition-all ${
                                                exportViewMode === 'total'
                                                    ? 'bg-indigo-600 text-white shadow-sm'
                                                    : 'text-gray-400 hover:text-white'
                                            }`}
                                        >
                                            전체
                                        </button>
                                        <button
                                            onClick={() => handleViewModeChange('industry')}
                                            className={`flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-md transition-all ${
                                                exportViewMode === 'industry'
                                                    ? 'bg-indigo-600 text-white shadow-sm'
                                                    : 'text-gray-400 hover:text-white'
                                            }`}
                                        >
                                            <Layers className="w-2.5 h-2.5" />
                                            <span>6대 업종</span>
                                        </button>
                                    </div>

                                    {/* 2. 주기 탭 (년 / 월간 / 일별) */}
                                    <div className="flex bg-black/40 rounded-lg p-0.5 border border-white/10">
                                        <button
                                            onClick={() => handlePeriodChange('yearly')}
                                            className={`px-2 py-0.5 text-[11px] font-medium rounded-md transition-all ${
                                                exportPeriod === 'yearly'
                                                    ? 'bg-white/20 text-white'
                                                    : 'text-gray-400 hover:text-white'
                                            }`}
                                        >
                                            년
                                        </button>
                                        <button
                                            onClick={() => handlePeriodChange('monthly')}
                                            className={`px-2 py-0.5 text-[11px] font-medium rounded-md transition-all ${
                                                exportPeriod === 'monthly'
                                                    ? 'bg-white/20 text-white'
                                                    : 'text-gray-400 hover:text-white'
                                            }`}
                                        >
                                            월간
                                        </button>
                                        <button
                                            onClick={() => handlePeriodChange('daily')}
                                            className={`px-2 py-0.5 text-[11px] font-medium rounded-md transition-all ${
                                                exportPeriod === 'daily'
                                                    ? 'bg-white/20 text-white'
                                                    : 'text-gray-400 hover:text-white'
                                            }`}
                                        >
                                            일별
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* 6대 업종별 모드 시 가로 칩 스위처 (flex-wrap 및 콤팩트 칩으로 전원 노출) */}
                            {exportViewMode === 'industry' && (
                                <div className="flex items-center gap-1 flex-wrap pt-0.5">
                                    <button
                                        onClick={() => handleIndustrySelect('stacked')}
                                        className={`flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-medium shrink-0 transition-all ${
                                            selectedIndustry === 'stacked'
                                                ? 'bg-indigo-500/25 border-indigo-400/50 text-white shadow-sm'
                                                : 'bg-white/5 border-white/10 text-gray-400 hover:text-white hover:bg-white/10'
                                        }`}
                                    >
                                        <Layers className="w-3 h-3 text-indigo-400" />
                                        <span>누적(Stack)</span>
                                    </button>

                                    {industriesMeta.map(ind => {
                                        const isSelected = selectedIndustry === ind.id;
                                        return (
                                            <button
                                                key={ind.id}
                                                onClick={() => handleIndustrySelect(ind.id)}
                                                title={ind.name}
                                                className={`flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-medium shrink-0 transition-all ${
                                                    isSelected
                                                        ? 'text-white shadow-sm'
                                                        : 'bg-white/5 border-white/10 text-gray-400 hover:text-white hover:bg-white/10'
                                                }`}
                                                style={{
                                                    backgroundColor: isSelected ? `${ind.color}25` : undefined,
                                                    borderColor: isSelected ? ind.color : undefined,
                                                }}
                                            >
                                                <span
                                                    className="w-1.5 h-1.5 rounded-full shrink-0"
                                                    style={{ backgroundColor: ind.color }}
                                                />
                                                <span>{ind.short_name || ind.name}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* 요약 스탯 카드 (모드 및 선택 업종별 동적 바인딩) */}
                        <div className="grid grid-cols-3 gap-2 mb-3">
                            {/* 카드 1: 금액 */}
                            <div className="bg-white/5 border border-white/5 rounded-xl p-2.5">
                                <span className="text-[10px] text-gray-400">
                                    {exportViewMode === 'total' || selectedIndustry === 'stacked'
                                        ? (exportPeriod === 'yearly' ? '연간 총수출액' : exportPeriod === 'daily' ? '최근 일평균' : '최근 월간 수출액')
                                        : `${latestExportSummary?.selectedIndStat?.shortName ?? '업종'} 수출액`}
                                </span>
                                <div className="text-lg font-black text-white font-mono mt-0.5">
                                    {exportViewMode === 'total' || selectedIndustry === 'stacked'
                                        ? (latestExportSummary?.amt !== null ? `${latestExportSummary?.amt}억$` : 'N/A')
                                        : `${latestExportSummary?.selectedIndStat?.amt ?? 0}억$`}
                                </div>
                                <span className="text-[10px] text-gray-500 font-mono">
                                    {latestExportSummary?.date} 기준
                                    {latestExportSummary?.isProjected ? ' (추정)' : ''}
                                </span>
                            </div>

                            {/* 카드 2: 성장률(YoY) */}
                            <div className="bg-white/5 border border-white/5 rounded-xl p-2.5">
                                <span className="text-[10px] text-gray-400">
                                    {exportViewMode === 'total' || selectedIndustry === 'stacked'
                                        ? '전체 수출 YoY'
                                        : `${latestExportSummary?.selectedIndStat?.shortName ?? '업종'} 증감률 (YoY)`}
                                </span>
                                {(() => {
                                    const yoyVal = (exportViewMode === 'total' || selectedIndustry === 'stacked')
                                        ? latestExportSummary?.yoy
                                        : latestExportSummary?.selectedIndStat?.yoy;
                                    const isPositive = (yoyVal ?? 0) >= 0;
                                    return (
                                        <div className={`text-lg font-black font-mono mt-0.5 flex items-center gap-0.5 ${
                                            isPositive ? 'text-emerald-400' : 'text-rose-400'
                                        }`}>
                                            {isPositive ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                                            {yoyVal !== null && yoyVal !== undefined ? `${yoyVal > 0 ? `+${yoyVal}` : yoyVal}%` : 'N/A'}
                                        </div>
                                    );
                                })()}
                                <span className="text-[10px] text-gray-500">전년동기대비</span>
                            </div>

                            {/* 카드 3: 비중 또는 일평균 */}
                            <div className="bg-white/5 border border-white/5 rounded-xl p-2.5">
                                <span className="text-[10px] text-gray-400">
                                    {exportViewMode === 'total'
                                        ? '조업일수 감안 일평균'
                                        : selectedIndustry === 'stacked'
                                        ? '수출 1위 주력군'
                                        : '한국 전체 수출 중 비중'}
                                </span>
                                <div className="text-lg font-black font-mono mt-0.5">
                                    {exportViewMode === 'total' ? (
                                        <span className="text-sky-400">
                                            {latestExportSummary?.dailyAvg !== null ? `${latestExportSummary?.dailyAvg}억$` : 'N/A'}
                                        </span>
                                    ) : selectedIndustry === 'stacked' ? (
                                        <span className="text-sky-300 flex items-center gap-1.5 text-base sm:text-lg">
                                            <span
                                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                                style={{ backgroundColor: latestExportSummary?.topIndustry?.color ?? '#38bdf8' }}
                                            />
                                            <span className="truncate">{latestExportSummary?.topIndustry?.name ?? '반도체·IT'}</span>
                                        </span>
                                    ) : (
                                        <span
                                            className="font-bold"
                                            style={{ color: latestExportSummary?.selectedIndStat?.color ?? '#38bdf8' }}
                                        >
                                            {latestExportSummary?.selectedIndStat?.share ?? 0}%
                                        </span>
                                    )}
                                </div>
                                <span className="text-[10px] text-gray-500">
                                    {exportViewMode === 'total'
                                        ? '일당 평균 실적'
                                        : selectedIndustry === 'stacked'
                                        ? `점유율 ${latestExportSummary?.topIndustry?.share ?? 0}%`
                                        : `한국 6대 수출군 내`}
                                </span>
                            </div>
                        </div>

                        {/* 수출 차트 렌더링 */}
                        <div className="w-full h-[230px] bg-black/20 rounded-xl border border-white/5 p-2 relative">
                            {exportLoading ? (
                                <div className="absolute inset-0 flex items-center justify-center text-xs text-gray-400">
                                    <RefreshCw className="w-4 h-4 animate-spin text-indigo-400 mr-2" />
                                    수출 데이터 로드 중...
                                </div>
                            ) : (
                                <ResponsiveContainer width="100%" height="100%">
                                    {exportPeriod === 'daily' ? (
                                        /* 1. 일별 일평균 라인 차트 */
                                        <LineChart data={exportData} margin={{ top: 10, right: 12, left: -22, bottom: 5 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                                            <XAxis
                                                dataKey="date"
                                                stroke="#64748b"
                                                tick={{ fontSize: 9, fill: '#94a3b8' }}
                                                tickFormatter={(v: string) => v.slice(2)}
                                            />
                                            <YAxis
                                                stroke="#64748b"
                                                domain={['auto', 'auto']}
                                                tick={{ fontSize: 10, fill: '#94a3b8' }}
                                                unit="억$"
                                            />
                                            <Tooltip
                                                contentStyle={{
                                                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                                                    border: '1px solid rgba(255,255,255,0.15)',
                                                    borderRadius: '8px',
                                                    fontSize: '11px',
                                                    color: '#f8fafc',
                                                }}
                                                formatter={(val: any) => [`${val}억 달러/일`, '일평균 수출액']}
                                            />
                                            <Line
                                                type="monotone"
                                                name="일평균 수출액"
                                                dataKey="export_daily_avg"
                                                stroke="#38bdf8"
                                                strokeWidth={2}
                                                dot={{ r: 2, fill: '#38bdf8' }}
                                                activeDot={{ r: 4 }}
                                            />
                                        </LineChart>
                                    ) : exportViewMode === 'industry' && selectedIndustry === 'stacked' ? (
                                        /* 2. 업종별 누적 스택 막대 차트 (Stacked Bar + YoY 라인) */
                                        <ComposedChart data={exportData} margin={{ top: 10, right: 12, left: 2, bottom: 5 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                                            <XAxis
                                                dataKey="date"
                                                stroke="#64748b"
                                                tick={{ fontSize: 10, fill: '#94a3b8' }}
                                                tickFormatter={(v: string) => (exportPeriod === 'yearly' ? v : v.slice(2))}
                                            />
                                            <YAxis
                                                yAxisId="left"
                                                stroke="#64748b"
                                                width={42}
                                                domain={['auto', 'auto']}
                                                tick={{ fontSize: 10, fill: '#94a3b8' }}
                                                tickFormatter={(v: number) => `${Math.round(v)}`}
                                                unit="억$"
                                            />

                                            <YAxis
                                                yAxisId="right"
                                                orientation="right"
                                                stroke="#64748b"
                                                domain={['auto', 'auto']}
                                                tick={{ fontSize: 10, fill: '#94a3b8' }}
                                                unit="%"
                                            />
                                            <Tooltip
                                                content={({ active, payload, label }) => {
                                                    if (!active || !payload || payload.length === 0) return null;
                                                    const row = payload[0].payload as ExportItem;
                                                    return (
                                                        <div className="bg-slate-900/95 border border-white/15 rounded-xl p-3 shadow-2xl text-[11px] text-white min-w-[210px]">
                                                            <div className="flex items-center justify-between border-b border-white/10 pb-1.5 mb-2">
                                                                <span className="font-bold text-sky-300">{label}</span>
                                                                <span className="font-mono text-gray-300">
                                                                    총 {row.export_amt?.toLocaleString()}억$
                                                                    {row.export_yoy !== null && row.export_yoy !== undefined
                                                                        ? ` (${row.export_yoy > 0 ? `+${row.export_yoy}` : row.export_yoy}%)`
                                                                        : ''}
                                                                </span>
                                                            </div>
                                                            <div className="flex flex-col gap-1.5">
                                                                {industriesMeta.map(ind => {
                                                                    const d = row.industries?.[ind.id];
                                                                    return (
                                                                        <div key={ind.id} className="flex items-center justify-between gap-3">
                                                                            <div className="flex items-center gap-1.5">
                                                                                <span
                                                                                    className="w-2 h-2 rounded-full shrink-0"
                                                                                    style={{ backgroundColor: ind.color }}
                                                                                />
                                                                                <span className="text-gray-300 text-[10px]">{ind.name}</span>
                                                                            </div>
                                                                            <span className="font-mono text-[10px] text-white">
                                                                                {d ? `${d.amt.toLocaleString()}억$ (${d.share}%)` : '-'}
                                                                            </span>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    );
                                                }}
                                            />
                                            {/* 6대 업종 누적 막대 (하단부터 누적) */}
                                            <Bar yAxisId="left" stackId="exportStack" dataKey="ind_semiconductor" fill="#38bdf8" name="반도체·IT" />
                                            <Bar yAxisId="left" stackId="exportStack" dataKey="ind_auto" fill="#6366f1" name="자동차·운송" />
                                            <Bar yAxisId="left" stackId="exportStack" dataKey="ind_petrochem" fill="#f59e0b" name="석유화학·정유" />
                                            <Bar yAxisId="left" stackId="exportStack" dataKey="ind_machinery" fill="#10b981" name="일반기계" />
                                            <Bar yAxisId="left" stackId="exportStack" dataKey="ind_steel" fill="#94a3b8" name="철강·금속" />
                                            <Bar yAxisId="left" stackId="exportStack" dataKey="ind_bio_battery" fill="#ec4899" name="바이오·배터리" radius={[3, 3, 0, 0]} />

                                            {/* 전체 수출 증감률 선 */}
                                            <Line
                                                yAxisId="right"
                                                type="monotone"
                                                name="수출 증감률 (YoY)"
                                                dataKey="export_yoy"
                                                stroke="#34d399"
                                                strokeWidth={2}
                                                dot={{ r: 2.5, fill: '#34d399' }}
                                                activeDot={{ r: 4.5 }}
                                            />
                                        </ComposedChart>
                                    ) : exportViewMode === 'industry' && selectedIndustry !== 'stacked' ? (
                                        /* 3. 특정 단일 업종 막대 + 해당 업종 YoY 라인 차트 */
                                        <ComposedChart data={exportData} margin={{ top: 10, right: 12, left: 2, bottom: 5 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                                            <XAxis
                                                dataKey="date"
                                                stroke="#64748b"
                                                tick={{ fontSize: 10, fill: '#94a3b8' }}
                                                tickFormatter={(v: string) => (exportPeriod === 'yearly' ? v : v.slice(2))}
                                            />
                                            <YAxis
                                                yAxisId="left"
                                                stroke="#64748b"
                                                width={42}
                                                domain={['auto', 'auto']}
                                                tick={{ fontSize: 10, fill: '#94a3b8' }}
                                                tickFormatter={(v: number) => `${Math.round(v)}`}
                                                unit="억$"
                                            />
                                            <YAxis
                                                yAxisId="right"
                                                orientation="right"
                                                stroke="#64748b"
                                                domain={['auto', 'auto']}
                                                tick={{ fontSize: 10, fill: '#94a3b8' }}
                                                unit="%"
                                            />
                                            <Tooltip
                                                contentStyle={{
                                                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                                                    border: '1px solid rgba(255,255,255,0.15)',
                                                    borderRadius: '8px',
                                                    fontSize: '11px',
                                                    color: '#f8fafc',
                                                }}
                                                formatter={(val: any, name: string) => {
                                                    if (name.includes('증감률') || name.includes('YoY')) {
                                                        const num = Number(val);
                                                        return [`${num > 0 ? `+${num}` : num}%`, name];
                                                    }
                                                    return [`${Number(val).toLocaleString()}억 달러`, name];
                                                }}
                                            />
                                            <Bar
                                                yAxisId="left"
                                                name={`${latestExportSummary?.selectedIndStat?.name ?? '업종'} 수출액`}
                                                dataKey="selected_industry_amt"
                                                fill={latestExportSummary?.selectedIndStat?.color ?? '#6366f1'}
                                                radius={[4, 4, 0, 0]}
                                                opacity={0.9}
                                            />
                                            <Line
                                                yAxisId="right"
                                                type="monotone"
                                                name={`${latestExportSummary?.selectedIndStat?.shortName ?? '업종'} YoY`}
                                                dataKey="selected_industry_yoy"
                                                stroke="#34d399"
                                                strokeWidth={2}
                                                dot={{ r: 2.5, fill: '#34d399' }}
                                                activeDot={{ r: 4.5 }}
                                            />
                                        </ComposedChart>
                                    ) : (
                                        /* 4. 전체 수출액 막대 + 전체 YoY 라인 차트 */
                                        <ComposedChart data={exportData} margin={{ top: 10, right: 12, left: 2, bottom: 5 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                                            <XAxis
                                                dataKey="date"
                                                stroke="#64748b"
                                                tick={{ fontSize: 10, fill: '#94a3b8' }}
                                                tickFormatter={(v: string) => (exportPeriod === 'yearly' ? v : v.slice(2))}
                                            />
                                            <YAxis
                                                yAxisId="left"
                                                stroke="#64748b"
                                                width={42}
                                                domain={['auto', 'auto']}
                                                tick={{ fontSize: 10, fill: '#94a3b8' }}
                                                tickFormatter={(v: number) => `${Math.round(v)}`}
                                                unit="억$"
                                            />

                                            <YAxis
                                                yAxisId="right"
                                                orientation="right"
                                                stroke="#64748b"
                                                domain={['auto', 'auto']}
                                                tick={{ fontSize: 10, fill: '#94a3b8' }}
                                                unit="%"
                                            />
                                            <Tooltip
                                                contentStyle={{
                                                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                                                    border: '1px solid rgba(255,255,255,0.15)',
                                                    borderRadius: '8px',
                                                    fontSize: '11px',
                                                    color: '#f8fafc',
                                                }}
                                                formatter={(val: any, name: string) => {
                                                    if (name.includes('증감률') || name.includes('YoY')) return [`${val}%`, name];
                                                    return [`${Number(val).toLocaleString()}억 달러`, name];
                                                }}
                                            />
                                            <Bar
                                                yAxisId="left"
                                                name={exportPeriod === 'yearly' ? '연간 수출 총액' : '월간 수출액'}
                                                dataKey="export_amt"
                                                fill="#6366f1"
                                                radius={[4, 4, 0, 0]}
                                                opacity={0.85}
                                            />
                                            <Line
                                                yAxisId="right"
                                                type="monotone"
                                                name="수출 증감률 (YoY)"
                                                dataKey="export_yoy"
                                                stroke="#34d399"
                                                strokeWidth={2}
                                                dot={{ r: 2.5, fill: '#34d399' }}
                                                activeDot={{ r: 4.5 }}
                                            />
                                        </ComposedChart>
                                    )}
                                </ResponsiveContainer>
                            )}
                        </div>
                    </div>

                    {/* 하단 설명 배너 */}
                    <div className="mt-3 p-2.5 rounded-xl border border-white/5 bg-black/20 text-xs flex items-center justify-between text-gray-400">
                        <div className="flex items-center gap-1.5">
                            <span
                                className="w-1.5 h-1.5 rounded-full shrink-0"
                                style={{
                                    backgroundColor: exportViewMode === 'industry' && selectedIndustry !== 'stacked'
                                        ? latestExportSummary?.selectedIndStat?.color ?? '#818cf8'
                                        : '#818cf8',
                                }}
                            />
                            <span className="text-[11px] text-gray-300">
                                {exportViewMode === 'industry' && selectedIndustry !== 'stacked'
                                    ? `${latestExportSummary?.selectedIndStat?.name}: ${latestExportSummary?.selectedIndStat?.desc}`
                                    : exportViewMode === 'industry'
                                    ? '6대 주력 산업군 누적 스택 (상단 칩을 클릭하여 개별 업종 심층 조회 가능)'
                                    : exportPeriod === 'yearly'
                                    ? '연간 통계 (현재 연도는 연환산 추정치 포함)'
                                    : exportPeriod === 'daily'
                                    ? '관세청 조업일수 감안 일평균 수출 모멘텀'
                                    : '월간 통관 실적 및 전년 동월 대비 성장률 추세'}
                            </span>
                        </div>
                        <span className="text-[10px] text-gray-500 font-mono">출처: 관세청 · 한국은행 ECOS</span>
                    </div>
                </div>

                {/* 3. 한국 수출 주력군 수혜 ETF 플레이북 (Sector Playbook) & 텔레그램 속보 */}
                <div className="bg-[#121217]/80 border border-white/10 rounded-2xl p-4 lg:p-5 backdrop-blur-md shadow-xl lg:col-span-2 flex flex-col gap-3.5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/5">
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="text-base font-bold text-white flex items-center gap-2 whitespace-nowrap">
                                    <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                                    <span>수출 주력군 수혜 ETF 플레이북</span>
                                </h3>
                                <span
                                    className="text-[10px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap flex items-center gap-1"
                                    style={{
                                        color: activePlaybookMeta.color,
                                        backgroundColor: `${activePlaybookMeta.color}15`,
                                        borderColor: `${activePlaybookMeta.color}35`,
                                    }}
                                >
                                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: activePlaybookMeta.color }} />
                                    {activePlaybookMeta.name} {selectedIndustry === 'stacked' ? '(수출 1위 주력군)' : '(선택 업종)'}
                                </span>
                                {cyclePhase && (
                                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-gray-300 whitespace-nowrap">
                                        현재 경기 {cyclePhase.name.split(' ')[1]}
                                    </span>
                                )}
                            </div>
                            <p className="text-[11px] text-gray-400 mt-1">
                                {activePlaybookMeta.desc} · 관세청 수출 모멘텀 및 경기 국면 연동 국내 상장 대표 ETF
                            </p>
                        </div>

                        {/* 우측: 텔레그램 속보 발송 & 데이터 실시간 갱신 수동 컨트롤러 */}
                        <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
                            {flashAlertFeedback && (
                                <span className="text-[11px] text-emerald-400 font-medium bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded-lg animate-pulse">
                                    {flashAlertFeedback}
                                </span>
                            )}
                            <button
                                onClick={triggerFlashAlert}
                                disabled={flashAlertLoading}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 active:scale-95 border border-sky-400/30 text-xs font-semibold text-sky-200 hover:text-white transition-all disabled:opacity-50"
                                title="관세청 최신 수출 통계 및 통계청 순환변동치를 즉시 재동기화하고 텔레그램 채널로 속보를 발송합니다"
                            >
                                <Send className={`w-3.5 h-3.5 text-sky-400 ${flashAlertLoading ? 'animate-bounce' : ''}`} />
                                <span>{flashAlertLoading ? '속보 발송 & 갱신 중...' : '텔레그램 속보 발송 & 데이터 갱신'}</span>
                            </button>
                        </div>
                    </div>

                    {/* 수혜 ETF 카드 그리드 */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {playbookLoading ? (
                            <div className="col-span-full py-8 text-center text-xs text-gray-400 flex items-center justify-center gap-2">
                                <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
                                수혜 ETF 플레이북 로드 중...
                            </div>
                        ) : playbookEtfs.length === 0 ? (
                            <div className="col-span-full py-6 text-center text-xs text-gray-500">
                                해당 업종에 등록된 플레이북 ETF가 없습니다.
                            </div>
                        ) : (
                            playbookEtfs.map(etf => (
                                <div
                                    key={etf.ticker}
                                    onClick={() => handleOpenEtfDetail(etf.ticker)}
                                    className="group relative p-3.5 rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.05] hover:border-indigo-400/40 transition-all cursor-pointer flex flex-col justify-between"
                                >
                                    <div>
                                        <div className="flex items-center justify-between gap-2 mb-1.5">
                                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/10 text-gray-300 font-semibold">
                                                {etf.ticker}
                                            </span>
                                            <span className="text-[10px] font-medium text-indigo-300 bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-400/20">
                                                {etf.category}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between gap-1">
                                            <h4 className="text-sm font-bold text-white group-hover:text-indigo-300 transition-colors line-clamp-1">
                                                {etf.name}
                                            </h4>
                                            <ExternalLink className="w-3.5 h-3.5 text-gray-500 group-hover:text-indigo-400 shrink-0 transition-colors" />
                                        </div>
                                        <p className="text-[11px] text-gray-300 font-medium mt-1">
                                            {etf.sub_theme}
                                        </p>
                                        <p className="text-[11px] text-gray-400 mt-2 leading-relaxed line-clamp-2">
                                            {etf.points}
                                        </p>
                                    </div>

                                    <div className="mt-3 pt-2.5 border-t border-white/5 flex items-center justify-between text-[10px]">
                                        <span className="text-gray-400 line-clamp-1 max-w-[70%]">
                                            💡 {etf.driver}
                                        </span>
                                        <span className="text-indigo-400 font-semibold group-hover:underline shrink-0">
                                            실시간 시세 보기 →
                                        </span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>


            </div>
        </div>
    );
}
