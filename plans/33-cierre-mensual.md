# Paso 33 — Cierre mensual del extracto

- **Hito PRD:** H10 (parte 7 de 9)
- **Estado:** ⬜ Pendiente
- **Inicio:**
- **Fin:**
- **Commit:**
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

- [ ] Con los valores de noviembre, el cierre no muestra diferencias más allá del redondeo.
- [ ] Ingresar un saldo del banco menor al calculado recalcula las cuotas restantes de esa compra y nada más.
- [ ] Cambiar la tasa vigente no altera compras existentes.
- [ ] Conversión M.V. → E.A. → M.V. sin perder la tasa del banco.
- [ ] Reabrir un extracto conciliado quita la marca sin borrar los valores del banco.

## Verificación

```
pnpm typecheck && pnpm lint && pnpm test && pnpm test:coverage
supabase db reset && supabase test db
pnpm build && pnpm start
```

- [ ] 360 px y modo oscuro; el flujo completo toma menos de 2 minutos con un extracto real.

## Criterios de terminado

- Commit: `feat: add monthly statement close and reconciliation`.

## Notas de progreso

<!-- Fecha — nota -->
