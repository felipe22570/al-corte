import Decimal from "decimal.js";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/v2/tarjetas/abc" }));

import { Amount, amountText, currencyPair } from "../amount";
import { Chip } from "../chip";
import { describedBy, Field } from "../field";
import { InstallmentProgress, installmentProgress } from "../installment-progress";
import { monthColumnHeights } from "../month-columns";
import { activeNavKey, navItems } from "../nav-items";
import { Segmented, segmentedTarget } from "../segmented";
import { StackedBar, stackedBarSegments } from "../stacked-bar";
import { SideNav } from "../side-nav";
import { stepValue, Stepper } from "../stepper";
import { UtilizationBar, utilizationWidth } from "../utilization-bar";

describe("Amount", () => {
  it("never adds pesos and dollars: pesos lead and dollars follow (D33)", () => {
    expect(currencyPair("1640500", "9")).toEqual({ main: { value: "1640500", currency: "COP" }, second: { value: "9", currency: "USD" } });
    expect(currencyPair("1178800", "0")).toEqual({ main: { value: "1178800", currency: "COP" }, second: null });
    expect(currencyPair(new Decimal(0), new Decimal("7.6"))).toEqual({ main: { value: new Decimal("7.6"), currency: "USD" }, second: null });
    expect(currencyPair("0", "0").main.currency).toBe("COP");
  });

  it("reads as one text with the second currency and the COP reference", () => {
    expect(amountText({ value: "2819300", currency: "COP" }, { value: "9", currency: "USD" })).toBe("$2.819.300 y US$ 9,00");
    expect(amountText({ value: "9", currency: "USD" }, null, "37800")).toBe("US$ 9,00 ≈ $37.800");
    expect(amountText({ value: "100", currency: "COP" }, { value: "0", currency: "USD" })).toBe("$100");
  });

  it("hides a zero second currency and shows the reference with ≈", () => {
    const html = renderToStaticMarkup(<Amount size="hero" value="2819300" currency="COP" second={{ value: "0", currency: "USD" }} />);
    expect(html).toContain("$2.819.300");
    expect(html).not.toContain("US$");
    expect(html).toContain("ui:text-hero");
    const usd = renderToStaticMarkup(<Amount value="9" currency="USD" second={{ value: "1", currency: "COP" }} equivalent="37800" />);
    expect(usd).toContain("y $1");
    expect(usd).toContain("≈ $37.800");
  });
});

describe("Stepper", () => {
  it("keeps whole numbers within the limits", () => {
    expect(stepValue(2, 1, 1, 36)).toBe(3);
    expect(stepValue(36, 1, 1, 36)).toBe(36);
    expect(stepValue(1, -1, 1, 36)).toBe(1);
    expect(stepValue("12", 0, 1, 36)).toBe(12);
    expect(stepValue("80", 0, 1, 36)).toBe(36);
    expect(stepValue("abc", 0, 1, 36)).toBe(1);
    expect(stepValue(2.7, 0, 1, 36)).toBe(2);
  });

  it("names its buttons and disables them at the limits", () => {
    const html = renderToStaticMarkup(<Stepper id="cuotas" label="Cuotas" defaultValue={1} max={2} />);
    expect(html).toContain('aria-label="Menos cuotas"');
    expect(html).toContain('aria-label="Más cuotas"');
    expect(html).toMatch(/aria-label="Menos cuotas"[^>]*disabled=""/);
    expect(html).toContain('value="1"');
  });
});

describe("Segmented", () => {
  const options = [{ value: "purchase", label: "Compra" }, { value: "cash_advance", label: "Avance" }, { value: "refund", label: "Devolución" }] as const;
  it("moves with the arrows, wrapping around, and Home/End", () => {
    expect(segmentedTarget([...options], "purchase", "ArrowRight")).toBe("cash_advance");
    expect(segmentedTarget([...options], "refund", "ArrowRight")).toBe("purchase");
    expect(segmentedTarget([...options], "purchase", "ArrowLeft")).toBe("refund");
    expect(segmentedTarget([...options], "cash_advance", "ArrowUp")).toBe("purchase");
    expect(segmentedTarget([...options], "purchase", "ArrowDown")).toBe("cash_advance");
    expect(segmentedTarget([...options], "cash_advance", "End")).toBe("refund");
    expect(segmentedTarget([...options], "refund", "Home")).toBe("purchase");
    expect(segmentedTarget([...options], "purchase", "Enter")).toBeNull();
  });

  it("is a radio group with one focusable option and submits its value", () => {
    const html = renderToStaticMarkup(<Segmented options={[...options]} defaultValue="cash_advance" name="type" label="Tipo" />);
    expect(html).toContain('role="radiogroup"');
    expect(html.match(/role="radio"/g)).toHaveLength(3);
    expect(html).toMatch(/aria-checked="true" tabindex="0"[^>]*>Avance/);
    expect(html).toContain('<input type="hidden" name="type" value="cash_advance"/>');
  });
});

