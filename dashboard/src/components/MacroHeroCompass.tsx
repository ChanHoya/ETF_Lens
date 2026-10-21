// 글로벌 거시 경제 및 시장 위험 선호도를 실시간 종합 진단하는 Hero 나침반 컴포넌트
'use client';

import React, { useMemo } from 'react';
import { Compass, TrendingUp, AlertCircle, ShieldCheck, Flame, DollarSign, Activity, Sparkles, ArrowUpRight } from 'lucide-react';

interface MacroHeroCompassProps {
  vix?: number;
  fgi?: number;
  wti?: number;
  krw?: number;
  policyGap?: number;
  onExploreDetail?: (group: 'oil' | 'sentiment' | 'inflation' | 'rates' | 'fx' | 'stocks') => void;
}

export default function MacroHeroCompass({
  vix = 16.5,
  fgi = 58,
  wti = 101.41,
  krw = 1329.6,
  policyGap = -1.0,
  onExploreDetail,
}: MacroHeroCompassProps) {
  // 거시 국면 종합 산출 (위험 선호도, 금리 압박, 유가 인플레, 환율 리스크)
  const regime = useMemo(() => {
    // 0: 안정 성장, 1: 완만한 위험선호, 2: 경계/중립, 3: 위험 회피
    let riskScore = 0;
    if (vix > 22) riskScore += 2;
    else if (vix > 18) riskScore += 1;

    if (wti > 90) riskScore += 2;
    else if (wti > 80) riskScore += 1;

    if (krw > 1380) riskScore += 2;
    else if (krw > 1330) riskScore += 1;

    if (policyGap < -1.5) riskScore += 1;

    if (riskScore >= 5) {
      return {
        title: '신중 관망 · 자산 방어 국면',
        badge: '방어적 포트폴리오 권장',
        badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
        borderColor: 'border-rose-500/40',
        summary: '고유가에 따른 인플레이션 압력과 한미 금리차가 상존하므로, 현금성 자산 및 방어형 배당 ETF 비중 유지가 유리합니다.',
        statusIcon: AlertCircle,
        sentimentLabel: '리스크 관리',
      };
    } else if (riskScore >= 3) {
      return {
        title: '중립 분산 · 선별적 분할매수',
        badge: '균형 자산배분 국면',
        badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
        borderColor: 'border-amber-500/40',
        summary: '시장 변동성(VIX)은 안정세이나 고유가 지속에 따른 중간재 비용 부담을 점검하며 분할 매수 전략이 유효합니다.',
        statusIcon: Activity,
        sentimentLabel: '선별 투자',
      };
    } else {
      return {
        title: '위험자산 완만한 확장 국면',
        badge: '적극적 분할투자 유효',
        badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
        borderColor: 'border-emerald-500/40',
        summary: '공포지수가 안정권에 머물며 글로벌 유동성이 주식 시장으로 유입되는 우호적 매크로 환경입니다.',
        statusIcon: ShieldCheck,
        sentimentLabel: '위험 선호',
      };
    }
  }, [vix, wti, krw, policyGap]);

  const StatusIcon = regime.statusIcon;

  return (
    <div className={`w-full relative overflow-hidden rounded-2xl border ${regime.borderColor} bg-gradient-to-br from-[#121626]/95 via-[#0e1220]/95 to-[#0b0e18]/95 p-4 sm:p-5 shadow-xl backdrop-blur-md`}>
      {/* 배경 장식 앰비언트 글로우 */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none -mr-16 -mt-16" />

      {/* 상단 1순위 헤드라인 & 종합 국면 */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3.5 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 shrink-0">
            <Compass className="w-5 h-5 animate-[spin_12s_linear_infinite]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold tracking-wider uppercase text-indigo-400">
                1순위 매크로 나침반 · 시장 판정
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${regime.badgeColor}`}>
                {regime.badge}
              </span>
            </div>
            <h3 className="text-base sm:text-lg font-black text-white tracking-tight flex items-center gap-2 mt-0.5">
              {regime.title}
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start lg:self-auto">
          <span className="text-xs text-slate-300 bg-white/5 border border-white/10 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
            <StatusIcon className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-slate-400">기조</span>
            <strong className="text-white">{regime.sentimentLabel}</strong>
          </span>
          <span className="text-xs text-slate-300 bg-white/5 border border-white/10 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-slate-400">탐욕지수</span>
            <strong className="text-amber-300">{fgi} pt</strong>
          </span>
        </div>
      </div>

      {/* 중단 3대 기둥 지표 (심리, 원자재/물가, 통화/환율) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-3.5">
        {/* 기둥 1: 위험자산 심리 */}
        <button
          type="button"
          onClick={() => onExploreDetail && onExploreDetail('sentiment')}
          className="text-left group p-3 rounded-xl bg-black/25 hover:bg-black/40 border border-white/5 hover:border-indigo-400/50 transition-all duration-150 cursor-pointer active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
        >
          <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
            <span className="flex items-center gap-1 font-semibold text-slate-300">
              <Activity className="w-3.5 h-3.5 text-pink-400" />
              위험자산 변동성
            </span>
            <ArrowUpRight className="w-3 h-3 text-slate-500 group-hover:text-indigo-400 transition" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-black text-white font-mono">{vix} pt</span>
            <span className="text-[11px] font-bold text-emerald-400">VIX 안정권</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1 line-clamp-1">
            VKOSPI 18.2 pt · 패닉 없는 지수 방어
          </p>
        </button>

        {/* 기둥 2: 인플레 및 에너지 */}
        <button
          type="button"
          onClick={() => onExploreDetail && onExploreDetail('oil')}
          className="text-left group p-3 rounded-xl bg-black/25 hover:bg-black/40 border border-white/5 hover:border-amber-400/50 transition-all duration-150 cursor-pointer active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:outline-none"
        >
          <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
            <span className="flex items-center gap-1 font-semibold text-slate-300">
              <Flame className="w-3.5 h-3.5 text-amber-400" />
              원자재 · 에너지 압박
            </span>
            <ArrowUpRight className="w-3 h-3 text-slate-500 group-hover:text-amber-400 transition" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-black text-amber-300 font-mono">${wti}</span>
            <span className="text-[11px] font-bold text-rose-400">WTI 고유가 부담</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1 line-clamp-1">
            브렌트 $109.8 · 생산자물가(PPI) 선행 압력
          </p>
        </button>

        {/* 기둥 3: 외환 및 유동성 */}
        <button
          type="button"
          onClick={() => onExploreDetail && onExploreDetail('fx')}
          className="text-left group p-3 rounded-xl bg-black/25 hover:bg-black/40 border border-white/5 hover:border-emerald-400/50 transition-all duration-150 cursor-pointer active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-none"
        >
          <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
            <span className="flex items-center gap-1 font-semibold text-slate-300">
              <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
              외환 · 정책금리차
            </span>
            <ArrowUpRight className="w-3 h-3 text-slate-500 group-hover:text-emerald-400 transition" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-black text-white font-mono">{krw.toLocaleString()}원</span>
            <span className="text-[11px] font-bold text-indigo-300">한미 {policyGap}%p</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1 line-clamp-1">
            달러인덱스 101.8 pt · 외국인 수급 민감 구간
          </p>
        </button>
      </div>

      {/* 하단 행동 지침 요약 */}
      <div className="pt-2.5 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-300">
        <p className="leading-relaxed text-slate-300">
          <strong className="text-indigo-400 font-semibold mr-1.5">[실전 액션 가이드]</strong>
          {regime.summary}
        </p>
        <span className="text-[10px] text-slate-400 shrink-0 font-mono">
          ※ 6대 시계열 클릭 시 10년 정밀 차트 연동
        </span>
      </div>
    </div>
  );
}
