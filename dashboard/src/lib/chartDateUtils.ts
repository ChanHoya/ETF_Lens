// 차트 X축 날짜 및 연도 겹침을 방지하기 위해 4자리 연도를 '26 형식으로 표준 축약하는 유틸리티

/**
 * 차트 X축 날짜/연도 문자열을 컴팩트한 'YY/MM/DD 또는 'YY 형식으로 표준 변환합니다.
 * @param dateStr 입력 날짜 (예: "2026-01-10", "2026-10", "2026", 2026)
 * @returns 축약된 날짜 문자열 (예: "'26/01/10", "'26/10", "'26")
 */
export function formatChartDate(dateStr: string | number | null | undefined): string {
  if (dateStr === null || dateStr === undefined) return '';
  const str = String(dateStr).trim();
  if (!str) return '';

  // 이미 'YY 형식으로 시작하는 경우
  if (str.startsWith("'")) {
    return str.replace(/-/g, '/');
  }

  // YYYY-MM-DD 또는 YYYY/MM/DD 또는 YYYY.MM.DD 형식 (예: 2026-01-10)
  const fullDateMatch = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (fullDateMatch) {
    const yy = fullDateMatch[1].slice(2);
    const mm = fullDateMatch[2].padStart(2, '0');
    const dd = fullDateMatch[3].padStart(2, '0');
    return `'${yy}/${mm}/${dd}`;
  }

  // YYYY-MM 또는 YYYY/MM 또는 YYYY.MM 형식 (예: 2026-10, 2026.10)
  const yearMonthMatch = str.match(/^(\d{4})[-/.](\d{1,2})$/);
  if (yearMonthMatch) {
    const yy = yearMonthMatch[1].slice(2);
    const mm = yearMonthMatch[2].padStart(2, '0');
    return `'${yy}/${mm}`;
  }

  // 4자리 연도만 있는 경우 (예: 2026)
  const yearOnlyMatch = str.match(/^(\d{4})$/);
  if (yearOnlyMatch) {
    return `'${yearOnlyMatch[1].slice(2)}`;
  }

  // YYYY-MM-DD HH:mm 등의 복합 타임스탬프인 경우 앞 10자리만 파싱
  const prefixMatch = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\s/);
  if (prefixMatch) {
    const yy = prefixMatch[1].slice(2);
    const mm = prefixMatch[2].padStart(2, '0');
    const dd = prefixMatch[3].padStart(2, '0');
    return `'${yy}/${mm}/${dd}`;
  }

  // 기타 형식은 20XX를 'XX로 단순 치환
  return str.replace(/\b20(\d{2})\b/g, "'$1").replace(/-/g, '/');
}
