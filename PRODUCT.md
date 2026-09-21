# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

주 사용자는 TFF(Time Future Forum) 모임 멤버다. 만든 사람 본인과 소수의 모임 참여자가
함께 쓰는 비공개 도구이며 일반 공개 서비스가 아니다.

- 사용 상황은 ETF와 본인 보유 자산을 비교하고 점검하는 투자 판단 시점이다.
- 내가 아닌 사람도 같은 화면을 보므로 용어와 화면 일관성이 개인용 도구보다 중요하다.
- `/tff` 전용 화면이 모임 펀드 현황을 위해 따로 존재한다.

## Product Purpose

파편화된 ETF 데이터를 한곳에 모아 실물 경제 지표와 엮어 비교 분석하게 한다. 최대 10개
ETF를 다각도로 비교하고 경기선행지수·VIX·FGI 기반 매크로 나침반을 제공한다. 성공은 모임
멤버가 투자 판단에 필요한 근거를 이 화면 안에서 끝내는 것이다.

## Positioning

ETFcheck 같은 기존 서비스가 다루지 않는 실질 보수(TER+매매비용), 종목 간 상관관계,
포트폴리오 중복도를 계산한다. 장중 1시간 배치 수집과 18시 일마감 확정 데이터를 결합한
하이브리드 구조로 안정성과 정확성을 동시에 확보한다. KIS 실계좌 연동으로 가상의
포트폴리오가 아니라 사용자의 실제 잔고를 대상으로 분석한다는 점이 핵심 차이다.

## Operating Context

화면은 넷으로 나뉜다.

- `/` 비교 — MainApp의 select 탭. ETF 다중 비교가 출발점이다.
- `/discover` 탐색 — 스크리닝, 세금 시뮬레이터, 매크로 로테이션, 환율 도구.
- `/my` 내 자산 — KIS 실계좌와 수기 입력 자산을 통합 관리한다.
- `/tff` — Time Future Forum 펀드 투자 현황과 수익률.

데이터 출처는 KRX, KIS, 네이버, FRED, yfinance, pykrx, DART다. 백엔드는 FastAPI이고
SQLite(`backend/etf_data_v2.db`)에 적재한다.

## Capabilities and Constraints

사용자가 유지 대상으로 명시한 제약이다. 재협상 없이 바꾸지 않는다.

- **비밀번호 잠금** — `PasswordGate`가 전체를 감싼다. 비공개가 전제다.
- **가로모드 전용** — `PortraitLockScreen`이 세로 화면을 막는 것은 의도된 설계다.
- **KIS 실계좌 연동** — 실제 자금이 연결되어 있어 함부로 변경하지 않는다.
- **다크 테마 + 한국어** — gray-950 배경과 한국어 UI가 현재 정체성이다.

기술 현황이다.

- Next.js 16.1.6 / React 19.2.3 / Tailwind v4 / recharts / lucide-react / TypeScript.
- 배포 대상은 `dashboard/` 폴더다. Vercel 프로젝트명은 `dashboard`다.
  `frontend/`와 `dashboard_copy/`는 배포본이 아니다.
- 현재 뷰포트 설정이 `maximumScale: 1`, `userScalable: false`로 확대를 막고 있다.
  의도 여부는 아직 확인되지 않았다.
- 컴포넌트는 72개이며 단일 파일이 10만 자를 넘는 것이 여럿 있다.
  (`Modals.tsx`, `BrazilBondTab.tsx` 등)

## Brand Commitments

- 이름은 **ETF Lens**다. 문서 제목은 "ETF Lens — 데이터 기반 ETF 분석"이다.
- 한국어 문장은 콜론이 아니라 마침표로 끝낸다. (프로젝트 `CLAUDE.md` 규칙 1)
- 새 소스 파일 첫 줄에 역할을 한 줄 한국어 주석으로 적는다. (규칙 2)

## Evidence on Hand

- 운영 중인 실제 서비스다. https://etf-lens.vercel.app/
- 저장소는 https://github.com/ChanHoya/ETF_Lens 이고 로컬 경로는 `~/ETF_One`이다.
- 2026-03-15 실제 화면 캡처 7장이 있다.
  `~/Downloads/screencapture-etf-lens-vercel-app-2026-03-15-*.png`
- 실데이터 DB가 있다. `backend/etf_data_v2.db` 약 106MB.
- **확보되지 않은 것** — 사용자 수, 이용 통계, 외부 후기, 성능 벤치마크, 가격 정보는
  없다. 앞으로 어떤 작업에서도 지어내지 않는다.

## Product Principles

1. 실제 돈과 실제 잔고를 다룬다. 정확성이 표현보다 앞선다.
2. 소수의 아는 사람이 함께 본다. 설명 없는 축약보다 일관된 용어가 낫다.
3. 데이터 출처와 갱신 시각을 숨기지 않는다.
4. 판단에 필요한 근거는 화면을 떠나지 않고 얻을 수 있어야 한다.
5. 비공개·가로모드·실계좌·다크 한국어는 합의된 전제다. 되돌아보지 않는다.
