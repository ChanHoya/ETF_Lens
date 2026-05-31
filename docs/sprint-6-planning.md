# Sprint 6 Implementation Plan & Specifications

This document outlines the stories, technical designs, and step-by-step implementation tasks for Sprint 6 of the ETF Lens platform.

---

## 1. Objectives & Stories

### [S6-1] TFF 엑셀 업로드 데이터 IndexedDB 영속화 및 히스토리 비교
* **목표**: 매 세션 시작 시 `TFF 펀드 현황.xlsx` 파일을 다시 업로드하는 번거로움 해소 및 복수 버전의 파일 비교 기능 제공.
* **기술 사양**:
  - 브라우저 로컬 저장 공간인 **IndexedDB** 라이브러리(또는 Native API) 연동 모듈 추가.
  - 업로드된 엑셀 바이너리 데이터 또는 파싱 완료된 `TffFundData` JSON 객체를 `tff_file_history` 테이블에 비동기 저장 (key: `upload_timestamp` 또는 `latestMonth`).
  - `TffDashboard.tsx` 좌측 또는 상단에 "과거 데이터 불러오기" 버튼 및 버전 관리 팝업 모달 추가.

### [S6-2] 포트폴리오 Efficient Frontier 최적화 백엔드 API
* **목표**: 현대 포트폴리오 이론(MPT)에 기반해 사용자의 KIS 4계좌 포트폴리오에 대한 최적 자산 재조정 비율 연산.
* **기술 사양**:
  - `yfinance` 또는 `pykrx` 라이브러리를 연동하여 사용자의 KIS 보유 자산의 과거 1~3년 일별 주가/NAV 종가 데이터 데이터 병렬 수집.
  - 기대수익률(Expected Returns), 분산 및 공분산 행렬(Covariance Matrix) 계산.
  - **몬테카를로 시뮬레이션(Monte Carlo Simulation)**을 5,000회 이상 수행하여 각 시나리오별 포트폴리오 기대수익률 및 변동성(포트폴리오 표준편차) 연산.
  - 샤프 지수 극대화(Maximum Sharpe Ratio) 및 최소 분산(Global Minimum Variance) 조건의 최적 자산 비중 행렬 산출.

### [S6-3] Efficient Frontier 시각화 및 최적 비중 연동
* **목표**: 최적화 연산 데이터를 Recharts를 통해 미려하게 시각화하고, 현재 포트폴리오의 실질 상태 비교 및 자산 재조정(Rebalancing) 권고 가이드 UI 연동.
* **기술 사양**:
  - Recharts `ScatterChart`를 활용하여 시뮬레이션된 5,000개 포트폴리오 포인트(X축: 변동성, Y축: 기대수익률)를 네온 테마 산점도로 렌더링.
  - 효율적 투자선(Efficient Frontier) 경계 곡선 렌더링 및 **현재 포트폴리오 위치(빨간색 포인트)**, **최적 포트폴리오 위치(초록색 포인트)**를 차트 상에 가시적으로 표시.
  - 현재 비중 vs 최적 비중을 나란히 대조하는 레이더 차트(Radar Chart) 또는 수평 누적 바 차트 구현.

### [S6-4] ETF 배당(분배금) 정보 수집 백엔드 스크래퍼 및 API
* **목표**: 보유하고 있는 국내외 ETF 종목의 과거 배당 내역 및 지급 주기를 기반으로 미래 예상 배당 현금 흐름 분석.
* **기술 사양**:
  - 한국예탁결제원(Seibro) 또는 네이버페이 증권 스크래퍼 모듈(`backend/core/dividend_scraper.py`) 작성.
  - 개별 ETF의 주당 분배금(Dividend Per Share), 배당락일(Ex-Dividend Date), 지급일(Payment Date) 데이터 수집.
  - 사용자가 보유한 수량(KIS API 잔고)과 매핑하여 향후 12개월 월별 예상 배당 수령액 연산 API 구현.

### [S6-5] 배당 캘린더 및 배당 Cashflow 시뮬레이션 대시보드
* **목표**: 미래 예상 배당 일정을 그리드 달력 뷰 및 연간 누적 Cashflow 바 차트로 렌더링.
* **기술 사양**:
  - Tailwind 기반의 **월별 배당금 캘린더(Calendar View)** 컴포넌트 추가. 특정 날짜에 어떤 ETF가 얼마의 배당을 지급하는지 직관적으로 표기.
  - Recharts `BarChart`를 사용한 월별 예상 배당 수령액 시각화 및 세후 실수령액 필터 기능 추가.
  - 연간 총 예상 배당금, 평균 월 배당금, 예상 포트폴리오 배당수익률(Yield) 핵심 메트릭 카드 배치.

### [S6-6] 괴리율 개인화 알림 설정 및 알림 채널 확장
* **목표**: Telegram 외에 Slack, Discord, 이메일을 통한 괴리율 실시간 알림 확장 및 사용자 임계치 설정 제어.
* **기술 사양**:
  - `My` 탭 설정 패널에 괴리율 경보 발송 임계치 조절 Slider 및 채널별 On/Off 스위치 UI 연동.
  - Slack 웹훅 전송기(`slack_notifier.py`), Discord 웹훅 전송기(`discord_notifier.py`), SMTP 이메일 샌더 구현.
  - 설정 화면에서 "테스트 전송" 버튼을 클릭하면 실제 해당 웹훅 또는 메일로 테스트 알림이 즉시 발송되도록 핫링크 연동.

---

## 2. Schedule & Deliverables

1. **S6-1 (IndexedDB 영속화)**: 1~2일차
2. **S6-2 & S6-3 (Efficient Frontier 백엔드 & 프론트엔드)**: 3~5일차
3. **S6-4 & S6-5 (배당 스크래퍼 & 배당 캘린더 대시보드)**: 6~8일차
4. **S6-6 (알림 확장 및 개인화 설정)**: 9~10일차
