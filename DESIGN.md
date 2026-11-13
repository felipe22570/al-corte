---
name: Al Corte
description: Tus tarjetas, claras antes de cada corte.
colors:
  surface: "#f7f5f0"
  surface-raised: "#ffffff"
  ink: "#16201c"
  ink-muted: "#5b6661"
  border: "#e2ded5"
  input: "#8a8e86"
  overlay: "#0f1412"
  primary: "#0f6b4f"
  primary-soft: "#dcefe6"
  primary-foreground: "#ffffff"
  warning: "#9a4507"
  warning-soft: "#fbebd5"
  danger: "#b42318"
  danger-soft: "#fbe4e1"
  card-1: "#1f4e79"
  card-2: "#6b4fa0"
  card-3: "#0e7490"
  card-4: "#9f1239"
  card-5: "#a16207"
  card-6: "#475569"
  surface-dark: "#0f1412"
  surface-raised-dark: "#171d1a"
  ink-dark: "#eceeea"
  ink-muted-dark: "#a3ada8"
  border-dark: "#2a322e"
  input-dark: "#78827c"
  primary-dark: "#3dbe8b"
  primary-soft-dark: "#12352a"
  primary-foreground-dark: "#06140f"
  warning-dark: "#f2a14a"
  warning-soft-dark: "#3a2a12"
  danger-dark: "#f2777a"
  danger-soft-dark: "#3d1a1b"
  card-1-dark: "#5b9bd5"
  card-2-dark: "#a78bda"
  card-3-dark: "#38b2c9"
  card-4-dark: "#e0607e"
  card-5-dark: "#e0b13a"
  card-6-dark: "#94a3b8"
typography:
  display:
    fontFamily: '"Bricolage Grotesque", Geist, system-ui, sans-serif'
    fontSize: "40px"
    fontWeight: 700
    lineHeight: "44px"
    letterSpacing: "-0.02em"
  title:
    fontFamily: '"Bricolage Grotesque", Geist, system-ui, sans-serif'
    fontSize: "24px"
    fontWeight: 650
    lineHeight: "30px"
    letterSpacing: "-0.01em"
  wordmark:
    fontFamily: '"Bricolage Grotesque", Geist, system-ui, sans-serif'
    fontSize: "24px"
    fontWeight: 700
    lineHeight: "30px"
    letterSpacing: "-0.02em"
  heading:
    fontFamily: 'Geist, system-ui, -apple-system, "Segoe UI", sans-serif'
    fontSize: "17px"
    fontWeight: 600
    lineHeight: "24px"
  body:
    fontFamily: 'Geist, system-ui, -apple-system, "Segoe UI", sans-serif'
    fontSize: "15px"
    fontWeight: 400
    lineHeight: "22px"
  input:
    fontFamily: 'Geist, system-ui, -apple-system, "Segoe UI", sans-serif'
    fontSize: "16px"
    fontWeight: 400
    lineHeight: "24px"
  small:
    fontFamily: 'Geist, system-ui, -apple-system, "Segoe UI", sans-serif'
    fontSize: "13px"
    fontWeight: 400
    lineHeight: "18px"
  amount-lg:
    fontFamily: 'Geist, system-ui, -apple-system, "Segoe UI", sans-serif'
    fontSize: "30px"
    fontWeight: 600
    lineHeight: "36px"
    letterSpacing: "-0.01em"
  amount:
    fontFamily: 'Geist, system-ui, -apple-system, "Segoe UI", sans-serif'
    fontSize: "15px"
    fontWeight: 500
    lineHeight: "22px"
rounded:
  sm: "6px"
  md: "10px"
  xl: "16px"
spacing:
  unit: "4px"
  inline: "8px"
  field: "12px"
  card: "16px"
  section: "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.md}"
  button-outline:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
  field:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.ink}"
    typography: "{typography.input}"
    rounded: "{rounded.md}"
  card:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    padding: "{spacing.card}"
  status-ok:
    backgroundColor: "{colors.primary-soft}"
    textColor: "{colors.primary}"
    typography: "{typography.small}"
    rounded: "{rounded.sm}"
---

# Design System: Al Corte

## Overview

**Creative North Star: "El número manda"**

