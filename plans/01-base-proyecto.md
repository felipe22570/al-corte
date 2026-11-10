# Paso 01 — Base del proyecto

- **Hito PRD:** H0 (parte 1 de 3)
- **Estado:** ⬜ Pendiente
- **Inicio:** —
- **Fin:** —
- **Commit:** —
- **Depende de:** nada

## Objetivo

Tener el repositorio inicializado con Next.js (App Router) + TypeScript estricto + Tailwind + shadcn/ui + Vitest, con la estructura de carpetas de `AGENTS.md` y los scripts `dev`, `test`, `lint` y `typecheck` funcionando.

## Alcance

**Incluye:** scaffolding, configuración de herramientas, estructura de carpetas, una página inicial mínima y una prueba de humo.

**No incluye:** Supabase, autenticación, layout final ni lógica de dominio.

## Tareas

- [ ] `git init` y `.gitignore` (incluye `.env*` excepto `.env.example`, `node_modules`, `.next`, `coverage`, `supabase/.temp`, `supabase/.branches`).
- [ ] Crear la app con `pnpm create next-app@latest` en la raíz: TypeScript, ESLint, Tailwind, App Router, **sin** carpeta `src/`, alias `@/*`. Conservar `AGENTS.md`, `docs/` y `plans/`.
- [ ] Verificar `"strict": true` en `tsconfig.json`; agregar también `"noUncheckedIndexedAccess": true`.
- [ ] Fijar la versión de Node en `package.json` (`engines`) y `packageManager` con la versión de pnpm.
- [ ] Scripts en `package.json`:
  - `dev`, `build`, `start`
  - `lint` → `next lint` o `eslint .` según la versión de Next.js
  - `typecheck` → `tsc --noEmit`
  - `test` → `vitest run`
  - `test:watch` → `vitest`
  - `test:coverage` → `vitest run --coverage`
- [ ] Instalar `vitest` y `@vitest/coverage-v8` (dev). Crear `vitest.config.ts` con:
  - `environment: 'node'`
  - alias `@` → raíz del proyecto (configurado a mano, sin plugin extra)
  - `TZ=UTC` forzado para el proceso de pruebas (así se detecta cualquier dependencia accidental de la zona local)
  - cobertura limitada a `lib/domain/**` con umbral 100% en líneas, ramas, funciones y sentencias (se activa en el paso 04; aquí puede quedar configurado pero sin archivos)
- [ ] Inicializar shadcn/ui (`pnpm dlx shadcn@latest init`), estilo por defecto, variables CSS, soporte de modo oscuro por clase.
- [ ] Crear la estructura de carpetas de `AGENTS.md` con un `.gitkeep` donde haga falta: `components/`, `components/ui/`, `lib/domain/__tests__/`, `lib/supabase/`, `lib/actions/`, `lib/validation/`, `supabase/migrations/`, `supabase/functions/`.
- [ ] `name: "al-corte"` en `package.json`. Configurar `<html lang="es-CO">` y `metadata.title = { default: 'Al Corte', template: '%s · Al Corte' }` (nombre según la tabla de `AGENTS.md`). Las fuentes, el tema y los tokens se completan en el paso 09.
- [ ] Conservar `app/globals.css` con los tokens de Al Corte; `shadcn init` no debe sobrescribirlo (si lo hace, restaurarlo desde git).
- [ ] Prueba de humo `lib/domain/__tests__/smoke.test.ts` (se borra en el paso 04).
- [ ] `.env.example` vacío de valores (se completa en el paso 02).
- [ ] Opcional: Prettier con `prettier-plugin-tailwindcss`. Si se agrega, justificarlo en la nota del paso.

## Archivos

- `package.json`, `pnpm-lock.yaml`, `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`, `vitest.config.ts`, `components.json`, `postcss.config.mjs`
- `app/layout.tsx`, `app/page.tsx`, `app/globals.css`
- `lib/utils.ts` (de shadcn)
- `.gitignore`, `.env.example`

## Riesgos

- `create-next-app` no acepta un directorio con archivos: crearlo en una carpeta temporal y mover el contenido, o usar la opción que permita el directorio actual. No sobrescribir `AGENTS.md` (Next.js reciente puede generar su propio `AGENTS.md`/`CLAUDE.md`; si lo hace, conservar el nuestro).
- Versiones recientes de Next.js cambian `next lint` y `middleware.ts` (→ `proxy.ts`). Seguir la documentación de la versión instalada.

## Verificación

Ejecutar desde la raíz:

```
pnpm install --frozen-lockfile
pnpm typecheck        # sin errores
pnpm lint             # sin errores ni warnings
pnpm test             # 1 prueba pasa (smoke)
pnpm build            # build exitoso
```

Comprobaciones manuales:

- [ ] `pnpm dev` y abrir `http://localhost:3000`: carga la página inicial sin errores en consola.
- [ ] `grep -n '"strict": true' tsconfig.json` devuelve una línea.
- [ ] Existen todas las carpetas de la estructura (`ls lib/domain lib/supabase lib/actions lib/validation components/ui supabase/migrations supabase/functions`).
- [ ] `git status` no muestra archivos `.env` ni `node_modules`.
- [ ] `AGENTS.md`, `docs/PRD.md` y `plans/` siguen intactos.

## Criterios de terminado

- Todos los comandos de verificación pasan.
- Commit: `chore: scaffold next.js app with tailwind, shadcn/ui and vitest`.

## Notas de progreso

<!-- Fecha — nota -->
