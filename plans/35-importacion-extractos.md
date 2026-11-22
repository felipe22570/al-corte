# Paso 35 — Importación de los extractos reales

- **Hito PRD:** H10 (parte 9 de 9)
- **Estado:** ✅ Terminado
- **Inicio:** 2026-11-21
- **Fin:** 2026-11-21
- **Commit:** bcd40f8
- **Depende de:** 27 a 34, desplegados en producción
- **Decisiones aplicables (decididas, ver README):** D30, D31, D32, D33, D34, D35, D36, D37, D38, D48, D49

## Objetivo

Cargar en producción las dos tarjetas reales de Bancolombia con su extracto de noviembre de 2026, sus compras en curso y sus suscripciones, y comprobar que todo cuadra con el banco.

## Entrada

`al-corte-import-2026-11.json` (formato `al-corte-import` v1). Contiene información financiera personal: se guarda fuera del repo o en una ruta incluida en `.gitignore`, nunca en un commit.

## Contenido

- Script SQL de un solo uso para el editor SQL de Supabase, generado a partir del JSON, también fuera de git:
    - Variables al inicio con la cuenta por completar (`__PENDIENTE__`); el script se detiene si siguen sin completar o si el usuario no existe.
    - Todo en una transacción. Idempotente: si se ejecuta dos veces no duplica tarjetas, extractos, movimientos ni suscripciones (claves naturales: tarjeta por `last4` y usuario; movimientos por `bank_reference` en la nota o un campo, según proponga el plan).
    - Tarjetas con corte 15, pago 2, `interest_mode = on_balance`, `usd_default_installments = 36`, cuota de manejo 0. La comisión por avance de la Visa queda pendiente (`advance_fee` nulo en el JSON): el dueño la confirma antes de ejecutar.
    - Extracto anterior (corte 2026-10-15) solo como referencia, pagado con los abonos del 30 de octubre por moneda. Extracto de noviembre (corte 2026-11-15, pago 2026-12-02) con `real_minimum` y `real_total` por moneda.
    - Movimientos con `statement_override` asignados al extracto de noviembre aunque R1 diga otra cosa, marcados con `transactions.statement_override = true` (migración de este paso). Intereses normalizados a la fecha de corte.
    - Compras en curso con `prior_installments` y `prior_principal_paid` del JSON y su plan efectivo (incluye los tres saldos irregulares), con la cuota k en el extracto de noviembre (D49) y valores con centavos (D48).
    - USD: `fx_rate` implícita cuando existe; para las filas con `trm_oficial_de_la_fecha_pendiente`, completar con la TRM oficial de cada fecha (datos abiertos de la Superfinanciera) antes de generar el script, y anotar la fuente.
    - Suscripciones activas enlazadas a su primer cobro importado para que el cron no lo duplique. Proton se crea como suscripción diferida a 36 cuotas (paso 31) enlazada a sus dos cobros.
    - Categorías por nombre; las nulas quedan sin categoría.
- Los abonos del 30 de octubre se registran como pagos de tipo "mínimo" del extracto anterior (D37), con `paid_statement_id` en el extracto de octubre y `statement_id` por R1, sin aplicar excedentes a capital.
- Edición posterior: la RPC de edición conserva el extracto de un movimiento con `statement_override` si no cambian fecha ni tarjeta; si cambian, aplica R1 y quita la marca. Prueba SQL incluida.
- `statement_override` se agrega a la exportación.
- Consultas de verificación al final del script.

## Verificación

- [x] Ejecutar primero en Supabase local con un usuario de prueba y luego en producción.
- [x] Por moneda, la app calcula: Visa $1.178.835,57 y $3.845.774,86; Mastercard $1.706.233,98 y $4.265.727,76; US$8,22 y US$153,26 (el banco redondea hacia arriba a $1.178.836, $3.845.775, $1.706.234, $4.265.728, US$9 y US$154).
- [x] Cupo disponible cercano al del banco ($6.154.225,14 Visa; $10.528.221,51 Mastercard). Anotar la diferencia y su causa.
- [x] El mes de diciembre (pago 2 dic) muestra ambos extractos; los meses siguientes proyectan cuotas, suscripciones e intereses estimados.
- [x] Ejecutar el script dos veces no cambia ningún total.
- [x] Ningún archivo con datos reales quedó en git (`git status` y `git log -p` del paso).

## Criterios de terminado

- Commit solo de cambios genéricos (por ejemplo, la migración de `statement_override`, `.gitignore` o un generador sin datos): `chore: add statement import tooling`.
- `supabase db reset && supabase test db` en verde con la migración nueva.
- H10 marcado como cerrado en `plans/README.md`.

## Notas de progreso

<!-- Fecha — nota -->

- 2026-11-21 — Decisiones del dueño (registradas en el README):
    - Comisión por avance por defecto de la Visa: $6.840, la misma de la Mastercard.
    - Los abonos del 30 de octubre solo marcan pagado el extracto de octubre por moneda, en su fecha, sin crear movimientos de pago. Esos abonos pagaron cargos que no están en Al Corte (compras de octubre y cuotas previas); como movimientos, inflarían el cupo en $1.245.225 (Visa) y unos $982.800 (Mastercard).
    - R2: si la cuota redondeada agota el capital antes de la última, se conserva la cuota y el plan termina antes. Hay seis compras pequeñas en USD a 36 cuotas así (por ejemplo, US$ 2,79: 34 de US$ 0,08 y una de US$ 0,07).
    - Prueba solo en local. El push, las migraciones remotas y la ejecución en producción los hace el dueño.
