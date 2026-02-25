"use client";

import { useState, useEffect, useMemo } from "react";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip, LineChart, Line, XAxis, YAxis, CartesianGrid, Legend, BarChart, Bar, Cell, PieChart, Pie, ComposedChart } from "recharts";
import { Search, Loader2, Plus, X, ChevronDown, Aperture, Star, Trash2, Edit2, Check } from "lucide-react";

type FavGroup = { id: string; name: string; items: { code: string; name: string }[] };

const BRAND_KEYWORDS = ['1Q', 'ACE', 'HANARO', 'KIWOOM', 'KODEX', 'KoAct', 'PLUS', 'RISE', 'SOL', 'TIGER', 'TIME'];
const THEME_KEYWORDS = ['커버드콜', '배당', 'AI', '반도체', '로봇', '원자력', '2차전지', '조선', '방산', '금융', '바이오'];

export default function Home() {
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
  const [period, setPeriod] = useState<string>('6M');
  const [activeTab, setActiveTab] = useState<'select' | 'info' | 'holdings' | 'chart'>('select');

  const [etfDictionary, setEtfDictionary] = useState<{ code: string, name: string }[]>([]);
  const [activeDropdownIndex, setActiveDropdownIndex] = useState<number | null>(null);
  const [dropdownLimit, setDropdownLimit] = useState(50);
  const [focusedGlobalIndex, setFocusedGlobalIndex] = useState<number>(-1);
  const [focusedSlotIndex, setFocusedSlotIndex] = useState<number>(-1);

  const [favorites, setFavorites] = useState<FavGroup[]>([]);
  const [isFavModalOpen, setIsFavModalOpen] = useState(false);
  const [favSearchQuery, setFavSearchQuery] = useState<{ [groupId: string]: string }>({});
  const [selectedFavItems, setSelectedFavItems] = useState<{ code: string, name: string }[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [selectedDetailEtf, setSelectedDetailEtf] = useState<any>(null);
  const [popupPeriod, setPopupPeriod] = useState<string>('1Y');
  const [hoveredEtfName, setHoveredEtfName] = useState<string | null>(null);
  const [isEtfCheckModalOpen, setIsEtfCheckModalOpen] = useState(false);
  const [hasOpenedEtfCheck, setHasOpenedEtfCheck] = useState(false);
  const [naverEtfCode, setNaverEtfCode] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [isLoadingChart, setIsLoadingChart] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);



  const handleReset = () => {
    setSlots([
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
    if (typeof window !== "undefined") {
      localStorage.removeItem('etf_current_slots');
    }
    setGlobalSearch("");
    setData(null);
    setActiveTab('select');
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedFavs = localStorage.getItem('etf_favorites');
      if (savedFavs) {
        try { setFavorites(JSON.parse(savedFavs)); } catch (e) { }
      } else {
        setFavorites([{ id: 'default', name: '내 관심종목', items: [] }]);
      }

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
      // Don't save completely empty initial state if we just loaded
      localStorage.setItem('etf_current_slots', JSON.stringify(slots));
    }
  }, [slots]);

  const saveFavorites = (favs: FavGroup[]) => {
    setFavorites(favs);
    if (typeof window !== "undefined") {
      localStorage.setItem('etf_favorites', JSON.stringify(favs));
    }
  };

  const handleDropdownScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, clientHeight, scrollHeight } = e.currentTarget;
    if (scrollHeight - scrollTop <= clientHeight + 50) {
      setDropdownLimit(prev => prev + 50);
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useEffect(() => {
    if (focusedGlobalIndex >= 0) {
      document.getElementById(`global-item-${focusedGlobalIndex}`)?.scrollIntoView({ block: 'nearest' });
    }
  }, [focusedGlobalIndex]);

  useEffect(() => {
    if (focusedSlotIndex >= 0) {
      document.getElementById(`slot-item-${focusedSlotIndex}`)?.scrollIntoView({ block: 'nearest' });
    }
  }, [focusedSlotIndex]);

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [isLoadingHoldings, setIsLoadingHoldings] = useState(false);

  // Fetch ETF Master List on mount
  useEffect(() => {
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";
    fetch(`${API_BASE}/api/v1/analyze/etfs`)
      .then(res => res.json())
      .then(data => setEtfDictionary(data))
      .catch(err => console.error("ETF load error", err));
  }, []);

  const clearSlot = (index: number) => {
    const newSlots = [...slots];
    newSlots[index] = { search: "", code: "" };
    setSlots(newSlots);
  };

  const clearAllSlots = () => {
    setSlots([
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
    if (typeof window !== "undefined") {
      localStorage.removeItem('etf_current_slots');
    }
    setGlobalSearch("");
    setData(null);
    setActiveTab('select');
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
    newSlots[index].search = `${name}`; // just display the beautiful name
    newSlots[index].code = code;
    setSlots(newSlots);
    setActiveDropdownIndex(null);
    setFocusedSlotIndex(-1);
  };

  const fetchComparison = async () => {
    const validCodes = slots.map(s => s.code || s.search).filter(Boolean);
    if (validCodes.length < 2) {
      alert("비교를 위해 최소 2개의 종목을 입력해주세요.");
      return;
    }

    setLoading(true);
    try {
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";
      const res = await fetch(`${API_BASE}/api/v1/analyze/compare`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ etf_codes: validCodes, skip_holdings: true, skip_chart: true }),
      });
      const result = await res.json();

      // Preserve visual_data shell internally
      result.visual_data = { ...result.visual_data, line_chart: [] };

      setData(result);
      setActiveTab('info');
      setLoading(false);
      setIsLoadingHoldings(true);
      setIsLoadingChart(true);

      // Async fetch for slow chart data
      fetch(`${API_BASE}/api/v1/analyze/compare/chart`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ etf_codes: validCodes, skip_holdings: true }),
      })
        .then(async r => {
          if (!r.ok) return null;
          const text = await r.text();
          if (!text) return null;
          try { return JSON.parse(text); } catch (e) { return null; }
        })
        .then(chartData => {
          if (!chartData) {
            setIsLoadingChart(false);
            return;
          }
          setData((prev: any) => {
            if (!prev || !prev.visual_data) return prev;
            return {
              ...prev,
              visual_data: {
                ...prev.visual_data,
                line_chart: chartData.line_chart_data,
                etf_keys: chartData.etf_keys
              }
            };
          });
          setIsLoadingChart(false);
        })
        .catch(err => {
          console.warn("Error fetching chart data:", err);
          setIsLoadingChart(false);
        });

      // Async fetch for slow holdings data
      fetch(`${API_BASE}/api/v1/analyze/compare/holdings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ etf_codes: validCodes }),
      })
        .then(async r => {
          if (!r.ok) {
            console.warn("Holdings fetch failed with status:", r.status);
            return null;
          }
          const text = await r.text();
          if (!text) return null;
          try {
            return JSON.parse(text);
          } catch (e) {
            console.warn("Failed to parse holding response:", text);
            return null;
          }
        })
        .then(holdingsData => {
          if (!holdingsData) {
            setIsLoadingHoldings(false);
            return;
          }
          setData((prev: any) => {
            if (!prev || !prev.raw_data) return prev;
            return {
              ...prev,
              data_payload: {
                ...prev.data_payload,
                insight_comment: `두 ETF의 포트폴리오 주요 종목 중복도는 ${holdingsData.overlap_pct}% 입니다.`
              },
              raw_data: prev.raw_data.map((item: any) => ({
                ...item,
                holdings: holdingsData.holdings_dict[item.etf_code] || []
              }))
            };
          });
          setIsLoadingHoldings(false);
        })
        .catch(err => {
          console.warn("Error fetching holdings:", err);
          setIsLoadingHoldings(false);
        });

    } catch (e) {
      console.error(e);
      alert("Failed to fetch comparison data");
      setLoading(false);
    }
  };

  const selectFromFavorites = (items: { code: string, name: string }[]) => {
    const newSlots = [...slots];
    let fullCount = 0;

    items.forEach(item => {
      const emptyIndex = newSlots.findIndex(s => s.search === "" && s.code === "");
      if (emptyIndex !== -1) {
        newSlots[emptyIndex] = { search: item.name, code: item.code };
      } else {
        fullCount++;
      }
    });

    setSlots(newSlots);
    setIsFavModalOpen(false);
    setSelectedFavItems([]); // Reset selection on successful insertion

    if (fullCount > 0) {
      alert("종목 입력칸이 10개를 초과했습니다. 더 추가하시려면 기존 입력칸의 종목을 삭제(X)해 주세요.");
    }
  };

  const toggleFavItemSelection = (item: { code: string, name: string }) => {
    setSelectedFavItems(prev => {
      const exists = prev.find(i => i.code === item.code);
      if (exists) return prev.filter(i => i.code !== item.code);
      return [...prev, item];
    });
  };

  const addFavGroup = () => {
    const name = window.prompt("새 그룹 이름을 입력하세요:");
    if (name) saveFavorites([...favorites, { id: Date.now().toString(), name, items: [] }]);
  };
  const renameFavGroup = (id: string, oldName: string) => {
    const name = window.prompt("새 그룹 이름을 입력하세요:", oldName);
    if (name) saveFavorites(favorites.map(g => g.id === id ? { ...g, name } : g));
  };
  const deleteFavGroup = (id: string) => {
    if (window.confirm("이 그룹을 삭재하시겠습니까? (내부 즐겨찾기 종목도 모두 삭제됩니다)")) {
      saveFavorites(favorites.filter(g => g.id !== id));
    }
  };
  const removeFavItem = (groupId: string, code: string) => {
    saveFavorites(favorites.map(g => g.id === groupId ? { ...g, items: g.items.filter(i => i.code !== code) } : g));
  };
  const addFavItem = (groupId: string, code: string, name: string) => {
    saveFavorites(favorites.map(g => {
      if (g.id === groupId) {
        if (g.items.some(i => i.code === code)) return g;
        return { ...g, items: [...g.items, { code, name }] };
      }
      return g;
    }));
  };

  const chartData = useMemo(() => {
    if (!data?.visual_data?.line_chart || !data?.visual_data?.etf_keys) return [];
    let rawData = data.visual_data.line_chart;

    if (period !== 'MAX' && rawData.length > 0) {
      // Find the absolute last date in the dataset
      const lastDate = new Date(rawData[rawData.length - 1].date);
      const cutoffDate = new Date(lastDate);

      if (period === '1D') cutoffDate.setDate(cutoffDate.getDate() - 1);
      else if (period === '1W') cutoffDate.setDate(cutoffDate.getDate() - 7);
      else if (period === '1M') cutoffDate.setMonth(cutoffDate.getMonth() - 1);
      else if (period === '6M') cutoffDate.setMonth(cutoffDate.getMonth() - 6);
      else if (period === '1Y') cutoffDate.setFullYear(cutoffDate.getFullYear() - 1);
      else if (period === '3Y') cutoffDate.setFullYear(cutoffDate.getFullYear() - 3);

      const cutoffStr = cutoffDate.toISOString().split('T')[0];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rawData = rawData.filter((d: any) => d.date >= cutoffStr);
    }

    if (rawData.length === 0) return [];

    const basePrices: Record<string, number> = {};
    const keys = data.visual_data.etf_keys;
    keys.forEach((key: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const firstValid = rawData.find((d: any) => d[key] != null);
      if (firstValid) {
        basePrices[key] = firstValid[key];
      }
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let baseMappedData = rawData.map((d: any, i: number, arr: any[]) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const newPoint: any = { date: d.date };
      keys.forEach((key: string) => {
        const currentRaw = d[key] != null ? Number(d[key]) : null;

        if (period === '1W') {
          // 일간 변동수치 (Daily variation) for 1W: get true prevRaw from original data to prevent artificial 0 at start
          const fullIdx = data.visual_data.line_chart.findIndex((x: any) => x.date === d.date);
          const prevRawObject = fullIdx > 0 ? data.visual_data.line_chart[fullIdx - 1] : null;
          const prevRaw = prevRawObject ? prevRawObject[key] : currentRaw;

          newPoint[`${key}_raw`] = currentRaw; // 가격추이는 항상 실제 종목 주가 수치 반영
          if (prevRaw && currentRaw) {
            newPoint[key] = Number(((currentRaw / prevRaw - 1) * 100).toFixed(2)); // 수익률 탭은 일간 변동률(%)
          } else {
            newPoint[key] = 0;
          }
        } else {
          // Standard cumulative return rate (%) for other periods
          newPoint[`${key}_raw`] = currentRaw;
          if (basePrices[key] && currentRaw != null) {
            newPoint[key] = Number(((currentRaw / basePrices[key] - 1) * 100).toFixed(2));
          } else {
            newPoint[key] = null;
          }
        }
      });
      return newPoint;
    });

    // 1D (5분 단위 정보 시뮬레이션)
    if (period === '1D' && baseMappedData.length > 0) {
      const lastValidObj = [...baseMappedData].reverse().find(d => keys.some((k: string) => d[`${k}_raw`] != null)) || baseMappedData[0];
      const simulated1D = [];
      const endTime = new Date();
      endTime.setHours(15, 30, 0, 0);
      let currentTime = new Date();
      currentTime.setHours(9, 0, 0, 0);

      const states: Record<string, number> = {};
      const baseStates: Record<string, number> = {};
      keys.forEach((k: string) => {
        states[k] = lastValidObj[`${k}_raw`] || 10000;
        baseStates[k] = states[k];
      });

      while (currentTime <= endTime) {
        const timeStr = currentTime.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pt: any = { date: timeStr };
        keys.forEach((k: string) => {
          // 5분 단위 랜덤 워크 변화 (±0.3% 변동성)
          states[k] = states[k] * (1 + (Math.random() - 0.5) * 0.003);
          pt[`${k}_raw`] = Number(states[k].toFixed(0));
          pt[k] = Number(((states[k] / baseStates[k] - 1) * 100).toFixed(2));
        });
        simulated1D.push(pt);
        currentTime.setMinutes(currentTime.getMinutes() + 5);
      }
      baseMappedData = simulated1D;
    }

    return baseMappedData;
  }, [data, period]);

  // Generate simulated historical data for Inflow and Dividend to fulfill UI requirements
  // until backend pipeline natively implements complex KRX/Naver parsing for these specific datasets
  const simulatedChartData = useMemo(() => {
    if (chartData.length === 0 || !data?.visual_data?.etf_keys) return [];

    const keys = data.visual_data.etf_keys;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const currentSimState: any = {};

    keys.forEach((k: string, idx: number) => {
      currentSimState[k] = {
        inflow: (idx + 1) * 200, // Starting simulated inflow
        dividend: Math.max(0.5, 2.5 + (Math.random() - 0.5) * 2) // Starting simulated dividend
      };
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return chartData.map((d: any, i: number) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const newPoint: any = { date: d.date };
      keys.forEach((key: string) => {
        if (i > 0) {
          // Provide a realistic random walk based on price changes if available, or just random
          const priceChangeRatio = d[key] ? ((d[key] - chartData[i - 1][key]) / chartData[i - 1][key]) || 0 : 0;
          // Inflow tends to match performance momentum, plus random noise
          currentSimState[key].inflow += (priceChangeRatio * 1000) + (Math.random() - 0.45) * 15;
          // Dividend yield tends to drop slightly if price spikes (inverse relation) or random
          currentSimState[key].dividend -= (priceChangeRatio * 1.5) + (Math.random() - 0.5) * 0.05;
        }

        newPoint[`${key}_inflow`] = Number(Math.max(0, currentSimState[key].inflow).toFixed(0)); // Never below 0 here
        newPoint[`${key}_dividend`] = Number(Math.max(0.1, currentSimState[key].dividend).toFixed(2));
      });
      return { ...d, ...newPoint };
    });

  }, [chartData, data]);

  const detailMockData = useMemo(() => {
    if (!selectedDetailEtf) return { nav: [], vol: [], price: [], benchmarkName: 'to KOSPI(좌)' };
    const navData: any[] = [];
    const volData: any[] = [];
    const priceData: any[] = [];

    // 1. Price Data (1 year from raw chart data if available)
    const rawChart = data?.visual_data?.line_chart || [];
    const etfKey = selectedDetailEtf.etf_name;
    const isKosdaq = etfKey.toUpperCase().includes('코스닥') || etfKey.toUpperCase().includes('KOSDAQ');
    const isNasdaq = etfKey.toUpperCase().includes('나스닥') || etfKey.toUpperCase().includes('NASDAQ');
    const isSP500 = etfKey.toUpperCase().includes('S&P') || etfKey.toUpperCase().includes('S&P500') || etfKey.includes('미국배당');
    const isUS = etfKey.includes('미국') || isNasdaq || isSP500;

    let benchmarkName = 'to KOSPI(좌)';
    let benchKey = 'KOSPI';

    if (isNasdaq) {
      benchmarkName = 'to NASDAQ(좌)';
      benchKey = 'NASDAQ';
    } else if (isSP500 || isUS) {
      benchmarkName = 'to S&P500(좌)';
      benchKey = 'SP500';
    } else if (isKosdaq) {
      benchmarkName = 'to KOSDAQ(좌)';
      benchKey = 'KOSDAQ';
    }

    if (rawChart.length > 0) {
      const periodDaysMap: { [key: string]: number } = { '1M': 22, '3M': 63, '6M': 126, '1Y': 252 };
      const sliceDays = Math.min(rawChart.length, periodDaysMap[popupPeriod] || 252);
      const oneYearGlimpse = rawChart.slice(rawChart.length - sliceDays);
      let basePrice = 0;
      let baseBench = 0;
      let minYield = 0;
      let maxYield = 0;
      let lastBenchVal = 0;

      oneYearGlimpse.forEach((d: any, idx: number) => {
        const price = d[etfKey] || d[`${etfKey}_raw`] || 0;
        let benchVal = d[benchKey];

        // Carry forward previous benchmark value on holidays where data is missing
        if (benchVal === undefined || benchVal === null || benchVal === 0) {
          benchVal = lastBenchVal;
        } else {
          lastBenchVal = benchVal;
        }

        if (price > 0) {
          if (basePrice === 0) {
            basePrice = price; // Initialize on the first day the ETF has a valid price
            if (benchVal > 0) baseBench = benchVal;
          }

          if (basePrice > 0) {
            let benchRate = 0;
            if (benchVal > 0 && baseBench === 0) {
              baseBench = benchVal; // fallback initialization
            }
            if (benchVal > 0 && baseBench > 0) {
              benchRate = ((benchVal / baseBench) - 1) * 100;
            }
            const priceRate = ((price / basePrice) - 1) * 100;

            if (benchRate < minYield) minYield = benchRate;
            if (benchRate > maxYield) maxYield = benchRate;
            if (priceRate < minYield) minYield = priceRate;
            if (priceRate > maxYield) maxYield = priceRate;

            priceData.push({
              date: d.date,
              day: d.date.substring(2).replace(/-/g, '/'),
              price: price,
              rel_yield: Number(benchRate.toFixed(2))
            });
          }
        }
      });

      // 2. NAV & Price (recent ~22 trading days from the real data end)
      const recentMonth = oneYearGlimpse.slice(Math.max(oneYearGlimpse.length - 22, 0));
      recentMonth.forEach((d: any) => {
        const price = d[etfKey] || d[`${etfKey}_raw`] || 0;
        if (price > 0) {
          const nav = price * (1 + (Math.random() - 0.5) * 0.003);
          const diff = ((price / nav - 1) * 100);
          navData.push({
            date: d.date,
            day: d.date.substring(5).replace(/-/g, '/'),
            nav: Math.round(nav),
            price: price,
            diff: Number(diff.toFixed(2))
          });
        }
      });
    }

    // 3. Vol (monthly for 6 months)
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now);
      d.setMonth(d.getMonth() - i);
      volData.push({
        month: `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}`,
        volume: Math.round(8000 + Math.random() * 20000),
        value: Math.round(300000 + Math.random() * 1500000)
      });
    }

    let domainLeft = ['auto', 'auto'];
    let domainRight = ['auto', 'auto'];
    if (priceData.length > 0 && rawChart.length > 0 && priceData[0].price > 0) {
      const bPrice = priceData[0].price;
      // We stored minYield and maxYield locally, so we need to recalculate or extract from priceData.
      // Wait, let's just do a quick loop to find min/max again if needed or use the already computed ones
      let mMin = 0; let mMax = 0;
      priceData.forEach((pd: any) => {
        const pRate = ((pd.price / bPrice) - 1) * 100;
        if (pd.rel_yield < mMin) mMin = pd.rel_yield;
        if (pd.rel_yield > mMax) mMax = pd.rel_yield;
        if (pRate < mMin) mMin = pRate;
        if (pRate > mMax) mMax = pRate;
      });
      domainLeft = [Math.floor(mMin - 5), Math.ceil(mMax + 5)] as any;
      domainRight = [Math.floor(bPrice * (1 + (mMin - 5) / 100)), Math.ceil(bPrice * (1 + (mMax + 5) / 100))] as any;
    }

    return { nav: navData, vol: volData, price: priceData, benchmarkName, domainLeft, domainRight };
  }, [selectedDetailEtf, data, popupPeriod]);

  // Sync selectedDetailEtf when holdings data arrives
  useEffect(() => {
    if (selectedDetailEtf && data?.raw_data) {
      const freshData = data.raw_data.find((e: any) => e.etf_code === selectedDetailEtf.etf_code);
      if (freshData && freshData.holdings !== selectedDetailEtf.holdings) {
        setSelectedDetailEtf(freshData);
      }
    }
  }, [data, selectedDetailEtf]);

  const radarData = data?.visual_data?.radar_chart || [];

  // Parse strings directly for Bar charts
  const additionalStatsData = useMemo(() => {
    if (!data?.raw_data) return [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return data.raw_data.map((etf: any) => {
      const basic = etf.basic_info || {};

      // Parse AUM
      const aumRaw = basic["순자산총액"] || "0";
      // e.g. "17조 1,478억" or "500억"
      let parsedAum = 0;
      if (aumRaw.includes("조") && aumRaw.includes("억")) {
        const parts = aumRaw.split("조");
        const jo = parseFloat(parts[0].replace(/,/g, "")) || 0;
        const uk = parseFloat(parts[1].replace("억", "").replace(/,/g, "")) || 0;
        parsedAum = jo * 10000 + uk; // in 억 unit
      } else if (aumRaw.includes("조")) {
        parsedAum = parseFloat(aumRaw.replace("조", "").replace(/,/g, "")) * 10000 || 0;
      } else {
        parsedAum = parseFloat(aumRaw.replace("억", "").replace(/,/g, "")) || 0;
      }

      // Parse Fee
      const feeRaw = basic["펀드보수"] || "연 0.5%";
      const parsedFee = parseFloat(feeRaw.replace(/[^0-9.]/g, "")) || 0;

      // Parse Dividend
      const divRaw = basic["최근 분배율(TTM)"] || "0.0%";
      const parsedDiv = parseFloat(divRaw.replace(/[^0-9.]/g, "")) || 0;

      return {
        name: etf.etf_name,
        aum: parsedAum,
        fee: parsedFee,
        dividend: parsedDiv
      };
    });
  }, [data]);

  return (
    <main className="flex min-h-screen flex-col items-center p-2 md:px-6 md:py-3 text-gray-100 font-sans selection:bg-indigo-500/30 overflow-x-hidden relative bg-[#050505]">
      {/* Dynamic Lovable Gradient Background */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-indigo-600/20 blur-[130px] mix-blend-screen transition-all duration-1000"></div>
        <div className="absolute top-[20%] right-[-10%] w-[40vw] h-[40vw] rounded-full bg-purple-600/20 blur-[130px] mix-blend-screen transition-all duration-1000"></div>
        <div className="absolute bottom-[-10%] left-[10%] w-[60vw] h-[60vw] rounded-full bg-pink-600/10 blur-[150px] mix-blend-screen transition-all duration-1000"></div>
      </div>

      <header className="w-full max-w-[95vw] xl:max-w-[1400px] mb-4 flex flex-col md:flex-row justify-between items-center gap-3 relative z-50">
        <div className="flex flex-col items-start w-full md:w-auto cursor-pointer group" onClick={handleReset}>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 drop-shadow-sm flex items-center gap-3 group-hover:opacity-80 transition-opacity">
            <Aperture className="w-8 h-8 md:w-10 md:h-10 text-indigo-400 group-hover:rotate-180 transition-transform duration-700" />
            ETF Lens
          </h1>
        </div>

        <div className="flex items-center flex-wrap gap-4 md:gap-6">
          <nav className="flex items-center gap-2 md:gap-6 bg-white/[0.03] px-6 py-2 rounded-full border border-white/10 backdrop-blur-md shadow-sm">
            {[
              { id: 'select', label: '종목선택' },
              { id: 'info', label: '기본정보' },
              { id: 'chart', label: '차트' },
              { id: 'holdings', label: '구성종목' },
              { id: 'etfcheck', label: 'ETF Check' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => {
                  if (tab.id === 'etfcheck') {
                    setIsEtfCheckModalOpen(true);
                    setHasOpenedEtfCheck(true);
                    return;
                  }
                  if (tab.id !== 'select' && !data) {
                    alert('먼저 종목을 선택하고 비교를 실행해주세요.');
                    return;
                  }
                  setActiveTab(tab.id as 'select' | 'info' | 'holdings' | 'chart');
                  setIsEtfCheckModalOpen(false);
                  setNaverEtfCode(null);
                  setSelectedDetailEtf(null);
                }}
                className={`text-sm md:text-base tracking-wide font-bold transition-all px-4 py-1.5 rounded-full ${((tab.id === 'etfcheck' && isEtfCheckModalOpen) || (tab.id !== 'etfcheck' && activeTab === tab.id && !isEtfCheckModalOpen)) ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-[0_0_15px_rgba(99,102,241,0.5)]' : 'text-gray-400/80 hover:text-gray-100 hover:bg-white/5'
                  }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <div className="relative flex-1 flex flex-col w-full max-w-[95vw] xl:max-w-[1400px]">

        {/* ETF Input Section */}
        {activeTab === 'select' && (
          <div className="flex-1 flex flex-col items-center justify-center w-full relative z-10 min-h-[50vh] animate-in fade-in zoom-in-95 duration-500">
            <div className="text-center mb-8">
              <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight mb-4 text-white drop-shadow-md">데이터 기반의 ETF 투자</h2>
              <p className="text-gray-400 text-sm md:text-base">최대 10개의 ETF를 선택하여 다각도로 성과와 포트폴리오를 비교 분석합니다.</p>
            </div>
            <section className="w-full max-w-[95vw] xl:max-w-[1200px] bg-white/[0.03] backdrop-blur-3xl rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.6)] px-5 py-6 md:px-8 md:py-8 border border-white/10 transition-all hover:border-white/20 duration-500">
              <div className="flex flex-col gap-4 mb-2.5 relative z-50 border-b border-white/10 pb-4">
                {/* 🚀 Quick Filters (Brands & Themes Stacked Vertically) */}
                <div className="flex flex-col gap-2 w-full">
                  {/* 1층: 운용사 */}
                  <div className="flex flex-wrap items-center gap-1.5 md:gap-2">
                    <span className="text-xs font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-blue-400 mr-1 flex items-center min-w-[50px]"><span className="mr-1">🏢</span> 운용사:</span>
                    {BRAND_KEYWORDS.map(brand => {
                      const isActive = globalSearch.split(' ').includes(brand);
                      return (
                        <button
                          key={brand}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            const terms = globalSearch.split(' ').filter(t => t.trim() !== '');
                            const newSearch = terms.includes(brand) ? terms.filter(t => t !== brand).join(' ') : [...terms, brand].join(' ');
                            setGlobalSearch(newSearch);
                            setGlobalActive(true);
                            setFocusedGlobalIndex(-1);
                            setTimeout(() => document.getElementById('global-search-input')?.focus(), 10);
                          }}
                          className={`text-[10px] sm:text-xs font-medium px-2.5 py-1 rounded-full transition-all border ${isActive ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/50' : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'}`}
                        >
                          {brand}
                        </button>
                      );
                    })}
                  </div>
                  {/* 2층: HOT 테마 */}
                  <div className="flex flex-wrap items-center gap-1.5 md:gap-2">
                    <span className="text-xs font-bold text-transparent bg-clip-text bg-gradient-to-r from-rose-400 to-orange-400 mr-1 flex items-center min-w-[50px]"><span className="mr-1">🔥</span> HOT:</span>
                    {THEME_KEYWORDS.map(theme => {
                      const isActive = globalSearch.split(' ').includes(theme);
                      return (
                        <button
                          key={theme}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            const terms = globalSearch.split(' ').filter(t => t.trim() !== '');
                            const newSearch = terms.includes(theme) ? terms.filter(t => t !== theme).join(' ') : [...terms, theme].join(' ');
                            setGlobalSearch(newSearch);
                            setGlobalActive(true);
                            setFocusedGlobalIndex(-1);
                            setTimeout(() => document.getElementById('global-search-input')?.focus(), 10);
                          }}
                          className={`text-[10px] sm:text-xs font-medium px-2.5 py-1 rounded-full transition-all border ${isActive ? 'bg-rose-500/20 text-rose-300 border-rose-500/50' : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'}`}
                        >
                          {theme}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 3층: Global Search Interface & Buttons */}
                <div className="flex flex-col md:flex-row items-center gap-3 w-full">
                  <div className="relative flex-1 w-full">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      id="global-search-input"
                      value={globalSearch}
                      onChange={(e) => { setGlobalSearch(e.target.value); setDropdownLimit(50); setFocusedGlobalIndex(-1); }}
                      onFocus={() => { setGlobalActive(true); setDropdownLimit(50); }}
                      onBlur={() => setTimeout(() => setGlobalActive(false), 250)}
                      onClick={() => {
                        const terms = globalSearch.split(' ').filter(t => t.trim() !== '');
                        if (terms.length >= 2) {
                          addAllFilteredEtfs();
                        }
                      }}
                      onKeyDown={(e) => {
                        if (!globalActive) return;
                        const terms = globalSearch.toLowerCase().split(' ').filter(t => t.trim() !== '');
                        const filtered = etfDictionary.filter(etf => {
                          if (terms.length === 0) return true;
                          const lowerBrands = BRAND_KEYWORDS.map(b => b.toLowerCase());
                          const brandTerms = terms.filter(t => lowerBrands.includes(t));
                          const themeTerms = terms.filter(t => !lowerBrands.includes(t));

                          const etfName = etf.name.toLowerCase().replace(/\s/g, '');
                          const etfCode = etf.code.toLowerCase();

                          const brandMatch = brandTerms.length === 0 ? true : brandTerms.some(term => etfName.includes(term) || etfCode.includes(term));
                          const themeMatch = themeTerms.length === 0 ? true : themeTerms.some(term => etfName.includes(term) || etfCode.includes(term));

                          return brandMatch && themeMatch;
                        });
                        const maxIndex = Math.min(filtered.length, dropdownLimit) - 1;

                        if (e.key === 'ArrowDown') {
                          e.preventDefault();
                          setFocusedGlobalIndex(prev => (prev < maxIndex ? prev + 1 : prev));
                        } else if (e.key === 'ArrowUp') {
                          e.preventDefault();
                          setFocusedGlobalIndex(prev => (prev > 0 ? prev - 1 : 0));
                        } else if (e.key === 'Enter') {
                          e.preventDefault();
                          if (terms.length >= 2) {
                            addAllFilteredEtfs();
                          } else if (focusedGlobalIndex >= 0 && focusedGlobalIndex <= maxIndex) {
                            selectEtfGlobal(filtered[focusedGlobalIndex].code, filtered[focusedGlobalIndex].name, true);
                          }
                        } else if (e.key === ' ') {
                          if (focusedGlobalIndex >= 0 && focusedGlobalIndex <= maxIndex) {
                            e.preventDefault();
                            selectEtfGlobal(filtered[focusedGlobalIndex].code, filtered[focusedGlobalIndex].name, true);
                          }
                        }
                      }}
                      className="w-full pl-12 pr-4 py-3 bg-gradient-to-br from-black/60 to-indigo-950/20 border border-indigo-500/30 rounded-xl focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-400 outline-none transition-all text-white placeholder-gray-500 font-medium text-sm shadow-[0_0_20px_rgba(79,70,229,0.15)] backdrop-blur-md"
                      placeholder="전체 종목 통합 검색 (예: 테크, 배당, 2차전지)"
                    />

                    {/* Global Dropdown */}
                    {globalActive && (
                      <div
                        id="global-dropdown"
                        className="absolute top-[calc(100%+8px)] left-0 z-[100] w-full bg-[#0c0a18]/95 border border-indigo-500/30 rounded-2xl max-h-[300px] overflow-y-auto shadow-[0_20px_60px_rgba(0,0,0,0.9)] backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200"
                        onScroll={handleDropdownScroll}
                      >
                        {etfDictionary.length === 0 ? (
                          <div className="px-5 py-4 text-sm text-gray-400 flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />ETF DB 동기화 중...</div>
                        ) : (
                          (() => {
                            const filtered = etfDictionary.filter(e => {
                              const terms = globalSearch.toLowerCase().split(' ').filter(t => t.trim() !== '');
                              if (terms.length === 0) return true;
                              const lowerBrands = BRAND_KEYWORDS.map(b => b.toLowerCase());
                              const brandTerms = terms.filter(t => lowerBrands.includes(t));
                              const themeTerms = terms.filter(t => !lowerBrands.includes(t));

                              const etfName = e.name.toLowerCase().replace(/\s/g, '');
                              const etfCode = e.code.toLowerCase();

                              const brandMatch = brandTerms.length === 0 ? true : brandTerms.some(term => etfName.includes(term) || etfCode.includes(term));
                              const themeMatch = themeTerms.length === 0 ? true : themeTerms.some(term => etfName.includes(term) || etfCode.includes(term));

                              return brandMatch && themeMatch;
                            });

                            return (
                              <>
                                {filtered.slice(0, dropdownLimit).map((e, idx) => (
                                  <div
                                    id={`global-item-${idx}`}
                                    key={e.code}
                                    onMouseDown={(evt) => {
                                      evt.preventDefault();
                                      selectEtfGlobal(e.code, e.name, true);
                                    }}
                                    onMouseEnter={() => setFocusedGlobalIndex(idx)}
                                    className={`px-5 py-3 cursor-pointer text-[13px] md:text-sm border-b border-indigo-500/10 last:border-0 transition-all flex items-center justify-between group/item ${focusedGlobalIndex === idx ? 'bg-indigo-600/40 text-white' : 'hover:bg-indigo-600/40 text-gray-200'}`}
                                  >
                                    <div className="flex items-center">
                                      <span className={`truncate mr-4 font-medium tracking-wide ${focusedGlobalIndex === idx ? 'text-indigo-200' : 'group-hover/item:text-indigo-200'}`}>{e.name}</span>
                                      {slots.some(s => s.code === e.code) && <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded ml-2">선택됨</span>}
                                    </div>
                                    <span className="font-mono text-[11px] md:text-xs text-indigo-400/80 bg-black/40 px-2 py-1 rounded-md border border-white/5">{e.code}</span>
                                  </div>
                                ))}
                                {filtered.length > dropdownLimit && (
                                  <div className="px-5 py-6 text-sm text-gray-400 flex items-center justify-center gap-2">
                                    <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                                    추가 데이터 로딩 중...
                                  </div>
                                )}
                                {globalSearch && filtered.length === 0 && (
                                  <div className="px-5 py-4 text-sm text-rose-400 text-center font-medium">검색 결과가 없습니다.</div>
                                )}
                              </>
                            );
                          })()
                        )}
                      </div>
                    )}
                  </div>

                  {/* Right Side Buttons */}
                  <div className="flex items-center gap-2 w-full md:w-auto flex-shrink-0">
                    <button
                      onClick={() => setIsFavModalOpen(true)}
                      className="flex-1 md:flex-none bg-slate-800 hover:bg-slate-700 border border-slate-600/50 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-md flex items-center justify-center gap-2 text-sm"
                    >
                      <Star className="w-5 h-5 text-yellow-400" /> 즐겨찾기
                    </button>

                    <button
                      onClick={fetchComparison}
                      disabled={loading || slots.map(s => s.code || s.search).filter(Boolean).length < 2}
                      className="flex-1 md:flex-none bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-[0_0_15px_rgba(79,70,229,0.4)] hover:shadow-[0_0_30px_rgba(79,70,229,0.6)] flex items-center justify-center gap-2 disabled:opacity-50 disabled:shadow-none active:scale-95 text-sm whitespace-nowrap"
                    >
                      {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "비교하기"}
                    </button>

                    <button
                      onClick={clearAllSlots}
                      className="flex-1 md:flex-none bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white border border-rose-500/20 font-bold py-3 px-4 rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 text-sm whitespace-nowrap"
                      title="모든 종목 지우기"
                    >
                      <Trash2 className="w-4 h-4" /> 초기화
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-y-4 gap-x-3 relative z-40">
                  {slots.map((slot, index) => (
                    <div key={index} className="flex-1 group relative">
                      <label className="block text-[10px] font-medium text-indigo-300/80 mb-0.5 uppercase tracking-widest pl-1">
                        ETF Ticker {index + 1}
                      </label>
                      <div className="flex items-center gap-1.5 relative">
                        <div className="relative w-full">
                          <input
                            value={slot.search}
                            onChange={(e) => { updateSearch(index, e.target.value); setFocusedSlotIndex(-1); }}
                            onFocus={() => { setActiveDropdownIndex(index); setDropdownLimit(50); }}
                            onBlur={() => setTimeout(() => setActiveDropdownIndex(null), 250)}
                            onKeyDown={(e) => {
                              if (activeDropdownIndex !== index) return;
                              const term = slot.search.toLowerCase().replace(/\s/g, '');
                              const filtered = etfDictionary.filter(etf => term === "" ? true : (etf.name.toLowerCase().replace(/\s/g, '').includes(term) || etf.code.includes(term)));
                              const maxIndex = Math.min(filtered.length, dropdownLimit) - 1;

                              if (e.key === 'ArrowDown') {
                                e.preventDefault();
                                setFocusedSlotIndex(prev => (prev < maxIndex ? prev + 1 : prev));
                              } else if (e.key === 'ArrowUp') {
                                e.preventDefault();
                                setFocusedSlotIndex(prev => (prev > 0 ? prev - 1 : 0));
                              } else if (e.key === 'Enter') {
                                e.preventDefault();
                                if (focusedSlotIndex >= 0 && focusedSlotIndex <= maxIndex) {
                                  selectEtf(index, filtered[focusedSlotIndex].code, filtered[focusedSlotIndex].name);
                                }
                              }
                            }}
                            className="w-full px-2.5 py-1.5 bg-black/40 border border-white/10 rounded-lg focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-400 outline-none transition-all text-white placeholder-gray-700 font-mono text-xs shadow-inner"
                            placeholder="e.g. KODEX 성장"
                          />
                          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
                        </div>

                        {slot.search !== "" && (
                          <button
                            onClick={() => clearSlot(index)}
                            className="text-gray-500 hover:text-red-400 hover:bg-red-400/10 p-2 rounded-xl transition-colors flex-shrink-0"
                            title="지우기"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        )}

                        {/* Dropdown UI */}
                        {activeDropdownIndex === index && (
                          <div
                            className="absolute top-[calc(100%+8px)] left-0 z-[100] w-[300px] bg-[#0c0a18] border border-white/10 rounded-xl max-h-64 overflow-y-auto shadow-[0_15px_40px_rgba(0,0,0,0.8)] backdrop-blur-3xl animate-in fade-in zoom-in-95 duration-200"
                            onScroll={handleDropdownScroll}
                          >
                            {etfDictionary.length === 0 ? (
                              <div className="px-4 py-3 text-xs text-gray-500 flex items-center justify-center gap-2"><Loader2 className="w-3 h-3 animate-spin" />Loading DB...</div>
                            ) : (
                              (() => {
                                const filtered = etfDictionary.filter(e => {
                                  const term = slot.search.toLowerCase().replace(/\s/g, '');
                                  const nameMatch = e.name.toLowerCase().replace(/\s/g, '').includes(term);
                                  const codeMatch = e.code.includes(term);
                                  return term === "" ? true : (nameMatch || codeMatch);
                                });

                                return (
                                  <>
                                    {filtered.slice(0, dropdownLimit).map((e, idx) => (
                                      <div
                                        id={`slot-item-${idx}`}
                                        key={e.code}
                                        onClick={() => selectEtf(index, e.code, e.name)}
                                        onMouseEnter={() => setFocusedSlotIndex(idx)}
                                        className={`px-3 py-2 cursor-pointer text-[11px] md:text-[13px] border-b border-white/[0.03] last:border-0 transition-colors flex items-center justify-between group/item ${focusedSlotIndex === idx ? 'bg-indigo-600/30 text-white' : 'hover:bg-indigo-600/30 text-gray-200'}`}
                                      >
                                        <span className={`truncate mr-3 font-medium ${focusedSlotIndex === idx ? 'text-indigo-100' : 'group-hover/item:text-indigo-100'}`}>{e.name}</span>
                                        <span className="font-mono text-[10px] text-indigo-400/70">{e.code}</span>
                                      </div>
                                    ))}
                                    {filtered.length > dropdownLimit && (
                                      <div className="px-4 py-4 text-xs text-gray-500 flex items-center justify-center gap-2">
                                        <Loader2 className="w-3 h-3 animate-spin text-indigo-400" />
                                        로딩 중...
                                      </div>
                                    )}
                                    {slot.search && filtered.length === 0 && (
                                      <div className="px-4 py-3 text-xs text-rose-400 text-center">No matches found.</div>
                                    )}
                                  </>
                                );
                              })()
                            )}
                          </div>
                        )}

                      </div>
                    </div>
                  ))}
                </div>

                {/* Cleaned up spacing from old button area */}
              </div>
            </section>
          </div>
        )}

        {/* Results Section */}
        {
          data && data.data_payload && activeTab !== 'select' && (
            <div className="w-full max-w-[95vw] xl:max-w-[1400px] flex flex-col relative z-10 animate-in fade-in slide-in-from-bottom-5 duration-700">

              {activeTab === 'info' && (
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 animate-in fade-in slide-in-from-bottom-2 duration-500 bg-white/[0.03] p-4 lg:p-5 border border-white/10 rounded-3xl backdrop-blur-3xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] mt-0">
                  {/* Table Details */}
                  <section className="col-span-1 lg:col-span-3 overflow-hidden flex flex-col relative group">
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    <h3 className="text-base md:text-lg font-bold mb-3 flex items-center gap-2 relative z-10">
                      <span className="w-1.5 h-6 bg-gradient-to-b from-indigo-400 to-purple-500 rounded-full"></span>
                      종합 매트릭스
                    </h3>

                    <div className="overflow-x-auto pb-6 relative z-10">
                      <table className="w-full text-left border-collapse whitespace-nowrap">
                        <thead>
                          <tr className="border-b border-white/10">
                            {data.data_payload.header.map((h: string, i: number) => (
                              <th key={i} className="py-2 px-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.05]">
                          {data.data_payload.rows.map((row: string[], i: number) => {
                            const glowColors = ["#818cf8", "#34d399", "#fbbf24", "#f87171", "#c084fc", "#60a5fa", "#f472b6", "#a3e635", "#f97316", "#14b8a6"];
                            return (
                              <tr key={i} className="hover:bg-white/[0.03] transition-colors group/row"
                                onMouseEnter={() => {
                                  const matchedEtf = data.raw_data ? data.raw_data.find((e: any) => row[0].includes(e.etf_name) || row[0].includes(e.etf_code)) : null;
                                  if (matchedEtf) setHoveredEtfName(matchedEtf.etf_name);
                                  else setHoveredEtfName(row[0]);
                                }}
                                onMouseLeave={() => setHoveredEtfName(null)}
                              >
                                {row.map((cell: string, j: number) => {
                                  const isNegative = cell.includes('-') && cell.includes('%');
                                  const isPositive = cell.includes('%') && !isNegative && parseFloat(cell) > 0;
                                  const matchedEtf = j === 0 && data.raw_data ? data.raw_data.find((e: any) => cell.includes(e.etf_name) || cell.includes(e.etf_code)) : null;
                                  return (
                                    <td key={j}
                                      className={`py-3 px-3 text-xs xl:text-sm font-medium transition-colors ${j === 0 ? `font-bold max-w-[200px] truncate ${matchedEtf ? 'cursor-pointer hover:underline underline-offset-4' : ''}` :
                                        isNegative ? 'text-rose-400' :
                                          isPositive ? 'text-emerald-400' : 'text-gray-200'
                                        }`}
                                      style={j === 0 ? { color: glowColors[i % glowColors.length] } : undefined}
                                      title={j === 0 ? cell : undefined}
                                      onClick={() => {
                                        if (matchedEtf) setSelectedDetailEtf(matchedEtf);
                                      }}
                                    >
                                      {cell}
                                    </td>
                                  )
                                })}
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div className="mt-auto pt-4 border-t border-white/10 relative z-10">
                      <div className="p-4 bg-gradient-to-r from-indigo-900/40 via-purple-900/20 to-transparent rounded-xl border border-indigo-500/20 shadow-[inset_0_0_20px_rgba(79,70,229,0.05)] backdrop-blur-sm">
                        <h4 className="font-bold text-indigo-300 text-xs mb-2 flex items-center gap-2 uppercase tracking-wider">✨ Quant Insight</h4>
                        <p className="text-indigo-50 text-sm leading-relaxed font-light block">{data.data_payload.insight_comment}</p>
                      </div>
                    </div>
                  </section>

                  {/* Radar Chart */}
                  <section className="bg-white/[0.02] backdrop-blur-3xl rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] p-5 border border-white/5 flex flex-col justify-center min-h-[300px] relative group lg:col-span-1">
                    <div className="absolute inset-0 bg-gradient-to-bl from-purple-500/5 to-pink-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    <h3 className="text-base md:text-lg font-bold mb-2 flex items-center gap-3 relative z-10">
                      <span className="w-1.5 h-6 bg-gradient-to-b from-purple-400 to-pink-500 rounded-full"></span>
                      팩터 밸런스
                    </h3>
                    <div className="flex-1 w-full min-h-[220px] relative z-10">
                      <ResponsiveContainer width="100%" height="100%">
                        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                          <PolarGrid stroke="rgba(255,255,255,0.05)" />
                          <PolarAngleAxis dataKey="subject" tick={{ fill: '#a5b4fc', fontSize: 13, fontWeight: 500 }} />
                          <PolarRadiusAxis angle={30} domain={[0, 10]} tick={false} axisLine={false} />
                          {data.visual_data && data.visual_data.etf_keys && data.visual_data.etf_keys.map((etfName: string, idx: number) => {
                            const glowColors = ["#818cf8", "#34d399", "#fbbf24", "#f87171", "#c084fc", "#60a5fa", "#f472b6", "#a3e635", "#f97316", "#14b8a6"];
                            const c = glowColors[idx % glowColors.length];
                            const isHovered = hoveredEtfName && (hoveredEtfName === etfName || etfName.includes(hoveredEtfName) || hoveredEtfName.includes(etfName));
                            const isOthersHovered = hoveredEtfName && !isHovered;
                            return (
                              <Radar
                                key={etfName}
                                name={etfName}
                                dataKey={etfName}
                                stroke={c}
                                strokeWidth={isHovered ? 4 : 2}
                                fill={c}
                                fillOpacity={isHovered ? 0.7 : (isOthersHovered ? 0.05 : 0.3)}
                                className={isHovered ? 'animate-pulse' : 'transition-all duration-300'}
                              />
                            );
                          })}
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>
                    {/* Factor Score Heatmap Table */}
                    {data.visual_data && data.visual_data.etf_keys && data.visual_data.etf_keys.length > 0 && radarData.length > 0 && (
                      <div className="w-full mt-4 overflow-x-auto relative z-10 scrollbar-hide">
                        <table className="w-full table-fixed text-center border-collapse min-w-[max-content]">
                          <thead>
                            <tr>
                              <th className="px-2 py-1.5 text-[10px] md:text-[11px] text-gray-400 font-medium border-b border-white/10 whitespace-nowrap bg-black/20 w-24">종목</th>
                              {radarData.map((row: any) => (
                                <th key={row.subject} className="px-2 py-1.5 text-[10px] md:text-[11px] text-gray-400 font-medium border-b border-white/10 whitespace-nowrap bg-black/20">
                                  {row.subject === "수수료(저렴함)" ? "수수료" : row.subject}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {data.visual_data.etf_keys.map((key: string, idx: number) => {
                              const glowColors = ["#818cf8", "#34d399", "#fbbf24", "#f87171", "#c084fc", "#60a5fa", "#f472b6", "#a3e635", "#f97316", "#14b8a6"];
                              const c = glowColors[idx % glowColors.length];
                              const isHovered = hoveredEtfName && (hoveredEtfName === key || key.includes(hoveredEtfName) || hoveredEtfName.includes(key));

                              return (
                                <tr
                                  key={key}
                                  className="hover:bg-white/5 transition-colors"
                                  onMouseEnter={() => setHoveredEtfName(key)}
                                  onMouseLeave={() => setHoveredEtfName(null)}
                                >
                                  <td className="px-2 py-2 border-b border-white/5">
                                    <div className="flex justify-center items-center w-full h-full py-1">
                                      <div className={`w-3 h-3 rounded-full ${isHovered ? 'animate-pulse scale-125' : ''}`} style={{ backgroundColor: c, boxShadow: `0 0 10px ${c}` }}></div>
                                    </div>
                                  </td>
                                  {radarData.map((row: any) => {
                                    const val = Math.max(0, Number(row[key]) || 0);
                                    // Calculate min/max for this column factor
                                    const allVals = data.visual_data.etf_keys.map((k: string) => Math.max(0, Number(row[k]) || 0));
                                    const maxV = Math.max(...allVals);
                                    const minV = Math.min(...allVals);
                                    const norm = maxV === minV ? 0.5 : (val - minV) / (maxV - minV);

                                    // 10: Dark Green (~140 hue, ~40% lightness)
                                    // 1: Light Yellow (~60 hue, ~90% lightness)
                                    const hue = 60 + (norm * 80);
                                    const lightness = 90 - (norm * 50);
                                    const textColor = norm > 0.6 ? 'text-white' : 'text-gray-900';

                                    return (
                                      <td key={row.subject} className="px-1 py-1 border-b border-white/5 relative">
                                        <div
                                          className={`w-full h-full min-h-[26px] flex items-center justify-center rounded text-[10px] md:text-[11px] font-mono transition-all duration-300 ${isHovered ? 'scale-110 shadow-[0_0_10px_rgba(255,255,255,0.3)] z-10 font-extrabold ring-1 ring-white/50' : 'font-bold'} ${textColor}`}
                                          style={{ backgroundColor: `hsl(${hue}, 85%, ${lightness}%)` }}
                                        >
                                          {val}
                                        </div>
                                      </td>
                                    );
                                  })}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </section>

                  {/* Detailed Basic Info Inverted Table */}
                  <section className="bg-white/[0.02] backdrop-blur-3xl rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] p-5 border border-white/5 lg:col-span-4 mt-2 overflow-x-auto">
                    <h3 className="text-base md:text-lg font-bold mb-4 flex items-center gap-3">
                      <span className="w-1.5 h-6 bg-gradient-to-b from-teal-400 to-emerald-500 rounded-full"></span>
                      기본 정보
                    </h3>
                    <div className="w-full overflow-x-hidden overflow-y-auto max-h-[65vh] border border-white/5 rounded-xl relative custom-scrollbar">
                      <table className="w-full text-left border-collapse min-w-full table-fixed">
                        <thead className="sticky top-0 z-30 backdrop-blur-xl bg-[#0B0F19]/95 shadow-md border-b border-white/10">
                          <tr>
                            <th className="py-2 px-1 lg:px-2 text-[10px] md:text-sm font-bold text-gray-500 bg-white/5 w-16 md:w-24 break-keep">항목</th>
                            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                            {data.raw_data && data.raw_data.map((etf: any, idx: number) => {
                              const glowColors = ["#818cf8", "#34d399", "#fbbf24", "#f87171", "#c084fc", "#60a5fa", "#f472b6", "#a3e635", "#f97316", "#14b8a6"];
                              const isDanger = etf.etf_name.includes('인버스') || etf.etf_name.includes('레버리지') || etf.etf_name.includes('선물') || etf.etf_name.includes('블룸버그');
                              return (
                                <th key={`${etf.etf_code}-${idx}`} className="py-2 px-1 xl:px-2 text-[10px] xl:text-xs font-bold text-center group cursor-pointer hover:bg-white/[0.05] transition-colors leading-tight whitespace-normal break-keep" onClick={() => setSelectedDetailEtf(etf)} style={{ color: glowColors[idx % glowColors.length] }}>
                                  <div className="flex flex-col items-center justify-end gap-1.5 h-full">
                                    {isDanger ? <span className="text-[8px] md:text-[9px] bg-rose-500/10 text-rose-400 px-1 py-0.5 rounded border border-rose-500/30 whitespace-nowrap">퇴직연금 불가</span> : <span className="text-[8px] md:text-[9px] bg-emerald-500/10 text-emerald-400 px-1 py-0.5 rounded border border-emerald-500/30 whitespace-nowrap">연금 가능</span>}
                                    <span className="group-hover:underline underline-offset-4">{etf.etf_name}</span>
                                  </div>
                                </th>
                              );
                            })}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.05]">
                          {['운용사', '최초데이터(상장추정)', '현재가 및 NAV (괴리율)', '순자산총액', '상장주식수', '52주 최고/최저', '거래량/거래대금', '20일평균 거래량/대금', '펀드보수', '최근 분배율(TTM)', '1M 수익률', '3M 수익률', '6M 수익률', '1Y 수익률'].map((key) => {
                            const isNumericRow = !['운용사', '최초데이터(상장추정)', '현재가 및 NAV (괴리율)'].includes(key);
                            const isSplitRow = ['52주 최고/최저', '거래량/거래대금', '20일평균 거래량/대금'].includes(key);
                            let maxVal1 = 1;
                            let maxVal2 = 1;

                            if (isNumericRow && data.raw_data) {
                              const parsedVals = data.raw_data.map((e: any) => {
                                const v = e.basic_info?.[key] || '';
                                let raw = String(v).replace(/,/g, '');
                                let n1 = 0;
                                let n2 = 0;

                                if (key === '순자산총액') {
                                  if (raw.includes("조") && raw.includes("억")) {
                                    const parts = raw.split("조");
                                    n1 = (parseFloat(parts[0]) || 0) * 10000 + (parseFloat(parts[1].replace("억", "")) || 0);
                                  } else if (raw.includes("조")) {
                                    n1 = (parseFloat(raw.replace("조", "")) || 0) * 10000;
                                  } else {
                                    n1 = parseFloat(raw.replace("억", "")) || 0;
                                  }
                                } else if (isSplitRow && raw.includes('/')) {
                                  const parts = raw.split('/');
                                  n1 = parseFloat(parts[0].replace(/[^0-9.]/g, '')) || 0;
                                  n2 = parseFloat(parts[1].replace(/[^0-9.]/g, '')) || 0;
                                } else {
                                  n1 = parseFloat(raw.replace(/[^0-9.-]/g, '')) || 0;
                                }
                                return [Math.abs(n1), Math.abs(n2)];
                              });

                              maxVal1 = Math.max(...parsedVals.map((p: any) => p[0])) || 1;
                              maxVal2 = Math.max(...parsedVals.map((p: any) => p[1])) || 1;

                              // Shared maximum for same-unit metrics to preserve left > right proportions
                              if (key === '52주 최고/최저') {
                                const absoluteMax = Math.max(maxVal1, maxVal2);
                                maxVal1 = absoluteMax;
                                maxVal2 = absoluteMax;
                              }
                            }

                            return (
                              <tr key={key} className="hover:bg-white/[0.03] transition-colors">
                                <td className="py-3 px-4 text-xs font-semibold text-gray-400 bg-white/5 align-middle">{key}</td>
                                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                                {data.raw_data && data.raw_data.map((etf: any, idx: number) => {
                                  let val: any = etf.basic_info?.[key] || '-';
                                  if (key === '현재가 및 NAV (괴리율)') {
                                    const p = etf.market_data?.price || 0;
                                    const n = etf.market_data?.nav || 0;
                                    if (p > 0 && n > 0) {
                                      const d = ((p - n) / n) * 100;
                                      val = `${p.toLocaleString()}원 / ${n.toLocaleString()}원 (${d > 0 ? '+' : ''}${d.toFixed(2)}%)`;
                                    } else {
                                      val = 'N/A';
                                    }
                                  }

                                  const isYield = key.includes('수익률');
                                  const isDisparity = key === '현재가 및 NAV (괴리율)';

                                  const isPositive = (isYield && typeof val === 'string' && val.includes('%') && !val.includes('-')) || (isDisparity && typeof val === 'string' && val.includes('+'));
                                  const isNegative = (isYield && typeof val === 'string' && val.includes('%') && val.includes('-')) || (isDisparity && typeof val === 'string' && val.includes('-') && val.includes('%'));
                                  const textColor = isPositive ? 'text-rose-400' : isNegative ? 'text-blue-400' : 'text-gray-100';

                                  let num1 = 0;
                                  let num2 = 0;
                                  let val1Str = val;
                                  let val2Str = "";

                                  if (isNumericRow) {
                                    let raw = String(val).replace(/,/g, '');
                                    if (key === '순자산총액') {
                                      if (raw.includes("조") && raw.includes("억")) {
                                        const parts = raw.split("조");
                                        num1 = (parseFloat(parts[0]) || 0) * 10000 + (parseFloat(parts[1].replace("억", "")) || 0);
                                      } else if (raw.includes("조")) {
                                        num1 = (parseFloat(raw.replace("조", "")) || 0) * 10000;
                                      } else {
                                        num1 = parseFloat(raw.replace("억", "")) || 0;
                                      }
                                    } else if (isSplitRow && raw.includes('/')) {
                                      const parts = String(val).split('/');
                                      val1Str = parts[0].trim();
                                      val2Str = parts[1].trim();
                                      num1 = parseFloat(raw.split('/')[0].replace(/[^0-9.]/g, '')) || 0;
                                      num2 = parseFloat(raw.split('/')[1].replace(/[^0-9.]/g, '')) || 0;
                                    } else {
                                      num1 = parseFloat(raw.replace(/[^0-9.-]/g, '')) || 0;
                                    }
                                    num1 = Math.abs(num1);
                                    num2 = Math.abs(num2);
                                  }

                                  const formatVisHeight = (n: number, max: number) => {
                                    if (n === 0 || max === 0) return 0;
                                    const ratio = n / max;
                                    return Math.min(100, Math.max(4, Math.pow(ratio, 0.45) * 100));
                                  };

                                  const widthH1 = isNumericRow ? formatVisHeight(num1, maxVal1) : 0;
                                  const widthH2 = isNumericRow && isSplitRow ? formatVisHeight(num2, maxVal2) : 0;
                                  const glowColors = ["bg-indigo-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500", "bg-purple-500", "bg-cyan-500", "bg-blue-500", "bg-pink-500", "bg-lime-500", "bg-orange-500"];
                                  const secColors = ["bg-indigo-400/50", "bg-emerald-400/50", "bg-amber-400/50", "bg-rose-400/50", "bg-purple-400/50", "bg-cyan-400/50", "bg-blue-400/50", "bg-pink-400/50", "bg-lime-400/50", "bg-orange-400/50"];

                                  return (
                                    <td key={`${etf.etf_code}-${idx}`} className={`py-2 px-1 lg:px-2 text-[10px] xl:text-xs font-medium ${textColor} h-full leading-tight break-keep text-center align-middle`}>
                                      {!isNumericRow ? (
                                        <div className="flex items-center justify-center h-full w-full">{val}</div>
                                      ) : (
                                        <div className="flex flex-col items-center justify-end w-full min-h-[50px] gap-2 pt-2">
                                          <div className="flex items-end justify-center w-full h-[46px] gap-2 px-1">
                                            <div className="w-full max-w-[80px] bg-black/40 rounded-t-md border-b border-white/10 flex flex-col justify-end overflow-hidden h-full">
                                              <div className={`w-full ${glowColors[idx % glowColors.length]} transition-all duration-700`} style={{ height: `${widthH1}%` }} />
                                            </div>
                                            {isSplitRow && val2Str && (
                                              <div className="w-full max-w-[80px] bg-black/40 rounded-t-md border-b border-white/10 flex flex-col justify-end overflow-hidden h-full">
                                                <div className={`w-full ${secColors[idx % secColors.length]} transition-all duration-700`} style={{ height: `${widthH2}%` }} />
                                              </div>
                                            )}
                                          </div>
                                          <div className="flex w-full items-center justify-center gap-2 text-center text-[11px] 2xl:text-xs">
                                            <span className="flex-1 min-w-[30px]">{val1Str}</span>
                                            {isSplitRow && val2Str && <span className="flex-1 opacity-70 min-w-[30px]">{val2Str}</span>}
                                          </div>
                                        </div>
                                      )}
                                    </td>
                                  )
                                })}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </section>

                  {/* Sub-Charts Section Moved to Info Tab per Request */}
                  {additionalStatsData.length > 0 && (
                    <div className="lg:col-span-4 grid grid-cols-1 lg:grid-cols-4 gap-2 md:gap-4 mt-2">
                      {/* Dedicated ETF Names Box */}
                      <section className="bg-white/[0.02] backdrop-blur-3xl rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] p-4 border border-white/5 flex flex-col min-h-[200px] relative overflow-hidden">
                        <h3 className="text-sm font-bold mb-4 flex items-center gap-2 relative z-10 text-gray-200">
                          <span className="w-1.5 h-4 bg-gray-400 rounded-full"></span>
                          종목명
                        </h3>
                        <div className="flex-1 w-full h-[180px] flex flex-col justify-around py-2">
                          {additionalStatsData.map((d: any, idx: number) => {
                            const glowColors = ["#818cf8", "#34d399", "#fbbf24", "#f87171", "#c084fc", "#60a5fa", "#f472b6", "#a3e635", "#f97316", "#14b8a6"];
                            return (
                              <div key={idx} className="text-right pr-2 font-bold text-[10px] md:text-[11px] lg:text-[12px] truncate w-full cursor-pointer hover:underline" style={{ color: glowColors[idx % 10] }} onClick={() => {
                                const matchedEtf = data.raw_data?.find((cd: any) => cd.etf_name === d.name || cd.etf_code === d.name);
                                if (matchedEtf) setSelectedDetailEtf(matchedEtf);
                              }}>
                                {d.name.replace(/ /g, '\u00A0')}
                              </div>
                            );
                          })}
                        </div>
                      </section>
                      {/* AUM Chart */}
                      <section className="bg-white/[0.02] backdrop-blur-3xl rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] p-4 border border-white/5 flex flex-col min-h-[200px] relative overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                        <h3 className="text-sm font-bold mb-4 flex items-center gap-2 relative z-10 text-gray-200">
                          <span className="w-1.5 h-4 bg-indigo-400 rounded-full"></span>
                          순자산총액 <span className="text-[10px] text-gray-500 font-normal">(단위: 억 원)</span>
                        </h3>
                        <div className="flex-1 w-full h-[180px] relative z-10">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={additionalStatsData} layout="vertical" margin={{ top: 0, right: 30, left: 0, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.03)" />
                              <XAxis type="number" tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={(val) => Math.floor(val / 10000) > 0 ? `${Math.floor(val / 10000)}조` : val} stroke="rgba(255,255,255,0.05)" axisLine={false} />
                              <YAxis dataKey="name" type="category" hide={true} axisLine={false} />
                              <Tooltip cursor={{ fill: 'rgba(255,255,255,0.02)' }} contentStyle={{ backgroundColor: 'rgba(9, 9, 11, 0.95)', borderColor: 'rgba(79, 70, 229, 0.2)', borderRadius: '12px', fontSize: '12px' }} itemStyle={{ color: '#818cf8', fontWeight: 'bold' }} />
                              <Bar dataKey="aum" name="순자산(억)" radius={[0, 4, 4, 0]}>
                                {additionalStatsData.map((_: any, idx: number) => (
                                  <Cell key={`cell-${idx}`} fill={['#818cf8', '#34d399', '#fbbf24', '#f87171', '#c084fc', '#60a5fa', '#f472b6', '#a3e635', '#f97316', '#14b8a6'][idx % 10]} fillOpacity={0.8} />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </section>

                      {/* Dividend Chart */}
                      <section className="bg-white/[0.02] backdrop-blur-3xl rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] p-4 border border-white/5 flex flex-col min-h-[200px] relative overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-tr from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                        <h3 className="text-sm font-bold mb-4 flex items-center gap-2 relative z-10 text-gray-200">
                          <span className="w-1.5 h-4 bg-emerald-400 rounded-full"></span>
                          연간배당률(TTM) <span className="text-[10px] text-gray-500 font-normal">(단위: %)</span>
                        </h3>
                        <div className="flex-1 w-full h-[180px] relative z-10">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={additionalStatsData} layout="vertical" margin={{ top: 0, right: 30, left: 0, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.03)" />
                              <XAxis type="number" tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={(val) => `${val}%`} stroke="rgba(255,255,255,0.05)" axisLine={false} />
                              <YAxis dataKey="name" type="category" hide={true} axisLine={false} />
                              <Tooltip cursor={{ fill: 'rgba(255,255,255,0.02)' }} contentStyle={{ backgroundColor: 'rgba(9, 9, 11, 0.95)', borderColor: 'rgba(52, 211, 153, 0.2)', borderRadius: '12px', fontSize: '12px' }} itemStyle={{ color: '#34d399', fontWeight: 'bold' }} />
                              <Bar dataKey="dividend" name="배당률(%)" radius={[0, 4, 4, 0]}>
                                {additionalStatsData.map((_: any, idx: number) => (
                                  <Cell key={`cell-${idx}`} fill={['#818cf8', '#34d399', '#fbbf24', '#f87171', '#c084fc', '#60a5fa', '#f472b6', '#a3e635', '#f97316', '#14b8a6'][idx % 10]} fillOpacity={0.8} />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </section>

                      {/* Fee Chart */}
                      <section className="bg-white/[0.02] backdrop-blur-3xl rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] p-4 border border-white/5 flex flex-col min-h-[200px] relative overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-tr from-rose-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                        <h3 className="text-sm font-bold mb-4 flex items-center gap-2 relative z-10 text-gray-200">
                          <span className="w-1.5 h-4 bg-rose-400 rounded-full"></span>
                          총보수율 <span className="text-[10px] text-gray-500 font-normal">(낮을수록 좋음, %)</span>
                        </h3>
                        <div className="flex-1 w-full h-[180px] relative z-10">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={additionalStatsData} layout="vertical" margin={{ top: 0, right: 30, left: 0, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.03)" />
                              <XAxis type="number" tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={(val) => `${val}%`} stroke="rgba(255,255,255,0.05)" axisLine={false} />
                              <YAxis dataKey="name" type="category" hide={true} axisLine={false} />
                              <Tooltip cursor={{ fill: 'rgba(255,255,255,0.02)' }} contentStyle={{ backgroundColor: 'rgba(9, 9, 11, 0.95)', borderColor: 'rgba(244, 63, 94, 0.2)', borderRadius: '12px', fontSize: '12px' }} itemStyle={{ color: '#f43f5e', fontWeight: 'bold' }} />
                              <Bar dataKey="fee" name="수수료(%)" radius={[0, 4, 4, 0]}>
                                {additionalStatsData.map((_: any, idx: number) => (
                                  <Cell key={`cell-${idx}`} fill={['#818cf8', '#34d399', '#fbbf24', '#f87171', '#c084fc', '#60a5fa', '#f472b6', '#a3e635', '#f97316', '#14b8a6'][idx % 10]} fillOpacity={0.8} />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </section>
                    </div>
                  )}

                </div>
              )}

              {activeTab === 'holdings' && (
                <div className="w-full flex flex-col animate-in fade-in slide-in-from-bottom-2 duration-500">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 w-full bg-white/[0.02] p-4 lg:p-5 border border-white/5 rounded-2xl backdrop-blur-3xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] mt-0 justify-center">
                    {isLoadingHoldings ? (
                      <div className="flex flex-col items-center justify-center p-12 text-center col-span-full w-full min-h-[300px]">
                        <Loader2 className="w-10 h-10 text-emerald-400 animate-spin mb-4" />
                        <h3 className="text-lg font-bold text-gray-200 mb-2">실시간 포트폴리오 데이터를 분석하고 있습니다</h3>
                        <p className="text-sm text-gray-500 max-w-sm mx-auto">
                          각 ETF의 최신 구성종목 데이터를 KRX 서버에서 동기화 중입니다. 분석에는 평균 5~10초가 소요됩니다.
                        </p>
                      </div>
                    ) : (
                      <>
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        {data.raw_data && data.raw_data.map((etf: any, idx: number) => {
                          const glowColors = ["from-indigo-500", "from-emerald-500", "from-amber-500", "from-rose-500", "from-purple-500", "from-cyan-500", "from-blue-500", "from-pink-500", "from-lime-500", "from-orange-500"];
                          const bgColors = ["bg-indigo-500/10", "bg-emerald-500/10", "bg-amber-500/10", "bg-rose-500/10", "bg-purple-500/10", "bg-cyan-500/10", "bg-blue-500/10", "bg-pink-500/10", "bg-lime-500/10", "bg-orange-500/10"];
                          const borderColors = ["border-indigo-500/30", "border-emerald-500/30", "border-amber-500/30", "border-rose-500/30", "border-purple-500/30", "border-cyan-500/30", "border-blue-500/30", "border-pink-500/30", "border-lime-500/30", "border-orange-500/30"];
                          const fillColors = ["bg-indigo-400", "bg-emerald-400", "bg-amber-400", "bg-rose-400", "bg-purple-400", "bg-cyan-400", "bg-blue-400", "bg-pink-400", "bg-lime-400", "bg-orange-400"];

                          return (
                            <section key={etf.etf_code} className={`backdrop-blur-3xl rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] p-4 border ${borderColors[idx % borderColors.length]} ${bgColors[idx % bgColors.length]} flex flex-col relative overflow-hidden min-w-[200px]`}>
                              <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${glowColors[idx % glowColors.length]} to-transparent`} />
                              <h3 className="text-sm md:text-base lg:text-lg font-bold mb-4 flex items-center justify-between gap-2 cursor-pointer group" onClick={() => setSelectedDetailEtf(etf)}>
                                <span className="truncate group-hover:underline group-hover:text-indigo-300 transition-colors" title={etf.etf_name}>{etf.etf_name}</span>
                                <span className="text-[10px] sm:text-xs font-medium text-gray-400 bg-black/40 px-2 flex-shrink-0 py-0.5 rounded-full border border-white/5">TOP 50</span>
                              </h3>

                              {etf.holdings && etf.holdings.length > 0 ? (
                                <div className="space-y-3 flex-1 pr-1 overflow-y-auto max-h-[600px] scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                                  {etf.holdings.map((h: any, hIdx: number) => (
                                    <div key={h.ticker} className="flex flex-col gap-1 group">
                                      <div className="flex justify-between items-end text-[11px] sm:text-xs xl:text-[13px] mb-0.5">
                                        <span className="font-medium text-gray-200 group-hover:text-white transition-colors truncate max-w-[75%]" title={h.ticker}>
                                          <span className="text-gray-500 w-4 inline-block text-[10px] sm:text-[11px]">{hIdx + 1}.</span> {h.ticker}
                                        </span>
                                        <span className="font-bold text-gray-300 ml-1 flex-shrink-0">{h.weight.toFixed(2)}%</span>
                                      </div>
                                      <div className="w-full bg-black/40 rounded-full h-1.5 overflow-hidden border border-white/5">
                                        <div
                                          className={`h-full ${fillColors[idx % fillColors.length]} rounded-full transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(255,255,255,0.3)]`}
                                          style={{ width: `${Math.min(100, (h.weight / (etf.holdings[0]?.weight || 100)) * 100)}%` }}
                                        />
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="flex-1 flex flex-col items-center justify-center text-gray-500/50 min-h-[150px]">
                                  <span className="text-3xl font-black mb-1 opacity-20">N/A</span>
                                  <p className="text-xs font-medium mb-3">미국 ETF 등 데이터 미제공 종목</p>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setNaverEtfCode(etf.etf_code);
                                    }}
                                    className="px-3 py-1.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 rounded text-xs font-bold hover:bg-indigo-500/30 transition-colors"
                                  >
                                    네이버 정보 검색
                                  </button>
                                </div>
                              )}
                            </section>
                          );
                        })}
                      </>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'chart' && (
                <div className="flex flex-col gap-2 animate-in fade-in slide-in-from-bottom-2 duration-500 bg-white/[0.03] p-4 lg:p-5 border border-white/10 rounded-3xl backdrop-blur-3xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] mt-0">
                  <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
                    <div className="flex items-center gap-1.5 bg-black/40 p-1.5 rounded-xl border border-white/10 shadow-inner">
                      {['1D', '1W', '1M', '6M', '1Y', '3Y', 'MAX'].map(p => (
                        <button
                          key={p}
                          onClick={() => setPeriod(p)}
                          className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all whitespace-nowrap ${period === p
                            ? 'bg-indigo-500/80 text-white shadow-md shadow-indigo-500/20'
                            : 'text-gray-400 hover:text-white hover:bg-white/10'
                            }`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 lg:gap-6">
                    {isLoadingChart ? (
                      <div className="flex flex-col items-center justify-center p-12 text-center col-span-full w-full min-h-[400px] bg-white/[0.02] border border-white/5 rounded-2xl">
                        <Loader2 className="w-10 h-10 text-indigo-400 animate-spin mb-4" />
                        <h3 className="text-lg font-bold text-gray-200 mb-2">10년치 시계열 데이터를 분석하고 있습니다</h3>
                        <p className="text-sm text-gray-500 max-w-sm mx-auto">
                          과거 수익률 패턴과 변동성을 계산 중입니다. 잠시만 기다려주세요.
                        </p>
                      </div>
                    ) : (
                      <>
                        {/* 1. Raw Price Chart (가격 추이) */}
                        {data.visual_data.line_chart && data.visual_data.etf_keys && data.visual_data.line_chart.length > 0 && (
                          <section className="bg-white/[0.02] backdrop-blur-3xl rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] p-4 border border-white/5 relative group w-full">
                            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                            <div className="flex justify-between items-center mb-4 relative z-10">
                              <h3 className="text-base md:text-lg font-bold flex items-center gap-3">
                                <span className="w-1.5 h-6 bg-gradient-to-b from-blue-400 to-indigo-500 rounded-full"></span>
                                가격 추이
                                <span className="text-xs font-normal text-gray-500 ml-1 hidden sm:inline">(원)</span>
                              </h3>
                            </div>

                            <div className="h-[400px] w-full relative z-10">
                              <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={simulatedChartData} margin={{ top: 10, right: 30, left: 10, bottom: 5 }}>
                                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.03)" />
                                  <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 13 }} tickMargin={15} minTickGap={50} stroke="rgba(255,255,255,0.05)" axisLine={{ stroke: 'rgba(255,255,255,0.05)' }} />
                                  <YAxis domain={['auto', 'auto']} tick={{ fill: '#64748b', fontSize: 13 }} tickFormatter={(val) => `${val.toLocaleString()}`} stroke="rgba(255,255,255,0.05)" tickMargin={15} axisLine={false} />
                                  <Tooltip cursor={{ stroke: 'rgba(255,255,255,0.2)', strokeWidth: 1, strokeDasharray: '4 4' }} contentStyle={{ backgroundColor: 'rgba(3, 7, 18, 0.95)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px', boxShadow: '0 20px 40px -10px rgba(0,0,0,0.7)', padding: '12px' }} labelStyle={{ color: '#94a3b8', marginBottom: '8px', fontWeight: 'bold', fontSize: '13px' }} itemStyle={{ padding: '2px 0', fontSize: '12px' }} />
                                  <Legend iconType="circle" wrapperStyle={{ paddingTop: '15px', display: 'flex', justifyContent: 'center', gap: '20px', fontSize: '12px' }} onClick={(e: any) => {
                                    if (e && e.value) {
                                      const matchedEtf = data.raw_data?.find((d: any) => d.etf_name === e.value || d.etf_code === e.value);
                                      if (matchedEtf) setSelectedDetailEtf(matchedEtf);
                                    }
                                  }} onMouseEnter={(e: any) => { if (e && e.value) setHoveredEtfName(e.value); }}
                                    onMouseLeave={() => setHoveredEtfName(null)}
                                    formatter={(value) => <span className="cursor-pointer hover:text-white hover:underline transition-colors">{value}</span>} />
                                  {data.visual_data.etf_keys.map((key: string, idx: number) => {
                                    const glowColors = ["#818cf8", "#34d399", "#fbbf24", "#f87171", "#c084fc", "#60a5fa", "#f472b6", "#a3e635", "#f97316", "#14b8a6"];
                                    const isHovered = hoveredEtfName && (hoveredEtfName === key || key.includes(hoveredEtfName) || hoveredEtfName.includes(key));
                                    const isOthersHovered = hoveredEtfName && !isHovered;
                                    return <Line key={`${key}_raw`} type="monotone" dataKey={`${key}_raw`} name={key} stroke={glowColors[idx % glowColors.length]} strokeWidth={isHovered ? 5 : 2} strokeOpacity={isOthersHovered ? 0.2 : 1} dot={false} activeDot={{ r: 5, strokeWidth: 0, fill: glowColors[idx % glowColors.length], stroke: 'white' }} className={isHovered ? 'animate-pulse' : 'transition-all duration-300'} onMouseEnter={() => setHoveredEtfName(key)} onMouseLeave={() => setHoveredEtfName(null)} />;
                                  })}
                                </LineChart>
                              </ResponsiveContainer>
                            </div>
                          </section>
                        )}

                        {/* 2. Historical Performance Line Chart (수익률) */}
                        {data.visual_data.line_chart && data.visual_data.etf_keys && (
                          <section className="bg-white/[0.02] backdrop-blur-3xl rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] p-4 border border-white/5 relative group w-full">
                            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-transparent to-pink-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                            <div className="flex justify-between items-center mb-4 relative z-10">
                              <h3 className="text-base md:text-lg font-bold flex items-center gap-3">
                                <span className="w-1.5 h-6 bg-gradient-to-b from-indigo-400 to-pink-500 rounded-full"></span>
                                {period === '1W' ? '수익률 일간 변동' : '다중 ETF 수익률 매치업'}
                                <span className="text-xs font-normal text-gray-500 ml-1 hidden sm:inline">
                                  {period === '1W' ? '(전일 대비 %)' : '(누적 수익률 %)'}
                                </span>
                              </h3>
                            </div>

                            <div className="h-[400px] w-full relative z-10">
                              <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={simulatedChartData} margin={{ top: 10, right: 30, left: 10, bottom: 5 }}>
                                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.03)" />
                                  <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 13 }} tickMargin={15} minTickGap={50} stroke="rgba(255,255,255,0.05)" axisLine={{ stroke: 'rgba(255,255,255,0.05)' }} />
                                  <YAxis domain={['auto', 'auto']} tick={{ fill: '#64748b', fontSize: 13 }} tickFormatter={(val) => `${val}%`} stroke="rgba(255,255,255,0.05)" tickMargin={15} axisLine={false} />
                                  <Tooltip cursor={{ stroke: 'rgba(255,255,255,0.2)', strokeWidth: 1, strokeDasharray: '4 4' }} contentStyle={{ backgroundColor: 'rgba(3, 7, 18, 0.95)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px', boxShadow: '0 20px 40px -10px rgba(0,0,0,0.7)', padding: '12px' }} labelStyle={{ color: '#94a3b8', marginBottom: '8px', fontWeight: 'bold', fontSize: '13px' }} itemStyle={{ padding: '2px 0', fontSize: '12px' }} />
                                  <Legend iconType="circle" wrapperStyle={{ paddingTop: '15px', display: 'flex', justifyContent: 'center', gap: '20px', fontSize: '12px' }} onClick={(e: any) => {
                                    if (e && e.value) {
                                      const matchedEtf = data.raw_data?.find((d: any) => d.etf_name === e.value || d.etf_code === e.value);
                                      if (matchedEtf) setSelectedDetailEtf(matchedEtf);
                                    }
                                  }} onMouseEnter={(e: any) => { if (e && e.value) setHoveredEtfName(e.value); }}
                                    onMouseLeave={() => setHoveredEtfName(null)}
                                    formatter={(value) => <span className="cursor-pointer hover:text-white hover:underline transition-colors">{value}</span>} />
                                  {data.visual_data.etf_keys.map((key: string, idx: number) => {
                                    const glowColors = ["#818cf8", "#34d399", "#fbbf24", "#f87171", "#c084fc", "#60a5fa", "#f472b6", "#a3e635", "#f97316", "#14b8a6"];
                                    const isHovered = hoveredEtfName && (hoveredEtfName === key || key.includes(hoveredEtfName) || hoveredEtfName.includes(key));
                                    const isOthersHovered = hoveredEtfName && !isHovered;
                                    return <Line key={key} type="monotone" dataKey={key} name={key} stroke={glowColors[idx % glowColors.length]} strokeWidth={isHovered ? 5 : 2} strokeOpacity={isOthersHovered ? 0.2 : 1} dot={false} activeDot={{ r: 5, strokeWidth: 0, fill: glowColors[idx % glowColors.length], stroke: 'white' }} className={isHovered ? 'animate-pulse' : 'transition-all duration-300'} onMouseEnter={() => setHoveredEtfName(key)} onMouseLeave={() => setHoveredEtfName(null)} />;
                                  })}
                                </LineChart>
                              </ResponsiveContainer>
                            </div>
                          </section>
                        )}

                        {/* 3. Cumulative Fund Inflow Trend (순자금유입) */}
                        {data.visual_data.line_chart && data.visual_data.etf_keys && (
                          <section className="bg-white/[0.02] backdrop-blur-3xl rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] p-4 border border-white/5 relative group w-full">
                            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                            <div className="flex justify-between items-center mb-4 relative z-10">
                              <h3 className="text-base md:text-lg font-bold flex items-center gap-3">
                                <span className="w-1.5 h-6 bg-emerald-400 rounded-full"></span>
                                순자금유입 추이 <span className="text-xs font-normal text-gray-500 ml-1 hidden sm:inline">(누적, 억 원)</span>
                              </h3>
                            </div>

                            <div className="h-[400px] w-full relative z-10">
                              <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm rounded-lg overflow-hidden border border-white/5">
                                <div className="px-6 py-3 bg-indigo-600/90 text-white text-sm font-bold rounded-xl shadow-[0_0_30px_rgba(79,70,229,0.5)] border border-indigo-400/30">
                                  🚧 추후 개발 예정 (To Be Developed)
                                </div>
                              </div>
                              <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={simulatedChartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.03)" />
                                  <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 13 }} tickMargin={10} minTickGap={50} stroke="rgba(255,255,255,0.05)" axisLine={{ stroke: 'rgba(255,255,255,0.05)' }} />
                                  <YAxis domain={['auto', 'auto']} tick={{ fill: '#64748b', fontSize: 13 }} tickFormatter={(val) => `${val}`} stroke="rgba(255,255,255,0.05)" tickMargin={15} axisLine={false} />
                                  <Tooltip cursor={{ stroke: 'rgba(255,255,255,0.1)' }} contentStyle={{ backgroundColor: 'rgba(3, 7, 18, 0.95)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px', padding: '12px' }} labelStyle={{ color: '#94a3b8', marginBottom: '8px', fontSize: '13px' }} itemStyle={{ padding: '2px 0', fontSize: '12px' }} />
                                  <Legend iconType="circle" wrapperStyle={{ paddingTop: '15px', display: 'flex', justifyContent: 'center', gap: '20px', fontSize: '12px' }} onClick={(e: any) => {
                                    if (e && e.value) {
                                      const matchedEtf = data.raw_data?.find((d: any) => d.etf_name === e.value || d.etf_code === e.value);
                                      if (matchedEtf) setSelectedDetailEtf(matchedEtf);
                                    }
                                  }} onMouseEnter={(e: any) => { if (e && e.value) setHoveredEtfName(e.value); }}
                                    onMouseLeave={() => setHoveredEtfName(null)}
                                    formatter={(value) => <span className="cursor-pointer hover:text-white hover:underline transition-colors">{value}</span>} />
                                  {data.visual_data.etf_keys.map((key: string, idx: number) => {
                                    const glowColors = ["#818cf8", "#34d399", "#fbbf24", "#f87171", "#c084fc", "#60a5fa", "#f472b6", "#a3e635", "#f97316", "#14b8a6"];
                                    const isHovered = hoveredEtfName && (hoveredEtfName === key || key.includes(hoveredEtfName) || hoveredEtfName.includes(key));
                                    const isOthersHovered = hoveredEtfName && !isHovered;
                                    return <Line key={`${key}_inflow`} type="monotone" dataKey={`${key}_inflow`} name={key} stroke={glowColors[idx % glowColors.length]} strokeWidth={isHovered ? 5 : 2} strokeOpacity={isOthersHovered ? 0.2 : 1} dot={false} activeDot={{ r: 4 }} className={isHovered ? 'animate-pulse' : 'transition-all duration-300'} onMouseEnter={() => setHoveredEtfName(key)} onMouseLeave={() => setHoveredEtfName(null)} />;
                                  })}
                                </LineChart>
                              </ResponsiveContainer>
                            </div>
                          </section>
                        )}

                        {/* 4. Dividend Yield Trend (연간배당률) */}
                        {data.visual_data.line_chart && data.visual_data.etf_keys && (
                          <section className="bg-white/[0.02] backdrop-blur-3xl rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] p-4 border border-white/5 relative group w-full">
                            <div className="absolute inset-0 bg-gradient-to-bl from-rose-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                            <div className="flex justify-between items-center mb-4 relative z-10">
                              <h3 className="text-base md:text-lg font-bold flex items-center gap-3">
                                <span className="w-1.5 h-6 bg-rose-400 rounded-full"></span>
                                연간배당률 트렌드 <span className="text-xs font-normal text-gray-500 ml-1 hidden sm:inline">(TTM, %)</span>
                              </h3>
                            </div>

                            <div className="h-[400px] w-full relative z-10">
                              <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm rounded-lg overflow-hidden border border-white/5">
                                <div className="px-6 py-3 bg-rose-600/90 text-white text-sm font-bold rounded-xl shadow-[0_0_30px_rgba(225,29,72,0.5)] border border-rose-400/30">
                                  🚧 추후 개발 예정 (To Be Developed)
                                </div>
                              </div>
                              <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={simulatedChartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.03)" />
                                  <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 13 }} tickMargin={10} minTickGap={50} stroke="rgba(255,255,255,0.05)" axisLine={{ stroke: 'rgba(255,255,255,0.05)' }} />
                                  <YAxis domain={['auto', 'auto']} tick={{ fill: '#64748b', fontSize: 13 }} tickFormatter={(val) => `${val}%`} stroke="rgba(255,255,255,0.05)" tickMargin={15} axisLine={false} />
                                  <Tooltip cursor={{ stroke: 'rgba(255,255,255,0.1)' }} contentStyle={{ backgroundColor: 'rgba(3, 7, 18, 0.95)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px', padding: '12px' }} labelStyle={{ color: '#94a3b8', marginBottom: '8px', fontSize: '13px' }} itemStyle={{ padding: '2px 0', fontSize: '12px' }} />
                                  <Legend iconType="circle" wrapperStyle={{ paddingTop: '15px', display: 'flex', justifyContent: 'center', gap: '20px', fontSize: '12px' }} onClick={(e: any) => {
                                    if (e && e.value) {
                                      const matchedEtf = data.raw_data?.find((d: any) => d.etf_name === e.value || d.etf_code === e.value);
                                      if (matchedEtf) setSelectedDetailEtf(matchedEtf);
                                    }
                                  }} onMouseEnter={(e: any) => { if (e && e.value) setHoveredEtfName(e.value); }}
                                    onMouseLeave={() => setHoveredEtfName(null)}
                                    formatter={(value) => <span className="cursor-pointer hover:text-white hover:underline transition-colors">{value}</span>} />
                                  {data.visual_data.etf_keys.map((key: string, idx: number) => {
                                    const glowColors = ["#818cf8", "#34d399", "#fbbf24", "#f87171", "#c084fc", "#60a5fa", "#f472b6", "#a3e635", "#f97316", "#14b8a6"];
                                    const isHovered = hoveredEtfName && (hoveredEtfName === key || key.includes(hoveredEtfName) || hoveredEtfName.includes(key));
                                    const isOthersHovered = hoveredEtfName && !isHovered;
                                    return <Line key={`${key}_dividend`} type="monotone" dataKey={`${key}_dividend`} name={key} stroke={glowColors[idx % glowColors.length]} strokeWidth={isHovered ? 5 : 2} strokeOpacity={isOthersHovered ? 0.2 : 1} dot={false} activeDot={{ r: 4 }} className={isHovered ? 'animate-pulse' : 'transition-all duration-300'} onMouseEnter={() => setHoveredEtfName(key)} onMouseLeave={() => setHoveredEtfName(null)} />;
                                  })}
                                </LineChart>
                              </ResponsiveContainer>
                            </div>
                          </section>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        }

        {/* Background ambient glow effect */}
        {/* 즐겨찾기 Modal */}
        {
          isFavModalOpen && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center bg-transparent animate-in fade-in duration-200 p-2 md:p-6">
              <div className="bg-[#0f111a] border border-white/10 rounded-2xl w-full max-w-[1400px] h-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center p-4 border-b border-white/10 relative gap-3 bg-black/20">
                  <h2 className="text-xl md:text-2xl font-bold flex items-center gap-2 text-white">
                    <Star className="w-6 h-6 text-yellow-500 fill-yellow-500/20" /> 나의 관심종목 즐겨찾기
                  </h2>

                  <div className="flex items-center gap-3 w-full md:w-auto">
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
                        <div className="flex justify-between items-center mb-4 pb-3 border-b border-white/10">
                          <div className="flex items-center gap-3">
                            <h3 className="text-lg font-bold text-indigo-300 tracking-wide">{group.name}</h3>
                            <div className="flex gap-1">
                              <button onClick={() => renameFavGroup(group.id, group.name)} className="p-1.5 text-gray-500 hover:text-indigo-400 bg-white/5 rounded-md transition-colors" title="그룹명 수정"><Edit2 className="w-3.5 h-3.5" /></button>
                              <button onClick={() => deleteFavGroup(group.id)} className="p-1.5 text-gray-500 hover:text-rose-400 bg-white/5 rounded-md transition-colors" title="그룹 삭제"><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                          </div>
                          <button
                            onClick={() => selectFromFavorites(group.items)}
                            disabled={group.items.length === 0}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-indigo-500 text-white rounded-md text-xs font-semibold disabled:opacity-30 transition-all shadow-sm"
                          >
                            <Check className="w-3 h-3" /> 그룹전체 바로넣기 ({group.items.length})
                          </button>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
                          {group.items.map(item => {
                            const isSelected = selectedFavItems.some(i => i.code === item.code);
                            return (
                              <div
                                key={item.code}
                                className={`flex flex-col justify-between items-start bg-black/40 border-2 rounded-lg p-2.5 group/favitem transition-all cursor-pointer ${isSelected ? 'border-indigo-500 bg-indigo-900/30' : 'border-white/5 hover:border-indigo-400/50 hover:bg-white/5'
                                  }`}
                                onClick={() => toggleFavItemSelection(item)}
                              >
                                <div className="flex justify-between items-start w-full mb-1">
                                  <span className="font-mono text-[10px] text-indigo-400/80 bg-black/30 px-1.5 py-0.5 rounded border border-indigo-500/10">
                                    {item.code}
                                  </span>
                                  <button onClick={(e) => { e.stopPropagation(); removeFavItem(group.id, item.code); }} className="opacity-0 group-hover/favitem:opacity-100 p-1 text-gray-500 hover:text-rose-400 transition-all ml-1 bg-white/5 rounded hover:bg-rose-500/20" title="종목 삭제">
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

                        {/* Add Item to Group UI */}
                        <div className="mt-4 relative z-50">
                          {/* 🚀 Fav Search Quick Filters */}
                          <div className="flex flex-col gap-1 mb-2">
                            <div className="flex flex-wrap items-center gap-1">
                              <span className="text-[9px] font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-blue-400 mr-1 flex items-center min-w-[36px]"><span className="mr-0.5">🏢</span> 운용사:</span>
                              {BRAND_KEYWORDS.map(brand => {
                                const currentQuery = favSearchQuery[group.id] || "";
                                const isActive = currentQuery.split(' ').includes(brand);
                                return (
                                  <button
                                    key={brand}
                                    onMouseDown={(e) => {
                                      e.preventDefault();
                                      const terms = currentQuery.split(' ').filter(t => t.trim() !== '');
                                      const newSearch = terms.includes(brand) ? terms.filter(t => t !== brand).join(' ') : [...terms, brand].join(' ');
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
                            <div className="flex flex-wrap items-center gap-1">
                              <span className="text-[9px] font-bold text-transparent bg-clip-text bg-gradient-to-r from-rose-400 to-orange-400 mr-1 flex items-center min-w-[36px]"><span className="mr-0.5">🔥</span> HOT:</span>
                              {THEME_KEYWORDS.map(theme => {
                                const currentQuery = favSearchQuery[group.id] || "";
                                const isActive = currentQuery.split(' ').includes(theme);
                                return (
                                  <button
                                    key={theme}
                                    onMouseDown={(e) => {
                                      e.preventDefault();
                                      const terms = currentQuery.split(' ').filter(t => t.trim() !== '');
                                      const newSearch = terms.includes(theme) ? terms.filter(t => t !== theme).join(' ') : [...terms, theme].join(' ');
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

                          <div className="flex items-center px-3 py-2 bg-black/60 border border-white/10 focus-within:border-indigo-500/50 rounded-lg transition-colors">
                            <Search className="w-4 h-4 text-indigo-400 mr-2" />
                            <input
                              id={`fav-search-${group.id}`}
                              value={favSearchQuery[group.id] || ""}
                              onChange={e => setFavSearchQuery(prev => ({ ...prev, [group.id]: e.target.value }))}
                              className="bg-transparent border-none outline-none text-sm text-gray-200 w-full placeholder-gray-500"
                              placeholder="ETF 이름을 검색하여 이 그룹에 추가..."
                            />
                          </div>

                          {favSearchQuery[group.id] && etfDictionary.length > 0 && (
                            <div className="absolute top-[110%] left-0 w-full max-h-[240px] overflow-y-auto bg-[#1a1c23]/95 border border-indigo-500/30 rounded-xl shadow-2xl backdrop-blur-xl z-[100] custom-scrollbar">
                              {(() => {
                                const terms = (favSearchQuery[group.id] || "").toLowerCase().split(' ').filter(t => t.trim() !== '');
                                if (terms.length === 0) return null;

                                const lowerBrands = BRAND_KEYWORDS.map(b => b.toLowerCase());
                                const brandTerms = terms.filter(t => lowerBrands.includes(t));
                                const themeTerms = terms.filter(t => !lowerBrands.includes(t));

                                const filtered = etfDictionary.filter(e => {
                                  const etfName = e.name.toLowerCase().replace(/\s/g, '');
                                  const etfCode = e.code.toLowerCase();

                                  const brandMatch = brandTerms.length === 0 ? true : brandTerms.some(term => etfName.includes(term) || etfCode.includes(term));
                                  const themeMatch = themeTerms.length === 0 ? true : themeTerms.some(term => etfName.includes(term) || etfCode.includes(term));

                                  return brandMatch && themeMatch;
                                }).slice(0, 30);

                                if (filtered.length === 0) return <div className="p-4 text-sm text-rose-400 font-medium text-center">검색 결과가 없습니다.</div>;

                                return filtered.map(e => (
                                  <div
                                    key={e.code}
                                    onClick={() => { addFavItem(group.id, e.code, e.name); setFavSearchQuery(prev => ({ ...prev, [group.id]: "" })); }}
                                    className="px-5 py-3 text-sm text-gray-300 hover:bg-indigo-600/40 cursor-pointer border-b border-indigo-500/10 last:border-0 transition-colors flex justify-between group"
                                  >
                                    <span className="text-white font-medium group-hover:text-indigo-200 truncate pr-4">{e.name}</span>
                                    <span className="font-mono text-xs text-indigo-400 bg-black/30 px-2 py-0.5 rounded border border-white/5">{e.code}</span>
                                  </div>
                                ));
                              })()}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )
        }

        {/* Detail Information Modal (Naver UI style) */}
        {
          selectedDetailEtf && (
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
                                className={`px-2 py-1 text-[10px] font-bold transition-all ${popupPeriod === p
                                  ? 'bg-blue-600/60 text-white rounded'
                                  : 'text-gray-500 hover:text-gray-300'
                                  }`}
                              >
                                {p}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="flex-1 min-h-[250px] w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={detailMockData.price} margin={{ top: 5, right: 0, left: -20, bottom: 5 }}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                              <XAxis dataKey="day" tick={{ fill: '#64748b', fontSize: 11 }} tickMargin={10} stroke="#1e293b" minTickGap={30} />
                              <YAxis yAxisId="left" tick={{ fill: '#3b82f6', fontSize: 11 }} tickFormatter={(val) => `${val}%`} stroke="#1e293b" axisLine={false} domain={detailMockData.domainLeft as any} />
                              <YAxis yAxisId="right" orientation="right" tick={{ fill: '#ef4444', fontSize: 11 }} tickFormatter={(val) => `${val.toLocaleString()}`} stroke="#1e293b" axisLine={false} domain={detailMockData.domainRight as any} />
                              <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155' }} />
                              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                              <Line yAxisId="left" type="monotone" dataKey="rel_yield" name={detailMockData.benchmarkName} stroke="#3b82f6" strokeWidth={2} dot={false} />
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
                            {detailMockData.nav.slice().reverse().slice(0, 7).map((n: any, i: number) => (
                              <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-800/20">
                                <td className="p-2.5 text-center text-gray-400">{n.date}</td>
                                <td className="p-2.5 text-gray-200">{n.nav.toLocaleString()}</td>
                                <td className="p-2.5 text-gray-200">{n.price.toLocaleString()}</td>
                                <td className={`p-2.5 font-medium ${n.diff > 0 ? 'text-rose-400' : n.diff < 0 ? 'text-blue-400' : 'text-gray-300'}`}>{n.diff.toFixed(2)}</td>
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
                            <ComposedChart data={detailMockData.nav} margin={{ top: 5, right: 0, left: 15, bottom: 5 }}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                              <XAxis dataKey="day" tick={{ fill: '#64748b', fontSize: 11 }} tickMargin={10} stroke="#1e293b" minTickGap={15} />
                              <YAxis yAxisId="left" tick={{ fill: '#ef4444', fontSize: 11 }} tickFormatter={(val) => `${val.toLocaleString()}`} stroke="#1e293b" axisLine={false} domain={['auto', 'auto']} />
                              <YAxis yAxisId="right" orientation="right" tick={{ fill: '#3b82f6', fontSize: 11 }} tickFormatter={(val) => `${val.toFixed(2)}`} stroke="#1e293b" axisLine={false} domain={[-0.5, 0.5]} />
                              <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155' }} />
                              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                              <Bar yAxisId="right" dataKey="diff" name="괴리율" fill="#3b82f6" maxBarSize={4} />
                              <Line yAxisId="left" type="monotone" dataKey="nav" name="순자산가치(NAV)" stroke="#ef4444" strokeWidth={2} dot={false} />
                              <Line yAxisId="left" type="monotone" dataKey="price" name="ETF 종가" stroke="#84cc16" strokeDasharray="5 5" strokeWidth={2} dot={false} />
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
                              <th className="p-3 border-b border-slate-700 font-medium">주식수(가설)</th>
                              <th className="p-3 border-b border-slate-700 font-medium pr-5">구성비중(%)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedDetailEtf.holdings?.length > 0 ? (
                              selectedDetailEtf.holdings.slice(0, 10).map((h: any, i: number) => (
                                <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-800/20">
                                  <td className="p-2.5 text-left text-gray-200 pl-5">{h.ticker}</td>
                                  <td className="p-2.5 text-gray-400">{Math.round(h.weight * 50).toLocaleString()}</td>
                                  <td className="p-2.5 font-bold text-indigo-300 pr-5">{h.weight.toFixed(2)}</td>
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
                          {selectedDetailEtf.holdings?.length > 0 ? (
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
                            <div className="flex items-center justify-center h-full text-gray-600">No chart data</div>
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
                            {detailMockData.vol.map((v: any, i: number) => (
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
                            <ComposedChart data={detailMockData.vol.slice().reverse()} margin={{ top: 5, right: 0, left: -10, bottom: 5 }}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                              <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 11 }} tickMargin={10} stroke="#1e293b" />
                              <YAxis yAxisId="left" tick={{ fill: '#3b82f6', fontSize: 11 }} tickFormatter={(val) => `${val.toLocaleString()}`} stroke="#1e293b" axisLine={false} />
                              <YAxis yAxisId="right" orientation="right" tick={{ fill: '#ef4444', fontSize: 11 }} tickFormatter={(val) => `${val.toLocaleString()}`} stroke="#1e293b" axisLine={false} />
                              <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155' }} />
                              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                              <Bar yAxisId="left" dataKey="volume" name="월간평균거래량(좌)" fill="#3b82f6" maxBarSize={15} />
                              <Line yAxisId="right" type="monotone" dataKey="value" name="월간평균거래대금(우)" stroke="#ea580c" strokeWidth={2} dot={{ r: 3 }} />
                            </ComposedChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            </div>
          )
        }

        {/* ETF Check Modal */}
        {hasOpenedEtfCheck && (
          <div className={`absolute top-0 inset-x-0 bottom-2 md:bottom-4 z-[400] flex-col animate-in fade-in duration-300 ${isEtfCheckModalOpen ? 'flex' : 'hidden'}`}>
            <div className="w-full h-full bg-neutral-900 border border-neutral-700/50 rounded-2xl shadow-2xl shadow-teal-500/10 flex flex-col overflow-hidden ring-1 ring-white/10">
              {/* Header */}
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

              {/* Iframe content with Dark Mode Filter */}
              <div className="w-full flex-1 overflow-hidden relative bg-[#0b0f19]">
                {/* CSS Trick: Invert colors + hue-rotate to fake a dark mode over white themed external sites */}
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

        {/* Naver Modal */}
        {naverEtfCode && (
          <div className="absolute top-0 inset-x-0 bottom-2 md:bottom-4 z-[500] flex-col animate-in fade-in duration-300 flex">
            <div className="w-full h-full bg-neutral-900 border border-neutral-700/50 rounded-2xl shadow-2xl shadow-blue-500/10 flex flex-col overflow-hidden ring-1 ring-white/10">
              {/* Header */}
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

              {/* Iframe content with Dark Mode Filter */}
              <div className="w-full flex-1 overflow-hidden relative bg-[#0b0f19]">
                {/* CSS Trick: Invert colors + hue-rotate to fake a dark mode over white themed external sites */}
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

      </div>

      {/* Copyright */}
      <div className="mt-auto w-full text-center text-sm text-gray-500/80 font-medium flex items-center justify-center gap-3 pb-1">
        <span>Copyright &copy; Hoya 2026</span>
        <span className="text-[10px] text-gray-500 font-medium tracking-wider border-l border-white/10 pl-3">v.20260225_0719</span>
      </div>
    </main >
  );
}
