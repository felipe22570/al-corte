# Sistema visual de Al Corte v2

Fuente de verdad del rediseño (H13) junto con `docs/mockups/v2/`. Mientras dure el hito aplica solo a `app/v2` y `components/v2`; al cierre reemplaza a `DESIGN.md` y a la sección "Diseño" de `AGENTS.md`.

## Principios

1. **Un monto protagonista por pantalla.** Responde la pregunta de esa pantalla (cuánto pago, cuánto debo, cuánto cuesta).
2. **Tres niveles de texto y no más:** montos y títulos, texto normal, y etiquetas pequeñas atenuadas.
3. **El color significa algo:** verde es acción o positivo, ámbar es pronto, rojo es problema, y cada tarjeta tiene su color de identidad. Nada decorativo.
4. **Lo estimado se ve distinto:** borde punteado o trama, nunca una frase.
5. **Pesos y dólares nunca se suman:** se muestran juntos como "$1.640.500 y US$ 9,00".
6. **Como máximo una acción principal por pantalla;** las demás son botones secundarios, enlaces o menús. Una pantalla puede no tener acción principal cuando su acción se repite por fila (Inicio y Mes).
7. **Lo que está en cero o vacío no se muestra.** Un campo editable vacío no es un cero: se muestra sin valor y con su ejemplo.
8. **Listas densas tipo tabla,** no una tarjeta grande por fila (salvo "Por confirmar", que llega de a uno o dos al día).

## Color

Modo oscuro (principal) y claro. Los nombres son los tokens a definir en `app/v2/v2.css`.

| Token | Oscuro | Claro | Uso |
| --- | --- | --- | --- |
| `ground` | `#0D1014` | `#EEF1F4` | Fondo de la página y de los campos |
| `surface` | `#151A21` | `#FFFFFF` | Paneles |
| `surface-raised` | `#1D242E` | `#FFFFFF` | Bloque principal, elemento de navegación activo, bloques dentro de un panel |
| `line` | `#222A33` | `#E3E7EC` | Separadores de filas |
| `track` | `#27303B` | `#E3E7EC` | Fondo de barras, etiqueta neutra, opción seleccionada de un selector |
| `field-border` | `#2E3845` | `#D5DAE1` | Borde de campos |
| `strong-border` | `#3A4552` | `#C5CCD6` | Borde de botones secundarios |
| `dashed` | `#5E6A79` | `#8793A2` | Borde punteado y trama de lo estimado |
| `text` | `#F3F5F8` | `#121820` | Texto principal y montos |
| `text-2` | `#AEB7C4` | `#4A5564` | Texto secundario |
| `text-3` | `#8D98A8` | `#5E6979` | Etiquetas y datos de apoyo |
| `primary` | `#3DBE8B` | `#0F6B4F` | Acción principal, enlaces, positivo |
| `on-primary` | `#06140F` | `#FFFFFF` | Texto sobre `primary` |
| `primary-hover` | `#6FD4A9` | `#0A4F3A` | Enlace al pasar el cursor |
| `primary-soft` | `#12352A` | `#DCEFE6` | Fondo de "Nuevo gasto" y de etiquetas positivas |
| `warning` / `warning-soft` | `#F2A14A` / `#3A2A12` | `#9A4507` / `#FBEBD5` | Vence pronto, cambio de precio |
| `danger` / `danger-soft` | `#F2777A` / `#3D1A1B` | `#B42318` / `#FBE4E1` | Vencido, error, acción destructiva |
| `scrim` | `#06080B` | `#121820` al 50 % | Fondo detrás de un diálogo |

**Identidad de tarjeta** (chip, barras, series de gráficos; nunca para estados):

| Clave | Oscuro | Claro |
| --- | --- | --- |
| `card-1` | `#5B9DFF` | `#2F6FDB` |
| `card-2` | `#FFAE5C` | `#E07B1A` |
| `card-3` | `#B9A2FF` | `#7A5FD0` |
| `card-4` | `#5FD3C0` | `#1F9E8B` |
| `card-5` | `#F28CB1` | `#C2417A` |
| `card-6` | `#9AA7B8` | `#5A6878` |

Las claves `card-N` ya guardadas en `cards.color` se conservan; solo cambian sus valores.

**Modo claro pendiente:** con estos valores el bloque principal queda igual a los demás paneles. Antes de implementarlo hay que darle jerarquía propia (por ejemplo, borde o fondo distinto) y validarlo con el dueño.

## Reglas de contenido

Vienen de lo que la app hace hoy; el rediseño no las cambia, salvo el estado de los meses (D65). Precisiones aprobadas por el dueño el 27 de noviembre de 2026 (D66).

**Pagos y extractos**

