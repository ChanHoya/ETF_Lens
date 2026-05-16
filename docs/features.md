# Feature Registry — ETF Lens

## Feature List

| Feature | Status | Key Files | Notes |
|---------|--------|-----------|-------|
| ETF 마스터 DB | ✅ done | backend/api/router.py, db/models.py (ETFMaster) | ~1,000 종목 |
| ETF 종목 검색 | ✅ done | dashboard/src/components/EtfSearchDropdown.tsx | |
| ETF 비교 분석 | ✅ done | dashboard/src/components/CompareTable.tsx, CompareChart.tsx | |
| ETF 평가 (점수) | ✅ done | db/models.py (ETFEvaluation) | 유동성/비용/추적/성과 |
| 포트폴리오 백테스트 | ✅ done | backend/api/backtest.py | |
| KIS 포트폴리오 조회 | ✅ done | backend/api/my_assets.py (portfolio) | 4계좌, Rate limit 캐시 |
| KIS 당일 체결 내역 | ✅ done | backend/api/my_assets.py (trades/today) | |
| KIS 종목별 시그널 | ✅ done | backend/api/my_assets.py (holdings-signals) | MA5/MA20/RSI |
| 초기투자금 대비 수익률 | ✅ done | backend/api/my_assets.py (principal, cashflow), dashboard/src/components/InvestmentReturnCard.tsx | UI 개선 완료 |
| TFF 대시보드 | 🔧 active | dashboard/src/lib/tff/excelParser.ts, dashboard/src/components/tff/ | 예수금 파싱 이슈 잔존 |
| AI 채팅 (Gemini) | ✅ done | backend/api/chat.py, dashboard/src/components/ChatBot.tsx | |
| 매크로 컴퍼스 | ✅ done | backend/api/macro_compass.py, dashboard/src/components/MacroCompass.tsx | |
| Exit Signal | ✅ done | backend/api/exit_signal.py | |
| 위험도 배너 | ✅ done | dashboard/src/components/RiskBanner.tsx | |
| 포트폴리오 마켓 | ✅ done | backend/api/portfolio_market.py, db/models.py (SharedPortfolio) | 공유 포트폴리오 |
| 섹터분석 | ✅ done | dashboard/src/components/SectorAnalysisTab.tsx | 반도체 지수 및 도메인별 지표 |
| 커버드콜 분석 | ✅ done | backend/api/covered_call.py, dashboard/src/components/CoveredCallTab.tsx | |
| 헬스체크 | ✅ done | backend/api/health_monitor.py | /api/v1/analyze/health |

## Status Legend

- ✅ **done** — 기능 완전 구현, 운영 중
- 🔧 **active** — 개발/검증 진행 중
- ⬜ **planned** — 백로그, 미착수
- ⚠️ **broken** — 알려진 이슈 있음
- ❌ **dropped** — 제거됨
