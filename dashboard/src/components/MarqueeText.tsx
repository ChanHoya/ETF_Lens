/**
 * MarqueeText — hover 시 텍스트가 왼쪽으로 무한 스크롤되는 마키 컴포넌트.
 * overflow:hidden 컨테이너의 scrollWidth 제한을 우회하기 위해
 * 절대위치 hidden span으로 실제 텍스트 폭을 별도 측정합니다.
 */
'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';

interface MarqueeTextProps {
  text: string;
  className?: string;
  style?: React.CSSProperties;
  /** 스크롤 속도 px/s (기본 55) */
  speed?: number;
}

export default function MarqueeText({
  text,
  className = '',
  style,
  speed = 55,
}: MarqueeTextProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef  = useRef<HTMLSpanElement>(null);

  const [isHovered, setIsHovered] = useState(false);
  const [isOverflow, setIsOverflow] = useState(false);
  const [duration, setDuration] = useState(4);

  const check = useCallback(() => {
    const container = containerRef.current;
    const measure   = measureRef.current;
    if (!container || !measure) return;

    // measureRef 는 overflow 제약 없이 실제 텍스트 폭 반환
    const textW      = measure.getBoundingClientRect().width;
    const containerW = container.getBoundingClientRect().width;

    const overflows = textW > containerW + 1;
    setIsOverflow(overflows);
    if (overflows) {
      // 전체 스크롤 거리: 텍스트1 + gap(48px) + 텍스트2 = 2*(textW+48)
      // → animation 은 0 → -50% (= -(textW+48)) 이므로 duration = (textW+48)/speed
      setDuration(Math.max(2, (textW + 48) / speed));
    }
  }, [speed]);

  useEffect(() => {
    check();
    const ro = new ResizeObserver(check);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [text, check]);

  const shouldAnimate = isHovered && isOverflow;

  return (
    <div
      ref={containerRef}
      className={`overflow-hidden relative ${className}`}
      style={style}
      title={text}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* 숨겨진 측정 전용 span — overflow 제약 없음 */}
      <span
        ref={measureRef}
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          whiteSpace: 'nowrap',
          visibility: 'hidden',
          pointerEvents: 'none',
          fontSize: 'inherit',
          fontWeight: 'inherit',
          letterSpacing: 'inherit',
        }}
      >
        {text}
      </span>

      {shouldAnimate ? (
        /* 마키 모드: 텍스트 두 벌 + gap → seamless 루프 */
        <span
          style={{
            display: 'inline-block',
            whiteSpace: 'nowrap',
            animation: `marquee-text ${duration}s linear infinite`,
          }}
        >
          {text}
          <span style={{ display: 'inline-block', width: '3rem' }} />
          {text}
          <span style={{ display: 'inline-block', width: '3rem' }} />
        </span>
      ) : (
        /* 기본 모드: truncate */
        <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {text}
        </span>
      )}
    </div>
  );
}
