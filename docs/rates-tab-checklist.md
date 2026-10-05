# 시장동향 > 금리 하위 탭 1단계 체크리스트 (2026-10-05)

기획은 `rates-dashboard-plan.md`, 결정 근거는 `rates-tab-context-notes.md`.

- [x] 백엔드 `backend/api/rates_dashboard.py` — ECOS(키)·FRED 수집, 10분 캐시, `GET /api/v1/rates/overview`
  - 스냅샷: 한·미 기준금리(최근 변경·다음 회의 D-day), 한미 정책금리차, 국고채 3·10년·미 2·10년(bp 변화·10년 백분위), 시장 내재 기대(1년물−기준금리), 실질 기준금리(기준금리−CPI)
  - 장단기 금리차: 한 10Y−3Y, 미 10Y−2Y·10Y−3M, 곡선 형태(베어/불 × 스티프닝/플래트닝), 역전 구간과 이후 미국 침체까지 시차, 수익률곡선(오늘·1개월 전·1년 전)
  - 한국 기준금리 국면 타임라인(구간 값은 데이터에서 계산)
- [x] main.py 라우터 등록, 단위 테스트 `backend/tests/test_rates_dashboard.py`
- [x] 프론트 `RatesTab.tsx` + MainApp 서브탭 "금리"(환율 오른쪽)
- [x] 접속 시점 현행화: 탭 진입 시 조회, 창 복귀·열어 둔 동안 10분 지나면 재조회, 서버 캐시 10분
- [x] pytest, build, tsc, 캡처(다크·라이트)
- [x] 커밋·푸시 후 실서버 확인 (Render ecos_key True·22개 시리즈 수집, Vercel success, 실서버 탭에 국면 배지·역전 이력 표시)

검증: pytest tests 88 통과(새 금리 테스트 7건, 기존 실패 test_semi_cycle 2건 무관), build 성공, tsc에서 RatesTab·MainApp 오류 없음.
실데이터(ECOS 키·FRED) 수집 11.5초, 22개 시리즈 모두 관측치 있음. 로컬 3100에 실데이터 JSON으로 다크·라이트 캡처 확인.
실데이터로 고친 것: 동결 구간이 경계 변경을 포함하던 값(2.5→2.25), 미국 CPI 전년비(2025-10 결측으로 행 기준 오계산),
데이터 시작에 걸린 1981 침체 시작일, 1998 짧은 역전이 2001 침체를 가져가던 연결.
