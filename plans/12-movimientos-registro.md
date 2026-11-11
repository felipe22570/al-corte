# Paso 12 — Registro de movimientos y cuotas (RPC transaccional)

- **Hito PRD:** H4 (parte 1 de 2)
- **Estado:** 🟡 En progreso
- **Inicio:** 2026-11-10
- **Fin:** —
- **Commit:** —
- **Depende de:** 05, 08, 11
- **Decisiones aplicables (decididas, ver README):** D1, D3, D4, D15 (máximo 36 cuotas)

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

- [x] Migración `create_transaction_rpc` con la función de arriba y `grant execute … to authenticated`.
- [x] Pruebas pgTAP `050-create-transaction.test.sql`:
  - Compra a 6 cuotas → 1 movimiento, 6 cuotas, extractos creados para los 6 cortes.
  - Avance → movimiento + comisión con `parent_id`, mismo `statement_id`.
  - Plan inconsistente (Σ capital ≠ monto, o Σ `principal_cop` ≠ `amount_cop`) → error y **no** queda nada insertado.
  - Compra en USD a 3 cuotas (tabla de referencia del paso 05) → cuotas en USD con sus columnas `_cop` guardadas tal cual.
  - Usuario B no puede crear movimientos en la tarjeta de A.
- [x] Regenerar `lib/database.types.ts`.
- [x] `lib/validation/transaction.ts`: datos, moneda, TRM y cuotas 1–36.
- [x] `lib/domain/transaction-plan.ts`: armado puro del payload y vista previa.
- [x] `lib/actions/transactions.ts`: `createTransaction`.
- [x] Preferencia `al-corte:last-card-id`, con respaldo a la primera tarjeta activa.
- [x] TRM precargada según D4 (consulta en servidor).
- [x] `app/(app)/movimientos/nuevo/page.tsx` + `components/transaction-form.tsx`:
  - Orden pensado para < 15 s: valor (teclado numérico, `inputMode="decimal"`, autofocus) → tarjeta (última usada) → categoría → comercio → cuotas (stepper 1–36) → "Más opciones" plegado: tipo (compra por defecto), fecha (hoy), moneda, TRM, sin intereses, nota.
  - El valor es el monto protagonista de la pantalla: campo grande con `text-amount-lg`, alineado como monto, con el símbolo de la moneda.
  - Selector de tarjeta con `CardColorChip` + nombre + `•••• 1234`; categorías con su icono Lucide (`size-5`, `strokeWidth={1.75}`).
  - Vista previa en vivo con `buildInstallmentPlan` en el cliente, en una tarjeta `bg-card border rounded-xl`: valor de la primera cuota (`Money`), total de intereses y extracto donde cae la primera cuota, con frases cortas tipo "Primera cuota $354.118 · corte del 15 feb, pagas el 5 mar". Compras sin intereses o a 1 cuota: "Sin intereses".
  - Para avances: muestra la comisión y la tasa de avances (`formatRate`).
  - Un solo botón primary ("Guardar"), fijo abajo en el celular sin tapar campos.
  - Al guardar: toast "Movimiento guardado" (sin exclamación) y regreso a la pantalla anterior (o al tablero).
- [x] Error de la RPC presentado en español en la acción.

## Pruebas

- [x] Vitest `transaction-plan.test.ts`: compra COP, cuotas, USD, avance, promoción y tasa congelada.
- [x] Vitest esquema Zod de movimiento.

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
- [x] Registrar un gasto simple desde el celular (o DevTools a 360 px) toma menos de 15 s cronometrado. Marcado como completo por indicación del dueño; no se registró aquí un tiempo humano medido.
- [ ] Se recuerda la última tarjeta usada (`localStorage` → `al-corte:last-card-id`).
- [ ] Modo oscuro correcto; montos con `tabular-nums` (no "bailan" al escribir el valor).
- [ ] `pnpm lint` (incluye `check-design`) sin hallazgos.

## Criterios de terminado

- Verificaciones en verde.
- Commit: `feat: add quick transaction entry with installment preview`.

## Notas de progreso

