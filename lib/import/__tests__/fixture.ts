import type { ImportFile } from "../statement-import";

/** Synthetic al-corte-import v1 file (no real data) with every kind of line the generator handles. */
export function syntheticImport(): ImportFile {
  const card = {
    key: "visa", name: "Visa de prueba", bank: "Banco", network: "Visa", last4: "4242", credit_limit: "5000000.00", cutoff_day: 15, payment_day: 2,
    purchase_rate_ea: "0.283288", advance_rate_ea: "0.283288", advance_fee: null, handling_fee: "0.00", amortization_method: "fixed_principal" as const,
    interest_mode: "on_balance" as const, usd_default_installments: 36, color: "card-2", bank_available_credit: "4000000.00",
  };
  const base = { card: "visa", category: null, currency: "COP" as const, installments_count: 1, statement_cutoff: "2026-11-15" };
  return {
    format: "al-corte-import", version: 1, cards: [card],
    statements: [
      { card: "visa", cutoff_date: "2026-10-15", due_date: "2026-11-02", reference_only: true, paid: true, balances: [{ currency: "COP", paid_with: ["pago"] }] },
      { card: "visa", cutoff_date: "2026-11-15", due_date: "2026-12-02", balances: [{ currency: "COP", real_minimum: "150000.00", real_total: "500000.00" }, { currency: "USD", real_minimum: "1.00", real_total: "3.00" }] },
    ],
    transactions: [
      { ...base, key: "t-borde", type: "purchase", date: "2026-10-15", merchant: "Compra de borde", category: "Mercado", amount: "10000", statement_override: true },
      { ...base, key: "t-curso", type: "purchase", date: "2026-08-10", merchant: "Nevera O'Brien", amount: "600000", installments_count: 6, installments_count_original: 6,
        current_installment: 4, prior_installments: 3, prior_principal_paid: "300000", installment_principal_this_statement: "100000", pending_principal_after_statement: "200000" },
      { ...base, key: "t-usd", type: "purchase", date: "2026-11-03", merchant: "Servicio en dólares", category: "Suscripciones", amount: "2.79", currency: "USD", installments_count: 36,
        installments_count_original: 36, current_installment: 1, prior_installments: 0, prior_principal_paid: "0", installment_principal_this_statement: "0.08", pending_principal_after_statement: "2.71", fx_rate: null },
      { ...base, key: "t-avance", type: "cash_advance", date: "2026-11-05", merchant: "Avance", amount: "200000", installments_count: 2, installments_count_original: 2, current_installment: 1,
        prior_installments: 0, installment_principal_this_statement: "100000", pending_principal_after_statement: "100000" },
      { ...base, key: "t-comision", type: "advance_fee", date: "2026-11-05", merchant: "Comisión del avance", amount: "6840", parent: "t-avance" },
      { ...base, key: "t-interes", type: "interest", date: "2026-11-15", merchant: "Intereses", amount: "12000" },
      { ...base, key: "t-mensual", type: "purchase", date: "2026-11-07", merchant: "Streaming", category: "Suscripciones", amount: "30000" },
    ],
    payments: [{ key: "pago", card: "visa", date: "2026-10-30", merchant: "Abono", amount: "100000", currency: "COP", applies_to_statement_cutoff: "2026-10-15" }],
    subscriptions: [{ key: "streaming", card: "visa", name: "Streaming", category: "Suscripciones", amount: "30000", currency: "COP", frequency: "monthly", billing_day: 7,
      start_date: "2026-11-07", installments_count: 1, last_charged_amount: "30000", first_charge: "t-mensual" }],
    pending_subscriptions: [{ key: "diferida", card: "visa", name: "Servicio en dólares", category: "Suscripciones", amount: "2.79", currency: "USD", frequency: "monthly", billing_day: 3,
      installments_count: 36, charges: ["t-usd"] }],
  };
}

/** Official TRM rows for the synthetic file. */
export const syntheticTrm = [{ valor: "3300", vigenciadesde: "2026-10-31T00:00:00.000", vigenciahasta: "2026-11-03T00:00:00.000" }];
