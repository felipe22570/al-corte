# AGENTS.md — Al Corte

Instrucciones para agentes de código que trabajen en el repositorio de **Al Corte**. Léelas completas antes de cada tarea. El detalle funcional está en `docs/PRD.md`; si algo aquí contradice el PRD, manda el PRD y avisa de la contradicción.

## Proyecto

**Al Corte** es una app web personal (un solo usuario) para controlar tarjetas de crédito en Colombia: movimientos, compras a cuotas, avances, suscripciones, extractos por fecha de corte e historial mensual. El nombre viene de la fecha de corte, el concepto central de la app.

Lema: "Tus tarjetas, claras antes de cada corte."

**Cómo se escribe el nombre en cada lugar**

| Dónde                                              | Valor                                                                                            |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Interfaz, títulos, correos y documentación         | `Al Corte` (dos palabras, ambas con mayúscula inicial; nunca "AlCorte", "Alcorte" ni "AL CORTE") |
| Repositorio y `name` en `package.json`             | `al-corte`                                                                                       |
| Proyecto en Vercel y en Supabase                   | `al-corte`                                                                                       |
| Identificadores en código (constantes, namespaces) | `alCorte` / `AlCorte`                                                                            |
| `metadata.title` de Next.js                        | `{ default: 'Al Corte', template: '%s · Al Corte' }`                                             |
| Manifest de la PWA                                 | `name: 'Al Corte'`, `short_name: 'Al Corte'`                                                     |
| Remitente de correos (v2)                          | `Al Corte <avisos@…>`                                                                            |
| Prefijo de claves en `localStorage`                | `al-corte:`                                                                                      |

El nombre de la app se muestra como marca tipográfica en `font-display`: `text-display` (40 px) en su presentación principal y `text-wordmark` (24 px) como variante compacta en la barra lateral. Todavía no hay logo, así que no inventes uno ni uses iconos como logotipo.

- Moneda base COP, secundaria USD.
- Zona horaria única: `America/Bogota`.
- Interfaz en español de Colombia; código, tablas, columnas y commits en inglés.

## Stack

- Next.js (App Router) + TypeScript en modo `strict`
- Supabase: Postgres, Auth, Row Level Security, Cron (`pg_cron`) y Edge Functions
- Tailwind CSS + shadcn/ui
- React Hook Form + Zod
- Recharts
- Lucide (`lucide-react`) para iconos
- next-themes para modo claro y oscuro (clase `.dark` en `<html>`)
- Fuentes Geist y Bricolage Grotesque vía `next/font/google`
- decimal.js para dinero; date-fns + date-fns-tz para fechas
- Vitest para pruebas
- pnpm como gestor de paquetes
- Despliegue en Vercel

No agregues dependencias nuevas sin explicar por qué en el plan de la tarea.

## Estructura

```
app/                      Rutas (App Router). Páginas = Server Components.
  globals.css             Tokens de diseño: colores, radios, fuentes y estilos de texto
  layout.tsx              Carga de fuentes y proveedor de tema
  (auth)/                 Login
  (app)/                  Pantallas protegidas
components/               Componentes de UI reutilizables
components/ui/            Componentes de shadcn/ui
lib/domain/               Lógica de negocio pura: extractos, cuotas, suscripciones, totales
lib/domain/__tests__/     Pruebas de la lógica de negocio
lib/supabase/             Clientes de Supabase (server y browser)
lib/ai/                   Capa de IA: tareas, esquemas, prompts versionados y evals (H12)
lib/ingest/               Reglas de lectura de alertas y creación de borradores (H12)
integrations/apps-script/ Script de captura de correo, versionado con clasp (H12)
lib/format.ts             Formato de montos, fechas y porcentajes
lib/actions/              Server Actions (escrituras)
lib/validation/           Esquemas Zod compartidos
lib/database.types.ts     Tipos generados desde Supabase (no editar a mano)
supabase/migrations/      Migraciones SQL
supabase/functions/       Edge Functions
docs/PRD.md               Requisitos del producto
docs/import-format.md     Formato de archivo al-corte-import v1 (H11)
```

