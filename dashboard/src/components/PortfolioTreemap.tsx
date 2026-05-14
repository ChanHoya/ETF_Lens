'use client';

import React, { useState } from 'react';

/* eslint-disable @typescript-eslint/no-explicit-any */

// ─── 그룹 설정 ───────────────────────────────────────────────────────────────
const GROUP_CONFIG: Record<string, { label: string; accentColor: string; bgBase: string }> = {
    'KOSPI':   { label: 'KOSPI',        accentColor: '#3b82f6', bgBase: '#0f172a' },
    'KOSDAQ':  { label: 'KOSDAQ',       accentColor: '#14b8a6', bgBase: '#0a1e1c' },
    'NASDAQ':  { label: 'NASDAQ',       accentColor: '#8b5cf6', bgBase: '#1a0b2e' },
    'S&P 500': { label: 'S&P 500',      accentColor: '#f43f5e', bgBase: '#1f0a0f' },
    '자원':    { label: '자원 (금·은)', accentColor: '#f59e0b', bgBase: '#1c1100' },
    '현금':    { label: '현금·예수금',  accentColor: '#78716c', bgBase: '#111110' },
};

const GROUP_ORDER = ['KOSPI', 'KOSDAQ', 'NASDAQ', 'S&P 500', '자원', '현금'];

// ─── 분류 함수 ────────────────────────────────────────────────────────────────
function categorize(name: string, code: string = '', isCash = false): string {
    if (isCash) return '현금';
    if (!name)  return 'KOSPI';
    const n = name.toUpperCase();
    if (n.includes('금현물') || n.includes('국제금') || n.includes('은현물') || n.includes('금선물') || n.includes('gold')) return '자원';
    if (n.includes('머니마켓') || n.includes('cd금리') || n.includes('kofr') || n.includes('단기채') || n.includes('파킹')) return '현금';
    if (n.includes('미국성장') || n.includes('미국우주항공') || n.includes('미국우주테크') || n.includes('미국양자컴퓨팅') || n.includes('나스닥') || n.includes('nasdaq') || n.includes('빅테크') || n.includes('qqq') || n.includes('성장커버드콜') || n.includes('성장 커버드콜')) return 'NASDAQ';
    if (n.includes('미국배당') || n.includes('s&p500') || n.includes('s&p 500')) return 'S&P 500';
    if (n.includes('위탁') && code === '') return '현금';
    if (n.includes('코스닥') || n.includes('kosdaq') || n.includes('바이오') || n.includes('헬스케어') || n.includes('2차전지')) return 'KOSDAQ';
    if (code && /^[A-Za-z]+(\.[A-Za-z]+)?$/.test(code)) return 'NASDAQ';
    if (n.includes('미국')) return 'S&P 500';
    return 'KOSPI';
}

// ─── 수익률 → 셀 배경색 ──────────────────────────────────────────────────────
function getReturnBg(rate: number): string {
    if (rate >= 5)  return 'rgba(22,163,74,0.90)';
    if (rate >= 3)  return 'rgba(21,128,61,0.80)';
    if (rate >= 1)  return 'rgba(20,83,45,0.70)';
    if (rate >= 0)  return 'rgba(14,48,28,0.55)';
    if (rate >= -1) return 'rgba(60,15,15,0.55)';
    if (rate >= -3) return 'rgba(127,29,29,0.75)';
    if (rate >= -5) return 'rgba(153,27,27,0.85)';
    return 'rgba(185,28,28,0.95)';
}

function getReturnText(rate: number): string {
    return rate >= 0 ? '#86efac' : '#fca5a5';
}

// ─── 타입 ─────────────────────────────────────────────────────────────────────
interface StockCell {
    name: string;
    code: string;
    value: number;
    returnRate: number;
    group: string;
    pct: number;       // 전체 대비 %
    groupPct: number;  // 그룹 내 %
}

