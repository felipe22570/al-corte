# Paso 10 — Shell de la app: layout y navegación

- **Hito PRD:** H3 (parte 2 de 3)
- **Estado:** ✅ Terminado y verificado
- **Inicio:** 2026-11-10
- **Fin:** 2026-11-10
- **Commit:** 7592082
- **Depende de:** 09

## Objetivo

El esqueleto de las 8 pantallas del PRD (sección 8) con el sistema de diseño del paso 09: navegación inferior en el celular, lateral en el computador, botón flotante "Nuevo gasto" y páginas placeholder.

## Alcance

**Incluye:** layout de `(app)`, navegación, placeholders de cada ruta, `loading`, `error` y `not-found`.

**No incluye:** datos reales (pasos 11 en adelante). Tema, fuentes y componentes de presentación ya existen desde el paso 09.

## Tareas

- [x] `components/app-nav.tsx`:
  - `< md`: barra inferior fija, `bg-card`, `border-t`, sin sombra, con `env(safe-area-inset-bottom)`. Áreas táctiles ≥ 44px.
  - `>= md`: barra lateral `bg-card` con `border-r`, `AppWordmark` arriba (Bricolage Grotesque, `text-display` o la variante compacta definida en el paso 09), navegación y, abajo, `ThemeToggle` y "Cerrar sesión".
  - Entradas: Tablero (`/`), Movimientos (`/movimientos`), Suscripciones (`/suscripciones`), Ajustes (`/ajustes`). Iconos Lucide `size-5`, `strokeWidth={1.75}`.
  - Ruta activa: `text-foreground` y peso medio; inactivas `text-muted-foreground`. **No** usar colores de estado (verde, ámbar, rojo) para la navegación. `aria-current="page"`.
- [x] `components/new-expense-fab.tsx`: botón flotante del tablero, sin tapar la navegación.
- [x] `app/(app)/layout.tsx`: navegación y contenido adaptable.
- [x] Ocho rutas placeholder con títulos, `PageHeader` y `EmptyState`; tablero protegido en `/`.
- [x] Textos de los placeholders en español, con el tono de `AGENTS.md`.
- [x] `app/(app)/loading.tsx` con esqueleto del tema.
- [x] `app/(app)/error.tsx` en español con botón "Reintentar".
- [x] `app/not-found.tsx` en español.
- [ ] Componentes de shadcn/ui que se agreguen aquí (`sheet`, `dropdown-menu`, `skeleton`, `sonner`…) se adaptan con las reglas del paso 09 (radios, alturas, sombras solo en hojas/menús/diálogos).

## Verificación

```
pnpm typecheck && pnpm lint && pnpm test     # lint incluye check-design
pnpm build
```

Comprobaciones manuales (DevTools, modo dispositivo):

- [x] A 360 px: barra inferior visible, sin scroll horizontal y botón sin tapar la navegación.
- [x] A 1280 px: barra lateral con el wordmark "Al Corte", sin barra inferior.
- [x] Las 8 rutas cargan con sus títulos y metadatos.
- [x] En claro y oscuro: bordes separan superficies, sin sombras en barras ni tarjetas.
- [x] Navegación con teclado: todos los enlaces reciben foco visible (`ring`) a 360 y 1280 px.
- [x] La ruta activa se distingue sin depender solo del color (peso del texto e indicador).

## Criterios de terminado

- Verificaciones en verde.
- Commit: `feat: add app shell with responsive navigation`.

## Notas de progreso

2026-11-10 — Implementados shell protegido, navegación adaptable, botón «Nuevo gasto» en el tablero, ocho rutas temporales, estados de carga/error y página 404. El control de tema y cierre de sesión están en la barra lateral y en Ajustes para celular. Verificadas las ocho rutas autenticadas con un usuario temporal local eliminado al finalizar, títulos y ancho de 360 px; capturas revisadas a 360 y 1280 px y en oscuro, primer foco de teclado visible y ruta activa. Pasan `pnpm typecheck`, `pnpm lint`, 51 pruebas Vitest, `pnpm build` y 81 pruebas pgTAP. Pendiente `supabase db reset`, que requiere autorización explícita porque borra datos locales.

2026-11-10 — Reinicio local autorizado y completado; las migraciones y el seed se aplicaron desde cero y pasan las 81 pruebas pgTAP. El reinicio borra los usuarios locales; las rutas continúan siendo placeholders hasta los siguientes pasos.

2026-11-10 — Verificada con teclado la navegación completa a 360 y 1280 px, con foco visible en sus cuatro enlaces. La comprobación usó un usuario temporal local, eliminado al finalizar.
