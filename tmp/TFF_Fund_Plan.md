# TFF Dashboard 상세 개발계획서

> **프로젝트명**: TFF (Time Future Forum) 펀드 현황 대시보드  
> **경로**: https://etf-lens.vercel.app/tff  
> **작성일**: 2026-04-12  
> **개발환경**: Antigravity IDE (Claude 기반 멀티에이전트)  
> **통합대상**: etf-lens (기존 Next.js 앱)

---

## 1. 프로젝트 개요

### 1.1 배경 및 목적

TFF(Time Future Forum)는 친목 사모펀드로, 매월 정기 적립 방식으로 ETF 포트폴리오에 투자하고 있다. 현재 월말 기준 엑셀 파일로 운용 현황을 공유하고 있으나, 멤버들이 직관적으로 성과를 확인하고 인사이트를 얻을 수 있는 웹 대시보드가 필요하다.

기존 etf-lens.vercel.app 서비스 내에 `/tff` 경로로 대시보드를 추가하여, 펀드 멤버들에게 공유할 수 있는 인터랙티브 대시보드를 구축한다.

### 1.2 핵심 요구사항

- 매월 엑셀 데이터를 업데이트하면 대시보드에 자동 반영
- 멤버 전용 접근 (간단한 인증 또는 링크 공유 방식)
- 모바일 반응형 지원 (멤버들이 모바일로 주로 확인)
- 2025년 데이터 추가 입력 예정이므로 데이터 구조의 확장성 확보

### 1.3 데이터 소스 현황

현재 확보된 데이터(2026년 3월말 엑셀 기준):

| 시트명 | 내용 | 데이터 상태 |
|---|---|---|
| 투자가이드라인 | 투자 원칙 및 기본 포트폴리오 배분(한국/해외, 주식/채권/금/현금) | 정적 데이터 |
| 투자비중 | 3월말 기준 보유 종목별 평가금액 및 비중 | 월말 스냅샷 |
| Portfolio | 안정성장 포트폴리오, 월배당 포트폴리오 목표 구성 | 정적 데이터 |
| 1~3월 (2026) | 종목별 월간 매매/평가/손익 상세 내역 | 상세 데이터 존재 |
| 4~12월 (2026) | 현금 잔고만 존재 (향후 입력 예정) | 종합잔고/수익률만 존재 |
| YTM | 2026년 연초부터 누적 종목별 손익 | 연간 누적 |
| 종목별수익률 | 월별/누적 수익률 + 코스피/S&P500 비교 | 핵심 분석 데이터 |
| 총누적손익 | 2024.7월~현재 월별 평가액/입출금/수익률 + 벤치마크 | 전체 히스토리 |
| vs벤치마크(지수) | TFF vs 코스피/코스닥/다우/S&P500/나스닥/미국채/달러원 | 비교 분석 |
| 인사이트 | 월별 시장 이벤트 메모 | 텍스트 데이터 |

향후 추가 예정: 2025년 상세 월별 데이터 (현재는 종합 수치만 존재)

---

## 2. 데이터 모델 설계

### 2.1 JSON 데이터 구조

엑셀 데이터를 아래 JSON 구조로 변환하여 관리한다. `/src/data/tff/` 디렉토리에 연도별 파일로 분리한다.

```
src/data/tff/
├── config.json          # 투자가이드라인, 목표 포트폴리오
├── portfolio-2024.json  # 2024년 월별 데이터
├── portfolio-2025.json  # 2025년 월별 데이터 (추가 예정)
├── portfolio-2026.json  # 2026년 월별 데이터
├── benchmarks.json      # 벤치마크 지수 데이터
└── insights.json        # 시장 인사이트 메모
```

#### config.json

```json
{
  "fundName": "TFF (Time Future Forum)",
  "startDate": "2024-07",
  "monthlyContribution": 1000000,
  "guidelines": {
    "principles": [
      "월 적립식 투자",
      "장기투자",
      "ETF 투자",
      "분할 매매",
      "성장+안정 추구",
      "포트폴리오 투자",
      "월배당 재투자",
      "모멘텀 강한 섹터 스윙 매매 가능",
      "시장상황에 따라 유연한 조정"
    ],
    "targetAllocation": {
      "byAsset": {
        "주식": { "한국": 40, "해외": 25, "합계": 65 },
        "채권": { "한국": 10, "해외": 5, "합계": 15 },
        "금": { "한국": 0, "해외": 10, "합계": 10 },
        "현금": { "한국": 10, "해외": 0, "합계": 10 }
      }
    }
  }
}
```

