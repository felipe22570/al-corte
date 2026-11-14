# Paso 26 — Pulido y validación de H9

- **Hito PRD:** H9 (parte 6 de 6)
- **Estado:** ⬜ Pendiente
- **Inicio:**
- **Fin:**
- **Commit:**
- **Depende de:** 25
- **Decisiones aplicables (decididas, ver README):** D17–D29

## Objetivo

Pulir las vistas nuevas con Impeccable y validar H9 completo con fixtures locales/sintéticos y lecturas autorizadas de datos existentes. No crear ni modificar datos de prueba en producción.

## Tareas

- [ ] `/impeccable critique` de `/` y `/meses/[mes]` contra sus briefs; corregir lo acordado con el dueño.
- [ ] `/impeccable polish` y `/impeccable audit` de las dos vistas (accesibilidad, contraste, responsive).
- [ ] `/impeccable document` para actualizar `DESIGN.md` con los componentes nuevos (fila de mes, franja, alerta, acción compacta de pago). Conservar las reglas y evidencias previas de accesibilidad/responsive; distinguir lo planeado de lo implementado y verificado.
- [ ] Actualizar `PRODUCT.md` si algo del producto cambió durante la implementación.

## Verificación

```
pnpm typecheck && pnpm lint && pnpm test && pnpm test:coverage
supabase db reset && supabase test db
pnpm build && pnpm start
```

- [ ] Con las tarjetas QA, contrastar a mano tres meses: uno anterior, el actual y uno futuro.
- [ ] En los tres, suma de conceptos = categorías = tarjetas = total conocido; parte real coincidente con extractos y previstos identificados aparte. Incluir ajustes, cuotas con interés, devoluciones y "Sin categoría".
- [ ] Mes actual con cobro previsto antes del corte que se paga este mes, conversión a real por cron sin duplicación y USD sin TRM con aviso de total incompleto.
- [ ] Confirmación independiente de abonos: ayuda visible, importe correcto, marcar/desmarcar no libera cupo ni registra pagos y `real_total` no sustituye al calculado.
- [ ] Manejo sin compras ni suscripciones genera horizonte de 12 meses; cuotas/extractos reales posteriores muestran aviso. Actual vacío y todas las tarjetas archivadas conservan navegación e historial.
- [ ] Barra apilada con importes positivos; fallback textual para cero/negativos; categorías con devoluciones negativas y leyendas accesibles. Ninguna comparación de ahorro entre mes abierto/estimado/incompleto y cerrado.
- [ ] Matriz del paso 25 completa: creación, edición, borrado, suscripciones, tarjetas, categorías, cron/TRM y cambio de día no dejan datos obsoletos al navegar.
- [ ] Enlaces históricos directos funcionan sin cargar antes la página correspondiente del inicio; huecos y límites sin enlaces rotos.
- [ ] Rendimiento de `/` en 4G emulado dentro del objetivo del PRD (1,5 s).
- [ ] 360 px y escritorio, claro y oscuro, revisados en producción.
- [ ] Teclado, nombres accesibles contextualizados, IDs únicos, una sola acción primaria, foco tras pago y reflujo de etiquetas/importes largos; no confundir pruebas automatizadas con verificación manual en lector de pantalla.
- [ ] Revisión del dueño en el celular.

## Criterios de terminado

- Verificaciones en verde y Definición de terminado global.
- No cerrar H9 por esta revisión documental: cada paso 21–26 sigue pendiente hasta su propia implementación, aprobación y evidencia.
- H9 marcado como cerrado en `plans/README.md`.
- Commit: `chore: close H9 month view`.

## Notas de progreso

<!-- Fecha — nota -->
