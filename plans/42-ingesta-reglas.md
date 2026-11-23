# Paso 42 — Endpoint de ingesta y reglas de alertas

- **Hito PRD:** H12 (parte 3 de 6)
- **Estado:** ✅ Terminado
- **Inicio:** 2026-11-22
- **Fin:** 2026-11-22
- **Commit:**
- **Depende de:** 41
- **Decisiones aplicables (decididas, ver README):** D43, D44, D45, D46, D47, D51

## Objetivo

Recibir alertas firmadas, leerlas con reglas y crear borradores (R10).

## Contenido

- Ruta `app/api/ingest/alerts/route.ts` (Next.js en Vercel, no Edge Function de Supabase), para reutilizar `lib/domain`, esquemas y `lib/ai`.
- Seguridad:
    - firma HMAC-SHA256 del cuerpo con marca de tiempo; se rechazan firmas inválidas o de más de 5 minutos; comparación en tiempo constante;
    - `INGEST_SIGNING_SECRET` e `INGEST_USER_ID` solo en variables de entorno del servidor (D51). La rotación es un procedimiento documentado en `integrations/apps-script/README.md`: generar un secreto nuevo, cambiarlo en Vercel, volver a desplegar y actualizarlo en `PropertiesService`;
    - la ruta no tiene sesión: escribe con la llave de servicio, solo en código de servidor, y fija siempre `user_id = INGEST_USER_ID` en cada fila;
    - migración: tabla `capture_settings` (`user_id`, RLS, `enabled`) para el interruptor de apagado en Ajustes, y una tabla de conteo por ventana de un minuto para el límite de solicitudes (en Vercel no hay memoria compartida entre invocaciones);
    - cuerpo máximo de 4 KB;
    - respuestas sin detalles internos.
- Reglas en `lib/ingest/bancolombia.ts`, funciones puras con pruebas:
    - exige `T.Cred *` seguido de 4 dígitos; si no está, responde "ignorado" sin guardar nada;
    - formato de compra: "Compraste [moneda][monto] en [comercio], el [dd/mm/aaaa] a las [hh:mm]. Esta compra esta asociada a T.Cred *[NNNN]". Monto con punto de miles y coma decimal;
    - otros verbos o formatos pasan al respaldo con IA del paso 43, nunca se descartan en silencio si mencionan `T.Cred`.
- Tarjeta: por `last4` o por la tabla nueva `card_aliases (card_id, last4)` con `user_id` y RLS, editable en Ajustes. Sin coincidencia, o con más de una tarjeta activa con esos 4 dígitos, borrador `unknown_card`; nunca se elige por aproximación.
- Exportación: `card_aliases` y `capture_settings` en `lib/export-schema.ts`.
- Asignación tentativa al extracto con R1 según la fecha, solo como dato del borrador.

## Pruebas

- [x] Las dos alertas reales de ejemplo (DirecTV COP 140.910,00 del 17/11/2026 12:27 y GOOGLE \*ChatGPT COP 81.000,00 del 16/11/2026 11:33, ambas \*1999) se leen exactamente.
- [x] Una alerta de cuenta de ahorros o tarjeta débito se ignora y no deja rastro en la base.
- [x] Un pago a la tarjeta desde la cuenta de ahorros no se lee como compra.
- [x] Firma inválida, marca de tiempo vieja y mensaje repetido se rechazan.
- [x] Últimos 4 dígitos desconocidos o compartidos por dos tarjetas activas → `unknown_card`.
- [x] Con la captura apagada o el límite superado, la solicitud se rechaza sin crear borradores.
- [x] Toda fila creada por la ruta tiene el `user_id` de `INGEST_USER_ID`.

## Verificación

```
pnpm typecheck && pnpm lint && pnpm test && pnpm test:coverage
supabase db reset && supabase test db
pnpm build
```

## Criterios de terminado

- Commit: `feat: add signed alert ingestion with Bancolombia rules`.

## Notas de progreso

<!-- Fecha — nota -->

2026-11-22 — Plan aprobado con cambios (ver registro de decisiones): el filtro es solo que la frase mencione `T.Cred` y no se piden textos de otras alertas, la captura empieza apagada y el activador del script corre cada hora (D43 actualizado en el PRD y en el paso 44). Límite de 30 solicitudes por minuto.

