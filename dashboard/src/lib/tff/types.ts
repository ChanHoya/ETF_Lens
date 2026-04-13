// TFF 펀드 데이터 구조 설계 (실제 엑셀 포맷 대응)

export interface TffHoldingsRow {
    accountNumber?: string;
    productType?: string;
    name: string;
    code?: string;
    beginValue: number;
    buyAmount: number;
    sellAmount: number;
    endValue: number;
    dividend: number;
    creditInterest: number;
    investmentPnl: number;
    weight?: number;
    dividendReturn?: number;
    capitalReturn?: number;
    totalReturn?: number;
}
  
export interface TffMonthlySummary {
    totalBeginValue: number;
    totalBuyAmount: number;
    totalSellAmount: number;
    totalEndValue: number;
    totalDividend: number;
    totalPnl: number;
    cashBalance: number;
    carryoverBalance: number; // 이월잔고
    deposit: number; // 입금
    withdrawal: number; // 출금
    totalBalance: number; // 종합잔고
}
  
export interface TffMonthInfo {
    period: string; // e.g., "3월" or "YTM"
    holdings: TffHoldingsRow[];
    summary: TffMonthlySummary;
}

export interface TffAssetReturnRow {
    name: string; // KODEX 반도체 등
    code?: string; // 종목코드
    months: { [month: string]: number }; // { "1월": 0.409, "2월": 0.059 ... }
    cumulative: number; // 누적수익률 0.345
    capitalPnlPercentage: number; // 지분손익
}

export interface TffAssetReturns {
    assets: TffAssetReturnRow[];
    total: {
        months: { [month: string]: number };
        cumulative: number;
    };
    benchmarks: {
        kospi: { months: { [month: string]: number }, cumulative: number };
        sp500: { months: { [month: string]: number }, cumulative: number };
    }
}

export interface TffCumulativeRow {
    year: string; // "2024 연간계", "2025 연간계", "2026 연간계", "총누적계"
    beginValue: number;    // 기초평가액
    netInOut: number;      // 순입출금
    endValue: number;      // 기말평가액
    profitAmount: number;  // 수익금액
    returnRate: number;    // 수익률(%)
    timeWeightedReturn: number; // 시간평잔수익%
    kospiRate: number;
    sp500Rate: number;
}

export interface TffCumulativeMonthlyRow {
    period: string; // "2024-07", "2024-08" 등
    beginValue: number;
    netInOut: number;   
    endValue: number;   
    profitAmount: number; 
    returnRate: number; 
    kospiRate?: number;
    sp500Rate?: number;
}

export interface TffCumulativeSummary {
    yearlyData: TffCumulativeRow[];
    monthlyData: TffCumulativeMonthlyRow[];
    totalData: TffCumulativeRow | null; // 가장 끝의 '총누적계'
}
  
export interface TffFundData {
    parsedAt: string; // 파싱 시각
    cumulative: TffCumulativeSummary; // Main KPI (총누적손익 시트)
    assetReturns: TffAssetReturns;    // Sub Tab 1 (종목별수익율 시트)
    ytm: TffMonthInfo | null;         // Sub Tab 2 (YTM 시트)
    monthlyMap: {                     // Sub Tab 3 (월별: 1월, 2월, 3월...)
      [month: string]: TffMonthInfo; 
    };
    latestMonth: string; // 파싱된 가장 최근 달 이름 (예: "3월")
}
