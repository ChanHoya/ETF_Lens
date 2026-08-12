# Project State — ETF Lens

> **Keep this file under 200 lines.**
## Quick Summary
 
Base: Exit Strategy Monitoring (KOSPI)
✅ Current: 브라질채권 2축 맵 최근 1주일 궤적 하루씩 순차 연결 애니메이션 & 다시보기 기능 구축 완료 (2026-08-12)
➡️ Next: S6-4 ETF 배당(분배금) 정보 수집 백엔드 스크래퍼 및 API

> 세션 핸드오프 (2026-08-12):
> - ActivationZoneChart 최근 1주일 환율x금리 이동 궤적을 일자별(220ms 간격) 순차 등장 및 점선 드로잉 애니메이션 적용 완료.
> - 차트 하단 '궤적 다시보기' 버튼 추가 및 오늘 위치 도달 시 깜빡임 하이라이트 발동.
> - Git commit & push 완료 (`1d95b7e2`).
 
 
## Current Sprint
 
- Sprint: 6 — Centralized TFF Dashboard, Efficient Frontier, Dividend Calendar, & Custom Disparity Alerts
- Started: 2026-05-31
- Branch: main
 
## Story Status
 
| ID | Title | Status | Notes |
|----|-------|--------|-------|
| S6-1 | TFF 엑셀 업로드 데이터 PostgreSQL 저장 및 중앙 공유형 대시보드 | ✅ stable | 파일 데이터 PostgreSQL 저장, 마스터 인증 패스코드 및 뷰어/마스터 권한 격리 구현 완료 |
| S6-2 | 포트폴리오 Efficient Frontier 최적화 백엔드 API | ✅ stable | yfinance/pykrx 연동 기대수익률, 공분산 및 몬테카를로 포트폴리오 변동성 최적화 연산 모듈 및 유닛 테스트 구현 완료 |
| S6-3 | Efficient Frontier 시각화 및 최적 비중 연동 | ✅ stable | Recharts ComposedChart 산점도/효율전선 커브, Max Sharpe/MinVar/현재 Bento 카드, 최적 비중 BarChart 및 인사이트 요약 구현 완료 |
| S6-4 | ETF 배당(분배금) 정보 수집 백엔드 스크래퍼 및 API | ⬜ planned | Seibro/네이버페이 기반 과거 분배금 단가 및 배당 지급일/주기 크롤링 API 연산 모듈 구현 |
| S6-5 | 배당 캘린더 및 배당 Cashflow 시뮬레이션 대시보드 | ⬜ planned | 월별 배당금 캘린더 달력 뷰, 연간 누적 Cashflow 바 차트 및 총 예상 배당 수익률 카드 연동 |
| S6-6 | 괴리율 개인화 알림 설정 및 알림 채널 확장 | ⬜ planned | Disparity 임계치 설정 Slider UI 및 Slack/Discord 웹훅 발송 즉시 테스트 연동 |
| S6-7 | 계좌별 자산 증감(추이) 시각화 및 분석 | ✅ stable | KIS 일별 계좌 자산 DB 적재 및 거래내역 기반 90일 역산 복원 차트 시각화 완료 |
| S6-8 | 전력/에너지 섹터 주요 종목 현황 및 구성종목 비중 비교 | ✅ stable | 3분할 탭 개편(국내주식/해외주식/해외상장) 및 GRID 등 미국 상장 6종 추가, 통화 분기 표기 연동 완료 |
| S6-9 | 차기 주도주 발굴 및 10대 대안 섹터 퀀트 스크리너 | ✅ stable | 양극화 지수, M7 CAPEX, 반도체 이격 신호등 및 10대 테마 퀀트 스크리너 구현 완료 |
| S6-10 | 주요 4대 시장 섹터별 주가 흐름 격자 (Sector Flow Grid) | ✅ stable | KOSPI, KOSDAQ, S&P 500, NASDAQ 대표 32종 ETF/지수의 1년 누적수익률 라인 차트 및 absolute SVG 화살표 오버레이 격자판 구현 완료 |
| S6-11 | 반도체 ETF 구성종목 변동 그래프 및 전문가 리포트 개편 | ✅ stable | 12종 반도체 ETF 3대 탭 스위칭, 구성종목 점선 차트 오버레이, 괴리율 및 실시간 프리마켓 예상가 연동 테이블, 3대 탭 Gemini Expert Report 통합 완료 |
| S6-12 | 우주항공 섹터 전문가 리포트 및 상관관계 매트릭스 하이라이트 | ✅ stable | SpaceChart 전문가 리포트 3개 탭 추가 및 상관관계 분석 매트릭스 내 가로/세로 하이라이트 박스 고도화 완료 |
| S6-13 | 섹터분석 정렬 순서/명칭 갱신 및 조선/소부장 대체 | ✅ stable | 대시보드 섹터 재배치 및 AI전력 개명, 조선/반도체소부장 틱커 대체 매핑 완료 |
## Module Registry
 
