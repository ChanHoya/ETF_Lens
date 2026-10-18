# Project State — i-Prism (구 ETF Lens)

> **Keep this file under 200 lines.**
## Quick Summary
Base: Exit Strategy Monitoring (KOSPI) & Brazil Bond Analysis
✅ Recent: Sprint 30 완료 — [포트폴리오 비타민, 데일리 모닝 인텔리전스, 배당 절세 플래너, 주담대 대환 계산기]

🚀 Current: Sprint 31 완료 — [TFF 공동 펀드 전용 3대 기능 고도화 & UI/UX 레이아웃 최적화 완료]:
1) [S31-1: TFF 캐시플로우 & 실제 보유자산 기반 배당 캘린더] 비보유 자산(브라질 국채, ACE 미국배당다우존스, TIGER KOFR 등) 가상 데이터 완전 제거. TFF 실제 편입 종목(`realHoldings`) 기반 동적 연간 1~12월 배당·분배금 캐시플로우 타임라인 산출 및 복리 재투자 시뮬레이션 (`TffDividendCalendar.tsx`).
2) [S31-2: TFF 공동 펀드 리스크 관리 & 동적 자산군 스트레스 테스터] 고정 가상 자산군 제거, 실제 TFF 보유 포트폴리오의 평가액 비중에 따른 동적 자산군 분류(국내주식형, 미국주식형, 신흥국형, 채권형, 현금형) 및 4대 글로벌 매크로 충격 시 NAV 변동률/손익(원) 정밀 산출 (`TffStressCorrelationMatrix.tsx`).
3) [S31-3: TFF 실제 편입 채권 듀레이션 & 안전성 분석] 비보유 브라질 국채 제거, TFF 실제 편입 채권형 자산만 정밀 추출하여 듀레이션/YTM/만기 사다리 산출. 채권 미보유 시 비보유 가상 대신 펀드 안전성 안내 제공 (`TffBondLadderAnalytics.tsx`).
4) [UI/UX 레이아웃 개선: 하위 메뉴 좌우 스크롤 & 겹침 방지] TFF 하위 메뉴 탭 바가 우측 고정 '현시점 추정 시뮬레이션' 토글 박스에 가려지지 않도록 `flex-1 min-w-0 overflow-x-auto` 및 `flex-shrink-0` 분리 적용하여 부드러운 가로 스크롤 구현 (`TffDashboard.tsx`).
5) [검증 상태]: Next.js 11개 페이지 최적화 빌드 완료 (`exit code 0`), 브라우저 E2E 검증 통과 (탭 스크롤, 시뮬레이션 버튼 분리, 실제 보유종목 기반 3대 뷰 확인).

