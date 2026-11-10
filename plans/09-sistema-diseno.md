# Paso 09 — Sistema de diseño de Al Corte

- **Hito PRD:** H3 (parte 1 de 3)
- **Estado:** ⬜ Pendiente
- **Inicio:** —
- **Fin:** —
- **Commit:** —
- **Depende de:** 02 (se puede adelantar justo después del paso 03; conviene hacerlo antes de cualquier pantalla nueva)
- **Decisiones aplicables (ver README):** D11 (colores de categorías y gráficos), D12 (borde de campos y tamaño de texto en campos), D13 (formato de pesos sin espacio)

## Objetivo

Dejar listo el sistema de diseño de la sección "Diseño" de `AGENTS.md` sobre los tokens de `app/globals.css`, **antes** de construir pantallas. Al terminar, cualquier pantalla nueva solo combina piezas que ya respetan colores, radios, tipografía, iconos y formatos de Al Corte.

## Contexto (estado actual del repo al planear este paso)

- `app/globals.css` ya tiene los tokens: neutros, `primary`/`warning`/`danger` con sus variantes `-soft`, `card-1` a `card-6`, radios, `font-sans`/`font-display` y los estilos de texto `text-display`… `text-amount`.
- `app/layout.tsx` carga `Geist` con la variable `--font-geist-sans` y `Geist_Mono`, pero `globals.css` espera `--font-geist` y `--font-bricolage`: **hoy las fuentes no se aplican** y Bricolage Grotesque no se carga.
- Los componentes de shadcn/ui (`style: base-nova`, Base UI) traen clases que chocan con las reglas: `rounded-lg` (en este tema son 16px) en botones y campos, alturas `h-6`–`h-8` (< 44px), `ring-1` en tarjetas en vez de `border`, `font-heading` (no existe en el tema), `text-sm`/`text-base` en vez de los estilos de texto.
- `lib/utils.ts` reexporta `cn` del paquete `cn` (de shadcn). Hay que confirmar que no fusiona mal las utilidades propias (`text-amount` con `text-foreground`, por ejemplo).
- `metadata.title` es un string fijo, no la plantilla de `AGENTS.md`.
- No hay `next-themes` ni `lib/format.ts`.

## Alcance

**Incluye:** fuentes, tema claro/oscuro, metadatos de marca, adaptación de los componentes base de shadcn/ui, `lib/format.ts`, componentes de presentación compartidos, verificación automática de reglas de diseño, prueba de contraste de tokens, catálogo de diseño en desarrollo y rediseño del login.

**No incluye:** navegación y layout de `(app)` (paso 10) ni pantallas de negocio.

## Tareas

Marca y tema

- [ ] `app/layout.tsx`: cargar `Geist` (`--font-geist`) y `Bricolage_Grotesque` (`--font-bricolage`) exactamente como en `AGENTS.md`; quitar `Geist_Mono` si nada lo usa. `<html lang="es-CO" suppressHydrationWarning className={`${geist.variable} ${bricolage.variable}`}>`.
- [ ] `metadata.title = { default: 'Al Corte', template: '%s · Al Corte' }`, `description` con el lema "Tus tarjetas, claras antes de cada corte.", `applicationName: 'Al Corte'`.
- [ ] `viewport.themeColor` para claro (`--surface` claro) y oscuro (`--surface` oscuro). Como Next.js necesita valores literales aquí, se definen en una sola constante `lib/brand.ts` (`alCorteThemeColors`) con un comentario que apunta a `globals.css`, y una prueba verifica que coinciden con los valores de `globals.css`. Es la única excepción a "sin hex fuera de `globals.css`".
- [ ] `lib/brand.ts`: `APP_NAME = 'Al Corte'`, `APP_TAGLINE`, `STORAGE_PREFIX = 'al-corte:'` y un helper `storageKey(name)`.
- [ ] Instalar `next-themes` (está en el stack de `AGENTS.md`). `components/theme-provider.tsx` con `attribute="class"`, `defaultTheme="system"`, `enableSystem`, `disableTransitionOnChange`. Envolver `app/layout.tsx`.
- [ ] `components/theme-toggle.tsx`: claro, oscuro, sistema; iconos Lucide `size-5` `strokeWidth={1.75}`; `aria-label` en español.
- [ ] `components/app-wordmark.tsx`: "Al Corte" en `font-display text-display` (con variante compacta `text-title` para espacios pequeños, si hace falta, anotada como decisión). Sin iconos ni logos.

