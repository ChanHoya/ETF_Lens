# Project State — ETF Lens

> **Keep this file under 200 lines.**

## Quick Summary
 
Base: Exit Strategy Monitoring (KOSPI)
✅ Current: Sprint 5 — 글로벌 매크로 스트레스 테스트, 환율/절세 시뮬레이터, 우주 및 바이오 ETF 구성종목 변동 그래프/개별 주식 팝업 연동, 특정 ETF 선택 시 테이블/차트 구성종목 10종 필터링 고도화 및 My 탭 내 보유 자산 정보 기반 AI Assistant 서비스 연동/바로가기 위젯 추가 완료
➡️ Next: 다음 스프린트 계획 수립 예정
 
## Current Sprint
 
- Sprint: 5 — Advanced Risk Analysis & Tax Optimization
- Started: 2026-05-23
- Branch: main
 
## Story Status
 
| ID | Title | Status | Notes |
|----|-------|--------|-------|
| S5-6 | My 탭 내 보유 자산 정보 기반 AI Assistant 서비스 연동 및 바로가기 위젯 추가 | ✅ done | 보유 자산 정보를 sessionStorage를 통해 AI 챗봇과 실시간 공유하고 My 탭 대시보드 내 퀵 질문 벤토 카드 연동 완료 |
| S5-5 | 바이오 섹터 특화 분석 개발 | ✅ done | 5대 바이오 ETF 및 구성종목 비교 그래프/테이블 개발 및 개별 주식 팝업 연동 완료 |
| S5-4 | 우주 ETF 구성종목 변동 그래프 및 개별 주식 팝업 연동 | ✅ done | 4대 우주 ETF 클릭 시 상위 구성종목 주가 점선 오버레이 렌더링 및 개별 종목 클릭 시 미국 주식 전용 모달 연동 완료 |
| S5-1 | 포트폴리오 역사적 위기 스트레스 테스터 엔진 및 API 연동 | ✅ done | COVID-19, 리먼 등 과거 위기 시나리오 대입 시 포트폴리오 예상 MDD/VaR 분석 백엔드 개발 완료 |
| S5-2 | 원/달러 환율 연동 환헤지 vs 환노출 비교 분석 | ✅ done | 환헤지(H)와 환노출 ETF 간 환율 변동별 실질 누적 성과 시뮬레이션 및 차트 연동 완료 |
| S5-3 | ISA 및 연금저축/IRP 과세이연 및 절세 혜택 시뮬레이터 | ✅ done | 절세 계좌별 비과세/과세이연 혜택 및 세후 최종 복리 수령액 비교 계산 도구 개발 완료 |
| S4-1 | ETF 구성 종목 중복도 분석 및 포트폴리오 중복 진단 도구 개발 | ✅ done | KIS 포트폴리오의 ETF 실질 구성 종목 중복 노출율과 분산 투자 효과를 퀀트 연산하는 백엔드 엔진 및 API 엔드포인트 구현 완료 |
| S4-2 | AI 기반 리밸런싱 주문 시나리오 백테스트 시뮬레이터 | ✅ done | 과거 Exit Signal 위험 감지에 따라 안전 자산으로 대피하고 회복 시 복귀하는 동적 자산배분 퀀트 연산 및 Recharts/로그 단말기 UI 구현 완료 |
| S4-3 | 미국 주요 매크로 인플레이션 지표 (CPI, PPI, PCE YoY) Recharts 및 SWR 캐시 연동 고도화 | ✅ done | TradingEconomics/Investing.com 아이프레임을 제거하고 DB 캐싱 데이터 및 SWR 로컬 캐시 기반 Recharts 네온 라인 차트로 완벽 리팩토링 완료 |
| S4-4 | ETF 실질 비용(TER+거래비용+추적오차) 종합 진단 랭킹 보드 고도화 | ✅ done | 금투협 공시 실질 TER과 추적오차 데이터를 연동하여 국내 상장 최적 비용 우수 ETF 상품 큐레이션 랭킹 보드 구축 완료 |
| S3-5 | VKOSPI / Fear & Greed 다차원 시장 감정 지표 고도화 & Bento Grid UI | ✅ done | KOSPI 실현 변동성(VKOSPI 프록시) 퀀트 연산 탑재, DB 영속성 시딩, SVG 반원형 네온 리스크 게이지 및 6패널 Bento Grid 고도화 완료 |
| S3-4 | Vercel 배포 런타임 TDZ Client-Side Exception 디버깅 및 핫픽스 | ✅ done | MainApp.tsx 내 useEffect 의존성 평가 호이스팅/Temporal Dead Zone 참조 오류 해결 및 Vercel 실시간 배포 정상화 완료 |
| S3-3 | AI추천 ETF 항목 클릭 시 상세 종목 팝업창 연동 | ✅ done | AI Insight, 매크로 컴퍼스, 리밸런싱 원본/대안 ETF 대상 커스텀 이벤트 버스 연동 및 클릭 마이크로 인터랙션 완벽 구현 |
| S3-2 | 실시간 가격 변동/손절(Exit) 시그널 및 AI 리밸런싱 발생 시 텔레그램 실시간 알림 자동 스케줄러 연동 | ✅ done | daily_perf_calc 후 위험도 변화(2점 이상 변동 또는 등급 변화) 자동 감지 엔진 & AI 제안 시 실시간 rich HTML 메시지 자동 발송 연동 |
| S3-1 | Telegram 실시간 전략 알림 시스템 구축 | ✅ done | 가격 변동/손절(Exit) 시그널 및 AI 리밸런싱 발생 시 텔레그램 실시간 알림 엔진, DB, 마스킹 API 및 벤토 UI 완벽 구축 |
| S2-4 | 다계좌 리밸런싱 오더 라우팅 및 가상 체결 시뮬레이터 | ✅ done | KIS 4계좌 실시간 포트폴리오를 기반으로 AI 제안 리밸런싱 모의 주문 설계 및 가상 체결 오버레이 시뮬레이터 구현 완료 |
| S2-3 | Vercel + Render production-grade serverless 배포 스크립트 고도화 | ✅ done | vercel.json 보안 헤더 및 CORS 정책, render.yaml IaC 템플릿, deploy_verify.py 환경 진단 검증 유틸리티 구현 완료 |
| S2-2 | 로컬 SQLite ↔ PostgreSQL 무중단 복제 및 백업 스케줄러 고도화 | ✅ done | APScheduler 자동 트리거 연동, db_sync API 및 UI 정합성 관리자 패널(DbSyncControl) 구현 완료 |
| S2-1 | AI 기반 포트폴리오 자산 재조정 추천 엔진 | ✅ done | KIS 4계좌 실시간 7대 테마 분류 분석 및 Gemini API 연동 완료 |
| S1-1 | ETF 마스터 DB + 종목 분석 | ✅ done | 1,000+종목 |
| S1-2 | KIS 포트폴리오 4계좌 연동 | ✅ done | Rate limit 보호 완료 |
| S1-3 | TFF 대시보드 | ✅ done | 예수금 파싱 및 핵심 기능 작동 완료 (26.6만 원 정상 노출) |
| S1-4 | Render DB 복구 (PostgreSQL 전환) | ✅ done | 유료 $7/월 |
| S1-5 | 초기 투자금 대비 수익률 카드 | ✅ done | UI 개선 및 CORS 수정 완료 |
| S1-6 | Bootstrap / Conductor 문서화 | ✅ done | 이번 세션 |
| S1-7 | 섹터분석 고도화 | ✅ done | 국내/해외/통합 필터 및 우주/에너지 추가, 한-미 집중 비교 연동 |
| S1-8 | TFF 상세 데이터 카드화 및 고도화 | ✅ done | YtmView, MonthlyView 개별 뷰 카드화 전환 및 TypeScript 수정 완료 |
| S1-9 | 섹터별 상관관계 분석 기능 추가 | ✅ done | 섹터 간 상관계수 히트맵 및 포트폴리오 분산 효과 분석 완료 |
| S1-10 | 즐겨찾기 우주섹터 비교 오류 해결 및 폰트 일원화 | ✅ done | ARKX yfinance 다이내믹 연동 및 구성종목 비중 fallback, 박스 안팎 폰트 조화로운 표준화 완료 |
| S1-11 | 개별종목 팝업 주가현황/기업소개 중심 리디자인 | ✅ done | NAV 및 CU 구성종목 Omit 및 메타데이터 주가/기업소개 맞춤화 완료 |
| S1-12 | 개별종목 상세 미국 우주섹터 지수 및 3개월 뉴스 연동 | ✅ done | NASDAQ 벤치마크, 미국 우주섹터(ARKX) 다중 오버레이 차트 구현 및 최근 3개월 언론보도 벤토 레이아웃 연동 완료 |
 
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

## Technical Decisions

- KIS API: 초당 1건 제한 → sleep(1.2) 필수, EGW00133 → sleep(2.5) 후 재시도
- PostgreSQL: Render $7/월 유료 (90일 만료 없음), Internal URL 사용
- 캐시: 포트폴리오 5분 인메모리, ETF 마스터 5분 캐시
- 클라이언트 Excel 파싱: XLSX.js (서버 업로드 없음)

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