Principio existente de `AGENTS.md`, no una nueva metáfora de marca. El sistema es sobrio, cálido y preciso: superficies neutras, importes legibles y color con significado. La expresividad vive en la marca tipográfica y los títulos; el resto facilita comparar valores y entender el extracto.

`app/globals.css` es la única fuente de verdad de colores, radios y tipografía. La sección «Diseño» de `AGENTS.md` determina su aplicación; `docs/PRD.md` determina el producto y las decisiones aprobadas. Este documento captura esas reglas, no las reemplaza. El frontmatter es un inventario de los tokens existentes, no una segunda paleta editable: ante cualquier diferencia, corregir esta captura a partir del CSS. Los sufijos `-dark` del inventario representan las redefiniciones de `.dark`, no nuevas variables CSS.

Las observaciones del código solo constituyen patrones cuando respetan esas fuentes. Las desviaciones conocidas se separan al final; no copiarlas como precedentes. No se redefine la identidad ni se añade alcance de v2/v3.

**Key Characteristics:**

- Importe protagonista y cifras tabulares.
- Bordes finos, sin sombras en superficies de consulta.
- Verde, ámbar y rojo reservados para acciones y estados con significado.
- Marca sin logo; español de Colombia, directo y sin alarmismo.
- Mismo vocabulario de tokens en claro y oscuro.

## Colors

El fondo cálido y la tinta ligeramente verdosa sostienen una paleta funcional, no decorativa. Los valores exactos de ambos temas están en el inventario inicial; los componentes consumen las variables y clases semánticas, nunca esos literales.

### Primary

- **Verde corte** (`primary`): acción principal y estado al día. Su pareja suave (`primary-soft`) forma el fondo de etiquetas de estado; `primary-foreground` asegura el texto sobre la acción sólida en ambos temas.
- **Ámbar de atención** (`warning` / `warning-soft`): vencimientos próximos y utilización intermedia. No es un acento secundario de marca.
- **Rojo de problema** (`danger` / `danger-soft`): vencido, sobrecupo y utilización alta. `destructive` es el alias de `danger` para componentes.

| Significado | Aplicación | Criterio vigente |
| --- | --- | --- |
| Al día, pagado | `bg-primary-soft text-primary` | Extracto pagado; utilización menor al 30 %. |
| Atención | `bg-warning-soft text-warning` | Pago en cinco días o menos; prueba por vencer; utilización del 30 % al 70 %, inclusive. |
| Problema | `bg-danger-soft text-danger` | Pago vencido; sobrecupo; utilización mayor al 70 %. |
| Neutro | `bg-secondary text-foreground` | Estado sin urgencia, sin atribuirle una señal positiva o negativa. |

Los casos de presupuesto de `AGENTS.md` describen el lenguaje de estado, no autorizan implementar presupuestos en el MVP. Los estados siempre incluyen texto; nunca se comunican solo mediante color.

### Neutral

| Token de origen | Alias / clases de uso | Función |
| --- | --- | --- |
| `surface` | `background`, `muted`; `bg-background` | Fondo de página. |
| `surface-raised` | `card`, `popover`, `sidebar`; `bg-card` | Tarjetas, campos y menús. |
| `ink` | `foreground`, `card-foreground`, `popover-foreground` | Texto principal e importes. |
| `ink-muted` | `muted-foreground` | Fechas, comercios, ayudas e iconos neutros. |
| `border` | `border-border`, `secondary` | Separadores de un píxel y superficies secundarias. |
| `input` | `border-input`, `field-border` | Contorno de campos; contraste mínimo 3:1 según D12. |
| `primary` | `ring` | Identificador visual del foco. |

`text-input` es una utilidad de **tipografía**, no un color de texto. Para el texto del campo usar `text-foreground`; para su borde, `border-input`.

### Identidad de tarjetas y gráficos

