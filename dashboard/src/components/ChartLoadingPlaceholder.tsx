/**
 * ChartLoadingPlaceholder
 * 차트 로딩 중일 때 표시되는 깜빡이는 "로딩중" 플레이스홀더.
 * 모든 차트 패널에서 공통으로 사용.
 */
import React from 'react';

interface ChartLoadingProps {
  height?: number;       // px, 기본 220
  message?: string;      // 기본 "로딩중"
  subMessage?: string;   // 부가 메시지 (예: "첫 로드 30초 소요")
}

export default function ChartLoadingPlaceholder({
  height = 220,
  message = '로딩중',
  subMessage,
}: ChartLoadingProps) {
  return (
    <div
      style={{
        height,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 12,
        background: 'rgba(255,255,255,0.02)',
        border: '1px dashed rgba(255,255,255,0.08)',
        gap: 12,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* 배경 스켈레톤 라인들 */}
      <div style={{ position: 'absolute', inset: 0, padding: '12px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 6 }}>
        {[60, 80, 45, 70, 55, 85, 50].map((h, i) => (
          <div
            key={i}
            style={{
              height: 2,
              borderRadius: 2,
              background: `rgba(99,102,241,${0.04 + i * 0.01})`,
              width: `${h}%`,
              animation: `chartShimmer ${1.2 + i * 0.15}s ease-in-out infinite alternate`,
            }}
          />
        ))}
      </div>

      {/* 메인 로딩 텍스트 */}
      <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 20px',
            borderRadius: 20,
            background: 'rgba(99,102,241,0.12)',
            border: '1px solid rgba(99,102,241,0.25)',
            animation: 'loadingPulse 1.4s ease-in-out infinite',
          }}
        >
          {/* 점 3개 애니메이션 */}
          <div style={{ display: 'flex', gap: 4 }}>
            {[0, 0.2, 0.4].map((delay, i) => (
              <span
                key={i}
                style={{
                  width: 5, height: 5, borderRadius: '50%',
                  background: '#818cf8',
                  animation: `dotBounce 1.2s ${delay}s ease-in-out infinite`,
                  display: 'inline-block',
                }}
              />
            ))}
          </div>
          <span
            style={{
              fontSize: 13, fontWeight: 700,
              color: '#a5b4fc', letterSpacing: '0.05em',
            }}
          >
            {message}
          </span>
        </div>

        {subMessage && (
          <div style={{ marginTop: 6, fontSize: 11, color: '#475569' }}>
            {subMessage}
          </div>
        )}
      </div>

      {/* CSS 키프레임 */}
      <style>{`
        @keyframes loadingPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.55; transform: scale(0.97); }
        }
        @keyframes dotBounce {
          0%, 100% { transform: translateY(0); opacity: 0.4; }
          50% { transform: translateY(-4px); opacity: 1; }
        }
        @keyframes chartShimmer {
          from { opacity: 0.3; }
          to   { opacity: 0.8; }
        }
      `}</style>
    </div>
  );
}
