# Dependency Map

A living document of module relationships. Update whenever modules are added or modified.

## Module Registry

| Module | Layer | Purpose | Depends On | Depended By | Owner |
|--------|-------|---------|------------|-------------|-------|
<!-- Example:
| auth       | domain        | User authentication    | -              | api, admin    | Alice |
| api        | presentation  | REST endpoints         | auth, services | frontend      | Bob   |
| services   | application   | Business logic         | auth, database | api           | Alice |
| database   | infrastructure| Data persistence       | -              | services      | Carol |
-->
| Deploy Configs | Infrastructure | Render & Vercel serverless IAC configuration & verification | api, dashboard | - | Antigravity |
| DB Sync | Infrastructure | SQLite-to-PostgreSQL replication core & management | db/models, db/database | scheduler, MyDashboard | Antigravity |
| AI Rebalancing | Presentation | AI-driven ETF portfolio rebalancing recommendations | my_assets, peer_analysis | MyDashboard | Antigravity |
| ETF Overlap Analysis | Presentation | Pairwise holding overlaps, underlying stock exposure, and diversification efficiency score | my_assets, core/overlap_analyzer | MyDashboard | Antigravity |
| AI Rebalance Simulator | Presentation | Dynamic risk-triggered asset rebalancing simulation engine | my_assets, api/backtest | MyDashboard | Antigravity |
| US Macro Indicators | Presentation | US macro inflation indicator time-series charting & caching | db/models, api/exit_signal | MyDashboard | Antigravity |
| AI Chat Assistant | Presentation | Personal portfolio-based AI chat bot & prefill widgets | api/chat, ChatBot | MyDashboard, MyAssetsView | Antigravity |
| Space ETF Analysis | Presentation | Space sector ETF performance charts, custom legends, and toggled constituent comparison tables | api/router, SpaceChart | SectorAnalysisTab | Antigravity |
| ETF Disparity Monitoring | Presentation | Real-time Indicative NAV disparity rate analyzer and alert scheduling | core/disparity_analyzer, core/notifier, api/router | MyDashboard, SpaceChart, BioChart, scheduler | Antigravity |
| TFF IndexedDB Persistence | Presentation | Local storage of TFF Excel parsed JSON and version history comparisons | db.ts | TffDashboard | Antigravity |
| Efficient Frontier | Presentation | Portfolio Efficient Frontier MPT simulation & weight optimization | api/efficient_frontier | - | Antigravity |
| Asset History Tracking | Presentation | User portfolio asset snapshots and historical performance trend charting | my_assets, db/models, scheduler, AssetHistoryChart | MyAssetsView | Antigravity |
| Next Leading Sector Screener | Presentation | K-Market polarization index, M7 CAPEX bar charts, and quant-sifted top candidates of 10 major themes | backend/api/next_leader.py, db/models, scheduler, NextLeaderScreener | SectorAnalysisTab | Antigravity |
| Sector Flow Grid | Presentation | Sparkline line charts with 5/20/60-day moving average (dashed lines) overlays showing 1-year sector returns | backend/api/next_leader.py, SectorFlowGrid | SectorAnalysisTab | Antigravity |
| Energy ETF Analysis | Presentation | Energy sector ETF performance charts, custom legends, and toggled constituent comparison tables | api/router, EnergyChart | SectorAnalysisTab | Antigravity |
| Semiconductor ETF Analysis | Presentation | Semiconductor sector ETF performance charts, custom legends, and toggled constituent comparison tables | api/router, SemiChart | SectorAnalysisTab | Antigravity |
| Brazil Bond Analysis | Presentation | Brazil macro interest rate cycle analysis, historical yield trends, real-time scraping, and portfolio CAGR simulation | api/brazil_bond, core/brazil_fetcher | BrazilBondTab | Antigravity |
| Semiconductor Macro Cycle & CSCI | Presentation / Core | 5-Year rolling Z-score composite cycle index (CSCI), 4-phase cycle clock, BigTech CapEx tracker, subsector decoupling, and ETF allocation matrix | core/semi_cycle_engine, api/router, SemiCycleDashboard | SemiChart, SectorAnalysisTab | Antigravity |
| ETF Dividend Analysis | Application / Core | ETF dividend history scraping, payout frequency analysis, and portfolio monthly cashflow simulation | core/dividend_scraper, api/dividends, scheduler | DividendDashboard | Antigravity |
| Dividend Calendar & Cashflow Dashboard | Presentation | Monthly dividend cashflow visualization, 12-month dividend calendar matrix, dynamic portfolio share adjustment, and high-yield ETF rankings board | api/dividends, api/integrated_assets | MyAssetsView, MainApp | Antigravity |
| Brazil Total Return Simulator | Presentation / Core | NTN-F/LTN dirty price, duration, compound reinvestment, early sale capital gain/loss, breakeven FX rate, and 7x6 stress matrix | core/brazil_total_return, api/brazil_total_return | BrazilTotalReturnSimulator, BrazilBondTab | Antigravity |
| Brazil Election Intelligence | Presentation / Application | Real-time AI presidential election pulse, 1st round vote count persistence, runoff confirmation badge, and manual event dispatch | api/brazil_election_intel, api/brazil_bond | BrazilElectionDetailModal, BrazilBondTab | Antigravity |
| Hybrid Time-Series Engine | Core / Infrastructure | Universal DB-backed incremental price series fetcher (Gap-fill) & live price merge | db/models, yfinance, FDR, httpx | router, exit_signal | Antigravity |
| Compare & Cashflow Fast Cache | Application / Presentation | 60s memory caching for ETF comparison & batch DB retrieval for portfolio dividend cashflows | db/models, api/router, api/dividends | CompareTable, DividendDashboard | Antigravity |
| Pension Wealth Hub (S6-30) | Presentation / Core | Pension 3-pillar tax credit, NPS early/defer BEP crossover, and 30-year compound tax deferral simulation | lib/pensionRules, PensionWealthHub | MainApp | Antigravity |
| Portfolio Stress Tester (S6-31) | Core / Presentation | 7 major historical crises simulation, defense scoring, and KRW loss estimation | core/stress_tester, api/router, PortfolioStressTester | MyDashboard | Antigravity |
| Portfolio Rebalancer (S6-32) | Core / Presentation | Target weight drift calculation, cash-only vs full rebalancing orders, and CFP prescriptions | core/portfolio_rebalancer, api/router, PortfolioRebalancer | MyDashboard | Antigravity |
| Macro Regime Quadrant (S6-33) | Core / Presentation | 2D Growth-Inflation quadrant matrix, historical trajectory, and portfolio regime fit score | core/macro_regime, api/macro_dashboard, MacroRegimeQuadrant | DiscoverTab | Antigravity |
| Multi-Asset Backtester (S6-34) | Core / Presentation | All-weather/60:40/barbell presets, rebalance frequencies, CAGR/MDD/Sharpe, and underwater charting | core/multi_backtester, api/backtest, MultiAssetBacktester | MyDashboard | Antigravity |
| Tax Shield Radar (S6-35) | Core / Presentation | 20M KRW financial income limit tracking, health insurance cliff defense, and ISA/pension reallocation | core/tax_shield_analyzer, api/dividends, TaxShieldRadar | PensionWealthHub | Antigravity |
| Live Deployment Health Monitor (S6-36) | Infrastructure / Presentation | Production multi-pipeline live status endpoint and E2E regression verification suite | api/health_monitor, tests/test_live_e2e_sync | - | Antigravity |
| Portfolio Backtest Cache Engine (S7-1) | Core / Infrastructure | 10-year DB hybrid series loader & in-memory TTL 3600s backtest response caching | core/hybrid_series, db/models, api/backtest | PortfolioBacktester, MyDashboard | Antigravity |
| Rebalance & Efficient Frontier Cache (S7-2) | Core / Presentation | Time-series caching and Monte Carlo Efficient Frontier optimization acceleration | core/hybrid_series, api/backtest, api/efficient_frontier | AIRebalanceSimulator, EfficientFrontierPanel | Antigravity |
| KIS Integrated Asset Sync & Mapping (S7-3) | Application / Presentation | Bi-directional account mapping, default fallback hydration, and modal auto-fetch | api/integrated_assets, KisAccountMappingModal | TotalAssetBoard, MyAssetsView | Antigravity |
<!-- Add new modules above this line -->