#### portfolio-YYYY.json (연도별)

```json
{
  "year": 2026,
  "months": {
    "01": {
      "period": "2026-01",
      "holdings": [
        {
          "name": "KODEX 200",
          "category": "주식",
          "market": "한국",
          "beginValue": 1644165,
          "buyAmount": 0,
          "sellAmount": 0,
          "endValue": 2087235,
          "dividend": 0,
          "pnl": 443070,
          "weight": 0.07617,
          "returnRate": 0.26948,
          "dividendReturn": 0,
          "capitalReturn": 0.26948
        }
      ],
      "summary": {
        "totalBeginValue": 22558280,
        "totalBuyAmount": 5865913,
        "totalSellAmount": 5357620,
        "totalEndValue": 26855810,
        "totalDividend": 27911,
        "totalPnl": 3817148,
        "cashBalance": 546499,
        "monthlyReturn": 0.161855,
        "dividendReturn": 0.000982,
        "capitalReturn": 0.13331
      },
      "cashFlow": {
        "beginBalance": 22584960,
        "deposit": 1000000,
        "withdrawal": 0,
        "endBalance": 27402309,
        "netPnl": 3817349
      }
    }
  },
  "ytd": {
    "totalBeginValue": 22558280,
    "totalEndValue": 28933665,
    "totalInvested": 25584960,
    "totalPnl": 3375259,
    "returnOnInvestment": 0.131924,
    "timeWeightedReturn": 0.293534
  }
}
```

#### benchmarks.json

```json
{
  "indices": ["TFF", "코스피", "코스닥", "다우존스", "S&P500", "나스닥", "미국채10년금리", "달러/원"],
  "monthly": [
    {
      "period": "2024-07",
      "TFF": 0,
      "코스피": 0,
      "S&P500": 0
    }
  ],
  "cumulative": {
    "2024": { "TFF": -0.000315, "코스피": -0.133974, "S&P500": 0.065069 },
    "2025": { "TFF": 0.328630, "코스피": 0.756277, "S&P500": 0.163878 },
    "2026": { "TFF": 0.131924, "코스피": 0.198922, "S&P500": -0.046305 },
    "total": { "TFF": 0.447992, "코스피": 0.823539, "S&P500": 0.182210 }
  },
  "indexValues": [
    {
      "period": "2024-07",
      "코스피": 2770.69,
      "코스닥": 803.15,
      "다우존스": 40842.79,
      "S&P500": 5522.30,
      "나스닥": 18189.17,
      "미국채10년금리": 4.09,
      "달러/원": 1369.8
    }
  ]
}
```

#### insights.json

```json
{
  "entries": [
    {
      "month": "2026-04",
      "items": [
        "신연송 한은총재 후보 자산배분 화제 : 82억원(외화 43억원+한화 39억원)",
        "미국 금 계급화 및 재평가?",
        "미국 3월 실업률 예상치(4.4%) 하회 : 4.3%"
      ]
    }
  ]
}
```

### 2.2 데이터 갱신 전략

엑셀 → JSON 변환은 수동 스크립트로 처리한다. 향후 자동화를 고려하되 초기에는 아래 워크플로우를 따른다.

1. 매월 말 엑셀 파일 수신
2. 변환 스크립트 실행: `scripts/convert-tff-excel.ts`
3. 생성된 JSON 파일을 `src/data/tff/`에 배치
4. Git push → Vercel 자동 배포

변환 스크립트는 SheetJS(xlsx 라이브러리)를 사용하여 엑셀의 각 시트를 파싱하고, 위 JSON 구조로 매핑한다. 병합된 셀과 비정형 레이아웃을 처리하는 로직이 핵심이다.

---

## 3. 대시보드 화면 설계

### 3.1 전체 페이지 구조

```
/tff (메인 대시보드)
├── Header: TFF 로고 + 기준일 표시 + 데이터 기간
├── Section 1: KPI 카드 (핵심 지표 요약)
├── Section 2: 자산 현황 (누적 자산 추이 차트)
├── Section 3: 포트폴리오 구성 (자산배분 시각화)
├── Section 4: 월별 수익률 추이 (벤치마크 비교)
├── Section 5: 종목별 성과 (수익률 랭킹)
├── Section 6: 벤치마크 비교 (누적 수익률 멀티라인)
├── Section 7: 시장 인사이트 타임라인
└── Footer: 투자 가이드라인 요약 + 면책 고지
```

