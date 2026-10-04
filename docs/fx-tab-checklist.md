# 시장동향 > 환율 하위 탭 1단계 체크리스트 (2026-10-05)

기획은 `fx-dashboard-plan.md`, 결정 근거는 `fx-tab-context-notes.md`.

- [x] 백엔드 `backend/api/fx_dashboard.py` — FRED·Yahoo 수집, 주간 정렬, 스냅샷·국면 계산, 6시간 캐시, `GET /api/v1/fx/overview`
- [x] main.py 라우터 등록
- [x] 계산 로직 단위 테스트 `backend/tests/test_fx_dashboard.py` (네트워크 없이 가짜 시계열)
- [x] 프론트 `dashboard/src/components/FxTab.tsx` — 스냅샷 카드·판정 배지, 차트 A(원/달러 vs DXY + 국면 음영), 차트 B(10년물 금리차 vs 원/달러), 국면 타임라인 표(행 선택 ↔ 음영 강조)
- [x] MainApp — 시장동향 서브탭 바(시장 개요 | 환율), activeTab 'fx'
- [x] pytest, `npm run build`, 로컬 캡처(다크·라이트)
- [ ] 커밋·푸시 후 실서버 확인

검증: pytest tests 75 통과(기존 실패 test_semi_cycle 2건은 무관), 새 테스트 6건 포함. `npm run build` 성공, `tsc --noEmit`에서 FxTab·MainApp 오류 없음.
실제 FRED·Yahoo 수집으로 주간 1,045점·국면 14개 계산 확인. 로컬 3100 빌드에 실데이터 JSON을 끼워 다크·라이트·가로 모바일(844px) 캡처 확인.
캡처로 고친 것: 금리차 축 음수 부호 잘림(여백 0·폭 48·tickFormatter), 0선 라벨이 선과 겹침(설명문으로 이동).
