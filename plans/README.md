# Al Corte — Plan de implementación del MVP

*Tus tarjetas, claras antes de cada corte.*

Este directorio divide la implementación del MVP de **Al Corte** (sección 4 y sección 11 de `docs/PRD.md`) en pasos pequeños. Cada paso vive en su propio archivo e incluye objetivo, tareas, archivos, pruebas e **instrucciones de verificación**.

## Cómo usar este plan

1. Busca en la tabla de abajo el primer paso que no esté en ✅.
2. Antes de empezar, lee `docs/PRD.md`, `AGENTS.md` y el archivo del paso. Revisa las decisiones que aplican al paso (tabla "Decisiones del dueño"). Si surge una ambigüedad nueva, pregúntale al dueño antes de escribir código y anótala en el registro de decisiones.
3. Cambia el estado del paso a 🟡 en la tabla y en el encabezado del archivo, y anota la fecha de inicio.
4. Ve marcando las casillas `- [ ]` de las tareas a medida que avances.
5. Ejecuta **todas** las verificaciones de la sección "Verificación". Solo si pasan, marca el paso como ✅, anota la fecha, el hash del commit y cualquier decisión en "Notas de progreso".
6. Haz un commit por paso (Conventional Commits, en inglés). Al cerrar un hito completo (H0…H8), confirma que se cumple también la "Definición de terminado" global.

Prompt sugerido para el agente al iniciar un paso:

> Lee docs/PRD.md, AGENTS.md, plans/README.md y plans/NN-<nombre>.md. Propón un plan corto para ese paso antes de escribir código.

## Leyenda de estados

- ⬜ Pendiente
- 🟡 En progreso
- ✅ Terminado y verificado
- ⛔ Bloqueado (anotar el motivo en el archivo del paso)

## Pasos

| # | Paso | Hito PRD | Estado | Commit |
| --- | --- | --- | --- | --- |
| 01 | [Base del proyecto (Next.js, Tailwind, shadcn, Vitest)](01-base-proyecto.md) | H0 | ✅ | 5cb88a1 |
| 02 | [Supabase local y autenticación](02-supabase-auth.md) | H0 | ✅ | |
| 03 | [Proyecto Supabase remoto y despliegue en Vercel](03-despliegue-vercel.md) | H0 | ✅ | a7ff0f9 |
| 04 | [Dominio: fechas y asignación al extracto (R1)](04-dominio-fechas-extractos.md) | H1 | ✅ | 4dc3c0e |
| 05 | [Dominio: dinero, tasas, cuotas y avances (R2, R3)](05-dominio-dinero-cuotas.md) | H1 | ✅ | 3f1ab5d |
| 06 | [Dominio: suscripciones y totales (R4, R5, R6)](06-dominio-suscripciones-totales.md) | H1 | ✅ | |
| 07 | [Base de datos: tablas, restricciones e índices](07-db-esquema.md) | H2 | ✅ | 21fa141 |
| 08 | [Base de datos: RLS, funciones SQL, vistas y tipos](08-db-rls-vistas-tipos.md) | H2 | ✅ | d18c975 |
| 09 | [Sistema de diseño de Al Corte](09-sistema-diseno.md) | H3 | ✅ | f1d82af |
| 10 | [Shell de la app: layout y navegación](10-shell-ui.md) | H3 | ✅ | 7592082 |
| 11 | [Tarjetas y categorías (CRUD)](11-tarjetas-categorias.md) | H3 | ✅ | d2fd29e |
| 12 | [Registro de movimientos y cuotas (RPC transaccional)](12-movimientos-registro.md) | H4 | ✅ | 491501f |
| 13 | [Detalle, edición y borrado de movimientos](13-movimientos-detalle-edicion.md) | H4 | ✅ | 491501f |
| 14 | [Extractos: detalle de tarjeta y de extracto](14-extractos.md) | H5 | ✅ | fdcf2db |
| 15 | [Suscripciones y cobro diario con pg_cron](15-suscripciones.md) | H6 | ✅ | Ver historial de git |
| 16 | [Tablero](16-tablero.md) | H7 | ✅ | Ver historial de git |
| 17 | [Historial con filtros y gráficos](17-historial.md) | H7 | ✅ | Ver historial de git |
| 18 | [Pulido funcional: estados, accesibilidad y exportación](18-pulido-exportacion.md) | H8 | ✅ | Ver historial de git |
| 19 | [Revisión y pulido del diseño visual](19-revision-diseno.md) | H8 | ✅ | Ver historial de git |
| 20 | [Validación final del MVP](20-validacion-mvp.md) | — | 🟡 | |

