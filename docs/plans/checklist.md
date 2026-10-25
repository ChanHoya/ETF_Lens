# 3대 과제 통합 구현 체크리스트

## Phase 1. 전역 데이터 출처(Source Attribution) 마이크로 캡션 표준화
- [x] 1. 공통 마이크로 캡션 컴포넌트 `dashboard/src/components/common/DataSourceCaption.tsx` 생성. (헤더 주석 필수, `text-[9.5px]` 폰트, 다크/라이트 적응형 스타일)
- [x] 2. 시장동향 탭 5종(`MacroTab.tsx`, `RatesTab.tsx`, `FxTab.tsx`, `StocksTab.tsx`, `OilTab.tsx`) 내 모든 차트/테이블 하단 출처 부착.
- [x] 3. 섹터 분석 탭 4종(`SectorAnalysisTab.tsx`, `SemiCycleDashboard.tsx`, `SemiFundamentalSignals.tsx`, `SpaceChart.tsx`) 내 모든 차트/테이블 하단 출처 부착.
- [x] 4. 코스피 출구 전략 3종(`KospiExitAnalyzer.tsx`, `ExitSignalModals.tsx`, `KrMacroIndicatorSection.tsx`) 기존 출처 폰트 소형화 및 일원화.
- [x] 5. 부동산 탭 2종(`RealEstateTab.tsx`, `SeoulDistrictHeatmap.tsx`) 국토교통부/서울시 출처 마이크로 캡션 부착.
- [x] 6. 연금·절세 및 브라질 국채 탭(`PensionWealthHub.tsx`, `BrazilBondTab.tsx`) 출처 부착.
- [x] 7. 전역 팝업 모달(`MarketDetailModal.tsx`, `OilTab.tsx` 모달, `SemiFundamentalSignals.tsx` 모달 등) 하단 출처 표기 완료.

## Phase 2. 핵심 수출 업종(2차전지·자동차) DB 시계열 확장
- [x] 1. `backend/seed_industry_macro.py`에 2차전지(`battery`) 및 자동차(`automobile`) 10개년(2016~2026.10) 공표 통계 시계열 데이터셋 추가 및 DB 적재 실행.
- [x] 2. `backend/core/macro_historical_data.py`의 DB 조회 및 저장 함수에 `industry` 파라미터 완전 연동.
- [x] 3. 백엔드 API `GET /api/v1/macro/industry-series` 엔드포인트 구현.
- [x] 4. 백엔드 단위 테스트 `backend/tests/test_industry_macro_expansion.py` 작성 및 100% 통과 확인.

## Phase 3. 신규 지표 갱신 감지 및 텔레그램 속보 자동 알림 연동
- [x] 1. `backend/scheduler/semi_stats_sync.py` 및 스케줄러에 DB 갱신 시 텔레그램 속보 자동 발송 함수 탑재.
- [x] 2. `backend/api/telegram_bot.py`에 `/semi` 및 `/macro` 명령어 핸들러 신설.
- [x] 3. 텔레그램 봇 단위 테스트 `backend/tests/test_macro_telegram_bot.py` 작성 및 100% 통과 확인.

## Phase 4. 전체 검증 및 커밋
- [x] 1. 백엔드 pytest 전체 실행 (무결성 검증 완료).
- [x] 2. 프론트엔드 `npm run build` 최적화 프로덕션 빌드 성공 확인.
- [x] 3. 브라우저 실측 렌더링 검증 (초소형 출처 폰트 가독성 및 UI 완성도 확인).
- [x] 4. Git 시맨틱 커밋 및 원격 푸시.
