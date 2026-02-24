# Backend (BFF) - Gym App

Backend minimo para evitar CORS con wrkout y preparar la base cloud.

## Endpoints

- `GET /health`
- `GET /api/wrkout/query?name=<exercise>`
- `GET /api/wrkout/exercise/:exerciseId?lang=en-GB`

## Variables de entorno

- `WRKOUT_API_KEY` (obligatoria para proxy wrkout)
- `API_PORT` (default `8787`)
- `API_HOST` (default `0.0.0.0`)

## Desarrollo local

1. Copia `.env.example` a `.env` y agrega `WRKOUT_API_KEY`.
2. Levanta app + api:

```bash
npm run dev:all
```

Frontend (`vite`) usa proxy de `/api` a `http://localhost:8787`.
