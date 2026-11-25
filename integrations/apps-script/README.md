# Captura de alertas por correo

Script de Google Apps Script que corre cada hora en la cuenta de Google del dueño y envía a Al Corte solo la frase de cada alerta de tarjeta de crédito (F18, D43). El contrato con la app viene del paso 42; el script y esta guía, del paso 44.

## Qué hace

Al instalarse hace una primera lectura de los últimos 10 días, desde la medianoche de Bogotá (instalado el 24 de noviembre, lee desde el 14). Después busca cada hora los correos de los últimos 2 días (`newer_than:2d`) de alguno de estos remitentes, que son los únicos aceptados:

- `alertasynotificaciones@an.notificacionesbancolombia.com` (firmado por `an.notificacionesbancolombia.com`);
- `alertasynotificaciones@ayn.notificacionesbancolombia.com` (firmado por `ayn.notificacionesbancolombia.com`);
- `alertasynotificaciones@notificacionesbancolombia.com`, documentado en el PRD.

 En ambos casos, por cada mensaje que no ha visto:

1. Comprueba que el remitente sea exactamente uno de los de la lista.
2. Comprueba DKIM solo en el `Authentication-Results` que Gmail agrega arriba del mensaje (`mx.google.com`): debe decir `dkim=pass` para el dominio exacto del remitente. Un correo de `@an.` firmado por `ayn.` (o por el dominio principal) se rechaza. Ignora cualquier otro encabezado que traiga el correo. Si el remitente o DKIM fallan, lo anota como rechazado y no envía nada.
3. Toma el texto plano (o, si el correo no lo trae, el HTML convertido a texto dentro de Google) y extrae solo la frase desde "Bancolombia:" hasta antes de "Si tienes dudas". Sin esas marcas, lo anota como descartado.
4. Si la frase no menciona `T.Cred *` o `T.Credito *` seguido de 4 dígitos, lo anota como descartado: las alertas de ahorros y débito nunca salen de Google (D44).
5. Firma `{ message_id, phrase }` y lo envía. Lo anota según la respuesta de la app (ver la tabla del contrato).

El estado (identificador, resultado y hora) vive en la propiedad `AL_CORTE_CAPTURE_STATE`. Se limpia sola a los 2 días. El script no etiqueta, mueve, borra ni envía correos.

El registro de ejecuciones solo muestra conteos y motivos, por ejemplo: `Captura: encontrados=3, ya vistos=1, enviados=1, creados=1, …, descartados=1. Motivos: no_credit_card=1`. Nunca muestra frases, comercios ni identificadores.

| Motivo | Significado |
| --- | --- |
| `sender`, `dkim` | Rechazado sin enviar: no viene de un remitente de la lista o la firma DKIM no es de su dominio. Si Bancolombia empieza a usar otro remitente, se agrega a `SENDERS` en `src/core.js`. |
| `no_phrase` | Descartado: el correo no tiene la frase entre "Bancolombia:" y "Si tienes dudas". |
| `no_credit_card` | Descartado: alerta de ahorros, débito u otra sin `T.Cred *NNNN` ni `T.Credito *NNNN`. |
| `time_limit` | La primera lectura paró antes del límite de 6 minutos de Apps Script; lo que faltó queda para la siguiente ejecución. |
| `too_large` | Rechazado sin enviar: la frase supera lo que acepta la app. |
| `http_NNN`, `network_error`, `load_error`, `unexpected_answer` | Se reintenta en la siguiente ejecución, salvo `http_400` y `http_413`. |

## Permisos

El manifiesto (`src/appsscript.json`) declara solo estos permisos:

| Permiso | Para qué |
| --- | --- |
| `gmail.readonly` ("Ver tus mensajes de correo y tu configuración") | Buscar y leer las alertas con el servicio avanzado de Gmail. Es solo lectura: no puede modificar ni enviar correos. |
| `script.external_request` ("Conectarse a un servicio externo") | Enviar la frase firmada a Al Corte. |
| `script.scriptapp` ("Permitir que esta aplicación se ejecute cuando no estás presente") | Crear el activador de cada hora. |

`GmailApp` pediría acceso completo al buzón (`https://mail.google.com/`) y las etiquetas exigirían `gmail.modify`. Por eso el script usa el servicio avanzado y lleva su estado en `PropertiesService`. Google puede mostrar la advertencia de "app no verificada": es tu propio script y no se publica.

## Instalación

Requisitos: la ruta de ingesta desplegada en producción con `INGEST_SIGNING_SECRET`, `INGEST_USER_ID` y `SUPABASE_SECRET_KEY` (ver "Variables del servidor"), la migración del paso 42 aplicada y la captura encendida en Ajustes → Captura de alertas.

1. Con la cuenta de Google que recibe las alertas, crea un proyecto vacío en https://script.google.com ("Nuevo proyecto") y llámalo `Al Corte · captura`. En Configuración del proyecto, copia el ID de la secuencia de comandos.
2. Activa la API de Apps Script para clasp en https://script.google.com/home/usersettings.
3. Desde esta carpeta, sube el código con clasp (Node 22 o posterior). No se agrega como dependencia del repositorio:

    ```bash
    cd integrations/apps-script
    cp .clasp.json.example .clasp.json   # pega el ID en scriptId; el archivo no va a git
    pnpm dlx @google/clasp login
    pnpm dlx @google/clasp push --force  # reemplaza el manifiesto vacío por src/appsscript.json
    ```

    Sin clasp: en el editor, activa "Mostrar el archivo de manifiesto appsscript.json" en la configuración del proyecto y copia a mano `src/appsscript.json`, `src/core.js` y `src/main.js` (como `core.gs` y `main.gs`).
