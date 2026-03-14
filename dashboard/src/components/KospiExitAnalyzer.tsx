import React, { useState, useEffect } from 'react';
import { ShieldAlert, TrendingDown, DollarSign, Activity, AlertTriangle, ArrowRight, Info, ChevronRight, BarChart2, X, AlertCircle } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, ReferenceLine, ReferenceArea, Legend } from 'recharts';
import { API_BASE } from '../lib/apiConfig';
import { DollarModalContent, PerModalContent, CliModalContent, SentimentModalContent } from './ExitSignalModals';
import ChartLoadingPlaceholder from './ChartLoadingPlaceholder';

// Mock Data for the 1-year Historical Trends (12 Months)
const mockDollarData = [
    { month: '03월', val: 104.2, krw: 1350 },
    { month: '04월', val: 103.8, krw: 1345 },
    { month: '05월', val: 105.1, krw: 1370 }, // Peak danger
    { month: '06월', val: 104.5, krw: 1362 },
    { month: '07월', val: 102.3, krw: 1330 },
    { month: '08월', val: 101.8, krw: 1325 },
    { month: '09월', val: 100.9, krw: 1310 },
    { month: '10월', val: 99.5, krw: 1290 },
    { month: '11월', val: 98.2, krw: 1285 },
    { month: '12월', val: 97.4, krw: 1270 },
    { month: '01월', val: 96.8, krw: 1265 },
    { month: '02월', val: 97.77, krw: 1280 },
];

const mockPerData = [
    { month: '03월', val: 9.8, kospi: 2750, price: 2750 },
    { month: '04월', val: 9.5, kospi: 2680, price: 2680 },
    { month: '05월', val: 9.1, kospi: 2600, price: 2600 },
    { month: '06월', val: 9.9, kospi: 2700, price: 2700 },
    { month: '07월', val: 10.4, kospi: 2780, price: 2780 },
    { month: '08월', val: 10.9, kospi: 2850, price: 2850 },
    { month: '09월', val: 11.2, kospi: 2900, price: 2900 },
    { month: '10월', val: 11.5, kospi: 2930, price: 2930 },
    { month: '11월', val: 11.8, kospi: 2880, price: 2880 },
    { month: '12월', val: 12.1, kospi: 2800, price: 2800 },
    { month: '01월', val: 12.6, kospi: 2500, price: 2500 }, // Touch danger line
    { month: '02월', val: 12.4, kospi: 2450, price: 2450 }, // Trend reversal dropping
];

const mockCliData = [
    { month: '03월', val: 99.1 },
    { month: '04월', val: 99.5 },
    { month: '05월', val: 99.8 },
    { month: '06월', val: 99.9 },
    { month: '07월', val: 100.1 },
    { month: '08월', val: 100.3 },
    { month: '09월', val: 100.5 },
    { month: '10월', val: 100.7 },
    { month: '11월', val: 100.9 },
    { month: '12월', val: 101.1 }, // Peak
    { month: '01월', val: 100.8 }, // Drop 1
    { month: '02월', val: 100.4 }, // Drop 2 (Danger)
];

const useVisualSort = (data: any[], keys: string[]) => {
    return React.useMemo(() => {
        const ranges: any = {};
        keys.forEach(k => {
            if (!data) return;
            const vals = data.map(d => d[k]).filter(v => typeof v === 'number' && isFinite(v));
            ranges[k] = vals.length > 0 ? { min: Math.min(...vals), max: Math.max(...vals) } : { min: 0, max: 1 };
        });

        return (key: string, val: number) => {
            if (val == null || !ranges[key]) return -Infinity;
            const { min, max } = ranges[key];
            return max > min ? (val - min) / (max - min) : 0;
        };
    }, [data, keys]);
};

