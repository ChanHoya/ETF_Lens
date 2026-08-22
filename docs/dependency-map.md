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
| Asset History Tracking | Presentation | User portfolio asset snapshots and historical performance trend charting | my_assets, db/models, AssetHistoryChart | MyAssetsView | Antigravity |
| Next Leading Sector Screener | Presentation | K-Market polarization index, M7 CAPEX bar charts, and quant-sifted top candidates of 10 major themes | backend/api/next_leader.py, NextLeaderScreener | SectorAnalysisTab | Antigravity |
| Sector Flow Grid | Presentation | Sparkline line charts with 5/20/60-day moving average (dashed lines) overlays showing 1-year sector returns | backend/api/next_leader.py, SectorFlowGrid | SectorAnalysisTab | Antigravity |
| Energy ETF Analysis | Presentation | Energy sector ETF performance charts, custom legends, and toggled constituent comparison tables | api/router, EnergyChart | SectorAnalysisTab | Antigravity |
| Semiconductor ETF Analysis | Presentation | Semiconductor sector ETF performance charts, custom legends, and toggled constituent comparison tables | api/router, SemiChart | SectorAnalysisTab | Antigravity |
| Brazil Bond Analysis | Presentation | Brazil macro interest rate cycle analysis, historical yield trends, real-time scraping, and portfolio CAGR simulation | api/brazil_bond, core/brazil_fetcher | BrazilBondTab | Antigravity |
| Integrated Total Asset Board | Presentation | Google Sheets (3. 포트폴리오0822) inspired Account Board, KIS real-time balance merge, and multi-broker manual asset/cash CRUD | api/integrated_assets, db/models, TotalAssetBoard | MyAssetsView | Antigravity |
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
