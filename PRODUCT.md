# Al Corte

<!-- impeccable:product-schema 1 -->

## Platform

web

Aplicación web personal, con PWA como plataforma objetivo de uso en el celular. La instalación PWA está prevista en v2 del PRD; este registro no la adelanta ni afirma que ya esté implementada.

## Users

Un solo usuario: el dueño, en Colombia, con varias tarjetas de crédito en COP y algunos cobros en USD. Usa el computador para revisar extractos y el celular para registrar gastos.

No hay audiencia comercial, registro público, planes, onboarding ni panel de administración.

## Product Purpose

La prioridad confirmada por el dueño es entender cuánto pagar y por qué en cada extracto. El registro rápido de gastos desde el celular alimenta esa revisión; no es la prioridad principal por encima de los extractos.

Al Corte permite controlar cargos, abonos, compras a cuotas, avances y suscripciones por tarjeta y fecha de corte, con historial mensual y visibilidad del capital pendiente.

Las métricas del PRD son objetivos, no resultados demostrados:

- Diferencia menor al 1 % entre extracto proyectado y bancario durante tres cortes seguidos.
- Registro de un gasto desde el celular en menos de 15 segundos.
- Ningún cobro de suscripción en el extracto sin estar registrado en la app.

## Operating Context

- La fecha de corte organiza el producto: cada movimiento se asigna al extracto correspondiente y cada cuota a su periodo.
- En el computador, el dueño revisa el desglose del extracto, registra el total real del banco y marca el extracto como pagado. La app registra pagos; no los ejecuta.
- En el celular, registra valor, tarjeta, categoría, comercio y cuotas. La fecha de hoy y la última tarjeta usada reducen pasos. Antes de guardar una compra a cuotas, ve la primera cuota, los intereses y el extracto asignado.
- H9 aprobado y pendiente de implementar: la pantalla de inicio organizará todo por **mes de pago** (D18), con el actual destacado, próximos estimados y anteriores como historial. El actual abierto incluirá cobros previstos identificados aparte; cada mes permitirá entender los cargos por tarjeta y concepto. Los vencidos seguirán en su mes con alerta adicional (D23), no sumados al actual.
- El control de pago es por extracto: "Pendiente de confirmar pago" no descuenta abonos registrados ni incluye previstos. Marcar pagado no crea un abono ni libera cupo. El total mensual usa el calculado, no el total bancario de referencia (D26, D27).
- Las suscripciones activas generan sus cobros automáticamente. La automatización debe evitar duplicados y recuperar cobros pendientes dentro de la ventana definida en el PRD.
- Moneda base COP, secundaria USD; zona horaria única `America/Bogota`. Los días de negocio no dependen de la zona del dispositivo.

## Capabilities and Constraints

`docs/PRD.md` es la autoridad funcional, incluido su registro de decisiones aprobadas. `AGENTS.md` establece las reglas de implementación. Este archivo captura contexto duradero, no sustituye esas fuentes ni amplía el alcance.