- 2026-11-21 — Implementado (cambios genéricos, sin datos):
    - `.gitignore`: `docs/al-corte-import-*.json` y `private/`. El JSON real y el script generado viven ahí.
    - Migración `20261121030000_statement_import.sql`:
        - `transactions.statement_override` y `transactions.import_key` (única por usuario).
        - La RPC de registro acepta `statement_cutoff_override` solo para movimientos de una cuota, hacia el extracto anterior o siguiente al de R1.
        - La de edición lo conserva si no cambian fecha ni tarjeta y, si cambian, vuelve a R1 sin marca.
    - Migración `20261121040000_rounded_installment_plans.sql`: plan acortado por redondeo en `private.build_installment_rows` (cobros de suscripciones), en las RPC y en las restricciones de `transactions` y `subscriptions`, con el N original guardado. El dominio (`standardSchedule`) y la validación de suscripciones aplican la misma regla. El archivo de casos de paridad TS/SQL tiene un caso nuevo.
    - `InProgressInput.currentPrincipal`: la cuota k que imprime el banco cuando no es la regular. `mc-R53405` es la última de 3, de $77.331,87 con $154.668,13 previos; sin esto, el mínimo de la Mastercard quedaba $1,47 por encima. El formulario no lo pide; solo lo usa la importación.
    - `lib/import/statement-import.ts`:
        - Genera el script con `buildTransactionPlan` y las RPC de la app, corriendo como el usuario (`set local role authenticated`, RLS y validaciones).
        - Una transacción, cuenta `__PENDIENTE__` verificada, claves `import_key` para no duplicar y comprobación de las condiciones de las tarjetas si ya existen.
        - Comisión del avance con su avance, valores del banco por moneda, suscripciones enlazadas a sus cobros (`source = 'subscription'`, Proton diferida a 36) y consulta de verificación al final.
        - Mapea los nombres anteriores al paso 27: `installments_count` del archivo es el plan efectivo y `installments_count_original` el N.
        - Avisa las diferencias con el banco.
    - `lib/import/trm.ts`: la TRM oficial de cada día a partir de los periodos de vigencia (datos.gov.co, conjunto 32sa-8pi3, consultado el 2026-11-21 y guardado en `private/trm-datos-gov-co.json`).
    - Exportación con las dos columnas nuevas.
- Verificación:
    - 505 pruebas de Vitest con cobertura de dominio al 100 %, 368 de pgTAP, e integración local de meses, pagos, cierre, cambio de cuotas e importación (archivo sintético ejecutado dos veces).
    - `db reset`, tipos regenerados y build en verde.
    - Script real contra Supabase local con un usuario temporal (borrado), dos veces: 84 movimientos, 6 suscripciones y 2 tarjetas, sin duplicados ni cambios entre corridas. El generador no reportó diferencias con el banco.
        - Visa: mínimo $1.178.835,57, deuda $3.845.774,86 y cupo $6.154.225,14, igual al banco.
        - Mastercard: $1.706.233,98, $4.265.727,76, US$ 8,22 y US$ 153,26. El cupo de $10.548.293,41 difiere en $20.071,90 del banco porque el saldo en dólares se valora con la TRM de cada compra (D3) y el banco usa la suya.
        - En la app (360 px): noviembre pagado; diciembre con ambos extractos al mínimo del banco; enero y siguientes con cuotas, suscripciones e intereses estimados; aviso de cierre de ambos extractos.
- Para producción (dueño):
    1. Push de `main`, despliegue en Vercel y `supabase db push` de las migraciones de los pasos 27 a 35.
    2. Generar el script (queda en `private/`): `AL_CORTE_IMPORT_JSON=docs/al-corte-import-2026-11.json AL_CORTE_IMPORT_TRM=private/trm-datos-gov-co.json AL_CORTE_IMPORT_OUT=private/al-corte-import-2026-11.sql AL_CORTE_IMPORT_ADVANCE_FEES=visa=6840 pnpm vitest run lib/import/__tests__/generate-import.run.test.ts`.
    3. Cambiar `__PENDIENTE__` por el correo de la cuenta, ejecutar el archivo completo en el editor SQL de Supabase y comparar la tabla final con el extracto.
    4. Conciliar ambos extractos desde la app (aviso "Revisa los extractos").
    5. El cobro diario recupera los cobros de suscripciones de los últimos 7 días que no estén en el archivo (por ejemplo, DirecTV el 19 de noviembre o Proton el 16), con su fecha.
- 2026-11-21 — Producción:
    - Push de `main` (hasta `bcd40f8`) y `supabase db push` de las 6 migraciones pendientes (`20261119020000` a `20261121040000`); `migration list --remote` sin pendientes.
    - El dueño ejecutó el script en el editor SQL de Supabase, comparó la tabla final con sus extractos y concilió ambos desde la app; confirma que todo quedó bien.
    - Paso cerrado y H10 terminado.
