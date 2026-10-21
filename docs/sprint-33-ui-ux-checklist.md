# Sprint 33: 5대 UI/UX 기준 핵심 개선과제 체크리스트

## 개요
- 목표: ETF_One 서비스 화면 전반에 걸쳐 5대 UI/UX 기준(`frontend-design`, `ui-ux-pro-max`, `hallmark`, `emil-design-eng`, `web-design-guidelines`)을 순차적으로 적용하고 개선합니다.
- 브랜치: `feat/sprint-33-ui-ux-five-standards`

---

## 1. frontend-design (화면 목적 및 1순위 핵심 지표 강화)
- [x] 시장동향(`MacroTab.tsx` 및 `MainApp.tsx`) 최상단에 1순위 '오늘의 매크로 나침반(Hero Compass Banner)' 신설.
- [x] 주요 3대 핵심 지표(위험자산 심리, 시장 유동성/금리, 환율 충격도) 실시간 종합 판정 칩 제공.
- [x] 상단 15개 네비게이션 탭의 시각적 카테고리 그룹화(거시지표 / ETF분석 / 자산배분) 및 가시성 개선.

## 2. ui-ux-pro-max (시맨틱 토큰 및 다크/라이트 모드 일관성)
- [x] 라이트 모드(`theme-light.css`, `globals.css`) 카드 경계선 명암비(`border-slate-200/90`) 및 그림자 토큰 보강.
- [x] 텍스트 및 라벨 폰트 크기 계층을 디자인 시스템 규격으로 일원화.
- [x] 60-30-10 규칙에 따른 컨테이너 및 뱃지 색상 대비 재정렬.

## 3. hallmark (AI 양산형 클리셰 제거 및 도메인 전문성 강화)
- [x] 과도하게 노출된 이모지(🛢️, 🔥, 💡, 📊, 💎, 🪜 등)를 Lucide 시맨틱 SVG 아이콘으로 대체.
- [x] 전문 금융 인텔리전스 톤앤매너에 맞춘 배지 및 레이블 타이포그래피 정제.

## 4. emil-design-eng (물리 스프링 모션 및 쫀득한 터치 조작감)
- [x] 주요 인터랙션 버튼, 탭 칩, 필터 스위처에 쫀득한 터치 피드백(`active:scale-[0.97] transition-transform duration-100 ease-out`) 탑재.
- [x] 모달 및 시트 진입 트랜지션 스프링 감속곡선(`cubic-bezier(0.16, 1, 0.3, 1)`) 최적화.
- [x] 데이터 갱신 시 부드러운 Shimmer 스켈레톤 로딩 상태 제공.

## 5. web-design-guidelines (접근성, 포커스 링, 모바일 반응형)
- [x] 키보드 탐색을 위한 고대비 포커스 링(`focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none`) 전역 보강.
- [x] 모바일 터치 타깃 최소 44px 높이 확보 및 터치 영역 패딩 보정.
- [x] 모바일 세로 모드 진입 시 강제 차단 대신 '핵심 3대 KPI 요약 카드 뷰' 우선 노출 및 '차트 가로모드 전환' 유도 버튼 제공.

## 6. 검증 및 배포
- [x] 프론트엔드 빌드 검증 (`npm run build`).
- [x] 백엔드 회귀 테스트 실행 (`pytest`).
- [x] 브라우저 렌더링 검증 (다크/라이트 모드, 데스크톱/모바일).
- [x] 단계별 시맨틱 커밋 작성 및 푸시.
