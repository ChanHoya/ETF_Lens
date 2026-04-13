import * as XLSX from 'xlsx';
import * as fs from 'fs';

const buf = fs.readFileSync("/Users/chanhojung/Downloads/TFF 펀드 현황 2026년 3월말_2026-3-31.xlsx");
const workbook = XLSX.read(buf, { type: 'buffer' });
const sheet = XLSX.utils.sheet_to_json(workbook.Sheets["총누적손익"], { header: 1 });

for(let i=0; i<8; i++) {
    console.log(`Row ${i}:`, sheet[i]);
}
