# i-Prism 리브랜딩 체크리스트 (2026-10-04)

ETF Lens → i-Prism(Investment Prism). 로고는 시안 H2로 확정. 결정 근거는 `iprism-rebrand-context-notes.md`.

- [x] 브랜드 생성 스크립트 `dashboard/scripts/generate-brand.py` 작성 (Bricolage Grotesque 800 → 글자 윤곽 path, 부채꼴 스펙트럼 조각 계산)
- [x] 생성물: `components/brand/IPrismLogo.tsx`(로고타입·마크 React 컴포넌트), `public/brand/iprism-logo.svg`
- [x] 아이콘: `app/icon.svg`(타일), `app/apple-icon.png`(180), `app/favicon.ico`(16·32·48) 교체
- [x] 헤더(MainApp) Aperture + "ETF Lens" → IPrismLogo, 안 쓰게 된 Aperture import 제거
- [x] 비밀번호 화면(PasswordGate) 로고·이름 교체
- [x] 세로모드 잠금 화면, discover, tff 제목, layout 메타데이터, SemiFundamentalSignals 비교 라벨 교체
- [x] 백엔드 사용자 노출 문구 교체: 알림 username·테스트 메시지, AI 챗봇 프롬프트, 리밸런스 텔레그램 링크 문구
- [x] 백엔드 테스트(test_disparity_alerts) 기대 문자열 갱신
- [x] pytest, dashboard 빌드, 로컬 화면 캡처로 확인
- [ ] push 후 실서버 확인

검증: pytest 69 통과(기존 실패 test_semi_cycle 2건은 무관), `npm run build` 성공, 로컬 캡처로 헤더·비밀번호 화면·탭 제목·아이콘 링크(favicon.ico, icon.svg, apple-icon.png) 확인.
