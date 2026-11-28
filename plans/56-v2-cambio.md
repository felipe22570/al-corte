# Paso 56 — Cambio definitivo y retiro de la interfaz anterior

- **Hito PRD:** H13 (parte 11 de 11)
- **Estado:** ⬜ Pendiente
- **Inicio:**
- **Fin:**
- **Commit:**
- **Depende de:** 55
- **Decisiones aplicables (decididas, ver README):** D58, D60, D64

## Objetivo

Dejar la interfaz nueva como la única, en las rutas definitivas, y borrar todo lo de la anterior.

## Contenido

En un solo cambio, después de crear la etiqueta `v1-final`:

- Mover las rutas de `app/v2` a su lugar definitivo y cambiar la base de `lib/routes.ts` a `""`.
- Redirigir `/v2/*` a las rutas definitivas.
- Rediseñar el inicio de sesión con `login.html`.
- Borrar las páginas anteriores, `components/` fuera de `components/v2`, `components/ui` si quedó sin uso, los tokens anteriores de `app/globals.css`, las páginas internas de diseño anteriores y sus pruebas. Decidir si `components/v2` se renombra a `components/`.
- Quitar las rutas `/v2` de `revalidateFinancialViews` y las reglas de lint de la interfaz anterior.
- Documentación: `docs/design-v2.md` pasa a ser `DESIGN.md`; la sección "Diseño" y "Rediseño v2" de `AGENTS.md` se unifican con las reglas nuevas; `PRODUCT.md` y la sección 8 del PRD reflejan las pantallas nuevas; `docs/mockups/v2/` se conserva como referencia.
- Manifest de la PWA, `metadata` y colores de tema con los valores nuevos.

## Verificación

```
pnpm typecheck && pnpm lint && pnpm test && pnpm test:coverage
supabase db reset && supabase test db
pnpm build && pnpm start
```

- [ ] Ninguna importación apunta a archivos borrados; sin componentes ni estilos sin uso.
- [ ] `/v2/...` redirige a la ruta definitiva.
- [ ] Recorrido completo en producción, en celular y escritorio.
- [ ] Captura por correo y cron de suscripciones siguen funcionando.


## Criterios de terminado

- H13 marcado como cerrado en `plans/README.md` y congelamiento levantado.
- Commit: `feat: switch to v2 interface and remove v1`.

## Notas de progreso

<!-- Fecha — nota -->
