---
name: ui-ux-pro-max
description: |
  Unify colors, typography, spacing, and component tokens into a cohesive, professional design system.
  Use this skill to prevent random inline styling, mismatched color palettes, disjointed typography scales, or inconsistent UI elements.
  Ensures seamless Light/Dark mode, semantic color tokens, and harmonious aesthetic balance.
license: MIT
metadata:
  version: v1
  category: design-system
---

# UI/UX Pro Max: Design System & Token Harmonization

무분별한 인라인 스타일링과 임의의 헥스(Hex) 컬러 난립을 방지하고, 색상·폰트·간격·반경을 하나의 일관된 디자인 시스템으로 결합합니다.

## 1. 시맨틱 컬러 토큰 체계

- **60-30-10 규칙 적용**:
  - 60% 기본 배경 및 중립 면(Surface/Neutral Background)
  - 30% 보조 구조 및 컨테이너(Cards, Borders, Secondary Neutral)
  - 10% 강조 및 주 행동(Brand Primary, Action Accent)
- **원색 하드코딩 금지**:
  - `bg-blue-500` 대신 시맨틱 토큰(`bg-primary`, `bg-accent`, `bg-surface-elevated`)을 사용합니다.
  - 라이트 모드와 다크 모드에서 배경-전경 대비가 언제나 WCAG AA 기준(4.5:1 이상)을 충족해야 합니다.
- **상태 시맨틱 분리**:
  - Success(그린), Warning(앰버/옐로), Danger(레드), Info(블루)는 일관된 채도와 명도를 유지합니다.

## 2. 타이포그래피 스케일 및 리듬

- **계층형 폰트 스케일**:
  - Display: 32px ~ 40px (Hero 타이틀, 주요 수치)
  - Heading 1/2: 20px ~ 24px (섹션 헤더)
  - Body: 14px ~ 16px (본문 데이터, 레이블)
  - Caption/Muted: 12px ~ 13px (단위, 타임스탬프, 도움말)
- **가독성 규칙**:
  - 본문 줄 간격(Line-height)은 1.4 ~ 1.6 사이를 유지합니다.
  - 영문 숫자나 금융 데이터는 정렬 오차 방지를 위해 `font-mono` 또는 `tabular-nums`를 필수 적용합니다.

## 3. 간격(Spacing) 및 반경(Radius) 토큰

- 4px 또는 8px 그리드 기반의 일관된 배수 스케일(4, 8, 12, 16, 24, 32, 48px)을 준수합니다.
- 코너 라운딩(Border-radius)은 앱 전반에 걸쳐 일관된 패밀리(예: 컴팩트한 `rounded-md`/`rounded-lg` 위주)를 선택하여 불필요한 과도한 둥글기 혼용을 방지합니다.

## 4. 디자인 시스템 검증 체크리스트

- [ ] 임의의 미정의 색상 코드가 없이 시맨틱 디자인 토큰으로 통일되었는가?
- [ ] 라이트 모드와 다크 모드 전환 시 텍스트나 테두리가 배경에 묻히지 않는가?
- [ ] 모든 숫자 지표에 표 형태 정렬(tabular-nums)이 적용되었는가?
- [ ] 버튼, 배지, 인풋 등의 컴포넌트 높이와 여백이 디자인 시스템 규칙을 따르는가?
