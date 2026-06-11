"use client";

import React, { useState, useEffect } from 'react';
import { Rocket, Zap, FlaskConical, Cpu, Battery, TrendingUp, TrendingDown, Activity, Ship, Layers } from 'lucide-react';
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
    '반도체소부장': { icon: <Layers />, color: 'from-indigo-500 to-blue-600' },
    'SemiParts': { icon: <Layers />, color: 'from-indigo-500 to-blue-600', alias: '반도체소부장' },
    '우주': { icon: <Rocket />, color: 'from-indigo-500 to-purple-500' },
    'Space': { icon: <Rocket />, color: 'from-indigo-500 to-purple-500', alias: '우주' },
    'AI전력': { icon: <Zap />, color: 'from-rose-500 to-orange-500' },
    'AI-Power': { icon: <Zap />, color: 'from-rose-500 to-orange-500', alias: 'AI전력' },
    '에너지': { icon: <Zap />, color: 'from-rose-500 to-orange-500', alias: 'AI전력' },
    'Energy': { icon: <Zap />, color: 'from-rose-500 to-orange-500', alias: 'AI전력' },
    '조선': { icon: <Ship />, color: 'from-slate-500 to-gray-500' },
    'Shipbuilding': { icon: <Ship />, color: 'from-slate-500 to-gray-500', alias: '조선' },
    '바이오': { icon: <FlaskConical />, color: 'from-fuchsia-500 to-pink-500' },
    'Bio': { icon: <FlaskConical />, color: 'from-fuchsia-500 to-pink-500', alias: '바이오' },
    '2차전지': { icon: <Battery />, color: 'from-emerald-500 to-teal-500' },
    'Battery': { icon: <Battery />, color: 'from-emerald-500 to-teal-500', alias: '2차전지' }
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
        const processData = (data: any) => {
            if (data.line_chart_data && data.line_chart_data.length >= 2) {
                const latest = data.line_chart_data[data.line_chart_data.length - 1];
                const prev = data.line_chart_data[data.line_chart_data.length - 2];
                
                const rawSectors: SectorStatus[] = data.keys
                    .filter((k: string) => !k.includes('KOSPI') && !k.includes('S&P'))
                    .map((k: string) => {
                        // Find the last two valid price points for this specific ticker
                        const validPoints = data.line_chart_data.filter(
                            (d: any) => d[k] !== undefined && d[k] !== null && d[k] > 0
                        );
                        
                        let curVal = 0;
                        let prevVal = 0;
                        let change_pct = 0;
                        
                        if (validPoints.length >= 2) {
                            curVal = validPoints[validPoints.length - 1][k];
                            prevVal = validPoints[validPoints.length - 2][k];
                            change_pct = ((curVal - prevVal) / prevVal) * 100;
                        } else if (validPoints.length === 1) {
                            curVal = validPoints[0][k];
                        }
                        
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
                const order = ['반도체', '반도체소부장', '우주', 'AI전력', '조선', '바이오', '2차전지'];
                const sortedGroups = Object.values(groupMap).sort((a, b) => {
                    return order.indexOf(a.baseName) - order.indexOf(b.baseName);
                });
                
                setGroups(sortedGroups);
            }
        };

        const loadCache = () => {
            try {
                const cached = localStorage.getItem(`sector_data_cache_${region}`);
                if (cached) {
                    const parsed = JSON.parse(cached);
                    processData(parsed);
                    setIsLoading(false);
                }
            } catch (e) {
                console.error('Failed to load cached sector status grid data', e);
            }
        };

        const fetchData = async () => {
            let hasCache = false;
            try {
                const cached = localStorage.getItem(`sector_data_cache_${region}`);
                if (cached) {
                    hasCache = true;
                }
            } catch (e) {}

            if (!hasCache) {
                setIsLoading(true);
            }
            
            try {
                const res = await fetch(`${API_BASE}/api/v1/analyze/sector-comparison?region=${region}`);
                const data = await res.json();
                processData(data);
                
                // Save to cache
                localStorage.setItem(`sector_data_cache_${region}`, JSON.stringify(data));
            } catch (err) {
                console.error(err);
            } finally {
                setIsLoading(false);
            }
        };

        loadCache();
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
                        <div className="flex items-center gap-2.5 px-2 pt-1.5">
                            <div className={`p-1.5 md:p-2 rounded-xl bg-gradient-to-br ${meta.color || 'from-gray-500 to-slate-500'} shadow-lg shadow-black/20`}>
                                {React.cloneElement((meta.icon || <Activity />) as React.ReactElement<{ className?: string }>, { className: 'w-4 h-4 md:w-4.5 h-4.5 text-white' })}
                            </div>
                            <span className="text-sm md:text-base font-black text-white">{group.baseName}</span>
                        </div>

                        {/* KR Card (Top) */}
                        {group.kr && (
                            <div className={`flex flex-col p-2.5 rounded-xl transition-all ${isActive ? 'bg-white/5' : 'bg-black/20 group-hover:bg-white/5'}`}>
                                <div className="flex items-center justify-between mb-1.5">
                                    <span className="text-[11px] md:text-xs font-black text-blue-400">KOREA</span>
                                    <span className={`text-xs md:text-sm font-black ${group.kr.change_pct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                        {group.kr.change_pct >= 0 ? '+' : ''}{group.kr.change_pct.toFixed(2)}%
                                    </span>
                                </div>
                                <div className="text-[11px] md:text-xs text-gray-400 truncate font-bold">{group.kr.name}</div>
                            </div>
                        )}

                        {/* US Card (Bottom) */}
                        {group.us && (
                            <div className={`flex flex-col p-2.5 rounded-xl transition-all ${isActive ? 'bg-white/5' : 'bg-black/20 group-hover:bg-white/5'}`}>
                                <div className="flex items-center justify-between mb-1.5">
                                    <span className="text-[11px] md:text-xs font-black text-amber-400">USA</span>
                                    <span className={`text-xs md:text-sm font-black ${group.us.change_pct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                        {group.us.change_pct >= 0 ? '+' : ''}{group.us.change_pct.toFixed(2)}%
                                    </span>
                                </div>
                                <div className="text-[11px] md:text-xs text-gray-400 truncate font-bold">{group.us.name}</div>
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
