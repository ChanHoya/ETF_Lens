// dashboard/src/lib/realEstateSimulator.ts
/**
 * 실물 아파트 vs 배당 ETF 기회비용 및 10개년 순자산·현금흐름 정밀 시뮬레이터 엔진
 * - 대출 상환 방식: 원리금균등(Amortization), 원금균등, 만기일시(거치식)
 * - 취득세 및 부대비용: 주택수별 취득세율(1~3%, 8%, 12%), 중개보수, 채권/인지세
 * - 보유세: 공시가격 현실화율(69%), 재산세 누진세율, 종부세(공제 12억/9억)
 * - 10개년 순자산(Net Worth) 및 복리 재투자 시계열 생성
 * - 가구소득 대비 DSR(총부채원리금상환비율) 하우스푸어 위험도 산출
 */

export type RepaymentMethod = 'amortization' | 'equal_principal' | 'bullet';

export interface SimulatorParams {
  propertyPrice: number;        // 아파트 매매가 (억원)
  loanRatio: number;            // LTV (%)
  mortgageRate: number;         // 주담대 금리 (%)
  loanTenureYears: number;      // 대출 만기 (년: 10, 20, 30, 40)
  repaymentMethod: RepaymentMethod; // 상환 방식
  homeCount: 1 | 2;             // 주택 수 (1주택, 다주택)
  householdIncome: number;      // 가구 연소득 (만원)
  rePriceGrowthRate: number;    // 아파트 연간 가격 변동률 (%)
  etfDividendYield: number;     // ETF 연간 배당수익률 (%)
  etfCapitalGrowth: number;     // ETF 연간 자본차익 성장률 (%)
}

export interface LoanRepaymentResult {
  loanWon: number;
  monthlyPayment: number;       // 첫 달 월 납입금 (원)
  monthlyPrincipal: number;     // 첫 달 상환 원금 (원)
  monthlyInterest: number;      // 첫 달 이자 (원)
  annualTotalPayment: number;   // 1년차 총 상환액 (원리금)
  totalInterest10Y: number;     // 10년간 누적 이자액 (원)
  remainingLoanYear10: number;  // 10년 후 잔여 대출금 (원)
}

export interface AcquisitionCosts {
  acquisitionTax: number;       // 취득세 (원)
  brokerFee: number;            // 중개보수 (원)
  stampAndBond: number;         // 국민주택채권할인/인지세/법무비용 (원)
  totalInitialCost: number;     // 초기 부대비용 합계 (원)
}

export interface AnnualHoldingCosts {
  propertyTax: number;          // 재산세 (원)
  comprehensiveTax: number;     // 종합부동산세 (원)
  totalHoldingTax: number;      // 총 보유세 (원)
  maintenanceFee: number;       // 장기수선충당금/관리비/보험료 (원)
  totalAnnualCost: number;      // 연간 총 유지비용 (이자 제외)
}

export interface YearlyProjectionPoint {
  year: number;
  label: string;
  rePropertyValue: number;      // 부동산 평가액 (억원)
  reRemainingLoan: number;      // 잔여 대출 (억원)
  reNetWorth: number;           // 부동산 순자산 = 평가액 - 잔여대출 (억원)
  reCumulativeCosts: number;    // 누적 지출비용 (억원)
  etfNetWorth: number;          // 배당 ETF 복리 순자산 (억원)
  etfCumulativeDividends: number;// 누적 수령 배당금 (억원)
  netWorthGap: number;          // ETF 순자산 - 부동산 순자산 (억원)
}

export interface HousePoorDiagnosis {
  annualDebtService: number;    // 연간 원리금 상환액 (원)
  dsrRatio: number;             // DSR (%)
  riskLevel: 'safe' | 'caution' | 'warning' | 'critical';
  riskLabel: string;
  riskColor: string;
  description: string;
}

/**
 * 1. 대출 상환 방식별 월 납입금 및 잔액 계산
 */
