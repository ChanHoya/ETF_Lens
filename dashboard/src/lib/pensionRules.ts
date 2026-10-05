/**
 * 연금·절세 웰스 허브(Pension Wealth Hub) 핵심 금융 및 세제 계산 엔진
 * - 국민연금 조기 vs 정상 vs 연기 수령 손익분기점(BEP)
 * - 연금 3총사(연금저축 + IRP + ISA) 세액공제 및 과세이연 복리 효과
 * - 은퇴 후 사적연금 인출세율(3.3%~5.5%) 및 1,500만원 초과 과세 판정
 */

// ── 1. 국민연금(NPS) 규정 및 BEP 계산 ─────────────────────────────────────

export interface NpsEarlyDeferralParams {
  baseMonthlyPension: number;       // 정상수령 기준 월 예상액 (만원, 예: 150)
  birthYear: number;                // 출생연도 (예: 1965)
  earlyYears?: number;              // 조기 연수 (1~5년, 기본 5)
  deferYears?: number;              // 연기 연수 (1~5년, 기본 5)
  expectedLifeExpectancy?: number;  // 사용자 기대수명 (예: 85세)
  maxAge?: number;                  // 시뮬레이션 종료 나이 (기본 95)
}

export interface AgeDataPoint {
  age: number;
  earlyMonthly: number;             // 조기 월 수령액 (만원)
  normalMonthly: number;            // 정상 월 수령액 (만원)
  deferMonthly: number;             // 연기 월 수령액 (만원)
  earlyCumulative: number;          // 조기 누적 수령액 (만원)
  normalCumulative: number;         // 정상 누적 수령액 (만원)
  deferCumulative: number;          // 연기 누적 수령액 (만원)
}

export interface CrossoverPoint {
  ageExact: number;                 // 예: 76.7
  ageDisplay: string;               // "만 76세 8개월"
  description: string;
}

export interface StrategyDetail {
  type: "EARLY" | "NORMAL" | "DEFER";
  title: string;
  badge: string;
  startAge: number;
  ratePercent: number;              // 70%, 100%, 136%
  rateLabel: string;
  monthlyPension: number;           // 만원
  annualPension: number;            // 만원
  cumulativeAt80: number;           // 80세 누적액 (만원)
  cumulativeAt85: number;           // 85세 누적액 (만원)
  cumulativeAt90: number;           // 90세 누적액 (만원)
  totalAtMaxAge: number;            // 95세 누적액 (만원)
  healthInsuranceRisk: boolean;     // 연 2,000만원 초과 시 건보 피부양자 탈락 위험
  healthInsuranceNote: string;
  pros: string[];
  cons: string[];
  recommendTarget: string;
}

export interface NpsEarlyDeferralResult {
  birthYear: number;
  normalStartAge: number;
  earlyStartAge: number;
  deferStartAge: number;
  earlyYears: number;
  deferYears: number;
  baseMonthlyPension: number;
  expectedLifeExpectancy: number;

  crossoverEarlyVsNormal: CrossoverPoint;
  crossoverNormalVsDefer: CrossoverPoint;
  crossoverEarlyVsDefer: CrossoverPoint;

  dataPoints: AgeDataPoint[];

  strategies: {
    early: StrategyDetail;
    normal: StrategyDetail;
    defer: StrategyDetail;
  };

  recommendedType: "EARLY" | "NORMAL" | "DEFER";
  recommendedReason: string;
  cfpPrescription: string[];
}

/**
 * 출생연도별 법정 노령연금 개시 나이
 */
export function statutoryPensionStartAge(birthYear: number): number {
  if (birthYear <= 1952) return 60;
  if (birthYear >= 1969) return 65;
  return 61 + Math.floor((birthYear - 1953) / 4);
}

/**
 * 나이 소수점을 만 나이/개월수로 포맷 (예: 76.67 -> "만 76세 8개월")
 */
export function formatAgeWithMonths(exactAge: number): string {
  const years = Math.floor(exactAge);
  const months = Math.round((exactAge - years) * 12);
  if (months === 0) return `만 ${years}세`;
  if (months === 12) return `만 ${years + 1}세`;
  return `만 ${years}세 ${months}개월`;
}

