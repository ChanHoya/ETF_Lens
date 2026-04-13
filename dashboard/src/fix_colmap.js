const fs = require('fs');
const file = '/Users/chanhojung/ETF_One/dashboard/src/lib/tff/excelParser.ts';
let content = fs.readFileSync(file, 'utf8');

const regex = /hRow\.forEach\(\(val, c\) => \{[\s\S]*?\}\);/;
const replacement = `hRow.forEach((val, c) => {
            if (typeof val === 'string') {
                const clean = val.replace(/\\s/g, '');
                if (clean.includes('종목명') && colMap.name === undefined) colMap.name = c;
                else if (clean.includes('투자손익') && colMap.pnl === undefined) colMap.pnl = c;
                else if (clean.includes('기초평가') && colMap.begin === undefined) colMap.begin = c;
                else if (clean.includes('기말평가') && colMap.end === undefined) colMap.end = c;
                else if (clean.includes('매수') && !clean.includes('손익') && !clean.includes('기말') && colMap.buy === undefined) colMap.buy = c;
                else if (clean.includes('매도') && !clean.includes('손익') && !clean.includes('기초') && colMap.sell === undefined) colMap.sell = c;
                else if ((clean.includes('배당') || clean.includes('이자')) && colMap.div === undefined) colMap.div = c;
                else if ((clean.includes('신용') || clean.includes('대여')) && colMap.credit === undefined) colMap.credit = c;
            }
        });`;

content = content.replace(regex, replacement);
fs.writeFileSync(file, content);
