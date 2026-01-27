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

**Requirements**
- RTN-01, RTN-02, RTN-03, RTN-04, RTN-05
- EXE-01, EXE-02, EXE-03, EXE-04

**Success Criteria (observable)**
1. El usuario crea, edita, duplica y elimina rutinas ilimitadas sin errores.
2. El usuario reordena rutinas con drag/press y el orden se mantiene al volver.
3. El usuario inicia un entrenamiento vacío desde la pantalla de rutinas.
4. El usuario busca ejercicios por nombre y agrega uno personalizado sin duplicados evidentes.

---

## Phase 3: Logging de Sesión + UX Hevy-like
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

## Phase 4: Timers + Progresión
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

## Phase 5: Historial + PRs + Analíticas
**Goal:** Insight de progreso con historial y gráficos claros.

**Requirements**
- ANA-01, ANA-02, ANA-03

**Success Criteria (observable)**
1. El usuario navega el historial de entrenamientos por fecha.
2. El usuario visualiza gráficos de volumen semanal/mensual por ejercicio o rutina.
3. El usuario consulta PRs por ejercicio según la métrica aplicable.

---

## Phase 6: Import/Export + Sets Avanzados
**Goal:** Portabilidad total y soporte de sets avanzados sin romper historial.

**Requirements**
- IO-01, IO-02, IO-03
- ADV-01, ADV-02

**Success Criteria (observable)**
1. El usuario exporta un JSON completo con rutinas, ejercicios, historial, PRs y settings.
2. El usuario importa un JSON versionado y ve todos sus datos restaurados.
3. La importación rechaza esquemas inválidos y explica el error.
4. El usuario marca sets como warm-up/drop/fallo/AMRAP y ve consistencia en historial/PRs.

---

## Coverage Check
- Total v1 requirements: 36
- Mapped to phases: 36
- Unmapped: 0 ✅
