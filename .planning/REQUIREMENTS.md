# Requirements: Gym Tracker PWA (Hevy-inspired)

**Defined:** 2026-01-26
**Core Value:** Registrar entrenamientos de forma rápida y precisa, con sugerencias de progresión claras para mejorar el rendimiento.

## v1 Requirements

### PWA & Offline

- [ ] **PWA-01**: App funciona offline-first y guarda datos localmente de forma persistente.
- [ ] **PWA-02**: App puede instalarse como PWA (home screen) con manifest e ícono.
- [ ] **PWA-03**: App muestra estado offline/online de manera no invasiva.

### Rutinas & Entrenos

- [ ] **RTN-01**: Usuario puede crear, editar, duplicar y eliminar rutinas ilimitadas.
- [ ] **RTN-02**: Usuario puede reordenar rutinas con drag/press.
- [ ] **RTN-03**: Usuario puede iniciar un entrenamiento vacío.
- [ ] **RTN-04**: Usuario puede iniciar una rutina y convertirla en sesión activa.
- [ ] **RTN-05**: Usuario puede guardar un entrenamiento como nueva rutina.

### Ejercicios & Catálogo

- [ ] **EXE-01**: Usuario puede buscar ejercicios por nombre en el catálogo.
- [ ] **EXE-02**: Usuario puede crear ejercicios personalizados con nombre, músculos, equipamiento y tipo de métrica.
- [ ] **EXE-03**: Usuario puede editar ejercicios personalizados.
- [ ] **EXE-04**: Sistema previene duplicados evidentes en ejercicios personalizados (normalización básica).

### Directorio de Ejercicios

- [x] **EXD-01**: Directorio con tabs A‑Z / Músculo / Equipo.
- [x] **EXD-02**: Detalle de ejercicio con historial y 1RM/mejor marca.
- [x] **EXD-03**: Tips externos con fallback local.

### Logging de Sets

- [ ] **LOG-01**: Usuario puede registrar sets con métricas mixtas (peso+reps, reps, tiempo, distancia).
- [ ] **LOG-02**: UI permite editar métricas inline durante la sesión según el tipo de ejercicio.
- [ ] **LOG-03**: Usuario puede marcar set como completado con check.
- [ ] **LOG-04**: UI muestra columna “Anterior” para referencia del último entrenamiento.
- [ ] **LOG-05**: Usuario puede agregar notas por ejercicio.
- [ ] **LOG-06**: Usuario puede agregar/eliminar ejercicios durante una sesión activa.

### UX Parity (Hevy-like)

- [ ] **UX-01**: Pantalla de rutinas incluye CTA “Empezar Entrenamiento Vacío”.
- [ ] **UX-02**: Pantalla de sesión muestra métricas (duración, volumen, series, músculos) y botón “Terminar”.
- [ ] **UX-03**: Tabla de sets con columnas compactas de SERIE / ANTERIOR / métricas / SUG. / ✓ según el tipo de ejercicio.
- [ ] **UX-04**: CTA “+ Agregar Serie” visible arriba y abajo por ejercicio.
- [ ] **UX-05**: CTA principal “+ Agregar Ejercicio” en sesión.
- [ ] **UX-06**: Acciones de sesión: “Configuración” y “Descartar Entreno”.

### Timers

- [ ] **TMR-01**: Usuario puede definir descanso por ejercicio (en sesión).
- [ ] **TMR-02**: Timer persiste en background (cuando PWA está minimizada).

### PRs & Analytics

- [ ] **ANA-01**: Usuario puede ver historial de entrenamientos por fecha.
- [ ] **ANA-02**: Usuario puede ver gráficos de volumen (por semana/mes).
- [ ] **ANA-03**: Usuario puede ver PRs por ejercicio (peso, reps, tiempo o distancia según métrica).

### Progresión

