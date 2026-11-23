import Decimal from "decimal.js";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import MonthsPage from "@/app/(app)/(months)/page";
import { buildMonths } from "@/lib/domain/months";

const { state } = vi.hoisted(() => ({ state: { overview: null as unknown, cards: [] as unknown[], drafts: 0 } }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: "owner" } } }) } }) }));
vi.mock("@/lib/queries/supabase-months", () => ({ createSupabaseMonthSource: () => ({ loadCardDetails: async () => state.cards }) }));
vi.mock("@/lib/queries/months", () => ({ loadMonthOverview: async () => state.overview }));
vi.mock("@/lib/queries/drafts", () => ({ countOpenDrafts: async () => state.drafts }));
vi.mock("@/lib/domain/dates", async (original) => ({ ...await original<typeof import("@/lib/domain/dates")>(), todayInBogota: () => "2026-11-14" }));

describe("months home", () => {
  it("shows an empty current month and an action to create the first card", async () => {
    const current = buildMonths([], "2026-11-14")[0];
    state.overview = { current, future: [], history: [], overdue: { months: new Map(), total: new Decimal(0), totalUsd: new Decimal(0) }, hasLaterCommitments: false, historyNextBefore: null, subscriptionNames: {}, toReview: [] };
    state.cards = [];
    const html = renderToStaticMarkup(await MonthsPage({ searchParams: Promise.resolve({}) }));
    expect(html).toContain("Sin extractos");
    expect(html).toContain("Aún no tienes tarjetas");
    expect(html).toContain('href="/ajustes"');
    expect(html).not.toContain("por confirmar");
  });

  it("points to captured drafts without adding them to any month (F18, D46)", async () => {
    const current = buildMonths([], "2026-11-14")[0];
    state.overview = { current, future: [], history: [], overdue: { months: new Map(), total: new Decimal(0), totalUsd: new Decimal(0) }, hasLaterCommitments: false, historyNextBefore: null, subscriptionNames: {}, toReview: [] };
    state.cards = [];
    state.drafts = 2;
    const html = renderToStaticMarkup(await MonthsPage({ searchParams: Promise.resolve({}) }));
    expect(html).toContain("Tienes 2 movimientos por confirmar.");
    expect(html).toContain('href="/por-confirmar"');
    expect(html).toContain("Sin extractos");
    state.drafts = 1;
    expect(renderToStaticMarkup(await MonthsPage({ searchParams: Promise.resolve({}) }))).toContain("Tienes 1 movimiento por confirmar.");
    state.drafts = 0;
  });

  it("shows overdue links and the later-commitment warning without altering the current total", async () => {
    const current = buildMonths([], "2026-11-14")[0];
    state.overview = { current, future: [], history: [], overdue: { months: new Map([["2026-08", []], ["2026-09", []]]), total: new Decimal(200), totalUsd: new Decimal(0) }, hasLaterCommitments: true, historyNextBefore: null, subscriptionNames: {}, toReview: [{ cardId: "visa", cutoffDate: "2026-11-15", dueDate: "2026-12-02" }] };
    state.cards = [];
    const html = renderToStaticMarkup(await MonthsPage({ searchParams: Promise.resolve({}) }));
    expect(html).toContain('href="/meses/2026-08"');
    expect(html).toContain('href="/meses/2026-09"');
    expect(html).toContain("Tienes compromisos posteriores a estos 12 meses");
    expect(html).toContain("$200");
    // F15: the latest statement without close asks for it.
    expect(html).toContain("Revisa el extracto de tu tarjeta");
    expect(html).toContain('href="/tarjetas/visa/extractos/2026-11-15#cierre"');
  });

  it("retains archived history and debt when there are no active cards", async () => {
    const [history, current] = buildMonths([{
      cardId: "archived", origin: "real", cutoffDate: "2026-09-15", dueDate: "2026-10-02", paidAt: "2026-10-01",
      recordedTotal: new Decimal(300), projectedTotal: new Decimal(0), unconvertedCharges: [],
    }], "2026-11-14");
    state.overview = { current, future: [], history: [history], overdue: { months: new Map(), total: new Decimal(0), totalUsd: new Decimal(0) }, hasLaterCommitments: false, historyNextBefore: null, subscriptionNames: {}, toReview: [] };
    state.cards = [{ id: "archived", name: "Visa archivada", bank: "Banco", last4: "1234", color: "card-1", archived: true, cutoffDay: 15, paymentDay: 2, handlingFee: new Decimal(0), used: new Decimal(300), available: new Decimal(700), utilization: new Decimal("0.3") }];
    const html = renderToStaticMarkup(await MonthsPage({ searchParams: Promise.resolve({}) }));
    expect(html).toContain("Meses anteriores");
    expect(html).toContain("Visa archivada");
    expect(html).toContain("Deuda total registrada");
    expect(html).toContain("$300");
    expect(html).toContain("No tienes tarjetas activas");
  });
});
