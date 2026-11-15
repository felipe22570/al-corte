import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CategorySpendingChart } from "@/components/category-spending-chart";

const chart = vi.hoisted(() => ({
  bar: vi.fn(), cell: vi.fn(), xAxis: vi.fn(), yAxis: vi.fn(), tooltip: vi.fn(),
}));

vi.mock("recharts", () => {
  const Container = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  return {
    ResponsiveContainer: Container,
    BarChart: Container,
    CartesianGrid: () => null,
    Tooltip: (props: unknown) => { chart.tooltip(props); return null; },
    XAxis: (props: unknown) => { chart.xAxis(props); return null; },
    YAxis: (props: unknown) => { chart.yAxis(props); return null; },
    Bar: (props: { children?: ReactNode }) => { chart.bar(props); return <>{props.children}</>; },
    Cell: (props: unknown) => { chart.cell(props); return null; },
  };
});

beforeEach(() => vi.clearAllMocks());

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
    expect(chart.tooltip.mock.calls[0]![0].position).toEqual({ x: 0 });
    expect(chart.tooltip.mock.calls[0]![0].wrapperStyle).toEqual({ maxWidth: "100%" });
    chart.cell.mockClear();
    renderToStaticMarkup(<CategorySpendingChart rows={[...rows].reverse()} />);
    expect(chart.cell.mock.calls.map(([props]) => props.fill)).toEqual(colors.reverse());
  });
});