2026-11-22 — Implementado:
- Ruta `app/api/ingest/alerts/route.ts`, sin sesión. Orden de revisión: variables de entorno (sin ellas, 503), tamaño de 4 KB (413), firma `v1=` HMAC-SHA256 de `"{timestamp}.{cuerpo}"` con ventana de 5 minutos y comparación en tiempo constante (401), cuerpo estricto con Zod (400), captura encendida (403), límite por minuto (429), reglas, tarjeta y borrador. Responde solo `{ ok, result }`, con `Cache-Control: no-store`, y nunca escribe la frase en logs. El límite va después de la firma, para que nadie sin el secreto agote el cupo.
- `lib/ingest/`: `bancolombia.ts` (reglas puras), `signature.ts`, `ingest-alert.ts` (flujo con almacén inyectable), `supabase-store.ts` (llave de servicio; toda consulta filtra por `INGEST_USER_ID` y todo borrador lo lleva) y `config.ts` (secreto de al menos 32 caracteres, UUID del dueño y llave). Cliente de servicio en `lib/supabase/service.ts` con `server-only`.
- Reglas: sin `T.Cred` → `ignored`, sin guardar nada. El formato de compra de la plantilla del plan saca moneda COP/USD, monto con miles y coma decimal, comercio tal como viene, fecha, hora y los 4 dígitos. Tolera saltos de línea, espacios duros, tilde en "está" y punto final. Cualquier otra cosa que mencione `T.Cred` (pago, avance, formato desconocido, fecha u hora imposibles, monto en cero o mal agrupado, otra moneda o texto adicional) queda `needs_review` con los 4 dígitos para el paso 43; nunca se adivina.
- Tarjeta: `last4` de tarjetas activas más `card_aliases`. Con cero o más de una coincidencia el borrador queda `unknown_card`. El extracto tentativo se calcula con R1.
- Migración `20261122060000_alert_ingest.sql`: `card_aliases` (RLS, única por dueño y 4 dígitos, tarjeta del dueño, sin edición), `capture_settings` (RLS, apagada sin fila) e `ingest_rate_limits`, con la función atómica `ingest_rate_hit`, que solo puede ejecutar `service_role` y limpia ventanas de más de un día. Tipos regenerados. `card_aliases` y `capture_settings` agregadas a la exportación; `capture_settings` se ordena por `user_id` porque no tiene `id`.
- Ajustes: sección "Captura de alertas" con el interruptor, otros últimos 4 dígitos por tarjeta y enlace a la bandeja.
- `integrations/apps-script/README.md`: contrato con la app, variables del servidor y rotación del secreto (D51). Decisión menor: con `401` el script no marca el mensaje y lo reintenta, porque suele indicar un secreto distinto durante una rotación, no un mensaje malo. Solo `400` y `413` se marcan como rechazados. Esto ajusta lo que hará el paso 44.
- `.env.example` con `INGEST_SIGNING_SECRET`, `INGEST_USER_ID` y `SUPABASE_SECRET_KEY`.
- Pruebas: Vitest (reglas con las dos alertas de la plantilla, firma, configuración, flujo completo, acciones y componente de Ajustes), integración de la ruta contra Supabase local y pgTAP `230-alert-ingest.test.sql`. La prueba de lectores de `transaction_drafts` ahora incluye el almacén de ingesta.
- Verificación: `pnpm typecheck`, `pnpm lint`, `pnpm test` (731 pasan, 13 omitidas que requieren variables), `pnpm test:coverage`, `supabase db reset`, `supabase test db` (477), integraciones locales (35) y `pnpm build`. Con `pnpm start` y solicitudes firmadas con `openssl` y `curl`: captura apagada 403; encendida 200 `created`; repetida `duplicate`; ahorros `ignored`, sin fila; pago desde ahorros `needs_review`; tarjeta desconocida `unknown_card`; firma de hace 6 minutos, otro secreto o sin firma 401; 5 KB 413. Todas las filas quedaron con el usuario de `INGEST_USER_ID`, el log del servidor no contiene frases y el alias agregado desde Ajustes asignó la alerta `*4242` a su tarjeta. Apagar la captura desde Ajustes devolvió 403 sin borrador. Ajustes revisado a 360 px en claro y oscuro; el selector de tarjeta pasa a su propia fila en pantallas pequeñas para no cortar los 4 dígitos. El usuario de prueba y los secretos temporales se borraron.
- Pendiente fuera del código: en Vercel, `INGEST_SIGNING_SECRET`, `INGEST_USER_ID` y `SUPABASE_SECRET_KEY` (solo servidor) y la migración remota. El script es el paso 44.
