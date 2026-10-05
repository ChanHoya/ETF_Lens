# ② 시장동향 > 주식 하위 탭 1단계 체크리스트 (2026-10-05)

결정 근거는 `stocks-tab-context-notes.md`. 브랜치 `feat/stocks-tab`.

- [x] 백엔드 `backend/api/stocks_dashboard.py` — Yahoo 주간 20년(KOSPI·S&P500·Nasdaq), FRED(원/달러·미 10년), multpl(S&P PER·CAPE·이익수익률), OverviewCache
  - 스냅샷: 지수별 1주·1개월·연초 이후·1년 수익률, 고점 대비 낙폭, 52주 범위 위치, 10·20년 연평균 수익률
  - KOSPI 달러 환산, KOSPI–S&P 52주 롤링 상관
  - S&P 밸류에이션: PER·CAPE의 20년 백분위, 주식 위험 프리미엄(이익수익률 − 미 10년)
  - 강세장·약세장 이정표: 지수별 고점·저점 20% 반전(regime_auto.zigzag 재사용), AI 설명은 백그라운드로 채움
- [x] main.py 라우터·예열 등록, 테스트 `backend/tests/test_stocks_dashboard.py`
- [x] 프론트 `StocksTab.tsx` + MainApp 서브탭 "주식"(금리 오른쪽), useCachedOverview·RegimeMilestones 재사용
- [x] 코드 리뷰, pytest, build, tsc, 캡처(다크·라이트)
- [ ] PR 생성·병합, 실서버 확인

검증: pytest tests 111 통과(새 주식 테스트 6건·지그재그 회귀 1건, 기존 실패 test_semi_cycle 2건 무관), build 성공, tsc에서 StocksTab·MainApp 오류 없음.
실데이터 결과: KOSPI 7,004(고점 9,052 대비 −22.6%, 약세장 진행 중, 1년 +107%), S&P500 고점 −0.8%, Nasdaq 사상 최고.
S&P CAPE 41.4(20년 중 최고), 위험 프리미엄 −1.44%p(20년 하위 4%). KOSPI–S&P 상관 0.36. 수집 2.9초(로컬).
코드 리뷰·검증 중 고친 것:
- 20년 연평균 수익률이 비던 문제(첫 관측이 정확히 20년 전 날짜보다 며칠 늦음) → 첫 값 사용.
- S&P·Nasdaq에서 2007~2009 금융위기 약세장이 빠지던 문제 → 첫 전환점을 먼저 20% 반전한 쪽으로 정하고(zigzag_auto),
  이미 20% 오른 고점은 직전 저점을 살짝 깨도 유지(하락 확정을 기다림). 회귀 테스트 추가.
- 가치평가 차트: 2009년 PER 120대 급등이 축을 망가뜨려 왼쪽 축을 60에서 자름(툴팁은 실제 값), 연도 눈금 중복 제거.
- 임시 DB + 실제 Gemini로 과거·현재 국면 문구 확인(S&P 2007~09 "글로벌 금융위기 심화", KOSPI 현재 "고금리 장기화, 실적 불안" 뉴스 8건 기반).