## Comandos

```
pnpm dev                  Servidor de desarrollo
pnpm test                 Pruebas (Vitest)
pnpm lint                 Linter
pnpm typecheck            tsc --noEmit
supabase start            Supabase local (requiere Docker)
supabase db reset         Recrea la base local y aplica todas las migraciones
supabase migration new <nombre>
supabase gen types typescript --local > lib/database.types.ts
pnpm test:ai              Evals de la capa de IA (llaman a la API; no corren en cada commit)
```

## Reglas no negociables

**Dinero**

- En la base: `numeric(14,2)`. En TypeScript: `Decimal` de decimal.js o `string`. Nunca sumes, restes ni multipliques dinero con `number`.
- COP se calcula y guarda con centavos (2 decimales), como lo factura el banco, y se redondea a pesos enteros solo al presentar. La última cuota absorbe la diferencia de redondeo (D48).
- Formato en la UI: `Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' })`.

**Fechas**

- Las fechas de negocio (compra, corte, pago, cobro) son tipo `date` en Postgres y strings `YYYY-MM-DD` en TypeScript.
- Nunca uses `new Date()` sin zona para decidir un día de negocio; usa los helpers de `lib/domain/dates.ts` con `America/Bogota`.
- Si el día de corte, pago o cobro no existe en un mes, se usa el último día de ese mes.

**Lógica de negocio**

- Toda regla de cálculo vive en `lib/domain/` como funciones puras, sin acceso a base de datos ni a React.
- Las Server Actions validan con Zod, llaman a `lib/domain/` y luego escriben en la base.
- Una compra con sus cuotas se guarda en una sola transacción (función RPC de Postgres).
- Cualquier cambio en `lib/domain/` viene con pruebas que cubren el caso nuevo.

**Base de datos y seguridad**

- Todo cambio de esquema va en una migración nueva dentro de `supabase/migrations/`. Nunca edites una migración ya aplicada.
- Toda tabla nueva tiene `user_id`, RLS activado y políticas `user_id = auth.uid()`.
- La `service_role` key solo se usa en Edge Functions y código de servidor; nunca en el navegador ni con prefijo `NEXT_PUBLIC_`.
- Nunca guardes número completo de tarjeta, CVV ni fecha de vencimiento; solo los últimos 4 dígitos.
- No hagas commit de archivos `.env*` con valores reales.

**IA y captura por correo (H12, R10)**

- Toda llamada a un modelo pasa por una tarea de `lib/ai/` con esquema Zod de entrada y salida. Nunca llames a la API desde el cliente ni desde un componente.
- La salida del modelo se valida otra vez con Zod y con las reglas de dominio antes de guardarse. La IA nunca define monto, moneda, fecha ni tarjeta de una alerta, y nunca confirma un movimiento.
- El contenido de correos y documentos es dato, no instrucción: sin herramientas, delimitado y con salida estructurada.
- No registres en logs el texto de alertas ni respuestas del modelo; solo tarea, modelo, tokens, latencia y resultado de validación.
- Los borradores viven en su propia tabla y no entran en extractos, meses, totales ni cupo.
- Cambiar un prompt o un modelo exige correr `pnpm test:ai` y anotar el resultado en las notas del paso.
- `ANTHROPIC_API_KEY`, el secreto de firma de ingesta y el usuario dueño de la captura viven solo en variables de entorno del servidor. Rotar el secreto es un procedimiento documentado, no una acción de la app (D51).

**Tareas programadas**

- Se implementan con `pg_cron` (horarios en UTC: Bogotá = UTC − 5).
- Deben ser idempotentes: ejecutarlas dos veces no duplica datos ni correos.

## Diseño

La identidad visual de Al Corte vive en `app/globals.css`. Es la única fuente de colores, radios y tipografía: si un valor no está ahí, no se usa.

