# Project State — ETF Lens

> **Keep this file under 200 lines.**

## Quick Summary
 
✅ Last session: S3-3 AI Insight 실데이터 연동 및 실제 성과 지표 동적 배지 전환 구현 완료
✅ Current: S3-3 VKOSPI / Fear & Greed 다차원 시장 감정 지표 고도화 & Bento Grid 프리미엄 리디자인 완료
➡️ Next: S3-4 또는 차기 스프린트 계획 수립 및 실시간 리스크 알림 전송 고도화
 
## Current Sprint
 
- Sprint: 3 — Real-Time Alerts & Advanced Analytics
- Started: 2026-05-19
- Branch: main
 
## Story Status
 
| ID | Title | Status | Notes |
|----|-------|--------|-------|
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

## Recent Changes

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
