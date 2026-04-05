'use client';

import React, { useMemo, useState } from 'react';

/* eslint-disable @typescript-eslint/no-explicit-any */

// ─── 타입 정의 ────────────────────────────────────────────────────────────────
interface TreemapItem {
    name: string;       // 종목명
    code: string;
    value: number;      // 평가금액
    returnRate: number; // 수익률 (%)
    group: string;      // 그룹 카테고리
}

interface TreemapProps {
    holdings: any[];
    cashBalance: number;
    totalAsset: number;
}

// ─── 상수 ────────────────────────────────────────────────────────────────────
const GROUP_CONFIG: Record<string, { label: string; color: string; borderColor: string }> = {
    'KOSPI':    { label: 'KOSPI',          color: '#1e3a5f',  borderColor: '#3b82f6' },
    'KOSDAQ':   { label: 'KOSDAQ',         color: '#134e4a',  borderColor: '#14b8a6' },
    'NASDAQ':   { label: 'NASDAQ',         color: '#2e1065',  borderColor: '#8b5cf6' },
    'S&P 500':  { label: 'S&P 500',        color: '#4c0519',  borderColor: '#f43f5e' },
    '자원':     { label: '자원 (금·은)',   color: '#451a03',  borderColor: '#f59e0b' },
    '현금':     { label: '현금·예수금',    color: '#1c1917',  borderColor: '#78716c' },
};

// 수익률에 따른 셀 색상 (어두운 테마)
function getReturnColor(rate: number): string {
    if (rate >= 5)   return 'rgba(22, 163, 74, 0.85)';
    if (rate >= 3)   return 'rgba(21, 128, 61, 0.75)';
    if (rate >= 1)   return 'rgba(20, 83, 45, 0.65)';
    if (rate >= 0)   return 'rgba(15, 52, 30, 0.50)';
    if (rate >= -1)  return 'rgba(60, 20, 20, 0.50)';
    if (rate >= -3)  return 'rgba(127, 29, 29, 0.65)';
    if (rate >= -5)  return 'rgba(153, 27, 27, 0.75)';
    return 'rgba(185, 28, 28, 0.90)';
}

// ─── 레이아웃 계산 (Squarified Treemap) ────────────────────────────────────
interface Rect { x: number; y: number; w: number; h: number; }

function squarify(items: TreemapItem[], rect: Rect): (TreemapItem & Rect)[] {
    if (items.length === 0) return [];
    const total = items.reduce((s, i) => s + i.value, 0);
    if (total === 0 || rect.w <= 0 || rect.h <= 0) return [];

    const result: (TreemapItem & Rect)[] = [];
    squarifyRecursive(items, rect, total, result);
    return result;
}

function squarifyRecursive(
    items: TreemapItem[],
    rect: Rect,
    total: number,
    result: (TreemapItem & Rect)[]
) {
    if (items.length === 0) return;
    if (items.length === 1) {
        result.push({ ...items[0], x: rect.x, y: rect.y, w: rect.w, h: rect.h });
        return;
    }

    const isHoriz = rect.w >= rect.h;
    const shortSide = isHoriz ? rect.h : rect.w;
    const longSide  = isHoriz ? rect.w : rect.h;

    // Greedy row packing
    let rowSum = 0;
    let rowEnd = 0;
    let bestAspect = Infinity;
    for (let i = 0; i < items.length; i++) {
        const next = rowSum + items[i].value;
        const rowFrac = next / total;
        const rowLen  = rowFrac * longSide;
        let worst = 0;
        for (let j = 0; j <= i; j++) {
            const cellFrac = (rowSum + items[j].value) / next;
            const cellLen  = cellFrac * rowLen;
            const aspect   = Math.max(shortSide / cellLen, cellLen / shortSide);
            if (aspect > worst) worst = aspect;
        }
        if (worst < bestAspect) {
            bestAspect = worst;
            rowEnd = i;
            rowSum = next;
        } else {
            break;
        }
    }

    const rowItems = items.slice(0, rowEnd + 1);
    const restItems = items.slice(rowEnd + 1);

    const rowFrac = rowSum / total;
    const rowLen  = rowFrac * longSide;
    let cursor = isHoriz ? rect.y : rect.x;
    for (const item of rowItems) {
        const frac = item.value / rowSum;
        const cellLen = frac * rowLen;
        if (isHoriz) {
            result.push({ ...item, x: rect.x, y: cursor, w: rowLen, h: cellLen });
            cursor += cellLen;
        } else {
            result.push({ ...item, x: cursor, y: rect.y, w: cellLen, h: rowLen });
            cursor += cellLen;
        }
    }

    const restRect: Rect = isHoriz
        ? { x: rect.x + rowLen, y: rect.y, w: rect.w - rowLen, h: rect.h }
        : { x: rect.x, y: rect.y + rowLen, w: rect.w, h: rect.h - rowLen };

    squarifyRecursive(restItems, restRect, total - rowSum, result);
}