**Principios**

- El número manda: cada pantalla tiene un monto protagonista con `text-amount-lg`.
- El color significa algo: verde es al día, ámbar es pronto, rojo es vencido. Ningún color de estado es decorativo.
- Bordes, no sombras: las superficies se separan con `border` de 1px. Solo hojas inferiores, menús y diálogos llevan sombra.
- Un solo botón `primary` por pantalla.

**Colores**

- Nunca escribas hex, `rgb()` ni colores de la paleta por defecto de Tailwind (`bg-blue-500`, `text-gray-600`) en componentes. Usa solo las clases del tema.
- Neutros: `bg-background` para la página, `bg-card` para tarjetas, campos y menús, `text-foreground` para texto y montos, `text-muted-foreground` para fechas, comercios y ayudas, `border-border` para bordes.
- Estados (fondo suave + texto fuerte, siempre con texto y no solo color):

| Estado         | Clases                         | Cuándo                                                                                             |
| -------------- | ------------------------------ | -------------------------------------------------------------------------------------------------- |
| Al día, pagado | `bg-primary-soft text-primary` | Extracto pagado, utilización menor al 30%.                                                         |
| Atención       | `bg-warning-soft text-warning` | Pago en 5 días o menos, prueba gratis por vencer, presupuesto al 80%, utilización entre 30% y 70%. |
| Problema       | `bg-danger-soft text-danger`   | Pago vencido, sobrecupo, presupuesto superado, utilización mayor al 70%.                           |

- Colores de tarjeta: `card-1` a `card-6`. La columna `cards.color` guarda la clave (`card-3`), nunca un hex. Se usan solo en el chip junto al nombre, la franja de la tarjeta y su serie en gráficos, siempre junto al nombre o los últimos 4 dígitos.
- Gráficos de Recharts: colores con `var(--card-N)` o `var(--chart-N)`, nunca hex.

**Tipografía**

- Geist (`font-sans`) para todo; Bricolage Grotesque (`font-display`) solo para el nombre de la app y los títulos de pantalla.
- Estilos de texto como clases: `text-display`, `text-wordmark`, `text-title`, `text-heading`, `text-body`, `text-small`, `text-amount-lg`, `text-amount`.
- Todo monto usa `text-amount` o `text-amount-lg` (incluyen `tabular-nums`) y va alineado a la derecha en listas y tablas.
- Las fuentes se cargan así en `app/layout.tsx`, con ``className={`${geist.variable} ${bricolage.variable}`}`` en `<html>`:

```ts
import { Bricolage_Grotesque, Geist } from "next/font/google";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });
const bricolage = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-bricolage" });
```

**Forma, espacio e iconos**

- Retícula de 4px. Padding de tarjetas y margen lateral en el celular: `p-4` / `px-4`. Entre secciones: `gap-6`.
- Radios: `rounded-sm` (6px) etiquetas, `rounded-md` (10px) botones y campos, `rounded-xl` (16px) tarjetas y hojas, `rounded-full` botón flotante y barras de utilización.
- Áreas táctiles de 44 × 44 px en pantallas táctiles (`pointer-coarse:`). En escritorio, botones y campos miden 36–40 px (`h-9`/`h-10`). Nunca fuerces 44 px en todos los tamaños de botón.
- Layout: el contenido de cada página se centra en el área a la derecha de la barra lateral, con un ancho máximo común para encabezado y contenido. Las páginas de consulta pueden usar dos columnas en pantallas anchas.
- Iconos de Lucide a 20px (`size-5`) con `strokeWidth={1.75}`, en `text-muted-foreground` salvo en estados. Sin emojis ni ilustraciones.

**Textos de la interfaz**

