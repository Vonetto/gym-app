# Gym Tracker PWA (Hevy-inspired)

## What This Is

Una PWA para registrar entrenamientos de gimnasio, inspirada en Hevy, con flujo rápido de entrenamiento y paridad funcional en V1. Permite rutinas ilimitadas, ejercicios personalizados y tracking de sets con múltiples métricas, funcionando offline-first y con import/export JSON. Está pensada para usuarios de nivel mixto y diseñada para evolucionar a cloud sync en versiones futuras.

## Core Value

Registrar entrenamientos de forma rápida y precisa, con sugerencias de progresión claras para mejorar el rendimiento.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Usuario puede crear, editar y guardar rutinas ilimitadas.
- [ ] Usuario puede registrar workouts ad-hoc (sin rutina previa).
- [ ] Usuario puede crear ejercicios personalizados con músculos, equipamiento y métricas aplicables.
- [ ] Usuario puede registrar sets con métricas mixtas (peso+reps, solo reps, tiempo, distancia, etc.).
- [ ] App ofrece sugerencias de progresión de carga/volumen según historial y tipo de ejercicio.
- [ ] Usuario puede ver PRs y gráficos de volumen por ejercicio/rutina.
- [ ] Usuario puede usar timers de descanso configurables en el workout.
- [ ] Import/export JSON completo (rutinas, ejercicios, historial, PRs, settings).
- [ ] PWA offline-first con almacenamiento local persistente.
- [ ] UX similar a Hevy para minimizar fricción de uso.

### Out of Scope

- AI coach / asistentes expertos — V2.
- Social / desafíos / feed tipo Strava — V3.
- Tracking de macros, agua, pasos, calorías — V4.
- Login y sincronización cloud en V1 — diferido para futura versión.
- Soporte de unidades e idioma alternativos en V1 — diferido.

## Context

- Usuario con experiencia entrenando y usando apps; Hevy es la referencia base.
- Se prioriza velocidad y claridad sobre estética personalizada; idealmente replicar flujos de Hevy.
- V1 debe igualar Hevy e incorporar mejoras: rutinas ilimitadas, ejercicios personalizados, progresión sugerida, import/export completo.
- Plataforma objetivo: PWA (por costos y alcance). Ideal futuro iOS nativo si aplica.

## Constraints

- **Plataforma**: PWA offline-first — por costos y alcance inicial.
- **Datos**: Local-first sin cuentas en V1 — mantener simple y permitir export/import.
- **Evolución**: Modelo preparado para cloud sync — evitar callejones sin salida.
- **Idioma/Unidades**: Español + kg/m en V1 — enfoque inicial.
- **UX**: Inspirada en Hevy — reducir tiempo de diseño.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| PWA como plataforma V1 | Evitar costos de iOS y lanzar rápido | — Pending |
| Offline-first con storage local | Funciona sin cuentas y sin fricción | — Pending |
| Import/export JSON completo | Facilitar backups y compartir rutinas | — Pending |
| V1 con paridad Hevy + mejoras | Base conocida y mejoras claras | — Pending |
| Sets avanzados incluidos pero baja prioridad | Cubrir power users sin frenar MVP | — Pending |
| Roadmap: V2 AI, V3 social, V4 macros | Orden de expansión | — Pending |
| Idioma/unidades fijas en V1 | Reducir complejidad inicial | — Pending |

---
*Last updated: 2026-01-26 after initialization*
