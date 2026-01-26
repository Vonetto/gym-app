# Project Research Summary

**Project:** Gym Tracker PWA (Hevy-inspired)
**Domain:** Gym workout tracking PWA (offline-first, local-first)
**Researched:** 2026-01-26
**Confidence:** MEDIUM

## Executive Summary

This project is a classic offline-first workout tracker: fast logging UX, robust local storage, and analytics/PRs layered on top. The research points to a modern React + Vite + TypeScript stack with IndexedDB (via Dexie) for local persistence, plus Workbox-based PWA tooling for offline reliability. This combination is standard, low-risk, and supports the future evolution to cloud sync without forcing accounts in V1.

Feature expectations are clear: workout logging, routine templates, custom exercises, history, PRs, charts, and rest timers are table stakes. Differentiation comes from progression suggestions, smarter workout flows, and richer analytics. The biggest risks are schema rigidity, inconsistent metrics/units, and weak import/export fidelity—these must be addressed early in data modeling and validation.

## Key Findings

### Recommended Stack

React + Vite + TypeScript for UI speed and ecosystem, Dexie (IndexedDB) for local-first storage with migrations, and Workbox/vite-plugin-pwa for offline caching. Zustand is a light state layer; Zod validates imports and schema migrations. For charts and search, Chart.js and MiniSearch are solid defaults.

**Core technologies:**
- **React 19 + TypeScript**: UI velocity and maintainability.
- **Vite + PWA plugin + Workbox**: reliable offline PWA workflow.
- **Dexie (IndexedDB)**: local-first storage, schema migrations.

### Expected Features

**Must have (table stakes):**
- Workout logging (sets, reps, weight, notes)
- Exercise library + custom exercises
- Routines/templates
- History/calendar
- PR tracking
- Rest timers
- Basic analytics (volume charts)
- Offline-first storage
- JSON export/import

**Should have (competitive):**
- Intelligent progression suggestions
- Advanced PR types (1RM, rep PR, volume)
- Smart rest timers
- Workout flow automation

**Defer (v2+):**
- AI coach features (V2)
- Social features (V3)
- Macro tracking (V4)

### Architecture Approach

Layered architecture is standard: UI → domain/use-cases → repositories → local storage. Analytics and import/export sit beside repositories; sync is a future integration layer. Build order should start with domain models and storage, then core UI flows, then analytics/PRs, then import/export, and finally polish (timers, PWA refinements).

**Major components:**
1. **UI layer** — workout session, routines, exercise picker, analytics, settings.
2. **Domain layer** — workout lifecycle, validation, progression logic.
3. **Repositories + Local DB** — Dexie schemas, queries, migrations.
4. **Analytics & Reporting** — aggregates, charts, PR calculations.

### Critical Pitfalls

1. **Exercise identity chaos** — prevent duplicate/aliasing issues early with stable IDs and merge tools.
2. **Metric/unit drift** — model typed metrics and units explicitly (weight, reps, time, distance, RPE).
3. **PR logic without context** — define PR types and avoid noisy badges.
4. **Import/export fidelity loss** — versioned schema and round‑trip tests from the start.
5. **Schema rigidity** — model flexible workout blocks to support advanced sets later.

## Implications for Roadmap

Suggested phase structure based on dependencies and pitfalls:

### Phase 1: Domain + Storage Foundation
**Rationale:** Everything depends on correct data modeling and offline storage.
**Delivers:** Domain models, Dexie schema, repositories, migrations.
**Addresses:** Exercise identity, metrics/units, schema flexibility.

### Phase 2: Core Logging UX
**Rationale:** Primary value loop is workout logging and routines.
**Delivers:** Workout session UI, routines/templates, exercise picker.
**Implements:** UI ↔ domain ↔ repository flow.

### Phase 3: History + Analytics + PRs
**Rationale:** Retention relies on history and progress insights.
**Delivers:** History views, PRs, charts, aggregates.
**Avoids:** PR noise with clear PR types.

### Phase 4: Import/Export + Data Portability
**Rationale:** Trust and portability; required for sharing routines.
**Delivers:** Versioned JSON schema, round‑trip import/export, conflict preview.

### Phase 5: Progression Suggestions + Advanced Sets + Timers
**Rationale:** Differentiators and power‑user depth; safe after core stability.
**Delivers:** Progression logic, smart timers, advanced set patterns.

### Phase Ordering Rationale
- Data model precedes UI, analytics, and import/export.
- Analytics and PRs require stable schemas and history data.
- Import/export should build on validated schema and repositories.
- Progression logic depends on historical analytics and PR definitions.

### Research Flags
Phases needing deeper research during planning:
- **Phase 5:** Progression algorithms and metric-specific rules.
- **Phase 4:** Import/export schema design and conflict strategies.

Phases with standard patterns (skip research-phase):
- **Phase 1–2:** Domain/storage + core UI flows.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM | Versions should be re‑verified before implementation. |
| Features | HIGH | Feature expectations align with market apps. |
| Architecture | HIGH | Standard local-first layered architecture. |
| Pitfalls | MEDIUM | Should validate with product usage as MVP matures. |

**Overall confidence:** MEDIUM

### Gaps to Address

- Exact progression formula(s) by exercise type need targeted research.
- Hevy’s current metric model should be reviewed for parity.

## Sources

### Primary (HIGH confidence)
- N/A (cloud research based on ecosystem knowledge; verify versions before build)

### Secondary (MEDIUM confidence)
- Hevy-like UX patterns (market standard)

---
*Research completed: 2026-01-26*
*Ready for roadmap: yes*
