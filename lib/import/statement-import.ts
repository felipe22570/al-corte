import Decimal from "decimal.js";
import type { IsoDate } from "@/lib/domain/dates";
import type { AmortizationMethod } from "@/lib/domain/installments";
import type { InterestMode } from "@/lib/domain/interest";
import type { Currency } from "@/lib/domain/money";
import { buildTransactionPlan, type TransactionCard, type TransactionPlanInput } from "@/lib/domain/transaction-plan";

/**
 * Generator of the one-time import of real bank statements (step 35, D36). It reads an `al-corte-import` v1 file and
 * writes a SQL script for the Supabase SQL editor. Every movement goes through the same registration RPCs as the app,
 * with the plan built by `buildTransactionPlan`, so the database validates it as any other movement.
 * The file and the script contain personal financial data: they live outside git (`docs/al-corte-import-*.json`, `private/`).
 */

type ImportCard = {
  key: string; name: string; bank: string; network: string; last4: string; credit_limit: string; cutoff_day: number; payment_day: number;
  purchase_rate_ea: string; advance_rate_ea: string; advance_fee: string | null; handling_fee: string; amortization_method: AmortizationMethod;
  interest_mode: InterestMode; usd_default_installments: number; color: string; bank_available_credit?: string;
};
type ImportBalance = { currency: Currency; real_minimum?: string; real_total?: string; paid_with?: string[] };
type ImportStatement = { card: string; cutoff_date: IsoDate; due_date: IsoDate; reference_only?: boolean; paid?: boolean; balances: ImportBalance[] };
type ImportTransaction = {
  key: string; card: string; type: "purchase" | "cash_advance" | "advance_fee" | "interest" | "handling_fee" | "insurance" | "adjustment" | "refund";
  date: IsoDate; merchant: string; category: string | null; amount: string; currency: Currency; installments_count: number;
  // Before step 27 `installments_count` was the effective plan; the original N is `installments_count_original`.
  installments_count_original?: number; current_installment?: number; prior_installments?: number; prior_principal_paid?: string;
  installment_principal_this_statement?: string; pending_principal_after_statement?: string; interest_free?: boolean;
  statement_cutoff: IsoDate; statement_override?: boolean | null; note?: string | null; fx_rate?: string | null; parent?: string;
};
type ImportPayment = { key: string; card: string; date: IsoDate; merchant: string; amount: string; currency: Currency; fx_rate?: string | null; applies_to_statement_cutoff: IsoDate; note?: string };
type ImportSubscription = {
  key: string; card: string; name: string; category: string | null; amount: string; currency: Currency; frequency: "monthly" | "yearly"; billing_day: number;
  start_date?: IsoDate; installments_count: number; last_charged_amount?: string; first_charge?: string; charges?: string[];
};
export type ImportFile = {
  format: string; version: number; cards: ImportCard[]; statements: ImportStatement[]; transactions: ImportTransaction[]; payments: ImportPayment[];
  subscriptions: ImportSubscription[]; pending_subscriptions?: ImportSubscription[];
};
export type ImportOptions = {
  /** Official TRM of each date, for dollar amounts the file leaves pending. */
  trm: Record<IsoDate, string>;
  /** Advance fee of the cards the file leaves pending, by card key. */
  advanceFees?: Record<string, string>;
  /** Description of the TRM source, written in the script. */
  trmSource: string;
  generatedOn: IsoDate;
};

/** Placeholder card id: the script replaces it with the id of the card in the database. */
const CARD = "00000000-0000-4000-8000-000000000000";
const literal = (value: string) => `'${value.replaceAll("'", "''")}'`;
const optional = (value: string | null | undefined) => value === null || value === undefined ? "null" : literal(value);

