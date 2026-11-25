# Paso 44 — Script de captura en Apps Script

- **Hito PRD:** H12 (parte 5 de 6)
- **Estado:** ✅ Terminado
- **Inicio:** 2026-11-22
- **Fin:** 2026-11-24
- **Commit:** 9e75ac8
- **Depende de:** 42
- **Decisiones aplicables (decididas, ver README):** D43, D44, D47, D51

## Objetivo

El script que corre en la cuenta de Google del dueño y envía las alertas a la app (F18).

## Contenido

- Proyecto en `integrations/apps-script/`, versionado con `clasp`, sin secretos en el repo.
- Activador cada hora (D43, cambiado el 22 de noviembre de 2026) que busca `from:alertasynotificaciones@notificacionesbancolombia.com newer_than:2d`.
- Permisos: `GmailApp` pide acceso completo al buzón (`https://mail.google.com/`). Para pedir el permiso mínimo, usar el servicio avanzado de Gmail con `gmail.readonly` declarado en `appsscript.json` y llevar los identificadores ya procesados o rechazados en `PropertiesService` (con limpieza de los de más de 2 días), en lugar de etiquetas. Confirmar los alcances en la documentación vigente de Google antes de implementar; si se usan etiquetas, el alcance es `gmail.modify` y la guía lo explica.
- Por cada mensaje no procesado:
    - verifica DKIM en el encabezado `Authentication-Results` agregado por Google (`mx.google.com`), no en otros que traiga el correo: debe pasar para `notificacionesbancolombia.com`; si no, lo anota como rechazado y no envía nada;
    - toma el texto plano y extrae solo la frase que empieza en "Bancolombia:" y termina antes de "Si tienes dudas";
    - si la frase no contiene `T.Cred *` seguido de 4 dígitos, lo anota como descartado y no envía nada (filtro en origen de ahorros y débito);
    - firma con HMAC (`Utilities.computeHmacSha256Signature`, secreto en `PropertiesService`), envía con el identificador del mensaje y lo anota como procesado solo si la app respondió con éxito.
- Guía de instalación en el README de la carpeta: crear el script, autorizarlo, guardar el secreto, activar el disparador, cómo revocarlo, qué permisos se autorizan y el procedimiento de rotación del secreto (D51).
- Código: la extracción de la frase y el filtro van en funciones puras de JavaScript sin APIs de Google, para probarlas con Vitest; la carpeta se incluye en `tsconfig`/ESLint solo si no rompe el build de Next.js.

## Pruebas

- [x] Función de extracción de la frase y del filtro `T.Cred` con pruebas locales (los mismos fixtures del paso 42).
- [x] Sin conexión con la app, el mensaje queda sin marcar como procesado y se reintenta en la siguiente ejecución.
- [x] Un correo con un `Authentication-Results` falso agregado por el remitente no pasa la verificación.

## Verificación

- [x] Con un correo real de compra aparece un borrador en la siguiente ejecución del activador (menos de una hora y 10 minutos). Comprobado con correos reales en la primera lectura (14 borradores) y con el activador corriendo solo (Time-Driven, 24 nov 10:03 p. m., Completed). La primera compra nueva que llegue por el activador se observa en la semana de uso del paso 45.
- [x] Un correo de la cuenta de ahorros no genera ninguna solicitud (revisar el registro de ejecuciones): `no_credit_card=8`, sin solicitudes.
- [ ] Revocar el acceso desde la cuenta de Google detiene la captura. Pasa al paso 45 por decisión del dueño, para no desautorizar y volver a autorizar dos veces.

## Criterios de terminado

- Commit: `feat: add Apps Script email capture`.

## Notas de progreso

<!-- Fecha — nota -->

2026-11-22 — Plan aprobado: clasp con `pnpm dlx @google/clasp`, sin agregarlo como dependencia; servicio avanzado de Gmail con `gmail.readonly` y estado en `PropertiesService`, sin etiquetas. Alcances confirmados en la documentación de Google (`users.messages.get/list` aceptan `gmail.readonly`; `ScriptApp.requireScopes` para pedirlos al instalar el activador).

2026-11-22 — Implementado:
- `integrations/apps-script/src/`:
    - `core.js` (funciones puras en el objeto global `AlCorteCapture`, sin APIs de Google);
    - `main.js` (`capturePurchaseAlerts`, `installTrigger`, `removeTrigger` y adaptadores de Gmail, UrlFetch y Properties);
    - `appsscript.json` (V8, `America/Bogota`, servicio avanzado de Gmail y tres alcances explícitos: `gmail.readonly`, `script.external_request`, `script.scriptapp`).
