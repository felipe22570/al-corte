# Paso 20 — Validación final del MVP

- **Hito PRD:** cierre del MVP
- **Estado:** ✅ Cerrado por el dueño con limitaciones documentadas
- **Inicio:** 2026-11-11
- **Fin:** 2026-11-12
- **Commit:** Ver etiqueta `mvp` (`chore: close mvp milestone`)
- **Depende de:** 01–19

## Objetivo

Confirmar que el MVP cumple todos los criterios de aceptación de F1–F8 del PRD, las reglas no negociables de `AGENTS.md` y los requisitos no funcionales, en local y en producción. No se escribe funcionalidad nueva; solo se corrigen fallas encontradas (cada corrección con su prueba).

## Tareas

- [x] Aplicar todas las migraciones al remoto: `supabase db push` y `supabase migration list` sin pendientes.
- [x] Desplegar `main` en Vercel.
- [x] Recorrer el checklist de abajo en **producción**, con la cuenta exclusiva autorizada por el dueño y tres tarjetas ficticias, no con sus datos bancarios reales.
- [x] Actualizar `docs/PRD.md`: marcar las preguntas abiertas resueltas y anotar las decisiones D1–D14 tomadas (con aprobación del dueño).
- [x] Marcar todos los pasos como ✅ en `plans/README.md`.

## Checklist de aceptación del PRD

**F1. Tarjetas**
- [x] Se registran todos los campos del PRD.
- [x] Archivar no borra historial; la tarjeta archivada no aparece al registrar movimientos.
- [x] Cambiar la tasa no altera cuotas existentes; una compra nueva usa la tasa nueva.

**F2. Movimientos**
- [x] Los 8 tipos se pueden registrar.
- [x] Asignación automática al extracto según R1 (probar día del corte y día siguiente).
- [x] Editar y borrar funcionan; las cuotas se regeneran. Edición en producción; borrado y cascadas en la instancia aislada para conservar los datos remotos.
- [x] Criterio de rapidez revisado: 1,78 s en Chrome móvil automatizado. La medición humana en un celular físico queda como seguimiento, excluida del cierre por aceptación explícita del dueño; no se presenta como verificada.

**F3. Compras a cuotas**
- [x] N cuotas generadas con capital, interés, total y extracto.
- [x] Tabla de amortización, cuota actual (ej. 4/12) y saldo pendiente visibles.
- [x] "Sin intereses" produce interés 0.

**F4. Suscripciones**
- [x] Todos los campos del PRD.
- [x] El cobro diario se generó solo en producción: ejecución programada del 12 de noviembre a las 05:00 de Bogotá, `succeeded`, un cobro de 25.000 COP sin duplicados para la suscripción preparada.
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
- [x] Revisión adicional con la extensión real axe DevTools: 52 escaneos WCAG 2.2 AA y buenas prácticas, sin fallas confirmadas; casos `Needs Review` de contraste y foco revisados aparte. Mantiene la aprobación visual general del dueño, sin afirmar una certificación exhaustiva WCAG.
- [x] Ningún cálculo de dinero con `number` (revisión de `lib/`, `app/` y `components/`; las conversiones de los gráficos solo sirven para geometría, no para totales).
- [x] Fechas de negocio como `date` / `YYYY-MM-DD`; `new Date()` en `todayInBogota` y en timestamps UTC de archivo, no para decidir días de negocio.
- [x] Registro público desactivado en producción (comprobación equivalente al curl del paso 03; corregido en esta validación).
- [x] Sin claves `service_role` en los 21 scripts públicos inspeccionados ni en variables `NEXT_PUBLIC_*` declaradas en el código. El panel de variables de Vercel no se inspeccionó en esta sesión.
- [x] Solo últimos 4 dígitos de tarjeta en la base.
- [x] Todas las tablas con RLS; Advisors sin errores de seguridad. Queda únicamente la advertencia de protección de contraseñas filtradas, aceptada por el dueño al mantener el plan Free (ver seguimiento abajo).
- [x] Tablero < 1,5 s en 4G (Lighthouse móvil).
- [x] 360 px y modo oscuro en todas las pantallas principales y formularios; aprobación visual general previa del dueño en el paso 19.
- [x] La UI solo usa colores, radios y estilos de texto de `app/globals.css` (`pnpm lint` con `check-design` en verde).
- [x] Marca revisada en UI y documentación. Personalización de correos de Supabase y nueva inspección del panel de Vercel excluidas del cierre por aceptación explícita del dueño; ver limitaciones. No se dan por verificadas.
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

