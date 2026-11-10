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

El nombre de la app se muestra como marca tipográfica en `font-display` con `text-display`; todavía no hay logo, así que no inventes uno ni uses iconos como logotipo.

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
lib/format.ts             Formato de montos, fechas y porcentajes
lib/actions/              Server Actions (escrituras)
lib/validation/           Esquemas Zod compartidos
lib/database.types.ts     Tipos generados desde Supabase (no editar a mano)
supabase/migrations/      Migraciones SQL
supabase/functions/       Edge Functions
docs/PRD.md               Requisitos del producto
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
```

## Reglas no negociables

**Dinero**

- En la base: `numeric(14,2)`. En TypeScript: `Decimal` de decimal.js o `string`. Nunca sumes, restes ni multipliques dinero con `number`.
- COP se redondea a pesos enteros solo al presentar o al cerrar una cuota; la última cuota absorbe la diferencia de redondeo.
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
- Estilos de texto como clases: `text-display`, `text-title`, `text-heading`, `text-body`, `text-small`, `text-amount-lg`, `text-amount`.
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
- Áreas táctiles de al menos 44 × 44 px.
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
- **Total del extracto:** compras de 1 cuota + cuotas + suscripciones + avances y comisiones + intereses + cuota de manejo + seguros − devoluciones. Los pagos van aparte.

## Casos de prueba obligatorios en `lib/domain/`

- Compra el mismo día del corte y un día después.
- Corte el 31 en febrero (año normal y bisiesto) y en meses de 30 días.
- Fecha de pago que cae en el mes siguiente al corte.
- Compra a 12 cuotas con ambos métodos: la suma del capital es exactamente P.
- Compra a 1 cuota y compra sin intereses: interés 0.
- Suscripción mensual con día de cobro 31.
- Suscripción anual que renueva en un año bisiesto.

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
