# Paso 38 — Importación mensual de extractos

- **Hito PRD:** H11 (parte 3 de 4)
- **Estado:** 🟡 En progreso
- **Inicio:** 2026-11-21
- **Fin:**
- **Commit:**
- **Depende de:** 35, 36
- **Decisiones aplicables (decididas, ver README):** D1, D4, D30, D31, D36, D37, D39, D49, D55, D57

## Objetivo

Cargar desde Ajustes el extracto de cada mes con un archivo `al-corte-import` v1, revisando antes de guardar (F22, R11). Incluye la TRM diaria en `fx_rates` (D57), que necesitan esta importación y el paso 39.

## Contenido

### 1. TRM diaria (D57)

Hoy `fx_rates` solo tiene datos en el seed y en las pruebas: nada la llena en producción, y `lib/import/trm.ts` solo expande un JSON ya descargado.

- Migración: `fx_rates.valid_from date` (inicio del periodo de vigencia, `vigenciadesde`). Se mantiene una fila por día calendario, así D4 no cambia.
- Función SQL `refresh_fx_rates()` con la extensión `http` (antes Edge Function `fx-rates`; cambio aprobado el 21 de noviembre) llamada por `pg_cron` a las 6:00 a. m. de Bogotá (11:00 UTC). Consulta datos.gov.co (conjunto 32sa-8pi3), expande cada periodo con `trmByDate` y hace upsert de los últimos 30 días: idempotente, recupera fines de semana, festivos y días en que falló.
- Carga inicial desde el 1 de enero de 2026, con la misma función.
- Helper de dominio `trmForStatement(rates, cutoffDate)`: la TRM vigente el último día hábil antes del corte = la del día anterior a `valid_from` del periodo que contiene el corte (D52). No hace falta un calendario de festivos.
- Si la consulta falla, no se inventa nada: queda la última TRM guardada y las vistas avisan lo que corresponda (D4, D33).

### 2. Formato y origen del archivo

- `docs/import-format.md`: especificación del formato v1 tal como lo consume `lib/import/statement-import.ts` (campos obligatorios, tipos, convenciones de compras en curso, `statement_override`, monedas y TRM), qué secciones usa la importación mensual y un ejemplo ficticio. Sin datos reales.
- El archivo de cada mes se prepara fuera de la app a partir del PDF del banco, como en el paso 35, siguiendo `docs/import-format.md`. La lectura del PDF dentro de la app es v3.
- Secciones que usa la importación mensual:
    - `cards`: solo para identificar la tarjeta por `last4`. Tarjeta desconocida → error claro, sin importar nada. Condiciones distintas de las guardadas (corte, tasas, modo) → aviso, sin cambiarlas.
    - `statements`: el extracto del archivo (no los de referencia) y sus valores del banco por moneda.
    - `transactions`: los movimientos, con las reglas de identidad de abajo.
    - `payments`: solo para comparar (ver identidad).
    - Se ignoran `subscriptions`, `pending_subscriptions`, extractos `reference_only`, `anomalies` y notas: las suscripciones se administran en la app.

### 3. Servidor

- Server Action que recibe el archivo (máximo 1 MB, solo JSON), lo valida con Zod y lo procesa en memoria; nunca lo guarda ni lo registra en logs.
- TRM para filas en USD sin tasa: la de `fx_rates` en la fecha del movimiento. Si falta, la fila no se puede importar y se indica.
- Identidad (R11, D55). Cada fila queda como nueva, ya registrada o en conflicto:
    - por `import_key` (clave del archivo, derivada de la referencia del banco) en la misma tarjeta; las compras en curso de meses anteriores se reconocen así;
    - sin clave: tarjeta, fecha, valor, moneda y nombre normalizado (paso 36);
    - cobros de suscripciones: una fila coincide con el cobro que creó el cron (`subscription_id` no nulo) si son de la misma tarjeta, moneda y valor y la fecha está a 7 días o menos. Mismo cobro con otro valor → conflicto ("DirecTV cobró $140.910; tu suscripción dice $83.350");
    - cargos del extracto (`interest`, `handling_fee`, `insurance`): se comparan por tarjeta, extracto, tipo y moneda. La cuota de manejo de D1 ya existe; un interés registrado en el cierre mensual también. Mismo valor → ya registrado; otro valor → conflicto que se resuelve en el cierre mensual (F15), no en la importación;
    - pagos: nunca se importan (necesitan tipo y reparto, D37). Si hay un pago registrado con igual tarjeta, fecha, valor y moneda → ya registrado; si no → "Pago sin registrar", con enlace al formulario de pago;
    - mismo valor, tarjeta y fecha pero distinto en el resto → conflicto.
