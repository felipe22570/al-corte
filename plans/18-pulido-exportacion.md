# Paso 18 — Pulido funcional: estados, accesibilidad y exportación

- **Hito PRD:** H8 (parte 1 de 2)
- **Estado:** ⬜ Pendiente
- **Inicio:** —
- **Fin:** —
- **Commit:** —
- **Depende de:** 17

## Objetivo

Completar lo que el PRD pide para H8 en el plano funcional: estados vacíos, de carga y de error en todas las pantallas, feedback de las acciones, accesibilidad básica y exportación completa de datos a CSV y JSON desde `/ajustes` (PRD sección 10, "Respaldo"). La revisión visual a fondo se hace en el paso 19.

## Tareas

Exportación

- [ ] Route Handler `app/(app)/ajustes/exportar/route.ts` (o `app/api/export/route.ts`) con `?formato=json|csv`, autenticado con el cliente de servidor (RLS; sin `service_role`).
- [ ] JSON: un archivo con todas las tablas del usuario (`cards`, `statements`, `categories`, `transactions`, `installments`, `subscriptions`) y metadatos (`app: 'Al Corte'`, fecha de exportación en Bogotá, versión del esquema).
- [ ] CSV: un `.zip` con un CSV por tabla **o** un CSV por tabla con descargas separadas. Un `.zip` requiere una dependencia (p. ej. `fflate`): si se elige, justificarla; si no, ofrecer un botón por tabla.
- [ ] CSV con BOM UTF-8 (para que Excel muestre tildes), separador `,`, montos como string sin formato (`1234567.00`), fechas `YYYY-MM-DD`.
- [ ] Función pura de serialización CSV en `lib/` con pruebas (comillas, comas y saltos de línea dentro de campos).
- [ ] Sección "Tus datos" en `/ajustes` con botones "Exportar JSON" y "Exportar CSV" (variante `outline`; el primary de `/ajustes` es otro o no hay). Nombres de archivo `al-corte-YYYY-MM-DD.json` y `al-corte-<tabla>-YYYY-MM-DD.csv`.

Estados y feedback

- [ ] Estado vacío (`EmptyState`) en cada lista, con el tono de `AGENTS.md`: tarjetas, movimientos (con y sin filtros), extractos, suscripciones, compras a cuotas activas, gráficos sin datos.
- [ ] `loading.tsx` con skeletons que imitan la forma final (mismas alturas) en las rutas con datos; `error.tsx` en español con "Reintentar".
- [ ] Botones de envío deshabilitados y con indicador mientras se guarda; toasts de éxito y error en todas las acciones (frases cortas, sin "!").
- [ ] Revisar textos: español de Colombia, tuteo, consistentes con el glosario del PRD (extracto, corte, cuota, avance, cuota de manejo, cupo) y con el nombre "Al Corte".

Accesibilidad

- [ ] Labels en todos los campos, `aria-describedby` en errores, foco visible, `aria-label` en botones de solo icono, orden de tabulación lógico, `prefers-reduced-motion` respetado en animaciones.
- [ ] Ningún estado se comunica solo con color (badges siempre con texto).

Limpieza

- [ ] `grep -rnE "console\.log|TODO|FIXME" app components lib` sin resultados no justificados; sin código comentado.
- [ ] `README.md` actualizado: qué es Al Corte (con el lema), requisitos, configuración local, comandos, despliegue, respaldo.

## Verificación

```
pnpm typecheck && pnpm lint && pnpm test && pnpm test:coverage
supabase db reset && supabase test db
pnpm build
grep -rnE "console\.log|TODO|FIXME" app components lib   # vacío o justificado
grep -rnE "\!['\"<]|¡" app components                    # sin exclamaciones en textos de la UI (revisar resultados)
```

Comprobaciones manuales (estados; el aspecto visual se revisa en el paso 19):

| Pantalla | Vacío | Carga | Error | Feedback al guardar |
| --- | --- | --- | --- | --- |
| `/` | | | | n/a |
| `/movimientos` | | | | n/a |
| `/movimientos/nuevo` | n/a | | | |
| `/movimientos/[id]` | n/a | | | |
| `/tarjetas/[id]` | | | | |
| `/tarjetas/[id]/extractos/[cutoff]` | | | | |
| `/suscripciones` | | | | |
| `/ajustes` | | | | |
| `/login` | n/a | n/a | | |

- [ ] Exportar JSON y abrirlo: contiene todas las tablas y el número de filas coincide con `select count(*)` de cada tabla para el usuario.
- [ ] Exportar CSV y abrirlo en Excel/Sheets: tildes correctas, montos sin pérdida de decimales.
- [ ] Sin sesión, la URL de exportación redirige a `/login` o responde 401.
- [ ] Toda la app se puede usar solo con teclado (registrar un gasto, marcar un extracto como pagado).

## Criterios de terminado

- Verificaciones en verde.
- Commit: `feat: add data export, empty states and accessibility fixes`.

## Notas de progreso

<!-- Fecha — nota -->
