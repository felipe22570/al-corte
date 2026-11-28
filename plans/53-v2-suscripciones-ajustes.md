# Paso 53 — Suscripciones, Ajustes, Importar e inicio de sesión

- **Hito PRD:** H13 (parte 8 de 11)
- **Estado:** ⬜ Pendiente
- **Inicio:**
- **Fin:**
- **Commit:**
- **Depende de:** 51
- **Decisiones aplicables (decididas, ver README):** D35, D55, D61, D66

## Objetivo

Completar las pantallas restantes.

## Pantallas

| Ruta | Mockup | Notas |
| --- | --- | --- |
| `/v2/suscripciones` | `suscripciones.html, dialogos.html` | Agrupadas por tarjeta; alta y edición en diálogo. |
| `/v2/ajustes` | `ajustes.html` | Tarjetas, categorías, captura de alertas, datos, apariencia y cuenta. |
| `/v2/ajustes/tarjetas/nueva` | `nueva-tarjeta.html` | Crear tarjeta, con los mismos bloques que editar; sin "Efecto del abono" (se elige en cada pago). |
| `/v2/ajustes/tarjetas/[id]` | `form-tarjeta.html` | Formulario de tarjeta en página, con ayudas que aparecen solo al cambiar el campo. |
| `/v2/ajustes/importar` | `importar-estados.html, importar.html` | Subir archivo, error, revisión, pagos del archivo sin importar y resultado con enlace a Conciliar. |
| `/login` | `login.html` | Se rediseña en el cambio definitivo; aquí solo se construye como `/v2/login` de prueba si hace falta. |

## Contenido

- Suscripciones: costo al mes y al año, próximo cobro, etiquetas de prueba y cuotas; pausar, reactivar, cancelar y editar en el menú; canceladas plegadas. Sin etiqueta de cambio de precio.
- Suscripción en diálogo (D61, D66): seis campos visibles y "Más opciones" con categoría, inicio, fin de prueba y cuotas; nace activa. En celular ocupa la pantalla completa.
- Ajustes: desarchivar tarjetas, quitar un número de tarjeta alternativo y respaldo en JSON o CSV por tabla.
- Categoría en diálogo. Las ayudas condicionales del formulario de tarjeta aparecen solo cuando se cambia el campo que las motiva.
- Captura de alertas: interruptor, última alerta, otros números de tarjeta y uso de IA del mes. Junto con la TRM vigente y el número de movimientos por categoría, son lecturas nuevas de datos que ya existen.
- Importar: tabla de verificación (banco, antes, después) y grupos de nuevos, ya registrados y en conflicto; pagos del archivo sin importar, ofrecidos para "Registrar pago"; resultado con enlace a Conciliar.

### Diferencias con los mockups

Los HTML de `docs/mockups/v2/` no se corrigen. Esta lista manda sobre ellos: lo dibujado que la app no hace no se implementa, y lo que la app hace aunque no esté dibujado se conserva (D59, D66).

| Mockup | Qué cambia al implementar |
| --- | --- |
| `form-tarjeta.html`, `nueva-tarjeta.html` | Sin "Efecto del abono": la tarjeta no lo guarda; se elige en cada pago. |
| `ajustes.html` | Sin "2 archivadas" en categorías: archivar una categoría no tiene vuelta atrás en la app y las archivadas no se listan. El CSV ofrece las 13 tablas de `lib/export-schema.ts`, no 5. El correo de la cuenta no se muestra hoy: no se agrega sin preguntar al dueño. |
| `dialogos.html` | Sin campo "Estado" en el diálogo de suscripción: nace activa y su estado cambia en el menú "···". |

### Sin dibujar

Existe hoy y se conserva con los mismos componentes:

- Filas de suscripciones pausadas y la lista de canceladas desplegada.

## Verificación

```
pnpm typecheck && pnpm lint && pnpm test && pnpm test:coverage
pnpm build && pnpm start
```


## Criterios de terminado

- Cada pantalla coincide con su mockup a 1440 px, salvo lo indicado en "Diferencias con los mockups" y "Sin dibujar" de este paso, funciona a 360 px sin scroll horizontal y usa datos reales.
- `git diff --stat` no muestra cambios en `app/(app)`, `app/(auth)`, `components/` (fuera de `components/v2`) ni `app/globals.css`.
- Verificaciones en verde.
- Commit: `feat: add v2 subscriptions, settings and import`.

## Notas de progreso

<!-- Fecha — nota -->
