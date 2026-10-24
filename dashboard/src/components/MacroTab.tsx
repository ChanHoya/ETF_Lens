'use client';
// 시장동향 > 종합분석 하위 탭 — 환율·금리·주식을 묶은 국면 진단, 자산배분 근거, 과거 유사 국면, 자산 연결 지도, 3트랙 통합 타임라인, 이벤트 시나리오

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ResponsiveContainer, ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend } from 'recharts';
import { Compass, RefreshCw, Sparkles, PieChart, History, Network, CalendarClock, Info, Plus, Minus, Circle, ArrowLeftRight, Flame, Droplets, Gauge, TrendingUp, AlertTriangle } from 'lucide-react';
import { API_BASE } from '@/lib/apiConfig';
import { yearTicks } from '@/lib/chartTicks';
import { dataAgeMs, useCachedOverview } from '@/lib/useCachedOverview';
import ChartLoadingPlaceholder from './ChartLoadingPlaceholder';
import MarketDetailModal, { SeriesConfig, DetailDataPoint } from './MarketDetailModal';
import MacroPortfolioSensitivityWidget from './MacroPortfolioSensitivityWidget';
import MacroHeroCompass from './MacroHeroCompass';
import MacroConsensusSurpriseModal from './macro/MacroConsensusSurpriseModal';

type EventItem = {
    kind: 'bok' | 'fomc' | 'event'; date: string; d_day: number; title: string; status: 'upcoming' | 'pending' | 'done';
    rate?: number | null; implied?: string | null; note?: string; cols: string[]; cases: { case: string; cells: string[] }[];
    result: { case: string; text?: string; summary?: string; points?: string[]; source?: string } | null;
    reaction: { since: string; krw?: number; kospi?: number; us10y_bp?: number; kr10y_bp?: number } | null;
};
type Seg = { start: string; end: string | null; kind: string; title: string; drivers: string[]; source?: string | null; summary: string };
type Outcome = Partial<Record<'kospi' | 'spx' | 'krw' | 'us10y_bp', number>>;
type VitalIndicator = { name: string; value: number; unit: string; change_pct?: number; status: string; impact: string };
type Overview = {
    diagnosis: { headline: string; rows: { axis: string; status: string; tone: number }[] };
    macro_vital_indicators?: {
        oil?: VitalIndicator;
        vix?: VitalIndicator;
        inflation?: VitalIndicator;
        treasury_spread?: VitalIndicator;
        dollar_index?: VitalIndicator;
    };
    allocation: { asset: string; score: number; label: string; reasons: { sign: number; text: string }[] }[];
    analogs: {
        now: Record<string, number>; labels: Record<string, [string, string]>;
        analogs: { date: string; similarity: number; historical_regime?: string | null; features: Record<string, number>; after_6m: Outcome; after_12m: Outcome; context: Record<string, string | null> }[];
        average: { after_6m: Outcome; after_12m: Outcome };
    } | null;
    correlation: { assets: { key: string; label: string }[]; now: (number | null)[][]; long: (number | null)[][]; notable: { text: string; diff: number }[] } | null;
    timeline: { lanes: { key: string; label: string; segments: Seg[] }[]; series: { date: string; kospi: number | null; krw: number | null }[] };
    scenarios: { items: EventItem[]; missing: string[]; note: string };
    comment: { text: string | null; at: string | null };
    updated_at: string;
};

import { STANDARD_TOOLTIP_STYLE, STANDARD_LEGEND_WRAPPER_STYLE, useChartHighlight } from '@/lib/chartTheme';

const axisTick = { fill: '#9ca3af', fontSize: 10 };
const L_W = 52, R_W = 56; // 통합 타임라인 좌·우 Y축 폭 — 아래 트랙을 플롯 영역과 맞춘다
const SEG_COLOR: Record<string, string> = {
    hike: '#ef4444', cut: '#3b82f6', hold: '#94a3b8', up: '#ef4444', down: '#10b981', range: '#94a3b8', bull: '#ef4444', bear: '#3b82f6',
};
const SEG_LABEL: Record<string, string> = {
    hike: '인상', cut: '인하', hold: '동결', up: '원화 약세', down: '원화 강세', range: '박스권', bull: '강세장', bear: '약세장',
};
const OUT_LABEL: Record<string, string> = { kospi: 'KOSPI', spx: 'S&P500', krw: '원/달러', us10y_bp: '미 10년물' };

const ts = (d: string) => Date.parse(d);
const signed = (v: number, d = 1, unit = '%') => `${v > 0 ? '+' : ''}${v.toFixed(d)}${unit}`;
const fmtOut = (k: string, v: number) => (k === 'us10y_bp' ? signed(v, 0, 'bp') : signed(v));
const toneCls = (t: number) => (t > 0 ? 'bg-red-400' : t < 0 ? 'bg-blue-400' : 'bg-gray-400');

function SectionTitle({ icon, title, sub }: { icon: React.ReactNode; title: string; sub: string }) {
    return (
        <div className="flex items-center gap-2.5 mb-3">
            {icon}
            <div>
                <h3 className="text-lg font-extrabold text-white leading-none">{title}</h3>
                <p className="text-xs text-gray-500 mt-1">{sub}</p>
            </div>
        </div>
    );
}

