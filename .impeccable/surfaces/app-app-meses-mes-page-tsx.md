---
version: 1
slug: "app-app-meses-mes-page-tsx"
primary_target: "app/(app)/meses/[mes]/page.tsx"
related_targets: []
---

# Detalle de un mes de pago

**Ruta:** `/meses/[mes]` · **Modo:** Operate · **Estado:** dirección aprobada para el paso 22.

## Propósito y dirección

Al abrir un mes, el dueño necesita entender el total calculado o conocido, qué extractos lo componen y por qué conceptos, y confirmar cada extracto real sin confundir esa marca con un abono. Conservar la identidad y los componentes de Al Corte; no introducir una identidad visual nueva. El monto del mes seleccionado es el único protagonista.

## Jerarquía e interacción

1. En el mes actual, si existen vencidos de meses anteriores, mostrar primero una alerta con importe calculado sin descontar abonos y acceso a todos los meses afectados; no sumarlos al mes actual.
2. Encabezado con nombre del mes, navegación a meses disponibles anterior y siguiente, total calculado o «Total conocido», estado textual, «Pendiente de confirmar pago» y cobros previstos separados. Ayuda visible: «Suma de extractos sin marcar como pagados. No descuenta abonos registrados.» Total negativo: «Saldo a favor», nunca una instrucción de pago.
3. En el actual con extractos abiertos, mostrar «Ya facturado» y «Aún puede crecer»; separar dentro del segundo lo registrado en extractos abiertos y lo previsto, con tarjeta y fecha de corte. Las tres cifras conocidas deben cuadrar con el total.
4. Primero los extractos, agrupados por tarjeta. Cada extracto muestra periodo de compras guardado, corte, fecha límite, estado y total; separar registrados y previstos para que el total del bloque cuadre con el mes. Para extractos reales, ofrecer enlace al extracto y acción secundaria compacta para marcar o deshacer pago. El total bancario se consulta o edita solo en el extracto y no reemplaza el calculado. Identificadores únicos y nombres accesibles contextualizados por tarjeta y extracto; no repetir `StatementControls` completo. Los virtuales no llevan enlace ni acción de pago.
5. Después, desglose por concepto en tabla con importes alineados a la derecha: cuotas del periodo, avances y comisiones, intereses independientes, manejo, seguros, ajustes y devoluciones restadas; pagos aparte. El gráfico «Cargos del mes de pago por categoría» usa las mismas partidas, incluye «Sin categoría», valores y signos textuales y eje apto para negativos. Usar `chart-1` a `chart-5` según D17, sin colorear categorías en datos o formularios.
6. Mostrar «Compraste en este mes» como dato secundario claramente separado: corresponde al mes de compra D5, no al total del mes de pago.

La comparación es con el mes calendario anterior y solo cuando ambos tienen datos, están cerrados y no hay proyecciones ni TRM faltante. En otros casos mostrar «Mes en curso», «Estimado» o «Comparación no disponible», sin afirmar ahorro. Bases cero, pequeñas, negativas o porcentajes extremos usan una diferencia monetaria o texto neutro, con las protecciones existentes.

## Estados, ejemplos y límites

- Marcar un extracto pagado sin registrar un abono reduce el pendiente de confirmar, pero no cambia el total, el cupo ni la deuda registrada. Un abono sin marcarlo no reduce ese pendiente.
- Un previsto convertido en real se cuenta una sola vez y conserva el importe, TRM y asignación reales.
- Sin TRM, mostrar «Total conocido», advertencia de incompletitud, cobros USD afectados y acceso para revisar la TRM; no presentar un equivalente COP desconocido como cero ni comparar porcentajes.
- Mes actual vacío: «Sin extractos», sin badge Pagado. Mes futuro: estado «Estimado» y nota «Se sumará lo que gastes antes de cada corte». Conservar extractos e historial de tarjetas archivadas.
- Los enlaces históricos funcionan sin depender de los bloques cargados en inicio. La navegación omite huecos; parámetros inválidos, pasados sin extractos y futuros fuera de la ventana o sin compromisos no muestran un detalle ficticio.

## Layout y entrega posterior

En celular, una columna: resumen, extractos por tarjeta y desgloses; permitir ajuste de importes máximos y etiquetas largas, sin ocultar acciones tras la navegación inferior. En escritorio, usar dos columnas flexibles solo cuando ambas tengan contenido útil: extractos y desgloses pueden convivir, conservando el orden de lectura y sin columnas vacías. Mantener encabezado y contenido en el ancho común, foco visible y objetivos táctiles según `DESIGN.md`.

Reutilizar `Money`, `StatusBadge`, `CardColorChip`, `Alert`, `Button` y los patrones de tabla y gráfico existentes. Sin cambios de código de producto, esquema o dependencias en este brief. Comprobar a 360 px, en escritorio ancho, claro y oscuro, con teclado y con todos los estados anteriores durante la implementación.