El paso se cierra con los controles técnicos verificados y las limitaciones aceptadas explícitamente por el dueño el 12 de noviembre de 2026. Las casillas de aceptación de limitaciones no equivalen a pruebas ejecutadas: se detallan abajo. No quedan fallas funcionales de producción detectadas sin resolver; las métricas bancarias y verificaciones externas indicadas pasan a seguimiento.

## Criterios de terminado

- Commit: `chore: close mvp milestone`.
- Etiqueta: `git tag mvp`.

## Notas de progreso

<!-- Fecha — nota -->

2026-11-11 — El paso 19 recibió aprobación visual general. Sus capturas se eliminaron a solicitud del dueño. El reset local no se ejecutó en el paso 19 para preservar los datos existentes: solicitar autorización antes de borrar o recrear la base local.

2026-11-11 — El dueño aprueba el plan de validación y autoriza una base temporal aislada para reset y pgTAP, sin borrar la base local existente. Autoriza crear datos en producción con la cuenta exclusiva de validación y pide conservarlos. Se usan tarjetas ficticias en vez de las tarjetas reales del dueño; no se almacenan credenciales en el repositorio.

### Resultados de la validación del 11 de noviembre de 2026

**Estado al 11 de noviembre: validación técnica ejecutada; cierre pendiente.** Este registro histórico se complementa con la revisión y aprobación de cierre del 12 de noviembre que aparecen abajo.

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

**Comprobación adicional local:** al borrar una compra o avance, `next dev` mostró `Performance.measure: TransactionDetailPage cannot have a negative time stamp`, después de que el borrado se completara correctamente. Se repitió el flujo completo con `next build` + `next start`, apuntando exclusivamente a la instancia aislada: compra y avance creados a tres cuotas, borrado con cascadas y cierre de sesión correctos, **cero errores de navegador**. El mensaje no se reprodujo en modo producción; queda registrado como incidencia de instrumentación de desarrollo de Next.js/React para investigar si vuelve a aparecer, no se silenció mediante código de la app.

### Fallas encontradas y corregidas

| Hallazgo | Corrección y verificación |
| --- | --- |
| Registro público remoto habilitado, en contra del PRD | Se modificó únicamente `auth.enable_signup` mediante configuración temporal mínima, revisando el diff antes de aplicar. Las otras once propiedades remotas no declaradas quedaron intactas. Repetición de la petición sobre el correo de pruebas existente: HTTP 422, `signup_disabled`. La comprobación inicial no creó otro usuario real ni cambió la contraseña de la cuenta. |
| Botón de Suscripciones desbordaba 9 px a 360 px | `PageHeader` permite envolver la acción debajo del título. Prueba de regresión nueva y comprobación remota en claro/oscuro: sin desbordamiento. |
| Iconos de categoría se encogían junto a texto/selectores | `shrink-0` en historial y formularios de categoría/movimiento. Pruebas de regresión y nueva medición de la matriz remota: iconos de 20 px. |

### Seguimiento de seguridad solicitado por el dueño

