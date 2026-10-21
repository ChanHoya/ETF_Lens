---
name: web-design-guidelines
description: |
  Audit and enforce production-grade accessibility (a11y), usability, and edge-case resilience based on Vercel and WCAG standards.
  Use this skill to inspect keyboard navigation, visible focus rings, color contrast ratios, touch targets,
  empty states, loading skeletons, and error recovery flows across web applications.
license: MIT
metadata:
  version: v1
  category: accessibility-usability
---

# Web Design Guidelines: Accessibility & Usability Audit

Vercel 디자인 규칙 및 W3C WCAG 가이드라인에 기반하여 웹 애플리케이션의 접근성(a11y), 사용성, 그리고 엣지 케이스 복원력을 엄격히 점검합니다.

## 1. 접근성(a11y) 핵심 검증 항목

1. **시맨틱 HTML 마크업**
   - 단순 `div` 남발을 금지하고 `nav`, `main`, `section`, `article`, `header`, `footer`를 명확히 구조화합니다.
   - 클릭 가능한 모든 인터랙션 요소는 `button` 또는 `a` 태그여야 하며, 아이콘 단독 버튼에는 `aria-label`을 필수 부여합니다.

2. **완전한 키보드 내비게이션 및 Focus Ring**
   - 마우스 없이 Tab 키만으로 모든 폼, 버튼, 모달을 제어할 수 있어야 합니다.
   - `outline: none`으로 포커스 표시를 지우는 행위를 엄격히 금지하며, 고대비 `:focus-visible` 링(예: `ring-2 ring-primary ring-offset-2`)을 보장합니다.
   - 모달이나 드로어가 열렸을 때 포커스가 배경 뒤로 빠져나가지 않는 Focus Trap을 적용합니다.

3. **WCAG 2.1 AA 색상 대비비**
   - 일반 텍스트는 배경과의 명도 대비가 최소 4.5:1 이상이어야 합니다.
   - 큰 텍스트(18pt 이상 또는 14pt 볼드 이상)는 최소 3:1 이상의 대비를 확보해야 합니다.
   - 플레이스홀더나 보조 설명 문구도 최소 3:1 이상을 유지하여 읽기 불편함이 없도록 합니다.

## 2. 모바일 및 반응형 사용성

1. **최소 터치 타깃 (Touch Target Size)**
   - 모바일 및 터치 환경에서 클릭 가능한 요소의 최소 영역은 44x44px 이상이어야 합니다.
   - 아이콘이 작더라도 클릭 패딩 영역(`p-2` 또는 `min-h-[44px]`)을 확보합니다.

2. **레이아웃 시프트 방지 (Cumulative Layout Shift)**
   - 이미지, 폰트 로딩, 비동기 데이터 수신 시 화면이 덜컹거리며 아래로 밀리지 않도록 고정된 종횡비(aspect-ratio)나 스켈레톤(Skeleton UI)을 선배치합니다.

## 3. 완전한 상태(State) 처리

- **Loading State**: 스피너 대신 콘텐츠 형태를 본뜬 스켈레톤 UI를 제공합니다.
- **Empty State**: 데이터가 없을 때 텅 빈 화면 대신 원인과 해결 액션(예: "데이터 추가하기" 버튼)을 친절히 안내합니다.
- **Error State**: 무엇이 잘못되었는지 사용자가 이해할 수 있는 언어로 설명하고 재시도(Retry) 버튼을 제공합니다.

## 4. Web Design Guidelines 체크리스트

- [ ] Tab 키만으로 페이지의 모든 조작계에 접근 및 실행이 가능한가?
- [ ] 텍스트와 배경 사이의 색상 대비가 4.5:1 이상을 충족하는가?
- [ ] 터치 타깃이 모바일에서 너무 좁지 않은가?
- [ ] 로딩/빈 상태/에러 상태가 모두 우아하게 처리되어 있는가?
