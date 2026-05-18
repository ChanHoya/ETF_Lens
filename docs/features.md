# Feature Registry — ETF Lens

## Feature List

| Feature | Status | Key Files | Notes |
|---------|--------|-----------|-------|
| ETF 마스터 DB | ✅ done | backend/api/router.py, db/models.py (ETFMaster) | ~1,000 종목 |
| ETF 종목 검색 | ✅ done | dashboard/src/components/EtfSearchDropdown.tsx | |
| ETF 비교 분석 | ✅ done | dashboard/src/components/CompareTable.tsx, CompareChart.tsx | |
| ETF 평가 (점수) | ✅ done | db/models.py (ETFEvaluation) | 유동성/비용/추적/성과 |
| Portfolio Backtest | ✅ done | backend/api/backtest.py | |
| KIS 포트폴리오 조회 | ✅ done | backend/api/my_assets.py (portfolio) | 4계좌, Rate limit 캐시 |
| KIS 당일 체결 내역 | ✅ done | backend/api/my_assets.py (trades/today) | |
| KIS 종목별 시그널 | ✅ done | backend/api/my_assets.py (holdings-signals) | MA5/MA20/RSI |
| 초기투자금 대비 수익률 | ✅ done | backend/api/my_assets.py (principal, cashflow), dashboard/src/components/InvestmentReturnCard.tsx | UI 개선 완료 |
| TFF 대시보드 코어 | ✅ done | dashboard/src/lib/tff/excelParser.ts, dashboard/src/components/tff/ | 26.6만 원 예수금 정상 노출 확인 |
| TFF 상세 데이터 카드화 | ✅ done | dashboard/src/components/tff/views/YtmView.tsx, MonthlyView.tsx | YTM/Monthly 개별 카드 뷰 전용 구현 완료 |
| AI 채팅 (Gemini) | ✅ done | backend/api/chat.py, dashboard/src/components/ChatBot.tsx | |
| 매크로 컴퍼스 | ✅ done | backend/api/macro_compass.py, dashboard/src/components/MacroCompass.tsx | |
| Exit Signal | ✅ done | backend/api/exit_signal.py | |
| 위험도 배너 | ✅ done | dashboard/src/components/RiskBanner.tsx | |
| 포트폴리오 마켓 | ✅ done | backend/api/portfolio_market.py, db/models.py (SharedPortfolio) | 공유 포트폴리오 |
| 섹터분석 고도화 | ✅ done | SectorAnalysisTab.tsx, SectorComparisonChart.tsx, SectorStatusGrid.tsx | 국내/해외/통합 필터링, 우주/에너지 섹터 포함 16종 지표, 집중 분석 연동 |
| 섹터별 상관관계 히트맵 | ✅ done | router.py (sector-correlation), SectorCorrelationHeatmap.tsx | 국내/해외 7대 주요 섹터 간 피어슨 상관계수 연산 및 프리미엄 2D 그리드 히트맵 시각화 완료 |
| 우주 개별종목 상세연동 | ✅ done | SpaceChart.tsx, router.py (fetch_etf_hybrid) | 우주 특화 구성종목 비중 테이블 내 개별 종목 클릭 시 차트 및 한글 기업소개 팝업 모달 연동 완료 |
| 커버드콜 분석 | ✅ done | backend/api/covered_call.py, dashboard/src/components/CoveredCallTab.tsx | |
| 헬스체크 | ✅ done | backend/api/health_monitor.py | /api/v1/analyze/health |
| 개별종목 상세 미국 우주섹터 지수 및 3개월 뉴스 연동 | ✅ done | Modals.tsx, MainApp.tsx, router.py | NASDAQ 벤치마크, 미국 우주섹터(ARKX) 다중 오버레이 차트 구현 및 최근 3개월 언론보도 벤토 레이아웃 연동 완료 |
| AI 포트폴리오 리밸런싱 제안 | ✅ done | backend/api/rebalance_proposal.py, RebalanceProposal.tsx | KIS 실시간 포트폴리오 자산을 7대 테마로 분류하여 피어 등락률 분석 및 Gemini 기반 맞춤형 자산 리밸런싱 교체 권고 구현 완료 |
| 무중단 DB 복제 및 정합성 분석 | ✅ done | backend/core/db_replicator.py, backend/api/db_sync.py, DbSyncControl.tsx | 로컬 SQLite ↔ remote PostgreSQL 간 비동기 복제 스케줄러, 관리용 API 및 정합성 크로스 검증 패널 구현 완료 |
| 다계좌 리밸런싱 오더 라우팅 & 가상 체결 시뮬레이터 | ✅ done | backend/api/order_router.py, RebalanceProposal.tsx | KIS 다계좌 실시간 포트폴리오를 기반으로 AI 리밸런싱 제안을 모의 주문 설계하고 가상 체결하여 실시간 대시보드 오버레이 시뮬레이션을 구현 완료 |
| 추천 종목 클릭 시 상세 모달 팝업 | ✅ done | MainApp.tsx, AIInsight.tsx, MacroCompass.tsx, RebalanceProposal.tsx | 추천 ETF 종목 또는 대안 ETF를 클릭 시 상세 종목 정보와 주가/뉴스 모달이 팝업되도록 커스텀 이벤트 연동 완료 |
| VKOSPI / FGI 다차원 지표 & Bento Grid | ✅ done | backend/core/quant_sentiment.py, backend/api/exit_signal.py, RiskGaugeChart.tsx, KospiExitAnalyzer.tsx | KOSPI 실현 변동성(VKOSPI 프록시) 퀀트 계산 탑재, DB 영속성 시딩, SVG 반원형 네온 리스크 게이지 및 6패널 Bento Grid 고도화 완료 |


## Status Legend

- ✅ **done** — 기능 완전 구현, 운영 중
- 🔧 **active** — 개발/검증 진행 중
- ⬜ **planned** — 백로그, 미착수
- ⚠️ **broken** — 알려진 이슈 있음
- ❌ **dropped** — 제거됨
