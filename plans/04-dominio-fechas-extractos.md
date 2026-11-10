# Paso 04 — Dominio: fechas y asignación al extracto (R1)

- **Hito PRD:** H1 (parte 1 de 3)
- **Estado:** ✅ Terminado y verificado
- **Inicio:** 2026-11-09
- **Fin:** 2026-11-09
- **Commit:** —
- **Depende de:** 01
- **Decisiones aplicables (decididas, ver README):** D7 (fecha de pago "posterior" estricta)

## Objetivo

Funciones puras en `lib/domain/dates.ts` y `lib/domain/statements.ts` que implementan R1 sobre fechas `YYYY-MM-DD`, con pruebas escritas **antes** de la implementación.

## Alcance

**Incluye:** helpers de fechas, fecha de corte por mes, extracto de una fecha, inicio de periodo, fecha límite de pago, desplazamiento de extractos por meses.

**No incluye:** dinero, cuotas, suscripciones (pasos 05 y 06).

## API propuesta

`lib/domain/dates.ts`

```ts
export type IsoDate = string; // 'YYYY-MM-DD'
export const TIME_ZONE = 'America/Bogota';
parseIsoDate(d: IsoDate): { year: number; month: number; day: number } // valida formato y fecha real
formatIsoDate(y: number, m: number, d: number): IsoDate
isValidIsoDate(d: string): boolean
daysInMonth(year: number, month: number): number
clampDay(year: number, month: number, day: number): IsoDate      // día que no existe → último del mes
addMonths(d: IsoDate, n: number): IsoDate                         // con ajuste de fin de mes
addDays(d: IsoDate, n: number): IsoDate
compareIsoDates(a: IsoDate, b: IsoDate): -1 | 0 | 1
todayInBogota(now?: Date): IsoDate                                // única función que usa date-fns-tz
monthKey(d: IsoDate): string                                      // 'YYYY-MM'
```

`lib/domain/statements.ts`

```ts
cutoffDateForMonth(cutoffDay: number, year: number, month: number): IsoDate
statementCutoffFor(cutoffDay: number, date: IsoDate): IsoDate        // R1: primer corte >= date
previousCutoff(cutoffDay: number, cutoffDate: IsoDate): IsoDate
periodStartFor(cutoffDay: number, cutoffDate: IsoDate): IsoDate      // corte anterior + 1 día
dueDateFor(paymentDay: number, cutoffDate: IsoDate): IsoDate         // primer payment_day > corte
shiftStatement(cutoffDay: number, cutoffDate: IsoDate, months: number): IsoDate
statementPeriod(card: { cutoffDay; paymentDay }, date: IsoDate): { periodStart; cutoffDate; dueDate }
```

Toda la aritmética usa enteros año/mes/día; no se construyen `Date` locales.

## Tareas

- [x] Instalar `decimal.js`, `date-fns`, `date-fns-tz` (si `date-fns-tz` no es compatible con la versión de `date-fns`, anotarlo y usar la alternativa oficial `@date-fns/tz`, avisando del cambio respecto a `AGENTS.md`).
- [x] Borrar `smoke.test.ts`.
- [x] Escribir `lib/domain/__tests__/dates.test.ts` y `statements.test.ts` con los casos de abajo (deben fallar al principio).
- [x] Implementar `dates.ts` y `statements.ts` hasta que pasen.
- [x] Activar el umbral de cobertura del 100% para `lib/domain/**` en `vitest.config.mts`.
- [x] Validar entradas: `cutoffDay`/`paymentDay` fuera de 1–31 o fecha inválida → lanzan error con mensaje claro (y se prueba).

## Casos de prueba obligatorios

R1 — asignación (corte 15):

| Fecha | Corte esperado |
| --- | --- |
| 2026-03-15 | 2026-03-15 (mismo día del corte) |
| 2026-03-16 | 2026-04-15 (un día después) |
| 2026-12-16 | 2027-01-15 (cambio de año) |

Corte 31 (fin de mes):

| Fecha | Corte esperado |
| --- | --- |
| 2026-02-10 | 2026-02-28 (febrero normal) |
| 2028-02-10 | 2028-02-29 (febrero bisiesto) |
| 2026-02-28 | 2026-02-28 |
| 2026-03-01 | 2026-03-31 |
| 2026-04-30 | 2026-04-30 (mes de 30 días) |
| 2026-05-01 | 2026-05-31 |

Corte 30: 2026-02-15 → 2026-02-28; 2026-03-01 → 2026-03-30.

Inicio de periodo:

- Corte 31, extracto 2026-03-31 → inicio 2026-03-01.
- Corte 31, extracto 2026-02-28 → inicio 2026-02-01.
- Corte 15, extracto 2026-01-15 → inicio 2025-12-16.

Fecha límite de pago:

- Corte 15, pago 5: extracto 2026-03-15 → 2026-04-05 (cae en el mes siguiente).
- Corte 15, pago 30: extracto 2026-03-15 → 2026-03-30 (mismo mes).
- Corte 30, pago 15: extracto 2026-12-30 → 2027-01-15 (cambio de año).
- Corte 5, pago 31: extracto 2026-02-05 → 2026-02-28.
- Corte 15, pago 15 (D7): extracto 2026-03-15 → 2026-04-15.

Desplazamiento (`shiftStatement`): corte 31, 2026-01-31 + 1 mes → 2026-02-28; + 2 meses → 2026-03-31 (no se "pega" al 28).

`todayInBogota`: `new Date('2026-03-16T03:00:00Z')` → `2026-03-15` (en Bogotá aún son las 22:00 del 15); `new Date('2026-03-16T05:00:00Z')` → `2026-03-16`.

## Archivos

- `lib/domain/dates.ts`, `lib/domain/statements.ts`
- `lib/domain/__tests__/dates.test.ts`, `lib/domain/__tests__/statements.test.ts`
- `vitest.config.ts` (umbral de cobertura)

## Verificación

```
pnpm test                     # todas pasan
pnpm test:coverage            # 100% en lib/domain/dates.ts y statements.ts
pnpm typecheck && pnpm lint
TZ=Pacific/Kiritimati pnpm test   # siguen pasando con otra zona del sistema
TZ=Pacific/Pago_Pago pnpm test
```

Revisión manual:

- [x] Todos los casos de la tabla están presentes como pruebas con nombre descriptivo.
- [x] `grep -n "new Date(" lib/domain` solo aparece dentro de `todayInBogota` o en pruebas.
- [x] Ninguna función de `lib/domain` importa de `next`, `react` ni `@supabase`.

## Criterios de terminado

- Verificaciones en verde.
- Commit: `feat: add statement date rules (R1) with tests`.

## Notas de progreso

2026-11-09 — Implementadas R1 y las fechas de negocio con aritmética por enteros. `date-fns-tz@3.2.0` es compatible con `date-fns@4.4.0`. Pasan `pnpm test`, `pnpm test:coverage` (100% en `dates.ts` y `statements.ts`), `pnpm typecheck`, `pnpm lint`, `TZ=Pacific/Kiritimati pnpm test`, `TZ=Pacific/Pago_Pago pnpm test` y `pnpm exec supabase db reset`.