- Conflictos: el dueño elige "Es el mismo" o "Importar como nuevo". "Es el mismo" solo guarda el `import_key` en el movimiento existente (si no tenía uno), para que el mes siguiente se reconozca solo. No cambia montos, fechas, cuotas, categoría ni extracto.
- Asignaciones forzadas de extracto (D30) solo dentro del periodo del extracto del archivo.
- Guardado en una sola transacción con una RPC por lotes nueva (migración), `import_statement_file(p_payload jsonb, p_dry_run boolean)`. Desde una Server Action no se pueden agrupar varias llamadas a RPC en una transacción. Por dentro llama a las RPC existentes (`create_transaction_with_installments` con el payload de `importPayload`), enlaza los conflictos aceptados y guarda los valores del banco del extracto en `statement_balances` solo si están vacíos (sin tocar `reconciled_at`). Si ya hay otros, se muestra la diferencia.
- Verificación antes de guardar con `p_dry_run = true`: la misma RPC ejecuta todo en un bloque con excepción propia y devuelve pago mínimo, deuda total y cupo resultantes antes de deshacer los cambios. Antes y después se usa el mismo código.

### 4. Interfaz en Ajustes ("Importar extracto")

- Componente de revisión reutilizable (`components/import-review.tsx` o similar), pensado para la bandeja de H12: filas con estado nuevo, ya registrado, en conflicto o pago sin registrar, casilla para incluir y detalle de la diferencia.
- Verificación: pago mínimo, deuda total y cupo calculados frente a los del banco, antes de guardar y después.
- Después de guardar, enlace al cierre mensual del extracto, que muestra prellenados los valores del banco guardados. Marcarlo conciliado sigue siendo decisión del dueño.
- Solo agrega: no edita, borra ni reemplaza movimientos existentes, salvo guardar el `import_key` al enlazar un conflicto.

## Pruebas

- [x] TRM: la función es idempotente; un fin de semana y un festivo toman el valor de su periodo; `trmForStatement` da $3.301,91 para el corte del 15 nov 2026 (periodo del 14 al 17 nov).
- [x] Importar el mismo archivo dos veces no crea duplicados.
- [x] Un movimiento registrado a mano con los mismos datos aparece como "ya registrado"; uno con igual tarjeta, fecha y valor pero otro comercio, como conflicto.
- [x] "Es el mismo" guarda solo el `import_key`; el mes siguiente la misma compra se reconoce sin conflicto.
- [x] Un cobro de suscripción creado por el cron un día antes que la fecha del banco aparece como ya registrado; con otro valor, como conflicto.
- [x] La cuota de manejo de D1 y un interés ya registrado en el cierre no se duplican.
- [x] Un pago del archivo nunca crea un movimiento.
- [x] Una compra en curso del archivo que no está en la app crea su plan con D31 y D49; una ya importada el mes anterior se reconoce por `import_key`.
- [x] La vista previa (`p_dry_run`) no deja cambios en la base y da los mismos totales que el guardado real.
- [x] Archivo inválido, demasiado grande, con tarjeta desconocida o con USD sin TRM → error sin cambios en la base.
- [x] Ningún log contiene el contenido del archivo.

## Verificación

```
pnpm typecheck && pnpm lint && pnpm test && pnpm test:coverage
supabase db reset && supabase test db
pnpm build && pnpm start
```

- [ ] La función de TRM corre en producción y `fx_rates` tiene la TRM de hoy y la carga inicial.
- [ ] Con el extracto de diciembre del dueño: vista previa, importación, verificación contra el banco y cierre mensual.

## Criterios de terminado

- Commits: `feat: load daily TRM into fx_rates` y `feat: import monthly statements from file`.

## Notas de progreso

