import { useRef } from 'react';

/**
 * useTouchTap — 드래그/탭 분리 훅
 *
 * - touchstart: 위치 기록
 * - touchend: 이동거리 < THRESHOLD → 탭(onTap 실행)
 *             이동거리 ≥ THRESHOLD → 드래그(아무 동작 없음)
 *
 * 차트 tooltip은 Recharts 자체 touch 처리로 별도 동작 → 영향 없음
 * 이 훅은 onClick 팝업을 가진 클릭 요소(treemap 셀, 종목 행 등)에만 적용
 *
 * 사용법:
 *   const tapProps = useTouchTap(() => openDetailModal(code));
 *   <div {...tapProps} onClick={...pc_handler...}>
 */
export function useTouchTap(onTap: () => void, threshold = 8) {
    const startRef = useRef<{ x: number; y: number } | null>(null);
    const didDragRef = useRef(false);

    return {
        onTouchStart: (e: React.TouchEvent) => {
            startRef.current = {
                x: e.touches[0].clientX,
                y: e.touches[0].clientY,
            };
            didDragRef.current = false;
        },
        onTouchMove: (e: React.TouchEvent) => {
            if (!startRef.current) return;
            const dx = e.touches[0].clientX - startRef.current.x;
            const dy = e.touches[0].clientY - startRef.current.y;
            if (Math.hypot(dx, dy) >= threshold) {
                didDragRef.current = true;
            }
        },
        onTouchEnd: (e: React.TouchEvent) => {
            if (!didDragRef.current) {
                e.preventDefault(); // 이후 mouse click 이벤트 억제
                onTap();
            }
            startRef.current = null;
            didDragRef.current = false;
        },
    };
}
