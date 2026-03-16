'use client'

import React, { useEffect, useState } from 'react'
import { Brain, RefreshCw, Sparkles, TrendingUp, AlertTriangle, Lightbulb, Search } from 'lucide-react'

interface InsightData {
  insight: string
  us_phase?: string
  kr_phase?: string
  analyzed_at: string
}

const getApiUrl = () => {
  if (typeof window === 'undefined') return 'http://localhost:8000'
  return (process.env.NEXT_PUBLIC_API_URL ||
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? 'http://localhost:8000'
      : 'https://etf-lens.onrender.com'))
}

const PHASE_COLOR: Record<string, string> = {
  '회복기': 'text-sky-400 bg-sky-500/10 border-sky-500/30',
  '확장기': 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
  '둔화기': 'text-orange-400 bg-orange-500/10 border-orange-500/30',
  '침체기': 'text-rose-400 bg-rose-500/10 border-rose-500/30',
}

function StrategyContent({ content }: { content: string }) {
  // Extract portfolio allocation line (📌 자산 배분 비중: ...)
  const allocationMatch = content.match(/📌[^\n]*비중[^\n]*주식[^\n]*/i)
  const allocationLine = allocationMatch ? allocationMatch[0].replace(/^📌\s*/, '') : null

  // Extract ETF sections by ▶ headers
  const etfSections: { title: string; color: string; items: string[] }[] = []
  const sectionDefs = [
    { key: '주식형', color: 'emerald' },
    { key: '채권형', color: 'sky' },
    { key: '현금', color: 'amber' },
  ]

  for (const def of sectionDefs) {
    const pat = new RegExp(`▶[^\\n]*${def.key}[^\\n]*\\n([\\s\\S]*?)(?=▶|$)`, 'i')
    const m = content.match(pat)
    if (m) {
      const lines = m[1].split('\n')
        .map(l => l.trim())
        .filter(l => l.startsWith('-') || l.match(/^\[\w/))
        .map(l => l.replace(/^-\s*/, '').replace(/\*\*/g, '').trim())
        .filter(Boolean)
      if (lines.length) etfSections.push({ title: m[0].split('\n')[0].replace(/^▶\s*/, ''), color: def.color, items: lines })
    }
  }

  // Fallback: raw text if no structured content found
  if (!allocationLine && !etfSections.length) {
    return <p className="text-sm text-gray-300 leading-relaxed pl-6 whitespace-pre-wrap">{content.replace(/\*\*/g, '')}</p>
  }

  const colorMap: Record<string, string> = {
    emerald: 'border-emerald-500/30 bg-emerald-500/5 text-emerald-300',
    sky: 'border-sky-500/30 bg-sky-500/5 text-sky-300',
    amber: 'border-amber-500/30 bg-amber-500/5 text-amber-300',
  }
  const dotMap: Record<string, string> = {
    emerald: 'bg-emerald-400',
    sky: 'bg-sky-400',
    amber: 'bg-amber-400',
  }

  return (
    <div className="pl-6 flex flex-col gap-3">
      {allocationLine && (
        <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5">
          <span className="text-base">📌</span>
          <span className="text-sm font-semibold text-white">{allocationLine}</span>
        </div>
      )}
      {etfSections.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-gray-500 font-semibold tracking-wide uppercase">🇰🇷 국내 ETF 추천</p>
          {etfSections.map(sec => (
            <div key={sec.title} className={`border rounded-xl p-3 ${colorMap[sec.color] ?? 'border-white/10 bg-white/5 text-gray-300'}`}>
              <p className="text-xs font-bold mb-2 opacity-80">▶ {sec.title}</p>
              <ul className="flex flex-col gap-1">
                {sec.items.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs leading-relaxed">
                    <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${dotMap[sec.color] ?? 'bg-gray-400'}`} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function InsightSection({ icon, title, content, isStrategy }: { icon: React.ReactNode; title: string; content: string; isStrategy?: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-sm font-bold text-white/90">{title}</span>
      </div>
      {isStrategy
        ? <StrategyContent content={content} />
        : <p className="text-sm text-gray-300 leading-relaxed pl-6 whitespace-pre-wrap">{content.replace(/\*\*/g, '')}</p>
      }
    </div>
  )
}

function parseInsight(text: string) {
  const sections: { key: string; icon: React.ReactNode; title: string; content: string; isStrategy?: boolean }[] = []
  const patterns = [
    { key: 'diagnosis', icon: <TrendingUp className="w-4 h-4 text-indigo-400" />, header: '📊 현재 시장 상황 진단' },
    { key: 'risk', icon: <AlertTriangle className="w-4 h-4 text-amber-400" />, header: '⚠️ 주요 리스크 요인' },
    { key: 'strategy', icon: <Lightbulb className="w-4 h-4 text-emerald-400" />, header: '💡 투자 전략 제언', isStrategy: true },
    { key: 'monitor', icon: <Search className="w-4 h-4 text-cyan-400" />, header: '🔍 핵심 모니터링 포인트' },
  ]

  let remaining = text
  for (let i = 0; i < patterns.length; i++) {
    const p = patterns[i]
    const next = patterns[i + 1]
    const headerPat = p.header.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const startIdx = remaining.search(new RegExp(headerPat, 'i'))
    if (startIdx === -1) continue

    const afterHeader = remaining.slice(startIdx + p.header.length).replace(/^\*\*/, '').replace(/^\n/, '')
    let content = afterHeader
    if (next) {
      const nextPat = next.header.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const endIdx = afterHeader.search(new RegExp(nextPat, 'i'))
      if (endIdx !== -1) content = afterHeader.slice(0, endIdx)
    }
    content = content.trim()
    sections.push({ ...p, title: p.header.replace(/^[📊⚠️💡🔍]\s*/, ''), content })
    remaining = remaining.slice(startIdx + p.header.length)
  }

  return sections
}

export default function AIInsight() {
  const [data, setData] = useState<InsightData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = async (forceRefresh = false) => {
    try {
      if (forceRefresh) {
        setRefreshing(true)
        await fetch(`${getApiUrl()}/api/v1/ai-insight/reset-cache`, { method: 'POST' })
      }
      setLoading(true)
      setError(null)
      const res = await fetch(`${getApiUrl()}/api/v1/ai-insight`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setData(json)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { load() }, [])

  const sections = data ? parseInsight(data.insight) : []

  return (
    <div className="w-full bg-gradient-to-br from-[#0f0f1a] to-[#161628] border border-indigo-500/20 rounded-3xl p-5 shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <Brain className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white">AI Insight</h2>
              <Sparkles className="w-4 h-4 text-purple-400" />
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              {data?.analyzed_at ? `분석 시각: ${data.analyzed_at}` : '전문가 AI 시장 인사이트'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Phase badges */}
          {data?.us_phase && (
            <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${PHASE_COLOR[data.us_phase] ?? 'text-gray-400 bg-gray-500/10 border-gray-500/20'}`}>
              🇺🇸 {data.us_phase}
            </span>
          )}
          {data?.kr_phase && (
            <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${PHASE_COLOR[data.kr_phase] ?? 'text-gray-400 bg-gray-500/10 border-gray-500/20'}`}>
              🇰🇷 {data.kr_phase}
            </span>
          )}
          <button
            onClick={() => load(true)}
            disabled={refreshing || loading}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white transition-all disabled:opacity-50"
            title="새로고침"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex flex-col gap-3 animate-pulse">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="flex flex-col gap-1.5">
              <div className="h-4 w-32 bg-white/10 rounded-lg" />
              <div className="h-3 w-full bg-white/5 rounded" />
              <div className="h-3 w-4/5 bg-white/5 rounded" />
            </div>
          ))}
          <p className="text-xs text-gray-500 text-center mt-2">AI가 시장 데이터를 분석 중입니다...</p>
        </div>
      ) : error ? (
        <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4 text-sm text-rose-300">
          ⚠️ 데이터 로드 실패: {error}
          <button onClick={() => load()} className="ml-3 underline hover:text-white">재시도</button>
        </div>
      ) : sections.length > 0 ? (
        <div className="flex flex-col gap-4 divide-y divide-white/5">
          {sections.map((s, i) => (
            <div key={s.key} className={i > 0 ? 'pt-4' : ''}>
              <InsightSection icon={s.icon} title={s.title} content={s.content} isStrategy={s.isStrategy} />
            </div>
          ))}
        </div>
      ) : (
        // 파싱 실패 시 raw 텍스트로 표시
        <div className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">
          {data?.insight}
        </div>
      )}

      {/* Footer */}
      <div className="mt-4 pt-3 border-t border-white/5 flex items-center gap-1.5">
        <Sparkles className="w-3 h-3 text-purple-400" />
        <p className="text-xs text-gray-600">
          Gemini 2.5 Flash · 매크로 지표 기반 분석 · 투자 조언 아님
        </p>
      </div>
    </div>
  )
}
