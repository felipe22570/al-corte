# Al Corte — Plan de implementación del MVP

*Tus tarjetas, claras antes de cada corte.*

Este directorio divide la implementación del MVP de **Al Corte** (sección 4 y sección 11 de `docs/PRD.md`) en pasos pequeños. Cada paso vive en su propio archivo e incluye objetivo, tareas, archivos, pruebas e **instrucciones de verificación**.

## Cómo usar este plan

1. Busca en la tabla de abajo el primer paso que no esté en ✅.
2. Antes de empezar, lee `docs/PRD.md`, `AGENTS.md` y el archivo del paso. Revisa las decisiones que aplican al paso (tabla "Decisiones del dueño"). Si surge una ambigüedad nueva, pregúntale al dueño antes de escribir código y anótala en el registro de decisiones.
3. Cambia el estado del paso a 🟡 en la tabla y en el encabezado del archivo, y anota la fecha de inicio.
4. Ve marcando las casillas `- [ ]` de las tareas a medida que avances.
5. Ejecuta **todas** las verificaciones de la sección "Verificación". Solo si pasan, marca el paso como ✅, anota la fecha, el hash del commit y cualquier decisión en "Notas de progreso".
6. Haz un commit por paso (Conventional Commits, en inglés). Al cerrar un hito completo (H0…H12), confirma que se cumple también la "Definición de terminado" global.

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
| 20 | [Validación final del MVP](20-validacion-mvp.md) | — | ✅ | `mvp` |
| 21 | [Dominio: meses de pago y proyección (R7)](21-dominio-meses.md) | H9 | ✅ | Ver historial de git |
| 22 | [Brief de diseño de la vista por meses](22-brief-meses.md) | H9 | ✅ | Ver historial de git |
| 23 | [Inicio: lista de meses](23-lista-meses.md) | H9 | ✅ | Ver historial de git |
| 24 | [Detalle de un mes](24-detalle-mes.md) | H9 | ✅ | Ver historial de git |
| 25 | [Ajuste de vistas relacionadas y retiro del tablero](25-ajuste-vistas.md) | H9 | ✅ | Ver historial de git |
| 26 | [Pulido y validación de H9](26-validacion-meses.md) | H9 | ✅ | 3a2728b |
| 27 | [Compras en curso: datos y dominio](27-compras-en-curso-dominio.md) | H10 | ✅ | Ver historial de git |
| 28 | [Compras en curso: formulario y vistas](28-compras-en-curso-ui.md) | H10 | ✅ | Ver historial de git |
| 29 | [Intereses sobre saldo](29-intereses-sobre-saldo.md) | H10 | ✅ | Ver historial de git |
| 30 | [Pago mínimo, deuda total y saldos por moneda](30-pago-minimo-deuda-monedas.md) | H10 | ✅ | Ver historial de git |
| 31 | [Suscripciones diferidas y cuotas por defecto en USD](31-suscripciones-diferidas.md) | H10 | ✅ | Ver historial de git |
| 32 | [Pagos por tipo y abonos a capital](32-pagos-abonos-capital.md) | H10 | ✅ | Ver historial de git |
| 33 | [Cierre mensual del extracto](33-cierre-mensual.md) | H10 | ✅ | Ver historial de git |
| 34 | [Cambio de cuotas y comisión de avance por movimiento](34-cambio-cuotas-comision-avance.md) | H10 | ✅ | Ver historial de git |
| 35 | [Importación de los extractos reales](35-importacion-extractos.md) | H10 | ✅ | bcd40f8 |
| 36 | [Cuotas y categoría sugeridas por comercio](36-sugerencias-comercio.md) | H11 | 🟡 | |
| 37 | [Costo de diferir](37-costo-diferir.md) | H11 | ⬜ | |
| 38 | [Importación mensual de extractos](38-importacion-mensual.md) | H11 | ⬜ | |
| 39 | [Pago del saldo en dólares con pesos y cupo en USD](39-dolares-con-pesos.md) | H11 | ⬜ | |
| 40 | [Capa de IA](40-capa-ia.md) | H12 | ⬜ | |
| 41 | [Borradores por confirmar](41-borradores.md) | H12 | ⬜ | |
| 42 | [Endpoint de ingesta y reglas de alertas](42-ingesta-reglas.md) | H12 | ⬜ | |
| 43 | [Interpretación de alertas con IA](43-interpretacion-ia.md) | H12 | ⬜ | |
| 44 | [Script de captura en Apps Script](44-apps-script.md) | H12 | ⬜ | |
| 45 | [Validación de H12](45-validacion-captura.md) | H12 | ⬜ | |

