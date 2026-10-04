# 브라질채권 탭 1시간 경과 자동 갱신 체크리스트 (2026-10-05)

결정 근거는 `brazil-autorefresh-context-notes.md`.

- [x] 백엔드: /news 응답에 서버 마지막 수집 시각 `synced_at`
- [x] 백엔드: /summary 응답에 이벤트 캘린더 마지막 동기화 시각 `catalysts_synced_at`
- [x] 백엔드: /catalysts/sync `recent_days` — 자동 갱신은 최근 N일 이벤트만 강제 재분석, 수동 편집본 보존
- [x] 백엔드 테스트
- [x] 프론트: 탭 진입·창 복귀·5분 폴링 때 기준 시각이 1시간 넘은 항목(AI 리포트, 대선 정세 Pulse, 이벤트 캘린더, 뉴스)을 수동 버튼과 같은 경로로 자동 갱신
- [x] 프론트: 대선 인텔리전스 팝업을 열 때 1시간 넘었으면 AI 갱신 자동 실행(수동 편집 후 24시간은 보존), 갱신 시각 표시
- [x] 프론트: 자동 갱신 중에도 각 버튼 스피너 표시, 실패 시 같은 항목 10분 뒤 재시도, 뉴스 "갱신" 시각을 서버 수집 시각으로
- [x] pytest, build, tsc, 로컬 확인
- [ ] 커밋·푸시 후 실서버 확인

검증: pytest tests 81 통과(새 테스트 2건, 기존 실패 test_semi_cycle 2건 무관), build 성공, tsc는 기존 ActivationZone 4건 외 새 오류 없음.
로컬 3100 빌드에서 API 응답의 기준 시각을 바꿔 확인(POST는 가짜 응답으로 가로채 Gemini 미호출).
- 2시간 전: 탭 진입 시 뉴스 refresh=true, insight/generate, election-pulse/generate, catalysts/sync?force=true&recent_days=7 각 1회. 팝업 열 때 election-intel/refresh 1회.
- 5분 전: 자동 갱신 요청 없음. 팝업 상단에 "AI 갱신 시각" 표시 확인.