function check(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function transactionCard(card: ImportCard, advanceFee: string): TransactionCard {
  return {
    id: CARD, cutoffDay: card.cutoff_day, paymentDay: card.payment_day, purchaseRateEa: card.purchase_rate_ea, advanceRateEa: card.advance_rate_ea,
    advanceFee, amortizationMethod: card.amortization_method, interestMode: card.interest_mode,
  };
}

/** Payload of one movement, built like the app builds it, plus what the import checks against the bank. */
export function importPayload(transaction: ImportTransaction, card: ImportCard, advanceFee: string, fees: Map<string, string>, trm: Record<IsoDate, string>) {
  const fxRate = transaction.currency === "USD" ? transaction.fx_rate ?? trm[transaction.date] : null;
  check(transaction.currency === "COP" || !!fxRate, `Falta la TRM del ${transaction.date} para ${transaction.key}.`);
  const prior = transaction.prior_installments ?? 0;
  const input: TransactionPlanInput = {
    cardId: CARD, type: transaction.type as TransactionPlanInput["type"], date: transaction.date, amount: transaction.amount, currency: transaction.currency, fxRate,
    installmentsCount: transaction.installments_count_original ?? transaction.installments_count, interestFree: !!transaction.interest_free,
    categoryId: null, merchant: transaction.merchant, note: transaction.note ?? "",
    advanceFee: transaction.type === "cash_advance" && prior === 0 ? fees.get(transaction.key) ?? "0" : null,
    inProgress: prior > 0 ? {
      currentInstallment: transaction.current_installment!, balanceAfter: transaction.pending_principal_after_statement ?? null, trackedFromCutoff: transaction.statement_cutoff,
      currentPrincipal: transaction.installment_principal_this_statement ?? null,
    } : null,
  };
  const plan = buildTransactionPlan(input, transactionCard(card, advanceFee));
  const payload: Record<string, unknown> = { ...plan.payload };
  const warnings: string[] = [];
  if (transaction.statement_override) payload.statement_cutoff_override = transaction.statement_cutoff;
  else if (plan.firstCutoff !== transaction.statement_cutoff) warnings.push(`${transaction.key}: Al Corte lo asigna al corte ${plan.firstCutoff} y el banco al ${transaction.statement_cutoff}.`);
  if (plan.payload.installments.length) {
    const k = transaction.current_installment ?? 1;
    const row = plan.payload.installments[k - 1];
    // A plan shortened by the bank's rounding (R2) keeps its original N, which the file gives as the plan.
    const shortened = plan.payload.original_installments_count === transaction.installments_count;
    if (plan.payload.installments_count !== transaction.installments_count && !shortened) warnings.push(`${transaction.key}: plan de ${plan.payload.installments_count} cuotas; el archivo dice ${transaction.installments_count}.`);
    if (!new Decimal(plan.payload.prior_principal_paid).equals(transaction.prior_principal_paid ?? 0)) warnings.push(`${transaction.key}: capital previo ${plan.payload.prior_principal_paid}; el archivo dice ${transaction.prior_principal_paid}.`);
    if (transaction.installment_principal_this_statement && !new Decimal(row!.principal).equals(transaction.installment_principal_this_statement)) warnings.push(`${transaction.key}: cuota ${k} de ${row!.principal}; el banco dice ${transaction.installment_principal_this_statement}.`);
    if (transaction.pending_principal_after_statement && !new Decimal(row!.balance_after).equals(transaction.pending_principal_after_statement)) warnings.push(`${transaction.key}: saldo ${row!.balance_after}; el banco dice ${transaction.pending_principal_after_statement}.`);
  }
  return { payload, warnings };
}

const header = (title: string) => `\n-- ${title} ${"-".repeat(Math.max(3, 100 - title.length))}\n`;

/** SQL that runs a block once per import key (D36): a movement already imported is skipped. */
function movementBlock(key: string, cardLast4: string, body: string) {
  return `do $$
declare
  v_card uuid := (select id from public.cards where user_id = auth.uid() and last4 = ${literal(cardLast4)} and archived_at is null);
  v_id uuid;
begin
  if exists (select 1 from public.transactions where user_id = auth.uid() and import_key = ${literal(key)}) then return; end if;
${body}
end $$;\n`;
}

const category = (name: string | null) => name === null ? "null"
  : `(select id from public.categories where user_id = auth.uid() and lower(name) = lower(${literal(name)}) and archived_at is null)`;

/** Builds the import script; throws when the file cannot be imported as is. Warnings list differences with the bank. */
export function buildImportSql(file: ImportFile, options: ImportOptions): { sql: string; warnings: string[] } {
  check(file.format === "al-corte-import" && file.version === 1, "El archivo no es al-corte-import v1.");
  const cards = new Map(file.cards.map((card) => [card.key, card]));
  const advanceFees = new Map(file.cards.map((card) => [card.key, card.advance_fee ?? options.advanceFees?.[card.key] ?? null]));
  for (const [key, fee] of advanceFees) check(fee !== null, `Falta la comisión por avance de la tarjeta ${key}.`);
  const cardOf = (key: string) => { const card = cards.get(key); check(!!card, `Tarjeta desconocida: ${key}.`); return card; };
  // The fee of an advance comes with it (D41); its own line in the file is not imported apart.
  const fees = new Map(file.transactions.filter((item) => item.type === "advance_fee" && item.parent).map((item) => [item.parent!, item.amount]));
  const warnings: string[] = [];
  const parts: string[] = [];

  parts.push(`-- Al Corte · importación de extractos reales (al-corte-import v1) · generado el ${options.generatedOn}
-- Contiene datos financieros personales: no lo subas a git ni lo compartas.
-- Ejecuta el archivo completo en el editor SQL de Supabase. Todo va en una transacción: si algo falla, no se guarda nada.
-- Es idempotente: ejecutarlo de nuevo no duplica tarjetas, extractos, movimientos ni suscripciones.
-- TRM de los movimientos en dólares sin tasa en el extracto: ${options.trmSource}.
begin;
${header("1. Tu cuenta: escribe el correo con el que entras a Al Corte")}
select set_config('al_corte.email', '__PENDIENTE__', true);

do $$
declare v_user uuid;
begin
  if current_setting('al_corte.email') = '__PENDIENTE__' then raise exception 'Completa el correo de tu cuenta al inicio del script.'; end if;
  select id into v_user from auth.users where lower(email) = lower(current_setting('al_corte.email'));
  if v_user is null then raise exception 'No existe un usuario con ese correo.'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', v_user, 'role', 'authenticated')::text, true);
end $$;

-- Desde aquí todo corre como tu usuario, con las mismas reglas de seguridad (RLS) y validaciones que la app.
set local role authenticated;
`);

  parts.push(header("2. Tarjetas"));
  for (const card of file.cards) {
    parts.push(`do $$
declare v_card public.cards%rowtype;
begin
  select * into v_card from public.cards where user_id = auth.uid() and last4 = ${literal(card.last4)} and archived_at is null;
  if not found then
    insert into public.cards (name, bank, network, last4, credit_limit, cutoff_day, payment_day, purchase_rate_ea, advance_rate_ea, advance_fee, handling_fee, amortization_method, interest_mode, usd_default_installments, color)
    values (${literal(card.name)}, ${literal(card.bank)}, ${literal(card.network)}, ${literal(card.last4)}, ${card.credit_limit}, ${card.cutoff_day}, ${card.payment_day}, ${card.purchase_rate_ea}, ${card.advance_rate_ea},
      ${advanceFees.get(card.key)}, ${card.handling_fee}, ${literal(card.amortization_method)}, ${literal(card.interest_mode)}, ${card.usd_default_installments}, ${literal(card.color)});
  elsif v_card.cutoff_day <> ${card.cutoff_day} or v_card.payment_day <> ${card.payment_day} or v_card.purchase_rate_ea <> ${card.purchase_rate_ea} or v_card.advance_rate_ea <> ${card.advance_rate_ea}
     or v_card.amortization_method <> ${literal(card.amortization_method)} or v_card.interest_mode <> ${literal(card.interest_mode)} then
    raise exception 'La tarjeta •••• ${card.last4} ya existe con otras condiciones (corte, pago, tasas o intereses). Ajústalas como en el archivo antes de importar.';
  end if;
end $$;\n`);
  }

  parts.push(header("3. Extractos de referencia (pagados con los abonos de su mes)"));
  for (const statement of file.statements.filter((item) => item.reference_only)) {
    const card = cardOf(statement.card);
    parts.push(`select public.ensure_statement((select id from public.cards where user_id = auth.uid() and last4 = ${literal(card.last4)} and archived_at is null), ${literal(statement.cutoff_date)});\n`);
  }

  parts.push(header("4. Movimientos y compras en curso"));
  for (const transaction of file.transactions) {
    if (transaction.type === "advance_fee" && transaction.parent) continue;
    const card = cardOf(transaction.card);
    const { payload, warnings: own } = importPayload(transaction, card, advanceFees.get(card.key)!, fees, options.trm);
    warnings.push(...own);
    const json = JSON.stringify(payload);
    check(!json.includes("$$"), `El movimiento ${transaction.key} contiene "$$".`);
    const fee = fees.has(transaction.key) ? file.transactions.find((item) => item.parent === transaction.key)! : null;
    parts.push(movementBlock(transaction.key, card.last4, `  v_id := public.create_transaction_with_installments(jsonb_set(${literal(json)}::jsonb, '{card_id}', to_jsonb(v_card)) || jsonb_build_object('category_id', ${category(transaction.category)}));
  update public.transactions set import_key = ${literal(transaction.key)}, source = 'import' where id = v_id;${fee ? `
  update public.transactions set import_key = ${literal(fee.key)}, source = 'import', merchant = ${literal(fee.merchant)} where parent_id = v_id and type = 'advance_fee';` : ""}`));
  }

  // The payments of a reference statement paid charges registered before Al Corte (single purchases, prior installments):
  // registering them would lower the used credit twice (D2). They only mark that statement paid on their date (D26).
  parts.push(header("5. Extracto anterior pagado con los abonos de su mes (solo la marca; sus cargos no están en Al Corte)"));
  for (const payment of file.payments) {
    const card = cardOf(payment.card);
    parts.push(`insert into public.statement_balances (statement_id, currency, paid_at)
values ((select s.id from public.statements s join public.cards c on c.id = s.card_id where c.user_id = auth.uid() and c.last4 = ${literal(card.last4)} and c.archived_at is null and s.cutoff_date = ${literal(payment.applies_to_statement_cutoff)}),
  ${literal(payment.currency)}, ${literal(`${payment.date}T05:00:00Z`)})
on conflict (statement_id, currency) do update set paid_at = coalesce(public.statement_balances.paid_at, excluded.paid_at);\n`);
  }

  parts.push(header("6. Valores del banco del extracto de noviembre, por moneda (referencia; la app no los usa en el cálculo)"));
  for (const statement of file.statements.filter((item) => !item.reference_only)) {
    const card = cardOf(statement.card);
    for (const balance of statement.balances) {
      parts.push(`insert into public.statement_balances (statement_id, currency, real_minimum, real_total)
values ((select s.id from public.statements s join public.cards c on c.id = s.card_id where c.user_id = auth.uid() and c.last4 = ${literal(card.last4)} and c.archived_at is null and s.cutoff_date = ${literal(statement.cutoff_date)}),
  ${literal(balance.currency)}, ${optional(balance.real_minimum)}, ${optional(balance.real_total)})
on conflict (statement_id, currency) do update set real_minimum = excluded.real_minimum, real_total = excluded.real_total;\n`);
    }
  }

  parts.push(header("7. Suscripciones, enlazadas a sus cobros importados para que el cobro diario no los duplique"));
  const subscriptions = [...file.subscriptions, ...file.pending_subscriptions ?? []];
  for (const subscription of subscriptions) {
    const card = cardOf(subscription.card);
    const charges = subscription.charges ?? (subscription.first_charge ? [subscription.first_charge] : []);
    const chargeDates = charges.map((key) => { const item = file.transactions.find((transaction) => transaction.key === key); check(!!item, `Cobro desconocido: ${key}.`); return item.date; }).sort();
    const startDate = subscription.start_date ?? chargeDates[0];
    check(!!startDate, `La suscripción ${subscription.key} no tiene fecha de inicio.`);
    parts.push(`do $$
declare
  v_card uuid := (select id from public.cards where user_id = auth.uid() and last4 = ${literal(card.last4)} and archived_at is null);
  v_subscription uuid;
begin
  select id into v_subscription from public.subscriptions where user_id = auth.uid() and card_id = v_card and name = ${literal(subscription.name)};
  if v_subscription is null then
    insert into public.subscriptions (card_id, category_id, name, amount, currency, frequency, billing_day, start_date, status, installments_count, last_charged_amount)
    values (v_card, ${category(subscription.category)}, ${literal(subscription.name)}, ${subscription.amount}, ${literal(subscription.currency)}, ${literal(subscription.frequency)}, ${subscription.billing_day},
      ${literal(startDate)}, 'active', ${subscription.installments_count}, ${subscription.last_charged_amount ?? subscription.amount})
    returning id into v_subscription;
  end if;
  update public.transactions set subscription_id = v_subscription, source = 'subscription'
  where user_id = auth.uid() and import_key in (${charges.map(literal).join(", ")}) and subscription_id is null;
end $$;\n`);
  }

  parts.push(header("8. Verificación: compara cada fila con tu extracto"));
  const checks = file.statements.filter((item) => !item.reference_only).flatMap((statement) => statement.balances.map((balance) => {
    const card = cardOf(statement.card);
    return `select ${literal(card.name)} as tarjeta, ${literal(balance.currency)} as moneda,
  t.total_calculated as pago_minimo_al_corte, ${optional(balance.real_minimum)}::numeric as pago_minimo_banco,
  t.total_debt as deuda_total_al_corte, ${optional(balance.real_total)}::numeric as deuda_total_banco,
  b.available as cupo_disponible_al_corte, ${optional(card.bank_available_credit)}::numeric as cupo_disponible_banco
from public.statement_currency_totals t
join public.statements s on s.id = t.statement_id
join public.cards c on c.id = s.card_id
join public.card_balances b on b.card_id = c.id
where c.user_id = auth.uid() and c.last4 = ${literal(card.last4)} and c.archived_at is null and s.cutoff_date = ${literal(statement.cutoff_date)} and t.currency = ${literal(balance.currency)}`;
  }));
  parts.push(`${checks.join("\nunion all\n")};\n\nreset role;\ncommit;\n`);
  return { sql: parts.join(""), warnings };
}
