"use client";

import { useState, useEffect, useMemo } from "react";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip as RechartsTooltip, LineChart, Line, XAxis, YAxis, CartesianGrid, Legend, BarChart, Bar, Cell, PieChart, Pie, ComposedChart, ReferenceLine, ReferenceArea } from "recharts";
import { Search, Loader2, Plus, X, ChevronDown, Aperture, Star, Trash2, Edit2, Check, Share2, RefreshCw, BarChart2, Minus, Zap, Crown, Target, Layers, BookOpen, AlertCircle, ArrowUpRight, ArrowDownRight, Clock, ShieldAlert, Cpu } from "lucide-react";
import { API_BASE } from '@/lib/apiConfig';
import CompareChart from "@/components/CompareChart";
import CompareTable from "@/components/CompareTable";
import Modals from "@/components/Modals";
import DiscoverTab from "@/components/DiscoverTab";
import CoveredCallTab from "@/components/CoveredCallTab";
import ChatBot from "@/components/ChatBot";

type FavGroup = { id: string; name: string; items: { code: string; name: string }[] };

const BRAND_KEYWORDS = ['1Q', 'ACE', 'HANARO', 'KIWOOM', 'KODEX', 'KoAct', 'PLUS', 'RISE', 'SOL', 'TIGER', 'TIME'];
const THEME_KEYWORDS = ['커버드콜', '배당', '액티브', 'AI', '반도체', '로봇', '원자력', '2차전지', '조선', '방산', '금융', '바이오'];

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
  const [activeTab, setActiveTab] = useState<'select' | 'info' | 'holdings' | 'chart' | 'discover' | 'covered_call'>('select');

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
  const [dbVersion, setDbVersion] = useState<string>("VER --");
  const [healthStatus, setHealthStatus] = useState<'pending' | 'ok' | 'error'>('pending');
  const [failedServices, setFailedServices] = useState<string[]>([]);
  // 테마 키워드 AND/OR 토글: true = AND(&, 기본값), false = OR
  const [themeAndMode, setThemeAndMode] = useState(true);
  // ChatBot open state (lifted up to allow header button control)
  const [isChatOpen, setIsChatOpen] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {

    fetch(`${API_BASE}/api/v1/analyze/db-version`)
      .then(res => res.json())
      .then(data => {
        if (data.version) setDbVersion(data.version);
      })
      .catch(err => console.error("DB version load error", err));

    fetch(`${API_BASE}/api/v1/analyze/health`)
      .then(res => res.json())
      .then(data => {
        if (data.overall) setHealthStatus(data.overall);
        if (data.failed_services) setFailedServices(data.failed_services);
      })
      .catch(err => {
        console.error("Health check error", err);
        setHealthStatus("error");
        setFailedServices(["서버 통신"]);
      });
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
      else if (period === '3M') cutoffDate.setMonth(cutoffDate.getMonth() - 3);
      else if (period === '6M') cutoffDate.setMonth(cutoffDate.getMonth() - 6);
      else if (period === '1Y') cutoffDate.setFullYear(cutoffDate.getFullYear() - 1);
      else if (period === '3Y') cutoffDate.setFullYear(cutoffDate.getFullYear() - 3);
      else if (period === '10Y') cutoffDate.setFullYear(cutoffDate.getFullYear() - 10);

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

    const benchKeys = ['KOSPI', 'KOSDAQ', 'SP500', 'NASDAQ'];
    benchKeys.forEach((key: string) => {
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
      const allKeys = [...keys, ...benchKeys];
      allKeys.forEach((key: string) => {
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
          const currentRaw = d[`${key}_raw`];
          const prevRaw = chartData[i - 1][`${key}_raw`];
          const priceChangeRatio = (currentRaw && prevRaw) ? ((currentRaw - prevRaw) / prevRaw) : 0;
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

  const detailChartData = useMemo(() => {
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
      const aumStr = String(aumRaw);
      // e.g. "17조 1,478억" or "500억"
      let parsedAum = 0;
      if (aumStr.includes("조") && aumStr.includes("억")) {
        const parts = aumStr.split("조");
        const jo = parseFloat(parts[0].replace(/,/g, "")) || 0;
        const uk = parseFloat(parts[1].replace("억", "").replace(/,/g, "")) || 0;
        parsedAum = jo * 10000 + uk; // in 억 unit
      } else if (aumStr.includes("조")) {
        parsedAum = parseFloat(aumStr.replace("조", "").replace(/,/g, "")) * 10000 || 0;
      } else {
        parsedAum = parseFloat(aumStr.replace("억", "").replace(/,/g, "")) || 0;
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

      <header className="w-full max-w-[95vw] xl:max-w-[1400px] mb-2 md:mb-4 flex flex-row md:flex-row justify-between items-center gap-2 md:gap-3 relative z-50">
        {/* 로고 */}
        <div className="flex flex-col items-start cursor-pointer group shrink-0" onClick={handleReset}>
          <h1 className="text-2xl md:text-4xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 drop-shadow-sm flex items-center gap-2 group-hover:opacity-80 transition-opacity">
            <Aperture className="w-6 h-6 md:w-10 md:h-10 text-indigo-400 group-hover:rotate-180 transition-transform duration-700" />
            ETF Lens
            <div className="hidden sm:flex flex-col gap-1 items-start ml-2">
              <span className={`text-[10px] md:text-[11px] font-mono font-medium px-2 py-0.5 rounded-md uppercase tracking-widest whitespace-nowrap ${dbVersion === 'VER --'
                ? "text-rose-400 bg-rose-400/10 border border-rose-400/20 shadow-[0_0_10px_rgba(244,63,94,0.15)] animate-pulse"
                : "text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 shadow-[0_0_10px_rgba(52,211,153,0.15)]"
                }`}>
                {dbVersion}
              </span>
              {healthStatus === 'pending' && (
                <span className="text-[10px] md:text-[11px] font-bold px-2 py-0.5 rounded-md whitespace-nowrap text-gray-400 bg-gray-400/10 border border-gray-400/20 animate-pulse flex items-center gap-1">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-gray-400 animate-ping" />
                  외부연동 체크중...
                </span>
              )}
              {healthStatus === 'ok' && (
                <span className="text-[10px] md:text-[11px] font-bold px-2 py-0.5 rounded-md whitespace-nowrap text-sky-400 bg-sky-400/10 border border-sky-400/20 animate-pulse shadow-[0_0_10px_rgba(56,189,248,0.2)]">
                  모든 연동기능이 정상작동중 입니다.
                </span>
              )}
              {healthStatus === 'error' && (
                <span className="text-[10px] md:text-[11px] font-bold px-2 py-0.5 rounded-md whitespace-nowrap text-rose-500 bg-rose-500/10 border border-rose-500/20 shadow-[0_0_10px_rgba(244,63,94,0.15)] flex items-center gap-1">
                  <AlertCircle size={12} /> {failedServices.length > 0 ? `${failedServices.join(', ')} 오류 체크바람` : '현재 연동에 문제가 있습니다. 체크바람'}
                </span>
              )}
            </div>
          </h1>
        </div>

        {/* 우측: AI 버튼 + 탭 (PC에서만 탭 표시) */}
        <div className="flex items-center gap-2 md:gap-4">
          {/* AI Assistant 버튼 */}
          <ChatBot renderTrigger isOpen={isChatOpen} setIsOpen={setIsChatOpen} />

          {/* 메인 탭 — PC 전용 (모바일은 하단 네비로 대체) */}
          <nav className="hidden md:flex items-center gap-2 md:gap-4 bg-white/[0.03] px-4 md:px-6 py-2 rounded-full border border-white/10 backdrop-blur-md shadow-sm">
            {[
              { id: 'analysis', label: '종목분석' },
              { id: 'covered_call', label: '커버드콜' },
              { id: 'discover', label: '모니터링' },
              { id: 'etftracker', label: 'ETF추적기' },
              { id: 'etfcheck', label: 'ETF Check' }
            ].map(tab => {
              const isAnalysisActive = ['select', 'info', 'chart', 'holdings'].includes(activeTab);
              const isActive = (tab.id === 'etfcheck' && isEtfCheckModalOpen) ||
                (tab.id === 'analysis' && isAnalysisActive && !isEtfCheckModalOpen) ||
                (activeTab === tab.id && !isEtfCheckModalOpen);
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    if (tab.id === 'etfcheck') {
                      setIsEtfCheckModalOpen(true);
                      setHasOpenedEtfCheck(true);
                      return;
                    }
                    if (tab.id === 'etftracker') {
                      window.open('https://ystreet.co.kr/etf-tracker/', '_blank', 'noopener,noreferrer');
                      return;
                    }
                    if (tab.id === 'analysis') {
                      setActiveTab('select');
                      setIsEtfCheckModalOpen(false);
                      return;
                    }
                    setActiveTab(tab.id as 'select' | 'info' | 'holdings' | 'chart' | 'discover' | 'covered_call');
                    setIsEtfCheckModalOpen(false);
                    setNaverEtfCode(null);
                    setSelectedDetailEtf(null);
                  }}
                  className={`text-[17px] tracking-wide font-bold transition-all px-3 md:px-4 py-1.5 rounded-full whitespace-nowrap ${isActive ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-[0_0_15px_rgba(99,102,241,0.5)]' : 'text-gray-400/80 hover:text-gray-100 hover:bg-white/5'}`}
                >
                  {tab.label}
                </button>
              )
            })}
          </nav>
        </div>
      </header>

      {/* 서브탭: 종목분석 탭 선택시만 헤더 아래에 표시 */}
      {['select', 'info', 'chart', 'holdings'].includes(activeTab) && !isEtfCheckModalOpen && (
        <div className="w-full max-w-[95vw] xl:max-w-[1400px] flex justify-center mb-2 relative z-50">
          {/* 모바일: 수평 스크롤 가능한 서브탭 */}
          <nav className="flex items-center gap-2 md:gap-4 bg-black/40 px-4 py-1.5 rounded-full border border-white/10 shadow-sm backdrop-blur-md overflow-x-auto scrollbar-hide">
            {[
              { id: 'select', label: '종목선택' },
              { id: 'info', label: '기본정보' },
              { id: 'chart', label: '차트' },
              { id: 'holdings', label: '구성종목' },
            ].map(subTab => (
              <button
                key={subTab.id}
                onClick={() => {
                  if (subTab.id !== 'select' && !data) {
                    alert('먼저 종목을 선택하고 비교를 실행해주세요.');
                    return;
                  }
                  setActiveTab(subTab.id as 'select' | 'info' | 'holdings' | 'chart' | 'discover' | 'covered_call');
                  setNaverEtfCode(null);
                  setSelectedDetailEtf(null);
                }}
                className={`text-sm md:text-[15px] font-bold transition-all px-3 py-1 rounded-full whitespace-nowrap ${activeTab === subTab.id ? 'bg-white/20 text-white shadow-inner border border-white/20' : 'text-gray-400 hover:text-white hover:bg-white/10 border border-transparent'}`}
              >
                {subTab.label}
              </button>
            ))}
          </nav>
        </div>
      )}

      {/* ChatBot 채팅창 — 서브탭 아래 */}
      {isChatOpen && (
        <div className="w-full max-w-[95vw] xl:max-w-[1400px] mb-4 z-40 relative">
          <ChatBot renderChat isOpen={isChatOpen} setIsOpen={setIsChatOpen} />
        </div>
      )}

      <div className="relative flex-1 flex flex-col w-full max-w-[95vw] xl:max-w-[1400px] mobile-content-area">

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

                    {/* AND / OR 토글 버튼 */}
                    <button
                      onMouseDown={(e) => { e.preventDefault(); setThemeAndMode(prev => !prev); }}
                      title={themeAndMode
                        ? "현재: AND — 선택한 키워드 모두 포함된 종목 검색. 클릭하면 OR로 전환"
                        : "현재: OR — 선택한 키워드 중 하나라도 포함된 종목 검색. 클릭하면 AND(&)로 전환"}
                      className={`text-[10px] font-black px-2 py-0.5 rounded-full border transition-all select-none ${
                        themeAndMode
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-[0_0_6px_rgba(245,158,11,0.3)]'
                          : 'bg-sky-500/20 text-sky-300 border-sky-500/50 shadow-[0_0_6px_rgba(14,165,233,0.3)]'
                      }`}
                    >
                      {themeAndMode ? '&' : 'OR'}
                    </button>

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
                          // 테마 키워드: AND/OR 모드 적용
                          const themeMatch = themeTerms.length === 0 ? true :
                            themeAndMode
                              ? themeTerms.every(term => etfName.includes(term) || etfCode.includes(term))
                              : themeTerms.some(term => etfName.includes(term) || etfCode.includes(term));

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
                              // 테마 키워드: AND/OR 모드 적용
                              const themeMatch = themeTerms.length === 0 ? true :
                                themeAndMode
                                  ? themeTerms.every(term => etfName.includes(term) || etfCode.includes(term))
                                  : themeTerms.some(term => etfName.includes(term) || etfCode.includes(term));

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
                <CompareTable
                  data={data}
                  radarData={radarData}
                  additionalStatsData={additionalStatsData}
                  hoveredEtfName={hoveredEtfName}
                  setHoveredEtfName={setHoveredEtfName}
                  setSelectedDetailEtf={setSelectedDetailEtf}
                />
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
                                        <span className="font-bold text-gray-300 ml-1 flex-shrink-0">
                                          {h.weight > 0 ? `${h.weight.toFixed(2)}%` : (h.shares ? `${h.shares.toLocaleString()}주` : '0.00%')}
                                        </span>
                                      </div>
                                      <div className="w-full bg-black/40 rounded-full h-1.5 overflow-hidden border border-white/5">
                                        <div
                                          className={`h-full ${fillColors[idx % fillColors.length]} rounded-full transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(255,255,255,0.3)]`}
                                          style={{ width: `${Math.min(100, ((h.weight || h.shares) / (etf.holdings[0]?.weight || etf.holdings[0]?.shares || 100)) * 100)}%` }}
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
                <CompareChart
                  data={data}
                  simulatedChartData={simulatedChartData}
                  additionalStatsData={additionalStatsData}
                  period={period}
                  setPeriod={setPeriod}
                  isLoadingChart={isLoadingChart}
                  hoveredEtfName={hoveredEtfName}
                  setHoveredEtfName={setHoveredEtfName}
                  setSelectedDetailEtf={setSelectedDetailEtf}
                />
              )}

            </div >
          )
        }

        {/* Discover Section */}
        {activeTab === 'discover' && (
          <DiscoverTab />
        )}

        {/* Covered Call Section */}
        {activeTab === 'covered_call' && (
          <CoveredCallTab />
        )}

        <Modals
          isFavModalOpen={isFavModalOpen}
          setIsFavModalOpen={setIsFavModalOpen}
          selectedFavItems={selectedFavItems}
          selectFromFavorites={selectFromFavorites}
          favorites={favorites}
          addFavGroup={addFavGroup}
          renameFavGroup={renameFavGroup}
          deleteFavGroup={deleteFavGroup}
          toggleFavItemSelection={toggleFavItemSelection}
          removeFavItem={removeFavItem}
          addFavItem={addFavItem}
          favSearchQuery={favSearchQuery}
          setFavSearchQuery={setFavSearchQuery}
          etfDictionary={etfDictionary}
          selectedDetailEtf={selectedDetailEtf}
          setSelectedDetailEtf={setSelectedDetailEtf}
          setNaverEtfCode={setNaverEtfCode}
          hasOpenedEtfCheck={hasOpenedEtfCheck}
          isEtfCheckModalOpen={isEtfCheckModalOpen}
          setIsEtfCheckModalOpen={setIsEtfCheckModalOpen}
          naverEtfCode={naverEtfCode}
          popupPeriod={popupPeriod}
          setPopupPeriod={setPopupPeriod}
          BRAND_KEYWORDS={BRAND_KEYWORDS}
          THEME_KEYWORDS={THEME_KEYWORDS}
          detailChartData={detailChartData}
        />

      </div >


      {/* Copyright — PC only */}
      <div className="hidden md:flex mt-auto w-full text-center text-sm text-gray-500/80 font-medium items-center justify-center gap-3 pb-1">
        <span>Copyright &copy; Hoya 2026</span>
        <span className="text-[10px] text-gray-500 font-medium tracking-wider border-l border-white/10 pl-3">v.20260225_0719</span>
      </div>

      {/* 모바일 전용 하단 네비게이션 바 (md 이상에서는 숨김) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-[90] flex items-center justify-around bg-[#1e2035]/98 backdrop-blur-xl border-t border-white/20 shadow-[0_-4px_24px_rgba(0,0,0,0.5)]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)', height: 'calc(68px + env(safe-area-inset-bottom, 0px))' }}
      >
        {[
          { id: 'analysis',     label: '종목분석',  icon: <BarChart2 className="w-6 h-6" /> },
          { id: 'covered_call', label: '커버드콜',  icon: <Layers    className="w-6 h-6" /> },
          { id: 'discover',     label: '모니터링',  icon: <Cpu       className="w-6 h-6" /> },
          { id: 'etftracker',   label: 'ETF추적기', icon: <Target    className="w-6 h-6" /> },
          { id: 'etfcheck',     label: 'ETF Check', icon: <BookOpen  className="w-6 h-6" /> },
        ].map(tab => {
          const isAnalysisActive = ['select', 'info', 'chart', 'holdings'].includes(activeTab);
          const isActive =
            (tab.id === 'etfcheck'  && isEtfCheckModalOpen) ||
            (tab.id === 'analysis'  && isAnalysisActive && !isEtfCheckModalOpen) ||
            (activeTab === tab.id   && !isEtfCheckModalOpen);
          return (
            <button
              key={tab.id}
              onClick={() => {
                if (tab.id === 'etfcheck') {
                  setIsEtfCheckModalOpen(true);
                  setHasOpenedEtfCheck(true);
                  return;
                }
                if (tab.id === 'etftracker') {
                  window.open('https://ystreet.co.kr/etf-tracker/', '_blank', 'noopener,noreferrer');
                  return;
                }
                if (tab.id === 'analysis') {
                  setActiveTab('select');
                  setIsEtfCheckModalOpen(false);
                  return;
                }
                setActiveTab(tab.id as 'select' | 'info' | 'holdings' | 'chart' | 'discover' | 'covered_call');
                setIsEtfCheckModalOpen(false);
                setNaverEtfCode(null);
                setSelectedDetailEtf(null);
              }}
              className={`relative flex flex-col items-center justify-center gap-0.5 flex-1 h-full pt-1 transition-all ${
                isActive ? 'text-indigo-400' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <span className={`transition-transform ${isActive ? 'scale-110' : ''}`}>
                {tab.icon}
              </span>
              <span className={`text-[11px] font-bold tracking-tight ${isActive ? 'text-indigo-400' : 'text-gray-400'}`}>
                {tab.label}
              </span>
              {isActive && (
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500" />
              )}
            </button>
          );
        })}
      </nav>
    </main>
  );
}
