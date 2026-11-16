import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";
import { availablePaymentMonths, buildMonths, cardCompositionPercentages, confirmedPaymentTotal, monthOpenGrowth, historyMonthCapacity, historyMonthNextBlock, historyMonthPage, monthBreakdown, monthComparison, monthDateBounds, parsePaymentMonth, overdueStatements, paymentMonth, previousPaymentMonth, projectStatements, projectSubscriptionCharges, purchaseMonthSpending, selectMonthStatementScope, statementKnownTotal, type MonthStatement } from "../months";
import { statementPeriod } from "../statements";
import { formatSpendingComparison } from "../../format";

describe("confirmed payment total", () => {
  it("adds only real statements marked as paid, so pending + confirmed + projected equals the month total", () => {
    const base = { cutoffDate: "2026-10-15", dueDate: "2026-11-02", unconvertedCharges: [] };
    const [month] = buildMonths([
      { ...base, cardId: "a", origin: "real", paidAt: "2026-11-01", recordedTotal: new Decimal(410000), projectedTotal: new Decimal(0) },
      { ...base, cardId: "b", origin: "real", paidAt: null, cutoffDate: "2026-11-25", dueDate: "2026-11-28", recordedTotal: new Decimal(397000), projectedTotal: new Decimal(45000) },
      { ...base, cardId: "c", origin: "virtual", paidAt: null, recordedTotal: new Decimal(0), projectedTotal: new Decimal(18900) },
    ], "2026-11-15");
    const confirmed = confirmedPaymentTotal(month!);
    expect(confirmed.toString()).toBe("410000");
    expect(confirmed.plus(month!.pendingConfirmation).plus(month!.projected).eq(month!.total)).toBe(true);
    expect(confirmedPaymentTotal(buildMonths([], "2026-11-15")[0]!).isZero()).toBe(true);
    expect(monthOpenGrowth(month!).toString()).toBe("460900");
    expect(month!.billed.plus(monthOpenGrowth(month!)).eq(month!.total)).toBe(true);
  });
});

describe("detail month navigation", () => {
  it("keeps purchase-month spending separate and provides inclusive calendar bounds", () => {
    expect(monthDateBounds("2024-02")).toEqual({ first: "2024-02-01", last: "2024-02-29" });
    expect(purchaseMonthSpending([
      { date: "2024-02-10", type: "purchase", amountCop: new Decimal(600) },
      { date: "2024-02-11", type: "refund", amountCop: new Decimal(50) },
      { date: "2024-03-01", type: "purchase", amountCop: new Decimal(900) },
    ], "2024-02").toString()).toBe("550");
    expect(statementKnownTotal({ recordedTotal: new Decimal(100), projectedTotal: new Decimal(30) }).toString()).toBe("130");
  });
  it("accepts only valid calendar months", () => {
    expect(parsePaymentMonth("2026-11")).toBe("2026-11");
    expect(previousPaymentMonth("2026-01")).toBe("2025-12");
    expect(previousPaymentMonth("0001-01")).toBeNull();
    for (const value of ["2026-00", "2026-13", "0000-01", "2026-1", "2026-11-01", "x"]) {
      expect(parsePaymentMonth(value)).toBeNull();
    }
  });

  it("retains direct historical months, current month and only available future months within the horizon", () => {
    expect(availablePaymentMonths("2026-11-14", ["2020-03-05", "2026-09-02", "2026-09-10", "2028-01-02"], ["2027-01", "2027-11", "2027-12"]))
      .toEqual(["2020-03", "2026-09", "2026-11", "2027-01", "2027-11"]);
  });
});

describe("paymentMonth", () => {
  it("uses the due date rather than the cutoff month", () => {
    expect(paymentMonth("2026-11-05")).toBe("2026-11");
    expect(paymentMonth("2026-11-02")).toBe("2026-11");
    expect(paymentMonth("2026-11-30")).toBe("2026-11");
  });

  it("rejects invalid dates", () => {
    expect(() => paymentMonth("2026-02-29")).toThrow();
  });

  it("assigns cutoff 31/payment 5 and cutoff 15/payment 2 to November", () => {
    expect(paymentMonth(statementPeriod({ cutoffDay: 31, paymentDay: 5 }, "2026-10-31").dueDate)).toBe("2026-11");
    expect(paymentMonth(statementPeriod({ cutoffDay: 15, paymentDay: 2 }, "2026-10-15").dueDate)).toBe("2026-11");
    expect(statementPeriod({ cutoffDay: 15, paymentDay: 30 }, "2026-11-15").dueDate).toBe("2026-11-30");
  });
});

