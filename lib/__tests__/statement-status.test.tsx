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
