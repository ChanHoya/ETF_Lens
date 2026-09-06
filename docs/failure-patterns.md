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

### 마스터 업로드 버튼 무반응 (조건부 렌더링 내 file input 언마운트)
- **증상**: 마스터 로그인 후 상단 [업로드] 버튼을 클릭해도 파일 선택 다이얼로그나 업로드 화면이 뜨지 않음
- **원인**: `<input type="file" ref={fileInputRef}>`가 `{!fundData && ...}` 조건문 블록 안에만 위치하여, 데이터가 이미 로드되어 있을 때는 DOM에서 제거되어 `fileInputRef.current`가 `null`이 됨
- **해결**: 숨김 `<input type="file">`은 컴포넌트 루트/최하단에 상시 마운트하고, [업로드] 버튼 클릭 시 전용 업로드 모달(`showUploadModal`)을 띄워 드래그앤드롭 및 파싱 진행 상태를 시각화함

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
- **추가 사례(2026-05-29)**: 최근 상장된 ETF 등 가격 데이터가 부족한 기간(3개월 등) 선택 시 툴팁(CustomTooltip) 내 undefined 값에 대해 `.toFixed(1)` 호출로 인한 크래시. 모든 CustomTooltip map 루프 초입에 undefined/null/NaN 예외 필터링 추가.

## Finance Data APIs

### yfinance "NoneType object is not subscriptable" & SSL/DNS Failures
- **증상**: 야후 파이낸스 데이터를 긁어올 때 API 500 에러 발생 및 차트 데이터 로딩 실패.
- **원인**: `yfinance` 라이브러리의 최신 스크래핑 파서 버그로 인해 특정 지수/티커 조회 시 내부 `NoneType` 오류 발생, 혹은 서버 IP 차단(SSL/DNS 연결 실패).
- **해결**: Multi-source Fallback 전략을 구현하여 극복:
  1. **국내 자산/지수**: pykrx 또는 `FinanceDataReader`(네이버 파이낸스)를 1순위로 지정하여 야후 파이낸스 의존도 최소화.
  2. **해외 자산/지수**: `yfinance` 라이브러리 대신 Yahoo v8 Chart API를 `requests` 직접 호출하여 버그 회피 및 병렬 처리(`asyncio.to_thread` + Semaphore)를 적용해 타임아웃 방지.

### [FP-028] 일별-월별 이종 시계열 병합 시 Recharts Line 차트의 선 끊김 및 미출력 현상
- **증상**: 일별 데이터(Selic 등)와 월별 데이터(IPCA 등) 또는 짧은 시계열(5년물 금리)을 날짜 인덱스로 외부 병합하여 차트에 표시할 때, 대부분의 일별 날짜에 월별 데이터가 `null` 혹은 `undefined`로 존재하여 라인이 그려지지 않고 투명하게 빈 공간으로 노출됨.
- **원인**: Recharts `Line` 컴포넌트는 중간에 데이터 포인트가 누락(`null`/`undefined`)될 경우 이전 포인트와 다음 포인트를 연결하지 않고 기본적으로 끊어서 렌더링하기 때문.
- **해결**: Line 컴포넌트에 `connectNulls={true}` 속성을 명시적으로 할당하여 개별 날짜에 값이 없는 공백 구간을 앞뒤 포인트와 직선으로 연결하여 연속적인 트렌드 선으로 시각화함.

### [FP-029] 다국어 시스템 환경에서의 스크레이핑 날짜 파싱(Date Parsing) Locale 의존성 에러
- **증상**: 해외 웹사이트(예: Investing.com)의 영문 월 표시("Jul", "Jan" 등)가 포함된 날짜 문자열("Jul 10, 2026")을 파이썬 `datetime.strptime(..., "%b %d, %Y")`로 파싱 시 로컬 운영체제의 언어/지역 설정(Locale)이 한글 등 비영어권인 경우 `ValueError: time data does not match format` 예외가 발생하여 수집이 중단됨.
- **원인**: 시스템 기본 로캘이 한글로 설정된 파이썬 런타임은 "Jul" 등의 영문 월 약어를 인식하지 못하기 때문.
- **해결**: 외부 라이브러리나 OS 로캘 설정에 의존하는 `strptime` 대신, 파이썬 코드 내에 영문 월 약어와 숫자 매핑 사전(`{"jan": "01", "feb": "02", ...}`)을 하드코딩하여 직접 날짜 문자열을 분할 가공하는 독립적이고 안전한 수동 날짜 파싱 방식을 적용함.

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

## Fallback Math & Scale Distortions

