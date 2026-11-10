# Paso 16 — Tablero

- **Hito PRD:** H7 (parte 1 de 2)
- **Estado:** ⬜ Pendiente
- **Inicio:** —
- **Fin:** —
- **Commit:** —
- **Depende de:** 14, 15
- **Decisiones aplicables (decididas, ver README):** D2, D5

## Objetivo

Pantalla `/` (F6): estado de todas las tarjetas activas en una sola vista y los totales globales.

## Contenido

Por tarjeta (activas, no archivadas):

- Franja o chip `bg-card-N` junto al nombre, banco y `•••• 1234`.
- Próximo pago: total del extracto más próximo con `due_date ≥ hoy` y sin `paid_at` (`Money`), y su fecha límite con frase tipo "Pagas $1.284.500 el 2 dic". Estado con `dueTone` del paso 09: warning si faltan 5 días o menos ("Tu Visa vence en 3 días"), danger si está vencido, ok si ya está pagado.
- Cupo disponible y % de utilización con `UtilizationBar` (`rounded-full`): < 30% ok, 30–70% warning, > 70% o sobrecupo danger, siempre con el porcentaje en texto.
- Toda la tarjeta enlaza a `/tarjetas/[id]` (área táctil completa, foco visible).

Totales:

- **Deuda total pendiente:** Σ `used` de `card_balances` (o la definición que se fije en D2).
- **Total a pagar este mes:** Σ de extractos sin pagar con `due_date` dentro del mes calendario actual (Bogotá).
- **Gasto del mes actual frente al anterior:** `monthlySpending` + `compareMonths` (D5), con flecha y % en `text-muted-foreground` (gastar más o menos no es un estado de alerta; sin verde ni rojo).

Jerarquía visual: el **total a pagar este mes** es el monto protagonista (`text-amount-lg`); deuda total y gasto del mes van con `text-amount`. En el celular, la marca "Al Corte" puede ir como encabezado del tablero (decisión de diseño a anotar).

Botón flotante "Nuevo gasto" (ya existe del paso 10): único botón primary de la pantalla.

## Tareas

- [ ] Funciones puras nuevas en `lib/domain/` con pruebas (mantener 100%): selección del "próximo pago" por tarjeta; total a pagar del mes; días hasta la fecha límite.
- [ ] Consulta del tablero en el servidor: **pocas** consultas (tarjetas + `card_balances` + `statement_totals` filtrado + movimientos de los 2 meses para el gasto). Evitar N+1 por tarjeta. Considerar una vista o RPC `dashboard_summary` si hace falta; si se agrega, con prueba pgTAP.
- [ ] `app/(app)/page.tsx` (Server Component) + `components/card-summary.tsx` + `components/dashboard-totals.tsx`.
- [ ] `loading.tsx` con skeletons.
- [ ] Estado vacío: sin tarjetas → "Aún no tienes tarjetas. Agrega la primera." con acción que lleva a `/ajustes`.

## Pruebas

- [ ] Vitest: tono del próximo pago a 6, 5, 0 y −1 días (usa `dueTone` del paso 09);
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
