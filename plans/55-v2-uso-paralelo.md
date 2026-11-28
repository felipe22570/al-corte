# Paso 55 — Uso en paralelo

- **Hito PRD:** H13 (parte 10 de 11)
- **Estado:** ⬜ Pendiente
- **Inicio:**
- **Fin:**
- **Commit:**
- **Depende de:** 54
- **Decisiones aplicables (decididas, ver README):** D64

## Objetivo

Usar solo la interfaz nueva durante un ciclo real para encontrar lo que falta antes de retirar la anterior.

## Contenido

Durante el periodo, el dueño entra por `/v2` para todo. La interfaz actual queda como respaldo y solo se abre para comparar.

Tareas reales que deben hacerse en v2 al menos una vez:

- [ ] Registrar gastos desde el celular (una cuota, a cuotas y en dólares).
- [ ] Confirmar borradores capturados por correo, corrigiendo nombre y cuotas.
- [ ] Registrar el pago de un extracto y un abono a capital.
- [ ] Conciliar un extracto con los valores del banco.
- [ ] Importar un extracto mensual.
- [ ] Crear, pausar y cancelar una suscripción.
- [ ] Editar una tarjeta y una categoría.

Cada vez que haga falta volver a la interfaz anterior, se anota qué faltó. Las brechas se corrigen en este paso; no se agregan funcionalidades.

## Verificación

- [ ] Lista de brechas vacía o con cada punto resuelto.
- [ ] Los totales de v2 coinciden con los de la interfaz actual en Inicio, un mes, una tarjeta y un extracto.
- [ ] `pnpm typecheck && pnpm lint && pnpm test && pnpm test:coverage` en verde.


## Criterios de terminado

- El dueño confirma que no necesitó la interfaz anterior durante el ciclo.
- Commit: `fix: close v2 gaps found in parallel use`.

## Notas de progreso

<!-- Fecha — nota -->
