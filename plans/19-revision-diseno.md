# Paso 19 — Revisión y pulido del diseño visual

- **Hito PRD:** H8 (parte 2 de 2) — **H8 termina aquí**
- **Estado:** ⬜ Pendiente
- **Inicio:** —
- **Fin:** —
- **Commit:** —
- **Depende de:** 18
- **Decisiones aplicables (ver README):** D11, D12, D13, D14 (favicon sin logo)

## Objetivo

Que Al Corte se vea terminado y coherente: cada pantalla cumple la sección "Diseño" de `AGENTS.md`, se ve bien a 360 px y en escritorio, en claro y en oscuro, y el dueño aprueba el resultado. Aquí no se agregan funciones: solo se corrigen y afinan diseño, textos y detalles de interacción.

## Cómo se trabaja este paso

1. **Auditoría automática** (tareas de abajo) → lista de hallazgos.
2. **Recorrido pantalla por pantalla** con la checklist → lista de hallazgos con captura.
3. Anotar todos los hallazgos en la tabla "Hallazgos" de este archivo, con prioridad (alta: rompe una regla de `AGENTS.md` o la legibilidad; media: inconsistencia; baja: detalle).
4. Corregir todos los de prioridad alta y media; los de prioridad baja, según lo que acuerde el dueño.
5. **Revisión con el dueño:** capturas de cada pantalla en 360 px y 1280 px, en claro y oscuro. El dueño aprueba o pide cambios; cada cambio pedido se anota como hallazgo.
6. Repetir 4–5 hasta que el dueño apruebe.

## Tareas

Auditoría automática

- [ ] `pnpm lint` (incluye `check-design` del paso 09) sin hallazgos y sin excepciones `design-allow` injustificadas (revisar cada una).
- [ ] `pnpm test` incluye la prueba de contraste de tokens en verde.
- [ ] Buscar colores de estado usados como decoración: `grep -rnE "(text|bg|border)-(primary|warning|danger)" app components` y confirmar que cada uso corresponde a un estado de la tabla de `AGENTS.md` o a la acción principal.
- [ ] Contar botones primary por pantalla (variante `default` de `Button` y el FAB): exactamente uno, o ninguno si la pantalla no tiene acción principal.
- [ ] Buscar montos sin estilo: todo `Money`/formateador de `lib/format.ts` se renderiza con `text-amount` o `text-amount-lg`; ningún monto formateado a mano.
- [ ] Buscar iconos fuera de la regla: `grep -rn "lucide-react" app components` y revisar `size-5` + `strokeWidth={1.75}` (o un componente `Icon` que lo fije).
- [ ] Lighthouse móvil (build de producción): Accesibilidad ≥ 95, Buenas prácticas ≥ 95, LCP del tablero < 1,5 s (meta del PRD), CLS < 0,1 (las fuentes con `next/font` no deben mover el contenido).
- [ ] axe DevTools (extensión del navegador, sin dependencia en el repo) en cada pantalla, en claro y oscuro: 0 problemas serios o críticos.

Recorrido por pantalla (checklist de diseño)

Para cada pantalla, verificar:

- **Monto protagonista:** hay un monto con `text-amount-lg` y es lo primero que se lee.
- **Un solo primary.**
- **Color con significado:** verde = al día, ámbar = pronto, rojo = vencido o sobrecupo; siempre acompañados de texto.
- **Colores de tarjeta** solo en chip, franja o serie de gráfico, siempre junto al nombre o los últimos 4 dígitos.
- **Bordes, no sombras** (salvo hojas, menús y diálogos).
- **Radios:** `rounded-sm` etiquetas, `rounded-md` botones y campos, `rounded-xl` tarjetas y hojas, `rounded-full` FAB y barras.
- **Tipografía:** título de pantalla en Bricolage Grotesque (`text-title`), el resto en Geist con los estilos de texto del tema; montos alineados a la derecha en listas y tablas.
- **Espaciado:** retícula de 4px, `p-4`/`px-4` en el celular, `gap-6` entre secciones; nada pegado a los bordes a 360 px.
- **Áreas táctiles ≥ 44 × 44 px.**
- **Iconos** Lucide `size-5`, `strokeWidth={1.75}`, `text-muted-foreground` salvo en estados; sin emojis ni ilustraciones; ningún icono usado como logo.
- **Textos:** tuteo, frases cortas, sin exclamaciones ni tono alarmista; formatos de `lib/format.ts` (`$1.284.500`, `US$ 15,99`, `vie 15 nov`, `68%`, `28,45% E.A.`); "Al Corte" bien escrito.
- **Modo oscuro:** sin superficies que "brillen", bordes visibles, gráficos legibles, sin blancos puros heredados de shadcn/ui.
- **Estados de interacción:** hover, foco (`ring`), activo, deshabilitado y cargando se ven en todos los controles.
- **Movimiento:** transiciones cortas y discretas; nada se anima con `prefers-reduced-motion: reduce`.

