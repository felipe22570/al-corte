# Paso 35 — Importación de los extractos reales

- **Hito PRD:** H10 (parte 9 de 9)
- **Estado:** ⬜ Pendiente
- **Inicio:**
- **Fin:**
- **Commit:**
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

- [ ] Ejecutar primero en Supabase local con un usuario de prueba y luego en producción.
- [ ] Por moneda, la app calcula: Visa $1.178.835,57 y $3.845.774,86; Mastercard $1.706.233,98 y $4.265.727,76; US$8,22 y US$153,26 (el banco redondea hacia arriba a $1.178.836, $3.845.775, $1.706.234, $4.265.728, US$9 y US$154).
- [ ] Cupo disponible cercano al del banco ($6.154.225,14 Visa; $10.528.221,51 Mastercard). Anotar la diferencia y su causa.
- [ ] El mes de diciembre (pago 2 dic) muestra ambos extractos; los meses siguientes proyectan cuotas, suscripciones e intereses estimados.
- [ ] Ejecutar el script dos veces no cambia ningún total.
- [ ] Ningún archivo con datos reales quedó en git (`git status` y `git log -p` del paso).

## Criterios de terminado

- Commit solo de cambios genéricos (por ejemplo, la migración de `statement_override`, `.gitignore` o un generador sin datos): `chore: add statement import tooling`.
- `supabase db reset && supabase test db` en verde con la migración nueva.
- H10 marcado como cerrado en `plans/README.md`.

## Notas de progreso

<!-- Fecha — nota -->
