# Paso 19 — Revisión y pulido del diseño visual

- **Hito PRD:** H8 (parte 2 de 2) — **H8 termina aquí**
- **Estado:** ✅ Aprobado por el dueño, con verificaciones pendientes indicadas abajo
- **Inicio:** 2026-11-11
- **Fin:** 2026-11-11
- **Commit:** Ver historial de git
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

- [x] `pnpm lint` (incluye `check-design` del paso 09) sin hallazgos y sin excepciones `design-allow` injustificadas (revisar cada una).
- [x] `pnpm test` incluye la prueba de contraste de tokens en verde.
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
| `/login` | Capturada | Capturada | Capturada | Capturada | Parcial | Sí, aprobación general |
| `/` | Capturada | Capturada | Capturada | Capturada | Parcial | Sí, aprobación general |
| `/movimientos` | Capturada | Capturada | Capturada | Capturada | Parcial | Sí, aprobación general |
| `/movimientos/nuevo` | Capturada | Capturada | Capturada | Capturada | Parcial | Sí, aprobación general |
| `/movimientos/[id]` | Capturada | Capturada | Capturada | Capturada | Parcial | Sí, aprobación general |
| `/tarjetas/[id]` | Capturada | Capturada | Capturada | Capturada | Parcial | Sí, aprobación general |
| `/tarjetas/[id]/extractos/[cutoff]` | Capturada | Capturada | Capturada | Capturada | Parcial | Sí, aprobación general |
| `/suscripciones` | Capturada | Capturada | Capturada | Capturada | Parcial | Sí, aprobación general |
| `/ajustes` | Capturada | Capturada | Capturada | Capturada | Parcial | Sí, aprobación general |
| Hojas y diálogos (formularios de tarjeta, categoría, suscripción, confirmaciones) | Formularios | Formularios | Formularios | Formularios | Parcial; confirmaciones nativas sin captura | Sí, aprobación general |
| `loading`, `error`, `not-found` | Capturada | Capturada | Capturada | Capturada | Parcial; carga y error simulados | Sí, aprobación general |

Las capturas se eliminaron a solicitud del dueño después de su aprobación general.

Consistencia entre pantallas

- [ ] La misma tarjeta tiene el mismo color en tablero, detalle, historial, selector y gráficos.
- [ ] Los mismos conceptos usan las mismas palabras en todas partes (p. ej. siempre "extracto", nunca "factura").
- [ ] Mismas distancias entre título y contenido, y entre secciones, en todas las pantallas.
- [ ] Listas: misma altura de fila, mismo orden de columnas (descripción a la izquierda, monto a la derecha).
- [ ] Números grandes: probar con montos de 10 dígitos (`$1.234.567.890`) y nombres de comercio largos a 360 px; nada se corta sin `truncate` y `title`.

Marca

- [ ] "Al Corte" aparece como marca tipográfica (`font-display`, `text-display`) en el login y en la navegación de escritorio; en ningún lugar hay un logo inventado ni un icono haciendo de logo.
- [x] Favicon y metadatos según D14: quitar el favicon por defecto de Next.js.
- [ ] Títulos de pestaña con la plantilla `%s · Al Corte` en todas las rutas.

Capturas para la revisión con el dueño

- [ ] Tomar capturas de cada pantalla en 360 × 800 y 1280 × 800, claro y oscuro, con datos de ejemplo realistas (2–3 tarjetas, compras a cuotas, una suscripción en USD, un extracto vencido) y guardarlas en `docs/design-review/YYYY-MM-DD/` (o compartirlas por fuera del repo si el dueño lo prefiere).
- [ ] Opcional, solo con aprobación del dueño: automatizar las capturas con Playwright (`@playwright/test` como dependencia de desarrollo; justificación: repetir la revisión en cada cambio sin hacerlo a mano). Si no se aprueba, capturas manuales con DevTools.

## Hallazgos

| # | Pantalla | Hallazgo | Regla | Prioridad | Estado |
| --- | --- | --- | --- | --- | --- |
| 1 | Formularios y ajustes | La utilidad tipográfica `text-input` colisionaba con el color de borde de Tailwind y producía texto de bajo contraste en campos y selectores. | Contraste y legibilidad | Alta | Corregido; axe-core repetido en claro y oscuro. |
| 2 | `/login` | La página no tenía encabezado de nivel 1. | Accesibilidad | Media | Corregido; axe-core repetido en claro y oscuro. |
| 3 | Detalle de movimiento, tarjeta y extracto | Algunos enlaces medían 19–22 px de alto, por debajo del área táctil mínima de 44 px. | Áreas táctiles | Alta | Corregido; verificado a 360 px con el desglose abierto. |
| 4 | Marca | `app/favicon.ico` mostraba el favicon predeterminado de Next.js. | Marca, D14 | Media | Corregido: cuadrado neutro aprobado por el dueño. |
| 5 | Gráficos del historial | Los montos de las ayudas emergentes no usaban `text-amount`. | Tipografía de montos | Media | Corregido y capturado en ambos temas. |
| 6 | Gráficos del historial | Las ayudas emergentes mantenían una transición con movimiento reducido. | Movimiento reducido | Alta | Corregido; transición calculada de 0 s con `reduce`. |

## Verificación

```
pnpm typecheck && pnpm lint && pnpm test && pnpm test:coverage
pnpm build
```

