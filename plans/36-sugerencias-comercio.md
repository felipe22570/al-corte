# Paso 36 — Cuotas y categoría sugeridas por comercio

- **Hito PRD:** H11 (parte 1 de 4)
- **Estado:** ⬜ Pendiente
- **Inicio:**
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

- [ ] Normalización: "DLO*NETFLIX.COM", "dlo*netflix.com " y "Dlo*Nétflix.com" son el mismo comercio; "GOOGLE *ChatGPT" y "ChatGPT" no.
- [ ] Misma tarjeta antes que otra; la más reciente gana.
- [ ] Un campo ya tocado no se sobrescribe, tampoco si viene de un borrador restaurado.
- [ ] Las cuotas que puso el cambio a USD (D34) no cuentan como tocadas: una sugerencia con cuotas las reemplaza.
- [ ] Sugerir USD precarga la TRM e `is_international` igual que elegirlo a mano; quitar la sugerencia restaura los valores anteriores.
- [ ] Recorrido del historial real (prueba de solo lectura o script fuera de git): por cada compra con comercio repetido, predecir con las anteriores y reportar el acierto de categoría y cuotas en las notas. Meta del PRD: 80 %.

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
