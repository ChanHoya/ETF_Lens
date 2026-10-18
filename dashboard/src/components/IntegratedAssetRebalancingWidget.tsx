'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Building2, Wallet, Landmark, TrendingUp, AlertCircle, 
  CheckCircle2, ArrowRight, ShieldCheck, Scale, RefreshCw,
  Sparkles, Layers, DollarSign, Printer, Download, FileSpreadsheet
} from 'lucide-react';
import { getApiBase } from '@/lib/apiConfig';
import { NumberPopIn } from './common/NumberPopIn';
import IntegratedAssetReportModal from './IntegratedAssetReportModal';
import PortfolioVitaminOptimizer from './portfolio/PortfolioVitaminOptimizer';

interface IntegratedAssetProps {
  financialNetWorth: number;     // 주식/ETF + 현금 예수금 (원)
  financialInvestAmount: number; // 주식/ETF 평가금액 (원)
  financialCashAmount: number;   // 현금 예수금 (원)
  onNavigateToRealEstate?: () => void;
  onNavigateToTff?: () => void;
}

interface ApartmentStorageItem {
  id: string;
  complex_name: string;
  area_sqm: number;
  area_pyeong: number;
  purchase_price_won: number; // 억 원
  loan_balance_won: number;   // 억 원
  jeonse_deposit_won: number; // 억 원
  evaluation?: {
    estimated_market_price_won?: number;
    total_debt_won?: number;
    loan_balance_won?: number;
    jeonse_deposit_won?: number;
    unrealized_gain_won?: number;
    return_pct?: number;
    health_grade?: string;
    health_label?: string;
  };
}

