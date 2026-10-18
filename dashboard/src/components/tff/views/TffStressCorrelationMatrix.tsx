'use client';

import React, { useState, useMemo } from 'react';
import { 
  Activity, ShieldAlert, TrendingDown, TrendingUp, AlertTriangle, 
  Sparkles, Layers, Sliders, ShieldCheck, ArrowRight, Gauge, 
  Globe2, Zap, RefreshCw, BarChart2, AlertCircle
} from 'lucide-react';
import { 
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, 
  Tooltip, CartesianGrid, Cell, ReferenceLine 
} from 'recharts';
import { STANDARD_TOOLTIP_STYLE } from '@/lib/chartTheme';
import { TffFundData, TffHoldingsRow, TffMonthInfo } from '@/lib/tff/types';

interface Props {
  data?: TffFundData | null;
}

// 자산 분류 헬퍼
function categorizeAsset(name: string): string {
  const isEM = name.includes("차이나") || name.includes("항셍") || name.includes("인도") || name.includes("베트남") || name.includes("EM");
  const isUS = name.includes("미국") || name.includes("S&P") || name.includes("나스닥") || name.includes("다우") || name.includes("필라델피아") || name.includes("테크") || name.includes("글로벌");
  const isBond = name.includes("채권") || name.includes("국고채") || name.includes("국채") || name.includes("회사채") || name.includes("금융채");
  const isCash = name.includes("머니마켓") || name.includes("CD") || name.includes("KOFR") || name.includes("현금") || name.includes("단기자금") || name.includes("파킹");
  const isCommodity = name.includes("금현물") || name.includes("은현물") || name.includes("원자재") || name.includes("골드") || name.includes("구리") || name.includes("원유");

  if (isCommodity) return "대체자산";
  if (isBond) return (name.includes("미국") || name.includes("US")) ? "미국채권" : "국내채권";
  if (isCash) return "현금/파킹형";
  if (isEM) return "신흥국형";
  if (isUS) return "미국주식형";
  return "국내주식형";
}

// 자산군 간 역사적 상관계수 참조 맵
const HISTORICAL_CORR_MAP: Record<string, Record<string, number>> = {
  "국내주식형": { "국내주식형": 1.0, "미국주식형": 0.58, "신흥국형": 0.72, "국내채권": -0.12, "미국채권": -0.05, "대체자산": -0.18, "현금/파킹형": -0.22 },
  "미국주식형": { "국내주식형": 0.58, "미국주식형": 1.0, "신흥국형": 0.52, "국내채권": -0.08, "미국채권": -0.15, "대체자산": -0.05, "현금/파킹형": -0.15 },
  "신흥국형": { "국내주식형": 0.72, "미국주식형": 0.52, "신흥국형": 1.0, "국내채권": -0.05, "미국채권": -0.02, "대체자산": -0.10, "현금/파킹형": -0.18 },
  "국내채권": { "국내주식형": -0.12, "미국주식형": -0.08, "신흥국형": -0.05, "국내채권": 1.0, "미국채권": 0.45, "대체자산": 0.22, "현금/파킹형": 0.35 },
  "미국채권": { "국내주식형": -0.05, "미국주식형": -0.15, "신흥국형": -0.02, "국내채권": 0.45, "미국채권": 1.0, "대체자산": 0.18, "현금/파킹형": 0.28 },
  "대체자산": { "국내주식형": -0.18, "미국주식형": -0.05, "신흥국형": -0.10, "국내채권": 0.22, "미국채권": 0.18, "대체자산": 1.0, "현금/파킹형": 0.05 },
  "현금/파킹형": { "국내주식형": -0.22, "미국주식형": -0.15, "신흥국형": -0.18, "국내채권": 0.35, "미국채권": 0.28, "대체자산": 0.05, "현금/파킹형": 1.0 },
};