**MVP cerrado el 12 de noviembre de 2026 por aprobación explícita del dueño con las limitaciones del paso 20.** Los veinte pasos están en ✅. Pasan 117 pruebas de Vitest, 167 pruebas SQL, cobertura de dominio 100 %, build y lint. La revisión adicional con la extensión real axe DevTools cubrió 52 combinaciones sin fallas confirmadas; los casos de contraste y foco se revisaron aparte. El cron remoto se ejecutó a las 05:00 de Bogotá y generó un solo cobro de 25.000 COP para la suscripción de prueba. La etiqueta `mvp` identifica el commit de cierre.

Se conservan los datos de producción. La RPC privilegiada quedó aislada y el registro público remoto está desactivado. Quedan como seguimiento aceptado: celular físico, personalización de correo de Supabase, nueva inspección del panel de Vercel, protección de contraseñas filtradas del plan Free y tres cortes bancarios reales. No se presentan como comprobaciones realizadas. El paso 19 conserva la aprobación visual general previa del dueño; sus capturas se eliminaron por su solicitud.

**H9 · Vista por meses (MVP 1.1).** Aprobada por el dueño el 13 de noviembre de 2026 (D18–D29 del PRD, incluidas las precisiones de esta revisión). Cambia la pantalla de inicio: la información se organiza por mes de pago. Los pasos 21 a 26 van en orden; el 22 no escribe código de producto y produce el brief que siguen el 23 y el 24. Los pasos 23–24 se integran en una rama sin desplegar enlaces rotos; el reemplazo del inicio se publica cuando también existe el detalle. Los componentes del tablero (paso 16) se retiran en el 25 solo después de cubrir sus funciones, incluida la deuda total registrada.

La revisión documental no implementa H9 ni cambia los estados pendientes. No prevé dependencias nuevas ni cambios de esquema; si durante la implementación hacen falta, deben justificarse y aprobarse en el plan del paso correspondiente.

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
- **Redondeo.** Montos en COP: `ROUND_HALF_UP` a pesos enteros por cuota (capital e interés por separado); la última cuota absorbe la diferencia de capital. USD: 2 decimales. **Desde el paso 27 (D48):** COP también a 2 decimales en cálculo y almacenamiento, y pesos enteros solo al presentar.
- **Cuotas en USD (D3).** Una compra en USD se amortiza en USD (centavos, la última cuota absorbe la diferencia para que Σ capital = `amount`). Cada cuota guarda además su equivalente en COP (`principal_cop`, `interest_cop`, `total_cop`) con la TRM de la compra, redondeado a pesos (a centavos desde D48), y la última cuota absorbe la diferencia para que Σ `principal_cop` = `amount_cop`. Los totales de extractos, cupo y gráficos usan siempre las columnas `_cop`; desde el paso 30 (D33), los totales de extractos y meses se calculan por moneda y las columnas `_cop` quedan como referencia y para el cupo. Para cuotas en COP, las columnas `_cop` son iguales a las originales.
- **Vistas con `security_invoker = true`** para que respeten RLS.
- **`user_id` con `default auth.uid()`** en todas las tablas con dueño; la tarea de `pg_cron` lo escribe explícitamente desde la suscripción.
- **Lecturas de meses:** capa de consultas compartida por inicio y detalle, con dominio puro y paginación que nunca corte cargos de un mismo total. Las proyecciones no escriben datos y mantienen la identidad `(subscription_id, date)` para dar prioridad al cobro real.
- **Frescura de meses:** toda escritura relevante actualiza inicio, meses y vistas dependientes, incluidas las referencias anteriores de una edición/borrado. Cron, TRM y cambio de día de Bogotá deben reflejarse en nuevas lecturas; no incorporar caché persistente sin estrategia de invalidación. Matriz y regresiones en el paso 25.

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

### Decisiones de H9 (vista por meses)

Aprobadas por el dueño el 2026-11-13. El detalle de cada regla está en R7 y en el registro de decisiones de `docs/PRD.md`.

