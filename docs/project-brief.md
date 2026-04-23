# Project Brief — ETF Lens

## Vision

한국 개인 ETF 투자자를 위한 **올인원 ETF 인텔리전스 플랫폼**.
실질 보수(TER), 종목 중복도, KIS 포트폴리오 실시간 연동, AI 분석을 하나의 대시보드에서 제공한다.

## Goals

1. ETF 심층 비교 (실질 TER, 샤프지수, MDD)
2. KIS API 4계좌 포트폴리오 실시간 추적
3. 초기 투자금 대비 실제 수익률 계산 (KIS 자동 + 수동 입력)
4. TFF 펀드 엑셀 기반 월별 성과 시각화
5. Gemini AI 기반 주식/ETF 분석 채팅

## Non-Goals

- 매수/매도 주문 실행 (조회 전용)
- 해외 ETF 직접 분석 (KIS 해외 잔고 표시만)
- 모바일 네이티브 앱 (반응형 웹만)

## Target Users

한국 KIS 증권 계좌 보유 ETF 장기 투자자 / 소규모 펀드 매니저

## Key Technical Decisions

| 결정 | 이유 |
|---|---|
| FastAPI + async | KIS API 다계좌 순차 조회 최적화 |
| Next.js App Router | Vercel 무료 배포 + SSR |
| PostgreSQL (Render) | SQLite 대비 동시 연결 안정성 |
| 인메모리 포트폴리오 캐시 (5분) | KIS Rate Limit 보호 |
| 엑셀 파싱 클라이언트사이드 | 서버 업로드 없이 보안 강화 |

## Decision Log

| 날짜 | 결정 | 이유 |
|---|---|---|
| 2026-04-23 | Render PostgreSQL 유료 전환 ($7/월) | 90일 무료 만료 문제 해결 |
| 2026-04-23 | KIS cashflow API (TTTC8508R) 추가 | 초기 투자금 자동 조회 |
| 2026-04-15 | etf_data_v2.db .gitignore | 88MB 바이너리 push 타임아웃 방지 |