| Module | Layer | Status | Key Files |
|--------|-------|--------|-----------|
| Notification Settings | Shared | ✅ stable | core/notifier.py, api/notification_settings.py, components/NotificationSettings.tsx |
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
| Asset History Tracking | Hybrid | ✅ stable | api/my_assets.py (asset-history), AssetHistoryChart.tsx |

## Technical Decisions

- KIS API: 초당 1건 제한 → sleep(1.2) 필수, EGW00133 → sleep(2.5) 후 재시도
- PostgreSQL: Render $7/월 유료 (90일 만료 없음), Internal URL 사용
- 캐시: 포트폴리오 5분 인메모리, ETF 마스터 5분 캐시
- 클라이언트 Excel 파싱: XLSX.js (서버 업로드 없음)

- 2026-05-26: 미국 증시 개장 전 KST 낮 시간대의 미-한 시차 문제로 당일 미국 가격 데이터가 누락되는(None) 상황에서 SectorStatusGrid의 변동률이 NaN%로 연산되는 현상을, 각 티커별로 최근 유효 거래일 2개 시점을 추적해 연산하도록 프론트엔드 버그 수정 완료.
- 2026-05-26: 우주섹터 비교 대상을 글로벌로 확장하기 위해 미국 우주 ETF 5종(UFO/MARS/NASA/ORBX/WARP)을 추가하고, 차트 범례의 국가별 분리 배치(국내 윗줄 / 미국 아랫줄) 및 테이블 내 한/미 마켓 토글 전환에 따른 종목 비중 동적 렌더링 필터링 구현 완료
- 2026-05-26: AI Assistant 프롬프트 내 사용자 보유 종목 목록 생성 시, 다계좌 중복 보유 종목의 수량 및 평가금액, 평가손익을 단일 종목으로 병합/합산하고 가중평균 수익률을 연산하여 제공하도록 핫픽스 완료 (중복 종목으로 인한 AI 연산 오류 해결)
- 2026-05-23: 포트폴리오 스트레스 테스터 백엔드 퀀트 엔진 및 API 개설 완료
- 2026-05-23: 원/달러 환율 10년치(2,652건) 적재 및 환헤지 vs 환노출 비교 분석기, 복리 절세 시뮬레이터(ISA/연금) Bento UI 구축 완료
- 2026-05-21: 미국 주요 매크로 인플레이션 지표 (CPI, PPI, PCE YoY) Recharts 네온 라인 차트 및 SWR 로컬 캐싱 고도화 완료
- 2026-05-20: KIS API Rate Limit (EGW00133) 발생 시 무한 루프로 빠지며 Render 100초 타임아웃을 유발하던 문제를 `return None` 대신 `continue`로 교체하여 다른 키로 즉시 우회 순회하도록 핫픽스
- 2026-05-20: 텔레그램 알림 테스트 전송 시 DB에 저장된 값을 덮어쓰거나 무시하던 문제를 test_token 파라미터 격리로 수정하고, 401 Unauthorized 등 상세 API 오류 문구를 화면에 바로 표출하여 유효성 진단 고도화
- 2026-05-19: KOSPI Exit Strategy 모니터링 대시보드 로컬 스토리지 SWR 캐싱 도입 완료 (0ms 즉시 렌더링 보장 및 백그라운드 갱신 패턴 적용)
- 2026-05-19: 종합위험지수(RiskGaugeChart) 극단적 소형화 레이아웃 최적화 완료 (종합위험지수 세로 크기 축소, 달러 차트 잘림 해결, FGI 색상 반전) 완료
- 2026-05-19: KOSPI Exit Strategy 모니터링 (Exit-Signal) 대시보드 박스 구조 및 리스크 게이지 UI 리팩토링 및 개선 완료
- 2026-05-19: S3-3 AI Insight 실데이터 연동 고도화 및 실제 성과 지표 동적 배지(✨ 실제 성과 지표 반영됨) 전환 구현 완료
- 2026-05-19: 섹터분석 탭 SWR LocalStorage Caching 성능 극대화 고도화 완료 (0ms 즉시 로딩 보장 및 백그라운드 갱신 패턴 적용)
- 2026-05-17: S1-12 개별종목 팝업 차트 캘린더 날짜 기준 정합성 필터링 및 전체 차트 우측 Y축 (orientation='right') 쏠림 개선 완료
- 2026-05-17: S1-12 개별종목 상세 미국 우주섹터(ARKX) 지수 비교 및 최근 3개월 언론보도 벤토 카드 연동 완료
- 2026-05-17: 즐겨찾기 우주섹터 비교 오류 해결 및 종목비교 standardisation 완료 (ARKX yfinance 연동 및 KR space ETF holdings fallback 지원)
- 2026-05-17: 섹터분석 탭 내의 폰트 스케일을 조화롭게 일원화 완료 (박스 바깥은 text-xl 큰 폰트, 박스 내부는 text-base 작은 폰트 적용)
- 2026-05-17: 우주 섹터 클릭 시 KODEX 미국우주항공 등 4대 우주 ETF 주요 종목 현황을 비교 분석하는 '우주 특화 분석' 및 SpaceChart 컴포넌트 추가 완료
- 2026-05-17: 상관관계 분석 히트맵을 [-1.0(Rose 빨간색), 0.0(Amber Yellow 500 선명한 노란색), +1.0(Emerald 초록색)] 구성의 continuous RGB 그라데이션으로 리디자인하고 100% 완전 불투명(Solid) 배경과 고대조 어두운 텍스트를 매핑하여 다크 테마에서의 완벽한 색상 시인성 보완 완료
- 2026-05-17: 상단 섹별 비교 Bento 카드의 텍스트 폰트 및 아이콘 스케일을 약 1.5배 상향하여 시각적 인지성과 가독성 고도화 완료
- 2026-05-17: 포트폴리오 트리맵의 얇은/좁은 셀(두께 3칸 미만)에서 종목 정보, 등락률, 보유 비중이 한 줄로 병합 노출되도록 렌더링 최적화 완료
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
| Sprint 5 | S5-14 | TFF 종목별 수익률 엑셀 원본 테이블 구현 및 예수금 핫픽스 | 2026-05-31 |
| Sprint 5 | S5-13 | 실시간 괴리율 경보 5단계 투자지침형 등급 체계 개편 | 2026-05-31 |
| Sprint 5 | S5-12 | ETF 구성종목(CU) 데이터 보완 및 yfinance dynamic holdings 연동 | 2026-05-28 |
| Sprint 5 | S5-11 | 상세 모달 내 실제 과거 NAV 데이터 프론트엔드 연동 및 1D 차트 마감 상태 표시 | 2026-05-28 |
| Sprint 5 | S5-10 | ETF 괴리율(NAV Gap) 실시간 모니터링 및 텔레그램 알림 시스템 구축 | 2026-05-28 |
| Sprint 5 | S5-9  | 우주섹터 구성종목 테이블 우측에 당일 실시간 가격 / 전일대비 변동률 정보 연동 | 2026-05-28 |
| Sprint 5 | S5-8  | 포트폴리오 현황 트리맵 및 대시보드 뷰 매수/수익금액 정보 추가 및 색상 매핑 고도화 | 2026-05-28 |
| Sprint 5 | S5-7  | 우주섹터 미국 신규 ETF 5종 연동 및 한/미 마켓 토글 테이블 고도화 | 2026-05-26 |
| Sprint 5 | S5-6  | My 탭 내 보유 자산 정보 기반 AI Assistant 서비스 연동 및 바로가기 위젯 추가 | 2026-05-26 |
| Sprint 5 | S5-5  | 바이오 섹터 특화 분석 개발 | 2026-05-26 |
| Sprint 5 | S5-4  | 우주 ETF 구성종목 변동 그래프 및 개별 주식 팝업 연동 | 2026-05-24 |
| Sprint 5 | S5-1  | 포트폴리오 역사적 위기 스트레스 테스터 엔진 및 API 연동 | 2026-05-23 |
| Sprint 5 | S5-2  | 원/달러 환율 연동 환헤지 vs 환노출 비교 분석 | 2026-05-23 |
| Sprint 5 | S5-3  | ISA 및 연금저축/IRP 과세이연 및 절세 혜택 시뮬레이터 | 2026-05-23 |