- `card-1` azul, `card-2` violeta, `card-3` petróleo, `card-4` vino, `card-5` mostaza y `card-6` pizarra.
- Guardar la clave (`card-3`), no un color literal. Usarla únicamente en el chip junto al nombre, la franja de la tarjeta y su serie en gráficos, acompañada del nombre o los últimos cuatro dígitos.
- Recharts consume `var(--card-N)` o `var(--chart-N)`; los seis `chart-N` son alias de las tarjetas. Rejillas con `var(--border)` y etiquetas con `var(--muted-foreground)`.
- Categorías sin color propio en los datos, formularios y lista: icono Lucide y nombre (D11). Por D17, el gráfico por categoría usa `chart-1` a `chart-5`, con asignación determinista por ID y los mismos colores en sus iconos de leyenda; cada categoría conserva nombre y valor. No utiliza el token gris ni modifica `categories.color`.
- El tema usa `.dark` en `<html>` mediante next-themes; respetar la preferencia Sistema. No crear paletas locales por componente.

**The Semantic Color Rule.** Ningún color de estado es decorativo. Si no existe un token adecuado, resolverlo en la fuente de verdad antes de usarlo; no inventar un literal en el componente.

## Typography

**Display Font:** Bricolage Grotesque, con Geist y fuentes de sistema como respaldo. Exclusiva del nombre de la app y títulos de pantalla.

**Body Font:** Geist, con `system-ui`, `-apple-system`, `Segoe UI` y `sans-serif` como respaldo. Incluye encabezados de sección, controles, tablas y montos. No hay familia monoespaciada independiente.

`app/layout.tsx` carga ambas con `next/font/google`; las variables `--font-geist` y `--font-bricolage` se aplican en `<html>`. El inventario inicial registra tamaño, interlineado, peso y espaciado de cada rol.

| Clase | Uso |
| --- | --- |
| `text-display` | Marca tipográfica principal **Al Corte**, sin icono convertido en logo. |
| `text-wordmark` | Marca compacta de 24 px en la barra lateral. |
| `text-title` | Título principal de pantalla. |
| `text-heading` | Encabezado de sección, en Geist. |
| `text-body` | Texto general y botones. |
| `text-input` | Campos de formulario; 16 px para evitar zoom automático en iOS (D12). |
| `text-small` | Ayudas, fechas, subtítulos y etiquetas. |
| `text-amount-lg` | Monto protagonista de la pantalla. |
| `text-amount` | Montos en filas, listas, tablas y desgloses. |

Ambos estilos de importe usan `font-variant-numeric: tabular-nums`. Alinear los importes a la derecha en listas y tablas, sin aplicar Bricolage a los números. No sustituir estas utilidades por tamaños Tailwind ni tamaños arbitrarios.

Todo formato pasa por `lib/format.ts`: COP sin decimales ni espacio después de `$` (`$1.284.500`); USD con dos decimales (`US$ 15,99`); fechas cortas (`15 nov`), año solo cuando no es el actual; porcentajes enteros (`68%`) y tasas con dos decimales (`28,45% E.A.`). No formatear valores de negocio en cada componente.

**The Number First Rule.** Cada pantalla de consulta debe dejar claro su monto protagonista con `text-amount-lg`; no competir con varios importes del mismo énfasis.

## Layout

- Retícula de 4 px. Padding de tarjetas y margen lateral móvil de 16 px (`p-4` / `px-4`); separación de secciones de 24 px (`gap-6`); 8 px para relaciones próximas y 12–16 px dentro de grupos.
- Contenido centrado en el área disponible **a la derecha** de la barra lateral. Encabezado y contenido comparten un mismo ancho máximo. Las pantallas de consulta pueden usar dos columnas cuando haya espacio; no imponerlas en 360 px.
- El layout protegido desplaza el contenedor exterior desde `md` y centra un `main` común de hasta 1024 px (`max-w-5xl`); no limitar solo el cuerpo de cada página a un ancho distinto del encabezado. `PageHeader` permite envolver títulos largos y agrupa las acciones por separado.
- Navegación inferior en celular, lateral desde `md` (768 px en Tailwind actual). La implementación tiene barra lateral de 256 px y navegación inferior de cuatro destinos: Tablero, Movimientos, Suscripciones y Ajustes.
- Reservar espacio para la navegación fija, «Nuevo gasto» y `env(safe-area-inset-bottom)`. No ocultar la última fila o acción detrás de elementos fijos.
- Objetivos táctiles de al menos 44 × 44 px con `pointer-coarse:`. En escritorio, botones y campos de 36–40 px (`h-9` / `h-10`). El requisito táctil no autoriza convertir todos los tamaños de escritorio en 44 px.
- Las hojas se presentan abajo en móvil y a la derecha en escritorio; contenido desplazable dentro del alto disponible. La hoja actual limita su alto móvil a `90dvh` y su ancho de escritorio a `max-w-lg`.
- Comprobar desde 360 px, texto largo, foco por teclado y ambos temas. La revisión del catálogo no sustituye comprobar formularios, tablas o estados con datos reales.

