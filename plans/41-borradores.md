# Paso 41 — Borradores por confirmar

- **Hito PRD:** H12 (parte 2 de 6)
- **Estado:** ⬜ Pendiente
- **Inicio:**
- **Fin:**
- **Commit:**
- **Depende de:** 40; revisión de importaciones de H11 si ya existe
- **Decisiones aplicables (decididas, ver README):** D46, D47

## Objetivo

Una bandeja "Por confirmar" para movimientos capturados automáticamente, separada de los movimientos reales (F18).

## Contenido

- Migración: tabla `transaction_drafts` con RLS por `user_id`: origen (`email_alert`), identificador externo único, frase original, campos extraídos por reglas, sugerencias de IA (JSON validado), tarjeta asignada o nula, estado (`pending`, `needs_review`, `unknown_card`, `confirmed`, `discarded`) y fechas.
- Ninguna consulta de extractos, meses, totales ni cupo lee esta tabla.
- Nombres: ya existe `lib/transaction-draft.ts`, que guarda en `localStorage` el borrador del formulario de gasto. Se renombra a `lib/transaction-form-draft.ts` (con sus pruebas e imports) para que "borrador" en código se refiera solo a los capturados.
- Vista `/por-confirmar`. No es un quinto destino de la navegación (D25): el contador aparece solo cuando hay borradores, como un aviso en Meses que enlaza a la bandeja; la ubicación exacta se valida con el dueño antes de implementarla. Cada borrador muestra los datos del correo, las sugerencias marcadas como tales (con su nivel de confianza) y avisos como "DirecTV cobró $140.910; tu suscripción dice $83.350".
- Confirmar abre el formulario de gasto prellenado (cuotas, categoría, moneda de facturación, compra en curso). Al guardar se crea el movimiento real con `source = email`, se marca el borrador como confirmado y se borra la frase original.
- Descartar borra la frase original y conserva solo el identificador para no volver a crear el borrador.
- Duplicados: si existe un movimiento de la misma tarjeta, valor y fecha, se ofrece "Es el mismo" para enlazarlos sin crear otro (columna `transaction_id` del borrador).
- Exportación: los borradores no se exportan, porque pueden contener la frase original del correo; se anota en Ajustes junto a la exportación.

## Pruebas

- [ ] Un borrador pendiente no cambia ningún total del mes ni el cupo.
- [ ] Confirmar crea exactamente un movimiento y vacía la frase original.
- [ ] El mismo identificador externo nunca crea dos borradores.

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
