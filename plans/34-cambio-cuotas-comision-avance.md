# Paso 34 — Cambio de cuotas y comisión de avance por movimiento

- **Hito PRD:** H10 (parte 8 de 9)
- **Estado:** ✅ Terminado
- **Inicio:** 2026-11-21
- **Fin:** 2026-11-21
- **Commit:** `feat: allow installment changes and per-advance fees` (ver historial de git)
- **Depende de:** 27, 32
- **Decisiones aplicables (decididas, ver README):** D6, D31, D40, D41, D48, D50

## Objetivo

Reflejar en la app dos operaciones frecuentes del banco: cambiar el número de cuotas de una compra y cobrar comisiones de avance distintas según el canal (F16, F17).

## Contenido

- Cambiar cuotas desde el detalle de una compra: nuevo número de cuotas **restantes** (1 a 36) sobre el saldo pendiente, a partir de la próxima cuota sin facturar (D40, D50). Conserva cuotas facturadas y previas; recalcula el capital restante con el método de la tarjeta. El plan efectivo puede llegar a 72 cuotas (límite del paso 27). Vista previa con la nueva cuota y la diferencia de intereses estimada.
- No incluye la ampliación de plazo de todo el saldo (Bancolombia la ofrece con una tasa promedio ponderada); queda anotada para después.
- Comisión de avance (D41): el formulario de avance precarga `cards.advance_fee` y permite cambiarla.
    - Hoy la RPC de registro toma la comisión de la tarjeta y la de edición la borra y la vuelve a crear desde la tarjeta. Las dos pasan a recibir `advance_fee` en el payload, validado (≥ 0, centavos) y guardado en el movimiento `advance_fee` hijo; al editar se conserva la del avance si no se cambia.
    - `buildCashAdvance` y `buildTransactionPlan` reciben la comisión del formulario en lugar de la de la tarjeta.

## Pruebas

- [x] Compra a 36 cuotas en la cuota 3 que pasa a 1 cuota restante: la siguiente cuota es todo el saldo y desaparecen las demás.
- [x] Compra a 6 cuotas con 1 facturada que pasa a 12 restantes: plan efectivo de 13 cuotas sobre el mismo saldo.
- [x] Compra a 36 cuotas con 10 facturadas que pasa a 36 restantes: plan efectivo de 46, aceptado (D50).
- [x] Más de 36 restantes se rechaza en Zod y en la RPC.
- [x] Avance con comisión distinta a la de la tarjeta: se guarda y suma al extracto correcto; editarlo sin cambiar la comisión la conserva.

## Verificación

```
pnpm typecheck && pnpm lint && pnpm test && pnpm test:coverage
supabase db reset && supabase test db
pnpm build
```

## Criterios de terminado

- Commit: `feat: allow installment changes and per-advance fees`.

## Notas de progreso

<!-- Fecha — nota -->

- 2026-11-21 — Implementado:
    - Migración `20261121020000_installment_changes_advance_fee.sql`:
        - Los cambios de cuotas viven en `principal_prepayments` con `remaining_installments` y `effective_date`, sin monto. Así comparten la invariante, la restauración y el deshacer en orden inverso de abonos y saldos del banco.
        - RPC `change_installments`: valida el plan desde la primera cuota de un corte de hoy en adelante, el límite de 72 cuotas y la invariante en la moneda y en COP.
        - La RPC de registro toma `advance_fee` del payload (la de la tarjeta si no viene; cero o centavos; solo en avances que no están en curso). La de edición la hereda porque crea la nueva versión con ella.
    - Dominio:
        - `lib/domain/installment-changes.ts`: plan nuevo con el método de la tarjeta y la tasa congelada de la compra, en los mismos extractos y luego los siguientes. Intereses estimados antes y después, también en tarjetas sobre saldo.
        - `rebuildRows` en `payments.ts` ahora es común al cambio de cuotas y a la corrección de saldo.
        - `buildTransactionPlan` y `buildCashAdvance` reciben la comisión del avance.
    - Interfaz:
        - "Cambiar cuotas" en el detalle de una compra con cuotas sin facturar: cuotas restantes, saldo por facturar, próxima cuota frente a la actual, plan completo y diferencia de intereses estimada.
        - El cambio aparece en "Cambios del plan" con "Deshacer cambio" si es el más reciente.
        - "Comisión del avance" en el formulario: se precarga con la de la tarjeta al elegir avance o cambiar de tarjeta, y al editar con la del avance.
    - Exportación con las dos columnas nuevas.
- Verificación:
    - 492 pruebas de Vitest con cobertura de dominio al 100 % y 349 de pgTAP (22 nuevas). Las pgTAP usan compras de 2099 para no depender de la fecha.
    - Integración local (`installment-changes-local.integration.test.ts`): plan de TypeScript contra la RPC con intereses por cuota, deshacer, y comisión propia conservada al editar.
    - `db reset`, tipos regenerados y build en verde.
    - Manual contra Supabase local (usuario temporal, borrado) a 360 px en claro y oscuro:
        - Nevera de $600.000 a 6 cuotas, con 2 facturadas, pasada a 12 restantes: próxima cuota $33.333 en lugar de $100.000, plan de 14 cuotas, +$34.305 de intereses estimados. Guardado y deshecho.
        - Avance de $300.000 con comisión de $7.200 en lugar de $15.000: guardado, sumado al extracto y precargado al editar.
        - En 360 × 800, Chrome desplazó elementos bajo la barra inferior fija y un clic automático cayó en la barra. Es un efecto de la prueba automática: la página tiene margen inferior y una persona desplaza.
- Decisiones menores (para revisión del dueño):
    - La próxima cuota sin facturar es la del primer corte de hoy en adelante (el extracto abierto).
    - El último cambio de cuotas se puede deshacer, siempre que no haya un abono o un saldo del banco posterior en esa compra.
    - Una compra con cambio de cuotas solo admite cambiar categoría, comercio y nota, como con abonos.
    - La diferencia de intereses se estima con la tasa congelada de la compra sobre el saldo de cada mes, también en tarjetas sobre saldo.
    - Una comisión en cero no crea el cargo. Quitar la comisión de la tarjeta en un avance ya registrado se hace editándolo.
    - Queda para después la ampliación de plazo de todo el saldo con tasa promedio ponderada, como dice el plan.
