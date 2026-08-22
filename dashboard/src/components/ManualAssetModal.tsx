"use client";
import React, { useState, useEffect } from "react";
import { X, Plus, Save, Trash2, HelpCircle, Loader2 } from "lucide-react";
import { API_BASE } from "@/lib/apiConfig";

interface ManualAssetModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    initialData?: any;
}

const CATEGORIES = [
    "ISA",
    "연금저축펀드",
    "퇴직연금IRP",
    "기타투자계좌",
    "일반주식계좌",
];

const BROKERS = [
    "미래에셋",
    "삼성증권",
    "케이뱅크",
    "토스증권",
    "KB증권",
    "신한투자",
    "NH투자",
    "키움증권",
    "한국투자(수동)",
    "기타",
];

const SECTORS = [
    "반도체",
    "빅테크/성장",
    "AI전력/인프라",
    "배당/커버드콜",
    "통신",
    "금융/지주",
    "우주항공",
    "바이오/헬스",
    "예적금/현금성",
    "해외비상장",
    "기타",
];

export default function ManualAssetModal({
    isOpen,
    onClose,
    onSuccess,
    initialData,
}: ManualAssetModalProps) {
    const isEdit = !!initialData;

    const [category, setCategory] = useState("기타투자계좌");
    const [accountName, setAccountName] = useState("");
    const [broker, setBroker] = useState("미래에셋");
    const [assetName, setAssetName] = useState("");
    const [ticker, setTicker] = useState("");
    const [currency, setCurrency] = useState("KRW");
    const [purchasePrice, setPurchasePrice] = useState<string>("");
    const [currentPrice, setCurrentPrice] = useState<string>("");
    const [quantity, setQuantity] = useState<string>("1");
    const [sector, setSector] = useState("기타");
    const [country, setCountry] = useState("국내");
    const [memo, setMemo] = useState("");

    const [isLoading, setIsLoading] = useState(false);
    const [isLookingUpPrice, setIsLookingUpPrice] = useState(false);
    const [lookupSuccessMsg, setLookupSuccessMsg] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleLookupTicker = async (targetTicker?: string) => {
        const code = (targetTicker !== undefined ? targetTicker : ticker).trim().toUpperCase();
        if (!code) return;
        setIsLookingUpPrice(true);
        setLookupSuccessMsg(null);
        try {
            const res = await fetch(`${API_BASE}/api/v1/my/stock-price?ticker=${encodeURIComponent(code)}`);
            if (!res.ok) {
                const errJson = await res.json();
                throw new Error(errJson.detail || "시세를 조회할 수 없습니다.");
            }
            const { data } = await res.json();
            if (data && data.price !== undefined && data.price !== null) {
                setCurrentPrice(String(data.price));
                if (!assetName || assetName.trim() === code) {
                    setAssetName(data.name || code);
                }
                if (data.currency) {
                    setCurrency(data.currency);
                }
                if (data.country) {
                    setCountry(data.country);
                }
                const formattedPrice = data.currency === "USD"
                    ? `$${Number(data.price).toFixed(2)}`
                    : `${Number(data.price).toLocaleString()}원`;
                setLookupSuccessMsg(`🟢 실시간 시세 연동: ${data.name || code} (${formattedPrice})`);
            }
        } catch (e: any) {
            console.warn("Ticker price lookup failed:", e);
            setLookupSuccessMsg(`⚠️ ${e.message || "시세 조회 실패"}`);
        } finally {
            setIsLookingUpPrice(false);
        }
    };

    useEffect(() => {
        if (initialData) {
            const cat = initialData.category === "기타저축계좌" ? "기타투자계좌" : (initialData.category || "기타투자계좌");
            setCategory(cat);
            setAccountName(initialData.account_name || "");
            setBroker(initialData.broker || "미래에셋");
            setAssetName(initialData.name || initialData.asset_name || "");
            setTicker(initialData.code || initialData.ticker || "");
            setCurrency(initialData.currency || "KRW");
            setPurchasePrice(String(initialData.purchase_price ?? ""));
            setCurrentPrice(String(initialData.current_price ?? ""));
            setQuantity(String(initialData.quantity ?? "1"));
            setSector(initialData.sector || "기타");
            setCountry(initialData.country || "국내");
            setMemo(initialData.memo || "");
        } else {
            setCategory("기타투자계좌");
            setAccountName("");
            setBroker("미래에셋");
            setAssetName("");
            setTicker("");
            setCurrency("KRW");
            setPurchasePrice("");
            setCurrentPrice("");
            setQuantity("1");
            setSector("기타");
            setCountry("국내");
            setMemo("");
        }
        setError(null);
        setLookupSuccessMsg(null);
    }, [initialData, isOpen]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!assetName.trim()) {
            setError("종목명(상품명)을 입력해 주세요.");
            return;
        }

        const pPrice = parseFloat(purchasePrice.replace(/,/g, "")) || 0;
        const cPrice = currentPrice ? parseFloat(currentPrice.replace(/,/g, "")) : pPrice;
        const qty = parseFloat(quantity.replace(/,/g, "")) || 1;

        setIsLoading(true);
        setError(null);

        try {
            const payload = {
                category,
                account_name: accountName.trim() || broker,
                broker,
                asset_name: assetName.trim(),
                ticker: ticker.trim() || null,
                currency,
                purchase_price: pPrice,
                current_price: cPrice,
                quantity: qty,
                sector,
                country: currency === "USD" ? "해외" : country,
                memo: memo.trim() || null,
            };

            const url = isEdit
                ? `${API_BASE}/api/v1/my/manual-assets/${initialData.manual_id || initialData.id}`
                : `${API_BASE}/api/v1/my/manual-assets`;

            const res = await fetch(url, {
                method: isEdit ? "PUT" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.detail || "저장에 실패했습니다.");
            }

            onSuccess();
            onClose();
        } catch (err: any) {
            setError(err.message || "오류가 발생했습니다.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!isEdit || !confirm("이 자산을 삭제하시겠습니까?")) return;
        setIsLoading(true);
        try {
            const assetId = initialData.manual_id || initialData.id;
            const res = await fetch(`${API_BASE}/api/v1/my/manual-assets/${assetId}`, {
                method: "DELETE",
            });
            if (!res.ok) throw new Error("삭제에 실패했습니다.");
            onSuccess();
            onClose();
        } catch (err: any) {
            setError(err.message || "삭제 실패");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-[#12141a] border border-white/10 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="px-6 py-4 border-b border-white/10 flex justify-between items-center bg-white/[0.02]">
                    <div className="flex items-center gap-2.5">
                        <div className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400">
                            <Plus className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-white">
                                {isEdit ? "수동 자산 수정" : "타 증권사/기타 자산 추가"}
                            </h3>
                            <p className="text-xs text-gray-400">
                                미래에셋, 삼성증권, 케이뱅크, 비상장 등 수동 관리 자산
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

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 text-xs sm:text-sm">
                    {error && (
                        <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs">
                            {error}
                        </div>
                    )}

                    {/* 카테고리 & 금융사 */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-gray-400 text-xs font-semibold mb-1">
                                계좌 분류 <span className="text-indigo-400">*</span>
                            </label>
                            <select
                                value={category}
                                onChange={(e) => setCategory(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500 transition-colors"
                            >
                                {CATEGORIES.map((cat) => (
                                    <option key={cat} value={cat} className="bg-[#12141a]">
                                        {cat}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-gray-400 text-xs font-semibold mb-1">
                                금융기관 / 증권사 <span className="text-indigo-400">*</span>
                            </label>
                            <select
                                value={broker}
                                onChange={(e) => setBroker(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500 transition-colors"
                            >
                                {BROKERS.map((b) => (
                                    <option key={b} value={b} className="bg-[#12141a]">
                                        {b}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* 계좌명 & 통화 */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-gray-400 text-xs font-semibold mb-1">
                                계좌명 / 별칭 (선택)
                            </label>
                            <input
                                type="text"
                                value={accountName}
                                onChange={(e) => setAccountName(e.target.value)}
                                placeholder="예: 미래에셋 연금, 플러스박스"
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500"
                            />
                        </div>

                        <div>
                            <label className="block text-gray-400 text-xs font-semibold mb-1">
                                통화 (Currency)
                            </label>
                            <div className="flex gap-2">
                                {["KRW", "USD"].map((cur) => (
                                    <button
                                        type="button"
                                        key={cur}
                                        onClick={() => {
                                            setCurrency(cur);
                                            if (cur === "USD") setCountry("해외");
                                        }}
                                        className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-all ${
                                            currency === cur
                                                ? "bg-indigo-500/20 border-indigo-500 text-indigo-300"
                                                : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10"
                                        }`}
                                    >
                                        {cur === "KRW" ? "🇰🇷 KRW (원)" : "🇺🇸 USD (달러)"}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* 종목명 & 티커 */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-gray-400 text-xs font-semibold mb-1">
                                종목명 / 상품명 <span className="text-indigo-400">*</span>
                            </label>
                            <input
                                type="text"
                                value={assetName}
                                onChange={(e) => setAssetName(e.target.value)}
                                placeholder="예: KT, 미래에셋글로벌, SpaceX"
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 font-medium"
                                required
                            />
                        </div>

                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <label className="block text-gray-400 text-xs font-semibold">
                                    종목코드 / 티커
                                </label>
                                <span className="text-[10px] text-indigo-400">입력 시 현재가 자동조회</span>
                            </div>
                            <div className="flex gap-1.5">
                                <input
                                    type="text"
                                    value={ticker}
                                    onChange={(e) => setTicker(e.target.value.toUpperCase())}
                                    onBlur={() => handleLookupTicker()}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                            e.preventDefault();
                                            handleLookupTicker();
                                        }
                                    }}
                                    placeholder="예: 030200, AAPL"
                                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 font-mono uppercase"
                                />
                                <button
                                    type="button"
                                    onClick={() => handleLookupTicker()}
                                    disabled={isLookingUpPrice || !ticker.trim()}
                                    className="px-3 py-2 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/30 rounded-xl transition-all disabled:opacity-40 text-xs font-medium flex items-center gap-1 shrink-0"
                                >
                                    {isLookingUpPrice ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                        "조회"
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>

                    {lookupSuccessMsg && (
                        <div className={`px-3 py-2 rounded-xl text-xs flex items-center gap-1.5 ${
                            lookupSuccessMsg.startsWith("🟢")
                                ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-300"
                                : "bg-amber-500/10 border border-amber-500/20 text-amber-300"
                        }`}>
                            {lookupSuccessMsg}
                        </div>
                    )}

                    {/* 매수단가 & 현재가 & 수량 */}
                    <div className="grid grid-cols-3 gap-3">
                        <div>
                            <label className="block text-gray-400 text-xs font-semibold mb-1">
                                매수단가 ({currency})
                            </label>
                            <input
                                type="number"
                                step="any"
                                value={purchasePrice}
                                onChange={(e) => setPurchasePrice(e.target.value)}
                                placeholder="0"
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500 text-right"
                            />
                        </div>

                        <div>
                            <label className="block text-gray-400 text-xs font-semibold mb-1">
                                현재가 ({currency})
                            </label>
                            <input
                                type="number"
                                step="any"
                                value={currentPrice}
                                onChange={(e) => setCurrentPrice(e.target.value)}
                                placeholder="미입력시 매수가동일"
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500 text-right"
                            />
                        </div>

                        <div>
                            <label className="block text-gray-400 text-xs font-semibold mb-1">
                                보유수량 (주/원)
                            </label>
                            <input
                                type="number"
                                step="any"
                                value={quantity}
                                onChange={(e) => setQuantity(e.target.value)}
                                placeholder="1"
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500 text-right"
                            />
                        </div>
                    </div>

                    {/* 섹터 분류 & 메모 */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-gray-400 text-xs font-semibold mb-1">
                                섹터 / 자산 분류
                            </label>
                            <select
                                value={sector}
                                onChange={(e) => setSector(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                            >
                                {SECTORS.map((s) => (
                                    <option key={s} value={s} className="bg-[#12141a]">
                                        {s}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-gray-400 text-xs font-semibold mb-1">
                                메모 / 비고 (선택)
                            </label>
                            <input
                                type="text"
                                value={memo}
                                onChange={(e) => setMemo(e.target.value)}
                                placeholder="비고 메모"
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500"
                            />
                        </div>
                    </div>

                    {/* Buttons */}
                    <div className="flex items-center justify-between pt-3 border-t border-white/10">
                        {isEdit ? (
                            <button
                                type="button"
                                onClick={handleDelete}
                                disabled={isLoading}
                                className="flex items-center gap-1.5 px-3 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-xl transition-all disabled:opacity-50 text-xs font-medium"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                                삭제
                            </button>
                        ) : <div />}

                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={isLoading}
                                className="px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl transition-colors text-xs font-medium"
                            >
                                취소
                            </button>
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="flex items-center gap-1.5 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-600/30 disabled:opacity-50 text-xs"
                            >
                                {isLoading ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                    <Save className="w-3.5 h-3.5" />
                                )}
                                {isEdit ? "수정 완료" : "자산 등록"}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}
