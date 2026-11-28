# Paso 51 — Movimientos, detalle y Nuevo gasto

- **Hito PRD:** H13 (parte 6 de 11)
- **Estado:** ⬜ Pendiente
- **Inicio:**
- **Fin:**
- **Commit:**
- **Depende de:** 48
- **Decisiones aplicables (decididas, ver README):** D6, D31, D40, D53, D54, D66

## Objetivo

Consultar y registrar movimientos con la densidad y la rapidez del diseño nuevo.

## Pantallas

| Ruta | Mockup | Notas |
| --- | --- | --- |
| `/v2/movimientos` | `movimientos.html, movimientos-movil.html` | Lista densa por día, filtros en una fila. |
| `/v2/movimientos/[id]` | `movimiento.html, movimiento-historial.html` | Avance de cuotas, plan, costo de diferir y datos; historial del plan y cuotas previas. |
| `/v2/movimientos/nuevo` | `nuevo-gasto.html, nuevo-gasto-movil.html` | Formulario con sugerencia por comercio y resumen "Así queda". |
| `/v2/movimientos/[id]/editar` | `nuevo-gasto.html, editar-movimiento.html` | Mismo formulario; con abonos o pago que cubre un extracto, solo comercio, categoría y nota. |

## Contenido

- "Cambiar cuotas" es un diálogo (`dialogos.html`) y solo aparece si quedan cuotas sin facturar. No hay "Abonar a capital" suelto: un abono solo nace al registrar un pago.
- El filtro de mes dice "Mes de compra"; el de tipo incluye todos los tipos; búsqueda por comercio o nota; "Limpiar filtros" cuando no hay resultados.
- "Compra · Avance" es un selector visible (D66): en los datos reales del 22 de noviembre, 71 de 84 movimientos son compras y 8 son avances, y un avance cambia la tasa y agrega comisión. Los demás tipos, la nota y "Compra internacional" van en "Más opciones".
- La vista previa ("Así queda") muestra cuota, corte y fecha de pago, intereses y total, como hoy.
- En celular, el formulario muestra valor, tarjeta, comercio, categoría, cuotas y fecha; lo demás va en "Más opciones". Campos de 16 px para evitar el zoom de iOS.
- La sugerencia por comercio (D53) se muestra como etiqueta con "Quitar"; nunca cambia campos ya tocados.
- El costo de diferir (D54) aparece en el resumen del formulario y en el detalle, siempre con la etiqueta "Estimado".
- Meta del PRD: registrar un gasto desde el celular en menos de 15 segundos.

### Diferencias con los mockups

Los HTML de `docs/mockups/v2/` no se corrigen. Esta lista manda sobre ellos: lo dibujado que la app no hace no se implementa, y lo que la app hace aunque no esté dibujado se conserva (D59, D66).

| Mockup | Qué cambia al implementar |
| --- | --- |
| `nuevo-gasto.html`, `nuevo-gasto-movil.html` | Sin "Cupo después": la vista previa no lo calcula. El tipo no queda solo en "Más opciones": "Compra · Avance" va a la vista. |
| `movimiento.html`, `movimiento-historial.html` | La tabla de cuotas incluye interés, total y saldo cuando la tarjeta cobra interés en cada cuota, y el equivalente en pesos en compras en dólares (`components/amortization-table.tsx`). Las cuotas previas dicen "Pagada antes de Al Corte" sin extracto (el ejemplo les pone "Julio y agosto"). En el costo de diferir, "Hasta hoy" pasa a "Hasta el último corte" (`components/deferral-cost.tsx`). |

### Sin dibujar

Existe hoy y se conserva con los mismos componentes:

- Compra en dólares: equivalente en pesos y TRM usada, bajo el valor.
- Origen "Suscripción" con enlace, en "Datos".
- Deshacer el último cambio de cuotas: acción en su fila de "Historial".
- Detalle de un pago: "Cubre el extracto del…", tipo y abonos que hizo (resumido en "Pagos y abonos" de `extracto-pagado.html`).
- Comisión de avance e interés de mora: detalle sin "Editar".
- Campos que aparecen según el tipo y la moneda: comisión de un avance; TRM en dólares; cuota actual, saldo y extracto al marcar "Ya pagué cuotas".
- Edición sin restricciones con sus avisos: cuotas en extractos pagados, tarjeta archivada y categoría archivada.
- Borrador del formulario conservado en la pestaña hasta 24 horas, con "Descartar borrador" (en "Editar todo", "Deshacer cambios").

## Verificación

```
pnpm typecheck && pnpm lint && pnpm test && pnpm test:coverage
pnpm build && pnpm start
```


## Criterios de terminado

- Cada pantalla coincide con su mockup a 1440 px, salvo lo indicado en "Diferencias con los mockups" y "Sin dibujar" de este paso, funciona a 360 px sin scroll horizontal y usa datos reales.
- `git diff --stat` no muestra cambios en `app/(app)`, `app/(auth)`, `components/` (fuera de `components/v2`) ni `app/globals.css`.
- Verificaciones en verde.
- Commit: `feat: add v2 transactions list, detail and expense form`.

## Notas de progreso

<!-- Fecha — nota -->
