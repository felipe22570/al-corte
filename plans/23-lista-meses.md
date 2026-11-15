# Paso 23 — Inicio: lista de meses

- **Hito PRD:** H9 (parte 3 de 6)
- **Estado:** ✅ Terminado y verificado
- **Inicio:** 2026-11-14
- **Fin:** 2026-11-14
- **Commit:** Ver historial de git
- **Depende de:** 21, 22
- **Decisiones aplicables (decididas, ver README):** D2, D18–D29

## Objetivo

Reemplazar el contenido de `/` por la lista de meses (F6) siguiendo el brief del paso 22 y usando solo las funciones del paso 21.

## Contenido

- Alerta de vencidos (D23, D26): importe calculado de extractos sin confirmar, sin descontar abonos, y enlaces a todos los meses afectados.
- Franja compacta de tarjetas activas con cupo disponible y utilización (`UtilizationBar`), enlazando a `/tarjetas/[id]`. Sobrecupo con tono danger.
- Deuda total registrada como dato secundario, calculada con `card_balances.used` (D2), incluidas tarjetas archivadas con saldo; sin proyecciones ni límite de 12 meses.
- Mes actual siempre presente y destacado; próximos y anteriores (D22). Historial en bloques de 12 meses con extractos, no de 12 filas de extracto. Manejo por sí solo puede generar 12 meses futuros (D21); aviso de cuotas/extractos reales posteriores.
- Filas con total calculado o "Total conocido", "Pendiente de confirmar pago" y su ayuda, previstos separados y estado según R7. No confundir confirmación de extractos con saldo tras abonos.
- Barra apilada solo si total positivo y subtotales por tarjeta no negativos; si no, desglose textual firmado con "Saldo a favor" cuando corresponda. La barra comunica composición, no evolución cuantitativa entre meses.
- Cada fila enlaza a `/meses/AAAA-MM` con área táctil completa y foco visible.
- Acción "Nuevo gasto" según el patrón actual del shell (encabezado en escritorio, botón flotante en móvil).
- Navegación: el destino "Tablero" pasa a llamarse "Meses" en barra lateral y navegación inferior (D25).

## Tareas

- [x] Consulta en el servidor sin N+1 por tarjeta ni por mes, con la paginación existente para no truncar totales.
- [x] Consultas compartidas para lista y detalle (por ejemplo `lib/queries/months.ts`), separadas del dominio puro: incluir reales, movimientos con identidad de suscripción, cuotas con categoría original, suscripciones y fuente TRM D4. Paginar meses sin cortar sus cargos y no cargar todo el historial de movimientos en cada visita.
- [x] Página de inicio y componentes nuevos, reutilizando `Money`, `StatusBadge`, `CardColorChip` y `UtilizationBar`.
- [x] Estados vacíos: sin ninguna tarjeta (acción a `/ajustes`), tarjetas sin extractos ni previstos y ninguna activa pero con historial/compromisos reales. No ocultar información de archivadas ni marcar Pagado un actual vacío.
- [x] Aviso de TRM faltante con cobros afectados; no presentar total conocido incompleto como definitivo.
- [x] Skeleton de carga acorde a la nueva estructura.
- [x] No borrar todavía los componentes del tablero; se retiran en el paso 25.
- [x] Mantener los pasos 23–24 en una rama de trabajo sin desplegar enlaces rotos: publicar el reemplazo del inicio solo cuando su detalle esté disponible.

## Pruebas

- [x] Vitest de proporciones seguras y redondeo (100 % cuando aplica), cero, negativos y fallback textual. Importes y proporciones con Decimal hasta su conversión final para presentación.
- [x] Pruebas de renderizado y consultas: actual vacío, todas las tarjetas archivadas, estado incompleto por TRM, múltiples meses vencidos y paginación histórica sin perder totales.

## Verificación

```
pnpm typecheck && pnpm lint && pnpm test && pnpm test:coverage
pnpm build && pnpm start
```

- [x] Con fixtures QA: el total actual coincide con extractos reales más previstos; la parte real coincide con los extractos, sin exigir que una vista sin proyección incluya cargos virtuales.
- [x] Marcar pagado cambia estado y pendiente de confirmar, pero no el total, la deuda registrada ni el cupo por sí solo.
- [x] Una compra nueva a 6 cuotas aparece en los 6 meses correctos.
- [x] Un extracto vencido aparece en la alerta y en su mes, no en el total del mes actual.
- [x] El historial y la deuda registrada siguen visibles al archivar todas las tarjetas; solo manejo genera el horizonte aprobado.
- [x] 360 px y modo oscuro; escritorio ancho sin columnas vacías.

