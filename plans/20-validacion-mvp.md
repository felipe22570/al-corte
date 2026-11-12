# Paso 20 — Validación final del MVP

- **Hito PRD:** cierre del MVP
- **Estado:** 🟡 En progreso
- **Inicio:** 2026-11-11
- **Fin:** —
- **Commit:** —
- **Depende de:** 01–19

## Objetivo

Confirmar que el MVP cumple todos los criterios de aceptación de F1–F8 del PRD, las reglas no negociables de `AGENTS.md` y los requisitos no funcionales, en local y en producción. No se escribe funcionalidad nueva; solo se corrigen fallas encontradas (cada corrección con su prueba).

## Tareas

- [x] Aplicar todas las migraciones al remoto: `supabase db push` y `supabase migration list` sin pendientes.
- [x] Desplegar `main` en Vercel.
- [x] Recorrer el checklist de abajo en **producción**, con la cuenta exclusiva autorizada por el dueño y tres tarjetas ficticias, no con sus datos bancarios reales.
- [x] Actualizar `docs/PRD.md`: marcar las preguntas abiertas resueltas y anotar las decisiones D1–D14 tomadas (con aprobación del dueño).
- [ ] Marcar todos los pasos como ✅ en `plans/README.md`.

## Checklist de aceptación del PRD

**F1. Tarjetas**
- [x] Se registran todos los campos del PRD.
- [x] Archivar no borra historial; la tarjeta archivada no aparece al registrar movimientos.
- [x] Cambiar la tasa no altera cuotas existentes; una compra nueva usa la tasa nueva.

**F2. Movimientos**
- [x] Los 8 tipos se pueden registrar.
- [x] Asignación automática al extracto según R1 (probar día del corte y día siguiente).
- [x] Editar y borrar funcionan; las cuotas se regeneran. Edición en producción; borrado y cascadas en la instancia aislada para conservar los datos remotos.
- [ ] Registro desde el celular en < 15 s.

**F3. Compras a cuotas**
- [x] N cuotas generadas con capital, interés, total y extracto.
- [x] Tabla de amortización, cuota actual (ej. 4/12) y saldo pendiente visibles.
- [x] "Sin intereses" produce interés 0.

**F4. Suscripciones**
- [x] Todos los campos del PRD.
- [ ] El cobro diario se generó solo en producción (revisar `cron.job_run_details` al día siguiente).
- [x] Costo mensual total y anual equivalente.

**F5. Extractos**
- [x] Abierto, próximos y anteriores por tarjeta.
- [x] Desglose por concepto con pagos aparte.
- [x] Total real registrable y marcar como pagado.

**F6. Tablero**
- [x] Próximo pago, fecha límite, cupo disponible y utilización por tarjeta.
- [x] Deuda total, total a pagar este mes y gasto del mes frente al anterior.

**F7. Historial**
- [x] Filtros por mes, tarjeta, categoría, tipo y texto.
- [x] Gráfico de 12 meses y por categoría.

**F8. Categorías**
- [x] 11 categorías iniciales y lista editable.

## Checklist de reglas y no funcionales

- [x] `pnpm typecheck && pnpm lint && pnpm test && pnpm test:coverage` en verde; cobertura 100% en `lib/domain/`.
- [x] `supabase db reset && supabase test db` en verde en la instancia temporal aislada, incluida la prueba de RLS con segundo usuario.
- [ ] Completar la checklist visual y de interacciones que quedó parcial en el paso 19 y verificar accesibilidad con axe DevTools; la aprobación visual del dueño fue general y se usó axe-core como alternativa parcial.
- [x] Ningún cálculo de dinero con `number` (revisión de `lib/`, `app/` y `components/`; las conversiones de los gráficos solo sirven para geometría, no para totales).
- [x] Fechas de negocio como `date` / `YYYY-MM-DD`; `new Date()` en `todayInBogota` y en timestamps UTC de archivo, no para decidir días de negocio.
- [x] Registro público desactivado en producción (comprobación equivalente al curl del paso 03; corregido en esta validación).
- [x] Sin claves `service_role` en los 21 scripts públicos inspeccionados ni en variables `NEXT_PUBLIC_*` declaradas en el código. El panel de variables de Vercel no se inspeccionó en esta sesión.
- [x] Solo últimos 4 dígitos de tarjeta en la base.
- [ ] Todas las tablas con RLS (Advisors de Supabase sin alertas de seguridad).
- [x] Tablero < 1,5 s en 4G (Lighthouse móvil).
- [x] 360 px y modo oscuro en todas las pantallas principales y formularios; aprobación visual general previa del dueño en el paso 19.
- [x] La UI solo usa colores, radios y estilos de texto de `app/globals.css` (`pnpm lint` con `check-design` en verde).
- [ ] "Al Corte" escrito correctamente en la UI, títulos de pestaña, correos de Supabase y `README.md`; `al-corte` en `package.json`, Vercel y Supabase.
- [x] Exportación JSON/CSV funcionando en producción.
- [x] Sin `.env*` con valores reales en el historial de git (`git log --all -- '*.env*'`; solo `.env.example` con valores ficticios).

