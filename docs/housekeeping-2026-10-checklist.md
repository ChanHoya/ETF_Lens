# 저장소 정리 체크리스트 (2026-10-04)

여러 작업환경(Antigravity·Gemini, Claude Code, Conductor)을 오가며 쌓인 상태 문서 불일치와
작업 트리 잡동사니를 정리한다. 결정 근거는 `housekeeping-2026-10-context-notes.md`에 있다.

- [x] D-day 하드코딩 수정 커밋(d8118497) push
- [x] project-state.md S6-6 중복 블록 제거 및 깨진 48번째 줄 복구
- [x] project-state.md 스토리 ID 충돌 대응표 추가, 다음 신규 ID를 S6-20으로 명시
- [x] project-state.md 대선 날짜 표기 통일 (현지 투표일 / 한국시간 결과 반영일)
- [x] conductor/, .agent/task.md에 "갱신 중단, 기준 문서는 docs/project-state.md" 머리말 추가
- [x] main에 머지된 로컬 브랜치 23개 삭제 (`git branch -d`)
- [x] 추적되지 않는 일회성 스크립트 90개를 저장소 밖 `~/ETF_One_archive/2026-10-04/`로 이동
- [x] `scratch/`, `backend/scratch/`의 새 파일이 다시 쌓이지 않게 .gitignore에 추가
- [x] 루트의 추적 중인 일회성 스크립트(test_*.py, test_*.js, patch_*, check_*, commit_diff.txt, response.json 등) `git rm`
- [x] 배포본 확인: Vercel 프로젝트는 `dashboard/` (frontend/는 2026-02-23 이후 미사용)
- [x] Vercel·Render 배포 확인 (2026-10-04 22:36, a56b2994 — Vercel success, Render /news 4개 검색어 모두 200·10/4 기사 반영)
- [ ] 브라질 대선 결선(현지 10/25, 결과 반영 10/26 KST) 이후 동향 반영 — 결선 이후 수행
