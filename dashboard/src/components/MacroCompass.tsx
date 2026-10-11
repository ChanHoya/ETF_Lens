'use client'

import React, { useEffect, useState } from 'react'
import ChartLoadingPlaceholder from './ChartLoadingPlaceholder'

// ─── Types ──────────────────────────────────────────────────────────────────
interface Indicator { value: number | null; updated_at: string | null; label?: string }
interface SectorWeight { sector: string; weight: '비중확대' | '중립' | '비중축소'; score: number }
interface EtfReco { ticker: string; name: string; reason: string }

interface MarketCompass {
  phase: string
  phase_en: 'recovery' | 'expansion' | 'slowdown' | 'recession'
  confidence: number
  explanation: string
  sector_weights: SectorWeight[]
  etf_recommendations: EtfReco[]
  indicators: Record<string, Indicator>
  analyzed_at: string
}

interface CompassData { us: MarketCompass; kr: MarketCompass }

// ─── Helpers ─────────────────────────────────────────────────────────────────
const PHASE_CONFIG = {
  recovery:  { color: '#38bdf8', bg: 'rgba(56,189,248,0.15)', label: '회복기', angle: 315 },
  expansion: { color: '#4ade80', bg: 'rgba(74,222,128,0.15)', label: '확장기', angle:  45 },
  slowdown:  { color: '#fb923c', bg: 'rgba(251,146,60,0.15)',  label: '둔화기', angle: 135 },
  recession: { color: '#f87171', bg: 'rgba(248,113,113,0.15)', label: '침체기', angle: 225 },
}

const INDICATOR_LABELS: Record<string, string> = {
  ism:            'ISM 제조업 PMI',
  pce:            'Core PCE',
  unemployment:   '실업률',
  fed_rate:       'Fed 기준금리',
  fgi:            'FGI (VIX 기반)',
  sp500_momentum: 'S&P500 모멘텀 (3M)',
  cli:            'OECD CLI (한국)',
  export_growth:  '수출 증가율',
  bok_rate:       'BOK 기준금리',
  kospi_momentum: 'KOSPI 모멘텀 (3M)',
  usd_krw:        'USD/KRW',
}

const INDICATOR_UNITS: Record<string, string> = {
  ism: '', pce: '%', unemployment: '%', fed_rate: '%',
  fgi: '', sp500_momentum: '%', cli: '', export_growth: '%',
  bok_rate: '%', kospi_momentum: '%', usd_krw: '원',
}

const WEIGHT_COLOR = {
  '비중확대': '#4ade80',
  '중립':     '#94a3b8',
  '비중축소': '#f87171',
}

const getApiUrl = () => {
  // SSR 환경에서는 기본값, 클라이언트에서는 apiConfig의 API_BASE 사용
  if (typeof window === 'undefined') return 'http://localhost:8000'
  return (process.env.NEXT_PUBLIC_API_URL ||
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? 'http://localhost:8000'
      : 'https://etf-lens.onrender.com'))
}

