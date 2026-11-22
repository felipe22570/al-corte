# Paso 37 — Costo de diferir

- **Hito PRD:** H11 (parte 2 de 4)
- **Estado:** ⬜ Pendiente
- **Inicio:**
- **Fin:**
- **Commit:**
- **Depende de:** 36
- **Decisiones aplicables (decididas, ver README):** D31, D32, D33, D54

## Objetivo

Mostrar cuánto cuesta en intereses cada compra a cuotas y cuánto se ahorra pagando el total (F21, R11).

## Contenido

- Dominio (`lib/domain/deferral-cost.ts`):
    - `estimatedInterest(plan)`: intereses de una compra según R11, con la misma regla que ya usa la app en cada modo, para que el costo de diferir cuadre con los meses:
        - `per_installment`: suma de los intereses de sus cuotas (R2), que ya incluyen la primera.
        - `on_balance`: suma de la estimación de R8 (`estimateBalanceInterest` de `lib/domain/interest.ts`) en cada extracto del plan. R8 no cobra intereses en el extracto del periodo en que se hizo la compra, así que la primera cuota no genera interés. No duplicar la fórmula: extraer de `interest.ts` el cálculo por compra si hace falta y reutilizarlo en ambos lados.
    - `deferralCostSummary(transaction)`: ya causado, estimado por causar, total estimado y porcentaje sobre el valor. Compras en curso: solo desde la cuota registrada.
    - `payInFullSavings(statement, currency)`: intereses estimados de los extractos futuros de esa moneda que se evitan pagando la deuda total, sin contar el interés del periodo en curso.
- Formulario de gasto: debajo de la vista previa de cuotas, por ejemplo en una tarjeta `on_balance` "Intereses estimados $3.308 · Total $12.308", y alerta si supera el 20 % ("Diferir esta compra cuesta un 37 % más"). Se actualiza al cambiar cuotas, valor o tarjeta.
- Detalle de la compra: bloque "Costo de diferir".
    - `per_installment`: intereses facturados (reales, de las cuotas ya cortadas) y estimados por pagar.
    - `on_balance`: el banco cobra una sola línea de intereses por extracto y no la reparte por compra, así que ambas cifras son estimadas: "causados hasta hoy (estimado)" y "por causar (estimado)", con una nota breve que lo explica.
- Extracto y mes, por ejemplo: "Si pagas la deuda total te ahorras cerca de $185.000 en intereses (estimado)", por moneda.
- Todo valor futuro lleva la palabra "estimado".

## Pruebas

- [ ] $9.000 a 36 cuotas, 28,3288 % E.A. (2,1003 % M.V.), capital fijo:
    - `per_installment` → $3.496,99 (i × P × (N + 1) / 2 con redondeo por cuota);
    - `on_balance` → $3.307,96 (i × P × (N − 1) / 2: sin interés en el extracto de la compra, R8), 37 % sobre el valor.
- [ ] La suma de `estimatedInterest` en `on_balance` coincide con los intereses estimados que proyectan los meses para esa compra.
- [ ] Sin intereses o a una cuota → 0.
- [ ] Compra en curso (cuota 10 de 36) → solo cuotas 10 a 36 ($1.984,78 en `on_balance` con los datos de arriba).
- [ ] Compra en USD → resultado en USD con equivalente COP de referencia.
- [ ] Ahorro por pagar el total: igual a la suma de intereses estimados de los extractos futuros de esa moneda, sin el del periodo en curso.

## Verificación

```
pnpm typecheck && pnpm lint && pnpm test && pnpm test:coverage
pnpm build && pnpm start
```

- [ ] 360 px y modo oscuro en formulario, detalle, extracto y mes.

## Criterios de terminado

- Commit: `feat: show estimated cost of deferring purchases`.

## Notas de progreso

<!-- Fecha — nota -->
