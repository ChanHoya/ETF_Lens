---
name: emil-design-eng
description: |
  Master fluid, physics-based micro-interactions, spring transitions, and refined motion details inspired by Emil Kowalski.
  Use this skill to polish stiff animations, linear transitions, jerky popovers, clumsy accordion toggles, and abrupt UI state shifts.
  Ensures snappy response times, natural spring damping, tactile feedback, and strict adherence to prefers-reduced-motion.
license: MIT
metadata:
  version: v1
  category: animation-interaction
---

# Emil Design Engineering: Fluid Interactions & Micro-Motions

뻣뻣하고 인위적인 선형(linear) 트랜지션을 탈피하고, Emil Kowalski 스타일의 물리 기반 스프링(Spring) 애니메이션과 세련된 마이크로 인터랙션을 설계·구현합니다.

## 1. 물리 기반 모션 설계 원칙

1. **지루한 `ease-in-out` 대신 물리 스프링(Spring) 사용**
   - 웹 기본 `transition: all 0.3s ease`는 뻣뻣하고 생명력이 없습니다.
   - Framer Motion, Motion One, 또는 정교한 베지어 커브(`cubic-bezier(0.16, 1, 0.3, 1)`)를 적용하여 출발은 즉각적이고 도착은 쫀득하게 안착하도록 만듭니다.
   - 표준 스프링 파라미터 권장치:
     - 팝오버/툴팁: `stiffness: 400, damping: 30` (민첩하고 가벼운 피드백)
     - 모달/다이얼로그: `stiffness: 300, damping: 28` (안정적이고 무게감 있는 진입)
     - 탭 전환/슬라이더: `stiffness: 500, damping: 35` (지연 없는 쾌적한 추종)

2. **반응형 상태 피드백 (Tactile State Response)**
   - 버튼 클릭 시 미세한 스케일 축소(`scale: 0.98` 또는 `scale: 0.97`)로 실제 물리적 스위치를 누르는 듯한 조작감을 제공합니다.
   - 호버 시에는 위치를 크게 흔들지 않고, 미세한 배경색 변화나 은은한 보더 명도 조절로 힌트를 줍니다.

3. **연속적 레이아웃 애니메이션 (Layout Transitions)**
   - 아코디언, 탭, 필터링 시 높이가 갑자기 뚝 끊기거나 덜컹거리지 않도록 부드러운 높이 전환(`auto` 높이 애니메이션)을 구현합니다.
   - 아이템 추가/삭제 시 주변 요소들이 자연스럽게 밀려나고 채워지도록 FLIP 기반 모션을 지원합니다.

4. **접근성(Reduced Motion) 기본 탑재**
   - 미디어 쿼리 `prefers-reduced-motion: reduce` 환경에서는 불필요한 위치 이동(Translate)과 스케일 변화를 즉시 비활성화하고, 단순한 Opacity 전환으로 안전하게 대체합니다.

## 2. 모션 엔지니어링 체크리스트

- [ ] 트랜지션 타이밍이 둔탁하거나 답답하지 않고 즉각 반응하는가? (진입 200~300ms 이내)
- [ ] 모달, 드롭다운, 툴팁이 뚝 끊겨 렌더링되지 않고 자연스럽게 스케일/투명도 페이드가 들어가는가?
- [ ] 버튼이나 인터랙티브 요소에 직관적인 눌림(Active/Pressed) 피드백이 존재하는가?
- [ ] `prefers-reduced-motion`이 고려되어 모션에 민감한 사용자를 배려했는가?
