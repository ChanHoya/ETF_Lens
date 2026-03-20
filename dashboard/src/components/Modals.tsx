import React from 'react';
import { Star, Plus, Edit2, Trash2, Check, X, Share2, Store, Download, Lock, RefreshCw } from "lucide-react";
import { ResponsiveContainer, ComposedChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Line, Bar, PieChart, Pie, Cell } from "recharts";
import { FavGroup } from '../hooks/useFavorites';
import { API_BASE } from '../lib/apiConfig';

type ModalsProps = {
    isFavModalOpen: boolean;
    setIsFavModalOpen: (val: boolean) => void;
    favorites: FavGroup[];
    favSearchQuery: { [groupId: string]: string };
    setFavSearchQuery: React.Dispatch<React.SetStateAction<{ [groupId: string]: string }>>;
    selectedFavItems: { code: string, name: string }[];
    addFavGroup: () => void;
    renameFavGroup: (id: string, name: string) => void;
    deleteFavGroup: (id: string) => void;
    removeFavItem: (groupId: string, code: string) => void;
    addFavItem: (groupId: string, code: string, name: string) => void;
    addFavItems: (groupId: string, items: { code: string, name: string }[]) => void;
    toggleFavItemSelection: (item: { code: string, name: string }) => void;
    selectFromFavorites: (items: { code: string, name: string }[]) => void;
    BRAND_KEYWORDS: string[];
    THEME_KEYWORDS: string[];
    etfDictionary: { code: string, name: string }[];

    selectedDetailEtf: any;
    setSelectedDetailEtf: (etf: any) => void;
    popupPeriod: string;
    setPopupPeriod: (p: string) => void;
    detailChartData: { nav: any[], vol: any[], price: any[], benchmarkName: string, domainLeft?: any, domainRight?: any };

    isEtfCheckModalOpen: boolean;
    setIsEtfCheckModalOpen: (val: boolean) => void;
    hasOpenedEtfCheck: boolean;

    naverEtfCode: string | null;
    setNaverEtfCode: (code: string | null) => void;
};

