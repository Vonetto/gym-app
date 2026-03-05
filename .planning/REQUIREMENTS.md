# Requirements: Gym Tracker PWA (Hevy-inspired)

**Defined:** 2026-01-26
**Core Value:** Registrar entrenamientos de forma rápida y precisa, con sugerencias de progresión claras para mejorar el rendimiento.

## v1 Requirements

### PWA & Offline

- [x] **PWA-01**: App funciona offline-first y guarda datos localmente de forma persistente.
- [x] **PWA-02**: App puede instalarse como PWA (home screen) con manifest e ícono.
- [x] **PWA-03**: App muestra estado offline/online de manera no invasiva.

### Rutinas & Entrenos

- [x] **RTN-01**: Usuario puede crear, editar, duplicar y eliminar rutinas ilimitadas.
- [x] **RTN-02**: Usuario puede reordenar rutinas con drag/press.
- [x] **RTN-03**: Usuario puede iniciar un entrenamiento vacío.
- [x] **RTN-04**: Usuario puede iniciar una rutina y convertirla en sesión activa.
- [x] **RTN-05**: Usuario puede decidir si aplica cambios del entreno en vivo a la rutina base o los mantiene solo en la sesión.

### Ejercicios & Catálogo

- [x] **EXE-01**: Usuario puede buscar ejercicios por nombre en el catálogo.
- [x] **EXE-02**: Usuario puede crear ejercicios personalizados con nombre, músculos, equipamiento y tipo de métrica.
- [x] **EXE-03**: Usuario puede editar ejercicios personalizados.
- [x] **EXE-04**: Sistema previene duplicados evidentes en ejercicios personalizados (normalización básica).

### Directorio de Ejercicios

- [x] **EXD-01**: Directorio con tabs A‑Z / Músculo / Equipo.
- [x] **EXD-02**: Detalle de ejercicio con historial y 1RM/mejor marca.
- [x] **EXD-03**: Tips externos con fallback local.

### Logging de Sets

- [x] **LOG-01**: Usuario puede registrar sets con métricas mixtas (peso+reps, reps, tiempo, distancia).
- [x] **LOG-02**: UI permite editar métricas inline durante la sesión según el tipo de ejercicio.
- [x] **LOG-03**: Usuario puede marcar set como completado con check.
- [x] **LOG-04**: UI muestra columna “Anterior” para referencia del último entrenamiento.
- [x] **LOG-05**: Usuario puede agregar notas por ejercicio.
- [x] **LOG-06**: Usuario puede agregar/eliminar ejercicios durante una sesión activa.

### UX Parity (Hevy-like)

- [x] **UX-01**: Pantalla de rutinas incluye CTA “Empezar Entrenamiento Vacío”.
- [x] **UX-02**: Pantalla de sesión muestra métricas (duración, volumen, series, músculos) y botón “Terminar”.
- [x] **UX-03**: Tabla de sets con columnas compactas de SERIE / ANTERIOR / métricas / SUG. / ✓ según el tipo de ejercicio.
- [x] **UX-04**: CTA “+ Agregar Serie” visible por ejercicio.
- [x] **UX-05**: CTA principal “+ Agregar Ejercicio” en sesión.
- [x] **UX-06**: Acciones de sesión incluyen descarte seguro y controles principales vía CTA/header/menú contextual.

### Timers

- [x] **TMR-01**: Usuario puede definir descanso por ejercicio (en sesión).
- [x] **TMR-02**: Timer persiste en background (cuando PWA está minimizada).

### PRs & Analytics

- [x] **ANA-01**: Usuario puede ver historial de entrenamientos por fecha.
- [x] **ANA-02**: Usuario puede ver gráficos de volumen (por semana/mes).
- [x] **ANA-03**: Usuario puede ver PRs por ejercicio (peso, reps, tiempo o distancia según métrica).

### Progresión