- [x] Tabla de pantallas completa, incluida la columna "Aprobada por el dueño".
- [x] Todos los hallazgos de prioridad alta y media en estado "Corregido".
- [x] Resultados de Lighthouse y axe-core anotados en "Notas de progreso".

## Criterios de terminado

- El dueño aprueba el diseño de todas las pantallas → **H8 terminado**.
- Commit: `style: polish visual design across screens`.
- Etiqueta opcional: `git tag h8`.

## Notas de progreso

<!-- Fecha — nota -->

2026-11-11 — Primera pasada con datos ficticios en Supabase local y servidor de producción local. Se guardaron capturas de las rutas principales y del formulario de tarjeta en `docs/design-review/2026-11-11/`; la revisión de diálogos, estados y de la checklist todavía no está completa. Las capturas móviles de páginas con contenedores desplazables pueden mostrar solo la parte visible. Falta revisar el contenido restante y repetir las capturas que correspondan. La aprobación del dueño está pendiente.

`pnpm typecheck`, `pnpm lint`, `pnpm test` (112 pruebas), `pnpm test:coverage` (100 % en los archivos cubiertos) y `pnpm build` pasaron. Lighthouse móvil del tablero: accesibilidad 100 y buenas prácticas 100; informes en la carpeta de capturas. Esa auditoría no midió LCP ni CLS. Pendientes: medición de rendimiento, axe por pantalla y tema, auditoría detallada de las reglas visuales, corrección de hallazgos y `supabase db reset` (no ejecutado para no borrar los datos locales sin autorización). D14 sigue pendiente de decisión del dueño.

2026-11-11 — Segunda pasada: corregidos los hallazgos 1 y 2 y actualizadas las capturas; se añadieron imágenes del final de páginas, formularios de categoría y suscripción y página no encontrada. Axe-core 4.14, ejecutado a 360 px en claro y oscuro sobre login, nueve rutas autenticadas y tres formularios abiertos, no reporta infracciones; sus resultados incluyen comprobaciones `incomplete` que requieren revisión manual y no equivalen a una auditoría completa con la extensión axe DevTools. Traza local de producción con 4G rápida simulada, CPU 4× y caché desactivada: LCP 530 ms, CLS 0,00; no representa tiempos de producción. Última verificación: `pnpm typecheck`, `pnpm lint`, `pnpm test:coverage` (113 pruebas, 100 % en los archivos cubiertos) y `pnpm build` pasaron. Siguen pendientes la auditoría visual completa y de interacciones, capturas de estados de carga/error y confirmaciones, revisión manual de resultados incompletos, D14 y aprobación del dueño.

2026-11-11 — Tercera pasada: capturas de carga y error simulados mediante los componentes reales, y pruebas con nombres largos y un cupo de $1.234.567.890 a 360 px; no hubo desbordamiento horizontal en tablero, movimientos, detalle y ajustes. Los datos ficticios se restauraron. Los resultados incompletos de axe se revisaron: contraste de ejes SVG 5,97:1 claro y 7,42:1 oscuro; signo de devolución 16,70:1 y 14,66:1; el foco del diálogo de suscripción permaneció dentro durante 20 pulsaciones de Tab y al intentar enfocarlo fuera. Las confirmaciones nativas de borrar, archivar tarjeta/categoría y cancelar suscripción se abrieron y cancelaron sin modificar datos; Chrome DevTools no permite capturarlas mientras están abiertas. Se detectaron los hallazgos 3 y 4. Falta corregirlos, completar la revisión visual y obtener aprobación.

2026-11-11 — El dueño aprobó D14: cuadrado neutro con los colores primarios existentes, sin letras ni símbolos. Se reemplazó el favicon predeterminado y se agregó una prueba que mantiene el SVG sincronizado con ambos temas.

2026-11-11 — Corregido el hallazgo 3: enlaces de texto y filas del desglose tienen al menos 44 px de alto; se actualizó la captura del extracto con los desgloses abiertos. Se midieron los controles visibles de las nueve rutas autenticadas a 360 px con detalles abiertos: el único control visual menor es la casilla de 20 px, cuyo `label` clicable mide 279 × 44 px. Axe-core no reportó infracciones en las tres pantallas corregidas en claro ni oscuro; el resultado incompleto del extracto corresponde al signo de devolución revisado antes. También se guardaron capturas del error de validación de valor vacío. `pnpm typecheck`, `pnpm lint`, `pnpm test:coverage` (114 pruebas y 100 % en los archivos cubiertos) y `pnpm build` pasaron. Continúan pendientes la revisión visual completa de la checklist y la aprobación del dueño.

2026-11-11 — Se revisaron las ayudas emergentes de los gráficos y se corrigieron los hallazgos 5 y 6. Con `prefers-reduced-motion: reduce`, la transición calculada de las ayudas es de 0 s; se guardaron capturas de las ayudas en escritorio, en ambos temas. La tabla registra capturas existentes, no una aprobación ni una checklist completa.

2026-11-11 — El dueño aprueba el resultado visual por el momento y solicita eliminar `docs/design-review/`; se borraron las capturas y los informes de esa carpeta. La aprobación es general, no certifica cada punto pendiente de la checklist. Permanecen sin verificar exhaustivamente los puntos sin marcar, axe DevTools como extensión y `supabase db reset`; axe-core se usó como alternativa parcial. Llevar esas limitaciones a la validación final del paso 20 y solicitar autorización antes de cualquier reset que borre datos locales.
