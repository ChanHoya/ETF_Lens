import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ShieldAlert, TrendingDown, DollarSign, Activity, AlertTriangle, ArrowRight, Info, ChevronRight, BarChart2, X, AlertCircle } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, ReferenceLine, ReferenceArea, Legend } from 'recharts';
import { API_BASE } from '../lib/apiConfig';
import { DollarModalContent, PerModalContent, CliModalContent, SentimentModalContent, T10y2yModalContent, HySpreadModalContent } from './ExitSignalModals';
import ChartLoadingPlaceholder from './ChartLoadingPlaceholder';
import RiskGaugeChart from './RiskGaugeChart';

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
    // Sensible fallbacks for t10y2y and hy_spread
    const mockT10y2yData = [
        { month: '03월', val: -0.22 },
        { month: '04월', val: -0.25 },
        { month: '05월', val: -0.28 },
        { month: '06월', val: -0.32 },
        { month: '07월', val: -0.18 },
        { month: '08월', val: -0.15 },
        { month: '09월', val: -0.12 },
        { month: '10월', val: -0.08 },
        { month: '11월', val: -0.03 },
        { month: '12월', val: 0.05 },
        { month: '01월', val: 0.12 },
        { month: '02월', val: 0.15 },
    ];

    const mockHySpreadData = [
        { month: '03월', val: 3.12 },
        { month: '04월', val: 3.25 },
        { month: '05월', val: 3.42 },
        { month: '06월', val: 3.55 },
        { month: '07월', val: 3.32 },
        { month: '08월', val: 3.21 },
        { month: '09월', val: 3.15 },
        { month: '10월', val: 3.08 },
        { month: '11월', val: 2.98 },
        { month: '12월', val: 3.02 },
        { month: '01월', val: 3.10 },
        { month: '02월', val: 3.15 },
    ];

    // Current Active Status
    const [dollarIndex, setDollarIndex] = useState(mockDollarData[11].val);
    const [dollarKrw, setDollarKrw] = useState(mockDollarData[11].krw);
    const [forwardPer, setForwardPer] = useState(mockPerData[11].val);
    const [oecdCliValue, setOecdCliValue] = useState(mockCliData[11].val);
    const [oecdCliDownMonths, setOecdCliDownMonths] = useState(2); // Based on recent mock drops
    const [vixValue, setVixValue] = useState(18.5);
    const [vkospiValue, setVkospiValue] = useState(15.0);
    const [fgiValue, setFgiValue] = useState(50.0);
    const [t10y2yValue, setT10y2yValue] = useState(mockT10y2yData[11].val);
    const [hySpreadValue, setHySpreadValue] = useState(mockHySpreadData[11].val);
    // Track if API data has been loaded (to know when to override mock values)
    const [apiLoaded, setApiLoaded] = useState(false);
    const [exitScore, setExitScore] = useState(0);

    // Multi-Dimensional Risk State
    const [riskData, setRiskData] = useState<any>({
        level: 'safe',
        label: '안전',
        color: 'green',
        score: 0,
        max_score: 21,
        breakdown: {
            vix: { value: 18.5, score: 0, label: 'VIX 공포지수' },
            vkospi_proxy: { value: 15.0, score: 0, label: 'VKOSPI 변동성' },
            fgi: { value: 50.0, score: 0, label: '공포-탐욕 지수' },
            cli: { value: 100.4, score: 0, label: '경기선행지수(CLI)' },
            per: { value: 12.4, score: 0, label: 'KOSPI PER' },
            t10y2y: { value: 0.15, score: 0, label: '미 장단기 금리차' },
            hy_spread: { value: 3.15, score: 0, label: '미 하이일드 스프레드' }
        }
    });

    // Chart Data State
    const [baseDollar, setBaseDollar] = useState([...mockDollarData]);
    const [basePer, setBasePer] = useState([...mockPerData]);
    const [baseCli, setBaseCli] = useState([...mockCliData]);
    const [baseSentiment, setBaseSentiment] = useState<any[]>([]);
    const [baseT10y2y, setBaseT10y2y] = useState([...mockT10y2yData]);
    const [baseHySpread, setBaseHySpread] = useState([...mockHySpreadData]);

    // Popup State
    const [activePopup, setActivePopup] = useState<'dollar' | 'per' | 'cli' | 'vix' | 'fgi' | 't10y2y' | 'hy_spread' | null>(null);
    const [popupTop, setPopupTop] = useState(140);
    const [isMounted, setIsMounted] = useState(false); // Portal SSR 가드

    // Header section ref to dynamically align modals
    const headerRef = React.useRef<HTMLDivElement>(null);

    // 클라이언트 마운트 확인
    useEffect(() => { setIsMounted(true); }, []);

    // 카드 클릭 시 헤더 위치 기준 팝업 위치 결정
    const openPopup = (type: 'dollar' | 'per' | 'cli' | 'vix' | 'fgi' | 't10y2y' | 'hy_spread', e: React.MouseEvent<HTMLDivElement>) => {
        // sticky 헤더는 항상 viewport 상단에 고정되어 있으므로 getBoundingClientRect().bottom이 스크롤 상태와 무관하게 정확함
        const headerBottom = headerRef.current
            ? Math.max(headerRef.current.getBoundingClientRect().bottom, 56)
            : 100;
        setPopupTop(Math.round(headerBottom + 8));
        setActivePopup(type);
    };

    // 팝업이 열린 상태에서 스크롤 시 popupTop 동기화 (이미 팝업 열려있을 때 스크롤하지 않도록)
    useEffect(() => {
        if (!activePopup) return;
        const syncPopupTop = () => {
            if (headerRef.current) {
                const bottom = Math.max(headerRef.current.getBoundingClientRect().bottom, 56);
                setPopupTop(Math.round(bottom + 8));
            }
        };
        window.addEventListener('scroll', syncPopupTop, { passive: true });
        return () => window.removeEventListener('scroll', syncPopupTop);
    }, [activePopup]);

    // API State
    const [loading, setLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState<string>("");

    // Fetch Real Data on Mount with LocalStorage Caching (0ms load + background update)
    useEffect(() => {
        // 1. Try to load cached data from localStorage for instant 0ms render
        try {
            const cachedMain = localStorage.getItem('kospi_exit_main_data');
            const cachedCli = localStorage.getItem('kospi_exit_cli_data');
            const cachedMacro = localStorage.getItem('kospi_exit_macro_data');
            const cachedPer = localStorage.getItem('kospi_exit_per_data');

            if (cachedMain) {
                const data = JSON.parse(cachedMain);
                setBaseDollar(data.indicators.dollar);
                setBasePer(data.indicators.per);
                setBaseCli(data.indicators.cli);
                setDollarIndex(data.current_status.dollar);
                setDollarKrw(data.current_status.krw);
                setForwardPer(data.current_status.per);
                setOecdCliValue(data.current_status.cli);
                setOecdCliDownMonths(data.current_status.cli_down_months);
                setExitScore(data.risk?.score || data.current_score || 0);
                if (data.risk) setRiskData(data.risk);
                if (data.indicators.sentiment) {
                    setBaseSentiment(data.indicators.sentiment);
                    setVixValue(data.current_status.vix);
                    setFgiValue(data.current_status.fgi);
                    if (data.current_status.vkospi_proxy !== undefined) {
                        setVkospiValue(data.current_status.vkospi_proxy);
                    }
                }
                if (data.indicators.t10y2y) {
                    setBaseT10y2y(data.indicators.t10y2y);
                    if (data.current_status.t10y2y !== undefined) setT10y2yValue(data.current_status.t10y2y);
                }
                if (data.indicators.hy_spread) {
                    setBaseHySpread(data.indicators.hy_spread);
                    if (data.current_status.hy_spread !== undefined) setHySpreadValue(data.current_status.hy_spread);
                }
                setApiLoaded(true);
                setLoading(false); // Disable loading overlay immediately!
            }

            if (cachedCli) {
                const recent12 = JSON.parse(cachedCli);
                setBaseCli(recent12);
            }
            if (cachedMacro) {
                const macro1Y = JSON.parse(cachedMacro);
                setBaseDollar(macro1Y);
            }
            if (cachedPer) {
                const per1Y = JSON.parse(cachedPer);
                setBasePer(per1Y);
            }
        } catch (cacheErr) {
            console.warn("Failed to load exit-signal cache:", cacheErr);
        }

        // 2. Fetch fresh data from API in background to update the cache
        const fetchData = async () => {
            // 전체 로딩 상태는 초기 진입(전체 조회) 시에만 적용
            if (!selectedDate) {
                setLoading(true);
            }
            try {
                const url = selectedDate ? `${API_BASE}/api/v1/exit-signal?target_ym=${selectedDate}` : `${API_BASE}/api/v1/exit-signal`;
                const res = await fetch(url);
                if (res.ok) {
                    const data = await res.json();
                    
                    if (!selectedDate) {
                        // Cache the main endpoint data
                        localStorage.setItem('kospi_exit_main_data', JSON.stringify(data));

                        // Update main states
                        setBaseDollar(data.indicators.dollar);
                        setBasePer(data.indicators.per);
                        setBaseCli(data.indicators.cli);
                        setDollarIndex(data.current_status.dollar);
                        setDollarKrw(data.current_status.krw);
                        setForwardPer(data.current_status.per);
                        setOecdCliValue(data.current_status.cli);
                        setOecdCliDownMonths(data.current_status.cli_down_months);

                        if (data.indicators.sentiment) {
                            setBaseSentiment(data.indicators.sentiment);
                            setVixValue(data.current_status.vix);
                            setFgiValue(data.current_status.fgi);
                            if (data.current_status.vkospi_proxy !== undefined) {
                                setVkospiValue(data.current_status.vkospi_proxy);
                            }
                        }

                        if (data.indicators.t10y2y) {
                            setBaseT10y2y(data.indicators.t10y2y);
                            if (data.current_status.t10y2y !== undefined) setT10y2yValue(data.current_status.t10y2y);
                        }
                        if (data.indicators.hy_spread) {
                            setBaseHySpread(data.indicators.hy_spread);
                            if (data.current_status.hy_spread !== undefined) setHySpreadValue(data.current_status.hy_spread);
                        }
                    }

                    // Always update RiskGauge Data
                    setExitScore(data.risk?.score || data.current_score || 0);
                    if (data.risk) {
                        setRiskData(data.risk);
                    }

                    // Fetch other detail endpoints in parallel ONLY for initial load
                    if (!selectedDate) {
                        try {
                            const cliRes = await fetch(`${API_BASE}/api/v1/exit-signal/cli`);
                            if (cliRes.ok) {
                                const cliDataRaw = await cliRes.json();
                                if (cliDataRaw.length > 0) {
                                    const recent12 = cliDataRaw.slice(-12).map((item: any) => ({
                                        month: item.date.substring(5, 7) + '월',
                                        kor_cli: item.kor_cli,
                                        usa_cli: item.usa_cli,
                                        oecd_cli: item.oecd_cli
                                    }));
                                    setBaseCli(recent12);
                                    localStorage.setItem('kospi_exit_cli_data', JSON.stringify(recent12));

                                    const lastItem = cliDataRaw[cliDataRaw.length - 1];
                                    setOecdCliValue(lastItem.kor_cli);

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

                            const [macroRes, perRes] = await Promise.all([
                                fetch(`${API_BASE}/api/v1/exit-signal/macro?period=1Y`),
                                fetch(`${API_BASE}/api/v1/exit-signal/per?period=1Y`)
                            ]);
                            if (macroRes.ok) {
                                const macro1Y = await macroRes.json();
                                setBaseDollar(macro1Y);
                                localStorage.setItem('kospi_exit_macro_data', JSON.stringify(macro1Y));
                            }
                            if (perRes.ok) {
                                const per1Y = await perRes.json();
                                setBasePer(per1Y);
                                localStorage.setItem('kospi_exit_per_data', JSON.stringify(per1Y));
                            }
                        } catch (cliErr) {
                            console.error("Failed to fetch CLI/Macro/PER background data:", cliErr);
                        }
                    }
                }
            } catch (err) {
                console.error("Failed to fetch Exit Signal background data:", err);
            } finally {
                if (!selectedDate) {
                    setLoading(false);
                }
            }
        };
        fetchData();
    }, [selectedDate]);

    const chartDollar = baseDollar;
    const chartPer = basePer;
    const chartCli = baseCli;
    const chartSentiment = baseSentiment.length > 0 ? baseSentiment : [];
    const chartT10y2y = baseT10y2y;
    const chartHySpread = baseHySpread;

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
        return { level: 'danger', text: '추세 반전', color: 'text-rose-400', bg: 'bg-rose-400/10', border: 'border-rose-400/30' };
    };

    const getCliStatus = () => {
        if (oecdCliDownMonths === 0) return { level: 'safe', text: '확장 국면', color: 'text-emerald-400', bg: 'bg-emerald-400/10', border: 'border-emerald-400/30' };
        if (oecdCliDownMonths === 1) return { level: 'warning', text: '둔화 우려', color: 'text-amber-400', bg: 'bg-amber-400/10', border: 'border-amber-400/30' };
        return { level: 'danger', text: '수축 국면', color: 'text-rose-400', bg: 'bg-rose-400/10', border: 'border-rose-400/30', desc: '2개월 연속 하락' };
    };

    const getVixStatus = () => {
        if (vixValue < 15) return { level: 'safe', text: '안정', color: 'text-emerald-400', bg: 'bg-emerald-400/10', border: 'border-emerald-400/30' };
        if (vixValue <= 20) return { level: 'warning', text: '주의', color: 'text-amber-400', bg: 'bg-amber-400/10', border: 'border-amber-400/30' };
        if (vixValue <= 25) return { level: 'warning', text: '경계', color: 'text-orange-400', bg: 'bg-orange-400/10', border: 'border-orange-400/30' };
        return { level: 'danger', text: '공포 확산', color: 'text-rose-400', bg: 'bg-rose-400/10', border: 'border-rose-400/30' };
    };

    const getVkospiStatus = () => {
        if (vkospiValue < 15) return { level: 'safe', text: '안정', color: 'text-emerald-400', bg: 'bg-emerald-400/10', border: 'border-emerald-400/30' };
        if (vkospiValue <= 20) return { level: '주의', text: '주의', color: 'text-amber-400', bg: 'bg-emerald-400/10', border: 'border-amber-400/30' };
        if (vkospiValue <= 25) return { level: 'warning', text: '경계', color: 'text-orange-400', bg: 'bg-orange-400/10', border: 'border-orange-400/30' };
        return { level: 'danger', text: '위험 (변동성 극대)', color: 'text-rose-400', bg: 'bg-rose-400/10', border: 'border-rose-400/30' };
    };

    const getFgiStatus = () => {
        if (fgiValue < 25) return { level: 'safe', text: '극단적 공포(매수 기회)', color: 'text-emerald-400', bg: 'bg-emerald-400/10', border: 'border-emerald-400/30' };
        if (fgiValue <= 75) return { level: 'warning', text: '중립/탐욕', color: 'text-amber-400', bg: 'bg-amber-400/10', border: 'border-amber-400/30' };
        return { level: 'danger', text: '극단적 탐욕(매도 경고)', color: 'text-rose-400', bg: 'bg-rose-400/10', border: 'border-rose-400/30' };
    };

    const getT10y2yStatus = () => {
        const score = riskData.breakdown?.t10y2y?.score ?? 0;
        if (score === 0) return { level: 'safe', text: '안정', color: 'text-emerald-400', bg: 'bg-emerald-400/10', border: 'border-emerald-400/30' };
        if (score === 1) return { level: 'caution', text: '역전(주의)', color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30' };
        if (score === 2) return { level: 'warning', text: '심각한 역전(경계)', color: 'text-orange-400', bg: 'bg-orange-400/10', border: 'border-orange-400/30' };
        return { level: 'danger', text: '정상화(위험)', color: 'text-rose-400', bg: 'bg-rose-400/10', border: 'border-rose-400/30' };
    };

    const getHySpreadStatus = () => {
        const score = riskData.breakdown?.hy_spread?.score ?? 0;
        if (score === 0) return { level: 'safe', text: '안정', color: 'text-emerald-400', bg: 'bg-emerald-400/10', border: 'border-emerald-400/30' };
        if (score === 1) return { level: 'caution', text: '주의', color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30' };
        if (score === 2) return { level: 'warning', text: '경계', color: 'text-orange-400', bg: 'bg-orange-400/10', border: 'border-orange-400/30' };
        return { level: 'danger', text: '위험 (신용경색)', color: 'text-rose-400', bg: 'bg-rose-400/10', border: 'border-rose-400/30' };
    };

    const dStatus = getDollarStatus();
    const pStatus = getPerStatus();
    const cStatus = getCliStatus();
    const vStatus = getVixStatus();
    const vkStatus = getVkospiStatus();
    const fStatus = getFgiStatus();
    const tStatus = getT10y2yStatus();
    const hyStatus = getHySpreadStatus();

    const exitOverall = () => {
        if (exitScore >= 15) return { label: `위험 (매도 준비 | ${exitScore}/21점)`, color: 'text-rose-400', border: 'border-rose-500/40', bg: 'bg-rose-500/20' };
        if (exitScore >= 9) return { label: `경계 (비중 조절 | ${exitScore}/21점)`, color: 'text-amber-400', border: 'border-amber-500/40', bg: 'bg-amber-500/20' };
        if (exitScore >= 5) return { label: `주의 (예의 주시 | ${exitScore}/21점)`, color: 'text-orange-400', border: 'border-orange-500/40', bg: 'bg-orange-500/20' };
        return { label: `안정 (비중 확대 | ${exitScore}/21점)`, color: 'text-emerald-400', border: 'border-emerald-500/40', bg: 'bg-emerald-500/20' };
    };

    const getExitAnalysisText = () => {
        if (exitScore >= 15) return `종합 위험도가 ${exitScore}점으로 위험 수준입니다. 거시 지표 및 국내 변동성이 극대화되었으므로 주식 비중을 최소화하고 리스크 관리에 집중하세요.`;
        if (exitScore >= 9) return `종합 위험도가 ${exitScore}점입니다. 주요 거시 지표에서 불안 신호가 감지되고 있으므로 포트폴리오 비중을 선제적으로 조절하시기 바랍니다.`;
        if (exitScore >= 5) return `종합 위험도가 ${exitScore}점입니다. 일부 변동성 지표와 밸류에이션에서 미세한 주의 신호가 확인됩니다. 시장 추이를 예의주시하세요.`;
        return `종합 위험도가 ${exitScore}점으로 매우 안정적인 국면입니다. 거시 지표, 밸류에이션, 투자자 심리가 모두 양호하므로 적극적인 비중 확대를 추천합니다.`;
    };

    return (
        <div className="w-full flex flex-col gap-5 mb-2 relative">
            
            {/* Header section — sticky so it stays at top when scrolling */}
            <div
                ref={headerRef}
                className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#0d0d1a]/95 p-5 rounded-2xl border border-white/5 backdrop-blur-xl shadow-lg relative overflow-hidden"
                style={{ position: 'sticky', top: 0, zIndex: 40 }}
            >
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-[80px] pointer-events-none" />
                <div className="flex items-center gap-4 relative z-10">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 shrink-0">
                        <ShieldAlert className="w-6 h-6 text-white animate-pulse" />
                    </div>
                    <div>
                        <div className="flex flex-wrap items-center gap-3">
                            <h2 className="text-xl font-extrabold text-white tracking-tight">
                                코스피 출구 전략 모니터링 (Exit-Signal)
                            </h2>
                            <span className="px-2 py-0.5 text-[10px] font-bold text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 rounded-md">
                                Multi-Dimensional
                            </span>
                        </div>
                        <p className="text-xs text-gray-400 font-medium mt-0.5">VIX·VKOSPI 및 글로벌 매크로 인텔리전스 결합 분석</p>
                    </div>
                </div>
            </div>

            {/* Premium Bento Grid Layout */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-5">
                
                {/* Bento Card 1: Neon Risk Gauge Chart (Spans 2 columns on medium screens) */}
                <div className="md:col-span-2 h-full">
                    <RiskGaugeChart 
                        score={exitScore} 
                        maxScore={21} 
                        level={riskData.level} 
                        label={riskData.label} 
                        breakdown={riskData.breakdown} 
                        analysisText={getExitAnalysisText()}
                        selectedDate={selectedDate}
                        onDateChange={setSelectedDate}
                    />
                </div>

                {/* Bento Card 2: Dollar Index / Exchange Rate */}
                <div 
                    onClick={(e) => openPopup('dollar', e)} 
                    className="cursor-pointer bg-white/[0.02] border border-white/10 rounded-3xl p-4 flex flex-col justify-between hover:bg-white/[0.05] hover:scale-[1.01] hover:shadow-2xl transition-all duration-300 relative overflow-hidden group h-full"
                >
                    <div className="flex justify-between items-center mb-3">
                        <div className="flex items-center gap-2">
                            <span className="p-1.5 rounded-lg bg-white/5 border border-white/5">
                                <DollarSign className="w-4 h-4 text-emerald-400" />
                            </span>
                            <h4 className="text-white text-xs font-extrabold">달러 인덱스 및 환율</h4>
                        </div>
                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded border ${dStatus.bg} ${dStatus.color} ${dStatus.border}`}>
                            {dStatus.text}
                        </span>
                    </div>

                    <div className="flex items-baseline gap-2 mb-2">
                        <span className={`text-2xl font-black ${dStatus.color} font-mono transition-all duration-300`}>{dollarIndex.toFixed(2)}</span>
                        <span className={`text-xs ${dStatus.color} font-mono font-medium opacity-80 transition-all duration-300`}>({Math.round(dollarKrw)}원)</span>
                    </div>

                    <div className="flex-1 w-full min-h-[110px] -ml-2 -mb-2">
                        {loading ? (
                            <ChartLoadingPlaceholder height={110} />
                        ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartDollar} margin={{ top: 5, right: 6, left: 6, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.03)" />
                                <XAxis dataKey="date" hide={true} />
                                <YAxis yAxisId="left" domain={['auto', 'auto']} hide={true} />
                                <YAxis yAxisId="right" orientation="right" domain={['auto', 'auto']} hide={true} />
                                <RechartsTooltip
                                    contentStyle={{ backgroundColor: 'rgba(0,0,0,0.85)', border: '1px solid rgba(255,255,255,0.1)', fontSize: '10px', borderRadius: '8px' }}
                                    content={({ active, payload, label }) => {
                                        if (active && payload && payload.length) {
                                            const isLast = payload[0]?.payload === chartDollar[chartDollar.length - 1];
                                            const displayLabel = `${label} ${isLast ? '(최근)' : ''}`;
                                            return (
                                                <div className="bg-black/90 border border-white/10 p-2 rounded-lg text-[10px]">
                                                    <p className="text-gray-400 mb-1">{displayLabel}</p>
                                                    {payload.map((entry: any, index: number) => (
                                                        <div key={`item-${index}`} className="flex items-center gap-2 font-medium" style={{ color: entry.color }}>
                                                            <span>{entry.name === 'krw' ? 'USD/KRW' : 'DXY'} :</span>
                                                            <span>{entry.name === 'krw' ? `${Math.round(entry.value)}원` : entry.value.toFixed(2)}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            );
                                        }
                                        return null;
                                    }}
                                />
                                <Legend 
                                    verticalAlign="top" 
                                    height={18} 
                                    iconSize={6} 
                                    iconType="circle"
                                    wrapperStyle={{ fontSize: '9px', marginTop: '-5px', marginBottom: '5px' }} 
                                    formatter={(value) => <span className="text-[10px] text-gray-400 font-semibold">{value === 'DXY' ? '달러인덱스 (DXY)' : '원/달러 환율 (KRW)'}</span>}
                                />
                                <Line name="DXY" yAxisId="left" type="monotone" dataKey="dollar" stroke={dollarIndex >= 101.5 ? '#f43f5e' : (dollarIndex >= 100 ? '#f59e0b' : '#10b981')} strokeWidth={2} dot={false} />
                                <Line name="krw" yAxisId="right" type="monotone" dataKey="krw" stroke="#3b82f6" strokeWidth={1} strokeDasharray="3 3" dot={false} />
                            </LineChart>
                        </ResponsiveContainer>
                        )}
                    </div>

                    <div className="mt-3 text-[10px] text-gray-400 bg-black/30 p-2 rounded-xl flex items-start gap-1.5 border border-white/5">
                        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-indigo-400" />
                        <p>DXY 101.5 돌파 시 달러 초강세 국면으로 ETF 리스크 관리가 권장됩니다.</p>
                    </div>
                </div>

                {/* Bento Card 3: Forward P/E */}
                <div 
                    onClick={(e) => openPopup('per', e)} 
                    className="cursor-pointer bg-white/[0.02] border border-white/10 rounded-3xl p-4 flex flex-col justify-between hover:bg-white/[0.05] hover:scale-[1.01] hover:shadow-2xl transition-all duration-300 relative overflow-hidden group min-h-[250px]"
                >
                    <div className="flex justify-between items-center mb-3">
                        <div className="flex items-center gap-2">
                            <span className="p-1.5 rounded-lg bg-white/5 border border-white/5">
                                <BarChart2 className="w-4 h-4 text-blue-400" />
                            </span>
                            <h4 className="text-white text-xs font-extrabold">KOSPI 포워드 P/E</h4>
                        </div>
                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded border ${pStatus.bg} ${pStatus.color} ${pStatus.border}`}>
                            {pStatus.text}
                        </span>
                    </div>

                    <div className="flex items-baseline gap-2 mb-2">
                        <span className={`text-2xl font-black ${pStatus.color} font-mono transition-all duration-300`}>{forwardPer.toFixed(1)}x</span>
                        <span className="text-xs text-gray-400 font-medium">KOSPI 밸류에이션</span>
                    </div>

                    <div className="flex-1 w-full min-h-[110px] -ml-2 -mb-2">
                        {loading ? (
                            <ChartLoadingPlaceholder height={110} />
                        ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartPer} margin={{ top: 5, right: 6, left: 6, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.03)" />
                                <XAxis dataKey="month" hide={true} />
                                <YAxis yAxisId="left" hide={true} />
                                <YAxis yAxisId="right" orientation="right" hide={true} />
                                <RechartsTooltip
                                    contentStyle={{ backgroundColor: 'rgba(0,0,0,0.85)', border: '1px solid rgba(255,255,255,0.1)', fontSize: '10px', borderRadius: '8px' }}
                                    content={({ active, payload, label }) => {
                                        if (active && payload && payload.length) {
                                            return (
                                                <div className="bg-black/90 border border-white/10 p-2 rounded-lg text-[10px]">
                                                    <p className="text-gray-400 mb-1">{label}</p>
                                                    {payload.map((entry: any, index: number) => (
                                                        <div key={`item-${index}`} className="flex items-center gap-2 font-medium" style={{ color: entry.color }}>
                                                            <span>{entry.name === 'price' || entry.name === 'KOSPI' ? 'KOSPI' : 'P/E'} :</span>
                                                            <span>{entry.name === 'price' || entry.name === 'KOSPI' ? `${Math.round(entry.value).toLocaleString()}pt` : `${entry.value.toFixed(1)}x`}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            );
                                        }
                                        return null;
                                    }}
                                />
                                <Line name="P/E" yAxisId="left" type="monotone" dataKey="val" stroke={forwardPer >= 12.5 ? '#f43f5e' : '#10b981'} strokeWidth={2} dot={false} />
                                <Line name="KOSPI" yAxisId="right" type="monotone" dataKey="price" stroke="#3b82f6" strokeWidth={1} strokeDasharray="3 3" dot={false} />
                            </LineChart>
                        </ResponsiveContainer>
                        )}
                    </div>

                    <div className="mt-3 text-[10px] text-gray-400 bg-black/30 p-2 rounded-xl flex items-start gap-1.5 border border-white/5">
                        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-indigo-400" />
                        <p>PER 12.5배 터치 후 꺾이면 밸류에이션 한계 도달에 의한 매도 위험 신호입니다.</p>
                    </div>
                </div>

                {/* Bento Card 4: OECD CLI */}
                <div 
                    onClick={(e) => openPopup('cli', e)} 
                    className="cursor-pointer bg-white/[0.02] border border-white/10 rounded-3xl p-4 flex flex-col justify-between hover:bg-white/[0.05] hover:scale-[1.01] hover:shadow-2xl transition-all duration-300 relative overflow-hidden group min-h-[250px]"
                >
                    <div className="flex justify-between items-center mb-3">
                        <div className="flex items-center gap-2">
                            <span className="p-1.5 rounded-lg bg-white/5 border border-white/5">
                                <TrendingDown className="w-4 h-4 text-rose-400" />
                            </span>
                            <h4 className="text-white text-xs font-extrabold">경기 선행 지수 (CLI)</h4>
                        </div>
                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded border ${cStatus.bg} ${cStatus.color} ${cStatus.border}`}>
                            {cStatus.text}
                        </span>
                    </div>

                    <div className="flex items-baseline gap-2 mb-2">
                        <span className={`text-2xl font-black ${cStatus.color} font-mono transition-all duration-300`}>{oecdCliValue.toFixed(2)}</span>
                        {oecdCliDownMonths > 0 && (
                            <span className={`text-[10px] ${cStatus.color} font-bold flex items-center border ${cStatus.border} bg-white/5 px-1.5 py-0.5 rounded-md transition-all duration-300`}>
                                하락 {oecdCliDownMonths}개월째
                            </span>
                        )}
                    </div>

                    <div className="flex-1 w-full min-h-[110px] -ml-2 -mb-2">
                        {loading ? (
                            <ChartLoadingPlaceholder height={110} />
                        ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartCli} margin={{ top: 5, right: 6, left: 6, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.03)" />
                                <XAxis dataKey="month" hide={true} />
                                <YAxis domain={['auto', 'auto']} hide={true} />
                                <RechartsTooltip
                                    contentStyle={{ backgroundColor: 'rgba(0,0,0,0.85)', border: '1px solid rgba(255,255,255,0.1)', fontSize: '10px', borderRadius: '8px' }}
                                    content={({ active, payload, label }) => {
                                        if (active && payload && payload.length) {
                                            return (
                                                <div className="bg-black/90 border border-white/10 p-2 rounded-lg text-[10px]">
                                                    <p className="text-gray-400 mb-1">{label}</p>
                                                    {payload.map((entry: any, index: number) => {
                                                        const nameMap: any = { kor_cli: '한국 CLI', usa_cli: '미국 CLI', oecd_cli: 'G7 CLI' };
                                                        return (
                                                            <div key={`item-${index}`} className="flex items-center gap-2 font-medium" style={{ color: entry.color }}>
                                                                <span>{nameMap[entry.name] || entry.name} :</span>
                                                                <span>{entry.value.toFixed(2)}</span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            );
                                        }
                                        return null;
                                    }}
                                />
                                <Line name="kor_cli" type="monotone" dataKey="kor_cli" stroke={cStatus.level === 'danger' ? '#f43f5e' : (cStatus.level === 'warning' ? '#f59e0b' : '#10b981')} strokeWidth={2} dot={false} />
                                <Line name="usa_cli" type="monotone" dataKey="usa_cli" stroke="#3b82f6" strokeWidth={1} strokeDasharray="3 3" dot={false} />
                            </LineChart>
                        </ResponsiveContainer>
                        )}
                    </div>

                    <div className="mt-3 text-[10px] text-gray-400 bg-black/30 p-2 rounded-xl flex items-start gap-1.5 border border-white/5">
                        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-indigo-400" />
                        <p>2개월 연속 하락 국면 진입 시 국내 주식 비중을 단계적으로 하향 조절할 필요가 있습니다.</p>
                    </div>
                </div>

                {/* Bento Card 5: VIX & VKOSPI (Korean realized volatility proxy) */}
                <div 
                    onClick={(e) => openPopup('vix', e)} 
                    className="cursor-pointer bg-white/[0.02] border border-white/10 rounded-3xl p-4 flex flex-col justify-between hover:bg-white/[0.05] hover:scale-[1.01] hover:shadow-2xl transition-all duration-300 relative overflow-hidden group min-h-[250px]"
                >
                    <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center gap-2">
                            <span className="p-1.5 rounded-lg bg-white/5 border border-white/5">
                                <Activity className="w-4 h-4 text-purple-400" />
                            </span>
                            <h4 className="text-white text-xs font-extrabold">양국 변동성 (VIX & VKOSPI)</h4>
                        </div>
                        <div className="flex gap-1.5">
                            <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded border ${vStatus.bg} ${vStatus.color} ${vStatus.border}`}>
                                US {vStatus.text}
                            </span>
                            <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded border ${vkStatus.bg} ${vkStatus.color} ${vkStatus.border}`}>
                                KR {vkStatus.text}
                            </span>
                        </div>
                    </div>

                    <div className="flex gap-4 mb-2">
                        <div className="flex flex-col">
                            <span className="text-[9px] font-bold uppercase tracking-wider transition-all duration-300" style={{ color: vStatus.level === 'danger' ? '#f43f5e' : '#10b981' }}>VIX 공포지수</span>
                            <span className={`text-xl font-black ${vStatus.color} font-mono transition-all duration-300`}>{vixValue.toFixed(2)}</span>
                        </div>
                        <div className="w-px h-8 bg-white/10" />
                        <div className="flex flex-col">
                            <span className="text-[9px] font-bold uppercase tracking-wider transition-all duration-300" style={{ color: vkStatus.level === 'danger' ? '#ef4444' : '#f97316' }}>VKOSPI Proxy</span>
                            <span className={`text-xl font-black ${vkStatus.color} font-mono transition-all duration-300`}>{vkospiValue.toFixed(1)}%</span>
                        </div>
                    </div>

                    <div className="flex-1 w-full min-h-[100px] -ml-2 -mb-2">
                        {loading || baseSentiment.length === 0 ? (
                            <ChartLoadingPlaceholder height={100} message="변동성 데이터 로딩" />
                        ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartSentiment} margin={{ top: 5, right: 6, left: 6, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.03)" />
                                <XAxis dataKey="date" hide={true} />
                                <YAxis yAxisId="left" hide={true} />
                                <RechartsTooltip
                                    contentStyle={{ backgroundColor: 'rgba(0,0,0,0.85)', border: '1px solid rgba(255,255,255,0.1)', fontSize: '10px', borderRadius: '8px' }}
                                    content={({ active, payload, label }) => {
                                        if (active && payload && payload.length) {
                                            return (
                                                <div className="bg-black/90 border border-white/10 p-2 rounded-lg text-[10px]">
                                                    <p className="text-gray-400 mb-1">{label}</p>
                                                    {payload.map((entry: any, index: number) => (
                                                        <div key={`item-${index}`} className="flex items-center gap-2 font-medium" style={{ color: entry.color }}>
                                                            <span>{entry.name === 'vkospi_proxy' ? 'VKOSPI 프록시' : 'VIX'} :</span>
                                                            <span>{entry.value.toFixed(1)}{entry.name === 'vkospi_proxy' ? '%' : ''}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            );
                                        }
                                        return null;
                                    }}
                                />
                                <Line name="vix" yAxisId="left" type="monotone" dataKey="vix" stroke={vStatus.level === 'danger' ? '#f43f5e' : '#10b981'} strokeWidth={1.5} dot={false} />
                                <Line name="vkospi_proxy" yAxisId="left" type="monotone" dataKey="vkospi_proxy" stroke={vkStatus.level === 'danger' ? '#ef4444' : '#f97316'} strokeWidth={1.5} strokeDasharray="3 3" dot={false} />
                            </LineChart>
                        </ResponsiveContainer>
                        )}
                    </div>

                    <div className="mt-3 text-[10px] text-gray-400 bg-black/30 p-2 rounded-xl flex items-start gap-1.5 border border-white/5">
                        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-indigo-400" />
                        <p>KOSPI 20일 실현 변동성(VKOSPI 프록시)이 20% 초과 시 국내 변동성 급증 국면입니다.</p>
                    </div>
                </div>

                {/* Bento Card 6: Fear & Greed Index */}
                <div 
                    onClick={(e) => openPopup('fgi', e)} 
                    className="cursor-pointer bg-white/[0.02] border border-white/10 rounded-3xl p-4 flex flex-col justify-between hover:bg-white/[0.05] hover:scale-[1.01] hover:shadow-2xl transition-all duration-300 relative overflow-hidden group min-h-[250px]"
                >
                    <div className="flex justify-between items-center mb-3">
                        <div className="flex items-center gap-2">
                            <span className="p-1.5 rounded-lg bg-white/5 border border-white/5">
                                <Activity className="w-4 h-4 text-amber-400" />
                            </span>
                            <h4 className="text-white text-xs font-extrabold">Fear & Greed Index</h4>
                        </div>
                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded border ${fStatus.bg} ${fStatus.color} ${fStatus.border}`}>
                            {fStatus.text}
                        </span>
                    </div>

                    <div className="flex items-baseline gap-2 mb-2">
                        <span className={`text-2xl font-black ${fStatus.color} font-mono transition-all duration-300`}>{fgiValue.toFixed(1)}</span>
                        <span className="text-xs text-gray-400 font-medium">하이브리드 FGI</span>
                    </div>

                    <div className="flex-1 w-full min-h-[100px] -ml-2 -mb-2">
                        {loading || baseSentiment.length === 0 ? (
                            <ChartLoadingPlaceholder height={100} message="심리지표 로딩중" />
                        ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartSentiment} margin={{ top: 5, right: 6, left: 6, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.03)" />
                                <XAxis dataKey="date" hide={true} />
                                <YAxis hide={true} />
                                <RechartsTooltip
                                    contentStyle={{ backgroundColor: 'rgba(0,0,0,0.85)', border: '1px solid rgba(255,255,255,0.1)', fontSize: '10px', borderRadius: '8px' }}
                                    content={({ active, payload, label }) => {
                                        if (active && payload && payload.length) {
                                            return (
                                                <div className="bg-black/90 border border-white/10 p-2 rounded-lg text-[10px]">
                                                    <p className="text-gray-400 mb-1">{label}</p>
                                                    {payload.map((entry: any, index: number) => (
                                                        <div key={`item-${index}`} className="flex items-center gap-2 font-medium" style={{ color: entry.color }}>
                                                            <span>FGI :</span>
                                                            <span>{entry.value.toFixed(1)}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            );
                                        }
                                        return null;
                                    }}
                                />
                                <Line name="fgi" type="monotone" dataKey="fgi" stroke={fgiValue < 30 ? '#10b981' : (fgiValue >= 70 ? '#f43f5e' : '#f59e0b')} strokeWidth={2} dot={false} />
                            </LineChart>
                        </ResponsiveContainer>
                        )}
                    </div>

                    <div className="mt-3 text-[10px] text-gray-400 bg-black/30 p-2 rounded-xl flex items-start gap-1.5 border border-white/5">
                        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-indigo-400" />
                        <p>글로벌 탐욕(75배 이상) 진입 시 고점 경고, 극단적 공포(25 이하) 시 저점 매수 기회로 해독합니다.</p>
                    </div>
                </div>

                {/* Bento Card 7: US 10Y-2Y Spread */}
                <div 
                    onClick={(e) => openPopup('t10y2y', e)} 
                    className="cursor-pointer bg-white/[0.02] border border-white/10 rounded-3xl p-4 flex flex-col justify-between hover:bg-white/[0.05] hover:scale-[1.01] hover:shadow-2xl transition-all duration-300 relative overflow-hidden group min-h-[250px]"
                >
                    <div className="flex justify-between items-center mb-3">
                        <div className="flex items-center gap-2">
                            <span className="p-1.5 rounded-lg bg-white/5 border border-white/5">
                                <TrendingDown className="w-4 h-4 text-blue-400" />
                            </span>
                            <h4 className="text-white text-xs font-extrabold">미 장단기 금리차 (10Y-2Y)</h4>
                        </div>
                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded border ${tStatus.bg} ${tStatus.color} ${tStatus.border}`}>
                            {tStatus.text}
                        </span>
                    </div>

                    <div className="flex items-baseline gap-2 mb-2">
                        <span className={`text-2xl font-black ${tStatus.color} font-mono transition-all duration-300`}>{t10y2yValue.toFixed(2)}%</span>
                        <span className="text-xs text-gray-400 font-medium">국채 10년 - 2년</span>
                    </div>

                    <div className="flex-1 w-full min-h-[100px] -ml-2 -mb-2">
                        {loading || baseT10y2y.length === 0 ? (
                            <ChartLoadingPlaceholder height={100} message="장단기 금리차 로딩중" />
                        ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartT10y2y} margin={{ top: 5, right: 6, left: 6, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.03)" />
                                <XAxis dataKey="month" hide={true} />
                                <YAxis hide={true} domain={['auto', 'auto']} />
                                {/* Danger zone: inversion area */}
                                <ReferenceArea y1={-3} y2={0} strokeOpacity={0} fill="#ef4444" fillOpacity={0.10} />
                                {/* Reference lines: threshold boundaries */}
                                <ReferenceLine y={0} stroke="#ef4444" strokeWidth={1.2} strokeDasharray="3 3" />
                                <ReferenceLine y={-0.4} stroke="#f97316" strokeWidth={1} strokeDasharray="2 4" />
                                <RechartsTooltip
                                    contentStyle={{ backgroundColor: 'rgba(0,0,0,0.85)', border: '1px solid rgba(255,255,255,0.1)', fontSize: '10px', borderRadius: '8px' }}
                                    content={({ active, payload, label }) => {
                                        if (active && payload && payload.length) {
                                            const v = typeof payload[0].value === 'number' ? payload[0].value : Number(payload[0].value);
                                            const zoneColor = v < -0.4 ? '#f97316' : v < 0 ? '#eab308' : '#10b981';
                                            return (
                                                <div className="bg-black/90 border border-white/10 p-2 rounded-lg text-[10px]">
                                                    <p className="text-gray-400 mb-1">{label}</p>
                                                    <div className="flex items-center gap-2 font-medium" style={{ color: zoneColor }}>
                                                        <span>스프레드 :</span>
                                                        <span>{isNaN(v) ? 'N/A' : v.toFixed(2)}%p</span>
                                                    </div>
                                                </div>
                                            );
                                        }
                                        return null;
                                    }}
                                />
                                <Line name="t10y2y" type="monotone" dataKey="val" stroke={t10y2yValue < -0.4 ? '#f97316' : t10y2yValue < 0 ? '#eab308' : '#10b981'} strokeWidth={2} dot={false} />
                            </LineChart>
                        </ResponsiveContainer>
                        )}
                    </div>

                    <div className="mt-3 text-[10px] text-gray-400 bg-black/30 p-2 rounded-xl flex items-start gap-1.5 border border-white/5">
                        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-indigo-400" />
                        <p>금리 역전(0% 미만) 이후 급격한 정상화(Steepening) 시 경기 침체가 임박한 강력한 매도 신호입니다.</p>
                    </div>
                </div>

                {/* Bento Card 8: US High-Yield OAS */}
                <div 
                    onClick={(e) => openPopup('hy_spread', e)} 
                    className="cursor-pointer bg-white/[0.02] border border-white/10 rounded-3xl p-4 flex flex-col justify-between hover:bg-white/[0.05] hover:scale-[1.01] hover:shadow-2xl transition-all duration-300 relative overflow-hidden group min-h-[250px]"
                >
                    <div className="flex justify-between items-center mb-3">
                        <div className="flex items-center gap-2">
                            <span className="p-1.5 rounded-lg bg-white/5 border border-white/5">
                                <DollarSign className="w-4 h-4 text-purple-400" />
                            </span>
                            <h4 className="text-white text-xs font-extrabold">미 하이일드 스프레드 (OAS)</h4>
                        </div>
                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded border ${hyStatus.bg} ${hyStatus.color} ${hyStatus.border}`}>
                            {hyStatus.text}
                        </span>
                    </div>

                    <div className="flex items-baseline gap-2 mb-2">
                        <span className={`text-2xl font-black ${hyStatus.color} font-mono transition-all duration-300`}>{hySpreadValue.toFixed(2)}%</span>
                        <span className="text-xs text-gray-400 font-medium">크레딧 부도 위험</span>
                    </div>

                    <div className="flex-1 w-full min-h-[100px] -ml-2 -mb-2">
                        {loading || baseHySpread.length === 0 ? (
                            <ChartLoadingPlaceholder height={100} message="하이일드 스프레드 로딩중" />
                        ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartHySpread} margin={{ top: 5, right: 6, left: 6, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.03)" />
                                <XAxis dataKey="month" hide={true} />
                                <YAxis hide={true} domain={['auto', 'auto']} />
                                {/* Safe zone */}
                                <ReferenceArea y1={0} y2={3.5} strokeOpacity={0} fill="#10b981" fillOpacity={0.06} />
                                {/* Caution zone */}
                                <ReferenceArea y1={3.5} y2={5.0} strokeOpacity={0} fill="#eab308" fillOpacity={0.06} />
                                {/* Warning zone */}
                                <ReferenceArea y1={5.0} y2={6.5} strokeOpacity={0} fill="#f97316" fillOpacity={0.08} />
                                {/* Danger zone */}
                                <ReferenceArea y1={6.5} y2={20} strokeOpacity={0} fill="#ef4444" fillOpacity={0.10} />
                                {/* Threshold reference lines */}
                                <ReferenceLine y={3.5} stroke="#10b981" strokeWidth={1} strokeDasharray="2 4" />
                                <ReferenceLine y={5.0} stroke="#f97316" strokeWidth={1.2} strokeDasharray="3 3" />
                                <ReferenceLine y={6.5} stroke="#ef4444" strokeWidth={1} strokeDasharray="2 2" />
                                <RechartsTooltip
                                    contentStyle={{ backgroundColor: 'rgba(0,0,0,0.85)', border: '1px solid rgba(255,255,255,0.1)', fontSize: '10px', borderRadius: '8px' }}
                                    content={({ active, payload, label }) => {
                                        if (active && payload && payload.length) {
                                            const v = typeof payload[0].value === 'number' ? payload[0].value : Number(payload[0].value);
                                            const zoneColor = v >= 6.5 ? '#ef4444' : v >= 5.0 ? '#f97316' : v >= 3.5 ? '#eab308' : '#10b981';
                                            return (
                                                <div className="bg-black/90 border border-white/10 p-2 rounded-lg text-[10px]">
                                                    <p className="text-gray-400 mb-1">{label}</p>
                                                    <div className="flex items-center gap-2 font-medium" style={{ color: zoneColor }}>
                                                        <span>스프레드 :</span>
                                                        <span>{isNaN(v) ? 'N/A' : v.toFixed(2)}%</span>
                                                    </div>
                                                </div>
                                            );
                                        }
                                        return null;
                                    }}
                                />
                                <Line name="hy_spread" type="monotone" dataKey="val" stroke={hySpreadValue >= 6.5 ? '#ef4444' : hySpreadValue >= 5.0 ? '#f97316' : hySpreadValue >= 3.5 ? '#eab308' : '#10b981'} strokeWidth={2} dot={false} />
                            </LineChart>
                        </ResponsiveContainer>
                        )}
                    </div>

                    <div className="mt-3 text-[10px] text-gray-400 bg-black/30 p-2 rounded-xl flex items-start gap-1.5 border border-white/5">
                        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-indigo-400" />
                        <p>글로벌 신용 스프레드로, 5.0% 이상 돌파 시 신용 경색 우려가 높아지며 채권 위험관리가 필수적입니다.</p>
                    </div>
                </div>

            </div>

            {/* Exchange rate-stock decoupling guide with premium glassmorphism */}
            <div className="bg-indigo-950/20 border border-indigo-500/10 rounded-2xl p-4 flex items-start sm:items-center gap-3.5 mt-1 text-xs backdrop-blur-md relative overflow-hidden">
                <div className="absolute top-0 left-0 w-3 h-full bg-indigo-500/30" />
                <AlertTriangle className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5 sm:mt-0" />
                <p className="text-indigo-200/70 leading-relaxed pl-1">
                    <span className="font-extrabold text-indigo-300">💡 환율-증시 디커플링 예외 안내:</span> 원·달러 환율이 강세를 유지하고 있음에도 코스피 지수가 강하게 우상향하는 역사적 디커플링 현상을 종합 감안하여, 환율 외에도 국내 상위 기업 포워드 PER 밸류에이션 추세와 OECD CLI 경제 선행 주기 가중치를 고도화 적용하여 출구 전략 정합성을 극대화합니다.
                </p>
            </div>

            {/* Portal: document.body에 직접 렌더링 → overflow 컨테이너 영향 없음 */}
            {activePopup && isMounted && createPortal(
                <div
                    className="fixed left-0 right-0 bottom-0 z-[9999] flex items-start justify-center pt-2 px-4"
                    style={{ top: `${popupTop}px` }}
                    onClick={() => setActivePopup(null)}
                >
                    {/* 반투명 배경 */}
                    <div className="absolute inset-0 bg-black/85 backdrop-blur-sm transition-all duration-300" />

                    {/* 팝업 패널 — 컨텐츠 높이에 맞춤, floating card style */}
                    <div
                        className="relative w-full max-w-4xl bg-[#11111f] border border-white/10 rounded-2xl flex flex-col shadow-[0_15px_50px_rgba(0,0,0,0.85)] animate-in fade-in zoom-in-95 duration-200 overflow-hidden"
                        style={{ maxHeight: `calc(100vh - ${popupTop}px - 24px)` }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* 헤더 */}
                        <div className="flex justify-between items-center px-6 py-4.5 border-b border-white/5 shrink-0 bg-black/40">
                            <h2 className="text-sm font-black text-white flex items-center gap-2.5">
                                {activePopup === 'dollar' && <DollarSign className="w-4.5 h-4.5 text-emerald-400" />}
                                {activePopup === 'per' && <BarChart2 className="w-4.5 h-4.5 text-blue-400" />}
                                {activePopup === 'cli' && <TrendingDown className="w-4.5 h-4.5 text-rose-400" />}
                                {activePopup === 'vix' && <Activity className="w-4.5 h-4.5 text-purple-400" />}
                                {activePopup === 'fgi' && <Activity className="w-4.5 h-4.5 text-amber-400" />}
                                {activePopup === 't10y2y' && <TrendingDown className="w-4.5 h-4.5 text-blue-400" />}
                                {activePopup === 'hy_spread' && <DollarSign className="w-4.5 h-4.5 text-purple-400" />}
                                {activePopup === 'dollar' ? '달러 인덱스 & 환율 장기 추이 상세조회' :
                                    (activePopup === 'per' ? '주요 섹터 포워드 PER 밸류에이션 비교' :
                                        (activePopup === 'cli' ? '경기 선행 지수 (CLI) 매크로 주기 분석' :
                                            (activePopup === 'vix' ? 'VIX & VKOSPI 다차원 변동성 분석' :
                                                (activePopup === 'fgi' ? '글로벌 Fear & Greed Index 투자 심리' :
                                                    (activePopup === 't10y2y' ? '미국 국채 장단기 금리차 (10Y-2Y) 상세분석' : '미국 하이일드 채권 스프레드 (OAS) 상세분석')))))}
                            </h2>
                            <button onClick={() => setActivePopup(null)} className="p-1.5 bg-white/5 hover:bg-white/10 rounded-xl transition-colors text-gray-400 hover:text-white">
                                <X className="w-4.5 h-4.5" />
                            </button>
                        </div>

                        {/* 팝업 콘텐츠 */}
                        <div className="overflow-y-auto px-2 py-3 md:px-4 md:py-5">
                            {activePopup === 'dollar' && <DollarModalContent />}
                            {activePopup === 'per' && <PerModalContent />}
                            {activePopup === 'cli' && <CliModalContent />}
                            {activePopup === 'vix' && <SentimentModalContent isFgi={false} />}
                            {activePopup === 'fgi' && <SentimentModalContent isFgi={true} />}
                            {activePopup === 't10y2y' && <T10y2yModalContent />}
                            {activePopup === 'hy_spread' && <HySpreadModalContent />}
                        </div>
                    </div>
                </div>,
                document.body
            )}

        </div>
    );
}
