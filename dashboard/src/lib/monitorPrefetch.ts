/**
 * 모니터링 탭 백그라운드 프리페치 서비스
 * - 앱 로드 후 2.5초 뒤 `prefetchMonitorData(apiBase)`를 page.tsx에서 호출
 * - 각 컴포넌트(KospiExitAnalyzer, MacroCompass, SemiChart)가 마운트 시
 *   `getPrefetchedData(url)`로 캐시를 먼저 확인 → hit 시 즉시 렌더
 */

/** module-level 캐시: URL → 파싱된 JSON 데이터 */
const cache = new Map<string, unknown>();

/**
 * 단일 URL을 fetch하여 캐시에 저장.
 * 실패해도 무시 (컴포넌트 자체 fetch가 fallback)
 */
async function prefetchUrl(url: string): Promise<void> {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return;
    const data = await res.json();
    cache.set(url, data);
  } catch {
    // 네트워크/파싱 오류 무시 – 컴포넌트가 직접 fetch함
  }
}

/**
 * 모니터링 탭에 필요한 API를 병렬로 프리페치.
 * page.tsx에서 딱 한 번 호출.
 * AIInsight는 LLM 호출이라 제외.
 */
export async function prefetchMonitorData(apiBase: string): Promise<void> {
  await Promise.allSettled([
    prefetchUrl(`${apiBase}/api/v1/exit-signal`),
    prefetchUrl(`${apiBase}/api/v1/exit-signal/cli`),
    prefetchUrl(`${apiBase}/api/v1/exit-signal/macro?period=1Y`),
    prefetchUrl(`${apiBase}/api/v1/exit-signal/per?period=1Y`),
    prefetchUrl(`${apiBase}/api/v1/macro-compass`),
    prefetchUrl(`${apiBase}/api/v1/analyze/semi-chart`),
  ]);
}

/**
 * 프리페치된 데이터 반환.
 * @returns 캐시 hit → data, miss → null
 */
export function getPrefetchedData<T = unknown>(url: string): T | null {
  const data = cache.get(url);
  return data !== undefined ? (data as T) : null;
}

/** 사용 후 캐시 삭제 (선택적 – 메모리 관리) */
export function clearPrefetchedData(url: string): void {
  cache.delete(url);
}