- [x] **PRG-01**: App sugiere progresión de carga/reps/tiempo según historial y tipo de ejercicio.
- [x] **PRG-02**: Usuario puede aceptar/rechazar sugerencia por set.

### Import/Export

- [x] **IO-01**: Usuario puede exportar todos sus datos a JSON (rutinas, ejercicios, historial, PRs, settings).
- [x] **IO-02**: Usuario puede importar JSON y restaurar datos completos.
- [x] **IO-03**: Esquema de import/export es versionado y validado.

### Ajustes

- [x] **SET-01**: App tiene configuración básica (idioma español, unidades kg/m, tema oscuro).
- [x] **SET-02**: Usuario puede resetear datos locales desde configuración.

### Sets avanzados (baja prioridad en V1)

- [x] **ADV-01**: Usuario puede marcar sets como warm‑up / drop set / fallo / AMRAP.
- [x] **ADV-02**: UI mantiene consistencia de sets avanzados en historial y PRs.

### Calendario & Planificación

- [x] **CAL-01**: Usuario puede programar una rutina para una fecha futura desde el calendario.
- [x] **CAL-02**: Usuario puede definir recurrencia simple para una rutina planificada.
- [x] **CAL-03**: Calendario distingue claramente entrenamientos realizados y planificados, y permite abrir el detalle de ambos.

### Notificaciones & Recordatorios

- [x] **NTF-01**: Usuario puede activar/desactivar notificaciones globalmente y por tipo desde Ajustes.
- [x] **NTF-02**: App puede recordar rutinas planificadas usando una hora global configurable y un offset opcional.
- [x] **NTF-03**: App avisa cuando termina un descanso con foreground UX fuerte y notificación del sistema cuando sea viable.
- [x] **NTF-04**: App avisa cuando existe una sesión activa en background tras un umbral configurable.
- [x] **NTF-05**: Ajustes muestra estado de permiso/soporte y explica cómo habilitar notificaciones en PWA/iPhone.

## v2 Requirements

### Cuentas & Sync

- **ACC-01**: Usuario puede crear cuenta con email.
- **ACC-02**: Usuario puede iniciar sesión y sincronizar sus datos en la nube.
- **ACC-03**: App resuelve conflictos entre dispositivos.

### AI Coach