## Métricas de éxito (seguimiento después del MVP)

Estas no se pueden verificar el día del cierre; dejar anotado cómo se medirán:

- [ ] Extracto proyectado vs. real del banco con diferencia < 1% en 3 cortes seguidos (se registra con "total real" en cada extracto; anotar aquí los resultados de cada corte).
- [ ] Ningún cobro de suscripción en el extracto del banco sin registrar en la app.

| Corte | Tarjeta | Calculado | Real | Diferencia % |
| --- | --- | --- | --- | --- |
| | | | | |

## Verificación

El paso está terminado cuando todos los checklists anteriores están marcados (salvo las métricas de seguimiento) y no hay fallas abiertas.

## Criterios de terminado

- Commit: `chore: close mvp milestone`.
- Etiqueta: `git tag mvp`.

## Notas de progreso

<!-- Fecha — nota -->

2026-11-11 — El paso 19 recibió aprobación visual general. Sus capturas se eliminaron a solicitud del dueño. El reset local no se ejecutó en el paso 19 para preservar los datos existentes: solicitar autorización antes de borrar o recrear la base local.

2026-11-11 — El dueño aprueba el plan de validación y autoriza una base temporal aislada para reset y pgTAP, sin borrar la base local existente. Autoriza crear datos en producción con la cuenta exclusiva de validación y pide conservarlos. Se usan tarjetas ficticias en vez de las tarjetas reales del dueño; no se almacenan credenciales en el repositorio.

### Resultados de la validación del 11 de noviembre de 2026

**Estado: validación técnica ejecutada; cierre del MVP pendiente.** No se marca el paso como terminado ni se crea `git tag mvp` mientras sigan las comprobaciones externas de abajo.

