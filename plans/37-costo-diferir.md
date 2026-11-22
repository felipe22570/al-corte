# Paso 37 — Costo de diferir

- **Hito PRD:** H11 (parte 2 de 4)
- **Estado:** ✅ Terminado y verificado
- **Inicio:** 2026-11-21
- **Fin:** 2026-11-21
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

- [x] $9.000 a 36 cuotas, 28,3288 % E.A. (2,1003 % M.V.), capital fijo:
    - `per_installment` → $3.496,99 (i × P × (N + 1) / 2 con redondeo por cuota);
    - `on_balance` → $3.307,96 (i × P × (N − 1) / 2: sin interés en el extracto de la compra, R8), 37 % sobre el valor.
- [x] La suma de `estimatedInterest` en `on_balance` coincide con los intereses estimados que proyectan los meses para esa compra.
- [x] Sin intereses o a una cuota → 0.
- [x] Compra en curso (cuota 10 de 36) → solo cuotas 10 a 36 ($1.984,78 en `on_balance` con los datos de arriba).
- [x] Compra en USD → resultado en USD con equivalente COP de referencia.
- [x] Ahorro por pagar el total: igual a la suma de intereses estimados de los extractos futuros de esa moneda, sin el del periodo en curso.

## Verificación

```
pnpm typecheck && pnpm lint && pnpm test && pnpm test:coverage
pnpm build && pnpm start
```

- [x] 360 px y modo oscuro en formulario, detalle, extracto y mes.

## Criterios de terminado

- Commit: `feat: show estimated cost of deferring purchases`.

## Notas de progreso

<!-- Fecha — nota -->

- 2026-11-21 — Implementado. `balanceInterestFor` se extrajo de `estimateBalanceInterest` (`lib/domain/interest.ts`) y lo usan la estimación del extracto y el costo de diferir; la fórmula no queda duplicada. Dominio en `lib/domain/deferral-cost.ts` (`interestSchedule`, `estimatedInterest`, `deferralCostSummary`, `payInFullSavings`); `buildTransactionPlan` entrega `deferral` para la vista previa. `DeferralPurchase.installmentsCount` decide si la compra es a una cuota, para poder calcular con solo las cuotas por venir. El detalle suma los abonos a capital ponderados por días en su periodo (R9), igual que los meses. Consulta en `lib/queries/pay-in-full-savings.ts`. Componentes `DeferralCost` y `PayInFullSavings`. Sin migraciones ni dependencias nuevas.
- Decisiones del dueño al aprobar el plan: la alerta del 20 % es neutra (`Alert` por defecto, sin ámbar); el ahorro excluye todo el periodo del corte abierto hoy. Menores: el porcentaje sigue `formatPercent` ("37%", sin espacio, como pide `AGENTS.md`); en el detalle, "causados" es hasta el último corte; el bloque no aparece si la compra no genera intereses; en una compra en curso la vista previa muestra "Intereses restantes (estimado)" sin total ni alerta; el ahorro solo aparece en extractos cortados con esa moneda sin marcar como pagada.
- Pruebas: 12 de dominio (con la tasa del plan, 28,3288 % E.A.: $3.496,99, $3.307,96, 37 %, $1.984,78, USD con referencia en pesos, paridad con `projectStatements` y ahorro), 1 nueva de `transaction-plan`, 9 de presentación (formulario, detalle, ahorro y tarjeta del mes) y 1 de integración local. Total: 557 de Vitest; cobertura de dominio 100 %; `typecheck`, `lint` y `build` pasan.
- Revisión en navegador (local, 360 px): formulario en claro ("Intereses estimados: $3.308 · Total $12.308" y "Diferir esta compra cuesta un 37% más"); extracto de la Mastercard del 15 de noviembre en oscuro (ahorro estimado de $312.332 y US$ 49,01); mes de diciembre en claro, con las mismas cifras por moneda; detalle del avance de $700.000 a 24 cuotas en oscuro ($169.074, 24 %, que cuadra con i × P × (N − 1) / 2).