### 3.2 Section 1: KPI 카드

화면 최상단에 4~6개의 핵심 지표를 카드 형태로 배치한다.

| 카드 | 값 (3월말 기준) | 설명 |
|---|---|---|
| 총 평가금액 | 28,960,219원 | ETF + 현금 합산 |
| 누적 투자원금 | 25,584,960원 | 순입금 누계 |
| 누적 수익금 | +3,375,259원 | 평가액 - 원금 |
| 총 수익률 | +13.19% | 총입금액 대비 수익률 |
| 시간가중 수익률 | +29.35% | 2025년 기준 TWR |
| 운용 기간 | 20개월 | 2024.7 ~ 현재 |

구현 참고:
- 수익금은 양수일 때 초록, 음수일 때 빨강으로 표시
- 전월 대비 변화량을 작은 텍스트로 하단에 표시 (예: 전월 대비 -8.2%)
- 모바일에서는 2열 그리드로 재배치

### 3.3 Section 2: 자산 현황 (누적 자산 추이)

**차트 유형**: Area Chart (Stacked 또는 단일)

**X축**: 월별 (2024.7 ~ 현재)
**Y축**: 금액 (원)

표시 데이터:
- 누적 입금액 (회색 영역 또는 점선)
- 총 평가금액 (파란색 영역)
- 두 영역 사이의 갭 = 수익/손실

각 월별 데이터 포인트에는 아래 정보를 tooltip으로 표시:
- 해당월 평가금액
- 해당월 입금액
- 해당월 수익금
- 해당월 수익률

하단에 월별 순입출금 바 차트를 작게 오버레이하여 자금 흐름도 함께 표시한다.

데이터 매핑 (총누적손익 시트 기준):
```
기말평가액 = [261, 2008466, 2995892, 3022070, 3982249, 4998687, 
             6118669, 7121680, 7994959, 8885029, 10202343, 12203212,
             13668393, 14689898, 16765864, 20239147, 20891570, 22584960,
             27402309, 30549294, 28960219]

누적입금액 = [0, 2000261, 3000261, 3000261, 4000261, 5000261,
             6000261, 7000261, 8000261, 9000261, 10000261, 11000261,
             12000261, 13000261, 14000261, 15000261, 16000261, 17000261,
             18000261, 19000261, 20000261]
```

### 3.4 Section 3: 포트폴리오 구성

3개의 서브 뷰를 탭으로 전환한다.

#### 3.4.1 자산유형별 비중 (Donut Chart)

현재(3월말) 비중:
- 주식: 85.20% (목표 65%)
- 채권: 8.61% (목표 15%)
- 대체(금): 6.10% (목표 10%)
- 현금: 0.09% (목표 10%)

도넛 차트 옆에 목표 대비 괴리를 Gauge 또는 Bar로 표시하여 리밸런싱 필요 여부를 시각화한다.

#### 3.4.2 국가별 비중 (Donut Chart)

- 한국: 63.62%
- 미국: 32.82%
- 중국: 3.56%

#### 3.4.3 개별 종목 비중 (Treemap 또는 Horizontal Bar)

종목별 평가금액 및 비중을 표시한다. 종목명, 평가금액, 비중(%)을 한 눈에 볼 수 있도록 한다.

| 종목 | 구분 | 시장 | 평가금액 | 비중 |
|---|---|---|---|---|
| PLUS 고배당주 | 주식 | 한국 | 2,884,050 | 9.96% |
| TIGER 미국나스닥100 | 주식 | 미국 | 2,511,280 | 8.67% |
| ACE 주주환원가치주액티브 | 주식 | 한국 | 2,498,350 | 8.63% |
| TIGER 지주회사 | 주식 | 한국 | 2,486,220 | 8.58% |
| KODEX 금융고배당TOP10 | 주식 | 한국 | 2,476,320 | 8.55% |
| KODEX 200 | 주식 | 한국 | 2,112,040 | 7.29% |
| KODEX 미국AI테크TOP10 | 주식 | 미국 | 1,989,000 | 6.87% |
| ACE KRX금현물 | 대체 | 미국 | 1,766,240 | 6.10% |
| TIGER 코리아밸류업 | 주식 | 한국 | 1,622,790 | 5.60% |
| KODEX 반도체 | 주식 | 한국 | 1,303,500 | 4.50% |
| KODEX iShares미국하이일드액티브 | 주식 | 미국 | 1,164,000 | 4.02% |
| KODEX 국고채10년액티브 | 채권 | 한국 | 1,161,380 | 4.01% |
| TIGER 미국S&P500 | 주식 | 미국 | 1,071,180 | 3.70% |
| KODEX 26-12 회사채(AA-이상)액티브 | 채권 | 한국 | 1,075,500 | 3.71% |
| KODEX 차이나항셍테크 | 주식 | 중국 | 1,032,080 | 3.56% |
| TIGER 조선TOP10 | 주식 | 한국 | 776,705 | 2.68% |
| KODEX 미국배당다우존스 | 주식 | 미국 | 747,040 | 2.58% |
| ACE 미국10년국채액티브 | 채권 | 미국 | 255,990 | 0.88% |
| 현금 | 현금 | 한국 | 26,554 | 0.09% |

