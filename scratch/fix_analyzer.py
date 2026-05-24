import re

with open("dashboard/src/components/KospiExitAnalyzer.tsx", "r") as f:
    content = f.read()

# 1. Add state for selectedDate
content = content.replace(
    'const [isDetailOpen, setIsDetailOpen] = useState(false);',
    'const [isDetailOpen, setIsDetailOpen] = useState(false);\n    const [selectedDate, setSelectedDate] = useState<string>("");'
)

# 2. Add selectedDate to useEffect dependency and fetch URL
content = content.replace(
    'const fetchData = async () => {',
    'const fetchData = async () => {\n            setIsLoading(true);'
)
content = content.replace(
    'const res = await fetch(`${API_BASE}/api/v1/exit-signal`);',
    'const url = selectedDate ? `${API_BASE}/api/v1/exit-signal?target_ym=${selectedDate}` : `${API_BASE}/api/v1/exit-signal`;\n                const res = await fetch(url);'
)
content = content.replace(
    'if (savedData) {',
    'if (savedData && !selectedDate) {'
)
content = content.replace(
    'useEffect(() => {\n        fetchData();\n    }, []);',
    'useEffect(() => {\n        fetchData();\n    }, [selectedDate]);'
)

# 3. Add DatePicker UI next to the title
date_picker_ui = '''<div className="ml-auto mr-4 flex items-center gap-2">
                        <label className="text-xs text-gray-400 font-medium">기준월:</label>
                        <input 
                            type="month" 
                            className="bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-xs text-white outline-none focus:border-indigo-500 transition-colors"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            max={new Date().toISOString().slice(0,7)}
                        />
                    </div>'''

content = content.replace(
    '<p className="text-xs text-gray-400 font-medium mt-0.5">VIX·VKOSPI 및 글로벌 매크로 인텔리전스 결합 분석</p>\n                    </div>\n                </div>',
    '<p className="text-xs text-gray-400 font-medium mt-0.5">VIX·VKOSPI 및 글로벌 매크로 인텔리전스 결합 분석</p>\n                    </div>\n                </div>\n                ' + date_picker_ui
)

with open("dashboard/src/components/KospiExitAnalyzer.tsx", "w") as f:
    f.write(content)