## Criterios de terminado

- Verificaciones en verde y Definición de terminado global.
- Commit: `feat: replace dashboard with payment-month list`.

## Notas de progreso

- 2026-11-14 — Inicio en rama `feat/h9-month-views`, sin despliegue. Se agregaron al dominio la selección de meses históricos distintos y el cálculo de proporciones seguras con redondeo que suma 100 %. Pasan `pnpm typecheck`, `pnpm lint` y 313 pruebas con cobertura del dominio del 100 %. La capa de lecturas, la interfaz y su verificación siguen pendientes.
- 2026-11-14 — Se inició `lib/queries/months.ts` con una fuente de datos inyectable: selecciona meses completos, conserva vencidos fuera de la página, limita las lecturas de cargos al horizonte y deduplica movimientos de suscripción incluso si su extracto no se cargó. Pendientes el adaptador Supabase, saldos y datos de identidad, la interfaz y pruebas de integración. Pasan `typecheck`, `lint` y 316 pruebas con cobertura del dominio del 100 %.
- 2026-11-14 — Se añadió el adaptador `lib/queries/supabase-months.ts` con consultas paginadas, lotes de identificadores, categorías originales de cuotas, saldos de tarjetas archivadas y resolución de TRM D4. Pruebas aisladas cubren paginación, precisión decimal y TRM de respaldo; faltan integración con datos reales y la interfaz. Pasan `typecheck`, `lint` y 319 pruebas con cobertura del dominio del 100 %.
- 2026-11-14 — Se crearon componentes aislados para la fila mensual y la franja de tarjetas, con pruebas de USD sin TRM, subtotales negativos y deuda de archivadas. Aún no están conectados a la página; faltan alertas, navegación, integración y verificación visual.
- 2026-11-14 — Inicio conectado a la capa de lectura; añadidas alertas, carga acumulativa de historial y navegación «Meses». `pnpm build` y 325 pruebas pasan, con cobertura del dominio del 100 %. Inspección preliminar con markup sintético y CSS compilado a 360 px oscuro y 1440 px claro; no sustituye comprobar la aplicación hidratada, todos los estados ni la integración con datos locales. Sin despliegue: las rutas de detalle aún corresponden al paso 24.
- 2026-11-14 — Integración optativa contra Supabase local: usuario y registros sintéticos únicos, consultas autenticadas con RLS y limpieza limitada al usuario creado por la prueba. Se comprobó la lectura de cuotas y su categoría original, suscripción prevista, pendiente de confirmar y tarjeta archivada. No se usaron datos de producción. La revisión de la aplicación hidratada y los demás casos de aceptación sigue pendiente.
- 2026-11-14 — Chromium sobre build local hidratado y datos sintéticos: 360 px oscuro y 1440 px claro sin desbordamiento horizontal; foco del enlace de salto visible y enlace a tarjeta activo. Se contrastaron total, pendiente, previsto, deuda con archivada y 12 meses futuros. La cuenta sintética se eliminó. También se añadieron pruebas de seis cuotas y transición de previsto a real. Faltan los demás estados y la validación completa del paso.
- 2026-11-14 — Skeleton propio del inicio en un grupo de ruta, sin modificar la carga de otras pantallas. La prueba de consultas cubre meses históricos con varios extractos y varios vencidos fuera de página. En Supabase local, actualizar `paid_at` con RLS conserva total y saldos y reduce el pendiente; aún falta comprobar el flujo del botón en la aplicación. Pasan build, typecheck, lint, 329 pruebas y cobertura de dominio del 100 %; la integración local se ejecutó por separado. No se ejecutó `supabase db reset`, pues borraría datos locales.
- 2026-11-14 — Comprobación hidratada con cuenta sintética: el botón de pago cambió el extracto a Pagado; al volver a Meses, el pendiente bajó de $130.000 a $30.000, mientras el total ($150.000), la deuda registrada ($130.000) y el cupo ($900.000) permanecieron iguales. El mes siguió vencido por otro extracto sin confirmar. La integración consulta de nuevo los saldos después de actualizar `paid_at`, sin reutilizar la lectura memorizada. Pasan 330 pruebas y cobertura de dominio del 100 %; la cuenta sintética se eliminó.
- 2026-11-14 — Con autorización del dueño se reinició únicamente Supabase local: migraciones y seed aplicados; pasan 167 pruebas SQL y la integración local tras el reinicio. Una compra sintética creada mediante la RPC a seis cuotas aparece en los seis meses correctos de la lectura. El paso queda en la rama de trabajo, sin despliegue hasta completar el detalle del paso 24.
