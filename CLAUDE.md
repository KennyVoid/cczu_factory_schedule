# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

APS (Advanced Planning & Scheduling) intelligent scheduling demo system using a **Simplified ALNS** (Adaptive Large Neighborhood Search) algorithm to optimize production order sequencing, reduce switching frequency, and improve batch compliance rates.

## Dev Commands

**Start the backend (from project root):**
```bash
cd backend && python main.py
```
Server runs at `http://localhost:8000`. Hot reload enabled.

**Install dependencies:**
```bash
pip install -r backend/requirements.txt
```

**Database location:** `sql/demo.db` (SQLite, WAL mode)

---

## Architecture

### Backend Structure (backend/)

| File | Purpose |
|------|---------|
| `main.py` | FastAPI entry point. All REST API routes defined here. |
| `optimizer.py` | SimplifiedALNS class — the scheduling optimization algorithm. |
| `database.py` | SQLite wrapper with `query()` (SELECT) and `execute()` (INSERT/UPDATE/DELETE). Retry logic for DB locking. |
| `config.py` | App config, paths (DB, static files). |

**Key API endpoints:**
- `POST /api/schedule/optimize` — Run ALNS optimization, saves result and details
- `GET /api/schedule/result/{id}` — Get schedule result with details
- `GET /api/schedule/gantt-data/{id}` — Gantt chart data (computed from schedule details)
- `GET /api/orders` — Paginated order list (filter by `?status=0` for pending)
- `POST /api/orders/import` — CSV/Excel import with product name matching
- `PUT /api/constraints` — Batch update constraint configs

### Frontend Structure (frontend/)

Single-page app loaded from `index.html`. `js/api.js` provides the API client module (BASE = '' for same-origin when served by FastAPI, or configure for dev). `js/app.js` contains all page rendering and state management.

---

## ALNS Algorithm Design (optimizer.py)

**Purpose:** Minimize total switches and maximize batch/gap compliance across 4 attributes: `attr_a`, `attr_b`, `composite_craft`, `special_component`.

**Scoring function (lower = better):**
```
score = total_switch * 0.4 + (1 - avg_batch_rate) * 30 + (1 - avg_gap_rate) * 20
```

**4 neighborhood operators** (randomly selected each iteration):
1. **2-opt reversal** — Reverse a random segment
2. **Relocation** — Move one order to a different position
3. **Exchange** — Swap two orders
4. **Recluster** — Sort by (attr_a, attr_b, priority)

**Process:**
1. Load pending orders (status=0) with product attributes
2. Load active constraint configs → build `batch_limit` and `gap_limit` maps
3. Initial sort: (attr_a, attr_b, priority)
4. 50 iterations with simulated annealing acceptance (10% chance to accept worse after iteration 20)
5. Baseline comparison against ID-sorted order

**Constraint field mapping** (CONSTRAINT_FIELD_MAP): Chinese names → DB fields: `属性A→attr_a`, `属性B→attr_b`, `复合工艺→composite_craft`, `特殊组件→special_component`

---

## Database Schema (sql/demo.sql)

**Core tables:** `product`, `"order"`, `schedule_result`, `schedule_detail`, `constraint_config`

**Notable design decisions:**
- `schedule_result` stores order IDs as JSON array and summary metrics (switch counts, batch/gap rates, score)
- `schedule_detail` stores per-order sequence info including batch_id (computed by `_assign_batch`)
- `constraint_config` has `is_active` flag — only active constraints are loaded by ALNS
- Product attributes: `attr_a`, `attr_b`, `composite_craft`, `special_component`, `model_type`, `craft_type`, `appearance_spec`
- Order status: 0=pending, 1=scheduled (updated after optimization)

---

## Important Patterns

**DB retry on lock:** `database.py` retries up to 3x with 0.1s delay on `sqlite3.OperationalError: locked`.

**Batch ID assignment:** `_compute_batch_ids()` — consecutive orders with same (attr_a, attr_b) get same batch_id.

**Date normalization in import:** `_normalize_date()` handles Excel serial numbers, YYYY/MM/DD, and standard YYYY-MM-DD.

**Frontend routing:** No framework — `App.navigate()` switches on `state.currentPage` and calls renderXXX() functions. All pages lazy-rendered.