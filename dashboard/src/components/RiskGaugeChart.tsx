// 코스피 출구 전략 종합 위험지수 시계열 추이 및 지표별 위험 기여도 대시보드 컴포넌트
import React, { useEffect, useState, useMemo } from 'react';
import { AlertTriangle, ShieldCheck, ShieldAlert, TrendingUp, Sparkles, RotateCcw, ChevronRight, Sliders } from 'lucide-react';
import { 
    AreaChart, 
    Area, 
    XAxis, 
    YAxis, 
    CartesianGrid, 
    Tooltip as RechartsTooltip, 
    ResponsiveContainer, 
    ReferenceLine 
} from 'recharts';
import { API_BASE } from '../lib/apiConfig';

interface RiskGaugeChartProps {
    score: number;
    maxScore?: number;
    level: 'safe' | 'caution' | 'warning' | 'danger';
    label: string;
    breakdown?: {
        vix: { value: number; score: number; label: string };
        vkospi_proxy: { value: number; score: number; label: string };
        fgi: { value: number; score: number; label: string };
        cli: { value: number; score: number; label: string };
        per: { value: number; score: number; label: string };
        t10y2y?: { value: number; score: number; label: string };
        hy_spread?: { value: number; score: number; label: string };
    };
    analysisText?: string;
    selectedDate?: string;
    onDateChange?: (date: string) => void;
    onOpenMetricModal?: (key: string) => void;
    onOpenSimulator?: () => void;
}

// 1Y 기간 기본 폴백 시계열 데이터 (2025.11 ~ 2026.10)
const FALLBACK_HISTORY_1Y = [
    { date: '2025-11-03', score: 3, level: 'safe', label: '안전', vix: 14.8, vkospi_proxy: 16.2 },
    { date: '2025-12-01', score: 4, level: 'safe', label: '안전', vix: 15.2, vkospi_proxy: 17.0 },
    { date: '2026-01-05', score: 5, level: 'caution', label: '주의', vix: 16.5, vkospi_proxy: 18.5 },
    { date: '2026-02-02', score: 4, level: 'safe', label: '안전', vix: 15.0, vkospi_proxy: 17.2 },
    { date: '2026-03-03', score: 6, level: 'caution', label: '주의', vix: 17.8, vkospi_proxy: 19.4 },
    { date: '2026-04-06', score: 8, level: 'caution', label: '주의', vix: 19.5, vkospi_proxy: 21.0 },
    { date: '2026-05-04', score: 5, level: 'caution', label: '주의', vix: 16.2, vkospi_proxy: 18.0 },
    { date: '2026-06-01', score: 4, level: 'safe', label: '안전', vix: 14.9, vkospi_proxy: 16.8 },
    { date: '2026-07-06', score: 7, level: 'caution', label: '주의', vix: 18.2, vkospi_proxy: 20.5 },
    { date: '2026-08-05', score: 11, level: 'warning', label: '경계', vix: 23.4, vkospi_proxy: 25.8 },
    { date: '2026-09-02', score: 8, level: 'caution', label: '주의', vix: 18.9, vkospi_proxy: 21.2 },
    { date: '2026-10-05', score: 12, level: 'warning', label: '경계', vix: 22.0, vkospi_proxy: 27.5 },
    { date: '2026-10-25', score: 15, level: 'danger', label: '위험', vix: 19.5, vkospi_proxy: 44.6 }
];