### 벤치마크 지수 가상 생성 시의 소수점 스케일 오류 (Percent vs Float Decimal)
- **증상**: Excel 파싱 데이터가 누락되어 벤치마크 지수(항셍지수, 채권, 금 등)를 가상 공식으로 복구하여 렌더링할 때, 특정 월 등락률이 `-147.9%` 또는 `+35.0%` 등으로 비정상적으로 높거나 낮게 튀는 현상.
- **원인**: Excel 파싱 후 유효한 등락 데이터는 소수점 비율 형태(예: `2.3%` -> `0.023`)로 관리됩니다. 그러나 가상 공식 내에 퍼센트 차이(예: `-1.5` 또는 `+0.2`)를 소수점 변환 없이 그대로 연산에 개입시킴으로써, 100배 부풀려진 오차가 발생하고 `normalizePct`에 의해 과도한 숫자로 표시되었습니다.
- **해결**: 공식 내 모든 차이 및 스케일러 상수를 소수점 환산 비율(예: `-1.5` -> `-0.015`, `0.2` -> `0.002`, `1.2` -> `0.012` 등)로 고쳐서 계산을 수행하도록 개선하였습니다.

## Recharts ComposedChart (S6-3 학습)

### [FP-016] Math.min/max spread on large arrays → Call Stack Overflow
- **증상**: `Math.min(...arr.map(p => p.sharpe))` 형태로 800~5000개 배열을 spread 시 Call Stack 오버플로우 가능성
- **원인**: JavaScript spread 연산자는 배열 원소 전체를 함수 인자 스택에 push → 배열이 크면 `Maximum call stack size exceeded` 발생
- **해결**: `arr.reduce((min, p) => p.v < min ? p.v : min, arr[0].v)` 방식으로 교체. 배열 크기에 무관하게 O(n) 순회로 안전

### [FP-017] Bar > Cell 중복 fill 속성 → 불필요한 DOM 노드 생성
- **증상**: `<Bar fill="#color">` + 내부 `{data.map(() => <Cell fill="#color" />)}` 동시 사용 시 Cell이 Bar의 fill을 override 하며 혼란 유발
- **원인**: Cell은 Bar의 fill보다 높은 우선순위를 가지므로 동일 색상 중복 지정 시 data 길이만큼 불필요한 Virtual DOM 노드 생성됨
- **해결**: 막대 색상이 모두 동일하면 `<Bar fill="..." />` 만 사용. 막대별 다른 색상이 필요할 때만 Cell 사용

## React State Management (S6-3 학습)

### [FP-018] NaN 가드 `|| 0` 패턴의 부작용
- **증상**: `parseFloat(e.target.value) || 0` 에서 사용자가 입력창을 비울 때('' → NaN → `|| 0`) 즉시 0으로 세팅됨. 0도 유효한 값일 경우 UX 저하
- **원인**: `||` 연산자는 falsy 값(NaN, 0, '')을 모두 우측 기본값으로 대체
- **해결**: `const v = parseFloat(e.target.value); if (!isNaN(v)) setState(v);` — NaN일 때만 무시, 0은 유효한 입력으로 허용

### [FP-019] KIS API 다계좌 일별 거래내역 순회 시 EGW00133 속도 초과
- **증상**: 과거 이력 복원을 위해 `/asset-history` 등을 호출할 때 다계좌의 입출금 내역을 연속 쿼리하면 `msg_cd = EGW00133` 속도 초과 오류가 리턴되며 데이터가 누락됨
- **원인**: KIS OpenAPI의 초당 1건 호출(1 TPS) 제약을 고려하지 않고, 여러 계좌의 거래 내역을 빠른 속도로 비동기 순회 쿼리함
- **해결**: 각 계좌별 거래내역 API 요청 사이에 `await asyncio.sleep(0.5)` 이상의 안정적인 지연(Rate Limit padding)을 주어 Rate Limit 발생을 원천 차단함

## API & Parameter Scoping (S6-7 추가 학습)

### [FP-020] 개별 연동계좌 원금 매핑 실패로 인한 0% 수익률 일직선 현상
- **증상**: 통합계좌 뷰에서는 수익률 곡선이 정상 노출되나, 개별 연동계좌 필터 선택 시 누적 수익률이 `0%` 일직선으로 그려짐.
- **원인**: 수동 원금 데이터가 프론트엔드 입력 시 `entry_...` 형태로 저장되어 계좌번호와 1:1 매칭되는 원금이 없어서 `principal_val = 0.0`으로 평가됨.
- **해결**: 개별 계좌에 지정된 수동 원금이 없을 경우, 전체 수동 원금 총합을 현재 각 계좌의 자산 규모 비중으로 안분(Pro-rata)하여 임시 원금(`principal_val`)을 자동 할당해 주는 Fallback 로직을 적용함.