- Español de Colombia, tuteando, frases cortas. Sin signos de exclamación ni lenguaje alarmista.
- Ejemplos: "Pagas $1.284.500 el 2 de dic", "Te faltan 4 de 12 cuotas", "Tu Visa vence en 3 días", "Aún no tienes suscripciones. Agrega la primera."
- Todo formato pasa por `lib/format.ts`:
     - Pesos sin decimales y punto de miles: `$1.284.500` (`Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })`).
     - Dólares con dos decimales: `US$ 15,99`.
     - Fechas cortas `15 nov`, con día cuando ayuda `vie 15 nov`, año solo si no es el actual.
     - Porcentajes sin decimales (`68%`); tasas con dos (`28,45% E.A.`).

## Reglas de dominio (resumen)

Detalle completo en la sección 5 de `docs/PRD.md`.

- **Asignación al extracto:** un movimiento con fecha `d` pertenece al extracto cuya fecha de corte es la primera mayor o igual a `d`. Con corte el 15, una compra del 15 va a ese mes y una del 16 al siguiente.
- **Tasa mensual:** `i = (1 + EA)^(1/12) − 1`.
- **Amortización por tarjeta:** `fixed_principal` (capital P/N + interés sobre saldo; por defecto) o `french` (cuota fija).
- **Cuota k** cae en el extracto de la compra más k − 1 meses. Compras a 1 cuota o marcadas sin intereses usan i = 0.
- **Avance:** genera el movimiento del avance (tasa de avances) y otro de comisión, misma fecha y extracto.
- **Suscripciones:** un cobro por fecha, garantizado por índice único `(subscription_id, date)`.
- **Total del extracto:** compras de 1 cuota + cuotas + suscripciones + avances y comisiones + intereses + cuota de manejo + seguros + ajustes − devoluciones. Los pagos van aparte y el interés ya incluido en una cuota no se suma dos veces.
- **Mes de pago (R7):** un extracto pertenece al mes de su `due_date` en Bogotá. Toda la vista por meses usa este criterio; el gasto por mes de compra (D5) solo aparece como dato secundario y con su propia etiqueta. Nunca mezcles ambos criterios en un mismo total.
- **Proyección (R7, H9 pendiente):** mes actual abierto y futuros combinan reales con suscripciones elegibles de tarjetas activas y manejo solo de extractos virtuales. Dedupe por `(subscription_id, date)` dando prioridad a importe, TRM y asignación del real. Conservar fechas/importes guardados; sin compras supuestas ni persistencia. Sin TRM, "Total conocido" incompleto con aviso, no cero inventado. Lógica en `lib/domain/months.ts`.
- **Confirmación de pago (D26):** "Pendiente de confirmar pago" suma totales calculados de extractos reales sin `paid_at`, sin descontar abonos ni sumar previstos. Marcar pagado no crea pagos ni libera cupo. `real_total` no sustituye al calculado (D27).
- **Rango y deuda:** 12 meses de pago futuros como máximo; manejo puede generarlos por sí solo. Avisar de cuotas/extractos reales posteriores. Preservar historial y saldos de archivadas; deuda total registrada secundaria según D2, sin proyecciones ni límite de horizonte.
- **Desglose y comparación:** conceptos y categorías usan R7, cuotas por `total_cop` y categoría original, ajustes incluidos, devoluciones restadas, sin duplicar compra/interés. D5 solo como dato separado. Comparaciones solo entre meses cerrados con datos y sin proyección/TRM faltante (D28, D29). Conservar ceros/negativos y usar alternativa textual si una barra proporcional no es válida.
- **Integración de meses:** lecturas compartidas entre inicio/detalle y actualización de todas las vistas afectadas por cada escritura, incluidas referencias anteriores tras editar/borrar. Considerar cron, TRM y cambio de día; no añadir caché persistente sin invalidación. Controles de pago repetibles con IDs únicos y botones secundarios, no varias copias completas de `StatementControls`.

