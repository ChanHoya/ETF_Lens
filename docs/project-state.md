# Project State — i-Prism (구 ETF Lens)

> **Keep this file under 200 lines.**
## Quick Summary
Base: Exit Strategy Monitoring (KOSPI) & Brazil Bond Analysis
✅ Current: S7-1(포트폴리오 백테스터 10년치 시계열 DB 캐싱 및 초고속 인메모리 로딩 최적화) 완료
➡️ Next: S7-2 (AI 스마트 리밸런서 & 효율적 투자선 시계열 캐싱 통합 및 비동기 프리페치 파이프라인 구축)
➡️ 다음 신규 스토리 ID는 **S7-2**. 아래 "스토리 ID 충돌 대응표"에 있는 번호는 재사용하지 않는다.

> 세션 핸드오프 (2026-10-06, Antigravity):
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

- Sprint: 6 — Centralized TFF Dashboard, Efficient Frontier, Dividend Calendar, & Custom Disparity Alerts
- Started: 2026-05-31
- Branch: main

## Story Status

| ID | Title | Status | Notes |
|----|-------|--------|-------|
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
