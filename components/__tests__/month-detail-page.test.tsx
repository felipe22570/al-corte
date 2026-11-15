import Decimal from "decimal.js";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MonthDetailPage from "@/app/(app)/meses/[mes]/page";
import { buildMonths } from "@/lib/domain/months";

const { state } = vi.hoisted(() => ({ state: { detail: null as unknown, cards: [] as unknown[], categories: [] as Array<{ id: string; name: string; icon: string | null }> } }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("not found"); }, redirect: () => { throw new Error("redirect"); }, useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: "owner" } } }) } }) }));
vi.mock("@/lib/queries/supabase-months", () => ({ createSupabaseMonthSource: () => ({
  loadCardDetails: async () => state.cards, loadCategories: async () => state.categories, loadPurchaseMonthSpending: async () => new Decimal(25),
}) }));
vi.mock("@/lib/queries/months", () => ({ loadMonthDetail: async () => state.detail }));
vi.mock("@/lib/domain/dates", async (original) => ({ ...await original<typeof import("@/lib/domain/dates")>(), todayInBogota: () => "2026-11-14" }));
vi.mock("@/components/category-spending-chart", () => ({ CategorySpendingChart: ({ rows }: { rows: Array<{ name: string; amount: string }> }) => <div>{rows.map((row) => `${row.name}: ${row.amount}`)}</div> }));

