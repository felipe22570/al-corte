# Paso 47 — Base de v2: estilos, componentes y galería

- **Hito PRD:** H13 (parte 2 de 11)
- **Estado:** ⬜ Pendiente
- **Inicio:**
- **Fin:**
- **Commit:**
- **Depende de:** 46
- **Decisiones aplicables (decididas, ver README):** D58, D60, D61, D62

## Objetivo

Construir el sistema visual nuevo, aislado del actual, y una galería interna para verlo completo antes de hacer pantallas.

## Contenido

- `app/v2/layout.tsx` con un contenedor propio (por ejemplo `data-ui="v2"`), fuentes Space Grotesk e Inter con `next/font/google` y el tema claro u oscuro existente.
- `app/v2/v2.css` con los tokens de `docs/design-v2.md` para oscuro y claro, definidos solo dentro del contenedor de v2. El plan del paso propone cómo exponerlos a Tailwind v4 sin cambiar ningún valor de `app/globals.css` (por ejemplo, utilidades con prefijo propio).
- `components/v2/` con el inventario de `docs/design-v2.md`: estructura, superficies, datos, etiquetas y formulario. Accesibles por teclado; diálogos con foco atrapado.
- `AppShell` con navegación lateral y, en celular, navegación inferior. Debe admitir más adelante un panel lateral derecho.
- `/v2/diseno`: galería con todos los componentes y estados, equivalente a `docs/mockups/v2/estados.html`, en ambos temas.
- Reglas de lint para v2 en `scripts/check-design.mjs` o un script hermano: solo tokens de v2, sin colores literales, sin importar de `components/` fuera de `components/v2`, sin `/v2` escrito a mano en enlaces.
- Los iconos de categoría y las claves `card-N` existentes se reutilizan desde `lib/`.

## Pruebas

- [ ] Componentes con lógica (`Amount`, `Stepper`, `Segmented`, `InstallmentProgress`, proporciones de `StackedBar`) con pruebas.
- [ ] Contraste de texto de al menos 4,5:1 en ambos temas (prueba automática sobre los tokens).

## Verificación

```
pnpm typecheck && pnpm lint && pnpm test && pnpm test:coverage
pnpm build && pnpm start
```

- [ ] `/v2/diseno` coincide con `estados.html` y muestra cada componente en oscuro y claro.
- [ ] La interfaz actual se ve igual que antes (capturas de tres rutas).


## Criterios de terminado

- Galería aprobada por el dueño.
- Commit: `feat: add v2 design tokens, base components and gallery`.

## Notas de progreso

<!-- Fecha — nota -->
