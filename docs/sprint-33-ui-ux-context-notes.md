# Sprint 33: 5대 UI/UX 기준 핵심 개선과제 의사결정 노트 (Context Notes)

## 배경 및 목표
- 전체 서비스 화면 점검 결과 도출된 5대 UI/UX 기준의 미비점을 보완합니다.
- 복잡한 매크로 및 ETF 데이터를 직관적으로 이해할 수 있는 정보 계층을 수립하고, 프로덕션 수준의 마감 완성도를 달성합니다.

## 핵심 설계 결정

1. **frontend-design**
   - 시장동향 탭 상단에 `MacroHeroCompass` 컴포넌트를 신설합니다.
   - 단일 지표의 나열 대신 '위험자산 심리', '금리/유동성 압박', '환율 민감도'의 3대 축을 종합 연산하여 당일 시장 상태를 한눈에 전달합니다.

2. **ui-ux-pro-max**
   - 다크 모드뿐만 아니라 라이트 모드에서도 카드의 입체감과 텍스트 대비(WCAG AA 4.5:1 이상)가 완벽히 보장되도록 `theme-light.css`와 `globals.css`의 토큰을 보강합니다.

3. **hallmark**
   - AI 양산형 클리셰 느낌을 주는 텍스트 기반 이모지를 Lucide SVG 아이콘(Compass, Flame, ShieldAlert, Sparkles, TrendingUp 등)으로 교체하여 신뢰도 높은 금융 분석 도구의 정체성을 강화합니다.

4. **emil-design-eng**
   - 모든 대화형 버튼, 칩, 필터에 `active:scale-[0.97]`과 스프링 감속곡선을 적용하여 쫀득한 물리적 조작감을 부여합니다.

5. **web-design-guidelines**
   - 모바일 세로 뷰포트에서 기존 풀스크린 회전 차단 오버레이를 고도화하여, 세로 모드에서도 핵심 3대 지표를 즉시 확인하고 원클릭으로 가로 모드 또는 상세 차트를 확인할 수 있는 적응형 뷰를 구현합니다.
   - 모든 인터랙티브 요소에 `focus-visible:ring-2 focus-visible:ring-indigo-500` 접근성 포커스 링을 보강합니다.
