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

## TypeScript Typings & UI Rendering

### Recharts Line Chart Horizontally Clipped Edges
- **증상**: Bento Grid 카드의 미니 차트(달러인덱스, PER 등) 좌우 끝부분 선이 잘려나간 것처럼 렌더링됨.
- **원인**: 여백을 없애기 위해 Recharts `LineChart`에 음수 마진(`margin={{ right: -5, left: -5 }}`)을 사용할 때, 컨테이너의 `overflow-hidden` 속성에 의해 차트 선의 좌우 끝 좌표가 가려져 잘림 현상 발생.
- **해결**: 안전한 양수 마진(`margin={{ right: 6, left: 6 }}`)으로 변경하여 선 전체 좌표가 완전하게 영역 내부에 렌더링되도록 방어함.

### Fear & Greed Index (FGI) 역방향 위험도 매핑
- **증상**: 극단적 공포(0-25)가 빨간색(경고), 극단적 탐욕(76-100)이 초록색(안전)으로 설정되어 정량 퀀트 분석과 정성 매수/매도 시그널의 불일치 발생.
- **원인**: 단순 수치 크기 기준(높음=초록, 낮음=빨강)으로 색상을 지정하여, 오히려 "공포에 매수(초록), 탐욕에 경고(빨강)"라는 투자 원칙에 역행하는 색상 매핑이 기입됨.
- **해결**: 극단적 공포(0-25) 및 공포(26-45) 구간을 초록/에메랄드(매수 적기)로 매핑하고, 극단적 탐욕(76-100) 및 탐욕(56-75) 구간을 빨강/오렌지(시장 과열 경고)로 색상 및 차트 가이드(ReferenceArea)를 전면 스왑함.

### React.cloneElement Type Casting Error (TypeScript)
- **증상**: `React.cloneElement(child, { className: ... })` 호출 시 `React.isValidElement` 검사 후에 복제 속성의 타입 불일치 에러 발생.
- **원인**: TypeScript의 엄격한 제네릭 형변환으로 인해 기본 `ReactNode` 타입을 `ReactElement` 복제 매개변수로 안전하게 취급하지 못함.
- **해결**: 대상 노드를 `React.ReactElement<{ className?: string }>`로 명시적으로 형변환(Casting) 후 클론을 실행하여 컴파일러 통과.

## Quantitative Analysis & Returns Merging

### Cross-Market Correlation Merge Timezone Gap
- **증상**: 한국(KOSPI)과 미국(US) ETF 간의 상관계수 연산 시, 병합된 DataFrame에 대부분 NaN이 채워지거나 `.dropna()` 후 데이터포인트가 급감하는 현상.
- **원인**: 한국과 미국의 다른 영업일(공휴일 차이) 및 실시간 타임스탬프 timezone 오프셋 불일치로 인해 날짜 매핑이 완전히 꼬임.
- **해결**: 각 시계열 인덱스의 타임존을 제거(`tz_convert(None)`) 후 `.date()` 객체 단위로 날짜를 포맷팅하고, Pandas 병합 후 Forward Fill(`.ffill()`)과 `.dropna()`를 순차적으로 실행하여 통계 신뢰성을 안정적으로 확보함.

## AI Integration & Dynamic Indicators

### UI Fallback Static Badges (Demo Data Misleading Warning)
- **증상**: 백엔드 DB에서 실제 ETF 성과 지표(수익률, 변동성)가 수집되어 AI 모델에 실데이터 기반 추천이 전달되었음에도, 화면 우측 상단에 계속해서 `⚠️ 수익률 수치는 데모 데이터`라는 오해의 소지가 있는 경고 배지가 고정 노출되는 현상.
- **원인**: 백엔드 API 응답에 실제 데이터 포함 여부(`has_real_perf`) 플래그가 정의되어 있으나 응답 JSON에 반환되지 않았고, 프론트엔드가 이를 알지 못해 항상 무조건 데모 데이터로 가정한 디자인 적용.
- **해결**: API 응답에 `has_real_perf` boolean 필드를 보강하고, 프론트엔드 UI 컴포넌트(`AIInsight.tsx`)에서 이 플래그에 따라 에메랄드빛 `✨ 실제 성과 지표 반영됨` 또는 주황/빨강 경고 배지를 동적으로 스위칭 렌더링하도록 전환함.

## Git & Deployment

