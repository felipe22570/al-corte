# Paso 10 — Shell de la app: layout y navegación

- **Hito PRD:** H3 (parte 2 de 3)
- **Estado:** ⬜ Pendiente
- **Inicio:** —
- **Fin:** —
- **Commit:** —
- **Depende de:** 09

## Objetivo

El esqueleto de las 8 pantallas del PRD (sección 8) con el sistema de diseño del paso 09: navegación inferior en el celular, lateral en el computador, botón flotante "Nuevo gasto" y páginas placeholder.

## Alcance

**Incluye:** layout de `(app)`, navegación, placeholders de cada ruta, `loading`, `error` y `not-found`.

**No incluye:** datos reales (pasos 11 en adelante). Tema, fuentes y componentes de presentación ya existen desde el paso 09.

## Tareas

- [ ] `components/app-nav.tsx`:
  - `< md`: barra inferior fija, `bg-card`, `border-t`, sin sombra, con `env(safe-area-inset-bottom)`. Áreas táctiles ≥ 44px.
  - `>= md`: barra lateral `bg-card` con `border-r`, `AppWordmark` arriba (Bricolage Grotesque, `text-display` o la variante compacta definida en el paso 09), navegación y, abajo, `ThemeToggle` y "Cerrar sesión".
  - Entradas: Tablero (`/`), Movimientos (`/movimientos`), Suscripciones (`/suscripciones`), Ajustes (`/ajustes`). Iconos Lucide `size-5`, `strokeWidth={1.75}`.
  - Ruta activa: `text-foreground` y peso medio; inactivas `text-muted-foreground`. **No** usar colores de estado (verde, ámbar, rojo) para la navegación. `aria-current="page"`.
- [ ] `components/new-expense-fab.tsx`: botón flotante `rounded-full`, variante primary, icono `Plus` + texto "Nuevo gasto" (o solo icono con `aria-label` en el celular), encima de la barra inferior sin taparla. Es el único botón primary del tablero.
- [ ] `app/(app)/layout.tsx`: navegación + contenido con `px-4` en el celular, ancho máximo legible en escritorio y `gap-6` entre secciones.
- [ ] Páginas placeholder con `PageHeader` (`font-display text-title`) y `EmptyState`, cada una con `metadata.title` corto (la plantilla agrega "· Al Corte"): `/` (Tablero), `/movimientos`, `/movimientos/nuevo` (Nuevo gasto), `/movimientos/[id]`, `/tarjetas/[id]`, `/tarjetas/[id]/extractos/[cutoff]`, `/suscripciones`, `/ajustes`. Hoy `app/page.tsx` redirige a `/movimientos`: reemplazarlo por el tablero dentro de `(app)`.
- [ ] Textos de los placeholders con el tono de `AGENTS.md`, p. ej. "Aún no tienes tarjetas. Agrega la primera."
- [ ] `app/(app)/loading.tsx` con `skeleton` (adaptado al tema: `bg-secondary`, `rounded-md`).
- [ ] `app/(app)/error.tsx` en español con botón "Reintentar"; sin exclamaciones ni lenguaje alarmista.
- [ ] `app/not-found.tsx` en español.
- [ ] Componentes de shadcn/ui que se agreguen aquí (`sheet`, `dropdown-menu`, `skeleton`, `sonner`…) se adaptan con las reglas del paso 09 (radios, alturas, sombras solo en hojas/menús/diálogos).

## Verificación

```
pnpm typecheck && pnpm lint && pnpm test     # lint incluye check-design
pnpm build
```

Comprobaciones manuales (DevTools, modo dispositivo):

- [ ] A 360 px: barra inferior visible, sin scroll horizontal, el botón "Nuevo gasto" no tapa la navegación ni el último elemento de la lista.
- [ ] A 1280 px: barra lateral con el wordmark "Al Corte" en Bricolage Grotesque, sin barra inferior.
- [ ] Las 8 rutas cargan (con un id cualquiera en las dinámicas), muestran su título y la pestaña dice "<Título> · Al Corte".
- [ ] En claro y oscuro: bordes de 1px separan superficies, sin sombras en barras ni tarjetas.
- [ ] Navegación con teclado: todos los enlaces reciben foco visible (`ring`).
- [ ] La ruta activa se distingue sin depender solo del color (peso del texto o indicador).

## Criterios de terminado

- Verificaciones en verde.
- Commit: `feat: add app shell with responsive navigation`.

## Notas de progreso

<!-- Fecha — nota -->
