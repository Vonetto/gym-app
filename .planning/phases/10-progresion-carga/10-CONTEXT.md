# Phase 10: Progresion de Carga - Context

**Gathered:** 2026-03-03
**Status:** Ready for research

<domain>
## Phase Boundary

Sugerencias de sobrecarga progresiva para la tabla de sets actual, con foco principal en ejercicios `weight_reps` y soporte inicial mas simple para `reps`, `time` y `distance`.
La UI debe integrarse sin romper el layout movil actual y sin usar popups por set.

</domain>

<decisions>
## Implementation Decisions

- `weight_reps` es el foco principal de la fase.
- `reps`, `time` y `distance` tendran soporte inicial mas conservador y menos sofisticado.
- RPE no sera variable central ni requisito para calcular sugerencias.
- La sugerencia debe aparecer integrada en la tabla actual, idealmente como columna o indicador compacto tipo `SUG.`.
- La logica debe usar solo historial de sets completados, no sets planeados o no marcados.
- El diseno debe ser mobile-first y evitar scroll horizontal.

### Claude's Discretion
- Decidir si `SUG.` vive como columna completa, badge por fila o CTA resumido por ejercicio, siempre que no rompa la legibilidad movil.
- Decidir si e1RM se usa internamente como senal secundaria o solo como metrica analitica.

</decisions>

<specifics>
## Specific Ideas

- Investigar literatura y metodos aceptados de progresion antes de definir la heuristica de producto.
- Verificar si hay respaldo real para usar composicion corporal; si no, dejarla fuera de V1.
- Diferenciar incrementos por tipo de ejercicio/equipamiento, en vez de aplicar una misma subida universal.

</specifics>

<deferred>
## Deferred Ideas

- Modelos AI/LLM para progresion personalizada.
- Integraciones con velocidad de barra o wearables.
- Ajuste fino por agresividad individual o reglas avanzadas por ejercicio.

</deferred>

---

*Phase: 10-progresion-carga*
*Context gathered: 2026-03-03*
