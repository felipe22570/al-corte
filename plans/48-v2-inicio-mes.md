# Paso 48 — Navegación, Inicio y Mes

- **Hito PRD:** H13 (parte 3 de 11)
- **Estado:** ⬜ Pendiente
- **Inicio:**
- **Fin:**
- **Commit:**
- **Depende de:** 47
- **Decisiones aplicables (decididas, ver README):** D18, D19, D23, D33, D61, D65, D66

## Objetivo

Las dos pantallas que responden "cuánto pago y cuándo", sobre la navegación nueva.

## Pantallas

| Ruta | Mockup | Notas |
| --- | --- | --- |
| `/v2` | `inicio.html, inicio-movil.html` | Próximo pago como protagonista, reparto por tarjeta, cupo, "Para atender" y meses. |
| `/v2/meses` | `meses.html` | Mes actual, próximos hasta 12 meses y anteriores de 12 en 12; aviso de cuotas más allá del horizonte. |
| `/v2/meses/[mes]` | `mes.html, mes-abierto.html, mes-futuro.html, mes-movil.html` | Extractos cerrados, mes con extractos abiertos y mes futuro estimado. |

## Contenido

### Estado de los meses (D65): primero, en el dominio

- Va en `lib/domain/months.ts`, con las pruebas escritas antes del código.
- El estado de un mes sale de sus extractos con esta prioridad: Vencido, Por pagar (real cortado sin marcar), Abierto (real sin cortar), Estimado (virtual), Pagado (todos reales, cortados y marcados). El mes actual sin datos sigue en "Sin extractos" y los pasados sin extractos se omiten.
- `monthComparison` deja de excluir los meses posteriores al actual: compara dos meses seguidos con extractos, todos reales y cortados y sin proyección (D29 sin cambios en lo demás).
- Afecta también la interfaz actual, que muestra el estado y la comparación que da el dominio: es una corrección compartida (D59). Ajustar las etiquetas de `lib/month-status.ts` si hace falta un estado nuevo, sin tocar componentes de v1.
- Pruebas: con hoy 22 de noviembre y tarjetas de corte 15 y pago 2, diciembre (cortado, sin marcar) es Por pagar y se compara con noviembre; enero con extractos reales abiertos es Abierto; febrero solo con extractos virtuales es Estimado; un mes con uno cortado sin marcar y otro abierto es Por pagar; un mes con uno real y otro virtual es Abierto; un mes vencido; actual vacío "Sin extractos"; un mes posterior con previstos no es comparable.

### Pantallas

- El próximo pago es el del mes de pago más cercano con saldo por pagar (R7); si hay vencidos, van primero en "Para atender".
- "Para atender" reúne: borradores por confirmar (incluidos los que traen un cambio de precio de una suscripción), extractos sin conciliar y pagos vencidos o por vencer. Cada línea lleva a su pantalla. No hay cambios de precio fuera de los borradores.
- Columnas de meses: pagado, por pagar, abierto y estimado (D65), con trama para lo estimado. Tabla compacta debajo.
- Inicio y Mes no tienen acción principal (D66): "Registrar pago" es un botón secundario en la fila de cada extracto por pagar; "Marcar pagado" y "Deshacer" van en su menú "···".
- **Cupo usado (D66):** el bloque de tarjetas de Inicio muestra "Cupo usado" con `cop_used` y `usd_net` de `card_balances` sumados por moneda, de todas las tarjetas, incluidas las archivadas con saldo; ayuda a demanda con esa aclaración. No es la suma de la deuda por extracto.
- **Intereses estimados (D66):** el pago mínimo y la deuda total que incluyen intereses estimados llevan la etiqueta "Estimado".
- Mes: solo los conceptos y categorías con valor; "Sin categoría" es un dato, sin acción. Cargos en dólares por concepto aparte, con su equivalente en pesos como referencia. Ahorro estimado por pagar la deuda total, por extracto.
- El mes no lista movimientos (Movimientos filtra por mes de compra); enlaza a los extractos de cada tarjeta.
- El dato secundario del mes es "Compras de [mes]" (lo comprado en ese mes calendario, D5), con ayuda a demanda.
- En un mes con extractos que aún no existen no hay acciones de pago para ellos.

### Diferencias con los mockups

Los HTML de `docs/mockups/v2/` no se corrigen. Esta lista manda sobre ellos: lo dibujado que la app no hace no se implementa, y lo que la app hace aunque no esté dibujado se conserva (D59, D66).

| Mockup | Qué cambia al implementar |
| --- | --- |
| `inicio.html`, `inicio-movil.html`, `inicio-claro.html` | "Deuda total $8.026.100 y US$ 148,20" pasa a "Cupo usado", calculado como arriba; el valor del ejemplo era la suma de la deuda por extracto. |
| `inicio.html`, `meses.html`, `mes.html`, `mes-abierto.html`, `mes-futuro.html`, `mes-movil.html` | Los estados y la comparación salen de D65; coinciden con lo dibujado. Ningún mockup muestra "Estimado" en un pago mínimo con intereses estimados: se agrega cuando aplica. |
| `meses.html` | La fila "Agosto 2026 · Sin extractos" no se muestra: los meses pasados sin extractos se omiten. |
| `mes.html` | "Compras del periodo" pasa a "Compras de diciembre", con lo comprado en diciembre (el ejemplo muestra las compras de noviembre). |

### Sin dibujar

Existe hoy y se conserva con los mismos componentes:

- Extractos vencidos en "Para atender": misma fila que las demás, con el monto y un enlace al mes afectado (la alerta está en `estados.html`).
- Bloque principal de Inicio cuando el mes actual no tiene extractos ("Sin extractos").
- "Pendiente de confirmar pago" en el bloque principal del mes, con ayuda a demanda, solo cuando difiere del total; "Marcado como pagado", solo cuando hay extractos marcados.
- "Saldo a favor" cuando el total del mes es negativo (R7).
- "Abonos registrados": una fila aparte al final de "Por concepto", solo cuando existen.
- Alerta de TRM faltante dentro del mes, con "Ver detalle" (dibujada en `estados.html`).
- "Ya facturado" junto a "Aún puede crecer": solo en el mes actual con extractos abiertos (D19), algo que no pasa con tarjetas de corte 15 y pago 2. Usa el formato de `mes-abierto.html` y se prueba con una tarjeta que corta y vence en el mismo mes.
- Comparación "no disponible".

## Verificación

```
pnpm typecheck && pnpm lint && pnpm test && pnpm test:coverage
pnpm build && pnpm start
```


## Criterios de terminado

- Cada pantalla coincide con su mockup a 1440 px, salvo lo indicado en "Diferencias con los mockups" y "Sin dibujar" de este paso, funciona a 360 px sin scroll horizontal y usa datos reales.
- `git diff --stat` no muestra cambios en `app/(app)`, `app/(auth)`, `components/` (fuera de `components/v2`) ni `app/globals.css`.
- Verificaciones en verde.
- Commit: `feat: add v2 home and payment-month views`.

## Notas de progreso

<!-- Fecha — nota -->
