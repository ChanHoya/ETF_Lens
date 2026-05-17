# Findings: S1-9 섹터별 상관관계 분석

## 1. 섹터별 기준 ETF 매핑 리스트
상관관계 엔진이 사용할 한/미 대표 ETF 티커 매핑 테이블입니다.

| 섹터명 | 한국 ETF 티커 | 미국 ETF 티커 |
|---|---|---|
| **반도체** | `KODEX 반도체` (091160.KS) | `SOXX` (iShares Semiconductor) |
| **2차전지** | `TIGER 2차전지테마` (305540.KS) | `LIT` (Global X Lithium & Battery) |
| **바이오** | `KODEX 바이오` (244580.KS) | `IBB` (iShares Biotechnology) |
| **금융** | `KODEX 은행` (091170.KS) | `XLF` (Financial Select Sector SPDR) |
| **방산** | `TIGER HND국방` (461580.KS) | `ITA` (iShares U.S. Aerospace & Defense) |
| **우주** | `TIGER 스페이스테크` (462900.KS) | `ARKX` (ARK Space Exploration) |
| **에너지** | `KODEX 신재생에너지` (385550.KS) | `ICLN` (iShares Global Clean Energy) |

## 2. 상관계수 분석 공식
*   **Pearson Correlation Coefficient ($r$)**:
    $$r = \frac{\sum (X - \bar{X})(Y - \bar{Y})}{\sqrt{\sum (X - \bar{X})^2 \sum (Y - \bar{Y})^2}}$$
*   일별 종가 데이터 수집 후 일일 수익률(Daily Returns) 계산:
    $$R_t = \frac{P_t - P_{t-1}}{P_{t-1}}$$
*   두 수익률 시계열 $R_{X}$와 $R_{Y}$ 간의 피어슨 상관계수를 계산하여 매트릭스 도출.
