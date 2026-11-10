# Paso 18 — Validación final del MVP

- **Hito PRD:** cierre del MVP
- **Estado:** ⬜ Pendiente
- **Inicio:** —
- **Fin:** —
- **Commit:** —
- **Depende de:** 01–17

## Objetivo

Confirmar que el MVP cumple todos los criterios de aceptación de F1–F8 del PRD, las reglas no negociables de `AGENTS.md` y los requisitos no funcionales, en local y en producción. No se escribe funcionalidad nueva; solo se corrigen fallas encontradas (cada corrección con su prueba).

## Tareas

- [ ] Aplicar todas las migraciones al remoto: `supabase db push` y `supabase migration list` sin pendientes.
- [ ] Desplegar `main` en Vercel.
- [ ] Recorrer el checklist de abajo en **producción** con datos reales del dueño (al menos 2 tarjetas reales).
- [ ] Actualizar `docs/PRD.md`: marcar las preguntas abiertas resueltas y anotar las decisiones D1–D10 tomadas (con aprobación del dueño).
- [ ] Marcar todos los pasos como ✅ en `plans/README.md`.

## Checklist de aceptación del PRD

**F1. Tarjetas**
- [ ] Se registran todos los campos del PRD.
- [ ] Archivar no borra historial; la tarjeta archivada no aparece al registrar movimientos.
- [ ] Cambiar la tasa no altera cuotas existentes; una compra nueva usa la tasa nueva.

**F2. Movimientos**
- [ ] Los 8 tipos se pueden registrar.
- [ ] Asignación automática al extracto según R1 (probar día del corte y día siguiente).
- [ ] Editar y borrar funcionan; las cuotas se regeneran.
- [ ] Registro desde el celular en < 15 s.

**F3. Compras a cuotas**
- [ ] N cuotas generadas con capital, interés, total y extracto.
- [ ] Tabla de amortización, cuota actual (ej. 4/12) y saldo pendiente visibles.
- [ ] "Sin intereses" produce interés 0.

**F4. Suscripciones**
- [ ] Todos los campos del PRD.
- [ ] El cobro diario se generó solo en producción (revisar `cron.job_run_details` al día siguiente).
- [ ] Costo mensual total y anual equivalente.

**F5. Extractos**
- [ ] Abierto, próximos y anteriores por tarjeta.
- [ ] Desglose por concepto con pagos aparte.
- [ ] Total real registrable y marcar como pagado.

**F6. Tablero**
- [ ] Próximo pago, fecha límite, cupo disponible y utilización por tarjeta.
- [ ] Deuda total, total a pagar este mes y gasto del mes frente al anterior.

**F7. Historial**
- [ ] Filtros por mes, tarjeta, categoría, tipo y texto.
- [ ] Gráfico de 12 meses y por categoría.

**F8. Categorías**
- [ ] 11 categorías iniciales y lista editable.

## Checklist de reglas y no funcionales

- [ ] `pnpm typecheck && pnpm lint && pnpm test && pnpm test:coverage` en verde; cobertura 100% en `lib/domain/`.
- [ ] `supabase db reset && supabase test db` en verde, incluida la prueba de RLS con segundo usuario.
- [ ] Ningún cálculo de dinero con `number` (revisión de `lib/` y `app/`: buscar `parseFloat`, `Number(`, `+` sobre montos).
- [ ] Fechas de negocio como `date` / `YYYY-MM-DD`; `new Date()` solo en `todayInBogota`.
- [ ] Registro público desactivado en producción (curl del paso 03).
- [ ] Ninguna `service_role` en el navegador ni en variables `NEXT_PUBLIC_*`.
- [ ] Solo últimos 4 dígitos de tarjeta en la base.
- [ ] Todas las tablas con RLS (Advisors de Supabase sin alertas de seguridad).
- [ ] Tablero < 1,5 s en 4G (Lighthouse móvil).
- [ ] 360 px y modo oscuro en todas las pantallas (checklist del paso 17).
- [ ] Exportación JSON/CSV funcionando en producción.
- [ ] Sin `.env*` con valores reales en el historial de git (`git log --all -- '*.env*'`).

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
