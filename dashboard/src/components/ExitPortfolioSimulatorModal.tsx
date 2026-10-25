"use client";
// 코스피 출구 전략 종합위험도 기반 내 포트폴리오(My/TFF) 현금화 및 안전자산 피난 시뮬레이터 모달

import React, { useState, useMemo } from 'react';
import { 
    ShieldAlert, 
    X, 
    AlertTriangle, 
    ArrowRight, 
    CheckCircle2, 
    Copy, 
    DollarSign, 
    TrendingDown, 
    PieChart, 
    Sparkles, 
    Layers, 
    RotateCcw,
    Sliders,
    Building2,
    Users
} from 'lucide-react';

interface ExitPortfolioSimulatorModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentScore: number;
    currentLevel: string;
    currentLabel: string;
}

export default function ExitPortfolioSimulatorModal({
    isOpen,
    onClose,
    currentScore,
    currentLevel,
    currentLabel,
}: ExitPortfolioSimulatorModalProps) {
    const [portfolioType, setPortfolioType] = useState<'my' | 'tff'>('my');
    const [customStockRatio, setCustomStockRatio] = useState<number | null>(null);
    const [copied, setCopied] = useState(false);

    // 포트폴리오 모의/실데이터 (My KIS vs TFF 10인 펀드)
    const portfolioData = useMemo(() => {
        if (portfolioType === 'my') {
            return {
                name: 'My KIS 통합 포트폴리오',
                totalAsset: 145000000, // 1억 4,500만 원
                stockRatio: 82, // 현재 주식 비중 82%
                cashRatio: 18,
                holdings: [
                    { name: 'KODEX 레버리지 (122630)', category: '레버리지', beta: 2.0, evalAmount: 22000000, weight: 15.2, priority: 1, action: '전량 청산 (100% 매도)' },
                    { name: 'ACE 미국빅테크TOP7 Plus (465580)', category: '고베타 성장', beta: 1.35, evalAmount: 38000000, weight: 26.2, priority: 2, action: '50% 부분 매도' },
                    { name: 'TIGER 미국나스닥100 (133690)', category: '성장주', beta: 1.15, evalAmount: 35000000, weight: 24.1, priority: 3, action: '30% 축소' },
                    { name: 'ACE 미국배당다우존스 (402970)', category: '배당/가치', beta: 0.72, evalAmount: 24000000, weight: 16.5, priority: 4, action: '비중 유지 또는 관망' },
                    { name: 'TIGER KOFR금리액티브 (449170)', category: '안전자산/현금', beta: 0.0, evalAmount: 26000000, weight: 18.0, priority: 5, action: '안전자산 확충' },
                ]
            };
        } else {
            return {
                name: 'TFF 10인 공동 펀드 (1인 지분 1/10)',
                totalAsset: 52000000, // 5,200만 원 (1인 520만 원)
                stockRatio: 78,
                cashRatio: 22,
                holdings: [
                    { name: 'TIGER 미국필라델피아반도체나스닥 (381180)', category: '고베타 섹터', beta: 1.45, evalAmount: 16000000, weight: 30.8, priority: 1, action: '40% 부분 이익실현' },
                    { name: 'ACE 미국30년국채액티브(H) (453850)', category: '채권/안전', beta: -0.25, evalAmount: 14500000, weight: 27.9, priority: 4, action: '비중 확대 유지' },
                    { name: 'SOL 미국S&P500ESG (441640)', category: '시장대표', beta: 1.0, evalAmount: 10000000, weight: 19.3, priority: 3, action: '20% 부분 축소' },
                    { name: 'TIGER KOFR금리액티브 (449170)', category: '초단기 파킹', beta: 0.0, evalAmount: 11500000, weight: 22.0, priority: 5, action: '비상금 풀 대기' },
                ]
            };
        }
    }, [portfolioType]);

    // 위험도 수준별 권장 목표 주식 비중
    const recommendedStockRatio = useMemo(() => {
        if (currentScore >= 15) return 25; // 위험/폭락기: 주식 25%, 안전 75%
        if (currentScore >= 9) return 45;  // 경계: 주식 45%, 안전 55%
        if (currentScore >= 5) return 65;  // 주의: 주식 65%, 안전 35%
        return 80;                         // 안전: 주식 80%, 안전 20%
    }, [currentScore]);

    const targetStockRatio = customStockRatio !== null ? customStockRatio : recommendedStockRatio;
    const targetCashRatio = 100 - targetStockRatio;

    // 현재 주식 평가액 vs 목표 주식 평가액
    const currentStockAmount = Math.round(portfolioData.totalAsset * (portfolioData.stockRatio / 100));
    const targetStockAmount = Math.round(portfolioData.totalAsset * (targetStockRatio / 100));
    const cashToRaise = Math.max(0, currentStockAmount - targetStockAmount);

    if (!isOpen) return null;

    const handleCopyPlan = () => {
        const text = `[i-Prism 출구 전략 실행 가이드 - ${portfolioData.name}]
현재 종합위험지수: ${currentScore}/21점 (${currentLabel})
목표 자산배분: 주식 ${targetStockRatio}% | 안전자산/현금 ${targetCashRatio}%
필요 현금화 확보액: 약 ${(cashToRaise / 10000).toLocaleString()}만 원

[우선 매도 권고 순위]
${portfolioData.holdings.filter(h => h.priority <= 3).map((h, i) => `${i + 1}. ${h.name} : ${h.action} (현재 비중 ${h.weight}%)`).join('\n')}

[안전 피난 자산 추천]
1. TIGER KOFR금리액티브 (파킹형 일복리)
2. ACE 미국30년국채액티브 (금리인하 수혜 & 안전자산)
3. 원/달러(USD) 안전 현금`;

        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="fixed top-[52px] sm:top-[60px] md:top-[64px] left-0 right-0 bottom-0 z-[200] flex items-start justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
            <div className="relative w-full max-w-3xl my-auto sm:my-4 bg-[#0f111a] border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">
                
                {/* 헤더 */}
                <div className="flex items-center justify-between p-4 sm:p-5 border-b border-white/10 bg-white/[0.02]">
                    <div className="flex items-center gap-3">
                        <div className={`p-2.5 rounded-xl ${currentScore >= 15 ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'}`}>
                            <ShieldAlert className="w-5 h-5 animate-pulse" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-base sm:text-lg font-black text-white tracking-tight">
                                    내 포트폴리오 출구 전략 & 안전 피난 시뮬레이터
                                </h3>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${currentScore >= 15 ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'}`}>
                                    위험도 {currentScore}/21점 ({currentLabel})
                                </span>
                            </div>
                            <p className="text-xs text-gray-400 mt-0.5">
                                거시 위험 신호 감지 시 자산 방어를 위한 주식 비중 축소 및 현금 목표 산출
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* 바디 스크롤 영역 */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs">
                    
                    {/* 포트폴리오 탭 선택기 */}
                    <div className="flex items-center justify-between gap-2 bg-black/40 p-1.5 rounded-xl border border-white/5">
                        <div className="flex items-center gap-1.5">
                            <button
                                onClick={() => { setPortfolioType('my'); setCustomStockRatio(null); }}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-xs transition-all ${
                                    portfolioType === 'my'
                                        ? 'bg-indigo-600 text-white shadow-md'
                                        : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
                                }`}
                            >
                                <Building2 className="w-3.5 h-3.5" />
                                My KIS 개인 자산
                            </button>
                            <button
                                onClick={() => { setPortfolioType('tff'); setCustomStockRatio(null); }}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-xs transition-all ${
                                    portfolioType === 'tff'
                                        ? 'bg-indigo-600 text-white shadow-md'
                                        : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
                                }`}
                            >
                                <Users className="w-3.5 h-3.5" />
                                TFF 10인 공동 펀드
                            </button>
                        </div>
                        <span className="text-[11px] text-gray-400 font-mono pr-2">
                            총 평가자산: <strong className="text-white font-bold">{(portfolioData.totalAsset / 10000).toLocaleString()}만 원</strong>
                        </span>
                    </div>

                    {/* 진단 및 목표 비중 산출 카드 */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {/* 현재 상태 */}
                        <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3.5 flex flex-col justify-between">
                            <span className="text-gray-400 text-[11px] font-semibold">현재 자산배분</span>
                            <div className="my-2 flex items-baseline gap-2">
                                <span className="text-xl font-black text-rose-400 font-mono">{portfolioData.stockRatio}%</span>
                                <span className="text-gray-400 text-[11px]">주식형 고위험</span>
                            </div>
                            <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden flex">
                                <div style={{ width: `${portfolioData.stockRatio}%` }} className="bg-rose-500 h-full" />
                                <div style={{ width: `${portfolioData.cashRatio}%` }} className="bg-emerald-500 h-full" />
                            </div>
                            <span className="text-[10px] text-gray-500 mt-1 font-mono">현금/안전자산 {portfolioData.cashRatio}%</span>
                        </div>

                        {/* 권장 목표 상태 */}
                        <div className="bg-white/[0.02] border border-indigo-500/30 rounded-xl p-3.5 flex flex-col justify-between bg-indigo-500/[0.03]">
                            <div className="flex justify-between items-center">
                                <span className="text-indigo-300 text-[11px] font-bold flex items-center gap-1">
                                    <Sparkles className="w-3 h-3 text-indigo-400" />
                                    권장 목표 배분 (위험 {currentScore}점 기준)
                                </span>
                            </div>
                            <div className="my-2 flex items-baseline gap-2">
                                <span className="text-xl font-black text-emerald-400 font-mono">{targetStockRatio}%</span>
                                <span className="text-gray-300 text-[11px]">주식 축소 목표</span>
                            </div>
                            <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden flex">
                                <div style={{ width: `${targetStockRatio}%` }} className="bg-rose-400 h-full transition-all" />
                                <div style={{ width: `${targetCashRatio}%` }} className="bg-emerald-400 h-full transition-all" />
                            </div>
                            <span className="text-[10px] text-emerald-400 mt-1 font-mono font-bold">목표 안전자산 {targetCashRatio}% 확보</span>
                        </div>

                        {/* 필요 현금화 액션 */}
                        <div className="bg-gradient-to-br from-rose-950/30 to-black border border-rose-500/30 rounded-xl p-3.5 flex flex-col justify-between">
                            <span className="text-rose-300 text-[11px] font-bold">필요 안전자산 확충액</span>
                            <div className="my-2">
                                <div className="text-xl font-black text-white font-mono">
                                    약 {(cashToRaise / 10000).toLocaleString()}<span className="text-xs font-normal text-gray-300 ml-1">만 원</span>
                                </div>
                                <span className="text-[10px] text-rose-400 mt-0.5 block font-medium">
                                    (포트폴리오의 {portfolioData.stockRatio - targetStockRatio}%p 주식 매도)
                                </span>
                            </div>
                            <span className="text-[10px] text-gray-400">KOFR 및 단기채 피난 권고</span>
                        </div>
                    </div>

                    {/* 목표 주식 비중 커스텀 슬라이더 */}
                    <div className="bg-black/30 border border-white/5 rounded-xl p-3 flex flex-col gap-2">
                        <div className="flex justify-between items-center text-[11px]">
                            <span className="text-gray-300 font-bold flex items-center gap-1.5">
                                <Sliders className="w-3.5 h-3.5 text-indigo-400" />
                                주식 비중 직접 조절 슬라이더
                            </span>
                            <div className="flex items-center gap-2">
                                <span className="text-indigo-300 font-mono font-bold">주식 {targetStockRatio}% / 현금 {targetCashRatio}%</span>
                                {customStockRatio !== null && (
                                    <button 
                                        onClick={() => setCustomStockRatio(null)}
                                        className="text-[10px] text-gray-400 hover:text-white flex items-center gap-0.5 underline"
                                    >
                                        <RotateCcw className="w-2.5 h-2.5" /> 자동 권장치로 초기화
                                    </button>
                                )}
                            </div>
                        </div>
                        <input 
                            type="range"
                            min={10}
                            max={90}
                            step={5}
                            value={targetStockRatio}
                            onChange={(e) => setCustomStockRatio(Number(e.target.value))}
                            className="w-full accent-indigo-500 cursor-pointer h-1.5 bg-white/10 rounded-lg"
                        />
                        <div className="flex justify-between text-[9px] text-gray-500 font-mono">
                            <span>극단적 방어 (10%)</span>
                            <span>권장치 ({recommendedStockRatio}%)</span>
                            <span>공격적 유지 (90%)</span>
                        </div>
                    </div>

                    {/* 우선 매도 권고 종목 리스트 */}
                    <div className="bg-black/30 border border-white/5 rounded-xl p-3.5 flex flex-col gap-2.5">
                        <div className="flex items-center justify-between">
                            <span className="font-extrabold text-white text-xs flex items-center gap-1.5">
                                <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                                우선 매도 및 비중 축소 권고 순위 (고베타/변동성 우선)
                            </span>
                            <span className="text-[10px] text-gray-400 font-mono">베타 및 레버리지 기준</span>
                        </div>

                        <div className="space-y-1.5">
                            {portfolioData.holdings.map((item, idx) => (
                                <div 
                                    key={idx}
                                    className={`flex items-center justify-between p-2 rounded-lg border text-[11px] transition-all ${
                                        item.priority <= 2 
                                            ? 'bg-rose-500/[0.06] border-rose-500/20' 
                                            : item.priority === 3
                                            ? 'bg-amber-500/[0.04] border-amber-500/20'
                                            : 'bg-white/[0.01] border-white/5 text-gray-400'
                                    }`}
                                >
                                    <div className="flex items-center gap-2">
                                        <span className={`w-5 h-5 rounded-md flex items-center justify-center font-mono font-bold text-[10px] ${
                                            item.priority <= 2 ? 'bg-rose-500/20 text-rose-400' : (item.priority === 3 ? 'bg-amber-500/20 text-amber-400' : 'bg-white/10 text-gray-400')
                                        }`}>
                                            {idx + 1}
                                        </span>
                                        <div>
                                            <div className="font-bold text-white text-[11.5px]">{item.name}</div>
                                            <div className="text-[9.5px] text-gray-400 flex items-center gap-1.5">
                                                <span>{item.category}</span>
                                                <span>•</span>
                                                <span className="font-mono">베타 {item.beta.toFixed(2)}</span>
                                                <span>•</span>
                                                <span className="font-mono">비중 {item.weight}% (약 {(item.evalAmount / 10000).toLocaleString()}만원)</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <span className={`font-bold text-[10.5px] px-2 py-0.5 rounded-full ${
                                            item.priority <= 2 ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : (item.priority === 3 ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20')
                                        }`}>
                                            {item.action}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* 추천 피난처 3대 안전자산 */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5">
                            <span className="text-[10px] text-emerald-400 font-bold block mb-1">🛡️ 초단기 파킹형 일복리</span>
                            <div className="font-bold text-white text-xs">TIGER KOFR금리액티브</div>
                            <p className="text-[10px] text-gray-400 mt-0.5">무위험 한국 무위험지표금리 일복리 연 3.5% 파킹</p>
                        </div>
                        <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5">
                            <span className="text-[10px] text-blue-400 font-bold block mb-1">📈 금리인하 자본차익 헤지</span>
                            <div className="font-bold text-white text-xs">ACE 미국30년국채액티브(H)</div>
                            <p className="text-[10px] text-gray-400 mt-0.5">시장 충격 시 장기채 듀레이션 자본차익 및 안전자산 방어</p>
                        </div>
                        <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5">
                            <span className="text-[10px] text-amber-400 font-bold block mb-1">💵 기축통화 현금 확보</span>
                            <div className="font-bold text-white text-xs">달러(USD) / MMF 예수금</div>
                            <p className="text-[10px] text-gray-400 mt-0.5">원화 급락 시 환차익 방어 및 폭락 후 저점 매수 실탄</p>
                        </div>
                    </div>

                </div>

                {/* 푸터 액션 */}
                <div className="p-3 sm:p-4 border-t border-white/10 bg-white/[0.02] flex items-center justify-between gap-3">
                    <button
                        onClick={handleCopyPlan}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 font-semibold text-xs border border-white/10 transition-all"
                    >
                        {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        {copied ? '실행 가이드 복사 완료!' : 'HTS/MTS 매도 체크리스트 복사'}
                    </button>
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 transition-all"
                    >
                        확인 완료
                    </button>
                </div>

            </div>
        </div>
    );
}
