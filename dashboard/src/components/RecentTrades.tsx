import React from 'react';

type Trade = {
    account_no: string;
    name: string;
    code: string;
    side: "매수" | "매도";
    qty: number;
    price: number;
    amount: number;
    profit_loss: number;
    time: string;
};

type RecentTradesProps = {
    tradesData: {
        status: string;
        date: string;
        count: number;
        trades: Trade[];
    } | null;
};

export default function RecentTrades({ tradesData }: RecentTradesProps) {
    if (!tradesData) return null;

    const { trades, count, date } = tradesData;

    return (
        <section className="flex flex-col gap-4 mt-6">
            <h2 className="text-2xl font-bold flex items-center gap-2">
                <span className="w-1.5 h-6 bg-indigo-500 rounded-full"></span>
                당일 체결 내역
                <span className="text-sm font-normal text-gray-400 ml-2">({date})</span>
            </h2>
            <div className="bg-white/[0.02] border border-white/10 rounded-2xl backdrop-blur-md overflow-hidden">
                {count === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                        오늘 체결된 내역이 없습니다.
                    </div>
                ) : (
                    <div className="overflow-x-auto w-full">
                        <table className="w-full min-w-[600px] text-sm text-left">
                            <thead className="text-xs text-gray-400 uppercase bg-white/[0.02] border-b border-white/10">
                                <tr>
                                    <th className="px-6 py-4 font-semibold">종목명</th>
                                    <th className="px-6 py-4 font-semibold text-center">구분</th>
                                    <th className="px-6 py-4 font-semibold text-right">체결단가</th>
                                    <th className="px-6 py-4 font-semibold text-right">체결수량</th>
                                    <th className="px-6 py-4 font-semibold text-right">체결금액</th>
                                    <th className="px-6 py-4 font-semibold text-center">시간</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {trades.map((trade, idx) => (
                                    <tr key={`${trade.code}-${idx}`} className="hover:bg-white/[0.02] transition-colors">
                                        <td className="px-6 py-4 font-medium text-gray-200">
                                            {trade.name} <span className="text-xs text-gray-500 ml-1">{trade.code}</span>
                                            <div className="text-[10px] text-gray-500 mt-1">{trade.account_no}</div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`px-2 py-1 rounded text-xs font-bold ${
                                                trade.side === '매수' ? 'bg-rose-500/20 text-rose-400' : 'bg-blue-500/20 text-blue-400'
                                            }`}>
                                                {trade.side}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            {new Intl.NumberFormat('ko-KR').format(trade.price)}원
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            {new Intl.NumberFormat('ko-KR').format(trade.qty)}주
                                        </td>
                                        <td className="px-6 py-4 text-right font-medium">
                                            {new Intl.NumberFormat('ko-KR').format(trade.amount)}원
                                        </td>
                                        <td className="px-6 py-4 text-center text-gray-400">
                                            {trade.time}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </section>
    );
}
