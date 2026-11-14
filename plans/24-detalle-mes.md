# Paso 24 — Detalle de un mes

- **Hito PRD:** H9 (parte 4 de 6)
- **Estado:** ⬜ Pendiente
- **Inicio:**
- **Fin:**
- **Commit:**
- **Depende de:** 21, 22, 23
- **Decisiones aplicables (decididas, ver README):** D5, D10, D16–D29

## Objetivo

Ruta `/meses/[mes]` (F9) siguiendo el brief del paso 22.

## Contenido

- Encabezado: nombre, total calculado o "Total conocido", "Pendiente de confirmar pago" con la ayuda de D26, cobros previstos aparte y estado. Comparación con el mes calendario anterior solo si ambos son cerrados, con datos y sin proyección ni TRM faltante (D29).
- Mes actual con extractos abiertos: "Ya facturado" y "Aún puede crecer", este último separado en registrado y previsto, con tarjeta y fecha de corte. El total cuadra con las tres partes.
- Alerta de vencidos de meses anteriores cuando el mes es el actual (D23).
- Bloque por tarjeta con cada extracto del mes: total calculado, fecha límite, estado, periodo de compras guardado, enlace a `/tarjetas/[id]/extractos/[cutoff]` y acción secundaria de marcar/deshacer pago. Reutilizar las acciones existentes, no repetir `StatementControls` completo: extraer un control compacto con IDs únicos y nombres accesibles por tarjeta/extracto. El total bancario se edita en el extracto y no sustituye al calculado (D27).
- Desglose por concepto con ajustes y devoluciones restadas, montos alineados a la derecha y pagos aparte. Reutilizar la presentación de `category-spending-chart`, pero reemplazar su fuente D5 por `monthBreakdown` de R7: cuotas por `total_cop`, categoría original, cargos y previstos con su categoría o "Sin categoría", sin duplicar capital ni interés. Título "Cargos del mes de pago por categoría", eje apto para negativos y lista textual firmada (D17, D28).
- Dato secundario "Compraste en este mes" (D5), separado visualmente del total a pagar.
- Mes futuro: reales más previstos, marcado Estimado y nota "Se sumará lo que gastes antes de cada corte". Virtuales sin enlace ni acción de pago. Sin TRM, "Total conocido" con aviso y cobros USD afectados, no cero inventado; sin comparaciones de ahorro.
- Actual vacío "Sin extractos", sin badge Pagado. Con negativos, "Saldo a favor" sin ocultar devoluciones ni presentarlo como dinero que se debe pagar.
- Navegación entre meses disponibles, omitiendo huecos; mes actual siempre accesible y enlaces históricos independientes de la paginación del inicio. Parámetro inválido, pasado sin extractos o futuro fuera de la ventana/sin datos → `notFound()`.

## Tareas

- [ ] `app/(app)/meses/[mes]/page.tsx` con validación del parámetro `AAAA-MM`.
- [ ] Componentes del detalle reutilizando los existentes.
- [ ] Reutilizar la capa de consultas del paso 23; el agregado no se recalcula con reglas de UI ni trunca cargos por límites de la API.
- [ ] Después de marcar/desmarcar desde aquí o desde el extracto, revalidar `/`, el mes afectado y las vistas de tarjeta/extracto; completar la matriz transversal en el paso 25.

## Pruebas

- [ ] Vitest del parser de `AAAA-MM` y de cualquier helper nuevo.
- [ ] Renderizado con varias tarjetas: IDs únicos, cada etiqueta conectada a su control y botones de pago secundarios con contexto accesible. Sin edición de total bancario ni acción de pago en virtuales.
- [ ] Navegación directa a un mes histórico no cargado en `/`, huecos entre meses, mes actual vacío y límites del horizonte.
- [ ] Categorías del mes de pago (no de compra), cuotas con interés, ajustes, devoluciones, "Sin categoría" y total conocido incompleto por TRM.
- [ ] Comparación segura de meses cerrados; no porcentaje ni afirmación de ahorro en mes abierto, futuro, sin datos o sin TRM.

## Verificación

```
pnpm typecheck && pnpm lint && pnpm test && pnpm test:coverage
pnpm build && pnpm start
```

- [ ] El total conocido es igual a la suma de bloques por tarjeta, conceptos y categorías; registrados y previstos se pueden identificar por separado.
- [ ] La parte real de cada bloque coincide con el extracto guardado; sus previstos se muestran aparte, sin exigir que ya existan en el detalle del extracto.
- [ ] Un mes futuro con una suscripción en USD muestra el estimado con la TRM vigente.
- [ ] Abono registrado sin marca mantiene el pendiente de confirmar; marcar/desmarcar actualiza mes/lista sin registrar abono ni liberar cupo. Un total bancario diferente no altera el agregado.
- [ ] 360 px y modo oscuro.

## Criterios de terminado

- Verificaciones en verde y Definición de terminado global.
- Commit: `feat: add payment-month detail view`.

## Notas de progreso

<!-- Fecha — nota -->
