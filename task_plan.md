# Task Plan: S1-9 섹터별 상관관계 분석 기능 추가

## Goal
섹터별 과거 시계열 수익률을 기반으로 상관계수(Correlation Matrix)를 백엔드에서 산출하고, 프론트엔드 섹터분석 탭 하단에 인터랙티브하고 직관적인 상관관계 히트맵(Heatmap) 차트를 구현하여 포트폴리오의 분산 투자 시너지를 시각화합니다.

## Current Phase
Phase 1: Requirements & Backend Design

## Phases

### Phase 1: Requirements & Backend Design
- [x] 한/미 7대 섹터(반도체, 2차전지, 바이오, 금융, 방산, 우주, 에너지)의 과거 데이터 수집 범위 정의 (과거 6개월~1년 일별 시계열)
- [x] 상관관계 연산을 위한 백엔드 엔드포인트 기획
- **Status:** complete

### Phase 2: Backend Correlation Engine Implementation
- [x] `backend/api/router.py`에 `/api/v1/analyze/sector-correlation` 엔드포인트 신설
- [x] `FinanceDataReader` 및 Yahoo v8 Chart API를 활용하여 7대 섹터 ETF들의 과거 180일 종가(Close) 수집 로직 작성
- [x] 날짜 기준으로 데이터 정렬(Inner Join) 및 `Pandas`를 이용한 일별 수익률(`.pct_change()`) 변환
- [x] 상관계수 매트릭스(`.corr()`) 연산 및 JSON 형태로 리턴 구조화
- **Status:** complete

### Phase 3: Frontend Heatmap UI Component Implementation
- [x] React용 상관관계 히트맵 컴포넌트(`SectorCorrelationHeatmap.tsx`) 신설
- [x] Tailwind HSL 컬러 팔레트 기반의 프리미엄 그래디언트 색상 매핑 (1.0 = 진한 파랑/에메랄드, -1.0 = 진한 빨강, 0 = 무채색/회색)
- [x] 히트맵 셀 호버 시 툴팁 연동 (해당 섹터 쌍의 한글 설명 및 상관도 세부 해석 노출)
- **Status:** complete

### Phase 4: Tab Integration & Page Assembly
- [x] `SectorAnalysisTab.tsx` 하단에 히트맵 컴포넌트 마운트
- [x] 한-미 전체 보기 / 국내 섹터 보기 / 해외 섹터 보기 등 히트맵 필터 토글 구현
- [x] 전체 빌드 테스트 및 타입 안정성 검증 (`npx tsc --noEmit`)
- **Status:** complete

### Phase 5: Verification & Delivery
- [x] 실제 동작 테스트 및 렌더링 검증
- [x] `project-state.md` 및 `features.md` 완료 반영 및 세션 마무리
- **Status:** complete

## Key Questions
1. **과거 시계열 데이터 수집 속도 최적화 방법은?**
   * *답변*: 이미 구현한 `asyncio.Semaphore(10)` 병렬 수집 파이프라인과 인메모리 캐싱을 재활용하여 API 응답 지연을 0.5초 이내로 제어합니다.
2. **Recharts를 사용하지 않고 히트맵을 구현하는 방법은?**
   * *답변*: Recharts의 `ScatterChart`나 `BarChart`로도 가능하나, 고도화된 Bento 스타일 그리드를 위해 순수 Tailwind CSS Grid와 투명도(opacity) 스케일을 활용한 Custom CSS Grid 렌더링 방식을 사용하여 디자인 완성도와 반응형 가독성을 극대화합니다.

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| 백엔드 Pandas 연산 | Python의 Pandas 패키지는 수학적 피어슨 상관계수 연산(`.corr()`)에 고도로 최적화되어 있어 서버사이드 연산이 가장 안정적임 |
| Custom Grid 기반 Heatmap | 모바일 화면에서의 레이블 찌그러짐을 방지하고, HSL 테마에 어우러지는 글래스모피즘 효과 구현을 위해 커스텀 React 그리드 렌더링 선택 |