Paso actual: **20** (validación ejecutada en local aislado y producción; cierre pendiente de las comprobaciones externas detalladas en su plan). Pasan 117 pruebas de Vitest, 167 pruebas SQL, cobertura de dominio 100 %, build y lint. Se conservan los datos de la cuenta de validación en producción. Las correcciones de móvil están desplegadas y el registro público remoto quedó desactivado. La advertencia de RPC privilegiada se corrigió con una implementación privada y fachada pública `SECURITY INVOKER`; el dueño acepta la advertencia de contraseñas filtradas al mantener Supabase Free. El cron está activo; falta observar el cobro programado del 12 de noviembre de 2026 a las 05:00 de Bogotá. No se ha creado la etiqueta `mvp`.

El paso 19 conserva la aprobación visual general del dueño; sus capturas se eliminaron por su solicitud. En el paso 20 se repitieron las verificaciones de producción a 360/1280 px en ambos temas con axe-core y pruebas de teclado. Las limitaciones que requieren dispositivo físico, configuración de servicios o aprobación explícita no se dan por resueltas automáticamente.

El paso 09 solo depende del 02: se puede adelantar justo después del 03 para que el login y todo lo que siga nazcan con el diseño correcto.

## Definición de terminado (aplica a todos los pasos)

Tomada de `AGENTS.md`. Un paso solo pasa a ✅ si:

- `pnpm typecheck`, `pnpm lint` y `pnpm test` pasan sin errores.
- `supabase db reset` aplica todas las migraciones sin errores (desde el paso 02).
- `lib/database.types.ts` está regenerado si cambió el esquema.
- La UI nueva funciona a 360 px de ancho y en modo oscuro (desde el paso 09).
- La UI nueva solo usa colores, radios y estilos de texto de `app/globals.css` (desde el paso 09 lo verifica `pnpm lint` con `scripts/check-design.mjs`).
- No quedan `console.log`, código comentado ni `TODO` sin explicar.
- Ningún archivo `.env*` con valores reales está en git.

Comando de verificación rápida (desde el paso 02):

```
pnpm typecheck && pnpm lint && pnpm test && supabase db reset && supabase test db
```

## Dependencias previstas

AGENTS.md pide justificar cada dependencia. Estas son las previstas por el stack del PRD; cualquier otra debe justificarse en el paso donde se agregue.

| Paquete | Paso | Motivo |
| --- | --- | --- |
| next, react, react-dom, typescript | 01 | Framework del PRD. |
| tailwindcss y dependencias de shadcn/ui (radix, lucide-react, class-variance-authority, clsx, tailwind-merge) | 01 | Interfaz del PRD. |
| vitest, @vitest/coverage-v8 | 01 | Pruebas; el PRD exige 100% de cobertura en `lib/domain/`, por eso se necesita el proveedor de cobertura. |
| decimal.js, date-fns, date-fns-tz | 04 | Dinero exacto y fechas en `America/Bogota`. |
| @supabase/supabase-js, @supabase/ssr | 02 | Clientes de Supabase con sesión en cookies para App Router. |
| react-hook-form, @hookform/resolvers, zod | 11 | Formularios y validación compartida. |
| next-themes | 09 | Modo claro/oscuro con la clase `.dark` (stack de `AGENTS.md`). |
| Geist y Bricolage Grotesque (`next/font/google`) | 09 | Tipografía de Al Corte (stack de `AGENTS.md`); no es un paquete npm. |
| recharts | 17 | Gráficos del PRD (shadcn/ui `chart` lo usa por debajo). |
| @playwright/test (opcional) | 19 | Capturas automáticas para la revisión de diseño. Solo si el dueño lo aprueba. |

Pruebas de base de datos: se usa `supabase test db` (pgTAP, incluido en el CLI de Supabase), sin dependencias de npm.

## Diseño técnico transversal

