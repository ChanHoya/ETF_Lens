"use client";
import React, { useState, useEffect } from "react";
import { X, Plus, Save, Trash2, Loader2, Sparkles, Layers } from "lucide-react";
import { API_BASE } from "@/lib/apiConfig";

interface ManualAssetModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    initialData?: any;
}

const CATEGORIES = [
    "기타투자계좌",
    "ISA",
    "연금저축펀드",
    "퇴직연금IRP",
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
    "카카오뱅크",
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

interface BatchRow {
    id: string;
    category: string;
    broker: string;
    accountName: string;
    assetName: string;
    ticker: string;
    currency: string;
    purchasePrice: string;
    currentPrice: string;
    quantity: string;
    sector: string;
    country: string;
    memo: string;
    isLookingUp?: boolean;
    lookupMsg?: string;
}

const createEmptyRow = (defaultCategory = "기타투자계좌", defaultBroker = "미래에셋"): BatchRow => ({
    id: Math.random().toString(36).substring(2, 9),
    category: defaultCategory,
    broker: defaultBroker,
    accountName: "",
    assetName: "",
    ticker: "",
    currency: "KRW",
    purchasePrice: "",
    currentPrice: "",
    quantity: "1",
    sector: "기타",
    country: "국내",
    memo: "",
});

export default function ManualAssetModal({
    isOpen,
    onClose,
    onSuccess,
    initialData,
}: ManualAssetModalProps) {
    const isEdit = !!initialData;

    // Single Edit State
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

    // Batch Add State
    const [batchRows, setBatchRows] = useState<BatchRow[]>([
        createEmptyRow("기타투자계좌", "미래에셋"),
        createEmptyRow("기타투자계좌", "삼성증권"),
    ]);

    const [isLoading, setIsLoading] = useState(false);
    const [isLookingUpPrice, setIsLookingUpPrice] = useState(false);
    const [lookupSuccessMsg, setLookupSuccessMsg] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Initial Load
    useEffect(() => {
        if (initialData) {
            const rawCat = initialData.category === "기타저축계좌" ? "기타투자계좌" : (initialData.category || "기타투자계좌");
            setCategory(rawCat);
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
            setBatchRows([
                createEmptyRow("기타투자계좌", "미래에셋"),
                createEmptyRow("기타투자계좌", "삼성증권"),
            ]);
        }
        setError(null);
        setLookupSuccessMsg(null);
    }, [initialData, isOpen]);

    if (!isOpen) return null;

    // Single Ticker Lookup
    const handleLookupSingleTicker = async (targetTicker?: string) => {
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

    // Batch Row Ticker Lookup
    const handleLookupBatchRow = async (rowIndex: number) => {
        const row = batchRows[rowIndex];
        const code = (row.ticker || "").trim().toUpperCase();
        if (!code) return;

        setBatchRows((prev) =>
            prev.map((r, i) => (i === rowIndex ? { ...r, isLookingUp: true, lookupMsg: undefined } : r))
        );

        try {
            const res = await fetch(`${API_BASE}/api/v1/my/stock-price?ticker=${encodeURIComponent(code)}`);
            if (!res.ok) throw new Error("시세 조회 불가");
            const { data } = await res.json();
            if (data && data.price !== undefined && data.price !== null) {
                setBatchRows((prev) =>
                    prev.map((r, i) => {
                        if (i !== rowIndex) return r;
                        const formattedPrice = data.currency === "USD"
                            ? `$${Number(data.price).toFixed(2)}`
                            : `${Number(data.price).toLocaleString()}원`;
                        return {
                            ...r,
                            ticker: code,
                            assetName: (!r.assetName || r.assetName.trim() === code) ? (data.name || code) : r.assetName,
                            currentPrice: String(data.price),
                            currency: data.currency || r.currency,
                            country: data.country || r.country,
                            isLookingUp: false,
                            lookupMsg: `🟢 ${formattedPrice}`,
                        };
                    })
                );
            }
        } catch (e: any) {
            setBatchRows((prev) =>
                prev.map((r, i) => (i === rowIndex ? { ...r, isLookingUp: false, lookupMsg: "⚠️ 미조회" } : r))
            );
        }
    };

    // Lookup All Batch Rows with Tickers
    const handleLookupAllBatch = async () => {
        for (let i = 0; i < batchRows.length; i++) {
            if (batchRows[i].ticker && batchRows[i].ticker.trim()) {
                await handleLookupBatchRow(i);
            }
        }
    };

    const handleAddBatchRow = () => {
        const lastRow = batchRows[batchRows.length - 1];
        setBatchRows((prev) => [
            ...prev,
            createEmptyRow(lastRow?.category || "기타투자계좌", lastRow?.broker || "미래에셋"),
        ]);
    };

    const handleRemoveBatchRow = (index: number) => {
        if (batchRows.length <= 1) return;
        setBatchRows((prev) => prev.filter((_, i) => i !== index));
    };

    const handleUpdateBatchRow = (index: number, field: keyof BatchRow, val: any) => {
        setBatchRows((prev) =>
            prev.map((r, i) => (i === index ? { ...r, [field]: val } : r))
        );
    };

    // Submit Handler (Single Edit vs Batch Add)
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsLoading(true);

        try {
            if (isEdit) {
                // 단일 자산 수정 (계좌이동 포함)
                if (!assetName.trim()) {
                    throw new Error("종목명(상품명)을 입력해 주세요.");
                }

                const pPrice = parseFloat(purchasePrice.replace(/,/g, "")) || 0;
                let cPrice = currentPrice ? parseFloat(currentPrice.replace(/,/g, "")) : 0;
                const qty = parseFloat(quantity.replace(/,/g, "")) || 1;

                const payload = {
                    category,
                    account_name: accountName.trim() || broker,
                    broker,
                    asset_name: assetName.trim(),
                    ticker: ticker.trim().toUpperCase() || null,
                    currency,
                    purchase_price: pPrice,
                    current_price: cPrice,
                    quantity: qty,
                    sector,
                    country: currency === "USD" ? "해외" : country,
                    memo: memo.trim() || null,
                };

                const assetId = initialData.manual_id || initialData.id;
                const res = await fetch(`${API_BASE}/api/v1/my/manual-assets/${assetId}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });

                if (!res.ok) {
                    const errData = await res.json();
                    throw new Error(errData.detail || "수정에 실패했습니다.");
                }
            } else {
                // 다중 종목 일괄 추가
                const validRows = batchRows.filter(
                    (r) => r.assetName.trim() !== "" || r.ticker.trim() !== ""
                );

                if (validRows.length === 0) {
                    throw new Error("최소 1개 이상의 종목명 또는 종목코드를 입력해 주세요.");
                }

                const payloadAssets = validRows.map((r) => {
                    const pPrice = parseFloat(r.purchasePrice.replace(/,/g, "")) || 0;
                    let cPrice = r.currentPrice ? parseFloat(r.currentPrice.replace(/,/g, "")) : 0;
                    const qty = parseFloat(r.quantity.replace(/,/g, "")) || 1;

                    return {
                        category: r.category,
                        account_name: r.accountName.trim() || r.broker,
                        broker: r.broker,
                        asset_name: r.assetName.trim() || r.ticker.trim().toUpperCase(),
                        ticker: r.ticker.trim().toUpperCase() || null,
                        currency: r.currency,
                        purchase_price: pPrice,
                        current_price: cPrice,
                        quantity: qty,
                        sector: r.sector || "기타",
                        country: r.currency === "USD" ? "해외" : r.country,
                        memo: r.memo.trim() || null,
                    };
                });

                const res = await fetch(`${API_BASE}/api/v1/my/manual-assets/batch`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ assets: payloadAssets }),
                });

                if (!res.ok) {
                    const errData = await res.json();
                    throw new Error(errData.detail || "일괄 등록에 실패했습니다.");
                }
            }

            onSuccess();
            onClose();
        } catch (err: any) {
            setError(err.message || "오류가 발생했습니다.");
        } finally {
            setIsLoading(false);
        }
    };

    // Delete Single Asset
    const handleDelete = async () => {
        if (!isEdit || !confirm(`[${assetName || "선택한 종목"}] 자산을 삭제하시겠습니까?`)) return;
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
            <div className={`bg-[#12141a] border border-white/10 rounded-2xl w-full ${
                isEdit ? "max-w-xl" : "max-w-5xl"
            } overflow-hidden shadow-2xl flex flex-col max-h-[92vh]`}>
                {/* Header */}
                <div className="px-5 py-3.5 border-b border-white/10 flex justify-between items-center bg-white/[0.02]">
                    <div className="flex items-center gap-2.5">
                        <div className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400">
                            {isEdit ? <Layers className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-white flex items-center gap-2">
                                {isEdit ? "수동 자산 수정 및 계좌 이동" : "타 증권사 자산 다중 일괄 등록"}
                                {!isEdit && (
                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-normal">
                                        여러 종목 동시 입력
                                    </span>
                                )}
                            </h3>
                            <p className="text-xs text-gray-400">
                                {isEdit
                                    ? "계좌 분류 변경(이동), 종목 정보 수정 및 삭제를 진행합니다."
                                    : "미래에셋, 삼성증권, 케이뱅크 등의 보유 종목을 한 화면에서 여러 개 입력합니다."}
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

                {/* Form Body */}
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs sm:text-sm">
                    {error && (
                        <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs">
                            {error}
                        </div>
                    )}

                    {isEdit ? (
                        /* ── SINGLE ASSET EDIT MODE ── */
                        <div className="space-y-4">
                            {/* Category Transfer / Broker */}
                            <div className="grid grid-cols-2 gap-3 p-3 bg-indigo-500/[0.05] border border-indigo-500/20 rounded-xl">
                                <div>
                                    <label className="block text-indigo-300 text-xs font-bold mb-1 flex items-center gap-1">
                                        <span>🔄 계좌 분류 (계좌 이동)</span>
                                        <span className="text-rose-400">*</span>
                                    </label>
                                    <select
                                        value={category}
                                        onChange={(e) => setCategory(e.target.value)}
                                        className="w-full bg-[#161922] border border-indigo-500/40 rounded-xl px-3 py-2 text-white font-bold focus:outline-none focus:border-indigo-400"
                                    >
                                        {CATEGORIES.map((cat) => (
                                            <option key={cat} value={cat} className="bg-[#12141a]">
                                                {cat}
                                            </option>
                                        ))}
                                    </select>
                                    <p className="text-[10px] text-gray-400 mt-1">
                                        선택한 계좌 분류로 종목이 즉시 이동됩니다.
                                    </p>
                                </div>

                                <div>
                                    <label className="block text-gray-400 text-xs font-semibold mb-1">
                                        금융기관 / 증권사 <span className="text-indigo-400">*</span>
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

                            {/* Account Name & Currency */}
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

                            {/* Asset Name & Ticker */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-gray-400 text-xs font-semibold mb-1">
                                        종목명 / 상품명 <span className="text-indigo-400">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={assetName}
                                        onChange={(e) => setAssetName(e.target.value)}
                                        placeholder="예: 삼성전자, KT, Apple"
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 font-medium"
                                        required
                                    />
                                </div>

                                <div>
                                    <div className="flex justify-between items-center mb-1">
                                        <label className="block text-gray-400 text-xs font-semibold">
                                            종목코드 / 티커
                                        </label>
                                        <span className="text-[10px] text-indigo-400">입력 시 실시간 시세 연동</span>
                                    </div>
                                    <div className="flex gap-1.5">
                                        <input
                                            type="text"
                                            value={ticker}
                                            onChange={(e) => setTicker(e.target.value.toUpperCase())}
                                            onBlur={() => handleLookupSingleTicker()}
                                            placeholder="예: 005930, AAPL"
                                            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 font-mono uppercase"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => handleLookupSingleTicker()}
                                            disabled={isLookingUpPrice || !ticker.trim()}
                                            className="px-3 py-2 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/30 rounded-xl transition-all disabled:opacity-40 text-xs font-medium flex items-center gap-1 shrink-0"
                                        >
                                            {isLookingUpPrice ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "조회"}
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

                            {/* Purchase Price & Current Price & Quantity */}
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
                                        placeholder="종목코드 입력시 자동조회"
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500 text-right font-semibold"
                                    />
                                </div>

                                <div>
                                    <label className="block text-gray-400 text-xs font-semibold mb-1">
                                        보유수량
                                    </label>
                                    <input
                                        type="number"
                                        step="any"
                                        value={quantity}
                                        onChange={(e) => setQuantity(e.target.value)}
                                        placeholder="1"
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500 text-right font-semibold"
                                    />
                                </div>
                            </div>

                            {/* Sector & Memo */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-gray-400 text-xs font-semibold mb-1">
                                        섹터 / 분류
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
                        </div>
                    ) : (
                        /* ── BATCH MULTI-ASSET INPUT MODE ── */
                        <div className="space-y-3">
                            {/* Toolbar */}
                            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-white/10">
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={handleAddBatchRow}
                                        className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 rounded-xl text-xs font-semibold transition-all hover:scale-105"
                                    >
                                        <Plus className="w-3.5 h-3.5" />
                                        <span>+ 행 추가</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={handleLookupAllBatch}
                                        className="flex items-center gap-1 px-3 py-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-semibold transition-all"
                                    >
                                        <Sparkles className="w-3.5 h-3.5" />
                                        <span>⚡ 전체 실시간 시세 자동 조회</span>
                                    </button>
                                </div>

                                <span className="text-xs text-gray-400">
                                    총 <span className="text-white font-bold">{batchRows.length}</span>개 행 입력 중
                                </span>
                            </div>

                            {/* Batch Table */}
                            <div className="overflow-x-auto border border-white/10 rounded-xl bg-black/20">
                                <table className="w-full text-left text-xs border-collapse min-w-[780px]">
                                    <thead>
                                        <tr className="bg-white/[0.04] border-b border-white/10 text-gray-400 font-semibold">
                                            <th className="py-2.5 px-3 w-32">계좌 분류</th>
                                            <th className="py-2.5 px-2 w-28">금융사</th>
                                            <th className="py-2.5 px-2 w-28">종목코드(티커)</th>
                                            <th className="py-2.5 px-3">종목명/상품명 *</th>
                                            <th className="py-2.5 px-2 w-20 text-center">통화</th>
                                            <th className="py-2.5 px-2 w-24 text-right">매수단가</th>
                                            <th className="py-2.5 px-2 w-28 text-right">현재가</th>
                                            <th className="py-2.5 px-2 w-16 text-right">수량</th>
                                            <th className="py-2.5 px-2 w-24">섹터</th>
                                            <th className="py-2.5 px-2 w-10 text-center">삭제</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {batchRows.map((row, idx) => (
                                            <tr key={row.id} className="hover:bg-white/[0.02] transition-colors">
                                                {/* 계좌 분류 */}
                                                <td className="py-2 px-2">
                                                    <select
                                                        value={row.category}
                                                        onChange={(e) =>
                                                            handleUpdateBatchRow(idx, "category", e.target.value)
                                                        }
                                                        className="w-full bg-[#161922] border border-white/10 rounded-lg px-2 py-1 text-white focus:outline-none focus:border-indigo-500 text-xs"
                                                    >
                                                        {CATEGORIES.map((c) => (
                                                            <option key={c} value={c} className="bg-[#12141a]">
                                                                {c}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </td>

                                                {/* 금융사 */}
                                                <td className="py-2 px-2">
                                                    <select
                                                        value={row.broker}
                                                        onChange={(e) =>
                                                            handleUpdateBatchRow(idx, "broker", e.target.value)
                                                        }
                                                        className="w-full bg-[#161922] border border-white/10 rounded-lg px-2 py-1 text-white focus:outline-none focus:border-indigo-500 text-xs"
                                                    >
                                                        {BROKERS.map((b) => (
                                                            <option key={b} value={b} className="bg-[#12141a]">
                                                                {b}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </td>

                                                {/* 종목코드 */}
                                                <td className="py-2 px-2">
                                                    <div className="flex items-center gap-1">
                                                        <input
                                                            type="text"
                                                            value={row.ticker}
                                                            onChange={(e) =>
                                                                handleUpdateBatchRow(idx, "ticker", e.target.value.toUpperCase())
                                                            }
                                                            onBlur={() => handleLookupBatchRow(idx)}
                                                            placeholder="005930"
                                                            className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 font-mono uppercase text-xs"
                                                        />
                                                        {row.isLookingUp && (
                                                            <Loader2 className="w-3 h-3 text-indigo-400 animate-spin shrink-0" />
                                                        )}
                                                    </div>
                                                    {row.lookupMsg && (
                                                        <div className="text-[9px] text-emerald-400 font-mono mt-0.5 whitespace-nowrap">
                                                            {row.lookupMsg}
                                                        </div>
                                                    )}
                                                </td>

                                                {/* 종목명 */}
                                                <td className="py-2 px-2">
                                                    <input
                                                        type="text"
                                                        value={row.assetName}
                                                        onChange={(e) =>
                                                            handleUpdateBatchRow(idx, "assetName", e.target.value)
                                                        }
                                                        placeholder="예: 삼성전자"
                                                        className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 text-xs font-medium"
                                                    />
                                                </td>

                                                {/* 통화 */}
                                                <td className="py-2 px-1 text-center">
                                                    <select
                                                        value={row.currency}
                                                        onChange={(e) =>
                                                            handleUpdateBatchRow(idx, "currency", e.target.value)
                                                        }
                                                        className="bg-[#161922] border border-white/10 rounded-lg px-1.5 py-1 text-gray-300 text-xs focus:outline-none"
                                                    >
                                                        <option value="KRW">KRW</option>
                                                        <option value="USD">USD</option>
                                                    </select>
                                                </td>

                                                {/* 매수단가 */}
                                                <td className="py-2 px-2">
                                                    <input
                                                        type="number"
                                                        step="any"
                                                        value={row.purchasePrice}
                                                        onChange={(e) =>
                                                            handleUpdateBatchRow(idx, "purchasePrice", e.target.value)
                                                        }
                                                        placeholder="0"
                                                        className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-white text-right font-mono text-xs focus:outline-none focus:border-indigo-500"
                                                    />
                                                </td>

                                                {/* 현재가 */}
                                                <td className="py-2 px-2">
                                                    <input
                                                        type="number"
                                                        step="any"
                                                        value={row.currentPrice}
                                                        onChange={(e) =>
                                                            handleUpdateBatchRow(idx, "currentPrice", e.target.value)
                                                        }
                                                        placeholder="자동조회"
                                                        className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-white text-right font-mono text-xs font-semibold focus:outline-none focus:border-indigo-500"
                                                    />
                                                </td>

                                                {/* 수량 */}
                                                <td className="py-2 px-2">
                                                    <input
                                                        type="number"
                                                        step="any"
                                                        value={row.quantity}
                                                        onChange={(e) =>
                                                            handleUpdateBatchRow(idx, "quantity", e.target.value)
                                                        }
                                                        placeholder="1"
                                                        className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-white text-right font-mono text-xs font-semibold focus:outline-none focus:border-indigo-500"
                                                    />
                                                </td>

                                                {/* 섹터 */}
                                                <td className="py-2 px-2">
                                                    <select
                                                        value={row.sector}
                                                        onChange={(e) =>
                                                            handleUpdateBatchRow(idx, "sector", e.target.value)
                                                        }
                                                        className="w-full bg-[#161922] border border-white/10 rounded-lg px-2 py-1 text-white focus:outline-none focus:border-indigo-500 text-xs"
                                                    >
                                                        {SECTORS.map((s) => (
                                                            <option key={s} value={s} className="bg-[#12141a]">
                                                                {s}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </td>

                                                {/* 삭제 버튼 */}
                                                <td className="py-2 px-2 text-center">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveBatchRow(idx)}
                                                        disabled={batchRows.length <= 1}
                                                        className="p-1 text-gray-500 hover:text-rose-400 disabled:opacity-30 rounded hover:bg-white/5 transition-colors"
                                                        title="행 삭제"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="flex items-center justify-between text-[11px] text-gray-500 pt-1">
                                <span>💡 종목코드 입력 시 현재가가 자동으로 조회됩니다. 미입력 시 서버에서 실시간 조회하여 등록됩니다.</span>
                                <button
                                    type="button"
                                    onClick={handleAddBatchRow}
                                    className="text-indigo-400 hover:underline font-semibold"
                                >
                                    + 행 추가하기
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Bottom Actions */}
                    <div className="flex items-center justify-between pt-3 border-t border-white/10">
                        {isEdit ? (
                            <button
                                type="button"
                                onClick={handleDelete}
                                disabled={isLoading}
                                className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border border-rose-500/30 rounded-xl transition-all disabled:opacity-50 text-xs font-semibold hover:scale-105 active:scale-95"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>이 분류에서 삭제</span>
                            </button>
                        ) : (
                            <div className="text-xs text-gray-400">
                                {batchRows.filter((r) => r.assetName || r.ticker).length}개 종목 등록 대기
                            </div>
                        )}

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
                                className="flex items-center gap-1.5 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-600/30 disabled:opacity-50 text-xs hover:scale-105 active:scale-95"
                            >
                                {isLoading ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                    <Save className="w-3.5 h-3.5" />
                                )}
                                <span>{isEdit ? "계좌 이동 및 수정 저장" : "일괄 등록 완료"}</span>
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}