| Área | Evidencia y resultado |
| --- | --- |
| Código | `pnpm typecheck`, `pnpm lint`, `pnpm test:coverage` y `pnpm build` pasan. 117 pruebas en 34 archivos. Dominio: 100 % en sentencias, ramas, funciones y líneas (11 archivos). |
| Base desde cero | Proyecto temporal `al-corte-mvp-validation`, puerto 55322, separado del local original (54322). `supabase db reset` aplica las nueve migraciones; `supabase test db`: 151 pruebas, ocho archivos, PASS. Incluye segundo usuario, lectura/escritura ajena denegada, atomicidad, cascadas, fin de mes y cron idempotente. |
| Tipos | Tipos regenerados desde la base aislada: sin diferencias con `lib/database.types.ts`. No se cambió el esquema. |
| Producción | `supabase db push --remote --yes`: sin pendientes; las nueve migraciones coinciden. `supabase db lint --remote`: sin errores. Correcciones de UI enviadas a `main` y observadas en la URL pública: commits `5440024` y `3a92e91`. |
| Datos conservados | Tres tarjetas (dos activas y una archivada), 37 movimientos incluyendo cargos automáticos, 40 cuotas, 28 extractos, siete suscripciones y doce categorías (once iniciales y una de prueba editada). Ningún dato remoto se limpió al terminar. |
| Tarjetas y cuotas | Visa capital fijo y Mastercard cuota fija: doce cuotas y suma de capital exacta. Compra USD 100,01 a tres cuotas con TRM 4.000: suma exacta en USD y COP. Promoción sin interés editada de tres a cuatro cuotas: filas regeneradas, capital exacto e interés cero. Cambiar la tasa de tarjeta de 28,45 % a 30 % no altera cuotas existentes; compra nueva usa 30 %. |
| Fechas | Compras del 15 y 16 de noviembre asignadas a cortes 15 de noviembre y 15 de diciembre. Tarjeta con corte 31: 28 de febrero de 2027 y 29 de febrero de 2028 correctos. Pago posterior en el mes siguiente. |
| Extractos y tablero | Recalculados independientemente con Decimal los totales de los 28 extractos y saldos de las tres tarjetas: coinciden con las vistas. Pagos aparte. Total real 95.000 y marcado pagado persisten. Tablero: total del mes 135.000, deuda 1.238.544.891 y gasto 1.238.117.236 coinciden con el recálculo; los valores grandes son deliberados. |
| Archivo y borrado | Tarjeta archivada conserva detalle/historial y desaparece del selector. Edición validada en producción. Borrado real mediante UI de una compra y de un avance a tres cuotas en la base aislada: elimina cuotas y comisión asociada. No se borraron movimientos en producción. |
| Suscripciones | Mensuales COP y USD generan su cobro inmediato; USD usa la TRM del último movimiento del mismo usuario. Repetir la RPC dos veces sobre cada una retorna cero, sin duplicados. Estados pausada/cancelada persisten. Suscripción anual bisiesta y prueba gratis registradas. Mensual 119.960 y anual equivalente 1.439.520, excluyendo pausadas/canceladas. |
| Historial y categorías | Filtros por mes, tarjeta, categoría, tipo, comercio y combinación de los cinco: correctos; compra excluida al filtrar devolución. Gráficos mensual y por categoría visibles. Creación y edición de categoría persisten. |
| Exportación | JSON válido con montos como texto; CSV de las ocho tablas con HTTP 200 y `private, no-store`. Tabla inválida rechazada con 400. Sin sesión, no se entrega el respaldo. |
| RLS en producción | Cliente con clave publicable y sesión de validación: solo datos propios en las siete tablas con dueño y en ambas vistas; cero filas ajenas. Anónimo: 401/42501 al consultar tarjetas. RPC global/interna y cobro de suscripción no disponible: 42501. Ocho tablas con RLS, vistas `security_invoker=true`. |
| Secretos y fechas | Inspeccionados 21 scripts públicos: cero claves `sb_secret_` ni JWT con rol `service_role`. Historial git: solo `.env.example`, con valores ficticios. `Number()` en calendarios, conteos, porcentajes y geometría de Recharts, no en sumas de dinero; tooltips usan strings originales. `new Date()` de archivo guarda timestamp UTC, no decide fechas de negocio. |
| Accesibilidad | Axe-core 4.11: cero infracciones en 48 combinaciones (nueve rutas y tres formularios × dos temas × dos anchos), más login en cuatro combinaciones. Cero errores JS, desbordamientos horizontales o controles medidos bajo 44 px (casillas/radios se evalúan con sus etiquetas). Los `incomplete` se revisaron aparte, no se contaron como aprobados automáticamente. |
| Revisión manual asistida | Contraste mínimo de ejes SVG: 5,97:1 claro / 7,42:1 oscuro. Signos en extracto: 16,70:1 / 14,66:1. Cada formulario retiene el foco durante 30 Tab y cinco Shift+Tab y devuelve el foco al disparador al cerrar con Escape. Error de valor vacío anunciado y `aria-invalid=true`. Login, redirecciones sin sesión y detalle inexistente comprobados. |
| Lighthouse móvil remoto | Lighthouse 13.0.1; 4G simulada (RTT 150 ms, 1.638,4 Kbps) y CPU 4×, sesión autenticada, sin borrar almacenamiento. Última corrida: rendimiento 99, accesibilidad 100, buenas prácticas 100; LCP 924 ms, FCP 817 ms, CLS 0. Primera corrida: 100/100/100 y LCP 918 ms. Mediciones de laboratorio, no datos de usuarios reales. |

Las herramientas de navegador, axe y Lighthouse se ejecutaron fuera del repositorio; no se agregaron dependencias. Las capturas e informes brutos temporales están fuera de git en `/tmp/opencode/`. Esta tabla es el registro durable, sin contraseñas ni tokens.

