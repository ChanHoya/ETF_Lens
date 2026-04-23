# ETF Lens — Conductor Index

> **프로젝트 지식 허브.** 모든 Agent가 작업 전 이 파일부터 읽습니다.

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
*Last bootstrapped: 2026-04-23 by Antigravity*
