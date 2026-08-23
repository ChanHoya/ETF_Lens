# Implementation Plan — S4-1: ETF Overlap Analyzer Backend Quant Engine

This document outlines the detailed technical specifications and implementation steps for building the backend quantitative engine of the ETF Overlap Analyzer.

---

## 1. Objectives & Use Cases

### Objectives
1. **True Asset Exposure (실질 자산 노출 비중)**: Resolve the underlying stock weights (holdings) of all ETFs held in a user's KIS portfolio, weighted by each ETF's active weight in the total portfolio, to calculate the user's *true* individual stock exposure.
2. **ETF Overlap Matrix (ETF 간 상호 중복도 행렬)**: Calculate an $N \times N$ matrix representing the mutual overlap percentage between all pairwise combinations of ETFs held.
3. **Diversification Efficiency Score (포트폴리오 분산 효용성 점수)**: Synthesize an aggregate diversification metric based on weighted holding overlaps and concentration.
4. **Treemap & Grid Data Structures**: Structure the output payload in a highly clean format ready for Recharts / D3 Treemaps and standard Grid visuals.

---

## 2. Mathematical Formulations

### 1. True Underlying Stock Exposure
Let:
- $E$ be the set of ETFs in the portfolio.
- $W_{etf}$ be the weight of the ETF in the portfolio (where $\sum_{etf \in E} W_{etf} + W_{cash} = 1.0$).
- $H_{etf, i}$ be the weight of stock $i$ *inside* that specific ETF (where $0 \le H_{etf, i} \le 100$).

The **True Weight** of stock $i$ in the total portfolio ($TW_i$) is calculated as:
$$TW_i = \sum_{etf \in E} \left( W_{etf} \times \frac{H_{etf, i}}{100} \right)$$

### 2. Pairwise ETF Overlap
For any two ETFs, $A$ and $B$, their mutual holding overlap percentage ($Overlap_{A, B}$) is:
$$Overlap_{A, B} = \sum_{i \in \text{Stock } A \cap \text{ Stock } B} \min\left(H_{A, i}, H_{B, i}\right)$$
This yields a percentage between `0.0` (completely distinct) and `100.0` (identical holdings and weights).

### 3. Diversification Efficiency Score (DES)
To penalize overlapping portfolios and reward well-distributed individual stock concentrations:
$$DES = 100 \times \left(1 - \sum_{A \in E} \sum_{B \in E, B \ne A} (W'_A \times W'_B \times \frac{Overlap_{A, B}}{100}) \right)$$
where $W'$ are the normalized weights of the ETFs within the *ETF-only* segment of the portfolio (excluding cash).

---

## 3. Database & Core Services Integration

We will reuse:
- **`ETFHoldings` DB Model**: To fetch underlying stocks (`ticker`) and `weight` for each ETF.
- **`my_assets.py` Portfolio Endpoint**: To fetch the active list of ETFs and their current valuations (`eval_amount`).
- **`harvester` Service fallback**: In case some newly added ETFs have missing holdings, we leverage the pre-defined holdings dictionary in `harvester.py` or the static space fallbacks.

---

## 4. Proposed API Specifications

### `GET /api/v1/portfolio/overlap`

#### Request Query Params
- None (automatically reads the user's active KIS portfolio from the 5-minute cache).

#### Response Payload (JSON)
```json
{
  "status": "success",
  "summary": {
    "etf_total_eval": 45000000.0,
    "cash_balance": 5000000.0,
    "diversification_score": 84.5
  },
  "overlap_matrix": {
    "069500": {
      "069500": 100.0,
      "453850": 14.5
    },
    "453850": {
      "069500": 14.5,
      "453850": 100.0
    }
  },
  "true_exposure": [
    {
      "ticker": "005930",
      "name": "삼성전자",
      "weight_in_portfolio": 12.4,
      "contributing_etfs": [
        { "code": "069500", "etf_name": "KODEX 200", "weighted_contribution": 9.2 },
        { "code": "453850", "etf_name": "TIGER 200", "weighted_contribution": 3.2 }
      ]
    }
  ],
  "treemap_data": {
    "name": "Portfolio",
    "children": [
      {
        "name": "주식",
        "children": [
          { "name": "삼성전자", "value": 12.4 },
          { "name": "SK하이닉스", "value": 4.1 }
        ]
      },
      {
        "name": "현금",
        "value": 10.0
      }
    ]
  }
}
```

---

## 5. Coding Pipeline & Steps

### Step 1: Create Overlap Engine (`backend/core/overlap_analyzer.py`)
- Implement a class `ETFOverlapAnalyzer` that accepts:
  - List of active portfolio holdings.
  - SQLAlchemy db session.
- Query DB `ETFHoldings` for all held ETFs in parallel.
- Fall back to the live harvester crawler or static dictionaries if holdings are empty in the DB.
- Compute the true stock exposures, overlap matrix, and DES score.

### Step 2: Register API Router Endpoint (`backend/api/router.py`)
- Define `@router.get("/portfolio/overlap")`.
- Extract portfolio assets by calling `get_my_portfolio()` internally (sharing the cache).
- Execute the overlap analyzer and return structured results.

### Step 3: Implement Unit Tests (`backend/tests/test_overlap.py`)
- Write tests using mocks for KIS portfolio holdings.
- Assert that true stock weights sum up properly and that complete overlaps (e.g. comparing an ETF with itself) yield `100.0`.

---

## 6. Verification Checklist

- [x] Run `pytest backend/tests/test_overlap.py` and ensure pass.
- [x] Call `/api/v1/portfolio/overlap` with mocked/live accounts and check response integrity.
- [x] Validate that all numeric outputs are free of `NaN` or `None` values (prevent client-side crashes).