### 3.5 Section 4: 월별 수익률 추이

**차트 유형**: Combo Chart (Bar + Line)

- Bar: TFF 월별 수익률
- Line 1: 코스피 월별 수익률
- Line 2: S&P500 월별 수익률

X축: 월별 (2024.7 ~ 현재)

데이터 (종목별수익률 및 총누적손익 시트 기준):

| 월 | TFF | 코스피 | S&P500 |
|---|---|---|---|
| 2024.08 | +0.41% | -3.48% | +2.28% |
| 2024.09 | -0.42% | -3.03% | +2.02% |
| 2024.10 | +0.87% | -1.43% | -0.99% |
| 2024.11 | -0.99% | -3.92% | +5.73% |
| 2024.12 | +0.33% | -2.30% | -2.50% |
| 2025.01 | +2.00% | +4.91% | +2.70% |
| 2025.02 | +0.04% | +0.61% | -1.42% |
| 2025.03 | -1.56% | -2.04% | -5.75% |
| 2025.04 | -1.22% | +3.04% | -0.76% |
| 2025.05 | +3.21% | +5.52% | +6.15% |
| 2025.06 | +8.93% | +13.86% | +4.96% |
| 2025.07 | +3.52% | +5.66% | +2.17% |
| 2025.08 | +0.15% | -1.83% | +1.91% |
| 2025.09 | +6.86% | +7.49% | +3.53% |
| 2025.10 | +13.92% | +19.94% | +2.27% |
| 2025.11 | -1.64% | -4.40% | +0.13% |
| 2025.12 | +3.17% | +7.32% | -0.05% |
| 2026.01 | +16.19% | +23.97% | +1.37% |
| 2026.02 | +7.56% | +19.52% | -0.87% |
| 2026.03 | -8.21% | -19.08% | -5.09% |

양수/음수에 따라 바 색상을 초록/빨강으로 구분한다. 차트 하단에 수익률이 시장 대비 우수/열등한 구간을 하이라이트 표시한다.

### 3.6 Section 5: 종목별 성과

**차트 유형**: Horizontal Bar Chart (수익률 기준 정렬)

2026년 누적 기준 종목별 자본수익률:

| 종목 | 누적 수익률 | 상태 |
|---|---|---|
| KODEX 반도체 | +34.45% | 최고 수익 |
| KODEX AI전력핵심설비 | +18.44% | 매도 완료 |
| TIGER 코리아밸류업 | +17.78% | |
| KODEX 금융고배당TOP10 | +17.41% | |
| KODEX 미국배당다우존스 | +15.02% | |
| KODEX 200 | +14.72% | |
| ACE 주주환원가치주액티브 | +11.43% | |
| PLUS 고배당주 | +7.76% | |
| ACE KRX금현물 | +7.74% | |
| TIGER 지주회사 | +6.13% | |
| ACE 미국10년국채액티브 | +3.99% | |
| KODEX iShares미국하이일드액티브 | +3.09% | |
| KODEX 26-12 회사채(AA-이상)액티브 | -0.05% | |
| KODEX 미국30년국채액티브(H) | -1.32% | 매도 완료 |
| TIGER 미국S&P500 | -1.64% | |
| TIGER 미국나스닥100 | -2.66% | |
| KODEX 국고채10년액티브 | -2.41% | |
| TIME K바이오액티브 | -3.45% | 매도 완료 |
| KODEX 53-09 국고채액티브 | -3.53% | 매도 완료 |
| KODEX 미국AI테크TOP10 | -8.47% | |
| KODEX 차이나항셍테크 | -14.24% | |
| TIGER 조선TOP10 | -16.02% | |