## Dependency Rules

- **No circular dependencies**: If A depends on B, B must not depend on A. Bidirectional check: for each row, verify the module does NOT appear in its own "Depends On" chain (A→B→C→A = circular).
- **Layer direction**: domain → application → infrastructure/presentation (never reverse).
  - `domain/` depends on nothing. No imports from application, infrastructure, or presentation.
  - `application/` depends on domain only. Implements use cases using domain interfaces.
  - `infrastructure/` implements domain interfaces. Can depend on domain and external libraries.
  - `presentation/` depends on application. Handles routing, DTOs, controllers.
  - `shared/` or `utils/` are cross-cutting. Any layer may depend on them, but they must NOT depend on any layer. Keep shared modules minimal.
- **Interface boundaries**: Modules communicate through interfaces, not concrete implementations.
- **New module = new row**: Every new module must be registered here before implementation (Iron Law #6).

## Change Impact Quick Reference

When modifying a module:

1. Find the module row above
2. Check the **Depended By** column — these modules may break
3. For each dependent module:
   - Check if the change affects the public interface
   - Update tests and mocks for all affected dependents
4. Record the change in docs/project-state.md

## Interface Change Log

<!-- Record interface changes as they happen. This is MANDATORY for all interface changes (Iron Law #1).
   **Who fills this**: The `impact-analysis` skill adds rows during planning/review. The `reviewer` agent verifies rows exist (Step 7).
   After modifying any public interface (method signature, return type, parameters):
   1. Add a row here immediately
   2. Check "Affected Modules" by reading the Depended By column in Module Registry
   3. Update mocks for all affected modules (run test-integrity skill)
   4. Set Status to "In Progress" until all dependents are updated, then "Updated"

   | Date | Module | Change | Affected Modules | Status |
   |------|--------|--------|------------------|--------|
   Example:
   | 2025-01-15 | auth | Added resetPassword() | api, admin | Updated |
   | 2025-01-20 | services | Changed getUser() return type | api | In Progress |
-->

| Date | Module | Change | Affected Modules | Status |
|------|--------|--------|------------------|--------|
| 2026-05-26 | Space ETF Analysis | Added price and change_pct fields to /space-holdings response | SpaceChart | Updated |
| 2026-05-28 | ETF Disparity Monitoring | Created /analyze/etf/disparity API & enriched portfolio response | MyDashboard, SpaceChart, BioChart, scheduler | Updated |
| 2026-06-01 | Asset History Tracking | Added GET /asset-history API & daily snapshot recording to /portfolio | MyAssetsView | Updated |
| 2026-07-12 | Notification Settings | GET /settings accepts optional chat_id, POST /settings upserts by chat_id | NotificationSettings, BrazilBondTab | Updated |
| 2026-08-22 | Integrated Total Asset Board | Added GET /integrated-assets, manual-assets CRUD, manual-cash CRUD, kis-mappings | MyAssetsView, TotalAssetBoard | Updated |
| 2026-10-02 | Brazil Bond Analysis | Added POST /api/v1/brazil-bond/catalysts/sync & catalyst state persistence/evaluation in /summary | BrazilBondTab | Updated |
| 2026-10-03 | Brazil Bond Analysis | Added GET/POST /api/v1/brazil-bond/election-pulse, added election_scenarios, recommended_bonds, election_strategy to /summary | BrazilBondTab | Updated |
| 2026-10-03 | ETF Dividend Analysis | Added GET /api/v1/dividends/{code}, POST /api/v1/dividends/sync, POST /api/v1/dividends/portfolio-cashflow, GET /api/v1/dividends/rankings | - | Updated |