- **Fechas como strings `YYYY-MM-DD`.** La aritmética de calendario en `lib/domain/dates.ts` se hace sobre año/mes/día enteros, sin pasar por `Date` con zona. Solo `todayInBogota()` usa `date-fns-tz` para obtener el día actual.
- **Montos siempre positivos.** El signo lo da el `type`: `payment` y `refund` son abonos; todo lo demás son cargos.
- **R1 vive en dos lugares.** En TypeScript (`lib/domain/`) para la UI y las Server Actions, y en SQL para la tarea de `pg_cron` y la creación de extractos dentro de las RPC. Las pruebas pgTAP del paso 08 replican los mismos casos que las pruebas de Vitest del paso 04 para evitar que diverjan.
- **Cuotas.** Solo se crean filas en `installments` cuando `installments_count > 1`. Una compra de 1 cuota cuenta en el extracto por `transactions.statement_id`; una compra a N cuotas cuenta solo por sus `installments`.
- **Redondeo.** Montos en COP: `ROUND_HALF_UP` a pesos enteros por cuota (capital e interés por separado); la última cuota absorbe la diferencia de capital. USD: 2 decimales.
- **Cuotas en USD (D3).** Una compra en USD se amortiza en USD (centavos, la última cuota absorbe la diferencia para que Σ capital = `amount`). Cada cuota guarda además su equivalente en COP (`principal_cop`, `interest_cop`, `total_cop`) con la TRM de la compra, redondeado a pesos, y la última cuota absorbe la diferencia para que Σ `principal_cop` = `amount_cop`. Los totales de extractos, cupo y gráficos usan siempre las columnas `_cop`. Para cuotas en COP, las columnas `_cop` son iguales a las originales.
- **Vistas con `security_invoker = true`** para que respeten RLS.
- **`user_id` con `default auth.uid()`** en todas las tablas con dueño; la tarea de `pg_cron` lo escribe explícitamente desde la suscripción.

## Diseño (resumen para el plan)

La fuente de verdad es la sección "Diseño" de `AGENTS.md` y los tokens de `app/globals.css`. Cómo se aplica en el plan:

- **Paso 09** monta el sistema: fuentes, tema, componentes base adaptados, `lib/format.ts`, componentes de presentación (`Money`, `StatusBadge`, `CardColorChip`, `UtilizationBar`, `PageHeader`, `EmptyState`), reglas de color de estados en `lib/ui-status.ts`, `scripts/check-design.mjs` dentro de `pnpm lint`, prueba de contraste de tokens y un catálogo en desarrollo.
- **Pasos 10–18** solo combinan esas piezas; cada uno revisa 360 px, modo oscuro y `check-design`.
- **Paso 19** es la revisión visual completa con aprobación del dueño.
- `cards.color` guarda `card-1` … `card-6` (con `check` en la base), nunca un hex.
- Umbrales de estado (de `AGENTS.md`): pago en 5 días o menos → ámbar; vencido o sobrecupo → rojo; utilización < 30% verde, 30–70% ámbar, > 70% rojo; pagado → verde. Siempre con texto.
- Abonos, pagos y la comparación de gasto entre meses **no** usan verde ni rojo: no son estados.

## Contradicciones detectadas entre PRD y AGENTS.md

- `AGENTS.md` dice "Toda tabla nueva tiene `user_id`", pero el PRD (sección 6) define `fx_rates` **sin** `user_id` y con lectura para cualquier usuario autenticado. Manda el PRD: `fx_rates` no lleva `user_id`, tiene RLS activado con una política de solo lectura para `authenticated` y sin políticas de escritura (en el MVP solo se escribe desde migraciones o seed; en v2 desde la Edge Function con `service_role`).
- El PRD dice "Ocho tablas" e incluye `notification_log`, que solo se usa en v2. Se crea en el MVP (paso 07) para cumplir el hito H2, pero sin lógica.
- Dentro de `AGENTS.md`: la sección "Dinero" dice `Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' })` y la de "Diseño" agrega `maximumFractionDigits: 0` y muestra `$1.284.500` sin espacio, aunque `Intl` produce `$ 1.284.500`. Se sigue la de "Diseño", que es más específica (ver D13).
- `AGENTS.md` pide guardar el color de la tarjeta como clave (`card-3`); el PRD solo dice `color`. No es contradicción, es una precisión: se aplica en el paso 07.
- El PRD define `categories.color`, pero `AGENTS.md` reserva los colores para estados y tarjetas. Ver D11.

