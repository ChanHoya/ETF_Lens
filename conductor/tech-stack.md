# Tech Stack — ETF Lens

## 아키텍처 개요

```
[User Browser]
     │
     ▼
[Vercel — Next.js 16]          dashboard/
     │  HTTPS API 호출
     ▼
[Render — FastAPI]             backend/
     │
     ├── PostgreSQL (Render $7/월)   etf_data_v2.db (SQLite 로컬 fallback)
     ├── KIS API (한국투자증권)        증권 계좌 잔고/체결
     ├── Gemini API (Google)         AI 분석/채팅
     ├── yfinance / pykrx / FDR      시세 데이터
     └── APScheduler                 1시간 배치 스케줄러
```

## Frontend

| 항목 | 기술 | 버전 |
|---|---|---|
| Framework | Next.js (App Router) | 16.1.6 |
| Runtime | React | 19.2.3 |
| Language | TypeScript | ^5 |
| Styling | Tailwind CSS | ^4 |
| Charts | Recharts | ^2.15.1 |
| Icons | lucide-react | ^0.475.0 |
| Excel | xlsx | ^0.18.5 |
| Deploy | Vercel | - |

**환경변수** (Vercel):
- `NEXT_PUBLIC_API_BASE` = `https://etf-lens.onrender.com`

## Backend

| 항목 | 기술 | 버전 |
|---|---|---|
| Framework | FastAPI | 0.129.2 |
| Language | Python | 3.11+ |
| DB ORM | SQLAlchemy (async) | 2.x |
| DB Driver | asyncpg (PostgreSQL) / aiosqlite (SQLite) | - |
| Scheduler | APScheduler | 3.11.2 |
| HTTP Client | httpx | async |
| Data | yfinance, pykrx, finance-datareader | - |
| AI | google-generativeai (Gemini) | - |
| Deploy | Render (Web Service) | - |

**환경변수** (Render):
```
DATABASE_URL=postgresql://...@dpg-.../etf_lens_db
GEMINI_API_KEY=...
KIS_APP_KEY1/2/3, KIS_APP_SECRET1/2/3
KIS_ACC1/2/3/4 (계좌번호)
KIS_URL_BASE=https://openapi.koreainvestment.com:9443
```

## 데이터 흐름

```
KIS API → my_assets.py → PostgreSQL (user_principal, shared_portfolios)
yfinance/pykrx → scheduler → etf_master, etf_daily_prices
Gemini API → chat.py, macro_compass.py → 실시간 응답 (비캐시)
Excel Upload → excelParser.ts (client-side) → TFF 대시보드
```

## DB 스키마 (주요 테이블)

| 테이블 | 용도 |
|---|---|
| `etf_master` | ETF 기본정보 + 성과지표 (~1,000행) |
| `etf_daily_prices` | 일별 종가 이력 |
| `etf_holdings` | ETF 구성 종목 |
| `user_principal` | 계좌별 수동 입력 원금 |
| `shared_portfolios` | 포트폴리오 마켓 공유 |
| `app_version` | 스케줄러 실행 이력 |
| `benchmark_prices` | KOSPI/KOSDAQ 등 벤치마크 |

---
*Bootstrapped: 2026-04-23*