| Pantalla | 360 claro | 360 oscuro | 1280 claro | 1280 oscuro | Checklist de diseño | Aprobada por el dueño |
| --- | --- | --- | --- | --- | --- | --- |
| `/login` | | | | | | |
| `/` | | | | | | |
| `/movimientos` | | | | | | |
| `/movimientos/nuevo` | | | | | | |
| `/movimientos/[id]` | | | | | | |
| `/tarjetas/[id]` | | | | | | |
| `/tarjetas/[id]/extractos/[cutoff]` | | | | | | |
| `/suscripciones` | | | | | | |
| `/ajustes` | | | | | | |
| Hojas y diálogos (formularios de tarjeta, categoría, suscripción, confirmaciones) | | | | | | |
| `loading`, `error`, `not-found` | | | | | | |

Consistencia entre pantallas

- [ ] La misma tarjeta tiene el mismo color en tablero, detalle, historial, selector y gráficos.
- [ ] Los mismos conceptos usan las mismas palabras en todas partes (p. ej. siempre "extracto", nunca "factura").
- [ ] Mismas distancias entre título y contenido, y entre secciones, en todas las pantallas.
- [ ] Listas: misma altura de fila, mismo orden de columnas (descripción a la izquierda, monto a la derecha).
- [ ] Números grandes: probar con montos de 10 dígitos (`$1.234.567.890`) y nombres de comercio largos a 360 px; nada se corta sin `truncate` y `title`.

Marca

- [ ] "Al Corte" aparece como marca tipográfica (`font-display`, `text-display`) en el login y en la navegación de escritorio; en ningún lugar hay un logo inventado ni un icono haciendo de logo.
- [ ] Favicon y metadatos según D14: quitar el favicon por defecto de Next.js.
- [ ] Títulos de pestaña con la plantilla `%s · Al Corte` en todas las rutas.

Capturas para la revisión con el dueño

- [ ] Tomar capturas de cada pantalla en 360 × 800 y 1280 × 800, claro y oscuro, con datos de ejemplo realistas (2–3 tarjetas, compras a cuotas, una suscripción en USD, un extracto vencido) y guardarlas en `docs/design-review/YYYY-MM-DD/` (o compartirlas por fuera del repo si el dueño lo prefiere).
- [ ] Opcional, solo con aprobación del dueño: automatizar las capturas con Playwright (`@playwright/test` como dependencia de desarrollo; justificación: repetir la revisión en cada cambio sin hacerlo a mano). Si no se aprueba, capturas manuales con DevTools.

## Hallazgos

| # | Pantalla | Hallazgo | Regla | Prioridad | Estado |
| --- | --- | --- | --- | --- | --- |
| | | | | | |

## Verificación

```
pnpm typecheck && pnpm lint && pnpm test && pnpm test:coverage
pnpm build
```

- [ ] Tabla de pantallas completa, incluida la columna "Aprobada por el dueño".
- [ ] Todos los hallazgos de prioridad alta y media en estado "Corregido".
- [ ] Resultados de Lighthouse y axe anotados en "Notas de progreso".

## Criterios de terminado

- El dueño aprueba el diseño de todas las pantallas → **H8 terminado**.
- Commit: `style: polish visual design across screens`.
- Etiqueta opcional: `git tag h8`.

## Notas de progreso

<!-- Fecha — nota -->
