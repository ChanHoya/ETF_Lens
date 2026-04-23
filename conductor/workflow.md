# Workflow — ETF Lens

## 개발 프로세스

### 브랜치 전략
- **단일 브랜치**: `main` 직접 커밋 (소규모 1인 프로젝트)
- 큰 기능은 feature branch 사용 권장하나 현재 미적용

### 배포 파이프라인

```
로컬 코드 수정
    │
    ▼
git commit -m "..."
    │
    ▼
git push origin main
    │
    ├── Vercel 자동 감지 → Next.js 빌드 (~1분) → etf-lens.vercel.app
    └── Render 자동 감지 → Python 빌드 (~2분) → etf-lens.onrender.com
```

### 환경

| 환경 | Frontend | Backend | DB |
|---|---|---|---|
| Production | Vercel | Render | Render PostgreSQL |
| Local Dev | `npm run dev` (port 3000) | `uvicorn main:app --reload` (port 8000) | SQLite (etf_data_v2.db) |

## AI 작업 프로세스 (PDCA)

1. **PLAN** (`/plan`): 기능 설계, 파일 목록, 위험 확인
2. **DO**: 코드 작성 (backend → frontend 순서)
3. **CHECK**: 로컬 테스트 또는 `curl` API 검증
4. **DEPLOY**: `git push` → Render/Vercel 자동 배포

## 핵심 제약 및 주의사항

### KIS API
- **Rate Limit**: 초당 1건 → `await asyncio.sleep(1.2)` 필수
- **에러 코드 EGW00133**: 속도 초과 → `asyncio.sleep(2.5)` 후 재시도
- **토큰 캐시**: `TOKEN_CACHE` 전역 딕셔너리로 토큰 재사용 (EGW00133 방지)

### DB
- `.gitignore`에 `etf_data_v2.db` 등록됨 → 절대 커밋하지 말 것
- 테이블 자동 생성: `main.py` startup 시 `Base.metadata.create_all` 실행
- PostgreSQL URL은 Render 대시보드에서만 관리

### 포트폴리오 캐시
- `_PORTFOLIO_CACHE`: 5분 인메모리 캐시 (KIS API 보호)
- 강제 새로고침 필요 시 "새로고침" 버튼 클릭

## 테스트

현재 자동화 테스트 커버리지 낮음. 검증 방법:
```bash
# 백엔드 헬스체크
curl https://etf-lens.onrender.com/api/v1/analyze/health

# 로컬 API 테스트
python test_kis.py
python test_portfolio.py
```

---
*Bootstrapped: 2026-04-23*
