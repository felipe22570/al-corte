# Paso 26 — Pulido y validación de H9

- **Hito PRD:** H9 (parte 6 de 6)
- **Estado:** ✅ Terminado
- **Inicio:** 2026-11-15
- **Fin:** 2026-11-21
- **Commit:** 3a2728b
- **Depende de:** 25
- **Decisiones aplicables (decididas, ver README):** D17–D29

## Objetivo

Pulir las vistas nuevas con Impeccable y validar H9 completo con fixtures locales/sintéticos y lecturas autorizadas de datos existentes. No crear ni modificar datos de prueba en producción.

## Tareas

- [x] `/impeccable critique` de `/` y `/meses/[mes]` contra sus briefs; corregir lo acordado con el dueño.
- [x] `/impeccable polish` y `/impeccable audit` de las dos vistas (accesibilidad, contraste, responsive).
- [x] `/impeccable document` para actualizar `DESIGN.md` con los componentes nuevos (fila de mes, franja, alerta, acción compacta de pago). Conservar las reglas y evidencias previas de accesibilidad/responsive; distinguir lo planeado de lo implementado y verificado.
- [x] Actualizar `PRODUCT.md` si algo del producto cambió durante la implementación.

## Verificación

```
pnpm typecheck && pnpm lint && pnpm test && pnpm test:coverage
supabase db reset && supabase test db
pnpm build && pnpm start
```

- [x] Con las tarjetas QA, contrastar a mano tres meses: uno anterior, el actual y uno futuro.
- [x] En los tres, suma de conceptos = categorías = tarjetas = total conocido; parte real coincidente con extractos y previstos identificados aparte. Incluir ajustes, cuotas con interés, devoluciones y "Sin categoría".
- [x] Mes actual con cobro previsto antes del corte que se paga este mes, conversión a real por cron sin duplicación y USD sin TRM con aviso de total incompleto.
- [x] Confirmación independiente de abonos: ayuda visible, importe correcto, marcar/desmarcar no libera cupo ni registra pagos y `real_total` no sustituye al calculado.
- [x] Manejo sin compras ni suscripciones genera horizonte de 12 meses; cuotas/extractos reales posteriores muestran aviso. Actual vacío y todas las tarjetas archivadas conservan navegación e historial.
- [x] Barra apilada con importes positivos; fallback textual para cero/negativos; categorías con devoluciones negativas y leyendas accesibles. Ninguna comparación de ahorro entre mes abierto/estimado/incompleto y cerrado.
- [x] Matriz del paso 25 completa: creación, edición, borrado, suscripciones, tarjetas, categorías, cron/TRM y cambio de día no dejan datos obsoletos al navegar.
- [x] Enlaces históricos directos funcionan sin cargar antes la página correspondiente del inicio; huecos y límites sin enlaces rotos.
- [x] Rendimiento de `/` en 4G emulado dentro del objetivo del PRD (1,5 s).
- [x] 360 px y escritorio, claro y oscuro, revisados en producción.
- [x] Teclado, nombres accesibles contextualizados, IDs únicos, una sola acción primaria, foco tras pago y reflujo de etiquetas/importes largos; no confundir pruebas automatizadas con verificación manual en lector de pantalla.
- [x] Revisión del dueño en el celular (el dueño cerró el paso el 2026-11-21).

## Criterios de terminado

- Verificaciones en verde y Definición de terminado global.
- No cerrar H9 por esta revisión documental: cada paso 21–26 sigue pendiente hasta su propia implementación, aprobación y evidencia.
- H9 marcado como cerrado en `plans/README.md`.
- Commit: `chore: close H9 month view`.

## Notas de progreso

<!-- Fecha — nota -->

