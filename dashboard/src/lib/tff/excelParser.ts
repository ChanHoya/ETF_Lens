import * as XLSX from 'xlsx';
import { 
    TffFundData, TffMonthInfo, TffHoldingsRow, TffMonthlySummary, 
    TffAssetReturns, TffCumulativeSummary, TffCumulativeRow, TffAssetReturnRow 
} from './types';
import krTickers from './kr-tickers.json';

// 문자열을 숫자로 안전하게 변환 (콤마 제거, 에러 방지)
function parseNumber(val: any): number {
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
        const cleaned = val.replace(/,/g, '').trim();
        // 백분율 처리 (예: "8.2%" -> 8.2)
        if (cleaned.endsWith('%')) {
             return parseFloat(cleaned.replace('%', ''));
        }
        const num = parseFloat(cleaned);
        return isNaN(num) ? 0 : num;
    }
    return 0;
}

function parseOptionalNumber(val: any): number | undefined {
    if (val === undefined || val === null || val === '') return undefined;
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
        const cleaned = val.replace(/,/g, '').trim();
        if (cleaned === '' || cleaned === '-') return undefined;
        if (cleaned.endsWith('%')) {
             const p = parseFloat(cleaned.replace('%', ''));
             return isNaN(p) ? undefined : p;
        }
        const num = parseFloat(cleaned);
        return isNaN(num) ? undefined : num;
    }
    return undefined;
}

function parseOptionalPercentage(val: any): number | undefined {
    if (val === undefined || val === null || val === '') return undefined;
    // Excel stores percentages as floats (e.g., 84.5% = 0.845)
    if (typeof val === 'number') return val * 100;
    if (typeof val === 'string') {
        const cleaned = val.replace(/,/g, '').trim();
        if (cleaned === '' || cleaned === '-') return undefined;
        if (cleaned.endsWith('%')) {
             const p = parseFloat(cleaned.replace('%', ''));
             return isNaN(p) ? undefined : p;
        }
        const num = parseFloat(cleaned);
        return isNaN(num) ? undefined : num;
    }
    return undefined;
}

export function parseTffExcel(buffer: ArrayBuffer): { data: TffFundData, rawSheets: any } {
    const workbook = XLSX.read(buffer, { type: 'array' });
    const rawSheets: Record<string, any[]> = {};

    // 로깅용으로 원본 추출
    workbook.SheetNames.forEach(sheetName => {
        rawSheets[sheetName] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });
    });

    const parsedData: TffFundData = {
        parsedAt: new Date().toISOString(),
        cumulative: { yearlyData: [], monthlyData: [], totalData: null },
        assetReturns: { assets: [], total: { months: {}, cumulative: 0 }, benchmarks: { kospi: {months:{}, cumulative:0}, sp500: {months:{}, cumulative:0} } },
        ytm: null,
        monthlyMap: {},
        latestMonth: ""
    };

    // 1. 총누적손익 시트 파싱
    const totalSheet = rawSheets["총누적손익"];
    if (totalSheet) {
        parsedData.cumulative = parseCumulativeSheet(totalSheet);
    }

    // 2. 종목별수익율 시트 파싱
    const assetReturnSheetKey = Object.keys(rawSheets).find(k => k.replace(/\s/g, '').includes("종목별수익"));
    if (assetReturnSheetKey) {
        parsedData.assetReturns = parseAssetReturnSheet(rawSheets[assetReturnSheetKey]);
    }

    // 3. YTM 및 월별(1월~12월) 시트 파싱
    const monthRegex = /^(\d+)월$/;
    let maxMonthNum = 0;

    workbook.SheetNames.forEach(sheetName => {
        if (sheetName === "YTM") {
            parsedData.ytm = parseMonthOrYtmSheet(rawSheets[sheetName], "YTM");
        } else {
            const match = sheetName.match(monthRegex);
            if (match) {
                const monthNum = parseInt(match[1]);
                // 월별 시트 파싱
                const monthInfo = parseMonthOrYtmSheet(rawSheets[sheetName], sheetName);
                if (monthInfo.holdings.length > 0) {
                    if (monthNum > maxMonthNum) maxMonthNum = monthNum;
                    parsedData.monthlyMap[sheetName] = monthInfo;
                }
            }
        }
    });

    if (maxMonthNum > 0) {
        parsedData.latestMonth = `${maxMonthNum}월`;
    } else {
        parsedData.latestMonth = "YTM";
    }

    console.log('[TffExcelParser] 파싱 완료:', parsedData);
    return { data: parsedData, rawSheets };
}