Componentes de shadcn/ui

- [ ] Revisar `cn`: prueba en Vitest de que `cn('text-amount', 'text-foreground')` conserva las dos clases, `cn('text-small', 'text-body')` conserva solo la última y `cn('bg-card', 'bg-primary-soft')` conserva la última. Si el paquete `cn` no lo soporta, cambiar `lib/utils.ts` a `clsx` + `extendTailwindMerge` (ya instalados) registrando los estilos de texto propios y los colores del tema; anotar la decisión.
- [ ] Adaptar `components/ui/button.tsx`: `rounded-md`; tamaño por defecto `h-11` (44px) y botones de ícono `size-11`; tamaños pequeños solo donde no sean áreas táctiles principales; variantes `default` (primary), `outline`, `ghost`, `destructive` (usa `--destructive` = danger), `link`. Sin sombras.
- [ ] `components/ui/input.tsx`: `rounded-md`, `h-11`, `bg-card`, `border-input`, tamaño de texto según D12 (16px en el celular para que iOS no haga zoom).
- [ ] `components/ui/card.tsx`: `rounded-xl`, `border` de 1px (`border-border`) en vez de `ring`, `bg-card`, padding `p-4`; títulos con `text-heading`; descripciones con `text-small text-muted-foreground`.
- [ ] `components/ui/alert.tsx`: variantes por estado (`bg-primary-soft text-primary`, `bg-warning-soft text-warning`, `bg-danger-soft text-danger`), `rounded-md`.
- [ ] `components/ui/label.tsx`: `text-small` y peso medio.
- [ ] Reemplazar `font-heading` y cualquier `text-xs/sm/base/lg` por los estilos de texto del tema.
- [ ] Cuando se agreguen más componentes de shadcn/ui en pasos posteriores (`sheet`, `dialog`, `dropdown-menu`, `select`, `badge`, `skeleton`, `sonner`, `chart`), se adaptan con estas mismas reglas en el paso que los agregue. Solo `sheet`, `dialog`, menús y `sonner` pueden tener sombra.

Formatos (`lib/format.ts`)

- [ ] `formatCop(v: string | Decimal)` → `$1.284.500` (sin decimales, sin espacio tras el símbolo, D13).
- [ ] `formatUsd(v)` → `US$ 15,99`.
- [ ] `formatMoney(v, currency)` que delega en las dos anteriores.
- [ ] `formatSignedMoney(v, currency, kind: 'charge' | 'credit')` → abonos con `+` (o el signo que se defina), sin color.
- [ ] `formatDateShort(d: IsoDate, today: IsoDate)` → `15 nov`; con año si no es el año de `today` → `15 nov 2025`.
- [ ] `formatDateWithWeekday(d, today)` → `vie 15 nov`.
- [ ] `formatPercent(v)` → `68%` (sin decimales); `formatRate(ea)` → `28,45% E.A.` (recibe fracción `0.2845`).
- [ ] `formatDueIn(days)` → "hoy", "mañana", "en 3 días", "hace 2 días" (para textos como "Tu Visa vence en 3 días").
- [ ] Meses y días abreviados con una tabla propia en español (`ene, feb, mar, abr, may, jun, jul, ago, sep, oct, nov, dic`; `lun, mar, mié, jue, vie, sáb, dom`), sin puntos, para no depender de cómo cada versión de ICU abrevia `es-CO`.
- [ ] Ningún formateador acepta `number` para montos ni usa `new Date()` sin zona: el día de la semana se calcula con aritmética de calendario sobre `YYYY-MM-DD`.
- [ ] Si el paso 05 ya creó `formatMoney` en `lib/domain/money.ts`, moverlo aquí (la presentación no es lógica de dominio).

