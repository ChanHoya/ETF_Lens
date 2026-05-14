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

    // 인라인 입력 (토글형으로 변경)
    const [showAddForm, setShowAddForm] = useState(false);
    const [newLabel, setNewLabel] = useState("");
    const [newValue, setNewValue] = useState("");
    const [saving, setSaving] = useState(false);
    const [saveMsg, setSaveMsg] = useState<string | null>(null);

    const totalPrincipal = entries.reduce((s, e) => s + e.principal, 0);
    const profit = totalPrincipal > 0 ? totalEvalAmount - totalPrincipal : null;
    const returnRate = totalPrincipal > 0 && totalEvalAmount > 0
        ? (totalEvalAmount - totalPrincipal) / totalPrincipal * 100
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
        <div className="w-full flex flex-col gap-4">
            {/* 헤더 */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                    <h3 className="text-sm font-bold text-white">초기 투자금 대비 총 수익률</h3>
                </div>
                <span className="text-[11px] text-gray-500">
                    총평가 <span className="text-gray-300 font-semibold">{fmtShort(totalEvalAmount)}원</span> 기준
                </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                {/* ── 왼쪽: 수익률 표시 ── */}
                <div className="bg-gradient-to-br from-slate-800/60 to-slate-900/80 border border-white/8 rounded-2xl p-5 flex flex-col justify-center gap-4 min-h-[160px]">
                    {returnRate !== null ? (
                        <>
                            <div className="flex items-start justify-between">
                                 <div>
                                    <p className="text-[11px] text-gray-500 mb-1">총 투자 원금</p>
                                    <p className="text-xl md:text-2xl font-extrabold tracking-tight text-white">{fmtKRW(totalPrincipal)}원</p>
                                </div>
                                <div className="text-right">
                                    <div className={`text-3xl font-black flex items-center gap-1 justify-end ${isPos ? "text-rose-400" : "text-blue-400"}`}>
                                        {isPos ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                                        {isPos ? "+" : ""}{returnRate.toFixed(2)}%
                                    </div>
                                    {profit !== null && (
                                        <p className={`text-sm font-semibold mt-0.5 ${isPos ? "text-rose-400/80" : "text-blue-400/80"}`}>
                                            {isPos ? "+" : ""}{fmtShort(profit)}원
                                        </p>
                                    )}
                                </div>
                            </div>
                            {/* 비교 바 */}
                            <div className="flex flex-col gap-1.5">
                                <div className="flex justify-between text-[10px] text-gray-600 mb-0.5">
                                    <span>원금 {fmtShort(totalPrincipal)}</span>
                                    <span>평가 {fmtShort(totalEvalAmount)}</span>
                                </div>
                                <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-indigo-500 to-indigo-400 rounded-full"
                                        style={{ width: `${Math.min(100, totalPrincipal / Math.max(totalPrincipal, totalEvalAmount) * 100)}%` }}
                                    />
                                </div>
                                <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full ${isPos ? "bg-gradient-to-r from-emerald-500 to-teal-400" : "bg-gradient-to-r from-slate-500 to-slate-400"}`}
                                        style={{ width: `${Math.min(100, totalEvalAmount / Math.max(totalPrincipal, totalEvalAmount) * 100)}%` }}
                                    />
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center text-center gap-2">
                            <TrendingUp className="w-8 h-8 text-gray-700" />
                            <p className="text-sm text-gray-500 font-medium">투자 원금을 입력하면</p>
                            <p className="text-xs text-gray-600">실제 수익률이 계산됩니다</p>
                        </div>
                    )}
                </div>

                {/* ── 오른쪽: 입력 + 목록 ── */}
                <div className="bg-gradient-to-br from-emerald-950/40 to-slate-900/80 border border-emerald-500/15 rounded-2xl p-5 flex flex-col gap-3">

                    {/* ▸ 저장된 항목 목록 */}
                    {loaded && entries.length > 0 && (
                        <div className="flex flex-col gap-1.5">
                            <p className="text-[10px] text-gray-500 font-medium">저장된 항목</p>
                            {entries.map(e => (
                                <div key={e.account_no} className="flex items-center justify-between bg-white/[0.03] hover:bg-white/[0.06] rounded-xl px-3 py-2 group transition-colors">
                                    <div className="min-w-0">
                                        <p className="text-[11px] text-gray-400 truncate">{e.label}</p>
                                        <p className="text-sm font-bold text-white">{fmtKRW(e.principal)}원</p>
                                    </div>
                                    <button
                                        onClick={() => remove(e.account_no)}
                                        className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-red-500/20 rounded-lg transition-all"
                                        title="삭제"
                                    >
                                        <Trash2 className="w-3.5 h-3.5 text-gray-500" />
                                    </button>
                                </div>
                            ))}
                            {entries.length > 1 && (
                                <div className="flex justify-between items-center px-3 pt-1 border-t border-white/5 mt-0.5">
                                    <span className="text-[10px] text-gray-500">합계</span>
                                    <span className="text-xs font-black text-white">{fmtKRW(totalPrincipal)}원</span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ▸ 원금 추가 버튼 및 폼 (목록 아래로 이동) */}
                    <div className="mt-2">
                        {!showAddForm ? (
                            <button
                                onClick={() => setShowAddForm(true)}
                                className="w-full flex items-center justify-center gap-2 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs text-gray-400 font-medium transition-all"
                            >
                                <PlusCircle className="w-3.5 h-3.5" />
                                투자 원금 추가
                            </button>
                        ) : (
                            <div className="bg-emerald-900/20 border border-emerald-500/20 rounded-xl p-3 flex flex-col gap-2 animate-in fade-in slide-in-from-top-2 duration-300">
                                <div className="flex justify-between items-center mb-0.5">
                                    <p className="text-[11px] font-bold text-emerald-400">투자 원금 추가</p>
                                    <button onClick={() => setShowAddForm(false)} className="text-[10px] text-gray-500 hover:text-gray-300">취소</button>
                                </div>
                                <input
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500/40"
                                    placeholder="메모 (예: 은퇴자금, CMA계좌)"
                                    autoFocus
                                    value={newLabel}
                                    onChange={e => setNewLabel(e.target.value)}
                                />
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm font-bold text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500/40 pr-8"
                                            placeholder="금액 입력"
                                            value={newValue}
                                            onChange={e => setNewValue(fmtInput(e.target.value))}
                                            onKeyDown={e => e.key === "Enter" && save()}
                                        />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-gray-500">원</span>
                                    </div>
                                    <button
                                        onClick={save}
                                        disabled={saving}
                                        className="flex items-center gap-1 px-3 py-2 bg-emerald-500/25 hover:bg-emerald-500/40 border border-emerald-500/30 rounded-lg text-xs text-emerald-300 font-bold transition-all disabled:opacity-40 whitespace-nowrap"
                                    >
                                        {saving ? "..." : <><PlusCircle className="w-3.5 h-3.5" /> 추가</>}
                                    </button>
                                </div>
                                {saveMsg && (
                                    <p className={`text-[11px] font-medium ${saveMsg.startsWith("✓") ? "text-emerald-400" : "text-red-400"}`}>
                                        {saveMsg}
                                    </p>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="flex items-start gap-1.5 mt-auto pt-1">
                        <Info className="w-3 h-3 text-gray-700 shrink-0 mt-0.5" />
                        <p className="text-[10px] text-gray-600 leading-relaxed">
                            계좌에 입금한 누적 금액을 입력하세요. 저장 후 다음 방문 시에도 유지됩니다.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