// 총누적손익 시트 파싱 (I~AK열)
function parseCumulativeSheet(rows: any[][]): TffCumulativeSummary {
    const summary: TffCumulativeSummary = { yearlyData: [], monthlyData: [], totalData: null };
    try {
        let baseIdx = -1; // "기초평가액" row
        let netInOutIdx = -1;
        let endValueIdx = -1;
        let profitIdx = -1;
        let returnRateIdx = -1;
        let kospiIdx = -1;
        let sp500Idx = -1;
        let kospiTwIdx = -1;
        let sp500TwIdx = -1;

        for(let i=0; i<30; i++) {
            if (rows[i]) {
                const rowStr = String(rows[i][0] || '') + String(rows[i][1] || '') + String(rows[i][2] || '');
                const fullRowStr = rows[i].join('');
                
                if (rowStr.includes("기초평가액")) baseIdx = i;
                if (rowStr.includes("순입출")) netInOutIdx = i;
                if (rowStr.includes("기말평가")) endValueIdx = i;
                if (rowStr.includes("투자수익금")) profitIdx = i;
                
                // '수익률(%)' or '총수익률' (KOSPI나 S&P가 아닌 순수 포트폴리오 수익률을 마지막으로 매칭)
                if ((rowStr.includes("수익률") || rowStr.includes("수익율")) && 
                    !fullRowStr.includes("시간평잔") && 
                    !fullRowStr.toUpperCase().includes("KOSPI") && 
                    !fullRowStr.toUpperCase().includes("S&P")) {
                    returnRateIdx = i;
                }
                
                const isKospi = fullRowStr.toUpperCase().includes("KOSPI") || fullRowStr.includes("코스피");
                const isSp500 = fullRowStr.toUpperCase().includes("S&P") || fullRowStr.toUpperCase().includes("SP500") || fullRowStr.includes("에스앤피");
                const isTw = fullRowStr.replace(/\s/g,'').includes("시간평잔");

                if (isKospi) {
                    if (isTw) kospiTwIdx = i;
                    else kospiIdx = i;
                }
                if (isSp500) {
                    if (isTw) sp500TwIdx = i;
                    else sp500Idx = i;
                }
            }
        }
        
        // 시간평잔 지표 최우선 적용 (사용자 요청 사항)
        if (kospiTwIdx !== -1) kospiIdx = kospiTwIdx;
        if (sp500TwIdx !== -1) sp500Idx = sp500TwIdx;
        
        console.log(`[Parse] baseIdx=${baseIdx}, netInOutIdx=${netInOutIdx}, endValueIdx=${endValueIdx}, profitIdx=${profitIdx}, returnRateIdx=${returnRateIdx}, kospiIdx=${kospiIdx}, sp500Idx=${sp500Idx}`);
        
        if (baseIdx === -1) {
            console.error("총누적손익 시계열 기준(기초평가액)을 찾을 수 없습니다.");
            return summary;
        }

        // 폴백
        if (netInOutIdx === -1) netInOutIdx = baseIdx + 1;
        if (endValueIdx === -1) endValueIdx = baseIdx + 2;
        if (profitIdx === -1) profitIdx = baseIdx + 3;
        if (returnRateIdx === -1) returnRateIdx = baseIdx + 4;
        if (kospiIdx === -1) kospiIdx = returnRateIdx + 1;
        if (sp500Idx === -1) sp500Idx = returnRateIdx + 2;

        let timeWeightedIdx = rows.findIndex(r => r.some((cell: any) => String(cell).includes('시간평잔')));
        if (timeWeightedIdx === -1) timeWeightedIdx = baseIdx + 8; // 대충 맨 밑으로
        for(let r=baseIdx+1; r<baseIdx+15; r++) {
            if (rows[r] && rows[r].some(v => String(v).replace(/\s/g,'').includes("시간평잔수익"))) {
                timeWeightedIdx = r; break;
            }
        }

        let maxCols = 0;
        for(let r=0; r<=baseIdx+10; r++) {
            if (rows[r] && rows[r].length > maxCols) maxCols = rows[r].length;
        }

        let currentYear = "2024";

        for (let c = 0; c < maxCols; c++) {
            let isTotal = false;
            let totalLabel = "";
            let monthFound = "";

            // 현재 컬럼의 0번 행부터 baseIdx 직전까지 모든 헤더 블록스캔
            for(let r=0; r<baseIdx; r++) {
                const rawVal = rows[r]?.[c];
                if (rawVal === undefined || rawVal === null || rawVal === "") continue;
                
                const rawStr = String(rawVal).trim();
                const cleanStr = rawStr.replace(/\s+/g, '');

                // 연도 갱신
                if (cleanStr.includes('년') && !cleanStr.includes('계')) {
                     currentYear = cleanStr.replace('년', '').replace(/[^0-9]/g, '') || currentYear;
                }

                // 총계 타입 갱신
                if (cleanStr.includes('연간계') || cleanStr.includes('누적계') || cleanStr.includes('총누적')) {
                     isTotal = true;
                     totalLabel = rawStr.replace(/\r?\n/g, ' '); 
                }

                // 월 타입 갱신
                const mMatch = cleanStr.match(/^(\d+)월$/);
                if (mMatch) {
                    monthFound = mMatch[1];
                } else {
                    const n = parseInt(cleanStr); // 엑셀 서식에 의해 "7"로 읽힐 가능성 대비
                    if (!isNaN(n) && n >= 1 && n <= 12 && cleanStr === String(n)) {
                         monthFound = String(n);
                    }
                }
            }

            // 데이터 추출 (동적 인덱스 사용)
            const beginValRaw = rows[baseIdx]?.[c];
            const endValRaw = rows[endValueIdx]?.[c];
            const profitValRaw = rows[profitIdx]?.[c];

            const isEmptyColumn = (endValRaw === undefined || endValRaw === '' || endValRaw === null) && 
                                  (profitValRaw === undefined || profitValRaw === '' || profitValRaw === null) &&
                                  (beginValRaw === undefined || beginValRaw === '' || beginValRaw === null);

            const dataRow: TffCumulativeRow = {
                year: totalLabel || currentYear, 
                beginValue: parseNumber(beginValRaw),
                netInOut: parseNumber(rows[netInOutIdx]?.[c]),
                endValue: parseNumber(endValRaw),
                profitAmount: parseNumber(profitValRaw),
                returnRate: parseOptionalPercentage(rows[returnRateIdx]?.[c]) ?? 0,
                kospiRate: parseOptionalPercentage(rows[kospiIdx]?.[c]) ?? 0,
                sp500Rate: parseOptionalPercentage(rows[sp500Idx]?.[c]) ?? 0,
                timeWeightedReturn: parseOptionalPercentage(rows[timeWeightedIdx]?.[c]) ?? 0,
            };

            if (isTotal) {
                dataRow.year = totalLabel.trim() || '총누적계';
                if (dataRow.year.includes('누적')) {
                    summary.totalData = dataRow;
                } else {
                    summary.yearlyData.push(dataRow);
                }
            } else if (monthFound) {
                // 미래의 빈 월은 스킵
                if (isEmptyColumn) continue;

                const monthNum = monthFound.padStart(2, '0');
                summary.monthlyData.push({
                    period: `${currentYear}-${monthNum}`,
                    beginValue: dataRow.beginValue,
                    netInOut: dataRow.netInOut,
                    endValue: dataRow.endValue,
                    profitAmount: dataRow.profitAmount,
                    returnRate: dataRow.returnRate,
                    kospiRate: dataRow.kospiRate,
                    sp500Rate: dataRow.sp500Rate
                });
            }
        }

        // 미래의 데이터 없는 달(산식 등으로 0이나 비정상적인 값이 된 꼬리 부분) 잘라내기
        let lastValidIndex = -1;
        for (let i = 0; i < summary.monthlyData.length; i++) {
            const m = summary.monthlyData[i];
            // 순입출금이 있거나 기말자산이 0초과이면 의미있는 데이터로 간주
            if (m.endValue > 0 || m.netInOut !== 0) {
                lastValidIndex = i;
            }
        }
        if (lastValidIndex >= 0) {
            summary.monthlyData = summary.monthlyData.slice(0, lastValidIndex + 1);
        } else {
            summary.monthlyData = [];
        }

        // 폴백: 연간 파싱 에러로 total이 비어있다면, yearly의 마지막 값을 배정 
        if (!summary.totalData && summary.yearlyData.length > 0) {
            summary.totalData = summary.yearlyData[summary.yearlyData.length - 1]; 
        }

    } catch (e) {
        console.error("총누적손익 파싱 실패:", e);
    }
    return summary;
}

