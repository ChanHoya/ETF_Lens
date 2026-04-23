"use client";
import React, { useState, useEffect, useCallback } from "react";
import {
    TrendingUp, TrendingDown, Edit3, Check, X, Plus, Trash2, Info
} from "lucide-react";
import { API_BASE } from "@/lib/apiConfig";

interface PrincipalEntry {
    account_no: string;
    principal: number;
    label: string;
    updated_at: string | null;
}

interface Props {
    totalEvalAmount: number;
}

const fmtKRW = (n: number) =>
    new Intl.NumberFormat("ko-KR").format(Math.round(n));

const fmtShort = (n: number) => {
    const abs = Math.abs(n);
    if (abs >= 1e8) return `${(n / 1e8).toFixed(2)}억`;
    if (abs >= 1e4) return `${(n / 1e4).toFixed(0)}만`;
    return fmtKRW(n);
};

const parseRaw = (s: string) =>
    parseFloat(s.replace(/,/g, "").replace(/[^0-9.]/g, "")) || 0;

export default function InvestmentReturnCard({ totalEvalAmount }: Props) {
    const [entries, setEntries] = useState<PrincipalEntry[]>([]);
    const [editingKey, setEditingKey] = useState<string | null>(null);
    const [editLabel, setEditLabel] = useState("");
    const [editValue, setEditValue] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false);

    // 총 원금 합계
    const totalPrincipal = entries.reduce((s, e) => s + e.principal, 0);
    const profit = totalPrincipal > 0 ? totalEvalAmount - totalPrincipal : null;
    const returnRate =
        totalPrincipal > 0 && totalEvalAmount > 0
            ? ((totalEvalAmount - totalPrincipal) / totalPrincipal) * 100
            : null;
    const isProfit = returnRate !== null && returnRate >= 0;

    useEffect(() => {
        fetchEntries();
    }, []);

    const fetchEntries = async () => {
        try {
            const res = await fetch(`${API_BASE}/api/v1/my/principal`);
            if (res.ok) {
                const data = await res.json();
                setEntries(data.principals || []);
            }
        } catch (e) {
            console.warn("principal 조회 실패:", e);
        } finally {
            setIsLoaded(true);
        }
    };

    const startAdd = () => {
        setEditingKey("__NEW__");
        setEditLabel("");
        setEditValue("");
    };

    const startEdit = (e: PrincipalEntry) => {
        setEditingKey(e.account_no);
        setEditLabel(e.label || "");
        setEditValue(e.principal > 0 ? fmtKRW(e.principal) : "");
    };

    const cancelEdit = () => setEditingKey(null);

    const save = async () => {
        const val = parseRaw(editValue);
        if (val <= 0) return;
        setIsSaving(true);
        // 새 항목은 타임스탬프 기반 unique key 사용
        const key =
            editingKey === "__NEW__"
                ? `entry_${Date.now()}`
                : editingKey!;
        try {
            await fetch(`${API_BASE}/api/v1/my/principal`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    account_no: key,
                    principal: val,
                    label: editLabel.trim() || "투자금",
                }),
            });
            await fetchEntries();
            setEditingKey(null);
        } catch (e) {
            console.error("저장 실패:", e);
        } finally {
            setIsSaving(false);
        }
    };

    const remove = async (accountNo: string) => {
        try {
            await fetch(
                `${API_BASE}/api/v1/my/principal/${encodeURIComponent(accountNo)}`,
                { method: "DELETE" }
            );
            await fetchEntries();
        } catch (e) {
            console.error("삭제 실패:", e);
        }
    };

    return (
        <div className="w-full flex flex-col gap-4">
            {/* 헤더 */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                    <h3 className="text-sm font-bold text-white tracking-tight">
                        초기 투자금 대비 총 수익률
                    </h3>
                </div>
                <span className="text-[11px] text-gray-500">
                    현재 총평가{" "}
                    <span className="text-gray-300 font-medium">
                        {fmtShort(totalEvalAmount)}원
                    </span>{" "}
                    기준
                </span>
            </div>

            <div className="flex flex-col lg:flex-row gap-4">
                {/* ── 좌: 수익률 표시 ── */}
                <div className="flex-1 bg-gradient-to-br from-slate-800/60 to-slate-900/80 border border-white/8 rounded-2xl p-5 flex flex-col justify-between gap-4">
                    {returnRate !== null ? (
                        <>
                            {/* 수익률 숫자 */}
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="text-[11px] text-gray-500 mb-1">
                                        총 투자 원금
                                    </p>
                                    <p className="text-2xl font-black text-white">
                                        {fmtShort(totalPrincipal)}원
                                    </p>
                                </div>
                                <div className="text-right">
                                    <div
                                        className={`text-3xl font-black flex items-center gap-1 justify-end ${
                                            isProfit
                                                ? "text-rose-400"
                                                : "text-blue-400"
                                        }`}
                                    >
                                        {isProfit ? (
                                            <TrendingUp className="w-6 h-6" />
                                        ) : (
                                            <TrendingDown className="w-6 h-6" />
                                        )}
                                        {isProfit ? "+" : ""}
                                        {returnRate.toFixed(2)}%
                                    </div>
                                    {profit !== null && (
                                        <p
                                            className={`text-sm font-semibold mt-0.5 ${
                                                isProfit
                                                    ? "text-rose-400/80"
                                                    : "text-blue-400/80"
                                            }`}
                                        >
                                            {isProfit ? "+" : ""}
                                            {fmtShort(profit)}원
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* 총 자산 비교 바 */}
                            <div>
                                <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                                    <span>원금</span>
                                    <span>현재 평가액</span>
                                </div>
                                <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all duration-700 ${
                                            isProfit
                                                ? "bg-gradient-to-r from-rose-500 to-orange-400"
                                                : "bg-gradient-to-r from-blue-600 to-blue-400"
                                        }`}
                                        style={{
                                            width: `${Math.min(
                                                100,
                                                (totalPrincipal /
                                                    Math.max(
                                                        totalPrincipal,
                                                        totalEvalAmount
                                                    )) *
                                                    100
                                            )}%`,
                                        }}
                                    />
                                </div>
                                <div className="w-full h-2 bg-white/5 rounded-full mt-0.5 overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all duration-700 ${
                                            isProfit
                                                ? "bg-gradient-to-r from-emerald-500 to-teal-400"
                                                : "bg-gradient-to-r from-slate-500 to-slate-400"
                                        }`}
                                        style={{
                                            width: `${Math.min(
                                                100,
                                                (totalEvalAmount /
                                                    Math.max(
                                                        totalPrincipal,
                                                        totalEvalAmount
                                                    )) *
                                                    100
                                            )}%`,
                                        }}
                                    />
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-6 gap-2 text-center">
                            <TrendingUp className="w-8 h-8 text-gray-600" />
                            <p className="text-sm text-gray-500">
                                투자 원금을 입력하면
                            </p>
                            <p className="text-xs text-gray-600">
                                실제 수익률이 계산됩니다
                            </p>
                        </div>
                    )}
                </div>

                {/* ── 우: 원금 입력 목록 ── */}
                <div className="flex-1 bg-gradient-to-br from-emerald-950/40 to-slate-900/80 border border-emerald-500/15 rounded-2xl p-5 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                        <p className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">
                            투자 원금 항목
                        </p>
                        {editingKey !== "__NEW__" && (
                            <button
                                onClick={startAdd}
                                className="flex items-center gap-1 px-2.5 py-1 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/25 rounded-lg text-[11px] text-emerald-400 font-medium transition-all"
                            >
                                <Plus className="w-3 h-3" /> 항목 추가
                            </button>
                        )}
                    </div>

                    {/* 항목 리스트 */}
                    <div className="flex flex-col gap-2 flex-1">
                        {isLoaded && entries.length === 0 && editingKey !== "__NEW__" && (
                            <div className="flex flex-col items-center justify-center py-4 gap-2 bg-white/[0.02] rounded-xl border border-dashed border-white/10">
                                <p className="text-xs text-gray-500">아직 투자 원금이 없습니다</p>
                                <button
                                    onClick={startAdd}
                                    className="flex items-center gap-1 px-3 py-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/20 rounded-lg text-xs text-emerald-400 transition-all"
                                >
                                    <Plus className="w-3 h-3" /> 첫 항목 추가
                                </button>
                            </div>
                        )}

                        {entries.map((entry) =>
                            editingKey === entry.account_no ? (
                                <EditRow
                                    key={entry.account_no}
                                    label={editLabel}
                                    value={editValue}
                                    setLabel={setEditLabel}
                                    setValue={setEditValue}
                                    onSave={save}
                                    onCancel={cancelEdit}
                                    isSaving={isSaving}
                                />
                            ) : (
                                <div
                                    key={entry.account_no}
                                    className="flex items-center justify-between bg-white/[0.03] hover:bg-white/[0.05] rounded-xl px-3 py-2.5 transition-colors group"
                                >
                                    <div className="min-w-0">
                                        <p className="text-[11px] text-gray-400 truncate">
                                            {entry.label || "투자금"}
                                        </p>
                                        <p className="text-sm font-bold text-white">
                                            {fmtKRW(entry.principal)}원
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => startEdit(entry)}
                                            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                                            title="수정"
                                        >
                                            <Edit3 className="w-3 h-3 text-gray-400" />
                                        </button>
                                        <button
                                            onClick={() => remove(entry.account_no)}
                                            className="p-1.5 hover:bg-red-500/20 rounded-lg transition-colors"
                                            title="삭제"
                                        >
                                            <Trash2 className="w-3 h-3 text-gray-500" />
                                        </button>
                                    </div>
                                </div>
                            )
                        )}

                        {editingKey === "__NEW__" && (
                            <EditRow
                                label={editLabel}
                                value={editValue}
                                setLabel={setEditLabel}
                                setValue={setEditValue}
                                onSave={save}
                                onCancel={cancelEdit}
                                isSaving={isSaving}
                            />
                        )}
                    </div>

                    {/* 합계 */}
                    {entries.length > 1 && (
                        <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                            <p className="text-[11px] text-gray-500">합계</p>
                            <p className="text-sm font-black text-white">
                                {fmtKRW(totalPrincipal)}원
                            </p>
                        </div>
                    )}

                    {/* 안내 */}
                    <div className="flex items-start gap-1.5 mt-auto">
                        <Info className="w-3 h-3 text-gray-600 shrink-0 mt-0.5" />
                        <p className="text-[10px] text-gray-600 leading-relaxed">
                            계좌에 입금한 누적 금액을 직접 입력하세요. 입력 후 브라우저를 닫아도 유지됩니다.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── 입력 폼 서브컴포넌트 ──────────────────────────────────────────────────────
function EditRow({
    label, value, setLabel, setValue, onSave, onCancel, isSaving,
}: {
    label: string; value: string;
    setLabel: (v: string) => void; setValue: (v: string) => void;
    onSave: () => void; onCancel: () => void;
    isSaving: boolean;
}) {
    // 금액 콤마 포맷
    const handleAmountChange = (raw: string) => {
        const digits = raw.replace(/[^0-9]/g, "");
        setValue(digits ? new Intl.NumberFormat("ko-KR").format(Number(digits)) : "");
    };

    return (
        <div className="bg-emerald-900/15 border border-emerald-500/20 rounded-xl p-3 flex flex-col gap-2">
            <input
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500/40 transition-colors"
                placeholder="메모 (예: 은퇴자금, A계좌)"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                autoFocus
            />
            <div className="relative">
                <input
                    type="text"
                    inputMode="numeric"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm font-bold text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500/40 transition-colors pr-8"
                    placeholder="투자 원금 (원)"
                    value={value}
                    onChange={(e) => handleAmountChange(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && onSave()}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">원</span>
            </div>
            <div className="flex gap-2">
                <button
                    onClick={onSave}
                    disabled={isSaving || !value}
                    className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 rounded-lg text-xs text-emerald-300 font-semibold transition-all disabled:opacity-40"
                >
                    <Check className="w-3 h-3" />
                    {isSaving ? "저장 중..." : "저장"}
                </button>
                <button
                    onClick={onCancel}
                    className="flex-1 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs text-gray-400 transition-all"
                >
                    취소
                </button>
            </div>
        </div>
    );
}
