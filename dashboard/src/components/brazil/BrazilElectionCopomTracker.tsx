'use client';

import React, { useState, useEffect } from 'react';
import {
  Vote, TrendingDown, Percent, Calendar, Sparkles,
  AlertCircle, CheckCircle2, ChevronRight, RefreshCw, Scale, ArrowUpRight
} from 'lucide-react';
import { API_BASE } from '@/lib/apiConfig';

interface PollItem {
  pollster: string;
  date: string;
  lula: number;
  flavio: number;
  undecided: number;
  margin: string;
}

interface TrackerData {
  status: string;
  as_of: string;
  election: {
    runoff_date: string;
    d_day: number;
    phase: string;
    lead_candidate: string;
    lead_margin: number;
    polls: PollItem[];
    average: {
      lula: number;
      flavio: number;
      undecided: number;
    };
    insight: string;
  };
  copom: {
    meeting_date: string;
    d_day: number;
    current_selic: number;
    rate_cut_probabilities: {
      cut_50bp: number;
      cut_25bp: number;
      hold: number;
      hike: number;
    };
    expected_delta_bp: number;
    focus_consensus_end_2026: number;
    analysis: string;
  };
}

const DEFAULT_TRACKER: TrackerData = {
  status: 'fallback',
  as_of: '2026-10-18',
  election: {
    runoff_date: '2026-10-25',
    d_day: 7,
    phase: 'runoff_campaign',
    lead_candidate: 'Lula',
    lead_margin: 0.5,
    polls: [
      { pollster: 'Quaest', date: '2026-10-15', lula: 48.5, flavio: 47.0, undecided: 4.5, margin: '±2.0%p' },
      { pollster: 'AtlasIntel', date: '2026-10-17', lula: 49.2, flavio: 48.1, undecided: 2.7, margin: '±1.5%p' },
      { pollster: 'Datafolha', date: '2026-10-16', lula: 48.0, flavio: 47.5, undecided: 4.5, margin: '±2.0%p' },
      { pollster: 'Paraná Pesquisas', date: '2026-10-14', lula: 47.2, flavio: 48.0, undecided: 4.8, margin: '±2.2%p' },
    ],
    average: {
      lula: 48.2,
      flavio: 47.7,
      undecided: 4.1
    },
    insight: '초박빙 접전 양상이나 부동층 표심이 4%대로 축소되며 결선 당일 투표율(기권율)이 승부의 최대 변수로 부상하고 있습니다.'
  },
  copom: {
    meeting_date: '2026-11-05',
    d_day: 18,
    current_selic: 10.50,
    rate_cut_probabilities: {
      cut_50bp: 10.0,
      cut_25bp: 68.0,
      hold: 22.0,
      hike: 0.0,
    },
    expected_delta_bp: -22.0,
    focus_consensus_end_2026: 9.75,
    analysis: 'IPCA 인플레이션의 안정세와 연준 피벗 가속화로 11월 Copom 25bp 인하 확률이 68%로 우세합니다. 결선 대선 결과에 따른 재정 신뢰도가 향후 인하 경로의 폭을 결정할 전망입니다.'
  }
};