// 종목별수익율 시트 파싱
function parseAssetReturnSheet(rows: any[][]): TffAssetReturns {
    const res: TffAssetReturns = { assets: [], total: { months: {}, cumulative: 0 }, benchmarks: { kospi: {months:{}, cumulative:0}, sp500: {months:{}, cumulative:0} } };
    
    try {
        let headerRowIdx = -1;
        let nameColIdx = 0; // 보통 0 이거나 1 번 줄
        for(let i=0; i<20; i++) {
            if (rows[i]) {
                const idx = rows[i].findIndex(v => String(v).replace(/\s/g, '').includes("종목명") || String(v).replace(/\s/g, '').includes("상품명"));
                if (idx !== -1) {
                    headerRowIdx = i; 
                    nameColIdx = idx;
                    break;
                }
            }
        }
        if (headerRowIdx === -1) return res;

        const hRow = rows[headerRowIdx];
        const monthCols: { month: string, idx: number }[] = [];
        let cumColIdx = -1;
        let capitalColIdx = -1;

        hRow.forEach((val, c) => {
            const strVal = String(val).replace(/\s/g, '');
            if (strVal.match(/^\d+월$/)) monthCols.push({ month: strVal, idx: c });
            else if (strVal.includes("누적")) cumColIdx = c;
            else if (strVal.includes("%지분손익") || strVal.includes("자본손익")) capitalColIdx = c;
        });

        // 텍스트 보정 - 자본손익(또는 지분손익) 찾기
        if (capitalColIdx === -1) {
            const secondHeader = rows[headerRowIdx-1] || [];
            secondHeader.forEach((val, c) => {
                if (typeof val ==='string' && val.includes("지분손익")) capitalColIdx = c;
            })
        }

        // 행 순회
        for(let r = headerRowIdx + 1; r < rows.length; r++) {
            if (!rows[r]) continue;
            
            const cellVal = rows[r][nameColIdx] || rows[r][nameColIdx+1]; // 병합셀 대비
            if (cellVal === undefined || cellVal === null || String(cellVal).trim() === '') continue;
            
            const rowName = String(cellVal).trim();
            // Note, 항목 같은 설명 텍스트 스킵, 그리고 현금도 제외
            if (rowName === "현금" || rowName.startsWith("Note") || rowName.includes("수익률은") || rowName.startsWith("1)") || rowName.startsWith("2)")) continue;
            
            const isTotal = rowName.includes("합계");
            const isKospi = rowName.toUpperCase().includes("KOSPI") || rowName.includes("코스피");
            const isSp500 = rowName.toUpperCase().includes("S&P") || rowName.toUpperCase().includes("SP500");

            const monthsData: Record<string, number> = {};
            let hasValidData = false;
            monthCols.forEach(mc => {
                const mVal = parseOptionalNumber(rows[r][mc.idx]);
                if (mVal !== undefined) {
                    monthsData[mc.month] = mVal;
                    hasValidData = true;
                }
            });
            const rawCumValue = parseOptionalNumber(rows[r][cumColIdx]);
            if (rawCumValue !== undefined) hasValidData = true;
            
            // 모든 값이 #N/A (비어있음)인 미보유 종목 제외
            if (!hasValidData && !isTotal && !isKospi && !isSp500) continue;

            const cumValue = rawCumValue !== undefined ? rawCumValue : 0;

            if (isTotal) {
                res.total.months = monthsData;
                res.total.cumulative = cumValue;
            } else if (isKospi) {
                res.benchmarks.kospi.months = monthsData;
                res.benchmarks.kospi.cumulative = cumValue;
            } else if (isSp500) {
                res.benchmarks.sp500.months = monthsData;
                res.benchmarks.sp500.cumulative = cumValue;
            } else {
                // 일반 종목
                // 지분손익 열(R열 근처)이 이미지에 보이므로 우측 영역 탐색
                res.assets.push({
                    name: rowName,
                    code: (krTickers as Record<string, string>)[rowName], // 매핑된 종목코드 (있는 경우)
                    months: monthsData,
                    cumulative: cumValue,
                    capitalPnlPercentage: capitalColIdx > -1 ? parseNumber(rows[r][capitalColIdx]) : 0
                });
            }
        }
    } catch (e) {
        console.error("종목별수익율 파싱 실패:", e);
    }
    return res;
}

