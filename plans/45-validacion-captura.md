# Paso 45 — Validación de H12

- **Hito PRD:** H12 (parte 6 de 6)
- **Estado:** 🟡 En progreso
- **Inicio:** 2026-11-24
- **Fin:**
- **Commit:**
- **Depende de:** 40 a 44, desplegados
- **Decisiones aplicables (decididas, ver README):** D42–D47

## Objetivo

Comprobar en producción que la captura funciona, que es segura y que no altera ningún cálculo hasta confirmar.

## Verificación

En producción, solo lo que las pruebas automáticas no pueden cubrir (simplificado el 27 de noviembre de 2026, ver registro de decisiones):

- [ ] Una semana de uso real (25 nov – 1 dic): porcentaje de alertas de tarjeta de crédito que llegan como borrador y porcentaje confirmado sin cambios (`changed_fields`). Anotar en las notas.
- [ ] Apagar la captura desde Ajustes rechaza nuevas solicitudes (`pnpm probe:ingest <url> --capture-off` da 403) y encenderla la recupera.
- [ ] Gasto de IA del periodo dentro del tope.
- [x] `pnpm test:ai` con resultados anotados (24 nov, ver notas).
- [ ] Revisión del dueño en el celular, de la alerta a la confirmación.

Cubierto por pruebas automáticas y por el uso real, sin repetirlo en producción:

- Firma ausente, inválida o vieja, cuerpo grande y solicitud repetida: pruebas de `lib/ingest` y pgTAP `230-alert-ingest`, probe local del 24 nov (7/7). En producción, una solicitud sin firma ya dio 401 y las firmadas por el script crean borradores, lo que confirma el secreto de Vercel.
- Correo reenviado o con encabezados falsos: el script solo busca los remitentes exactos del banco y exige DKIM del dominio del remitente en el encabezado de Google (pruebas del paso 44). Un borrador nunca se confirma solo.
- Logs sin frases ni respuestas del modelo: el código no los escribe (revisado en local en los pasos 42 y 43 y en el probe del 24 nov); `ai_usage` no tiene columnas de contenido.
- Borradores fuera de totales, meses y cupo: pgTAP `220-transaction-drafts` y la prueba de lectores de `transaction_drafts`; ninguna vista los lee.
- Rotación del secreto y revocación del acceso de Google: procedimientos documentados en `integrations/apps-script/README.md`, con `pnpm probe:ingest --rotation` para comprobar la rotación cuando haga falta. La revocación la garantiza Google.

## Criterios de terminado

- H12 marcado como cerrado en `plans/README.md`.
- Commit: `chore: close H12 email capture`.

## Notas de progreso

<!-- Fecha — nota -->

2026-11-24 — Plan aprobado (ver registro de decisiones). Preparación:
- `changed_fields` en `transaction_drafts` (migración `20261124010000_draft_changed_fields.sql`): `capturedChanges` en `lib/draft-form.ts` compara lo que propuso la captura (tarjeta, tipo, fecha, valor, moneda, comercio y las sugerencias de categoría, cuotas e internacional) con lo confirmado. `confirmDraft` carga la propuesta con `loadDraftProposal` y la RPC guarda los nombres, sin repetir, en la misma transacción. La llamada anterior sin la lista sigue funcionando. pgTAP `240-draft-changed-fields.test.sql` y pruebas de Vitest para la función, la consulta y la acción.
- `scripts/ingest-probe.mjs` (`pnpm probe:ingest <url> [--capture-off | --rotation]`): pide el secreto sin mostrarlo, imprime solo códigos y resultados. Probado contra `pnpm start` local con Supabase local, un usuario y un secreto temporales (borrados al terminar): 7/7 en modo normal (sin firma, otro secreto y firma de 6 minutos dan 401; 5 KB da 413; alerta sin tarjeta da `ignored`; alerta de prueba `created` y repetida `duplicate`), 7/7 con la captura apagada (403) y rotación 2/2. Un solo borrador creado y ninguna frase en el log del servidor.
- Evals: nuevo caso de `extractUnknownAlert` con el formato real del avance virtual (coma de miles, hora antes de la fecha, "T.Credito" y otra cuenta `*0000`). `pnpm test:ai` (claude-opus-5-5, 24 nov): `smokeCheck` 4 casos al 100 % (US$0,012); `interpretTransactionAlert` 5 casos: subscriptionId 4/4, categoryId 3/3, installmentsCount 5/5, billingCurrency 4/4, isInternational 2/2; `extractUnknownAlert` 5 casos: type, amountText, currency y dateText 5/5, timeText y last4 4/4; verificación literal 5/5. Costo acumulado US$0,125. Sin cambios de prompt ni de modelo.

2026-11-27 — Verificación simplificada por decisión del dueño: en producción quedan la semana de uso, el interruptor de captura, el gasto de IA y la revisión en el celular. Lo demás queda como cubierto por pruebas automáticas y procedimientos documentados (ver la sección de verificación).
