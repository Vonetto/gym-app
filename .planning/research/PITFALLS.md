# Pitfalls — Gym Workout Tracking PWA

> Focus: Hevy-inspired PWA, offline-first local storage, future cloud sync, import/export JSON, custom exercises, multiple metrics, PRs, volume charts, rest timers.

## 1) Exercise identity chaos (duplicate names, variants, merges)
**Why it happens:** Users create custom exercises with slight spelling/spacing differences; imports from other apps use different naming conventions.

**Warning signs**
- “Bench Press” vs “Barbell Bench Press” vs “Bench Press (BB)” proliferate in history.
- Users complain that volume/PR charts split across “duplicate” exercises.
- Import creates dozens of new exercises unexpectedly.

**Prevention strategy**
- Treat exercise identity as a stable UUID; store display name separately.
- Support aliasing/merging (map old IDs to new canonical IDs with history migration).
- On import, run a deterministic normalization + fuzzy match with user confirmation.
- Provide a “dedupe” tool that previews impact on history and charts.

**Phase to address**
- **Design/MVP:** Define exercise data model + alias/merge workflow.
- **Import/Export:** Build mapping UI + deterministic ID strategy.

---

## 2) Unit/metric drift (kg vs lb, reps vs time, RPE vs %1RM)
**Why it happens:** Multiple metrics for the same exercise (reps/weight, distance/time, RPE) aren’t modeled explicitly.

**Warning signs**
- Users see mixed units in the same history list.
- Volume charts jump after changing units.
- Users can’t record RPE or time-based sets cleanly.

**Prevention strategy**
- Model each set with typed metrics (weight, reps, time, distance, RPE) and explicit unit per metric.
- Lock a preferred unit per user, but allow per-set overrides with conversion.
- Validate against incompatible combinations (e.g., distance without time for run if required).

**Phase to address**
- **Design:** Data schema with typed metrics and unit conversions.
- **MVP:** UI validation + consistent display formatting.

---

## 3) PR logic that ignores context (rep range, tempo, equipment)
**Why it happens:** PRs are computed only by max weight or volume without context like rep range or equipment.

**Warning signs**
- “PR” badge triggers on a lighter set done for high reps.
- Users dismiss PR features as “noisy” or irrelevant.

**Prevention strategy**
- Define PR types (1RM estimate, weight-for-reps, volume PR, time PR) and show which type was achieved.
- Store context (rep range, equipment, tempo, RPE) and allow filters per PR type.
- Allow users to opt into PR rules and disable noisy ones.

**Phase to address**
- **MVP:** Basic PR types with clear definitions.
- **Iteration:** Add context filters and user controls.

---

## 4) Offline-first without conflict strategy (sync chaos)
**Why it happens:** Local-first data is added now, cloud sync later, but conflict resolution is not designed upfront.

**Warning signs**
- “Last write wins” overwrites real workout edits.
- Users lose edits after re-login or device switch.
- Support requests about missing workouts after sync.

**Prevention strategy**
- Choose a conflict model early (CRDT/OT, event sourcing, or deterministic merge rules).
- Store immutable workout events with timestamps + device IDs.
- Add a “conflict audit” log and user-facing diff resolution for edits.

**Phase to address**
- **Design:** Sync and conflict model before large data schema investments.
- **Pre-Sync Rollout:** Build migration path + audit tooling.

---

## 5) Workout templates that don’t match real flows
**Why it happens:** Templates are rigid and don’t support ad‑hoc swaps, skipped exercises, or “I did extra sets.”

**Warning signs**
- Users create multiple near-identical templates.
- Manual edits happen every workout.
- Low template reuse rate.

**Prevention strategy**
- Treat templates as suggestions; allow in-session modifications without breaking history.
- Support quick swap/search with history-based defaults.
- Track template “drift” to propose updates.

**Phase to address**
- **MVP:** Flexible editing + quick swap UI.
- **Iteration:** Template drift analytics.

---

