import Decimal from "decimal.js";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { MonthStatementCard } from "@/components/month-statement-card";
import { buildMonths } from "@/lib/domain/months";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/lib/actions/statements", () => ({ markStatementPaid: vi.fn(), unmarkStatementPaid: vi.fn() }));

const card = { id: "visa", name: "Visa", last4: "1234", color: "card-1" as const };
const statement = {
  id: "s", cardId: "visa", origin: "real" as const, periodStart: "2026-10-16", cutoffDate: "2026-11-15", dueDate: "2026-12-02",
  paidAt: null, paidByCurrency: { COP: "2026-12-01T05:00:00Z", USD: null }, recordedTotal: new Decimal(100000), projectedTotal: new Decimal(0),
  recordedUsd: new Decimal(5), projectedUsd: new Decimal(0), debt: { COP: new Decimal(400000), USD: new Decimal(10) }, unconvertedCharges: [],
};

describe("MonthStatementCard por moneda (D33)", () => {
  it("separa pesos y dólares, muestra la deuda total y marca cada moneda con su propio control", () => {
    const [month] = buildMonths([statement], "2026-12-01");
    const html = renderToStaticMarkup(<MonthStatementCard group={month!.cards[0]!} card={card} today="2026-12-01" />);
    expect(html).toContain("$100.000");
    expect(html).toContain("US$ 5,00");
    expect(html).toContain("Deuda total");
    expect(html).toContain("$400.000");
    expect(html).toContain("Deshacer pago en pesos");
    expect(html).toContain("Marcar como pagado en dólares");
    expect(html).toContain('aria-label="Marcar como pagado · Visa · •••• 1234 · corte 15 nov · dólares"');
    expect(html).toContain("Pendiente");
  });

  it("usa un solo control sin nombre de moneda cuando el extracto solo tiene dólares", () => {
    const [month] = buildMonths([{ ...statement, recordedTotal: new Decimal(0), paidByCurrency: { COP: null, USD: null } }], "2026-12-01");
    const html = renderToStaticMarkup(<MonthStatementCard group={month!.cards[0]!} card={card} today="2026-12-01" />);
    expect(html.match(/>Marcar como pagado</g)).toHaveLength(1);
    expect(html).not.toContain("en pesos");
  });
});
