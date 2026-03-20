/**
 * MarqueeText — 텍스트가 컨테이너보다 길 경우 마우스오버 시 좌→우 스크롤(마키) 효과.
 * 끝에 도달하면 처음부터 무한 반복. hover 시 행 하이라이트는 부모에서 처리.
 */
'use client';

import React, { useRef, useState, useEffect } from 'react';

interface MarqueeTextProps {
  /** 표시할 텍스트 */
  text: string;
  /** 추가 className (컨테이너에 적용) */
  className?: string;
  /** 인라인 스타일 (컨테이너에 적용) */
  style?: React.CSSProperties;
  /** 스크롤 속도 px/s (기본 60) */
  speed?: number;
}

export default function MarqueeText({
  text,
  className = '',
  style,
  speed = 60,
}: MarqueeTextProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isOverflow, setIsOverflow] = useState(false);
  const [duration, setDuration] = useState(4);

  // 텍스트가 컨테이너보다 긴지 체크
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // overflow:hidden 상태로는 scrollWidth 비교로 판단
    const check = () => {
      const overflows = el.scrollWidth > el.clientWidth + 2; // +2 px tolerance
      setIsOverflow(overflows);
      if (overflows) {
        // 스크롤 거리 = 텍스트 폭 + 구분 간격(48px)
        const scrollDist = el.scrollWidth + 48;
        setDuration(Math.max(2, scrollDist / speed));
      }
    };

    check();
    // ResizeObserver로 컨테이너 크기 변경 시 재체크
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [text, speed]);

  const shouldAnimate = isHovered && isOverflow;

  return (
    <div
      ref={containerRef}
      className={`overflow-hidden whitespace-nowrap ${className}`}
      style={style}
      title={text}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {shouldAnimate ? (
        // 마키 모드: 텍스트 두 벌을 이어붙여 seamless 루프
        <span
          style={{
            display: 'inline-block',
            whiteSpace: 'nowrap',
            animation: `marquee-text ${duration}s linear infinite`,
          }}
        >
          {text}
          {/* 구분 간격 */}
          <span style={{ display: 'inline-block', width: '3rem' }} />
          {text}
          <span style={{ display: 'inline-block', width: '3rem' }} />
        </span>
      ) : (
        // 기본 모드: truncate
        <span className="block truncate">{text}</span>
      )}
    </div>
  );
}
