# S6-3 Task: Efficient Frontier 시각화 및 최적 비중 연동

## 체크리스트

- [x] EfficientFrontierPanel.tsx 신규 컴포넌트 생성
  - [x] KIS holdings → EF API 요청 변환 로직
  - [x] 조회 기간 탭 (1Y/2Y/3Y)
  - [x] 무위험 이자율 입력 파라미터
  - [x] isLoading / error / result 상태 관리
  - [x] Recharts ComposedChart: MC 산점도 800포인트 (Sharpe 색상 그라데이션)
  - [x] 효율적 전선 커브 25포인트 라인 오버레이
  - [x] ReferenceLine 현재 포트폴리오 십자선 마커
  - [x] 범례 (효율전선 / ⭐MaxSharpe / 🔵MinVar / 🔴현재)
  - [x] 3개 Bento 지표 카드 (MaxSharpe / MinVar / 현재)
  - [x] 최적 비중 수직 BarChart (현재 vs MaxSharpe vs MinVar)
  - [x] 최적화 인사이트 요약 카드 (수익률/변동성 delta)
  - [x] 초기 안내 화면 + 로딩 상태 + 에러 처리
- [x] MyDashboard.tsx 수정
  - [x] EfficientFrontierPanel import 추가
  - [x] backtestTab 타입에 'efficient' 추가
  - [x] '포트폴리오 최적화' 탭 버튼 추가
  - [x] 탭별 컴포넌트 렌더링 분기 수정
- [x] TypeScript 빌드 에러 없음 확인 (✓ Compiled successfully)
- [x] Git commit & push 완료 (SHA: 317be3e)
- [x] docs/project-state.md S6-3 stable 업데이트
- [x] 레이아웃 핫픽스: 종목분석(선택) 및 TFF_Fund 가로 크기(1400px) 통일
  - [x] MainApp.tsx 종목선택 section max-w-[1200px] -> max-w-[1400px] 수정
  - [x] TffDashboard.tsx 헤더, 서브탭, 메인 컨텐츠 w-full max-w-[95vw] xl:max-w-[1200px] -> xl:max-w-[1400px] 수정
  - [x] npm run build 통과 확인
- [x] 레이아웃 추가 튜닝:
  - [x] 종목분석 초기화면 위치를 서브메뉴 바로 아래로 상향 조정
  - [x] 제일 아래 버전 정보를 최종 수정 날짜(v.20260531_2310)로 업데이트
  - [x] TFF_Fund 초기화면 제목창 위치 상향 조정
  - [x] My 탭 제목창 위치 상향 조정 및 정보창 박스(InvestmentReturnCard) 세로 크기 축소
  - [x] 실시간 괴리율 경보 종목별 카드 폰트 크기 50% 상향 및 시인성 개선
