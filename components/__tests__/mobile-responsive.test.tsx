import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AppLayout from "@/app/(app)/layout";
import DashboardPage from "@/app/(app)/page";
import MovimientosPage from "@/app/(app)/movimientos/page";
import TransactionDetailPage from "@/app/(app)/movimientos/[id]/page";
import CardDetailPage from "@/app/(app)/tarjetas/[id]/page";
import StatementDetailPage from "@/app/(app)/tarjetas/[id]/extractos/[cutoff]/page";
import SettingsPage from "@/app/(app)/ajustes/page";
import SubscriptionsPage from "@/app/(app)/suscripciones/page";
import AppError from "@/app/(app)/error";
import AuthError from "@/app/(auth)/error";
import NotFound from "@/app/not-found";
import { TransactionList } from "@/components/transaction-list";
import { buttonVariants } from "@/components/ui/button";

const state = vi.hoisted(() => ({ empty: false, route: "/" }));
const cardId = "11111111-1111-4111-8111-111111111111";
const transactionId = "22222222-2222-4222-8222-222222222222";
const categoryId = "33333333-3333-4333-8333-333333333333";
const longName = "NombreSinEspaciosMuyLargoParaComprobarElAjusteDeTextoEnPantallasDe360Pixeles";
const amount = "999999999999.99";

vi.mock("next/navigation", () => ({
  usePathname: () => state.route,
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  notFound: () => { throw new Error("not found"); },
  redirect: () => { throw new Error("redirect"); },
}));
vi.mock("@/lib/domain/dates", async (original) => ({ ...await original<typeof import("@/lib/domain/dates")>(), todayInBogota: () => "2026-11-13" }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({
  auth: { getUser: async () => ({ data: { user: { id: "owner" } } }) },
  from: (table: string) => {
    const cards = [{ id: cardId, name: longName, bank: longName, network: "Visa", last4: "1234", color: "card-1", archived_at: null, credit_limit: amount, advance_fee: "15000", handling_fee: "15000", cutoff_day: 15, payment_day: 30, purchase_rate_ea: "0.25", advance_rate_ea: "0.28", amortization_method: "fixed_principal" }];
    const statements = [{ id: "statement", card_id: cardId, period_start: "2026-10-16", cutoff_date: "2026-11-15", due_date: "2026-11-30", paid_at: null, real_total: null }];
    const transactions = [{ id: transactionId, card_id: cardId, category_id: categoryId, statement_id: "statement", parent_id: null, subscription_id: null, merchant: longName, note: longName.repeat(3), type: "purchase", source: "manual", date: "2026-11-13", currency: "USD", amount, amount_cop: amount, fx_rate: "4000", installments_count: 12 }];
    const tables: Record<string, object[]> = {
      cards,
      categories: [{ id: categoryId, name: longName, icon: "tags", archived_at: null }],
      card_balances: [{ card_id: cardId, used: amount, available: "-15000", utilization: "1.25" }],
      statements,
      transactions,
      installments: [{ transaction_id: transactionId, statement_id: "statement", number: 1, principal: amount, interest: "0", total: amount, balance_after: "0", principal_cop: amount, interest_cop: "0", total_cop: amount }],
      statement_totals: [{ statement_id: "statement", total_calculated: amount, single_purchases: "0", installments: amount, subscriptions: "0", cash_advances: "0", interest: "0", handling_fees: "0", insurance: "0", adjustments: "0", refunds: "0", payments: "0" }],
      subscriptions: [{ id: "subscription", name: longName, card_id: cardId, category_id: categoryId, amount, currency: "USD", frequency: "monthly", billing_day: 15, start_date: "2026-01-15", trial_ends_at: null, status: "active" }],
      fx_rates: [{ usd_cop: "4000" }],
    };
    const result = { data: state.empty ? [] : tables[table] ?? [], error: null, count: 0 };
    const query = {
      select: () => query, eq: () => query, is: () => query, in: () => query, gt: () => query,
      gte: () => query, lt: () => query, order: () => query, range: () => query, limit: () => query, not: () => query,
      single: async () => ({ ...result, data: result.data[0] ?? null }),
      maybeSingle: async () => ({ ...result, data: result.data[0] ?? null }),
      then: (resolve: (value: typeof result) => void) => Promise.resolve(result).then(resolve),
    };
    return query;
  },
}) }));

// Opt-in current-source markup for browser reflow checks, never business data.
async function renderPage(name: string, page: React.ReactNode) {
  const html = renderToStaticMarkup(await AppLayout({ children: page }));
  const directory = process.env.AL_CORTE_UI_FIXTURES;
  if (directory) {
    mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, `${name}.html`), html);
  }
  return html;
}

beforeEach(() => { state.empty = false; state.route = "/"; });

