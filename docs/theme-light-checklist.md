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

## 2차: 라이트 가독성 보정 (2026-10-05, 사용자 캡처 피드백)

- [x] 카드 박스가 흐림 → `border-white/5·10·15·20` 테두리를 잉크 12~26%로, 둥근 카드(2xl·3xl + 반투명/어두운 면)는 흰 면 + 옅은 그림자, 페이지 바탕 `#e6eaf1`
- [x] hex 어두운 배경 대체색을 불투명 흰색으로(sticky 표 헤더 아래로 행이 비치던 문제)
- [x] 차트 축·라벨이 흐림 → SVG `fill`·`stroke` 속성의 흰색/연회색 값을 잉크로, 아주 옅은 격자는 잉크 10%
- [x] 면 채움이 흐림 → `fill-opacity`·그라데이션 `stop-opacity` 0.06~0.4를 1.6배
- [x] 마우스 툴팁이 검정 바탕 → Recharts 툴팁(기본·커스텀)을 흰 카드로, 안쪽 흰 글자는 잉크로
- [x] 노란 글자 → `text-yellow/amber/lime/orange-400·500`(투명도 변형 포함)은 700 단계, 차트·인라인 style의 노랑·파스텔 hex 글자도 진한 색으로
- [x] 검증: `npm run build`, 실서버 화면에 새 CSS를 끼워 라이트 캡처(브라질채권 4개 차트·툴팁, 반도체 차트 툴팁·구성종목 표), 범례 글자 계산색 확인
