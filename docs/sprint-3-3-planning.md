# Sprint 3 Story 3 (S3-3) Implementation Plan

> **Feature Title:** VKOSPI / Fear & Greed 다차원 시장 감정 모니터링 고도화 및 고급 지표 분석 연동 (Advanced Multi-Dimensional Market Sentiment Analysis)
> **Target Date:** 2026-05-19  
> **Status:** 🔧 In Planning

---

## 1. 🌟 Vision & Goal

사용자가 시장의 거시적 위험을 단순히 단편적으로 조지르는 것이 아니라, 변동성(Volatility)과 투자자 심리(Fear & Greed)를 다차원적으로 융합 분석하여 위기를 조기에 경보할 수 있도록 합니다. 
해외 VIX 뿐만 아니라 **국내 KOSPI 실현 변동성 (VKOSPI 프록시 지표)**을 퀀트(Quant) 방법론으로 직접 연산 및 데이터베이스에 적재하고, 대시보드의 Exit Signal UI를 **프리미엄 Bento Grid**와 **글래스모피즘 네온 게이지 차트 (Neon Gauge Chart)**로 고도화하여 압도적인 시각적 첫인상(WOW 포인트)을 선사합니다.

---

## 2. 📋 Core Requirements & Specifications

### 1) Backend: 퀀트 기반 변동성 분석 고도화 및 DB 영속화
* **VKOSPI 프록시 (KOSPI Realized Volatility) 연산 구현:**
  * yfinance 등 공용 API에서 `^VKOSPI` 조회가 불가능하므로, KOSPI 지수의 최근 20영업일/30영업일 종가 기준 **역사적 변동성(Historical Volatility, HV)**을 연산하여 연율화(Annualized, $\sigma \times \sqrt{252} \times 100$)한 수치를 VKOSPI의 초정밀 프록시 지표로 활용합니다.
  * 수식: $HV = \text{std}(\text{ln}(P_t / P_{t-1})) \times \sqrt{252} \times 100$
* **다차원 Fear & Greed Index (FGI) 보완:**
  * 기존 단순 VIX 기반 프록시 수식을 보완하여, (1) VIX 변동성 점수, (2) KOSPI 20일 실현 변동성 점수, (3) S&P500의 50일 이동평균선 이격도(RSI)를 4:3:3 비율로 가중 합성하여 글로벌+국내 정합성을 모두 잡은 **다차원 하이브리드 FGI**를 자체 산출합니다.
* **센티먼트 시계열 DB 적재 및 영속화:**
  * 매일 `daily_perf_calc` 스케줄러 가동 시, 연산된 `vix`, `vkospi_proxy`, `fgi`, `kospi`, `sp500` 값을 `market_sentiment_log` 테이블(SQLite & PostgreSQL)에 영구 기록합니다.
  * 캐시 만료 시 매번 야후 파이낸스 3개년 차트 데이터를 full-scan하여 연산하는 오버헤드를 줄이고, 모바일이나 저사양 환경에서도 즉시 10년 장기 추세 차트 조회가 가능하도록 캐시 및 DB를 연계합니다.
* **신규 API 엔드포인트 제공:**
  * `GET /api/v1/exit-signal`: 종합 위험 수준, 게이지 각도 점수, 각 지표별 최신 세부 수치(VIX, VKOSPI Proxy, CLI, PER, Dollar) 및 종합 액션 요약 반환.
  * `GET /api/v1/exit-signal/history?period=1Y`: 차트용 시계열 데이터 반환.

### 2) Frontend: 프리미엄 다크 글래스모피즘 Bento Grid & Neon Gauge UI
* **종합 위험도 네온 게이지 차트 (Overall Risk Gauge):**
  * Canvas 혹은 SVG 패스를 이용해 반원형 게이지를 렌더링하고, 바깥 테두리에 **부드러운 네온 글로우(Drop Shadow + Radial Gradient)** 효과를 가미하여 premium 스마트 워치 인터페이스를 구현합니다.
  * 현재 위험 수준(안전, 주의, 경계, 위험)에 따라 게이지 색상(Green, Yellow, Orange, Red)이 그라데이션으로 유동적으로 변하며, 바늘(Needle)이 Spring 물리 기반 애니메이션으로 부드럽게 각도를 찾아 이동하도록 마이크로인터랙션을 극대화합니다.