구현 참고:
- 양수는 초록 바, 음수는 빨강 바로 시각화
- 매도 완료된 종목은 별도 표시 (반투명 또는 아이콘)
- 종목명 클릭 시 월별 수익률 추이를 tooltip 또는 모달로 표시
- 2025년 데이터 추가 시 기간 필터(2025/2026/전체) 제공

### 3.7 Section 6: 벤치마크 비교

**차트 유형**: Multi-Line Chart (누적 수익률)

전체 기간(2024.7~현재) 동안 TFF와 주요 지수의 누적 수익률을 비교한다. 모든 지수를 100으로 정규화하여 동일 기준으로 비교한다.

표시 지수:
- TFF (굵은 실선, 메인 컬러)
- 코스피 (실선)
- S&P500 (실선)
- 나스닥 (점선, 토글 가능)
- 코스닥 (점선, 토글 가능)
- 다우존스 (점선, 토글 가능)

연간 수익률 요약 테이블도 함께 표시:

| 지표 | 2024년 | 2025년 | 2026(Q1) | 총누적 |
|---|---|---|---|---|
| TFF | -0.03% | +32.86% | +13.19% | +44.80% |
| 코스피 | -13.40% | +75.63% | +19.89% | +82.35% |
| S&P500 | +6.51% | +16.39% | -4.63% | +18.22% |
| 나스닥 | +6.17% | +20.36% | -7.11% | +18.70% |
| 코스닥 | -15.56% | +36.46% | +13.71% | +31.03% |
| 다우존스 | +4.17% | +12.97% | -3.58% | +13.46% |

분석 포인트 (대시보드에 텍스트로 표시):
- TFF는 S&P500 대비 +26.6%p 초과 성과
- 코스피 대비로는 -37.5%p 하회하나, 변동성은 현저히 낮음
- 분산투자 효과로 하락장 방어력이 높음 (2026.3월: TFF -8.2% vs 코스피 -19.1%)

### 3.8 Section 7: 시장 인사이트 타임라인

**UI 유형**: 세로 타임라인 (최신순)

월별 수익률과 함께 해당 월의 주요 시장 이벤트를 시간순으로 나열한다. 수익률 차트의 특정 구간을 클릭하면 해당 월의 인사이트로 스크롤 이동하는 연동 기능을 제공한다.

각 월별 표시 항목:
- 월 표시 + 해당월 TFF 수익률 뱃지
- 인사이트 텍스트 목록
- 양수 수익 월은 초록 테마, 음수는 빨강 테마

데이터: 인사이트 시트의 80건 내외 텍스트 (2024.7 ~ 2026.4)

---

## 4. 컴포넌트 설계

### 4.1 디렉토리 구조 (기존 etf-lens 앱 내)

```
src/
├── app/
│   └── tff/
│       ├── page.tsx              # 메인 대시보드 페이지
│       ├── layout.tsx            # TFF 전용 레이아웃 (헤더/푸터)
│       └── components/
│           ├── TffKpiCards.tsx        # Section 1: KPI 카드
│           ├── TffAssetTrend.tsx      # Section 2: 자산 추이 차트
│           ├── TffPortfolio.tsx       # Section 3: 포트폴리오 구성
│           │   ├── AssetDonut.tsx     #   자산유형별 도넛
│           │   ├── MarketDonut.tsx    #   국가별 도넛
│           │   └── HoldingsTree.tsx   #   개별종목 트리맵
│           ├── TffMonthlyReturn.tsx   # Section 4: 월별 수익률
│           ├── TffStockRanking.tsx    # Section 5: 종목별 성과
│           ├── TffBenchmark.tsx       # Section 6: 벤치마크 비교
│           ├── TffInsightTimeline.tsx # Section 7: 인사이트
│           └── shared/
│               ├── TffCard.tsx        # 공용 카드 컴포넌트
│               ├── TffChart.tsx       # 공용 차트 래퍼
│               └── TffTooltip.tsx     # 공용 툴팁
├── data/
│   └── tff/
│       ├── config.json
│       ├── portfolio-2024.json
│       ├── portfolio-2025.json
│       ├── portfolio-2026.json
│       ├── benchmarks.json
│       └── insights.json
├── lib/
│   └── tff/
│       ├── types.ts              # TypeScript 타입 정의
│       ├── utils.ts              # 데이터 변환 유틸리티
│       └── constants.ts          # 색상, 라벨 등 상수
└── scripts/
    └── convert-tff-excel.ts      # 엑셀 → JSON 변환 스크립트
```