## Decisiones del dueño

El PRD no cubría estos puntos o los dejaba ambiguos. Todas quedaron **decididas el 2026-11-09**: D3 con un cambio pedido por el dueño y las demás con la propuesta por defecto. Si algún paso necesita cambiar una de estas reglas, se consulta antes con el dueño y se anota en el registro de decisiones.

| # | Tema | Decisión | Paso afectado |
| --- | --- | --- | --- |
| D1 | **Cuota de manejo:** ¿se genera sola por extracto o se registra a mano? | Se genera automáticamente un movimiento `handling_fee` (fecha = fecha de corte) al crear cada extracto, si la tarjeta tiene `handling_fee > 0`. Idempotente con un índice único parcial `(statement_id) where type = 'handling_fee' and source = 'system'`. Requiere agregar `system` a `source`. | 07, 08, 12 |
| D2 | **Cupo disponible (R5):** qué cuenta como "capital pendiente". | Usado = Σ capital completo de cargos (compras, avances, comisiones, cuotas de manejo, intereses, seguros, ajustes) + Σ intereses de cuotas ya facturadas (extractos con `cutoff_date` ≤ hoy) − Σ pagos − Σ devoluciones. Disponible = cupo − usado. | 06, 08 |
| D3 | **Compras en USD:** ¿las cuotas se calculan en COP o en USD? (pregunta abierta del PRD). | **Cambiada por el dueño:** las cuotas se calculan **en USD** sobre `amount` (redondeo a centavos, la última cuota absorbe la diferencia). Al registrar se guarda `amount_cop = round(amount × fx_rate)` y cada cuota guarda su equivalente en COP (`principal_cop`, `interest_cop`, `total_cop`) con la TRM de la compra; la última cuota absorbe la diferencia para que Σ `principal_cop` = `amount_cop`. Los totales en COP son estimados hasta la conciliación (v2). | 05, 07, 08, 12, 13, 14 |
| D4 | **TRM en el MVP:** de dónde sale el valor precargado y qué usa el cobro automático de suscripciones en USD. | Formulario: precarga la fila más reciente de `fx_rates`; si no hay, la TRM del último movimiento en USD del usuario. Cron: la misma regla; si no hay ninguna TRM, no genera el cobro y lo reintenta al día siguiente (recuperación de 7 días). | 12, 15 |
| D5 | **"Gasto del mes"** en tablero e historial. | Suma en COP de compras (valor completo, aunque sea a cuotas), avances y cobros de suscripciones con fecha dentro del mes calendario en Bogotá, menos devoluciones. Excluye pagos, intereses, comisiones, cuotas de manejo y seguros. | 06, 16, 17 |
| D6 | **Editar una compra con cuotas ya en extractos pagados.** | Se permite editar y se regeneran todas las cuotas (como dice el PRD), pero la UI muestra una advertencia si alguna cuota cae en un extracto con `paid_at`. | 13 |
| D7 | **Fecha de pago igual al día de corte o fecha límite "posterior".** | "Posterior" es estricto: si el `payment_day` del mismo mes es ≤ fecha de corte, se toma el del mes siguiente. | 04 |
| D8 | **Avance a 1 cuota:** ¿genera interés? | Sigue la regla general: 1 cuota = sin interés. | 05 |
| D9 | **Categorías iniciales:** cómo se crean para el usuario. | Trigger `after insert on auth.users` que inserta las 11 categorías del PRD, más un `insert` idempotente en la migración para usuarios ya existentes. | 07 |
| D10 | **Cambio de día de corte** (pregunta abierta del PRD). | Fuera del MVP: el día de corte se puede editar, pero solo afecta movimientos nuevos; los extractos existentes no se recalculan. La UI lo advierte. | 11 |
| D15 | **Máximo de cuotas.** Límite de validación para compras y avances. | Máximo de 36 cuotas. | 05, 12 |
| D16 | **Ajustes de conciliación.** Signo de los movimientos `adjustment`. | `adjustment` siempre es un cargo y suma al extracto; una corrección a favor se registra como `refund`. | 06, 08, 14 |

### Decisiones de diseño

