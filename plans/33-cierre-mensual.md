# Paso 33 — Cierre mensual del extracto

- **Hito PRD:** H10 (parte 7 de 9)
- **Estado:** ✅ Terminado
- **Inicio:** 2026-11-21
- **Fin:** 2026-11-21
- **Commit:** `feat: add monthly statement close and reconciliation` (ver historial de git)
- **Depende de:** 29, 30, 32
- **Decisiones aplicables (decididas, ver README):** D27, D32, D33, D38, D39, D48

## Objetivo

Un flujo corto, después de cada corte, para registrar lo que dice el extracto del banco y corregir lo que no cuadre (F15).

## Contenido

- Migración: `statement_balances.reconciled_at` (por moneda; el extracto está "Conciliado" cuando todas sus monedas con cargos lo están) y el tipo de movimiento `late_interest` para los intereses de mora, separados de los corrientes porque la prioridad de R9 los aplica primero. `statement_totals` los suma como intereses. Exportación actualizada.
- Aviso en el mes y en la tarjeta cuando un extracto cerró y no tiene cierre: "Revisa el extracto de tu Visa".
- Formulario por moneda: pago mínimo, pago total, intereses corrientes, intereses de mora y tasa vigente (M.V. o E.A.).
- Comparación con el cálculo de la app: diferencias por concepto, ocultas si están dentro del redondeo del banco.
- Saldo por compra: lista de compras a cuotas con su saldo pendiente calculado y un campo opcional "Saldo según el banco". Si difiere, se ajusta el plan con las reglas de D31 y D38 (reducir plazo por defecto). Es la forma de reflejar cómo aplicó el banco un abono cuando su orden interno no es público.
- Los intereses reales reemplazan al estimado (D32). La tasa vigente actualiza la de la tarjeta solo para compras nuevas. Si se ingresa en M.V., se convierte a E.A. con (1 + i)^12 − 1; `purchase_rate_ea` guarda 6 decimales, así que la prueba comprueba que la vuelta a M.V. conserve la tasa del banco con 4 decimales (por ejemplo, 2,1003 %).
- El extracto queda marcado como "Conciliado" con fecha; se puede reabrir.

## Pruebas

- [ ] Con los valores de noviembre, el cierre no muestra diferencias más allá del redondeo. Pendiente para el paso 35: el JSON de importación no está en el repositorio.
- [x] Ingresar un saldo del banco menor al calculado recalcula las cuotas restantes de esa compra y nada más.
- [x] Cambiar la tasa vigente no altera compras existentes.
- [x] Conversión M.V. → E.A. → M.V. sin perder la tasa del banco.
- [x] Reabrir un extracto conciliado quita la marca sin borrar los valores del banco.

## Verificación

```
pnpm typecheck && pnpm lint && pnpm test && pnpm test:coverage
supabase db reset && supabase test db
pnpm build && pnpm start
```

- [x] 360 px y modo oscuro. El tiempo con un extracto real (menos de 2 minutos) queda por medir con el dueño.

## Criterios de terminado

- Commit: `feat: add monthly statement close and reconciliation`.

## Notas de progreso

<!-- Fecha — nota -->

- 2026-11-21 — Decisiones del dueño antes de implementar (registradas en el README):
    - Un saldo del banco mayor que el calculado también se respeta: misma cuota, más cuotas, hasta 72 en total.
    - Un saldo nuevo para la misma compra y extracto reemplaza la corrección anterior y restaura su plan antes de aplicar el nuevo, si no hay abonos posteriores. Reabrir solo quita la marca "Conciliado" y conserva valores y correcciones.
    - El aviso sale solo para el último extracto cortado de cada tarjeta activa sin conciliar.
    - El cierre edita los intereses ya registrados. La tasa vigente actualiza solo la de compras de la tarjeta, para compras nuevas.