Componentes de presentación (`components/`)

- [ ] `money.tsx`: `<Money value currency size="md" | "lg" />` → `text-amount` o `text-amount-lg`, `tabular-nums`, `text-foreground`; alineación a la derecha la decide el contenedor (listas y tablas siempre a la derecha).
- [ ] `date-label.tsx`: usa `formatDateShort`/`formatDateWithWeekday` y `todayInBogota()`; `<time dateTime>`.
- [ ] `status-badge.tsx`: `tone: 'ok' | 'warning' | 'danger' | 'neutral'` + **texto obligatorio** (el tipo no permite un badge sin texto); `rounded-sm`, `text-small`, fondo `-soft` + texto fuerte; `neutral` usa `bg-secondary text-foreground`.
- [ ] `card-color-chip.tsx`: punto o franja `bg-card-N` que siempre se renderiza junto al nombre o los últimos 4 dígitos (el componente recibe el nombre como prop obligatoria).
- [ ] `lib/card-colors.ts`: `CARD_COLORS = ['card-1', …, 'card-6'] as const`, nombres en español (Azul, Violeta, Petróleo, Vino, Mostaza, Pizarra) y mapa a clases completas (`bg-card-1`, …) escritas literalmente para que Tailwind las detecte.
- [ ] `utilization-bar.tsx`: barra `rounded-full` con tono según umbral (< 30% ok, 30–70% warning, > 70% o sobrecupo danger) y el porcentaje como texto.
- [ ] `page-header.tsx`: título en `font-display text-title`, subtítulo `text-small text-muted-foreground`, acción opcional.
- [ ] `empty-state.tsx`: icono Lucide `size-5` en `text-muted-foreground`, frase corta tuteando y una acción opcional. Sin ilustraciones ni emojis.
- [ ] `section.tsx` (opcional): contenedor con `gap-6` entre secciones.
- [ ] `lib/ui-status.ts` (puro, con pruebas): `utilizationTone(pct)`, `dueTone(daysToDue, paid)` (≤ 5 días warning, vencido danger, pagado ok) y `trialTone(daysLeft)`. Así las reglas de color de `AGENTS.md` viven en un solo lugar.

Verificación automática de reglas de diseño

- [ ] `scripts/check-design.mjs` (Node, sin dependencias) que busca en `app/**` y `components/**` (excepto `app/globals.css`) y falla si encuentra:
  - hex (`#abc`, `#aabbcc`), `rgb(`, `rgba(`, `hsl(`, `oklch(` en clases o estilos;
  - colores de la paleta por defecto de Tailwind (`(bg|text|border|ring|fill|stroke|from|to|via|outline|decoration)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|black|white)(-\d+)?`);
  - `shadow-*` fuera de `components/ui/{sheet,dialog,dropdown-menu,popover,select,sonner}.tsx`;
  - radios fuera de la escala (`rounded-lg`, `rounded-2xl`, `rounded-3xl`, `rounded-4xl`, `rounded-[…]`);
  - tamaños de texto de Tailwind (`text-xs`, `text-sm`, `text-base`, `text-lg`, `text-xl`… `text-9xl`, `text-[…]`);
  - emojis en `.tsx`.
  - Permite excepciones con un comentario `// design-allow: <motivo>` en la línea anterior.