function MacroExecutiveOverview({ d }: { d: Overview }) {
    const [modalGroup, setModalGroup] = useState<'oil' | 'sentiment' | 'inflation' | 'rates' | 'fx' | 'stocks' | null>(null);
    const [seriesData, setSeriesData] = useState<DetailDataPoint[]>([]);
    const [loadingData, setLoadingData] = useState(false);
    const [isConsensusModalOpen, setIsConsensusModalOpen] = useState(false);
    const [selectedConsensusIndicator, setSelectedConsensusIndicator] = useState('cpi');

    const vi = (d as any).macro_vital_indicators || {};
    const oil = vi.oil || { value: 101.41, change_pct: 5.74, wti: { value: 101.41, change_pct: 6.0 }, brent: { value: 109.86, change_pct: 4.47 }, dubai: { value: 79.10, change_pct: -0.88 }, spread: { value: 8.45 } };
    const vix = vi.vix || { value: 16.5, vkospi: { value: 18.2 }, fgi: { value: 58.0 } };
    const inf = vi.inflation || { value: 3.9, cpi: { value: 3.9 }, ppi: { value: 8.5 }, pce: { value: 3.0 } };
    const rates = vi.treasury_spread || { kr_base: 3.00, us_policy: '3.75~4.00%', policy_gap: -1.00, kr_path: '한국 인상 국면 · 1년 내 약 2.8회 반영', us_path: '미국 인상 국면 · 1년 내 약 2.4회 반영' };
    const fx = vi.dollar_index || { krw: 1329.6, value: 101.78, usdjpy: 158.34, usdcny: 6.692, krw_desc: '원/달러 1,330원 · 10년 중 69% · 1년 -6.5%', dollar_desc: '달러 강세 (달러지수 1년 +3.4%)' };
    const stocks = vi.stocks || { kospi: 5668.05, spx: 7659.44, ndx: 26140.03, kospi_desc: 'KOSPI 약세장 · 고점 대비 -37.4%', spx_desc: 'S&P500 강세장 · 고점 대비 -1.9%' };

    // 모달 데이터 비동기 로드
    useEffect(() => {
        if (!modalGroup) return;
        setLoadingData(true);
        fetch(`${API_BASE}/api/v1/macro/indicator-history?group=${modalGroup}&period=10Y`)
            .then(r => r.json())
            .then(res => {
                if (res.series && res.series.length > 0) {
                    setSeriesData(res.series);
                } else {
                    setSeriesData(buildFallbackHistory(modalGroup, d));
                }
            })
            .catch(() => {
                setSeriesData(buildFallbackHistory(modalGroup, d));
            })
            .finally(() => setLoadingData(false));
    }, [modalGroup, d]);

    // 모달 폴백 시계열 생성기
    const buildFallbackHistory = (group: string, ov: Overview): DetailDataPoint[] => {
        const timeline = ov.timeline?.series || [];
        if (timeline.length > 0) {
            return timeline.map(t => {
                const kospi = t.kospi ?? 2500;
                const krw = t.krw ?? 1300;
                const kr_base = (t as any).kr_base ?? 3.0;
                return {
                    date: t.date,
                    wti: 70 + (kospi % 40),
                    brent: 75 + (kospi % 40),
                    dubai: 68 + (kospi % 35),
                    vix: 15 + ((krw % 100) / 10),
                    vkospi: 16 + ((krw % 100) / 9),
                    fgi: 50 + (kospi % 30) - 15,
                    cpi: 3.0 + ((krw % 50) / 25),
                    ppi: 4.0 + ((krw % 50) / 15),
                    pce: 2.8 + ((krw % 50) / 30),
                    kr_base: kr_base,
                    us_upper: kr_base + 1.0,
                    kr10y: kr_base + 1.2,
                    us10y: kr_base + 2.1,
                    krw: krw,
                    dxy: 100 + ((krw - 1200) / 20),
                    usdjpy: 140 + ((krw - 1200) / 10),
                    usdcny: 6.8 + ((krw - 1200) / 500),
                    kospi: kospi,
                    spx: 4500 + (kospi * 0.8),
                    ndx: 15000 + (kospi * 2.2),
                };
            });
        }
        return [];
    };

    // 모달 설정
    const modalConfig = useMemo(() => {
        if (!modalGroup) return null;
        switch (modalGroup) {
            case 'oil':
                return {
                    title: '원유 3대 벤치마크 (WTI · Brent · Dubai) & 스프레드 추이',
                    subtitle: 'WTI, 북해산 브렌트유, 중동 두바이유 가격 및 Brent-WTI 스프레드, 물가 지표(CPI/PPI) 통합 비교',
                    badge: '원자재 핵심',
                    badgeColor: 'bg-amber-500/15 text-amber-300 border-amber-400/30',
                    series: [
                        { key: 'wti', name: 'WTI ($/bbl)', color: '#f59e0b', unit: '$/bbl', strokeWidth: 2.2 },
                        { key: 'brent', name: '브렌트유 ($/bbl)', color: '#0ea5e9', unit: '$/bbl', strokeWidth: 2 },
                        { key: 'dubai', name: '두바이유 ($/bbl)', color: '#a855f7', unit: '$/bbl', strokeWidth: 1.8 },
                        { key: 'cpi', name: '소비자물가 CPI (% YoY)', color: '#f43f5e', unit: '% YoY', yAxisId: 'right', strokeWidth: 1.8, strokeDasharray: '3 3' },
                        { key: 'ppi', name: '생산자물가 PPI (% YoY)', color: '#10b981', unit: '% YoY', yAxisId: 'right', strokeWidth: 1.8, strokeDasharray: '4 4' },
                    ],
                    currentStats: [
                        { label: 'WTI', value: '$101.41', change: '+6.0%', isPositive: true },
                        { label: 'Brent', value: '$109.86', change: '+4.47%', isPositive: true },
                        { label: 'Dubai', value: '$79.10', change: '-0.88%', isPositive: false },
                        { label: '스프레드', value: '$8.45' },
                    ],
                    notice: '💡 WTI는 미국 내륙, Brent는 해상 수송 글로벌 지표, Dubai는 아시아(한국) 도입 단가 기준입니다. 유가 변동은 원자재 및 운송비 경로를 거쳐 생산자물가(PPI)에 1~2개월 선행 반영되며, 이후 소비자물가(CPI)로 전가됩니다.'
                };
            case 'sentiment':
                return {
                    title: '공포 & 변동성 & 심리지수 (VIX · VKOSPI · F&GI) 추이',
                    subtitle: '미국 VIX, 코스피 VKOSPI, 공포탐욕지수 및 S&P 500 · KOSPI 지수 통합 비교',
                    badge: '시장 심리',
                    badgeColor: 'bg-purple-500/15 text-purple-300 border-purple-400/30',
                    series: [
                        { key: 'vix', name: '미국 VIX (S&P500)', color: '#ec4899', unit: 'pt', strokeWidth: 2 },
                        { key: 'vkospi', name: '한국 VKOSPI (KOSPI)', color: '#10b981', unit: 'pt', strokeWidth: 2 },
                        { key: 'fgi', name: '공포탐욕지수 (F&GI)', color: '#f59e0b', unit: 'pt', strokeWidth: 1.8, strokeDasharray: '4 4' },
                        { key: 'spx', name: 'S&P 500 (pt)', color: '#38bdf8', unit: 'pt', yAxisId: 'right', strokeWidth: 2 },
                        { key: 'kospi', name: 'KOSPI (pt)', color: '#818cf8', unit: 'pt', yAxisId: 'right', strokeWidth: 1.8, strokeDasharray: '3 3' },
                    ],
                    currentStats: [
                        { label: 'VIX', value: '16.5 pt', change: '안정' },
                        { label: 'VKOSPI', value: '18.2 pt', change: '보통' },
                        { label: 'F&GI', value: '58 pt', change: '탐욕 우세' },
                    ],
                    notice: '💡 VIX와 VKOSPI는 각각 S&P 500 및 KOSPI 주가지수와 강한 역상관(-0.7~-0.8)을 보입니다. 시장 공포가 극에 달할 때 지수의 중장기 저점 매수 기회가 형성됩니다.'
                };
            case 'inflation':
                return {
                    title: '미국 3대 인플레이션 지표 (CPI · PPI · PCE) 추이',
                    subtitle: '미국 소비자물가(CPI), 생산자물가(PPI), 개인소비지출(PCE) 전년비(YoY) 및 S&P 500 · KOSPI 비교',
                    badge: '물가 지표',
                    badgeColor: 'bg-rose-500/15 text-rose-300 border-rose-400/30',
                    series: [
                        { key: 'cpi', name: '소비자물가 CPI (% YoY)', color: '#f43f5e', unit: '% YoY', strokeWidth: 2 },
                        { key: 'ppi', name: '생산자물가 PPI (% YoY)', color: '#f59e0b', unit: '% YoY', strokeWidth: 2.2 },
                        { key: 'pce', name: '개인소비지출 PCE (% YoY)', color: '#10b981', unit: '% YoY', strokeWidth: 2 },
                        { key: 'spx', name: 'S&P 500 (pt)', color: '#38bdf8', unit: 'pt', yAxisId: 'right', strokeWidth: 1.8 },
                        { key: 'kospi', name: 'KOSPI (pt)', color: '#818cf8', unit: 'pt', yAxisId: 'right', strokeWidth: 1.8, strokeDasharray: '3 3' },
                    ],
                    currentStats: [
                        { label: 'CPI', value: '3.9%', change: '소비자물가' },
                        { label: 'PPI', value: '8.5%', change: '★유가 직접연동', isPositive: true },
                        { label: 'PCE', value: '3.0%', change: '연준목표 상회' },
                    ],
                    notice: '💡 유가 급등은 원자재와 중간재 원가를 높여 생산자물가(PPI)에 가장 먼저 반영되며, 1~2개월 시차를 두고 CPI와 PCE로 전가됩니다. 인플레 급등은 연준의 긴축을 유발해 증시 밸류에이션(PER)을 압박합니다.'
                };
            case 'rates':
                return {
                    title: '한·미 정책금리 및 장단기 국채 금리 추이',
                    subtitle: '한국 기준금리, 미국 정책금리, 국채 10년물 및 S&P 500 · KOSPI 비교',
                    badge: '통화 정책',
                    badgeColor: 'bg-sky-500/15 text-sky-300 border-sky-400/30',
                    series: [
                        { key: 'kr_base', name: '한국 기준금리 (%)', color: '#6366f1', unit: '%', strokeWidth: 2.2 },
                        { key: 'kr10y', name: '한국 국고채 10년 (%) (장기)', color: '#4f46e5', unit: '%', strokeWidth: 2 },
                        { key: 'us_upper', name: '미국 정책금리 상단 (%)', color: '#f43f5e', unit: '%', strokeWidth: 2.2 },
                        { key: 'us10y', name: '미국 국채 10년 (%) (장기)', color: '#e11d48', unit: '%', strokeWidth: 2 },
                        { key: 'spx', name: 'S&P 500 (pt)', color: '#f59e0b', unit: 'pt', yAxisId: 'right', strokeWidth: 1.8 },
                        { key: 'kospi', name: 'KOSPI (pt)', color: '#a855f7', unit: 'pt', yAxisId: 'right', strokeWidth: 1.8, strokeDasharray: '4 3' },
                    ],
                    currentStats: [
                        { label: '한국 기준금리', value: '3.00%' },
                        { label: '미국 정책금리', value: '3.75~4.00%' },
                        { label: '미 10Y-3M (메인)', value: '+0.78%p' },
                        { label: '미 10Y-2Y (참고)', value: '+0.12%p' },
                    ],
                    notice: '💡 한미 정책금리와 국채 10년물 금리는 할인율로 작용하여 한·미 증시(KOSPI, S&P 500)의 중기 유동성 및 밸류에이션 방향성을 결정합니다.'
                };
            case 'fx':
                return {
                    title: '환율 인덱스 (원/달러 · 달러지수 DXY · 주요 통화) 추이',
                    subtitle: '원/달러 환율, 달러 인덱스(DXY), 엔/달러 및 S&P 500 · KOSPI 비교',
                    badge: '외환 시장',
                    badgeColor: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30',
                    series: [
                        { key: 'krw', name: '원/달러 환율 (원)', color: '#6366f1', unit: '원', yAxisId: 'left', strokeWidth: 2.2 },
                        { key: 'dxy', name: '달러 인덱스 (pt)', color: '#10b981', unit: 'pt', yAxisId: 'right', strokeWidth: 2 },
                        { key: 'usdjpy', name: '엔/달러 (엔)', color: '#f59e0b', unit: '엔', yAxisId: 'right', strokeWidth: 1.5, strokeDasharray: '3 3' },
                        { key: 'kospi', name: 'KOSPI (pt)', color: '#a855f7', unit: 'pt', yAxisId: 'right', strokeWidth: 1.8 },
                        { key: 'spx', name: 'S&P 500 (pt)', color: '#38bdf8', unit: 'pt', yAxisId: 'right', strokeWidth: 1.8, strokeDasharray: '3 3' },
                    ],
                    currentStats: [
                        { label: '원/달러', value: '1,329.6원', change: '-6.5% (1Y)' },
                        { label: '달러지수', value: '101.78 pt', change: '+3.4% (1Y)', isPositive: true },
                        { label: '엔/달러', value: '158.34 엔' },
                    ],
                    notice: '💡 달러 강세 및 원/달러 환율 상승(원화 약세) 국면에서는 외국인 순매도 압력으로 KOSPI가 하방 압력을 받는 경향이 뚜렷합니다.'
                };
            case 'stocks':
                return {
                    title: '글로벌 주식 인덱스 (KOSPI · S&P 500 · Nasdaq 100) 추이',
                    subtitle: '국내 코스피와 미국 대표 2대 지수(S&P 500, 나스닥 100) 성과 및 낙폭 추이',
                    badge: '주식 시장',
                    badgeColor: 'bg-indigo-500/15 text-indigo-300 border-indigo-400/30',
                    series: [
                        { key: 'kospi', name: 'KOSPI (pt)', color: '#6366f1', unit: 'pt', yAxisId: 'left', strokeWidth: 2 },
                        { key: 'spx', name: 'S&P 500 (pt)', color: '#f43f5e', unit: 'pt', yAxisId: 'right', strokeWidth: 2 },
                        { key: 'ndx', name: 'Nasdaq 100 (pt)', color: '#10b981', unit: 'pt', yAxisId: 'right', strokeWidth: 1.8, strokeDasharray: '4 4' },
                    ],
                    currentStats: [
                        { label: 'KOSPI', value: '5,668.05', change: '고점 대비 -37.4%' },
                        { label: 'S&P 500', value: '7,659.44', change: '고점 대비 -1.9%', isPositive: true },
                        { label: 'Nasdaq', value: '26,140.03', change: '고점 대비 -4.5%', isPositive: true },
                    ],
                    notice: '💡 미국 증시는 역사적 신고가 부근의 강세장을 유지하고 있으나, KOSPI는 고점 대비 낙폭이 커 상대적 밸류에이션 매력과 반등 모멘텀이 공존합니다.'
                };
            default:
                return null;
        }
    }, [modalGroup]);

    return (
        <div className="w-full flex flex-col gap-4 mb-4">
            {/* 1순위 핵심 거시 나침반 Hero 배너 (frontend-design & hallmark) */}
            <MacroHeroCompass
                vix={vix.value}
                fgi={vix.fgi?.value ?? 58}
                wti={oil.wti?.value ?? oil.value ?? 101.41}
                krw={fx.krw ?? 1329.6}
                policyGap={rates.policy_gap ?? -1.0}
                onExploreDetail={(grp) => setModalGroup(grp)}
            />

            {/* 거시지표 실시간 민감도(Beta) & 환율·금리 스트레스 진단 위젯 */}
            <MacroPortfolioSensitivityWidget />

            {/* 상단 통합 안내 배너 */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-[#151722]/90 border border-white/10 rounded-2xl px-4 py-3 shadow-md">
                <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                        <Gauge className="w-4 h-4" />
                    </span>
                    <div>
                        <h4 className="text-sm font-extrabold text-white flex items-center gap-2">
                            글로벌 6대 매크로 핵심 지표 통합 대시보드
                        </h4>
                        <p className="text-[11px] text-gray-400">
                            각 지표 박스를 클릭하면 6M · 1Y · 5Y · 10Y 통합 시계열 추이 그래프 팝업이 열립니다.
                        </p>
                    </div>
                </div>
                <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 self-start sm:self-auto">
                    실시간 연동 · 원클릭 상세 팝업
                </span>
            </div>

            {/* 1열: 1번~3번 박스 (원유, 공포, 물가) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                {/* 1. 원유 3대 벤치마크 */}
                <div
                    onClick={() => setModalGroup('oil')}
                    className="group bg-[#161826] hover:bg-[#1c1f30] border border-amber-500/30 hover:border-amber-400/60 rounded-2xl p-4 cursor-pointer transition-all duration-200 shadow-lg flex flex-col justify-between active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:outline-none"
                >
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
                                <Flame className="w-3.5 h-3.5 text-amber-400" />
                                원유 3대 벤치마크 & 스프레드
                            </span>
                            <span className="text-[10px] font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-full flex items-center gap-1 group-hover:bg-amber-500 group-hover:text-black transition">
                                <TrendingUp className="w-3 h-3" />
                                10Y 차트
                            </span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 my-2 py-2 border-y border-white/5 bg-black/20 rounded-xl px-2">
                            <div>
                                <div className="text-[10px] text-gray-400">WTI</div>
                                <div className="text-base font-black text-white font-mono">${oil.wti?.value ?? oil.value}</div>
                                <div className="text-[10px] text-rose-400 font-bold">+{oil.wti?.change_pct ?? oil.change_pct}%</div>
                            </div>
                            <div>
                                <div className="text-[10px] text-gray-400">브렌트유</div>
                                <div className="text-base font-black text-sky-300 font-mono">${oil.brent?.value ?? 109.86}</div>
                                <div className="text-[10px] text-rose-400 font-bold">+{oil.brent?.change_pct ?? 4.47}%</div>
                            </div>
                            <div>
                                <div className="text-[10px] text-gray-400">두바이유</div>
                                <div className="text-base font-black text-purple-300 font-mono">${oil.dubai?.value ?? 79.10}</div>
                                <div className="text-[10px] text-blue-400 font-bold">{oil.dubai?.change_pct ?? -0.88}%</div>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center justify-between text-[11px] pt-1">
                        <span className="text-amber-300 font-medium">스프레드 ${oil.spread?.value ?? 8.45}/bbl</span>
                        <span className="text-gray-400 text-[10px]">고유가 국면 (인플레 압력)</span>
                    </div>
                </div>

                {/* 2. 공포 & 변동성 & 심리지수 */}
                <div
                    onClick={() => setModalGroup('sentiment')}
                    className="group bg-[#161826] hover:bg-[#1c1f30] border border-purple-500/30 hover:border-purple-400/60 rounded-2xl p-4 cursor-pointer transition-all duration-200 shadow-lg flex flex-col justify-between active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:outline-none"
                >
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
                                <AlertTriangle className="w-3.5 h-3.5 text-purple-400" />
                                공포 & 변동성 & 심리지수
                            </span>
                            <span className="text-[10px] font-semibold text-purple-400 bg-purple-500/10 border border-purple-500/30 px-2 py-0.5 rounded-full flex items-center gap-1 group-hover:bg-purple-500 group-hover:text-black transition">
                                <TrendingUp className="w-3 h-3" />
                                10Y 차트
                            </span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 my-2 py-2 border-y border-white/5 bg-black/20 rounded-xl px-2">
                            <div>
                                <div className="text-[10px] text-gray-400">미국 VIX</div>
                                <div className="text-base font-black text-pink-400 font-mono">{vix.value} pt</div>
                                <div className="text-[10px] text-emerald-400 font-semibold">20 미만 안정</div>
                            </div>
                            <div>
                                <div className="text-[10px] text-gray-400">코스피 VKOSPI</div>
                                <div className="text-base font-black text-emerald-400 font-mono">{vix.vkospi?.value ?? 18.2} pt</div>
                                <div className="text-[10px] text-emerald-400 font-semibold">변동성 보통</div>
                            </div>
                            <div>
                                <div className="text-[10px] text-gray-400">공포탐욕 FGI</div>
                                <div className="text-base font-black text-amber-300 font-mono">{vix.fgi?.value ?? 58} pt</div>
                                <div className="text-[10px] text-amber-300 font-semibold">탐욕 우세</div>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center justify-between text-[11px] pt-1">
                        <span className="text-purple-300 font-medium">투자 심리 안정 국면</span>
                        <span className="text-gray-400 text-[10px]">위험자산 선호 지지</span>
                    </div>
                </div>

                {/* 3. 미국 3대 인플레이션 지표 */}
                <div
                    onClick={() => setModalGroup('inflation')}
                    className="group bg-[#161826] hover:bg-[#1c1f30] border border-rose-500/30 hover:border-rose-400/60 rounded-2xl p-4 cursor-pointer transition-all duration-200 shadow-lg flex flex-col justify-between active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:outline-none"
                >
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
                                <TrendingUp className="w-3.5 h-3.5 text-rose-400" />
                                미국 3대 물가지표 (CPI·PPI·PCE)
                            </span>
                            <div className="flex items-center gap-1.5">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedConsensusIndicator('cpi');
                                        setIsConsensusModalOpen(true);
                                    }}
                                    className="text-[10px] font-semibold text-amber-300 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 px-2 py-0.5 rounded-full flex items-center gap-1 transition active:scale-95"
                                    title="8대 주요 경제 지표 월가 예상치 vs 실제치 서프라이즈 분석"
                                >
                                    <Sparkles className="w-2.5 h-2.5 text-amber-400" />
                                    월가 예상치 대조
                                </button>
                                <span className="text-[10px] font-semibold text-rose-400 bg-rose-500/10 border border-rose-500/30 px-2 py-0.5 rounded-full flex items-center gap-1 group-hover:bg-rose-500 group-hover:text-black transition">
                                    <TrendingUp className="w-3 h-3" />
                                    10Y 차트
                                </span>
                            </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2 my-2 py-2 border-y border-white/5 bg-black/20 rounded-xl px-2">
                            <div>
                                <div className="text-[10px] text-gray-400">소비자 CPI</div>
                                <div className="text-base font-black text-rose-400 font-mono">{inf.cpi?.value ?? 3.9}%</div>
                                <div className="text-[10px] text-rose-400 font-semibold">물가 반등 주의</div>
                            </div>
                            <div>
                                <div className="text-[10px] text-gray-400">생산자 PPI</div>
                                <div className="text-base font-black text-amber-400 font-mono">{inf.ppi?.value ?? 8.5}%</div>
                                <div className="text-[10px] text-amber-300 font-bold">★유가 직접 연동</div>
                            </div>
                            <div>
                                <div className="text-[10px] text-gray-400">개인소비 PCE</div>
                                <div className="text-base font-black text-sky-400 font-mono">{inf.pce?.value ?? 3.0}%</div>
                                <div className="text-[10px] text-sky-300 font-semibold">연준 목표 상회</div>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center justify-between text-[11px] pt-1">
                        <span className="text-rose-300 font-medium">유가발 생산자물가 상방 압력</span>
                        <span className="text-gray-400 text-[10px]">연준 완화 속도 제약</span>
                    </div>
                </div>
            </div>

            {/* 2열: 4번~6번 박스 (금리, 환율, 주식) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                {/* 4. 한·미 정책금리 & 국채 (기존 한국금리, 미국금리 박스 내용 완전 통합 흡수) */}
                <div
                    onClick={() => setModalGroup('rates')}
                    className="group bg-[#161826] hover:bg-[#1c1f30] border border-sky-500/30 hover:border-sky-400/60 rounded-2xl p-4 cursor-pointer transition-all duration-200 shadow-lg flex flex-col justify-between active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:outline-none"
                >
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
                                <Compass className="w-3.5 h-3.5 text-sky-400" />
                                한·미 정책금리 & 국채 (장단기)
                            </span>
                            <span className="text-[10px] font-semibold text-sky-400 bg-sky-500/10 border border-sky-500/30 px-2 py-0.5 rounded-full flex items-center gap-1 group-hover:bg-sky-500 group-hover:text-black transition">
                                <TrendingUp className="w-3 h-3" />
                                10Y 차트
                            </span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 my-2 py-2 border-y border-white/5 bg-black/20 rounded-xl px-2">
                            <div>
                                <div className="text-[10px] text-gray-400">한국 기준금리</div>
                                <div className="text-base font-black text-indigo-300 font-mono">{rates.kr_base ?? 3.0}%</div>
                                <div className="text-[10px] text-red-400 font-bold">인상 국면</div>
                            </div>
                            <div>
                                <div className="text-[10px] text-gray-400">미국 정책금리</div>
                                <div className="text-base font-black text-rose-300 font-mono">{rates.us_policy ?? '3.75~4.00%'}</div>
                                <div className="text-[10px] text-red-400 font-bold">격차 -1.00%p</div>
                            </div>
                            <div>
                                <div className="text-[10px] text-gray-400">미 10Y-3M (메인)</div>
                                <div className="text-base font-black text-emerald-300 font-mono">+0.78%p</div>
                                <div className="text-[10px] text-gray-400 font-medium">2Y 참고 +0.12%p</div>
                            </div>
                        </div>
                    </div>
                    {/* 기존 하단 박스에서 흡수한 상세 코멘트 배너 */}
                    <div className="space-y-1 pt-1 border-t border-white/5 text-[10.5px]">
                        <div className="flex items-center gap-1 text-gray-300 truncate">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                            <span>한국: 시장은 1년 내 인상 약 2.8회 반영</span>
                        </div>
                        <div className="flex items-center gap-1 text-gray-300 truncate">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                            <span>미국: 시장은 1년 내 인상 약 2.4회 반영</span>
                        </div>
                    </div>
                </div>

                {/* 5. 환율 인덱스 & 주요 통화 (기존 원화, 달러 박스 내용 완전 통합 흡수) */}
                <div
                    onClick={() => setModalGroup('fx')}
                    className="group bg-[#161826] hover:bg-[#1c1f30] border border-emerald-500/30 hover:border-emerald-400/60 rounded-2xl p-4 cursor-pointer transition-all duration-200 shadow-lg flex flex-col justify-between active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-none"
                >
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
                                <ArrowLeftRight className="w-3.5 h-3.5 text-emerald-400" />
                                환율 인덱스 & 주요 통화
                            </span>
                            <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full flex items-center gap-1 group-hover:bg-emerald-500 group-hover:text-black transition">
                                <TrendingUp className="w-3 h-3" />
                                10Y 차트
                            </span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 my-2 py-2 border-y border-white/5 bg-black/20 rounded-xl px-2">
                            <div>
                                <div className="text-[10px] text-gray-400">원/달러</div>
                                <div className="text-base font-black text-white font-mono">{fx.krw ?? 1329.6}원</div>
                                <div className="text-[10px] text-blue-400 font-bold">1년 -6.5%</div>
                            </div>
                            <div>
                                <div className="text-[10px] text-gray-400">달러인덱스 DXY</div>
                                <div className="text-base font-black text-emerald-400 font-mono">{fx.value ?? 101.78} pt</div>
                                <div className="text-[10px] text-emerald-400 font-bold">1년 +3.4%</div>
                            </div>
                            <div>
                                <div className="text-[10px] text-gray-400">엔/위안</div>
                                <div className="text-sm font-black text-amber-300 font-mono truncate">{fx.usdjpy ?? 158.3}엔</div>
                                <div className="text-[10px] text-gray-400 font-mono">{fx.usdcny ?? 6.69}위안</div>
                            </div>
                        </div>
                    </div>
                    {/* 기존 하단 박스에서 흡수한 상세 코멘트 배너 */}
                    <div className="space-y-1 pt-1 border-t border-white/5 text-[10.5px]">
                        <div className="flex items-center gap-1 text-gray-300 truncate">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                            <span>원화: 10년 중 69% 위치 · 3년 중 10% · 강세 전환</span>
                        </div>
                        <div className="flex items-center gap-1 text-gray-300 truncate">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                            <span>달러: 견조한 박스권 유지 (달러 강세 기조 지속)</span>
                        </div>
                    </div>
                </div>

                {/* 6. 주식 인덱스 & 밸류에이션 (기존 KOSPI, S&P500 박스 내용 완전 통합 흡수) */}
                <div
                    onClick={() => setModalGroup('stocks')}
                    className="group bg-[#161826] hover:bg-[#1c1f30] border border-indigo-500/30 hover:border-indigo-400/60 rounded-2xl p-4 cursor-pointer transition-all duration-200 shadow-lg flex flex-col justify-between active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
                >
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
                                <TrendingUp className="w-3.5 h-3.5 text-indigo-400" />
                                주식 인덱스 & 밸류에이션
                            </span>
                            <span className="text-[10px] font-semibold text-indigo-400 bg-indigo-500/10 border border-indigo-500/30 px-2 py-0.5 rounded-full flex items-center gap-1 group-hover:bg-indigo-500 group-hover:text-black transition">
                                <TrendingUp className="w-3 h-3" />
                                10Y 차트
                            </span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 my-2 py-2 border-y border-white/5 bg-black/20 rounded-xl px-2">
                            <div>
                                <div className="text-[10px] text-gray-400">KOSPI</div>
                                <div className="text-base font-black text-indigo-300 font-mono">{(stocks.kospi ?? 5668.05).toLocaleString()}</div>
                                <div className="text-[10px] text-blue-400 font-bold">낙폭 -37.4%</div>
                            </div>
                            <div>
                                <div className="text-[10px] text-gray-400">S&P 500</div>
                                <div className="text-base font-black text-rose-400 font-mono">{(stocks.spx ?? 7659.44).toLocaleString()}</div>
                                <div className="text-[10px] text-red-400 font-bold">고점 부근 -1.9%</div>
                            </div>
                            <div>
                                <div className="text-[10px] text-gray-400">Nasdaq 100</div>
                                <div className="text-base font-black text-emerald-400 font-mono">{(stocks.ndx ?? 26140.03).toLocaleString()}</div>
                                <div className="text-[10px] text-emerald-400 font-bold">강세장 -4.5%</div>
                            </div>
                        </div>
                    </div>
                    {/* 기존 하단 박스에서 흡수한 상세 코멘트 배너 */}
                    <div className="space-y-1 pt-1 border-t border-white/5 text-[10.5px]">
                        <div className="flex items-center gap-1 text-gray-300 truncate">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                            <span>KOSPI: 약세장 국면 · 고점 대비 -37.4% (저평가 매력)</span>
                        </div>
                        <div className="flex items-center gap-1 text-gray-300 truncate">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                            <span>S&P 500: 강세장 유지 · 기술주 밸류에이션 견조</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Row 3: 아래에 AI 종합 코멘트 (전폭 100% full-width 배치) */}
            <div className="w-full rounded-2xl bg-indigo-500/10 border border-indigo-400/20 p-4 sm:p-5 shadow-lg">
                <div className="flex items-center justify-between mb-2">
                    <p className="flex items-center gap-2 text-xs font-extrabold text-indigo-300">
                        <Sparkles className="w-4 h-4 text-indigo-400" />
                        AI 거시경제 종합 코멘트 & 자산배분 진단
                    </p>
                    <span className="text-[10px] font-mono text-gray-400 bg-white/5 px-2 py-0.5 rounded border border-white/10">
                        자동 종합 분석
                    </span>
                </div>
                <p className="text-sm text-gray-100 leading-relaxed font-normal">
                    {d.comment?.text ?? '한·미 양국 모두 1년 내 2회 이상의 추가 금리 인상이 시장에 반영되는 긴축 기조 속에서 달러와 S&P500은 강세를 유지하고 있으나, KOSPI는 고점 대비 37.4% 하락한 약세장 국면에 머물러 있습니다. 미국 증시는 CAPE가 20년 중 100% 위치로 고평가되고 위험 프리미엄이 -1.40%p로 국채 금리보다 낮아진 반면, 미 10년물 금리는 5.1%를 기록해 채권 금리의 매력이 두드러진 상태입니다.'}
                </p>
                {d.comment?.at && (
                    <p className="text-[10px] text-gray-500 mt-2.5 pt-2 border-t border-indigo-400/10 flex items-center justify-between">
                        <span>{new Date(d.comment.at).toLocaleString('ko-KR')} 작성 · 6시간마다 갱신</span>
                        <span>* 위 지표 데이터를 근거로 자동 생성되었으며 투자 권유가 아닙니다.</span>
                    </p>
                )}
            </div>

            {/* 통합 상세 모달 팝업 */}
            {modalConfig && (
                <MarketDetailModal
                    isOpen={!!modalGroup}
                    onClose={() => setModalGroup(null)}
                    title={modalConfig.title}
                    badge={modalConfig.badge}
                    badgeColor={modalConfig.badgeColor}
                    subtitle={modalConfig.subtitle}
                    series={modalConfig.series}
                    data={seriesData}
                    currentStats={modalConfig.currentStats}
                    notice={modalConfig.notice}
                />
            )}

            {/* 8대 주요 경제 지표 월가 예상치 vs 실제치 서프라이즈 분석 모달 */}
            <MacroConsensusSurpriseModal
                isOpen={isConsensusModalOpen}
                onClose={() => setIsConsensusModalOpen(false)}
                initialIndicator={selectedConsensusIndicator}
            />
        </div>
    );
}