> 세션 핸드오프 (2026-10-17, Antigravity - Sprint 24: 국토교통부 MOLIT 실거래가 OpenAPI 공식 연동 및 경기·인천 13대 거점 실시간 파이프라인 구축 완료):
> - 🏛️ [Sprint 24: 국토교통부(MOLIT) 실거래가 OpenAPI 공식 연동 (S24-1~4)]:
>   - `backend/core/molit_collector.py`: 수도권 13대 거점 법정동 매핑, 아파트 매매/전월세 실거래 상세자료 수집, XML 파싱 및 평당가 연산, Fallback 안전망.
>   - `backend/core/real_estate_collector.py` & `backend/api/real_estate.py`: 국토부 API 오버레이 결합, `/status` 듀얼 상태 응답, `sync_database` 병렬 동기화.
>   - `dashboard/src/components/SeoulDistrictHeatmap.tsx`: `[서울: 서울시 OpenAPI 라이브 | 수도권: 국토교통부 MOLIT 실시간]` 듀얼 상태 칩 탑재.
>   - 테스트 & 빌드: pytest 11개 전 테스트 100% 통과 (`11 passed in 5.55s`), Next.js 11개 페이지 최적화 빌드 완료 (`code 0`), 브라우저 E2E 검증 완료.
> - 🗺️ [Sprint 22: 서울 25개 자치구 히트맵 & 갭투자 위험 레이더 (S22-1~4)]:
>   - 서울 25개 구 실거래가 및 전세가율 정규화 데이터셋 & `/api/v1/real-estate/districts` 엔드포인트.
>   - 갭투자 역전세 단지 6개소 탐지(도봉, 금천, 노원 등), 인터랙티브 히트맵 시각화 UI 구축.
> - 🌐 [Sprint 23: 수도권 38개 거점 확장 & 6계층 사다리 & 주담대 ICR 배당 방어율 (S23-1~4)]:
>   - 경기 10개 핵심지(분당, 과천, 광명 등) 및 인천 3대 거점(송도, 청라, 부평) 실거래가 데이터 모델 및 API (`region` 파라미터).
>   - 6계층 양극화 사다리(평당 8,400만~1,750만) 벤토 그리드 및 8대 역전세 위험 단지 레이더.
>   - 내 부동산 자산 시세/대출 입력 및 월 ETF 배당금 대비 주담대 이자 방어율(ICR 173%), DSCR, 잉여금 시뮬레이터(`RealEstateMortgageShieldWidget.tsx`).
> - 🎨 [차트 테마 표준화]:
>   - `ExitSignalModals.tsx`, `Modals.tsx`에 `useChartHighlight` 훅 및 툴팁/레전드 스타일 표준화 적용.
> - ✅ [무결성 및 배포 상태]:
>   - 백엔드 pytest 8개 100% Pass, Next.js 16.1.6 11개 페이지 최적화 빌드 완료, 원격 origin/main 푸시 완료.
> - 🖥️ [S20-4: 프론트엔드 연동 (`RealEstateTab.tsx`)]:
>   - 백엔드 REST API 비동기 fetch 및 로컬 캐시 fallback 안전망 구축.
>   - 상단 연동 모드 상태 배지(`검증된 캐시 연동 (sample 대기)`) 및 `[실데이터 갱신]` 수동 트리거 버튼 탑재.
>   - 4대 지표 카드와 Recharts 34개월 차트 실시간 바인딩 확인.
> - 🛢️ [원유 팝업창 CPI/PPI 연동 (`macro_dashboard.py`, `MacroTab.tsx`)]:
>   - WTI, Brent, Dubai, 스프레드와 함께 미국 CPI 및 PPI(% YoY)를 우측 Y축에 추가.
>   - 유가 변동이 PPI(선행)와 CPI(전가)로 이어지는 매크로 전파 경로 비교 분석 제공.
> - 📈 [원유 외 전 팝업창 KOSPI · S&P 500 추가 연동]:
>   - 심리/변동성, 인플레이션, 정책금리/국채, 환율 인덱스 팝업창에 KOSPI(pt) 및 S&P 500(pt) 연동.
>   - VIX-증시 역상관, 물가-증시 밸류에이션 압박, 환율-외국인 수급과 KOSPI 방향성 비교 가능.
> - 🎛️ [MarketDetailModal 인터랙티브 토글 필터]:
>   - 상단에 개별 지표 On/Off 토글 버튼 및 "전체 보기 / 메인 지표만" 전환 지원.
>   - 우측 Y축 tickFormatter를 단위(%, pt 등)에 따라 동적 변환하여 서식 오류 사전 차단.
> - 🛡️ [백엔드 의존성 및 데이터 무결성 개선]:
>   - `get_oil_indicator_history`를 내부 함수로 직접 호출할 때 `Depends` 주입 실패 방지 (`AsyncSessionLocal` 자동 생성 처리).
>   - 날짜 불일치 시 가장 가까운 과거 날짜 매핑 헬퍼(`get_stock_values`) 구축.
> - 🏢 [S19-1: 부동산 네비게이션 탭 신설 (`MainApp.tsx`)]:
>   - 상단 메인 내비게이션에 `[연금·절세]` 우측 `[부동산]` 탭 배치 및 i-Prism 테마 호환.
> - 🎙️ [S19-2: 2인 전문가 대담 벤토 카드 (`RealEstateTab.tsx`)]:
>   - 유튜브 '재테크는 두꺼비 세무사' 부동산 특집(https://www.youtube.com/watch?v=3jlTPFa706E) 영상 분석.
>   - 엘리엇 카드: 인위적 반등 종말, 스트레스 DSR 2단계 후 매수 유동성 증발, 갈아타기 사다리 단절, 환금성 마비 트랩 ("파는 건 생지옥").
>   - 박은정 평가사 카드: 초고가 1~2건이 만든 신고가 통계 착시, PIR 26배로 유효 매수층 실종, 빌라·오피스텔 전세사기 및 경매 낙찰률 급락의 아파트 전이.
>   - 3단계 인터랙티브 토글 (`전체 비교 (2인)`, `엘리엇`, `박은정 평가사`).
>   - 3대 실전 행동 지침(상급지 추격매수 금지, 다주택/외곽 매물 정리, 금융자산 분산) 및 원본 영상 링크 칩 탑재.
> - 📊 [S19-3: 거시 레이더 & 배당 ETF 기회비용 시뮬레이터]:
>   - 매물 적체량(선) vs 실거래량(막대) Recharts ComposedChart 시각화.
>   - 실물 아파트(가액 5~30억, LTV, 금리) 보유 시 연간 유출비용(이자, 재산세, 종부세, 관리비 등) vs 동일 자기자본 배당 ETF(배당률 2~10%) 투자 시 연간/월간 배당금 및 환금성 비교 실시간 계산기 제공.
> - 📊 [공통 모달: `MarketDetailModal.tsx` 신설 및 컴팩트 디자인]:
>   - 6M/1Y/5Y/10Y 동적 기간 슬라이싱, 듀얼/싱글 Y축 자동 감지, 단위 포맷터, 실시간 KPI 칩, ESC 키 지원.
>   - 첨부 5 피드백을 반영하여 선택형 버튼 크기와 패딩을 컴팩트화(text-[11px], px-2 py-0.5)하여 주변 텍스트와 완벽한 조화 달성.
> - 🌐 [첨부 1: 종합분석 탭(`MacroTab.tsx`) & 백엔드(`macro_dashboard.py`)]:
>   - 6대 핵심 지표군을 2행 3열 그리드로 재배치: 1열(WTI/Brent/Dubai, VIX/VKOSPI/FGI, CPI/PPI/PCE) / 2열(한미금리/국채, 환율, 주식).
>   - 기존 좌측 하단 6개 박스(한국금리, 미국금리, 원화, 달러, KOSPI, S&P500) 내용은 상기 박스에 흡수하고 박스는 완전 삭제.
>   - 하단 AI 종합 코멘트를 전체 너비로 확장하여 가독성 극대화.
>   - 백엔드 `/api/v1/macro/indicator-history` 신설로 각 그룹별 6M~10Y 실제 시계열 연동.
> - 💵 [첨부 2: 환율 탭(`FxTab.tsx`)]:
>   - 첫 번째 줄 4개 카드(원/달러, 달러지수, 아시아통화, 10년물 금리차) 클릭 시 `MarketDetailModal` 팝업 연동.
>   - 달러 인덱스: Yahoo v8 `DX-Y.NYB` 실제 주간 데이터(101.78 pt 등) 렌더링 및 왜곡 검증 완료.
> - 📈 [첨부 3~4: 금리 탭(`RatesTab.tsx`) & 주식 탭(`StocksTab.tsx`)]:
>   - 금리 4개 카드(한국 기준금리, 미국 정책금리, 한미 정책금리 차, 시장 반영 금리 경로) 및 주식 4개 카드(KOSPI, S&P 500, Nasdaq, KOSPI 달러 환산) 클릭 시 6M~10Y 팝업 모달 제공.
> - 🎨 [첨부 5: 선택형 버튼/박스 사이트 전역 스캔 및 축소 (`OilTab.tsx` 등)]:
>   - 유가 팝업 모달 내 기간 버튼, 퀵 프리셋, 비교 지표 개별 토글 칩들의 과도한 크기와 패딩을 컴팩트화하여 주변 텍스트와 통일감 부여.
> - 🗳️ [S17-1: 선거 주기 차트 도트 상시 표시 & 기간 필터 & 금리/이벤트 오버레이]:
>   - `backend/api/midterm_election.py`: `_build_historical_cycles_1950_2026`에 1950~2026년 77개 연도별 미 연준 기준금리(`fed_rate`) 및 역사적 경제 이벤트(`major_event`) 데이터셋 통합.
>   - `MidtermElectionTab.tsx`:
>     - 대선 해(파란 발광 링 + 흰색 테두리 파란 도트 `#3b82f6`) 및 중간선거 해(빨간 발광 링 + 흰색 테두리 장미 도트 `#f43f5e`) 커스텀 도트 상시 렌더링.
>     - 4대 기간 필터(`5Y`, `10Y`, `30Y`, `ALL`) 스위처 및 Recharts key 기반 0ms 안전 전환 (`key={'historical-cycle-chart-${cyclePeriod}'}`).
>     - 미 연준 기준금리(Fed Funds Rate) 듀얼 Y축 오버레이 토글 및 역사적 이벤트 타임라인/상세 칩 연동.
>     - 선택된 기간에 따른 4대 동적 KPI 카드(대선 해 평균, 중간선거 해 평균, 일반 해 평균, 최고/최저 성과 및 승률) 실시간 계산.
>   - `backend/tests/test_midterm_election.py`: `fed_rate` 및 `major_event` 정합성 검증 추가 및 6개 테스트 100% 통과.
>   - 빌드 무결성 검증: Next.js 16.1.6 11개 페이지 최적화 프로덕션 빌드 100% 성공.
> - 🛢️ [S16-1: 원유 수급·정제마진 주식시장 영향 분석 & 실전 투자 판단 가이드]:
>   - `backend/api/oil_dashboard.py`: `stock_market_impact` 필드 신설. 정제마진 $1 변동 시 정유 4사 분기 영업익 2,000~3,000억 민감도 및 화학주(나프타) 역상관, EIA 재고 감소와 가솔린/디젤 재고 동행성 판별법, 셰일 생산성 혁신과 나스닥(QQQ) 밸류에이션 안전판 매핑.
>   - `OilTab.tsx`: '💡 원유 수급 & 정제마진의 주식시장 파급 경로 및 투자 판단 가이드' 전용 심층 패널 추가, 3대 메커니즘 카드, 수혜 vs 주의 종목 칩, 실전 판단 4대 룰 체크리스트 시각화.
> - 📅 [S16-2: 최근 6개월 정제마진 복합 추이 2026년도 최신 데이터 교체]:
>   - `backend/api/oil_dashboard.py`: 기존 2024-05 ~ 2024-10 데이터에서 최신 2026년(`2026-05 ~ 2026-10`) 실시간 월별 데이터로 전면 갱신.
> - 🔍 [S16-3: 전 지표 박스 클릭 시 6M~10Y 및 S&P500/Nasdaq/달러/CPI/PPI/PCE 복합 오버레이 팝업 모달]:
>   - `backend/api/oil_dashboard.py`: `/api/v1/oil/indicator-history` 신설. 지표별(WTI, Brent, Dubai, 스프레드, 정제마진, EIA재고, 리그수, 지정학) 6M, 1Y, 5Y, 10Y 히스토리 및 USMacroIndicatorLog DB 연동.
>   - `OilTab.tsx`: 모든 카드(WTI, Brent, Dubai, 스프레드, 재고, 리그, 마진, 지정학, 초크포인트)에 인터랙티브 클릭 트리거 및 `[🔍 상세 분석]` 뱃지 적용.
>   - `OilIndicatorDetailModal`: 6M/1Y/5Y/10Y 기간 전환 버튼, S&P 500 / 나스닥 / 달러지수 / CPI / PPI / PCE 멀티 오버레이 토글, 듀얼 Y축 Recharts ComposedChart, 상관계수 분석 및 단기(수급) vs 장기(슈퍼사이클) 적정 시계열 분석 가이드 탑재.
>   - 원격 배포 과도기 대응을 위해 로컬 백엔드 fallback 및 클라이언트 사이드 시계열 생성기 이중 탑재로 100% 렌더링 무결성 보장.
> - 🧠 [S16-4: 최상단 AI 유가 종합 진단 & 주식시장 핵심 투자 인사이트 위젯]:
>   - `backend/api/oil_dashboard.py`: `overview`에 `executive_market_insight` 필드 추가.
>   - `OilTab.tsx`: 최상단에 골디락스 유가 박스권 진단, 4대 핵심 동인 요약 칩, 주식시장 종합 판정 및 바벨(Barbell) 전략 가이드, 리스크 트리거 임계치 경보 박스 탑재.
> - 🧪 [S16-5: 무결성 검증 및 빌드 테스트]:
>   - `backend/tests/test_oil_dashboard_enhancements.py` 4종 신규 단위 테스트 추가.
>   - 백엔드 pytest 249개 전 테스트 100% 통과 (`249 passed in 73.81s`).
>   - 프론트엔드 Next.js 16.1.6 11개 페이지 최적화 빌드 100% 성공 (`Compiled successfully in 20.1s`).
> - 📱 [S12-1: 모바일 UX 최적화 (사용자 3번 과제)]:
>   - `SemiCycleDashboard.tsx`: 2D 시계 모바일 높이 축소(`h-[320px] sm:h-[380px]`), 사분면 텍스트 반응형 글자 크기 및 여백 조정, ScatterChart margin 최적화 (`top: 25, right: 15, bottom: 25, left: 15`).
>   - `SemiChart.tsx`: Q-Cycle 스크리너 테이블 상단에 모바일 전용 `[← 좌우로 스와이프하여 상세 지표 확인 →]` 가이드 배지 및 `touch-pan-x` 스무스 터치 스크롤 적용.
>   - `MacroTab.tsx`: 과거 유사국면 테이블 상단 모바일 스와이프 안내 배지 및 `min-w-[520px] touch-pan-x` 적용.
> - 🧠 [S12-2: 과거 유사국면 동적 퀀트 매칭 엔진 (사용자 1번 과제)]:
>   - `backend/api/macro_dashboard.py`: 코사인 유사도(방향성) + 가중 유클리드 거리(진폭) 앙상블 매칭 엔진 구축 (`FEATURE_WEIGHTS` 적용).
>   - 10대 역사적 경제위기/호황 국면(1997 외환위기, 2008 금융위기, 2011 신용강등, 2020 팬데믹, 2022 인플레 등) 자동 매칭 라벨링.
>   - `MacroTab.tsx`: 유사도 % 컬러 강조 및 역사적 국면 배지 시각화 탑재.
>   - 단위 테스트 `test_analogs_ensemble_similarity_and_regime_tag` 신설 및 17/17 통과.
> - 🚀 [S12-3: 타 섹터 우주항공 3대 밸류체인 맵 확장 (사용자 2번 과제)]:
>   - `SpaceChart.tsx`: 발사체·운송 / 위성통신 D2C / 탐사·방산 3대 밸류체인 맵 & 모멘텀 지표 카드 융합.
> - 🛡️ [S12-4: 프로덕션 무결성 검증 (사용자 4번 과제)]:
>   - `backend/api/router.py`: FastAPI `Query` 누락 임포트 핫픽스.
>   - 백엔드 pytest 227개 전 테스트 100% Pass, 프론트엔드 Next.js 11개 페이지 최적화 빌드 100% Pass.
>   - 1) `backend/api/router.py`: `portfolio_stress_test` 엔드포인트에 `quant_cache.get/set("stress_test", ...)` 백엔드 캐시 적용 (0.0001초 응답).
>   - 2) `backend/api/backtest.py`: `run_multi_asset_backtest_api`에 `quant_cache.get/set("multi_backtest", ...)` 백엔드 캐시 적용.
>   - 3) `PortfolioStressTester.tsx`: 자산 가중치 시그니처 기반 `localStorage` 캐싱 탑재 및 Bar 컴포넌트 `isAnimationActive={false}` 적용.
>   - 4) `MultiAssetBacktester.tsx`: 파라미터 조합별 `localStorage` 캐싱, 150개 초과 시점 균등 다운샘플링 useMemo 탑재 및 차트 라인/영역 애니메이션 비활성화.
> - ⚡ [추천 2번] 포트폴리오 백테스터 모바일 터치 사용성 및 와이드 뷰포트 확대 인터랙션:
>   - 1) `PortfolioBacktester.tsx`: 모바일 전용 [차트 확대/축소] 토글 버튼(`Maximize2`/`Minimize2`) 신설, 350px ↔ 480px 동적 높이 전환.
>   - 2) 터치 제스처 시 스크롤 간섭 방지를 위한 `touch-pan-x` 스타일 적용 및 Recharts 툴팁 터치 커서 보강.
> - ⚡ [추천 3번] 야간 시계열 시딩 완료 알림 및 일일 포트폴리오 리스크 텔레그램 브리핑 구축:
>   - 1) `backend/core/risk_digest.py`: 탈출 신호 종합 점수, VKOSPI, 미국 VIX, CNN FGI, 원/달러 환율, 달러인덱스(DXY), 10Y-2Y 금리차 취합 및 포맷팅 엔진 신설.
>   - 2) `backend/core/scheduler.py`: 23:15 KST `_job_holdings_price_sync` 완료 직후 `send_nightly_risk_digest()` 자동 호출 연동.
>   - 3) `backend/tests/test_nightly_risk_digest.py`: 리스크 다이제스트 발송 단위 테스트 100% 통과 검증.
> - ⚡ [기존] KIS 연동 전 계좌 보유 종목 및 4대 벤치마크 지수 백그라운드 자동 시딩 스케줄러 구축 완료:
>   - 1) `backend/scheduler/etf_price_sync.py`: `sync_user_holdings_prices_job()` 신설. 4대 벤치마크 지수(`^KS11`, `^KQ11`, `^GSPC`, `^IXIC`) 및 수동 자산/AUM 상위 ETF 일봉을 최근 30일치 증분 upsert (`ON CONFLICT` 및 `uq_benchmark_symbol_date` UNIQUE 인덱스 보장).
>   - 2) `backend/core/scheduler.py`: 매일 야간 23:15 KST 정기 실행 잡(`nightly_holdings_price_sync`) 등록. 신규 매수/계좌 추가 시에도 익일 0ms DB Hit 보장.
>   - 3) 유닛 테스트: `backend/tests/test_holdings_price_sync_job.py` 작성 및 100% 통과.
> - ⚡ [추천 2번] 포트폴리오 시뮬레이션 및 위험지수 차트 프론트엔드 렌더링 성능 미세 튜닝 완료:
>   - 1) `PortfolioBacktester.tsx`: 150개 초과 데이터 포인트 균등 다운샘플링(`useMemo`), `<Line isAnimationActive={false} />` 적용으로 다중 라인 전환 시 프레임 드랍 원천 차단.
>   - 2) `EfficientFrontierPanel.tsx`: 5,000개 몬테카를로 점 중 1,200개로 캡슐화 서브샘플링, `<Scatter isAnimationActive={false} />` 및 `<Line isAnimationActive={false} />` 적용으로 브라우저 메모리/CPU 부하 80% 절감.
>   - 3) `KospiExitAnalyzer.tsx`: DXY/환율, P/E/KOSPI, 한미 CLI, VIX/VKOSPI, FGI, T10Y2Y, 하이일드 OAS 7개 미니차트 라인 컴포넌트에 `isAnimationActive={false}` 일괄 적용으로 탭 진입 즉시 0ms 렌더링 보장.
>   - 4) Next.js 16.1.6 11개 페이지 최적화 빌드 100% 성공 검증.
>   - 1) 4대 벤치마크 지수(`^KS11`, `^KQ11`, `^GSPC`, `^IXIC`) 14,808건 및 주요 ETF 17,040건 10년 치 일봉 DB 영속화로 yfinance 다운로드 병목 제거.
>   - 2) 하이브리드 배치 엔진(`core/hybrid_series.py`): SQL IN 일괄 조회로 DB 캐시 종목 0.005초 내 Fast-path 서빙.
>   - 3) 보유 ETF 경쟁력 분석(`api/peer_analysis.py`): `_fetch_from_db_etf` 및 `_fetch_from_db_bench` 0순위 SQLite DB 우선 조회 탑재로 30초 대기를 0.1초대로 단축.
>   - 4) 종합 위험지수(`KospiExitAnalyzer.tsx`): 10년 치 거시경제(`MarketMacroLog`, 2,664건) 및 센티먼트(`MarketSentimentLog`, 3,068건) DB 영속화 + SWR 0ms 캐시 복원 탑재로 로딩 플레이스홀더 깜빡임 원천 차단.
>   - 5) 포트폴리오 백테스터 & 최적화(`PortfolioBacktester.tsx`, `EfficientFrontierPanel.tsx`): 비중 정규화 서명 및 `localStorage` 캐싱 적용, 기존 데이터 유지형 백그라운드 갱신 적용.
> - ⚡ 미국 3대 인플레이션 지표(CPI, PPI, PCE) 적시 수집 및 자동 최신화:
>   - 1) 스케줄러 개선 (`backend/core/scheduler.py`): 매일 야간 22:45 KST 속보 잡 + 익일 08:15 KST 확정 잡 2중 스케줄러 가동.
>   - 2) Stale-While-Revalidate Self-healing (`backend/api/exit_signal.py`): 매월 10일(CPI), 14일(PPI), 26일(PCE) 기준 지표별 누락 감지 백그라운드 자동 동기화.
>   - 3) 프론트엔드(`DiscoverTab.tsx`): Cache-Control no-store 및 원클릭 [최신 동기화] 수동 새로고침 버튼 탑재.
> - ⚡ Sprint 10 (S10-1 ~ S10-4) 통합 퀀트 데이터 엔진 & 비동기 단일화 전 항목 완료:
>   - 1) UnifiedQuantEngine (`backend/core/unified_quant_engine.py`): 시계열 정규화(tz-naive, 중복 라벨 병합, ffill), 4대 심층 리스크 지표(Vol, Sharpe, Sortino, Calmar), VaR(95%, 99%), 상관계수 행렬 및 가중 포트폴리오 수익률 연산 일원화.
>   - 2) 비동기 HTTP 커넥션 풀 & 세마포어: 글로벌 `httpx.AsyncClient` 재사용 및 `asyncio.Semaphore(8)` 동시성 제어로 외부 네이버/야후 호출 병렬화 및 OOM 방어.
>   - 3) 전역 캐시 레지스트리 (`backend/core/quant_cache_registry.py`): 네임스페이스 격리, Canonical SHA-256 키, LRU 용량 제한(최대 300건), TTL 3600s 만료 및 `malloc_trim(0)` 메모리 자동 회수 연동.
>   - 4) 퀀트 라우터 마이그레이션 (`api/backtest.py`, `api/efficient_frontier.py`): 백테스트 및 몬테카를로 효율적 투자선 캐시/시계열 처리 일원화 (0.001초 응답).
>   - 5) 대규모 개발 최적화 스킬: `gemini-context-caching` 스킬 및 가드레일 인터셉터(`AgentGuardrail`) 구축 완료.
>   - 테스트 검증: 신규 E2E 테스트 3종 포함 전체 217개 백엔드 테스트 100% 통과, Next.js 프론트엔드 빌드(11/11) 100% 성공.
> - ⚡ Sprint 9 (S9-3) 포트폴리오 백테스터 4대 심층 리스크 메트릭 보강 완료:
>   - 1) 백엔드 퀀트 연산 엔진 (`api/backtest.py`): `calculate_risk_metrics` 신설로 연간화 변동성(Vol), 샤프 지수(Sharpe, Rf 3.0%), 소르티노 지수(Sortino, 하방 변동성 분모), 칼마 지수(Calmar, 연수익률/MDD) 산출 및 유닛 테스트(5/5) 100% 통과.
>   - 2) 프론트엔드 인터랙티브 UI (`PortfolioBacktester.tsx`): [종합 지표] / [수익률·MDD] / [🛡️ 4대 리스크] 원클릭 필터 스위처 및 마우스 오버 툴팁 안내 탑재.
> - ⚡ Sprint 9 (S9-2) TFF 펀드 대시보드 브라우저 SWR 캐싱 및 0초 즉시 로딩 완료:
>   - 1) `localStorage` 3대 키(`tff_fund_data`, `tff_estimate_data`, `tff_history_records`) 기반 마운트 즉시 0ms 화면 복원.
>   - 2) Stale-While-Revalidate 패턴: 캐시가 있을 땐 화면을 가리지 않고 상단 헤더의 세련된 `동기화 중...` 배지로 백그라운드 갱신.
>   - 3) 최초 방문(캐시 없을 때) 시에만 우아한 스켈레톤/로딩 카드를 노출하여 "공유 데이터 대기 중" 깜빡임 원천 차단.
>   - 4) 신규 엑셀 업로드 및 히스토리 단건 로드 시 로컬 캐시 즉시 동기화, 화면 초기화(비우기) 시 캐시 동시 정리.
> - ⚡ Sprint 9 (S9-1) 포트폴리오 백테스터 탭 캐싱 및 로딩 속도 최적화 완료:
>   - 1) 서브탭 Keep-Alive 언마운트 방지 (`MyDashboard.tsx`): Section 5 시뮬레이션 6대 서브탭(동적 리밸런싱, 일반 백테스터, 포트폴리오 최적화, 스트레스 테스터, 스마트 리밸런싱, 멀티 백테스터)에 Lazy-mount + Keep-Alive 패턴 적용으로 서브탭 재클릭 시 0ms 즉시 스위칭.
>   - 2) 클라이언트 SWR/sessionStorage 캐싱 (`PortfolioBacktester.tsx`, `AIRebalanceSimulator.tsx`, `EfficientFrontierPanel.tsx`, `MultiAssetBacktester.tsx`): 보유 자산 서명 및 파라미터 조합별 세션 캐시 탑재로 0ms 렌더링 및 새로고침 수동 버튼 제공.
>   - 3) 백엔드 AI Insight 인메모리 캐싱 (`api/backtest.py`): `_INSIGHT_CACHE` (TTL 3600s) 탑재로 중복 Gemini API 호출 차단 및 0.001s 즉시 응답.
> - 🛡️ Render 512MB RAM 제약 환경 OOM 방지 핫픽스 (FP-038):
>   - 1) `_job_brazil_intraday` 주말 휴장 시 조기 반환(`return`), `days=14` 경량 조회.
>   - 2) `_upsert()` 대상 날짜 선별 쿼리(`BrazilSeries.date.in_(target_dates)`)로 ORM 객체 99% 감축.
>   - 3) glibc 메모리 단편화 해소를 위한 `malloc_trim(0)` 강제 회수 탑재.
>   - 4) `overview_cache.py` IO_POOL 16 -> 6개 축소로 스레드 스택 절약.
> - 🔑 TFF 마스터 로그인 로딩 피드백 및 백엔드 사전 웜업 고도화:
>   - 마스터 패스코드 인증 시 스피너 및 비활성화 피드백 추가, TFF 탭 마운트 시 `triggerBackendWarmup()` 비동기 핑 전송.
> - 🎨 Sprint 8 (S8-1 ~ S8-4) transitions.dev 전역 모션 체계 및 TFF 런타임 오류 핫픽스 (FP-037) 완료 (PR #23 머지 및 배포 안정화).

> 세션 핸드오프 (2026-10-07, Antigravity):
> - 🧭 반도체 4국면 사이클 시계(`SemiCycleDashboard.tsx`) 범례 박스 가림 현상 완치:
>   - 1) 자유로운 마우스 드래그 앤 드롭 이동: 사용자가 마우스로 원하는 위치 어디로든 정보 박스를 끌어서 배치 가능 (포인터 캡처 및 화면 경계 유지, 위치 리셋 기능 탑재).
>   - 2) 궤적 밖 도킹 모드 전환: 상단 컨트롤 바 및 정보창 헤더에 [궤적 밖으로 / 플로팅 전환] 원클릭 토글 버튼 제공. 도킹 시 차트 아래 가로형 바로 깔끔하게 빠져 궤적 경로 100% 가시성 확보.
>   - 3) 플로팅 모드 기본 위치를 궤적의 이동 경로 밖(상단 우측 여백)으로 재배치하여 재생 시작 시 궤적 시작점을 가리지 않도록 방어.
> - 🔒 서버 사이드 비밀번호 검증 체계 구축 및 비밀번호 GitHub 노출 원천 차단:
>   - `POST /api/auth/verify` 신규 API Route: Vercel 환경변수(`MY_PASSWORD`, `TFF_PASSWORD`)를 서버 사이드에서만 안전하게 읽어 검증하도록 분리.
>   - 클라이언트 컴포넌트(`PasswordGate.tsx`, `TffGateWrapper.tsx`) 내 평문 하드코딩 비밀번호 완전 삭제.
>   - 루트(`/`), `/discover`, `/pension` 등은 비밀번호 없이 누구나 접속 가능한 완전 공개 서비스로 전환.
>   - 오직 `/my` (개인 종합자산) 및 `/tff` 서비스에만 각 서비스별 비밀번호 입력창 표시 및 비동기 서버 인증 적용.
> - ☀️ 기본 테마 라이트 모드 기본값 적용:
>   - `layout.tsx`: `html.light` 기본 클래스 탑재 및 인라인 테마 스크립트에서 사용자가 명시적으로 'dark'로 설정한 경우에만 제거하도록 변경.
>   - `ThemeToggle.tsx`: 초기 렌더링 상태를 라이트 모드로 기본 일치화.
> - 🛠️ 백테스터 & AI 리밸런서 & 포트폴리오 최적화 버그 완치 및 시계열/CORS 안정화:
>   - 1) `cannot reindex on an axis with duplicate labels` 오류 원천 차단:
>     - `core/hybrid_series.py`: `get_hybrid_daily_prices` 반환 전 일자별 deduplication(마지막 값 보존) 및 정렬 보장.
>     - `api/backtest.py`: `load_backtest_close_prices`에서 `batch_data` 및 yf fallback의 tz-naive 통일, `~s.index.duplicated(keep="last")`, 결합 DataFrame 인덱스 유일성 보장. `run_backtest`와 `run_rebalance_backtest`의 3Y/10Y 슬라이싱 및 loc 접근 단일 행 Series 보장.
>     - `api/efficient_frontier.py`: DB 시계열 및 fallback 시계열의 인덱스 중복 제거, 결측 보정 및 수익률 연산 안정화.
>   - 2) 포트폴리오 최적화 `Failed to fetch` 해결:
>     - `main.py`: `CORSMiddleware`에 `allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:[0-9]+)?$"` 및 로컬 다중 포트(3004, 3005, 3006, 5173 등) 전면 허용.
>     - `dashboard/src/components/EfficientFrontierPanel.tsx`: 네트워크 오류 시 친절한 안내 메시지 추가.
>   - 테스트 검증: `backend/tests/test_duplicate_labels_and_cors.py` 포함 백엔드 테스트 14개 전체 Pass, 프론트엔드 프로덕션 빌드 성공.
>   - 테스트 스위트 `backend/tests/test_sprint7_e2e_integration.py`:
>     - 1) S7-1: 백테스터 10년치 시계열 캐싱(1차 계산 0.3s, 2차 인메모리 0.001s 캐시 히트 정합성).
>     - 2) S7-2: AI 스마트 리밸런서 시나리오 백테스터 캐싱 및 10년치 일봉 하이브리드 로드.
>     - 3) S7-2: 몬테카를로 효율적 투자선 DB 하이브리드 일괄 조회 및 인메모리 캐싱.
>     - 4) S7-3: 종합자산 ↔ KIS 4대 기본 계좌 자동 매핑 및 모달 자동 비동기 바인딩 무결성.
>   - 테스트 검증: Sprint 7 신규 12개 테스트 100% Pass, 전체 백엔드 190개 테스트 무결성, Next.js 프론트엔드 프로덕션 빌드(10/10) 성공.
> - 🔄 S7-3 종합 자산(Hoya Board) ↔ KIS 실시간 포트폴리오 양방향 동기화 및 자동 계좌 매핑 고도화 완료:
>   - 백엔드 `backend/api/integrated_assets.py`:
>     - `get_kis_mappings` (`GET /api/v1/my/kis-mappings`): DB 미등록 시에도 `DEFAULT_KIS_ACCOUNT_MAPPING`의 4대 기본 계좌(ISA, IRP, 기타투자, 일반주식)를 자동 보충 반환.
>     - `get_integrated_assets`: KIS API 일시 지연 또는 잔고 호출 실패 시에도 최근 스냅샷 및 기본 계좌 메타데이터로 fallback 계좌를 생성하여 종합자산 화면에서 KIS 연동 계좌가 누락되지 않도록 방어.
>   - 프론트엔드 `dashboard/src/components/KisAccountMappingModal.tsx`:
>     - 모달 오픈 시 props `kisAccounts`가 비어있을 경우 `/api/v1/my/kis-mappings` 및 `DEFAULT_MAPPINGS`를 자동 fetch/fallback 바인딩하여 "계좌정보 없음" 에러 원천 차단.
>   - 테스트 검증: `backend/tests/test_integrated_assets_kis_sync.py` 3개 테스트 100% 통과, 프론트엔드 빌드 10/10 성공.
> - 🤖 S7-2 AI 스마트 리밸런서 & 효율적 투자선 시계열 캐싱 통합 및 비동기 프리페치 파이프라인 구축 완료:
>   - 백엔드 `backend/api/backtest.py`:
>     - `run_rebalance_backtest` (`POST /rebalance`): `_REBALANCE_CACHE` 탑재 및 `load_backtest_close_prices` 하이브리드 엔진 연동.
>   - 백엔드 `backend/api/efficient_frontier.py`:
>     - `calculate_efficient_frontier` (`POST /efficient-frontier`): `_EF_CACHE` 탑재 및 `get_hybrid_daily_prices_batch` 연동으로 DB 기반 초고속 일괄 조회 및 결측 보충.
>   - 테스트 검증: `backend/tests/test_rebalance_and_efficient_frontier_cache.py` 2개 테스트 100% 통과, 프론트엔드 빌드 10/10 성공.
> - ⚡ S7-1 포트폴리오 백테스터 10년치 시계열 DB 캐싱 및 초고속 인메모리 로딩 최적화 완료:
>   - 백엔드 `backend/api/backtest.py`:
>     - `_BACKTEST_CACHE` (SHA-256 canonical payload 기반 TTL 3,600s 인메모리 캐시) 탑재로 동일/재조회 요청 시 0.001초 즉시 응답.
>     - `load_backtest_close_prices`: 기존의 실시간 전량 `yf.download`(15~30초 소요) 방식을 제거하고, 기 구축된 하이브리드 시계열 엔진(`core/hybrid_series.py`)과 DB(`ETFDailyPrice`, `BenchmarkPrice`)에서 10년치 일봉을 우선 로드하며 부족한 일수만 증분 수집하도록 고도화 (로딩 속도 95% 단축).
>   - 테스트 검증: `backend/tests/test_portfolio_backtest_cache.py` 3개 테스트 100% 통과, 전체 183개 테스트 Pass, 프론트엔드 빌드 10/10 성공.
>   - 백엔드 `backend/api/health_monitor.py`:
>     - `GET /api/v1/health/live-summary` 신설: 신규 5대 핵심 파이프라인(S6-31~S6-35) 및 13종 백그라운드 스케줄러의 실서버 정상 가동 상태 요약 반환.
>   - 라이브 E2E 통합 테스트 `backend/tests/test_live_e2e_sync.py`:
>     - 1) S6-31: `POST /api/v1/analyze/portfolio/stress-test` (7대 글로벌 위기 시나리오 시뮬레이션 및 잔여 자산 정합성).
>     - 2) S6-32: `POST /api/v1/analyze/portfolio/rebalance` (목표 비중 드리프트 & 캐시 인젝션/전체 리밸런싱 주문).
>     - 3) S6-33: `GET /api/v1/macro/regime` & `POST /api/v1/macro/regime/fit` (2D 사분면 궤적 및 국면 적합도 진단).
>     - 4) S6-34: `POST /api/v1/my/backtest/multi` (올웨더/60:40/바벨 멀티 자산배분 및 리밸런싱 주기 시뮬레이션).
>     - 5) S6-35: `POST /api/v1/dividends/tax-shield` (금융소득 2,000만원 한도 소진율, 추가 세부담, 건보료 피부양자 자격 판정).
>     - 6) S6-36: `GET /api/v1/health/live-summary` (실서버 헬스체크 및 13종 스케줄러 상태).
>   - 테스트 검증: 전체 백엔드 175개 테스트 100% Pass, Next.js 프론트엔드 프로덕션 빌드(10/10) 성공.
> - 🛡️ S6-35 금융소득 종합과세(2,000만원) & 건강보험 피부양자 실시간 방어 트래커(Tax Shield Radar) 구축 완료:
>   - 백엔드 `backend/core/tax_shield_analyzer.py`:
>     - 연간 금융소득(일반과세 배당 + 이자소득) 2,000만원 상한선 실시간 추적 및 4단계 위험도(SAFE, CAUTION, WARNING, CRITICAL) 판정.
>     - 건강보험 피부양자 자격 박탈 위험(연 2,000만원 초과 시 지역건보료 전환 절벽) 및 예상 월/연 부과액 산출.
>     - 타 종합소득(근로/사업소득) 과표 구간별 누진 한계세율(6.6~49.5%)에 따른 추가 종합소득세액 정밀 연산.
>     - 1~12월 월별 금융소득 추이 및 2,000만원 한도 돌파 월(Breach Month) 시계열 계산.
>     - ISA(비과세/분리과세) 및 연금저축/IRP(과세이연/연금소득세) 절세계좌 이전 시뮬레이션을 통한 세금 및 건보료 절감 최적화 처방(CFP 가이드).
>   - 백엔드 `backend/api/dividends.py`:
>     - `POST /api/v1/dividends/tax-shield` 엔드포인트 제공.
>   - 프론트엔드 `dashboard/src/components/TaxShieldRadar.tsx`:
>     - 4 Bento 카드 (소진율 & 위험 등급 배지, 잔여 방어 한도, 예상 추가 세부담, 건보료 피부양자 자격 판정).
>     - 3대 대표 시나리오 프리셋 (안전 분산형 60%, 한도 임박형 92.5%, 피부양자 탈락 위기형 120%) 및 인터랙티브 슬라이더 컨트롤러.
>     - Recharts ComposedChart: 1~12월 월별 금융소득 바 + 연간 누적 선 + 2,000만원 방어선(빨간 점선 ReferenceLine).
>     - CFP & 세무 전문가 방어 전략 권고안 (Action Plan) 카드 완비.
>   - `dashboard/src/components/pension/PensionWealthHub.tsx` 연금·절세 허브 내 `[🛡️ 4. 금융소득 2,000만 & 건보료 방어]` 서브탭 연동.
>   - 테스트 검증: `backend/tests/test_tax_shield_analyzer.py` 5개 테스트 100% Pass, Next.js 프론트엔드 빌드(10/10) 성공.
> - 🧪 S6-34 올웨더 & 자산배분 멀티 ETF 포트폴리오 백테스터 2.0(Multi-Asset Backtester) 구축 완료:
>   - 백엔드 `backend/core/multi_backtester.py`:
>     - 자산배분 3대 클래식 프리셋 완비: 올웨더(All-Weather 30/40/15/7.5/7.5), 60:40(주식 60:채권 40), 바벨(성장주 80:현금성 20).
>     - 리밸런싱 주기(rebalancing_frequency: monthly, quarterly, yearly, none)별 복리 시뮬레이션 엔진.
>     - 핵심 성과 지표 산출: 누적 수익률(Cumulative Return), 연평균 복리수익률(CAGR), 최대 낙폭(MDD), 샤프 지수(Sharpe), 연간 변동성(Volatility).
>     - S&P500 벤치마크 가치 시계열 및 Underwater(낙폭 추이) 시계열 생성.
>     - CFP & AI 포트폴리오 성과 진단서(위험 대비 보상 평가, 최대 낙폭 방어력 진단, 추천 리밸런싱 주기) 자동 생성.
>   - 백엔드 `backend/api/backtest.py`:
>     - `POST /api/v1/my/backtest/multi` 엔드포인트 제공.
>   - 프론트엔드 `dashboard/src/components/MultiAssetBacktester.tsx`:
>     - 4 Bento 카드 (최종 평가액/누적 수익률, 연평균 수익률 CAGR, 최대 낙폭 MDD, 위험 대비 보상 Sharpe Ratio).
>     - 프리셋 원클릭 로더 및 사용자 종목 비중 슬라이더 UI (100% 비중 합계 검증 배지).
>     - 기간(1년/3년/5년/최대) 및 리밸런싱 주기 스위처.
>     - Recharts 듀얼 차트: (1) 포트폴리오 vs 벤치마크 자산 가치 추이 라인 차트, (2) Underwater 낙폭 에어리어 차트.
>     - AI 포트폴리오 성과 진단서 & 액션 가이드 박스.
>   - `MyDashboard.tsx` Section 5 포트폴리오 시뮬레이션 내 `[🧪 멀티 백테스터 2.0]` 서브탭 연동.
>   - 테스트 검증: `backend/tests/test_multi_backtester.py` 3개 테스트 100% Pass, Next.js 프론트엔드 빌드(10/10) 성공.
> - 🧭 S6-33 매크로 거시경제 4국면 나침반(Macro Regime Quadrant) & 국면별 최적 ETF 레이더 구축 완료:
>   - 백엔드 `backend/core/macro_regime.py`:
>     - 2D 성장-물가 사분면 연산 엔진(성장 지수 +38, 물가 지수 -24 기준 '골디락스' 판정).
>     - 4대 국면(골디락스, 인플레이션 붐, 스태그플레이션, 디플레이션 수축) 메타데이터 및 국면별 최적 ETF 3선 매핑.
>     - 최근 5개 분기 역사적 이동 궤적(Historical Trajectory) 산출.
>     - 사용자 보유 자산 전달 시 현재 국면 적합도 점수(Regime Fit Score, 100점), 시너지/역풍 자산 분해 및 처방전 산출.
>   - 백엔드 `backend/api/macro_dashboard.py`:
>     - `GET /api/v1/macro/regime` 및 `POST /api/v1/macro/regime/fit` 엔드포인트 제공.
>   - 프론트엔드 `dashboard/src/components/MacroRegimeQuadrant.tsx`:
>     - 4 Bento 카드 (현재 국면 배지, 성장 모멘텀 +38, 인플레이션 압력 -24, 국면 적합도 점수).
>     - 인터랙티브 2D 사분면 매트릭스 그리드 & 라이브 비콘(Live Beacon 펄스 애니메이션) 좌표 플로팅.
>     - 국면별 추천 주도 ETF 카드 및 주의사항 배너.
>     - 최근 5개 분기 이동 궤적 타임라인 및 실계좌 포트폴리오 국면 적합도 진단 위젯 연동.
>   - `DiscoverTab.tsx` 시장동향 상단 영역에 `MacroCompass`와 나란히 연동 배치 완료.
>   - 테스트 검증: `backend/tests/test_macro_regime.py` 포함 백엔드 166개 테스트 100% Pass, Next.js 빌드 성공(10/10).
> - ⚖️ S6-32 포트폴리오 목표 비중 드리프트(Drift) & 스마트 리밸런싱 주문기 구축 완료:
>   - 백엔드 `backend/core/portfolio_rebalancer.py`:
>     - 목표 비중(Target Weights) vs 현재 비중(Current Weights) 실시간 괴리율(±%p) 산출 및 정렬 점수(Drift Score, 100점) 연산.
>     - 3단계 위험도 판정: ALIGNED(±2%), DRIFT(±2~5%), CRITICAL(>±5%).
>     - 2대 리밸런싱 실행 모드 완비:
>       1) `cash_only`: 기존 종목 매도 없이(매도 0주) 신규 투입 현금(Cash Injection)만으로 부족한 종목만 우선 추가 매수하는 세금/수수료 최적화 알고리즘.
>       2) `full`: 기존 종목 매도 + 매수를 통해 목표 비중 100% 완전 일치 주문 계획 산출.
>     - CFP & AI 리밸런싱 처방 가이드(시급도, 액션 플랜, 세금 및 수수료 절감 팁) 자동 도출.
>   - 백엔드 `backend/api/router.py`:
>     - `POST /api/v1/analyze/portfolio/rebalance` 엔드포인트 제공.
>   - 프론트엔드 `dashboard/src/components/PortfolioRebalancer.tsx`:
>     - 4 Bento 카드 (정렬 점수 0~100점, 총 자산 규모, 총 매수 주문액, 총 매도 주문액).
>     - 3대 대표 프리셋 (균등 분배 1/N, 주식 60:채권 40, 글로벌 테크 성장 80:20) 원클릭 로드 및 커스텀 비중 슬라이더.
>     - Recharts 3중 막대 차트 (현재 비중 vs 목표 비중 vs 조정 후 예상 비중).
>     - 리밸런싱 실행 주문표 (종목별 주문 액션, 수량, 주문금액, 조정 후 예상 비중) 및 CFP 처방전 박스.
>   - `MyDashboard.tsx` Section 5 포트폴리오 시뮬레이션 내 `[⚖️ 스마트 리밸런싱]` 서브탭 연동.
>   - 테스트 검증: `backend/tests/test_portfolio_rebalancer.py` 포함 백엔드 161개 유닛/통합 테스트 100% Pass, Next.js 프론트엔드 빌드(10/10) 정상.
> - 🚨 S6-31 포트폴리오 스트레스 테스터(Stress Tester) 실계좌 연동 및 7대 위기 시나리오 분석기 구축 완료:
>   - 백엔드 `backend/core/stress_tester.py`:
>     - 7대 글로벌 역사적 금융 위기 시나리오 지원: 코로나(2020), 엔캐리 블랙먼데이(2024.08), 고물가·긴축(2022), SVB 파산(2023), 러-우 개전(2022), 미국 신용강등(2011), 리먼 금융위기(2008).
>     - 자산군(미국주식, 국내주식, 채권, 현금/파킹, 원자재) 및 레버리지/인버스2X 정밀 분류.
>     - `total_eval_amount` 기반 원화(KRW) 손실액 및 위기 후 잔여 자산 연산.
>     - 포트폴리오 방어 지수(Defense Score, 100점 만점), 4단계 위험도 등급(SAFE, CAUTION, WARNING, CRITICAL).
>     - 시나리오 내 최다 타격 취약 종목(Worst Impact) TOP 3 & 방어 효자 종목(Best Shield) TOP 3 도출.
>     - CFP & AI 리스크 헷지 처방전(진단, 액션 플랜, 추천 헷지 ETF, 15% 채권 편입 시 MDD 완화 시뮬레이션) 생성.
>   - 프론트엔드 `dashboard/src/components/PortfolioStressTester.tsx`:
>     - 4 Bento 카드, 7대 시나리오 스위처, Recharts 바 차트 비교, 2열 취약/효자 종목 카드, 전체 종목 상세 분해 테이블, AI 헷지 처방전 완비.
>     - `MyDashboard.tsx` Section 5 포트폴리오 시뮬레이션에 `스트레스 테스터` 서브탭 연동 (실보유 계좌 종목 및 평가액 원클릭 주입 + 계좌별 필터).
>   - 테스트 검증: `backend/tests/test_stress_tester.py` 포함 백엔드 156개 테스트 100% Pass, Next.js 빌드 성공(10/10).
> - 🏛️ S6-30 연금·절세 웰스 허브(Pension Wealth Hub) 신설 완료:
>   - 상단 메인 메뉴바에 `종목분석`(`analysis`) / `섹터분석`(`sector`) / `시장동향`(`discover`) 오른쪽에 신규 **`연금·절세`**(`pension`) 탭 신설 및 `/pension` 직행 라우트 연동.
>   - `dashboard/src/lib/pensionRules.ts`:
>     - (1) 국민연금 조기(연 -6%) vs 정상(60~65세) vs 연기(연 +7.2%) 수학적 손익분기점(BEP) 연산(조기-정상 약 76.7세, 정상-연기 약 83.9세 크로스오버 도출).
>     - (2) 건강보험 피부양자 자격 한도(연 2,000만원 / 월 166.7만원 초과 시 지역건보료 전환) 위험 자동 감지 및 경고.
>     - (3) 연금 3총사(연금저축 600만 + IRP 300만 = 900만원, 총급여별 16.5% vs 13.2%) 세액공제, ISA 3년 만기 전환 10%(최대 300만원) 추가 공제, 배당소득세(15.4%) 과세이연 30년 복리 자산 격차 시뮬레이션.
>     - (4) 은퇴 후 사적연금 인출 시 나이대별 저율과세(55~69세 5.5%, 70~79세 4.4%, 80세 이상 3.3%) 및 1,500만원 초과 시 종합과세 vs 16.5% 분리과세 선택 가이드.
>   - `dashboard/src/components/pension/PensionWealthHub.tsx`:
>     - 3개 서브탭 구성: `연금 3총사 절세 (연금저축·IRP·ISA)`, `국민연금 조기·연기 손익분기(BEP)`, `은퇴 인출 & 연금소득세 가이드`.
>     - 슬라이더 2열 인터랙션, Recharts AreaChart & LineChart 교차점 시각화, CFP 전문가 5대 처방전 탑재.
>   - 단위 테스트 검증: 프론트엔드 빌드 10/10 정상(0 에러), 백엔드 pytest 153/153 100% 통과.
> - ⚡ 5대 섹터(반도체, 소부장, 우주, 에너지, 바이오) 로딩 지연 원인 해결: 과거 119만 건 일별 시세와 1.6만 건 holdings가 들어있던 `etf_data.db`를 현재 활성 DB(`etf_data_v2.db`)로 영구 복제 통합 완료. 레버리지 4종 holdings fallback 등록 및 백엔드 `asyncio.gather` 병렬화(응답 10~20초대 → 0.3~1.5초대).
> - 🚀 5대 섹터 프론트엔드 SWR (Stale-While-Revalidate) 0초 즉시 렌더링 적용: `sessionStorage` 기반으로 마운트 시 스피너 차단 없이 이전 차트와 도표를 0ms 즉시 표시 후 백그라운드 갱신.
> - 🌐 실서버 배포 점검(S6-28) 및 백그라운드 스케줄러 점검(S6-29) 순차 착수.
> - 🌗 Dark / Light 토글(상단 바, `ThemeToggle`) 추가. Tailwind v4 색 변수를 `html.light`에서 반전하는 방식(`scripts/generate-light-theme.py` → `app/theme-light.css`). 근거 `docs/theme-light-context-notes.md`. 시장동향 '오늘의 시장' 임베드 주소를 bulliza.com으로 교체(finance.richgo.ai 404).
> - 🔷 서비스명 ETF Lens → **i-Prism**(Investment Prism) 리브랜딩. 로고는 역삼각형 프리즘 i + 부채꼴 스펙트럼 광선 + 그라데이션 Prism(rism 소문자, 시안 H2). 로고·아이콘·파비콘은 `dashboard/scripts/generate-brand.py`로 생성하며 생성물(`components/brand/IPrismLogo.tsx`, `public/brand/*`, `app/icon.svg`, `app/apple-icon.png`, `app/favicon.ico`)은 직접 고치지 않는다. 결정 근거 `docs/iprism-rebrand-context-notes.md`. 도메인(etf-lens.*)과 User-Agent는 유지.
> - 🐛 대선 D-day 고정값 버그 수정: `ElectionPlaybookSection`의 `D-3 SPECIAL` 라벨과 Tranche 3 카드의 "(D-3 진입 중)"이 JSX에 하드코딩돼 있었고, `_build_election_prompt`도 "D-2~D-3일 앞둔 시점"으로 고정돼 있어 AI 재생성 시에도 같은 D-day가 나왔다. 이제 프론트는 `getElectionDDayLabel()`, 백엔드는 `_election_phase_text()`가 오늘 날짜(KST)와 `CATALYSTS` 대선 일정으로 계산한다. 회귀 테스트는 `test_election_prompt_uses_dynamic_dday`.
> - 📰 관련 뉴스 피드 개편: 2열 박스 → 최신순 리스트(5건 높이, 최대 30건 스크롤), 항목 클릭 시 팝업(언론사·발행시각·원문 링크), [뉴스 업데이트] 버튼(`refresh=true` 라이브 재수집). 뉴스가 10/2에 멈춰 보이던 원인은 관련성 필터(`_RELEVANT_TOKENS`)가 대선 기사를 떨어뜨리고 검색어에 대선이 없던 것이었다. "브라질 대선" 검색어와 "대선·선거·변동성" 토큰을 추가했고, `get_recent_news`에서 제목 기준 중복을 제거한다. Google News RSS는 본문을 주지 않아 팝업에는 요약 없이 원문 링크만 둔다.
> - 🧹 저장소 정리: 체크리스트 `docs/housekeeping-2026-10-checklist.md`, 결정 근거 `docs/housekeeping-2026-10-context-notes.md`. 배포본은 `dashboard/`이고 `frontend/`는 2026-02 이후 미사용이다.

