# Paso 22 — Brief de diseño de la vista por meses

- **Hito PRD:** H9 (parte 2 de 6)
- **Estado:** ⬜ Pendiente
- **Inicio:**
- **Fin:**
- **Commit:**
- **Depende de:** 21
- **Decisiones aplicables (decididas, ver README):** D17–D29

## Objetivo

Definir con Impeccable cómo se ven la lista de meses (`/`) y el detalle de un mes (`/meses/[mes]`) **antes** de construirlas, para no implementar dos veces. Este paso no escribe código de producto.

## Tareas

- [ ] Ejecutar `/impeccable shape` para la pantalla de inicio (lista de meses), con el prompt del dueño.
- [ ] Ejecutar `/impeccable shape` para el detalle de un mes.
- [ ] Revisar con el dueño los dos briefs guardados en `.impeccable/surfaces/` y anotar ajustes.
- [ ] Confirmar que los briefs no contradicen R7, D18–D29, `DESIGN.md` ni `scripts/check-design.mjs`. Si lo hacen, manda el PRD y se corrige el brief.

## Contenido mínimo de cada brief

Lista de meses:

- Jerarquía: mes actual destacado con su total como monto protagonista; próximos y anteriores como filas compactas.
- Fila: nombre, total calculado o "Total conocido", "Pendiente de confirmar pago" con ayuda de D26, cobros previstos separados, barra apilada por tarjeta (`card-N`) y estado textual.
- La barra representa composición, no magnitud entre meses; con total no positivo o subtotal de tarjeta negativo se sustituye por importes firmados, sin dividir por cero. Leyenda textual con nombre/últimos cuatro dígitos, no dependencia de hover o color.
- Alerta de vencidos arriba de todo con acceso a cada mes afectado; franja compacta de tarjetas con cupo y utilización; deuda total registrada secundaria; acción "Nuevo gasto".
- Diferenciar un mes futuro Estimado del actual con previstos; aviso visible de TRM faltante y de cuotas/extractos reales posteriores al horizonte.
- Actual vacío sin estado Pagado; conservar historial si todas las tarjetas están archivadas.
- Comportamiento a 360 px y en escritorio ancho, sin columnas vacías.

Detalle de mes:

- Encabezado con total calculado o conocido, pendiente de confirmar pago (no saldo tras abonos), cobros previstos separados, estado, comparación elegible y navegación entre meses disponibles.
- "Ya facturado" frente a "Aún puede crecer" en el actual, separando registrado y previsto; permitir entender de dónde sale el total.
- Bloque por tarjeta con cada extracto real y acción secundaria de marcar/deshacer pago. No repetir `StatementControls` completo: IDs únicos y nombres accesibles contextualizados; total bancario solo en el extracto. Sin acción ni enlace de extracto para virtuales.
- Desglose por concepto como tabla (incluye ajustes); gráfico "Cargos del mes de pago por categoría" (D17, D28), con cuotas del periodo, "Sin categoría", devoluciones negativas y valores textuales.
- Comparaciones solo entre meses cerrados comparables; actual abierto, futuro o TRM faltante no se presentan como ahorro. Mensajes neutros para bases no significativas.
- Dato secundario "Compraste en este mes" claramente separado del total a pagar.
- Mes futuro: nota de estimado sin alarmismo.
- Totales negativos con "Saldo a favor", sin presentarlos como pago requerido; etiquetas largas, importes máximos y estados incompletos legibles a 360 px.

## Verificación

- [ ] Los dos briefs existen y el dueño los aprobó.
- [ ] No hay cambios en `app/`, `components/` ni `lib/`.
- [ ] Los briefs incluyen ejemplos de pago confirmado sin abono, abono sin confirmar, previsto convertido a real y USD sin TRM, sin cambiar el significado de D26.

## Criterios de terminado

- Commit: `docs: add design briefs for month views`.

## Notas de progreso

<!-- Fecha — nota -->