| # | Tema | Decisión | Paso afectado |
| --- | --- | --- | --- |
| D18 | **Qué es "un mes".** | Mes de pago: un extracto pertenece al mes de su `due_date` en Bogotá. El gasto por mes de compra (D5) es solo un dato secundario con su propia etiqueta. | 21, 23, 24 |
| D19 | **Estados del mes.** | Vencido, Pendiente, Pagado y Estimado según R7. En el actual se separan facturados, registrados en abiertos y previstos; actual vacío sin badge Pagado. | 21–24, 26 |
| D20 | **Proyección actual y futura.** | Reales + suscripciones elegibles + manejo de virtuales, incluido el actual abierto. Dedupe por suscripción/fecha, prevalece el real. Sin TRM, total conocido incompleto con aviso; sin compras supuestas ni persistencia. | 21–26 |
| D21 | **Rango de meses.** | Compromisos dentro de los siguientes 12 meses de pago, incluido manejo aunque no haya compras/suscripciones. Aviso de cuotas/extractos reales posteriores. Todo el historial en bloques de 12 meses con extractos, con enlaces directos independientes. | 21–24, 26 |
| D22 | **Orden de la lista.** | Mes actual destacado arriba; próximos ascendente; anteriores descendente. | 23 |
| D23 | **Extractos vencidos.** | Cuentan en su mes y aparecen en alerta arriba de la lista y del actual, con acceso a cada mes afectado. Importe calculado sin descontar abonos, no sumado al actual. | 21–24, 26 |
| D24 | **Tarjetas archivadas.** | Conservan extractos, cuotas reales, historial y saldo en deuda registrada; sin suscripciones ni manejo proyectados; fuera de la franja. Archivar todas no oculta los datos reales. | 21–26 |
| D25 | **Inicio y navegación.** | `/` es Meses; cuatro destinos. Franja con cupo/utilización y deuda total registrada secundaria según D2. Gráfico por categoría en detalle de pago; `/movimientos` sin gráficos y filtro de mes de compra explícito. | 22–26 |
| D26 | **Confirmación de pago.** | "Pendiente de confirmar pago": total calculado de extractos reales sin `paid_at`, sin descontar abonos ni sumar previstos. Marcar pagado no registra pago ni libera cupo. Sin asignación de abonos parciales en H9. | 21–26 |
| D27 | **Total mensual.** | Siempre calculado más previstos conocidos; `real_total` solo referencia en el extracto. Falta de TRM se identifica, no se convierte a cero ni en un total definitivo. | 21–26 |
| D28 | **Conceptos y categorías.** | Mismo mes de pago y total neto: cuotas por `total_cop` con categoría original, cargos y previstos con categoría o "Sin categoría", ajustes incluidos y devoluciones restadas. Sin duplicar capital/interés; signos conservados y barra con fallback para cero/negativos. | 21–26 |
| D29 | **Comparación de meses.** | Solo meses cerrados comparables, sin proyección ni TRM faltante. Sin afirmar ahorro en meses abiertos/estimados/incompletos; bases no significativas con texto neutro o diferencia monetaria. | 21–26 |

**H10 · Fidelidad con el extracto bancario (MVP 1.2).** Aprobada por el dueño el 16 de noviembre de 2026 (D30–D41 del PRD, precisadas por D48–D50 el 17) a partir de sus extractos reales de Bancolombia. Empieza cuando el paso 26 esté en ✅. Los pasos 27 a 34 cambian datos, dominio y vistas; el 35 carga los datos reales con `al-corte-import-2026-11.json` y solo se ejecuta en producción cuando los anteriores estén desplegados. Las suscripciones diferidas (31) van antes de pagos y abonos por prioridad del dueño.

### Decisiones de H10 (fidelidad con el extracto)

