import * as fs from 'fs';
import * as path from 'path';
import xlsx from 'xlsx';

// 엑셀 파일 경로
const EXCEL_FILE_PATH = path.join(__dirname, '../data/tff/TFF 펀드 현황 2026년 3월말_2026-3-31.xlsx');
const OUTPUT_FILE_PATH = path.join(__dirname, '../src/data/tff/tff_fund_2026.json');

// 데이터 추출을 위한 인터페이스 단순화 (기획서 기반)
interface TffFundData {
  tffConfig: {
    year: number;
    members: number;
    totalInitialInvestment: number;
    additionalInvestmentPerMonth: number;
    inceptionDate: string;
    targetReturn: number;
  };
  months: any[];
}

function convertExcelToJson() {
  console.log(`[TFF Parser] 엑셀 파일 로딩 중: ${EXCEL_FILE_PATH}`);
  
  if (!fs.existsSync(EXCEL_FILE_PATH)) {
    console.error(`❌ 원본 엑셀 파일을 찾을 수 없습니다: ${EXCEL_FILE_PATH}`);
    console.log(`[알림] /dashboard/data/tff/ 경로에 엑셀 파일이 복사되었는지 확인해주세요.`);
    process.exit(1);
  }

  const workbook = xlsx.readFile(EXCEL_FILE_PATH);
  
  // JSON 파일의 뼈대
  const fundData: TffFundData = {
    tffConfig: {
      year: 2026,
      members: 6,
      totalInitialInvestment: 6000000,
      additionalInvestmentPerMonth: 600000,
      inceptionDate: "2024-03-01",
      targetReturn: 0.15
    },
    months: []
  };

  // 모든 시트 이름 출력 (디버깅용)
  console.log(`[TFF Parser] 시트 목록: ${workbook.SheetNames.join(', ')}`);

  // TODO: 대표님의 엑셀 파일 실제 구조(Row, Col, Header 명)에 맞춰 아래 파싱 로직을 고도화해야 합니다.
  // 현재는 예시로 첫번째 시트를 읽어 JSON 배열로 변환합니다.
  const mainSheetName = workbook.SheetNames[0];
  const mainSheet = workbook.Sheets[mainSheetName];
  const rawData = xlsx.utils.sheet_to_json(mainSheet);

  fundData.months.push({
    month: 3,
    date: "2026-03-31",
    totalValue: 7250000, // 더미 데이터 (추후 rawData에서 합산 처리 필요)
    bookValue: 6600000,
    monthlyReturn: 0.045,
    totalReturn: 0.098,
    cashBalance: 150000,
    holdings: rawData, // 엑셀 행 데이터 전부 삽입
    allocation: { "stock_us": 0.45, "stock_kr": 0.20, "bond": 0.15, "cash": 0.20 }
  });

  // 디렉토리 존재 확인 및 생성
  const outputDir = path.dirname(OUTPUT_FILE_PATH);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(OUTPUT_FILE_PATH, JSON.stringify(fundData, null, 2), 'utf-8');
  console.log(`✅ 변환 완료! JSON 파일이 생성되었습니다: ${OUTPUT_FILE_PATH}`);
}

convertExcelToJson();
