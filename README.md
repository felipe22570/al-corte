# Al Corte

Aplicación personal para controlar tarjetas de crédito en Colombia.

## Desarrollo local

1. Copia `.env.example` a `.env.local` y completa la URL y la clave publicable de Supabase.
2. Configura en Supabase Auth la URL del sitio (`http://localhost:3000`) y la URL de redirección `http://localhost:3000/auth/callback`.
3. Crea únicamente la cuenta dueña desde el panel de Supabase o con la CLI. El registro público está deshabilitado en `supabase/config.toml` para el entorno local.
4. Instala dependencias con `pnpm install` y ejecuta `pnpm dev`.

## Verificación

```bash
pnpm lint
pnpm typecheck
pnpm test
```

## Supabase y Vercel

Para enlazar un proyecto remoto, instala la CLI de Supabase, inicia sesión y ejecuta `supabase link --project-ref <project-ref>`. Configura las dos variables de `.env.example` en Vercel antes de desplegar. No se debe configurar ni exponer una clave `service_role` en el navegador.
