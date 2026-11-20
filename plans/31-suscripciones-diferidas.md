# Paso 31 — Suscripciones diferidas y cuotas por defecto en USD

- **Hito PRD:** H10 (parte 5 de 9)
- **Estado:** ✅ Terminado
- **Inicio:** 2026-11-19
- **Fin:** 2026-11-19
- **Commit:** `feat: add deferred subscriptions and USD default installments` (ver historial de git)
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

- [x] Suscripción de US$12,99 a 36 cuotas: el primer mes proyecta una cuota, el segundo dos y así sucesivamente, nunca el valor completo.
- [x] Una suscripción a una cuota se comporta igual que antes.
- [x] El cron no duplica cobros al repetirse.
- [x] Paridad SQL/TypeScript: mismas cuotas para los fixtures compartidos (COP y USD, ambos métodos, `on_balance`).
- [x] Exportación con las dos columnas nuevas.

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

- 2026-11-19 — Implementado:
    - Migración `20261119010000_deferred_subscriptions.sql`: `cards.usd_default_installments`, `subscriptions.installments_count` con un `check` que exige que el valor alcance para las cuotas, `private.build_installment_rows` (plan en SQL, igual a `buildInstallmentPlan`) y `generate_subscription_charge_on`, que registra cada cobro como compra a N cuotas con la tasa, el método y el modo de intereses de la tarjeta.
    - Paridad: `lib/domain/__tests__/fixtures/installment-parity.json` (9 casos: COP y USD, ambos métodos, sobre saldo, sin intereses y corte el 31). Lo validan Vitest (`installment-parity.test.ts`) y pgTAP (`120-installment-parity.test.sql`, generado con `node scripts/generate-installment-parity-test.mjs`; Vitest falla si el SQL no está sincronizado con el fixture).
    - Dominio: `projectStatements` reparte cada cobro diferido previsto en una cuota por extracto (concepto "Cuotas", categoría de la suscripción). En tarjetas sobre saldo estima el interés de las cuotas previstas, salvo que el extracto ya tenga interés real.
    - Interfaz: "Cuotas por defecto en USD" en Ajustes; el formulario de gasto y el de suscripción las precargan al elegir USD (y, en suscripciones, al cambiar de tarjeta con USD). Campo "Cuotas de cada cobro". La lista muestra la cuota y, aparte, el valor del cobro. Exportación con las dos columnas nuevas.
- Verificación:
    - 424 pruebas de Vitest con cobertura de dominio al 100 %, 248 de pgTAP, integración local de meses y build en verde.
    - Manual contra Supabase local (usuario temporal, borrado) en un Chrome headless propio, a 360 px en claro y oscuro: el cron registró ChatGPT (US$12,99) a 36 cuotas en una Mastercard sobre saldo. Enero muestra US$ 0,36; febrero US$ 0,99 (dos cuotas y US$ 0,27 de intereses estimados). La lista muestra "US$ 0,36 por cuota · cobro de US$ 12,99 a 36 cuotas".
    - La precarga de cuotas al elegir USD no tiene prueba automática (el selector no se puede accionar en el render estático) ni se probó a mano.
- Decisiones menores (para revisión del dueño):
    - El costo mensual y anual de suscripciones sigue sumando el valor de cada cobro (su costo real), con una nota. La cuota efectiva se muestra en cada suscripción.
    - Los cobros a una cuota no cambian (sin tasa aplicada ni filas de cuotas). Los diferidos guardan la tasa de compras vigente de la tarjeta.
    - Si el plan de un cobro es imposible, el cron lo omite (devuelve 0) en vez de detener la corrida de las demás suscripciones. El `check` de la tabla y la validación Zod lo evitan de entrada.
    - La cuota mostrada en la lista se calcula con las condiciones actuales de la tarjeta y la última TRM; los cobros reales usan las de su día.
    - Las cuotas previstas más allá del horizonte de 12 meses no activan el aviso de compromisos posteriores, porque aún no son cargos reales.
