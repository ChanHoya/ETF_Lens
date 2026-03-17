'use client'

import React, { useEffect, useState } from 'react'
import { Brain, RefreshCw, Sparkles, TrendingUp, AlertTriangle, Lightbulb, Search, Star } from 'lucide-react'
import { useFavorites } from '@/hooks/useFavorites'

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

function StrategyContent({ content, onSaveToFavorites }: { content: string; onSaveToFavorites?: (items: { code: string; name: string }[]) => void }) {
  const allocationMatch = content.match(/📌[^\n]*비중[^\n]*주식[^\n]*/i)
  const allocationLine = allocationMatch ? allocationMatch[0].replace(/^📌\s*/, '') : null

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

  // ETF 코드+이름 파싱 - 영숫자 4~7자 코드 허용 (0091C0, 495550 등)
  const parsedEtfs: { code: string; name: string }[] = []
  for (const sec of etfSections) {
    for (const item of sec.items) {
      // 앞부분 영숫자(코드) + 공백 + 이름 형식 매칭
      const codeMatch = item.match(/^([A-Z0-9]{4,7})\s+/i)
      if (codeMatch) {
        const code = codeMatch[1].toUpperCase()
        // 코드 제거 후 콜론/괄호 앞까지를 이름으로 추출
        const afterCode = item.slice(codeMatch[0].length)
        const name = afterCode.split(/\s*[:;\(]/)[0].trim()
        if (code && name && !parsedEtfs.some(e => e.code === code)) {
          parsedEtfs.push({ code, name })
        }
      }
    }
  }
  // fallback: 파싱된 코드가 없어도 etfSections 항목 수로 대체
  const favItems = parsedEtfs.length > 0
    ? parsedEtfs
    : etfSections.flatMap(sec => sec.items.map(item => ({ code: item.slice(0, 20), name: item.slice(0, 30) })))


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
          <span className="text-lg">📌</span>
          <span className="text-[15px] font-semibold text-white">{allocationLine}</span>
        </div>
      )}
      {etfSections.length > 0 && (
        <div className="flex flex-col gap-3">
          {etfSections.map(sec => (
            <div key={sec.title}>
              <p className={`text-[13px] font-bold mb-1.5 opacity-80 ${
                sec.color === 'emerald' ? 'text-emerald-400' :
                sec.color === 'sky' ? 'text-sky-400' : 'text-amber-400'
              }`}>▶ {sec.title}</p>
              <div className={`border rounded-xl p-3 ${colorMap[sec.color] ?? 'border-white/10 bg-white/5 text-gray-300'}`}>
                <ul className="flex flex-col gap-1">
                  {sec.items.map((item, i) => {
                      const parenMatch = item.match(/^(.*?)\s*(\([^)]{4,120}\))\s*$/)
                      const mainText = parenMatch ? parenMatch[1].trim() : item
                      const quantReason = parenMatch ? parenMatch[2] : null
                      return (
                        <li key={i} className="flex items-start gap-2 text-[14px] leading-relaxed">
                          <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${dotMap[sec.color] ?? 'bg-gray-400'}`} />
                          <span className="flex-1">
                            {mainText}
                            {quantReason && (
                              <span className="ml-1.5 inline-block text-[10px] font-semibold text-yellow-300/80 bg-yellow-400/10 border border-yellow-400/20 rounded px-1.5 py-0.5 leading-tight">
                                {quantReason}
                              </span>
                            )}
                          </span>
                        </li>
                      )
                    })}
                </ul>
              </div>
            </div>
          ))}
        </div>
      )}
      {/* 즐겨찾기 저장 버튼 */}
      {onSaveToFavorites && favItems.length > 0 && (
        <button
          onClick={() => onSaveToFavorites(favItems)}
          className="mt-1 ml-auto flex items-center gap-2 text-[13px] font-semibold text-yellow-300 hover:text-yellow-100 bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/30 hover:border-yellow-400/60 px-4 py-2 rounded-xl transition-all duration-200 shadow-sm"
        >
          <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
          즐겨찾기에 저장 ({favItems.length}개)
        </button>
      )}
    </div>
  )
}

function InsightSection({ icon, title, content, isStrategy, onSaveToFavorites }: {
  icon: React.ReactNode
  title: string
  content: string
  isStrategy?: boolean
  onSaveToFavorites?: (items: { code: string; name: string }[]) => void
}) {
  return (
    <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2 pb-2 border-b border-white/10">
        {icon}
        <span className="text-[16px] font-bold text-white/90">{title}</span>
      </div>
      {isStrategy
        ? <StrategyContent content={content} onSaveToFavorites={onSaveToFavorites} />
        : <p className="text-[14px] text-gray-300 leading-relaxed whitespace-pre-wrap">{content.replace(/\*\*/g, '')}</p>
      }
    </div>
  )
}

function parseInsight(text: string) {
  const sections: { key: string; icon: React.ReactNode; title: string; content: string; isStrategy?: boolean }[] = []
  const patterns = [
    { key: 'diagnosis', icon: <TrendingUp className="w-4 h-4 text-indigo-400" />, header: '📊 현재 시장 상황 진단', displayTitle: '현재 시장 상황 진단' },
    { key: 'risk', icon: <AlertTriangle className="w-4 h-4 text-amber-400" />, header: '⚠️ 주요 리스크 요인', displayTitle: '주요 리스크 요인' },
    { key: 'strategy', icon: <Lightbulb className="w-4 h-4 text-emerald-400" />, header: '💡 투자 전략 제언', displayTitle: '투자전략 및 국내 ETF 추천', isStrategy: true },
    { key: 'monitor', icon: <Search className="w-4 h-4 text-cyan-400" />, header: '🔍 핵심 모니터링 포인트', displayTitle: '핵심 모니터링 포인트' },
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
    sections.push({ ...p, title: p.displayTitle, content })
    remaining = remaining.slice(startIdx + p.header.length)

  }

  return sections
}

export default function AIInsight() {
  const [data, setData] = useState<InsightData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const { addGroupWithItems } = useFavorites()

  // YYMMDD추천 형식 그룹명 생성
  const getTodayGroupName = () => {
    const d = new Date()
    const yy = String(d.getFullYear()).slice(2)
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return `${yy}${mm}${dd}추천`
  }

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const handleSaveToFavorites = (items: { code: string; name: string }[]) => {
    const groupName = getTodayGroupName()
    addGroupWithItems(groupName, items)
    showToast(`⭐ '${groupName}' 그룹에 ${items.length}개 ETF 저장됨`)
  }

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
    <div className="w-full">
      {/* ── 섹션 타이틀 (카드 바깥, MacroCompass 제목과 동일 레벨) ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30 shrink-0">
          <Brain className="w-5 h-5 text-white" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h2 style={{ margin: 0, fontSize: 21, fontWeight: 700, color: '#f1f5f9', letterSpacing: '-0.3px' }}>
              AI Insight
            </h2>
            <Sparkles className="w-4 h-4 text-purple-400" />
          </div>
          <p style={{ margin: 0, fontSize: 14, color: '#64748b', marginTop: 2 }}>
            {data?.analyzed_at ? `분석 시각: ${data.analyzed_at}` : '매크로 지표 기반 전문가 AI 인사이트'}
          </p>
        </div>
        {/* 위상 뱃지 + 새로고침 */}
        <div className="ml-auto flex items-center gap-2">
          {data?.us_phase && (
            <span className={`text-[13px] px-2 py-0.5 rounded-full border font-semibold ${PHASE_COLOR[data.us_phase] ?? 'text-gray-400 bg-gray-500/10 border-gray-500/20'}`}>
              🇺🇸 {data.us_phase}
            </span>
          )}
          {data?.kr_phase && (
            <span className={`text-[13px] px-2 py-0.5 rounded-full border font-semibold ${PHASE_COLOR[data.kr_phase] ?? 'text-gray-400 bg-gray-500/10 border-gray-500/20'}`}>
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

      {/* ── 섹션 카드 컨테이너 ── */}
      <div className="w-full bg-gradient-to-br from-[#0f0f1a] to-[#161628] border border-indigo-500/20 rounded-3xl p-5 shadow-xl">
        {loading ? (
          <div className="flex flex-col gap-3 animate-pulse">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="flex flex-col gap-1.5">
                <div className="h-4 w-32 bg-white/10 rounded-lg" />
                <div className="h-3 w-full bg-white/5 rounded" />
                <div className="h-3 w-4/5 bg-white/5 rounded" />
              </div>
            ))}
            <p className="text-[13px] text-gray-500 text-center mt-2">AI가 시장 데이터를 분석 중입니다...</p>
          </div>
        ) : error ? (
          <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4 text-[14px] text-rose-300">
            ⚠️ 데이터 로드 실패: {error}
            <button onClick={() => load()} className="ml-3 underline hover:text-white">재시도</button>
          </div>
        ) : sections.length > 0 ? (
          <div className="flex flex-col gap-3">
            {sections.map((s) => (
              <InsightSection
                key={s.key}
                icon={s.icon}
                title={s.title}
                content={s.content}
                isStrategy={s.isStrategy}
                onSaveToFavorites={s.isStrategy ? handleSaveToFavorites : undefined}
              />
            ))}
          </div>
        ) : (
          <div className="text-[14px] text-gray-300 leading-relaxed whitespace-pre-wrap">
            {data?.insight}
          </div>
        )}

        {/* Footer */}
        <div className="mt-4 pt-3 border-t border-white/5 flex items-center gap-1.5">
          <Sparkles className="w-3 h-3 text-purple-400" />
          <p className="text-[12px] text-gray-600">
            Gemini 2.5 Flash · 매크로 지표 기반 분석 · 투자 조언 아님
          </p>
        </div>
      </div>

      {/* 토스트 알림 */}
      {toast && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-3 bg-[#1a2a1a] border border-emerald-500/40 text-emerald-200 text-[14px] font-semibold px-5 py-3 rounded-2xl shadow-2xl animate-fade-in-up"
          style={{ boxShadow: '0 4px 32px rgba(52,211,153,0.25)' }}
        >
          <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
          {toast}
          <span className="text-[12px] text-emerald-400/60 font-normal">→ 종목분석 즐겨찾기에서 확인</span>
        </div>
      )}
    </div>
  )
}