### 4.2 주요 컴포넌트 명세

#### TffKpiCards

- Props: `{ summary: TffSummary, prevSummary?: TffSummary }`
- 6개 카드 그리드 (desktop: 3x2, mobile: 2x3)
- 전월 대비 변화율 계산 및 표시
- 수익/손실에 따른 색상 분기

#### TffAssetTrend

- Props: `{ monthlyData: MonthlySnapshot[] }`
- 차트 라이브러리: Recharts (기존 etf-lens에서 사용 중인 라이브러리 활용)
- Area Chart + 하단 Bar Chart 오버레이
- 금액 포맷: 만원 단위 (예: 2,896만원)
- Tooltip에 상세 정보 표시

#### TffPortfolio

- Props: `{ holdings: Holding[], targetAllocation: TargetAllocation }`
- 3개 탭: 자산유형별 / 국가별 / 개별종목
- 목표 대비 괴리 시각화 (Radar Chart 또는 Gauge)
- 괴리가 ±5%p 이상일 경우 경고 아이콘 표시

#### TffMonthlyReturn

- Props: `{ returns: MonthlyReturn[], benchmarks: BenchmarkReturn[] }`
- Combo Chart (Bar + Line)
- 범례 토글 기능
- 기간 필터: 전체 / 2024 / 2025 / 2026

#### TffStockRanking

- Props: `{ stockReturns: StockReturn[] }`
- Horizontal Bar Chart
- 정렬 옵션: 수익률순 / 비중순 / 종목명순
- 매도 완료 종목 표시 분리

#### TffBenchmark

- Props: `{ cumulativeData: CumulativeReturn[] }`
- Multi-Line Chart (정규화 기준 100)
- 지수별 토글 on/off
- 연간 수익률 요약 테이블 동반

#### TffInsightTimeline

- Props: `{ insights: InsightEntry[] }`
- 세로 타임라인 UI
- 최신순 정렬 (접이식으로 과거 데이터 확장)
- 월별 수익률 뱃지와 함께 표시

### 4.3 TypeScript 타입 정의

```typescript
// src/lib/tff/types.ts

interface TffConfig {
  fundName: string;
  startDate: string;
  monthlyContribution: number;
  guidelines: {
    principles: string[];
    targetAllocation: {
      byAsset: Record<string, { 한국: number; 해외: number; 합계: number }>;
    };
  };
}

interface Holding {
  name: string;
  category: '주식' | '채권' | '대체' | '현금';
  market: '한국' | '미국' | '중국' | '인도';
  beginValue: number;
  buyAmount: number;
  sellAmount: number;
  endValue: number;
  dividend: number;
  pnl: number;
  weight: number;
  returnRate: number;
  dividendReturn: number;
  capitalReturn: number;
}

interface MonthlySummary {
  totalBeginValue: number;
  totalBuyAmount: number;
  totalSellAmount: number;
  totalEndValue: number;
  totalDividend: number;
  totalPnl: number;
  cashBalance: number;
  monthlyReturn: number;
  dividendReturn: number;
  capitalReturn: number;
}

interface CashFlow {
  beginBalance: number;
  deposit: number;
  withdrawal: number;
  endBalance: number;
  netPnl: number;
}

interface MonthlySnapshot {
  period: string; // "YYYY-MM"
  holdings: Holding[];
  summary: MonthlySummary;
  cashFlow: CashFlow;
}

interface YtdSummary {
  totalBeginValue: number;
  totalEndValue: number;
  totalInvested: number;
  totalPnl: number;
  returnOnInvestment: number;
  timeWeightedReturn: number;
}

interface BenchmarkData {
  period: string;
  [indexName: string]: string | number;
}

interface InsightEntry {
  month: string;
  items: string[];
}

interface StockReturn {
  name: string;
  category: string;
  market: string;
  monthlyReturns: Record<string, number>; // "YYYY-MM": returnRate
  cumulativeReturn: number;
  isSold: boolean; // 매도 완료 여부
}
```

---

## 5. 기술 스택 및 라이브러리

### 5.1 기존 etf-lens 스택 기반

| 영역 | 기술 | 비고 |
|---|---|---|
| 프레임워크 | Next.js (App Router) | 기존 앱 |
| 언어 | TypeScript | 기존 앱 |
| 스타일링 | Tailwind CSS | 기존 앱 |
| 차트 | Recharts | 기존 앱에서 사용 중이면 동일하게, 아니면 후보: Chart.js, Nivo |
| 상태관리 | React useState/useContext | 간단한 필터 상태만 관리 |
| 데이터 | Static JSON (import) | SSG/ISR로 빌드 시 포함 |

