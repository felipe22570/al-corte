# Paso 14 — Extractos: detalle de tarjeta y de extracto

- **Hito PRD:** H5 — **H5 termina aquí**
- **Estado:** ⬜ Pendiente
- **Inicio:** —
- **Fin:** —
- **Commit:** —
- **Depende de:** 13
- **Decisiones aplicables (decididas, ver README):** D3 (cuotas en USD con equivalente en COP)

## Objetivo

Pantallas `/tarjetas/[id]` y `/tarjetas/[id]/extractos/[cutoff]` (F5): extracto abierto, próximos y anteriores; desglose por concepto; total calculado frente al real; marcar como pagado.

## Diseño

- **Extracto abierto:** el de la tarjeta con `period_start ≤ hoy ≤ cutoff_date` (hoy en Bogotá). Si no existe fila aún, se muestra calculado con `statementPeriod` y total 0 (no se crea hasta que haya un movimiento, como dice el PRD).
- **Próximos:** `cutoff_date > corte abierto` (normalmente solo cuotas y cuota de manejo).
- **Anteriores:** `cutoff_date < hoy`, con estado pagado / pendiente / vencido (`due_date < hoy` y sin `paid_at`).
- Totales desde la vista `statement_totals`. El parámetro `[cutoff]` es la fecha `YYYY-MM-DD`; validar formato.
- Escrituras: `setStatementRealTotal(statementId, amount | null)`, `markStatementPaid(statementId, paidAt)`, `unmarkStatementPaid(statementId)`.

## Tareas

- [ ] `lib/validation/statement.ts` y `lib/actions/statements.ts`.
- [ ] Consultas de lectura en `lib/queries/statements.ts` (o junto a la página): extractos por tarjeta con totales; ítems de un extracto (movimientos de 1 cuota + cuotas con su compra + pagos).
- [ ] `app/(app)/tarjetas/[id]/page.tsx`:
  - Encabezado: franja o chip `bg-card-N` + nombre, banco, `•••• 1234`, cupo disponible y `UtilizationBar` (`card_balances`).
  - Extracto abierto destacado: el total proyectado es el monto protagonista (`text-amount-lg`), con frase tipo "Pagas $1.284.500 el 2 dic" y el corte con `DateLabel`.
  - Estado de cada extracto con `StatusBadge` y `dueTone` del paso 09: "Pagado" (ok), "Vence en 3 días" (warning, ≤ 5 días), "Vencido" (danger), "Pendiente" (neutral).
  - Lista de próximos y anteriores con total y estado.
  - "Compras a cuotas activas": compra, cuota actual (ej. 4/12), valor de la cuota, saldo pendiente; enlace al detalle del movimiento. Las compras en USD muestran la cuota y el saldo en USD y la cuota estimada en COP (D3).
  - Los totales del extracto siempre en COP; los ítems en USD muestran ambos valores con la etiqueta "estimado".
- [ ] `app/(app)/tarjetas/[id]/extractos/[cutoff]/page.tsx`:
  - Periodo (inicio – corte), fecha límite.
  - Desglose por concepto (compras de 1 cuota, cuotas, suscripciones, avances y comisiones, intereses, cuota de manejo, seguros, ajustes, devoluciones) con subtotal y lista de ítems plegable por concepto.
  - Pagos aparte como abonos.
  - Total calculado (monto protagonista) frente al total real: campo para registrar el real; muestra la diferencia en valor y en %. Si supera 1% (métrica de éxito del PRD), `StatusBadge` warning con texto "Diferencia de 1,8%"; si no, sin color.
  - Botón "Marcar como pagado" (único primary de la pantalla, fecha de hoy por defecto) y deshacer.
  - Desglose: conceptos como filas con etiqueta a la izquierda y `Money` a la derecha; devoluciones y pagos con signo, sin verde (el verde solo significa "al día").
  - Navegación al extracto anterior y siguiente.
- [ ] Enlaces a `/tarjetas/[id]` desde la lista de tarjetas en `/ajustes` (y en el tablero en el paso 16).
- [ ] `notFound()` para tarjeta o corte inexistentes o ajenos.

## Pruebas

- [ ] Vitest: función pura que clasifica extractos en abierto/próximos/anteriores y su estado (pagado, pendiente, vencido) a partir de `today`, en `lib/domain/statements.ts` (mantener 100% de cobertura).
- [ ] Vitest: diferencia total real vs. calculado (valor y %), con real = null.

## Verificación

```
pnpm typecheck && pnpm lint && pnpm test && pnpm test:coverage
supabase db reset && supabase test db
pnpm build
```

Comprobaciones manuales con datos de prueba (tarjeta con corte 15, pago 5, cuota de manejo; una compra de 1 cuota, una a 3 cuotas, un avance, una devolución y un pago en el periodo actual):

- [ ] El extracto abierto muestra cada concepto con el valor esperado y el total coincide con la suma manual (pagos no restan).
- [ ] Los 2 extractos próximos muestran las cuotas 2 y 3 de la compra a 3 cuotas (y la cuota de manejo si D1).
- [ ] La compra a 3 cuotas aparece en "Compras a cuotas activas" como 1/3.
- [ ] Registrar total real 1% distinto al calculado → la diferencia se resalta.
- [ ] Marcar como pagado cambia el estado; deshacer lo revierte.
- [ ] Un extracto vencido sin pagar se ve como "Vencido" (badge danger con texto); uno que vence en 5 días o menos, warning; uno pagado, ok.
- [ ] 360 px y modo oscuro correctos; `pnpm lint` (incluye `check-design`) sin hallazgos.

## Criterios de terminado

- Verificaciones en verde → **H5 terminado**.
- Commit: `feat: add card and statement detail pages`.
- Etiqueta opcional: `git tag h5`.

## Notas de progreso

<!-- Fecha — nota -->
