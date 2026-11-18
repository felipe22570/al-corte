# Paso 43 — Interpretación de alertas con IA

- **Hito PRD:** H12 (parte 4 de 6)
- **Estado:** ⬜ Pendiente
- **Inicio:**
- **Fin:**
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

- [ ] La IA no puede cambiar monto, moneda, fecha ni tarjeta del borrador (prueba con salida simulada que lo intenta).
- [ ] La verificación literal rechaza números inventados.
- [ ] `pnpm test:ai`: resultados anotados en las notas, por campo.

## Verificación

```
pnpm typecheck && pnpm lint && pnpm test && pnpm test:coverage
pnpm test:ai
```

## Criterios de terminado

- Commit: `feat: add AI interpretation for captured alerts`.

## Notas de progreso

<!-- Fecha — nota -->
