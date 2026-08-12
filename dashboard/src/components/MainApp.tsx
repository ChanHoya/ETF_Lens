"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip as RechartsTooltip, LineChart, Line, XAxis, YAxis, CartesianGrid, Legend, BarChart, Bar, Cell, PieChart, Pie, ComposedChart, ReferenceLine, ReferenceArea } from "recharts";
import { Search, Loader2, Plus, X, ChevronDown, ChevronLeft, ChevronRight, Aperture, Star, Trash2, Edit2, Check, Share2, RefreshCw, BarChart2, Minus, Zap, Crown, Target, Layers, BookOpen, AlertCircle, ArrowUpRight, ArrowDownRight, Clock, ShieldAlert, Cpu, Maximize2, Minimize2 } from "lucide-react";
import { API_BASE } from '@/lib/apiConfig';
import { prefetchMonitorData } from '@/lib/monitorPrefetch';
import CompareChart from "@/components/CompareChart";
import CompareTable from "@/components/CompareTable";
import MarqueeText from "@/components/MarqueeText";
import Modals from "@/components/Modals";
import DiscoverTab from "@/components/DiscoverTab";
import CoveredCallTab from "@/components/CoveredCallTab";
import BrazilBondTab from "@/components/BrazilBondTab";
import ChatBot from "@/components/ChatBot";
import { useRouter } from "next/navigation";
import MyAssetsView from "./MyAssetsView";
import SectorAnalysisTab from "./SectorAnalysisTab";
import TffGateWrapper from "./tff/TffGateWrapper";

type FavGroup = { id: string; name: string; items: { code: string; name: string }[] };

const BRAND_KEYWORDS = ['1Q', 'ACE', 'HANARO', 'KIWOOM', 'KODEX', 'KoAct', 'PLUS', 'RISE', 'SOL', 'TIGER', 'TIME'];
const THEME_KEYWORDS = ['커버드콜', '배당', '액티브', 'AI', '반도체', '로봇', '원자력', '2차전지', '조선', '방산', '금융', '바이오'];

