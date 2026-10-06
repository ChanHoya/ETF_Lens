'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Compass, TrendingUp, TrendingDown, Activity, Sparkles,
  AlertTriangle, ShieldCheck, CheckCircle2, ChevronRight,
  ArrowUpRight, ArrowDownRight, Layers, HelpCircle, Info
} from 'lucide-react';
import { API_BASE } from '@/lib/apiConfig';

export interface HoldingItem {
  code: string;
  name: string;
  current_price?: number;
  current_qty?: number;
  current_val?: number;
  weight?: number;
}

interface RecommendedETF {
  code: string;
  name: string;
  role: string;
  theme: string;
}

interface QuadrantInfo {
  key: string;
  x_range: number[];
  y_range: number[];
  title: string;
  sub: string;
  color: string;
  bg_class: string;
  focus: string;
}

interface TrajectoryPoint {
  period: string;
  growth: number;
  inflation: number;
  regime: string;
  label: string;
}

interface MacroIndicator {
  name: string;
  value: string;
  trend: string;
  sentiment: 'POSITIVE' | 'NEUTRAL' | 'CAUTION' | 'NEGATIVE';
}

interface RegimeResponse {
  regime_key: string;
  growth_score: number;
  inflation_score: number;
  regime_info: {
    name: string;
    name_en: string;
    growth_status: string;
    inflation_status: string;
    description: string;
    color: string;
    badge_class: string;
    best_assets: string[];
    recommended_etfs: RecommendedETF[];
    cautions: string[];
  };
  quadrants: QuadrantInfo[];
  trajectory: TrajectoryPoint[];
  macro_indicators: MacroIndicator[];
  updated_at: string;
}

interface PortfolioFitResponse {
  current_regime: string;
  regime_name: string;
  fit_score: number;
  fit_grade: string;
  grade_label: string;
  total_eval_amount: number;
  synergy_weight: number;
  headwind_weight: number;
  neutral_weight: number;
  synergy_items: Array<{ code: string; name: string; weight: number; val: number }>;
  headwind_items: Array<{ code: string; name: string; weight: number; val: number }>;
  prescription: string;
}

interface Props {
  holdings?: HoldingItem[];
}

