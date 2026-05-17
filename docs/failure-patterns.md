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

## 네트워크 및 보안 (CORS)

### "Failed to fetch" — CORS 차단
- **증상**: 브라우저에서 서버가 살아있음에도 API 호출 실패 (서버 로그에는 기록 안 됨)
- **원인**: `CORSMiddleware` 설정에서 `allow_origins=["*"]`와 `allow_credentials=True`를 동시에 사용
- **해결**: `allow_origins`에 실제 도메인(`https://etf-lens.vercel.app`)을 명시하거나, `allow_credentials=False`

### "Application Error" — 런타임 크래시
- **증상**: 브라우저 로드 시 Vercel 오류 페이지 노출 또는 "Failed to fetch" 반복
- **원인**: 백엔드 응답이 `null`이거나 `NaN`인 데이터를 처리하지 않고 렌더링 시도
- **해결**: 모든 수치 데이터에 `isNaN()` 및 `null` 체크 방어 로직 적용, 투자 원금과 같이 유실되면 안 되는 핵심 입력 데이터는 `localStorage`를 1순위 저장소(fallback)로 활용하여 오프라인 환경에서도 작동하게 함

## Finance Data APIs

### yfinance "NoneType object is not subscriptable" & SSL/DNS Failures
- **증상**: 야후 파이낸스 데이터를 긁어올 때 API 500 에러 발생 및 차트 데이터 로딩 실패.
- **원인**: `yfinance` 라이브러리의 최신 스크래핑 파서 버그로 인해 특정 지수/티커 조회 시 내부 `NoneType` 오류 발생, 혹은 서버 IP 차단(SSL/DNS 연결 실패).
- **해결**: Multi-source Fallback 전략을 구현하여 극복:
  1. **국내 자산/지수**: pykrx 또는 `FinanceDataReader`(네이버 파이낸스)를 1순위로 지정하여 야후 파이낸스 의존도 최소화.
  2. **해외 자산/지수**: `yfinance` 라이브러리 대신 Yahoo v8 Chart API를 `requests` 직접 호출하여 버그 회피 및 병렬 처리(`asyncio.to_thread` + Semaphore)를 적용해 타임아웃 방지.
