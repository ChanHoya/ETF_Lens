# Task Plan: S2-1 AI 기반 포트폴리오 자산 재조정 추천 엔진

## Goal
사용자의 KIS 4개 계좌 실시간 자산 현황을 기반으로 현재 자산 배분 비중(반도체, 우주항공, 지수 추종, 현금 등)을 분석하고, 매크로 지표 및 AI 시장 분석 엔진(Gemini 2.5/Flash-Pro)을 활용하여 최적의 포트폴리오 재배정(Rebalancing) 비중 및 단계별 매매 추천 시나리오를 제공하는 프리미엄 AI 자산 관리 모듈을 구축합니다.

## Current Phase
Phase 4: Integration & UX Polishing (Completed)

## Phases

### Phase 1: Architecture & Data Modeling
- [x] 7대 카테고리 자산 분류 체계 매핑 (S&P 500, KOSPI/KOSDAQ, 미국 우주, 한국 우주, 반도체, 커버드콜, 현금/예수금)
- [x] AI 프롬프트 엔지니어링 및 추천 알고리즘 설계 (목표 투자 성향 및 리스크 수용 한도 조율 기능 포함)
- **Status:** done

### Phase 2: Backend Recommendation Engine Implementation
- [x] `backend/api/router.py`에 `/api/v1/my/rebalance-recommendation` POST/GET 엔드포인트 구현
- [x] 실시간 KIS 포트폴리오 조회 및 자산 카테고리별 비중 자동 집계 로직 연동
- [x] Gemini API를 이용한 맞춤형 자산 진단 및 추천 포트폴리오 비중 연산 모듈 (`backend/agents/rebalancer.py` 신설)
- [x] 구체적이고 바로 복사 가능한 단계별 거래 지침(Actionable Trade Steps) 생성 로직 작성
- **Status:** done

### Phase 3: Frontend Rebalancing Dashboard Implementation
- [x] React용 AI 재조정 추천 대시보드 컴포넌트 (`RebalanceRecommendation.tsx` 신설)
- [x] Recharts 기반의 "현재 자산 비중 vs. 추천 자산 비중" 비교 수평 누적 막대 차트(Horizontal Bar Chart) 시각화
- [x] AI 투자 소견 및 카테고리별 자산 진단을 담은 글래스모피즘 Bento Grid 레이아웃 구현
- [x] 단계별 매매 지침 카드 디자인 및 원클릭 복사 클립보드 기능 연동
- **Status:** done

### Phase 4: Integration & UX Polishing
- [x] 포트폴리오 탭 혹은 자산 조회 메인 뷰 상단에 'AI 자산 리밸런싱 진단받기' 프리미엄 진입 버튼/모달 배치
- [x] API 비동기 로딩 스피너 및 미려한 스켈레톤 UI 처리
- [x] 전체 빌드 테스트 및 TypeScript 정적 타입 검증 (`npm run build`)
- **Status:** done

---

## Key Questions & Decisions

### 1. 사용자의 투자 성향(보수/중립/공격)을 어떻게 입력받거나 추정할 것인가?
* **결정:** 기본값으로 현재 사용자의 계좌 자산 구성(예: 현금 대비 우주/성장형 섹터 비중)을 분석하여 AI가 투자 성향을 자동 역추산(Reverse-estimate)하되, 프론트엔드 UI에 **3단계 투자 성향 선택 슬라이더/버튼**을 배치하여 사용자가 즉석에서 성향별 추천 비중을 실시간 요청할 수 있게 유연성을 극대화합니다.

### 2. 추천 엔진의 신뢰성과 실시간성을 어떻게 보장할 것인가?
* **결정:** 
  1. KIS API에서 수집된 가장 신선한 4개 계좌 잔고를 기준으로 연산합니다.
  2. Gemini 프롬프트에 최근 매크로 금리 정보(FRED), VKOSPI/FGI 공포지수 및 주요 우주/반도체 ETF 최근 등락률을 컨텍스트로 주입하여 최신 트렌드를 정확하게 반영합니다.