### Fallas encontradas y corregidas

| Hallazgo | Corrección y verificación |
| --- | --- |
| Registro público remoto habilitado, en contra del PRD | Se modificó únicamente `auth.enable_signup` mediante configuración temporal mínima, revisando el diff antes de aplicar. Las otras once propiedades remotas no declaradas quedaron intactas. Repetición de la petición sobre el correo de pruebas existente: HTTP 422, `signup_disabled`. La comprobación inicial no creó otro usuario real ni cambió la contraseña de la cuenta. |
| Botón de Suscripciones desbordaba 9 px a 360 px | `PageHeader` permite envolver la acción debajo del título. Prueba de regresión nueva y comprobación remota en claro/oscuro: sin desbordamiento. |
| Iconos de categoría se encogían junto a texto/selectores | `shrink-0` en historial y formularios de categoría/movimiento. Pruebas de regresión y nueva medición de la matriz remota: iconos de 20 px. |

### Pendientes necesarios para cerrar el paso

1. **Cron real, no manual.** Aún no hay filas en `cron.job_run_details`. El trabajo remoto está activo con `0 10 * * *`. Se dejó `QA Cron mañana COP`, 25.000 COP, día de cobro 12, activa y asociada a la Visa. El **12 de noviembre de 2026 después de las 05:00 de Bogotá (10:00 UTC)**, comprobar ejecución exitosa del trabajo y exactamente un movimiento `source=subscription`, fecha `2026-11-12`, para esa suscripción. No se cambió el horario ni se ejecutó el cron global manualmente sobre los datos del dueño. La RPC inmediata ya se verificó, pero no sustituye esta evidencia.
2. **Advisors de seguridad.** Sin errores de esquema, pero quedan dos WARN. `authenticated_security_definer_function_executable` es intencional en `generate_charges_for_subscription`: `search_path` vacío, autenticación y dueño comprobados antes de llamar a la función interna; pruebas SQL y petición remota de acceso indebido denegadas. No se retiró el acceso que necesita F4 ni se ocultó la advertencia. `auth_leaked_password_protection` indica protección contra contraseñas filtradas desactivada: habilitarla en Supabase si el plan lo permite o aceptar explícitamente la limitación. No se cambió de plan ni se asumió un gasto.
3. **Comprobaciones del dueño.** Medir un registro en un celular físico en menos de 15 s; la automatización en Chrome móvil tardó 1,29–1,68 s por formulario/guardado, pero no mide escritura humana ni teclado táctil. Confirmar asunto/remitente de correos de Supabase con la marca Al Corte y revisar las variables del panel de Vercel; no se inspeccionaron sus paneles ni se envió correo a cuentas del dueño.
4. **Herramienta visual exigida por el plan.** Se completó la matriz automática con axe-core, revisión de incompletos y teclado. No se ejecutó la extensión axe DevTools ni se usó un dispositivo táctil físico. Confirmar si se acepta esta equivalencia o realizar esas revisiones antes de marcar el punto compuesto del checklist. La aprobación visual general previa sigue vigente, no se inventa una aprobación nueva.
5. **Cierre administrativo.** Solo después de resolver/aceptar las limitaciones anteriores: marcar el paso 20 y la tabla general como terminados, commit `chore: close mvp milestone` y etiqueta `mvp`. Las métricas bancarias de tres cortes continúan como seguimiento, no como éxito demostrado con datos ficticios.

Consulta de seguimiento (solo lectura):

```bash
pnpm exec supabase db query --remote --read-only "select jobid,status,start_time,end_time,return_message from cron.job_run_details order by start_time desc limit 10"
pnpm exec supabase db advisors --remote --type security
```

Para las métricas bancarias, usar los siguientes tres cortes de cada tarjeta real del dueño y registrar calculado/real/diferencia en la tabla de arriba, sin mezclar los datos de esta cuenta ficticia. Comparar también cada cobro de suscripción del extracto bancario contra el historial por fecha y comercio. Una diferencia mayor o igual al 1 % o un cobro faltante queda como incidencia, no se corrige ajustando el dato de prueba para que coincida.
