# Paso 43 — Interpretación de alertas con IA

- **Hito PRD:** H12 (parte 4 de 6)
- **Estado:** ✅ Terminado
- **Inicio:** 2026-11-22
- **Fin:** 2026-11-22
- **Commit:**
- **Depende de:** 40, 42
- **Decisiones aplicables (decididas, ver README):** D3, D34, D35, D42, D45

## Objetivo

Sugerencias útiles para cada borrador sin que la IA decida ningún dato del movimiento (R10).

## Contenido

- Tarea `interpretTransactionAlert` en `lib/ai/tasks/`:
    - entrada: comercio tal como viene, monto y moneda de la alerta, identificador interno de la tarjeta, categorías del usuario, suscripciones activas de esa tarjeta (nombre, monto, moneda, cuotas) y un resumen del historial de ese comercio (últimas 5 ocurrencias: nombre, categoría, moneda facturada, cuotas, monto);
    - salida: nombre limpio, categoría (de la lista o nula), suscripción relacionada o nula, aviso de cambio de monto, moneda probable de facturación, cuotas sugeridas, compra internacional, confianza (`alta`, `media`, `baja`) y una razón corta.
- Tarea `extractUnknownAlert` (respaldo): para frases que no coinciden con un formato conocido. Cada número de la salida debe aparecer literalmente en el texto; si no, el borrador queda `needs_review`.
- Sin historial ni IA disponible, el borrador queda sin sugerencias.
- Evals en `lib/ai/evals/` con al menos: las dos alertas reales, una compra de Google en COP que se factura en USD a 36 cuotas, una suscripción con cambio de monto y un formato desconocido. Anonimizar antes de guardarlas.

## Pruebas

- [x] La IA no puede cambiar monto, moneda, fecha ni tarjeta del borrador (prueba con salida simulada que lo intenta).
- [x] La verificación literal rechaza números inventados.
- [x] `pnpm test:ai`: resultados anotados en las notas, por campo.

## Verificación

```
pnpm typecheck && pnpm lint && pnpm test && pnpm test:coverage
pnpm test:ai
```

## Criterios de terminado

- Commit: `feat: add AI interpretation for captured alerts`.

## Notas de progreso

<!-- Fecha — nota -->

2026-11-22 — Plan aprobado: los datos leídos por la IA de respaldo prellenan el formulario pero el borrador sigue en "Revisar" con la nota "Leído con IA" (ver registro de decisiones).

2026-11-22 — Implementado:
- Tareas en `lib/ai/tasks/`:
    - `interpretTransactionAlert` v1 recibe el comercio, el valor, la moneda, un identificador interno de la tarjeta, las categorías, las suscripciones activas de la tarjeta y hasta 5 compras del historial. La salida es `strictObject` sin campos de valor, moneda, fecha ni tarjeta, así que una respuesta que intente cambiarlos es `invalid_output`. Los ids de categoría y suscripción que no son del dueño se anulan.
    - `extractUnknownAlert` v1 copia los datos como texto y la app los verifica con `verifyExtraction` (`lib/ingest/literal.ts`): cada número debe aparecer completo en la frase, sin estar dentro de otro más largo. Es USD solo si el monto va justo después de USD o US$, y un comercio que no está en el texto se descarta. Si algo no cuadra, no se guarda nada.
- Historial (dominio): `merchantPrefix` y `relatedMerchantHistory` toman primero el mismo nombre normalizado y luego el mismo prefijo antes de `*` (`GOOGLE *ChatGPT` → cobros `GOOGLE *…`).
- `lib/ingest/ai-enrichment.ts` corre con `after()` en la ruta de ingesta (`maxDuration = 60`). Primero el respaldo (solo borradores "Revisar" sin datos), con la tarjeta asignada por la app, y después la interpretación (solo borradores abiertos sin sugerencias). El uso queda en `ai_usage` a nombre de `INGEST_USER_ID`, con tope. Nunca lanza errores: sin llave, sin presupuesto o con un error, el borrador queda como lo dejaron las reglas.
- Bandeja y formulario muestran "Leído con IA. Revisa el valor, la fecha y la tarjeta antes de confirmar." (`readByAi`: borrador "Revisar" con datos, que las reglas nunca llenan).
- Capa de IA: hallazgo con la API real. En Claude Opus 5.5 el razonamiento siempre está activo (no admite `thinking: disabled`) y cuenta dentro de `max_tokens`; con 300 tokens la respuesta se cortaba (`max_tokens` → `invalid_output`). `AiTask` gana `effort` (`output_config.effort`): las tres tareas usan `low` y `max_tokens` de 1.000 a 2.000, lo que acota el peor caso a cerca de US$0,04 por llamada.
- `pnpm test:ai` (claude-opus-5-5, 22 de noviembre de 2026, después de los ajustes):
    - `smokeCheck` v1, 4 casos: merchant 4/4, amount 4/4, currency 4/4.
    - `interpretTransactionAlert` v1, 5 casos (DirecTV con cambio de monto, Google en pesos facturado en USD a 36 cuotas, compra repetida en USD, comercio nuevo, instrucción dentro del comercio): subscriptionId 4/4, categoryId 3/3, installmentsCount 5/5, billingCurrency 4/4, isInternational 2/2.
    - `extractUnknownAlert` v1, 4 casos (avance, pago desde ahorros, cobro en USD con otro verbo, instrucción dentro de la alerta): type 4/4, amountText 4/4, currency 4/4, dateText 4/4, timeText 3/3, last4 3/3; verificación literal 4/4.
    - Costo de la corrida: US$0,12.
    - En la primera corrida, antes de los ajustes, `extractUnknownAlert` falló en el cobro en USD: la respuesta se cortó por `max_tokens` o se clasificó como `other` porque el prompt solo nombraba "compraste". Además, la verificación rechazó la inyección que mencionaba "USD" en otra parte del texto. Se corrigieron el prompt (tipos por lo que pasó con la tarjeta), `effort`/`max_tokens` y la regla de moneda.
- Fixtures en `lib/ai/evals/fixtures/alerts.json`, todos ficticios. Las alertas reales siguen la plantilla del paso 42 con dígitos ficticios, como decidió el dueño.
- Pruebas: Vitest para el historial (dominio), la verificación literal, el orquestador con modelo simulado (incluida una respuesta que intenta cambiar valor, moneda, fecha y tarjeta), `effort`, la bandeja y la integración de la ruta con `after()`.
- Verificación: `pnpm typecheck`, `pnpm lint`, `pnpm test` (771 pasan, 13 omitidas que requieren variables), `pnpm test:coverage`, `supabase db reset`, `supabase test db` (477), integraciones locales (65), `pnpm build` y `pnpm test:ai`. Con `pnpm start`, la API real y un usuario local de prueba (borrado al terminar), tres alertas firmadas respondieron en 0,03 a 0,2 s. Después:
    - DirecTV quedó enlazado a su suscripción, en Suscripciones, con confianza alta.
    - ChatGPT recibió nombre limpio y categoría, sin dólares porque no había historial de Google.
    - El avance quedó leído (200.000, 21 nov, corte 15 dic) y en "Revisar".
    - `ai_usage` registró 4 llamadas (US$0,043) sin contenido, y el log del servidor no tiene frases ni respuestas.
    - Bandeja revisada a 360 px en modo oscuro.
