# Failure Patterns — ETF Lens

> 반복 발생한 오류 패턴 기록. 새 세션 시작 시 반드시 확인.

## KIS API

### EGW00133 — 속도 초과
- **증상**: KIS API 호출 시 `rt_cd != "0"`, msg_cd = EGW00133
- **원인**: 초당 1건 초과 호출
- **해결**: `await asyncio.sleep(1.2)` 각 계좌 조회 사이 필수, EGW00133 감지 시 `sleep(2.5)` 후 재시도

### 해외 잔고 누락
- **증상**: 포트폴리오에 해외 주식 안 보임
- **원인**: CTRP6504R 엔드포인트 개별 오류
- **해결**: overseas 실패 시 국내만 반환 (현재 구현), 로그 확인

## DB

### etf_data_v2.db 커밋
- **증상**: git push 타임아웃 (88MB 바이너리)
- **해결**: `.gitignore`에 `backend/etf_data_v2.db` 등록됨 — 절대 add하지 말 것

### Render PostgreSQL 만료
- **증상**: `[Errno -2] Name or service not known`
- **원인**: Render 무료 PostgreSQL 90일 만료
- **해결**: 유료 전환($7/월) 또는 새 DB 생성 후 DATABASE_URL 환경변수 업데이트

## TFF Dashboard

### 예수금 0원
- **증상**: OverviewView에서 예수금이 0원으로 표시
- **원인**: 엑셀 '현금' 행 텍스트가 cashKeywords 배열에 없는 경우
- **해결**: `excelParser.ts`의 `cashKeywords`에 해당 텍스트 추가

### 신규 상장 종목 차트 갭
- **증상**: 상장 이후 가격 데이터만 있는 종목에서 차트 갭 발생
- **원인**: 과거 null 데이터
- **해결**: 차트 라이브러리에서 null 스킵 처리

## Vercel 배포

### Build 실패 — "DB 바이너리 파일"
- **증상**: Render build timeout 또는 GitHub 경고
- **원인**: `.db` 파일 커밋
- **해결**: `.gitignore` 확인

## 일반 패턴

### `_PORTFOLIO_CACHE` 오래된 데이터
- **증상**: My Assets 새로고침 후에도 이전 데이터 표시
- **원인**: 5분 캐시 TTL
- **해결**: "새로고침" 버튼 → `isManualRefresh=true` → 캐시 무효화
