# Phase 1: PWA + Ajustes Base - Context

**Gathered:** 2026-01-26
**Status:** Ready for planning

<domain>
## Phase Boundary

App instalada y usable offline con configuración básica lista. Incluye PWA offline-first, indicador de conexión, tema oscuro configurable y reset total de datos.

</domain>

<decisions>
## Implementation Decisions

### Instalación PWA + primer arranque
- No mostrar CTA/banner de instalación; el usuario instala manualmente desde el navegador.
- Primer arranque va directo a Home.
- Estado vacío: mensaje “no hay información” + CTA “crear primera rutina”.
- No ofrecer importación en primer arranque (se inicia limpio).

### Indicador offline/online
- Header global, discreto.
- Solo aparece cuando está offline.
- Persistente mientras dure la desconexión.
- Texto: “Sin conexión a internet”.

### Tema oscuro (Ajustes)
- Tema oscuro por defecto.
- Toggle oscuro/claro en Ajustes > Apariencia.
- Preferencia persiste entre sesiones.

### Reset de datos (total)
- Reset total borra todo: rutinas, ejercicios personalizados, historial, PRs y settings (incluye tema).
- Confirmación con doble paso.
- Mostrar advertencia para exportar antes de borrar.
- Tras reset, volver a Home.

### Claude's Discretion
- Diseño exacto del banner/estilo del indicador offline (siempre discreto).
- Copy exacto del estado vacío (manteniendo el CTA a crear rutina).

</decisions>

<specifics>
## Specific Ideas

- UX inspirada en Hevy; paridad documentada en `.planning/UX_PARITY.md`.

</specifics>

<deferred>
## Deferred Ideas

- Borrado granular de ejercicios dentro de una rutina y eliminación de rutinas completas (Phase 2: Rutinas + Catálogo).

</deferred>

---

*Phase: 01-pwa-ajustes-base*
*Context gathered: 2026-01-26*
