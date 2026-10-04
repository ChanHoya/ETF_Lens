# 시장동향 > 환율 하위 탭 1단계 체크리스트 (2026-10-05)

기획은 `fx-dashboard-plan.md`, 결정 근거는 `fx-tab-context-notes.md`.

- [ ] 백엔드 `backend/api/fx_dashboard.py` — FRED·Yahoo 수집, 주간 정렬, 스냅샷·국면 계산, 6시간 캐시, `GET /api/v1/fx/overview`
- [ ] main.py 라우터 등록
- [ ] 계산 로직 단위 테스트 `backend/tests/test_fx_dashboard.py` (네트워크 없이 가짜 시계열)
- [ ] 프론트 `dashboard/src/components/FxTab.tsx` — 스냅샷 카드·판정 배지, 차트 A(원/달러 vs DXY + 국면 음영), 차트 B(10년물 금리차 vs 원/달러), 국면 타임라인 표(행 선택 ↔ 음영 강조)
- [ ] MainApp — 시장동향 서브탭 바(시장 개요 | 환율), activeTab 'fx'
- [ ] pytest, `npm run build`, 로컬 캡처(다크·라이트)
- [ ] 커밋·푸시 후 실서버 확인