### 5.2 추가 필요 라이브러리

| 라이브러리 | 용도 | 비고 |
|---|---|---|
| xlsx (SheetJS) | 엑셀 → JSON 변환 스크립트 | devDependency |
| numeral 또는 자체 유틸 | 숫자 포맷팅 (만원, %) | 기존 유틸 있으면 활용 |
| framer-motion (선택) | 차트/카드 애니메이션 | 이미 사용 중이면 활용 |
| date-fns | 날짜 포맷/계산 | 이미 사용 중일 가능성 높음 |

---

## 6. 개발 일정 (Phase별)

### Phase 1: 기반 구축 (1~2일)

- JSON 데이터 구조 확정 및 2026년 데이터 변환
- TypeScript 타입 정의
- TFF 페이지 라우팅 및 레이아웃 구성
- 엑셀 → JSON 변환 스크립트 작성

산출물: `/tff` 경로 접근 가능, 빈 레이아웃에 데이터 로딩 확인

### Phase 2: 핵심 대시보드 (2~3일)

- KPI 카드 구현 (Section 1)
- 자산 추이 Area Chart (Section 2)
- 월별 수익률 Combo Chart (Section 4)
- 반응형 그리드 레이아웃

산출물: 핵심 3개 섹션이 동작하는 MVP 대시보드

### Phase 3: 포트폴리오 분석 (2~3일)

- 포트폴리오 구성 3탭 (Section 3)
  - 자산유형별 Donut
  - 국가별 Donut
  - 개별종목 Treemap/Bar
- 목표 대비 괴리 시각화
- 종목별 성과 랭킹 (Section 5)

산출물: 포트폴리오 분석 기능 완성

### Phase 4: 벤치마크 및 인사이트 (1~2일)

- 벤치마크 비교 Multi-Line Chart (Section 6)
- 연간 수익률 요약 테이블
- 인사이트 타임라인 (Section 7)
- 차트 ↔ 인사이트 연동

산출물: 전체 7개 섹션 완성

### Phase 5: 2025년 데이터 통합 및 고도화 (2~3일)

- 2025년 상세 월별 데이터 입력 및 통합
- 기간 필터 기능 (연도별, 전체)
- 차트 인터랙션 개선 (줌, 드릴다운)
- 성능 최적화 (차트 렌더링, 이미지 최적화)

산출물: 전체 기간 데이터가 통합된 완성 대시보드

### Phase 6: 부가기능 및 배포 (1~2일)

- 접근 제어 (비밀번호 또는 토큰 기반 간단 인증)
- PDF/이미지 내보내기 기능 (선택)
- SEO 메타태그 및 OG 이미지
- 최종 테스트 및 Vercel 배포

산출물: 프로덕션 배포 완료

총 예상 기간: 약 9~15일 (집중 개발 기준)

---

## 7. 특이사항 및 고려사항

### 7.1 데이터 정합성

- 엑셀의 셀 병합, 비정형 레이아웃으로 인해 자동 파싱 시 주의 필요
- 월별 시트(1~12월)의 컬럼 구조가 69개 컬럼으로 많은 병합 셀 포함
- 4~12월(2025년) 시트는 종목 데이터 없이 현금잔고/종합손익만 존재 → 해당 기간은 종합 수익률만 표시
- 매도 완료 종목(KODEX 53-09, TIME K바이오, KODEX 미국30년국채, KODEX AI전력핵심설비)의 이력 관리 필요

### 7.2 2025년 데이터 추가 시 주의점

- 현재 2025년 4~12월은 현금으로만 보유 중이었으므로, 종목별 상세 데이터가 없음
- 2025년 1~3월은 2026년 YTM 시트에서 역산 가능하나, 향후 원본 데이터로 교체 예정
- 데이터 추가 시 기존 구조를 깨지 않도록 portfolio-YYYY.json 연도별 분리 구조 유지

### 7.3 접근 제어

- 개인 재무 데이터가 포함되어 있으므로, 최소한의 접근 제어 필요
- 1차: 단순 비밀번호 (URL 파라미터 또는 쿠키 기반)
- 2차(선택): 멤버별 이메일 기반 매직링크 인증
- Back-up 시트의 개인 자산 정보는 대시보드에 포함하지 않음

### 7.4 모바일 최적화