export default function IntegratedAssetRebalancingWidget({
  financialNetWorth,
  financialInvestAmount,
  financialCashAmount,
  onNavigateToRealEstate,
  onNavigateToTff
}: IntegratedAssetProps) {
  const [apartments, setApartments] = useState<ApartmentStorageItem[]>([]);
  const [tffFundAmount, setTffFundAmount] = useState<number>(0);
  const [includeRealEstate, setIncludeRealEstate] = useState<boolean>(true);
  const [includeTff, setIncludeTff] = useState<boolean>(true);
  const [isLoadingTff, setIsLoadingTff] = useState<boolean>(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState<boolean>(false);

  // CSV/엑셀 다운로드 핸들러 (UTF-8 with BOM)
  const handleDownloadExcelCsv = () => {
    try {
      const rows: string[][] = [
        ["i-Prism 가계 종합 자산 및 포트폴리오 리밸런싱 명세서"],
        [`작성일자`, new Date().toISOString().split('T')[0]],
        [],
        ["[1. 자산군별 총괄 요약]"],
        ["자산군", "평가총액(원)", "부채금액(원)", "순자산(원)", "비중(%)"],
        [
          "실물 부동산",
          String(Math.round(realEstateStats.grossAssetWon)),
          String(Math.round(realEstateStats.debtWon)),
          String(Math.round(realEstateStats.netWorthWon)),
          realEstateRatio.toFixed(1)
        ],
        [
          "금융 투자 (주식/ETF)",
          String(Math.round(financialInvestAmount)),
          "0",
          String(Math.round(financialInvestAmount)),
          equityRatio.toFixed(1)
        ],
        [
          "보유 예수금 (현금)",
          String(Math.round(financialCashAmount)),
          "0",
          String(Math.round(financialCashAmount)),
          cashRatio.toFixed(1)
        ],
        [
          "TFF 대체 펀드",
          String(Math.round(tffFundAmount)),
          "0",
          String(Math.round(tffFundAmount)),
          tffRatio.toFixed(1)
        ],
        [
          "가계 총 순자산 (Grand Net Worth)",
          String(Math.round(grandTotalNetWorth + realEstateStats.debtWon)),
          String(Math.round(realEstateStats.debtWon)),
          String(Math.round(grandTotalNetWorth)),
          "100.0"
        ],
        [],
        ["[2. 등록된 실물 부동산 상세]"],
        ["단지명", "전용면적(㎡)", "평형", "취득가액(억)", "현재 추정시세(억)", "담보대출(억)", "전세보증금(억)", "순자산(억)", "건전성등급"],
      ];

      apartments.forEach(apt => {
        const evalMarket = apt.evaluation?.estimated_market_price_won ?? apt.purchase_price_won;
        const loan = apt.evaluation?.loan_balance_won ?? apt.loan_balance_won ?? 0;
        const jeonse = apt.evaluation?.jeonse_deposit_won ?? apt.jeonse_deposit_won ?? 0;
        const netEok = Math.max(0, evalMarket - loan - jeonse);
        const grade = apt.evaluation?.health_label ?? "안전";
        rows.push([
          apt.complex_name,
          String(apt.area_sqm),
          String(apt.area_pyeong),
          String(apt.purchase_price_won),
          String(evalMarket),
          String(loan),
          String(jeonse),
          String(netEok.toFixed(2)),
          grade
        ]);
      });

      const csvContent = "\uFEFF" + rows.map(e => e.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `i-Prism_가계자산명세_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      console.error("CSV download error", e);
      alert("CSV 다운로드 중 오류가 발생했습니다.");
    }
  };

  // 1. 아파트 데이터 로드 (localStorage)
  const loadApartments = () => {
    try {
      const saved = localStorage.getItem('etf_one_my_apartments');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setApartments(parsed);
          return;
        }
      }
      // 저장된 내역이 없으면 기본 잠실엘스 샘플 1건 반영
      setApartments([
        {
          id: 'apt-default-1',
          complex_name: '잠실엘스',
          area_sqm: 84.8,
          area_pyeong: 34,
          purchase_price_won: 23.5,
          loan_balance_won: 6.5,
          jeonse_deposit_won: 0.0,
          evaluation: {
            estimated_market_price_won: 24.2,
            loan_balance_won: 6.5,
            jeonse_deposit_won: 0.0,
            total_debt_won: 6.5,
            unrealized_gain_won: 0.7,
            return_pct: 3.0,
            health_grade: 'SAFE',
            health_label: '안전 (우량 자산)'
          }
        }
      ]);
    } catch (e) {
      console.warn('Failed to parse my apartments from localStorage', e);
    }
  };

  // 2. TFF 펀드 데이터 로드 (API 최신값 또는 로컬 캐시)
  const loadTffData = async () => {
    try {
      setIsLoadingTff(true);
      const apiBase = getApiBase();
      const res = await fetch(`${apiBase}/api/v1/analyze/tff/latest`);
      if (res.ok) {
        const data = await res.json();
        if (data.status !== 'empty' && data.fund_data?.cumulative?.totalData?.endValue) {
          setTffFundAmount(Math.round(data.fund_data.cumulative.totalData.endValue));
          return;
        }
      }
      // API 응답이 없으면 로컬 스토리지 확인
      const localRecords = localStorage.getItem('tff_saved_records');
      if (localRecords) {
        const parsed = JSON.parse(localRecords);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const latest = parsed[parsed.length - 1];
          if (latest.fundData?.cumulative?.totalData?.endValue) {
            setTffFundAmount(Math.round(latest.fundData.cumulative.totalData.endValue));
            return;
          }
        }
      }
    } catch (err) {
      console.warn('TFF latest fetch error', err);
    } finally {
      setIsLoadingTff(false);
    }
  };

  useEffect(() => {
    loadApartments();
    loadTffData();

    // 로컬 스토리지 변경 감지
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'etf_one_my_apartments') {
        loadApartments();
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  // 부동산 자산 계산 (억 원 -> 원 단위 환산: 1억 = 100,000,000)
  const realEstateStats = useMemo(() => {
    let grossAssetWon = 0; // 총 부동산 가액
    let debtWon = 0;       // 총 부채(담보대출 + 전세보증금)

    apartments.forEach(apt => {
      const evalMarket = apt.evaluation?.estimated_market_price_won ?? apt.purchase_price_won;
      const loan = apt.evaluation?.loan_balance_won ?? apt.loan_balance_won ?? 0;
      const jeonse = apt.evaluation?.jeonse_deposit_won ?? apt.jeonse_deposit_won ?? 0;
      
      grossAssetWon += (evalMarket * 100_000_000);
      debtWon += ((loan + jeonse) * 100_000_000);
    });

    const netWorthWon = Math.max(0, grossAssetWon - debtWon);
    return {
      grossAssetWon,
      debtWon,
      netWorthWon,
      count: apartments.length
    };
  }, [apartments]);

  // 통합 전체 자산 계산
  const effectiveRealEstateNetWorth = includeRealEstate ? realEstateStats.netWorthWon : 0;
  const effectiveTffNetWorth = includeTff ? tffFundAmount : 0;
  const grandTotalNetWorth = financialNetWorth + effectiveRealEstateNetWorth + effectiveTffNetWorth;

  // 자산 비중 계산
  const realEstateRatio = grandTotalNetWorth > 0 ? (effectiveRealEstateNetWorth / grandTotalNetWorth) * 100 : 0;
  const financialRatio = grandTotalNetWorth > 0 ? (financialNetWorth / grandTotalNetWorth) * 100 : 0;
  const tffRatio = grandTotalNetWorth > 0 ? (effectiveTffNetWorth / grandTotalNetWorth) * 100 : 0;

  // 세부 금융 자산 비중
  const equityRatio = grandTotalNetWorth > 0 ? (financialInvestAmount / grandTotalNetWorth) * 100 : 0;
  const cashRatio = grandTotalNetWorth > 0 ? (financialCashAmount / grandTotalNetWorth) * 100 : 0;

  // 자산 배분 진단
  const diagnosis = useMemo(() => {
    if (!includeRealEstate || realEstateStats.netWorthWon === 0) {
      return {
        badge: '금융 자산 전념형',
        color: 'indigo',
        desc: '실물 부동산을 제외한 순수 유동성 금융 자산 중심 포트폴리오입니다.',
        advice: '주식/채권/현금 비중 관리에 집중하세요.'
      };
    }
    if (realEstateRatio >= 75) {
      return {
        badge: '부동산 편중형 (주의)',
        color: 'amber',
        desc: `전체 순자산의 ${realEstateRatio.toFixed(1)}%가 실물 부동산에 묶여 있습니다 (한국 가계 평균 72% 상회).`,
        advice: '부동산 하락기 유동성 방어를 위해 금융 배당 ETF 및 비상금 예치 확대를 권장합니다.'
      };
    } else if (realEstateRatio >= 50 && realEstateRatio < 75) {
      return {
        badge: '황금 밸런스형 (모범)',
        color: 'emerald',
        desc: `부동산(${realEstateRatio.toFixed(1)}%)과 금융자산(${financialRatio.toFixed(1)}%)이 균형을 이루고 있습니다.`,
        advice: '상위 10% 자산가의 포트폴리오 구조입니다. 매월 발생하는 현금흐름으로 금융자산을 점진 확대하세요.'
      };
    } else {
      return {
        badge: '금융 고성장형 (우수)',
        color: 'cyan',
        desc: `금융 자산 비중(${financialRatio.toFixed(1)}%)이 부동산보다 높아 기동성과 현금 창출력이 뛰어납니다.`,
        advice: '변동성 관리와 배당 재투자를 통해 자산 복리 극대화를 노리세요.'
      };
    }
  }, [includeRealEstate, realEstateStats.netWorthWon, realEstateRatio, financialRatio]);

  const fmtKRW = (n: number) => Math.round(n).toLocaleString('ko-KR');
  const fmtEok = (won: number) => {
    const eok = won / 100_000_000;
    return `${eok.toFixed(2)}억`;
  };

  return (
    <div className="w-full rounded-2xl bg-gradient-to-br from-[#131722] via-[#161a25] to-[#11131a] border border-indigo-500/20 p-5 shadow-2xl relative overflow-hidden">
      {/* 백그라운드 액센트 */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* 헤더 & 토글 영역 */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-4 border-b border-white/5 relative z-10">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
            <Scale className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-white tracking-tight">
                통합 순자산 (Net Worth) & 자산배분 사분면
              </h3>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                diagnosis.color === 'emerald' ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' :
                diagnosis.color === 'amber' ? 'bg-amber-500/15 text-amber-300 border-amber-500/30' :
                diagnosis.color === 'cyan' ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30' :
                'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'
              }`}>
                {diagnosis.badge}
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              내 아파트 실물 순자산 + KIS 주식/예수금 + TFF 대체 펀드를 결합한 원클릭 가계 총자산 관리
            </p>
          </div>
        </div>

        {/* 기능 버튼 및 토글 스위치들 */}
        <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
          <button
            onClick={() => setIsReportModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/80 hover:bg-indigo-600 text-white text-xs font-semibold shadow transition-all active:scale-95 cursor-pointer"
            title="A4 규격 가계 종합 자산 진단 보고서 출력/PDF 저장"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>📄 진단 리포트 출력</span>
          </button>

          <button
            onClick={handleDownloadExcelCsv}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/80 hover:bg-emerald-600 text-white text-xs font-semibold shadow transition-all active:scale-95 cursor-pointer"
            title="전체 자산 및 부동산 명세 CSV/엑셀 다운로드"
          >
            <Download className="w-3.5 h-3.5" />
            <span>📥 엑셀(CSV)</span>
          </button>

          <label className="flex items-center gap-1.5 text-xs text-gray-300 bg-white/[0.04] px-2.5 py-1.5 rounded-lg border border-white/10 cursor-pointer hover:bg-white/[0.08] transition-colors">
            <input 
              type="checkbox" 
              checked={includeRealEstate} 
              onChange={(e) => setIncludeRealEstate(e.target.checked)}
              className="accent-indigo-500 rounded cursor-pointer"
            />
            <Building2 className="w-3.5 h-3.5 text-amber-400" />
            <span>실물 부동산 포함</span>
          </label>

          {tffFundAmount > 0 && (
            <label className="flex items-center gap-1.5 text-xs text-gray-300 bg-white/[0.04] px-2.5 py-1.5 rounded-lg border border-white/10 cursor-pointer hover:bg-white/[0.08] transition-colors">
              <input 
                type="checkbox" 
                checked={includeTff} 
                onChange={(e) => setIncludeTff(e.target.checked)}
                className="accent-emerald-500 rounded cursor-pointer"
              />
              <Landmark className="w-3.5 h-3.5 text-emerald-400" />
              <span>TFF 펀드 포함</span>
            </label>
          )}
        </div>
      </div>

      {/* 대형 Grand Net Worth & 3대 자산 축 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mt-4">
        {/* 좌측: 총 통합 순자산 카드 (4칸) */}
        <div className="lg:col-span-5 p-4 rounded-xl bg-gradient-to-br from-indigo-950/40 via-[#181d29] to-[#131620] border border-indigo-500/30 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center text-xs text-indigo-300 font-semibold mb-1">
              <span>GRAND TOTAL NET WORTH</span>
              <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
            </div>
            <div className="flex items-baseline gap-1 mt-1">
              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                <NumberPopIn value={fmtKRW(grandTotalNetWorth)} />
              </h2>
              <span className="text-sm font-bold text-gray-400">원</span>
            </div>
            <p className="text-xs text-indigo-300/80 font-medium mt-1">
              약 {fmtEok(grandTotalNetWorth)}원 (부채 차감 후 실질 순자산)
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-white/10 space-y-1.5 text-xs">
            <div className="flex justify-between text-gray-300">
              <span className="flex items-center gap-1 text-gray-400">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                실물 부동산 순자산:
              </span>
              <span className="font-semibold text-amber-300">
                {includeRealEstate ? `${fmtEok(realEstateStats.netWorthWon)}원 (${realEstateRatio.toFixed(1)}%)` : '미포함'}
              </span>
            </div>
            <div className="flex justify-between text-gray-300">
              <span className="flex items-center gap-1 text-gray-400">
                <span className="w-2 h-2 rounded-full bg-indigo-400" />
                금융 포트폴리오 (주식+현금):
              </span>
              <span className="font-semibold text-indigo-300">
                {fmtEok(financialNetWorth)}원 ({financialRatio.toFixed(1)}%)
              </span>
            </div>
            {includeTff && tffFundAmount > 0 && (
              <div className="flex justify-between text-gray-300">
                <span className="flex items-center gap-1 text-gray-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  TFF 대체 펀드:
                </span>
                <span className="font-semibold text-emerald-300">
                  {fmtEok(tffFundAmount)}원 ({tffRatio.toFixed(1)}%)
                </span>
              </div>
            )}
          </div>
        </div>

        {/* 우측: 3대 자산 비중 프로그레스 & 진단 권고 (7칸) */}
        <div className="lg:col-span-7 flex flex-col justify-between p-4 rounded-xl bg-[#161a25]/80 border border-white/5">
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-bold text-gray-300">자산 배분 프로그레스 바</span>
              <span className="text-[11px] text-gray-400">
                권장 비율: 부동산 50~70% : 금융 30~50%
              </span>
            </div>

            {/* 멀티 프로그레스 바 */}
            <div className="w-full h-4 bg-gray-800 rounded-full overflow-hidden flex shadow-inner">
              {includeRealEstate && realEstateRatio > 0 && (
                <div 
                  style={{ width: `${realEstateRatio}%` }}
                  className="h-full bg-gradient-to-r from-amber-500 to-amber-400 transition-all duration-500 relative group"
                  title={`실물 부동산: ${realEstateRatio.toFixed(1)}%`}
                />
              )}
              <div 
                style={{ width: `${equityRatio}%` }}
                className="h-full bg-gradient-to-r from-indigo-500 to-blue-400 transition-all duration-500 relative group"
                title={`주식/ETF: ${equityRatio.toFixed(1)}%`}
              />
              <div 
                style={{ width: `${cashRatio}%` }}
                className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500 relative group"
                title={`예수금/현금: ${cashRatio.toFixed(1)}%`}
              />
              {includeTff && tffRatio > 0 && (
                <div 
                  style={{ width: `${tffRatio}%` }}
                  className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-500 relative group"
                  title={`TFF 펀드: ${tffRatio.toFixed(1)}%`}
                />
              )}
            </div>

            {/* 범례 (Legend) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 text-xs">
              {includeRealEstate && (
                <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <div className="text-[10px] text-amber-300 font-semibold">실물 부동산</div>
                  <div className="text-sm font-bold text-white mt-0.5">{realEstateRatio.toFixed(1)}%</div>
                  <div className="text-[10px] text-gray-400 truncate">{apartments.length}채 등록</div>
                </div>
              )}
              <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
                <div className="text-[10px] text-indigo-300 font-semibold">주식/ETF</div>
                <div className="text-sm font-bold text-white mt-0.5">{equityRatio.toFixed(1)}%</div>
                <div className="text-[10px] text-gray-400 truncate">{fmtEok(financialInvestAmount)}원</div>
              </div>
              <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <div className="text-[10px] text-emerald-300 font-semibold">현금/예수금</div>
                <div className="text-sm font-bold text-white mt-0.5">{cashRatio.toFixed(1)}%</div>
                <div className="text-[10px] text-gray-400 truncate">{fmtEok(financialCashAmount)}원</div>
              </div>
              {includeTff && tffFundAmount > 0 && (
                <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/20">
                  <div className="text-[10px] text-purple-300 font-semibold">TFF 대체펀드</div>
                  <div className="text-sm font-bold text-white mt-0.5">{tffRatio.toFixed(1)}%</div>
                  <div className="text-[10px] text-gray-400 truncate">{fmtEok(tffFundAmount)}원</div>
                </div>
              )}
            </div>
          </div>

          {/* AI 리밸런싱 조언 박스 */}
          <div className="mt-3 p-3 rounded-lg bg-white/[0.02] border border-white/5 flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div className="text-xs">
              <span className="font-semibold text-gray-200">{diagnosis.desc} </span>
              <span className="text-indigo-300 font-medium">{diagnosis.advice}</span>
            </div>
          </div>

          {/* S30-1: 포트폴리오 비타민 AI 종목 추천 & 효율적 투자선 최적화 */}
          <div className="mt-4">
            <PortfolioVitaminOptimizer />
          </div>
        </div>
      </div>

      {/* 종합 가계 자산 진단 보고서 A4 모달 */}
      <IntegratedAssetReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        grandTotalNetWorth={grandTotalNetWorth}
        realEstateNetWorth={realEstateStats.netWorthWon}
        realEstateGross={realEstateStats.grossAssetWon}
        realEstateDebt={realEstateStats.debtWon}
        financialNetWorth={financialNetWorth}
        financialInvestAmount={financialInvestAmount}
        financialCashAmount={financialCashAmount}
        tffAmount={tffFundAmount}
        apartmentsCount={apartments.length}
        diagnosis={diagnosis}
      />
    </div>
  );
}
