# Paso 40 — Capa de IA

- **Hito PRD:** H12 (parte 1 de 6)
- **Estado:** ✅ Terminado
- **Inicio:** 2026-11-22
- **Fin:** 2026-11-22
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

- [x] Salida que no cumple el esquema → `{ ok: false, reason: "invalid_output" }`.
- [x] Tope superado → no hay llamada a la API.
- [x] Error o timeout de la API → `{ ok: false }` sin romper al llamador.
- [x] Ningún import de `lib/ai/` desde código de cliente (prueba de lint o de build).

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

2026-11-22 — Plan aprobado con cambios: Opus 5.5 como modelo por defecto y tope de US$5 (ver registro de decisiones). Se verificó en la documentación que `output_config.format` (`type: "json_schema"`) es estable y que Opus, Sonnet y Haiku 5.5 lo soportan; precios por millón de tokens anotados en `lib/ai/pricing.ts`.

2026-11-22 — Implementado:
- `lib/ai/` con `import "server-only"` en cada módulo: `types.ts`, `config.ts` (`ANTHROPIC_API_KEY`, `AI_MONTHLY_BUDGET_USD`, `AI_MODEL_DEFAULT` y `AI_MODEL_<TAREA>`), `pricing.ts` (costo con `Decimal`, redondeo hacia arriba a 6 decimales), `budget.ts` (mes calendario de Bogotá), `schema.ts` (`z.toJSONSchema` + `transformJSONSchema` del SDK, que pasa a la descripción las restricciones que la API no acepta; Zod las vuelve a exigir), `run-task.ts`, `usage.ts` y `context.ts` (timeout de 30 s por intento y 2 reintentos del SDK).
- `runTask` nunca lanza. Razones: `invalid_input`, `not_configured` (sin llave: el llamador sigue sin IA, R10), `unknown_model`, `usage_unavailable` (no se pudo leer el gasto: no llama, falla cerrado), `budget_exceeded`, `timeout`, `api_error` e `invalid_output` (incluye rechazo del modelo, corte por `max_tokens`, texto que no es JSON y restricciones de Zod). Sin `tools`; el contenido externo va entre `<data>` y `</data>` y no puede cerrar ni abrir el bloque.
- Migración `20261122040000_ai_usage.sql`: RLS con lectura e inserción del dueño, sin edición ni borrado (registro inmutable); `ai_usage_spent_since(user, since)` devuelve texto para no perder decimales. Se registran `ok`, `invalid_output`, `api_error`, `timeout` y `budget_exceeded`; no se registran las salidas tempranas sin llamada. Si el registro falla después de una llamada, se conserva el resultado. Tipos regenerados y tabla agregada a la exportación.
- Evals: `pnpm test:ai` (`vitest.ai.config.mts`, archivos `*.eval.ts`, fuera de `pnpm test`) con `runEval`, aciertos por campo y reporte sin respuestas del modelo. Tarea de prueba `smokeCheck` con cuatro frases ficticias, dos de ellas intentos de inyección. Solo pasan a los evals `ANTHROPIC_API_KEY` y las variables `AI_*` de `.env.local`.
- Pruebas: 40 de Vitest en `lib/ai/__tests__/` (cliente simulado), integración con Supabase local (`AL_CORTE_LOCAL_DB_TEST=1`) y pgTAP `210-ai-usage.test.sql`. El import desde cliente lo cubren una prueba que revisa los archivos `"use client"` y el build: con una página de cliente temporal que importaba `lib/ai`, `pnpm build` falló por `server-only` (página borrada después).
- Verificación: `pnpm typecheck`, `pnpm lint`, `pnpm test` (633 pasan, 10 omitidas que requieren variables), `pnpm test:coverage`, `supabase db reset`, `supabase test db` y `pnpm build` pasan.
- Sin `ANTHROPIC_API_KEY`, `pnpm test:ai` falla con un mensaje claro y no llama a nada.

2026-11-22 — `pnpm test:ai` contra la API real, con la llave del dueño en `.env.local`: `smokeCheck` (v1, `claude-opus-5-5`), 4 casos. `merchant` 4/4 (100 %), `amount` 4/4 (100 %), `currency` 4/4 (100 %), sin fallas de llamada. Los dos intentos de inyección (instrucción dentro de la frase y cierre falso de `</data>`) no cambiaron la respuesta. Costo estimado: US$0,013168. Paso cerrado. Quedan a cargo del dueño la migración remota y las variables en Vercel (`ANTHROPIC_API_KEY`; `AI_MONTHLY_BUDGET_USD` y `AI_MODEL_DEFAULT` son opcionales).
