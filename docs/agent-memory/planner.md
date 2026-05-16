# Planner Memory

> Auto-updated by the `learn` skill at session end. Do not edit manually.
> **Initialization**: After the first sprint completes, replace placeholder comments below with real data.
> **Update trigger**: Updated when `learn` skill runs after a planner session.

## Estimation Accuracy

<!-- Track estimate vs actual effort per wave to calibrate future planning.
   Format: [Sprint] Wave N: estimate vs actual (ratio)
   Examples:
   - [Sprint 1] Wave 1: accurate (1.0x) — simple CRUD, well-understood domain
   - [Sprint 1] Wave 3: optimistic (2.3x) — integration complexity underestimated
   - [Sprint 2] Wave 2: accurate (1.1x) — applied 1.5x buffer from Sprint 1 lesson
   Rule: If ratio > 2.0x for 2+ sprints → apply mandatory 2x buffer for that wave depth
-->

## Architecture Insights
- **User Input Resilience**: 투자 원금과 같이 사용자가 직접 입력하는 데이터는 백엔드 동기화 이전에 `localStorage`를 1순위로 사용하여 저장/조회. 서버 응답 지연이나 DNS 장애 상황에서도 UI 기능을 유지할 수 있음.
- **Visual Density Optimization**: 대규모 포트폴리오 데이터를 표시할 때 수치 단위를 축약('백만원')하고 뱃지 레이아웃을 한 줄로 고정함으로써 모바일/대형 화면 모두에서 가독성을 확보.
- **Navigation Scalability**: 탑레벨 탭마다 독립적인 View 컴포넌트(`DiscoverTab`, `SectorAnalysisTab` 등)를 할당함으로써 콘텐츠 이동 및 확장이 용이한 구조를 유지.

<!-- Record structural patterns that affect planning.
   Format: Pattern — Planning Impact
   Examples:
   - Domain → Application → Infrastructure dependency order — plan domain layer first in every feature
   - Changes to shared/ require full rebuild — always estimate +30 min for shared/ changes
   - DB migration file creation frequently forgotten — add explicit "create migration" task to every DB-touching story
-->

## Repeated Patterns

<!-- Track recurring task patterns with frequency to auto-generate checklists.
   Format: Pattern — Frequency (N/total features) — Action
   Examples:
   - New feature = middleware + route + controller + service (4-file set) — 5/5 features — auto-include in breakdown
   - DB migration forgotten — 3/5 features needing DB — add explicit migration task
   - Auth middleware required for new routes — 4/6 route additions — default to auth-required
-->

## Velocity Trends

<!-- Track stories-per-sprint to predict capacity and detect trajectory changes.
   Format: [Sprint N] Planned: X, Done: Y, Rate: Z%
   Examples:
   - [Sprint 1] Planned: 5, Done: 3, Rate: 60% — ramp-up phase, team unfamiliar with codebase
   - [Sprint 2] Planned: 4, Done: 4, Rate: 100% — right-sized after Sprint 1 data
   - [Sprint 3] Planned: 4, Done: 5, Rate: 125% — acceleration, consider planning 5 next sprint
   Benchmark: After 3+ sprints, calculate average rate. If < 60% for 2 consecutive sprints → investigate causes
-->
