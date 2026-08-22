"use client";
import React, { useState, useEffect } from "react";
import { X, Wallet, Plus, Trash2, Save, Loader2 } from "lucide-react";
import { API_BASE } from "@/lib/apiConfig";

interface ManualCashModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

const CATEGORIES = [
    "기타저축계좌",
    "ISA",
    "연금저축펀드",
    "퇴직연금IRP",
    "일반주식계좌",
];

const BROKERS = [
    "케이뱅크",
    "미래에셋",
    "삼성증권",
    "토스증권",
    "KB증권",
    "신한투자",
    "카카오뱅크",
    "기타",
];

export default function ManualCashModal({
    isOpen,
    onClose,
    onSuccess,
}: ManualCashModalProps) {
    const [cashList, setCashList] = useState<any[]>([]);
    const [category, setCategory] = useState("기타저축계좌");
    const [accountName, setAccountName] = useState("");
    const [broker, setBroker] = useState("케이뱅크");
    const [cashKrw, setCashKrw] = useState("");
    const [cashUsd, setCashUsd] = useState("");
    const [memo, setMemo] = useState("");

    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchCashList = async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`${API_BASE}/api/v1/my/manual-cash`);
            if (res.ok) {
                const data = await res.json();
                setCashList(data);
            }
        } catch (e) {
            console.error("Failed to load cash list:", e);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            fetchCashList();
            setError(null);
            setAccountName("");
            setCashKrw("");
            setCashUsd("");
            setMemo("");
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleAddOrUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!accountName.trim()) {
            setError("계좌명 또는 금융기관명을 입력해 주세요.");
            return;
        }

        const krw = parseFloat(cashKrw.replace(/,/g, "")) || 0;
        const usd = parseFloat(cashUsd.replace(/,/g, "")) || 0;

        setIsSubmitting(true);
        setError(null);

        try {
            const payload = {
                category,
                account_name: accountName.trim(),
                broker,
                cash_krw: krw,
                cash_usd: usd,
                memo: memo.trim() || null,
            };

            const res = await fetch(`${API_BASE}/api/v1/my/manual-cash`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.detail || "예수금 저장에 실패했습니다.");
            }

            setAccountName("");
            setCashKrw("");
            setCashUsd("");
            setMemo("");
            await fetchCashList();
            onSuccess();
        } catch (err: any) {
            setError(err.message || "오류가 발생했습니다.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm("이 예수금 내역을 삭제하시겠습니까?")) return;
        try {
            const res = await fetch(`${API_BASE}/api/v1/my/manual-cash/${id}`, {
                method: "DELETE",
            });
            if (res.ok) {
                await fetchCashList();
                onSuccess();
            }
        } catch (e) {
            console.error("Delete cash error:", e);
        }
    };

    const fmtNum = (n: number) => new Intl.NumberFormat("ko-KR").format(Math.round(n));

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-[#12141a] border border-white/10 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="px-6 py-4 border-b border-white/10 flex justify-between items-center bg-white/[0.02]">
                    <div className="flex items-center gap-2.5">
                        <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
                            <Wallet className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-white">
                                타 금융사 예수금 / 현금 잔고 관리
                            </h3>
                            <p className="text-xs text-gray-400">
                                케이뱅크, 미래에셋, 삼성증권 등 수동 관리 예수금 및 외화 잔고
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

                <div className="p-6 overflow-y-auto space-y-5 text-xs sm:text-sm">
                    {/* Existing list */}
                    <div>
                        <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider mb-2.5">
                            현재 등록된 수동 예수금 목록
                        </h4>
                        {isLoading ? (
                            <div className="flex items-center justify-center p-6 text-gray-500">
                                <Loader2 className="w-5 h-5 animate-spin mr-2" /> 로딩 중...
                            </div>
                        ) : cashList.length === 0 ? (
                            <div className="p-4 rounded-xl bg-white/[0.02] border border-dashed border-white/10 text-center text-gray-500 text-xs">
                                등록된 수동 예수금이 없습니다. 아래에서 추가해 보세요.
                            </div>
                        ) : (
                            <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                                {cashList.map((item) => (
                                    <div
                                        key={item.id}
                                        className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition-all"
                                    >
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-white text-xs sm:text-sm">
                                                    {item.account_name}
                                                </span>
                                                <span className="px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 text-[10px]">
                                                    {item.category}
                                                </span>
                                                <span className="text-gray-400 text-[10px]">
                                                    ({item.broker})
                                                </span>
                                            </div>
                                            <div className="text-xs text-gray-400 mt-1 flex gap-3">
                                                <span>원화: <b className="text-emerald-400">{fmtNum(item.cash_krw || 0)}원</b></span>
                                                {(item.cash_usd > 0) && (
                                                    <span>외화: <b className="text-sky-400">${item.cash_usd.toLocaleString()}</b></span>
                                                )}
                                                {item.memo && <span className="text-gray-500">· {item.memo}</span>}
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleDelete(item.id)}
                                            className="p-1.5 text-gray-500 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition-colors"
                                            title="삭제"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Add Form */}
                    <form onSubmit={handleAddOrUpdate} className="pt-4 border-t border-white/10 space-y-3">
                        <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider">
                            새 예수금 / 현금 잔고 추가 및 갱신
                        </h4>

                        {error && (
                            <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs">
                                {error}
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-gray-400 text-xs font-semibold mb-1">
                                    계좌 분류
                                </label>
                                <select
                                    value={category}
                                    onChange={(e) => setCategory(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                                >
                                    {CATEGORIES.map((c) => (
                                        <option key={c} value={c} className="bg-[#12141a]">
                                            {c}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-gray-400 text-xs font-semibold mb-1">
                                    금융기관
                                </label>
                                <select
                                    value={broker}
                                    onChange={(e) => setBroker(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                                >
                                    {BROKERS.map((b) => (
                                        <option key={b} value={b} className="bg-[#12141a]">
                                            {b}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-gray-400 text-xs font-semibold mb-1">
                                계좌명 / 별칭 <span className="text-indigo-400">*</span>
                            </label>
                            <input
                                type="text"
                                value={accountName}
                                onChange={(e) => setAccountName(e.target.value)}
                                placeholder="예: 케이뱅크 플러스박스, 미래에셋 연금 예수금"
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500"
                                required
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-gray-400 text-xs font-semibold mb-1">
                                    원화 예수금 (KRW)
                                </label>
                                <input
                                    type="number"
                                    step="any"
                                    value={cashKrw}
                                    onChange={(e) => setCashKrw(e.target.value)}
                                    placeholder="0"
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500 text-right font-medium"
                                />
                            </div>

                            <div>
                                <label className="block text-gray-400 text-xs font-semibold mb-1">
                                    외화 예수금 (USD)
                                </label>
                                <input
                                    type="number"
                                    step="any"
                                    value={cashUsd}
                                    onChange={(e) => setCashUsd(e.target.value)}
                                    placeholder="0.00"
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500 text-right font-medium"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-gray-400 text-xs font-semibold mb-1">
                                메모 (선택)
                            </label>
                            <input
                                type="text"
                                value={memo}
                                onChange={(e) => setMemo(e.target.value)}
                                placeholder="비고 메모"
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500"
                            />
                        </div>

                        <div className="pt-2 flex justify-end">
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="flex items-center gap-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-emerald-600/30 disabled:opacity-50 text-xs"
                            >
                                {isSubmitting ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                    <Plus className="w-3.5 h-3.5" />
                                )}
                                예수금 저장
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
