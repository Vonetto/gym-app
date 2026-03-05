# Roadmap: Gym Tracker PWA (Hevy-inspired)

## Phase 1: PWA + Ajustes Base
**Goal:** App instalada y usable offline con configuración básica lista.
**Status:** Complete (2026-01-27)

**Requirements**
- PWA-01, PWA-02, PWA-03
- SET-01, SET-02

**Success Criteria (observable)**
1. El usuario abre la app sin conexión y sus datos locales siguen disponibles.
2. El usuario instala la PWA desde el navegador y la app abre desde home screen.
3. El usuario ve un indicador discreto de estado offline/online sin bloquear el uso.
4. El usuario cambia el tema oscuro desde Ajustes y la preferencia persiste.
5. El usuario ejecuta “Resetear datos” y la app vuelve al estado inicial.

---

## Phase 2: Rutinas + Catálogo de Ejercicios
**Goal:** Plantillas de entrenamiento y catálogo editable listos para usarse.
**Status:** Complete (2026-02-02)

**Requirements**
- RTN-01, RTN-02, RTN-03, RTN-04, RTN-05
- EXE-01, EXE-02, EXE-03, EXE-04

**Success Criteria (observable)**
1. El usuario crea, edita, duplica y elimina rutinas ilimitadas sin errores.
2. El usuario reordena rutinas con drag/press y el orden se mantiene al volver.
3. El usuario inicia un entrenamiento vacío desde la pantalla de rutinas.
4. El usuario busca ejercicios por nombre y agrega uno personalizado sin duplicados evidentes.

---

## Phase 3: Ejercicios — Directorio + Detalle
**Goal:** Directorio navegable de ejercicios y vista detalle con historial, 1RM y tips.
**Status:** Complete (2026-02-02)

**Requirements**
- EXD-01, EXD-02, EXD-03

**Success Criteria (observable)**
1. El usuario navega ejercicios por A‑Z, por músculo y por equipo.
2. El usuario abre el detalle y ve historial + 1RM.
3. El usuario ve tips (o estado “sin tips”) por ejercicio.

---

## Phase 4: Logging de Sesión + UX Hevy-like
**Goal:** Flujo de sesión rápido con sets editables y controles principales.

**Requirements**
- LOG-01, LOG-02, LOG-03, LOG-04, LOG-05, LOG-06
- UX-01, UX-02, UX-03, UX-04, UX-05, UX-06

**Success Criteria (observable)**
1. El usuario registra sets con métricas mixtas y edita peso/reps/RPE inline.
2. El usuario agrega/elimina ejercicios y series durante una sesión activa.
3. La tabla de sets muestra columnas SERIE/ANTERIOR/KG/REPS/RPE/✓ y permite marcar completado.
4. El usuario ve métricas de sesión y finaliza o descarta el entreno desde los CTAs.
5. El usuario usa los CTAs “+ Agregar Serie” y “+ Agregar Ejercicio” en los lugares esperados.

---

## Phase 5: Timers + Progresión
**Goal:** Descansos configurables y sugerencias de progresión por set.

**Requirements**
- TMR-01, TMR-02
- PRG-01, PRG-02

**Success Criteria (observable)**
1. El usuario configura descanso por ejercicio y el timer se inicia al completar una serie.
2. El timer sigue corriendo cuando la PWA está en background y reanuda al volver.
3. El usuario recibe sugerencias de progresión por set basadas en historial.
4. El usuario acepta o rechaza la sugerencia de progresión en cada set.

---

## Phase 6: Historial + PRs + Analíticas
**Goal:** Insight de progreso con historial y gráficos claros.

**Requirements**
- ANA-01, ANA-02, ANA-03

**Success Criteria (observable)**
1. El usuario navega el historial de entrenamientos por fecha.
2. El usuario visualiza gráficos de volumen semanal/mensual por ejercicio o rutina.
3. El usuario consulta PRs por ejercicio según la métrica aplicable.

---

## Phase 7: Import/Export
**Goal:** Portabilidad total y restauración confiable de datos sin perder compatibilidad.

**Requirements**
- IO-01, IO-02, IO-03

**Success Criteria (observable)**
1. El usuario exporta un JSON completo con rutinas, ejercicios, historial, PRs y settings.
2. El usuario importa un JSON versionado y ve todos sus datos restaurados.
3. La importación rechaza esquemas inválidos y explica el error.

---

## Phase 8: Backend Foundation (Cloud-ready)
**Goal:** Introducir una capa backend para integraciones externas y preparar auth/sync/push sin romper el modo local.
**Status:** Complete (2026-02-27)

