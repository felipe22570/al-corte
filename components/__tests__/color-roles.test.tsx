import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CardColorChip } from "@/components/card-color-chip";
import { CardSummary } from "@/components/card-summary";
import { DateCalendar } from "@/components/date-calendar";
import { HistoryFilters } from "@/components/history-filters";
import { StatusBadge } from "@/components/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { UtilizationBar } from "@/components/utilization-bar";
import { CARD_COLORS } from "@/lib/card-colors";

describe("functional color roles", () => {
  it.each(CARD_COLORS)("keeps %s on the card strip and chip, not the amount or status", (color) => {
    const html = renderToStaticMarkup(<CardSummary id="card" color={color} name="Visa principal" last4="1234" bank="Banco de ejemplo" available="3750000" utilization="0.25" today="2026-11-13" payment={{ total: "1250000", dueDate: "2026-11-15" }} />);
    expect(html).toMatch(new RegExp(`aria-hidden="true" class="[^"]*absolute[^"]*h-1[^"]*bg-${color}`));
    expect(html).toMatch(new RegExp(`aria-hidden="true" class="[^"]*size-2 shrink-0[^"]*bg-${color}`));
    expect(html).toContain("Visa principal · •••• 1234");
    expect(html).toContain("bg-warning-soft text-warning");
    expect(html).toMatch(/text-amount-lg text-foreground[^>]*>\$1\.250\.000/);
  });

  it("lets card labels wrap without shrinking the identifying dot", () => {
    const html = renderToStaticMarkup(<CardColorChip color="card-6" name={"Tarjeta".repeat(40)} />);
    expect(html).toContain("size-2 shrink-0 rounded-full bg-card-6");
    expect(html).toContain("min-w-0 wrap-anywhere");
  });

  it.each([
    [29, "primary-soft text-primary"],
    [30, "warning-soft text-warning"],
    [70, "warning-soft text-warning"],
    [71, "danger-soft text-danger"],
    [125, "danger-soft text-danger"],
  ])("labels utilization %s with its semantic soft pair", (percent, classes) => {
    const html = renderToStaticMarkup(<UtilizationBar percent={percent} />);
    expect(html).toContain(`bg-${classes}`);
    expect(html).toContain(`${percent}% de utilización`);
    expect(html).toContain(`aria-valuenow="${Math.min(100, percent)}"`);
    expect(html).not.toMatch(/class="[^"]*\bbg-primary(?:\s|")/);
  });

  it.each([
    ["ok", "bg-primary-soft text-primary"],
    ["warning", "bg-warning-soft text-warning"],
    ["danger", "bg-danger-soft text-danger"],
  ] as const)("retains the %s badge foreground and background contract", (tone, classes) => {
    expect(renderToStaticMarkup(<StatusBadge tone={tone} text="Estado explícito" />)).toContain(classes);
  });

  it("reserves solid brand green for the primary action, not links, destruction, or date selection", () => {
    expect(buttonVariants()).toContain("bg-primary text-primary-foreground");
    expect(buttonVariants({ variant: "link" })).toContain("text-foreground underline");
    expect(buttonVariants({ variant: "link" })).not.toContain("text-primary");
    expect(buttonVariants({ variant: "destructive" })).toContain("bg-danger-soft text-danger");
    const calendar = renderToStaticMarkup(<DateCalendar label="Fecha" value="2026-11-13" onSelect={() => {}} />);
    expect(calendar).toContain("bg-foreground text-background");
    expect(calendar).toContain('aria-selected="true"');
    expect(calendar).not.toContain("bg-primary");
  });

  it("preserves card identity alongside name and last four digits in history filters", () => {
    const html = renderToStaticMarkup(<HistoryFilters filters={{ mes: "2026-11", tarjeta: "visa" }} cards={[{ id: "visa", name: "Visa principal", last4: "1234", color: "card-4" }]} categories={[]} count={1} />);
    expect(html).toContain("bg-card-4");
    expect(html).toContain("Visa principal · •••• 1234");
  });
});