// 1~12월 및 YTM 시트 파싱
function parseMonthOrYtmSheet(rows: any[][], periodName: string): TffMonthInfo {
    const info: TffMonthInfo = {
        period: periodName,
        holdings: [],
        summary: { totalBeginValue: 0, totalBuyAmount: 0, totalSellAmount: 0, totalEndValue: 0, totalDividend: 0, totalPnl: 0, cashBalance: 0, carryoverBalance: 0, deposit: 0, withdrawal: 0, totalBalance: 0 }
    };
    
    try {
        let headerRowIdx = -1;
        for(let i=0; i<8; i++) {
            if (rows[i] && rows[i].includes("종목명(상품명)")) {
                headerRowIdx = i; break;
            }
        }
        if (headerRowIdx === -1) return info;

        // 헤더 인덱스 매핑 (이미지 참조)
        const hRow = rows[headerRowIdx];
        const colMap: Record<string, number> = {};
        hRow.forEach((val, c) => {
            if (typeof val === 'string') {
                const clean = val.replace(/\s/g, '');
                if (clean.includes('종목명') && colMap.name === undefined) colMap.name = c;
                else if (clean.includes('투자손익') && colMap.pnl === undefined) colMap.pnl = c;
                else if (clean.includes('기초평가') && colMap.begin === undefined) colMap.begin = c;
                else if (clean.includes('기말평가') && colMap.end === undefined) colMap.end = c;
                else if (clean.includes('매수') && !clean.includes('손익') && colMap.buy === undefined) colMap.buy = c;
                else if (clean.includes('매도') && !clean.includes('손익') && colMap.sell === undefined) colMap.sell = c;
                else if ((clean.includes('배당') || clean.includes('이자')) && colMap.div === undefined) colMap.div = c;
                else if ((clean.includes('신용') || clean.includes('대차')) && colMap.credit === undefined) colMap.credit = c;
            }
        });

        // Holdings loop
        for(let r = headerRowIdx + 1; r < rows.length; r++) {
            const rowData = rows[r];
            if (!rowData || rowData.length === 0) continue;

            // 컬럼 B 근린에 있는 '구분' 값이 전체합계 거나 빈줄이면 break/skip
            const nameVal = rowData[colMap.name || 14]; // O열 근처
            if (nameVal && typeof nameVal === 'string' && nameVal.includes('전체 합계')) {
                // 요약정보 파싱
                info.summary.totalBeginValue = parseNumber(rowData[colMap.begin]);
                info.summary.totalBuyAmount = parseNumber(rowData[colMap.buy]);
                info.summary.totalSellAmount = parseNumber(rowData[colMap.sell]);
                info.summary.totalEndValue = parseNumber(rowData[colMap.end]);
                info.summary.totalDividend = parseNumber(rowData[colMap.div]);
                info.summary.totalPnl = parseNumber(rowData[colMap.pnl]);
                
                // 이후 몇 줄 아래쪽에서 현금 잔고 캡쳐 (하드코딩 탐색)
                for(let sr=r+1; sr < r+10; sr++) {
                    if (rows[sr] && rows[sr].includes("현금잔고")) {
                        // 우측 인덱스 어딘가에 값이 있음
                        info.summary.cashBalance = parseNumber(rows[sr][rows[sr].indexOf("현금잔고")+1] || rows[sr].find(v=>typeof v==='number'));
                    }
                    if (rows[sr] && rows[sr].includes("이월잔고")) {
                         // 바로 윗줄이나 해당줄에서 이월잔고, 입금, 출금, 종합잔고 매핑
                         let tr = sr+1; // 보통 숫자값은 밑에 줄에 있음
                         info.summary.carryoverBalance = parseNumber(rows[tr][rows[sr].indexOf("이월잔고")]);
                         info.summary.deposit = parseNumber(rows[tr][rows[sr].indexOf("입금")]);
                         info.summary.withdrawal = parseNumber(rows[tr][rows[sr].indexOf("출금")]);
                         info.summary.totalBalance = parseNumber(rows[tr][rows[sr].indexOf("종합잔고")]);
                         break;
                    }
                }
                break; // 홀딩스 끝
            }

            if (!nameVal || typeof nameVal !== 'string') continue;

            info.holdings.push({
                name: nameVal,
                code: (krTickers as Record<string, string>)[nameVal],
                beginValue: parseNumber(rowData[colMap.begin]),
                buyAmount: parseNumber(rowData[colMap.buy]),
                sellAmount: parseNumber(rowData[colMap.sell]),
                endValue: parseNumber(rowData[colMap.end]),
                dividend: parseNumber(rowData[colMap.div]),
                creditInterest: parseNumber(rowData[colMap.credit]),
                investmentPnl: parseNumber(rowData[colMap.pnl])
            });
        }
        
        // 만약 전체 합계 로우를 찾지 못했거나 값이 모두 0이라면, 개별 종목 데이터를 직접 합산하여 폴백 처리
        if (info.summary.totalBeginValue === 0 && info.summary.totalEndValue === 0 && info.holdings.length > 0) {
            info.summary.totalBeginValue = info.holdings.reduce((sum, h) => sum + (h.beginValue || 0), 0);
            info.summary.totalBuyAmount = info.holdings.reduce((sum, h) => sum + (h.buyAmount || 0), 0);
            info.summary.totalSellAmount = info.holdings.reduce((sum, h) => sum + (h.sellAmount || 0), 0);
            info.summary.totalEndValue = info.holdings.reduce((sum, h) => sum + (h.endValue || 0), 0);
            info.summary.totalDividend = info.holdings.reduce((sum, h) => sum + (h.dividend || 0), 0);
            info.summary.totalPnl = info.holdings.reduce((sum, h) => sum + (h.investmentPnl || 0), 0);
        }

    } catch (e) {
         console.error(`${periodName} 시트 파싱 실패:`, e);
    }

    return info;
}
