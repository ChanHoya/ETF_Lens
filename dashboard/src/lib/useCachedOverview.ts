// 시장동향 탭 데이터를 메모리·localStorage에 두고 재진입 시 즉시 그린 뒤, 서버 기준 시각이 1시간 넘었을 때만 백그라운드로 갱신하는 훅
import { useCallback, useEffect, useState } from 'react';

export const STALE_MS = 60 * 60 * 1000;   // 기준 시각(updated_at)이 이보다 오래되면 갱신
const RETRY_MS = 5 * 60 * 1000;           // 갱신 실패 후 같은 데이터는 5분 뒤에만 다시 시도

type Stamped = { updated_at?: string };

// 탭을 옮겨 컴포넌트가 사라져도 남도록 모듈 범위에 둔다
const memory = new Map<string, unknown>();
const inflight = new Map<string, Promise<unknown>>();
const lastAttempt = new Map<string, number>();

function readStore<T>(key: string): T | null {
    if (memory.has(key)) return memory.get(key) as T;
    try {
        const raw = localStorage.getItem(key);
        if (raw) {
            const v = JSON.parse(raw) as T;
            memory.set(key, v);
            return v;
        }
    } catch {
        /* 저장소 접근 불가(사생활 보호 모드 등) — 메모리 캐시만 쓴다 */
    }
    return null;
}

function writeStore(key: string, v: unknown) {
    memory.set(key, v);
    try {
        localStorage.setItem(key, JSON.stringify(v));
    } catch {
        /* 용량 초과 등 — 메모리 캐시만 유지 */
    }
}

export function dataAgeMs(d: Stamped | null): number {
    const t = d?.updated_at ? Date.parse(d.updated_at) : NaN;
    return Number.isNaN(t) ? Infinity : Date.now() - t;
}

/**
 * storageKey: 응답 구조가 바뀌면 버전을 올린다(예: 'iprism-fx-v2').
 * 반환: data(캐시 또는 최신), refreshing(백그라운드 갱신 중), error, refresh(서버 캐시까지 무시하고 새로 받기).
 */
export function useCachedOverview<T extends Stamped>(storageKey: string, url: string) {
    const [data, setData] = useState<T | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchNow = useCallback(async (force = false) => {
        lastAttempt.set(storageKey, Date.now());
        setRefreshing(true);
        setError(null);
        try {
            // 같은 데이터를 받는 중이면(탭을 나갔다 들어온 경우 등) 새로 부르지 않고 그 결과를 기다린다
            let p = inflight.get(storageKey) as Promise<T> | undefined;
            if (!p || force) {
                const req: Promise<T> = (async () => {
                    const r = await fetch(`${url}${force ? '?refresh=true' : ''}`, { cache: 'no-store' });
                    if (!r.ok) throw new Error(`HTTP ${r.status}`);
                    const j = (await r.json()) as T;
                    writeStore(storageKey, j);
                    return j;
                })();
                inflight.set(storageKey, req);
                req.finally(() => { if (inflight.get(storageKey) === req) inflight.delete(storageKey); }).catch(() => {});
                p = req;
            }
            setData(await p);
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setRefreshing(false);
        }
    }, [storageKey, url]);

    const refreshIfStale = useCallback(() => {
        const cur = readStore<T>(storageKey);
        if (inflight.has(storageKey)) {
            fetchNow(); // 진행 중인 요청에 합류
        } else if (dataAgeMs(cur) > STALE_MS && Date.now() - (lastAttempt.get(storageKey) ?? 0) > RETRY_MS) {
            fetchNow();
        }
    }, [storageKey, fetchNow]);

    useEffect(() => {
        const cached = readStore<T>(storageKey);
        if (cached) setData(cached);
        refreshIfStale();
        const onVisible = () => { if (document.visibilityState === 'visible') refreshIfStale(); };
        const id = setInterval(onVisible, 60 * 1000);
        document.addEventListener('visibilitychange', onVisible);
        return () => {
            clearInterval(id);
            document.removeEventListener('visibilitychange', onVisible);
        };
    }, [storageKey, refreshIfStale]);

    return { data, refreshing, error, refresh: () => fetchNow(true) };
}