- [x] **PRG-01**: App sugiere progresión de carga/reps/tiempo según historial y tipo de ejercicio.
- [x] **PRG-02**: Usuario puede aceptar/rechazar sugerencia por set.

### Import/Export

- [ ] **IO-01**: Usuario puede exportar todos sus datos a JSON (rutinas, ejercicios, historial, PRs, settings).
- [ ] **IO-02**: Usuario puede importar JSON y restaurar datos completos.
- [ ] **IO-03**: Esquema de import/export es versionado y validado.

### Ajustes

- [ ] **SET-01**: App tiene configuración básica (idioma español, unidades kg/m, tema oscuro).
- [ ] **SET-02**: Usuario puede resetear datos locales desde configuración.

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
| RTN-01 | Phase 2: Rutinas + Catálogo de Ejercicios | Pending |
| RTN-02 | Phase 2: Rutinas + Catálogo de Ejercicios | Pending |
| RTN-03 | Phase 2: Rutinas + Catálogo de Ejercicios | Pending |
| RTN-04 | Phase 2: Rutinas + Catálogo de Ejercicios | Pending |
| RTN-05 | Phase 2: Rutinas + Catálogo de Ejercicios | Pending |
| EXE-01 | Phase 2: Rutinas + Catálogo de Ejercicios | Pending |
| EXE-02 | Phase 2: Rutinas + Catálogo de Ejercicios | Pending |
| EXE-03 | Phase 2: Rutinas + Catálogo de Ejercicios | Pending |
| EXE-04 | Phase 2: Rutinas + Catálogo de Ejercicios | Pending |
| EXD-01 | Phase 3: Ejercicios — Directorio + Detalle | Complete |
| EXD-02 | Phase 3: Ejercicios — Directorio + Detalle | Complete |
| EXD-03 | Phase 3: Ejercicios — Directorio + Detalle | Complete |
| LOG-01 | Phase 3: Logging de Sesión + UX Hevy-like | Pending |
| LOG-02 | Phase 3: Logging de Sesión + UX Hevy-like | Pending |
| LOG-03 | Phase 3: Logging de Sesión + UX Hevy-like | Pending |
| LOG-04 | Phase 3: Logging de Sesión + UX Hevy-like | Pending |
| LOG-05 | Phase 3: Logging de Sesión + UX Hevy-like | Pending |
| LOG-06 | Phase 3: Logging de Sesión + UX Hevy-like | Pending |
| UX-01 | Phase 3: Logging de Sesión + UX Hevy-like | Pending |
| UX-02 | Phase 3: Logging de Sesión + UX Hevy-like | Pending |
| UX-03 | Phase 3: Logging de Sesión + UX Hevy-like | Pending |
| UX-04 | Phase 3: Logging de Sesión + UX Hevy-like | Pending |
| UX-05 | Phase 3: Logging de Sesión + UX Hevy-like | Pending |
| UX-06 | Phase 3: Logging de Sesión + UX Hevy-like | Pending |
| TMR-01 | Phase 4: Timers + Progresión | Pending |
| TMR-02 | Phase 4: Timers + Progresión | Pending |
| ANA-01 | Phase 5: Historial + PRs + Analíticas | Pending |
| ANA-02 | Phase 5: Historial + PRs + Analíticas | Pending |
| ANA-03 | Phase 5: Historial + PRs + Analíticas | Pending |
| PRG-01 | Phase 10: Progresion de Carga | Complete |
| PRG-02 | Phase 10: Progresion de Carga | Complete |
| IO-01 | Phase 14: Import/Export Total + Recovery | Pending |
| IO-02 | Phase 14: Import/Export Total + Recovery | Pending |
| IO-03 | Phase 14: Import/Export Total + Recovery | Pending |
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

**Coverage:**
- v1 requirements: 44 total
- Mapped to phases: 44
- Unmapped: 0 ✅

---
*Requirements defined: 2026-01-26*
*Last updated: 2026-03-05 after closing Phase 13 and opening Phase 14*
