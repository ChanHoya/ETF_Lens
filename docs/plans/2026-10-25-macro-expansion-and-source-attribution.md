# 전역 데이터 출처 표준화 & 핵심 수출업종 DB 시계열 확장 & 텔레그램 속보 연동 구현 계획서

> **Goal:** 전 서비스의 모든 차트/테이블에 마이크로 폰트(9~10px) 데이터 출처 표기를 전면 적용하고, `IndustryMacroSeries` DB에 2차전지·자동차 등 주력 수출업종 시계열을 확장하며, 신규 지표 갱신 시 텔레그램 속보를 자동 발송하는 3대 고도화 과제를 완수한다.

**Architecture:**
1. 프론트엔드 공통 마이크로 캡션 컴포넌트(`DataSourceCaption.tsx`)를 신설하여 가독성과 레이아웃을 해치지 않는 극소형 폰트(`text-[9.5px]` 또는 `text-[10px]`)로 시장동향, 섹터, 코스피 출구, 부동산, 연금·절세, 브라질 국채, My/TFF 및 전 모달의 모든 차트/테이블 하단에 출처를 일관되게 명기한다.
2. 백엔드 `IndustryMacroSeries` DB 모델의 `industry` 키를 다각화하여 반도체 외에 2차전지(`battery`), 자동차(`automobile`) 10개년 시계열을 시드 및 엔드포인트(`GET /api/v1/macro/industry-series`)로 개방한다.
3. 스케줄러 및 수동 갱신 시 신규 월차 지표 적재를 감지하여 텔레그램 봇(`/semi`, `/macro`)으로 펀더멘털 신호등 및 4국면 위치 속보를 자동 발송하는 파이프라인을 구축한다.

**Tech Stack:**
- Frontend: Next.js 16 (React 19), Tailwind CSS, Recharts, Lucide Icons.
- Backend: FastAPI, SQLAlchemy, SQLite (`etf_data_v2.db`), Python asyncio, pytest.
- Messaging: python-telegram-bot.

---

## 세부 태스크 분해

### Phase 1: 전역 데이터 출처(Source Attribution) 마이크로 캡션 표준화
- [ ] Task 1-1: 공통 컴포넌트 `dashboard/src/components/common/DataSourceCaption.tsx` 신설 (9.5px/10px 초소형 폰트, 미니멀 점 구분자, 다크/라이트 적응형 스타일).
- [ ] Task 1-2: 시장동향 5대 탭(`MacroTab.tsx`, `RatesTab.tsx`, `FxTab.tsx`, `StocksTab.tsx`, `OilTab.tsx`) 내 모든 차트 및 지표 카드 하단에 출처 부착.
- [ ] Task 1-3: 섹터 분석 탭(`SectorAnalysisTab.tsx`, `SemiCycleDashboard.tsx`, `SemiFundamentalSignals.tsx`, `SpaceChart.tsx`) 차트/테이블 하단 출처 부착.
- [ ] Task 1-4: 코스피 출구 전략 및 매크로 지표(`KospiExitAnalyzer.tsx`, `RiskGaugeChart.tsx`, `KrMacroIndicatorSection.tsx`) 하단 폰트 소형화 및 출처 통일.
- [ ] Task 1-5: 부동산 탭(`RealEstateTab.tsx`, `SeoulDistrictHeatmap.tsx`, `RealEstateSimulatorSection.tsx`) 국토부/서울시 출처 마이크로 캡션 부착.
- [ ] Task 1-6: 연금·절세 & 브라질 국채 탭(`PensionWealthHub.tsx`, `BrazilBondTab.tsx`, `BrazilVsUsBondSimulator.tsx` 등) 국세청/BCB/한은 출처 부착.
- [ ] Task 1-7: 전역 팝업 모달(`MarketDetailModal.tsx`, `OilIndicatorDetailModal.tsx`, `MacroConsensusSurpriseModal.tsx`, `MajorComplexTimeseriesModal.tsx` 등) 하단 출처 표기 완료.

### Phase 2: 핵심 수출 업종(2차전지·자동차) DB 시계열 확장
- [ ] Task 2-1: `backend/seed_industry_macro.py`에 2차전지(`battery`) 및 자동차(`automobile`) 10개년(2016~2026.10) 공표 통계 시계열(수출액, 단가, 물량, 가동률, 재고) 데이터셋 추가 및 DB 시딩 실행.
- [ ] Task 2-2: `backend/core/macro_historical_data.py`의 조회/저장 함수에 `industry` 파라미터 완전 지원 및 DB-First 캐싱 로직 확장.
- [ ] Task 2-3: 백엔드 API 라우터에 `GET /api/v1/macro/industry-series` 엔드포인트 신설.
- [ ] Task 2-4: 백엔드 단위 테스트 `backend/tests/test_industry_macro_expansion.py` 작성 및 통과 검증.

### Phase 3: 신규 지표 갱신 감지 및 텔레그램 속보 자동 알림 연동
- [ ] Task 3-1: `backend/scheduler/semi_stats_sync.py` 및 `backend/core/kr_macro_notifier.py`에 DB 갱신 시 텔레그램 속보 발송 함수 연동.
- [ ] Task 3-2: `backend/api/telegram_bot.py`에 `/semi` 및 `/macro` 명령어 핸들러 신설 (반도체/주력산업 최신 펀더멘털 신호등 및 사이클 국면 즉시 회신).
- [ ] Task 3-3: 텔레그램 봇 단위 테스트 `backend/tests/test_macro_telegram_bot.py` 작성 및 검증.

### Phase 4: 전체 빌드 및 브라우저 화면 렌더링 검증
- [ ] Task 4-1: 백엔드 pytest 전체 실행 (회귀 검증).
- [ ] Task 4-2: 프론트엔드 `npm run build` 최적화 프로덕션 빌드 무결성 확인.
- [ ] Task 4-3: 브라우저 실측 검증 (다크/라이트 모드에서 출처 폰트 가독성 및 레이아웃 무결성 확인).
- [ ] Task 4-4: 시맨틱 커밋 및 푸시.
