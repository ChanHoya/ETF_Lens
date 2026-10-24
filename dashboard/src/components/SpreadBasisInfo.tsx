'use client';
// 금리 탭 장단기 금리차의 비교 기준(미국 10년−3개월 메인/10년−2년 참고, 한국 10년−1년 메인/10년−3년 참고)을 설명하는 버튼과 팝업

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { HelpCircle, X } from 'lucide-react';

const STRUCTURE = [
    { tier: '장기 (10년)', kr: '국고채 10년 (실선 #6366f1)', us: '미국채 10년 (실선 #f43f5e)', desc: '경제 펀더멘털, 중장기 성장률 및 물가 기대 반영' },
    { tier: '단기 (참고)', kr: '국고채 3년 (점선 #38bdf8)', us: '미국채 2년 (점선 #f59e0b)', desc: '양국 채권시장의 전통적 벤치마크 (보조 지표로 병행 모니터링)' },
    { tier: '초단기 (메인)', kr: '국고채 1년 (실선 #38bdf8)', us: '미국채 3개월 (실선 #f59e0b)', desc: '향후 1년 정책금리 경로 및 뉴욕 연준 경기 침체 공식 모델 기준' },
];

export default function SpreadBasisInfo() {
    const [open, setOpen] = useState(false);
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [open]);

    return (
        <>
            <button onClick={() => setOpen(true)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 hover:text-white">
                <HelpCircle className="w-3.5 h-3.5" />기준 설명
            </button>
            {open && createPortal(
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm p-3" onClick={() => setOpen(false)}>
                    <div role="dialog" aria-modal="true" aria-label="장단기 금리차 비교 기준"
                        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-[#0d0d12] border border-white/10 rounded-2xl shadow-2xl"
                        onClick={(e) => e.stopPropagation()}>
                        <div className="sticky top-0 flex items-center justify-between px-5 py-3 border-b border-white/10 bg-[#121217]">
                            <p className="flex items-center gap-2 text-white font-bold"><HelpCircle className="w-4 h-4 text-emerald-400" />장단기 금리차 비교 기준</p>
                            <button onClick={() => setOpen(false)} aria-label="닫기"
                                className="p-1.5 text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg"><X className="w-4 h-4" /></button>
                        </div>
                        <div className="px-5 py-4 space-y-5 text-sm text-gray-300 leading-relaxed">
                            <section>
                                <h4 className="font-extrabold text-white mb-1">장기-단기-초단기 3단계 분류 체계</h4>
                                <p>시장 참가자들의 기대와 경기 국면을 정밀하게 포착하기 위해 미국과 한국 모두 <b>장기(10년) - 단기(미 2년/한 3년) - 초단기(미 3개월/한 1년)</b> 체계로 일관 적용합니다.</p>
                                <div className="overflow-x-auto mt-2">
                                    <table className="w-full text-xs">
                                        <thead><tr className="text-gray-500 border-b border-white/10">
                                            <th className="text-left py-1 font-bold">구분</th><th className="text-left font-bold">한국 국채</th>
                                            <th className="text-left font-bold">미국 국채</th><th className="text-left font-bold">지표 성격</th>
                                        </tr></thead>
                                        <tbody>
                                            {STRUCTURE.map(c => (
                                                <tr key={c.tier} className="border-b border-white/5 text-gray-200">
                                                    <td className="py-1.5 font-bold text-emerald-300">{c.tier}</td>
                                                    <td>{c.kr}</td><td>{c.us}</td><td className="text-gray-400">{c.desc}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </section>
                            <section>
                                <h4 className="font-extrabold text-white mb-1">장단기 금리차 메인 비교 기준</h4>
                                <ul className="list-disc list-inside space-y-1 text-xs text-gray-300">
                                    <li><b>미국 10년 − 3개월 (메인)</b>: 뉴욕 연방준비은행의 경기 침체 예측 모델 공식 기준선입니다. 역사적으로 침체 예측 적중도가 가장 높으며 <b>실선</b>으로 강조합니다.</li>
                                    <li><b>한국 10년 − 1년 (메인)</b>: 한은 기준금리 경로 기대가 100% 반영되는 국채 1년물과 장기 성장률의 스프레드로, 국내 경기 선행 신호의 핵심 축입니다.</li>
                                </ul>
                            </section>
                            <section>
                                <h4 className="font-extrabold text-white mb-1">참고선: 미국 10년−2년 & 한국 10년−3년 (점선)</h4>
                                <p>금융 시장에서 널리 인용되는 전통적 지표들(미 10Y−2Y, 한 10Y−3Y)은 비교 시계열에서 <b>점선(Dash)</b> 형태로 유지하여, 한 차트 안에서 메인 신호와 보조 벤치마크를 혼동 없이 직관적으로 대조할 수 있습니다.</p>
                            </section>
                            <section>
                                <h4 className="font-extrabold text-white mb-1">그래프 시각적 구분 규칙</h4>
                                <p>단일 그래프에 다수의 지표가 공존하므로 국가와 만기를 명확한 규칙으로 분리합니다.</p>
                                <ul className="list-disc list-inside space-y-1 text-xs text-gray-300 mt-1">
                                    <li><b>국가 색상</b>: 한국은 쿨톤(블루/인디고), 미국은 웜톤(로즈/앰버)으로 일관되게 채색합니다.</li>
                                    <li><b>선 형태</b>: 메인 장기 및 초단기는 굵은 실선, 보조 참고선(미 2년, 한 3년)은 얇은 점선으로 렌더링합니다.</li>
                                </ul>
                            </section>
                        </div>
                    </div>
                </div>,
                document.body,
            )}
        </>
    );
}
