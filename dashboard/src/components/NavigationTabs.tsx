import React, { useState, useEffect, useRef } from 'react';
import { Aperture, Star, Activity } from "lucide-react";

import { useRouter, usePathname } from 'next/navigation';
import { API_BASE } from '../lib/apiConfig';

// ── API 헬스 상태 ──────────────────────────────────────────────────────────────
interface CheckResult { ok: boolean; latency_ms?: number; error?: string }
interface HealthData {
  status: 'ok' | 'degraded' | 'error';
  checks: Record<string, CheckResult>;
  checked_at: string;
  notes?: Record<string, string>;
}

const STATUS_COLOR: Record<string, string> = {
  ok: '#34d399',      // 초록
  degraded: '#fbbf24', // 노란
  error: '#f87171',   // 빨강
};
const CHECK_LABELS: Record<string, string> = {
  yfinance_history: 'yfinance (start/end)',
  yfinance_period:  'yfinance (period=)',
  oecd_cli:         'OECD CLI API',
  fred:             'FRED API',
  gemini:           'Gemini AI',
};

function HealthBadge() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const fetchHealth = () => {
    fetch(`${API_BASE}/api/v1/health`)
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setHealth(d))
      .catch(() => {});
  };

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 5 * 60 * 1000); // 5분마다
    return () => clearInterval(interval);
  }, []);

  // 외부 클릭 시 팝업 닫기
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const color = health ? STATUS_COLOR[health.status] : '#6b7280';

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => { setOpen(o => !o); if (!health) fetchHealth(); }}
        title="외부 API 연동 상태"
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '8px 12px', borderRadius: 9999, fontSize: 12, fontWeight: 600,
          background: 'rgba(255,255,255,0.06)', border: `1px solid ${color}40`,
          color: '#cbd5e1', cursor: 'pointer', transition: 'all 0.2s',
        }}
      >
        <span style={{
          width: 8, height: 8, borderRadius: '50%', background: color,
          boxShadow: `0 0 6px ${color}`,
          animation: health?.status !== 'ok' ? 'pulse 1.5s infinite' : 'none',
        }} />
        <Activity size={12} />
        API
      </button>

      {open && health && (
        <div style={{
          position: 'absolute', right: 0, top: '110%', zIndex: 9999,
          background: '#0f1117', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 12, padding: 16, minWidth: 280,
          boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', marginBottom: 10 }}>
            🔌 외부 API 통합 상태
            <span style={{ float: 'right', fontWeight: 400, color: '#64748b' }}>
              {health.checked_at?.substring(11, 19)}
            </span>
          </div>
          {Object.entries(health.checks).map(([key, v]) => (
            <div key={key} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.05)',
              fontSize: 12,
            }}>
              <span style={{ color: '#cbd5e1' }}>{CHECK_LABELS[key] ?? key}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {v.latency_ms != null && (
                  <span style={{ color: '#64748b', fontSize: 10 }}>{v.latency_ms}ms</span>
                )}
                {v.ok
                  ? <span style={{ color: '#34d399', fontSize: 11 }}>✓ OK</span>
                  : <span style={{ color: '#f87171', fontSize: 11 }} title={v.error}>✗ 실패</span>
                }
              </span>
            </div>
          ))}
          <div style={{ marginTop: 8, fontSize: 10, color: '#475569' }}>
            핵심: yfinance(start/end), OECD CLI
          </div>
          <button
            onClick={fetchHealth}
            style={{
              marginTop: 8, width: '100%', padding: '4px 0', borderRadius: 6,
              background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)',
              color: '#a5b4fc', fontSize: 11, cursor: 'pointer',
            }}
          >
            🔄 지금 다시 체크
          </button>
        </div>
      )}
    </div>
  );
}

type NavigationTabsProps = {
    activeTab?: 'select' | 'info' | 'holdings' | 'chart' | 'discover' | 'covered_call';
    setActiveTab?: (tab: 'select' | 'info' | 'holdings' | 'chart' | 'discover' | 'covered_call') => void;
    isEtfCheckModalOpen?: boolean;
    setIsEtfCheckModalOpen?: (val: boolean) => void;
    isFavModalOpen?: boolean;
    setIsFavModalOpen?: (val: boolean) => void;
    hasOpenedEtfCheck?: boolean;
    setHasOpenedEtfCheck?: (val: boolean) => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data?: any;
};


