# Paso 50 — Registrar pago y Conciliar

- **Hito PRD:** H13 (parte 5 de 11)
- **Estado:** ⬜ Pendiente
- **Inicio:**
- **Fin:**
- **Commit:**
- **Depende de:** 49
- **Decisiones aplicables (decididas, ver README):** D37, D38, D39, D56, D66

## Objetivo

Los dos flujos del extracto, ahora como páginas propias.

## Pantallas

| Ruta | Mockup | Notas |
| --- | --- | --- |
| `/v2/tarjetas/[id]/extractos/[cutoff]/pago` | `registrar-pago.html, registrar-pago-dolares.html` | Mínimo, total u otro valor; reparto del abono editable con sus supuestos marcados; en dólares, "Pagué con pesos". |
| `/v2/tarjetas/[id]/extractos/[cutoff]/conciliar` | `conciliar.html` | Al Corte frente al banco, tasa y saldo por compra. |

## Contenido

- Reutilizan las acciones existentes de pagos, abonos y cierre mensual; no cambia ninguna regla (R9, D39).
- Pago: selector de moneda, tres opciones con su valor, indicador "Cubre el mínimo", efecto del abono (reducir plazo o cuota) y resultado por compra, con los supuestos marcados. Solo extractos ya cortados.
- El efecto del abono (reducir plazo por defecto o reducir cuota) se elige en cada pago; la tarjeta no guarda uno.
- Pago en dólares con pesos (D56): se escriben los pesos debitados; la tasa del banco se calcula y se muestra como texto.
- Conciliar: una fila por valor con su resultado ("Cuadra" o la diferencia), intereses estimados reemplazados por el valor del banco, saldo por compra opcional, tasa vigente y "Guardar sin conciliar" como acción secundaria.
- Las explicaciones de cálculo que hoy son notas pasan a `InfoTip`.

### Diferencias con los mockups

Los HTML de `docs/mockups/v2/` no se corrigen. Esta lista manda sobre ellos: lo dibujado que la app no hace no se implementa, y lo que la app hace aunque no esté dibujado se conserva (D59, D66).

| Mockup | Qué cambia al implementar |
| --- | --- |
| `registrar-pago-dolares.html` | "Tasa del banco" no es un campo: es texto calculado a partir de los pesos debitados (`components/statement-payment-form.tsx`). Se quita "Diferencia cambiaria" del formulario; se ve en el extracto. |
| `conciliar.html` | "Intereses de mora": "—" en Al Corte, campo del banco vacío con ejemplo y sin resultado hasta que se escriba un valor (D66: un campo vacío no es un cero). Los intereses de Al Corte llevan "Estimado" cuando aún no hay intereses del banco; que todo diga "Cuadra" solo es posible después de importar el extracto. |

### Sin dibujar

Existe hoy y se conserva con los mismos componentes:

- La página de Conciliar cuando el extracto ya está conciliado, con "Reabrir" (dibujado en `extracto-pagado.html`).

## Verificación

```
pnpm typecheck && pnpm lint && pnpm test && pnpm test:coverage
pnpm build && pnpm start
```


## Criterios de terminado

- Cada pantalla coincide con su mockup a 1440 px, salvo lo indicado en "Diferencias con los mockups" y "Sin dibujar" de este paso, funciona a 360 px sin scroll horizontal y usa datos reales.
- `git diff --stat` no muestra cambios en `app/(app)`, `app/(auth)`, `components/` (fuera de `components/v2`) ni `app/globals.css`.
- Verificaciones en verde.
- Commit: `feat: add v2 payment and reconciliation pages`.

## Notas de progreso

<!-- Fecha — nota -->
