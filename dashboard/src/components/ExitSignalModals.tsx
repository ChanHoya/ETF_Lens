import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, ReferenceLine, ReferenceArea } from 'recharts';
import { Search } from 'lucide-react';

export function DollarModalContent() {
    const [period, setPeriod] = useState('1Y');
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchMacro = async () => {
            setLoading(true);
            try {
                const res = await fetch(`http://localhost:8000/api/v1/exit-signal/macro?period=${period}`);
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

    // Filter by period (data is monthly 10Y max)
    const filteredData = React.useMemo(() => {
        if (!data || data.length === 0) return [];
        const endDt = new Date();
        const startDt = new Date();
        if (period === '6M') startDt.setMonth(startDt.getMonth() - 6);
        else if (period === '1Y') startDt.setFullYear(startDt.getFullYear() - 1);
        else if (period === '3Y') startDt.setFullYear(startDt.getFullYear() - 3);
        else if (period === '10Y') startDt.setFullYear(startDt.getFullYear() - 10);

        const sliced = data.filter((d: any) => new Date(d.date) >= startDt);
        if (sliced.length === 0) return [];

        // Base everything off 100 at the start of the period to see relative flows, finding the first valid value
        const getBase = (key: string) => {
            const validItem = sliced.find((item: any) => typeof item[key] === 'number' && item[key] > 0);
            return validItem ? validItem[key] : 0;
        };

        const baseKrw = getBase('krw');
        const baseDollar = getBase('dollar');
        const baseKospi = getBase('kospi');
        const baseSp = getBase('sp500');

        return sliced.map((d: any) => ({
            ...d,
            rawDollar: d.dollar,
            rawKrw: d.krw,
            rawKospi: d.kospi,
            rawSp500: d.sp500,
            dollar: (typeof d.dollar === 'number' && baseDollar > 0) ? parseFloat(((d.dollar / baseDollar) * 100).toFixed(2)) : null,
            krw: (typeof d.krw === 'number' && baseKrw > 0) ? parseFloat(((d.krw / baseKrw) * 100).toFixed(2)) : null,
            kospi: (typeof d.kospi === 'number' && baseKospi > 0) ? parseFloat(((d.kospi / baseKospi) * 100).toFixed(2)) : null,
            sp500: (typeof d.sp500 === 'number' && baseSp > 0) ? parseFloat(((d.sp500 / baseSp) * 100).toFixed(2)) : null,
        })).filter((d: any) => d.dollar !== null && isFinite(d.dollar));
    }, [data, period]);

    if (loading) return <div className="flex h-full items-center justify-center text-gray-500">Loading data...</div>;

    return (
        <div className="relative flex flex-col h-full w-full min-h-[700px]">
            <div className="absolute -top-16 right-12 flex gap-2 shrink-0">
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

            <div className="w-full bg-black/20 rounded-xl p-4 border border-white/5" style={{ minHeight: '600px', flex: '1 1 auto' }}>
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={filteredData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                        <XAxis dataKey="date" stroke="#71717a" fontSize={11} tickMargin={12} />

                        <YAxis yAxisId="left" domain={['auto', 'auto']} stroke="#a1a1aa" fontSize={11} width={45} tickFormatter={(val) => Math.round(val).toString()} />
                        <YAxis yAxisId="right" orientation="right" domain={['auto', 'auto']} stroke="#a1a1aa" fontSize={11} width={45} tickFormatter={(val) => Math.round(val).toString()} />

                        <RechartsTooltip
                            contentStyle={{ backgroundColor: 'rgba(0,0,0,0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                            itemStyle={{ fontSize: '12px' }}
                            formatter={(value: any, name: any, props: any) => {
                                if (!props || !props.payload) return [value, name];
                                if (name === '달러 인덱스') return [props.payload.rawDollar?.toFixed(2), '달러 인덱스'];
                                if (name === 'USD/KRW') return [`${Math.round(props.payload.rawKrw || 0).toLocaleString()}원`, 'USD/KRW'];
                                if (name === 'KOSPI') return [Math.round(props.payload.rawKospi || 0).toLocaleString(), 'KOSPI'];
                                if (name === 'S&P 500') return [Math.round(props.payload.rawSp500 || 0).toLocaleString(), 'S&P 500'];
                                return [value, name];
                            }}
                            labelStyle={{ color: '#aaa', marginBottom: '8px', fontSize: '12px' }}
                        />

                        <Line yAxisId="left" connectNulls type="monotone" name="달러 인덱스" dataKey="dollar" stroke="#34d399" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
                        <Line yAxisId="left" connectNulls type="stepAfter" name="USD/KRW" dataKey="krw" stroke="#60a5fa" strokeWidth={2} strokeDasharray="4 4" dot={false} activeDot={{ r: 6 }} />
                        <Line yAxisId="right" connectNulls type="monotone" name="KOSPI" dataKey="kospi" stroke="#f43f5e" strokeWidth={1.5} dot={false} />
                        <Line yAxisId="right" connectNulls type="monotone" name="S&P 500" dataKey="sp500" stroke="#a78bfa" strokeWidth={1.5} dot={false} />
                    </LineChart>
                </ResponsiveContainer>
            </div>

            <div className="mt-4 flex flex-wrap gap-4 text-sm text-gray-400 justify-center">
                <div className="flex items-center gap-2"><div className="w-3 h-3 bg-emerald-400 rounded-sm"></div> 달러 인덱스</div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 border-2 border-blue-400 border-dashed rounded-sm"></div> 원/달러 환율</div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 bg-rose-400 rounded-sm"></div> KOSPI</div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 bg-purple-400 rounded-sm"></div> S&P 500</div>
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
        <div className="w-full flex-1 flex flex-col space-y-4 min-h-[500px]">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <PerMiniChart title="KOSPI (기준 지수)" isKospi={true} />
                <PerMiniChart title={defaultStocks[0].name} symbol={defaultStocks[0].id} />
                <PerMiniChart title={defaultStocks[1].name} symbol={defaultStocks[1].id} />
                <PerMiniChart title={defaultStocks[2].name} symbol={defaultStocks[2].id} />
            </div>
            <p className="text-xs text-gray-500 text-center mt-4">KOSPI 주요 종목별 1년 포워드 PER 궤적입니다.</p>
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
                    const res = await fetch('http://localhost:8000/api/v1/exit-signal');
                    const json = await res.json();
                    if (json.indicators && json.indicators.per) {
                        setData(json.indicators.per);
                    }
                } else if (currentSymbol) {
                    const res = await fetch(`http://localhost:8000/api/v1/exit-signal/pe?symbol=${currentSymbol}`);
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

    return (
        <div className="bg-white/[0.03] border border-white/5 rounded-xl p-4 flex flex-col h-[230px]">
            <div className="flex justify-between items-start mb-2 shrink-0">
                <div className="flex flex-col">
                    {isKospi ? (
                        <h3 className="font-bold text-blue-400">{displayTitle}</h3>
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
                                <h3 className="font-bold text-gray-200 cursor-pointer hover:text-white transition-colors" onClick={() => setIsEditing(true)}>
                                    {displayTitle} <Search className="w-3 h-3 inline-block ml-1 opacity-50" />
                                </h3>
                            )}
                        </div>
                    )}

                    {loading ? (
                        <p className="text-lg font-black text-gray-500 mt-1">...</p>
                    ) : (
                        <p className="text-2xl font-black text-white mt-1">{currentVal.toFixed(1)}x</p>
                    )}
                </div>
            </div>
            <div className="flex-1 w-full min-h-[0px] mt-2">
                {!loading && data.length > 0 && (
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={data} margin={{ top: 5, right: 0, left: -20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                            <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#666' }} tickLine={false} axisLine={false} tickMargin={8} />

                            <YAxis yAxisId="left" domain={['auto', 'auto']} tick={{ fontSize: 10, fill: '#666' }} tickLine={false} axisLine={false} width={45} />
                            <YAxis yAxisId="right" orientation="right" domain={['auto', 'auto']} tick={{ fontSize: 9, fill: '#666' }} tickLine={false} axisLine={false} width={50} tickFormatter={(val) => Math.round(val).toLocaleString()} />

                            <RechartsTooltip
                                contentStyle={{ backgroundColor: 'rgba(0,0,0,0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                                itemStyle={{ fontSize: '12px', color: '#fff' }}
                                formatter={(value: any, name: any) => {
                                    if (name === 'P/E') return [`${value}x`, 'P/E'];
                                    return [Math.round(value).toLocaleString(), 'Price'];
                                }}
                                labelStyle={{ color: '#aaa', marginBottom: '4px' }}
                            />
                            <Line yAxisId="left" type="monotone" name="P/E" dataKey="val" stroke={isKospi ? '#60a5fa' : '#a1a1aa'} strokeWidth={2} dot={false} activeDot={{ r: 5 }} />
                            <Line yAxisId="right" type="stepAfter" name="Price" dataKey="price" stroke="#f43f5e" strokeWidth={1} dot={false} strokeDasharray="3 3" />
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
                const res = await fetch('http://localhost:8000/api/v1/exit-signal/cli');
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

    if (loading) return <div className="flex h-full items-center justify-center text-gray-500">Loading data...</div>;

    return (
        <div className="flex flex-col h-full w-full gap-6 min-h-[500px]">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[400px]">
                {/* 1. Long term KOSPI overlay */}
                <div className="bg-black/20 rounded-xl p-4 border border-white/5 flex flex-col">
                    <h3 className="text-white font-bold mb-4 text-center">한국 CLI vs KOSPI 10년 장기 궤적</h3>
                    <div className="flex-1 w-full relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                                <XAxis dataKey="year" stroke="#71717a" fontSize={10} minTickGap={20} tickMargin={8} />
                                <YAxis yAxisId="cli" domain={['auto', 'auto']} width={40} tick={{ fontSize: 10, fill: '#666' }} axisLine={false} tickLine={false} />
                                <YAxis yAxisId="kospi" orientation="right" domain={['auto', 'auto']} width={45} tick={{ fontSize: 10, fill: '#666' }} axisLine={false} tickLine={false} />
                                <RechartsTooltip contentStyle={{ backgroundColor: 'rgba(0,0,0,0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} itemStyle={{ color: '#fff', fontSize: '12px' }} formatter={(val, name) => [val, name === 'kor_cli' ? '한국 CLI' : 'KOSPI']} />

                                {/* Crisis Highlights */}
                                <ReferenceArea yAxisId="cli" x1="2020-01" x2="2020-12" strokeOpacity={0} fill="#f43f5e" fillOpacity={0.15} />
                                <ReferenceArea yAxisId="cli" x1="2022-01" x2="2022-12" strokeOpacity={0} fill="#f43f5e" fillOpacity={0.15} />

                                <Line yAxisId="cli" type="monotone" name="한국 CLI" dataKey="kor_cli" stroke="#f43f5e" strokeWidth={3} dot={false} />
                                <Line yAxisId="kospi" type="monotone" name="KOSPI" dataKey="kospi" stroke="#60a5fa" strokeWidth={2} dot={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 2. Global Comparison */}
                <div className="bg-black/20 rounded-xl p-4 border border-white/5 flex flex-col">
                    <h3 className="text-white font-bold mb-4 text-center">글로벌 매크로 사이클 동조화 점검</h3>
                    <div className="flex-1 w-full relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                                <XAxis dataKey="year" stroke="#71717a" fontSize={10} minTickGap={20} tickMargin={8} />
                                <YAxis domain={['auto', 'auto']} width={40} tick={{ fontSize: 10, fill: '#666' }} axisLine={false} tickLine={false} />
                                <RechartsTooltip contentStyle={{ backgroundColor: 'rgba(0,0,0,0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} itemStyle={{ color: '#fff', fontSize: '12px' }} formatter={(val, name) => [val, name === 'kor_cli' ? '한국 CLI' : (name === 'usa_cli' ? '미국 CLI' : 'OECD (Proxy)')]} />

                                <ReferenceArea x1="2020-01" x2="2020-12" strokeOpacity={0} fill="#64748b" fillOpacity={0.2} />
                                <ReferenceArea x1="2022-01" x2="2022-12" strokeOpacity={0} fill="#64748b" fillOpacity={0.2} />

                                <Line type="monotone" name="한국 CLI" dataKey="kor_cli" stroke="#f43f5e" strokeWidth={3} dot={false} />
                                <Line type="monotone" name="미국 CLI" dataKey="usa_cli" stroke="#3b82f6" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                                <Line type="monotone" name="OECD (Proxy)" dataKey="oecd_cli" stroke="#10b981" strokeWidth={2} strokeDasharray="3 3" dot={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            <div className="bg-indigo-900/20 border border-indigo-500/20 p-4 rounded-xl">
                <h4 className="font-bold text-indigo-300 mb-2">💡 경제 위기 하이라이트 분석</h4>
                <p className="text-sm text-indigo-100/80 leading-relaxed">
                    차트의 붉은색/회색 음영 구간은 2020년(팬데믹), 2022년(글로벌 금리 인상) 등 매크로 지표가 급격히 수축되었던 시점을 나타냅니다. 현재 한국 CLI가 과거 이 음영 구간들의 진입 시점과 유사한 각도로 꺾이고 있는지, 아니면 단순 소프트 랜딩인지 비교하여 판단하세요. 한국의 하락 추세가 미국/OECD 평균 하락과 동반된다면 강력한 주식 비중 축소 시그널입니다.
                </p>
            </div>
        </div>
    );
}

export function SentimentModalContent({ isFgi }: { isFgi?: boolean }) {
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchSentiment = async () => {
            try {
                const res = await fetch('http://localhost:8000/api/v1/exit-signal');
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

    if (loading) return <div className="flex h-full items-center justify-center text-gray-500">Loading data...</div>;

    const currentVal = data.length > 0 ? data[data.length - 1] : null;
    const maxVix = data.length > 0 ? Math.max(100, ...data.map(d => (d.vix || 0) + 10)) : 100;

    return (
        <div className="flex flex-col h-full w-full gap-6 min-h-[500px]">
            <div className="bg-black/20 rounded-xl p-4 border border-white/5 flex flex-col h-[400px]">
                <h3 className="text-white font-bold mb-4 text-center">최근 30영업일 {isFgi ? '공포/탐욕 지수' : 'VIX (변동성 지수)'} 궤적</h3>
                <div className="flex-1 w-full relative">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={data} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                            <XAxis dataKey="date" stroke="#71717a" fontSize={10} tickMargin={8} />
                            <YAxis yAxisId="left" domain={isFgi ? [0, 100] : ['auto', 'auto']} width={40} tick={{ fontSize: 10, fill: '#666' }} axisLine={false} tickLine={false} />
                            <RechartsTooltip
                                contentStyle={{ backgroundColor: 'rgba(0,0,0,0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                                itemStyle={{ color: '#fff', fontSize: '12px' }}
                                formatter={(val: any, name: any) => [val, name === 'vix' ? 'VIX' : 'Fear & Greed']}
                            />

                            {/* FGI Elements */}
                            {isFgi && <ReferenceArea yAxisId="left" y1={0} y2={25} strokeOpacity={0} fill="#f43f5e" fillOpacity={0.15} />}
                            {isFgi && <ReferenceArea yAxisId="left" y1={75} y2={100} strokeOpacity={0} fill="#34d399" fillOpacity={0.15} />}
                            {isFgi && <ReferenceLine yAxisId="left" y={25} stroke="#f43f5e" strokeDasharray="3 3" />}
                            {isFgi && <ReferenceLine yAxisId="left" y={75} stroke="#34d399" strokeDasharray="3 3" />}
                            {isFgi && <Line yAxisId="left" type="monotone" name="fgi" dataKey="fgi" stroke={currentVal && currentVal.fgi < 30 ? '#f43f5e' : '#34d399'} strokeWidth={3} dot={{ r: 2, fill: '#121217' }} activeDot={{ r: 5 }} />}

                            {/* VIX Elements */}
                            {!isFgi && <ReferenceArea yAxisId="left" y1={0} y2={15} strokeOpacity={0} fill="#34d399" fillOpacity={0.15} />}
                            {!isFgi && <ReferenceArea yAxisId="left" y1={20} y2={maxVix} strokeOpacity={0} fill="#f43f5e" fillOpacity={0.15} />}
                            {!isFgi && <ReferenceLine yAxisId="left" y={15} stroke="#34d399" strokeDasharray="3 3" />}
                            {!isFgi && <ReferenceLine yAxisId="left" y={20} stroke="#f43f5e" strokeDasharray="3 3" />}
                            {!isFgi && <Line yAxisId="left" type="monotone" name="vix" dataKey="vix" stroke={currentVal && currentVal.vix >= 20 ? '#f43f5e' : '#f59e0b'} strokeWidth={3} dot={{ r: 2, fill: '#121217' }} activeDot={{ r: 5 }} />}
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="bg-indigo-900/20 border border-indigo-500/20 p-4 rounded-xl">
                <h4 className="font-bold text-indigo-300 mb-2">💡 시장 단기 방향성 점검</h4>
                <p className="text-sm text-indigo-100/80 leading-relaxed">
                    {isFgi
                        ? "공포/탐욕 지수는 0~100 사이로 산출됩니다. 25 미만(붉은 음영)은 시장에 극단적 공포가 만연하여 단기 과매도(매수 기회) 상태일 수 있음을, 75 초과(녹색 음영)는 극단적 탐욕으로 단기 과매수(매도/현금화 경고) 상태임을 시사합니다."
                        : "VIX(변동성 지수)는 시장의 단기 가격 변동 위험을 나타냅니다. 통상 15 미만(녹색 음영)은 안정장, 20 초과(붉은 음영)는 공포장 진입을 뜻합니다. 급격한 기울기로 20을 돌파 시 즉각적인 보유선 축소가 요구됩니다."}
                </p>
            </div>
        </div>
    );
}