export default function NavigationTabs({
    activeTab, setActiveTab,
    isEtfCheckModalOpen, setIsEtfCheckModalOpen,
    isFavModalOpen, setIsFavModalOpen,
    hasOpenedEtfCheck, setHasOpenedEtfCheck,
    data
}: NavigationTabsProps) {
    const router = useRouter();
    const pathname = usePathname();
    const isMyPage = pathname === '/my';

    const navItems: { id: 'select' | 'info' | 'holdings' | 'chart' | 'discover' | 'covered_call', label: string, icon?: string }[] = [
        { id: 'select', label: '종목선택' },
        { id: 'info', label: '기본정보' },
        { id: 'chart', label: '수익률차트' },
        { id: 'holdings', label: '구성종목' },
        { id: 'discover', label: '모니터링' },
        { id: 'covered_call', label: '커버드콜' }
    ];

    return (
        <nav className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3 w-full sm:w-auto mt-4 sm:mt-0">
            {navItems.map(tab => (
                <button
                    key={tab.id}
                    onClick={() => {
                        if (isMyPage) {
                            router.push('/');
                        } else if (setActiveTab) {
                            setActiveTab(tab.id);
                            if (setIsEtfCheckModalOpen && isEtfCheckModalOpen) setIsEtfCheckModalOpen(false);
                        }
                    }}
                    className={`px-6 py-3 rounded-full text-sm font-bold transition-all duration-300 w-full sm:w-auto relative overflow-hidden group border ${(!isMyPage && activeTab === tab.id)
                        ? 'bg-gradient-to-r from-indigo-500/30 to-purple-500/30 text-white shadow-[0_0_20px_rgba(99,102,241,0.3)] border-indigo-400/50 scale-105'
                        : 'bg-gray-800/80 text-gray-400 hover:bg-gray-700 hover:text-white border-gray-700/50'
                        }`}
                >
                    {(!isMyPage && activeTab === tab.id) && (
                        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-500 opacity-20 blur-xl group-hover:opacity-30 transition-opacity"></div>
                    )}
                    <span className="relative z-10 flex items-center justify-center gap-2">
                        {tab.label}
                    </span>
                </button>
            ))}

            {/* Naver Finance / ETF Check Tools */}
            {data && (
                <button
                    onClick={() => {
                        if (setIsEtfCheckModalOpen) setIsEtfCheckModalOpen(!isEtfCheckModalOpen);
                        if (setHasOpenedEtfCheck) setHasOpenedEtfCheck(true);
                    }}
                    className={`px-4 flex items-center justify-center gap-2 py-3 rounded-full text-sm font-bold transition-all duration-300 w-full sm:w-auto border ${isEtfCheckModalOpen
                        ? 'bg-rose-500/20 text-rose-400 border-rose-500/50 shadow-[0_0_20px_rgba(244,63,94,0.3)]'
                        : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700 hover:text-rose-300 border-gray-700/50'
                        }`}
                    title="ETF Check 심층 분석"
                >
                    <Aperture size={16} className={isEtfCheckModalOpen ? 'animate-spin-slow' : ''} />
                    {!hasOpenedEtfCheck && (
                        <span className="absolute -top-1 -right-1 flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
                        </span>
                    )}
                </button>
            )}

            {/* Favorites Modal Button */}
            {setIsFavModalOpen && (
                <button
                    onClick={() => {
                        setIsFavModalOpen(true);
                        if (setIsEtfCheckModalOpen && isEtfCheckModalOpen) setIsEtfCheckModalOpen(false);
                    }}
                    className="px-4 py-3 bg-gray-800/80 text-gray-400 hover:bg-yellow-500/20 hover:text-yellow-400 rounded-full text-sm font-bold border border-gray-700/50 shadow-md transition-all duration-300 flex items-center justify-center gap-2"
                    title="관심종목 관리"
                >
                    <Star size={16} />
                </button>
            )}

            {/* My Assets Tab */}
            <button
                onClick={() => {
                    if (!isMyPage) {
                        router.push('/my');
                    }
                }}
                className={`px-6 flex items-center justify-center gap-2 py-3 rounded-full text-sm font-bold transition-all duration-300 w-full sm:w-auto border ${isMyPage
                    ? 'bg-gradient-to-r from-emerald-500/30 to-teal-500/30 text-white shadow-[0_0_20px_rgba(16,185,129,0.3)] border-emerald-400/50 scale-105'
                    : 'bg-gray-800/80 text-gray-400 hover:bg-emerald-500/20 hover:text-emerald-300 border-gray-700/50'
                    }`}
                title="내 자산 평단가 분석 (KIS 연동)"
            >
                {isMyPage && (
                    <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-teal-500 opacity-20 blur-xl group-hover:opacity-30 transition-opacity"></div>
                )}
                <span className="relative z-10 flex items-center justify-center gap-2">
                    <span role="img" aria-label="money">💰</span> My
                </span>
            </button>

            {/* API 헬스 상태 뱃지 */}
            <HealthBadge />
        </nav>
    );
}
