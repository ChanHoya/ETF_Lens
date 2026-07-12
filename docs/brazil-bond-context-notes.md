# 브라질채권 서브탭 — 컨텍스트 노트

작업 중 내린 결정과 이유를 기록한다. (2026-07-12 시작)

## 데이터 소스 결정
- **BCB SGS API 채택** (무인증 JSON, 검증 완료). Selic 목표=432, IPCA 12개월 누적=13522, USD/BRL PTAX=1.
  - 주의: 날짜가 `dd/mm/yyyy` 형식. Selic 목표(432)는 차기 COPOM 회의일까지 미래 날짜가 선반영되어 내려옴 → 오늘 이후 데이터는 절단해야 함.
- **Focus 서베이**: Olinda OData API 검증 완료. 연말 컨센서스(중앙값) 사용.
- **Tesouro Direto 구 JSON API는 사망** (`gone` 응답, 2026-07-12 확인). 채권별 시세는 대체 소스 프로빙, 실패 시 위젯 미표시로 성립하게 설계.
- BRL/KRW는 직접 소스가 없어 크로스 계산 (USD/KRW ÷ USD/BRL).

## 아키텍처 결정
- 브라질채권은 '섹터분석'이 아닌 **'종목분석' 메인 탭의 서브탭** (사용자 명시). 커버드콜과 같은 층위.
- MainApp의 `if (subTab.id !== 'select' && !data) alert(...)` 가드에서 brazil은 예외 — 종목 선택 없이 진입 가능해야 함.
- AI 리포트는 `sector_insight.py` 패턴 복제하되 별도 라우터(`api/brazil_bond.py`)에 구현. 이유: 스키마가 주식 섹터용(tab1/etfs/strategy)과 완전히 다름. DB 테이블은 `SectorInsight`(sector='brazil_bond') 재사용.
- 수익 시뮬레이터는 프론트 계산. 이유: 입력 즉시 반응해야 하고 수식이 단순(쿠폰+자본차익+환손익), 백엔드는 초깃값(현재 환율·금리)만 제공.

## 참고자료 상태
- claude.ai 공유 대화: Cloudflare 봇 차단으로 자동 수집 불가 (headless/headful Chrome 모두 차단).
- NotebookLM "Brazil Bond Tactical Playbook": 구글 로그인 필요로 수집 불가.
- 사용자가 원문 붙여넣기로 제공하기로 함 → 수령 시 `docs/brazil-bond-playbook.md`에 저장, 신호 임계값·AI 프롬프트 보정.
- 수령 전까지 신호 임계값은 표준 프레임워크 값(코드에 PLAYBOOK_TODO 주석으로 표기).

## 시장 컨텍스트 스냅샷 (2026-07-12)
- Selic 14.25% (15.0% 고점에서 인하 사이클 진행 중), IPCA 12m 4.64%, 실질금리 약 9.6%p, USD/BRL 5.11.

## 구현 중 확정된 데이터 소스 세부 (재현 시 주의)
- **5년물 국채금리(신호 핵심축)**: investing.com `/rates-bonds/brazil-5-year-bond-yield` 스크레이핑으로 해결(14.28%). Tesouro Direto 구 JSON API는 사망(410). 스크레이핑 실패 시 graceful(위젯 미표시). 히스토리는 수집 시작일부터 누적됨.
- **SGS 일별 시리즈(Selic 432, PTAX 1)**: `ultimos/N`에 N이 크면 "최대 10년 윈도우" 400 에러 → `dataInicial+dataFinal`(9년)로 조회. 일시 실패 시 `ultimos/1000` 폴백.
- **Selic 432는 차기 Copom까지 미래 날짜 선반영** → 오늘 이후 절단 필수(fetcher에 처리됨).
- **Focus(olinda OData)**: ① 공백을 `+`로 인코딩하면 400(파서 버그) → URL을 `%20`으로 직접 구성. ② `baseCalculo eq 0`를 필터에 넣으면 타입충돌 400 → 파이썬에서 거름. 엔티티=`ExpectativasMercadoAnuais`, `DataReferencia eq '2026'`(문자열).
- **BRL/KRW**: 직접 소스 없음 → USD/KRW(FinanceDataReader) ÷ USD/BRL(SGS) 크로스. 293.4원(플레이북 292~294 일치).

## 신호 엔진 임계값 (플레이북 §2 Activation Zone — 확정)
- 금리축: <14.2 관망 / 14.2~14.7 Tranche1 / 14.7~15.0 Tranche2 / >15.0 리스크재평가.
- 환율축: ≤290 진입 활성 / >290 관망. 두 조건 AND.
- 현재(y5 14.28, fx 293.4) → **WATCH**(환율 미충족). 플레이북의 "타겟 근접 중" 상태와 정확히 일치.
- 코드: `backend/api/brazil_bond.py:compute_signal()` (순수함수, 유닛테스트 `scratch/test_brazil_endpoints.py`).

## 최종 산출물 (파일)
- 백엔드: `db/models.py`(BrazilSeries), `core/brazil_fetcher.py`, `api/brazil_bond.py`, `main.py`(라우터 등록), `core/scheduler.py`(08:30 KST 잡).
- 프론트: `dashboard/src/components/BrazilBondTab.tsx`, `MainApp.tsx`(서브탭 연결).
- 검증 스크립트: `backend/scratch/test_brazil_fetcher.py`, `backend/scratch/test_brazil_endpoints.py`.
- API prefix: `/api/v1/brazil-bond` (summary / history / insight / insight/generate).
