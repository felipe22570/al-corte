# Paso 52 — Por confirmar

- **Hito PRD:** H13 (parte 7 de 11)
- **Estado:** ⬜ Pendiente
- **Inicio:**
- **Fin:**
- **Commit:**
- **Depende de:** 51
- **Decisiones aplicables (decididas, ver README):** D44, D45, D46, D47, D66

## Objetivo

La bandeja de movimientos capturados por correo, con corrección rápida de nombre y cuotas.

## Pantallas

| Ruta | Mockup | Notas |
| --- | --- | --- |
| `/v2/por-confirmar` | `por-confirmar.html, por-confirmar-movil.html` | Una tarjeta por borrador con nombre, cuotas y categoría editables. |
| `/v2/movimientos/nuevo?borrador=[id]` | `confirmar-borrador.html` | "Editar todo": formulario precargado con la alerta, "Se factura en dólares" y TRM. |

## Contenido

- "Confirmar" a un toque guarda con los valores visibles; nombre y cuotas se corrigen en el mismo borrador. "Editar todo", "Es el mismo" y "Descartar" van en el menú.
- Casos dibujados: suscripción con cambio de precio, comercio con historial, posible duplicado con varios candidatos (acción principal "Es el mismo") y tarjeta no registrada con el estado "Revisar".
- La frase del correo y la razón de la sugerencia de IA se ven a demanda; cada borrador indica a qué extracto iría.
- Se conserva el registro de campos corregidos (`changed_fields`) y el borrado de la frase original al confirmar o descartar.
- El contador de la navegación y la línea de "Para atender" usan el mismo cargador.
- En celular la categoría va en el menú para que cada borrador quepa sin scroll.

### Diferencias con los mockups

Los HTML de `docs/mockups/v2/` no se corrigen. Esta lista manda sobre ellos: lo dibujado que la app no hace no se implementa, y lo que la app hace aunque no esté dibujado se conserva (D59, D66).

| Mockup | Qué cambia al implementar |
| --- | --- |
| `confirmar-borrador.html` | El valor queda en COP 81.000, como la alerta, con el aviso "Se factura en dólares": la moneda sugerida nunca convierte el valor ni cambia la moneda (`lib/draft-form.ts`, R10). La TRM aparece solo si el dueño cambia a USD. Lo mismo vale para "Confirmar" a un toque. |
| `por-confirmar.html` | "Es mi Visa ···· 4521" solo asigna la tarjeta al borrador; no crea un número alternativo (eso se hace en Ajustes). |

## Verificación

```
pnpm typecheck && pnpm lint && pnpm test && pnpm test:coverage
pnpm build && pnpm start
```


## Criterios de terminado

- Cada pantalla coincide con su mockup a 1440 px, salvo lo indicado en "Diferencias con los mockups" y "Sin dibujar" de este paso, funciona a 360 px sin scroll horizontal y usa datos reales.
- `git diff --stat` no muestra cambios en `app/(app)`, `app/(auth)`, `components/` (fuera de `components/v2`) ni `app/globals.css`.
- Verificaciones en verde.
- Commit: `feat: add v2 drafts inbox`.

## Notas de progreso

<!-- Fecha — nota -->
