// TFF "현 시점 추정 시뮬레이션" 유틸리티
// 마지막 업로드 월말 종가 대비 현재 종가 변동률을 적용하여 당월(현 시점) 추정치를 산출한다.
import { TffFundData, TffMonthInfo, TffHoldingsRow, TffCumulativeMonthlyRow } from './types';
import { API_BASE } from '../apiConfig';
import krTickers from './kr-tickers.json';

export interface TffEstimateHoldingResult {
    code: string;
    name: string;
    basePrice: number | null;
    currentPrice: number | null;
    currentDate?: string;
    changePct: number;   // 퍼센트 (예: 8.97)
    available: boolean;
}

export interface TffEstimateResponse {
    status: string;
    asOf: string;
    baseMonth: number;
    baseMonthLabel: string;
    currentMonth: number;
    currentMonthLabel: string;
    holdings: TffEstimateHoldingResult[];
    benchmarks: { kospi: number | null; sp500: number | null };
    fetchedCount: number;
    totalCount: number;
    cached: boolean;
}

function findTickerCode(name: string): string | undefined {
    if (!name) return undefined;
    const cleanName = name.replace(/\s/g, '').toLowerCase();
    for (const [key, val] of Object.entries(krTickers)) {
        if (key.replace(/\s/g, '').toLowerCase() === cleanName) return val as string;
    }
    for (const [key, val] of Object.entries(krTickers)) {
        const cleanKey = key.replace(/\s/g, '').toLowerCase();
        if (cleanName.includes(cleanKey) || cleanKey.includes(cleanName)) return val as string;
    }
    return undefined;
}

// 마지막 업로드 월의 연/월을 cumulative.monthlyData에서 추론
function resolveBaseYearMonth(fundData: TffFundData): { year: number; month: number } | null {
    const monthly = fundData.cumulative?.monthlyData || [];
    let best: { year: number; month: number } | null = null;
    for (const row of monthly) {
        if (!row.period) continue;
        const m = row.period.match(/(\d{4})-(\d{1,2})/);
        if (!m) continue;
        // 빈 미래월(데이터 없음) 제외
        if ((row.endValue ?? 0) <= 0 && (row.netInOut ?? 0) === 0) continue;
        const y = parseInt(m[1], 10);
        const mo = parseInt(m[2], 10);
        if (!best || y * 12 + mo > best.year * 12 + best.month) best = { year: y, month: mo };
    }
    if (best) return best;
    // 폴백: latestMonth 숫자 + 올해
    const ln = parseInt(fundData.latestMonth || '', 10);
    if (!isNaN(ln)) return { year: new Date().getFullYear(), month: ln };
    return null;
}

function getBaseMonthInfo(fundData: TffFundData): TffMonthInfo | null {
    const lm = fundData.latestMonth;
    if (lm && lm !== 'YTM' && fundData.monthlyMap[lm]) return fundData.monthlyMap[lm];
    const keys = Object.keys(fundData.monthlyMap).sort((a, b) => parseInt(a) - parseInt(b));
    if (keys.length > 0) return fundData.monthlyMap[keys[keys.length - 1]];
    return null;
}

