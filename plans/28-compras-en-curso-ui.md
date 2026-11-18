# Paso 28 — Compras en curso: formulario y vistas

- **Hito PRD:** H10 (parte 2 de 9)
- **Estado:** ✅ Terminado
- **Inicio:** 2026-11-17
- **Fin:** 2026-11-17
- **Commit:** `feat: add in-progress purchase form and installment progress` (ver historial de git)
- **Depende de:** 27
- **Decisiones aplicables (decididas, ver README):** D6, D31, D48, D49

## Objetivo

Registrar y consultar compras en curso desde la interfaz (F10).

## Contenido

- Formulario de gasto: opción "Ya pagué cuotas de esta compra" (solo con más de una cuota). Campos "Cuota" (k de N) y, opcional, "Saldo pendiente", con la ayuda "Copia la cuota y el saldo como aparecen en tu último extracto" (D49).
- Extracto de la cuota k: por defecto, el último extracto cerrado de la tarjeta; se puede cambiar al abierto. Si ese extracto no tiene nada más registrado, la vista previa avisa que solo tendrá esta cuota.
- La vista previa indica la cuota de ese extracto, cuántas faltan y si el plan cambia por un abono previo.
- La fecha de la compra puede ser anterior al extracto de la cuota k sin que la compra caiga en un extracto antiguo.
- Detalle del movimiento: tabla de amortización completa; las cuotas previas atenuadas con la etiqueta "Pagada antes de Al Corte".
- En listas, detalle de tarjeta, extracto y mes: "Cuota 4 de 12".
- Edición: mismas reglas que D6, sin perder las cuotas previas.

## Tareas

- [x] Formulario, validación Zod y Server Action.
- [x] Componentes de detalle y etiquetas de progreso.
- [x] Textos con la voz de `AGENTS.md`.

## Verificación

```
pnpm typecheck && pnpm lint && pnpm test
pnpm build && pnpm start
```

- [x] Registrar el IKEA de la Visa como compra en curso (cuota 3 en el extracto del 15 de noviembre) y comprobar extracto, mes y cupo.
- [x] Los valores con centavos se muestran en pesos enteros (D48).
- [x] 360 px y modo oscuro.

## Criterios de terminado

- Commit: `feat: add in-progress purchase form and installment progress`.

## Notas de progreso

<!-- Fecha — nota -->

- 2026-11-17 — Implementado. Formulario con "Ya pagué cuotas de esta compra" (o "de este avance"), campos Cuota (k de N), Saldo pendiente (opcional) y Extracto de esa cuota (último cerrado por defecto o abierto; al editar se conserva el original). Vista previa con "Cuota k de N", cuotas restantes, cambio de plan por el saldo, aviso de extracto sin movimientos y "sin comisión nueva" en avances. Detalle: cuotas previas atenuadas con "Pagada antes de Al Corte" (nuevo tono `muted` en `Money`). Tarjeta y extracto: "Cuota k de N".
- Verificación manual con `pnpm build && pnpm start` contra Supabase local y un usuario temporal (borrado al terminar): el IKEA en curso, con cuota 3 en el extracto del 15 de noviembre, dejó solo los extractos de noviembre y diciembre. Diciembre suma $117.661 (cuota 3) más el manejo, y el cupo usado es $290.626 (capital pendiente más manejo e interés facturado). Montos guardados con centavos ($117.660,89) y mostrados en pesos enteros. La edición conserva las cuotas previas. Sin desbordes a 360 px; revisado en modo claro y oscuro.
- Decisiones menores:
    - Con cuota fija (`french`) el formulario oculta el saldo y solo pide k (decisión del paso 27).
    - Al editar, "Cuotas" muestra el N original, y el saldo solo se precarga si cambió el plan (`original_installments_count`). Si el plan era consistente, queda vacío y se obtiene el mismo plan.
    - El aviso "Solo tendrá esta cuota" se basa en si el extracto ya existe (se crea con el primer movimiento). Se consultan los cortes de los últimos 70 días.
    - En el historial de movimientos se mantiene "N cuotas" (el plan), porque esa lista va por fecha de compra y no por extracto.
- Seguimiento: el error `refresh_token_not_found` en el log de `next start` vino de una cookie de sesión anterior al `supabase db reset`. Aparece antes de iniciar sesión y no está relacionado con este paso.
