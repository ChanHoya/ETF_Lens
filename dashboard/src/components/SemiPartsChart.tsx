"use client";

import React, { useState, useEffect } from 'react';
import { Activity, ArrowUpRight, TrendingUp, BookOpen, PieChart, Cpu, GitBranch, ArrowRight, Target } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ScatterChart, Scatter, ReferenceLine, ZAxis } from 'recharts';
import { API_BASE } from '../lib/apiConfig';
import ChartLoadingPlaceholder from './ChartLoadingPlaceholder';
import SectorInsightReport, { InsightContent } from './SectorInsightReport';

interface SemiPartsChartProps {
    onOpenDetail?: (code: string) => void;
}

const constituentTickerMap: { [key: string]: string } = {
    // 국내 소부장/밸류체인
    "삼성전자": "005930",
    "SK하이닉스": "000660",
    "한미반도체": "042700",
    "리노공업": "058470",
    "HPSP": "403870",
    "이오테크닉스": "039030",
    "하나마이크론": "067310",
    "동진쎄미켐": "005290",
    "솔브레인": "357780",
    "원익IPS": "240810",
    "주성엔지니어링": "036930",
    "DB하이텍": "000990",
    "ISC": "095340",
    "피에스케이홀딩스": "002920",
    "테스": "095610",
    "에스티아이": "039440",
    "SNS텍": "101490",
    "유진테크": "084370",
    "피에스케이": "319660",
    "케이씨텍": "281820",
    "파크시스템스": "140860",
    "이수페타시스": "007660",
    "대덕전자": "008060",
    "심텍": "222800",
    // 일본 소부장
    "Tokyo Electron": "8035.T",
    "Advantest": "6857.T",
    "Disco": "6146.T",
    "Screen Holdings": "7735.T",
    "Lasertec": "6920.T",
    "Shin-Etsu Chemical": "4063.T",
    "SUMCO": "3436.T",
    "Tokyo Seimitsu": "7729.T",
    "Murata": "6981.T",
    "Renesas": "6723.T",
    // 글로벌
    "ASML": "ASML",
    "TSMC": "TSM",
    "NVIDIA": "NVDA",
    "Broadcom": "AVGO",
    "AMD": "AMD",
    "Qualcomm": "QCOM",
    "Micron": "MU",
    "Applied Materials": "AMAT",
    "Lam Research": "LRCX",
    "KLA Corp": "KLAC",
    "Texas Instruments": "TXN",
    "Intel": "INTC",
};

const getTickerFromConstituent = (name: string): string => {
    return constituentTickerMap[name] ?? name.trim();
};

const formatConstituentPrice = (name: string, price: number): string => {
    const ticker = constituentTickerMap[name] || '';
    if (/^\d+$/.test(ticker)) return `${new Intl.NumberFormat('ko-KR').format(Math.floor(price))}원`;
    if (ticker.endsWith('.T')) return `¥${new Intl.NumberFormat('ja-JP').format(Math.floor(price))}`;
    return `$${price.toFixed(2)}`;
};

const etfNameToCodeMap: { [key: string]: string } = {
    "TIGER AI반도체핵심공정": "471760",
    "KODEX AI반도체핵심장비": "471990",
    "SOL AI반도체소부장": "455850",
    "WON 반도체밸류체인액티브": "474590",
    "PLUS 일본반도체소부장": "464920",
    "ACE 글로벌반도체TOP4 Plus": "446770",
    "SOXX": "SOXX",
    "XSD": "XSD",
};

const checkIsUsMarketOpenClient = (): boolean => {
    try {
        const parts = new Intl.DateTimeFormat('en-US', {
            timeZone: 'America/New_York', hour12: false, weekday: 'short', hour: '2-digit', minute: '2-digit'
        }).formatToParts(new Date());
        let weekday = ''; let hour = 0; let minute = 0;
        for (const part of parts) {
            if (part.type === 'weekday') weekday = part.value;
            if (part.type === 'hour') hour = parseInt(part.value, 10);
            if (part.type === 'minute') minute = parseInt(part.value, 10);
        }
        if (weekday === 'Sat' || weekday === 'Sun') return false;
        const m = hour * 60 + minute;
        return m >= 9 * 60 + 30 && m <= 16 * 60;
    } catch {
        return false;
    }
};

const isBeforeKrMarketOpen = (): boolean => {
    try {
        const parts = new Intl.DateTimeFormat('en-US', {
            timeZone: 'Asia/Seoul', hour12: false, weekday: 'short', hour: '2-digit', minute: '2-digit'
        }).formatToParts(new Date());
        let weekday = ''; let hour = 0; let minute = 0;
        for (const part of parts) {
            if (part.type === 'weekday') weekday = part.value;
            if (part.type === 'hour') hour = parseInt(part.value, 10);
            if (part.type === 'minute') minute = parseInt(part.value, 10);
        }
        if (weekday === 'Sat' || weekday === 'Sun') return true;
        return hour * 60 + minute < 540; // Before 09:00 KST
    } catch {
        return false;
    }
};