| # | Tema | Decisión | Paso afectado |
| --- | --- | --- | --- |
| D30 | **Corte variable de Bancolombia.** | Día fijo 15 y pago el 2. Los movimientos de borde importados conservan el extracto del banco; los nuevos usan R1. | 35 |
| D31 | **Compras en curso.** | Cuotas previas sin extracto (`before_tracking`), capital previo explícito, saldo del banco por encima del plan cuando no coinciden. Cupo solo con capital pendiente. | 27, 28, 33, 35 |
| D32 | **Intereses sobre saldo.** | `interest_mode` por tarjeta. En `on_balance`, cuotas de capital y un cargo de intereses por extracto, real o estimado. Modo bloqueado si hay compras a varias cuotas. | 29, 30, 33, 35 |
| D33 | **Pago mínimo, deuda total y monedas.** | Por extracto y moneda, con valores del banco como referencia y pago marcado por separado. COP y USD no se suman. | 30, 32, 33, 35 |
| D34 | **Cuotas por defecto en USD.** | `usd_default_installments` por tarjeta; 36 en Bancolombia. | 31, 35 |
| D35 | **Suscripciones diferidas.** | `installments_count` por suscripción; el cron registra compras a esas cuotas y la proyección acumula cuotas. | 31 |
| D36 | **Importación de extractos.** | JSON y script de un solo uso fuera de git, cuenta por completar, transacción idempotente y verificación contra el banco. | 35 |
| D37 | **Pagos por tipo.** | Mínimo, total u otro valor, por extracto y moneda. El total liquida cuotas futuras; otro valor cubre primero el mínimo y el excedente es abono. Marcar pagado sin valor (D26) sigue disponible. | 32, 35 |
| D38 | **Abonos a capital.** | Regla de aplicación por tarjeta (`bancolombia_priority`, `oldest_first`, `directed`) y efecto por abono (`reduce_term` por defecto, `reduce_installment`). Distribución propuesta editable antes de guardar; el cierre mensual la corrige con el saldo del banco. | 32, 33 |
| D39 | **Cierre mensual.** | Valores del banco por moneda (mínimo, total, intereses, tasa vigente) y saldo por compra opcional. Diferencias visibles fuera del redondeo; extracto "Conciliado" reabrible. | 33 |
| D40 | **Cambio de cuotas.** | Nuevo número de cuotas restantes desde la próxima sin facturar; conserva facturadas y previas. La ampliación de plazo global queda fuera de H10. | 34 |
| D41 | **Comisión de avance por movimiento.** | La de la tarjeta es solo el valor por defecto; se guarda la del avance. | 34 |
| D48 | **Centavos en COP.** | Cálculo y almacenamiento con 2 decimales, como factura el banco; presentación en pesos enteros. Sustituye el redondeo a pesos de R2 para cálculos nuevos. | 27 (cambio base), 29–35 |
| D49 | **Datos de una compra en curso.** | Cuota k (ya facturada) y saldo después de ella, copiados del último extracto del banco. Por defecto, la cuota k cae en el último extracto cerrado de la tarjeta. | 27, 28, 35 |
| D50 | **Cuotas restantes y límite.** | El cambio de cuotas pide las restantes (1 a 36). Plan efectivo y número de cuota hasta 72; compras nuevas siguen en 36 (D15). | 27, 34 |

**H11 · Registro más rápido y costo real (v2).** Aprobado por el dueño el 16 de noviembre de 2026 y planificado el 21 (D52–D57). Es el siguiente hito: H10 se cerró el 21 de noviembre con el paso 35. Objetivo y criterio de terminado en `docs/PRD.md`, sección v2. El paso 38 trae la TRM diaria a H11 (D57) y construye la revisión de importaciones que reutiliza el paso 41 de H12. El paso 39 incluye D52 (cupo con deuda en dólares), que precisa H10, y usa la TRM del paso 38.

### Decisiones de H11 (registro más rápido y costo real)

| # | Tema | Decisión | Paso afectado |
| --- | --- | --- | --- |
| D52 | **Cupo con deuda en dólares.** | Deuda neta en USD a la TRM vigente más reciente para el cupo (sin TRM, la de cada compra con aviso); contra un extracto, la del último día hábil antes del corte, derivada del periodo de vigencia. Se confirma con el extracto de diciembre. | 39 |
| D53 | **Sugerencias por comercio.** | Última compra con el mismo nombre normalizado, primero en la misma tarjeta; solo campos que el dueño no cambió, con registro propio; sin IA. | 36 |
| D54 | **Costo de diferir.** | Intereses estimados por compra con la regla de la app (R2 en `per_installment`, R8 en `on_balance`), alerta sobre el 20 % y ahorro por pagar el total. | 37 |
| D55 | **Importación mensual.** | Archivo v1 sin guardar, RPC por lotes con vista previa sin cambios, reconoce cobros de suscripciones, cargos del extracto y pagos registrados; pagos nunca se importan; solo agrega ("Es el mismo" guarda solo `import_key`) y verificación contra el banco. | 38 |
| D56 | **Dólares pagados con pesos.** | Pesos exactos, tasa derivada con tolerancia de redondeo solo en pagos y diferencia cambiaria; el mes usa los pesos pagados para la parte pagada. | 39 |
| D57 | **TRM diaria.** | La carga diaria de la TRM oficial en `fx_rates` pasa a H11: Edge Function con `pg_cron`, upsert de 30 días, carga inicial desde enero de 2026 y `valid_from`. | 38, 39 |

