import re

with open("dashboard/src/components/RiskGaugeChart.tsx", "r") as f:
    content = f.read()

# 1. Update overall container paddings (it's around line 98)
content = content.replace(
    '<div className="bg-[#0d0d1a]/95 border border-white/5 rounded-3xl p-3 flex flex-col justify-between hover:bg-white/[0.02] transition-all duration-500 shadow-xl relative overflow-hidden group h-full">',
    '<div className="bg-[#0d0d1a]/95 border border-white/5 rounded-3xl p-3 flex flex-col justify-start hover:bg-white/[0.02] transition-all duration-500 shadow-xl relative overflow-hidden group h-full">'
)

# 2. Enlarge SVG Gauge
content = content.replace(
    '<div className="relative w-[200px] h-[115px] flex items-center justify-center select-none mt-1">',
    '<div className="relative w-[240px] h-[135px] flex items-center justify-center select-none mt-0 ml-[-10px]">'
)

# 3. Fix breakdown column alignment (around line 208)
content = content.replace(
    '<div className="flex-1 w-full flex flex-col gap-2 relative z-10 mt-1 pl-0 lg:pl-2">',
    '<div className="flex-1 w-full flex flex-col gap-1.5 relative z-10 mt-0 pl-0 lg:pl-2">'
)
content = content.replace(
    '<h4 className="text-[10px] text-gray-500 font-bold mb-1 tracking-wider uppercase">지표별 위험 기여도</h4>',
    '<h4 className="text-[10px] text-gray-500 font-bold mb-0 tracking-wider uppercase">지표별 위험 기여도</h4>'
)
# Reduce breakdown row padding
content = content.replace(
    '<div key={index} className="flex justify-between items-center bg-white/[0.02] px-2.5 py-1.5 rounded-lg border border-white/5 hover:bg-white/5 transition-colors">',
    '<div key={index} className="flex justify-between items-center bg-white/[0.02] px-2 py-1 rounded-lg border border-white/5 hover:bg-white/5 transition-colors">'
)

with open("dashboard/src/components/RiskGaugeChart.tsx", "w") as f:
    f.write(content)
