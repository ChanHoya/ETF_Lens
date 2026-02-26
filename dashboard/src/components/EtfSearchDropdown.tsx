import React from 'react';
import { Search, Loader2, Plus, X, ChevronDown, Check } from "lucide-react";

type EtfSearchDropdownProps = {
    slots: { search: string, code: string }[];
    globalSearch: string;
    setGlobalSearch: (val: string) => void;
    globalActive: boolean;
    setGlobalActive: (val: boolean) => void;
    activeDropdownIndex: number | null;
    dropdownLimit: number;
    focusedGlobalIndex: number;
    focusedSlotIndex: number;
    etfDictionary: { code: string, name: string }[];
    clearSlot: (index: number) => void;
    clearAllSlots: () => void;
    selectEtfGlobal: (code: string, name: string, isMulti?: boolean) => void;
    addAllFilteredEtfs: () => void;
    updateSearch: (index: number, value: string) => void;
    selectEtf: (index: number, code: string, name: string) => void;
    BRAND_KEYWORDS: string[];
    THEME_KEYWORDS: string[];
    handleDropdownScroll: (e: React.UIEvent<HTMLDivElement>) => void;
};

export default function EtfSearchDropdown({
    slots, globalSearch, setGlobalSearch, globalActive, setGlobalActive,
    activeDropdownIndex, dropdownLimit, focusedGlobalIndex, focusedSlotIndex,
    etfDictionary, clearSlot, clearAllSlots, selectEtfGlobal, addAllFilteredEtfs,
    updateSearch, selectEtf, BRAND_KEYWORDS, THEME_KEYWORDS, handleDropdownScroll
}: EtfSearchDropdownProps) {

    // Global search filtering (AND/OR logic)
    const renderGlobalDropdown = () => {
        if (!globalSearch.trim() && !globalActive) return null;

        const terms = globalSearch.toLowerCase().split(' ').filter(t => t.trim() !== '');
        const lowerBrands = BRAND_KEYWORDS.map(b => b.toLowerCase());
        const brandTerms = terms.filter(t => lowerBrands.includes(t));
        const themeTerms = terms.filter(t => !lowerBrands.includes(t));

        const filtered = etfDictionary.filter(etf => {
            const etfName = etf.name.toLowerCase().replace(/\s/g, '');
            const etfCode = etf.code.toLowerCase();

            const brandMatch = brandTerms.length === 0 ? true : brandTerms.some(term => etfName.includes(term) || etfCode.includes(term));
            const themeMatch = themeTerms.length === 0 ? true : themeTerms.some(term => etfName.includes(term) || etfCode.includes(term));

            return brandMatch && themeMatch;
        }).slice(0, dropdownLimit);

        if (filtered.length === 0 && globalSearch.trim()) return null;

        return (
            <div
                className="absolute z-[100] w-full mt-2 bg-gray-900 border border-gray-700/50 rounded-xl shadow-2xl overflow-y-auto max-h-[300px] backdrop-blur-xl"
                onScroll={handleDropdownScroll}
            >
                <div className="sticky top-0 bg-gray-900/95 backdrop-blur-md p-2 border-b border-gray-700/50 flex justify-between items-center z-10">
                    <span className="text-xs text-gray-400 font-medium px-2">종목 검색 결과</span>
                    {globalSearch.trim() && filtered.length > 0 && (
                        <button
                            onClick={addAllFilteredEtfs}
                            className="text-xs bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/40 hover:text-indigo-300 font-bold px-3 py-1 rounded-md transition-colors flex items-center gap-1"
                        >
                            <Plus size={12} />일괄 선택 (최대 10개)
                        </button>
                    )}
                </div>
                <ul>
                    {filtered.map((etf, i) => {
                        const isSelected = slots.some(s => s.code === etf.code);
                        return (
                            <li
                                key={etf.code}
                                id={`global-item-${i}`}
                                onClick={() => selectEtfGlobal(etf.code, etf.name, false)}
                                className={`px-4 py-3 cursor-pointer border-b border-gray-800/30 flex justify-between items-center group transition-colors ${focusedGlobalIndex === i ? 'bg-indigo-500/20' : 'hover:bg-gray-800'
                                    } ${isSelected ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                <div className="flex flex-col">
                                    <span className={`text-sm font-medium ${focusedGlobalIndex === i ? 'text-indigo-400' : 'text-gray-200 group-hover:text-white'}`}>{etf.name}</span>
                                    <span className="text-xs text-gray-500">{etf.code}</span>
                                </div>
                                {isSelected && <Check size={16} className="text-green-500" />}
                            </li>
                        );
                    })}
                </ul>
            </div>
        );
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 relative">
            <div className="lg:col-span-1 space-y-4">
                {/* Global Search and Quick Filters */}
                <div className="relative z-50">
                    {/* Quick Filters */}
                    <div className="flex flex-wrap gap-x-2 gap-y-2 mb-3 items-center">
                        <span className="text-xs text-gray-400 font-semibold mr-1">운용사</span>
                        {BRAND_KEYWORDS.map(brand => (
                            <button
                                key={brand}
                                onClick={() => setGlobalSearch(prev => prev.includes(brand) ? prev.replace(brand, '').trim() : `${prev} ${brand}`.trim())}
                                className={`text-xs px-2.5 py-1 rounded-full border transition-all ${globalSearch.includes(brand) ? 'bg-sky-500/20 border-sky-400/50 text-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.2)]' : 'bg-gray-800/50 border-gray-700 text-gray-400 hover:bg-gray-700 hover:text-gray-300'}`}
                            >
                                {brand}
                            </button>
                        ))}
                        <div className="w-full h-px bg-gray-800/50 my-1 hidden sm:block"></div>
                        <span className="text-xs text-gray-400 font-semibold mr-1">테마🔥</span>
                        {THEME_KEYWORDS.map(theme => (
                            <button
                                key={theme}
                                onClick={() => setGlobalSearch(prev => prev.includes(theme) ? prev.replace(theme, '').trim() : `${prev} ${theme}`.trim())}
                                className={`text-xs px-2.5 py-1 rounded-full border transition-all ${globalSearch.includes(theme) ? 'bg-rose-500/20 border-rose-400/50 text-rose-400 shadow-[0_0_10px_rgba(251,113,133,0.2)]' : 'bg-gray-800/50 border-gray-700 text-gray-400 hover:bg-gray-700 hover:text-gray-300'}`}
                            >
                                {theme}
                            </button>
                        ))}
                    </div>

                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder="단어 조합하여 복수 검색 (예: KODEX 반도체)"
                            className="w-full bg-gray-900/80 border border-gray-700/50 text-white text-sm rounded-xl pl-10 pr-10 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all placeholder:text-gray-500"
                            value={globalSearch}
                            onChange={(e) => {
                                setGlobalSearch(e.target.value);
                                setGlobalActive(true);
                            }}
                            onFocus={() => {
                                setGlobalActive(true);
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    addAllFilteredEtfs();
                                }
                            }}
                        />
                        {globalSearch && (
                            <button onClick={() => setGlobalSearch("")} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white">
                                <X size={16} />
                            </button>
                        )}
                    </div>
                    {renderGlobalDropdown()}
                </div>

                {/* Selected Slots */}
                <div className="flex justify-between items-end mb-2 mt-6">
                    <h3 className="text-sm font-bold text-gray-300">선택된 종목 ({slots.filter(s => s.code).length}/10)</h3>
                    <button onClick={clearAllSlots} className="text-xs text-gray-500 hover:text-red-400 transition-colors flex items-center gap-1">
                        <Trash2 size={12} /> 모두 삭제
                    </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3 relative z-40">
                    {slots.map((slot, idx) => (
                        <div key={idx} className="relative group">
                            <div className={`flex items-center bg-gray-800/40 border transition-all rounded-xl overflow-hidden ${slot.code ? 'border-indigo-500/50 shadow-[0_0_15px_rgba(99,102,241,0.15)] bg-indigo-900/10' : 'border-gray-700/30 hover:border-gray-600'}`}>
                                <div className={`w-8 h-full flex items-center justify-center font-bold text-xs ${slot.code ? 'bg-indigo-500/20 text-indigo-400' : 'bg-gray-800 text-gray-500'}`}>
                                    {idx + 1}
                                </div>
                                <input
                                    type="text"
                                    placeholder="종목 검색"
                                    className="w-full bg-transparent text-white text-sm px-3 py-2.5 outline-none placeholder:text-gray-600"
                                    value={slot.search}
                                    onChange={(e) => updateSearch(idx, e.target.value)}
                                    onFocus={() => activeDropdownIndex !== idx && updateSearch(idx, slot.search)}
                                />
                                {slot.search && (
                                    <button onClick={() => clearSlot(idx)} className="px-3 text-gray-500 hover:text-white transition-colors">
                                        <X size={14} />
                                    </button>
                                )}
                            </div>

                            {/* Individual Slot Dropdown */}
                            {activeDropdownIndex === idx && slot.search && !slot.code && (
                                <div
                                    className="absolute z-[100] w-full mt-1 bg-gray-900 border border-gray-700/50 rounded-xl shadow-2xl overflow-y-auto max-h-[250px] backdrop-blur-xl"
                                    onScroll={handleDropdownScroll}
                                >
                                    <ul>
                                        {etfDictionary
                                            .filter(etf => etf.name.toLowerCase().replace(/\s/g, '').includes(slot.search.toLowerCase().replace(/\s/g, '')))
                                            .slice(0, dropdownLimit)
                                            .map((etf, i) => {
                                                const isAlreadySelected = slots.some((s, sIdx) => s.code === etf.code && sIdx !== idx);
                                                return (
                                                    <li
                                                        key={etf.code}
                                                        id={`slot-item-${i}`}
                                                        onClick={() => !isAlreadySelected && selectEtf(idx, etf.code, etf.name)}
                                                        className={`px-4 py-3 cursor-pointer border-b border-gray-800/30 flex justify-between items-center group transition-colors ${focusedSlotIndex === i ? 'bg-indigo-500/20' : 'hover:bg-gray-800'} ${isAlreadySelected ? 'opacity-50 cursor-not-allowed bg-gray-800/50' : ''}`}
                                                    >
                                                        <span className={`text-sm ${isAlreadySelected ? 'text-gray-500' : (focusedSlotIndex === i ? 'text-indigo-400 font-medium' : 'text-gray-300 group-hover:text-white')}`}>
                                                            {etf.name}
                                                        </span>
                                                        {isAlreadySelected && <span className="text-xs text-rose-400 font-medium">선택됨</span>}
                                                    </li>
                                                );
                                            })}
                                        {etfDictionary.filter(etf => etf.name.toLowerCase().replace(/\s/g, '').includes(slot.search.toLowerCase().replace(/\s/g, ''))).length === 0 && (
                                            <li className="px-4 py-4 text-sm text-gray-500 text-center">검색 결과가 없습니다</li>
                                        )}
                                    </ul>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