## 6) Charting that ignores set quality (warmups, drops, partials)
**Why it happens:** Volume charts sum all sets equally without set tags (warmup, drop set, partial).

**Warning signs**
- Volume charts look inflated after adding warmups.
- Users manually avoid logging warmups to keep charts “clean.”

**Prevention strategy**
- Add set tags and let users include/exclude tags in charts.
- Default charts to “working sets only,” but keep all data.
- Provide multiple chart modes: volume, tonnage, estimated 1RM, rep PRs.

**Phase to address**
- **MVP:** Set tagging + chart filters.
- **Iteration:** Additional chart modes.

---

## 7) Rest timers that interrupt flow
**Why it happens:** Timers are too modal, require multiple taps, or don’t persist when app is backgrounded.

**Warning signs**
- Users don’t start timers or rely on external timer apps.
- Timers reset when screen sleeps or PWA is backgrounded.

**Prevention strategy**
- Use persistent, non-blocking timers with OS notifications (when available).
- Auto-start optional timers based on previous set or template defaults.
- Allow per-exercise timer settings and quick adjustments.

**Phase to address**
- **MVP:** Non-blocking timer + persistence.
- **Iteration:** Auto-start and per-exercise defaults.

---

## 8) Import/export that loses fidelity
**Why it happens:** Export schema ignores custom metrics, tags, or exercise variants; import can’t map them back.

**Warning signs**
- User export and re-import produces missing fields or broken charts.
- Import creates duplicate exercises and PRs.

**Prevention strategy**
- Treat export as a lossless canonical format (include all fields + versioned schema).
- Support incremental imports with conflict preview.
- Maintain backward-compatible schema with migrations.

**Phase to address**
- **MVP:** Versioned schema and round-trip tests.
- **Import/Export:** Conflict preview and mapping.

---

## 9) Performance issues with long histories
**Why it happens:** Rendering all sets or computing charts on every render is expensive as users log hundreds of workouts.

**Warning signs**
- App slows down after months of usage.
- Charts take seconds to render.

**Prevention strategy**
- Use pagination/virtualization for history lists.
- Precompute aggregates (weekly volume, PRs) in local storage.
- Cache chart data and update incrementally.

**Phase to address**
- **MVP:** Virtualized lists.
- **Iteration:** Caching and incremental aggregation.

---

## 10) Data model that can’t evolve
**Why it happens:** Initial schema hardcodes a single set type or workout structure, making later features (supersets, circuits, tempo) painful.

**Warning signs**
- Feature requests require schema migrations every time.
- Supersets are hacked in with strings or tags.

**Prevention strategy**
- Model workouts as a list of blocks (exercise, superset, circuit) with nested sets.
- Store metadata extensibly (JSON fields) but keep core fields typed.
- Plan for schema migrations from day one.

**Phase to address**
- **Design:** Flexible workout/sets schema.
- **MVP:** Migration tooling.

---

## 11) Personal records that ignore user goals
**Why it happens:** PR features prioritize strength (1RM) when users care about endurance, hypertrophy, or time goals.

**Warning signs**
- Users don’t engage with PR screen.
- Feedback: “This isn’t my training style.”

**Prevention strategy**
- Let users choose training focus and surface relevant PRs (e.g., max reps at a weight, time PR, distance PR).
- Allow per-exercise PR preferences.

**Phase to address**
- **MVP:** Basic PR types + user training focus.
- **Iteration:** Per-exercise preferences.

---

## 12) Inconsistent UX for quick logging
**Why it happens:** Too many taps for adding sets, editing reps, or repeating last workout.

**Warning signs**
- High drop-off during workout sessions.
- Users request “quick add” or “copy last workout.”

**Prevention strategy**
- Provide “repeat last set” and “copy previous workout” actions.
- Keep an always-visible “add set” button.
- Optimize for one-handed use and minimal keyboard use.

**Phase to address**
- **MVP:** Quick add + copy previous workout.
- **Iteration:** UX refinements from telemetry.
