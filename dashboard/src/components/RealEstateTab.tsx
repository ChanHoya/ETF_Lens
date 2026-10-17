'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  Building2,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  Flame,
  ShieldAlert,
  ArrowRight,
  ExternalLink,
  DollarSign,
  PieChart,
  Percent,
  Activity,
  Layers,
  HelpCircle,
  Sparkles,
  BarChart3,
  Scale,
  RefreshCw,
  Info
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend
} from 'recharts';

// 부동산 거래량 및 매물 추이 데이터 (2024년 1월 ~ 2026년 10월 최신, 출처: 서울부동산정보광장·아실)
const MARKET_TREND_DATA_FULL = [
  { month: '24.01', listings: 75.1, volume: 2.6, priceIndex: 99.8 },
  { month: '24.02', listings: 77.4, volume: 2.5, priceIndex: 100.1 },
  { month: '24.03', listings: 80.0, volume: 4.2, priceIndex: 100.6 },
  { month: '24.04', listings: 81.2, volume: 4.4, priceIndex: 101.2 },
  { month: '24.05', listings: 82.5, volume: 5.1, priceIndex: 102.0 },
  { month: '24.06', listings: 83.1, volume: 7.5, priceIndex: 103.5 },
  { month: '24.07', listings: 79.4, volume: 8.9, priceIndex: 105.1 }, // 24년 정책대출 피크
  { month: '24.08', listings: 80.2, volume: 6.2, priceIndex: 105.8 },
  { month: '24.09', listings: 83.7, volume: 3.1, priceIndex: 105.4 }, // 스트레스 DSR 2단계 도입
  { month: '24.10', listings: 86.4, volume: 2.8, priceIndex: 104.9 },
  { month: '24.11', listings: 88.1, volume: 2.4, priceIndex: 104.2 },
  { month: '24.12', listings: 89.5, volume: 2.1, priceIndex: 103.8 },
  { month: '25.01', listings: 89.2, volume: 2.3, priceIndex: 103.5 },
  { month: '25.02', listings: 88.8, volume: 2.6, priceIndex: 103.6 },
  { month: '25.03', listings: 89.9, volume: 2.8, priceIndex: 103.7 },
  { month: '25.04', listings: 88.4, volume: 3.1, priceIndex: 103.9 },
  { month: '25.05', listings: 87.2, volume: 3.4, priceIndex: 104.1 },
  { month: '25.06', listings: 86.5, volume: 3.7, priceIndex: 104.4 },
  { month: '25.07', listings: 85.8, volume: 3.9, priceIndex: 104.6 },
  { month: '25.08', listings: 86.2, volume: 3.5, priceIndex: 104.5 },
  { month: '25.09', listings: 85.4, volume: 3.6, priceIndex: 104.6 },
  { month: '25.10', listings: 85.0, volume: 3.8, priceIndex: 104.8 },
  { month: '25.11', listings: 84.6, volume: 3.5, priceIndex: 104.7 },
  { month: '25.12', listings: 84.2, volume: 3.4, priceIndex: 104.6 },
  { month: '26.01', listings: 84.8, volume: 3.5, priceIndex: 104.7 },
  { month: '26.02', listings: 84.5, volume: 3.7, priceIndex: 104.9 },
  { month: '26.03', listings: 83.9, volume: 4.1, priceIndex: 105.2 },
  { month: '26.04', listings: 83.5, volume: 4.3, priceIndex: 105.4 },
  { month: '26.05', listings: 83.1, volume: 4.4, priceIndex: 105.5 },
  { month: '26.06', listings: 82.6, volume: 4.6, priceIndex: 105.8 },
  { month: '26.07', listings: 82.2, volume: 4.5, priceIndex: 105.9 },
  { month: '26.08', listings: 82.8, volume: 4.1, priceIndex: 105.7 },
  { month: '26.09', listings: 83.2, volume: 3.8, priceIndex: 105.6 },
  { month: '26.10', listings: 83.4, volume: 3.6, priceIndex: 105.5 }, // 26년 10월 현재
];

