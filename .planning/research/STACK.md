# STACK — Gym workout tracking PWA (2025)

## Scope & assumptions
- **Producto:** PWA de registro de entrenamientos (UX tipo Hevy), offline-first, español, unidades kg/m, sin cuentas en V1, export/import JSON. Future cloud sync in V2+. 
- **Plataforma:** Web (PWA), instalación en iOS/Android, navegación rápida, búsquedas locales, charts.
- **Objetivo:** stack estándar, moderno (2025), con rutas claras a sincronización posterior.

## Summary (TL;DR)
- **Frontend:** React 19 + TypeScript + Vite 7 (PWA) for fast iteration and PWA ergonomics.
- **Offline storage:** IndexedDB via Dexie 4 with schema migrations.
- **PWA:** Vite PWA plugin + Workbox for service worker, caching, offline routes.
- **State & data:** Zustand 5 for UI state + repository pattern on top of Dexie for local-first data.
- **Search & charts:** MiniSearch 7 for local search; Chart.js 4 for progress charts.
- **Future sync (V2+):** add a local-first sync layer (PowerSync + Postgres or ElectricSQL + Postgres) once accounts exist.

## Recommended stack (with versions, rationale, confidence)

### Core app
| Layer | Choice | Version | Why this choice | Confidence |
| --- | --- | --- | --- | --- |
| Framework | **React** | **19.2.4** | Most widely used UI framework with strong ecosystem and PWA-friendly patterns; large pool of devs and libraries. | **High** |
| Build tool | **Vite** | **7.3.1** | Fast dev server & build; excellent PWA ecosystem via plugin; simple config. | **High** |
| Language | **TypeScript** | **5.9.3** | Type safety for complex workout domain (sets, PRs, progressions). | **High** |
| Routing | **react-router-dom** | **7.13.0** | Mature SPA routing with data APIs; predictable navigation for PWA. | **High** |
| State | **Zustand** | **5.0.10** | Minimal boilerplate; perfect for UI state; keep domain data in Dexie repositories. | **High** |
| Validation | **Zod** | **4.3.6** | Parse/validate imported JSON and migrations; keeps data sane. | **High** |
| Dates | **dayjs** | **1.11.19** | Small date lib; easy localization to Spanish and user-friendly formatting. | **Medium** |

### Offline & storage
| Layer | Choice | Version | Why this choice | Confidence |
| --- | --- | --- | --- | --- |
| Local DB | **Dexie (IndexedDB)** | **4.2.1** | Best DX for IndexedDB with schema migrations, queries, and hooks. | **High** |
| IndexedDB helper (alt) | **idb** | **8.0.3** | Lower-level alternative; include only if you want a lighter wrapper. | **Medium** |

### PWA & caching
| Layer | Choice | Version | Why this choice | Confidence |
| --- | --- | --- | --- | --- |
| PWA integration | **vite-plugin-pwa** | **1.2.0** | First-class Vite PWA workflow; auto-manifest and service worker integration. | **High** |
| Service Worker | **workbox-window + workbox-build** | **7.4.0** | Standard Workbox toolchain for runtime caching and offline fallback. | **High** |

### UX, search, charts
| Layer | Choice | Version | Why this choice | Confidence |
| --- | --- | --- | --- | --- |
| Charts | **Chart.js** | **4.5.1** | Popular, solid performance for progress charts; easy to customize. | **High** |
| Local search | **MiniSearch** | **7.2.0** | Tiny, fast in-memory full‑text search for exercises/workouts. | **High** |
| File export | **file-saver** | **2.0.5** | Simple client-side JSON export for backups/migration. | **Medium** |

## Data model guidance (local-first)
- **Entities:** exercises, workouts, sets, PRs, templates, history snapshots.
- **Migrations:** Dexie versioned schema. Keep migrations additive. 
- **Import/export:** Zod-validated JSON payloads; normalize before insert. 
- **Offline search:** Build MiniSearch index from Dexie snapshots; update incrementally on writes.

## Future cloud sync (V2+)
**Goal:** keep V1 purely local. Add accounts/sync only after UX is validated.

**Recommended direction (pick one):**
1. **PowerSync + Postgres**
   - Why: high‑performance sync, conflict handling, and works well with local-first IndexedDB workflows.
   - Use when: you want robust sync and can operate a Postgres backend.
   - Confidence: **Medium** (vendor/product fit depends on team)
2. **ElectricSQL + Postgres**
   - Why: local-first with SQLite-like APIs, eventual sync, open-source option.
   - Use when: you want open-source + SQL‑centric approach.
   - Confidence: **Medium**

## What NOT to use (and why)
- **localStorage/SessionStorage** for core data: size limits and no indexing make it unsuitable for workout history. 
- **Firebase/Firestore** in V1: adds auth + online dependency; conflicts with local-first/no-account constraint. 
- **Service Worker hand-rolled from scratch**: error‑prone; Workbox is industry standard and safer.
- **Redux (full boilerplate)** if not needed: overkill for small UI state; keep data in Dexie.
- **SQLite-in-WASM** for V1: still heavier than IndexedDB for PWA; best saved for sync stacks.

## Rationale highlights (why this stack fits)
- **Fast capture UX:** React + Zustand for responsive interactions; Dexie for offline writes. 
- **Local-first:** IndexedDB + Workbox means full offline operation, with instant resume.
- **Future sync path:** Dexie → sync layer is a common evolution path without rewriting the UI.
- **Spanish UX:** dayjs locale + i18n (can add i18next when you start translations).

## Confidence rubric
- **High:** mature, widely adopted, low risk.
- **Medium:** depends on team preference or future roadmap.

## Version verification
- Versions pulled from npm registry via `npm view` as of 2026‑01‑26. Update before implementation.