- **Compras en curso (R8, D31, D49):** la cuota k y el saldo se copian del último extracto del banco (k ya facturada, saldo después de ella). Las cuotas previas (`before_tracking`) nunca entran en extractos, meses, totales ni cupo, y registrar una compra en curso no crea extractos anteriores, cuota de manejo en ellos ni comisión de avance. Si el capital previo no coincide con el plan, manda el saldo del banco: misma cuota, menos cuotas.
- **Cambio de cuotas (D40, D50):** se piden las cuotas restantes (1 a 36); el plan efectivo admite hasta 72 cuotas.
- **Intereses sobre saldo (R8, D32):** en `on_balance` las cuotas son solo capital y el interés es un único cargo por extracto, real o estimado. Nunca sumes interés por cuota y por saldo en la misma tarjeta.
- **Pago mínimo y deuda total (R8, D33):** se calculan por extracto y por moneda. COP y USD no se suman entre sí; el equivalente COP es solo referencia. Desde H10, la falta de TRM solo deja sin equivalente COP de referencia; no vuelve incompleto el total en pesos ni el de dólares.

- **Pagos y abonos (R9, D37, D38):** un pago cubre primero el mínimo facturado; el excedente es abono a capital según la regla de la tarjeta. Nunca apliques un pago en COP al saldo en USD. El orden de Bancolombia dentro de un mismo nivel no es público: el supuesto "más antigua" debe quedar marcado y ser corregible.

- **Sugerencias por comercio (R11, D53):** deterministas por nombre normalizado; solo llenan campos que el dueño no tocó y nunca sugieren valor, fecha ni tarjeta.
- **Costo de diferir (R11, D54):** usa la misma regla de intereses que la app (cuotas de R2 en `per_installment`, estimación de R8 en `on_balance`); nunca una fórmula aparte. Todo valor sobre el futuro se etiqueta como estimado; compras sin intereses o a una cuota cuestan 0.
- **Importación mensual (R11, D55):** el archivo no se guarda ni se registra en logs. La importación solo agrega movimientos, en una transacción; nunca cambia montos, fechas, cuotas, categoría ni extracto de los existentes (enlazar un conflicto solo guarda su `import_key`) y nunca importa pagos.
- **Dólares pagados con pesos y cupo (R11, D52, D56):** se guarda el valor exacto en pesos debitado; el cupo valora la deuda neta en USD, en dólares, con la TRM vigente, no con la de cada compra.
- **TRM diaria (D57):** `fx_rates` se llena con una tarea diaria idempotente; si falta la TRM no se inventa un valor.

## Casos de prueba obligatorios en `lib/domain/`

- Compra el mismo día del corte y un día después.
- Corte el 31 en febrero (año normal y bisiesto) y en meses de 30 días.
- Fecha de pago que cae en el mes siguiente al corte.
- Compra a 12 cuotas con ambos métodos: la suma del capital es exactamente P.
- Compra a 1 cuota y compra sin intereses: interés 0.
- Suscripción mensual con día de cobro 31.
- Suscripción anual que renueva en un año bisiesto.
- Mes de pago: extracto con corte en un mes y fecha límite en el siguiente (corte 31, pago 5).
- Proyección: día 31, anual en rango, pausada/cancelada, prueba y tarjeta archivada; actual abierto con cobro antes del corte pagadero este mes; manejo no duplicado y horizonte solo con manejo.
- Dedupe real/previsto por suscripción/fecha y transición por cron sin doble conteo; USD sin TRM mantiene aviso de total incompleto (hasta H10; desde el paso 30, aviso de equivalente COP faltante con el total en dólares intacto).
- Estados: vencido, pendiente, todos/algunos extractos marcados y estimado; actual vacío no Pagado. Un abono parcial no reduce el pendiente de confirmar y `real_total` no cambia el total.
- Rango con cuotas posteriores a 12 meses, aviso de límite e historial conservado con todas las tarjetas archivadas.
- Desgloses por concepto/categoría que cuadran, con ajustes, cuotas/interés sin duplicar, "Sin categoría", devoluciones y totales cero/negativos.
- Comparación entre meses de pago cerrados; mes abierto, futuro o incompleto sin afirmación de ahorro ni porcentajes inválidos.

