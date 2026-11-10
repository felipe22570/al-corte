# Paso 12 — Registro de movimientos y cuotas (RPC transaccional)

- **Hito PRD:** H4 (parte 1 de 2)
- **Estado:** ⬜ Pendiente
- **Inicio:** —
- **Fin:** —
- **Commit:** —
- **Depende de:** 05, 08, 11
- **Decisiones aplicables (decididas, ver README):** D1, D3, D4

## Objetivo

Registro rápido en `/movimientos/nuevo` (F2, F3, R3, R6) con vista previa de cuotas y guardado atómico del movimiento, sus extractos, sus cuotas y, si es avance, su comisión.

## Diseño

Flujo: formulario → Server Action `createTransaction` → Zod → `lib/domain` (plan de cuotas, cortes, comisión, `amount_cop`) → RPC `create_transaction_with_installments(payload jsonb)` → `revalidatePath`.

RPC (migración `create_transaction_rpc`), `security invoker`, en una sola transacción:

1. Verifica que la tarjeta pertenezca al usuario y no esté archivada.
2. `ensure_statement(card_id, cutoff_date)` para el corte del movimiento.
3. Inserta el movimiento con `statement_id`, `rate_ea_applied` y `amount_cop`.
4. Si `installments_count > 1`: por cada cuota, `ensure_statement` del corte de la cuota (calculado en TypeScript y enviado en el payload) e inserta la fila en `installments`.
5. Si es `cash_advance` y la tarjeta tiene `advance_fee > 0`: inserta el movimiento `advance_fee` con `parent_id`, misma fecha y mismo extracto.
6. Devuelve el id del movimiento.

La RPC valida coherencia (Σ `principal` = `amount`, Σ `principal_cop` = `amount_cop`, número de cuotas = `installments_count`, cada `total = principal + interest` y `total_cop = principal_cop + interest_cop`, en COP las columnas `_cop` iguales a las originales) y lanza error si no se cumple: así la base no acepta un plan inconsistente aunque la Server Action tenga un error.

## Tareas

- [ ] Migración `create_transaction_rpc` con la función de arriba y `grant execute … to authenticated`.
- [ ] Pruebas pgTAP `050-create-transaction.test.sql`:
  - Compra a 6 cuotas → 1 movimiento, 6 cuotas, extractos creados para los 6 cortes.
  - Avance → movimiento + comisión con `parent_id`, mismo `statement_id`.
  - Plan inconsistente (Σ capital ≠ monto, o Σ `principal_cop` ≠ `amount_cop`) → error y **no** queda nada insertado.
  - Compra en USD a 3 cuotas (tabla de referencia del paso 05) → cuotas en USD con sus columnas `_cop` guardadas tal cual.
  - Usuario B no puede crear movimientos en la tarjeta de A.
- [ ] Regenerar `lib/database.types.ts`.
- [ ] `lib/validation/transaction.ts`: tipo, tarjeta, fecha (`YYYY-MM-DD`, por defecto `todayInBogota()`), valor (string decimal > 0), moneda, TRM (requerida si USD), comercio, categoría, cuotas 1–48 (solo para `purchase` y `cash_advance`), sin intereses, nota.
- [ ] `lib/domain/transaction-plan.ts` (puro, con pruebas): dado el input validado y la tarjeta, arma el payload completo de la RPC (cortes, cuotas, comisión, `amount_cop`, tasa congelada). Así la Server Action queda delgada y el armado queda probado.
- [ ] `lib/actions/transactions.ts`: `createTransaction`.
- [ ] Preferencia "última tarjeta usada" en `localStorage` con la clave `storageKey('last-card-id')` → `al-corte:last-card-id` (prefijo de `AGENTS.md`). Si la tarjeta guardada está archivada o no existe, usar la primera activa.
- [ ] TRM precargada según D4 (consulta en servidor).
- [ ] `app/(app)/movimientos/nuevo/page.tsx` + `components/transaction-form.tsx`:
  - Orden pensado para < 15 s: valor (teclado numérico, `inputMode="decimal"`, autofocus) → tarjeta (última usada) → categoría → comercio → cuotas (stepper 1–48) → "Más opciones" plegado: tipo (compra por defecto), fecha (hoy), moneda, TRM, sin intereses, nota.
  - El valor es el monto protagonista de la pantalla: campo grande con `text-amount-lg`, alineado como monto, con el símbolo de la moneda.
  - Selector de tarjeta con `CardColorChip` + nombre + `•••• 1234`; categorías con su icono Lucide (`size-5`, `strokeWidth={1.75}`).
  - Vista previa en vivo con `buildInstallmentPlan` en el cliente, en una tarjeta `bg-card border rounded-xl`: valor de la primera cuota (`Money`), total de intereses y extracto donde cae la primera cuota, con frases cortas tipo "Primera cuota $354.118 · corte del 15 feb, pagas el 5 mar". Compras sin intereses o a 1 cuota: "Sin intereses".
  - Para avances: muestra la comisión y la tasa de avances (`formatRate`).
  - Un solo botón primary ("Guardar"), fijo abajo en el celular sin tapar campos.
  - Al guardar: toast "Movimiento guardado" (sin exclamación) y regreso a la pantalla anterior (o al tablero).
- [ ] Mensajes de error de la RPC traducidos a español en la acción.

## Pruebas

- [ ] Vitest `transaction-plan.test.ts`: compra 1 cuota COP; compra 6 cuotas; compra USD con TRM → `amount_cop` correcto, cuotas calculadas en USD y con su equivalente en COP (D3); avance con comisión; sin intereses; tasa congelada = tasa actual de la tarjeta.
- [ ] Vitest esquema Zod de movimiento.

## Verificación

```
supabase db reset && supabase test db
pnpm typecheck && pnpm lint && pnpm test && pnpm test:coverage
pnpm build
```

Comprobaciones manuales:

- [ ] Flujo principal del PRD (sección 8): desde el tablero, "Nuevo gasto" → valor, tarjeta, categoría, cuotas de 1 a 6 → la vista previa muestra primera cuota, intereses y extracto → guardar. En la base: 1 movimiento + 6 cuotas, todas con `statement_id`, Σ `principal` = valor.
- [ ] La vista previa coincide con lo guardado (comparar primera cuota e intereses).
- [ ] Compra el día del corte va al extracto de ese mes; un día después, al siguiente.
- [ ] Avance: aparecen 2 movimientos y la comisión enlazada.
- [ ] Compra en USD: pide TRM, precarga la última conocida, guarda `fx_rate` y `amount_cop`.
- [ ] Compra en USD a 3 cuotas: la vista previa muestra la primera cuota en USD y su equivalente estimado en COP; en la base las cuotas tienen valores en USD (2 decimales) y columnas `_cop` en pesos enteros.
- [ ] Registrar un gasto simple desde el celular (o DevTools a 360 px) toma menos de 15 s cronometrado.
- [ ] Se recuerda la última tarjeta usada (`localStorage` → `al-corte:last-card-id`).
- [ ] Modo oscuro correcto; montos con `tabular-nums` (no "bailan" al escribir el valor).
- [ ] `pnpm lint` (incluye `check-design`) sin hallazgos.

## Criterios de terminado

- Verificaciones en verde.
- Commit: `feat: add quick transaction entry with installment preview`.

## Notas de progreso

<!-- Fecha — nota -->