export default function RiskGaugeChart({
    score,
    maxScore = 21,
    level,
    label,
    breakdown,
    analysisText,
    selectedDate,
    onDateChange,
    onOpenMetricModal,
    onOpenSimulator
}: RiskGaugeChartProps) {
    const [period, setPeriod] = useState<'6M' | '1Y' | '3Y'>('1Y');
    const [history, setHistory] = useState<any[]>(FALLBACK_HISTORY_1Y);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [selectedSnapshot, setSelectedSnapshot] = useState<any | null>(null);

    // 활성 상태 (과거 특정 날짜를 클릭했으면 해당 시점 스냅샷 표시, 아니면 최신 실시간 표시)
    const activeScore = selectedSnapshot ? selectedSnapshot.score : score;
    const activeLevel = (selectedSnapshot ? selectedSnapshot.level : level) as 'safe' | 'caution' | 'warning' | 'danger';
    const activeLabel = selectedSnapshot ? selectedSnapshot.label : label;
    const activeBreakdown = selectedSnapshot?.breakdown || breakdown;
    const activeAnalysisText = selectedSnapshot?.diagnosis || analysisText;

    // Color definitions
    const configMapping: Record<string, any> = {
        safe: {
            color: '#10b981', // Emerald
            glow: 'rgba(16, 185, 129, 0.4)',
            bgGradient: 'from-emerald-500/10 to-teal-500/5',
            borderGlow: 'border-emerald-500/30',
            text: 'text-emerald-400',
            icon: <ShieldCheck className="w-4 h-4 text-emerald-400" />,
            badge: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300',
            action: '포트폴리오 비중 확대 권장 (안정 국면)'
        },
        caution: {
            color: '#eab308', // Yellow
            glow: 'rgba(234, 179, 8, 0.4)',
            bgGradient: 'from-yellow-500/10 to-amber-500/5',
            borderGlow: 'border-yellow-500/30',
            text: 'text-yellow-400',
            icon: <AlertTriangle className="w-4 h-4 text-yellow-400" />,
            badge: 'bg-yellow-500/15 border-yellow-500/30 text-yellow-300',
            action: '자산 배분 및 예의 주시 (주의 국면)'
        },
        warning: {
            color: '#f97316', // Orange
            glow: 'rgba(249, 115, 22, 0.4)',
            bgGradient: 'from-orange-500/10 to-amber-600/5',
            borderGlow: 'border-orange-500/30',
            text: 'text-orange-400',
            icon: <AlertTriangle className="w-4 h-4 text-orange-400" />,
            badge: 'bg-orange-500/15 border-orange-500/30 text-orange-300',
            action: '일부 ETF 현금화 및 비중 조절 (경계 국면)'
        },
        danger: {
            color: '#ef4444', // Red
            glow: 'rgba(239, 68, 68, 0.4)',
            bgGradient: 'from-rose-500/10 to-red-600/5',
            borderGlow: 'border-rose-500/30',
            text: 'text-rose-400',
            icon: <ShieldAlert className="w-4 h-4 text-rose-400" />,
            badge: 'bg-rose-500/15 border-rose-500/30 text-rose-300',
            action: '출구 전략 즉시 실행 및 리스크 관리 극대화'
        }
    };
    const config = configMapping[activeLevel] || configMapping.safe;
    const activeAction = selectedSnapshot?.action || config.action;

    // 기간별 시계열 데이터 비동기 호출
    useEffect(() => {
        let isCancelled = false;
        const fetchHistory = async () => {
            setIsLoading(true);
            try {
                const res = await fetch(`${API_BASE}/api/v1/exit-signal/history?period=${period}`);
                if (res.ok) {
                    const data = await res.json();
                    if (!isCancelled && Array.isArray(data) && data.length > 0) {
                        // 마지막 항목 점수를 현재 live score로 정밀 동기화
                        const mapped = [...data];
                        if (mapped.length > 0) {
                            mapped[mapped.length - 1] = {
                                ...mapped[mapped.length - 1],
                                score: score,
                                level: level,
                                label: label
                            };
                        }
                        setHistory(mapped);
                    }
                }
            } catch (err) {
                console.warn('Failed to fetch risk history, using fallback:', err);
            } finally {
                if (!isCancelled) setIsLoading(false);
            }
        };

        fetchHistory();
        return () => { isCancelled = true; };
    }, [period, score, level, label]);

    // 기간 내 최고 / 최저 위험점수 계산
    const stats = useMemo(() => {
        if (!history || history.length === 0) return { max: score, min: score };
        const validScores = history
            .map(h => typeof h.score === 'number' ? h.score : null)
            .filter((v): v is number => v !== null && v > 0);
        if (validScores.length === 0) return { max: score, min: score };
        return {
            max: Math.max(...validScores, score),
            min: Math.min(...validScores, score)
        };
    }, [history, score]);

    return (
        <div className={`w-full bg-gradient-to-br ${config.bgGradient} backdrop-blur-xl border ${config.borderGlow} rounded-3xl p-3 shadow-2xl transition-all duration-300 flex flex-col relative overflow-hidden group`}>
            {/* Background glowing sphere */}
            <div 
                className="absolute -top-24 -left-24 w-44 h-44 rounded-full blur-[70px] pointer-events-none transition-all duration-700 opacity-50"
                style={{ backgroundColor: config.color }}
            />

            {/* 헤더: 종합 위험지수 타이틀 및 기간(6M, 1Y, 3Y) 선택 버튼 */}
            <div className="flex justify-between items-center mb-1.5 relative z-10">
                <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-xl bg-white/5 border border-white/10 shrink-0">
                        {config.icon}
                    </span>
                    <div>
                        <h3 className="text-white text-[13px] font-extrabold flex items-center gap-1.5 leading-none">
                            종합 위험지수
                            <span className="text-[9px] text-gray-400 bg-white/5 px-1.5 py-0.5 rounded-full border border-white/5 font-semibold font-mono hidden sm:inline-block">
                                Exit Compass
                            </span>
                        </h3>
                        <p className="text-[10px] text-gray-400 font-medium mt-0.5 hidden sm:block">실시간 다차원 매크로 감정 연산</p>
                    </div>
                </div>

                {/* 기간(6M, 1Y, 3Y) 선택 버튼 바 */}
                <div className="flex items-center gap-1 bg-black/40 border border-white/10 rounded-lg p-0.5 shadow-inner">
                    {(['6M', '1Y', '3Y'] as const).map((p) => (
                        <button
                            key={p}
                            onClick={() => { setPeriod(p); setSelectedSnapshot(null); }}
                            className={`px-2 py-0.5 text-[10px] font-semibold rounded-md transition-all ${
                                period === p
                                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 font-bold'
                                    : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
                            }`}
                        >
                            {p}
                        </button>
                    ))}
                </div>
            </div>

            {/* 타임머신 스냅샷 복기 알림 배너 */}
            {selectedSnapshot && (
                <div className="mb-2 px-2.5 py-1.5 rounded-xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-between text-xs text-indigo-200 animate-in fade-in relative z-10">
                    <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
                        <span className="text-[11px]">
                            <strong>{selectedSnapshot.date}</strong> 과거 시점 복기 모드 (종합위험 <strong>{activeScore}점</strong>, {activeLabel})
                        </span>
                    </div>
                    <button
                        onClick={() => setSelectedSnapshot(null)}
                        className="px-2 py-0.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[10px] transition-all flex items-center gap-1 shadow-sm"
                    >
                        <RotateCcw className="w-3 h-3" /> 최신 시점으로 복귀
                    </button>
                </div>
            )}

            {/* 본문: 왼쪽 [위험지수 시계열 추이 그래프] vs 오른쪽 [지표별 위험 기여도 (컴팩트)] */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 relative z-10 items-stretch">
                
                {/* 왼쪽 컬럼: 위험지수 시계열 추이 그래프 (7 cols) */}
                <div className="lg:col-span-7 bg-black/30 border border-white/5 rounded-2xl p-2.5 flex flex-col justify-between">
                    {/* 상단 현재 수치 및 최고/최저 요약 라인 */}
                    <div className="flex items-center justify-between mb-1 px-1">
                        <div className="flex items-baseline gap-1.5">
                            <span className="text-2xl font-black text-white font-mono leading-none tracking-tight">
                                {activeScore}
                            </span>
                            <span className="text-[11px] font-medium text-gray-400 font-mono">
                                /{maxScore}점
                            </span>
                            <span className={`text-[10px] font-bold ${config.text} px-2 py-0.5 rounded-full bg-white/5 border border-white/10 ml-1`}>
                                {activeLabel}
                            </span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-mono text-gray-400">
                            <span>기간 최고 <strong className="text-rose-400">{stats.max}</strong>점</span>
                            <span className="text-gray-600">|</span>
                            <span>최저 <strong className="text-emerald-400">{stats.min}</strong>점</span>
                        </div>
                    </div>

                    {/* Recharts Area 차트 */}
                    <div className="h-[135px] w-full pt-1 cursor-pointer" title="차트 클릭 시 해당 과거 시점 지표 스냅샷 복기">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart 
                                data={history} 
                                margin={{ top: 8, right: 8, left: -24, bottom: 0 }}
                                onClick={(e) => {
                                    if (e && e.activePayload && e.activePayload.length) {
                                        const p = e.activePayload[0].payload;
                                        setSelectedSnapshot(p);
                                    }
                                }}
                            >
                                <defs>
                                    <linearGradient id="riskAreaGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={config.color} stopOpacity={0.45} />
                                        <stop offset="95%" stopColor={config.color} stopOpacity={0.0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="2 2" stroke="#ffffff08" vertical={false} />
                                <XAxis 
                                    dataKey="date" 
                                    stroke="#6b7280" 
                                    fontSize={9} 
                                    tickLine={false} 
                                    axisLine={false}
                                    tickFormatter={(d) => typeof d === 'string' && d.length >= 10 ? d.slice(5) : d}
                                    minTickGap={25}
                                />
                                <YAxis 
                                    domain={[0, 21]} 
                                    ticks={[0, 9, 15, 21]} 
                                    stroke="#6b7280" 
                                    fontSize={9} 
                                    tickLine={false} 
                                    axisLine={false}
                                />
                                <ReferenceLine 
                                    y={15} 
                                    stroke="#ef4444" 
                                    strokeDasharray="3 3" 
                                    strokeOpacity={0.7} 
                                />
                                <ReferenceLine 
                                    y={9} 
                                    stroke="#f97316" 
                                    strokeDasharray="3 3" 
                                    strokeOpacity={0.5} 
                                />
                                <RechartsTooltip 
                                    contentStyle={{ 
                                        backgroundColor: '#12141f', 
                                        borderColor: '#ffffff20',
                                        borderRadius: '8px',
                                        fontSize: '11px',
                                        padding: '6px 10px',
                                        color: '#fff'
                                    }}
                                    formatter={(val: any, name: any, item: any) => {
                                        const lvl = item.payload.label || (val >= 15 ? '위험' : val >= 9 ? '경계' : val >= 5 ? '주의' : '안전');
                                        return [`${val}점 (${lvl})`, '종합 위험지수'];
                                    }}
                                    labelFormatter={(d) => `${d} (클릭 시 당시 지표 복기)`}
                                />
                                <Area 
                                    type="monotone" 
                                    dataKey="score" 
                                    stroke={config.color} 
                                    strokeWidth={2} 
                                    fill="url(#riskAreaGrad)" 
                                    isAnimationActive={false}
                                    activeDot={{ r: 5, fill: config.color, stroke: '#fff', strokeWidth: 2 }}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>

                    {/* 위험 구간 범례 */}
                    <div className="flex items-center justify-between text-[9px] text-gray-400 border-t border-white/5 pt-1 px-1 font-mono">
                        <span className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            0~4 안전
                        </span>
                        <span className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
                            5~8 주의
                        </span>
                        <span className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
                            9~14 경계
                        </span>
                        <span className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                            15~21 위험
                        </span>
                    </div>
                </div>

                {/* 오른쪽 컬럼: 지표별 위험 기여도 (컴팩트 & 슬림) (5 cols) */}
                <div className="lg:col-span-5 bg-black/35 p-2 rounded-2xl border border-white/5 backdrop-blur-md flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-1 px-0.5">
                        <span className="text-[10px] text-gray-400 font-bold tracking-wider uppercase">
                            지표별 위험 기여도
                        </span>
                        <span className="text-[9px] text-gray-500 font-mono">클릭 시 10Y 모달</span>
                    </div>
                    
                    {activeBreakdown ? (
                        <div className="flex flex-col justify-between flex-1 gap-1 text-[10px] font-mono">
                            {Object.entries(activeBreakdown).map(([key, item]: [string, any]) => {
                                const barColor = item.score >= 3 ? '#ef4444' : (item.score >= 2 ? '#f97316' : (item.score >= 1 ? '#eab308' : '#10b981'));
                                return (
                                    <div 
                                        key={key} 
                                        onClick={() => onOpenMetricModal && onOpenMetricModal(key)}
                                        className="flex flex-col gap-0.5 bg-white/[0.02] hover:bg-white/[0.08] hover:border-indigo-500/40 px-1.5 py-0.5 rounded border border-white/5 cursor-pointer transition-all group/row"
                                        title="클릭 시 10년 상세 시계열 모달 열기"
                                    >
                                        <div className="flex justify-between items-center text-gray-400 leading-tight">
                                            <span className="text-[9.5px] font-semibold text-gray-200 truncate group-hover/row:text-indigo-300 transition-colors flex items-center gap-1">
                                                {item.label}
                                                <ChevronRight className="w-2.5 h-2.5 opacity-0 group-hover/row:opacity-100 text-indigo-400 transition-opacity" />
                                            </span>
                                            <span className="text-[9.5px] shrink-0">
                                                {key === 'cli' ? `${item.value.toFixed(2)}` : 
                                                 (key === 'vkospi_proxy' ? `${item.value.toFixed(1)}%` : 
                                                  (key === 'per' ? `${item.value.toFixed(1)}x` : 
                                                   (key === 't10y2y' ? `${item.value.toFixed(2)}` : 
                                                    (key === 'hy_spread' ? `${item.value.toFixed(2)}%` : `${item.value.toFixed(1)}`))))}
                                                <strong className={`ml-1 ${item.score >= 3 ? 'text-rose-400' : item.score >= 2 ? 'text-orange-400' : item.score >= 1 ? 'text-yellow-400' : 'text-emerald-400'}`}>
                                                    ({item.score}점)
                                                </strong>
                                            </span>
                                        </div>
                                        {/* Score visual strip */}
                                        <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                                            <div 
                                                className="h-full rounded-full transition-all duration-700 ease-out"
                                                style={{ 
                                                    width: `${Math.max(6, (item.score / 3) * 100)}%`,
                                                    backgroundColor: barColor 
                                                }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="text-[10px] text-gray-400 italic py-4 text-center">Breakdown details unavailable</div>
                    )}
                </div>
            </div>

            {/* 하단 인사이트 / 권장 액션 바 (슬림 & 간결) */}
            <div className="mt-2 pt-1.5 border-t border-white/5 relative z-10 text-[11px]">
                {(activeAnalysisText || activeAction) && (
                    <div className="bg-white/[0.02] border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-gray-300 font-medium relative overflow-hidden flex flex-col gap-1">
                        <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500/50" />
                        {activeAnalysisText && (
                            <div className="flex items-baseline flex-wrap gap-x-1.5">
                                <span className="text-white font-extrabold shrink-0 flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                                    시장 진단
                                </span>
                                <span className="text-gray-300 text-[11px] leading-snug">{activeAnalysisText}</span>
                            </div>
                        )}
                        <div className="flex items-center justify-between gap-1.5 border-t border-white/5 pt-0.5">
                            <div className="flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full animate-pulse shrink-0" style={{ backgroundColor: config.color }} />
                                <p className="text-gray-300 font-medium text-[11px] leading-snug">
                                    <span className="text-white font-extrabold mr-1">권장 액션</span> 
                                    <span className="text-indigo-200 font-bold">{activeAction}</span>
                                </p>
                            </div>
                            {onOpenSimulator && (
                                <button
                                    onClick={onOpenSimulator}
                                    className="px-2 py-0.5 rounded-lg bg-indigo-600/80 hover:bg-indigo-600 text-white font-bold text-[10px] flex items-center gap-1 shadow-sm transition-all shrink-0 hover:scale-[1.02] border border-indigo-400/30"
                                >
                                    <ShieldAlert className="w-3 h-3 text-rose-300" />
                                    내 자산 출구 시뮬레이션
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