**Scope**
- BFF/API para integraciones externas (arranque: wrkout proxy para evitar CORS).
- Contrato frontend/backend configurable por entorno.
- Base de arquitectura para migrar a cloud (Supabase Auth/DB/Functions) en fases siguientes.

**Success Criteria (observable)**
1. El frontend deja de depender de llamadas directas a wrkout desde el navegador.
2. Existe endpoint backend `/api/wrkout/*` que encapsula API key y respuestas.
3. La app funciona en local con `npm run dev:all` y build web sin regresiones.
4. Quedan definidos próximos pasos para auth/sync/push sobre la base backend.

---

## Phase 9: Auth + Sync Base
**Goal:** Agregar autenticación con Supabase y sincronización inicial de datos sin romper el modo local.
**Status:** Complete (2026-03-02)

**Requirements**
- ACC-01, ACC-02, ACC-03

**Success Criteria (observable)**
1. El usuario puede crear cuenta o iniciar sesión con email.
2. El usuario puede subir y bajar sus rutinas, ejercicios personalizados y workouts entre nube y local.
3. La app mantiene uso local-first cuando no hay conexión y sincroniza al volver.
4. La app resuelve conflictos básicos sin pérdida silenciosa de datos.

---

## Phase 10: Progresion de Carga
**Goal:** Separar PRG-01/02 del bucket legacy de timers y entregar sugerencias de sobrecarga utiles, conservadoras y explicables.
**Status:** Complete (2026-03-03)

**Requirements**
- PRG-01, PRG-02

**Success Criteria (observable)**
1. El usuario ve una sugerencia compacta por ejercicio/set dentro de la tabla actual sin romper movil.
2. La sugerencia cambia segun el tipo de metrica (`weight_reps`, `reps`, `time`, `distance`) y solo usa historial de sets completados.
3. El usuario acepta o rechaza la sugerencia y los valores sugeridos se precargan.
4. La logica es conservadora, explicable y no depende obligatoriamente de RPE.

---

## Phase 11: Sets Avanzados
**Goal:** Permitir sets especiales (warm-up, drop, fallo, AMRAP) sin romper historial, PRs ni progresion.
**Status:** Complete (2026-03-03)

**Requirements**
- ADV-01, ADV-02

**Success Criteria (observable)**
1. El usuario marca un set como warm-up, drop set, fallo o AMRAP desde la sesion activa sin friccion alta.
2. El historial y la revision del workout muestran claramente el tipo de set registrado.
3. PRs, volumen y progresion no se contaminan con sets que no deban contar igual que un working set normal.
4. Import/export y sync conservan el tipo de set sin ambiguedad.

---

## Phase 12: Calendario + Planificación
**Goal:** Convertir el calendario en una herramienta de planificación real con rutinas futuras, recurrencia y revisión clara por día.
**Status:** Complete (2026-03-04)

**Requirements**
- CAL-01, CAL-02, CAL-03

**Success Criteria (observable)**
1. El usuario puede planificar una rutina para una fecha futura desde el calendario.
2. El usuario puede crear repeticiones simples (por ejemplo semanal) sin reingresar la rutina cada vez.
3. El calendario distingue visualmente entrenamientos realizados vs. planificados.
4. El usuario puede tocar un día futuro y ver qué rutina está programada para ese día.

---

## Phase 13: Recordatorios + Notificaciones
**Goal:** Añadir recordatorios útiles sobre rutinas planificadas y timers relevantes sin romper el modo local-first ni la UX móvil.
**Status:** Complete (2026-03-05)

**Requirements**
- NTF-01, NTF-02, NTF-03, NTF-04, NTF-05

**Success Criteria (observable)**
1. El usuario puede activar recordatorios para rutinas planificadas.
2. La app muestra avisos claros cuando corresponde entrenar o volver del descanso.
3. Los recordatorios no generan ruido excesivo ni falsos positivos.
4. La base queda lista para notificaciones más robustas en iOS más adelante.

---

## Phase 14: Import/Export Total + Recovery
**Goal:** Consolidar un backup/restauración completo, versionado y confiable para toda la app.
**Status:** Planned (2026-03-05)

**Requirements**
- IO-01, IO-02, IO-03

**Success Criteria (observable)**
1. El usuario puede exportar un backup total con rutinas, ejercicios, historial, planificación y ajustes.
2. El usuario puede importar ese backup con validación de esquema y versión.
3. El usuario puede elegir modo de restauración (`fusionar` o `reemplazar`) con resultado predecible.
4. La importación inválida falla con mensajes claros sin corromper datos existentes.

---

## Coverage Check
- Total v1 requirements: 44
- Mapped to phases: 44
- Unmapped: 0 ✅
