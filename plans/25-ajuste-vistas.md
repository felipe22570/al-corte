# Paso 25 — Ajuste de vistas relacionadas y retiro del tablero

- **Hito PRD:** H9 (parte 5 de 6)
- **Estado:** ⬜ Pendiente
- **Inicio:**
- **Fin:**
- **Commit:**
- **Depende de:** 23, 24
- **Decisiones aplicables (decididas, ver README):** D2, D5, D10, D17–D29

## Objetivo

Dejar el resto de la app coherente con la vista por meses y retirar lo que quedó sin uso.

## Tareas

- [ ] `/movimientos`: quitar gráficos y consultas históricas de 12 meses que solo los alimentaban; conservar filtros y paginación de la lista. Etiquetar su filtro "Mes de compra" para no confundir D5 con el mes de pago. El gráfico por categoría del detalle usa R7, no `spendingByCategory`.
- [ ] Desde el detalle de un movimiento y de un extracto, enlazar al mes de pago correspondiente.
- [ ] Después de guardar un gasto, volver a `/` con el aviso de guardado existente.
- [ ] Antes del retiro, comprobar que deuda total registrada, cupo, utilización, avisos de vencidos y accesos a extractos tienen destino en la UI nueva. La deuda usa D2 para todas las tarjetas con saldo y no suma previstos.
- [ ] Retirar `dashboard-totals`, `card-summary`, `monthly-spending-chart` y funciones de `lib/domain/dashboard.ts` solo si no tienen consumidores, incluidos catálogo y fixtures. Mantener o adaptar cualquier muestra que siga aportando cobertura; no borrar regresiones útiles solo para eliminar una importación. Mantener cobertura de dominio del 100 %.
- [ ] Revisar textos que digan "tablero" en la interfaz, metadatos y documentación del repo (`README.md`).
- [ ] Actualizar `lib/actions/{transactions,subscriptions,cards,statements,categories}.ts` donde corresponda: invalidar lista, meses y vistas relacionadas tras todas las escrituras relevantes, no solo marcar pagado. Usar un helper común si evita omisiones y justificar la estrategia según las guías de la versión instalada de Next.js.
- [ ] Cubrir meses antes y después de editar tarjeta, fecha o cuotas de un movimiento; capturar referencias anteriores antes de borrar o modificar. Invalidar también comparaciones dependientes y proyecciones cuando cambie una suscripción, manejo, corte/pago, archivo/reactivación, nombre/color/categoría o fuente TRM.
- [ ] Verificar que nuevas lecturas tras el cron y el cambio de día de Bogotá actualizan la proyección y su origen; no añadir caché persistente sin una estrategia de frescura para estas escrituras externas.

## Matriz mínima de actualización

| Cambio | Información que debe refrescarse |
| --- | --- |
| Crear, editar o borrar movimiento/abono | Inicio, meses originales y nuevos de todos los extractos/cuotas afectados, comparación dependiente, movimiento y tarjetas/extractos relacionados. Un abono modifica cupo/deuda, no la marca `paid_at`. |
| Marcar/desmarcar pago o editar total real | Inicio, mes y tarjeta/extracto; el total calculado no cambia por esas acciones. |
| Crear/editar/pausar/cancelar suscripción | Inicio, meses actuales/futuros afectados y datos de la suscripción; separar cambios de proyección de cobros reales ya guardados. |
| Editar o archivar/reactivar tarjeta | Inicio/franja/deuda y meses afectados por proyecciones o presentación; sin reescribir fechas/importes reales. |
| Editar/archivar categoría | Lista y detalles que muestran su nombre/icono y gráfico, sin cambiar importes ni ocultar historial. |
| Cron, TRM o cambio de día | En la siguiente lectura, reflejar cobros reales deduplicados, estimaciones y fecha de negocio actual; ninguna proyección obsoleta por caché sin invalidación. |

## Pruebas

- [ ] Regresiones de Server Actions para toda la matriz, incluidos meses anteriores y nuevos tras edición/borrado y cambios de suscripción o tarjeta. No depender solo de `router.refresh()` en la página que inicia la acción.
- [ ] Deuda/cupo cambian por movimientos de abono, no por marcar pagado; `real_total` distinto no altera el cálculo mensual.
- [ ] Navegar desde una página ya visitada tras crear/editar/borrar, pausar suscripción y archivar/reactivar no muestra agregados obsoletos.
- [ ] Cron convierte un previsto en real sin duplicarlo; nueva TRM solo cambia previstos USD, no cargos o cuotas reales.

## Verificación

```
pnpm typecheck && pnpm lint && pnpm test && pnpm test:coverage
pnpm build
```

- [ ] `grep -ri "tablero" app components lib` no devuelve textos visibles obsoletos.
- [ ] Ningún componente ni función sin uso.
- [ ] Flujo principal del PRD (sección 8) completo desde Meses.
- [ ] Matriz verificada con fixtures/local, sin escribir datos de QA en producción. Enlaces de detalle de movimiento/extracto usan fechas guardadas; no crean accesos a meses futuros fuera del horizonte (para ellos se mantiene el acceso al extracto real).

## Criterios de terminado

- Commit: `refactor: retire dashboard and align views with month navigation`.

## Notas de progreso

<!-- Fecha — nota -->
