# 라이트 모드 토글·오늘의 시장 주소 체크리스트 (2026-10-04)

결정 근거는 `theme-light-context-notes.md`.

- [x] 오늘의 시장: `finance.richgo.ai`(404) → `bulliza.com`으로 교체, 모달 라벨 수정, 임베드 동작 확인
- [x] 라이트 팔레트 생성 스크립트 `dashboard/scripts/generate-light-theme.py` → `src/app/theme-light.css`
- [x] hex 직접 지정 어두운 배경·그라데이션(`bg-[#0…]`, `bg-[#1…]` 등) 라이트 덮어쓰기
- [x] 첫 화면 깜빡임 방지: layout `<head>`에서 저장된 테마를 그리기 전에 적용
- [x] 상단 바 Dark / Light 토글 스위치(전체화면 버튼 옆), localStorage `iprism-theme` 저장
- [x] 주요 탭(종목선택·섹터분석·시장동향·브라질채권) 라이트 캡처로 눈에 띄는 깨짐 수정 — My·TFF·데이터가 채워진 차트 화면은 미확인
- [x] push 후 실서버 확인 (Vercel success, 라이브 HTML에 테마 스크립트·CSS에 html.light 규칙 확인)

검증: `npm run build` 성공, 새 빌드를 3100 포트로 띄워 라이트·다크 캡처(종목선택·섹터분석·시장동향·브라질채권) 확인.
라이트에서 사라졌던 종합 위험지수 게이지 바탕 호(흰색 rgba 고정)를 currentColor로 바꿔 수정.
주의: 이미 떠 있던 `next dev`는 새 CSS import(theme-light.css)를 반영하지 못했다. 로컬에서 라이트가 안 바뀌면 dev 서버를 재시작한다.
남은 한계: 인라인 style·차트 툴팁 등 hex 직접 지정 색은 어두운 채로 남을 수 있다. 눈에 띄는 곳은 발견 시 currentColor·토큰으로 교체한다.