<!-- Fecha — nota -->

- 2026-11-21 — Parte 1 (`79bee97`, `feat: load daily TRM into fx_rates`). D57 cambió con aprobación del dueño: en lugar de una Edge Function, `private.refresh_fx_rates()` consulta datos.gov.co con la extensión `http` y `pg_cron` la llama a las 11:00 UTC. `private.upsert_fx_rates()` expande cada periodo por días, es idempotente y rechaza el lote completo ante una fila inválida. Guarda días solo hasta hoy en Bogotá: así "la fila más reciente" (D4) sigue siendo la TRM de hoy, sin tocar a quienes la leen. `fx_rates.valid_from` (un trigger la llena con la fecha en filas escritas a mano). `trmForStatement` en `lib/domain/fx.ts` da $3.301,91 para el corte del 15 de noviembre. En local se cargó desde el 1 de enero (326 días) y la segunda corrida no cambió nada. Exportación con `valid_from`.
- 2026-11-21 — Parte 2. Formato en `docs/import-format.md` (su ejemplo se valida en las pruebas). `lib/import/monthly-file.ts` (Zod, 1 MB, errores sin eco del contenido), `lib/domain/import-identity.ts` (identidad D55, cobertura 100 %), `lib/import/monthly-review.ts` (revisión y payloads con la tarjeta guardada; `importPlanPayload` se extrajo de `importPayload` del paso 35 sin cambiar el script), `lib/queries/import-context.ts`, `lib/import/run-monthly-import.ts`, Server Actions en `lib/actions/statement-import.ts`, RPC `import_statement_file(p_payload, p_dry_run)` (la vista previa corre el mismo código dentro de un bloque que se deshace con un código de error propio). Interfaz en `/ajustes/importar` con `ImportReview` (reutilizable en H12) e `ImportVerification`; enlace desde Ajustes. `serverActions.bodySizeLimit` en 2 MB para que el control de 1 MB responda con su mensaje.
- Decisiones menores: una línea en USD sin TRM, una comisión sin su avance o un plan imposible quedan como "No se pueden importar" sin bloquear el resto del archivo. Un cobro de suscripción con el mismo valor a 7 días se reconoce aunque el nombre cambie; con otro valor es conflicto solo si el nombre coincide (aprobado). Los cargos del extracto se comparan antes que los datos generales. La tarjeta desconocida, un JSON inválido, un archivo grande o decisiones inválidas devuelven un error sin cambios. Los pagos de un extracto de referencia aparecen como "sin registrar" (informativo).
- Pruebas: pgTAP 180 (TRM) y 190 (RPC: vista previa sin cambios, guardado, idempotencia, enlace solo con clave, valores del banco solo si están vacíos, error con la clave de la fila, otro dueño). Vitest: identidad (10), archivo y revisión (7), interfaz (4), integración local del flujo completo (cobro de suscripción del día anterior, DirecTV con otro valor, cuota de manejo D1, interés ya registrado, compra en curso, enlace, reimportación, mes siguiente por clave, errores). 581 de Vitest y cobertura de dominio 100 %. Se ajustó la prueba de integración de pagos y la pgTAP 130 para no depender de que no exista una TRM más reciente, porque el cron diario también corre en local.
- Archivo real de noviembre en vista previa contra la base local: 83 movimientos ya registrados, 0 nuevos y 3 pagos sin registrar (los marcados en el paso 35); pago mínimo y deuda total cuadran con el banco dentro del redondeo.
- Revisión en navegador (local, 360 px, oscuro y claro) con un archivo sintético para la Visa local: grupos, verificación que se recalcula al desmarcar una línea y base sin cambios después de la vista previa.
- `supabase test db` sobre la base local con los datos reales del dueño: 070, 130 y 140 fallan por esos datos (cobros de sus suscripciones y más de una tarjeta), como antes de este paso; 180 y 190 pasan. Falta `supabase db reset` sobre una base limpia, pendiente de aprobación del dueño porque borra sus datos locales.
- Pendiente del dueño en producción: `db push`, `select private.refresh_fx_rates('2026-01-01');` en el editor SQL, comprobar que `fx_rates` tiene la TRM de hoy y probar con el extracto de diciembre.