interface TooltipState {
    visible: boolean;
    x: number; y: number;
    cell: StockCell;
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface Props {
    holdings: any[];
    cashBalance: number;
    totalAsset: number;
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────
export default function PortfolioTreemap({ holdings, cashBalance, totalAsset }: Props) {
    const [tooltip, setTooltip] = useState<TooltipState | null>(null);
    const [hoveredGroup, setHoveredGroup] = useState<string | null>(null);

    const fmt = (v: number) => new Intl.NumberFormat('ko-KR').format(Math.floor(v));
    const fmtPct = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;

    // ─── 데이터 빌드 ──────────────────────────────────────────────────────────
    const groupMap: Record<string, StockCell[]> = {};
    GROUP_ORDER.forEach(g => { groupMap[g] = []; });

    if (cashBalance > 0) {
        groupMap['현금'].push({ name: '예수금·CMA', code: '', value: cashBalance, returnRate: 0, group: '현금', pct: 0, groupPct: 0 });
    }

    // 종목 병합 로직 (계좌 통합)
    const mergedObj: Record<string, any> = {};
    holdings.forEach((h: any) => {
        const val = h.eval_amount || 0;
        if (val <= 0) return;
        
        // 종목코드보다 이름(띄어쓰기 제거)을 기준으로 병합 (A붙은 코드 등 오류 방지)
        const key = h.name ? h.name.replace(/\s+/g, '').toUpperCase() : (h.code || 'UNKNOWN');
        
        if (!mergedObj[key]) {
            mergedObj[key] = {
                name: h.name,
                code: h.code,
                eval_amount: 0,
                profit_loss: 0,
                invested: 0
            };
        }
        mergedObj[key].eval_amount += val;
        mergedObj[key].profit_loss += (h.profit_loss || 0);
        mergedObj[key].invested += (val - (h.profit_loss || 0));
    });

    Object.values(mergedObj).forEach((m: any) => {
        const g = categorize(m.name, m.code);
        const return_rate = m.invested > 0 ? (m.profit_loss / m.invested) * 100 : 0;
        groupMap[g].push({ 
            name: m.name, 
            code: m.code, 
            value: m.eval_amount, 
            returnRate: return_rate, 
            group: g, 
            pct: 0, 
            groupPct: 0 
        });
    });

    // 정렬 + 비중 계산
    const activeGroups = GROUP_ORDER.filter(g => groupMap[g].length > 0);
    const groupTotals: Record<string, number> = {};
    activeGroups.forEach(g => {
        groupTotals[g] = groupMap[g].reduce((s, c) => s + c.value, 0);
        groupMap[g].sort((a, b) => b.value - a.value);
        groupMap[g].forEach(cell => {
            cell.pct = totalAsset > 0 ? (cell.value / totalAsset) * 100 : 0;
            cell.groupPct = groupTotals[g] > 0 ? (cell.value / groupTotals[g]) * 100 : 0;
        });
    });

    const grandTotal = activeGroups.reduce((s, g) => s + groupTotals[g], 0);

    // ─── 렌더 ─────────────────────────────────────────────────────────────────
    return (
        <div className="flex flex-col gap-3 w-full select-none">

            {/* 상단 그룹 요약 뱃지 */}
            <div className="flex flex-wrap gap-2">
                {activeGroups.map(g => {
                    const cfg = GROUP_CONFIG[g];
                    const total = groupTotals[g];
                    const pct = grandTotal > 0 ? (total / grandTotal * 100).toFixed(1) : '0';
                    const isHov = hoveredGroup === g;
                    return (
                        <div
                            key={g}
                            onMouseEnter={() => setHoveredGroup(g)}
                            onMouseLeave={() => setHoveredGroup(null)}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all duration-150 cursor-default text-sm"
                            style={{
                                borderColor: isHov ? cfg.accentColor : `${cfg.accentColor}55`,
                                backgroundColor: isHov ? `${cfg.accentColor}20` : 'rgba(255,255,255,0.02)',
                            }}
                        >
                            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: cfg.accentColor }} />
                            <span className="text-gray-300 font-semibold">{cfg.label}</span>
                            <span className="text-gray-500 font-mono text-xs">{pct}%</span>
                            <span className="text-gray-400 font-mono text-xs">{fmt(total)}원</span>
                        </div>
                    );
                })}
            </div>

            {/* 메인 컬럼 레이아웃 */}
            <div
                className="flex gap-1.5 w-full rounded-2xl overflow-hidden border border-white/10"
                style={{ height: 640 }}
                onMouseLeave={() => { setTooltip(null); setHoveredGroup(null); }}
            >
                {activeGroups.map(g => {
                    const cfg = GROUP_CONFIG[g];
                    const gTotal = groupTotals[g];
                    const colPct = grandTotal > 0 ? gTotal / grandTotal : 0;
                    const isHovGroup = hoveredGroup === g;

                    return (
                        <div
                            key={g}
                            className="flex flex-col flex-shrink-0 transition-all duration-200"
                            style={{
                                width: `${colPct * 100}%`,
                                minWidth: 0,
                                backgroundColor: cfg.bgBase,
                                outline: isHovGroup ? `1.5px solid ${cfg.accentColor}` : '1.5px solid transparent',
                                borderRadius: 4,
                            }}
                            onMouseEnter={() => setHoveredGroup(g)}
                        >
                            {/* 컬럼 헤더 */}
                            <div
                                className="flex items-center gap-1 px-2 py-1.5 flex-shrink-0"
                                style={{ borderBottom: `2px solid ${cfg.accentColor}55`, backgroundColor: `${cfg.accentColor}18` }}
                            >
                                <span
                                    className="text-[10px] font-black tracking-wide uppercase truncate"
                                    style={{ color: cfg.accentColor }}
                                >
                                    {cfg.label}
                                </span>
                                <span className="text-[9px] text-gray-500 ml-auto flex-shrink-0 font-mono">
                                    {(colPct * 100).toFixed(1)}%
                                </span>
                            </div>

                            {/* 종목 셀들 (flex-col, 높이 = groupPct 비례) — 종목 과다 시 내부 스크롤 */}
                            <div className="flex flex-col flex-1 overflow-y-auto gap-px p-px custom-scrollbar scroll-smooth">
                                {groupMap[g].map((cell, idx) => {
                                    const cellHeightPct = cell.groupPct; // 0~100
                                    const colWidth = colPct * 100; // vw% 기준 예상 너비
                                    const isNarrow = colWidth < 8;
                                    const isTiny   = colWidth < 5;
                                    
                                    // 대략적인 셀 높이 (최소 24px)
                                    const approxHeight = Math.max(24, 520 * (cellHeightPct / 100));
                                    const isShort = approxHeight < 40;
                                    const isVeryShort = approxHeight < 28;

                                    return (
                                        <div
                                            key={idx}
                                            className="relative overflow-hidden rounded-sm flex flex-col items-center justify-center transition-all duration-100 cursor-default group"
                                            style={{
                                                flexBasis: `${cellHeightPct}%`,
                                                flexGrow: cellHeightPct,
                                                flexShrink: 0,
                                                minHeight: 24,
                                                backgroundColor: getReturnBg(cell.returnRate),
                                                border: `1px solid ${cfg.accentColor}30`,
                                            }}
                                            onMouseEnter={e => {
                                                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                                setTooltip({
                                                    visible: true,
                                                    x: rect.left + rect.width / 2,
                                                    y: rect.top,
                                                    cell,
                                                });
                                                setHoveredGroup(g);
                                            }}
                                            onMouseLeave={() => setTooltip(null)}
                                        >
                                            {/* hover overlay */}
                                            <div
                                                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-100 pointer-events-none"
                                                style={{ backgroundColor: `${cfg.accentColor}20`, border: `1px solid ${cfg.accentColor}` }}
                                            />

                                            {/* 텍스트 — 너비/높이에 따라 단계적 표시 */}
                                            {!isTiny && (
                                                <div className="relative z-10 flex flex-col items-center justify-center px-1 text-center w-full overflow-hidden"
                                                    style={{ lineHeight: 1.1 }}>
                                                    {!isNarrow && !isVeryShort && (
                                                        <p
                                                            className="text-white font-semibold truncate w-full text-center"
                                                            style={{ fontSize: colWidth > 15 && !isShort ? 13 : 10 }}
                                                        >
                                                            {cell.name}
                                                        </p>
                                                    )}
                                                    <p
                                                        className="font-bold tabular-nums"
                                                        style={{
                                                            fontSize: colWidth > 12 && !isVeryShort ? 12 : 10,
                                                            color: getReturnText(cell.returnRate),
                                                        }}
                                                    >
                                                        {fmtPct(cell.returnRate)}
                                                    </p>
                                                    {!isNarrow && colWidth > 10 && !isShort && (
                                                        <p className="text-white/40 tabular-nums" style={{ fontSize: 9 }}>
                                                            {cell.pct.toFixed(1)}%
                                                        </p>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* 수익률 범례 + 안내 */}
            <div className="flex items-center justify-between flex-wrap gap-2">
                <p className="text-xs text-gray-600">셀 위에 마우스를 올리면 상세 정보가 표시됩니다.</p>
                <div className="flex items-center gap-1.5">
                    <span className="text-xs text-gray-500 mr-1">수익률</span>
                    {[
                        { label: '-5%↓', bg: 'rgba(185,28,28,0.95)' },
                        { label: '-3%',  bg: 'rgba(153,27,27,0.85)' },
                        { label: '-1%',  bg: 'rgba(127,29,29,0.75)' },
                        { label: '0%',   bg: 'rgba(14,48,28,0.55)'  },
                        { label: '+1%',  bg: 'rgba(20,83,45,0.70)'  },
                        { label: '+3%',  bg: 'rgba(21,128,61,0.80)' },
                        { label: '+5%↑', bg: 'rgba(22,163,74,0.90)' },
                    ].map(lc => (
                        <div key={lc.label} className="flex items-center gap-0.5">
                            <span className="w-5 h-3.5 rounded-sm block" style={{ backgroundColor: lc.bg }} />
                            <span className="text-[10px] text-gray-500">{lc.label}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* 툴팁 (fixed) */}
            {tooltip?.visible && (
                <div
                    className="fixed z-[9999] pointer-events-none"
                    style={{
                        left: tooltip.x,
                        top: tooltip.y - 8,
                        transform: 'translate(-50%, -100%)',
                    }}
                >
                    <div className="bg-[#0c0c18]/98 border border-white/15 rounded-xl px-4 py-3 shadow-2xl text-sm min-w-[210px] backdrop-blur-xl">
                        <p className="text-white font-bold mb-2 leading-snug">{tooltip.cell.name}</p>
                        <div className="space-y-1">
                            {[
                                { label: '그룹',     value: GROUP_CONFIG[tooltip.cell.group]?.label ?? tooltip.cell.group, color: GROUP_CONFIG[tooltip.cell.group]?.accentColor },
                                { label: '평가금액', value: `${fmt(tooltip.cell.value)}원`,   color: '#e2e8f0' },
                                { label: '전체 비중', value: `${tooltip.cell.pct.toFixed(2)}%`, color: '#a5b4fc' },
                                { label: '그룹 내 비중', value: `${tooltip.cell.groupPct.toFixed(2)}%`, color: '#94a3b8' },
                                { label: '수익률',   value: fmtPct(tooltip.cell.returnRate), color: getReturnText(tooltip.cell.returnRate) },
                            ].map(row => (
                                <div key={row.label} className="flex justify-between gap-6 text-xs">
                                    <span className="text-gray-500">{row.label}</span>
                                    <span className="font-semibold" style={{ color: row.color }}>{row.value}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