// ─── 분류 로직 (중앙 정의) ───────────────────────────────────────────────────
function categorize(name: string, code: string = '', isCash = false): string {
    if (isCash) return '현금';
    if (!name)  return 'KOSPI';
    const n = name.toUpperCase();
    if (n.includes('금현물') || n.includes('국제금') || n.includes('은현물') || n.includes('금선물') || n.includes('gold')) return '자원';
    if (n.includes('머니마켓') || n.includes('cd금리') || n.includes('kofr') || n.includes('단기채') || n.includes('파킹')) return '현금';
    if (n.includes('미국성장') || n.includes('미국우주항공') || n.includes('미국양자컴퓨팅') || n.includes('나스닥') || n.includes('nasdaq') || n.includes('빅테크') || n.includes('qqq') || n.includes('성장커버드콜') || n.includes('성장 커버드콜')) return 'NASDAQ';
    if (n.includes('미국배당') || n.includes('s&p500') || n.includes('s&p 500')) return 'S&P 500';
    if (n.includes('위탁') && code === '') return '현금';
    if (n.includes('코스닥') || n.includes('kosdaq') || n.includes('바이오') || n.includes('헬스케어') || n.includes('2차전지')) return 'KOSDAQ';
    if (code && /^[A-Za-z]+(\.[A-Za-z]+)?$/.test(code)) return 'NASDAQ';
    if (n.includes('미국')) return 'S&P 500';
    return 'KOSPI';
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────
export default function PortfolioTreemap({ holdings, cashBalance, totalAsset }: TreemapProps) {
    const [tooltip, setTooltip] = useState<{
        visible: boolean; x: number; y: number;
        name: string; value: number; returnRate: number; group: string; pct: number;
    } | null>(null);

    const [hoveredGroup, setHoveredGroup] = useState<string | null>(null);

    const formatKRW   = (v: number) => new Intl.NumberFormat('ko-KR').format(Math.floor(v));
    const formatPct   = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;

    // ─── 데이터 준비 ─────────────────────────────────────────────────────────
    const { items, groupStats } = useMemo(() => {
        const raw: TreemapItem[] = [];

        // 예수금
        if (cashBalance > 0) {
            raw.push({ name: '예수금·CMA', code: '', value: cashBalance, returnRate: 0, group: '현금' });
        }

        // 보유 종목
        holdings.forEach((h: any) => {
            const val = h.eval_amount || 0;
            if (val <= 0) return;
            const grp = categorize(h.name, h.code);
            raw.push({ name: h.name, code: h.code, value: val, returnRate: parseFloat(h.return_rate ?? 0), group: grp });
        });

        // 그룹별 합계
        const stats: Record<string, { total: number; items: number }> = {};
        for (const item of raw) {
            if (!stats[item.group]) stats[item.group] = { total: 0, items: 0 };
            stats[item.group].total += item.value;
            stats[item.group].items += 1;
        }

        return { items: raw.sort((a, b) => b.value - a.value), groupStats: stats };
    }, [holdings, cashBalance]);

    // ─── 그룹별 열로 레이아웃 배분 ──────────────────────────────────────────
    const CANVAS_W = 1000;
    const CANVAS_H = 480;
    const GAP      = 8;

    const groupOrder = Object.keys(GROUP_CONFIG).filter(g => groupStats[g]);
    const totalVal   = groupOrder.reduce((s, g) => s + groupStats[g].total, 0);

    // 각 그룹에 가로 폭 배분
    const groupRects: Record<string, Rect & { label: string }> = {};
    let curX = 0;
    for (const g of groupOrder) {
        const ratio = groupStats[g].total / totalVal;
        const w = CANVAS_W * ratio;
        groupRects[g] = { x: curX, y: 0, w: w - GAP, h: CANVAS_H, label: GROUP_CONFIG[g].label };
        curX += w;
    }

    // 그룹 내부 squarify
    const cellRects: (TreemapItem & Rect)[] = [];
    for (const g of groupOrder) {
        const gItems = items.filter(i => i.group === g);
        const rect = groupRects[g];
        const HEADER = 28;
        const innerRect: Rect = { x: rect.x, y: rect.y + HEADER, w: rect.w, h: rect.h - HEADER };
        const laid = squarify(gItems, innerRect);
        cellRects.push(...laid);
    }

    // ─── 렌더 ────────────────────────────────────────────────────────────────
    return (
        <div className="flex flex-col gap-4 w-full">

            {/* 요약 헤더 행 */}
            <div className="flex flex-wrap gap-3">
                {groupOrder.map(g => {
                    const cfg = GROUP_CONFIG[g];
                    const stat = groupStats[g];
                    const pct = totalVal > 0 ? (stat.total / totalVal) * 100 : 0;
                    const isHovered = hoveredGroup === g;
                    return (
                        <div
                            key={g}
                            onMouseEnter={() => setHoveredGroup(g)}
                            onMouseLeave={() => setHoveredGroup(null)}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all cursor-default text-sm"
                            style={{
                                borderColor: isHovered ? cfg.borderColor : `${cfg.borderColor}55`,
                                backgroundColor: isHovered ? `${cfg.borderColor}18` : 'rgba(255,255,255,0.02)',
                            }}
                        >
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cfg.borderColor }} />
                            <span className="text-gray-300 font-medium">{cfg.label}</span>
                            <span className="text-gray-500 font-mono text-xs">{pct.toFixed(1)}%</span>
                            <span className="text-gray-400 font-medium ml-1">{formatKRW(stat.total)}원</span>
                        </div>
                    );
                })}
            </div>

            {/* 트리맵 SVG */}
            <div className="w-full relative rounded-2xl overflow-hidden border border-white/10 bg-black/30">
                <svg
                    viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
                    className="w-full h-auto"
                    style={{ display: 'block' }}
                    onMouseLeave={() => setTooltip(null)}
                >
                    {/* 그룹 배경 + 헤더 */}
                    {groupOrder.map(g => {
                        const cfg = GROUP_CONFIG[g];
                        const r = groupRects[g];
                        const stat = groupStats[g];
                        const pct = totalVal > 0 ? (stat.total / totalVal * 100).toFixed(1) : '0';
                        const isHov = hoveredGroup === g;
                        return (
                            <g key={g}>
                                <rect
                                    x={r.x} y={r.y} width={r.w} height={r.h}
                                    fill={cfg.color}
                                    rx={6}
                                    opacity={isHov ? 1 : 0.85}
                                />
                                {/* 헤더 레이블 */}
                                <rect x={r.x} y={r.y} width={r.w} height={26} fill={cfg.borderColor} opacity={0.2} rx={4} />
                                <text x={r.x + 8} y={r.y + 17} fill={cfg.borderColor} fontSize={11} fontWeight="700" letterSpacing={0.5}>
                                    {cfg.label}  {pct}%
                                </text>
                            </g>
                        );
                    })}

                    {/* 셀 */}
                    {cellRects.map((cell, idx) => {
                        const isHov = hoveredGroup === cell.group;
                        const bgColor = getReturnColor(cell.returnRate);
                        const borderColor = GROUP_CONFIG[cell.group]?.borderColor ?? '#fff';
                        const pct = totalAsset > 0 ? (cell.value / totalAsset * 100) : 0;

                        // 텍스트 크기 조정
                        const area = cell.w * cell.h;
                        const showName = cell.w > 55 && cell.h > 28;
                        const showRate = cell.w > 55 && cell.h > 48;
                        const showPct  = cell.w > 70 && cell.h > 68;
                        const fontSize = area > 20000 ? 11 : area > 8000 ? 10 : 9;

                        // 이름 클리핑 (너비 기반)
                        const maxChars = Math.floor(cell.w / (fontSize * 0.65));
                        const displayName = cell.name.length > maxChars
                            ? cell.name.slice(0, maxChars - 1) + '…'
                            : cell.name;

                        return (
                            <g key={idx}
                                onMouseEnter={(e) => {
                                    const svg = (e.target as SVGElement).closest('svg');
                                    const svgRect = svg?.getBoundingClientRect();
                                    const scaleX = svgRect ? (CANVAS_W / svgRect.width) : 1;
                                    const scaleY = svgRect ? (CANVAS_H / (svgRect.width * CANVAS_H / CANVAS_W)) : 1;
                                    setTooltip({
                                        visible: true,
                                        x: (cell.x + cell.w / 2) / scaleX + (svgRect?.left ?? 0),
                                        y: (cell.y) / scaleY + (svgRect?.top ?? 0),
                                        name: cell.name, value: cell.value,
                                        returnRate: cell.returnRate, group: cell.group, pct,
                                    });
                                    setHoveredGroup(cell.group);
                                }}
                                onMouseLeave={() => { setTooltip(null); setHoveredGroup(null); }}
                                style={{ cursor: 'default' }}
                            >
                                <rect
                                    x={cell.x + 1} y={cell.y + 1}
                                    width={cell.w - 2} height={cell.h - 2}
                                    fill={bgColor}
                                    stroke={isHov ? borderColor : `${borderColor}40`}
                                    strokeWidth={isHov ? 1.5 : 0.5}
                                    rx={3}
                                />
                                {showName && (
                                    <text
                                        x={cell.x + cell.w / 2}
                                        y={cell.y + (showRate ? cell.h / 2 - (showPct ? 10 : 5) : cell.h / 2 + 4)}
                                        textAnchor="middle" dominantBaseline="middle"
                                        fill="rgba(255,255,255,0.92)" fontSize={fontSize} fontWeight="600"
                                    >
                                        {displayName}
                                    </text>
                                )}
                                {showRate && (
                                    <text
                                        x={cell.x + cell.w / 2}
                                        y={cell.y + cell.h / 2 + (showPct ? 5 : 8)}
                                        textAnchor="middle" dominantBaseline="middle"
                                        fill={cell.returnRate >= 0 ? '#86efac' : '#fca5a5'}
                                        fontSize={fontSize} fontWeight="700"
                                    >
                                        {formatPct(cell.returnRate)}
                                    </text>
                                )}
                                {showPct && (
                                    <text
                                        x={cell.x + cell.w / 2}
                                        y={cell.y + cell.h / 2 + 18}
                                        textAnchor="middle" dominantBaseline="middle"
                                        fill="rgba(255,255,255,0.45)" fontSize={fontSize - 1}
                                    >
                                        {pct.toFixed(1)}%
                                    </text>
                                )}
                            </g>
                        );
                    })}
                </svg>

                {/* 툴팁 (fixed position) */}
                {tooltip?.visible && (
                    <div
                        className="fixed z-[999] pointer-events-none"
                        style={{ left: tooltip.x, top: tooltip.y - 10, transform: 'translate(-50%, -100%)' }}
                    >
                        <div className="bg-[#0d0d18]/95 border border-white/15 rounded-xl px-4 py-3 shadow-2xl text-sm min-w-[200px]">
                            <p className="text-white font-bold mb-1 leading-tight">{tooltip.name}</p>
                            <div className="flex justify-between gap-4 text-xs text-gray-400">
                                <span>그룹</span>
                                <span className="text-gray-200">{GROUP_CONFIG[tooltip.group]?.label ?? tooltip.group}</span>
                            </div>
                            <div className="flex justify-between gap-4 text-xs text-gray-400">
                                <span>평가금액</span>
                                <span className="text-gray-100 font-mono">{formatKRW(tooltip.value)}원</span>
                            </div>
                            <div className="flex justify-between gap-4 text-xs text-gray-400">
                                <span>비중</span>
                                <span className="text-indigo-300 font-medium">{tooltip.pct.toFixed(2)}%</span>
                            </div>
                            <div className="flex justify-between gap-4 text-xs text-gray-400">
                                <span>수익률</span>
                                <span className={tooltip.returnRate >= 0 ? 'text-green-400 font-bold' : 'text-red-400 font-bold'}>
                                    {formatPct(tooltip.returnRate)}
                                </span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* 색상 범례 */}
            <div className="flex items-center gap-1 justify-end flex-wrap">
                <span className="text-xs text-gray-500 mr-2">수익률 색상</span>
                {[
                    { label: '-5%↓', color: 'rgba(185,28,28,0.9)' },
                    { label: '-3%', color: 'rgba(153,27,27,0.75)' },
                    { label: '-1%', color: 'rgba(127,29,29,0.65)' },
                    { label: '0%', color: 'rgba(60,20,20,0.5)' },
                    { label: '+1%', color: 'rgba(20,83,45,0.65)' },
                    { label: '+3%', color: 'rgba(21,128,61,0.75)' },
                    { label: '+5%↑', color: 'rgba(22,163,74,0.85)' },
                ].map(lc => (
                    <div key={lc.label} className="flex items-center gap-1">
                        <span className="w-5 h-3 rounded-sm inline-block" style={{ backgroundColor: lc.color }} />
                        <span className="text-[10px] text-gray-500">{lc.label}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