describe("historyMonthPage", () => {
  it("uses twelve months per requested history block and rejects invalid requests", () => {
    expect(historyMonthCapacity("2")).toBe(24);
    expect(historyMonthCapacity(undefined)).toBe(12);
    expect(historyMonthCapacity("0")).toBe(12);
    expect(historyMonthCapacity("2.5")).toBe(12);
    expect(historyMonthCapacity("99999999999999999999")).toBe(12);
    expect(historyMonthNextBlock("2")).toBe("3");
  });
  it("paginates distinct months without counting multiple statements twice", () => {
    const dueDates = ["2026-10-02", "2026-10-05", "2026-09-02", "2026-08-02", "2026-07-02", "2026-11-02"];
    expect(historyMonthPage(dueDates, "2026-11-14", 2)).toEqual({ months: ["2026-10", "2026-09"], nextBefore: "2026-09" });
    expect(historyMonthPage(dueDates, "2026-11-14", 2, "2026-09")).toEqual({ months: ["2026-08", "2026-07"], nextBefore: null });
  });

  it("returns an empty page without a cursor when there is no history", () => {
    expect(historyMonthPage([], "2026-11-14", 12)).toEqual({ months: [], nextBefore: null });
  });

  it("rejects invalid page sizes and month cursors", () => {
    expect(() => historyMonthPage([], "2026-11-14", 0)).toThrow();
    expect(() => historyMonthPage([], "2026-11-14", 12, "2026-13")).toThrow();
  });
});

describe("selectMonthStatementScope", () => {
  it("keeps selected history, every older overdue statement and all future metadata", () => {
    const make = (id: string, dueDate: string, paidAt: string | null = "paid") => ({
      id, cardId: "a", periodStart: "2024-01-01", cutoffDate: "2024-01-15", dueDate, paidAt,
    });
    const result = selectMonthStatementScope([
      make("selected", "2026-10-02"), make("other-paid", "2026-09-02"),
      make("overdue", "2026-08-02", null), make("current", "2026-11-20", null),
      make("future", "2028-02-02", null),
    ], "2026-11-14", 1);
    expect(result.history.months).toEqual(["2026-10"]);
    expect(result.statements.map((item) => item.id)).toEqual(["selected", "overdue", "current", "future"]);
    expect(result.history.nextBefore).toBe("2026-10");
  });
});

