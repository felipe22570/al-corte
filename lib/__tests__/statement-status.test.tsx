import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { StatementStatus } from "@/components/statement-status";

it("labels paid, overdue, soon and pending statements", () => {
  const render = (dueDate: string, paidAt: string | null = null) => renderToStaticMarkup(<StatementStatus dueDate={dueDate} paidAt={paidAt} today="2026-11-10" />);
  expect(render("2026-11-09")).toContain("Vencido");
  expect(render("2026-11-09", "2026-11-09T05:00:00Z")).toContain("Pagado");
  expect(render("2026-11-10")).toContain("Vence hoy");
  expect(render("2026-11-11")).toContain("Vence mañana");
  expect(render("2026-11-15")).toContain("Vence en 5 días");
  expect(render("2026-11-16")).toContain("Pendiente");
});

it.each([0, 1, 2, 3, 4, 5])("uses warning tone when the payment is due in %i days", (days) => {
  const html = renderToStaticMarkup(<StatementStatus dueDate={`2026-11-${10 + days}`} paidAt={null} today="2026-11-10" />);
  expect(html).toContain("bg-warning-soft text-warning");
});

it("keeps overdue and later payments distinct from the five-day warning", () => {
  const overdue = renderToStaticMarkup(<StatementStatus dueDate="2026-11-09" paidAt={null} today="2026-11-10" />);
  const later = renderToStaticMarkup(<StatementStatus dueDate="2026-11-16" paidAt={null} today="2026-11-10" />);
  expect(overdue).toContain("bg-danger-soft text-danger");
  expect(later).not.toContain("bg-warning-soft");
});
