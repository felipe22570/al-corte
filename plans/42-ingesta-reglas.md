# Paso 42 — Endpoint de ingesta y reglas de alertas

- **Hito PRD:** H12 (parte 3 de 6)
- **Estado:** ⬜ Pendiente
- **Inicio:**
- **Fin:**
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

- [ ] Las dos alertas reales de ejemplo (DirecTV COP 140.910,00 del 17/11/2026 12:27 y GOOGLE \*ChatGPT COP 81.000,00 del 16/11/2026 11:33, ambas \*1999) se leen exactamente.
- [ ] Una alerta de cuenta de ahorros o tarjeta débito se ignora y no deja rastro en la base.
- [ ] Un pago a la tarjeta desde la cuenta de ahorros no se lee como compra.
- [ ] Firma inválida, marca de tiempo vieja y mensaje repetido se rechazan.
- [ ] Últimos 4 dígitos desconocidos o compartidos por dos tarjetas activas → `unknown_card`.
- [ ] Con la captura apagada o el límite superado, la solicitud se rechaza sin crear borradores.
- [ ] Toda fila creada por la ruta tiene el `user_id` de `INGEST_USER_ID`.

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