describe("buildMonths", () => {
  const statement: MonthStatement = {
    cardId: "visa",
    origin: "real",
    cutoffDate: "2026-11-10",
    dueDate: "2026-11-20",
    paidAt: null,
    recordedTotal: new Decimal("500000"),
    projectedTotal: new Decimal(0),
    unconvertedCharges: [],
  };

  it("separates billed, open and projected amounts without subtracting payments", () => {
    const [month] = buildMonths([
      statement,
      { ...statement, cardId: "mastercard", cutoffDate: "2026-11-25", recordedTotal: new Decimal("100000"), projectedTotal: new Decimal("20000"), paidAt: "2026-11-01" },
    ], "2026-11-13");
    expect(month).toBeDefined();
    if (!month) throw new Error("Falta el mes actual");
    expect(month.total.toString()).toBe("620000");
    expect(month.billed.toString()).toBe("500000");
    expect(month.openRecorded.toString()).toBe("100000");
    expect(month.projected.toString()).toBe("20000");
    expect(month.pendingConfirmation.toString()).toBe("500000");
    expect(month.status).toBe("pending");
  });

  it("preserves an empty current month and excludes empty past months", () => {
    const months = buildMonths([], "2026-11-13");
    expect(months).toHaveLength(1);
    expect(months[0]).toMatchObject({ month: "2026-11", kind: "current", status: null });
  });

  it("prioritizes overdue and keeps future estimates and paid historical months", () => {
    const months = buildMonths([
      { ...statement, dueDate: "2026-10-05", cutoffDate: "2026-09-30" },
      { ...statement, dueDate: "2026-10-06", cutoffDate: "2026-09-30", paidAt: "2026-10-01" },
      { ...statement, dueDate: "2026-12-05", cutoffDate: "2026-11-30", paidAt: "2026-11-01" },
      { ...statement, dueDate: "2026-09-05", cutoffDate: "2026-08-31", paidAt: "2026-09-01" },
    ], "2026-11-13");
    expect(months.map(({ month, status }) => [month, status])).toEqual([
      ["2026-09", "paid"], ["2026-10", "overdue"], ["2026-11", null], ["2026-12", "estimated"],
    ]);
  });

  it("keeps unconverted charges distinct from known COP and marks projections pending", () => {
    const [month] = buildMonths([{
      ...statement,
      origin: "virtual",
      cutoffDate: "2026-11-25",
      recordedTotal: new Decimal(0),
      unconvertedCharges: [{ subscriptionId: "sub", date: "2026-11-20", amountUsd: new Decimal("15.99") }],
    }], "2026-11-13");
    expect(month).toBeDefined();
    if (!month) throw new Error("Falta el mes actual");
    expect(month).toMatchObject({ complete: false, status: "pending" });
    expect(month.total.isZero()).toBe(true);
    expect(month.unconvertedCharges[0]?.amountUsd.toString()).toBe("15.99");
  });

  it("does not reduce confirmation pending for a partial payment or a bank reference total", () => {
    const charges = [
      { id: "purchase", origin: "real" as const, concept: "single_purchases" as const, categoryId: null, amountCop: new Decimal(500000) },
      { id: "payment", origin: "real" as const, concept: "payments" as const, categoryId: null, amountCop: new Decimal(200000) },
    ];
    const unpaid = { ...statement, charges, realTotal: new Decimal(900000) };
    const paid = { ...unpaid, paidAt: "2026-11-13" };
    const unpaidMonth = buildMonths([unpaid], "2026-11-13")[0];
    const paidMonth = buildMonths([paid], "2026-11-13")[0];
    expect(unpaidMonth?.pendingConfirmation.toString()).toBe("500000");
    expect(paidMonth?.pendingConfirmation.toString()).toBe("0");
    expect(unpaidMonth?.total.toString()).toBe("500000");
    expect(paidMonth?.total.toString()).toBe("500000");
    expect(paidMonth?.status).toBe("paid");
  });

  it("provides card totals and statement states without losing negative subtotals", () => {
    const [month] = buildMonths([
      { ...statement, id: "a", recordedTotal: new Decimal(100) },
      { ...statement, id: "b", cardId: "mastercard", recordedTotal: new Decimal(-20), dueDate: "2026-11-10" },
    ], "2026-11-13");
    expect(month?.cards.map((card) => [card.cardId, card.total.toString()])).toEqual([["visa", "100"], ["mastercard", "-20"]]);
    expect(month?.cards[1]?.statements[0]?.status).toBe("overdue");
    expect(month?.canUseProportionalBar).toBe(false);
  });

  it("rounds valid card composition to exactly 100 percent", () => {
    const [month] = buildMonths([
      { ...statement, cardId: "a", recordedTotal: new Decimal(1) },
      { ...statement, cardId: "b", recordedTotal: new Decimal(1) },
      { ...statement, cardId: "c", recordedTotal: new Decimal(1) },
    ], "2026-11-13");
    if (!month) throw new Error("Falta el mes");
    expect(cardCompositionPercentages(month)?.map((item) => item.percent)).toEqual([34, 33, 33]);
  });

  it("preserves zero shares and allocates rounding to the largest remainder", () => {
    const [month] = buildMonths([
      { ...statement, cardId: "a", recordedTotal: new Decimal("999999999999.99") },
      { ...statement, cardId: "b", recordedTotal: new Decimal("499999999999.99") },
      { ...statement, cardId: "c", recordedTotal: new Decimal(0) },
    ], "2026-11-13");
    if (!month) throw new Error("Falta el mes");
    expect(cardCompositionPercentages(month)).toEqual([
      { cardId: "a", percent: 67 },
      { cardId: "b", percent: 33 },
      { cardId: "c", percent: 0 },
    ]);
  });

  it("returns no proportional composition for zero or negative totals or negative cards", () => {
    for (const amounts of [[0], [-1], [10, -1]]) {
      const [month] = buildMonths(amounts.map((amount, index) => ({
        ...statement, cardId: String(index), recordedTotal: new Decimal(amount),
      })), "2026-11-13");
      if (!month) throw new Error("Falta el mes");
      expect(cardCompositionPercentages(month)).toBeNull();
    }
  });
});

describe("projectSubscriptionCharges", () => {
  const subscription = {
    startDate: "2023-01-01",
    frequency: "monthly" as const,
    billingDay: 31,
    status: "active" as const,
    cardArchived: false,
  };

  it("includes today and clamps billing days in leap and non-leap February", () => {
    expect(projectSubscriptionCharges(subscription, "2023-02-28", "2023-03-31")).toEqual(["2023-02-28", "2023-03-31"]);
    expect(projectSubscriptionCharges(subscription, "2024-02-01", "2024-02-29")).toEqual(["2024-02-29"]);
  });

  it("excludes paused, cancelled and archived cards", () => {
    for (const candidate of [
      { ...subscription, status: "paused" as const },
      { ...subscription, status: "cancelled" as const },
      { ...subscription, cardArchived: true },
    ]) {
      expect(projectSubscriptionCharges(candidate, "2024-01-01", "2024-12-31")).toEqual([]);
    }
  });

  it("includes the trial end date and respects annual recurrence and start date", () => {
    expect(projectSubscriptionCharges({
      ...subscription,
      startDate: "2024-02-01",
      frequency: "yearly",
      trialEndsAt: "2025-02-28",
    }, "2023-01-01", "2026-12-31")).toEqual(["2025-02-28", "2026-02-28"]);
  });

  it("matches the cron annual leap-day case", () => {
    expect(projectSubscriptionCharges({
      ...subscription, startDate: "2027-02-28", frequency: "yearly", billingDay: 29,
    }, "2028-02-01", "2028-03-31")).toEqual(["2028-02-29"]);
  });
});