export function calculateLoanRepayment(
  loanWon: number,
  annualRatePct: number,
  years: number,
  method: RepaymentMethod
): LoanRepaymentResult {
  if (loanWon <= 0) {
    return {
      loanWon: 0,
      monthlyPayment: 0,
      monthlyPrincipal: 0,
      monthlyInterest: 0,
      annualTotalPayment: 0,
      totalInterest10Y: 0,
      remainingLoanYear10: 0,
    };
  }

  const monthlyRate = (annualRatePct / 100) / 12;
  const totalMonths = years * 12;
  const simMonths = Math.min(120, totalMonths); // 10년(120개월) 추적

  let firstMonthlyPayment = 0;
  let firstMonthlyPrincipal = 0;
  let firstMonthlyInterest = loanWon * monthlyRate;
  let remainingLoan = loanWon;
  let totalInterest10Y = 0;
  let annualTotalPayment = 0;

  if (method === 'bullet') {
    // 만기일시상환 (이자만 납입)
    firstMonthlyPrincipal = 0;
    firstMonthlyInterest = loanWon * monthlyRate;
    firstMonthlyPayment = firstMonthlyInterest;
    annualTotalPayment = firstMonthlyInterest * 12;
    totalInterest10Y = firstMonthlyInterest * simMonths;
    remainingLoan = loanWon;
  } else if (method === 'amortization') {
    // 원리금균등상환
    if (monthlyRate === 0) {
      firstMonthlyPayment = loanWon / totalMonths;
      firstMonthlyPrincipal = firstMonthlyPayment;
      firstMonthlyInterest = 0;
    } else {
      const pmt = (loanWon * monthlyRate * Math.pow(1 + monthlyRate, totalMonths)) /
                  (Math.pow(1 + monthlyRate, totalMonths) - 1);
      firstMonthlyPayment = pmt;
      firstMonthlyPrincipal = pmt - firstMonthlyInterest;
    }

    // 120개월 시뮬레이션
    let curBal = loanWon;
    for (let m = 1; m <= simMonths; m++) {
      const curInterest = curBal * monthlyRate;
      const curPrincipal = firstMonthlyPayment - curInterest;
      totalInterest10Y += curInterest;
      curBal = Math.max(0, curBal - curPrincipal);
      if (m <= 12) {
        annualTotalPayment += firstMonthlyPayment;
      }
    }
    remainingLoan = curBal;
  } else {
    // 원금균등상환
    const fixedPrincipal = loanWon / totalMonths;
    firstMonthlyPrincipal = fixedPrincipal;
    firstMonthlyInterest = loanWon * monthlyRate;
    firstMonthlyPayment = fixedPrincipal + firstMonthlyInterest;

    let curBal = loanWon;
    for (let m = 1; m <= simMonths; m++) {
      const curInterest = curBal * monthlyRate;
      totalInterest10Y += curInterest;
      curBal = Math.max(0, curBal - fixedPrincipal);
      if (m <= 12) {
        annualTotalPayment += fixedPrincipal + curInterest;
      }
    }
    remainingLoan = curBal;
  }

  return {
    loanWon,
    monthlyPayment: Math.round(firstMonthlyPayment),
    monthlyPrincipal: Math.round(firstMonthlyPrincipal),
    monthlyInterest: Math.round(firstMonthlyInterest),
    annualTotalPayment: Math.round(annualTotalPayment),
    totalInterest10Y: Math.round(totalInterest10Y),
    remainingLoanYear10: Math.round(remainingLoan),
  };
}

/**
 * 2. 취득세 및 초기 부대비용 정밀 계산
 */
export function calculateAcquisitionCosts(propertyPriceWon: number, homeCount: 1 | 2): AcquisitionCosts {
  const price억 = propertyPriceWon / 100000000;

  // 취득세율 (지방교육세 0.1~0.4% + 농특세 포함 실효세율)
  let taxRate = 0.011; // 기본 1주택 6억 이하: 1.1%
  if (homeCount === 2) {
    taxRate = 0.084; // 2주택 조정/비조정 평균 8.4%
  } else {
    if (price억 <= 6) {
      taxRate = 0.011;
    } else if (price억 <= 9) {
      // 6~9억 구간 산식: (매매가 * 2/3 - 3) * 1.1%
      taxRate = (price억 * (2 / 3) - 3) * 0.01 + 0.003;
    } else {
      // 9억 초과: 취득세 3% + 지방교육세 0.3% + 농특세 0.2% = 3.5%
      taxRate = 0.035;
    }
  }

  const acquisitionTax = Math.round(propertyPriceWon * taxRate);

  // 법정 중개보수 상한요율 (상한요율 협의 기준)
  let brokerRate = 0.004;
  if (price억 >= 15) {
    brokerRate = 0.007 * 0.8; // 15억 이상 0.7% 상한(협의 0.56%)
  } else if (price억 >= 9) {
    brokerRate = 0.005 * 0.8; // 9~15억 0.5% 상한(협의 0.4%)
  } else if (price억 >= 6) {
    brokerRate = 0.004 * 0.8;
  }
  const brokerFee = Math.round(propertyPriceWon * brokerRate);

  // 국민주택채권 할인비용 및 인지세/법무사 등기보수 (약 0.35%)
  const stampAndBond = Math.round(propertyPriceWon * 0.0035);

  return {
    acquisitionTax,
    brokerFee,
    stampAndBond,
    totalInitialCost: acquisitionTax + brokerFee + stampAndBond,
  };
}

/**
 * 3. 연간 보유세(재산세 + 종부세) 및 관리비 계산
 */
