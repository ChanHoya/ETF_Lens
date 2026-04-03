import React, { useState, useEffect } from 'react';
import { API_BASE } from "@/lib/apiConfig";
import { AlertTriangle, ShieldAlert, X } from "lucide-react";

export default function RiskAlertBanner() {
    const [signal, setSignal] = useState<any>(null);
    const [dismissed, setDismissed] = useState(false);

    useEffect(() => {
        const fetchSignal = async () => {
            try {
                const res = await fetch(`${API_BASE}/api/v1/exit-signal`);
                if (res.ok) {
                    const data = await res.json();
                    setSignal(data.risk?.label);
                }
            } catch (e) {
                console.warn("Failed to fetch exit signal", e);
            }
        };
        fetchSignal();
    }, []);

    if (dismissed || !signal) return null;

    // Only show for '경계' (Warning) or '위험' (Danger)
    if (signal !== "경계" && signal !== "위험") return null;

    const isDanger = signal === "위험";

    return (
        <div className={`w-full xl:max-w-[1400px] mx-auto px-4 lg:px-6 relative z-20 mb-4`}>
            <div className={`p-4 rounded-2xl border backdrop-blur-xl flex items-start gap-4 shadow-lg ${
                isDanger 
                ? "bg-rose-500/10 border-rose-500/50" 
                : "bg-amber-500/10 border-amber-500/50"
            }`}>
                <div className={`p-2 rounded-xl mt-1 ${isDanger ? 'bg-rose-500/20 text-rose-500' : 'bg-amber-500/20 text-amber-500'}`}>
                    {isDanger ? <ShieldAlert className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
                </div>
                
                <div className="flex-1">
                    <h3 className={`font-bold text-lg mb-1 ${isDanger ? 'text-rose-400' : 'text-amber-400'}`}>
                        {isDanger ? "[위험 경고] 거시경제 긴급 신호" : "[경계 확보] 시장 단기 변동성 증가"}
                    </h3>
                    <p className="text-gray-300 text-sm leading-relaxed max-w-4xl">
                        현재 거시경제 알고리즘(공포/탐욕지수, VIX, 경기선행지수 등)이 시장 <strong>{signal}</strong> 단계를 가리키고 있습니다. 
                        하방 압력이 거세지고 있으므로, 
                        <span className="text-white font-semibold mx-1 text-decoration-underline underline decoration-amber-500 underline-offset-4">현금(예수금) 비중을 늘리거나</span>, 
                        달러화 자산, 혹은 <strong>KODEX 200선물인버스2X(252670)</strong> 같은 헷지 자산 편입을 고려하세요.
                    </p>
                </div>

                <button 
                    onClick={() => setDismissed(true)}
                    className="p-1 hover:bg-white/10 rounded-lg text-gray-400 transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>
        </div>
    );
}
