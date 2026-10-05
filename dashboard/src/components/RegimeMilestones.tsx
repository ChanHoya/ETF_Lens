'use client';
// 환율·금리 국면을 전체 기간 차트 위 이정표(번호 핀)로 보여주고, 누른 이정표의 배경 설명을 차트 아래에 펼치는 공용 타임라인

import React, { useMemo } from 'react';
import {
    ResponsiveContainer, ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ReferenceArea, ReferenceLine,
} from 'recharts';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export type Milestone = {
    start: string;
    end: string | null;          // null = 진행 중
    title: string;
    drivers: string[];
    source?: string | null;
    color: string;               // 밴드·핀 색
    badge: { label: string; cls: string };
    summary: React.ReactNode;    // 오른쪽 수치 요약
};

const Y_W = 48;    // 왼쪽 Y축 폭 — 아래 핀 트랙을 플롯 영역과 맞추는 기준
const RIGHT = 12;  // 오른쪽 여백
const LANE_H = 34;
const MIN_GAP_PCT = 4.5; // 이보다 가까운 핀은 다음 줄로

const ts = (d: string) => Date.parse(d);
const fmtDate = (t: number) => new Date(t).toISOString().slice(0, 10);
const yearTick = (t: number) => String(new Date(t).getUTCFullYear());
const ym = (d: string) => `${d.slice(2, 4)}.${d.slice(5, 7)}`;
const period = (m: Milestone) => `${m.start.slice(0, 7).replace('-', '.')} → ${m.end ? m.end.slice(0, 7).replace('-', '.') : '현재'}`;

