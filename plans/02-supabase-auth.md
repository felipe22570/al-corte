# Paso 02 — Supabase local y autenticación

- **Hito PRD:** H0 (parte 2 de 3)
- **Estado:** ⬜ Pendiente
- **Inicio:** —
- **Fin:** —
- **Commit:** —
- **Depende de:** 01

## Objetivo

Supabase corriendo en local con el CLI, clientes de Supabase para servidor y navegador, login con email y contraseña (y magic link opcional), rutas protegidas y registro público desactivado.

## Alcance

**Incluye:** `supabase init`, configuración de Auth, clientes `@supabase/ssr`, middleware/proxy de sesión, pantalla de login, cerrar sesión, grupo de rutas `(app)` protegido.

**No incluye:** tablas de negocio (paso 07), despliegue (paso 03), layout final (paso 10).

## Tareas

- [ ] `supabase init` → crea `supabase/config.toml`. Hacer commit de `config.toml`.
- [ ] En `supabase/config.toml`:
  - `[auth] enable_signup = false`
  - `site_url = "http://localhost:3000"` y `additional_redirect_urls` con `http://localhost:3000/auth/callback`
  - Si se usa magic link: plantilla de email por defecto; en local los correos llegan a Inbucket/Mailpit.
- [ ] Instalar `@supabase/supabase-js` y `@supabase/ssr`.
- [ ] `lib/supabase/server.ts`: `createClient()` para Server Components, Server Actions y Route Handlers (cookies de `next/headers`).
- [ ] `lib/supabase/client.ts`: `createClient()` para el navegador (solo URL y anon/publishable key).
- [ ] `lib/supabase/middleware.ts` + `middleware.ts` (o `proxy.ts`, según la versión de Next.js): refresca la sesión y redirige a `/login` si no hay usuario en rutas de `(app)`; redirige a `/` si hay sesión y se visita `/login`.
- [ ] `app/(auth)/login/page.tsx`: formulario de email + contraseña; mensajes de error en español. Usa una Server Action en `lib/actions/auth.ts` (`signIn`, `signOut`).
- [ ] Opcional (PRD lo permite): botón "Enviarme un enlace" (magic link) + `app/auth/callback/route.ts` para intercambiar el código por sesión.
- [ ] `app/(app)/layout.tsx` que verifica sesión con `supabase.auth.getUser()` (no `getSession()`) y `app/(app)/page.tsx` temporal que muestra el email del usuario y un botón "Cerrar sesión". Mover la página inicial del paso 01 a este grupo.
- [ ] `.env.example` con `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` (o `..._PUBLISHABLE_KEY`) sin valores. **No** incluir `SUPABASE_SERVICE_ROLE_KEY` con prefijo `NEXT_PUBLIC_`.
- [ ] `.env.local` con los valores de `supabase status` (no se hace commit).
- [ ] Documentar en `README.md` (raíz) cómo crear el usuario dueño en local: Supabase Studio (`http://localhost:54323`) → Authentication → Add user, con "Auto confirm".
- [ ] `supabase/tests/` creado (vacío o con una prueba pgTAP trivial) para tener `supabase test db` listo desde ahora.

## Archivos

- `supabase/config.toml`, `supabase/tests/000-smoke.test.sql`
- `lib/supabase/server.ts`, `lib/supabase/client.ts`, `lib/supabase/middleware.ts`
- `middleware.ts` (o `proxy.ts`)
- `lib/actions/auth.ts`
- `app/(auth)/login/page.tsx`, `app/(app)/layout.tsx`, `app/(app)/page.tsx`
- `app/auth/callback/route.ts` (si hay magic link)
- `.env.example`, `README.md`

## Riesgos

- Docker debe estar corriendo en WSL para `supabase start`.
- Usar `getUser()` en el servidor: `getSession()` no valida el JWT.
- El nombre de la variable de la clave pública cambió en versiones recientes de Supabase (anon → publishable). Usar la que muestre `supabase status`.

## Verificación

```
supabase start                 # levanta sin errores
supabase db reset              # sin errores (aún sin migraciones)
supabase test db               # pasa la prueba trivial
pnpm typecheck && pnpm lint && pnpm test
pnpm build
```

Comprobar que el registro público está desactivado (usar la URL y la clave de `supabase status`):

```
curl -s -X POST "$SUPABASE_URL/auth/v1/signup" \
  -H "apikey: $ANON_KEY" -H "Content-Type: application/json" \
  -d '{"email":"intruso@example.com","password":"Password123!"}'
# Esperado: error "Signups not allowed for this instance" (o equivalente)
```

Comprobaciones manuales:

- [ ] Sin sesión, abrir `http://localhost:3000/` redirige a `/login`.
- [ ] Login con credenciales incorrectas muestra un error en español.
- [ ] Login con el usuario creado en Studio lleva a `/` y muestra su email.
- [ ] "Cerrar sesión" vuelve a `/login`, y `/` vuelve a redirigir.
- [ ] Con sesión, visitar `/login` redirige a `/`.
- [ ] `grep -rn "SERVICE_ROLE" app components lib` no devuelve nada.
- [ ] `git status` no incluye `.env.local`.

## Criterios de terminado

- Verificaciones en verde.
- Commit: `feat: add supabase auth with protected routes and disabled signup`.

## Notas de progreso

<!-- Fecha — nota -->