// ─── SVG Compass Dial ────────────────────────────────────────────────────────
function CompassDial({ phase_en, confidence, phase }: {
  phase_en: keyof typeof PHASE_CONFIG
  confidence: number
  phase: string
}) {
  const cfg   = PHASE_CONFIG[phase_en]
  const SIZE  = 200
  const CX    = SIZE / 2
  const CY    = SIZE / 2
  const R     = 80
  const INNER = 45

  // Quadrant arcs: Recovery=315°(top-left), Expansion=45°(top-right),
  //                Slowdown=135°(bottom-right), Recession=225°(bottom-left)
  const quad = [
    { phase: 'recovery',  color: '#38bdf8', startDeg: 225, endDeg: 315, labelDeg: 270 },
    { phase: 'expansion', color: '#4ade80', startDeg: 315, endDeg:  45, labelDeg:   0 },
    { phase: 'slowdown',  color: '#fb923c', startDeg:  45, endDeg: 135, labelDeg:  90 },
    { phase: 'recession', color: '#f87171', startDeg: 135, endDeg: 225, labelDeg: 180 },
  ]

  function arcPath(startDeg: number, endDeg: number, r: number, inner: number) {
    const toRad = (d: number) => ((d - 90) * Math.PI) / 180
    const s = toRad(startDeg), e = toRad(endDeg)
    const x1 = CX + r * Math.cos(s), y1 = CY + r * Math.sin(s)
    const x2 = CX + r * Math.cos(e), y2 = CY + r * Math.sin(e)
    const xi1 = CX + inner * Math.cos(e), yi1 = CY + inner * Math.sin(e)
    const xi2 = CX + inner * Math.cos(s), yi2 = CY + inner * Math.sin(s)
    let large = endDeg - startDeg
    if (large < 0) large += 360
    const la = large > 180 ? 1 : 0
    return `M ${x1} ${y1} A ${r} ${r} 0 ${la} 1 ${x2} ${y2}
            L ${xi1} ${yi1} A ${inner} ${inner} 0 ${la} 0 ${xi2} ${yi2} Z`
  }

  // needle angle: map phase to degree
  const needleAngle = cfg.angle
  const needleRad = ((needleAngle - 90) * Math.PI) / 180
  const nx1 = CX + (INNER - 5) * Math.cos(needleRad)
  const ny1 = CY + (INNER - 5) * Math.sin(needleRad)
  const nx2 = CX - 12 * Math.cos(needleRad)
  const ny2 = CY - 12 * Math.sin(needleRad)
  const perp = needleRad + Math.PI / 2
  const baseHalf = 6

  return (
    <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
      {/* Quadrant arcs */}
      {quad.map((q) => (
        <path
          key={q.phase}
          d={arcPath(q.startDeg, q.endDeg, R, INNER)}
          fill={phase_en === q.phase ? q.color : q.color + '44'}
          className="stroke-slate-200 dark:stroke-slate-900"
          strokeWidth={1.5}
        />
      ))}

      {/* Quadrant labels */}
      {quad.map((q) => {
        const rad = ((q.labelDeg - 90) * Math.PI) / 180
        const lr = (R + INNER) / 2
        const lx = CX + lr * Math.cos(rad)
        const ly = CY + lr * Math.sin(rad)
        const cfg2 = PHASE_CONFIG[q.phase as keyof typeof PHASE_CONFIG]
        return (
          <text
            key={q.phase}
            x={lx}
            y={ly}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={q.phase === phase_en ? '10' : '9'}
            fontWeight={q.phase === phase_en ? 'bold' : 'normal'}
            fill={q.phase === phase_en ? q.color : '#64748b'}
          >
            {cfg2.label}
          </text>
        )
      })}

      {/* Needle */}
      <polygon
        points={`
          ${nx1},${ny1}
          ${CX + baseHalf * Math.cos(perp)},${CY + baseHalf * Math.sin(perp)}
          ${nx2},${ny2}
          ${CX - baseHalf * Math.cos(perp)},${CY - baseHalf * Math.sin(perp)}
        `}
        fill={cfg.color}
        className="stroke-slate-200 dark:stroke-slate-900"
        strokeWidth={1}
        style={{ filter: `drop-shadow(0 0 5px ${cfg.color}88)` }}
      />

      {/* Center circle */}
      <circle cx={CX} cy={CY} r={10} className="fill-slate-100 dark:fill-slate-800" stroke={cfg.color} strokeWidth={2} />

      {/* Phase text in center */}
      <text x={CX} y={CY + 24} textAnchor="middle" fontSize="12" fontWeight="bold" fill={cfg.color}>
        {phase}
      </text>
      <text x={CX} y={CY + 37} textAnchor="middle" fontSize="10" className="fill-slate-500 dark:fill-slate-400">
        확신도 {confidence}%
      </text>
    </svg>
  )
}

