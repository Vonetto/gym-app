---
wave: 1
depends_on:
  - .planning/ROADMAP.md
  - .planning/REQUIREMENTS.md
  - .planning/phases/03-ejercicios-directorio/03-RESEARCH.md
files_modified:
  - .planning/phases/03-ejercicios-directorio/03-PLAN.md
autonomous: true
---

<tasks>
  <task id="exercise-directory-ui" title="Exercise Directory tabs + filtering" owner="agent">
    <description>
      Build the directory screen with 3 tabs (A‑Z / Músculo / Equipo). A‑Z renders sections by first letter; Músculo/Equipo show chips above a filtered list. Item shows name + primary muscle + equipment.
    </description>
    <acceptance_criteria>
      <item>User can switch tabs and browse A‑Z, by muscle, or by equipment.</item>
      <item>Chips filter the list and can be cleared.</item>
      <item>List items show name, primary muscle, and equipment.</item>
    </acceptance_criteria>
  </task>
  <task id="exercise-detail-view" title="Exercise Detail view (history + 1RM + tips)" owner="agent">
    <description>
      Implement a detail screen reachable from the directory. Show chronological session history with metric-aware sets, best 1RM (or heaviest set if no 1RM), and a tips section (text + bullets).
    </description>
    <acceptance_criteria>
      <item>Detail opens from directory item tap.</item>
      <item>History shows sessions in chronological order with sets per session.</item>
      <item>1RM card shows best historical value (or heaviest set if no 1RM).</item>
      <item>Tips section exists with fallback state.</item>
    </acceptance_criteria>
  </task>
  <task id="wrkout-integration" title="wrkout.xyz tips integration + cache" owner="agent">
    <description>
      Fetch tips from wrkout.xyz using query matching (name/alias) and cache per exercise in IndexedDB for 180 days. Use first match. If no match or no tips, show “Sin tips disponibles”.
    </description>
    <acceptance_criteria>
      <item>Tips fetch only when API key configured.</item>
      <item>Cache used when fresh; refresh when older than 180 days.</item>
      <item>Fallback state shown when tips unavailable.</item>
    </acceptance_criteria>
  </task>
</tasks>

<verification>
  <criteria>
    <item>Directory supports A‑Z / Músculo / Equipo with tabs and filters.</item>
    <item>Detail shows history + 1RM + tips (or fallback).</item>
    <item>wrkout tips cache respects 180‑day TTL and doesn’t fetch without API key.</item>
  </criteria>
</verification>

<must_haves>
  <item>Tabs A‑Z / Músculo / Equipo with filtering.</item>
  <item>Detail view with chronological history + best 1RM.</item>
  <item>Tips section with wrkout integration + fallback.</item>
</must_haves>