export default function MacroRegimeQuadrant({ holdings = [] }: Props) {
  const [data, setData] = useState<RegimeResponse | null>(null);
  const [fitData, setFitData] = useState<PortfolioFitResponse | null>(null);
  const [selectedRegime, setSelectedRegime] = useState<string>('GOLDILOCKS');
  const [loading, setLoading] = useState<boolean>(true);

  // 1. 매크로 4국면 기본 데이터 조회
  useEffect(() => {
    async function fetchRegime() {
      try {
        setLoading(true);
        const res = await fetch(`${API_BASE}/api/v1/macro/regime`);
        if (!res.ok) throw new Error('Failed to fetch regime data');
        const json: RegimeResponse = await res.json();
        setData(json);
        setSelectedRegime(json.regime_key);
      } catch (err) {
        console.error('Error fetching macro regime:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchRegime();
  }, []);

  // 2. 보유 종목이 있을 경우 국면 적합도 분석 호출
  useEffect(() => {
    if (!holdings || holdings.length === 0) return;

    async function evaluateFit() {
      try {
        const payload = {
          holdings: holdings.map(h => ({
            code: h.code,
            name: h.name,
            current_price: h.current_price || 0,
            current_qty: h.current_qty || 0,
            current_val: h.current_val || 0,
          }))
        };
        const res = await fetch(`${API_BASE}/api/v1/macro/regime/fit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          const json: PortfolioFitResponse = await res.json();
          setFitData(json);
        }
      } catch (err) {
        console.error('Error evaluating regime fit:', err);
      }
    }
    evaluateFit();
  }, [holdings]);

  if (loading || !data) {
    return (
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-8 flex flex-col items-center justify-center min-h-[300px] animate-pulse">
        <Compass className="w-8 h-8 text-indigo-400 animate-spin mb-3" />
        <p className="text-sm text-slate-400">거시경제 4국면 매크로 나침반 연산 중...</p>
      </div>
    );
  }

  const { regime_info, growth_score, inflation_score, quadrants, trajectory, macro_indicators } = data;

  return (
    <div className="space-y-6">
      {/* ── 1. 헤더 & 4 Bento 메트릭 카드 ────────────────────────────── */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur-sm">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-5 border-b border-slate-800/80">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">🧭</span>
              <h2 className="text-xl font-bold text-white tracking-tight">
                매크로 거시경제 4국면 나침반 (Macro Regime Quadrant)
              </h2>
              <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                S6-33 NEW
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              경제 성장(Growth)과 인플레이션(Inflation) 2차원 사이클을 기반으로 현재 글로벌 경제 국면을 진단하고 최적의 ETF 자산군을 제안합니다.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">판정 기준:</span>
            <span className={`px-3 py-1 rounded-full text-xs font-bold border ${regime_info.badge_class}`}>
              ● 현재: {regime_info.name}
            </span>
          </div>
        </div>

        {/* 4 Bento 카드 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5">
          {/* 카드 1: 현재 거시 국면 */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
            <span className="text-xs font-semibold text-slate-400">현재 거시경제 국면</span>
            <div className="mt-2">
              <div className="text-lg font-black text-emerald-400 truncate">
                {regime_info.name}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                {regime_info.name_en}
              </div>
            </div>
            <div className="text-[11px] text-slate-400 mt-2 flex items-center gap-1.5">
              <span>{regime_info.growth_status}</span> · <span>{regime_info.inflation_status}</span>
            </div>
          </div>

          {/* 카드 2: 경제 성장 모멘텀 */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
            <span className="text-xs font-semibold text-slate-400">경제 성장 모멘텀 (Growth)</span>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-white">
                {growth_score > 0 ? `+${growth_score}` : growth_score}
              </span>
              <span className="text-xs font-semibold text-emerald-400 flex items-center">
                <TrendingUp className="w-3 h-3 mr-0.5" /> 견조한 확장
              </span>
            </div>
            <div className="text-[11px] text-slate-400 mt-2">
              미국 GDP 및 AI 설비투자(CapEx) 모멘텀
            </div>
          </div>

          {/* 카드 3: 인플레이션 압력 */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
            <span className="text-xs font-semibold text-slate-400">인플레이션 압력 (Inflation)</span>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-white">
                {inflation_score > 0 ? `+${inflation_score}` : inflation_score}
              </span>
              <span className="text-xs font-semibold text-sky-400 flex items-center">
                <TrendingDown className="w-3 h-3 mr-0.5" /> 둔화 안정
              </span>
            </div>
            <div className="text-[11px] text-slate-400 mt-2">
              CPI 2.4%대 쿨링 및 연준 금리인하 사이클
            </div>
          </div>

          {/* 카드 4: 포트폴리오 국면 적합도 */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
            <span className="text-xs font-semibold text-slate-400">포트폴리오 국면 적합도</span>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-indigo-400">
                {fitData ? `${fitData.fit_score}점` : '진단 대기'}
              </span>
              {fitData && (
                <span className="text-xs font-bold text-slate-300">
                  {fitData.grade_label}
                </span>
              )}
            </div>
            <div className="text-[11px] text-slate-400 mt-2 truncate">
              {fitData ? `시너지 비중 ${fitData.synergy_weight}%` : 'My 자산 보유 시 자동 산출'}
            </div>
          </div>
        </div>
      </div>

      {/* ── 2. 2D 4국면 매트릭스 시각화 & 실시간 궤적 ─────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* 2D 사분면 시각화 (7 cols) */}
        <div className="lg:col-span-7 bg-slate-900/80 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <span>🗺️</span> 2D 거시경제 4국면 매트릭스 & 실시간 위치
            </h3>
            <span className="text-xs text-slate-400">
              X축: 성장(-)←→(+) | Y축: 물가(-)←→(+)
            </span>
          </div>

          {/* 2D 인터랙티브 사분면 그리드 */}
          <div className="relative w-full aspect-square max-w-[440px] mx-auto my-4 bg-slate-950 rounded-2xl border border-slate-800/90 overflow-hidden p-2">
            {/* 4분할 배경 영역 */}
            <div className="grid grid-cols-2 grid-rows-2 w-full h-full gap-1.5">
              {/* 좌상단: 3국면 스태그플레이션 (X < 0, Y > 0) */}
              <div
                onClick={() => setSelectedRegime('STAGFLATION')}
                className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                  selectedRegime === 'STAGFLATION'
                    ? 'bg-rose-950/40 border-rose-500 shadow-lg shadow-rose-950/50'
                    : 'bg-rose-950/10 border-rose-900/30 hover:bg-rose-950/20'
                }`}
              >
                <div>
                  <div className="text-xs font-bold text-rose-400">3국면: 스태그플레이션</div>
                  <div className="text-[10px] text-rose-300/70">저성장 (-) · 고물가 (+)</div>
                </div>
                <div className="text-[10px] text-slate-400">방어: 현금/파킹/배당</div>
              </div>

              {/* 우상단: 2국면 인플레이션 붐 (X > 0, Y > 0) */}
              <div
                onClick={() => setSelectedRegime('OVERHEAT')}
                className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                  selectedRegime === 'OVERHEAT'
                    ? 'bg-amber-950/40 border-amber-500 shadow-lg shadow-amber-950/50'
                    : 'bg-amber-950/10 border-amber-900/30 hover:bg-amber-950/20'
                }`}
              >
                <div>
                  <div className="text-xs font-bold text-amber-400">2국면: 인플레이션 붐</div>
                  <div className="text-[10px] text-amber-300/70">고성장 (+) · 고물가 (+)</div>
                </div>
                <div className="text-[10px] text-slate-400">주도: 원자재/에너지/금</div>
              </div>

              {/* 좌하단: 4국면 디플레이션 침체 (X < 0, Y < 0) */}
              <div
                onClick={() => setSelectedRegime('CONTRACTION')}
                className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                  selectedRegime === 'CONTRACTION'
                    ? 'bg-blue-950/40 border-blue-500 shadow-lg shadow-blue-950/50'
                    : 'bg-blue-950/10 border-blue-900/30 hover:bg-blue-950/20'
                }`}
              >
                <div>
                  <div className="text-xs font-bold text-blue-400">4국면: 디플레이션 수축</div>
                  <div className="text-[10px] text-blue-300/70">저성장 (-) · 저물가 (-)</div>
                </div>
                <div className="text-[10px] text-slate-400">주도: 미국 장기채/달러</div>
              </div>

              {/* 우하단: 1국면 골디락스 (X > 0, Y < 0) */}
              <div
                onClick={() => setSelectedRegime('GOLDILOCKS')}
                className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                  selectedRegime === 'GOLDILOCKS'
                    ? 'bg-emerald-950/40 border-emerald-500 shadow-lg shadow-emerald-950/50'
                    : 'bg-emerald-950/10 border-emerald-900/30 hover:bg-emerald-950/20'
                }`}
              >
                <div>
                  <div className="text-xs font-bold text-emerald-400 flex items-center justify-between">
                    <span>1국면: 골디락스</span>
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  </div>
                  <div className="text-[10px] text-emerald-300/70">고성장 (+) · 저물가 (-)</div>
                </div>
                <div className="text-[10px] text-slate-400">주도: 빅테크/반도체/AI</div>
              </div>
            </div>

            {/* 십자 중앙 분할선 */}
            <div className="absolute inset-x-0 top-1/2 h-[1px] bg-slate-700/60 pointer-events-none" />
            <div className="absolute inset-y-0 left-1/2 w-[1px] bg-slate-700/60 pointer-events-none" />

            {/* 현재 시점 비콘 (Live Beacon) */}
            {/* 우하단(X=+38, Y=-24) 좌표: 중심(50%) 기준 X=+19%, Y=+12% (CSS top은 아래로 증가하므로 Y=-24는 50 + 12 = 62%) */}
            <div
              className="absolute z-20 -translate-x-1/2 -translate-y-1/2 pointer-events-none transition-all duration-700"
              style={{
                left: `${50 + (growth_score / 200) * 100}%`,
                top: `${50 - (inflation_score / 200) * 100}%`,
              }}
            >
              <div className="relative flex items-center justify-center">
                <span className="absolute w-8 h-8 rounded-full bg-emerald-400/30 animate-ping" />
                <span className="absolute w-5 h-5 rounded-full bg-emerald-500/60" />
                <span className="relative w-3.5 h-3.5 rounded-full bg-white border-2 border-emerald-500 shadow-lg shadow-emerald-500/80" />
                <span className="absolute left-5 bg-slate-900/90 border border-emerald-500/40 text-[10px] font-bold text-emerald-400 px-2 py-0.5 rounded shadow whitespace-nowrap">
                  NOW (+38, -24)
                </span>
              </div>
            </div>
          </div>

          <div className="text-center text-[11px] text-slate-400">
            사분면을 클릭하면 해당 국면의 추천 ETF 및 투자 전략을 확인할 수 있습니다.
          </div>
        </div>

        {/* 국면별 최적 ETF & 전략 레이더 (5 cols) */}
        <div className="lg:col-span-5 bg-slate-900/80 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>🎯</span> {data.regime_info.name} 최적 ETF 라인업
              </h3>
              <span className="text-xs text-emerald-400 font-semibold">추천 주도주</span>
            </div>

            <p className="text-xs text-slate-400 mt-3 leading-relaxed">
              {data.regime_info.description}
            </p>

            {/* 추천 ETF 카드 3선 */}
            <div className="space-y-2.5 mt-4">
              {data.regime_info.recommended_etfs.map(etf => (
                <div
                  key={etf.code}
                  className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 transition flex items-center justify-between group"
                >
                  <div>
                    <div className="text-xs font-bold text-white group-hover:text-emerald-400 transition">
                      {etf.name}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-2">
                      <span className="font-mono text-slate-500">{etf.code}</span>
                      <span>·</span>
                      <span className="text-indigo-400">{etf.theme}</span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    {etf.role}
                  </span>
                </div>
              ))}
            </div>

            {/* 주의 자산군 */}
            <div className="mt-4 p-3 rounded-xl bg-rose-950/20 border border-rose-900/30 text-xs">
              <span className="font-bold text-rose-400 block mb-1">⚠️ 국면 주의사항</span>
              <ul className="text-slate-400 text-[11px] space-y-1 list-disc list-inside">
                {data.regime_info.cautions.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span>자료: i-Prism 거시 퀀트 모델</span>
            <span className="text-[11px] text-slate-500">10년 매크로 백테스트 검증</span>
          </div>
        </div>
      </div>

      {/* ── 3. 최근 5개 분기 국면 이동 궤적 타임라인 ──────────────────── */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-4">
          <span>📈</span> 최근 국면 이동 궤적 (Macro Cycle Trajectory)
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {trajectory.map((t, idx) => (
            <div
              key={idx}
              className={`p-3 rounded-xl border text-xs transition ${
                idx === trajectory.length - 1
                  ? 'bg-emerald-950/40 border-emerald-500 shadow-md shadow-emerald-950/40'
                  : 'bg-slate-950/50 border-slate-800/80'
              }`}
            >
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>{t.period}</span>
                {idx === trajectory.length - 1 && (
                  <span className="px-1.5 py-0.2 bg-emerald-500/20 text-emerald-400 text-[10px] font-bold rounded">
                    NOW
                  </span>
                )}
              </div>
              <div className="font-bold text-white mt-1.5">{t.label}</div>
              <div className="text-[11px] text-slate-400 mt-1">
                성장 {t.growth > 0 ? `+${t.growth}` : t.growth} / 물가 {t.inflation > 0 ? `+${t.inflation}` : t.inflation}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── 4. 실계좌 포트폴리오 국면 적합도 진단 위젯 ────────────────── */}
      {fitData && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <span className="text-xl">🩺</span>
              <div>
                <h3 className="text-sm font-bold text-white">
                  내 보유 포트폴리오 매크로 국면 적합도 진단
                </h3>
                <p className="text-xs text-slate-400">
                  현재 {fitData.regime_name}과 보유 종목 간의 궁합을 정밀 분석한 결과입니다.
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-2xl font-black text-emerald-400">{fitData.fit_score}점</span>
              <div className="text-[11px] font-bold text-slate-300">{fitData.grade_label}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-5">
            {/* 시너지 종목 TOP */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-emerald-400 flex items-center gap-1">
                  <ArrowUpRight className="w-3.5 h-3.5" /> 국면 수혜 (시너지) 자산 ({fitData.synergy_weight}%)
                </span>
                <span className="text-slate-400 text-[11px]">골디락스 주도 자산</span>
              </div>
              <div className="space-y-1.5">
                {fitData.synergy_items.slice(0, 3).map(item => (
                  <div key={item.code} className="p-2.5 rounded-lg bg-slate-950/60 border border-emerald-950/50 flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-200">{item.name}</span>
                    <span className="font-mono text-emerald-400 font-bold">{item.weight}%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 역풍 종목 TOP */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-rose-400 flex items-center gap-1">
                  <ArrowDownRight className="w-3.5 h-3.5" /> 국면 소외 (역풍/관망) 자산 ({fitData.headwind_weight}%)
                </span>
                <span className="text-slate-400 text-[11px]">기회비용 발생 가능</span>
              </div>
              <div className="space-y-1.5">
                {fitData.headwind_items.length > 0 ? (
                  fitData.headwind_items.slice(0, 3).map(item => (
                    <div key={item.code} className="p-2.5 rounded-lg bg-slate-950/60 border border-rose-950/50 flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-200">{item.name}</span>
                      <span className="font-mono text-rose-400 font-bold">{item.weight}%</span>
                    </div>
                  ))
                ) : (
                  <div className="p-3 rounded-lg bg-slate-950/40 border border-slate-800 text-xs text-slate-500 text-center">
                    역풍 자산이 없습니다. 우수한 자산 배분입니다.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 처방전 박스 */}
          <div className="mt-5 p-4 rounded-xl bg-slate-950/70 border border-slate-800/80 text-xs">
            <span className="font-bold text-indigo-300 block mb-1">💡 매크로 맞춤 리밸런싱 조언</span>
            <p className="text-slate-400 leading-relaxed">{fitData.prescription}</p>
          </div>
        </div>
      )}
    </div>
  );
}
