import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import { buildMonths, type MonthStatement } from "@/lib/domain/months";
import type { InboxDraft } from "../drafts";
import { activeInstallmentPurchases, summarizeCardStatements } from "../card-detail";
import { cardListEntries } from "../card-list";
import { cardStatementColumns, entriesTotal, groupOpenStatement } from "../card-overview";
import { historyPage } from "../history";
import { attentionItems, creditUsed, nextPayment, payableStatements } from "../home";
import { monthSavingsRequests } from "../month-page";
import { settingsCards } from "../settings";
import type { CurrencySummary, StatementBalancesData } from "../statement-balances";
import { buildStatementBreakdowns, statementNeighbors, type StatementCurrencyBreakdown, type StatementMovement } from "../statement-detail";
import { deferredInstallments, subscriptionCost } from "../subscription-list";
import { detailInstallments, transactionDeferralCost, type DetailTransaction } from "../transaction-detail";
import { capturedDraftStart } from "../transaction-form";
import type { MonthCardDetails } from "../supabase-months";

const d = (value: string | number) => new Decimal(value);
const today = "2026-11-27";

function summary(currency: "COP" | "USD", overrides: Partial<CurrencySummary> = {}): CurrencySummary {
  return { currency, hasCharges: true, minimum: d(0), debt: d(0), equivalentCop: d(0), estimatedInterest: d(0), realMinimum: null, realTotal: null, paidAt: null, ...overrides };
}

function statement(overrides: Partial<MonthStatement> & Pick<MonthStatement, "cardId" | "cutoffDate" | "dueDate">): MonthStatement {
  return { origin: "real", paidAt: null, recordedTotal: d(0), projectedTotal: d(0), unconvertedCharges: [], ...overrides };
}

function card(id: string, overrides: Partial<MonthCardDetails> = {}): MonthCardDetails {
  return {
    id, name: id, bank: "Banco ficticio", last4: "0000", color: "card-1", archived: false, cutoffDay: 15, paymentDay: 2, handlingFee: d(0),
    used: d(0), available: d(1000), utilization: d(0), creditLimit: d(1000), copUsed: d(0), usdNet: d(0), fxRate: d(4000), fxEstimated: false, ...overrides,
  };
}

/** Two cards with corte 15 / pago 2 and corte 25 / pago 10, on 27 Nov 2026. */
const statements: MonthStatement[] = [
  statement({ id: "v1", cardId: "visa", periodStart: "2026-09-16", cutoffDate: "2026-10-15", dueDate: "2026-11-02", paidAt: "2026-11-01", recordedTotal: d(194900), debt: { COP: d(194900), USD: d(0) } }),
  statement({ id: "v2", cardId: "visa", periodStart: "2026-10-16", cutoffDate: "2026-11-15", dueDate: "2026-12-02", recordedTotal: d(1178800), debt: { COP: d(3845775), USD: d(0) },
    charges: [{ id: "i", origin: "real", concept: "interest", categoryId: null, amountCop: d(41300), estimated: true }] }),
  statement({ id: "v3", cardId: "visa", periodStart: "2026-11-16", cutoffDate: "2026-12-15", dueDate: "2027-01-02", recordedTotal: d(734500), projectedTotal: d(47900),
    charges: [{ id: "p", origin: "projected", concept: "subscriptions", categoryId: null, amountCop: d(47900), amount: d(47900), currency: "COP", subscriptionId: "yt", date: "2026-12-06" }] }),
  statement({ cardId: "visa", origin: "virtual", cutoffDate: "2027-01-15", dueDate: "2027-02-02", projectedTotal: d(601400) }),
  statement({ id: "m0", cardId: "master", periodStart: "2026-08-26", cutoffDate: "2026-09-25", dueDate: "2026-10-10", recordedTotal: d(50000), debt: { COP: d(50000), USD: d(0) } }),
  statement({ id: "m2", cardId: "master", periodStart: "2026-10-26", cutoffDate: "2026-11-25", dueDate: "2026-12-10", recordedTotal: d(1640500), recordedUsd: d(9), debt: { COP: d(4180300), USD: d("148.2") },
    paidByCurrency: { COP: null, USD: null } }),
];
const months = buildMonths(statements, today);

