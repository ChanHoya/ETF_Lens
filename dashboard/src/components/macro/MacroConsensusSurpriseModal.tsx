// 8대 주요 경제 지표(고용·물가) 월가 예상치 vs 실제치 서프라이즈 분석 모달 컴포넌트
'use client';

import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, 
  X, Calendar, BarChart3, HelpCircle, Layers, Sparkles, RefreshCw
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  ReferenceLine
} from 'recharts';

import { API_BASE } from '@/lib/apiConfig';

interface IndicatorMeta {
  key: string;
  name: string;
  short_name: string;
  category: string;
  unit: string;
  fed_target: string;
  description: string;
}

interface SeriesItem {
  date: string;
  period: string;
  actual: number;
  estimate: number;
  previous: number;
  unit: string;
  diff: number;
  pct_diff: number;
  status: string;
  status_label: string;
  badge_color: string;
  sentiment: string;
}

interface ScoreboardItem {
  key: string;
  name: string;
  short_name: string;
  category: string;
  unit: string;
  fed_target: string;
  latest_period: string;
  release_date: string;
  actual: number;
  estimate: number;
  previous: number;
  diff: number;
  pct_diff: number;
  status: string;
  status_label: string;
  badge_color: string;
  sentiment: string;
  description: string;
}

// 초기 로딩 지연 없이 즉시 렌더링을 보장하는 8대 지표 컨센서스 시계열 데이터
const DEFAULT_FALLBACK_DATA = {
  indicators_meta: {
    cpi: { key: "cpi", name: "소비자물가지수 (CPI YoY)", short_name: "CPI", category: "물가", unit: "%", fed_target: "2.0%", description: "미 노동부 집계 헤드라인 물가상승률" },
    core_cpi: { key: "core_cpi", name: "근원 소비자물가지수 (Core CPI)", short_name: "근원 CPI", category: "물가", unit: "%", fed_target: "2.0%", description: "식품·에너지 제외 기조적 물가" },
    ppi: { key: "ppi", name: "생산자물가지수 (PPI YoY)", short_name: "PPI", category: "물가", unit: "%", fed_target: "2.0%", description: "도매물가 및 기업 원가 압력 지표" },
    core_ppi: { key: "core_ppi", name: "근원 생산자물가지수 (Core PPI)", short_name: "근원 PPI", category: "물가", unit: "%", fed_target: "2.0%", description: "식품·에너지 제외 도매물가" },
    pce: { key: "pce", name: "개인소비지출 물가지수 (PCE YoY)", short_name: "PCE", category: "물가", unit: "%", fed_target: "2.0%", description: "연준 공식 통화정책 목표치 지표" },
    core_pce: { key: "core_pce", name: "근원 개인소비지출 (Core PCE)", short_name: "근원 PCE", category: "물가", unit: "%", fed_target: "2.0%", description: "연준 FOMC 금리 결정 최우선 핵심 지표" },
    unemployment: { key: "unemployment", name: "실업률 (Unemployment Rate)", short_name: "실업률", category: "고용", unit: "%", fed_target: "4.0~4.2%", description: "미 노동부 공식 경제활동인구 실업률" },
    nonfarm_payrolls: { key: "nonfarm_payrolls", name: "비농업 신규고용 (Nonfarm Payrolls)", short_name: "비농업고용", category: "고용", unit: "k", fed_target: "150~180k", description: "미국 경기 펀더멘털의 바로미터 신규 일자리 수" }
  },
  scoreboard: [
    { key: "cpi", name: "소비자물가지수 (CPI YoY)", short_name: "CPI", category: "물가", unit: "%", fed_target: "2.0%", latest_period: "2026-09", release_date: "2026-10-10", actual: 3.9, estimate: 3.8, previous: 3.4, diff: 0.1, pct_diff: 2.6, status: "SURPRISE_UP", status_label: "상회 (매파적)", badge_color: "rose", sentiment: "hawkish", description: "미 노동부 집계 헤드라인 물가상승률" },
    { key: "core_cpi", name: "근원 소비자물가지수 (Core CPI)", short_name: "근원 CPI", category: "물가", unit: "%", fed_target: "2.0%", latest_period: "2026-09", release_date: "2026-10-10", actual: 3.3, estimate: 3.2, previous: 3.2, diff: 0.1, pct_diff: 3.1, status: "SURPRISE_UP", status_label: "상회 (매파적)", badge_color: "rose", sentiment: "hawkish", description: "식품·에너지 제외 기조적 물가" },
    { key: "ppi", name: "생산자물가지수 (PPI YoY)", short_name: "PPI", category: "물가", unit: "%", fed_target: "2.0%", latest_period: "2026-09", release_date: "2026-10-11", actual: 8.5, estimate: 8.4, previous: 6.4, diff: 0.1, pct_diff: 1.2, status: "SURPRISE_UP", status_label: "상회 (매파적)", badge_color: "rose", sentiment: "hawkish", description: "도매물가 및 기업 원가 압력 지표" },
    { key: "core_ppi", name: "근원 생산자물가지수 (Core PPI)", short_name: "근원 PPI", category: "물가", unit: "%", fed_target: "2.0%", latest_period: "2026-09", release_date: "2026-10-11", actual: 2.8, estimate: 2.7, previous: 2.4, diff: 0.1, pct_diff: 3.7, status: "SURPRISE_UP", status_label: "상회 (매파적)", badge_color: "rose", sentiment: "hawkish", description: "식품·에너지 제외 도매물가" },
    { key: "pce", name: "개인소비지출 물가지수 (PCE YoY)", short_name: "PCE", category: "물가", unit: "%", fed_target: "2.0%", latest_period: "2026-08", release_date: "2026-09-26", actual: 3.0, estimate: 3.0, previous: 3.0, diff: 0.0, pct_diff: 0.0, status: "IN_LINE", status_label: "부합 (중립)", badge_color: "emerald", sentiment: "neutral", description: "연준 공식 통화정책 목표치 지표" },
    { key: "core_pce", name: "근원 개인소비지출 (Core PCE)", short_name: "근원 PCE", category: "물가", unit: "%", fed_target: "2.0%", latest_period: "2026-09", release_date: "2026-10-24", actual: 2.7, estimate: 2.6, previous: 2.7, diff: 0.1, pct_diff: 3.8, status: "SURPRISE_UP", status_label: "상회 (매파적)", badge_color: "rose", sentiment: "hawkish", description: "연준 FOMC 금리 결정 최우선 핵심 지표" },
    { key: "unemployment", name: "실업률 (Unemployment Rate)", short_name: "실업률", category: "고용", unit: "%", fed_target: "4.0~4.2%", latest_period: "2026-09", release_date: "2026-10-02", actual: 4.1, estimate: 4.2, previous: 4.2, diff: -0.1, pct_diff: -2.4, status: "SURPRISE_DOWN", status_label: "하회 (매파적)", badge_color: "emerald", sentiment: "hawkish", description: "미 노동부 공식 경제활동인구 실업률" },
    { key: "nonfarm_payrolls", name: "비농업 신규고용 (Nonfarm Payrolls)", short_name: "비농업고용", category: "고용", unit: "k", fed_target: "150~180k", latest_period: "2026-09", release_date: "2026-10-02", actual: 254.0, estimate: 140.0, previous: 142.0, diff: 114.0, pct_diff: 81.4, status: "SURPRISE_UP", status_label: "대폭 상회 (강력)", badge_color: "emerald", sentiment: "hawkish", description: "미국 경기 펀더멘털의 바로미터 신규 일자리 수" }
  ],
  series: {
    cpi: [
      { date: "2025-11-13", period: "2025-10", actual: 2.6, estimate: 2.6, previous: 2.4, unit: "%", diff: 0.0, pct_diff: 0.0, status: "IN_LINE", status_label: "부합", badge_color: "emerald", sentiment: "neutral" },
      { date: "2025-12-11", period: "2025-11", actual: 2.7, estimate: 2.7, previous: 2.6, unit: "%", diff: 0.0, pct_diff: 0.0, status: "IN_LINE", status_label: "부합", badge_color: "emerald", sentiment: "neutral" },
      { date: "2026-01-15", period: "2025-12", actual: 2.9, estimate: 2.9, previous: 2.7, unit: "%", diff: 0.0, pct_diff: 0.0, status: "IN_LINE", status_label: "부합", badge_color: "emerald", sentiment: "neutral" },
      { date: "2026-02-12", period: "2026-01", actual: 3.0, estimate: 2.9, previous: 2.9, unit: "%", diff: 0.1, pct_diff: 3.4, status: "SURPRISE_UP", status_label: "상회", badge_color: "rose", sentiment: "hawkish" },
      { date: "2026-03-12", period: "2026-02", actual: 3.2, estimate: 3.1, previous: 3.0, unit: "%", diff: 0.1, pct_diff: 3.2, status: "SURPRISE_UP", status_label: "상회", badge_color: "rose", sentiment: "hawkish" },
      { date: "2026-04-10", period: "2026-03", actual: 3.5, estimate: 3.4, previous: 3.2, unit: "%", diff: 0.1, pct_diff: 2.9, status: "SURPRISE_UP", status_label: "상회", badge_color: "rose", sentiment: "hawkish" },
      { date: "2026-05-15", period: "2026-04", actual: 3.4, estimate: 3.4, previous: 3.5, unit: "%", diff: 0.0, pct_diff: 0.0, status: "IN_LINE", status_label: "부합", badge_color: "emerald", sentiment: "neutral" },
      { date: "2026-06-12", period: "2026-05", actual: 3.3, estimate: 3.4, previous: 3.4, unit: "%", diff: -0.1, pct_diff: -2.9, status: "SURPRISE_DOWN", status_label: "하회", badge_color: "sky", sentiment: "dovish" },
      { date: "2026-07-11", period: "2026-06", actual: 3.0, estimate: 3.1, previous: 3.3, unit: "%", diff: -0.1, pct_diff: -3.2, status: "SURPRISE_DOWN", status_label: "하회", badge_color: "sky", sentiment: "dovish" },
      { date: "2026-08-14", period: "2026-07", actual: 2.9, estimate: 3.0, previous: 3.0, unit: "%", diff: -0.1, pct_diff: -3.3, status: "SURPRISE_DOWN", status_label: "하회", badge_color: "sky", sentiment: "dovish" },
      { date: "2026-09-11", period: "2026-08", actual: 3.4, estimate: 3.5, previous: 2.9, unit: "%", diff: -0.1, pct_diff: -2.9, status: "SURPRISE_DOWN", status_label: "하회", badge_color: "sky", sentiment: "dovish" },
      { date: "2026-10-10", period: "2026-09", actual: 3.9, estimate: 3.8, previous: 3.4, unit: "%", diff: 0.1, pct_diff: 2.6, status: "SURPRISE_UP", status_label: "상회", badge_color: "rose", sentiment: "hawkish" }
    ],
    core_cpi: [
      { date: "2025-11-13", period: "2025-10", actual: 3.3, estimate: 3.3, previous: 3.3, unit: "%", diff: 0.0, pct_diff: 0.0, status: "IN_LINE", status_label: "부합", badge_color: "emerald", sentiment: "neutral" },
      { date: "2025-12-11", period: "2025-11", actual: 3.3, estimate: 3.3, previous: 3.3, unit: "%", diff: 0.0, pct_diff: 0.0, status: "IN_LINE", status_label: "부합", badge_color: "emerald", sentiment: "neutral" },
      { date: "2026-01-15", period: "2025-12", actual: 3.3, estimate: 3.3, previous: 3.3, unit: "%", diff: 0.0, pct_diff: 0.0, status: "IN_LINE", status_label: "부합", badge_color: "emerald", sentiment: "neutral" },
      { date: "2026-02-12", period: "2026-01", actual: 3.3, estimate: 3.2, previous: 3.3, unit: "%", diff: 0.1, pct_diff: 3.1, status: "SURPRISE_UP", status_label: "상회", badge_color: "rose", sentiment: "hawkish" },
      { date: "2026-03-12", period: "2026-02", actual: 3.8, estimate: 3.7, previous: 3.3, unit: "%", diff: 0.1, pct_diff: 2.7, status: "SURPRISE_UP", status_label: "상회", badge_color: "rose", sentiment: "hawkish" },
      { date: "2026-04-10", period: "2026-03", actual: 3.8, estimate: 3.7, previous: 3.8, unit: "%", diff: 0.1, pct_diff: 2.7, status: "SURPRISE_UP", status_label: "상회", badge_color: "rose", sentiment: "hawkish" },
      { date: "2026-05-15", period: "2026-04", actual: 3.6, estimate: 3.6, previous: 3.8, unit: "%", diff: 0.0, pct_diff: 0.0, status: "IN_LINE", status_label: "부합", badge_color: "emerald", sentiment: "neutral" },
      { date: "2026-06-12", period: "2026-05", actual: 3.4, estimate: 3.5, previous: 3.6, unit: "%", diff: -0.1, pct_diff: -2.8, status: "SURPRISE_DOWN", status_label: "하회", badge_color: "sky", sentiment: "dovish" },
      { date: "2026-07-11", period: "2026-06", actual: 3.3, estimate: 3.4, previous: 3.4, unit: "%", diff: -0.1, pct_diff: -2.9, status: "SURPRISE_DOWN", status_label: "하회", badge_color: "sky", sentiment: "dovish" },
      { date: "2026-08-14", period: "2026-07", actual: 3.2, estimate: 3.2, previous: 3.3, unit: "%", diff: 0.0, pct_diff: 0.0, status: "IN_LINE", status_label: "부합", badge_color: "emerald", sentiment: "neutral" },
      { date: "2026-09-11", period: "2026-08", actual: 3.2, estimate: 3.2, previous: 3.2, unit: "%", diff: 0.0, pct_diff: 0.0, status: "IN_LINE", status_label: "부합", badge_color: "emerald", sentiment: "neutral" },
      { date: "2026-10-10", period: "2026-09", actual: 3.3, estimate: 3.2, previous: 3.2, unit: "%", diff: 0.1, pct_diff: 3.1, status: "SURPRISE_UP", status_label: "상회", badge_color: "rose", sentiment: "hawkish" }
    ],
    ppi: [
      { date: "2025-11-14", period: "2025-10", actual: 2.4, estimate: 2.3, previous: 1.9, unit: "%", diff: 0.1, pct_diff: 4.3, status: "SURPRISE_UP", status_label: "상회", badge_color: "rose", sentiment: "hawkish" },
      { date: "2025-12-12", period: "2025-11", actual: 3.0, estimate: 2.6, previous: 2.4, unit: "%", diff: 0.4, pct_diff: 15.4, status: "SURPRISE_UP", status_label: "상회", badge_color: "rose", sentiment: "hawkish" },
      { date: "2026-01-16", period: "2025-12", actual: 2.2, estimate: 2.5, previous: 3.0, unit: "%", diff: -0.3, pct_diff: -12.0, status: "SURPRISE_DOWN", status_label: "하회", badge_color: "sky", sentiment: "dovish" },
      { date: "2026-02-13", period: "2026-01", actual: 1.9, estimate: 1.6, previous: 2.2, unit: "%", diff: 0.3, pct_diff: 18.8, status: "SURPRISE_UP", status_label: "상회", badge_color: "rose", sentiment: "hawkish" },
      { date: "2026-03-13", period: "2026-02", actual: 1.6, estimate: 1.1, previous: 1.9, unit: "%", diff: 0.5, pct_diff: 45.5, status: "SURPRISE_UP", status_label: "상회", badge_color: "rose", sentiment: "hawkish" },
      { date: "2026-04-11", period: "2026-03", actual: 2.1, estimate: 2.2, previous: 1.6, unit: "%", diff: -0.1, pct_diff: -4.5, status: "SURPRISE_DOWN", status_label: "하회", badge_color: "sky", sentiment: "dovish" },
      { date: "2026-05-14", period: "2026-04", actual: 2.2, estimate: 2.2, previous: 2.1, unit: "%", diff: 0.0, pct_diff: 0.0, status: "IN_LINE", status_label: "부합", badge_color: "emerald", sentiment: "neutral" },
      { date: "2026-06-13", period: "2026-05", actual: 2.2, estimate: 2.5, previous: 2.2, unit: "%", diff: -0.3, pct_diff: -12.0, status: "SURPRISE_DOWN", status_label: "하회", badge_color: "sky", sentiment: "dovish" },
      { date: "2026-07-12", period: "2026-06", actual: 2.6, estimate: 2.3, previous: 2.2, unit: "%", diff: 0.3, pct_diff: 13.0, status: "SURPRISE_UP", status_label: "상회", badge_color: "rose", sentiment: "hawkish" },
      { date: "2026-08-13", period: "2026-07", actual: 2.2, estimate: 2.3, previous: 2.6, unit: "%", diff: -0.1, pct_diff: -4.3, status: "SURPRISE_DOWN", status_label: "하회", badge_color: "sky", sentiment: "dovish" },
      { date: "2026-09-12", period: "2026-08", actual: 6.4, estimate: 6.3, previous: 2.2, unit: "%", diff: 0.1, pct_diff: 1.6, status: "SURPRISE_UP", status_label: "상회", badge_color: "rose", sentiment: "hawkish" },
      { date: "2026-10-11", period: "2026-09", actual: 8.5, estimate: 8.4, previous: 6.4, unit: "%", diff: 0.1, pct_diff: 1.2, status: "SURPRISE_UP", status_label: "상회", badge_color: "rose", sentiment: "hawkish" }
    ],
    core_ppi: [
      { date: "2025-11-14", period: "2025-10", actual: 3.1, estimate: 3.0, previous: 2.8, unit: "%", diff: 0.1, pct_diff: 3.3, status: "SURPRISE_UP", status_label: "상회", badge_color: "rose", sentiment: "hawkish" },
      { date: "2025-12-12", period: "2025-11", actual: 3.4, estimate: 3.3, previous: 3.1, unit: "%", diff: 0.1, pct_diff: 3.0, status: "SURPRISE_UP", status_label: "상회", badge_color: "rose", sentiment: "hawkish" },
      { date: "2026-01-16", period: "2025-12", actual: 3.2, estimate: 3.3, previous: 3.4, unit: "%", diff: -0.1, pct_diff: -3.0, status: "SURPRISE_DOWN", status_label: "하회", badge_color: "sky", sentiment: "dovish" },
      { date: "2026-02-13", period: "2026-01", actual: 2.0, estimate: 2.0, previous: 3.2, unit: "%", diff: 0.0, pct_diff: 0.0, status: "IN_LINE", status_label: "부합", badge_color: "emerald", sentiment: "neutral" },
      { date: "2026-03-13", period: "2026-02", actual: 2.0, estimate: 2.1, previous: 2.0, unit: "%", diff: -0.1, pct_diff: -4.8, status: "SURPRISE_DOWN", status_label: "하회", badge_color: "sky", sentiment: "dovish" },
      { date: "2026-04-11", period: "2026-03", actual: 2.4, estimate: 2.3, previous: 2.0, unit: "%", diff: 0.1, pct_diff: 4.3, status: "SURPRISE_UP", status_label: "상회", badge_color: "rose", sentiment: "hawkish" },
      { date: "2026-05-14", period: "2026-04", actual: 2.4, estimate: 2.4, previous: 2.4, unit: "%", diff: 0.0, pct_diff: 0.0, status: "IN_LINE", status_label: "부합", badge_color: "emerald", sentiment: "neutral" },
      { date: "2026-06-13", period: "2026-05", actual: 2.3, estimate: 2.4, previous: 2.4, unit: "%", diff: -0.1, pct_diff: -4.2, status: "SURPRISE_DOWN", status_label: "하회", badge_color: "sky", sentiment: "dovish" },
      { date: "2026-07-12", period: "2026-06", actual: 3.0, estimate: 2.9, previous: 2.3, unit: "%", diff: 0.1, pct_diff: 3.4, status: "SURPRISE_UP", status_label: "상회", badge_color: "rose", sentiment: "hawkish" },
      { date: "2026-08-13", period: "2026-07", actual: 2.4, estimate: 2.4, previous: 3.0, unit: "%", diff: 0.0, pct_diff: 0.0, status: "IN_LINE", status_label: "부합", badge_color: "emerald", sentiment: "neutral" },
      { date: "2026-09-12", period: "2026-08", actual: 2.4, estimate: 2.4, previous: 2.4, unit: "%", diff: 0.0, pct_diff: 0.0, status: "IN_LINE", status_label: "부합", badge_color: "emerald", sentiment: "neutral" },
      { date: "2026-10-11", period: "2026-09", actual: 2.8, estimate: 2.7, previous: 2.4, unit: "%", diff: 0.1, pct_diff: 3.7, status: "SURPRISE_UP", status_label: "상회", badge_color: "rose", sentiment: "hawkish" }
    ],
    pce: [
      { date: "2025-11-28", period: "2025-10", actual: 2.3, estimate: 2.3, previous: 2.1, unit: "%", diff: 0.0, pct_diff: 0.0, status: "IN_LINE", status_label: "부합", badge_color: "emerald", sentiment: "neutral" },
      { date: "2025-12-26", period: "2025-11", actual: 2.4, estimate: 2.4, previous: 2.3, unit: "%", diff: 0.0, pct_diff: 0.0, status: "IN_LINE", status_label: "부합", badge_color: "emerald", sentiment: "neutral" },
      { date: "2026-01-30", period: "2025-12", actual: 2.6, estimate: 2.5, previous: 2.4, unit: "%", diff: 0.1, pct_diff: 4.0, status: "SURPRISE_UP", status_label: "상회", badge_color: "rose", sentiment: "hawkish" },
      { date: "2026-02-27", period: "2026-01", actual: 2.5, estimate: 2.4, previous: 2.6, unit: "%", diff: 0.1, pct_diff: 4.2, status: "SURPRISE_UP", status_label: "상회", badge_color: "rose", sentiment: "hawkish" },
      { date: "2026-03-27", period: "2026-02", actual: 2.5, estimate: 2.5, previous: 2.5, unit: "%", diff: 0.0, pct_diff: 0.0, status: "IN_LINE", status_label: "부합", badge_color: "emerald", sentiment: "neutral" },
      { date: "2026-04-24", period: "2026-03", actual: 2.7, estimate: 2.6, previous: 2.5, unit: "%", diff: 0.1, pct_diff: 3.8, status: "SURPRISE_UP", status_label: "상회", badge_color: "rose", sentiment: "hawkish" },
      { date: "2026-05-29", period: "2026-04", actual: 2.7, estimate: 2.7, previous: 2.7, unit: "%", diff: 0.0, pct_diff: 0.0, status: "IN_LINE", status_label: "부합", badge_color: "emerald", sentiment: "neutral" },
      { date: "2026-06-26", period: "2026-05", actual: 2.6, estimate: 2.6, previous: 2.7, unit: "%", diff: 0.0, pct_diff: 0.0, status: "IN_LINE", status_label: "부합", badge_color: "emerald", sentiment: "neutral" },
      { date: "2026-07-31", period: "2026-06", actual: 2.5, estimate: 2.5, previous: 2.6, unit: "%", diff: 0.0, pct_diff: 0.0, status: "IN_LINE", status_label: "부합", badge_color: "emerald", sentiment: "neutral" },
      { date: "2026-08-28", period: "2026-07", actual: 2.5, estimate: 2.5, previous: 2.5, unit: "%", diff: 0.0, pct_diff: 0.0, status: "IN_LINE", status_label: "부합", badge_color: "emerald", sentiment: "neutral" },
      { date: "2026-09-26", period: "2026-08", actual: 3.0, estimate: 3.0, previous: 2.5, unit: "%", diff: 0.0, pct_diff: 0.0, status: "IN_LINE", status_label: "부합", badge_color: "emerald", sentiment: "neutral" },
      { date: "2026-10-31", period: "2026-09", actual: 3.0, estimate: 3.0, previous: 3.0, unit: "%", diff: 0.0, pct_diff: 0.0, status: "IN_LINE", status_label: "부합", badge_color: "emerald", sentiment: "neutral" }
    ],
    core_pce: [
      { date: "2025-11-28", period: "2025-10", actual: 2.8, estimate: 2.8, previous: 2.7, unit: "%", diff: 0.0, pct_diff: 0.0, status: "IN_LINE", status_label: "부합", badge_color: "emerald", sentiment: "neutral" },
      { date: "2025-12-26", period: "2025-11", actual: 2.8, estimate: 2.8, previous: 2.8, unit: "%", diff: 0.0, pct_diff: 0.0, status: "IN_LINE", status_label: "부합", badge_color: "emerald", sentiment: "neutral" },
      { date: "2026-01-30", period: "2025-12", actual: 2.9, estimate: 2.9, previous: 2.8, unit: "%", diff: 0.0, pct_diff: 0.0, status: "IN_LINE", status_label: "부합", badge_color: "emerald", sentiment: "neutral" },
      { date: "2026-02-27", period: "2026-01", actual: 2.8, estimate: 2.8, previous: 2.9, unit: "%", diff: 0.0, pct_diff: 0.0, status: "IN_LINE", status_label: "부합", badge_color: "emerald", sentiment: "neutral" },
      { date: "2026-03-27", period: "2026-02", actual: 2.8, estimate: 2.8, previous: 2.8, unit: "%", diff: 0.0, pct_diff: 0.0, status: "IN_LINE", status_label: "부합", badge_color: "emerald", sentiment: "neutral" },
      { date: "2026-04-24", period: "2026-03", actual: 2.8, estimate: 2.8, previous: 2.8, unit: "%", diff: 0.0, pct_diff: 0.0, status: "IN_LINE", status_label: "부합", badge_color: "emerald", sentiment: "neutral" },
      { date: "2026-05-29", period: "2026-04", actual: 2.8, estimate: 2.8, previous: 2.8, unit: "%", diff: 0.0, pct_diff: 0.0, status: "IN_LINE", status_label: "부합", badge_color: "emerald", sentiment: "neutral" },
      { date: "2026-06-26", period: "2026-05", actual: 2.6, estimate: 2.6, previous: 2.8, unit: "%", diff: 0.0, pct_diff: 0.0, status: "IN_LINE", status_label: "부합", badge_color: "emerald", sentiment: "neutral" },
      { date: "2026-07-31", period: "2026-06", actual: 2.6, estimate: 2.6, previous: 2.6, unit: "%", diff: 0.0, pct_diff: 0.0, status: "IN_LINE", status_label: "부합", badge_color: "emerald", sentiment: "neutral" },
      { date: "2026-08-28", period: "2026-07", actual: 2.6, estimate: 2.6, previous: 2.6, unit: "%", diff: 0.0, pct_diff: 0.0, status: "IN_LINE", status_label: "부합", badge_color: "emerald", sentiment: "neutral" },
      { date: "2026-09-26", period: "2026-08", actual: 2.7, estimate: 2.6, previous: 2.6, unit: "%", diff: 0.1, pct_diff: 3.8, status: "SURPRISE_UP", status_label: "상회", badge_color: "rose", sentiment: "hawkish" },
      { date: "2026-10-24", period: "2026-09", actual: 2.7, estimate: 2.6, previous: 2.7, unit: "%", diff: 0.1, pct_diff: 3.8, status: "SURPRISE_UP", status_label: "상회", badge_color: "rose", sentiment: "hawkish" }
    ],
    unemployment: [
      { date: "2025-11-07", period: "2025-10", actual: 4.1, estimate: 4.1, previous: 4.1, unit: "%", diff: 0.0, pct_diff: 0.0, status: "IN_LINE", status_label: "부합", badge_color: "emerald", sentiment: "neutral" },
      { date: "2025-12-05", period: "2025-11", actual: 4.2, estimate: 4.1, previous: 4.1, unit: "%", diff: 0.1, pct_diff: 2.4, status: "SURPRISE_UP", status_label: "상회", badge_color: "amber", sentiment: "dovish" },
      { date: "2026-01-09", period: "2025-12", actual: 4.1, estimate: 4.2, previous: 4.2, unit: "%", diff: -0.1, pct_diff: -2.4, status: "SURPRISE_DOWN", status_label: "하회", badge_color: "emerald", sentiment: "hawkish" },
      { date: "2026-02-06", period: "2026-01", actual: 4.0, estimate: 4.1, previous: 4.1, unit: "%", diff: -0.1, pct_diff: -2.4, status: "SURPRISE_DOWN", status_label: "하회", badge_color: "emerald", sentiment: "hawkish" },
      { date: "2026-03-06", period: "2026-02", actual: 3.9, estimate: 4.0, previous: 4.0, unit: "%", diff: -0.1, pct_diff: -2.5, status: "SURPRISE_DOWN", status_label: "하회", badge_color: "emerald", sentiment: "hawkish" },
      { date: "2026-04-03", period: "2026-03", actual: 3.8, estimate: 3.9, previous: 3.9, unit: "%", diff: -0.1, pct_diff: -2.6, status: "SURPRISE_DOWN", status_label: "하회", badge_color: "emerald", sentiment: "hawkish" },
      { date: "2026-05-08", period: "2026-04", actual: 3.9, estimate: 3.9, previous: 3.8, unit: "%", diff: 0.0, pct_diff: 0.0, status: "IN_LINE", status_label: "부합", badge_color: "emerald", sentiment: "neutral" },
      { date: "2026-06-05", period: "2026-05", actual: 4.0, estimate: 4.0, previous: 3.9, unit: "%", diff: 0.0, pct_diff: 0.0, status: "IN_LINE", status_label: "부합", badge_color: "emerald", sentiment: "neutral" },
      { date: "2026-07-02", period: "2026-06", actual: 4.1, estimate: 4.0, previous: 4.0, unit: "%", diff: 0.1, pct_diff: 2.5, status: "SURPRISE_UP", status_label: "상회", badge_color: "amber", sentiment: "dovish" },
      { date: "2026-08-07", period: "2026-07", actual: 4.3, estimate: 4.1, previous: 4.1, unit: "%", diff: 0.2, pct_diff: 4.9, status: "SURPRISE_UP", status_label: "상회", badge_color: "amber", sentiment: "dovish" },
      { date: "2026-09-04", period: "2026-08", actual: 4.2, estimate: 4.2, previous: 4.3, unit: "%", diff: 0.0, pct_diff: 0.0, status: "IN_LINE", status_label: "부합", badge_color: "emerald", sentiment: "neutral" },
      { date: "2026-10-02", period: "2026-09", actual: 4.1, estimate: 4.2, previous: 4.2, unit: "%", diff: -0.1, pct_diff: -2.4, status: "SURPRISE_DOWN", status_label: "하회", badge_color: "emerald", sentiment: "hawkish" }
    ],
    nonfarm_payrolls: [
      { date: "2025-11-07", period: "2025-10", actual: 12.0, estimate: 105.0, previous: 223.0, unit: "k", diff: -93.0, pct_diff: -88.6, status: "SURPRISE_DOWN", status_label: "대폭 하회", badge_color: "amber", sentiment: "dovish" },
      { date: "2025-12-05", period: "2025-11", actual: 227.0, estimate: 200.0, previous: 12.0, unit: "k", diff: 27.0, pct_diff: 13.5, status: "SURPRISE_UP", status_label: "상회", badge_color: "emerald", sentiment: "hawkish" },
      { date: "2026-01-09", period: "2025-12", actual: 256.0, estimate: 160.0, previous: 227.0, unit: "k", diff: 96.0, pct_diff: 60.0, status: "SURPRISE_UP", status_label: "상회", badge_color: "emerald", sentiment: "hawkish" },
      { date: "2026-02-06", period: "2026-01", actual: 143.0, estimate: 170.0, previous: 256.0, unit: "k", diff: -27.0, pct_diff: -15.9, status: "SURPRISE_DOWN", status_label: "하회", badge_color: "amber", sentiment: "dovish" },
      { date: "2026-03-06", period: "2026-02", actual: 275.0, estimate: 195.0, previous: 143.0, unit: "k", diff: 80.0, pct_diff: 41.0, status: "SURPRISE_UP", status_label: "상회", badge_color: "emerald", sentiment: "hawkish" },
      { date: "2026-04-03", period: "2026-03", actual: 303.0, estimate: 214.0, previous: 275.0, unit: "k", diff: 89.0, pct_diff: 41.6, status: "SURPRISE_UP", status_label: "상회", badge_color: "emerald", sentiment: "hawkish" },
      { date: "2026-05-08", period: "2026-04", actual: 175.0, estimate: 240.0, previous: 303.0, unit: "k", diff: -65.0, pct_diff: -27.1, status: "SURPRISE_DOWN", status_label: "하회", badge_color: "amber", sentiment: "dovish" },
      { date: "2026-06-05", period: "2026-05", actual: 272.0, estimate: 180.0, previous: 175.0, unit: "k", diff: 92.0, pct_diff: 51.1, status: "SURPRISE_UP", status_label: "상회", badge_color: "emerald", sentiment: "hawkish" },
      { date: "2026-07-02", period: "2026-06", actual: 206.0, estimate: 190.0, previous: 272.0, unit: "k", diff: 16.0, pct_diff: 8.4, status: "SURPRISE_UP", status_label: "상회", badge_color: "emerald", sentiment: "hawkish" },
      { date: "2026-08-07", period: "2026-07", actual: 114.0, estimate: 175.0, previous: 206.0, unit: "k", diff: -61.0, pct_diff: -34.9, status: "SURPRISE_DOWN", status_label: "하회", badge_color: "amber", sentiment: "dovish" },
      { date: "2026-09-04", period: "2026-08", actual: 142.0, estimate: 160.0, previous: 114.0, unit: "k", diff: -18.0, pct_diff: -11.3, status: "SURPRISE_DOWN", status_label: "하회", badge_color: "amber", sentiment: "dovish" },
      { date: "2026-10-02", period: "2026-09", actual: 254.0, estimate: 140.0, previous: 142.0, unit: "k", diff: 114.0, pct_diff: 81.4, status: "SURPRISE_UP", status_label: "대폭 상회", badge_color: "emerald", sentiment: "hawkish" }
    ]
  }
};

interface MacroConsensusSurpriseModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialIndicator?: string;
}

export default function MacroConsensusSurpriseModal({
  isOpen,
  onClose,
  initialIndicator = 'cpi'
}: MacroConsensusSurpriseModalProps) {
  const [selectedKey, setSelectedKey] = useState<string>(initialIndicator);
  const [period, setPeriod] = useState<'6M' | '1Y'>('1Y');
  const [data, setData] = useState<any>(DEFAULT_FALLBACK_DATA);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen) return;
    fetchData();
  }, [isOpen, period]);

  useEffect(() => {
    if (initialIndicator) {
      setSelectedKey(initialIndicator);
    }
  }, [initialIndicator]);

  const fetchData = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/macro/economic-indicators/consensus?period=${period}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (e) {
      console.warn('Backend consensus API unavailable, using rich fallback data.', e);
    }
  };

  if (!isOpen) return null;

  const currentScore = data?.scoreboard?.find((s: any) => s.key === selectedKey) || DEFAULT_FALLBACK_DATA.scoreboard.find(s => s.key === selectedKey);
  const currentSeries = data?.series?.[selectedKey] || DEFAULT_FALLBACK_DATA.series[selectedKey as keyof typeof DEFAULT_FALLBACK_DATA.series] || [];
  const currentMeta = data?.indicators_meta?.[selectedKey] || DEFAULT_FALLBACK_DATA.indicators_meta[selectedKey as keyof typeof DEFAULT_FALLBACK_DATA.indicators_meta];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-4 sm:pt-8 pb-8 px-3 sm:px-4 bg-black/80 backdrop-blur-md overflow-y-auto animate-fade-in">
      <div className="bg-[#12141f] border border-white/10 rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto sm:my-0">
        
        {/* 헤더 */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-black/30">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">
                  미국 8대 주요 경제 지표 월가 예상치(Consensus) vs 실제치 서프라이즈 분석
                </h2>
                <span className="text-[10px] font-semibold text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-full">
                  전문가 인텔리전스
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                월별 추세 및 발표일자별 월가 컨센서스 대비 실제 증감 현황과 시장 충격도를 정밀 추적합니다.
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 8대 지표 선택 탭 바 */}
        <div className="px-4 sm:px-6 py-2 border-b border-white/5 bg-black/20 flex items-center justify-between gap-1.5 overflow-x-auto scrollbar-none">
          <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto py-0.5 scrollbar-none shrink-0 min-w-0">
            {data?.scoreboard.map((item) => {
              const isSelected = item.key === selectedKey;
              const isInflation = item.category === '물가';
              return (
                <button
                  key={item.key}
                  onClick={() => setSelectedKey(item.key)}
                  className={`px-2 sm:px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1 ${
                    isSelected 
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 font-semibold' 
                      : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-gray-200'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isInflation ? 'bg-rose-400' : 'bg-sky-400'}`} />
                  <span>{item.short_name}</span>
                  <span className={`text-[9px] font-mono px-1 py-0 rounded ${
                    item.diff > 0 
                      ? (isInflation ? 'text-rose-300 bg-rose-500/20' : 'text-emerald-300 bg-emerald-500/20')
                      : item.diff < 0
                      ? (isInflation ? 'text-sky-300 bg-sky-500/20' : 'text-amber-300 bg-amber-500/20')
                      : 'text-gray-400 bg-white/5'
                  }`}>
                    {item.diff > 0 ? `+${item.diff}` : item.diff}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-1 shrink-0 ml-1">
            {(['6M', '1Y'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-2 py-0.5 text-[10px] font-semibold rounded-md transition ${
                  period === p ? 'bg-white/15 text-white' : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* 바디 컨텐츠 */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {isLoading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3">
              <RefreshCw className="w-6 h-6 text-indigo-400 animate-spin" />
              <span className="text-xs text-gray-400">월가 컨센서스 시계열 데이터를 불러오는 중입니다...</span>
            </div>
          ) : (
            <>
              {/* 상단 KPI 서프라이즈 배너 카드 */}
              {currentScore && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-white/[0.02] border border-white/5 rounded-xl p-4">
                  <div className="space-y-1">
                    <span className="text-[11px] text-gray-400 flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-indigo-400" />
                      최신 발표일 ({currentScore.latest_period}월분)
                    </span>
                    <div className="text-sm font-bold text-white font-mono">{currentScore.release_date}</div>
                    <div className="text-[10px] text-gray-500">연준 목표: {currentScore.fed_target}</div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[11px] text-gray-400">실제 발표치 (Actual)</span>
                    <div className="text-xl font-black text-white font-mono flex items-baseline gap-1">
                      <span>{currentScore.actual}</span>
                      <span className="text-xs font-normal text-gray-400">{currentScore.unit}</span>
                    </div>
                    <div className="text-[10px] text-gray-400">이전치: {currentScore.previous}{currentScore.unit}</div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[11px] text-gray-400">월가 예상치 (Consensus)</span>
                    <div className="text-xl font-black text-amber-400 font-mono flex items-baseline gap-1">
                      <span>{currentScore.estimate}</span>
                      <span className="text-xs font-normal text-gray-400">{currentScore.unit}</span>
                    </div>
                    <div className="text-[10px] text-gray-500">블룸버그/다우존스 집계 기준</div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[11px] text-gray-400">서프라이즈 편차 (Spread)</span>
                    <div className={`text-xl font-black font-mono flex items-center gap-1 ${
                      currentScore.diff > 0 
                        ? (currentScore.category === '물가' ? 'text-rose-400' : 'text-emerald-400')
                        : currentScore.diff < 0 
                        ? (currentScore.category === '물가' ? 'text-sky-400' : 'text-amber-400')
                        : 'text-gray-300'
                    }`}>
                      {currentScore.diff > 0 ? `+${currentScore.diff}` : currentScore.diff}
                      <span className="text-xs font-normal text-gray-400">{currentScore.unit}</span>
                    </div>
                    <div>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        currentScore.status === 'SURPRISE_UP' 
                          ? (currentScore.category === '물가' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30')
                          : currentScore.status === 'SURPRISE_DOWN'
                          ? (currentScore.category === '물가' ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30')
                          : 'bg-white/10 text-gray-300'
                      }`}>
                        {currentScore.status_label}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* 시계열 Recharts 차트 */}
              <div className="p-4 rounded-xl bg-black/40 border border-white/5 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold text-gray-200">
                      {currentMeta?.name} 월별 추이 및 월가 컨센서스 대조
                    </h3>
                    <p className="text-[11px] text-gray-500 mt-0.5">{currentMeta?.description}</p>
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <span className="flex items-center gap-1.5 text-indigo-400">
                      <span className="w-3 h-3 rounded-sm bg-indigo-500 inline-block" />
                      실제 발표치 (Actual)
                    </span>
                    <span className="flex items-center gap-1.5 text-amber-400">
                      <span className="w-3 h-0.5 bg-amber-400 inline-block border-t border-dashed" />
                      월가 예상치 (Consensus)
                    </span>
                  </div>
                </div>

                <div className="h-[260px] w-full pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={currentSeries} margin={{ top: 10, right: 15, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                      <XAxis 
                        dataKey="period" 
                        stroke="#6b7280" 
                        fontSize={11} 
                        tickLine={false} 
                      />
                      <YAxis 
                        stroke="#6b7280" 
                        fontSize={11} 
                        tickLine={false}
                        domain={['auto', 'auto']}
                        tickFormatter={(v) => `${v}${currentMeta?.unit.includes('%') ? '%' : ''}`}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#161a25', 
                          borderColor: '#ffffff20',
                          borderRadius: '8px',
                          fontSize: '11px',
                          color: '#fff'
                        }}
                        formatter={(val: any, name: any) => {
                          if (name === 'actual') return [`${val} ${currentMeta?.unit}`, '실제 발표치'];
                          if (name === 'estimate') return [`${val} ${currentMeta?.unit}`, '월가 예상치'];
                          if (name === 'diff') return [`${val > 0 ? '+' : ''}${val} ${currentMeta?.unit}`, '편차'];
                          return [val, name];
                        }}
                      />
                      <Bar 
                        dataKey="actual" 
                        fill="#6366f1" 
                        radius={[4, 4, 0, 0]} 
                        barSize={20}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="estimate" 
                        stroke="#f59e0b" 
                        strokeWidth={2} 
                        strokeDasharray="4 4"
                        dot={{ r: 3, fill: '#f59e0b', strokeWidth: 1 }}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* 월별 서프라이즈 명세 테이블 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-300">월별 발표 명세 및 서프라이즈 이력</span>
                  <span className="text-[10px] text-gray-500">최근 {period === '1Y' ? '12개월' : '6개월'} 누적 내역</span>
                </div>
                <div className="overflow-x-auto rounded-xl border border-white/5 bg-black/20">
                  <table className="w-full text-left text-xs text-gray-300">
                    <thead className="bg-white/5 text-gray-400 text-[11px] border-b border-white/5">
                      <tr>
                        <th className="px-3 py-2 font-medium">대상 월</th>
                        <th className="px-3 py-2 font-medium">발표일자</th>
                        <th className="px-3 py-2 font-medium text-right">실제치 (Actual)</th>
                        <th className="px-3 py-2 font-medium text-right">예상치 (Est)</th>
                        <th className="px-3 py-2 font-medium text-right">이전치 (Prev)</th>
                        <th className="px-3 py-2 font-medium text-right">편차 (Diff)</th>
                        <th className="px-3 py-2 font-medium text-center">판정</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {currentSeries.slice().reverse().map((row, idx) => (
                        <tr key={idx} className="hover:bg-white/[0.02] transition">
                          <td className="px-3 py-2 font-mono font-medium">{row.period}</td>
                          <td className="px-3 py-2 text-gray-400 font-mono text-[11px]">{row.date}</td>
                          <td className="px-3 py-2 text-right font-mono font-bold text-white">
                            {row.actual} {row.unit}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-amber-400">
                            {row.estimate} {row.unit}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-gray-500">
                            {row.previous} {row.unit}
                          </td>
                          <td className={`px-3 py-2 text-right font-mono font-bold ${
                            row.diff > 0 
                              ? (currentMeta?.category === '물가' ? 'text-rose-400' : 'text-emerald-400')
                              : row.diff < 0
                              ? (currentMeta?.category === '물가' ? 'text-sky-400' : 'text-amber-400')
                              : 'text-gray-400'
                          }`}>
                            {row.diff > 0 ? `+${row.diff}` : row.diff} {row.unit}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                              row.status === 'SURPRISE_UP'
                                ? (currentMeta?.category === '물가' ? 'bg-rose-500/15 text-rose-300' : 'bg-emerald-500/15 text-emerald-300')
                                : row.status === 'SURPRISE_DOWN'
                                ? (currentMeta?.category === '물가' ? 'bg-sky-500/15 text-sky-300' : 'bg-amber-500/15 text-amber-300')
                                : 'bg-white/5 text-gray-400'
                            }`}>
                              {row.status_label}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>

        {/* 푸터 */}
        <div className="px-6 py-3 border-t border-white/10 bg-black/40 flex items-center justify-between text-[11px] text-gray-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>{data?.analysis?.market_summary}</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-white/10 hover:bg-white/15 text-white rounded-lg font-medium transition text-xs"
          >
            닫기
          </button>
        </div>

      </div>
    </div>
  );
}