* **벤토 그리드(Bento Grid) 레이아웃 리디자인:**
  * 대시보드의 기존 3열 카드를 균형 잡힌 비대칭 Bento Grid로 재배치합니다.
  * **Card A (종합 지수 및 게이지):** 넓은 2칸 차지. 네온 게이지 + 종합 리스크 레벨 + AI 위험 요약 및 행동 강령 리포트.
  * **Card B (글로벌 공포-탐욕 & VIX):** 1칸 차지. VIX와 FGI를 탭 토글 형태로 교차 조회하며 이중 축 차트로 KOSPI/S&P500과의 상관성 확인.
  * **Card C (국내 변동성 - VKOSPI Proxy):** 1칸 차지. 퀀트로 계산된 한국 KOSPI 실현 변동성(20일 vs 60일) 추세 차트 및 한국 증시 공포 레벨 시각화.
  * **Card D (밸류에이션 - KOSPI Forward PER):** 1칸 차지.
  * **Card E (매크로 사이클 - OECD CLI):** 1칸 차지.
* **미세 인터랙션 및 효과:**
  * 모든 Bento Grid 요소에 마우스 오버 시 미세한 3D 회전(Tilt) 효과 또는 테두리에 마우스 커서를 추적하는 **그라데이션 보더 라이트(Border Spotlight)** 효과 적용.

---

## 3. 📂 Module Dependency & File Structure

```
[backend]
  ├── db/
  │     └── models.py (MarketSentimentLog 테이블 모델 추가)
  ├── core/
  │     └── quant_sentiment.py (신규 - KOSPI HV 및 하이브리드 FGI 퀀트 계산엔진)
  ├── api/
  │     └── exit_signal.py (신규 DB 쿼리 및 퀀트 엔진 연동, VKOSPI 라우터 추가)
  └── core/
        └── scheduler.py (매일 장 마감 후 변동성/FGI DB 적재 스크립트 연동)

[dashboard]
  └── src/
        ├── components/
        │     ├── RiskGaugeChart.tsx (신규 - SVG + CSS 애니메이션 기반 프리미엄 게이지)
        │     ├── KospiExitAnalyzer.tsx (Bento Grid 리디자인 및 VKOSPI 연동)
        │     └── ExitSignalModals.tsx (VKOSPI 전용 상세 모달 컨텐츠 추가)
```

---

## 🛡️ Reliability & Optimization Guardrails
1. **NaN/Zero Division Prevention:** KOSPI 지수가 연휴 등으로 휴장하거나 거래정지되어 20일 변동성이 0이 되거나 데이터 누락 시 NaN 에러가 발생하지 않도록 `fillna(method='ffill')` 및 최저 하한선($0.01$) 예외 코드를 적용합니다.
2. **Database Fallback:** DB가 최초 빌드되어 `MarketSentimentLog` 테이블이 비어 있는 경우, 즉시 fallback 로직을 기동하여 야후 파이낸스 v8 chart API 기반의 실시간 퀀트 연산을 통해 무중단으로 대시보드를 채웁니다.
3. **Smooth Framerate:** 게이지 애니메이션 구동 시 CPU 부하를 방지하기 위해 React 상태 트리거가 아닌 pure CSS transition 또는 `requestAnimationFrame`을 사용하여 60FPS의 매끄러운 움직임을 제공합니다.

---

## 🧭 Step-by-Step Sprint Roadmap

- **Step 1:** [Backend] `db/models.py`에 `MarketSentimentLog` 모델 설계 및 마이그레이션.
- **Step 2:** [Backend] `core/quant_sentiment.py` 구현 (KOSPI 20일/60일 실현 변동성 연산식 + 하이브리드 FGI 퀀트 엔진).
- **Step 3:** [Backend] `api/exit_signal.py`에 퀀트 엔진 탑재 및 DB 적재 연동, `/api/v1/exit-signal` 개편.
- **Step 4:** [Frontend] `RiskGaugeChart.tsx` 프리미엄 게이지 컴포넌트 신규 구현.
- **Step 5:** [Frontend] `KospiExitAnalyzer.tsx` Bento Grid 레이아웃 리디자인 및 실시간 VKOSPI(HV) 연동.
- **Step 6:** [Frontend] `ExitSignalModals.tsx`에 한국 실현 변동성 상세 모달 보완.
- **Step 7:** [Test] 백엔드 비동기 테스트코드 작성 및 마이그레이션 검증.
