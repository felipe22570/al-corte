# Captura de alertas por correo

Script de Google Apps Script que corre cada hora en la cuenta de Google del dueño y envía a Al Corte solo la frase de cada alerta de tarjeta de crédito (F18, D43). El script, su instalación y sus permisos se completan en el paso 44. Este documento ya define el contrato con la app (paso 42) y la rotación del secreto (D51).

## Contrato con la app

`POST https://<dominio>/api/ingest/alerts`

- Cuerpo JSON de máximo 4 KB: `{ "message_id": "<id del mensaje de Gmail>", "phrase": "<frase de la alerta>" }`. Nada más: ni HTML, ni pie del correo, ni datos personales (D47).
- `X-Al-Corte-Timestamp`: segundos Unix del momento del envío.
- `X-Al-Corte-Signature`: `v1=` seguido del HMAC-SHA256 en hexadecimal (minúsculas) de `"<timestamp>.<cuerpo>"`, con el secreto `INGEST_SIGNING_SECRET`. El cuerpo firmado es exactamente el que se envía.

| Respuesta | Qué hace el script |
| --- | --- |
| `200` con `result` `created`, `duplicate` o `ignored` | Marca el mensaje como procesado. |
| `400` o `413` | Marca el mensaje como rechazado: el mensaje no cumple el contrato y reintentar no cambia nada. |
| `401` (firma o secreto no coinciden), `403` (captura apagada), `429` (más de 30 solicitudes por minuto), `5xx` o sin conexión | No lo marca; lo reintenta en la siguiente ejecución, mientras el mensaje tenga menos de 2 días. Un `401` suele ser un secreto distinto en Vercel y en el script, no un mensaje malo. |

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