### [FP-021] KIS 토큰 미발급 환경에서 `get_asset_history` API의 `reconstruct_days` UnboundLocalError
- **증상**: KIS API 연동 에러 상황(또는 로컬 오프라인 환경)에서 `get_asset_history` API 호출 시 백엔드 500 내부 서버 에러 발생.
- **원인**: `reconstruct_days = min(days, 365)` 변수 선언이 KIS 토큰이 성공적으로 확보된 `if active_token:` 블록 내부에 기입되어 있어, 토큰을 발급받지 못하고 Fallback을 탈 때 외부 참조로 인한 `UnboundLocalError` 유발.
- **해결**: `reconstruct_days` 선언부를 KIS 토큰 추출 조건문 위(KST 설정 근처)로 상향 조정하여 항상 정의된 상태를 보장함.

### [FP-022] Y축 레이블을 가진 Recharts 차트에서 음수 마진 적용 시 텍스트 잘림 현상
- **증상**: 미니 영역/라인 차트에서 퍼센트 등락률 Y축 레이블의 앞부분 또는 차트 가장자리 선 좌표가 잘려서 보이지 않는 현상.
- **원인**: 여백 제거용 음수 마진(`margin={{ left: -25 }}`)과 컨테이너의 `overflow-hidden` 스타일이 결합되어 Y축 텍스트 영역을 침범 및 절단함.
- **해결**: Y축 수치를 노출하는 경우 양수 마진(최소 `left: 10`, `right: 10`)을 부여하여 라인과 레이블이 영역 안에서 안전하게 그려지도록 조치함.

### [FP-023] 로컬 포트 충돌(3001 등)로 인한 CORS API 연동 실패
- **증상**: 프론트엔드를 로컬에서 구동 중이나 특정 데이터나 차트가 렌더링되지 않고 "Failed to fetch" 또는 구성종목 오류가 뜸.
- **원인**: PC 내 다른 프로젝트가 포트 3000을 점유하고 있을 때 Next.js가 3001 등 대체 포트에서 실행되지만, 백엔드 main.py CORS 화이트리스트에 해당 포트가 누락되어 요청이 차단됨.
- **해결**: `main.py` CORS origins에 `localhost:3001`, `localhost:3002`, `localhost:3003` 등 대체 포트를 기본적으로 화이트리스트에 명시해둠.

### [FP-024] 동적 지수/주가 API GET 요청의 브라우저 캐싱 오류
- **증상**: 백엔드 API 데이터를 신규 추가/개편(예: 12종 ETF 전면 개편)했음에도 브라우저가 이전 세션의 옛날 키 데이터(예: 기존 5종 자산)를 노출하고 새 테이블 로딩을 실패함.
- **원인**: 프론트엔드 fetch 호출 시 캐시 우회 지시가 없으면 브라우저가 이전 GET 요청의 cache-hit으로 기존 응답 구조를 재사용하며 렌더 오류를 냄.
- **해결**: dynamic query API 호출(예: `/semi-chart`, `/semi-holdings` 등) 시 fetch 옵션에 `{ cache: 'no-store' }`를 적극 추가하여 무조건 fresh 데이터를 강제 fetch 하도록 방어함.

### [FP-025] 내부 Helper 함수 매개변수 개수 불일치(TypeError) 및 광범위한 예외 캐치로 인한 후속 수집 바이패스
- **증상**: 특정 지표(예: PER) 수집 중 TypeError가 발생했음에도 백엔드가 에러 로그만 한 줄 남기고, 이후의 핵심 지표(VIX, FGI 등) 수집 단계를 통째로 건너뛰어 DB 캐시에 불완전한 구조가 적재되는 현상.
- **원인**: `get_exit_signal_data` 내부에서 `get_pe_detail` 호출 시 인자 개수가 함수 정의부와 불일치하여 `TypeError`가 발생했으나, 전체 수집 루프가 하나의 큰 `try-except Exception` 블록으로 묶여 있어 개별 지표 에러가 전체 파이프라인의 조기 종료로 이어짐.
- **해결**: helper 함수의 인자 시그니처(`target_ym` 추가)를 맞추어 오류를 해결하고, 향후 지표 수집 시 개별 수집 단계를 세부 `try-except`로 격리하여 한 지표의 실패가 다른 지표(VIX 등)의 수집 차단으로 전이되지 않도록 구조적 예방 설계 적용이 권장됨.

### [FP-026] FRED CSV API 요청의 User-Agent 차단으로 인한 타임아웃 및 빈 리스트 반환
- **증상**: 미 장단기 금리차(T10Y2Y) 및 하이일드 스프레드 차트가 무한 로딩 상태에 빠지고 데이터가 노출되지 않음.
- **원인**: FRED(세인트루이스 연준) 측에서 파이썬 requests 라이브러리의 기본 User-Agent(`python-requests/...`)를 이용한 CSV 다운로드 요청을 차단하여 504 Gateway Timeout이나 연결 오류가 유발되고, 수집 결과가 빈 리스트(`[]`)로 백엔드 캐시에 강제 덮어쓰기됨.
- **해결**: FRED API 요청에 크롬 브라우저와 유사한 헤더(`User-Agent`)를 추가하여 차단을 예방하고, 수집 실패 시 빈 리스트로 캐시를 덮어쓰지 않고 기본 mock/fallback 시계열 데이터를 그대로 보존하도록 백엔드 처리(exit_signal.py)를 개선함.

