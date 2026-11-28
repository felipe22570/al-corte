# Mockups de Al Corte v2

Referencia visual del rediseño (H13). Son páginas HTML estáticas con estilos en línea y **datos ficticios**: sirven para ver estructura, jerarquía, espaciado y textos, no para copiar su código.

- Abre `index.html` en el navegador para recorrerlas; los enlaces llevan de una a otra.
- Las de escritorio están pensadas para 1440 px de ancho y las de celular para 390 × 844.
- Los valores de color, tipografía y espaciado están en `docs/design-v2.md`. Si un mockup y ese documento no coinciden, manda `docs/design-v2.md` y se avisa de la diferencia.
- **Los mockups cambian la forma, no lo que la app hace** (D59). Si un mockup muestra algo que la app no hace, no se implementa: se anota y se avisa. Ver "Diferencias con la app" al final.
- Las ayudas a demanda aparecen como un botón "i"; su texto está en el atributo `title`.
- Los menús "···" están dibujados abiertos en `estados.html`.
- Las rutas son las previstas mientras v2 vive en `/v2`; al cierre de H13 pasan a la raíz.

| Archivo | Pantalla | Ruta o uso |
| --- | --- | --- |
| [`inicio.html`](inicio.html) | Inicio | `/v2` |
| [`meses.html`](meses.html) | Lista de meses | `/v2/meses` |
| [`mes.html`](mes.html) | Mes de pago (extractos cerrados) | `/v2/meses/[mes]` |
| [`mes-abierto.html`](mes-abierto.html) | Mes con extractos abiertos | `/v2/meses/[mes]` |
| [`mes-futuro.html`](mes-futuro.html) | Mes futuro (estimado) | `/v2/meses/[mes]` |
| [`tarjetas.html`](tarjetas.html) | Tarjetas, con archivadas | `/v2/tarjetas` |
| [`tarjeta.html`](tarjeta.html) | Detalle de tarjeta | `/v2/tarjetas/[id]` |
| [`extracto.html`](extracto.html) | Extracto por pagar | `/v2/tarjetas/[id]/extractos/[cutoff]` |
| [`extracto-pagado.html`](extracto-pagado.html) | Extracto pagado y conciliado | `/v2/tarjetas/[id]/extractos/[cutoff]` |
| [`registrar-pago.html`](registrar-pago.html) | Registrar pago en pesos | `/v2/tarjetas/[id]/extractos/[cutoff]/pago` |
| [`registrar-pago-dolares.html`](registrar-pago-dolares.html) | Registrar pago en dólares | `/v2/tarjetas/[id]/extractos/[cutoff]/pago` |
| [`conciliar.html`](conciliar.html) | Conciliar | `/v2/tarjetas/[id]/extractos/[cutoff]/conciliar` |
| [`movimientos.html`](movimientos.html) | Movimientos | `/v2/movimientos` |
| [`movimiento.html`](movimiento.html) | Detalle de movimiento | `/v2/movimientos/[id]` |
| [`movimiento-historial.html`](movimiento-historial.html) | Detalle con historial y cuotas previas | `/v2/movimientos/[id]` |
| [`nuevo-gasto.html`](nuevo-gasto.html) | Nuevo gasto | `/v2/movimientos/nuevo` |
| [`editar-movimiento.html`](editar-movimiento.html) | Editar movimiento con restricciones | `/v2/movimientos/[id]/editar` |
| [`confirmar-borrador.html`](confirmar-borrador.html) | Confirmar un borrador ("Editar todo") | `/v2/movimientos/nuevo?borrador=[id]` |
| [`por-confirmar.html`](por-confirmar.html) | Por confirmar | `/v2/por-confirmar` |
| [`suscripciones.html`](suscripciones.html) | Suscripciones | `/v2/suscripciones` |
| [`ajustes.html`](ajustes.html) | Ajustes | `/v2/ajustes` |
| [`nueva-tarjeta.html`](nueva-tarjeta.html) | Nueva tarjeta | `/v2/ajustes/tarjetas/nueva` |
| [`form-tarjeta.html`](form-tarjeta.html) | Editar tarjeta | `/v2/ajustes/tarjetas/[id]` |
| [`importar.html`](importar.html) | Importar: revisión | `/v2/ajustes/importar` |
| [`importar-estados.html`](importar-estados.html) | Importar: inicio, error y resultado | `/v2/ajustes/importar` |
| [`login.html`](login.html) | Inicio de sesión | `/login` |
| [`dialogos.html`](dialogos.html) | Diálogos | `Suscripción, cambiar cuotas y categoría` |
| [`estados.html`](estados.html) | Estados, menús y componentes | `Hoja de referencia` |
| [`inicio-movil.html`](inicio-movil.html) | Inicio · celular | `/v2` |
| [`nuevo-gasto-movil.html`](nuevo-gasto-movil.html) | Nuevo gasto · celular | `/v2/movimientos/nuevo` |
| [`tarjeta-movil.html`](tarjeta-movil.html) | Tarjeta · celular | `/v2/tarjetas/[id]` |
| [`mes-movil.html`](mes-movil.html) | Mes · celular | `/v2/meses/[mes]` |
| [`movimientos-movil.html`](movimientos-movil.html) | Movimientos · celular | `/v2/movimientos` |
| [`extracto-movil.html`](extracto-movil.html) | Extracto · celular | `/v2/tarjetas/[id]/extractos/[cutoff]` |
| [`por-confirmar-movil.html`](por-confirmar-movil.html) | Por confirmar · celular | `/v2/por-confirmar` |
| [`inicio-claro.html`](inicio-claro.html) | Inicio · modo claro | `/v2` |
| [`tarjeta-claro.html`](tarjeta-claro.html) | Tarjeta · modo claro | `/v2/tarjetas/[id]` |

## Diferencias con la app

Los HTML no se corrigen. Se revisaron contra el código el 27 de noviembre de 2026, y cada paso del plan (48 a 54) lista en sus secciones "Diferencias con los mockups" y "Sin dibujar" lo que cambia al implementar su pantalla y lo que la app hace aunque no esté dibujado. Esas listas y las reglas de contenido de `docs/design-v2.md` mandan sobre los mockups.
