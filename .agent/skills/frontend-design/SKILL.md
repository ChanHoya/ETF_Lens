---
name: frontend-design
description: |
  Create thoughtful, user-centric frontend designs and layout directions before writing code.
  Use this skill whenever you are planning, designing, or scaffolding a new UI, component, or screen.
  It establishes visual hierarchy, mood, structure, spacing rhythms, and domain-specific UX goals before diving into code.
license: MIT
metadata:
  version: v1
  category: design
---

# Frontend Design: Pre-Coding Design Direction

코드나 컴포넌트를 구현하기 전에 사용자 경험(UX)과 시각적 방향성(Design Direction)을 선행 설계하는 기본 지침서입니다.

## 1. 선행 설계 4단계 프로세스

1. **도메인 맥락 및 사용자 목표 정의**
   - 이 화면이 해결해야 하는 가장 핵심적인 사용자 과업(Task)을 한 문장으로 규정합니다.
   - 사용자가 화면에 진입했을 때 3초 이내에 인지해야 하는 1순위 정보(Primary Anchor)를 선정합니다.

2. **정보 계층 구조 (Visual Hierarchy)**
   - **Primary**: 화면에서 가장 먼저 시선을 사로잡는 핵심 데이터 또는 주요 액션(CTA).
   - **Secondary**: 결정을 뒷받침하는 세부 지표, 필터, 보조 조작계.
   - **Tertiary**: 메타데이터, 부가 설명, 타임스탬프, 부차적 도움말 링크.

3. **레이아웃 골격 및 시선 흐름(Eye-tracking)**
   - 대시보드나 생산성 도구에서는 Z-패턴 또는 F-패턴을 기반으로 상단 요약 → 중단 비교/분석 → 하단 세부 내역으로 자연스럽게 흐르도록 배치합니다.
   - 무작위적인 카드 배치를 지양하고, 논리적인 작업 순서(Workflow)에 따라 영역을 구획합니다.

4. **밀도(Density)와 호흡(Whitespace)**
   - 금융/분석 대시보드는 정보 가독성이 훼손되지 않는 선에서 컴팩트한 고밀도 설계를 적용합니다.
   - 랜딩이나 온보딩은 넉넉한 패딩과 섹션 구분을 두어 시각적 피로도를 낮춥니다.

## 2. 디자인 방향 수립 체크리스트

- [ ] 구현할 뷰의 주요 사용자 페르소나와 작업 목표가 명확한가?
- [ ] 1순위 핵심 지표와 2순위 보조 컨트롤이 시각적으로 명확히 차별화되어 있는가?
- [ ] 화면 폭에 따른 유연한 그리드(Grid) 및 유연한 래핑 전략이 수립되었는가?
- [ ] 데이터가 없거나(Empty), 불러오는 중(Loading), 오류가 발생한(Error) 상태의 레이아웃이 고려되었는가?