describe("mobile reflow contracts", () => {
  it("keeps four navigation destinations with labels and a focusable skip target", async () => {
    state.route = "/movimientos/nuevo";
    const html = await renderPage("shell", <h1>Nuevo gasto</h1>);
    expect(html).toContain('href="#main-content"');
    expect(html).toContain("focus:min-h-11");
    expect(html).toContain('id="main-content" tabindex="-1"');
    expect(html).toContain("grid-cols-4");
    expect(html.match(/aria-current="page"/g)).toHaveLength(2);
    for (const label of ["Tablero", "Movimientos", "Suscripciones", "Ajustes"]) expect(html).toContain(label);
  });

  it("preserves desktop density while providing touch targets and opaque focus", () => {
    const normal = buttonVariants();
    expect(normal).toContain("h-10");
    expect(normal).toContain("pointer-coarse:h-11");
    expect(normal).toContain("pointer-coarse:min-w-11");
    expect(normal).toContain("focus-visible:ring-ring");
    expect(normal).not.toContain("ring-ring/50");
  });

  it("allows transaction descriptions and amounts to reflow without clipping content", () => {
    const html = renderToStaticMarkup(<TransactionList rows={[{ id: transactionId, card_id: cardId, category_id: categoryId, date: "2026-11-13", merchant: longName, note: null, type: "purchase", currency: "USD", amount, amount_cop: amount, installments_count: 12 }]} allRows={[]} cards={[]} categories={[{ id: categoryId, name: longName, icon: "tags" }]} today="2026-11-13" />);
    expect(html).toContain("flex-wrap");
    expect(html).toContain("basis-48");
    expect(html).toContain("wrap-anywhere");
    expect(html).toContain("focus-visible:ring-ring");
    expect(html).toContain(longName);
    expect(html).toContain("US$ 999.999.999.999,99");
    expect(html).not.toContain("truncate");
  });

  it("renders all consultation pages with long names and maximum stored amounts", async () => {
    const pages = {
      dashboard: await DashboardPage({ searchParams: Promise.resolve({}) }),
      history: await MovimientosPage({ searchParams: Promise.resolve({}) }),
      transaction: await TransactionDetailPage({ params: Promise.resolve({ id: transactionId }) }),
      card: await CardDetailPage({ params: Promise.resolve({ id: cardId }) }),
      statement: await StatementDetailPage({ params: Promise.resolve({ id: cardId, cutoff: "2026-11-15" }) }),
      subscriptions: await SubscriptionsPage(),
      settings: await SettingsPage(),
    };
    for (const [name, page] of Object.entries(pages)) {
      const html = await renderPage(name, page);
      expect(html, name).toContain(longName);
      expect(html, name).toContain("max-w-5xl");
    }
    const settings = await renderPage("settings", pages.settings);
    expect(settings).toContain(`aria-label="Editar tarjeta ${longName}"`);
    expect(settings).toContain(`aria-label="Archivar categoría ${longName}"`);
    expect(settings).toContain("flex-1 basis-48 items-center");
    const transaction = await renderPage("transaction", pages.transaction);
    expect(transaction).toContain("bg-card xl:block");
    expect(transaction).toContain("xl:hidden");
    expect(transaction).not.toContain("overflow-x-auto");
  });

  it("offers registration rather than a clear-filters loop in an unfiltered empty month", async () => {
    state.empty = true;
    const html = await renderPage("history-empty", await MovimientosPage({ searchParams: Promise.resolve({}) }));
    expect(html).toContain("No tienes movimientos en este mes.");
    expect(html).toContain("Agregar una tarjeta");
    expect(html).not.toContain("Limpiar filtros");
  });

  it("keeps clear filters as the recovery action for a filtered empty result", async () => {
    state.empty = true;
    const html = await renderPage("history-filtered-empty", await MovimientosPage({ searchParams: Promise.resolve({ q: longName }) }));
    expect(html).toContain("No hay movimientos con estos filtros.");
    expect(html).toContain("Limpiar filtros");
  });

  it("points to settings instead of inviting an unavailable subscription action", async () => {
    state.empty = true;
    const html = await renderPage("subscriptions-empty", await SubscriptionsPage());
    expect(html).toContain('href="/ajustes"');
    expect(html).toContain("Agrega una tarjeta activa");
    expect(html).toContain("Aún no tienes suscripciones.");
    expect(html).not.toContain("Agrega la primera.");
  });

  it("keeps error recovery explicit and uses the same calm voice as empty states", async () => {
    const props = { error: new Error("Internal detail must stay private"), reset: vi.fn() };
    const app = await renderPage("error", <AppError {...props} />);
    const auth = renderToStaticMarkup(<AuthError {...props} />);
    for (const html of [app, auth]) {
      expect(html).toContain('role="alert"');
      expect(html).toContain("No pudimos cargar esta pantalla");
      expect(html).toContain("Reintentar");
      expect(html).not.toContain(props.error.message);
    }
    const missing = renderToStaticMarkup(<NotFound />);
    expect(missing).toContain("No encontramos esta página");
    expect(missing).toContain("Volver al tablero");
  });
});
