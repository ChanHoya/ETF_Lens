'use client'

import React, { useEffect, useState } from 'react'
import ChartLoadingPlaceholder from './ChartLoadingPlaceholder'
import { getPrefetchedData } from '../lib/monitorPrefetch'

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
          stroke="#0f172a"
          strokeWidth={1.5}
        />
      ))}

      {/* Quadrant labels */}
      {quad.map((q) => {
        const rad = ((q.labelDeg - 90) * Math.PI) / 180
        const lr = (R + INNER) / 2 + (q.phase === 'expansion' || q.phase === 'recession' ? 0 : 0)
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
            fill={q.phase === phase_en ? q.color : '#94a3b8'}
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
        stroke="#0f172a"
        strokeWidth={1}
        style={{ filter: `drop-shadow(0 0 5px ${cfg.color}88)` }}
      />

      {/* Center circle */}
      <circle cx={CX} cy={CY} r={10} fill="#1e293b" stroke={cfg.color} strokeWidth={2} />

      {/* Phase text in center */}
      <text x={CX} y={CY + 24} textAnchor="middle" fontSize="12" fontWeight="bold" fill={cfg.color}>
        {phase}
      </text>
      <text x={CX} y={CY + 37} textAnchor="middle" fontSize="10" fill="#94a3b8">
        확신도 {confidence}%
      </text>
    </svg>
  )
}

// ─── Indicator Card ──────────────────────────────────────────────────────────
function IndicatorCard({ indicators }: { indicators: Record<string, Indicator> }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {Object.entries(indicators).map(([key, ind]) => (
        <div key={key} style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '6px 10px', borderRadius: 6,
          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
        }}>
          <span style={{ fontSize: 15, color: '#cbd5e1' }}>{(ind as Indicator).label ?? INDICATOR_LABELS[key] ?? key}</span>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
            <span style={{ fontSize: 16, fontWeight: 600, color: '#f1f5f9' }}>
              {ind.value != null
                ? `${key === 'usd_krw' ? ind.value.toLocaleString() : ind.value.toFixed(key.includes('momentum') || key === 'pce' || key === 'fed_rate' || key === 'bok_rate' || key === 'export_growth' || key === 'unemployment' ? 1 : 1)}${INDICATOR_UNITS[key] ?? ''}`
                : 'N/A'}
            </span>
            {ind.updated_at && (
              <span style={{ fontSize: 11, color: '#64748b' }}>최신: {ind.updated_at}</span>
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      {sectors.map((s) => (
        <div key={s.sector} style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '5px 10px', borderRadius: 6,
          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
        }}>
          <span style={{ fontSize: 14, color: '#cbd5e1' }}>{s.sector}</span>
          <span style={{
            fontSize: 13, fontWeight: 600, padding: '2px 8px', borderRadius: 12,
            background: WEIGHT_COLOR[s.weight] + '25',
            color: WEIGHT_COLOR[s.weight],
            border: `1px solid ${WEIGHT_COLOR[s.weight]}55`,
          }}>
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {etfs.map((e, i) => (
        <div key={e.ticker} style={{
          display: 'flex', gap: 10, alignItems: 'flex-start',
          padding: '8px 10px', borderRadius: 6,
          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
        }}>
          <span style={{
            fontSize: 13, fontWeight: 700, color: color,
            minWidth: 20, paddingTop: 1,
          }}>{i + 1}</span>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9' }}>{e.ticker}</span>
              <span style={{ fontSize: 13, color: '#94a3b8' }}>{e.name}</span>
            </div>
            <span style={{ fontSize: 12, color: '#64748b', marginTop: 2, display: 'block' }}>
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
    <div style={{
      flex: 1, minWidth: 0,
      background: 'rgba(15,23,42,0.85)',
      borderRadius: 16,
      border: `1px solid ${cfg.color}44`,
      boxShadow: `0 0 24px ${cfg.color}22`,
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 18px 10px',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9' }}>
          {flag} {market}
        </span>
        <span style={{
          fontSize: 14, padding: '3px 10px', borderRadius: 99,
          background: cfg.bg, color: cfg.color,
          border: `1px solid ${cfg.color}55`, fontWeight: 600,
        }}>
          {data.phase} · {data.confidence}%
        </span>
      </div>

      {/* Compass + explanation */}
      <div className="flex flex-col-reverse md:flex-row gap-3 px-[18px] pt-[14px] items-start">
        {/* 설명글 - 모바일에서 먼저 표시(col-reverse), PC에서 다이얼 우측 */}
        <div
          style={{
            flex: 1,
            fontSize: 16,
            lineHeight: 1.65,
            color: '#94a3b8',
            borderLeft: `2px solid ${cfg.color}44`,
            paddingLeft: 12,
            paddingTop: 4,
          }}
          className="order-1 md:order-2"
        >
          {data.explanation}
          <div style={{ marginTop: 8, fontSize: 13, color: '#475569' }}>
            분석 시각: {data.analyzed_at}
          </div>
        </div>
        {/* 다이얼 - 모바일에서 아래(col-reverse에서 나중에), PC에서 좌측 */}
        <div style={{ flexShrink: 0 }} className="order-2 md:order-1">
          <CompassDial phase_en={data.phase_en} confidence={data.confidence} phase={data.phase} />
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex', gap: 0, margin: '14px 18px 0',
        background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: 3,
      }}>
        {(['indicators', 'sectors', 'etfs'] as const).map((t) => {
          const labels = { indicators: '📊 참고지표', sectors: '🗺 섹터 비중', etfs: '💡 ETF 추천' }
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                flex: 1, padding: '6px 0', fontSize: 15, fontWeight: tab === t ? 700 : 400,
                borderRadius: 6, border: 'none', cursor: 'pointer', transition: 'all .15s',
                background: tab === t ? cfg.color + '33' : 'transparent',
                color: tab === t ? cfg.color : '#64748b',
              }}
            >
              {labels[t]}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      <div style={{ padding: '12px 18px 18px' }}>
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

    // 프리페치 캐시 체크: hit 시 즉시 렌더, miss 시 일반 fetch
    const macroUrl = `${apiUrl}/api/v1/macro-compass`
    const cached = getPrefetchedData<CompassData>(macroUrl)
    if (cached) {
      setData(cached)
      setLoading(false)
      clearTimeout(timer)
      return
    }

    fetch(macroUrl, { signal: ctrl.signal })
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
    <div style={{ width: '100%', marginTop: 32 }}>
      {/* Title row */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18,
      }}>
        <span style={{ fontSize: 22 }}>🧭</span>
        <div>
          <h2 style={{
            margin: 0, fontSize: 21, fontWeight: 700, color: '#f1f5f9',
            letterSpacing: '-0.3px',
          }}>
            AI 매크로 로테이션 나침반
          </h2>
          <p style={{ margin: 0, fontSize: 14, color: '#64748b', marginTop: 2 }}>
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
        <div style={{
          padding: 16, borderRadius: 10, background: 'rgba(248,113,113,0.1)',
          border: '1px solid rgba(248,113,113,0.3)', color: '#fca5a5', fontSize: 13,
          display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
        }}>
          <span>⚠️ 데이터 로드 실패: {error}</span>
          {autoRetryIn !== null ? (
            <span style={{
              padding: '4px 12px', borderRadius: 6, fontSize: 12,
              background: 'rgba(248,113,113,0.15)', border: '1px solid #f87171',
              color: '#fca5a5',
            }}>
              🔄 {autoRetryIn}초 후 자동 재시도... ({retryCount}/{MAX_AUTO_RETRY})
            </span>
          ) : (
            <button
              onClick={() => { setError(null); setLoading(true); setRetryCount(c => c + 1) }}
              style={{
                padding: '4px 12px', borderRadius: 6, fontSize: 12,
                background: 'rgba(248,113,113,0.2)', border: '1px solid #f87171',
                color: '#fca5a5', cursor: 'pointer',
              }}
            >
              🔄 수동 재시도
            </button>
          )}
        </div>
      )}

      {data && (
        <div className="flex flex-col lg:flex-row gap-[18px]">
          <MarketPanel data={data.us} flag="🇺🇸" market="미국 시장" />
          <MarketPanel data={data.kr} flag="🇰🇷" market="한국 시장" />
        </div>
      )}

      {/* Disclaimer */}
      {data && (
        <p style={{
          marginTop: 12, fontSize: 12, color: '#334155', textAlign: 'right',
        }}>
          * AI 분석 결과는 참고용이며 투자 결정의 근거로 사용 금지 · 24시간 캐시
        </p>
      )}
    </div>
  )
}
