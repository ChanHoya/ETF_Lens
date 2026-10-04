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