## Elevation & Depth

**The Borders, Not Shadows Rule.** Las superficies se separan con bordes de un píxel y los tokens `background` / `card`, no con sombras. No añadir sombra a tarjetas, botones, barras de navegación, gráficos ni tooltips ad hoc.

Las sombras se reservan para superficies superpuestas: sheet, dialog, popover y select; los menús se ajustan a ese mismo papel según `AGENTS.md`. `components/ui/sheet.tsx` usa actualmente `shadow-lg`; no hay un token de sombra propio en `app/globals.css`, por lo que no se inventa una escala de elevación. Los anillos de foco son señal interactiva, no elevación decorativa.

El verificador permite técnicamente sombras solo en los archivos exactos `components/ui/{sheet,dialog,dropdown-menu,popover,select,sonner}.tsx`. La excepción técnica de `sonner` no crea una regla visual ni una obligación de incorporar notificaciones con sombra. Fuera de esa lista, prohíbe `shadow-*` salvo `shadow-none`; no evadir la regla mediante CSS en línea o cambios de ubicación.

El backdrop de Sheet usa `bg-overlay/60`. `--overlay` mantiene el mismo valor oscuro en ambos temas; no derivarlo de `foreground`, cuya tinta cambia a clara en modo oscuro.

## Shapes

- Esquinas pequeñas de 6 px (`rounded-sm`) para etiquetas de estado.
- Esquinas medias de 10 px (`rounded-md`) para botones, campos y elementos de navegación.
- Esquinas amplias de 16 px (`rounded-xl`) para tarjetas y hojas, incluidas las variantes direccionales observadas (`rounded-t-xl`, `rounded-l-xl`).
- Forma completamente redondeada (`rounded-full`) para el botón flotante, barras de utilización y puntos identificadores de tarjeta.
- Bordes de un píxel: `border-border` en superficies y `border-input` en campos.

Aunque el CSS también declara `--radius-lg` con el mismo valor que `xl`, **`rounded-lg` está prohibido por el verificador**. Usar la clase canónica `rounded-xl`; tampoco usar `rounded-2xl`, `rounded-3xl`, `rounded-4xl` ni radios arbitrarios.

## Components

### Buttons

Controles sobrios, con una sola acción principal por pantalla. Reutilizar `Button` / `buttonVariants` de `components/ui/button.tsx`; no reconstruir sus estados localmente.

- Primario (`variant="default"`): `bg-primary text-primary-foreground`, esquinas medias y padding horizontal de 16 px en el tamaño normal; hover `bg-primary/90` para conservar contraste. El verde sólido se reserva a la acción principal; los estados positivos usan la pareja suave.
- Outline: borde de superficie, fondo de página y texto principal; revisar su variante oscura existente antes de extenderlo.
- Secondary y ghost: acciones de menor jerarquía. Link: tinta neutra y subrayado visible. Destructive: `bg-danger-soft text-danger` y borde de peligro al interactuar, no un segundo primario. La selección del calendario y la casilla «sin intereses» usan neutros, no verde de marca.
- Foco visible con `ring`, borde de foco y anillo de dos píxeles; deshabilitado sin interacción y con opacidad reducida. Transiciones de color con `motion-safe:`.
- Tamaños actuales: texto normal y grande de 40 px, pequeño y extra pequeño de 36 px; iconos de 36–40 px. En puntero grueso todos alcanzan 44 px mediante `pointer-coarse:`. `buttonVariants()` normaliza las clases también cuando se usa en enlaces, para no perder el borde outline.

### Inputs / Fields