/**
 * 국민연금 조기 vs 정상 vs 연기 손익분기점(BEP) 연산
 */
export function calculateNpsEarlyDeferralBep(params: NpsEarlyDeferralParams): NpsEarlyDeferralResult {
  const {
    baseMonthlyPension = 100,
    birthYear = 1969,
    earlyYears = 5,
    deferYears = 5,
    expectedLifeExpectancy = 85,
    maxAge = 95,
  } = params || {};

  const normalStartAge = statutoryPensionStartAge(birthYear);
  const validEarlyYears = Math.min(5, Math.max(1, earlyYears));
  const validDeferYears = Math.min(5, Math.max(1, deferYears));

  const earlyStartAge = normalStartAge - validEarlyYears;
  const deferStartAge = normalStartAge + validDeferYears;

  // 조기: 연 6% 감액 (최대 30%)
  const earlyRate = 1 - 0.06 * validEarlyYears;
  const normalRate = 1.0;
  // 연기: 연 7.2% 가산 (최대 36%)
  const deferRate = 1 + 0.072 * validDeferYears;

  const earlyBaseMonthly = Math.round(baseMonthlyPension * earlyRate * 10) / 10;
  const normalBaseMonthly = baseMonthlyPension;
  const deferBaseMonthly = Math.round(baseMonthlyPension * deferRate * 10) / 10;

  const dataPoints: AgeDataPoint[] = [];
  let earlyCum = 0;
  let normalCum = 0;
  let deferCum = 0;

  for (let age = earlyStartAge; age <= maxAge; age++) {
    const earlyMonthly = age >= earlyStartAge ? earlyBaseMonthly : 0;
    const earlyAnnual = earlyMonthly * 12;
    earlyCum += earlyAnnual;

    const normalMonthly = age >= normalStartAge ? normalBaseMonthly : 0;
    const normalAnnual = normalMonthly * 12;
    normalCum += normalAnnual;

    const deferMonthly = age >= deferStartAge ? deferBaseMonthly : 0;
    const deferAnnual = deferMonthly * 12;
    deferCum += deferAnnual;

    dataPoints.push({
      age,
      earlyMonthly,
      normalMonthly,
      deferMonthly,
      earlyCumulative: Math.round(earlyCum),
      normalCumulative: Math.round(normalCum),
      deferCumulative: Math.round(deferCum),
    });
  }

  // 수학적 교차 연령
  // ① 조기 vs 정상: (1 - 0.06 * earlyYears) / 0.06
  const yearsToCatchUpEarly = (1 - 0.06 * validEarlyYears) / 0.06;
  const earlyVsNormalExact = normalStartAge + yearsToCatchUpEarly;

  // ② 정상 vs 연기: 1 / 0.072 ≈ 13.89년
  const yearsToCatchUpDefer = 1 / 0.072;
  const normalVsDeferExact = deferStartAge + yearsToCatchUpDefer;

  // ③ 조기 vs 연기
  const earlyTotalAtDefer = (deferStartAge - earlyStartAge) * earlyRate;
  const annualGapEarlyVsDefer = deferRate - earlyRate;
  const yearsToCatchUpEarlyVsDefer = annualGapEarlyVsDefer > 0 ? earlyTotalAtDefer / annualGapEarlyVsDefer : 0;
  const earlyVsDeferExact = deferStartAge + yearsToCatchUpEarlyVsDefer;

  const findCum = (targetAge: number) => {
    const pt = dataPoints.find((d) => d.age === targetAge) || dataPoints[dataPoints.length - 1];
    return {
      early: pt ? pt.earlyCumulative : 0,
      normal: pt ? pt.normalCumulative : 0,
      defer: pt ? pt.deferCumulative : 0,
    };
  };

  const cum80 = findCum(80);
  const cum85 = findCum(85);
  const cum90 = findCum(90);
  const cumMax = dataPoints[dataPoints.length - 1] || { earlyCumulative: 0, normalCumulative: 0, deferCumulative: 0 };

  // 건보료 피부양자 자격 한도 (연 2,000만원 / 월 166.7만원)
  const healthCapAnnual = 2000;
  const earlyAnnualCap = earlyBaseMonthly * 12;
  const normalAnnualCap = normalBaseMonthly * 12;
  const deferAnnualCap = deferBaseMonthly * 12;

  const earlyStrategy: StrategyDetail = {
    type: "EARLY",
    title: "조기노령연금",
    badge: `⚡ ${validEarlyYears}년 조기 수령`,
    startAge: earlyStartAge,
    ratePercent: Math.round(earlyRate * 100),
    rateLabel: `-${Math.round((1 - earlyRate) * 100)}% 감액 (연 6%)`,
    monthlyPension: earlyBaseMonthly,
    annualPension: earlyAnnualCap,
    cumulativeAt80: cum80.early,
    cumulativeAt85: cum85.early,
    cumulativeAt90: cum90.early,
    totalAtMaxAge: cumMax.earlyCumulative,
    healthInsuranceRisk: earlyAnnualCap > healthCapAnnual,
    healthInsuranceNote: earlyAnnualCap > healthCapAnnual
      ? `연 ${earlyAnnualCap.toLocaleString()}만원으로 피부양자 한도(2,000만원)를 초과합니다.`
      : `감액으로 연 ${earlyAnnualCap.toLocaleString()}만원이 되어 건보료 피부양자 자격 방어에 유리합니다.`,
    pros: [
      `${earlyStartAge}세부터 즉시 수령하여 은퇴 직후 소득 공백기(크레바스) 완벽 해소`,
      `${formatAgeWithMonths(earlyVsNormalExact)} 이전 사망 시 정상수령 대비 총 수령액 우위`,
      `월 수령액이 낮아져 건강보험료 피부양자 자격(연 2,000만원 이하) 방어에 유리`,
    ],
    cons: [
      `평생 ${Math.round((1 - earlyRate) * 100)}% 감액된 연금액을 받게 됨`,
      `${formatAgeWithMonths(earlyVsNormalExact)} 이후 장수할수록 정상수령 대비 누적 손실 확대`,
      `A값(2026년 기준 월 약 319만원) 초과 소득 발생 시 연금 지급이 일시 정지되거나 감액될 수 있음`,
    ],
    recommendTarget: "은퇴 직후 재취업이 어렵고 긴급 생활비가 절실하거나, 건강 상태상 단명 가능성이 우려되는 경우",
  };

  const normalStrategy: StrategyDetail = {
    type: "NORMAL",
    title: "정상노령연금",
    badge: `🎯 ${normalStartAge}세 법정 정상수령`,
    startAge: normalStartAge,
    ratePercent: 100,
    rateLabel: "100% 정규 수령",
    monthlyPension: normalBaseMonthly,
    annualPension: normalAnnualCap,
    cumulativeAt80: cum80.normal,
    cumulativeAt85: cum85.normal,
    cumulativeAt90: cum90.normal,
    totalAtMaxAge: cumMax.normalCumulative,
    healthInsuranceRisk: normalAnnualCap > healthCapAnnual,
    healthInsuranceNote: normalAnnualCap > healthCapAnnual
      ? `연 ${normalAnnualCap.toLocaleString()}만원으로 피부양자 한도(2,000만원)를 초과하여 지역건보료 부과 대상이 될 수 있습니다.`
      : `연 ${normalAnnualCap.toLocaleString()}만원으로 피부양자 소득 한도(2,000만원) 이내를 안전하게 유지합니다.`,
    pros: [
      "국민연금 감액이나 연기 손실 위험이 없는 가장 표준적이고 안정적인 수령 모델",
      `대한민국 평균 기대수명(${expectedLifeExpectancy}세 전후)에서 위험 대비 수익비가 가장 균형적`,
      "정상 수령 시점까지 퇴직연금·개인연금(브릿지 연금)을 활용해 세제 혜택 극대화 가능",
    ],
    cons: [
      `${normalStartAge}세 개시 전까지 소득 공백기 생활비 대책 필요`,
      `${formatAgeWithMonths(normalVsDeferExact)} 이상 초장수 시 연기연금 대비 최대 수령액 기회비용 발생`,
    ],
    recommendTarget: "사적연금이나 금융자산으로 은퇴 후 정상개시 나이까지 생활비 조달이 가능하고, 평균적인 건강 상태를 가진 가구",
  };

  const deferStrategy: StrategyDetail = {
    type: "DEFER",
    title: "연기연금",
    badge: `🏆 ${validDeferYears}년 연기 수령`,
    startAge: deferStartAge,
    ratePercent: Math.round(deferRate * 100),
    rateLabel: `+${Math.round((deferRate - 1) * 100)}% 가산 (연 7.2%)`,
    monthlyPension: deferBaseMonthly,
    annualPension: deferAnnualCap,
    cumulativeAt80: cum80.defer,
    cumulativeAt85: cum85.defer,
    cumulativeAt90: cum90.defer,
    totalAtMaxAge: cumMax.deferCumulative,
    healthInsuranceRisk: deferAnnualCap > healthCapAnnual,
    healthInsuranceNote: deferAnnualCap > healthCapAnnual
      ? `연 ${deferAnnualCap.toLocaleString()}만원으로 피부양자 한도(2,000만원)를 초과합니다. 건보료 지역가입자 전환 시 월 10~20만원대 건보료가 부과될 수 있습니다.`
      : `증액 후에도 연 ${deferAnnualCap.toLocaleString()}만원으로 피부양자 기준(2,000만원) 이하를 유지합니다.`,
    pros: [
      `연 7.2%(월 0.6%)의 확정 가산율로 최대 +${Math.round((deferRate - 1) * 100)}% 증액된 연금을 평생 수령`,
      `${formatAgeWithMonths(normalVsDeferExact)} 이상 생존 시 모든 옵션 중 생애 총 수령액이 압도적 1위`,
      "초고령기(85세 이후) 물가상승 및 의료비 지출에 가장 강력한 구매력 방어 효과 제공",
    ],
    cons: [
      `${normalStartAge}~${deferStartAge}세 5년간 국민연금을 받지 못하므로 든든한 타 소득원 필수`,
      `${formatAgeWithMonths(normalVsDeferExact)} 이전 사망 시 정상수령 대비 누적액 손실 발생`,
      `연간 연금 수령액이 2,000만원을 초과할 경우 건강보험 피부양자 자격 박탈 위험`,
    ],
    recommendTarget: "장수 유전력이 있거나 70세까지 탄탄한 근로·사업·배당 소득이 있어 생활비 걱정이 없고 장수 리스크를 완벽히 헷지하고자 하는 가구",
  };

  let recommendedType: "EARLY" | "NORMAL" | "DEFER";
  let recommendedReason: string;

  if (expectedLifeExpectancy < earlyVsNormalExact) {
    recommendedType = "EARLY";
    recommendedReason = `회원님의 기대수명(${expectedLifeExpectancy}세)이 조기 vs 정상 손익분기점(${formatAgeWithMonths(earlyVsNormalExact)})보다 낮아, 조기에 수령을 시작하여 생애 총 수령액을 조기 확보하는 것이 수학적으로 유리합니다.`;
  } else if (expectedLifeExpectancy < normalVsDeferExact) {
    recommendedType = "NORMAL";
    recommendedReason = `회원님의 기대수명(${expectedLifeExpectancy}세)이 조기-정상 분기(${formatAgeWithMonths(earlyVsNormalExact)})를 넘고 정상-연기 분기(${formatAgeWithMonths(normalVsDeferExact)}) 이내에 위치하므로, 불필요한 감액 손실이나 연기 기간 무소득 리스크가 없는 '정상노령연금'이 최적의 선택입니다.`;
  } else {
    if (deferAnnualCap > healthCapAnnual && normalAnnualCap <= healthCapAnnual) {
      recommendedType = "NORMAL";
      recommendedReason = `기대수명(${expectedLifeExpectancy}세) 관점에서는 연기가 유리하나, 연기 시 연금액이 연 ${deferAnnualCap.toLocaleString()}만원이 되어 건강보험 피부양자 자격(연 2,000만원 한도)이 박탈됩니다. 건보료 납부액을 감안하면 정상수령이 실질 세후 소득면에서 더 유리할 수 있습니다.`;
    } else {
      recommendedType = "DEFER";
      recommendedReason = `회원님의 기대수명(${expectedLifeExpectancy}세)이 연기 손익분기점(${formatAgeWithMonths(normalVsDeferExact)})을 상회하므로, ${deferStartAge}세까지 연기하여 월 ${deferBaseMonthly}만원(+${Math.round((deferRate - 1) * 100)}%)의 강력한 평생 인플레이션 방어막을 구축하는 것을 권장합니다.`;
    }
  }

  const cfpPrescription: string[] = [
    `⚡ 조기 vs 정상 손익분기 나이는 【${formatAgeWithMonths(earlyVsNormalExact)}】입니다. 이 나이 이전에 사망 시 조기가 유리하며, 이후 생존 시 정상수령이 유리합니다.`,
    `🏆 정상 vs 연기 손익분기 나이는 【${formatAgeWithMonths(normalVsDeferExact)}】입니다. 만 ${Math.ceil(normalVsDeferExact)}세 이상 장수할 자신이 있다면 연기연금이 생애 최대 누적 연금액을 보장합니다.`,
    `💡 [A·B값 재평가 인사이트] 60세 시점에 조기를 신청하면 당시 A·B값으로 묶이지만, 65세 정상수령까지 기다리면 5년간 전체 가입자 평균소득(A값)과 과거소득 재평가율이 매년 상승하여 65세 정상 시작액이 약 25% 이상 더 커집니다. 이를 감안한 실제 체감 손익분기는 조기-정상 약 72세, 정상-연기 약 81세로 약 3~4년 더 앞당겨집니다.`,
    `💼 소득 있는 업무 종사 시 감액 주의 & 연기연금 치트키: 조기노령연금은 근로·사업소득이 A값(월 약 319만원) 초과 시 전액 지급정지됩니다. 반면 65~69세에 A값 초과 소득이 있는 분은 정상연금 수령 시 최대 50%까지 깎이므로, 이때 '연기연금'을 신청하면 감액을 100% 피하고 연 7.2% 가산까지 챙길 수 있습니다.`,
    `🛡️ 건강보험료 주의: 공적연금소득이 연 2,000만원(월 166.7만원)을 단 1원이라도 초과하면 직장가입자 자녀의 피부양자 자격이 상실되어 매월 10~25만원의 지역건보료가 부과됩니다. ${deferAnnualCap > 2000 ? "연기 시 피부양자 탈락 위험이 있으므로 주의가 필요합니다." : "현재 연금 규모는 건보료 한도 내에서 안전합니다."}`,
  ];

  return {
    birthYear,
    normalStartAge,
    earlyStartAge,
    deferStartAge,
    earlyYears: validEarlyYears,
    deferYears: validDeferYears,
    baseMonthlyPension,
    expectedLifeExpectancy,
    crossoverEarlyVsNormal: {
      ageExact: Math.round(earlyVsNormalExact * 10) / 10,
      ageDisplay: formatAgeWithMonths(earlyVsNormalExact),
      description: `${formatAgeWithMonths(earlyVsNormalExact)} 이전 사망 시 조기 유리, 이후 생존 시 정상수령 유리`,
    },
    crossoverNormalVsDefer: {
      ageExact: Math.round(normalVsDeferExact * 10) / 10,
      ageDisplay: formatAgeWithMonths(normalVsDeferExact),
      description: `${formatAgeWithMonths(normalVsDeferExact)} 이상 장수 시 연기연금 누적 수령액 역전 극대화`,
    },
    crossoverEarlyVsDefer: {
      ageExact: Math.round(earlyVsDeferExact * 10) / 10,
      ageDisplay: formatAgeWithMonths(earlyVsDeferExact),
      description: `조기와 연기간 누적액 교차 시점`,
    },
    dataPoints,
    strategies: {
      early: earlyStrategy,
      normal: normalStrategy,
      defer: deferStrategy,
    },
    recommendedType,
    recommendedReason,
    cfpPrescription,
  };
}


