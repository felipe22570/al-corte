// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ImportReview } from "@/components/import-review";
import { ImportVerification } from "@/components/import-verification";
import { StatementImport } from "@/components/statement-import";
import type { ImportReview as Review, ReviewRow } from "@/lib/import/monthly-review";
import type { ImportRunResult } from "@/lib/import/run-monthly-import";

const actions = vi.hoisted(() => ({ reviewStatementImport: vi.fn(), saveStatementImport: vi.fn() }));
vi.mock("@/lib/actions/statement-import", () => actions);

const row = (overrides: Partial<ReviewRow>): ReviewRow => ({ key: "r", cardId: "visa", type: "purchase", date: "2026-12-03", merchant: "Librería", amount: "80000", currency: "COP", statementCutoff: "2026-12-15", status: "new", ...overrides });
const rows: ReviewRow[] = [
  row({ key: "nuevo", installment: { current: 1, count: 2 }, fee: "6840", merchant: "Avance", type: "cash_advance" }),
  row({ key: "mismo-dia", status: "conflict", reason: "same_day_amount", merchant: "Tienda B", match: { id: "m1", amount: "80000", merchant: "Tienda A", date: "2026-12-03" } }),
  row({ key: "directv", status: "conflict", reason: "subscription_amount", merchant: "DIRECTV", amount: "140910", match: { id: "m2", amount: "83350", merchant: "DirecTV", date: "2026-12-04" } }),
  row({ key: "interes", status: "statement_conflict", type: "interest", merchant: "Intereses", amount: "12500", match: { id: "m3", amount: "12000", merchant: null, date: "2026-12-15" } }),
  row({ key: "pago", status: "payment_missing", type: "payment", merchant: "Pago", statementCutoff: "2026-11-15" }),
  row({ key: "usd", status: "blocked", blocked: "Falta la TRM del 2026-12-05.", currency: "USD", amount: "2.79" }),
  row({ key: "ya", status: "registered", merchant: "Netflix", match: { id: "m4", amount: "44900", merchant: "Netflix", date: "2026-12-07" } }),
  row({ key: "pago-ya", status: "payment_registered", type: "payment", merchant: "Pago anterior" }),
];
const review: Review = {
  rows, warnings: ["La tarjeta •••• 4242 tiene en el archivo otras condiciones (corte). Se usan las que tienes en Al Corte."],
  statements: [{ cardId: "visa", cardName: "Visa", last4: "4242", color: "card-2", cutoffDate: "2026-12-15", dueDate: "2027-01-02", bank: [{ currency: "COP", minimum: "150000.00", total: "500000.00" }, { currency: "USD", minimum: "9.00", total: "154.00" }], bankAvailable: "4000000.00" }],
};
const verification = [
  { cardId: "visa", cutoffDate: "2026-12-15", currency: "COP" as const, minimum: "149999.40", debt: "498000.00", realMinimum: "140000.00", realTotal: "500000.00", available: "3990000.00" },
  { cardId: "visa", cutoffDate: "2026-12-15", currency: "USD" as const, minimum: "8.22", debt: "153.26", realMinimum: null, realTotal: null, available: "3990000.00" },
];
const result = (overrides: Partial<Extract<ImportRunResult, { ok: true }>> = {}): ImportRunResult => ({ ok: true, review, decisions: { nuevo: "import", "mismo-dia": "skip", directv: "skip" }, verification, created: 1, linked: 0, dryRun: true, ...overrides });