const SEMIPARTS_INSIGHT_FALLBACK: InsightContent = {
    tab1: { cards: [
        { title: `HBM·어드밴스드 패키징 장비 수요`, body: `HBM3e/HBM4 적층(TC본더)과 TSMC CoWoS 등 후공정 패키징 투자가 폭증하면서, 한미반도체·이오테크닉스 등 국내 후공정 장비주가 소부장 사이클의 직접 수혜를 받고 있습니다. 장비는 전공정→후공정으로 투자 무게중심이 이동 중입니다.` },
        { title: `WFE 과점 & 국산화 모멘텀`, body: `ASML(EUV)·도쿄일렉트론·어플라이드 등 글로벌 전공정 장비(WFE)는 소수 기업의 강력한 과점 구조입니다. 동시에 미·중 규제와 공급망 재편으로 HPSP(고압수소어닐링) 등 독점 해자를 가진 국내 장비·소재 기업의 국산화 모멘텀이 부각됩니다.` },
        { title: `높은 베타 & 사이클 변동성`, body: `소부장은 메모리/파운드리 고객사의 CAPEX에 후행하는 높은 베타 섹터입니다. 수주 모멘텀 구간에서 시장 대비 초과수익이 크지만, CAPEX 둔화기에는 낙폭도 깊어 분할 매수와 채권 안전판을 통한 변동성 관리가 핵심입니다.` },
    ] },
    etfs: {
        domestic: { items: [
            { name: `TIGER AI반도체핵심공정 (471760):`, desc: `한미반도체·HPSP·주성엔지니어링 등 전·후공정 핵심 장비주에 집중한 순수 소부장 장비 포트폴리오입니다.` },
            { name: `KODEX AI반도체핵심장비 (471990):`, desc: `한미반도체 비중을 높게 가져가는 후공정 장비 중심 상품으로, HBM 패키징 수혜를 압축적으로 담았습니다.` },
            { name: `SOL AI반도체소부장 (455850):`, desc: `장비뿐 아니라 솔브레인·동진쎄미켐 등 소재까지 폭넓게 편입해 소부장 전체 밸류체인에 분산 투자합니다.` },
            { name: `WON 반도체밸류체인액티브 (474590):`, desc: `삼성전자·SK하이닉스 등 대형 IDM부터 소부장까지 묶은 액티브 밸류체인 상품으로, 변동성을 다소 낮춘 코어형입니다.` },
        ] },
        overseas: { items: [
            { name: `PLUS 일본반도체소부장 (464920 | 국내상장 해외주식):`, desc: `도쿄일렉트론·어드반테스트·디스코·신에쓰화학 등 글로벌 장비·소재 1위 일본 기업에 투자하는 정통 해외 소부장 ETF입니다.` },
            { name: `ACE 글로벌반도체TOP4 Plus (446770 | 국내상장 해외주식):`, desc: `TSMC·NVIDIA·ASML·삼성전자 등 글로벌 핵심 4사를 묶어 장비(ASML)와 파운드리/설계까지 폭넓게 커버합니다.` },
            { name: `SOXX (iShares Semiconductor):`, desc: `엔비디아·브로드컴·AMAT·램리서치 등 미국 상장 반도체 30종에 분산하는 대표 ETF로, WFE 장비주 비중이 높습니다.` },
            { name: `XSD (SPDR S&P Semiconductor, 동일가중):`, desc: `동일가중 방식으로 대형주 쏠림을 줄여 중소형 장비·소재주 노출을 키운, 소부장 베타가 높은 상품입니다.` },
        ] },
    },
    strategy: {
        models: { items: [
            { name: `성장추구형 (주70:채30):`, detail: `국내 소부장(TIGER/KODEX 핵심장비) 35% + SOXX 20% + 일본소부장 15% | 미국 장기채 20% + 회사채 10%` },
            { name: `중립코어형 (주60:채40):`, detail: `WON 밸류체인 20% + ACE 글로벌TOP4 20% + SOXX 20% | 미국 중기채 25% + 은행채 15%` },
            { name: `분산안정형 (주50:채50):`, detail: `SOL 소부장 20% + 일본소부장 15% + XSD 15% | 미국 만기매칭채 30% + 커버드콜 20%` },
        ] },
        guides: { items: [
            { name: `기본적 매수 타점:`, body: `고객사(메모리/파운드리) CAPEX 가이던스 상향 + 장비주 수주잔고 증가 확인 구간. 12M Forward P/E가 과거 밴드 하단(소부장 평균 20배대) 부근일 때 분할 진입.` },
            { name: `기술적 분할 타점:`, body: `주가가 50일/200일 SMA 지지선으로 조정되고 RSI-14가 40 이하로 냉각될 때 분할 매수. 200일 SMA 대비 +30% 이상 괴리되거나 RSI 70 초과 시 30~50% 분할 청산.` },
        ] },
        footnote: `소부장은 고객사 CAPEX에 후행하는 고베타 섹터로, 수주 모멘텀 둔화기 하방 충격이 큽니다. 채권 안전판과 적립식 분할 매수로 변동성을 관리하고, 국내 장비·소재 / 일본 글로벌 장비 / 미국 ETF로 지역 분산하는 것을 권장합니다.`,
    },
};

