import React, { useState, useEffect } from 'react';
import { ShieldAlert, TrendingDown, DollarSign, Activity, AlertTriangle, ArrowRight, Info, ChevronRight, BarChart2 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

// Mock Data for the 1-year Historical Trends (12 Months)
const mockDollarData = [
    { month: '25.03', val: 104.2 },
    { month: '25.04', val: 103.8 },
    { month: '25.05', val: 105.1 }, // Peak danger
    { month: '25.06', val: 104.5 },
    { month: '25.07', val: 102.3 },
    { month: '25.08', val: 101.8 },
    { month: '25.09', val: 100.9 },
    { month: '25.10', val: 99.5 },
    { month: '25.11', val: 98.2 },
    { month: '25.12', val: 97.4 },
    { month: '26.01', val: 96.8 },
    { month: '26.02 (현재)', val: 97.77 },
];

const mockPerData = [
    { month: '25.03', val: 9.8 },
    { month: '25.04', val: 9.5 },
    { month: '25.05', val: 9.1 },
    { month: '25.06', val: 9.9 },
    { month: '25.07', val: 10.4 },
    { month: '25.08', val: 10.9 },
    { month: '25.09', val: 11.2 },
    { month: '25.10', val: 11.5 },
    { month: '25.11', val: 11.8 },
    { month: '25.12', val: 12.1 },
    { month: '26.01', val: 12.6 }, // Touch danger line
    { month: '26.02 (현재)', val: 12.4 }, // Trend reversal dropping
];

const mockCliData = [
    { month: '25.03', val: 99.1 },
    { month: '25.04', val: 99.5 },
    { month: '25.05', val: 99.8 },
    { month: '25.06', val: 99.9 },
    { month: '25.07', val: 100.1 },
    { month: '25.08', val: 100.3 },
    { month: '25.09', val: 100.5 },
    { month: '25.10', val: 100.7 },
    { month: '25.11', val: 100.9 },
    { month: '25.12', val: 101.1 }, // Peak
    { month: '26.01', val: 100.8 }, // Drop 1
    { month: '26.02 (현재)', val: 100.4 }, // Drop 2 (Danger)
];

export default function KospiExitAnalyzer() {
    // State to hold mock values for the 3 key indicators
    const [dollarIndex, setDollarIndex] = useState(mockDollarData[11].val);
    const [forwardPer, setForwardPer] = useState(mockPerData[11].val);
    const [oecdCliValue, setOecdCliValue] = useState(mockCliData[11].val);
    const [oecdCliDownMonths, setOecdCliDownMonths] = useState(2); // Based on recent mock drops

    // Mock functions to allow user to simulate different scenarios
    const simulateDanger = () => {
        setDollarIndex(102.1);
        setForwardPer(12.6);
        setOecdCliValue(100.4);
        setOecdCliDownMonths(2);
    };

    const simulateSafe = () => {
        setDollarIndex(97.77);
        setForwardPer(10.5);
        setOecdCliValue(101.2);
        setOecdCliDownMonths(0);
    };

    const simulateWarning = () => {
        setDollarIndex(100.5);
        setForwardPer(11.8);
        setOecdCliValue(100.8);
        setOecdCliDownMonths(1);
    };

    // When simulators run, update out mock charts to visually reflect the new end-state
    const getChartData = (baseData: any[], currentVal: number) => {
        const newData = [...baseData];
        newData[newData.length - 1] = { ...newData[newData.length - 1], val: currentVal };
        return newData;
    };

    const chartDollar = getChartData(mockDollarData, dollarIndex);
    const chartPer = getChartData(mockPerData, forwardPer);
    const chartCli = getChartData(mockCliData, oecdCliValue);

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

    const isExitRequired = dStatus.level === 'danger' || pStatus.level === 'danger' || cStatus.level === 'danger';
    const isWarning = dStatus.level === 'warning' || pStatus.level === 'warning' || cStatus.level === 'warning';

    const getOverallStatus = () => {
        if (isExitRequired) return { label: '비중 축소 필요', color: 'text-rose-400', bannerBg: 'bg-rose-500/20 border-rose-500/50' };
        if (isWarning) return { label: '시장 경계 강화', color: 'text-amber-400', bannerBg: 'bg-amber-500/20 border-amber-500/50' };
        return { label: '보유 유지 (시장 우호적)', color: 'text-emerald-400', bannerBg: 'bg-emerald-500/20 border-emerald-500/50' };
    };

    const overall = getOverallStatus();

    return (
        <div className="w-full flex flex-col gap-4 mb-6">
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
                    <div className="p-3 bg-black/40 rounded-xl">
                        {isExitRequired ? <AlertTriangle className="w-8 h-8 text-rose-400 animate-pulse" /> : (isWarning ? <Activity className="w-8 h-8 text-amber-400" /> : <ShieldAlert className="w-8 h-8 text-emerald-400" />)}
                    </div>
                    <div>
                        <h3 className={`text-lg font-bold ${overall.color}`}>{overall.label}</h3>
                        <p className="text-sm text-gray-300 mt-1">
                            {isExitRequired
                                ? "3-No 원칙에 따라 감정적 투매를 자제하고, 10~30% 분할 익절표를 통한 스위칭을 검토하세요."
                                : (isWarning
                                    ? "지표가 경계 수준에 도달했습니다. 포트폴리오 다각화(안전자산 편입)를 준비할 시점입니다."
                                    : "현재 시장 환경은 주식 자산 편입에 우호적입니다. 수익 추구형 포트폴리오를 유지하세요.")}
                        </p>
                    </div>
                </div>
                {isExitRequired && (
                    <button className="mt-4 sm:mt-0 px-6 py-3 bg-rose-500 hover:bg-rose-600 text-white font-bold text-sm rounded-xl shadow-[0_0_15px_rgba(244,63,94,0.5)] transition-all flex items-center gap-2 shrink-0">
                        비중 축소 시뮬레이터 <ChevronRight className="w-4 h-4" />
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* 1. Dollar Index */}
                <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-5 flex flex-col justify-between hover:bg-white/[0.04] transition-colors relative overflow-hidden">
                    <div className="flex justify-between items-start mb-4">
                        <div className="flex flex-col">
                            <h4 className="text-gray-400 text-sm font-medium flex items-center gap-1.5"><DollarSign className="w-4 h-4" /> 달러 인덱스</h4>
                            <span className="text-3xl font-black text-white mt-2 font-mono">{dollarIndex.toFixed(2)}</span>
                        </div>
                        <span className={`px-2.5 py-1 text-xs font-bold rounded-lg border ${dStatus.bg} ${dStatus.color} ${dStatus.border}`}>
                            {dStatus.text}
                        </span>
                    </div>

                    <div className="h-[80px] w-full mt-2 -ml-2">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartDollar}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                                <YAxis domain={['auto', 'auto']} hide={true} />
                                <RechartsTooltip
                                    contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', border: '1px solid rgba(255,255,255,0.1)', fontSize: '11px' }}
                                    itemStyle={{ color: '#fff' }}
                                    formatter={(value: any) => [`${value}`, 'Index']}
                                    labelStyle={{ color: '#aaa', marginBottom: '4px' }}
                                />
                                <ReferenceLine y={100} stroke="#f59e0b" strokeDasharray="3 3" />
                                <ReferenceLine y={101.5} stroke="#f43f5e" strokeDasharray="3 3" />
                                <Line type="monotone" dataKey="val" stroke={dollarIndex >= 101.5 ? '#f43f5e' : (dollarIndex >= 100 ? '#f59e0b' : '#34d399')} strokeWidth={2} dot={{ r: 2, fill: '#121217' }} activeDot={{ r: 5 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="mt-4 text-xs text-gray-400 bg-black/40 p-3 rounded-xl flex items-start gap-2">
                        <Info className="w-4 h-4 shrink-0 mt-0.5 text-blue-400" />
                        <p>101.5 초과 시 본격적인 출구 전략 실행 검토 및 ETF 비중 축소를 권고합니다.</p>
                    </div>
                </div>

                {/* 2. Forward P/E */}
                <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-5 flex flex-col justify-between hover:bg-white/[0.04] transition-colors relative overflow-hidden">
                    <div className="flex justify-between items-start mb-2">
                        <div className="flex flex-col">
                            <h4 className="text-gray-400 text-sm font-medium flex items-center gap-1.5"><BarChart2 className="w-4 h-4" /> 포워드 PER</h4>
                            <span className="text-3xl font-black text-white mt-2 font-mono">{forwardPer.toFixed(1)}x</span>
                        </div>
                        <span className={`px-2.5 py-1 text-xs font-bold rounded-lg border ${pStatus.bg} ${pStatus.color} ${pStatus.border}`}>
                            {pStatus.text}
                        </span>
                    </div>

                    <div className="h-[80px] w-full mt-2 -ml-2">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartPer}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                                <YAxis domain={['auto', 'auto']} hide={true} />
                                <RechartsTooltip
                                    contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', border: '1px solid rgba(255,255,255,0.1)', fontSize: '11px' }}
                                    itemStyle={{ color: '#fff' }}
                                    formatter={(value: any) => [`${value}x`, 'P/E']}
                                    labelStyle={{ color: '#aaa', marginBottom: '4px' }}
                                />
                                <ReferenceLine y={12.5} stroke="#f59e0b" strokeDasharray="3 3" />
                                <Line type="monotone" dataKey="val" stroke={forwardPer >= 12.5 || pStatus.level === 'danger' ? '#f43f5e' : '#34d399'} strokeWidth={2} dot={{ r: 2, fill: '#121217' }} activeDot={{ r: 5 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="mt-2 text-xs text-gray-400 bg-black/40 p-3 rounded-xl flex items-start gap-2">
                        <Info className="w-4 h-4 shrink-0 mt-0.5 text-blue-400" />
                        <p>포워드 PER 12.5 터치 후 우하향 전환 시 '추세 반전'에 따른 강력 매도 시그널입니다.</p>
                    </div>
                </div>

                {/* 3. OECD CLI */}
                <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-5 flex flex-col justify-between hover:bg-white/[0.04] transition-colors relative overflow-hidden">
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

                    <div className="h-[80px] w-full mt-2 -ml-2">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartCli}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                                <YAxis domain={['auto', 'auto']} hide={true} />
                                <RechartsTooltip
                                    contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', border: '1px solid rgba(255,255,255,0.1)', fontSize: '11px' }}
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
        </div>
    );
}
