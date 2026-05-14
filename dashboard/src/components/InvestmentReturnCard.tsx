"use client";
import React, { useState, useEffect } from "react";
import { TrendingUp, TrendingDown, Check, Trash2, Info, PlusCircle } from "lucide-react";
import { API_BASE } from "@/lib/apiConfig";

interface PrincipalEntry {
    account_no: string;
    principal: number;
    label: string;
}

interface Props {
    totalEvalAmount: number;
    cashBalance: number;
}

const fmtKRW = (n: number) => new Intl.NumberFormat("ko-KR").format(Math.round(n));
const fmtShort = (n: number) => {
    const abs = Math.abs(n);
    if (abs >= 1e8) return `${(n / 1e8).toFixed(2)}억`;
    if (abs >= 1e4) return `${Math.round(n / 1e4)}만`;
    return fmtKRW(n);
};
const parseAmount = (s: string) => parseFloat(s.replace(/[^0-9]/g, "")) || 0;
const fmtInput = (s: string) => {
    const digits = s.replace(/[^0-9]/g, "");
    return digits ? new Intl.NumberFormat("ko-KR").format(Number(digits)) : "";
};

export default function InvestmentReturnCard({ totalEvalAmount }: Props) {
    const [entries, setEntries] = useState<PrincipalEntry[]>([]);
    const [loaded, setLoaded] = useState(false);

    const [isEditMode, setIsEditMode] = useState(false);
    const [showAddForm, setShowAddForm] = useState(false);
    const [newLabel, setNewLabel] = useState("");
    const [newValue, setNewValue] = useState("");
    const [saving, setSaving] = useState(false);
    const [saveMsg, setSaveMsg] = useState<string | null>(null);

    const currentTotalAsset = totalEvalAmount + cashBalance;
    const totalPrincipal = entries.reduce((s, e) => s + e.principal, 0);
    const profit = totalPrincipal > 0 ? currentTotalAsset - totalPrincipal : null;
    const returnRate = totalPrincipal > 0 && currentTotalAsset > 0
        ? (currentTotalAsset - totalPrincipal) / totalPrincipal * 100
        : null;
    const isPos = returnRate !== null && returnRate >= 0;

    useEffect(() => { load(); }, []);

    const load = async () => {
        try {
            const res = await fetch(`${API_BASE}/api/v1/my/principal`);
            if (res.ok) setEntries((await res.json()).principals || []);
        } catch { /* silent */ } finally { setLoaded(true); }
    };

    const save = async () => {
        const val = parseAmount(newValue);
        if (val <= 0) { setSaveMsg("금액을 입력해주세요"); setTimeout(() => setSaveMsg(null), 2000); return; }
        setSaving(true);
        try {
            const key = `entry_${Date.now()}`;
            const res = await fetch(`${API_BASE}/api/v1/my/principal`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ account_no: key, principal: val, label: newLabel.trim() || "투자금" }),
            });
            if (res.ok) {
                setNewLabel(""); setNewValue("");
                await load();
                setSaveMsg("✓ 저장됨");
            } else {
                setSaveMsg("저장 실패 — 잠시 후 재시도");
            }
        } catch { setSaveMsg("네트워크 오류"); }
        finally { setSaving(false); setTimeout(() => setSaveMsg(null), 2500); }
    };

    const remove = async (key: string) => {
        try {
            await fetch(`${API_BASE}/api/v1/my/principal/${encodeURIComponent(key)}`, { method: "DELETE" });
            await load();
        } catch { /* silent */ }
    };

    return (
        <div className="w-full flex flex-col gap-6">
            {/* ── 1. 통합 요약 헤더 (3컬럼) ── */}
            <div className="flex flex-col md:flex-row items-center gap-4 md:gap-0 justify-between bg-white/[0.03] border border-white/5 rounded-[32px] p-6 md:p-8 backdrop-blur-md">
                
                {/* (1) 초기 투자금 */}
                <div className="flex-1 flex flex-col items-center md:items-start text-center md:text-left border-b md:border-b-0 md:border-r border-white/10 pb-4 md:pb-0 md:pr-8 w-full md:w-auto">
                    <p className="text-xs md:text-sm text-gray-500 mb-1 font-bold">초기 투자금</p>
                    <div className="flex items-baseline gap-1">
                        <p className="text-2xl md:text-4xl font-extrabold tracking-tight text-white">{fmtKRW(totalPrincipal)}</p>
                        <span className="text-xs md:text-sm text-gray-500">원</span>
                    </div>
                </div>

                {/* (2) 현재 자산 총액 */}
                <div className="flex-2 flex flex-col items-center text-center px-4 md:px-12 w-full md:w-auto">
                    <p className="text-xs md:text-sm text-gray-400 mb-1 font-bold">현재 자산 총액</p>
                    <div className="flex items-baseline gap-1">
                        <p className="text-3xl md:text-5xl font-black tracking-tighter text-white bg-clip-text text-transparent bg-gradient-to-b from-white to-gray-400">
                            {fmtKRW(currentTotalAsset)}
                        </p>
                        <span className="text-sm md:text-base text-gray-400">원</span>
                    </div>
                </div>

                {/* (3) 수익금 / 수익률 */}
                <div className="flex-1 flex flex-col items-center md:items-end text-center md:text-right border-t md:border-t-0 md:border-l border-white/10 pt-4 md:pt-0 md:pl-8 w-full md:w-auto">
                    <p className="text-xs md:text-sm text-gray-500 mb-1 font-bold">누적 수익금</p>
                    <div className={`flex flex-col items-center md:items-end ${isPos ? "text-rose-400" : "text-blue-400"}`}>
                        <div className="text-2xl md:text-4xl font-extrabold tracking-tight flex items-center gap-1">
                            {isPos ? "+" : ""}{returnRate?.toFixed(2)}%
                        </div>
                        {profit !== null && (
                            <p className="text-sm md:text-base font-bold opacity-80 mt-1">
                                {isPos ? "+" : ""}{fmtShort(profit)}원
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {/* ── 2. 비교 그래프 및 관리 버튼 ── */}
            <div className="flex flex-col gap-4 px-2">
                <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-1 flex-1 max-w-[60%]">
                        <div className="flex justify-between text-[11px] font-bold text-gray-500 px-1">
                            <span>원금 대비 평가 비중</span>
                            <span>{fmtShort(currentTotalAsset)} 기준</span>
                        </div>
                        <div className="relative w-full h-3 bg-white/5 rounded-full overflow-hidden border border-white/5">
                            <div
                                className="absolute inset-y-0 left-0 bg-gradient-to-r from-indigo-600 to-indigo-400 rounded-full transition-all duration-1000"
                                style={{ width: `${Math.min(100, totalPrincipal / Math.max(totalPrincipal, currentTotalAsset) * 100)}%` }}
                            />
                            <div
                                className={`absolute inset-y-0 left-0 rounded-full mix-blend-overlay transition-all duration-1000 ${isPos ? "bg-emerald-400" : "bg-slate-400"}`}
                                style={{ width: `${Math.min(100, currentTotalAsset / Math.max(totalPrincipal, currentTotalAsset) * 100)}%`, opacity: 0.4 }}
                            />
                        </div>
                    </div>

                    <button 
                        onClick={() => setIsEditMode(!isEditMode)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                            isEditMode ? "bg-white/20 text-white" : "bg-white/5 text-gray-400 hover:bg-white/10"
                        }`}
                    >
                        {isEditMode ? "관리 종료" : "투자금 상세 관리"}
                    </button>
                </div>

                {/* ── 3. 상세 관리 리스트 (Edit Mode 시 노출) ── */}
                {isEditMode && (
                    <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5 animate-in fade-in slide-in-from-top-4 duration-500">
                        <div className="flex items-center justify-between mb-4">
                            <h4 className="text-sm font-bold text-gray-300">투자 원금 상세 내역</h4>
                            <button
                                onClick={() => setShowAddForm(!showAddForm)}
                                className="text-xs text-emerald-400 font-bold hover:underline"
                            >
                                {showAddForm ? "닫기" : "+ 내역 추가"}
                            </button>
                        </div>

                        {showAddForm && (
                            <div className="bg-emerald-950/20 border border-emerald-500/20 rounded-xl p-4 mb-4 flex flex-col gap-3">
                                <input
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500/40"
                                    placeholder="항목 이름 (예: 개인연금, 퇴직금)"
                                    autoFocus
                                    value={newLabel}
                                    onChange={e => setNewLabel(e.target.value)}
                                />
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-lg font-black text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500/40 pr-8"
                                            placeholder="금액"
                                            value={newValue}
                                            onChange={e => setNewValue(fmtInput(e.target.value))}
                                        />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">원</span>
                                    </div>
                                    <button
                                        onClick={save}
                                        disabled={saving}
                                        className="px-6 bg-emerald-500 hover:bg-emerald-400 rounded-lg text-white font-bold transition-all disabled:opacity-40"
                                    >
                                        저장
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className="flex flex-col gap-2">
                            {entries.length > 0 ? (
                                entries.map(e => (
                                    <div key={e.account_no} className="flex items-center justify-between bg-white/5 rounded-xl px-4 py-3 group">
                                        <div>
                                            <p className="text-xs text-gray-400">{e.label}</p>
                                            <p className="text-base font-bold text-white">{fmtKRW(e.principal)}원</p>
                                        </div>
                                        <button
                                            onClick={() => remove(e.account_no)}
                                            className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))
                            ) : (
                                <p className="text-center py-8 text-gray-500 text-sm">저장된 투자 원금 내역이 없습니다.</p>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
}