### GitHub Push Network Timeout / connection blocked
- **증상**: git push origin main 실행 시 `Failed to connect to github.com port 443: Couldn't connect to server` 에러 발생.
- **원인**: 로컬 개발 망 또는 특정 샌드박스 내부 네트워크 방화벽이 외부 포트 443 연결을 차단.
- **해결**: 로컬 개발 환경 터미널에서 `git push`를 수동으로 수행하거나, 프록시가 필요한 경우 로컬 환경의 my-context.md 프록시 정보 반영.

## 텔레그램 연동 및 API 알림

### 텔레그램 API 401 Unauthorized
- **증상**: 테스트 알림 전송 시 `API 오류 401: {"ok":false,"error_code":401,"description":"Unauthorized"}` 에러 발생.
- **원인**: 텔레그램 봇 토큰이 잘못 복사되었거나, 콜론(`:`) 등이 누락되었거나, 토큰이 만료/재발급되어 무효화됨.
- **해결**: BotFather로부터 봇 토큰을 정확히 다시 복사해 `******` 마스킹이 없는 원본을 입력창에 넣고 [알림 설정 저장]을 먼저 수행한 후 테스트를 재시도함.

### Render 504 타임아웃의 "Failed to fetch" 오인
- **증상**: API 호출 시 네트워크 오류인 `Failed to fetch`가 발생하나 서버 자체는 작동 중임.
- **원인**: KIS API 속도 초과 등으로 백엔드 응답이 100초 이상 걸릴 때 Render의 무료 티어 로드밸런서가 504 Gateway Timeout을 내려줌. 이 타임아웃 에러 페이지에는 CORS 허용 헤더가 누락되어 브라우저가 응답을 차단하고 `Failed to fetch` 에러를 던짐.
- **해결**: KIS API Rate Limit(EGW00133)을 만났을 때 즉시 다음 API 키를 시도하도록 루프를 개선(`return None` 대신 `continue` 적용)하여 백엔드 연동 응답 시간을 타임아웃 이내로 단축함.

## Next.js & Frontend Build

### 'Skipping validation of types' 설정 하에 React Import 누락으로 인한 런타임 ReferenceError
- **증상**: Next.js 빌드는 오류 없이 성공하는데, 브라우저에서 해당 페이지 로드 시 `ReferenceError: useState is not defined` 등의 크래시 발생.
- **원인**: Next.js 설정에서 TypeScript 타입 검증 및 린트 검사가 생략(`Skipping validation of types`)되도록 구성되어 있을 경우, `useState`나 `useEffect` 같은 API를 import 없이 사용했음에도 컴파일 타임에 잡히지 않고 배포본에 그대로 포함됨.
- **해결**: UI 컴포넌트나 페이지 수정 시 `import React, { useState, useEffect } from 'react';`와 같은 필수 임포트 구문이 유실되었는지 수동으로 꼼꼼히 확인하고, 빌드 로그의 경고나 런타임 콘솔 오류를 적극 모니터링함.

## DB & Migrations

### PostgreSQL 'UndefinedColumnError' (기존 테이블 존재 시 신규 컬럼 누락)
- **증상**: 배포(PostgreSQL) 환경 기동 후 특정 신규 컬럼 조회 API(/evaluate 등) 호출 시 `asyncpg.exceptions.UndefinedColumnError` 발생.
- **원인**: SQLAlchemy `Base.metadata.create_all`은 기존 테이블이 존재할 경우 `ALTER TABLE`을 실행하지 않고 패스함. 로컬 SQLite 마이그레이션 스크립트만 실행할 경우, 배포용 PostgreSQL DB의 기존 테이블 스키마가 업데이트되지 않아 컬럼 누락으로 인한 쿼리 에러 발생.
- **해결**: `main.py` lifespan startup 내에 PostgreSQL DB에 대해 `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` DDL 쿼리를 직접 수행하는 방어 로직을 추가하여 누락 컬럼을 보완함.

## Quantitative Analysis & Returns Merging (추가)

### 한/미 거래일 시차 및 신규/기상장 혼합 시 공통 기준일 탐색 실패
- **증상**: 대형 해외 ETF 구성종목이나 신규 지수를 차트에 추가 시 특정 선이 아예 렌더링되지 않거나, 전체 차트가 `chartData = []`로 텅 비는 버그 발생.
- **원인**: 모든 자산이 동시에 존재해야 하는 공통 기준일(`keys.every(k => d[k] != null)`)을 구하는 연산 방식은 한/미 양국 시장의 휴장일/공휴일 불일치 및 늦게 상장된 ETF가 결합될 때 기준일을 전혀 탐색하지 못해 `undefined`로 떨어지게 됨.
- **해결**: 모든 자산이 동시에 존재하는 공통 기준일을 고집하기보다, **각 자산별로 최초 유효한 데이터(First Valid Price)를 개별 탐색하여 고유의 baseValue를 구축하고 각각 정규화**를 수행하는 알고리즘으로 전환하여 시계열 누락을 원천 예방함.

