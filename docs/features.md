# Feature Registry — ETF Lens

## Feature List

| Feature | Status | Key Files | Notes |
|---------|--------|-----------|-------|
| 부동산 실데이터 백엔드 수집 파이프라인 & 서울시 오픈데이터 연동 & sample 안전 Fallback & 실시간 동기화 (S20-1~4) | ✅ done | real_estate_collector.py, real_estate.py, models.py, scheduler.py, RealEstateTab.tsx, test_real_estate.py | 1) S20-1: `RealEstateMonthlyStats` DB 모델링 및 서울 열린데이터광장 OpenAPI 연동. `SEOUL_OPEN_DATA_KEY`가 없거나 `sample`인 경우 에러 없이 34개월간의 실제 기반 통계 캐시(2024.01~2026.10)로 안전 Fallback 전환, 2) S20-2: 매물 적체량 & 주담대 금리 월간 통계 생성 및 upsert 로직, 3) S20-3: FastAPI `/api/v1/real-estate/market-trends`, `/summary`, `/sync`, `/status` 엔드포인트 구축, 6개 단위 테스트 100% Pass, 매주 월요일 04:30 KST 자동 동기화 cron 등록, 4) S20-4: 프론트엔드 실시간 API fetch 바인딩, 상단 `[검증된 캐시 연동 (sample 대기)]` 배지 및 `[🔄 실데이터 갱신]` 수동 트리거 버튼 구축 |
| 부동산 인텔리전스 레이더 & 2인 전문가(엘리엇 vs 박은정 감정평가사) 심층 대담 벤토 & 실물 부동산 vs 배당 ETF 기회비용 시뮬레이터 (S19-1~3) | ✅ done | RealEstateTab.tsx, MainApp.tsx | 1) S19-1: 상단 네비게이션 '연금·절세' 우측에 [부동산] 탭 신설 및 라우팅 연동, 2) S19-2: '재테크는 두꺼비 세무사' 유튜브 특별 대담 분석 기반 2인 전문가 독립 벤토 카드, 3단계 토글, 3대 실전 행동 지침 및 영상 이후 2025~2026년 실증 추적 사후 검증 패널 탑재, 3) S19-3: 2024.01~2026.10 최신 시계열(34개월) 매물 적체량 vs 실거래량 Recharts 추이 차트, 1Y/2Y/ALL 기간 선택 스위처, 4대 거시 지표 2026.10 최신치 동기화 및 실물 아파트 보유비용 vs 배당 ETF 현금흐름 실시간 시뮬레이터 구축 |
| 거시경제 4대 탭(종합/환율/금리/주식) 첫 번째 지표 박스 6M~10Y 실제 시계열 팝업 모달 & 6대 통합 박스 2열 배치 & 선택형 버튼 컴팩트화 (첨부 1~5) | ✅ done | backend/api/macro_dashboard.py, MacroTab.tsx, FxTab.tsx, RatesTab.tsx, StocksTab.tsx, MarketDetailModal.tsx, OilTab.tsx | 1) 종합분석 6대 핵심 지표(원유3대, VIX/VKOSPI/F&GI, 3대물가, 한미금리/국채, 환율, 주식) 2행 3열 전면 재배치 및 기존 하단 분리 박스 완전 통합·삭제, 하단 AI 코멘트 전폭화, 2) 환율/금리/주식 첫 줄 카드 클릭 시 6M/1Y/5Y/10Y 실 시계열 팝업 모달 제공(DXY 왜곡 검증 및 Y축 정규화), 3) 팝업 및 대시보드 내 선택형 버튼/박스 크기·폰트 축소(text-[11px], px-2 py-0.5)로 주변 텍스트와 이질감 없는 일관 디자인 적용 |
| 미국 선거 주기 사이클 차트 도트(Dot) 상시 표시 & 기간 필터(5Y/10Y/30Y/ALL) & Fed 기준금리·역사적 매크로 이벤트 오버레이 | ✅ done | backend/api/midterm_election.py, MidtermElectionTab.tsx | 1950~2026 77개년 S&P500·나스닥 사이클 차트 상에 대선 해(파란 발광 링+도트) 및 중간선거 해(빨간 발광 링+도트) 상시 렌더링, 5Y/10Y/30Y/전체 기간 필터 스위처, 연준 기준금리(Fed Funds Rate) 듀얼 Y축 및 역사적 이벤트 오버레이 토글, 선택 기간별 동적 4대 KPI 카드 연동 |
| 유가·정제마진 주식시장 영향 가이드 & AI 종합 진단 & 10Y 매크로 오버레이 팝업 | ✅ done | backend/api/oil_dashboard.py, OilTab.tsx | 원유 수급·정제마진의 주식시장/섹터(정유/화학/항공/기술주) 파급 경로 및 실전 판단 가이드, 2026년도 최신 차트, 최상단 AI 종합 진단 위젯, 6M/1Y/5Y/10Y 기간별 S&P500·Nasdaq·달러지수·CPI·PPI·PCE 복합 비교 팝업 모달 탑재, WTI·Brent·Dubai·스프레드 대시보드-모달 간 실시간 시세(2026-10) 100% 일치화, 유가-PPI 핵심 연동 및 Recharts 듀얼/멀티 Y축 분리 스케일 정상화 |
| 유가 급변(±3.5%) & VIX 스파이크 텔레그램 스마트 경보 | ✅ done | backend/core/macro_alert_engine.py, NotificationSettings.tsx | 유가 급등락·호르무즈 위험점수 및 VIX 20/25p 돌파 시 내 포트폴리오 영향도 요약 멀티채널 발송 & 테스트 엔드포인트 연동 |
| 9대 글로벌 위기 포트폴리오 스트레스 테스터 (오일쇼크 포함) | ✅ done | backend/core/stress_tester.py, PortfolioStressTester.tsx | 오일 쇼크 $120 폭등(1970s/2022) 및 마이너스 유가(2020.04) 2대 시나리오 추가, 9대 위기 비교 바 차트 및 MDD 진단 |
| 미국 중간선거 4대 시나리오 인터랙티브 시뮬레이터 & D-Day | ✅ done | backend/api/midterm_election.py, MidtermElectionTab.tsx | 2026.11.03 D-Day 실시간 카운트다운, 상원(34석) & 하원(435석) 장악 정당 조합 인터랙티브 토글 및 4대 시나리오 즉시 매핑 |
| 프로덕션 실서버(Render/Vercel) 배포 점검 및 라이브 동기화 | ✅ done | backend/api/health_monitor.py, backend/tests/test_live_e2e_sync.py | 14대 스케줄러 잡 및 245개 전 테스트 100% Pass, Render 백엔드 및 Vercel 프론트엔드 실서버 정상 동작 확인 |
| 글로벌 유가 및 에너지 시장 동향 분석 | ✅ done | backend/api/oil_dashboard.py, OilTab.tsx | 3대 벤치마크(WTI·Brent·Dubai) 실시간 시세, 스프레드, EIA 재고·생산량, 정제마진, 3대 지정학 초크포인트, 실전 ETF 플레이북 |
| 시장동향 '종합' 진정한 다차원 거시 분석 | ✅ done | backend/api/macro_dashboard.py, MacroTab.tsx | '종합(환율/금리/주식)' → '종합' 명칭 개편, 글로벌 5대 거시 핵심 지표(유가, VIX, CPI 인플레, 장단기 금리차, DXY) 통합 패널 탑재 |
| 미국 중간선거('26.11) 영향 분석 고도화 | ✅ done | backend/api/midterm_election.py, MidtermElectionTab.tsx, MidtermPortfolioProposal.tsx | 중간선거 3대 법칙, 나스닥 계절성 및 1950~2026 연도별 사이클(대선/중간선거 파스텔 밴드), AI 투자성향 인터뷰 팝업, My KIS 실시간 포트폴리오 리밸런싱 제안 연동 |
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
| S6-10: 섹터별 주가 흐름 격자 (Sector Flow Grid) | ✅ done | next_leader.py, SectorFlowGrid.tsx, SectorAnalysisTab.tsx | KOSPI, KOSDAQ, S&P 500, NASDAQ의 주요 섹터별 1년 주가 흐름을 미니 AreaChart 및 5/20/60일 이동평균선(점선) 격자로 시각화 완료 |
| S6-11: 반도체 ETF 구성종목 변동 그래프 및 전문가 리포트 개편 | ✅ done | backend/api/router.py, active_etfs.py, SemiChart.tsx, SectorAnalysisTab.tsx | 12종 반도체 ETF(국내/해외/미국) 3대 탭 개편, 점선 오버레이, 괴리율 및 실시간 프리마켓 예상가 연동, Gemini 반도체 Expert Report 통합 완료 |
| 텔레그램 개인 알림 수신처 다중화 | ✅ done | backend/core/notifier.py, backend/api/notification_settings.py, NotificationSettings.tsx, BrazilBondTab.tsx | 개인별 텔레그램 봇 토큰 및 Chat ID 등록 지원, 브라우저 localStorage 연동 및 알림 이벤트 발생 시 등록된 모든 사용자 대상 멀티캐스트 알림 발송 |
| 브라질 채권 분석 (Selic vs Y5) | ✅ done | backend/api/brazil_bond.py, brazil_fetcher.py, scheduler.py, BrazilBondTab.tsx | FRED 10년 역사적 금리/Investing.com 연동 차트, 10Y/1Y/6M/3M 필터, COPOM 기준금리 변경 감지 핫 알림, 접속 시 이전 날짜인 경우 AI 전략리포트 일자별 자동 재생성 및 15분 주기 실시간 동기화 연동, 매크로 캘린더 지난 이벤트(9월 Copom 등) 자동 평가/DB 영속화 및 [이벤트 결과 AI 자동 갱신] 버튼 지원 |
| S6-14: 구글 시트 기반 종합 자산 관리 (Account Board + KIS 연동 + 수동 입력) | ✅ done | backend/api/integrated_assets.py, backend/db/models.py, TotalAssetBoard.tsx, ManualAssetModal.tsx, ManualCashModal.tsx, KisAccountMappingModal.tsx, MyAssetsView.tsx | KIS API 실시간 연동 및 타 증권사(미래에셋/삼성/저축) 수동 자산/예수금 통합 집계, 구글 시트 형태의 Account Board 및 계좌별 상세 종목 뷰 구현 완료 |
| S6-15: 반도체 매크로 사이클(CSCI) 퀀트 엔진 및 4국면 시각화 대시보드 | ✅ done | backend/core/semi_cycle_engine.py, backend/api/router.py, SemiCycleDashboard.tsx, SemiChart.tsx, SectorInsightReport.tsx | 5년 롤링 Z-score 정규화 기반 선행(40%)+동행(40%)+후행(20%) CSCI 지수, 4-Phase 사이클 시계(2D Quadrant), 빅테크 CapEx 트래커, 서브섹터 디커플링 맵, ETF 리밸런싱 매트릭스 연동 완료 |
| S6-17: 브라질 대선 시나리오 분석 및 조건별 추천 국채 라인업 | ✅ done | backend/api/brazil_bond.py, dashboard/src/components/BrazilBondTab.tsx | 대선 3대 시나리오 비교 매트릭스(BCB 법적 독립성 하방 방파제 보강), 금리 레벨별 듀레이션 기술적 배분 원칙(금리 고점=장기채 확대), 조건/기간별 추천 국채 5종 라인업(헤알 단기/장기, 달러 10년, 안정 방어형 바벨 5:3:2, 적극 고수익·여유자금형 바벨 장기50:중기30:달러20), Tranche 3 실시간 체크리스트 및 Gemini AI Live Pulse 실시간 정세 브리핑 연동 완료 |
| S6-18: 브라질 대선 2차 결선투표 추가, 타임라인 1줄 최소화 및 대선 종합 인텔리전스 팝업 | ✅ done | backend/api/brazil_bond.py, dashboard/src/components/BrazilBondTab.tsx | 2026-10-26(현지 10/25) 2차 결선투표 Timeline 추가, 완료된 이벤트 1줄 접기/펼치기 아코디언 최소화 모드, 1차/2차 대선 카드 내 선거 일정/제도 요약표, 룰라 vs 플라비우 판세 및 Quaest(42% 동률)·AtlasIntel(47.6% vs 47.7%) 여론조사 시각화 바 차트, 국채 투자 액션 가이드 및 공신력 있는 언론 출처 링크 팝업 모달 구현 완료 |
| S6-4: ETF 배당(분배금) 정보 수집 백엔드 스크래퍼 및 API | ✅ done | backend/core/dividend_scraper.py, backend/api/dividends.py, backend/db/models.py | yfinance 및 네이버 모바일 API 연동 분배금 시계열 수집, 배당주기(월/분기/연) 자동 판별, 포트폴리오 월별 배당 Cashflow 시뮬레이션 및 고배당 랭킹 API 구축 완료 |
| S6-5: 배당 캘린더 및 배당 Cashflow 시뮬레이션 대시보드 화면 | ✅ done | dashboard/src/components/DividendDashboard.tsx, MyAssetsView.tsx, MainApp.tsx | 1~12월 월별 예상 배당금 차트(Recharts Bar), 12개월 배당 캘린더 매트릭스 뷰, 보유 수량 실시간 +/- 조절 및 재계산, /my 계좌 접근 한정 활성화 및 실계좌 자동 연동, 고배당&월배당 ETF 랭킹 연동 완료 |
| S6-6: 괴리율 개인화 알림 설정 및 알림 채널 확장 | ✅ done | backend/core/notifier.py, backend/api/notification_settings.py, backend/core/scheduler.py, NotificationSettings.tsx | Telegram, Discord, Slack 멀티채널 웹훅 연동 및 실시간 테스트 발송, ETF 괴리율 임계치 슬라이더(0.5%~5.0%) 및 대상 범위(내 보유 vs 전체) 개인화 경보 시스템 구축 완료 |
| S6-19: 브라질 국채 토탈리턴(Total Return) 시뮬레이터 & 대선 1차 투표 결과/이벤트 실시간 업데이트 | ✅ done | backend/core/brazil_total_return.py, backend/api/brazil_total_return.py, backend/api/brazil_election_intel.py, BrazilTotalReturnSimulator.tsx, BrazilBondTab.tsx | NTN-F 10% 반기이표 및 LTN 할인채 더티 프라이스·듀레이션·반기 복리 재투자·만기보유 vs 조기매도 자본차익·손익분기 환율·7x6(금리±300bp × 환율-30%~+20%) 시나리오 매트릭스, 1차 투표 개표 결과(룰라/플라비우/기타 득표율 및 10/25 결선 확정 뱃지) 실시간 시각화, Gemini AI 대선 뉴스 실시간 갱신 및 수동 결과/이벤트 등록 영속화 API 연동 완료 |
| S6-20: 범용 시계열 하이브리드 엔진 모듈화 | ✅ done | backend/core/hybrid_series.py, backend/tests/test_hybrid_series.py | DB(ETFDailyPrice/BenchmarkPrice) 우선 서빙 + 누락 영업일만 증분 수집(Gap-fill) + 당일 실시간 시세 병합(Live Merge) 공통 엔진 구축 완료 |
| S6-21: 매크로 출구신호 DB 영속화 & FRED/Yahoo 증분 수집 | ✅ done | backend/api/exit_signal.py, backend/tests/test_exit_signal_macro_db.py, backend/db/models.py | MarketMacroLog 연동으로 달러지수, 환율, 장단기금리차, HY 스프레드 DB 적재 및 결측일만 증분 수집하여 외부 스크래핑 지연 완전 제거 |
| S6-22: 섹터/테마 차트 5종 DB 하이브리드 엔진 전면 전환 | ✅ done | backend/api/router.py, backend/tests/test_sector_charts_hybrid.py | 반도체, 소부장, 우주항공, 에너지, 바이오 5대 섹터 차트의 10년치 반복 외부 호출을 DB 하이브리드 엔진으로 교체하여 초기 응답 속도 극대화 완료 |
| S6-23: 장 마감 자산 스냅샷 스케줄러 & 배당 14일 TTL 자동 갱신 파이프라인 | ✅ done | backend/api/my_assets.py, backend/core/dividend_scraper.py, backend/core/scheduler.py, backend/tests/test_snapshot_and_dividend_sync.py | 장 마감(평일 15:40) 시점 KIS 포트폴리오 기준 UserAssetSnapshot 자동 적재 및 배당 요약본(ETFDividendSummary) 14일 TTL stale 감지 시 주간 자동 갱신 크론 잡 구축 완료 |
| S6-24: 10대 주도주 스크리너 사전 계산 DB화 & 5대 섹터 구성종목 DB 서빙 전환 | ✅ done | backend/api/next_leader.py, backend/api/router.py, backend/db/models.py, backend/core/scheduler.py, backend/tests/test_next_leader_and_holdings_db.py | SectorLeaderQuant 모델 및 장 마감 후 자동 사전 계산 크론 잡 구축(20초→0.01초 즉각 응답), 5대 섹터 ETF 구성종목 DB 우선 조회 및 주가 5분 캐시 적용(8초→0.05초 초고속 서빙) |
| S6-25: 종합 매트릭스 및 배당 캘린더 DB 일괄 쿼리 & 캐시 가속화 | ✅ done | backend/api/router.py, backend/api/dividends.py, dashboard/src/components/DividendDashboard.tsx, backend/tests/test_compare_and_dividend_fast.py | 종합 매트릭스 중복 스크래핑 제거 및 60초 캐싱(0.05초 서빙), 배당 캘린더 포트폴리오 캐시플로우 DB 일괄 쿼리(0.005초) 및 SWR 캐시 우선 렌더링 완료 |
| S6-26: 종합 자산(Hoya Board) 초기 로딩 블로킹 제거 & KIS 스마트 캐시 | ✅ done | backend/api/my_assets.py, dashboard/src/components/MyAssetsView.tsx, backend/tests/test_my_assets.py | MyAssetsView 마운트 시 Hoya Board 탭을 가로막던 20초 전면 스피너 블로킹 제거, 세션 캐시 기반 0초 즉시 렌더링(SWR) 및 백엔드 포트폴리오 스마트 TTL(장마감 30분/장중 10분) 캐싱 적용 완료 |
| S6-27: 5대 섹터 차트·구성종목 119만 건 DB 영구 통합 및 프론트엔드 SWR 초고속 렌더링 | ✅ done | backend/api/router.py, dashboard/src/components/{SemiChart,SpaceChart,EnergyChart,BioChart,SemiPartsChart}.tsx | 과거 수집 119만 건 일별 시세 및 구성종목 DB 누락 복제 해결, 5대 섹터 백엔드 asyncio.gather 병렬화 및 타임아웃 방어, 5대 섹터 프론트엔드 SWR 0초 즉시 렌더링 적용 완료 |
| S6-28: 실서버(Render/Vercel) 배포 점검 & 프로덕션 동기화 검증 | ✅ done | backend/tests/, origin/main | 전체 141개 유닛 테스트 100% 통과, Render 백엔드 및 Vercel 프론트엔드 실서버 정상 응답(200) 확인 및 origin/main 배포 동기화 완료 |
| S6-29: 백그라운드 스케줄러 13종 점검 및 정상 기동 검증 | ✅ done | backend/core/scheduler.py | 장 마감 자산 스냅샷(15:40), 퀀트 사전계산(16:00), 배당 14일 갱신(일 23:30), 렌더 킵얼라이브(10분) 등 13개 cron/interval 잡 등록 및 정상 기동 검증 완료 |
| S6-30: 연금·절세 웰스 허브 탭 신설 및 국민연금 BEP·절세 시뮬레이터 연동 | ✅ done | dashboard/src/lib/pensionRules.ts, dashboard/src/components/pension/PensionWealthHub.tsx, dashboard/src/components/MainApp.tsx, dashboard/src/app/pension/page.tsx | 상단 메뉴바 연금·절세 탭 신설, 국민연금 조기/정상/연기 손익분기점(BEP) 연산, 건보료 피부양자 자격 탈락 위험 자동 판정, 연금 3총사(연금저축/IRP/ISA) 세액공제 및 30년 복리 과세이연 자산 격차 시뮬레이터 연동 완료 |
| S6-31: 포트폴리오 스트레스 테스터 실계좌 연동 및 7대 위기 시나리오 분석기 | ✅ done | backend/core/stress_tester.py, backend/api/router.py, dashboard/src/components/PortfolioStressTester.tsx, dashboard/src/components/MyDashboard.tsx | 7대 위기 시나리오(코로나2020, 블랙먼데이2024, 인플레2022, SVB2023, 러우전쟁2022, 신용강등2011, 리먼2008), KIS 실계좌 자동 연동 및 원화 손실액 환산, 방어지수, 최다타격/효자종목, AI 리스크 헷지 처방전 탑재 완료 |
| S6-32: 포트폴리오 목표 비중 드리프트(Drift) & 스마트 리밸런싱 주문기 | ✅ done | backend/core/portfolio_rebalancer.py, backend/api/router.py, dashboard/src/components/PortfolioRebalancer.tsx, dashboard/src/components/MyDashboard.tsx | 목표 비중 대비 괴리율(Drift) 산출, 정렬 점수(100점), 올웨더/60:40/테크성장 프리셋, 캐시 인젝션(매도 0주) vs 전체 리밸런싱 모드, Recharts 3중 막대 차트, 실행 주문표 및 CFP 처방전 완비 |
| S6-33: 매크로 거시경제 4국면 나침반 & 국면별 최적 ETF 레이더 | ✅ done | backend/core/macro_regime.py, backend/api/macro_dashboard.py, dashboard/src/components/MacroRegimeQuadrant.tsx, dashboard/src/components/DiscoverTab.tsx | 2D 성장-물가 사분면 매트릭스(골디락스/인플레붐/스태그플레이션/수축), 라이브 비콘(Live Beacon) 플로팅, 5개 분기 역사적 이동 궤적, 국면별 최적 ETF 3선, 보유 포트폴리오 국면 적합도 진단 완비 |
| S6-34: 올웨더 & 자산배분 멀티 ETF 포트폴리오 백테스터 2.0 | ✅ done | backend/core/multi_backtester.py, backend/api/backtest.py, dashboard/src/components/MultiAssetBacktester.tsx, dashboard/src/components/MyDashboard.tsx | 올웨더/60:40/바벨 프리셋, 리밸런싱 주기별(월간/분기/연간/미실시) 시뮬레이션, CAGR/MDD/Sharpe/Underwater 차트, S&P500 벤치마크 오버레이, AI 진단서 완비 |
| S6-35: 금융소득 종합과세(2,000만원) & 건보료 피부양자 실시간 방어 트래커 | ✅ done | backend/core/tax_shield_analyzer.py, backend/api/dividends.py, dashboard/src/components/TaxShieldRadar.tsx, dashboard/src/components/pension/PensionWealthHub.tsx | 금융소득 2,000만원 한도 실시간 추적, 4단계 위험도(SAFE/CAUTION/WARNING/CRITICAL), 피부양자 탈락 위험 경보 및 예상 월건보료, 1~12월 방어선 차트, ISA/연금 이전 CFP 권고안 완비 |
| S6-36: 실서버 배포 점검 및 라이브 E2E 동기화 검증 | ✅ done | backend/api/health_monitor.py, backend/tests/test_live_e2e_sync.py | 신규 5대 핵심 파이프라인(스트레스/리밸런싱/매크로/멀티백테스터/세금방어) 실서버 헬스체크(/health/live-summary) 및 E2E 무결성 검증 완료 |
| S7-1: 포트폴리오 백테스터 10년치 시계열 DB 캐싱 및 초고속 로딩 최적화 | ✅ done | backend/api/backtest.py, backend/tests/test_portfolio_backtest_cache.py | 10년치 일봉 데이터 DB 하이브리드 엔진 연동(get_hybrid_daily_prices_batch) 및 TTL 3600s 인메모리 결과 캐시 구축 (로딩 시간 95% 단축 및 0.001초 응답) |
| S7-2: AI 스마트 리밸런서 & 효율적 투자선 시계열 캐싱 통합 및 비동기 프리페치 | ✅ done | backend/api/backtest.py, backend/api/efficient_frontier.py, backend/tests/test_rebalance_and_efficient_frontier_cache.py | 리밸런스 시뮬레이터 및 몬테카를로 효율적 투자선 시계열 로딩을 DB 하이브리드 엔진으로 통합하고 TTL 3600s 인메모리 캐시 적용 |
| S7-3: 종합 자산(Hoya Board) ↔ KIS 실시간 포트폴리오 양방향 동기화 및 계좌 자동 매핑 | ✅ done | backend/api/integrated_assets.py, dashboard/src/components/KisAccountMappingModal.tsx, backend/tests/test_integrated_assets_kis_sync.py | KIS 4대 기본 계좌 자동 보충, KIS 매핑 모달 비동기 자동 fetch 및 fallback 바인딩, 일시 오프라인 시 최근 스냅샷 계좌 메타데이터 방어 완비 |
| S7-4: Sprint 7 라이브 E2E 통합 테스트 및 실서버 배포 무결성 검증 | ✅ done | backend/tests/test_sprint7_e2e_integration.py | 백테스터/리밸런서/효율적투자선 초고속 캐싱 및 종합자산 KIS 양방향 매핑 E2E 무결성 검증 완료 |
| S8-1: transitions.css 전역 모션 토큰 체계 구축 + 상단 메인 내비게이션 탭 슬라이딩 | ✅ done | dashboard/src/app/transitions.css, dashboard/src/components/common/SlidingTabs.tsx, dashboard/src/components/MainApp.tsx | transitions.dev 기반 GPU 가속 모션 토큰, 스프링 이징 곡선, SlidingTabs 글라이딩 인디케이터 및 메인/서브 내비게이션 탭 슬라이더 탑재 완료 |
| S8-2: /my 종합자산(Hoya Board & KIS) 탭 슬라이딩, PIN 모달 셰이크/체크, 자산 숫자 팝인 카운터 적용 | ✅ done | dashboard/src/components/MyAssetsView.tsx, MyDashboard.tsx, MyAuthModal.tsx, TotalAssetBoard.tsx, InvestmentReturnCard.tsx, common/NumberPopIn.tsx | My 서브탭 및 섹션5 시뮬레이션 탭 SlidingTabs 연동, PIN 불일치 햅틱 셰이크 및 성공 팝인 모션, 자산/수익률 변동 시 NumberPopIn 마이크로 인터랙션 적용 완료 |
| S8-3: /tff 펀드 대시보드 서브탭 슬라이딩, 추정 시뮬레이션 스무스 토글 스위치, 월별 비교 카드 텍스트 스왑 적용 | ✅ done | dashboard/src/components/tff/TffDashboard.tsx, dashboard/src/components/tff/views/MonthlyView.tsx | TFF 5대 서브탭 및 월별 분류 탭 SlidingTabs 글라이딩 적용, 추정 시뮬레이션 스프링 토글 스위치 비주얼, 버전 비교 메트릭 텍스트 스왑(t-text-swap) 및 월별 성과 NumberPopIn 적용 완료 |
| S8-4: AI 어드바이저 씽킹 스테이트 및 전체 모달 스케일/블러 진입 고도화 | ✅ done | dashboard/src/components/ChatBot.tsx, AIInsight.tsx, Modals.tsx, AccountDetailModal.tsx, KisAccountMappingModal.tsx, ManualAssetModal.tsx, ManualCashModal.tsx | AI Assistant/Insight 씽킹 카드(t-shimmer-text, 펄싱 아바타) 적용 및 전체 팝업/모달(관심종목, 상세, 계좌매핑, 수동자산, 마켓) 스프링 스케일(t-modal-panel) & 블러 백드롭(t-modal-backdrop) 전역 적용 완료 |
| S9-1: 포트폴리오 백테스터 탭 캐싱 및 로딩 속도 최적화 | ✅ done | backend/api/backtest.py, MyDashboard.tsx, PortfolioBacktester.tsx, AIRebalanceSimulator.tsx, MultiAssetBacktester.tsx, EfficientFrontierPanel.tsx | 프론트엔드 SWR/sessionStorage 캐싱, 섹션5 시뮬레이션 6대 서브탭 Keep-Alive 언마운트 방지, 백엔드 AI Insight 인메모리 캐싱(TTL 3600s) 및 수동 새로고침 버튼 탑재 완료 |
| S9-2: TFF 펀드 대시보드 브라우저 SWR 캐싱 & 0초 로딩 | ✅ done | dashboard/src/components/tff/TffDashboard.tsx | localStorage 3대 키 기반 마운트 즉시 0ms 복원, SWR 백그라운드 최신본 동기화, 초기 스켈레톤 로딩 UX 및 추정 시뮬레이션 캐시 보존 완료 |
| S9-3: 포트폴리오 백테스터 4대 심층 리스크 메트릭 보강 | ✅ done | backend/api/backtest.py, dashboard/src/components/PortfolioBacktester.tsx, backend/tests/test_portfolio_backtest_cache.py | 연간화 변동성, 샤프 지수, 소르티노 지수, 칼마 지수 백엔드 퀀트 계산 및 [종합 지표/수익률·MDD/4대 리스크] 3대 뷰 모드 UI 확장 완료 |
| S10-1: 통합 퀀트 데이터 엔진 & 공통 리스크 지표 연산 모듈화 | ✅ done | backend/core/unified_quant_engine.py, backend/tests/test_unified_quant_engine.py | DatetimeIndex 정규화(tz-naive/중복제거/ffill), 4대 리스크 메트릭(Vol/Sharpe/Sortino/Calmar) 및 VaR(95/99), 상관계수 행렬 및 포트폴리오 가중 수익률 연산 일원화 (테스트 7/7 100% Pass) |
| S10-2: Non-blocking 비동기 HTTP 커넥션 풀 및 세마포어 제어 | ✅ done | backend/core/unified_quant_engine.py, backend/tests/test_async_quant_pipeline.py | 글로벌 httpx.AsyncClient 풀 재사용(Keep-Alive/Limits), asyncio.Semaphore(8) 동시성 제어 기반 네이버/야후 병렬 시세 수집 및 OOM 방어 완비 (테스트 3/3 100% Pass) |
| S10-3: 전역 퀀트 인메모리 캐시 레지스트리 (QuantCacheRegistry) | ✅ done | backend/core/quant_cache_registry.py, backend/tests/test_quant_cache_registry.py | 네임스페이스 격리, Canonical SHA-256 키 생성, LRU 용량 제한(최대 300건), TTL 3600s 자동 만료 및 Render 512MB RAM 제약 대응 malloc_trim(0) 메모리 회수 탑재 (테스트 5/5 100% Pass) |
| S10-4: 퀀트 라우터 전면 마이그레이션 & E2E 무결성 검증 | ✅ done | backend/api/backtest.py, backend/api/efficient_frontier.py, backend/tests/test_sprint10_quant_engine_e2e.py | 백테스터/효율적투자선 라우터를 UnifiedQuantEngine 및 QuantCacheRegistry로 완전 마이그레이션, 0.001초 캐시 히트 및 E2E 무결성 검증 완료 (전체 217개 백엔드 테스트 100% Pass) |
| 미국 3대 인플레이션 지표 적시 수집 & 장기 시계열 DB 영속화 | ✅ done | backend/api/exit_signal.py, backend/core/overview_cache.py, backend/core/scheduler.py, backend/tests/test_us_macro_timely_sync.py | CPI/PPI/PCE 매일 08:15 KST 자동 수집, 조회 시 Stale 자동 감지 백그라운드 갱신, 장기 매크로/CLI/PE 및 시장동향 대시보드(금리/주식/환율/종합)의 SQLite DB 영속화로 반복 크롤링 원천 차단 및 5ms 내 초고속 서빙 (전체 220개 테스트 100% Pass) |
| 야간 보유종목 & 4대 벤치마크 지수 백그라운드 자동 시딩 스케줄러 | ✅ done | backend/scheduler/etf_price_sync.py, backend/core/scheduler.py, backend/tests/test_holdings_price_sync_job.py | 매일 23:15 KST 4대 벤치마크 지수(^KS11, ^KQ11, ^GSPC, ^IXIC) 및 사용자 보유 종목/수동 자산 일봉을 로컬 DB에 자동 영속화하여 신규 계좌/종목 조회 시에도 0ms DB Hit 보장 |
| 포트폴리오 시뮬레이션 & 위험지수 인터랙티브 차트 60fps 렌더링 최적화 | ✅ done | dashboard/src/components/PortfolioBacktester.tsx, EfficientFrontierPanel.tsx, KospiExitAnalyzer.tsx | Recharts Line/Scatter 컴포넌트 isAnimationActive=false 적용, 150개 포인트 다운샘플링 및 몬테카를로 1,200개 캡슐화로 브라우저 프레임 드랍 및 CPU 스파이크 원천 차단 |
| S11-1: 시뮬레이터(스트레스 테스터, 멀티 백테스터) 0ms 캐싱 & 프론트엔드 최적화 | ✅ done | backend/api/router.py, backend/api/backtest.py, dashboard/src/components/PortfolioStressTester.tsx, MultiAssetBacktester.tsx | QuantCacheRegistry 백엔드 캐시 연동(0.0001초 응답), SWR 및 localStorage 브라우저 즉시 복원, Recharts 다운샘플링 및 isAnimationActive=false 일괄 적용 완료 |
| S11-2: 포트폴리오 백테스터 모바일 와이드 뷰포트 확장 및 터치 인터랙션 개선 | ✅ done | dashboard/src/components/PortfolioBacktester.tsx | 모바일 화면 전용 차트 세로 높이 확장 토글(350px ↔ 480px, Maximize/Minimize), touch-pan-x 스크롤 충돌 방지 및 점선 터치 커서로 터치 사용성 대폭 향상 |
| S11-3: 야간 시계열 시딩 완료 알림 및 일일 포트폴리오 리스크 텔레그램 브리핑 | ✅ done | backend/core/risk_digest.py, backend/core/scheduler.py, backend/tests/test_nightly_risk_digest.py | 23:15 KST 시딩 잡 완료 즉시 탈출 신호(Exit Signal) 점수, VKOSPI/VIX, FGI 탐욕지수, 환율/DXY, 금리차 취합 후 개인 텔레그램 봇으로 일일 리포트 자동 발송 |
| S11-4: 반도체 4국면 퀀트 사이클 & AI 트렌드 통합 대시보드 | ✅ done | dashboard/src/components/SemiCycleDashboard.tsx, SemiChart.tsx, SectorInsightReport.tsx | AI 3대 트렌드 시각화 카드 융합, Q-Cycle 스크리너 전진 배치, 핵심 ETF 및 자산배분 모델 3대 탭 일원화 |
| S11-5: 반도체 퀀트 사이클 실시간 강제 재계산 | ✅ done | backend/core/semi_cycle_engine.py, backend/api/router.py, SemiCycleDashboard.tsx | ?force=true 캐시 바이패스, clear_cache(), 프론트엔드 로딩 스피너 및 갱신 토스트 배지 제공 |
| S11-6: 5대 섹터 Gemini Expert Report 주간 자동 갱신 스케줄러 | ✅ done | backend/core/scheduler.py, backend/api/sector_insight.py | 매주 월 08:20 KST 반도체/우주/에너지/바이오/소부장 순차 백그라운드 갱신 및 Rate limit 방어 |
| S11-7: 정책금리 회의(BOK/FOMC) 실시간 속보 수집 & 텔레그램 연동 | ✅ done | backend/scheduler/meeting_poll.py, backend/core/scheduler.py | 회의 당일/익일 매시 5분 KST 자동 감지, rates/macro 강제 갱신 및 이벤트 결과 확정 시 텔레그램 속보 자동 발송 |
| S11-8: 반도체 5대 산업 통계 동기화 파이프라인 | ✅ done | backend/scheduler/semi_stats_sync.py, backend/core/macro_historical_data.py | 수출액/단가/물량/가동률/재고 최신 월차 데이터 dynamic 결합 및 매월 15/25일 자동 갱신 |
| S12-1: 모바일 터치 UX 및 반응형 가로 뷰포트 최적화 | ✅ done | dashboard/src/components/SemiCycleDashboard.tsx, SemiChart.tsx, MacroTab.tsx | 반도체 4국면 시계 모바일 스케일 다운(h-[320px] sm:h-[380px]), touch-pan-x 스무스 터치 스와이프 안내 배지, Recharts 마진 최적화 |
| S12-2: 시장동향 '과거 유사국면' 동적 퀀트 앙상블 매칭 엔진 고도화 | ✅ done | backend/api/macro_dashboard.py, backend/tests/test_macro_dashboard.py, dashboard/src/components/MacroTab.tsx | 코사인 유사도(방향성) + 가중 유클리드 거리(진폭) 앙상블 매칭 엔진, 10대 역사적 경제위기/호황 국면 태깅 및 유사도(%) 정밀 연산 |
| S12-3: 타 섹터(우주항공 등) 3대 밸류체인 맵 & 퀀트 지표 확장 | ✅ done | dashboard/src/components/SpaceChart.tsx, SectorInsightReport.tsx | 우주항공 3대 밸류체인(발사체·운송/위성통신D2C/탐사·방산) 맵 & 수혜 대표주 카드 신설 및 특화 뷰 확장 |
| S12-4: 프로덕션 실서버 배포 점검 및 라이브 무결성 검증 | ✅ done | backend/api/router.py, backend/tests/ | FastAPI Query 파라미터 임포트 수정, 227개 전 백엔드 테스트 및 Next.js 11개 페이지 최적화 빌드 100% 통과 |













## Status Legend

- ✅ **done** — 기능 완전 구현, 운영 중
- 🔧 **active** — 개발/검증 진행 중
- ⬜ **planned** — 백로그, 미착수
- ⚠️ **broken** — 알려진 이슈 있음
- ❌ **dropped** — 제거됨