- `.clasp.json.example` con `rootDir: src`; el `.clasp.json` real queda en `.gitignore`.
- Lectura:
    - remitente exacto;
    - DKIM solo en el `Authentication-Results` de más arriba, con servidor `mx.google.com` y `dkim=pass` para el dominio exacto (sin subdominios ni parecidos; los comentarios entre paréntesis se ignoran);
    - frase desde el último "Bancolombia:" antes del primer "Si tienes dudas", para que ningún encabezado del correo salga de Google;
    - filtro `T.Cred *NNNN` igual al de la ruta.
- Decisiones menores:
    - si el correo no trae texto plano, el HTML se convierte a texto dentro de Google;
    - el cuerpo se decodifica con el `charset` de su parte;
    - sin las marcas de la frase, el mensaje queda descartado (`no_phrase`);
    - una frase de más de 1.000 caracteres o un cuerpo de más de 4 KB se rechaza sin enviarse;
    - con `401`, `403`, `429`, `503`, `3xx` o sin conexión, la ejecución deja de enviar el resto, porque la respuesta se repetiría para todos;
    - las redirecciones no se siguen: una URL movida se corrige en `INGEST_URL`;
    - `LockService` evita ejecuciones cruzadas;
    - el registro solo lleva conteos y motivos.
- README de la carpeta: qué hace, motivos del registro, permisos, instalación con clasp (o copiando los archivos a mano), detener y revocar, contrato y rotación (D51).
- ESLint: excepción de `no-unused-vars` solo para las funciones que Apps Script llama por nombre.
- Pruebas (Vitest, sin dependencias nuevas):
    - `core.test.ts` (55) carga `core.js` como lo hace Apps Script, en un contexto `vm` sin módulos. Cubre los fixtures del paso 42, HTML y entidades, DKIM con encabezado falso, servidor ajeno, dominios parecidos y comentarios, la paridad de la firma con `signAlert` (incluidas tildes y los bytes con signo de `Utilities`), un cuerpo que `verifyAlertSignature` acepta, la tabla de respuestas, el reintento sin conexión, la parada ante respuestas repetibles, el estado y su limpieza a los 2 días, y un resumen sin frases;
    - `main.test.ts` (4) corre `core.js` y `main.js` con imitaciones de los servicios: cuerpo en ISO-8859-1, bytes UTF-8 firmados, estado guardado, reintento sin conexión, URL sin https o sin secreto, y un solo activador.
- Verificación local: `pnpm typecheck`, `pnpm lint`, `pnpm test` (830 pasan, 13 omitidas que requieren variables), `pnpm test:coverage` y `pnpm build`. Sin cambios de esquema, así que no hizo falta `supabase db reset` ni regenerar tipos.
- Pendiente del dueño, en su cuenta de Google y en producción (variables del paso 42 en Vercel y migración remota): instalar el script, comprobar el borrador con un correo real, que una alerta de ahorros no genera solicitud y que revocar el acceso detiene la captura. El paso sigue en 🟡 hasta esas tres verificaciones.

2026-11-24 — Migraciones remotas aplicadas con `supabase db push --remote` (ensayo previo con `--dry-run`): `20261122040000_ai_usage`, `20261122050000_transaction_drafts` y `20261122060000_alert_ingest`. `migration list --remote` las muestra en ambos lados; RLS activo en `ai_usage`, `transaction_drafts`, `card_aliases`, `capture_settings` e `ingest_rate_limits`. Los avisos de seguridad solo muestran `auth_leaked_password_protection`, aceptado en el paso 20. El dueño confirma que las variables de Vercel ya están configuradas.

