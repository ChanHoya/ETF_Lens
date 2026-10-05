'use client';
// 금리 탭 장단기 금리차의 비교 기준(한·미 10년−3년, 참고선 10년−3개월)을 설명하는 버튼과 팝업 (body 포털로 그려 상위 blur에 갇히지 않게 함)

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { HelpCircle, X } from 'lucide-react';

const CANDIDATES = [
    { basis: '10년−3년', kr: '국고채 3년 (1998~)', us: '미국채 3년 (1962~)', verdict: '채택 — 두 나라 모두 국채로 20년 이상 비교 가능', ok: true },
    { basis: '10년−2년', kr: '국고채 2년 (2021-03~)', us: '미국채 2년', verdict: '한국 이력이 5년뿐', ok: false },
    { basis: '10년−3개월', kr: 'CD 91일 (은행 예금증서)', us: '미국채 3개월', verdict: '한국 쪽이 국채가 아니라 신용·유동성 위험이 섞임', ok: false },
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
                                <h4 className="font-extrabold text-white mb-1">장단기 금리차란</h4>
                                <p>10년 국채금리에서 단기 국채금리를 뺀 값입니다. 돈을 오래 빌려줄수록 보상을 더 받으니 보통은 플러스입니다.
                                    단기 금리가 더 높아지는 <b className="text-red-300">역전(마이너스)</b>은 시장이 앞으로 금리 인하와 경기 둔화를 예상한다는 신호로 읽힙니다.</p>
                            </section>
                            <section>
                                <h4 className="font-extrabold text-white mb-1">한·미 공통 기준: 10년−3년</h4>
                                <p>두 나라를 한 차트에서 비교하려면 같은 자로 재야 합니다. 만기 간격이 다르면(10년−3개월은 약 10년, 10년−3년은 7년)
                                    같은 상황에서도 금리차 크기가 달라져, 실제 차이가 아닌 기준 차이가 그래프에 섞입니다.</p>
                                <div className="overflow-x-auto mt-2">
                                    <table className="w-full text-xs">
                                        <thead><tr className="text-gray-500 border-b border-white/10">
                                            <th className="text-left py-1 font-bold">후보</th><th className="text-left font-bold">한국 단기</th>
                                            <th className="text-left font-bold">미국 단기</th><th className="text-left font-bold">판단</th>
                                        </tr></thead>
                                        <tbody>
                                            {CANDIDATES.map(c => (
                                                <tr key={c.basis} className={`border-b border-white/5 ${c.ok ? 'text-gray-100' : 'text-gray-400'}`}>
                                                    <td className={`py-1.5 font-bold ${c.ok ? 'text-emerald-300' : ''}`}>{c.basis}</td>
                                                    <td>{c.kr}</td><td>{c.us}</td><td>{c.verdict}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <p className="mt-2">3년은 한국 채권시장의 대표 만기(거래가 가장 많은 만기)이기도 해서, 한국 시장이 보는 지표와도 일치합니다.</p>
                            </section>
                            <section>
                                <h4 className="font-extrabold text-white mb-1">참고선: 미국 10년−3개월 (점선)</h4>
                                <p>뉴욕 연준이 경기침체 확률을 계산할 때 쓰는 기준이라 침체 신호 참고용으로 남겼습니다. 한·미 비교선이 아니므로 점선으로 구분합니다.</p>
                            </section>
                            <section>
                                <h4 className="font-extrabold text-white mb-1">미국 10년−2년을 뺀 이유</h4>
                                <p>시장에서 가장 많이 인용되지만, 최근 20년 미국 10년−3년과 거의 겹쳐 움직여(상관 0.99, 평균 차이 약 0.13%p) 같은 차트에 두면 중복입니다.</p>
                            </section>
                            <section>
                                <h4 className="font-extrabold text-white mb-1">아래 &lsquo;단기·장기·초장기 비교&rsquo;와의 차이</h4>
                                <p>그쪽은 금리차가 아니라 <b>같은 만기의 금리 수준</b>을 한·미 나란히 놓은 것입니다(1년·10년·30년). 단기 대표를 1년으로 둔 것은
                                    시장이 예상하는 기준금리 경로를 가장 잘 반영하는 만기이기 때문입니다. 그래서 같은 탭 안에서도 &lsquo;단기&rsquo;가 금리차에서는 3년, 만기 비교에서는 1년입니다.</p>
                            </section>
                            <section>
                                <h4 className="font-extrabold text-white mb-1">역전 이력 표의 침체 기준</h4>
                                <p>미국 NBER 경기침체 구간(회색 음영)에 연결합니다. 한국 금리차 역전도 세계 경기 영향을 함께 보려고 같은 미국 침체 기준으로 표시합니다.</p>
                            </section>
                        </div>
                    </div>
                </div>,
                document.body,
            )}
        </>
    );
}
