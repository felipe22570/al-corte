# Paso 41 — Borradores por confirmar

- **Hito PRD:** H12 (parte 2 de 6)
- **Estado:** ✅ Terminado
- **Inicio:** 2026-11-22
- **Fin:** 2026-11-22
- **Commit:** 83e1632
- **Depende de:** 40; 38 (componente de revisión de importaciones)
- **Decisiones aplicables (decididas, ver README):** D46, D47

## Objetivo

Una bandeja "Por confirmar" para movimientos capturados automáticamente, separada de los movimientos reales (F18).

## Contenido

- Migración: tabla `transaction_drafts` con RLS por `user_id`: origen (`email_alert`), identificador externo único, frase original, campos extraídos por reglas, sugerencias de IA (JSON validado), tarjeta asignada o nula, estado (`pending`, `needs_review`, `unknown_card`, `confirmed`, `discarded`) y fechas.
- Ninguna consulta de extractos, meses, totales ni cupo lee esta tabla.
- Nombres: ya existe `lib/transaction-draft.ts`, que guarda en `sessionStorage` el borrador del formulario de gasto. Se renombra a `lib/transaction-form-draft.ts` (con sus pruebas e imports) para que "borrador" en código se refiera solo a los capturados.
- Vista `/por-confirmar`. No es un quinto destino de la navegación (D25): el contador aparece solo cuando hay borradores, como un aviso en Meses que enlaza a la bandeja; la ubicación exacta se valida con el dueño antes de implementarla. Cada borrador muestra los datos del correo, las sugerencias marcadas como tales (con su nivel de confianza) y avisos como "DirecTV cobró $140.910; tu suscripción dice $83.350".
- Confirmar abre el formulario de gasto prellenado (cuotas, categoría, moneda de facturación, compra en curso). Al guardar se crea el movimiento real con `source = email`, se marca el borrador como confirmado y se borra la frase original.
- Descartar borra la frase original y conserva solo el identificador para no volver a crear el borrador.
- Duplicados: si existe un movimiento de la misma tarjeta, valor y fecha, se ofrece "Es el mismo" para enlazarlos sin crear otro (columna `transaction_id` del borrador).
- Exportación: los borradores no se exportan, porque pueden contener la frase original del correo; se anota en Ajustes junto a la exportación.

## Pruebas

- [x] Un borrador pendiente no cambia ningún total del mes ni el cupo.
- [x] Confirmar crea exactamente un movimiento y vacía la frase original.
- [x] El mismo identificador externo nunca crea dos borradores.

## Verificación

```
pnpm typecheck && pnpm lint && pnpm test && pnpm test:coverage
supabase db reset && supabase test db
pnpm build && pnpm start
```

## Criterios de terminado

- Commit: `feat: add drafts inbox for captured transactions`.

## Notas de progreso

<!-- Fecha — nota -->

2026-11-22 — Plan aprobado con la recomendación del dueño: aviso neutro en Meses, borrado de frase, sugerencias y datos extraídos al resolver, y descartados sin recuperación (ver registro de decisiones).

2026-11-22 — Implementado:
- Migración `20261122050000_transaction_drafts.sql`. La tabla tiene RLS, la sesión solo lee y actualiza y no inserta ni borra. Restricciones `check`: un borrador resuelto no guarda frase, sugerencias ni datos del correo (D47); uno pendiente tiene tarjeta, tipo, valor, moneda y fecha; `unknown_card` va sin tarjeta. Índice único por `(user_id, source, external_id)` y otro por `transaction_id`. Un trigger exige que la tarjeta sea del dueño y que un borrador resuelto no se reabra; si se borra el movimiento confirmado, el borrador conserva su estado.
- RPC en una transacción: `confirm_transaction_draft` usa `create_transaction_with_installments` y marca `source = email`; `link_transaction_draft` ("Es el mismo") exige la misma tarjeta, valor, moneda y fecha y no cambia el movimiento; `discard_transaction_draft`. Ninguna vista lee la tabla (pgTAP lo verifica en `pg_views`).
- `lib/transaction-draft.ts` pasa a `lib/transaction-form-draft.ts` y sus funciones a `*TransactionFormDraft*`. La clave de `sessionStorage` no cambia, para no perder formularios en curso.
- Dominio `lib/domain/drafts.ts`: candidatos para "Es el mismo" y aviso de cambio de monto contra la suscripción, solo en la misma moneda. Esquema de sugerencias en `lib/validation/transaction-draft.ts`, revalidado al leer; si no valida, el borrador se muestra sin sugerencias.
- `lib/transaction-create.ts` reúne la validación y el plan de "Nuevo gasto", y lo usan `createTransaction` y `confirmDraft`, para guardar exactamente el mismo movimiento.
- `/por-confirmar` con `ReviewLine`, extraído de la revisión de importación del paso 38. Las sugerencias aparecen como "Sugerido · confianza …", con badges neutros para "Revisar" y "Tarjeta no registrada", la frase del correo, el aviso de suscripción, el extracto tentativo y acciones secundarias (Confirmar, Es el mismo, Descartar con confirmación).
- Confirmar abre `/movimientos/nuevo?borrador=…`: el título es "Confirmar movimiento" y el formulario viene prellenado. Moneda y TRM cuentan como tocadas (la IA nunca define moneda, R10); lo que sugiere la IA también, y el historial del comercio (D53) completa el resto. La moneda de facturación sugerida es solo un aviso. Un borrador que ya no está abierto vuelve a la bandeja.
- Aviso en Meses debajo de la alerta de vencidos y nota en Ajustes: los borradores no se exportan.
- Pruebas: pgTAP `220-transaction-drafts.test.sql` (34 aserciones) y Vitest para dominio, mapeo al formulario, consultas, acciones, bandeja, botones, formulario en modo confirmación, página de "Nuevo gasto" y una revisión del código que comprueba que solo `lib/queries/drafts.ts` lee `transaction_drafts`.
- Verificación: `pnpm typecheck`, `pnpm lint`, `pnpm test` (688 pasan, 10 omitidas que requieren variables), `pnpm test:coverage`, `supabase db reset`, `supabase test db` (455) y `pnpm build`. Con `pnpm start` y un usuario local de prueba (borrado al terminar) se revisaron Meses, la bandeja y el formulario a 360 px en claro y oscuro, sin desborde horizontal. También se probaron "Es el mismo", confirmar y descartar; en la base quedaron el movimiento confirmado con `source = email`, el enlazado sin cambios y el descartado solo con su identificador.
- Pendiente para el paso 42: la ruta de ingesta es la única que crea borradores y debe agregarse a la prueba de lectores de `transaction_drafts`.
