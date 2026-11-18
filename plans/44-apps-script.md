# Paso 44 — Script de captura en Apps Script

- **Hito PRD:** H12 (parte 5 de 6)
- **Estado:** ⬜ Pendiente
- **Inicio:**
- **Fin:**
- **Commit:**
- **Depende de:** 42
- **Decisiones aplicables (decididas, ver README):** D43, D44, D47, D51

## Objetivo

El script que corre en la cuenta de Google del dueño y envía las alertas a la app (F18).

## Contenido

- Proyecto en `integrations/apps-script/`, versionado con `clasp`, sin secretos en el repo.
- Activador cada 5 minutos que busca `from:alertasynotificaciones@notificacionesbancolombia.com newer_than:2d`.
- Permisos: `GmailApp` pide acceso completo al buzón (`https://mail.google.com/`). Para pedir el permiso mínimo, usar el servicio avanzado de Gmail con `gmail.readonly` declarado en `appsscript.json` y llevar los identificadores ya procesados o rechazados en `PropertiesService` (con limpieza de los de más de 2 días), en lugar de etiquetas. Confirmar los alcances en la documentación vigente de Google antes de implementar; si se usan etiquetas, el alcance es `gmail.modify` y la guía lo explica.
- Por cada mensaje no procesado:
    - verifica DKIM en el encabezado `Authentication-Results` agregado por Google (`mx.google.com`), no en otros que traiga el correo: debe pasar para `notificacionesbancolombia.com`; si no, lo anota como rechazado y no envía nada;
    - toma el texto plano y extrae solo la frase que empieza en "Bancolombia:" y termina antes de "Si tienes dudas";
    - si la frase no contiene `T.Cred *` seguido de 4 dígitos, lo anota como descartado y no envía nada (filtro en origen de ahorros y débito);
    - firma con HMAC (`Utilities.computeHmacSha256Signature`, secreto en `PropertiesService`), envía con el identificador del mensaje y lo anota como procesado solo si la app respondió con éxito.
- Guía de instalación en el README de la carpeta: crear el script, autorizarlo, guardar el secreto, activar el disparador, cómo revocarlo, qué permisos se autorizan y el procedimiento de rotación del secreto (D51).
- Código: la extracción de la frase y el filtro van en funciones puras de JavaScript sin APIs de Google, para probarlas con Vitest; la carpeta se incluye en `tsconfig`/ESLint solo si no rompe el build de Next.js.

## Pruebas

- [ ] Función de extracción de la frase y del filtro `T.Cred` con pruebas locales (los mismos fixtures del paso 42).
- [ ] Sin conexión con la app, el mensaje queda sin marcar como procesado y se reintenta en la siguiente ejecución.
- [ ] Un correo con un `Authentication-Results` falso agregado por el remitente no pasa la verificación.

## Verificación

- [ ] Con un correo real de compra aparece un borrador en menos de 10 minutos.
- [ ] Un correo de la cuenta de ahorros no genera ninguna solicitud (revisar el registro de ejecuciones).
- [ ] Revocar el acceso desde la cuenta de Google detiene la captura.

## Criterios de terminado

- Commit: `feat: add Apps Script email capture`.

## Notas de progreso

<!-- Fecha — nota -->
