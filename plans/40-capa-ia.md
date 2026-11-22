# Paso 40 — Capa de IA

- **Hito PRD:** H12 (parte 1 de 6)
- **Estado:** ⬜ Pendiente
- **Inicio:**
- **Fin:**
- **Commit:**
- **Depende de:** H10 y H11 cerrados (PRD, sección 4: H12 va después de las cuatro prioridades de v2). Excepción del 22 de noviembre de 2026: empieza con H11 abierto, solo por verificaciones de los pasos 38 y 39 con datos reales (ver registro de decisiones).
- **Decisiones aplicables (decididas, ver README):** D42, D51

## Objetivo

Una base común, pequeña y segura para cualquier función de IA de la app (F19). Este paso no entrega ninguna función visible.

## Contenido

- `lib/ai/` solo de servidor (`import "server-only"`), con el SDK oficial de Anthropic.
- Dependencias nuevas, justificadas en el plan del paso como pide `AGENTS.md`: `@anthropic-ai/sdk` (cliente oficial, tipos y reintentos) y `server-only` (falla el build si se importa desde el cliente). El JSON Schema sale de `z.toJSONSchema` de Zod 4, sin otra dependencia.
- Interfaz de tarea: nombre, versión del prompt, modelo, `max_tokens`, esquema Zod de entrada y de salida. Una función `runTask(task, input)` que:
    - valida la entrada;
    - llama al modelo con salidas estructuradas (`output_config.format` con el JSON Schema derivado del esquema Zod);
    - valida la salida otra vez con Zod;
    - devuelve `{ ok, data }` o `{ ok: false, reason }` sin lanzar errores hacia arriba.
- Sin herramientas (`tools`) en ninguna tarea. Contenido externo dentro de delimitadores y descrito en el prompt como datos.
- Configuración por variables de entorno del servidor: `ANTHROPIC_API_KEY`, modelo por tarea y tope mensual en USD (la moneda en que cobra la API). Verificar en la documentación el nombre actual del parámetro de salidas estructuradas y que el modelo elegido las soporte.
- Tope de gasto: tabla `ai_usage` con `user_id`, RLS y políticas `user_id = auth.uid()` (tarea, modelo, tokens de entrada y salida, costo estimado, latencia, resultado de validación, fecha). La ruta de ingesta escribe con la llave de servicio y el usuario de `INGEST_USER_ID` (D51). Al superar el tope, `runTask` responde `budget_exceeded` sin llamar a la API.
- Registro sin contenido: nunca se guardan prompts, entradas ni salidas.
- Evals: carpeta `lib/ai/evals/` con fixtures y un script nuevo `pnpm test:ai` en `package.json` (excluido de `pnpm test`) que corre las tareas reales contra resultados esperados y reporta aciertos por campo. Las pruebas unitarias normales usan un cliente simulado.

## Pruebas

- [ ] Salida que no cumple el esquema → `{ ok: false, reason: "invalid_output" }`.
- [ ] Tope superado → no hay llamada a la API.
- [ ] Error o timeout de la API → `{ ok: false }` sin romper al llamador.
- [ ] Ningún import de `lib/ai/` desde código de cliente (prueba de lint o de build).

## Verificación

```
pnpm typecheck && pnpm lint && pnpm test && pnpm test:coverage
supabase db reset && supabase test db
pnpm build
```

## Criterios de terminado

- Commit: `feat: add server-only AI task layer`.

## Notas de progreso

<!-- Fecha — nota -->