- MVP: tarjetas y categorías editables, movimientos y cuotas, extractos, suscripciones, historial y respaldo de datos. MVP 1.1 (H9): vista por meses como pantalla de inicio, en lugar del tablero. Una tarjeta puede archivarse sin perder su historial.
- Planeación adicional, recordatorios por email, conciliación detallada, automatización de TRM e instalación PWA pertenecen a v2. H9 sí incluye proyecciones y avisos en pantalla de vencidos/TRM faltante. La captura por PDF o email y otras automatizaciones pertenecen a v3. No anticiparlas sin petición explícita.
- H9 proyecta hasta 12 meses de pago con compromisos conocidos, incluido manejo aunque no haya compras o suscripciones; avisa de cuotas/extractos reales posteriores. Sin TRM muestra un total conocido incompleto, no inventa COP. Al convertir un cobro previsto en real se deduplica por suscripción y fecha.
- La deuda total registrada se conserva como dato secundario según D2, incluidas tarjetas archivadas con saldo, sin proyecciones ni límite de 12 meses. Archivar todas las tarjetas no oculta el historial.
- En el detalle mensual, categorías y conceptos explican el mismo total de R7: cuotas del periodo, no compras completas. Las comparaciones no atribuyen ahorro a meses abiertos, estimados o incompletos; ceros y devoluciones negativas no se ocultan (D28, D29).
- No hay conexión directa con bancos, cuentas de ahorro, inversiones, créditos distintos a tarjetas, pagos desde la app ni funcionalidad multiusuario.
- Mantener autenticación y aislamiento de datos mediante RLS aunque solo exista una cuenta.
- Nunca almacenar número completo de tarjeta, CVV ni vencimiento; únicamente los últimos cuatro dígitos.
- El dinero requiere aritmética decimal exacta. Las compras y sus cuotas se guardan en una sola transacción; las tasas se conservan por compra y los cambios de corte no reescriben extractos existentes.
- El cálculo usa las decisiones aprobadas del PRD, no reglas bancarias supuestas. El método de amortización de cada banco y la existencia de cortes variables siguen pendientes de confirmación con evidencia real.

Decisiones abiertas del PRD: cortes variables, validación del método de amortización por banco y necesidad de notificaciones push además de email. Ninguna se resuelve por inferencia en este init.

## Brand Commitments

- Nombre visible: **Al Corte**, dos palabras con mayúscula inicial. Lema: «Tus tarjetas, claras antes de cada corte.»
- Español de Colombia, tuteando, frases cortas y tono directo. Sin lenguaje alarmista ni signos de exclamación.
- No hay logo: no inventar uno ni convertir un icono en logotipo. El favicon neutro temporal aprobado no constituye un logo.
- No agregar mensajes de venta ni afirmaciones promocionales a las pantallas de uso personal.
- La identidad existente y sus restricciones se conservan. `app/globals.css` es la fuente de verdad de los tokens; este archivo no define una nueva dirección visual.

## Evidence on Hand

- `docs/PRD.md`: objetivos, flujos, fases, reglas de dominio y decisiones aprobadas.
- `AGENTS.md`: restricciones de seguridad, dinero, fechas, interfaz y forma de trabajo.
- `README.md` y `plans/20-validacion-mvp.md`: cierre y evidencias de validación del MVP, con sus limitaciones y seguimientos. No equivalen a demostrar las métricas de uso real del PRD.
- `app/`, `components/` y `app/globals.css`: implementación e identidad existentes; la ausencia de `DESIGN.md` no implica un proyecto sin diseño.
- Confirmación del dueño durante init: priorizar extractos; registrar desde el celular y revisar desde el computador; plataforma web/PWA de uso personal.

No inventar extractos bancarios reales, comprobaciones de exactitud, testimonios ni resultados de uso que estas fuentes no acrediten.

## Product Principles

1. Entender cuánto pagar y por qué tiene prioridad sobre acumular indicadores. El mes de pago es la unidad principal de lectura.
2. El registro debe ser suficientemente rápido para sostener la revisión de extractos sin convertirse en una carga.
3. Conservar la exactitud, la trazabilidad y el historial antes que simplificar silenciosamente las reglas del banco.
4. Automatizar cobros sin duplicar datos ni ocultar información faltante.
5. Mantener el alcance de una herramienta personal; no introducir flujos comerciales ni ampliar las fases por iniciativa propia.

## Accessibility & Inclusion

- Uso desde 360 px de ancho, en modo claro y oscuro.
- Áreas táctiles de al menos 44 × 44 px.
- Los estados siempre incluyen texto; el color no puede ser la única señal.
- Campos de al menos 16 px para evitar zoom automático en iOS y bordes con contraste mínimo 3:1, según la decisión D12.
- Formatos colombianos consistentes para montos, fechas y tasas mediante `lib/format.ts`.