describe("projectStatements", () => {
  const card = { id: "visa", cutoffDay: 25, paymentDay: 28, archived: false, handlingFee: new Decimal(10000) };
  const subscription = {
    id: "sub", cardId: "visa", categoryId: "entertainment", amount: new Decimal(20),
    currency: "USD" as const, startDate: "2026-01-01", frequency: "monthly" as const,
    billingDay: 20, status: "active" as const,
  };
  const base = { cards: [card], statements: [], movements: [], installments: [], subscriptions: [subscription], today: "2026-11-13", fxRate: new Decimal(4000) };

  it("projects current and future months with virtual handling fees", () => {
    const result = projectStatements(base);
    const current = result.statements.find((s) => s.dueDate === "2026-11-28");
    expect(current?.projectedTotal.toString()).toBe("90000");
    expect(current?.charges.map((c) => c.concept)).toEqual(["handling_fees", "subscriptions"]);
    expect(result.statements.filter((s) => paymentMonth(s.dueDate) > "2026-11")).toHaveLength(12);
  });

  it("gives a real charge priority even when its saved statement differs", () => {
    const result = projectStatements({
      ...base,
      statements: [{ id: "old", cardId: "visa", periodStart: "2026-09-16", cutoffDate: "2026-10-15", dueDate: "2026-11-28", paidAt: null }],
      movements: [{ id: "charge", statementId: "old", type: "purchase", source: "subscription", amountCop: new Decimal(75000), installmentsCount: 1, categoryId: "entertainment", subscriptionId: "sub", date: "2026-11-20" }],
    });
    expect(result.statements.find((s) => s.id === "old")?.recordedTotal.toString()).toBe("75000");
    const current = result.statements.filter((s) => s.dueDate === "2026-11-28");
    expect(current.flatMap((s) => s.charges).filter((c) => c.subscriptionId === "sub")).toHaveLength(1);
  });

  it("keeps unknown USD separate, preserves archived real data and detects out-of-range commitments", () => {
    const result = projectStatements({
      ...base, fxRate: null,
      cards: [card, { ...card, id: "archived", archived: true }],
      statements: [{ id: "later", cardId: "archived", periodStart: "2027-12-01", cutoffDate: "2027-12-25", dueDate: "2027-12-28", paidAt: null }],
    });
    expect(result.hasLaterCommitments).toBe(true);
    expect(result.statements.some((s) => s.cardId === "archived")).toBe(false);
    expect(result.statements[0]?.unconvertedCharges[0]?.amountUsd.toString()).toBe("20");
  });

  it("uses saved extract amounts, installments, refunds and excludes payments", () => {
    const result = projectStatements({
      ...base, cards: [{ ...card, handlingFee: new Decimal(0) }], subscriptions: [],
      statements: [{ id: "s", cardId: "visa", periodStart: "2026-10-26", cutoffDate: "2026-11-25", dueDate: "2026-11-28", paidAt: null }],
      movements: [
        { id: "purchase", statementId: "s", type: "purchase", amountCop: new Decimal(1200), installmentsCount: 12, categoryId: "food", date: "2026-11-01" },
        { id: "refund", statementId: "s", type: "refund", amountCop: new Decimal(30), categoryId: "food", date: "2026-11-01" },
        { id: "payment", statementId: "s", type: "payment", amountCop: new Decimal(40), categoryId: null, date: "2026-11-01" },
      ],
      installments: [{ id: "i", statementId: "s", categoryId: "food", totalCop: new Decimal(110) }],
    });
    expect(result.statements[0]?.recordedTotal.toString()).toBe("80");
    expect(monthBreakdown(result.statements).total.toString()).toBe("80");
  });

  it("adds a COP projection to an existing real extract without another handling fee", () => {
    const result = projectStatements({
      ...base,
      cards: [{ ...card, handlingFee: new Decimal(0) }],
      subscriptions: [{ ...subscription, currency: "COP" }],
      statements: [{ id: "s", cardId: "visa", periodStart: "2026-10-26", cutoffDate: "2026-11-25", dueDate: "2026-11-28", paidAt: null }],
    });
    expect(result.statements.find((s) => s.id === "s")?.projectedTotal.toString()).toBe("20");
    expect(result.statements.find((s) => s.id === "s")?.charges).toHaveLength(1);
  });

  it("does not fabricate an extract when a saved cutoff is outside the horizon", () => {
    const result = projectStatements({
      ...base,
      cards: [{ ...card, handlingFee: new Decimal(0) }],
      statements: [{ id: "s", cardId: "visa", periodStart: "2026-10-26", cutoffDate: "2026-11-25", dueDate: "2028-01-01", paidAt: null }],
    });
    expect(result.statements.some((s) => s.cutoffDate === "2026-11-25")).toBe(false);
    expect(result.hasLaterCommitments).toBe(true);
  });

  it("does not project into a saved extract whose payment month has passed", () => {
    const result = projectStatements({
      ...base, cards: [{ ...card, handlingFee: new Decimal(0) }],
      statements: [{ id: "s", cardId: "visa", periodStart: "2026-10-01", cutoffDate: "2026-11-25", dueDate: "2026-10-28", paidAt: null }],
    });
    expect(result.statements.find((s) => s.id === "s")?.projectedTotal.isZero()).toBe(true);
  });

  it("limits by payment month rather than charge month", () => {
    const result = projectStatements({
      ...base, cards: [{ ...card, cutoffDay: 25, paymentDay: 5, handlingFee: new Decimal(0) }],
      subscriptions: [{ ...subscription, billingDay: 30 }],
    });
    expect(result.statements.every((s) => s.dueDate <= "2027-11-30")).toBe(true);
  });

  it("accepts an installment whose statement has no other movements", () => {
    const result = projectStatements({
      ...base, subscriptions: [], cards: [],
      statements: [{ id: "s", cardId: "visa", periodStart: "2026-10-26", cutoffDate: "2026-11-25", dueDate: "2026-11-28", paidAt: null }],
      installments: [{ id: "i", statementId: "s", categoryId: null, totalCop: new Decimal(10) }],
    });
    expect(result.statements[0]?.recordedTotal.toString()).toBe("10");
  });

  it("keeps the same total when a projected charge becomes real and preserves a changed real amount", () => {
    const options = { ...base, cards: [{ ...card, handlingFee: new Decimal(0) }] };
    const projected = projectStatements(options);
    const saved = { id: "s", cardId: "visa", periodStart: "2026-10-26", cutoffDate: "2026-11-25", dueDate: "2026-11-28", paidAt: null };
    const movement = { id: "m", statementId: "s", type: "purchase" as const, source: "subscription" as const, amountCop: new Decimal(80000), amount: new Decimal(20), currency: "USD" as const, fxRate: new Decimal(4000), categoryId: "entertainment", subscriptionId: "sub", date: "2026-11-20" };
    const real = projectStatements({ ...options, statements: [saved], movements: [movement] });
    const changed = projectStatements({ ...options, statements: [saved], movements: [{ ...movement, amountCop: new Decimal(83000) }] });
    const total = (statements: MonthStatement[]) => buildMonths(statements, options.today).find((m) => m.month === "2026-11")?.total.toString();
    expect(total(projected.statements)).toBe("80000");
    expect(total(real.statements)).toBe("80000");
    expect(total(changed.statements)).toBe("83000");
    expect(real.statements.find((s) => s.id === "s")?.charges[0]?.fxRate?.toString()).toBe("4000");
    expect(projected.statements.find((s) => s.dueDate === "2026-11-28")?.charges[0]?.currency).toBe("USD");
  });

  it("reconciles synthetic Visa and Mastercard charges by payment month", () => {
    const result = projectStatements({
      ...base,
      cards: [card, { id: "mastercard", cutoffDay: 15, paymentDay: 2, archived: false, handlingFee: new Decimal(0) }],
      statements: [{ id: "m", cardId: "mastercard", periodStart: "2026-09-16", cutoffDate: "2026-10-15", dueDate: "2026-11-02", paidAt: null }],
      movements: [{ id: "purchase", statementId: "m", type: "purchase", amountCop: new Decimal(100000), categoryId: null, date: "2026-10-01" }],
      subscriptions: [{ ...subscription, currency: "COP", amount: new Decimal(20000) }],
    });
    const months = buildMonths(result.statements, base.today);
    expect(months.find((m) => m.month === "2026-11")?.total.toString()).toBe("130000");
    expect(months.find((m) => m.month === "2026-12")?.total.toString()).toBe("30000");
    expect(overdueStatements(result.statements, base.today).total.isZero()).toBe(true);
  });

  it("reports real commitments beyond the twelve payment months and preserves archived history", () => {
    const result = projectStatements({
      ...base, subscriptions: [], cards: [{ ...card, archived: true }],
      statements: [
        { id: "history", cardId: "visa", periodStart: "2025-12-26", cutoffDate: "2026-01-25", dueDate: "2026-01-28", paidAt: null },
        { id: "future", cardId: "visa", periodStart: "2027-12-26", cutoffDate: "2028-01-25", dueDate: "2028-01-28", paidAt: null },
      ],
      installments: [{ id: "i", statementId: "history", categoryId: null, totalCop: new Decimal(100) }],
    });
    expect(result.hasLaterCommitments).toBe(true);
    expect(result.statements.map((s) => s.id)).toEqual(["history"]);
    expect(buildMonths(result.statements, base.today)[0]?.total.toString()).toBe("100");
  });

  it("limits 24 recorded installment statements to twelve future payment months", () => {
    const statements = Array.from({ length: 24 }, (_, index) => {
      const year = 2026 + Math.floor((index + 11) / 12);
      const month = String((index + 11) % 12 + 1).padStart(2, "0");
      return { id: `s${index}`, cardId: "visa", periodStart: `${year}-${month}-01`, cutoffDate: `${year}-${month}-15`, dueDate: `${year}-${month}-28`, paidAt: null };
    });
    const result = projectStatements({
      ...base, cards: [], subscriptions: [], statements,
      installments: statements.map((s) => ({ id: `i${s.id}`, statementId: s.id, categoryId: "food", totalCop: new Decimal(100000) })),
    });
    const future = buildMonths(result.statements, base.today).filter((m) => m.kind === "future");
    expect(future).toHaveLength(12);
    expect(future.every((m) => m.total.eq(100000))).toBe(true);
    expect(result.hasLaterCommitments).toBe(true);
  });

  it("keeps zero and negative real totals and balances their categories", () => {
    const result = projectStatements({
      ...base, cards: [], subscriptions: [],
      statements: [
        { id: "zero", cardId: "visa", periodStart: "2026-09-01", cutoffDate: "2026-09-15", dueDate: "2026-09-28", paidAt: null },
        { id: "negative", cardId: "visa", periodStart: "2026-10-01", cutoffDate: "2026-10-15", dueDate: "2026-10-28", paidAt: null },
      ],
      movements: [{ id: "refund", statementId: "negative", type: "refund", amountCop: new Decimal(50), categoryId: null, date: "2026-10-10" }],
    });
    const months = buildMonths(result.statements, base.today);
    expect(months.find((m) => m.month === "2026-09")?.total.toString()).toBe("0");
    expect(months.find((m) => m.month === "2026-10")?.total.toString()).toBe("-50");
    expect(monthBreakdown(result.statements).categories.get(null)?.toString()).toBe("-50");
  });

  it("keeps two saved periods of the same card in their saved payment month", () => {
    const result = projectStatements({
      ...base, cards: [{ ...card, archived: true }], subscriptions: [],
      statements: [
        { id: "first", cardId: "visa", periodStart: "2026-09-16", cutoffDate: "2026-10-15", dueDate: "2026-11-02", paidAt: null },
        { id: "second", cardId: "visa", periodStart: "2026-10-16", cutoffDate: "2026-11-15", dueDate: "2026-11-28", paidAt: null },
      ],
      movements: [
        { id: "one", statementId: "first", type: "purchase", amountCop: new Decimal(100), categoryId: null, date: "2026-10-15" },
        { id: "two", statementId: "second", type: "purchase", amountCop: new Decimal(200), categoryId: null, date: "2026-10-16" },
      ],
    });
    const current = buildMonths(result.statements, base.today).find((m) => m.kind === "current");
    expect(current?.statements).toHaveLength(2);
    expect(current?.total.toString()).toBe("300");
    expect(current?.statements[0]?.periodStart).toBe("2026-09-16");
  });

  it("counts two different subscriptions on the same day independently", () => {
    const result = projectStatements({
      ...base, cards: [{ ...card, handlingFee: new Decimal(0) }],
      subscriptions: [subscription, { ...subscription, id: "other" }],
    });
    const current = buildMonths(result.statements, base.today).find((m) => m.kind === "current");
    expect(current?.projected.toString()).toBe("160000");
  });

  it("deduplicates today's actual charge using its saved amount even with a new exchange rate", () => {
    const result = projectStatements({
      ...base,
      subscriptions: [{ ...subscription, billingDay: 13 }],
      statements: [{ id: "s", cardId: "visa", periodStart: "2026-10-26", cutoffDate: "2026-11-25", dueDate: "2026-11-28", paidAt: null }],
      movements: [{
        id: "actual", statementId: "s", type: "purchase", source: "subscription", amountCop: new Decimal(76000),
        amount: new Decimal(20), currency: "USD", fxRate: new Decimal(3800), categoryId: null,
        subscriptionId: "sub", date: "2026-11-13",
      }],
    });
    const actual = result.statements.find((s) => s.id === "s");
    expect(actual?.recordedTotal.toString()).toBe("76000");
    expect(actual?.projectedTotal.toString()).toBe("0");
    expect(actual?.charges[0]?.fxRate?.toString()).toBe("3800");
  });

  it("projects handling alone through the horizon without changing real handling", () => {
    const result = projectStatements({
      ...base, subscriptions: [],
      statements: [{ id: "s", cardId: "visa", periodStart: "2026-10-26", cutoffDate: "2026-11-25", dueDate: "2026-11-28", paidAt: null }],
      movements: [{
        id: "fee", statementId: "s", type: "handling_fee", amountCop: new Decimal(5000),
        categoryId: null, date: "2026-11-25",
      }],
    });
    const real = result.statements.find((s) => s.id === "s");
    expect(real?.recordedTotal.toString()).toBe("5000");
    expect(real?.projectedTotal.toString()).toBe("0");
    const future = buildMonths(result.statements, base.today).filter((m) => m.kind === "future");
    expect(future).toHaveLength(12);
    expect(future.every((m) => m.total.eq(10000))).toBe(true);
  });

  it("never projects handling or subscriptions for archived cards", () => {
    const result = projectStatements({ ...base, cards: [{ ...card, archived: true }] });
    expect(result.statements).toEqual([]);
    expect(result.hasLaterCommitments).toBe(false);
  });

  it("keeps overdue extract totals in their original months", () => {
    const result = projectStatements({
      ...base, cards: [], subscriptions: [],
      statements: [
        { id: "oct", cardId: "visa", periodStart: "2026-09-01", cutoffDate: "2026-09-25", dueDate: "2026-10-05", paidAt: null },
        { id: "current", cardId: "visa", periodStart: "2026-10-01", cutoffDate: "2026-10-25", dueDate: "2026-11-28", paidAt: null },
      ],
      movements: [
        { id: "old", statementId: "oct", type: "purchase", amountCop: new Decimal(400), categoryId: null, date: "2026-09-10" },
        { id: "new", statementId: "current", type: "purchase", amountCop: new Decimal(100), categoryId: null, date: "2026-10-10" },
      ],
    });
    const months = buildMonths(result.statements, base.today);
    expect(months.find((m) => m.month === "2026-10")?.total.toString()).toBe("400");
    expect(months.find((m) => m.month === "2026-11")?.total.toString()).toBe("100");
    expect(overdueStatements(result.statements, base.today).total.toString()).toBe("400");
  });

  it("does not create future months with no eligible commitments", () => {
    const result = projectStatements({
      ...base, cards: [{ ...card, handlingFee: new Decimal(0) }],
      subscriptions: [{ ...subscription, status: "paused" }],
    });
    expect(buildMonths(result.statements, base.today).map((m) => m.month)).toEqual(["2026-11"]);
  });

  it("projects a charge on day 31 in February in leap and non-leap years", () => {
    const options = {
      ...base, cards: [{ ...card, cutoffDay: 31, paymentDay: 5, handlingFee: new Decimal(0) }],
      subscriptions: [{ ...subscription, billingDay: 31, currency: "COP" as const }],
    };
    for (const [today, expectedDate, expectedDue] of [
      ["2027-02-01", "2027-02-28", "2027-03-05"],
      ["2028-02-01", "2028-02-29", "2028-03-05"],
    ] as const) {
      const result = projectStatements({ ...options, today });
      const februaryCharge = result.statements.flatMap((s) => s.charges.map((charge) => ({ charge, dueDate: s.dueDate })))
        .find(({ charge }) => charge.date === expectedDate);
      expect(februaryCharge?.dueDate).toBe(expectedDue);
    }
  });

  it("includes a charge on the day a trial ends but not an earlier charge", () => {
    const result = projectStatements({
      ...base, today: "2026-11-01", cards: [{ ...card, handlingFee: new Decimal(0) }],
      subscriptions: [{ ...subscription, trialEndsAt: "2026-12-20" }],
    });
    const dates = result.statements.flatMap((s) => s.charges.map((charge) => charge.date));
    expect(dates).not.toContain("2026-11-20");
    expect(dates).toContain("2026-12-20");
  });

  it("assigns charges and installments to concepts and categories exactly once", () => {
    const result = projectStatements({
      ...base, cards: [], subscriptions: [],
      statements: [{ id: "s", cardId: "visa", periodStart: "2026-10-26", cutoffDate: "2026-11-25", dueDate: "2026-11-28", paidAt: null }],
      movements: [
        { id: "purchase", statementId: "s", type: "purchase", amountCop: new Decimal(1200000), installmentsCount: 12, categoryId: "food", date: "2026-11-01" },
        { id: "advance", statementId: "s", type: "cash_advance", amountCop: new Decimal(30000), categoryId: null, date: "2026-11-02" },
        { id: "fee", statementId: "s", type: "advance_fee", amountCop: new Decimal(5000), categoryId: null, date: "2026-11-02" },
        { id: "adjustment", statementId: "s", type: "adjustment", amountCop: new Decimal(2000), categoryId: null, date: "2026-11-03" },
        { id: "refund", statementId: "s", type: "refund", amountCop: new Decimal(10000), categoryId: "food", date: "2026-11-04" },
      ],
      installments: [{ id: "one", statementId: "s", categoryId: "food", totalCop: new Decimal(110000) }],
    });
    const breakdown = monthBreakdown(result.statements);
    expect(breakdown.concepts.installments.toString()).toBe("110000");
    expect(breakdown.concepts.cash_advances.toString()).toBe("35000");
    expect(breakdown.categories.get("food")?.toString()).toBe("100000");
    expect(breakdown.categories.get(null)?.toString()).toBe("37000");
    expect(breakdown.total.toString()).toBe("137000");
    expect(buildMonths(result.statements, base.today)[0]?.total.toString()).toBe("137000");
  });
});

