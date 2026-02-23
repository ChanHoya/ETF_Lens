"use client";

import { useState } from "react";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from "recharts";
import { Search, Loader2 } from "lucide-react";

export default function Home() {
  const [etfCodes, setEtfCodes] = useState([\"453850\", \"462330\"]);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const fetchComparison = async () => {
    setLoading(true);
    try {
      const res = await fetch(\"http://localhost:8000/api/v1/analyze/compare\", {
        method: \"POST\",
        headers: {
  \"Content-Type\": \"application/json\",
},
body: JSON.stringify({ etf_codes: etfCodes }),
      });
const result = await res.json();
setData(result);
    } catch (e) {
  console.error(e);
  alert(\"Failed to fetch comparison data\");
    } finally {
  setLoading(false);
}
  };

const radarData = data?.visual_data?.radar_chart
  ? [
    { subject: '수수료(저렴함)', A: data.visual_data.radar_chart.fees, fullMark: 10 },
    { subject: '수익률', A: data.visual_data.radar_chart.performance, fullMark: 10 },
    { subject: '유동성', A: data.visual_data.radar_chart.liquidity, fullMark: 10 },
    { subject: '안정성', A: data.visual_data.radar_chart.stability, fullMark: 10 },
  ]
  : [];

return (
  <main className=\"flex min-h-screen flex-col items-center p-8 bg-gray-50 text-gray-900\">
    < header className =\"w-full max-w-5xl mb-8 flex justify-between items-center\">
      < div >
      <h1 className=\"text-4xl font-extrabold tracking-tight text-indigo-700\">Antigravity ETF</h1>
        < p className =\"text-sm text-gray-500 mt-1\">Next-Gen AI ETF Analysis Platform</p>
        </div >
      </header >

  <section className=\"w-full max-w-5xl bg-white rounded-xl shadow-sm p-6 mb-8 border border-gray-100\">
    < h2 className =\"text-xl font-bold mb-4 flex items-center gap-2\">
      < Search className =\"w-5 h-5 text-indigo-500\" /> 종목 비교 
        </h2 >
  <div className=\"flex gap-4 items-end\">
    < div className =\"flex-1\">
      < label className =\"block text-xs font-semibold text-gray-500 mb-1\">ETF 종목코드 1</label>
        < input
value = { etfCodes[0]}
onChange = { e => setEtfCodes([e.target.value, etfCodes[1]]) }
className =\"w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none\"
placeholder =\"코드 입력 (예: 453850)\"
  />
          </div >
  <div className=\"flex-1\">
    < label className =\"block text-xs font-semibold text-gray-500 mb-1\">ETF 종목코드 2</label>
      < input
value = { etfCodes[1]}
onChange = { e => setEtfCodes([etfCodes[0], e.target.value]) }
className =\"w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none\"
placeholder =\"코드 입력 (예: 462330)\"
  />
          </div >
  <button
    onClick={fetchComparison}
    disabled={loading}
    className=\"bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-6 rounded-lg transition-colors flex items-center gap-2\"
      >
    {
      loading?<Loader2 className =\"w-5 h-5 animate-spin\" /> : \"비교 분석\"}
          </button>
        </div >
      </section >

  { data && (
    <div className=\"w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-8\">
{/* Table Section */ }
<section className=\"bg-white rounded-xl shadow-sm p-6 border border-gray-100\">
  < h3 className =\"text-lg font-bold mb-4\">비교 요약</h3>
    < div className =\"overflow-x-auto\">
      < table className =\"w-full text-left border-collapse\">
        < thead >
        <tr className=\"border-b border-gray-200\">
{
  data.data_payload.header.map((h: string, i: number) => (
    <th key={i} className=\"py-3 px-4 text-sm font-semibold text-gray-600\">{h}</th>
  ))
}
                  </tr >
                </thead >
  <tbody>
    {data.data_payload.rows.map((row: string[], i: number) => (
      <tr key={i} className=\"border-b border-gray-50 hover:bg-gray-50 transition-colors\">
    {row.map((cell: string, j: number) => (
      <td key={j} className=\"py-3 px-4 text-sm\">{cell}</td>
                      ))}
                    </tr >
                  ))}
                </tbody >
              </table >
            </div >

  <div className=\"mt-6 p-4 bg-indigo-50 rounded-lg border border-indigo-100\">
    < h4 className =\"font-bold text-indigo-800 text-sm mb-1\">Quant Insight</h4>
      < p className =\"text-indigo-900 text-sm\">{data.data_payload.insight_comment}</p>
            </div >
          </section >

  {/* Chart Section */ }
  < section className =\"bg-white rounded-xl shadow-sm p-6 border border-gray-100 flex flex-col justify-center\">
    < h3 className =\"text-lg font-bold mb-4 text-center\">종합 역량 비교 (Mock)</h3>
      < div className =\"h-[300px] w-full\">
        < ResponsiveContainer width =\"100%\" height=\"100%\">
          < RadarChart cx =\"50%\" cy=\"50%\" outerRadius=\"80%\" data={radarData}>
            < PolarGrid stroke =\"#e5e7eb\" />
              < PolarAngleAxis dataKey =\"subject\" tick={{ fill: '#4b5563', fontSize: 12 }} />
                < PolarRadiusAxis angle = { 30} domain = { [0, 10]} tick = { false} axisLine = { false} />
                  <Radar name=\"ETF 점수\" dataKey=\"A\" stroke=\"#4f46e5\" fill=\"#6366f1\" fillOpacity={0.4} />
                    < Tooltip />
                </RadarChart >
              </ResponsiveContainer >
            </div >
          </section >
        </div >
      )}
    </main >
  );
}
