# Walkthrough — Sprint 6 S6-3 세션 (2026-05-31)

## 이번 세션에서 완료한 작업

### S6-3: Efficient Frontier 시각화 및 최적 비중 연동
### 레이아웃 핫픽스: 종목분석(선택) 및 TFF_Fund 가로 크기(1400px) 통일

---

## 구현 내용

### [NEW] EfficientFrontierPanel.tsx

S6-2에서 완성된 `POST /api/v1/analyze/efficient-frontier` API를 소비하는 프론트엔드 컴포넌트.

#### 구성 요소

| 섹션 | 내용 |
|------|------|
| 파라미터 컨트롤 | 조회 기간 탭(1Y/2Y/3Y) + 무위험 이자율 숫자 입력 |
| 상태 관리 | isLoading / error / result 완전 분기 |
| 산점도 | Recharts ComposedChart — 800포인트 MC 시뮬레이션, Sharpe 기준 slate→sky→amber 그라데이션 |
| 효율전선 커브 | Line 오버레이 25포인트, 하늘색 실선 |
| 포트폴리오 마커 | ReferenceLine 십자선: ⭐MaxSharpe/🔵MinVar/🔴현재 |
| Bento 카드 3개 | 기대수익률/변동성/샤프지수 + 비중 TOP-3 바 |
| 비중 비교 BarChart | 수직 grouped bar: 현재 vs MaxSharpe vs MinVar |
| 인사이트 요약 | 현재 대비 개선 delta(수익률/변동성) 자동 계산 |

### [MODIFY] MyDashboard.tsx

- 포트폴리오 시뮬레이션 탭 그룹에 **"포트폴리오 최적화"** 세 번째 탭 추가
- `backtestTab` 타입에 `'efficient'` 추가
- 탭 버튼 컨테이너 `flex-wrap` 추가 (모바일 대응)

---

## 코드 리뷰 수정 사항

| # | 항목 | 수정 |
|---|------|------|
| BUG-1 | `Math.min/max(...spread)` 콜 스택 오버플로우 위험 | `reduce()` 방식으로 교체 |
| BUG-2 | `weightBarData` 매 렌더마다 재계산 | `useMemo([result])` 적용 |
| BUG-3 | `parseFloat || 0` NaN 가드 부작용 | `isNaN(v)` 가드로 개선 |
| BUG-4 | `<Bar>` 내부 `<Cell>` 중복 fill 속성 | Cell 제거, Bar 직접 속성 사용 |
| BUG-5 | `Line strokeDasharray="0"` no-op 속성 | 제거 |
| CLEANUP | 미사용 `Cell` import | 제거 |

---

## 검증 결과

| 항목 | 결과 |
|------|------|
| TypeScript 빌드 (구현 후) | ✅ Compiled successfully (6.0s) |
| TypeScript 빌드 (리뷰 수정 후) | ✅ Compiled successfully (5.6s) |
| 백엔드 단위 테스트 | ✅ 18/18 통과 (S6-2에서 확인) |

---

## 커밋 이력

| SHA | 메시지 |
|-----|--------|
| `317be3e` | S6-3: Efficient Frontier 시각화 및 최적 비중 연동 프론트엔드 구현 |
| `0b99b4a` | docs: S6-3 완료 상태 업데이트 및 프로젝트 스테이트 갱신 |
| `dd3408d` | S6-3 리뷰 수정: EfficientFrontierPanel 5개 버그 픽스 |
| `7936e93` | learn: S6-3 세션 마무리 — 핸드오프 노트 및 실패 패턴 FP-016/017/018 등록 |

---

## 신규 등록 실패 패턴

- **FP-016**: `Math.min/max(...arr)` 대용량 배열 → `reduce()` 권장
- **FP-017**: Recharts `<Bar>` 내 `<Cell>` 중복 사용 패턴
- **FP-018**: `parseFloat || 0` NaN 가드 → `isNaN()` 가드 권장

---

## 레이아웃 핫픽스 (가로 크기 통일)

- **배경**: "종목분석"(초기 종목선택) 및 "TFF_Fund" 탭의 가로 크기가 `1200px`로 작아, 다른 주요 탭(섹터분석, 시장동향, My 탭: `1400px`) 대비 시각적 통일성이 떨어짐.
- **수정 내용**:
  1. `MainApp.tsx` (종목분석 초기 종목선택 섹션): `max-w-[1200px]` -> `max-w-[1400px]`로 상향.
  2. `TffDashboard.tsx` (TFF Fund 대시보드): 공통 헤더, 서브탭 네비게이션, 메인 콘텐츠 영역 모두 `max-w-[1200px]` -> `max-w-[1400px]`로 일괄 상향.
- **결과**: 모든 탭의 메인 콘텐츠 및 헤더 영역 가로 크기가 `1400px`로 통일되어 일관된 네온 다크 테마 UI 정렬을 완성함.

---

## 레이아웃 추가 튜닝

- **종목분석 초기 화면 위치 및 버전**: 종목선택 화면의 여백을 좁히고 위로 올려 서브메뉴 바로 아래에 위치하도록 개선했으며, 하단 버전 명시부를 최신 최종 수정 시간(`v.20260531_2310`)으로 업데이트했습니다.
- **TFF Fund 및 My 탭 제목창 상향**: 각 탭의 대시보드 상단 여백을 제거/축소하여 제목창이 위로 붙도록 상향 조정했습니다.
- **정보창 박스 세로 크기 축소**: My 탭 상단의 `InvestmentReturnCard` 정보창 박스의 세로 패딩과 자식 마진을 줄여 박스의 세로 크기를 콤팩트하게 다듬었습니다.
- **실시간 괴리율 경보 폰트 확대 (50% Up)**: `MyDashboard.tsx` 내 괴리율 경보 카드의 모든 텍스트(이름, 코드, 계좌, 배지, 그리드 레이블, 데이터값, 상태 메시지)의 폰트 크기를 기존 대비 약 1.5배 키우고, bold 굵기를 강화해 가독성 및 시인성을 극대화했습니다.

---

## 다음 세션 시작 지점

**S6-4: ETF 배당(분배금) 정보 수집 백엔드 스크래퍼 및 API**

- Seibro / 네이버페이 기반 과거 분배금 단가 및 지급일/주기 크롤링
- FastAPI 엔드포인트: `GET /api/v1/etf/{code}/dividend`
- 월별 배당 Cashflow 데이터 구조 설계
