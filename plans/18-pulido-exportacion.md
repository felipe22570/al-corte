# Paso 18 — Pulido funcional: estados, accesibilidad y exportación

- **Hito PRD:** H8 (parte 1 de 2)
- **Estado:** ✅ Terminado y aceptado
- **Inicio:** 2026-11-11
- **Fin:** 2026-11-11
- **Commit:** ver historial de git (`feat: add data export, empty states and accessibility fixes`)
- **Depende de:** 17

## Objetivo

Completar lo que el PRD pide para H8 en el plano funcional: estados vacíos, de carga y de error en todas las pantallas, feedback de las acciones, accesibilidad básica y exportación completa de datos a CSV y JSON desde `/ajustes` (PRD sección 10, "Respaldo"). La revisión visual a fondo se hace en el paso 19.

## Tareas

Exportación

- [x] Route Handler `app/(app)/ajustes/exportar/route.ts` con `?formato=json|csv`, autenticado con el cliente de servidor (RLS; sin `service_role`).
- [x] JSON: tablas del usuario y metadatos; también incluye `notification_log` y las TRM compartidas de `fx_rates` para un respaldo más completo.
- [x] CSV: descargas separadas por tabla, sin dependencia de ZIP.
- [x] CSV con BOM UTF-8, separador `,`, montos como string sin formato y fechas `YYYY-MM-DD`.
- [x] Función pura de serialización CSV en `lib/` con pruebas (comillas, comas y saltos de línea dentro de campos).
- [x] Sección "Tus datos" en `/ajustes` con exportación JSON y CSV por tabla, botones `outline` y nombres de archivo con fecha.

Estados y feedback

- [x] Estados vacíos para tarjetas, movimientos, extractos, suscripciones, compras a cuotas activas y gráficos sin datos; las listas de extractos y cuotas conservan su texto vacío existente.
- [x] Skeleton compartido en las rutas protegidas, con movimiento reducido, y `error.tsx` con "Reintentar" para app y login. El skeleton es genérico, no específico por pantalla.
- [x] Feedback accesible de guardado, eliminación, cambios de estado y errores mediante avisos o mensajes `role="status"`/`role="alert"`; se muestran indicadores mientras se guarda.
- [ ] Revisar textos: español de Colombia, tuteo, consistentes con el glosario del PRD (extracto, corte, cuota, avance, cuota de manejo, cupo) y con el nombre "Al Corte".

Accesibilidad

- [x] Labels y asociaciones de error revisados en formularios principales, foco visible, etiquetas en botones de solo icono y animaciones de gráficos desactivadas; skeleton y botones respetan `prefers-reduced-motion`.
- [x] Ningún estado se comunica solo con color (badges con texto).

Limpieza

- [x] `grep -rnE "console\.log|TODO|FIXME" app components lib` sin resultados; sin nuevos fragmentos de código comentado.
- [x] `README.md` actualizado: qué es Al Corte (con el lema), requisitos, configuración local, comandos, despliegue, respaldo.

## Verificación

```
pnpm typecheck && pnpm lint && pnpm test && pnpm test:coverage
supabase db reset && supabase test db
pnpm build
grep -rnE "console\.log|TODO|FIXME" app components lib   # vacío o justificado
grep -rnE "\!['\"<]|¡" app components                    # sin exclamaciones en textos de la UI (revisar resultados)
```

Comprobaciones manuales (estados; el aspecto visual se revisa en el paso 19):

| Pantalla | Vacío | Carga | Error | Feedback al guardar |
| --- | --- | --- | --- | --- |
| `/` | | | | n/a |
| `/movimientos` | | | | n/a |
| `/movimientos/nuevo` | n/a | | | |
| `/movimientos/[id]` | n/a | | | |
| `/tarjetas/[id]` | | | | |
| `/tarjetas/[id]/extractos/[cutoff]` | | | | |
| `/suscripciones` | | | | |
| `/ajustes` | | | | |
| `/login` | n/a | n/a | | |

- [x] Exportar JSON y abrirlo: contiene todas las tablas y el número de filas coincide con `select count(*)` de cada tabla para el usuario.
- [ ] Exportar CSV y abrirlo en Excel/Sheets: tildes correctas, montos sin pérdida de decimales.
- [x] Sin sesión, la URL de exportación responde 401.
- [x] Se registró un gasto y se marcó un extracto como pagado usando teclado en Chrome emulado.

## Criterios de terminado

- Verificaciones en verde.
- Commit: `feat: add data export, empty states and accessibility fixes`.

## Notas de progreso

<!-- Fecha — nota -->

2026-11-11 — Iniciado el paso. Se prevén CSV individuales por tabla en lugar de ZIP para evitar dependencias nuevas; JSON incluirá las seis tablas del plan. Se usará autenticación del usuario y RLS, sin `service_role`.

2026-11-11 — Implementados JSON y CSV por tabla con paginación, números decimales como strings y protección RLS; añadidos `notification_log` y `fx_rates`. Dos cuentas locales temporales confirmaron aislamiento, 401 sin sesión, cantidades por tabla, 1.001 filas sin truncar, BOM y decimales. Se eliminaron ambas cuentas. Se actualizó el README y se añadieron feedback y mejoras de accesibilidad, incluido movimiento reducido. Con teclado se registró un gasto y se marcó un extracto pagado. Un CSV sintético del mismo serializador se importó en LibreOffice Calc conservando tildes y `1234567.89`; no se probó en Excel ni Google Sheets. Pasan 110 Vitest con cobertura de dominio del 100 %, tipos, lint, build, `db lint` y 151 pgTAP. Los respaldos consultan tablas por separado, por lo que se recomienda no editar durante la exportación; CSV conserva texto sin neutralizar posibles fórmulas y se advierte en la interfaz. Quedan pendientes el reinicio local autorizado, el examen completo de estados y feedback y el commit.

2026-11-11 — Se ejecutó el `db reset` autorizado y pasaron de nuevo 151 pgTAP y `db lint`. En Chrome a 360 px, oscuro y movimiento reducido se verificaron estados vacíos, errores asociados a los campos y mensajes de éxito al crear tarjeta, categoría y suscripción; se comprobó el error de acceso y se eliminó la cuenta temporal. Se agregaron pruebas para los estados compartidos de carga y error, y avisos de éxito al editar o eliminar movimientos. Pasan 112 Vitest con cobertura de dominio del 100 %, tipos, lint y build. El examen no provocó errores reales en cada ruta por separado; los límites de error compartidos tienen pruebas de renderizado. No se probó el CSV en Excel ni Google Sheets; solo en LibreOffice con datos sintéticos. Pendiente autorización para commit.

2026-11-11 — El dueño autorizó el commit con las limitaciones de validación anteriores documentadas. El paso se cierra por aceptación: no se afirma una prueba en Excel o Google Sheets ni la provocación de errores reales en cada ruta.
