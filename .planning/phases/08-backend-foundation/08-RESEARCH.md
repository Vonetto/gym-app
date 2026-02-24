# Phase 8 Research: Backend Foundation

## Standard Stack

- **BFF/API Node (Fastify)** para encapsular integraciones externas y secretos.
- **Supabase (plan gratuito) como target cloud** para evolución a auth/sync:
  - 2 proyectos
  - 500 MB DB
  - 50,000 MAU
  - 5 GB egress
  - Referencia: https://supabase.com/docs/guides/platform/billing-on-supabase

## Architecture Patterns

1. **Backend-for-Frontend (BFF)**
   - El frontend consume `/api/*`.
   - Integraciones de terceros se llaman desde backend.
   - Secretos solo en servidor.

2. **Config por entorno**
   - Dev: proxy Vite (`/api` -> backend local).
   - Prod: `VITE_API_BASE_URL` o mismo dominio con reverse proxy.

3. **Error mapping consistente**
   - `401/403` -> auth inválida proveedor.
   - `503` -> backend no configurado (falta key).
   - `5xx` -> proveedor/backend no disponible.

## Don't Hand-Roll

- No exponer API keys de terceros en frontend.
- No depender de CORS del proveedor externo como estrategia de producción.
- No acoplar la UI a payloads crudos de proveedores.

## Common Pitfalls

- Cambiar a backend sin mantener fallback/errores claros en UI.
- No documentar variables de entorno y scripts de arranque.
- Mezclar fase backend con migración cloud completa en un solo paso.

## Production Notes

- Para push iOS en PWA se requiere arquitectura web push completa (SW + Push API + backend), y Home Screen App en iOS 16.4+:
  - https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/
- Esta fase solo prepara base backend; push E2E queda para fase siguiente.

## Confidence

- **High**: Supabase free limits y capacidades base (docs oficiales).
- **High**: Requisitos de web push en iOS PWA (WebKit oficial).
- **High**: Patrón BFF para ocultar secretos y evitar CORS de terceros.
