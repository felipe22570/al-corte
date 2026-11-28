# Paso 47 — Base de v2: estilos, componentes y galería

- **Hito PRD:** H13 (parte 2 de 11)
- **Estado:** 🟡 En progreso
- **Inicio:** 2026-11-27
- **Fin:**
- **Commit:**
- **Depende de:** 46
- **Decisiones aplicables (decididas, ver README):** D58, D60, D61, D62

## Objetivo

Construir el sistema visual nuevo, aislado del actual, y una galería interna para verlo completo antes de hacer pantallas.

## Contenido

- `app/v2/layout.tsx` con un contenedor propio (por ejemplo `data-ui="v2"`), fuentes Space Grotesk e Inter con `next/font/google` y el tema claro u oscuro existente.
- `app/v2/v2.css` con los tokens de `docs/design-v2.md` para oscuro y claro, definidos solo dentro del contenedor de v2. El plan del paso propone cómo exponerlos a Tailwind v4 sin cambiar ningún valor de `app/globals.css` (por ejemplo, utilidades con prefijo propio).
- `components/v2/` con el inventario de `docs/design-v2.md`: estructura, superficies, datos, etiquetas y formulario. Accesibles por teclado; diálogos con foco atrapado.
- `AppShell` con navegación lateral y, en celular, navegación inferior. Debe admitir más adelante un panel lateral derecho.
- `/v2/diseno`: galería con todos los componentes y estados, equivalente a `docs/mockups/v2/estados.html`, en ambos temas.
- Reglas de lint para v2 en `scripts/check-design.mjs` o un script hermano: solo tokens de v2, sin colores literales, sin importar de `components/` fuera de `components/v2`, sin `/v2` escrito a mano en enlaces.
- Los iconos de categoría y las claves `card-N` existentes se reutilizan desde `lib/`.

## Pruebas

- [x] Componentes con lógica (`Amount`, `Stepper`, `Segmented`, `InstallmentProgress`, proporciones de `StackedBar`) con pruebas.
- [x] Contraste de texto de al menos 4,5:1 en ambos temas (prueba automática sobre los tokens).

## Verificación

```
pnpm typecheck && pnpm lint && pnpm test && pnpm test:coverage
pnpm build && pnpm start
```

- [x] `/v2/diseno` coincide con `estados.html` y muestra cada componente en oscuro y claro.
- [x] La interfaz actual se ve igual que antes (capturas de tres rutas).


## Criterios de terminado

- Galería aprobada por el dueño.
- Commit: `feat: add v2 design tokens, base components and gallery`.

## Notas de progreso

- 2026-11-27 — Plan aprobado con las tres recomendaciones: Tailwind con prefijo propio, galería visible en producción solo con sesión (se retira en el paso 56) y modo claro con los valores de `docs/design-v2.md`, dejando su jerarquía para el paso 54.
- 2026-11-27 — El prefijo es `ui:` y no `v2:`: Tailwind solo acepta letras en el prefijo. `app/v2/v2.css` es una segunda entrada de Tailwind (`@theme inline prefix(ui)` con `--*: initial`): solo existen los tokens de v2 (colores, tipografía, radios, espaciado de 4 px y puntos de corte), sin paleta ni escalas por defecto y sin repetir el preflight de `globals.css`. Los valores viven en variables `--v2-*` bajo `[data-ui="v2"]` (claro) y `.dark [data-ui="v2"]` (oscuro); `[data-ui-theme]` fuerza un tema en un bloque (la galería). Los tamaños que cambian en celular (monto protagonista, título, texto, campos a 16 px, radios) toman su valor de variables con una consulta de medios. El color `dashed` del documento se llama `dash` en las clases, porque `border-dashed` es el estilo de borde. `app/globals.css` no cambió.
- 2026-11-27 — `app/v2/layout.tsx`: contenedor `data-ui="v2"` con Space Grotesk e Inter, `requireUser()` además del proxy, contador de borradores para la navegación y `OverlayRoot`, donde se abren diálogos, menús y ayudas para conservar tokens y fuentes. `app/v2/not-found.tsx` y `app/v2/[...missing]` muestran el no encontrado dentro del marco de v2. `/v2` (Inicio) llega en el paso 48; mientras tanto su precarga responde 404.
- 2026-11-27 — `components/v2/` sobre `@base-ui/react` (ya instalado, sin dependencias nuevas) y sin importar nada de `components/`: `AppShell` (con espacio para un panel derecho), `SideNav`, `BottomNav` (Inicio, Tarjetas, botón de nuevo gasto, Movimientos y "Más" con los demás destinos), `PageHeader`, `Panel`, `HeroPanel`, `Dialog`, `Alert`, `Toast`, `EmptyState`, `Skeleton`, `Amount`, `StatBlock`, `Row`, `DataTable`, `CardDot`, `UtilizationBar`, `StackedBar`, `MonthColumns`, `InstallmentProgress`, `Chip`, `Field`, `Input`, `AmountInput`, `Select`, `Stepper`, `Segmented`, `Switch`, `Checkbox`, `InfoTip`, más `Button` y `Menu` ("···"), que el inventario no listaba. `PaymentOption`, `PrepaymentTable`, `DraftCard`, `ReconcileTable` e `ImportReview` se construyen con sus pantallas (pasos 50 a 53). Las clases se unen con `cx` sin tailwind-merge, que confundiría los nombres propios (`ui:text-body`, `ui:text-text-2`).
- 2026-11-27 — Comprobado en el navegador con datos ficticios: diálogo con foco atrapado, cierre con Escape y foco devuelto al botón; menús y ayudas dentro del contenedor de v2; 360 px sin scroll horizontal; oscuro y claro lado a lado en `/v2/diseno`.
- 2026-11-27 — Lint: `scripts/check-design-v2.mjs` (en `pnpm lint`) rechaza en v2 colores literales, clases sin prefijo `ui:`, valores arbitrarios de color o sombra, sombras, importar la interfaz actual y `"/v2` escrito a mano; en v1, importar v2. `check-design.mjs` deja de revisar `app/v2` y `components/v2`.
- 2026-11-27 — Contraste: todos los pares de texto usados cumplen 4,5:1 en ambos temas (`lib/__tests__/design-v2.test.ts`). `text-3` sobre `track` en claro da 4,48 y ningún componente lo usa.
- 2026-11-27 — Para validar en el paso 54 (modo claro): con los valores actuales, `surface-raised` es igual a `surface`, así que el bloque principal no se distingue de los paneles y el esqueleto de carga no se ve sobre un panel.
- 2026-11-27 — Verificación: `pnpm typecheck`, `pnpm lint`, `pnpm test` (913 pruebas), `pnpm test:coverage` (dominio al 100 %) y `pnpm build` en verde. La comparación de HTML de las 37 rutas actuales solo difiere en el id de una categoría del usuario ficticio, recreado después del `db reset`. Sin cambios en `components/` (fuera de `components/v2`), `app/(app)`, `app/(auth)`, `app/globals.css` ni `DESIGN.md`.
- 2026-11-27 — Pendiente: aprobación de la galería por el dueño.