2026-11-24 — Cambios pedidos por el dueño (ver registro de decisiones):
- Primera lectura de los últimos 10 días: `backfillAlerts` busca `after:` con la medianoche de Bogotá de hace 10 días (instalado el 24 de noviembre, desde el 14). Espera 2,5 s entre solicitudes (límite de 30 por minuto de la ruta), se detiene a los 4,5 minutos guardando el estado (`time_limit`) y vuelve a evaluar los descartados. `installTrigger` la ejecuta después de crear el activador; repetirla no crea borradores repetidos.
- Filtro `T.Credito`: antes, una alerta con "T.Credito *1234" se descartaba en el script y la ruta la habría marcado como `ignored`, así que se perdía sin aviso. Ahora el script y `lib/ingest/bancolombia.ts` (filtro, últimos 4 dígitos y formato de compra) aceptan `T.Cred`, `T.Credito` y `T.Crédito`, pero no otras palabras como "T.Credencial". La IA no cambia: la tarjeta la sigue asignando la app con los 4 dígitos de las reglas. PRD R10 actualizado.
- Pruebas nuevas: reglas con `T.Credito` (compra exacta, pago a revisar, sin dígitos, "T.Credencial" ignorada), filtro del script, búsqueda de la primera lectura (cambio de día UTC y de mes), reintento de descartados, corte por tiempo, y en el adaptador las búsquedas, las pausas y la primera lectura dentro de `installTrigger`.

2026-11-24 — Primera ejecución real de `installTrigger`: activador instalado, pero `encontrados=0`. Las alertas reales llegan de `alertasynotificaciones@ayn.notificacionesbancolombia.com` (firmado por `ayn.`) y de `alertasynotificaciones@an.notificacionesbancolombia.com` (firmado por `an.`; el envío sale de `trans.an.`). El script buscaba solo `@notificacionesbancolombia.com` y además exigía DKIM del dominio principal. Corregido: lista cerrada `SENDERS` con los dos subdominios y el dominio principal, búsqueda `from:(… OR … OR …)` y DKIM para el dominio exacto de cada remitente (`an.` firmado por `ayn.`, otra cuenta en `an.` o un dominio parecido se rechazan). Pruebas nuevas con los dos formatos reales.

2026-11-24 — Primera lectura real (`backfillAlerts`): `encontrados=24`, `enviados=13`, `creados=13`, `descartados=11` (`no_credit_card=6`, `no_phrase=5`), `por reintentar=0`. En producción (solo conteos): 7 borradores "Por confirmar" y 6 en "Revisar", todos con tarjeta; 19 llamadas de IA sin errores, US$0,20. Al menos uno de los "Revisar" usa un segundo formato de compra ("… con tu T.Cred *NNNN, el dd/mm/aaaa a las hh:mm."), que ahora leen las reglas de `lib/ingest/bancolombia.ts` (mapa de grupos por formato, porque el proyecto apunta a ES2017). Tres compras del 14 y 15 de noviembre no estaban registradas, pero tampoco aparecen en el extracto real de noviembre (periodo del banco 15 oct–16 nov), que cuadra sin ellas. Por decisión del dueño quedan sin confirmar hasta el extracto de diciembre (ver registro de decisiones).

2026-11-24 — Un avance real ("Hiciste un avance de $…,000 en tu SUC VIRTUAL el hh:mm dd/mm/aaaa desde tu T.Credito *NNNN a la cuenta *NNNN.") terminaba en "¿Dudas? Llamanos…", no en "Si tienes dudas", y el script lo descartó como `no_phrase`. Ahora el fin de la frase es "Si tienes dudas" o "¿Dudas?" (con o sin "¿"). Su monto usa coma de miles, que `verifyExtraction` (paso 43) rechazaba; ahora la acepta solo como grupos de 3 dígitos sin decimales. Con `backfillAlerts` se vuelven a evaluar los descartados.

2026-11-24 — Despliegue `a5998ce` confirmado en Vercel y script subido con clasp. `backfillAlerts`: `encontrados=24`, `ya vistos=13`, `enviados=1`, `creados=1`, `descartados=10` (`no_credit_card=8`, `no_phrase=2`). El avance virtual quedó como borrador "Revisar" leído con IA y verificado: `cash_advance`, COP 500.000, 24 nov 17:55, Mastercard ••1999, extracto tentativo del 15 dic. Dos de los `no_phrase` anteriores eran alertas con el pie "¿Dudas?" sin `T.Cred`, y ahora son `no_credit_card`. Los descartes no generaron solicitudes, lo que cubre la verificación de la alerta de ahorros. Pendientes: ver una ejecución del activador de cada hora y revocar el acceso (paso 45).

2026-11-24 — Paso cerrado por decisión del dueño. El activador de cada hora corrió solo (24 nov 10:03 p. m., Time-Driven, Completed). La comprobación de revocar el acceso pasa al paso 45.
