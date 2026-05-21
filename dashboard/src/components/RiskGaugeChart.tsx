import React, { useEffect, useState } from 'react';
import { AlertTriangle, ShieldCheck, ShieldAlert, Sparkles } from 'lucide-react';

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
}

export default function RiskGaugeChart({
    score,
    maxScore = 21,
    level,
    label,
    breakdown,
    analysisText
}: RiskGaugeChartProps) {
    const [animatedScore, setAnimatedScore] = useState(0);

    // Bouncy spring animation effect on score change
    useEffect(() => {
        const timer = setTimeout(() => {
            setAnimatedScore(score);
        }, 100);
        return () => clearTimeout(timer);
    }, [score]);

    // Color definitions
    const config = {
        safe: {
            color: '#10b981', // Emerald
            glow: 'rgba(16, 185, 129, 0.4)',
            bgGradient: 'from-emerald-500/10 to-teal-500/5',
            borderGlow: 'border-emerald-500/30',
            text: 'text-emerald-400',
            icon: <ShieldCheck className="w-5 h-5 text-emerald-400" />,
            badge: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300',
            action: '포트폴리오 비중 확대 권장 (안정 국면)'
        },
        caution: {
            color: '#eab308', // Yellow
            glow: 'rgba(234, 179, 8, 0.4)',
            bgGradient: 'from-yellow-500/10 to-amber-500/5',
            borderGlow: 'border-yellow-500/30',
            text: 'text-yellow-400',
            icon: <AlertTriangle className="w-5 h-5 text-yellow-400" />,
            badge: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-300',
            action: '자산 배분 및 예의 주시 (주의 국면)'
        },
        warning: {
            color: '#f97316', // Orange
            glow: 'rgba(249, 115, 22, 0.4)',
            bgGradient: 'from-orange-500/10 to-amber-600/5',
            borderGlow: 'border-orange-500/30',
            text: 'text-orange-400',
            icon: <AlertTriangle className="w-5 h-5 text-orange-400" />,
            badge: 'bg-orange-500/10 border-orange-500/20 text-orange-300',
            action: '일부 ETF 현금화 및 비중 조절 (경계 국면)'
        },
        danger: {
            color: '#ef4444', // Red
            glow: 'rgba(239, 68, 68, 0.4)',
            bgGradient: 'from-rose-500/10 to-red-600/5',
            borderGlow: 'border-rose-500/30',
            text: 'text-rose-400',
            icon: <ShieldAlert className="w-5 h-5 text-rose-400" />,
            badge: 'bg-rose-500/10 border-rose-500/20 text-rose-300',
            action: '출구 전략 즉시 실행 및 리스크 관리 극대화'
        }
    }[level] || {
        color: '#10b981',
        glow: 'rgba(16, 185, 129, 0.4)',
        bgGradient: 'from-emerald-500/10 to-teal-500/5',
        borderGlow: 'border-emerald-500/30',
        text: 'text-emerald-400',
        icon: <ShieldCheck className="w-5 h-5 text-emerald-400" />,
        badge: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300',
        action: '포트폴리오 비중 유지'
    };

    // Calculate rotation angle for needle (from -90deg to +90deg)
    const ratio = Math.max(0, Math.min(1, animatedScore / maxScore));
    const angle = -90 + ratio * 180;

    return (
        <div className={`w-full bg-gradient-to-br ${config.bgGradient} backdrop-blur-xl border ${config.borderGlow} rounded-3xl p-4 md:p-4.5 shadow-2xl transition-all duration-500 flex flex-col relative overflow-hidden group hover:shadow-[0_15px_40px_rgba(0,0,0,0.4)]`}>
            {/* Background glowing sphere */}
            <div 
                className="absolute -top-24 -left-24 w-48 h-48 rounded-full blur-[80px] pointer-events-none transition-all duration-700 opacity-60 group-hover:scale-125"
                style={{ backgroundColor: config.color }}
            />

            <div className="flex justify-between items-center mb-3 relative z-10">
                <div className="flex items-center gap-2">
                    <span className="p-2 rounded-xl bg-white/5 border border-white/10 shrink-0">
                        {config.icon}
                    </span>
                    <div>
                        <h3 className="text-white text-base font-extrabold flex items-center gap-1.5">
                            종합 위험지수
                            <span className="text-[10px] text-gray-400 bg-white/5 px-2 py-0.5 rounded-full border border-white/5 font-semibold font-mono">Exit Compass</span>
                        </h3>
                        <p className="text-[11px] text-gray-400 font-medium">실시간 다차원 매크로 감정 연산</p>
                    </div>
                </div>
            </div>

            <div className="flex flex-col lg:flex-row items-center lg:justify-around gap-3 lg:gap-5 relative z-10 mt-0.5">
                {/* Visual Gauge Column */}
                <div className="relative w-[240px] h-[135px] flex items-center justify-center select-none">
                    <svg className="w-full h-full overflow-visible" viewBox="0 0 100 55">
                        <defs>
                            {/* Track Gradients */}
                            <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" stopColor="#10b981" />    {/* Safe Green */}
                                <stop offset="40%" stopColor="#eab308" />   {/* Caution Yellow */}
                                <stop offset="70%" stopColor="#f97316" />   {/* Warning Orange */}
                                <stop offset="100%" stopColor="#ef4444" />  {/* Danger Red */}
                            </linearGradient>

                            {/* Drop Shadow for premium neon glow */}
                            <filter id="neonGlow" x="-20%" y="-20%" width="140%" height="140%">
                                <feDropShadow dx="0" dy="1.5" stdDeviation="1.5" floodColor={config.color} floodOpacity="0.8" />
                            </filter>
                        </defs>

                        {/* Background track arc (Semi-circle) */}
                        <path 
                            d="M 10 50 A 40 40 0 0 1 90 50" 
                            fill="none" 
                            stroke="rgba(255,255,255,0.06)" 
                            strokeWidth="9" 
                            strokeLinecap="round"
                        />

                        {/* Colored gradient track */}
                        <path 
                            d="M 10 50 A 40 40 0 0 1 90 50" 
                            fill="none" 
                            stroke="url(#gaugeGradient)" 
                            strokeWidth="9" 
                            strokeLinecap="round"
                            strokeDasharray="125.6" /* Circumference of r=40 is ~251.3, half is ~125.6 */
                            strokeDashoffset={125.6 - (125.6 * ratio)}
                            className="transition-all duration-1000 ease-out"
                            style={{ filter: 'url(#neonGlow)' }}
                        />

                        {/* Needle cap center */}
                        <circle cx="50" cy="50" r="4.5" fill="#12121e" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
                        <circle cx="50" cy="50" r="2" fill={config.color} style={{ filter: 'url(#neonGlow)' }} />

                        {/* Premium needle (with bouncy transition) */}
                        <g 
                            transform={`rotate(${angle}, 50, 50)`}
                            style={{ 
                                transition: 'transform 1.2s cubic-bezier(0.19, 1, 0.22, 1)',
                                transformOrigin: '50px 50px'
                            }}
                        >
                            {/* Needle body */}
                            <line 
                                x1="50" y1="50" 
                                x2="50" y2="14" 
                                stroke={config.color} 
                                strokeWidth="2" 
                                strokeLinecap="round" 
                                style={{ filter: 'url(#neonGlow)' }}
                            />
                            {/* Needle point arrow head */}
                            <polygon 
                                points="50,11 48,15 52,15" 
                                fill={config.color}
                                style={{ filter: 'url(#neonGlow)' }}
                            />
                        </g>

                        {/* Scale ticks */}
                        {[0, 0.25, 0.5, 0.75, 1].map((t, idx) => {
                            const tickAngle = -180 + t * 180;
                            const rad = (tickAngle * Math.PI) / 180;
                            const x1 = 50 + Math.cos(rad) * 33;
                            const y1 = 50 + Math.sin(rad) * 33;
                            const x2 = 50 + Math.cos(rad) * 30;
                            const y2 = 50 + Math.sin(rad) * 30;
                            return (
                                <line 
                                    key={idx} 
                                    x1={x1} y1={y1} 
                                    x2={x2} y2={y2} 
                                    stroke="rgba(255,255,255,0.2)" 
                                    strokeWidth="0.5" 
                                />
                            );
                        })}
                    </svg>

                    {/* Numeric overlay inside the gauge */}
                    <div className="absolute bottom-3 flex flex-col items-center">
                        <span className="text-3xl font-black text-white font-mono leading-none tracking-tight">
                            {score}
                            <span className="text-gray-500 text-xs font-normal font-sans ml-0.5">/{maxScore}점</span>
                        </span>
                        <span className={`text-[10px] font-bold ${config.text} uppercase tracking-wider mt-1 px-2 py-0.5 rounded-full bg-white/5 border border-white/5`}>
                            {label}
                        </span>
                    </div>
                </div>

                {/* Score Breakdown Column */}
                <div className="flex-1 w-full lg:max-w-[320px] flex flex-col gap-1 bg-black/35 p-2 rounded-2xl border border-white/5 backdrop-blur-md">
                    <span className="text-[9px] text-gray-400 font-bold tracking-wider uppercase mb-0.5">지표별 위험 기여도</span>
                    
                    {breakdown ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-1.5 text-[11px] font-medium font-mono text-gray-300">
                            {Object.entries(breakdown).map(([key, item]: [string, any]) => {
                                const barColor = item.score >= 3 ? '#ef4444' : (item.score >= 2 ? '#f97316' : (item.score >= 1 ? '#eab308' : '#10b981'));
                                return (
                                    <div key={key} className="flex flex-col gap-0.5 bg-white/[0.01] p-1 rounded-lg border border-white/5">
                                        <div className="flex justify-between items-center text-gray-400">
                                            <span className="text-[10px] font-semibold text-gray-200">{item.label}</span>
                                            <span className="text-[10px]">
                                                {key === 'cli' ? `${item.value.toFixed(2)}` : 
                                                 (key === 'vkospi_proxy' ? `${item.value.toFixed(1)}%` : 
                                                  (key === 'per' ? `${item.value.toFixed(1)}x` : 
                                                   (key === 't10y2y' ? `${item.value.toFixed(2)}` : 
                                                    (key === 'hy_spread' ? `${item.value.toFixed(2)}%` : `${item.value.toFixed(1)}`))))}
                                                <span className="text-[9px] text-gray-500 ml-1">({item.score}점)</span>
                                            </span>
                                        </div>
                                        {/* Score visual strip */}
                                        <div className="w-full h-0.5 bg-white/10 rounded-full overflow-hidden">
                                            <div 
                                                className="h-full rounded-full transition-all duration-1000 ease-out"
                                                style={{ 
                                                    width: `${(item.score / 3) * 100}%`,
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

            {/* Bottom Insight / Action Recommendation Bar - Redesigned to be extremely compact in a single box */}
            <div className="mt-2 pt-2 border-t border-white/5 relative z-10 text-[11px]">
                {(analysisText || config.action) && (
                    <div className="bg-white/[0.02] border border-white/10 rounded-xl p-2 text-xs leading-normal text-gray-300 font-medium relative overflow-hidden flex flex-col gap-1.5">
                        <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500/40" />
                        {analysisText && (
                            <div className="flex items-baseline flex-wrap gap-x-1.5">
                                <span className="text-white font-extrabold shrink-0 flex items-center gap-1">
                                    <span className="w-1 h-1 rounded-full bg-indigo-400 animate-pulse" />
                                    시장 진단:
                                </span>
                                <span className="text-gray-300 text-[11.5px]">{analysisText}</span>
                            </div>
                        )}
                        <div className="flex items-center gap-1.5 border-t border-white/5 pt-1 mt-0.5">
                            <span className="w-1.5 h-1.5 rounded-full animate-pulse shrink-0" style={{ backgroundColor: config.color }} />
                            <p className="text-gray-300 font-medium text-[11.5px]">
                                <span className="text-white font-extrabold mr-1">권장 액션:</span> 
                                <span className="text-indigo-200 font-bold">{config.action}</span>
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
