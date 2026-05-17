"use client";

import React, { useState, useEffect } from 'react';
import { Rocket, Zap, FlaskConical, Shield, Landmark, Cpu, Battery, TrendingUp, TrendingDown, Activity } from 'lucide-react';
import { API_BASE } from '../lib/apiConfig';

interface SectorStatus {
    name: string;
    baseName: string;
    current: number;
    change: number;
    change_pct: number;
    region: 'KR' | 'US';
    icon: React.ReactNode;
    color: string;
}

interface SectorGroup {
    baseName: string;
    kr?: SectorStatus;
    us?: SectorStatus;
}

const SECTOR_METADATA: any = {
    '반도체': { icon: <Cpu />, color: 'from-blue-500 to-cyan-500' },
    'Semi': { icon: <Cpu />, color: 'from-blue-500 to-cyan-500', alias: '반도체' },
    '2차전지': { icon: <Battery />, color: 'from-emerald-500 to-teal-500' },
    'Battery': { icon: <Battery />, color: 'from-emerald-500 to-teal-500', alias: '2차전지' },
    '바이오': { icon: <FlaskConical />, color: 'from-fuchsia-500 to-pink-500' },
    'Bio': { icon: <FlaskConical />, color: 'from-fuchsia-500 to-pink-500', alias: '바이오' },
    '금융': { icon: <Landmark />, color: 'from-amber-500 to-orange-500' },
    'Finance': { icon: <Landmark />, color: 'from-amber-500 to-orange-500', alias: '금융' },
    '방산': { icon: <Shield />, color: 'from-slate-500 to-gray-500' },
    'Defense': { icon: <Shield />, color: 'from-slate-500 to-gray-500', alias: '방산' },
    '우주': { icon: <Rocket />, color: 'from-indigo-500 to-purple-500' },
    'Space': { icon: <Rocket />, color: 'from-indigo-500 to-purple-500', alias: '우주' },
    '에너지': { icon: <Zap />, color: 'from-rose-500 to-orange-500' },
    'Energy': { icon: <Zap />, color: 'from-rose-500 to-orange-500', alias: '에너지' }
};

export default function SectorStatusGrid({ 
    region, 
    selectedSector, 
    onSelectSector 
}: { 
    region: 'KR' | 'US' | 'ALL',
    selectedSector: string | null,
    onSelectSector: (sector: string | null) => void
}) {
    const [groups, setGroups] = useState<SectorGroup[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const res = await fetch(`${API_BASE}/api/v1/analyze/sector-comparison?region=${region}`);
                const data = await res.json();
                
                if (data.line_chart_data && data.line_chart_data.length >= 2) {
                    const latest = data.line_chart_data[data.line_chart_data.length - 1];
                    const prev = data.line_chart_data[data.line_chart_data.length - 2];
                    
                    const rawSectors: SectorStatus[] = data.keys
                        .filter((k: string) => !k.includes('KOSPI') && !k.includes('S&P'))
                        .map((k: string) => {
                            const curVal = latest[k];
                            const prevVal = prev[k];
                            const change_pct = ((curVal - prevVal) / prevVal) * 100;
                            
                            const baseNameRaw = k.replace('K-', '').replace('US-', '');
                            const meta = SECTOR_METADATA[baseNameRaw] || {};
                            const baseName = meta.alias || baseNameRaw;
                            
                            return {
                                name: k,
                                baseName,
                                current: curVal,
                                change: curVal - prevVal,
                                change_pct,
                                region: k.startsWith('K-') ? 'KR' : 'US',
                                icon: meta.icon || <Activity />,
                                color: meta.color || 'from-gray-500 to-slate-500'
                            };
                        });
                    
                    // Grouping
                    const groupMap: Record<string, SectorGroup> = {};
                    rawSectors.forEach(s => {
                        if (!groupMap[s.baseName]) {
                            groupMap[s.baseName] = { baseName: s.baseName };
                        }
                        if (s.region === 'KR') groupMap[s.baseName].kr = s;
                        else groupMap[s.baseName].us = s;
                    });
                    
                    // Sort by average absolute change or just fixed order
                    const order = ['반도체', '2차전지', '바이오', '금융', '방산', '우주', '에너지'];
                    const sortedGroups = Object.values(groupMap).sort((a, b) => {
                        return order.indexOf(a.baseName) - order.indexOf(b.baseName);
                    });
                    
                    setGroups(sortedGroups);
                }
            } catch (err) {
                console.error(err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [region]);

    if (isLoading) return (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 animate-pulse">
            {[...Array(7)].map((_, i) => (
                <div key={i} className="h-32 bg-white/5 rounded-2xl border border-white/5" />
            ))}
        </div>
    );

    return (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            {groups.map((group) => {
                const isActive = selectedSector === group.baseName;
                const meta = SECTOR_METADATA[group.baseName] || SECTOR_METADATA[group.kr?.baseName || ''] || {};

                return (
                    <div 
                        key={group.baseName}
                        onClick={() => onSelectSector(isActive ? null : group.baseName)}
                        className={`relative flex flex-col gap-2 p-1.5 rounded-2xl border transition-all cursor-pointer group ${
                            isActive 
                            ? 'bg-indigo-500/10 border-indigo-500/50 shadow-[0_0_20px_rgba(99,102,241,0.2)]' 
                            : 'bg-[#1a1a23]/40 border-white/5 hover:border-white/20'
                        }`}
                    >
                        {/* Header: Sector Icon & Name */}
                        <div className="flex items-center gap-2 px-2 pt-1">
                            <div className={`p-1.5 rounded-lg bg-gradient-to-br ${meta.color || 'from-gray-500 to-slate-500'} shadow-lg shadow-black/20`}>
                                {React.cloneElement((meta.icon || <Activity />) as React.ReactElement<{ className?: string }>, { className: 'w-3.5 h-3.5 text-white' })}
                            </div>
                            <span className="text-xs font-black text-white">{group.baseName}</span>
                        </div>

                        {/* KR Card (Top) */}
                        {group.kr && (
                            <div className={`flex flex-col p-2 rounded-xl transition-all ${isActive ? 'bg-white/5' : 'bg-black/20 group-hover:bg-white/5'}`}>
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-[9px] font-bold text-blue-400">KOREA</span>
                                    <span className={`text-[11px] font-black ${group.kr.change_pct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                        {group.kr.change_pct >= 0 ? '+' : ''}{group.kr.change_pct.toFixed(2)}%
                                    </span>
                                </div>
                                <div className="text-[10px] text-gray-500 truncate font-medium">{group.kr.name}</div>
                            </div>
                        )}

                        {/* US Card (Bottom) */}
                        {group.us && (
                            <div className={`flex flex-col p-2 rounded-xl transition-all ${isActive ? 'bg-white/5' : 'bg-black/20 group-hover:bg-white/5'}`}>
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-[9px] font-bold text-amber-400">USA</span>
                                    <span className={`text-[11px] font-black ${group.us.change_pct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                        {group.us.change_pct >= 0 ? '+' : ''}{group.us.change_pct.toFixed(2)}%
                                    </span>
                                </div>
                                <div className="text-[10px] text-gray-500 truncate font-medium">{group.us.name}</div>
                            </div>
                        )}
                        
                        {/* Active Indicator */}
                        {isActive && (
                            <div className="absolute -top-1 -right-1 w-3 h-3 bg-indigo-500 rounded-full border-2 border-[#121217] shadow-lg shadow-indigo-500/50 animate-pulse" />
                        )}
                    </div>
                );
            })}
        </div>
    );
}
