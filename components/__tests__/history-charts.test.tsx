import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CategorySpendingChart } from "@/components/category-spending-chart";
import { MonthlySpendingChart } from "@/components/monthly-spending-chart";
import { CARD_COLORS } from "@/lib/card-colors";

const chart = vi.hoisted(() => ({
  bar: vi.fn(), cell: vi.fn(), xAxis: vi.fn(), yAxis: vi.fn(),
}));

vi.mock("recharts", () => {
  const Container = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  return {
    ResponsiveContainer: Container,
    BarChart: Container,
    CartesianGrid: () => null,
    Tooltip: () => null,
    XAxis: (props: unknown) => { chart.xAxis(props); return null; },
    YAxis: (props: unknown) => { chart.yAxis(props); return null; },
    Bar: (props: { children?: ReactNode }) => { chart.bar(props); return <>{props.children}</>; },
    Cell: (props: unknown) => { chart.cell(props); return null; },
  };
});

const cards = [
  { id: "active", name: "Visa", last4: "1234", color: "card-1" as const },
  { id: "empty", name: "Sin gasto", last4: "5678", color: "card-2" as const },
  { id: "refund", name: "Devolución", last4: "9999", color: "card-3" as const },
];

beforeEach(() => vi.clearAllMocks());

describe("monthly spending chart", () => {
  it("matches all six card identities between the series and labeled legend", () => {
    const cards = CARD_COLORS.map((color) => ({ id: color, color, name: color, last4: "1234" }));
    const html = renderToStaticMarkup(<MonthlySpendingChart cards={cards} rows={[{ month: "2026-11", amounts: Object.fromEntries(CARD_COLORS.map((color) => [color, "10000"])) }]} />);
    expect(chart.bar.mock.calls.map(([props]) => props.fill)).toEqual(CARD_COLORS.map((color) => `var(--${color})`));
    for (const color of CARD_COLORS) {
      expect(html).toContain(`bg-${color}`);
      expect(html).toContain(`${color} · •••• 1234`);
    }
  });

  it("shows only cards with nonzero period values, including refunds", () => {
    const html = renderToStaticMarkup(<MonthlySpendingChart cards={cards} rows={[
      { month: "2026-10", amounts: { active: "1000000000", empty: "0" } },
      { month: "2026-11", amounts: { refund: "-200000", empty: "0.00" } },
    ]} />);
    expect(html).toContain("Visa");
    expect(html).toContain("Devolución");
    expect(html).not.toContain("Sin gasto");
    expect(html).toContain("$1.000.000.000");
    expect(chart.bar.mock.calls.map(([props]) => props.dataKey)).toEqual(["active", "refund"]);
    expect(chart.xAxis.mock.calls[0]![0].tickFormatter("2026-11")).toBe("nov");
    expect(chart.yAxis.mock.calls[0]![0].tickFormatter(1050000000)).toBe("$1.050 M");
  });

  it("uses the empty state when there are cards but no spending", () => {
    const html = renderToStaticMarkup(<MonthlySpendingChart cards={cards} rows={[{ month: "2026-11", amounts: { active: "0" } }]} />);
    expect(html).toContain("Aún no hay gasto para mostrar en este periodo.");
    expect(chart.bar).not.toHaveBeenCalled();
  });
});

describe("category spending chart", () => {
  it("uses stable colored chart tokens, with names and full amounts alongside", () => {
    const rows = [
      { id: "food", name: "Mercado", icon: null, amount: "350000000" },
      { id: "travel", name: "Viajes", icon: null, amount: "1500000" },
    ];
    const html = renderToStaticMarkup(<CategorySpendingChart rows={rows} />);
    const colors = chart.cell.mock.calls.map(([props]) => props.fill);
    expect(colors).toHaveLength(2);
    for (const color of colors) expect(color).toMatch(/^var\(--chart-[1-5]\)$/);
    expect(html).toContain("Mercado");
    expect(html).toContain("$350.000.000");
    expect(chart.xAxis.mock.calls[0]![0].tickFormatter(350000000)).toBe("$350 M");
    chart.cell.mockClear();
    renderToStaticMarkup(<CategorySpendingChart rows={[...rows].reverse()} />);
    expect(chart.cell.mock.calls.map(([props]) => props.fill)).toEqual(colors.reverse());
  });
});