- TFF 멤버들이 카카오톡 등으로 링크를 공유받아 모바일에서 주로 확인
- 차트는 가로 스크롤보다 세로 스택 레이아웃 선호
- 터치 인터랙션 고려 (tooltip → 탭으로 작동)
- KPI 카드는 2열 그리드로 재배치

### 7.5 향후 확장 고려

- 월배당 포트폴리오 시뮬레이터 (Portfolio 시트의 월배당 옵션1/2 데이터 활용)
- 환율 영향도 분석 (해외 ETF 32.8% 비중에 대한 환율 효과 분리)
- 리밸런싱 알림 (목표 배분 대비 괴리가 임계값 초과 시)
- 알림 기능 (월말 데이터 업데이트 시 멤버에게 카카오톡 알림)
- 멤버별 개인 포트폴리오 추적 (현재는 펀드 전체 단위)

---

## 8. 엑셀 → JSON 변환 스크립트 명세

### 8.1 변환 대상 시트 및 매핑 규칙

| 시트 | 출력 파일 | 핵심 파싱 로직 |
|---|---|---|
| 투자가이드라인 | config.json | Row 2~17의 원칙, Row 9~14의 배분표 |
| 투자비중 | portfolio-YYYY.json (해당월 holdings) | Row 4~22: 종목별 데이터 (Col 1:구분1, 2:구분2, 3:종목명, 4:평가금액, 5:비중) |
| 1~3월 (상세) | portfolio-YYYY.json (해당월 상세) | Row 4~22: 종목별 (Col 22:기초, 28:매수, 36:매도, 42:기말, 50:배당, 61:손익, 64:비중, 65~68:수익률) |
| 4~12월 (간략) | portfolio-YYYY.json (현금만) | 마지막 행들의 이월잔고/입금/출금/종합잔고/투자손익 |
| YTM | portfolio-YYYY.json (ytd) | Row 4~25: 종목별 누적, Row 27: 합계, Row 32~34: 총입금액수익/시간평잔 |
| 종목별수익률 | portfolio-YYYY.json (stockReturns) | Row 3~25: 종목별 월간 수익률 (Col 2~13: 1~12월, Col 14: 누적) |
| 총누적손익 | 각 연도 JSON + benchmarks.json | Row 5~11: 기초/입출금/기말/수익/수익률/코스피/S&P500 (Col per month) |
| vs벤치마크 | benchmarks.json | Row 25~32: 월별 수익률, Row 36~42: 지수 절대값 |
| 인사이트 | insights.json | Row 1~79: 월별 텍스트 (Col 1: 월, Col 2: 텍스트) |

### 8.2 스크립트 실행 방법

```bash
# 설치
npm install xlsx --save-dev

# 실행
npx ts-node scripts/convert-tff-excel.ts \
  --input "./data/TFF_펀드_현황_2026년_3월말.xlsx" \
  --output "./src/data/tff/" \
  --year 2026
```

### 8.3 주의사항

- 엑셀의 69개 컬럼 중 대부분은 병합 셀의 빈 컬럼이므로, 의미 있는 데이터 컬럼 위치를 하드코딩으로 지정
- 시트별로 헤더 행 위치가 다름 (투자비중: Row 3, 월별: Row 3, YTM: Row 3)
- 숫자가 문자열로 읽히는 경우 처리 (특히 수익률의 True/False 혼입)
- 매도 완료 종목은 기말평가금액이 0이면서 매도금액이 있는 경우로 식별

---

## 부록: 핵심 숫자 요약 (2026년 3월말 기준)

| 항목 | 값 |
|---|---|
| 펀드 설립일 | 2024년 7월 |
| 총 운용기간 | 20개월 |
| 월 적립금 | 1,000,000원 |
| 총 투자원금 | 25,584,960원 |
| 총 평가금액 | 28,960,219원 |
| 누적 수익금 | +3,375,259원 |
| 총입금액 대비 수익률 | +13.19% |
| 시간가중 수익률(2025) | +29.35% |
| 총 누적 수익률 | +44.80% |
| 보유 종목 수 | 18개 ETF + 현금 |
| 총 배당 수령액 | 104,857원 (2026 YTM) |
| 자산유형 | 주식 85.2% / 채권 8.6% / 금 6.1% / 현금 0.1% |
| 지역배분 | 한국 63.6% / 미국 32.8% / 중국 3.6% |
| 최고 수익 종목 | KODEX 반도체 (+34.45%) |
| 최대 손실 종목 | TIGER 조선TOP10 (-16.02%) |