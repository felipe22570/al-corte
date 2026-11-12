# Al Corte

Aplicación personal para controlar tarjetas de crédito en Colombia.

**Tus tarjetas, claras antes de cada corte.**

## Requisitos

- Node.js 24.13 o posterior y pnpm 10.
- Docker y la CLI de Supabase del proyecto para la base local.

## Desarrollo local

1. Copia `.env.example` a `.env.local` y completa la URL y la clave publicable de Supabase.
2. Configura en Supabase Auth la URL del sitio (`http://localhost:3000`) y la URL de redirección `http://localhost:3000/auth/callback`.
3. Crea únicamente la cuenta dueña desde el panel de Supabase o con la CLI. El registro público está deshabilitado en `supabase/config.toml` para el entorno local.
4. Instala dependencias con `pnpm install`, inicia Supabase con `pnpm exec supabase start` y ejecuta `pnpm dev`.

## Verificación

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:coverage
pnpm exec supabase test db
pnpm build
```

`pnpm exec supabase db reset` elimina los datos de la base local y vuelve a aplicar las migraciones; úsalo solo después de respaldar lo que quieras conservar.

## Supabase y Vercel

Para enlazar un proyecto remoto, instala la CLI de Supabase, inicia sesión y ejecuta `supabase link --project-ref <project-ref>`. Configura las dos variables de `.env.example` en Vercel antes de desplegar. No se debe configurar ni exponer una clave `service_role` en el navegador.

Producción: https://al-corte-three.vercel.app/. Un push a `main` dispara el despliegue en Vercel. Las migraciones se aplican por separado con `pnpm exec supabase db push --remote` y se comprueban con `pnpm exec supabase migration list --remote`.

El registro público también debe estar desactivado en **Supabase remoto**; la opción local de `config.toml` no basta. Se verificó y corrigió el 11 de noviembre de 2026: `/auth/v1/signup` responde `signup_disabled` (HTTP 422). No ejecutes `supabase config push` contra producción con las URLs de desarrollo: primero revisa `supabase config diff` y limita el cambio a las propiedades deseadas.

El estado de la validación final, las evidencias y los pendientes de cierre están en [el paso 20](plans/20-validacion-mvp.md).

## Respaldo

En Ajustes → Tus datos puedes descargar un JSON con las tablas de tu cuenta y las TRM compartidas, o CSV individuales. El JSON conserva los montos decimales como texto y es la opción recomendada para respaldar datos. Las tablas se consultan por separado: evita modificar datos mientras se genera el respaldo. Los CSV incluyen BOM UTF-8 y mantienen el texto original: antes de abrirlos en una hoja de cálculo, revisa los campos que puedan interpretarse como fórmulas. La exportación requiere una sesión activa y respeta las políticas RLS.
