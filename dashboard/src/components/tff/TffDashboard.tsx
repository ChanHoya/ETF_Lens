'use client';

import { useState, useEffect, useRef } from 'react';
import { UploadCloud, Loader2, FileSpreadsheet, Trash2 } from 'lucide-react';
import { TffFundData } from '../../lib/tff/types';
import { parseTffExcel } from '../../lib/tff/excelParser';
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

    // 최초 로딩 시 로컬스토리지 복원
    useEffect(() => {
        const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                setFundData(parsed.fundData);
                setRawLog(parsed.rawSheets);
                if (parsed.fundData && parsed.fundData.latestMonth) {
                    setSelectedMonth(parsed.fundData.latestMonth);
                }
            } catch (e) {
                console.error("로컬 스토리지 파싱 오류", e);
            }
        }
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
        if (confirm('저장된 대시보드 데이터를 지우고 다시 업로드하시겠습니까?')) {
            localStorage.removeItem(LOCAL_STORAGE_KEY);
            setFundData(null);
            setRawLog(null);
        }
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
                        <button 
                            onClick={handleClearData}
                            className="flex flex-row items-center gap-1.5 px-3 py-2 text-xs font-bold text-red-300 hover:text-red-200 bg-red-950/30 hover:bg-red-900/40 rounded-xl transition-colors border border-red-900/50 backdrop-blur-md shadow-sm"
                            title="데이터 파일 삭제 및 초기화"
                        >
                            <Trash2 className="w-4 h-4" /> 지우기
                        </button>
                    </div>
                </div>
            )}

            <div className="w-full max-w-[95vw] xl:max-w-[1200px] border border-white/10 rounded-3xl bg-white/[0.02] backdrop-blur-md p-3 md:p-4 flex flex-col min-h-[40vh]">
               
                {/* 1. 데이터가 없을 때: 업로더 화면 */}
                {!fundData && (
                    <div className="flex-1 flex flex-col items-center justify-center">
                        <div 
                            className={`w-full max-w-lg p-10 mt-8 mb-8 border-2 border-dashed rounded-3xl flex flex-col items-center justify-center transition-all cursor-pointer bg-white/5 backdrop-blur-sm
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
                                <div className="space-y-4">
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
        </div>
    );
}