- 2026-11-21 — Implementado:
    - Migraciones:
        - `20261121010000_late_interest_type.sql` crea el tipo `late_interest`, en un archivo aparte porque un valor nuevo de enum no se puede usar en la misma transacción.
        - `20261121010100_statement_close.sql`:
            - `statement_balances.reconciled_at` y `rate_ea`.
            - Las correcciones de saldo viven en `principal_prepayments` (`statement_id` y `bank_balance`, monto con signo), así que reutilizan la invariante y el deshacer en orden inverso del paso 32.
            - La vista suma la mora a intereses y las correcciones a la deuda de cortes anteriores.
            - RPC `close_statement`: valores del banco, tasa, intereses y mora (vacío conserva, cero borra), correcciones validadas y marca. RPC `reopen_statement`.
    - Dominio `lib/domain/reconciliation.ts`:
        - Conversión M.V. → E.A. y comparación con el banco.
        - Saldo después del extracto y plan rehecho desde el saldo del banco: misma cuota, mismos extractos y luego los siguientes. Los abonos posteriores al corte siguen aplicando.
        - Planeación de correcciones y extractos por revisar.
        - `months.ts` e `interest-estimates.ts` no estiman interés en una moneda conciliada o con interés real en esa moneda (antes, un interés real en cualquier moneda quitaba ambas estimaciones).
    - Lecturas: `lib/queries/statement-close.ts`. El contexto deshace virtualmente la corrección del mismo extracto, para que el plan nuevo parta de lo que la base restaura.
    - Interfaz:
        - "Cierre del extracto" por moneda en extractos cortados: valores del banco con su diferencia en vivo, que cuenta intereses y saldos ingresados; tasa vigente en M.V. o E.A.; saldo por compra; "Guardar y conciliar", "Guardar sin conciliar" y "Reabrir".
        - Aviso "Revisa el extracto de tu Visa" en el inicio, en el mes de pago del extracto y en la tarjeta.
        - Correcciones en el detalle del movimiento y "Interés de mora" en etiquetas y filtros.
        - Se retiraron los campos sueltos de valores del banco y el formulario de intereses reales (`setStatementBankValues`, `recordStatementInterest`), que el cierre reemplaza.
    - Exportación: columnas nuevas de `statement_balances` y `principal_prepayments`.
- Verificación:
    - 480 pruebas de Vitest con cobertura de dominio al 100 %, 327 de pgTAP (32 nuevas) e integración local de meses, pagos y cierre (`statement-close-local.integration.test.ts`: plan de TypeScript contra la RPC, saldos menor y mayor, USD liquidado, lecturas y reapertura).
    - `db reset`, tipos regenerados y build en verde.
    - Manual contra Supabase local (usuario temporal, borrado) a 360 px en claro y oscuro:
        - El aviso del inicio lleva al cierre.
        - Con intereses de $21.000 y mora de $500, el mínimo pasó de $145.368 (estimado) a $146.500. La diferencia con un mínimo del banco de $146.000 se muestra; la de 1 peso en la deuda, no.
        - Con el saldo del avance en $269.998,46, el plan quedó en 18 cuotas.
        - Al conciliar pesos y dólares desapareció el aviso.
        - En la revisión corregí la diferencia de deuda, que contaba dos veces un saldo ya guardado.
- Decisiones menores (para revisión del dueño):
    - Una diferencia de saldo dentro del redondeo del banco (hasta 1 hacia arriba) no corrige el plan.
    - Si se ingresan las dos tasas, la tarjeta toma la de la moneda que se guarde de último. El formulario la pide una vez, en la primera moneda del extracto.
    - Un intereses en cero sin conciliar no deja interés real: la estimación vuelve hasta conciliar. Varios cargos del mismo tipo en el extracto se corrigen desde movimientos.
    - La mora solo se registra desde el cierre: no está en el formulario de gasto y su detalle no se edita.
    - El aviso del mes solo sale en el mes de pago del extracto. En el inicio, siempre.
    - Si la tarjeta cambió de día de corte (D10), las cuotas extra de un saldo mayor siguen el día actual.