**H12 · Capa de IA y captura por correo (v2).** Aprobado por el dueño el 17 de noviembre de 2026 (D42–D47). Se ejecuta después de H10 y de H11; el paso 41 reutiliza la revisión de la importación mensual del paso 38. Requiere un secreto `ANTHROPIC_API_KEY` y un secreto de firma de ingesta, ambos solo en el servidor.

### Decisiones de H12 (IA y captura por correo)

| # | Tema | Decisión | Paso afectado |
| --- | --- | --- | --- |
| D42 | **Capa de IA.** | Tareas con nombre en `lib/ai/`, SDK de Anthropic, salidas estructuradas revalidadas, sin herramientas, solo servidor, tope mensual, registro sin contenido y evals. | 40, 43 |
| D43 | **Fuente de captura.** | Apps Script en la cuenta del dueño cada 5 minutos, con firma HMAC hacia una ruta de Next.js. Sin API de Gmail en el servidor. | 42, 44 |
| D44 | **Filtro y tarjeta.** | Remitente de alertas con DKIM válido y `T.Cred *NNNN`; lo demás se descarta en el script. Tarjeta por `last4` o alias; sin coincidencia, "Tarjeta no registrada". | 42, 44 |
| D45 | **Reglas e IA.** | Reglas para los hechos; IA para interpretar y como respaldo con verificación literal de números. | 42, 43 |
| D46 | **Borradores.** | Tabla propia fuera de todo cálculo; dedupe por mensaje; propuesta de unión con movimientos manuales iguales. | 41, 42 |
| D47 | **Privacidad del correo.** | Solo la frase del movimiento sale de Google; sin HTML ni datos personales; la frase se borra al confirmar o descartar. | 42, 44 |
| D51 | **Secreto de ingesta.** | Secreto de firma y usuario dueño en variables de entorno del servidor; rotación documentada (Vercel, despliegue y script). Ajustes solo enciende o apaga la captura. | 42, 44, 45 |