export default function KospiExitAnalyzer() {
    // Current Active Status
    const [dollarIndex, setDollarIndex] = useState(mockDollarData[11].val);
    const [dollarKrw, setDollarKrw] = useState(mockDollarData[11].krw);
    const [forwardPer, setForwardPer] = useState(mockPerData[11].val);
    const [oecdCliValue, setOecdCliValue] = useState(mockCliData[11].val);
    const [oecdCliDownMonths, setOecdCliDownMonths] = useState(2); // Based on recent mock drops
    const [vixValue, setVixValue] = useState(18.5);
    const [fgiValue, setFgiValue] = useState(50.0);

    // Chart Data State
    const [baseDollar, setBaseDollar] = useState([...mockDollarData]);
    const [basePer, setBasePer] = useState([...mockPerData]);
    const [baseCli, setBaseCli] = useState([...mockCliData]);
    const [baseSentiment, setBaseSentiment] = useState<any[]>([]);

    // Popup State
    const [activePopup, setActivePopup] = useState<'dollar' | 'per' | 'cli' | 'vix' | 'fgi' | null>(null);
    const [popupTop, setPopupTop] = useState(0); // 클릭된 카드의 뷰포트 Y 위치

    // 카드 클릭 시 Y 위치 캡처 후 팝업 열기
    const openPopup = (type: 'dollar' | 'per' | 'cli' | 'vix' | 'fgi', e: React.MouseEvent<HTMLDivElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setPopupTop(Math.round(rect.top));
        setActivePopup(type);
    };

    // API State
    const [loading, setLoading] = useState(true);

    // Fetch Real Data on Mount
    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await fetch(`${API_BASE}/api/v1/exit-signal`);
                if (res.ok) {
                    const data = await res.json();

                    // Update base chart data
                    setBaseDollar(data.indicators.dollar);
                    setBasePer(data.indicators.per);
                    setBaseCli(data.indicators.cli);

                    // Update current values
                    setDollarIndex(data.current_status.dollar);
                    setDollarKrw(data.current_status.krw);
                    setForwardPer(data.current_status.per);
                    setOecdCliValue(data.current_status.cli);
                    setOecdCliDownMonths(data.current_status.cli_down_months);

                    if (data.indicators.sentiment) {
                        setBaseSentiment(data.indicators.sentiment);
                        setVixValue(data.current_status.vix);
                        setFgiValue(data.current_status.fgi);
                    }

                    // Fetch real CLI data for 3 lines (Dashboard)
                    try {
                        const cliRes = await fetch(`${API_BASE}/api/v1/exit-signal/cli`);
                        if (cliRes.ok) {
                            const cliDataRaw = await cliRes.json();
                            if (cliDataRaw.length > 0) {
                                // Take last 12 items for dashboard mini chart
                                const recent12 = cliDataRaw.slice(-12).map((item: any) => ({
                                    month: item.date.substring(5, 7) + '월', // format "YYYY-MM" -> "MM월"
                                    kor_cli: item.kor_cli,
                                    usa_cli: item.usa_cli,
                                    oecd_cli: item.oecd_cli
                                }));
                                setBaseCli(recent12);

                                const lastItem = cliDataRaw[cliDataRaw.length - 1];
                                setOecdCliValue(lastItem.kor_cli);

                                // Recalculate down months for Korea CLI
                                let downMonths = 0;
                                for (let i = cliDataRaw.length - 1; i > 0; i--) {
                                    if (cliDataRaw[i].kor_cli < cliDataRaw[i - 1].kor_cli) {
                                        downMonths++;
                                    } else {
                                        break;
                                    }
                                }
                                setOecdCliDownMonths(downMonths);
                            }
                        }

                        // Fetch Daily 1Y data for Dollar and PER to match Popup Charts
                        const [macroRes, perRes] = await Promise.all([
                            fetch(`${API_BASE}/api/v1/exit-signal/macro?period=1Y`),
                            fetch(`${API_BASE}/api/v1/exit-signal/per?period=1Y`)
                        ]);
                        if (macroRes.ok) {
                            const macro1Y = await macroRes.json();
                            setBaseDollar(macro1Y);
                        }
                        if (perRes.ok) {
                            const per1Y = await perRes.json();
                            setBasePer(per1Y);
                        }
                    } catch (cliErr) {
                        console.error("Failed to fetch CLI 3-line data:", cliErr);
                    }
                }
            } catch (err) {
                console.error("Failed to fetch Exit Signal data:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const chartDollar = baseDollar;
    const chartPer = basePer;
    const chartCli = baseCli;
    const chartSentiment = baseSentiment.length > 0 ? baseSentiment : [];

    const getNormDollar = useVisualSort(chartDollar, ['dollar', 'krw']);
    const getNormPer = useVisualSort(chartPer, ['val', 'kospi']);
    const getNormCli = useVisualSort(chartCli, ['kor_cli', 'usa_cli', 'oecd_cli']);

    // Calculate status levels
    const getDollarStatus = () => {
        if (dollarIndex <= 100) return { level: 'safe', text: '안정', color: 'text-emerald-400', bg: 'bg-emerald-400/10', border: 'border-emerald-400/30' };
        if (dollarIndex <= 101.5) return { level: 'warning', text: '경계', color: 'text-amber-400', bg: 'bg-amber-400/10', border: 'border-amber-400/30' };
        return { level: 'danger', text: '위험', color: 'text-rose-400', bg: 'bg-rose-400/10', border: 'border-rose-400/30' };
    };

    const getPerStatus = () => {
        if (forwardPer < 11.5) return { level: 'safe', text: '저평가', color: 'text-emerald-400', bg: 'bg-emerald-400/10', border: 'border-emerald-400/30' };
        if (forwardPer < 12.5) return { level: 'warning', text: '관망', color: 'text-amber-400', bg: 'bg-amber-400/10', border: 'border-amber-400/30' };
        // If it touched 12.5 and is now dropping, it's a trend reversal
        return { level: 'danger', text: '추세 반전', color: 'text-rose-400', bg: 'bg-rose-400/10', border: 'border-rose-400/30' };
    };

    const getCliStatus = () => {
        if (oecdCliDownMonths === 0) return { level: 'safe', text: '확장 국면', color: 'text-emerald-400', bg: 'bg-emerald-400/10', border: 'border-emerald-400/30' };
        if (oecdCliDownMonths === 1) return { level: 'warning', text: '둔화 우려', color: 'text-amber-400', bg: 'bg-amber-400/10', border: 'border-amber-400/30' };
        return { level: 'danger', text: '수축 국면', color: 'text-rose-400', bg: 'bg-rose-400/10', border: 'border-rose-400/30', desc: '2개월 연속 하락' };
    };

    const getVixStatus = () => {
        if (vixValue < 15) return { level: 'safe', text: '안정', color: 'text-emerald-400', bg: 'bg-emerald-400/10', border: 'border-emerald-400/30' };
        if (vixValue <= 20) return { level: 'warning', text: '경계', color: 'text-amber-400', bg: 'bg-amber-400/10', border: 'border-amber-400/30' };
        return { level: 'danger', text: '공포 확산', color: 'text-rose-400', bg: 'bg-rose-400/10', border: 'border-rose-400/30' };
    };

    const getFgiStatus = () => {
        if (fgiValue < 25) return { level: 'safe', text: '극단적 공포(매수 기회)', color: 'text-emerald-400', bg: 'bg-emerald-400/10', border: 'border-emerald-400/30' };
        if (fgiValue <= 75) return { level: 'warning', text: '중립/탐욕', color: 'text-amber-400', bg: 'bg-amber-400/10', border: 'border-amber-400/30' };
        return { level: 'danger', text: '극단적 탐욕(매도 경고)', color: 'text-rose-400', bg: 'bg-rose-400/10', border: 'border-rose-400/30' };
    };

    const dStatus = getDollarStatus();
    const pStatus = getPerStatus();
    const cStatus = getCliStatus();
    const vStatus = getVixStatus();
    const fStatus = getFgiStatus();

    const exitStatuses = [dStatus.level, pStatus.level, cStatus.level];
    const exitDangerCount = exitStatuses.filter(s => s === 'danger').length;
    const exitWarningCount = exitStatuses.filter(s => s === 'warning').length;
    const exitSafeCount = exitStatuses.filter(s => s === 'safe').length;

    const getExitStatus = () => {
        if (exitDangerCount >= 2) return { label: '위험 (매도 준비)', color: 'text-rose-400', border: 'border-rose-500/40', bg: 'bg-rose-500/20' };
        if (exitWarningCount >= 2 || exitDangerCount === 1) return { label: '경계 (비중 조절)', color: 'text-amber-400', border: 'border-amber-500/40', bg: 'bg-amber-500/20' };
        if (exitSafeCount >= 2) return { label: '안정 (비중 확대)', color: 'text-emerald-400', border: 'border-emerald-500/40', bg: 'bg-emerald-500/20' };
        return { label: '중립 (관망)', color: 'text-gray-300', border: 'border-gray-500/40', bg: 'bg-gray-500/20' };
    };

    const getExitAnalysisText = () => {
        if (exitDangerCount >= 2) return "거시 경제 및 밸류에이션 지표가 위험 수준입니다. 주식 비중을 최소화하고 보수적으로 대응하세요.";
        if (exitWarningCount >= 2 || exitDangerCount === 1) return "일부 지표에서 경고 신호가 확인됩니다. 리스크 관리를 강화하고 시장의 변화를 예의주시하세요.";
        if (exitSafeCount >= 2) return "거시 지표와 밸류에이션이 전반적으로 양호합니다. 주식 자산 편입에 우호적인 환경입니다.";
        return "거시 지표가 방향성을 탐색 중입니다. 추가적인 데이터 확인이 필요합니다.";
    };

    const sentimentStatuses = [vStatus.level, fStatus.level];
    const sentDangerCount = sentimentStatuses.filter(s => s === 'danger').length;
    const sentWarningCount = sentimentStatuses.filter(s => s === 'warning').length;

    const getSentimentStatus = () => {
        if (sentDangerCount >= 1) return { label: '추세 반전 경고', color: 'text-rose-400', border: 'border-rose-500/40', bg: 'bg-rose-500/20' };
        if (sentWarningCount >= 1) return { label: '변동성 확대 주의', color: 'text-amber-400', border: 'border-amber-500/40', bg: 'bg-amber-500/20' };
        return { label: '시장 심리 안정', color: 'text-emerald-400', border: 'border-emerald-500/40', bg: 'bg-emerald-500/20' };
    };

    const getSentimentAnalysisText = () => {
        if (sentDangerCount >= 1) return "시장 심리가 극단적인 방향으로 쏠려 있어, 단기 충격 가능성에 대비해야 합니다.";
        if (sentWarningCount >= 1) return "시장 변동성이 다소 커질 수 있는 구간입니다. 방어적 포지션을 점검해보세요.";
        return "시장 심리와 변동성이 안정적으로 유지되고 있어, 큰 충격 없이 순항할 가능성이 높습니다.";
    };

    const exitOverall = getExitStatus();
    const sentOverall = getSentimentStatus();

    return (
        <div className="w-full flex flex-col gap-4 mb-2 relative">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2 bg-black/20 p-4 rounded-xl border border-white/5 backdrop-blur-md">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 shrink-0">
                        <ShieldAlert className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <div className="flex flex-wrap items-center gap-3">
                            <h2 className="text-xl font-extrabold text-white">
                                코스피 출구 전략 모니터링 (Exit-Signal)
                            </h2>
                            <span className={`px-2.5 py-1 text-xs font-bold flex items-center gap-1.5 rounded-lg border ${exitOverall.bg} ${exitOverall.color} ${exitOverall.border}`}>
                                {exitOverall.label}
                            </span>
                        </div>
                        <p className="text-sm text-gray-400 font-medium mt-0.5">거시경제 및 밸류에이션 기반 위기 감지 시스템</p>
                    </div>
                </div>
                <div className="text-sm text-gray-300 md:text-right md:max-w-xs border-t md:border-t-0 md:border-l border-white/10 pt-3 md:pt-0 md:pl-4">
                    {getExitAnalysisText()}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* 1. Dollar Index */}
                <div onClick={(e) => openPopup('dollar', e)} className="cursor-pointer bg-white/[0.02] border border-white/10 rounded-2xl p-5 flex flex-col justify-between hover:bg-white/[0.06] transition-colors relative overflow-hidden group">
                    <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-3">
                            <h4 className="text-gray-400 text-sm font-medium flex items-center gap-1.5"><DollarSign className="w-4 h-4" /> 달러 인덱스/환율 추이</h4>
                            <span className="text-2xl font-black text-white font-mono">{dollarIndex.toFixed(2)}</span>
                        </div>
                        <span className={`px-2.5 py-1 text-xs font-bold rounded-lg border ${dStatus.bg} ${dStatus.color} ${dStatus.border}`}>
                            {dStatus.text}
                        </span>
                    </div>

                    <div className="flex-1 w-full min-h-[160px] mt-2 -ml-2 -mb-2">
                        {loading ? (
                            <ChartLoadingPlaceholder height={160} />
                        ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartDollar} margin={{ top: 5, right: -5, left: -5, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#666' }} tickLine={false} axisLine={false} tickMargin={8} minTickGap={30} tickFormatter={(val) => val ? val.substring(5, 10) : ''} />
                                <YAxis yAxisId="left" domain={['auto', 'auto']} tick={{ fontSize: 10, fill: dollarIndex >= 101.5 ? '#f43f5e' : (dollarIndex >= 100 ? '#f59e0b' : '#34d399') }} tickLine={false} axisLine={false} width={45} />
                                <YAxis yAxisId="right" orientation="right" domain={['auto', 'auto']} tick={{ fontSize: 10, fill: '#60a5fa' }} tickLine={false} axisLine={false} width={45} />
                                <RechartsTooltip
                                    contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', border: '1px solid rgba(255,255,255,0.1)', fontSize: '11px', borderRadius: '8px' }}
                                    content={({ active, payload, label }) => {
                                        if (active && payload && payload.length) {
                                            const sortedPayload = [...payload].sort((a: any, b: any) => getNormDollar(b.dataKey, b.value) - getNormDollar(a.dataKey, a.value));
                                            const isLast = payload[0]?.payload === chartDollar[chartDollar.length - 1];
                                            const displayLabel = `${label} ${isLast ? '(최근/전일)' : ''}`;
                                            return (
                                                <div className="bg-black/80 border border-white/10 p-2 rounded-lg text-[11px]">
                                                    <p className="text-gray-400 mb-1">{displayLabel}</p>
                                                    {sortedPayload.map((entry: any, index: number) => (
                                                        <div key={`item-${index}`} className="flex items-center gap-2 mb-0.5 font-medium" style={{ color: entry.color }}>
                                                            <span>{entry.name === 'krw' ? 'USD/KRW' : '달러 인덱스'} :</span>
                                                            <span>{entry.name === 'krw' ? `${Math.round(entry.value)}원` : entry.value.toFixed(2)}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            );
                                        }
                                        return null;
                                    }}
                                />
                                <ReferenceLine yAxisId="left" y={100} stroke="#f59e0b" strokeDasharray="3 3" />
                                <ReferenceLine yAxisId="left" y={101.5} stroke="#f43f5e" strokeDasharray="3 3" />
                                <Line name="달러 인덱스" yAxisId="left" type="monotone" dataKey="dollar" stroke={dollarIndex >= 101.5 ? '#f43f5e' : (dollarIndex >= 100 ? '#f59e0b' : '#34d399')} strokeWidth={2} dot={false} activeDot={{ r: 5 }} />
                                <Line name="USD/KRW" yAxisId="right" type="monotone" dataKey="krw" stroke="#60a5fa" strokeWidth={1.5} strokeDasharray="4 4" dot={false} activeDot={{ r: 4 }} />
                                <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '5px' }} />
                            </LineChart>
                        </ResponsiveContainer>
                        )}
                    </div>

                    <div className="mt-4 text-xs text-gray-400 bg-black/40 p-3 rounded-xl flex items-start gap-2">
                        <Info className="w-4 h-4 shrink-0 mt-0.5 text-blue-400" />
                        <p>101.5 초과 시 본격적인 출구 전략 실행 검토 및 ETF 비중 축소를 권고합니다.</p>
                    </div>
                </div>

                {/* 2. Forward P/E */}
                <div onClick={(e) => openPopup('per', e)} className="cursor-pointer bg-white/[0.02] border border-white/10 rounded-2xl p-5 flex flex-col justify-between hover:bg-white/[0.06] transition-colors relative overflow-hidden group">
                    <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center gap-3">
                            <h4 className="text-gray-400 text-sm font-medium flex items-center gap-1.5"><BarChart2 className="w-4 h-4" /> 포워드 PER</h4>
                            <span className="text-2xl font-black text-white font-mono">{forwardPer.toFixed(1)}x</span>
                        </div>
                        <span className={`px-2.5 py-1 text-xs font-bold rounded-lg border ${pStatus.bg} ${pStatus.color} ${pStatus.border}`}>
                            {pStatus.text}
                        </span>
                    </div>

                    <div className="flex-1 w-full min-h-[160px] mt-2 -ml-2 -mb-2">
                        {loading ? (
                            <ChartLoadingPlaceholder height={160} />
                        ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartPer} margin={{ top: 5, right: -5, left: -5, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                                <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#666' }} tickLine={false} axisLine={false} tickMargin={8} minTickGap={30} tickFormatter={(val) => val ? val.substring(5, 10) : ''} />
                                <YAxis yAxisId="left" domain={['auto', 'auto']} tick={{ fontSize: 10, fill: forwardPer >= 12.5 || pStatus.level === 'danger' ? '#f43f5e' : '#34d399' }} tickLine={false} axisLine={false} width={45} />
                                <YAxis yAxisId="right" orientation="right" domain={['auto', 'auto']} tick={{ fontSize: 9, fill: '#60a5fa' }} tickLine={false} axisLine={false} width={45} tickFormatter={(val) => Math.round(val).toLocaleString()} />
                                <RechartsTooltip
                                    contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', border: '1px solid rgba(255,255,255,0.1)', fontSize: '11px', borderRadius: '8px' }}
                                    content={({ active, payload, label }) => {
                                        if (active && payload && payload.length) {
                                            const sortedPayload = [...payload].sort((a: any, b: any) => getNormPer(b.dataKey, b.value) - getNormPer(a.dataKey, a.value));
                                            const isLast = payload[0]?.payload === chartPer[chartPer.length - 1];
                                            const displayLabel = `${label} ${isLast ? '(최근/전일)' : ''}`;
                                            return (
                                                <div className="bg-black/80 border border-white/10 p-2 rounded-lg text-[11px]">
                                                    <p className="text-gray-400 mb-1">{displayLabel}</p>
                                                    {sortedPayload.map((entry: any, index: number) => (
                                                        <div key={`item-${index}`} className="flex items-center gap-2 mb-0.5 font-medium" style={{ color: entry.color }}>
                                                            <span>{entry.name === 'KOSPI' ? 'KOSPI' : 'P/E'} :</span>
                                                            <span>{entry.name === 'KOSPI' ? `${Math.round(entry.value).toLocaleString()}pt` : `${entry.value.toFixed(1)}x`}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            );
                                        }
                                        return null;
                                    }}
                                />
                                <ReferenceLine yAxisId="left" y={12.5} stroke="#f59e0b" strokeDasharray="3 3" />
                                <Line name="P/E" yAxisId="left" type="monotone" dataKey="val" stroke={forwardPer >= 12.5 || pStatus.level === 'danger' ? '#f43f5e' : '#34d399'} strokeWidth={2} dot={false} activeDot={{ r: 5 }} />
                                <Line name="KOSPI" yAxisId="right" type="monotone" dataKey="price" stroke="#60a5fa" strokeWidth={1.5} strokeDasharray="4 4" dot={false} activeDot={false} />
                                <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '5px' }} />
                            </LineChart>
                        </ResponsiveContainer>
                        )}
                    </div>

                    <div className="mt-2 text-xs text-gray-400 bg-black/40 p-3 rounded-xl flex items-start gap-2">
                        <Info className="w-4 h-4 shrink-0 mt-0.5 text-blue-400" />
                        <p>포워드 PER 12.5 터치 후 우하향 전환 시 '추세 반전'에 따른 강력 매도 시그널입니다.</p>
                    </div>
                </div>

                {/* 3. OECD CLI */}
                <div onClick={(e) => openPopup('cli', e)} className="cursor-pointer bg-white/[0.02] border border-white/10 rounded-2xl p-5 flex flex-col justify-between hover:bg-white/[0.06] transition-colors relative overflow-hidden group">
                    <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-3">
                            <h4 className="text-gray-400 text-sm font-medium flex items-center gap-1.5"><TrendingDown className="w-4 h-4" /> 경기 선행 지수 (CLI)</h4>
                            <div className="flex items-end gap-2 text-2xl font-black text-white font-mono">
                                {(100.2 - (oecdCliDownMonths * 0.4)).toFixed(1)}
                                {oecdCliDownMonths > 0 && <span className="text-rose-400 text-xs font-bold mb-1 flex items-center border border-rose-500/20 bg-rose-500/10 px-1.5 py-0.5 rounded-md"><TrendingDown className="w-3 h-3 mr-0.5" /> 하락 {oecdCliDownMonths}M</span>}
                            </div>
                        </div>
                        <span className={`px-2.5 py-1 text-xs font-bold rounded-lg border ${cStatus.bg} ${cStatus.color} ${cStatus.border}`}>
                            {cStatus.text}
                        </span>
                    </div>

                    <div className="flex-1 w-full min-h-[160px] mt-2 -ml-2 -mb-2">
                        {loading ? (
                            <ChartLoadingPlaceholder height={160} />
                        ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartCli} margin={{ top: 5, right: -5, left: -5, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                                <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#666' }} tickLine={false} axisLine={false} tickMargin={8} />
                                <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10, fill: '#f43f5e' }} tickLine={false} axisLine={false} width={45} />
                                <RechartsTooltip
                                    contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', border: '1px solid rgba(255,255,255,0.1)', fontSize: '11px', borderRadius: '8px' }}
                                    content={({ active, payload, label }) => {
                                        if (active && payload && payload.length) {
                                            const sortedPayload = [...payload].sort((a: any, b: any) => getNormCli(b.dataKey, b.value) - getNormCli(a.dataKey, a.value));
                                            const isLast = payload[0]?.payload === chartCli[chartCli.length - 1];
                                            const displayLabel = `${label} ${isLast ? '(최근/전일)' : ''}`;
                                            return (
                                                <div className="bg-black/80 border border-white/10 p-2 rounded-lg text-[11px]">
                                                    <p className="text-gray-400 mb-1">{displayLabel}</p>
                                                    {sortedPayload.map((entry: any, index: number) => {
                                                        const nameMap: any = { kor_cli: '한국 CLI', usa_cli: '미국 CLI', oecd_cli: 'G7(OECD Proxy)' };
                                                        return (
                                                            <div key={`item-${index}`} className="flex items-center gap-2 mb-0.5 font-medium" style={{ color: entry.color }}>
                                                                <span>{nameMap[entry.name]} :</span>
                                                                <span>{entry.value.toFixed(1)}</span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            );
                                        }
                                        return null;
                                    }}
                                />
                                <Line name="한국 CLI" type="monotone" dataKey="kor_cli" stroke={cStatus.level === 'danger' ? '#f43f5e' : (cStatus.level === 'warning' ? '#f59e0b' : '#34d399')} strokeWidth={2} dot={{ r: 2, fill: '#121217' }} activeDot={{ r: 5 }} />
                                <Line name="미국 CLI" type="monotone" dataKey="usa_cli" stroke="#3b82f6" strokeWidth={1.5} strokeDasharray="4 4" dot={false} activeDot={false} />
                                <Line name="G7 CLI(Proxy)" type="monotone" dataKey="oecd_cli" stroke="#10b981" strokeWidth={1.5} strokeDasharray="3 3" dot={false} activeDot={false} />
                                <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '5px' }} />
                            </LineChart>
                        </ResponsiveContainer>
                        )}
                    </div>

                    <div className="mt-4 text-xs text-gray-400 bg-black/40 p-3 rounded-xl flex items-start gap-2">
                        <Info className="w-4 h-4 shrink-0 mt-0.5 text-blue-400" />
                        <p>미국 및 G20 경기 선행 지수가 2개월 연속 하락 시, 국내 주식 비중 축소 자동 리포트가 발행됩니다.</p>
                    </div>
                </div>
            </div>

            {/* Sentiment Indicators Row */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mt-2 mb-2 bg-black/20 p-4 rounded-xl border border-white/5 backdrop-blur-md">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 shrink-0">
                        <Activity className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <div className="flex flex-wrap items-center gap-3">
                            <h3 className="text-xl font-extrabold text-white">
                                시장 심리 지표
                            </h3>
                            <span className={`px-2.5 py-1 text-xs font-bold flex items-center gap-1.5 rounded-lg border ${sentOverall.bg} ${sentOverall.color} ${sentOverall.border}`}>
                                {sentOverall.label}
                            </span>
                        </div>
                        <p className="text-sm text-gray-400 font-medium mt-0.5">투자자들의 단기 변동성 우려와 탐욕 수준을 나타내는 지수</p>
                    </div>
                </div>
                <div className="text-sm text-gray-300 md:text-right md:max-w-xs border-t md:border-t-0 md:border-l border-white/10 pt-3 md:pt-0 md:pl-4">
                    {getSentimentAnalysisText()}
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* VIX */}
                <div onClick={(e) => openPopup('vix', e)} className="cursor-pointer bg-white/[0.02] border border-white/10 rounded-2xl p-5 flex flex-col justify-between hover:bg-white/[0.06] transition-colors relative overflow-hidden group">
                    <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-3">
                            <h4 className="text-gray-400 text-sm font-medium flex items-center gap-1.5"><Activity className="w-4 h-4" /> VIX(CBOE Volatility Index)</h4>
                            <span className="text-2xl font-black text-white font-mono">{vixValue.toFixed(2)}</span>
                        </div>
                        <span className={`px-2.5 py-1 text-xs font-bold rounded-lg border ${vStatus.bg} ${vStatus.color} ${vStatus.border}`}>
                            {vStatus.text}
                        </span>
                    </div>

                    <div className="flex-1 w-full min-h-[140px] mt-2 -ml-2 -mb-1">
                        {loading || baseSentiment.length === 0 ? (
                            <ChartLoadingPlaceholder height={140} message="심리지표 로딩중" />
                        ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartSentiment} margin={{ top: 5, right: -5, left: -5, bottom: 5 }}>
                                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#666' }} tickLine={false} axisLine={false} tickMargin={4} minTickGap={30} tickFormatter={(val) => val ? val.substring(5, 10) : ''} />
                                <YAxis yAxisId="left" domain={['auto', 'auto']} width={35} tick={{ fontSize: 10, fill: vStatus.level === 'danger' ? '#f43f5e' : (vStatus.level === 'warning' ? '#f59e0b' : '#34d399') }} tickLine={false} axisLine={false} />
                                <YAxis yAxisId="right" orientation="right" domain={['auto', 'auto']} width={45} tick={{ fontSize: 9, fill: '#60a5fa' }} tickLine={false} axisLine={false} tickFormatter={(val) => Math.round(val).toLocaleString()} />
                                <RechartsTooltip
                                    contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', border: '1px solid rgba(255,255,255,0.1)', fontSize: '11px', borderRadius: '8px' }}
                                    formatter={(value: any, name: any) => [name === 'KOSPI' ? Math.round(value).toLocaleString() + 'pt' : value.toFixed(2), name]}
                                    labelFormatter={(label: any, payload: any) => {
                                        const isLast = payload && payload[0] && payload[0].payload === chartSentiment[chartSentiment.length - 1];
                                        return `${label} ${isLast ? '(최근/전일)' : ''}`;
                                    }}
                                    labelStyle={{ color: '#aaa', marginBottom: '4px' }}
                                />
                                <Line name="VIX" yAxisId="left" type="monotone" dataKey="vix" stroke={vStatus.level === 'danger' ? '#f43f5e' : (vStatus.level === 'warning' ? '#f59e0b' : '#34d399')} strokeWidth={2} dot={false} activeDot={{ r: 5 }} />
                                <Line name="KOSPI" yAxisId="right" type="monotone" dataKey="kospi" stroke="#60a5fa" strokeWidth={1.5} strokeDasharray="4 4" dot={false} activeDot={false} />
                                <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '5px' }} />
                            </LineChart>
                        </ResponsiveContainer>
                        )}
                    </div>

                    <div className="mt-4 text-xs text-gray-400 bg-black/40 p-3 rounded-xl flex items-start gap-2">
                        <Info className="w-4 h-4 shrink-0 mt-0.5 text-blue-400" />
                        <p>평상시 15~20 구간 유지. 20을 돌파하여 급등하는 추세가 나타날 경우 단기 급락 위험 경고.</p>
                    </div>
                </div>

                {/* Fear & Greed */}
                <div onClick={(e) => openPopup('fgi', e)} className="cursor-pointer bg-white/[0.02] border border-white/10 rounded-2xl p-5 flex flex-col justify-between hover:bg-white/[0.06] transition-colors relative overflow-hidden group">
                    <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-3">
                            <h4 className="text-gray-400 text-sm font-medium flex items-center gap-1.5"><Activity className="w-4 h-4" /> Fear & Greed Index (공포탐욕지수)</h4>
                            <span className="text-2xl font-black text-white font-mono">{fgiValue.toFixed(1)}</span>
                        </div>
                        <span className={`px-2.5 py-1 text-xs font-bold rounded-lg border ${fStatus.bg} ${fStatus.color} ${fStatus.border}`}>
                            {fStatus.text}
                        </span>
                    </div>

                    <div className="flex-1 w-full min-h-[140px] mt-2 -ml-2 -mb-1">
                        {loading || baseSentiment.length === 0 ? (
                            <ChartLoadingPlaceholder height={140} message="심리지표 로딩중" />
                        ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartSentiment} margin={{ top: 5, right: -5, left: -5, bottom: 5 }}>
                                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#666' }} tickLine={false} axisLine={false} tickMargin={4} minTickGap={30} tickFormatter={(val) => val ? val.substring(5, 10) : ''} />
                                <YAxis yAxisId="left" domain={['auto', 'auto']} width={35} tick={{ fontSize: 10, fill: fStatus.level === 'danger' ? '#f43f5e' : (fgiValue < 30 ? '#34d399' : '#f59e0b') }} tickLine={false} axisLine={false} />
                                <YAxis yAxisId="right" orientation="right" domain={['auto', 'auto']} width={45} tick={{ fontSize: 9, fill: '#60a5fa' }} tickLine={false} axisLine={false} tickFormatter={(val) => Math.round(val).toLocaleString()} />
                                <RechartsTooltip
                                    contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', border: '1px solid rgba(255,255,255,0.1)', fontSize: '11px', borderRadius: '8px' }}
                                    formatter={(value: any, name: any) => [name === 'KOSPI' ? Math.round(value).toLocaleString() + 'pt' : value.toFixed(1), name]}
                                    labelFormatter={(label: any, payload: any) => {
                                        const isLast = payload && payload[0] && payload[0].payload === chartSentiment[chartSentiment.length - 1];
                                        return `${label} ${isLast ? '(최근/전일)' : ''}`;
                                    }}
                                    labelStyle={{ color: '#aaa', marginBottom: '4px' }}
                                />
                                <Line name="FGI" yAxisId="left" type="monotone" dataKey="fgi" stroke={fStatus.level === 'danger' ? '#f43f5e' : (fgiValue < 30 ? '#34d399' : '#f59e0b')} strokeWidth={2} dot={false} activeDot={{ r: 5 }} />
                                <Line name="KOSPI" yAxisId="right" type="monotone" dataKey="kospi" stroke="#60a5fa" strokeWidth={1.5} strokeDasharray="4 4" dot={false} activeDot={false} />
                                <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '5px' }} />
                            </LineChart>
                        </ResponsiveContainer>
                        )}
                    </div>

                    <div className="mt-4 text-xs text-gray-400 bg-black/40 p-3 rounded-xl flex items-start gap-2">
                        <Info className="w-4 h-4 shrink-0 mt-0.5 text-blue-400" />
                        <p>'극단적 탐욕 (75 이상)' 구간 진입 시 단기 고점 형성 가능성을 경고하며 분할 매도를 권고합니다.</p>
                    </div>
                </div>
            </div>

            {/* 환율-증시 디커플링 현상 안내 */}
            <div className="bg-indigo-900/20 border border-indigo-500/20 rounded-xl p-3 flex items-start sm:items-center gap-3 mt-2 text-xs">
                <AlertTriangle className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5 sm:mt-0" />
                <p className="text-indigo-200/80 leading-relaxed">
                    <span className="font-bold text-indigo-300">💡 환율-증시 디커플링 예외 안내:</span> 원·달러 환율이 상승함에도 코스피가 동반 리레이팅되는 최근의 예외적 현상(원화 약세 요인)을 고려하여, 단순 환율뿐 아니라 PER 추세 및 매크로 지표(CLI) 가중치를 종합 계산합니다.
                </p>
            </div>

            {activePopup && (
                /* 화면 전체 오버레이 — 현재 뷰포트 최상단부터 시작 */
                <div
                    className="fixed left-0 right-0 bottom-0 z-[200] flex items-start justify-center"
                    style={{ top: `${popupTop}px` }}
                    onClick={() => setActivePopup(null)}
                >
                    {/* 반투명 배경 */}
                    <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" />

                    {/* 팝업 패널 — 카드 위치부터 화면 끝까지 */}
                    <div
                        className="relative w-full max-w-4xl bg-[#1a1a2e] border border-white/20 rounded-2xl flex flex-col shadow-[0_0_80px_rgba(0,0,0,0.9)] animate-in fade-in slide-in-from-top-1 duration-150 overflow-hidden"
                        style={{ height: `calc(100vh - ${popupTop}px - 8px)` }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* 헤더 */}
                        <div className="flex justify-between items-center px-6 py-4 border-b border-white/10 shrink-0">
                            <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                {activePopup === 'dollar' && <DollarSign className="w-5 h-5 text-emerald-400" />}
                                {activePopup === 'per' && <BarChart2 className="w-5 h-5 text-blue-400" />}
                                {activePopup === 'cli' && <TrendingDown className="w-5 h-5 text-rose-400" />}
                                {activePopup === 'vix' && <Activity className="w-5 h-5 text-amber-400" />}
                                {activePopup === 'fgi' && <Activity className="w-5 h-5 text-amber-400" />}
                                {activePopup === 'dollar' ? '달러 인덱스 & 환율 장기 추이' :
                                    (activePopup === 'per' ? '주요 종목 포워드 PER 추이 비교' :
                                        (activePopup === 'cli' ? '경기 선행 지수 (CLI) 매크로 사이클' :
                                            (activePopup === 'vix' ? 'VIX 지수 (변동성) 사이클' : '공포/탐욕 지수 투자자 심리')))}
                            </h2>
                            <button onClick={() => setActivePopup(null)} className="p-1.5 bg-white/5 hover:bg-white/10 rounded-xl transition-colors text-gray-400 hover:text-white">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* 팝업 콘텐츠 */}
                        <div className="flex-1 overflow-y-auto p-4 md:p-6">
                            {activePopup === 'dollar' && <DollarModalContent />}
                            {activePopup === 'per' && <PerModalContent />}
                            {activePopup === 'cli' && <CliModalContent />}
                            {activePopup === 'vix' && <SentimentModalContent isFgi={false} />}
                            {activePopup === 'fgi' && <SentimentModalContent isFgi={true} />}
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