describe("home models", () => {
  it("lists cut statements still to pay per currency, oldest due date first", () => {
    const payable = payableStatements(months, today);
    expect(payable.map((item) => item.statementId)).toEqual(["m0", "v2", "m2"]);
    expect(payable[2]).toMatchObject({ month: "2026-12", cop: d(1640500), usd: d(9), estimated: false });
    expect(payable[1]!.estimated).toBe(true);
  });

  it("leaves out a currency already marked paid (D26)", () => {
    const marked = buildMonths([statement({ id: "m", cardId: "master", cutoffDate: "2026-11-25", dueDate: "2026-12-10", recordedTotal: d(100), recordedUsd: d(9), paidByCurrency: { COP: null, USD: "2026-11-26" } })], today);
    expect(payableStatements(marked, today)[0]).toMatchObject({ cop: d(100), usd: d(0) });
  });

  it("takes the next payment from the nearest payment month due today or later, without overdue statements", () => {
    const next = nextPayment(months, today)!;
    expect(next.month).toBe("2026-12");
    expect(next.dueDate).toBe("2026-12-02");
    expect(next.days).toBe(5);
    expect(next.cop.toString()).toBe("2819300");
    expect(next.usd.toString()).toBe("9");
    expect(next.estimated).toBe(true);
    expect(next.statements.map((item) => item.cardId)).toEqual(["visa", "master"]);
    expect(nextPayment(buildMonths([], today), today)).toBeNull();
  });

  it("adds Cupo usado per currency over every card, archived ones included (D66)", () => {
    const used = creditUsed([card("a", { copUsed: d(1000), usdNet: d("10.5") }), card("b", { archived: true, copUsed: d(500), usdNet: d(-1) })]);
    expect(used.cop.toString()).toBe("1500");
    expect(used.usd.toString()).toBe("9.5");
    expect(used.fxEstimated).toBe(false);
    expect(creditUsed([card("a", { usdNet: d(5), fxEstimated: true })]).fxEstimated).toBe(true);
    expect(creditUsed([card("a", { usdNet: d(0), fxEstimated: true })]).fxEstimated).toBe(false);
  });

  it("orders Para atender: overdue, due soon, drafts, statements to close and price changes", () => {
    const drafts = [
      { id: "d1", subscription: null },
      { id: "d2", subscription: { name: "Servicio", change: { charged: "86900", expected: "83350", currency: "COP" } } },
      { id: "d3", subscription: { name: "Otro", change: null } },
    ] as unknown as InboxDraft[];
    const items = attentionItems({ months, drafts, toReview: [{ cardId: "visa", cutoffDate: "2026-11-15", dueDate: "2026-12-02" }], today });
    expect(items.map((item) => item.kind)).toEqual(["overdue", "due_soon", "drafts", "reconcile", "price_change"]);
    expect(items[0]).toMatchObject({ statement: { statementId: "m0" } });
    expect(items[1]).toMatchObject({ days: 5, statement: { statementId: "v2" } });
    expect(items[2]).toEqual({ kind: "drafts", count: 3 });
    expect(items[4]).toEqual({ kind: "price_change", draftId: "d2", name: "Servicio", charged: d(86900), expected: d(83350), currency: "COP" });
    expect(attentionItems({ months: buildMonths([], today), drafts: [], toReview: [], today })).toEqual([]);
  });
});

