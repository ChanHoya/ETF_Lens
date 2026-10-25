# Sprint 42 UI/UX 표준 템플릿 구축 및 전면 보수 체크리스트

## Phase 1. 표준 템플릿 원칙 문서화 및 공통 유틸 신설
- [x] 1. `AGENTS.md` 및 `GEMINI.md`에 Sprint 42 5대 UI/UX 표준 템플릿 원칙 명시.
- [x] 2. `dashboard/src/lib/chartDateUtils.ts` 신설 (`2026-01-10` -> `'26/01/10'`, `2026` -> `'26` 축약 포매터).

## Phase 2. 상단 네비게이션 고정(Sticky) 및 1줄 슬라이드 축소(Minimize)
- [x] 1. `MainApp.tsx` 상단 헤더 컨테이너를 `sticky top-0 z-[250] bg-[#050505]/95 backdrop-blur-md`로 고정.
- [x] 2. 서브메뉴(시장동향 서브탭, 종목분석 서브탭 등) 활성화 시 메인 메뉴 우측 원형 `<>` minimize 버튼 및 슬라이드업 상태 관리 구현.
- [x] 3. `<>` 버튼 클릭 시 메인 메뉴 펼침/접힘 토글 및 부드러운 애니메이션 적용.

## Phase 3. 전역 팝업 모달 상단 헤더 보존형 배치 및 기간 버튼 컴팩트화
- [x] 1. `ExitSignalModals.tsx` (달러, PER, CLI, VIX, 하이일드 OAS 5개 모달) 헤더 보존형(`top-[52px]~top-[64px]` 시작) 및 기간 버튼 컴팩트(`px-2.5 py-1 text-xs`) 적용.
- [x] 2. `MarketDetailModal.tsx` 상단 헤더 보존형 및 기간 버튼 표준화.
- [x] 3. `MacroConsensusSurpriseModal.tsx`, `OilTab.tsx` 모달, `SemiFundamentalSignals.tsx` Bulliza 모달 점검 및 교정.
- [x] 4. My 및 TFF 모달(`IntegratedAssetReportModal.tsx`, `TffMonthlyFactsheetModal.tsx` 등) 헤더 보존형 점검.

## Phase 4. 전 서비스 컨텐츠 박스 단일 외곽 박스 + 서브 박스 계층 정돈
- [x] 1. 시장동향 5대 탭(`MacroTab.tsx`, `RatesTab.tsx`, `FxTab.tsx`, `StocksTab.tsx`, `OilTab.tsx`, `DiscoverTab.tsx`).
- [x] 2. 섹터분석 탭(`SectorAnalysisTab.tsx`, `SemiCycleDashboard.tsx`, `SemiFundamentalSignals.tsx`, `SpaceChart.tsx`).
- [x] 3. 부동산, 연금·절세, 브라질 국채 탭 컨텐츠 박스 점검 및 일원화.
- [x] 4. TFF_Fund 및 My 서비스 대시보드 외곽 박스 계층 점검.

## Phase 5. Recharts X축 연도 `'26` 축약 및 `Update` 버튼 일원화
- [x] 1. 모든 차트 컴포넌트의 XAxis tickFormatter에 `formatChartDate` 및 `chartTicks.ts` 축약 적용.
- [x] 2. 전 서비스의 '데이터 갱신', '새로고침' 버튼 명칭을 `Update`로 일원화하고 버튼 패딩 컴팩트(`px-2.5 py-1 text-xs`) 규격 적용.

## Phase 6. 검증 및 커밋
- [x] 1. Next.js `npm run build` 최적화 프로덕션 빌드 무결성 확인.
- [x] 2. 브라우저 실측 렌더링 검증 (헤더 슬라이드, 모달 위치, X축 축약, 버튼 크기).
- [x] 3. 시맨틱 커밋 및 원격 푸시.