export function calculateAnnualHoldingCosts(propertyPriceWon: number, homeCount: 1 | 2): AnnualHoldingCosts {
  // 공시가격 현실화율 약 69%
  const officialPriceWon = propertyPriceWon * 0.69;
  const officialPrice억 = officialPriceWon / 100000000;

  // 재산세 과세표준 (공시가격 * 공정시장가액비율 60%)
  const taxBase = officialPriceWon * 0.6;
  // 재산세 누진구간 (도시지역분 0.14% + 지방교육세 20% 포함 간이 실효세율)
  let propertyTax = 0;
  if (officialPrice억 <= 6) {
    propertyTax = taxBase * 0.0025;
  } else if (officialPrice억 <= 9) {
    propertyTax = taxBase * 0.0035;
  } else if (officialPrice억 <= 15) {
    propertyTax = taxBase * 0.0045;
  } else {
    propertyTax = taxBase * 0.0055;
  }

  // 종합부동산세 (1세대 1주택 기본공제 12억, 다주택 9억)
  const exemptionWon = (homeCount === 1 ? 12 : 9) * 100000000;
  let comprehensiveTax = 0;
  if (officialPriceWon > exemptionWon) {
    const compTaxBase = (officialPriceWon - exemptionWon) * 0.6;
    // 세율 0.5% ~ 1.5% 구간
    comprehensiveTax = compTaxBase * (homeCount === 1 ? 0.008 : 0.015);
  }


  const totalHoldingTax = Math.round(propertyTax + comprehensiveTax);

  // 연간 아파트 관리비 + 장기수선충당금 + 건물화재보험료 + 건보료 지역가입자 가산 추정치
  // 아파트 가액 비례 + 기본 연 250만 원
  const maintenanceFee = Math.round(propertyPriceWon * 0.0025 + 2500000);

  return {
    propertyTax: Math.round(propertyTax),
    comprehensiveTax: Math.round(comprehensiveTax),
    totalHoldingTax,
    maintenanceFee,
    totalAnnualCost: totalHoldingTax + maintenanceFee,
  };
}

/**
 * 4. 10개년 누적 순자산(Net Worth) 및 복리 시뮬레이션
 */
export function simulate10YearTrajectory(params: SimulatorParams): YearlyProjectionPoint[] {
  const propertyWon = params.propertyPrice * 100000000;
  const loanWon = propertyWon * (params.loanRatio / 100);
  const initialEquityWon = propertyWon - loanWon;

  const initCosts = calculateAcquisitionCosts(propertyWon, params.homeCount);

  // ETF 투자에 투입 가능한 총 자기자본 = 아파트 순수 자기자본 + 아파트 매입 시 낭비된 초기 부대비용
  const etfInitialCapitalWon = initialEquityWon + initCosts.totalInitialCost;

  const monthlyRate = (params.mortgageRate / 100) / 12;
  const totalMonths = params.loanTenureYears * 12;

  // 원리금균등 pmt 산출
  const pmt = (loanWon > 0 && monthlyRate > 0)
    ? (loanWon * monthlyRate * Math.pow(1 + monthlyRate, totalMonths)) /
      (Math.pow(1 + monthlyRate, totalMonths) - 1)
    : 0;

  const points: YearlyProjectionPoint[] = [];

  let curLoanBal = loanWon;
  let curEtfWealth = etfInitialCapitalWon;
  let cumulativeDividends = 0;
  let cumulativeReCosts = initCosts.totalInitialCost;

  const reAnnualRate = params.rePriceGrowthRate / 100;
  const etfDivRate = params.etfDividendYield / 100;
  const etfCapRate = params.etfCapitalGrowth / 100;

  // Year 0 (시작 시점)
  points.push({
    year: 0,
    label: '시작',
    rePropertyValue: Number((propertyWon / 100000000).toFixed(2)),
    reRemainingLoan: Number((loanWon / 100000000).toFixed(2)),
    reNetWorth: Number((initialEquityWon / 100000000).toFixed(2)),
    reCumulativeCosts: Number((initCosts.totalInitialCost / 100000000).toFixed(2)),
    etfNetWorth: Number((etfInitialCapitalWon / 100000000).toFixed(2)),
    etfCumulativeDividends: 0,
    netWorthGap: Number(((etfInitialCapitalWon - initialEquityWon) / 100000000).toFixed(2)),
  });

  for (let year = 1; year <= 10; year++) {
    // 1) 아파트 시세 변동
    const curPropertyVal = propertyWon * Math.pow(1 + reAnnualRate, year);

    // 2) 연간 대출 이자 및 잔액 추적
    let yearInterest = 0;
    if (params.repaymentMethod === 'bullet') {
      yearInterest = curLoanBal * (params.mortgageRate / 100);
      // 만기일시: 잔액 유지
    } else if (params.repaymentMethod === 'amortization') {
      for (let m = 0; m < 12; m++) {
        const intAmt = curLoanBal * monthlyRate;
        const princAmt = pmt - intAmt;
        yearInterest += intAmt;
        curLoanBal = Math.max(0, curLoanBal - princAmt);
      }
    } else {
      // 원금균등
      const monthlyPrinc = loanWon / totalMonths;
      for (let m = 0; m < 12; m++) {
        const intAmt = curLoanBal * monthlyRate;
        yearInterest += intAmt;
        curLoanBal = Math.max(0, curLoanBal - monthlyPrinc);
      }
    }

    // 아파트 연간 보유세 + 관리비
    const curYearHolding = calculateAnnualHoldingCosts(curPropertyVal, params.homeCount);
    cumulativeReCosts += yearInterest + curYearHolding.totalAnnualCost;

    // 아파트 순자산 = 현재 주택가치 - 잔여 대출
    const reNetWorth = Math.max(0, curPropertyVal - curLoanBal);

    // 3) 배당 ETF 복리 성장 (배당금 수령 + 배당금 전액 재투자 복리 + 자본성장)
    const yearDividend = curEtfWealth * etfDivRate;
    cumulativeDividends += yearDividend;
    // 배당 재투자 및 주가 상승
    curEtfWealth = curEtfWealth * (1 + etfCapRate) + yearDividend;

    const gap = (curEtfWealth - reNetWorth) / 100000000;

    points.push({
      year,
      label: `${year}년차`,
      rePropertyValue: Number((curPropertyVal / 100000000).toFixed(2)),
      reRemainingLoan: Number((curLoanBal / 100000000).toFixed(2)),
      reNetWorth: Number((reNetWorth / 100000000).toFixed(2)),
      reCumulativeCosts: Number((cumulativeReCosts / 100000000).toFixed(2)),
      etfNetWorth: Number((curEtfWealth / 100000000).toFixed(2)),
      etfCumulativeDividends: Number((cumulativeDividends / 100000000).toFixed(2)),
      netWorthGap: Number(gap.toFixed(2)),
    });
  }

  return points;
}

