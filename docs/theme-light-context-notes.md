# 라이트 모드 컨텍스트 노트 (2026-10-04)

## 오늘의 시장

- 기존 임베드 주소 `https://finance.richgo.ai/`는 2026-10-04 기준 HTTP 404다. 사용자가 `https://bulliza.com/`으로 바뀌었다고 알려줬다.
- bulliza.com은 200을 응답하고 X-Frame-Options·CSP frame-ancestors 헤더가 없어 iframe 임베드가 가능하다(www는 308로 루트 이동).

## 라이트 모드 방식: 팔레트 반전

- 앱 전체(70여 컴포넌트)가 어두운 화면 전제로 `text-white`, `bg-black/20`, `text-gray-400` 같은 Tailwind 클래스를 직접 쓴다.
  컴포넌트마다 `dark:` 변형을 붙이는 방식은 수천 곳을 고쳐야 해서 택하지 않았다.
- Tailwind v4 유틸리티는 색을 CSS 변수로 참조한다(`.text-white{color:var(--color-white)}`, `bg-black/20`은 `color-mix(var(--color-black) 20%)`).
  그래서 `html.light`에서 변수만 다시 정의하면 앱 전체가 바뀐다.
  - 흑백 교환: `--color-black` ↔ `--color-white`
  - 각 색 단계 반전: 50↔950, 100↔900, 200↔800, 300↔700, 400↔600, 500 유지.
    어두운 배경용 밝은 강조색(예 amber-400)이 밝은 배경에서 대비가 맞는 진한 색(amber-600)으로 바뀐다.
- 반전 값은 `node_modules/tailwindcss/theme.css`의 기본 팔레트에서 생성한다. Tailwind를 올리면 스크립트를 다시 돌린다.
- 한계: hex 직접 지정 클래스(`bg-[#161922]` 등 217곳), 인라인 style, Recharts 색 props는 변수를 거치지 않는다.
  어두운 hex 배경·그라데이션은 속성 선택자로 덮어쓰고, 차트 툴팁처럼 어두운 채로 남아도 읽히는 곳은 그대로 둔다.
- 기본은 다크. 선택은 localStorage `iprism-theme`에 저장하고, `<head>` 인라인 스크립트로 첫 화면 그리기 전에 적용한다.

## 2차 가독성 보정 (2026-10-05)

- 컴포넌트를 고치지 않고 생성 스크립트에 규칙을 더했다. 차트 색은 Recharts props로 SVG 속성(`fill="#9ca3af"`)이나
  인라인 style에 박혀 Tailwind 변수를 거치지 않는다. CSS는 SVG 표현 속성을 이기고, `!important`는 인라인 style을 이긴다.
  그래서 속성 선택자(`svg text[fill="#fbbf24" i]`, `[style^="color: rgb(251, 191, 36)"]`)로 덮는다.
- 인라인 style 선택자는 두 표기를 모두 잡는다. 클라이언트 렌더는 브라우저가 `color: rgb(r, g, b)`로 정규화하고,
  SSR 원문은 `color:#hex`다. `" color:"`(앞 공백)로 써서 `background-color`와 섞이지 않게 했다.
- 클래스 보정(테두리·카드·노랑 글자)은 `@layer utilities` 안에 `:where(html.light)`로 넣었다. 레이어 밖에 두면
  `hover:border-…` 같은 변형까지 이겨 버린다. 특이도를 기본 클래스와 같게 맞추고 뒤에 오게 해서 변형이 계속 이긴다.
- 선 색(시리즈 stroke)은 바꾸지 않았다. 흰 바탕에서도 선은 보이고, 바꾸면 범례 점·선과 툴팁 색이 어긋난다.
  글자(축 눈금·범례·툴팁·표 숫자)만 같은 계열의 700 단계로 진하게 한다.
- 남은 한계: 위 목록에 없는 hex 글자색, 차트 밖 모달의 인라인 어두운 배경(ExitSignalModals 등)은 미확인이다.