describe("card list and card overview models", () => {
  it("builds the four figures of each card", () => {
    const entries = cardListEntries({
      cards: [card("visa"), card("master"), card("vieja", { archived: true, cutoffDay: 5, paymentDay: 20 })],
      months, purchases: new Map(), today,
      subscriptions: [{ cardId: "visa", status: "active" }, { cardId: "visa", status: "paused" }, { cardId: "visa", status: "cancelled" }],
    });
    expect(entries.map((entry) => entry.card.id)).toEqual(["master", "vieja", "visa"]);
    const [master, archived, visa] = entries;
    expect(visa!.nextPayment?.statementId).toBe("v2");
    expect(visa!.debt).toMatchObject({ cutoffDate: "2026-11-15", cop: d(3845775), estimated: true });
    expect(visa!.open).toMatchObject({ cutoffDate: "2026-12-15", cop: d(782400), usd: d(0) });
    expect(visa!.subscriptions).toBe(2);
    expect(master!.nextPayment?.statementId).toBe("m0");
    expect(master!.debt).toMatchObject({ cutoffDate: "2026-11-25", cop: d(4180300), usd: d("148.2") });
    expect(archived!.nextPayment).toBeNull();
    expect(archived!.debt).toBeNull();
    expect(archived!.open).toEqual({ cutoffDate: "2026-12-05", dueDate: "2026-12-20", cop: d(0), usd: d(0), estimated: false });
  });

  it("adds the principal still to pay of installment purchases per currency", () => {
    const entry = (currency: "COP" | "USD", pending: number) => ({ purchase: { id: currency, merchant: null, currency, installments_count: 2 }, progress: { current: 1, count: 2, pendingPrincipal: d(pending) }, currentInstallment: {} as never, lastCutoffDate: null });
    const [visa] = cardListEntries({ cards: [card("visa")], months, purchases: new Map([["visa", [entry("COP", 100), entry("USD", 3), entry("COP", 50)]]]), subscriptions: [], today });
    expect(visa!.installmentsInProgress).toHaveLength(3);
    expect(visa!.pendingPrincipal.COP.toString()).toBe("150");
    expect(visa!.pendingPrincipal.USD.toString()).toBe("3");
  });

  it("gives each statement of a card its state by payment month (D65)", () => {
    expect(cardStatementColumns(months, "visa", today).map(({ month, state, cop, estimated }) => [month, state, cop.toString(), estimated])).toEqual([
      ["2026-11", "paid", "194900", false], ["2026-12", "pending", "1178800", true], ["2027-01", "open", "782400", false], ["2027-02", "estimated", "601400", false],
    ]);
    expect(cardStatementColumns(months, "master", today).map((column) => column.state)).toEqual(["overdue", "pending"]);
  });

  it("groups the open statement and keeps its total", () => {
    const entry = (id: string, amount: string, extra: object = {}) => ({ id, transactionId: id, kind: "movement" as const, type: "purchase", merchant: id, date: "2026-11-20", currency: "COP" as const, amount, amountCop: amount, prepaid: false, ...extra });
    const breakdowns: StatementCurrencyBreakdown[] = [{
      summary: summary("COP"),
      concepts: [
        { key: "single_purchases", total: "100", estimated: false, entries: [entry("mercado", "100")] },
        { key: "installments", total: "80", estimated: false, entries: [entry("nueva", "30", { kind: "installment", number: 1, date: "2026-11-19" }), entry("vieja", "50", { kind: "installment", number: 3, date: "2026-09-01" })] },
        { key: "subscriptions", total: "20", estimated: false, entries: [entry("musica", "20")] },
        { key: "cash_advances", total: "0", estimated: false, entries: [] },
        { key: "interest", total: "7", estimated: true, entries: [] },
        { key: "refunds", total: "5", estimated: false, entries: [entry("devolucion", "5")] },
      ],
      payments: { total: "0", entries: [] },
    }];
    const projected = [
      { id: "p1", origin: "projected" as const, concept: "subscriptions" as const, categoryId: null, amountCop: d(40), amount: d(10), currency: "USD" as const, subscriptionId: "nube", date: "2026-12-06" },
      { id: "p2", origin: "projected" as const, concept: "subscriptions" as const, categoryId: null, amountCop: d(15), subscriptionId: "video", date: "2026-12-01" },
      { id: "p3", origin: "projected" as const, concept: "handling_fees" as const, categoryId: null, amountCop: d(9) },
    ];
    const [cop, usd] = groupOpenStatement(breakdowns, "2026-11-16", projected);
    expect(cop!.newPurchases.map((item) => item.id)).toEqual(["mercado", "nueva"]);
    expect(cop!.installments.map((item) => item.id)).toEqual(["vieja"]);
    expect(cop!.subscriptions.charged.map((item) => item.id)).toEqual(["musica"]);
    expect(cop!.subscriptions.projected).toEqual([{ subscriptionId: "video", date: "2026-12-01", currency: "COP", amount: d(15) }]);
    expect(cop!.interest).toEqual({ total: d(7), estimated: true });
    expect(cop!.others.map((item) => item.key)).toEqual(["refunds"]);
    expect(cop!.total.toString()).toBe("217");
    expect(entriesTotal(cop!.newPurchases).toString()).toBe("130");
    expect(usd).toMatchObject({ currency: "USD", newPurchases: [], total: d(10) });
  });
});

