# 저장소 정리 컨텍스트 노트 (2026-10-04)

## 배포본은 dashboard/

- 루트 `.vercel/project.json`과 `dashboard/.vercel/project.json` 모두 Vercel 프로젝트 `dashboard`를 가리킨다.
- etf-lens.vercel.app의 `<title>`("ETF Lens — 데이터 기반 ETF 분석")은 `dashboard/src/app/layout.tsx`에만 있다.
- `frontend/`의 마지막 커밋은 2026-02-23("convert submodules to normal directories")이다. 루트 `vercel.json`의
  `experimentalServices.frontend.entrypoint: "frontend"`는 실제 배포에 쓰이지 않는 것으로 보인다.
- `frontend/`와 루트 `vercel.json` 삭제는 되돌리기 번거로워서 이번에는 하지 않고 사용자 판단으로 남긴다.

## 대선 날짜는 불일치가 아니라 기준이 둘

- 브라질 현지 투표일은 1차 10/4(일), 결선 10/25(일)이다.
- 코드(`CATALYSTS`)와 타임라인은 결과가 반영되는 한국시간 기준 날짜인 10/5, 10/26을 쓴다.
- 처음 정리할 때 "10/25와 10/26이 충돌한다"고 봤지만, 실제로는 둘 다 맞고 표기에 기준이 빠져 있었을 뿐이다.
  문서에는 "현지 10/25 · 결과 반영 10/26 KST"처럼 두 날짜를 함께 적는다.

## 스토리 ID 충돌은 문서에서만 정리

- 커밋 메시지는 이미 push됐으므로 다시 쓰지 않는다. project-state.md에 대응표를 두어 같은 ID가 가리키는
  작업을 구분하고, 앞으로 쓸 새 ID는 S6-20부터 시작한다.
- 7월에 Claude Code가 쓴 `S7-*` 커밋은 Sprint 7을 연 게 아니라 Sprint 6 기간에 한 작업이다.
  대응표에 함께 적는다.

## 잡동사니는 지우지 않고 저장소 밖으로 옮김

- 추적되지 않는 파일은 git 기록에 없어서 지우면 되돌릴 수 없다. 그래서 `~/ETF_One_archive/2026-10-04/`로
  경로를 유지한 채 옮긴다. `.claude/`와 `.rtk/`는 도구 설정이라 그대로 둔다.
- 루트에 있는 추적 중인 일회성 스크립트는 `git rm`한다. git 기록에 남으므로 되돌릴 수 있다.
  `.github`, `render.yaml`, `vercel.json`, `backend/main.py`, `package.json`, 문서 어디에서도 참조하지 않는다는 것을 확인했다.
- `backend/` 바로 아래의 추적 중인 test_*.py 6개는 이번 범위에서 제외한다(용도 미확인).

## 낡은 에이전트 문서

- `conductor/`는 2026-04-23 bootstrap 이후 갱신되지 않았다. `.agent/task.md`는 S6-3(2026-05-31)에서 멈췄다.
  Gemini·Antigravity 쪽 도구가 읽을 수 있으므로 지우지 않고, 머리말로 기준 문서를 안내한다.