// ── 2. 연금 3총사(연금저축 + IRP + ISA) 절세 및 과세이연 시뮬레이터 ─────────────

export interface TaxSavingsParams {
  incomeLevel: "under55" | "over55"; // 총급여 5,500만원 이하(16.5%) vs 초과(13.2%)
  pensionSavingsAnnual: number;       // 연금저축 연 납입액 (만원, 최대 600)
  irpAnnual: number;                  // IRP 연 납입액 (만원, 최대 300)
  extraContributionAnnual: number;    // 추가 비공제 납입액 (만원, 한도 1,800만원까지)
  isaTransferAmount: number;          // ISA 만기 연금계좌 전환 금액 (만원, 10% 최대 300만원 세액공제)
  annualReturnPct: number;            // 연간 기대 복리 수익률 (%, 예: 7.0)
  investmentYears: number;            // 투자 운용 기간 (년, 예: 20)
  dividendYieldPct?: number;          // 배당수익률 (%, 기본 3.0)
}

export interface TaxSavingsYearData {
  year: number;
  generalTaxableBalance: number;      // 일반 위탁계좌 (매년 배당소득세 15.4% 차감)
  pensionTaxDeferredBalance: number;  // 연금계좌 (과세이연 100% 복리 재투자)
  taxGapBenefit: number;              // 절세 및 과세이연으로 불어난 차액
}

