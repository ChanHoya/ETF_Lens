# Project State — ETF Lens

> **Keep this file under 200 lines.**

## Quick Summary

✅ Last session: S1-9 섹터별 상관관계 분석 기능 추가 완료 (Pandas Pearson 계수 연산 및 프리미엄 글래스모피즘 히트맵 구현)
🔄 In progress: 없음 (스프린트 1 핵심 목표 달성)
➡️ Next: 다음 스프린트 기획 및 운영 피드백 반영

## Current Sprint

- Sprint: 1 — Core Features
- Started: 2026-03-17
- Branch: main

## Story Status

| ID | Title | Status | Notes |
|----|-------|--------|-------|
| S1-1 | ETF 마스터 DB + 종목 분석 | ✅ done | 1,000+종목 |
| S1-2 | KIS 포트폴리오 4계좌 연동 | ✅ done | Rate limit 보호 완료 |
| S1-3 | TFF 대시보드 | ✅ done | 예수금 파싱 및 핵심 기능 작동 완료 (26.6만 원 정상 노출) |
| S1-4 | Render DB 복구 (PostgreSQL 전환) | ✅ done | 유료 $7/월 |
| S1-5 | 초기 투자금 대비 수익률 카드 | ✅ done | UI 개선 및 CORS 수정 완료 |
| S1-6 | Bootstrap / Conductor 문서화 | ✅ done | 이번 세션 |
| S1-7 | 섹터분석 고도화 | ✅ done | 국내/해외/통합 필터 및 우주/에너지 추가, 한-미 집중 비교 연동 |
| S1-8 | TFF 상세 데이터 카드화 및 고도화 | ✅ done | YtmView, MonthlyView 개별 뷰 카드화 전환 및 TypeScript 수정 완료 |
| S1-9 | 섹터별 상관관계 분석 기능 추가 | ✅ done | 섹터 간 상관계수 히트맵 및 포트폴리오 분산 효과 분석 완료 |

## Module Registry

| Module | Layer | Status | Key Files |
|--------|-------|--------|-----------|
| ETF Master | Backend | ✅ stable | api/router.py, db/models.py |
| KIS Portfolio | Backend | ✅ stable | api/my_assets.py |
| Investment Return | Backend | ✅ stable | api/my_assets.py (cashflow endpoint) |
| TFF Parser | Backend | ✅ stable | src/lib/tff/excelParser.ts |
| My Assets View | Frontend | ✅ stable | src/components/MyAssetsView.tsx |
| InvestmentReturnCard | Frontend | ✅ stable | src/components/InvestmentReturnCard.tsx |
| AI Chat | Backend | ✅ stable | api/chat.py |
| Macro Compass | Backend | ✅ stable | api/macro_compass.py |
| Exit Signal | Backend | ✅ stable | api/exit_signal.py |
| TFF Cards | Frontend | ✅ stable | src/components/tff/views/YtmView.tsx, MonthlyView.tsx |

## Technical Decisions

- KIS API: 초당 1건 제한 → sleep(1.2) 필수, EGW00133 → sleep(2.5) 후 재시도
- PostgreSQL: Render $7/월 유료 (90일 만료 없음), Internal URL 사용
- 캐시: 포트폴리오 5분 인메모리, ETF 마스터 5분 캐시
- 클라이언트 Excel 파싱: XLSX.js (서버 업로드 없음)

## Recent Changes

- 2026-05-17: 상관관계 분석 히트맵을 [-1.0(Rose 빨간색), 0.0(Yellow 400 선명한 노란색), +1.0(Emerald 초록색)] 구성의 continuous RGB 그라데이션으로 리디자인하고 어두운 테마에서의 갈색 믹싱 방지(최소 불투명도 0.35 설정) 완료
- 2026-05-17: 상단 섹터별 비교 Bento 카드의 텍스트 폰트 및 아이콘 스케일을 약 1.5배 상향하여 시각적 인지성과 가독성 고도화 완료
- 2026-05-17: 포트폴리오 트리맵의 얇은/좁은 셀(두께 3칸 미만)에서 종목 정보, 등락률, 보유 비중이 한 줄로 병합 노출되도록 렌더링 최적화 완료
- 2026-05-17: 반도체 섹터 클릭 시에만 하단 반도체 특화 분석(SemiChart)이 보이도록 조건부 렌더링 수정 완료 (화면 복잡도 최적화)
- 2026-05-17: S1-9 섹터별 상관관계 분석 기능 추가 완료 (Pandas Pearson 계수 연산 및 프리미엄 글래스모피즘 히트맵 구현)
- 2026-05-17: TFF 상세 뷰 카드화 (S1-8) 완료, YtmView 및 MonthlyView 전용 카드 레이아웃 전환
- 2026-05-17: CumulativeView 및 SectorStatusGrid TypeScript 형변환 버그(cloneElement, undefined check) 해결
- 2026-05-17: TFF 대시보드 예수금 파싱 검증 완료 (화면상 26.6만원 정상 노출 확인)
- 2026-05-16: 섹터분석 고도화 (국내/해외 구분 조회, 우주/에너지 섹터 추가, Bento Grid 현황판 구현)

---

## Session Handoff Protocol

Before ending: Update Quick Summary + Story Status + features.md
When starting: Read this file → features.md → failure-patterns.md → project-brief.md

---

## Archive

| Sprint | ID | Title | Completed |
|--------|----|-------|-----------|