// 4대 거시 충격 시나리오 정의 (자산군별 반응 충격도)
interface ScenarioConfig {
  id: string;
  title: string;
  subtitle: string;
  icon: any;
  color: string;
  macroChange: string;
  shocks: Record<string, number>; // 자산군별 변동률 (%)
  reason: string;
}

const SCENARIOS: ScenarioConfig[] = [
  {
    id: 'fx_surge',
    title: '원·달러 환율 급등 (+50원, 1,480원)',
    subtitle: '달러 강세 및 환노출 자산 환차익 발생',
    icon: Globe2,
    color: 'from-amber-600/30 to-amber-900/30 border-amber-500/40 text-amber-300',
    macroChange: 'USD/KRW +3.5% 상승',
    shocks: {
      "국내주식형": -1.5,
      "미국주식형": +3.2,
      "신흥국형": -0.8,
      "국내채권": -0.5,
      "미국채권": +2.8,
      "대체자산": +2.5,
      "현금/파킹형": +0.3,
    },
    reason: '환노출 미국 주식 및 달러 표시 자산의 환차익이 원화 자산의 수급 조정을 상쇄합니다.',
  },
  {
    id: 'rate_shock',
    title: '글로벌 기준금리 깜짝 인상 (+50bp Shock)',
    subtitle: '인플레이션 재점화로 긴축 재연',
    icon: Zap,
    color: 'from-red-600/30 to-red-900/30 border-red-500/40 text-red-300',
    macroChange: '기준금리 +50bp 깜짝 인상',
    shocks: {
      "국내주식형": -5.2,
      "미국주식형": -4.8,
      "신흥국형": -6.5,
      "국내채권": -1.2,
      "미국채권": -2.5,
      "대체자산": -3.0,
      "현금/파킹형": +1.5,
    },
    reason: '밸류에이션 부담이 큰 성장주가 단기 조정을 받으나, 현금/파킹 및 만기매칭 채권이 버팀목이 됩니다.',
  },
  {
    id: 'stock_crash',
    title: '글로벌 증시 블랙스완 급락 (-10% MDD)',
    subtitle: '지정학적 리스크 또는 경기 침체 공포',
    icon: TrendingDown,
    color: 'from-purple-600/30 to-purple-900/30 border-purple-500/40 text-purple-300',
    macroChange: 'KOSPI / S&P500 -10% 급락',
    shocks: {
      "국내주식형": -11.5,
      "미국주식형": -9.2,
      "신흥국형": -12.0,
      "국내채권": +1.5,
      "미국채권": +2.8,
      "대체자산": +4.0,
      "현금/파킹형": +0.3,
    },
    reason: '채권형 및 현금성 자산의 안전자산 역상관 쿠션 효과가 주식형 손실을 방어합니다.',
  },
  {
    id: 'stagflation',
    title: '스태그플레이션 (유가 $90 돌파 + 경기 둔화)',
    subtitle: '공급망 충격 및 실질 경제성장 정체',
    icon: AlertTriangle,
    color: 'from-orange-600/30 to-orange-900/30 border-orange-500/40 text-orange-300',
    macroChange: 'WTI 유가 $90 돌파',
    shocks: {
      "국내주식형": -4.0,
      "미국주식형": -3.2,
      "신흥국형": -4.5,
      "국내채권": -0.8,
      "미국채권": -1.2,
      "대체자산": +5.5,
      "현금/파킹형": +0.5,
    },
    reason: '원자재 및 대체자산의 인플레이션 헤지 기능이 발휘되며 펀드 하방을 지지합니다.',
  },
];

