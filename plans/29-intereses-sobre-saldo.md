# Paso 29 — Intereses sobre saldo

- **Hito PRD:** H10 (parte 3 de 9)
- **Estado:** ⬜ Pendiente
- **Inicio:**
- **Fin:**
- **Commit:**
- **Depende de:** 27
- **Decisiones aplicables (decididas, ver README):** D27, D32, D48

## Objetivo

Que las tarjetas que cobran intereses sobre saldo (Bancolombia, Davivienda, BBVA) se calculen como en el banco (F11, R8).

## Contenido

- Migración: `cards.interest_mode` (`per_installment` por defecto, `on_balance`). Solo se puede cambiar mientras la tarjeta no tenga compras a varias cuotas: lo hace cumplir un trigger en la base, no solo la interfaz, que explica por qué está bloqueado.
- En `on_balance`, el registro de compras genera cuotas solo de capital (interés 0). La RPC de registro rechaza cuotas con interés en tarjetas `on_balance`, aunque el cliente las envíe.
- Intereses del extracto: si existe un cargo `interest` real, se usa ese. Si no, `lib/domain` calcula una estimación no guardada (R8) y la vista la etiqueta "Intereses estimados".
- Registrar los intereses reales desde el detalle del extracto con un formulario corto (valor y moneda).
- Proyección de meses (`months.ts`): extractos reales sin interés registrado y extractos virtuales usan la estimación sobre el capital pendiente proyectado.
- Ajustes de tarjeta: selector del modo con una ayuda breve ("Bancolombia cobra intereses sobre el saldo en una sola línea").
- Exportación: `cards.interest_mode` en `lib/export-schema.ts`.
- La estimación es en centavos (D48) y, para compras en USD, en dólares. El prorrateo por días tras un abono (R9) llega en el paso 32.

## Pruebas

- [ ] Estimación con compras con interés, sin interés, a una cuota y avances, con tasas distintas por compra.
- [ ] El interés real reemplaza al estimado sin duplicarlo en el total del mes.
- [ ] Una tarjeta `per_installment` no cambia su comportamiento.
- [ ] La RPC rechaza una cuota con interés en una tarjeta `on_balance`; el trigger impide cambiar el modo con compras a varias cuotas.
- [ ] Contraste con noviembre: la estimación queda en el orden de magnitud de los intereses reales ($29.457,05 Visa, $38.172,61 Mastercard); anotar la diferencia en las notas, sin forzar el cálculo para que coincida.

## Verificación

```
pnpm typecheck && pnpm lint && pnpm test && pnpm test:coverage
supabase db reset && supabase test db
pnpm build
```

## Criterios de terminado

- Commit: `feat: add on-balance interest mode with estimates`.

## Notas de progreso

<!-- Fecha — nota -->
