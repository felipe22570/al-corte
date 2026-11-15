# Paso 25 — Ajuste de vistas relacionadas y retiro del tablero

- **Hito PRD:** H9 (parte 5 de 6)
- **Estado:** ✅ Terminado y verificado
- **Inicio:** 2026-11-15
- **Fin:** 2026-11-15
- **Commit:** Ver historial de git
- **Depende de:** 23, 24
- **Decisiones aplicables (decididas, ver README):** D2, D5, D10, D17–D29

## Objetivo

Dejar el resto de la app coherente con la vista por meses y retirar lo que quedó sin uso.

## Tareas

- [x] `/movimientos`: quitar gráficos y consultas históricas de 12 meses que solo los alimentaban; conservar filtros y paginación de la lista. Etiquetar su filtro "Mes de compra" para no confundir D5 con el mes de pago. El gráfico por categoría del detalle usa R7, no `spendingByCategory`.
- [x] Desde el detalle de un movimiento y de un extracto, enlazar al mes de pago correspondiente.
- [x] Después de guardar un gasto, volver a `/` con el aviso de guardado existente.
- [x] Antes del retiro, comprobar que deuda total registrada, cupo, utilización, avisos de vencidos y accesos a extractos tienen destino en la UI nueva. La deuda usa D2 para todas las tarjetas con saldo y no suma previstos.
- [x] Retirar `dashboard-totals`, `card-summary`, `monthly-spending-chart` y funciones de `lib/domain/dashboard.ts` solo si no tienen consumidores, incluidos catálogo y fixtures. Mantener o adaptar cualquier muestra que siga aportando cobertura; no borrar regresiones útiles solo para eliminar una importación. Mantener cobertura de dominio del 100 %.
- [x] Revisar textos que digan "tablero" en la interfaz, metadatos y documentación del repo (`README.md`).
- [x] Actualizar `lib/actions/{transactions,subscriptions,cards,statements,categories}.ts` donde corresponda: invalidar lista, meses y vistas relacionadas tras todas las escrituras relevantes, no solo marcar pagado. Usar un helper común si evita omisiones y justificar la estrategia según las guías de la versión instalada de Next.js.
- [x] Cubrir meses antes y después de editar tarjeta, fecha o cuotas de un movimiento; capturar referencias anteriores antes de borrar o modificar. Invalidar también comparaciones dependientes y proyecciones cuando cambie una suscripción, manejo, corte/pago, archivo/reactivación, nombre/color/categoría o fuente TRM.
- [x] Verificar que nuevas lecturas tras el cron y el cambio de día de Bogotá actualizan la proyección y su origen; no añadir caché persistente sin una estrategia de frescura para estas escrituras externas.

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

- [x] Regresiones de Server Actions para toda la matriz, incluidos meses anteriores y nuevos tras edición/borrado y cambios de suscripción o tarjeta. No depender solo de `router.refresh()` en la página que inicia la acción.
- [x] Deuda/cupo cambian por movimientos de abono, no por marcar pagado; `real_total` distinto no altera el cálculo mensual.
- [x] Navegar desde una página ya visitada tras crear/editar/borrar, pausar suscripción y archivar/reactivar no muestra agregados obsoletos.
- [x] Cron convierte un previsto en real sin duplicarlo; nueva TRM solo cambia previstos USD, no cargos o cuotas reales.

## Verificación

```
pnpm typecheck && pnpm lint && pnpm test && pnpm test:coverage
pnpm build
```

- [x] `grep -ri "tablero" app components lib` no devuelve textos visibles obsoletos.
- [x] Ningún componente ni función sin uso.
- [x] Flujo principal del PRD (sección 8) completo desde Meses.
- [x] Matriz verificada con fixtures/local, sin escribir datos de QA en producción. Enlaces de detalle de movimiento/extracto usan fechas guardadas; no crean accesos a meses futuros fuera del horizonte (para ellos se mantiene el acceso al extracto real).

## Criterios de terminado

- Commit: `refactor: retire dashboard and align views with month navigation`.

## Notas de progreso

- 2026-11-15 — Inicio en `feat/h9-month-views`, sin despliegue. Se añadió invalidación conservadora por patrones de página tras las escrituras financieras: cubre tanto referencias antiguas como nuevas sin depender de que sobrevivan al borrado, y también comparaciones y proyecciones. La documentación instalada de Next.js permite invalidar patrones con `type: "page"`; falta probar la matriz completa en navegación hidratada y revisar el coste de invalidación. `/movimientos` ya consulta solo el mes seleccionado, etiqueta «Mes de compra» y no muestra gráficos. Se agregaron enlaces desde movimiento y extracto con fecha de pago guardada y límite de horizonte. Pasan pruebas focalizadas, `typecheck` y `lint`; el retiro de componentes y la validación final siguen pendientes.
- 2026-11-15 — Añadidas regresiones para edición de movimientos, cambios de tarjeta/categoría, pausa de suscripción, enlaces dentro y fuera del horizonte y el filtro de compra. La franja mensual reutiliza `CreditAvailability` para presentar sobrecupo en lugar de un cupo negativo sin contexto. Las muestras del catálogo todavía consumen componentes anteriores; no se han eliminado ni se han sustituido sus pruebas.
- 2026-11-15 — Chromium hidratado con cuenta sintética en Supabase local: tras visitar inicio y detalle, pausar la suscripción retiró $20.000 de previstos en ambas vistas; archivar la tarjeta mantuvo la deuda de $100.000 sin mostrarla como activa y restaurarla actualizó la franja. La cuenta creada se eliminó. Quedan por verificar las demás escrituras y el retiro/adaptación del catálogo.
- 2026-11-15 — Chromium hidratado con una compra sintética a dos cuotas: crearla actualizó inicio y detalle ya visitados; editar fecha y valor trasladó los cargos de noviembre a diciembre/enero y actualizó deuda/cupo; borrarla restituyó importes. La cuenta y sus datos se eliminaron. No se usaron datos de producción.
- 2026-11-15 — El catálogo usa la franja y fila mensuales, con pruebas de las seis identidades adaptadas antes de retirar componentes y dominio exclusivos del tablero. Chromium revisó Movimientos y el catálogo actualizado a 360 px oscuro sin desbordamiento; el catálogo también se comprobó en escritorio claro. Pruebas de lecturas cubren cambio de TRM y transición del cron al cambiar el día de Bogotá. Pasan build, typecheck, lint y cobertura del dominio del 100 %; resta la verificación final de base local.
- 2026-11-15 — Cierre. Con autorización del dueño se reinició solo Supabase local: migraciones, 167 pruebas SQL e integración local pasan. Barrido de exportaciones sin consumidores: se retiraron `spendingByMonth`, `spendingByCategory` y `differenceInDays`, que solo alimentaban el historial con gráficos y el tablero. `formatSpendingComparison` se conectó al detalle mensual para la comparación D29 entre meses cerrados comparables (porcentaje neutro con sus protecciones más diferencia monetaria), en lugar de dejarlo huérfano. Pruebas renombradas sin «dashboard». La matriz se verificó hidratada para movimientos, suscripción, tarjeta y pago (paso 24); edición/archivo de categorías queda cubierta por regresiones de Server Actions, no en navegador. Fuera de alcance y sin uso desde antes de H9: `dueTone`, `trialTone`, `formatDueIn`, `DateLabel` y otros helpers; se dejan para el paso 26. La invalidación por patrones es conservadora: puede refrescar más páginas de las necesarias. Pasan build, typecheck, lint, 346 pruebas y cobertura del dominio del 100 %. Sin despliegue.