export default function TffStressCorrelationMatrix({ data }: Props) {
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>('fx_surge');

  // 1. TFF 실제 보유 종목(Holdings) 및 자산군별 비중 산출
  const { heldCategories, totalPortfolioValueManwon, latestMonthLabel, hasHoldings } = useMemo(() => {
    if (!data) return { heldCategories: [], totalPortfolioValueManwon: 0, latestMonthLabel: '', hasHoldings: false };

    const lm = data.latestMonth;
    let info: TffMonthInfo | null = null;
    if (lm && lm !== 'YTM' && data.monthlyMap?.[lm]) {
      info = data.monthlyMap[lm];
    } else if (data.ytm) {
      info = data.ytm;
    } else if (Object.keys(data.monthlyMap || {}).length > 0) {
      const keys = Object.keys(data.monthlyMap).sort((a, b) => parseInt(a) - parseInt(b));
      info = data.monthlyMap[keys[keys.length - 1]];
    }

    const holdings = info?.holdings || [];
    const valid = holdings.filter(h => h.name && (h.endValue > 0 || (h.beginValue || 0) > 0));
    const cash = info?.summary?.cashBalance || 0;

    const totalVal = valid.reduce((acc, cur) => acc + (cur.endValue || 0), 0) + cash;
    if (totalVal <= 0) {
      return { heldCategories: [], totalPortfolioValueManwon: 0, latestMonthLabel: '', hasHoldings: false };
    }

    // 실제 편입된 종목들을 자산군별로 합산
    const catMap: Record<string, { value: number; holdingNames: string[] }> = {};

    valid.forEach(h => {
      const cat = categorizeAsset(h.name);
      if (!catMap[cat]) catMap[cat] = { value: 0, holdingNames: [] };
      catMap[cat].value += (h.endValue || 0);
      if (!catMap[cat].holdingNames.includes(h.name)) {
        catMap[cat].holdingNames.push(h.name);
      }
    });

    if (cash > 0) {
      if (!catMap["현금/파킹형"]) catMap["현금/파킹형"] = { value: 0, holdingNames: ['계좌 예수금'] };
      catMap["현금/파킹형"].value += cash;
    }

    // 비중 정렬
    const categories = Object.keys(catMap).map(cat => {
      const val = catMap[cat].value;
      const weightPct = Number(((val / totalVal) * 100).toFixed(1));
      return {
        name: cat,
        value: val,
        valueManwon: Math.round(val / 10000),
        weightPct,
        holdingNames: catMap[cat].holdingNames,
      };
    }).sort((a, b) => b.value - a.value);

    return {
      heldCategories: categories,
      totalPortfolioValueManwon: Math.round(totalVal / 10000),
      latestMonthLabel: lm || info?.period || '최근',
      hasHoldings: categories.length > 0,
    };
  }, [data]);

  // 활성 시나리오
  const activeScenario = useMemo(() => {
    return SCENARIOS.find(s => s.id === selectedScenarioId) || SCENARIOS[0];
  }, [selectedScenarioId]);

  // 2. 실제 보유 비중을 곱한 펀드 NAV 스트레스 테스트 결과
  const stressResult = useMemo(() => {
    if (heldCategories.length === 0) {
      return { totalPnlPct: 0, totalPnlAmountManwon: 0, categoryDetails: [], cushionAssetName: '없음' };
    }

    let totalPnlPct = 0;
    let bestImpactPct = -999;
    let cushionAsset = '';

    const categoryDetails = heldCategories.map(cat => {
      const shockPct = activeScenario.shocks[cat.name] ?? 0;
      const contributionPct = shockPct * (cat.weightPct / 100);
      totalPnlPct += contributionPct;

      const pnlAmountManwon = Math.round(cat.valueManwon * (shockPct / 100));

      if (shockPct > bestImpactPct) {
        bestImpactPct = shockPct;
        cushionAsset = `${cat.name} (${cat.holdingNames.slice(0, 2).join(', ')})`;
      }

      return {
        name: cat.name,
        weightPct: cat.weightPct,
        shockPct,
        contributionPct: Number(contributionPct.toFixed(2)),
        pnlAmountManwon,
        holdings: cat.holdingNames,
      };
    });

    const totalPnlAmountManwon = Math.round(totalPortfolioValueManwon * (totalPnlPct / 100));

    return {
      totalPnlPct: Number(totalPnlPct.toFixed(2)),
      totalPnlAmountManwon,
      categoryDetails,
      cushionAssetName: cushionAsset,
    };
  }, [heldCategories, activeScenario, totalPortfolioValueManwon]);

  // 상관계수 색상 헬퍼
  const getCorrelationColor = (val: number) => {
    if (val === 1.0) return 'bg-sky-500/20 text-sky-300 font-bold';
    if (val > 0.4) return 'bg-indigo-600/30 text-indigo-200';
    if (val > 0.1) return 'bg-indigo-950/40 text-indigo-300';
    if (val >= -0.1 && val <= 0.1) return 'bg-slate-800/60 text-slate-400';
    if (val < -0.1) return 'bg-emerald-500/20 text-emerald-300 font-semibold';
    return 'bg-slate-900 text-slate-400';
  };

  if (!hasHoldings) {
    return (
      <div className="w-full p-8 rounded-2xl bg-slate-900/40 border border-slate-800 text-center">
        <AlertCircle className="w-12 h-12 text-slate-500 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-white mb-1">TFF 보유 종목 데이터가 없습니다</h3>
        <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
          TFF 펀드 현황 엑셀을 업로드하면 실제 편입된 종목 기반의 리스크 매트릭스 및 스트레스 테스트가 자동으로 산출됩니다.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      {/* 1. 상단 인트로 헤더 */}
      <div className="p-5 md:p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-purple-950/40 to-slate-900 border border-purple-500/20 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                <ShieldAlert className="w-3 h-3" />
                TFF 실제 보유 포트폴리오 기반 리스크
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                <ShieldCheck className="w-3 h-3" />
                {latestMonthLabel} 기준 {heldCategories.length}개 자산군
              </span>
            </div>
            <h2 className="text-xl md:text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
              TFF 보유 자산 상관계수 & 매크로 충격 스트레스 테스터
            </h2>
            <p className="text-xs md:text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed">
              TFF 펀드에 실제 편입된 자산군(비보유 자산 제외)의 가중치를 정밀 반영하여, 4대 글로벌 거시 충격 시 펀드 NAV 예상 손익과 방어력을 계량화합니다.
            </p>
          </div>
        </div>
      </div>

      {/* 2. 4대 매크로 시나리오 선택 탭 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {SCENARIOS.map(sc => {
          const Icon = sc.icon;
          const isSelected = selectedScenarioId === sc.id;
          return (
            <button
              key={sc.id}
              onClick={() => setSelectedScenarioId(sc.id)}
              className={`p-3.5 rounded-xl border text-left transition-all relative flex flex-col justify-between ${
                isSelected
                  ? `bg-gradient-to-br ${sc.color} shadow-lg ring-1 ring-purple-400/50`
                  : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Icon className={`w-4 h-4 ${isSelected ? 'text-white' : 'text-slate-500'}`} />
                  {isSelected && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-500/30 text-purple-200">
                      선택됨
                    </span>
                  )}
                </div>
                <div className="text-xs font-bold text-white line-clamp-1">{sc.title}</div>
                <div className="text-[11px] text-slate-400 mt-1">{sc.macroChange}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* 3. 활성 시나리오 스트레스 테스트 결과 카드 */}
      <div className="p-5 md:p-6 rounded-2xl bg-slate-950 border border-slate-800 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
          <div>
            <span className="text-xs font-bold text-purple-400">보유 자산 기반 시뮬레이션</span>
            <h3 className="text-lg font-extrabold text-white mt-0.5 flex items-center gap-2">
              {activeScenario.title}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">{activeScenario.subtitle}</p>
          </div>

          <div className="flex items-center gap-4 bg-slate-900/80 px-4 py-2.5 rounded-xl border border-slate-800">
            <div>
              <span className="text-[11px] text-slate-400 block">TFF 펀드 예상 NAV 변동</span>
              <span className={`text-xl font-extrabold tracking-tight ${stressResult.totalPnlPct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {stressResult.totalPnlPct >= 0 ? `+${stressResult.totalPnlPct}%` : `${stressResult.totalPnlPct}%`}
              </span>
            </div>
            <div className="h-8 w-[1px] bg-slate-800" />
            <div>
              <span className="text-[11px] text-slate-400 block">예상 평가 손익액</span>
              <span className={`text-base font-bold ${stressResult.totalPnlAmountManwon >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {stressResult.totalPnlAmountManwon >= 0 ? `+${stressResult.totalPnlAmountManwon.toLocaleString()}만` : `${stressResult.totalPnlAmountManwon.toLocaleString()}만`}
              </span>
            </div>
            <div className="h-8 w-[1px] bg-slate-800" />
            <div>
              <span className="text-[11px] text-slate-400 block">최대 방어 자산군</span>
              <span className="text-xs font-bold text-amber-300">
                {stressResult.cushionAssetName}
              </span>
            </div>
          </div>
        </div>

        {/* 자산군별 변동률 바 차트 */}
        <div className="mt-5">
          <h4 className="text-xs font-bold text-slate-300 mb-2 flex items-center gap-1.5">
            <BarChart2 className="w-3.5 h-3.5 text-purple-400" />
            실제 보유 자산군별 개별 변동률 (%) & 편입 비중
          </h4>
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stressResult.categoryDetails} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                <XAxis dataKey="name" stroke="#94a3b8" tick={{ fontSize: 11 }} />
                <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
                <Tooltip
                  contentStyle={STANDARD_TOOLTIP_STYLE}
                  formatter={(val: any, name: any, item: any) => [
                    `${val}% (편입비중 ${item.payload.weightPct}%)`,
                    '예상 변동률'
                  ]}
                />
                <ReferenceLine y={0} stroke="#64748b" />
                <Bar dataKey="shockPct" name="수익률 변동(%)" radius={[4, 4, 0, 0]}>
                  {stressResult.categoryDetails.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.shockPct >= 0 ? '#10b981' : '#f43f5e'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[11px] text-slate-300 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800 mt-2">
            💡 <strong>AI 리스크 코멘트:</strong> {activeScenario.reason}
          </p>
        </div>
      </div>

      {/* 4. 실제 편입 자산군 간 상관계수 매트릭스 */}
      <div className="p-5 md:p-6 rounded-2xl bg-slate-950 border border-slate-800 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-purple-400" />
              TFF 편입 {heldCategories.length}대 자산군 상관계수(Correlation) 매트릭스
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              실제 편입된 자산군 간의 상관도를 바탕으로 포트폴리오의 분산 위험 완충 효과를 표시합니다.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-xs text-center border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-semibold">
                <th className="p-2.5 text-left">자산군 (편입비중)</th>
                {heldCategories.map(cls => (
                  <th key={cls.name} className="p-2.5 whitespace-nowrap">
                    {cls.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {heldCategories.map(rowCls => (
                <tr key={rowCls.name} className="hover:bg-slate-900/40 transition-colors">
                  <td className="p-2.5 text-left font-bold text-white whitespace-nowrap">
                    {rowCls.name} <span className="text-[10px] font-normal text-slate-400">({rowCls.weightPct}%)</span>
                  </td>
                  {heldCategories.map(colCls => {
                    const corr = HISTORICAL_CORR_MAP[rowCls.name]?.[colCls.name] ?? 0;
                    return (
                      <td key={colCls.name} className="p-2">
                        <span className={`inline-block px-2.5 py-1 rounded-md text-xs transition-all ${getCorrelationColor(corr)}`}>
                          {corr > 0 ? `+${corr.toFixed(2)}` : corr.toFixed(2)}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
