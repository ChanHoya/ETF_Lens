import React from 'react';
import { Compass, TrendingDown, ArrowRight, Lightbulb, Zap, ShieldCheck } from 'lucide-react';

export default function MacroRotation() {
    return (
        <div className="relative w-full overflow-hidden rounded-3xl border border-white/10 mb-6 bg-gradient-to-br from-[#121217] via-[#1a1228] to-[#121217] p-6 shadow-2xl">
            {/* Background elements */}
            <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-fuchsia-500/20 rounded-full blur-3xl mix-blend-screen pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-40 h-40 bg-indigo-500/20 rounded-full blur-3xl mix-blend-screen pointer-events-none"></div>

            <div className="relative z-10">
                <div className="flex flex-col md:flex-row gap-6 items-start md:items-center justify-between border-b border-white/10 pb-5 mb-5">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                            <Compass className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
                                AI 매크로 로테이션 나침반
                                <span className="text-[10px] bg-gray-500/20 text-gray-300 px-2 py-0.5 rounded-md border border-gray-500/30 whitespace-nowrap ml-2">향후 개발예정</span>
                            </h2>
                            <p className="text-sm text-gray-400 font-medium">현재 글로벌 매크로 환경 기반 자산배분 전략 구상도</p>
                        </div>
                    </div>

                    <div className="flex bg-black/40 border border-white/10 rounded-xl px-4 py-2 items-center gap-3">
                        <span className="relative flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                        </span>
                        <div className="flex flex-col">
                            <span className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">인공지능 판독 결과</span>
                            <span className="text-sm font-bold text-emerald-400">금리 인하 사이클 진입기 (Rate Cut)</span>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-4 hover:bg-white/10 transition-colors cursor-pointer group">
                        <div className="flex items-center gap-2 mb-3">
                            <div className="p-1.5 bg-rose-500/20 rounded-lg text-rose-400">
                                <TrendingDown className="w-4 h-4" />
                            </div>
                            <h3 className="text-sm font-bold text-gray-200">1. 장기 국채 (Bonds)</h3>
                        </div>
                        <p className="text-xs text-gray-400 mb-3 leading-relaxed">
                            금리 인하 수혜의 핵심 자산입니다. 듀레이션이 긴 채권일수록 자본 차익(Capital Gain)이 극대화됩니다.
                        </p>
                        <div className="flex flex-wrap gap-2 mt-auto">
                            <span className="text-[10px] bg-rose-500/10 text-rose-300 px-2 py-1 rounded border border-rose-500/20 font-bold group-hover:bg-rose-500/20 transition-colors">TIGER 美채권30년스트립</span>
                            <span className="text-[10px] bg-rose-500/10 text-rose-300 px-2 py-1 rounded border border-rose-500/20 font-bold group-hover:bg-rose-500/20 transition-colors">ACE 미국30년국채</span>
                        </div>
                    </div>

                    <div className="bg-white/5 border border-white/10 rounded-2xl p-4 hover:bg-white/10 transition-colors cursor-pointer group">
                        <div className="flex items-center gap-2 mb-3">
                            <div className="p-1.5 bg-indigo-500/20 rounded-lg text-indigo-400">
                                <Zap className="w-4 h-4" />
                            </div>
                            <h3 className="text-sm font-bold text-gray-200">2. 빅테크/성장주 (Tech/Growth)</h3>
                        </div>
                        <p className="text-xs text-gray-400 mb-3 leading-relaxed">
                            할인율 부담 완화로 인해 밸류에이션 매력이 상승하며, AI 주도 실적 성장이 뒷받침됩니다.
                        </p>
                        <div className="flex flex-wrap gap-2 mt-auto">
                            <span className="text-[10px] bg-indigo-500/10 text-indigo-300 px-2 py-1 rounded border border-indigo-500/20 font-bold group-hover:bg-indigo-500/20 transition-colors">KODEX 미국나스닥100</span>
                            <span className="text-[10px] bg-indigo-500/10 text-indigo-300 px-2 py-1 rounded border border-indigo-500/20 font-bold group-hover:bg-indigo-500/20 transition-colors">TIGER 필라델피아반도체</span>
                        </div>
                    </div>

                    <div className="bg-white/5 border border-white/10 rounded-2xl p-4 hover:bg-white/10 transition-colors cursor-pointer group">
                        <div className="flex items-center gap-2 mb-3">
                            <div className="p-1.5 bg-amber-500/20 rounded-lg text-amber-400">
                                <ShieldCheck className="w-4 h-4" />
                            </div>
                            <h3 className="text-sm font-bold text-gray-200">3. 배당성장 (Dividend)</h3>
                        </div>
                        <p className="text-xs text-gray-400 mb-3 leading-relaxed">
                            변동성 장세에서 방어력을 제공하며, 금리 하락 시 상대적인 배당 매력도가 크게 상승합니다.
                        </p>
                        <div className="flex flex-wrap gap-2 mt-auto">
                            <span className="text-[10px] bg-amber-500/10 text-amber-300 px-2 py-1 rounded border border-amber-500/20 font-bold group-hover:bg-amber-500/20 transition-colors">TIGER 미국배당다우존스</span>
                            <span className="text-[10px] bg-amber-500/10 text-amber-300 px-2 py-1 rounded border border-amber-500/20 font-bold group-hover:bg-amber-500/20 transition-colors">SOL 미국배당다우존스</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
