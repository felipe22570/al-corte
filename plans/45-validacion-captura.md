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

- [ ] Una semana de uso real: porcentaje de alertas de tarjeta de crédito que llegan como borrador y porcentaje confirmado sin cambios. Anotar en las notas.
- [ ] Seguridad:
    - [ ] solicitud sin firma o con firma vieja rechazada;
    - [ ] repetir una solicitud válida no crea otro borrador;
    - [ ] un correo reenviado por otra persona con el texto de una alerta no pasa el filtro DKIM;
    - [ ] ningún log contiene frases de alertas ni respuestas del modelo;
    - [ ] apagar la captura desde Ajustes rechaza nuevas solicitudes;
    - [ ] rotar el secreto con el procedimiento documentado (Vercel, despliegue y script) invalida el anterior (D51).
    - [ ] revocar el acceso del script desde la cuenta de Google detiene la captura y `installTrigger` la recupera (viene del paso 44).
- [ ] Ningún borrador pendiente cambia totales, meses ni cupo.
- [ ] Gasto de IA del periodo dentro del tope.
- [x] `pnpm test:ai` con resultados anotados (24 nov, ver notas).
- [ ] Revisión del dueño en el celular, de la alerta a la confirmación.

## Criterios de terminado

- H12 marcado como cerrado en `plans/README.md`.
- Commit: `chore: close H12 email capture`.

## Notas de progreso

<!-- Fecha — nota -->

2026-11-24 — Plan aprobado (ver registro de decisiones). Preparación:
- `changed_fields` en `transaction_drafts` (migración `20261124010000_draft_changed_fields.sql`): `capturedChanges` en `lib/draft-form.ts` compara lo que propuso la captura (tarjeta, tipo, fecha, valor, moneda, comercio y las sugerencias de categoría, cuotas e internacional) con lo confirmado. `confirmDraft` carga la propuesta con `loadDraftProposal` y la RPC guarda los nombres, sin repetir, en la misma transacción. La llamada anterior sin la lista sigue funcionando. pgTAP `240-draft-changed-fields.test.sql` y pruebas de Vitest para la función, la consulta y la acción.
- `scripts/ingest-probe.mjs` (`pnpm probe:ingest <url> [--capture-off | --rotation]`): pide el secreto sin mostrarlo, imprime solo códigos y resultados. Probado contra `pnpm start` local con Supabase local, un usuario y un secreto temporales (borrados al terminar): 7/7 en modo normal (sin firma, otro secreto y firma de 6 minutos dan 401; 5 KB da 413; alerta sin tarjeta da `ignored`; alerta de prueba `created` y repetida `duplicate`), 7/7 con la captura apagada (403) y rotación 2/2. Un solo borrador creado y ninguna frase en el log del servidor.
- Evals: nuevo caso de `extractUnknownAlert` con el formato real del avance virtual (coma de miles, hora antes de la fecha, "T.Credito" y otra cuenta `*0000`). `pnpm test:ai` (claude-opus-5-5, 24 nov): `smokeCheck` 4 casos al 100 % (US$0,012); `interpretTransactionAlert` 5 casos: subscriptionId 4/4, categoryId 3/3, installmentsCount 5/5, billingCurrency 4/4, isInternational 2/2; `extractUnknownAlert` 5 casos: type, amountText, currency y dateText 5/5, timeText y last4 4/4; verificación literal 5/5. Costo acumulado US$0,125. Sin cambios de prompt ni de modelo.
