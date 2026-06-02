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
| S4-1: ETF 구성 종목 중복도 분석 백엔드 | ✅ done | backend/core/overlap_analyzer.py, backend/api/my_assets.py | 실질 주식 노출 및 ETF 간 중복도 퀀트 분석 엔진 |
| S4-2: AI 기반 리밸런싱 백테스트 시뮬레이터 | ✅ done | backend/api/backtest.py, AIRebalanceSimulator.tsx | Exit-Signal 기반 동적 자산 대피/복귀 시뮬레이션 및 UI |
| S4-3: 미국 주요 매크로 인플레이션 차트 | ✅ done | backend/api/exit_signal.py, DiscoverTab.tsx | DB 캐싱된 미국 CPI/PPI/PCE YoY 데이터 조회 API 및 Recharts 미려한 네온 LineChart 연동 |
| S4-4: ETF 실질 비용 및 추적오차 종합 진단 랭킹 보드 | ✅ done | backend/core/etf_evaluator.py, dashboard/src/app/discover/page.tsx | TER 및 거래수수료를 합산한 실질 비용 연산 및 오차 벌점제 적용 랭킹 보드 구축 완료 |
| S5-1: AI 기반 포트폴리오 스트레스 테스터 | ✅ done | backend/core/stress_tester.py, backend/api/router.py | 역사적 위기 시나리오를 대입하여 포트폴리오 예상 MDD/VaR 분석 백엔드 엔진 구축 완료 |
| S5-2: 원/달러 환율 시뮬레이터 및 환헤지 vs 환노출 비교 분석기 | ✅ done | backend/core/currency_analyzer.py, dashboard/src/components/FxFinder.tsx | 환헤지(H)와 환노출 ETF 간 원/달러 환율 변동 추이 연동 및 시나리오별 성과 비교 시뮬레이터 차트 연동 완료 |
| S5-3: ISA 및 연금저축/IRP 과세이연 및 절세 혜택 시뮬레이터 | ✅ done | dashboard/src/components/TaxOptimizer.tsx | 절세 계좌별 비과세/과세이연 혜택 및 세후 최종 복리 수령액 비교 계산 도구 개발 완료 |
| S5-4: 우주 ETF 구성종목 변동 그래프 및 개별 주식 팝업 연동 | ✅ done | backend/api/router.py, SpaceChart.tsx, MainApp.tsx, Modals.tsx | 4대 우주 ETF 클릭 시 상위 구성종목 주가를 점선 오버레이 렌더링하고 구성종목 클릭 시 개별 미국 주식 전용 모달 팝업 연동 완료 |
| S5-5: 바이오 ETF 구성종목 변동 그래프 및 개별 주식 팝업 연동 | ✅ done | backend/api/router.py, BioChart.tsx, MainApp.tsx, Modals.tsx, SectorAnalysisTab.tsx | 5대 바이오 ETF 클릭 시 상위 구성종목 주가를 점선 오버레이 렌더링하고 구성종목 클릭 시 개별 국내 주식 전용 모달 팝업 연동 완료 |
| S5-6: My 탭 내 보유 자산 정보 기반 AI Assistant 서비스 연동 및 바로가기 위젯 추가 | ✅ done | backend/api/chat.py, ChatBot.tsx, MyAssetsView.tsx, MyDashboard.tsx | 실시간 보유 종목/자산 데이터를 sessionStorage로 ChatBot에 전달하여 사용자 맞춤형 분석 제공 및 Bento Grid 퀵 질문 위젯 배치 완료 |
| S5-7: 우주섹터 미국 신규 ETF 5종 연동 및 한/미 마켓 토글 테이블 고도화 | ✅ done | backend/api/router.py, SpaceChart.tsx | 비교 차트에 미국 ETF 5종 추가, 범례 분리 배치(국내 윗줄/미국 아랫줄), 테이블 상단 한/미 토글 버튼 및 비중 동적 렌더링 구현 완료 |
| S5-8: 포트폴리오 트리맵 매수/수익액 추가 및 색상 매핑 | ✅ done | PortfolioTreemap.tsx, MyDashboard.tsx | 트리맵 툴팁, 카테고리 카드 뱃지, 대시보드 메트릭에 매수/수익금액 노출 및 파랑(+)/빨강(-) 색상 매핑 완료 |
| S5-9: 우주섹터 구성종목 가격/전일대비증감율 실시간 연동 | ✅ done | backend/api/router.py, SpaceChart.tsx | 우주섹터 주요 ETF 구성종목 테이블 우측에 실시간 현재가 및 변동률(yfinance quotes) 병렬 수집 및 5분 캐시 연동 완료 |
| S5-10: ETF 괴리율(NAV Gap) 실시간 모니터링 및 텔레그램 알림 시스템 구축 | ✅ done | disparity_analyzer.py, router.py, my_assets.py, scheduler.py, MyDashboard.tsx, SpaceChart.tsx, BioChart.tsx | 실시간 괴리율 계산, 사용자 보유 자산 가중 괴리율 주입, 09:10/15:15 KST 스케줄러 및 텔레그램 경보 알림, 대시보드 Bento 경보 카드 및 섹터 구성종목 헤더 배지 연동 완료 |
| S5-12: ETF 구성종목(CU) 데이터 보완 및 yfinance 연동 | ✅ done | backend/api/router.py, Modals.tsx, SpaceChart.tsx | 미국 ETF 최신 구성종목 dynamic 연동 및 국내 상장 해외/합성 ETF의 주식수 기반 비율 차트 시각화, 우주섹터 구성종목 테이블 우측 상단 기준일자 정보 실시간 수집 시각(KST)으로 동적 연동 완료 |
| S5-13: 실시간 괴리율 경보 5단계 등급 개편 | ✅ done | MyDashboard.tsx, HoldingsSignals.tsx | 괴리율 마이너스 영역 '매수 검토/관망', 플러스 영역 '매도 관망/검토' 5단계 투자지침형 체계 개편 |
| S5-14: TFF 종목별 수익률 엑셀 테이블 및 예수금 핫픽스 | ✅ done | YtmView.tsx, MonthlyView.tsx, excelParser.ts, types.ts | 종목별 수익률 탭 내 엑셀 레이아웃 그대로 반영된 요약표 추가, 현금(예수금) 파싱 알고리즘 최적화, YTM 탭 상단에 엑셀 원본 포맷의 종합 현황판 및 현금/평잔 종합현황 대시보드 추가 완료 |
| S6-1: TFF 엑셀 업로드 PostgreSQL 저장 및 중앙 공유형 대시보드 | ✅ done | TffDashboard.tsx, router.py, models.py | PostgreSQL DB 데이터 저장, 마스터 패스코드 인증 및 뷰어/마스터 권한 제어 격리 구현 완료 |
| S6-2: 포트폴리오 Efficient Frontier 최적화 백엔드 API | ✅ done | backend/api/efficient_frontier.py, backend/tests/test_efficient_frontier.py | MPT 기반 기대수익률/변동성/공분산 연산, 몬테카를로 시뮬레이션 및 Numeric Binning 곡선 산출 API 구현 완료 |
| S6-3: Efficient Frontier 시각화 및 최적 비중 연동 | ✅ done | dashboard/src/components/EfficientFrontierPanel.tsx, MyDashboard.tsx | Recharts ComposedChart 산점도 및 효율전선 커브, 최적 비중 비교 바 차트 시각화 완료 |
| S6-7: 계좌별 자산 증감(추이) 시각화 및 분석 | ✅ done | backend/api/my_assets.py, dashboard/src/components/AssetHistoryChart.tsx, MyAssetsView.tsx | KIS 일별 계좌 스냅샷 DB 자동 적재 및 거래내역 기반 90일 역산/복원 차트 시각화 완료 |
| S6-8: 전력/에너지 섹터 주요 종목 현황 및 구성종목 비중 비교 | ✅ done | EnergyChart.tsx, router.py (energy-chart, energy-holdings), SectorAnalysisTab.tsx | 국내주식/해외주식/해외상장 3분할 탭 개편, GRID 등 미국 상장 6종 추가 및 달러화(USD) 분기 표기 최적화 완료 |
| S6-8-Add: 바이오 & 전력 섹터 전문가 리포트 통합 | ✅ done | BioChart.tsx, EnergyChart.tsx | Gemini 공유 링크 핵심 분석 요약(거시경제 피벗, M&A, ETF 비교, 자산배분 모델 등) 3탭 Bento 카드 통합 완료 |
| S6-9: 차기 주도주 발굴 및 퀀트 스크리너 | ✅ done | backend/api/next_leader.py, NextLeaderScreener.tsx, SectorAnalysisTab.tsx | 양극화 지수, M7 CAPEX, 반도체 이격 신호등 및 10대 테마 퀀트 스크리너 구축 완료 |



## Status Legend

- ✅ **done** — 기능 완전 구현, 운영 중
- 🔧 **active** — 개발/검증 진행 중
- ⬜ **planned** — 백로그, 미착수
- ⚠️ **broken** — 알려진 이슈 있음
- ❌ **dropped** — 제거됨