Campos claros, legibles y delimitados: fondo `card`, texto `foreground`, borde `input`, radio medio, padding horizontal de 12 px y `text-input`. Foco visible con `ring`; error con `aria-invalid` y borde `destructive`; deshabilitado con opacidad y cursor apropiados. Conservar etiquetas accesibles y mensajes de error explícitos.

`SelectControl` es el contrato compartido para formularios, filtros, mes y tema, construido con los primitives de Base UI de `components/ui/select.tsx`. Recibe opciones, valor controlado o inicial, `onValueChange`, nombre de formulario, placeholder y atributos accesibles del disparador. El nombre alimenta el campo oculto de Base UI; no duplicar un `<select>` nativo. La etiqueta visible se conecta al disparador mediante `id` y `htmlFor`, o un `aria-label` cuando corresponde.

- Disparador de 40 px en escritorio y 44 px en puntero grueso, texto seleccionado truncado dentro de `min-w-0` y opciones con ajuste de texto.
- Menú con borde de tema y sombra de superficie superpuesta, altura limitada al espacio disponible y scroll; selección indicada con marca y estado semántico, no solo color.
- Conservar estados deshabilitado, foco y `aria-invalid` con `aria-describedby` hacia el error. Las flechas y Home/End recorren opciones; Enter selecciona y Escape cierra sin cerrar el Sheet padre.

`DateInput` conserva la entrada manual `dd/mm/aaaa` (también acepta ocho dígitos), etiqueta, ayuda de formato y errores asociados. No usa el selector de fecha nativo del navegador. El botón nombrado abre `DateCalendar` en un Popover de Base UI con mes y días en español.

- Un solo día está en el orden de tabulación. Flechas mueven uno o siete días; PageUp/PageDown cambian mes; Home/End van al primer/último día del mes. Enter activa el día enfocado. «Hoy» y «Borrar» son acciones explícitas.
- La navegación actualiza el foco en `useLayoutEffect`, después de renderizar los días y antes de que el Popover recupere foco del mes eliminado. No diferir ese foco a `requestAnimationFrame`.
- Al elegir, se actualiza la fecha y se cierra el calendario; Escape cierra primero el calendario y devuelve el foco al disparador, sin cerrar el Sheet. No robar el foco a los botones de cambio de mes.
- `MonthInput` combina el Select compartido y un año numérico; envía un campo oculto `YYYY-MM`.

### Cards / Containers

Superficies planas con fondo `card`, borde fino, radio amplio y padding de 16 px. `CardTitle` usa `text-heading`; descripción en `text-small text-muted-foreground`. El componente `Card` separa header, content y footer, y el footer incorpora borde superior. `CardSummary` reúne identificación, próximo pago, cupo disponible y utilización sin sombra; una franja superior de 4 px repite la identidad `card-1…card-6` del chip y de la serie mensual, sin teñir montos ni estados.

### Chips y estados

`StatusBadge` usa etiqueta textual, radio pequeño y padding de 8 × 4 px; elegir `ok`, `warning`, `danger` o `neutral` según el estado real. Su ancho se ajusta al texto (`w-fit`) sin estirarse en columnas; `max-w-full` y `wrap-anywhere` permiten envolver nombres largos sin desbordar. `CardColorChip` combina un punto de 8 px con nombre o últimos cuatro dígitos. No intercambiar color de tarjeta y color de estado.

`UtilizationBar` muestra el porcentaje en `StatusBadge` con el par suave correspondiente: menos del 30 % positivo, entre 30 % y 70 % atención, más del 70 % problema. La barra de 8 px usa pista secundaria y relleno neutro en utilización baja, ámbar o rojo cuando hay atención o problema; no compite con el verde sólido de la acción principal. Conserva `role="progressbar"` y límites accesibles. No esconder valores fuera de rango en el texto aunque la longitud visual se limite.

### Navigation

Mismos cuatro destinos en lateral e inferior. El destino activo utiliza tinta fuerte, peso mayor y, en móvil, un indicador neutro; no usa colores de urgencia como decoración. Mantener `aria-current="page"`, etiquetas textuales y foco visible. La marca es únicamente **Al Corte** en `font-display`: `text-display` en su presentación principal y `text-wordmark` compacto en la barra lateral.

### Sheet, avisos y estados vacíos

