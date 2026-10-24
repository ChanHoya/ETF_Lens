// 2026 미국 중간선거 D-Day 카운트다운 및 선거 전후 계절성 랠리·4대 수혜 섹터 ETF 전략 컴포넌트
'use client';

import React, { useState } from 'react';
import { 
  Clock, TrendingUp, Sparkles, Shield, Cpu, Zap, Activity, 
  BarChart3, CheckCircle2, ArrowRight, Flame, Target
} from 'lucide-react';

interface MidtermSeasonalityProps {
  days: number;
  hours: number;
  minutes: number;
}

export default function MidtermSeasonalityStrategySection({
  days,
  hours,
  minutes
}: MidtermSeasonalityProps) {
  const [selectedSector, setSelectedSector] = useState<'defense' | 'energy' | 'semicon' | 'healthcare'>('semicon');

  const sectorStrategies = {
    semicon: {
      name: "반도체 & AI 인프라",
      etf: "SOXX / SMH / ACE 글로벌반도체TOP4",
      icon: <Cpu className="w-4 h-4 text-sky-400" />,
      catalyst: "미국 내 칩스법(CHIPS Act) 투자 집행 가속 및 대중국 반도체 통제 유지",
      swingPlan: "선거 직전 10월 중순 변동성 조정 시 분할 매수 후 Q4~익년 1Q 랠리 공략",
      winRate: "88%",
      expectedReturn: "+12.4%",
      color: "sky"
    },
    defense: {
      name: "방위산업 & 항공우주",
      etf: "ITA / XAR / KODEX K-방산",
      icon: <Shield className="w-4 h-4 text-purple-400" />,
      catalyst: "공화/민주 양당 모두 국방 예산 증액(NDAA) 합의 및 지정학적 방어력 수요 지속",
      swingPlan: "정권 분점(Gridlock) 시에도 초당적 예산 승인 1순위로 하방 경직성 탁월",
      winRate: "92%",
      expectedReturn: "+9.8%",
      color: "purple"
    },
    energy: {
      name: "에너지 & 전력 인프라",
      etf: "XLE / XLU / KODEX 미국원유에너지",
      icon: <Zap className="w-4 h-4 text-amber-400" />,
      catalyst: "AI 데이터센터 폭증에 따른 전력망 현대화 및 전통 화석연료 규제 리스크 완화",
      swingPlan: "선거 전후 유가 안정 시 배당 수익률(3.5~4.5%)과 자본차익 동시 추구",
      winRate: "80%",
      expectedReturn: "+8.5%",
      color: "amber"
    },
    healthcare: {
      name: "헬스케어 & 바이오",
      etf: "XLV / IBB / TIGER 미국헬스케어",
      icon: <Activity className="w-4 h-4 text-emerald-400" />,
      catalyst: "의회 분점(Gridlock) 확정 시 급격한 약가 규제 법안 발의 차단으로 밸류에이션 리레이팅",
      swingPlan: "경기 둔화 국면의 대표적인 경기 방어주로 대선 2년 차 하반기 벤치마크 초과 성향",
      winRate: "84%",
      expectedReturn: "+7.9%",
      color: "emerald"
    }
  };

  const current = sectorStrategies[selectedSector];

  return (
    <div className="w-full bg-[#141624] border border-white/10 rounded-3xl p-5 md:p-7 shadow-xl space-y-6">
      
      {/* 1. 상단 D-Day 카운트다운 네온 펄스 배너 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center bg-gradient-to-r from-rose-950/30 via-indigo-950/40 to-black/40 border border-white/5 rounded-2xl p-5">
        <div className="lg:col-span-7 space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
            <span className="text-xs font-bold text-rose-400 uppercase tracking-wider">
              2026.11.03 미국 의회 중간선거 D-Day
            </span>
          </div>
          <h3 className="text-xl md:text-2xl font-black text-white tracking-tight">
            선거 전후 4분기 계절성 랠리(Year 2 Q4 Rally)가 시작됩니다
          </h3>
          <p className="text-xs text-gray-400 leading-relaxed">
            1950년 이후 역대 19회의 중간선거에서 4분기 S&P 500은 <strong>승률 85%(16/19회), 평균 +6.8%</strong>의 강력한 불확실성 해소 랠리를 기록했습니다.
          </p>
        </div>

        <div className="lg:col-span-5 flex items-center justify-end">
          <div className="flex items-center gap-2 sm:gap-3 bg-black/60 border border-indigo-500/30 rounded-2xl px-4 py-3 shadow-inner">
            <div className="text-center">
              <span className="text-2xl sm:text-3xl font-black text-white font-mono">{days}</span>
              <span className="text-[10px] text-gray-400 block font-medium">DAYS</span>
            </div>
            <span className="text-xl font-bold text-indigo-400">:</span>
            <div className="text-center">
              <span className="text-2xl sm:text-3xl font-black text-indigo-300 font-mono">{hours}</span>
              <span className="text-[10px] text-gray-400 block font-medium">HOURS</span>
            </div>
            <span className="text-xl font-bold text-indigo-400">:</span>
            <div className="text-center">
              <span className="text-2xl sm:text-3xl font-black text-rose-400 font-mono">{minutes}</span>
              <span className="text-[10px] text-gray-400 block font-medium">MINS</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. 4대 핵심 계절성 통계 인포그래픽 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
          <span className="text-[11px] text-gray-400">선거 당해 Q4 승률</span>
          <div className="text-xl font-black text-emerald-400 font-mono">85%</div>
          <p className="text-[10px] text-gray-500">19회 중 16회 지수 상승</p>
        </div>

        <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
          <span className="text-[11px] text-gray-400">선거 당해 Q4 평균 수익률</span>
          <div className="text-xl font-black text-indigo-400 font-mono">+6.8%</div>
          <p className="text-[10px] text-gray-500">일반 해(+2.1%) 대비 3배</p>
        </div>

        <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
          <span className="text-[11px] text-gray-400">선거 후 1년 승률</span>
          <div className="text-xl font-black text-purple-400 font-mono">95%</div>
          <p className="text-[10px] text-gray-500">익년 10월까지 18/19회 상승</p>
        </div>

        <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
          <span className="text-[11px] text-gray-400">선거 후 1년 평균 수익률</span>
          <div className="text-xl font-black text-amber-400 font-mono">+15.2%</div>
          <p className="text-[10px] text-gray-500">대선 사이클 중 최고 성과</p>
        </div>
      </div>

      {/* 3. 4대 수혜 섹터 & 추천 ETF 스윙 전략 선택기 */}
      <div className="space-y-3 pt-2 border-t border-white/5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <span className="text-xs font-bold text-gray-200 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            중간선거 국면 4대 수혜 섹터 & 추천 ETF 스윙 전략
          </span>
          <span className="text-[10px] text-gray-400">
            의회 권력 분점(Gridlock) 환경에 최적화된 바스켓
          </span>
        </div>

        {/* 섹터 탭 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {(Object.keys(sectorStrategies) as Array<keyof typeof sectorStrategies>).map((k) => {
            const sec = sectorStrategies[k];
            const isSel = selectedSector === k;
            return (
              <button
                key={k}
                onClick={() => setSelectedSector(k)}
                className={`p-3 rounded-xl border text-left transition-all flex items-center gap-2.5 ${
                  isSel 
                    ? 'bg-indigo-600/20 border-indigo-500/50 text-white shadow-lg' 
                    : 'bg-white/[0.02] border-white/5 text-gray-400 hover:bg-white/[0.05] hover:text-gray-200'
                }`}
              >
                <div className={`p-1.5 rounded-lg ${isSel ? 'bg-indigo-500 text-white' : 'bg-white/5'}`}>
                  {sec.icon}
                </div>
                <div>
                  <div className="text-xs font-bold">{sec.name.split('&')[0]}</div>
                  <div className="text-[10px] font-mono text-gray-400">{sec.winRate} 승률</div>
                </div>
              </button>
            );
          })}
        </div>

        {/* 선택된 섹터 상세 전략 카드 */}
        <div className="p-4 rounded-xl bg-black/40 border border-white/10 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/5 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white">{current.name}</span>
                <span className="text-[11px] font-mono font-bold text-indigo-300 bg-indigo-500/20 px-2 py-0.5 rounded">
                  {current.etf}
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-1">{current.catalyst}</p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <div className="text-right">
                <span className="text-[10px] text-gray-500 block">역사적 기대수익</span>
                <span className="text-sm font-bold text-emerald-400 font-mono">{current.expectedReturn}</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-gray-500 block">계절성 승률</span>
                <span className="text-sm font-bold text-indigo-400 font-mono">{current.winRate}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-gray-300">
            <span className="text-amber-400 font-bold shrink-0">실전 스윙 전략:</span>
            <span>{current.swingPlan}</span>
          </div>
        </div>
      </div>

    </div>
  );
}
