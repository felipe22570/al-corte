# Paso 13 — Detalle, edición y borrado de movimientos

- **Hito PRD:** H4 (parte 2 de 2) — **H4 termina aquí**
- **Estado:** 🟡 En progreso
- **Inicio:** 2026-11-10
- **Fin:** —
- **Commit:** —
- **Depende de:** 12
- **Decisiones aplicables (decididas, ver README):** D3, D6

## Objetivo

Pantalla `/movimientos/[id]` con los datos del movimiento y su tabla de amortización (F3), y edición/borrado con regeneración de cuotas (F2).

## Diseño

- RPC `update_transaction_with_installments(p_id uuid, payload jsonb)`: en una transacción actualiza el movimiento, reasigna su extracto, borra sus cuotas y las regenera, y actualiza o recrea la comisión si es avance. Mismas validaciones de coherencia que la de creación.
- Borrado: `delete from transactions where id = …` → `installments` y la comisión hija caen por `on delete cascade`. Los extractos vacíos se dejan (no afectan totales); anotar la decisión.
- Movimientos generados por suscripción (`source = 'subscription'`): se pueden editar (valor real cobrado) y borrar; al editar el valor, actualizar `subscriptions.last_charged_amount` si es el cobro más reciente. Anotar decisión.
- Movimientos `advance_fee` hijos no se editan solos: se editan desde su avance.

## Tareas

- [x] Migración `update_transaction_rpc`.
- [x] Pruebas pgTAP `060-update-transaction.test.sql`: cambiar de 6 a 3 cuotas deja exactamente 3 cuotas; cambiar la fecha a después del corte mueve todo al siguiente extracto; cambiar tipo de avance a compra elimina la comisión; borrar un avance borra su comisión y sus cuotas; usuario B no puede editar ni borrar.
- [x] Regenerar tipos.
- [x] `lib/actions/transactions.ts`: `updateTransaction`, `deleteTransaction`.
- [x] `app/(app)/movimientos/[id]/page.tsx`: tipo, fecha, comercio, categoría, tarjeta, valor (y USD + TRM si aplica), extracto asignado (enlace), nota, origen.
- [x] Tabla de amortización `components/amortization-table.tsx`: número, extracto, capital, interés, total, saldo; en compras en USD los valores van en USD y se agrega el total estimado en COP por cuota (D3); resalta la cuota actual (fondo `bg-accent` y texto "Cuota actual", no un color de estado) y muestra el progreso con texto ("Te faltan 8 de 12 cuotas") y el saldo pendiente con `installmentProgress`. Montos con `text-amount` alineados a la derecha. En 360 px: lista de filas compactas en vez de tabla ancha.
- [x] El monto protagonista de la pantalla es el valor del movimiento (`Money size="lg"`); tarjeta con `CardColorChip` + nombre + `•••• 1234`; categoría con su icono.
- [x] Editar: reutiliza `transaction-form` con valores iniciales; aviso si hay cuotas en extractos pagados (D6) y aviso de que la tasa congelada se conserva para la misma tarjeta y tipo.
- [x] Borrar: diálogo de confirmación (botón `destructive`) que indica cuántas cuotas y movimientos hijos se borran, con texto calmado ("Se borran la compra y sus 6 cuotas.").
- [x] `notFound()` si el id no existe o no es del usuario.

## Verificación

```
supabase db reset && supabase test db
pnpm typecheck && pnpm lint && pnpm test && pnpm test:coverage
pnpm build
```

Comprobaciones manuales:

- [x] Una compra a 12 cuotas muestra 12 filas; la suma de la columna capital = valor de la compra; último saldo = 0.
- [x] Editar de 12 a 6 cuotas → la tabla muestra 6 filas y en la base hay 6 cuotas.
- [x] Editar la TRM de una compra en USD a cuotas → los valores en USD no cambian y las columnas `_cop` se recalculan.
- [ ] Editar la fecha de un día antes del corte a un día después → el extracto asignado cambia.
- [x] Borrar un avance borra también su comisión.
- [x] Abrir `/movimientos/<uuid-inexistente>` muestra la página 404 en español.
- [x] 360 px y modo oscuro correctos; `pnpm lint` (incluye `check-design`) sin hallazgos.

