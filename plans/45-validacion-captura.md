# Paso 45 — Validación de H12

- **Hito PRD:** H12 (parte 6 de 6)
- **Estado:** ⬜ Pendiente
- **Inicio:**
- **Fin:**
- **Commit:**
- **Depende de:** 40 a 44, desplegados
- **Decisiones aplicables (decididas, ver README):** D42–D47

## Objetivo

Comprobar en producción que la captura funciona, que es segura y que no altera ningún cálculo hasta confirmar.

## Verificación

- [ ] Una semana de uso real: porcentaje de alertas de tarjeta de crédito que llegan como borrador y porcentaje confirmado sin cambios. Anotar en las notas.
- [ ] Seguridad:
    - [ ] solicitud sin firma o con firma vieja rechazada;
    - [ ] repetir una solicitud válida no crea otro borrador;
    - [ ] un correo reenviado por otra persona con el texto de una alerta no pasa el filtro DKIM;
    - [ ] ningún log contiene frases de alertas ni respuestas del modelo;
    - [ ] apagar la captura desde Ajustes rechaza nuevas solicitudes;
    - [ ] rotar el secreto con el procedimiento documentado (Vercel, despliegue y script) invalida el anterior (D51).
- [ ] Ningún borrador pendiente cambia totales, meses ni cupo.
- [ ] Gasto de IA del periodo dentro del tope.
- [ ] `pnpm test:ai` con resultados anotados.
- [ ] Revisión del dueño en el celular, de la alerta a la confirmación.

## Criterios de terminado

- H12 marcado como cerrado en `plans/README.md`.
- Commit: `chore: close H12 email capture`.

## Notas de progreso

<!-- Fecha — nota -->