- [ ] Script `lint:design` y encadenarlo en `lint` (`eslint && node scripts/check-design.mjs`) para que la regla de la "Definición de terminado" se verifique sola.
- [ ] Prueba `lib/__tests__/design-tokens.test.ts` que lee `app/globals.css`, extrae los valores de `:root` y `.dark` y verifica contraste WCAG:
  - ≥ 4,5:1: `ink`/`surface`, `ink`/`surface-raised`, `ink-muted`/`surface`, `ink-muted`/`surface-raised`, `primary-foreground`/`primary`, `primary`/`primary-soft`, `warning`/`warning-soft`, `danger`/`danger-soft`, `danger`/`surface-raised`.
  - ≥ 3:1: `card-1`…`card-6` sobre `surface-raised` (elementos gráficos), borde de campos según D12.
  - Ambos temas definen los mismos tokens.
  - `lib/brand.ts` coincide con `--surface` de cada tema.

Catálogo y login

- [ ] `app/(dev)/diseno/page.tsx` (o `app/dev/diseno`): catálogo de tokens, estilos de texto, botones, campos, badges, chips de tarjeta, `Money`, `UtilizationBar`, `EmptyState`. Responde `notFound()` cuando `NODE_ENV === 'production'`. Sirve para revisar cada cambio visual en claro y oscuro y para el paso 19.
- [ ] Rediseñar `app/(auth)/login/page.tsx`: `AppWordmark` + lema en `text-muted-foreground`, tarjeta `rounded-xl border`, un solo botón primary ("Ingresar"); el enlace mágico como `outline` o `ghost` ("Enviarme un enlace"). Errores con `Alert` de tono danger, en español y sin exclamaciones.
- [ ] Revisar textos ya existentes (login, callback, mensajes de error) contra las reglas de tono: tuteo, frases cortas, sin "!".

## Pruebas

- [ ] Vitest `lib/__tests__/format.test.ts`: `$1.284.500`, `$0`, `$1.000.000.000`, valores negativos si aplican, `US$ 15,99`, `US$ 1.234,50`, `15 nov`, `15 nov 2025` (otro año), `vie 15 nov`, `29 feb` en 2028, `68%`, `0%`, `100%`, `28,45% E.A.`, `formatDueIn` con 0, 1, 3 y −2 días. Comparar contra strings exactos (normalizando espacios no separables si Intl los usa).
- [ ] Vitest `lib/__tests__/ui-status.test.ts`: límites exactos 29,99% / 30% / 70% / 70,01%, sobrecupo, pago a 6, 5 y 0 días, vencido, pagado.
- [ ] Vitest de `cn` y de tokens (arriba).

## Verificación

```
pnpm typecheck && pnpm lint && pnpm test
node scripts/check-design.mjs      # 0 hallazgos
pnpm build
```

Prueba de que la verificación de diseño funciona: agregar temporalmente `className="bg-blue-500 rounded-lg shadow-md"` a un componente → `pnpm lint` falla con los 3 hallazgos; revertir.

Comprobaciones manuales (`pnpm dev`):

- [ ] DevTools → Computed en `body`: `font-family` empieza por Geist; en el título del catálogo y en el wordmark, Bricolage Grotesque.
- [ ] `/diseno` (catálogo) en claro y oscuro: todos los tokens se ven, sin colores fuera de la paleta.
- [ ] Cambiar el tema: persiste al recargar y no hay parpadeo blanco al cargar en oscuro.
- [ ] Login a 360 px: wordmark visible, campos y botones de 44px de alto, sin scroll horizontal, en claro y oscuro.
- [ ] En un iPhone o en el emulador de Safari, tocar un campo no hace zoom.
- [ ] La pestaña del navegador dice "Al Corte" en el login y "Movimientos · Al Corte" en una página con título.
- [ ] `grep -rn "AlCorte\|Alcorte\|AL CORTE" app components lib` solo devuelve identificadores de código (`alCorte`), nunca texto visible.

## Criterios de terminado

- Verificaciones en verde y la "Definición de terminado" de `AGENTS.md`, incluida "solo usa colores, radios y estilos de texto de `globals.css`".
- Commit: `feat: add al corte design system foundation`.

## Notas de progreso

<!-- Fecha — nota -->
