'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { UploadCloud, Loader2, FileSpreadsheet, Trash2, History, ArrowLeftRight, X, Lock, Unlock, LogOut, Key, Sparkles } from 'lucide-react';
import { TffFundData } from '../../lib/tff/types';
import { parseTffExcel } from '../../lib/tff/excelParser';
import { API_BASE } from '../../lib/apiConfig';
import { fetchTffEstimate, buildEstimateData, TffEstimateResponse } from '../../lib/tff/estimate';
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

interface TffHistoryRecord {
    id: number;
    fileName: string;
    parsedAt: string;
}

export default function TffDashboard({ onOpenDetail }: Props) {
    const [fundData, setFundData] = useState<TffFundData | null>(null);
    const [rawLog, setRawLog] = useState<any>(null); // 디버깅용 엑셀 원본 JSON
    const [isDragging, setIsDragging] = useState(false);
    const [isParsing, setIsParsing] = useState(false);
    const [activeSubTab, setActiveSubTab] = useState<'overview'|'cumulative'|'assets'|'ytm'|'monthly'>('overview');
    const [selectedMonth, setSelectedMonth] = useState<string>(''); // For monthly view filter
    const fileInputRef = useRef<HTMLInputElement>(null);

    // 현 시점 추정 시뮬레이션 상태
    const [estimateRaw, setEstimateRaw] = useState<TffEstimateResponse | null>(null);
    const [estimateLoading, setEstimateLoading] = useState(false);
    const [useEstimate, setUseEstimate] = useState(false);

    // 마스터 권한 및 패스코드 상태
    const [isAdmin, setIsAdmin] = useState(false);
    const [adminKey, setAdminKey] = useState('');
    const [showPasscodeModal, setShowPasscodeModal] = useState(false);
    const [passcodeInput, setPasscodeInput] = useState('');
    const [passcodeError, setPasscodeError] = useState('');

    // 중앙 서버 히스토리 관련 상태
    const [historyRecords, setHistoryRecords] = useState<TffHistoryRecord[]>([]);
    const [showHistory, setShowHistory] = useState(false);
    const [selectedCompareRecord, setSelectedCompareRecord] = useState<any | null>(null);
    const [isLatestLoading, setIsLatestLoading] = useState(false);

    const formatMoney = (val: number) => new Intl.NumberFormat('ko-KR').format(Math.round(val));

    // 마스터 권한 패스코드 인증
    const handleVerifyPasscode = async (passcode: string) => {
        if (!passcode.trim()) {
            setPasscodeError('비밀번호를 입력하세요.');
            return;
        }
        try {
            const res = await fetch(`${API_BASE}/api/v1/analyze/tff/verify-token`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ admin_key: passcode })
            });
            const result = await res.json();
            if (result.status === 'ok') {
                setAdminKey(passcode);
                setIsAdmin(true);
                setShowPasscodeModal(false);
                sessionStorage.setItem('tff_admin_key', passcode);
                setPasscodeError('');
            } else {
                setPasscodeError(result.message || '비밀번호가 일치하지 않습니다.');
            }
        } catch (err) {
            console.error(err);
            setPasscodeError('인증 요청 중 오류가 발생했습니다.');
        }
    };

    // 마스터 로그아웃
    const handleLogout = () => {
        setIsAdmin(false);
        setAdminKey('');
        sessionStorage.removeItem('tff_admin_key');
    };

    // 최신 공유 데이터 로드
    const fetchLatestData = async () => {
        setIsLatestLoading(true);
        try {
            const res = await fetch(`${API_BASE}/api/v1/analyze/tff/latest`);
            const result = await res.json();
            if (result.status === 'ok') {
                setFundData({ ...result.fund_data, id: result.id });
                setRawLog(result.raw_sheets);
                if (result.fund_data && result.fund_data.latestMonth) {
                    setSelectedMonth(result.fund_data.latestMonth);
                }
            } else {
                setFundData(null);
                setRawLog(null);
            }
        } catch (err) {
            console.error("최신 TFF 데이터 로드 오류", err);
        } finally {
            setIsLatestLoading(false);
        }
    };

    // 히스토리 목록 불러오기 (서버)
    const loadHistory = async () => {
        try {
            const res = await fetch(`${API_BASE}/api/v1/analyze/tff/records`);
            const records = await res.json();
            if (Array.isArray(records)) {
                const mapped = records.map(r => ({
                    id: r.id,
                    fileName: r.file_name,
                    parsedAt: r.uploaded_at ? r.uploaded_at.replace('T', ' ').substring(0, 16) : 'N/A'
                }));
                setHistoryRecords(mapped);
                return mapped;
            }
            return [];
        } catch (err) {
            console.error("TFF 히스토리 리스트 로드 오류", err);
            return [];
        }
    };

    // 상세 히스토리 데이터 단건 로드 (서버)
    const getRecordDetails = async (id: number): Promise<any> => {
        try {
            const res = await fetch(`${API_BASE}/api/v1/analyze/tff/record/${id}`);
            const result = await res.json();
            if (result.status === 'ok') {
                return result;
            }
            throw new Error(result.message || '상세 데이터를 가져오지 못했습니다.');
        } catch (err) {
            console.error(err);
            alert('상세 데이터를 가져오는 중 오류가 발생했습니다.');
            return null;
        }
    };

    // 최초 로딩 시 인증 복원 및 최신 데이터 패치
    useEffect(() => {
        const savedKey = sessionStorage.getItem('tff_admin_key');
        if (savedKey) {
            handleVerifyPasscode(savedKey);
        }
        fetchLatestData();
        loadHistory();
    }, []);

    // fundData 로드 후 백그라운드에서 현 시점 추정 데이터 패치
    useEffect(() => {
        if (!fundData) {
            setEstimateRaw(null);
            setUseEstimate(false);
            return;
        }
        let cancelled = false;
        setEstimateRaw(null);
        setUseEstimate(false);
        setEstimateLoading(true);
        fetchTffEstimate(fundData)
            .then(res => { if (!cancelled) setEstimateRaw(res); })
            .finally(() => { if (!cancelled) setEstimateLoading(false); });
        return () => { cancelled = true; };
    }, [(fundData as any)?.id, fundData?.latestMonth]);

    // 추정 응답 + 업로드 데이터 → 파생 데이터
    const estimateBuilt = useMemo(() => {
        if (!fundData || !estimateRaw) return null;
        try {
            return buildEstimateData(fundData, estimateRaw);
        } catch (e) {
            console.error('[tff estimate] build 실패', e);
            return null;
        }
    }, [fundData, estimateRaw]);

    // 토글 ON & 데이터 준비됨 → 추정 표시본, 아니면 원본
    const displayData: TffFundData | null = !fundData
        ? null
        : (useEstimate && estimateBuilt ? estimateBuilt.estDisplay : (estimateBuilt ? estimateBuilt.baseDisplay : fundData));

    const processFile = async (file: File) => {
        if (!file.name.endsWith('.xlsx')) {
            alert('엑셀 파일(.xlsx)만 업로드 가능합니다.');
            return;
        }
        if (!isAdmin || !adminKey) {
            alert('마스터 업로드 권한이 없습니다. 먼저 마스터 모드를 활성화하세요.');
            return;
        }

        setIsParsing(true);
        try {
            const buffer = await file.arrayBuffer();
            const { data, rawSheets } = parseTffExcel(buffer);
            
            // 중앙 데이터베이스(PostgreSQL)에 공유 저장 요청
            const res = await fetch(`${API_BASE}/api/v1/analyze/tff/upload`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    admin_key: adminKey,
                    file_name: file.name,
                    fund_data: data,
                    raw_sheets: rawSheets
                })
            });

            const result = await res.json();
            if (result.status === 'ok') {
                alert('성공적으로 중앙 공유 데이터베이스에 저장되었습니다.');
                await fetchLatestData();
                await loadHistory();
            } else {
                alert(result.message || '공유 저장을 실패했습니다.');
            }
        } catch (error) {
            console.error(error);
            alert('엑셀 파일 처리 또는 저장 중 오류가 발생했습니다.');
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
        if (confirm('대시보드 화면을 초기화하시겠습니까?\n(화면만 초기화되며 서버의 공유 데이터는 삭제되지 않습니다. 새로고침 시 다시 최신본을 로드합니다.)')) {
            setFundData(null);
            setRawLog(null);
            setSelectedCompareRecord(null);
        }
    };

    // 공유 히스토리 단일 삭제
    const handleDeleteHistoryItem = async (id: number) => {
        if (!isAdmin || !adminKey) {
            alert('삭제 권한이 없습니다.');
            return;
        }
        if (confirm('선택한 히스토리 기록을 공유 서버에서 영구히 삭제하시겠습니까?')) {
            try {
                const res = await fetch(`${API_BASE}/api/v1/analyze/tff/record/${id}/delete`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ admin_key: adminKey })
                });
                const result = await res.json();
                if (result.status === 'ok') {
                    if (selectedCompareRecord?.id === id) {
                        setSelectedCompareRecord(null);
                    }
                    await loadHistory();
                    await fetchLatestData();
                } else {
                    alert(result.message || '삭제에 실패했습니다.');
                }
            } catch (err) {
                console.error("기록 삭제 오류", err);
                alert("삭제 처리 중 오류가 발생했습니다.");
            }
        }
    };

    // 공유 히스토리에서 데이터 불러오기 (임시 뷰어 로드)
    const handleLoadHistoryItem = async (record: TffHistoryRecord) => {
        if (confirm(`'${record.fileName}' 버전을 화면에 불러오시겠습니까?`)) {
            const details = await getRecordDetails(record.id);
            if (details) {
                setFundData({ ...details.fund_data, id: details.id });
                setRawLog(details.raw_sheets);
                if (details.fund_data && details.fund_data.latestMonth) {
                    setSelectedMonth(details.fund_data.latestMonth);
                }
                setSelectedCompareRecord(null);
                setShowHistory(false);
            }
        }
    };

    // 비교 토글
    const handleToggleCompare = async (record: TffHistoryRecord, isCurrentlyActive: boolean) => {
        if (isCurrentlyActive) return;
        if (selectedCompareRecord?.id === record.id) {
            setSelectedCompareRecord(null);
        } else {
            const details = await getRecordDetails(record.id);
            if (details) {
                setSelectedCompareRecord({
                    id: details.id,
                    fileName: details.file_name,
                    parsedAt: details.uploaded_at ? details.uploaded_at.replace('T', ' ').substring(0, 16) : 'N/A',
                    fundData: details.fund_data,
                    rawSheets: details.raw_sheets
                });
            }
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
        <div className="flex-1 flex flex-col items-center w-full min-h-[60vh] relative z-10 animate-in fade-in duration-500 pt-1 pb-6">
            
            {/* 상단 공통 헤더 — 1행: 타이틀 + 제어 버튼들 */}
            <div className="w-full max-w-[95vw] xl:max-w-[1400px] mb-3 relative z-20 flex flex-row items-center justify-between gap-3 flex-wrap">
                <div className="flex flex-col items-start px-2">
                    <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight mb-1 text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-indigo-400 drop-shadow-md">
                        TFF Fund Dashboard
                    </h2>
                    <p className="flex items-center gap-2 text-gray-400 text-xs md:text-sm">
                        Time Future Forum 포트폴리오 분석 시스템
                        {fundData && (
                            <span className="px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 rounded text-[10px] md:text-xs font-bold border border-emerald-500/20">
                                '26년 {fundData.latestMonth || "N/A"} 데이터 연동
                            </span>
                        )}
                        {!fundData && !isLatestLoading && (
                            <span className="px-1.5 py-0.5 bg-amber-500/10 text-amber-400 rounded text-[10px] md:text-xs font-bold border border-amber-500/20">
                                공유 데이터 없음
                            </span>
                        )}
                        {isLatestLoading && (
                            <span className="px-1.5 py-0.5 bg-sky-500/10 text-sky-400 rounded text-[10px] md:text-xs font-bold border border-sky-500/20 flex items-center gap-1">
                                <Loader2 className="w-3 h-3 animate-spin" /> 로딩 중...
                            </span>
                        )}
                    </p>
                </div>

                {/* 제어 컨트롤 버튼들 — 항상 오른쪽 상단에 고정 */}
                <div className="flex flex-row items-center gap-2 flex-wrap">
                    {/* 마스터 권한 배지 / 버튼 */}
                    {isAdmin ? (
                        <div className="flex items-center gap-1">
                            <span className="flex items-center gap-1 px-2.5 py-1.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-xl text-xs font-bold shadow-sm animate-in fade-in duration-300">
                                <Unlock className="w-3.5 h-3.5" /> 마스터 모드
                            </span>
                            <button
                                onClick={handleLogout}
                                className="p-1.5 text-gray-400 hover:text-red-400 bg-white/5 hover:bg-red-950/20 rounded-xl border border-white/10 hover:border-red-900 transition-colors"
                                title="마스터 로그아웃"
                            >
                                <LogOut className="w-4 h-4" />
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={() => {
                                setPasscodeInput('');
                                setPasscodeError('');
                                setShowPasscodeModal(true);
                            }}
                            className="flex flex-row items-center gap-1.5 px-3 py-2 text-xs font-bold text-gray-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors border border-white/5 backdrop-blur-md shadow-sm"
                            title="마스터 패스코드 인증"
                        >
                            <Lock className="w-3.5 h-3.5 text-amber-400" /> 마스터 로그인
                        </button>
                    )}

                    {/* 히스토리 버튼 */}
                    {(historyRecords.length > 0 || fundData) && (
                        <button
                            onClick={() => setShowHistory(true)}
                            className="flex flex-row items-center gap-1.5 px-3 py-2 text-xs font-bold text-sky-300 hover:text-sky-200 bg-sky-950/30 hover:bg-sky-900/40 rounded-xl transition-colors border border-sky-900/50 backdrop-blur-md shadow-sm"
                            title="업로드 히스토리 관리 및 비교"
                        >
                            <History className="w-4 h-4" /> 히스토리 ({historyRecords.length})
                        </button>
                    )}

                    {/* 마스터 권한용 업로드 및 비우기 버튼 */}
                    {isAdmin && (
                        <>
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="flex flex-row items-center gap-1.5 px-3 py-2 text-xs font-bold text-emerald-300 hover:text-emerald-200 bg-emerald-950/30 hover:bg-emerald-900/40 rounded-xl transition-colors border border-emerald-900/50 backdrop-blur-md shadow-sm"
                                title="새 엑셀 파일 업로드"
                            >
                                <UploadCloud className="w-4 h-4" /> 업로드
                            </button>
                            {fundData && (
                                <button
                                    onClick={handleClearData}
                                    className="flex flex-row items-center gap-1.5 px-3 py-2 text-xs font-bold text-red-300 hover:text-red-200 bg-red-950/30 hover:bg-red-900/40 rounded-xl transition-colors border border-red-900/50 backdrop-blur-md shadow-sm"
                                    title="화면 일시적 비우기"
                                >
                                    <Trash2 className="w-4 h-4" /> 비우기
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* 헤더 2행: 탭 내비게이션 (데이터 있을 때만) */}
            {fundData && (
                <div className="w-full max-w-[95vw] xl:max-w-[1400px] mb-4 relative z-20 px-0 flex flex-col lg:flex-row lg:items-center gap-2">
                    <div className="flex flex-row items-center bg-black/40 p-1.5 rounded-xl border border-white/5 overflow-x-auto custom-scrollbar whitespace-nowrap flex-1">
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
                                className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all flex-shrink-0 ${activeSubTab === tab.id ? 'bg-sky-500/20 text-sky-300 shadow-[0_0_10px_rgba(56,189,248,0.1)] border border-sky-500/30' : 'text-gray-400 hover:text-gray-200 hover:bg-white/5 border border-transparent'}`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* 현 시점 추정 시뮬레이션 토글 */}
                    <div className="relative group flex-shrink-0">
                        <button
                            onClick={() => estimateBuilt && setUseEstimate(v => !v)}
                            disabled={!estimateBuilt}
                            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all border whitespace-nowrap ${
                                !estimateBuilt
                                    ? 'bg-white/5 text-gray-500 border-white/5 cursor-wait'
                                    : useEstimate
                                        ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white border-amber-400/50 shadow-[0_0_14px_rgba(245,158,11,0.3)]'
                                        : 'bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/20'
                            }`}
                        >
                            {!estimateBuilt ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                                <Sparkles className="w-3.5 h-3.5" />
                            )}
                            <span>
                                {estimateBuilt
                                    ? (() => {
                                        const parts = (estimateBuilt.asOf || '').split('-');
                                        const label = parts.length === 3 ? `${parseInt(parts[1],10)}월 ${parseInt(parts[2],10)}일` : '현재';
                                        return `현시점(${label}) 기준 추정 시뮬레이션`;
                                    })()
                                    : '추정 시뮬레이션 준비중 (최대 수분 소요) ...'}
                            </span>
                            {estimateBuilt && (
                                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-black ${useEstimate ? 'bg-white/25' : 'bg-amber-500/20'}`}>
                                    {useEstimate ? 'ON' : 'OFF'}
                                </span>
                            )}
                        </button>

                        {/* 마우스 오버 설명 팝업 */}
                        <div className="absolute right-0 top-full mt-2 w-72 p-3 rounded-xl bg-[#0f0f17] border border-amber-500/30 shadow-2xl text-[11px] leading-relaxed text-gray-300 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 pointer-events-none">
                            <div className="flex items-center gap-1.5 mb-1.5 text-amber-300 font-bold">
                                <Sparkles className="w-3 h-3" />
                                현 시점 추정 시뮬레이션
                            </div>
                            전일 종가(분배금 등은 제외) 기준으로 시뮬레이션한 정보를 반영해서 보여줍니다.
                        </div>
                    </div>
                </div>
            )}


            {/* 메인 콘텐츠 영역 */}
            <div className="w-full max-w-[95vw] xl:max-w-[1400px] border border-white/10 rounded-3xl bg-white/[0.02] backdrop-blur-md p-3 md:p-4 flex flex-col min-h-[40vh]">
               
                {/* 1. 데이터가 없을 때 */}
                {!fundData && (
                    <div className="flex-1 flex flex-col items-center justify-center py-10">
                        {/* 1-1. 마스터 권한인 경우: 파일 업로드 드롭존 표시 */}
                        {isAdmin ? (
                            <div 
                                className={`w-full max-w-lg p-10 mt-4 mb-4 border-2 border-dashed rounded-3xl flex flex-col items-center justify-center transition-all cursor-pointer bg-white/5 backdrop-blur-sm
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
                                        <p className="font-bold">엑셀 데이터 파싱 및 서버 저장 중...</p>
                                    </div>
                                ) : (
                                    <>
                                        <div className="w-20 h-20 rounded-full bg-slate-800 flex items-center justify-center mb-6 shadow-xl relative group">
                                            <div className="absolute inset-0 bg-sky-500 rounded-full opacity-20 group-hover:animate-ping duration-1000"></div>
                                            <FileSpreadsheet className="w-10 h-10 text-emerald-400" />
                                        </div>
                                        <h3 className="text-xl md:text-2xl font-bold text-white mb-3">원본 엑셀 파일 로드</h3>
                                        <p className="text-gray-400 text-sm text-center mb-1 leading-relaxed">
                                            이곳을 클릭하거나 <span className="text-sky-400 font-medium tracking-wide">TFF 펀드 현황.xlsx</span> 파일을 <br />
                                            마우스로 드래그하여 올려놓으세요.
                                        </p>
                                        <p className="text-gray-500 text-xs mt-4">데이터는 중앙 PostgreSQL 데이터베이스에 공유 저장됩니다.</p>
                                    </>
                                )}
                            </div>
                        ) : (
                            /* 1-2. 뷰어인 경우: 마스터 업로드 대기 화면 표시 */
                            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center max-w-md mx-auto">
                                <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mb-6 shadow-xl border border-white/10">
                                    <FileSpreadsheet className="w-8 h-8 text-gray-500" />
                                </div>
                                <h3 className="text-xl font-bold text-white mb-2">공유 데이터 대기 중</h3>
                                <p className="text-gray-400 text-sm mb-6 leading-relaxed">
                                    대시보드에 표시할 공유 데이터가 아직 업로드되지 않았습니다. <br />
                                    마스터 관리자가 첫 번째 엑셀 파일을 업로드하면 이곳에서 전체 투자참여자가 실시간으로 조회가 가능합니다.
                                </p>
                                <button
                                    onClick={() => {
                                        setPasscodeInput('');
                                        setPasscodeError('');
                                        setShowPasscodeModal(true);
                                    }}
                                    className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold text-sm rounded-xl transition-all shadow-[0_0_15px_rgba(245,158,11,0.2)] hover:shadow-[0_0_20px_rgba(245,158,11,0.3)] flex items-center gap-2"
                                >
                                    <Key className="w-4 h-4 text-amber-400" /> 마스터 권한으로 로그인
                                </button>
                            </div>
                        )}

                        {/* 숨겨진 파일 인풋 (마스터용) */}
                        <input 
                            type="file" 
                            accept=".xlsx" 
                            ref={fileInputRef} 
                            className="hidden" 
                            onChange={handleFileChange}
                        />

                        {historyRecords.length > 0 && (
                            <button
                                onClick={() => setShowHistory(true)}
                                className="mt-4 flex flex-row items-center gap-2 px-5 py-2.5 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 font-bold text-sm rounded-2xl border border-sky-500/20 transition-all shadow-lg"
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
                            {activeSubTab === 'overview' && displayData && (
                                <OverviewView data={displayData} />
                            )}

                            {activeSubTab === 'cumulative' && displayData?.cumulative && (
                                <CumulativeView
                                    data={displayData.cumulative}
                                    estimatePeriod={estimateBuilt?.currentMonthPeriod}
                                />
                            )}

                            {activeSubTab === 'assets' && displayData?.assetReturns && (
                                <AssetsView
                                    data={displayData.assetReturns}
                                    onOpenDetail={onOpenDetail}
                                    currentMonthKey={estimateBuilt?.currentMonthKey}
                                />
                            )}

                            {activeSubTab === 'ytm' && displayData?.ytm && (
                                <YtmView data={displayData.ytm} onOpenDetail={onOpenDetail} />
                            )}

                            {activeSubTab === 'monthly' && displayData && (
                                <div className="space-y-4 -mt-1 md:-mt-2">
                                    {selectedMonth && displayData.monthlyMap[selectedMonth] ? (
                                        <MonthlyView
                                            data={displayData.monthlyMap[selectedMonth]}
                                            onOpenDetail={onOpenDetail}
                                            titleRightElement={
                                                <div className="flex items-center gap-2">
                                                    <select
                                                        value={selectedMonth}
                                                        onChange={(e) => setSelectedMonth(e.target.value)}
                                                        className="bg-black/50 border border-white/20 text-white text-sm rounded-lg focus:ring-sky-500 focus:border-sky-500 block p-1.5 outline-none ml-2"
                                                    >
                                                        {Object.keys(displayData.monthlyMap).sort((a,b) => parseInt(a)-parseInt(b)).map(m => (
                                                            <option key={m} value={m}>
                                                                {estimateBuilt && m === estimateBuilt.currentMonthKey ? `${m}(현재·추정)` : `${m} 상세 현황`}
                                                            </option>
                                                        ))}
                                                    </select>
                                                    {estimateBuilt && selectedMonth === estimateBuilt.currentMonthKey && (
                                                        <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2 py-1 rounded-lg whitespace-nowrap">
                                                            현재가 기준 추정치
                                                        </span>
                                                    )}
                                                </div>
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
                                                record.id === (fundData as any).id;

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

                                                        {/* 삭제 버튼 (마스터 전용) */}
                                                        {isAdmin && (
                                                            <button
                                                                onClick={() => handleDeleteHistoryItem(record.id)}
                                                                className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-950/20 rounded-lg transition-colors border border-transparent hover:border-red-950"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        )}
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

            {/* 마스터 비밀번호 입력 모달 */}
            {showPasscodeModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="w-full max-w-sm bg-slate-950 border border-white/10 rounded-3xl overflow-hidden shadow-2xl relative p-6 space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                <Key className="w-4 h-4 text-amber-400" /> 마스터 로그인
                            </h3>
                            <button
                                onClick={() => setShowPasscodeModal(false)}
                                className="p-1 text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        
                        <p className="text-xs text-gray-400 leading-relaxed">
                            공유 대시보드에 새로운 엑셀 데이터를 업로드하거나 과거 이력을 관리하려면 마스터 패스코드를 입력하십시오.
                        </p>

                        <div className="space-y-2">
                            <input
                                type="password"
                                placeholder="마스터 패스코드 입력"
                                value={passcodeInput}
                                onChange={(e) => setPasscodeInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleVerifyPasscode(passcodeInput);
                                }}
                                className="w-full px-4 py-3 bg-black/50 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-amber-500 transition-colors"
                                autoFocus
                            />
                            {passcodeError && (
                                <p className="text-xs font-semibold text-red-400 px-1">{passcodeError}</p>
                            )}
                        </div>

                        <div className="flex gap-2 pt-2">
                            <button
                                onClick={() => setShowPasscodeModal(false)}
                                className="flex-1 py-2.5 border border-white/10 text-gray-400 hover:text-white rounded-xl text-xs font-bold transition-all hover:bg-white/5"
                            >
                                취소
                            </button>
                            <button
                                onClick={() => handleVerifyPasscode(passcodeInput)}
                                className="flex-1 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 rounded-xl text-xs font-bold transition-all shadow-[0_0_15px_rgba(245,158,11,0.2)]"
                            >
                                확인
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
