// 시간축(ms 타임스탬프) 차트의 연도 눈금을 해당 연도 1월 1일 위치에 고정하는 공용 helper
export const yearTick = (t: number) => String(new Date(t).getUTCFullYear());

/** rows의 t 범위 안에서 1월 1일 눈금. 20년처럼 길면 2년 간격(첫 눈금은 범위 안의 첫 1월 1일). */
export function yearTicks(rows: { t?: number | null }[]): number[] {
    const ts = rows.map(r => r.t).filter((t): t is number => typeof t === "number" && Number.isFinite(t));
    if (ts.length < 2) return [];
    const tMin = Math.min(...ts), tMax = Math.max(...ts);
    let y0 = new Date(tMin).getUTCFullYear();
    if (Date.UTC(y0, 0, 1) < tMin) y0 += 1;
    const y1 = new Date(tMax).getUTCFullYear();
    const step = y1 - y0 > 12 ? 2 : 1;
    const out: number[] = [];
    for (let y = y0; y <= y1; y += step) out.push(Date.UTC(y, 0, 1));
    return out;
}