describe("statement detail models", () => {
  const movement = (id: string, type: string, amount: string, extra: Partial<StatementMovement> = {}): StatementMovement => ({ id, type, source: "manual", merchant: id, date: "2026-11-10", currency: "COP", amount, amount_cop: amount, installments_count: 1, ...extra });
  const zeros = { single_purchases: "0", installments: "0", subscriptions: "0", cash_advances: "0", interest: "0", handling_fees: "0", insurance: "0", adjustments: "0", refunds: "0", payments: "0" };
  const balances = { totals: { COP: { ...zeros, statement_id: "s", currency: "COP", has_charges: true, single_purchases: "100", subscriptions: "20", payments: "60", total_calculated: "120", total_cop: "120", pending_principal: "0", total_debt: "120" } }, marks: {} } as unknown as StatementBalancesData;

  it("groups movements by concept and installments by their purchase currency (R5, D33)", () => {
    const [cop, usd] = buildStatementBreakdowns({
      visible: [summary("COP"), summary("USD", { estimatedInterest: d("1.5") })], balances,
      movements: [movement("mercado", "purchase", "100", { prepaid: true }), movement("musica", "purchase", "20", { source: "subscription" }), movement("pago", "payment", "60"), movement("diferida", "purchase", "300", { installments_count: 3 }), movement("otro", "unknown", "1")],
      installments: [{ transaction_id: "curso", number: 2, total: "15.63", total_cop: "62520" }, { transaction_id: "perdida", number: 1, total: "10", total_cop: "10" }],
      parents: [movement("curso", "purchase", "30", { currency: "USD", installments_count: 2, date: "2026-11-03" })],
    });
    const byKey = (breakdown: typeof cop, key: string) => breakdown!.concepts.find((item) => item.key === key)!;
    expect(byKey(cop, "single_purchases").entries).toMatchObject([{ id: "mercado", prepaid: true }]);
    expect(byKey(cop, "subscriptions").entries.map((item) => item.id)).toEqual(["musica"]);
    expect(byKey(cop, "installments").entries).toEqual([{ id: "perdida-1", transactionId: "perdida", kind: "installment", type: "purchase", merchant: null, date: undefined, number: 1, installmentsCount: undefined, currency: "COP", amount: "10", amountCop: "10", prepaid: false }]);
    expect(cop!.payments).toMatchObject({ total: "60", entries: [{ id: "pago" }] });
    expect(byKey(usd, "installments").entries).toMatchObject([{ id: "curso-2", merchant: "curso", date: "2026-11-03", number: 2, installmentsCount: 2, currency: "USD", amount: "15.63" }]);
    expect(byKey(usd, "interest")).toMatchObject({ total: "1.5", estimated: true });
    expect(byKey(cop, "interest")).toMatchObject({ total: "0", estimated: false });
    expect(byKey(usd, "refunds").total).toBe("0");
  });

  it("finds the previous and next statement, counting the open period", () => {
    const saved = [{ period_start: "2026-09-16", cutoff_date: "2026-10-15" }, { period_start: "2026-10-16", cutoff_date: "2026-11-15" }];
    expect(statementNeighbors(saved, "2026-12-15", "2026-11-15", today)).toEqual({ previous: "2026-10-15", next: "2026-12-15" });
    expect(statementNeighbors(saved, "2026-12-15", "2026-10-15", today)).toEqual({ previous: undefined, next: "2026-11-15" });
    expect(statementNeighbors([...saved, { period_start: "2026-11-16", cutoff_date: "2026-12-15" }], "2026-12-15", "2026-12-15", today)).toEqual({ previous: "2026-11-15", next: undefined });
  });
});