## Korean Hangul String Mismatch (NFD vs NFC)

### macOS/Browser Decomposed Hangul (NFD) Match Failure in Backend
- **증상**: 특정 ETF 클릭 시, 해당 ETF와 구성종목이 차트에 노출되지 않고 기본 화면(또는 빈 화면)이 유지됨.
- **원인**: macOS 환경이나 특정 브라우저에서 복사/입력된 한글 문자열이 자소 분리 형태인 NFD(Normalization Form Decomposed) 형태로 전송됨. 백엔드 코드의 매핑 딕셔너리 키는 표준 NFC(Normalization Form Composed)로 저장되어 있어 `tickers.get(etf)` 호출 시 `None`을 반환하며 매칭 실패.
- **해결**: 백엔드 라우터 진입 시 `unicodedata.normalize('NFC', etf)`를 활용하여 입력값의 자소를 즉시 합성(NFC)한 후 딕셔너리 매핑 및 비교 처리를 수행해 자소 분리 불일치 버그를 원천 예방함.

## Timezone & Data Gaps
 
### 해외 자산 시차에 따른 당일 데이터 누락 및 등락률 NaN% 연산 오류
- **증상**: KST 낮 시간대에 미국 섹터 변동률 카드가 `USA NaN%`로 렌더링됨.
- **원인**: 미국 증시 개장 전(KST 낮 시간대)에는 미국 지수/ETF의 당일 가격 데이터가 백엔드 응답 데이터의 가장 마지막 인덱스에 존재하지 않아 `undefined`나 `null`로 채워짐. 이 상태에서 단순 마지막 두 인덱스(배열의 `len - 1`과 `len - 2`번째 값)를 추출하여 전일 대비 변동률을 연산하려다 `NaN%`가 발생함.
- **해결**: 데이터 배열의 단순 끝 인덱스를 조회하지 않고, 각 자산(key)별로 값이 존재하고 0보다 큰 유효 데이터 포인트(`validPoints`)만 걸러낸 뒤, 해당 필터링된 배열의 마지막 두 시점(`validPoints[validPoints.length - 1]`과 `validPoints[validPoints.length - 2]`)을 역추적(Back-traversal)하여 안전하게 등락률을 연산하도록 교체함.

## Network & SSL

### yfinance v8 API SSL 인증서 검증 오류
- **증상**: Yahoo Finance v8 API 등을 `requests`로 쿼리 시 `SSLError(SSLCertVerificationError(1, '[SSL: CERTIFICATE_VERIFY_FAILED] certificate verify failed: self-signed certificate in certificate chain...'))` 에러 발생.
- **원인**: 사내/개발 환경 내부 프록시 망이나 샌드박스에서 자체 서명된 인증서 체인을 끼워넣어 SSL 인증서 검증이 실패함.
- **해결**: `requests.get(..., verify=False)` 설정을 부여해 SSL 검증을 명시적으로 우회하고, 이로 인한 경고 메시지 범람을 방지하기 위해 `urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)`를 적용함.

## KIS/KRX Tickers & Alphanumeric Codes

### KIS/KRX 6-Digit Ticker vs WiseReport Alphanumeric Ticker Mismatch
- **증상**: TIGER 미국우주테크 등의 ETF를 보유 중이나, 동종 ETF 경쟁력 분석 카드에서 비교군 내 랭킹이 누락되거나, 내 보유 자산으로 매칭(★ 별표 표시)되지 않고 중복 노출되는 현상.
- **원인**: KIS API는 종목코드로 단축코드(예: `488100` TIGER 미국우주테크)를 반환하지만, WiseReport 크롤링 또는 외부 벤치마크/NAV 계산용 코드로는 alphanumeric 코드(예: `0183J0`)를 사용하여 두 코드가 상호 불일치함. 또한 alphanumeric 코드는 `.isdigit()` 검사 통과를 못하고 필터링 과정에서 아예 제거됨.
- **해결**: `space_map` 변환 레이어를 추가하여 holdings code가 올바르게 WiseReport 표준 코드로 변환되도록 일원화하고, 국내 종목 필터 조건을 `.isdigit()`에서 `code and len(code) == 6 and code[0].isdigit()`로 완화함.