Preguntas abiertas del PRD: método de intereses de bancos distintos a Bancolombia (por ejemplo, Nu) y notificaciones push (v2). El corte variable y la amortización de Bancolombia quedaron resueltos con D30 y D32. Se dejan anotadas en `docs/PRD.md`.

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
| 2026-11-12 | 20 | Cerrar el MVP con celular físico, personalización de correo y nueva inspección del panel de Vercel como seguimiento no verificado. | El dueño selecciona explícitamente «Cerrar con limitaciones» tras conocer los bloqueos; se completa la revisión real de axe DevTools y se verifica el cron programado. |
| 2026-11-13 | 21–26 | H9 · Vista por meses: D18–D25 aprobadas. La pantalla de inicio pasa a organizarse por mes de pago y sustituye al tablero; "Compromisos futuros" sale de v2. | Pedido del dueño. |
| 2026-11-13 | 21–26 | Precisiones de H9 aprobadas: proyección también en el actual abierto, dedupe real/previsto, TRM faltante explícita, manejo que por sí solo extiende hasta 12 meses, conservación de deuda e historial, desgloses R7 y comparaciones seguras. D26–D29 registradas. | El dueño pide aplicar todas las recomendaciones y confirma por separado control por extracto, total calculado y manejo hasta 12 meses. |
| 2026-11-13 | 21–26 | Se amplían planes/pruebas para invalidación transversal, pagos compactos accesibles, navegación histórica y ceros/negativos; se recuperan reglas/evidencias anteriores de `DESIGN.md`. Los seis pasos siguen pendientes. | Evitar errores de cálculo, regresiones y confundir una aprobación documental con implementación validada. |
| 2026-11-16 | 27–32 | H10 · Fidelidad con el extracto bancario: D30–D36 aprobadas a partir de los extractos reales de Bancolombia de noviembre. Fanova no se registra como suscripción (último cobro); los cobros sin identificar y Tinder quedan como compras puntuales; las compras en USD se difieren a 36 cuotas; ambas tarjetas sin cuota de manejo desde ahora; los saldos irregulares usan el valor del banco. | Pedido y respuestas del dueño. |
| 2026-11-16 | 31–35 | H10 ampliado con pagos por tipo y abonos a capital, cierre mensual, cambio de cuotas y comisión de avance por movimiento (D37–D41). La importación pasa al paso 35. En v2, cuotas y categoría sugeridas, costo de diferir, importación mensual de extractos y pago del saldo USD en pesos pasan a ser las primeras prioridades. Investigación de abonos de Bancolombia anotada en R9. | Pedido del dueño. |
| 2026-11-17 | 40–45 | H12 · Capa de IA y captura por correo aprobado (D42–D47). La captura desde email pasa de v3 a v2. Se agrega el filtro por "T.Cred" pedido por el dueño, con clasificación por verbo y alias de tarjeta. Pasos 36–39 reservados para H11. | Pedido del dueño. |
| 2026-11-17 | 27–45 | Revisión de los planes de H10 y H12 contra el código. D48 (centavos en COP), D49 (cuota y saldo del último extracto), D50 (cuotas restantes y plan de hasta 72) y D51 (secreto de ingesta en variables de entorno) aprobadas. Se completan los planes: extracto de la compra en curso sin crear extractos antiguos, `statement_balances` como única fuente de pago por moneda, plan de cuotas en SQL para el cron con pruebas de paridad, pago enlazado al extracto que cubre, migraciones y `db reset` faltantes, exportación de columnas nuevas, `ai_usage` con RLS y alcance de Gmail. Como consecuencia de D33, la falta de TRM solo afecta el equivalente COP de referencia desde el paso 30. | Pedido del dueño. |
| 2026-11-19 | 32 | Una compra o un avance con abonos a capital solo permite cambiar categoría, comercio y nota. Borrar un pago deshace sus abonos y restaura exactamente las cuotas que reemplazaron, solo si es el abono más reciente de cada compra (último en entrar, primero en salir). Un abono a una compra de una cuota aún sin facturar baja ese cargo en su extracto. | Respuesta del dueño al plan del paso. |
| 2026-11-21 | 33 | Cierre mensual: un saldo del banco mayor también se respeta (misma cuota, más cuotas, hasta 72). Un saldo nuevo reemplaza la corrección anterior del mismo extracto y compra; reabrir solo quita la marca y conserva valores y correcciones. El aviso sale para el último extracto cortado sin conciliar de cada tarjeta activa. El cierre edita los intereses registrados y la tasa vigente cambia solo la de compras, para compras nuevas. | Respuesta del dueño al plan del paso. |
| 2026-11-21 | 35 | Importación de noviembre: la comisión por avance por defecto de la Visa es $6.840, la misma de la Mastercard. Los abonos del 30 de octubre solo marcan pagado el extracto de octubre por moneda, sin movimientos de pago: pagaron cargos que no están en Al Corte y descontarlos inflaría el cupo (D2). Se prueba solo en local; el push, las migraciones remotas y la ejecución en producción los hace el dueño. | Respuestas del dueño. |
| 2026-11-21 | 35 (R2) | Una compra cuya cuota redondeada agotaría el capital antes de la última conserva la cuota y termina antes, con la última por el resto y el N original guardado, en compras, cobros de suscripciones e importación. Una cuota redondeada a cero sigue siendo inválida. | Pedido del dueño ante seis compras pequeñas en USD del extracto real. |
| 2026-11-21 | 36–39 | H11 planificado: sugerencias por comercio, costo de diferir, importación mensual y pago en dólares con pesos (D53–D56). D52 registra la valoración del cupo con deuda en dólares a la TRM vigente, que cuadra con el extracto de noviembre, y se implementa en el paso 39. | Pedido del dueño. |
| 2026-11-21 | 36–39 | Revisión del plan de H11 contra el código. Costo de diferir con la regla de intereses ya implementada (R2 o R8): en `on_balance` da i × P × (N − 1) / 2 ($3.308 en el ejemplo de $9.000). TRM diaria a H11 en el paso 38 (D57), porque `fx_rates` no se llena en producción. Importación con RPC por lotes y vista previa, reconociendo cobros de suscripciones, cargos del extracto y pagos; "Es el mismo" solo guarda `import_key`. Pagos en USD con tolerancia de redondeo de la tasa y cupo con deuda neta en dólares. Sugerencias con registro propio de campos tocados. | Recomendaciones aprobadas por el dueño. |
| 2026-11-21 | 36 | Las sugerencias solo aparecen en "Nuevo gasto", no al editar. Salen del mismo tipo que tiene el formulario (compra desde compras, avance desde avances). Cambiar el comercio o la tarjeta deshace la sugerencia anterior y aplica la nueva si existe. Autocompletado con `<datalist>` nativo, sin dependencias. | Respuesta del dueño al plan del paso. |