export interface TaxSavingsResult {
  taxDeductionRate: number;           // 16.5% 또는 13.2%
  annualContributionTotal: number;    // 총 연간 납입액 (만원)
  deductibleAnnual: number;           // 세액공제 대상 금액 (최대 900만원)
  annualTaxRefund: number;            // 매년 연말정산 환급액 (만원)
  isaTaxRefundBonus: number;          // ISA 전환으로 인한 추가 환급액 (만원)
  firstYearTotalRefund: number;       // 1년차 총 환급액 (만원)
  
  // 복리 자산 비교
  generalFinalBalance: number;        // 일반계좌 최종 평가액 (만원)
  pensionFinalBalance: number;        // 연금계좌 최종 평가액 (만원)
  netTaxDeferredAdvantage: number;    // 과세이연 복리 초과수익 (만원)
  chartData: TaxSavingsYearData[];
}

export function calculateTaxSavingsSimulation(params: TaxSavingsParams): TaxSavingsResult {
  const {
    incomeLevel,
    pensionSavingsAnnual,
    irpAnnual,
    extraContributionAnnual,
    isaTransferAmount,
    annualReturnPct = 7.0,
    investmentYears = 20,
    dividendYieldPct = 3.0,
  } = params;

  // 세액공제율
  const deductionRate = incomeLevel === "under55" ? 0.165 : 0.132;

  // 세액공제 한도: 연금저축 최대 600만 + IRP 최대 300만 = 합산 최대 900만원
  const effectivePension = Math.min(600, pensionSavingsAnnual);
  const remainingCap = 900 - effectivePension;
  const effectiveIrp = Math.min(remainingCap, Math.min(300, irpAnnual));
  const deductibleAnnual = effectivePension + effectiveIrp;

  const annualTaxRefund = Math.round(deductibleAnnual * deductionRate * 10) / 10;

  // ISA 전환 추가 세액공제: 전환액의 10%, 최대 300만원 한도 공제
  const isaDeductible = Math.min(300, Math.round(isaTransferAmount * 0.1));
  const isaTaxRefundBonus = Math.round(isaDeductible * deductionRate * 10) / 10;
  const firstYearTotalRefund = Math.round((annualTaxRefund + isaTaxRefundBonus) * 10) / 10;

  const annualContributionTotal = pensionSavingsAnnual + irpAnnual + extraContributionAnnual;

  // ── 장기 복리 과세이연 시뮬레이션 ──
  // 일반계좌: 배당수익(dividendYieldPct)에 대해 매년 15.4% 배당소득세 원천징수
  // 자본이득(annualReturnPct - dividendYieldPct)은 비과세/과세 가정
  const capitalGainRate = Math.max(0, (annualReturnPct - dividendYieldPct) / 100);
  const divRate = dividendYieldPct / 100;
  const generalEffectiveAnnualRate = capitalGainRate + divRate * (1 - 0.154);
  const pensionEffectiveAnnualRate = annualReturnPct / 100;

  const chartData: TaxSavingsYearData[] = [];
  let generalBal = isaTransferAmount;
  let pensionBal = isaTransferAmount;

  for (let y = 1; y <= investmentYears; y++) {
    // 매년 초 납입
    generalBal = (generalBal + annualContributionTotal) * (1 + generalEffectiveAnnualRate);
    pensionBal = (pensionBal + annualContributionTotal) * (1 + pensionEffectiveAnnualRate);

    chartData.push({
      year: y,
      generalTaxableBalance: Math.round(generalBal),
      pensionTaxDeferredBalance: Math.round(pensionBal),
      taxGapBenefit: Math.round(pensionBal - generalBal),
    });
  }

  const generalFinalBalance = Math.round(generalBal);
  const pensionFinalBalance = Math.round(pensionBal);
  const netTaxDeferredAdvantage = pensionFinalBalance - generalFinalBalance;

  return {
    taxDeductionRate: deductionRate * 100,
    annualContributionTotal,
    deductibleAnnual,
    annualTaxRefund,
    isaTaxRefundBonus,
    firstYearTotalRefund,
    generalFinalBalance,
    pensionFinalBalance,
    netTaxDeferredAdvantage,
    chartData,
  };
}