describe("revisión de la importación (F22)", () => {
  it("agrupa por estado y explica cada diferencia", () => {
    const html = renderToStaticMarkup(<ImportReview rows={rows} decisions={{ nuevo: "import" }} onDecision={() => {}} cards={{ visa: { name: "Visa", last4: "4242" } }} today="2026-12-20" />);
    for (const title of ["Nuevos (1)", "En conflicto (2)", "Pagos sin registrar (1)", "Revisar en el cierre (1)", "No se pueden importar (1)", "Ya registrados (1)", "Pagos ya registrados (1)"]) expect(html).toContain(title);
    expect(html).toContain("3 dic · •••• 4242 · Cuota 1 de 2 · comisión $6.840");
    expect(html).toContain("En Al Corte: Tienda A · 3 dic · $80.000");
    expect(html).toContain("El banco cobró $140.910; el cobro de tu suscripción es de $83.350.");
    expect(html).toContain("En Al Corte es de $12.000.");
    expect(html).toContain('href="/tarjetas/visa/extractos/2026-12-15#cierre"');
    expect(html).toContain('href="/tarjetas/visa/extractos/2026-11-15"');
    expect(html).toContain("Falta la TRM del 2026-12-05.");
    expect(html).toContain('href="/movimientos/m4"');
    expect(html).toContain("Es el mismo");
    expect(html).toContain("Importar como nuevo");
  });

  it("compara con el banco, avisa los valores que se conservan y la diferencia de cupo en dólares", () => {
    const html = renderToStaticMarkup(<ImportVerification title="Verificación antes de guardar" statements={review.statements} verification={verification} today="2026-12-20" />);
    expect(html).toContain("Banco: $150.000 · coincide");
    expect(html).toContain("Banco: $500.000 · diferencia +$2.000");
    expect(html).toContain("Ya tenías otros valores del banco para este extracto y se conservan: $140.000 y $500.000.");
    expect(html).toContain("Banco: US$ 9,00 · coincide");
    expect(html).toContain("Banco: $4.000.000 · diferencia +$10.000");
    expect(html).toContain("puede no coincidir con el del banco");
  });
});

describe("flujo de importación (F22)", () => {
  let container: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    actions.reviewStatementImport.mockReset();
    actions.saveStatementImport.mockReset();
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });
  const button = (text: string) => [...container.querySelectorAll<HTMLButtonElement>("button")].find((item) => item.textContent === text)!;
  async function choose() {
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(input, "files", { value: [new File(["{}"], "extracto.json", { type: "application/json" })], configurable: true });
    await act(async () => input.dispatchEvent(new Event("change", { bubbles: true })));
  }

  it("revisa, vuelve a verificar con cada decisión y guarda con las decisiones del dueño", async () => {
    actions.reviewStatementImport.mockResolvedValue(result());
    actions.saveStatementImport.mockResolvedValue(result({ dryRun: false, created: 1, linked: 1 }));
    await act(async () => root.render(<StatementImport today="2026-12-20" />));
    expect(button("Revisar archivo").disabled).toBe(true);
    await choose();
    await act(async () => button("Revisar archivo").click());
    expect(container.textContent).toContain("Verificación antes de guardar");
    expect(container.textContent).toContain("1 movimiento nuevo");
    const same = container.querySelector<HTMLInputElement>('input[name="decision-mismo-dia"][value="link"]')!;
    await act(async () => same.click());
    expect(actions.reviewStatementImport).toHaveBeenCalledTimes(2);
    expect(JSON.parse(String((actions.reviewStatementImport.mock.calls[1]![0] as FormData).get("decisions")))).toMatchObject({ "mismo-dia": "link" });
    expect(container.textContent).toContain("1 por enlazar");
    await act(async () => button("Guardar importación").click());
    const sent = actions.saveStatementImport.mock.calls[0]![0] as FormData;
    expect((sent.get("file") as File).name).toBe("extracto.json");
    expect(container.textContent).toContain("Importaste 1 movimiento y enlazaste 1.");
    expect(container.querySelector('a[href="/tarjetas/visa/extractos/2026-12-15#cierre"]')).not.toBeNull();
    await act(async () => button("Importar otro archivo").click());
    expect(button("Revisar archivo").disabled).toBe(true);
  });

  it("muestra el error sin perder el archivo elegido", async () => {
    actions.reviewStatementImport.mockResolvedValue({ ok: false, error: "No tienes una tarjeta activa terminada en 4242. Regístrala antes de importar." });
    await act(async () => root.render(<StatementImport today="2026-12-20" />));
    await choose();
    await act(async () => button("Revisar archivo").click());
    expect(container.textContent).toContain("No tienes una tarjeta activa terminada en 4242.");
    expect(button("Revisar archivo").disabled).toBe(false);
    actions.reviewStatementImport.mockRejectedValue(new Error("red"));
    await act(async () => button("Revisar archivo").click());
    expect(container.textContent).toContain("No pudimos revisar el archivo. No se guardó nada.");
  });
});