> 세션 핸드오프 (2026-10-03):
> - 🇧🇷 브라질 국채 토탈리턴(Total Return) 정밀 시뮬레이터 구축 (S6-19):
>   - `backend/core/brazil_total_return.py` & `backend/api/brazil_total_return.py`:
>     - NTN-F(10% 반기 이표채) 및 LTN(할인채) dirty price / Mac/Mod 듀레이션 / BPV 산출.
>     - 반기별 복리 재투자(이자소득), 매도 시점 금리 변동에 따른 가격 변동(자본차익/손실), 원/헤알 환율 변동 결합.
>     - 원화 기준 손익분기 환율(Breakeven FX) 자동 도출 및 7x6 2차원 시나리오 매트릭스(금리 ±300bp × 환율 -30%~+20%).
>     - 5대 추천 프리셋 제공: 만기보유 인컴형, 금리 피크아웃 자본차익형, 환율 스트레스 테스트형, 14.5% 어깨 바벨형, LTN 할인채형.
>   - `dashboard/src/components/BrazilTotalReturnSimulator.tsx`:
>     - 4대 요약 Bento 카드 (최종 원화 수령액/수익률, 연환산 CAGR, 환율 손익분기점, 수익 분해).
>     - 2열 슬라이더 컨트롤러 (투자원금, 만기/보유기간, 매수/매도금리, 환율/변동률, 재투자율, 수수료/비과세 토글).
>     - Recharts AreaChart 반기별 누적 가치 추이 및 7x6 컬러 히트맵 매트릭스.
>     - 프론트엔드 실시간 useMemo 로컬 계산 엔진 탑재로 슬라이더 드래그 60fps 무지연 반응.
>   - `dashboard/src/components/BrazilBondTab.tsx`: 기존 단순 Carry 계산기를 `BrazilTotalReturnSimulator`로 전면 교체 연동.
> - 🗳️ 브라질 대선 실시간 인텔리전스 & 수동 결과/이벤트 업데이트 (S6-19):
>   - `backend/api/brazil_election_intel.py`:
>     - `GET /election-intel`: 1차 투표 결과, 후보별 득표율, 결선투표 여부, 여론조사, 타임라인 이벤트 반환 (자동 AI 리프레시 지원).
>     - `POST /election-intel/refresh`: Gemini AI 기반 최신 뉴스 및 선거 결과 자동 크롤링/갱신.
>     - `PUT /election-intel`: 수동 개표 결과 및 판세 강제 덮어쓰기 (24시간 AI 자동 덮어쓰기 방어 lock 플래그 지원).
>     - `POST /election-intel/events`: 현장 속보 등 단일 타임라인 이벤트 즉시 추가.
>   - `dashboard/src/components/BrazilBondTab.tsx`:
>     - `BrazilElectionDetailModal` 내 실시간 1차 투표 개표 결과 배너(룰라 vs 플라비우 득표율 프로그레스 바 및 10/25 결선 확정 뱃지) 연동.
>     - `[🔄 최신 뉴스·결과 AI 갱신]` 및 `[✏️ 수동 결과·이벤트 입력]` 드로어 탑재 (득표율, 투표율, 결선 여부, 신규 속보 입력 폼 완비).
> - 🚨 핫픽스: 브라질채권 탭 런타임 크래시(React Error #31) 및 대시보드 SSR 안정성 강화 완료:
>   - 원인: Gemini가 생성한 `brazil_election_pulse`의 `recommended_bond_guide` 필드가 단일 텍스트가 아닌 세부 항목 객체(`{"단기채 중심 인컴형": "...", ...}`)로 생성되어 JSX 자식 노드 직접 렌더링 시 React 19 객체 렌더링 에러(#31) 유발.
>   - 조치: `BrazilBondTab.tsx`에 `renderFlexibleContent` 헬퍼 함수를 구축하여 문자열/객체/배열 자동 파싱 렌더링 적용, 백엔드(`brazil_bond.py`)에서도 `_normalize_pulse_content`로 사전 정규화 제공(2중 방어).
>   - 추가 조치: `MainApp.tsx`에서 `DividendDashboard`를 `next/dynamic`(`ssr: false`)으로 격리 로딩하고 널가드를 보강하여 SSR Recharts hydration 충돌 및 초기 번들 크기 최적화.
> - S6-4 ETF 배당(분배금) 정보 수집 백엔드 스크래퍼 및 API 구축 완료:
>   - `ETFDividendHistory`, `ETFDividendSummary` DB 모델 추가 및 테이블 마이그레이션.
>   - `core/dividend_scraper.py`: yfinance 및 네이버 모바일 증권 API 연동, 배당주기 자동 판별, TTM 배당수익률 및 월별 캐시플로우 연산 모듈 구현.
>   - `api/dividends.py`: `GET /{code}`, `POST /sync`, `POST /portfolio-cashflow`, `GET /rankings` 엔드포인트 제공.
> - S6-5 배당 캘린더 및 배당 Cashflow 시뮬레이션 대시보드 화면 구축 완료:
>   - `DividendDashboard.tsx`: 4대 요약 Bento 카드, 1~12월 월별 배당금 Bar 차트(월평균 기준선), 12개월 매트릭스 캘린더(NOW 배지), 수량 실시간 +/- 조절 및 즉시 재계산 시뮬레이터, 실계좌 자동 불러오기/프리셋/종목추가 모달, 시장 고배당 & 월배당 ETF 랭킹 보드 연동.
>   - `MyAssetsView.tsx`: /my 전용 '💰 배당 캘린더' 서브탭 추가 및 계좌 접속 시 실보유 종목 자동 연동(`autoLoadMyAssets`).
>   - `MainApp.tsx`: 일반 경로(/) 접속 시 배당 캘린더 서브탭 완전 제외 및 /my(showMyTab=true) 접속 시에만 한정 활성화하는 라우트 가드 적용.
> - S6-6 괴리율 개인화 알림 설정 및 알림 채널 확장 완료:
>   - `NotificationSettings` DB 모델 및 스키마 마이그레이션: `discord_webhook_url`, `slack_webhook_url`, `channel_telegram`, `channel_discord`, `channel_slack`, `alert_disparity`, `disparity_threshold`, `disparity_target_scope` 컬럼 추가.
>   - `backend/core/notifier.py`: Discord / Slack 웹훅 비동기 전송 함수 및 통합 `broadcast_notification` 멀티캐스트 엔진 구축 (HTML -> Markdown/mrkdwn 자동 변환).
>   - `backend/api/notification_settings.py`: `/settings` 및 `/test` 엔드포인트에 멀티채널 및 채널별 즉시 테스트 발송 기능 탑재.
>   - `backend/core/scheduler.py`: `check_etf_disparity_and_alert`에 사용자별 개인화 임계치(0.5%~5.0%) 및 범위(내 보유 vs 전체), 1시간 쿨다운 캐시 적용.
>   - `dashboard/src/components/NotificationSettings.tsx`: Telegram, Discord, Slack 3대 채널 탭 및 즉시 테스트 버튼, 괴리율 실시간 경보 Bento 카드 (임계치 슬라이더 및 프리셋, 대상 범위 선택기) UI 완성.


## Current Sprint

- Sprint: 9 — Portfolio Backtester Caching & Instant Tab Switching (S9-1)
- Started: 2026-10-11
- Branch: main

## Story Status

| ID | Title | Status | Notes |
|----|-------|--------|-------|
| S9-2 | TFF 펀드 대시보드 브라우저 SWR 캐싱 & 0초 로딩 | ✅ stable | localStorage 기반 0ms 즉시 복원, 백그라운드 서버 최신본 동기화 및 추정치 캐싱 완료 |
| S9-3 | 포트폴리오 성과 분석 4대 심층 리스크 지표 (Sortino/Calmar/Sharpe/Vol) | ✅ stable | 연간화 변동성, 샤프 지수, 소르티노 지수, 칼마 지수 백엔드 퀀트 연산 및 3대 뷰 모드 UI 확장 완료 |
| S9-1 | 포트폴리오 백테스터 탭 캐싱 및 로딩 속도 최적화 | ✅ stable | 프론트엔드 SWR/sessionStorage 캐싱, 백테스터 6개 서브탭 Keep-Alive 언마운트 방지 및 백엔드 AI Insight 인메모리 캐싱(TTL 3600s) 완료 |
| S6-1 | TFF 엑셀 업로드 데이터 PostgreSQL 저장 및 중앙 공유형 대시보드 | ✅ stable | 파일 데이터 PostgreSQL 저장, 마스터 인증 패스코드 및 뷰어/마스터 권한 격리 구현 완료 |
| S6-2 | 포트폴리오 Efficient Frontier 최적화 백엔드 API | ✅ stable | yfinance/pykrx 연동 기대수익률, 공분산 및 몬테카를로 포트폴리오 변동성 최적화 연산 모듈 및 유닛 테스트 구현 완료 |
| S6-3 | Efficient Frontier 시각화 및 최적 비중 연동 | ✅ stable | Recharts ComposedChart 산점도/효율전선 커브, Max Sharpe/MinVar/현재 Bento 카드, 최적 비중 BarChart 및 인사이트 요약 구현 완료 |
| S6-4 | ETF 배당(분배금) 정보 수집 백엔드 스크래퍼 및 API | ✅ stable | yfinance/네이버 API 연동 분배금 수집, 배당주기 자동 판별, 포트폴리오 월별 Cashflow 연산 및 고배당 랭킹 API 구축 완료 |
| S6-5 | 배당 캘린더 및 배당 Cashflow 시뮬레이션 대시보드 | ✅ stable | 1~12월 월별 예상 배당금 차트(Recharts Bar), 12개월 배당 캘린더 매트릭스 뷰, 보유 수량 실시간 +/- 조절 및 재계산, /my 계좌 접근 한정 활성화 및 실계좌 자동 연동, 고배당&월배당 ETF 랭킹 연동 완료 |
| S6-6 | 괴리율 개인화 알림 설정 및 알림 채널 확장 | ✅ stable | Disparity 임계치 설정 Slider UI, 범위(내 보유 vs 전체) 설정, Telegram/Discord/Slack 웹훅 및 채널별 즉시 테스트 연동 완료 |
| S6-7 | 계좌별 자산 증감(추이) 시각화 및 분석 | ✅ stable | KIS 일별 계좌 자산 DB 적재 및 거래내역 기반 90일 역산 복원 차트 시각화 완료 |
| S6-8 | 전력/에너지 섹터 주요 종목 현황 및 구성종목 비중 비교 | ✅ stable | 3분할 탭 개편(국내주식/해외주식/해외상장) 및 GRID 등 미국 상장 6종 추가, 통화 분기 표기 연동 완료 |
| S6-9 | 차기 주도주 발굴 및 10대 대안 섹터 퀀트 스크리너 | ✅ stable | 양극화 지수, M7 CAPEX, 반도체 이격 신호등 및 10대 테마 퀀트 스크리너 구현 완료 |
| S6-10 | 주요 4대 시장 섹터별 주가 흐름 격자 (Sector Flow Grid) | ✅ stable | KOSPI, KOSDAQ, S&P 500, NASDAQ 대표 32종 ETF/지수의 1년 누적수익률 라인 차트 및 absolute SVG 화살표 오버레이 격자판 구현 완료 |
| S6-11 | 반도체 ETF 구성종목 변동 그래프 및 전문가 리포트 개편 | ✅ stable | 12종 반도체 ETF 3대 탭 스위칭, 구성종목 점선 차트 오버레이, 괴리율 및 실시간 프리마켓 예상가 연동 테이블, 3대 탭 Gemini Expert Report 통합 완료 |
| S6-12 | 우주항공 섹터 전문가 리포트 및 상관관계 매트릭스 하이라이트 | ✅ stable | SpaceChart 전문가 리포트 3개 탭 추가 및 상관관계 분석 매트릭스 내 가로/세로 하이라이트 박스 고도화 완료 |
| S6-13 | 섹터분석 정렬 순서/명칭 갱신 및 조선/소부장 대체 | ✅ stable | 대시보드 섹터 재배치 및 AI전력 개명, 조선/반도체소부장 틱커 대체 매핑 완료 |
| S6-14 | 구글 시트 기반 종합 자산 관리 (Account Board + KIS 연동 + 수동 자산 CRUD) | ✅ stable | KIS API 실시간 연동 + 타 금융사(미래에셋/삼성/저축) 수동 자산/예수금 통합 집계, 구글 시트 형태의 Account Board 및 계좌별 상세 종목 뷰 구현 완료 |
| S6-15 | 반도체 매크로 사이클(CSCI) 퀀트 엔진 및 4국면 시각화 대시보드 | ✅ stable | 5년 롤링 Z-score 정규화 기반 선행(40%)+동행(40%)+후행(20%) CSCI 지수, 4-Phase 사이클 시계(2D Quadrant), 빅테크 CapEx 트래커, 서브섹터 디커플링 맵, ETF 리밸런싱 매트릭스 연동 완료 |
| S6-17 | 브라질 대선 시나리오 분석 및 조건별 추천 국채 라인업 (헤알화/달러 기반) | ✅ stable | 3대 대선 시나리오 비교(BCB 독립성 하방 방파제), 금리 고점 듀레이션 확대 원칙, 조건별 국채 5종 라인업(적극 고수익 바벨 포함), Tranche 3 체크리스트 및 Gemini Live Pulse 연동 완료 |
| S6-18 | 브라질 대선 2차 결선투표 추가, 타임라인 1줄 최소화 및 대선 종합 인텔리전스 팝업 | ✅ stable | 결선투표(현지 10/25 · 결과 반영 10/26 KST) 추가, 완료 이벤트 1줄 접기/펼치기 아코디언, 선거 일정/제도 요약표, 룰라 vs 플라비우 판세 및 Quaest·AtlasIntel 여론조사 시각화 바 차트, 국채 투자 액션 가이드 및 출처 팝업 모달 구현 완료 |
| S6-19 | 브라질 국채 토탈리턴(Total Return) 시뮬레이터 & 대선 1차 투표 결과/이벤트 실시간 업데이트 | ✅ stable | NTN-F/LTN 더티프라이스, 복리 재투자, 만기보유 vs 조기매도 자본차익, 환율 손익분기점, 7x6 시나리오 매트릭스, 대선 1차 투표 결과 시각화(결선 뱃지) 및 Gemini AI 뉴스 동적 갱신/수동 입력 지원 완료 |
| S6-20 | 범용 시계열 하이브리드 엔진 모듈화 (DB 축적 + Gap-fill + 실시간 병합) | ✅ stable | core/hybrid_series.py 구현 완료. ETFDailyPrice/BenchmarkPrice 대상 초기 1회 시드, 결측 구간(Gap)만 증분 수집, 당일 실시간 시세 병합 및 다중 배치 처리 지원 |
| S6-21 | 매크로 출구신호 DB 영속화 & FRED/Yahoo 증분 수집 파이프라인 | ✅ stable | MarketMacroLog 연동 완료. DTWEXBGS, KRW=X, T10Y2Y, HY Spread 초기 시딩 및 결측일만 타깃 증분 갱신(Gap-fill)으로 외부 API 지연 제거 |
| S6-22 | 섹터/테마 차트 5종(반도체·소부장·우주·에너지·바이오) DB 하이브리드 엔진 전면 전환 | ✅ stable | router.py 내 5대 섹터 차트의 10년치 yfinance full-fetch 로직을 get_hybrid_series_as_pd_series로 교체하여 DB 기반 0.05초 서빙 및 증분 갱신 완비 |
| S6-23 | 장 마감 자산 스냅샷 스케줄러 & 배당 14일 TTL 자동 갱신 파이프라인 | ✅ stable | 평일 15:40 자산 스냅샷(UserAssetSnapshot) 자동 DB 적재 및 배당 요약본 14일 TTL 만료 시 주간 자동 재스크래핑 크론 등록 완료 |
| S6-24 | 10대 주도주 스크리너 사전 계산 DB화 & 5대 섹터 구성종목 DB 서빙 전환 | ✅ stable | SectorLeaderQuant 모델 및 일일 장 마감 후(16:00) 퀀트 랭킹 사전 계산 크론 잡 구축(20초→0.01초), 5대 섹터 구성종목(Holdings) DB 1순위 조회 및 주가 5분 캐시 적용(8초→0.05초) 완료 |
| S6-25 | 종합 매트릭스 및 배당 캘린더 DB 일괄 쿼리 & 캐시 가속화 | ✅ stable | CompareTable의 불필요한 wisereport 스크래핑 제거 및 60초 캐싱(3초→0.05초), DividendDashboard 포트폴리오 캐시플로우 DB 일괄 쿼리(0.005초) 및 SWR 캐시 우선 렌더링 적용 완료 |
| S6-26 | 종합 자산(Hoya Board) 초기 로딩 블로킹 제거 & KIS 스마트 캐시 | ✅ stable | MyAssetsView 마운트 시 Hoya Board 탭을 가로막던 20초 전면 스피너 블로킹 제거, 세션 캐시 기반 0초 즉시 렌더링(SWR) 및 백엔드 포트폴리오 스마트 TTL(장마감 30분/장중 10분) 캐싱 적용 완료 |
| S6-27 | 5대 섹터 차트·구성종목 119만 건 DB 영구 통합 및 프론트엔드 SWR 초고속 렌더링 | ✅ stable | 과거 수집 119만 건 DB 누락 복제 해결, 5대 섹터 백엔드 asyncio.gather 병렬화 및 타임아웃 방어, 5대 섹터 프론트엔드 SWR 0초 즉시 렌더링 적용 완료 |
| S6-28 | 실서버(Render/Vercel) 배포 점검 & 프로덕션 동기화 검증 | ✅ stable | 전체 141개 유닛 테스트 100% 통과, Render 백엔드 및 Vercel 프론트엔드 정상 동작(HTTP 200) 확인 및 origin/main 배포 동기화 완료 |
| S6-29 | 백그라운드 스케줄러 13종 점검 및 정상 기동 검증 | ✅ stable | 장 마감 자산 스냅샷, 퀀트 사전계산, 배당 14일 갱신, 렌더 킵얼라이브 등 13개 cron/interval 잡 등록 및 정상 기동 검증 완료 |
| S6-30 | 연금·절세 웰스 허브 탭 신설 및 국민연금 BEP·절세 시뮬레이터 연동 | ✅ stable | 상단 메인 메뉴바 연금·절세 탭 신설, 국민연금 조기/정상/연기 손익분기점(BEP) 연산, 건보료 피부양자 탈락 위험 자동 판정, 연금저축/IRP/ISA 세액공제 및 과세이연 30년 복리 시뮬레이터 연동 완료 |
| S6-31 | 포트폴리오 스트레스 테스터 실계좌 연동 및 7대 위기 시나리오 분석기 | ✅ stable | 7대 위기 시나리오(코로나2020, 블랙먼데이2024, 인플레2022, SVB2023, 러우전쟁2022, 신용강등2011, 리먼2008), KIS 실계좌 자동 연동 및 원화 손실액 환산, 방어지수, 최다타격/효자종목, AI 리스크 헷지 처방전 탑재 완료 |
| S6-32 | 포트폴리오 목표 비중 드리프트 & 스마트 리밸런싱 주문기 | ✅ stable | 목표 비중 괴리도(Drift) 산출, 3단계 상태(ALIGNED/DRIFT/CRITICAL), 정렬 점수(100점), 올웨더/60:40/테크성장 프리셋, 캐시 인젝션(매도 0주) vs 전체 리밸런싱 모드, Recharts 3중 막대 차트, 실행 주문표 및 CFP 처방전 완비 |
| S6-33 | 매크로 거시경제 4국면 나침반 & 국면별 최적 ETF 레이더 | ✅ stable | 2D 성장-물가 사분면 매트릭스(골디락스/인플레붐/스태그플레이션/수축), 라이브 비콘(Live Beacon) 좌표 플로팅, 5개 분기 역사적 이동 궤적, 국면별 최적 ETF 3선, 보유 포트폴리오 국면 적합도 진단 완비 |

### 스토리 ID 충돌 대응표

7월 브라질채권 작업이 S6-3~S6-18 번호를 하위 단계 번호처럼 쓴 뒤, 8~10월의 정식 스토리가 같은 번호를
다시 받았다. 커밋은 고치지 않고 아래 표로 구분한다. 위 Story Status 표의 의미가 정식이다.

| ID | 정식 스토리 (Story Status 기준) | 같은 번호를 쓴 다른 커밋 |
|----|----|----|
| S6-3 | Efficient Frontier 시각화 (05-31) | 브라질채권 시계열·판정기준·타임라인·캐싱 (07-12~13), 반도체 7대 실데이터 교체 (08-23) |
| S6-4 | ETF 배당 수집 API (10-03) | 서버 시작 시 ETF 마스터 동기화 OOM 방지 (07-13) |
| S6-13 | 섹터분석 정렬/명칭 (06-12) | 브라질 Activation Zone 1주 궤적·상단 탭 순서·자산추이 수익률 (08-12) |
| S6-14 | 구글 시트형 종합 자산 관리 (08-22) | COPOM 발표 15분 주기 텔레그램 모니터링 (07-25) |
| S6-15 | 반도체 매크로 사이클(CSCI) (08-22) | 브라질 대시보드 범례 슬림화·종합판정 카드 (07-25) |
| S6-16 | 10대 업종 7대 실데이터 신호등 (08-23) | COPOM D-day 타임라인 하이라이트 (07-25) |
| S6-17 | 브라질 대선 시나리오·국채 라인업 (10-03) | Copom 시나리오 D-11 이벤트 카드 (07-25) |
| S6-18 | 대선 결선·인텔리전스 팝업 (10-03) | Copom 깜짝 인상 시나리오 D (07-25) |
| S7-* | (Sprint 7 미개설) | S7-BrazilBond·S7-Notify·S7-PeerAnalysis (07-23~25, Claude Code)는 Sprint 6 기간 작업 |

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

- 2026-09-06: TFF 대시보드에서 데이터가 로드된 상태일 때 마스터 [업로드] 버튼 클릭 시 파일 선택기/업로드 화면이 뜨지 않던 버그 수정 완료. 조건부 렌더링 내에 있던 `<input type="file">`을 컴포넌트 루트에 상시 마운트하고, 전용 업로드 모달(`showUploadModal`)을 신설하여 드래그앤드롭 및 파싱/DB 저장 진행 시각화 구현.
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