export default function MainApp({ initialTab = 'select', showMyTab = false, showTffTab = false }: { initialTab?: 'select' | 'info' | 'holdings' | 'chart' | 'discover' | 'covered_call' | 'my' | 'tff' | 'sector' | 'brazil', showMyTab?: boolean, showTffTab?: boolean }) {
  const router = useRouter();
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
  const [activeTab, setActiveTab] = useState<'select' | 'info' | 'holdings' | 'chart' | 'discover' | 'covered_call' | 'my' | 'tff' | 'sector' | 'brazil'>(initialTab);

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
  const [popupData, setPopupData] = useState<any>(null); // For ad-hoc detail fetch
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

  // 백그라운드 프리페치: 앱 로드 2.5초 후 시장동향 탭 데이터 미리 fetch
  useEffect(() => {
    const timer = setTimeout(() => {
      prefetchMonitorData(API_BASE);
    }, 2500);
    return () => clearTimeout(timer);
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

  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        const docEl = document.documentElement as any;
        if (docEl.requestFullscreen) {
          await docEl.requestFullscreen();
        } else if (docEl.webkitRequestFullscreen) {
          await docEl.webkitRequestFullscreen();
        } else if (docEl.msRequestFullscreen) {
          await docEl.msRequestFullscreen();
        }
      } else {
        const doc = document as any;
        if (doc.exitFullscreen) {
          await doc.exitFullscreen();
        } else if (doc.webkitExitFullscreen) {
          await doc.webkitExitFullscreen();
        } else if (doc.msExitFullscreen) {
          await doc.msExitFullscreen();
        }
      }
    } catch (err) {
      console.error("Fullscreen toggle error:", err);
    }
  };

  // 메인 메뉴바 PC 마우스 드래그 & 스크롤 제어
  const mainNavRef = useRef<HTMLDivElement>(null);
  const [isNavMouseDown, setIsNavMouseDown] = useState(false);
  const [navStartX, setNavStartX] = useState(0);
  const [navScrollLeft, setNavScrollLeft] = useState(0);
  const [hasNavDragged, setHasNavDragged] = useState(false);

  const handleNavMouseDown = (e: React.MouseEvent) => {
    if (!mainNavRef.current) return;
    setIsNavMouseDown(true);
    setHasNavDragged(false);
    setNavStartX(e.pageX - mainNavRef.current.offsetLeft);
    setNavScrollLeft(mainNavRef.current.scrollLeft);
  };

  const handleNavMouseLeave = () => {
    setIsNavMouseDown(false);
  };

  const handleNavMouseUp = () => {
    setIsNavMouseDown(false);
  };

  const handleNavMouseMove = (e: React.MouseEvent) => {
    if (!isNavMouseDown || !mainNavRef.current) return;
    e.preventDefault();
    const x = e.pageX - mainNavRef.current.offsetLeft;
    const walk = (x - navStartX) * 1.5;
    if (Math.abs(walk) > 5) {
      setHasNavDragged(true);
    }
    mainNavRef.current.scrollLeft = navScrollLeft - walk;
  };

  const handleNavWheel = (e: React.WheelEvent) => {
    if (!mainNavRef.current) return;
    if (e.deltaY !== 0) {
      mainNavRef.current.scrollLeft += e.deltaY;
    }
  };

  const scrollNav = (direction: 'left' | 'right') => {
    if (!mainNavRef.current) return;
    const scrollAmount = direction === 'left' ? -200 : 200;
    mainNavRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
  };



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

      // 종목분석 초기화면은 항상 비워져 있도록 이전 슬롯 기록을 불러오지 않습니다.

      // AIInsight toast 클릭 시 종목분석>즐겨찾기로 이동
      const handleNavToFav = () => {
        setActiveTab('select');
        setIsFavModalOpen(true);
      };
      window.addEventListener('navigate_to_favorites', handleNavToFav);
      return () => window.removeEventListener('navigate_to_favorites', handleNavToFav);
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

    fetch(`${API_BASE}/api/v1/analyze/etfs?t=${Date.now()}`)
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

  const handleOpenDetail = async (code: string) => {
    // Try find locally first to avoid unnecessary fetch if we already have it in main analysis data
    if (data?.raw_data) {
      const etf = data.raw_data.find((e: any) => e.etf_code === code || e.ticker === code);
      if (etf) {
        setPopupData(null);
        setSelectedDetailEtf(etf);
        return;
      }
    }

    // Fetch from backend specifically for this code
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/analyze/compare`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ etf_codes: [code], skip_holdings: false, skip_chart: false }),
      });
      const result = await res.json();
      setPopupData(result);
      if (result?.raw_data && result.raw_data.length > 0) {
        setSelectedDetailEtf(result.raw_data[0]);
      } else {
        alert(`종목 정보를 찾을 수 없습니다. (${code})`);
      }
    } catch (e) {
      console.error(e);
      alert(`종목 데이터를 불러오는데 실패했습니다. (${code})`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      const handleOpenEtfDetailEvent = (e: Event) => {
        const customEvent = e as CustomEvent<{ code: string }>;
        if (customEvent.detail?.code) {
          handleOpenDetail(customEvent.detail.code);
        }
      };
      window.addEventListener('open_etf_detail', handleOpenEtfDetailEvent);
      return () => window.removeEventListener('open_etf_detail', handleOpenEtfDetailEvent);
    }
  }, [handleOpenDetail]);

  const handleAnalyzePeers = (items: {code: string, name: string}[]) => {
    const toAnalyze = items.slice(0, 10);
    const newSlots = Array(10).fill(null).map((_, idx) => {
      return toAnalyze[idx] ? { search: toAnalyze[idx].name, code: toAnalyze[idx].code } : { search: "", code: "" };
    });
    setSlots(newSlots);
    fetchComparison(newSlots);
  };

  const fetchComparison = async (overrideSlots?: {search: string, code: string}[]) => {
    // If it's a DOM event (has type property from React synthetic event), ignore it
    const activeSlots = (overrideSlots && !Array.isArray(overrideSlots)) ? slots : (overrideSlots || slots);
    const validCodes = activeSlots.map(s => s.code || s.search).filter(Boolean);
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
      window.scrollTo({ top: 0, behavior: 'smooth' });
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

  // 여러 종목 일괄 추가 (한 번의 saveFavorites → stale closure 없음)
  const addFavItems = (groupId: string, items: { code: string, name: string }[]) => {
    saveFavorites(favorites.map(g => {
      if (g.id === groupId) {
        let newItems = [...g.items];
        for (const { code, name } of items) {
          if (newItems.length >= 10) break;
          if (!newItems.some(i => i.code === code)) {
            newItems.push({ code, name });
          }
        }
        return { ...g, items: newItems };
      }
      return g;
    }));
  };

  // 이름+종목을 한번에 새 그룹으로 저장 (마켓 다운로드용, stale closure 방지)
  const addGroupWithItems = (groupName: string, items: { code: string; name: string }[]) => {
    const limitedItems = items.slice(0, 10);
    // localStorage에서 최신 상태를 직접 읽어 stale closure 방지
    let currentFavs: FavGroup[] = favorites;
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('etf_favorites');
        if (raw) currentFavs = JSON.parse(raw);
      } catch (_) {}
    }
    const existing = currentFavs.find(g => g.name === groupName);
    if (existing) {
      // 동일 이름 그룹 존재 → 덮어쓰기
      saveFavorites(currentFavs.map(g => g.name === groupName ? { ...g, items: limitedItems } : g));
    } else {
      // 새 그룹 생성
      const newGroup = { id: Date.now().toString(), name: groupName, items: limitedItems };
      saveFavorites([...currentFavs, newGroup]);
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handleTffFavAdd = (e: any) => {
        const { groupName, items } = e.detail;
        addGroupWithItems(groupName, items);
        setActiveTab('select');
        setIsFavModalOpen(true);
      };
      window.addEventListener('add_tff_group_to_favorites', handleTffFavAdd);
      return () => {
        window.removeEventListener('add_tff_group_to_favorites', handleTffFavAdd);
      };
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

    // ── 프론트엔드 Forward-fill ──────────────────────────────────────────
    // 백엔드 forward-fill의 이중 보장: _raw가 null인 날짜를 직전 유효값으로 채움
    // (예: 3/23에 일부 ETF 데이터 누락 시 3/20 종가로 보간하여 범례에 항상 표시)
    if (period !== '1D') {
      const allKeys2 = [...keys, ...benchKeys];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const prevRawMap: Record<string, number> = {};
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      baseMappedData = baseMappedData.map((pt: any) => {
        const filled = { ...pt };
        allKeys2.forEach((key: string) => {
          const rawKey = `${key}_raw`;
          if (filled[rawKey] != null && filled[rawKey] > 0) {
            prevRawMap[key] = filled[rawKey];
          } else if (prevRawMap[key] != null) {
            // 직전 유효값으로 채우기
            filled[rawKey] = prevRawMap[key];
            if (basePrices[key] && prevRawMap[key]) {
              filled[key] = Number(((prevRawMap[key] / basePrices[key] - 1) * 100).toFixed(2));
            }
          }
        });
        return filled;
      });
    }

    // 1D (5분 단위 정보 시뮬레이션)
    if (period === '1D' && baseMappedData.length > 0) {
      const now = new Date();
      const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
      const kst = new Date(utc + (3600000 * 9));
      const day = kst.getDay();
      const hours = kst.getHours();
      const minutes = kst.getMinutes();
      const timeInMinutes = hours * 60 + minutes;
      const isMarketClosed = (day === 0 || day === 6 || timeInMinutes < 540 || timeInMinutes > 930);

      if (isMarketClosed) {
        baseMappedData = [];
      } else {
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
      // 실제 TTM 배당률을 시드값으로 사용 (없으면 랜덤)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const matchedEtf = data?.raw_data?.find((e: any) => e.etf_name === k);
      const divRaw = matchedEtf?.basic_info?.['최근 분배율(TTM)'] || '0.0%';
      const realDiv = parseFloat(divRaw.replace(/[^0-9.]/g, '')) || Math.max(0.5, 2.5 + (Math.random() - 0.5) * 2);

      currentSimState[k] = {
        inflow: (idx + 1) * 200, // Starting simulated inflow
        dividend: realDiv        // 실제 TTM 배당률 기반 시드
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
    if (!selectedDetailEtf) return { nav: [], vol: [], price: [], benchmarkName: 'KOSPI', domainLeft: ['auto', 'auto'] };
    const navData: any[] = [];
    const volData: any[] = [];
    const priceData: any[] = [];

    // 1. Price Data (1 year from raw chart data if available)
    const sourceData = popupData || data;
    const rawChart = sourceData?.visual_data?.line_chart || [];
    const etfKey = selectedDetailEtf.etf_name;
    const isKosdaq = etfKey.toUpperCase().includes('코스닥') || etfKey.toUpperCase().includes('KOSDAQ');
    const isNasdaq = etfKey.toUpperCase().includes('나스닥') || etfKey.toUpperCase().includes('NASDAQ');
    const isSP500 = etfKey.toUpperCase().includes('S&P') || etfKey.toUpperCase().includes('S&P500') || (etfKey.includes('배당') && etfKey.includes('미국'));
    const isUS = etfKey.includes('미국') || isNasdaq || isSP500;

    const INDIVIDUAL_STOCKS = ['RKLB', 'SATS', 'ASTS', 'LUNR', 'RDW', 'PL', 'LHX', 'AMD', 'TER', 'BA', 'GSAT', 'KTOS', 'DE', 'ACHR', 'MDALF'];
    const isStock = INDIVIDUAL_STOCKS.includes(selectedDetailEtf.etf_code?.toUpperCase()) || (selectedDetailEtf.basic_info?.['운용사'] === '-' && selectedDetailEtf.etf_code !== 'ARKX');

    const isKoreanStock = /^\d{6}$/.test(selectedDetailEtf.etf_code);
    const kosdaqStocks = ['196170', '141080', '028300', '000250', '068760', '064550', '237690', '358570', '086520', '298380'];
    const isKosdaqStock = isKoreanStock && kosdaqStocks.includes(selectedDetailEtf.etf_code);

    let benchmarkName = 'KOSPI';
    let benchKey = 'KOSPI';

    if (isKosdaqStock) {
      benchmarkName = 'KOSDAQ';
      benchKey = 'KOSDAQ';
    } else if (isKoreanStock) {
      benchmarkName = 'KOSPI';
      benchKey = 'KOSPI';
    } else if (isStock) {
      benchmarkName = 'NASDAQ';
      benchKey = 'NASDAQ';
    } else if (isNasdaq) {
      benchmarkName = 'NASDAQ';
      benchKey = 'NASDAQ';
    } else if (isSP500 || isUS) {
      benchmarkName = 'S&P500';
      benchKey = 'SP500';
    } else if (isKosdaq) {
      benchmarkName = 'KOSDAQ';
      benchKey = 'KOSDAQ';
    }

    let domainLeft = ['auto', 'auto'];

    if (rawChart.length > 0) {
      // Calendar-based slicing: filter precisely by date instead of index slicing
      const lastDateStr = rawChart[rawChart.length - 1]?.date;
      let oneYearGlimpse = rawChart;
      
      if (lastDateStr) {
        const lastDateObj = new Date(lastDateStr);
        const startDateObj = new Date(lastDateStr);
        
        switch (popupPeriod) {
          case '1M': startDateObj.setMonth(lastDateObj.getMonth() - 1); break;
          case '3M': startDateObj.setMonth(lastDateObj.getMonth() - 3); break;
          case '6M': startDateObj.setMonth(lastDateObj.getMonth() - 6); break;
          case '1Y': startDateObj.setFullYear(lastDateObj.getFullYear() - 1); break;
          default: startDateObj.setFullYear(lastDateObj.getFullYear() - 1); break;
        }
        
        oneYearGlimpse = rawChart.filter((d: any) => new Date(d.date) >= startDateObj);
        
        // Fail-safe: if filtering returns nothing, default to the last 252 points
        if (oneYearGlimpse.length === 0) {
          oneYearGlimpse = rawChart.slice(Math.max(rawChart.length - 252, 0));
        }
      } else {
        oneYearGlimpse = rawChart.slice(Math.max(rawChart.length - 252, 0));
      }

      // Pre-process: build a clean dataset with robust forward-fill & backward-fill
      const cleanChart = oneYearGlimpse.map((d: any) => ({
        date: d.date,
        price: d[etfKey] || d[`${etfKey}_raw`] || 0,
        bench: d[benchKey] || 0,
        space: d["US-Space (ARKX)"] || 0
      }));

      // A. Forward fill
      let lastPrice = 0;
      let lastBench = 0;
      let lastSpace = 0;
      for (let i = 0; i < cleanChart.length; i++) {
        if (cleanChart[i].price > 0) lastPrice = cleanChart[i].price;
        else cleanChart[i].price = lastPrice;

        if (cleanChart[i].bench > 0) lastBench = cleanChart[i].bench;
        else cleanChart[i].bench = lastBench;

        if (cleanChart[i].space > 0) lastSpace = cleanChart[i].space;
        else cleanChart[i].space = lastSpace;
      }

      // B. Backward fill
      let nextPrice = lastPrice;
      let nextBench = lastBench;
      let nextSpace = lastSpace;
      for (let i = cleanChart.length - 1; i >= 0; i--) {
        if (cleanChart[i].price > 0) nextPrice = cleanChart[i].price;
        else cleanChart[i].price = nextPrice;

        if (cleanChart[i].bench > 0) nextBench = cleanChart[i].bench;
        else cleanChart[i].bench = nextBench;

        if (cleanChart[i].space > 0) nextSpace = cleanChart[i].space;
        else cleanChart[i].space = nextSpace;
      }

      // C. Base values (idx = 0)
      const basePrice = cleanChart[0]?.price || 0;
      const baseBench = cleanChart[0]?.bench || 0;
      const baseSpace = cleanChart[0]?.space || 0;

      let minYield = 0;
      let maxYield = 0;

      cleanChart.forEach((d: any) => {
        const stockYield = basePrice > 0 ? ((d.price / basePrice) - 1) * 100 : 0;
        const benchYield = baseBench > 0 ? ((d.bench / baseBench) - 1) * 100 : 0;
        const spaceYield = baseSpace > 0 ? ((d.space / baseSpace) - 1) * 100 : 0;

        if (stockYield < minYield) minYield = stockYield;
        if (stockYield > maxYield) maxYield = stockYield;
        if (benchYield < minYield) minYield = benchYield;
        if (benchYield > maxYield) maxYield = benchYield;
        if (isStock && spaceYield !== 0) {
          if (spaceYield < minYield) minYield = spaceYield;
          if (spaceYield > maxYield) maxYield = spaceYield;
        }

        priceData.push({
          date: d.date,
          day: d.date.substring(2).replace(/-/g, '/'),
          price: d.price,
          stock_yield: Number(stockYield.toFixed(2)),
          rel_yield: Number(benchYield.toFixed(2)),
          space_yield: Number(spaceYield.toFixed(2))
        });
      });

      const pad = (maxYield - minYield) * 0.1 || 5;
      domainLeft = [Math.floor(minYield - pad), Math.ceil(maxYield + pad)] as any;

      // 2. NAV & Price (recent ~22 trading days from the real data end)
      const recentMonth = oneYearGlimpse.slice(Math.max(oneYearGlimpse.length - 22, 0));
      const hist = selectedDetailEtf.historical_data || {};
      const histDates: string[] = hist.dates || [];
      const histNavs: number[] = hist.navs || [];
      const histDisparityRates: number[] = hist.disparity_rates || [];

      recentMonth.forEach((d: any) => {
        const price = d[etfKey] || d[`${etfKey}_raw`] || 0;
        if (price > 0) {
          const idx = histDates.indexOf(d.date);
          let nav = price;
          let diff = 0;
          if (idx !== -1) {
            nav = histNavs[idx] !== undefined && histNavs[idx] !== null ? histNavs[idx] : price;
            diff = histDisparityRates[idx] !== undefined && histDisparityRates[idx] !== null ? histDisparityRates[idx] : 0;
          }
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

    return { nav: navData, vol: volData, price: priceData, benchmarkName, domainLeft };
  }, [selectedDetailEtf, data, popupData, popupPeriod]);

  // Sync selectedDetailEtf when holdings data arrives
  useEffect(() => {
    if (selectedDetailEtf) {
      const sourceData = popupData || data;
      if (sourceData?.raw_data) {
        const freshData = sourceData.raw_data.find((e: any) => e.etf_code === selectedDetailEtf.etf_code);
        if (freshData && freshData.holdings !== selectedDetailEtf.holdings) {
          setSelectedDetailEtf(freshData);
        }
      }
    }
  }, [data, popupData, selectedDetailEtf]);

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

      <header className="w-full max-w-[95vw] xl:max-w-[1400px] mb-2 md:mb-4 flex flex-col md:flex-row justify-between items-stretch md:items-center gap-2.5 md:gap-3 relative z-50">
        {/* 상단 행: 로고 (좌측) & 버전/상태/툴버튼 (우측) */}
        <div className="flex items-center justify-between gap-2 shrink-0">
          {/* 좌측 로고 */}
          <div className="flex flex-col items-start cursor-pointer group shrink-0" onClick={handleReset}>
            <h1 className="text-xl sm:text-2xl md:text-4xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 drop-shadow-sm flex items-center gap-1.5 sm:gap-2 group-hover:opacity-80 transition-opacity">
              <Aperture className="w-6 h-6 md:w-10 md:h-10 text-indigo-400 group-hover:rotate-180 transition-transform duration-700" />
              ETF Lens
            </h1>
          </div>

          {/* 우측 툴버튼 + 버전/연동 상태 정보 */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* 버전 및 연동 상태 정보 (메뉴바 오른쪽/우측 영역 배치) */}
            <div className="hidden sm:flex flex-col gap-0.5 items-end shrink-0">
              <span className={`text-[10px] sm:text-[11px] font-mono font-medium px-2 py-0.5 rounded-md uppercase tracking-widest whitespace-nowrap ${dbVersion === 'VER --'
                ? "text-rose-400 bg-rose-400/10 border border-rose-400/20 shadow-[0_0_10px_rgba(244,63,94,0.15)] animate-pulse"
                : "text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 shadow-[0_0_10px_rgba(52,211,153,0.15)]"
                }`}>
                {dbVersion}
              </span>
              {healthStatus === 'pending' && (
                <span className="text-[10px] sm:text-[11px] font-bold px-2 py-0.5 rounded-md whitespace-nowrap text-gray-400 bg-gray-400/10 border border-gray-400/20 animate-pulse flex items-center gap-1">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-gray-400 animate-ping" />
                  외부연동 체크중...
                </span>
              )}
              {healthStatus === 'ok' && (
                <span className="text-[10px] sm:text-[11px] font-bold px-2 py-0.5 rounded-md whitespace-nowrap text-sky-400 bg-sky-400/10 border border-sky-400/20 animate-pulse shadow-[0_0_10px_rgba(56,189,248,0.2)]">
                  모든 연동기능이 정상작동중 입니다.
                </span>
              )}
              {healthStatus === 'error' && (
                <span className="text-[10px] sm:text-[11px] font-bold px-2 py-0.5 rounded-md whitespace-nowrap text-rose-500 bg-rose-500/10 border border-rose-500/20 shadow-[0_0_10px_rgba(244,63,94,0.15)] flex items-center gap-1">
                  <AlertCircle size={12} /> {failedServices.length > 0 ? `${failedServices.join(', ')} 오류 체크바람` : '현재 연동에 문제가 있습니다. 체크바람'}
                </span>
              )}
            </div>

            {/* 전체화면 확대 버튼 */}
            <button
              onClick={toggleFullscreen}
              title={isFullscreen ? "화면 복원" : "전체 화면 확대"}
              className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 hover:text-indigo-100 text-xs sm:text-sm font-bold transition-all shadow-sm shrink-0 backdrop-blur-md active:scale-95 cursor-pointer"
            >
              {isFullscreen ? <Minimize2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-400" /> : <Maximize2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-400" />}
              <span>{isFullscreen ? "복원" : "전체화면"}</span>
            </button>

            {/* AI Assistant 버튼 */}
            <ChatBot renderTrigger isOpen={isChatOpen} setIsOpen={setIsChatOpen} />
          </div>
        </div>

        {/* 가로 스크롤 & PC 마우스 드래그/화살표 스크롤 메인 메뉴바 */}
        <div className="relative flex items-center w-full md:w-auto overflow-hidden rounded-full bg-white/[0.03] border border-white/10 backdrop-blur-md shadow-sm group">
          {/* 좌측 스크롤 화살표 버튼 */}
          <button
            onClick={() => scrollNav('left')}
            className="flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-black/60 hover:bg-indigo-600 text-gray-300 hover:text-white transition-all shrink-0 ml-1 shadow-md border border-white/10 active:scale-95 cursor-pointer z-10"
            title="왼쪽 스크롤"
          >
            <ChevronLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>

          <nav
            ref={mainNavRef}
            onMouseDown={handleNavMouseDown}
            onMouseLeave={handleNavMouseLeave}
            onMouseUp={handleNavMouseUp}
            onMouseMove={handleNavMouseMove}
            onWheel={handleNavWheel}
            className={`flex items-center gap-1 sm:gap-1.5 md:gap-2 px-1.5 sm:px-2.5 py-1 sm:py-1.5 overflow-x-auto scrollbar-hide whitespace-nowrap touch-pan-x min-w-0 max-w-full select-none ${
              isNavMouseDown ? 'cursor-grabbing' : 'cursor-grab'
            }`}
          >
            {[
              { id: 'analysis', label: '종목분석' },
              { id: 'sector', label: '섹터분석' },
              { id: 'discover', label: '시장동향' },
              ...(showTffTab ? [{ id: 'tff', label: 'TFF_Fund' }] : []),
              ...(showMyTab ? [{ id: 'my', label: 'My' }] : []),
              { id: 'etftracker', label: 'ETF추적기', isExternal: true },
              { id: 'etfcheck', label: 'ETF Check', isExternal: true },
            ].map(tab => {
              const isAnalysisActive = ['select', 'info', 'chart', 'holdings', 'covered_call', 'brazil'].includes(activeTab);
              const isActive = (tab.id === 'etfcheck' && isEtfCheckModalOpen) ||
                (tab.id === 'analysis' && isAnalysisActive && !isEtfCheckModalOpen) ||
                (activeTab === tab.id && !isEtfCheckModalOpen);
              return (
                <React.Fragment key={tab.id}>
                  {tab.id === 'etftracker' && (
                    <div className="h-3.5 w-[1px] bg-white/20 mx-0.5 shrink-0 self-center" />
                  )}
                  <button
                    onClick={(e) => {
                      if (hasNavDragged) {
                        e.preventDefault();
                        return;
                      }
                      if (tab.id === 'etfcheck') {
                        setIsEtfCheckModalOpen(true);
                        setHasOpenedEtfCheck(true);
                        return;
                      }
                      if (tab.id === 'etftracker') {
                        window.open('https://ystreet.co.kr/etf-tracker/', '_blank', 'noopener,noreferrer');
                        return;
                      }
                      if (tab.id === 'my') {
                        setActiveTab('my');
                        return;
                      }
                      if (tab.id === 'tff') {
                        setActiveTab('tff');
                        return;
                      }

                      if (tab.id === 'analysis') {
                        clearAllSlots();
                        setIsEtfCheckModalOpen(false);
                        return;
                      }
                      setActiveTab(tab.id as 'select' | 'info' | 'holdings' | 'chart' | 'discover' | 'covered_call' | 'my' | 'tff' | 'sector' | 'brazil');
                      setIsEtfCheckModalOpen(false);
                      setNaverEtfCode(null);
                      setSelectedDetailEtf(null);
                    }}
                    className={`text-xs sm:text-sm md:text-[14px] lg:text-[15px] tracking-wide font-bold transition-all px-2.5 sm:px-3 md:px-3.5 py-1 sm:py-1 rounded-full whitespace-nowrap shrink-0 cursor-pointer ${
                      isActive
                        ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-[0_0_15px_rgba(99,102,241,0.5)]'
                        : tab.isExternal
                        ? 'text-gray-400/70 hover:text-gray-200 hover:bg-white/5 border border-white/5'
                        : 'text-gray-400/80 hover:text-gray-100 hover:bg-white/5'
                    }`}
                  >
                    {tab.label}
                  </button>
                </React.Fragment>
              )
            })}
          </nav>

          {/* 우측 스크롤 화살표 버튼 */}
          <button
            onClick={() => scrollNav('right')}
            className="flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-black/60 hover:bg-indigo-600 text-gray-300 hover:text-white transition-all shrink-0 mr-1 shadow-md border border-white/10 active:scale-95 cursor-pointer z-10"
            title="오른쪽 스크롤"
          >
            <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
        </div>
      </header>

      {/* 서브탭: 종목분석 탭 선택시만 헤더 아래에 표시 */}
      {['select', 'info', 'chart', 'holdings', 'covered_call', 'brazil'].includes(activeTab) && !isEtfCheckModalOpen && (
        <div className="w-full max-w-[95vw] xl:max-w-[1400px] flex justify-center mb-2 relative z-50">
          {/* 모바일: 수평 스크롤 가능한 서브탭 */}
          <nav className="flex items-center gap-2 md:gap-4 bg-black/40 px-4 py-1.5 rounded-full border border-white/10 shadow-sm backdrop-blur-md overflow-x-auto scrollbar-hide">
            {[
              { id: 'select', label: '종목선택' },
              { id: 'info', label: '기본정보' },
              { id: 'chart', label: '차트' },
              { id: 'holdings', label: '구성종목' },
              { id: 'covered_call', label: '커버드콜' },
              { id: 'brazil', label: '🇧🇷 브라질채권' },
            ].map(subTab => (
              <button
                key={subTab.id}
                onClick={() => {
                  // 브라질채권은 종목 선택 없이 독립 진입 가능 (매크로 분석 뷰)
                  if (subTab.id !== 'select' && subTab.id !== 'brazil' && !data) {
                    alert('먼저 종목을 선택하고 비교를 실행해주세요.');
                    return;
                  }
                  setActiveTab(subTab.id as 'select' | 'info' | 'holdings' | 'chart' | 'discover' | 'covered_call' | 'brazil');
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

      {/* ChatBot 채팅창 — fixed overlay (스크롤 없이 현재 뷰 위에 표시) */}
      <ChatBot renderChat isOpen={isChatOpen} setIsOpen={setIsChatOpen} />

      <div className="relative flex-1 flex flex-col w-full max-w-[95vw] xl:max-w-[1400px] mobile-content-area">

        {activeTab === 'select' && (
          <div className="flex-1 flex flex-col items-center justify-start pt-4 w-full relative z-10 min-h-0 animate-in fade-in zoom-in-95 duration-500">
            <div className="text-center mb-4">
              <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight mb-4 text-white drop-shadow-md">데이터 기반의 ETF 투자</h2>
              <p className="text-gray-400 text-sm md:text-base">최대 10개의 ETF를 선택하여 다각도로 성과와 포트폴리오를 비교 분석합니다.</p>
            </div>
            <section className="w-full max-w-[95vw] xl:max-w-[1400px] bg-white/[0.03] backdrop-blur-3xl rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.6)] px-5 py-6 md:px-8 md:py-8 border border-white/10 transition-all hover:border-white/20 duration-500">
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
                      onClick={() => fetchComparison()}
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
          activeTab === 'covered_call' && (
            <div className="w-full max-w-[95vw] xl:max-w-[1400px] flex flex-col relative z-10 animate-in fade-in slide-in-from-bottom-5 duration-700">
              <CoveredCallTab
                initialEtfs={data?.raw_data?.filter((etf: any) =>
                  etf.etf_name?.includes('커버드콜')
                ) || []}
                setSelectedDetailEtf={setSelectedDetailEtf}
                rawData={data?.raw_data || []}
              />
            </div>
          )
        }

        {
          activeTab === 'brazil' && (
            <div className="w-full max-w-[95vw] xl:max-w-[1400px] flex flex-col relative z-10 animate-in fade-in slide-in-from-bottom-5 duration-700">
              <BrazilBondTab />
            </div>
          )
        }

        {
          data && data.data_payload && activeTab !== 'select' && activeTab !== 'covered_call' && activeTab !== 'brazil' && (
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
                                <MarqueeText
                                  text={etf.etf_name}
                                  className="group-hover:underline group-hover:text-indigo-300 transition-colors flex-1 min-w-0"
                                />
                                <span className="text-[10px] sm:text-xs font-medium text-gray-400 bg-black/40 px-2 flex-shrink-0 py-0.5 rounded-full border border-white/5">TOP 50</span>
                              </h3>

                              {etf.holdings && etf.holdings.length > 0 ? (
                                <div className="space-y-3 flex-1 pr-1 overflow-y-auto max-h-[600px] scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                                  {etf.holdings.map((h: any, hIdx: number) => (
                                    <div key={h.ticker} className="flex flex-col gap-1 group">
                                      <div className="flex justify-between items-end text-[11px] sm:text-xs xl:text-[13px] mb-0.5">
                                        <span className="font-medium text-gray-200 group-hover:text-white transition-colors max-w-[75%] flex items-center min-w-0">
                                          <span className="text-gray-500 w-4 inline-block text-[10px] sm:text-[11px] flex-shrink-0">{hIdx + 1}.</span>
                                          <MarqueeText text={h.ticker} className="ml-1 flex-1 min-w-0" />
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

        {/* My Assets Section (유지) */}
        <div style={{ display: activeTab === 'my' ? 'block' : 'none' }}>
          <MyAssetsView onOpenDetail={handleOpenDetail} onAnalyzePeers={handleAnalyzePeers} />
        </div>

        {/* TFF Fund Section */}
        <div style={{ display: activeTab === 'tff' ? 'block' : 'none', width: '100%' }}>
          {activeTab === 'tff' && <TffGateWrapper onOpenDetail={handleOpenDetail} />}
        </div>

        {/* Discover Section */}
        {activeTab === 'sector' && (
          <SectorAnalysisTab onOpenDetail={handleOpenDetail} />
        )}

        {activeTab === 'discover' && (
          <DiscoverTab />
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
          addFavItems={addFavItems}
          addGroupWithItems={addGroupWithItems}
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


      {/* Copyright */}
      <div className="flex mt-auto w-full text-center text-xs sm:text-sm text-gray-500/80 font-medium items-center justify-center gap-3 py-3">
        <span>Copyright &copy; Hoya 2026</span>
        <span className="text-[10px] text-gray-500 font-medium tracking-wider border-l border-white/10 pl-3">v.20260531_2310</span>
      </div>

      {/* Global Loading Overlay */}
      {loading && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm">
          <Loader2 className="w-12 h-12 text-indigo-500 animate-spin mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">지표 및 분석 정보를 불러오고 있습니다</h2>
          <p className="text-gray-400 text-sm">잠시만 기다려주세요...</p>
        </div>
      )}
    </main>
  );
}
