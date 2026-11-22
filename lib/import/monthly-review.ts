import type { CardColor } from "@/lib/card-colors";
import type { IsoDate } from "@/lib/domain/dates";
import { classifyImportRows, type ConflictReason, type ExistingMovement, type ExistingPayment, type ImportRow, type ImportStatus } from "@/lib/domain/import-identity";
import type { AmortizationMethod } from "@/lib/domain/installments";
import type { InterestMode } from "@/lib/domain/interest";
import type { Currency } from "@/lib/domain/money";
import type { TransactionCard } from "@/lib/domain/transaction-plan";
import type { MonthlyFile } from "./monthly-file";
import { importPlanPayload } from "./statement-import";

export type ImportCardRecord = {
  id: string; name: string; last4: string; color: CardColor; cutoffDay: number; paymentDay: number; purchaseRateEa: string; advanceRateEa: string;
  advanceFee: string; amortizationMethod: AmortizationMethod; interestMode: InterestMode;
};
/** What the import reads from the database: never the file. */
export type ImportContext = {
  cards: ImportCardRecord[]; categories: Array<{ id: string; name: string }>;
  /** Official TRM by date, for dollar lines without their own. */
  rates: Record<IsoDate, string>;
  movements: ExistingMovement[]; payments: ExistingPayment[];
};

export type ReviewStatus = ImportStatus | "blocked";
export type ReviewRow = {
  key: string; cardId: string; type: string; date: IsoDate; merchant: string; amount: string; currency: Currency; statementCutoff: IsoDate;
  status: ReviewStatus; reason?: ConflictReason; blocked?: string;
  match?: { id: string; amount: string; merchant: string | null; date: IsoDate };
  installment?: { current: number; count: number };
  /** Fee of a new advance (D41), from its own line in the file. */
  fee?: string;
};
export type ReviewStatement = {
  cardId: string; cardName: string; last4: string; color: CardColor; cutoffDate: IsoDate; dueDate: IsoDate;
  bank: Array<{ currency: Currency; minimum: string | null; total: string | null }>; bankAvailable: string | null;
};
export type ImportReview = { rows: ReviewRow[]; statements: ReviewStatement[]; warnings: string[] };
/** The owner's choice for each line: import it, link it to the movement it conflicts with, or leave it out. */
export type ImportDecision = "import" | "link" | "skip";
type Plan = { payload: Record<string, unknown>; fee: { key: string; merchant: string } | null };
export type ImportRequest = {
  create: Array<{ key: string; payload: Record<string, unknown>; fee: { key: string; merchant: string } | null }>;
  link: Array<{ transaction_id: string; key: string }>;
  statements: Array<{ card_id: string; cutoff_date: IsoDate; balances: Array<{ currency: Currency; real_minimum: string | null; real_total: string | null }> }>;
};

const differentTerms = (card: ImportCardRecord, file: MonthlyFile["cards"][number]) => {
  const fields = [
    card.cutoffDay !== file.cutoff_day && "corte", card.paymentDay !== file.payment_day && "pago",
    (Number(card.purchaseRateEa) !== Number(file.purchase_rate_ea) || Number(card.advanceRateEa) !== Number(file.advance_rate_ea)) && "tasas",
    card.amortizationMethod !== file.amortization_method && "amortización", card.interestMode !== file.interest_mode && "intereses",
  ].filter(Boolean);
  return fields.length ? `La tarjeta •••• ${card.last4} tiene en el archivo otras condiciones (${fields.join(", ")}). Se usan las que tienes en Al Corte.` : null;
};

/**
 * Review of a monthly file (F22, R11): each line with its identity (D55) and, when it can be imported, its plan built like the
 * app builds it with the card as saved. Fails without importing anything when a card of the file is not registered.
 */
