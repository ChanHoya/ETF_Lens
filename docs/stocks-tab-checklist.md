# ② 시장동향 > 주식 하위 탭 1단계 체크리스트 (2026-10-05)

결정 근거는 `stocks-tab-context-notes.md`. 브랜치 `feat/stocks-tab`.

- [ ] 백엔드 `backend/api/stocks_dashboard.py` — Yahoo 주간 20년(KOSPI·S&P500·Nasdaq), FRED(원/달러·미 10년), multpl(S&P PER·CAPE·이익수익률), OverviewCache
  - 스냅샷: 지수별 1주·1개월·연초 이후·1년 수익률, 고점 대비 낙폭, 52주 범위 위치, 10·20년 연평균 수익률
  - KOSPI 달러 환산, KOSPI–S&P 52주 롤링 상관
  - S&P 밸류에이션: PER·CAPE의 20년 백분위, 주식 위험 프리미엄(이익수익률 − 미 10년)
  - 강세장·약세장 이정표: 지수별 고점·저점 20% 반전(regime_auto.zigzag 재사용), AI 설명은 백그라운드로 채움
- [ ] main.py 라우터·예열 등록, 테스트 `backend/tests/test_stocks_dashboard.py`
- [ ] 프론트 `StocksTab.tsx` + MainApp 서브탭 "주식"(금리 오른쪽), useCachedOverview·RegimeMilestones 재사용
- [ ] 코드 리뷰, pytest, build, tsc, 캡처(다크·라이트)
- [ ] PR 생성·병합, 실서버 확인