export default function RealEstateTab() {
  // 전문가 뷰 선택 (전체, 엘리엇, 박은정)
  const [selectedExpert, setSelectedExpert] = useState<'all' | 'elliot' | 'park'>('all');

  // 차트 시계열 기간 선택 (1Y: 최근1년, 2Y: 최근2년, ALL: 2024~2026 전체)
  const [chartPeriod, setChartPeriod] = useState<'1Y' | '2Y' | 'ALL'>('ALL');

  // 백엔드 라이브 데이터 및 동기화 상태
  const [liveTrendData, setLiveTrendData] = useState<any[] | null>(null);
  const [summaryData, setSummaryData] = useState<any | null>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [apiSource, setApiSource] = useState<string>("FALLBACK_CACHE");

  // 데이터 로드 함수
  const loadRealEstateData = async (period: string) => {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const [trendsRes, summaryRes] = await Promise.all([
        fetch(`${baseUrl}/api/v1/real-estate/market-trends?period=${period}`).catch(() => null),
        fetch(`${baseUrl}/api/v1/real-estate/summary`).catch(() => null)
      ]);

      if (trendsRes && trendsRes.ok) {
        const trendsJson = await trendsRes.json();
        if (trendsJson && Array.isArray(trendsJson.data)) {
          setLiveTrendData(trendsJson.data);
          setApiSource(trendsJson.data_source || "FALLBACK_CACHE");
        }
      }

      if (summaryRes && summaryRes.ok) {
        const sumJson = await summaryRes.json();
        if (sumJson) {
          setSummaryData(sumJson);
        }
      }
    } catch (e) {
      console.warn("Failed to fetch live real estate data, using client fallback", e);
    }
  };

  useEffect(() => {
    loadRealEstateData(chartPeriod);
  }, [chartPeriod]);

  // 수동 동기화 트리거
  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      await fetch(`${baseUrl}/api/v1/real-estate/sync?force=true`, { method: 'POST' });
      await loadRealEstateData(chartPeriod);
    } catch (e) {
      console.warn("Sync failed", e);
    } finally {
      setIsSyncing(false);
    }
  };

  // 선택된 기간에 따른 데이터 필터링 (라이브 데이터 우선, 없으면 로컬 데이터셋 사용)
  const filteredTrendData = useMemo(() => {
    if (liveTrendData && liveTrendData.length > 0) {
      return liveTrendData;
    }
    if (chartPeriod === '1Y') return MARKET_TREND_DATA_FULL.slice(-12);
    if (chartPeriod === '2Y') return MARKET_TREND_DATA_FULL.slice(-24);
    return MARKET_TREND_DATA_FULL;
  }, [chartPeriod, liveTrendData]);

  // 부동산 vs ETF 시뮬레이터 상태
  const [propertyPrice, setPropertyPrice] = useState<number>(12); // 억원
  const [mortgageRate, setMortgageRate] = useState<number>(4.1); // %
  const [loanRatio, setLoanRatio] = useState<number>(40); // LTV %
  const [etfDividendYield, setEtfDividendYield] = useState<number>(4.5); // 배당수익률 %

  // 시뮬레이션 계산
  const simResults = useMemo(() => {
    const propertyWon = propertyPrice * 100000000;
    const loanWon = propertyWon * (loanRatio / 100);
    const equityWon = propertyWon - loanWon;

    // 부동산 연간 유지비용
    const annualInterest = loanWon * (mortgageRate / 100);
    // 재산세 + 종부세 (공시가격 70%, 대략적 구간별 실효세율)
    const propertyTax = propertyWon * (propertyPrice >= 15 ? 0.0055 : 0.0035);
    // 장기수선충당금, 관리비, 유지보수, 건보료 상승분 추정치
    const maintenanceAndInsurance = propertyWon * 0.003 + 2400000;
    const totalPropertyAnnualCost = annualInterest + propertyTax + maintenanceAndInsurance;

    // 초기 취득세 (3.3%)
    const acquisitionTax = propertyWon * 0.033;

    // 동일 자기자본(Equity)을 배당 ETF에 투자했을 때
    const annualDividend = equityWon * (etfDividendYield / 100);
    const monthlyDividend = annualDividend / 12;

    // 기회비용 차이 (연간 현금흐름 갭: 배당 수입 + 부동산 비용 절감액)
    const annualCashFlowDiff = annualDividend + totalPropertyAnnualCost;

    return {
      equityWon,
      loanWon,
      acquisitionTax,
      annualInterest,
      propertyTax,
      maintenanceAndInsurance,
      totalPropertyAnnualCost,
      annualDividend,
      monthlyDividend,
      annualCashFlowDiff
    };
  }, [propertyPrice, mortgageRate, loanRatio, etfDividendYield]);

  return (
    <div className="space-y-6 pb-16">
      {/* Top Banner / Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 dark:from-slate-950 dark:via-blue-950/60 dark:to-slate-950 border border-indigo-900/40 p-6 text-white shadow-xl">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                <Building2 className="w-3.5 h-3.5" />
                부동산 인텔리전스 레이더
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-500/20 text-red-300 border border-red-500/30">
                <AlertTriangle className="w-3 h-3" />
                거래절벽 심화 경보 (2026.10 최신)
              </span>
              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                apiSource === "SEOUL_OPEN_DATA_LIVE"
                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                  : "bg-blue-500/20 text-blue-300 border-blue-500/30"
              }`}>
                <Activity className="w-3 h-3" />
                {apiSource === "SEOUL_OPEN_DATA_LIVE" ? "서울 오픈데이터 라이브 연동" : "검증된 캐시 연동 (sample 대기)"}
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
              부동산 거시 진단 & 기회비용 인텔리전스
            </h1>
            <p className="mt-1 text-sm text-slate-300 max-w-2xl leading-relaxed">
              2024년 정책대출 반등 후 2025~2026년 현재까지 이어진 장기 매물 적체와 환금성 마비, 통계적 착시를 해부하고 실물 부동산과 금융자산(배당 ETF)의 보유비용 및 현금흐름을 객관적으로 대조합니다.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <button
              type="button"
              onClick={handleManualSync}
              disabled={isSyncing}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-xs transition-all duration-200 shadow-sm disabled:opacity-50 cursor-pointer"
              title="서울시 오픈데이터 및 실거래 통계 새로고침"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin text-blue-400" : ""}`} />
              <span>{isSyncing ? "동기화 중..." : "실데이터 갱신"}</span>
            </button>
            <a
              href="https://www.youtube.com/watch?v=3jlTPFa706E"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold text-xs transition-all duration-200 shadow-md hover:shadow-red-600/30 group"
            >
              <Flame className="w-4 h-4 fill-white text-white group-hover:scale-110 transition-transform" />
              <span>[특집] 두꺼비 세무사 원본 영상</span>
              <ExternalLink className="w-3.5 h-3.5 opacity-80" />
            </a>
          </div>
        </div>
      </div>

      {/* 4대 거시 지표 퀵 서머리 카드 (2026년 10월 최신 집계) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:border-blue-500/40 transition-all">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>서울 아파트 매물 적체</span>
            <span className="text-[11px] px-1.5 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-400 font-semibold">
              {summaryData?.active_listings?.status || "장기 고착화"}
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {summaryData?.active_listings?.value ? `${summaryData.active_listings.value}` : "83,400여 건"}
            </span>
            <span className="text-xs font-semibold text-red-500 flex items-center">
              <TrendingUp className="w-3.5 h-3.5 inline mr-0.5" /> 2026.10 최신
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            {summaryData?.active_listings?.desc || "피크(9만건) 대비 소폭 해소되었으나 평년(4~5만건) 대비 2배 적체"}
          </p>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:border-blue-500/40 transition-all">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>서울 월 실거래량</span>
            <span className="text-[11px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 font-semibold">
              {summaryData?.monthly_trade_volume?.status || "제한적 거래"}
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {summaryData?.monthly_trade_volume?.value || "3,800여 건"}
            </span>
            <span className="text-xs font-semibold text-blue-500 flex items-center">
              <TrendingDown className="w-3.5 h-3.5 inline mr-0.5" /> -57.3% (24.07 대비)
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            {summaryData?.monthly_trade_volume?.desc || "2024년 7월 피크(8.9천건) 대비 절반 수준에 머문 거래 정체"}
          </p>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:border-blue-500/40 transition-all">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>시중 주담대 실질금리</span>
            <span className="text-[11px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 font-medium">
              {summaryData?.mortgage_rate?.status || "가산금리 방어"}
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {summaryData?.mortgage_rate?.value ? `${summaryData.mortgage_rate.value}` : "3.85 ~ 4.40%"}
            </span>
            <span className="text-xs font-semibold text-emerald-500 flex items-center">
              기준금리 인하 반영
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            {summaryData?.mortgage_rate?.desc || "기준금리 인하에도 은행 관리 강화로 실질 대출금리 4% 안팎 유지"}
          </p>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:border-blue-500/40 transition-all">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>서울 아파트 PIR</span>
            <span className="text-[11px] px-1.5 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-400 font-semibold">
              {summaryData?.pir_ratio?.status || "극단적 고평가"}
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {summaryData?.pir_ratio?.value ? `${summaryData.pir_ratio.value}` : "25.2 배"}
            </span>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              OECD 평균(7~10배) 대비 2.5배
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            {summaryData?.pir_ratio?.desc || "중위소득 가구가 소득 전액을 25년 모아야 서울 아파트 1채 구입"}
          </p>
        </div>
      </div>

      {/* S19-2: 2인 전문가 심층 대담 벤토 (엘리엇 vs 박은정 감정평가사) */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-indigo-500" />
                전문가 2인 심층 진단: "집값 올랐다고 좋아했죠? 파는 건 생지옥입니다"
              </h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              유튜브 '재테크는 두꺼비 세무사' 특별 대담에서 제기된 거시 유동성(엘리엇)과 실거래 평가(박은정 평가사)의 핵심 테제 분석
            </p>
          </div>

          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
            <button
              onClick={() => setSelectedExpert('all')}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                selectedExpert === 'all'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              전체 비교 (2인)
            </button>
            <button
              onClick={() => setSelectedExpert('elliot')}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                selectedExpert === 'elliot'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              엘리엇 (거시/유동성)
            </button>
            <button
              onClick={() => setSelectedExpert('park')}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                selectedExpert === 'park'
                  ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              박은정 평가사 (현장/평가)
            </button>
          </div>
        </div>

        {/* 2인 전문가 대담 그리드 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* 엘리엇 카드 */}
          {(selectedExpert === 'all' || selectedExpert === 'elliot') && (
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-indigo-200/60 dark:border-indigo-900/40 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-bl-full pointer-events-none" />
              <div>
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white flex items-center justify-center font-black text-base shadow-sm">
                      엘
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h3 className="font-bold text-slate-900 dark:text-slate-100">엘리엇</h3>
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-950/80 dark:text-indigo-300 font-medium">
                          거시 사이클 & 유동성
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">머니 사이클·유동성 추적 전문 애널리스트</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block">진단 관점</span>
                    <span className="text-xs font-bold text-red-500">인위적 반등 종말</span>
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3 mb-4 border border-slate-100 dark:border-slate-800">
                  <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5 mb-1">
                    <Flame className="w-3.5 h-3.5 text-indigo-500" /> 핵심 테제: "파는 건 생지옥(환금성 결여)의 서막"
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    "2024년 상반기 반등은 신생아 특례대출·디딤돌 등 40조 이상의 국가 정책모기지가 밀어올린 인위적 유동성 착시였습니다. 스트레스 DSR 2단계 시행과 한도 축소로 유동성 파이프가 잠긴 순간, 매수자는 증발했고 실거래가 없는 호가만 남았습니다."
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="border-l-2 border-indigo-500 pl-3">
                    <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">1. 정책 모기지 주입 중단 & 매수 유동성 고갈</h4>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5 leading-normal">
                      정부의 가계대출 총량 규제로 2금융권까지 대출 창구가 차단됨. 일반 가계 소득으로는 10억~15억대 아파트의 원리금 상환이 불가능하여 유효 매수세가 완전히 끊김.
                    </p>
                  </div>

                  <div className="border-l-2 border-indigo-500 pl-3">
                    <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">2. '갈아타기 사다리'의 단절</h4>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5 leading-normal">
                      노·도·강, 금·관·구 등 외곽/중하위권을 팔고 마·용·성이나 강남으로 올라가는 구조인데, 외곽 아파트 매수자가 없으니 상급지로 진입하는 연쇄 거래가 전면 중단됨.
                    </p>
                  </div>

                  <div className="border-l-2 border-indigo-500 pl-3">
                    <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">3. 환금성 마비 트랩 ("가격 올라도 못 팖")</h4>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5 leading-normal">
                      네이버 호가는 13억이지만 실거래는 11억에도 안 팔리는 현상. 결국 급전이 필요한 집주인은 호가를 수천~1억 낮춰 던질 수밖에 없으며, 이는 본격적인 2차 하락 압력으로 작용.
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                <span className="text-slate-500 dark:text-slate-400">엘리엇의 매도/매수 포지션:</span>
                <span className="font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/60 px-2.5 py-1 rounded-md">
                  추격매수 금지 & 현금 유동성 확보
                </span>
              </div>
            </div>
          )}

          {/* 박은정 감정평가사 카드 */}
          {(selectedExpert === 'all' || selectedExpert === 'park') && (
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-emerald-200/60 dark:border-emerald-900/40 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-bl-full pointer-events-none" />
              <div>
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-white flex items-center justify-center font-black text-base shadow-sm">
                      박
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h3 className="font-bold text-slate-900 dark:text-slate-100">박은정 감정평가사</h3>
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300 font-medium">
                          실거래 현장 & 자산가치 평가
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">공인감정평가사·실거래 통계 분석 전문가</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block">진단 관점</span>
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">통계 착시 & 펀더멘털</span>
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3 mb-4 border border-slate-100 dark:border-slate-800">
                  <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5 mb-1">
                    <Activity className="w-3.5 h-3.5 text-emerald-500" /> 핵심 테제: "신고가 통계 착시와 유효 수요의 실종"
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    "언론에 나오는 '강남 00단지 신고가'는 극소수 자산가들의 한두 건 거래일 뿐입니다. 대한민국 가계의 소득 펀더멘털과 감정평가 관점에서 지금의 가격은 거품이며, 빌라·오피스텔 등 하부 시장 붕괴가 아파트로 확산되고 있습니다."
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="border-l-2 border-emerald-500 pl-3">
                    <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">1. 신고가 몇 건이 만든 '통계의 착시'</h4>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5 leading-normal">
                      전체 거래량의 90% 이상을 차지하는 중저가 대단지들은 거래가 끊겼는데, 토지거래허가구역 외 일부 단지의 손바뀜 1~2건을 가지고 전체 시장이 상승세인 양 포장되는 왜곡 발생.
                    </p>
                  </div>

                  <div className="border-l-2 border-emerald-500 pl-3">
                    <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">2. PIR 26배 — 소득이 감당할 수 없는 가격</h4>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5 leading-normal">
                      적정 주택가격은 가계 연소득의 7~10배 수준이나 서울은 26배를 초과. 4%대 대출금리 환경에서 원리금 갚느라 가처분 소득이 0이 되는 구조는 장기 유지될 수 없음.
                    </p>
                  </div>

                  <div className="border-l-2 border-emerald-500 pl-3">
                    <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">3. 비아파트 붕괴와 경매 시장 낙찰가율 하락</h4>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5 leading-normal">
                      전세사기로 빌라·오피스텔 거래가 절벽에 달하자 청년층의 자산형성 사다리가 끊김. 법원 경매 시장에서도 유찰이 반복되며 실질 감정가 대비 낙찰률이 70%대로 추락 중.
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                <span className="text-slate-500 dark:text-slate-400">박은정 평가사의 행동 지침:</span>
                <span className="font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-2.5 py-1 rounded-md">
                  분위기 휩쓸리지 말고 보수적 가치평가
                </span>
              </div>
            </div>
          )}
        </div>

        {/* 2인 전문가 공통 결론 및 3대 실전 행동 지침 */}
        <div className="rounded-xl bg-gradient-to-r from-slate-100 to-indigo-50/50 dark:from-slate-800/80 dark:to-indigo-950/30 border border-slate-200 dark:border-slate-700/60 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-indigo-500" />
            <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
              전문가 2인의 합치된 결론: "콘크리트 맹신을 버리고, 유동성과 자산 현금흐름으로 방어하라"
            </h4>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-slate-600 dark:text-slate-300">
            <div className="bg-white/80 dark:bg-slate-900/60 p-2.5 rounded-lg border border-slate-200/50 dark:border-slate-800">
              <span className="font-bold text-red-500 block mb-1">Rule 1. 상급지 추격매수 금지</span>
              대출 규제 장기화로 추가 상승 여력 제한적. 지금의 무리한 고점 매수는 장기 유동성 결박(하우스푸어) 초래.
            </div>
            <div className="bg-white/80 dark:bg-slate-900/60 p-2.5 rounded-lg border border-slate-200/50 dark:border-slate-800">
              <span className="font-bold text-amber-500 block mb-1">Rule 2. 다주택/외곽 매물 정리</span>
              환금성이 떨어지는 비인기 지역·나홀로 단지는 호가 고집하지 말고 과감히 정리하여 현금성 자산 확보.
            </div>
            <div className="bg-white/80 dark:bg-slate-900/60 p-2.5 rounded-lg border border-slate-200/50 dark:border-slate-800">
              <span className="font-bold text-blue-500 block mb-1">Rule 3. 금융자산(배당 ETF) 분산</span>
              부동산에 묶인 거액의 자본을 환금성 높은 우량 지수/배당 ETF로 이전해 보유비용을 줄이고 월 현금흐름 창출.
            </div>
          </div>
        </div>

        {/* 2024~2026 실증 추적 & 사후 검증 브릿지 패널 */}
        <div className="rounded-xl bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200/80 dark:border-blue-900/40 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-blue-900 dark:text-blue-300 flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-blue-500" />
              📌 영상 속 2인 전문가 진단, 그 이후 2025~2026년 실증 추적 결과
            </span>
            <span className="text-[11px] font-medium text-blue-600 dark:text-blue-400">
              2026.10 현재 팩트 체크
            </span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            영상 속에서 두 전문가가 경고한 <strong>'정책모기지 약발 소진 후 거래절벽'</strong>과 <strong>'환금성 마비'</strong>는 2025년과 2026년 현재까지 실제 수치로 입증되었습니다. 2024년 7월 월 8,900건에 달했던 서울 아파트 거래량은 2025년 연평균 3,300건대로 주저앉았으며, 2026년 현재까지도 월 3,600~4,500건대 박스권에 갇혀 있습니다. 반면 매물은 8만 건 초중반대에 지속 누적되어 집을 팔고 싶어도 매수자가 나타나지 않는 '환금성 생지옥' 상태가 이어지고 있습니다.
          </p>
        </div>
      </div>

      {/* S19-3: 부동산 거시 레이더 차트 (2024.01 ~ 2026.10 최신 시계열) */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-500" />
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">
                서울 아파트 매물 적체량(선) vs 월간 실거래량(막대) 추이
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              2024년 1월 ~ 2026년 10월 현재 (단위: 매물 천 건, 거래량 천 건 | 출처: 서울부동산정보광장·아실)
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* 기간 선택 스위처 (1Y / 2Y / ALL) */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200/60 dark:border-slate-700/60">
              <button
                type="button"
                onClick={() => setChartPeriod('1Y')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                  chartPeriod === '1Y'
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                1Y (최근1년)
              </button>
              <button
                type="button"
                onClick={() => setChartPeriod('2Y')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                  chartPeriod === '2Y'
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                2Y (최근2년)
              </button>
              <button
                type="button"
                onClick={() => setChartPeriod('ALL')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                  chartPeriod === 'ALL'
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                ALL (24~26년 전체)
              </button>
            </div>

            <div className="hidden sm:flex items-center gap-3 text-xs">
              <span className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                <span className="w-3 h-3 rounded bg-blue-500" /> 실거래량
              </span>
              <span className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                <span className="w-3 h-0.5 bg-red-500" /> 매물 적체
              </span>
            </div>
          </div>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              key={`re-chart-${chartPeriod}`}
              data={filteredTrendData}
              margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11 }}
                interval={chartPeriod === 'ALL' ? 2 : 0}
              />
              <YAxis yAxisId="left" orientation="left" domain={[0, 10]} tick={{ fontSize: 11 }} />
              <YAxis yAxisId="right" orientation="right" domain={[70, 95]} tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(15, 23, 42, 0.95)',
                  borderColor: '#334155',
                  borderRadius: '0.75rem',
                  fontSize: '12px',
                  color: '#fff'
                }}
                formatter={(val: any, name: any) => {
                  if (name === '실거래량') return [`${val}천 건`, name];
                  if (name === '매물적체량') return [`${val}천 건`, name];
                  return [val, name];
                }}
              />
              <Bar yAxisId="left" dataKey="volume" name="실거래량" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={chartPeriod === 'ALL' ? 12 : 18} />
              <Line yAxisId="right" type="monotone" dataKey="listings" name="매물적체량" stroke="#ef4444" strokeWidth={2.5} dot={{ r: 2.5 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-xs text-slate-600 dark:text-slate-400 flex items-start gap-2">
          <Info className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
          <span>
            <strong>최신 데이터 인사이트:</strong> 2024년 7월 정책모기지 막차 수요(8,900건) 이후 9월 스트레스 DSR 2단계 여파로 2,000건대 급락을 겪었습니다. 이후 2025년 내내 저점 횡보(2~3천건대)를 거쳐 2026년 현재까지도 매물이 8.3만 건 수준에 지속 적체된 채 월 거래량 3~4천 건대에 갇혀 있는 전형적인 '거래절벽 & 환금성 저하' 국면이 이어지고 있습니다.
          </span>
        </div>
      </div>

      {/* S19-3: 실물 부동산 vs 금융자산(배당 ETF) 기회비용 시뮬레이터 */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Scale className="w-5 h-5 text-indigo-500" />
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-lg">
                실물 아파트 vs 배당 ETF 기회비용 & 현금흐름 시뮬레이터
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              아파트 매수 시 발생하는 보유세·이자·유지비용 vs 동일 자본을 고배당/지수 ETF에 투자했을 때의 현금흐름 차이를 실시간 비교합니다.
            </p>
          </div>
          <span className="text-[11px] font-semibold px-2.5 py-1 rounded-md bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
            실시간 인터랙티브 모델
          </span>
        </div>

        {/* 파라미터 조절 슬라이더 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60">
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="font-semibold text-slate-700 dark:text-slate-300">부동산 매매가</span>
              <span className="font-bold text-indigo-600 dark:text-indigo-400">{propertyPrice} 억원</span>
            </div>
            <input
              type="range"
              min={5}
              max={30}
              step={1}
              value={propertyPrice}
              onChange={(e) => setPropertyPrice(Number(e.target.value))}
              className="w-full accent-indigo-600 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400">
              <span>5억</span>
              <span>15억</span>
              <span>30억</span>
            </div>
          </div>

          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="font-semibold text-slate-700 dark:text-slate-300">대출 비율 (LTV)</span>
              <span className="font-bold text-indigo-600 dark:text-indigo-400">{loanRatio}% ({(propertyPrice * (loanRatio / 100)).toFixed(1)}억)</span>
            </div>
            <input
              type="range"
              min={0}
              max={70}
              step={5}
              value={loanRatio}
              onChange={(e) => setLoanRatio(Number(e.target.value))}
              className="w-full accent-indigo-600 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400">
              <span>0% (전액자기자본)</span>
              <span>40%</span>
              <span>70%</span>
            </div>
          </div>

          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="font-semibold text-slate-700 dark:text-slate-300">주담대 금리</span>
              <span className="font-bold text-indigo-600 dark:text-indigo-400">{mortgageRate}%</span>
            </div>
            <input
              type="range"
              min={3.0}
              max={6.5}
              step={0.1}
              value={mortgageRate}
              onChange={(e) => setMortgageRate(Number(e.target.value))}
              className="w-full accent-indigo-600 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400">
              <span>3.0%</span>
              <span>4.5%</span>
              <span>6.5%</span>
            </div>
          </div>

          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="font-semibold text-slate-700 dark:text-slate-300">ETF 연간 배당률</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">{etfDividendYield}%</span>
            </div>
            <input
              type="range"
              min={2.0}
              max={10.0}
              step={0.5}
              value={etfDividendYield}
              onChange={(e) => setEtfDividendYield(Number(e.target.value))}
              className="w-full accent-emerald-600 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400">
              <span>2.5% (S&P500)</span>
              <span>4.5% (SCHD)</span>
              <span>8.0%+ (JEPQ)</span>
            </div>
          </div>
        </div>

        {/* 비교 결과 2열 벤토 카드 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* 부동산 보유 시 소요 비용 */}
          <div className="p-5 rounded-xl border border-red-200 dark:border-red-900/40 bg-gradient-to-br from-red-50/40 to-white dark:from-red-950/20 dark:to-slate-900 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm">실물 아파트 {propertyPrice}억 보유 시</h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">자기자본 {(simResults.equityWon / 100000000).toFixed(1)}억 + 대출 {(simResults.loanWon / 100000000).toFixed(1)}억</p>
                </div>
              </div>
              <span className="text-xs font-bold text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-950/80 px-2 py-0.5 rounded">
                현금 유출(비용)
              </span>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between py-1.5 border-b border-slate-200/60 dark:border-slate-800">
                <span className="text-slate-600 dark:text-slate-400">초기 취득세 (3.3%)</span>
                <span className="font-semibold text-slate-900 dark:text-slate-200">
                  {(simResults.acquisitionTax / 10000).toLocaleString()} 만원 (일회성)
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-200/60 dark:border-slate-800">
                <span className="text-slate-600 dark:text-slate-400">연간 대출이자 ({mortgageRate}%)</span>
                <span className="font-semibold text-red-600 dark:text-red-400">
                  -{(simResults.annualInterest / 10000).toLocaleString()} 만원 / 년
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-200/60 dark:border-slate-800">
                <span className="text-slate-600 dark:text-slate-400">보유세 (재산세 + 종부세 추정)</span>
                <span className="font-semibold text-red-600 dark:text-red-400">
                  -{(simResults.propertyTax / 10000).toLocaleString()} 만원 / 년
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-200/60 dark:border-slate-800">
                <span className="text-slate-600 dark:text-slate-400">관리비/장특충/건보료 인상분</span>
                <span className="font-semibold text-red-600 dark:text-red-400">
                  -{(simResults.maintenanceAndInsurance / 10000).toLocaleString()} 만원 / 년
                </span>
              </div>
              <div className="flex justify-between pt-2 text-sm font-bold">
                <span className="text-slate-900 dark:text-slate-100">연간 총 순유출 비용</span>
                <span className="text-red-600 dark:text-red-400 text-base">
                  -{(simResults.totalPropertyAnnualCost / 10000).toLocaleString()} 만원 / 년
                </span>
              </div>
              <p className="text-[10px] text-right text-slate-400">
                (월 평균 {(simResults.totalPropertyAnnualCost / 120000).toFixed(0)}만원 고정 지출 발생)
              </p>
            </div>
          </div>

          {/* 배당 ETF 투자 시 현금흐름 */}
          <div className="p-5 rounded-xl border border-emerald-200 dark:border-emerald-900/40 bg-gradient-to-br from-emerald-50/40 to-white dark:from-emerald-950/20 dark:to-slate-900 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400">
                  <PieChart className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm">동일 자기자본 배당 ETF 포트폴리오</h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">순수 투자원금 {(simResults.equityWon / 100000000).toFixed(1)}억원 운용</p>
                </div>
              </div>
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/80 px-2 py-0.5 rounded">
                현금 유입(배당)
              </span>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between py-1.5 border-b border-slate-200/60 dark:border-slate-800">
                <span className="text-slate-600 dark:text-slate-400">초기 거래세/수수료</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  약 0.015% (약 {((simResults.equityWon * 0.00015) / 10000).toFixed(0)}만원 수준, 취득세 대비 99% 절감)
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-200/60 dark:border-slate-800">
                <span className="text-slate-600 dark:text-slate-400">연간 배당금 수입 ({etfDividendYield}%)</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  +{(simResults.annualDividend / 10000).toLocaleString()} 만원 / 년
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-200/60 dark:border-slate-800">
                <span className="text-slate-600 dark:text-slate-400">월 환산 현금흐름</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  월 +{(simResults.monthlyDividend / 10000).toLocaleString()} 만원
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-200/60 dark:border-slate-800">
                <span className="text-slate-600 dark:text-slate-400">환금성 & 보유세</span>
                <span className="font-semibold text-slate-900 dark:text-slate-200">
                  T+2일 즉시 현금화 / 종부세·건보료 폭탄 없음
                </span>
              </div>
              <div className="flex justify-between pt-2 text-sm font-bold">
                <span className="text-slate-900 dark:text-slate-100">연간 총 순유입 현금흐름</span>
                <span className="text-emerald-600 dark:text-emerald-400 text-base">
                  +{(simResults.annualDividend / 10000).toLocaleString()} 만원 / 년
                </span>
              </div>
              <p className="text-[10px] text-right text-slate-400">
                (ISA / 연금계좌 활용 시 배당소득세 비과세 및 저율 과세 혜택 가능)
              </p>
            </div>
          </div>
        </div>

        {/* 연간 기회비용 종합 요약 배너 */}
        <div className="p-4 rounded-xl bg-gradient-to-r from-blue-900/90 to-indigo-900/90 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-white/10 text-white shrink-0">
              <Sparkles className="w-5 h-5 text-yellow-300" />
            </div>
            <div>
              <h5 className="font-bold text-sm">연간 실질 현금흐름 격차 (기회비용 프리미엄)</h5>
              <p className="text-xs text-blue-100 mt-0.5">
                부동산 보유 비용(유출) 절감 + 배당 ETF 현금 유입 = 연간 약{' '}
                <span className="font-extrabold text-yellow-300 text-sm">
                  {(simResults.annualCashFlowDiff / 10000).toLocaleString()} 만원
                </span>
                의 현금흐름 개선 효과
              </p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <span className="text-[10px] text-blue-200 block">월 체감 격차</span>
            <span className="text-base font-black text-yellow-300">
              월 약 {(simResults.annualCashFlowDiff / 120000).toFixed(0)} 만원
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
