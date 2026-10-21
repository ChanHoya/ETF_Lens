---
name: hallmark
description: |
  Detect and filter out generic AI-generated design cliches and predictable UI patterns (AI Hallmarks).
  Use this skill to purge common AI design tropes like unnecessary purple/indigo gradients, floating neon glow orbs,
  repetitive 3-card grids, over-rounded shapes, and fluffy generic marketing copy.
  Ensures the application feels authentic, domain-focused, human-crafted, and refined.
license: MIT
metadata:
  version: v1
  category: design-critique
---

# Hallmark: Anti-AI Cliche & UI Authenticity Filter

인공지능 모델이 무비판적으로 양산하는 전형적인 "AI 티 나는(AI Hallmarks)" UI 클리셰를 사전에 감지하고 걸러내어, 사람이 직접 정교하게 빚어낸 듯한 세련되고 전문적인 제품 품질을 확보합니다.

## 1. 대표적인 5대 AI 클리셰와 제거 지침

1. **보라색/인디고 그라디언트 및 사이버틱 네온 글로우 (Purple AI Haze)**
   - **클리셰**: 짙은 배경에 보라색-시안 그라디언트 텍스트, 거대한 네온 블러 원형(Glow orb) 남발.
   - **해결책**: 제품 도메인(예: 금융, 자산 관리, 헬스케어 등)에 부합하는 신뢰감 있는 팔레트(Slate, Navy, Deep Emerald, Neutral Gray)를 사용하고, 배경은 절제된 솔리드 또는 미세한 표면 질감으로 대체합니다.

2. **맥락 없는 획일적인 3단 카드 그리드 (Predictable 3-Card Layout)**
   - **클리셰**: 상단 거대 Hero 섹션 바로 아래에 아이콘 하나씩 박힌 3개의 대칭 카드가 멍하니 나열되는 구성.
   - **해결책**: 실제 데이터 구조와 사용자의 작업 흐름에 맞추어 카드 크기, 테이블, 분할 패널, 마이크로 차트 등 다채로운 밀도의 비대칭 레이아웃을 구성합니다.

3. **추상적이고 공허한 AI 마케팅 문구 (Fluffy AI Copywriting)**
   - **클리셰**: "Supercharge your workflow", "Unlock the future of finance with intelligent AI insights".
   - **해결책**: 실제 기능과 숫자가 담긴 구체적이고 명료한 사실 기반 카피를 작성합니다. (예: "3-Bucket 자산 배분 모델 기반의 은퇴 연금 현금 흐름 시뮬레이션")

4. **과도한 둥글기(Extreme Pill/Puffy Shapes)와 무의미한 유리모피즘(Glassmorphism)**
   - **클리셰**: 모든 버튼과 카드가 `rounded-3xl`이나 완전 알약 형태이며, 흐릿한 반투명 유리 배경에 흰색 1px 보더만 두른 형태.
   - **해결책**: 구조적 안정감을 주는 적정한 반경(`rounded-md`, `rounded-lg`)과 정교한 그림자(Subtle drop shadow), 명확한 외곽선으로 대비를 형성합니다.

5. **장식용 무의미한 아이콘 및 이모지 남발**
   - **클리셰**: 모든 텍스트 앞에 🚀, ✨, 💡 같은 이모지나 루사이트 계열 아이콘이 무의미하게 부착되어 시각적 잡음을 유발.
   - **해결책**: 기능적 의미가 있는 액션에만 정제된 단일 아이콘 셋(Lucide, Heroicons 등)을 제한적으로 사용합니다.

## 2. Hallmark 점검 체크리스트

- [ ] 보라색/사이버 네온 글로우가 아닌 제품 아이덴티티에 맞는 색상이 사용되었는가?
- [ ] 뻔한 3단 카드 대신 실제 데이터와 과업 중심의 정보 레이아웃이 적용되었는가?
- [ ] 카피라이팅이 공허한 미사여구 없이 명확하고 사실적인 정보를 전달하는가?
- [ ] 과도한 유리모피즘이나 무의미한 시각적 잡음(이모지/반투명 남발)이 정돈되었는가?
