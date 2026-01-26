# Gym Workout Tracking PWA Architecture (Research)

## Purpose
This document summarizes typical architecture patterns for a gym workout tracking PWA that is offline-first and local-first, with planned cloud sync, import/export, charts, and timer features. It focuses on component boundaries, data flow, and recommended build order.

## Reference Context
- Offline-first PWA, local-first storage
- Future cloud sync
- JSON import/export
- Hevy-like UX
- Multiple exercise metrics, volume charts, rest timers

## Major Components and Boundaries

### 1) Presentation Layer (UI)
**Responsibilities**
- Screens: workout list, workout session, exercise detail, history, analytics/charts, settings, import/export.
- Components: rest timer, set editor, exercise picker, chart widgets.
- PWA shell: routes, navigation, theming, offline indicators.

**Boundaries**
- Talks to: Application/Domain layer via view models or hooks.
- Does not access persistence or network directly.
- Receives derived state and commands (e.g., “log set,” “start timer”).

### 2) Application / Domain Layer
**Responsibilities**
- Business rules: workout session lifecycle, set logging, metric validation, progressive overload logic.
- Orchestrates use-cases: start workout, add exercise, complete workout, undo, import/export.
- Emits domain events (e.g., “set logged,” “workout completed”).

**Boundaries**
- Talks to: Repository interfaces and sync coordinator.
- Does not depend on concrete storage or API implementations.
- Bridges UI state with domain models.

### 3) Data Layer (Repositories)
**Responsibilities**
- CRUD access to local-first storage.
- Query helpers for analytics (volume, PRs, trends).
- Mapping between domain models and storage schema.

**Boundaries**
- Talks to: local database/IndexedDB; optionally cache.
- Exposes interfaces to the domain layer.

### 4) Local Storage Engine
**Responsibilities**
- IndexedDB (or SQLite/OPFS) schema, migrations, indexing.
- Atomic writes and offline durability.

**Boundaries**
- No direct UI access.
- Called by repositories.

### 5) Sync & Cloud Integration (Future)
**Responsibilities**
- Sync coordinator: conflict resolution, queueing, background sync.
- Cloud API client: auth, upload/download, versioning.
- Data change log / outbox for local-first deltas.

**Boundaries**
- Talks to: repository layer or sync queue.
- Uses domain-layer models or normalized sync payloads.
- Does not render UI.

### 6) Import/Export
**Responsibilities**
- JSON schema validation, versioning.
- One-shot export (full data) and import (merge/replace).

**Boundaries**
- Operates through repository interfaces.
- Reuses domain validation rules.

### 7) Analytics & Reporting
**Responsibilities**
- Aggregates for volume, PRs, frequency, and progression.
- Creates chart-ready time series.

**Boundaries**
- Can be a repository submodule or separate service.
- Provides read-only projections to UI.

### 8) Device Services
**Responsibilities**
- Timers, notifications, vibration, audio cues.
- PWA install prompts and offline status.

**Boundaries**
- Accessed by UI or application layer through adapters.

## Data Flow (Direction Explicit)

### Primary Workout Logging Flow
1. **UI → Application Layer**: User logs set/rep/weight; UI dispatches command.
2. **Application Layer → Repositories**: Validate and map to domain entities; persist via repository.
3. **Repositories → Local Storage**: Write set/workout entities and derived stats.
4. **Repositories → Application Layer → UI**: Emit updated state; UI re-renders.

### Analytics/Charts Flow
1. **UI → Application Layer**: User opens analytics.
2. **Application Layer → Repositories/Analytics**: Request aggregated data.
3. **Repositories/Analytics → Local Storage**: Read optimized queries or projections.
4. **Repositories/Analytics → Application Layer → UI**: Return chart series.

### Import/Export Flow
1. **UI → Application Layer**: User selects import/export.
2. **Application Layer → Import/Export Service**: Validate schema/version.
3. **Import/Export → Repositories → Local Storage**: Write or read full data set.
4. **Application Layer → UI**: Status and error reporting.

### Sync Flow (Future)
1. **Local Storage → Sync Queue**: Track mutations as change log/outbox.
2. **Sync Coordinator → Cloud API**: Push deltas, pull remote changes.
3. **Sync Coordinator → Repositories**: Merge, resolve conflicts, write merged data.
4. **Repositories → Application Layer → UI**: Update UI state and sync indicators.

## Suggested Build Order (Dependencies)

1. **Domain Models & Use-Cases**
   - Define exercises, workouts, sets, metrics, PR logic.
   - Establish validation rules and domain events.

2. **Local Storage & Repository Layer**
   - Choose storage (IndexedDB/SQLite).
   - Implement schema, migrations, and repository interfaces.

3. **Core UI Flows**
   - Workout logging, exercise selection, session management.
   - Use domain and repositories for real data.

4. **Analytics & Charts**
   - Read-only projections and chart rendering.
   - Requires stable data schema.

5. **Import/Export**
   - JSON schema versioning and validation.
   - Depends on repositories and domain validation.

6. **Sync Foundations (Future)**
   - Change log/outbox, conflict resolution policies.
   - Build on repository and domain conventions.

7. **Polish & Device Services**
   - Rest timers, notifications, PWA install prompts.
   - Requires stable UI and domain events.

## Notes on Typical Boundaries
- **UI never talks directly to storage or network.**
- **Repositories abstract persistence.** Domain logic remains independent of storage and sync.
- **Sync and import/export are integration layers** that rely on domain rules and repository APIs.

## Risks & Considerations
- **Offline-first data integrity**: ensure atomic writes and resilient migrations.
- **Conflict resolution strategy**: define per-entity merging before sync.
- **Performance**: precompute analytics views or indexed queries for charts.
- **Schema evolution**: versioned export/import and migration utilities.