export default function RegimeMilestones({ rows, milestones, selected, onSelect, seriesName, seriesColor, step, yFormat }: {
    rows: { t: number; v: number | null }[];
    milestones: Milestone[];
    selected: number | null;            // null이면 최신 국면을 보여준다
    onSelect: (i: number) => void;
    seriesName: string;
    seriesColor: string;
    step?: boolean;
    yFormat: (v: number) => string;
}) {
    const tMin = rows[0]?.t ?? 0;
    const tMax = rows[rows.length - 1]?.t ?? 1;
    const cur = selected ?? milestones.length - 1;

    // 핀 위치(플롯 폭 대비 %)와 겹침 방지 줄 배정
    const pins = useMemo(() => {
        const lastPct: number[] = [];
        return milestones.map((m, i) => {
            const pct = Math.min(100, Math.max(0, ((ts(m.start) - tMin) / (tMax - tMin || 1)) * 100));
            let lane = lastPct.findIndex(p => pct - p >= MIN_GAP_PCT);
            if (lane === -1) lane = lastPct.length < 3 ? lastPct.length : lastPct.indexOf(Math.min(...lastPct));
            lastPct[lane] = pct;
            return { i, pct, lane };
        });
    }, [milestones, tMin, tMax]);
    const lanes = Math.max(1, ...pins.map(p => p.lane + 1));
    // 눈금은 1월 1일에만(자동 눈금은 같은 연도가 두 번 찍힌다). 기간이 길면 2년 간격
    const yearTicks = useMemo(() => {
        const y0 = new Date(tMin).getUTCFullYear() + 1, y1 = new Date(tMax).getUTCFullYear();
        const step = y1 - y0 > 12 ? 2 : 1;
        const out: number[] = [];
        for (let y = y0; y <= y1; y += step) out.push(Date.UTC(y, 0, 1));
        return out;
    }, [tMin, tMax]);
    const m = milestones[cur];

    return (
        <div>
            <ResponsiveContainer width="100%" height={240}>
                <ComposedChart data={rows} margin={{ top: 8, right: RIGHT, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                    {milestones.map((g, i) => (
                        <ReferenceArea key={`a${g.start}`} x1={Math.max(ts(g.start), tMin)} x2={g.end ? ts(g.end) : tMax} ifOverflow="hidden"
                            fill={g.color} fillOpacity={i === cur ? 0.3 : 0.06} />
                    ))}
                    {milestones.map((g, i) => ts(g.start) >= tMin && (
                        <ReferenceLine key={`l${g.start}`} x={ts(g.start)} stroke={g.color} strokeOpacity={i === cur ? 0.9 : 0.35} strokeDasharray="3 3" />
                    ))}
                    <XAxis dataKey="t" type="number" scale="time" domain={['dataMin', 'dataMax']} ticks={yearTicks} tickFormatter={yearTick} tick={{ fill: '#9ca3af', fontSize: 11 }} />
                    <YAxis width={Y_W} tick={{ fill: '#9ca3af', fontSize: 11 }} domain={['auto', 'auto']} tickFormatter={yFormat} />
                    <RechartsTooltip contentStyle={{ background: '#1a1a23', border: '1px solid #ffffff20', borderRadius: 8, fontSize: 12 }}
                        labelFormatter={(t) => fmtDate(Number(t))} formatter={(v) => [typeof v === 'number' ? yFormat(v) : v, seriesName]} />
                    <Line type={step ? 'stepAfter' : 'monotone'} dataKey="v" name={seriesName} stroke={seriesColor} dot={false} strokeWidth={2} connectNulls isAnimationActive={false} />
                </ComposedChart>
            </ResponsiveContainer>

            {/* 이정표 트랙 — 플롯 영역과 같은 폭(왼쪽 Y축 폭·오른쪽 여백만큼 안쪽) */}
            <div className="relative mt-1" style={{ marginLeft: Y_W, marginRight: RIGHT, height: lanes * LANE_H + 4 }}>
                <div className="absolute left-0 right-0 top-[10px] h-px bg-white/10" />
                {pins.map(({ i, pct, lane }) => {
                    const g = milestones[i];
                    const active = i === cur;
                    return (
                        <button key={g.start} type="button" onClick={() => onSelect(i)} title={`${period(g)} · ${g.title}`}
                            className="absolute flex flex-col items-center -translate-x-1/2 group cursor-pointer"
                            style={{ left: `${pct}%`, top: lane * LANE_H }}>
                            <span className={`flex items-center justify-center rounded-full text-[10px] font-extrabold text-white transition-transform ${active ? 'w-6 h-6 ring-2 ring-white/70 scale-110' : 'w-5 h-5 opacity-80 group-hover:opacity-100 group-hover:scale-110'}`}
                                style={{ backgroundColor: g.color }}>
                                {i + 1}
                            </span>
                            <span className={`text-[10px] font-mono mt-0.5 whitespace-nowrap ${active ? 'text-gray-100 font-bold' : 'text-gray-500'}`}>{ym(g.start)}</span>
                        </button>
                    );
                })}
            </div>

            {m && (
                <div className="mt-2 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-extrabold text-white shrink-0" style={{ backgroundColor: m.color }}>{cur + 1}</span>
                        <span className="text-xs font-mono text-gray-400">{period(m)}</span>
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${m.badge.cls}`}>{m.badge.label}</span>
                        <span className="text-sm font-extrabold text-white">{m.title}</span>
                        <span className="text-xs font-bold text-gray-300 ml-auto">{m.summary}</span>
                        <div className="flex gap-1">
                            <button type="button" onClick={() => onSelect(Math.max(0, cur - 1))} disabled={cur === 0} aria-label="이전 국면"
                                className="p-1 rounded-lg bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button>
                            <button type="button" onClick={() => onSelect(Math.min(milestones.length - 1, cur + 1))} disabled={cur === milestones.length - 1} aria-label="다음 국면"
                                className="p-1 rounded-lg bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
                        </div>
                    </div>
                    <ul className="mt-2 flex flex-wrap gap-1.5">
                        {m.drivers.map(d => <li key={d} className="text-[11px] text-gray-300 bg-white/5 border border-white/5 rounded-md px-2 py-0.5">{d}</li>)}
                    </ul>
                    {m.source && <p className="text-[10px] text-gray-500 mt-1.5">출처: {m.source}</p>}
                </div>
            )}
        </div>
    );
}
