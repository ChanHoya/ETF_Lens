"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";

export interface TabItem {
  id: string;
  label: React.ReactNode;
  icon?: React.ReactNode;
  isExternal?: boolean;
}

export interface SlidingTabsProps {
  items: TabItem[];
  activeId: string;
  onChange: (id: string) => void;
  containerClassName?: string;
  pillClassName?: string;
  tabClassName?: string;
  activeTabClassName?: string;
  inactiveTabClassName?: string;
}

export default function SlidingTabs({
  items,
  activeId,
  onChange,
  containerClassName = "",
  pillClassName = "bg-gradient-to-r from-indigo-500 to-purple-500 shadow-[0_0_15px_rgba(99,102,241,0.4)]",
  tabClassName = "px-3 py-1 rounded-full text-xs sm:text-sm font-bold whitespace-nowrap",
  activeTabClassName = "text-white",
  inactiveTabClassName = "text-gray-400 hover:text-white hover:bg-white/5",
}: SlidingTabsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const [pillStyle, setPillStyle] = useState<{ left: number; width: number; height: number; top: number; visible: boolean }>({
    left: 0,
    width: 0,
    height: 0,
    top: 0,
    visible: false,
  });

  const updatePill = useCallback(() => {
    const activeEl = tabRefs.current.get(activeId);
    const containerEl = containerRef.current;
    if (activeEl && containerEl) {
      const containerRect = containerEl.getBoundingClientRect();
      const activeRect = activeEl.getBoundingClientRect();

      setPillStyle({
        left: activeRect.left - containerRect.left,
        width: activeRect.width,
        height: activeRect.height,
        top: activeRect.top - containerRect.top,
        visible: true,
      });
    } else {
      setPillStyle((prev) => ({ ...prev, visible: false }));
    }
  }, [activeId]);

  useEffect(() => {
    updatePill();
    // 창 크기 변경 시 및 폰트 로드 시 위치 재계산
    window.addEventListener("resize", updatePill);
    const timer = setTimeout(updatePill, 50);
    return () => {
      window.removeEventListener("resize", updatePill);
      clearTimeout(timer);
    };
  }, [updatePill]);

  return (
    <div
      ref={containerRef}
      className={`t-tabs-container relative p-0.5 rounded-full ${containerClassName}`}
      role="tablist"
    >
      {/* 부드럽게 슬라이딩되는 액티브 인디케이터 필(Pill) */}
      <div
        className={`t-tabs-pill rounded-full ${pillClassName}`}
        style={{
          transform: `translateX(${pillStyle.left}px)`,
          width: `${pillStyle.width}px`,
          height: pillStyle.height ? `${pillStyle.height}px` : "100%",
          top: `${pillStyle.top}px`,
          opacity: pillStyle.visible ? 1 : 0,
        }}
        aria-hidden="true"
      />

      {/* 탭 버튼 목록 */}
      {items.map((tab) => {
        const isActive = tab.id === activeId;
        return (
          <button
            key={tab.id}
            ref={(el) => {
              if (el) tabRefs.current.set(tab.id, el);
              else tabRefs.current.delete(tab.id);
            }}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={`relative z-10 inline-flex items-center gap-1.5 transition-colors duration-200 cursor-pointer ${tabClassName} ${
              isActive ? activeTabClassName : inactiveTabClassName
            }`}
          >
            {tab.icon && <span className="shrink-0">{tab.icon}</span>}
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