- Compra en curso con plan consistente (cuota 3 de 4) y con abono previo (saldo del banco menor al plan): cuotas efectivas y última cuota, con centavos (GeoGuessr: última de $874,36).
- Intereses estimados en `on_balance`: compras con y sin interés, avances, compras a una cuota excluidas y tasas distintas por compra.
- Pago mínimo y deuda total por moneda contra los extractos de noviembre de 2026 (Visa: $1.178.836 y $3.845.775; Mastercard: $1.706.234 y $4.265.728, US$9 y US$154 con el redondeo del banco).
- Suscripción diferida a 36 cuotas: la proyección acumula una cuota por cobro y no suma el valor completo.
- Abono con la prioridad de Bancolombia en pesos y en dólares; reducir plazo frente a reducir cuota; pago total que liquida las cuotas futuras.
- Cambio de cuotas restantes desde la próxima sin facturar, conservando facturadas y previas, incluido un plan efectivo de más de 36 cuotas.
- Sugerencia por comercio: misma tarjeta antes que otra, nombre con tildes y espacios distintos, campos ya tocados sin sobrescribir.
- Costo de diferir: $9.000 a 36 cuotas con 2,1003 % M.V. en capital fijo da $3.496,99 de intereses en `per_installment` (i × P × (N + 1) / 2) y $3.307,96 en `on_balance` (i × P × (N − 1) / 2, sin interés en el extracto de la compra), con el redondeo por cuota o por extracto; compra sin intereses da 0; compra en curso cuenta solo desde la cuota registrada.
- Importación mensual: el mismo archivo dos veces no duplica; coincidencia por `import_key` y, sin ella, por tarjeta, fecha, valor, moneda y comercio; cobros de suscripciones, cuota de manejo e intereses ya registrados no se duplican; pagos nunca se importan; conflictos sin importar; la vista previa no deja cambios.
- Pago en dólares con pesos: US$154 pagados con $510.000 dan una tasa de 3.311,6883; US$153,26 con $510.000 dan 3.327,6785 y conservan $510.000,00 exactos. Cupo de la Mastercard con TRM de $3.301,91: $10.528.221,51.
- TRM del extracto: para el corte del 15 de noviembre de 2026 (periodo de vigencia del 14 al 17) es la del 13, $3.301,91.

## Forma de trabajar

1. Antes de escribir código, lee `docs/PRD.md` y propón un plan corto: archivos a crear o modificar, migraciones, pruebas y riesgos. Espera aprobación si la tarea es un hito completo.
2. Implementa en pasos pequeños; en lógica de dominio, escribe primero las pruebas.
3. No implementes funcionalidades de v2 o v3 a menos que se pidan explícitamente.
4. Si una regla de negocio es ambigua o el PRD no la cubre, pregunta en vez de suponer. Si decides algo menor, déjalo anotado en el resumen final.
5. Al terminar, resume qué cambió, qué quedó pendiente y cualquier decisión tomada.

## Definición de terminado

Una tarea está terminada solo si:

- `pnpm typecheck`, `pnpm lint` y `pnpm test` pasan sin errores.
- `supabase db reset` aplica todas las migraciones sin errores.
- Los tipos de `lib/database.types.ts` están regenerados si cambió el esquema.
- La UI nueva funciona en pantallas de 360 px y en modo oscuro.
- La UI nueva solo usa colores, radios y estilos de texto definidos en `app/globals.css`.
- No quedan `console.log`, código comentado ni `TODO` sin explicar.

## Estilo de código

- Componentes en PascalCase, funciones y variables en camelCase, tablas y columnas en snake_case.
- Preferir Server Components; usar `"use client"` solo donde haya interactividad.
- Un componente por archivo; nombres de archivo en kebab-case.
- Mensajes de commit en inglés con formato Conventional Commits (`feat:`, `fix:`, `refactor:`, `test:`, `chore:`).

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
