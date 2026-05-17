import React, { useState, useEffect } from 'react';
import { Database, RefreshCw, CheckCircle2, AlertTriangle, Loader2, BarChart2, ShieldAlert } from 'lucide-react';
import { API_BASE } from '@/lib/apiConfig';

type SyncStatus = {
    local_sqlite: string;
    remote_postgresql: string;
    sync_active: boolean;
};

type TableComparison = {
    local_sqlite_rows: number;
    remote_postgresql_rows: number | string;
    parity: boolean;
};

type VerificationData = {
    status: string;
    all_tables_in_sync: boolean;
    comparison: Record<string, TableComparison>;
};

export default function DbSyncControl() {
    const [status, setStatus] = useState<SyncStatus | null>(null);
    const [verifyData, setVerifyData] = useState<VerificationData | null>(null);
    const [isLoadingStatus, setIsLoadingStatus] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [isVerifying, setIsVerifying] = useState(false);
    const [message, setMessage] = useState<{ text: string; type: 'info' | 'success' | 'error' } | null>(null);

    const fetchStatus = async (silent = false) => {
        if (!silent) setIsLoadingStatus(true);
        try {
            const res = await fetch(`${API_BASE}/api/v1/sync/status`);
            if (res.ok) {
                const data = await res.json();
                setStatus(data);
                if (data.sync_active) {
                    setIsSyncing(true);
                } else {
                    setIsSyncing(false);
                }
            }
        } catch (e) {
            console.error("Failed to fetch sync status", e);
        } finally {
            if (!silent) setIsLoadingStatus(false);
        }
    };

    const handleSync = async () => {
        setIsSyncing(true);
        setMessage({ text: "백그라운드 동기화 작업을 요청 중입니다...", type: 'info' });
        try {
            const res = await fetch(`${API_BASE}/api/v1/sync/trigger`, {
                method: "POST"
            });
            const result = await res.json();
            if (res.ok) {
                setMessage({ text: "동기화가 성공적으로 시작되었습니다. 완료될 때까지 수십 초가 소요될 수 있습니다.", type: 'success' });
                // Start polling status
                setTimeout(() => fetchStatus(true), 2000);
            } else {
                throw new Error(result.detail || "동기화 시작 실패");
            }
        } catch (e: any) {
            setMessage({ text: e.message || "동기화 트리거 중 오류 발생", type: 'error' });
            setIsSyncing(false);
        }
    };

    const handleVerify = async () => {
        setIsVerifying(true);
        setVerifyData(null);
        setMessage({ text: "로컬 DB와 리모트 DB 데이터 정합성을 검증하고 있습니다...", type: 'info' });
        try {
            const res = await fetch(`${API_BASE}/api/v1/sync/verify`);
            const result = await res.json();
            if (res.ok) {
                setVerifyData(result);
                if (result.all_tables_in_sync) {
                    setMessage({ text: "축하합니다! 로컬 SQLite와 remote PostgreSQL의 모든 데이터가 100% 일치합니다.", type: 'success' });
                } else {
                    setMessage({ text: "데이터 불일치가 감지되었습니다. 아래 표를 확인하고 수동 동기화를 진행해 주세요.", type: 'error' });
                }
            } else {
                throw new Error(result.detail || "검증 실패");
            }
        } catch (e: any) {
            setMessage({ text: e.message || "정합성 검증 중 오류 발생", type: 'error' });
        } finally {
            setIsVerifying(false);
        }
    };

    useEffect(() => {
        fetchStatus();
        
        // Polling if active
        const interval = setInterval(() => {
            fetchStatus(true);
        }, 5000);
        
        return () => clearInterval(interval);
    }, []);

    const isPgConnected = status?.remote_postgresql === "connected";
    const isPgConfigured = status?.remote_postgresql !== "not_configured" && !status?.remote_postgresql.startsWith("connection_failed");

    return (
        <section className="flex flex-col gap-4 mt-6">
            <div className="flex justify-between items-end">
                <h2 className="text-2xl font-bold flex items-center gap-3">
                    <span className="w-1.5 h-6 bg-teal-500 rounded-full"></span>
                    무중단 DB 복제 및 백업 동기화 관리
                </h2>
                <button 
                    onClick={() => fetchStatus()}
                    className="p-2 hover:bg-white/5 rounded-lg border border-white/10 text-gray-400 hover:text-white transition-colors"
                    title="상태 새로고침"
                    disabled={isLoadingStatus}
                >
                    <RefreshCw className={`w-4 h-4 ${isLoadingStatus ? 'animate-spin' : ''}`} />
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* 1. Status Overview Card */}
                <div className="bg-gradient-to-br from-teal-500/10 to-emerald-500/5 border border-teal-500/20 rounded-2xl p-6 flex flex-col justify-between min-h-[220px]">
                    <div>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2.5 bg-teal-500/20 rounded-xl">
                                <Database className="w-6 h-6 text-teal-400" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-white">데이터베이스 상태</h3>
                                <p className="text-xs text-gray-400">SQLite ↔ PostgreSQL 복제 노드</p>
                            </div>
                        </div>

                        <div className="flex flex-col gap-3 my-4">
                            {/* Local SQLite */}
                            <div className="flex justify-between items-center bg-black/20 p-2.5 rounded-xl border border-white/5">
                                <span className="text-sm text-gray-300 font-medium">로컬 SQLite (etf_data_v2)</span>
                                <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                                    <CheckCircle2 className="w-4 h-4" /> Connected
                                </span>
                            </div>
                            
                            {/* Remote PostgreSQL */}
                            <div className="flex justify-between items-center bg-black/20 p-2.5 rounded-xl border border-white/5">
                                <span className="text-sm text-gray-300 font-medium">Render Managed Postgres</span>
                                {status?.remote_postgresql === "connected" && (
                                    <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                                        <CheckCircle2 className="w-4 h-4" /> Connected
                                    </span>
                                )}
                                {status?.remote_postgresql === "not_configured" && (
                                    <span className="flex items-center gap-1.5 text-xs font-bold text-gray-500">
                                        <AlertTriangle className="w-4 h-4" /> Not Configured
                                    </span>
                                )}
                                {status?.remote_postgresql.startsWith("connection_failed") && (
                                    <span className="flex items-center gap-1.5 text-xs font-bold text-rose-400" title={status.remote_postgresql}>
                                        <ShieldAlert className="w-4 h-4" /> Connection Error
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-2 mt-2">
                        <button
                            onClick={handleSync}
                            disabled={isSyncing || !isPgConnected}
                            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold transition-all ${
                                isSyncing 
                                    ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30' 
                                    : !isPgConnected 
                                        ? 'bg-white/5 text-gray-500 cursor-not-allowed border border-transparent' 
                                        : 'bg-teal-600 hover:bg-teal-500 text-white cursor-pointer hover:scale-[1.02]'
                            }`}
                        >
                            {isSyncing ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    동기화 중...
                                </>
                            ) : (
                                <>
                                    <RefreshCw className="w-4 h-4" />
                                    수동 동기화 실행
                                </>
                            )}
                        </button>
                        
                        <button
                            onClick={handleVerify}
                            disabled={isVerifying || !isPgConnected}
                            className={`px-4 py-2.5 rounded-xl font-bold border transition-all ${
                                !isPgConnected 
                                    ? 'bg-transparent border-white/5 text-gray-600 cursor-not-allowed'
                                    : 'bg-white/5 hover:bg-white/10 border-white/10 text-white hover:scale-[1.02]'
                            }`}
                        >
                            {isVerifying ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <BarChart2 className="w-4 h-4" />
                            )}
                        </button>
                    </div>
                </div>

                {/* 2. Operations & Details Card */}
                <div className="lg:col-span-2 bg-white/[0.02] border border-white/5 rounded-2xl p-6 flex flex-col justify-between min-h-[220px]">
                    <div>
                        <h3 className="text-lg font-bold text-white mb-2">백업 & 복제 설명</h3>
                        <p className="text-gray-400 text-sm leading-relaxed mb-4">
                            로컬 수집 노드(SQLite)에서 적재된 모든 ETF 마스터, 일별 시세 이력, 벤치마크, 포트폴리오 메타데이터를 
                            Render Managed PostgreSQL 클라우드 DB 인스턴스로 무중단 비동기 복제합니다.
                            <br />
                            <strong className="text-teal-400/90 font-medium">실시간 동기화 주기:</strong> 매일 07:00 (마스터), 18:00 (전체 배치), 20:00 (yfinance 시세), 21:00 (성과 데이터) 완료 시 백그라운드로 복제 트리거 작동.
                        </p>
                    </div>

                    {message && (
                        <div className={`mt-auto px-4 py-3 rounded-xl border text-sm flex items-start gap-2.5 animate-in fade-in duration-300 ${
                            message.type === 'success' 
                                ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300' 
                                : message.type === 'error'
                                    ? 'bg-rose-500/10 border-rose-500/25 text-rose-300'
                                    : 'bg-teal-500/5 border-teal-500/15 text-teal-300'
                        }`}>
                            {message.type === 'success' ? (
                                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                            ) : (
                                <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                            )}
                            <span className="leading-relaxed">{message.text}</span>
                        </div>
                    )}
                </div>
            </div>

            {/* 3. Parity Report Table */}
            {verifyData && (
                <div className="bg-white/[0.01] border border-white/5 rounded-2xl p-6 animate-in slide-in-from-bottom-4 duration-500">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h3 className="text-lg font-bold text-white">데이터 정합성(Parity) 분석 리포트</h3>
                            <p className="text-xs text-gray-500">테이블별 로컬 및 리모트 DB 레코드 개수 실시간 크로스 분석</p>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
                            verifyData.all_tables_in_sync 
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                                : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                        }`}>
                            {verifyData.all_tables_in_sync ? "정합성 100% 매칭" : "동기화 필요"}
                        </span>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm border-collapse">
                            <thead>
                                <tr className="border-b border-white/5 text-gray-400 text-xs uppercase tracking-wider font-bold">
                                    <th className="p-3">테이블 이름 (용도)</th>
                                    <th className="p-3 text-right">로컬 SQLite (Rows)</th>
                                    <th className="p-3 text-right">리모트 PostgreSQL (Rows)</th>
                                    <th className="p-3 text-center">정합성 상태</th>
                                </tr>
                            </thead>
                            <tbody>
                                {Object.entries(verifyData.comparison).map(([tableName, data]) => (
                                    <tr key={tableName} className="border-b border-white/[0.02] hover:bg-white/[0.01] transition-colors">
                                        <td className="p-3 font-semibold text-white font-mono">{tableName}</td>
                                        <td className="p-3 text-right font-medium text-gray-300">{data.local_sqlite_rows.toLocaleString()}</td>
                                        <td className="p-3 text-right font-medium text-gray-300">
                                            {typeof data.remote_postgresql_rows === 'number' 
                                                ? data.remote_postgresql_rows.toLocaleString() 
                                                : String(data.remote_postgresql_rows)}
                                        </td>
                                        <td className="p-3 text-center">
                                            {data.parity ? (
                                                <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                                                    일치
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                                                    불일치
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </section>
    );
}