- **Un pago se registra por extracto y por moneda.** Inicio y Mes no tienen acción principal: "Registrar pago" es un botón secundario en la fila de cada extracto por pagar. En Tarjeta y Extracto sí puede ser la acción principal. Solo se registran pagos de extractos ya cortados.
- **Marcar pagado** es independiente de registrar un pago, se hace por extracto y moneda, y se puede deshacer. Va como acción secundaria o en el menú "···".
- **Un abono a capital** solo nace al registrar un pago con "Otro valor". Su efecto (reducir plazo, por defecto, o reducir cuota) se elige en cada pago; la tarjeta no guarda un efecto por defecto.
- **Pago en dólares con pesos:** se escriben los pesos debitados y la tasa del banco se calcula y se muestra como texto, no como campo. La diferencia cambiaria se muestra en el extracto, no en el formulario.
- **Intereses estimados:** en tarjetas con intereses sobre saldo, mientras el extracto no tenga los intereses del banco (por importación o conciliación), el pago mínimo y la deuda total incluyen una estimación. Ese pago mínimo y esa deuda llevan la etiqueta "Estimado" en Inicio, Mes, Tarjeta y Extracto, y en Conciliar la columna Al Corte la lleva en los intereses.
- **Conciliar:** los intereses de mora no tienen valor calculado. Su fila muestra "—" en Al Corte, el campo del banco vacío con un ejemplo y ningún resultado hasta que se escriba un valor.

**Meses**

- **Estado de un mes (D65):** sale de sus extractos, con esta prioridad: Vencido (alguno real sin marcar y con fecha límite pasada), Por pagar (alguno real ya cortado sin marcar), Abierto (alguno real aún sin cortar), Estimado (alguno que aún no existe), Pagado (todos reales, cortados y marcados). El mes actual sin datos dice "Sin extractos"; los meses pasados sin extractos no se muestran.
- **Comparaciones entre meses** solo entre dos meses seguidos con todos sus extractos reales, cortados y sin cobros previstos, sin verde ni rojo; si no, "Mes en curso", "Estimado" o "Comparación no disponible".
- **Mes de pago y mes de compra no se mezclan.** Movimientos filtra por mes de compra y lo dice en su etiqueta; un mes de pago enlaza a sus extractos, no a esa lista. El dato secundario del mes se llama "Compras de [mes]" y suma lo comprado en ese mes calendario, con ayuda a demanda.
- **"Ya facturado" y "Aún puede crecer"** solo aparecen en el mes actual con extractos abiertos (D19). Un mes con extractos abiertos muestra lo registrado y lo previsto por extracto.

**Deuda y cupo**

- **Dos cifras distintas:** "Deuda total" es la de cada extracto y moneda (Mes, Tarjeta, Extracto). En Inicio, la suma del saldo usado de todas las tarjetas, incluidas las archivadas con saldo, se llama **"Cupo usado"** y se muestra en pesos y en dólares por separado, con ayuda a demanda.

**Registro**

- **Tipo de movimiento:** "Compra · Avance" es un selector visible en Nuevo gasto (un avance cambia la tasa y agrega comisión); los demás tipos (pago, devolución, ajuste, interés, seguro, cuota de manejo) van en "Más opciones".
- **Borradores del correo:** la moneda sugerida por la IA es solo un aviso ("Se factura en dólares"); el formulario conserva el valor y la moneda de la alerta hasta que el dueño los cambie.
- **Cambio de precio de una suscripción:** solo se conoce cuando llega un borrador por correo. No se muestra en la lista de suscripciones.
- **Suscripciones:** el estado (pausar, reactivar, cancelar) solo cambia desde el menú "···"; toda suscripción nueva nace activa.
- **Categorías:** archivar una categoría no tiene vuelta atrás en la app; las archivadas no se listan.
- **La TRM** se carga sola cada día; no se ingresa a mano.

**Etiquetas de estado:** Pagado, Por pagar, Vence en N días, Vencido, Abierto, Estimado, Previsto, Sin extractos, Sin conciliar, Conciliado, Cuadra, Revisar, Supuesto.

## Tipografía

- **Space Grotesk** (500, 600, 700): nombre de la app, títulos y montos.
- **Inter** (400, 500, 600): todo lo demás.
- Montos siempre con `font-variant-numeric: tabular-nums` y alineados a la derecha en listas.

| Estilo | Fuente | Tamaño / interlínea | Uso |
| --- | --- | --- | --- |
| Monto protagonista | Space Grotesk 600 | 56–60 px / 1, tracking −0,025em (38–40 en celular) | El monto de la pantalla |
| Monto grande | Space Grotesk 600 | 40–48 px | Totales de un bloque principal secundario |
| Monto medio | Space Grotesk 600 | 20–32 px | Cifras de resumen |
| Segunda moneda | Space Grotesk 500 | 15–24 px, `text-2` | "y US$ 9,00" junto al monto |
| Título de página | Space Grotesk 600 | 30 px (24 en celular) | Un `h1` por pantalla |
| Título de panel | Inter 600 | 17 px | `h2` |
| Texto | Inter 400 | 14 px / 1,45 (15 en celular) | Filas, campos |
| Apoyo | Inter 400 | 13 px, `text-2` o `text-3` | Fechas, detalles |
| Etiqueta | Inter 600 | 12 px, mayúsculas, tracking 0,06em, `text-3` | Encabezados de columna y de bloque |

## Forma y espacio