## Criterios de terminado

- Verificaciones en verde → **H4 terminado**.
- Commit: `feat: add transaction detail, edit and delete with installment regeneration`.
- Etiqueta opcional: `git tag h4`.

## Notas de progreso

2026-11-10 — El dueño aprobó el plan del paso 13: conservar la tasa original cuando se mantienen tarjeta y tipo, y usar la tasa vigente de la nueva selección si cambia cualquiera de ellos. El paso 12 aún tiene una comprobación táctil pendiente.

2026-11-10 — Se agregaron pruebas y soporte en el plan de dominio para seleccionar la tasa original o vigente según esa decisión. Pendientes la RPC, su validación de tasa en la base, las acciones, las pantallas y las verificaciones integrales; la regla todavía no está conectada al flujo de edición.

2026-11-10 — Se agregó una primera versión de la ruta de detalle y la lista adaptable de cuotas, con importes USD y estimados COP, capital pendiente y control de acceso por usuario. Aún no se ha validado en navegador, no ofrece edición ni borrado y no está enlazada desde el historial provisional. Pendientes la RPC y la interfaz de edición/borrado. Pasan tipos, lint y 75 pruebas Vitest.

2026-11-10 — Implementadas localmente la RPC de edición, acciones, formulario de edición, borrado con confirmación y un listado provisional de los 50 movimientos más recientes para acceder al detalle; el historial completo con filtros sigue siendo el paso 17. La RPC conserva el identificador y la tasa aprobada, regenera cuotas y comisiones atómicamente y actualiza el último cobro de suscripciones; se conservan los extractos vacíos. Migración `20261110040000_update_transaction_rpc.sql` aplicada solo en local; tipos regenerados. Pasan 119 pgTAP, `db lint`, tipos, lint, build y 78 Vitest con cobertura de dominio de 100%. En Chrome se creó una compra de 12 cuotas, se mostró el detalle a 360 px, se editó a seis y se borró con confirmación; la cuenta local efímera fue eliminada. La consola registró un error de medición de rendimiento de Next.js en desarrollo y avisos de autocomplete; falta investigar y completar la validación manual de USD, avance, 404, modo oscuro efectivo y la comprobación táctil del paso 12. No se ejecutó un nuevo `db reset` para no borrar datos locales existentes ni se aplicó la migración al remoto sin autorización específica. Paso aún en progreso y sin commit.

2026-11-10 — Con autorización expresa se reinició Supabase local y se aplicó `20261110040000_update_transaction_rpc.sql` al proyecto remoto; `db lint` local y remoto pasan y el remoto no tiene migraciones pendientes. Pasan 123 pgTAP, 78 Vitest, cobertura de dominio 100%, tipos, lint y build. En Chrome a 360 px y tema oscuro se editó la TRM de una compra USD y se mantuvieron las cuotas USD mientras cambiaban los equivalentes COP; se borró un avance y se verificó que también desapareció su comisión; un UUID inexistente mostró el 404 en español. La cuenta de prueba local se eliminó. La consola de desarrollo mostró un error de `performance.measure` de Next.js; al repetir el borrado con la compilación de producción local no aparecieron errores ni avisos. Se agregó tabla de cuotas en escritorio y se formateó la TRM para Colombia. El formulario desplaza «Más opciones» al abrirlo en móvil: el campo de fecha quedó accesible y se pudo cambiar sin guardar accidentalmente. Quedan pendientes la revisión de las casillas y el commit del paso; no se declara H4 terminado todavía.

2026-11-10 — Se comprobó en Chrome móvil la edición de fecha del 10 al 16 de noviembre: el corte cambió del 15 de noviembre al 15 de diciembre después de guardar. La prueba pgTAP cubre específicamente el cambio del día anterior al posterior al corte. La cuenta temporal local se eliminó. La suite completa de base de datos pasa con 124 pruebas y los tipos regenerados coinciden con la base local. Sigue pendiente el commit; los cambios de los pasos 12 y 13 permanecen mezclados en el árbol de trabajo.
