import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, ReferenceLine, ReferenceArea } from 'recharts';
import { Search } from 'lucide-react';

export function DollarModalContent() {
    const [period, setPeriod] = useState('1Y');
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchMacro = async () => {
            try {
                const res = await fetch('http://localhost:8000/api/v1/exit-signal/macro');
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
    }, []);

    // Filter by period (data is monthly 10Y max)
    const filteredData = React.useMemo(() => {
        if (!data || data.length === 0) return [];
        let months = 12;
        if (period === '6M') months = 6;
        if (period === '1Y') months = 12;
        if (period === '3Y') months = 36;
        if (period === '10Y') months = 120;

        const sliced = data.slice(-months);
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
                        <Line yAxisId="left" connectNulls type="monotone" name="KOSPI" dataKey="kospi" stroke="#f43f5e" strokeWidth={1.5} dot={false} />
                        <Line yAxisId="left" connectNulls type="monotone" name="S&P 500" dataKey="sp500" stroke="#a78bfa" strokeWidth={1.5} dot={false} />
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
            // For MVP, just assume the input is a 6-digit symbol. In real app, we'd search by name.
            let s = searchInput.trim();
            // Basic naive fallback - if they type a name, just use a dummy code or mapping
            if (isNaN(Number(s))) {
                setDisplayTitle(s);
                s = "005930"; // Dummy fallback to Samsung if not a number
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
                        <LineChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                            <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#666' }} tickLine={false} axisLine={false} tickMargin={8} />
                            <YAxis domain={['auto', 'auto']} hide />
                            <RechartsTooltip
                                contentStyle={{ backgroundColor: 'rgba(0,0,0,0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                                itemStyle={{ fontSize: '12px', color: '#fff' }}
                                formatter={(value: any) => [`${value}x`, 'P/E']}
                                labelStyle={{ color: '#aaa', marginBottom: '4px' }}
                            />
                            <Line type="monotone" name="P/E" dataKey="val" stroke={isKospi ? '#60a5fa' : '#a1a1aa'} strokeWidth={2} dot={{ r: 2, fill: '#121217' }} activeDot={{ r: 5 }} />
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
