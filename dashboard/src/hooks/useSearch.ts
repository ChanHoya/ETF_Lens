import { useState, useEffect } from 'react';

const BRAND_KEYWORDS = ['1Q', 'ACE', 'HANARO', 'KIWOOM', 'KODEX', 'KoAct', 'PLUS', 'RISE', 'SOL', 'TIGER', 'TIME'];
const THEME_KEYWORDS = ['커버드콜', '배당', 'AI', '반도체', '로봇', '원자력', '2차전지', '조선', '방산', '금융', '바이오'];

export function useSearch(etfDictionary: { code: string, name: string }[]) {
    const [slots, setSlots] = useState<{ search: string, code: string }[]>([
        { search: "", code: "" },
        { search: "", code: "" },
        { search: "", code: "" },
        { search: "", code: "" },
        { search: "", code: "" },
        { search: "", code: "" },
        { search: "", code: "" },
        { search: "", code: "" },
        { search: "", code: "" },
        { search: "", code: "" },
    ]);
    const [globalSearch, setGlobalSearch] = useState("");
    const [globalActive, setGlobalActive] = useState(false);
    const [activeDropdownIndex, setActiveDropdownIndex] = useState<number | null>(null);
    const [dropdownLimit, setDropdownLimit] = useState(50);
    const [focusedGlobalIndex, setFocusedGlobalIndex] = useState<number>(-1);
    const [focusedSlotIndex, setFocusedSlotIndex] = useState<number>(-1);

    useEffect(() => {
        if (typeof window !== "undefined") {
            const savedSlots = localStorage.getItem('etf_current_slots');
            if (savedSlots) {
                try {
                    const parsed = JSON.parse(savedSlots);
                    if (Array.isArray(parsed) && parsed.length === 10) {
                        setSlots(parsed);
                    }
                } catch (e) { }
            }
        }
    }, []);

    useEffect(() => {
        if (typeof window !== "undefined") {
            localStorage.setItem('etf_current_slots', JSON.stringify(slots));
        }
    }, [slots]);

    const clearSlot = (index: number) => {
        const newSlots = [...slots];
        newSlots[index] = { search: "", code: "" };
        setSlots(newSlots);
    };

    const clearAllSlots = () => {
        setSlots(Array(10).fill({ search: "", code: "" }));
        if (typeof window !== "undefined") {
            localStorage.removeItem('etf_current_slots');
        }
        setGlobalSearch("");
    };

    const selectEtfGlobal = (code: string, name: string, isMulti: boolean = false) => {
        if (slots.some(s => s.code === code)) return; // Prevent duplicate

        const newSlots = [...slots];
        const emptyIndex = newSlots.findIndex(s => !s.search);
        if (emptyIndex !== -1) {
            newSlots[emptyIndex] = { search: name, code: code };
            setSlots(newSlots);
        } else {
            alert("모든 슬롯이 꽉 찼습니다. 기존 종목을 지우고 추가해주세요.");
        }

        if (!isMulti) {
            setGlobalSearch("");
            setGlobalActive(false);
            setFocusedGlobalIndex(-1);
        }
    };

    const addAllFilteredEtfs = () => {
        const terms = globalSearch.toLowerCase().split(' ').filter(t => t.trim() !== '');
        if (terms.length < 1) return;

        const filtered = etfDictionary.filter(etf => {
            const lowerBrands = BRAND_KEYWORDS.map(b => b.toLowerCase());
            const brandTerms = terms.filter(t => lowerBrands.includes(t));
            const themeTerms = terms.filter(t => !lowerBrands.includes(t));

            const etfName = etf.name.toLowerCase().replace(/\s/g, '');
            const etfCode = etf.code.toLowerCase();

            const brandMatch = brandTerms.length === 0 ? true : brandTerms.some(term => etfName.includes(term) || etfCode.includes(term));
            const themeMatch = themeTerms.length === 0 ? true : themeTerms.some(term => etfName.includes(term) || etfCode.includes(term));

            return brandMatch && themeMatch;
        });

        if (filtered.length === 0) return;

        let newSlots = [...slots];
        let addedCount = 0;

        for (const etf of filtered) {
            if (!newSlots.some(s => s.code === etf.code)) {
                const emptyIndex = newSlots.findIndex(s => !s.search);
                if (emptyIndex !== -1) {
                    newSlots[emptyIndex] = { search: etf.name, code: etf.code };
                    addedCount++;
                } else {
                    break; // Full
                }
            }
        }

        if (addedCount > 0) {
            setSlots(newSlots);
            setGlobalSearch("");
            setGlobalActive(false);
            setFocusedGlobalIndex(-1);
        }
    };

    const updateSearch = (index: number, value: string) => {
        const newSlots = [...slots];
        newSlots[index].search = value;
        newSlots[index].code = ""; // clear code until selected exactly
        setSlots(newSlots);
        setActiveDropdownIndex(index);
        setDropdownLimit(50);
    };

    const selectEtf = (index: number, code: string, name: string) => {
        const newSlots = [...slots];
        newSlots[index] = { search: name, code: code };
        setSlots(newSlots);
        setActiveDropdownIndex(null);
    };

    return {
        slots, setSlots,
        globalSearch, setGlobalSearch,
        globalActive, setGlobalActive,
        activeDropdownIndex, setActiveDropdownIndex,
        dropdownLimit, setDropdownLimit,
        focusedGlobalIndex, setFocusedGlobalIndex,
        focusedSlotIndex, setFocusedSlotIndex,
        clearSlot,
        clearAllSlots,
        selectEtfGlobal,
        addAllFilteredEtfs,
        updateSearch,
        selectEtf,
        BRAND_KEYWORDS,
        THEME_KEYWORDS
    };
}
