# Paso 03 — Proyecto Supabase remoto y despliegue en Vercel

- **Hito PRD:** H0 (parte 3 de 3) — **H0 termina aquí**
- **Estado:** ⬜ Pendiente
- **Inicio:** —
- **Fin:** —
- **Commit:** —
- **Depende de:** 02

## Objetivo

La app desplegada en Vercel, conectada a un proyecto de Supabase en la nube, con login funcionando en producción. Es el criterio de terminado de H0 en el PRD.

## Alcance

Este paso tiene varias acciones **manuales del dueño** (crear cuentas, proyectos y variables de entorno). El agente prepara la configuración y la guía; no crea recursos en servicios externos sin confirmación explícita.

**Incluye:** proyecto Supabase remoto, `supabase link`, repo remoto en GitHub, proyecto en Vercel, variables de entorno, URLs de redirección de Auth, usuario dueño en producción.

**No incluye:** dominio propio, migraciones de negocio (se aplican al remoto al cerrar cada hito de base de datos).

## Tareas

- [ ] (Dueño) Crear el proyecto en Supabase con el nombre `al-corte`. Región recomendada: la más cercana a Colombia disponible (p. ej. `us-east-1`).
- [ ] (Dueño) En el dashboard de Supabase → Authentication → Providers/Settings: **desactivar "Allow new users to sign up"**.
- [ ] (Dueño) Crear el usuario dueño en Authentication → Users → Add user (auto confirm).
- [ ] `supabase login` y `supabase link --project-ref <ref>`.
- [ ] `supabase db push` (aún sin migraciones de negocio; confirma que el enlace funciona).
- [ ] (Dueño) Crear el repo remoto `al-corte` en GitHub y hacer push de `main`.
- [ ] (Dueño) Importar el repo en Vercel (plan Hobby) como proyecto `al-corte` (URL esperada `al-corte.vercel.app` o la que asigne Vercel si está ocupada; anotarla en "Notas de progreso"). Variables de entorno en Production y Preview:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (o `..._PUBLISHABLE_KEY`)
  - Ninguna `service_role` en el MVP.
- [ ] (Dueño) En Supabase → Authentication → URL Configuration: `Site URL` = URL de producción de Vercel; agregar `https://<app>.vercel.app/auth/callback` y el patrón de previews si se usa magic link.
- [ ] Documentar en `README.md` el flujo de despliegue: push a `main` → Vercel; `supabase db push` para migraciones remotas.
- [ ] (Dueño) En Supabase → Authentication → Emails: asunto y remitente de los correos de magic link con el nombre "Al Corte".
- [ ] Opcional: conectar el servidor MCP de Supabase al agente (solo contra el proyecto local o de desarrollo).

## Archivos

- `README.md` (sección de despliegue)

## Riesgos

- Exponer la `service_role` en Vercel con prefijo `NEXT_PUBLIC_`: revisar las variables antes de desplegar.
- Olvidar desactivar el registro en el proyecto remoto (`config.toml` solo aplica al local).

## Verificación

```
supabase projects list            # el proyecto aparece y está enlazado (●)
supabase migration list           # local y remoto coinciden
```

Comprobar el registro desactivado en producción:

```
curl -s -X POST "https://<ref>.supabase.co/auth/v1/signup" \
  -H "apikey: <anon_key>" -H "Content-Type: application/json" \
  -d '{"email":"intruso@example.com","password":"Password123!"}'
# Esperado: error de registro no permitido
```

Comprobaciones manuales en la URL de producción:

- [ ] Sin sesión, `/` redirige a `/login`.
- [ ] El login con el usuario dueño funciona y muestra su email.
- [ ] Cerrar sesión funciona.
- [ ] El build de Vercel no muestra warnings de variables faltantes.
- [ ] En Vercel → Settings → Environment Variables no hay ninguna variable `NEXT_PUBLIC_*SERVICE*`.

## Criterios de terminado

- Login funcionando en producción (criterio de H0 del PRD).
- Commit: `docs: add deployment instructions`.
- Etiqueta opcional: `git tag h0`.

## Notas de progreso

<!-- Fecha — nota. Anotar aquí la URL de producción y el project ref (no las claves). -->
