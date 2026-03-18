import { useState, useEffect } from 'react';

export type FavGroup = { id: string; name: string; items: { code: string; name: string }[] };

export function useFavorites() {
    const [favorites, setFavorites] = useState<FavGroup[]>([]);
    const [isFavModalOpen, setIsFavModalOpen] = useState(false);
    const [favSearchQuery, setFavSearchQuery] = useState<{ [groupId: string]: string }>({});
    const [selectedFavItems, setSelectedFavItems] = useState<{ code: string, name: string }[]>([]);

    useEffect(() => {
        if (typeof window === "undefined") return;

        // 초기 로드
        const load = () => {
            const savedFavs = localStorage.getItem('etf_favorites');
            if (savedFavs) {
                try {
                    const parsed: FavGroup[] = JSON.parse(savedFavs);
                    // 그룹당 최대 10개 초과 항목 자동 제거 (기존 데이터 정리)
                    const trimmed = parsed.map(g => ({ ...g, items: g.items.slice(0, 10) }));
                    const hasOverflow = parsed.some(g => g.items.length > 10);
                    if (hasOverflow) {
                        localStorage.setItem('etf_favorites', JSON.stringify(trimmed));
                        window.dispatchEvent(new Event('etf_favorites_updated'));
                    }
                    setFavorites(trimmed);
                } catch (e) { }
            } else {
                setFavorites([{ id: 'default', name: '내 관심종목', items: [] }]);
            }
        };
        load();

        // 다른 컴포넌트(AIInsight 등)가 localStorage를 업데이트하면 즉시 동기화
        const handleStorage = (e: StorageEvent) => {
            if (e.key === 'etf_favorites' && e.newValue) {
                try { setFavorites(JSON.parse(e.newValue)); } catch (e) { }
            }
        };
        // same-tab 동기화를 위한 커스텀 이벤트
        const handleFavUpdate = () => load();

        window.addEventListener('storage', handleStorage);
        window.addEventListener('etf_favorites_updated', handleFavUpdate);
        return () => {
            window.removeEventListener('storage', handleStorage);
            window.removeEventListener('etf_favorites_updated', handleFavUpdate);
        };
    }, []);

    const saveFavorites = (favs: FavGroup[]) => {
        setFavorites(favs);
        if (typeof window !== "undefined") {
            localStorage.setItem('etf_favorites', JSON.stringify(favs));
            // 같은 탭 내 다른 useFavorites 인스턴스(page.tsx, AIInsight 등)에 즉시 알림
            window.dispatchEvent(new Event('etf_favorites_updated'));
        }
    };

    const addFavGroup = () => {
        const newGroup = { id: Date.now().toString(), name: `새 그룹 ${favorites.length + 1}`, items: [] };
        saveFavorites([...favorites, newGroup]);
    };

    const renameFavGroup = (id: string, newName: string) => {
        saveFavorites(favorites.map(g => g.id === id ? { ...g, name: newName } : g));
    };

    const deleteFavGroup = (id: string) => {
        if (favorites.length <= 1) return alert("최소 1개의 그룹은 존재해야 합니다.");
        if (confirm("이 그룹을 정말 삭제하시겠습니까?")) {
            saveFavorites(favorites.filter(g => g.id !== id));
        }
    };

    const removeFavItem = (groupId: string, code: string) => {
        saveFavorites(favorites.map(g => g.id === groupId ? { ...g, items: g.items.filter(i => i.code !== code) } : g));
    };

    const addFavItem = (groupId: string, code: string, name: string) => {
        saveFavorites(favorites.map(g => {
            if (g.id === groupId) {
                if (g.items.length >= 10) return g; // 10개 초과 방지
                if (!g.items.some(i => i.code === code)) {
                    return { ...g, items: [...g.items, { code, name }] };
                }
            }
            return g;
        }));
    };

    const toggleFavItemSelection = (item: { code: string, name: string }) => {
        setSelectedFavItems(prev => {
            if (prev.some(p => p.code === item.code)) {
                return prev.filter(p => p.code !== item.code);
            } else {
                if (prev.length >= 10) {
                    alert("관심종목은 최대 10개까지만 선택 가능합니다.");
                    return prev;
                }
                return [...prev, item];
            }
        });
    };

    const addGroupWithItems = (groupName: string, items: { code: string; name: string }[]) => {
        // 최대 10개 제한
        const limitedItems = items.slice(0, 10);
        // stale closure 방지: localStorage에서 최신 상태를 직접 읽음
        let currentFavs: FavGroup[] = favorites;
        if (typeof window !== 'undefined') {
            try {
                const raw = localStorage.getItem('etf_favorites');
                if (raw) currentFavs = JSON.parse(raw);
            } catch (_) {}
        }
        const existing = currentFavs.find(g => g.name === groupName);
        if (existing) {
            // 동일 이름 그룹 → 기존 items 리셋 후 현재 추천 종목만 저장
            saveFavorites(currentFavs.map(g => g.name === groupName ? { ...g, items: limitedItems } : g));
        } else {
            // 새 그룹 생성
            const newGroup = { id: Date.now().toString(), name: groupName, items: limitedItems };
            saveFavorites([...currentFavs, newGroup]);
        }
    };

    return {
        favorites,
        isFavModalOpen,
        setIsFavModalOpen,
        favSearchQuery,
        setFavSearchQuery,
        selectedFavItems,
        setSelectedFavItems,
        saveFavorites,
        addFavGroup,
        addGroupWithItems,
        renameFavGroup,
        deleteFavGroup,
        removeFavItem,
        addFavItem,
        toggleFavItemSelection
    };
}