- Retícula de 4 px.
- Radios: 6 etiquetas; 9–10 campos y botones; 12 bloques pequeños; 16 paneles; 18 bloque principal. En celular, 12–14 para botones y 16 para paneles.
- Panel: relleno de 24 px (28 en el bloque principal). Separación entre secciones: 24 px.
- Filas: 10–12 px de relleno vertical y separador `line` de 1 px.
- Sin sombras; la profundidad viene del contraste entre `ground`, `surface` y `surface-raised`. Solo los diálogos usan `scrim`.

## Controles

| | Escritorio | Celular |
| --- | --- | --- |
| Botón principal | 40 px | 48–52 px |
| Botón secundario, campo en fila densa | 36 px | 44 px |
| Campo de formulario | 40 px | 44 px, texto de 16 px |
| Área táctil mínima | — | 44 × 44 px |

- **Principal:** fondo `primary`, texto `on-primary`. Como máximo uno por pantalla.
- **Suave:** fondo `primary-soft`, texto `primary` ("Nuevo gasto" en la navegación).
- **Secundario:** borde `strong-border`, fondo transparente.
- **Enlace de acción:** color `primary`, subrayado. Destructivo: color `danger`.
- **Selector de opciones** (2 a 3 opciones): fondo `ground`, opción activa `track`.

## Estructura

- **Escritorio:** navegación lateral de 216–248 px (Inicio, Por confirmar con contador, Tarjetas, Movimientos, Suscripciones, Ajustes) con "Nuevo gasto" arriba. Contenido centrado con ancho máximo de 1120 px; formularios, 860–980 px.
- **Celular:** navegación inferior (Inicio, Tarjetas, botón central de nuevo gasto, Movimientos, Más). Pantallas de detalle con "‹ volver" arriba.
- **Columnas:** rejillas `repeat(auto-fit, minmax(340px, 1fr))`, que pasan a una columna en pantallas angostas. Tablas anchas con scroll horizontal propio.
- **Formularios largos** (tarjeta, nuevo gasto, registrar pago, conciliar) son páginas; **formularios cortos** (suscripción, categoría, cambiar cuotas) son diálogos, con lo poco frecuente en "Más opciones". En celular, un diálogo ocupa la pantalla completa.
- El contenedor de la app debe admitir más adelante un panel lateral derecho para el chat.

## Componentes

Inventario a construir en `components/v2/`, tal como aparecen en los mockups:

- **Estructura:** `AppShell`, `SideNav`, `BottomNav`, `PageHeader` (ruta, título, acciones).
- **Superficies:** `Panel`, `HeroPanel`, `Dialog`, `Alert` (problema, atención, neutro), `Toast`, `EmptyState`, `Skeleton`.
- **Datos:** `Amount` (con segunda moneda y equivalente "≈"), `StatBlock`, `Row` (etiqueta y valor), `DataTable`, `CardDot`, `UtilizationBar`, `StackedBar`, `MonthColumns` (real, abierto y estimado), `InstallmentProgress`.
- **Etiquetas:** `Chip` con variantes pagado, por pagar, atención, problema, estimado (punteado) y neutra.
- **Formulario:** `Field`, `Input`, `Select`, `Stepper`, `Segmented`, `Switch`, `Checkbox`, `AmountInput`, `InfoTip` (ayuda a demanda).
- **Específicos:** `PaymentOption`, `PrepaymentTable`, `DraftCard`, `ReconcileTable`, `ImportReview`.

Iconos de Lucide a 20 px, solo donde aclaran una acción. Sin emojis.

## Textos

1. Un título nombra, no explica: sustantivo de 1 a 3 palabras, sin verbos ni posesivos.
2. Sin subtítulo bajo el título de página.
3. Un concepto, un nombre en toda la app: Pago mínimo, Deuda total, Cupo usado, Por pagar, Previsto, Estimado, Saldo, Cuotas en curso. "Saldo" es el de cada compra; "Cupo usado", el de todas las tarjetas.
4. Lo estimado se marca con la etiqueta "Estimado", no con una frase.
5. Las explicaciones de cálculo van a demanda (`InfoTip`), no como nota permanente.
6. Las ayudas de formulario aparecen solo cuando aplican; el formato esperado va como ejemplo dentro del campo.
7. Una sección vacía no se muestra; los vacíos principales llevan una línea y una acción.
8. Las advertencias se quedan solo si evitan un error o una pérdida, en una línea.
9. Títulos y etiquetas hasta 3 palabras; notas hasta 10.

Formatos: pesos sin decimales (`$1.284.500`), dólares con dos (`US$ 15,99`), fechas cortas (`2 dic`, `mié 2 dic`), periodos con raya (`16 oct – 15 nov`), porcentajes sin decimales.

## Accesibilidad

- Contraste de texto de al menos 4,5:1 en ambos temas.
- Un estado nunca depende solo del color: la etiqueta lleva texto.
- Foco visible en todos los controles; diálogos con foco atrapado y cierre con Escape.
- Barras y gráficos con texto alternativo; tablas con encabezados reales.
