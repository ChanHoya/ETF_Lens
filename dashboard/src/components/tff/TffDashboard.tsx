'use client';

import { useState, useEffect, useRef } from 'react';
import { UploadCloud, Loader2, FileSpreadsheet, Trash2, History, ArrowLeftRight, X } from 'lucide-react';
import { TffFundData } from '../../lib/tff/types';
import { parseTffExcel } from '../../lib/tff/excelParser';
import { getTffRecords, saveTffRecord, deleteTffRecord, clearAllTffRecords, TffDbRecord } from '../../lib/tff/db';
import CumulativeView from './views/CumulativeView';
import AssetsView from './views/AssetsView';
import PortfolioDetailView from './views/PortfolioDetailView';
import OverviewView from './views/OverviewView';
import YtmView from './views/YtmView';
import MonthlyView from './views/MonthlyView';

const LOCAL_STORAGE_KEY = 'tff_fund_data';

interface Props {
    onOpenDetail?: (code: string) => void;
}

export default function TffDashboard({ onOpenDetail }: Props) {
    const [fundData, setFundData] = useState<TffFundData | null>(null);
    const [rawLog, setRawLog] = useState<any>(null); // 디버깅용 엑셀 원본 JSON
    const [isDragging, setIsDragging] = useState(false);
    const [isParsing, setIsParsing] = useState(false);
    const [activeSubTab, setActiveSubTab] = useState<'overview'|'cumulative'|'assets'|'ytm'|'monthly'>('overview');
    const [selectedMonth, setSelectedMonth] = useState<string>(''); // For monthly view filter
    const fileInputRef = useRef<HTMLInputElement>(null);

    // IndexedDB 히스토리 관련 상태
    const [historyRecords, setHistoryRecords] = useState<TffDbRecord[]>([]);
    const [showHistory, setShowHistory] = useState(false);
    const [selectedCompareRecord, setSelectedCompareRecord] = useState<TffDbRecord | null>(null);

    const formatMoney = (val: number) => new Intl.NumberFormat('ko-KR').format(Math.round(val));

    // 히스토리 목록 불러오기
    const loadHistory = async () => {
        try {
            const records = await getTffRecords();
            setHistoryRecords(records);
            return records;
        } catch (err) {
            console.error("IndexedDB 로드 오류", err);
            return [];
        }
    };

    // 최초 로딩 시 복원 및 자동 로드
    useEffect(() => {
        const loadInitialData = async () => {
            // 1. 로컬스토리지 시도
            const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
            let activeDataLoaded = false;

            if (saved) {
                try {
                    const parsed = JSON.parse(saved);
                    setFundData(parsed.fundData);
                    setRawLog(parsed.rawSheets);
                    if (parsed.fundData && parsed.fundData.latestMonth) {
                        setSelectedMonth(parsed.fundData.latestMonth);
                    }
                    activeDataLoaded = true;
                } catch (e) {
                    console.error("로컬 스토리지 파싱 오류", e);
                }
            }

            // 2. IndexedDB 히스토리 목록 로드
            const records = await loadHistory();

            // 3. 로컬스토리지에 활성 데이터가 없고 히스토리가 존재하는 경우, 가장 최근 버전 자동 복원
            if (!activeDataLoaded && records.length > 0) {
                const latest = records[0];
                setFundData(latest.fundData);
                setRawLog(latest.rawSheets);
                if (latest.fundData && latest.fundData.latestMonth) {
                    setSelectedMonth(latest.fundData.latestMonth);
                }
                localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({
                    fundData: latest.fundData,
                    rawSheets: latest.rawSheets
                }));
            }
        };
        loadInitialData();
    }, []);

    const processFile = async (file: File) => {
        if (!file.name.endsWith('.xlsx')) {
            alert('엑셀 파일(.xlsx)만 업로드 가능합니다.');
            return;
        }

        setIsParsing(true);
        try {
            const buffer = await file.arrayBuffer();
            // 파싱 로직 호출 (클라이언트 브라우저)
            const { data, rawSheets } = parseTffExcel(buffer);
            
            // 로컬 스토리지에 캐싱
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({ fundData: data, rawSheets }));
            
            // IndexedDB 영속화 저장
            const now = new Date();
            const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
            
            await saveTffRecord({
                fileName: file.name,
                parsedAt: formattedDate,
                fundData: data,
                rawSheets: rawSheets
            });

            // 히스토리 리로드
            await loadHistory();

            setFundData(data);
            setRawLog(rawSheets);
            if (data.latestMonth) setSelectedMonth(data.latestMonth);
        } catch (error) {
            console.error(error);
            alert('엑셀 파일을 읽는 중 오류가 발생했습니다.');
        } finally {
            setIsParsing(false);
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const files = e.dataTransfer.files;
        if (files && files.length > 0) processFile(files[0]);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files && files.length > 0) processFile(files[0]);
    };

    const handleClearData = () => {
        if (confirm('저장된 대시보드 데이터를 지우고 다시 업로드하시겠습니까?\n(로컬 스토리지 캐시만 지워지며 IndexedDB 히스토리는 유지됩니다.)')) {
            localStorage.removeItem(LOCAL_STORAGE_KEY);
            setFundData(null);
            setRawLog(null);
            setSelectedCompareRecord(null);
        }
    };

    // 히스토리 단일 삭제
    const handleDeleteHistoryItem = async (id: number) => {
        if (confirm('이 히스토리 기록을 정말 삭제하시겠습니까?')) {
            try {
                await deleteTffRecord(id);
                if (selectedCompareRecord?.id === id) {
                    setSelectedCompareRecord(null);
                }
                await loadHistory();
            } catch (err) {
                console.error("기록 삭제 오류", err);
                alert("기록 삭제에 실패했습니다.");
            }
        }
    };

    // 히스토리 전체 삭제
    const handleClearAllHistory = async () => {
        if (confirm('모든 히스토리 기록을 영구히 삭제하시겠습니까?\n(IndexedDB 데이터베이스가 완전히 비워지며 복구할 수 없습니다.)')) {
            try {
                await clearAllTffRecords();
                setSelectedCompareRecord(null);
                await loadHistory();
            } catch (err) {
                console.error("전체 삭제 오류", err);
                alert("전체 삭제에 실패했습니다.");
            }
        }
    };

    // 히스토리에서 활성화(로드)
    const handleLoadHistoryItem = (record: TffDbRecord) => {
        if (confirm(`'${record.fileName}' 버전을 대시보드 활성 데이터로 불러오시겠습니까?`)) {
            setFundData(record.fundData);
            setRawLog(record.rawSheets);
            if (record.fundData && record.fundData.latestMonth) {
                setSelectedMonth(record.fundData.latestMonth);
            }
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({
                fundData: record.fundData,
                rawSheets: record.rawSheets
            }));
            setSelectedCompareRecord(null);
            setShowHistory(false);
        }
    };

    // 비교하기 토글
    const handleToggleCompare = (record: TffDbRecord, isCurrentlyActive: boolean) => {
        if (isCurrentlyActive) return;
        if (selectedCompareRecord?.id === record.id) {
            setSelectedCompareRecord(null);
        } else {
            setSelectedCompareRecord(record);
        }
    };

    // 비교 메트릭 렌더러
    const renderCompareMetric = (
        label: string,
        baseData: TffFundData,
        currentData: TffFundData,
        metricType: 'totalAsset' | 'totalProfit' | 'totalReturnRate' | 'totalNetCash'
    ) => {
        const baseTotal = baseData.cumulative?.totalData;
        const currentTotal = currentData.cumulative?.totalData;

        if (!baseTotal || !currentTotal) {
            return (
                <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3 text-xs text-gray-500">
                    {label}: 데이터 없음
                </div>
            );
        }

        let baseVal = 0;
        let currentVal = 0;
        let isPercent = false;

        switch (metricType) {
            case 'totalAsset':
                baseVal = baseTotal.endValue;
                currentVal = currentTotal.endValue;
                break;
            case 'totalProfit':
                baseVal = baseTotal.profitAmount;
                currentVal = currentTotal.profitAmount;
                break;
            case 'totalReturnRate':
                baseVal = baseTotal.timeWeightedReturn !== undefined ? baseTotal.timeWeightedReturn : baseTotal.returnRate;
                currentVal = currentTotal.timeWeightedReturn !== undefined ? currentTotal.timeWeightedReturn : currentTotal.returnRate;
                isPercent = true;
                break;
            case 'totalNetCash':
                baseVal = baseTotal.netInOut;
                currentVal = currentTotal.netInOut;
                break;
        }

        const diff = currentVal - baseVal;
        const isPositive = diff >= 0;

        return (
            <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3 space-y-1">
                <span className="text-xs text-gray-400 font-medium">{label}</span>
                <div className="flex items-baseline justify-between gap-1">
                    {/* Base Value */}
                    <div className="text-left">
                        <span className="block text-[9px] text-gray-500 font-bold uppercase">기준</span>
                        <div className="text-xs text-gray-300">
                            {isPercent ? `${baseVal.toFixed(1)}%` : `${formatMoney(baseVal)}원`}
                        </div>
                    </div>

                    {/* Arrow */}
                    <span className="text-gray-600 text-xs px-1">→</span>

                    {/* Current Value & Diff */}
                    <div className="text-right">
                        <span className="block text-[9px] text-gray-500 font-bold uppercase">현재</span>
                        <div className="text-sm font-bold text-white">
                            {isPercent ? `${currentVal.toFixed(1)}%` : `${formatMoney(currentVal)}원`}
                        </div>
                        <div className={`text-[10px] font-bold ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                            {isPositive ? '+' : ''}
                            {isPercent ? `${diff.toFixed(1)}%` : `${formatMoney(diff)}원`}
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="flex-1 flex flex-col items-center w-full min-h-[60vh] relative z-10 animate-in fade-in duration-500 py-6">
            {!fundData ? (
                <div className="text-center mb-8 relative z-20 flex flex-col items-center">
                    <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-2 text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-indigo-400 drop-shadow-md">
                        TFF Fund Dashboard
                    </h2>
                    <p className="text-gray-400 text-sm md:text-base">Time Future Forum 포트폴리오 분석 시스템</p>
                </div>
            ) : (
                <div className="w-full max-w-[95vw] xl:max-w-[1200px] mb-6 relative z-20 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div className="flex flex-col items-start px-2">
                        <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight mb-1 text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-indigo-400 drop-shadow-md">
                            TFF Fund Dashboard
                        </h2>
                        <p className="flex items-center gap-2 text-gray-400 text-xs md:text-sm">
                            Time Future Forum 포트폴리오 분석 시스템
                            <span className="px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 rounded text-[10px] md:text-xs font-bold border border-emerald-500/20">'26년 {fundData.latestMonth || "N/A"} 데이터 연동</span>
                        </p>
                    </div>

                    <div className="flex flex-row flex-wrap items-center gap-3">
                        {/* Sub tab navigation */}
                        <div className="flex flex-row items-center bg-black/40 p-1.5 rounded-xl border border-white/5 w-full md:w-auto h-full overflow-x-auto custom-scrollbar whitespace-nowrap">
                            {[
                                { id: 'overview', label: '포트폴리오 현황' },
                                { id: 'cumulative', label: '총누적손익' },
                                { id: 'assets', label: '종목별 수익율' },
                                { id: 'ytm', label: 'YTM 현황' },
                                { id: 'monthly', label: '월별 분석' },
                            ].map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveSubTab(tab.id as any)}
                                    className={`px-3 flex-1 md:flex-none py-1.5 rounded-lg text-sm font-bold transition-all ${activeSubTab === tab.id ? 'bg-sky-500/20 text-sky-300 shadow-[0_0_10px_rgba(56,189,248,0.1)] border border-sky-500/30' : 'text-gray-400 hover:text-gray-200 hover:bg-white/5 border border-transparent'}`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                        <div className="flex flex-row items-center gap-2">
                            <button 
                                onClick={() => setShowHistory(true)}
                                className="flex flex-row items-center gap-1.5 px-3 py-2 text-xs font-bold text-sky-300 hover:text-sky-200 bg-sky-950/30 hover:bg-sky-900/40 rounded-xl transition-colors border border-sky-900/50 backdrop-blur-md shadow-sm"
                                title="업로드 히스토리 관리 및 비교"
                            >
                                <History className="w-4 h-4" /> 히스토리 ({historyRecords.length})
                            </button>
                            <button 
                                onClick={handleClearData}
                                className="flex flex-row items-center gap-1.5 px-3 py-2 text-xs font-bold text-red-300 hover:text-red-200 bg-red-950/30 hover:bg-red-900/40 rounded-xl transition-colors border border-red-900/50 backdrop-blur-md shadow-sm"
                                title="데이터 파일 삭제 및 초기화"
                            >
                                <Trash2 className="w-4 h-4" /> 지우기
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="w-full max-w-[95vw] xl:max-w-[1200px] border border-white/10 rounded-3xl bg-white/[0.02] backdrop-blur-md p-3 md:p-4 flex flex-col min-h-[40vh]">
               
                {/* 1. 데이터가 없을 때: 업로더 화면 */}
                {!fundData && (
                    <div className="flex-1 flex flex-col items-center justify-center">
                        <div 
                            className={`w-full max-w-lg p-10 mt-8 mb-4 border-2 border-dashed rounded-3xl flex flex-col items-center justify-center transition-all cursor-pointer bg-white/5 backdrop-blur-sm
                            ${isDragging ? 'border-sky-400 bg-sky-900/20 scale-102 shadow-[0_0_40px_rgba(56,189,248,0.2)]' : 'border-gray-600 hover:border-gray-500 hover:bg-white/10'}
                            `}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <input 
                                type="file" 
                                accept=".xlsx" 
                                ref={fileInputRef} 
                                className="hidden" 
                                onChange={handleFileChange}
                            />
                            
                            {isParsing ? (
                                <div className="flex flex-col items-center gap-4 text-sky-400">
                                    <Loader2 className="w-12 h-12 animate-spin" />
                                    <p className="font-bold">엑셀 데이터 파싱 중...</p>
                                </div>
                            ) : (
                                <>
                                    <div className="w-20 h-20 rounded-full bg-slate-800 flex items-center justify-center mb-6 shadow-xl relative group">
                                        <div className="absolute inset-0 bg-sky-500 rounded-full opacity-20 group-hover:animate-ping duration-1000"></div>
                                        <FileSpreadsheet className="w-10 h-10 text-emerald-400" />
                                    </div>
                                    <h3 className="text-xl md:text-2xl font-bold text-white mb-3">원본 엑셀 파일 로드</h3>
                                    <p className="text-gray-400 text-sm text-center mb-1">
                                        이곳을 클릭하거나 <span className="text-sky-400 font-medium tracking-wide">TFF 펀드 현황.xlsx</span> 파일을 <br />마우스로 드래그하여 올려놓으세요
                                    </p>
                                    <p className="text-gray-500 text-xs mt-4">데이터는 서버에 저장되지 않고 브라우저(Local) 내에서만 처리됩니다.</p>
                                </>
                            )}
                        </div>

                        {historyRecords.length > 0 && (
                            <button
                                onClick={() => setShowHistory(true)}
                                className="mb-8 flex flex-row items-center gap-2 px-5 py-2.5 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 font-bold text-sm rounded-2xl border border-sky-500/20 transition-all shadow-lg"
                            >
                                <History className="w-4 h-4" /> 히스토리에서 최근 데이터 불러오기 ({historyRecords.length})
                            </button>
                        )}
                    </div>
                )}

                {/* 2. 데이터가 있을 때: 실제 대시보드 뼈대 */}
                {fundData && (
                    <div className="flex flex-col w-full h-full animate-in fade-in slide-in-from-bottom-4 duration-700">

                        {/* Content Area Rendering */}
                        <div className="bg-black/30 rounded-2xl p-2 md:p-3 border border-white/5 min-h-[400px]">
                            {activeSubTab === 'overview' && (
                                <OverviewView data={fundData} />
                            )}

                            {activeSubTab === 'cumulative' && fundData.cumulative && (
                                <CumulativeView data={fundData.cumulative} />
                            )}

                            {activeSubTab === 'assets' && fundData.assetReturns && (
                                <AssetsView data={fundData.assetReturns} onOpenDetail={onOpenDetail} />
                            )}

                            {activeSubTab === 'ytm' && fundData.ytm && (
                                <YtmView data={fundData.ytm} onOpenDetail={onOpenDetail} />
                            )}

                            {activeSubTab === 'monthly' && (
                                <div className="space-y-4 -mt-1 md:-mt-2">
                                    {selectedMonth && fundData.monthlyMap[selectedMonth] ? (
                                        <MonthlyView 
                                            data={fundData.monthlyMap[selectedMonth]} 
                                            onOpenDetail={onOpenDetail} 
                                            titleRightElement={
                                                <select 
                                                    value={selectedMonth}
                                                    onChange={(e) => setSelectedMonth(e.target.value)}
                                                    className="bg-black/50 border border-white/20 text-white text-sm rounded-lg focus:ring-sky-500 focus:border-sky-500 block p-1.5 outline-none ml-2"
                                                >
                                                    {Object.keys(fundData.monthlyMap).sort((a,b) => parseInt(a)-parseInt(b)).map(m => (
                                                        <option key={m} value={m}>{m} 상세 현황</option>
                                                    ))}
                                                </select>
                                            }
                                        />
                                    ) : (
                                        <div className="text-gray-400 py-10 text-center">월 데이터를 선택해주세요.</div>
                                    )}
                                </div>
                            )}
                        </div>
                        
                        {/* 디버그용 출력부 (개발 단계용 숨김 가능) */}
                        <details className="mt-8">
                            <summary className="text-xs text-gray-600 cursor-pointer hover:text-gray-400 transition-colors">Raw Parsing Log (디버그용)</summary>
                            <div className="bg-black/40 rounded-xl p-4 border border-white/5 overflow-hidden mt-2">
                                <div className="max-h-[300px] overflow-y-auto w-full custom-scrollbar">
                                    <pre className="text-gray-500 text-[10px] font-mono whitespace-pre-wrap word-break">
                                        {JSON.stringify(rawLog, null, 2)}
                                    </pre>
                                </div>
                            </div>
                        </details>
                    </div>
                )}

            </div>

            {/* 히스토리 관리 및 비교 모달 */}
            {showHistory && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="w-full max-w-4xl max-h-[85vh] bg-slate-950 border border-white/10 rounded-3xl overflow-hidden flex flex-col shadow-2xl relative">
                        
                        {/* 모달 헤더 */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
                            <div className="flex items-center gap-2">
                                <History className="w-5 h-5 text-sky-400" />
                                <h3 className="text-lg font-bold text-white">TFF 업로드 히스토리 관리</h3>
                            </div>
                            <button 
                                onClick={() => {
                                    setShowHistory(false);
                                    setSelectedCompareRecord(null);
                                }}
                                className="p-1 text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* 모달 바디 */}
                        <div className="flex-1 overflow-y-auto p-6 flex flex-col md:flex-row gap-6 custom-scrollbar">
                            
                            {/* 왼쪽 컬럼: 히스토리 기록 리스트 */}
                            <div className="flex-1 flex flex-col gap-3 min-w-0">
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs text-gray-400 font-bold">저장된 분석 버전 ({historyRecords.length})</span>
                                    {historyRecords.length > 0 && (
                                        <button 
                                            onClick={handleClearAllHistory}
                                            className="text-xs text-red-400 hover:text-red-300 transition-colors font-bold"
                                        >
                                            전체 삭제
                                        </button>
                                    )}
                                </div>

                                {historyRecords.length === 0 ? (
                                    <div className="flex-1 flex flex-col items-center justify-center py-12 border border-dashed border-white/5 rounded-2xl bg-white/[0.01]">
                                        <p className="text-gray-400 text-sm">저장된 히스토리가 없습니다.</p>
                                        <p className="text-gray-500 text-xs mt-1">엑셀 파일을 업로드하면 자동으로 여기에 보관됩니다.</p>
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-2 max-h-[50vh] overflow-y-auto custom-scrollbar pr-1">
                                        {historyRecords.map((record) => {
                                            const isCurrentlyActive = fundData && 
                                                record.fundData.latestMonth === fundData.latestMonth && 
                                                record.fundData.cumulative?.totalData?.endValue === fundData.cumulative?.totalData?.endValue &&
                                                record.fundData.cumulative?.totalData?.profitAmount === fundData.cumulative?.totalData?.profitAmount;

                                            const isComparing = selectedCompareRecord?.id === record.id;

                                            return (
                                                <div 
                                                    key={record.id}
                                                    className={`p-3.5 rounded-2xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white/[0.02]
                                                    ${isCurrentlyActive ? 'border-emerald-500/30 bg-emerald-950/10' : isComparing ? 'border-sky-500/30 bg-sky-950/10' : 'border-white/5 hover:border-white/10 hover:bg-white/[0.04]'}
                                                    `}
                                                >
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-bold text-sm text-white truncate max-w-[220px]" title={record.fileName}>
                                                                {record.fileName}
                                                            </span>
                                                            {isCurrentlyActive && (
                                                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                                                    활성 버전
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-2 mt-1 text-[11px] text-gray-400">
                                                            <span>분석시점: {record.parsedAt}</span>
                                                            <span>•</span>
                                                            <span className="text-sky-300 font-medium">최신 월: {record.fundData.latestMonth || 'N/A'}</span>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-2 self-end md:self-auto">
                                                        {/* 불러오기 버튼 */}
                                                        {!isCurrentlyActive && (
                                                            <button
                                                                onClick={() => handleLoadHistoryItem(record)}
                                                                className="px-2.5 py-1.5 text-xs font-bold text-gray-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors border border-white/5"
                                                            >
                                                                불러오기
                                                            </button>
                                                        )}

                                                        {/* 비교하기 버튼 */}
                                                        {fundData && (
                                                            <button
                                                                onClick={() => handleToggleCompare(record, !!isCurrentlyActive)}
                                                                className={`px-2.5 py-1.5 text-xs font-bold rounded-lg transition-colors border flex items-center gap-1
                                                                ${isCurrentlyActive ? 'opacity-50 cursor-not-allowed bg-transparent border-white/5 text-gray-500' : isComparing ? 'bg-sky-500/20 border-sky-500/40 text-sky-300' : 'bg-slate-800 border-white/5 text-gray-300 hover:text-white hover:bg-slate-700'}
                                                                `}
                                                                disabled={!!isCurrentlyActive}
                                                            >
                                                                <ArrowLeftRight className="w-3.5 h-3.5" />
                                                                {isComparing ? '비교 중' : '비교하기'}
                                                            </button>
                                                        )}

                                                        {/* 삭제 버튼 */}
                                                        <button
                                                            onClick={() => handleDeleteHistoryItem(record.id)}
                                                            className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-950/20 rounded-lg transition-colors border border-transparent hover:border-red-950"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            {/* 오른쪽 컬럼: 버전 비교 패널 */}
                            <div className="w-full md:w-[350px] flex flex-col bg-black/40 border border-white/5 rounded-2xl p-4">
                                <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-1.5">
                                    <ArrowLeftRight className="w-4 h-4 text-sky-400" />
                                    버전 비교 분석
                                </h4>

                                {selectedCompareRecord ? (
                                    <div className="flex-1 flex flex-col justify-between gap-4">
                                        <div className="space-y-4">
                                            <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl text-xs space-y-1.5">
                                                <div className="flex justify-between gap-2">
                                                    <span className="text-gray-400">기준 파일:</span>
                                                    <span className="font-semibold text-white truncate max-w-[150px]" title={selectedCompareRecord.fileName}>{selectedCompareRecord.fileName}</span>
                                                </div>
                                                <div className="flex justify-between gap-2">
                                                    <span className="text-gray-400">비교 대상:</span>
                                                    <span className="font-semibold text-emerald-400 truncate max-w-[150px]">현재 활성 버전</span>
                                                </div>
                                            </div>

                                            {/* 메트릭 비교 목록 */}
                                            <div className="space-y-3">
                                                {renderCompareMetric(
                                                    '총 포트폴리오 자산',
                                                    selectedCompareRecord.fundData,
                                                    fundData!,
                                                    'totalAsset'
                                                )}

                                                {renderCompareMetric(
                                                    '누적 손익금액',
                                                    selectedCompareRecord.fundData,
                                                    fundData!,
                                                    'totalProfit'
                                                )}

                                                {renderCompareMetric(
                                                    '누적 수익률',
                                                    selectedCompareRecord.fundData,
                                                    fundData!,
                                                    'totalReturnRate'
                                                )}

                                                {renderCompareMetric(
                                                    '누적 순 입금액',
                                                    selectedCompareRecord.fundData,
                                                    fundData!,
                                                    'totalNetCash'
                                                )}
                                            </div>
                                        </div>

                                        <div className="pt-2 border-t border-white/5">
                                            <button
                                                onClick={() => setSelectedCompareRecord(null)}
                                                className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-gray-300 hover:text-white rounded-xl text-xs font-bold transition-all border border-white/5"
                                            >
                                                비교 취소
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex-1 flex flex-col items-center justify-center py-12 text-center">
                                        <ArrowLeftRight className="w-8 h-8 text-gray-600 mb-3 animate-pulse" />
                                        <p className="text-xs text-gray-400 font-bold mb-1">비교할 히스토리 버전을 선택하세요</p>
                                        <p className="text-[11px] text-gray-500 max-w-[220px]">
                                            목록에서 과거 버전의 <strong className="text-sky-400 font-medium">['비교하기']</strong> 버튼을 클릭하면 활성 데이터 대비 지표별 차이를 직관적으로 분석할 수 있습니다.
                                        </p>
                                    </div>
                                )}
                            </div>

                        </div>
                        
                        {/* 모달 푸터 */}
                        <div className="px-6 py-4 border-t border-white/5 bg-black/20 flex justify-end">
                            <button
                                onClick={() => {
                                    setShowHistory(false);
                                    setSelectedCompareRecord(null);
                                }}
                                className="px-5 py-2 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold rounded-xl text-xs transition-colors"
                            >
                                닫기
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
