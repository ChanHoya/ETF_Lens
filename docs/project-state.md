# Project State — ETF Lens

> **Keep this file under 200 lines.**

## Quick Summary

✅ Last session: CORS 접속 오류 수정 + 투자 원금 카드 UI 개선 (토글형) + 히트맵 폰트 시인성 강화
🔄 In progress: S1-3 TFF 대시보드 (예수금 파싱 이슈 해결 필요)
➡️ Next: /my 페이지에서 KIS 자동 조회 버튼 테스트 및 배포 결과 최종 확인

## Current Sprint

- Sprint: 1 — Core Features
- Started: 2026-03-17
- Branch: main

## Story Status

| ID | Title | Status | Notes |
|----|-------|--------|-------|
| S1-1 | ETF 마스터 DB + 종목 분석 | ✅ done | 1,000+종목 |
| S1-2 | KIS 포트폴리오 4계좌 연동 | ✅ done | Rate limit 보호 완료 |
| S1-3 | TFF 대시보드 | 🔧 active | 예수금 파싱 이슈 잔존 |
| S1-4 | Render DB 복구 (PostgreSQL 전환) | ✅ done | 유료 $7/월 |
| S1-5 | 초기 투자금 대비 수익률 카드 | ✅ done | UI 개선 및 CORS 수정 완료 |
| S1-6 | Bootstrap / Conductor 문서화 | ✅ done | 이번 세션 |

## Module Registry

| Module | Layer | Status | Key Files |
|--------|-------|--------|-----------|
| ETF Master | Backend | ✅ stable | api/router.py, db/models.py |
| KIS Portfolio | Backend | ✅ stable | api/my_assets.py |
| Investment Return | Backend | ✅ stable | api/my_assets.py (cashflow endpoint) |
| TFF Parser | Frontend | 🔧 active | src/lib/tff/excelParser.ts |
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

- 2026-05-14: backend/main.py CORS 설정 수정 (Vercel 도메인 명시)
- 2026-05-14: InvestmentReturnCard UI 개선 (원금 추가 폼 하단 이동 및 토글 적용)
- 2026-05-14: PortfolioTreemap 시인성 개선 (폰트 확대 및 하단 잘림 해결)
- 2026-04-23: Render PostgreSQL URL 교체 (dpg-d6uh7jqa214c73d4g47g-a)
- 2026-04-23: UserPrincipal DB 모델 추가
- 2026-04-23: /api/v1/my/principal + /cashflow 엔드포인트 추가
- 2026-04-23: InvestmentReturnCard 컴포넌트 생성
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
