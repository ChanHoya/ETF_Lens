# ③ 시장동향 > 종합분석 하위 탭 체크리스트 (2026-10-05)

결정 근거는 `macro-tab-context-notes.md`. 브랜치 `feat/macro-tab`.

- [ ] 백엔드 `backend/api/macro_dashboard.py` — 환율·금리·주식 서버 캐시를 읽어 종합(새 원천 수집 없음), OverviewCache
  - 국면 진단(금리 방향 × 달러 방향 × 주식 추세)과 점수표
  - 과거 유사 국면 Top 3(주간 8개 특징 z점수 거리) + 이후 6·12개월 결과
  - 자산 연결 지도(최근 52주 vs 10년 상관, 평소와 가장 달라진 쌍)
  - 통합 타임라인 데이터(금리·환율·KOSPI 국면 3트랙)
  - 이벤트 시나리오(다음 금통위·FOMC, 시장 반영 경로, 결과별 일반적 영향)
  - 자산배분 시사점(주식·채권·달러·현금 근거 점수) + AI 종합 코멘트(6시간, 백그라운드)
- [ ] main.py 라우터·예열, 테스트 `backend/tests/test_macro_dashboard.py`
- [ ] 프론트 `MacroTab.tsx`(+ 3트랙 타임라인) + MainApp 서브탭 "종합"(주식 오른쪽)
- [ ] 코드 리뷰, pytest, build, tsc, 캡처
- [ ] PR 생성·병합, 실서버 확인
