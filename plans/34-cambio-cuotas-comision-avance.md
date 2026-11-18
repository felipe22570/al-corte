# Paso 34 — Cambio de cuotas y comisión de avance por movimiento

- **Hito PRD:** H10 (parte 8 de 9)
- **Estado:** ⬜ Pendiente
- **Inicio:**
- **Fin:**
- **Commit:**
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

- [ ] Compra a 36 cuotas en la cuota 3 que pasa a 1 cuota restante: la siguiente cuota es todo el saldo y desaparecen las demás.
- [ ] Compra a 6 cuotas con 1 facturada que pasa a 12 restantes: plan efectivo de 13 cuotas sobre el mismo saldo.
- [ ] Compra a 36 cuotas con 10 facturadas que pasa a 36 restantes: plan efectivo de 46, aceptado (D50).
- [ ] Más de 36 restantes se rechaza en Zod y en la RPC.
- [ ] Avance con comisión distinta a la de la tarjeta: se guarda y suma al extracto correcto; editarlo sin cambiar la comisión la conserva.

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
