---
wave: 1
depends_on:
  - .planning/ROADMAP.md
  - .planning/STATE.md
  - .planning/phases/08-backend-foundation/08-CONTEXT.md
  - .planning/phases/08-backend-foundation/08-RESEARCH.md
files_modified:
  - package.json
  - vite.config.ts
  - src/data/wrkout.ts
  - src/pages/ExerciseDetail.tsx
  - backend/src/server.ts
  - backend/README.md
  - .env.example
autonomous: true
---

<tasks>
  <task id="backend-scaffold" title="Create backend API scaffold" owner="agent">
    <description>
      Add a minimal Fastify backend with health endpoint and wrkout proxy endpoints.
      Keep API key in server env vars.
    </description>
    <acceptance_criteria>
      <item>`/health` responds with service status.</item>
      <item>`/api/wrkout/query` proxies search requests.</item>
      <item>`/api/wrkout/exercise/:exerciseId` proxies detail requests.</item>
      <item>Missing server key returns 503 with explicit error.</item>
    </acceptance_criteria>
  </task>

  <task id="frontend-contract" title="Switch frontend wrkout calls to backend contract" owner="agent">
    <description>
      Update wrkout data layer to use backend endpoints by default, preserving controlled fallback and robust status mapping.
    </description>
    <acceptance_criteria>
      <item>Frontend calls `/api/wrkout/*` by default.</item>
      <item>UI distinguishes auth/config/network states.</item>
      <item>Existing tip cache behavior remains unchanged.</item>
    </acceptance_criteria>
  </task>

  <task id="dev-workflow" title="Enable local app+api development workflow" owner="agent">
    <description>
      Add scripts, env examples, and Vite proxy so both services run with a single command.
    </description>
    <acceptance_criteria>
      <item>`npm run dev:all` runs frontend and backend together.</item>
      <item>`.env.example` documents required variables.</item>
      <item>Vite proxy forwards `/api` to local backend.</item>
    </acceptance_criteria>
  </task>
</tasks>

<verification>
  <criteria>
    <item>`npm run build` succeeds.</item>
    <item>Backend starts locally and `/health` responds.</item>
    <item>wrkout proxy returns `503 missing_wrkout_api_key` when key absent.</item>
  </criteria>
</verification>

<must_haves>
  <item>Backend BFF in repo.</item>
  <item>Frontend no longer depends only on browser-direct wrkout calls.</item>
  <item>Documented path for cloud-ready evolution.</item>
</must_haves>
