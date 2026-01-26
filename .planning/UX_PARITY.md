# UX Parity — Hevy-Inspired (V1)

> Objetivo: replicar los flujos y patrones clave de Hevy sin copiar branding, assets ni textos. Esta guía define la paridad UX mínima para V1.

## 1) Pantallas principales

### A) Entrenamiento (Rutinas)
**Referencia visual:** lista de rutinas con CTA principal.

**Paridad mínima**
- CTA superior: **“Empezar Entrenamiento Vacío”**.
- Sección **Rutinas** con acciones rápidas: **Nueva Rutina** y **Explorar**.
- Lista de rutinas en tarjetas con:
  - Nombre de la rutina.
  - Subtexto con ejercicios destacados.
  - CTA **“Empezar Rutina”**.
  - Menú contextual (•••) por rutina.
- Hint UX: “Presiona una rutina para reordenar”.

**Mejoras V1**
- Rutinas ilimitadas.
- Export/Import JSON de rutinas.

---

### B) Workout en vivo (sesión)
**Referencia visual:** tabla de sets por ejercicio + flujo rápido.

**Paridad mínima**
- Header con métricas: **Duración, Volumen, Series, grupo muscular**.
- Botón **“Terminar”** en la esquina superior derecha.
- Ejercicio con:
  - Nombre + variante entre paréntesis.
  - Notas: “Agregar notas aquí…”.
  - Descanso visible y editable (ej. “Descanso: 1min 30s”).
  - Menú contextual (•••).
- Tabla por ejercicio con columnas:
  - **SERIE / ANTERIOR / KG / REPS / RPE / ✓**.
- Check por set para marcar completado.
- CTA repetido: **+ Agregar Serie** (arriba y abajo del ejercicio).
- CTA principal: **+ Agregar Ejercicio**.
- Acciones al pie: **Configuración** y **Descartar Entreno**.

**Mejoras V1**
- Progresión sugerida por set (peso/reps/tiempo según historial).
- Sets avanzados incluidos pero baja prioridad (supersets, drop sets, AMRAP, etc.).

---

### C) Perfil / Estadísticas
**Referencia visual:** gráfico de barras con selector.

**Paridad mínima**
- Gráfico de barras (duración/volumen/reps) con rango temporal.
- Selector de métrica (Duración / Volumen / Repeticiones).
- Atajos: **Estadísticas, Ejercicios, Medidas, Calendario**.
- Barra de navegación inferior: **Inicio / Entrenamiento / Perfil**.

**Mejoras V1**
- Gráficos por ejercicio/rutina.
- PRs visibles con filtros.

---

## 2) Micro‑interacciones clave

- **Check de set:** marcar completado sin navegación extra.
- **Duplicar set anterior:** rápido desde la fila/columna “Anterior”.
- **Edición inline:** peso/reps/RPE editables en la tabla.
- **Descanso rápido:** editar/restablecer desde el bloque del ejercicio.
- **Reordenar rutina:** drag o long‑press con feedback visual.
- **Añadir ejercicio rápido:** búsqueda + recientes + favoritos.

## 3) Reglas de diseño

- UI oscura, alto contraste, botones claros.
- Jerarquía visual basada en cards y CTAs.
- Tipografía simple, sin ornamentación.
- Reutilizar layout, no inventar nuevos patrones.

## 4) Fuera de alcance (V1)

- Social, AI coach, macros.
- Branding propio complejo.
- Temas múltiples o personalización visual avanzada.

---
*Última actualización: 2026-01-26*
