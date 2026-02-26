import { useState, useEffect } from 'react';

export type FavGroup = { id: string; name: string; items: { code: string; name: string }[] };

export function useFavorites() {
    const [favorites, setFavorites] = useState<FavGroup[]>([]);
    const [isFavModalOpen, setIsFavModalOpen] = useState(false);
    const [favSearchQuery, setFavSearchQuery] = useState<{ [groupId: string]: string }>({});
    const [selectedFavItems, setSelectedFavItems] = useState<{ code: string, name: string }[]>([]);

    useEffect(() => {
        if (typeof window !== "undefined") {
            const savedFavs = localStorage.getItem('etf_favorites');
            if (savedFavs) {
                try { setFavorites(JSON.parse(savedFavs)); } catch (e) { }
            } else {
                setFavorites([{ id: 'default', name: '내 관심종목', items: [] }]);
            }
        }
    }, []);

    const saveFavorites = (favs: FavGroup[]) => {
        setFavorites(favs);
        if (typeof window !== "undefined") {
            localStorage.setItem('etf_favorites', JSON.stringify(favs));
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
        renameFavGroup,
        deleteFavGroup,
        removeFavItem,
        addFavItem,
        toggleFavItemSelection
    };
}
