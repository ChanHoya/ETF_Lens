// 보유 종목 목록을 화면 필터 조건으로 걸러내는 순수 함수 모음

export interface SourceFilter {
    /** KIS 실시간 연동 종목을 보여줄지 */
    showKis: boolean;
    /** 수동 입력 자산을 보여줄지 */
    showManual: boolean;
}

/**
 * 출처(KIS / 수동) 기준으로 거른다.
 * 둘 다 켜져 있으면 원본 배열을 그대로 돌려준다.
 * source 값이 "MANUAL" 이 아닌 것은 전부 KIS 연동분으로 본다.
 */
export function filterHoldingsBySource<T extends { source?: string }>(
    holdings: T[],
    { showKis, showManual }: SourceFilter
): T[] {
    if (showKis && showManual) return holdings;
    return holdings.filter((h) => (h.source === "MANUAL" ? showManual : showKis));
}
