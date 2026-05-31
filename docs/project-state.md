# Project State — ETF Lens

> **Keep this file under 200 lines.**

## Quick Summary
 
Base: Exit Strategy Monitoring (KOSPI)
✅ Current: Sprint 5 — 글로벌 매크로 스트레스 테스트, 환율/절세 시뮬레이터, 우주 및 바이오 ETF 구성종목 변동 그래프/개별 주식 팝업 연동, 특정 ETF 선택 시 테이블/차트 구성종목 10종 필터링 고도화, My 탭 내 보유 자산 정보 기반 AI Assistant 서비스 연동/바로가기 위젯 추가, 우주섹터 미국 신규 ETF 5종 추가/한-미 마켓 토글 전환 테이블/차트 고도화 및 미국 증시 시차에 따른 NaN% 렌더링 핫픽스 완료, 포트폴리오 현황 트리맵 및 대시보드 뷰 매수/수익금액 정보 추가 및 파랑(+)/빨강(-) 커스텀 색상 매핑 완료, 상단 헤더 수익 지표 레이블을 '누적 총 수익'으로 변경 완료, AI Assistant 팝업 모달 가로폭 확장(960px) 완료, 우주섹터 구성종목 테이블 우측에 실시간 가격 및 변동률(yfinance quotes) 연동 완료, ETF 괴리율(Indicative NAV Gap) 실시간 모니터링 및 텔레그램 알림 연동 완료, 우주 ETF 테이블 헤더 예상 성과 및 실시간 괴리율 2단 레이아웃 개선 완료, 보유자산 괴리율 국내/해외 임계치 분류 및 다중 계좌 중복 병합 노출 기능 추가, 보유 ETF 경쟁력 분석 카드 내 괴리율 수준값 등급 표시 추가 완료, 상세 모달 과거 NAV 데이터 실제 API 연동 및 1D 장마감 오버레이 추가, gap-fill 날짜 DB 영구저장 + Wisereport NAV 즉시 매칭으로 5/27 iNAV 누락 버그 수정 완료, 미국 ETF 최신 holdings dynamic 연동 및 국내 상장 해외/합성 ETF의 주식수 기반 비율 차트 렌더링과 비중 fallback 연동 완료, 우주섹터 구성종목 테이블 우측 상단 기준일자 정보를 실시간 수집 시각(KST)으로 동적 연동 완료, 당일 체결내역(RecentTrades) 섹션 삭제 완료, 우주테크 관련 ETF 동종 비교 전용 카테고리(우주항공·우주테크) 분리 매핑 완료, 우주섹터 미국상장 ETF 중 MARS를 XOVR로 교체 완료, KIS 우주항공 ETF 잔고 코드 맵핑 매칭 및 alphanumeric 국내 종목코드 필터 예외 처리 고도화 완료, 최근 상장 ETF 등 데이터가 부족한 기간(3개월 등) 선택 시 툴팁(CustomTooltip) 내 undefined 값에 대한 toFixed(1) 호출로 인한 클라이언트 크래시 핫픽스 완료, 실시간 괴리율 경보 5단계 투자지침형 등급 체계 개편(매수 검토/관망, 안정, 매도 관망/검토) 및 HoldingsSignals 동기화 완료, TFF 종목별 수익률 요약표 테이블 구현 및 포트폴리오 현황 예수금 반영 누락 핫픽스, 종목명 클릭 시 상세 팝업창 연동 및 공백/변형 종목명 매핑 핫픽스, 5월 엑셀 병합 셀 및 누적 데이터 파싱 오류 핫픽스 완료, 미보유 자산 0.0%의 N/A 출력 개선 및 가상 벤치마크 지수(항셍, 채권, 금 등) 소수점 스케일 오류 핫픽스 완료
➡️ Next: 다음 스프린트 계획 수립 예정 (S5-14 피드백 반영 및 검증 완료)


 
## Current Sprint
 
- Sprint: 5 — Advanced Risk Analysis & Tax Optimization
- Started: 2026-05-23
- Branch: main
 
## Story Status
 
| ID | Title | Status | Notes |
|----|-------|--------|-------|
| S5-14 | TFF 종목별 수익률 엑셀 원본 테이블 구현 및 예수금 핫픽스 | ✅ done | 종목별 수익률 탭 내 엑셀 레이아웃 그대로 반영된 요약표 추가, 현금(예수금) 파싱 알고리즘 최적화, 종목명 클릭 시 상세 팝업창 연동 및 공백/변형 종목명 매핑 핫픽스 완료, 미보유 자산 N/A 처리 및 가상 벤치마크 지수 소수점 스케일링 오류 핫픽스 완수 |
| S5-13 | 실시간 괴리율 경보 5단계 투자지침형 등급 체계 개편 | ✅ done | 괴리율 마이너스(-) 시 '매수 검토/관망', 플러스(+) 시 '매도 관망/검토' 5단계 안내 및 색상 매핑 개편 완료, HoldingsSignals 연동 완료 |
| S5-11 | 상세 모달 내 실제 과거 NAV 데이터 프론트엔드 연동 및 1D 차트 마감 상태 표시 | ✅ done | DB 스키마 수정 및 wisereport AJAX API 연동, 모달 내 random 데이터 제거 및 실제 NAV 데이터 연동, 1D 차트 KST 기준 장 마감 상태 오버레이 연동, CoveredCallTab.tsx 데드코드 제거 완료 |
| S5-12 | ETF 구성종목(CU) 데이터 보완 및 yfinance dynamic holdings 연동 | ✅ done | 미국 ETF 최신 구성종목 dynamic 연동 및 국내 상장 해외/합성 ETF의 주식수 기반 비율 차트 렌더링과 비중 fallback 연동 완료, 우주섹터 구성종목 테이블 우측 상단 기준일자 정보 실시간 수집 시각(KST)으로 동적 연동 완료 |


| S5-10 | ETF 괴리율(NAV Gap) 실시간 모니터링 및 텔레그램 알림 시스템 구축 | ✅ done | 실시간 괴리율 계산 API, 보유 자산 연동, 09:10/15:15 KST 텔레그램 경보 스케줄러, 프론트 대시보드 Bento 경보 및 우주/바이오 구성종목 헤더 괴리율 배지 연동 완료 |
| S5-9 | 우주섹터 구성종목 테이블 우측에 당일 실시간 가격 / 전일대비 변동률 정보 연동 | ✅ done | yfinance v8 차트 API 및 5분 메모리 캐시 활용, 양수 파랑(+)/음수 빨강(-) 커스텀 컬러 스타일 바인딩 완료 |
| S5-8 | 포트폴리오 현황 트리맵 및 대시보드 뷰 매수/수익금액 정보 추가 및 색상 매핑 고도화 | ✅ done | 툴팁 및 카테고리 뱃지 카드에 매수/수익금액 노출, 수익 파랑(+)/빨강(-) 커스텀 색상 매핑, 대시보드 우측 상단 메트릭에 매수금액 표시 완료 |
| S5-7 | 우주섹터 미국 신규 ETF 5종 연동 및 한/미 마켓 토글 테이블 고도화 | ✅ done | 비교 차트에 미국 ETF 5종(UFO/MARS/NASA/ORBX/WARP) 추가, 범례 분리 배치(국내 윗줄/미국 아랫줄), 차트 및 테이블 상단 한/미 마켓 토글 버튼 연동 및 비중 동적 렌더링 구현, 시차로 인한 미국 종목 NaN% 오류 해결 |
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