// 서버에 현 시점 추정 데이터 요청
export async function fetchTffEstimate(fundData: TffFundData): Promise<TffEstimateResponse | null> {
    const baseMonthInfo = getBaseMonthInfo(fundData);
    const ym = resolveBaseYearMonth(fundData);
    if (!baseMonthInfo || !ym) return null;

    const holdings = baseMonthInfo.holdings
        .map(h => ({ code: (h.code || findTickerCode(h.name) || '').trim(), name: h.name }))
        .filter(h => h.name);

    try {
        const res = await fetch(`${API_BASE}/api/v1/analyze/tff/estimate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ holdings, year: ym.year, month: ym.month }),
        });
        if (!res.ok) return null;
        const json = await res.json();
        if (json.status !== 'ok') return null;
        return json as TffEstimateResponse;
    } catch (e) {
        console.error('[tff estimate] fetch 실패', e);
        return null;
    }
}

export interface TffEstimateBuilt {
    currentMonthKey: string;       // 예: "6월"
    currentMonthLabelFull: string; // 예: "6월(현재)"
    currentMonthPeriod: string;    // 예: "2026-06"
    asOf: string;
    // toggle OFF: 현 시점 월 칼럼/포인트만 추가 (KPI/누적 불변)
    baseDisplay: TffFundData;
    // toggle ON: 전체 수치를 추정으로 전환
    estDisplay: TffFundData;
    portfolioMtdPct: number;       // 당월 포트폴리오 추정 수익률 (퍼센트)
    // "올해 수익 기여 종목" 차트용 종목별 YTD 누적 손익 (OFF/ON)
    contributionBase: TffHoldingsRow[];
    contributionEst: TffHoldingsRow[];
    fetchedCount: number;
    totalCount: number;
}

// 추정 응답 + 업로드 데이터 → 뷰에 넘길 파생 데이터 일괄 생성
export function buildEstimateData(
    fundData: TffFundData,
    est: TffEstimateResponse
): TffEstimateBuilt | null {
    const baseMonthInfo = getBaseMonthInfo(fundData);
    const ym = resolveBaseYearMonth(fundData);
    if (!baseMonthInfo || !ym) return null;

    const baseTotal = fundData.cumulative?.totalData;
    if (!baseTotal) return null;

    const currentMonthKey = est.currentMonthLabel;            // "6월"
    const currentMonthLabelFull = `${est.currentMonthLabel}(현재)`;
    const currentMonthPeriod = `${ym.year}-${String(est.currentMonth).padStart(2, '0')}`;

    // 코드/이름 → 변동률(%) 룩업
    const chgByCode: Record<string, number> = {};
    const chgByName: Record<string, number> = {};
    const availByCode: Record<string, boolean> = {};
    const availByName: Record<string, boolean> = {};
    est.holdings.forEach(h => {
        if (h.code) { chgByCode[h.code] = h.changePct; availByCode[h.code] = h.available; }
        chgByName[h.name] = h.changePct; availByName[h.name] = h.available;
    });
    const lookupChg = (code?: string, name?: string): { chg: number; available: boolean } => {
        const c = (code || '').trim();
        if (c && c in chgByCode) return { chg: chgByCode[c], available: availByCode[c] };
        if (name && name in chgByName) return { chg: chgByName[name], available: availByName[name] };
        return { chg: 0, available: false };
    };

    // 1) 당월 추정 월정보 (MonthlyView / Overview latestInfo)
    let sumPnl = 0;
    const estHoldings: TffHoldingsRow[] = baseMonthInfo.holdings.map(h => {
        const { chg } = lookupChg(h.code, h.name);
        const begin = h.endValue;
        const end = begin * (1 + chg / 100);
        const pnl = end - begin;
        sumPnl += pnl;
        return {
            ...h,
            beginValue: begin,
            buyAmount: 0,
            sellAmount: 0,
            dividend: 0,
            creditInterest: 0,
            endValue: end,
            investmentPnl: pnl,
        };
    });
    const baseCash = baseMonthInfo.summary.cashBalance || 0;
    const currentMonthInfo: TffMonthInfo = {
        period: currentMonthLabelFull,
        holdings: estHoldings,
        summary: {
            totalBeginValue: estHoldings.reduce((s, h) => s + h.beginValue, 0),
            totalBuyAmount: 0,
            totalSellAmount: 0,
            totalEndValue: estHoldings.reduce((s, h) => s + h.endValue, 0),
            totalDividend: 0,
            totalPnl: sumPnl,
            cashBalance: baseCash,
            carryoverBalance: 0,
            deposit: 0,
            withdrawal: 0,
            totalBalance: baseCash,
        },
    };

    // 1-b) "올해(YTD) 수익 기여 종목" 차트용 — 종목별 연초 누적 손익
    // (월별 시트의 월간 손익을 종목별로 합산 → 올해 누적. ON일 때 당월 MTD 가산)
    const ytdPnlByName: Record<string, number> = {};
    Object.values(fundData.monthlyMap).forEach(mi => {
        mi.holdings.forEach(h => {
            ytdPnlByName[h.name] = (ytdPnlByName[h.name] || 0) + (h.investmentPnl || 0);
        });
    });
    const juneDeltaByName: Record<string, number> = {};
    estHoldings.forEach(h => { juneDeltaByName[h.name] = h.investmentPnl; });

    const contributionBase: TffHoldingsRow[] = baseMonthInfo.holdings.map(h => ({
        ...h,
        investmentPnl: ytdPnlByName[h.name] || 0,
    }));
    const contributionEst: TffHoldingsRow[] = baseMonthInfo.holdings.map(h => {
        const { chg } = lookupChg(h.code, h.name);
        return {
            ...h,
            endValue: h.endValue * (1 + chg / 100),
            investmentPnl: (ytdPnlByName[h.name] || 0) + (juneDeltaByName[h.name] || 0),
        };
    });

    const portfolioMtdPct = baseTotal.endValue > 0 ? (sumPnl / baseTotal.endValue) * 100 : 0;
    const kospiChg = est.benchmarks?.kospi ?? null;
    const sp500Chg = est.benchmarks?.sp500 ?? null;

    // 2) 추정 totalData (퍼센트 스케일)
    const estTotalData = {
        ...baseTotal,
        endValue: baseTotal.endValue + sumPnl,
        profitAmount: baseTotal.profitAmount + sumPnl,
        returnRate: baseTotal.returnRate + portfolioMtdPct,
        timeWeightedReturn: (baseTotal.timeWeightedReturn ?? baseTotal.returnRate) + portfolioMtdPct,
        kospiRate: baseTotal.kospiRate + (kospiChg ?? 0),
        sp500Rate: baseTotal.sp500Rate + (sp500Chg ?? 0),
    };

    // 3) 누적 시계열 추가 포인트 (fraction 스케일)
    const currentPoint: TffCumulativeMonthlyRow & { isEstimate?: boolean } = {
        period: currentMonthPeriod,
        beginValue: baseTotal.endValue,
        netInOut: 0,
        endValue: baseTotal.endValue + sumPnl,
        profitAmount: sumPnl,
        returnRate: portfolioMtdPct / 100,
        kospiRate: (kospiChg ?? 0) / 100,
        sp500Rate: (sp500Chg ?? 0) / 100,
        isEstimate: true,
    };

    // 4) assetReturns 월 칼럼 주입 (fraction)
    const injectAssetMonths = (recomputeCumulative: boolean) => {
        const ar = fundData.assetReturns;
        const assets = ar.assets.map(a => {
            const { chg, available } = lookupChg(a.code, a.name);
            const months = { ...a.months };
            if (available) months[currentMonthKey] = chg / 100;
            let cumulative = a.cumulative;
            if (recomputeCumulative && available) {
                cumulative = (1 + (a.cumulative || 0)) * (1 + chg / 100) - 1;
            }
            return { ...a, months, cumulative };
        });
        const totalMonths = { ...ar.total.months, [currentMonthKey]: portfolioMtdPct / 100 };
        const totalCumulative = recomputeCumulative
            ? (1 + (ar.total.cumulative || 0)) * (1 + portfolioMtdPct / 100) - 1
            : ar.total.cumulative;
        const benchmarks: any = { ...ar.benchmarks };
        if (benchmarks.kospi && kospiChg !== null) {
            benchmarks.kospi = {
                months: { ...benchmarks.kospi.months, [currentMonthKey]: kospiChg / 100 },
                cumulative: recomputeCumulative
                    ? (1 + (benchmarks.kospi.cumulative || 0)) * (1 + kospiChg / 100) - 1
                    : benchmarks.kospi.cumulative,
            };
        }
        if (benchmarks.sp500 && sp500Chg !== null) {
            benchmarks.sp500 = {
                months: { ...benchmarks.sp500.months, [currentMonthKey]: sp500Chg / 100 },
                cumulative: recomputeCumulative
                    ? (1 + (benchmarks.sp500.cumulative || 0)) * (1 + sp500Chg / 100) - 1
                    : benchmarks.sp500.cumulative,
            };
        }
        return { assets, total: { months: totalMonths, cumulative: totalCumulative }, benchmarks };
    };

    // 5) YTM 추정 (있을 경우) — 보유분에 MTD 변동을 가산
    const buildEstYtm = (): TffMonthInfo | null => {
        if (!fundData.ytm) return null;
        let ySumDelta = 0;
        const holdings = fundData.ytm.holdings.map(h => {
            const { chg } = lookupChg(h.code, h.name);
            const delta = h.endValue * (chg / 100);
            ySumDelta += delta;
            return {
                ...h,
                endValue: h.endValue + delta,
                investmentPnl: (h.investmentPnl || 0) + delta,
            };
        });
        const s = fundData.ytm.summary;
        return {
            ...fundData.ytm,
            holdings,
            summary: {
                ...s,
                totalEndValue: (s.totalEndValue || 0) + ySumDelta,
                totalPnl: (s.totalPnl || 0) + ySumDelta,
            },
        };
    };

    const monthlyMapWithCurrent = { ...fundData.monthlyMap, [currentMonthKey]: currentMonthInfo };

    const baseDisplay: TffFundData = {
        ...fundData,
        monthlyMap: monthlyMapWithCurrent,
        assetReturns: injectAssetMonths(false),
        cumulative: {
            ...fundData.cumulative,
            monthlyData: [...fundData.cumulative.monthlyData, currentPoint],
        },
    };

    const estDisplay: TffFundData = {
        ...fundData,
        latestMonth: currentMonthKey,
        monthlyMap: monthlyMapWithCurrent,
        assetReturns: injectAssetMonths(true),
        ytm: buildEstYtm() || fundData.ytm,
        cumulative: {
            ...fundData.cumulative,
            monthlyData: [...fundData.cumulative.monthlyData, currentPoint],
            totalData: estTotalData,
        },
    };

    return {
        currentMonthKey,
        currentMonthLabelFull,
        currentMonthPeriod,
        asOf: est.asOf,
        baseDisplay,
        estDisplay,
        portfolioMtdPct,
        contributionBase,
        contributionEst,
        fetchedCount: est.fetchedCount,
        totalCount: est.totalCount,
    };
}