describe("InstallmentProgress", () => {
  it("clamps the installment to the plan and marks the last one", () => {
    expect(installmentProgress(3, 9)).toEqual({ current: 3, count: 9, percent: 33, last: false });
    expect(installmentProgress(12, 9)).toEqual({ current: 9, count: 9, percent: 100, last: true });
    expect(installmentProgress(0, 0)).toEqual({ current: 1, count: 1, percent: 100, last: true });
    expect(renderToStaticMarkup(<InstallmentProgress current={2} count={2} />)).toContain("Última cuota");
    expect(renderToStaticMarkup(<InstallmentProgress current={3} count={9} />)).not.toContain("Última cuota");
  });
});

describe("StackedBar", () => {
  const item = (key: string, value: string, estimated = false) => ({ key, label: key, color: "card-1" as const, value, estimated });
  it("gives whole percentages that add up to 100", () => {
    const segments = stackedBarSegments([item("a", "1"), item("b", "1"), item("c", "1")])!;
    expect(segments.map((segment) => segment.percent)).toEqual([34, 33, 33]);
    expect(stackedBarSegments([item("visa", "1178800"), item("master", "1640500")])!.map((segment) => segment.percent)).toEqual([42, 58]);
    expect(stackedBarSegments([item("a", "100"), item("b", "0")])!.map((segment) => segment.key)).toEqual(["a"]);
  });

  it("does not draw proportions with a negative part or a total that is not positive (R7)", () => {
    expect(stackedBarSegments([item("a", "100"), item("b", "-20")])).toBeNull();
    expect(stackedBarSegments([item("a", "0")])).toBeNull();
    expect(stackedBarSegments([])).toBeNull();
    const html = renderToStaticMarkup(<StackedBar items={[item("Visa", "100"), item("Mastercard", "-20")]} />);
    expect(html).not.toContain('role="img"');
    expect(html).toContain("Mastercard");
    expect(html).toContain("-$20");
  });

  it("names the composition for screen readers and patterns what is estimated", () => {
    const html = renderToStaticMarkup(<StackedBar items={[item("Visa", "60"), item("Mastercard", "40", true)]} />);
    expect(html).toContain('aria-label="Visa 60 por ciento, Mastercard 40 por ciento"');
    expect(html).toContain("ui:pattern-estimated");
  });
});

describe("bars and columns", () => {
  it("scales month columns to the largest one and leaves out negatives", () => {
    const value = (key: string, amount: string) => ({ key, color: "card-1" as const, value: amount });
    expect(monthColumnHeights([{ segments: [value("a", "100"), value("b", "50")] }, { segments: [value("a", "75"), value("b", "-10")] }], 150)).toEqual([[100, 50], [75, 0]]);
    expect(monthColumnHeights([{ segments: [value("a", "0")] }])).toEqual([[0]]);
  });

  it("clamps the utilization bar and keeps the real percentage in its text", () => {
    expect(utilizationWidth(38)).toBe(38);
    expect(utilizationWidth(125)).toBe(100);
    expect(utilizationWidth(-5)).toBe(0);
    expect(utilizationWidth(Number.NaN)).toBe(0);
    expect(renderToStaticMarkup(<UtilizationBar percent={125.4} color="card-2" />)).toContain('aria-label="125 por ciento usado"');
  });
});

describe("navigation and fields", () => {
  it("highlights the destination of each path", () => {
    expect(activeNavKey("/v2")).toBe("home");
    expect(activeNavKey("/v2/meses/2026-12")).toBe("home");
    expect(activeNavKey("/v2/tarjetas")).toBe("cards");
    expect(activeNavKey("/v2/tarjetas/abc/extractos/2026-11-15/pago")).toBe("cards");
    expect(activeNavKey("/v2/movimientos/nuevo")).toBe("movements");
    expect(activeNavKey("/v2/por-confirmar")).toBe("drafts");
    expect(activeNavKey("/v2/suscripciones")).toBe("subscriptions");
    expect(activeNavKey("/v2/ajustes/tarjetas/nueva")).toBe("settings");
    expect(activeNavKey("/v2/diseno")).toBeNull();
    expect(activeNavKey("/v2/tarjetasx")).toBeNull();
    expect(navItems().map((item) => item.label)).toEqual(["Inicio", "Por confirmar", "Tarjetas", "Movimientos", "Suscripciones", "Ajustes"]);
  });

  it("marks the current page and shows the drafts counter only when there are drafts", () => {
    const html = renderToStaticMarkup(<SideNav draftCount={4} />);
    expect(html).toMatch(/aria-current="page"[^>]*>Tarjetas/);
    expect(html).toContain('aria-label="4 por confirmar"');
    expect(renderToStaticMarkup(<SideNav draftCount={0} />)).not.toContain("por confirmar\"");
  });

  it("ties a control to its help or error", () => {
    expect(describedBy("valor")).toBeUndefined();
    expect(describedBy("valor", "Ayuda")).toBe("valor-hint");
    expect(describedBy("valor", "Ayuda", "Error")).toBe("valor-hint valor-error");
    const html = renderToStaticMarkup(<Field id="valor" label="Valor" hint="Ayuda" error="Escribe un valor"><input id="valor" /></Field>);
    expect(html).toContain('<label for="valor"');
    expect(html).toContain('id="valor-error"');
    expect(html).not.toContain("Ayuda");
  });

  it("always writes the state in a tag", () => {
    expect(renderToStaticMarkup(<Chip variant="estimated">Estimado</Chip>)).toContain("Estimado");
  });
});