2026-11-11 — El dueño solicita resolver las advertencias de Supabase. Se agrega la migración `20261112010000_harden_subscription_rpc.sql`: la implementación `SECURITY DEFINER` de `generate_charges_for_subscription` pasa al esquema `private`, no expuesto por PostgREST. La misma RPC pública conserva nombre, firma y comportamiento, pero usa `SECURITY INVOKER`. La implementación privada sigue validando autenticación/dueño, usa `search_path` vacío y no admite anónimos; `authenticated` tiene uso del esquema, no permiso de creación. No se agrega una clave `service_role` ni se amplían permisos del cron global o generador interno.

Se añadieron dieciséis pruebas de regresión, primero en rojo y luego en verde. Reset aislado: diez migraciones y **167 pruebas SQL** en nueve archivos, PASS. Tipos regenerados sin diferencias; **117 pruebas de aplicación**, cobertura de dominio 100 %, typecheck, lint y build correctos. Migración aplicada al remoto y listada sin pendientes. Verificación remota: cero funciones `SECURITY DEFINER` públicas ejecutables por `authenticated`, esquema `private` rechazado por la API con 406/PGRST106, permisos indebidos con 42501 y cobros propios idempotentes sin duplicados. Los totales de los 28 extractos y tres tarjetas siguen coincidiendo. Los datos de producción se conservaron.

Advisors remoto ya no reporta `authenticated_security_definer_function_executable`. Para `auth_leaked_password_protection` se intentó activar únicamente `password_hibp_enabled` mediante Management API; Supabase respondió **HTTP 402**: la función requiere Pro o superior. No se cambió el plan, no se generaron cargos y no se alteraron contraseñas ni otras opciones de Auth. Tras conocer el bloqueo, el dueño eligió explícitamente **Mantener Free** y aceptar esta advertencia como limitación. La protección permanece desactivada; no se oculta ni se presenta como resuelta técnicamente. El registro público continúa desactivado.

### Revisión adicional y cierre — 12 de noviembre de 2026

El dueño solicita realizar la revisión adicional y cerrar el MVP. Tras informar los límites de acceso y del plan Free, elige explícitamente **«Cerrar con limitaciones»**: celular físico, personalización de correos y nueva inspección del panel de Vercel pasan a seguimiento sin presentarlos como verificados.

| Verificación de cierre | Resultado |
| --- | --- |
| Extensión real | axe DevTools 4.140.0 descargada de Chrome Web Store, instalada en un perfil aislado de Chrome for Testing 148; motor axe-core 4.13.0. Se usó el escáner gratuito, sin crear cuenta ni iniciar pruebas Pro. Telemetría, capturas opcionales y funciones de IA desactivadas antes de escanear. |
| Matriz adicional | 52 escaneos: nueve rutas autenticadas, tres formularios y login × claro/oscuro × 360/1280 px. WCAG 2.2 AA y buenas prácticas activas, detalles/filtros desplegados. Cero fallas confirmadas de cualquier severidad, cero errores JS y sin desbordamiento horizontal en las rutas autenticadas. |
| Casos manuales | La extensión señaló 140 ocurrencias `Needs Review` en la matriz autenticada, no 140 infracciones confirmadas: ejes SVG del historial, signos del extracto y foco/guardas de los diálogos. Se conservaron visibles y se revisaron aparte, sin ocultarlos ni contarlos automáticamente como aprobados. Ejes: mínimo 5,97:1 claro / 7,42:1 oscuro, incluidos los 25 textos del gráfico de escritorio; extracto: mínimo 16,70:1 / 14,66:1. Cada formulario comprobado con 30 Tab y cinco Shift+Tab en ambos temas: retiene el foco y lo devuelve al disparador con Escape. La revisión no certifica todos los criterios manuales WCAG ni incluye lector de pantalla físico. |
| Rapidez automatizada | Registro de `QA Cierre MVP móvil 2026-11-12`, 12.500 COP, con viewport móvil/táctil de 360 px: 1.780 ms desde llenar el formulario hasta confirmar persistencia. No representa tiempo de escritura humana en un teléfono físico. El movimiento queda en producción. |
| Cron programado | Trabajo 1, inicio `2026-11-12T10:00:00.194308Z`, fin `2026-11-12T10:00:00.360448Z`, `succeeded`. `QA Cron mañana COP` tiene exactamente un cobro `source=subscription`, fecha 2026-11-12 y monto 25.000 COP. No se disparó manualmente para sustituir esta prueba. |
| Pruebas y cobertura | Repetidos typecheck, lint, Vitest (117 pruebas), cobertura de dominio 100 % en las cuatro métricas y build. Sin cambios de código de aplicación en este cierre. |
| Base aislada | Proyecto local temporal `al-corte-close-validation`, puerto 56322. Reset desde cero de las diez migraciones y 167 pruebas SQL: PASS. Tipos regenerados sin diferencias. La base original del puerto 54322 no se reinició ni se borró. |
| Remoto | Diez migraciones local/remoto coincidentes; `db lint` sin errores. Advisors conserva solo `auth_leaked_password_protection`, aceptada por el dueño al mantener Free. Registro público sigue desactivado. |
| Correo | Se consultó la configuración real: remitente personalizado no configurado y asunto/plantilla de magic link predeterminados. Intento mínimo de personalización rechazado: HTTP 401 al cambiar el nombre sin SMTP propio, y HTTP 400 al cambiar asunto/plantilla con proveedor predeterminado en Free. Se confirmó por lectura posterior que los valores quedaron intactos. No se enviaron correos, no se contrató SMTP y no se cambió de plan. |
| Datos conservados | Cuenta de validación: tres tarjetas, 39 movimientos (incluyen cron y nuevo gasto móvil), 40 cuotas, 28 extractos, siete suscripciones y doce categorías. Sin limpieza de datos remotos. |