describe("card and transaction detail models", () => {
  const statements = [{ id: "s1", period_start: "2026-09-16", cutoff_date: "2026-10-15", due_date: "2026-11-02" }, { id: "s2", period_start: "2026-10-16", cutoff_date: "2026-11-15", due_date: "2026-12-02" }, { id: "s3", period_start: "2026-11-16", cutoff_date: "2026-12-15", due_date: "2027-01-02" }];
  const row = (transaction_id: string, number: number, statement_id: string | null, extra: object = {}) => ({ transaction_id, number, statement_id, before_tracking: false, principal: "100", interest: "0", total: "100", balance_after: String(300 - number * 100), principal_cop: "100", interest_cop: "0", total_cop: "100", ...extra });

  it("summarizes the statements of a card with the estimate flag (D66)", () => {
    const summaries = summarizeCardStatements(statements.slice(0, 1), new Map([["s1", { totals: { COP: { has_charges: true, total_calculated: "10", total_debt: "10" } }, marks: { COP: { paid_at: "2026-11-01", reconciled_at: null } } } as unknown as StatementBalancesData]]), new Map([["s1", { byCurrency: { COP: d(2), USD: d(0) }, copByCurrency: { COP: d(2), USD: d(0) } } as never]]));
    expect(summaries.get("s1")).toMatchObject({ cop: d(12), usd: d(0), paidAt: "2026-11-01", reconciledAt: null, estimated: true });
  });

  it("keeps only purchases still in progress, with the current installment and the last cutoff", () => {
    const purchases = [{ id: "nevera", merchant: "Nevera", currency: "COP" as const, installments_count: 3 }, { id: "pagada", merchant: null, currency: "COP" as const, installments_count: 2 }, { id: "vacia", merchant: null, currency: "COP" as const, installments_count: 2 }];
    const active = activeInstallmentPurchases(purchases, [row("nevera", 1, null, { before_tracking: true }), row("nevera", 2, "s2"), row("nevera", 3, "s3"), row("pagada", 1, "s1"), row("pagada", 2, "s2")], statements, today);
    expect(active).toHaveLength(1);
    expect(active[0]).toMatchObject({ progress: { current: 3, count: 3 }, lastCutoffDate: "2026-12-15", currentInstallment: { number: 3 } });
    expect(() => activeInstallmentPurchases(purchases, [row("nevera", 1, "missing")], statements, today)).toThrow("No pudimos consultar el corte de una cuota.");
  });

  it("maps the plan of a movement and its cost of deferring (F21)", () => {
    const byId = new Map(statements.map((item) => [item.id, item]));
    const items = detailInstallments([row("t", 1, "s2"), row("t", 2, "s3")], byId);
    expect(items.map((item) => item.cutoffDate)).toEqual(["2026-11-15", "2026-12-15"]);
    expect(detailInstallments([row("t", 1, null, { before_tracking: true })], byId)[0]!.cutoffDate).toBeNull();
    expect(() => detailInstallments([row("t", 1, "missing")], byId)).toThrow("No pudimos consultar el extracto de una cuota.");
    const transaction = { id: "t", type: "purchase", date: "2026-10-20", currency: "COP", amount: "200", fx_rate: null, rate_ea_applied: "0.285", interest_free: false } as DetailTransaction;
    const input = { transaction, card: { cutoff_day: 15, interest_mode: "on_balance" as const }, items, prepayments: [], counterparts: new Map(), statements: byId, today };
    expect(transactionDeferralCost(input)?.total.gt(0)).toBe(true);
    expect(transactionDeferralCost({ ...input, transaction: { ...transaction, type: "payment" } })).toBeNull();
    expect(transactionDeferralCost({ ...input, items: items.slice(0, 1) })).toBeNull();
  });
});