describe("payment month detail", () => {
  beforeEach(() => { state.cards = []; state.categories = []; state.detail = null; });

  it("shows an empty current month without saying it is paid", async () => {
    const [month] = buildMonths([], "2026-11-14");
    state.detail = { month, previous: null, neighbors: { previous: null, next: null }, overdue: { months: new Map(), total: new Decimal(0) }, subscriptionNames: {} };
    const html = renderToStaticMarkup(await MonthDetailPage({ params: Promise.resolve({ mes: "2026-11" }) }));
    expect(html).toContain("Sin extractos");
    expect(html).toContain("Compraste en este mes");
    expect(html).not.toContain(">Pagado<");
  });

  it("gives real statements unique payment controls and omits payment for virtual ones", async () => {
    const [month] = buildMonths([
      { id: "one", cardId: "a", origin: "real", periodStart: "2026-10-01", cutoffDate: "2026-11-20", dueDate: "2026-11-28", paidAt: null, recordedTotal: new Decimal(100), projectedTotal: new Decimal(0), unconvertedCharges: [] },
      { id: "two", cardId: "b", origin: "real", periodStart: "2026-10-01", cutoffDate: "2026-11-21", dueDate: "2026-11-29", paidAt: null, recordedTotal: new Decimal(200), projectedTotal: new Decimal(0), unconvertedCharges: [] },
      { cardId: "c", origin: "virtual", periodStart: "2026-10-01", cutoffDate: "2026-11-22", dueDate: "2026-11-30", paidAt: null, recordedTotal: new Decimal(0), projectedTotal: new Decimal(20), unconvertedCharges: [] },
    ], "2026-11-14");
    state.detail = { month, previous: null, neighbors: { previous: null, next: null }, overdue: { months: new Map(), total: new Decimal(0) }, subscriptionNames: {} };
    state.cards = ["a", "b", "c"].map((id) => ({ id, name: id, last4: "1234", color: "card-1" }));
    const html = renderToStaticMarkup(await MonthDetailPage({ params: Promise.resolve({ mes: "2026-11" }) }));
    expect(html.match(/Marcar como pagado ·/g)).toHaveLength(2);
    const ids = [...html.matchAll(/id="([^"]+)"/g)].map((match) => match[1]);
    expect(new Set(ids).size).toBe(ids.length);
    const dateLabels = [...html.matchAll(/<label[^>]*for="([^"]+)"[^>]*>Fecha de pago/g)].map((match) => match[1]);
    expect(dateLabels).toHaveLength(2);
    for (const id of dateLabels) expect(html).toContain(`id="${id}"`);
    expect(html.match(/>Ver extracto ·/g)).toHaveLength(2);
    expect(html).toContain("Aún puede crecer");
  });

  it("rejects invalid or unavailable months", async () => {
    await expect(MonthDetailPage({ params: Promise.resolve({ mes: "2026-13" }) })).rejects.toThrow("not found");
    await expect(MonthDetailPage({ params: Promise.resolve({ mes: "2020-01" }) })).rejects.toThrow("not found");
  });

  it("identifies USD charges without TRM rather than presenting an estimated zero", async () => {
    const summaries = buildMonths([{
      cardId: "c", origin: "virtual", cutoffDate: "2026-12-20", dueDate: "2026-12-28", paidAt: null,
      recordedTotal: new Decimal(0), projectedTotal: new Decimal(0),
      unconvertedCharges: [{ subscriptionId: "sub", date: "2026-12-15", amountUsd: new Decimal("9.99") }],
    }], "2026-11-14");
    const month = summaries.find((item) => item.month === "2026-12");
    state.detail = { month, previous: null, neighbors: { previous: "2026-11", next: null }, overdue: { months: new Map(), total: new Decimal(0) }, subscriptionNames: { sub: "Servicio" } };
    state.cards = [{ id: "c", name: "Visa", last4: "1234", color: "card-1" }];
    const html = renderToStaticMarkup(await MonthDetailPage({ params: Promise.resolve({ mes: "2026-12" }) }));
    expect(html).toContain("Total conocido");
    expect(html).toContain("Estimación incompleta");
    expect(html).toContain("US$ 9,99");
    expect(html).toContain("Servicio");
    expect(html).toContain("pendientes de conversión");
    expect(html).not.toContain("Marcar como pagado");
  });

  it("renders signed category totals from payment-month charges and compares closed months neutrally", async () => {
    const [previous, month] = buildMonths([
      { id: "p", cardId: "c", origin: "real", cutoffDate: "2026-08-15", dueDate: "2026-09-02", paidAt: "paid", recordedTotal: new Decimal(200), projectedTotal: new Decimal(0), unconvertedCharges: [] },
      { id: "s", cardId: "c", origin: "real", cutoffDate: "2026-09-15", dueDate: "2026-10-02", paidAt: "paid", recordedTotal: new Decimal(-20), projectedTotal: new Decimal(0), unconvertedCharges: [], charges: [
        { id: "refund", origin: "real", concept: "refunds", categoryId: "food", amountCop: new Decimal(20) },
      ] },
    ], "2026-11-14");
    state.detail = { month, previous, neighbors: { previous: "2026-09", next: "2026-11" }, overdue: { months: new Map(), total: new Decimal(0) }, subscriptionNames: {} };
    state.cards = [{ id: "c", name: "Visa", last4: "1234", color: "card-1" }];
    state.categories = [{ id: "food", name: "Mercado", icon: null }];
    const html = renderToStaticMarkup(await MonthDetailPage({ params: Promise.resolve({ mes: "2026-10" }) }));
    expect(html).toContain("Mercado: -20");
    expect(html).toContain("Saldo a favor");
    expect(html).toContain("Menos que septiembre · Diferencia: -$220");
    expect(html).not.toContain("%");
    expect(html).not.toContain("ahorraste");
  });

  it("shows a neutral percentage only between closed months with a meaningful base", async () => {
    const [previous, month] = buildMonths([
      { id: "p", cardId: "c", origin: "real", cutoffDate: "2026-08-15", dueDate: "2026-09-02", paidAt: "paid", recordedTotal: new Decimal(200000), projectedTotal: new Decimal(0), unconvertedCharges: [] },
      { id: "s", cardId: "c", origin: "real", cutoffDate: "2026-09-15", dueDate: "2026-10-02", paidAt: "paid", recordedTotal: new Decimal(220000), projectedTotal: new Decimal(0), unconvertedCharges: [] },
    ], "2026-11-14");
    state.detail = { month, previous, neighbors: { previous: "2026-09", next: "2026-11" }, overdue: { months: new Map(), total: new Decimal(0) }, subscriptionNames: {} };
    state.cards = [{ id: "c", name: "Visa", last4: "1234", color: "card-1" }];
    const html = renderToStaticMarkup(await MonthDetailPage({ params: Promise.resolve({ mes: "2026-10" }) }));
    expect(html).toContain("10% más que septiembre · Diferencia: $20.000");
    expect(html).not.toMatch(/ahorr|gastaste/i);
  });
});