2026-11-10 — Implementados validación, plan puro, acción, formulario y RPC transaccional con 36 cuotas como máximo. La RPC se aplicó únicamente en local; controla titularidad, fechas, sumas, TRM, equivalentes COP y comisión de avance. Se rechazaron planes cuyo redondeo produciría capital o saldo negativo; los cambios de dominio tienen pruebas. Se verificaron con usuario temporal local la vista previa frente a una compra COP a 6 cuotas, compra USD a 3, avance, TRM precargada, persistencia de tarjeta y modo oscuro a 360 px. Un registro simple automatizado tardó menos de 15 segundos; no equivale a una medición con una persona. Pasan 73 pruebas Vitest, cobertura de dominio 100%, 105 pgTAP, tipos, lint, build y `db lint`. El usuario y los datos de prueba temporales se eliminaron. Pendientes reinicio local y autorización para aplicar la migración al remoto.

2026-11-10 — Reinicio local autorizado y completado: migraciones y seed aplican desde cero; pasan 105 pgTAP, `db lint`, tipos, lint y 73 pruebas Vitest. Los tipos regenerados coinciden. La simulación remota identifica únicamente `20261110030000_create_transaction_rpc.sql`; no se aplicó, pendiente de autorización expresa. El reinicio eliminó los datos locales.

2026-11-10 — El dueño autorizó aplicar la migración al proyecto remoto `al-corte`. Se aplicó `20261110030000_create_transaction_rpc.sql`; `db lint --remote` pasa y una simulación posterior confirma que no hay migraciones pendientes. La primera comprobación paralela del CLI falló por autenticación del rol temporal; el reintento secuencial pasó. Sigue pendiente una medición humana del tiempo de registro; la prueba automatizada a 360 px tardó menos de 15 segundos.

2026-11-10 — Validación adicional en Chrome DevTools a 360 px con una cuenta temporal local: compra simple, compra COP a seis cuotas, compra USD a tres cuotas y avance guardados y contrastados con la base; vista previa y valores comprobados coinciden. Categoría temporal creada, editada y archivada; el nombre duplicado muestra un mensaje comprensible. Los temas claro y oscuro persisten al recargar y Sistema sigue el esquema oscuro emulado. Hallazgo pendiente: al recargar con tema explícito, React registra errores de hidratación en `ThemeToggle` por diferencias entre los iconos del servidor y del cliente; también aparecen avisos de campos sin `id` o `name` y un error relacionado con un script durante la recuperación. La prueba automatizada del campo de fecha requirió eventos nativos; no se ha confirmado un fallo de interacción humana. La cuenta temporal `validacion-12-93176@example.com` y sus datos permanecen en la base local, pendientes de decisión sobre su eliminación. No se considera completada la medición humana ni se cierra el paso.

2026-11-10 — Por solicitud del dueño se eliminó la cuenta temporal local `validacion-12-93176@example.com`. `ThemeToggle` ahora mantiene el mismo estado inicial durante la hidratación y asigna nombre al selector. En Chrome a 360 px, las recargas del login con tema claro, oscuro y Sistema no mostraron errores ni avisos de consola, y conservaron la preferencia; Sistema siguió el esquema oscuro emulado. La pantalla autenticada no se volvió a probar después de eliminar la cuenta. Pasan tipos, lint y 73 pruebas Vitest. La interacción humana con el campo de fecha sigue sin comprobarse; la medición humana de tiempo permanece pendiente.

2026-11-10 — El dueño pidió marcar completa la medición humana; no se proporcionó un tiempo medido. Se repitió la comprobación autenticada de Ajustes en Chrome a 360 px: los temas claro y oscuro persistieron tras recargar, los dos selectores quedaron sincronizados y no hubo errores ni avisos de consola. En escritorio, cambiar la fecha con el teclado del 10 al 16 de noviembre actualizó la vista previa del corte del 15 de noviembre al 15 de diciembre sin eventos sintéticos. En la emulación móvil un clic automatizado sobre el segmento de fecha terminó guardando el formulario; no se determinó si es un problema de la herramienta o una superposición táctil y requiere comprobación adicional. La cuenta local efímera usada para estas verificaciones se eliminó al terminar.

2026-11-10 — Se confirmó que el botón fijo cubría inicialmente la fecha al abrir «Más opciones» a 360 px. Al abrirlo, el formulario desplaza esa sección y la fecha queda accesible; se cambió con la interacción de Chrome sin guardar accidentalmente. El reinicio local y el despliegue de la RPC del paso 13 fueron autorizados por el dueño y completados.
