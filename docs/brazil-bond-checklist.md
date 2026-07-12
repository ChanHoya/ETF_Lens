# 브라질채권 서브탭 — 구현 체크리스트

기획 원문: `~/.claude/plans/prancy-munching-hearth.md` (승인본)

- [x] 0. 사용자 플레이북 원문 수령 → `docs/brazil-bond-playbook.md` 저장, 신호 임계값 확정(14.2/14.7/15.0 · 290원)
- [x] 1. `backend/core/brazil_fetcher.py` + `BrazilSeries` 모델 + 스케줄러 잡 → 9개 시리즈 적재 확인(플레이북 수치 일치)
- [x] 2. `backend/api/brazil_bond.py` summary/history → TestClient 200 확인
- [x] 3. 신호 엔진 (2축 Activation Zone) → 경계값 유닛 테스트 PASS
- [x] 4. AI insight (Gemini) 생성/저장 → 생성·GET 재조회 확인(판정=관망, 현 신호와 일치)
- [x] 5. `BrazilBondTab.tsx` + MainApp 서브탭 연결 → 종목 미선택 진입 확인(실화면)
- [x] 6. 스코어보드 + 차트(금리 사이클/환율/캐리쿠션) + Activation Zone 신호 UI
- [x] 7. 캐리 쿠션 수익 시뮬레이터 + 실행 가이드/체크리스트(정적)
- [x] 8. 알림 연동 (신호 전환·Copom/대선 D-day) → 함수 실행 확인(텔레그램 미설정 시 graceful)
- [x] 9. 최종 검증: TestClient 전체 + `npm run build`(성공) + 실화면 스크린샷 확인

**완료 (2026-07-12).** 미해결: 브라질 10Y/Tesouro 채권별 시세는 미구현(플레이북엔 5년물만 사용 → 불필요), y5 스크레이핑 히스토리는 오늘부터 누적.
