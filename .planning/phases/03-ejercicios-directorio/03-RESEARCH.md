# Phase 3: Ejercicios (Directorio + Detalle) — Research

## Standard Stack
- **Local data**: IndexedDB via existing Dexie setup (cache exercise tips + mapping + timestamps).
- **Remote tips**: Wrkout API (REST). Base URL `https://api.wrkout.xyz`, auth via `X-API-Key` header.
- **Mapping source**: Wrkout `GET /exercise/query` (supports name/alias/primaryMuscle/secondaryMuscle/category/equipment + pagination) and `GET /exercise/{exerciseId}` for instructions. `GET /exercise/exerciseIds` is recommended in Quickstart to list available exercises.

## Architecture Patterns
- **Directory UI**
  - Tabs: A‑Z / Músculo / Equipo.
  - A‑Z: group by first letter of display name; render section headers.
  - Músculo/Equipo: chips list above + filtered list below.
- **Detail UI**
  - Screen per exercise: header (name + muscle + equipment), 1RM card, tips card, session history list.
  - History: group by workout session date; each entry shows sets list (metric‑aware) + optional notes.
- **Tips fetching**
  - Local cache table: `{ exerciseId, wrkoutId, tips[], lastFetchedAt }`.
  - On detail open: if cache age > 180 days or missing → fetch; else use cache.
  - Mapping: normalize names (lowercase, remove accents/punct), attempt match against Wrkout `name`, `displayName`, and `aliases` (best fuzzy match). If multiple matches, use first by score.
  - If no match: show “Sin tips disponibles”.

## Don’t Hand‑Roll
- **Exercise data normalization**: use existing `normalizeName` helper; do not create a second normalization system.
- **Client‑side secrets**: do NOT ship API key in client for production. For now, keep optional local config flag and document that a server proxy is needed for production.

## Common Pitfalls
- **API key exposure**: Wrkout requires `X-API-Key`; shipping it in client is unsafe for production.
- **Pagination**: `GET /exercise/query` and `GET /exercise/exerciseIds` have limit 1–25 and `after/before` cursor params; need pagination for bulk matching.
- **Name matching**: exact match is unreliable; aliases + normalization needed.
- **Language**: `lang` and `searchlang` exist; free/entry tiers only expose `en-GB`. Docs note translations are not yet available (ETA Feb 28, 2025), so assume English-only for now.
- **Rate limits**: API limit 100 requests/minute; free tier 100 requests/month — cache aggressively and avoid fetching tips for every list item.

## Code Examples

### Query exercises by name/alias (paged)
```
GET https://api.wrkout.xyz/exercise/query?name=<name>&alias=<alias>&limit=25&after=<cursor>&lang=en-GB&searchlang=en-GB
X-API-Key: <api-key>
```

### Fetch exercise details
```
GET https://api.wrkout.xyz/exercise/{exerciseId}?lang=en-GB
X-API-Key: <api-key>
```

### Cache schema (Dexie)
```
wrkoutTips: 'exerciseId, wrkoutId, lastFetchedAt'
```

### Matching heuristic (pseudocode)
```
score(name) = exact? 0 : distance(normalize(local), normalize(remote))
consider: displayName, name, aliases
pick lowest score
```

### Notes from docs
- `exerciseId` path param accepts an **ID or Name**.
- `exercise/exerciseIds` returns id, name, displayName, aliases, and premiumAsset arrays.

## Sources
- Wrkout Quickstart / Base URL / Auth: https://docs.wrkout.xyz/quickstart
- Wrkout exercise query endpoint: https://docs.wrkout.xyz/api-reference/exercise/get-query
- Wrkout exerciseIds endpoint: https://docs.wrkout.xyz/api-reference/exercise/get-exerciseIds
- Wrkout exercise details endpoint: https://docs.wrkout.xyz/api-reference/exercise/get-exercise
- Wrkout rate limits: https://docs.wrkout.xyz/ratelimits
- Wrkout supported languages: https://docs.wrkout.xyz/translations
- Wrkout pricing and tier limits: https://wrkout.xyz/
