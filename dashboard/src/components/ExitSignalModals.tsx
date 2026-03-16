import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, ReferenceLine, ReferenceArea, Legend } from 'recharts';
import { Search } from 'lucide-react';
import { API_BASE } from '../lib/apiConfig';

const useVisualSort = (data: any[], keys: string[]) => {
    return React.useMemo(() => {
        const ranges: any = {};
        keys.forEach(k => {
            if (!data) return;
            const vals = data.map(d => d[k]).filter(v => typeof v === 'number' && isFinite(v));
            ranges[k] = vals.length > 0 ? { min: Math.min(...vals), max: Math.max(...vals) } : { min: 0, max: 1 };
        });

        return (key: string, val: number) => {
            if (val == null || !ranges[key]) return -Infinity;
            const { min, max } = ranges[key];
            return max > min ? (val - min) / (max - min) : 0;
        };
    }, [data, keys]);
};

export function DollarModalContent() {
    const [period, setPeriod] = useState('1Y');
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [hoverIndex, setHoverIndex] = useState<number | null>(null);

    useEffect(() => {
        const fetchMacro = async () => {
            setLoading(true);
            try {

                const res = await fetch(`${API_BASE}/api/v1/exit-signal/macro?period=${period}`);
                if (res.ok) {
                    const json = await res.json();
                    setData(json);
                }
            } catch (err) {
                console.error("Failed to fetch macro detail:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchMacro();
    }, [period]);

    // Filter by period with REAL values (no normalization)
    const filteredData = React.useMemo(() => {
        if (!data || data.length === 0) return [];
        const startDt = new Date();
        if (period === '6M') startDt.setMonth(startDt.getMonth() - 6);
        else if (period === '1Y') startDt.setFullYear(startDt.getFullYear() - 1);
        else if (period === '3Y') startDt.setFullYear(startDt.getFullYear() - 3);
        else if (period === '10Y') startDt.setFullYear(startDt.getFullYear() - 10);

        return data
            .filter((d: any) => new Date(d.date) >= startDt)
            .map((d: any) => ({
                date: d.date,
                dollar: typeof d.dollar === 'number' ? d.dollar : null,           // 달러인덱스 실제값 (93~108)
                krw10: typeof d.krw === 'number' ? d.krw / 10 : null,             // 환율 /10 → 좌축 스케일 맞춤 (130~150)
                rawKrw: d.krw,
                kospi: typeof d.kospi === 'number' ? d.kospi : null,              // KOSPI 실제 (2300~2700)
                sp500: typeof d.sp500 === 'number' ? d.sp500 : null,              // S&P 500 실제 (4000~5800)
            }))
            .filter((d: any) => d.dollar !== null && isFinite(d.dollar));
    }, [data, period]);

    // 좌축 도메인: dollar(93~108) + krw/10(130~150) 공통 범위
    const leftMin = React.useMemo(() => {
        if (!filteredData.length) return 'auto';
        const vals = filteredData.flatMap((d: any) => [d.dollar, d.krw10].filter(v => v != null));
        return Math.floor(Math.min(...vals) * 0.98);
    }, [filteredData]);
    const leftMax = React.useMemo(() => {
        if (!filteredData.length) return 'auto';
        const vals = filteredData.flatMap((d: any) => [d.dollar, d.krw10].filter(v => v != null));
        return Math.ceil(Math.max(...vals) * 1.02);
    }, [filteredData]);

    // 우축 도메인: KOSPI + S&P 500 공통 범위
    const rightMin = React.useMemo(() => {
        if (!filteredData.length) return 'auto';
        const vals = filteredData.flatMap((d: any) => [d.kospi, d.sp500].filter(v => v != null));
        return Math.floor(Math.min(...vals) * 0.97);
    }, [filteredData]);
    const rightMax = React.useMemo(() => {
        if (!filteredData.length) return 'auto';
        const vals = filteredData.flatMap((d: any) => [d.kospi, d.sp500].filter(v => v != null));
        return Math.ceil(Math.max(...vals) * 1.03);
    }, [filteredData]);

    const getNorm = useVisualSort(filteredData, ['dollar', 'krw10', 'kospi', 'sp500']);

    if (loading) return <div className="flex items-center justify-center py-20 text-gray-500">Loading data...</div>;

    return (
        <div className="flex flex-col w-full gap-3">
            {/* 기간 선택 버튼 */}
            <div className="flex gap-2 justify-end shrink-0">
                {['6M', '1Y', '3Y', '10Y'].map(p => (
                    <button
                        key={p}
                        onClick={() => setPeriod(p)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${period === p ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
                    >
                        {p}
                    </button>
                ))}
            </div>

            {/* 와이드 차트 — 고정 높이 */}
            <div className="w-full bg-black/20 rounded-xl p-1 md:p-3 border border-white/5" style={{ height: '280px' }}>
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={filteredData} margin={{ top: 5, right: 0, left: 2, bottom: 5 }}
                        onMouseMove={(e) => setHoverIndex(e?.activeTooltipIndex ?? null)}
                        onMouseLeave={() => setHoverIndex(null)}
                    >
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                        <XAxis dataKey="date" stroke="#71717a" fontSize={11} tickMargin={12} />

                        <YAxis yAxisId="left" domain={[leftMin, leftMax]} stroke="#a1a1aa" fontSize={10} width={42}
                            tickFormatter={(val) => Math.round(val).toString()} />
                        <YAxis yAxisId="right" orientation="right" domain={[rightMin, rightMax]} stroke="#a1a1aa" fontSize={10} width={55}
                            tickFormatter={(val) => typeof val === 'number' ? val.toLocaleString() : val} />

                        <RechartsTooltip
                            contentStyle={{ backgroundColor: 'rgba(0,0,0,0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                            content={({ active, payload, label }) => {
                                if (active && payload && payload.length) {
                                    const sortedPayload = [...payload].sort((a: any, b: any) => getNorm(b.dataKey, b.value) - getNorm(a.dataKey, a.value));
                                    const isLast = payload[0]?.payload === filteredData[filteredData.length - 1];
                                    const displayLabel = `${label} ${isLast ? '(최근/전일)' : ''}`;
                                    return (
                                        <div className="bg-black/90 border border-white/10 p-2 rounded-lg text-[12px]">
                                            <p className="text-gray-400 mb-2">{displayLabel}</p>
                                            {sortedPayload.map((entry: any, index: number) => {
                                                let displayValue = entry.value;
                                                let name = entry.name;
                                                if (name === '달러 인덱스') displayValue = entry.value?.toFixed(2);
                                                else if (name === 'USD/KRW') displayValue = `${Math.round(entry.payload.rawKrw || 0).toLocaleString()}원 (÷10: ${Math.round(entry.value)})`;
                                                else if (name === 'KOSPI') displayValue = `${Math.round(entry.value || 0).toLocaleString()}pt`;
                                                else if (name === 'S&P 500') displayValue = `${Math.round(entry.value || 0).toLocaleString()}pt`;

                                                return (
                                                    <div key={`item-${index}`} className="flex items-center gap-2 mb-1 font-medium" style={{ color: entry.color }}>
                                                        <span>{name} :</span>
                                                        <span>{displayValue}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    );
                                }
                                return null;
                            }}
                        />

                        <Line yAxisId="left" connectNulls type="monotone" name="달러 인덱스" dataKey="dollar" stroke="#34d399" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
                        <Line yAxisId="left" connectNulls type="stepAfter" name="USD/KRW" dataKey="krw10" stroke="#60a5fa" strokeWidth={2} strokeDasharray="4 4" dot={false} activeDot={{ r: 6 }} />
                        <Line yAxisId="right" connectNulls type="monotone" name="KOSPI" dataKey="kospi" stroke="#f43f5e" strokeWidth={1.5} dot={false} />
                        <Line yAxisId="right" connectNulls type="monotone" name="S&P 500" dataKey="sp500" stroke="#a78bfa" strokeWidth={1.5} dot={false} />
                    </LineChart>
                </ResponsiveContainer>
            </div>

            <div className="mt-4 flex flex-wrap gap-4 text-sm text-gray-400 justify-center">
                {(() => {
                    const currentD = hoverIndex !== null && filteredData[hoverIndex] ? filteredData[hoverIndex] : (filteredData.length > 0 ? filteredData[filteredData.length - 1] : null);
                    const items = [
                        { name: '원/달러 환율', dataKey: 'krw10', node: <><div className="w-3 h-3 border-2 border-blue-400 border-dashed rounded-sm"></div> 원/달러 환율 (÷10)</> },
                        { name: '달러 인덱스', dataKey: 'dollar', node: <><div className="w-3 h-3 bg-emerald-400 rounded-sm"></div> 달러 인덱스</> },
                        { name: 'S&P 500', dataKey: 'sp500', node: <><div className="w-3 h-3 bg-purple-400 rounded-sm"></div> S&P 500</> },
                        { name: 'KOSPI', dataKey: 'kospi', node: <><div className="w-3 h-3 bg-rose-400 rounded-sm"></div> KOSPI</> }
                    ];
                    if (currentD) {
                        items.sort((a, b) => getNorm(b.dataKey, (currentD as any)[b.dataKey]) - getNorm(a.dataKey, (currentD as any)[a.dataKey]));
                    }
                    return items.map(item => (
                        <div key={item.name} className="flex items-center gap-2">{item.node}</div>
                    ));
                })()}
            </div>
        </div>
    );
}

export function PerModalContent() {
    const [kospiData, setKospiData] = useState([]);

    // Default 3 Top Stocks
    const defaultStocks = [
        { id: '005930', name: '삼성전자' },
        { id: '000660', name: 'SK하이닉스' },
        { id: '005380', name: '현대차' }
    ];

    return (
        <div className="w-full flex flex-col gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <PerMiniChart title="KOSPI (기준 지수)" isKospi={true} />
                <PerMiniChart title={defaultStocks[0].name} symbol={defaultStocks[0].id} />
                <PerMiniChart title={defaultStocks[1].name} symbol={defaultStocks[1].id} />
                <PerMiniChart title={defaultStocks[2].name} symbol={defaultStocks[2].id} />
            </div>
            <p className="text-[11px] text-gray-500 text-center mt-2 shrink-0">KOSPI 주요 종목별 1년 포워드 PER 궤적입니다.</p>
        </div>
    );
}

function PerMiniChart({ title, symbol = null, isKospi = false }: any) {
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentSymbol, setCurrentSymbol] = useState(symbol);
    const [displayTitle, setDisplayTitle] = useState(title);
    const [isEditing, setIsEditing] = useState(false);
    const [searchInput, setSearchInput] = useState('');

    useEffect(() => {
        const fetchPE = async () => {
            setLoading(true);
            try {

                // If isKospi, we use the root exit_signal per data, otherwise /pe?symbol=XX
                if (isKospi) {
                    const res = await fetch(`${API_BASE}/api/v1/exit-signal`);
                    const json = await res.json();
                    if (json.indicators && json.indicators.per) {
                        setData(json.indicators.per);
                    }
                } else if (currentSymbol) {
                    const res = await fetch(`${API_BASE}/api/v1/exit-signal/pe?symbol=${currentSymbol}`);
                    const json = await res.json();
                    setData(json);
                }
            } catch (err) {
                console.error("Failed to fetch PE for", displayTitle, err);
            } finally {
                setLoading(false);
            }
        };
        fetchPE();
    }, [currentSymbol, isKospi]);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (searchInput.trim()) {
            let s = searchInput.trim();
            if (isNaN(Number(s))) {
                setDisplayTitle(s);
                if (s.includes("삼성")) s = "005930";
                else if (s.includes("하이닉스")) s = "000660";
                else if (s.includes("현대차") || s.includes("현대자동차")) s = "005380";
                else if (s.includes("기아")) s = "000270";
                else if (s.includes("네이버") || s.toLowerCase() === "naver") s = "035420";
                else if (s.includes("카카오")) s = "035720";
                else if (s.includes("셀트리온")) s = "068270";
                else if (s.includes("포스코") || s.toLowerCase() === "posco") s = "005490";
                else if (s.includes("LG엔에솔") || s.includes("에너지솔루션")) s = "373220";
                else if (s.includes("LG화학")) s = "051910";
                else if (s.includes("에코프로")) s = "086520";
                else s = "005930"; // Fallback
            } else {
                setDisplayTitle(s);
            }
            setCurrentSymbol(s);
        }
        setIsEditing(false);
    };

    const currentVal = data.length > 0 ? data[data.length - 1].val : 0;
    const getNormPer = useVisualSort(data, ['val', 'kospi']);

    return (
        <div className="bg-white/[0.03] border border-white/5 rounded-xl p-3 flex flex-col">
            <div className="flex justify-between items-start mb-3 shrink-0">
                <div className="flex items-baseline gap-3">
                    {isKospi ? (
                        <h3 className="font-bold text-blue-400 text-lg">{displayTitle}</h3>
                    ) : (
                        <div className="flex items-center gap-2">
                            {isEditing ? (
                                <form onSubmit={handleSearch} className="flex items-center">
                                    <input
                                        autoFocus
                                        type="text"
                                        value={searchInput}
                                        onChange={(e) => setSearchInput(e.target.value)}
                                        className="bg-black/50 border border-white/20 rounded px-2 py-1 text-sm text-white w-24 outline-none focus:border-emerald-500"
                                        placeholder="종목코드/명"
                                        onBlur={() => setIsEditing(false)}
                                    />
                                </form>
                            ) : (
                                <h3 className="font-bold text-gray-200 text-lg cursor-pointer hover:text-white transition-colors flex items-center" onClick={() => setIsEditing(true)}>
                                    {displayTitle} <Search className="w-4 h-4 inline-block ml-1 opacity-50" />
                                </h3>
                            )}
                        </div>
                    )}

                    {loading ? (
                        <p className="text-xl font-black text-gray-500">...</p>
                    ) : (
                        <p className="text-2xl font-black text-white">{currentVal.toFixed(1)}x</p>
                    )}
                </div>
            </div>
            <div className="w-full mt-2" style={{ height: '180px' }}>
                {!loading && data.length > 0 && (
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={data} margin={{ top: 5, right: 0, left: -25, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                            <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#666' }} tickLine={false} axisLine={false} tickMargin={8} />

                            <YAxis yAxisId="left" domain={['auto', 'auto']} tick={{ fontSize: 10, fill: '#666' }} tickLine={false} axisLine={false} width={45} />
                            <YAxis yAxisId="right" orientation="right" domain={['auto', 'auto']} tick={{ fontSize: 9, fill: '#666' }} tickLine={false} axisLine={false} width={50} tickFormatter={(val) => Math.round(val).toLocaleString()} />

                            <RechartsTooltip
                                contentStyle={{ backgroundColor: 'rgba(0,0,0,0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                                content={({ active, payload, label }) => {
                                    if (active && payload && payload.length) {
                                        const sortedPayload = [...payload].sort((a: any, b: any) => getNormPer(b.dataKey, b.value) - getNormPer(a.dataKey, a.value));
                                        const isLast = payload[0]?.payload === data[data.length - 1];
                                        const displayLabel = `${label} ${isLast ? '(최근/전일)' : ''}`;
                                        return (
                                            <div className="bg-black/90 border border-white/10 p-2 rounded-lg text-[11px]">
                                                <p className="text-gray-400 mb-1">{displayLabel}</p>
                                                {sortedPayload.map((entry: any, index: number) => (
                                                    <div key={`item-${index}`} className="flex items-center gap-2 mb-0.5 font-medium" style={{ color: entry.color }}>
                                                        <span>{entry.name} :</span>
                                                        <span>{entry.name === 'P/E' ? `${entry.value.toFixed(1)}x` : `${Math.round(entry.value).toLocaleString()}${isKospi ? 'pt' : '원'}`}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        );
                                    }
                                    return null;
                                }}
                            />
                            <Line yAxisId="left" type="monotone" name="P/E" dataKey="val" stroke={isKospi ? '#34d399' : '#a1a1aa'} strokeWidth={2} dot={false} activeDot={{ r: 5 }} />
                            <Line yAxisId="right" type="monotone" name={isKospi ? "KOSPI" : "주가"} dataKey="price" stroke="#60a5fa" strokeWidth={1.5} strokeDasharray="4 4" dot={false} activeDot={false} />
                        </LineChart>
                    </ResponsiveContainer>
                )}
            </div>
        </div>
    );
}

export function CliModalContent() {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchCli = async () => {
            try {

                const res = await fetch(`${API_BASE}/api/v1/exit-signal/cli`);
                if (res.ok) {
                    const json = await res.json();
                    setData(json);
                }
            } catch (err) {
                console.error("Failed to fetch CLI detail:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchCli();
    }, []);

    const getNormLeft = useVisualSort(data, ['kospi', 'kor_cli']);
    const getNormRight = useVisualSort(data, ['kor_cli', 'usa_cli', 'oecd_cli']);

    if (loading) return <div className="flex h-full items-center justify-center text-gray-500">Loading data...</div>;

    const lastData: any = data.length > 0 ? data[data.length - 1] : null;
    let analysisTitle = "💡 경제 위기 하이라이트 분석";
    let analysisText = "차트의 붉은색/회색 음영 구간은 2020년(팬데믹), 2022년(글로벌 금리 인상) 등 매크로 지표가 급격히 수축되었던 시점을 나타냅니다. 현재 한국 CLI가 과거 이 음영 구간들의 진입 시점과 유사한 각도로 꺾이고 있는지, 아니면 단순 소프트 랜딩인지 비교하여 판단하세요. 한국의 하락 추세가 미국/OECD 평균 하락과 동반된다면 강력한 주식 비중 축소 시그널입니다.";
    let bannerBgClass = "bg-indigo-900/20 border-indigo-500/20";
    let textTitleClass = "text-indigo-300";

    if (lastData) {
        const { kor_cli, usa_cli, oecd_cli } = lastData;
        const below100Count = [kor_cli, usa_cli, oecd_cli].filter(v => v !== null && v < 100).length;

        if (below100Count >= 2) {
            analysisTitle = "🚨 [수축 국면] 글로벌 매크로 하락세 뚜렷";
            analysisText = `현재 한국 CLI(\${kor_cli}), 미국 CLI(\${usa_cli}), G7(OECD 대체) 평균(\${oecd_cli}) 중 다수가 기준선(100)을 하회하며 수축 국면을 나타내고 있습니다. 과거 2020년, 2022년처럼 매크로 지표가 급격히 하락하는 시기와 유사할 가능성이 높습니다. 글로벌 동조화 하락이 뚜렷히 확인되므로 위험 자산(주식) 비중을 방어적으로 축소할 것을 강력 권고합니다.`;
            bannerBgClass = "bg-rose-900/20 border-rose-500/30";
            textTitleClass = "text-rose-400";
        } else if (below100Count === 1) {
            analysisTitle = "⚠️ [둔화 우려] 일부 특정 지표 악화 진행 중";
            analysisText = `현재 한국 CLI(\${kor_cli}), 미국 CLI(\${usa_cli}), G7(OECD 대체) 평균(\${oecd_cli}) 지표들의 방향성이 엇갈리며 일부 국가에서 경기 둔화 징후가 나타납니다. 만약 한국 CLI가 미국/G7의 하락 추세와 향후 동반적으로 꺾인다면 단기 약세장이 올 수 있으므로 다음 달 지표 발표까지 포트폴리오 리스크를 관리하세요.`;
            bannerBgClass = "bg-amber-900/20 border-amber-500/30";
            textTitleClass = "text-amber-400";
        } else if (kor_cli && usa_cli && oecd_cli) {
            analysisTitle = "✅ [확장 국면] 글로벌 경기 견조한 회복세 지속";
            analysisText = `현재 한국 CLI(\${kor_cli}), 미국 CLI(\${usa_cli}), G7(OECD 대체) 평균(\${oecd_cli}) 모두 기준선인 100 위에 위치하며 양호한 흐름을 보이고 있습니다. 경기 침체 리스크는 제한적이며, 코스피를 포함한 주식 시장 투자에 여전히 우호적인 거시경제 환경입니다. 현재의 긍정적인 추세가 꺾이기 전까지는 주식 비중 확대를 유지해도 좋습니다.`;
            bannerBgClass = "bg-emerald-900/20 border-emerald-500/30";
            textTitleClass = "text-emerald-400";
        }
    }

    return (
        <div className="flex flex-col w-full gap-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* 1. Long term KOSPI overlay */}
                <div className="bg-black/20 rounded-xl p-1 md:p-3 border border-white/5 flex flex-col">
                    <h3 className="text-white font-bold mb-3 text-center text-sm">한국 CLI vs KOSPI 10년 장기 궤적</h3>
                    <div className="w-full" style={{ height: '220px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={data} margin={{ top: 5, right: 3, left: 2, bottom: 0 }}>
                                <XAxis dataKey="year" stroke="#71717a" fontSize={10} minTickGap={20} tickMargin={8} />
                                <YAxis yAxisId="cli" domain={['auto', 'auto']} width={40} tick={{ fontSize: 10, fill: '#666' }} axisLine={false} tickLine={false} />
                                <YAxis yAxisId="kospi" orientation="right" domain={['auto', 'auto']} width={45} tick={{ fontSize: 10, fill: '#666' }} axisLine={false} tickLine={false} />
                                <RechartsTooltip
                                    contentStyle={{ backgroundColor: 'rgba(0,0,0,0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                                    content={({ active, payload, label }) => {
                                        if (active && payload && payload.length) {
                                            const sortedPayload = [...payload].sort((a: any, b: any) => getNormLeft(b.dataKey, b.value) - getNormLeft(a.dataKey, a.value));
                                            const isLast = payload[0]?.payload === data[data.length - 1];
                                            const displayLabel = `${payload[0]?.payload?.date || label} ${isLast ? '(최근/전일)' : ''}`;
                                            return (
                                                <div className="bg-black/90 border border-white/10 p-2 rounded-lg text-[12px]">
                                                    <p className="text-gray-400 mb-2">{displayLabel}</p>
                                                    {sortedPayload.map((entry: any, index: number) => (
                                                        <div key={`item-${index}`} className="flex items-center gap-2 mb-1 font-medium" style={{ color: entry.color }}>
                                                            <span>{entry.name} :</span>
                                                            <span>{entry.name === 'KOSPI' ? Math.round(entry.value).toLocaleString() + 'pt' : entry.value.toFixed(1)}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            );
                                        }
                                        return null;
                                    }}
                                />
                                <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px', color: '#aaa' }} />

                                {/* Crisis Highlights */}
                                <ReferenceArea yAxisId="cli" x1="2020-01" x2="2020-12" strokeOpacity={0} fill="#f43f5e" fillOpacity={0.15} />
                                <ReferenceArea yAxisId="cli" x1="2022-01" x2="2022-12" strokeOpacity={0} fill="#f43f5e" fillOpacity={0.15} />

                                <Line yAxisId="kospi" type="monotone" name="KOSPI" dataKey="kospi" stroke="#60a5fa" strokeWidth={2} dot={false} />
                                <Line yAxisId="cli" type="monotone" name="한국 CLI" dataKey="kor_cli" stroke="#f43f5e" strokeWidth={3} dot={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 2. Global Comparison */}
                <div className="bg-black/20 rounded-xl p-1 md:p-3 border border-white/5 flex flex-col">
                    <h3 className="text-white font-bold mb-3 text-center text-sm">글로벌 매크로 사이클 동조화 점검</h3>
                    <div className="w-full" style={{ height: '220px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={data} margin={{ top: 5, right: 3, left: 2, bottom: 0 }}>
                                <XAxis dataKey="year" stroke="#71717a" fontSize={10} minTickGap={20} tickMargin={8} />
                                <YAxis domain={['auto', 'auto']} width={40} tick={{ fontSize: 10, fill: '#666' }} axisLine={false} tickLine={false} />
                                <RechartsTooltip
                                    contentStyle={{ backgroundColor: 'rgba(0,0,0,0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                                    content={({ active, payload, label }) => {
                                        if (active && payload && payload.length) {
                                            const sortedPayload = [...payload].sort((a: any, b: any) => getNormRight(b.dataKey, b.value) - getNormRight(a.dataKey, a.value));
                                            const isLast = payload[0]?.payload === data[data.length - 1];
                                            const displayLabel = `${payload[0]?.payload?.date || label} ${isLast ? '(최근/전일)' : ''}`;
                                            return (
                                                <div className="bg-black/90 border border-white/10 p-2 rounded-lg text-[12px]">
                                                    <p className="text-gray-400 mb-2">{displayLabel}</p>
                                                    {sortedPayload.map((entry: any, index: number) => (
                                                        <div key={`item-${index}`} className="flex items-center gap-2 mb-1 font-medium" style={{ color: entry.color }}>
                                                            <span>{entry.name} :</span>
                                                            <span>{entry.value.toFixed(1)}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            );
                                        }
                                        return null;
                                    }}
                                />
                                <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px', color: '#aaa' }} />

                                <ReferenceArea x1="2020-01" x2="2020-12" strokeOpacity={0} fill="#64748b" fillOpacity={0.2} />
                                <ReferenceArea x1="2022-01" x2="2022-12" strokeOpacity={0} fill="#64748b" fillOpacity={0.2} />

                                {(() => {
                                    const lines = [
                                        { key: 'kor_cli', name: '한국 CLI', stroke: '#f43f5e', width: 3, dash: '' },
                                        { key: 'usa_cli', name: '미국 CLI', stroke: '#3b82f6', width: 2, dash: '5 5' },
                                        { key: 'oecd_cli', name: 'G7 (OECD Proxy)', stroke: '#10b981', width: 2, dash: '3 3' },
                                    ];
                                    if (lastData) {
                                        lines.sort((a, b) => (lastData[b.key] || 0) - (lastData[a.key] || 0));
                                    }
                                    return lines.map(l => (
                                        <Line key={l.key} type="monotone" name={l.name} dataKey={l.key} stroke={l.stroke} strokeWidth={l.width} strokeDasharray={l.dash || undefined} dot={false} />
                                    ));
                                })()}
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            <div className={`p-4 rounded-xl shrink-0 border transition-colors ${bannerBgClass}`}>
                <h4 className={`font-bold text-sm mb-1.5 ${textTitleClass}`}>{analysisTitle}</h4>
                <p className="text-[12px] text-gray-300 leading-relaxed">
                    {analysisText}
                </p>
            </div>
        </div>
    );
}

export function SentimentModalContent({ isFgi }: { isFgi?: boolean }) {
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [period, setPeriod] = useState<number>(60); // Default to 3M (60 business days)

    const periods = [
        { label: '1M', days: 20 },
        { label: '3M', days: 60 },
        { label: '6M', days: 120 },
        { label: '1Y', days: 250 },
        { label: '3Y', days: 750 },
    ];

    useEffect(() => {
        const fetchSentiment = async () => {
            try {

                const res = await fetch(`${API_BASE}/api/v1/exit-signal`);
                if (res.ok) {
                    const json = await res.json();
                    if (json.indicators && json.indicators.sentiment) {
                        setData(json.indicators.sentiment);
                    }
                }
            } catch (err) {
                console.error("Failed to fetch sentiment detail:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchSentiment();
    }, []);

    const displayData = data.slice(-period);
    const getNorm = useVisualSort(displayData, isFgi ? ['fgi', 'kospi', 'sp500'] : ['vix', 'kospi', 'sp500']);

    if (loading) return <div className="flex h-full items-center justify-center text-gray-500">Loading data...</div>;

    const currentVal = displayData.length > 0 ? displayData[displayData.length - 1] : null;
    const maxVix = displayData.length > 0 ? Math.max(100, ...displayData.map(d => (d.vix || 0) + 10)) : 100;

    // Fix Recharts bug where `auto` domain only considers the first line (KOSPI) and clips S&P 500.
    const rightMin = displayData.length > 0 ? Math.min(...displayData.map(d => Math.min(d.kospi || Infinity, d.sp500 || Infinity))) * 0.95 : 'auto';
    const rightMax = displayData.length > 0 ? Math.max(...displayData.map(d => Math.max(d.kospi || -Infinity, d.sp500 || -Infinity))) * 1.05 : 'auto';

    return (
        <div className="flex flex-col w-full gap-4">
            <div className="bg-black/20 rounded-xl p-1 md:p-3 border border-white/5 flex flex-col">
                <div className="flex justify-between items-center mb-2 shrink-0">
                    <div className="flex flex-col">
                        <h3 className="text-white font-bold ml-2 text-lg">
                            {isFgi ? 'Fear & Greed Index (공포탐욕지수)' : 'VIX (CBOE Volatility Index)'}
                        </h3>
                        <span className="text-xs text-gray-500 ml-2 mt-1">
                            출처: {isFgi ? 'CNN Business (Proxy by Proxy 계산)' : 'Yahoo Finance (^VIX)'}
                        </span>
                    </div>
                    <div className="flex gap-1 bg-black/40 p-1 rounded-xl shrink-0">
                        {periods.map(p => (
                            <button
                                key={p.label}
                                onClick={() => setPeriod(p.days)}
                                className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors ${period === p.days
                                    ? 'bg-indigo-500 text-white shadow-lg'
                                    : 'text-gray-400 hover:text-white hover:bg-white/10'
                                    }`}
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="w-full" style={{ height: '280px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={displayData} margin={{ top: 5, right: 3, left: 2, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                            <XAxis dataKey="date" stroke="#71717a" fontSize={10} tickMargin={8} minTickGap={30} />
                            <YAxis yAxisId="left" domain={isFgi ? [0, 100] : ['auto', 'auto']} width={40} tick={{ fontSize: 10, fill: '#666' }} axisLine={false} tickLine={false} />
                            <YAxis yAxisId="right" orientation="right" domain={[rightMin, rightMax]} width={45} tick={{ fontSize: 10, fill: '#666' }} axisLine={false} tickLine={false} tickFormatter={(val) => typeof val === 'number' ? Math.round(val).toLocaleString() : val} />
                            <RechartsTooltip
                                contentStyle={{ backgroundColor: 'rgba(0,0,0,0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                                content={({ active, payload, label }) => {
                                    if (active && payload && payload.length) {
                                        const sortedPayload = [...payload].sort((a: any, b: any) => getNorm(b.dataKey, b.value) - getNorm(a.dataKey, a.value));
                                        const isLast = payload[0]?.payload === displayData[displayData.length - 1];
                                        const displayLabel = `${label} ${isLast ? '(최근/전일)' : ''}`;
                                        return (
                                            <div className="bg-black/90 border border-white/10 p-2 rounded-lg text-[12px]">
                                                <p className="text-gray-400 mb-2">{displayLabel}</p>
                                                {sortedPayload.map((entry: any, index: number) => (
                                                    <div key={`item-${index}`} className="flex items-center gap-2 mb-1 font-medium" style={{ color: entry.color }}>
                                                        <span>{entry.name} :</span>
                                                        <span>{entry.name === 'Fear & Greed' || entry.name === 'VIX' ? entry.value.toFixed(1) : Math.round(entry.value).toLocaleString() + 'pt'}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        );
                                    }
                                    return null;
                                }}
                            />
                            <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />

                            {/* FGI Elements */}
                            {isFgi && <ReferenceArea yAxisId="left" y1={0} y2={25} strokeOpacity={0} fill="#f43f5e" fillOpacity={0.15} />}
                            {isFgi && <ReferenceArea yAxisId="left" y1={75} y2={100} strokeOpacity={0} fill="#34d399" fillOpacity={0.15} />}
                            {isFgi && <ReferenceLine yAxisId="left" y={25} stroke="#f43f5e" strokeDasharray="3 3" />}
                            {isFgi && <ReferenceLine yAxisId="left" y={75} stroke="#34d399" strokeDasharray="3 3" />}

                            {/* VIX Elements */}
                            {!isFgi && <ReferenceArea yAxisId="left" y1={0} y2={15} strokeOpacity={0} fill="#34d399" fillOpacity={0.15} />}
                            {!isFgi && <ReferenceArea yAxisId="left" y1={20} y2={maxVix} strokeOpacity={0} fill="#f43f5e" fillOpacity={0.15} />}
                            {!isFgi && <ReferenceLine yAxisId="left" y={15} stroke="#34d399" strokeDasharray="3 3" />}
                            {!isFgi && <ReferenceLine yAxisId="left" y={20} stroke="#f43f5e" strokeDasharray="3 3" />}

                            {(() => {
                                const lData = displayData.length > 0 ? displayData[displayData.length - 1] : null;
                                const lines = isFgi ? [
                                    { yAxisId: "left", name: "Fear & Greed", dataKey: "fgi", color: currentVal && currentVal.fgi < 30 ? '#f43f5e' : '#34d399', width: 3, dash: '' },
                                    { yAxisId: "right", name: "KOSPI", dataKey: "kospi", color: "#60a5fa", width: 1.5, dash: '4 4' },
                                    { yAxisId: "right", name: "S&P 500", dataKey: "sp500", color: "#c084fc", width: 1.5, dash: '4 4' },
                                ] : [
                                    { yAxisId: "left", name: "VIX", dataKey: "vix", color: currentVal && currentVal.vix >= 20 ? '#f43f5e' : '#f59e0b', width: 3, dash: '' },
                                    { yAxisId: "right", name: "KOSPI", dataKey: "kospi", color: "#60a5fa", width: 1.5, dash: '4 4' },
                                    { yAxisId: "right", name: "S&P 500", dataKey: "sp500", color: "#c084fc", width: 1.5, dash: '4 4' },
                                ];
                                if (lData) {
                                    lines.sort((a, b) => (lData[b.dataKey] || 0) - (lData[a.dataKey] || 0));
                                }
                                return lines.map(l => (
                                    <Line key={l.dataKey} yAxisId={l.yAxisId} type="monotone" name={l.name} dataKey={l.dataKey} stroke={l.color} strokeWidth={l.width} strokeDasharray={l.dash || undefined} dot={false} activeDot={l.yAxisId === 'left' ? { r: 5 } : false} />
                                ));
                            })()}
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="bg-indigo-900/20 border border-indigo-500/20 p-3 rounded-xl shrink-0">
                <h4 className="font-bold text-indigo-300 mb-2 text-xs">💡 시장 심리 가이드</h4>
                {isFgi ? (
                    <div className="flex w-full gap-2 px-2 pb-2">
                        <div className="flex-1 bg-[#1e1e24] p-3 rounded-lg border-l-4 border-rose-500/80">
                            <h5 className="font-bold text-rose-400 text-sm mb-1">0 - 25</h5>
                            <span className="text-white font-semibold text-xs mb-1 block">Extreme Fear (극단적 공포)</span>
                            <p className="text-[11px] text-gray-400 leading-tight">극단적 공포는 시장 참여자들이 지나치게 우려하고 있음을 나타내며, 이는 좋은 매수 기회가 될 수 있습니다.</p>
                        </div>
                        <div className="flex-1 bg-[#1e1e24] p-3 rounded-lg border-l-4 border-orange-400/80">
                            <h5 className="font-bold text-orange-400 text-sm mb-1">26 - 45</h5>
                            <span className="text-white font-semibold text-xs mb-1 block">Fear (공포)</span>
                            <p className="text-[11px] text-gray-400 leading-tight">일반적으로 시장의 동요를 나타냅니다.</p>
                        </div>
                        <div className="flex-1 bg-[#1e1e24] p-3 rounded-lg border-l-4 border-gray-400/80">
                            <h5 className="font-bold text-gray-400 text-sm mb-1">46 - 55</h5>
                            <span className="text-white font-semibold text-xs mb-1 block">Neutral (중립)</span>
                            <p className="text-[11px] text-gray-400 leading-tight">정상적인 시장 환경을 나타냅니다.</p>
                        </div>
                        <div className="flex-1 bg-[#1e1e24] p-3 rounded-lg border-l-4 border-emerald-400/80">
                            <h5 className="font-bold text-emerald-400 text-sm mb-1">56 - 75</h5>
                            <span className="text-white font-semibold text-xs mb-1 block">Greed (탐욕)</span>
                            <p className="text-[11px] text-gray-400 leading-tight">시장이 긍정적인 추세를 보이고 있음을 나타냅니다.</p>
                        </div>
                        <div className="flex-1 bg-[#1e1e24] p-3 rounded-lg border-l-4 border-emerald-500/80">
                            <h5 className="font-bold text-emerald-500 text-sm mb-1">76 - 100</h5>
                            <span className="text-white font-semibold text-xs mb-1 block">Extreme Greed (극단적 탐욕)</span>
                            <p className="text-[11px] text-gray-400 leading-tight">투자자들이 지나치게 탐욕스러워졌을 때(극단적 탐욕) 시장이 조정(하락)을 겪을 가능성을 경고합니다.</p>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col gap-2">
                        <p className="text-[11px] text-indigo-100/80 leading-tight text-justify">
                            내재변동성은 일반적으로 시장이 불안정하거나 경제가 흔들릴 때 증가합니다. 이와 대조적으로 주가가 상승하고 있고 극적인 변화가 없을 것 같으면 VIX는 하락하거나 범위의 하단에서 안정을 유지하는 경향이 있습니다. 즉, VIX는 주가와 음의 상관관계를 갖습니다.
                        </p>
                        <div className="flex w-full gap-2">
                            <div className="flex-1 bg-[#1e1e24] p-3 rounded-lg border-l-4 border-emerald-500/80">
                                <h5 className="font-bold text-emerald-500 text-sm mb-1">0 - 15</h5>
                                <span className="text-white font-semibold text-xs mb-1 block">낮은 수준 (안정)</span>
                                <p className="text-[11px] text-gray-400 leading-tight">일반적으로 시장의 낙관론을 나타냅니다.</p>
                            </div>
                            <div className="flex-1 bg-[#1e1e24] p-3 rounded-lg border-l-4 border-gray-400/80">
                                <h5 className="font-bold text-gray-400 text-sm mb-1">15 - 20</h5>
                                <span className="text-white font-semibold text-xs mb-1 block">보통 수준</span>
                                <p className="text-[11px] text-gray-400 leading-tight">일반적으로 정상적인 시장 환경을 나타냅니다.</p>
                            </div>
                            <div className="flex-1 bg-[#1e1e24] p-3 rounded-lg border-l-4 border-orange-400/80">
                                <h5 className="font-bold text-orange-400 text-sm mb-1">20 - 25</h5>
                                <span className="text-white font-semibold text-xs mb-1 block">중간 (경계)</span>
                                <p className="text-[11px] text-gray-400 leading-tight">일반적으로 시장에서 우려가 커지고 있음을 나타냅니다.</p>
                            </div>
                            <div className="flex-1 bg-[#1e1e24] p-3 rounded-lg border-l-4 border-rose-400/80">
                                <h5 className="font-bold text-rose-400 text-sm mb-1">25 - 30</h5>
                                <span className="text-white font-semibold text-xs mb-1 block">높은 수준 (공포)</span>
                                <p className="text-[11px] text-gray-400 leading-tight">일반적으로 시장의 동요를 나타냅니다.</p>
                            </div>
                            <div className="flex-1 bg-[#1e1e24] p-3 rounded-lg border-l-4 border-rose-600/80">
                                <h5 className="font-bold text-rose-600 text-sm mb-1">&gt; 30+</h5>
                                <span className="text-white font-semibold text-xs mb-1 block">매우 높은 수준 (극심한 공포)</span>
                                <p className="text-[11px] text-gray-400 leading-tight">일반적으로 시장에 극심한 혼란이 있음을 나타냅니다.</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
