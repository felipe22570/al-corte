# Paso 28 — Compras en curso: formulario y vistas

- **Hito PRD:** H10 (parte 2 de 9)
- **Estado:** ⬜ Pendiente
- **Inicio:**
- **Fin:**
- **Commit:**
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

- [ ] Formulario, validación Zod y Server Action.
- [ ] Componentes de detalle y etiquetas de progreso.
- [ ] Textos con la voz de `AGENTS.md`.

## Verificación

```
pnpm typecheck && pnpm lint && pnpm test
pnpm build && pnpm start
```

- [ ] Registrar el IKEA de la Visa como compra en curso (cuota 3 en el extracto del 15 de noviembre) y comprobar extracto, mes y cupo.
- [ ] Los valores con centavos se muestran en pesos enteros (D48).
- [ ] 360 px y modo oscuro.

## Criterios de terminado

- Commit: `feat: add in-progress purchase form and installment progress`.

## Notas de progreso

<!-- Fecha — nota -->