4. En Configuración del proyecto → Propiedades de la secuencia de comandos, agrega:
    - `INGEST_URL`: `https://<dominio de producción>/api/ingest/alerts`. Usa el dominio final: el script no sigue redirecciones.
    - `INGEST_SIGNING_SECRET`: el mismo valor que en Vercel. No lo pegues en chats ni en el repositorio.
5. En el editor, elige la función `installTrigger` y ejecútala. Autoriza los tres permisos de la tabla anterior. Queda un solo activador de `capturePurchaseAlerts` cada hora y, en la misma ejecución, se hace la primera lectura de los últimos 10 días.
6. Revisa el registro de ejecuciones. La primera lectura espera 2,5 segundos entre solicitudes para no pasar el límite de 30 por minuto de la app, y se detiene a los 4,5 minutos para guardar su estado antes del límite de Apps Script. Si el resumen muestra `por reintentar` mayor que cero, ejecuta `backfillAlerts` otra vez: lo ya enviado no se repite.

`backfillAlerts` también sirve más adelante para volver a leer los últimos 10 días. Lo que la app ya tiene vuelve como `repetidos` y no crea borradores. Además, vuelve a evaluar los mensajes que antes se descartaron (por ejemplo, si cambia el filtro). Cada borrador nuevo usa la IA para sus sugerencias, dentro del tope mensual de Ajustes.

Para actualizar el código, repite `pnpm dlx @google/clasp push --force` desde esta carpeta. El activador y las propiedades se conservan.

## Detener o revocar

- **Pausar desde la app:** apaga la captura en Ajustes. La ruta responde `403` y el script reintenta durante 2 días sin marcar nada.
- **Quitar el activador:** ejecuta `removeTrigger` en el editor (o bórralo en Activadores).
- **Revocar el acceso:** en https://myaccount.google.com/connections (Seguridad → Tus conexiones con apps y servicios de terceros), elige `Al Corte · captura` y quita el acceso. Desde ahí, las ejecuciones fallan con "Se requiere autorización" y el script no lee ni envía nada. Para volver, ejecuta `installTrigger` y autoriza de nuevo.

## Contrato con la app

`POST https://<dominio>/api/ingest/alerts`

- Cuerpo JSON de máximo 4 KB: `{ "message_id": "<id del mensaje de Gmail>", "phrase": "<frase de la alerta>" }`. Nada más: ni HTML, ni pie del correo, ni datos personales (D47).
- `X-Al-Corte-Timestamp`: segundos Unix del momento del envío.
- `X-Al-Corte-Signature`: `v1=` seguido del HMAC-SHA256 en hexadecimal (minúsculas) de `"<timestamp>.<cuerpo>"`, con el secreto `INGEST_SIGNING_SECRET`. El cuerpo firmado es exactamente el que se envía.

| Respuesta | Qué hace el script |
| --- | --- |
| `200` con `result` `created`, `duplicate` o `ignored` | Marca el mensaje como procesado. |
| `400` o `413` | Marca el mensaje como rechazado: el mensaje no cumple el contrato y reintentar no cambia nada. |
| `401` (firma o secreto no coinciden), `403` (captura apagada), `429` (más de 30 solicitudes por minuto), `5xx`, redirección `3xx` o sin conexión | No lo marca; lo reintenta en la siguiente ejecución, mientras el mensaje tenga menos de 2 días. Un `401` suele ser un secreto distinto en Vercel y en el script, no un mensaje malo. Con `401`, `403`, `429`, `503`, `3xx` o sin conexión, la ejecución deja de enviar los demás mensajes, porque la respuesta se repetiría. |

Una firma con más de 5 minutos de diferencia con la hora del servidor se rechaza. Las respuestas nunca incluyen la frase ni detalles internos.

## Variables del servidor (Vercel)

Solo en el entorno del servidor, nunca con prefijo `NEXT_PUBLIC_`:

- `INGEST_SIGNING_SECRET`: al menos 32 caracteres aleatorios. Se genera con `openssl rand -hex 32`.
- `INGEST_USER_ID`: el `id` del usuario dueño en Supabase Auth. Toda fila que crea la ruta lleva este usuario.
- `SUPABASE_SECRET_KEY`: llave secreta del proyecto de Supabase (`sb_secret_…`). La ruta no tiene sesión y escribe con ella.

Si falta alguna, la ruta responde `503` y no acepta nada. La captura además debe estar encendida en Ajustes → Captura de alertas; empieza apagada.

## Rotar el secreto de firma (D51)

Rotar es un procedimiento, no una acción de la app. Hazlo si sospechas que el secreto se filtró o al cambiar de cuenta de Google.

1. Genera un secreto nuevo: `openssl rand -hex 32`. No lo pegues en chats, tickets ni en el repositorio.
2. En Vercel → proyecto `al-corte` → Settings → Environment Variables, reemplaza el valor de `INGEST_SIGNING_SECRET` en Production.
3. Vuelve a desplegar (Deployments → Redeploy del último despliegue de producción). El valor nuevo solo aplica desde ese despliegue; desde ahí, las solicitudes firmadas con el secreto anterior reciben `401`.
4. En el editor de Apps Script → Configuración del proyecto → Propiedades del script, reemplaza `INGEST_SIGNING_SECRET` con el mismo valor.
5. Comprueba en el registro de ejecuciones del script que la siguiente ejecución recibe `200`. Los mensajes que recibieron `401` entre los pasos 3 y 4 no quedaron marcados y se envían en esa ejecución.

Para apagar la captura sin rotar nada, usa el interruptor de Ajustes: la ruta responde `403` y el script reintenta durante 2 días.
