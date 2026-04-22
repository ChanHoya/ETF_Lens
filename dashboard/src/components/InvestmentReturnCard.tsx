"use client";
import React, { useState, useEffect, useCallback } from "react";
import { TrendingUp, TrendingDown, Edit3, Check, X, RefreshCw, Info, Wallet, PiggyBank } from "lucide-react";
import { API_BASE } from "@/lib/apiConfig";

interface Principal {
    account_no: string;
    principal: number;
    label: string;
    updated_at: string | null;
}

interface CashflowData {
    status: string;
    total_net_invested: number;
    total_eval_amount: number;
    auto_return_rate: number | null;
    period: string;
    note: string;
}

interface Props {
    totalEvalAmount: number;  // 현재 총 평가금액 (포트폴리오에서)
}

const fmt = (n: number) => new Intl.NumberFormat("ko-KR").format(Math.round(n));
const fmtM = (n: number) => {
    if (Math.abs(n) >= 1e8) return `${(n / 1e8).toFixed(1)}억`;
    if (Math.abs(n) >= 1e4) return `${(n / 1e4).toFixed(0)}만`;
    return fmt(n);
};

export default function InvestmentReturnCard({ totalEvalAmount }: Props) {
    const [principals, setPrincipals] = useState<Principal[]>([]);
    const [cashflow, setCashflow] = useState<CashflowData | null>(null);
    const [isCfLoading, setIsCfLoading] = useState(false);
    const [cfError, setCfError] = useState<string | null>(null);

    // 수동 입력 상태
    const [editingKey, setEditingKey] = useState<string | null>(null);
    const [editValue, setEditValue] = useState("");
    const [editLabel, setEditLabel] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    // 전체 수동 합계 원금
    const manualTotal = principals.reduce((sum, p) => sum + p.principal, 0);
    const manualReturnRate = manualTotal > 0 && totalEvalAmount > 0
        ? ((totalEvalAmount - manualTotal) / manualTotal * 100)
        : null;
    const manualProfit = manualTotal > 0 ? totalEvalAmount - manualTotal : null;

    // KIS 자동 수익률
    const autoReturnRate = cashflow?.auto_return_rate ?? null;
    const autoProfit = cashflow && cashflow.total_net_invested > 0
        ? totalEvalAmount - cashflow.total_net_invested
        : null;

    useEffect(() => {
        fetchPrincipals();
    }, []);

    const fetchPrincipals = async () => {
        try {
            const res = await fetch(`${API_BASE}/api/v1/my/principal`);
            if (res.ok) {
                const data = await res.json();
                setPrincipals(data.principals || []);
            }
        } catch (e) { console.warn("principal 조회 실패:", e); }
    };

    const fetchCashflow = useCallback(async () => {
        setIsCfLoading(true);
        setCfError(null);
        try {
            const res = await fetch(`${API_BASE}/api/v1/my/cashflow`);
            const data = await res.json();
            if (data.status === "ok") {
                setCashflow(data);
            } else {
                setCfError(data.detail || "조회 실패");
            }
        } catch (e: any) {
            setCfError(e.message || "네트워크 오류");
        } finally {
            setIsCfLoading(false);
        }
    }, []);

    const savePrincipal = async (accountNo: string) => {
        const val = parseFloat(editValue.replace(/,/g, ""));
        if (isNaN(val) || val < 0) return;
        setIsSaving(true);
        try {
            await fetch(`${API_BASE}/api/v1/my/principal`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ account_no: accountNo, principal: val, label: editLabel }),
            });
            await fetchPrincipals();
            setEditingKey(null);
        } catch (e) { console.error("저장 실패:", e); }
        finally { setIsSaving(false); }
    };

    const deletePrincipal = async (accountNo: string) => {
        try {
            await fetch(`${API_BASE}/api/v1/my/principal/${encodeURIComponent(accountNo)}`, { method: "DELETE" });
            await fetchPrincipals();
        } catch (e) { console.error("삭제 실패:", e); }
    };

    const startEdit = (p: Principal) => {
        setEditingKey(p.account_no);
        setEditValue(p.principal > 0 ? fmt(p.principal) : "");
        setEditLabel(p.label || "");
    };

    const startNew = () => {
        setEditingKey("__NEW__");
        setEditValue("");
        setEditLabel("");
    };

    const ReturnBadge = ({ rate, profit }: { rate: number | null; profit: number | null }) => {
        if (rate === null) return <span className="text-gray-500 text-sm">미산출</span>;
        const isPos = rate >= 0;
        return (
            <div className="flex flex-col items-end gap-0.5">
                <div className={`flex items-center gap-1 text-2xl font-black ${isPos ? "text-rose-400" : "text-blue-400"}`}>
                    {isPos ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                    {isPos ? "+" : ""}{rate.toFixed(2)}%
                </div>
                {profit !== null && (
                    <div className={`text-xs font-semibold ${isPos ? "text-rose-400/70" : "text-blue-400/70"}`}>
                        {isPos ? "+" : ""}{fmtM(profit)}원
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="w-full flex flex-col gap-4">
            {/* 헤더 */}
            <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white">초기 투자금 대비 총 수익률</h3>
                <span className="text-xs text-gray-500 ml-auto">현재 총평가 {fmtM(totalEvalAmount)}원 기준</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                {/* ── 방법 1: KIS 자동 조회 ── */}
                <div className="bg-gradient-to-br from-indigo-950/60 to-slate-900/80 border border-indigo-500/20 rounded-2xl p-5 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-indigo-400" />
                            <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider">① KIS 자동 조회</span>
                        </div>
                        <button
                            onClick={fetchCashflow}
                            disabled={isCfLoading}
                            className="flex items-center gap-1 px-2 py-1 text-xs bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 rounded-lg text-indigo-400 transition-all disabled:opacity-50"
                        >
                            <RefreshCw className={`w-3 h-3 ${isCfLoading ? "animate-spin" : ""}`} />
                            {isCfLoading ? "조회중" : "조회"}
                        </button>
                    </div>

                    {!cashflow && !isCfLoading && !cfError && (
                        <div className="text-center py-4">
                            <p className="text-gray-500 text-xs mb-2">KIS 입출금 내역 기반 자동 계산</p>
                            <button onClick={fetchCashflow} className="px-4 py-1.5 bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/30 rounded-xl text-xs text-indigo-300 transition-all">
                                입출금 내역 조회
                            </button>
                        </div>
                    )}

                    {isCfLoading && (
                        <div className="flex items-center justify-center py-4 gap-2">
                            <RefreshCw className="w-4 h-4 text-indigo-400 animate-spin" />
                            <span className="text-xs text-gray-400">KIS 입출금 조회 중...</span>
                        </div>
                    )}

                    {cfError && (
                        <div className="text-xs text-red-400 bg-red-900/20 px-3 py-2 rounded-lg">{cfError}</div>
                    )}

                    {cashflow && !isCfLoading && (
                        <>
                            <div className="flex items-end justify-between">
                                <div>
                                    <p className="text-xs text-gray-500 mb-0.5">순 투자금 (입금-출금)</p>
                                    <p className="text-lg font-bold text-gray-200">{fmtM(cashflow.total_net_invested)}원</p>
                                    <p className="text-[10px] text-gray-600 mt-0.5">{cashflow.period}</p>
                                </div>
                                <ReturnBadge rate={cashflow.auto_return_rate} profit={autoProfit} />
                            </div>
                            <div className="flex items-start gap-1.5 bg-yellow-900/10 border border-yellow-500/10 rounded-lg px-2.5 py-1.5">
                                <Info className="w-3 h-3 text-yellow-500/70 shrink-0 mt-0.5" />
                                <p className="text-[10px] text-yellow-500/60 leading-relaxed">{cashflow.note}</p>
                            </div>
                        </>
                    )}
                </div>

                {/* ── 방법 3: 수동 입력 ── */}
                <div className="bg-gradient-to-br from-emerald-950/50 to-slate-900/80 border border-emerald-500/20 rounded-2xl p-5 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-emerald-400" />
                            <span className="text-xs font-bold text-emerald-300 uppercase tracking-wider">③ 직접 입력</span>
                        </div>
                        <button
                            onClick={startNew}
                            className="flex items-center gap-1 px-2 py-1 text-xs bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-lg text-emerald-400 transition-all"
                        >
                            <Edit3 className="w-3 h-3" /> 추가
                        </button>
                    </div>

                    {/* 저장된 원금 목록 */}
                    <div className="flex flex-col gap-2">
                        {principals.length === 0 && editingKey !== "__NEW__" && (
                            <p className="text-gray-500 text-xs text-center py-2">투자 원금을 직접 입력하세요</p>
                        )}

                        {principals.map(p => (
                            <div key={p.account_no}>
                                {editingKey === p.account_no ? (
                                    <PrincipalEditRow
                                        value={editValue} setValue={setEditValue}
                                        label={editLabel} setLabel={setEditLabel}
                                        accountNo={p.account_no}
                                        onSave={() => savePrincipal(p.account_no)}
                                        onCancel={() => setEditingKey(null)}
                                        isSaving={isSaving}
                                    />
                                ) : (
                                    <div className="flex items-center justify-between bg-white/[0.03] rounded-xl px-3 py-2">
                                        <div>
                                            <p className="text-xs text-gray-400">{p.label || p.account_no}</p>
                                            <p className="text-sm font-bold text-gray-200">{fmtM(p.principal)}원</p>
                                        </div>
                                        <div className="flex gap-1.5">
                                            <button onClick={() => startEdit(p)} className="p-1 hover:bg-white/10 rounded-lg transition-colors">
                                                <Edit3 className="w-3 h-3 text-gray-400" />
                                            </button>
                                            <button onClick={() => deletePrincipal(p.account_no)} className="p-1 hover:bg-red-500/20 rounded-lg transition-colors">
                                                <X className="w-3 h-3 text-gray-500" />
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}

                        {editingKey === "__NEW__" && (
                            <PrincipalEditRow
                                value={editValue} setValue={setEditValue}
                                label={editLabel} setLabel={setEditLabel}
                                accountNo="ALL"
                                onSave={() => savePrincipal("ALL")}
                                onCancel={() => setEditingKey(null)}
                                isSaving={isSaving}
                            />
                        )}
                    </div>

                    {/* 합계 수익률 */}
                    {manualTotal > 0 && (
                        <div className="flex items-end justify-between pt-2 border-t border-white/5">
                            <div>
                                <p className="text-xs text-gray-500 mb-0.5">총 투자 원금</p>
                                <p className="text-lg font-bold text-gray-200">{fmtM(manualTotal)}원</p>
                            </div>
                            <ReturnBadge rate={manualReturnRate} profit={manualProfit} />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function PrincipalEditRow({
    value, setValue, label, setLabel, accountNo, onSave, onCancel, isSaving
}: {
    value: string; setValue: (v: string) => void;
    label: string; setLabel: (v: string) => void;
    accountNo: string;
    onSave: () => void; onCancel: () => void;
    isSaving: boolean;
}) {
    return (
        <div className="bg-emerald-900/10 border border-emerald-500/20 rounded-xl p-3 flex flex-col gap-2">
            <input
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500/50"
                placeholder="메모 (예: 은퇴자금, CMA계좌)"
                value={label}
                onChange={e => setLabel(e.target.value)}
            />
            <input
                type="text"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500/50"
                placeholder="투자 원금 (원, 예: 500000000)"
                value={value}
                onChange={e => setValue(e.target.value.replace(/[^0-9,]/g, ""))}
            />
            <div className="flex gap-2">
                <button
                    onClick={onSave}
                    disabled={isSaving}
                    className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 rounded-lg text-xs text-emerald-300 font-medium transition-all disabled:opacity-50"
                >
                    <Check className="w-3 h-3" /> {isSaving ? "저장 중..." : "저장"}
                </button>
                <button onClick={onCancel} className="flex-1 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs text-gray-400 transition-all">
                    취소
                </button>
            </div>
        </div>
    );
}
