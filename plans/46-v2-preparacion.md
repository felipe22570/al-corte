# Paso 46 — Preparación: datos compartidos y rutas neutrales

- **Hito PRD:** H13 (parte 1 de 11)
- **Estado:** ✅ Terminado y verificado (sin desplegar hasta cerrar el 45)
- **Inicio:** 2026-11-27
- **Fin:** 2026-11-27
- **Commit:** c802f2c
- **Depende de:** 45 cerrado (no desplegar antes)
- **Decisiones aplicables (decididas, ver README):** D58, D63

## Objetivo

Dejar la lógica de datos fuera de las páginas para que la interfaz nueva la reutilice sin duplicarla. Este paso no cambia nada visible.

## Contenido

- **Cargadores.** Hoy las páginas de `app/(app)` consultan Supabase y arman sus datos (la de extracto tiene 245 líneas; también movimiento, tarjeta, ajustes, mes, por confirmar, suscripciones, inicio, nuevo gasto y movimientos). Mover cada consulta y su transformación a un cargador en `lib/queries/` que devuelva un modelo de vista tipado. La página queda en: autenticar, llamar al cargador y renderizar.
- Reutilizar los módulos que ya existen en `lib/queries` (`months`, `payments`, `statement-balances`, `drafts`, entre otros) en lugar de crear paralelos.
- **Modelos pensados para v2.** Antes de fijar cada modelo, revisar el mockup de la pantalla en `docs/mockups/v2/` y agregar lo que la interfaz nueva necesita y la actual no muestra junta: por tarjeta, extracto abierto con sus cargos agrupados, cuotas en curso y suscripciones; en Inicio, próximo pago por tarjeta y lista "Para atender"; lista de tarjetas con sus cuatro cifras. Tener en cuenta las secciones "Diferencias con los mockups" y "Sin dibujar" de los pasos 48 a 53: por ejemplo, Inicio necesita `cop_used` y `usd_net` para "Cupo usado" (D66) y no la suma de la deuda por extracto.
- **Rutas.** `lib/routes.ts` con las rutas de la app y una base configurable (`""` o `"/v2"`). La interfaz actual puede seguir con sus rutas literales.
- **Revalidación.** `revalidateFinancialViews` (en `lib/revalidate-views.ts`) también revalida las rutas bajo `/v2`.
- **Acciones del servidor.** Ninguna asume a qué pantalla volver; si alguna redirige o construye una ruta, recibe el destino validado como ruta interna.
- `proxy.ts` ya protege todas las rutas; confirmar con una prueba que `/v2` exige sesión.

## Pruebas

- [x] Pruebas de cada cargador o de su función pura de transformación, con fixtures sin datos reales.
- [x] Las pruebas existentes de páginas y acciones siguen pasando sin cambios de comportamiento.
- [x] Sin consultas N+1 nuevas: mismas consultas o menos por pantalla.

## Verificación

```
pnpm typecheck && pnpm lint && pnpm test && pnpm test:coverage
pnpm build && pnpm start
```

- [x] `grep -rn "\.from(" app/` no devuelve resultados en páginas.
- [x] Comparación visual antes y después de cada ruta actual (capturas a 1440 y 360 px): sin diferencias.


## Criterios de terminado

- Verificaciones en verde y ninguna diferencia visible en la interfaz actual.
- Commit: `refactor: move page data loading to shared queries`.

## Notas de progreso