describe("month aggregates", () => {
  const charges = [
    { id: "i", origin: "real" as const, concept: "installments" as const, categoryId: "food", amountCop: new Decimal(110) },
    { id: "r", origin: "real" as const, concept: "refunds" as const, categoryId: "food", amountCop: new Decimal(30) },
    { id: "a", origin: "real" as const, concept: "adjustments" as const, categoryId: null, amountCop: new Decimal(20) },
    { id: "p", origin: "real" as const, concept: "payments" as const, categoryId: null, amountCop: new Decimal(50) },
  ];
  const statement: MonthStatement = { id: "s", cardId: "visa", origin: "real", cutoffDate: "2026-09-30", dueDate: "2026-10-05", paidAt: null, recordedTotal: new Decimal(100), projectedTotal: new Decimal(0), unconvertedCharges: [], charges };

  it("balances concepts and categories, preserves refunds and excludes payments", () => {
    const breakdown = monthBreakdown([statement]);
    expect(breakdown.total.toString()).toBe("100");
    expect(breakdown.categories.get("food")?.toString()).toBe("80");
    expect(breakdown.categories.get(null)?.toString()).toBe("20");
    expect(breakdown.concepts.refunds.toString()).toBe("-30");
    expect(breakdown.payments.toString()).toBe("50");
  });

  it("groups overdue prior months without adding them to the current month", () => {
    const overdue = overdueStatements([statement], "2026-11-13");
    expect(overdue.total.toString()).toBe("100");
    expect(overdue.months.get("2026-10")?.length).toBe(1);
  });

  it("compares only consecutive complete closed months with data", () => {
    const months = buildMonths([
      { ...statement, paidAt: "yes" },
      { ...statement, dueDate: "2026-09-05", cutoffDate: "2026-08-31", recordedTotal: new Decimal(80), paidAt: "yes" },
    ], "2026-11-13");
    expect(monthComparison(months[1], months[0])).toMatchObject({ kind: "comparable" });
    expect(monthComparison(months[2], months[1])).toMatchObject({ kind: "unavailable" });
    expect(monthComparison(months[1], undefined)).toMatchObject({ kind: "unavailable" });
  });

  it("does not compare open, future, projected or incomplete months", () => {
    const months = buildMonths([
      { ...statement, dueDate: "2026-09-05", cutoffDate: "2026-08-31", paidAt: "yes" },
      { ...statement, paidAt: "yes" },
      { ...statement, dueDate: "2026-11-28", cutoffDate: "2026-11-25", paidAt: "yes" },
      { ...statement, dueDate: "2026-12-28", cutoffDate: "2026-12-25", paidAt: "yes" },
    ], "2026-11-13");
    const [september, october, november, december] = months;
    expect(monthComparison(november, october).kind).toBe("unavailable");
    expect(monthComparison(december, november).kind).toBe("unavailable");
    if (!october) throw new Error("Falta octubre");
    expect(monthComparison({ ...october, hasProjection: true }, september).kind).toBe("unavailable");
    expect(monthComparison({ ...october, complete: false }, september).kind).toBe("unavailable");
  });

  it("uses safe presentation for zero, negative, small and extreme comparison bases", () => {
    const prior = buildMonths([{ ...statement, paidAt: "yes", dueDate: "2026-09-05", cutoffDate: "2026-08-31" }], "2026-11-13")[0];
    const current = buildMonths([{ ...statement, paidAt: "yes" }], "2026-11-13")[0];
    if (!prior || !current) throw new Error("Faltan meses de comparación");
    for (const [previous, amount] of [["0", "100"], ["-10", "100"], ["1", "100"], ["1000", "1000000"]] as const) {
      const result = monthComparison({ ...current, total: new Decimal(amount) }, { ...prior, total: new Decimal(previous) });
      expect(result.kind).toBe("comparable");
      expect(formatSpendingComparison(amount, previous, prior.month)).not.toContain("%");
    }
  });

  it("skips missing COP, excludes virtual and paid from overdue, and handles empty charges", () => {
    const unknown = { ...statement, origin: "virtual" as const, charges: [{ ...charges[0]!, amountCop: null }] };
    expect(monthBreakdown([unknown, { ...statement, charges: undefined }]).total.isZero()).toBe(true);
    expect(overdueStatements([unknown, { ...statement, paidAt: "yes" }], "2026-11-13").total.isZero()).toBe(true);
  });
});
