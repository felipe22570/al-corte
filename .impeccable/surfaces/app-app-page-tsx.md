---
version: 1
slug: "app-app-page-tsx"
primary_target: "app/(app)/page.tsx"
related_targets: []
---

# Inicio: lista de meses

**Ruta:** `/` · **Modo:** Operate · **Estado:** dirección aprobada para el paso 22.

## Propósito y dirección

El dueño revisa cuánto corresponde al mes de pago actual y qué extractos requieren atención; desde cada mes puede abrir su detalle. Conservar la identidad de Al Corte: el importe manda, las superficies se separan con bordes y el color tiene significado. No introducir una identidad, ilustraciones ni indicadores de éxito decorativos.

## Jerarquía e interacción

1. Alerta de extractos vencidos de meses anteriores, solo cuando existan: total calculado, aclaración de que no descuenta abonos y enlace a cada mes afectado. No añadir esos importes al mes actual.
2. Mes actual destacado, con el único importe protagonista, estado textual y enlace a su detalle. Identificar por separado los cobros previstos; el actual con previstos no se llama «Estimado».
3. Franja compacta de tarjetas activas, desplazable horizontalmente en móvil: nombre o últimos cuatro dígitos, cupo disponible y utilización, cada tarjeta enlazada a su detalle. La deuda total registrada es secundaria e incluye saldos de archivadas, sin proyecciones ni límite de horizonte.
4. Próximos meses ascendentes, con estado «Estimado»; después, meses anteriores descendentes, cargados en bloques de 12 meses con extractos. Cada fila completa es un enlace con foco visible y destino identificable.

Cada mes muestra nombre, total calculado o «Total conocido», estado, cobros previstos por separado y composición por tarjeta. Si el pendiente difiere del total, mostrar «Pendiente de confirmar pago» como línea secundaria; donde se presente, mantener visible la ayuda: «Suma de extractos sin marcar como pagados. No descuenta abonos registrados.» No usar «Falta por pagar».

La barra apilada comunica composición dentro del mes, no magnitud entre meses. Incluye leyenda textual con nombre o últimos cuatro dígitos e importe. Si el total no es positivo o alguna tarjeta tiene subtotal negativo, sustituirla por importes firmados; identificar el total negativo como «Saldo a favor».

## Estados, ejemplos y límites

- Un extracto confirmado sin abono deja de integrar el pendiente, sin cambiar el total ni liberar cupo; un abono sin confirmar no reduce el pendiente.
- Un cobro previsto que se convierte en real aparece una sola vez: prevalecen el valor y la asignación guardados.
- Sin TRM para un cobro previsto USD, conservar su importe original, presentar «Total conocido» con aviso de estimación incompleta, detalle afectado y acceso para revisar la TRM; no mostrar COP desconocidos como cero.
- Actual vacío: «Sin extractos», sin estado Pagado. Sin tarjetas activas, conservar historial, compromisos reales y deuda registrada. Ofrecer acceso a Ajustes si no hay tarjetas.
- El horizonte futuro comprende hasta 12 meses de pago y puede existir solo por manejo. Avisar de cuotas o extractos reales posteriores sin sugerir que allí termina la deuda.

## Entrega posterior y verificación

Reutilizar `Alert`, `StatusBadge`, `CardColorChip`, `UtilizationBar`, `Money` y `Button` según los contratos existentes. Mantener «Nuevo gasto» en el patrón del shell, sin introducir un segundo primario. En escritorio usar el ancho común centrado y evitar columnas vacías; a 360 px permitir el ajuste de importes y etiquetas, reservar espacio para navegación y acción fija, y preservar el área táctil. Verificar claro y oscuro, teclado y puntero grueso en los pasos de implementación. No modificar UI ni esquema en este brief.
