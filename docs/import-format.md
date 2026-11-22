# Formato `al-corte-import` v1

Archivo JSON con los movimientos de un extracto bancario. Se prepara fuera de la app a partir del PDF del banco (leer el PDF dentro de la app es v3) y se carga desde **Ajustes → Importar extracto** (F22, R11, D55). También lo usó la importación única del paso 35 (D36).

El archivo contiene datos financieros personales: no se sube a git (`docs/al-corte-import-*.json` y `private/` están en `.gitignore`). La app lo lee en memoria para revisarlo y guardarlo; nunca lo guarda ni lo registra en logs. El tamaño máximo es 1 MB.

## Reglas generales

- Fechas: `YYYY-MM-DD`, fechas de negocio en Bogotá.
- Valores: texto con punto decimal y hasta 2 decimales (`"44900"`, `"2.79"`). Siempre positivos; el signo lo da el tipo.
- Monedas: `COP` o `USD`. Cada línea va en la moneda en que el banco la factura.
- TRM: texto con hasta 4 decimales. Si una línea en USD no trae `fx_rate`, se usa la TRM oficial de `fx_rates` en su fecha (D57); si tampoco existe, la línea no se puede importar.
- Claves (`key`): únicas dentro del archivo, de 1 a 100 caracteres, derivadas de la referencia del banco. Una compra a cuotas conserva su clave en todos los meses: así se reconoce sin conflicto (D55).
- Los campos que la importación no usa se ignoran (por ejemplo `bank_reference`, `merchant_raw`, `bank_checks`, `anomalies`, notas).

## Secciones

### `format`, `version`

`"al-corte-import"` y `1`. Cualquier otro valor se rechaza.

### `cards`

Identifican la tarjeta. La importación mensual **no crea ni cambia tarjetas**: la busca entre las activas por `last4`. Si no existe, el archivo se rechaza sin guardar nada. Si las condiciones del archivo son otras, se avisa y se usan las guardadas.

| Campo | Tipo | Uso |
| --- | --- | --- |
| `key` | texto | Nombre de la tarjeta dentro del archivo. |
| `last4` | 4 dígitos | Identifica la tarjeta del dueño. |
| `cutoff_day`, `payment_day` | entero 1–31 | Solo para avisar diferencias. |
| `purchase_rate_ea`, `advance_rate_ea` | texto | Solo para avisar diferencias. |
| `amortization_method` | `fixed_principal` \| `french` | Solo para avisar diferencias. |
| `interest_mode` | `per_installment` \| `on_balance` | Solo para avisar diferencias. |
| `bank_available_credit` | valor, opcional | Cupo disponible del banco, para la verificación. |

### `statements`

El extracto del archivo, uno por tarjeta, con los valores del banco por moneda. Los marcados `reference_only` se ignoran en la importación mensual.

| Campo | Tipo | Uso |
| --- | --- | --- |
| `card` | clave de tarjeta | |
| `cutoff_date`, `due_date` | fecha | Corte y fecha límite del banco. |
| `reference_only` | booleano, opcional | Extracto de referencia de la importación única. |
| `balances[]` | `{ currency, real_minimum?, real_total? }` | Pago mínimo y deuda total del banco. Se guardan en `statement_balances` solo si están vacíos. |

### `transactions`

| Campo | Tipo | Uso |
| --- | --- | --- |
| `key` | texto | Clave del archivo (`import_key`). |
| `card` | clave de tarjeta | |
| `type` | `purchase`, `cash_advance`, `advance_fee`, `interest`, `handling_fee`, `insurance`, `adjustment`, `refund` | |
| `date` | fecha | Fecha de la compra (la original en compras en curso). |
| `merchant` | texto | Comercio como se quiere ver en la app. |
| `category` | texto o `null` | Nombre de una categoría activa; si no existe, queda sin categoría. |
| `amount` | valor | Valor total del movimiento, no la cuota. |
| `currency` | `COP` \| `USD` | |
| `fx_rate` | TRM o `null` | Solo en USD. |
| `installments_count` | entero | Plan del banco. |
| `installments_count_original` | entero, opcional | N original cuando el banco acortó el plan por redondeo (R2). |
| `interest_free` | booleano, opcional | Compra sin intereses. |
| `statement_cutoff` | fecha | Corte del extracto donde el banco la facturó. |
| `statement_override` | booleano, opcional | Conserva el extracto del banco en compras del borde del corte variable (D30). Solo vale dentro del extracto del archivo. |
| `parent` | clave, opcional | En `advance_fee`: la clave de su avance. La comisión viaja con el avance (D41). |
| `note` | texto, opcional | |

