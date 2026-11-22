# Paso 36 — Cuotas y categoría sugeridas por comercio

- **Hito PRD:** H11 (parte 1 de 4)
- **Estado:** 🟡 En progreso
- **Inicio:** 2026-11-21
- **Fin:**
- **Commit:**
- **Depende de:** 35
- **Decisiones aplicables (decididas, ver README):** D15, D34, D53

## Objetivo

Que el formulario de gasto proponga lo que el dueño usó la última vez con ese comercio (F20, R11).

## Contenido

- Dominio (`lib/domain/merchant-suggestions.ts`, funciones puras):
    - `normalizeMerchant(name)`: minúsculas, sin tildes, signos repetidos ni espacios sobrantes; conserva prefijos como "google *" o "dlo*".
    - `suggestFromHistory(merchant, cardId, history)`: la compra o avance confirmado más reciente con ese nombre, primero en la misma tarjeta y luego en cualquier tarjeta activa. Devuelve categoría, cuotas originales, moneda, `is_international`, `interest_free`, fecha y tarjeta de origen, o nada.
- Datos: una consulta liviana de comercios recientes (nombre, fecha y campos sugeribles) para el usuario, limitada a los últimos 12 meses, sin cargar todo el historial en el cliente.
- Formulario de gasto (`components/transaction-form.tsx`):
    - autocompletado del comercio con los nombres recientes;
    - al elegir o terminar de escribir un comercio conocido, aplicar la sugerencia solo a campos que el dueño no ha tocado;
    - "tocado" se lleva en un registro propio de campos cambiados por el dueño (sus `onChange`/`onValueChange`), no con `isDirty`/`dirtyFields` de React Hook Form: el formulario ya marca como sucios valores que pone él mismo (por ejemplo, las cuotas por defecto en USD al cambiar la moneda) y un borrador restaurado también aparece sucio. Los campos de un borrador restaurado cuentan como tocados;
    - aplicar la sugerencia ejecuta los mismos efectos que el cambio manual: si pone USD, también precarga la TRM (D4) e `is_international`; las cuotas por defecto de la tarjeta (D34) solo aplican si la sugerencia no trae cuotas;
    - aviso "Como tu última compra en Netflix (7 nov)" con la opción de quitar la sugerencia, que devuelve los campos sugeridos a su valor anterior.
- Nunca se sugieren valor, fecha ni tarjeta. Sin IA.

## Pruebas

- [x] Normalización: "DLO*NETFLIX.COM", "dlo*netflix.com " y "Dlo*Nétflix.com" son el mismo comercio; "GOOGLE *ChatGPT" y "ChatGPT" no.
- [x] Misma tarjeta antes que otra; la más reciente gana.
- [x] Un campo ya tocado no se sobrescribe, tampoco si viene de un borrador restaurado.
- [x] Las cuotas que puso el cambio a USD (D34) no cuentan como tocadas: una sugerencia con cuotas las reemplaza.
- [x] Sugerir USD precarga la TRM e `is_international` igual que elegirlo a mano; quitar la sugerencia restaura los valores anteriores.
- [x] Recorrido del historial real (prueba de solo lectura o script fuera de git): por cada compra con comercio repetido, predecir con las anteriores y reportar el acierto de categoría y cuotas en las notas. Meta del PRD: 80 %.

## Verificación

```
pnpm typecheck && pnpm lint && pnpm test && pnpm test:coverage
pnpm build && pnpm start
```

- [ ] Registrar un cobro de Netflix y uno de Google en dólares desde el celular, sin cambiar campos sugeridos.

## Criterios de terminado

- Commit: `feat: suggest category and installments by merchant`.

## Notas de progreso

<!-- Fecha — nota -->

- 2026-11-21 — Implementado. Dominio en `lib/domain/merchant-suggestions.ts` (`normalizeMerchant`, `latestByMerchant`, `suggestFromHistory`, `recentMerchantNames`, `merchantHistorySince`). Lógica del formulario sin React en `lib/merchant-suggestion-form.ts` (`applySuggestion`, `revertSuggestion`, `currencyEffects`, `suggestionNotice`); el cambio manual de moneda usa el mismo `currencyEffects`. Consulta en `lib/queries/merchant-history.ts`: compras y avances de tarjetas activas de los últimos 12 meses, reducidos en el servidor a uno por comercio y tarjeta. El embed nombra `cards!transactions_card_id_fkey` porque `transactions` tiene dos relaciones con `cards`. Sin migraciones ni dependencias nuevas; autocompletado con `<datalist>` nativo.
- Decisiones del dueño al aprobar el plan: solo en "Nuevo gasto"; sugerencia del mismo tipo del formulario; cambiar comercio, tarjeta o tipo deshace la sugerencia anterior y aplica la nueva si existe. Menores: "Quitar sugerencia" no vuelve a sugerir ese comercio en el mismo formulario; si el dueño fijó otra moneda, no se copia `is_international` de la sugerencia; una categoría archivada no se sugiere; el aviso nombra la tarjeta cuando la sugerencia viene de otra ("con Visa Bancolombia").
- Pruebas: 13 de dominio (cobertura 100 %), 11 de la lógica del formulario, 8 del formulario en jsdom, 3 de la consulta y 1 de integración local (`AL_CORTE_LOCAL_DB_TEST=1`). Total: 535 de Vitest; `typecheck`, `lint`, `test:coverage` y `build` pasan. No hubo cambios de esquema, así que no se ejecutó `supabase db reset` para conservar la importación local.
- Recorrido del historial real (script fuera de git, sobre la importación de noviembre en Supabase local: 79 compras y avances, 41 con comercio repetido): categoría 41/41 (100 %), cuotas 36/41 (88 %), **categoría y cuotas 36/41 (88 %)**; meta del 80 % cumplida. Los 5 fallos son Mercado Pago y Mercado Libre, con cuotas distintas en cada compra. Conviene repetirlo con una exportación de producción cuando haya más registros manuales.
- Revisión en navegador (`pnpm build && pnpm start` local, 360 px, claro y oscuro): Netflix desde la Mastercard sugiere categoría y 1 cuota de la Visa con su aviso; "chatgpt (google play)" en minúsculas sugiere al salir del campo USD, TRM, 36 cuotas e internacional; "Quitar sugerencia" devuelve COP, sin categoría, 1 cuota y no internacional.
- Pendiente: la verificación desde el celular contra producción (cobro de Netflix y uno de Google en dólares) la hace el dueño después del despliegue.