export function buildMonthlyReview(file: MonthlyFile, context: ImportContext): { ok: true; review: ImportReview; plans: Map<string, Plan> } | { ok: false; error: string } {
  const byKey = new Map<string, ImportCardRecord>();
  const warnings: string[] = [];
  for (const fileCard of file.cards) {
    const card = context.cards.find((item) => item.last4 === fileCard.last4);
    if (!card) return { ok: false, error: `No tienes una tarjeta activa terminada en ${fileCard.last4}. Regístrala antes de importar.` };
    byKey.set(fileCard.key, card);
    const different = differentTerms(card, fileCard);
    if (different) warnings.push(different);
  }
  const cardOf = (key: string) => byKey.get(key);
  const statements = file.statements.filter((item) => !item.reference_only);
  if (!statements.length) return { ok: false, error: "El archivo no trae un extracto para importar." };
  if ([...file.transactions, ...file.payments, ...statements].some((item) => !cardOf(item.card))) return { ok: false, error: "El archivo usa una tarjeta que no declara." };
  const ownCutoffs = new Set(statements.map((item) => `${item.card}:${item.cutoff_date}`));

  // The fee of an advance travels with it (D41); its own line is not imported apart.
  const fees = new Map(file.transactions.filter((item) => item.type === "advance_fee" && item.parent).map((item) => [item.parent!, item]));
  const lines = file.transactions.filter((item) => !(item.type === "advance_fee" && item.parent));
  const rows: ImportRow[] = [
    ...lines.map((item) => ({ key: item.key, cardId: cardOf(item.card)!.id, type: item.type, date: item.date, merchant: item.merchant, amount: item.amount, currency: item.currency, statementCutoff: item.statement_cutoff })),
    ...file.payments.map((item) => ({ key: item.key, cardId: cardOf(item.card)!.id, type: "payment", date: item.date, merchant: item.merchant, amount: item.amount, currency: item.currency, statementCutoff: item.applies_to_statement_cutoff })),
  ];
  const identity = new Map(classifyImportRows(rows, context.movements, context.payments).map((item) => [item.key, item]));
  const plans = new Map<string, Plan>();
  const categories = new Map(context.categories.map((category) => [category.name.toLocaleLowerCase("es-CO"), category.id]));

  const review: ReviewRow[] = rows.map((row) => {
    const { status, reason, match } = identity.get(row.key)!;
    const result: ReviewRow = { ...row, status, reason, match };
    const line = lines.find((item) => item.key === row.key);
    if (!line) return result;
    if (line.installments_count > 1) result.installment = { current: line.current_installment ?? 1, count: line.installments_count };
    const fee = fees.get(line.key);
    if (fee) result.fee = fee.amount;
    if (status !== "new" && status !== "conflict") return result;
    const card = cardOf(line.card)!;
    if (line.type === "advance_fee") return { ...result, status: "blocked", blocked: "Es una comisión sin su avance en el archivo." };
    const fxRate = line.currency === "USD" ? line.fx_rate ?? context.rates[line.date] ?? null : null;
    if (line.currency === "USD" && !fxRate) return { ...result, status: "blocked", blocked: `Falta la TRM del ${line.date}.` };
    // D30: a forced statement only within the statement of the file.
    const override = !!line.statement_override && ownCutoffs.has(`${line.card}:${line.statement_cutoff}`);
    if (line.statement_override && !override) warnings.push(`${line.merchant} (${line.date}): se ignora el extracto forzado porque no es el del archivo.`);
    const transactionCard: TransactionCard = { id: card.id, cutoffDay: card.cutoffDay, paymentDay: card.paymentDay, purchaseRateEa: card.purchaseRateEa, advanceRateEa: card.advanceRateEa, advanceFee: card.advanceFee, amortizationMethod: card.amortizationMethod, interestMode: card.interestMode };
    try {
      const { payload } = importPlanPayload({ ...line, statement_override: override }, transactionCard, fee?.amount ?? null, fxRate);
      payload.category_id = line.category ? categories.get(line.category.toLocaleLowerCase("es-CO")) ?? null : null;
      plans.set(line.key, { payload, fee: fee ? { key: fee.key, merchant: fee.merchant } : null });
    } catch (error) {
      return { ...result, status: "blocked", blocked: error instanceof Error ? error.message : "No pudimos calcular su plan." };
    }
    return result;
  });

  return {
    ok: true, plans,
    review: {
      rows: review, warnings,
      statements: statements.map((item) => {
        const card = cardOf(item.card)!;
        const fileCard = file.cards.find((entry) => entry.key === item.card)!;
        return {
          cardId: card.id, cardName: card.name, last4: card.last4, color: card.color, cutoffDate: item.cutoff_date, dueDate: item.due_date,
          bank: item.balances.map((balance) => ({ currency: balance.currency, minimum: balance.real_minimum ?? null, total: balance.real_total ?? null })),
          bankAvailable: fileCard.bank_available_credit ?? null,
        };
      }),
    },
  };
}

/** Lines imported by default: new ones. A conflict waits for the owner (D55). */
export function defaultDecisions(review: ImportReview): Record<string, ImportDecision> {
  const decisions: Record<string, ImportDecision> = {};
  for (const row of review.rows) {
    if (row.status === "new") decisions[row.key] = "import";
    else if (row.status === "conflict") decisions[row.key] = "skip";
  }
  return decisions;
}

/**
 * What the RPC receives: accepted lines built on the server, links of "Es el mismo" and the bank values. Decisions that do
 * not fit a line (a payment, an imported line, a link without a match) are ignored.
 */
export function buildImportRequest(review: ImportReview, plans: Map<string, Plan>, decisions: Record<string, ImportDecision>): ImportRequest {
  const request: ImportRequest = { create: [], link: [], statements: [] };
  const defaults = defaultDecisions(review);
  for (const row of review.rows) {
    const decision = decisions[row.key] ?? defaults[row.key] ?? "skip";
    const plan = plans.get(row.key);
    if (decision === "import" && plan && (row.status === "new" || row.status === "conflict")) request.create.push({ key: row.key, ...plan });
    if (decision === "link" && row.status === "conflict" && row.match) request.link.push({ transaction_id: row.match.id, key: row.key });
  }
  request.statements = review.statements.map((item) => ({
    card_id: item.cardId, cutoff_date: item.cutoffDate,
    balances: item.bank.map((balance) => ({ currency: balance.currency, real_minimum: balance.minimum, real_total: balance.total })),
  }));
  return request;
}
