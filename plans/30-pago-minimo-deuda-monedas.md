# Paso 30 — Pago mínimo, deuda total y saldos por moneda

- **Hito PRD:** H10 (parte 4 de 9)
- **Estado:** ⬜ Pendiente
- **Inicio:**
- **Fin:**
- **Commit:**
- **Depende de:** 27, 29
- **Decisiones aplicables (decididas, ver README):** D3, D26, D27, D29, D33, D48

## Objetivo

Mostrar por extracto y moneda cuánto se paga este mes y cuánto se debe en total, con el saldo en dólares por separado (F12, R8).

## Contenido

- Migración:
    - Tabla `statement_balances (statement_id, currency, real_minimum, real_total, paid_at)` con `user_id`, RLS y único por `(statement_id, currency)`. Migrar `statements.real_total` y `paid_at` existentes a la fila COP, conservando el comportamiento de D26.
    - En la misma migración se eliminan `statements.real_total` y `statements.paid_at`: una sola fuente para las marcas de pago. Unos 30 archivos los leen hoy (`lib/domain/months.ts`, `lib/queries/`, `lib/actions/statements.ts`, páginas de tarjeta y extracto, componentes de mes y sus pruebas); el plan del paso los lista y los migra.
    - `statement_totals` por moneda (una fila por extracto y moneda, con `amount` en la moneda original) o una vista nueva equivalente. La usan las páginas de tarjeta y de extracto.
- Dominio: pago mínimo y deuda total por extracto y moneda según R8. Estado del extracto: pagado cuando todas las monedas con cargos están marcadas.
- Detalle de extracto: dos bloques por moneda (pago mínimo y deuda total), con el valor del banco como referencia y la diferencia solo si supera el redondeo del banco. Marcar pagado por moneda, con controles secundarios e IDs únicos, sin copiar `StatementControls` completo por moneda.
- Meses (`months.ts` y vistas): el total del mes es el pago mínimo en COP; los cargos en USD se muestran aparte ("y US$ 9"), con su equivalente COP solo como referencia. Deuda total como dato secundario. Actualizar R7 en el código donde hoy suma `total_cop` de cuotas en USD.
- TRM faltante (R8): ya no deja incompleto el total en pesos ni el de dólares; solo falta el equivalente COP de referencia, con su aviso. Ajustar `complete`, "Total conocido" y las condiciones de comparación (D29) en `months.ts`, y la prueba correspondiente de `AGENTS.md`.
- Cupo (`card_balances`): se mantiene en COP, como lo muestra el banco, con el capital USD por su equivalente.
- Exportación: `statement_balances` en `lib/export-schema.ts`; quitar las columnas eliminadas.

## Pruebas

- [ ] Con los datos de noviembre (JSON de importación como fixture, sin datos personales): Visa $1.178.835,57 y $3.845.774,86; Mastercard $1.706.233,98 y $4.265.727,76; USD 8,22 y 153,26. Coinciden con el banco tras su redondeo hacia arriba.
- [ ] Marcar pagado el saldo en COP no marca el de USD.
- [ ] Un mes con cargos solo en USD no muestra "$0" como total a pagar.
- [ ] Sin TRM, el total en dólares se conserva y solo falta el equivalente COP, con su aviso.
- [ ] Ningún archivo lee `statements.paid_at` ni `statements.real_total` (búsqueda en el código y `supabase test db`).

## Verificación

```
pnpm typecheck && pnpm lint && pnpm test && pnpm test:coverage
supabase db reset && supabase test db
pnpm build && pnpm start
```

- [ ] 360 px y modo oscuro en extracto y mes.

## Criterios de terminado

- Commit: `feat: show minimum payment and total debt per currency`.

## Notas de progreso

<!-- Fecha — nota -->