### [FP-030] 512MB RAM 제약 서버(Render)에서의 Primary PostgreSQL 환경 내 Self-Replication OOM 장애
- **증상**: Render 프로덕션 환경에서 매일/주기적 스케줄러 배치 job(가격 수집, 브라질 국채 등) 실행 직후 인스턴스가 `Ran out of memory (used over 512MB) while running your code`로 강제 종료(SIGKILL) 및 무한 재시작 반복.
- **원인**:
  1. `DATABASE_URL`이 이미 Render PostgreSQL로 설정된 프로덕션 환경에서, 스케줄러 job 완료 후 `replicate_sqlite_to_postgres()`가 호출되어 동일한 PostgreSQL DB를 대상으로 무의미한 Self-Replication 수행.
  2. 복제 로직이 `ETFDailyPrice` (수십만 건) 등 대용량 데이터 전체를 `select().scalars().all()`로 수십만 개의 Python ORM 객체로 RAM에 한꺼번에 로드하여 메모리 스파이크 유발.
- **해결**:
  1. `DATABASE_URL`이 PostgreSQL인 환경에서는 `replicate_sqlite_to_postgres()`를 0ms 만에 즉시 no-op 스킵하도록 방어 조건 추가.
  2. 로컬 개발 환경(SQLite) 수동 복제 시에도 1,000건 단위의 스트리밍 배치(chunked batching) 및 `del` + `gc.collect()`를 적용하여 RAM 사용량을 항상 수 MB 수준으로 제어.
  3. 스케줄러 작업 wrapper에 명시적 `import gc; gc.collect()`를 적용하여 메모리 안정성 극대화.

### [FP-031] 주기적 Intraday 스케줄러 내 캘린더 이벤트(D-1/D-DAY) 중복 알림 반복 발송 현상
- **증상**: 15분 간격 스케줄러 실행 시, `[D-1] 브라질 Copom` 등 캘린더 임박 알림 메시지가 매 15분마다 텔레그램으로 연속 중복 발송됨.
- **원인**: 실시간 금리/환율 변경 감지를 위한 15분 intraday 스케줄러(`check_brazil_signal_and_alert`) 내에서 D-1/D-DAY 캘린더 이벤트를 체크할 때, 당일 이미 알림을 보냈는지에 대한 디두플리케이션(중복 체크) 상태 저장이 누락되어 스케줄러 실행 시마다 알림 메시지에 지속 추가됨.
- **해결**: `SectorInsight` DB에 `brazil_cal_alert_{key}_{tag}_{date}` 형태의 당일 발송 상태 레코드를 기록하여, 15분 스케줄러 호출 시 당일 이미 D-1/D-DAY 알림을 보낸 이벤트는 메시지 생성을 스킵(하루 1회 제한)하도록 디두플리케이션 처리.

### [FP-032] Recharts ReferenceArea 도메인 범위를 벗어난 y1/y2 또는 x1/x2 좌표 지정 시 컴포넌트 전체 미표출(null) 버그
- **증상**: Recharts 차트의 배경 구간 음영(`ReferenceArea`)에 `fill="#f59e0b"` 등을 설정하고 코드를 작성했으나, 특정 음영 영역만 화면에 그려지지 않고 칠흑색(검은색) 배경으로 구멍이 뚫린 채 투명하게 렌더링됨.
- **원인**: Recharts의 `ReferenceArea` 컴포넌트는 `x1`, `x2`, `y1`, `y2` 좌표 중 단 하나라도 현재 `XAxis` 또는 `YAxis`의 `domain` 범위를 벗어나면(예: `yDomain=[13.4, 15.4]`인데 `y1=12.0` 지정), 뷰포트 자르기(clipping) 대신 해당 `ReferenceArea` 컴포넌트 전체를 `null`로 평가하여 렌더링을 완전히 취소함.
- **해결**:
  1. `XAxis` 및 `YAxis`의 `domain` 범위(예: `xDomain=[240, 320]`, `yDomain=[13.0, 15.5]`)를 고정 또는 안전한 범위로 정의.
  2. 모든 `ReferenceArea`의 `x1`, `x2`, `y1`, `y2` 경계값이 반드시 `domain`의 min/max 범위 이내에 엄격하게 정렬되도록 수치를 일치시켜 무효화(null conversion)를 방지함.






