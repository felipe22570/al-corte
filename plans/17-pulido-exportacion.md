# Paso 17 — Pulido: responsive, estados vacíos, modo oscuro y exportación

- **Hito PRD:** H8 — **H8 termina aquí**
- **Estado:** ⬜ Pendiente
- **Inicio:** —
- **Fin:** —
- **Commit:** —
- **Depende de:** 16

## Objetivo

Revisión completa de las 8 pantallas en 360 px y en modo oscuro, estados vacíos, de carga y de error, y exportación completa de datos a CSV y JSON desde `/ajustes` (PRD sección 10, "Respaldo").

## Tareas

Exportación:

- [ ] Route Handler `app/(app)/ajustes/exportar/route.ts` (o `app/api/export/route.ts`) con `?formato=json|csv`, autenticado con el cliente de servidor (RLS; sin `service_role`).
- [ ] JSON: un archivo con todas las tablas del usuario (`cards`, `statements`, `categories`, `transactions`, `installments`, `subscriptions`) y metadatos (fecha de exportación en Bogotá, versión del esquema).
- [ ] CSV: un `.zip` con un CSV por tabla **o** un CSV por tabla con descargas separadas. Un `.zip` requiere una dependencia (p. ej. `fflate`): si se elige, justificarla; si no, ofrecer un botón por tabla.
- [ ] CSV con BOM UTF-8 (para que Excel muestre tildes), separador `,`, montos como string sin formato (`1234567.00`), fechas `YYYY-MM-DD`.
- [ ] Función pura de serialización CSV en `lib/` con pruebas (comillas, comas y saltos de línea dentro de campos).
- [ ] Botones "Exportar JSON" y "Exportar CSV" en `/ajustes`; nombre de archivo `al-corte-YYYY-MM-DD.json`.

Pulido:

- [ ] Recorrer cada pantalla a 360 px, 768 px y 1280 px, en claro y oscuro; corregir desbordes, textos cortados y áreas táctiles < 44 px.
- [ ] Estado vacío en cada lista: tarjetas, movimientos, extractos, suscripciones, compras a cuotas activas.
- [ ] `loading.tsx` con skeletons en las rutas con datos; `error.tsx` en español con "Reintentar".
- [ ] Botones de envío deshabilitados mientras se guarda; toasts de éxito y error en todas las acciones.
- [ ] Revisar textos: español de Colombia, consistentes con el glosario del PRD (extracto, corte, cuota, avance, cuota de manejo, cupo).
- [ ] Accesibilidad básica: labels en todos los campos, foco visible, `aria-label` en botones de solo ícono, contraste en modo oscuro.
- [ ] Limpieza: `grep -rnE "console\.log|TODO|FIXME" app components lib` sin resultados no justificados; sin código comentado.
- [ ] `README.md` actualizado: requisitos, configuración local, comandos, despliegue, respaldo.

## Verificación

```
pnpm typecheck && pnpm lint && pnpm test && pnpm test:coverage
supabase db reset && supabase test db
pnpm build
grep -rnE "console\.log|TODO|FIXME" app components lib   # vacío o justificado
```

Comprobaciones manuales:

- [ ] Checklist por pantalla (marcar cada celda):

| Pantalla | 360 px claro | 360 px oscuro | 1280 px claro | 1280 px oscuro | Vacío | Carga | Error |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `/` | | | | | | | |
| `/movimientos` | | | | | | | |
| `/movimientos/nuevo` | | | | | n/a | | |
| `/movimientos/[id]` | | | | | n/a | | |
| `/tarjetas/[id]` | | | | | | | |
| `/tarjetas/[id]/extractos/[cutoff]` | | | | | | | |
| `/suscripciones` | | | | | | | |
| `/ajustes` | | | | | | | |
| `/login` | | | | | n/a | n/a | |

- [ ] Exportar JSON y abrirlo: contiene todas las tablas y el número de filas coincide con `select count(*)` de cada tabla para el usuario.
- [ ] Exportar CSV y abrirlo en Excel/Sheets: tildes correctas, montos sin pérdida de decimales.
- [ ] Sin sesión, la URL de exportación redirige a `/login` o responde 401.
- [ ] Lighthouse móvil en producción: Accesibilidad ≥ 90, LCP del tablero < 1,5 s.

## Criterios de terminado

- Verificaciones en verde → **H8 terminado**.
- Commit: `feat: add data export and polish responsive and dark mode UI`.
- Etiqueta opcional: `git tag h8`.

## Notas de progreso

<!-- Fecha — nota -->
