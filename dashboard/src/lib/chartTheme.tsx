import React, { useState, useCallback, CSSProperties } from 'react';

/**
 * i-Prism (ETF Lens) 전역 차트 표준 스타일 & 범례 하이라이트 시스템
 * 
 * 모든 차트의 마우스 포인팅 툴팁 폰트 크기(11px) 및 디자인 일원화,
 * 범례(Legend) 클릭 시 해당 차트 데이터 라인/막대 하이라이트 기능 제공.
 */

// 1. 표준 툴팁 스타일 (11px 일원화 & 다크 글래스모피즘)
export const STANDARD_TOOLTIP_STYLE: CSSProperties = {
  backgroundColor: '#151722f0',
  backdropFilter: 'blur(8px)',
  WebkitBackdropFilter: 'blur(8px)',
  border: '1px solid rgba(255, 255, 255, 0.15)',
  borderRadius: '10px',
  fontSize: '11px',
  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
  padding: '8px 12px',
  color: '#ffffff',
  lineHeight: 1.4,
};

// 2. Recharts Tooltip 공통 Props
export const STANDARD_TOOLTIP_PROPS = {
  contentStyle: STANDARD_TOOLTIP_STYLE,
  itemStyle: { fontSize: '11px', color: '#e2e8f0', padding: '2px 0' },
  labelStyle: { fontSize: '11px', color: '#94a3b8', fontWeight: 600, marginBottom: '4px' },
};

// 3. 표준 범례 wrapper 스타일 (11px, pointer 커서)
export const STANDARD_LEGEND_WRAPPER_STYLE: CSSProperties = {
  fontSize: '11px',
  cursor: 'pointer',
  userSelect: 'none',
  paddingTop: '6px',
};

// 하위 호환 별칭 (혹시 모를 미정의 참조 방지)
export const TOOLTIP_STYLE = STANDARD_TOOLTIP_STYLE;
export const LEGEND_WRAPPER_STYLE = STANDARD_LEGEND_WRAPPER_STYLE;

/**
 * 범례 클릭 인터랙티브 하이라이트 훅
 * - highlightedKey: 현재 선택된 데이터 키 (null이면 전체 표시)
 * - handleLegendClick: Recharts <Legend onClick={handleLegendClick} />에 연결
 * - getOpacity: 비선택 라인 0.2 연하게, 선택 라인 1.0 선명하게
 * - getStrokeWidth: 선택 라인 두께 강조
 * - renderLegendText: 범례 텍스트 서식 (선택된 항목 밑줄/볼드, 비선택 항목 흐림)
 */
export function useChartHighlight(initialKey: string | null = null) {
  const [highlightedKey, setHighlightedKey] = useState<string | null>(initialKey);

  const handleLegendClick = useCallback((entry: any) => {
    const key = entry?.dataKey || entry?.value || entry?.id;
    if (!key) return;
    setHighlightedKey(prev => (prev === key ? null : key));
  }, []);

  const clearHighlight = useCallback(() => setHighlightedKey(null), []);

  const isDimmed = useCallback((key: string) => {
    return highlightedKey !== null && highlightedKey !== key;
  }, [highlightedKey]);

  const isHighlighted = useCallback((key: string) => {
    return highlightedKey === key;
  }, [highlightedKey]);

  const getOpacity = useCallback((key: string, baseOpacity = 1, dimmedOpacity = 0.2) => {
    if (!highlightedKey) return baseOpacity;
    return highlightedKey === key ? baseOpacity : dimmedOpacity;
  }, [highlightedKey]);

  const getStrokeWidth = useCallback((key: string, baseWidth = 2, activeWidth = 3.5) => {
    if (!highlightedKey) return baseWidth;
    return highlightedKey === key ? activeWidth : Math.max(1, baseWidth - 0.5);
  }, [highlightedKey]);

  const renderLegendText = useCallback((value: string, entry: any) => {
    const key = entry?.dataKey || entry?.value || value;
    const selected = highlightedKey === key;
    const dimmed = highlightedKey !== null && !selected;
    return (
      <span
        style={{
          fontSize: '11px',
          color: dimmed ? 'rgba(255, 255, 255, 0.35)' : '#cbd5e1',
          fontWeight: selected ? 700 : 400,
          textDecoration: selected ? 'underline' : 'none',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
        }}
      >
        {value}
      </span>
    );
  }, [highlightedKey]);

  return {
    highlightedKey,
    setHighlightedKey,
    handleLegendClick,
    clearHighlight,
    isDimmed,
    isHighlighted,
    getOpacity,
    getStrokeWidth,
    getSeriesOpacity: getOpacity,
    getSeriesStrokeWidth: getStrokeWidth,
    renderLegendText,
  };
}

/**
 * 커스텀 툴팁 컨테이너 컴포넌트 (11px 표준 폰트 적용)
 */
export function StandardTooltipContainer({
  children,
  className = '',
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        ...STANDARD_TOOLTIP_STYLE,
        ...style,
      }}
      className={`text-[11px] ${className}`}
    >
      {children}
    </div>
  );
}
