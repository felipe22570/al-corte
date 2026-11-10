# Paso 15 — Tablero

- **Hito PRD:** H7 (parte 1 de 2)
- **Estado:** ⬜ Pendiente
- **Inicio:** —
- **Fin:** —
- **Commit:** —
- **Depende de:** 13, 14
- **Decisiones aplicables (decididas, ver README):** D2, D5

## Objetivo

Pantalla `/` (F6): estado de todas las tarjetas activas en una sola vista y los totales globales.

## Contenido

Por tarjeta (activas, no archivadas):

- Nombre, banco, `•••• 1234`, color.
- Próximo pago: total del extracto más próximo con `due_date ≥ hoy` y sin `paid_at`, y su fecha límite (con "en N días"; resaltado si faltan ≤ 3 días o está vencido).
- Cupo disponible y % de utilización (barra; colores por umbral: < 30%, 30–70%, > 70%).
- Enlace a `/tarjetas/[id]`.

Totales:

- **Deuda total pendiente:** Σ `used` de `card_balances` (o la definición que se fije en D2).
- **Total a pagar este mes:** Σ de extractos sin pagar con `due_date` dentro del mes calendario actual (Bogotá).
- **Gasto del mes actual frente al anterior:** `monthlySpending` + `compareMonths` (D5), con flecha y %.

Botón flotante "Nuevo gasto" (ya existe del paso 09).

## Tareas

- [ ] Funciones puras nuevas en `lib/domain/` con pruebas (mantener 100%): selección del "próximo pago" por tarjeta; total a pagar del mes; días hasta la fecha límite.
- [ ] Consulta del tablero en el servidor: **pocas** consultas (tarjetas + `card_balances` + `statement_totals` filtrado + movimientos de los 2 meses para el gasto). Evitar N+1 por tarjeta. Considerar una vista o RPC `dashboard_summary` si hace falta; si se agrega, con prueba pgTAP.
- [ ] `app/(app)/page.tsx` (Server Component) + `components/card-summary.tsx` + `components/dashboard-totals.tsx`.
- [ ] `loading.tsx` con skeletons.
- [ ] Estado vacío: sin tarjetas → CTA "Agrega tu primera tarjeta" que lleva a `/ajustes`.

## Pruebas

- [ ] Vitest: próximo pago con extractos pagados, sin pagar y vencidos; total del mes cuando dos tarjetas vencen en el mismo mes y una en el siguiente; días hasta la fecha límite cruzando fin de mes.

## Verificación

```
pnpm typecheck && pnpm lint && pnpm test && pnpm test:coverage
supabase db reset && supabase test db
pnpm build && pnpm start
```

Comprobaciones manuales con 2 tarjetas de prueba:

- [ ] Cada tarjeta muestra el próximo pago y la fecha límite que coinciden con su página `/tarjetas/[id]`.
- [ ] Cupo disponible y utilización coinciden con `select * from card_balances`.
- [ ] Registrar una compra a 6 cuotas desde el tablero → al volver, el próximo pago y el cupo se actualizan (flujo principal del PRD, paso 5).
- [ ] Marcar un extracto como pagado → deja de contar en "Total a pagar este mes".
- [ ] Gasto del mes frente al anterior coincide con un cálculo manual.
- [ ] Rendimiento: Lighthouse móvil (throttling 4G) en el build de producción o en Vercel → LCP < 1,5 s (meta del PRD). Anotar el resultado en "Notas de progreso".
- [ ] 360 px y modo oscuro correctos.

## Criterios de terminado

- Verificaciones en verde.
- Commit: `feat: add dashboard with card summaries and monthly totals`.

## Notas de progreso

<!-- Fecha — nota -->