`Sheet` se apoya en Dialog de Base UI para trigger, portal, backdrop, popup, título y cierre. Fondo de tarjeta, borde fino y radio amplio; el cierre lleva nombre accesible y el backdrop usa `bg-overlay/60`. `SheetBody` contiene el área desplazable; `SheetFooter` queda fuera de ella y mantiene Guardar visible, incluyendo el área segura inferior. Conservar foco atrapado y devolverlo al disparador al cerrar.

`Disclosure`, `DisclosureSummary` y `DisclosureContent` comparten el patrón nativo `<details>/<summary>`: disparador de 40 px (44 px táctil), foco visible, indicador Lucide y espaciado del contenido que desaparece al colapsar. No agregar cajas o bordes anidados. En desgloses financieros, una lista puede sustituir `DisclosureContent` cuando necesita su semántica y espaciado propios.

`Alert` tiene variantes neutra, success, warning y destructive usando los pares semánticos, con título y descripción en tamaño pequeño. `EmptyState` combina icono neutro, texto corto y una acción cuando corresponde; no usa ilustraciones, emojis ni mensajes de venta.

### Iconos, gráficos y movimiento

Lucide de 20 px (`size-5`), `strokeWidth={1.75}`, tinta atenuada salvo estados. Iconos decorativos sin duplicar el nombre accesible; no usarlos como logo. Las tablas y gráficos conservan nombres y valores textuales, no solo una leyenda cromática.

Las barras de Recharts tienen animación desactivada; el CSS elimina la transición de sus tooltips cuando se solicita movimiento reducido. Los estados de carga usan `motion-safe:animate-pulse`. No se define una nueva escala de animación o duración.

### Desviaciones de la captura inicial — corregidas

| ID | Implementación corregida | Contrato vigente |
| --- | --- | --- |
| D-01 · Densidad uniforme | `Button`, `Input` y `SelectTrigger` separan escritorio de puntero grueso. | 36–40 px en escritorio y al menos 44 px táctiles. |
| D-02 · Selects nativos | `SelectControl` y `components/ui/select.tsx` centralizan selección y estilos; `DateInput` usa calendario español propio. | Contratos compartidos, nombres accesibles, valores de formulario y navegación por teclado. |
| D-03 · Backdrop dependiente de la tinta | `--overlay` está definido en `app/globals.css`; Sheet usa `bg-overlay/60`. | Velo oscuro estable entre temas, independiente de la tinta. |
| D-04 · Anchos y centrado | El contenedor exterior reserva el lateral; encabezado y cuerpo comparten `main` de hasta 1024 px. | Centrado en el área restante, sin anchos de cuerpo divergentes. |
| D-05 · Etiquetas de gráficos | Los ejes consumen `.chart-axis` con `text-small`. | Tipografía definida en `app/globals.css`, no tamaños locales de 10 px. |

La tabla describe correcciones comprobables en el código, no una certificación de todos los estados. No interpretar que aprobar `pnpm lint:design` garantiza el cumplimiento visual completo.

## Do's and Don'ts

### Do:

- **Do** reutilizar los tokens de `app/globals.css`, las utilidades de texto y los componentes existentes cuando respeten las reglas anteriores.
- **Do** destacar el monto importante, alinear importes y explicar su fecha y estado con texto.
- **Do** mantener encabezado y contenido alineados, densidad de escritorio y objetivos táctiles diferenciados.
- **Do** verificar 360 px, modo oscuro, teclado, texto largo y movimiento reducido al cambiar interfaz.
- **Do** ejecutar `pnpm lint:design` y revisar también los aspectos que el script no cubre.

### Don't:

