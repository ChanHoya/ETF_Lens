import { useState, useMemo } from 'react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useEtfData(slots: { search: string, code: string }[], period: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [isLoadingHoldings, setIsLoadingHoldings] = useState(false);
    const [isLoadingChart, setIsLoadingChart] = useState(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [selectedDetailEtf, setSelectedDetailEtf] = useState<any>(null);

    const fetchComparison = async () => {
        const validCodes = slots.filter(s => s.code).map(s => s.code);
        if (validCodes.length < 2) {
            alert("비교를 위해 최소 2개 이상의 ETF를 선택해주세요.");
            return;
        }

        setLoading(true);
        setIsLoadingHoldings(true);
        setIsLoadingChart(true);
        setData(null);

        const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

        try {
            // 1. Fetch Fast Basic Info
            const compareRes = await fetch(`${API_BASE}/api/v1/analyze/compare`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ etf_codes: validCodes, skip_holdings: true, skip_chart: true })
            });
            if (!compareRes.ok) throw new Error("분석 요청 실패");
            const compareData = await compareRes.json();
            setData(compareData); // Set fast data first

            // 2. Fetch Holdings Asynchronously
            fetch(`${API_BASE}/api/v1/analyze/compare/holdings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ etf_codes: validCodes })
            })
                .then(res => res.json())
                .then(holdingsData => {
                    setData((prev: any) => ({
                        ...prev,
                        data_payload: {
                            ...(prev?.data_payload || {}),
                            holdings: holdingsData.holdings
                        }
                    }));
                })
                .catch(err => console.error("Holdings fetch error:", err))
                .finally(() => setIsLoadingHoldings(false));

            // 3. Fetch Heavy Chart Asynchronously
            fetch(`${API_BASE}/api/v1/analyze/compare/chart`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ etf_codes: validCodes })
            })
                .then(res => res.json())
                .then(chartData => {
                    setData((prev: any) => ({
                        ...prev,
                        visual_data: {
                            ...(prev?.visual_data || {}),
                            line_chart: chartData.line_chart_data,
                            etf_keys: chartData.etf_keys
                        }
                    }));
                })
                .catch(err => console.error("Chart fetch error:", err))
                .finally(() => setIsLoadingChart(false));

        } catch (err: any) {
            alert(err.message);
        } finally {
            setLoading(false);
        }
    };

    const chartData = useMemo(() => {
        if (!data?.visual_data?.line_chart || !data?.visual_data?.etf_keys) return [];

        let rawData = data.visual_data.line_chart;

        if (rawData.length > 0) {
            const lastDate = new Date(rawData[rawData.length - 1].date);
            const cutoffDate = new Date(lastDate);

            switch (period) {
                case '1M': cutoffDate.setMonth(cutoffDate.getMonth() - 1); break;
                case '3M': cutoffDate.setMonth(cutoffDate.getMonth() - 3); break;
                case '6M': cutoffDate.setMonth(cutoffDate.getMonth() - 6); break;
                case '1Y': cutoffDate.setFullYear(cutoffDate.getFullYear() - 1); break;
                case '3Y': cutoffDate.setFullYear(cutoffDate.getFullYear() - 3); break;
                case '10Y': cutoffDate.setFullYear(cutoffDate.getFullYear() - 10); break;
                case '1W': cutoffDate.setDate(cutoffDate.getDate() - 7); break;
                case '1D': cutoffDate.setDate(cutoffDate.getDate() - 2); break; // Fetch a few days back to ensure we have a valid prev close
            }

            const cutoffStr = cutoffDate.toISOString().split('T')[0];
            rawData = rawData.filter((d: any) => d.date >= cutoffStr);
        }

        if (rawData.length === 0) return [];

        const basePrices: Record<string, number> = {};
        const keys = data.visual_data.etf_keys;
        keys.forEach((key: string) => {
            const firstValid = rawData.find((d: any) => d[key] != null);
            if (firstValid) {
                basePrices[key] = firstValid[key];
            }
        });

        const benchKeys = ['KOSPI', 'KOSDAQ', 'SP500', 'NASDAQ'];
        benchKeys.forEach((key: string) => {
            const firstValid = rawData.find((d: any) => d[key] != null);
            if (firstValid) {
                basePrices[key] = firstValid[key];
            }
        });

        let baseMappedData = rawData.map((d: any) => {
            const newPoint: Record<string, any> = { date: d.date };
            const allKeys = [...keys, ...benchKeys];
            allKeys.forEach((key: string) => {
                const currentRaw = d[key] != null ? Number(d[key]) : null;

                if (period === '1W') {
                    const fullIdx = data.visual_data.line_chart.findIndex((x: any) => x.date === d.date);
                    const prevRawObject = fullIdx > 0 ? data.visual_data.line_chart[fullIdx - 1] : null;
                    const prevRaw = prevRawObject ? prevRawObject[key] : currentRaw;

                    newPoint[`${key}_raw`] = currentRaw;
                    if (prevRaw && currentRaw) {
                        newPoint[key] = Number(((currentRaw / prevRaw - 1) * 100).toFixed(2));
                    } else {
                        newPoint[key] = 0;
                    }
                } else {
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
                const startVal = lastValidObj[`${k}_raw`] || 10000;
                states[k] = startVal;
                baseStates[k] = startVal;
            });

            while (currentTime <= endTime) {
                const pt: Record<string, any> = { date: currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
                keys.forEach((k: string) => {
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

    const simulatedChartData = useMemo(() => {
        if (chartData.length === 0 || !data?.visual_data?.etf_keys) return [];

        const keys = data.visual_data.etf_keys;
        const currentSimState: any = {};

        keys.forEach((k: string, idx: number) => {
            currentSimState[k] = {
                inflow: (idx + 1) * 200,
                dividend: Math.max(0.5, 2.5 + (Math.random() - 0.5) * 2)
            };
        });

        return chartData.map((d: any, i: number) => {
            const newPoint: any = { date: d.date };
            keys.forEach((key: string) => {
                if (i > 0) {
                    const currentRaw = d[`${key}_raw`];
                    const prevRaw = chartData[i - 1][`${key}_raw`];
                    const priceChangeRatio = (currentRaw && prevRaw) ? ((currentRaw - prevRaw) / prevRaw) : 0;
                    currentSimState[key].inflow += (priceChangeRatio * 1000) + (Math.random() - 0.45) * 15;
                    currentSimState[key].dividend -= (priceChangeRatio * 1.5) + (Math.random() - 0.5) * 0.05;
                }

                newPoint[`${key}_inflow`] = Number(Math.max(0, currentSimState[key].inflow).toFixed(0));
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

        const rawChart = data?.visual_data?.line_chart || [];
        const etfKey = selectedDetailEtf.etf_name;
        const isKosdaq = etfKey.toUpperCase().includes('코스닥') || etfKey.toUpperCase().includes('KOSDAQ');
        const isNasdaq = etfKey.toUpperCase().includes('나스닥') || etfKey.toUpperCase().includes('NASDAQ');
        const isSP500 = etfKey.toUpperCase().includes('S&P') || etfKey.toUpperCase().includes('S&P500') || etfKey.includes('미국배당');
        const isUS = etfKey.includes('미국') || isNasdaq || isSP500;

        let benchmarkName = 'to KOSPI(좌)';
        let benchKey = 'KOSPI';

        if (isNasdaq) { benchmarkName = 'to NASDAQ(좌)'; benchKey = 'NASDAQ'; }
        else if (isSP500) { benchmarkName = 'to S&P500(좌)'; benchKey = 'SP500'; }
        else if (isKosdaq) { benchmarkName = 'to KOSDAQ(좌)'; benchKey = 'KOSDAQ'; }
        else if (isUS) { benchmarkName = 'to S&P500(좌)'; benchKey = 'SP500'; }

        if (rawChart.length > 0) {
            let filteredChart = rawChart;
            if (popupPeriod === '1Y') {
                const ld = new Date(rawChart[rawChart.length - 1].date);
                ld.setFullYear(ld.getFullYear() - 1);
                filteredChart = rawChart.filter((d: any) => d.date >= ld.toISOString().split('T')[0]);
            } else if (popupPeriod === '3M') {
                const ld = new Date(rawChart[rawChart.length - 1].date);
                ld.setMonth(ld.getMonth() - 3);
                filteredChart = rawChart.filter((d: any) => d.date >= ld.toISOString().split('T')[0]);
            }

            if (filteredChart.length > 0) {
                const firstValidBench = filteredChart.find((d: any) => d[benchKey] != null);
                const baseBench = firstValidBench ? firstValidBench[benchKey] : null;

                const firstValidPrice = filteredChart.find((d: any) => d[etfKey] != null);
                const basePrice = firstValidPrice ? firstValidPrice[etfKey] : null;

                filteredChart.forEach((d: any, idx: number) => {
                    const currentPrice = d[etfKey] != null ? Number(d[etfKey]) : null;
                    const pr = d[benchKey] != null && baseBench ? Number(((d[benchKey] / baseBench - 1) * 100).toFixed(2)) : 0;
                    const etfPr = currentPrice && basePrice ? Number(((currentPrice / basePrice - 1) * 100).toFixed(2)) : 0;

                    const randomNavNoise = currentPrice ? currentPrice * (1 + (Math.random() - 0.5) * 0.005) : null;
                    navData.push({ date: d.date, nav: randomNavNoise ? Number(randomNavNoise.toFixed(0)) : null, price: currentPrice, rel_yield: pr, etf_yield: etfPr });

                    const baseVol = 100000 + Math.random() * 500000;
                    const spikeMultiplier = Math.random() > 0.9 ? 3 : 1;
                    volData.push({ date: d.date, value: Math.floor(baseVol * spikeMultiplier), price: currentPrice });

                    priceData.push({
                        date: d.date,
                        price: currentPrice,
                        rel_yield: pr,
                        etf_yield: etfPr
                    });
                });
            }
        }

        return { nav: navData, vol: volData, price: priceData, benchmarkName };
    }, [selectedDetailEtf, data, popupPeriod]);

    return {
        data,
        setData,
        loading,
        isLoadingHoldings,
        isLoadingChart,
        selectedDetailEtf,
        setSelectedDetailEtf,
        fetchComparison,
        chartData,
        simulatedChartData,
        detailMockData
    };
}