**Compras en curso** (R8, D31, D49): una compra que ya tenía cuotas pagadas antes de Al Corte agrega `current_installment` (cuota k facturada en este extracto), `prior_installments` (k − 1), `prior_principal_paid`, `installment_principal_this_statement` y `pending_principal_after_statement` (saldo después de la cuota k, como lo imprime el banco). El plan se arma con D31 y D49: la cuota k queda en `statement_cutoff`.

### `payments`

Solo se comparan; **nunca se importan** (necesitan tipo y reparto, D37). Un pago con la misma tarjeta, fecha, valor y moneda que uno registrado aparece como ya registrado; si no, se ofrece registrarlo desde el extracto.

| Campo | Tipo |
| --- | --- |
| `key`, `card`, `date`, `merchant`, `amount`, `currency` | como en `transactions` |
| `applies_to_statement_cutoff` | fecha del corte que paga |

### Secciones que la importación mensual ignora

`subscriptions`, `pending_subscriptions`, extractos `reference_only`, `anomalies`, `bank_checks`, `open_questions` y notas. Las suscripciones se administran en la app.

## Identidad de cada línea (D55)

En este orden, y cada movimiento de la app se empareja con una sola línea:

1. **Clave**: la misma `key` en la misma tarjeta → ya registrada.
2. **Cargos del extracto** (`interest`, `handling_fee`, `insurance`): misma tarjeta, extracto, tipo y moneda → ya registrado si el valor coincide; si no, se corrige en el cierre mensual (F15).
3. **Datos**: tarjeta, fecha, valor, moneda y nombre normalizado (paso 36) → ya registrada.
4. **Cobro de suscripción**: un cobro creado por la app en la misma tarjeta y moneda, a 7 días o menos. Con el mismo valor → ya registrado; con otro valor y el mismo nombre → conflicto.
5. **Misma tarjeta, fecha y valor**, distinto en el resto → conflicto.
6. Lo demás → nuevo.

Un conflicto no se importa sin decisión del dueño: "Es el mismo" solo guarda la clave en el movimiento existente; "Importar como nuevo" lo crea. La importación solo agrega movimientos: nunca cambia montos, fechas, cuotas, categoría ni extracto de los existentes.

## Ejemplo ficticio

```json
{
  "format": "al-corte-import",
  "version": 1,
  "cards": [
    { "key": "visa", "last4": "4242", "cutoff_day": 15, "payment_day": 2, "purchase_rate_ea": "0.283288", "advance_rate_ea": "0.283288",
      "amortization_method": "fixed_principal", "interest_mode": "on_balance", "bank_available_credit": "4000000.00" }
  ],
  "statements": [
    { "card": "visa", "cutoff_date": "2026-12-15", "due_date": "2027-01-02",
      "balances": [{ "currency": "COP", "real_minimum": "150000.00", "real_total": "500000.00" }, { "currency": "USD", "real_minimum": "1.00", "real_total": "3.00" }] }
  ],
  "transactions": [
    { "key": "ref-001", "card": "visa", "type": "purchase", "date": "2026-12-03", "merchant": "Librería", "category": "Educación",
      "amount": "80000", "currency": "COP", "installments_count": 1, "statement_cutoff": "2026-12-15" },
    { "key": "ref-002", "card": "visa", "type": "purchase", "date": "2026-12-05", "merchant": "Servicio en dólares", "category": null,
      "amount": "2.79", "currency": "USD", "fx_rate": null, "installments_count": 36, "statement_cutoff": "2026-12-15" },
    { "key": "ref-003", "card": "visa", "type": "cash_advance", "date": "2026-12-06", "merchant": "Avance", "category": null,
      "amount": "200000", "currency": "COP", "installments_count": 2, "statement_cutoff": "2026-12-15" },
    { "key": "ref-004", "card": "visa", "type": "advance_fee", "date": "2026-12-06", "merchant": "Comisión del avance", "category": null,
      "amount": "6840", "currency": "COP", "installments_count": 1, "statement_cutoff": "2026-12-15", "parent": "ref-003" },
    { "key": "ref-005", "card": "visa", "type": "purchase", "date": "2026-08-10", "merchant": "Nevera", "category": "Hogar",
      "amount": "600000", "currency": "COP", "installments_count": 6, "current_installment": 4, "prior_installments": 3,
      "prior_principal_paid": "300000", "installment_principal_this_statement": "100000", "pending_principal_after_statement": "200000",
      "statement_cutoff": "2026-12-15" },
    { "key": "ref-006", "card": "visa", "type": "interest", "date": "2026-12-15", "merchant": "Intereses", "category": null,
      "amount": "12000", "currency": "COP", "installments_count": 1, "statement_cutoff": "2026-12-15" }
  ],
  "payments": [
    { "key": "pay-001", "card": "visa", "date": "2026-12-01", "merchant": "Pago", "amount": "150000", "currency": "COP", "applies_to_statement_cutoff": "2026-11-15" }
  ]
}
```