export default function SemiPartsChart({ onOpenDetail }: SemiPartsChartProps) {
    const [period, setPeriod] = useState('1Y');
    const [chartData, setChartData] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [hoveredLine, setHoveredLine] = useState<string | null>(null);
    const [keys, setKeys] = useState<string[]>([]);
    const [originalData, setOriginalData] = useState<any[]>([]);
    const [selectedEtf, setSelectedEtf] = useState<string | null>(null);
    const [marketTab, setMarketTab] = useState<'KR' | 'KR_US' | 'US'>('KR');

    const [holdingsData, setHoldingsData] = useState<any[]>([]);
    const [holdingsKeys, setHoldingsKeys] = useState<string[]>([]);
    const [isHoldingsLoading, setIsHoldingsLoading] = useState(true);
    const [holdingsUpdatedAt, setHoldingsUpdatedAt] = useState<string>('');
    const [isMarketOpen, setIsMarketOpen] = useState<boolean>(() => checkIsUsMarketOpenClient());
    const [disparityData, setDisparityData] = useState<{ [key: string]: any }>({});
    const [activeInsightTab, setActiveInsightTab] = useState<'macro' | 'etfs' | 'strategy' | 'qcycle'>('macro');

    // Q-Cycle Screener (반도체 섹터와 동일한 /semi-screener 데이터 재사용)
    const [screenerData, setScreenerData] = useState<any[]>([]);
    const [screenerLoading, setScreenerLoading] = useState(false);
    const [screenerUpdatedAt, setScreenerUpdatedAt] = useState<string>('');

    useEffect(() => {
        if (activeInsightTab !== 'qcycle' || screenerData.length > 0) return;
        const fetchScreener = async () => {
            setScreenerLoading(true);
            try {
                const res = await fetch(`${API_BASE}/api/v1/analyze/semi-screener`, { cache: 'no-store' });
                if (res.ok) {
                    const json = await res.json();
                    setScreenerData(json.data || []);
                    setScreenerUpdatedAt(json.updated_at || '');
                }
            } catch (e) {
                console.error('screener fetch error', e);
            } finally {
                setScreenerLoading(false);
            }
        };
        fetchScreener();
    }, [activeInsightTab]);

    useEffect(() => {
        const fetchDisparity = async () => {
            try {
                const res = await fetch(`${API_BASE}/api/v1/analyze/etf/disparity?codes=471760,471990,455850,474590,464920,446770,SOXX,XSD`, { cache: 'no-store' });
                if (res.ok) setDisparityData(await res.json());
            } catch (err) {
                console.error('Error fetching SemiParts ETF disparity:', err);
            }
        };
        fetchDisparity();
        const interval = setInterval(fetchDisparity, 60000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const fetchHoldings = async () => {
            setIsHoldingsLoading(true);
            try {
                const res = await fetch(`${API_BASE}/api/v1/analyze/semiparts-holdings`, { cache: 'no-store' });
                if (!res.ok) throw new Error('API fetch error');
                const data = await res.json();
                if (data.table_data) {
                    setHoldingsData(data.table_data);
                    if (data.keys) setHoldingsKeys(data.keys);
                    if (data.updated_at) setHoldingsUpdatedAt(data.updated_at);
                    if (data.is_market_open !== undefined) setIsMarketOpen(data.is_market_open);
                }
            } catch (err) {
                console.error('Error fetching semiparts holdings:', err);
            } finally {
                setIsHoldingsLoading(false);
            }
        };
        fetchHoldings();
    }, []);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const url = selectedEtf
                    ? `${API_BASE}/api/v1/analyze/semiparts-chart?etf=${encodeURIComponent(selectedEtf)}`
                    : `${API_BASE}/api/v1/analyze/semiparts-chart`;
                const res = await fetch(url, { cache: 'no-store' });
                if (!res.ok) throw new Error('API fetch error');
                const data = await res.json();
                if (data.line_chart_data && data.line_chart_data.length > 0) {
                    setOriginalData(data.line_chart_data);
                    setKeys(data.keys);
                } else {
                    setError('데이터가 없습니다.');
                }
            } catch (err) {
                console.error(err);
                setError('서버에서 반도체 소부장 지수 데이터를 불러오지 못했습니다.');
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [selectedEtf]);

    useEffect(() => {
        if (!originalData || originalData.length === 0) return;
        const now = new Date();
        let startDate = new Date();
        switch (period) {
            case '1M': startDate.setMonth(now.getMonth() - 1); break;
            case '3M': startDate.setMonth(now.getMonth() - 3); break;
            case '6M': startDate.setMonth(now.getMonth() - 6); break;
            case '1Y': startDate.setFullYear(now.getFullYear() - 1); break;
            case '3Y': startDate.setFullYear(now.getFullYear() - 3); break;
            case '10Y': startDate.setFullYear(now.getFullYear() - 10); break;
            default: startDate.setFullYear(now.getFullYear() - 1); break;
        }
        const filtered = originalData.filter(d => new Date(d.date) >= startDate);
        if (filtered.length === 0) { setChartData([]); return; }

        const baseValues: any = {};
        keys.forEach(k => {
            const firstValid = filtered.find(d => d[k] != null && d[k] > 0);
            if (firstValid) baseValues[k] = firstValid[k];
        });

        const normalizedData = filtered.map(d => {
            const row: any = { date: d.date.replace(/-/g, '/').substring(2) };
            keys.forEach(k => {
                if (d[k] != null && baseValues[k]) {
                    row[k] = Number(((d[k] / baseValues[k]) * 100).toFixed(2));
                }
            });
            return row;
        });
        setChartData(normalizedData);
    }, [period, originalData, keys]);

    const periodOptions = ['1M', '3M', '6M', '1Y', '3Y', '10Y'];
    const colors = [
        '#8b5cf6', '#ec4899', '#3b82f6', '#10b981', '#f59e0b',
        '#06b6d4', '#a855f7', '#6366f1', '#14b8a6', '#f43f5e',
        '#e11d48', '#0ea5e9'
    ];

    const krEtfs = [
        "TIGER AI반도체핵심공정",
        "KODEX AI반도체핵심장비",
        "SOL AI반도체소부장",
        "WON 반도체밸류체인액티브",
    ];
    const krUsEtfs = [
        "PLUS 일본반도체소부장",
        "ACE 글로벌반도체TOP4 Plus",
    ];
    const usEtfs = ["SOXX", "XSD"];

    const etfsToSelect = [...krEtfs, ...krUsEtfs, ...usEtfs];
    const baseEtfKeys = [...krEtfs, ...krUsEtfs, ...usEtfs];

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (!active || !payload || payload.length === 0) return null;
        const currentIdx = chartData.findIndex((d) => d.date === label);
        const prevRow = currentIdx > 0 ? chartData[currentIdx - 1] : null;
        return (
            <div style={{
                backgroundColor: 'rgba(18, 18, 23, 0.97)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.5)', padding: '10px 14px',
                fontSize: '12px', minWidth: '210px',
            }}>
                <p style={{ color: 'rgba(255,255,255,0.45)', marginBottom: '8px', fontSize: '11px' }}>{label}</p>
                {payload.map((entry: any) => {
                    const val: number = entry.value;
                    if (val === undefined || val === null || isNaN(val)) return null;
                    const prevVal: number | null = prevRow?.[entry.dataKey] ?? null;
                    const dailyPct = prevVal != null && prevVal > 0 ? (((val - prevVal) / prevVal) * 100).toFixed(2) : null;
                    const isUp = dailyPct !== null && parseFloat(dailyPct) >= 0;
                    const dailyColor = dailyPct === null ? 'rgba(255,255,255,0.3)' : isUp ? '#34d399' : '#f87171';
                    const dailyText = dailyPct === null ? '' : isUp ? `(+${dailyPct}%)` : `(${dailyPct}%)`;
                    return (
                        <div key={entry.dataKey} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
                            <span style={{ color: entry.color, fontWeight: 'bold' }}>{entry.dataKey}</span>
                            <span style={{ color: 'rgba(255,255,255,0.85)', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                                {val.toFixed(1)}%
                                {dailyPct !== null && (
                                    <span style={{ color: dailyColor, marginLeft: '6px', fontSize: '11px' }}>{dailyText}</span>
                                )}
                            </span>
                        </div>
                    );
                })}
                <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '9px', marginTop: '6px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '5px' }}>
                    기준점 100 대비 &nbsp;·&nbsp; 괄호 = 전일대비 증감율
                </p>
            </div>
        );
    };

    const activeTabEtfs = marketTab === 'KR' ? krEtfs : marketTab === 'KR_US' ? krUsEtfs : usEtfs;
    const displayHoldingsKeys = selectedEtf ? [selectedEtf] : holdingsKeys.filter((k) => activeTabEtfs.includes(k));

    const displayHoldingsData = selectedEtf
        ? holdingsData.filter((row) => row[selectedEtf] !== undefined && row[selectedEtf] > 0).sort((a, b) => (b[selectedEtf] || 0) - (a[selectedEtf] || 0))
        : holdingsData
            .filter((row) => displayHoldingsKeys.some((k) => row[k] !== undefined && row[k] > 0))
            .sort((a, b) => {
                const sumA = displayHoldingsKeys.reduce((sum, k) => sum + (a[k] || 0), 0);
                const sumB = displayHoldingsKeys.reduce((sum, k) => sum + (b[k] || 0), 0);
                return sumB - sumA;
            });

    const renderCustomLegend = (props: any) => {
        const { payload } = props;
        if (!payload) return null;
        const koreanItems = payload.filter((entry: any) => krEtfs.includes(entry.value));
        const krUsItems = payload.filter((entry: any) => krUsEtfs.includes(entry.value));
        const usItems = payload.filter((entry: any) => usEtfs.includes(entry.value));
        const constituentItems = payload.filter((entry: any) =>
            !krEtfs.includes(entry.value) && !krUsEtfs.includes(entry.value) && !usEtfs.includes(entry.value));

        const renderGroup = (items: any[], label: string, keyPrefix: string) => items.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 justify-center mt-0.5">
                <span className="text-[10px] font-bold text-gray-500 mr-1 uppercase tracking-wider">{label}</span>
                {items.map((entry: any, index: number) => {
                    const isSelected = selectedEtf === entry.value;
                    return (
                        <button
                            key={`${keyPrefix}-${index}`}
                            onMouseEnter={() => setHoveredLine(entry.value)}
                            onMouseLeave={() => setHoveredLine(null)}
                            onClick={() => setSelectedEtf(prev => prev === entry.value ? null : entry.value)}
                            className={`flex items-center gap-1.5 transition-all hover:text-white ${isSelected ? 'text-white font-bold scale-105' : 'text-gray-400'}`}
                        >
                            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                            <span>{entry.value}</span>
                        </button>
                    );
                })}
            </div>
        );

        return (
            <div className="flex flex-col gap-2 mt-4 text-xs font-semibold select-none">
                {renderGroup(koreanItems, '국내상장(국내주식):', 'kr')}
                {renderGroup(krUsItems, '국내상장(해외주식):', 'krus')}
                {renderGroup(usItems, '해외상장 ETF:', 'us')}
                {constituentItems.length > 0 && (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 justify-center mt-2 border-t border-white/5 pt-2">
                        <span className="text-[9px] font-bold text-gray-500 mr-1 uppercase tracking-wider">편입종목:</span>
                        {constituentItems.map((entry: any, index: number) => (
                            <div key={`holding-${index}`}
                                onMouseEnter={() => setHoveredLine(entry.value)}
                                onMouseLeave={() => setHoveredLine(null)}
                                className="flex items-center gap-1 text-[10px] text-gray-400 font-mono transition-colors">
                                <span className="w-2 h-0.5" style={{ backgroundColor: entry.color }} />
                                <span>{entry.value}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    const GROUP_CONFIG: Record<string, { color: string }> = {
        '글로벌 WFE':       { color: '#8b5cf6' },
        '독점 해자':         { color: '#f59e0b' },
        '안전마진':          { color: '#10b981' },
        '사이클 턴어라운드': { color: '#3b82f6' },
        '기타':             { color: '#6b7280' },
    };

    const ScatterDot = (props: any) => {
        const { cx, cy, fill, payload } = props;
        if (cx == null || cy == null) return null;
        return (
            <g>
                <circle cx={cx} cy={cy} r={5} fill={fill} stroke="rgba(255,255,255,0.25)" strokeWidth={1} />
                <text x={cx + 7} y={cy + 4} fontSize={9} fill="rgba(220,225,240,0.9)" fontWeight="600">
                    {payload.name}
                </text>
            </g>
        );
    };

    const ScatterTooltip = ({ active, payload }: any) => {
        if (!active || !payload?.length) return null;
        const d = payload[0]?.payload;
        return (
            <div style={{ backgroundColor: 'rgba(18,18,35,0.97)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '10px 14px', fontSize: '12px' }}>
                <div style={{ fontWeight: 'bold', color: '#fff', marginBottom: '6px' }}>{d?.name} <span style={{ color: 'rgba(255,255,255,0.4)', fontWeight: 'normal' }}>({d?.ticker})</span></div>
                <div style={{ color: '#94a3b8' }}>OPM (TTM): <span style={{ color: '#34d399', fontWeight: 'bold' }}>{d?.opm != null ? `${d.opm}%` : 'N/A'}</span></div>
                <div style={{ color: '#94a3b8' }}>Trailing PER: <span style={{ color: '#fbbf24', fontWeight: 'bold' }}>{d?.per != null ? `${d.per}x` : 'N/A'}</span></div>
                <div style={{ color: '#6b7280', marginTop: '4px', fontSize: '10px' }}>{d?.group}</div>
            </div>
        );
    };

    return (
        <div className="w-full bg-[#121217]/60 border border-white/10 rounded-3xl p-4 xl:p-5 backdrop-blur-md shadow-xl flex flex-col mt-0">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-3">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Activity className="w-5 h-5 text-indigo-400" />
                    반도체 소부장 주요 종목 현황
                </h3>
                <div className="flex items-center gap-2.5">
                    <div className="flex bg-black/40 rounded-lg p-1 border border-white/5 shadow-inner">
                        {([['KR', '국내상장 ETF(국내주식)'], ['KR_US', '국내상장 ETF(해외주식)'], ['US', '해외상장 ETF']] as const).map(([val, lbl]) => (
                            <button key={val}
                                onClick={() => { setMarketTab(val); setSelectedEtf(null); }}
                                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${marketTab === val ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'}`}>
                                {lbl}
                            </button>
                        ))}
                    </div>
                    <div className="flex bg-black/40 rounded-lg p-1 border border-white/5 shadow-inner">
                        {periodOptions.map(p => (
                            <button key={p} onClick={() => setPeriod(p)}
                                className={`px-2.5 py-1.5 text-xs font-bold rounded-md transition-all ${period === p ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'}`}>
                                {p}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* ETF Selector Chips */}
            <div className="flex flex-wrap gap-2 items-center mb-4 bg-black/30 p-2.5 rounded-2xl border border-white/5">
                <span className="text-[11px] font-bold text-gray-400 mr-1 flex items-center">🔍 구성종목 주가 비교:</span>
                {etfsToSelect.filter(e => activeTabEtfs.includes(e) || selectedEtf === e).map((etfName, idx) => {
                    const isSelected = selectedEtf === etfName;
                    const themeColor = colors[idx % colors.length];
                    return (
                        <button key={etfName}
                            onClick={() => setSelectedEtf(isSelected ? null : etfName)}
                            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all border ${isSelected ? 'bg-indigo-600/20 text-white shadow-[0_0_12px_rgba(99,102,241,0.25)]' : 'bg-white/5 border-white/10 text-gray-400 hover:text-gray-200 hover:bg-white/10'}`}
                            style={{ borderColor: isSelected ? themeColor : 'rgba(255,255,255,0.06)' }}>
                            {etfName} {isSelected && '✓'}
                        </button>
                    );
                })}
                {selectedEtf && (
                    <button onClick={() => setSelectedEtf(null)}
                        className="text-[10px] text-rose-400 hover:text-rose-300 font-bold ml-auto hover:underline transition-all">
                        비교 초기화 (X)
                    </button>
                )}
            </div>

            <div className="w-full h-[400px]">
                {isLoading ? (
                    <ChartLoadingPlaceholder height={400} message="반도체 소부장 ETF 데이터 로딩중" />
                ) : error ? (
                    <div className="w-full h-full flex items-center justify-center text-rose-400 text-sm">{error}</div>
                ) : (
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData} margin={{ top: 10, right: 15, left: 15, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                            <XAxis dataKey="date" stroke="rgba(255,255,255,0.2)" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} tickMargin={10} minTickGap={30} />
                            <YAxis orientation="right" width={55} domain={['auto', 'auto']} stroke="rgba(255,255,255,0.2)" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} tickFormatter={(val) => `${val.toFixed(0)}%`} />
                            <RechartsTooltip content={<CustomTooltip />} />
                            <Legend content={renderCustomLegend} />
                            {keys.map((k, idx) => {
                                const isConstituent = !baseEtfKeys.includes(k);
                                if (!selectedEtf && !isConstituent && !activeTabEtfs.includes(k)) return null;
                                return (
                                    <Line key={k} type="monotone" dataKey={k} stroke={colors[idx % colors.length]}
                                        strokeWidth={hoveredLine === k ? (isConstituent ? 3 : 4) : hoveredLine ? 1 : (isConstituent ? 1.5 : 2)}
                                        strokeDasharray={isConstituent ? "4 4" : undefined}
                                        dot={false} activeDot={{ r: 4, strokeWidth: 0, fill: colors[idx % colors.length] }}
                                        name={k} connectNulls={true}
                                        style={{ opacity: hoveredLine === k ? 1 : hoveredLine ? 0.3 : 0.8, transition: 'all 0.3s ease' }} />
                                );
                            })}
                        </LineChart>
                    </ResponsiveContainer>
                )}
            </div>
            <p className="text-[10px] text-gray-500 text-right mt-2 font-mono">
                * 기준점 100으로 환산된 지수/주가 추이 (배당/분배금 제외)
            </p>

            <div className="w-full border-t border-white/10 my-5"></div>

            {/* Holdings Table Section */}
            <div className="flex flex-col gap-4">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center w-full gap-3">
                    <h4 className="text-base font-bold text-white flex items-center gap-2">
                        <Activity className="w-4 h-4 text-emerald-400" />
                        반도체 소부장 주요 ETF 구성종목 및 비중 비교 (%)
                    </h4>
                    <span className="text-[10px] sm:text-xs text-gray-400 font-bold font-mono bg-white/5 px-2 py-1.5 rounded border border-white/5">
                        {isMarketOpen ? (holdingsUpdatedAt ? `${holdingsUpdatedAt} KST 기준` : 'KST 기준') : '종가기준'}
                    </span>
                </div>

                {isHoldingsLoading ? (
                    <div className="py-8 flex justify-center items-center text-xs text-gray-400 font-medium">구성종목 데이터를 로드하는 중...</div>
                ) : holdingsData.length === 0 ? (
                    <div className="py-8 text-center text-xs text-rose-400">구성종목 데이터를 불러오지 못했습니다.</div>
                ) : (
                    <div className="overflow-x-auto overflow-y-auto max-h-[600px] w-full rounded-2xl border border-white/10 bg-black/30 shadow-inner">
                        <table className="w-full text-left border-collapse">
                            <thead className="sticky top-0 z-10">
                                <tr className="bg-[#141420]">
                                    <th className="px-4 py-3 text-xs font-bold text-gray-300 border-b border-white/10">구성종목명</th>
                                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-300 border-b border-white/10 whitespace-nowrap">현재가 / 전일대비</th>
                                    {displayHoldingsKeys.map((k, idx) => {
                                        const originalIdx = holdingsKeys.indexOf(k);
                                        const dotColor = colors[originalIdx >= 0 ? originalIdx : idx % colors.length];
                                        const etfCode = etfNameToCodeMap[k];
                                        const dispInfo = etfCode ? disparityData[etfCode] : null;

                                        let weightSum = 0;
                                        let weightedChangeSum = 0;
                                        holdingsData.forEach(row => {
                                            const weight = row[k];
                                            const change = row.change_pct;
                                            if (weight !== undefined && weight !== null && weight > 0 && change !== undefined && change !== null) {
                                                weightSum += weight;
                                                weightedChangeSum += (change * weight);
                                            }
                                        });
                                        const estChangePct = weightSum > 0 ? (weightedChangeSum / weightSum) : null;

                                        const isKrListed = krEtfs.includes(k) || krUsEtfs.includes(k);
                                        const isUsListed = usEtfs.includes(k);
                                        const isBeforeOpen = isBeforeKrMarketOpen();
                                        const actualPrice = dispInfo ? dispInfo.price : null;
                                        const actualChangeRate = dispInfo ? dispInfo.change_rate : null;

                                        const estPrice = isKrListed
                                            ? (isBeforeOpen ? null : actualPrice)
                                            : ((dispInfo && dispInfo.prev_close && estChangePct !== null) ? dispInfo.prev_close * (1 + estChangePct / 100) : null);
                                        const displayEstChangePct = isKrListed ? (isBeforeOpen ? null : actualChangeRate) : estChangePct;
                                        const diffRate = isKrListed
                                            ? (isBeforeOpen ? null : 0)
                                            : ((actualPrice !== null && estPrice !== null && estPrice > 0) ? ((actualPrice - estPrice) / estPrice) * 100 : null);
                                        const showInfo = isKrListed ? (isBeforeOpen ? true : (actualPrice !== null)) : (estChangePct !== null);
                                        const shouldShowActualPrice = isKrListed ? (!isBeforeOpen && actualPrice !== null) : (actualPrice !== null);

                                        return (
                                            <th key={k} className="px-3 py-3 text-center text-xs font-bold text-gray-300 border-b border-white/10">
                                                <div className="flex flex-col items-center justify-center gap-1.5 whitespace-nowrap">
                                                    <div className="flex items-center justify-center gap-1.5">
                                                        <span style={{ color: dotColor }}>●</span>
                                                        {k}
                                                    </div>
                                                    {showInfo && (
                                                        <div className="flex flex-col items-center mt-1 text-[11px] font-sans space-y-0.5 leading-normal">
                                                            <div className="flex items-center gap-1 font-bold text-gray-200">
                                                                <span className="text-gray-400">예상가격:</span>
                                                                {estPrice !== null ? (
                                                                    <span>{isUsListed ? `$${estPrice.toFixed(2)}` : `${new Intl.NumberFormat('ko-KR').format(Math.floor(estPrice))}원`}</span>
                                                                ) : (
                                                                    <span>{isUsListed ? '-$' : '-원'}</span>
                                                                )}
                                                                {displayEstChangePct !== null && (
                                                                    <span style={{ color: displayEstChangePct > 0 ? '#60a5fa' : displayEstChangePct < 0 ? '#f87171' : '#94a3b8' }}>
                                                                        ({displayEstChangePct > 0 ? '+' : ''}{displayEstChangePct.toFixed(2)}%)
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="flex items-center gap-1 font-bold text-gray-200">
                                                                <span className="text-gray-400">실제가격:</span>
                                                                {shouldShowActualPrice ? (
                                                                    <>
                                                                        <span>{isUsListed ? `$${actualPrice!.toFixed(2)}` : `${new Intl.NumberFormat('ko-KR').format(Math.floor(actualPrice!))}원`}</span>
                                                                        {actualChangeRate !== null && (
                                                                            <span style={{ color: actualChangeRate > 0 ? '#60a5fa' : actualChangeRate < 0 ? '#f87171' : '#94a3b8' }}>
                                                                                ({actualChangeRate > 0 ? '+' : ''}{actualChangeRate.toFixed(2)}%)
                                                                            </span>
                                                                        )}
                                                                    </>
                                                                ) : (
                                                                    <span className="text-gray-500 font-medium">-</span>
                                                                )}
                                                            </div>
                                                            <div className="text-[10px] text-gray-400 font-medium">
                                                                괴리율:{' '}
                                                                {(isKrListed ? !isBeforeOpen : true) && diffRate !== null ? (
                                                                    <span style={{ color: diffRate > 0 ? '#60a5fa' : diffRate < 0 ? '#f87171' : '#94a3b8' }} className="font-semibold">
                                                                        {diffRate > 0 ? '+' : ''}{diffRate.toFixed(3)}%
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-gray-500 font-semibold">-</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </th>
                                        );
                                    })}
                                </tr>
                            </thead>
                            <tbody>
                                {displayHoldingsData.map((row) => (
                                    <tr key={row.constituent} className="hover:bg-white/5 transition-colors">
                                        <td className="px-4 py-2.5 text-xs font-bold border-b border-white/5 max-w-[200px] truncate">
                                            {onOpenDetail ? (
                                                <button
                                                    onClick={() => onOpenDetail(getTickerFromConstituent(row.constituent))}
                                                    className="text-gray-200 hover:text-indigo-400 transition-all duration-200 text-left font-bold inline-flex items-center gap-1 group/btn"
                                                    title={`${row.constituent} 상세 주식 정보 조회`}>
                                                    <span className="group-hover/btn:underline">{row.constituent}</span>
                                                    <ArrowUpRight className="w-3.5 h-3.5 text-gray-400 group-hover/btn:text-indigo-400 transition-colors" />
                                                </button>
                                            ) : (
                                                <span className="text-gray-200">{row.constituent}</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-2.5 text-center text-xs border-b border-white/5 whitespace-nowrap font-mono align-middle">
                                            {row.price !== undefined && row.price !== null ? (
                                                <div className="flex flex-col gap-0.5 justify-center items-center">
                                                    <span className="text-gray-200 font-bold">{formatConstituentPrice(row.constituent, row.price)}</span>
                                                    {row.change_pct !== undefined && row.change_pct !== null ? (
                                                        <span className="text-[10px] font-bold" style={{ color: row.change_pct > 0 ? '#60a5fa' : row.change_pct < 0 ? '#f87171' : '#94a3b8' }}>
                                                            {row.change_pct > 0 ? '+' : ''}{row.change_pct.toFixed(2)}%
                                                        </span>
                                                    ) : (
                                                        <span className="text-[10px] text-gray-500">-</span>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-gray-500 font-bold">-</span>
                                            )}
                                        </td>
                                        {displayHoldingsKeys.map((k) => {
                                            const val = row[k];
                                            if (!val || val === 0) {
                                                return <td key={k} className="px-3 py-2.5 text-center text-xs font-semibold text-gray-600 border-b border-white/5 font-mono">-</td>;
                                            }
                                            let cellColor = '#ffffff';
                                            if (val >= 20) cellColor = '#10b981';
                                            else if (val >= 10) cellColor = '#84cc16';
                                            else if (val >= 5) cellColor = '#fbbf24';
                                            return (
                                                <td key={k} className="px-3 py-2 border-b border-white/5 align-middle min-w-[125px]">
                                                    <div className="flex flex-col gap-1 w-full">
                                                        <div className="flex justify-end w-full">
                                                            <span className="text-[10.5px] font-bold font-mono" style={{ color: cellColor }}>{val.toFixed(1)}%</span>
                                                        </div>
                                                        <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                                                            <div className="h-full rounded-full transition-all duration-300" style={{ width: `${Math.min(val, 100)}%`, backgroundColor: cellColor }} />
                                                        </div>
                                                    </div>
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <div className="w-full border-t border-white/10 my-6"></div>

            {/* Expert Insight Section — 동적 Gemini 리포트 (라이브 시세 그라운딩 + Update 갱신) */}
            <SectorInsightReport
                sector="semiparts"
                title="AI 자본지출 사이클과 반도체 소부장(소재·부품·장비) 투자 전략"
                accent="purple"
                tabs={[
                    { id: 'macro', label: '1. 매크로 & 소부장 트렌드', icon: TrendingUp },
                    { id: 'etfs', label: '2. 국내외 핵심 ETF 분석', icon: BookOpen },
                    { id: 'strategy', label: '3. 자산배분 모델 & 가이드', icon: PieChart },
                    { id: 'qcycle', label: '4. Q-Cycle 퀀트 스크리너', icon: Cpu },
                ]}
                activeTab={activeInsightTab}
                onTabChange={(id) => setActiveInsightTab(id as any)}
                fallback={SEMIPARTS_INSIGHT_FALLBACK}
            >
                {activeInsightTab === 'qcycle' && (
                    <div className="flex flex-col gap-6 mt-1">

                        {/* 현재 국면 표시 */}
                        <div className="flex flex-col sm:flex-row gap-3">
                            <div className="flex-1 flex items-center gap-3 bg-indigo-500/10 border border-indigo-500/30 rounded-xl p-3">
                                <div className="w-2.5 h-2.5 rounded-full bg-indigo-400 animate-pulse shrink-0" />
                                <div>
                                    <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">현재 Q-Cycle 국면</div>
                                    <div className="text-sm font-bold text-white">Phase 1 · 전공정(Front-end) 중심</div>
                                    <div className="text-[11px] text-indigo-300 mt-0.5">삼성 P4 조기 집행 + TSMC CAPEX +62% → 전공정 ETF 비중 구조적 확대 구간</div>
                                </div>
                            </div>
                            <div className="flex-1 flex items-center gap-3 bg-white/[0.02] border border-white/10 rounded-xl p-3 opacity-60">
                                <div className="w-2.5 h-2.5 rounded-full bg-gray-500 shrink-0" />
                                <div>
                                    <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">다음 국면 (예정)</div>
                                    <div className="text-sm font-bold text-gray-400">Phase 2 · 후공정(Back-end) 리밸런싱</div>
                                    <div className="text-[11px] text-gray-500 mt-0.5">OSAT 증설 발표 본격화 시점에 후공정 ETF로 비중 이동</div>
                                </div>
                            </div>
                        </div>

                        {/* WFE 투자 thesis 카드 3개 */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 flex flex-col gap-2">
                                <div className="flex items-center gap-2 text-violet-400 font-bold text-sm">
                                    <Target className="w-4 h-4" />
                                    <span>WFE 병목: AI 자본의 최종 목적지</span>
                                </div>
                                <p className="text-xs text-gray-300 leading-relaxed">
                                    AI 메가 펀딩 → 데이터센터 증설 → 파운드리/메모리 신규 팹 → <span className="text-violet-300 font-bold">전공정 반도체 장비(WFE) 수요 폭발</span>. 자본의 병목 현상이 발생하는 좁은 출구(WFE)에 투자해야 가장 높은 레버리지 효과를 얻을 수 있습니다.
                                </p>
                            </div>
                            <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 flex flex-col gap-2">
                                <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                                    <GitBranch className="w-4 h-4" />
                                    <span>Q사이클: 물량 확대 국면 진입</span>
                                </div>
                                <p className="text-xs text-gray-300 leading-relaxed">
                                    P사이클(감산·ASP 회복)을 넘어 <span className="text-amber-300 font-bold">Q사이클(신규 팹 증설·CAPEX 확대)</span>로 전환. 수혜 섹터도 메모리 IDM 본사 → 증착·식각·세정·검사 장비 및 소재/부품으로 이동합니다.
                                </p>
                            </div>
                            <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 flex flex-col gap-2">
                                <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                                    <ArrowRight className="w-4 h-4" />
                                    <span>승자 독식 리스크 제거 전략</span>
                                </div>
                                <p className="text-xs text-gray-300 leading-relaxed">
                                    TSMC가 이기든, 인텔이 이기든, 삼성이 이기든 — 결국 첨단 팹에는 <span className="text-emerald-300 font-bold">동일한 WFE 장비</span>가 들어갑니다. 개별 칩 메이커의 수율·수주 경쟁 리스크를 피하고 확정된 팹 증설에만 배팅하는 구조적 전략입니다.
                                </p>
                            </div>
                        </div>

                        {/* 공정별 6개월 시차 로테이션 타임라인 */}
                        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4">
                            <h5 className="text-xs font-bold text-gray-300 mb-4 flex items-center gap-2">
                                <Activity className="w-3.5 h-3.5 text-indigo-400" />
                                공정별 6개월 시차 로테이션 타임라인
                            </h5>
                            <div className="flex items-center gap-0 w-full overflow-x-auto">
                                {/* Step 1: Cleanroom */}
                                <div className="flex flex-col items-center gap-2 min-w-[110px]">
                                    <div className="w-10 h-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-xs font-bold text-gray-400">S1</div>
                                    <div className="text-center">
                                        <div className="text-[10px] font-bold text-gray-400">클린룸 구축</div>
                                        <div className="text-[9px] text-gray-600 mt-0.5">기초 인프라</div>
                                        <div className="text-[9px] text-gray-600">T+0</div>
                                    </div>
                                </div>
                                <div className="flex-1 flex flex-col items-center gap-1 min-w-[80px]">
                                    <div className="w-full h-px bg-white/20 relative">
                                        <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-white/30" />
                                    </div>
                                    <div className="text-[9px] text-gray-500">+6개월</div>
                                </div>
                                {/* Step 2: Front-end (CURRENT) */}
                                <div className="flex flex-col items-center gap-2 min-w-[130px]">
                                    <div className="relative">
                                        <div className="w-10 h-10 rounded-full bg-indigo-500/30 border-2 border-indigo-400 flex items-center justify-center text-xs font-bold text-indigo-300">S2</div>
                                        <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-indigo-400 animate-ping" />
                                        <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-indigo-400" />
                                    </div>
                                    <div className="text-center">
                                        <div className="text-[10px] font-bold text-indigo-300">전공정 장비 발주</div>
                                        <div className="text-[9px] text-indigo-400/70 mt-0.5">ASML/AMAT/LRCX</div>
                                        <div className="text-[9px] text-indigo-400/70">유진테크/원익IPS</div>
                                        <div className="text-[9px] font-bold text-indigo-300 mt-1 px-2 py-0.5 rounded-full border border-indigo-400/50 bg-indigo-400/10">← 현재 국면</div>
                                    </div>
                                </div>
                                <div className="flex-1 flex flex-col items-center gap-1 min-w-[80px]">
                                    <div className="w-full h-px bg-white/10" />
                                    <div className="text-[9px] text-gray-600">+6개월</div>
                                </div>
                                {/* Step 3: Back-end */}
                                <div className="flex flex-col items-center gap-2 min-w-[110px] opacity-50">
                                    <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-xs font-bold text-gray-600">S3</div>
                                    <div className="text-center">
                                        <div className="text-[10px] font-bold text-gray-500">후공정 장비 발주</div>
                                        <div className="text-[9px] text-gray-600 mt-0.5">OSAT 증설 시점</div>
                                        <div className="text-[9px] text-gray-600">리밸런싱 타점</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 퀀트 스크리너: OPM vs PER 스캐터 차트 */}
                        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4">
                            <div className="flex items-center justify-between mb-1">
                                <h5 className="text-xs font-bold text-gray-300 flex items-center gap-2">
                                    <Target className="w-3.5 h-3.5 text-violet-400" />
                                    퀀트 스크리너: TTM OPM × Trailing PER 포지셔닝
                                </h5>
                                <div className="flex items-center gap-3">
                                    {screenerUpdatedAt && (
                                        <span className="text-[9px] text-gray-600">기준: {screenerUpdatedAt} TTM 실제</span>
                                    )}
                                    <span className="text-[9px] text-amber-600/80 font-bold px-2 py-0.5 rounded bg-amber-600/10 border border-amber-600/20">컨센서스 미사용</span>
                                </div>
                            </div>

                            {/* 그룹 범례 */}
                            <div className="flex flex-wrap gap-3 mb-4 mt-2">
                                {Object.entries(GROUP_CONFIG).map(([g, cfg]) => (
                                    <div key={g} className="flex items-center gap-1.5 text-[10px] text-gray-400">
                                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cfg.color }} />
                                        {g}
                                    </div>
                                ))}
                            </div>

                            {screenerLoading ? (
                                <div className="h-[340px] flex items-center justify-center text-gray-500 text-sm">
                                    <div className="flex flex-col items-center gap-3">
                                        <div className="w-6 h-6 border-2 border-violet-500/50 border-t-violet-400 rounded-full animate-spin" />
                                        Yahoo Finance에서 TTM 재무 데이터 조회 중...
                                    </div>
                                </div>
                            ) : screenerData.length === 0 ? (
                                <div className="h-[340px] flex items-center justify-center text-gray-500 text-sm">데이터 없음</div>
                            ) : (
                                <>
                                    <div className="relative">
                                        {/* 사분면 레이블 */}
                                        <div className="absolute top-2 left-[20%] text-[10px] text-emerald-400/60 font-bold pointer-events-none z-10">안전마진 영역</div>
                                        <div className="absolute top-2 right-4 text-[10px] text-amber-400/60 font-bold pointer-events-none z-10">독점 해자 영역</div>
                                        <div className="absolute bottom-10 right-4 text-[10px] text-blue-400/40 font-bold pointer-events-none z-10">사이클 턴어라운드</div>
                                        <ResponsiveContainer width="100%" height={340}>
                                            <ScatterChart margin={{ top: 20, right: 40, bottom: 20, left: 20 }}>
                                                <CartesianGrid stroke="rgba(255,255,255,0.05)" />
                                                <XAxis
                                                    dataKey="per"
                                                    type="number"
                                                    name="Trailing PER"
                                                    domain={[0, 'auto']}
                                                    tickFormatter={(v) => `${v}x`}
                                                    tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }}
                                                    label={{ value: 'Trailing PER (배수)', position: 'insideBottom', offset: -10, fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
                                                />
                                                <YAxis
                                                    dataKey="opm"
                                                    type="number"
                                                    name="TTM OPM"
                                                    tickFormatter={(v) => `${v}%`}
                                                    tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }}
                                                    label={{ value: 'TTM OPM (%)', angle: -90, position: 'insideLeft', offset: 10, fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
                                                />
                                                <ZAxis range={[60, 60]} />
                                                <RechartsTooltip content={<ScatterTooltip />} />
                                                {/* 사분면 구분선 */}
                                                <ReferenceLine y={30} stroke="rgba(255,255,255,0.1)" strokeDasharray="4 4" />
                                                <ReferenceLine x={25} stroke="rgba(255,255,255,0.1)" strokeDasharray="4 4" />
                                                {Object.keys(GROUP_CONFIG).map((group) => {
                                                    const groupData = screenerData
                                                        .filter((d) => d.group === group && d.opm != null && d.per != null)
                                                        .map((d) => ({ ...d, x: d.per, y: d.opm }));
                                                    if (groupData.length === 0) return null;
                                                    return (
                                                        <Scatter
                                                            key={group}
                                                            name={group}
                                                            data={groupData}
                                                            fill={GROUP_CONFIG[group].color}
                                                            shape={(props: any) => <ScatterDot {...props} fill={GROUP_CONFIG[group].color} />}
                                                        />
                                                    );
                                                })}
                                            </ScatterChart>
                                        </ResponsiveContainer>
                                    </div>

                                    {/* 데이터 테이블 */}
                                    <div className="mt-4 overflow-x-auto">
                                        <table className="w-full text-xs">
                                            <thead>
                                                <tr className="border-b border-white/10">
                                                    <th className="px-3 py-2 text-left text-gray-400 font-bold">종목</th>
                                                    <th className="px-3 py-2 text-center text-gray-400 font-bold">그룹</th>
                                                    <th className="px-3 py-2 text-right text-gray-400 font-bold">TTM OPM</th>
                                                    <th className="px-3 py-2 text-right text-gray-400 font-bold">Trailing PER</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {[...screenerData]
                                                    .sort((a, b) => (b.opm ?? -999) - (a.opm ?? -999))
                                                    .map((item) => {
                                                        const cfg = GROUP_CONFIG[item.group] || { color: '#6b7280' };
                                                        return (
                                                            <tr key={item.ticker} className="border-b border-white/5 hover:bg-white/[0.02]">
                                                                <td className="px-3 py-2 font-bold text-gray-200">
                                                                    {item.name}
                                                                    <span className="text-gray-600 font-normal ml-1.5 text-[10px]">{item.ticker}</span>
                                                                </td>
                                                                <td className="px-3 py-2 text-center">
                                                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold" style={{ color: cfg.color, backgroundColor: cfg.color + '20' }}>
                                                                        {item.group}
                                                                    </span>
                                                                </td>
                                                                <td className="px-3 py-2 text-right font-mono font-bold" style={{ color: item.opm != null ? (item.opm >= 30 ? '#34d399' : item.opm >= 20 ? '#fbbf24' : '#94a3b8') : '#4b5563' }}>
                                                                    {item.opm != null ? `${item.opm}%` : '–'}
                                                                </td>
                                                                <td className="px-3 py-2 text-right font-mono font-bold text-amber-400">
                                                                    {item.per != null ? `${item.per}x` : '–'}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                            </tbody>
                                        </table>
                                    </div>
                                </>
                            )}
                        </div>

                        <p className="text-[10px] text-gray-600 leading-relaxed">
                            * TTM(최근 4분기 합산) 실제 기준 · 컨센서스/FnGuide 미사용 · 출처: Yahoo Finance · 투자 권유 아님. 음수 PER은 표시 제외.
                        </p>
                    </div>
                )}
            </SectorInsightReport>
        </div>
    );
}
