# Development Tracks — ETF Lens

## 현재 활성 트랙

| 트랙 | 설명 | 상태 |
|---|---|---|
| **Track A: My Assets** | KIS 포트폴리오 추적 + 수익률 | 🔧 active |
| **Track B: ETF Analysis** | 종목 비교, 평가, 백테스트 | ✅ stable |
| **Track C: TFF Dashboard** | 엑셀 업로드 펀드 대시보드 | 🔧 active |
| **Track D: AI Intelligence** | Gemini 기반 AI 분석 | ✅ stable |

## Track A: My Assets (포트폴리오 추적)

**목표**: KIS API 4계좌 연동, 초기 투자금 대비 실제 수익률 추적

**완료된 기능**:
- ✅ KIS 4계좌 잔고 조회 (국내 + 해외)
- ✅ 당일 체결 내역 조회
- ✅ 포트폴리오 위험도 배너 (Exit Signal 연동)
- ✅ MA5/MA20/RSI 종목별 시그널
- ✅ 계좌 상세 모달 (AccountDetailModal)
- ✅ 초기 투자금 대비 수익률 (KIS 자동 + 수동 입력)

**진행 중**:
- 🔧 KIS cashflow API 응답 검증 (TTTC8508R 실제 데이터 확인 필요)

## Track C: TFF Dashboard

**목표**: 엑셀 파일 업로드로 TFF 펀드 월별 성과 시각화

**완료된 기능**:
- ✅ 투자비중 시트 파싱 (현금잔고 추출)
- ✅ YTM + 월별 시트 데이터 주입
- ✅ OverviewView 예수금 표시

**잔여 이슈**:
- ⚠️ 예수금 0원 표시 (cashKeywords 불일치 시 발생 가능)

## 백로그

| 우선순위 | 기능 | 메모 |
|---|---|---|
| P1 | KIS cashflow 실제 응답 검증 | TTTC8508R 파라미터 확인 |
| P1 | TFF 예수금 0원 최종 검증 | 엑셀 업로드 후 콘솔 확인 |
| P2 | ETF 마스터 자동 갱신 스케줄 | 신규 상장 종목 자동 추가 |
| P3 | 포트폴리오 히스토리 저장 | 날짜별 자산 변화 추적 |

---
*Bootstrapped: 2026-04-23*
