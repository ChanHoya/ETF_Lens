# ETF Lens — Conductor Index

> **프로젝트 지식 허브.** 모든 Agent가 작업 전 이 파일부터 읽습니다.

---

## 🧠 제1 원칙 — Karpathy's Engineering Laws (`CLAUDE.md`)

> **이 원칙은 모든 개발 판단의 최우선 기준이다.** 기술적 결정이 아래 원칙과 충돌하면, 원칙을 따른다.

### 1. 먼저 생각하라 (Think Before Coding)
- **가정하지 말고, 혼란을 숨기지 말고, 트레이드오프를 드러내라.**
- 불확실하면 → 구현 전에 명시적으로 묻기
- 해석이 여러 가지면 → 조용히 선택하지 말고 제시
- 더 단순한 방법이 있으면 → 말하고 역제안하기
- 무언가 불분명하면 → 멈추고 질문하기

### 2. 단순함 우선 (Simplicity First)
- **문제를 해결하는 최소한의 코드. 추측성 기능 없음.**
- 요청받지 않은 기능 추가 ❌
- 일회성 코드에 추상화 레이어 ❌
- 요청받지 않은 "유연성" / "설정 가능성" ❌
- 200줄로 썼는데 50줄로 가능하면 → 다시 써라

> **자문**: "시니어 엔지니어가 보면 과설계라고 할까?" → Yes면 단순화

### 3. 외과적 변경 (Surgical Changes)
- **반드시 필요한 것만 수정. 자신이 만든 것만 정리.**
- 인접한 코드, 주석, 포맷 "개선" ❌
- 동작하는 코드 리팩터 ❌
- 관련 없는 dead code 발견 시 → 삭제 말고 언급만
- **내 변경으로 생긴 미사용 import/변수/함수만 제거**

> **테스트**: 변경된 모든 줄이 사용자 요청으로 직접 추적 가능해야 함

### 4. 목표 중심 실행 (Goal-Driven Execution)
- **성공 기준을 정의하고, 검증될 때까지 반복하라.**
- 작업을 검증 가능한 목표로 변환
  - "버그 수정" → "버그를 재현하는 테스트 작성 → 통과"
  - "리팩터" → "전후 테스트 동일하게 통과"
- 다단계 작업에는 간단한 플랜을 먼저 제시:
  ```
  1. [단계] → 검증: [확인 방법]
  2. [단계] → 검증: [확인 방법]
  ```

---

## 📂 문서 구조

| 파일 | 목적 |
|---|---|
| [product.md](./product.md) | 제품 비전 · 목표 · 타겟 유저 |
| [product-guidelines.md](./product-guidelines.md) | 제품 원칙 · UX 가이드 |
| [tech-stack.md](./tech-stack.md) | 기술 스택 · 인프라 |
| [workflow.md](./workflow.md) | 개발 · 배포 프로세스 |
| [tracks.md](./tracks.md) | 현재 개발 트랙 · 우선순위 |
| [code_styleguides/](./code_styleguides/) | 언어별 코딩 컨벤션 |

## ⚡ Quick Context (30초 요약)

- **서비스**: ETF Lens — 한국 ETF 심층 비교 분석 웹 대시보드
- **URL**: https://etf-lens.vercel.app
- **스택**: FastAPI(Render) + Next.js 16(Vercel) + PostgreSQL(Render $7/월)
- **현재 상태**: ✅ 운영 중 (2026-04-23 기준)
- **주요 기능**: ETF 종목 분석, 포트폴리오 추적(KIS API), TFF 대시보드, AI 인사이트

## 🚨 반드시 알아야 할 제약

1. **KIS API Rate Limit**: 초당 1건 — 병렬 호출 금지, `await asyncio.sleep(1.2)` 필수
2. **DB 연결**: Render PostgreSQL 유료 플랜 ($7/월), 90일 만료 없음
3. **etf_data_v2.db**: `.gitignore` 등록됨 — 절대 커밋하지 말 것 (88MB)
4. **Vercel 환경변수**: `NEXT_PUBLIC_API_BASE` → Render 백엔드 URL

---
*Last bootstrapped: 2026-04-23 | Karpathy principles added: 2026-05-01*