- **Don't** escribir colores literales en componentes: hex ni funciones `rgb()`, `rgba()`, `hsl()` u `oklch()`; tampoco usar la paleta Tailwind (`bg-blue-500`, `text-gray-600`, `text-white`, etc.). Usar clases o variables del tema.
- **Don't** usar `rounded-lg`, `rounded-2xl`, `rounded-3xl`, `rounded-4xl` ni radios arbitrarios. El radio amplio canónico es `rounded-xl`.
- **Don't** usar `text-xs`, `text-sm`, `text-base`, `text-lg`, tamaños `text-*xl` ni tamaños arbitrarios. Usar `text-small`, `text-body`, `text-input` y los demás roles documentados.
- **Don't** añadir sombras fuera de sheet/dialog/popover/select y los menús permitidos; respetar además la lista exacta de archivos del verificador descrita en Elevation & Depth.
- **Don't** inventar logo, iconos de marca, emojis, ilustraciones ni una paleta nueva de categorías; el gráfico por categoría reutiliza los tokens existentes según D17. No usar estados como adornos.
- **Don't** forzar todos los botones a 44 px en escritorio ni duplicar selects locales o derivar el backdrop de la tinta.
- **Don't** introducir varios primarios en una pantalla o comunicar un estado únicamente por color.

**Verificación obligatoria:** `scripts/check-design.mjs` recorre los archivos TS/TSX/JS/JSX de `app/` y `components/`; comprueba colores literales y de paleta, radios y tamaños de texto fuera de escala, emojis y sombras no permitidas. `pnpm lint` incluye esta comprobación. Una excepción `design-allow:` en la línea anterior puede omitir técnicamente una línea, pero no autoriza saltarse el sistema: requiere justificación explícita y revisión, nunca usarla para normalizar una desviación.

**Procedencia y límites:** captura basada en `app/globals.css`, `AGENTS.md`, D11–D14 del PRD, componentes UI, navegación, gráficos y layouts existentes. Catálogo `/diseno` disponible solo en desarrollo; la comprobación visual del catálogo acredita sus muestras, no todo el producto ni estados privados con datos reales. El sidecar `.impeccable/design.json` conserva muestras estáticas de la captura inicial, anterior al pulido; no sustituye este contrato actualizado ni el catálogo interactivo.

## Catálogo y verificación de componentes

`app/diseno/page.tsx` conserva el catálogo solo en desarrollo. Incluye estados en columna para comprobar `StatusBadge`, selectores con etiquetas largas (también sin espacios), opción deshabilitada, error asociado y corrección interactiva, fecha y mes, Disclosure y un Sheet con acciones fijas. `DesignControlsPreview` y `DesignSheetPreview` solo mantienen estado local; guardar el ejemplo no llama a acciones de negocio.

La muestra «Identidad de tarjetas» añade seis tarjetas con datos explícitamente de ejemplo y un gráfico mensual para comparar franja, chip, series y estados. Las pantallas de detalle de tarjeta y extracto, y el filtro de tarjeta del historial, conservan la misma identidad junto al nombre o los últimos cuatro dígitos. No se agregan colores de categoría fuera del gráfico autorizado por D17.

La navegación del calendario tiene 18 regresiones automatizadas, incluyendo cambios de mes, año y febrero bisiesto, y su integración en Popover y Sheet. La comprobación en Chromium sobre build de producción local cubrió 48 combinaciones de teclado, 360/1440 px y ambos temas; no equivale a una prueba en un dispositivo físico.

El catálogo actualizado se comprobó en Chromium a 360, 720 y 1440 px en claro y oscuro: badges compactos, opciones largas con y sin espacios sin desbordamiento, corrección del error del selector, estado deshabilitado, Disclosure por teclado y Sheet con foco contenido y guardado solo local. Hay ocho pruebas adicionales para el badge y la presencia, estados y restricción a desarrollo del catálogo.

Se comprobó también reflow equivalente a ampliar una ventana de 1440 × 900 al 200 %: viewport CSS de 720 × 450 y DPR 2, en ambos temas. Menú, calendario y acciones del Sheet permanecieron dentro del viewport y sin desbordamiento horizontal. Es una simulación de reflow, no zoom nativo: el atajo del navegador automatizado no cambió la escala, y el ensayo separado con `zoom: 2` de CSS alteró la posición del menú, por lo que no se usa como evidencia de compatibilidad con zoom nativo.

Zoom nativo, Safari/iOS, VoiceOver y otros lectores de pantalla reales siguen pendientes de comprobación manual. Los nombres, roles y relaciones accesibles inspeccionados o probados no sustituyen esas verificaciones. No afirmar compatibilidad o certificación por el resultado de Chromium ni por las pruebas unitarias.