describe("other page models", () => {
  it("pages the history and clamps a page beyond the last", () => {
    const rows = Array.from({ length: 5 }, (_, index) => index);
    expect(historyPage(rows, 2, 2)).toEqual({ page: 2, pageCount: 3, shown: [2, 3] });
    expect(historyPage(rows, 9, 2)).toEqual({ page: 3, pageCount: 3, shown: [4] });
    expect(historyPage([], 1, 2)).toEqual({ page: 1, pageCount: 1, shown: [] });
  });

  it("adds the cost of active subscriptions in pesos and flags a missing TRM (F4, D4)", () => {
    const base = { cardId: "visa", categoryId: null, billingDay: 5, startDate: "2026-01-05", trialEndsAt: null, installmentsCount: 1 };
    const subscriptions = [
      { ...base, id: "a", name: "A", amount: "10000", currency: "COP" as const, frequency: "monthly" as const, status: "active" as const },
      { ...base, id: "b", name: "B", amount: "10", currency: "USD" as const, frequency: "yearly" as const, status: "active" as const },
      { ...base, id: "c", name: "C", amount: "5000", currency: "COP" as const, frequency: "monthly" as const, status: "paused" as const },
    ];
    const cost = subscriptionCost(subscriptions, "4000");
    expect(cost.missingRate).toBe(false);
    expect(cost.monthly.toFixed(2)).toBe("13333.33");
    expect(cost.yearly.toString()).toBe("160000");
    const missing = subscriptionCost(subscriptions, null);
    expect(missing.missingRate).toBe(true);
    expect(missing.monthly.toString()).toBe("10000");
    const deferred = deferredInstallments([{ ...subscriptions[0]!, installmentsCount: 2 }, { ...subscriptions[1]!, installmentsCount: 36, amount: "0.01" }, { ...subscriptions[0]!, id: "x", cardId: "otra", installmentsCount: 3 }],
      [{ id: "visa", name: "Visa", last4: "0000", color: "card-1", archived_at: null, usd_default_installments: 1, cutoff_day: 15, purchase_rate_ea: "0", amortization_method: "fixed_principal", interest_mode: "per_installment" }], null, today);
    expect(deferred).toEqual({ a: "5000" });
  });

  it("marks cards with installment purchases, whose interest mode is locked (D32)", () => {
    const raw = { name: "Visa", bank: "B", network: "Visa", last4: "0000", color: "card-1" as const, archived_at: null, credit_limit: "1", advance_fee: "0", handling_fee: "0", cutoff_day: 15, payment_day: 2, purchase_rate_ea: "0", advance_rate_ea: "0", amortization_method: "fixed_principal" as const, interest_mode: "on_balance" as const, usd_default_installments: 36, payment_allocation_rule: "bancolombia_priority" as const };
    expect(settingsCards([{ ...raw, id: "a" }, { ...raw, id: "b" }], new Set(["b"])).map((item) => item.hasInstallmentPurchases)).toEqual([false, true]);
  });

  it("asks for pay-in-full savings only for cut real statements with unpaid debt (F21)", () => {
    const month = buildMonths([
      statement({ id: "a", cardId: "visa", cutoffDate: "2026-11-15", dueDate: "2026-12-02", debt: { COP: d(10), USD: d(2) }, paidByCurrency: { COP: null, USD: "2026-11-20" } }),
      statement({ id: "b", cardId: "master", cutoffDate: "2026-11-25", dueDate: "2026-12-10", debt: { COP: d(0), USD: d(0) } }),
      statement({ id: "c", cardId: "otra", cutoffDate: "2026-11-30", dueDate: "2026-12-20", debt: { COP: d(5), USD: d(0) } }),
      statement({ cardId: "virtual", origin: "virtual", cutoffDate: "2026-11-20", dueDate: "2026-12-05" }),
    ], today).find((item) => item.month === "2026-12")!;
    expect(monthSavingsRequests(month, today)).toEqual([{ id: "a", cardId: "visa", cutoffDate: "2026-11-15", currencies: ["COP"] }]);
  });

  it("prefills a captured draft keeping the alert's currency (R10)", () => {
    const draft = { id: "d", status: "pending", phrase: "Compraste", cardId: "visa", last4: "0000", type: "purchase", amount: "81000", currency: "COP", merchantRaw: "GOOGLE", occurredOn: "2026-11-26", occurredTime: null, statementCutoff: null, readByAi: false, candidates: [], subscription: null, createdAt: "", suggestions: { merchantName: null, categoryId: null, subscriptionId: null, billingCurrency: "USD", installmentsCount: null, isInternational: null, confidence: "media", reason: null } } as InboxDraft;
    const cards = [{ id: "visa" }] as never;
    const start = capturedDraftStart(draft, cards, [], today, "4000");
    expect(start).toMatchObject({ id: "d", billingCurrency: "USD", unknownCard: false, values: { cardId: "visa", currency: "COP", amount: "81.000" } });
    expect(capturedDraftStart({ ...draft, suggestions: null, cardId: "otra" }, cards, [], today, null)).toMatchObject({ billingCurrency: null, unknownCard: true, values: { cardId: "" } });
    expect(capturedDraftStart({ ...draft, status: "unknown_card" }, cards, [], today, null).unknownCard).toBe(true);
  });
});