export default function Modals({
    isFavModalOpen, setIsFavModalOpen, favorites, favSearchQuery, setFavSearchQuery, selectedFavItems,
    addFavGroup, renameFavGroup, deleteFavGroup, removeFavItem, addFavItem, addFavItems, toggleFavItemSelection, selectFromFavorites,
    BRAND_KEYWORDS, THEME_KEYWORDS, etfDictionary,
    selectedDetailEtf, setSelectedDetailEtf, popupPeriod, setPopupPeriod, detailChartData,
    isEtfCheckModalOpen, setIsEtfCheckModalOpen, hasOpenedEtfCheck,
    naverEtfCode, setNaverEtfCode
}: ModalsProps) {

    // ── 기능 1: 검색 드롭다운 다중 선택 state ─────────────────────────────
    // { [groupId]: Set<etfCode> }
    const [searchSelected, setSearchSelected] = React.useState<{ [groupId: string]: Set<string> }>({});

    const toggleSearchItem = (groupId: string, item: { code: string, name: string }) => {
        setSearchSelected(prev => {
            const current = new Set(prev[groupId] || []);
            if (current.has(item.code)) current.delete(item.code);
            else current.add(item.code);
            return { ...prev, [groupId]: new Set(current) };
        });
    };

    const isSearchItemSelected = (groupId: string, code: string) =>
        (searchSelected[groupId] || new Set()).has(code);

    // 선택된 종목들을 그룹에 일괄 추가 (단일 addFavItems 호출 → stale closure 없음)
    const bulkAddToGroup = (groupId: string, filtered: { code: string, name: string }[]) => {
        const sel = searchSelected[groupId] || new Set<string>();
        if (sel.size === 0) return;
        const toAdd = filtered.filter(f => sel.has(f.code));
        if (toAdd.length > 0) addFavItems(groupId, toAdd);
        setSearchSelected(prev => ({ ...prev, [groupId]: new Set() }));
        setFavSearchQuery(prev => ({ ...prev, [groupId]: '' }));
    };

    // ── 기능 2: HOT 키워드 AND / OR 토글 state ───────────────────────────
    // { [groupId]: boolean } — true = AND(&), false = OR, 기본값 true(AND)
    const [hotAndMode, setHotAndMode] = React.useState<{ [groupId: string]: boolean }>({});
    const getAndMode = (groupId: string) => hotAndMode[groupId] !== false; // default true = AND

    // ── 포트폴리오 마켓 상태 ─────────────────────────────────────────────
    const [isMarketOpen, setIsMarketOpen] = React.useState(false);
    const [marketList, setMarketList] = React.useState<any[]>([]);
    const [marketLoading, setMarketLoading] = React.useState(false);
    const [deletingMarketId, setDeletingMarketId] = React.useState<number | null>(null);
    const [deletePin, setDeletePin] = React.useState('');
    const [deleteError, setDeleteError] = React.useState('');
    // 그룹별 업로드 폼 상태 { [groupId]: {open, author, pin, uploading, done, error} }
    const [uploadForms, setUploadForms] = React.useState<{ [k: string]: { open: boolean; author: string; pin: string; uploading: boolean; done: boolean; error: string } }>({});

    const getUploadForm = (groupId: string) => uploadForms[groupId] ?? { open: false, author: '', pin: '', uploading: false, done: false, error: '' };
    const setUploadForm = (groupId: string, patch: Partial<typeof uploadForms[string]>) =>
        setUploadForms(prev => ({ ...prev, [groupId]: { ...getUploadForm(groupId), ...patch } }));

    const fetchMarket = React.useCallback(async () => {
        setMarketLoading(true);
        try {
            const res = await fetch(`${API_BASE}/api/v1/portfolio-market`);
            const data = await res.json();
            setMarketList(Array.isArray(data) ? data : []);
        } catch { setMarketList([]); }
        setMarketLoading(false);
    }, []);

    React.useEffect(() => { if (isMarketOpen) fetchMarket(); }, [isMarketOpen, fetchMarket]);

    const handleUpload = async (group: FavGroup) => {
        const form = getUploadForm(group.id);
        if (!form.author.trim() || !form.pin.trim()) { setUploadForm(group.id, { error: '닉네임과 PIN을 입력하세요.' }); return; }
        if (group.items.length === 0) { setUploadForm(group.id, { error: '종목이 없는 그룹은 업로드할 수 없습니다.' }); return; }
        setUploadForm(group.id, { uploading: true, error: '' });
        try {
            const res = await fetch(`${API_BASE}/api/v1/portfolio-market`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: group.name, author: form.author.trim(), pin: form.pin.trim(), items: group.items }),
            });
            if (!res.ok) { const e = await res.json(); throw new Error(e.detail || '업로드 실패'); }
            setUploadForm(group.id, { uploading: false, done: true, error: '' });
        } catch (e: any) { setUploadForm(group.id, { uploading: false, error: e.message }); }
    };

    const handleDownload = async (portfolio: any) => {
        // 다운로드 카운트 증가
        await fetch(`${API_BASE}/api/v1/portfolio-market/${portfolio.id}/download`, { method: 'POST' }).catch(() => {});
        // 즐겨찾기 그룹에 추가
        addFavGroup();
        // 잠시 후 마지막 그룹에 items 추가 (addFavGroup이 비동기적으로 상태 업데이트하므로 setTimeout)
        setTimeout(() => {
            // favorites 배열에서 마지막 그룹 사용
            const lastGroup = favorites[favorites.length - 1];
            if (lastGroup) {
                renameFavGroup(lastGroup.id, portfolio.name);
                addFavItems(lastGroup.id, portfolio.items);
            }
        }, 100);
        // 다운로드 수 갱신
        setMarketList(prev => prev.map(p => p.id === portfolio.id ? { ...p, download_count: p.download_count + 1 } : p));
    };

    const handleMarketDelete = async (id: number) => {
        setDeleteError('');
        try {
            const res = await fetch(`${API_BASE}/api/v1/portfolio-market/${id}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pin: deletePin }),
            });
            if (!res.ok) { const e = await res.json(); throw new Error(e.detail || '삭제 실패'); }
            setMarketList(prev => prev.filter(p => p.id !== id));
            setDeletingMarketId(null);
            setDeletePin('');
        } catch (e: any) { setDeleteError(e.message); }
    };

    return (
        <>
            {/* ===== 1. 나의 관심종목 즐겨찾기 Modal ===== */}
            {isFavModalOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-transparent animate-in fade-in duration-200 p-2 md:p-6">
                    <div className="bg-[#0f111a] border border-white/10 rounded-2xl w-full max-w-[1400px] h-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">

                        {/* 헤더 */}
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center p-4 border-b border-white/10 relative gap-3 bg-black/20">
                            <h2 className="text-xl md:text-2xl font-bold flex items-center gap-2 text-white">
                                <Star className="w-6 h-6 text-yellow-500 fill-yellow-500/20" /> 나의 관심종목 즐겨찾기
                            </h2>
                            <div className="flex items-center gap-2 w-full md:w-auto">
                                <button
                                    onClick={() => { setIsMarketOpen(true); setIsFavModalOpen(false); }}
                                    className="flex items-center gap-1.5 px-3 py-2 bg-purple-600/20 hover:bg-purple-600/40 text-purple-300 border border-purple-500/30 rounded-lg text-sm font-semibold transition-all"
                                >
                                    <Store className="w-4 h-4" /> 포트폴리오 마켓
                                </button>
                                <button
                                    onClick={() => selectFromFavorites(selectedFavItems)}
                                    disabled={selectedFavItems.length === 0}
                                    className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:opacity-50 text-white rounded-lg text-sm font-bold transition-all shadow-[0_0_15px_rgba(79,70,229,0.3)] disabled:shadow-none"
                                >
                                    <Check className="w-4 h-4" /> 선택한 종목 입력칸에 넣기 ({selectedFavItems.length})
                                </button>
                                <button onClick={() => setIsFavModalOpen(false)} className="text-gray-400 hover:text-white transition-colors bg-white/5 p-2 rounded-xl flex-shrink-0">
                                    <X className="w-6 h-6" />
                                </button>
                            </div>
                        </div>

                        {/* 바디 */}
                        <div className="p-3 md:p-5 overflow-y-auto flex-1 custom-scrollbar">
                            <div className="flex justify-between items-center mb-4">
                                <p className="text-gray-400 text-sm">종목을 여러개 클릭하여 선택한 뒤, 위 버튼을 눌러 비교 입력칸에 한 번에 넣을 수 있습니다.</p>
                                <button onClick={addFavGroup} className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm font-medium transition-colors shadow-sm">
                                    <Plus className="w-4 h-4" /> 새 그룹
                                </button>
                            </div>

                            {favorites.length === 0 && (
                                <div className="text-center py-10 text-gray-500 text-sm">생성된 그룹이 없습니다. 먼저 새 그룹을 추가하세요.</div>
                            )}

                            <div className="space-y-6">
                                {favorites.map(group => (
                                    <div key={group.id} className="bg-white/[0.02] border border-white/10 rounded-xl p-4 shadow-inner">

                                        {/* 그룹 헤더 */}
                                        <div className="flex justify-between items-start mb-3 pb-3 border-b border-white/10">
                                            <div className="flex flex-col gap-2">
                                                <div className="flex items-center gap-3">
                                                    <h3 className="text-lg font-bold text-indigo-300 tracking-wide">{group.name}</h3>
                                                    <div className="flex gap-1">
                                                        <button
                                                            onClick={() => {
                                                                const newName = prompt("새 그룹 이름을 입력하세요:", group.name);
                                                                if (newName && newName.trim()) renameFavGroup(group.id, newName.trim());
                                                            }}
                                                            className="p-1.5 text-gray-500 hover:text-indigo-400 bg-white/5 rounded-md transition-colors"
                                                            title="그룹명 수정"
                                                        >
                                                            <Edit2 className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button
                                                            onClick={() => deleteFavGroup(group.id)}
                                                            className="p-1.5 text-gray-500 hover:text-rose-400 bg-white/5 rounded-md transition-colors"
                                                            title="그룹 삭제"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button
                                                            onClick={() => setUploadForm(group.id, { open: !getUploadForm(group.id).open, done: false, error: '' })}
                                                            className="p-1.5 text-gray-500 hover:text-purple-400 bg-white/5 rounded-md transition-colors"
                                                            title="마켓에 공유하기"
                                                        >
                                                            <Share2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                </div>
                                                {/* 인라인 업로드 폼 */}
                                                {getUploadForm(group.id).open && (
                                                    <div className="flex flex-wrap gap-2 items-center p-2.5 bg-purple-500/5 border border-purple-500/20 rounded-xl">
                                                        {getUploadForm(group.id).done ? (
                                                            <span className="text-sm text-emerald-400 font-semibold">✅ 마켓에 업로드 완료!</span>
                                                        ) : (
                                                            <>
                                                                <input
                                                                    placeholder="닉네임"
                                                                    value={getUploadForm(group.id).author}
                                                                    onChange={e => setUploadForm(group.id, { author: e.target.value })}
                                                                    className="bg-black/40 border border-white/10 rounded px-2 py-1.5 text-sm text-white w-28 focus:outline-none focus:ring-1 focus:ring-purple-500"
                                                                />
                                                                <input
                                                                    placeholder="PIN"
                                                                    type="password"
                                                                    maxLength={8}
                                                                    value={getUploadForm(group.id).pin}
                                                                    onChange={e => setUploadForm(group.id, { pin: e.target.value })}
                                                                    className="bg-black/40 border border-white/10 rounded px-2 py-1.5 text-sm text-white w-24 focus:outline-none focus:ring-1 focus:ring-purple-500"
                                                                />
                                                                <button
                                                                    onClick={() => handleUpload(group)}
                                                                    disabled={getUploadForm(group.id).uploading}
                                                                    className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded text-sm font-bold transition-colors flex items-center gap-1"
                                                                >
                                                                    <Share2 className="w-3.5 h-3.5" />
                                                                    {getUploadForm(group.id).uploading ? '업로드 중...' : '마켓 공유'}
                                                                </button>
                                                                {getUploadForm(group.id).error && (
                                                                    <span className="text-xs text-rose-400">{getUploadForm(group.id).error}</span>
                                                                )}
                                                            </>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                            <button
                                                onClick={() => selectFromFavorites(group.items)}
                                                disabled={group.items.length === 0}
                                                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-indigo-500 text-white rounded-md text-xs font-semibold disabled:opacity-30 transition-all shadow-sm flex-shrink-0"
                                            >
                                                <Check className="w-3 h-3" /> 그룹전체 바로넣기 ({group.items.length})
                                            </button>
                                        </div>

                                        {/* 그룹 내 종목 카드 */}
                                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
                                            {group.items.map(item => {
                                                const isSelected = selectedFavItems.some(i => i.code === item.code);
                                                return (
                                                    <div
                                                        key={item.code}
                                                        className={`flex flex-col justify-between items-start bg-black/40 border-2 rounded-lg p-2.5 group/favitem transition-all cursor-pointer ${isSelected ? 'border-indigo-500 bg-indigo-900/30' : 'border-white/5 hover:border-indigo-400/50 hover:bg-white/5'}`}
                                                        onClick={() => toggleFavItemSelection(item)}
                                                    >
                                                        <div className="flex justify-between items-start w-full mb-1">
                                                            <span className="font-mono text-[10px] text-indigo-400/80 bg-black/30 px-1.5 py-0.5 rounded border border-indigo-500/10">
                                                                {item.code}
                                                            </span>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); removeFavItem(group.id, item.code); }}
                                                                className="opacity-0 group-hover/favitem:opacity-100 p-1 text-gray-500 hover:text-rose-400 transition-all ml-1 bg-white/5 rounded hover:bg-rose-500/20"
                                                                title="종목 삭제"
                                                            >
                                                                <Trash2 className="w-3 h-3" />
                                                            </button>
                                                        </div>
                                                        <div className="w-full truncate text-sm font-medium text-gray-200 group-hover/favitem:text-white" title={item.name}>
                                                            {item.name}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {/* ── 종목 추가 영역 ── */}
                                        <div className="mt-4 relative z-50">

                                            {/* 퀵 필터 (운용사 / HOT 키워드) */}
                                            <div className="flex flex-col gap-1 mb-2">

                                                {/* 🏢 운용사 행 */}
                                                <div className="flex flex-wrap items-center gap-1">
                                                    <span className="text-[9px] font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-blue-400 mr-1 flex items-center min-w-[36px]">
                                                        <span className="mr-0.5">🏢</span> 운용사:
                                                    </span>
                                                    {BRAND_KEYWORDS.map(brand => {
                                                        const currentQuery = favSearchQuery[group.id] || "";
                                                        const isActive = currentQuery.split(' ').includes(brand);
                                                        return (
                                                            <button
                                                                key={brand}
                                                                onMouseDown={(e) => {
                                                                    e.preventDefault();
                                                                    const terms = currentQuery.split(' ').filter(t => t.trim() !== '');
                                                                    const newSearch = terms.includes(brand)
                                                                        ? terms.filter(t => t !== brand).join(' ')
                                                                        : [...terms, brand].join(' ');
                                                                    setFavSearchQuery(prev => ({ ...prev, [group.id]: newSearch }));
                                                                    setTimeout(() => document.getElementById(`fav-search-${group.id}`)?.focus(), 10);
                                                                }}
                                                                className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full transition-all border ${isActive ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/50' : 'bg-white/5 border-white/10 text-gray-500 hover:bg-white/10'}`}
                                                            >
                                                                {brand}
                                                            </button>
                                                        );
                                                    })}
                                                </div>

                                                {/* 🔥 HOT 키워드 행 + AND/OR 토글 */}
                                                <div className="flex flex-wrap items-center gap-1">
                                                    <span className="text-[9px] font-bold text-transparent bg-clip-text bg-gradient-to-r from-rose-400 to-orange-400 mr-0.5 flex items-center min-w-[36px]">
                                                        <span className="mr-0.5">🔥</span> HOT:
                                                    </span>

                                                    {/* AND / OR 토글 버튼 */}
                                                    <button
                                                        onMouseDown={(e) => {
                                                            e.preventDefault();
                                                            setHotAndMode(prev => ({ ...prev, [group.id]: !getAndMode(group.id) }));
                                                        }}
                                                        title={getAndMode(group.id)
                                                            ? "현재: AND — 선택한 키워드 모두 포함된 종목 검색. 클릭하면 OR로 전환"
                                                            : "현재: OR — 선택한 키워드 중 하나라도 포함된 종목 검색. 클릭하면 AND(&)로 전환"}
                                                        className={`text-[9px] font-black px-2 py-0.5 rounded-full border transition-all select-none mr-0.5 ${getAndMode(group.id)
                                                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-[0_0_6px_rgba(245,158,11,0.3)]'
                                                            : 'bg-sky-500/20 text-sky-300 border-sky-500/50 shadow-[0_0_6px_rgba(14,165,233,0.3)]'
                                                        }`}
                                                    >
                                                        {getAndMode(group.id) ? '&' : 'OR'}
                                                    </button>

                                                    {THEME_KEYWORDS.map(theme => {
                                                        const currentQuery = favSearchQuery[group.id] || "";
                                                        const isActive = currentQuery.split(' ').includes(theme);
                                                        return (
                                                            <button
                                                                key={theme}
                                                                onMouseDown={(e) => {
                                                                    e.preventDefault();
                                                                    const terms = currentQuery.split(' ').filter(t => t.trim() !== '');
                                                                    const newSearch = terms.includes(theme)
                                                                        ? terms.filter(t => t !== theme).join(' ')
                                                                        : [...terms, theme].join(' ');
                                                                    setFavSearchQuery(prev => ({ ...prev, [group.id]: newSearch }));
                                                                    setTimeout(() => document.getElementById(`fav-search-${group.id}`)?.focus(), 10);
                                                                }}
                                                                className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full transition-all border ${isActive ? 'bg-rose-500/20 text-rose-300 border-rose-500/50' : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'}`}
                                                            >
                                                                {theme}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>

                                            {/* 검색 입력창 */}
                                            <div className="flex items-center px-3 py-2 bg-black/60 border border-white/10 focus-within:border-indigo-500/50 rounded-lg transition-colors">
                                                <input
                                                    id={`fav-search-${group.id}`}
                                                    value={favSearchQuery[group.id] || ""}
                                                    onChange={e => setFavSearchQuery(prev => ({ ...prev, [group.id]: e.target.value }))}
                                                    className="bg-transparent border-none outline-none text-sm text-gray-200 w-full placeholder-gray-500"
                                                    placeholder="ETF 이름을 검색하여 이 그룹에 추가..."
                                                />
                                            </div>

                                            {/* 검색 드롭다운 (다중 선택 + 추가하기 버튼) */}
                                            {favSearchQuery[group.id] && etfDictionary.length > 0 && (() => {
                                                const terms = (favSearchQuery[group.id] || "").toLowerCase().split(' ').filter(t => t.trim() !== '');
                                                if (terms.length === 0) return null;

                                                const lowerBrands = BRAND_KEYWORDS.map(b => b.toLowerCase());
                                                const brandTerms = terms.filter(t => lowerBrands.includes(t));
                                                const themeTerms = terms.filter(t => !lowerBrands.includes(t));
                                                const isAnd = getAndMode(group.id);

                                                const filtered = etfDictionary.filter(e => {
                                                    const etfName = e.name.toLowerCase().replace(/\s/g, '');
                                                    const etfCode = e.code.toLowerCase();

                                                    // 운용사는 항상 OR (여러 운용사 중 하나라도 매칭)
                                                    const brandMatch = brandTerms.length === 0
                                                        ? true
                                                        : brandTerms.some(term => etfName.includes(term) || etfCode.includes(term));

                                                    // 테마 키워드는 AND/OR 모드 적용
                                                    const themeMatch = themeTerms.length === 0
                                                        ? true
                                                        : isAnd
                                                            ? themeTerms.every(term => etfName.includes(term) || etfCode.includes(term))
                                                            : themeTerms.some(term => etfName.includes(term) || etfCode.includes(term));

                                                    return brandMatch && themeMatch;
                                                }).slice(0, 50);

                                                const selectedSet = searchSelected[group.id] || new Set<string>();
                                                const allSelected = filtered.length > 0 && filtered.every(f => selectedSet.has(f.code));

                                                return (
                                                    <div className="absolute top-[110%] left-0 w-full bg-[#1a1c23]/97 border border-indigo-500/30 rounded-xl shadow-2xl backdrop-blur-xl z-[100] overflow-hidden">

                                                        {/* 드롭다운 헤더: 전체선택 체크박스 + 추가하기 버튼 */}
                                                        <div className="flex items-center justify-between px-4 py-2 border-b border-indigo-500/20 bg-indigo-950/50 sticky top-0 z-10">
                                                            <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-gray-400 hover:text-white transition-colors">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={allSelected}
                                                                    onChange={() => {
                                                                        setSearchSelected(prev => ({
                                                                            ...prev,
                                                                            [group.id]: allSelected
                                                                                ? new Set()
                                                                                : new Set(filtered.map(f => f.code))
                                                                        }));
                                                                    }}
                                                                    className="w-3.5 h-3.5 rounded accent-indigo-500"
                                                                />
                                                                전체선택
                                                                <span className="text-indigo-400 font-semibold ml-1">({filtered.length}개 검색됨)</span>
                                                            </label>
                                                            <button
                                                                onMouseDown={(e) => { e.preventDefault(); bulkAddToGroup(group.id, filtered); }}
                                                                disabled={selectedSet.size === 0}
                                                                className="flex items-center gap-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:opacity-40 text-white rounded-lg text-xs font-bold transition-all shadow-md disabled:shadow-none"
                                                            >
                                                                <Plus className="w-3 h-3" /> 추가하기 ({selectedSet.size}개)
                                                            </button>
                                                        </div>

                                                        {/* 검색결과 목록 */}
                                                        <div className="max-h-[220px] overflow-y-auto custom-scrollbar">
                                                            {filtered.length === 0
                                                                ? <div className="p-4 text-sm text-rose-400 font-medium text-center">검색 결과가 없습니다.</div>
                                                                : filtered.map(e => {
                                                                    const sel = isSearchItemSelected(group.id, e.code);
                                                                    return (
                                                                        <div
                                                                            key={e.code}
                                                                            onMouseDown={(ev) => { ev.preventDefault(); toggleSearchItem(group.id, e); }}
                                                                            className={`px-4 py-2.5 text-sm cursor-pointer border-b border-indigo-500/10 last:border-0 transition-colors flex items-center gap-3 group/row ${sel ? 'bg-emerald-900/25 hover:bg-emerald-900/40' : 'hover:bg-indigo-600/30'}`}
                                                                        >
                                                                            <input
                                                                                type="checkbox"
                                                                                readOnly
                                                                                checked={sel}
                                                                                className="w-3.5 h-3.5 rounded accent-emerald-500 shrink-0 pointer-events-none"
                                                                            />
                                                                            <span className={`font-medium truncate pr-2 flex-1 ${sel ? 'text-emerald-300' : 'text-gray-200 group-hover/row:text-indigo-200'}`}>
                                                                                {e.name}
                                                                            </span>
                                                                            <span className="font-mono text-xs text-indigo-400 bg-black/30 px-2 py-0.5 rounded border border-white/5 shrink-0">
                                                                                {e.code}
                                                                            </span>
                                                                        </div>
                                                                    );
                                                                })
                                                            }
                                                        </div>
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ===== 2. ETF 상세 정보 Modal ===== */}
            {selectedDetailEtf && (
                <div className="absolute top-0 inset-x-0 bottom-2 md:bottom-4 z-[300] flex animate-in fade-in duration-200">
                    <div className="bg-[#0B0F19] border border-white/10 rounded-2xl w-full h-full overflow-hidden flex flex-col shadow-2xl shadow-indigo-500/10">

                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center p-5 lg:px-8 border-b border-white/10 relative gap-3 bg-gradient-to-r from-blue-900/20 to-transparent">
                            <div>
                                <h2 className="text-2xl lg:text-3xl font-bold flex items-center gap-3 text-white tracking-tight">
                                    <span className="text-blue-400">{selectedDetailEtf.etf_name}</span>
                                    <span className="text-sm font-mono text-gray-400 bg-white/5 px-2 py-1 rounded-md">{selectedDetailEtf.etf_code}</span>
                                    <span className="text-sm font-medium text-gray-500 hidden sm:inline-block">| 기초지수: {selectedDetailEtf.basic_info?.['기초지수명'] || 'N/A'}</span>
                                </h2>
                                <div className="text-xs text-gray-400 mt-2 flex gap-4 hidden md:flex items-center">
                                    <span>운용사: {selectedDetailEtf.basic_info?.['자산운용사'] || selectedDetailEtf.basic_info?.['운용사'] || '-'}</span>
                                    <span className="flex items-center gap-1">총보수: <strong className="text-rose-400 bg-rose-400/10 px-1.5 py-0.5 rounded">{selectedDetailEtf.basic_info?.['펀드보수'] || '-'}</strong></span>
                                    <span className="flex items-center gap-1">분배율(TTM): <strong className="text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded">{selectedDetailEtf.basic_info?.['최근 분배율(TTM)'] || '-'}</strong></span>
                                    <span className="flex items-center gap-1">1M 수익률: <strong className="text-blue-400 bg-blue-400/10 px-1.5 py-0.5 rounded">{selectedDetailEtf.basic_info?.['1M 수익률'] || '-'}</strong></span>
                                </div>
                            </div>
                            <button onClick={() => setSelectedDetailEtf(null)} className="absolute top-5 right-5 text-gray-400 hover:text-white transition-colors bg-white/5 p-2 rounded-xl flex-shrink-0 z-10">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="p-4 md:p-6 lg:p-8 overflow-y-auto flex-1 custom-scrollbar space-y-8 bg-[#0B0F19]">

                            {/* 1. 시세 및 주주현황 */}
                            <div>
                                <div className="flex justify-between items-end mb-3 border-b-2 border-slate-700 pb-2">
                                    <h3 className="text-base md:text-lg font-bold text-blue-400 tracking-wide">시세 <span className="text-white font-medium">및 주주현황</span></h3>
                                    <span className="text-xs text-gray-500">[기준: 오늘]</span>
                                </div>
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    <div className="border-t border-slate-700">
                                        {['종가/전일대비/수익률', '52주 최고/최저', '상장주식수', '거래량/거래대금', '20일평균 거래량/대금', '시가총액', '순자산총액'].map((k) => (
                                            <div key={k} className="flex border-b border-slate-800 text-sm">
                                                <div className="w-1/3 bg-slate-900/50 text-gray-400 p-3 font-medium flex items-center">{k.replace('20일평균 거래량/대금', '20일평균 거래량/거래대금')}</div>
                                                <div className="w-2/3 p-3 text-right flex items-center justify-end text-gray-200 font-semibold">{selectedDetailEtf.basic_info?.[k] || '-'}</div>
                                            </div>
                                        ))}
                                        <div className="flex border-b border-slate-800 text-sm">
                                            <div className="w-1/3 bg-slate-900/50 text-gray-400 p-3 font-medium flex items-center">수익률(1M/3M/6M/1Y)</div>
                                            <div className="w-2/3 p-3 text-right flex items-center justify-end text-blue-400 font-bold tracking-tight">
                                                {selectedDetailEtf.basic_info?.['1M 수익률'] || '-'} / {selectedDetailEtf.basic_info?.['3M 수익률'] || '-'} / {selectedDetailEtf.basic_info?.['6M 수익률'] || '-'} / {selectedDetailEtf.basic_info?.['1Y 수익률'] || '-'}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="border border-slate-800 bg-slate-900/20 rounded-xl p-4 flex flex-col relative">
                                        <div className="flex justify-between items-center mb-3">
                                            <h4 className="text-xs text-gray-400 font-bold">주가/상대수익률</h4>
                                            <div className="flex bg-black/40 rounded-lg p-0.5 border border-white/5 overflow-hidden">
                                                {['1M', '3M', '6M', '1Y'].map(p => (
                                                    <button
                                                        key={p}
                                                        onClick={() => setPopupPeriod(p)}
                                                        className={`px-2 py-1 text-[10px] font-bold transition-all ${popupPeriod === p ? 'bg-blue-600/60 text-white rounded' : 'text-gray-500 hover:text-gray-300'}`}
                                                    >
                                                        {p}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="flex-1 min-h-[250px] w-full">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <ComposedChart key={`price-${popupPeriod}`} data={detailChartData.price} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                                                    <XAxis dataKey="day" tick={{ fill: '#64748b', fontSize: 11 }} tickMargin={10} stroke="#1e293b" minTickGap={30} />
                                                    <YAxis yAxisId="left" tick={{ fill: '#3b82f6', fontSize: 11 }} tickFormatter={(val) => `${val}%`} stroke="#1e293b" axisLine={false} domain={detailChartData.domainLeft as any} width={40} />
                                                    <YAxis yAxisId="right" orientation="right" width={52} tick={{ fill: '#ef4444', fontSize: 11 }} tickFormatter={(val) => val >= 10000 ? `${(val/1000).toFixed(1)}K` : val.toLocaleString()} stroke="#1e293b" axisLine={false} domain={detailChartData.domainRight as any} />
                                                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155' }} formatter={(val: any, name: string) => {
                                                        if (name === detailChartData.benchmarkName) return [`${Number(val).toFixed(2)}%`, name];
                                                        return [Number(val).toLocaleString() + '원', name];
                                                    }} />
                                                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                                                    <Line yAxisId="left" type="monotone" dataKey="rel_yield" name={detailChartData.benchmarkName} stroke="#3b82f6" strokeWidth={2} dot={false} />
                                                    <Line yAxisId="right" type="monotone" dataKey="price" name={selectedDetailEtf.etf_name} stroke="#ef4444" strokeWidth={2} dot={false} />
                                                </ComposedChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* 3. 상품설명 */}
                            <div>
                                <div className="flex justify-between items-end mb-3 border-b-2 border-slate-700 pb-2">
                                    <h3 className="text-base md:text-lg font-bold text-blue-400 tracking-wide">상품설명</h3>
                                </div>
                                <div className="bg-slate-900/30 p-5 rounded-xl border border-slate-800 text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">
                                    {selectedDetailEtf.basic_info?.['상품설명'] || `1좌당 순자산가치의 변동률을 기초지수의 변동률과 유사하도록 투자신탁재산을 운용하는 것을 목표로 합니다.\n${selectedDetailEtf.etf_name}는 해당 기초지수 구성종목을 바탕으로 포트폴리오를 구축하여 시장 대비 안정적인 수익을 추구합니다.`}
                                </div>
                            </div>

                            {/* 4. 순자산가치(NAV)추이 */}
                            <div>
                                <div className="flex justify-between items-end mb-3 border-b-2 border-slate-700 pb-2">
                                    <h3 className="text-base md:text-lg font-bold text-blue-400 tracking-wide">순자산가치(NAV) <span className="text-white font-medium">추이</span></h3>
                                </div>
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    <div className="border border-slate-700 rounded-xl overflow-hidden">
                                        <table className="w-full text-right text-sm">
                                            <thead className="bg-slate-900/80 text-gray-400">
                                                <tr>
                                                    <th className="p-3 text-center border-b border-slate-700 font-medium">날짜</th>
                                                    <th className="p-3 border-b border-slate-700 font-medium">순자산가치(NAV)</th>
                                                    <th className="p-3 border-b border-slate-700 font-medium">ETF종가</th>
                                                    <th className="p-3 border-b border-slate-700 font-medium whitespace-nowrap">괴리율(%)</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {detailChartData.nav.slice().reverse().slice(0, 7).map((n: any, i: number) => (
                                                    <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-800/20">
                                                        <td className="p-2.5 text-center text-gray-400">{n.date}</td>
                                                        <td className="p-2.5 text-gray-200">{n.nav?.toLocaleString() || '-'}</td>
                                                        <td className="p-2.5 text-gray-200">{n.price?.toLocaleString() || '-'}</td>
                                                        <td className={`p-2.5 font-medium ${n.diff > 0 ? 'text-rose-400' : n.diff < 0 ? 'text-blue-400' : 'text-gray-300'}`}>{n.diff?.toFixed(2) || '-'}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    <div className="border border-slate-800 bg-slate-900/20 rounded-xl p-4 flex flex-col relative pt-7">
                                        <span className="absolute left-[65px] top-3 text-[11px] text-gray-500 font-bold">[원]</span>
                                        <span className="absolute right-[20px] top-3 text-[11px] text-gray-500 font-bold">[%]</span>
                                        <div className="flex-1 min-h-[250px] w-full">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <ComposedChart data={detailChartData.nav} margin={{ top: 5, right: 0, left: -20, bottom: 5 }}>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                                                    <XAxis dataKey="day" tick={{ fill: '#64748b', fontSize: 11 }} tickMargin={10} stroke="#1e293b" minTickGap={15} />
                                                    <YAxis yAxisId="left" tick={{ fill: '#ef4444', fontSize: 11 }} tickFormatter={(val) => `${val.toLocaleString()}`} stroke="#1e293b" axisLine={false} domain={['auto', 'auto']} />
                                                    <YAxis yAxisId="right" orientation="right" tick={{ fill: '#3b82f6', fontSize: 11 }} tickFormatter={(val) => `${val.toFixed(2)}`} stroke="#1e293b" axisLine={false} domain={[-0.5, 0.5]} />
                                                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155' }} />
                                                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                                                    <Bar yAxisId="right" dataKey="diff" name="괴리율" fill="#3b82f6" maxBarSize={4} />
                                                    <Line yAxisId="left" type="monotone" dataKey="nav" name="순자산가치(NAV)" stroke="#ef4444" strokeWidth={2} dot={false} connectNulls={true} />
                                                    <Line yAxisId="left" type="monotone" dataKey="price" name="ETF 종가" stroke="#84cc16" strokeDasharray="5 5" strokeWidth={2} dot={false} connectNulls={true} />
                                                </ComposedChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* 5. 구성항목 */}
                            <div>
                                <div className="flex justify-between items-end mb-3 border-b-2 border-slate-700 pb-2">
                                    <h3 className="text-base md:text-lg font-bold text-blue-400 tracking-wide">CU당 구성종목 <span className="text-white font-medium text-sm ml-2">[Top 10]</span></h3>
                                </div>
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    <div className="border border-slate-700 rounded-xl overflow-hidden">
                                        <table className="w-full text-right text-sm">
                                            <thead className="bg-slate-900/80 text-gray-400">
                                                <tr>
                                                    <th className="p-3 text-left border-b border-slate-700 font-medium pl-5">구성종목명</th>
                                                    <th className="p-3 border-b border-slate-700 font-medium">주식수(계약수)</th>
                                                    <th className="p-3 border-b border-slate-700 font-medium pr-5">구성비중(%)</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {selectedDetailEtf.holdings?.length > 0 ? (
                                                    selectedDetailEtf.holdings.slice(0, 10).map((h: any, i: number) => (
                                                        <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-800/20">
                                                            <td className="p-2.5 text-left text-gray-200 pl-5">{h.ticker}</td>
                                                            <td className="p-2.5 text-gray-400">{h.shares ? h.shares.toLocaleString() : Math.round(h.weight * 50).toLocaleString()}</td>
                                                            <td className="p-2.5 font-bold text-indigo-300 pr-5">{h.weight > 0 ? h.weight.toFixed(2) : '-'}</td>
                                                        </tr>
                                                    ))
                                                ) : (
                                                    <tr>
                                                        <td colSpan={3} className="p-8 text-center text-gray-500">
                                                            미국 ETF 등 구성종목 데이터가 아직 제공되지 않았습니다.<br /><br />
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setNaverEtfCode(selectedDetailEtf.etf_code);
                                                                }}
                                                                className="px-4 py-2 bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 rounded-lg text-sm font-bold hover:bg-indigo-500 hover:text-white transition-all shadow-md"
                                                            >
                                                                네이버 정보 검색
                                                            </button>
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                    <div className="border border-slate-800 bg-slate-900/20 rounded-xl p-4 flex flex-col items-center justify-center">
                                        <h4 className="text-xs text-gray-500 font-bold mb-0 w-full text-left">비중 Top 10 차트</h4>
                                        <div className="flex-1 w-full min-h-[300px]">
                                            {selectedDetailEtf.holdings?.length > 0 && selectedDetailEtf.holdings.some((h: any) => h.weight > 0) ? (
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <PieChart>
                                                        <Pie
                                                            data={selectedDetailEtf.holdings.slice(0, 10)}
                                                            cx="50%"
                                                            cy="50%"
                                                            labelLine={true}
                                                            label={(props: any) => (
                                                                <text
                                                                    x={props.x} y={props.y} fill="#cbd5e1"
                                                                    fontSize={10} textAnchor={props.textAnchor}
                                                                    dominantBaseline={props.dominantBaseline}
                                                                >
                                                                    {props.payload.ticker} ({props.value.toFixed(1)}%)
                                                                </text>
                                                            )}
                                                            outerRadius={90}
                                                            fill="#8884d8"
                                                            dataKey="weight"
                                                            stroke="rgba(0,0,0,0.5)"
                                                            strokeWidth={2}
                                                        >
                                                            {selectedDetailEtf.holdings.slice(0, 10).map((entry: any, index: number) => {
                                                                const pieColors = ['#2563eb', '#dc2626', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#f43f5e', '#64748b'];
                                                                return <Cell key={`cell-${index}`} fill={pieColors[index % pieColors.length]} />;
                                                            })}
                                                        </Pie>
                                                        <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155' }} itemStyle={{ color: '#e2e8f0' }} />
                                                    </PieChart>
                                                </ResponsiveContainer>
                                            ) : (
                                                <div className="flex items-center justify-center h-full text-gray-500 text-sm px-6 text-center">
                                                    해외/합성 ETF는 비중 데이터가 제공되지 않아 차트를 그릴 수 없습니다.
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* 6. 거래량/거래대금 */}
                            <div>
                                <div className="flex justify-between items-end mb-3 border-b-2 border-slate-700 pb-2">
                                    <h3 className="text-base md:text-lg font-bold text-blue-400 tracking-wide">거래량, 거래대금 <span className="text-white font-medium text-sm ml-2">(1개월, 평균)</span></h3>
                                </div>
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    <div className="border border-slate-700 rounded-xl overflow-hidden">
                                        <table className="w-full text-right text-sm">
                                            <thead className="bg-slate-900/80 text-gray-400">
                                                <tr>
                                                    <th className="p-3 text-center border-b border-slate-700 font-medium">날짜</th>
                                                    <th className="p-3 border-b border-slate-700 font-medium">거래량(천주)</th>
                                                    <th className="p-3 border-b border-slate-700 font-medium pr-5">거래대금(백만원)</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {detailChartData.vol.map((v: any, i: number) => (
                                                    <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-800/20">
                                                        <td className="p-2.5 text-center text-gray-400">{v.month}</td>
                                                        <td className="p-2.5 text-gray-200">{v.volume.toLocaleString()}</td>
                                                        <td className="p-2.5 text-gray-200 pr-5">{v.value.toLocaleString()}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    <div className="border border-slate-800 bg-slate-900/20 rounded-xl p-4 flex flex-col">
                                        <div className="flex justify-between text-xs text-gray-500 font-bold mb-3 px-2">
                                            <span>(천주)</span><span>(백만원)</span>
                                        </div>
                                        <div className="flex-1 min-h-[250px] w-full">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <ComposedChart data={detailChartData.vol.slice().reverse()} margin={{ top: 5, right: 0, left: -10, bottom: 5 }}>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                                                    <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 11 }} tickMargin={10} stroke="#1e293b" />
                                                    <YAxis yAxisId="left" tick={{ fill: '#3b82f6', fontSize: 11 }} tickFormatter={(val) => `${val.toLocaleString()}`} stroke="#1e293b" axisLine={false} />
                                                    <YAxis yAxisId="right" orientation="right" tick={{ fill: '#ef4444', fontSize: 11 }} tickFormatter={(val) => `${val.toLocaleString()}`} stroke="#1e293b" axisLine={false} />
                                                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155' }} />
                                                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                                                    <Bar yAxisId="left" dataKey="volume" name="월간평균거래량(좌)" fill="#3b82f6" maxBarSize={15} />
                                                    <Line yAxisId="right" type="monotone" dataKey="value" name="월간평균거래대금(우)" stroke="#ea580c" strokeWidth={2} dot={{ r: 3 }} connectNulls={true} />
                                                </ComposedChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>
                                </div>
                            </div>

                        </div>
                    </div>
                </div>
            )}

            {/* ===== 3. ETF Check Modal ===== */}
            {hasOpenedEtfCheck && (
                <div className={`absolute top-0 inset-x-0 bottom-2 md:bottom-4 z-[400] flex-col animate-in fade-in duration-300 ${isEtfCheckModalOpen ? 'flex' : 'hidden'}`}>
                    <div className="w-full h-full bg-neutral-900 border border-neutral-700/50 rounded-2xl shadow-2xl shadow-teal-500/10 flex flex-col overflow-hidden ring-1 ring-white/10">
                        <div className="flex items-center justify-between px-3 md:px-5 py-2 border-b border-white/5 bg-gradient-to-r from-neutral-900 to-neutral-800 shrink-0 relative z-10">
                            <h2 className="text-sm md:text-base font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-emerald-400 flex items-center gap-2">
                                <span className="w-1.5 h-6 bg-emerald-500 rounded-full"></span>
                                ETF Check
                            </h2>
                            <button
                                onClick={() => setIsEtfCheckModalOpen(false)}
                                className="w-6 h-6 md:w-8 md:h-8 flex items-center justify-center rounded-full bg-white/5 text-gray-400 hover:text-white hover:bg-rose-500/20 hover:scale-105 active:scale-95 transition-all outline-none group border border-transparent hover:border-rose-500/50"
                            >
                                <X className="w-3 h-3 md:w-4 md:h-4 group-hover:rotate-90 transition-transform duration-300" />
                            </button>
                        </div>
                        <div className="w-full flex-1 overflow-hidden relative bg-[#0b0f19]">
                            <iframe
                                src="https://www.etfcheck.co.kr/mobile/main"
                                className="w-full h-full border-none"
                                style={{ filter: "invert(0.92) hue-rotate(180deg)" }}
                                allowFullScreen
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* ===== 4. Naver Modal ===== */}
            {naverEtfCode && (
                <div className="absolute top-0 inset-x-0 bottom-2 md:bottom-4 z-[500] flex-col animate-in fade-in duration-300 flex">
                    <div className="w-full h-full bg-neutral-900 border border-neutral-700/50 rounded-2xl shadow-2xl shadow-blue-500/10 flex flex-col overflow-hidden ring-1 ring-white/10">
                        <div className="flex items-center justify-between px-3 md:px-5 py-2 border-b border-white/5 bg-gradient-to-r from-neutral-900 to-neutral-800 shrink-0 relative z-10">
                            <h2 className="text-sm md:text-base font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400 flex items-center gap-2">
                                <span className="w-1.5 h-6 bg-blue-500 rounded-full"></span>
                                네이버 금융 (Naver Finance)
                            </h2>
                            <button
                                onClick={() => setNaverEtfCode(null)}
                                className="w-6 h-6 md:w-8 md:h-8 flex items-center justify-center rounded-full bg-white/5 text-gray-400 hover:text-white hover:bg-rose-500/20 hover:scale-105 active:scale-95 transition-all outline-none group border border-transparent hover:border-rose-500/50"
                            >
                                <X className="w-3 h-3 md:w-4 md:h-4 group-hover:rotate-90 transition-transform duration-300" />
                            </button>
                        </div>
                        <div className="w-full flex-1 overflow-hidden relative bg-[#0b0f19]">
                            <iframe
                                src={`https://finance.naver.com/item/main.naver?code=${naverEtfCode}`}
                                className="w-full h-full border-none"
                                style={{ filter: "invert(0.92) hue-rotate(180deg)" }}
                                allowFullScreen
                            />
                        </div>
                    </div>
                </div>
            )}
            {/* ===== 포트폴리오 마켓 팝업 ===== */}
            {isMarketOpen && (
                <div className="fixed inset-0 z-[210] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-200 p-3 md:p-6">
                    <div className="bg-[#0f111a] border border-purple-500/20 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl shadow-purple-900/20">
                        <div className="flex justify-between items-center p-4 border-b border-white/10 bg-purple-500/5">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                <Store className="w-5 h-5 text-purple-400" /> 포트폴리오 마켓
                                <span className="text-xs text-gray-500 font-normal ml-1">공유된 포트폴리오를 즐겨찾기에 추가하세요</span>
                            </h2>
                            <div className="flex items-center gap-2">
                                <button onClick={fetchMarket} title="새로고침" className="p-2 text-gray-400 hover:text-purple-300 transition-colors">
                                    <RefreshCw className={`w-4 h-4 ${marketLoading ? 'animate-spin' : ''}`} />
                                </button>
                                <button onClick={() => { setIsMarketOpen(false); setDeletingMarketId(null); setDeletePin(''); setDeleteError(''); }}
                                    className="p-2 text-gray-400 hover:text-white bg-white/5 rounded-xl transition-colors">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                        <div className="px-4 pt-3">
                            <button onClick={() => { setIsMarketOpen(false); setIsFavModalOpen(true); }}
                                className="text-xs text-gray-500 hover:text-purple-300 transition-colors">
                                ← 즐겨찾기로 돌아가기
                            </button>
                        </div>
                        <div className="p-4 overflow-y-auto flex-1 custom-scrollbar">
                            {marketLoading ? (
                                <div className="flex items-center justify-center py-16 text-gray-500">
                                    <RefreshCw className="w-6 h-6 animate-spin mr-2" /> 불러오는 중...
                                </div>
                            ) : marketList.length === 0 ? (
                                <div className="text-center py-16 text-gray-500 text-sm">아직 공유된 포트폴리오가 없습니다.</div>
                            ) : (
                                <div className="space-y-3">
                                    {marketList.map(portfolio => (
                                        <div key={portfolio.id} className="bg-white/[0.03] border border-white/10 rounded-xl p-4 hover:border-purple-500/30 transition-colors">
                                            <div className="flex justify-between items-start gap-3">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="font-bold text-white">{portfolio.name}</span>
                                                        <span className="text-xs text-gray-500 bg-white/5 px-2 py-0.5 rounded-full">{portfolio.items.length}종목</span>
                                                        <span className="text-xs text-purple-400 flex items-center gap-0.5"><Download className="w-3 h-3" />{portfolio.download_count}</span>
                                                    </div>
                                                    <div className="text-xs text-gray-500 mb-2">
                                                        by <span className="text-gray-400 font-semibold">{portfolio.author}</span>
                                                        <span className="ml-2">{portfolio.created_at}</span>
                                                    </div>
                                                    <div className="flex flex-wrap gap-1">
                                                        {portfolio.items.slice(0, 6).map((item: any) => (
                                                            <span key={item.code} className="text-[10px] bg-white/5 border border-white/10 px-2 py-0.5 rounded text-gray-400">{item.name}</span>
                                                        ))}
                                                        {portfolio.items.length > 6 && <span className="text-[10px] text-gray-600">+{portfolio.items.length - 6}개 더</span>}
                                                    </div>
                                                </div>
                                                <div className="flex flex-col gap-2 flex-shrink-0 min-w-[110px]">
                                                    <button onClick={() => handleDownload(portfolio)}
                                                        className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-bold transition-colors">
                                                        <Download className="w-4 h-4" /> 추가
                                                    </button>
                                                    {deletingMarketId === portfolio.id ? (
                                                        <div className="flex flex-col gap-1">
                                                            <input placeholder="PIN" type="password" maxLength={8}
                                                                value={deletePin}
                                                                onChange={e => { setDeletePin(e.target.value); setDeleteError(''); }}
                                                                className="bg-black/60 border border-rose-500/30 rounded px-2 py-1 text-xs text-white w-full focus:outline-none focus:ring-1 focus:ring-rose-500" />
                                                            {deleteError && <span className="text-[10px] text-rose-400">{deleteError}</span>}
                                                            <div className="flex gap-1">
                                                                <button onClick={() => handleMarketDelete(portfolio.id)}
                                                                    className="flex-1 px-2 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded text-xs font-bold">삭제</button>
                                                                <button onClick={() => { setDeletingMarketId(null); setDeletePin(''); setDeleteError(''); }}
                                                                    className="flex-1 px-2 py-1 bg-white/10 text-gray-300 rounded text-xs">취소</button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <button onClick={() => { setDeletingMarketId(portfolio.id); setDeleteError(''); }}
                                                            className="flex items-center gap-1 px-3 py-1.5 bg-white/5 hover:bg-rose-500/10 text-gray-500 hover:text-rose-400 border border-white/5 hover:border-rose-500/30 rounded-lg text-xs transition-colors">
                                                            <Lock className="w-3 h-3" /> PIN 삭제
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
