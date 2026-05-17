# Project State — ETF Lens

> **Keep this file under 200 lines.**

## Quick Summary

✅ Last session: 섹터분석 고도화 (국내/해외/통합 필터, 우주/에너지 섹터 추가, 실시간 현황 Grid 및 한-미 집중 비교 기능 구현)
🔄 In progress: S1-8 TFF 상세 데이터 카드화 및 고도화
➡️ Next: 섹터별 상관관계 분석 기능 검토 및 구현

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
| S1-8 | TFF 상세 데이터 카드화 및 고도화 | 🔧 active | 포트폴리오 디테일 뷰 카드형 설계 및 성과 지표 추가 |
| S1-9 | 섹터별 상관관계 분석 기능 추가 | ⬜ planned | 섹터 간 상관계수 히트맵 및 포트폴리오 분산 효과 분석 |

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

## Technical Decisions

- KIS API: 초당 1건 제한 → sleep(1.2) 필수, EGW00133 → sleep(2.5) 후 재시도
- PostgreSQL: Render $7/월 유료 (90일 만료 없음), Internal URL 사용
- 캐시: 포트폴리오 5분 인메모리, ETF 마스터 5분 캐시
- 클라이언트 Excel 파싱: XLSX.js (서버 업로드 없음)

## Recent Changes

- 2026-05-17: TFF 대시보드 예수금 파싱 검증 완료 (화면상 26.6만원 정상 노출 확인)
- 2026-05-16: 섹터분석 고도화 (국내/해외 구분 조회, 우주/에너지 섹터 추가, Bento Grid 현황판 구현)
- 2026-05-16: 네비게이션 구조 개편 (모니터링 -> 시장동향 명칭 변경, 섹터분석 탭 신설)
- 2026-05-14: InvestmentReturnCard UI 고도화 (용어 표준화, 비중 % 표시, localStorage 저장 로직 추가)
- 2026-04-23: Render PostgreSQL URL 교체 (dpg-d6uh7jqa214c73d4g47g-a)
- 2026-04-23: UserPrincipal DB 모델 추가
- 2026-04-23: /api/v1/my/principal + /cashflow 엔드포인트 추가
- 2026-04-23: InvestmentReturnCard 컴포넌체 생성
- 2026-04-23: ETF 마스터 재동기화 (ACE/TIGER 우주테크 포함)
- 2026-04-15: excelParser.ts — 투자비중 시트 현금 파싱 추가
- 2026-04-15: etf_data_v2.db .gitignore 등록

---

## Session Handoff Protocol

Before ending: Update Quick Summary + Story Status + features.md
When starting: Read this file → features.md → failure-patterns.md → project-brief.md

---

## Archive

| Sprint | ID | Title | Completed |
|--------|----|-------|-----------|