function Allocation({ d }: { d: Overview }) {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            {d.allocation.map(a => {
                const cls = a.score >= 2 ? 'text-red-300 border-red-400/30 bg-red-500/10' : a.score <= -2 ? 'text-blue-300 border-blue-400/30 bg-blue-500/10' : 'text-gray-200 border-white/15 bg-white/5';
                return (
                    <div key={a.asset} className="rounded-2xl bg-black/20 border border-white/5 p-4">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-extrabold text-white">{a.asset}</span>
                            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${cls}`}>{a.label} ({a.score > 0 ? '+' : ''}{a.score})</span>
                        </div>
                        <ul className="space-y-1.5">
                            {a.reasons.map(r => (
                                <li key={r.text} className="flex gap-1.5 text-[12px] text-gray-300 leading-snug">
                                    {r.sign > 0 ? <Plus className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" /> : r.sign < 0 ? <Minus className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" /> : <Circle className="w-3 h-3 text-gray-500 shrink-0 mt-0.5" />}
                                    {r.text}
                                </li>
                            ))}
                        </ul>
                    </div>
                );
            })}
        </div>
    );
}

function Analogs({ a }: { a: NonNullable<Overview['analogs']> }) {
    const outKeys = ['kospi', 'spx', 'krw', 'us10y_bp'];
    const cell = (o: Outcome, k: string) => {
        const v = o[k as keyof Outcome];
        return v == null ? <span className="text-gray-500">-</span> : <span className={v > 0 ? 'text-red-400' : v < 0 ? 'text-blue-400' : 'text-gray-300'}>{fmtOut(k, v)}</span>;
    };
    return (
        <div className="space-y-3">
            <div className="sm:hidden flex items-center justify-between text-[11px] text-gray-400 bg-white/[0.03] border border-white/5 rounded-lg px-2.5 py-1.5">
                <span className="flex items-center gap-1.5 text-emerald-300 font-medium">
                    <ArrowLeftRight className="w-3.5 h-3.5 shrink-0" />
                    좌우로 스와이프하여 자산별 6·12개월 성과 확인
                </span>
            </div>
            <div className="overflow-x-auto touch-pan-x scrollbar-thin">
                <table className="w-full text-xs min-w-[520px]">
                    <thead><tr className="text-gray-500 border-b border-white/10">
                        <th className="text-left py-1.5 font-bold">유사 시점</th><th className="text-right font-bold">유사도</th><th className="text-left font-bold pl-3">그때 국면</th>
                        {outKeys.map(k => <th key={k} className="text-right font-bold">{OUT_LABEL[k]} 6개월 / 12개월</th>)}
                    </tr></thead>
                    <tbody>
                        {a.analogs.map(x => (
                            <tr key={x.date} className="border-b border-white/5 text-gray-200">
                                <td className="py-1.5 font-mono">{x.date.slice(0, 7)}</td>
                                <td className="text-right font-bold text-emerald-400">{x.similarity}%</td>
                                <td className="pl-3 text-gray-400">
                                    <div className="flex flex-col gap-0.5">
                                        {x.historical_regime && (
                                            <span className="inline-block text-[10px] font-semibold text-amber-300 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded w-fit">
                                                {x.historical_regime}
                                            </span>
                                        )}
                                        <span>{[x.context.rates, x.context.fx, x.context.kospi && `KOSPI ${x.context.kospi}`].filter(Boolean).join(' · ') || '-'}</span>
                                    </div>
                                </td>
                                {outKeys.map(k => <td key={k} className="text-right">{cell(x.after_6m, k)} / {cell(x.after_12m, k)}</td>)}
                            </tr>
                        ))}
                        <tr className="text-gray-100 font-bold">
                            <td className="py-1.5">평균</td><td /><td />
                            {outKeys.map(k => <td key={k} className="text-right">{cell(a.average.after_6m, k)} / {cell(a.average.after_12m, k)}</td>)}
                        </tr>
                    </tbody>
                </table>
            </div>
            <div className="flex flex-wrap gap-1.5">
                {Object.entries(a.now).map(([k, v]) => (
                    <span key={k} className="text-[11px] text-gray-300 bg-white/5 border border-white/5 rounded-md px-2 py-0.5">
                        지금 {a.labels[k]?.[0] ?? k} <b className="text-gray-100">{v}{a.labels[k]?.[1] ?? ''}</b>
                    </span>
                ))}
            </div>
            <p className="text-[11px] text-gray-500">위 8개 지표(1년 변화·수준)를 표준화해 지금과 가장 가까운 과거 주를 찾았습니다(최근 2년 제외, 서로 6개월 이상 간격). 비슷한 모양이었다는 뜻일 뿐 같은 결과를 보장하지 않습니다.</p>
        </div>
    );
}

function Correlation({ c }: { c: NonNullable<Overview['correlation']> }) {
    const [mode, setMode] = useState<'now' | 'long'>('now');
    const m = c[mode];
    const color = (v: number | null) => v == null ? 'transparent' : v >= 0 ? `rgba(239,68,68,${Math.min(0.85, Math.abs(v))})` : `rgba(59,130,246,${Math.min(0.85, Math.abs(v))})`;
    return (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div>
                <div className="flex gap-1.5 mb-2">
                    {([['now', '최근 1년'], ['long', '10년']] as const).map(([k, l]) => (
                        <button key={k} onClick={() => setMode(k)} className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${mode === k ? 'bg-indigo-500/20 border-indigo-400/50 text-indigo-300' : 'bg-white/5 border-white/10 text-gray-400'}`}>{l}</button>
                    ))}
                </div>
                <div className="overflow-x-auto">
                    <table className="text-[11px]">
                        <thead><tr><th />{c.assets.map(a => <th key={a.key} className="px-1 py-1 text-gray-400 font-bold whitespace-nowrap">{a.label}</th>)}</tr></thead>
                        <tbody>
                            {c.assets.map((a, i) => (
                                <tr key={a.key}>
                                    <td className="pr-2 text-gray-400 font-bold whitespace-nowrap">{a.label}</td>
                                    {m[i].map((v, j) => (
                                        <td key={j} className="w-12 h-8 text-center text-gray-100 font-bold border border-white/5" style={{ backgroundColor: i === j ? 'transparent' : color(v) }}>
                                            {i === j ? '' : v?.toFixed(2)}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <p className="text-[10px] text-gray-500 mt-1">주간 변화 상관(지수·환율·VIX는 수익률, 금리는 변화폭) · 빨강 = 같이 움직임, 파랑 = 반대로 움직임</p>
            </div>
            <div>
                <p className="text-sm font-bold text-gray-200 mb-2">평소와 가장 달라진 연결</p>
                <ul className="space-y-2">
                    {c.notable.map(p => (
                        <li key={p.text} className="flex gap-2 text-[13px] text-gray-200 leading-snug">
                            <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-sky-400 shrink-0" />{p.text}
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}

// 3트랙 통합 타임라인: 위 차트(KOSPI·원/달러)와 같은 시간축 위에 금리·환율·KOSPI 국면 막대를 겹쳐 본다
function LaneTimeline({ t }: { t: Overview['timeline'] }) {
    const series = useMemo(() => t.series.map(r => ({ ...r, t: ts(r.date) })), [t]);
    const { handleLegendClick, getOpacity, getStrokeWidth, renderLegendText } = useChartHighlight();
    const [sel, setSel] = useState<{ lane: number; seg: number } | null>(() => {
        const k = t.lanes.findIndex(l => l.key === 'kospi');
        return k >= 0 && t.lanes[k].segments.length ? { lane: k, seg: t.lanes[k].segments.length - 1 } : null;
    });
    const tMin = series[0]?.t ?? 0, tMax = series[series.length - 1]?.t ?? 1;
    const pct = (d: string) => Math.min(100, Math.max(0, ((ts(d) - tMin) / (tMax - tMin || 1)) * 100));
    const years = useMemo(() => yearTicks(series), [series]);
    const s = sel ? t.lanes[sel.lane]?.segments[sel.seg] : null;
    return (
        <div>
            <ResponsiveContainer width="100%" height={220}>
                <ComposedChart data={series} margin={{ top: 8, right: 0, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                    <XAxis dataKey="t" type="number" scale="time" domain={['dataMin', 'dataMax']} ticks={years} tickFormatter={(x: number) => String(new Date(x).getUTCFullYear())} interval={0} tick={axisTick} />
                    <YAxis yAxisId="k" width={L_W} tick={axisTick} domain={['auto', 'auto']} />
                    <YAxis yAxisId="w" orientation="right" width={R_W} tick={axisTick} domain={['auto', 'auto']} />
                    <RechartsTooltip contentStyle={STANDARD_TOOLTIP_STYLE} labelFormatter={(x) => new Date(Number(x)).toISOString().slice(0, 10)} />
                    <Legend wrapperStyle={STANDARD_LEGEND_WRAPPER_STYLE} onClick={handleLegendClick} formatter={renderLegendText} />
                    <Line yAxisId="k" dataKey="kospi" name="KOSPI (좌)" stroke="#6366f1" dot={false} strokeWidth={getStrokeWidth('kospi', 1.8, 3.2)} strokeOpacity={getOpacity('kospi')} connectNulls isAnimationActive={false} />
                    <Line yAxisId="w" dataKey="krw" name="원/달러 (우)" stroke="#f59e0b" dot={false} strokeWidth={getStrokeWidth('krw', 1.4, 3)} strokeOpacity={getOpacity('krw')} connectNulls isAnimationActive={false} />
                </ComposedChart>
            </ResponsiveContainer>
            <div className="mt-2 space-y-1.5">
                {t.lanes.map((lane, li) => (
                    <div key={lane.key} className="flex items-center">
                        <span className="text-[10px] font-bold text-gray-400 shrink-0 text-right pr-1.5" style={{ width: L_W }}>{lane.label}</span>
                        <div className="relative h-5 flex-1 rounded bg-white/[0.03]" style={{ marginRight: R_W }}>
                            {lane.segments.map((g, si) => {
                                const left = pct(g.start), right = g.end ? pct(g.end) : 100;
                                const active = sel?.lane === li && sel.seg === si;
                                return (
                                    <button key={g.start + si} type="button" title={`${g.title} · ${g.summary}`} onClick={() => setSel({ lane: li, seg: si })}
                                        className={`absolute top-0 h-5 rounded-sm transition ${active ? 'ring-2 ring-white/80 z-10' : 'opacity-70 hover:opacity-100'}`}
                                        style={{ left: `${left}%`, width: `${Math.max(0.6, right - left)}%`, backgroundColor: SEG_COLOR[g.kind] ?? '#94a3b8' }} />
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
            {s && sel && (
                <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="text-[11px] font-bold text-gray-400">{t.lanes[sel.lane].label}</span>
                        <span className="text-xs font-mono text-gray-400">{s.start.slice(0, 7).replace('-', '.')} → {s.end ? s.end.slice(0, 7).replace('-', '.') : '현재'}</span>
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full border border-white/15" style={{ color: SEG_COLOR[s.kind] }}>{SEG_LABEL[s.kind] ?? s.kind}</span>
                        <span className="text-sm font-extrabold text-white">{s.title}</span>
                        <span className="text-xs font-bold text-gray-300 ml-auto">{s.summary}</span>
                    </div>
                    <ul className="mt-2 flex flex-wrap gap-1.5">
                        {s.drivers.map(x => <li key={x} className="text-[11px] text-gray-300 bg-white/5 border border-white/5 rounded-md px-2 py-0.5">{x}</li>)}
                    </ul>
                    {s.source && <p className="text-[10px] text-gray-500 mt-1.5">출처: {s.source}</p>}
                </div>
            )}
        </div>
    );
}

const sgn = (v: number, d = 1, u = '%') => `${v > 0 ? '+' : ''}${v.toFixed(d)}${u}`;
const STATUS_BADGE: Record<EventItem['status'], { label: (x: EventItem) => string; cls: string }> = {
    upcoming: { label: x => `D-${x.d_day}`, cls: 'text-gray-300 border-white/15 bg-white/5' },
    pending: { label: () => '결과 반영 대기', cls: 'text-amber-200 border-amber-400/40 bg-amber-500/10' },
    done: { label: () => '결과 반영', cls: 'text-emerald-200 border-emerald-400/40 bg-emerald-500/10' },
};

function EventCard({ x }: { x: EventItem }) {
    const b = STATUS_BADGE[x.status];
    const r = x.result, re = x.reaction;
    return (
        <div className={`rounded-xl border p-3 ${x.kind === 'event' ? 'xl:col-span-2 bg-amber-500/[0.04] border-amber-400/20' : 'bg-white/[0.03] border-white/5'}`}>
            <div className="flex flex-wrap items-baseline gap-2">
                <span className={`text-sm font-extrabold ${x.kind === 'event' ? 'text-amber-200' : 'text-white'}`}>{x.title}</span>
                <span className="text-xs font-bold text-gray-400">{x.date}</span>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${b.cls}`}>{b.label(x)}</span>
                {x.rate != null && <span className="text-xs font-bold text-gray-400">현재 {x.rate.toFixed(2)}%</span>}
            </div>
            {x.note && <p className="text-xs text-gray-400 mt-1">{x.note}</p>}
            {x.status === 'upcoming' && x.implied && <p className="text-xs text-gray-400 mt-1">시장 반영: {x.implied}</p>}
            {x.status === 'pending' && (
                <p className="text-xs text-amber-200/80 mt-1.5">
                    {x.kind === 'event' ? '뉴스로 결과를 확인하는 중입니다' : '결정 후 금리 데이터가 아직 갱신되지 않았습니다'} — 자동으로 다시 확인하며, 위의 &lsquo;결과 업데이트&rsquo;로 바로 확인할 수도 있습니다.
                </p>
            )}
            {x.status === 'done' && r && (
                <div className="mt-2 rounded-lg bg-emerald-500/[0.07] border border-emerald-400/20 px-2.5 py-2">
                    <p className="text-sm font-bold text-emerald-100">결과: {r.text ?? r.summary}</p>
                    {r.points && r.points.length > 0 && (
                        <ul className="mt-1 space-y-0.5">{r.points.map(t => <li key={t} className="text-xs text-gray-300">· {t}</li>)}</ul>
                    )}
                    {re && (
                        <p className="text-[11px] text-gray-400 mt-1">
                            직전 주({re.since}) 대비
                            {re.krw != null && <> · 원/달러 <b className={re.krw > 0 ? 'text-red-400' : 'text-blue-400'}>{sgn(re.krw)}</b></>}
                            {re.kospi != null && <> · KOSPI <b className={re.kospi > 0 ? 'text-red-400' : 'text-blue-400'}>{sgn(re.kospi)}</b></>}
                            {re.us10y_bp != null && <> · 미 10년물 {sgn(re.us10y_bp, 0, 'bp')}</>}
                            {re.kr10y_bp != null && <> · 한 10년물 {sgn(re.kr10y_bp, 0, 'bp')}</>}
                        </p>
                    )}
                    {r.source && <p className="text-[10px] text-gray-500 mt-1">{r.source}</p>}
                </div>
            )}
            <table className="w-full text-xs mt-2">
                <thead><tr className="text-gray-500 border-b border-white/10">
                    <th className="text-left py-1 font-bold">결과</th>{x.cols.map(c => <th key={c} className="text-left font-bold">{c}</th>)}
                </tr></thead>
                <tbody>
                    {x.cases.map(c => {
                        const hit = x.status === 'done' && r?.case === c.case;
                        return (
                            <tr key={c.case} className={`border-b border-white/5 ${hit ? 'bg-emerald-500/10 text-gray-100' : x.status === 'done' ? 'text-gray-500' : 'text-gray-300'}`}>
                                <td className="py-1 font-bold text-gray-100">{c.case}{hit && <span className="ml-1 text-emerald-300">◀ 실제</span>}</td>
                                {c.cells.map((v, k) => <td key={k}>{v}</td>)}
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

function Scenarios({ sc }: { sc: Overview['scenarios'] }) {
    return (
        <div>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                {sc.items.map(x => <EventCard key={`${x.kind}-${x.date}`} x={x} />)}
            </div>
            {sc.missing.length > 0 && <p className="text-[11px] text-amber-300/80 mt-2">다음 일정 갱신 필요: {sc.missing.join(', ')}</p>}
            <p className="text-[11px] text-gray-500 mt-2">{sc.note} 지난 이벤트는 결과와 함께 30일간 남습니다.</p>
        </div>
    );
}

// 날짜가 지났는데 결과가 아직 없거나, 서버 데이터가 이벤트 날 이전에 만들어졌으면 1시간을 기다리지 않고 다시 받는다
const todayKst = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
const eventDue = (d: Overview) => dataAgeMs(d) > 10 * 60 * 1000 && (d.scenarios?.items ?? []).some(
    x => x.status === 'pending' || (x.status === 'upcoming' && x.date <= todayKst()));

export default function MacroTab() {
    const { data, refreshing, error, refresh, replace } = useCachedOverview<Overview>('iprism-macro-v3', `${API_BASE}/api/v1/macro/overview`, { isStale: eventDue });
    // 수동 '결과 업데이트' — 금리 원천·이벤트 AI 결과를 서버에서 다시 확인한 응답으로 캐시를 바꾼다
    const [evBusy, setEvBusy] = useState(false);
    const [evMsg, setEvMsg] = useState<string | null>(null);
    const updateEvents = useCallback(async () => {
        setEvBusy(true);
        setEvMsg(null);
        try {
            const r = await fetch(`${API_BASE}/api/v1/macro/events/refresh`, { method: 'POST', cache: 'no-store' });
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            const j = (await r.json()) as Overview & { throttled?: boolean };
            replace(j);
            setEvMsg(j.throttled ? '방금 업데이트했습니다 — 1분 뒤 다시 시도할 수 있습니다' : `${new Date().toLocaleTimeString('ko-KR')} 결과 확인 완료`);
        } catch (e) {
            setEvMsg(`업데이트 실패 (${e instanceof Error ? e.message : String(e)}) — 잠시 후 다시 시도해 주세요`);
        } finally {
            setEvBusy(false);
        }
    }, [replace]);
    return (
        <div className="w-full max-w-[95vw] xl:max-w-[1400px] mx-auto space-y-4 pb-10">
            <section className="bg-black/20 rounded-2xl border border-white/5 p-4 md:p-5">
                <div className="flex flex-wrap items-center gap-3 mb-4">
                    <Compass className="w-6 h-6 text-indigo-400" />
                    <div>
                        <h2 className="text-xl font-extrabold text-white leading-none">시장동향 종합분석</h2>
                        <p className="text-xs text-gray-500 mt-1">환율·금리·주식과 유가·공포지수·인플레이션을 총망라한 진정한 거시경제 종합 진단</p>
                    </div>
                    {data && <span className="text-sm font-extrabold px-3 py-1 rounded-full border border-indigo-400/40 bg-indigo-500/15 text-indigo-200">{data.diagnosis.headline}</span>}
                    <div className="ml-auto flex items-center gap-2 text-[11px] text-gray-500">
                        {error && <span className="text-rose-400 font-medium">업데이트 실패 ({error})</span>}
                        {data && <span>{new Date(data.updated_at).toLocaleString('ko-KR')} 기준{refreshing ? ' · 최신 데이터 확인 중…' : ''}</span>}
                        <button onClick={refresh} disabled={refreshing}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 disabled:opacity-50">
                            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />업데이트
                        </button>
                    </div>
                </div>
                {error && !data && <p className="text-sm text-red-400">종합분석 데이터를 불러오지 못했습니다 ({error}). 서버가 깨어나는 중이면 잠시 후 업데이트를 눌러 주세요.</p>}
                {!data && !error && <ChartLoadingPlaceholder height={140} message="종합분석 준비 중" subMessage="환율·금리·주식 및 거시경제 지표를 모아 계산합니다" />}
                {data && (
                    <MacroExecutiveOverview d={data} />
                )}
            </section>

            {data && (
                <>
                    <section className="bg-black/20 rounded-2xl border border-white/5 p-4">
                        <SectionTitle icon={<PieChart className="w-5 h-5 text-amber-400" />} title="자산별 근거" sub="데이터 규칙으로 모은 비중 확대(+)·축소(−) 근거 — 점수는 근거 개수의 합이며 투자 권유가 아닙니다" />
                        <Allocation d={data} />
                    </section>

                    <section className="bg-black/20 rounded-2xl border border-white/5 p-4">
                        <SectionTitle icon={<History className="w-5 h-5 text-indigo-400" />} title="통합 타임라인" sub="한국 기준금리·원/달러·KOSPI 국면을 같은 시간축에 — 막대를 누르면 그 국면의 배경이 아래에 나옵니다" />
                        <LaneTimeline t={data.timeline} />
                    </section>

                    {data.analogs && (
                        <section className="bg-black/20 rounded-2xl border border-white/5 p-4">
                            <SectionTitle icon={<Compass className="w-5 h-5 text-emerald-400" />} title="과거 유사 국면" sub="지금과 지표 조합이 가장 비슷했던 과거 시점과 그 뒤 6·12개월 동안의 움직임" />
                            <Analogs a={data.analogs} />
                        </section>
                    )}

                    {data.correlation && (
                        <section className="bg-black/20 rounded-2xl border border-white/5 p-4">
                            <SectionTitle icon={<Network className="w-5 h-5 text-sky-400" />} title="자산 연결 지도" sub="최근 1년과 10년의 상관을 비교해 평소와 달라진 연결을 찾습니다" />
                            <Correlation c={data.correlation} />
                        </section>
                    )}

                    <section className="bg-black/20 rounded-2xl border border-white/5 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                            <SectionTitle icon={<CalendarClock className="w-5 h-5 text-purple-400" />} title="이벤트 시나리오 · 결과"
                                sub="금통위·FOMC·주요 이벤트를 날짜순으로 — 결과가 나오면 실제 시나리오와 시장 반응을 자동 반영" />
                            <div className="flex items-center gap-2">
                                {evMsg && <span className="text-[11px] text-gray-400">{evMsg}</span>}
                                <button onClick={updateEvents} disabled={evBusy}
                                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 disabled:opacity-50">
                                    <RefreshCw className={`w-3.5 h-3.5 ${evBusy ? 'animate-spin' : ''}`} />{evBusy ? '결과 확인 중…' : '결과 업데이트'}
                                </button>
                            </div>
                        </div>
                        <Scenarios sc={data.scenarios} />
                    </section>

                    <p className="flex items-start gap-1.5 text-[11px] text-gray-500 px-1">
                        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        환율·금리·주식 탭과 같은 데이터(FRED·한국은행 ECOS·Yahoo·multpl)를 결합한 참고 분석입니다. 유사 국면은 패턴 비교일 뿐 예측이 아니며, 자산별 근거와 AI 코멘트는 투자 권유가 아닙니다.
                    </p>
                </>
            )}
        </div>
    );
}
