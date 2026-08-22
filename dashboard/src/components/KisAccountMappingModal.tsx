"use client";
import React, { useState, useEffect } from "react";
import { X, Settings2, Save, Loader2 } from "lucide-react";
import { API_BASE } from "@/lib/apiConfig";

interface KisAccountMappingModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    kisAccounts: Array<{
        account_no: string;
        account_name: string;
        alias: string;
        category: string;
        country: string;
    }>;
}

const CATEGORIES = [
    "ISA",
    "연금저축펀드",
    "퇴직연금IRP",
    "기타투자계좌",
    "일반주식계좌",
];

const DEFAULT_MAPPINGS: Record<string, { alias: string; category: string; country: string }> = {
    "64490078-01": { alias: "한투 ISA", category: "ISA", country: "국내" },
    "81060777-22": { alias: "한투 퇴직연금IRP", category: "퇴직연금IRP", country: "국내" },
    "64896732-01": { alias: "한투 기타투자계좌", category: "기타투자계좌", country: "국내" },
    "81060777-01": { alias: "한투 일반주식계좌", category: "일반주식계좌", country: "국내" },
};

export default function KisAccountMappingModal({
    isOpen,
    onClose,
    onSuccess,
    kisAccounts,
}: KisAccountMappingModalProps) {
    const [mappings, setMappings] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            setMappings(
                kisAccounts.map((acc) => {
                    const def = DEFAULT_MAPPINGS[acc.account_no] || {};
                    let cat = acc.category;
                    if (!cat || cat === "기타저축계좌" || (cat === "일반주식계좌" && def.category && def.category !== "일반주식계좌")) {
                        cat = def.category || "일반주식계좌";
                    }
                    const alias = (acc.alias && acc.alias !== "연동계좌" && acc.alias !== "한투 연동계좌")
                        ? acc.alias
                        : (def.alias || acc.account_name || "한투 연동계좌");

                    return {
                        account_no: acc.account_no,
                        alias,
                        category: cat,
                        country: acc.country || def.country || "국내",
                    };
                })
            );
            setError(null);
        }
    }, [isOpen, kisAccounts]);

    if (!isOpen) return null;

    const handleCategoryChange = (accNo: string, newCat: string) => {
        setMappings((prev) =>
            prev.map((m) =>
                m.account_no === accNo ? { ...m, category: newCat } : m
            )
        );
    };

    const handleAliasChange = (accNo: string, newAlias: string) => {
        setMappings((prev) =>
            prev.map((m) =>
                m.account_no === accNo ? { ...m, alias: newAlias } : m
            )
        );
    };

    const handleSave = async () => {
        setIsSaving(true);
        setError(null);
        try {
            const res = await fetch(`${API_BASE}/api/v1/my/kis-mappings`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ mappings }),
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.detail || "설정 저장 실패");
            }
            onSuccess();
            onClose();
        } catch (e: any) {
            setError(e.message || "오류가 발생했습니다.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-[#12141a] border border-white/10 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="px-6 py-4 border-b border-white/10 flex justify-between items-center bg-white/[0.02]">
                    <div className="flex items-center gap-2.5">
                        <div className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400">
                            <Settings2 className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-white">
                                KIS 연동 계좌 카테고리 매핑 설정
                            </h3>
                            <p className="text-xs text-gray-400">
                                한국투자증권 연동 계좌를 ISA, 연금, IRP, 일반주식으로 분류합니다.
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto space-y-4 text-xs sm:text-sm">
                    {error && (
                        <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs">
                            {error}
                        </div>
                    )}

                    {mappings.length === 0 ? (
                        <div className="text-center py-8 text-gray-500 text-xs">
                            연동된 KIS 계좌 정보가 없습니다.
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {mappings.map((m, idx) => (
                                <div
                                    key={m.account_no}
                                    className="p-4 rounded-xl bg-white/5 border border-white/5 space-y-3"
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-300 flex items-center justify-center text-[10px] font-bold">
                                                {idx + 1}
                                            </span>
                                            <span className="font-mono text-xs text-indigo-300 font-semibold">
                                                {m.account_no}
                                            </span>
                                        </div>
                                        <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                            🟢 KIS 자동연동
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-gray-400 text-[11px] font-semibold mb-1">
                                                계좌 별칭 (화면 표시명)
                                            </label>
                                            <input
                                                type="text"
                                                value={m.alias}
                                                onChange={(e) =>
                                                    handleAliasChange(m.account_no, e.target.value)
                                                }
                                                placeholder="예: 한투 ISA, 한투 연금"
                                                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-white text-xs focus:outline-none focus:border-indigo-500"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-gray-400 text-[11px] font-semibold mb-1">
                                                분류 카테고리
                                            </label>
                                            <select
                                                value={m.category}
                                                onChange={(e) =>
                                                    handleCategoryChange(m.account_no, e.target.value)
                                                }
                                                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-white text-xs focus:outline-none focus:border-indigo-500"
                                            >
                                                {CATEGORIES.map((cat) => (
                                                    <option key={cat} value={cat} className="bg-[#12141a]">
                                                        {cat}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="flex justify-end gap-2 pt-3 border-t border-white/10">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl transition-colors text-xs font-medium"
                        >
                            취소
                        </button>
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={isSaving || mappings.length === 0}
                            className="flex items-center gap-1.5 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-600/30 disabled:opacity-50 text-xs"
                        >
                            {isSaving ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                                <Save className="w-3.5 h-3.5" />
                            )}
                            설정 저장
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
