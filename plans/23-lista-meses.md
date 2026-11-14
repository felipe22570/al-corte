# Paso 23 — Inicio: lista de meses

- **Hito PRD:** H9 (parte 3 de 6)
- **Estado:** ⬜ Pendiente
- **Inicio:**
- **Fin:**
- **Commit:**
- **Depende de:** 21, 22
- **Decisiones aplicables (decididas, ver README):** D2, D18–D29

## Objetivo

Reemplazar el contenido de `/` por la lista de meses (F6) siguiendo el brief del paso 22 y usando solo las funciones del paso 21.

## Contenido

- Alerta de vencidos (D23, D26): importe calculado de extractos sin confirmar, sin descontar abonos, y enlaces a todos los meses afectados.
- Franja compacta de tarjetas activas con cupo disponible y utilización (`UtilizationBar`), enlazando a `/tarjetas/[id]`. Sobrecupo con tono danger.
- Deuda total registrada como dato secundario, calculada con `card_balances.used` (D2), incluidas tarjetas archivadas con saldo; sin proyecciones ni límite de 12 meses.
- Mes actual siempre presente y destacado; próximos y anteriores (D22). Historial en bloques de 12 meses con extractos, no de 12 filas de extracto. Manejo por sí solo puede generar 12 meses futuros (D21); aviso de cuotas/extractos reales posteriores.
- Filas con total calculado o "Total conocido", "Pendiente de confirmar pago" y su ayuda, previstos separados y estado según R7. No confundir confirmación de extractos con saldo tras abonos.
- Barra apilada solo si total positivo y subtotales por tarjeta no negativos; si no, desglose textual firmado con "Saldo a favor" cuando corresponda. La barra comunica composición, no evolución cuantitativa entre meses.
- Cada fila enlaza a `/meses/AAAA-MM` con área táctil completa y foco visible.
- Acción "Nuevo gasto" según el patrón actual del shell (encabezado en escritorio, botón flotante en móvil).
- Navegación: el destino "Tablero" pasa a llamarse "Meses" en barra lateral y navegación inferior (D25).

## Tareas

- [ ] Consulta en el servidor sin N+1 por tarjeta ni por mes, con la paginación existente para no truncar totales.
- [ ] Consultas compartidas para lista y detalle (por ejemplo `lib/queries/months.ts`), separadas del dominio puro: incluir reales, movimientos con identidad de suscripción, cuotas con categoría original, suscripciones y fuente TRM D4. Paginar meses sin cortar sus cargos y no cargar todo el historial de movimientos en cada visita.
- [ ] `app/(app)/page.tsx` y componentes nuevos (por ejemplo `month-row`, `cards-strip`, `overdue-alert`), reutilizando `Money`, `StatusBadge`, `CardColorChip` y `UtilizationBar`.
- [ ] Estados vacíos: sin ninguna tarjeta (acción a `/ajustes`), tarjetas sin extractos ni previstos y ninguna activa pero con historial/compromisos reales. No ocultar información de archivadas ni marcar Pagado un actual vacío.
- [ ] Aviso de TRM faltante con cobros afectados; no presentar total conocido incompleto como definitivo.
- [ ] Skeleton de carga acorde a la nueva estructura.
- [ ] No borrar todavía los componentes del tablero; se retiran en el paso 25.
- [ ] Mantener los pasos 23–24 en una rama de trabajo sin desplegar enlaces rotos: publicar el reemplazo del inicio solo cuando su detalle esté disponible.

## Pruebas

- [ ] Vitest de proporciones seguras y redondeo (100 % cuando aplica), cero, negativos y fallback textual. Importes y proporciones con Decimal hasta su conversión final para presentación.
- [ ] Pruebas de renderizado y consultas: actual vacío, todas las tarjetas archivadas, estado incompleto por TRM, múltiples meses vencidos y paginación histórica sin perder totales.

## Verificación

```
pnpm typecheck && pnpm lint && pnpm test && pnpm test:coverage
pnpm build && pnpm start
```

- [ ] Con fixtures QA: el total actual coincide con extractos reales más previstos; la parte real coincide con los extractos, sin exigir que una vista sin proyección incluya cargos virtuales.
- [ ] Marcar pagado cambia estado y pendiente de confirmar, pero no el total, la deuda registrada ni el cupo por sí solo.
- [ ] Una compra nueva a 6 cuotas aparece en los 6 meses correctos.
- [ ] Un extracto vencido aparece en la alerta y en su mes, no en el total del mes actual.
- [ ] El historial y la deuda registrada siguen visibles al archivar todas las tarjetas; solo manejo genera el horizonte aprobado.
- [ ] 360 px y modo oscuro; escritorio ancho sin columnas vacías.

## Criterios de terminado

- Verificaciones en verde y Definición de terminado global.
- Commit: `feat: replace dashboard with payment-month list`.

## Notas de progreso

<!-- Fecha — nota -->
