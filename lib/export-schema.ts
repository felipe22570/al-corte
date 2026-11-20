export const EXPORT_TABLES = {
  cards: { label: "Tarjetas", columns: ["id", "user_id", "name", "bank", "network", "last4", "credit_limit", "cutoff_day", "payment_day", "purchase_rate_ea", "advance_rate_ea", "advance_fee", "handling_fee", "amortization_method", "interest_mode", "usd_default_installments", "payment_allocation_rule", "color", "archived_at", "created_at", "updated_at"], numeric: ["credit_limit", "purchase_rate_ea", "advance_rate_ea", "advance_fee", "handling_fee"] },
  statements: { label: "Extractos", columns: ["id", "user_id", "card_id", "period_start", "cutoff_date", "due_date", "created_at", "updated_at"], numeric: [] },
  statement_balances: { label: "Saldos de extractos", columns: ["id", "user_id", "statement_id", "currency", "real_minimum", "real_total", "paid_at", "created_at", "updated_at"], numeric: ["real_minimum", "real_total"] },
  categories: { label: "Categorías", columns: ["id", "user_id", "name", "icon", "color", "monthly_budget", "archived_at", "created_at", "updated_at"], numeric: ["monthly_budget"] },
  transactions: { label: "Movimientos", columns: ["id", "user_id", "card_id", "statement_id", "category_id", "type", "date", "merchant", "amount", "currency", "fx_rate", "amount_cop", "installments_count", "interest_free", "rate_ea_applied", "subscription_id", "parent_id", "source", "verified", "note", "prior_installments", "prior_principal_paid", "original_installments_count", "paid_statement_id", "payment_kind", "is_international", "created_at", "updated_at"], numeric: ["amount", "fx_rate", "amount_cop", "rate_ea_applied", "prior_principal_paid"] },
  principal_prepayments: { label: "Abonos a capital", columns: ["id", "user_id", "payment_id", "transaction_id", "amount", "amount_cop", "effect", "assumed", "replaced_from_number", "replaced_installments", "created_at"], numeric: ["amount", "amount_cop"] },
  installments: { label: "Cuotas", columns: ["id", "user_id", "transaction_id", "statement_id", "number", "principal", "interest", "total", "balance_after", "principal_cop", "interest_cop", "total_cop", "before_tracking", "created_at"], numeric: ["principal", "interest", "total", "balance_after", "principal_cop", "interest_cop", "total_cop"] },
  subscriptions: { label: "Suscripciones", columns: ["id", "user_id", "card_id", "category_id", "name", "amount", "currency", "frequency", "billing_day", "start_date", "trial_ends_at", "status", "installments_count", "last_charged_amount", "created_at", "updated_at"], numeric: ["amount", "last_charged_amount"] },
  notification_log: { label: "Registro de avisos", columns: ["id", "user_id", "kind", "ref_id", "scheduled_for", "sent_at", "created_at"], numeric: [] },
  fx_rates: { label: "TRM", columns: ["date", "usd_cop"], numeric: ["usd_cop"] },
} as const;

export type ExportTable = keyof typeof EXPORT_TABLES;
export function isExportTable(value: string | null): value is ExportTable {
  return value !== null && Object.hasOwn(EXPORT_TABLES, value);
}

export function exportSelect(table: ExportTable): string {
  const { columns, numeric } = EXPORT_TABLES[table];
  return columns.map((column) => (numeric as readonly string[]).includes(column) ? `${column}::text` : column).join(",");
}
