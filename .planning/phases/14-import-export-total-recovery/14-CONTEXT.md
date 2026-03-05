# Phase 14 Context — Import/Export Total + Recovery

**Date:** 2026-03-05
**Status:** Discussed

## Objective

Definir una estrategia de backup/restore total de la app que sea portable, segura y predecible para el usuario, manteniendo separado el flujo de rutina individual del backup global.

## Decisions

### 1) Alcance del backup

- Se separan explícitamente dos conceptos:
  1) import/export de **rutina individual** (flujo actual)
  2) **backup total** de datos de uso (Phase 14)
- El backup total debe incluir datos funcionales de usuario (rutinas, historial, planificación, ajustes, favoritos/recientes y preferencias de notificación).
- El backup total **no** incluye sesión activa en curso.
- El backup total debe ser **portable local-only** (sin acoplamiento a cuenta/cloud).
- Se excluyen siempre las suscripciones push del dispositivo.

### 2) Estrategia de importación y conflictos

- Al importar backup total sobre una app con datos existentes, siempre preguntar:
  - `Fusionar`
  - `Reemplazar`
- En `Fusionar`, reglas:
  - última edición gana por timestamp (LWW)
  - borrado más nuevo gana
- Colisiones de nombre (p. ej. dos rutinas con mismo nombre y distinto id):
  - coexistir
  - renombrar con sufijos ` (2)`, ` (3)`, etc.
- En `Reemplazar`:
  - limpiar todo lo local
  - mantener catálogo base de ejercicios

### 3) Esquema/versionado/validación

- El JSON de backup debe incluir `schemaVersion` obligatorio.
- Migraciones automáticas solo si son seguras y compatibles.
- Si el archivo está corrupto o incompleto:
  - bloquear import completo (sin import parcial)
  - mostrar warning claro (`Archivo corrupto` / `Archivo incompleto`).
- Antes de confirmar importación, mostrar preview con conteos:
  - rutinas, workouts, ejercicios personalizados, etc.
- Antes de importar, crear auto-backup local de seguridad para rollback manual.

### 4) UX del flujo (Ajustes > Datos)

- El backup total vive en `Ajustes > Datos`, separado del flujo de rutina individual.
- Flujo de import en 3 pasos:
  1) seleccionar archivo
  2) previsualización + elegir `Fusionar/Reemplazar`
  3) confirmación final
- Para `Reemplazar`, confirmación fuerte escribiendo `REEMPLAZAR`.
- Al finalizar import/export:
  - toast simple
  - detalle expandible con conteos (importados, fusionados, omitidos, renombrados)

## Constraints

- No romper el flujo existente de import/export por rutina.
- Evitar pérdida silenciosa de datos.
- Mantener copy claro, especialmente en acciones destructivas (`Reemplazar`).
- Preservar compatibilidad móvil en todo el flujo.

## Open Questions for Research

- Modelo recomendado de `schemaVersion` y estrategia de migración incremental de backups.
- Diseño de validación estructural (qué validar primero, cómo mostrar errores accionables).
- Algoritmo robusto para renombrado por colisión (`Nombre`, `Nombre (2)`, etc.) sin ambigüedades.
- Diseño técnico del auto-backup previo a import y su retención (cuántas copias y dónde).
