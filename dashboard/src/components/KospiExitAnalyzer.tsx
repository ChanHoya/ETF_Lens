import React, { useState, useEffect } from 'react';
import { ShieldAlert, TrendingDown, DollarSign, Activity, AlertTriangle, ArrowRight, Info, ChevronRight, BarChart2, X } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { DollarModalContent, PerModalContent, CliModalContent } from './ExitSignalModals';

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
    { month: '03월', val: 9.8, kospi: 2750 },
    { month: '04월', val: 9.5, kospi: 2680 },
    { month: '05월', val: 9.1, kospi: 2600 },
    { month: '06월', val: 9.9, kospi: 2700 },
    { month: '07월', val: 10.4, kospi: 2780 },
    { month: '08월', val: 10.9, kospi: 2850 },
    { month: '09월', val: 11.2, kospi: 2900 },
    { month: '10월', val: 11.5, kospi: 2930 },
    { month: '11월', val: 11.8, kospi: 2880 },
    { month: '12월', val: 12.1, kospi: 2800 },
    { month: '01월', val: 12.6, kospi: 2500 }, // Touch danger line
    { month: '02월', val: 12.4, kospi: 2450 }, // Trend reversal dropping
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

export default function KospiExitAnalyzer() {
    // Current Active Status
    const [dollarIndex, setDollarIndex] = useState(mockDollarData[11].val);
    const [dollarKrw, setDollarKrw] = useState(mockDollarData[11].krw);
    const [forwardPer, setForwardPer] = useState(mockPerData[11].val);
    const [oecdCliValue, setOecdCliValue] = useState(mockCliData[11].val);
    const [oecdCliDownMonths, setOecdCliDownMonths] = useState(2); // Based on recent mock drops

    // Chart Data State
    const [baseDollar, setBaseDollar] = useState([...mockDollarData]);
    const [basePer, setBasePer] = useState([...mockPerData]);
    const [baseCli, setBaseCli] = useState([...mockCliData]);

    // Popup State
    const [activePopup, setActivePopup] = useState<'dollar' | 'per' | 'cli' | null>(null);

    // API State
    const [loading, setLoading] = useState(true);
    const [isSimulating, setIsSimulating] = useState(false);

    // Fetch Real Data on Mount
    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await fetch('http://localhost:8000/api/v1/exit-signal');
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
                }
            } catch (err) {
                console.error("Failed to fetch Exit Signal data:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    // Mock functions to allow user to simulate different scenarios
    const simulateDanger = () => {
        setIsSimulating(true);
        setDollarIndex(102.1);
        setDollarKrw(1360);
        setForwardPer(12.6);
        setOecdCliValue(100.4);
        setOecdCliDownMonths(2);
    };

    const simulateSafe = () => {
        setIsSimulating(true);
        setDollarIndex(97.77);
        setDollarKrw(1280);
        setForwardPer(10.5);
        setOecdCliValue(101.2);
        setOecdCliDownMonths(0);
    };

    const simulateWarning = () => {
        setIsSimulating(true);
        setDollarIndex(100.5);
        setDollarKrw(1310);
        setForwardPer(11.8);
        setOecdCliValue(100.8);
        setOecdCliDownMonths(1);
    };

    // When simulators run, update out mock charts to visually reflect the new end-state
    const getChartData = (baseData: any[], currentVal: number, extraProps?: any) => {
        if (!isSimulating) return baseData; // Show raw data if not simulating
        const newData = [...baseData];
        newData[newData.length - 1] = { ...newData[newData.length - 1], val: currentVal, ...extraProps };
        return newData;
    };

    const chartDollar = getChartData(baseDollar, dollarIndex, { krw: dollarKrw });
    const chartPer = getChartData(basePer, forwardPer);
    const chartCli = getChartData(baseCli, oecdCliValue);

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

    const dStatus = getDollarStatus();
    const pStatus = getPerStatus();
    const cStatus = getCliStatus();

    const statuses = [dStatus.level, pStatus.level, cStatus.level];
    const dangerCount = statuses.filter(s => s === 'danger').length;
    const warningCount = statuses.filter(s => s === 'warning').length;
    const safeCount = statuses.filter(s => s === 'safe').length;

    const getOverallStatus = () => {
        if (dangerCount === 3) return { label: '강력 매도포지션 경계경보 발령', color: 'text-rose-500', bannerBg: 'bg-rose-600/30 border-rose-500/60 shadow-[0_0_20px_rgba(225,29,72,0.3)]', isExit: true, isWarn: false, isCritical: true };
        if (dangerCount >= 2) return { label: '위험/매도준비', color: 'text-rose-400', bannerBg: 'bg-rose-500/20 border-rose-500/40', isExit: true, isWarn: false, isCritical: false };
        if (warningCount >= 2) return { label: '시장 경계 강화', color: 'text-amber-400', bannerBg: 'bg-amber-500/20 border-amber-500/40', isExit: false, isWarn: true, isCritical: false };
        if (safeCount === 3) return { label: '안정 (보유 유지)', color: 'text-emerald-400', bannerBg: 'bg-emerald-500/20 border-emerald-500/40', isExit: false, isWarn: false, isCritical: false };

        // Mixed states fallback
        if (dangerCount === 1) return { label: '일부 지표 위험 (주의 요망)', color: 'text-rose-300', bannerBg: 'bg-rose-500/10 border-rose-500/30', isExit: false, isWarn: true, isCritical: false };
        if (warningCount === 1) return { label: '양호 (부분 관망)', color: 'text-emerald-300', bannerBg: 'bg-emerald-500/10 border-emerald-500/30', isExit: false, isWarn: false, isCritical: false };

        return { label: '상태 분석 중', color: 'text-gray-400', bannerBg: 'bg-gray-500/10 border-gray-500/20', isExit: false, isWarn: false, isCritical: false };
    };

    const overall = getOverallStatus();

    return (
        <div className="w-full flex flex-col gap-4 mb-6 relative">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold flex items-center gap-2 text-white">
                    <ShieldAlert className="w-6 h-6 text-indigo-400" />
                    코스피 출구 전략 모니터링 (Exit-Signal)
                </h2>
                <div className="flex gap-2">
                    <button onClick={simulateSafe} className="px-3 py-1 bg-emerald-500/20 text-emerald-300 text-xs rounded-lg hover:bg-emerald-500/30 transition-colors">안정 테스트</button>
                    <button onClick={simulateWarning} className="px-3 py-1 bg-amber-500/20 text-amber-300 text-xs rounded-lg hover:bg-amber-500/30 transition-colors">경계 테스트</button>
                    <button onClick={simulateDanger} className="px-3 py-1 bg-rose-500/20 text-rose-300 text-xs rounded-lg hover:bg-rose-500/30 transition-colors">위험 테스트</button>
                </div>
            </div>

            <div className={`w-full p-4 rounded-2xl border backdrop-blur-md flex flex-col sm:flex-row items-center justify-between transition-colors duration-500 ${overall.bannerBg}`}>
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-black/40 rounded-xl relative">
                        {overall.isCritical && <span className="absolute inset-0 bg-rose-500 blur-md opacity-50 animate-pulse rounded-xl"></span>}
                        {overall.isExit ? <AlertTriangle className="w-8 h-8 text-rose-400 relative z-10" /> : (overall.isWarn ? <Activity className="w-8 h-8 text-amber-400" /> : <ShieldAlert className="w-8 h-8 text-emerald-400" />)}
                    </div>
                    <div>
                        <h3 className={`text-lg font-bold flex items-center gap-2 ${overall.color}`}>
                            {overall.label}
                            {overall.isCritical && <span className="text-[10px] bg-rose-500 text-white px-2 py-0.5 rounded-full animate-bounce">CRITICAL</span>}
                        </h3>
                        <p className="text-sm text-gray-300 mt-1">
                            {overall.isCritical
                                ? "즉시 주식 비중을 최소화하고 ETF 인버스 등 현금화 출구 전략을 강력히 실행하세요!"
                                : (overall.isExit
                                    ? "3-No 원칙에 따라 감정적 투매를 자제하고, 10~30% 분할 익절표를 통한 스위칭을 검토하세요."
                                    : (overall.isWarn
                                        ? "지표가 경계 수준에 도달했습니다. 포트폴리오 다각화(안전자산 편입)를 준비할 시점입니다."
                                        : "현재 시장 환경은 주식 자산 편입에 우호적입니다. 수익 추구형 포트폴리오를 유지하세요."))}
                        </p>
                    </div>
                </div>
                {overall.isExit && (
                    <button className="mt-4 sm:mt-0 px-6 py-3 bg-rose-500 hover:bg-rose-600 text-white font-bold text-sm rounded-xl shadow-[0_0_15px_rgba(244,63,94,0.5)] transition-all flex items-center gap-2 shrink-0">
                        비중 축소 시뮬레이터 <ChevronRight className="w-4 h-4" />
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* 1. Dollar Index */}
                <div onClick={() => setActivePopup('dollar')} className="cursor-pointer bg-white/[0.02] border border-white/10 rounded-2xl p-5 flex flex-col justify-between hover:bg-white/[0.06] transition-colors relative overflow-hidden group">
                    <div className="flex justify-between items-start mb-4">
                        <div className="flex flex-col">
                            <h4 className="text-gray-400 text-sm font-medium flex items-center gap-1.5"><DollarSign className="w-4 h-4" /> 달러 인덱스/환율 추이</h4>
                            <span className="text-3xl font-black text-white mt-2 font-mono">{dollarIndex.toFixed(2)}</span>
                        </div>
                        <span className={`px-2.5 py-1 text-xs font-bold rounded-lg border ${dStatus.bg} ${dStatus.color} ${dStatus.border}`}>
                            {dStatus.text}
                        </span>
                    </div>

                    <div className="h-[120px] w-full mt-2 -ml-2 -mb-2">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartDollar} margin={{ top: 5, right: -15, left: -25, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                                <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#666' }} tickLine={false} axisLine={false} tickMargin={8} />
                                <YAxis yAxisId="left" domain={['auto', 'auto']} tick={{ fontSize: 10, fill: '#666' }} tickLine={false} axisLine={false} width={45} />
                                <YAxis yAxisId="right" orientation="right" domain={['auto', 'auto']} tick={{ fontSize: 10, fill: '#666' }} tickLine={false} axisLine={false} width={45} />
                                <RechartsTooltip
                                    contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', border: '1px solid rgba(255,255,255,0.1)', fontSize: '11px', borderRadius: '8px' }}
                                    itemStyle={{ color: '#fff' }}
                                    formatter={(value: any, name: any) => [name === 'val' ? value : `${value}원`, name === 'val' ? '달러 인덱스' : 'USD/KRW']}
                                    labelStyle={{ color: '#aaa', marginBottom: '4px' }}
                                />
                                <ReferenceLine yAxisId="left" y={100} stroke="#f59e0b" strokeDasharray="3 3" />
                                <ReferenceLine yAxisId="left" y={101.5} stroke="#f43f5e" strokeDasharray="3 3" />
                                <Line yAxisId="left" type="monotone" dataKey="val" stroke={dollarIndex >= 101.5 ? '#f43f5e' : (dollarIndex >= 100 ? '#f59e0b' : '#34d399')} strokeWidth={2} dot={{ r: 2, fill: '#121217' }} activeDot={{ r: 5 }} />
                                <Line yAxisId="right" type="monotone" dataKey="krw" stroke="#60a5fa" strokeWidth={1.5} strokeDasharray="4 4" dot={false} activeDot={{ r: 4 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="mt-4 text-xs text-gray-400 bg-black/40 p-3 rounded-xl flex items-start gap-2">
                        <Info className="w-4 h-4 shrink-0 mt-0.5 text-blue-400" />
                        <p>101.5 초과 시 본격적인 출구 전략 실행 검토 및 ETF 비중 축소를 권고합니다.</p>
                    </div>
                </div>

                {/* 2. Forward P/E */}
                <div onClick={() => setActivePopup('per')} className="cursor-pointer bg-white/[0.02] border border-white/10 rounded-2xl p-5 flex flex-col justify-between hover:bg-white/[0.06] transition-colors relative overflow-hidden group">
                    <div className="flex justify-between items-start mb-2">
                        <div className="flex flex-col">
                            <h4 className="text-gray-400 text-sm font-medium flex items-center gap-1.5"><BarChart2 className="w-4 h-4" /> 포워드 PER</h4>
                            <span className="text-3xl font-black text-white mt-2 font-mono">{forwardPer.toFixed(1)}x</span>
                        </div>
                        <span className={`px-2.5 py-1 text-xs font-bold rounded-lg border ${pStatus.bg} ${pStatus.color} ${pStatus.border}`}>
                            {pStatus.text}
                        </span>
                    </div>

                    <div className="h-[120px] w-full mt-2 -ml-2 -mb-2">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartPer} margin={{ top: 5, right: -15, left: -25, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                                <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#666' }} tickLine={false} axisLine={false} tickMargin={8} />
                                <YAxis yAxisId="left" domain={['auto', 'auto']} tick={{ fontSize: 10, fill: '#666' }} tickLine={false} axisLine={false} width={45} />
                                <YAxis yAxisId="right" orientation="right" domain={['auto', 'auto']} tick={{ fontSize: 10, fill: '#666' }} tickLine={false} axisLine={false} width={45} />
                                <RechartsTooltip
                                    contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', border: '1px solid rgba(255,255,255,0.1)', fontSize: '11px', borderRadius: '8px' }}
                                    itemStyle={{ color: '#fff' }}
                                    formatter={(value: any, name: any) => [name === 'val' ? `${value}x` : value, name === 'val' ? 'P/E' : 'KOSPI']}
                                    labelStyle={{ color: '#aaa', marginBottom: '4px' }}
                                />
                                <ReferenceLine yAxisId="left" y={12.5} stroke="#f59e0b" strokeDasharray="3 3" />
                                <Line yAxisId="left" type="monotone" dataKey="val" stroke={forwardPer >= 12.5 || pStatus.level === 'danger' ? '#f43f5e' : '#34d399'} strokeWidth={2} dot={{ r: 2, fill: '#121217' }} activeDot={{ r: 5 }} />
                                <Line yAxisId="right" type="monotone" dataKey="kospi" stroke="#60a5fa" strokeWidth={1.5} strokeDasharray="4 4" dot={false} activeDot={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="mt-2 text-xs text-gray-400 bg-black/40 p-3 rounded-xl flex items-start gap-2">
                        <Info className="w-4 h-4 shrink-0 mt-0.5 text-blue-400" />
                        <p>포워드 PER 12.5 터치 후 우하향 전환 시 '추세 반전'에 따른 강력 매도 시그널입니다.</p>
                    </div>
                </div>

                {/* 3. OECD CLI */}
                <div onClick={() => setActivePopup('cli')} className="cursor-pointer bg-white/[0.02] border border-white/10 rounded-2xl p-5 flex flex-col justify-between hover:bg-white/[0.06] transition-colors relative overflow-hidden group">
                    <div className="flex justify-between items-start mb-4">
                        <div className="flex flex-col">
                            <h4 className="text-gray-400 text-sm font-medium flex items-center gap-1.5"><TrendingDown className="w-4 h-4" /> 경기 선행 지수 (CLI)</h4>
                            <div className="flex items-end gap-2 mt-2">
                                <span className="text-3xl font-black text-white font-mono">
                                    {(100.2 - (oecdCliDownMonths * 0.4)).toFixed(1)}
                                </span>
                                {oecdCliDownMonths > 0 && <span className="text-rose-400 text-sm font-bold mb-1 flex items-center"><TrendingDown className="w-3 h-3 mr-0.5" /> 하락 {oecdCliDownMonths}M</span>}
                            </div>
                        </div>
                        <span className={`px-2.5 py-1 text-xs font-bold rounded-lg border ${cStatus.bg} ${cStatus.color} ${cStatus.border}`}>
                            {cStatus.text}
                        </span>
                    </div>

                    <div className="h-[120px] w-full mt-2 -ml-2 -mb-2">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartCli} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                                <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#666' }} tickLine={false} axisLine={false} tickMargin={8} />
                                <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10, fill: '#666' }} tickLine={false} axisLine={false} width={45} />
                                <RechartsTooltip
                                    contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', border: '1px solid rgba(255,255,255,0.1)', fontSize: '11px', borderRadius: '8px' }}
                                    itemStyle={{ color: '#fff' }}
                                    formatter={(value: any) => [`${value.toFixed(1)}`, 'CLI']}
                                    labelStyle={{ color: '#aaa', marginBottom: '4px' }}
                                />
                                <Line type="monotone" dataKey="val" stroke={cStatus.level === 'danger' ? '#f43f5e' : (cStatus.level === 'warning' ? '#f59e0b' : '#34d399')} strokeWidth={2} dot={{ r: 2, fill: '#121217' }} activeDot={{ r: 5 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="mt-4 text-xs text-gray-400 bg-black/40 p-3 rounded-xl flex items-start gap-2">
                        <Info className="w-4 h-4 shrink-0 mt-0.5 text-blue-400" />
                        <p>미국 및 G20 경기 선행 지수가 2개월 연속 하락 시, 국내 주식 비중 축소 자동 리포트가 발행됩니다.</p>
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

            {/* Popup Modals */}
            {activePopup && (
                <div className="absolute left-0 right-0 top-0 h-auto min-h-full z-[100] bg-[#121217] border border-white/10 rounded-3xl p-6 flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-between items-center mb-6 shrink-0">
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            {activePopup === 'dollar' && <DollarSign className="w-6 h-6 text-emerald-400" />}
                            {activePopup === 'per' && <BarChart2 className="w-6 h-6 text-blue-400" />}
                            {activePopup === 'cli' && <TrendingDown className="w-6 h-6 text-rose-400" />}
                            {activePopup === 'dollar' ? '달러 인덱스 & 환율 장기 추이 상세분석' : (activePopup === 'per' ? '주요 종목 포워드 PER 추이 비교' : '경기 선행 지수 (CLI) 기반 매크로 사이클 집중분석')}
                        </h2>
                        <button onClick={() => setActivePopup(null)} className="p-2 bg-white/5 hover:bg-white/10 rounded-xl transition-colors text-gray-400 hover:text-white">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Modal Content Placeholder */}
                    <div className="flex-1 w-full overflow-y-auto pr-2 pb-6">
                        {activePopup === 'dollar' && <DollarModalContent />}
                        {activePopup === 'per' && <PerModalContent />}
                        {activePopup === 'cli' && <CliModalContent />}
                    </div>
                </div>
            )}
        </div>
    );
}
