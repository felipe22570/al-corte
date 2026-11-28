# Paso 49 — Tarjetas, Tarjeta y Extracto

- **Hito PRD:** H13 (parte 4 de 11)
- **Estado:** ⬜ Pendiente
- **Inicio:**
- **Fin:**
- **Commit:**
- **Depende de:** 48
- **Decisiones aplicables (decididas, ver README):** D31, D32, D33, D52, D61, D65, D66

## Objetivo

La sección nueva "Tarjetas": todo lo que pasa en cada tarjeta, en un solo lugar.

## Pantallas

| Ruta | Mockup | Notas |
| --- | --- | --- |
| `/v2/tarjetas` | `tarjetas.html` | Lista con próximo pago, cupo, deuda total y extracto abierto; archivadas con "Desarchivar". |
| `/v2/tarjetas/[id]` | `tarjeta.html, tarjeta-movil.html` | Resumen, extracto abierto agrupado, suscripciones, cuotas en curso y extractos. |
| `/v2/tarjetas/[id]/extractos/[cutoff]` | `extracto.html, extracto-pagado.html, extracto-movil.html` | Por pagar, y pagado y conciliado: valores del banco, pagos por moneda, dólares pagados con pesos y "Reabrir". |

## Contenido

- Extracto abierto agrupado en compras nuevas, cuotas, suscripciones (cobradas y previstas antes del corte) e intereses estimados; la suma coincide con el total del extracto.
- Cuotas en curso: avance (3 de 9), cuota, saldo y fecha de fin; "Última cuota" cuando aplica.
- Extractos como columnas por mes con real, abierto y estimado.
- En celular, extracto abierto, cuotas y suscripciones son pestañas.
- El cupo usa la TRM vigente (D52) sin nota permanente; el detalle va en ayuda a demanda.
- Extracto: pesos y dólares por separado, "Marcar pagado" y "Deshacer pagado" por moneda, ahorro estimado por pagar el total, valores del banco, pagos y abonos registrados, navegación al extracto anterior y siguiente y enlace a su mes de pago.
- **Intereses estimados (D66):** mientras el extracto no tenga los intereses del banco, el pago mínimo y la deuda total que los incluyen llevan la etiqueta "Estimado" en Tarjetas, Tarjeta y Extracto (hoy: "Incluye intereses estimados").
- La diferencia cambiaria y lo pagado en pesos se muestran en el extracto (D56), no en el formulario de pago.

### Diferencias con los mockups

Los HTML de `docs/mockups/v2/` no se corrigen. Esta lista manda sobre ellos: lo dibujado que la app no hace no se implementa, y lo que la app hace aunque no esté dibujado se conserva (D59, D66).

| Mockup | Qué cambia al implementar |
| --- | --- |
| `tarjetas.html`, `tarjeta.html`, `tarjeta-movil.html`, `tarjeta-claro.html`, `extracto.html`, `extracto-movil.html` | Ninguno muestra "Estimado" en el pago mínimo o la deuda total con intereses estimados: se agrega cuando aplica. En `extracto.html` los intereses ya son reales porque hay un cargo registrado. |

### Sin dibujar

Existe hoy y se conserva con los mismos componentes:

- Aviso de cupo calculado sin TRM vigente: cambia el texto de la ayuda a demanda.
- Destino de "Ver anteriores": la misma sección cargando 12 extractos más.
- Diferencia entre el valor calculado y el del banco cuando supera el redondeo (solo está dibujado "Cuadra").
- Extracto abierto o sin movimientos como página: el estado está en `estados.html` ("Podrás registrar pagos cuando corte").

## Verificación

```
pnpm typecheck && pnpm lint && pnpm test && pnpm test:coverage
pnpm build && pnpm start
```


## Criterios de terminado

- Cada pantalla coincide con su mockup a 1440 px, salvo lo indicado en "Diferencias con los mockups" y "Sin dibujar" de este paso, funciona a 360 px sin scroll horizontal y usa datos reales.
- `git diff --stat` no muestra cambios en `app/(app)`, `app/(auth)`, `components/` (fuera de `components/v2`) ni `app/globals.css`.
- Verificaciones en verde.
- Commit: `feat: add v2 cards section and statement view`.

## Notas de progreso

<!-- Fecha — nota -->
