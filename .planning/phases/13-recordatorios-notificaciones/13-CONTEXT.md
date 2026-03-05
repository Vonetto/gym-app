# Phase 13 Context — Recordatorios + Notificaciones

**Date:** 2026-03-04
**Status:** Discussed

## Objective

Definir cómo la app debe avisar al usuario sobre rutinas planificadas y eventos relevantes de una sesión activa, manteniendo una UX móvil limpia y sin introducir ruido innecesario.

## Decisions

### 1) Tipos de aviso

- Incluir recordatorios de `rutina planificada`.
- Incluir avisos de `descanso terminado`.
- Incluir avisos de `sesión activa en background`.
- No introducir un aviso ambiguo tipo `te toca entrenar hoy` sin configuración; en su lugar, las notificaciones de rutina planificada usarán una hora configurable global.

### 2) Dónde aparecen

- `Rutina planificada`:
  - dentro de la app
  - como notificación del sistema cuando sea posible
- `Descanso terminado`:
  - overlay/modal dentro de la app
  - sonido de silbato
  - notificación del sistema cuando la app esté en background
- `Sesión activa en background`:
  - banner persistente mientras el usuario siga dentro de la app
  - aviso tipo `¿Sigues entrenando?` si sale de la app y pasa suficiente tiempo
- Se quiere habilitar soporte de push más robusto en esta fase, no dejarlo diferido.

### 3) Cuándo dispararlos

- `Rutina planificada`:
  - hora fija configurable global desde `Ajustes`
  - esa hora define cuándo avisar, no cuándo ocurre la rutina
- La anticipación también será configurable:
  - exactamente a la hora
  - o `X minutos antes`
- Para V1, la notificación de rutina no se condiciona por estado `pendiente/completado/omitido`; se deja simple.
- `Sesión activa en background`:
  - solo si hay sesión activa
  - solo si el usuario salió de la app
  - tras un umbral configurable, con `10 min` como default razonable

### 4) Control del usuario

- Existirá un `toggle global` de notificaciones en `Ajustes`.
- Habrá toggles por tipo:
  - `rutina planificada`
  - `descanso terminado`
  - `sesión activa en background`
- No habrá `horarios silenciosos` en esta fase.
- La UI debe mostrar estado claro cuando falte soporte o permiso, por ejemplo:
  - `No permitido`
  - `Permitir`
  - `Instala la app para activar notificaciones`
- `Ajustes` incluirá ayuda corta sobre cómo habilitar notificaciones en PWA/iPhone.

## Constraints

- Mantener compatibilidad con el modo local-first.
- Diseñar la UX de permisos con claridad, especialmente para iPhone/PWA instalada.
- No mezclar esta fase con planificación avanzada adicional; el foco son avisos y recordatorios.

## Open Questions for Research

- Qué capacidades reales tenemos hoy en PWA/iPhone para:
  - foreground notifications
  - background notifications
  - Web Push
- Qué arquitectura conviene para push robusta:
  - service worker
  - permisos
  - backend para suscripciones y entrega
- Qué eventos deben resolverse solo en cliente y cuáles requieren backend o scheduler.
- Cómo modelar y persistir preferencias de notificación sin contaminar las entidades de rutina/agenda.
