# Paso 09 — Shell de la app: layout, navegación y tema

- **Hito PRD:** H3 (parte 1 de 2)
- **Estado:** ⬜ Pendiente
- **Inicio:** —
- **Fin:** —
- **Commit:** —
- **Depende de:** 02

## Objetivo

El esqueleto visual de las 8 pantallas del PRD (sección 8): navegación inferior en el celular, lateral en el computador, modo claro/oscuro y componentes base de presentación de dinero y fechas.

## Alcance

**Incluye:** layout de `(app)`, navegación, páginas placeholder de cada ruta, selector de tema, componentes `Money`, `DateLabel`, `EmptyState`, `PageHeader`, botón flotante "Nuevo gasto".

**No incluye:** datos reales (pasos 10 en adelante).

## Tareas

- [ ] Instalar `next-themes`; `components/theme-provider.tsx` y `components/theme-toggle.tsx` (claro, oscuro, sistema).
- [ ] Componentes shadcn/ui necesarios: `button`, `card`, `input`, `label`, `select`, `dialog`, `sheet`, `dropdown-menu`, `badge`, `separator`, `skeleton`, `sonner` (toasts; justificar si se agrega).
- [ ] `components/app-nav.tsx`: barra inferior fija en `< md` y barra lateral en `>= md`. Entradas: Tablero (`/`), Movimientos (`/movimientos`), Suscripciones (`/suscripciones`), Ajustes (`/ajustes`). Indica la ruta activa. Accesible (`aria-current`).
- [ ] `components/new-expense-fab.tsx`: botón flotante "Nuevo gasto" → `/movimientos/nuevo`, sin tapar la barra inferior.
- [ ] `components/money.tsx`: usa `formatMoney` de `lib/domain/money.ts`; recibe `string`, no `number`.
- [ ] `components/date-label.tsx`: formatea `YYYY-MM-DD` en español (`15 mar 2026`) sin convertir a UTC.
- [ ] `components/empty-state.tsx`, `components/page-header.tsx`.
- [ ] Páginas placeholder con `PageHeader` y `EmptyState`: `/`, `/movimientos`, `/movimientos/nuevo`, `/movimientos/[id]`, `/tarjetas/[id]`, `/tarjetas/[id]/extractos/[cutoff]`, `/suscripciones`, `/ajustes`.
- [ ] `app/(app)/loading.tsx` y `app/(app)/error.tsx` con textos en español.
- [ ] `app/not-found.tsx` en español.
- [ ] Botón "Cerrar sesión" movido a `/ajustes` o al menú.
- [ ] Metadatos `viewport` con `themeColor` para claro y oscuro.

## Archivos

- `app/(app)/layout.tsx`, `app/(app)/**/page.tsx`, `app/(app)/loading.tsx`, `app/(app)/error.tsx`, `app/not-found.tsx`
- `components/*.tsx` listados arriba, `components/ui/*`

## Verificación

```
pnpm typecheck && pnpm lint && pnpm test
pnpm build
```

Comprobaciones manuales (DevTools, modo dispositivo):

- [ ] A 360 px: barra inferior visible, sin scroll horizontal, el botón "Nuevo gasto" no tapa la navegación.
- [ ] A 1280 px: barra lateral visible, sin barra inferior.
- [ ] Las 8 rutas cargan (con un id cualquiera en las dinámicas) y muestran su título.
- [ ] El tema se puede cambiar; persiste al recargar; no hay parpadeo blanco al cargar en oscuro.
- [ ] En modo oscuro todos los textos son legibles (contraste razonable).
- [ ] Navegación con teclado: todos los enlaces reciben foco visible.
- [ ] `Money` con `'1234567'` muestra el formato de `es-CO` (p. ej. `$ 1.234.567,00` o `$ 1.234.567` según la configuración elegida para COP; definir `maximumFractionDigits: 0` para COP y anotarlo).

## Criterios de terminado

- Verificaciones en verde.
- Commit: `feat: add app shell with responsive navigation and theme toggle`.

## Notas de progreso

<!-- Fecha — nota -->
