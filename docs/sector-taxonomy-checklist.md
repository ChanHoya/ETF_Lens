# 섹터/분류 분리 + 발산형 수익률 바 — 체크리스트

## A. 발산형(diverging) 수익률 바
- [x] `lib/divergingBar.ts` — 0% 기준점 위치와 바 폭 계산 유틸
- [x] AccountSummaryDashboard 「계좌별 수익률 비교」 적용
- [x] HoldingsDetailDashboard 「수익률 랭킹」 적용
- [x] 전부 +, 전부 −, 혼재, 전부 0 네 경우 렌더링 검증

## B. 섹터/분류 필드 분리
- [x] `lib/sectorOptions.ts` — SECTOR_OPTIONS(7) / CLASSIFICATION_OPTIONS(10)
- [x] models.py — ManualAsset.classification, HoldingSectorOverride.classification
- [x] main.py 스타트업 — ADD COLUMN + 레거시 sector 값 매핑 (1회성, 멱등)
- [x] integrated_assets.py — 페이로드/응답/PATCH 에 classification 반영
- [x] KIS 종목 기본 섹터 추론 (ETF 브랜드 + 국내/해외)
- [x] TotalAssetBoard — 섹터/분류 컬럼 2개 분리, 드롭다운 2개
- [x] TotalAssetBoard — 검색 필터에 분류 포함
- [x] ManualAssetModal — 단건 폼 + 배치 행에 분류 select
- [x] HoldingsDetailDashboard — 탭 4개 (종목/금융사/섹터/분류)

## C. 검증
- [x] 백엔드 테스트 갱신 및 통과
- [x] 레거시 매핑 테스트 (멱등성 포함)
- [x] tsc --noEmit / npm run build
- [x] 렌더링 스모크 (발산형 바 4가지 경우)

## 남은 것
- 프런트에 테스트 러너가 없어 발산형 바 검증은 일회성 스크립트로 했다.
  `computeDivergingScale` 은 순수 함수라 러너가 생기면 그대로 옮기면 된다.
- 섹터/분류 값의 서버측 유효성 검사는 넣지 않았다. 목록을 TS/Python 두 곳에 두면
  어긋나기 쉬워서다. 지금은 프런트 드롭다운이 입력을 막고, 테스트가 매핑 결과만 검증한다.