- **AI-01**: Usuario puede hacer preguntas sobre ejercicios.
- **AI-02**: Usuario recibe feedback sobre progresión sugerida.
- **AI-03**: Usuario puede subir video para análisis técnico.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Social / feed / desafíos | V3 definido en roadmap. |
| Macro tracking (calorías, agua, pasos) | V4 definido en roadmap. |
| Wearables integraciones | Alto costo y mantenimiento. |
| Marketplaces de entrenadores | Scope y legalidad. |
| Apps nativas iOS/Android | PWA primero por costos. |
| Multi‑idioma y unidades alternas | Diferido para después de V1. |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| PWA-01 | Phase 1: PWA + Ajustes Base | Complete |
| PWA-02 | Phase 1: PWA + Ajustes Base | Complete |
| PWA-03 | Phase 1: PWA + Ajustes Base | Complete |
| RTN-01 | Phase 2: Rutinas + Catálogo de Ejercicios | Complete |
| RTN-02 | Phase 2: Rutinas + Catálogo de Ejercicios | Complete |
| RTN-03 | Phase 2: Rutinas + Catálogo de Ejercicios | Complete |
| RTN-04 | Phase 2: Rutinas + Catálogo de Ejercicios | Complete |
| RTN-05 | Phase 2: Rutinas + Catálogo de Ejercicios | Complete |
| EXE-01 | Phase 2: Rutinas + Catálogo de Ejercicios | Complete |
| EXE-02 | Phase 2: Rutinas + Catálogo de Ejercicios | Complete |
| EXE-03 | Phase 2: Rutinas + Catálogo de Ejercicios | Complete |
| EXE-04 | Phase 2: Rutinas + Catálogo de Ejercicios | Complete |
| EXD-01 | Phase 3: Ejercicios — Directorio + Detalle | Complete |
| EXD-02 | Phase 3: Ejercicios — Directorio + Detalle | Complete |
| EXD-03 | Phase 3: Ejercicios — Directorio + Detalle | Complete |
| LOG-01 | Phase 2 (consolidated legacy of Phase 4) | Complete |
| LOG-02 | Phase 2 (consolidated legacy of Phase 4) | Complete |
| LOG-03 | Phase 2 (consolidated legacy of Phase 4) | Complete |
| LOG-04 | Phase 2 (consolidated legacy of Phase 4) | Complete |
| LOG-05 | Phase 2 (consolidated legacy of Phase 4) | Complete |
| LOG-06 | Phase 2 (consolidated legacy of Phase 4) | Complete |
| UX-01 | Phase 2 (consolidated legacy of Phase 4) | Complete |
| UX-02 | Phase 2 (consolidated legacy of Phase 4) | Complete |
| UX-03 | Phase 2 + Phase 10 (consolidated legacy of Phase 4) | Complete |
| UX-04 | Phase 2 (consolidated legacy of Phase 4) | Complete |
| UX-05 | Phase 2 (consolidated legacy of Phase 4) | Complete |
| UX-06 | Phase 2 + Phase 13 (consolidated legacy of Phase 4) | Complete |
| TMR-01 | Phase 2 + Phase 13 (consolidated legacy of Phase 5) | Complete |
| TMR-02 | Phase 13 (consolidated legacy of Phase 5) | Complete |
| ANA-01 | Phase 2 + Phase 3 (consolidated legacy of Phase 6) | Complete |
| ANA-02 | Phase 2 + Phase 3 (consolidated legacy of Phase 6) | Complete |
| ANA-03 | Phase 2 + Phase 3 (consolidated legacy of Phase 6) | Complete |
| PRG-01 | Phase 10: Progresion de Carga | Complete |
| PRG-02 | Phase 10: Progresion de Carga | Complete |
| IO-01 | Phase 14: Import/Export Total + Recovery | Complete |
| IO-02 | Phase 14: Import/Export Total + Recovery | Complete |
| IO-03 | Phase 14: Import/Export Total + Recovery | Complete |
| SET-01 | Phase 1: PWA + Ajustes Base | Complete |
| SET-02 | Phase 1: PWA + Ajustes Base | Complete |
| ADV-01 | Phase 11: Sets Avanzados | Complete |
| ADV-02 | Phase 11: Sets Avanzados | Complete |
| CAL-01 | Phase 12: Calendario + Planificación | Complete |
| CAL-02 | Phase 12: Calendario + Planificación | Complete |
| CAL-03 | Phase 12: Calendario + Planificación | Complete |
| NTF-01 | Phase 13: Recordatorios + Notificaciones | Complete |
| NTF-02 | Phase 13: Recordatorios + Notificaciones | Complete |
| NTF-03 | Phase 13: Recordatorios + Notificaciones | Complete |
| NTF-04 | Phase 13: Recordatorios + Notificaciones | Complete |
| NTF-05 | Phase 13: Recordatorios + Notificaciones | Complete |
| ACC-01 | Phase 9: Auth + Sync Base | Complete |
| ACC-02 | Phase 9: Auth + Sync Base | Complete |
| ACC-03 | Phase 9: Auth + Sync Base | Complete |

**Legacy normalization note**
- Phase 4, 5, 6 y 7 se mantienen como referencia histórica en roadmap, pero su alcance se entregó en fases posteriores (2, 3, 10, 13 y 14).

**Coverage:**
- v1 requirements: 44 total
- Mapped to phases: 44
- Unmapped: 0 ✅

---
*Requirements defined: 2026-01-26*
*Last updated: 2026-03-05 after closing Phase 15*
