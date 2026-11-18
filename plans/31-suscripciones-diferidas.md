# Paso 31 — Suscripciones diferidas y cuotas por defecto en USD

- **Hito PRD:** H10 (parte 5 de 9)
- **Estado:** ⬜ Pendiente
- **Inicio:**
- **Fin:**
- **Commit:**
- **Depende de:** 29, 30
- **Decisiones aplicables (decididas, ver README):** D4, D20, D34, D35, D48

## Objetivo

Registrar suscripciones que el banco difiere a cuotas, como las cobradas en dólares (F13, R8). Priorizado por el dueño.

## Contenido

- Migración: `cards.usd_default_installments smallint not null default 1` (1 a 36) y `subscriptions.installments_count smallint not null default 1` (1 a 36).
- Formulario de gasto: al elegir USD se precargan las cuotas por defecto de la tarjeta.
- Formulario de suscripción: campo de cuotas; en USD se precarga el valor de la tarjeta.
- Cron y RPC de cobros: cada cobro se registra como compra a N cuotas con la tasa de la tarjeta y su modo de intereses. Mantener idempotencia por `(subscription_id, date)`.
    - El cron corre en SQL (`generate_subscription_charge_on`) y hoy inserta compras a una cuota sin filas de cuotas. Para N > 1 hace falta generar el plan en SQL: función privada `private.build_installment_rows` para `fixed_principal` y `french`, con interés 0 en `on_balance`, centavos (D48) y la última cuota absorbiendo el redondeo.
    - Pruebas de paridad: un archivo de fixtures compartido que validan tanto Vitest (`buildInstallmentPlan`) como pgTAP (la función SQL), para que ambas implementaciones den las mismas cuotas.
    - No se mueve el cron a Vercel ni a una Edge Function (sección 9 del PRD).
- Desglose: las cuotas de un cobro diferido cuentan como "Cuotas" por concepto (R5) y con la categoría de la suscripción.
- Proyección (`months.ts`): cada cobro previsto aporta su cuota a los extractos siguientes; las cuotas de cobros sucesivos se acumulan dentro del horizonte.
- Lista de suscripciones: el costo mensual muestra la cuota efectiva y, aparte, el valor de cada cobro.

## Pruebas

- [ ] Suscripción de US$12,99 a 36 cuotas: el primer mes proyecta una cuota, el segundo dos y así sucesivamente, nunca el valor completo.
- [ ] Una suscripción a una cuota se comporta igual que antes.
- [ ] El cron no duplica cobros al repetirse.
- [ ] Paridad SQL/TypeScript: mismas cuotas para los fixtures compartidos (COP y USD, ambos métodos, `on_balance`).
- [ ] Exportación con las dos columnas nuevas.

## Verificación

```
pnpm typecheck && pnpm lint && pnpm test && pnpm test:coverage
supabase db reset && supabase test db
pnpm build
```

## Criterios de terminado

- Commit: `feat: add deferred subscriptions and USD default installments`.

## Notas de progreso

<!-- Fecha — nota -->