Las evidencias brutas y capturas de la herramienta son temporales, fuera del repositorio en `/tmp/opencode/`. Este registro resume los resultados durables sin credenciales. No se agregaron dependencias al proyecto ni se modificaron archivos `.env`.

### Seguimiento aceptado — no bloquea este cierre

- **Celular físico:** medir el registro humano en menos de 15 s y comprobar teclado táctil. Solo se verificó emulación móvil automatizada.
- **Correos de Supabase:** personalizar asunto, contenido y remitente cuando exista SMTP propio compatible o un plan que lo permita. La marca en los correos predeterminados no está verificada ni corregida; el dueño acepta la limitación actual.
- **Vercel:** nueva revisión de las variables y nombre del proyecto en el panel cuando se facilite acceso. Se conserva la comprobación anterior del paso 03 y la inspección de los scripts públicos del paso 20; no se afirma acceso nuevo al panel.
- **Supabase Free:** protección de contraseñas filtradas no disponible, aceptada explícitamente. No se ocultó la advertencia.
- **Uso real:** tres cortes bancarios, cobros de suscripciones contra extractos y cualquier incidencia de instrumentación exclusiva de `next dev` que vuelva a aparecer.

El cierre administrativo se registra en el commit `chore: close mvp milestone`, identificado por la etiqueta `mvp`. Esta aprobación con limitaciones no transforma los seguimientos anteriores en pruebas realizadas.

Consulta de seguimiento (solo lectura):

```bash
pnpm exec supabase db query --remote --read-only "select jobid,status,start_time,end_time,return_message from cron.job_run_details order by start_time desc limit 10"
pnpm exec supabase db advisors --remote --type security
```

Para las métricas bancarias, usar los siguientes tres cortes de cada tarjeta real del dueño y registrar calculado/real/diferencia en la tabla de arriba, sin mezclar los datos de esta cuenta ficticia. Comparar también cada cobro de suscripción del extracto bancario contra el historial por fecha y comercio. Una diferencia mayor o igual al 1 % o un cobro faltante queda como incidencia, no se corrige ajustando el dato de prueba para que coincida.
