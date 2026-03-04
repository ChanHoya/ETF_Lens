const fs = require('fs');

const files = [
    '/Users/chanhojung/ETF_One/dashboard/src/components/KospiExitAnalyzer.tsx',
    '/Users/chanhojung/ETF_One/dashboard/src/components/ExitSignalModals.tsx',
    '/Users/chanhojung/ETF_One/dashboard/src/components/CoveredCallTab.tsx'
];

const targetPattern = /const API_BASE = process\.env\.NEXT_PUBLIC_API_URL\s*\|\|\s*\(\(typeof window !== 'undefined'\s*&&\s*\(window\.location\.hostname\.includes\('vercel\.app'\)\s*\|\|\s*window\.location\.hostname\.includes\('onrender\.com'\)\)\)\s*\?\s*'https:\/\/etf-lens\.onrender\.com'\s*:\s*\(typeof window !== 'undefined'\s*\?\s*`http:\/\/\$\{window\.location\.hostname\}:8000`\s*:\s*'http:\/\/localhost:8000'\)\);/g;

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    if (content.match(targetPattern)) {
        content = content.replace(targetPattern, 'const API_BASE = getApiBase();');

        if (!content.includes('import { getApiBase }')) {
            content = "import { getApiBase } from '../utils/api';\n" + content;
        }

        fs.writeFileSync(file, content);
        console.log(`Updated ${file}`);
    } else {
        console.log(`Pattern not found in ${file}`);
    }
});