// ── 3. 은퇴 후 사적연금 인출세율 및 1,500만원 초과 과세 판정 ─────────────────

export interface WithdrawalTaxResult {
  monthlyWithdrawal: number;          // 월 인출 희망액 (만원)
  annualWithdrawal: number;           // 연간 인출액 (만원)
  isUnder1500Limit: boolean;          // 1,500만원 이하 저율분리과세(3.3~5.5%) 구간 여부
  rateByAge: {
    age55to69: number;                // 5.5%
    age70to79: number;                // 4.4%
    age80plus: number;                // 3.3%
  };
  taxAmount55to69: number;            // 만원
  taxAmount70to79: number;
  taxAmount80plus: number;
  taxIfOverLimitSeparate: number;     // 1,500만원 초과 시 16.5% 전액 분리과세 선택 시 세금
  advice: string;
}

export function calculateWithdrawalTax(monthlyWithdrawalManwon: number): WithdrawalTaxResult {
  const annualWithdrawal = monthlyWithdrawalManwon * 12;
  const isUnder1500Limit = annualWithdrawal <= 1500;

  const rate55 = 0.055;
  const rate70 = 0.044;
  const rate80 = 0.033;

  const taxAmount55to69 = Math.round(annualWithdrawal * rate55 * 10) / 10;
  const taxAmount70to79 = Math.round(annualWithdrawal * rate70 * 10) / 10;
  const taxAmount80plus = Math.round(annualWithdrawal * rate80 * 10) / 10;

  // 1,500만원 초과 시 16.5% 분리과세 신청 가능
  const taxIfOverLimitSeparate = Math.round(annualWithdrawal * 0.165 * 10) / 10;

  let advice = "";
  if (isUnder1500Limit) {
    advice = `연간 인출액(${annualWithdrawal}만원)이 사적연금 비과세/저율분리과세 기준(연 1,500만원 이하) 내에 위치하여 연령에 따라 3.3%~5.5%의 가장 낮은 연금소득세만 원천징수되고 종결됩니다.`;
  } else {
    advice = `연간 인출액(${annualWithdrawal}만원)이 1,500만원(월 125만원)을 초과했습니다. 초과 시 전체 금액에 대해 타 소득과 합산한 '종합과세' 또는 '16.5% 분리과세' 중 유리한 쪽을 선택해야 하므로, 월 인출액을 125만원 이하로 맞추고 나머지는 비과세 원금 인출이나 타 계좌로 분산하는 것을 권장합니다.`;
  }

  return {
    monthlyWithdrawal: monthlyWithdrawalManwon,
    annualWithdrawal,
    isUnder1500Limit,
    rateByAge: {
      age55to69: 5.5,
      age70to79: 4.4,
      age80plus: 3.3,
    },
    taxAmount55to69,
    taxAmount70to79,
    taxAmount80plus,
    taxIfOverLimitSeparate,
    advice,
  };
}
