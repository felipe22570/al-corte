# Paso 13 — Detalle, edición y borrado de movimientos

- **Hito PRD:** H4 (parte 2 de 2) — **H4 termina aquí**
- **Estado:** ⬜ Pendiente
- **Inicio:** —
- **Fin:** —
- **Commit:** —
- **Depende de:** 12
- **Decisiones aplicables (decididas, ver README):** D3, D6

## Objetivo

Pantalla `/movimientos/[id]` con los datos del movimiento y su tabla de amortización (F3), y edición/borrado con regeneración de cuotas (F2).

## Diseño

- RPC `update_transaction_with_installments(p_id uuid, payload jsonb)`: en una transacción actualiza el movimiento, reasigna su extracto, borra sus cuotas y las regenera, y actualiza o recrea la comisión si es avance. Mismas validaciones de coherencia que la de creación.
- Borrado: `delete from transactions where id = …` → `installments` y la comisión hija caen por `on delete cascade`. Los extractos vacíos se dejan (no afectan totales); anotar la decisión.
- Movimientos generados por suscripción (`source = 'subscription'`): se pueden editar (valor real cobrado) y borrar; al editar el valor, actualizar `subscriptions.last_charged_amount` si es el cobro más reciente. Anotar decisión.
- Movimientos `advance_fee` hijos no se editan solos: se editan desde su avance.

## Tareas

- [ ] Migración `update_transaction_rpc`.
- [ ] Pruebas pgTAP `060-update-transaction.test.sql`: cambiar de 6 a 3 cuotas deja exactamente 3 cuotas; cambiar la fecha a después del corte mueve todo al siguiente extracto; cambiar tipo de avance a compra elimina la comisión; borrar un avance borra su comisión y sus cuotas; usuario B no puede editar ni borrar.
- [ ] Regenerar tipos.
- [ ] `lib/actions/transactions.ts`: `updateTransaction`, `deleteTransaction`.
- [ ] `app/(app)/movimientos/[id]/page.tsx`: tipo, fecha, comercio, categoría, tarjeta, valor (y USD + TRM si aplica), extracto asignado (enlace), nota, origen.
- [ ] Tabla de amortización `components/amortization-table.tsx`: número, extracto, capital, interés, total, saldo; en compras en USD los valores van en USD y se agrega el total estimado en COP por cuota (D3); resalta la cuota actual (fondo `bg-accent` y texto "Cuota actual", no un color de estado) y muestra el progreso con texto ("Te faltan 8 de 12 cuotas") y el saldo pendiente con `installmentProgress`. Montos con `text-amount` alineados a la derecha. En 360 px: lista de filas compactas en vez de tabla ancha.
- [ ] El monto protagonista de la pantalla es el valor del movimiento (`Money size="lg"`); tarjeta con `CardColorChip` + nombre + `•••• 1234`; categoría con su icono.
- [ ] Editar: reutiliza `transaction-form` con valores iniciales; aviso si hay cuotas en extractos pagados (D6) y aviso de que la tasa congelada se recalcula con la tasa actual de la tarjeta (o se conserva: **decidir** y anotar).
- [ ] Borrar: diálogo de confirmación (botón `destructive`) que indica cuántas cuotas y movimientos hijos se borran, con texto calmado ("Se borran la compra y sus 6 cuotas.").
- [ ] `notFound()` si el id no existe o no es del usuario.

## Verificación

```
supabase db reset && supabase test db
pnpm typecheck && pnpm lint && pnpm test && pnpm test:coverage
pnpm build
```

Comprobaciones manuales:

- [ ] Una compra a 12 cuotas muestra 12 filas; la suma de la columna capital = valor de la compra; último saldo = 0.
- [ ] Editar de 12 a 6 cuotas → la tabla muestra 6 filas y en la base hay 6 cuotas.
- [ ] Editar la TRM de una compra en USD a cuotas → los valores en USD no cambian y las columnas `_cop` se recalculan.
- [ ] Editar la fecha de un día antes del corte a un día después → el extracto asignado cambia.
- [ ] Borrar un avance borra también su comisión.
- [ ] Abrir `/movimientos/<uuid-inexistente>` muestra la página 404 en español.
- [ ] 360 px y modo oscuro correctos; `pnpm lint` (incluye `check-design`) sin hallazgos.

## Criterios de terminado

- Verificaciones en verde → **H4 terminado**.
- Commit: `feat: add transaction detail, edit and delete with installment regeneration`.
- Etiqueta opcional: `git tag h4`.

## Notas de progreso

<!-- Fecha — nota -->