Salen de comparar `AGENTS.md`, el PRD y `app/globals.css`. D11, D12, D13 y el alias `chart-6` fueron aprobados el 2026-11-10; D14 fue aprobado el 2026-11-11.

| # | Tema | Propuesta por defecto | Paso afectado |
| --- | --- | --- | --- |
| D11 | **Color de categorías.** El PRD tiene `categories.color`, pero `AGENTS.md` solo permite colores de estado y de tarjeta, y `--chart-1`…`--chart-5` son los mismos colores de tarjeta. | Las categorías se identifican con **icono de Lucide + nombre**, sin color. La columna `color` queda en `null`. El gráfico por categoría usa barras horizontales en un solo color neutro; el gráfico mensual apila por tarjeta con `--card-N`. | 07, 11, 17 |
| D12 | **Campos de formulario.** `--border` tiene 1,3:1 de contraste contra `--surface-raised` (WCAG pide 3:1 para el borde de un control) y `text-body` es de 15px (iOS hace zoom en campos con texto menor a 16px). | Agregar en `globals.css` un token `--input` más oscuro (≥ 3:1 en ambos temas) solo para bordes de campos y una utilidad `text-input` de 16px para campos. Requiere tu aprobación porque cambia la paleta. Alternativa: dejarlo así y aceptar el zoom en iOS. | 09 |
| D13 | **Formato de pesos.** `Intl` da `$ 1.284.500`; `AGENTS.md` muestra `$1.284.500`. | `lib/format.ts` quita el espacio entre `$` y el número en COP; USD queda `US$ 15,99` como dice `AGENTS.md`. | 09 |
| D14 | **Favicon.** No hay logo y `AGENTS.md` prohíbe inventarlo, pero hoy está el favicon de Next.js. | Quitar el favicon de Next.js y dejar uno neutro temporal (un cuadrado con `--primary`, sin letras ni símbolos) hasta que exista un logo. | 19 |

Además, `globals.css` define `--card-6` pero no `--chart-6`. El paso 09 puede agregar `--chart-6: var(--card-6)` para mantener la paridad, con tu visto bueno.

Preguntas abiertas del PRD que no bloquean el MVP: corte variable ("último día hábil"), notificaciones push (v2). Se dejan anotadas en `docs/PRD.md`.

## Registro de decisiones

Anota aquí cada decisión tomada durante la implementación (fecha, paso, decisión, motivo).

| Fecha | Paso | Decisión | Motivo |
| --- | --- | --- | --- |
| 2026-11-09 | Todos | D1, D2, D4–D10 aprobadas con la propuesta por defecto. | Confirmación del dueño. |
| 2026-11-09 | Todos | Nombre "Al Corte", tokens de `globals.css` y sección "Diseño" de `AGENTS.md` incorporados al plan. Nuevo paso 09 (sistema de diseño) y paso 19 (revisión visual); los pasos 09–18 anteriores pasan a 10–18 y 20. | Pedido del dueño. |
| 2026-11-09 | 05, 06, 07, 08, 12, 13, 14 | D3: las cuotas de compras en USD se calculan en USD, con su equivalente en COP por cuota. | Pedido del dueño. |
| 2026-11-09 | 05, 12 | D15: el máximo de cuotas para compras y avances es 36. | Pedido del dueño. |
| 2026-11-09 | 06, 08, 14 | D16: los ajustes son cargos; las correcciones a favor se registran como devoluciones. | Confirmación del dueño. |
| 2026-11-10 | 09 | Aprobadas D11, D12, D13 y `--chart-6: var(--card-6)`. | Confirmación del dueño. |
| 2026-11-10 | 13 | Al editar se conserva la tasa original si no cambian tarjeta ni tipo; de lo contrario se usa la tasa vigente de la nueva selección. | Confirmación del dueño. |
| 2026-11-10 | 15 | Al guardar una suscripción, se genera el cobro correspondiente a hoy si aplica, sin esperar al siguiente cron. | Confirmación del dueño. |
| 2026-11-11 | 16 | Mostrar primero el extracto no pagado de vencimiento más antiguo, incluso si está vencido. | Confirmación del dueño. |
| 2026-11-11 | 20 | Mantener Supabase Free y aceptar `auth_leaked_password_protection` como limitación del plan. | El intento de activación devuelve HTTP 402 y exige Pro o superior; el dueño elige no cambiar de plan. |
