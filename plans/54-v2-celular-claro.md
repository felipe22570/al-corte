# Paso 54 — Celular, modo claro y estados

- **Hito PRD:** H13 (parte 9 de 11)
- **Estado:** ⬜ Pendiente
- **Inicio:**
- **Fin:**
- **Commit:**
- **Depende de:** 48 a 53
- **Decisiones aplicables (decididas, ver README):** D60, D62, D66

## Objetivo

Una pasada completa de todo v2 en celular, en modo claro y en sus estados vacíos, de carga y de error.

## Contenido

- **Celular (360 a 430 px):** todas las rutas, no solo las dibujadas. Navegación inferior, áreas táctiles de 44 px, tablas con scroll propio, formularios en una columna con la acción fija abajo.
- **Modo claro:** antes de implementarlo, proponer al dueño la jerarquía del bloque principal (en la traducción directa queda igual a los demás paneles) y validar `inicio-claro.html` y `tarjeta-claro.html` ajustados. Luego aplicarlo a todas las rutas.
- **Estados:** vacío principal y de lista, carga con esqueleto acorde a cada pantalla, error con reintento y alertas, según `estados.html`.
- **Textos:** revisión de todas las pantallas contra las nueve reglas; listar cualquier texto visible de más de 10 palabras y justificarlo.
- **Accesibilidad:** foco visible, orden de tabulación, lectores de pantalla en tablas y gráficos, contraste en ambos temas.

### Diferencias con los mockups

Los HTML de `docs/mockups/v2/` no se corrigen. Esta lista manda sobre ellos: lo dibujado que la app no hace no se implementa, y lo que la app hace aunque no esté dibujado se conserva (D59, D66).

- `inicio-claro.html` y `tarjeta-claro.html` tienen las mismas diferencias que sus versiones oscuras (pasos 48 y 49).

### Sin dibujar

- En celular: las pantallas nuevas (`meses`, `mes-abierto`, `mes-futuro`, `extracto-pagado`, `movimiento-historial`, `editar-movimiento`, `confirmar-borrador`, `nueva-tarjeta`, `importar-estados`) y Suscripciones, Ajustes, Conciliar, Registrar pago, Importar y los formularios.
- El resto de pantallas en modo claro.
- El panel del chat con IA no es parte de H13: el contenedor solo debe admitirlo más adelante.

## Verificación

```
pnpm typecheck && pnpm lint && pnpm test && pnpm test:coverage
pnpm build && pnpm start
```

- [ ] Capturas de cada ruta a 360 y 1440 px, en oscuro y claro, anotadas en las notas.
- [ ] Revisión del dueño en su celular.


## Criterios de terminado

- Verificaciones en verde y revisión del dueño aprobada.
- Commit: `feat: complete v2 mobile, light theme and states`.

## Notas de progreso

<!-- Fecha — nota -->