/**
 * 5. 가구 소득 대비 DSR(총부채원리금상환비율) 하우스푸어 위험도 진단
 */
export function diagnoseHousePoorRisk(
  annualDebtServiceWon: number,
  annualHouseholdIncomeWon: number
): HousePoorDiagnosis {
  if (annualHouseholdIncomeWon <= 0) {
    return {
      annualDebtService: annualDebtServiceWon,
      dsrRatio: 0,
      riskLevel: 'safe',
      riskLabel: '판정 불가',
      riskColor: 'text-slate-400 bg-slate-100 dark:bg-slate-800',
      description: '연소득 정보가 입력되지 않았습니다.',
    };
  }

  const dsrRatio = Number(((annualDebtServiceWon / annualHouseholdIncomeWon) * 100).toFixed(1));

  if (dsrRatio < 30) {
    return {
      annualDebtService: annualDebtServiceWon,
      dsrRatio,
      riskLevel: 'safe',
      riskLabel: '안전 구간 (저위험)',
      riskColor: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500/30',
      description: '대출 상환 부담이 소득의 30% 미만으로 유동성이 매우 건전하며 소비 및 추가 저축 여력이 충분합니다.',
    };
  } else if (dsrRatio < 40) {
    return {
      annualDebtService: annualDebtServiceWon,
      dsrRatio,
      riskLevel: 'caution',
      riskLabel: '주의 구간 (스트레스 임계치)',
      riskColor: 'text-blue-500 bg-blue-50 dark:bg-blue-950/60 border-blue-500/30',
      description: '금융당국 권고 한도(40%) 이내이나, 금리 상승 시 가계 가처분 소득이 급감할 수 있는 관리 필요 구간입니다.',
    };
  } else if (dsrRatio < 60) {
    return {
      annualDebtService: annualDebtServiceWon,
      dsrRatio,
      riskLevel: 'warning',
      riskLabel: '유동성 결박 위험 (하우스푸어 진입)',
      riskColor: 'text-amber-500 bg-amber-50 dark:bg-amber-950/60 border-amber-500/30',
      description: '소득의 40~60%가 대출 상환에 묶여 생활비 외 비상금 축적이 불가능하며, 금리 변동이나 실직 시 즉각 부실 위험에 직면합니다.',
    };
  } else {
    return {
      annualDebtService: annualDebtServiceWon,
      dsrRatio,
      riskLevel: 'critical',
      riskLabel: '초고위험 (환금성 마비 트랩)',
      riskColor: 'text-red-500 bg-red-50 dark:bg-red-950/60 border-red-500/30',
      description: '소득의 60% 이상이 빚을 갚는 데 소진되는 전형적인 하우스푸어 상태입니다. 집값이 오르더라도 팔지 못하면 매달 유동성 위기가 심화됩니다.',
    };
  }
}