export default function BrazilElectionCopomTracker() {
  const [data, setData] = useState<TrackerData>(DEFAULT_TRACKER);
  const [loading, setLoading] = useState<boolean>(false);

  const fetchTrackerData = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/v1/brazil-bond/election-and-copom-tracker`, { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (e) {
      console.warn('Failed to load election & copom tracker live data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrackerData();
  }, []);

  const { election, copom } = data;

  return (
    <div className="w-full flex flex-col gap-4 text-gray-100">
      {/* ── 상단 2열 그리드: 대선 여론조사 집계 (좌) & Copom 금리 인하 확률 (우) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* ── [좌측] 2026 브라질 대선 D-Day & 여론조사 종합 집계 (6 cols) ── */}
        <div className="lg:col-span-6 rounded-3xl bg-black/40 border border-amber-500/20 p-5 backdrop-blur-xl flex flex-col justify-between shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

          <div>
            {/* 타이틀 및 D-Day 뱃지 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
                  <Vote className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="text-sm md:text-base font-black text-white flex items-center gap-1.5">
                    2026 브라질 대선 결선 실시간 여론조사
                  </h3>
                  <span className="text-[11px] text-gray-400">10월 25일 결선투표 공식 개표 D-Day</span>
                </div>
              </div>
              <div className="text-right">
                <span className="px-2.5 py-1 rounded-full text-xs font-black bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  D-{election.d_day > 0 ? election.d_day : 'DAY'}
                </span>
              </div>
            </div>

            {/* 평균 지지율 게이지 바 (Lula vs Flavio) */}
            <div className="mt-4 p-4 rounded-2xl bg-black/40 border border-white/10">
              <div className="flex items-center justify-between text-xs mb-2">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                  <span className="font-bold text-rose-300">룰라 (PT·현직)</span>
                  <span className="text-base font-black text-white">{election.average.lula}%</span>
                </div>
                <div className="text-[11px] text-gray-400 font-medium">
                  부동층 {election.average.undecided}%
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-base font-black text-white">{election.average.flavio}%</span>
                  <span className="font-bold text-blue-300">플라비우 (PL·야당)</span>
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                </div>
              </div>

              {/* 바이폴라 게이지 바 */}
              <div className="w-full bg-white/10 rounded-full h-3 overflow-hidden flex">
                <div
                  className="bg-gradient-to-r from-rose-600 to-rose-400 h-full transition-all duration-500"
                  style={{ width: `${election.average.lula}%` }}
                />
                <div
                  className="bg-gray-600 h-full transition-all duration-500"
                  style={{ width: `${election.average.undecided}%` }}
                />
                <div
                  className="bg-gradient-to-l from-blue-600 to-blue-400 h-full transition-all duration-500"
                  style={{ width: `${election.average.flavio}%` }}
                />
              </div>

              <div className="flex justify-between items-center text-[11px] text-gray-400 mt-2">
                <span>격차: <strong>+{election.lead_margin}%p</strong> ({election.lead_candidate} 우세)</span>
                <span className="text-amber-400">초박빙 오차범위 내 접전</span>
              </div>
            </div>

            {/* 주요 여론조사 기관별 상세 리스트 */}
            <div className="mt-3 flex flex-col gap-1.5">
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">주요 조사기관별 최근 수치</span>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {election.polls.map((p, idx) => (
                  <div key={idx} className="p-2.5 rounded-xl bg-white/5 border border-white/5 flex flex-col justify-between">
                    <div className="flex items-center justify-between text-[11px] text-gray-400">
                      <span className="font-bold text-gray-300">{p.pollster}</span>
                      <span>{p.date.slice(5)}</span>
                    </div>
                    <div className="flex items-center justify-between mt-1 font-bold">
                      <span className="text-rose-400">{p.lula}%</span>
                      <span className="text-[10px] text-gray-500 font-normal">vs</span>
                      <span className="text-blue-400">{p.flavio}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <p className="mt-3 text-[11px] text-gray-300/80 leading-relaxed bg-white/5 p-2.5 rounded-xl border border-white/5">
            💡 {election.insight}
          </p>
        </div>

        {/* ── [우측] 차기 Copom 금리 인하 확률 예측기 (6 cols) ── */}
        <div className="lg:col-span-6 rounded-3xl bg-black/40 border border-teal-500/20 p-5 backdrop-blur-xl flex flex-col justify-between shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-teal-500/5 rounded-full blur-3xl pointer-events-none" />

          <div>
            {/* 타이틀 및 Copom D-Day */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-teal-500/10 border border-teal-500/30 text-teal-400">
                  <TrendingDown className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="text-sm md:text-base font-black text-white flex items-center gap-1.5">
                    차기 Copom 기준금리(Selic) 인하 확률 예측기
                  </h3>
                  <span className="text-[11px] text-gray-400">
                    11월 5일 Copom 회의 · 현재 기준금리 {copom.current_selic}%
                  </span>
                </div>
              </div>
              <div className="text-right">
                <span className="px-2.5 py-1 rounded-full text-xs font-black bg-teal-500/20 text-teal-300 border border-teal-500/40">
                  D-{copom.d_day > 0 ? copom.d_day : 'DAY'}
                </span>
              </div>
            </div>

            {/* 인하 확률 분포 3대 카드 */}
            <div className="grid grid-cols-3 gap-2.5 mt-4">
              {/* 카드 1: 25bp 인하 (메인) */}
              <div className="p-3.5 rounded-2xl bg-teal-950/40 border border-teal-500/40 flex flex-col justify-between">
                <span className="text-[10px] font-bold text-teal-300 uppercase">25bp 인하 (유력)</span>
                <div className="text-xl md:text-2xl font-black text-teal-400 mt-1">
                  {copom.rate_cut_probabilities.cut_25bp}%
                </div>
                <span className="text-[10px] text-gray-400 mt-1">기준금리 10.25%</span>
              </div>

              {/* 카드 2: 동결 */}
              <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 flex flex-col justify-between">
                <span className="text-[10px] font-bold text-gray-400 uppercase">동결 (Hold)</span>
                <div className="text-xl md:text-2xl font-black text-gray-300 mt-1">
                  {copom.rate_cut_probabilities.hold}%
                </div>
                <span className="text-[10px] text-gray-400 mt-1">기준금리 10.50%</span>
              </div>

              {/* 카드 3: 50bp 빅컷 */}
              <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 flex flex-col justify-between">
                <span className="text-[10px] font-bold text-indigo-300 uppercase">50bp 빅컷</span>
                <div className="text-xl md:text-2xl font-black text-indigo-400 mt-1">
                  {copom.rate_cut_probabilities.cut_50bp}%
                </div>
                <span className="text-[10px] text-gray-400 mt-1">기준금리 10.00%</span>
              </div>
            </div>

            {/* 시장 내재 기대치 & Focus 컨센서스 요약 */}
            <div className="mt-3 p-3.5 rounded-2xl bg-black/40 border border-white/10 flex items-center justify-between text-xs">
              <div>
                <span className="text-gray-400">선물 시장 내재 기대 변동치:</span>
                <span className="font-black text-teal-400 ml-1.5 text-sm">{copom.expected_delta_bp} bp</span>
              </div>
              <div className="border-l border-white/10 pl-3">
                <span className="text-gray-400">Focus 연말 컨센서스:</span>
                <span className="font-black text-amber-400 ml-1.5 text-sm">{copom.focus_consensus_end_2026}%</span>
              </div>
            </div>
          </div>

          <p className="mt-3 text-[11px] text-gray-300/80 leading-relaxed bg-white/5 p-2.5 rounded-xl border border-white/5">
            📊 {copom.analysis}
          </p>
        </div>
      </div>
    </div>
  );
}