- 2026-11-15 — Pulido y validación local en `feat/h9-month-views`, sin commit ni despliegue. Todo con build de producción local, Supabase local y cuentas sintéticas borradas al terminar; no se leyeron ni escribieron datos de producción, así que «tarjetas QA» se sustituyó por fixtures sintéticos.
  - Crítica dual (revisión de diseño A por vista + detector/navegador B): inicio 27/40 y detalle 26/40; detector sin hallazgos en código (`overused-font` y `cream-palette` son falsos positivos por DESIGN.md). Instantáneas en `.impeccable/critique/`. Auditoría 13/20. El dueño aprobó corregir todos los P1 y P2.
  - Decisiones del dueño: marcar pagado sigue disponible en extractos abiertos o futuros, con aviso «Aún puede recibir cargos hasta…», la nota «Solo marca el extracto. No registra un abono ni libera cupo» y sin fechas posteriores a hoy en Bogotá (cliente y `markStatementPaid`; regla nueva no escrita en el PRD); gráfico por categoría con D17 asignado por posición y orden por importe absoluto; el inicio oculta «Pendiente de confirmar pago: $0» en meses Pagado.
  - Cambios: `confirmedPaymentTotal` y `monthOpenGrowth` en el dominio con pruebas; `lib/month-status.ts` compartido; fila de mes con fecha de pago, «Vence en N días», facturado/puede crecer, filas compactas, barra solo con 2+ tarjetas y `aria-hidden`, «Total estimado» y dos columnas en `lg`/`xl`; franja en rejilla `auto-fit`; `MonthSummary` y `MonthStatementCard` nuevos; acción de pago compacta con foco restaurado y mensaje con el extracto; totales visibles en conceptos y categorías; avisos estáticos con `role="note"`; `aria-valuetext` en utilización; SVG de Recharts no enfocable; navegación de meses en una fila. Se retiraron `dueTone`, `trialTone`, `formatDueIn` y `DateLabel`, sin uso desde el paso 25.
  - `DESIGN.md` combinado (no sobrescrito): componentes H9 implementados, evidencia del paso 26 separada de lo pendiente; `.impeccable/design.json` regenerado (alturas corregidas tras D-01, destino Meses, fila de mes y acción de pago). `PRODUCT.md` marca H9 implementado y la regla de fecha de pago.
  - Verificado en Chromium: conciliación de octubre ($540.000), noviembre ($852.000) y diciembre ($311.960) entre conceptos, tarjetas y categorías, con ajuste, cuota con interés, devolución, abono aparte y «Sin categoría»; 360 px oscuro y 1440 px claro sin desbordamiento; flujo de pago por teclado (foco al abrir, cancelar, fecha futura rechazada, confirmar y deshacer actualizan el resumen sin tocar abonos). Segundo fixture: horizonte de 12 meses con solo cuota de manejo, aviso de compromisos posteriores, cron simulado dos veces = un cobro y diciembre sin doble conteo ($45.000 antes y después), enlace directo a un mes 13.º del historial con «Cargar más meses» sin cargar, huecos y último mes sin enlaces rotos, 404 en meses inválidos o fuera del horizonte, y todas las tarjetas archivadas conservan historial, deuda y navegación.
  - Cubierto solo por pruebas automatizadas: USD sin TRM en pantalla (la TRM local es global y no se borró), fallback textual con totales cero/negativos, y edición/archivo de categorías de la matriz del paso 25 (el resto de la matriz se verificó hidratado en los pasos 24–25; tras este paso se volvió a probar el flujo de pago).
  - Rendimiento local de `/` a 360 px: LCP 0,22 s (Fast 4G) y 0,64–0,98 s (Slow 4G); Supabase en la misma máquina, no representa producción.
  - Pasan `supabase db reset` (autorizado), 167 pruebas SQL, integración local, typecheck, lint, 349 pruebas, cobertura de dominio 100 %, build y detector. Sin cambios de esquema.
  - Pendiente para cerrar: revisión en producción a 360 px y escritorio con ambos temas, rendimiento de `/` en producción con 4G, revisión del dueño en el celular y prueba con lector de pantalla real. Requieren merge/despliegue autorizado. Contexto desactualizado sin corregir: el brief `.impeccable/surfaces/app-app-page-tsx.md` apunta a `app/(app)/page.tsx`.
- 2026-11-15 — Revisión en producción tras fusionar el PR #1 en `main` con avance rápido (`3a2728b`), con autorización del dueño. Chrome DevTools en un contexto aislado con la cuenta de validación (datos QA, sin tocar la sesión del dueño); credenciales solo escritas en el formulario, nunca en archivos ni URLs.
  - Inicio y `/meses/2026-10`, `2026-11` y `2026-12` a 360 px oscuro y 1440 px claro: sin desbordamiento horizontal, sin IDs duplicados, una sola acción primaria en el inicio y ninguna en el detalle, sin objetivos táctiles menores de 44 px en puntero grueso. Los tres meses cuadran (resumen = conceptos = categorías = tarjetas), incluido diciembre con $1.235.305.338. El vencido del mes en curso se muestra con la etiqueta, no con la alerta de meses anteriores (`overdueStatements`, intencional).
  - Flujo de pago por teclado en el extracto vencido de «QA Visa Capital fijo»: foco al abrir, cancelar devuelve el foco, fecha futura rechazada, confirmar nombra el extracto y deja el mes Pagado sin cambiar total, abonos, cupo ni deuda; se deshizo la marca y la cuenta quedó como estaba.
  - Rendimiento de `/` a 360 px: LCP 0,55–0,60 s en Fast 4G y 0,93 s en Slow 4G; el candidato final es contenido real (franja de tarjetas), no el skeleton. Dentro de 1,5 s.
  - Defecto encontrado y corregido: con nombres de tarjeta largos el importe caía a una línea alineada a la izquierda en las filas compactas del inicio y en la cabecera del bloque de extractos; además quedaba un «·» colgante en «Ya facturado · Aún puede crecer». Commit `024a66e` en `main` con prueba de regresión, verificado en local con nombre largo y de nuevo en producción en ambos tamaños y temas.
  - Pendiente para cerrar H9: revisión del dueño en su celular. La prueba con lector de pantalla real tampoco se hizo; los nombres y roles inspeccionados no la sustituyen.
- 2026-11-21 — El dueño marca el paso como completado y con él se cierra H9. La prueba con lector de pantalla real no se hizo; queda como pendiente conocido, no como bloqueo.