// ─── Indicator Card ──────────────────────────────────────────────────────────
function IndicatorCard({ indicators }: { indicators: Record<string, Indicator> }) {
  return (
    <div className="flex flex-col gap-1.5">
      {Object.entries(indicators).map(([key, ind]) => (
        <div
          key={key}
          className="flex justify-between items-center px-3 py-2 rounded-lg bg-black/[0.03] dark:bg-white/[0.04] border border-black/5 dark:border-white/5 hover:bg-black/[0.06] dark:hover:bg-white/[0.07] transition-colors"
        >
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {(ind as Indicator).label ?? INDICATOR_LABELS[key] ?? key}
          </span>
          <div className="flex flex-col items-end gap-0.5">
            <span className="text-base font-semibold text-gray-900 dark:text-white">
              {ind.value != null
                ? `${key === 'usd_krw' ? ind.value.toLocaleString() : ind.value.toFixed(key.includes('momentum') || key === 'pce' || key === 'fed_rate' || key === 'bok_rate' || key === 'export_growth' || key === 'unemployment' ? 1 : 1)}${INDICATOR_UNITS[key] ?? ''}`
                : 'N/A'}
            </span>
            {ind.updated_at && (
              <span className="text-[11px] text-gray-500 dark:text-gray-400">
                최신: {ind.updated_at}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Sector Heat Map ─────────────────────────────────────────────────────────
function SectorHeatmap({ sectors }: { sectors: SectorWeight[] }) {
  return (
    <div className="flex flex-col gap-1.5">
      {sectors.map((s) => (
        <div
          key={s.sector}
          className="flex justify-between items-center px-3 py-2 rounded-lg bg-black/[0.03] dark:bg-white/[0.04] border border-black/5 dark:border-white/5 hover:bg-black/[0.06] dark:hover:bg-white/[0.07] transition-colors"
        >
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{s.sector}</span>
          <span
            style={{
              background: WEIGHT_COLOR[s.weight] + '25',
              color: WEIGHT_COLOR[s.weight],
              border: `1px solid ${WEIGHT_COLOR[s.weight]}55`,
            }}
            className="text-xs font-bold px-2.5 py-1 rounded-full"
          >
            {s.weight}
          </span>
        </div>
      ))}
    </div>
  )
}

// ─── ETF Recommendation ──────────────────────────────────────────────────────
function EtfList({ etfs, phase_en }: { etfs: EtfReco[]; phase_en: string }) {
  const color = PHASE_CONFIG[phase_en as keyof typeof PHASE_CONFIG]?.color ?? '#38bdf8'
  return (
    <div className="flex flex-col gap-2">
      {etfs.map((e, i) => (
        <div
          key={e.ticker}
          className="flex gap-3 items-start px-3 py-2.5 rounded-lg bg-black/[0.03] dark:bg-white/[0.04] border border-black/5 dark:border-white/5 hover:bg-black/[0.06] dark:hover:bg-white/[0.07] transition-colors"
        >
          <span
            style={{ color }}
            className="text-sm font-bold min-w-[20px] pt-0.5"
          >
            {i + 1}
          </span>
          <div className="flex-1">
            <div 
              onClick={() => {
                const event = new CustomEvent('open_etf_detail', { detail: { code: e.ticker } });
                window.dispatchEvent(event);
              }}
              className="flex gap-2 items-baseline flex-wrap cursor-pointer group/etf-title hover:opacity-80"
              title="클릭하여 상세 정보 보기"
            >
              <span className="text-sm font-bold text-gray-900 dark:text-white group-hover/etf-title:text-indigo-600 dark:group-hover/etf-title:text-indigo-400 transition-colors">
                {e.ticker}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400 group-hover/etf-title:text-indigo-500 dark:group-hover/etf-title:text-indigo-300 transition-colors">
                {e.name}
              </span>
            </div>
            <span className="text-xs text-gray-600 dark:text-gray-400 mt-1 block leading-relaxed">
              {e.reason}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Market Panel ────────────────────────────────────────────────────────────
function MarketPanel({ data, flag, market }: {
  data: MarketCompass
  flag: string
  market: string
}) {
  const [tab, setTab] = useState<'indicators' | 'sectors' | 'etfs'>('indicators')
  const cfg = PHASE_CONFIG[data.phase_en]

  return (
    <div
      className="flex-1 min-w-0 bg-white dark:bg-slate-900/90 rounded-2xl border overflow-hidden shadow-sm dark:shadow-[0_0_24px_rgba(0,0,0,0.3)] transition-colors"
      style={{
        borderColor: `${cfg.color}44`,
        boxShadow: `0 0 24px ${cfg.color}15`,
      }}
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-black/5 dark:border-white/10 flex items-center justify-between">
        <span className="text-lg font-bold text-gray-900 dark:text-white">
          {flag} {market}
        </span>
        <span
          style={{
            background: cfg.bg,
            color: cfg.color,
            border: `1px solid ${cfg.color}55`,
          }}
          className="text-xs font-semibold px-3 py-1 rounded-full"
        >
          {data.phase} · {data.confidence}%
        </span>
      </div>

      {/* Compass + explanation */}
      <div className="flex flex-col-reverse md:flex-row gap-4 p-5 items-start">
        {/* 설명글 - 모바일에서 먼저 표시(col-reverse), PC에서 다이얼 우측 */}
        <div
          className="flex-1 text-sm md:text-base leading-relaxed text-gray-700 dark:text-gray-300 order-1 md:order-2 pl-3 pt-1 border-l-2"
          style={{ borderColor: `${cfg.color}55` }}
        >
          {data.explanation}
          <div className="mt-2 text-xs text-gray-400 dark:text-gray-500">
            분석 시각: {data.analyzed_at}
          </div>
        </div>
        {/* 다이얼 - 모바일에서 아래(col-reverse에서 나중에), PC에서 좌측 */}
        <div className="shrink-0 order-2 md:order-1 self-center md:self-start">
          <CompassDial phase_en={data.phase_en} confidence={data.confidence} phase={data.phase} />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mx-5 bg-black/[0.04] dark:bg-black/30 p-1 rounded-xl border border-black/5 dark:border-white/5">
        {(['indicators', 'sectors', 'etfs'] as const).map((t) => {
          const labels = { indicators: '📊 참고지표', sectors: '🗺 섹터 비중', etfs: '💡 ETF 추천' }
          const isActive = tab === t
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                background: isActive ? cfg.color + '25' : 'transparent',
                color: isActive ? cfg.color : undefined,
                borderColor: isActive ? cfg.color + '55' : 'transparent',
              }}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all border ${
                isActive ? 'shadow-sm' : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white border-transparent'
              }`}
            >
              {labels[t]}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      <div className="p-5">
        {tab === 'indicators' && <IndicatorCard indicators={data.indicators} />}
        {tab === 'sectors' && <SectorHeatmap sectors={data.sector_weights} />}
        {tab === 'etfs' && <EtfList etfs={data.etf_recommendations} phase_en={data.phase_en} />}
      </div>
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function MacroCompass() {
  const [data, setData] = useState<CompassData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const [autoRetryIn, setAutoRetryIn] = useState<number | null>(null)  // 자동 재시도 카운트다운
  const MAX_AUTO_RETRY = 3

  useEffect(() => {
    const apiUrl = getApiUrl()
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 120_000)  // 120초 타임아웃

    fetch(`${apiUrl}/api/v1/macro-compass`, { signal: ctrl.signal })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((d) => { setData(d); setAutoRetryIn(null) })
      .catch((e) => {
        const msg = e?.name === 'AbortError' ? '120초 초과 — 서버 응답 없음.' : String(e)
        setError(msg)

        // 자동 재시도: MAX_AUTO_RETRY 이하이면 5초 카운트다운 후 재시도
        if (retryCount < MAX_AUTO_RETRY) {
          let countdown = 5
          setAutoRetryIn(countdown)
          const tick = setInterval(() => {
            countdown -= 1
            if (countdown <= 0) {
              clearInterval(tick)
              setAutoRetryIn(null)
              setError(null)
              setLoading(true)
              setRetryCount(c => c + 1)
            } else {
              setAutoRetryIn(countdown)
            }
          }, 1000)
        } else {
          setAutoRetryIn(null)  // 최대 횟수 초과 → 수동 재시도만
        }
      })
      .finally(() => { clearTimeout(timer); setLoading(false) })

    return () => { ctrl.abort(); clearTimeout(timer) }
  }, [retryCount])

  return (
    <div className="w-full mt-8">
      {/* Title row */}
      <div className="flex items-center gap-2.5 mb-4">
        <span className="text-2xl">🧭</span>
        <div>
          <h2 className="m-0 text-xl font-bold tracking-tight text-gray-900 dark:text-white">
            AI 매크로 로테이션 나침반
          </h2>
          <p className="m-0 text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            경기 사이클 단계별 섹터 로테이션 전략 · 각 지표 최신 반영일 표시
          </p>
        </div>
      </div>

      {loading && (
        <ChartLoadingPlaceholder
          height={200}
          message="지표 데이터 수집 중"
          subMessage="첫 로드 30~60초 소요될 수 있습니다"
        />
      )}

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-3 flex-wrap">
          <span>⚠️ 데이터 로드 실패: {error}</span>
          {autoRetryIn !== null ? (
            <span className="px-3 py-1 rounded-md text-xs bg-red-500/15 border border-red-500/50 text-red-300">
              🔄 {autoRetryIn}초 후 자동 재시도... ({retryCount}/{MAX_AUTO_RETRY})
            </span>
          ) : (
            <button
              onClick={() => { setError(null); setLoading(true); setRetryCount(c => c + 1) }}
              className="px-3 py-1 rounded-md text-xs bg-red-500/20 border border-red-500/50 text-red-300 cursor-pointer hover:bg-red-500/30 transition-colors"
            >
              🔄 수동 재시도
            </button>
          )}
        </div>
      )}

      {data && (
        <div className="flex flex-col lg:flex-row gap-4">
          <MarketPanel data={data.us} flag="🇺🇸" market="미국 시장" />
          <MarketPanel data={data.kr} flag="🇰🇷" market="한국 시장" />
        </div>
      )}

      {/* Disclaimer */}
      {data && (
        <p className="mt-3 text-xs text-gray-400 dark:text-gray-500 text-right">
          * AI 분석 결과는 참고용이며 투자 결정의 근거로 사용 금지 · 24시간 캐시
        </p>
      )}
    </div>
  )
}