- 2026-11-27 — Plan aprobado con las tres recomendaciones: el proxy protege `/v2`, las lecturas exclusivas de v2 se construyen en este paso y un solo commit al final, sin push.
- 2026-11-27 — Contradicción corregida: `proxy.ts` no protegía las rutas, solo refrescaba la sesión; la protección de v1 está en `app/(app)/layout.tsx`. Ahora `lib/supabase/proxy.ts` (`requiresSession`) redirige a `/login` toda solicitud a `/v2` sin sesión (prueba en `lib/__tests__/session-proxy.test.ts`). El paso 56 debe revisarlo cuando la base pase a la raíz.
- 2026-11-27 — Cargadores en `lib/queries/`, uno por pantalla, en archivos nuevos (las pruebas de páginas simulan `months`, `drafts` y otros módulos completos): `month-list`, `month-page`, `card-detail`, `statement-detail`, `transaction-detail`, `transaction-form` (nuevo gasto, editar y TRM por D4), `history`, `subscription-list`, `settings` y `draft-inbox`. Todos reciben `(supabase, userId, …)` con las mismas cadenas de consulta que tenían las páginas, así que las pruebas existentes pasan sin cambios. `requireUser()` (`lib/supabase/require-user.ts`) reemplaza el bloque de sesión repetido en cada página. Los textos y enlaces de v1 siguen en sus páginas; los cargadores devuelven datos y claves (por ejemplo, los conceptos del extracto sin etiquetas).
- 2026-11-27 — Consultas: las mismas por pantalla, salvo Ajustes, que leía un conteo de compras a cuotas por cada tarjeta (N+1) y ahora hace una sola lectura para todas.
- 2026-11-27 — Lecturas para v2, que v1 no llama: `home` (próximo pago del mes más cercano con extractos cortados por pagar, "Cupo usado" con `cop_used` y `usd_net` de todas las tarjetas, D66, y "Para atender": vencidos, por vencer en 5 días o menos, borradores, extractos sin conciliar y cambios de precio de los borradores), `card-list` (próximo pago, cupo, deuda total del último corte y extracto abierto por tarjeta, cuotas en curso y suscripciones) y `card-overview` (extracto abierto agrupado en compras nuevas, cuotas, suscripciones cobradas y previstas, intereses y otros, cuya suma da el total; suscripciones con próximo cobro y costo al mes por moneda; columnas de extractos por mes de pago). `MonthCardDetails` gana `creditLimit` y `copUsed` en la misma consulta. El estado D65 queda para el paso 48.
- 2026-11-27 — Rutas: `lib/routes.ts` con `createRoutes(base)`, `v2Routes`, los patrones de revalidación de cada interfaz y `safeInternalPath`. Exportar datos y el inicio de sesión no cambian con la base. `revalidateFinancialViews` revalida ambas interfaces (en `/v2`, también el layout); `statements.ts` y `capture.ts` usan `revalidateStatementViews` y `revalidateCaptureViews`.
- 2026-11-27 — Acciones: la única que redirigía a una pantalla fija era el inicio de sesión. `signIn` y el enlace mágico aceptan un campo `next` opcional, validado con `safeInternalPath`, y sin él siguen yendo a `/movimientos`. El enlace mágico solo agrega `?next=` al callback cuando hay destino; si en el paso 53 se usa, revisar que la lista de URLs de redirección de Supabase Auth acepte esa consulta.
- 2026-11-27 — Comparación visual: en lugar de capturas, comparé el HTML visible (sin scripts, estilos ni metadatos) de 37 rutas actuales antes y después, con `pnpm build && pnpm start` sobre Supabase local y datos ficticios (dos tarjetas, una archivada, compras a cuotas, una en dólares, avance, devolución, pago, suscripciones y un borrador). Resultado: idéntico en las 37, incluidas las de no encontrado. Como no cambió ningún componente ni estilo, el HTML idéntico implica las mismas pantallas a 1440 y 360 px. `/v2` sin sesión responde 307 a `/login`.
- 2026-11-27 — Verificación: `pnpm typecheck`, `pnpm lint`, `pnpm test` (890 pruebas), `pnpm test:coverage` (dominio al 100 %), pruebas de integración locales con `AL_CORTE_LOCAL_DB_TEST=1` (83, incluida la nueva `page-loaders-local`), `pnpm build`, `supabase db reset` y `supabase test db` (486) en verde. Sin cambios en `components/`, `app/(auth)`, `app/globals.css` ni `DESIGN.md`.
- 2026-11-27 — Pregunta abierta para el paso 49: `tarjeta.html` muestra un avance entre las "Cuotas en curso", pero v1 solo lista compras (`type = purchase`). Los cargadores conservan la regla de v1 hasta que el dueño decida.
