"use client";

import React, { useState, useEffect } from 'react';
import { Rocket, Zap, FlaskConical, Shield, Landmark, Cpu, Battery, TrendingUp, TrendingDown } from 'lucide-react';
import { API_BASE } from '../lib/apiConfig';

interface SectorStatus {
    name: string;
    current: number;
    change: number;
    change_pct: number;
    region: 'KR' | 'US';
    icon: React.ReactNode;
    color: string;
}

export default function SectorStatusGrid({ region }: { region: 'KR' | 'US' | 'ALL' }) {
    const [sectors, setSectors] = useState<SectorStatus[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Mocking current prices for now as we don't have a dedicated /sector-current endpoint yet
        // In a real scenario, we'd fetch this from the backend.
        // For now, I'll derive it from the last two points of the comparison data or just show a nice placeholder grid.
        
        const fetchCurrent = async () => {
            setIsLoading(true);
            try {
                // Fetch the last 2 days of data to calculate current change
                const res = await fetch(`${API_BASE}/api/v1/analyze/sector-comparison?region=${region}`);
                const data = await res.json();
                
                if (data.line_chart_data && data.line_chart_data.length >= 2) {
                    const latest = data.line_chart_data[data.line_chart_data.length - 1];
                    const prev = data.line_chart_data[data.line_chart_data.length - 2];
                    
                    const icons: any = {
                        '반도체': <Cpu />, 'Semi': <Cpu />,
                        '2차전지': <Battery />, 'Battery': <Battery />,
                        '바이오': <FlaskConical />, 'Bio': <FlaskConical />,
                        '금융': <Landmark />, 'Finance': <Landmark />,
                        '방산': <Shield />, 'Defense': <Shield />,
                        '우주': <Rocket />, 'Space': <Rocket />,
                        '에너지': <Zap />, 'Energy': <Zap />
                    };
                    
                    const colors: any = {
                        '반도체': 'from-blue-500 to-cyan-500',
                        '2차전지': 'from-emerald-500 to-teal-500',
                        '바이오': 'from-fuchsia-500 to-pink-500',
                        '금융': 'from-amber-500 to-orange-500',
                        '방산': 'from-slate-500 to-gray-500',
                        '우주': 'from-indigo-500 to-purple-500',
                        '에너지': 'from-rose-500 to-orange-500'
                    };

                    const results: SectorStatus[] = data.keys
                        .filter((k: string) => !k.includes('KOSPI') && !k.includes('S&P'))
                        .map((k: string) => {
                            const curVal = latest[k];
                            const prevVal = prev[k];
                            const change = curVal - prevVal;
                            const change_pct = (change / prevVal) * 100;
                            
                            // Find matching icon/color
                            const baseName = k.replace('K-', '').replace('US-', '');
                            
                            return {
                                name: k,
                                current: curVal,
                                change: change,
                                change_pct: change_pct,
                                region: k.startsWith('K-') ? 'KR' : 'US',
                                icon: icons[baseName] || <Activity />,
                                color: colors[baseName] || 'from-gray-500 to-slate-500'
                            };
                        });
                    
                    setSectors(results.sort((a, b) => Math.abs(b.change_pct) - Math.abs(a.change_pct)));
                }
            } catch (err) {
                console.error(err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchCurrent();
    }, [region]);

    if (isLoading) return <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 animate-pulse">
        {[...Array(7)].map((_, i) => (
            <div key={i} className="h-24 bg-white/5 rounded-2xl border border-white/5" />
        ))}
    </div>;

    return (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            {sectors.map((s) => (
                <div key={s.name} className="relative group overflow-hidden bg-[#1a1a23]/40 border border-white/5 rounded-2xl p-3 hover:border-white/20 transition-all">
                    <div className={`absolute top-0 right-0 w-12 h-12 bg-gradient-to-br ${s.color} opacity-10 blur-xl group-hover:opacity-20 transition-opacity`} />
                    
                    <div className="flex flex-col h-full justify-between gap-2">
                        <div className="flex items-center justify-between">
                            <div className={`p-1.5 rounded-lg bg-gradient-to-br ${s.color} shadow-lg shadow-black/20`}>
                                {React.cloneElement(s.icon as React.isValidElement, { className: 'w-3.5 h-3.5 text-white' })}
                            </div>
                            <span className="text-[10px] font-bold text-gray-500 uppercase">{s.region}</span>
                        </div>
                        
                        <div>
                            <div className="text-xs font-bold text-gray-300 truncate">{s.name}</div>
                            <div className={`flex items-center gap-1 text-sm font-black mt-0.5 ${s.change_pct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {s.change_pct >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                {Math.abs(s.change_pct).toFixed(2)}%
                            </div>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}

function Activity(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
        </svg>
    )
}
